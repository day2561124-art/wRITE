# World Simulation Goal Viability / Unattainability Architecture — Phase70B

Status: implementation contract

## Purpose

Phase70B adds one narrow cognition/lifecycle capability: given a goal that still exists in the effective Phase68D/Phase70A lifecycle, determine whether bounded authoritative evidence is sufficient to verify that the goal is now unattainable in the current world lineage.

It does **not** decide what the character should do about that fact.

The required distinctions are:

```text
Action Failed
!= Plan Failed
!= Goal Unattainable
!= Goal Abandoned

Lack Of Progress
!= Goal Unattainable

Goal Unattainable
!= Goal Disengaged
```

Phase70B therefore records an evidence-backed lifecycle fact, while Phase70C may later decide disengagement/reengagement and Phase71 may later decide alternative means/replanning.

## Research synthesis

### Psychology

Goal-adjustment research distinguishes persistence from disengagement. Persistence remains adaptive while meaningful opportunities to attain a goal remain; disengagement becomes relevant when opportunities are absent or sharply reduced and the goal is genuinely unattainable. Progress-monitoring/control-theory work treats discrepancy and slow progress as feedback for regulation, not as proof of impossibility. An action crisis can precede disengagement, but difficulty, setback, or reduced progress is not itself an unattainability certificate.

Engineering consequence: Phase70B must require explicit proof-like evidence and must not infer unattainability from a failure count, time-without-progress, or generic frustration signal.

### BDI / cognitive agents

BDI systems distinguish failed actions/plans from the lifecycle of the motivating goal. A failed plan may produce a goal-failure event or cause another applicable plan to be tried; goal dropping is a separate lifecycle decision. Achievement and maintenance goals also have different completion/drop semantics.

Engineering consequence: Phase69D `failed` feedback cannot auto-create a Phase70B event, and Phase70B must not reuse Phase69D plan failure as goal failure.

### Planning / autonomous agents

Planning research uses dead-end or unsolvability detection as a stronger condition than plan failure. A dead-end detector supplies a sufficient criterion that no goal-reaching continuation exists from the represented state; failure of one current plan is not such a criterion.

Engineering consequence: Phase70B represents a bounded, explicit unattainability basis backed by canonical authoritative evidence. It does not implement general planning, heuristic pessimism, expected utility, or probabilistic reachability.

## Existing substrate

Phase68D owns durable motivational goals and their explicit states (`proposed`, `committed`, `suspended`, `abandoned`). It intentionally does not claim feasibility.

Phase69A–D own implementation intentions, plan revision/activation, and action-backed execution feedback. Their explicit boundary is that action success/failure and plan completion/failure do not settle the goal lifecycle.

Phase70A owns explicit goal-achievement verification for `achieve_state` and `restore_state` goals. It uses prior-turn committed goal state plus bounded current-turn authoritative causal evidence, creates immutable achievement history, and makes `achieved` a terminal lifecycle fact.

Phase70B follows the same authority shape but remains a separate evidence layer.

## Eligibility

Phase70B v1 evaluates only goals that are:

- canonical same-character Phase68D goals;
- effective state `committed` or `suspended`;
- goal kind `achieve_state` or `restore_state`;
- not already `achieved` by Phase70A;
- not already verified `unattainable` by Phase70B.

`maintain_state` and `avoid_state` are deliberately deferred because their horizon/failure semantics need a separate contract rather than being forced into achievement-style terminality.

## Resolver boundary

The optional programmatic hook is `goalViabilityResolver`.

The resolver receives only a detached `GoalViabilityResolverView` containing:

- eligible opaque goal refs with pinned canonical source hashes;
- effective committed/suspended state and goal kind;
- a bounded current-turn authoritative evidence catalog derived from causal state transitions, action outcomes, and knowledge transitions;
- stable hashes identifying the goal projection and resolver view.

It does **not** receive raw World State, memory stores, hidden retrieval state, free-form Character Brain state, numeric success probabilities, expected utility, or a planning search interface.

Missing resolver means: no new unattainability verdict.

## Explicit unattainability basis

A v1 decision uses operation `verify_unattainable` and names exactly one conservative basis kind:

