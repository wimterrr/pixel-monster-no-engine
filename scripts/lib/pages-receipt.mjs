import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const PAGE_RECEIPT_PATH = "build-receipt.json";

export const PAGE_SURFACE = [
  "index.html",
  "src/main.js",
  "src/render.js",
  "src/save.js",
  "src/sprites.js",
  "src/styles.css",
  "generated/Route01.bundle.json"
];

export async function sha256File(filePath) {
  const contents = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(contents).digest("hex");
}

export async function createPagesReceipt({ rootDir, docsDir }) {
  const files = {};

  for (const relativePath of PAGE_SURFACE) {
    const rootPath = path.resolve(rootDir, relativePath);
    const docsPath = path.resolve(docsDir, relativePath);
    files[relativePath] = {
      root_sha256: await sha256File(rootPath),
      docs_sha256: await sha256File(docsPath)
    };
  }

  return {
    built_at: new Date().toISOString(),
    route_id: "Route01",
    files
  };
}
