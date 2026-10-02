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
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_narrative_function_v1"
PAYLOAD_VERSION = "fiction_nlu_narrative_function_v1"
REQUEST_VERSION = "fiction_nlu_narrative_function_request_v1"
ANALYSIS_VERSION = "narrative_function_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu8Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu8Error(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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
                raise Nlu8Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            require(isinstance(value, dict), f"{path}:{line_number}: record must be object")
            rows.append(value)
    return rows


def load_config(path: Path) -> tuple[dict[str, Any], str]:
    config = load_json(path)
    require(config.get("config_version") == CONFIG_VERSION, "unexpected config_version")
    labels = config.get("function_taxonomy")
    require(isinstance(labels, dict) and labels, "function_taxonomy must be non-empty")
    return config, sha256_text(canonical_json(config))


def plot_graph_registry_sha256(plot_record: dict[str, Any]) -> str:
    payload = plot_record["payload"]
    return sha256_text(
        canonical_json(
            {
                "scope": payload["scope"],
                "event_registry_sha256": payload["event_registry_sha256"],
                "event_relation_registry_sha256": payload["event_relation_registry_sha256"],
                "nodes": payload["nodes"],
                "edges": payload["edges"],
                "components": payload["components"],
                "temporal_layers": payload["temporal_layers"],
            }
        )
    )


def validate_plot_record_minimal(record: dict[str, Any]) -> None:
    require(record.get("analysis_kind") == "plot_structure", "dependency is not plot_structure")
    require(record.get("analysis_version") == "plot_graph_v1", "unsupported plot graph version")
    require(record.get("status") == "provisional", "plot graph dependency must remain provisional")
    admission = record.get("retrieval_admission") or {}
    require(admission.get("state") == "not_admitted", "plot graph dependency must not be retrieval-admitted")
    payload = record.get("payload")
    require(isinstance(payload, dict), "plot graph payload missing")
    scope = payload.get("scope") or {}
    require(scope.get("narrative_function_resolved") is False, "NLU-7 dependency already claims narrative function")
    require(scope.get("salience_resolved") is False, "NLU-7 dependency already claims salience")
    nodes = payload.get("nodes")
    edges = payload.get("edges")
    components = payload.get("components")
    require(isinstance(nodes, list) and isinstance(edges, list) and isinstance(components, list), "plot graph arrays missing")
    node_ids = [n.get("node_id") for n in nodes]
    require(len(set(node_ids)) == len(node_ids), "duplicate plot node ID")
    node_set = set(node_ids)
    for edge in edges:
        require(edge.get("source_node_id") in node_set and edge.get("target_node_id") in node_set, "plot edge references unknown node")
    component_nodes: set[str] = set()
    for component in components:
        members = component.get("node_ids") or []
        require(members, "plot component must contain nodes")
        require(not (component_nodes & set(members)), "plot node appears in multiple components")
        component_nodes.update(members)
    require(component_nodes == node_set, "plot components must partition plot nodes")


def graph_indexes(payload: dict[str, Any]) -> dict[str, Any]:
    nodes = {n["node_id"]: n for n in payload["nodes"]}
    components = {c["component_id"]: c for c in payload["components"]}
    component_for_node: dict[str, str] = {}
    for component_id, component in components.items():
        for node_id in component["node_ids"]:
            component_for_node[node_id] = component_id

    incoming: dict[str, list[dict[str, Any]]] = defaultdict(list)
    outgoing: dict[str, list[dict[str, Any]]] = defaultdict(list)
    directed_successors: dict[str, set[str]] = defaultdict(set)
    for edge in payload["edges"]:
        source = edge["source_node_id"]
        target = edge["target_node_id"]
        outgoing[source].append(edge)
        incoming[target].append(edge)
        if edge["relation_type"] in {
            "temporal.before",
            "causal.causes",
            "causal.enables",
            "causal.prevents",
        }:
            directed_successors[source].add(target)
    return {
        "nodes": nodes,
        "components": components,
        "component_for_node": component_for_node,
        "incoming": incoming,
        "outgoing": outgoing,
        "directed_successors": directed_successors,
    }


def reachable_count(node_id: str, successors: dict[str, set[str]]) -> int:
    seen: set[str] = set()
    queue = deque(sorted(successors.get(node_id, set())))
    while queue:
        current = queue.popleft()
        if current in seen:
            continue
        seen.add(current)
        for nxt in sorted(successors.get(current, set())):
            if nxt not in seen:
                queue.append(nxt)
    return len(seen)


def node_graph_support(node_id: str, index: dict[str, Any]) -> dict[str, int]:
    component_id = index["component_for_node"][node_id]
    component = index["components"][component_id]
    return {
        "incoming_semantic_edges": len(index["incoming"].get(node_id, [])),
        "outgoing_semantic_edges": len(index["outgoing"].get(node_id, [])),
        "downstream_reachable_count": reachable_count(node_id, index["directed_successors"]),
        "component_node_count": len(component["node_ids"]),
    }


def component_graph_support(component_id: str, index: dict[str, Any]) -> dict[str, int]:
    component = index["components"][component_id]
    member_set = set(component["node_ids"])
    incoming = 0
    outgoing = 0
    downstream: set[str] = set()
    for node_id in member_set:
        incoming += len(index["incoming"].get(node_id, []))
        outgoing += len(index["outgoing"].get(node_id, []))
        queue = deque(sorted(index["directed_successors"].get(node_id, set())))
        while queue:
            current = queue.popleft()
            if current in downstream:
                continue
            downstream.add(current)
            for nxt in sorted(index["directed_successors"].get(current, set())):
                if nxt not in downstream:
                    queue.append(nxt)
    return {
        "incoming_semantic_edges": incoming,
        "outgoing_semantic_edges": outgoing,
        "downstream_reachable_count": len(downstream - member_set),
        "component_node_count": len(member_set),
    }


