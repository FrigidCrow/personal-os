import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = resolve(projectRoot, process.env.DATABASE_PATH ?? "data/personal-os.db");
const approvalDays = Math.max(1, Number(process.env.APPROVAL_PREVIEW_RETENTION_DAYS ?? 30));
const promptDays = Math.max(1, Number(process.env.RUN_PROMPT_RETENTION_DAYS ?? 90));
const apply = process.argv.includes("--apply");
const approvalCutoff = new Date(Date.now() - approvalDays * 86_400_000).toISOString();
const promptCutoff = new Date(Date.now() - promptDays * 86_400_000).toISOString();
const database = new Database(databasePath, { fileMustExist: true });

try {
  const approvalCount = database.prepare(`
    SELECT COUNT(*) AS count FROM approval_requests
    WHERE status != 'pending' AND resolved_at < ? AND payload_preview IS NOT NULL
      AND payload_preview != '[redacted after retention]'
  `).get(approvalCutoff).count;
  const promptCount = database.prepare(`
    SELECT COUNT(*) AS count FROM agent_runs
    WHERE status IN ('done', 'blocked', 'failed', 'cancelled') AND completed_at < ?
      AND prompt_snapshot != '[redacted after retention]'
  `).get(promptCutoff).count;

  if (apply) {
    database.transaction(() => {
      database.prepare(`
        UPDATE approval_requests SET payload_preview = '[redacted after retention]'
        WHERE status != 'pending' AND resolved_at < ? AND payload_preview IS NOT NULL
      `).run(approvalCutoff);
      database.prepare(`
        UPDATE agent_runs SET prompt_snapshot = '[redacted after retention]'
        WHERE status IN ('done', 'blocked', 'failed', 'cancelled') AND completed_at < ?
      `).run(promptCutoff);
    })();
  }

  console.log(JSON.stringify({ apply, databasePath, approvalCutoff, promptCutoff, approvalPreviews: approvalCount, runPrompts: promptCount }));
} finally {
  database.close();
}
