# Phase68A Research Baseline — Self Narrative / Autobiographical Self-Interpretation Foundation

Status: Phase68A architecture and acceptance baseline.

Authoritative base HEAD: `4d38f7e0d3a5881d323e8eb53ee383180986b452`.

## 1. Scope

Phase68A begins the layer above Phase67 autobiographical organization. It answers a narrower question than a complete Self Model:

```text
Phase67E: What has this character autobiographically experienced/organized?
Phase68A: How does this character currently connect and interpret parts of that remembered life across time?
```

The target stack is:

```text
World Truth
!= Character Experience
!= Subjective Memory
!= Subjective Claim
!= Belief

Autobiographical Organization
!= Self Interpretation
!= Narrative Identity
!= Self Model
```

Phase68A does not implement stable traits, values, preferences, capability self-ratings, identity roles, motivation, autonomous goals, or future-oriented life purpose.

## 2. Research synthesis

### 2.1 Self-Memory System

The Self-Memory System literature separates autobiographical knowledge from self-related control/construction processes. The useful engineering lesson is that autobiographical evidence and current self-interpretation must remain distinct; interpretation is not a rewrite of source memory.

Reference: Conway & Pleydell-Pearce (2000), *The construction of autobiographical memories in the self-memory system*.

### 2.2 Autobiographical reasoning and self-event connections

Autobiographical reasoning explicitly links personal experiences to the self across time. A particularly useful minimal distinction is between connections that represent perceived continuity/stability and connections that represent perceived change. Related work also codes event-event links, causal/developmental links, and thematic coherence.

Longitudinal research shows that autobiographical reasoning and self-event connections exhibit both stability and change. Therefore an interpretation should never be a mutable last-write-wins identity field.

References:

- Pasupathi, Mansour, & Brubaker (2007), self-event connections / narrative identity.
- McLean & Pasupathi (2011), emergence and retention of personal meaning in autobiographical storytelling.
- Köber et al. / Habermas line of work on autobiographical reasoning, self-continuity, and biographical disruptions.
- McLean et al. (2021), *Stability and change in autobiographical reasoning: A 4-year longitudinal study of narrative identity development*.

### 2.3 Narrative identity

Narrative identity is broader than Phase68A. Full narrative identity normally includes a reconstructed past, present self, anticipated future, unity, and purpose. Phase68A therefore installs only an interpretation substrate and deliberately defers future-oriented purpose and motivational integration.

Reference: McAdams & McLean (2013), narrative identity.

### 2.4 Agent-memory comparison

Generative Agents, MemoryBank, A-MEM, and later reflective-memory agent systems support the general pattern that long-term agents benefit from higher-level reflection over accumulated experience. However Phase68A must reject the parts that conflict with this project's invariants:

- no unconstrained LLM-written life story as authoritative state;
- no mutable personality profile;
- no scalar importance/recency/relevance score as truth or identity authority;
- no hidden semantic graph traversal;
- no overwrite of original memories or autobiographical organization;
- no second retrieval engine.

The architecture instead follows the established Phase65–67 pattern:

```text
immutable evidence/history
+
explicit revision/supersession
+
deterministic effective projection
```

## 3. Core Phase68A decision

The durable primitive is not `SelfNarrative` and not a prose biography. It is:

```text
AutobiographicalSelfInterpretationEvent
```

Each event records one bounded, source-backed interpretation connection over same-character autobiographical evidence.

Phase68A v1 supports the following interpretation kinds:

```text
continuity
change
causal_connection
thematic_recurrence
contrast
```

These are interpretation relations, not trait/value declarations.

A Phase68A event may establish a new interpretation or explicitly supersede one or more prior active interpretations. Multiple unsuperseded interpretations may coexist.

This intentionally yields a minimal revision model:

```text
establish
supersede
```

No `coexist` mutation is needed because coexistence is the default result of multiple active interpretations. No implicit last-write-wins rule exists.

## 4. Source model

Phase68A may cite only canonical same-character Phase67 evidence:

```text
Phase67B Effective LifeEvent
Phase67C Effective Personal Semantic Memory
Phase67D Effective LifePeriod
```

Source anchors are engine-side typed references carrying canonical IDs plus source hashes. They are provenance, not Character-facing content.

A durable interpretation requires at least one current-turn Phase67B/C/D trigger. Prior same-character Phase67 evidence may be included as additional context/evidence so a new event can be connected to older autobiographical history.