def candidate_labels_for_node(node_id: str, index: dict[str, Any], config: dict[str, Any]) -> list[str]:
    policy = config["candidate_policy"]
    candidates = list(policy["always_include"])
    incoming = index["incoming"].get(node_id, [])
    outgoing = index["outgoing"].get(node_id, [])
    causal_in = [e for e in incoming if e["relation_type"].startswith("causal.")]
    causal_out = [e for e in outgoing if e["relation_type"].startswith("causal.")]
    downstream = reachable_count(node_id, index["directed_successors"])

    if not incoming:
        candidates += ["function.exposition", "function.setup"]
    if causal_out:
        candidates += ["function.setup", "function.escalation", "function.turning_point"]
    if causal_in:
        candidates += ["function.resolution", "function.aftermath", "function.payoff"]
    if causal_in and causal_out:
        candidates += ["function.reversal"]
        if index["components"][index["component_for_node"][node_id]]["node_ids"].__len__() >= 3:
            candidates += ["function.climax"]
    if downstream >= 2:
        candidates += ["function.setup", "function.turning_point", "function.foreshadowing"]
    if incoming and not outgoing:
        candidates += ["function.resolution", "function.aftermath"]

    fallback = [
        "function.exposition",
        "function.setup",
        "function.escalation",
        "function.resolution",
        "function.aftermath",
        "function.reversal",
        "function.callback",
    ]
    ordered = []
    for label in candidates + fallback:
        if label in config["function_taxonomy"] and label not in ordered:
            ordered.append(label)
    minimum = int(policy["min_labels_per_target"])
    maximum = int(policy["max_labels_per_target"])
    require(len(ordered) >= minimum, "candidate policy could not reach minimum labels")
    return ordered[:maximum]


def candidate_labels_for_component(component_id: str, index: dict[str, Any], config: dict[str, Any]) -> list[str]:
    policy = config["candidate_policy"]
    component = index["components"][component_id]
    members = component["node_ids"]
    candidates = list(policy["always_include"]) + [
        "function.exposition",
        "function.setup",
        "function.resolution",
        "function.aftermath",
    ]
    causal_edges = []
    for node_id in members:
        causal_edges.extend(e for e in index["outgoing"].get(node_id, []) if e["relation_type"].startswith("causal."))
    if causal_edges and len(members) >= 2:
        candidates += ["function.escalation"]
    ordered = []
    for label in candidates:
        if label in config["function_taxonomy"] and label not in ordered:
            ordered.append(label)
    minimum = int(policy["min_labels_per_target"])
    maximum = int(policy["max_labels_per_target"])
    require(len(ordered) >= minimum, "component candidate policy could not reach minimum labels")
    return ordered[:maximum]


def build_targets(plot_record: dict[str, Any], config: dict[str, Any]) -> list[dict[str, Any]]:
    validate_plot_record_minimal(plot_record)
    payload = plot_record["payload"]
    index = graph_indexes(payload)
    targets = []
    for node in payload["nodes"]:
        node_id = node["node_id"]
        targets.append(
            {
                "target_type": "node",
                "target_id": node_id,
                "component_id": index["component_for_node"][node_id],
                "candidate_labels": candidate_labels_for_node(node_id, index, config),
                "graph_support": node_graph_support(node_id, index),
            }
        )
    for component in payload["components"]:
        component_id = component["component_id"]
        targets.append(
            {
                "target_type": "component",
                "target_id": component_id,
                "component_id": component_id,
                "candidate_labels": candidate_labels_for_component(component_id, index, config),
                "graph_support": component_graph_support(component_id, index),
            }
        )
    return targets



def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_id(prefix: str, identity: Any) -> str:
    return f"{prefix}-{sha256_text(canonical_json(identity))[:16].upper()}"


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


