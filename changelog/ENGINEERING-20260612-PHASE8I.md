# Phase 8I: Engine Activation Confirm E2E

## Purpose

- Make approval queue confirmation the sole application entry for pending engine activation.
- Preserve snapshot, archive, candidate metadata, approval result, and activation log trace.
- Keep rollback available and approval-gated.

## Safety

- MCP and creative task services still create approval requests only.
- Activation rejects calls without confirmed approval item context.
- The active engine base hash is rechecked immediately before activation.
- Snapshot, archive, active engine, activation log, candidate metadata, status, and rollback index use one file transaction.
- No OpenAI API or external LLM API was added.
- Visual assets were not modified.

## Interfaces

- Added `engine-activation-confirm-service.mjs`.
- Approval queue activation confirmation now calls the Phase 8I service.
- Activation results include approval, candidate, settlement, adopted writing, hash, snapshot, and rollback trace.

## Tests

- `tests/engine/engine-activation-confirm-service.test.mjs`
- `tests/engine/engine-activation-confirm-e2e.test.mjs`
- Strengthened approval queue and MCP approval-request E2E coverage.

## Verification

- `npm.cmd test`: All tests passed before the final direct-UI-entry removal.
- Production `active_engine.md` SHA256:
  `D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB`
