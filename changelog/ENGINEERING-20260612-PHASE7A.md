# Engineering Update - 2026-06-12 - Phase 7A

- Added MCP read-only tool functions for project status, active sources, workflow records, pending candidates, approval queue, neural usage, and cleanup proposals.
- Added uniform read-only result envelopes with source metadata, warnings, blocked state, and canon status.
- Added `describeSourceFile()` metadata helper with path, existence, modified time, SHA-256, size, and canon status.
- Exported `readonlyTools` and `readonlyToolMetadata` without wiring them into the MCP server registry yet.
- Ensured every Phase 7A tool is marked `permission: read_only`, `writes_files: false`, and `can_modify_active_engine: false`.
- Avoided list helpers that create directories; missing directories return empty data or warnings instead.
- Added tests for active engine reads, missing active engine blocking, latest workflow reads, pending candidates, approval status, neural usage, cleanup proposals, path traversal, and no write side effects.
- Does not add OpenAI API calls, write tools, activation, rollback, cleanup execution, or new MCP server capabilities.
