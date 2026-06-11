# Phase 8A: Creative Task Orchestrator

- Added `server/src/creative-task-orchestrator-service.mjs` with six normalized creative task types.
- Added persisted task bundles under `data/outputs/creative_tasks/<task_id>/`.
- Added append-only task run records at `data/outputs/logs/creative_task_runs.jsonl`.
- Added `server/src/mcp-creative-task-tools.mjs` and wired its three tools into the MCP registry.
- Generation and proofing tasks prepare local context only; Phase 8A does not call OpenAI or another LLM API.
- Adoption and engine activation tasks create approval queue requests only.
- Settlement tasks create settlement context only; they do not activate or modify `active_engine.md`.
- Creative task metadata explicitly denies activate, approve, rollback, cleanup execution, canon update, and active-engine modification capabilities.
- Added isolated orchestrator and MCP tests, including active-engine hash checks and fixture cleanup.

Verification:

```text
npm.cmd test
Get-FileHash .\data\canon_db\active_engine.md -Algorithm SHA256
git status --short --untracked-files=no
```
