# World Simulation Adaptive Replanning / Alternative Means Architecture — Phase71

## Status

Phase71 installs execution-backed adaptive replanning for a still-viable committed goal. It does not create goals, judge goal unattainability, disengage from goals, or search the world for an optimal plan.

The durable semantic boundary is:

- `Action Failed != Plan Failed`
- `Plan Failed != Goal Unattainable`
- `Same Goal + Different Means = Adaptive Replanning`
- `Replanning != New Goal Creation`
- `Alternative Means != Arbitrary World State Search`
- `Goal Unattainable != Replanning Candidate`
- `Goal Disengaged != Replanning Candidate`

## Research basis

Phase71 follows three convergent design lessons.

1. BDI / practical reasoning separates commitment to a goal from commitment to the currently selected means. A failed plan may be replaced by another applicable plan while the achievement goal remains in force. Intention reconsideration is therefore a policy boundary, not an implication of one failed action.
2. Automated plan-repair research distinguishes repairing/reusing an existing plan from replanning from scratch and treats plan stability as valuable. Phase71 consequently preserves the Phase69 plan lifecycle and replaces only the failed means.
3. Implementation-intention and goal-shielding research supports persistence toward a focal goal while adapting a failing course of action. Alternative means are not equivalent to switching goals.

## Placement

The cognition sequence is:

1. Phase69A initial implementation intention
2. Phase69B explicit implementation-intention revision
3. Phase69C cue activation
4. Phase69D execution feedback
5. Phase70A explicit goal-achievement verification
6. Phase70B explicit goal-unattainability verification
7. Phase70C explicit disengagement / alternative-goal reengagement
8. **Phase71 adaptive replanning / alternative means**
9. atomic world commit

The Phase71 resolver reads only the world state committed before the current turn. The Phase71 builder is applied to the Phase70C post-preview state before world commit. Consequently:

- a same-turn action failure cannot immediately trigger replanning;
- a same-turn Phase70A achievement, Phase70B unattainability, or Phase70C disengagement can still invalidate an otherwise prior-turn-eligible replan before persistence.

## Reconsideration gate

Phase71 v1 deliberately uses a conservative failure gate.

A source implementation intention is eligible only when all conditions hold:

- it belongs to the same character;
- its Phase69B effective state is `active` or `challenged`;
- it is not Phase69D `completed`;
- its Phase68D goal remains `committed`;
- the goal is not Phase70A achieved;
- the goal is not Phase70B unattainable;
- the goal is not Phase70C disengaged;
- the latest committed execution feedback for the plan is `failed`;
- at least the two latest plan-specific feedback events are consecutive `failed` events from distinct prior turn IDs.

A single failed action or a single `failed` Phase69D event is insufficient.

The trailing consecutive-failure rule is a deterministic anti-churn policy. `attempted`, `fulfilled`, or `completed` feedback breaks the failure streak. Once Phase71 replans a source plan, Phase69B `revise` supersedes that source identity; the replacement must accumulate its own later failure evidence before it can itself become a Phase71 source. This prevents repeated replanning of the same source on every turn without introducing probability or utility thresholds.

## Alternative-means candidate source

Phase71 does not scan raw World State and does not ask its choice resolver to invent arbitrary means.

Candidate generation and candidate choice are separate boundaries:

1. A programmatic bounded means provider receives a Phase71 source view containing only eligible same-character source plans, their prospective cue/response descriptors, bounded committed failure provenance, and a **bounded character-cognition means-grounding catalog**.
2. That grounding catalog is reconstructed only from already committed cognition belonging to the source character: the failed current implementation intention, other nonterminal represented means for the same goal, active structured-self-model `capability_appraisal` aspects, and active subjective beliefs.
3. Every provider candidate must cite one or more canonical `means_grounding_refs` from the catalog for its own `source_plan_ref`. Unknown, cross-source, or cross-character grounding refs are rejected.
4. `repair_existing_means` may remain grounded in the currently represented means, provided the replacement cue/response pair actually changes. `replace_means` must cite grounding beyond the repeatedly failed current means; the failed plan alone cannot license an invented replacement.
5. Phase71 canonicalizes every candidate into an opaque `candidate_ref` and `candidate_hash`, including its grounding refs and grounding kinds in the content address.
6. The choice resolver receives only that canonical candidate catalog and may return only `{ source_plan_ref, candidate_ref }` selections.
7. Phase62K revalidates candidate membership and then independently resolves every selected grounding back to committed cognition before persistence.

The grounding catalog is intentionally epistemic, not objective. An active subjective belief or capability appraisal may be mistaken because Phase71 models what the character can reasonably consider from its own represented cognition, not what an omniscient engine knows to be feasible. The catalog therefore does **not** turn beliefs or self-appraisals into world truth.

