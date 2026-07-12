import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const runtimeFiles = [
  "index.html",
  "style.css",
  "audioManager.js",
  "classes.js",
  "gameStateManager.js",
  "items.js",
  "main.js",
  "map.js",
  "npcs.js",
  "paneResizer.js",
  "player.js",
  "room.js",
  "roomManager.js",
  "roomSounds.js",
  "saveManager.js",
  "soundEffects.js",
  "traversal.js",
  "ui.js"
];

const jsonFiles = [
  "outerTemplates.json",
  "roomTemplates.json"
];

async function assertSafeDistPath() {
  const resolvedRoot = path.resolve(root);
  const resolvedDist = path.resolve(dist);
  if (!resolvedDist.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to remove unsafe dist path: ${resolvedDist}`);
  }
}

async function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(dist, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function compactJson(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(dist, relativePath);
  const data = JSON.parse(await fs.readFile(source, "utf8"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data), "utf8");
}

async function main() {
  await assertSafeDistPath();
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });

  await Promise.all(runtimeFiles.map(copyFile));
  await Promise.all(jsonFiles.map(compactJson));
  await fs.cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });

  console.log(`Built compact dist at ${dist}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
