from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import runpy
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TAXONOMY_VERSION = "fiction_nlu_semantic_taxonomy_v2"
PAYLOAD_SCHEMA_VERSION = "fiction_nlu_semantic_classification_v2"
REQUEST_VERSION = "fiction_nlu_classification_request_v2"
ANALYSIS_VERSION = "semantic_classification_v2"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu1Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu1Error(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    require(isinstance(value, dict), f"{path} must contain a JSON object")
    return value


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise Nlu1Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            require(isinstance(value, dict), f"{path}:{line_number}: record must be an object")
            rows.append(value)
    return rows


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(tmp_name, path)
    finally:
        try:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)
        except OSError:
            pass


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, sort_keys=True))
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())


def load_taxonomy(path: Path) -> tuple[dict[str, Any], str]:
    taxonomy = load_json(path)
    require(taxonomy.get("taxonomy_version") == TAXONOMY_VERSION, "unexpected taxonomy_version")
    raw = canonical_json(taxonomy)
    return taxonomy, sha256_text(raw)


def flatten_labels(taxonomy: dict[str, Any]) -> dict[str, dict[str, Any]]:
    labels: dict[str, dict[str, Any]] = {}
    for dimension_name, dimension in taxonomy["dimensions"].items():
        for label_id, spec in dimension["labels"].items():
            require(label_id.startswith(dimension_name + "."), f"{label_id} does not belong to {dimension_name}")
            require(label_id not in labels, f"duplicate taxonomy label: {label_id}")
            labels[label_id] = {
                **spec,
                "dimension": dimension_name,
                "selection": dimension["selection"],
                "inference": dimension["inference"],
            }
    return labels


def load_passages(db_root: Path) -> list[dict[str, Any]]:
    path = db_root / "records" / "passages_v1.jsonl"
    require(path.is_file(), f"missing canonical passages: {path}")
    rows = load_jsonl(path)
    ids = [row.get("passage_id") for row in rows]
    require(len(ids) == len(set(ids)), "canonical passage ids are not unique")
    return rows


def dialogue_bucket_from_text(text: str) -> str:
    spans = re.findall(r"「(.*?)」|“(.*?)”", text, flags=re.S)
    dialogue_chars = 0
    for a, b in spans:
        dialogue_chars += len(a or b)
    ratio = dialogue_chars / max(1, len(text))
    if ratio >= 0.45:
        return "dialogue_heavy"
    if ratio >= 0.15:
        return "mixed_dialogue_narration"
    return "narration_heavy"


def canonical_discourse_label(passage: dict[str, Any]) -> str:
    legacy = passage.get("semantic_labels") or {}
    discourse = legacy.get("discourse") or {}
    bucket = discourse.get("bucket")
    if bucket not in {"dialogue_heavy", "mixed_dialogue_narration", "narration_heavy"}:
        bucket = dialogue_bucket_from_text(passage.get("text", ""))
    return "discourse." + bucket


def lexical_hits(text: str, hints: list[str]) -> tuple[int, list[str]]:
    hits: list[str] = []
    count = 0
    for hint in hints:
        n = text.count(hint)
        if n:
            count += n
            hits.append(hint)
    return count, hits


def candidate_labels(passage: dict[str, Any], taxonomy: dict[str, Any]) -> list[str]:
    text = passage.get("text") or ""
    legacy = passage.get("semantic_labels") or {}
    active_facets = set(legacy.get("active_facets") or [])
    policy = taxonomy["candidate_policy"]
    selected = [canonical_discourse_label(passage)]

    for dimension_name, dimension in taxonomy["dimensions"].items():
        if dimension_name == "discourse":
            continue
        scored: list[tuple[float, str]] = []
        defaults = set(dimension.get("defaults") or [])
        for label_id, spec in dimension["labels"].items():
            priority = 2.0 if label_id in defaults else 0.0
            if any(facet in active_facets for facet in spec.get("legacy_facets") or []):
                priority += float(policy.get("legacy_hint_boost", 3))
            hit_count, _ = lexical_hits(text, spec.get("lexical_hints") or [])
            priority += min(3, hit_count) * float(policy.get("lexical_hint_boost", 1))
            scored.append((priority, label_id))
        scored.sort(key=lambda item: (-item[0], item[1]))
        minimum = int(policy.get("min_candidates_per_inferred_dimension", 3))
        maximum = int(policy.get("max_candidates_per_inferred_dimension", 6))
        keep = [label_id for _, label_id in scored[:maximum]]
        if len(keep) < minimum:
            keep.extend(label_id for _, label_id in scored[len(keep):minimum])
        selected.extend(keep)

    return selected