This surface does not expose raw world state, raw world events, memory stores, hidden retrieval graphs, executable action IDs, mutation paths, utility values, feasibility scores, success probabilities, or arbitrary engine IDs beyond durable provenance required for canonical revalidation.

The bounded provider is a candidate-generation interface, not a world-truth or capability oracle. Phase71 v1 claims that accepted means are grounded in committed same-character cognition and passed the bounded authority checks; it does not claim objective feasibility. Objective feasibility remains outside this layer.

## Durable representation

Phase71 persists:

- `goal_implementation_intention_adaptive_replanning_events`
- `goal_implementation_intention_adaptive_replanning_history`

Each event is immutable and content-hashed. History is append-only and maintains a per-character previous-event hash chain.

A Phase71 event records:

- source character and turn;
- source goal ID;
- source implementation-intention ID;
- canonical Phase69A/69B source provenance as copied from the resulting Phase69B `revise` event;
- at least two canonical trailing Phase69D failure references;
- canonical Phase71 source-plan ref;
- chosen alternative-means candidate ref/hash/kind;
- canonical `means_grounding_refs` and their grounding kinds;
- explicit flags that the candidate is character-cognition-grounded and bounded to the Phase71 grounding catalog;
- replacement cue/response descriptors;
- resulting Phase69B revision event ID/hash;
- replacement implementation-intention ID;
- Phase71 resolver-view hash;
- explicit boundary flags.

## Phase69B ownership

Phase71 does not invent a second plan lifecycle.

For each accepted Phase71 decision, it calls the existing Phase69B revision builder with operation `revise`. The Phase69B event remains authoritative for:

- superseding the source plan;
- creating the replacement plan identity;
- preserving the same `goal_id`;
- cue/response descriptor validation;
- append-only Phase69B history;
- per-character Phase69B hash-chain semantics.

Phase71 then records why that otherwise-normal Phase69B revision was permitted as execution-backed adaptive replanning.

The two mutation batches are executed sequentially before the final world commit:

1. Phase69B revision transitions use the existing `:goal_implementation_intention_revision` queue contract.
2. Phase71 provenance transitions use `:adaptive_replanning_alternative_means` and their own Phase62K validator.

This preserves the sealed Phase69B validator without widening its queue semantics.

## Phase62K authoritative revalidation

Phase62K independently verifies at both projection and execution time:

- Phase71 event write-once immutability and content hash;
- Phase71 history append-only prefix;
- per-character Phase71 previous-event hash chain;
- exact queue turn ID;
- canonical same-character Phase69B `revise` event provenance;
- exact source plan, same goal, replacement plan ID and replacement descriptors;
- canonical Phase69D failure event IDs/hashes;
- same-character/same-plan/same-goal failure provenance;
- at least two trailing committed failures from distinct prior turns;
- current source goal is still committed, not achieved, not unattainable, and not disengaged;
- source plan was not already adaptively replanned;
- exact source/candidate membership in the authoritative Phase71 resolver catalog;
- every selected grounding ref is a unique member of the selected source plan's bounded grounding catalog;
- grounding ref/hash content addressing;
- canonical Phase69A/69B represented-means provenance and nonterminal effective execution state for alternative represented means;
- canonical active Phase68B/68C capability-appraisal provenance;
- canonical active Phase66B subjective-belief provenance including its governing revision event;
- same-character and same-goal grounding boundaries;
- `replace_means` has grounding beyond the repeatedly failed current implementation intention;
- committed cognition is revalidated at Phase62K execution time instead of trusting a previously materialized context;
- boundary flags rejecting goal creation, goal mutation, disengagement, unattainability inference, world scanning, numeric optimization, and direct Character Brain durable writes.

## Explicit non-goals

Phase71 does not implement:

- new goal creation or commitment;
- Phase68D goal lifecycle mutation;
- automatic goal abandonment;
- Phase70B unattainability verification;
- Phase70C disengagement or alternative-goal reengagement;
- revival of an impossible goal;
- unrestricted search over World State;
- global planning from omniscient state;
- reinforcement learning;
- expected-utility maximization;
- success-probability or feasibility scoring;
- automatic replanning from one action failure;
- replanning every turn without new durable failure evidence.

## Determinism and replay

Candidate refs, replacement plan identities, Phase69B revision events, Phase71 events, history chains, validation contexts, and projections are content-addressed from canonical bounded inputs. Equivalent committed inputs and equivalent decisions therefore produce equivalent durable hashes. Historical Phase69D/69B/71 events are never rewritten during replay.
