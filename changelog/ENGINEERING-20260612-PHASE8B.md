# Phase 8B: GPT Writing Context Bundle

- Added `server/src/gpt-writing-context-service.mjs`.
- Added GPT-facing bundles under `data/outputs/gpt_writing_contexts/<bundle_id>/`.
- Each bundle persists `context_bundle.json` and `context_for_chat.md`.
- Bundles include selected canon/policy source hashes, task prompt, generation context, retrieval context, and explicit chat output rules.
- Added configurable context budgeting with a default of 120,000 characters and a maximum of 250,000.
- Updated `generate_writing_candidate` to create a GPT writing context bundle and direct ChatGPT/GPT to answer in chat.
- Generation still does not call OpenAI, another LLM API, or a local generation adapter.
- Generation does not create candidate drafts, proof reports, settlement reports, engine candidates, or approval items.
- Added MCP tools to build, read, and list GPT writing context bundles.
- All Phase 8B metadata denies local generation, active-engine modification, activation, approval, rollback, and cleanup execution.
- Added isolated service, orchestrator integration, MCP, active-engine hash, and fixture cleanup tests.

Verification:

```text
npm.cmd test
Get-FileHash .\data\canon_db\active_engine.md -Algorithm SHA256
git status --short --untracked-files=no
```