def build_request(
    passage: dict[str, Any],
    taxonomy: dict[str, Any],
    taxonomy_sha256: str,
) -> dict[str, Any]:
    labels = flatten_labels(taxonomy)
    candidates = candidate_labels(passage, taxonomy)
    candidate_specs = []
    for label_id in candidates:
        spec = labels[label_id]
        candidate_specs.append(
            {
                "label_id": label_id,
                "dimension": spec["dimension"],
                "description": spec["description"],
                "threshold": spec["threshold"],
            }
        )
    return {
        "request_version": REQUEST_VERSION,
        "taxonomy_version": TAXONOMY_VERSION,
        "taxonomy_sha256": taxonomy_sha256,
        "passage_id": passage["passage_id"],
        "content_sha256": passage["content_sha256"],
        "text": passage["text"],
        "candidates": candidate_specs,
        "response_contract": {
            "labels": [
                {
                    "label_id": "candidate label id",
                    "score": "number from 0 to 1",
                    "evidence_quotes": ["exact substring from passage; required when score meets threshold"],
                }
            ]
        },
        "instructions": [
            "Score every supplied non-discourse candidate independently; do not force one dominant label.",
            "Use only the supplied passage. Labels are semantic signals, not canonical facts about characters or plot.",
            "Return exact evidence substrings for scores that meet the supplied threshold.",
            "Do not return labels that were not supplied.",
            "Do not include chain-of-thought or free-form explanation.",
        ],
    }


def make_span(text: str, quote: str) -> dict[str, Any] | None:
    quote = quote.strip()
    if not quote:
        return None
    start = text.find(quote)
    if start < 0:
        return None
    end = start + len(quote)
    return {
        "span_start": start,
        "span_end": end,
        "quote_sha256": sha256_text(text[start:end]),
    }


