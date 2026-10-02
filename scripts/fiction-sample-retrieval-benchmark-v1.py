from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path


DEFAULT_DB_ROOT = Path(r"E:\fiction_model_data\database_v1")
DEFAULT_SEARCH_REL = Path("tools") / "search_retrieval_index_v2.py"
DEFAULT_BENCHMARK = Path(__file__).resolve().parents[1] / "tests" / "retrieval" / "benchmark_v1.json"


def sha256_file(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dcg(grades: list[int], k: int) -> float:
    total = 0.0
    for index, grade in enumerate(grades[:k], start=1):
        gain = max(0, int(grade))
        if gain <= 0:
            continue
        total += (2**gain - 1) / math.log2(index + 1)
    return total


def case_metrics(results: list[dict], qrels: dict[str, int], k_values: list[int]):
    ids = [str(item.get("passage_id", "")) for item in results]
    relevant = {pid for pid, grade in qrels.items() if int(grade) >= 2}
    harmful = {pid for pid, grade in qrels.items() if int(grade) < 0}
    invalid_status = [
        pid
        for pid, item in zip(ids, results)
        if item.get("status") not in ("accepted", "golden")
    ]

    metrics: dict[str, float | int] = {}
    for k in k_values:
        top = ids[:k]
        hit_count = sum(1 for pid in relevant if pid in top)
        metrics[f"known_positive_recall@{k}"] = (
            hit_count / len(relevant) if relevant else 1.0
        )
        metrics[f"precision@{k}"] = (
            sum(1 for pid in top if int(qrels.get(pid, 0)) >= 2) / max(1, min(k, len(top)))
        )
        rr = 0.0
        for rank, pid in enumerate(top, start=1):
            if pid in relevant:
                rr = 1.0 / rank
                break
        metrics[f"mrr@{k}"] = rr

        observed_grades = [int(qrels.get(pid, 0)) for pid in top]
        ideal_grades = sorted(
            [max(0, int(grade)) for grade in qrels.values()],
            reverse=True,
        )
        ideal = dcg(ideal_grades, k)
        metrics[f"ndcg@{k}"] = dcg(observed_grades, k) / ideal if ideal > 0 else 1.0
        metrics[f"bad@{k}"] = sum(1 for pid in top if pid in harmful) + sum(
            1 for pid in invalid_status if pid in top
        )
        novels = {
            str(item.get("novel_id"))
            for item in results[:k]
            if item.get("novel_id") is not None
        }
        metrics[f"unique_novel@{k}"] = len(novels)

    return {
        "result_ids": ids,
        "invalid_status_results": invalid_status,
        "metrics": metrics,
    }


def average_metrics(cases: list[dict]) -> dict[str, float]:
    keys: set[str] = set()
    for case in cases:
        keys.update(case["metrics"].keys())
    output: dict[str, float] = {}
    for key in sorted(keys):
        values = [
            float(case["metrics"][key])
            for case in cases
            if key in case["metrics"]
        ]
        if values:
            output[key] = sum(values) / len(values)
    return output


def run_search(
    python: str,
    search_script: Path,
    case: dict,
    mode: str,
    limit: int,
    timeout_seconds: int,
):
    command = [
        python,
        str(search_script),
        case["query"],
        "--mode",
        case.get("mode", mode),
        "--limit",
        str(case.get("limit", limit)),
    ]
    for arg, key in (
        ("--status", "status"),
        ("--facet", "facet"),
        ("--novel-id", "novel_id"),
        ("--profile", "profile"),
    ):
        if case.get(key):
            command.extend([arg, str(case[key])])

    started = time.perf_counter()
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout_seconds,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    if completed.returncode != 0:
        raise RuntimeError(
            f"search failed ({completed.returncode}) for {case['id']}: "
            f"{completed.stderr or completed.stdout}"
        )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"search returned invalid JSON for {case['id']}: {completed.stdout[:1000]}"
        ) from error
    return payload, elapsed_ms


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(
        len(ordered) - 1,
        max(0, math.ceil((percentile_value / 100.0) * len(ordered)) - 1),
    )
    return float(ordered[index])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-root", type=Path, default=DEFAULT_DB_ROOT)
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_BENCHMARK)
    parser.add_argument("--search-script", type=Path)
    parser.add_argument("--mode", choices=["lexical", "semantic", "hybrid"], default="hybrid")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--timeout-seconds", type=int, default=90)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    db_root = args.db_root.resolve()
    benchmark_path = args.benchmark.resolve()
    search_script = (
        args.search_script.resolve()
        if args.search_script
        else (db_root / DEFAULT_SEARCH_REL).resolve()
    )

    benchmark = load_json(benchmark_path)
    if benchmark.get("schema_version") != "fiction_sample_retrieval_benchmark_v1":
        raise RuntimeError("unsupported benchmark schema_version")
    cases = benchmark.get("cases")
    if not isinstance(cases, list) or not cases:
        raise RuntimeError("benchmark cases must be a non-empty list")
    if not search_script.exists():
        raise RuntimeError(f"search script missing: {search_script}")

    k_values = sorted(
        {
            int(value)
            for value in benchmark.get("k_values", [5, 10])
            if int(value) > 0
        }
    )
    if not k_values:
        raise RuntimeError("benchmark k_values must contain positive integers")
    query_limit = max(args.limit, max(k_values))

    case_reports = []
    latencies = []
    for case in cases:
        if not case.get("id") or not case.get("query"):
            raise RuntimeError("each benchmark case requires id and query")
        qrels = {
            str(pid): int(grade)
            for pid, grade in (case.get("qrels") or {}).items()
        }
        payload, elapsed_ms = run_search(
            sys.executable,
            search_script,
            case,
            args.mode,
            query_limit,
            args.timeout_seconds,
        )
        results = payload.get("results") or []
        measured = case_metrics(results, qrels, k_values)
        latencies.append(elapsed_ms)
        case_reports.append(
            {
                "id": case["id"],
                "category": case.get("category"),
                "query": case["query"],
                "qrels_complete": bool(case.get("qrels_complete", False)),
                "qrels": qrels,
                "elapsed_ms": round(elapsed_ms, 3),
                **measured,
            }
        )

    macro = average_metrics(case_reports)
    macro["latency_p50_ms"] = percentile(latencies, 50)
    macro["latency_p95_ms"] = percentile(latencies, 95)

    qrels_complete = all(case["qrels_complete"] for case in case_reports)
    report = {
        "schema_version": "fiction_sample_retrieval_benchmark_report_v1",
        "benchmark_id": benchmark.get("benchmark_id"),
        "benchmark_sha256": sha256_file(benchmark_path),
        "qrels_complete": qrels_complete,
        "metric_policy": {
            "relevant_grade_minimum": 2,
            "harmful_grade_maximum": -1,
            "unjudged_grade": 0,
            "acceptance_note": (
                "Precision/nDCG are informational until qrels_complete=true; "
                "known-positive recall/MRR and invalid-status checks are authoritative in seed R0/R1."
            ),
        },
        "retrieval": {
            "mode": args.mode,
            "limit": query_limit,
            "search_script": str(search_script),
            "search_script_sha256": sha256_file(search_script),
            "db_root": str(db_root),
            "artifacts": {
                "retrieval_index_v1": sha256_file(db_root / "indexes" / "retrieval_index_v1.jsonl"),
                "canonical_passage_fts_v1": sha256_file(db_root / "indexes" / "canonical_passage_fts_v1.sqlite3"),
                "semantic_embeddings_v1": sha256_file(db_root / "indexes" / "semantic_embeddings_v1.sqlite3"),
            },
        },
        "case_count": len(case_reports),
        "macro": macro,
        "cases": case_reports,
    }

    encoded = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        output = args.output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        temp = output.with_name(output.name + f".tmp_{os.getpid()}")
        temp.write_text(encoded, encoding="utf-8")
        os.replace(temp, output)
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
