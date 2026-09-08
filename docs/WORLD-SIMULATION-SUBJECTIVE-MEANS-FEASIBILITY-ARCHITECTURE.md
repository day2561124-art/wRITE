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

## Phase73B — Subjective Means Feasibility Interpretation / Constraint Belief Formation

Phase73B installs the interpretation policy that Phase73A intentionally deferred.

Its question is not whether the means is objectively executable. Phase72 already owns that authority. Phase73B asks:

> Given what this character actually perceived, remembers, and currently believes about themself, how does this character interpret the feasibility of a currently represented means?

### Research basis

The policy follows four external architecture lessons:

1. BDI / AgentSpeak plan applicability is evaluated against the agent's current belief base rather than omniscient world truth.
2. Epistemic planning treats observation and belief revision as distinct from the hidden underlying world state.
3. Self-efficacy is a task- and situation-specific perceived capability judgment that may disagree with actual capability.
4. Metacognitive confidence can diverge from objective performance, so uncertainty must remain representable instead of being collapsed into a truth verdict.

### Bounded input surface

A Phase73B interpreter receives only characters that have a **current-turn newly formed subjective memory** whose content retains the Phase73A semantic guards:

- `modality = constraint_related`
- `source = character_visible_world_evidence`
- `subjective_interpretation_required = true`
- `world_truth_authority = false`
- `actual_means_feasibility_verdict_exposed = false`

For that same character it may additionally receive bounded character-owned cognition:

- currently represented, nonterminal implementation intentions;
- active `capability_appraisal` self-model aspects;
- active subjective beliefs.

Eligibility is pinned engine-side to the exact Phase73A observation contents projected during `prepareWorldSimulationTurn`. The prepare result retains only content hashes for this lineage check; Phase73B requires the new subjective memory's current-turn direct-perception provenance and content hash to match that same-character catalog. A generic `other_senses` item that merely copies the Phase73A semantic flags is therefore insufficient. The hash catalog itself is not forwarded to the interpreter.

It does not receive:

- raw World State;
- Phase72 `means_status`;
- Phase72 `physical_executability`;
- Phase72 `authorization_status`;
- hidden Phase72 evidence;
- the authoritative Phase73A source-means binding;
- another character's memories, beliefs, self-model, or plans.

The source-means binding remains deliberately hidden. A character must interpret its perception against the means it actually represents; the engine may not tell it which plan the authoritative Phase72 evidence originally belonged to.

### Subjective assessment vocabulary

Phase73B permits three bounded interpretation labels for audit/policy purposes:

- `perceived_feasible`
- `perceived_blocked`
- `uncertain`

These labels are **not** world-truth values and are not persisted as a second belief database. A character may therefore perceive an apparent failure yet still interpret the means as feasible, or may perceive ambiguous evidence and remain uncertain.

No numeric confidence, success probability, or objective-feasibility score is introduced in Phase73B v1.

### Output authority

The interpreter may emit only an ordinary Phase65-compatible claim proposal:

- `proposal_ref`
- `character`
- `proposition`
- supporting current-turn subjective-memory refs

Phase73B does not create a new durable event store. The normal cognition stack remains authoritative:

`Phase73B interpretation -> Phase65 SubjectiveClaimEvent -> Phase65B conflict relation -> Phase65D resolution -> Phase66 belief revision`

Missing interpreter output means **no automatic constraint belief**. Perception never auto-promotes itself into belief.

### Temporal boundary

Phase73B runs in the cognition pipeline after current-turn subjective memory formation and before ordinary Phase65 claim persistence.

The resulting claim/belief is still unavailable to same-turn Phase71. Phase71 continues to resolve from the prior committed `snapshot.state`, so Phase73B cannot retroactively trigger same-turn replanning.

This preserves the intended loop:

`Turn N observation -> Turn N subjective interpretation/claim commit -> Turn N+1 character-owned awareness -> later reconsideration`

## Updated non-goals

Phase73B still does not implement:

- direct World Truth -> belief promotion;
- a parallel perceived-feasibility belief store;
- automatic truth synchronization with Phase72;
- numeric self-efficacy/confidence scoring;
- automatic goal or plan mutation;
- same-turn Phase71 replanning;
- Phase73C belief-grounded reconsideration trigger;
- a complete skill/stat/resource progression system.

## Follow-on

Phase73C may allow later-turn Phase71 reconsideration eligibility to consume character-owned committed subjective awareness while preserving Phase71's existing bounded candidate-generation and Phase69B plan-revision authority.
