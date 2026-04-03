import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const rootDir = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      continue;
    }
    const name = key.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[name] = value;
    if (value !== "true") {
      i += 1;
    }
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
    throw new Error(`Replicate API failed (${res.status}): ${message}`);
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

const args = parseArgs(process.argv);
const model = args.model || "retro-diffusion/rd-plus";
const prompt = args.prompt || "";
const style = args.style || "topdown_map";
const width = Number(args.width || 256);
const height = Number(args.height || 256);
const numImages = Number(args["num-images"] || 1);
const removeBg = args["remove-bg"] === "true";
const tileX = args["tile-x"] === "true";
const tileY = args["tile-y"] === "true";
const returnSpritesheet = args["return-spritesheet"] === "true";
const outPath = path.resolve(rootDir, args.out || `assets/replicate/${Date.now()}.png`);

if (!prompt) {
  console.error(
    [
      "Missing required flag: --prompt",
      "",
      "Example:",
      '  npm run replicate -- --model retro-diffusion/rd-plus --style topdown_map --width 256 --height 256 --prompt "top-down forest path, classic jrpg map" --out assets/replicate/map.png'
    ].join("\n")
  );
  process.exit(1);
}

const env = {
  ...(await loadDotEnv(path.join(rootDir, ".env"))),
  ...process.env
};

const token = env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Missing REPLICATE_API_TOKEN (set in .env or environment).");
  process.exit(1);
}

const [owner, name] = model.split("/");
if (!owner || !name) {
  console.error('Invalid --model. Expected "owner/name".');
  process.exit(1);
}

const prediction = await jsonRequest(`https://api.replicate.com/v1/models/${owner}/${name}/predictions`, {
  method: "POST",
  headers: {
    authorization: `Token ${token}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    input: {
      prompt,
      style,
      width,
      height,
      num_images: numImages,
      remove_bg: removeBg,
      tile_x: tileX,
      tile_y: tileY,
      return_spritesheet: returnSpritesheet
    }
  })
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

await downloadTo(url, outPath);
console.log(JSON.stringify({ ok: true, model, id: prediction.id, out: path.relative(rootDir, outPath) }, null, 2));

