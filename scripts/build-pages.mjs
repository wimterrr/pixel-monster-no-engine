import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileMap, writeBundle } from "./lib/compiler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.resolve(rootDir, "docs");

async function rmrf(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function copyDir(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDir(sourcePath, destPath);
      continue;
    }
    await fs.copyFile(sourcePath, destPath);
  }
}

await rmrf(docsDir);
await fs.mkdir(docsDir, { recursive: true });

// Build the compiled bundle (runtime must only read compiled artifacts).
const bundle = await compileMap({
  rootDir,
  mapPath: path.resolve(rootDir, "content/raw/maps/Route01.map.json"),
  schemaPath: path.resolve(rootDir, "content/schema/route-schema.json"),
  monstersPath: path.resolve(rootDir, "content/raw/monsters.json"),
  encountersPath: path.resolve(rootDir, "content/raw/encounters.json")
});

const generatedDir = path.resolve(rootDir, "generated");
await fs.mkdir(generatedDir, { recursive: true });
await writeBundle(path.resolve(generatedDir, "Route01.bundle.json"), bundle);

// Assemble a static artifact for GitHub Pages.
await fs.copyFile(path.resolve(rootDir, "index.html"), path.resolve(docsDir, "index.html"));
await copyDir(path.resolve(rootDir, "src"), path.resolve(docsDir, "src"));
await copyDir(path.resolve(rootDir, "generated"), path.resolve(docsDir, "generated"));
await fs.writeFile(path.resolve(docsDir, ".nojekyll"), "", "utf8");

console.log("Built docs/ for GitHub Pages.");
