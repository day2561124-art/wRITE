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
