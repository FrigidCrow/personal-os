import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeBase = resolve(process.env.PERSONAL_OS_RUNTIME_BASE ?? join(homedir(), ".local", "share", "personal-os-v2", "runtime"));
const current = join(runtimeBase, "current");
const staging = join(runtimeBase, `.staging-${process.pid}`);
const previous = join(runtimeBase, `previous-${new Date().toISOString().replaceAll(":", "-")}`);
const dependencies = [
  "@hono/node-server",
  "@openai/codex-sdk",
  "@openai/codex",
  "@openai/codex-darwin-arm64",
  "better-sqlite3",
  "cron-parser",
  "luxon",
  "hono",
  "zod",
  "node-addon-api"
];

const requiredBuilds = [
  "apps/api-v2/dist/index.js",
  "apps/mcp-v2/dist/index.js",
  "apps/web-v2/dist/index.html"
];
const missingBuilds = requiredBuilds.filter((path) => !existsSync(join(projectRoot, path)));
if (missingBuilds.length > 0) throw new Error(`Build output is incomplete. Run npm run build first. Missing: ${missingBuilds.join(", ")}`);
if (!runtimeBase.startsWith(join(homedir(), ".local", "share") + "/")) throw new Error("Runtime base must stay under ~/.local/share.");

mkdirSync(runtimeBase, { recursive: true });
rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, "node_modules"), { recursive: true });

try {
  copy("apps/api-v2/dist", "api-v2");
  copy("apps/mcp-v2/dist/index.js", "personal-os-mcp.mjs");
  copy("apps/web-v2/dist", "web-v2");
  copy(".agents/skills", ".agents/skills");
  copy("scripts/personal-os-static-server.mjs", "personal-os-static-server.mjs");
  copy("scripts/static-server-core.mjs", "static-server-core.mjs");
  for (const dependency of dependencies) copy(join("node_modules", dependency), join("node_modules", dependency));
  writeFileSync(join(staging, "package.json"), `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`, { mode: 0o600 });
  const manifest = {
    deployedAt: new Date().toISOString(),
    projectRoot,
    gitHead: process.env.PERSONAL_OS_GIT_HEAD ?? "working-tree",
    files: requiredBuilds.map((path) => ({ path, sizeBytes: statSync(join(projectRoot, path)).size, sha256: sha256(join(projectRoot, path)) })),
    dependencies
  };
  writeFileSync(join(staging, "runtime-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  let movedCurrent = false;
  if (existsSync(current)) { renameSync(current, previous); movedCurrent = true; }
  try { renameSync(staging, current); }
  catch (error) {
    if (movedCurrent && !existsSync(current)) renameSync(previous, current);
    throw error;
  }
  // The atomic swap uses the former runtime only as an in-process rollback point.
  // Phase 8 established a single-runtime authority, so do not retain old generations.
  if (movedCurrent) rmSync(previous, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: true, current, previous: null, manifest }, null, 2));
} catch (error) {
  rmSync(staging, { recursive: true, force: true });
  throw error;
}

function copy(source, target) {
  const sourcePath = join(projectRoot, source);
  if (!existsSync(sourcePath)) throw new Error(`Missing runtime dependency: ${source}`);
  const targetPath = join(staging, target);
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true, dereference: true, preserveTimestamps: true });
}

function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
