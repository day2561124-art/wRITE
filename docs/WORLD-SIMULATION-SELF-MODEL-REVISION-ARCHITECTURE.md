# Phase68C Research Baseline — Structured Self Model Revision

Status: Phase68C architecture and acceptance baseline.

Authoritative base HEAD: `fb717e13e0e90c53a219fd116ce78db7640dd07d`.

## 1. Scope

Phase68C adds explicit revision semantics above Phase68B structured self-aspect formation.

```text
Phase68A: autobiographical self-interpretation
↓
Phase68B: immutable structured self-aspect formation
↓
Phase68C: evidence-backed self-aspect support / challenge / revision
```

The boundary remains:

```text
World Truth
!= Character Experience
!= Subjective Memory
!= Belief
!= Self Interpretation
!= Structured Self Model
```

A revised self model remains subjective. Phase68C does not create an objective personality oracle, numeric self-confidence truth score, goal planner, or motivational arbitrator. Motivation/goal integration remains Phase68D.

## 2. Research synthesis

### 2.1 Identity assimilation and accommodation

Identity-processing and Identity Process Theory distinguish assimilation of new self-relevant information into existing identity structure from accommodation, where identity structure itself changes to incorporate discrepant information. This is the core engineering distinction needed by Phase68C: counterevidence does not imply immediate replacement, and support does not require creating a duplicate aspect.

Useful mapping:

```text
assimilation-like outcome   -> existing aspect remains active, new evidence is recorded as support/challenge context
accommodation-like outcome  -> explicit revision/replacement event creates a new aspect and supersedes selected prior aspect(s)
```

Phase68C does not claim the psychological labels as exact cognitive truth; they are research guidance for the revision contract.

### 2.2 Discrepant feedback and gradual self-concept change

Research on discrepant self-relevant feedback shows that self-concept can change when incoming evidence diverges from current self-views, and larger discrepancy can produce larger change. Other work shows formed self-beliefs can be resistant to contradictory evidence. Therefore one contradictory event must not mechanically rewrite durable identity.

Engineering consequence:

- no single-observation LWW replacement;
- explicit revision decision is required;
- unresolved challenge may coexist with an active aspect;
- source evidence is persisted as revision provenance rather than rewriting prior events.

### 2.3 Fluid but structured self-concept

Self-concept updating can propagate across related self-representations, but Phase68C must not invent a hidden semantic network or automatically rewrite neighboring aspects. Any cross-aspect revision must explicitly name its targets and be source-backed.

### 2.4 Identity balance

Identity-processing literature describes balance between preserving existing identity and accommodating change. Phase68C models neither a scalar balance score nor an optimization objective. Instead it supports multiple explicit outcomes and preserves unresolved tension.

## 3. Core Phase68C decision

Phase68B `StructuredSelfModelAspectEvent` remains immutable.

Phase68C introduces a separate durable primitive:

```text
StructuredSelfModelRevisionEvent
```

A revision event never edits a Phase68B event in place.

Supported operations:

```text
support
challenge
revise
```

Semantics:

- `support`: record evidence consistent with an existing active aspect; aspect remains active.
- `challenge`: record evidence in tension with an existing active aspect; aspect remains active unless explicitly revised later.
- `revise`: create one replacement self aspect and explicitly supersede one or more active same-character target aspects.

There is no implicit retirement, no LWW, and no automatic conflict resolution.

## 4. Source authority

Phase68C may use only canonical same-character cognition substrate already available below it:

```text
current-turn Phase68A interpretation event(s)
current-turn Phase68B formed aspect event, if present
prior effective Phase68A interpretations
prior effective Phase68B aspects
```

At least one current-turn Phase68A or Phase68B trigger is required for a durable revision event.

Phase68C does not scan World Truth, raw memories, or Phase67 stores directly and does not install a second retrieval engine.

## 5. Revision target rules

Every `support`, `challenge`, or `revise` event must explicitly name same-character active target aspect IDs.

Rules:

- targets must exist in the canonical effective Phase68B/68C projection;
- targets must belong to the same character;
- duplicate targets are forbidden;
- `support` and `challenge` do not change target active state;
- `revise` supersedes exactly the listed active target(s);
- superseded targets cannot be revised again as if active;
- unrelated active aspects remain active;
- multiple conflicting active aspects are legal until explicit revision resolves them.

