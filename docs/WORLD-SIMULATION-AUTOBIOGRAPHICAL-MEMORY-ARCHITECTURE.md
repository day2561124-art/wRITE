# Phase67 Research Baseline — Character Autobiographical Memory / Life History Organization

Status: architecture planning baseline. This document does not modify production cognition behavior.

Authoritative base HEAD: `c04955dfe5bb138729a55c4e41b2096ded1fd22b`.

## 1. Scope

Phase67 extends the existing Character Runtime / Cognition substrate so that durable subjective episodic memories can be organized into a character-specific life history without replacing Phase63–66.

The target conceptual stack is:

```text
World Truth
!= Character Experience
!= Subjective Memory
!= Subjective Claim
!= Belief

Subjective Memory
-> Subjective Episode Organization
-> Life Event Organization
-> Personal Semantic Memory
-> Life Period Organization
-> Autobiographical Summary
-> future Self Narrative / Self Model
```

The architecture mechanism is shared, but all organization state is per-character.

## 2. Existing substrate that must be reused

Phase63A already provides atomic durable per-character subjective memories under `memories.<character>` and deliberately keeps memory content bounded to character perception.

It also already provides an explicit `subjective_episode_id` binding substrate while explicitly forbidding automatic promotion of `event_id`, `turn_id`, or `scene_id` into subjective episode identity.

Therefore Phase67 must not create a second episodic-memory store or copy Phase63 memory content into larger blobs.

Phase63B/63C and Phase64 already provide cue-dependent retrieval, multi-step retrieval, frozen subjective memory snapshots, retrieval history, internally reinstated cues, retrieval competition/search-control evidence, and supported cue kinds including `subjective_episode`, `entity`, `semantic`, `temporal`, `task`, and `goal`.

Phase65/66 already own subjective claims, conflict/revision evidence, effective belief projection, bounded Character-facing belief ingress, and native chronology semantics.

## 3. Research synthesis

### 3.1 Event segmentation

Event Segmentation Theory and related event-cognition work support treating continuous experience as a sequence of events at multiple temporal scales. Event boundaries are associated with changes in predictive/event models rather than with engine scheduling identities alone. Later work also argues that internal-state changes such as goal, motivational, and affective transitions can contribute to event boundaries.

Engineering consequence:

- no `world event == subjective episode` shortcut;
- no universal scene-change-only boundary rule;
- segmentation evidence should be compositional and character-bounded;
- external/perceptual context change and future internal cognition-state change may both contribute;
- v1 must operate only on signals actually materialized in current Character Runtime state.

Primary references:

- Zacks et al. (2007), *Event perception: a mind-brain perspective*, DOI 10.1037/0033-2909.133.2.273.
- Kurby & Zacks (2008), *Segmentation in the perception and memory of events*, DOI 10.1016/j.tics.2007.11.004.
- Radvansky & Zacks (2017), *Event Boundaries in Memory and Cognition*, DOI 10.1016/j.cobeha.2017.08.006.
- recent integrative review of external and internal event-boundary determinants, PMID 37698807.

### 3.2 Hierarchical autobiographical organization

The Self-Memory System literature describes autobiographical knowledge at different levels of specificity, commonly including event-specific knowledge, general events, lifetime periods, and broader life-story organization. General events may represent repeated events or extended event sequences; lifetime periods provide broad temporal/thematic organization.

Engineering consequence:

- Phase63 atomic memories correspond most closely to event-specific evidence, but one subjective episode may contain multiple atomic traces;
- `LifeEvent` should be an organizational node above subjective episodes, not a replacement memory record;
- `LifePeriod` should organize multiple life events through temporal/thematic relations;
- higher layers should primarily contain references, derived labels, bounds, and provenance rather than duplicated perceptual content.

References:

- Conway & Pleydell-Pearce (2000), Self-Memory System model.
- later reviews describing lifetime periods / general events / event-specific knowledge hierarchy.

### 3.3 Personal semantic memory

Personal semantic memory occupies an important middle ground between specific episodic recollection and general impersonal semantic knowledge. Research distinguishes knowledge about one's own past, autobiographical facts, roles/traits, recurring routines, and other personally grounded semantic material from a single episodic event.

