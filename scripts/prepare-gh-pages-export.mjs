import fs from "node:fs";
import path from "node:path";

const OUT_DIR = process.argv[2] ?? "out";
const FROM = "_next";
const TO = "next-static";

const outRoot = path.resolve(OUT_DIR);
const fromDir = path.join(outRoot, FROM);
const toDir = path.join(outRoot, TO);

if (!fs.existsSync(fromDir)) {
  console.error(`[gh-pages] missing ${fromDir}`);
  process.exit(1);
}

fs.renameSync(fromDir, toDir);

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".txt",
  ".rsc",
  ".map",
]);

function rewriteContent(content) {
  return content
    .replaceAll("/_next/", `/${TO}/`)
    .replaceAll('"_next/', `"${TO}/`)
    .replaceAll("'_next/", `'${TO}/`)
    .replaceAll("\\/_next\\/", `\\/${TO}\\/`);
}

function walkFiles(dir, visitor) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, visitor);
      continue;
    }
    visitor(fullPath);
  }
}

let rewritten = 0;
walkFiles(outRoot, (filePath) => {
  const ext = path.extname(filePath);
  if (!TEXT_EXTENSIONS.has(ext)) {
    return;
  }
  const original = fs.readFileSync(filePath, "utf8");
  const next = rewriteContent(original);
  if (next !== original) {
    fs.writeFileSync(filePath, next);
    rewritten += 1;
  }
});

fs.writeFileSync(path.join(outRoot, ".nojekyll"), "# disable jekyll\n");

console.log(`[gh-pages] renamed ${FROM} -> ${TO}, rewrote ${rewritten} files`);
