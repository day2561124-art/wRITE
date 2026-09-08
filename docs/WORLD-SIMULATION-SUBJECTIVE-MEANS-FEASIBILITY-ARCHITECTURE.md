# Phase73A — Visible Constraint Observation / Subjective Feasibility Bridge

## Status

Phase73A installs an observer-scoped bridge from Phase72's explicit `character_visible_evidence_refs` into the existing bounded perception pipeline.

It does **not** make Phase72's engine-authoritative means-feasibility verdict itself part of character knowledge.

## Problem

Phase72 answers an engine-side question:

> Is this effective implementation intention currently executable, blocked, or indeterminate under bounded capability/resource/environment/permission evidence?

Phase72 deliberately preserves:

- World Truth != Character Knowledge
- Means Blocked != Goal Unattainable
- Means Blocked != Plan Abandoned
- Authorization Denied != Physically Impossible
- Indeterminate != Blocked

Before Phase73A, Phase72 could mark selected evidence as `character_visible_evidence_refs`, but no downstream cognition consumer existed. The engine could therefore know that a means was blocked while the character had no formal observation path through which to notice the underlying visible evidence.

## Design rule

Phase73A bridges **evidence, not verdicts**.

Allowed flow:

`Phase72 explicit visible evidence -> immutable Phase73A observation receipt -> next committed revision -> same-character bounded perception -> existing memory/current-mind/cognition pipeline`

Forbidden shortcuts:

- Phase72 `means_status` -> Character Brain
- Phase72 `physical_executability` -> Character Brain
- Phase72 `authorization_status` -> Character Brain
- hidden engine evidence -> Character Brain
- another character's evidence -> Character Brain
- Phase73A -> direct Subjective Memory write
- Phase73A -> direct Subjective Claim / Belief write
- Phase73A -> direct Current Mind write
- Phase73A -> same-turn Phase71 replanning

## Timing boundary

A Phase72 result produced while resolving state revision `R` creates Phase73A receipts with:

- `source_state_revision = R`
- `deliver_at_state_revision = R + 1`

Those receipts are committed atomically with the turn that advances the world to revision `R + 1`.

During preparation of the next turn, only receipts whose `deliver_at_state_revision` equals the currently committed revision are projected.

This prevents same-turn feedback:

1. Character chooses an action on revision `R`.
2. Phase72 evaluates feasibility later in that same resolve.
3. Phase73A records visible evidence for revision `R + 1`.
4. The character cannot consume it until a later prepare against the committed revision `R + 1`.

Failed speculative prepare/resolve attempts do not consume receipts because projection is read-only and delivery is keyed to committed state revision rather than wall-clock time.

## Observer scope

Every observation receipt belongs to exactly one character.

Phase73A requires the source evidence either:

- to have no explicit evidence owner; or
- to name the same character as the Phase72 source plan.

Explicit cross-character evidence is rejected.

Projection additionally filters by the requested character before returning any `other_senses` observations.

## Character-facing payload

The character receives a bounded evidence payload such as an experienced action outcome or a visible causal transition.

The bridge strips engine/private metadata, including:

- engine/internal IDs
- world-state patches
- mutation paths
- hidden retrieval data
- Phase72 derived feasibility fields
- constraint checks/status
- authoritative catalog hashes
- resolver/context hashes

The projected observation carries these semantic guards:

- `world_truth_authority = false`
- `subjective_interpretation_required = true`
- `actual_means_feasibility_verdict_exposed = false`

Therefore an objective condition like “the exterior surface cannot support climbing” may become a character-facing observation of a failed grip/slip, while the later subjective systems remain free to form an uncertain or even incorrect interpretation.

## Durable state

Phase73A adds:

- `visible_constraint_observation_events`
- `visible_constraint_observation_history`

Observation events are immutable and content-addressed.

History is append-only and chained per character through:

- `previous_observation_event_id`
- `previous_observation_event_hash`

A `(character, source_means_feasibility_event_id, source_evidence_ref)` tuple may create at most one durable receipt.

## Authoritative validation

Phase62K remains the sole final state writer.

The authoritative mutation queue revalidates Phase73A instead of trusting producer output. It verifies:

1. the Phase73A validation context hash;
2. the embedded Phase72 authoritative validation context hash;
3. the source Phase72 event schema/version/hash;
4. membership of that Phase72 event in canonical Phase72 history;
5. membership of the evidence ref in the source event's explicit visible subset;
6. evidence hash and evidence-character ownership;
7. exact recomputation of the character-facing payload from canonical evidence;
8. next-revision timing;
9. observation-event content hash;
10. append-only history and per-character hash chain.

This prevents forged receipts from smuggling hidden feasibility verdicts or unrelated world facts into cognition.

## Integration with existing cognition

Phase73A does not create a parallel subjective cognition system.

During `prepareWorldSimulationTurn`, the projected observations are appended to `characterPerception.other_senses` **before** memory accessibility/retrieval, Current Mind preparation, Character Cognition, and action proposal.

Existing systems therefore continue to own interpretation and persistence:

`perception -> memory accessibility/retrieval -> Current Mind -> cognition -> subjective memory -> subjective claims -> belief resolution/revision`

Phase73A itself remains observational only.

## Non-goals

Phase73A does not implement:

- Phase73B subjective constraint belief formation policy
- automatic belief creation
- automatic plan abandonment
- automatic goal unattainability
- automatic goal disengagement
- same-turn alternative-means generation
- same-turn replanning
- utility/probability scoring
- a complete skill/stat/resource progression system

## Follow-on

Phase73B may explicitly study how these observations become subjective constraint interpretations through the already-existing memory/claim/belief architecture.

Phase73C may then allow later-turn Phase71 replanning to consume that character-owned subjective awareness, closing the loop without same-turn cognition churn.
