import type Database from "better-sqlite3";

export interface Migration { version: number; name: string; up(database: Database.Database): void }

export const migrations: Migration[] = [
  {
    version: 1,
    name: "execution_core",
    up(database) {
      database.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          repository_path TEXT,
          obsidian_path TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE work_specs (
          id TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id),
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          instructions TEXT NOT NULL,
          executor_type TEXT NOT NULL,
          input_json TEXT NOT NULL,
          timeout_seconds INTEGER NOT NULL,
          max_attempts INTEGER NOT NULL,
          lifecycle_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX work_specs_project_idx ON work_specs(project_id);
        CREATE TABLE runs (
          id TEXT PRIMARY KEY,
          work_spec_id TEXT NOT NULL REFERENCES work_specs(id),
          project_id TEXT REFERENCES projects(id),
          executor_type TEXT NOT NULL,
          status TEXT NOT NULL,
          input_json TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          idempotency_key TEXT UNIQUE,
          retry_of_run_id TEXT REFERENCES runs(id),
          external_run_id TEXT,
          error_code TEXT,
          error_message TEXT,
          result_json TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT
        );
        CREATE INDEX runs_work_spec_idx ON runs(work_spec_id, created_at DESC);
        CREATE TABLE run_events (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          level TEXT NOT NULL,
          source TEXT NOT NULL,
          message TEXT NOT NULL,
          structured_data_json TEXT,
          sequence INTEGER NOT NULL,
          request_id TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(run_id, sequence)
        );
        CREATE INDEX run_events_run_idx ON run_events(run_id, sequence);
        CREATE TABLE schedules (
          id TEXT PRIMARY KEY,
          work_spec_id TEXT NOT NULL REFERENCES work_specs(id),
          name TEXT NOT NULL,
          cron_expression TEXT NOT NULL,
          timezone TEXT NOT NULL,
          enabled INTEGER NOT NULL,
          catch_up INTEGER NOT NULL,
          next_run_at TEXT NOT NULL,
          last_run_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE schedule_firings (
          idempotency_key TEXT PRIMARY KEY,
          schedule_id TEXT NOT NULL REFERENCES schedules(id),
          scheduled_for TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(schedule_id, scheduled_for)
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          actor_type TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          before_snapshot_json TEXT,
          after_snapshot_json TEXT,
          request_id TEXT,
          run_id TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX audit_resource_idx ON audit_logs(resource_type, resource_id, created_at);
        CREATE TABLE artifacts (
          id TEXT PRIMARY KEY,
          run_id TEXT REFERENCES runs(id),
          work_spec_id TEXT REFERENCES work_specs(id),
          project_id TEXT REFERENCES projects(id),
          storage_kind TEXT NOT NULL,
          name TEXT NOT NULL,
          uri TEXT NOT NULL,
          mime_type TEXT,
          size_bytes INTEGER,
          checksum TEXT,
          created_at TEXT NOT NULL
        );
      `);
    }
  },
  {
    version: 2,
    name: "knowledge",
    up(database) {
      database.exec(`
        CREATE TABLE knowledge_vaults (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          root_path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE knowledge_documents (
          id TEXT PRIMARY KEY,
          vault_id TEXT NOT NULL REFERENCES knowledge_vaults(id),
          relative_path TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          frontmatter_json TEXT NOT NULL,
          tags_json TEXT NOT NULL,
          modified_at TEXT NOT NULL,
          indexed_at TEXT NOT NULL,
          deleted_at TEXT,
          UNIQUE(vault_id, relative_path)
        );
        CREATE VIRTUAL TABLE knowledge_fts USING fts5(
          document_id UNINDEXED,
          title,
          body,
          tags,
          tokenize='unicode61'
        );
      `);
    }
  },
  {
    version: 3,
    name: "finance_and_imports",
    up(database) {
      database.exec(`
        CREATE TABLE finance_accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          account_type TEXT NOT NULL,
          currency TEXT NOT NULL,
          initial_balance_minor INTEGER NOT NULL,
          current_balance_minor INTEGER NOT NULL,
          institution TEXT,
          is_active INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE finance_transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES finance_accounts(id),
          transaction_type TEXT NOT NULL,
          amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
          currency TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          category TEXT,
          counterparty TEXT,
          description TEXT NOT NULL,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX finance_transactions_month_idx ON finance_transactions(currency, occurred_at, deleted_at);
        CREATE TABLE import_runs (
          id TEXT PRIMARY KEY,
          source_path TEXT NOT NULL,
          source_sha256 TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          table_counts_json TEXT NOT NULL,
          error_message TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT
        );
        CREATE TABLE import_entity_map (
          import_run_id TEXT NOT NULL REFERENCES import_runs(id),
          source_table TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_table TEXT NOT NULL,
          target_id TEXT NOT NULL,
          PRIMARY KEY(import_run_id, source_table, source_id)
        );
      `);
    }
  },
  {
    version: 4,
    name: "versioned_imports",
    up(database) {
      database.exec(`
        ALTER TABLE import_runs ADD COLUMN importer_version INTEGER NOT NULL DEFAULT 1;
      `);
    }
  },
  {
    version: 5,
    name: "runtime_governance",
    up(database) {
      database.exec(`
        ALTER TABLE runs ADD COLUMN usage_json TEXT;
        ALTER TABLE runs ADD COLUMN actual_cost_minor INTEGER;
        ALTER TABLE runs ADD COLUMN actual_cost_currency TEXT;
        ALTER TABLE runs ADD COLUMN cost_source TEXT;
        ALTER TABLE runs ADD COLUMN review_status TEXT NOT NULL DEFAULT 'not_required';
        ALTER TABLE runs ADD COLUMN reviewed_at TEXT;
        ALTER TABLE runs ADD COLUMN review_comment TEXT;

        UPDATE runs
        SET review_status = CASE
          WHEN status IN ('succeeded', 'partially_succeeded') THEN 'accepted'
          ELSE 'not_required'
        END;

        CREATE TABLE approvals (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          request_type TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          summary TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL,
          expires_at TEXT,
          requested_at TEXT NOT NULL,
          resolved_at TEXT,
          resolution_comment TEXT
        );
        CREATE INDEX approvals_run_idx ON approvals(run_id, requested_at DESC);
        CREATE UNIQUE INDEX approvals_pending_run_idx ON approvals(run_id) WHERE status = 'pending';
        DELETE FROM artifacts
        WHERE run_id IS NOT NULL AND rowid NOT IN (
          SELECT MIN(rowid) FROM artifacts WHERE run_id IS NOT NULL GROUP BY run_id, storage_kind, uri
        );
        CREATE UNIQUE INDEX artifacts_run_uri_idx ON artifacts(run_id, storage_kind, uri) WHERE run_id IS NOT NULL;

        CREATE TRIGGER audit_logs_append_only_update
        BEFORE UPDATE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'AUDIT_LOG_APPEND_ONLY');
        END;
        CREATE TRIGGER audit_logs_append_only_delete
        BEFORE DELETE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'AUDIT_LOG_APPEND_ONLY');
        END;
      `);
    }
  },
  {
    version: 6,
    name: "knowledge_links",
    up(database) {
      database.exec(`
        CREATE TABLE knowledge_links (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('project','work_spec','run','artifact')),
          entity_id TEXT NOT NULL,
          relation TEXT NOT NULL,
          source TEXT NOT NULL CHECK(source IN ('frontmatter','generated','manual')),
          created_at TEXT NOT NULL,
          UNIQUE(document_id, entity_type, entity_id, relation, source)
        );
        CREATE INDEX knowledge_links_document_idx ON knowledge_links(document_id, created_at);
        CREATE INDEX knowledge_links_entity_idx ON knowledge_links(entity_type, entity_id, created_at);
      `);
    }
  },
  {
    version: 7,
    name: "complete_finance",
    up(database) {
      database.exec(`
        CREATE TABLE finance_categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL CHECK(kind IN ('income','expense','both')),
          is_active INTEGER NOT NULL CHECK(is_active IN (0,1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        ALTER TABLE finance_transactions ADD COLUMN category_id TEXT REFERENCES finance_categories(id);
        ALTER TABLE finance_transactions ADD COLUMN balance_effect_minor INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE finance_transactions ADD COLUMN reporting_type TEXT NOT NULL DEFAULT 'income' CHECK(reporting_type IN ('income','expense','transfer','adjustment'));
        ALTER TABLE finance_transactions ADD COLUMN reporting_effect_minor INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE finance_transactions ADD COLUMN parent_transaction_id TEXT REFERENCES finance_transactions(id);
        ALTER TABLE finance_transactions ADD COLUMN transfer_id TEXT;
        ALTER TABLE finance_transactions ADD COLUMN reversal_of_transaction_id TEXT REFERENCES finance_transactions(id);

        UPDATE finance_transactions SET
          balance_effect_minor = CASE WHEN transaction_type='expense' THEN -amount_minor ELSE amount_minor END,
          reporting_type = CASE WHEN transaction_type='expense' THEN 'expense' WHEN transaction_type='adjustment' THEN 'adjustment' ELSE 'income' END,
          reporting_effect_minor = amount_minor;

        CREATE INDEX finance_transactions_parent_idx ON finance_transactions(parent_transaction_id, deleted_at);
        CREATE INDEX finance_transactions_transfer_idx ON finance_transactions(transfer_id);
        CREATE UNIQUE INDEX finance_transactions_reversal_idx ON finance_transactions(reversal_of_transaction_id) WHERE reversal_of_transaction_id IS NOT NULL;

        CREATE TABLE finance_budgets (
          id TEXT PRIMARY KEY,
          month TEXT NOT NULL,
          currency TEXT NOT NULL,
          category_id TEXT NOT NULL REFERENCES finance_categories(id),
          planned_minor INTEGER NOT NULL CHECK(planned_minor >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(month, currency, category_id)
        );

        CREATE TABLE finance_calculations (
          id TEXT PRIMARY KEY,
          calculation_type TEXT NOT NULL CHECK(calculation_type IN ('budget_variance','cashflow_forecast','currency_conversion')),
          formula_version TEXT NOT NULL,
          input_snapshot_json TEXT NOT NULL,
          assumptions_json TEXT NOT NULL,
          result_json TEXT NOT NULL,
          currency TEXT NOT NULL,
          period_start TEXT,
          period_end TEXT,
          created_by TEXT NOT NULL CHECK(created_by IN ('user','runtime','system')),
          created_at TEXT NOT NULL
        );

        CREATE TABLE operating_units (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          unit_type TEXT NOT NULL CHECK(unit_type IN ('project','radar','product','custom')),
          reference_id TEXT,
          currency TEXT NOT NULL,
          is_active INTEGER NOT NULL CHECK(is_active IN (0,1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(unit_type, reference_id)
        );

        CREATE TABLE finance_allocations (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL REFERENCES finance_transactions(id),
          operating_unit_id TEXT NOT NULL REFERENCES operating_units(id),
          amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
          currency TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(transaction_id, operating_unit_id)
        );

        CREATE TABLE operating_entries (
          id TEXT PRIMARY KEY,
          operating_unit_id TEXT NOT NULL REFERENCES operating_units(id),
          entry_type TEXT NOT NULL CHECK(entry_type IN ('expected_income','committed_cost','time')),
          amount_minor INTEGER,
          currency TEXT,
          minutes INTEGER,
          description TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          CHECK(
            (entry_type='time' AND minutes > 0 AND amount_minor IS NULL AND currency IS NULL)
            OR
            (entry_type IN ('expected_income','committed_cost') AND amount_minor > 0 AND currency IS NOT NULL AND minutes IS NULL)
          )
        );

        CREATE TABLE finance_change_proposals (
          id TEXT PRIMARY KEY,
          target_transaction_id TEXT NOT NULL REFERENCES finance_transactions(id),
          proposal_type TEXT NOT NULL CHECK(proposal_type IN ('update','delete','reverse')),
          proposed_changes_json TEXT NOT NULL,
          rationale TEXT NOT NULL,
          requested_by TEXT NOT NULL CHECK(requested_by IN ('user','runtime')),
          status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
          result_transaction_ids_json TEXT NOT NULL DEFAULT '[]',
          resolved_at TEXT,
          resolution_comment TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX finance_change_proposals_status_idx ON finance_change_proposals(status, created_at DESC);

        CREATE TRIGGER finance_allocations_guard_insert
        BEFORE INSERT ON finance_allocations
        BEGIN
          SELECT CASE WHEN NOT EXISTS (
            SELECT 1 FROM finance_transactions transaction_row
            JOIN operating_units unit_row ON unit_row.id=NEW.operating_unit_id
            WHERE transaction_row.id=NEW.transaction_id
              AND transaction_row.deleted_at IS NULL
              AND transaction_row.currency=NEW.currency
              AND unit_row.currency=NEW.currency
          ) THEN RAISE(ABORT, 'ALLOCATION_CONTEXT_INVALID') END;
          SELECT CASE WHEN (
            SELECT COALESCE(SUM(amount_minor),0) FROM finance_allocations WHERE transaction_id=NEW.transaction_id
          ) + NEW.amount_minor > (
            SELECT amount_minor FROM finance_transactions WHERE id=NEW.transaction_id
          ) THEN RAISE(ABORT, 'ALLOCATION_EXCEEDS_TRANSACTION') END;
        END;
      `);
    }
  },
  {
    version: 8,
    name: "lossless_legacy_archive",
    up(database) {
      database.exec(`
        CREATE TABLE legacy_records (
          id TEXT PRIMARY KEY,
          import_run_id TEXT NOT NULL REFERENCES import_runs(id),
          source_table TEXT NOT NULL,
          source_id TEXT NOT NULL,
          title TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          payload_sha256 TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(source_table, source_id, payload_sha256)
        );
        CREATE INDEX legacy_records_source_idx ON legacy_records(source_table, source_id, created_at);

        CREATE TRIGGER legacy_records_append_only_update
        BEFORE UPDATE ON legacy_records
        BEGIN
          SELECT RAISE(ABORT, 'LEGACY_RECORD_APPEND_ONLY');
        END;
        CREATE TRIGGER legacy_records_append_only_delete
        BEFORE DELETE ON legacy_records
        BEGIN
          SELECT RAISE(ABORT, 'LEGACY_RECORD_APPEND_ONLY');
        END;
      `);
    }
  },
  {
    version: 9,
    name: "work_spec_skill_snapshot",
    up(database) {
      database.exec(`
        ALTER TABLE work_specs ADD COLUMN skill_json TEXT;
      `);
    }
  }
];

export function applyMigrations(database: Database.Database, pending: Migration[] = migrations): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set((database.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map((row) => row.version));
  for (const migration of [...pending].sort((left, right) => left.version - right.version)) {
    if (applied.has(migration.version)) continue;
    database.transaction(() => {
      migration.up(database);
      database.prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)").run(migration.version, migration.name, new Date().toISOString());
    })();
  }
}
