# World Simulation Goal Disengagement / Reengagement Architecture — Phase70C

Status: implementation contract

## Purpose

Phase70C adds one narrow motivational-lifecycle capability above Phase70B: after a goal has been explicitly verified unattainable in the current world lineage, the character may explicitly withdraw commitment from that goal and may later redirect commitment toward another already-existing viable committed goal.

It answers:

```text
Given that this goal is now explicitly unattainable,
what does this character do with its motivational commitment?
```

The required distinctions are:

```text
Goal Unattainable
!= Goal Disengaged

Goal Disengaged
!= Alternative Goal Reengaged

Reengagement
!= Revival Of The Same Unattainable Goal

Reengagement
!= New Goal Creation
!= Goal Commitment Creation
!= Replanning
```

Phase70C records explicit goal-adjustment lifecycle decisions. Phase71 remains responsible for alternative means / replanning.

## Research synthesis

### Psychology: goal disengagement

Goal-adjustment research distinguishes disengagement from the condition that makes disengagement relevant. An unattainable goal may make disengagement adaptive, but disengagement itself involves withdrawing both effort and psychological commitment. Difficulty, setbacks, an action crisis, or explicit unattainability can trigger reconsideration without mechanically causing disengagement.

Engineering consequence: Phase70B `unattainable=true` is eligibility evidence for Phase70C, not an automatic `disengage` transition. Missing resolver means no Phase70C write.

### Psychology: goal reengagement

The goal-adjustment literature uses reengagement for identifying, committing to, and pursuing alternative meaningful goals after an unattainable goal is encountered. It does not require resurrecting the original impossible goal. Reengagement can occur in the same life domain or another domain, but the alternative is a distinct goal.

Engineering consequence: Phase70C v1 may redirect commitment only toward a distinct same-character goal that already exists and is already committed in the upstream motivational system. Phase70C does not invent or commit new goals; Phase68D remains the owner of proposal/commitment creation.

### BDI / commitment strategies

BDI commitment strategies distinguish intention persistence from reconsideration. Blind commitment persists until success; single-minded commitment permits release once achievement is believed impossible; open-minded variants additionally react when the motivating goal is no longer desired. Goal drop/suspension and plan failure are separate lifecycle semantics.

Engineering consequence: Phase70C is an explicit reconsideration layer. It does not derive disengagement from plan failure, action failure, lack of progress, or the mere presence of an unattainability event without a separate adjustment decision.

### Goal lifecycle systems

Goal-oriented agent frameworks commonly separate goal adoption, active pursuit, suspension, dropping, target conditions, and failure conditions. Dropping is not identical to plan exhaustion. Existing Phase68D already owns voluntary `abandon` and `suspend`; Phase70C therefore must not rewrite Phase68D history or pretend that Phase70B was an implicit Phase68D abandon.

## Existing substrate

Phase68D owns durable goal identity and explicit states:

```text
proposed
committed
suspended
abandoned
```

Phase69A–D own implementation intentions, plan lifecycle, activation, execution feedback, and completion monitoring.

Phase70A owns explicit achievement verification.

Phase70B owns explicit evidence-backed unattainability verification and intentionally leaves the underlying Phase68D state unchanged.

Phase70C layers goal-adjustment semantics over the effective Phase70B projection.

## Phase70C operations

Phase70C v1 supports two operations:

```text
disengage_unattainable
reengage_alternative
```

### `disengage_unattainable`

Eligibility:

- same-character canonical Phase68D goal;
- effective Phase68D state `committed` or `suspended`;
- Phase70A `achieved != true`;
- Phase70B `unattainable == true`;
- not already Phase70C-disengaged.

The operation records explicit withdrawal of motivational commitment/effort from the unattainable goal.

It does not mutate Phase68D goal history and does not convert the old goal to a Phase68D `abandoned` event. The final effective lifecycle overlays:

```text
disengaged = true
engagement_state = disengaged
```

### `reengage_alternative`

Eligibility:

- a prior committed Phase70C disengagement event exists for the same character;
- source goal remains the same terminally unattainable/disengaged goal;
- target goal is a distinct same-character Phase68D goal;
- target goal effective state is `committed`;
- target goal is not achieved;
- target goal is not unattainable;
- target goal is not abandoned;
- target goal has not already been selected as the same source disengagement's reengagement target.

The operation records redirection of motivational commitment toward that already-existing alternative goal.

It does not:

- revive the source goal;
- change the target goal's Phase68D identity/state;
- propose or commit a new goal;
- create a plan;
- select an action;
- claim the alternative is optimal.

Phase70C v1 requires reengagement to cite a prior-turn committed disengagement event. Same-turn disengage -> reengage chaining is deliberately excluded so the durable boundary remains explicit and replayable.

## Why Phase68D `abandon` still exists

Phase68D `abandon` remains a general explicit voluntary terminal lifecycle operation for goals that the character no longer intends to pursue.

Phase70C does not delete or reinterpret it. Instead it adds a later, provenance-rich adjustment path specifically grounded in Phase70B unattainability:

```text
Phase68D abandon
= upstream explicit voluntary goal termination

Phase70B unattainable + Phase70C disengage
= evidence-backed impossibility followed by a separate explicit adjustment decision
```

No last-write-wins merge is introduced between these layers.

## Resolver boundary

The optional programmatic hook is `goalAdjustmentResolver`.

The resolver receives a detached `GoalAdjustmentResolverView` containing only:

- Phase70B effective goal viability projection hash;
- eligible unattainable source goals with opaque refs;
- canonical Phase70B unattainability event id/hash/basis for each source goal;
- prior Phase70C disengagement/reengagement state;
- bounded alternative committed goals for the same character;
- source/target goal descriptors and motivation relation labels;
- supported operations;
- stable resolver-view hash.

