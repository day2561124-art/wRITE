from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import runpy
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_character_resolution_v1"
PAYLOAD_VERSION = "fiction_nlu_character_resolution_v1"
REQUEST_VERSION = "fiction_nlu_character_resolution_request_v1"
ANALYSIS_VERSION = "character_resolution_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu2Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu2Error(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def stable_id(prefix: str, identity: Any) -> str:
    digest = sha256_text(canonical_json(identity))[:16].upper()
    return f"{prefix}-{digest}"


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
                raise Nlu2Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
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
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def load_config(path: Path) -> tuple[dict[str, Any], str]:
    config = load_json(path)
    require(config.get("config_version") == CONFIG_VERSION, "unexpected config_version")
    return config, sha256_text(canonical_json(config))


def normalize_name(value: str, config: dict[str, Any]) -> str:
    text = value
    norm = config["normalization"]
    if norm.get("unicode_nfkc"):
        text = unicodedata.normalize("NFKC", text)
    if norm.get("trim_whitespace"):
        text = text.strip()
    if norm.get("collapse_internal_whitespace"):
        text = re.sub(r"\s+", " ", text)
    if norm.get("strip_outer_punctuation"):
        text = text.strip(" \t\r\n，。！？；：、,.!?;:「」『』“”\"'（）()【】[]")
    if norm.get("lowercase_latin"):
        text = text.lower()
    return text


