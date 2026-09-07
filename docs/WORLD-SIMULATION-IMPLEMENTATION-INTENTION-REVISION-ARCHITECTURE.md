# Phase69B Research Baseline — Implementation Intention Revision / Replanning

Status: Phase69B architecture and acceptance baseline.

Authoritative base HEAD: `1380e57e3c6f662c1e6d4ff63c8fa30f40132ea1`.

## 1. Scope

Phase69B extends Phase69A formation-only implementation intentions with explicit reconsideration and revision semantics.

```text
Phase68D committed goal
!= Phase69A implementation intention
!= Phase69B implementation-intention revision
!= executable action plan
!= selected action
!= authoritative world-state outcome
```

Phase69B answers: when a prior plan is no longer suitable, how can the character preserve, challenge, suspend, abandon, or explicitly replace that plan without mutating history and without bypassing action proposal or causal execution?

## 2. Research synthesis

Implementation-intention research distinguishes goal intentions from if-then plans and explicitly covers disengagement from failing courses of action rather than requiring indefinite persistence. BDI architectures separate goal persistence from commitment to one specific plan: when a plan becomes unsuitable, the goal can remain while the agent reconsiders the current intention and seeks another course. Re-entrant HTN planning similarly preserves execution history while replanning from the point of failure rather than rewriting the old plan.

Useful sources:

- Gollwitzer & Sheeran: implementation intentions support initiation, shielding, and disengagement from failing means.
- Schut & Wooldridge: intention reconsideration controls commitment to plans in dynamic environments.
- Bansod, Nau, Patra, Roberts: re-entrant HTN replanning after execution errors.

Engineering consequence: revision must be append-only and explicit. A plan does not disappear because a newer plan exists; replacement must name the prior plan it supersedes.

## 3. Core durable primitive

Phase69B adds:

```text
GoalImplementationIntentionRevisionEvent
```

Supported operations:

```text
support
challenge
suspend
abandon
revise
```

Semantics:

- `support`: records that the current plan remains suitable under bounded reconsideration evidence; state remains active.
- `challenge`: records tension or inadequacy evidence; state remains active but challenged.
- `suspend`: temporarily deactivates one active/challenged plan while preserving possible later replacement semantics.
- `abandon`: terminally deactivates one active/challenged/suspended plan.
- `revise`: creates a new implementation-intention identity and explicitly supersedes exactly one prior non-abandoned same-character plan.

No implicit last-write-wins replacement is allowed.

## 4. Revision evidence

Phase69B v1 must not scan raw World State, raw memories, hidden semantic graphs, or execution traces as an autonomous monitor. The revision resolver receives only bounded structural inputs already produced by trusted substrates:

- effective same-character Phase69A implementation intentions;
- current effective Phase68D goal state for each plan;
- optional bounded reconsideration descriptors supplied by the caller/resolver boundary;
- exact canonical Phase69A plan event ID/hash for engine-side pinning.

A revision event may never assert that an action actually failed, that a cue objectively occurred, or that a response is infeasible unless a later accepted execution-monitoring architecture supplies such evidence explicitly.

## 5. Descriptor preservation

`support`, `challenge`, `suspend`, and `abandon` retain the original plan's cue/response descriptor.

`revise` must provide a new bounded cue and/or response descriptor using the Phase69A vocabularies. The new plan remains planning semantics only and may not contain:

```text
action_id
mutation
world_state_patch
outcome
utility
priority
probability
feasibility_score
scheduler timestamp
```

## 6. Durable state

Recommended stores:

```text
goal_implementation_intention_revision_events
goal_implementation_intention_revision_history
```

Revision events are immutable/write-once, deterministic, content-addressed, and chained per character. Revision history is append-only.

The original Phase69A event/history is never edited.

## 7. Effective projection

Phase69B projects an `EffectiveRevisedGoalImplementationIntentionProjection` by replaying Phase69A formation state plus Phase69B revision history.

Per-plan states:

```text
active
challenged
suspended
abandoned
superseded
inactive_source_goal_not_committed
```

Rules:

1. Source-goal commitment still gates effective activity.
2. `support` preserves the current non-terminal state and records latest revision provenance.
3. `challenge` changes active -> challenged; repeated challenge remains challenged.
4. `suspend` changes active/challenged -> suspended.
5. `abandon` changes active/challenged/suspended -> abandoned.
6. `revise` supersedes the target and introduces a new plan identity with state determined by source-goal commitment.
7. Superseded/abandoned plans never reactivate through LWW.
8. Multiple active/challenged plans for one goal remain legal.

No numeric plan quality, utility, confidence, probability, or feasibility is invented.

## 8. Resolver boundary

The optional resolver view exposes only bounded same-character plan records and source-goal state. Missing resolver means no revision event.

It does not receive:

- raw World State;
- raw World Event;
- raw memory content;
- hidden retrieval graph;
- action IDs;
- mutation proposals;
- causal outcome authority;
- objective feasibility labels;
- numeric utility/priority/confidence/probability.

## 9. Phase62K enforcement

Phase62K must enforce:

- write-once revision events;
- append-only revision history;
- exact per-character revision hash chain;
- canonical same-character Phase69A target plan source;
- legal target state transition;
- explicit target on revise/suspend/abandon/challenge/support;
- exact queue-turn binding;
- no duplicate revision identity;
- no executable-action authority;
- no historical rewrite of Phase69A or Phase69B records.

## 10. Explicit non-goals

Phase69B does not implement:

- action execution monitoring;
- causal failure detection;
- automatic cue detection;
- HTN task decomposition;
- scheduler timestamps;
- plan ranking;
- expected utility;
- learned policy adaptation;
- reinforcement learning;
- automatic goal suspension/abandonment;
- Character Brain direct durable writes.

## 11. Acceptance contract

Acceptance requires:

- original Phase69A history remains immutable;
- revision history append-only and replayable;
- explicit support/challenge/suspend/abandon/revise semantics;
- revise creates a new deterministic plan identity and explicit supersession;
- no LWW replacement;
- source-goal commitment still gates plan activity;
- same-character plan targets only;
- no raw World State/memory scan;
- no second retrieval engine or hidden semantic graph;
- no action-selection/execution authority;
- no numeric plan quality/utility/probability/feasibility;
- Phase62K remains sole authoritative final writer;
- deterministic replay and input immutability;
- prior-turn-only bounded character exposure if/when connected to the loop;
- no same-turn retroactive leakage.

## 12. Testing policy

Use focused/scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`; avoid `affected` when global runner inputs would only expand to full `all` without additional evidence value.
