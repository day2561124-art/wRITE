# Engineering Update - 2026-06-11 - Phase 4A

- Added candidate draft, proof report, adopted chapter, and context bundle storage.
- Added draft task creation, proofing handoff, structured P0-P4 issue parsing, adoption, rejection, and archive services.
- Added writing workflow APIs and integrated them into the compose and review UI.
- Added safe workflow identifiers and path traversal protection.
- Added neural usage summaries based only on successful agent run traces.
- Added service, API, UI contract, path policy, and active engine isolation tests.
- Adoption ends at `accepted_pending_settlement`; it does not modify the active engine or invoke Phase 3 activation or rollback.
- Did not add cleanup proposals, OpenAI API integration, or large MCP features.
