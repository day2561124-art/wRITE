# Phase63C — Actual Memory Retrieval Process / Immutable Retrieval Events

Phase63C models the boundary between a memory being a reasonable current retrieval candidate and subjective memory content actually becoming available to the character.

Its canonical question is:

```text
What retrieval process actually occurred,
and what subjective content actually surfaced?
```

The core invariant remains:

```text
Memory exists
≠ Current accessibility
≠ Actual retrieval
≠ Content reaching Character Brain
```

## Research-informed boundary

Phase63C follows several conservative conclusions from retrieval research:

- retrieval effort/search and retrieval success are separable;
- successful recovery, precision, vividness, and confidence are not one scalar;
- unsuccessful deliberate retrieval attempts are real cognitive events rather than no-ops;
- spontaneous / involuntary retrieval may occur without a preceding deliberate retrieval attempt;
- retrieval may unfold over multiple search steps;
- recovered context may later supply internally reinstated cues;
- non-target information may surface while a target remains unrecovered;
- partial recovery must be represented by content that actually surfaced, not by an invented percentage;
- retrieval-induced forgetting, retrieval practice effects, and reconsolidation do not justify universal fixed simulator rules.

The simulator therefore does not invent a universal retrieval probability, success threshold, reinforcement constant, competitor penalty, partial-recall percentage, or automatic reconsolidation rule.

## Phase ownership

```text
Phase63A
subjective memory formation

Phase63B
current cue-dependent candidate accessibility

Phase63C
actual retrieval process
→ recovered subjective content
→ later immutable RetrievalEvent persistence

Phase63D
source monitoring / source confusion / distortion

Phase63E
consolidation / gist / semanticization

Phase63F
conditional reconsolidation / updating
```

Phase63C does not perform generic strengthening, weakening, source confusion, consolidation, or reconsolidation.

## Native runtime path after Step 3

```text
Phase63B candidate_memory_records
→ engine-side frozen candidate set
→ MemoryRetrievalQuery
→ engine-side retrieval initiation / resolution policy
→ Phase63C single-step retrieval kernel
→ source-grounded materialization
→ recovered_memories
→ cognition
→ Character Brain
```

The compatibility `world_memory_retriever` may still run engine-side for direct API compatibility and trace continuity. Its `projected_memories` do not enter the native Character Brain path.

## Step 1 — Schema / contract foundation

Step 1 installed canonical schemas for:

- `MemoryRetrievalQuery`
- `RetrievalProcess`
- `RetrievalStep`
- `RecoveredFragment`
- `RetrievalEvent`
- retrieval-history references

No retrieval runtime was activated at that step.

## Step 2 — Candidate-content information barrier

Step 2 established:

```text
unretrieved candidate memory content
MUST NOT reach Character Brain
```

The canonical Phase63C recovered-content output channel became:

```text
recovered_memories
```

Before Step 3 that channel was intentionally always empty. Character Runtime v3 later consumes this upstream channel and performs the final Current Mind recollection reinstatement / single-semantic-exposure projection before Character Brain ingress.

## Step 3 — Actual Retrieval Process Kernel

Step 3 installs the first actual retrieval runtime.

It is deliberately a **single-step, evidence-grounded kernel**. It does not yet perform generative multi-step search or internally reinstated cue cycles.

### Initiation is separate from candidate accessibility

Candidate presence does not imply a retrieval process occurred.

The runtime distinguishes:

```text
no process

deliberate retrieval process

spontaneous retrieval process
```

A missing retrieval resolver means `no process`; the engine does not silently convert candidate presence into recall.

The kernel itself contains no random retrieval lottery. If a future retrieval policy uses stochastic behavior, that policy must own its seed and parameters explicitly.

### Engine-side retrieval resolver

The native loop may receive a programmatic `memoryRetrievalResolver`.

The resolver receives only retrieval-relevant engine-side inputs:

- frozen `MemoryRetrievalQuery`;
- frozen candidate subjective memory records;
- Phase63B candidate evaluations;
- bounded current perception;
- the character's own current state.

It does not receive World State or the full world event.

The resolver may decide process structure such as:

```text
process_occurred
initiation
retrieval_task
target
contacted_candidate_refs
recovered_selections
termination
```

