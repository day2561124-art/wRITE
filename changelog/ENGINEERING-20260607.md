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
- Added a CI source-trust checker; placeholders are explicitly downgraded to T8 until a formal source is imported.
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

## Local user interface

- Added a dependency-free local web workspace with overview, compose, review, library, and activity views.
- Added a localhost-only Node server that exposes allowlisted project reads and exact tool actions without shell interpolation.
- Added dry-run defaults and explicit confirmation before draft, proof-report, or feedback writes.
- Added responsive desktop and mobile layouts, synchronized hash routing, and a one-command Windows launcher.
- Added UI server contract tests for static delivery, source state, allowlisted reads, traversal rejection, action validation, and side-effect-free draft dry-runs.

## Final data status

- The user-provided formal proofing card was imported as Proofing Policy DB v1.1; its source, active file, and version copy are retained and golden-tested for equality.
- The user-provided national representative arc image was transcribed and formally imported as Longline DB v1.0; the source image, transcription, active file, and version copy are retained.
- The user supplied the obscured fragment directly; Longline DB v1.1 now records the complete objective as holding the competition, protecting others, and achieving the on-field objective.
- Longline DB v1.0 remains preserved as the pre-supplement transcription history.
- The compressed-rule placeholder is not an external-file blocker: it remains T8 until formal error reports exist, and must not be populated by inference.
- No external formal mother-file blockers remain.

## Reliability and security hardening

- Added a centralized project path policy that rejects traversal, symbolic-link escape, Canon overwrite attempts, and generated outputs outside `data/outputs/`.
- Added project-wide file transactions with locking, staging, rollback, and transaction manifests.
- Changed the generation pipeline to build in an isolated run directory and publish all four outputs atomically only after every stage succeeds.
- Added MCP audit intents so interrupted non-read calls remain diagnosable, while completed calls commit the audit and clear the intent together.
- Added strict JSONL schemas for draft, proof, settlement, and MCP audit indexes.

## Retrieval and maintainability

- Replaced duplicated source lists with one 15-source registry shared by prompt building, retrieval, trust checks, MCP resources, and the UI.
- Upgraded retrieval ranking with exact matching, Chinese n-grams, BM25, source authority, and trust-aware penalties.
- Added streaming JSONL counts in the UI, duplicate-submit protection, and shared Windows process-tree cleanup.
- Added standard `npm` scripts and a cross-platform GitHub Actions matrix for Ubuntu and Windows.
- Added security, rollback, atomic-pipeline, and source-registry contract tests.

## Visual reference library

- Added `data/visual_db/` for character designs, outfits, armed-form appearances, ability visuals, expressions, and scene references.
- Added `visual_index.jsonl` with strict validation, image path allowlisting, trust levels, and Canon status boundaries.
- Added a Minimal Tech visual gallery view in the local UI with character/category/status filters and metadata details.
- Added a locked `/visual-assets/` route that only serves allowed image files under `data/visual_db/assets/`.
- Visual records remain references by default and do not establish Canon facts or ability mechanics without explicit approval.
- Added a UI upload flow for user-imported visual references with image magic-byte validation, 8 MB size limits, automatic asset placement, JSONL indexing, and contract tests.
- Added confirmed UI/API deletion for visual references, including index removal, asset cleanup, and contract tests.

## Windows launcher

- Added `launcher.cmd` and `launcher.ps1` as the no-VS-Code entrypoint for the local workbench.
- Launcher actions cover UI start/restart, browser open, visual asset folder open, full validation, desktop shortcut creation, and UI stop.
- Updated `start-ui.cmd` to remain a direct UI-only shortcut pinned to `127.0.0.1:4173`.
- Hardened process ownership checks to match this project's absolute UI script path before stopping or restarting a listener.
- Added reliable command exit codes, startup-failure cleanup, port-release waits, optional browser suppression, and Windows runtime contract tests.
- Unified `start-ui.cmd` with the launcher process model and forwarded command-line arguments through `launcher.cmd`.
- Preserved launcher failures through the `.cmd` wrappers without blocking parameterized automation on `pause`.
