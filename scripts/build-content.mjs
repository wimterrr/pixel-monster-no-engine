import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileMap, writeBundle } from "./lib/compiler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }
  return process.argv[index + 1];
}

const mapPath = path.resolve(
  rootDir,
  argValue("--entry", "content/raw/maps/Route01.map.json")
);
const outputPath = path.resolve(
  rootDir,
  argValue("--out", "generated/Route01.bundle.json")
);

try {
  const bundle = await compileMap({
    rootDir,
    mapPath,
    schemaPath: path.resolve(rootDir, "content/schema/route-schema.json"),
    monstersPath: path.resolve(rootDir, "content/raw/monsters.json"),
    encountersPath: path.resolve(rootDir, "content/raw/encounters.json")
  });

  await writeBundle(outputPath, bundle);
  console.log(`Compiled ${bundle.routeId} -> ${path.relative(rootDir, outputPath)}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