Engineering consequence:

`PersonalSemanticMemory` must be distinct from Phase65/66 Belief.

Personal semantic memory answers questions such as:

```text
What recurring pattern or autobiographical fact has my remembered life established?
What roles, relationships, routines, places, or repeated self-history are represented across my memories?
```

Belief answers a different question:

```text
Which subjective claim(s) do I currently epistemically accept, reject, preserve, or revise?
```

A personal-semantic record is therefore autobiographical organization/abstraction with source-memory provenance. It is not a truth oracle, confidence score, or generic proposition store.

References:

- Renoult et al. (2012), *Personal semantics: at the crossroads of semantic and episodic memory*, DOI 10.1016/j.tics.2012.09.003.
- Grilli & Verfaellie (2014), personal semantic memory and autobiographical facts, PMID 24949553.

### 3.4 Cognitive-agent architecture comparison

Soar separates episodic memory (temporally contextualized agent experience) from semantic memory (decontextualized long-term declarative knowledge), while keeping retrieval mediated through working-memory structures. This separation is useful as an architectural analogy but must not be copied literally because this project already has Phase63/64 retrieval semantics and Phase65/66 epistemic semantics.

Generative Agents demonstrates a practical agent pattern of maintaining an experience stream, retrieving memories dynamically, and synthesizing higher-level reflections. The useful lesson is the value of higher-level derived structures; the project should not copy its natural-language memory stream, LLM-authored reflection authority, or scalar importance/recency/relevance scoring because those would violate existing deterministic/replayable and authoritative-mutation boundaries.

References:

- Soar episodic-memory and semantic-memory architecture documentation.
- Park et al. (2023), *Generative Agents: Interactive Simulacra of Human Behavior*, arXiv:2304.03442 / UIST 2023.

## 4. Core architecture decision: evidence log + replayable projections

Phase67 should follow the strongest Phase65/66 pattern:

```text
immutable organization evidence/history
+
replayable effective projection
```

rather than mutable last-write-wins autobiography objects.

### Why not purely derived segmentation?

If episode membership is recomputed from today's rules every time, old autobiographical organization can silently change when implementation or later context changes. That damages historical semantics and makes replay/audit weak.

### Why not only mutable durable episodes?

A mutable episode object makes split/merge/reclassification history disappear and encourages LWW semantics.

### Chosen model

Use immutable per-character organization events as historical evidence, then build effective episode/life-event/life-period projections by replay.

Possible evidence families:

```text
SubjectiveEpisodeSegmentationEvent
AutobiographicalLifeEventOrganizationEvent
PersonalSemanticDerivationEvent
AutobiographicalLifePeriodOrganizationEvent
```

Effective derived/read projections may include:

```text
EffectiveSubjectiveEpisodeIndex
EffectiveLifeEventIndex
EffectivePersonalSemanticMemory
EffectiveLifePeriodIndex
AutobiographicalSummaryProjection
```

Every event must be deterministic, character-scoped, replayable, and source-backed.

## 5. Phase67A — Automatic Subjective Episode Segmentation

Recommended first implementation phase.

### 5.1 Boundary

Input may include only already-committed or currently bounded character-specific material needed to resolve the current segmentation decision.

No raw World Truth and no hidden scene/object state may be used as autobiographical content.

Engine provenance may be used internally to preserve chronology/audit, but may not become Character-visible remembered content.

### 5.2 v1 segmentation evidence

Do not invent one magic numeric prediction-error threshold.

Build explicit deterministic evidence categories such as:

```text
first_memory_for_character
existing_open_episode
spatial_context_continuity_or_change
perceptual_context_continuity_or_change
temporal_continuity_or_gap
explicit_task_or_goal_continuity_or_change (only when already materialized)
committed_action/outcome continuity when character-bounded
manual/programmatic explicit boundary evidence when present
```

The resolver produces an explicit outcome:

```text
continue_episode
start_new_episode
insufficient_evidence
```

`insufficient_evidence` must not silently invent a boundary. Compatibility policy for v1 can preserve the current open episode when legal; if there is no open episode, the first encodable trace creates one.

### 5.3 Episode identity

