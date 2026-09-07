# Phase68B Research Baseline — Structured Self Model

Status: Phase68B architecture and acceptance baseline.

Authoritative base HEAD: `70a7e170fba3d0c22be3b35f82496661e485458f`.

## 1. Scope

Phase68B builds the first structured self-representation above Phase68A autobiographical self-interpretation.

```text
Phase67: autobiographical organization
↓
Phase68A: autobiographical self-interpretation
↓
Phase68B: structured self model
```

The layer boundary remains:

```text
World Truth
!= Character Experience
!= Subjective Memory
!= Subjective Claim
!= Belief
!= Self Interpretation
!= Structured Self Model
```

A Structured Self Model is the character's current organized representation of self-related qualities. It may be incomplete, context-dependent, internally inconsistent, or wrong. It is not a World Truth character sheet and does not receive an objective-correction oracle.

Phase68B does not implement self-model revision, motivational arbitration, autonomous goals, future-purpose planning, or a global personality score. Revision is Phase68C. Motivation/goal integration is Phase68D.

## 2. Research synthesis

### 2.1 Self-schemata

Markus (1977), *Self-Schemata and Processing Information About the Self*, treats self-schemata as cognitive generalizations about the self derived from past experience that organize self-related processing. The useful engineering lesson is to represent self-knowledge as structured domain-specific content instead of one prose identity profile.

Phase68B borrows the idea of evidence-derived self-organization but does not borrow resistance-to-counterevidence as an implementation rule. Later revision must remain possible.

### 2.2 Multiple self-aspects

McConnell's Multiple Self-Aspects Framework models self-concept as multiple context-dependent self-aspects rather than one globally uniform self. This supports a collection of typed aspects that may coexist without being flattened into a single personality vector.

Phase68B therefore rejects:

- one mutable `character.self_model` object as authoritative identity;
- forced cross-domain consistency;
- one scalar self-strength or self-coherence score;
- one canonical prose summary as the durable model.

### 2.3 Self-concept content versus structural quality

Recent self-concept clarity reviews explicitly distinguish self-concept content (for example traits, roles, and values) from second-order judgments about clarity, consistency, or stability. Self-knowledge accuracy is also distinct from clarity.

Engineering consequence:

```text
Self Model Content != Self Model Clarity != Self Model Accuracy
```

Phase68B models content only. It does not infer truth from internal consistency and does not store clarity/confidence as a truth score.

### 2.4 Domain-specificity

The self-concept literature supports multidimensional/domain-specific representations. Phase68B therefore uses typed aspects instead of a global trait vector.

### 2.5 Embodied-agent self models

Recent embodied-AI work models self-representation across body, capability, memory, prediction, and agency. Phase68B borrows the architectural lesson that self-related state should be explicit and modular, but deliberately does not implement forward/inverse body models, self-awareness levels, policy prediction, or executive control.

Those mechanisms would cross current project boundaries.

## 3. Phase68B v1 durable primitive

The durable primitive is:

```text
StructuredSelfModelAspectEvent
```

Each event forms exactly one source-backed self aspect. It is not a prose biography and not a mutable profile patch.

Phase68B v1 supports one operation:

```text
form
```

Revision, challenge, support accumulation, supersession, and retirement are intentionally deferred to Phase68C.

## 4. Supported self-aspect types

Phase68B v1 supports a finite type set:

```text
trait_tendency
value_orientation
preference
role_identity
capability_appraisal
```

These are subjective self-representations.

Examples of semantic intent:

```text
trait_tendency      → "I tend to approach situations in this way."
value_orientation   → "I see this as something important to me."
preference          → "I generally prefer this kind of option/context."
role_identity       → "I currently identify with this role/context."
capability_appraisal→ "I currently see my capability in this domain this way."
```

They do not establish objective personality, moral truth, social status, or actual capability.

## 5. Structured descriptor

Each aspect has a bounded descriptor:

```text
aspect_type: finite enum
aspect_key: bounded stable semantic key

descriptor:
  subject_scope: self
  domain: bounded string
  relation: bounded relation enum
  object_ref: bounded string
  qualifiers: bounded unique string list
```

Allowed relation is determined by aspect type:

```text
trait_tendency       -> tends_toward
value_orientation    -> values
preference           -> prefers
role_identity        -> identifies_as
capability_appraisal -> appraises_capability_as
```

For `capability_appraisal`, `object_ref` is a bounded qualitative self-appraisal such as a capability state/domain label; Phase68B does not use a numeric skill score or probability.

No freeform paragraph is durable self-model authority.

## 6. Source authority

Phase68B v1 forms self aspects only from canonical same-character Phase68A interpretation events.

