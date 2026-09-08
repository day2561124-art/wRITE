# Phase70A Research Baseline — Explicit Goal Achievement Verification

Status: Phase70A architecture and acceptance baseline.

Authoritative base HEAD: `939d45f9bf2577911b1fd61e3b3e5e4d9e73893c`.

## 1. Why this is the next formal slice

Phase69D deliberately preserves the invariant:

```text
action success
!= plan fulfillment
!= plan completion
!= goal achievement
```

and explicitly defers goal achievement / termination to later architecture.

Phase70A closes only the smallest missing part: explicit evidence-backed verification that an already represented Phase68D goal condition has been achieved.

It does not add failure, unattainability, disengagement, reengagement, replanning, reward learning, or automatic goal replacement.

## 2. External research synthesis

### 2.1 Control-process self-regulation

Control-process models of self-regulation treat goal pursuit as monitoring discrepancy between a current condition and a reference condition. Engineering implication: achievement is a condition-verification problem, not a synonym for successful execution of one action or plan.

### 2.2 BDI achievement goals

BDI literature distinguishes achievement goals from perform goals. An achievement goal persists until the intended condition is actually brought about; completion of a plan need not establish that the goal itself was achieved.

Engineering implication:

```text
successful plan execution
!= verified goal condition
```

Phase70A therefore requires an explicit achievement decision grounded in bounded authoritative evidence.

### 2.3 Goal disengagement / reengagement

Goal-adjustment research treats disengagement from unattainable goals and reengagement in alternatives as distinct self-regulatory processes.

Engineering implication: Phase70A must not overload `achieve` with `failed`, `unattainable`, `abandoned`, or `reengaged`. Phase68D already owns explicit `abandon`; later architecture may model unattainability/failure and reengagement separately.

## 3. Core scope

Phase70A answers:

```text
Given a same-character Phase68D goal that still exists in effective motivational state,
and bounded authoritative evidence from the current resolved turn,
is there explicit evidence that the goal's target condition has been achieved?
```

The only durable v1 operation is:

```text
achieve
```

No implicit achievement exists.

## 4. Eligible goal states

A goal may be considered only when its effective Phase68D state is:

```text
committed
suspended
```

Rationale:

- `committed` is actively pursued and may become achieved.
- `suspended` remains a represented goal and may become satisfied through external or indirect events even while pursuit is inactive.
- `proposed` was never committed and cannot be marked achieved as a committed goal lifecycle outcome.
- `abandoned` is already terminally disengaged and cannot later be rewritten as achieved in Phase70A v1.

## 5. Goal-kind boundary

Phase68D supports:

```text
achieve_state
maintain_state
avoid_state
restore_state
```

Phase70A v1 may terminally verify only:

```text
achieve_state
restore_state
```

`maintain_state` and `avoid_state` are horizon-sensitive. One successful turn, one fulfilled plan, or the temporary absence of a violation does not establish terminal achievement. They remain outside Phase70A v1 until explicit horizon / completion criteria are designed.

## 6. Authoritative evidence boundary

Phase70A must not scan raw World State or invent semantic truth from arbitrary strings.

The optional resolver receives a detached bounded resolver view containing only:

- eligible same-character effective Phase68D goal descriptors;
- exact goal provenance refs and projection hash;
- bounded current-turn authoritative causal state-transition evidence;
- bounded current-turn authoritative action-outcome evidence;
- bounded current-turn authoritative knowledge-transition evidence where relevant;
- deterministic evidence refs / hashes;
- supported operation and goal-kind boundaries;
- exact resolver-view hash.

It does not receive:

- raw World State;
- raw event queue;
- raw memory store;
- hidden retrieval graph;
- Character Brain hidden reasoning;
- numeric success probability / confidence / utility;
- action-selection authority;
- replanning authority.

Missing resolver means no achievement event.

## 7. Explicit evidence selection

A resolver decision must identify:

```text
goal_ref
evidence_refs[]
operation = achieve
```

At least one canonical current-turn authoritative evidence ref is required.

The engine does not infer achievement from:

- result strings containing `success`;
- Phase69D `fulfilled`;
- Phase69D `completed`;
- one plan ending;
- one action outcome succeeding;
- lack of a failure event;
- goal age / duration;
- retrieval frequency;
- numeric score thresholds.

## 8. Durable primitive

Phase70A installs:

```text
MotivationalGoalAchievementEvent
MotivationalGoalAchievementHistory
```

Recommended event fields:

```text
schema_version
version
immutable

goal_achievement_event_id
goal_achievement_event_hash

character
source_turn_id
operation = achieve

goal_id
goal_kind
source_goal_event_id
source_goal_event_hash
goal_projection_hash

achievement_evidence_refs[]
resolver_view_hash

previous_goal_achievement_event_id
previous_goal_achievement_event_hash

explicit_goal_condition_verification = true
action_success_implies_goal_achievement = false
plan_fulfillment_implies_goal_achievement = false
plan_completion_implies_goal_achievement = false
failure_or_unattainability_modeled = false
world_state_scanned = false
numeric_scoring_modeled = false
character_brain_direct_write = false
status = motivational_goal_achievement_recorded
```

