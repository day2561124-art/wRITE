# Phase 8C: Chat Output Candidate Intake

- Added `server/src/chat-output-candidate-service.mjs`.
- Added candidate-only artifacts under `data/outputs/writing_candidates/<candidate_id>/`.
- Candidate records persist the pasted chat output, SHA-256 hash, source, title, chapter label, task prompt, notes, and immutable Phase 8B bundle trace metadata.
- Missing `source_bundle_id` is allowed with an explicit traceability warning; an invalid supplied bundle id is rejected.
- Candidate metadata explicitly sets `candidate_only`, `adopted: false`, `settled: false`, `proofed: false`, and denies canon or active-engine updates.
- Dry-run computes validation and hash results without creating a candidate directory.
- Added the `save_chat_output_candidate` creative task and directs the next action toward proofing.
- Added MCP tools to save, read, and list chat-output writing candidates.
- Detail reads omit content by default and enforce a bounded content preview when requested.
- List reads return summaries only and support bundle/canon-status filters.
- No OpenAI, LLM, or local generation adapter was added.
- No proof report, settlement context/report, pending engine candidate, approval item, adoption, or active-engine update is created.
- Added isolated service, orchestrator, MCP, hash, side-effect, and fixture cleanup tests.

Verification:

```text
npm.cmd test
Get-FileHash .\data\canon_db\active_engine.md -Algorithm SHA256
git status --short --untracked-files=no
```
