# Phase63B — Cue-Dependent Subjective Memory Accessibility v2

Phase63B answers a deliberately narrow question:

```text
Which stored subjective memories currently form reasonable retrieval candidates?
```

It does **not** answer:

```text
Which memories did the character actually recall?
```

That later retrieval-process outcome belongs to Phase63C.

## Cognitive boundary

The runtime distinguishes:

```text
Memory exists
!=
Current accessibility
!=
Candidate activation
!=
Successful retrieval
```

Phase63B owns the middle accessibility/candidate boundary.

A candidate memory supplied to a later retrieval or projection layer is not evidence that the character has consciously recalled it.

## Phase63B v2 research direction

The v2 design is informed by established work on:

- encoding specificity and cue-dependent retrieval;
- cue overload and competition;
- temporal / retrieved context;
- separation of storage strength and current retrieval accessibility;
- retrieval practice and the distinction between retrieval attempt and retrieval success.

Relevant foundations include:

- Tulving & Thomson (1973), encoding specificity;
- Watkins & Watkins (1975), cue overload;
- Bjork & Bjork (1992), storage strength versus retrieval strength;
- Howard & Kahana (2002), temporal context;
- Polyn, Norman, & Kahana (2009), context maintenance and retrieval.

Phase63B does not claim that any one of these models is a universal literal implementation of human memory.

## Step 1 runtime status

Step 1 establishes semantic and schema foundations while deliberately preserving existing Phase63B-v1 behavior.

Existing enabled Phase63B-v1 weighted profiles run as:

```text
legacy_v1_weighted_compatibility
```

No retrieval results are intentionally changed in Step 1.

A native v2 model declaration such as:

```text
model_mode = cue_dependent_v2
```

now selects the native cue-dependent evaluator.

An enabled profile that declares an unknown explicit `model_mode` fails closed. Only pre-v2 profiles with no explicit mode are automatically preserved as `legacy_v1_weighted_compatibility`.

Native v2 also rejects legacy weighted-model components such as `component_weights`, `context_cue_weights`, `retrieval_threshold`, and fixed `interference` configuration instead of silently mixing the two cognitive models.

## Candidate terminology

The canonical v2 terms begin with:

```text
candidate_memory_records
candidate_evaluations
candidate_ranking
candidate_eligible
accessibility_score
```

Legacy v1 compatibility fields and outputs remain temporarily available:

```text
retrievable_memory_records
evaluations
ranking
retrievable
retrieval_strength
retrieval_threshold
```

They exist only for migration compatibility.

`retrievable_memory_records` is specifically a deprecated legacy **projection output**, not a strict alias of the canonical candidate set. Legacy `max_items` may still truncate that compatibility projection, while canonical `candidate_memory_records` retains the full eligible candidate set and remains the authoritative accessibility output.

## Accessibility score boundary

During Step 1 an enabled legacy v1 weighted profile may still produce its old scalar value.

The v2 alias is:

```text
accessibility_score
```

This value is a simulator decision/diagnostic variable.

It is not asserted to be:

- a literal human psychometric measurement;
- Bjork's theoretical Retrieval Strength variable;
- truth probability;
- storage strength;
- successful recall probability.

Native v2 scalar scoring will require an explicit model.

Missing numerical evidence may remain `null`.

## Engine eligibility

Phase63B v2 introduces the semantic field:

```text
retrieval_eligible
```

The older record field:

```text
accessible
```

is accepted as a legacy engine-policy alias.

Engine retrieval eligibility means:

```text
the simulator allows this record to participate in retrieval search
```

It does not mean:

```text
the character is psychologically guaranteed to be able to recall it
```

Likewise, `suppressed = true` remains an engine-level exclusion.

## Projection budget boundary

Step 3 formally separates:

```text
memory accessibility
!=
Character Brain context projection budget
```

Phase63B now supplies the authoritative canonical candidate set:

```text
candidate_memory_records
```

The world loop passes that candidate set to `world_memory_retriever` as an engine-authoritative projection input.

The projector does **not** re-run the legacy rule:

```text
record.accessible !== false
```

over an authoritative Phase63B candidate set.

Authority must be explicit:

```text
candidate_set_authoritative = true
```

The older compatibility flag:

```text
enforced = true
```

