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

CONFIG_VERSION = "fiction_nlu_event_relation_v1"
PAYLOAD_VERSION = "fiction_nlu_event_relation_v1"
REQUEST_VERSION = "fiction_nlu_event_relation_request_v1"
ANALYSIS_VERSION = "event_relation_v1"
RETRIEVAL_CONTRACT_VERSION = "fiction_nlu_retrieval_admission_v1"


class Nlu6Error(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Nlu6Error(message)


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
                raise Nlu6Error(f"{path}:{line_number}: invalid JSON: {exc}") from exc
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
    paths = [
        script_dir / "fiction-sample-nlu-contract-v1.py",
        script_dir / "fiction-sample-nlu-character-resolve-v1.py",
        script_dir / "fiction-sample-nlu-event-extract-v1.py",
    ]
    for path in paths:
        require(path.is_file(), f"missing dependency: {path}")
    return tuple(runpy.run_path(str(path)) for path in paths)  # type: ignore[return-value]


def load_database(db_root: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    passages = load_jsonl(db_root / "records" / "passages_v1.jsonl")
    scenes = {row["scene_id"]: row for row in load_jsonl(db_root / "records" / "scenes_v1.jsonl")}
    novels = {row["novel_id"]: row for row in load_jsonl(db_root / "records" / "novels_v1.jsonl")}
    return passages, scenes, novels


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


def validate_event_dependency(
    event_record: dict[str, Any],
    character_record: dict[str, Any],
    *,
    db_root: Path,
    nlu0: dict[str, Any],
    nlu2: dict[str, Any],
    nlu5: dict[str, Any],
) -> None:
    database = nlu0["load_database"](db_root)
    nlu0["validate_record"](event_record, database, allow_retrieval_admission=False)
    require(event_record.get("analysis_kind") == "event", "dependency is not event")
    require(event_record.get("analysis_version") == "event_analysis_v1", "unsupported event analysis version")
    nlu5["validate_character_dependency"](character_record, db_root=db_root, nlu0=nlu0, nlu2=nlu2)
    config_path = Path(__file__).resolve().parent.parent / "config" / "fiction-nlu-event-analysis-v1.json"
    event_config, event_config_sha = nlu5["load_config"](config_path)
    passage_rows, _scenes, _novels = load_database(db_root)
    passage_map = {row["passage_id"]: row for row in passage_rows}
    nlu5["validate_payload"](event_record.get("payload"), character_record, passage_map, event_config, event_config_sha)


def event_indexes(event_record: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, str]]:
    payload = event_record["payload"]
    mentions = {m["event_mention_id"]: m for m in payload["event_mentions"]}
    clusters = {c["event_id"]: c for c in payload["event_clusters"]}
    mention_to_event = {}
    for event_id, cluster in clusters.items():
        for mid in cluster["mention_ids"]:
            mention_to_event[mid] = event_id
    return mentions, clusters, mention_to_event


def cluster_passage_ids(cluster: dict[str, Any], mentions: dict[str, dict[str, Any]]) -> list[str]:
    return sorted({mentions[mid]["passage_id"] for mid in cluster["mention_ids"]})


def build_pair_candidates(
    event_record: dict[str, Any],
    passages: list[dict[str, Any]],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    mentions, clusters, _ = event_indexes(event_record)
    passage_order = {p["passage_id"]: i for i, p in enumerate(passages)}
    cluster_order = []
    for cluster in clusters.values():
        pids = cluster_passage_ids(cluster, mentions)
        idxs = [passage_order[pid] for pid in pids if pid in passage_order]
        if idxs:
            cluster_order.append((min(idxs), cluster["first_novel_offset"], cluster["event_id"]))
    cluster_order.sort()
    max_gap = int(config["pair_candidate_policy"]["max_passage_gap"])
    max_pairs = int(config["pair_candidate_policy"]["max_pairs_per_novel"])
    pairs = []
    for i, (_, _, event_a) in enumerate(cluster_order):
        for _, _, event_b in cluster_order[i + 1 :]:
            a_pids = cluster_passage_ids(clusters[event_a], mentions)
            b_pids = cluster_passage_ids(clusters[event_b], mentions)
            gap = min(abs(passage_order[a] - passage_order[b]) for a in a_pids for b in b_pids)
            if gap > max_gap:
                continue
            a, b = sorted([event_a, event_b])
            pids = sorted(set(a_pids + b_pids), key=lambda pid: passage_order[pid])
            pair_id = stable_id("ERP", {"novel_id": event_record["subject"]["id"], "event_a": a, "event_b": b})
            pairs.append({"pair_id": pair_id, "event_a": a, "event_b": b, "passage_ids": pids, "passage_gap": gap})
            if len(pairs) >= max_pairs:
                return pairs
    return pairs


def evidence_for_pair(
    pair: dict[str, Any],
    event_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    mentions, clusters, _ = event_indexes(event_record)
    chosen = []
    for event_id in [pair["event_a"], pair["event_b"]]:
        cluster = clusters[event_id]
        mid = cluster["canonical_mention_id"]
        mention = mentions[mid]
        passage = passages[mention["passage_id"]]
        ctx = mention["context_span"]
        chosen.append(
            {
                "passage_id": mention["passage_id"],
                "span_start": ctx["start"],
                "span_end": ctx["end"],
                "quote_sha256": sha256_text(passage["text"][ctx["start"]:ctx["end"]]),
                "event_mention_ids": [mid],
            }
        )
    if chosen[0]["passage_id"] == chosen[1]["passage_id"]:
        p = passages[chosen[0]["passage_id"]]
        start = min(chosen[0]["span_start"], chosen[1]["span_start"])
        end = max(chosen[0]["span_end"], chosen[1]["span_end"])
        return [{
            "passage_id": chosen[0]["passage_id"],
            "span_start": start,
            "span_end": end,
            "quote_sha256": sha256_text(p["text"][start:end]),
            "event_mention_ids": sorted(chosen[0]["event_mention_ids"] + chosen[1]["event_mention_ids"]),
        }]
    return chosen


def pair_text(pair: dict[str, Any], passages: dict[str, dict[str, Any]]) -> str:
    return "\n".join(passages[pid]["text"] for pid in pair["passage_ids"])


def canonical_positions(
    pair: dict[str, Any],
    event_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
) -> tuple[tuple[int, str], tuple[int, str]]:
    mentions, clusters, _ = event_indexes(event_record)
    out = []
    for event_id in [pair["event_a"], pair["event_b"]]:
        m = mentions[clusters[event_id]["canonical_mention_id"]]
        p = passages[m["passage_id"]]
        out.append((p["char_start"] + m["trigger"]["start"], event_id))
    return out[0], out[1]


def cue_present(text: str, cues: list[str]) -> bool:
    return any(cue in text for cue in cues)


def heuristic_pair_decision(
    pair: dict[str, Any],
    event_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
) -> dict[str, Any]:
    text = pair_text(pair, passages)
    cues = config["heuristic_cues"]
    first, second = sorted(canonical_positions(pair, event_record, passages))
    first_event, second_event = first[1], second[1]
    temporal = {"label": "unknown", "score": 0.45}
    if cue_present(text, cues["simultaneous"]):
        temporal = {"label": "simultaneous", "score": 0.92}
    elif cue_present(text, cues["overlap"]):
        temporal = {"label": "overlaps", "score": 0.88}
    elif cue_present(text, cues["temporal_before"]) or cue_present(text, cues["causes"] + cues["enables"] + cues["prevents"]):
        temporal = {"label": "before", "score": 0.90, "source_event_id": first_event, "target_event_id": second_event}

    causal = []
    for label, cue_key, score in [
        ("causal.causes", "causes", 0.94),
        ("causal.enables", "enables", 0.92),
        ("causal.prevents", "prevents", 0.94),
    ]:
        if cue_present(text, cues[cue_key]):
            causal.append({"relation_type": label, "source_event_id": first_event, "target_event_id": second_event, "score": score})
    return {"temporal": temporal, "causal": causal}


def ollama_pair_decision(
    pair: dict[str, Any],
    event_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    *,
    model: str,
    url: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    mentions, clusters, _ = event_indexes(event_record)
    events = []
    for event_id in [pair["event_a"], pair["event_b"]]:
        cluster = clusters[event_id]
        m = mentions[cluster["canonical_mention_id"]]
        p = passages[m["passage_id"]]
        ctx = m["context_span"]
        events.append({
            "event_id": event_id,
            "event_type": cluster["event_type"],
            "trigger": m["trigger"]["surface"],
            "context": p["text"][ctx["start"]:ctx["end"]],
        })
    response_schema = {
        "type":"object",
        "properties":{
            "temporal":{"type":"object","properties":{"label":{"type":"string","enum":config["temporal"]["labels"]},"score":{"type":"number","minimum":0,"maximum":1}},"required":["label","score"]},
            "causal":{"type":"array","items":{"type":"object","properties":{"relation_type":{"type":"string","enum":config["causal"]["labels"]},"source_event_id":{"type":"string"},"target_event_id":{"type":"string"},"score":{"type":"number","minimum":0,"maximum":1}},"required":["relation_type","source_event_id","target_event_id","score"]}}
        },
        "required":["temporal","causal"]
    }
    prompt = {
        "events": events,
        "passages": [{"passage_id":pid,"text":passages[pid]["text"]} for pid in pair["passage_ids"]],
        "rules":[
            "The temporal label always describes events[0] relative to events[1]: before means events[0] is before events[1], after means events[0] is after events[1].",
            "Narrative mention order is not temporal truth.",
            "Use unknown when temporal relation is not textually supported.",
            "Causal relations require explicit or strongly entailed evidence; prefer no causal relation over guessing.",
            "Do not infer plot importance."
        ]
    }
    payload={
        "model":model,"stream":False,"format":response_schema,"think":bool(config["provider_policy"].get("think",False)),
        "messages":[{"role":"system","content":"Classify bounded relations between two already extracted fiction events. JSON only. No chain-of-thought."},{"role":"user","content":json.dumps(prompt,ensure_ascii=False)}],
        "options":{"temperature":0,"num_predict":900}
    }
    req=urllib.request.Request(url.rstrip("/")+"/api/chat",data=json.dumps(payload,ensure_ascii=False).encode("utf-8"),headers={"Content-Type":"application/json"},method="POST")
    try:
        with urllib.request.urlopen(req,timeout=timeout_seconds) as response:
            raw=json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError,TimeoutError,json.JSONDecodeError) as exc:
        raise Nlu6Error(f"ollama provider failed: {exc}") from exc
    content=((raw.get("message") or {}).get("content") or "").strip()
    require(content,"ollama returned empty content")
    value=json.loads(content)
    require(isinstance(value,dict),"ollama relation response must be object")
    return value


def relation_id(kind: str, pair_id: str, relation_type: str, source: str, target: str) -> str:
    return stable_id("ERL",{"kind":kind,"pair_id":pair_id,"relation_type":relation_type,"source_event_id":source,"target_event_id":target})


def normalize_decision(
    pair: dict[str, Any],
    decision: dict[str, Any],
    event_record: dict[str, Any],
    passages: dict[str, dict[str, Any]],
    config: dict[str, Any],
    source_name: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    evidence=evidence_for_pair(pair,event_record,passages)
    temporal_rows=[]
    causal_rows=[]
    t=decision.get("temporal") or {}
    label=t.get("label")
    score=t.get("score")
    if isinstance(score,(int,float)) and not isinstance(score,bool) and math.isfinite(score) and score>=float(config["temporal"]["threshold"]) and label in {"before","after","overlaps","simultaneous"}:
        if label in {"before","after"}:
            if "source_event_id" in t and "target_event_id" in t:
                s,tgt=t["source_event_id"],t["target_event_id"]
                if label=="after":
                    s,tgt=tgt,s
            else:
                # Provider labels are defined as event_a relative to event_b.
                # Never substitute narrative/Passage order for story-time direction.
                if label=="before":
                    s,tgt=pair["event_a"],pair["event_b"]
                else:
                    s,tgt=pair["event_b"],pair["event_a"]
            relation_type="temporal.before"
        else:
            s,tgt=sorted([pair["event_a"],pair["event_b"]])
            relation_type="temporal."+label
        if s in {pair["event_a"],pair["event_b"]} and tgt in {pair["event_a"],pair["event_b"]} and s!=tgt:
            temporal_rows.append({
                "relation_id":relation_id("temporal",pair["pair_id"],relation_type,s,tgt),
                "pair_id":pair["pair_id"],"relation_type":relation_type,"source_event_id":s,"target_event_id":tgt,
                "score":round(float(score),6),"threshold":float(config["temporal"]["threshold"]),"source":source_name,
                "evidence":evidence,"normalized_from":label
            })

    for row in decision.get("causal") or []:
        if not isinstance(row,dict): continue
        typ=row.get("relation_type"); s=row.get("source_event_id"); tgt=row.get("target_event_id"); score=row.get("score")
        if typ not in config["causal"]["labels"] or s==tgt or {s,tgt}!={pair["event_a"],pair["event_b"]}: continue
        if not isinstance(score,(int,float)) or isinstance(score,bool) or not math.isfinite(score) or score<float(config["causal"]["threshold"]): continue
        causal_rows.append({
            "relation_id":relation_id("causal",pair["pair_id"],typ,s,tgt),
            "pair_id":pair["pair_id"],"relation_type":typ,"source_event_id":s,"target_event_id":tgt,
            "score":round(float(score),6),"threshold":float(config["causal"]["threshold"]),"source":source_name,"evidence":evidence
        })
    return temporal_rows,causal_rows


def count_before_cycles(rows: list[dict[str, Any]]) -> int:
    graph: dict[str,set[str]]=defaultdict(set)
    nodes=set()
    for row in rows:
        if row["relation_type"]=="temporal.before":
            graph[row["source_event_id"]].add(row["target_event_id"])
            nodes.add(row["source_event_id"]); nodes.add(row["target_event_id"])
    state={}
    cycles=0
    def visit(node: str) -> None:
        nonlocal cycles
        state[node]=1
        for nxt in graph[node]:
            if state.get(nxt)==1:
                cycles+=1
            elif state.get(nxt,0)==0:
                visit(nxt)
        state[node]=2
    for node in sorted(nodes):
        if state.get(node,0)==0: visit(node)
    return cycles


def causal_temporal_warnings(temporal_rows: list[dict[str, Any]], causal_rows: list[dict[str, Any]]) -> list[str]:
    before={(r["source_event_id"],r["target_event_id"]) for r in temporal_rows if r["relation_type"]=="temporal.before"}
    warnings=[]
    for row in causal_rows:
        if (row["target_event_id"],row["source_event_id"]) in before:
            warnings.append(f'causal_temporal_conflict:{row["relation_id"]}')
    return warnings


def build_payload(
    event_record: dict[str, Any],
    passages: list[dict[str, Any]],
    config: dict[str, Any],
    config_sha: str,
    *,
    provider: str,
    model: str | None,
    ollama_url: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    passage_map={p["passage_id"]:p for p in passages}
    pairs=build_pair_candidates(event_record,passages,config)
    temporal=[]; causal=[]
    for pair in pairs:
        if provider=="heuristic":
            decision=heuristic_pair_decision(pair,event_record,passage_map,config)
        elif provider=="ollama":
            require(model,"--model is required for ollama provider")
            decision=ollama_pair_decision(pair,event_record,passage_map,config,model=model,url=ollama_url,timeout_seconds=timeout_seconds)
        else:
            raise Nlu6Error(f"unsupported provider: {provider}")
        t,c=normalize_decision(pair,decision,event_record,passage_map,config,"heuristic" if provider=="heuristic" else "model")
        temporal.extend(t); causal.extend(c)
    temporal=sorted({r["relation_id"]:r for r in temporal}.values(),key=lambda r:r["relation_id"])
    causal=sorted({r["relation_id"]:r for r in causal}.values(),key=lambda r:r["relation_id"])
    cycles=count_before_cycles(temporal)
    warnings=causal_temporal_warnings(temporal,causal)
    errors=[]
    if cycles:
        errors.append(f"strict_before_cycle_count:{cycles}")
    if warnings:
        errors.extend(warnings)
    return {
        "schema_version":PAYLOAD_VERSION,"config_version":CONFIG_VERSION,"config_sha256":config_sha,
        "assertion_scope":config["assertion_scope"],
        "provider":{"name":provider,"model":model,"request_version":REQUEST_VERSION},
        "scope":{"novel_id":event_record["subject"]["id"],"event_analysis_id":event_record["analysis_id"],"complete_temporal_graph_claim":False,"complete_causal_graph_claim":False,"narrative_order_used_as_story_time":False},
        "event_registry_sha256":event_registry_sha256(event_record),
        "pair_candidates":pairs,"temporal_relations":temporal,"causal_relations":causal,
        "consistency":{"valid":not errors,"errors":errors,"warnings":[],"strict_before_cycle_count":cycles}
    }


def validate_evidence(items: list[dict[str, Any]], source_event: str, target_event: str, event_record: dict[str, Any], passages: dict[str, dict[str, Any]]) -> None:
    mentions,clusters,_=event_indexes(event_record)
    covered=set()
    for item in items:
        p=passages.get(item["passage_id"]); require(p is not None,"relation evidence passage missing")
        start,end=item["span_start"],item["span_end"]
        require(0<=start<end<=len(p["text"]),"bad relation evidence span")
        require(item["quote_sha256"]==sha256_text(p["text"][start:end]),"relation evidence hash mismatch")
        for mid in item["event_mention_ids"]:
            m=mentions.get(mid); require(m is not None,"relation evidence event mention missing")
            require(m["passage_id"]==item["passage_id"],"relation evidence mention passage mismatch")
            covered.add(next((eid for eid,c in clusters.items() if mid in c["mention_ids"]),None))
    require(source_event in covered and target_event in covered,"relation evidence does not cover both events")


def validate_payload(payload: dict[str, Any], event_record: dict[str, Any], passages: dict[str, dict[str, Any]], config: dict[str, Any], config_sha: str) -> None:
    require(payload.get("schema_version")==PAYLOAD_VERSION,"payload schema_version mismatch")
    require(payload.get("config_version")==CONFIG_VERSION,"payload config_version mismatch")
    require(payload.get("config_sha256")==config_sha,"payload config_sha256 mismatch")
    require(payload.get("assertion_scope")==config["assertion_scope"],"payload assertion_scope mismatch")
    scope=payload.get("scope") or {}
    require(scope.get("novel_id")==event_record["subject"]["id"],"novel lineage mismatch")
    require(scope.get("event_analysis_id")==event_record["analysis_id"],"event lineage mismatch")
    require(scope.get("complete_temporal_graph_claim") is False,"NLU-6 may not claim complete temporal graph")
    require(scope.get("complete_causal_graph_claim") is False,"NLU-6 may not claim complete causal graph")
    require(scope.get("narrative_order_used_as_story_time") is False,"narrative order cannot be asserted as story time")
    require(payload.get("event_registry_sha256")==event_registry_sha256(event_record),"event registry hash mismatch")
    pairs={p["pair_id"]:p for p in payload.get("pair_candidates") or []}
    require(len(pairs)==len(payload.get("pair_candidates") or []),"duplicate pair_id")
    _,clusters,_=event_indexes(event_record)
    seen=set()
    for row in (payload.get("temporal_relations") or [])+(payload.get("causal_relations") or []):
        require(row["relation_id"] not in seen,"duplicate relation_id"); seen.add(row["relation_id"])
        pair=pairs.get(row["pair_id"]); require(pair is not None,"relation pair missing")
        require(row["source_event_id"] in clusters and row["target_event_id"] in clusters,"unknown relation event")
        require({row["source_event_id"],row["target_event_id"]}=={pair["event_a"],pair["event_b"]},"relation event pair mismatch")
        validate_evidence(row["evidence"],row["source_event_id"],row["target_event_id"],event_record,passages)
        expected=relation_id("temporal" if row["relation_type"].startswith("temporal.") else "causal",row["pair_id"],row["relation_type"],row["source_event_id"],row["target_event_id"])
        require(row["relation_id"]==expected,"non-deterministic relation_id")
        require(row["score"]>=row["threshold"],"stored relation below threshold")
    temporal=payload.get("temporal_relations") or []
    require(count_before_cycles(temporal)==0,"strict temporal.before cycle")
    warnings=causal_temporal_warnings(temporal,payload.get("causal_relations") or [])
    require(not warnings,f"causal/temporal conflict: {warnings}")
    consistency=payload.get("consistency") or {}
    require(consistency.get("valid") is True,f"consistency failed: {consistency.get('errors')}")


def build_record(event_record: dict[str, Any], payload: dict[str, Any], *, provider: str, model: str | None, nlu0: dict[str, Any]) -> dict[str, Any]:
    evidence=list(event_record.get("evidence") or [])
    require(evidence,"event dependency must retain analysis evidence")
    scores=[r["score"] for r in payload["temporal_relations"]+payload["causal_relations"]]
    record={
        "analysis_id":"ANL-0000000000000000","schema_version":"fiction_nlu_analysis_record_v1",
        "analysis_kind":"event_relation","analysis_version":ANALYSIS_VERSION,"status":"provisional",
        "subject":event_record["subject"],
        "method":{"type":"hybrid","name":"fiction-sample-nlu-event-relation-v1","version":"1","model_id":model},
        "confidence":round(sum(scores)/len(scores),6) if scores else None,
        "evidence":evidence,
        "provenance":{"created_at":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),"producer":f"fiction-sample-nlu-event-relation-v1:{provider}","input_sha256":sha256_text(canonical_json({"event_analysis_id":event_record["analysis_id"],"event_registry_sha256":payload["event_registry_sha256"]})),"code_sha256":sha256_bytes(Path(__file__).read_bytes()),"model_sha256":None,"notes":"NLU-6 provisional temporal/causal event relations; narrative order is not story-time truth."},
        "retrieval_admission":{"state":"not_admitted","contract_version":RETRIEVAL_CONTRACT_VERSION,"notes":"NLU-only development; no Retrieval v2 dependency."},
        "payload":payload
    }
    record["analysis_id"]=nlu0["deterministic_analysis_id"](record)
    return record


def command_extract(args: argparse.Namespace) -> int:
    db_root=Path(args.db_root); config,config_sha=load_config(Path(args.config)); nlu0,nlu2,nlu5=load_dependencies(Path(__file__).resolve().parent)
    passages,_scenes,novels=load_database(db_root); passage_map={p["passage_id"]:p for p in passages}
    chars={(r.get("subject") or {}).get("id"):r for r in load_jsonl(Path(args.character_resolution))}
    events=load_jsonl(Path(args.event_analysis))
    if args.novel_id:
        wanted=set(args.novel_id); events=[r for r in events if (r.get("subject") or {}).get("id") in wanted]
    if args.limit_novels is not None: events=events[:args.limit_novels]
    out=Path(args.output); existing=set()
    if out.exists():
        existing={(r.get("subject") or {}).get("id") for r in load_jsonl(out) if r.get("analysis_kind")=="event_relation" and r.get("analysis_version")==ANALYSIS_VERSION}
    checkpoint_path=Path(args.checkpoint) if args.checkpoint else None
    checkpoint={"schema_version":"fiction_nlu_event_relation_checkpoint_v1","completed":{},"errors":{}}
    if checkpoint_path and checkpoint_path.exists(): checkpoint=load_json(checkpoint_path)
    database=nlu0["load_database"](db_root)
    summary={"selected":len(events),"written":0,"skipped":0,"pair_candidates":0,"temporal_relations":0,"causal_relations":0,"errors":0}
    for event_record in events:
        novel_id=(event_record.get("subject") or {}).get("id")
        if novel_id in existing or novel_id in checkpoint["completed"]:
            summary["skipped"]+=1; continue
        try:
            require(novel_id in novels,f"event record novel missing: {novel_id}")
            char=chars.get(novel_id); require(char is not None,f"missing character dependency for {novel_id}")
            validate_event_dependency(event_record,char,db_root=db_root,nlu0=nlu0,nlu2=nlu2,nlu5=nlu5)
            selected=[p for p in passages if p["novel_id"]==novel_id]
            payload=build_payload(event_record,selected,config,config_sha,provider=args.provider,model=args.model,ollama_url=args.ollama_url,timeout_seconds=args.timeout_seconds)
            validate_payload(payload,event_record,passage_map,config,config_sha)
            record=build_record(event_record,payload,provider=args.provider,model=args.model,nlu0=nlu0)
            nlu0["validate_record"](record,database,allow_retrieval_admission=False)
            append_jsonl(out,record)
            checkpoint["completed"][novel_id]={"analysis_id":record["analysis_id"],"event_analysis_id":event_record["analysis_id"],"completed_at":datetime.now(timezone.utc).isoformat().replace("+00:00","Z")}
            checkpoint["errors"].pop(novel_id,None)
            summary["written"]+=1; summary["pair_candidates"]+=len(payload["pair_candidates"]); summary["temporal_relations"]+=len(payload["temporal_relations"]); summary["causal_relations"]+=len(payload["causal_relations"])
        except Exception as exc:
            checkpoint["errors"][novel_id or "<unknown>"]=str(exc); summary["errors"]+=1
            if not args.continue_on_error:
                if checkpoint_path: write_json_atomic(checkpoint_path,checkpoint)
                raise
        if checkpoint_path: write_json_atomic(checkpoint_path,checkpoint)
    print(json.dumps(summary,ensure_ascii=False,sort_keys=True)); return 0 if not summary["errors"] else 1


def command_validate(args: argparse.Namespace) -> int:
    db_root=Path(args.db_root); config,config_sha=load_config(Path(args.config)); nlu0,nlu2,nlu5=load_dependencies(Path(__file__).resolve().parent)
    passages,_scenes,_novels=load_database(db_root); passage_map={p["passage_id"]:p for p in passages}
    chars={(r.get("subject") or {}).get("id"):r for r in load_jsonl(Path(args.character_resolution))}
    events={(r.get("subject") or {}).get("id"):r for r in load_jsonl(Path(args.event_analysis))}
    database=nlu0["load_database"](db_root); rows=load_jsonl(Path(args.input)); errors=[]; valid=0
    for line_number,record in enumerate(rows,1):
        try:
            nlu0["validate_record"](record,database,allow_retrieval_admission=False)
            require(record.get("analysis_kind")=="event_relation","record is not event_relation")
            require(record.get("analysis_version")==ANALYSIS_VERSION,"analysis_version mismatch")
            novel_id=(record.get("subject") or {}).get("id"); event_record=events.get(novel_id); char=chars.get(novel_id)
            require(event_record is not None and char is not None,f"missing dependency for {novel_id}")
            validate_event_dependency(event_record,char,db_root=db_root,nlu0=nlu0,nlu2=nlu2,nlu5=nlu5)
            validate_payload(record.get("payload"),event_record,passage_map,config,config_sha); valid+=1
        except Exception as exc: errors.append({"line":line_number,"error":str(exc)})
    report={"schema_version":"fiction_nlu_event_relation_validation_report_v1","record_count":len(rows),"valid_count":valid,"error_count":len(errors),"errors":errors}
    print(json.dumps(report,ensure_ascii=False,indent=2,sort_keys=True)); return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser=argparse.ArgumentParser(description="NLU-6 evidence-backed temporal and causal event relations.")
    sub=parser.add_subparsers(dest="command",required=True)
    ext=sub.add_parser("extract")
    for name in ["db-root","config","character-resolution","event-analysis","output"]: ext.add_argument("--"+name,required=True)
    ext.add_argument("--checkpoint"); ext.add_argument("--provider",choices=["heuristic","ollama"],default="heuristic"); ext.add_argument("--model"); ext.add_argument("--ollama-url",default="http://127.0.0.1:11434"); ext.add_argument("--timeout-seconds",type=int,default=120); ext.add_argument("--novel-id",action="append"); ext.add_argument("--limit-novels",type=int); ext.add_argument("--continue-on-error",action="store_true"); ext.set_defaults(func=command_extract)
    val=sub.add_parser("validate")
    for name in ["db-root","config","character-resolution","event-analysis","input"]: val.add_argument("--"+name,required=True)
    val.set_defaults(func=command_validate)
    return parser


def main() -> int:
    args=build_parser().parse_args()
    try: return args.func(args)
    except (Nlu6Error,OSError,json.JSONDecodeError) as exc:
        print(json.dumps({"error":str(exc)},ensure_ascii=False),file=sys.stderr); return 2


if __name__=="__main__":
    raise SystemExit(main())