def load_runtime_dependencies(script_dir: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    paths = [
        script_dir / "fiction-sample-nlu-contract-v1.py",
        script_dir / "fiction-sample-nlu-character-resolve-v1.py",
        script_dir / "fiction-sample-nlu-event-extract-v1.py",
        script_dir / "fiction-sample-nlu-event-relation-v1.py",
        script_dir / "fiction-sample-nlu-plot-graph-v1.py",
    ]
    for path in paths:
        require(path.is_file(), f"missing dependency: {path}")
    modules = tuple(runpy.run_path(str(path)) for path in paths)
    return modules  # type: ignore[return-value]


def validate_plot_dependency(
    plot_record: dict[str, Any],
    event_record: dict[str, Any],
    event_relation_record: dict[str, Any],
    character_record: dict[str, Any],
    *,
    db_root: Path,
    nlu0: dict[str, Any],
    nlu2: dict[str, Any],
    nlu5: dict[str, Any],
    nlu6: dict[str, Any],
    nlu7: dict[str, Any],
) -> None:
    nlu7["validate_dependencies"](
        event_record,
        event_relation_record,
        character_record,
        db_root=db_root,
        nlu0=nlu0,
        nlu2=nlu2,
        nlu5=nlu5,
        nlu6=nlu6,
    )
    database = nlu0["load_database"](db_root)
    nlu0["validate_record"](plot_record, database, allow_retrieval_admission=False)
    require(plot_record.get("analysis_kind") == "plot_structure", "dependency is not plot_structure")
    require(plot_record.get("analysis_version") == "plot_graph_v1", "unsupported plot graph version")
    plot_config_path = Path(__file__).resolve().parent.parent / "config" / "fiction-nlu-plot-graph-v1.json"
    plot_config, plot_config_sha = nlu7["load_config"](plot_config_path)
    nlu7["validate_payload"](
        plot_record.get("payload"),
        event_record,
        event_relation_record,
        plot_config,
        plot_config_sha,
    )


def build_node_evidence_index(
    plot_record: dict[str, Any],
    event_record: dict[str, Any],
    passage_map: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    mentions = {m["event_mention_id"]: m for m in event_record["payload"]["event_mentions"]}
    evidence: dict[str, dict[str, Any]] = {}
    for node in plot_record["payload"]["nodes"]:
        mention = mentions.get(node["canonical_mention_id"])
        require(mention is not None, f'{node["node_id"]}: canonical event mention missing')
        passage = passage_map.get(mention["passage_id"])
        require(passage is not None, f'{node["node_id"]}: canonical Passage missing')
        ctx = mention["context_span"]
        quote = passage["text"][ctx["start"]:ctx["end"]]
        evidence[node["node_id"]] = {
            "passage_id": mention["passage_id"],
            "span_start": ctx["start"],
            "span_end": ctx["end"],
            "quote_sha256": sha256_text(quote),
            "node_ids": [node["node_id"]],
            "_quote": quote,
            "_context_start": ctx["start"],
            "_context_end": ctx["end"],
            "_passage_text": passage["text"],
        }
    return evidence


def public_evidence(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "passage_id": item["passage_id"],
        "span_start": item["span_start"],
        "span_end": item["span_end"],
        "quote_sha256": item["quote_sha256"],
        "node_ids": list(item["node_ids"]),
    }


def normalize_provider_evidence(
    rows: list[dict[str, Any]] | None,
    node_evidence: dict[str, dict[str, Any]],
    *,
    max_items: int = 4,
) -> list[dict[str, Any]]:
    normalized = []
    seen = set()
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        node_id = row.get("node_id")
        quote = row.get("quote")
        base = node_evidence.get(node_id)
        if base is None or not isinstance(quote, str) or not quote:
            continue
        bounded = base["_passage_text"][base["_context_start"]:base["_context_end"]]
        if bounded.count(quote) != 1:
            continue
        rel = bounded.find(quote)
        start = base["_context_start"] + rel
        end = start + len(quote)
        key = (base["passage_id"], start, end, node_id)
        if key in seen:
            continue
        seen.add(key)
        normalized.append(
            {
                "passage_id": base["passage_id"],
                "span_start": start,
                "span_end": end,
                "quote_sha256": sha256_text(quote),
                "node_ids": [node_id],
            }
        )
        if len(normalized) >= max_items:
            break
    return normalized


def default_target_evidence(
    target: dict[str, Any],
    plot_record: dict[str, Any],
    node_evidence: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    if target["target_type"] == "node":
        return [public_evidence(node_evidence[target["target_id"]])]
    component = next(c for c in plot_record["payload"]["components"] if c["component_id"] == target["target_id"])
    return [public_evidence(node_evidence[node_id]) for node_id in component["node_ids"][:2]]


def build_dependency_candidates(plot_record: dict[str, Any], config: dict[str, Any]) -> list[dict[str, Any]]:
    node_by_id = {n["node_id"]: n for n in plot_record["payload"]["nodes"]}
    max_distance = int(config["dependency_policy"]["max_node_distance_within_component"])
    max_pairs = int(config["dependency_policy"]["max_pairs_per_component"])
    candidates = []
    for component in plot_record["payload"]["components"]:
        members = sorted(
            component["node_ids"],
            key=lambda nid: (node_by_id[nid]["first_novel_offset"], nid),
        )
        count = 0
        for i, source in enumerate(members):
            for j in range(i + 1, min(len(members), i + max_distance + 1)):
                target = members[j]
                candidates.append(
                    {
                        "pair_id": stable_id("NFP", {"source_node_id": source, "target_node_id": target}),
                        "component_id": component["component_id"],
                        "source_node_id": source,
                        "target_node_id": target,
                    }
                )
                count += 1
                if count >= max_pairs:
                    break
            if count >= max_pairs:
                break
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
        "options": {"temperature": float(config["provider_policy"].get("temperature", 0)), "num_predict": num_predict},
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
        raise Nlu8Error(f"ollama provider failed: {exc}") from exc
    content = ((raw.get("message") or {}).get("content") or "").strip()
    require(content, "ollama returned empty content")
    value = json.loads(content)
    require(isinstance(value, dict), "ollama response must be object")
    return value


def target_context_node_ids(
    target: dict[str, Any],
    plot_record: dict[str, Any],
    config: dict[str, Any],
) -> list[str]:
    payload = plot_record["payload"]
    index = graph_indexes(payload)
    limit = int(config["provider_policy"]["max_context_nodes_per_target"])
    if target["target_type"] == "node":
        node_id = target["target_id"]
        neighbors = {
            e["source_node_id"] for e in index["incoming"].get(node_id, [])
        } | {
            e["target_node_id"] for e in index["outgoing"].get(node_id, [])
        }
        ranked = [node_id] + sorted(neighbors)
        component = index["components"][target["component_id"]]
        for candidate in sorted(component["node_ids"]):
            if candidate not in ranked:
                ranked.append(candidate)
        return ranked[:limit]
    component = index["components"][target["target_id"]]
    degree = {
        nid: len(index["incoming"].get(nid, [])) + len(index["outgoing"].get(nid, []))
        for nid in component["node_ids"]
    }
    return sorted(component["node_ids"], key=lambda nid: (-degree[nid], nid))[:limit]


def ollama_dependency_links(
    candidates: list[dict[str, Any]],
    node_evidence: dict[str, dict[str, Any]],
    config: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> list[dict[str, Any]]:
    if not candidates:
        return []
    batch_size = int(config["provider_policy"]["dependency_batch_size"])
    allowed = config["dependency_policy"]["allowed_types"]
    threshold = float(config["dependency_policy"]["threshold"])
    admitted = []
    response_schema = {
        "type": "object",
        "properties": {
            "decisions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "pair_id": {"type": "string"},
                        "relation_type": {"type": "string", "enum": ["none"] + allowed},
                        "score": {"type": "number", "minimum": 0, "maximum": 1},
                        "evidence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {"node_id": {"type": "string"}, "quote": {"type": "string"}},
                                "required": ["node_id", "quote"],
                            },
                        },
                    },
                    "required": ["pair_id", "relation_type", "score", "evidence"],
                },
            }
        },
        "required": ["decisions"],
    }
    candidate_by_id = {c["pair_id"]: c for c in candidates}
    for start in range(0, len(candidates), batch_size):
        batch = candidates[start:start + batch_size]
        request_pairs = []
        for pair in batch:
            request_pairs.append(
                {
                    **pair,
                    "source_context": node_evidence[pair["source_node_id"]]["_quote"],
                    "target_context": node_evidence[pair["target_node_id"]]["_quote"],
                }
            )
        value = _ollama_json(
            model=model,
            url=url,
            timeout_seconds=timeout_seconds,
            config=config,
            system=(
                "Judge long-range narrative dependency candidates between already extracted plot nodes. "
                "Use none unless the two excerpts directly support setup/payoff, foreshadowing/payoff, or callback. "
                "Narrative order alone is never evidence. Copy evidence quotes exactly from the supplied contexts. JSON only."
            ),
            user=json.dumps({"pairs": request_pairs, "allowed_relations": allowed}, ensure_ascii=False),
            schema=response_schema,
            num_predict=1400,
        )
        decisions = value.get("decisions")
        require(isinstance(decisions, list), "ollama dependency response missing decisions")
        seen = set()
        for row in decisions:
            if not isinstance(row, dict):
                continue
            pair = candidate_by_id.get(row.get("pair_id"))
            if pair is None or pair["pair_id"] in seen:
                continue
            seen.add(pair["pair_id"])
            relation_type = row.get("relation_type")
            score = row.get("score")
            if relation_type == "none":
                continue
            if relation_type not in allowed:
                continue
            if not isinstance(score, (int, float)) or isinstance(score, bool) or not math.isfinite(score) or score < threshold:
                continue
            evidence = normalize_provider_evidence(row.get("evidence"), node_evidence)
            covered = {node_id for item in evidence for node_id in item["node_ids"]}
            if pair["source_node_id"] not in covered or pair["target_node_id"] not in covered:
                continue
            admitted.append(
                {
                    "link_id": stable_id(
                        "NFL",
                        {
                            "relation_type": relation_type,
                            "source_node_id": pair["source_node_id"],
                            "target_node_id": pair["target_node_id"],
                        },
                    ),
                    "relation_type": relation_type,
                    "source_node_id": pair["source_node_id"],
                    "target_node_id": pair["target_node_id"],
                    "score": round(float(score), 6),
                    "threshold": threshold,
                    "source": "model",
                    "evidence": evidence,
                }
            )
    return sorted({r["link_id"]: r for r in admitted}.values(), key=lambda r: r["link_id"])



