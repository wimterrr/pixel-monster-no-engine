import fs from "node:fs/promises";
import path from "node:path";

export class CompileError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompileError";
  }
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function arrayToMap(properties = []) {
  return Object.fromEntries(properties.map((property) => [property.name, property.value]));
}

function assert(condition, message) {
  if (!condition) {
    throw new CompileError(message);
  }
}

function getLayer(map, name, type) {
  const layer = map.layers.find((candidate) => candidate.name === name);
  assert(layer, `Missing required layer "${name}".`);
  assert(layer.type === type, `Layer "${name}" must be ${type}.`);
  return layer;
}

function toTileRect(object, tileSize) {
  return {
    x: Math.floor(object.x / tileSize),
    y: Math.floor(object.y / tileSize),
    width: Math.max(1, Math.floor(object.width / tileSize)),
    height: Math.max(1, Math.floor(object.height / tileSize))
  };
}

export async function compileMap({
  rootDir,
  mapPath,
  schemaPath,
  monstersPath,
  encountersPath
}) {
  const [schema, monsters, encounters, map] = await Promise.all([
    readJson(schemaPath),
    readJson(monstersPath),
    readJson(encountersPath),
    readJson(mapPath)
  ]);

  const tileSize = map.tilewidth;
  assert(tileSize === map.tileheight, "Only square tiles are supported in this slice.");

  for (const [name, type] of Object.entries(schema.requiredLayers)) {
    getLayer(map, name, type);
  }

  const ground = getLayer(map, "ground", "tilelayer");
  const collision = getLayer(map, "collision", "tilelayer");
  const markers = getLayer(map, "markers", "objectgroup");

  assert(
    ground.data.length === map.width * map.height,
    `Ground layer length mismatch for ${path.basename(mapPath)}.`
  );
  assert(
    collision.data.length === map.width * map.height,
    `Collision layer length mismatch for ${path.basename(mapPath)}.`
  );

  const checkpoints = [];
  const encounterZones = [];

  for (const object of markers.objects ?? []) {
    const classSchema = schema.markerClasses[object.class];
    assert(classSchema, `Unsupported marker class "${object.class}".`);
    const props = arrayToMap(object.properties);

    for (const key of classSchema.requiredProperties) {
      assert(props[key], `Marker "${object.name}" is missing property "${key}".`);
    }

    if (object.class === "checkpoint") {
      checkpoints.push({
        id: props.checkpointId,
        name: object.name,
        tile: {
          x: Math.floor(object.x / tileSize),
          y: Math.floor(object.y / tileSize)
        }
      });
    }

    if (object.class === "encounter_zone") {
      const encounter = encounters[props.encounterId];
      assert(
        encounter,
        `Encounter zone "${object.name}" references missing encounter "${props.encounterId}".`
      );
      const monster = monsters[encounter.monsterId];
      assert(
        monster,
        `Encounter "${props.encounterId}" references missing monster "${encounter.monsterId}".`
      );

      encounterZones.push({
        id: `${map.routeId}:${object.id}`,
        name: object.name,
        encounterId: props.encounterId,
        rect: toTileRect(object, tileSize)
      });
    }
  }

  assert(checkpoints.length > 0, "At least one checkpoint marker is required.");
  assert(encounterZones.length > 0, "At least one encounter zone is required.");

  return {
    bundleVersion: 1,
    routeId: map.routeId,
    tileSize,
    map: {
      width: map.width,
      height: map.height,
      ground: ground.data,
      collision: collision.data.map((value) => (value ? 1 : 0))
    },
    startCheckpointId: checkpoints[0].id,
    checkpoints,
    encounterZones,
    encounters,
    monsters,
    source: {
      schema: path.relative(rootDir, schemaPath),
      map: path.relative(rootDir, mapPath)
    }
  };
}

export async function writeBundle(outputPath, bundle) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}
