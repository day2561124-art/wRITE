# Fiction Sample Retrieval v2

## Scope

This workstream upgrades only the fiction-writing sample database ingestion and retrieval stack.
It does not modify story Canon, Google Drive project data, character state, or narrative memory.

## Existing production baseline

The external sample database lives at `E:\fiction_model_data\database_v1`.

The pre-v2 retrieval stack already contains:

- SQLite FTS5 trigram BM25: `indexes/canonical_passage_fts_v1.sqlite3`
- Qwen3 Embedding 0.6B 1024-d semantic index: `indexes/semantic_embeddings_v1.sqlite3`
- Reciprocal Rank Fusion in `tools/search_retrieval_index_v2.py`
- accepted/golden eligibility gating
- facet, novel, status, and profile filtering
- the legacy three-case hybrid regression

Retrieval v2 is therefore an additive upgrade, not a rewrite.

## Phase R0 — baseline freeze

R0 freezes the exact retrieval implementation and data artifacts before any reranker or contextual-retrieval changes.

The benchmark report records SHA-256 for:

- the benchmark definition;
- the active search script;
- `retrieval_index_v1.jsonl`;
- `canonical_passage_fts_v1.sqlite3`;
- `semantic_embeddings_v1.sqlite3`.

This makes future A/B reports attributable to exact code and exact indexes.

## Phase R1 — benchmark harness

Canonical source:

- `scripts/fiction-sample-retrieval-benchmark-v1.py`
- `tests/retrieval/benchmark_v1.json`
- `tests/retrieval/fiction-sample-retrieval-benchmark.test.mjs`

The seed benchmark deliberately preserves the three verified pre-v2 regression queries and their known-positive passage IDs.

The seed qrels are partial. Therefore:

- known-positive Recall/MRR are authoritative for R0/R1;
- invalid-status results are always authoritative failures;
- Precision and nDCG are emitted for continuity but are informational until each case has sufficiently complete qrels;
- the benchmark must be expanded before it becomes the acceptance gate for R2/R3 ranking changes.

This prevents a partially judged pool from falsely penalizing unjudged but genuinely useful passages.

## Metrics

The runner supports:

- known-positive Recall@K
- Precision@K
- MRR@K
- nDCG@K
- Bad@K
- Unique-novel@K
- latency p50
- latency p95

Relevance grades:

- 4: ideal
- 3: strong positive
- 2: usable
- 1: weak
- 0: irrelevant / unjudged default
- -1: harmful or misleading

Grades >= 2 count as relevant.
Grades < 0 count as harmful.

## UTF-8 contract

Benchmark definitions, queries, reports, and subprocess IO are UTF-8.
The regression test includes Traditional Chinese query text to prevent a recurrence of the old console/mojibake ambiguity.

## Running the real baseline

From the repository/worktree:

```powershell
$env:PYTHONIOENCODING='utf-8'
python scripts/fiction-sample-retrieval-benchmark-v1.py \
  --db-root 'E:\fiction_model_data\database_v1' \
  --benchmark tests/retrieval/benchmark_v1.json \
  --output 'E:\fiction_model_data\database_v1\benchmarks\retrieval_baseline_r0_v1.json'
```

The output file is a derived benchmark artifact and can be regenerated from the Git-tracked benchmark plus the recorded retrieval artifacts.

## Next phase

R2 may start only after R0/R1 is committed and the real baseline report is reproducibly generated.

R2 first challenger:

- Qwen3-Reranker-0.6B
- rerank only the existing hybrid candidate pool
- no production switch until the expanded benchmark shows improved ranking quality without unacceptable latency

R3 will add contextual retrieval only after R2 is independently measured.
