# Phase 8G: Adopted Writing Settlement Candidate

## Summary

- Added GPT-facing settlement contexts for confirmed adopted writing.
- Added chat-output settlement report persistence.
- Added pending engine candidate creation from saved settlement reports.
- Linked settlement context, report, and pending candidate IDs back to adopted writing and writing candidate metadata.
- Added creative task and MCP surfaces for the three explicit settlement steps.

## Safety

- No OpenAI or other LLM API is called.
- Settlement reports are supplied by GPT/chat or manual paste.
- Pending engine candidates are review-only and are never treated as active canon.
- Phase 8G does not create activation approval requests.
- Phase 8G does not approve, activate, rollback, or clean up engine state.
- `data/canon_db/active_engine.md` is hash-checked and remains unchanged.

## Tests

- Adopted writing settlement service contract.
- Full GPT context through adoption and pending candidate E2E.
- MCP tool and permission metadata contract.
- Creative task and MCP registry regression coverage.
