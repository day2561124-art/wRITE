# Character Runtime v3 — Recollection Reinstatement Boundary

Character Runtime v3 defines the narrow boundary between **subjective content actually recovered by Phase63C** and that content becoming part of the character's **Current Mind / Attention workspace**.

This slice does **not** create a second memory system, a Persistent Mind database, or a new retrieval engine.

Its canonical question is:

```text
Phase63C has already decided what the character actually recovered.
How may that recollection be reinstated into Current Mind exactly once,
with subjective uncertainty preserved,
without leaking engine provenance or changing historical replay semantics?
```

## Core authority chain

```text
World Truth
→ bounded character perception
→ Phase63 subjective memory
→ Phase63B cue-dependent accessibility
→ Phase63C actual retrieval
→ recovered subjective content
→ v3 Recollection Representation
→ Character Runtime Current Mind / Attention
→ bounded cognition
→ Character Brain action intent
→ World adjudication
```

Authority remains separated:

```text
World Engine
= what objectively happened

Phase63 subjective memory
= what subjective memory exists

Phase63C
= whether retrieval occurred and what content actually surfaced

Character Runtime Current Mind
= where surfaced content currently sits in cognition

Character Brain
= candidate action intent only
```

GPT / neural adapters are not authority for memory existence, retrieval success, recovered content, committed Current Mind, world truth, or action outcome.

## Existing production baseline

The production loop already has the essential upstream connection:

```text
Phase63C recovered_memories
→ CharacterRuntime.prepareSpeculativeCurrentMind(...)
→ source_kind = recovered_memory
→ Current Mind attention reducer
→ working_context
→ cognition
```

Therefore v3 MUST NOT add another retrieval-to-memory subsystem.

The remaining boundary problem is representation and final character-facing exposure.

## Recollection Representation

A Recollection Representation is a bounded current-cognition representation of content that Phase63C already recovered.

It is not:

- a Memory Record;
- a RetrievalEvent;
- a world event;
- a new durable memory;
- a claim that the remembered content is objectively true;
- a GPT-authored summary;
- a retrieval score or resolver trace.

Conceptual character-facing shape:

```text
{
  context_origin: "recovered_memory",
  content: <actual Phase63C recovered content>,

  // optional character-meaningful epistemic metadata already authorized
  // by the Phase63C recovered-memory character view:
  content_kind?,
  target_relation?,
  source?,
  memory_type?,
  perceptual_certainty_at_encoding?,
  perceptual_clarity_at_encoding?,
  possibly_incorrect?,
  source_confused?
}
```

The representation MUST NOT expose:

- memory_id / source_memory_ref;
- fragment_id / recovery occurrence IDs;
- retrieval_process_id / retrieval_event_id;
- query IDs;
- candidate-set identities or hashes;
- JSON-pointer grounding provenance;
- accessibility scores;
- resolver scores or selection diagnostics;
- contacted-candidate references;
- Current Mind candidate_id;
- Current Mind source_ref / source_kind;
- attention bid scores;
- engine provenance;
- causal_chain / causal_evidence;
- world-private state.

## Subjective epistemic state must survive reinstatement

Retrieval does not promote a memory into world truth.

If Phase63C's character-safe recovered view says that a recollection is uncertain, confused, or based on low-clarity encoding, Current Mind must not erase that information merely because the memory was successfully retrieved.

Therefore safe Phase63C fields such as:

```text
possibly_incorrect
source_confused
perceptual_certainty_at_encoding
perceptual_clarity_at_encoding
```

may survive into the Recollection Representation.

This does not authorize Current Mind to invent or infer new certainty metadata.

## Semantic identity vs recollection occurrence

Two different concepts must remain distinct.

```text
same remembered content
!= same retrieval occurrence
```

A memory may be recalled again on a later cognitive cycle. That later recall is a new retrieval occurrence even if the subjective content is identical.

Current Mind may still use a stable semantic candidate identity for continuity/refresh behavior. Separately, engine-side transition evidence may record a deterministic occurrence identity for the current retrieval event/cycle.

The occurrence identity is engine-side only and MUST NOT become Character Brain provenance.

Within one Phase63C retrieval result, repeated internal recovery occurrences may already collapse into the canonical unique `recovered_memories` character projection while remaining separately represented in Phase63C RetrievalEvent evidence. v3 does not redefine that Phase63C rule.

