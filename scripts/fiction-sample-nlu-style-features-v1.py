from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import runpy
import statistics
import sys
import tempfile
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_VERSION = "fiction_nlu_style_features_v1"
PAYLOAD_VERSION = "fiction_nlu_style_features_v1"
ANALYSIS_VERSION = "explicit_style_features_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu9Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu9Error(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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
                raise Nlu9Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
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
    require((config.get("subject_policy") or {}).get("level") == "passage", "NLU-9 v1 supports passage subjects only")
    return config, sha256_text(canonical_json(config))


def load_contract(script_dir: Path) -> dict[str, Any]:
    path = script_dir / "fiction-sample-nlu-contract-v1.py"
    require(path.is_file(), f"missing dependency: {path}")
    return runpy.run_path(str(path))


def is_han(ch: str) -> bool:
    cp = ord(ch)
    return (
        0x3400 <= cp <= 0x4DBF
        or 0x4E00 <= cp <= 0x9FFF
        or 0xF900 <= cp <= 0xFAFF
        or 0x20000 <= cp <= 0x2A6DF
        or 0x2A700 <= cp <= 0x2B73F
        or 0x2B740 <= cp <= 0x2B81F
        or 0x2B820 <= cp <= 0x2CEAF
        or 0x2CEB0 <= cp <= 0x2EBEF
        or 0x30000 <= cp <= 0x3134F
        or 0x31350 <= cp <= 0x323AF
    )


def is_latin_letter(ch: str) -> bool:
    return unicodedata.category(ch).startswith("L") and "LATIN" in unicodedata.name(ch, "")


def is_punctuation(ch: str) -> bool:
    return unicodedata.category(ch).startswith("P")


def content_char_count(text: str) -> int:
    return sum(1 for ch in text if not ch.isspace() and not is_punctuation(ch))


def roundn(value: float, digits: int) -> float:
    return round(float(value), digits)


def ratio(numerator: int | float, denominator: int | float, digits: int) -> float:
    if not denominator:
        return 0.0
    return roundn(float(numerator) / float(denominator), digits)


def rate1000(count: int | float, denominator: int | float, digits: int) -> float:
    if not denominator:
        return 0.0
    return roundn(float(count) * 1000.0 / float(denominator), digits)


def percentile(values: list[int], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    position = (len(ordered) - 1) * p
    lo = int(math.floor(position))
    hi = int(math.ceil(position))
    if lo == hi:
        return float(ordered[lo])
    weight = position - lo
    return ordered[lo] * (1.0 - weight) + ordered[hi] * weight


def population_stddev(values: list[int]) -> float:
    if len(values) <= 1:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((value - mean) ** 2 for value in values) / len(values))


def sentence_segments(text: str, terminal_marks: list[str]) -> list[str]:
    pattern = "[" + re.escape("".join(terminal_marks)) + "]+"
    parts = re.split(pattern, text)
    usable = [part for part in parts if content_char_count(part) > 0]
    if usable:
        return usable
    return [text]


def paragraph_segments(text: str) -> list[str]:
    lines = [line for line in text.splitlines() if line.strip()]
    return lines if lines else [text]


