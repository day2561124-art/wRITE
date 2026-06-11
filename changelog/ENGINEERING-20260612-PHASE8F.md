# Phase 8F: Writing Candidate Adoption Confirm E2E

- Added `server/src/writing-candidate-adoption-service.mjs`.
- Confirmed adoption writes an exact candidate-content copy to `data/outputs/adopted_writings/<adopted_chapter_id>/chapter.md`.
- Adoption metadata is stored in `adoption.json` with candidate, proof, approval, user-confirmation, hash, and safety trace fields.
- Candidate metadata transitions to `canon_status: adopted_chapter` and `adopted: true` while remaining `settled: false`.
- Candidate metadata records the adopted chapter, approval item, adoption time, and confirmed request status.
- Added an internal approval-confirmation gate so direct service callers cannot execute adoption.
- Wired `adopt_writing_candidate` into the existing approval queue confirmation dispatch.
- Successful confirmation resolves the approval item and persists its adopted chapter execution result.
- Existing UI approval confirmation routes now execute writing-candidate adoption and return the adopted chapter result without a new route.
- Added read-only MCP tools to read and list adopted writing records.
- No MCP or creative task tool can confirm or directly execute adoption.
- Creative task `request_adopt_writing_candidate` remains request-only.
- Adoption does not create a settlement context, settlement report, pending engine candidate, engine activation request, snapshot, or activation log.
- Adoption does not modify or activate `active_engine.md`.
- No OpenAI, external LLM, or local generation API was added.
- Added isolated adoption service, approval-confirm E2E, approval queue, read-only MCP, hash, side-effect, and fixture-cleanup tests.

Verification:

```text
npm.cmd test
Get-FileHash .\data\canon_db\active_engine.md -Algorithm SHA256
git status --short
git status --short --untracked-files=no
```
