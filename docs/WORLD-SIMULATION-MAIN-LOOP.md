# World Simulation Main Loop — Phase62C

## Purpose

Phase62C connects the Phase62A world cognition capabilities and the Phase62B shared dual-mode neural core to a persistent, event-driven world-state loop.

The authority split is explicit:

```text
Persisted World State
  -> queue-head event
  -> Scene causal analysis
  -> per-character perception
  -> per-character memory retrieval
  -> per-character cognition
  -> candidate action intents
  -> ChatGPT character brain selects intent only
  -> programmatic causal adjudicator resolves outcomes
  -> consistency critic
  -> atomic world-state/history commit
  -> next queue-head event
```

The neural/shared core never writes hard state. The character brain never receives the complete world-state snapshot and never decides whether an action succeeds. The causal adjudicator receives the hard state and selected intents and is the only component allowed to construct `next_world_state`.

## Persistent state

Each world-simulation agent run may own two session-scoped files under its agent-run directory:

- `world_state.json`
- `world_history.json`

`world_state.json` stores the current revision, state hash, and hard state. `world_history.json` stores committed turn lineage, selected intents, explicit transitions, causal outcomes, scheduled events, trace ids, and before/after state hashes.

State commits use optimistic revision/hash checks. A stale prepared turn cannot overwrite a newer world state.

## Event-driven scheduling

Phase62C resolves only the head of `world_state.event_queue`. Supplying a later event id is rejected. This keeps simulation event-driven rather than pretending to advance every second.

The causal adjudicator is responsible for constructing the next queue state, including elapsed simulation time and newly scheduled events. Unrelated regions do not need second-by-second execution.

## Character information boundary

For each named participant, the loop builds a decision packet from:

- observer-scoped/public Scene State;
- accessible memory records with provenance/confidence/clarity preserved;
- that character's own state;
- simulator-supplied available action intents.

The packet passed to `characterBrain(...)` does not include full `world_state` or the scene causal-analysis packet. The character brain may return a candidate `action_id` or `reject_all`. Selecting an action not present in that character's candidate list is rejected before causal adjudication.

## Causal adjudication boundary

`runWorldSimulationTurn(...)` requires a programmatic `causalAdjudicator(...)` callback. It receives:

- an isolated clone of the persisted world state;
- current event;
- scene causal analysis;
- validated selected action intents.

It must return `next_world_state` and may provide explicit `state_transitions`, `action_outcomes`, `knowledge_transitions`, and scheduled events.

The consistency critic runs before commit. Any hard conflict discards the proposed resolution and leaves the persisted world state unchanged.

Phase62C deliberately does not expose a new MCP tool yet. It establishes and tests the programmatic loop kernel first, without changing the 92-tool public MCP baseline. A later transport phase can expose preparation/advance operations after the causal rule layer is stable.

## Acceptance

```powershell
npm run test:phase62a
npm run test:phase62b
npm run test:phase62c
```

Phase62C verifies:

- persisted revision/hash lineage;
- queue-head event ordering;
- hidden world information does not reach the character brain;
- named-character choice is limited to candidate intents;
- causal adjudication owns results and next state;
- consistency conflicts prevent commit;
- stale revisions are rejected;
- successful turns append deterministic causal history and neural trace ids.
