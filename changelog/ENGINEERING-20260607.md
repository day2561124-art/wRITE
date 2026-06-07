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
- Added a locked 15-script tool inventory and `node --check` coverage to the MCP smoke suite.
- Added consistent `--help` and unknown-argument handling to the remaining standalone CLIs.

## Tests and CI

- Replaced placeholder golden fixtures with executable Canon and governance assertions.
- Added `tests/golden/canon-golden.test.mjs`.
- Added `tests/tools/mcp-contract.test.mjs`.
- Added `tests/run-all.mjs` with bounded subprocess timeouts.
- Updated GitHub Actions to run the complete suite.

## Remaining external inputs

- A formal proofing policy mother file is still required before replacing the current proofing placeholder.
- A formal longline mother file is still required before replacing the current longline placeholder.
