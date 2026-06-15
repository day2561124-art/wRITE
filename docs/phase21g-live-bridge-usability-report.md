# Phase 21G Live Bridge Usability Report

## Status

Result: PASSED

Phase 21G-2 improved the ChatGPT bridge writing context response payload so operators and ChatGPT can directly read the newly created GPT writing context identifier without manually inspecting local output folders.

## Change Summary

Changed file:

- server/src/chatgpt-bridge-service.mjs

Updated function:

- buildChatgptBridgeWritingContext()

Added flattened response fields:

- writing_context_id
- source_bundle_id
- sourceBundleId
- context_bundle_path
- context_for_chat_path

The original nested result.bundle structure is preserved.

## Safety Scope

This change only affects the low-risk ChatGPT bridge response payload.

It does not:

- generate prose locally
- call an external LLM
- adopt a writing candidate
- confirm approval
- create an adopted chapter
- create a pending engine candidate
- modify active_engine
- modify compressed_rules
- activate an engine version
- rollback or restore files
- execute cleanup

## Tests

### git diff check

Result: PASSED

Command:

- git diff --check

### MCP contract test

Result: PASSED

Command:

- npm run test:mcp

Key result:

- MCP contract tests passed.
- Protected watched files unchanged.
- MCP audit log restored byte-for-byte.

### Full test suite

Result: PASSED

Command:

- npm test

Key result:

- All tests passed.

Temporary entity registry test side effects were restored after the full test run.

## Live MCP HTTP Payload Verification

Endpoint:

- http://127.0.0.1:8787/mcp

Tool:

- chatgpt_bridge_build_writing_context

Arguments:

- useCurrentInputs: true
- chapterMode: next_chapter
- outputMode: candidate_save_later
- includeActiveEngine: false
- includeWritingCard: true
- includeProofingCard: true
- includeLongline: true
- includeEntityRegistry: false
- maxContextChars: 120000

Result:

- ok: true
- blocked: false
- warning_count: 0

Returned flattened identifiers:

- writing_context_id: gptctx_20260615-205231-f74a29c6
- source_bundle_id: gptctx_20260615-205231-f74a29c6
- sourceBundleId: gptctx_20260615-205231-f74a29c6
- context_bundle_path: data/outputs/gpt_writing_contexts/gptctx_20260615-205231-f74a29c6/context_bundle.json
- context_for_chat_path: data/outputs/gpt_writing_contexts/gptctx_20260615-205231-f74a29c6/context_for_chat.md

Created record:

- label: writing_context
- target_id: gptctx_20260615-205231-f74a29c6
- canon_status: context_only

## Conclusion

Phase 21G-2 passed.

The ChatGPT bridge writing context response payload now exposes the source bundle identifier directly. This removes the manual operator step required during Phase 21F and makes candidate saving lineage easier and safer.

## Remaining Phase 21G Items

Recommended follow-up tasks:

1. Improve entity registry hit quality for Chinese character names and aliases.
2. Clarify missing_required_neural_modules handling before formal adoption or settlement.
3. Add low-risk approval reject/defer bridge tools with audit log entries.
4. Re-run live bridge smoke after the remaining fixes.