def heuristic_target_scores(
    target: dict[str, Any],
    plot_record: dict[str, Any],
    node_evidence: dict[str, dict[str, Any]],
    config: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    support = target["graph_support"]
    evidence = default_target_evidence(target, plot_record, node_evidence)
    rows = []
    for label in target["candidate_labels"]:
        score = 0.40
        if label == "function.progression":
            score = 0.72 if support["incoming_semantic_edges"] + support["outgoing_semantic_edges"] > 0 else 0.55
        elif label == "function.exposition":
            score = 0.58 if support["incoming_semantic_edges"] == 0 else 0.42
        elif label == "function.setup":
            score = 0.64 if support["outgoing_semantic_edges"] > 0 else 0.45
        elif label == "function.resolution":
            score = 0.64 if support["incoming_semantic_edges"] > 0 and support["outgoing_semantic_edges"] == 0 else 0.45
        elif label == "function.aftermath":
            score = 0.56 if support["incoming_semantic_edges"] > 0 and support["outgoing_semantic_edges"] == 0 else 0.40
        elif label == "function.escalation":
            score = 0.60 if support["outgoing_semantic_edges"] > 0 else 0.40
        elif label == "function.transition":
            score = 0.48
        elif label == "function.complication":
            score = 0.48
        rows.append(
            {
                "target_type": target["target_type"],
                "target_id": target["target_id"],
                "label": label,
                "score": score,
                "threshold": float(config["function_taxonomy"][label]["threshold"]),
                "source": "heuristic",
                "gate_evidence": {"high_consequence": False, "downstream_consequence": False},
                "evidence": evidence,
            }
        )
    structural = (
        support["incoming_semantic_edges"]
        + support["outgoing_semantic_edges"]
        + min(4, support["downstream_reachable_count"])
    )
    salience = min(0.95, 0.30 + structural * 0.08)
    return rows, {
        "target_type": target["target_type"],
        "target_id": target["target_id"],
        "score": round(salience, 6),
        "source": "heuristic",
        "evidence": evidence,
        "graph_support": support,
    }


def ollama_target_scores(
    target: dict[str, Any],
    plot_record: dict[str, Any],
    node_evidence: dict[str, dict[str, Any]],
    dependency_links: list[dict[str, Any]],
    config: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    context_ids = target_context_node_ids(target, plot_record, config)
    contexts = [
        {
            "node_id": node_id,
            "quote": node_evidence[node_id]["_quote"],
        }
        for node_id in context_ids
    ]
    relevant_links = [
        {
            "relation_type": link["relation_type"],
            "source_node_id": link["source_node_id"],
            "target_node_id": link["target_node_id"],
            "score": link["score"],
        }
        for link in dependency_links
        if target["target_id"] in {link["source_node_id"], link["target_node_id"]}
        or (
            target["target_type"] == "component"
            and link["source_node_id"] in set(
                next(c["node_ids"] for c in plot_record["payload"]["components"] if c["component_id"] == target["target_id"])
            )
        )
    ]
    response_schema = {
        "type": "object",
        "properties": {
            "function_scores": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "enum": target["candidate_labels"]},
                        "score": {"type": "number", "minimum": 0, "maximum": 1},
                        "evidence": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {"node_id": {"type": "string"}, "quote": {"type": "string"}},
                                "required": ["node_id", "quote"],
                            },
                        },
                        "high_consequence": {"type": "boolean"},
                        "downstream_consequence": {"type": "boolean"},
                    },
                    "required": ["label", "score", "evidence", "high_consequence", "downstream_consequence"],
                },
            },
            "salience": {
                "type": "object",
                "properties": {
                    "score": {"type": "number", "minimum": 0, "maximum": 1},
                    "evidence": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"node_id": {"type": "string"}, "quote": {"type": "string"}},
                            "required": ["node_id", "quote"],
                        },
                    },
                },
                "required": ["score", "evidence"],
            },
        },
        "required": ["function_scores", "salience"],
    }
    request = {
        "target": {
            "target_type": target["target_type"],
            "target_id": target["target_id"],
            "component_id": target["component_id"],
            "candidate_labels": target["candidate_labels"],
            "graph_support": target["graph_support"],
        },
        "contexts": contexts,
        "dependency_links": relevant_links,
        "label_definitions": {
            label: config["function_taxonomy"][label]["description"]
            for label in target["candidate_labels"]
        },
        "rules": [
            "Score every candidate label exactly once, even when unlikely.",
            "Narrative position is not evidence for turning point or climax.",
            "Salience is independent from function labels.",
            "Use high_consequence only when the quoted evidence supports a consequential culmination.",
            "Use downstream_consequence only when downstream graph/context support shows a durable consequence.",
            "Copy evidence quotes exactly from contexts. Prefer low scores over unsupported claims.",
        ],
    }
    value = _ollama_json(
        model=model,
        url=url,
        timeout_seconds=timeout_seconds,
        config=config,
        system=(
            "Score narrative function candidates for one bounded fiction plot target. "
            "Do not invent labels outside the candidate set. Do not use screenplay-position priors. JSON only."
        ),
        user=json.dumps(request, ensure_ascii=False),
        schema=response_schema,
        num_predict=1800,
    )
    rows = value.get("function_scores")
    require(isinstance(rows, list), "ollama function response missing function_scores")
    by_label = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = row.get("label")
        if label in by_label or label not in target["candidate_labels"]:
            continue
        score = row.get("score")
        require(isinstance(score, (int, float)) and not isinstance(score, bool) and math.isfinite(score), f"{label}: invalid score")
        by_label[label] = {
            "target_type": target["target_type"],
            "target_id": target["target_id"],
            "label": label,
            "score": round(float(score), 6),
            "threshold": float(config["function_taxonomy"][label]["threshold"]),
            "source": "model",
            "gate_evidence": {
                "high_consequence": bool(row.get("high_consequence")),
                "downstream_consequence": bool(row.get("downstream_consequence")),
            },
            "evidence": normalize_provider_evidence(row.get("evidence"), node_evidence),
        }
    require(set(by_label) == set(target["candidate_labels"]), f'{target["target_id"]}: provider omitted candidate scores')
    salience_raw = value.get("salience")
    require(isinstance(salience_raw, dict), "ollama response missing salience")
    salience_score = salience_raw.get("score")
    require(isinstance(salience_score, (int, float)) and not isinstance(salience_score, bool) and math.isfinite(salience_score), "invalid salience score")
    salience_evidence = normalize_provider_evidence(salience_raw.get("evidence"), node_evidence)
    require(salience_evidence, f'{target["target_id"]}: salience requires evidence')
    return [by_label[label] for label in target["candidate_labels"]], {
        "target_type": target["target_type"],
        "target_id": target["target_id"],
        "score": round(float(salience_score), 6),
        "source": "model",
        "evidence": salience_evidence,
        "graph_support": target["graph_support"],
    }


