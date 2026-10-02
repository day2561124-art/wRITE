# Fiction Sample NLU Upgrade

Status: NLU-0 implementation baseline
External sample database: `E:\fiction_model_data\database_v1`
Retrieval v2 is a separate workstream and remains authoritative for index/search/rerank behavior.

## Boundary

This line is additive. It must not rewrite canonical `Novel`, `Scene`, `Passage`,
quality-review, retrieval-index, FTS, embedding, or reranker artifacts.

NLU output is stored as separate versioned analysis records that reference canonical
IDs and exact content hashes. Retrieval does not consume NLU output until a later
integration phase explicitly admits it.

The existing Passage semantic labels remain retrieval hints. Their deferred fields
(`entity_canonicalization`, `speaker_attribution`, `relationship_truth`,
`deep_emotion`, and `plot_outcome`) are implemented by this deeper NLU line
instead of mutating the legacy hint taxonomy in place.

## NLU-0 — Shared analysis contract

Canonical repository schema:

`schemas/fiction-nlu-analysis-record-v1.schema.json`

Validator / deterministic ID tool:

`scripts/fiction-sample-nlu-contract-v1.py`

Contract properties:

- one immutable analysis identity per subject hash + analysis version + method + input hash;
- subject may be a canonical Passage, Scene, or Novel;
- every subject is pinned to the current canonical content hash;
- every analysis carries non-empty Passage evidence;
- optional evidence spans are passage-relative and can be bound by `quote_sha256`;
- method, confidence, provenance, and analysis status are explicit;
- payload is analysis-kind-specific and remains evolvable;
- retrieval admission is an explicit separate contract and is closed by default.

The validator rejects stale subject hashes, stale evidence hashes, broken
Passage→Scene/Novel lineage, invalid evidence spans, duplicate analysis IDs, and
retrieval admission while NLU and Retrieval v2 are developed independently.

### CLI

Validate a future JSONL analysis artifact:

```powershell
python scripts/fiction-sample-nlu-contract-v1.py validate `
  --db-root E:\fiction_model_data\database_v1 `
  --input <analysis.jsonl>
```

Generate the deterministic `analysis_id` for one JSON object:

```powershell
python scripts/fiction-sample-nlu-contract-v1.py make-id --input <record.json>
```

`--allow-retrieval-admission` is reserved for the later integration phase. It must
not be enabled during independent NLU production/backfill.

## Planned phases

| Phase | Scope | Primary output |
| --- | --- | --- |
| NLU-0 | shared additive contract | versioned analysis records |
| NLU-1 | hierarchical multi-label classification | semantic classification payloads |
| NLU-2 | character mention resolution | character entities / mentions |
| NLU-3 | document-level relationship extraction | directional relation edges |
| NLU-4 | relationship state over time | relationship timelines |
| NLU-5 | event extraction / event coreference | event records |
| NLU-6 | temporal and causal relations | event relation graph |
| NLU-7 | scene/chapter/novel plot composition | plot graph |
| NLU-8 | narrative-function classification | setup/payoff/turning-point/etc. |
| NLU-9 | explainable stylometry | explicit style features |
| NLU-10 | content-separated style representation | style embeddings |
| NLU-11 | hierarchical style aggregation | passage/scene/novel profiles |
| NLU-12 | full-database backfill | populated analysis store |
| NLU-13 | certification | regression and consistency report |

NLU-9 through NLU-11 may run in parallel with the character/event branch because
they do not depend on entity or event graph completion.

## NLU-1 — Hierarchical multi-label semantic classification

Repository artifacts:

- `config/fiction-nlu-semantic-taxonomy-v2.json`
- `schemas/fiction-nlu-semantic-classification-v2.schema.json`
- `scripts/fiction-sample-nlu-classify-v2.py`
- `tests/nlu/fiction-sample-nlu-classification-v2.test.mjs`

NLU-1 keeps deterministic observable discourse separate from inferred semantic
labels. The current taxonomy contains five dimensions: discourse, activity,
interaction, emotion signal, and tension. Candidate generation is bounded per
inferred dimension and uses legacy retrieval facets plus lexical hints only to
prioritize candidates; those hints do not become canonical truth.