does not by itself assert that the supplied records are the canonical Phase63B candidate set.

For legacy callers that provide only `enforced:true`, the projector still consumes the supplied programmatic `memory_records` but preserves the old `accessible/suppressed` filtering behavior.

That is important because native:

```text
retrieval_eligible = true
```

may legitimately override a legacy:

```text
accessible = false
```

field.

### Projection limit

The canonical projection control is:

```text
memory_projection_policy.max_items
```

This is an engine context-budget policy.

It is not:

- a human memory-capacity measurement;
- a working-memory slot count;
- an accessibility score;
- evidence of successful retrieval.

The explicit projection limit supports values from 0 through 32.

Because `projection_max_items` is a canonical structured input, explicitly supplied invalid values fail closed rather than silently falling back:

```text
-1
33
1.5
NaN-like/non-integer values
```

are invalid.

For backward compatibility only, a legacy Phase63B-v1 `max_items` may still be used as the projection-budget fallback when no explicit projection policy exists.

### Projected memory context

`world_memory_retriever` now canonically returns:

```text
projected_memories
```

The older:

```text
retrieved_memories
```

field remains a deprecated compatibility alias until Phase63C installs real retrieval-attempt outcomes.

Therefore:

```text
projected_memories
!=
memories the character definitely recalled
```

The projected set is bounded contextual evidence supplied to Character Brain.

### Loop retrieval context

The world loop also forwards explicit structured:

```text
event.memory_retrieval_context
```

into Phase63B.

This forwarding is engine-side only.

The Character Brain event projection strips:

```text
memory_retrieval_context
memory_projection_policy
```

before the event packet is delivered.

Therefore retrieval cues and engine projection-budget controls cannot leak into character cognition through the event object.

Free-text event summaries and `memory_query` do not become semantic retrieval cues automatically.

## Storage and accessibility

Persistent storage strength remains distinct from current accessibility.

Step 1 keeps legacy v1 weighted behavior intact, including old profiles that explicitly use storage strength.

Native v2 will not treat storage strength as an automatic current-accessibility bonus without an explicit computational profile.

## Time

Existing explicit time functions remain supported for compatibility:

```text
none
hyperbolic
exponential
power
```

They are optional phenomenological profiles.

They are not declared to be a universal human forgetting mechanism.

Time passage does not rewrite or delete persistent memory records in Phase63B.

## History boundary

Phase63B remains read-only.

Step 1 preserves legacy `recall_count` / `last_recalled_at` compatibility.

They are not promoted to canonical retrieval history.

Phase63C will define immutable retrieval events before native v2 history effects are allowed to depend on retrieval outcomes.

## Step 2 runtime status

Step 2 installs the native cue-dependent evaluator:

```text
typed active retrieval cues
+
memory-linked cue associations
+
cue-match evidence
+
subjective-episode relations
+
query-relative cue competition
->
memory candidates
```

### Active retrieval cues

Native v2 may consume structured cues from:

- current bounded spatial context;
- sensory modalities present in bounded perception;
- bounded observation kinds;
- explicitly machine-readable context cues;
- explicit `retrieval_context.active_cues`;
- explicit retrieval goals;
- explicitly supplied recently reinstated retrieval cues.

Cue kinds are typed and exact.

Supported kinds include:

```text
spatial_context
perceptual_modality
observation_kind
memory_type
subjective_episode
entity
semantic
source
temporal
task
goal
internally_reinstated
```

Unknown explicit cue kinds fail closed.

Explicit native cue collections must also use the documented structured-array form. Malformed cue collections and malformed explicit retrieval goals fail closed instead of being silently ignored.

If the same active cue is supplied by several legitimate sources, Phase63B deduplicates the cue identity while retaining all contributing source provenance.

### Memory-side cue links

Native v2 reads explicit memory associations from:

```text
retrieval_cue_links[]
retrieval_cues
episodic_binding.subjective_episode_id
```

Phase63A machine retrieval cues such as `scene_id`, sensory modality, observation kind, and memory type are normalized into typed retrieval links.

A subjective episode ID is treated only as an internal relational cue. It is not exposed to Character Brain as remembered conscious metadata.

Several independent memory-side associations may legitimately point to the same cue identity. Phase63B therefore preserves those association records separately rather than collapsing their source/evidence information.