- `irreversible_deadline_expiry`
- `permanent_target_unavailability`
- `irreversible_required_resource_loss`
- `mutually_exclusive_world_transition`
- `proven_goal_condition_unsatisfiable`

These names are not automatic detectors. They are typed assertions by the bounded programmatic resolver and must be backed by canonical current-turn evidence refs.

At least one selected evidence ref must be structural authoritative evidence (`causal_state_transition` or `knowledge_transition`). An `action_outcome` may be supporting evidence, but action outcomes alone are insufficient. This deliberately prevents one failed action from becoming an impossibility verdict.

The event explicitly records:

```text
action_failure_alone_sufficient = false
plan_failure_alone_sufficient = false
lack_of_progress_alone_sufficient = false
numeric_scoring_modeled = false
world_state_scanned = false
```

## Durable model

Phase70B persists immutable append-only structures:

- `motivational_goal_unattainability_events`
- `motivational_goal_unattainability_history`

Each `MotivationalGoalUnattainabilityEvent` pins:

- character and goal identity;
- source Phase68D goal event id/hash;
- source effective goal projection hash;
- operation `verify_unattainable`;
- typed `unattainability_basis_kind`;
- canonical evidence refs/hashes;
- resolver-view hash;
- previous per-character Phase70B event id/hash;
- explicit boundary booleans.

Phase62K revalidates the event against a server-built bounded authoritative validation context before any Phase70B queue mutation can become committed World State.

## Effective viability projection

`EffectiveMotivationalGoalViabilityProjection` layers Phase70B history over the Phase70A effective lifecycle projection.

An unattainability event adds:

```text
unattainable = true
latest_unattainability_event_id = <id>
unattainability_basis_kind = <basis>
```

It does not rewrite Phase68D state. A goal may therefore remain `committed` or `suspended` while being explicitly marked unattainable.

This is intentional:

```text
unattainable != abandoned
```

No automatic disengagement, reengagement, replacement, or replanning occurs in Phase70B.

## Achievement / unattainability consistency

Within one world lineage, an already achieved goal cannot later be marked unattainable, and an already verified-unattainable goal cannot later be newly marked achieved. Phase70A is hardened to exclude Phase70B-terminal goals from new achievement verification.

This is a consistency rule, not a disengagement policy.

## Turn ordering

Phase70B runs after Phase70A and before atomic world commit:

```text
Causal adjudication
  -> Phase69D execution feedback
  -> Phase70A achievement verification
  -> Phase70B viability / unattainability verification
  -> atomic world commit
```

The resolver view is built from the goal state committed before the turn plus current-turn authoritative causal evidence. The durable Phase70B event is applied to the post-Phase70A preview so same-turn achievement wins the mutual-exclusion check and cannot also become unattainable.

## Non-goals

Phase70B does not implement:

- automatic goal abandonment;
- automatic disengagement or reengagement;
- recommitment or goal replacement;
- autonomous replanning or alternative-means search;
- HTN / plan-tree planning;
- numeric success probability or pessimism thresholds;
- expected utility;
- learned reward / reinforcement learning;
- free-form World State scanning by Character Brain;
- failure-count thresholds;
- time-without-progress thresholds;
- maintain/avoid horizon failure semantics.

## Acceptance contract

Phase70B is accepted only if tests demonstrate all of the following:

1. no resolver means no unattainability write;
2. action failure alone cannot form a valid decision;
3. plan failure / completion state does not auto-create unattainability;
4. lack of progress is not represented as an automatic trigger;
5. explicit supported basis + canonical current-turn evidence creates one deterministic immutable event;
6. selected evidence refs are canonical, ordered, hashed, and member-checked by Phase62K;
7. at least one structural evidence ref is required;
8. already achieved, abandoned, unsupported-kind, or already-unattainable goals are rejected;
9. unattainability does not mutate Phase68D goal state and does not automatically abandon/disengage/replan;
10. a persisted unattainable goal cannot later receive a Phase70A achievement event;
11. event/history writes are append-only, hash-chained, replay deterministic, and queue-authoritative;
12. loop ordering is Phase69D -> Phase70A -> Phase70B -> commit;
13. focused Phase70B tests pass;
14. scoped `memory_retrieval`, `cognition`, and `world_simulation` acceptance passes;
15. `git diff --check` passes before isolated commit/integration.