A subjective episode ID must be server/programmatically derived from character identity plus segmentation lineage, never copied from `event_id`, `turn_id`, or `scene_id`.

Episode membership should reference Phase63 `memory_id` values instead of copying memory content.

### 5.4 Persistence model

Persist immutable segmentation events/history through the existing authoritative chronological mutation boundary.

Effective episode membership is replayed from history.

Existing Phase63 memory records remain immutable with respect to automatic organization. Do not retroactively rewrite atomic memory content.

Explicit Phase63 `episodic_binding` remains valid evidence and should take precedence where it is already present; Phase67A must not rewrite it.

## 6. Phase67B — Life Event Organization

A `LifeEvent` is a higher-level autobiographical organization node over one or more subjective episodes.

It is not synonymous with World Event.

Recommended semantics:

```text
LifeEvent
  life_event_id
  character
  member_subjective_episode_refs[]
  temporal_bounds
  thematic_cue_refs[]
  entity_cue_refs[]
  source_organization_event_refs[]
  open_or_closed_projection_state
```

Do not duplicate underlying episodic content.

Support append-only organization evidence such as attach, detach-by-revision, merge, split, close, reopen-by-new-event, and supersede-organization events only when actually needed. Initial implementation should prefer a minimal attach/close model and defer complex split/merge until evidence requires it.

## 7. Phase67C — Personal Semantic Memory

Personal semantic memory should be derived only from same-character subjective autobiographical evidence.

Potential v1 categories:

```text
autobiographical_fact
repeated_routine
recurring_relationship_pattern
recurring_place_or_context
role_history
self_history_pattern
```

Every derived item must preserve source episode/life-event/memory references and an immutable derivation event.

Do not assign numeric confidence/probability as truth semantics.

Do not silently collapse contradictory personal-semantic candidates.

If a proposition requires epistemic acceptance/rejection, hand that question to the existing Phase65/66 claim/belief substrate rather than turning personal semantic memory into a second belief engine.

## 8. Phase67D — Life Period Organization

Life periods organize multiple life events into broad temporally/thematically coherent intervals.

They should be replayable projections over immutable organization evidence.

A life period may be open-ended.

Initial boundaries should be grounded in materialized autobiographical cues such as persistent context, role, activity, goal, or relationship patterns. Avoid cultural life-stage assumptions unless such knowledge is actually available to the character/system configuration.

Examples of structural forms, not hard-coded semantics:

```text
"first semester at the academy"
"period living in dormitory X"
"time training with person Y"
```

## 9. Phase67E — Bounded Autobiographical Summary / Character Read Projection

Phase67E is a read-only reconstruction layer over already committed Phase67B/C/D autobiographical organization. It does **not** create a new durable summary memory, summary event history, belief, narrative identity, or Self Model.

The v1 shape is deliberately two-layered:

```text
Phase67B Effective LifeEvents
+
Phase67C Effective Personal Semantics
+
Phase67D Effective LifePeriods
        |
        v
Engine-owned reconstructable autobiographical summary projection
        |
        v
Consumer-specific bounded Character-facing autobiographical DTO
```

The engine projection may retain exact source IDs/hashes and drill-down references for replay/audit. The Character-facing DTO strips those engine identities and exposes only already materialized autobiographical structure such as:

```text
LifePeriod description / qualifiers / open-or-closed state
linked Personal Semantic category / predicate / object / qualifiers
Personal Semantic supported-or-contested state
```

Phase67E does not generate a freeform prose life story. In particular it must not infer or author:

```text
trait
role identity
value
preference
life meaning
narrative identity
Self Model
new semantic propositions
```

`contested` Phase67C personal semantics may be exposed as contested autobiographical knowledge, but Phase67E may not resolve the disagreement. Epistemic acceptance/rejection remains owned by Phase65/66.

Character-facing projection is bounded by transport limits. v1 may prefer open LifePeriods and then use source-history recency for deterministic transport, but this ordering is explicitly **not** psychological importance, salience, credibility, or truth ranking. No importance/salience score is invented.

The projection is reconstructable and hashable from source histories. A future performance cache is legal only as a disposable optimization carrying at least:

