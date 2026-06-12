# Phase 8H: Pending Engine Candidate Review

## Purpose

- Build review bundles for pending engine candidates.
- Compare the current active engine with the proposed candidate.
- Save a user-readable review and diff.
- Create an `activate_engine_candidate` approval request only after explicit user action.

## Safety

- Phase 8H does not directly activate an engine candidate.
- Phase 8H does not modify `active_engine.md`.
- Phase 8H does not approve approval items.
- Activation still requires approval queue or UI confirmation.
- Review creation does not automatically create an activation request.
- No active engine snapshot, archive, or activation log is created by review or request.
- No OpenAI API or external LLM API was added.

## Interfaces

- Added `pending-engine-candidate-review-service.mjs`.
- Added MCP pending engine candidate review tools.
- Added creative task types for review creation and activation request creation.
- Existing `request_engine_activation` now uses the same guarded Phase 8H request service.

## Tests

- `tests/engine/pending-engine-candidate-review-service.test.mjs`
- `tests/engine/pending-engine-candidate-review-e2e.test.mjs`
- `tests/mcp/mcp-pending-engine-candidate-review-tools.test.mjs`

## Verification

- `npm.cmd test`: All tests passed
- `active_engine.md` SHA256: `d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb`
