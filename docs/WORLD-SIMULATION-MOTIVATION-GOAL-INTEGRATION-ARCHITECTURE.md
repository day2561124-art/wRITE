# Phase68D Research Baseline — Motivation / Goal Integration

Status: Phase68D architecture and acceptance baseline.

Authoritative base HEAD: `1a371c159bc27845b50e26971ff945ed91f945e0`.

## 1. Scope

Phase68D begins the motivational layer above committed autobiographical interpretation and structured self-model state.

```text
Phase68A: autobiographical self-interpretation
Phase68B: structured self-aspect formation
Phase68C: explicit self-model support/challenge/revision
Phase68D: motivation / goal integration
```

Phase68D answers:

```text
Given what this character currently represents about itself,
what candidate states of affairs matter enough to consider pursuing,
and which of those candidates become explicit committed goals?
```

It does not install a planner, action sequence generator, utility maximizer, global personality score, or World Truth oracle.

## 2. Research synthesis

### 2.1 Self-Determination Theory / self-concordance

Self-Determination Theory distinguishes autonomous from controlled motivation and treats autonomy, competence, and relatedness as separable motivational considerations. The self-concordance model further supports the engineering distinction between a goal being represented and a goal being personally endorsed in relation to the person's interests/values.

Engineering implication: goal motivation must cite subjective self-model/value evidence where available, but self-concordance is not a truth score and must not be collapsed into one scalar personality or utility value.

References: Ryan & Deci; Sheldon & Elliot.

### 2.2 Goal Systems Theory

Goal Systems Theory treats goals and means as a network in which one goal can have multiple means, one means can serve multiple goals, and goals can conflict.

Engineering implication: Phase68D must allow multiple candidate/committed goals and explicit conflicts. It must not enforce one globally coherent goal or last-write-wins motivation.

Reference: Kruglanski, Fishbach, Kopetz and later Goal Systems Theory work.

### 2.3 Rubicon model / BDI separation

The Rubicon model separates predecisional motivational deliberation from postdecisional volitional commitment and later planning/action. BDI architectures likewise distinguish desires/goals from intentions and plans.

Engineering implication:

```text
motivational candidate
!= committed goal
!= implementation plan
!= selected action
```

Phase68D stops at durable goal commitment. Concrete planning and action sequencing remain downstream.

## 3. Core Phase68D decision

The durable primitives are:

```text
MotivationalGoalEvent
MotivationalGoalHistory
```

Each event is one source-backed subjective goal-state transition for one character.

Supported v1 operations:

```text
propose
commit
suspend
abandon
```

Semantics:

- `propose`: create a goal candidate without commitment.
- `commit`: explicitly move a named same-character proposed goal to committed state.
- `suspend`: keep identity/history but mark a committed goal inactive for pursuit.
- `abandon`: terminally disengage a proposed/committed/suspended goal.

No implicit commitment and no LWW replacement exist.

## 4. Goal descriptor

A Phase68D goal is structured, not freeform life-purpose prose.

```text
goal_kind:
  achieve_state | maintain_state | avoid_state | restore_state

domain:
  bounded string

target_descriptor:
  bounded structured text fields

motivation_basis_refs:
  typed exact references to committed prior subjective state
```

A goal descriptor states only what the character subjectively wants to bring about/maintain/avoid/restore. It does not assert that the goal is rational, objectively beneficial, attainable, morally correct, or optimal.

## 5. Motivation basis

Phase68D may cite only committed same-character subjective evidence from existing layers:

```text
Phase66 effective subjective belief state
Phase68A active autobiographical self interpretations
Phase68B/68C effective structured self-model aspects
```

Current-turn source material may trigger deliberation only through bounded resolver views already produced by authoritative layers. Phase68D does not scan raw memories, raw World State, or a hidden semantic graph.

No second retrieval engine is installed.

## 6. Candidate vs commitment

The architecture preserves a strict distinction:

```text
proposed goal
!= committed goal
```

