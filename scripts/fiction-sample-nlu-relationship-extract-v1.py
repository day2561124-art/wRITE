from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import runpy
import sys
import tempfile
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_character_relationship_v1"
PAYLOAD_VERSION = "fiction_nlu_character_relationship_v1"
REQUEST_VERSION = "fiction_nlu_character_relationship_request_v1"
ANALYSIS_VERSION = "character_relationship_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu3Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu3Error(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_id(prefix: str, identity: Any) -> str:
    return f"{prefix}-{sha256_text(canonical_json(identity))[:16].upper()}"


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
                raise Nlu3Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            require(isinstance(value, dict), f"{path}:{line_number}: record must be an object")
            rows.append(value)
    return rows


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass


def load_config(path: Path) -> tuple[dict[str, Any], str]:
    config = load_json(path)
    require(config.get("config_version") == CONFIG_VERSION, "unexpected config_version")
    return config, sha256_text(canonical_json(config))


def flatten_relations(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    relations: dict[str, dict[str, Any]] = {}
    for group_name, group in config["relation_groups"].items():
        for relation_id, spec in group["relations"].items():
            require(relation_id not in relations, f"duplicate relation_id: {relation_id}")
            relations[relation_id] = {
                **spec,
                "group": group_name,
                "group_semantics": group["semantics"],
            }
    return relations


def load_nlu_scripts(script_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    nlu0_path = script_dir / "fiction-sample-nlu-contract-v1.py"
    nlu2_path = script_dir / "fiction-sample-nlu-character-resolve-v1.py"
    require(nlu0_path.is_file(), f"missing NLU-0 contract: {nlu0_path}")
    require(nlu2_path.is_file(), f"missing NLU-2 resolver: {nlu2_path}")
    return runpy.run_path(str(nlu0_path)), runpy.run_path(str(nlu2_path))


def load_database(db_root: Path) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    passages = {row["passage_id"]: row for row in load_jsonl(db_root / "records" / "passages_v1.jsonl")}
    scenes = {row["scene_id"]: row for row in load_jsonl(db_root / "records" / "scenes_v1.jsonl")}
    novels = {row["novel_id"]: row for row in load_jsonl(db_root / "records" / "novels_v1.jsonl")}
    return passages, scenes, novels


def validate_character_record(
    record: dict[str, Any],
    *,
    db_root: Path,
    nlu0: dict[str, Any],
    nlu2: dict[str, Any],
) -> None:
    database = nlu0["load_database"](db_root)
    nlu0["validate_record"](record, database, allow_retrieval_admission=False)
    require(record.get("analysis_kind") == "character_resolution", "dependency record is not character_resolution")
    require(record.get("analysis_version") == "character_resolution_v1", "unsupported character_resolution version")
    config_path = Path(__file__).resolve().parent.parent / "config" / "fiction-nlu-character-resolution-v1.json"
    config, config_sha = nlu2["load_config"](config_path)
    passages, _scenes, _novels = load_database(db_root)
    nlu2["validate_payload"](record.get("payload"), passages, config, config_sha)


def entity_registry_sha256(character_record: dict[str, Any]) -> str:
    payload = character_record["payload"]
    registry = {
        "entities": payload["entities"],
        "mentions": payload["mentions"],
        "merge_events": payload["merge_events"],
    }
    return sha256_text(canonical_json(registry))


def mention_indexes(character_record: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    payload = character_record["payload"]
    entities = {entity["entity_id"]: entity for entity in payload["entities"]}
    mentions_by_passage: dict[str, list[dict[str, Any]]] = defaultdict(list)
    mention_by_id: dict[str, dict[str, Any]] = {}
    for mention in payload["mentions"]:
        mention_by_id[mention["mention_id"]] = mention
        if mention.get("entity_id") in entities:
            mentions_by_passage[mention["passage_id"]].append(mention)
    for rows in mentions_by_passage.values():
        rows.sort(key=lambda item: (item["passage_span"]["start"], item["passage_span"]["end"], item["mention_id"]))
    return entities, mentions_by_passage, mention_by_id


def ordered_novel_passages(
    novel_id: str,
    passages: dict[str, dict[str, Any]],
    character_record: dict[str, Any],
) -> list[dict[str, Any]]:
    allowed = set((character_record["payload"]["scope"] or {}).get("status_filter") or [])
    rows = [
        row
        for row in passages.values()
        if row.get("novel_id") == novel_id and (not allowed or row.get("status") in allowed)
    ]
    rows.sort(key=lambda row: (row.get("source_order", 0), row.get("char_start", 0), row["passage_id"]))
    return rows


def candidate_relation_ids(text: str, config: dict[str, Any]) -> list[str]:
    policy = config["pair_candidate_policy"]
    flattened = flatten_relations(config)
    chosen: list[str] = []
    for group_name, group in config["relation_groups"].items():
        scored: list[tuple[float, str]] = []
        for relation_id, spec in group["relations"].items():
            hits = sum(text.count(hint) for hint in spec.get("lexical_hints") or [])
            score = float(policy.get("default_candidate_score", 1))
            score += min(3, hits) * float(policy.get("lexical_hint_boost", 3))
            scored.append((score, relation_id))
        scored.sort(key=lambda item: (-item[0], item[1]))
        minimum = int(policy.get("min_candidates_per_group", 2))
        maximum = int(policy.get("max_candidates_per_group", 5))
        keep = [relation_id for _, relation_id in scored[:maximum]]
        if len(keep) < minimum:
            keep.extend(relation_id for _, relation_id in scored[len(keep):minimum])
        chosen.extend(keep)
    return sorted(set(chosen), key=lambda relation_id: (flattened[relation_id]["group"], relation_id))


def build_pair_windows(
    character_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    novel_id = character_record["subject"]["id"]
    entities, mentions_by_passage, _ = mention_indexes(character_record)
    ordered = ordered_novel_passages(novel_id, passages, character_record)
    policy = config["pair_candidate_policy"]
    max_gap = int(policy.get("adjacent_passage_gap", 1))
    max_entities = int(policy.get("max_entities_per_window", 12))
    windows: dict[str, dict[str, Any]] = {}

    for i, passage in enumerate(ordered):
        for gap in range(0, max_gap + 1):
            j = i + gap
            if j >= len(ordered):
                continue
            rows = ordered[i : j + 1]
            passage_ids = [row["passage_id"] for row in rows]
            mention_rows = [m for pid in passage_ids for m in mentions_by_passage.get(pid, [])]
            entity_ids = sorted({m["entity_id"] for m in mention_rows if m.get("entity_id") in entities})
            if len(entity_ids) < 2 or len(entity_ids) > max_entities:
                continue
            for a_index in range(len(entity_ids)):
                for b_index in range(a_index + 1, len(entity_ids)):
                    entity_a, entity_b = entity_ids[a_index], entity_ids[b_index]
                    a_present = any(m["entity_id"] == entity_a for m in mention_rows)
                    b_present = any(m["entity_id"] == entity_b for m in mention_rows)
                    if not (a_present and b_present):
                        continue
                    identity = {
                        "novel_id": novel_id,
                        "entity_a": entity_a,
                        "entity_b": entity_b,
                        "passage_ids": passage_ids,
                    }
                    window_id = stable_id("RPW", identity)
                    if window_id in windows:
                        continue
                    scene_ids = sorted({row.get("scene_id") for row in rows if row.get("scene_id")})
                    text = "\n".join(row["text"] for row in rows)
                    windows[window_id] = {
                        "pair_window_id": window_id,
                        "entity_a": entity_a,
                        "entity_b": entity_b,
                        "passage_ids": passage_ids,
                        "scene_ids": scene_ids,
                        "first_novel_offset": min(row["char_start"] for row in rows),
                        "last_novel_offset": max(row["char_end"] for row in rows),
                        "candidate_relations": candidate_relation_ids(text, config),
                    }
                    if len(windows) >= int(policy.get("max_pair_windows_per_novel", 512)):
                        return sorted(windows.values(), key=lambda w: (w["first_novel_offset"], w["pair_window_id"]))
    return sorted(windows.values(), key=lambda w: (w["first_novel_offset"], w["pair_window_id"]))


def relation_candidates_for_window(window: dict[str, Any], config: dict[str, Any]) -> list[dict[str, Any]]:
    relations = flatten_relations(config)
    candidates: list[dict[str, Any]] = []
    entity_a = window["entity_a"]
    entity_b = window["entity_b"]
    for relation_id in window["candidate_relations"]:
        spec = relations[relation_id]
        if spec["directionality"] == "symmetric":
            source, target = sorted([entity_a, entity_b])
            candidates.append(
                {
                    "relation_id": relation_id,
                    "source_entity_id": source,
                    "target_entity_id": target,
                    "threshold": float(spec["threshold"]),
                    "group": spec["group"],
                    "directionality": "symmetric",
                }
            )
        else:
            candidates.extend(
                [
                    {
                        "relation_id": relation_id,
                        "source_entity_id": entity_a,
                        "target_entity_id": entity_b,
                        "threshold": float(spec["threshold"]),
                        "group": spec["group"],
                        "directionality": "directed",
                    },
                    {
                        "relation_id": relation_id,
                        "source_entity_id": entity_b,
                        "target_entity_id": entity_a,
                        "threshold": float(spec["threshold"]),
                        "group": spec["group"],
                        "directionality": "directed",
                    },
                ]
            )
    candidates.sort(key=lambda item: (item["group"], item["relation_id"], item["source_entity_id"], item["target_entity_id"]))
    return candidates


def build_request(
    window: dict[str, Any],
    character_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
) -> dict[str, Any]:
    entities, mentions_by_passage, _ = mention_indexes(character_record)
    relevant_entities = {window["entity_a"], window["entity_b"]}
    entity_payload = []
    for entity_id in sorted(relevant_entities):
        entity = entities[entity_id]
        entity_payload.append(
            {
                "entity_id": entity_id,
                "canonical_name": entity["canonical_name"],
                "aliases": entity["aliases"],
            }
        )
    passage_payloads = []
    for passage_id in window["passage_ids"]:
        passage = passages[passage_id]
        mention_rows = [
            {
                "mention_id": mention["mention_id"],
                "entity_id": mention["entity_id"],
                "surface": mention["surface"],
                "passage_span": mention["passage_span"],
            }
            for mention in mentions_by_passage.get(passage_id, [])
            if mention["entity_id"] in relevant_entities
        ]
        passage_payloads.append(
            {
                "passage_id": passage_id,
                "scene_id": passage.get("scene_id"),
                "char_start": passage["char_start"],
                "text": passage["text"],
                "mentions": mention_rows,
            }
        )
    candidates = relation_candidates_for_window(window, config)
    relations = flatten_relations(config)
    for candidate in candidates:
        spec = relations[candidate["relation_id"]]
        candidate["lexical_hints"] = spec.get("lexical_hints") or []
        candidate["group_semantics"] = spec["group_semantics"]
    return {
        "request_version": REQUEST_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha,
        "novel_id": character_record["subject"]["id"],
        "pair_window_id": window["pair_window_id"],
        "entities": entity_payload,
        "passages": passage_payloads,
        "candidates": candidates,
        "instructions": [
            "Score every supplied relationship candidate independently.",
            "Use only the supplied passages and NLU-2 entity/mention bindings; never create, rename, or merge entities.",
            "A score at or above threshold must cite 1-3 exact passage substrings as evidence.",
            "Relationship assertions are local evidence-window signals, not permanent global truth.",
            "For directed relations, preserve source_entity_id and target_entity_id exactly as supplied.",
            "Return no chain-of-thought or free-form explanation.",
        ],
    }


def locate_quote(passage_text: str, quote: str) -> tuple[int, int] | None:
    quote = quote.strip()
    if not quote or passage_text.count(quote) != 1:
        return None
    start = passage_text.find(quote)
    return start, start + len(quote)


def supporting_mentions_for_span(
    passage_id: str,
    start: int,
    end: int,
    mention_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    supporting = []
    for mention_id, mention in mention_by_id.items():
        if mention["passage_id"] != passage_id:
            continue
        span = mention["passage_span"]
        if span["start"] < end and span["end"] > start:
            supporting.append(mention_id)
    return sorted(supporting)


def lexical_evidence(
    candidate: dict[str, Any],
    request: dict[str, Any],
    character_record: dict[str, Any],
) -> tuple[float, list[dict[str, Any]]]:
    relations = candidate["lexical_hints"]
    entities, _mentions_by_passage, mention_by_id = mention_indexes(character_record)
    source_name = entities[candidate["source_entity_id"]]["canonical_name"]
    target_name = entities[candidate["target_entity_id"]]["canonical_name"]
    evidence: list[dict[str, Any]] = []
    hit_count = 0

    for passage in request["passages"]:
        text = passage["text"]
        if source_name not in text or target_name not in text:
            continue
        hints = [hint for hint in relations if hint in text]
        if not hints:
            continue
        hit_count += len(hints)
        source_pos = text.find(source_name)
        target_pos = text.find(target_name)
        hint_pos = min(text.find(hint) for hint in hints if hint in text)
        left = max(0, min(source_pos, target_pos, hint_pos) - 12)
        right = min(
            len(text),
            max(source_pos + len(source_name), target_pos + len(target_name), hint_pos + len(hints[0])) + 12,
        )
        quote = text[left:right]
        mention_ids = supporting_mentions_for_span(passage["passage_id"], left, right, mention_by_id)
        evidence.append(
            {
                "passage_id": passage["passage_id"],
                "scene_id": passage.get("scene_id"),
                "span_start": left,
                "span_end": right,
                "quote_sha256": sha256_text(quote),
                "supporting_mention_ids": mention_ids,
            }
        )
        if len(evidence) >= 3:
            break

    if not evidence:
        return 0.18, []
    if candidate["directionality"] == "symmetric":
        return min(0.95, 0.80 + 0.04 * min(hit_count, 3)), evidence

    # Weak directional cue: source before relation hint before target.
    directional = False
    for passage in request["passages"]:
        text = passage["text"]
        source_pos = text.find(source_name)
        target_pos = text.find(target_name)
        if source_pos < 0 or target_pos < 0:
            continue
        for hint in relations:
            hint_pos = text.find(hint)
            if source_pos <= hint_pos <= target_pos:
                directional = True
                break
    return (min(0.94, 0.82 + 0.03 * min(hit_count, 3)) if directional else 0.56), evidence


def heuristic_provider(
    request: dict[str, Any],
    character_record: dict[str, Any],
) -> dict[str, Any]:
    rows = []
    for candidate in request["candidates"]:
        score, evidence = lexical_evidence(candidate, request, character_record)
        rows.append(
            {
                "relation_id": candidate["relation_id"],
                "source_entity_id": candidate["source_entity_id"],
                "target_entity_id": candidate["target_entity_id"],
                "score": score,
                "evidence": evidence,
            }
        )
    return {"assertions": rows}


def ollama_provider(
    request: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
    config: dict[str, Any],
) -> dict[str, Any]:
    response_schema = {
        "type": "object",
        "properties": {
            "assertions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "relation_id": {"type": "string"},
                        "source_entity_id": {"type": "string"},
                        "target_entity_id": {"type": "string"},
                        "score": {"type": "number", "minimum": 0, "maximum": 1},
                        "evidence_quotes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "passage_id": {"type": "string"},
                                    "quote": {"type": "string"},
                                },
                                "required": ["passage_id", "quote"],
                            },
                        },
                    },
                    "required": ["relation_id", "source_entity_id", "target_entity_id", "score", "evidence_quotes"],
                },
            }
        },
        "required": ["assertions"],
    }
    system = (
        "You are a bounded fiction relationship extractor. Return JSON only. Score every supplied candidate independently. "
        "Do not create entities, infer permanent relationship state, or reverse directed candidates. "
        "For scores at or above threshold, cite 1-3 exact substrings from supplied passages. "
        "Prefer low score over unsupported inference. No chain-of-thought."
    )
    user = json.dumps(request, ensure_ascii=False)
    payload = {
        "model": model,
        "stream": False,
        "format": response_schema,
        "think": bool(config["provider_policy"].get("think", False)),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "options": {"temperature": 0, "num_predict": 2200},
    }
    http_request = urllib.request.Request(
        url.rstrip("/") + "/api/chat",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise Nlu3Error(f"ollama provider failed: {exc}") from exc
    content = ((raw.get("message") or {}).get("content") or "").strip()
    require(content, "ollama returned empty content")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise Nlu3Error(f"ollama returned invalid JSON: {exc}") from exc
    require(isinstance(parsed, dict) and isinstance(parsed.get("assertions"), list), "ollama response must contain assertions array")
    return parsed


def normalize_provider_response(
    provider_response: dict[str, Any],
    request: dict[str, Any],
    character_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    *,
    provider_name: str,
) -> list[dict[str, Any]]:
    candidates = {
        (c["relation_id"], c["source_entity_id"], c["target_entity_id"]): c
        for c in request["candidates"]
    }
    _entities, _mentions_by_passage, mention_by_id = mention_indexes(character_record)
    normalized: dict[tuple[str, str, str], dict[str, Any]] = {}
    rows = provider_response.get("assertions")
    require(isinstance(rows, list), "provider response assertions must be an array")

    for row in rows:
        require(isinstance(row, dict), "provider assertion row must be an object")
        key = (row.get("relation_id"), row.get("source_entity_id"), row.get("target_entity_id"))
        require(key in candidates, f"provider returned unknown candidate: {key}")
        require(key not in normalized, f"provider returned duplicate candidate: {key}")
        score = row.get("score")
        require(isinstance(score, (int, float)) and not isinstance(score, bool) and math.isfinite(score) and 0 <= score <= 1, f"invalid score: {key}")
        evidence_out: list[dict[str, Any]] = []

        if provider_name == "heuristic":
            evidence_rows = row.get("evidence") or []
            require(isinstance(evidence_rows, list), f"invalid heuristic evidence: {key}")
            evidence_out = evidence_rows[:3]
        else:
            evidence_rows = row.get("evidence_quotes") or []
            require(isinstance(evidence_rows, list), f"invalid evidence_quotes: {key}")
            for item in evidence_rows[:3]:
                if not isinstance(item, dict):
                    continue
                passage_id = item.get("passage_id")
                quote = item.get("quote")
                passage = passages.get(passage_id)
                if passage is None or not isinstance(quote, str):
                    continue
                located = locate_quote(passage["text"], quote)
                if located is None:
                    continue
                start, end = located
                evidence_out.append(
                    {
                        "passage_id": passage_id,
                        "scene_id": passage.get("scene_id"),
                        "span_start": start,
                        "span_end": end,
                        "quote_sha256": sha256_text(passage["text"][start:end]),
                        "supporting_mention_ids": supporting_mentions_for_span(passage_id, start, end, mention_by_id),
                    }
                )

        normalized[key] = {"score": float(score), "evidence": evidence_out}

    missing = sorted(set(candidates) - set(normalized))
    require(not missing, f"provider did not score all candidates: {missing}")
    return [
        {
            **candidate,
            "score": normalized[key]["score"],
            "evidence": normalized[key]["evidence"],
        }
        for key, candidate in candidates.items()
    ]


def build_payload(
    character_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
    *,
    provider_name: str,
    model: str | None,
    window_responses: list[tuple[dict[str, Any], dict[str, Any]]],
) -> dict[str, Any]:
    relations = flatten_relations(config)
    entities, _mentions_by_passage, mention_by_id = mention_indexes(character_record)
    pair_windows = [window for window, _ in window_responses]
    assertions: list[dict[str, Any]] = []
    inactive: list[dict[str, Any]] = []
    errors: list[str] = []
    warnings: list[str] = []

    for window, response in window_responses:
        request = build_request(window, character_record, passages, config, config_sha)
        rows = normalize_provider_response(
            response,
            request,
            character_record,
            passages,
            provider_name=provider_name,
        )
        for row in rows:
            relation_id = row["relation_id"]
            spec = relations[relation_id]
            threshold = float(row["threshold"])
            evidence = row["evidence"]
            supporting_entity_ids = {
                mention_by_id[mid]["entity_id"]
                for item in evidence
                for mid in item["supporting_mention_ids"]
                if mid in mention_by_id and mention_by_id[mid].get("entity_id")
            }
            active = (
                row["score"] >= threshold
                and bool(evidence)
                and row["source_entity_id"] in supporting_entity_ids
                and row["target_entity_id"] in supporting_entity_ids
            )
            if row["score"] >= threshold and not active:
                warnings.append(
                    f'evidence_coverage_failed:{window["pair_window_id"]}:{relation_id}:{row["source_entity_id"]}->{row["target_entity_id"]}'
                )

            if not active:
                inactive.append(
                    {
                        "pair_window_id": window["pair_window_id"],
                        "relation_id": relation_id,
                        "source_entity_id": row["source_entity_id"],
                        "target_entity_id": row["target_entity_id"],
                        "score": round(float(row["score"]), 6),
                        "threshold": threshold,
                    }
                )
                continue

            assertion_id = stable_id(
                "REL",
                {
                    "novel_id": character_record["subject"]["id"],
                    "pair_window_id": window["pair_window_id"],
                    "relation_id": relation_id,
                    "source_entity_id": row["source_entity_id"],
                    "target_entity_id": row["target_entity_id"],
                },
            )
            assertions.append(
                {
                    "assertion_id": assertion_id,
                    "pair_window_id": window["pair_window_id"],
                    "relation_id": relation_id,
                    "group": spec["group"],
                    "directionality": spec["directionality"],
                    "source_entity_id": row["source_entity_id"],
                    "target_entity_id": row["target_entity_id"],
                    "score": round(float(row["score"]), 6),
                    "threshold": threshold,
                    "active": True,
                    "source": "heuristic" if provider_name == "heuristic" else "model",
                    "evidence": evidence[:3],
                    "local_scope": {
                        "passage_ids": window["passage_ids"],
                        "scene_ids": window["scene_ids"],
                        "first_novel_offset": window["first_novel_offset"],
                        "last_novel_offset": window["last_novel_offset"],
                        "scope_semantics": config["output_policy"]["scope_semantics"],
                    },
                }
            )

    assertions.sort(key=lambda item: (item["local_scope"]["first_novel_offset"], item["assertion_id"]))
    inactive.sort(key=lambda item: (item["pair_window_id"], item["relation_id"], item["source_entity_id"], item["target_entity_id"]))

    # Structural consistency only; semantic contradictions are retained for NLU-4.
    seen_assertions: set[str] = set()
    for assertion in assertions:
        if assertion["assertion_id"] in seen_assertions:
            errors.append(f'duplicate assertion_id:{assertion["assertion_id"]}')
        seen_assertions.add(assertion["assertion_id"])
        if assertion["source_entity_id"] == assertion["target_entity_id"]:
            errors.append(f'self_relation:{assertion["assertion_id"]}')
        if assertion["source_entity_id"] not in entities or assertion["target_entity_id"] not in entities:
            errors.append(f'unknown_entity:{assertion["assertion_id"]}')

    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha,
        "assertion_scope": config["assertion_scope"],
        "provider": {
            "name": provider_name,
            "model": model,
            "request_version": REQUEST_VERSION,
        },
        "scope": {
            "novel_id": character_record["subject"]["id"],
            "character_resolution_analysis_id": character_record["analysis_id"],
            "complete_relationship_claim": False,
            "scope_semantics": config["output_policy"]["scope_semantics"],
        },
        "entity_registry_sha256": entity_registry_sha256(character_record),
        "pair_windows": pair_windows,
        "assertions": assertions,
        "inactive_candidates": inactive,
        "consistency": {"valid": not errors, "errors": errors, "warnings": warnings},
    }


