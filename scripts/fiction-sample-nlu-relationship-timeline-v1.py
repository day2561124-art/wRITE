from __future__ import annotations

import argparse
import hashlib
import json
import os
import runpy
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_character_relationship_timeline_v1"
PAYLOAD_VERSION = "fiction_nlu_character_relationship_timeline_v1"
ANALYSIS_VERSION = "character_relationship_timeline_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu4Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu4Error(message)


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
                raise Nlu4Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
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


def load_dependencies(script_dir: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    nlu0_path = script_dir / "fiction-sample-nlu-contract-v1.py"
    nlu2_path = script_dir / "fiction-sample-nlu-character-resolve-v1.py"
    nlu3_path = script_dir / "fiction-sample-nlu-relationship-extract-v1.py"
    for path in (nlu0_path, nlu2_path, nlu3_path):
        require(path.is_file(), f"missing dependency script: {path}")
    return (
        runpy.run_path(str(nlu0_path)),
        runpy.run_path(str(nlu2_path)),
        runpy.run_path(str(nlu3_path)),
    )


def relationship_registry_sha256(record: dict[str, Any]) -> str:
    payload = record["payload"]
    registry = {
        "scope": payload["scope"],
        "entity_registry_sha256": payload["entity_registry_sha256"],
        "pair_windows": payload["pair_windows"],
        "assertions": payload["assertions"],
        "inactive_candidates": payload["inactive_candidates"],
    }
    return sha256_text(canonical_json(registry))


def validate_relationship_dependency(
    relationship_record: dict[str, Any],
    character_record: dict[str, Any],
    *,
    db_root: Path,
    nlu0: dict[str, Any],
    nlu2: dict[str, Any],
    nlu3: dict[str, Any],
) -> None:
    database = nlu0["load_database"](db_root)
    nlu0["validate_record"](relationship_record, database, allow_retrieval_admission=False)
    require(relationship_record.get("analysis_kind") == "relationship", "dependency record is not relationship")
    require(
        relationship_record.get("analysis_version") == "character_relationship_v1",
        "unsupported relationship analysis_version",
    )

    nlu3["validate_character_record"](
        character_record,
        db_root=db_root,
        nlu0=nlu0,
        nlu2=nlu2,
    )
    relationship_config_path = (
        Path(__file__).resolve().parent.parent
        / "config"
        / "fiction-nlu-character-relationship-v1.json"
    )
    relationship_config, relationship_config_sha = nlu3["load_config"](relationship_config_path)
    passages, _scenes, _novels = nlu3["load_database"](db_root)
    nlu3["validate_payload"](
        relationship_record.get("payload"),
        character_record,
        passages,
        relationship_config,
        relationship_config_sha,
    )


def assertion_track_key(assertion: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        assertion["relation_id"],
        assertion["directionality"],
        assertion["source_entity_id"],
        assertion["target_entity_id"],
    )


def track_id_for(novel_id: str, key: tuple[str, str, str, str]) -> str:
    relation_id, directionality, source_entity_id, target_entity_id = key
    return stable_id(
        "RTR",
        {
            "novel_id": novel_id,
            "relation_id": relation_id,
            "directionality": directionality,
            "source_entity_id": source_entity_id,
            "target_entity_id": target_entity_id,
        },
    )


def pair_key(entity_a: str, entity_b: str) -> tuple[str, str]:
    a, b = sorted([entity_a, entity_b])
    return a, b


def event_type_for(previous: set[str] | None, current: set[str]) -> str:
    if previous is None:
        return "timeline_started"
    if not previous and not current:
        return "no_positive_evidence_continues"
    if previous == current and current:
        return "evidence_reinforced"
    if previous and not current:
        return "evidence_became_unobserved"
    return "evidence_changed"


def build_payload(
    relationship_record: dict[str, Any],
    config: dict[str, Any],
    config_sha256: str,
) -> dict[str, Any]:
    payload = relationship_record["payload"]
    novel_id = relationship_record["subject"]["id"]
    assertions = list(payload["assertions"])
    pair_windows = list(payload["pair_windows"])

    assertions_by_window: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for assertion in assertions:
        assertions_by_window[assertion["pair_window_id"]].append(assertion)
    for rows in assertions_by_window.values():
        rows.sort(key=lambda item: item["assertion_id"])

    windows_by_pair: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for window in pair_windows:
        windows_by_pair[pair_key(window["entity_a"], window["entity_b"])].append(window)
    for rows in windows_by_pair.values():
        rows.sort(
            key=lambda item: (
                item["first_novel_offset"],
                item["last_novel_offset"],
                item["pair_window_id"],
            )
        )

    conflict_pairs = {
        tuple(sorted(pair))
        for pair in config["conflict_policy"]["conflicting_relation_pairs"]
    }
    timelines: list[dict[str, Any]] = []
    warnings: list[str] = []
    errors: list[str] = []

    for (entity_a, entity_b), windows in sorted(windows_by_pair.items()):
        timeline_id = stable_id(
            "RTL",
            {"novel_id": novel_id, "entity_a": entity_a, "entity_b": entity_b},
        )

        all_pair_assertions = [
            assertion
            for window in windows
            for assertion in assertions_by_window.get(window["pair_window_id"], [])
        ]

        track_assertions: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for assertion in all_pair_assertions:
            track_assertions[assertion_track_key(assertion)].append(assertion)

        track_by_key: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        for key, rows in sorted(track_assertions.items()):
            rows.sort(
                key=lambda item: (
                    item["local_scope"]["first_novel_offset"],
                    item["local_scope"]["last_novel_offset"],
                    item["assertion_id"],
                )
            )
            relation_id, directionality, source_entity_id, target_entity_id = key
            tid = track_id_for(novel_id, key)
            snapshot_ids = [
                stable_id(
                    "RSP",
                    {"timeline_id": timeline_id, "pair_window_id": row["pair_window_id"]},
                )
                for row in rows
            ]
            track_by_key[key] = {
                "track_id": tid,
                "relation_id": relation_id,
                "directionality": directionality,
                "source_entity_id": source_entity_id,
                "target_entity_id": target_entity_id,
                "assertion_ids": [row["assertion_id"] for row in rows],
                "snapshot_ids": sorted(set(snapshot_ids)),
                "first_novel_offset": min(row["local_scope"]["first_novel_offset"] for row in rows),
                "last_novel_offset": max(row["local_scope"]["last_novel_offset"] for row in rows),
                "observation_count": len(rows),
            }

        snapshots: list[dict[str, Any]] = []
        for window in windows:
            snapshot_id = stable_id(
                "RSP",
                {"timeline_id": timeline_id, "pair_window_id": window["pair_window_id"]},
            )
            rows = assertions_by_window.get(window["pair_window_id"], [])
            track_ids = sorted(
                track_id_for(novel_id, assertion_track_key(assertion))
                for assertion in rows
            )
            snapshots.append(
                {
                    "snapshot_id": snapshot_id,
                    "pair_window_id": window["pair_window_id"],
                    "first_novel_offset": window["first_novel_offset"],
                    "last_novel_offset": window["last_novel_offset"],
                    "passage_ids": list(window["passage_ids"]),
                    "scene_ids": list(window["scene_ids"]),
                    "assertion_ids": sorted(assertion["assertion_id"] for assertion in rows),
                    "track_ids": track_ids,
                    "absence_semantics": config["snapshot_policy"]["absence_semantics"],
                }
            )

        change_events: list[dict[str, Any]] = []
        previous_track_ids: set[str] | None = None
        previous_snapshot_id: str | None = None
        for snapshot in snapshots:
            current_track_ids = set(snapshot["track_ids"])
            added = sorted(
                current_track_ids
                if previous_track_ids is None
                else current_track_ids - previous_track_ids
            )
            continuing = sorted(
                []
                if previous_track_ids is None
                else current_track_ids & previous_track_ids
            )
            not_observed = sorted(
                []
                if previous_track_ids is None
                else previous_track_ids - current_track_ids
            )
            event_type = event_type_for(previous_track_ids, current_track_ids)
            change_id = stable_id(
                "RCH",
                {
                    "timeline_id": timeline_id,
                    "from_snapshot_id": previous_snapshot_id,
                    "to_snapshot_id": snapshot["snapshot_id"],
                    "event_type": event_type,
                },
            )
            change_events.append(
                {
                    "change_id": change_id,
                    "event_type": event_type,
                    "from_snapshot_id": previous_snapshot_id,
                    "to_snapshot_id": snapshot["snapshot_id"],
                    "added_track_ids": added,
                    "continuing_track_ids": continuing,
                    "not_observed_track_ids": not_observed,
                }
            )
            previous_track_ids = current_track_ids
            previous_snapshot_id = snapshot["snapshot_id"]

        tracks = sorted(track_by_key.values(), key=lambda item: item["track_id"])
        track_by_id = {track["track_id"]: track for track in tracks}

        conflict_events: list[dict[str, Any]] = []
        for snapshot in snapshots:
            active_tracks = [track_by_id[tid] for tid in snapshot["track_ids"]]
            for i in range(len(active_tracks)):
                for j in range(i + 1, len(active_tracks)):
                    left = active_tracks[i]
                    right = active_tracks[j]
                    if tuple(sorted([left["relation_id"], right["relation_id"]])) not in conflict_pairs:
                        continue
                    if (
                        left["source_entity_id"] != right["source_entity_id"]
                        or left["target_entity_id"] != right["target_entity_id"]
                    ):
                        continue
                    conflict_id = stable_id(
                        "RCF",
                        {
                            "timeline_id": timeline_id,
                            "snapshot_id": snapshot["snapshot_id"],
                            "track_id_a": left["track_id"],
                            "track_id_b": right["track_id"],
                        },
                    )
                    conflict_events.append(
                        {
                            "conflict_id": conflict_id,
                            "snapshot_id": snapshot["snapshot_id"],
                            "track_id_a": left["track_id"],
                            "track_id_b": right["track_id"],
                            "relation_id_a": left["relation_id"],
                            "relation_id_b": right["relation_id"],
                        }
                    )
                    warnings.append(
                        f'conflicting_local_signals:{snapshot["snapshot_id"]}:{left["relation_id"]}:{right["relation_id"]}'
                    )

        reciprocity_events: list[dict[str, Any]] = []
        if config["reciprocity_policy"]["detect_directed_reciprocity"]:
            directed = [track for track in tracks if track["directionality"] == "directed"]
            seen_reciprocity: set[tuple[str, str, str]] = set()
            for left in directed:
                for right in directed:
                    if left["track_id"] >= right["track_id"]:
                        continue
                    if left["relation_id"] != right["relation_id"]:
                        continue
                    if (
                        left["source_entity_id"] == right["target_entity_id"]
                        and left["target_entity_id"] == right["source_entity_id"]
                    ):
                        key = (
                            left["relation_id"],
                            min(left["track_id"], right["track_id"]),
                            max(left["track_id"], right["track_id"]),
                        )
                        if key in seen_reciprocity:
                            continue
                        seen_reciprocity.add(key)
                        reciprocity_events.append(
                            {
                                "reciprocity_id": stable_id(
                                    "RRP",
                                    {
                                        "timeline_id": timeline_id,
                                        "relation_id": left["relation_id"],
                                        "forward_track_id": key[1],
                                        "reverse_track_id": key[2],
                                    },
                                ),
                                "relation_id": left["relation_id"],
                                "forward_track_id": key[1],
                                "reverse_track_id": key[2],
                            }
                        )

        timelines.append(
            {
                "timeline_id": timeline_id,
                "entity_a": entity_a,
                "entity_b": entity_b,
                "snapshots": snapshots,
                "tracks": tracks,
                "change_events": change_events,
                "conflict_events": sorted(conflict_events, key=lambda item: item["conflict_id"]),
                "reciprocity_events": sorted(reciprocity_events, key=lambda item: item["reciprocity_id"]),
            }
        )

    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha256,
        "assertion_scope": config["assertion_scope"],
        "scope": {
            "novel_id": novel_id,
            "relationship_analysis_id": relationship_record["analysis_id"],
            "complete_relationship_history_claim": False,
        },
        "relationship_registry_sha256": relationship_registry_sha256(relationship_record),
        "ordering": {
            "basis": config["ordering_policy"]["basis"],
            "nonlinear_story_time_resolved": config["ordering_policy"]["nonlinear_story_time_resolved"],
        },
        "timelines": timelines,
        "consistency": {
            "valid": not errors,
            "errors": errors,
            "warnings": sorted(set(warnings)),
        },
    }


