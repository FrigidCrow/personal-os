# Personal OS Repository Guidance

## Delivery protocol

Every milestone follows Plan -> Work -> Review.

- Plan: update `docs/PLAN.md` and acceptance criteria before implementation.
- Work: record meaningful implementation decisions and verification commands in `WORKLOG.md`.
- Review: audit every acceptance row and record direct evidence in `REVIEW.md`.
- Do not declare a milestone complete while an acceptance row is Pending, Failed, or supported only by indirect evidence.

## Product boundaries

- Keep the product local-first and single-user for MVP1.
- SQLite is the authority for structured state.
- Obsidian and Git content is linked, not copied into the database.
- Clearly label seed data and demo Codex runs.
- Do not expose automatic payment, purchase, outreach, publishing, or production-deployment tools.

## Codex integration

- Web-to-Codex uses the API v2 server-side Codex SDK adapter.
- Codex and OpenWorker call the native v2 Personal OS MCP gateway with a short-lived per-Run capability; never restore the retired v1 MCP server or direct database tools.
- Skill-bound Agent Runs must submit a structured MCP result before they can succeed.
- Every run must retain project id, task id, working directory, thread id when available, result, and verification summary.
- Live and demo adapters must implement the same interface. Never present demo output as a live Codex result.

## Frontend

- Follow the design contract in `docs/PLAN.md`.
- Use Radix Themes and Phosphor Icons. Do not introduce a second design system or icon family.
- Support light, dark, and system themes.
- Provide explicit mobile layouts and loading, empty, error, and success states.
- Use the `design-taste-frontend` pre-flight rules relevant to product UI before review.
- Avoid decorative em dashes in visible UI copy.

## Engineering

- TypeScript strict mode is required.
- Validate all external input at the API and MCP boundaries.
- Domain state transitions belong in `packages/vnext-domain` and orchestration in `packages/vnext-application`, not individual UI components.
- Database access belongs in `packages/vnext-infrastructure`, not route handlers or React components.
- Run test, typecheck, lint, and build before review.
- Preserve user data when changing migrations. Development reset helpers must target only an explicit project database path.