def gate_predicate(
    row: dict[str, Any],
    target: dict[str, Any],
    dependency_links: list[dict[str, Any]],
) -> bool:
    label = row["label"]
    if label == "function.turning_point":
        return (
            target["target_type"] == "node"
            and target["graph_support"]["downstream_reachable_count"] > 0
            and row["gate_evidence"]["downstream_consequence"] is True
        )
    if label == "function.climax":
        return target["target_type"] == "node" and row["gate_evidence"]["high_consequence"] is True
    if label == "function.foreshadowing":
        return (
            target["target_type"] == "node"
            and any(
                link["relation_type"] == "narrative.foreshadowing_payoff"
                and link["source_node_id"] == target["target_id"]
                for link in dependency_links
            )
        )
    if label == "function.payoff":
        return (
            target["target_type"] == "node"
            and any(
                link["relation_type"] in {"narrative.setup_payoff", "narrative.foreshadowing_payoff"}
                and link["target_node_id"] == target["target_id"]
                for link in dependency_links
            )
        )
    return True


def apply_function_gates(
    rows: list[dict[str, Any]],
    targets: list[dict[str, Any]],
    dependency_links: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    target_map = {(t["target_type"], t["target_id"]): t for t in targets}
    high_risk = {
        "function.turning_point",
        "function.climax",
        "function.foreshadowing",
        "function.payoff",
    }
    for row in rows:
        target = target_map[(row["target_type"], row["target_id"])]
        predicate = gate_predicate(row, target, dependency_links)
        above = row["score"] >= row["threshold"] and bool(row["evidence"])
        row["active"] = bool(above and predicate)
        row["gate_status"] = (
            "not_applicable"
            if row["label"] not in high_risk
            else ("passed" if predicate else "failed")
        )

    climax_by_component: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["label"] == "function.climax" and row["active"]:
            target = target_map[(row["target_type"], row["target_id"])]
            climax_by_component[target["component_id"]].append(row)
    for candidates in climax_by_component.values():
        candidates.sort(key=lambda r: (-r["score"], r["target_id"]))
        for row in candidates[1:]:
            row["active"] = False
            row["gate_status"] = "failed"
    return rows


def validate_evidence(
    items: list[dict[str, Any]],
    *,
    allowed_node_ids: set[str],
    passage_map: dict[str, dict[str, Any]],
) -> None:
    for item in items:
        passage = passage_map.get(item["passage_id"])
        require(passage is not None, "narrative evidence Passage missing")
        start, end = item["span_start"], item["span_end"]
        require(0 <= start < end <= len(passage["text"]), "bad narrative evidence span")
        require(item["quote_sha256"] == sha256_text(passage["text"][start:end]), "narrative evidence hash mismatch")
        require(set(item["node_ids"]) <= allowed_node_ids, "narrative evidence references disallowed node")


def build_payload(
    plot_record: dict[str, Any],
    event_record: dict[str, Any],
    passage_map: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
    *,
    provider: str,
    model: str | None,
    ollama_url: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    targets = build_targets(plot_record, config)
    node_evidence = build_node_evidence_index(plot_record, event_record, passage_map)
    dependency_candidates = build_dependency_candidates(plot_record, config)
    if provider == "ollama":
        require(model, "--model is required for ollama provider")
        dependency_links = ollama_dependency_links(
            dependency_candidates,
            node_evidence,
            config,
            model=model,
            url=ollama_url,
            timeout_seconds=timeout_seconds,
        )
    elif provider == "heuristic":
        dependency_links = []
    else:
        raise Nlu8Error(f"unsupported provider: {provider}")

    function_scores = []
    salience_scores = []
    for target in targets:
        if provider == "ollama":
            rows, salience = ollama_target_scores(
                target,
                plot_record,
                node_evidence,
                dependency_links,
                config,
                model=model or "",
                url=ollama_url,
                timeout_seconds=timeout_seconds,
            )
        else:
            rows, salience = heuristic_target_scores(target, plot_record, node_evidence, config)
        function_scores.extend(rows)
        salience_scores.append(salience)

    function_scores = apply_function_gates(function_scores, targets, dependency_links)
    public_targets = [
        {
            "target_type": target["target_type"],
            "target_id": target["target_id"],
            "component_id": target["component_id"],
            "candidate_labels": target["candidate_labels"],
        }
        for target in targets
    ]
    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha,
        "assertion_scope": config["assertion_scope"],
        "provider": {"name": provider, "model": model, "request_version": REQUEST_VERSION},
        "scope": {
            "novel_id": plot_record["subject"]["id"],
            "plot_graph_analysis_id": plot_record["analysis_id"],
            "complete_narrative_function_claim": False,
            "complete_salience_ranking_claim": False,
            "screenplay_structure_assumed": False,
        },
        "plot_graph_registry_sha256": plot_graph_registry_sha256(plot_record),
        "targets": public_targets,
        "function_scores": sorted(function_scores, key=lambda r: (r["target_type"], r["target_id"], r["label"])),
        "salience_scores": sorted(salience_scores, key=lambda r: (r["target_type"], r["target_id"])),
        "dependency_links": dependency_links,
        "consistency": {"valid": True, "errors": [], "warnings": []},
    }


def validate_payload(
    payload: dict[str, Any],
    plot_record: dict[str, Any],
    event_record: dict[str, Any],
    passage_map: dict[str, dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
) -> None:
    require(payload.get("schema_version") == PAYLOAD_VERSION, "payload schema_version mismatch")
    require(payload.get("config_version") == CONFIG_VERSION, "payload config_version mismatch")
    require(payload.get("config_sha256") == config_sha, "payload config_sha256 mismatch")
    require(payload.get("assertion_scope") == config["assertion_scope"], "payload assertion_scope mismatch")
    scope = payload.get("scope") or {}
    require(scope.get("novel_id") == plot_record["subject"]["id"], "narrative-function novel mismatch")
    require(scope.get("plot_graph_analysis_id") == plot_record["analysis_id"], "plot graph lineage mismatch")
    require(scope.get("complete_narrative_function_claim") is False, "NLU-8 may not claim complete narrative function")
    require(scope.get("complete_salience_ranking_claim") is False, "NLU-8 may not claim complete salience ranking")
    require(scope.get("screenplay_structure_assumed") is False, "NLU-8 may not assume screenplay structure")
    require(payload.get("plot_graph_registry_sha256") == plot_graph_registry_sha256(plot_record), "plot graph registry hash mismatch")

    deterministic_targets = build_targets(plot_record, config)
    expected_targets = [
        {
            "target_type": t["target_type"],
            "target_id": t["target_id"],
            "component_id": t["component_id"],
            "candidate_labels": t["candidate_labels"],
        }
        for t in deterministic_targets
    ]
    require(canonical_json(payload.get("targets")) == canonical_json(expected_targets), "narrative targets are not deterministic")
    target_map = {(t["target_type"], t["target_id"]): t for t in deterministic_targets}
    node_ids = {n["node_id"] for n in plot_record["payload"]["nodes"]}
    component_nodes = {c["component_id"]: set(c["node_ids"]) for c in plot_record["payload"]["components"]}

    links = payload.get("dependency_links") or []
    seen_links = set()
    for link in links:
        require(link["link_id"] not in seen_links, "duplicate narrative dependency link")
        seen_links.add(link["link_id"])
        require(link["relation_type"] in config["dependency_policy"]["allowed_types"], "invalid narrative dependency type")
        require(link["source_node_id"] in node_ids and link["target_node_id"] in node_ids, "dependency link references unknown node")
        require(link["source_node_id"] != link["target_node_id"], "dependency link must use distinct nodes")
        expected_id = stable_id(
            "NFL",
            {
                "relation_type": link["relation_type"],
                "source_node_id": link["source_node_id"],
                "target_node_id": link["target_node_id"],
            },
        )
        require(link["link_id"] == expected_id, "non-deterministic dependency link id")
        require(0 <= link["score"] <= 1, "dependency link score out of range")
        require(link["score"] >= float(config["dependency_policy"]["threshold"]), "dependency link below threshold")
        covered = {nid for item in link["evidence"] for nid in item["node_ids"]}
        require(link["source_node_id"] in covered and link["target_node_id"] in covered, "dependency evidence must cover both ends")
        validate_evidence(link["evidence"], allowed_node_ids={link["source_node_id"], link["target_node_id"]}, passage_map=passage_map)

    scores = payload.get("function_scores") or []
    score_map = {(r["target_type"], r["target_id"], r["label"]): r for r in scores}
    expected_keys = {
        (t["target_type"], t["target_id"], label)
        for t in deterministic_targets
        for label in t["candidate_labels"]
    }
    require(set(score_map) == expected_keys and len(score_map) == len(scores), "function candidate scores must be complete and unique")

    climax_winners: set[tuple[str, str, str]] = set()
    climax_candidates: dict[str, list[tuple[float, str, tuple[str, str, str]]]] = defaultdict(list)
    for key, row in score_map.items():
        if row["label"] != "function.climax":
            continue
        target = target_map[(row["target_type"], row["target_id"])]
        threshold = float(config["function_taxonomy"][row["label"]]["threshold"])
        if row["score"] >= threshold and bool(row["evidence"]) and gate_predicate(row, target, links):
            climax_candidates[target["component_id"]].append((-row["score"], row["target_id"], key))
    for rows in climax_candidates.values():
        rows.sort()
        climax_winners.add(rows[0][2])

    for key, row in score_map.items():
        target = target_map[(row["target_type"], row["target_id"])]
        threshold = float(config["function_taxonomy"][row["label"]]["threshold"])
        require(0 <= row["score"] <= 1, f'{row["label"]}: score out of range')
        require(row["threshold"] == threshold, f'{row["label"]}: threshold mismatch')
        allowed_nodes = (
            {row["target_id"]}
            if row["target_type"] == "node"
            else component_nodes[row["target_id"]]
        )
        validate_evidence(row["evidence"], allowed_node_ids=allowed_nodes, passage_map=passage_map)
        predicate = gate_predicate(row, target, links)
        if row["label"] == "function.climax" and predicate:
            predicate = key in climax_winners
        above = row["score"] >= threshold and bool(row["evidence"])
        high_risk = row["label"] in {
            "function.turning_point", "function.climax", "function.foreshadowing", "function.payoff"
        }
        expected_gate = "not_applicable" if not high_risk else ("passed" if predicate else "failed")
        require(row["gate_status"] == expected_gate, f'{row["label"]}: gate_status mismatch')
        require(row["active"] == bool(above and predicate), f'{row["label"]}: active state violates threshold/gate')

    active_climax: dict[str, int] = defaultdict(int)
    for row in scores:
        if row["label"] == "function.climax" and row["active"]:
            component_id = target_map[(row["target_type"], row["target_id"])]["component_id"]
            active_climax[component_id] += 1
    require(all(count <= 1 for count in active_climax.values()), "multiple active climax labels in one component")

    salience_rows = payload.get("salience_scores") or []
    salience_map = {(r["target_type"], r["target_id"]): r for r in salience_rows}
    require(set(salience_map) == set(target_map) and len(salience_map) == len(salience_rows), "salience scores must cover each target exactly once")
    for key, row in salience_map.items():
        target = target_map[key]
        require(0 <= row["score"] <= 1, "salience score out of range")
        require(row["evidence"], "salience evidence required")
        allowed_nodes = {row["target_id"]} if row["target_type"] == "node" else component_nodes[row["target_id"]]
        validate_evidence(row["evidence"], allowed_node_ids=allowed_nodes, passage_map=passage_map)
        require(row["graph_support"] == target["graph_support"], "salience graph_support mismatch")
    consistency = payload.get("consistency") or {}
    require(consistency.get("valid") is True, f"narrative function consistency failed: {consistency.get('errors')}")


def build_record(
    plot_record: dict[str, Any],
    payload: dict[str, Any],
    *,
    provider: str,
    model: str | None,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    evidence = list(plot_record.get("evidence") or [])
    require(evidence, "plot graph dependency must retain canonical analysis evidence")
    active_scores = [r["score"] for r in payload["function_scores"] if r["active"]]
    salience_scores = [r["score"] for r in payload["salience_scores"]]
    combined = active_scores + salience_scores
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "narrative_function",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": plot_record["subject"],
        "method": {
            "type": "hybrid",
            "name": "fiction-sample-nlu-narrative-function-v1",
            "version": "1",
            "model_id": model,
        },
        "confidence": round(sum(combined) / len(combined), 6) if combined else None,
        "evidence": evidence,
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": f"fiction-sample-nlu-narrative-function-v1:{provider}",
            "input_sha256": sha256_text(
                canonical_json(
                    {
                        "plot_graph_analysis_id": plot_record["analysis_id"],
                        "plot_graph_registry_sha256": payload["plot_graph_registry_sha256"],
                    }
                )
            ),
            "code_sha256": sha256_bytes(Path(__file__).read_bytes()),
            "model_sha256": None,
            "notes": "NLU-8 provisional narrative functions and salience; no screenplay-position priors.",
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
        return {"schema_version": "fiction_nlu_narrative_function_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_narrative_function_checkpoint_v1", "checkpoint schema mismatch")
    return value


def command_analyze(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    nlu0, nlu2, nlu5, nlu6, nlu7 = load_runtime_dependencies(Path(__file__).resolve().parent)
    characters = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.character_resolution))}
    events = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_analysis))}
    relations = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_relation))}
    plots = load_jsonl(Path(args.plot_graph))
    if args.novel_id:
        wanted = set(args.novel_id)
        plots = [r for r in plots if (r.get("subject") or {}).get("id") in wanted]
    if args.limit_novels is not None:
        plots = plots[:args.limit_novels]
    passage_rows, _scenes, _novels = nlu6["load_database"](db_root)
    passage_map = {p["passage_id"]: p for p in passage_rows}
    database = nlu0["load_database"](db_root)
    output = Path(args.output)
    existing = set()
    if output.exists():
        existing = {
            (r.get("subject") or {}).get("id")
            for r in load_jsonl(output)
            if r.get("analysis_kind") == "narrative_function" and r.get("analysis_version") == ANALYSIS_VERSION
        }
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = load_checkpoint(checkpoint_path)
    summary = {"selected": len(plots), "written": 0, "skipped": 0, "targets": 0, "active_functions": 0, "dependency_links": 0, "errors": 0}
    for plot_record in plots:
        novel_id = (plot_record.get("subject") or {}).get("id")
        if novel_id in existing or novel_id in checkpoint["completed"]:
            summary["skipped"] += 1
            continue
        try:
            character_record = characters.get(novel_id)
            event_record = events.get(novel_id)
            relation_record = relations.get(novel_id)
            require(character_record is not None and event_record is not None and relation_record is not None, f"missing dependency for {novel_id}")
            validate_plot_dependency(
                plot_record, event_record, relation_record, character_record,
                db_root=db_root, nlu0=nlu0, nlu2=nlu2, nlu5=nlu5, nlu6=nlu6, nlu7=nlu7,
            )
            payload = build_payload(
                plot_record, event_record, passage_map, config, config_sha,
                provider=args.provider, model=args.model, ollama_url=args.ollama_url, timeout_seconds=args.timeout_seconds,
            )
            validate_payload(payload, plot_record, event_record, passage_map, config, config_sha)
            record = build_record(plot_record, payload, provider=args.provider, model=args.model, nlu0=nlu0)
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            append_jsonl(output, record)
            checkpoint["completed"][novel_id] = {
                "analysis_id": record["analysis_id"],
                "plot_graph_analysis_id": plot_record["analysis_id"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            checkpoint["errors"].pop(novel_id, None)
            summary["written"] += 1
            summary["targets"] += len(payload["targets"])
            summary["active_functions"] += sum(1 for row in payload["function_scores"] if row["active"])
            summary["dependency_links"] += len(payload["dependency_links"])
        except Exception as exc:
            checkpoint["errors"][novel_id or "<unknown>"] = str(exc)
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
    nlu0, nlu2, nlu5, nlu6, nlu7 = load_runtime_dependencies(Path(__file__).resolve().parent)
    characters = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.character_resolution))}
    events = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_analysis))}
    relations = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_relation))}
    plots = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.plot_graph))}
    passage_rows, _scenes, _novels = nlu6["load_database"](db_root)
    passage_map = {p["passage_id"]: p for p in passage_rows}
    database = nlu0["load_database"](db_root)
    rows = load_jsonl(Path(args.input))
    errors = []
    valid = 0
    for line_number, record in enumerate(rows, 1):
        try:
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            require(record.get("analysis_kind") == "narrative_function", "record is not narrative_function")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            novel_id = (record.get("subject") or {}).get("id")
            plot_record = plots.get(novel_id)
            event_record = events.get(novel_id)
            relation_record = relations.get(novel_id)
            character_record = characters.get(novel_id)
            require(plot_record is not None and event_record is not None and relation_record is not None and character_record is not None, f"missing dependency for {novel_id}")
            validate_plot_dependency(
                plot_record, event_record, relation_record, character_record,
                db_root=db_root, nlu0=nlu0, nlu2=nlu2, nlu5=nlu5, nlu6=nlu6, nlu7=nlu7,
            )
            validate_payload(record.get("payload"), plot_record, event_record, passage_map, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_narrative_function_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_candidates(args: argparse.Namespace) -> int:
    config, config_sha = load_config(Path(args.config))
    rows = load_jsonl(Path(args.plot_graph))
    if args.novel_id:
        wanted = set(args.novel_id)
        rows = [r for r in rows if (r.get("subject") or {}).get("id") in wanted]
    if args.limit_novels is not None:
        rows = rows[: args.limit_novels]
    output = []
    for record in rows:
        validate_plot_record_minimal(record)
        output.append(
            {
                "novel_id": record["subject"]["id"],
                "plot_graph_analysis_id": record["analysis_id"],
                "plot_graph_registry_sha256": plot_graph_registry_sha256(record),
                "config_version": CONFIG_VERSION,
                "config_sha256": config_sha,
                "request_version": REQUEST_VERSION,
                "targets": build_targets(record, config),
            }
        )
    print(json.dumps({"selected": len(rows), "records": output}, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-8 narrative-function and salience analysis.")
    sub = parser.add_subparsers(dest="command", required=True)

    candidates = sub.add_parser("candidates")
    candidates.add_argument("--config", required=True)
    candidates.add_argument("--plot-graph", required=True)
    candidates.add_argument("--novel-id", action="append")
    candidates.add_argument("--limit-novels", type=int)
    candidates.set_defaults(func=command_candidates)

    analyze = sub.add_parser("analyze")
    for name in ["db-root", "config", "character-resolution", "event-analysis", "event-relation", "plot-graph", "output"]:
        analyze.add_argument("--" + name, required=True)
    analyze.add_argument("--checkpoint")
    analyze.add_argument("--provider", choices=["heuristic", "ollama"], default="heuristic")
    analyze.add_argument("--model")
    analyze.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    analyze.add_argument("--timeout-seconds", type=int, default=120)
    analyze.add_argument("--novel-id", action="append")
    analyze.add_argument("--limit-novels", type=int)
    analyze.add_argument("--continue-on-error", action="store_true")
    analyze.set_defaults(func=command_analyze)

    validate = sub.add_parser("validate")
    for name in ["db-root", "config", "character-resolution", "event-analysis", "event-relation", "plot-graph", "input"]:
        validate.add_argument("--" + name, required=True)
    validate.set_defaults(func=command_validate)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except (Nlu8Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
