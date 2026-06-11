# Engineering Update - 2026-06-12 - Phase 6A

- Added a full workflow smoke/golden scenario spanning Phase 4A through Phase 5B.
- Covers candidate draft, proof report, adoption, settlement context, settlement report, and pending candidate creation.
- Confirms activation through Approval Queue delegation to the Phase 3 service.
- Verifies snapshot, archive, activation log, rollback safety snapshot, and exact active-engine restoration.
- Covers Cleanup Proposal approval and move-to-trash with metadata and tombstone.
- Adds negative checks for unconfirmed activation, blocked candidates, and missing neural success traces.
- Protects production active engine, visual assets, feedback data, generated outputs, and runtime queues.
- Removes all smoke fixtures and transaction records after success or failure.
- Adds the full workflow smoke test to the standard `npm test` runner.
- Does not add OpenAI API calls, MCP features, permanent deletion, or production workflow data.
