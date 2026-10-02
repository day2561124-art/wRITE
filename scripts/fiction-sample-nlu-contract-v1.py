from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "fiction_nlu_analysis_record_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"
ID_RE = re.compile(r"^ANL-[A-F0-9]{16}$")
PAS_RE = re.compile(r"^PAS-[A-F0-9]{16}$")
SCN_RE = re.compile(r"^SCN-[A-F0-9]{16}$")
NOV_RE = re.compile(r"^NOV-[A-F0-9]{16}$")
SHA_RE = re.compile(r"^[a-f0-9]{64}$")

ANALYSIS_KINDS = {
    "semantic_classification",
    "character_resolution",
    "relationship",
    "relationship_timeline",
    "event",
    "event_relation",
    "plot_structure",
    "narrative_function",
    "style_features",
    "style_embedding",
    "style_profile",
}
STATUSES = {"provisional", "validated", "superseded"}
METHOD_TYPES = {"deterministic", "heuristic", "model", "hybrid", "manual"}
SUBJECT_SPECS = {
    "passage": (PAS_RE, "passage_content_sha256"),
    "scene": (SCN_RE, "scene_hash"),
    "novel": (NOV_RE, "novel_text_sha256"),
}
TOP_LEVEL_KEYS = {
    "analysis_id",
    "schema_version",
    "analysis_kind",
    "analysis_version",
    "status",
    "subject",
    "method",
    "confidence",
    "evidence",
    "provenance",
    "retrieval_admission",
    "payload",
}


class ContractError(ValueError):
    pass


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractError(message)


def require_sha(value: Any, field: str) -> None:
    require(isinstance(value, str) and SHA_RE.fullmatch(value) is not None, f"{field} must be lowercase SHA-256")


def require_nonempty_string(value: Any, field: str) -> None:
    require(isinstance(value, str) and bool(value.strip()), f"{field} must be a non-empty string")


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ContractError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            require(isinstance(value, dict), f"{path}:{line_number}: record must be an object")
            rows.append(value)
    return rows


def load_database(db_root: Path) -> dict[str, dict[str, dict[str, Any]]]:
    records = db_root / "records"
    passages_path = records / "passages_v1.jsonl"
    scenes_path = records / "scenes_v1.jsonl"
    novels_path = records / "novels_v1.jsonl"
    for path in (passages_path, scenes_path, novels_path):
        require(path.is_file(), f"missing canonical record file: {path}")

    passages = {row["passage_id"]: row for row in load_jsonl(passages_path)}
    scenes = {row["scene_id"]: row for row in load_jsonl(scenes_path)}
    novels = {row["novel_id"]: row for row in load_jsonl(novels_path)}
    return {"passage": passages, "scene": scenes, "novel": novels}


def deterministic_analysis_id(record: dict[str, Any]) -> str:
    subject = record.get("subject")
    method = record.get("method")
    provenance = record.get("provenance")
    identity = {
        "schema_version": record.get("schema_version"),
        "analysis_kind": record.get("analysis_kind"),
        "analysis_version": record.get("analysis_version"),
        "subject": {
            "level": subject.get("level") if isinstance(subject, dict) else None,
            "id": subject.get("id") if isinstance(subject, dict) else None,
            "content_sha256": subject.get("content_sha256") if isinstance(subject, dict) else None,
        },
        "method": {
            "type": method.get("type") if isinstance(method, dict) else None,
            "name": method.get("name") if isinstance(method, dict) else None,
            "version": method.get("version") if isinstance(method, dict) else None,
            "model_id": method.get("model_id") if isinstance(method, dict) else None,
        },
        "input_sha256": provenance.get("input_sha256") if isinstance(provenance, dict) else None,
    }
    digest = hashlib.sha256(canonical_json(identity).encode("utf-8")).hexdigest()
    return "ANL-" + digest[:16].upper()


def validate_method(method: Any) -> None:
    require(isinstance(method, dict), "method must be an object")
    allowed = {"type", "name", "version", "model_id"}
    require(set(method) <= allowed, f"method contains unknown fields: {sorted(set(method) - allowed)}")
    require(method.get("type") in METHOD_TYPES, "method.type is invalid")
    require_nonempty_string(method.get("name"), "method.name")
    require_nonempty_string(method.get("version"), "method.version")
    if method.get("model_id") is not None:
        require_nonempty_string(method.get("model_id"), "method.model_id")


