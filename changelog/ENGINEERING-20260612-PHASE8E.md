# Phase 8E: Writing Candidate Adoption Request

- Added `server/src/candidate-adoption-request-service.mjs`.
- Added validation for candidate-only state, proof-report ownership, proof requirements, and request risk.
- Adoption requests use the explicit `adopt_writing_candidate` approval action.
- P0 or blocked proof reports create blocked approval items instead of normal pending requests.
- Missing proof reports block requests unless `allow_without_proof` is explicitly enabled.
- Proof exceptions are raised to high risk and include a warning.
- Dry-run validates the request without creating an approval item or changing candidate metadata.
- Candidate metadata records adoption-request history while preserving `candidate_only`, `adopted: false`, and `settled: false`.
- Approval items include candidate and proof hashes, paths, verdict, severity, reason, confirmation requirements, and request-only safety metadata.
- The existing `request_adopt_writing_candidate` creative task now routes chat-output writing candidates through the Phase 8E service.
- Added three MCP tools to request, read, and list writing candidate adoption requests.
- MCP metadata declares approval-item creation while denying direct adoption, settlement, activation, rollback, cleanup, local generation, and approval execution.
- Existing approval queue and UI listing paths can display the request.
- Phase 8E does not implement the confirmed adoption execution path; direct confirmation is rejected as unsupported.
- No adopted chapter, settlement context, settlement report, pending engine candidate, or active-engine update is created.
- No OpenAI, external LLM, or local generation API was added.
- Added isolated service, approval queue, orchestrator, MCP, hash, side-effect, and fixture-cleanup tests.

Verification:

```text
npm.cmd test
Get-FileHash .\data\canon_db\active_engine.md -Algorithm SHA256
git status --short
git status --short --untracked-files=no
```