def load_database_rows(db_root: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    passages = load_jsonl(db_root / "records" / "passages_v1.jsonl")
    scenes = {row["scene_id"]: row for row in load_jsonl(db_root / "records" / "scenes_v1.jsonl")}
    novels = {row["novel_id"]: row for row in load_jsonl(db_root / "records" / "novels_v1.jsonl")}
    return passages, scenes, novels


def select_novels(
    passages: list[dict[str, Any]],
    novels: dict[str, dict[str, Any]],
    args: argparse.Namespace,
) -> dict[str, list[dict[str, Any]]]:
    requested = set(args.novel_id or [])
    statuses = set((args.statuses or "accepted,golden").split(","))
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in passages:
        nid = row.get("novel_id")
        if requested and nid not in requested:
            continue
        if not args.include_all_statuses and row.get("status") not in statuses:
            continue
        grouped[nid].append(row)
    for nid in list(grouped):
        require(nid in novels, f"passage novel missing from canonical novels: {nid}")
        grouped[nid].sort(key=lambda row: (row.get("source_order", 0), row.get("char_start", 0), row["passage_id"]))
    ordered = dict(sorted(grouped.items(), key=lambda item: item[0]))
    if args.limit_novels is not None:
        ordered = dict(list(ordered.items())[: args.limit_novels])
    return ordered


def build_windows(passages: list[dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
    policy = config["window_policy"]
    max_chars = int(policy["max_chars"])
    max_passages = int(policy["max_passages"])
    overlap = int(policy["overlap_passages"])
    require(max_passages >= 1, "window max_passages must be positive")
    require(0 <= overlap < max_passages, "window overlap must be smaller than max_passages")
    windows: list[dict[str, Any]] = []
    start = 0
    while start < len(passages):
        chosen: list[dict[str, Any]] = []
        chars = 0
        index = start
        while index < len(passages) and len(chosen) < max_passages:
            candidate = passages[index]
            candidate_chars = len(candidate.get("text") or "")
            if chosen and chars + candidate_chars > max_chars:
                break
            chosen.append(candidate)
            chars += candidate_chars
            index += 1
            if chars >= max_chars:
                break
        if not chosen:
            chosen = [passages[start]]
            index = start + 1
            chars = len(chosen[0].get("text") or "")
        identity = {
            "passage_ids": [row["passage_id"] for row in chosen],
            "hashes": [row["content_sha256"] for row in chosen],
        }
        windows.append(
            {
                "window_id": stable_id("WIN", identity),
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


def passage_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "passage_id": row["passage_id"],
        "scene_id": row.get("scene_id"),
        "char_start": row["char_start"],
        "char_end": row["char_end"],
        "content_sha256": row["content_sha256"],
        "text": row["text"],
    }


def build_request(
    novel_id: str,
    window: dict[str, Any],
    known_entities: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha256: str,
) -> dict[str, Any]:
    limit = int(config["window_policy"]["known_entity_prompt_limit"])
    known = sorted(known_entities.values(), key=lambda e: e["canonical_name"])[:limit]
    return {
        "request_version": REQUEST_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha256,
        "novel_id": novel_id,
        "window_id": window["window_id"],
        "passages": [passage_payload(row) for row in window["passages"]],
        "known_anchored_entities": [
            {
                "entity_id": entity["entity_id"],
                "canonical_name": entity["canonical_name"],
                "aliases": entity["aliases"],
            }
            for entity in known
        ],
        "instructions": [
            "Detect person/character mentions only; do not detect locations, organizations, objects, or generic groups.",
            "For every mention return passage_id, surface, a unique exact context_quote copied from that passage, mention_type, canonical_name, and score.",
            "mention_type must be proper, pronoun, or nominal.",
            "For proper mentions, canonical_name must be an explicit proper-name surface observed in this window or an already-known anchored canonical_name.",
            "Pronoun and nominal mentions may link only to an explicit anchored canonical_name. Use canonical_name=null when uncertain.",
            "First/second-person pronouns must remain canonical_name=null because speaker attribution is outside this phase.",
            "Do not invent names. Do not infer relationships or plot facts. Return JSON only.",
        ],
    }


def heuristic_provider(
    request: dict[str, Any],
    *,
    seed_names: list[str],
    config: dict[str, Any],
) -> dict[str, Any]:
    mentions: list[dict[str, Any]] = []
    anchors = sorted(set(seed_names), key=lambda value: (-len(value), value))
    third = set(config["third_person_pronouns"])
    first_second = set(config["first_second_person_pronouns"])
    for passage in request["passages"]:
        text = passage["text"]
        pid = passage["passage_id"]
        found_anchor_names: list[str] = []
        for name in anchors:
            for match in re.finditer(re.escape(name), text):
                start = match.start()
                left = max(0, start - 10)
                right = min(len(text), match.end() + 10)
                quote = text[left:right]
                if text.count(quote) != 1:
                    quote = text[start:match.end()]
                mentions.append(
                    {
                        "passage_id": pid,
                        "surface": name,
                        "context_quote": quote,
                        "mention_type": "proper",
                        "canonical_name": name,
                        "score": 0.99,
                    }
                )
                found_anchor_names.append(name)
        unique_anchor = sorted(set(found_anchor_names))
        for pronoun in sorted(third | first_second, key=lambda value: (-len(value), value)):
            for match in re.finditer(re.escape(pronoun), text):
                start = match.start()
                left = max(0, start - 10)
                right = min(len(text), match.end() + 10)
                quote = text[left:right]
                canonical = unique_anchor[0] if pronoun in third and len(unique_anchor) == 1 else None
                mentions.append(
                    {
                        "passage_id": pid,
                        "surface": pronoun,
                        "context_quote": quote,
                        "mention_type": "pronoun",
                        "canonical_name": canonical,
                        "score": 0.91 if canonical else 0.75,
                    }
                )
    return {"mentions": mentions}


def _ollama_json(
    *,
    model: str,
    url: str,
    timeout_seconds: int,
    config: dict[str, Any],
    system: str,
    user: str,
    response_schema: dict[str, Any],
    num_predict: int,
) -> dict[str, Any]:
    payload = {
        "model": model,
        "stream": False,
        "format": response_schema,
        "think": bool(config["provider_policy"].get("think", False)),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "options": {"temperature": 0, "num_predict": num_predict},
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
        raise Nlu2Error(f"ollama provider failed: {exc}") from exc
    content = ((raw.get("message") or {}).get("content") or "").strip()
    require(content, "ollama returned empty content")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise Nlu2Error(f"ollama returned invalid JSON: {exc}") from exc
    require(isinstance(parsed, dict), "ollama response must be a JSON object")
    return parsed


def _unique_context_quote(text: str, start: int, end: int) -> str:
    surface = text[start:end]
    for radius in (8, 14, 24, 40, 64, 96):
        left = max(0, start - radius)
        right = min(len(text), end + radius)
        quote = text[left:right]
        if text.count(quote) == 1 and quote.count(surface) == 1:
            return quote
    return surface if text.count(surface) == 1 else ""


def _ollama_proper_anchors(
    passage: dict[str, Any],
    request: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    response_schema = {
        "type": "object",
        "properties": {
            "anchors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "surface": {"type": "string"},
                        "canonical_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "score": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["surface", "canonical_name", "score"],
                },
            }
        },
        "required": ["anchors"],
    }
    system = (
        "Extract only unique explicit proper-name surfaces that refer to individual characters/persons in this passage. "
        "Do not output pronouns, titles alone, generic roles, groups, locations, organizations, or objects. "
        "Every surface must appear verbatim in the passage. canonical_name must either equal one of the explicit proper-name "
        "surfaces in this passage, equal a supplied known anchored canonical_name, or be null. Prefer omission over guessing. "
        "Return JSON only and no chain-of-thought."
    )
    user = json.dumps(
        {
            "passage_id": passage["passage_id"],
            "text": passage["text"],
            "known_anchored_entities": request["known_anchored_entities"],
        },
        ensure_ascii=False,
    )
    parsed = _ollama_json(
        model=model,
        url=url,
        timeout_seconds=timeout_seconds,
        config=config,
        system=system,
        user=user,
        response_schema=response_schema,
        num_predict=900,
    )
    rows = parsed.get("anchors")
    require(isinstance(rows, list), "ollama proper-anchor response must contain anchors array")
    mentions: list[dict[str, Any]] = []
    text = passage["text"]
    pid = passage["passage_id"]
    for row in rows:
        if not isinstance(row, dict):
            continue
        surface = row.get("surface")
        score = row.get("score")
        canonical_name = row.get("canonical_name")
        if not isinstance(surface, str) or not surface or surface not in text:
            continue
        if not isinstance(score, (int, float)) or isinstance(score, bool) or not 0 <= float(score) <= 1:
            continue
        for match in re.finditer(re.escape(surface), text):
            quote = _unique_context_quote(text, match.start(), match.end())
            if not quote:
                continue
            mentions.append(
                {
                    "passage_id": pid,
                    "surface": surface,
                    "context_quote": quote,
                    "mention_type": "proper",
                    "canonical_name": canonical_name,
                    "score": float(score),
                }
            )
    return mentions


def _pronoun_candidates(passage: dict[str, Any], config: dict[str, Any]) -> list[dict[str, Any]]:
    text = passage["text"]
    pronouns = sorted(
        set(config["third_person_pronouns"]) | set(config["first_second_person_pronouns"]),
        key=lambda value: (-len(value), value),
    )
    candidates: list[dict[str, Any]] = []
    occupied: list[tuple[int, int]] = []
    for pronoun in pronouns:
        for match in re.finditer(re.escape(pronoun), text):
            start, end = match.start(), match.end()
            if any(not (end <= a or start >= b) for a, b in occupied):
                continue
            quote = _unique_context_quote(text, start, end)
            if not quote:
                continue
            occupied.append((start, end))
            candidates.append(
                {
                    "candidate_id": stable_id(
                        "PRN",
                        {"passage_id": passage["passage_id"], "start": start, "end": end, "surface": pronoun},
                    ),
                    "passage_id": passage["passage_id"],
                    "surface": pronoun,
                    "context_quote": quote,
                    "start": start,
                    "end": end,
                }
            )
    candidates.sort(key=lambda item: (item["start"], item["end"], item["candidate_id"]))
    return candidates


def _ollama_pronoun_links(
    passage: dict[str, Any],
    candidates: list[dict[str, Any]],
    anchor_names: list[str],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    first_second = set(config["first_second_person_pronouns"])
    mentions: list[dict[str, Any]] = []
    linkable = [c for c in candidates if c["surface"] not in first_second]
    for c in candidates:
        if c["surface"] in first_second:
            mentions.append(
                {
                    "passage_id": c["passage_id"],
                    "surface": c["surface"],
                    "context_quote": c["context_quote"],
                    "mention_type": "pronoun",
                    "canonical_name": None,
                    "score": 1.0,
                }
            )
    if not linkable:
        return mentions
    if not anchor_names:
        for c in linkable:
            mentions.append(
                {
                    "passage_id": c["passage_id"],
                    "surface": c["surface"],
                    "context_quote": c["context_quote"],
                    "mention_type": "pronoun",
                    "canonical_name": None,
                    "score": 0.5,
                }
            )
        return mentions

    response_schema = {
        "type": "object",
        "properties": {
            "links": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "candidate_id": {"type": "string"},
                        "canonical_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "score": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["candidate_id", "canonical_name", "score"],
                },
            }
        },
        "required": ["links"],
    }
    by_id = {c["candidate_id"]: c for c in linkable}
    batch_size = 12
    linked_rows: dict[str, dict[str, Any]] = {}
    for index in range(0, len(linkable), batch_size):
        batch = linkable[index:index + batch_size]
        system = (
            "Link each supplied third-person pronoun candidate to one of the supplied explicit anchored character names only "
            "when the local context makes the referent clear. Otherwise canonical_name must be null. Do not invent names, "
            "relationships, speaker identities, or plot facts. Return one row for every candidate_id. JSON only."
        )
        user = json.dumps(
            {
                "passage_id": passage["passage_id"],
                "anchor_names": anchor_names,
                "candidates": [
                    {
                        "candidate_id": c["candidate_id"],
                        "surface": c["surface"],
                        "context_quote": c["context_quote"],
                    }
                    for c in batch
                ],
            },
            ensure_ascii=False,
        )
        parsed = _ollama_json(
            model=model,
            url=url,
            timeout_seconds=timeout_seconds,
            config=config,
            system=system,
            user=user,
            response_schema=response_schema,
            num_predict=900,
        )
        rows = parsed.get("links")
        if not isinstance(rows, list):
            rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            cid = row.get("candidate_id")
            if cid not in by_id or cid in linked_rows:
                continue
            canonical_name = row.get("canonical_name")
            if canonical_name not in anchor_names:
                canonical_name = None
            score = row.get("score")
            if not isinstance(score, (int, float)) or isinstance(score, bool) or not 0 <= float(score) <= 1:
                continue
            linked_rows[cid] = {"canonical_name": canonical_name, "score": float(score)}

    for c in linkable:
        row = linked_rows.get(c["candidate_id"], {"canonical_name": None, "score": 0.5})
        mentions.append(
            {
                "passage_id": c["passage_id"],
                "surface": c["surface"],
                "context_quote": c["context_quote"],
                "mention_type": "pronoun",
                "canonical_name": row["canonical_name"],
                "score": row["score"],
            }
        )
    return mentions


def ollama_provider(
    request: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
    config: dict[str, Any],
) -> dict[str, Any]:
    mentions: list[dict[str, Any]] = []
    known_anchor_names = [
        item["canonical_name"]
        for item in request["known_anchored_entities"]
        if isinstance(item.get("canonical_name"), str)
    ]
    for passage in request["passages"]:
        proper_mentions = _ollama_proper_anchors(
            passage,
            request,
            model=model,
            url=url,
            timeout_seconds=timeout_seconds,
            config=config,
        )
        mentions.extend(proper_mentions)
        local_anchor_names = sorted(
            set(known_anchor_names)
            | {
                row["surface"]
                for row in proper_mentions
                if isinstance(row.get("surface"), str)
            }
            | {
                row["canonical_name"]
                for row in proper_mentions
                if isinstance(row.get("canonical_name"), str)
            }
        )
        candidates = _pronoun_candidates(passage, config)
        mentions.extend(
            _ollama_pronoun_links(
                passage,
                candidates,
                local_anchor_names,
                model=model,
                url=url,
                timeout_seconds=timeout_seconds,
                config=config,
            )
        )
    return {"mentions": mentions}


def locate_context_and_surface(text: str, context_quote: str, surface: str) -> tuple[int, int, int, int] | None:
    if not context_quote or not surface:
        return None
    if text.count(context_quote) != 1:
        return None
    context_start = text.find(context_quote)
    if context_start < 0 or context_quote.count(surface) != 1:
        return None
    relative = context_quote.find(surface)
    mention_start = context_start + relative
    mention_end = mention_start + len(surface)
    return mention_start, mention_end, context_start, context_start + len(context_quote)


def normalize_provider_mentions(
    provider_response: dict[str, Any],
    window: dict[str, Any],
    known_entities: dict[str, dict[str, Any]],
    novel_id: str,
    config: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    passage_map = {row["passage_id"]: row for row in window["passages"]}
    rows = provider_response.get("mentions")
    require(isinstance(rows, list), "provider response mentions must be an array")
    thresholds = config["thresholds"]
    first_second = set(config["first_second_person_pronouns"])
    warnings: list[str] = []

    raw_propers: list[tuple[str, str]] = []
    for row in rows:
        if not isinstance(row, dict) or row.get("mention_type") != "proper":
            continue
        pid = row.get("passage_id")
        surface = row.get("surface")
        quote = row.get("context_quote")
        passage = passage_map.get(pid)
        if passage is None or not isinstance(surface, str) or not isinstance(quote, str):
            continue
        if locate_context_and_surface(passage["text"], quote, surface) is None:
            continue
        score = row.get("score")
        if isinstance(score, (int, float)) and not isinstance(score, bool) and score >= thresholds["proper_anchor"]:
            raw_propers.append((surface, normalize_name(surface, config)))

    observed_normalized = {normalized for _, normalized in raw_propers if normalized}
    observed_surface_by_normalized: dict[str, str] = {}
    for surface, normalized in raw_propers:
        observed_surface_by_normalized.setdefault(normalized, surface)
    for entity in known_entities.values():
        observed_normalized.add(entity["normalized_name"])
        observed_surface_by_normalized.setdefault(entity["normalized_name"], entity["canonical_name"])

    mentions: list[dict[str, Any]] = []
    seen_identity: set[tuple[str, int, int, str]] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        pid = row.get("passage_id")
        passage = passage_map.get(pid)
        surface = row.get("surface")
        context_quote = row.get("context_quote")
        mention_type = row.get("mention_type")
        score = row.get("score")
        canonical_name = row.get("canonical_name")
        if passage is None or mention_type not in config["mention_types"]:
            continue
        if not isinstance(surface, str) or not isinstance(context_quote, str):
            continue
        if not isinstance(score, (int, float)) or isinstance(score, bool) or not 0 <= float(score) <= 1:
            continue
        located = locate_context_and_surface(passage["text"], context_quote, surface)
        if located is None:
            warnings.append(f"rejected_unlocatable:{pid}:{surface}")
            continue
        start, end, context_start, context_end = located
        identity = (pid, start, end, mention_type)
        if identity in seen_identity:
            continue
        seen_identity.add(identity)

        entity_id: str | None = None
        link_state = "unresolved"
        source = "unresolved_provider"

        if mention_type == "proper":
            if score < thresholds["proper_anchor"]:
                continue
            surface_normalized = normalize_name(surface, config)
            if not surface_normalized:
                continue
            target_normalized = surface_normalized
            if isinstance(canonical_name, str):
                proposed = normalize_name(canonical_name, config)
                if proposed in observed_normalized and proposed != surface_normalized and score >= thresholds["alias_link"]:
                    target_normalized = proposed
            target_name = observed_surface_by_normalized.get(target_normalized, surface)
            entity_id = stable_id("CHR", {"novel_id": novel_id, "normalized_name": target_normalized})
            canonical_name = target_name
            link_state = "proper_anchor"
            source = "provider_proper_anchor"
        else:
            if surface in first_second:
                canonical_name = None
            threshold = thresholds["pronoun_link"] if mention_type == "pronoun" else thresholds["nominal_link"]
            if isinstance(canonical_name, str) and score >= threshold:
                proposed = normalize_name(canonical_name, config)
                target_entity = next((e for e in known_entities.values() if e["normalized_name"] == proposed), None)
                if target_entity is None and proposed in observed_normalized:
                    entity_id = stable_id("CHR", {"novel_id": novel_id, "normalized_name": proposed})
                elif target_entity is not None:
                    entity_id = target_entity["entity_id"]
                if entity_id is not None:
                    link_state = "linked"
                    source = "provider_coref"

        mention_id = stable_id(
            "MEN",
            {
                "novel_id": novel_id,
                "passage_id": pid,
                "start": start,
                "end": end,
                "mention_type": mention_type,
                "surface": surface,
            },
        )
        mentions.append(
            {
                "mention_id": mention_id,
                "passage_id": pid,
                "scene_id": passage.get("scene_id"),
                "surface": surface,
                "mention_type": mention_type,
                "confidence": round(float(score), 6),
                "link_state": link_state,
                "entity_id": entity_id,
                "passage_span": {"start": start, "end": end},
                "novel_span": {"start": passage["char_start"] + start, "end": passage["char_start"] + end},
                "quote_sha256": sha256_text(passage["text"][start:end]),
                "context_span": {"start": context_start, "end": context_end},
                "context_sha256": sha256_text(passage["text"][context_start:context_end]),
                "source": source,
                "_canonical_name": canonical_name if isinstance(canonical_name, str) else None,
            }
        )
    return mentions, warnings


def merge_mentions_into_entities(
    novel_id: str,
    mentions: list[dict[str, Any]],
    entities: dict[str, dict[str, Any]],
    config: dict[str, Any],
) -> None:
    for mention in mentions:
        entity_id = mention.get("entity_id")
        if entity_id is None:
            continue
        canonical_name = mention.pop("_canonical_name", None)
        if mention["link_state"] == "proper_anchor":
            normalized = normalize_name(canonical_name or mention["surface"], config)
            canonical = canonical_name or mention["surface"]
            entity = entities.get(entity_id)
            if entity is None:
                entity = {
                    "entity_id": entity_id,
                    "canonical_name": canonical,
                    "normalized_name": normalized,
                    "aliases": [],
                    "anchor_mention_ids": [],
                    "mention_ids": [],
                    "confidence": mention["confidence"],
                    "state": "anchored",
                }
                entities[entity_id] = entity
            if mention["surface"] not in entity["aliases"]:
                entity["aliases"].append(mention["surface"])
            if mention["mention_id"] not in entity["anchor_mention_ids"]:
                entity["anchor_mention_ids"].append(mention["mention_id"])
            entity["confidence"] = max(entity["confidence"], mention["confidence"])
        else:
            mention.pop("_canonical_name", None)
            entity = entities.get(entity_id)
            if entity is None:
                mention["entity_id"] = None
                mention["link_state"] = "unresolved"
                mention["source"] = "unresolved_provider"
                continue
        if mention["mention_id"] not in entity["mention_ids"]:
            entity["mention_ids"].append(mention["mention_id"])


def derive_merge_events(
    novel_id: str,
    entities: dict[str, dict[str, Any]],
    mentions: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    mention_map = {mention["mention_id"]: mention for mention in mentions}
    events: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for entity in entities.values():
        canonical_anchor_ids = [
            mention_id
            for mention_id in entity["anchor_mention_ids"]
            if mention_id in mention_map
            and normalize_name(mention_map[mention_id]["surface"], config) == entity["normalized_name"]
        ]
        if not canonical_anchor_ids:
            continue
        canonical_anchor_id = sorted(canonical_anchor_ids)[0]

        aliases_by_normalized: dict[str, list[str]] = defaultdict(list)
        for mention_id in entity["anchor_mention_ids"]:
            mention = mention_map.get(mention_id)
            if mention is None:
                continue
            alias_normalized = normalize_name(mention["surface"], config)
            if not alias_normalized or alias_normalized == entity["normalized_name"]:
                continue
            aliases_by_normalized[alias_normalized].append(mention_id)

        for alias_normalized, alias_mention_ids in sorted(aliases_by_normalized.items()):
            absorbed_entity_id = stable_id(
                "CHR",
                {"novel_id": novel_id, "normalized_name": alias_normalized},
            )
            key = (entity["entity_id"], absorbed_entity_id)
            if key in seen or absorbed_entity_id == entity["entity_id"]:
                continue
            seen.add(key)
            evidence_ids = sorted(set(alias_mention_ids + [canonical_anchor_id]))
            alias_scores = [
                mention_map[mention_id]["confidence"]
                for mention_id in alias_mention_ids
                if mention_id in mention_map
            ]
            confidence = min(
                [entity["confidence"], *alias_scores]
            ) if alias_scores else entity["confidence"]
            events.append(
                {
                    "merge_id": stable_id(
                        "MRG",
                        {
                            "novel_id": novel_id,
                            "canonical_entity_id": entity["entity_id"],
                            "absorbed_entity_id": absorbed_entity_id,
                            "reason": "provider_observed_alias",
                        },
                    ),
                    "canonical_entity_id": entity["entity_id"],
                    "absorbed_entity_id": absorbed_entity_id,
                    "reason": "provider_observed_alias",
                    "confidence": round(float(confidence), 6),
                    "evidence_mention_ids": evidence_ids,
                }
            )
    return events


def build_payload(
    novel_id: str,
    passages: list[dict[str, Any]],
    windows: list[dict[str, Any]],
    window_responses: list[dict[str, Any]],
    config: dict[str, Any],
    config_sha256: str,
    *,
    provider_name: str,
    model: str | None,
    status_filter: list[str],
) -> dict[str, Any]:
    entities: dict[str, dict[str, Any]] = {}
    all_mentions: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    window_output: list[dict[str, Any]] = []

    for window, response in zip(windows, window_responses):
        mentions, local_warnings = normalize_provider_mentions(response, window, entities, novel_id, config)
        warnings.extend(local_warnings)
        merge_mentions_into_entities(novel_id, mentions, entities, config)
        for mention in mentions:
            mention.pop("_canonical_name", None)
            all_mentions.setdefault(mention["mention_id"], mention)
        window_output.append(
            {
                "window_id": window["window_id"],
                "passage_ids": window["passage_ids"],
                "char_count": window["char_count"],
                "overlap_from_previous": window["overlap_from_previous"],
            }
        )

    for entity in entities.values():
        entity["aliases"].sort()
        entity["anchor_mention_ids"].sort()
        entity["mention_ids"].sort()

    mentions = sorted(
        all_mentions.values(),
        key=lambda item: (item["novel_span"]["start"], item["novel_span"]["end"], item["mention_id"]),
    )
    unresolved = sorted(m["mention_id"] for m in mentions if m["entity_id"] is None)
    merge_events = derive_merge_events(novel_id, entities, mentions, config)

    errors: list[str] = []
    mention_map = {m["mention_id"]: m for m in mentions}
    for entity in entities.values():
        if not entity["anchor_mention_ids"]:
            errors.append(f'{entity["entity_id"]}: entity has no proper anchor')
        for mid in entity["anchor_mention_ids"]:
            m = mention_map.get(mid)
            if m is None or m["mention_type"] != "proper" or m["entity_id"] != entity["entity_id"]:
                errors.append(f'{entity["entity_id"]}: invalid anchor mention {mid}')
    for mention in mentions:
        if mention["entity_id"] is not None and mention["entity_id"] not in entities:
            errors.append(f'{mention["mention_id"]}: linked entity missing')
        if mention["entity_id"] is None and mention["link_state"] != "unresolved":
            errors.append(f'{mention["mention_id"]}: null entity must be unresolved')

    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha256,
        "assertion_scope": config["assertion_scope"],
        "provider": {
            "name": provider_name,
            "model": model,
            "request_version": REQUEST_VERSION,
        },
        "scope": {
            "novel_id": novel_id,
            "passage_count": len(passages),
            "status_filter": status_filter,
            "complete_novel_claim": False,
        },
        "windows": window_output,
        "entities": sorted(entities.values(), key=lambda e: (e["normalized_name"], e["entity_id"])),
        "mentions": mentions,
        "unresolved_mention_ids": unresolved,
        "merge_events": merge_events,
        "consistency": {"valid": not errors, "errors": errors, "warnings": warnings},
    }


def validate_payload(
    payload: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha256: str,
) -> None:
    require(payload.get("schema_version") == PAYLOAD_VERSION, "payload schema_version mismatch")
    require(payload.get("config_version") == CONFIG_VERSION, "payload config_version mismatch")
    require(payload.get("config_sha256") == config_sha256, "payload config_sha256 mismatch")
    require(payload.get("assertion_scope") == config["assertion_scope"], "payload assertion_scope mismatch")
    scope = payload.get("scope") or {}
    require(scope.get("complete_novel_claim") is False, "NLU-2 may not claim complete-novel truth")
    entities = payload.get("entities")
    mentions = payload.get("mentions")
    require(isinstance(entities, list) and isinstance(mentions, list), "payload entities/mentions must be arrays")
    entity_map = {e["entity_id"]: e for e in entities}
    mention_map = {m["mention_id"]: m for m in mentions}
    require(len(entity_map) == len(entities), "duplicate entity_id")
    require(len(mention_map) == len(mentions), "duplicate mention_id")

    for mention in mentions:
        passage = passages.get(mention["passage_id"])
        require(passage is not None, f'{mention["mention_id"]}: passage missing')
        pspan = mention["passage_span"]
        cspan = mention["context_span"]
        text = passage["text"]
        require(0 <= pspan["start"] < pspan["end"] <= len(text), f'{mention["mention_id"]}: bad passage span')
        require(0 <= cspan["start"] < cspan["end"] <= len(text), f'{mention["mention_id"]}: bad context span')
        require(text[pspan["start"]:pspan["end"]] == mention["surface"], f'{mention["mention_id"]}: surface/span mismatch')
        require(mention["quote_sha256"] == sha256_text(mention["surface"]), f'{mention["mention_id"]}: quote hash mismatch')
        require(mention["context_sha256"] == sha256_text(text[cspan["start"]:cspan["end"]]), f'{mention["mention_id"]}: context hash mismatch')
        require(
            mention["novel_span"]["start"] == passage["char_start"] + pspan["start"]
            and mention["novel_span"]["end"] == passage["char_start"] + pspan["end"],
            f'{mention["mention_id"]}: novel span mismatch',
        )
        entity_id = mention["entity_id"]
        if entity_id is None:
            require(mention["link_state"] == "unresolved", f'{mention["mention_id"]}: null entity must be unresolved')
        else:
            require(entity_id in entity_map, f'{mention["mention_id"]}: entity missing')

    for entity in entities:
        require(entity["anchor_mention_ids"], f'{entity["entity_id"]}: entity lacks anchors')
        observed_canonical = False
        for mid in entity["anchor_mention_ids"]:
            mention = mention_map.get(mid)
            require(mention is not None, f'{entity["entity_id"]}: anchor mention missing')
            require(mention["mention_type"] == "proper", f'{entity["entity_id"]}: anchor is not proper')
            require(mention["entity_id"] == entity["entity_id"], f'{entity["entity_id"]}: anchor points elsewhere')
            if normalize_name(mention["surface"], config) == entity["normalized_name"]:
                observed_canonical = True
        require(observed_canonical, f'{entity["entity_id"]}: canonical name is not an observed explicit anchor')
        expected_id = stable_id("CHR", {"novel_id": scope["novel_id"], "normalized_name": entity["normalized_name"]})
        require(entity["entity_id"] == expected_id, f'{entity["entity_id"]}: non-deterministic entity id')

    unresolved_expected = sorted(m["mention_id"] for m in mentions if m["entity_id"] is None)
    require(payload.get("unresolved_mention_ids") == unresolved_expected, "unresolved_mention_ids mismatch")

    merge_events = payload.get("merge_events")
    require(isinstance(merge_events, list), "merge_events must be an array")
    merge_ids: set[str] = set()
    novel_id = scope["novel_id"]
    for event in merge_events:
        require(isinstance(event, dict), "merge event must be an object")
        merge_id = event.get("merge_id")
        require(isinstance(merge_id, str) and merge_id not in merge_ids, f"duplicate merge_id: {merge_id}")
        merge_ids.add(merge_id)
        canonical_entity_id = event.get("canonical_entity_id")
        absorbed_entity_id = event.get("absorbed_entity_id")
        require(canonical_entity_id in entity_map, f"{merge_id}: canonical entity missing")
        require(absorbed_entity_id != canonical_entity_id, f"{merge_id}: merge cannot absorb itself")
        require(absorbed_entity_id not in entity_map, f"{merge_id}: absorbed entity must not remain active")
        require(event.get("reason") in {"provider_observed_alias", "exact_normalized_canonical_name"}, f"{merge_id}: invalid merge reason")
        evidence_ids = event.get("evidence_mention_ids")
        require(isinstance(evidence_ids, list) and len(set(evidence_ids)) >= 2, f"{merge_id}: merge needs at least two unique evidence mentions")
        evidence_mentions = [mention_map.get(mid) for mid in evidence_ids]
        require(all(m is not None for m in evidence_mentions), f"{merge_id}: merge evidence mention missing")
        require(all(m["mention_type"] == "proper" for m in evidence_mentions if m is not None), f"{merge_id}: merge evidence must be proper anchors")
        require(all(m["entity_id"] == canonical_entity_id for m in evidence_mentions if m is not None), f"{merge_id}: merge evidence must resolve to canonical entity")

        canonical_entity = entity_map[canonical_entity_id]
        canonical_evidence = [
            m for m in evidence_mentions
            if m is not None and normalize_name(m["surface"], config) == canonical_entity["normalized_name"]
        ]
        absorbed_evidence = [
            m for m in evidence_mentions
            if m is not None
            and stable_id(
                "CHR",
                {"novel_id": novel_id, "normalized_name": normalize_name(m["surface"], config)},
            ) == absorbed_entity_id
            and normalize_name(m["surface"], config) != canonical_entity["normalized_name"]
        ]
        require(canonical_evidence, f"{merge_id}: missing canonical proper-anchor evidence")
        require(absorbed_evidence, f"{merge_id}: missing absorbed alias proper-anchor evidence")
        expected_merge_id = stable_id(
            "MRG",
            {
                "novel_id": novel_id,
                "canonical_entity_id": canonical_entity_id,
                "absorbed_entity_id": absorbed_entity_id,
                "reason": event["reason"],
            },
        )
        require(merge_id == expected_merge_id, f"{merge_id}: non-deterministic merge id")

    consistency = payload.get("consistency") or {}
    require(consistency.get("valid") is True, f"consistency failed: {consistency.get('errors')}")


def load_nlu0(script_dir: Path) -> dict[str, Any]:
    path = script_dir / "fiction-sample-nlu-contract-v1.py"
    require(path.is_file(), f"missing NLU-0 contract: {path}")
    return runpy.run_path(str(path))


def cache_path_for(cache_dir: Path, request: dict[str, Any], provider: str, model: str | None) -> Path:
    return cache_dir / (sha256_text(canonical_json({"provider": provider, "model": model, "request": request})) + ".json")


def get_window_response(
    request: dict[str, Any],
    args: argparse.Namespace,
    config: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    cache_path = None
    if args.cache_dir:
        cache_path = cache_path_for(Path(args.cache_dir), request, args.provider, args.model)
        if cache_path.exists():
            return load_json(cache_path), True
    if args.provider == "heuristic":
        response = heuristic_provider(request, seed_names=args.seed_name or [], config=config)
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
        raise Nlu2Error(f"unsupported provider: {args.provider}")
    if cache_path is not None:
        write_json_atomic(cache_path, response)
    return response, False


def build_record(
    novel: dict[str, Any],
    passages: list[dict[str, Any]],
    payload: dict[str, Any],
    input_sha256: str,
    *,
    provider: str,
    model: str | None,
    script_path: Path,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    evidence_passages = []
    used_ids = {m["passage_id"] for m in payload["mentions"]}
    if not used_ids and passages:
        used_ids.add(passages[0]["passage_id"])
    for passage in passages:
        if passage["passage_id"] not in used_ids:
            continue
        evidence_passages.append(
            {
                "passage_id": passage["passage_id"],
                "scene_id": passage.get("scene_id"),
                "novel_id": passage["novel_id"],
                "content_sha256": passage["content_sha256"],
            }
        )
    linked = [m["confidence"] for m in payload["mentions"] if m["entity_id"] is not None]
    confidence = round(sum(linked) / len(linked), 6) if linked else None
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "character_resolution",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": {
            "level": "novel",
            "id": novel["novel_id"],
            "content_hash_kind": "novel_text_sha256",
            "content_sha256": novel["text"]["text_sha256"],
        },
        "method": {
            "type": "hybrid",
            "name": "fiction-sample-nlu-character-resolve-v1",
            "version": "1",
            "model_id": model,
        },
        "confidence": confidence,
        "evidence": evidence_passages,
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": f"fiction-sample-nlu-character-resolve-v1:{provider}",
            "input_sha256": input_sha256,
            "code_sha256": sha256_bytes(script_path.read_bytes()),
            "model_sha256": None,
            "notes": "NLU-2 provisional novel-local character resolution; retrieval admission closed.",
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
        return {"schema_version": "fiction_nlu_character_resolution_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_character_resolution_checkpoint_v1", "checkpoint schema mismatch")
    return value


def command_resolve(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    passages_all, _scenes, novels = load_database_rows(db_root)
    selected = select_novels(passages_all, novels, args)
    passage_map = {row["passage_id"]: row for row in passages_all}
    nlu0 = load_nlu0(Path(__file__).resolve().parent)
    canonical_database = nlu0["load_database"](db_root)
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = load_checkpoint(checkpoint_path)
    completed = checkpoint.setdefault("completed", {})
    errors = checkpoint.setdefault("errors", {})
    output_path = Path(args.output)
    existing_novels: set[str] = set()
    if output_path.exists():
        for record in load_jsonl(output_path):
            if record.get("analysis_kind") == "character_resolution" and record.get("analysis_version") == ANALYSIS_VERSION:
                existing_novels.add((record.get("subject") or {}).get("id"))

    summary = {"selected": len(selected), "written": 0, "skipped": 0, "cache_hits": 0, "errors": 0}
    status_filter = [] if args.include_all_statuses else sorted(set((args.statuses or "accepted,golden").split(",")))

    for novel_id, passages in selected.items():
        if novel_id in completed or novel_id in existing_novels:
            summary["skipped"] += 1
            continue
        try:
            windows = build_windows(passages, config)
            known_entities: dict[str, dict[str, Any]] = {}
            responses: list[dict[str, Any]] = []
            input_material = []
            for window in windows:
                request = build_request(novel_id, window, known_entities, config, config_sha)
                response, cache_hit = get_window_response(request, args, config)
                if cache_hit:
                    summary["cache_hits"] += 1
                responses.append(response)
                # Update known anchors conservatively using a temporary one-window payload.
                local_mentions, _ = normalize_provider_mentions(response, window, known_entities, novel_id, config)
                merge_mentions_into_entities(novel_id, local_mentions, known_entities, config)
                input_material.append({"request": request, "response": response})
            payload = build_payload(
                novel_id,
                passages,
                windows,
                responses,
                config,
                config_sha,
                provider_name=args.provider,
                model=args.model,
                status_filter=status_filter,
            )
            validate_payload(payload, passage_map, config, config_sha)
            input_sha = sha256_text(canonical_json(input_material))
            record = build_record(
                novels[novel_id],
                passages,
                payload,
                input_sha,
                provider=args.provider,
                model=args.model,
                script_path=Path(__file__).resolve(),
                nlu0=nlu0,
            )
            nlu0["validate_record"](record, canonical_database, allow_retrieval_admission=False)
            append_jsonl(output_path, record)
            completed[novel_id] = {
                "analysis_id": record["analysis_id"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "passage_count": len(passages),
            }
            errors.pop(novel_id, None)
            summary["written"] += 1
        except Exception as exc:
            errors[novel_id] = str(exc)
            summary["errors"] += 1
            if not args.continue_on_error:
                if checkpoint_path:
                    write_json_atomic(checkpoint_path, checkpoint)
                raise
        if checkpoint_path:
            write_json_atomic(checkpoint_path, checkpoint)
        if args.sleep_seconds:
            time.sleep(args.sleep_seconds)

    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0 if summary["errors"] == 0 else 1


def command_validate(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    passages_all, _scenes, _novels = load_database_rows(db_root)
    passage_map = {row["passage_id"]: row for row in passages_all}
    nlu0 = load_nlu0(Path(__file__).resolve().parent)
    database = nlu0["load_database"](db_root)
    rows = load_jsonl(Path(args.input))
    errors = []
    valid = 0
    for line_number, record in enumerate(rows, 1):
        try:
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            require(record.get("analysis_kind") == "character_resolution", "record is not character_resolution")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            validate_payload(record.get("payload"), passage_map, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_character_resolution_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def add_selection(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--novel-id", action="append")
    parser.add_argument("--statuses", default="accepted,golden")
    parser.add_argument("--include-all-statuses", action="store_true")
    parser.add_argument("--limit-novels", type=int)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-2 conservative novel-local character mention/entity resolution.")
    sub = parser.add_subparsers(dest="command", required=True)

    resolve = sub.add_parser("resolve")
    resolve.add_argument("--db-root", required=True)
    resolve.add_argument("--config", required=True)
    resolve.add_argument("--output", required=True)
    resolve.add_argument("--checkpoint")
    resolve.add_argument("--cache-dir")
    resolve.add_argument("--provider", choices=["heuristic", "ollama"], default="heuristic")
    resolve.add_argument("--seed-name", action="append")
    resolve.add_argument("--model")
    resolve.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    resolve.add_argument("--timeout-seconds", type=int, default=120)
    resolve.add_argument("--sleep-seconds", type=float, default=0)
    resolve.add_argument("--continue-on-error", action="store_true")
    add_selection(resolve)
    resolve.set_defaults(func=command_resolve)

    validate = sub.add_parser("validate")
    validate.add_argument("--db-root", required=True)
    validate.add_argument("--config", required=True)
    validate.add_argument("--input", required=True)
    validate.set_defaults(func=command_validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (Nlu2Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
