# Phase63A — Subjective Memory Formation v2

Phase63A converts already-bounded character perception into persistent subjective memory traces without promoting either perception or memory into objective World Truth.

The layer is intentionally conservative: the simulator records only cognitive consequences that are explicitly supported by its inputs and contracts. It does not invent a universal human encoding probability, a binary attention-to-memory gate, a subjective event boundary, or a hidden memory-strength default.

## Cognitive boundary

World Simulation distinguishes:

```text
World Truth
!=
Character Perception
!=
Initial Subjective Encoding
!=
Current Retrievability
!=
Later Reconstructed Memory
```

Phase63A owns only the third transition.

Research on divided attention demonstrates that encoding conditions strongly influence later episodic memory, but perception and attention are not equivalent to a deterministic remember/forget switch. Therefore Phase63A v2 does not introduce a hidden probabilistic encoding gate. A future programmatic encoding model must require explicit state/profile information rather than assuming a universal normal-human parameter.

Episodic-memory research also supports relational/contextual binding and event segmentation. However, a World Simulation `event_id` or `turn_id` is an engine scheduling identity, not automatically a character's subjective episode boundary. Phase63A v2 therefore does not infer `subjective_episode_id` from engine events.

Relevant foundations include Craik et al. (1996), divided attention at encoding and retrieval, DOI: 10.1037/0096-3445.125.2.159; Johnson, Hashtroudi, and Lindsay (1993), source monitoring, DOI: 10.1037/0033-2909.114.1.3; and Zacks et al. (2007), event perception and segmentation, DOI: 10.1037/0033-2909.133.2.273.

## Persistent record boundary

Only the already-filtered per-character perception packet may seed a direct-perception memory.

Raw World State facts, hidden scene data, exact source positions, engine target IDs, sound IDs, and other simulator-only sensory diagnostics are not remembered content.

Phase63A v2 separates two concepts that were mixed in v1:

```text
internal engine provenance
!=
subjective remembered source
```

A persisted direct-perception record may therefore contain:

```text
source
  kind
  sense

internal_provenance
  event_id
  scene_id
  turn_id
  observation_hash
  formation_version

retrieval_cues
  scene_id
  sense
  observation_kind
  memory_type
```

`internal_provenance` exists for causal audit, deterministic replay, and simulator lineage.

`retrieval_cues` exists for programmatic retrieval systems such as Phase63B.

Neither structure is forwarded into Character Brain as subjective remembered metadata.

The character-visible source representation remains limited to psychologically meaningful features such as direct perception and sensory modality.

## Encoding-time metrics

Phase63A v1 used generic `confidence` and `clarity` names. Phase63A v2 makes their scope explicit:

```text
perceptual_certainty_at_encoding
perceptual_clarity_at_encoding
```

These values describe the explicit perception/encoding evidence available when the trace was formed.

They are not:

```text
retrieval confidence
truth probability
storage strength
current retrieval strength
```

Numeric values require either an explicit observation value or an explicit character `memory_encoding_profile`.

Missing values remain `null`.

No normal-human numeric default is inferred.

Legacy `confidence` / `clarity` input aliases remain accepted for compatibility, but new Phase63A v2 records use the encoding-time field names.

Encoding metadata itself is not copied into remembered `content`.

## Explicit programmatic encoding decisions

Phase63A v2 supports an explicit encoding-decision hook so that bounded perception is no longer architecturally required to become a persistent trace.

The hook is deliberately opt-in.

If no programmatic encoding decider is installed:

```text
bounded perception
-> legacy-compatible encoding
```

No hidden forgetting probability or encoding threshold is introduced.

When a programmatic decider is installed, it may return one of three explicit outcomes for a particular bounded sensory observation:

```text
encode
do_not_encode
unspecified
```

A decision targets:

```text
character
sense
sense_index
```

`encode` explicitly permits normal formation.

`do_not_encode` suppresses formation of that particular persistent trace.

`unspecified`, and the absence of any decision, preserve legacy-compatible formation.