For example:

```text
entity: elias_noll
  source A / evidence A

entity: elias_noll
  source B / evidence B
```

remain two memory-side associations even though they match the same active retrieval cue.

### Exact structured matching

Native v2 performs exact typed cue matching.

It does not scan free-text memory content to infer semantic similarity.

Therefore:

```text
content mentions Elias
!=
memory has an entity cue for Elias
```

unless an explicit cue association exists.

### Query-relative competition

Competition is evaluated relative to the active cue set.

For each matched cue Phase63B records:

```text
candidate_fan_out
competing_candidate_count
diagnosticity
```

A cue matching one candidate is more diagnostic within that query than a cue matching several candidates.

Native v2 does **not** convert competitor count into a fixed numerical penalty.

No rule such as:

```text
competitor_count * 0.2
```

is applied.

### No invented scalar accessibility

Step 2 does not install a universal numerical accessibility formula.

Therefore native evaluations normally report:

```text
accessibility_score = null
accessibility_score_origin = native_v2_no_scalar_model
```

Cue evidence can determine candidate eligibility without inventing a psychometric number.

Storage strength remains diagnostic metadata and is not an automatic native accessibility bonus.

### No active cue

When no active retrieval cue exists, native v2 conservatively preserves engine-eligible memory records as candidates rather than inventing an exclusion rule.

This means absence of cue evidence is not treated as evidence that a stored memory is psychologically impossible to retrieve.

## Step 4 — Retrieval history boundary

Phase63B distinguishes current accessibility from actual retrieval events.

The native v2 accessibility model does **not** currently use retrieval history as an accessibility effect:

```text
native_v2_retrieval_history_effects_modeled = false
```

Actual retrieval attempts and their outcomes belong to Phase63C.

The intended causal order is:

```text
Phase63B accessibility query
→ freeze candidate set
→ Character Brain receives projected context
→ character may or may not attempt retrieval
→ Phase63C records RetrievalEvent
→ commit
→ next simulation cycle
→ Phase63B may consume formally supported prior retrieval history
```

There is no same-cycle retroactive history feedback.

### Projection is not a retrieval event

A memory appearing in:

```text
projected_memories
```

does not mean the character successfully recalled it.

Projection therefore does not:

- append `retrieval_history`;
- increment `recall_count`;
- update `last_recalled_at`;
- create a RetrievalEvent;
- reinforce memory;
- feed a new retrieval effect back into the same 63B query.

Phase63C owns actual RetrievalEvent creation.

### Legacy v1 history compatibility

The legacy weighted model retains support for historical recall-based components, but the semantics are hardened.

If a memory contains non-empty:

```text
retrieval_history
```

that history takes precedence over summary fields:

```text
recall_count
last_recalled_at
```

The summary fields are fallback compatibility caches only when no retrieval history is present.

Within legacy history, only explicitly successful entries count as successful recalls.

Examples that count:

```text
success = true
outcome = success
outcome = successful
outcome = successful_recall
outcome = successful_retrieval
```

Entries that are failed, ambiguous, malformed, or lack an explicit success outcome do not count as successful recall.

This prevents an old behavior where malformed history entries could accidentally increase recall-frequency accessibility.

### Phase63C ownership

Phase63B intentionally does not install the final RetrievalEvent schema.

The following remain Phase63C-owned:

- retrieval attempt;
- successful / partial / failed outcome;
- immutable RetrievalEvent schema;
- append-only canonical retrieval history;
- summary-cache derivation;
- retrieval-history effects available to a later 63B cycle.

### Explicitly not modeled

Step 2 does not introduce:

- free-text semantic similarity;
- hidden temporal-context vectors;
- universal context-drift parameters;
- fixed per-competitor penalties in native v2;
- random SAM-style sampling;
- successful-recall claims;
- native retrieval-history effects;
- reconsolidation;
- source confusion or distortion.

Those mechanisms remain separately owned by later phases.

## Invariants

Phase63B v2 remains:

- deterministic for identical inputs;
- input-immutable;
- read-only with respect to persistent memory;
- unable to write World State;
- unable to rewrite certainty or clarity;
- unable to convert subjective memory into World Truth;
- unable to let Character Brain decide its own accessibility score;
- unable to expose engine accessibility scores as subjective remembered content.