```text
current-turn Phase68A immutable interpretation event
+
optional prior same-character effective Phase68A interpretations
↓
Phase68B resolver view
↓
StructuredSelfModelAspectEvent proposal
```

At least one current-turn Phase68A interpretation event is required for a durable Phase68B formation.

This preserves layering:

- Phase68B does not scan World Truth;
- Phase68B does not scan raw memory;
- Phase68B does not create a second retrieval engine;
- Phase68B does not bypass Phase68A by silently mining all Phase67 records.

Phase68A already pins its own Phase67 provenance, so Phase68B can remain source-backed without duplicating the entire autobiographical evidence graph.

## 7. Formation rate boundary

Phase68B v1 permits at most one durable Self Model aspect formation per character per turn.

This prevents one autobiographical interpretation from exploding automatically into a trait, value, preference, role, and capability profile in a single step.

The limit is enforced across the persisted turn history, not merely within one function call.

## 8. Durable state

Recommended state:

```text
structured_self_model_aspect_events
structured_self_model_history
```

Every event is:

- immutable and write-once;
- content-address verified;
- deterministic;
- chained per character;
- pinned to an exact Phase68A source event/hash;
- pinned to an exact resolver-view hash;
- subjective, not World Truth;
- not a Belief revision;
- not a motivation or goal;
- written only through Phase62K.

History is append-only.

## 9. Effective projection

Replay produces:

```text
EffectiveStructuredSelfModelProjection
```

Phase68B replay only reconstructs formed aspects. It does not resolve conflict, supersede older aspects, or select a globally true self-description.

Multiple aspects across multiple domains are legal. Potential conflict is preserved for Phase68C.

There is no last-write-wins rule.

## 10. Character-facing projection

During turn prepare, only committed prior-turn Self Model state is projected into:

```text
cognition.self_model_context
```

The bounded DTO may expose:

- aspect type;
- domain;
- relation;
- object;
- bounded qualifiers;
- subjective-not-world-truth marker.

It must not expose:

- engine event IDs;
- aspect IDs;
- hashes;
- source turn IDs;
- resolver provenance;
- World Truth authority;
- confidence/probability;
- numeric personality/capability scores.

Same-turn Phase68B formation cannot feed back into the Character Brain decision that preceded it.

## 11. Resolver boundary

The optional programmatic hook is:

```text
structuredSelfModelResolver
```

It receives only a bounded resolver view containing:

- current-turn canonical Phase68A interpretation refs;
- bounded prior same-character effective Phase68A interpretation structure;
- existing effective Structured Self Model aspects;
- supported aspect types/relations;
- exact resolver-view hash.

It does not receive raw World State, raw World Event, raw memory content, Phase67 raw stores, hidden retrieval graph, objective truth labels, confidence scores, or Phase68D goal authority.

Missing resolver means no new Phase68B aspect.

## 12. Phase68B / Phase68C boundary

Phase68B may form an aspect. It may not revise one.

```text
Phase68B:
  immutable aspect formation
  append-only history
  replayable read projection

Phase68C:
  evidence-backed support/challenge/revision semantics
  explicit replacement/supersession where accepted
  effective revised Self Model projection
```

Phase68B must not pre-implement Phase68C with hidden mutable updates.

## 13. Phase68B / Phase68D boundary

Values and capability appraisals may be represented as self-knowledge content in Phase68B, but Phase68B does not rank goals or select motives from them.

```text
"I see protecting friends as important to me"
!=
"therefore choose goal X now"
```

Motivation and goal integration remains Phase68D.

## 14. Acceptance contract

Phase68B acceptance requires:

- shared mechanism, per-character independent state;
- same-character Phase68A evidence only;
- at least one current-turn Phase68A trigger per durable formation;
- one durable aspect event per character per turn maximum;
- no World Truth oracle;
- no raw memory / Phase67 store scan;
- no second retrieval engine;
- no direct Phase68A rewrite;
- immutable write-once Self Model aspect events;
- append-only history;
- deterministic replay;
- input immutability;
- finite typed aspect vocabulary;
- bounded structured descriptor;
- no freeform durable personality profile;
- no numeric truth confidence/probability;
- no scalar personality/self-coherence authority;
- no LWW self model;
- no forced cross-domain consistency;
- no self-model revision in Phase68B;
- no belief-engine duplication;
- no motivation/goal selection;
- Character Brain has no direct durable-write authority;
- Phase62K remains the sole final writer;
- bounded committed-prior-turn Character-facing DTO;
- no same-turn retroactive leakage.

## 15. Testing policy

Use focused/scoped evidence:

```text
memory_retrieval
cognition
world_simulation
```

Do not default to repository-wide `all`. `affected` should not be used when global runner/docs inputs make it conservatively expand to full `all` without extra evidence value.