def validate_payload(
    payload: dict[str, Any],
    character_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
) -> None:
    require(payload.get("schema_version") == PAYLOAD_VERSION, "payload schema_version mismatch")
    require(payload.get("config_version") == CONFIG_VERSION, "payload config_version mismatch")
    require(payload.get("config_sha256") == config_sha, "payload config_sha256 mismatch")
    require(payload.get("assertion_scope") == config["assertion_scope"], "payload assertion_scope mismatch")
    scope = payload.get("scope") or {}
    require(scope.get("novel_id") == character_record["subject"]["id"], "payload novel_id mismatch")
    require(scope.get("character_resolution_analysis_id") == character_record["analysis_id"], "character resolution lineage mismatch")
    require(scope.get("complete_relationship_claim") is False, "NLU-3 may not claim complete relationship truth")
    require(scope.get("scope_semantics") == config["output_policy"]["scope_semantics"], "scope semantics mismatch")
    require(payload.get("entity_registry_sha256") == entity_registry_sha256(character_record), "entity registry hash mismatch")

    entities, _mentions_by_passage, mention_by_id = mention_indexes(character_record)
    relations = flatten_relations(config)
    windows = {window["pair_window_id"]: window for window in payload.get("pair_windows") or []}
    assertions = payload.get("assertions")
    inactive = payload.get("inactive_candidates")
    require(isinstance(assertions, list), "assertions must be an array")
    require(isinstance(inactive, list), "inactive_candidates must be an array")
    seen_ids: set[str] = set()

    for assertion in assertions:
        assertion_id = assertion.get("assertion_id")
        require(assertion_id not in seen_ids, f"duplicate assertion_id: {assertion_id}")
        seen_ids.add(assertion_id)
        relation_id = assertion.get("relation_id")
        require(relation_id in relations, f"unknown relation_id: {relation_id}")
        spec = relations[relation_id]
        require(assertion.get("group") == spec["group"], f"group mismatch: {assertion_id}")
        require(assertion.get("directionality") == spec["directionality"], f"directionality mismatch: {assertion_id}")
        source = assertion.get("source_entity_id")
        target = assertion.get("target_entity_id")
        require(source in entities and target in entities and source != target, f"invalid entity pair: {assertion_id}")
        if spec["directionality"] == "symmetric":
            require(source < target, f"symmetric relation pair must be canonical ordered: {assertion_id}")
        require(abs(float(assertion["threshold"]) - float(spec["threshold"])) < 1e-9, f"threshold mismatch: {assertion_id}")
        require(assertion.get("active") is True, f"stored assertion must be active: {assertion_id}")
        require(float(assertion["score"]) >= float(assertion["threshold"]), f"active assertion below threshold: {assertion_id}")

        window = windows.get(assertion.get("pair_window_id"))
        require(window is not None, f"pair window missing: {assertion_id}")
        expected_id = stable_id(
            "REL",
            {
                "novel_id": scope["novel_id"],
                "pair_window_id": window["pair_window_id"],
                "relation_id": relation_id,
                "source_entity_id": source,
                "target_entity_id": target,
            },
        )
        require(assertion_id == expected_id, f"non-deterministic assertion_id: {assertion_id}")
        evidence = assertion.get("evidence")
        require(isinstance(evidence, list) and evidence, f"active assertion lacks evidence: {assertion_id}")
        covered_entities: set[str] = set()

        for item in evidence:
            passage = passages.get(item.get("passage_id"))
            require(passage is not None, f"evidence passage missing: {assertion_id}")
            start, end = item.get("span_start"), item.get("span_end")
            require(isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(passage["text"]), f"bad evidence span: {assertion_id}")
            require(item.get("quote_sha256") == sha256_text(passage["text"][start:end]), f"evidence hash mismatch: {assertion_id}")
            mention_ids = item.get("supporting_mention_ids")
            require(isinstance(mention_ids, list) and mention_ids, f"evidence mention lineage missing: {assertion_id}")
            for mention_id in mention_ids:
                mention = mention_by_id.get(mention_id)
                require(mention is not None, f"supporting mention missing: {assertion_id}:{mention_id}")
                require(mention["passage_id"] == passage["passage_id"], f"supporting mention passage mismatch: {assertion_id}:{mention_id}")
                mspan = mention["passage_span"]
                require(mspan["start"] < end and mspan["end"] > start, f"supporting mention does not overlap evidence: {assertion_id}:{mention_id}")
                if mention.get("entity_id"):
                    covered_entities.add(mention["entity_id"])
        require(source in covered_entities and target in covered_entities, f"evidence does not cover both entities: {assertion_id}")

    consistency = payload.get("consistency") or {}
    require(consistency.get("valid") is True, f"consistency failed: {consistency.get('errors')}")


