# Phase 14A-Lite Engineering Change

Date: 2026-06-13

## ChatGPT MCP Bridge MVP

- Added nine `chatgpt_bridge_*` MCP tools for status, current inputs, writing
  context, candidate intake, proofing, adoption requests, and settlement reports.
- The bridge delegates to the existing workflow services and does not define a
  second candidate, proof, approval, or settlement format.
- Current inputs are bounded to 250,000 characters and omit active-engine text
  unless explicitly requested.
- The bridge cannot call an external LLM or generate locally.
- Adoption remains an approval request. User confirmation must occur in the
  Writer Workbench approval queue.
- Settlement report intake does not create a pending engine candidate.
- No bridge tool can modify or apply `active_engine.md` or
  `compressed_rules.md`, activate an engine, approve, confirm adoption, restore,
  roll back, or execute cleanup.

## Verification

- Added a fixture-isolated bridge workflow test.
- Added all bridge tools to MCP schema, permission, enum, integer-limit, and
  required-field contract coverage.
- Kept the production MCP dispatch queue limit at 256 and added a smoke-test
  drain point so the growing schema matrix does not become an overload test.
