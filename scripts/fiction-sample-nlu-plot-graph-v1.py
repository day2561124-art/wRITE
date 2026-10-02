from __future__ import annotations

import argparse
import hashlib
import json
import os
import runpy
import sys
import tempfile
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_plot_graph_v1"
PAYLOAD_VERSION = "fiction_nlu_plot_graph_v1"
ANALYSIS_VERSION = "plot_graph_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu7Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu7Error(message)


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
                raise Nlu7Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            require(isinstance(value, dict), f"{path}:{line_number}: record must be object")
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


def load_dependencies(script_dir: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    paths = [
        script_dir / "fiction-sample-nlu-contract-v1.py",
        script_dir / "fiction-sample-nlu-character-resolve-v1.py",
        script_dir / "fiction-sample-nlu-event-extract-v1.py",
        script_dir / "fiction-sample-nlu-event-relation-v1.py",
    ]
    for path in paths:
        require(path.is_file(), f"missing dependency: {path}")
    modules = tuple(runpy.run_path(str(path)) for path in paths)
    return modules  # type: ignore[return-value]


def event_registry_sha256(event_record: dict[str, Any]) -> str:
    payload = event_record["payload"]
    return sha256_text(
        canonical_json(
            {
                "scope": payload["scope"],
                "entity_registry_sha256": payload["entity_registry_sha256"],
                "event_mentions": payload["event_mentions"],
                "event_clusters": payload["event_clusters"],
                "coreference_links": payload["coreference_links"],
            }
        )
    )


def event_relation_registry_sha256(event_relation_record: dict[str, Any]) -> str:
    payload = event_relation_record["payload"]
    return sha256_text(
        canonical_json(
            {
                "scope": payload["scope"],
                "event_registry_sha256": payload["event_registry_sha256"],
                "pair_candidates": payload["pair_candidates"],
                "temporal_relations": payload["temporal_relations"],
                "causal_relations": payload["causal_relations"],
            }
        )
    )


def validate_dependencies(
    event_record: dict[str, Any],
    event_relation_record: dict[str, Any],
    character_record: dict[str, Any],
    *,
    db_root: Path,
    nlu0: dict[str, Any],
    nlu2: dict[str, Any],
    nlu5: dict[str, Any],
    nlu6: dict[str, Any],
) -> None:
    nlu6["validate_event_dependency"](
        event_record,
        character_record,
        db_root=db_root,
        nlu0=nlu0,
        nlu2=nlu2,
        nlu5=nlu5,
    )
    database = nlu0["load_database"](db_root)
    nlu0["validate_record"](event_relation_record, database, allow_retrieval_admission=False)
    require(event_relation_record.get("analysis_kind") == "event_relation", "dependency is not event_relation")
    require(event_relation_record.get("analysis_version") == "event_relation_v1", "unsupported event_relation version")
    require(
        (event_relation_record.get("subject") or {}).get("id") == (event_record.get("subject") or {}).get("id"),
        "event/event_relation novel mismatch",
    )
    relation_config_path = Path(__file__).resolve().parent.parent / "config" / "fiction-nlu-event-relation-v1.json"
    relation_config, relation_config_sha = nlu6["load_config"](relation_config_path)
    passage_rows, _scenes, _novels = nlu6["load_database"](db_root)
    passage_map = {row["passage_id"]: row for row in passage_rows}
    nlu6["validate_payload"](
        event_relation_record.get("payload"),
        event_record,
        passage_map,
        relation_config,
        relation_config_sha,
    )


def node_id_for(event_id: str) -> str:
    return stable_id("PLN", {"event_id": event_id})


def edge_id_for(source_relation_id: str) -> str:
    return stable_id("PLE", {"source_relation_id": source_relation_id})


def build_nodes(event_record: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = []
    for cluster in event_record["payload"]["event_clusters"]:
        nodes.append(
            {
                "node_id": node_id_for(cluster["event_id"]),
                "event_id": cluster["event_id"],
                "event_type": cluster["event_type"],
                "canonical_mention_id": cluster["canonical_mention_id"],
                "participant_entity_ids": sorted(cluster["participant_entity_ids"]),
                "first_novel_offset": cluster["first_novel_offset"],
                "last_novel_offset": cluster["last_novel_offset"],
                "confidence": cluster["confidence"],
            }
        )
    return sorted(nodes, key=lambda n: (n["first_novel_offset"], n["event_id"]))


def build_edges(event_relation_record: dict[str, Any], event_to_node: dict[str, str]) -> list[dict[str, Any]]:
    rows = (
        list(event_relation_record["payload"]["temporal_relations"])
        + list(event_relation_record["payload"]["causal_relations"])
    )
    edges = []
    for row in rows:
        source_node = event_to_node.get(row["source_event_id"])
        target_node = event_to_node.get(row["target_event_id"])
        require(source_node is not None and target_node is not None, f'{row["relation_id"]}: relation references unknown event')
        passage_ids = sorted({e["passage_id"] for e in row["evidence"]})
        edges.append(
            {
                "edge_id": edge_id_for(row["relation_id"]),
                "source_relation_id": row["relation_id"],
                "relation_type": row["relation_type"],
                "source_node_id": source_node,
                "target_node_id": target_node,
                "score": row["score"],
                "evidence_passage_ids": passage_ids,
            }
        )
    return sorted(edges, key=lambda e: (e["relation_type"], e["source_node_id"], e["target_node_id"], e["edge_id"]))


def build_components(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node_by_id = {n["node_id"]: n for n in nodes}
    adjacency: dict[str, set[str]] = {node_id: set() for node_id in node_by_id}
    edges_by_node: dict[str, set[str]] = {node_id: set() for node_id in node_by_id}
    for edge in edges:
        a, b = edge["source_node_id"], edge["target_node_id"]
        adjacency[a].add(b)
        adjacency[b].add(a)
        edges_by_node[a].add(edge["edge_id"])
        edges_by_node[b].add(edge["edge_id"])

    visited: set[str] = set()
    components = []
    for start in sorted(node_by_id, key=lambda nid: (node_by_id[nid]["first_novel_offset"], nid)):
        if start in visited:
            continue
        queue = [start]
        visited.add(start)
        member_ids = []
        edge_ids: set[str] = set()
        while queue:
            current = queue.pop()
            member_ids.append(current)
            edge_ids.update(edges_by_node[current])
            for nxt in sorted(adjacency[current]):
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)
        member_ids.sort(key=lambda nid: (node_by_id[nid]["first_novel_offset"], nid))
        participants = sorted(
            {
                entity_id
                for nid in member_ids
                for entity_id in node_by_id[nid]["participant_entity_ids"]
            }
        )
        component_id = stable_id("PLC", {"node_ids": sorted(member_ids)})
        components.append(
            {
                "component_id": component_id,
                "node_ids": member_ids,
                "edge_ids": sorted(edge_ids),
                "participant_entity_ids": participants,
                "first_novel_offset": min(node_by_id[nid]["first_novel_offset"] for nid in member_ids),
                "last_novel_offset": max(node_by_id[nid]["last_novel_offset"] for nid in member_ids),
            }
        )
    return sorted(components, key=lambda c: (c["first_novel_offset"], c["component_id"]))


def build_temporal_layers(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node_ids = [n["node_id"] for n in nodes]
    successors: dict[str, set[str]] = {nid: set() for nid in node_ids}
    predecessors: dict[str, set[str]] = {nid: set() for nid in node_ids}
    for edge in edges:
        if edge["relation_type"] != "temporal.before":
            continue
        a, b = edge["source_node_id"], edge["target_node_id"]
        successors[a].add(b)
        predecessors[b].add(a)

    indegree = {nid: len(predecessors[nid]) for nid in node_ids}
    queue = deque(sorted(nid for nid, degree in indegree.items() if degree == 0))
    layer = {nid: 0 for nid in queue}
    seen = 0
    while queue:
        current = queue.popleft()
        seen += 1
        for nxt in sorted(successors[current]):
            layer[nxt] = max(layer.get(nxt, 0), layer[current] + 1)
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    require(seen == len(node_ids), "temporal.before graph contains a cycle")

    grouped: dict[int, list[str]] = defaultdict(list)
    for nid in node_ids:
        grouped[layer.get(nid, 0)].append(nid)
    return [
        {"layer_index": index, "node_ids": sorted(grouped[index])}
        for index in sorted(grouped)
    ]


def build_payload(
    event_record: dict[str, Any],
    event_relation_record: dict[str, Any],
    config: dict[str, Any],
    config_sha: str,
) -> dict[str, Any]:
    nodes = build_nodes(event_record)
    event_to_node = {node["event_id"]: node["node_id"] for node in nodes}
    edges = build_edges(event_relation_record, event_to_node)
    components = build_components(nodes, edges)
    temporal_layers = build_temporal_layers(nodes, edges)

    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha,
        "assertion_scope": config["assertion_scope"],
        "scope": {
            "novel_id": event_record["subject"]["id"],
            "event_analysis_id": event_record["analysis_id"],
            "event_relation_analysis_id": event_relation_record["analysis_id"],
            "complete_plot_graph_claim": False,
            "narrative_function_resolved": False,
            "salience_resolved": False,
        },
        "event_registry_sha256": event_registry_sha256(event_record),
        "event_relation_registry_sha256": event_relation_registry_sha256(event_relation_record),
        "nodes": nodes,
        "edges": edges,
        "components": components,
        "temporal_layers": temporal_layers,
        "graph_stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "component_count": len(components),
            "singleton_component_count": sum(1 for c in components if len(c["node_ids"]) == 1),
            "temporal_layer_count": len(temporal_layers),
        },
        "consistency": {"valid": True, "errors": [], "warnings": []},
    }


def validate_payload(
    payload: dict[str, Any],
    event_record: dict[str, Any],
    event_relation_record: dict[str, Any],
    config: dict[str, Any],
    config_sha: str,
) -> None:
    require(payload.get("schema_version") == PAYLOAD_VERSION, "payload schema_version mismatch")
    require(payload.get("config_version") == CONFIG_VERSION, "payload config_version mismatch")
    require(payload.get("config_sha256") == config_sha, "payload config_sha256 mismatch")
    require(payload.get("assertion_scope") == config["assertion_scope"], "payload assertion_scope mismatch")
    scope = payload.get("scope") or {}
    require(scope.get("novel_id") == event_record["subject"]["id"], "plot graph novel lineage mismatch")
    require(scope.get("event_analysis_id") == event_record["analysis_id"], "event analysis lineage mismatch")
    require(scope.get("event_relation_analysis_id") == event_relation_record["analysis_id"], "event relation lineage mismatch")
    require(scope.get("complete_plot_graph_claim") is False, "NLU-7 may not claim complete plot graph")
    require(scope.get("narrative_function_resolved") is False, "NLU-7 may not resolve narrative function")
    require(scope.get("salience_resolved") is False, "NLU-7 may not resolve salience")
    require(payload.get("event_registry_sha256") == event_registry_sha256(event_record), "event registry hash mismatch")
    require(
        payload.get("event_relation_registry_sha256") == event_relation_registry_sha256(event_relation_record),
        "event relation registry hash mismatch",
    )
    expected = build_payload(event_record, event_relation_record, config, config_sha)
    require(canonical_json(payload) == canonical_json(expected), "plot graph is not deterministic projection of dependencies")
    consistency = payload.get("consistency") or {}
    require(consistency.get("valid") is True, f"plot graph consistency failed: {consistency.get('errors')}")


def build_record(
    event_record: dict[str, Any],
    event_relation_record: dict[str, Any],
    payload: dict[str, Any],
    *,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    evidence = list(event_relation_record.get("evidence") or event_record.get("evidence") or [])
    require(evidence, "plot graph dependencies must retain canonical analysis evidence")
    scores = [edge["score"] for edge in payload["edges"]]
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "plot_structure",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": event_record["subject"],
        "method": {
            "type": "deterministic",
            "name": "fiction-sample-nlu-plot-graph-v1",
            "version": "1",
            "model_id": None,
        },
        "confidence": round(sum(scores) / len(scores), 6) if scores else event_record.get("confidence"),
        "evidence": evidence,
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": "fiction-sample-nlu-plot-graph-v1:deterministic",
            "input_sha256": sha256_text(
                canonical_json(
                    {
                        "event_analysis_id": event_record["analysis_id"],
                        "event_relation_analysis_id": event_relation_record["analysis_id"],
                        "event_registry_sha256": payload["event_registry_sha256"],
                        "event_relation_registry_sha256": payload["event_relation_registry_sha256"],
                    }
                )
            ),
            "code_sha256": sha256_bytes(Path(__file__).read_bytes()),
            "model_sha256": None,
            "notes": "NLU-7 deterministic plot graph assembly; narrative function and salience unresolved.",
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
        return {"schema_version": "fiction_nlu_plot_graph_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_plot_graph_checkpoint_v1", "checkpoint schema mismatch")
    return value


def command_compile(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    nlu0, nlu2, nlu5, nlu6 = load_dependencies(Path(__file__).resolve().parent)
    chars = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.character_resolution))}
    events = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_analysis))}
    relations = load_jsonl(Path(args.event_relation))
    if args.novel_id:
        wanted = set(args.novel_id)
        relations = [r for r in relations if (r.get("subject") or {}).get("id") in wanted]
    if args.limit_novels is not None:
        relations = relations[: args.limit_novels]

    output = Path(args.output)
    existing = set()
    if output.exists():
        existing = {
            (r.get("subject") or {}).get("id")
            for r in load_jsonl(output)
            if r.get("analysis_kind") == "plot_structure" and r.get("analysis_version") == ANALYSIS_VERSION
        }
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = load_checkpoint(checkpoint_path)
    database = nlu0["load_database"](db_root)
    summary = {"selected": len(relations), "written": 0, "skipped": 0, "nodes": 0, "edges": 0, "components": 0, "errors": 0}

    for relation_record in relations:
        novel_id = (relation_record.get("subject") or {}).get("id")
        if novel_id in existing or novel_id in checkpoint["completed"]:
            summary["skipped"] += 1
            continue
        try:
            event_record = events.get(novel_id)
            char_record = chars.get(novel_id)
            require(event_record is not None and char_record is not None, f"missing NLU-5/NLU-2 dependency for {novel_id}")
            validate_dependencies(
                event_record,
                relation_record,
                char_record,
                db_root=db_root,
                nlu0=nlu0,
                nlu2=nlu2,
                nlu5=nlu5,
                nlu6=nlu6,
            )
            payload = build_payload(event_record, relation_record, config, config_sha)
            validate_payload(payload, event_record, relation_record, config, config_sha)
            record = build_record(event_record, relation_record, payload, nlu0=nlu0)
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            append_jsonl(output, record)
            checkpoint["completed"][novel_id] = {
                "analysis_id": record["analysis_id"],
                "event_analysis_id": event_record["analysis_id"],
                "event_relation_analysis_id": relation_record["analysis_id"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            checkpoint["errors"].pop(novel_id, None)
            summary["written"] += 1
            summary["nodes"] += len(payload["nodes"])
            summary["edges"] += len(payload["edges"])
            summary["components"] += len(payload["components"])
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
    nlu0, nlu2, nlu5, nlu6 = load_dependencies(Path(__file__).resolve().parent)
    chars = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.character_resolution))}
    events = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_analysis))}
    relations = {(r.get("subject") or {}).get("id"): r for r in load_jsonl(Path(args.event_relation))}
    database = nlu0["load_database"](db_root)
    rows = load_jsonl(Path(args.input))
    errors = []
    valid = 0
    for line_number, record in enumerate(rows, 1):
        try:
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            require(record.get("analysis_kind") == "plot_structure", "record is not plot_structure")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            novel_id = (record.get("subject") or {}).get("id")
            event_record = events.get(novel_id)
            relation_record = relations.get(novel_id)
            char_record = chars.get(novel_id)
            require(event_record is not None and relation_record is not None and char_record is not None, f"missing dependency for {novel_id}")
            validate_dependencies(
                event_record,
                relation_record,
                char_record,
                db_root=db_root,
                nlu0=nlu0,
                nlu2=nlu2,
                nlu5=nlu5,
                nlu6=nlu6,
            )
            validate_payload(record.get("payload"), event_record, relation_record, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_plot_graph_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-7 deterministic plot graph assembler.")
    sub = parser.add_subparsers(dest="command", required=True)

    compile_parser = sub.add_parser("compile")
    for name in ["db-root", "config", "character-resolution", "event-analysis", "event-relation", "output"]:
        compile_parser.add_argument("--" + name, required=True)
    compile_parser.add_argument("--checkpoint")
    compile_parser.add_argument("--novel-id", action="append")
    compile_parser.add_argument("--limit-novels", type=int)
    compile_parser.add_argument("--continue-on-error", action="store_true")
    compile_parser.set_defaults(func=command_compile)

    validate_parser = sub.add_parser("validate")
    for name in ["db-root", "config", "character-resolution", "event-analysis", "event-relation", "input"]:
        validate_parser.add_argument("--" + name, required=True)
    validate_parser.set_defaults(func=command_validate)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except (Nlu7Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