def cache_path_for(cache_dir: Path, request: dict[str, Any], provider: str, model: str | None) -> Path:
    return cache_dir / (sha256_text(canonical_json({"provider": provider, "model": model, "request": request})) + ".json")


def get_response(
    request: dict[str, Any],
    character_record: dict[str, Any],
    args: argparse.Namespace,
    config: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    cache_path = None
    if args.cache_dir:
        cache_path = cache_path_for(Path(args.cache_dir), request, args.provider, args.model)
        if cache_path.exists():
            return load_json(cache_path), True

    if args.provider == "heuristic":
        response = heuristic_provider(request, character_record)
    elif args.provider == "ollama":
        require(args.model, "--model is required for ollama provider")
        response = ollama_provider(
            request,
            model=args.model,
            url=args.ollama_url,
            timeout_seconds=args.timeout_seconds,
            config=config,
        )
    else:
        raise Nlu3Error(f"unsupported provider: {args.provider}")

    if cache_path is not None:
        write_json_atomic(cache_path, response)
    return response, False


def build_analysis_record(
    character_record: dict[str, Any],
    payload: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    *,
    provider_name: str,
    model: str | None,
    input_sha256: str,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    novel_id = character_record["subject"]["id"]
    evidence_passage_ids = sorted({
        item["passage_id"]
        for assertion in payload["assertions"]
        for item in assertion["evidence"]
    })
    if not evidence_passage_ids:
        scope_passage_ids = [
            pid
            for window in payload["pair_windows"]
            for pid in window["passage_ids"]
        ]
        if scope_passage_ids:
            evidence_passage_ids = [scope_passage_ids[0]]
        else:
            fallback = sorted(
                (
                    passage
                    for passage in passages.values()
                    if passage.get("novel_id") == novel_id
                ),
                key=lambda passage: (
                    passage.get("source_order", 0),
                    passage.get("char_start", 0),
                    passage["passage_id"],
                ),
            )
            if fallback:
                evidence_passage_ids = [fallback[0]["passage_id"]]
    evidence = [
        {
            "passage_id": pid,
            "scene_id": passages[pid].get("scene_id"),
            "novel_id": passages[pid]["novel_id"],
            "content_sha256": passages[pid]["content_sha256"],
        }
        for pid in evidence_passage_ids
    ]
    scores = [a["score"] for a in payload["assertions"]]
    confidence = round(sum(scores) / len(scores), 6) if scores else None
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "relationship",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": character_record["subject"],
        "method": {
            "type": "hybrid",
            "name": "fiction-sample-nlu-relationship-extract-v1",
            "version": "1",
            "model_id": model,
        },
        "confidence": confidence,
        "evidence": evidence,
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": f"fiction-sample-nlu-relationship-extract-v1:{provider_name}",
            "input_sha256": input_sha256,
            "code_sha256": sha256_bytes(Path(__file__).read_bytes()),
            "model_sha256": None,
            "notes": "NLU-3 provisional local relationship assertions; no global relationship lifetime claim.",
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


def load_checkpoint(path: Path | None) -> dict[str, Any]:
    if path is None or not path.exists():
        return {"schema_version": "fiction_nlu_character_relationship_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_character_relationship_checkpoint_v1", "checkpoint schema mismatch")
    return value


def command_extract(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    passages, _scenes, novels = load_database(db_root)
    nlu0, nlu2 = load_nlu_scripts(Path(__file__).resolve().parent)
    character_records = load_jsonl(Path(args.character_resolution))
    if args.novel_id:
        requested = set(args.novel_id)
        character_records = [r for r in character_records if (r.get("subject") or {}).get("id") in requested]
    if args.limit_novels is not None:
        character_records = character_records[: args.limit_novels]

    output_path = Path(args.output)
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = load_checkpoint(checkpoint_path)
    completed = checkpoint.setdefault("completed", {})
    errors = checkpoint.setdefault("errors", {})
    existing = set()
    if output_path.exists():
        for record in load_jsonl(output_path):
            if record.get("analysis_kind") == "relationship" and record.get("analysis_version") == ANALYSIS_VERSION:
                existing.add((record.get("subject") or {}).get("id"))

    summary = {"selected": len(character_records), "written": 0, "skipped": 0, "pair_windows": 0, "assertions": 0, "cache_hits": 0, "errors": 0}
    canonical_database = nlu0["load_database"](db_root)

    for character_record in character_records:
        novel_id = (character_record.get("subject") or {}).get("id")
        if novel_id in completed or novel_id in existing:
            summary["skipped"] += 1
            continue
        try:
            require(novel_id in novels, f"character record novel missing: {novel_id}")
            validate_character_record(character_record, db_root=db_root, nlu0=nlu0, nlu2=nlu2)
            windows = build_pair_windows(character_record, passages, config)
            responses = []
            input_material = []
            for window in windows:
                request = build_request(window, character_record, passages, config, config_sha)
                response, cache_hit = get_response(request, character_record, args, config)
                if cache_hit:
                    summary["cache_hits"] += 1
                responses.append((window, response))
                input_material.append({"request": request, "response": response})
            payload = build_payload(
                character_record,
                passages,
                config,
                config_sha,
                provider_name=args.provider,
                model=args.model,
                window_responses=responses,
            )
            validate_payload(payload, character_record, passages, config, config_sha)
            input_sha = sha256_text(
                canonical_json(
                    {
                        "character_resolution_analysis_id": character_record["analysis_id"],
                        "entity_registry_sha256": entity_registry_sha256(character_record),
                        "windows": input_material,
                    }
                )
            )
            record = build_analysis_record(
                character_record,
                payload,
                passages,
                provider_name=args.provider,
                model=args.model,
                input_sha256=input_sha,
                nlu0=nlu0,
            )
            nlu0["validate_record"](record, canonical_database, allow_retrieval_admission=False)
            append_jsonl(output_path, record)
            completed[novel_id] = {
                "analysis_id": record["analysis_id"],
                "character_resolution_analysis_id": character_record["analysis_id"],
                "entity_registry_sha256": payload["entity_registry_sha256"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            errors.pop(novel_id, None)
            summary["written"] += 1
            summary["pair_windows"] += len(payload["pair_windows"])
            summary["assertions"] += len(payload["assertions"])
        except Exception as exc:
            errors[novel_id or "<unknown>"] = str(exc)
            summary["errors"] += 1
            if not args.continue_on_error:
                if checkpoint_path:
                    write_json_atomic(checkpoint_path, checkpoint)
                raise
        if checkpoint_path:
            write_json_atomic(checkpoint_path, checkpoint)

    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0 if summary["errors"] == 0 else 1


def command_validate(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    passages, _scenes, _novels = load_database(db_root)
    nlu0, nlu2 = load_nlu_scripts(Path(__file__).resolve().parent)
    character_records = {
        (record.get("subject") or {}).get("id"): record
        for record in load_jsonl(Path(args.character_resolution))
    }
    database = nlu0["load_database"](db_root)
    rows = load_jsonl(Path(args.input))
    errors = []
    valid = 0
    for line_number, record in enumerate(rows, 1):
        try:
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            require(record.get("analysis_kind") == "relationship", "record is not relationship")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            novel_id = (record.get("subject") or {}).get("id")
            character_record = character_records.get(novel_id)
            require(character_record is not None, f"missing character resolution dependency for {novel_id}")
            validate_character_record(character_record, db_root=db_root, nlu0=nlu0, nlu2=nlu2)
            validate_payload(record.get("payload"), character_record, passages, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_character_relationship_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-3 evidence-backed character relationship extraction.")
    sub = parser.add_subparsers(dest="command", required=True)

    extract = sub.add_parser("extract")
    extract.add_argument("--db-root", required=True)
    extract.add_argument("--config", required=True)
    extract.add_argument("--character-resolution", required=True)
    extract.add_argument("--output", required=True)
    extract.add_argument("--checkpoint")
    extract.add_argument("--cache-dir")
    extract.add_argument("--provider", choices=["heuristic", "ollama"], default="heuristic")
    extract.add_argument("--model")
    extract.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    extract.add_argument("--timeout-seconds", type=int, default=120)
    extract.add_argument("--novel-id", action="append")
    extract.add_argument("--limit-novels", type=int)
    extract.add_argument("--continue-on-error", action="store_true")
    extract.set_defaults(func=command_extract)

    validate = sub.add_parser("validate")
    validate.add_argument("--db-root", required=True)
    validate.add_argument("--config", required=True)
    validate.add_argument("--character-resolution", required=True)
    validate.add_argument("--input", required=True)
    validate.set_defaults(func=command_validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (Nlu3Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
