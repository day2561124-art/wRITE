# World Simulation Formal MCP Transport

## Phase62A-R1 Step 4B-1 — Prepared Turn Transport Core

Step 4B-1 installs the server-side transport core only. `chatgpt_public` MCP adoption remains Step 4B-2.

Formal lifecycle:

1. Begin one world-simulation session, optionally with one initial world-state snapshot.
2. Prepare the persisted event-queue head through the native world loop.
3. Keep the full `PreparedTurn` in an ephemeral prepared-turn broker.
4. Surface exactly one bounded Character Brain input and one opaque `decision_handle` at a time.
5. Accept only an existing `action_id` or `reject_all`; callers do not submit action objects or outcome/state fields.
6. After all named-character decisions are submitted, atomically take the prepared turn once for resolution.
7. Re-check persisted revision/hash inside the native resolver, use the built-in programmatic causal adjudicator and consistency gate, then commit through the existing authoritative state writer.
8. Release the prepared payload after committed, blocked, failed, or invalidated resolution.

Security/authority properties:

- one active prepared turn per world session;
- an internal `PREPARING` reservation is acquired before native preparation, so concurrent cross-child prepare calls cannot duplicate neural work for the same session snapshot;
- repeated prepare on the same revision/hash reuses the existing handle and does not rerun neural preparation;
- no arbitrary TTL is part of the security model;
- prepared payloads are process-local ephemeral references and do not persist across parent-process restart;
- decision ordering is broker-enforced;
- resolution is one-shot;
- parent-minted resolver ownership supports invalidating a taken turn when an IPC child disconnects;
- formal transport strips caller-provided runtime callbacks, including custom memory retrieval resolvers and causal adjudicators;
- missing Phase63C retrieval resolver therefore means no retrieval process in the formal transport core;
- the formal character input has one source-of-truth projector and does not include raw event/session/turn identity;
- the formal surface uses `recovered_memories` only; the historical `retrieved_memories` alias remains available only to explicitly compatible direct/native callers;
- model-context isolation is not claimed: sequential packets in one ChatGPT conversation are not equivalent to isolated per-character neural sessions.

## Phase62A-R1 Step 4B-2 — Formal MCP Public Adoption

Step 4B-2 installs the public transport without changing the Step4B-1 native authority model.

The formal `chatgpt_public` world surface is now exactly:

- `chatgpt_bridge_begin_world_simulation_session`
- `chatgpt_bridge_prepare_world_turn`
- `chatgpt_bridge_submit_world_character_action`
- `chatgpt_bridge_resolve_world_turn`

The long-lived MCP HTTP parent owns one process-local prepared-turn broker shared by isolated per-connection `mcp-server` children over Node IPC. A prepared handle is application state, not an MCP-session security identity: it is bound by the broker to world session, persisted revision/hash, decision order, and one-shot lifecycle, and it disappears on parent restart.

The seven individual world capability tools remain registered in the `full` profile for diagnostics/compatibility but are removed from `chatgpt_public`. Formal callers therefore cannot bypass the native loop by composing causal analysis, perception, cognition, action proposal, agency, consistency, or legacy memory projection themselves.

The begin tool may optionally carry one `initial_world_state` bootstrap snapshot. The state service writes it only as revision 0 and rejects reinitialization; this does not implement automatic Canon hydration and never grants callers a later next-state write surface.

All formal and legacy world MCP tool calls are classified explicitly by the world MCP boundary service and use opaque hash/size/schema audit summaries with no payload preview. Output-log resources remain unavailable in `chatgpt_public`.

Phase63C recovery-stage candidate content is still not exposed to the same ChatGPT context. Formal MCP preparation intentionally supplies no external memory-retrieval resolver, so missing resolver means no actual retrieval process until an isolated resolver context is implemented.

Server-enforced per-call packet isolation is guaranteed; physical forgetting between sequential character packets in one ChatGPT conversation is not claimed.
