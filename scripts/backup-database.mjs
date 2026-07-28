import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, process.env.DATABASE_PATH ?? "data/personal-os.db");
const destinationDirectory = resolve(projectRoot, process.env.PERSONAL_OS_BACKUP_DIR ?? "backups");
const keep = Math.max(1, Number(process.env.PERSONAL_OS_BACKUP_KEEP ?? 14));
const dryRun = process.argv.includes("--dry-run");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = join(destinationDirectory, `personal-os-${timestamp}.db`);

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, source, destination, keep }));
  process.exit(0);
}

mkdirSync(destinationDirectory, { recursive: true });
const database = new Database(source, { readonly: true, fileMustExist: true });
try {
  const quickCheck = database.pragma("quick_check", { simple: true });
  if (quickCheck !== "ok") throw new Error(`Source database quick_check failed: ${quickCheck}`);
  await database.backup(destination);
} finally {
  database.close();
}

const backups = readdirSync(destinationDirectory)
  .filter((name) => /^personal-os-.*\.db$/.test(name))
  .map((name) => ({ name, path: join(destinationDirectory, name), mtime: statSync(join(destinationDirectory, name)).mtimeMs }))
  .sort((left, right) => right.mtime - left.mtime);
for (const backup of backups.slice(keep)) rmSync(backup.path);

console.log(JSON.stringify({ ok: true, source, destination, retained: Math.min(backups.length, keep) }));
