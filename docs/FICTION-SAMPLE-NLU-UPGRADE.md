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

## NLU-6 — Temporal / causal event relations

Repository artifacts:

- `config/fiction-nlu-event-relation-v1.json`
- `schemas/fiction-nlu-event-relation-v1.schema.json`
- `scripts/fiction-sample-nlu-event-relation-v1.py`
- `tests/nlu/fiction-sample-nlu-event-relation-v1.test.mjs`

NLU-6 consumes validated NLU-5 event clusters and never re-extracts events. It
builds bounded nearby event-pair candidates, then evaluates temporal and causal
relations separately.

Temporal storage normalizes directional labels to `temporal.before`;
`after(A,B)` is stored as `before(B,A)`. Symmetric temporal signals remain
`temporal.overlaps` or `temporal.simultaneous`. Critically, Passage or
narrative mention order is never substituted for story-world time. When evidence
does not support a temporal relation, the pair remains unresolved rather than
receiving a default before/after edge.

Causal relations are limited to `causal.causes`, `causal.enables`, and
`causal.prevents`, with a higher admission threshold than temporal relations.
Every stored relation requires exact canonical Passage evidence covering both
events. Causal direction is rejected when it conflicts with an admitted strict
temporal-before edge.

The strict `temporal.before` graph is checked globally for cycles. NLU-6 does not
materialize a transitive closure and does not claim a complete temporal or causal
graph; local pair decisions that would make the global graph inconsistent are
invalid.

Provider labels are defined relative to the supplied event pair, not narrative
position. A UTF-8 qwen3.5:9b pilot produced one validated temporal relation with
score 0.95 and no causal assertion. The empty causal result is accepted as the
intended conservative behavior rather than lowering the causal threshold.

Development output remains `provisional`,
`complete_temporal_graph_claim=false`,
`complete_causal_graph_claim=false`,
`narrative_order_used_as_story_time=false`, and
`retrieval_admission=not_admitted`.

## NLU-7 — Deterministic plot graph

Repository artifacts:

- `config/fiction-nlu-plot-graph-v1.json`
- `schemas/fiction-nlu-plot-graph-v1.schema.json`
- `scripts/fiction-sample-nlu-plot-graph-v1.py`
- `tests/nlu/fiction-sample-nlu-plot-graph-v1.test.mjs`

NLU-7 consumes validated NLU-5 event clusters and NLU-6 event relations. It is a
deterministic graph assembler, not another language-model inference layer.

Each validated `EVT-*` event cluster becomes exactly one `PLN-*` plot node.
Each admitted NLU-6 temporal or causal relation becomes exactly one `PLE-*`
plot edge retaining the source `ERL-*` relation ID, score, and evidence Passage
IDs. No narrative-adjacency edge is invented when NLU-6 contains no semantic
relation.

Weakly connected semantic subgraphs are materialized as deterministic `PLC-*`
components. Isolated events remain singleton components rather than being joined
merely because they appear next to each other in the text.

Temporal layers are derived only from admitted `temporal.before` edges using an
acyclic predecessor-layer calculation. Narrative Passage order is never used as
a story-time fallback or tie-breaker. Causal-only or temporally incomparable
events may therefore occupy the same temporal layer.

The full graph payload is bound to exact NLU-5 event-registry and NLU-6
event-relation-registry hashes. Validation rebuilds nodes, edges, components,
temporal layers, and graph statistics from the dependencies and rejects any
non-deterministic alteration.

NLU-7 deliberately does not assign salience, setup, payoff, climax, turning
point, main-plot, subplot, or other narrative-function labels. Those higher-order
interpretations remain NLU-8 responsibilities.

Development output remains `provisional`,
`complete_plot_graph_claim=false`,
`narrative_function_resolved=false`,
`salience_resolved=false`, and
`retrieval_admission=not_admitted`.

## NLU-8 — Narrative function and salience

Repository artifacts:

- `config/fiction-nlu-narrative-function-v1.json`
- `schemas/fiction-nlu-narrative-function-v1.schema.json`
- `scripts/fiction-sample-nlu-narrative-function-v1.py`
- `tests/nlu/fiction-sample-nlu-narrative-function-v1.test.mjs`

NLU-8 consumes a fully validated NLU-7 plot graph and keeps three distinct
layers: narrative-function labels, an independent salience score, and explicit
long-range narrative dependency links.

Function labels are multi-label and bounded per graph target. Each node or
component receives 5–9 graph-conditioned candidates, and the provider must score
every candidate rather than returning only salient labels. Candidate generation
uses semantic graph topology and does not use novel position or temporal layer as
a narrative-function prior.

High-risk labels have separate admission gates. `turning_point` requires
downstream graph support plus explicit downstream-consequence evidence;
`climax` requires explicit high-consequence evidence and at most one active
climax per component; `foreshadowing` and `payoff` require admitted
long-range dependency links. A high model score cannot bypass these gates.

Long-range links are limited to `setup_payoff`, `foreshadowing_payoff`, and
`callback`. They are never created from order alone and require exact canonical
Passage evidence covering both endpoints.

Salience is an independent 0–1 estimate with its own evidence and deterministic
graph-support features. It does not automatically activate any narrative-function
label and does not claim a complete ranking of the novel.

The runtime validates the full NLU-2 → NLU-5 → NLU-6 → NLU-7 lineage before
NLU-8 scoring. Provider evidence is normalized only when it is an exact substring
of the canonical NLU-5 event context associated with the referenced plot node.

A UTF-8 qwen3.5:9b pilot successfully scored all 16 bounded function candidates
for two targets, produced independent salience scores, and passed the independent
NLU-8 validator. On the single-event fixture it activated only lower-risk
`exposition` / `setup` labels and produced no high-risk narrative-function or
dependency assertion.

Development output remains `provisional`,
`complete_narrative_function_claim=false`,
`complete_salience_ranking_claim=false`,
`screenplay_structure_assumed=false`, and
`retrieval_admission=not_admitted`.

## NLU-9 — Explicit style features

Repository artifacts:

- `config/fiction-nlu-style-features-v1.json`
- `schemas/fiction-nlu-style-features-v1.schema.json`
- `scripts/fiction-sample-nlu-style-features-v1.py`
- `tests/nlu/fiction-sample-nlu-style-features-v1.test.mjs`

NLU-9 is a deterministic, parser-free stylometric layer over canonical Passage
text. It deliberately precedes learned style embeddings and author/novel style
profiles.

The first version records transparent surface measurements including Unicode/script
composition, sentence and paragraph rhythm, punctuation rates, quoted-dialogue
ratio, Han-character diversity/entropy, literal function-word rates, and
sentence-final particle rates. Sentence lengths use non-whitespace,
non-punctuation characters so Chinese fiction does not require a word tokenizer.

Each output is Passage-local and bound directly to the canonical Passage content
hash. Validation recomputes the complete payload from canonical text and rejects
any changed measurement. Short samples are retained but receive an explicit
sample-quality tier and warnings instead of being treated as stable style
evidence.

NLU-9 does not perform authorship attribution, quality scoring, semantic style
interpretation, embeddings, or style profiling. Parser/POS/dependency features
are intentionally excluded from v1 rather than introducing tokenizer/parser bias
into the deterministic baseline.

A direct smoke run against two real eligible database Passages produced two
records and both passed the independent validator. Focused regressions also verify
deterministic reproduction of the same analysis ID and payload, checkpoint resume,
dialogue/punctuation/marker measurements, and rejection of tampered feature
values.

Development output remains `provisional`,
`author_attribution_claim=false`,
`style_profile_claim=false`,
`semantic_quality_claim=false`, and
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