The classifier provider is pluggable. The built-in heuristic provider exists for
contract/regression testing. The Ollama provider scores candidates by dimension,
turns model thinking off, requires every supplied candidate to be scored, and
performs one bounded completion retry for omitted candidates. Active inferred
labels require exact passage-local evidence spans; an above-threshold score with no
valid evidence is not activated.

Output remains `provisional`, includes per-label scores/evidence and hierarchy
checks, and always carries `retrieval_admission.state = not_admitted`.

External database installation is additive under `database_v1/analysis` plus
versioned schema/taxonomy files. The formal semantic-classification store begins
empty; development pilots are not persisted into it. Canonical Passage enumeration
uses `records/passages_v1.jsonl` directly rather than manifest counts so metadata
lag cannot omit newly added passages.

## NLU-2 — Character mention / entity resolution

Repository artifacts:

- `config/fiction-nlu-character-resolution-v1.json`
- `schemas/fiction-nlu-character-resolution-v1.schema.json`
- `scripts/fiction-sample-nlu-character-resolve-v1.py`
- `tests/nlu/fiction-sample-nlu-character-resolution-v1.test.mjs`

NLU-2 is novel-local and conservative. Character entities may be created only
from explicit proper-name anchors. Pronouns and nominal mentions may link only to
an already anchored entity and never create entities themselves. First- and
second-person pronouns remain unresolved because speaker attribution is owned by
a later phase.

Long fiction is processed in bounded overlapping windows. The model first returns
unique proper-name anchors; the producer deterministically expands every observed
occurrence and then sends only bounded third-person pronoun candidates for linking.
This avoids asking a model to emit hundreds of mention rows in one response and
reduces book-scale over-merging risk.

Each mention stores both Passage-relative and Novel-absolute spans, exact content
hashes, and a uniquely locating context hash. Character IDs are deterministic and
scoped by `novel_id + normalized canonical anchor`.

Provider-suggested alias merges are never silent. A merge emits a deterministic
`MRG-*` event with:

- the surviving canonical entity;
- the absorbed deterministic entity identity;
- proper-anchor evidence for both the canonical and alias surfaces;
- an explicit reason and confidence.

The validator rejects merges lacking either side of the proper-anchor evidence,
self-merges, active absorbed entities, missing mention lineage, non-deterministic
IDs, or span/hash mismatches.

Development output remains `provisional`, never claims complete-novel truth, does
not infer relationship truth, and always keeps retrieval admission closed. Formal
external storage begins empty; real-model pilots are validation evidence only and
are not persisted into the production analysis store.

## NLU-3 — Document-level character relationship extraction

Repository artifacts:

- `config/fiction-nlu-character-relationship-v1.json`
- `schemas/fiction-nlu-character-relationship-v1.schema.json`
- `scripts/fiction-sample-nlu-relationship-extract-v1.py`
- `tests/nlu/fiction-sample-nlu-character-relationship-v1.test.mjs`

NLU-3 consumes validated NLU-2 character-resolution records. It never creates,
renames, or merges characters itself. Relationship candidate windows are built
from already-linked character mentions and are bounded by local Passage adjacency
instead of evaluating every novel-level entity pair.

The taxonomy separates relatively persistent social-role signals from dynamic
affective and behavioral stances. One entity pair may therefore carry multiple
simultaneous local assertions. Symmetric relations use one canonical ordered pair;
directed relations score A->B and B->A independently.

Every active relationship assertion must:

- exceed the configured relation-specific threshold;
- contain exact canonical Passage evidence;
- preserve NLU-2 supporting mention IDs;
- cover both relationship entities inside the cited evidence;
- bind to a deterministic `REL-*` identity and a deterministic pair window;
- declare an evidence-window scope rather than a relationship lifetime.

The payload is bound to the exact NLU-2 entity registry hash. If character
entities, mentions, or merge evidence change, old relationship output is rejected
rather than silently reused.

A completed analysis may legitimately contain zero positive assertions. In that
case the NLU-0 analysis record retains canonical Passage-level provenance while
the relationship payload remains empty; the producer never invents a positive
relationship merely to satisfy the outer evidence contract.

Development output remains `provisional`, `complete_relationship_claim=false`,
and `retrieval_admission=not_admitted`. Relationship state transitions and
conflict resolution across time are owned by NLU-4 rather than collapsed in this
phase.

