import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "src/app/api");
const holdDir = path.join(root, "src/app/_api_hold");

function recoverHeldApi() {
  if (!fs.existsSync(apiDir) && fs.existsSync(holdDir)) {
    fs.renameSync(holdDir, apiDir);
  }
}

function hideApi() {
  recoverHeldApi();
  if (!fs.existsSync(apiDir)) {
    return false;
  }
  if (fs.existsSync(holdDir)) {
    fs.rmSync(holdDir, { recursive: true, force: true });
  }
  fs.renameSync(apiDir, holdDir);
  return true;
}

function restoreApi() {
  if (!fs.existsSync(holdDir)) {
    return;
  }
  if (fs.existsSync(apiDir)) {
    fs.rmSync(apiDir, { recursive: true, force: true });
  }
  fs.renameSync(holdDir, apiDir);
}

const hidden = hideApi();
let exitCode = 1;

try {
  const nextBin = path.join(root, "node_modules", ".bin", "next");
  const build = spawnSync(nextBin, ["build", "--webpack"], {
    stdio: "inherit",
    env: {
      ...process.env,
      GH_PAGES: "1",
      NEXT_PUBLIC_SITE_URL:
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://jiaxiantao.github.io/3d-car-viewing",
    },
  });
  exitCode = build.status ?? 1;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  const prepare = spawnSync(process.execPath, ["scripts/prepare-gh-pages-export.mjs"], {
    stdio: "inherit",
  });
  exitCode = prepare.status ?? 1;
} finally {
  if (hidden) {
    restoreApi();
  }
}

process.exit(exitCode);