def validate_provenance(provenance: Any) -> None:
    require(isinstance(provenance, dict), "provenance must be an object")
    allowed = {"created_at", "producer", "input_sha256", "code_sha256", "model_sha256", "notes"}
    require(set(provenance) <= allowed, f"provenance contains unknown fields: {sorted(set(provenance) - allowed)}")
    require_nonempty_string(provenance.get("created_at"), "provenance.created_at")
    require_nonempty_string(provenance.get("producer"), "provenance.producer")
    require_sha(provenance.get("input_sha256"), "provenance.input_sha256")
    for name in ("code_sha256", "model_sha256"):
        if provenance.get(name) is not None:
            require_sha(provenance.get(name), f"provenance.{name}")
    if provenance.get("notes") is not None:
        require(isinstance(provenance.get("notes"), str), "provenance.notes must be a string or null")


def validate_subject(subject: Any, database: dict[str, dict[str, dict[str, Any]]]) -> None:
    require(isinstance(subject, dict), "subject must be an object")
    require(set(subject) == {"level", "id", "content_hash_kind", "content_sha256"}, "subject must contain exactly level/id/content_hash_kind/content_sha256")
    level = subject.get("level")
    require(level in SUBJECT_SPECS, "subject.level is invalid")
    id_re, expected_hash_kind = SUBJECT_SPECS[level]
    subject_id = subject.get("id")
    require(isinstance(subject_id, str) and id_re.fullmatch(subject_id) is not None, f"subject.id is invalid for level {level}")
    require(subject.get("content_hash_kind") == expected_hash_kind, f"subject.content_hash_kind must be {expected_hash_kind}")
    require_sha(subject.get("content_sha256"), "subject.content_sha256")
    canonical = database[level].get(subject_id)
    require(canonical is not None, f"subject does not exist in canonical {level} records: {subject_id}")
    if level == "passage":
        current_hash = canonical.get("content_sha256")
    elif level == "scene":
        current_hash = canonical.get("scene_hash")
    else:
        current_hash = (canonical.get("text") or {}).get("text_sha256")
    require(subject["content_sha256"] == current_hash, f"subject content hash is stale for {subject_id}")


def validate_evidence_item(item: Any, database: dict[str, dict[str, dict[str, Any]]], index: int) -> None:
    prefix = f"evidence[{index}]"
    require(isinstance(item, dict), f"{prefix} must be an object")
    allowed = {
        "passage_id",
        "scene_id",
        "novel_id",
        "content_sha256",
        "span_start",
        "span_end",
        "quote_sha256",
    }
    require(set(item) <= allowed, f"{prefix} contains unknown fields: {sorted(set(item) - allowed)}")
    required = {"passage_id", "content_sha256"}
    require(required <= set(item), f"{prefix} missing fields: {sorted(required - set(item))}")
    passage_id = item.get("passage_id")
    require(isinstance(passage_id, str) and PAS_RE.fullmatch(passage_id) is not None, f"{prefix}.passage_id is invalid")
    passage = database["passage"].get(passage_id)
    require(passage is not None, f"{prefix}.passage_id does not exist: {passage_id}")
    require_sha(item.get("content_sha256"), f"{prefix}.content_sha256")
    require(item["content_sha256"] == passage.get("content_sha256"), f"{prefix}.content_sha256 is stale")

    if item.get("scene_id") is not None:
        require(item["scene_id"] == passage.get("scene_id"), f"{prefix}.scene_id does not match canonical passage lineage")
    if item.get("novel_id") is not None:
        require(item["novel_id"] == passage.get("novel_id"), f"{prefix}.novel_id does not match canonical passage lineage")

    start = item.get("span_start")
    end = item.get("span_end")
    require((start is None) == (end is None), f"{prefix} span_start/span_end must be provided together")
    if start is not None:
        require(isinstance(start, int) and not isinstance(start, bool) and start >= 0, f"{prefix}.span_start is invalid")
        require(isinstance(end, int) and not isinstance(end, bool) and end > start, f"{prefix}.span_end is invalid")
        text = passage.get("text")
        require(isinstance(text, str), f"{prefix} canonical passage text is missing")
        require(end <= len(text), f"{prefix} span exceeds canonical passage text")
        if item.get("quote_sha256") is not None:
            require_sha(item["quote_sha256"], f"{prefix}.quote_sha256")
            expected = sha256_text(text[start:end])
            require(item["quote_sha256"] == expected, f"{prefix}.quote_sha256 does not match canonical evidence span")
    else:
        require(item.get("quote_sha256") is None, f"{prefix}.quote_sha256 requires a span")