The resolver is not allowed to author recovered memory prose/content.

### Source-grounded recovered content

A `recovered_selection` identifies existing source content rather than supplying new content.

Step 3 supports:

```text
whole_content
json_pointer
```

For example:

```text
source memory content:
{
  "actor": "伊萊亞斯",
  "action": "伸手摸了摸阿灰背甲",
  "expression": "皺眉"
}

recovered selector:
/content-equivalent JSON pointer: /actor

actually surfaced content:
"伊萊亞斯"
```

The value is materialized by the kernel from the frozen candidate record.

The resolver cannot return:

```text
content: "some newly generated recollection"
```

and have it accepted as a memory.

### Partial recovery

Step 3 does not model partial recall as a percentage.

For structured memory content, partial recovery means one or more explicitly grounded source paths surfaced while other source paths did not.

For legacy scalar/string content, Step 3 does not arbitrarily slice characters or percentages. Whole-content recovery is allowed; arbitrary partial string recovery is not.

Reserved `content_kind` values such as `gist` remain schema vocabulary only. Step 3 does not synthesize a new gist unless an actual source representation exists to ground it.

### Target classification

Machine-grounded targets may use forms such as:

```text
memory_ref
memory_content + requested_selectors
```

Target outcomes remain:

```text
satisfied
partially_satisfied
failed
not_applicable
```

For `memory_content`, satisfaction is based on requested source selectors actually recovered. No numeric threshold is involved.

Ungrounded natural-language retrieval goals are not silently converted into embedding-based authoritative target identities. If target-related content surfaces but complete satisfaction cannot be established, the result remains conservative.

### Failed retrieval

The runtime distinguishes:

```text
no retrieval process occurred
```

from:

```text
a deliberate retrieval process occurred but the target was not recovered
```

This distinction is exposed to Character Brain through `retrieval_experience` even when:

```text
recovered_memories = []
```

### Non-target recovery

Target outcome and recovered-content relation are separate dimensions.

Therefore this is valid:

```text
initiation.mode = deliberate
target_outcome = failed
recovered_any_content = true

RecoveredFragment.target_relation = non_target
```

A target may remain unrecovered while another candidate memory surfaces.

### Spontaneous retrieval

Spontaneous retrieval does not imply a preceding deliberate attempt.

A spontaneous process with no explicit target may produce:

```text
initiation.mode = spontaneous
target_outcome = not_applicable
recovered_any_content = true
```

The presence of an environmental cue alone does not force spontaneous retrieval; initiation remains an explicit engine-side process decision.

## Step 3 recovered-content boundary

Phase63C produces two character-safe upstream outputs:

```text
recovered_memories
retrieval_experience
```

`recovered_memories` contains only actually materialized subjective content and character-meaningful source features.

It does not contain engine-only grounding data such as:

- `source_memory_ref`;
- JSON-pointer provenance;
- candidate-set hashes;
- candidate accessibility diagnostics;
- contacted-candidate engine refs.

`retrieval_experience` distinguishes process state without exposing engine internals:

```text
process_occurred
initiation_mode
target_outcome
recovered_any_content
```

After Character Runtime v3, `recovered_memories` is an **upstream retrieval-result channel**, not a bypass around Current Mind. Actual recovered content is reinstated into Runtime-owned Current Mind and its character-facing recollection semantics are exposed to Character Brain once through:

```text
cognition.working_context
```

with `context_origin = recovered_memory`.

The final Character Brain ingress does not duplicate the same recollection again through top-level `recovered_memories`, `cognition.recovered_memories`, or a second recovered-memory copy inside `cognition.attention`. `retrieval_experience` remains independently character-facing because retrieval process state is not the same semantic content as the recovered recollection.

## Step 4 boundary

Step 3 executes at most one retrieval step.

The following remain Step 4 responsibilities:

```text
multi-step retrieval search
internally reinstated cues
search-step continuation based on recovered context
```

If Step 3 receives internally reinstated cues or a multi-step resolution, it fails closed rather than silently performing Step 4 behavior.

## Step 5 boundary

Step 3 does not persist retrieval history.

The later intended authority chain remains:

```text
Phase63C retrieval result
→ explicit mutation proposal / transition
→ Phase62K authoritative mutation executor
→ world_state.retrieval_events
→ memory.retrieval_history references
→ rebuildable compatibility summaries
```

Therefore Step 3 does not update:

- `world_state.retrieval_events`;
- `memory.retrieval_history`;
- `recall_count`;
- `last_recalled_at`;
- storage strength;
- accessibility;
- memory confidence/content.

A completed retrieval must not retroactively rerun Phase63B in the same retrieval query cycle.

## Explicitly not modeled in Step 3

- universal retrieval probability;
- universal success threshold;
- arbitrary partial-recall percentage;
- unseeded kernel randomness;
- success = fixed strengthening;
- failure = fixed weakening;
- generic competitor debuff;
- retrieval-induced forgetting mutation;
- automatic confidence increase;
- automatic memory-content rewriting;
- source-confusion adjudication;
- consolidation / semanticization;
- automatic reconsolidation;
- multi-step search;
- internally reinstated cues;
- RetrievalEvent persistence.

## Current Phase63C Step 3 contract summary

```text
schema installed                         true
single-step retrieval runtime            true
multi-step retrieval runtime             false
candidate-content barrier                true
source-grounded fragment materialization true
resolver-authored memory content         false
Phase63C recovered-content channel       recovered_memories
retrieval experience channel             true
missing resolver => no process           true
candidate presence => automatic recall   false
failed retrieval supported               true
partial grounded recovery supported      true
non-target recovery supported            true
spontaneous retrieval supported          true
RetrievalEvent persistence               false
retrieval history mutation               false
same-cycle Phase63B history feedback     false
generic reinforcement                    false
RIF weakening                            false
source confusion                         false
reconsolidation                          false
```

## Step 4 — Multi-Step Retrieval Search / Internally Reinstated Cues

Step 4 adds a multi-step retrieval-process runtime without changing the Phase63C Step 5 persistence boundary.

The canonical process distinction is now:

```text
Frozen subjective-memory snapshot
!= current candidate frontier
```

One retrieval process freezes the character's subjective-memory records and the Phase63B base evaluation context. Each search step may nevertheless obtain a different current candidate frontier when actually recovered material grounds a selected internally reinstated cue.

### Staged resolver lifecycle

The native multi-step path uses three causally ordered resolver stages:

```text
initiation
-> recovery
-> kernel-grounded materialization
-> continuation / grounded cue selection
-> Phase63B re-evaluation
-> next recovery step
```

A resolver may not provide an entire future `steps[]` plan. Future-step candidate content must not influence an earlier-step decision.

The existing single-step `memoryRetrievalResolver` remains available as a Step 3 compatibility hook. The Step 4 native path uses `memoryRetrievalStageResolver` plus an explicit `memoryRetrievalTechnicalStepBudget`.

### Dynamic candidate frontiers

Phase63B remains the canonical cue/accessibility authority. Step 4 does not copy its cue matcher. Instead, it re-runs the same deterministic read-only Phase63B evaluator against the same frozen memory/context snapshot while replacing only the process-local selected internal cues.

A grounded retrieval target may be outside the initial frontier, but it must belong to the frozen subjective-memory snapshot. Its content remains hidden from the resolver until it actually enters the current frontier.

### Internally reinstated cues are grounded provenance

`internally_reinstated` is not used as the semantic cue kind in the native Step 4 path. A cue keeps its semantic kind, for example:

```text
semantic
spatial_context
subjective_episode
temporal
entity
```

and receives `source = phase63c_internal_reinstatement` when activated by the retrieval process.

Only cue links already grounded in a memory that actually produced recovered content may become potential reinstatement options. The kernel materializes those options from Phase63B's canonical memory cue links. The continuation resolver may select option references; it may not author a new cue kind or value.

Therefore:

```text
Recovered memory
!= all bound cues automatically reinstated

Potential cue option
!= selected active internal cue

Selected internal cue
!= guaranteed useful cue
```

### Recovery occurrences and cumulative target outcome