def paired_quote_content_spans(text: str, open_quote: str, close_quote: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    if open_quote == close_quote:
        positions = [i for i, ch in enumerate(text) if ch == open_quote]
        for index in range(0, len(positions) - 1, 2):
            start = positions[index] + 1
            end = positions[index + 1]
            if start <= end:
                spans.append((start, end))
        return spans

    cursor = 0
    while cursor < len(text):
        start_marker = text.find(open_quote, cursor)
        if start_marker < 0:
            break
        end_marker = text.find(close_quote, start_marker + len(open_quote))
        if end_marker < 0:
            break
        spans.append((start_marker + len(open_quote), end_marker))
        cursor = end_marker + len(close_quote)
    return spans


def merge_spans(spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not spans:
        return []
    ordered = sorted(spans)
    merged = [ordered[0]]
    for start, end in ordered[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def dialogue_metrics(text: str, config: dict[str, Any], non_ws: int, digits: int) -> dict[str, Any]:
    raw_spans: list[tuple[int, int]] = []
    quote_pair_count = 0
    for open_quote, close_quote in config["dialogue_policy"]["quote_pairs"]:
        spans = paired_quote_content_spans(text, open_quote, close_quote)
        quote_pair_count += len(spans)
        raw_spans.extend(spans)
    merged = merge_spans(raw_spans)
    quoted_non_ws = sum(
        1
        for start, end in merged
        for ch in text[start:end]
        if not ch.isspace()
    )
    return {
        "quote_pair_count": quote_pair_count,
        "dialogue_segment_count": len(merged),
        "quoted_non_whitespace_char_count": quoted_non_ws,
        "dialogue_char_ratio": ratio(quoted_non_ws, non_ws, digits),
    }


def han_diversity(han_chars: list[str], window: int, digits: int) -> dict[str, Any]:
    if not han_chars:
        return {
            "unique_han_ratio": 0.0,
            "hapax_han_ratio": 0.0,
            "han_char_entropy_bits": 0.0,
            "mean_segmental_ttr_50": 0.0,
            "segment_count": 0,
        }
    counts = Counter(han_chars)
    total = len(han_chars)
    entropy = -sum((count / total) * math.log2(count / total) for count in counts.values())
    segments = [han_chars[i : i + window] for i in range(0, total, window)]
    segment_ttrs = [len(set(segment)) / len(segment) for segment in segments if segment]
    return {
        "unique_han_ratio": ratio(len(counts), total, digits),
        "hapax_han_ratio": ratio(sum(1 for count in counts.values() if count == 1), total, digits),
        "han_char_entropy_bits": roundn(entropy, digits),
        "mean_segmental_ttr_50": roundn(sum(segment_ttrs) / len(segment_ttrs), digits),
        "segment_count": len(segments),
    }


def sentence_final_particle_counts(
    segments: list[str],
    particles: list[str],
) -> dict[str, int]:
    counts = {particle: 0 for particle in particles}
    close_chars = set("」』”\"'）】〕》〉")
    for segment in segments:
        stripped = segment.strip()
        while stripped and (stripped[-1].isspace() or stripped[-1] in close_chars or is_punctuation(stripped[-1])):
            stripped = stripped[:-1]
        if not stripped:
            continue
        for particle in particles:
            if stripped.endswith(particle):
                counts[particle] += 1
    return counts


def build_payload(passage: dict[str, Any], config: dict[str, Any], config_sha: str) -> dict[str, Any]:
    text = passage.get("text")
    require(isinstance(text, str) and len(text) > 0, f'{passage.get("passage_id")}: passage text must be non-empty')
    digits = int(config["normalization"]["round_digits"])

    char_count = len(text)
    whitespace_count = sum(1 for ch in text if ch.isspace())
    non_ws = char_count - whitespace_count
    require(non_ws > 0, f'{passage.get("passage_id")}: passage has no non-whitespace characters')

    han_chars = [ch for ch in text if is_han(ch)]
    latin_count = sum(1 for ch in text if is_latin_letter(ch))
    digit_count = sum(1 for ch in text if ch.isdigit())
    punctuation_count = sum(1 for ch in text if is_punctuation(ch))
    content_count = content_char_count(text)
    lines = text.count("\n") + 1
    paragraphs = paragraph_segments(text)
    sentences = sentence_segments(text, config["sentence_policy"]["terminal_marks"])
    sentence_lengths = [content_char_count(sentence) for sentence in sentences]
    paragraph_lengths = [content_char_count(paragraph) for paragraph in paragraphs]
    paragraph_sentence_counts = [
        len(sentence_segments(paragraph, config["sentence_policy"]["terminal_marks"]))
        for paragraph in paragraphs
    ]

    sentence_mean = sum(sentence_lengths) / len(sentence_lengths)
    sentence_std = population_stddev(sentence_lengths)
    short_max = int(config["sentence_policy"]["short_sentence_max_chars"])
    long_min = int(config["sentence_policy"]["long_sentence_min_chars"])

    paragraph_mean = sum(paragraph_lengths) / len(paragraph_lengths)
    marker_denominator = len(han_chars)
    function_word_rates = {
        marker: rate1000(text.count(marker), marker_denominator, digits)
        for marker in config["literal_markers"]["function_words"]
    }
    particle_counts = sentence_final_particle_counts(
        sentences,
        config["literal_markers"]["sentence_final_particles"],
    )
    particle_rates = {
        marker: rate1000(count, marker_denominator, digits)
        for marker, count in particle_counts.items()
    }

    punctuation_rates = {}
    for group, marks in config["punctuation_groups"].items():
        punctuation_rates[group] = rate1000(sum(text.count(mark) for mark in marks), non_ws, digits)

    minimum_stable = int(config["subject_policy"]["minimum_non_whitespace_chars_for_stable_sample"])
    short_threshold = int(config["subject_policy"]["short_sample_threshold"])
    min_sentences = int(config["subject_policy"]["minimum_sentences_for_rhythm_stability"])
    warnings = []
    if non_ws < short_threshold:
        tier = "short"
        warnings.append("short_non_whitespace_sample")
    elif non_ws < minimum_stable:
        tier = "moderate"
        warnings.append("below_stable_character_threshold")
    else:
        tier = "stable"
    if len(sentences) < min_sentences:
        warnings.append("few_sentences_for_rhythm")
    stable = non_ws >= minimum_stable and len(sentences) >= min_sentences

    return {
        "schema_version": PAYLOAD_VERSION,
        "config_version": CONFIG_VERSION,
        "config_sha256": config_sha,
        "assertion_scope": config["assertion_scope"],
        "scope": {
            "passage_id": passage["passage_id"],
            "scene_id": passage.get("scene_id"),
            "novel_id": passage.get("novel_id"),
            "author_attribution_claim": False,
            "style_profile_claim": False,
            "semantic_quality_claim": False,
        },
        "sample_quality": {
            "tier": tier,
            "stable_for_passage_style": stable,
            "warnings": warnings,
        },
        "counts": {
            "char_count": char_count,
            "non_whitespace_char_count": non_ws,
            "content_char_count": content_count,
            "han_char_count": len(han_chars),
            "latin_letter_count": latin_count,
            "digit_count": digit_count,
            "punctuation_count": punctuation_count,
            "whitespace_count": whitespace_count,
            "line_count": lines,
            "paragraph_count": len(paragraphs),
            "sentence_count": len(sentences),
        },
        "ratios": {
            "whitespace_ratio": ratio(whitespace_count, char_count, digits),
            "han_ratio": ratio(len(han_chars), char_count, digits),
            "latin_ratio": ratio(latin_count, char_count, digits),
            "digit_ratio": ratio(digit_count, char_count, digits),
            "punctuation_ratio": ratio(punctuation_count, char_count, digits),
        },
        "sentence_rhythm": {
            "mean_chars": roundn(sentence_mean, digits),
            "median_chars": roundn(statistics.median(sentence_lengths), digits),
            "stddev_chars": roundn(sentence_std, digits),
            "p10_chars": roundn(percentile(sentence_lengths, 0.10), digits),
            "p90_chars": roundn(percentile(sentence_lengths, 0.90), digits),
            "coefficient_of_variation": roundn(sentence_std / sentence_mean if sentence_mean else 0.0, digits),
            "short_sentence_ratio": ratio(sum(1 for value in sentence_lengths if value <= short_max), len(sentence_lengths), digits),
            "long_sentence_ratio": ratio(sum(1 for value in sentence_lengths if value >= long_min), len(sentence_lengths), digits),
        },
        "paragraph_rhythm": {
            "mean_chars": roundn(paragraph_mean, digits),
            "median_chars": roundn(statistics.median(paragraph_lengths), digits),
            "stddev_chars": roundn(population_stddev(paragraph_lengths), digits),
            "mean_sentences": roundn(sum(paragraph_sentence_counts) / len(paragraph_sentence_counts), digits),
        },
        "punctuation_rates_per_1000": punctuation_rates,
        "lexical_surface": han_diversity(
            han_chars,
            int(config["diversity_policy"]["segment_window_chars"]),
            digits,
        ),
        "literal_marker_rates_per_1000": {
            "function_words": function_word_rates,
            "sentence_final_particles": particle_rates,
        },
        "dialogue": dialogue_metrics(text, config, non_ws, digits),
        "consistency": {"valid": True, "errors": [], "warnings": warnings},
    }


def whole_passage_evidence(passage: dict[str, Any]) -> dict[str, Any]:
    text = passage["text"]
    return {
        "passage_id": passage["passage_id"],
        "scene_id": passage.get("scene_id"),
        "novel_id": passage.get("novel_id"),
        "content_sha256": passage["content_sha256"],
        "span_start": 0,
        "span_end": len(text),
        "quote_sha256": sha256_text(text),
    }


def build_record(
    passage: dict[str, Any],
    payload: dict[str, Any],
    config_sha: str,
    *,
    nlu0: dict[str, Any],
) -> dict[str, Any]:
    record = {
        "analysis_id": "ANL-0000000000000000",
        "schema_version": "fiction_nlu_analysis_record_v1",
        "analysis_kind": "style_features",
        "analysis_version": ANALYSIS_VERSION,
        "status": "provisional",
        "subject": {
            "level": "passage",
            "id": passage["passage_id"],
            "content_hash_kind": "passage_content_sha256",
            "content_sha256": passage["content_sha256"],
        },
        "method": {
            "type": "deterministic",
            "name": "fiction-sample-nlu-style-features-v1",
            "version": "1",
            "model_id": None,
        },
        "confidence": 1.0,
        "evidence": [whole_passage_evidence(passage)],
        "provenance": {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": "fiction-sample-nlu-style-features-v1:deterministic",
            "input_sha256": sha256_text(
                canonical_json(
                    {
                        "passage_id": passage["passage_id"],
                        "content_sha256": passage["content_sha256"],
                        "config_sha256": config_sha,
                    }
                )
            ),
            "code_sha256": sha256_bytes(Path(__file__).read_bytes()),
            "model_sha256": None,
            "notes": "Deterministic explicit style measurements; no authorship, quality, embedding, or style-profile claim.",
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


def validate_payload(
    payload: dict[str, Any],
    passage: dict[str, Any],
    config: dict[str, Any],
    config_sha: str,
) -> None:
    require(isinstance(payload, dict), "style payload must be an object")
    expected = build_payload(passage, config, config_sha)
    require(
        canonical_json(payload) == canonical_json(expected),
        "style feature payload is not deterministic projection of canonical passage",
    )


def command_extract(args: argparse.Namespace) -> int:
    db_root = Path(args.db_root)
    config, config_sha = load_config(Path(args.config))
    nlu0 = load_contract(Path(__file__).resolve().parent)
    passages = load_jsonl(db_root / "records" / "passages_v1.jsonl")
    eligible = set(config["subject_policy"]["eligible_statuses"])
    passages = [row for row in passages if row.get("status") in eligible]
    if args.passage_id:
        wanted = set(args.passage_id)
        passages = [row for row in passages if row.get("passage_id") in wanted]
    if args.novel_id:
        novels = set(args.novel_id)
        passages = [row for row in passages if row.get("novel_id") in novels]
    if args.limit_passages is not None:
        passages = passages[: args.limit_passages]

    output = Path(args.output)
    existing: set[str] = set()
    if output.exists():
        existing = {
            (row.get("subject") or {}).get("id")
            for row in load_jsonl(output)
            if row.get("analysis_kind") == "style_features"
            and row.get("analysis_version") == ANALYSIS_VERSION
        }

    checkpoint_path = Path(args.checkpoint) if args.checkpoint else None
    checkpoint = {
        "schema_version": "fiction_nlu_style_features_checkpoint_v1",
        "completed": {},
        "errors": {},
    }
    if checkpoint_path and checkpoint_path.exists():
        checkpoint = load_json(checkpoint_path)

    database = nlu0["load_database"](db_root)
    summary = {"selected": len(passages), "written": 0, "skipped": 0, "stable": 0, "errors": 0}
    for passage in passages:
        passage_id = passage["passage_id"]
        if passage_id in existing or passage_id in checkpoint["completed"]:
            summary["skipped"] += 1
            continue
        try:
            payload = build_payload(passage, config, config_sha)
            validate_payload(payload, passage, config, config_sha)
            record = build_record(passage, payload, config_sha, nlu0=nlu0)
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            append_jsonl(output, record)
            checkpoint["completed"][passage_id] = {
                "analysis_id": record["analysis_id"],
                "content_sha256": passage["content_sha256"],
                "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            checkpoint["errors"].pop(passage_id, None)
            summary["written"] += 1
            if payload["sample_quality"]["stable_for_passage_style"]:
                summary["stable"] += 1
        except Exception as exc:
            checkpoint["errors"][passage_id] = str(exc)
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
    nlu0 = load_contract(Path(__file__).resolve().parent)
    passage_map = {
        row["passage_id"]: row
        for row in load_jsonl(db_root / "records" / "passages_v1.jsonl")
    }
    database = nlu0["load_database"](db_root)
    rows = load_jsonl(Path(args.input))
    errors = []
    valid = 0
    for line_number, record in enumerate(rows, 1):
        try:
            nlu0["validate_record"](record, database, allow_retrieval_admission=False)
            require(record.get("analysis_kind") == "style_features", "record is not style_features")
            require(record.get("analysis_version") == ANALYSIS_VERSION, "analysis_version mismatch")
            subject = record.get("subject") or {}
            require(subject.get("level") == "passage", "NLU-9 v1 subject must be passage")
            passage = passage_map.get(subject.get("id"))
            require(passage is not None, "canonical passage dependency missing")
            validate_payload(record.get("payload"), passage, config, config_sha)
            valid += 1
        except Exception as exc:
            errors.append({"line": line_number, "error": str(exc)})
    report = {
        "schema_version": "fiction_nlu_style_features_validation_report_v1",
        "record_count": len(rows),
        "valid_count": valid,
        "error_count": len(errors),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NLU-9 deterministic explicit style feature extraction.")
    sub = parser.add_subparsers(dest="command", required=True)

    extract = sub.add_parser("extract")
    extract.add_argument("--db-root", required=True)
    extract.add_argument("--config", required=True)
    extract.add_argument("--output", required=True)
    extract.add_argument("--checkpoint")
    extract.add_argument("--passage-id", action="append")
    extract.add_argument("--novel-id", action="append")
    extract.add_argument("--limit-passages", type=int)
    extract.add_argument("--continue-on-error", action="store_true")
    extract.set_defaults(func=command_extract)

    validate = sub.add_parser("validate")
    validate.add_argument("--db-root", required=True)
    validate.add_argument("--config", required=True)
    validate.add_argument("--input", required=True)
    validate.set_defaults(func=command_validate)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except (Nlu9Error, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