def validate_retrieval_admission(value: Any, allow_retrieval_admission: bool) -> None:
    require(isinstance(value, dict), "retrieval_admission must be an object")
    allowed = {"state", "contract_version", "notes"}
    require(set(value) <= allowed, f"retrieval_admission contains unknown fields: {sorted(set(value) - allowed)}")
    state = value.get("state")
    require(state in {"not_admitted", "eligible", "admitted"}, "retrieval_admission.state is invalid")
    require(value.get("contract_version") == RETRIEVAL_CONTRACT_VERSION, f"retrieval_admission.contract_version must be {RETRIEVAL_CONTRACT_VERSION}")
    if not allow_retrieval_admission:
        require(state == "not_admitted", "retrieval admission is closed during NLU-only development")
    if value.get("notes") is not None:
        require(isinstance(value.get("notes"), str), "retrieval_admission.notes must be a string or null")


def validate_record(
    record: Any,
    database: dict[str, dict[str, dict[str, Any]]],
    *,
    allow_retrieval_admission: bool = False,
) -> None:
    require(isinstance(record, dict), "analysis record must be an object")
    missing = TOP_LEVEL_KEYS - set(record)
    extra = set(record) - TOP_LEVEL_KEYS
    require(not missing, f"missing top-level fields: {sorted(missing)}")
    require(not extra, f"unknown top-level fields: {sorted(extra)}")
    require(record.get("schema_version") == SCHEMA_VERSION, f"schema_version must be {SCHEMA_VERSION}")
    require(record.get("analysis_kind") in ANALYSIS_KINDS, "analysis_kind is invalid")
    require_nonempty_string(record.get("analysis_version"), "analysis_version")
    require(record.get("status") in STATUSES, "status is invalid")

    validate_subject(record.get("subject"), database)
    validate_method(record.get("method"))

    confidence = record.get("confidence")
    require(
        confidence is None
        or (
            isinstance(confidence, (int, float))
            and not isinstance(confidence, bool)
            and 0 <= confidence <= 1
        ),
        "confidence must be null or a number in [0,1]",
    )

    evidence = record.get("evidence")
    require(isinstance(evidence, list) and len(evidence) > 0, "evidence must be a non-empty array")
    for index, item in enumerate(evidence):
        validate_evidence_item(item, database, index)

    validate_provenance(record.get("provenance"))
    validate_retrieval_admission(record.get("retrieval_admission"), allow_retrieval_admission)
    require(isinstance(record.get("payload"), dict), "payload must be an object")

    analysis_id = record.get("analysis_id")
    require(isinstance(analysis_id, str) and ID_RE.fullmatch(analysis_id) is not None, "analysis_id is invalid")
    expected_id = deterministic_analysis_id(record)
    require(analysis_id == expected_id, f"analysis_id must be deterministic: expected {expected_id}")


def validate_file(
    db_root: Path,
    input_path: Path,
    *,
    allow_retrieval_admission: bool = False,
) -> dict[str, Any]:
    database = load_database(db_root)
    rows = load_jsonl(input_path)
    errors: list[dict[str, Any]] = []
    seen: set[str] = set()
    valid = 0
    for line_number, row in enumerate(rows, 1):
        try:
            analysis_id = row.get("analysis_id")
            if isinstance(analysis_id, str) and analysis_id in seen:
                raise ContractError(f"duplicate analysis_id in input: {analysis_id}")
            validate_record(row, database, allow_retrieval_admission=allow_retrieval_admission)
            seen.add(row["analysis_id"])
            valid += 1
        except ContractError as exc:
            errors.append({"line": line_number, "error": str(exc)})
    return {
        "schema_version": "fiction_nlu_contract_validation_report_v1",
        "contract": SCHEMA_VERSION,
        "input": str(input_path),
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
        "retrieval_admission_open": allow_retrieval_admission,
    }


def command_make_id(args: argparse.Namespace) -> int:
    path = Path(args.input)
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    require(isinstance(value, dict), "input must contain one JSON object")
    print(deterministic_analysis_id(value))
    return 0


def command_validate(args: argparse.Namespace) -> int:
    report = validate_file(
        Path(args.db_root),
        Path(args.input),
        allow_retrieval_admission=args.allow_retrieval_admission,
    )
    output = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output + "\n", encoding="utf-8")
    print(output)
    return 0 if report["error_count"] == 0 else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate additive Fiction Sample NLU analysis records.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate", help="Validate one JSONL analysis file against canonical Novel/Scene/Passage records.")
    validate_parser.add_argument("--db-root", required=True)
    validate_parser.add_argument("--input", required=True)
    validate_parser.add_argument("--output")
    validate_parser.add_argument(
        "--allow-retrieval-admission",
        action="store_true",
        help="Allow eligible/admitted states. Keep disabled while Retrieval v2 is developed independently.",
    )
    validate_parser.set_defaults(func=command_validate)

    id_parser = subparsers.add_parser("make-id", help="Print the deterministic analysis_id for one JSON record.")
    id_parser.add_argument("--input", required=True)
    id_parser.set_defaults(func=command_make_id)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (ContractError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