## Single Semantic Exposure Principle

The same recollection MUST NOT be presented to Character Brain multiple times merely because it traveled through multiple plumbing layers.

Current production plumbing may internally contain the same recovered content in places such as:

```text
recovered_memories
cognition.recovered_memories
cognition.attention
cognition.working_context
```

That internal redundancy is not evidence that multiple independent facts support the recollection.

### Canonical Character Brain surface

For v3, the canonical semantic exposure of recovered-memory content is:

```text
cognition.working_context
```

through Current Mind items carrying:

```text
context_origin: "recovered_memory"
```

When the v3 Current Mind recollection path is active, the final Character Brain ingress projector MUST NOT additionally forward the same recalled semantic content through:

```text
top-level recovered_memories
cognition.recovered_memories
recovered-memory items duplicated inside cognition.attention
```

`retrieval_experience` remains independently character-facing because it describes retrieval process state rather than duplicating recovered semantic content.

Other non-recollection Current Mind / Attention content is outside this deduplication rule and must not be removed merely to satisfy v3.

## Attention is an admission / placement boundary

Actual Phase63C retrieval does not imply that every recovered item must dominate cognition.

Current Mind remains responsible for deterministic placement into:

```text
focus
active_context
peripheral_context
fading_context
suspended_context
```

A recollection that is not admitted into the bounded Current Mind workspace is not separately re-injected through a bypassing raw memory channel at final Character Brain ingress.

Thus:

```text
Phase63C retrieval success
!= guaranteed focus
!= guaranteed active context
!= bypass of Current Mind
```

## Timing

Recollection timing is intentionally different from committed Experience Receipt timing.

```text
Phase63B accessibility N
→ Phase63C retrieval N
→ Recollection Representation N
→ Current Mind / Attention N
→ cognition N
→ action intent N
→ world adjudication N
→ world commit N
```

A recollection recovered before action selection may affect the same turn's cognition and action intent.

By contrast, Experience Receipt N still follows the v2 rule that it becomes eligible only for Attention N+1 after successful world commit.

## Speculative / commit boundary

Current Mind remains speculative until successful world commit.

If the turn is:

- blocked by consistency;
- stale;
- rejected before commit;
- aborted by transaction failure;
- rolled back;

then:

```text
committed Current Mind recollection effect = 0
committed Experience effect = 0
```

Phase63C may have executed as part of preparing the speculative turn, but the speculative Current Mind transition MUST NOT become committed state unless the world commit succeeds.

Retrieval-history persistence continues to follow Phase63C / Phase62K authority and is not redefined by v3.

## Historical replay

Historical replay MUST NOT run the current retrieval algorithm to guess what the character should have remembered in the past.

The historical authority remains:

```text
persisted historical recovered content
+ persisted committed Current Mind transition / reducer_state_after
```

Replay therefore MUST NOT rerun:

- Phase63B accessibility;
- Phase63C retrieval;
- latest attention selection;
- GPT / Character Brain;
- current perception;
- current neural adapters.

A future retrieval algorithm version cannot rewrite what a historical character actually recovered or what historical Current Mind transition was committed.

Any safe Recollection Representation metadata needed for historical Current Mind semantics must therefore be included in the persisted Current Mind transition rather than recomputed from future memory algorithms.

## No memory mutation from recollection

Retrieving or attending to a memory is not itself permission to mutate that memory.

v3 MUST NOT perform:

- reconsolidation;
- memory rewrite;
- confidence rewrite;
- generic strengthening;
- competitor weakening;
- retrieval-induced forgetting;
- belief update;
- reflection persistence;
- personality change;
- relationship learning.

Those require later explicit authority boundaries and successful committed mutation flows.

## Failure / edge-case acceptance matrix

### 1. No retrieval process

```text
recovered_memories = []
retrieval_experience.process_occurred = false
```

Expected:

- no recovered-memory Current Mind candidate;
- no recollection semantic exposure;
- no memory mutation.

### 2. Retrieval attempted but target failed

```text
process_occurred = true
target_outcome = failed
recovered_any_content = false
```

Expected:

- `retrieval_experience` may reach cognition;
- no fabricated recollection content;
- no recovered-memory Current Mind candidate.

### 3. Non-target content surfaced

```text
target_outcome = failed
recovered_any_content = true
```

Expected:

