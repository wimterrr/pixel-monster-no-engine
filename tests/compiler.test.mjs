import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileMap, CompileError } from "../scripts/lib/compiler.mjs";
import { deserializeSave, serializeSave } from "../src/save.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function compile(entry) {
  return compileMap({
    rootDir,
    mapPath: path.resolve(rootDir, entry),
    schemaPath: path.resolve(rootDir, "content/schema/route-schema.json"),
    monstersPath: path.resolve(rootDir, "content/raw/monsters.json"),
    encountersPath: path.resolve(rootDir, "content/raw/encounters.json")
  });
}

test("compileMap builds Route01 bundle with checkpoint and encounter zone", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.equal(bundle.routeId, "Route01");
  assert.equal(bundle.startCheckpointId, "route01_start");
  assert.equal(bundle.checkpoints.length, 1);
  assert.equal(bundle.encounterZones.length, 1);
  assert.equal(bundle.encounters.route01_sprout.monsterId, "sprout");
});

test("compileMap rejects broken map fixture before runtime", async () => {
  await assert.rejects(
    () => compile("content/raw/maps/Route01.broken.map.json"),
    (error) =>
      error instanceof CompileError &&
      error.message.includes('references missing encounter "missing_encounter"')
  );
});

test("generated bundle exists after build step", async () => {
  const bundlePath = path.resolve(rootDir, "generated/Route01.bundle.json");
  const raw = await fs.readFile(bundlePath, "utf8");
  const bundle = JSON.parse(raw);

  assert.equal(bundle.routeId, "Route01");
});

test("save contract reloads checkpoint, roster delta, and spent orb state", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");
  const saved = serializeSave({
    bundle,
    checkpointId: "route01_start",
    roster: ["sprout"],
    inventory: { captureOrb: 0 },
    lastBattlePayload: {
      routeId: bundle.routeId,
      encounterId: "route01_sprout",
      outcome: "captured"
    }
  });

  const loaded = deserializeSave(bundle, saved);

  assert.equal(loaded.checkpointId, "route01_start");
  assert.deepEqual(loaded.roster, ["sprout"]);
  assert.equal(loaded.inventory.captureOrb, 0);
  assert.equal(loaded.lastBattlePayload.outcome, "captured");
});

test("save contract rejects stale route saves before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: "Route99",
        checkpointId: "route01_start",
        roster: [],
        inventory: { captureOrb: 1 }
      }),
    /does not match bundle/
  );
});

test("save contract rejects invalid orb counts before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: [],
        inventory: { captureOrb: -1 }
      }),
    /Invalid capture orb count/
  );
});

test("save contract rejects unknown roster monsters before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: ["missingno"],
        inventory: { captureOrb: 1 }
      }),
    /Unknown roster monster/
  );
});

test("save contract rejects duplicate roster monsters before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: ["sprout", "sprout"],
        inventory: { captureOrb: 1 }
      }),
    /Duplicate roster monster/
  );
});

test("save contract rejects malformed saved battle payload before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: [],
        inventory: { captureOrb: 1 },
        lastBattlePayload: {
          routeId: bundle.routeId,
          encounterId: "missing_encounter",
          outcome: "captured",
          checkpointId: "route01_start",
          captureOrbRemaining: 0
        }
      }),
    /Unknown encounter/
  );
});

test("save contract rejects battle payload roster duplicates before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: ["sprout"],
        inventory: { captureOrb: 0 },
        lastBattlePayload: {
          routeId: bundle.routeId,
          encounterId: "route01_sprout",
          outcome: "captured",
          checkpointId: "route01_start",
          rosterDelta: ["sprout", "sprout"],
          captureOrbRemaining: 0
        }
      }),
    /Duplicate roster monster/
  );
});

test("save contract rejects battle payload orb counts that drift from saved inventory", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: ["sprout"],
        inventory: { captureOrb: 0 },
        lastBattlePayload: {
          routeId: bundle.routeId,
          encounterId: "route01_sprout",
          outcome: "captured",
          checkpointId: "route01_start",
          rosterDelta: ["sprout"],
          captureOrbRemaining: 1
        }
      }),
    /does not match saved inventory/
  );
});

test("save contract rejects battle payload roster drift before runtime state mutates", async () => {
  const bundle = await compile("content/raw/maps/Route01.map.json");

  assert.throws(
    () =>
      deserializeSave(bundle, {
        routeId: bundle.routeId,
        checkpointId: "route01_start",
        roster: ["sprout"],
        inventory: { captureOrb: 0 },
        lastBattlePayload: {
          routeId: bundle.routeId,
          encounterId: "route01_sprout",
          outcome: "captured",
          checkpointId: "route01_start",
          rosterSize: 1,
          rosterDelta: [],
          captureOrbRemaining: 0
        }
      }),
    /does not match saved roster/
  );
});
