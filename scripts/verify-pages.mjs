import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPagesReceipt,
  PAGE_RECEIPT_PATH,
  PAGE_SURFACE
} from "./lib/pages-receipt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.resolve(rootDir, "docs");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const receiptPath = path.resolve(docsDir, PAGE_RECEIPT_PATH);
  const rawReceipt = await fs.readFile(receiptPath, "utf8");
  const receipt = JSON.parse(rawReceipt);
  const expectedReceipt = await createPagesReceipt({ rootDir, docsDir });

  assert(receipt && typeof receipt === "object", "docs build receipt must be a JSON object.");
  assert(typeof receipt.built_at === "string" && receipt.built_at, "docs build receipt must record built_at.");
  assert(receipt.route_id === "Route01", `docs build receipt route_id must stay Route01, got "${receipt.route_id}".`);
  assert(receipt.files && typeof receipt.files === "object", "docs build receipt must include file hashes.");

  for (const relativePath of PAGE_SURFACE) {
    const recorded = receipt.files[relativePath];
    const expected = expectedReceipt.files[relativePath];
    assert(recorded, `docs build receipt is missing "${relativePath}".`);
    assert(
      recorded.root_sha256 === expected.root_sha256,
      `root surface drift detected for "${relativePath}". Rebuild docs after updating the tracked source.`
    );
    assert(
      recorded.docs_sha256 === expected.docs_sha256,
      `docs artifact drift detected for "${relativePath}". Re-run npm run build:pages before claiming the Pages proof is fresh.`
    );
    assert(
      recorded.root_sha256 === recorded.docs_sha256,
      `docs artifact mismatch for "${relativePath}". Root and docs must stay byte-identical on the shipped proof surface.`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked_files: PAGE_SURFACE.length,
        receipt_path: receiptPath,
        built_at: receipt.built_at
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