If detailed episodic content is needed by future richer reasoning, it must be obtained through the existing Phase63/64 retrieval substrate. Phase68A does not scan raw memories as a second retrieval engine.

Phase68A never receives or validates against raw World Truth.

## 5. Structured interpretation descriptor

Phase68A v1 stores a constrained descriptor rather than freeform autobiography:

```text
interpretation_kind:
  continuity | change | causal_connection | thematic_recurrence | contrast

meaning:
  subject_ref: one source autobiographical anchor
  object_ref: optional second source autobiographical anchor
  qualifiers: bounded string list
```

The descriptor means only that the character currently interprets autobiographical evidence through that relation. It does not establish a trait, value, preference, role, capability rating, goal, or objective truth.

## 6. Durable model

Recommended state:

```text
autobiographical_self_interpretation_events

autobiographical_self_interpretation_history
```

Each `AutobiographicalSelfInterpretationEvent` is:

- immutable and write-once;
- deterministic in identity/hash;
- chained per character;
- pinned to an exact resolver-view hash;
- pinned to exact Phase67 source references/hashes;
- explicit about superseded interpretation IDs;
- subjective, not World Truth;
- not epistemic Belief;
- not a Self Model.

History is append-only. Phase62K remains the final authoritative mutation executor.

## 7. Effective projection

Replay produces:

```text
EffectiveAutobiographicalSelfInterpretationProjection
```

Replay semantics:

1. `establish` creates a new active interpretation.
2. `supersede` creates a new active interpretation and explicitly marks listed prior same-character active interpretations superseded.
3. Unmentioned prior interpretations remain active.
4. Multiple active interpretations are legal, including interpretations that are in tension.
5. Order is history/audit order, not truth precedence.

No numeric confidence or probability is produced.

## 8. Character-facing projection

During turn prepare, prior committed Phase68A state is projected to a bounded Character-facing DTO:

```text
cognition.self_interpretation_context
```

The DTO may expose only:

- interpretation kind;
- bounded qualifiers;
- a structural indication that the interpretation connects autobiographical material;
- active interpretation ordering for deterministic transport only.

It must not expose:

- engine IDs;
- hashes;
- provenance internals;
- source turn IDs;
- World Truth authority;
- confidence/probability;
- superseded internal history unless a later accepted design explicitly needs it.

Current-turn Phase68A writes are not visible to the Character Brain that produced the same turn. Same-turn contamination fails closed.

## 9. Resolver boundary

The optional programmatic hook is:

```text
autobiographicalSelfInterpretationResolver
```

It receives a detached, bounded resolver view containing:

- current-turn canonical Phase67 trigger anchors;
- available same-character structural autobiographical anchors;
- existing effective interpretations;
- supported interpretation kinds and operations;
- exact resolver-view hash.

It does not receive:

- raw World State;
- raw World Event;
- whole memory content;
- hidden retrieval graph;
- objective truth labels;
- trait/value/preference/role/capability/goal authority.

Missing resolver means no Phase68A durable interpretation is created.

## 10. Acceptance contract

Phase68A acceptance requires:

- shared mechanism, per-character independent state;
- same-character autobiographical evidence only;
- no World Truth oracle;
- no direct rewrite of Phase63–67 source records;
- no second retrieval engine;
- no hidden semantic graph;
- immutable write-once interpretation events;
- append-only interpretation history;
- explicit supersession only;
- no LWW self narrative;
- multiple active interpretations legal;
- no mandatory narrative coherence or forced conflict resolution;
- no numeric truth confidence/probability;
- no importance/salience score as interpretation authority;
- no automatic trait/value/preference/role/capability/motivation/goal inference;
- Character Brain has no direct durable-write authority;
- Phase62K remains authoritative final writer;
- deterministic replay and input immutability;
- bounded prior-turn Character-facing projection;
- no same-turn retroactive leakage;
- Phase65/66 belief authority remains separate;
- Phase67E remains an autobiographical read projection, not replaced by Phase68A.

## 11. Testing policy

Phase68A development and acceptance should use focused/scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

`affected` should not be used when global inputs such as `tests/run-all.mjs` would conservatively expand it to full `all` without additional information value.

Repository-wide `all` remains reserved for a major milestone or when scoped evidence is insufficient.
