import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const artifacts = resolve(import.meta.dirname, "..", "review-artifacts");
const vault = resolve(artifacts, "e2e-current-vault");
const skills = resolve(artifacts, "e2e-current-skills");
mkdirSync(artifacts, { recursive: true });
mkdirSync(resolve(artifacts, "phase5"), { recursive: true });
mkdirSync(resolve(artifacts, "phase6"), { recursive: true });
mkdirSync(resolve(artifacts, "phase10"), { recursive: true });
mkdirSync(resolve(artifacts, "phase11"), { recursive: true });
for (const name of ["e2e-current.db", "e2e-current.db-shm", "e2e-current.db-wal"]) rmSync(resolve(artifacts, name), { force: true });
rmSync(vault, { recursive: true, force: true });
rmSync(skills, { recursive: true, force: true });
mkdirSync(resolve(vault, "Projects"), { recursive: true });
cpSync(resolve(import.meta.dirname, "..", ".agents", "skills"), skills, { recursive: true });
writeFileSync(resolve(vault, "Projects", "客户A.md"), "---\ntitle: 客户A交付记录\ntags: [客户, 微信]\n---\n# 客户A交付记录\n微信小程序已经完成首轮验收。\n", "utf8");
console.log(JSON.stringify({ ok: true, database: resolve(artifacts, "e2e-current.db"), vault, skills }));
