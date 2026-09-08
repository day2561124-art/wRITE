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

## Phase73C — Belief-Grounded Means Reconsideration / Later-Turn Replanning

Phase73C closes the subjective-feasibility loop without turning every belief change into an eager replan.

Its question is:

> Has this character's own **already committed** belief state made the currently intended means sufficiently inapplicable, from the character's perspective, to justify reconsidering that means on a later turn?

### Research basis

The design follows BDI / AgentSpeak intention-reconsideration and plan-context lessons:

1. an agent should not reconsider an intention on every belief update, because excessive reconsideration destroys commitment and wastes progress;
2. an agent should reconsider when its own belief state makes the intended plan's applicability/context conditions no longer hold;
3. failure recovery and belief-triggered reconsideration are distinct but compatible reasons to reopen means choice;
4. the trigger must remain epistemic: the character's belief may be wrong, while objective executability remains Phase72's authority.

Phase73C therefore adds a second Phase71 eligibility basis rather than replacing Phase71's established repeated-failure route.

### Durable semantic linkage, not a second belief store

Phase73B's normalized decision retains machine-readable semantics such as:

- `assessment`;
- `target_means_ref`;
- `goal_id`;
- `implementation_intention_id`;
- `interpretation_ref`.

Phase65 then persists the ordinary subjective claim, while Phase66 owns whether that claim is currently active belief.

Phase73C persists only an immutable semantic linkage:

`Phase73B interpretation_ref <-> canonical Phase65 claim_event_id/hash`

in:

- `subjective_means_feasibility_linkage_events`;
- `subjective_means_feasibility_linkage_history`.

The linkage preserves task/means identity without copying belief commitment into a parallel database. It does not itself assert that the claim is currently believed.

Each linkage is content-addressed, append-only, chained per character, and pins:

- deterministic Phase73B interpretation identity;
- the canonical represented means ref;
- the canonical Phase65 claim hash/history membership;
- assessment and proposition lineage;
- the explicit fact that Phase66 remains belief authority.

### Trigger projection

The Phase73C trigger projector is read-only. For each linkage it requires the linked Phase65 claim to still appear as an **active effective Phase66 belief** for the same character.

A Phase71 reconsideration trigger is emitted only when the active assessment set for one `(character, goal, implementation intention)` is unambiguously:

- `perceived_blocked`.

The following do **not** automatically trigger:

- `uncertain` alone;
- `perceived_feasible`;
- blocked plus an active `uncertain` assessment;
- blocked plus an active `perceived_feasible` assessment.

Conflicting active assessments fail closed rather than causing eager replanning.

No natural-language proposition parser is used to guess plan identity or feasibility semantics.

### Temporal boundary

Only prior committed cognition may trigger Phase71.

Current-turn Phase73B interpretation, Phase65 claim, Phase66 belief revision, and Phase73C linkage may all be persisted during resolve, but Phase71 continues to build its eligibility catalog from `snapshot.state` captured before the turn.

Therefore:

`Turn N visible evidence -> Turn N interpretation/belief/linkage commit -> Turn N+1 Phase73C trigger -> Phase71 reconsideration`

and never:

`Turn N interpretation -> Turn N immediate replan`.

### Phase71 dual eligibility

Phase71 now admits a source means when either:

1. the existing canonical repeated prior committed failure streak is present; **or**
2. Phase73C projects one canonical prior committed `committed_subjective_means_block` trigger.

The source records `eligibility_basis` as either:

- `repeated_committed_failure`; or
- `committed_subjective_means_block`.

If both are available, the established repeated-failure basis remains the deterministic first choice. This preserves existing Phase71 semantics while adding the new epistemic route.

For the subjective-block basis:

- failure evidence may be empty;
- the exact Phase73C trigger provenance is pinned;
- alternative-means candidates still require bounded character-owned cognition grounding;
- Phase69B still owns plan supersession/replacement identity;
- goal commitment is preserved;
- Phase71 still cannot assert objective feasibility.

### Authoritative validation

Phase62K independently revalidates both layers.

For Phase73C linkage writes it verifies:

1. authoritative validation-context hash;
2. deterministic Phase73B interpretation identity;
3. canonical represented target means;
4. canonical Phase65 claim hash and history membership;
5. exact claim evidence correspondence;
6. immutable linkage-event content hash;
7. append-only linkage history and per-character chain;
8. no direct belief/plan/goal mutation and no same-turn replanning authority.

For Phase71 events using `committed_subjective_means_block`, Phase62K reruns the Phase73C trigger projection from authoritative committed state and requires exact same-character/same-goal/same-means trigger provenance. A forged trigger ref or caller-rehashed validation context is insufficient.

### End-to-end authority split

The completed loop is:

`Phase72 actual feasibility`
`-> Phase73A observable evidence`
`-> subjective memory`
`-> Phase73B subjective interpretation`
`-> Phase65 claim`
`-> Phase66 active belief`
`-> Phase73C later-turn reconsideration trigger`
`-> Phase71 alternative means`
`-> Phase69B plan revision`
`-> Phase72 objective validation of the replacement means`

Authority remains deliberately split:

- Phase72: actual executability;
- Phase73A: observer-scoped perceptual evidence;
- Phase73B: character interpretation proposal;
- Phase65/66: subjective claim/belief lifecycle;
- Phase73C: later-turn reconsideration eligibility only;
- Phase71: bounded alternative-means replanning;
- Phase69B: plan lifecycle mutation.

### Phase73C non-goals

Phase73C does not implement:

- world-truth synchronization of subjective belief;
- eager replanning on arbitrary belief change;
- uncertain-as-blocked coercion;
- numeric confidence, utility, or success-probability thresholds;
- natural-language parsing as plan-binding authority;
- a parallel perceived-feasibility belief store;
- direct goal abandonment/disengagement;
- direct plan mutation;
- same-turn cognition feedback;
- objective feasibility verification of replacement means;
- long-term self-efficacy or capability-learning dynamics.

## Follow-on

With Phase73A–73C complete, the immediate subjective-feasibility feedback loop is closed. Any subsequent phase should be selected from a fresh architecture review rather than extending Phase73 by default; plausible future topics include longer-horizon capability self-knowledge / self-efficacy learning and explicit skill/resource progression, but these are not part of Phase73C.