## NLU-4 — Character relationship timeline / evolution

Repository artifacts:

- `config/fiction-nlu-character-relationship-timeline-v1.json`
- `schemas/fiction-nlu-character-relationship-timeline-v1.schema.json`
- `scripts/fiction-sample-nlu-relationship-timeline-v1.py`
- `tests/nlu/fiction-sample-nlu-character-relationship-timeline-v1.test.mjs`

NLU-4 is a deterministic compiler over validated NLU-3 relationship output. It
does not call a language model and does not re-extract relationships. Its job is
to organize local NLU-3 pair windows and assertions into a globally consistent,
evidence-preserving narrative-order timeline.

Each character pair receives:

- ordered evidence snapshots for every analyzed NLU-3 pair window, including
  windows with zero positive assertions;
- one deterministic track per relation + direction + source/target identity;
- adjacent-snapshot change events that distinguish first support, reinforcement,
  changed evidence, and evidence becoming unobserved;
- explicit conflict events for configured locally contradictory relation signals;
- reciprocity events when the same directed relation is independently observed in
  both directions.

Absence is deliberately represented as `not_observed_not_ended`. NLU-4 never
infers that a relationship ended, weakened, reconciled, or changed causally merely
because a later window lacks evidence. Concurrent or contradictory assertions are
preserved rather than resolved by last-write-wins.

Ordering is canonical narrative Passage order using NLU-3 novel offsets. The
payload explicitly declares `nonlinear_story_time_resolved=false`; story-world
chronology is not inferred in this phase.

The timeline payload is bound to the exact NLU-3 relationship registry hash.
Validation deterministically rebuilds the entire timeline from the dependency and
rejects any altered snapshot, track, change event, conflict event, reciprocity
event, or stale NLU-3 lineage.

Development output remains `provisional`,
`complete_relationship_history_claim=false`, and
`retrieval_admission=not_admitted`.

## NLU-5 — Narrative event extraction / event coreference

Repository artifacts:

- `config/fiction-nlu-event-analysis-v1.json`
- `schemas/fiction-nlu-event-analysis-v1.schema.json`
- `scripts/fiction-sample-nlu-event-extract-v1.py`
- `tests/nlu/fiction-sample-nlu-event-analysis-v1.test.mjs`

NLU-5 introduces event mentions as first-class evidence records. Each event mention
must cite an exact trigger span and exact context in a canonical Passage. Character
arguments may bind to validated NLU-2 `CHR-*` / `MEN-*` identities; arguments
that cannot be grounded remain literal spans rather than invented character
entities.

Event coreference is deliberately conservative. Singleton event clusters are the
default, and equal trigger text, equal event type, or equal participants do not
automatically imply the same event occurrence. A multi-mention cluster requires
explicit bounded coreference evidence above the configured threshold, matching
event type, compatible grounded participants, and a connected graph of
`ECL-*` links.

The event taxonomy covers bounded narrative actions and state transitions such as
movement, communication, perception, cognition, affect expression, social
interaction, possession transfer, conflict actions, state change, and routine
activity. NLU-5 does not infer temporal order, causality, enabling/preventing
relations, or plot importance; those remain downstream responsibilities.

The provider supports heuristic regression mode and Ollama extraction. A UTF-8
qwen3.5:9b pilot produced three validated event mentions from one short fiction
Passage: movement (`走進`), communication (`說`), and perception
(`看向`). All remained singleton clusters because no explicit same-event
coreference evidence was present. Independent NLU-5 validation passed.

Development output remains `provisional`,
`complete_event_inventory_claim=false`,
`temporal_relations_resolved=false`,
`causal_relations_resolved=false`, and
`retrieval_admission=not_admitted`.

## Retrieval integration rule

NLU-12 full backfill and any production retrieval dependency remain deferred until
the Retrieval v2 core is sealed. At integration time:

1. freeze exact versions of the NLU schema and producer;
2. certify NLU output against canonical content hashes;
3. explicitly map admitted NLU fields into retrieval filters/scoring/reranking;
4. reindex once using the sealed retrieval contract;
5. compare retrieval regression/benchmark results before making NLU-derived fields
   production dependencies.

This avoids concurrent writes to the retrieval index while allowing the
understanding line to progress independently.