## 6. Replacement aspect rules

`revise` includes one bounded replacement descriptor using the same finite Phase68B aspect vocabulary:

```text
trait_tendency
value_orientation
preference
role_identity
capability_appraisal
```

The replacement may change aspect type/domain/relation/object only when explicitly proposed by the resolver and source-backed. It never inherits truth authority from the superseded aspect.

`support` and `challenge` do not create replacement aspects.

## 7. Durable state

Recommended state:

```text
structured_self_model_revision_events
structured_self_model_revision_history
```

Each revision event is:

- immutable and write-once;
- content-address verified;
- deterministic;
- chained per character;
- pinned to exact resolver-view hash;
- pinned to exact source evidence refs/hashes;
- pinned to explicit target aspect IDs;
- subjective, not World Truth;
- not a Belief revision event;
- not a goal/motivation event;
- written only through Phase62K.

History is append-only.

## 8. Effective projection

Replay combines Phase68B formation history with Phase68C revision history and produces:

```text
EffectiveRevisedStructuredSelfModelProjection
```

For each aspect record, projection may include:

```text
state: active | superseded
support_event_ids: ordered refs
challenge_event_ids: ordered refs
superseded_by_revision_event_id: optional
replacement_aspect_id: optional
```

These are provenance/state fields, not truth scores.

Projection must not compute:

- confidence probability;
- self-concept clarity score;
- personality strength score;
- objective accuracy;
- automatic coherence ranking.

## 9. Formation/revision identity

A replacement created by `revise` receives a new deterministic aspect identity. Historical aspect identities are never reused.

The replacement's provenance links back to the revision event and superseded target IDs. Original Phase68B events remain immutable and auditable.

## 10. Per-turn rate boundary

Phase68C v1 allows at most one durable Self Model revision event per character per turn across persisted history.

This prevents one event from cascading into many automatic identity rewrites.

The limit applies across repeated function calls in the same turn, not only within one batch.

## 11. Character-facing projection

During prepare, only committed prior-turn effective revised self-model state is projected into:

```text
cognition.self_model_context
```

The DTO may expose active structured aspects and bounded qualitative revision state, but not engine event IDs/hashes/source turns/resolver internals.

A challenge may be represented only as bounded ambiguity/tension metadata if needed; it must not expose an engine-side truth judgment.

Current-turn Phase68C writes cannot feed back into the Character Brain that preceded them.

## 12. Resolver boundary

Optional hook:

```text
structuredSelfModelRevisionResolver
```

It receives a detached bounded view containing:

- current-turn Phase68A/68B triggers;
- existing effective active self aspects;
- bounded prior support/challenge state;
- supported operations/aspect types/relations;
- exact resolver-view hash.

It does not receive raw World State, raw event payloads, raw memory content, hidden retrieval graph, objective personality labels, numeric confidence, or Phase68D goal authority.

Missing resolver means no new Phase68C revision event.

## 13. Phase68C / Phase68D boundary

Phase68C may revise what the character represents about itself. It does not decide what the character should pursue.

```text
"I no longer see myself as incapable in combat"
!=
"therefore pursue combat training now"
```

Goal selection, motivational competition, commitment, and future-purpose integration remain Phase68D.

## 14. Acceptance contract

Phase68C acceptance requires:

- shared mechanism, per-character independent state;
- Phase68B events remain immutable;
- append-only Phase68C revision history;
- explicit support/challenge/revise operations;
- support/challenge preserve target active state;
- revise explicitly supersedes only named active same-character targets;
- replacement uses new deterministic aspect identity;
- no LWW revision;
- unresolved challenges may coexist with active aspects;
- no forced global coherence;
- no automatic neighboring-aspect propagation;
- no World Truth oracle;
- no raw memory/Phase67 scan;
- no second retrieval engine;
- no numeric truth confidence/probability;
- no self-concept clarity/accuracy score as authority;
- no goal or motivation arbitration;
- at most one durable revision event per character per turn across persisted history;
- Character Brain has no direct durable-write authority;
- Phase62K remains sole final writer;
- deterministic replay and input immutability;
- bounded committed-prior-turn Character-facing projection;
- no same-turn retroactive leakage.

## 15. Testing policy

Use scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`. Avoid `affected` when global runner/docs inputs would merely expand to full `all` without additional evidence value.