Repeated recovery of the same grounded content in different steps is retained as separate `RecoveryOccurrence` evidence. Final `recovered_memories` remains a unique grounded-content Phase63C projection. Character Runtime v3 may then reinstate that recovered content into Current Mind for final Character Brain exposure.

Target satisfaction is cumulative across steps and continues to use exact grounded selector membership rather than percentages or thresholds. Target satisfaction does not force process termination; continuation remains an explicit cognitive-control decision.

### Technical execution guard

The explicit technical step budget is an execution safety guard, not a model of human memory capacity or a cognitive stopping rule. If the budget is exhausted while the resolver still requests continuation, execution fails closed rather than inventing a psychological stop.

### Step 4 still does not persist retrieval history

Step 4 does not write `RetrievalEvent`, retrieval-history references, recall summaries, strengthening, weakening, source confusion, gist, semanticization, reconsolidation, or same-cycle Phase63B history feedback. Those ownership boundaries remain unchanged.

### Step 4 core invariant

```text
Frozen memory snapshot
!= frozen candidate frontier

Recovered content
!= automatically active cue

Potential internal cue
!= selected reinstated cue

Internally reinstated
= cue provenance
!= cue semantic kind

Earlier-step resolver
MUST NOT see later-step candidate content

Repeated recovery occurrence
!= duplicate content to erase

Step-local failure
!= process-level failure

Target satisfaction
!= mandatory termination

Technical execution limit
!= human cognitive stopping rule
```


## Step 5 — Immutable RetrievalEvent Persistence

Step 5 makes a completed retrieval process a persistent historical fact without inventing a universal psychological effect from retrieval.

The authority chain is:

```text
completed RetrievalProcess
→ canonical RetrievalEvent
→ per-memory MemoryRecovery
→ append-only retrieval-history references
→ Phase62K authoritative mutation
→ future turns may read history
```

Persistence itself does not strengthen or weaken memory, rewrite content or confidence, trigger retrieval-induced forgetting, or perform reconsolidation.

### Actual search path only

Canonical RetrievalEvent.search_steps stores only what actually happened:

- frontier identity/hash/count evidence;
- contacted memory refs;
- recovered fragment and recovery-occurrence refs;
- actually selected internally reinstated cues with source grounding;
- cumulative target outcome;
- actual continue/stop control action.

The full candidate frontier and unselected reinstatement cue options are not persisted as if they were subjective history.

### Per-memory recovery

Global target outcome is not used as a substitute for per-memory recovery truth. A target can fail while non-target content is actually recovered.

Each RetrievalEvent therefore stores MemoryRecovery records grouped by source memory. Failed grounded target attempts that produced no target content are indexed with the role `target_attempt_failed`.

### Append-only references and legacy baseline

Memory records keep lightweight retrieval-history references. Existing references are append-only and the pre-canonical legacy baseline is immutable.

Compatibility summaries are rebuildable:

```text
recall_count
= legacy baseline successful count
+ distinct canonical RetrievalEvents in which this memory produced content
```

RecoveryOccurrence count is not recall_count.

### Phase62K enforcement

`retrieval_events.<event_id>` is write-once. Existing events cannot be overwritten, edited through nested fields, or deleted.

Existing memory retrieval-history entries cannot be removed, reordered, or rewritten. Direct nested writes to retrieval-history fields are rejected. These invariants are enforced by Phase62K rather than by an `immutable: true` label alone.

### Turn ordering

The native turn order becomes:

```text
Phase63B accessibility
→ Phase63C retrieval
→ Character Brain / action
→ causal outcome
→ RetrievalEvent/history persistence through Phase62K
→ Phase63A current-turn memory formation
→ Phase62K
→ commit
```

Current-turn persisted retrieval history never reruns current-turn Phase63B. History becomes available only to future turns.

### Step 5 invariant

```text
RetrievalEvent = immutable historical fact
search_steps = actual path, not counterfactual options
MemoryRecovery = per-memory recovery authority
failed target attempt != no historical event
RetrievalHistoryReference = append-only index
legacy baseline = immutable pre-canonical summary
recall_count = rebuildable compatibility cache
RecoveryOccurrence != recall-count increment
history exists != automatic accessibility effect
retrieval != automatic strengthening / weakening / reconsolidation
```
