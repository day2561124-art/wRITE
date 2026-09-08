# World Simulation Means Feasibility / Capability-Affordance Architecture — Phase72

## Status

Phase72 installs engine-authoritative, bounded executability validation for an already represented implementation intention. It does not choose goals, invent alternative means, mutate the Phase69 plan lifecycle, or infer goal unattainability.

The durable semantic boundary is:

- `Means Feasibility != Goal Desirability`
- `Means Blocked != Plan Abandoned`
- `Means Blocked != Goal Unattainable`
- `Means Feasibility Validation != Alternative-Means Generation`
- `World Truth != Character Knowledge`
- `Authorization Denied != Physically Impossible`
- `Indeterminate != Blocked`

## Research basis

Phase72 follows four convergent design lessons.

1. STRIPS/PDDL planning separates action selection from action applicability: an action is executable only when its preconditions hold in the current state. PDDL2.1 extends this model to numeric/resource conditions. Phase72 consequently treats capability/resource/environment/permission conditions as execution constraints, not utility or success-probability scores.
2. BDI systems distinguish commitment to a goal from applicability of the current plan/action. Failure of one means may lead to another applicable plan while goal commitment survives. Phase72 therefore never converts a blocked means directly into goal unattainability or disengagement.
3. Affordance research treats action possibility as a relation among agent capability, environment, and current situation/task, rather than as a static object property. Phase72 therefore models typed constraint evidence instead of a single universal capability flag.
4. Epistemic and partially observable planning distinguish observer/world truth from an agent's internal information state. Phase72 may use engine-authoritative evidence to validate executability, but hidden engine evidence is not automatically written into character belief, memory, or Current Mind.

## Placement

The cognition sequence is:

1. Phase69D execution feedback
2. Phase70A goal achievement verification
3. Phase70B goal unattainability verification
4. Phase70C disengagement / alternative-goal reengagement
5. Phase71 same-goal adaptive replanning / alternative means
6. **Phase72 means feasibility / capability-affordance validation**
7. atomic world commit

Phase72 evaluates the effective post-Phase71 plan state. A replacement implementation intention created by Phase71 can therefore appear as a Phase72 source in the same turn, but same-turn Phase72 blockage does not retroactively trigger another Phase71 replan. Its evidence becomes durable only at the final world commit and can inform later cognition without creating same-turn plan churn.

## Source-plan eligibility

A Phase72 source must be a canonical Phase69A/69B implementation intention whose effective Phase69D execution projection is still `active` or `challenged`, is not completed, and whose same-character goal remains committed, viable, achieved=false, unattainable=false, and disengaged=false.

The source catalog is content-addressed from:

- character;
- goal ID;
- implementation-intention ID;
- canonical Phase69A/69B source event ID/hash;
- current cue/response descriptors;
- effective plan state/execution state;
- effective plan projection hash.

Phase72 does not inspect abandoned, superseded, suspended, completed, achieved, unattainable, or disengaged plans as executable current means.

## Authoritative evidence catalog

Phase72 does not expose raw World State to an evaluator. Instead, the service receives a bounded current-turn engine evidence surface and canonicalizes at most 64 entries from:

- selected action intents;
- authoritative action outcomes;
- authoritative causal state transitions.

Each entry is sanitized, content-hashed, assigned an opaque evidence ref, and optionally associated with a character when the engine evidence explicitly identifies one. Evidence explicitly belonging to another character cannot justify a source plan's constraint check. Global/environmental evidence without a character owner may be used where appropriate.

The catalog is evidence about this turn, not a global planner search space. Phase72 does not enumerate arbitrary world objects, hidden memory, future actions, or alternative plans.

## Constraint model

Phase72 v1 supports four execution-constraint kinds:

- `capability`
- `resource`
- `environment`
- `permission`

Each check has one status:

- `satisfied`
- `unsatisfied`
- `unknown`

A satisfied or unsatisfied check must cite canonical current-turn authoritative evidence. An unknown check may have no evidence when the engine cannot establish either outcome.