def validate_payload(
    payload: dict[str, Any],
    relationship_record: dict[str, Any],
    config: dict[str, Any],
    config_sha256: str,
) -> None:
    require(payload.get("schema_version") == PAYLOAD_VERSION, "payload schema_version mismatch")
    require(payload.get("config_version") == CONFIG_VERSION, "payload config_version mismatch")
    require(payload.get("config_sha256") == config_sha256, "payload config_sha256 mismatch")
    require(payload.get("assertion_scope") == config["assertion_scope"], "payload assertion_scope mismatch")
    scope = payload.get("scope") or {}
    require(scope.get("novel_id") == relationship_record["subject"]["id"], "payload novel_id mismatch")
    require(scope.get("relationship_analysis_id") == relationship_record["analysis_id"], "relationship lineage mismatch")
    require(scope.get("complete_relationship_history_claim") is False, "NLU-4 may not claim complete relationship history")
    require(
        payload.get("relationship_registry_sha256") == relationship_registry_sha256(relationship_record),
        "relationship registry hash mismatch",
    )
    ordering = payload.get("ordering") or {}
    require(ordering.get("basis") == "narrative_passage_order", "ordering basis mismatch")
    require(ordering.get("nonlinear_story_time_resolved") is False, "NLU-4 may not claim nonlinear story-time resolution")
    expected = build_payload(relationship_record, config, config_sha256)
    require(
        canonical_json(payload) == canonical_json(expected),
        "timeline payload is not the deterministic projection of the NLU-3 dependency",
    )
    consistency = payload.get("consistency") or {}
    require(consistency.get("valid") is True, f"consistency failed: {consistency.get('errors')}")


