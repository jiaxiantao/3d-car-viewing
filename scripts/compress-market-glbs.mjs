/**
 * Compress market GLBs with Draco (gltf-transform).
 * Backs up originals to *-src.glb on first run, then overwrites the mainstream names.
 *
 * Usage: node scripts/compress-market-glbs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, prune, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARKET_DIR = path.join(ROOT, "public", "models", "market");

const FILES = [
  "suv-mainstream.glb",
  "sedan-mainstream.glb",
  "offroad-mainstream.glb",
];

async function createIo() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });
  return io;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressOne(io, fileName) {
  const targetPath = path.join(MARKET_DIR, fileName);
  if (!fs.existsSync(targetPath)) {
    console.warn(`[compress] skip missing ${fileName}`);
    return null;
  }

  const srcName = fileName.replace(/\.glb$/, "-src.glb");
  const srcPath = path.join(MARKET_DIR, srcName);

  if (!fs.existsSync(srcPath)) {
    fs.copyFileSync(targetPath, srcPath);
    console.log(`[compress] backed up ${fileName} -> ${srcName}`);
  }

  const inputPath = srcPath;
  const before = fs.statSync(inputPath).size;
  console.log(`[compress] ${fileName}: reading ${formatMb(before)}…`);

  const document = await io.read(inputPath);
  await document.transform(
    dedup(),
    weld(),
    prune(),
    draco({
      method: "edgebreaker",
      encodeSpeed: 3,
      decodeSpeed: 5,
      quantizePosition: 12,
      quantizeNormal: 8,
      quantizeTexcoord: 10,
      quantizeColor: 8,
      quantizeGeneric: 10,
    }),
  );
  await io.write(targetPath, document);

  const after = fs.statSync(targetPath).size;
  const ratio = ((1 - after / before) * 100).toFixed(1);
  console.log(
    `[compress] ${fileName}: ${formatMb(before)} -> ${formatMb(after)} (−${ratio}%)`,
  );
  return { fileName, before, after };
}

async function main() {
  if (!fs.existsSync(MARKET_DIR)) {
    console.error(`[compress] missing ${MARKET_DIR}`);
    process.exit(1);
  }

  const io = await createIo();
  const results = [];
  for (const fileName of FILES) {
    const result = await compressOne(io, fileName);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.error("[compress] no files processed");
    process.exit(1);
  }

  const totalBefore = results.reduce((sum, r) => sum + r.before, 0);
  const totalAfter = results.reduce((sum, r) => sum + r.after, 0);
  console.log(
    `[compress] total: ${formatMb(totalBefore)} -> ${formatMb(totalAfter)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