The evaluator also states whether its declared constraint coverage is complete. This is not a probability estimate; it is an explicit authority boundary for whether the current bounded check set is sufficient to claim executability.

Derived statuses are deterministic:

- `means_status = blocked` when any required check is unsatisfied;
- `means_status = feasible` only when coverage is complete, every check is known and satisfied, and physical executability is no longer indeterminate;
- otherwise `means_status = indeterminate`.

Physical executability is derived independently from capability/resource/environment checks:

- any unsatisfied physical check -> `blocked`;
- any unknown physical check, or no physical check -> `indeterminate`;
- otherwise -> `executable`.

Authorization is derived independently from permission checks:

- any unsatisfied permission check -> `denied`;
- any unknown permission check -> `indeterminate`;
- all present permission checks satisfied -> `authorized`;
- no permission check -> `not_applicable`.

This preserves the important distinction that an action may be physically executable while institutionally unauthorized.

## World truth and character visibility

Phase72 persists engine-authoritative constraint evidence but does not create subjective beliefs.

An evaluator may select a bounded `character_visible_evidence_refs` subset from evidence actually used by the accepted checks. This field means only that the corresponding engine evidence is eligible for downstream character-facing exposure. Phase72 itself does not write:

- subjective memory;
- subjective claims;
- subjective beliefs;
- Current Mind;
- Character Brain durable state.

Evidence that is not explicitly selected as character-visible remains engine-only. Therefore an engine may know why a means is blocked without granting that knowledge to the character.

## Durable representation

Phase72 persists:

- `goal_implementation_intention_means_feasibility_events`
- `goal_implementation_intention_means_feasibility_history`

Each event is immutable and content-hashed. History is append-only and maintains a per-character previous-event hash chain. The same plan may be evaluated again on a later turn because environment, resources, capability state, and authorization can change; only duplicate evaluation of the same character/plan within one turn is rejected.

A Phase72 event records:

- source character/turn/goal/implementation intention;
- canonical Phase69A/69B source provenance;
- source plan ref and projection hash;
- canonical typed constraint checks;
- deterministic means/physical/authorization statuses;
- explicit coverage-complete flag;
- authoritative evidence-catalog hash;
- bounded character-visible evidence refs;
- resolver-view hash;
- previous Phase72 event ID/hash;
- explicit semantic-boundary flags.

## Phase62K authoritative revalidation

Phase62K independently verifies in both projection and execution paths:

- event write-once immutability and content hash;
- exact `:means_feasibility_capability_affordance` queue turn;
- canonical active same-character Phase69A/69B plan provenance;
- same-character committed viable engaged goal;
- source membership in the authoritative Phase72 resolver catalog;
- authoritative evidence context hash and content-addressed evidence refs;
- no explicitly cross-character evidence use;
- typed constraint kind/status and canonical ordering;
- required evidence for satisfied/unsatisfied checks;
- deterministic recomputation of means/physical/authorization statuses;
- character-visible refs are a subset of evidence actually used by checks;
- per-character previous-event hash chain;
- at most one event per character/plan/turn;
- history append-only semantics;
- no goal mutation, Phase69B mutation, alternative-means creation, numeric scoring, or Character Brain durable writes.

## Explicit non-goals

Phase72 does not implement:

- alternative-means generation or selection;
- Phase71 adaptive replanning;
- automatic Phase69B revise/abandon/suspend;
- goal achievement;
- goal unattainability;
- goal disengagement/reengagement;
- expected-utility optimization;
- success-probability or feasibility scoring;
- reinforcement learning;
- unrestricted World State search;
- automatic conversion of engine truth into character knowledge;
- a complete skill/stat/resource progression system.

## Determinism and replay

Source refs, evidence refs, constraint checks, event identities, validation contexts, and projections are content-addressed from canonical bounded inputs. Equivalent inputs and decisions produce equivalent durable hashes. Historical Phase72 events are never rewritten; later evaluations append new evidence under the then-current world lineage.