```text
projection_version
character
input_history_hash
source_projection_hashes
summary_hash
```

A cache mismatch must trigger reconstruction rather than LWW reuse.

Phase67E runs during prepare from committed prior-turn state, before same-turn Phase67A-D writes. If same-turn autobiographical organization is already present for the character, the Character-facing projection must fail closed rather than leak retroactive cognition into the Character Brain decision.

Phase67E has no durable world-state mutation and therefore adds no Phase62K mutation path. It also adds no second retrieval engine: detailed episodic drill-down remains owned by the existing Phase63/64 retrieval substrate.

## 10. Error memory, belief revision, and narrative revision

Autobiographical organization is organization of remembered life, not verification of World Truth.

Therefore:

```text
possibly_incorrect memory
still remains a memory

belief revision
must not rewrite the original memory

new evidence
may revise the character's interpretation
without deleting the historical episode
```

A later autobiographical summary may annotate that an older interpretation is contested or superseded, but the underlying memory/episode/history remains replayable.

Recommended relation:

```text
memory history = what was encoded/recalled
belief history = what the character epistemically accepted/revised
autobiographical organization = how remembered life is grouped and summarized
```

The three may reference each other but none owns the other's authority.

## 11. Retrieval integration: reuse Phase63/64, do not build a new search engine

Phase67 should materialize autobiographical organization as additional grounded cue relations for the existing retrieval substrate.

Examples:

```text
memory_id -> subjective_episode cue
memory_id -> life_event-derived semantic/entity/temporal cue
memory_id -> life_period-derived temporal/semantic cue
personal semantic record -> materialized semantic cue source
```

Prefer a read-only organization-cue projection passed into Phase63B/63C/64 rather than retroactively editing old Phase63 memory records.

The existing supported cue kinds already cover most required channels:

```text
subjective_episode
entity
semantic
temporal
task
goal
internally_reinstated
```

Phase64 currently forbids free hidden semantic graph traversal. Phase67C may later provide the missing separately materialized semantic-access source, but semantic association must remain explicit/provenanced and must not become an invisible graph oracle.

## 12. Growth and scalability policy

The architecture must separate durable evidence growth from active cognition/context growth.

Do not solve growth by deleting source memories or silently rewriting history.

Use:

1. compact organization nodes containing references rather than copied episodic content;
2. per-character indexes keyed by episode/life-event/life-period IDs;
3. closed vs open organizational units so only a small active frontier is recomputed each turn;
4. bounded Character-facing projections;
5. retrieval-driven drill-down through Phase63/64 rather than preloading a whole biography;
6. deterministic replay checkpoints/caches for derived indexes if performance later requires them;
7. eventual consolidation/semanticization as a separately accepted phase rather than hidden loss of detail.

Raw memory storage remains append-oriented under the current baseline; storage-tier archival or physical deletion is not part of Phase67.

## 13. Formal phase recommendation

Recommended numbering:

```text
Phase67A — Automatic Subjective Episode Segmentation
Phase67B — Autobiographical Life Event Organization
Phase67C — Personal Semantic Memory
Phase67D — Life Period Organization
Phase67E — Bounded Autobiographical Summary / Character Read Projection
```

Future work, explicitly outside Phase67:

```text
Phase68+ — Self Narrative / Self Model / motivation-goal integration
Consolidation / reconsolidation / semanticization mechanics that transform trace availability
Cultural life-script modeling
Narrative identity generation
```

## 14. Acceptance invariants for all Phase67 subphases

- shared architecture, per-character independent autobiographical state;
- same-character evidence only;
- no World Truth oracle;
- no raw World State promoted to autobiographical content;
- Phase63 atomic memory records remain authoritative episodic source evidence;
- no second retrieval engine;
- no Character Brain direct durable-write authority;
- immutable history + replayable effective projections for revisable organization;
- no LWW autobiography semantics;
- no numeric confidence/probability as truth semantics;
- no current-turn retroactive Character Brain leakage;
- final durable mutation remains behind the authoritative chronological mutation executor / Phase62K boundary;
- deterministic replay and input immutability required;
- focused/scoped regression preferred; repository-wide `all` is not a default gate.