The event is immutable and write-once.

History is append-only and chained per character.

## 9. Effective lifecycle projection

Phase70A adds a layered read model:

```text
EffectiveMotivationalGoalLifecycleProjection
```

It consumes:

```text
Phase68D EffectiveMotivationalGoalProjection
+ Phase70A achievement history
```

and adds:

```text
achieved: boolean
latest_achievement_event_id
```

Rules:

1. Phase68D goal identity / descriptor / motivation provenance remain immutable.
2. `achieve` does not rewrite the Phase68D event history.
3. An achieved goal is terminal for Phase70A v1.
4. A second achievement event for the same character/goal is rejected.
5. Phase68D `abandoned` and Phase70A `achieved` remain distinct terminal semantics.
6. No automatic goal replacement or reengagement follows achievement.

## 10. Downstream filtering

All future goal consumers that mean "currently pursuable goal" must exclude Phase70A-achieved goals through the layered effective projection.

At minimum:

- Phase68D character-facing `cognition.goal_context` must not expose achieved goals as active/suspended current goals.
- Phase69A goal-to-plan formation must not form a new implementation intention for an achieved goal.

Historical Phase68D and Phase69 plan records remain auditable.

## 11. Temporal placement

Phase70A runs after current-turn causal adjudication and after Phase69D execution feedback classification, but before the atomic world commit.

Its resolver uses prior committed Phase68D goal state plus bounded authoritative evidence produced by the current causal resolution.

Same-turn Phase70A achievement cannot retroactively alter:

- Phase69C plan activation;
- Character Brain input;
- selected action;
- causal adjudication;
- Phase69D feedback for the action that already occurred.

The achieved lifecycle state becomes prospectively visible from later turns only.

## 12. Relationship to Phase68D abandon

Phase68D `abandon` remains the explicit voluntary disengagement operation.

Phase70A does not reinterpret abandon as failure and does not convert achievement into abandon.

If future architecture needs:

```text
failed
unattainable
dropped because impossible
reengaged / recommitted
```

those require separate explicit evidence and state-transition contracts.

## 13. Phase62K authoritative mutation boundary

Phase70A emits proposed chronological mutations only.

Phase62K remains the sole final durable writer and must enforce:

- write-once achievement events;
- content-addressed event hash;
- exact canonical same-character source goal provenance;
- eligible source goal state;
- eligible goal kind (`achieve_state` / `restore_state` only);
- exact resolver-view / evidence refs;
- non-empty canonical current-turn evidence;
- a bounded Phase70A validation context hashed into the chronological mutation queue;
- independent Phase62K recomputation of the bounded evidence payload hashes and canonical evidence refs;
- exact membership of every selected achievement evidence ref in that current-turn validation context;
- append-only achievement history;
- per-character previous-event hash chain;
- one achievement per goal maximum;
- no nested history mutation;
- no historical rewrite.

## 14. Explicit non-goals

Phase70A does not implement:

- automatic achievement detection;
- automatic goal failure;
- unattainability inference;
- autonomous goal disengagement;
- reengagement / recommitment;
- autonomous replanning;
- plan-tree / HTN decomposition;
- reward or reinforcement learning;
- numeric progress score;
- expected utility;
- success probability / confidence;
- deadline / horizon scheduler;
- terminal achievement for `maintain_state` or `avoid_state`;
- deletion of historical goals/plans;
- Character Brain durable writes.

## 15. Acceptance contract

Acceptance requires:

- explicit `achieve` only;
- source goal is same-character and effective `committed` or `suspended`;
- source goal kind is `achieve_state` or `restore_state`;
- at least one exact bounded authoritative current-turn evidence ref;
- missing resolver is no-op;
- `action success != plan fulfillment != plan completion != goal achievement` locked by regression;
- Phase69D `completed` cannot auto-achieve a goal;
- Phase68D abandon remains distinct;
- immutable write-once achievement event;
- append-only achievement history;
- deterministic per-character replay / hash chain;
- duplicate achievement rejected;
- no raw World State scan;
- no raw memory / hidden retrieval graph;
- no second retrieval engine;
- no numeric progress / utility / confidence / probability;
- achieved goals excluded from future current-goal character projection;
- achieved goals unavailable for new Phase69A plan formation;
- historical goal and plan data preserved;
- no same-turn retroactive decision leakage;
- Phase62K remains sole final durable writer;
- deterministic replay and input immutability.

## 16. Testing policy

Use focused/scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`. Avoid `affected` when global runner/docs inputs would expand to full `all` without additional information value.
