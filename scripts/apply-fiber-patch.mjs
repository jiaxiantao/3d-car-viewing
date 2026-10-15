import fs from "node:fs";
import path from "node:path";

const marker = 'Symbol.for("showroom.fiberFrameClock")';
const fiberDir = path.join(process.cwd(), "node_modules", "@react-three", "fiber");

const replacements = [
  {
    file: "dist/events-21d8cd92.cjs.dev.js",
    from: "clock: new THREE__namespace.Clock(),",
    to: `clock: globalThis[${marker}] ? globalThis[${marker}]() : new THREE__namespace.Clock(),`,
  },
  {
    file: "dist/events-9ce18a08.esm.js",
    from: "clock: new THREE.Clock(),",
    to: `clock: globalThis[${marker}] ? globalThis[${marker}]() : new THREE.Clock(),`,
  },
  {
    file: "dist/events-a816cbab.cjs.prod.js",
    from: "clock: new THREE__namespace.Clock(),",
    to: `clock: globalThis[${marker}] ? globalThis[${marker}]() : new THREE__namespace.Clock(),`,
  },
];

if (!fs.existsSync(fiberDir)) {
  process.exit(0);
}

let failed = false;

for (const replacement of replacements) {
  const filePath = path.join(fiberDir, replacement.file);
  if (!fs.existsSync(filePath)) {
    console.error(`[fiber-patch] missing ${filePath}. @react-three/fiber must stay on 9.8.1.`);
    failed = true;
    continue;
  }

  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes(marker)) {
    continue;
  }

  const occurrences = source.split(replacement.from).length - 1;
  if (occurrences !== 1) {
    console.error(
      `[fiber-patch] expected one clock line in ${replacement.file}, found ${occurrences}.`,
    );
    failed = true;
    continue;
  }

  fs.writeFileSync(filePath, source.replace(replacement.from, replacement.to));
}

if (failed) {
  process.exit(1);
}