def compact_evidence(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if not stripped:
        return {"span_start": 0, "span_end": 1, "quote_sha256": sha256_text(" ")}
    start = text.find(stripped)
    quote = stripped[: min(32, len(stripped))]
    end = start + len(quote)
    return {"span_start": start, "span_end": end, "quote_sha256": sha256_text(text[start:end])}


def heuristic_provider(
    request: dict[str, Any],
    passage: dict[str, Any],
    taxonomy: dict[str, Any],
) -> dict[str, Any]:
    text = passage["text"]
    legacy = passage.get("semantic_labels") or {}
    active_facets = set(legacy.get("active_facets") or [])
    labels = flatten_labels(taxonomy)
    output = []
    for candidate in request["candidates"]:
        label_id = candidate["label_id"]
        if label_id.startswith("discourse."):
            continue
        spec = labels[label_id]
        count, matched = lexical_hits(text, spec.get("lexical_hints") or [])
        legacy_hit = any(f in active_facets for f in spec.get("legacy_facets") or [])
        if legacy_hit and count:
            score = 0.90
        elif legacy_hit:
            score = 0.82
        elif count >= 2:
            score = 0.78
        elif count == 1:
            score = 0.68
        elif label_id in set(taxonomy["dimensions"][spec["dimension"]].get("defaults") or []):
            score = 0.38
        else:
            score = 0.18
        quotes = []
        for hint in matched[:2]:
            if hint in text:
                quotes.append(hint)
        output.append({"label_id": label_id, "score": score, "evidence_quotes": quotes})
    return {"labels": output}


def _ollama_score_batch(
    text: str,
    candidates: list[dict[str, Any]],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> list[dict[str, Any]]:
    candidate_lines = [
        f'- {item["label_id"]} | threshold={item["threshold"]:.2f} | {item["description"]}'
        for item in candidates
    ]
    required_ids = [item["label_id"] for item in candidates]
    system = (
        "You are a bounded fiction passage multi-label classifier. "
        "Return JSON only. You MUST return exactly one row for every supplied label_id, including labels "
        "whose score is low. Score candidates independently from 0 to 1. For scores at or above the supplied "
        "threshold, include 1-3 exact substrings copied from the passage as evidence_quotes. For low scores, "
        "evidence_quotes may be empty. Do not invent labels, facts, character identities, relationships, "
        "plot canon, or explanations. Never provide chain-of-thought."
    )
    user = (
        "PASSAGE:\n"
        + text
        + "\n\nCANDIDATES:\n"
        + "\n".join(candidate_lines)
        + "\n\nREQUIRED LABEL IDS:\n"
        + json.dumps(required_ids, ensure_ascii=False)
        + f"\n\nReturn exactly {len(required_ids)} rows in: "
        + "{\"labels\":[{\"label_id\":\"...\",\"score\":0.0,\"evidence_quotes\":[\"...\"]}, ...]}"
    )
    payload = {
        "model": model,
        "stream": False,
        "format": "json",
        "think": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "options": {"temperature": 0, "num_predict": 1000},
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    http_request = urllib.request.Request(
        url.rstrip("/") + "/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise Nlu1Error(f"ollama provider failed: {exc}") from exc
    content = ((raw.get("message") or {}).get("content") or "").strip()
    require(content, "ollama returned empty content")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise Nlu1Error(f"ollama returned invalid JSON: {exc}") from exc
    require(isinstance(parsed, dict), "ollama response must be an object")
    rows = parsed.get("labels")
    require(isinstance(rows, list), "ollama response.labels must be an array")
    return rows


def ollama_provider(
    request: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    by_dimension: dict[str, list[dict[str, Any]]] = {}
    for item in request["candidates"]:
        if item["dimension"] == "discourse":
            continue
        by_dimension.setdefault(item["dimension"], []).append(item)

    merged: list[dict[str, Any]] = []
    for dimension_name in sorted(by_dimension):
        candidates = by_dimension[dimension_name]
        candidate_map = {item["label_id"]: item for item in candidates}
        accepted: dict[str, dict[str, Any]] = {}
        pending = list(candidates)

        for _attempt in range(2):
            if not pending:
                break
            rows = _ollama_score_batch(
                request["text"],
                pending,
                model=model,
                url=url,
                timeout_seconds=timeout_seconds,
            )
            pending_ids = {item["label_id"] for item in pending}
            for row in rows:
                if not isinstance(row, dict):
                    continue
                label_id = row.get("label_id")
                if label_id not in pending_ids or label_id in accepted:
                    continue
                score = row.get("score")
                if not (
                    isinstance(score, (int, float))
                    and not isinstance(score, bool)
                    and math.isfinite(score)
                    and 0 <= score <= 1
                ):
                    continue
                quotes = row.get("evidence_quotes") or []
                if not isinstance(quotes, list) or not all(isinstance(q, str) for q in quotes):
                    continue
                accepted[label_id] = {
                    "label_id": label_id,
                    "score": float(score),
                    "evidence_quotes": quotes[:3],
                }
            pending = [candidate_map[label_id] for label_id in candidate_map if label_id not in accepted]

        missing = sorted(set(candidate_map) - set(accepted))
        require(not missing, f"ollama omitted candidates after bounded completion retry in {dimension_name}: {missing}")
        merged.extend(accepted[label_id] for label_id in sorted(accepted))

    return {"labels": merged}


def validate_provider_response(
    provider_response: dict[str, Any],
    request: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    require(isinstance(provider_response, dict), "provider response must be an object")
    rows = provider_response.get("labels")
    require(isinstance(rows, list), "provider response.labels must be an array")
    candidate_map = {
        item["label_id"]: item
        for item in request["candidates"]
        if item["dimension"] != "discourse"
    }
    normalized: dict[str, dict[str, Any]] = {}
    for row in rows:
        require(isinstance(row, dict), "provider label row must be an object")
        label_id = row.get("label_id")
        require(label_id in candidate_map, f"provider returned unknown/non-inferred candidate: {label_id}")
        require(label_id not in normalized, f"provider returned duplicate label: {label_id}")
        score = row.get("score")
        require(
            isinstance(score, (int, float)) and not isinstance(score, bool) and math.isfinite(score) and 0 <= score <= 1,
            f"invalid score for {label_id}",
        )
        quotes = row.get("evidence_quotes") or []
        require(isinstance(quotes, list) and all(isinstance(q, str) for q in quotes), f"invalid evidence_quotes for {label_id}")
        normalized[label_id] = {"score": float(score), "evidence_quotes": quotes[:3]}
    missing = sorted(set(candidate_map) - set(normalized))
    require(not missing, f"provider did not score all candidates: {missing}")
    return normalized


def build_payload(
    passage: dict[str, Any],
    taxonomy: dict[str, Any],
    taxonomy_sha256: str,
    request: dict[str, Any],
    provider_response: dict[str, Any],
    *,
    provider_name: str,
    model: str | None,
) -> dict[str, Any]:
    text = passage["text"]
    all_labels = flatten_labels(taxonomy)
    scored = validate_provider_response(provider_response, request)
    labels_out: list[dict[str, Any]] = []

    discourse_label = canonical_discourse_label(passage)
    discourse_spec = all_labels[discourse_label]
    labels_out.append(
        {
            "label_id": discourse_label,
            "dimension": "discourse",
            "score": 1.0,
            "threshold": discourse_spec["threshold"],
            "active": True,
            "source": "deterministic",
            "evidence": [compact_evidence(text)],
        }
    )

    by_dimension: dict[str, list[tuple[str, float, list[dict[str, Any]], dict[str, Any]]]] = {}
    for candidate in request["candidates"]:
        if candidate["dimension"] == "discourse":
            continue
        label_id = candidate["label_id"]
        spec = all_labels[label_id]
        row = scored[label_id]
        evidence = []
        for quote in row["evidence_quotes"]:
            span = make_span(text, quote)
            if span is not None and span not in evidence:
                evidence.append(span)
        by_dimension.setdefault(spec["dimension"], []).append((label_id, row["score"], evidence, spec))

    for dimension_name, rows in by_dimension.items():
        selection = taxonomy["dimensions"][dimension_name]["selection"]
        winner: str | None = None
        if selection == "exactly_one":
            evidence_backed = [row for row in rows if row[2]]
            if evidence_backed:
                best = max(evidence_backed, key=lambda item: (item[1], item[0]))
                if best[1] >= float(best[3]["threshold"]):
                    winner = best[0]
        for label_id, score, evidence, spec in rows:
            threshold = float(spec["threshold"])
            active = (
                label_id == winner
                if selection == "exactly_one"
                else score >= threshold and bool(evidence)
            )
            legacy_facets = set((passage.get("semantic_labels") or {}).get("active_facets") or [])
            legacy_hit = any(f in legacy_facets for f in spec.get("legacy_facets") or [])
            source = "hybrid" if legacy_hit and provider_name != "heuristic" else ("legacy_hint" if legacy_hit else ("model" if provider_name != "heuristic" else "deterministic"))
            labels_out.append(
                {
                    "label_id": label_id,
                    "dimension": dimension_name,
                    "score": round(score, 6),
                    "threshold": threshold,
                    "active": active,
                    "source": source,
                    "evidence": evidence,
                }
            )

    labels_out.sort(key=lambda item: (item["dimension"], item["label_id"]))
    active_labels = sorted(item["label_id"] for item in labels_out if item["active"])
    inactive_candidates = sorted(item["label_id"] for item in labels_out if not item["active"])

    errors: list[str] = []
    warnings: list[str] = []
    for dimension_name, dimension in taxonomy["dimensions"].items():
        active = [item["label_id"] for item in labels_out if item["dimension"] == dimension_name and item["active"]]
        if dimension["selection"] == "exactly_one" and len(active) != 1:
            errors.append(f"{dimension_name}: expected exactly one active label, got {len(active)}")
    active_set = set(active_labels)
    for rule in taxonomy["hierarchy"].get("cross_dimension_rules") or []:
        if rule["if_active"] in active_set and not active_set.intersection(rule["requires_any"]):
            message = f'{rule["id"]}: {rule["if_active"]} active without any of {rule["requires_any"]}'
            (errors if rule["severity"] == "error" else warnings).append(message)

    legacy = passage.get("semantic_labels") or {}
    return {
        "taxonomy_version": TAXONOMY_VERSION,
        "taxonomy_sha256": taxonomy_sha256,
        "assertion_scope": taxonomy["assertion_scope"],
        "candidate_policy_version": taxonomy["candidate_policy"]["mode"],
        "provider": {
            "name": provider_name,
            "model": model,
            "request_version": REQUEST_VERSION,
        },
        "legacy_context": {
            "discourse_bucket": ((legacy.get("discourse") or {}).get("bucket")),
            "active_facets": sorted(legacy.get("active_facets") or []),
        },
        "labels": labels_out,
        "active_labels": active_labels,
        "inactive_candidates": inactive_candidates,
        "hierarchy_check": {
            "valid": not errors,
            "errors": errors,
            "warnings": warnings,
        },
    }


def validate_payload(payload: dict[str, Any], passage: dict[str, Any], taxonomy: dict[str, Any], taxonomy_sha256: str) -> None:
    require(payload.get("taxonomy_version") == TAXONOMY_VERSION, "payload taxonomy_version mismatch")
    require(payload.get("taxonomy_sha256") == taxonomy_sha256, "payload taxonomy_sha256 mismatch")
    require(payload.get("assertion_scope") == taxonomy["assertion_scope"], "payload assertion_scope mismatch")
    require(payload.get("candidate_policy_version") == taxonomy["candidate_policy"]["mode"], "payload candidate policy mismatch")
    labels = payload.get("labels")
    require(isinstance(labels, list) and labels, "payload labels must be non-empty")
    known = flatten_labels(taxonomy)
    ids = [item.get("label_id") for item in labels]
    require(len(ids) == len(set(ids)), "payload contains duplicate label ids")
    text = passage["text"]
    for item in labels:
        label_id = item.get("label_id")
        require(label_id in known, f"payload unknown label: {label_id}")
        require(item.get("dimension") == known[label_id]["dimension"], f"payload dimension mismatch: {label_id}")
        score = item.get("score")
        require(isinstance(score, (int, float)) and not isinstance(score, bool) and 0 <= score <= 1, f"payload invalid score: {label_id}")
        require(abs(float(item.get("threshold")) - float(known[label_id]["threshold"])) < 1e-9, f"payload threshold mismatch: {label_id}")
        evidence = item.get("evidence")
        require(isinstance(evidence, list), f"payload evidence must be an array: {label_id}")
        if item.get("active"):
            require(bool(evidence), f"active label lacks evidence: {label_id}")
        for ev in evidence:
            start, end = ev.get("span_start"), ev.get("span_end")
            require(isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(text), f"invalid evidence span: {label_id}")
            require(ev.get("quote_sha256") == sha256_text(text[start:end]), f"evidence hash mismatch: {label_id}")
    expected_active = sorted(item["label_id"] for item in labels if item.get("active"))
    expected_inactive = sorted(item["label_id"] for item in labels if not item.get("active"))
    require(payload.get("active_labels") == expected_active, "active_labels does not match labels")
    require(payload.get("inactive_candidates") == expected_inactive, "inactive_candidates does not match labels")
    check = payload.get("hierarchy_check") or {}
    require(check.get("valid") is True, f"hierarchy check failed: {check.get('errors')}")


def load_nlu0_contract(script_dir: Path) -> dict[str, Any]:
    path = script_dir / "fiction-sample-nlu-contract-v1.py"
    require(path.is_file(), f"missing NLU-0 contract script: {path}")
    return runpy.run_path(str(path))


def build_analysis_record(
    passage: dict[str, Any],
    payload: dict[str, Any],
    *,
    provider_name: str,
    model: str | None,
    input_sha256: str,
    script_path: Path,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    active_scores = [float(item["score"]) for item in payload["labels"] if item["active"] and item["dimension"] != "discourse"]
    confidence = round(sum(active_scores) / len(active_scores), 6) if active_scores else 1.0
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "semantic_classification",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": {
            "level": "passage",
            "id": passage["passage_id"],
            "content_hash_kind": "passage_content_sha256",
            "content_sha256": passage["content_sha256"],
        },
        "method": {
            "type": "hybrid",
            "name": "fiction-sample-nlu-classify-v2",
            "version": "1",
            "model_id": model,
        },
        "confidence": confidence,
        "evidence": [
            {
                "passage_id": passage["passage_id"],
                "scene_id": passage.get("scene_id"),
                "novel_id": passage.get("novel_id"),
                "content_sha256": passage["content_sha256"],
            }
        ],
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": f"fiction-sample-nlu-classify-v2:{provider_name}",
            "input_sha256": input_sha256,
            "code_sha256": sha256_bytes(script_path.read_bytes()),
            "model_sha256": None,
            "notes": "NLU-1 provisional output; retrieval admission closed.",
        },
        "retrieval_admission": {
            "state": "not_admitted",
            "contract_version": RETRIEVAL_CONTRACT_VERSION,
            "notes": "NLU-only development; no Retrieval v2 dependency.",
        },
        "payload": payload,
    }
    record["analysis_id"] = nlu0["deterministic_analysis_id"](record)
    return record


def select_passages(rows: list[dict[str, Any]], args: argparse.Namespace) -> list[dict[str, Any]]:
    passage_ids = set(args.passage_id or [])
    statuses = set((args.statuses or "accepted,golden").split(","))
    selected = [
        row
        for row in rows
        if (not passage_ids or row.get("passage_id") in passage_ids)
        and (args.include_all_statuses or row.get("status") in statuses)
    ]
    selected.sort(key=lambda row: (row.get("novel_id", ""), row.get("source_order", 0), row.get("char_start", 0), row["passage_id"]))
    if args.limit is not None:
        selected = selected[: args.limit]
    return selected


def load_checkpoint(path: Path | None) -> dict[str, Any]:
    if path is None or not path.exists():
        return {"schema_version": "fiction_nlu_classification_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_classification_checkpoint_v1", "checkpoint schema mismatch")
    return value


def request_cache_path(cache_dir: Path, request: dict[str, Any], provider: str, model: str | None) -> Path:
    identity = {"provider": provider, "model": model, "request": request}
    return cache_dir / (sha256_text(canonical_json(identity)) + ".json")


def get_provider_response(
    request: dict[str, Any],
    passage: dict[str, Any],
    taxonomy: dict[str, Any],
    args: argparse.Namespace,
) -> tuple[dict[str, Any], bool]:
    cache_path = None
    if args.cache_dir:
        cache_path = request_cache_path(Path(args.cache_dir), request, args.provider, args.model)
        if cache_path.exists():
            return load_json(cache_path), True

    if args.provider == "heuristic":
        response = heuristic_provider(request, passage, taxonomy)
    elif args.provider == "ollama":
        require(args.model, "--model is required for ollama provider")
        response = ollama_provider(
            request,
            model=args.model,
            url=args.ollama_url,
            timeout_seconds=args.timeout_seconds,
        )
    else:
        raise Nlu1Error(f"unsupported provider: {args.provider}")

    if cache_path is not None:
        write_json_atomic(cache_path, response)
    return response, False


def command_candidates(args: argparse.Namespace) -> int:
    taxonomy, taxonomy_hash = load_taxonomy(Path(args.taxonomy))
    passages = select_passages(load_passages(Path(args.db_root)), args)
    for passage in passages:
        print(json.dumps(build_request(passage, taxonomy, taxonomy_hash), ensure_ascii=False, sort_keys=True))
    return 0


def command_classify(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    taxonomy, taxonomy_hash = load_taxonomy(Path(args.taxonomy))
    passages = select_passages(load_passages(db_root), args)
    output_path = Path(args.output)
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = load_checkpoint(checkpoint_path)
    completed = checkpoint.setdefault("completed", {})
    errors = checkpoint.setdefault("errors", {})
    nlu0 = load_nlu0_contract(Path(__file__).resolve().parent)
    canonical_database = nlu0["load_database"](db_root)

    existing_subjects: set[str] = set()
    if output_path.exists():
        for row in load_jsonl(output_path):
            subject = row.get("subject") or {}
            if row.get("analysis_kind") == "semantic_classification" and row.get("analysis_version") == ANALYSIS_VERSION:
                existing_subjects.add(subject.get("id"))

    summary = {
        "selected": len(passages),
        "written": 0,
        "skipped": 0,
        "cache_hits": 0,
        "errors": 0,
    }
    for passage in passages:
        passage_id = passage["passage_id"]
        if passage_id in completed or passage_id in existing_subjects:
            summary["skipped"] += 1
            continue
        try:
            request = build_request(passage, taxonomy, taxonomy_hash)
            response, cache_hit = get_provider_response(request, passage, taxonomy, args)
            if cache_hit:
                summary["cache_hits"] += 1
            payload = build_payload(
                passage,
                taxonomy,
                taxonomy_hash,
                request,
                response,
                provider_name=args.provider,
                model=args.model,
            )
            validate_payload(payload, passage, taxonomy, taxonomy_hash)
            input_sha = sha256_text(canonical_json({"request": request, "response": response}))
            record = build_analysis_record(
                passage,
                payload,
                provider_name=args.provider,
                model=args.model,
                input_sha256=input_sha,
                script_path=Path(__file__).resolve(),
                nlu0=nlu0,
            )
            nlu0["validate_record"](record, canonical_database, allow_retrieval_admission=False)
            append_jsonl(output_path, record)
            completed[passage_id] = {
                "analysis_id": record["analysis_id"],
                "content_sha256": passage["content_sha256"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            errors.pop(passage_id, None)
            summary["written"] += 1
        except Exception as exc:
            errors[passage_id] = str(exc)
            summary["errors"] += 1
            if not args.continue_on_error:
                if checkpoint_path is not None:
                    write_json_atomic(checkpoint_path, checkpoint)
                raise
        if checkpoint_path is not None:
            write_json_atomic(checkpoint_path, checkpoint)
        if args.sleep_seconds:
            time.sleep(args.sleep_seconds)

    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0 if summary["errors"] == 0 else 1


def command_validate(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    taxonomy, taxonomy_hash = load_taxonomy(Path(args.taxonomy))
    passages = {row["passage_id"]: row for row in load_passages(db_root)}
    nlu0 = load_nlu0_contract(Path(__file__).resolve().parent)
    database = nlu0["load_database"](db_root)
    errors = []
    valid = 0
    rows = load_jsonl(Path(args.input))
    for line_number, record in enumerate(rows, 1):
        try:
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            require(record.get("analysis_kind") == "semantic_classification", "record is not semantic_classification")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            subject = record.get("subject") or {}
            passage = passages.get(subject.get("id"))
            require(passage is not None, "classification subject passage missing")
            validate_payload(record.get("payload"), passage, taxonomy, taxonomy_hash)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_classification_validation_report_v2",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def add_selection_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--passage-id", action="append")
    parser.add_argument("--statuses", default="accepted,golden")
    parser.add_argument("--include-all-statuses", action="store_true")
    parser.add_argument("--limit", type=int)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-1 hierarchical multi-label fiction passage classification.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    candidates = subparsers.add_parser("candidates")
    candidates.add_argument("--db-root", required=True)
    candidates.add_argument("--taxonomy", required=True)
    add_selection_args(candidates)
    candidates.set_defaults(func=command_candidates)

    classify = subparsers.add_parser("classify")
    classify.add_argument("--db-root", required=True)
    classify.add_argument("--taxonomy", required=True)
    classify.add_argument("--output", required=True)
    classify.add_argument("--checkpoint")
    classify.add_argument("--cache-dir")
    classify.add_argument("--provider", choices=["heuristic", "ollama"], default="heuristic")
    classify.add_argument("--model")
    classify.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    classify.add_argument("--timeout-seconds", type=int, default=120)
    classify.add_argument("--sleep-seconds", type=float, default=0)
    classify.add_argument("--continue-on-error", action="store_true")
    add_selection_args(classify)
    classify.set_defaults(func=command_classify)

    validate = subparsers.add_parser("validate")
    validate.add_argument("--db-root", required=True)
    validate.add_argument("--taxonomy", required=True)
    validate.add_argument("--input", required=True)
    validate.set_defaults(func=command_validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (Nlu1Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
