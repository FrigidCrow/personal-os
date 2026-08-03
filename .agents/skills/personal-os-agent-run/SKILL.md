---
name: personal-os-agent-run
description: Execute a governed Personal OS Run through its MCP tools. Use when a Codex or OpenWorker task must report progress, register repository artifacts, request approval, search indexed knowledge, and submit a structured result without direct database access.
metadata:
  version: "1.0.0"
---

# Personal OS Agent Run

## Protocol

1. Call `get_run_context` before material work. Treat the returned WorkSpec, project and input as the only authorized scope.
2. Call `append_run_event` at meaningful milestones, including verification and a genuine blocker. Do not emit invented progress.
3. Use `search_knowledge` only when indexed Personal OS knowledge is needed. Do not treat search snippets as external evidence.
4. Create files only inside the assigned repository. After verifying a file exists, call `save_artifact` with its repository-relative path.
5. Before payment, purchase, outreach, publication, user-file deletion, production deployment, credential access or a new writable directory, call `request_approval` and stop the turn. Never simulate approval.
6. Finish by calling `submit_run_result` with a Chinese summary, structured facts and the exact checks performed. A prose answer alone is not a submitted result.

## Capability handling

When `PERSONAL_OS_RUN_CAPABILITY` is available to the MCP process, tools authenticate automatically. When the runtime prompt provides a capability token, pass it only in the `capabilityToken` tool field. Never print, save, quote or place the token in another field.

## Completion rule

A task is complete only when its acceptance conditions have direct evidence. If the target cannot be achieved, report the concrete blocker and the next safe action; do not label a single failed attempt as success.