def build_analysis_record(
    relationship_record: dict[str, Any],
    payload: dict[str, Any],
    *,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    evidence = list(relationship_record.get("evidence") or [])
    require(evidence, "relationship dependency must retain canonical analysis-level evidence")
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "relationship_timeline",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": relationship_record["subject"],
        "method": {
            "type": "deterministic",
            "name": "fiction-sample-nlu-relationship-timeline-v1",
            "version": "1",
            "model_id": None,
        },
        "confidence": relationship_record.get("confidence"),
        "evidence": evidence,
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": "fiction-sample-nlu-relationship-timeline-v1:deterministic",
            "input_sha256": sha256_text(
                canonical_json(
                    {
                        "relationship_analysis_id": relationship_record["analysis_id"],
                        "relationship_registry_sha256": payload["relationship_registry_sha256"],
                    }
                )
            ),
            "code_sha256": sha256_bytes(Path(__file__).read_bytes()),
            "model_sha256": None,
            "notes": "NLU-4 deterministic narrative-order relationship evidence timeline; absence never means ended.",
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
        return {"schema_version": "fiction_nlu_relationship_timeline_checkpoint_v1", "completed": {}, "errors": {}}
    value = load_json(path)
    require(value.get("schema_version") == "fiction_nlu_relationship_timeline_checkpoint_v1", "checkpoint schema mismatch")
    return value


def command_compile(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    nlu0, nlu2, nlu3 = load_dependencies(Path(__file__).resolve().parent)
    relationship_records = load_jsonl(Path(args.relationship))
    character_records = {
        (record.get("subject") or {}).get("id"): record
        for record in load_jsonl(Path(args.character_resolution))
    }
    if args.novel_id:
        requested = set(args.novel_id)
        relationship_records = [
            record for record in relationship_records
            if (record.get("subject") or {}).get("id") in requested
        ]
    if args.limit_novels is not None:
        relationship_records = relationship_records[: args.limit_novels]

    output_path = Path(args.output)
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = load_checkpoint(checkpoint_path)
    completed = checkpoint.setdefault("completed", {})
    errors = checkpoint.setdefault("errors", {})
    existing = set()
    if output_path.exists():
        for record in load_jsonl(output_path):
            if record.get("analysis_kind") == "relationship_timeline" and record.get("analysis_version") == ANALYSIS_VERSION:
                existing.add((record.get("subject") or {}).get("id"))

    database = nlu0["load_database"](db_root)
    summary = {
        "selected": len(relationship_records),
        "written": 0,
        "skipped": 0,
        "timelines": 0,
        "snapshots": 0,
        "tracks": 0,
        "change_events": 0,
        "conflict_events": 0,
        "reciprocity_events": 0,
        "errors": 0,
    }

    for relationship_record in relationship_records:
        novel_id = (relationship_record.get("subject") or {}).get("id")
        if novel_id in completed or novel_id in existing:
            summary["skipped"] += 1
            continue
        try:
            character_record = character_records.get(novel_id)
            require(character_record is not None, f"missing character-resolution dependency for {novel_id}")
            validate_relationship_dependency(
                relationship_record,
                character_record,
                db_root=db_root,
                nlu0=nlu0,
                nlu2=nlu2,
                nlu3=nlu3,
            )
            payload = build_payload(relationship_record, config, config_sha)
            validate_payload(payload, relationship_record, config, config_sha)
            record = build_analysis_record(relationship_record, payload, nlu0=nlu0)
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            append_jsonl(output_path, record)
            completed[novel_id] = {
                "analysis_id": record["analysis_id"],
                "relationship_analysis_id": relationship_record["analysis_id"],
                "relationship_registry_sha256": payload["relationship_registry_sha256"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            errors.pop(novel_id, None)
            summary["written"] += 1
            summary["timelines"] += len(payload["timelines"])
            summary["snapshots"] += sum(len(item["snapshots"]) for item in payload["timelines"])
            summary["tracks"] += sum(len(item["tracks"]) for item in payload["timelines"])
            summary["change_events"] += sum(len(item["change_events"]) for item in payload["timelines"])
            summary["conflict_events"] += sum(len(item["conflict_events"]) for item in payload["timelines"])
            summary["reciprocity_events"] += sum(len(item["reciprocity_events"]) for item in payload["timelines"])
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
    nlu0, nlu2, nlu3 = load_dependencies(Path(__file__).resolve().parent)
    relationship_records = {
        (record.get("subject") or {}).get("id"): record
        for record in load_jsonl(Path(args.relationship))
    }
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
            require(record.get("analysis_kind") == "relationship_timeline", "record is not relationship_timeline")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            novel_id = (record.get("subject") or {}).get("id")
            relationship_record = relationship_records.get(novel_id)
            character_record = character_records.get(novel_id)
            require(relationship_record is not None, f"missing relationship dependency for {novel_id}")
            require(character_record is not None, f"missing character-resolution dependency for {novel_id}")
            validate_relationship_dependency(
                relationship_record,
                character_record,
                db_root=db_root,
                nlu0=nlu0,
                nlu2=nlu2,
                nlu3=nlu3,
            )
            validate_payload(record.get("payload"), relationship_record, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})

    report = {
        "schema_version": "fiction_nlu_character_relationship_timeline_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-4 deterministic relationship evidence timeline compiler.")
    sub = parser.add_subparsers(dest="command", required=True)

    compile_parser = sub.add_parser("compile")
    compile_parser.add_argument("--db-root", required=True)
    compile_parser.add_argument("--config", required=True)
    compile_parser.add_argument("--character-resolution", required=True)
    compile_parser.add_argument("--relationship", required=True)
    compile_parser.add_argument("--output", required=True)
    compile_parser.add_argument("--checkpoint")
    compile_parser.add_argument("--novel-id", action="append")
    compile_parser.add_argument("--limit-novels", type=int)
    compile_parser.add_argument("--continue-on-error", action="store_true")
    compile_parser.set_defaults(func=command_compile)

    validate_parser = sub.add_parser("validate")
    validate_parser.add_argument("--db-root", required=True)
    validate_parser.add_argument("--config", required=True)
    validate_parser.add_argument("--character-resolution", required=True)
    validate_parser.add_argument("--relationship", required=True)
    validate_parser.add_argument("--input", required=True)
    validate_parser.set_defaults(func=command_validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (Nlu4Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