It does not receive:

- raw World State;
- raw memory stores;
- hidden retrieval state;
- free-form planning search;
- implementation-plan internals;
- action proposals;
- numeric utility or expected utility;
- success probability;
- learned reward;
- a personality score or global priority score.

Missing resolver means no new Phase70C event.

## Durable model

Phase70C persists immutable append-only structures:

```text
motivational_goal_adjustment_events
motivational_goal_adjustment_history
```

Each `MotivationalGoalAdjustmentEvent` pins:

- character;
- source turn;
- operation;
- source goal id;
- source canonical Phase68D goal event id/hash;
- source Phase70B unattainability event id/hash/basis;
- Phase70B viability projection hash;
- optional target alternative goal id/source event id/hash for reengagement;
- prior Phase70C disengagement event id/hash for reengagement;
- resolver-view hash;
- previous per-character Phase70C event id/hash;
- explicit boundary booleans.

The history is append-only and replay deterministic.

## Effective goal-adjustment projection

`EffectiveMotivationalGoalAdjustmentProjection` layers Phase70C history over the Phase70B effective viability projection.

Every goal receives bounded Phase70C overlay fields without replacing the authoritative Phase68D `state`:

```text
goal_adjustment_state:
  unadjusted | disengaged | reengaged_alternative

disengaged: boolean
latest_goal_adjustment_event_id: id | null
reengaged_from_goal_ids: [id, ...]
```

`unadjusted` means only that Phase70C has not applied a disengagement/reengagement overlay. It does not reinterpret a Phase68D `suspended` or `abandoned` state as actively engaged.

For the unattainable source goal after disengagement:

```text
unattainable = true
disengaged = true
goal_adjustment_state = disengaged
```

For an eligible alternative target after reengagement:

```text
unattainable = false
disengaged = false
goal_adjustment_state = reengaged_alternative
reengaged_from_goal_ids += <source goal>
```

The source list is append-only/deduplicated so multiple independently disengaged goals may redirect commitment toward the same already-existing alternative without last-write-wins loss.

The source goal stays unattainable and is never revived.

## Authoritative mutation boundary

Phase70C produces proposed chronological mutations only. Phase62K remains the sole final writer.

Phase62K must independently revalidate:

- event schema/version/hash;
- exact source-turn queue name;
- per-character hash chain;
- append-only history;
- source canonical Phase68D goal identity/hash;
- source exact Phase70B unattainability event id/hash;
- source goal is unattainable and not achieved;
- operation-specific legal transitions;
- target alternative is distinct, same-character, committed, not achieved, not unattainable;
- reengagement cites a prior committed disengagement event;
- resolver-view / viability-projection hash consistency;
- no duplicate disengagement or duplicate reengagement for one source adjustment.

Preview output alone is never trusted as durability authority.

## Turn ordering

Phase70C runs after Phase70B and before atomic world commit:

```text
Phase69D execution feedback
  -> Phase70A achievement verification
  -> Phase70B viability / unattainability verification
  -> Phase70C disengagement / reengagement
  -> atomic world commit
```

The resolver view is built from `snapshot.state` (the state committed before the turn). Therefore a same-turn new Phase70B unattainability certificate becomes durable in this turn but is not automatically eligible for Phase70C until a later turn. This deliberately prevents `unattainable -> disengaged` from collapsing into one automatic transition.

Phase70C event construction applies to the post-Phase70B preview, but its decisions remain pinned to the prior committed resolver view.

## Relationship to planning

Phase70C does not choose a new means for the source goal and does not generate a plan for the target goal.

```text
reengage_alternative
!= alternative means for same goal
!= adaptive replanning
```

Phase71 remains the planned layer for adaptive replanning / alternative means.

## Non-goals

Phase70C does not implement:

- automatic disengagement when Phase70B fires;
- automatic reengagement;
- same-goal resurrection after terminal Phase70B unattainability;
- Phase70B unattainability revision/retraction;
- new goal proposal/creation;
- automatic Phase68D commit;
- autonomous goal replacement by deleting old goals;
- adaptive replanning;
- alternative-means search;
- HTN / plan trees;
- action selection;
- numeric persistence thresholds;
- failure-count or time-without-progress thresholds;
- expected utility;
- learned reward / reinforcement learning;
- free-form World State scanning.

## Acceptance contract

Phase70C is accepted only if tests demonstrate all of the following:

1. no resolver means no Phase70C write;
2. Phase70B unattainability alone does not automatically disengage a goal;
3. action failure, plan failure, or lack of progress cannot directly create Phase70C events;
4. `disengage_unattainable` requires a canonical same-character committed/suspended goal with prior committed Phase70B unattainability;
5. disengagement writes one deterministic immutable event and append-only history reference;
6. disengagement does not rewrite Phase68D goal history/state and does not create a Phase68D abandon event;
7. reengagement cannot target the same unattainable goal;
8. reengagement requires a prior committed Phase70C disengagement event;
9. reengagement target must be a distinct same-character committed goal that is neither achieved nor unattainable;
10. reengagement does not create/commit a new Phase68D goal and does not create/revise a Phase69 plan;
11. source goal remains terminally unattainable/disengaged after reengagement;
12. per-character event hash chain and append-only history are deterministic and queue-authoritative;
13. Phase62K rejects forged source/target hashes, stale resolver projection, duplicate events, and same-turn synthetic chaining;
14. world loop ordering is Phase69D -> Phase70A -> Phase70B -> Phase70C -> commit;
15. focused Phase70C tests pass;
16. scoped `memory_retrieval`, `cognition`, and `world_simulation` acceptance passes;
17. `git diff --check` passes before isolated commit/integration.
