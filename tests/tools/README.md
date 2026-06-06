Tool contract tests placeholder

This directory should host tests verifying MCP tool contracts (input/output schema, permission checks, snapshot/lock behavior, prompt-injection resilience).

Suggested test files:
- tests/tools/get_active_engine.test.ts
- tests/tools/build_generation_context.test.ts
- tests/tools/commit_error_report.test.ts

Each test should assert the tool respects permission_level and produces trace logs on success/failure.
