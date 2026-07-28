# MVP1.1 Acceptance Matrix

Reviewed: 2026-07-28

Result: 9 Passed, 0 Failed, 0 Pending

| ID | Requirement | Review evidence | Status |
|---|---|---|---|
| B01 | Task detail supports confirmed deletion | Browser created `MVP1.1 删除验收临时任务`, opened its detail, required the destructive confirmation, deleted it, displayed `任务已删除`, and verified the card count returned to zero; the API regression test also verifies task deletion persistence. | Passed |
| B02 | Experiment detail is readable and editable | Browser opened `AI 编码仓库接入审计`, edited and saved its title, observed `实验详情已保存`, then restored the original title and fields. | Passed |
| B03 | Experiment result and terminal status can be recorded | API test covers edit plus result recording; browser recorded a measured result, observed persisted result copy and success feedback, then restored the original `hypothesis` state and empty result. | Passed |
| B04 | Project cards navigate to a real project detail route | Browser followed `查看详情` to `/projects/13b3b22f-bb1b-42b9-b280-18ea6802937a`; route heading and active project navigation rendered correctly. | Passed |
| B05 | Project detail shows metadata and associated tasks | Browser rendered outcome, next action, revenue, deadline, Git path, Obsidian path, and the linked project task; API integration test verifies associated task hydration. | Passed |
| B06 | Successful mutations use one accessible global feedback pattern | Shared polite live-region toast is wired to project, task, radar, experiment, assignment, transition, and approval mutations; browser directly verified create, delete, edit, and result messages. | Passed |
| B07 | Codex run detail exposes complete persisted audit context | Browser opened a Live Codex record and rendered run id, thread id, project, working directory, start/end timestamps, prompt snapshot, result, verification, artifacts, and four persisted events. | Passed |
| B08 | Active Codex run detail consumes the SSE stream and handles reconnect or terminal completion | API integration opens the stream while the demo run is active and observes both `running` and `needs_review`; Web uses `EventSource`, updates run/event caches, reports reconnecting state, and closes on terminal status. Browser rendered the resulting terminal timeline. | Passed |
| B09 | Automated gates and responsive theme review pass | Final review passed 5 test files / 26 tests, typecheck, ESLint, production build, dependency audit, and diff hygiene. Browser found no console errors; 390px detail/dialog checks had no horizontal overflow, and light/dark/system states rendered correctly. | Passed |
