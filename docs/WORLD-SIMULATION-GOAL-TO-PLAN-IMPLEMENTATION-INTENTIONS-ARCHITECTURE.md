# Phase69A Research Baseline — Goal-to-Plan / Implementation Intentions

Status: Phase69A architecture and acceptance baseline.

Authoritative base HEAD: `e58040810bb14d8341107559c9617e3b2f264f15`.

## 1. Scope

Phase69A begins the volitional planning layer above Phase68D committed motivational goals.

```text
Phase68D committed goal
!= Phase69A implementation intention
!= executable action plan
!= selected action
!= authoritative world-state outcome
```

Phase69A answers a narrow question: how can a character bind a committed goal to a bounded prospective cue and a bounded intended response without letting planning bypass the existing action proposer or causal engine?

## 2. Research synthesis

Gollwitzer's implementation-intention work separates goal intentions from if-then plans. The useful engineering distinction is that a goal says what outcome is wanted, while an implementation intention binds a critical future cue to an intended response in service of that already-committed goal. The 2025 Annual Review of Psychology synthesis preserves this distinction and emphasizes contingent cue-response structure rather than merely scheduling an action.

BDI architectures independently separate committed intentions/plans from beliefs and from actual execution. HTN planning likewise separates high-level objectives from lower-level activities and execution. Phase69A adopts only the boundary lesson: durable planning state may guide later action generation, but it must not itself become action-selection authority.

References:

- Gollwitzer & Sheeran, implementation intentions / goal achievement.
- Gollwitzer & Sheeran (2025), *Psychology of Planning*, Annual Review of Psychology 76:303–328.
- Bercher (2022), hierarchical planning and partially ordered plans.

## 3. Core decision

The durable primitive is:

```text
GoalImplementationIntentionEvent
```

Phase69A v1 supports formation only:

```text
form
```

Revision, replacement, conflict resolution between plans, and learned plan adaptation are deferred to later accepted architecture.

Each event binds exactly one same-character currently committed Phase68D goal to:

```text
if cue_descriptor
then response_descriptor
```

The event is prospective subjective planning state. It is not a claim that the cue will occur, the response is feasible, or the goal will succeed.

## 4. Source authority

A plan may cite only a canonical same-character Phase68D goal whose effective state is `committed` at formation time. The exact latest committed goal event ID/hash is pinned as provenance.

If the source goal later becomes suspended or abandoned, the historical plan remains immutable but its effective projection becomes inactive because its source goal is no longer committed.

No plan may reactivate a suspended goal, commit a proposed goal, or mutate Phase68D history.

## 5. Structured descriptors

Cue descriptor:

```text
cue_kind:
  situation | opportunity | obstacle | task_juncture | internal_state

label: bounded symbolic-natural-language label
context: optional bounded qualifier
```

Response descriptor:

```text
response_kind:
  initiate_behavior | cognitive_procedure | communication | avoidance | seek_support

label: bounded intended response label
context: optional bounded qualifier
```

These descriptors are planning semantics only. They cannot contain an executable `action_id`, mutation, outcome, target world-state patch, utility, probability, or scheduler timestamp.

## 6. Durable state

```text
goal_implementation_intention_events
goal_implementation_intention_history
```

Events are immutable/write-once, deterministic, content-addressed, and chained per character. History is append-only.

A character may form multiple plans for a committed goal. Phase69A does not rank them and does not enforce global plan coherence.

## 7. Effective projection

Replay creates `EffectiveGoalImplementationIntentionProjection`.

A historical plan is `active` only when its exact source goal currently projects to `committed`. Otherwise it is `inactive_source_goal_not_committed`.

This inactivity is derived and never rewrites the historical plan.

No plan priority, confidence, expected utility, success probability, execution readiness score, or feasibility judgment is invented.

## 8. Character-facing projection

A bounded projection may expose prior-turn active implementation intentions to later cognition/action-proposal layers using only:

- goal kind/domain/target descriptor;
- cue kind/label/context;
- response kind/label/context;
- subjective/prospective semantics.

It must not expose engine IDs, hashes, source event IDs, raw World State, executable action IDs, mutation paths, numeric ranking, or action-selection authority.

Same-turn writes fail closed.

## 9. Resolver boundary

The optional programmatic resolver receives only:

- committed Phase68D goals for the same character;
- their bounded goal descriptors;
- exact canonical goal source refs for engine-side pinning;
- supported cue/response descriptor vocabularies;
- resolver-view hash.

It does not receive raw memories, World State, hidden retrieval graphs, causal outcome authority, action IDs, or mutation proposals.

Missing resolver means no durable plan is formed.

## 10. Phase62K enforcement

Phase62K must enforce:

- write-once plan events;
- append-only plan history;
- exact per-character plan hash chain;
- canonical same-character committed Phase68D source goal;
- exact queue turn binding;
- no duplicate durable plan identity;
- no executable action authority in persisted plan descriptors;
- no historical rewrite.

Phase69A acceptance also repairs and regression-locks the discovered Phase68D wiring defect where its already-defined queue validator was not invoked by the authoritative mutation projector/executor.

## 11. Explicit non-goals

Phase69A does not implement:

- action selection;
- action execution;
- concrete plan trees / HTN decomposition;
- plan ordering or scheduler timestamps;
- automatic goal completion detection;
- feasibility oracle;
- expected utility or probability;
- reinforcement learning;
- plan revision/replacement;
- Character Brain direct durable writes.

## 12. Acceptance contract

Phase69A acceptance requires:

- committed-goal source only;
- same-character source only;
- immutable write-once implementation-intention events;
- append-only history and per-character hash chain;
- structured if-cue/then-response semantics;
- no action ID or mutation authority;
- multiple plans allowed without LWW;
- source-goal suspension/abandonment deterministically deactivates projection without rewriting history;
- no numeric utility/priority/confidence/probability/feasibility;
- no raw memory/World State scan;
- no second retrieval engine or hidden semantic graph;
- Phase62K remains sole final writer;
- bounded prior-turn Character-facing projection;
- no same-turn retroactive leakage;
- Phase68D queue enforcement wiring is authoritative and regression-tested.

## 13. Testing policy

Use focused/scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`. Avoid `affected` when global runner inputs merely expand to full `all` without additional evidence value.