The encoding decider receives only already-bounded per-character information:

```text
turn identity
character
bounded perception
bounded cognition
```

It does not receive:

```text
World State
raw scene state
full World Event payload
hidden causal information
```

Character Brain may influence cognition in the ordinary way, but it cannot directly issue an authoritative persistent-memory mutation. An `encoding_decisions` field embedded inside a Character Brain decision packet is ignored by Phase63A.

Every explicit programmatic encoding decision is retained in the turn audit/history so the absence of a memory trace remains causally inspectable.

The hook deliberately does not define formulas such as:

```text
attention < threshold -> forget
emotion * salience -> memory strength
random() < p -> encode
```

Such behavior would require a separately justified programmatic encoding model.

## Explicit subjective episode binding

Phase63A v2 can explicitly associate multiple atomic memory traces with the same subjective episode.

For example:

```text
visual trace ----\
auditory trace ----> subjective episode
spatial trace ----/
```

The atomic traces remain separate records. Binding therefore does not force them into one large memory blob and leaves room for later partial forgetting, source loss, or retrieval of only part of an episode.

Episode binding is opt-in and programmatic.

A binding explicitly targets:

```text
character
sense
sense_index
subjective_episode_id
```

The same `subjective_episode_id` may be attached to several encoded traces.

If an explicit binding matches a bounded observation but no new trace is produced, the binding audit records `applied: false` with a concrete reason such as encoding suppression, an already-existing memory, or same-turn deduplication.

The identifier is an internal simulation relation. Character Brain does not receive or consciously "remember" the engine identifier itself.

The binder receives only bounded per-character perception/cognition plus already-resolved explicit encoding decisions.

It does not receive raw World State or the complete World Event payload.

Most importantly, Phase63A does not assume:

```text
event_id
=
turn_id
=
scene_id
=
subjective_episode_id
```

World scheduling identity and a character's subjective event structure are different concepts.

Phase63A v2 therefore supports explicit binding while deliberately leaving automatic event segmentation unresolved.

No scene-change heuristic, prediction-error threshold, or universal event-boundary formula is invented in this phase.

## Persistence is not consolidation

A Phase63A memory record is persisted in World Simulation storage so that it survives subsequent turns.

That does not mean the psychological memory has already completed consolidation.

New v2 traces are marked:

```text
formation_stage = encoded_unconsolidated
engine_persisted_trace = true
```

Later consolidation, semanticization, or systems-level transformation belongs to later explicit phases.

## Character Brain boundary

Character Brain may receive the subjective content of a retrievable memory and permitted subjective source/encoding features.

It does not receive:

- `internal_provenance`
- engine `event_id`
- engine `turn_id`
- engine `scene_id`
- `observation_hash`
- formation implementation version
- machine retrieval cues
- exact `encoded_at`
- exact `last_recalled_at`
- Phase63B retrieval-strength scores

This preserves the distinction between what the simulator knows about a memory and what the character remembers.

## Causal boundary

Memory formation is deterministic and input-immutable.

New memory traces are produced as transitions and reach final World State only through the authoritative mutation executor.

A memory created from the current turn cannot retroactively enter the Character Brain decision that already occurred in that same turn.

```text
Perception
-> Character decision
-> Memory formation
-> authoritative commit
-> later turn retrieval
```

## Explicitly not modeled in Phase63A v2

Phase63A v2 does not yet model:

- universal probabilistic encoding formulas
- hidden stochastic encoding failure
- binary attention-based memory gating
- incidental-memory probability formulas
- automatic subjective event segmentation
- automatic cross-trace binding inference
- prediction-error event-boundary thresholds
- schema-driven memory distortion
- inference-to-memory conversion
- active memory decay
- retrieval practice / recall reinforcement
- source-confusion drift
- consolidation / semanticization
- reconsolidation
- post-outcome transient sensory capture

These mechanisms require later explicit programmatic phases rather than hidden cognitive defaults.
