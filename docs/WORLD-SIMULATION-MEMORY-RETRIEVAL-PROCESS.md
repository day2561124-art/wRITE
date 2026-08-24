# Phase63C — Actual Memory Retrieval Process / Immutable Retrieval Events

Phase63C models the boundary between a memory being a reasonable retrieval candidate and subjective memory content actually becoming available to the character.

Its canonical question is:

```text
What retrieval process actually occurred,
and what subjective content actually surfaced?
```

It does not treat a Phase63B candidate as already recalled.

## Research-informed boundary

Phase63C follows several conservative conclusions from retrieval research:

- retrieval effort/search and retrieval success are separable;
- successful recovery, precision, vividness, and confidence are not one scalar;
- unsuccessful retrieval attempts are real events rather than no-ops;
- spontaneous / involuntary retrieval can occur without a deliberate retrieval attempt;
- retrieval can unfold over multiple search steps;
- recovered context can supply internally reinstated cues for later steps in the same retrieval process;
- non-target information may surface during search;
- retrieval-induced forgetting and reconsolidation do not justify universal fixed simulator rules.

The simulator therefore records retrieval structure without inventing a universal success threshold, reinforcement constant, competitor penalty, or retrieval probability.

## Phase ownership

The intended chain is:

```text
Phase63A
subjective memory formation

Phase63B
current candidate accessibility

Phase63C
actual retrieval process
→ recovered subjective content
→ immutable RetrievalEvent

Phase63D
source monitoring / source confusion / distortion

Phase63E
consolidation / gist / semanticization

Phase63F
conditional reconsolidation / updating
```

Phase63C does not perform generic strengthening, forgetting, source confusion, consolidation, or reconsolidation.

## Step 1 status

Step 1 installs schema and contract foundations only.

It deliberately does not yet activate the native retrieval-process runtime.

Therefore:

```text
retrieval_process_schema_installed = true
retrieval_event_schema_installed = true

retrieval_process_execution_installed = false
retrieval_event_persistence_installed = false

candidate_content_barrier_enforced = false
```

The candidate-content information barrier is owned by Phase63C Step 2.

Existing `world_memory_retriever` behavior remains available during Step 1 for compatibility.

## Step 2 status

Step 2 installs the candidate-content information barrier in the native world-loop path.

The canonical Character Brain memory channel is now:

```text
recovered_memories
```

The actual retrieval kernel is still not active, so:

```text
recovered_memories = []
```

until Phase63C later installs real recovery behavior.

The Phase63B candidate set and the legacy projector may still exist engine-side for compatibility and audit, but their unretrieved content is not forwarded to native cognition or Character Brain.

The deprecated `retrieved_memories` field in the native Brain packet now aliases only `recovered_memories`; it no longer aliases `projected_memories`.

## Canonical objects

### MemoryRetrievalQuery

A query freezes the Phase63B candidate environment for one retrieval process.

Canonical fields include:

```text
query_id
character
turn_id
phase63b_version
candidate_set_hash
candidate_count
initial_cues
retrieval_goal
candidate_refs
```

The query is engine-side.

The query object itself contains no candidate memory content and is not forwarded to Character Brain.

This query-local property must not be confused with the system-wide candidate-content barrier: during Step 1 the legacy projected-memory path still exists, so the global barrier remains unenforced until Step 2.

Candidate references contain memory identities and candidate order, not duplicated memory content.

The candidate-set hash may be calculated from the complete engine-owned candidate snapshot without exposing that snapshot through the query object.

### RetrievalProcess

A RetrievalProcess is transient runtime state.

It may represent deliberate or spontaneous retrieval.

It may contain zero or more search steps.

It is not itself persistent retrieval history.

Initiation mode:

```text
deliberate
spontaneous
```

Trigger origin:

```text
self_generated
external_prompt
environmental_cue
internally_reinstated_cue
unspecified
```

Retrieval-task mode:

```text
free_recall
cued_recall
recognition
source_query
associative_recall
unspecified
```

Initiation mode and retrieval-task mode are deliberately separate dimensions.

### RetrievalStep

A step may contain:

```text
active_cues
contacted_candidate_refs
recovered_fragments
reinstated_cues
target_relation
termination_after_step
```

Contacted candidate references are engine-internal process evidence.

They are not character-visible content.

### RecoveredFragment

RecoveredFragment represents subjective content that actually surfaced.

Content kinds currently reserved by the schema are:

