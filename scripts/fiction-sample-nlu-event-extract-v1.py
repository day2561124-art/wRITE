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
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_event_analysis_v1"
PAYLOAD_VERSION = "fiction_nlu_event_analysis_v1"
REQUEST_VERSION = "fiction_nlu_event_request_v1"
ANALYSIS_VERSION = "event_analysis_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu5Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu5Error(message)


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
                raise Nlu5Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
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


def load_dependencies(script_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    nlu0_path = script_dir / "fiction-sample-nlu-contract-v1.py"
    nlu2_path = script_dir / "fiction-sample-nlu-character-resolve-v1.py"
    require(nlu0_path.is_file(), f"missing NLU-0 contract: {nlu0_path}")
    require(nlu2_path.is_file(), f"missing NLU-2 resolver: {nlu2_path}")
    return runpy.run_path(str(nlu0_path)), runpy.run_path(str(nlu2_path))


def load_database(db_root: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    passages = load_jsonl(db_root / "records" / "passages_v1.jsonl")
    scenes = {row["scene_id"]: row for row in load_jsonl(db_root / "records" / "scenes_v1.jsonl")}
    novels = {row["novel_id"]: row for row in load_jsonl(db_root / "records" / "novels_v1.jsonl")}
    return passages, scenes, novels


def entity_registry_sha256(character_record: dict[str, Any]) -> str:
    payload = character_record["payload"]
    return sha256_text(
        canonical_json(
            {
                "entities": payload["entities"],
                "mentions": payload["mentions"],
                "merge_events": payload["merge_events"],
            }
        )
    )


def validate_character_dependency(
    record: dict[str, Any],
    *,
    db_root: Path,
    nlu0: dict[str, Any],
    nlu2: dict[str, Any],
) -> None:
    database = nlu0["load_database"](db_root)
    nlu0["validate_record"](record, database, allow_retrieval_admission=False)
    require(record.get("analysis_kind") == "character_resolution", "dependency is not character_resolution")
    require(record.get("analysis_version") == "character_resolution_v1", "unsupported character_resolution version")
    config_path = Path(__file__).resolve().parent.parent / "config" / "fiction-nlu-character-resolution-v1.json"
    config, config_sha = nlu2["load_config"](config_path)
    passage_rows, _scenes, _novels = load_database(db_root)
    passages = {row["passage_id"]: row for row in passage_rows}
    nlu2["validate_payload"](record.get("payload"), passages, config, config_sha)


def normalize_trigger(value: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value).strip()).lower()


def character_indexes(character_record: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    entities = {e["entity_id"]: e for e in character_record["payload"]["entities"]}
    mentions_by_passage: dict[str, list[dict[str, Any]]] = defaultdict(list)
    mention_by_id: dict[str, dict[str, Any]] = {}
    for mention in character_record["payload"]["mentions"]:
        mention_by_id[mention["mention_id"]] = mention
        if mention.get("entity_id") in entities:
            mentions_by_passage[mention["passage_id"]].append(mention)
    for rows in mentions_by_passage.values():
        rows.sort(key=lambda m: (m["passage_span"]["start"], m["passage_span"]["end"], m["mention_id"]))
    return entities, mentions_by_passage, mention_by_id


def select_passages(
    all_passages: list[dict[str, Any]],
    novel_id: str,
    status_filter: list[str],
) -> list[dict[str, Any]]:
    allowed = set(status_filter)
    rows = [
        row for row in all_passages
        if row.get("novel_id") == novel_id and (not allowed or row.get("status") in allowed)
    ]
    rows.sort(key=lambda row: (row.get("source_order", 0), row.get("char_start", 0), row["passage_id"]))
    return rows


def build_windows(passages: list[dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
    policy = config["window_policy"]
    max_chars = int(policy["max_chars"])
    max_passages = int(policy["max_passages"])
    overlap = int(policy["overlap_passages"])
    require(max_passages >= 1, "window max_passages must be positive")
    require(0 <= overlap < max_passages, "window overlap must be smaller than max_passages")
    windows = []
    start = 0
    while start < len(passages):
        chosen = []
        chars = 0
        index = start
        while index < len(passages) and len(chosen) < max_passages:
            row = passages[index]
            row_chars = len(row.get("text") or "")
            if chosen and chars + row_chars > max_chars:
                break
            chosen.append(row)
            chars += row_chars
            index += 1
            if chars >= max_chars:
                break
        if not chosen:
            chosen = [passages[start]]
            chars = len(chosen[0].get("text") or "")
            index = start + 1
        windows.append(
            {
                "window_id": stable_id(
                    "EVW",
                    {
                        "passage_ids": [row["passage_id"] for row in chosen],
                        "hashes": [row["content_sha256"] for row in chosen],
                    },
                ),
                "passages": chosen,
                "passage_ids": [row["passage_id"] for row in chosen],
                "char_count": chars,
                "overlap_from_previous": 0 if not windows else min(overlap, len(chosen)),
            }
        )
        if index >= len(passages):
            break
        start = max(start + 1, index - overlap)
    return windows


def unique_context(text: str, start: int, end: int) -> tuple[int, int] | None:
    surface = text[start:end]
    for radius in (12, 20, 36, 64, 96):
        left = max(0, start - radius)
        right = min(len(text), end + radius)
        quote = text[left:right]
        if text.count(quote) == 1 and quote.count(surface) == 1:
            return left, right
    if text.count(surface) == 1:
        return start, end
    return None


def arguments_from_character_mentions(
    passage: dict[str, Any],
    trigger_start: int,
    trigger_end: int,
    context_start: int,
    context_end: int,
    mentions_by_passage: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    rows = []
    for mention in mentions_by_passage.get(passage["passage_id"], []):
        span = mention["passage_span"]
        if span["start"] < context_start or span["end"] > context_end:
            continue
        if span["end"] <= trigger_start:
            role = "actor"
        elif span["start"] >= trigger_end:
            role = "target"
        else:
            role = "experiencer"
        rows.append(
            {
                "role": role,
                "surface": mention["surface"],
                "passage_span": dict(span),
                "entity_id": mention["entity_id"],
                "mention_id": mention["mention_id"],
            }
        )
    dedup = {}
    for row in rows:
        key = (row["role"], row["mention_id"], row["passage_span"]["start"], row["passage_span"]["end"])
        dedup[key] = row
    return sorted(dedup.values(), key=lambda x: (x["passage_span"]["start"], x["passage_span"]["end"], x["role"]))


def heuristic_events_for_passage(
    passage: dict[str, Any],
    config: dict[str, Any],
    mentions_by_passage: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    text = passage["text"]
    candidates = []
    occupied: list[tuple[int, int]] = []
    for event_type, spec in config["event_types"].items():
        for hint in sorted(spec.get("lexical_hints") or [], key=lambda x: (-len(x), x)):
            for match in re.finditer(re.escape(hint), text):
                start, end = match.start(), match.end()
                if any(not (end <= a or start >= b) for a, b in occupied):
                    continue
                ctx = unique_context(text, start, end)
                if ctx is None:
                    continue
                context_start, context_end = ctx
                occupied.append((start, end))
                candidates.append(
                    {
                        "passage_id": passage["passage_id"],
                        "event_type": event_type,
                        "trigger": hint,
                        "context_quote": text[context_start:context_end],
                        "confidence": 0.86,
                        "arguments": arguments_from_character_mentions(
                            passage,
                            start,
                            end,
                            context_start,
                            context_end,
                            mentions_by_passage,
                        ),
                    }
                )
                if len(candidates) >= int(config["extraction_policy"]["max_events_per_passage"]):
                    return candidates
    return candidates


def _ollama_json(
    *,
    model: str,
    url: str,
    timeout_seconds: int,
    config: dict[str, Any],
    system: str,
    user: str,
    schema: dict[str, Any],
    num_predict: int,
) -> dict[str, Any]:
    payload = {
        "model": model,
        "stream": False,
        "format": schema,
        "think": bool(config["provider_policy"].get("think", False)),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "options": {"temperature": 0, "num_predict": num_predict},
    }
    req = urllib.request.Request(
        url.rstrip("/") + "/api/chat",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise Nlu5Error(f"ollama provider failed: {exc}") from exc
    content = ((raw.get("message") or {}).get("content") or "").strip()
    require(content, "ollama returned empty content")
    try:
        value = json.loads(content)
    except json.JSONDecodeError as exc:
        raise Nlu5Error(f"ollama returned invalid JSON: {exc}") from exc
    require(isinstance(value, dict), "ollama response must be a JSON object")
    return value


def ollama_events_for_passage(
    passage: dict[str, Any],
    character_record: dict[str, Any],
    config: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> list[dict[str, Any]]:
    entities, mentions_by_passage, _ = character_indexes(character_record)
    grounded = [
        {
            "mention_id": m["mention_id"],
            "entity_id": m["entity_id"],
            "surface": m["surface"],
            "passage_span": m["passage_span"],
            "canonical_name": entities[m["entity_id"]]["canonical_name"],
        }
        for m in mentions_by_passage.get(passage["passage_id"], [])
        if m.get("entity_id") in entities
    ]
    response_schema = {
        "type": "object",
        "properties": {
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "event_type": {"type": "string", "enum": sorted(config["event_types"])},
                        "trigger": {"type": "string"},
                        "context_quote": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "arguments": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "role": {"type": "string", "enum": config["argument_roles"]},
                                    "surface": {"type": "string"},
                                },
                                "required": ["role", "surface"],
                            },
                        },
                    },
                    "required": ["event_type", "trigger", "context_quote", "confidence", "arguments"],
                },
            }
        },
        "required": ["events"],
    }
    system = (
        "Extract explicit event mentions from one fiction passage. Return JSON only. "
        "Finite or clearly bounded actions/states such as entering, leaving, speaking, asking, seeing, noticing, "
        "deciding, laughing, giving, attacking, opening, eating, or sleeping ARE event mentions when they are "
        "explicitly stated. Do not return an empty event list when such an explicit event is present. "
        "Every event must be textually evoked in the passage. trigger must be the shortest useful exact substring "
        "that evokes the event, usually the verb or verbal phrase. context_quote must be an exact substring "
        "containing exactly one occurrence of trigger. Use only supplied event types and argument roles. "
        "Do not infer temporal, causal, plot-importance, or hidden/off-page events. Omit only genuinely ambiguous "
        "candidates; do not omit obvious explicit actions. No chain-of-thought."
    )
    user = json.dumps(
        {
            "passage_id": passage["passage_id"],
            "text": passage["text"],
            "grounded_character_mentions": grounded,
            "event_type_choices": [
                {
                    "event_type": event_type,
                    "description": spec["description"],
                }
                for event_type, spec in config["event_types"].items()
            ],
            "argument_roles": config["argument_roles"],
            "example": {
                "text": "角色走進教室，對朋友說晚安。",
                "events": [
                    {"event_type": "event.movement", "trigger": "走進"},
                    {"event_type": "event.communication", "trigger": "說"},
                ],
            },
        },
        ensure_ascii=False,
    )
    value = _ollama_json(
        model=model,
        url=url,
        timeout_seconds=timeout_seconds,
        config=config,
        system=system,
        user=user,
        schema=response_schema,
        num_predict=1800,
    )
    rows = value.get("events")
    require(isinstance(rows, list), "ollama event response must contain events array")
    return rows


def locate_event_row(
    row: dict[str, Any],
    passage: dict[str, Any],
    character_record: dict[str, Any],
    config: dict[str, Any],
    *,
    source: str,
) -> dict[str, Any] | None:
    event_type = row.get("event_type")
    trigger = row.get("trigger")
    quote = row.get("context_quote")
    confidence = row.get("confidence")
    if event_type not in config["event_types"]:
        return None
    if not isinstance(trigger, str) or not trigger or not isinstance(quote, str):
        return None
    if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not math.isfinite(confidence):
        return None
    if float(confidence) < float(config["extraction_policy"]["min_confidence"]):
        return None
    text = passage["text"]
    if text.count(quote) != 1 or quote.count(trigger) != 1:
        return None
    context_start = text.find(quote)
    rel = quote.find(trigger)
    start = context_start + rel
    end = start + len(trigger)

    entities, mentions_by_passage, _ = character_indexes(character_record)
    arguments = []
    if source == "heuristic":
        for arg in row.get("arguments") or []:
            if isinstance(arg, dict):
                arguments.append(arg)
    else:
        for arg in row.get("arguments") or []:
            if not isinstance(arg, dict):
                continue
            role = arg.get("role")
            surface = arg.get("surface")
            if role not in config["argument_roles"] or not isinstance(surface, str) or not surface:
                continue
            matching = [
                m for m in mentions_by_passage.get(passage["passage_id"], [])
                if m.get("entity_id") in entities
                and m["surface"] == surface
                and m["passage_span"]["start"] >= context_start
                and m["passage_span"]["end"] <= context_start + len(quote)
            ]
            if len(matching) == 1:
                m = matching[0]
                arguments.append(
                    {
                        "role": role,
                        "surface": surface,
                        "passage_span": dict(m["passage_span"]),
                        "entity_id": m["entity_id"],
                        "mention_id": m["mention_id"],
                    }
                )
            elif quote.count(surface) == 1:
                rel_arg = quote.find(surface)
                astart = context_start + rel_arg
                arguments.append(
                    {
                        "role": role,
                        "surface": surface,
                        "passage_span": {"start": astart, "end": astart + len(surface)},
                        "entity_id": None,
                        "mention_id": None,
                    }
                )

    mention_id = stable_id(
        "EVM",
        {
            "novel_id": passage["novel_id"],
            "passage_id": passage["passage_id"],
            "event_type": event_type,
            "trigger_start": start,
            "trigger_end": end,
        },
    )
    return {
        "event_mention_id": mention_id,
        "event_type": event_type,
        "passage_id": passage["passage_id"],
        "scene_id": passage.get("scene_id"),
        "confidence": round(float(confidence), 6),
        "trigger": {
            "surface": trigger,
            "start": start,
            "end": end,
            "quote_sha256": sha256_text(trigger),
        },
        "context_span": {"start": context_start, "end": context_start + len(quote)},
        "context_sha256": sha256_text(quote),
        "arguments": arguments,
        "source": source,
    }


def extract_mentions(
    passages: list[dict[str, Any]],
    character_record: dict[str, Any],
    config: dict[str, Any],
    *,
    provider: str,
    model: str | None,
    ollama_url: str,
    timeout_seconds: int,
) -> list[dict[str, Any]]:
    _entities, mentions_by_passage, _ = character_indexes(character_record)
    result: dict[str, dict[str, Any]] = {}
    for passage in passages:
        if provider == "heuristic":
            rows = heuristic_events_for_passage(passage, config, mentions_by_passage)
        elif provider == "ollama":
            require(model, "--model is required for ollama provider")
            rows = ollama_events_for_passage(
                passage,
                character_record,
                config,
                model=model,
                url=ollama_url,
                timeout_seconds=timeout_seconds,
            )
        else:
            raise Nlu5Error(f"unsupported provider: {provider}")
        for row in rows:
            normalized = locate_event_row(
                row,
                passage,
                character_record,
                config,
                source="heuristic" if provider == "heuristic" else "model",
            )
            if normalized is not None:
                result.setdefault(normalized["event_mention_id"], normalized)
    passage_order = {row["passage_id"]: i for i, row in enumerate(passages)}
    return sorted(
        result.values(),
        key=lambda m: (
            passage_order.get(m["passage_id"], 10**9),
            m["trigger"]["start"],
            m["trigger"]["end"],
            m["event_mention_id"],
        ),
    )


def grounded_participants(mention: dict[str, Any]) -> set[str]:
    return {arg["entity_id"] for arg in mention["arguments"] if arg.get("entity_id")}


def coref_candidates(
    mentions: list[dict[str, Any]],
    passages: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[tuple[str, str]]:
    passage_order = {row["passage_id"]: i for i, row in enumerate(passages)}
    by_id = {m["event_mention_id"]: m for m in mentions}
    candidates = []
    max_gap = int(config["coreference_policy"]["candidate_passage_gap"])
    max_per = int(config["coreference_policy"]["max_candidates_per_mention"])
    for i, left in enumerate(mentions):
        local = []
        for right in mentions[i + 1 :]:
            gap = abs(passage_order[left["passage_id"]] - passage_order[right["passage_id"]])
            if gap > max_gap:
                if passage_order[right["passage_id"]] > passage_order[left["passage_id"]]:
                    break
                continue
            if left["event_type"] != right["event_type"]:
                continue
            lp = grounded_participants(left)
            rp = grounded_participants(right)
            if config["coreference_policy"]["require_compatible_grounded_participants"]:
                if not lp or not rp or not (lp & rp):
                    continue
            local.append((left["event_mention_id"], right["event_mention_id"]))
            if len(local) >= max_per:
                break
        candidates.extend(local)
    return candidates


def ollama_coref_decisions(
    candidates: list[tuple[str, str]],
    mentions: list[dict[str, Any]],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> list[dict[str, Any]]:
    if not candidates:
        return []
    mention_by_id = {m["event_mention_id"]: m for m in mentions}
    decisions = []
    batch_size = 12
    response_schema = {
        "type": "object",
        "properties": {
            "decisions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "mention_a": {"type": "string"},
                        "mention_b": {"type": "string"},
                        "same_event": {"type": "boolean"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["mention_a", "mention_b", "same_event", "confidence"],
                },
            }
        },
        "required": ["decisions"],
    }
    for index in range(0, len(candidates), batch_size):
        batch = candidates[index : index + batch_size]
        rows = []
        for a, b in batch:
            ma, mb = mention_by_id[a], mention_by_id[b]
            rows.append(
                {
                    "mention_a": a,
                    "mention_b": b,
                    "event_type": ma["event_type"],
                    "a": {
                        "trigger": ma["trigger"]["surface"],
                        "context": passages[ma["passage_id"]]["text"][ma["context_span"]["start"]:ma["context_span"]["end"]],
                        "participants": sorted(grounded_participants(ma)),
                    },
                    "b": {
                        "trigger": mb["trigger"]["surface"],
                        "context": passages[mb["passage_id"]]["text"][mb["context_span"]["start"]:mb["context_span"]["end"]],
                        "participants": sorted(grounded_participants(mb)),
                    },
                }
            )
        system = (
            "Decide whether each supplied pair of event mentions refers to the exact same event occurrence, not merely the same "
            "kind of repeated action. Return every pair. Prefer same_event=false unless the text clearly refers back to or restates "
            "the identical occurrence. Do not infer temporal or causal relations. JSON only."
        )
        value = _ollama_json(
            model=model,
            url=url,
            timeout_seconds=timeout_seconds,
            config=config,
            system=system,
            user=json.dumps({"pairs": rows}, ensure_ascii=False),
            schema=response_schema,
            num_predict=1000,
        )
        out = value.get("decisions")
        require(isinstance(out, list), "ollama coref response must contain decisions array")
        decisions.extend(out)
    return decisions


class UnionFind:
    def __init__(self, ids: list[str]) -> None:
        self.parent = {item: item for item in ids}

    def find(self, item: str) -> str:
        root = item
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[item] != item:
            nxt = self.parent[item]
            self.parent[item] = root
            item = nxt
        return root

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            keep, other = sorted([ra, rb])
            self.parent[other] = keep


def cluster_mentions(
    mentions: list[dict[str, Any]],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    *,
    decisions: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    mention_by_id = {m["event_mention_id"]: m for m in mentions}
    uf = UnionFind(list(mention_by_id))
    warnings = []
    accepted_pairs: list[tuple[str, str, float]] = []
    threshold = float(config["coreference_policy"]["threshold"])
    allowed = {
        tuple(sorted(pair))
        for pair in coref_candidates(mentions, list(passages.values()), config)
    }
    for row in decisions or []:
        if not isinstance(row, dict) or row.get("same_event") is not True:
            continue
        a, b = row.get("mention_a"), row.get("mention_b")
        pair = tuple(sorted([a, b])) if isinstance(a, str) and isinstance(b, str) else None
        score = row.get("confidence")
        if pair not in allowed:
            warnings.append(f"rejected_coref_outside_candidate_gate:{a}:{b}")
            continue
        if not isinstance(score, (int, float)) or isinstance(score, bool) or not math.isfinite(score) or float(score) < threshold:
            continue
        ma, mb = mention_by_id[a], mention_by_id[b]
        if ma["event_type"] != mb["event_type"]:
            warnings.append(f"rejected_coref_type_mismatch:{a}:{b}")
            continue
        if config["coreference_policy"]["require_compatible_grounded_participants"]:
            if not (grounded_participants(ma) & grounded_participants(mb)):
                warnings.append(f"rejected_coref_participant_mismatch:{a}:{b}")
                continue
        uf.union(a, b)
        accepted_pairs.append((a, b, float(score)))

    groups: dict[str, list[str]] = defaultdict(list)
    for mention_id in mention_by_id:
        groups[uf.find(mention_id)].append(mention_id)

    def mention_order(mid: str) -> tuple[int, int, str]:
        m = mention_by_id[mid]
        p = passages[m["passage_id"]]
        return p["char_start"] + m["trigger"]["start"], m["trigger"]["end"], mid

    clusters = []
    mention_to_event = {}
    for mids in groups.values():
        mids = sorted(mids, key=mention_order)
        canonical = mids[0]
        cm = mention_by_id[canonical]
        event_id = stable_id(
            "EVT",
            {
                "novel_id": passages[cm["passage_id"]]["novel_id"],
                "canonical_mention_id": canonical,
            },
        )
        participants = sorted({eid for mid in mids for eid in grounded_participants(mention_by_id[mid])})
        offsets = [
            passages[mention_by_id[mid]["passage_id"]]["char_start"] + mention_by_id[mid]["trigger"]["start"]
            for mid in mids
        ]
        ends = [
            passages[mention_by_id[mid]["passage_id"]]["char_start"] + mention_by_id[mid]["trigger"]["end"]
            for mid in mids
        ]
        clusters.append(
            {
                "event_id": event_id,
                "event_type": cm["event_type"],
                "canonical_mention_id": canonical,
                "mention_ids": mids,
                "participant_entity_ids": participants,
                "first_novel_offset": min(offsets),
                "last_novel_offset": max(ends),
                "confidence": round(min(mention_by_id[mid]["confidence"] for mid in mids), 6),
            }
        )
        for mid in mids:
            mention_to_event[mid] = event_id

    clusters.sort(key=lambda c: (c["first_novel_offset"], c["event_id"]))
    links = []
    for a, b, score in sorted(accepted_pairs):
        event_id = mention_to_event[a]
        require(event_id == mention_to_event[b], "accepted coref pair did not produce one cluster")
        links.append(
            {
                "coref_link_id": stable_id(
                    "ECL",
                    {"mention_a": min(a, b), "mention_b": max(a, b), "event_id": event_id},
                ),
                "mention_a": min(a, b),
                "mention_b": max(a, b),
                "event_id": event_id,
                "confidence": round(score, 6),
                "reason": "provider_bounded_coreference",
            }
        )
    return clusters, links, warnings


def build_payload(
    character_record: dict[str, Any],
    passages: list[dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
    *,
    provider: str,
    model: str | None,
    ollama_url: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    novel_id = character_record["subject"]["id"]
    windows = build_windows(passages, config)
    mentions = extract_mentions(
        passages,
        character_record,
        config,
        provider=provider,
        model=model,
        ollama_url=ollama_url,
        timeout_seconds=timeout_seconds,
    )
    passage_map = {row["passage_id"]: row for row in passages}
    decisions = []
    if provider == "ollama" and mentions:
        candidates = coref_candidates(mentions, passages, config)
        decisions = ollama_coref_decisions(
            candidates,
            mentions,
            passage_map,
            config,
            model=model or "",
            url=ollama_url,
            timeout_seconds=timeout_seconds,
        )
    clusters, links, warnings = cluster_mentions(
        mentions,
        passage_map,
        config,
        decisions=decisions,
    )
    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha,
        "assertion_scope": config["assertion_scope"],
        "provider": {"name": provider, "model": model, "request_version": REQUEST_VERSION},
        "scope": {
            "novel_id": novel_id,
            "character_resolution_analysis_id": character_record["analysis_id"],
            "complete_event_inventory_claim": False,
            "temporal_relations_resolved": False,
            "causal_relations_resolved": False,
        },
        "entity_registry_sha256": entity_registry_sha256(character_record),
        "windows": [
            {
                "window_id": w["window_id"],
                "passage_ids": w["passage_ids"],
                "char_count": w["char_count"],
                "overlap_from_previous": w["overlap_from_previous"],
            }
            for w in windows
        ],
        "event_mentions": mentions,
        "event_clusters": clusters,
        "coreference_links": links,
        "consistency": {"valid": True, "errors": [], "warnings": warnings},
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
    require(scope.get("novel_id") == character_record["subject"]["id"], "novel lineage mismatch")
    require(scope.get("character_resolution_analysis_id") == character_record["analysis_id"], "character lineage mismatch")
    require(scope.get("complete_event_inventory_claim") is False, "NLU-5 may not claim complete event inventory")
    require(scope.get("temporal_relations_resolved") is False, "NLU-5 may not resolve temporal relations")
    require(scope.get("causal_relations_resolved") is False, "NLU-5 may not resolve causal relations")
    require(payload.get("entity_registry_sha256") == entity_registry_sha256(character_record), "entity registry hash mismatch")

    entities, _mentions_by_passage, char_mention_by_id = character_indexes(character_record)
    mentions = payload.get("event_mentions")
    clusters = payload.get("event_clusters")
    links = payload.get("coreference_links")
    require(isinstance(mentions, list) and isinstance(clusters, list) and isinstance(links, list), "mentions/clusters/links must be arrays")
    mention_by_id = {m["event_mention_id"]: m for m in mentions}
    require(len(mention_by_id) == len(mentions), "duplicate event_mention_id")
    cluster_by_id = {c["event_id"]: c for c in clusters}
    require(len(cluster_by_id) == len(clusters), "duplicate event_id")

    for mention in mentions:
        passage = passages.get(mention["passage_id"])
        require(passage is not None, f'{mention["event_mention_id"]}: missing passage')
        require(mention["event_type"] in config["event_types"], f'{mention["event_mention_id"]}: invalid event_type')
        trigger = mention["trigger"]
        start, end = trigger["start"], trigger["end"]
        text = passage["text"]
        require(0 <= start < end <= len(text), f'{mention["event_mention_id"]}: bad trigger span')
        require(text[start:end] == trigger["surface"], f'{mention["event_mention_id"]}: trigger/span mismatch')
        require(trigger["quote_sha256"] == sha256_text(trigger["surface"]), f'{mention["event_mention_id"]}: trigger hash mismatch')
        ctx = mention["context_span"]
        require(0 <= ctx["start"] < ctx["end"] <= len(text), f'{mention["event_mention_id"]}: bad context span')
        require(ctx["start"] <= start < end <= ctx["end"], f'{mention["event_mention_id"]}: trigger outside context')
        require(mention["context_sha256"] == sha256_text(text[ctx["start"]:ctx["end"]]), f'{mention["event_mention_id"]}: context hash mismatch')
        expected_mid = stable_id(
            "EVM",
            {
                "novel_id": passage["novel_id"],
                "passage_id": passage["passage_id"],
                "event_type": mention["event_type"],
                "trigger_start": start,
                "trigger_end": end,
            },
        )
        require(mention["event_mention_id"] == expected_mid, f'{mention["event_mention_id"]}: non-deterministic mention id')
        for arg in mention["arguments"]:
            span = arg["passage_span"]
            require(0 <= span["start"] < span["end"] <= len(text), f'{mention["event_mention_id"]}: bad argument span')
            require(text[span["start"]:span["end"]] == arg["surface"], f'{mention["event_mention_id"]}: argument span mismatch')
            if arg["entity_id"] is not None or arg["mention_id"] is not None:
                require(arg["entity_id"] in entities, f'{mention["event_mention_id"]}: unknown argument entity')
                cm = char_mention_by_id.get(arg["mention_id"])
                require(cm is not None, f'{mention["event_mention_id"]}: missing argument mention')
                require(cm["entity_id"] == arg["entity_id"], f'{mention["event_mention_id"]}: argument entity mismatch')
                require(cm["passage_id"] == mention["passage_id"], f'{mention["event_mention_id"]}: argument passage mismatch')
                require(cm["passage_span"] == span, f'{mention["event_mention_id"]}: argument span not bound to NLU-2 mention')

    seen_members = set()
    for cluster in clusters:
        mids = cluster["mention_ids"]
        require(mids, f'{cluster["event_id"]}: empty event cluster')
        require(not (set(mids) & seen_members), f'{cluster["event_id"]}: event mention appears in multiple clusters')
        seen_members.update(mids)
        for mid in mids:
            require(mid in mention_by_id, f'{cluster["event_id"]}: missing event mention {mid}')
        ordered = sorted(
            mids,
            key=lambda mid: (
                passages[mention_by_id[mid]["passage_id"]]["char_start"] + mention_by_id[mid]["trigger"]["start"],
                mention_by_id[mid]["trigger"]["end"],
                mid,
            ),
        )
        require(cluster["canonical_mention_id"] == ordered[0], f'{cluster["event_id"]}: canonical mention mismatch')
        canonical = mention_by_id[ordered[0]]
        require(all(mention_by_id[mid]["event_type"] == canonical["event_type"] for mid in mids), f'{cluster["event_id"]}: mixed event types')
        require(cluster["event_type"] == canonical["event_type"], f'{cluster["event_id"]}: cluster event_type mismatch')
        expected_event_id = stable_id(
            "EVT",
            {"novel_id": scope["novel_id"], "canonical_mention_id": ordered[0]},
        )
        require(cluster["event_id"] == expected_event_id, f'{cluster["event_id"]}: non-deterministic event id')
        participants = sorted({eid for mid in mids for eid in grounded_participants(mention_by_id[mid])})
        require(cluster["participant_entity_ids"] == participants, f'{cluster["event_id"]}: participant registry mismatch')

    require(seen_members == set(mention_by_id), "event clusters do not partition all event mentions")

    link_pairs = set()
    adjacency: dict[str, set[str]] = defaultdict(set)
    threshold = float(config["coreference_policy"]["threshold"])
    for link in links:
        a, b = link["mention_a"], link["mention_b"]
        require(a in mention_by_id and b in mention_by_id and a < b, f'{link["coref_link_id"]}: invalid mention pair')
        pair = (a, b)
        require(pair not in link_pairs, f'{link["coref_link_id"]}: duplicate coref pair')
        link_pairs.add(pair)
        require(link["confidence"] >= threshold, f'{link["coref_link_id"]}: coref below threshold')
        ma, mb = mention_by_id[a], mention_by_id[b]
        require(ma["event_type"] == mb["event_type"], f'{link["coref_link_id"]}: event type mismatch')
        require(grounded_participants(ma) & grounded_participants(mb), f'{link["coref_link_id"]}: participant incompatibility')
        cluster = cluster_by_id.get(link["event_id"])
        require(cluster is not None and a in cluster["mention_ids"] and b in cluster["mention_ids"], f'{link["coref_link_id"]}: link cluster mismatch')
        expected = stable_id("ECL", {"mention_a": a, "mention_b": b, "event_id": link["event_id"]})
        require(link["coref_link_id"] == expected, f'{link["coref_link_id"]}: non-deterministic coref link id')
        adjacency[a].add(b)
        adjacency[b].add(a)

    for cluster in clusters:
        mids = cluster["mention_ids"]
        if len(mids) <= 1:
            continue
        visited = {mids[0]}
        frontier = [mids[0]]
        while frontier:
            current = frontier.pop()
            for nxt in adjacency[current]:
                if nxt in mids and nxt not in visited:
                    visited.add(nxt)
                    frontier.append(nxt)
        require(visited == set(mids), f'{cluster["event_id"]}: multi-mention cluster lacks connecting coref evidence')

    consistency = payload.get("consistency") or {}
    require(consistency.get("valid") is True, f"consistency failed: {consistency.get('errors')}")


def build_record(
    character_record: dict[str, Any],
    passages: list[dict[str, Any]],
    payload: dict[str, Any],
    *,
    provider: str,
    model: str | None,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    passage_map = {p["passage_id"]: p for p in passages}
    evidence_ids = sorted({m["passage_id"] for m in payload["event_mentions"]})
    if not evidence_ids and passages:
        evidence_ids = [passages[0]["passage_id"]]
    evidence = [
        {
            "passage_id": pid,
            "scene_id": passage_map[pid].get("scene_id"),
            "novel_id": passage_map[pid]["novel_id"],
            "content_sha256": passage_map[pid]["content_sha256"],
        }
        for pid in evidence_ids
    ]
    scores = [m["confidence"] for m in payload["event_mentions"]]
    confidence = round(sum(scores) / len(scores), 6) if scores else None
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "event",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": character_record["subject"],
        "method": {
            "type": "hybrid",
            "name": "fiction-sample-nlu-event-extract-v1",
            "version": "1",
            "model_id": model,
        },
        "confidence": confidence,
        "evidence": evidence,
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": f"fiction-sample-nlu-event-extract-v1:{provider}",
            "input_sha256": sha256_text(
                canonical_json(
                    {
                        "character_resolution_analysis_id": character_record["analysis_id"],
                        "entity_registry_sha256": payload["entity_registry_sha256"],
                        "event_mentions": payload["event_mentions"],
                        "coreference_links": payload["coreference_links"],
                    }
                )
            ),
            "code_sha256": sha256_bytes(Path(__file__).read_bytes()),
            "model_sha256": None,
            "notes": "NLU-5 provisional event mentions/coreference; temporal and causal relations unresolved.",
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
        return {"schema_version": "fiction_nlu_event_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_event_checkpoint_v1", "checkpoint schema mismatch")
    return value


def command_extract(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    nlu0, nlu2 = load_dependencies(Path(__file__).resolve().parent)
    all_passages, _scenes, novels = load_database(db_root)
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
            if record.get("analysis_kind") == "event" and record.get("analysis_version") == ANALYSIS_VERSION:
                existing.add((record.get("subject") or {}).get("id"))
    database = nlu0["load_database"](db_root)
    summary = {
        "selected": len(character_records),
        "written": 0,
        "skipped": 0,
        "event_mentions": 0,
        "event_clusters": 0,
        "coreference_links": 0,
        "errors": 0,
    }
    statuses = sorted(set((args.statuses or "accepted,golden").split(",")))

    for character_record in character_records:
        novel_id = (character_record.get("subject") or {}).get("id")
        if novel_id in completed or novel_id in existing:
            summary["skipped"] += 1
            continue
        try:
            require(novel_id in novels, f"character record novel missing: {novel_id}")
            validate_character_dependency(
                character_record,
                db_root=db_root,
                nlu0=nlu0,
                nlu2=nlu2,
            )
            passages = select_passages(all_passages, novel_id, statuses)
            require(passages, f"no selected canonical passages for {novel_id}")
            payload = build_payload(
                character_record,
                passages,
                config,
                config_sha,
                provider=args.provider,
                model=args.model,
                ollama_url=args.ollama_url,
                timeout_seconds=args.timeout_seconds,
            )
            validate_payload(payload, character_record, {p["passage_id"]: p for p in passages}, config, config_sha)
            record = build_record(
                character_record,
                passages,
                payload,
                provider=args.provider,
                model=args.model,
                nlu0=nlu0,
            )
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            append_jsonl(output_path, record)
            completed[novel_id] = {
                "analysis_id": record["analysis_id"],
                "character_resolution_analysis_id": character_record["analysis_id"],
                "entity_registry_sha256": payload["entity_registry_sha256"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            errors.pop(novel_id, None)
            summary["written"] += 1
            summary["event_mentions"] += len(payload["event_mentions"])
            summary["event_clusters"] += len(payload["event_clusters"])
            summary["coreference_links"] += len(payload["coreference_links"])
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
    nlu0, nlu2 = load_dependencies(Path(__file__).resolve().parent)
    all_passages, _scenes, _novels = load_database(db_root)
    passage_map = {row["passage_id"]: row for row in all_passages}
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
            require(record.get("analysis_kind") == "event", "record is not event")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            novel_id = (record.get("subject") or {}).get("id")
            character_record = character_records.get(novel_id)
            require(character_record is not None, f"missing character-resolution dependency for {novel_id}")
            validate_character_dependency(
                character_record,
                db_root=db_root,
                nlu0=nlu0,
                nlu2=nlu2,
            )
            validate_payload(record.get("payload"), character_record, passage_map, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_event_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-5 event mention extraction and conservative event coreference.")
    sub = parser.add_subparsers(dest="command", required=True)

    extract = sub.add_parser("extract")
    extract.add_argument("--db-root", required=True)
    extract.add_argument("--config", required=True)
    extract.add_argument("--character-resolution", required=True)
    extract.add_argument("--output", required=True)
    extract.add_argument("--checkpoint")
    extract.add_argument("--provider", choices=["heuristic", "ollama"], default="heuristic")
    extract.add_argument("--model")
    extract.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    extract.add_argument("--timeout-seconds", type=int, default=120)
    extract.add_argument("--novel-id", action="append")
    extract.add_argument("--limit-novels", type=int)
    extract.add_argument("--statuses", default="accepted,golden")
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
    except (Nlu5Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
