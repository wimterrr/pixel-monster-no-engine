import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const rootDir = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[name] = value;
    if (value !== "true") i += 1;
  }
  return args;
}

async function loadDotEnv(envPath) {
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const env = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return env;
  } catch {
    return {};
  }
}

async function jsonRequest(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message = typeof body === "string" ? body : JSON.stringify(body);
    const error = new Error(`Replicate API failed (${res.status}): ${message}`);
    error.status = res.status;
    throw error;
  }
  return body;
}

async function downloadTo(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buf);
}

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function predict({ token, model, input }) {
  const [owner, name] = String(model || "").split("/");
  if (!owner || !name) {
    throw new Error(`Invalid model "${model}" (expected "owner/name")`);
  }

  const prediction = await jsonRequest(`https://api.replicate.com/v1/models/${owner}/${name}/predictions`, {
    method: "POST",
    headers: {
      authorization: `Token ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ input })
  });

  let status = prediction;
  while (status.status === "starting" || status.status === "processing") {
    await sleep(1000);
    status = await jsonRequest(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { authorization: `Token ${token}` }
    });
  }

  if (status.status !== "succeeded") {
    throw new Error(`Prediction ${prediction.id} ended with status: ${status.status}`);
  }

  const output = status.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url || typeof url !== "string") {
    throw new Error(`Unexpected output payload: ${JSON.stringify(output)}`);
  }

  return { id: prediction.id, url };
}

const args = parseArgs(process.argv);
const manifestPath = path.resolve(rootDir, args.manifest || "assets/replicate/manifest.json");
const dryRun = args["dry-run"] === "true";
const onlyMissing = args["only-missing"] !== "false";
const minIntervalMs = Number(args["min-interval-ms"] || 11_000); // ~6/min default

const env = {
  ...(await loadDotEnv(path.join(rootDir, ".env"))),
  ...process.env
};

const token = env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Missing REPLICATE_API_TOKEN (set in .env or environment).");
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`Failed to read manifest: ${path.relative(rootDir, manifestPath)}`);
  throw error;
}

const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
if (!assets.length) {
  console.log(JSON.stringify({ ok: true, generated: 0, skipped: 0, note: "No assets in manifest." }, null, 2));
  process.exit(0);
}

let generated = 0;
let skipped = 0;
let lastStartAt = 0;

for (const entry of assets) {
  const outRel = entry?.out;
  const prompt = entry?.prompt;
  const model = entry?.model || "retro-diffusion/rd-plus";
  if (!outRel || !prompt) {
    console.warn(`Skipping invalid entry (needs "out" + "prompt"): ${JSON.stringify(entry)}`);
    skipped += 1;
    continue;
  }

  const outAbs = path.resolve(rootDir, outRel);
  if (onlyMissing && (await fileExists(outAbs))) {
    skipped += 1;
    continue;
  }

  const now = Date.now();
  const wait = Math.max(0, lastStartAt + minIntervalMs - now);
  if (wait) {
    await sleep(wait);
  }
  lastStartAt = Date.now();

  const input = {
    prompt,
    style: entry?.style || "topdown_map",
    width: Number(entry?.width || 256),
    height: Number(entry?.height || 256),
    num_images: Number(entry?.num_images || entry?.numImages || 1),
    remove_bg: Boolean(entry?.remove_bg ?? entry?.removeBg ?? true),
    tile_x: Boolean(entry?.tile_x ?? entry?.tileX ?? false),
    tile_y: Boolean(entry?.tile_y ?? entry?.tileY ?? false),
    return_spritesheet: Boolean(entry?.return_spritesheet ?? entry?.returnSpritesheet ?? false)
  };

  if (dryRun) {
    console.log(JSON.stringify({ wouldGenerate: true, model, out: outRel, input }, null, 2));
    continue;
  }

  try {
    const result = await predict({ token, model, input });
    await downloadTo(result.url, outAbs);
    generated += 1;
    console.log(JSON.stringify({ ok: true, model, id: result.id, out: outRel }, null, 2));
  } catch (error) {
    // Simple backoff on rate limits.
    if (error?.status === 429) {
      await sleep(Math.max(minIntervalMs, 20_000));
      continue;
    }
    throw error;
  }
}

console.log(JSON.stringify({ ok: true, generated, skipped }, null, 2));

