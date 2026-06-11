# Engineering Update - 2026-06-11 - Phase 5B

- Added Archive Cleanup Proposal scanning and persistent proposal records.
- Added eligible, must-keep, needs-review, and blocked cleanup classifications.
- Added configurable archive, snapshot, candidate, and trash retention policy.
- Added confirmation-gated approve, reject, defer, and execute workflows.
- Revalidates classification and SHA-256 before approval and execution.
- Moves only eligible items into trash with metadata and restore tombstones.
- Uses the existing file transaction layer to roll back partial execution failures.
- Protects active engine, logs, neural traces, high-risk archives, pinned archives, and rollback snapshots.
- Added Cleanup API, UI, path safety, service, transaction-failure, and regression tests.
- Does not permanently delete trash, call OpenAI APIs, or add MCP features.