```text
gist
detail
sensory_fragment
relational_fragment
identity_fragment
semantic_fragment
unspecified
```

The schema does not attach an arbitrary recovery percentage.

A later `partially_satisfied` target outcome must be grounded in actual recovered content and target relation rather than a numeric threshold.

### RetrievalEvent

A RetrievalEvent is required by the Phase63C architecture to become an immutable committed historical representation of a completed retrieval process.

Step 1 installs that requirement but does not yet enforce persistence-time immutability. Runtime enforcement belongs to the later persistence integration step.

Its intended authority is:

```text
world_state.retrieval_events
```

The event records process structure, recovered content, target outcome, termination, and engine audit references.

Target outcomes are:

```text
satisfied
partially_satisfied
failed
not_applicable
```

This permits spontaneous recovery without falsely labeling it a deliberate success:

```text
initiation.mode = spontaneous
target = null
target_outcome = not_applicable
recovered_any_content = true
```

### Retrieval-history reference

Persistent memory records should eventually reference authoritative RetrievalEvents rather than duplicate complete events.

Step 1 reserves an append-only retrieval-history contract, but append-only mutation enforcement is not installed yet.

Reserved roles are:

```text
recovered
partially_recovered
non_target_recovered
```

The schema deliberately does not yet assign `contacted_not_recovered` or `targeted_not_recovered` to a memory record because a failed search does not necessarily justify identifying one specific stored trace as the failed target.

## Persistent authority

The intended authority chain is:

```text
world_state.retrieval_events
↓
memory.retrieval_history references
↓
derived compatibility summaries
↓
recall_count
last_recalled_at
```

Therefore `recall_count` and `last_recalled_at` are rebuildable summaries rather than canonical retrieval history.

## Mutation ownership

Phase63C must not directly mutate persistent World State.

The intended mutation path is:

```text
Phase63C retrieval result
→ explicit mutation proposal / transition
→ Phase62K authoritative mutation executor
→ atomic world-state commit
```

This preserves the existing single authoritative mutation boundary.

## Same-cycle boundary

The intended causal order is:

```text
Phase63B accessibility
→ freeze candidate set
→ Phase63C RetrievalProcess
→ internally reinstated cues may drive later process steps
→ process terminates
→ RetrievalEvent prepared
→ authoritative mutation / commit
→ next simulation cycle
→ Phase63B may consume formally supported prior retrieval history
```

Internally reinstated cues may affect later steps inside the same RetrievalProcess.

A newly committed RetrievalEvent must not retroactively rerun Phase63B for the same query.

## Candidate-content barrier

The final native Phase63C architecture requires:

```text
unretrieved candidate memory content
MUST NOT reach Character Brain
```

Step 2 now enforces this barrier in the native world-loop path.

Phase63B candidate content remains engine-side. The legacy projector may still be invoked for compatibility and trace continuity, but its output is not inserted into native cognition or Character Brain.

Because the actual Phase63C retrieval kernel is not installed yet, the native recovered-memory channel is intentionally empty rather than falling back to candidate content.

## Compatibility projector

The existing:

```text
world_memory_retriever
```

remains a compatibility candidate-context projector.

Its direct capability API is preserved, but in the native world-loop path its projected content is engine-only and is not forwarded to Character Brain.

It is not redefined as the native Phase63C retrieval mechanism.

The planned native retrieval-process implementation belongs to the Phase63C retrieval-process service.

## Explicitly not modeled

Phase63C does not introduce:

- universal retrieval probability;
- universal success threshold;
- arbitrary partial-recall percentage;
- unseeded random retrieval;
- fixed recall reinforcement;
- fixed failed-retrieval weakening;
- fixed competitor weakening;
- automatic confidence increase;
- automatic memory-content rewriting;
- source-confusion adjudication;
- consolidation;
- automatic reconsolidation.

## Current Phase63C Step 2 contract summary

```text
schema installed                       true
runtime retrieval execution            false
RetrievalEvent persistence             false
RetrievalEvent immutability required   true
RetrievalEvent immutability enforced   false
retrieval history append-only required true
retrieval history append-only enforced false
candidate-content barrier              true
native Brain memory channel            recovered_memories
native recovery before kernel          []
legacy projector API preserved         true
legacy projection forwarded to Brain   false
same-cycle Phase63B history feedback   false
generic reinforcement                  false
RIF weakening                          false
source confusion                       false
reconsolidation                        false
```
