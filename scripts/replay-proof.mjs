import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { compileMap, CompileError } from "./lib/compiler.mjs";
import { deserializeSave, serializeSave } from "../src/save.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const generatedBundlePath = path.resolve(rootDir, "generated/Route01.bundle.json");
const receiptPath = path.resolve(rootDir, "outputs/latest-proof-replay.json");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function compile(entry) {
  return compileMap({
    rootDir,
    mapPath: path.resolve(rootDir, entry),
    schemaPath: path.resolve(rootDir, "content/schema/route-schema.json"),
    monstersPath: path.resolve(rootDir, "content/raw/monsters.json"),
    encountersPath: path.resolve(rootDir, "content/raw/encounters.json")
  });
}

async function main() {
  const bundle = await compile("content/raw/maps/Route01.map.json");
  const generatedBundle = JSON.parse(await fs.readFile(generatedBundlePath, "utf8"));

  assert.deepEqual(
    generatedBundle,
    bundle,
    "generated/Route01.bundle.json must match a fresh compile before claiming the proof replay passed."
  );

  const saved = serializeSave({
    bundle,
    checkpointId: "route01_start",
    roster: ["sprout"],
    inventory: { captureOrb: 0 },
    lastBattlePayload: {
      routeId: bundle.routeId,
      encounterId: "route01_sprout",
      outcome: "captured",
      checkpointId: "route01_start",
      rosterDelta: ["sprout"],
      rosterSize: 1,
      captureOrbRemaining: 0
    }
  });

  const loaded = deserializeSave(bundle, saved);
  assert.equal(loaded.checkpointId, "route01_start");
  assert.deepEqual(loaded.roster, ["sprout"]);
  assert.equal(loaded.inventory.captureOrb, 0);
  assert.equal(loaded.lastBattlePayload?.outcome, "captured");

  let brokenFixtureError = "";
  try {
    await compile("content/raw/maps/Route01.broken.map.json");
    throw new Error("Broken fixture compiled successfully.");
  } catch (error) {
    if (!(error instanceof CompileError)) {
      throw error;
    }
    brokenFixtureError = error.message;
  }

  assert.match(
    brokenFixtureError,
    /references missing encounter "missing_encounter"/,
    "Broken fixture must keep failing with the named missing encounter receipt."
  );

  const receipt = {
    ok: true,
    checked_at: new Date().toISOString(),
    route_id: bundle.routeId,
    generated_bundle_sha256: sha256(JSON.stringify(generatedBundle)),
    replay: {
      checkpoint_id: loaded.checkpointId,
      roster: loaded.roster,
      capture_orb: loaded.inventory.captureOrb,
      last_battle_outcome: loaded.lastBattlePayload?.outcome ?? null,
      last_battle_encounter_id: loaded.lastBattlePayload?.encounterId ?? null
    },
    compiler_failure: {
      map: "content/raw/maps/Route01.broken.map.json",
      error: brokenFixtureError
    }
  };

  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
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
