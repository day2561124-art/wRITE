# Engineering Completion - 2026-06-07

## MCP transport and contracts

- Added centralized schema validation, default application, normalization metadata, size limits, integer maxima, cross-field guards, and confirmation guards.
- Added strict `Content-Length` parsing, 16 MiB message limits, 8 KiB header limits, EOF truncation reporting, bounded dispatch queues, bounded stdout response queues, and backpressure-aware EOF finalization.
- Expanded the MCP smoke suite across schemas, audits, framing, malformed input, overload, backpressure, EOF ordering, protected hashes, and forbidden paths.

## Tool integrity

- Removed the obsolete `activate_engine_version.mjs` bypass that could overwrite `active_engine.md` outside the formal activation contract.
- Removed the obsolete `build-generation-context.mjs` path and its root-level `outputs/` artifacts.
- Removed the duplicated legacy implementation from `save-draft.mjs`.
- Added a real `save_draft` dry-run execution fixture.
- Added a locked 16-script tool inventory and `node --check` coverage to the MCP smoke suite.
- Added consistent `--help` and unknown-argument handling to the remaining standalone CLIs.

## Source trust and permissions

- Added a centralized 15-source trust catalog with the complete provenance metadata required by `policies/source_trust.md`.
- Integrated trust level, Canon status, Canon eligibility, and confirmation state into retrieval output and generated source manifests.
- Added a CI source-trust checker; formal sources pass, while the proofing, longline, and compressed-rule placeholders are explicitly downgraded to T8 warnings.
- Exposed the complete permission contract for every MCP tool through `tools/list` metadata.
- Added smoke assertions for permission level, read/write scope, confirmation, backup, Canon mutation, error-report commit, and audit requirements across all 17 tools.

## Tests and CI

- Replaced placeholder golden fixtures with executable Canon and governance assertions.
- Added `tests/golden/canon-golden.test.mjs`.
- Added `tests/tools/mcp-contract.test.mjs`.
- Added `tests/run-all.mjs` with bounded subprocess timeouts.
- Updated GitHub Actions to run the complete suite.
- Made MCP contract tests restore `mcp_tool_audit.jsonl` byte-for-byte after validating temporary audit records.
- Added source-trust validation to the complete test runner and Canon trust evidence to golden retrieval fixtures.

## Remaining external inputs

- A formal proofing policy mother file is still required before replacing the current proofing placeholder.
- The user-provided national representative arc image was transcribed and formally imported as Longline DB v1.0; the source image, transcription, active file, and version copy are retained.
- The user supplied the obscured fragment directly; Longline DB v1.1 now records the complete objective as holding the competition, protecting others, and achieving the on-field objective.
- Longline DB v1.0 remains preserved as the pre-supplement transcription history.
- The compressed-rule placeholder is not an external-file blocker: it remains T8 until formal error reports exist, and must not be populated by inference.
