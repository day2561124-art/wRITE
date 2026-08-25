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

Step 4B-2 will wire the prepared-turn broker into the long-lived HTTP parent, expose the formal prepare/submit/resolve MCP tools, retire individual world capabilities from `chatgpt_public`, and add cross-child end-to-end acceptance tests.
