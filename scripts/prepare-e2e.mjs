import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(projectRoot, "review-artifacts");
mkdirSync(artifacts, { recursive: true });
for (const name of ["e2e.db", "e2e.db-shm", "e2e.db-wal"]) {
  rmSync(resolve(artifacts, name), { force: true });
}