A proposed goal can coexist with contradictory proposed or committed goals. Commitment is an explicit durable operation, not a ranking side effect.

Phase68D does not require all committed goals to be mutually consistent. Goal conflict is represented, not automatically resolved.

## 7. Motivational relations

A goal may carry bounded, non-authoritative motivation relations:

```text
self_concordant_with
supports
conflicts_with
externally_prompted_by
```

These are provenance/relationship descriptors, not scalar strength values.

Phase68D v1 does not invent:

- numeric motivation strength;
- probability of success;
- expected utility;
- need-satisfaction score;
- global priority score;
- personality-driven utility function.

## 8. Durable model and replay

Recommended state:

```text
motivational_goal_events
motivational_goal_history
```

Each event is immutable/write-once, deterministic in identity/hash, chained per character, and append-only through history.

Replay produces:

```text
EffectiveMotivationalGoalProjection
```

with per-goal states:

```text
proposed
committed
suspended
abandoned
```

Explicit operations only may change state. Historical goal events remain immutable.

## 9. Character-facing projection

During turn prepare, only committed prior-turn motivational state is exposed in bounded form:

```text
cognition.goal_context
```

It may expose:

- goal kind/domain;
- bounded target descriptor;
- current state (`committed` / `suspended` where useful);
- bounded motivation relation labels.

It must not expose:

- engine IDs/hashes;
- raw provenance;
- hidden competing candidate graph;
- numeric utility/priority/probability;
- raw World Truth;
- future action plan.

Current-turn Phase68D writes are not visible to the Character Brain that produced that same turn.

## 10. Resolver boundary

Optional programmatic hook:

```text
motivationalGoalResolver
```

It receives a detached bounded resolver view containing:

- effective same-character prior committed self-model state;
- active autobiographical self interpretations;
- effective subjective beliefs needed for bounded motivational grounding;
- current proposed/committed/suspended goals;
- supported operations/kinds/relations;
- exact resolver-view hash.

It does not receive raw World State, raw event payloads, raw memory content, hidden retrieval graph, objective truth labels, numeric utility, or action-planning authority.

Missing resolver means no new Phase68D durable goal event.

## 11. Authoritative mutation boundary

Phase68D produces proposed chronological mutations only. Phase62K remains the sole final writer.

The chronological mutation executor must enforce:

- write-once goal events;
- append-only goal history;
- exact per-character hash chain;
- same-character source references;
- explicit legal state transitions;
- no duplicate same-character durable goal transition for the same goal in one turn;
- no historical rewrite.

## 12. Explicit non-goals

Phase68D does not implement:

- action planning / plan trees;
- implementation intentions;
- action selection;
- resource allocation scheduler;
- automatic goal completion detection;
- outcome evaluation / reinforcement learning;
- numeric expected utility;
- global goal ranking authority;
- forced motivational coherence;
- objective personality or value oracle;
- direct Character Brain durable writes.

These require later accepted architecture.

## 13. Acceptance contract

Phase68D acceptance requires:

- shared mechanism, per-character independent state;
- subjective motivation only, never World Truth authority;
- explicit proposed vs committed distinction;
- propose/commit/suspend/abandon legal transitions;
- immutable write-once goal events;
- append-only goal history;
- deterministic per-character replay;
- multiple concurrent goals allowed;
- contradictory goals may coexist;
- no implicit commitment;
- no LWW replacement;
- no numeric motivation/utility/confidence/probability authority;
- no raw memory/World State scan;
- no second retrieval engine;
- no hidden semantic graph;
- Phase66 belief authority remains separate;
- Phase68A/68B/68C source state remains immutable;
- Character Brain has no direct durable-write authority;
- Phase62K remains sole final writer;
- bounded committed-prior-turn Character-facing projection;
- no same-turn retroactive leakage;
- no action planner or selected-action authority.

## 14. Testing policy

Use scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`. Avoid `affected` when global runner/docs inputs would merely expand to full `all` without additional evidence value.