- actual non-target recovered content may enter Current Mind;
- target failure remains separately represented in retrieval_experience;
- no target content is invented.

### 4. Partial grounded recovery

Expected:

- only actual Phase63C materialized content enters Recollection Representation;
- Current Mind does not reconstruct omitted source fields;
- no arbitrary percentage completion.

### 5. Uncertain / possibly incorrect memory

Expected:

- safe uncertainty metadata survives reinstatement;
- content is not promoted to `known` or world truth merely because retrieval succeeded.

### 6. Source-confused memory

Expected:

- `source_confused = true` may remain character-visible;
- engine source refs / IDs remain hidden.

### 7. Same semantic memory recovered twice in one plumbing path

Expected:

- final Character Brain semantic exposure occurs once;
- internal duplicated transport copies do not increase apparent confidence or importance.

### 8. Same memory recalled again on a later turn

Expected:

- the later retrieval is allowed as a new occurrence;
- Current Mind may refresh stable semantic content;
- the new occurrence is not globally deduped away merely because source memory/content is the same.

### 9. More recovered content than Current Mind admits

Expected:

- Current Mind bounded admission remains authoritative;
- dropped recollection content is not bypass-injected through raw `recovered_memories` at final Brain ingress.

### 10. Blocked consistency

Expected:

- speculative recollection placement may have existed during preparation;
- committed Current Mind effect remains zero.

### 11. Stale prepared turn

Expected:

- no stale speculative Current Mind transition becomes committed;
- no stale recollection placement becomes durable Runtime state.

### 12. Atomic transaction failure / rollback

Expected:

- Current Mind remains at the previous committed sequence/state;
- no partial recollection transition remains committed.

### 13. Historical replay after retrieval algorithm upgrade

Expected:

- historical persisted transition is consumed directly;
- Phase63C is not re-executed;
- historical recollection semantics remain unchanged.

## Minimal implementation surface

The expected narrow production surface is intentionally small.

### `server/src/world-simulation-loop-service.mjs`

Responsibilities:

- preserve safe Phase63C recollection metadata in Current Mind state;
- emit `context_origin: "recovered_memory"` in character-facing Current Mind items;
- optionally persist an engine-only deterministic recollection-occurrence identity in transition evidence without changing character-facing provenance;
- keep v2 speculative/commit/replay semantics unchanged.

### `server/src/world-simulation-character-brain-input-service.mjs`

Responsibilities:

- become the final single-semantic-exposure gate;
- when v3 recollection-bearing Current Mind is present, suppress duplicate raw recovered-memory semantic channels;
- preserve `retrieval_experience`;
- keep compatibility aliases explicit and non-authoritative.

### Tests

Targeted tests should extend existing Character Runtime / transport suites rather than create a second testing stack.

Required assertions include:

- `context_origin = recovered_memory`;
- safe uncertainty/source-confusion metadata survives;
- private IDs / resolver / source refs remain absent;
- one recalled semantic item appears exactly once in final Character Brain input;
- same memory may be recalled again in a later turn;
- no-retrieval / failed-retrieval paths do not fabricate content;
- bounded Current Mind admission cannot be bypassed by raw recovered-memory input;
- blocked/stale/rollback commit effects remain zero;
- replay does not reexecute Phase63C.

## Explicitly out of scope

- Persistent Mind DB;
- second memory store;
- Personality;
- Belief dynamics;
- Needs dynamics;
- Emotion learning;
- Self Model;
- Habit;
- Skill learning;
- Relationship learning;
- Reflection persistence;
- autonomous scheduler;
- local LLM;
- dialogue generation;
- reconsolidation;
- memory strengthening / weakening;
- source-confusion generation or adjudication;
- semanticization / gist generation;
- retrieval-algorithm redesign.

## v3 architecture invariant summary

```text
Memory Record
!= Retrieval Event
!= Recollection Representation
!= Current Mind
!= World Truth

Phase63C owns what actually surfaced.
Character Runtime owns current placement.
Character Brain owns action intent only.

Recovered content may affect the same turn.
Recovered content does not bypass Current Mind.
Recovered content does not mutate its source memory.

One recollection occurrence
must not become multiple semantic facts
just because plumbing duplicates it.

Same source memory recalled later
is still a valid new recollection occurrence.

Historical replay consumes stored historical semantics.
Historical replay never asks today's retrieval algorithm
what yesterday's character should have remembered.
```
