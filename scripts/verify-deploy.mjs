import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_RECEIPT_PATH, PAGE_SURFACE } from "./lib/pages-receipt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.resolve(rootDir, "docs");
const args = process.argv.slice(2);

function readFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return "";
  }
  return (args[index + 1] || "").trim();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeBaseUrl(value) {
  if (!value) {
    throw new Error("Missing deploy URL. Pass --url <https://.../>.");
  }
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveDeployUrl(baseUrl, relativePath) {
  if (relativePath === "index.html") {
    return new URL("./", baseUrl).toString();
  }
  return new URL(relativePath, baseUrl).toString();
}

async function main() {
  const baseUrl = normalizeBaseUrl(readFlag("--url"));
  const receiptPath = path.resolve(docsDir, PAGE_RECEIPT_PATH);
  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  const files = {};

  for (const relativePath of PAGE_SURFACE) {
    const url = resolveDeployUrl(baseUrl, relativePath);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Deploy fetch failed for "${relativePath}" (${response.status}) at ${url}`);
    }

    const body = await response.text();
    const liveSha256 = sha256(body);
    const expected = receipt.files?.[relativePath];
    if (!expected?.docs_sha256) {
      throw new Error(`Docs receipt is missing "${relativePath}".`);
    }
    if (liveSha256 !== expected.docs_sha256) {
      throw new Error(
        `Live deploy drift detected for "${relativePath}". Expected ${expected.docs_sha256} but got ${liveSha256}.`
      );
    }

    files[relativePath] = {
      url,
      live_sha256: liveSha256,
      docs_sha256: expected.docs_sha256,
      last_modified: response.headers.get("last-modified"),
      etag: response.headers.get("etag")
    };
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked_files: PAGE_SURFACE.length,
        receipt_path: receiptPath,
        deploy_url: baseUrl,
        built_at: receipt.built_at,
        files
      },
      null,
      2
    )
  );
}

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
}
