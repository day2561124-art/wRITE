import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const nlu2Script = path.join(rootDir, "scripts", "fiction-sample-nlu-character-resolve-v1.py");
const nlu2Config = path.join(rootDir, "config", "fiction-nlu-character-resolution-v1.json");
const nlu5Script = path.join(rootDir, "scripts", "fiction-sample-nlu-event-extract-v1.py");
const nlu5Config = path.join(rootDir, "config", "fiction-nlu-event-analysis-v1.json");
const nlu6Script = path.join(rootDir, "scripts", "fiction-sample-nlu-event-relation-v1.py");
const nlu6Config = path.join(rootDir, "config", "fiction-nlu-event-relation-v1.json");
const nlu6Schema = path.join(rootDir, "schemas", "fiction-nlu-event-relation-v1.schema.json");

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function runPython(args, { expectCode = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const python = process.platform === "win32" ? "python" : "python3";
    const child = spawn(python, args, {
      cwd: rootDir,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("NLU-6 test timed out"));
    }, 60_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === expectCode) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error("python exited " + code + ", expected " + expectCode + "\n" + stdout + "\n" + stderr));
      }
    });
  });
}

async function buildFixture(texts) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu6-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  let cursor = 0;
  const passages = texts.map((text, index) => {
    const row = {
      passage_id: "PAS-" + String(index + 1).repeat(16),
      scene_id: "SCN-" + String(index + 1).repeat(16),
      novel_id: "NOV-AAAAAAAAAAAAAAAA",
      source_id: "SRC-BBBBBBBBBBBBBBBB",
      source_order: index + 1,
      char_start: cursor,
      char_end: cursor + text.length,
      text,
      content_sha256: sha256(text),
      status: "accepted",
    };
    cursor = row.char_end + 1;
    return row;
  });
  const scenes = passages.map((p) => ({
    scene_id: p.scene_id,
    novel_id: p.novel_id,
    source_order: p.source_order,
    char_start: p.char_start,
    char_end: p.char_end,
    scene_hash: p.content_sha256,
  }));
  const novel = {
    novel_id: "NOV-AAAAAAAAAAAAAAAA",
    source_id: "SRC-BBBBBBBBBBBBBBBB",
    author_id: "AUT-CCCCCCCCCCCCCCCC",
    title: "event relation fixture",
    language: "zh-Hant",
    text: {
      char_count: cursor,
      text_sha256: sha256(texts.join("\n")),
    },
  };

  await writeFile(path.join(records, "passages_v1.jsonl"), passages.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "scenes_v1.jsonl"), scenes.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "novels_v1.jsonl"), JSON.stringify(novel) + "\n", "utf8");
  return { temp };
}

async function buildDependencies(fixture) {
  const characters = path.join(fixture.temp, "characters.jsonl");
  const events = path.join(fixture.temp, "events.jsonl");

  await runPython([
    nlu2Script, "resolve",
    "--db-root", fixture.temp,
    "--config", nlu2Config,
    "--output", characters,
    "--provider", "heuristic",
    "--seed-name", "安達",
    "--seed-name", "島村",
    "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
  ]);

  await runPython([
    nlu5Script, "extract",
    "--db-root", fixture.temp,
    "--config", nlu5Config,
    "--character-resolution", characters,
    "--output", events,
    "--provider", "heuristic",
  ]);
  return { characters, events };
}

test("NLU-6 config/schema prohibit complete graph claims and narrative-order-as-story-time", async () => {
  const config = JSON.parse(await readFile(nlu6Config, "utf8"));
  const schema = JSON.parse(await readFile(nlu6Schema, "utf8"));
  assert.equal(config.config_version, "fiction_nlu_event_relation_v1");
  assert.equal(config.temporal.narrative_order_is_not_story_time, true);
  assert.equal(config.temporal.enforce_acyclic_strict_order, true);
  assert.equal(config.causal.hallucination_guard, "explicit_or_strongly_entailed_evidence_required");
  assert.equal(schema.properties.scope.properties.complete_temporal_graph_claim.const, false);
  assert.equal(schema.properties.scope.properties.complete_causal_graph_claim.const, false);
  assert.equal(schema.properties.scope.properties.narrative_order_used_as_story_time.const, false);
});

test("NLU-6 does not turn bare narrative order into story-time order", async () => {
  const fixture = await buildFixture([
    "安達打開門。",
    "島村進入教室。",
  ]);
  const output = path.join(fixture.temp, "relations.jsonl");
  try {
    const { characters, events } = await buildDependencies(fixture);
    const { stdout } = await runPython([
      nlu6Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", events,
      "--output", output,
      "--provider", "heuristic",
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.pair_candidates >= 1);
    assert.equal(summary.temporal_relations, 0);
    assert.equal(summary.causal_relations, 0);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.payload.scope.narrative_order_used_as_story_time, false);
    assert.equal(record.payload.temporal_relations.length, 0);
    assert.equal(record.payload.causal_relations.length, 0);

    const validation = await runPython([
      nlu6Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", events,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("explicit causal cue can yield compatible temporal.before plus causal.causes with evidence covering both events", async () => {
  const fixture = await buildFixture([
    "安達打開門。",
    "因此島村進入教室。",
  ]);
  const output = path.join(fixture.temp, "relations.jsonl");
  const checkpoint = path.join(fixture.temp, "relations-checkpoint.json");
  try {
    const { characters, events } = await buildDependencies(fixture);
    const { stdout } = await runPython([
      nlu6Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", events,
      "--output", output,
      "--checkpoint", checkpoint,
      "--provider", "heuristic",
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.temporal_relations >= 1);
    assert.ok(summary.causal_relations >= 1);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const before = record.payload.temporal_relations.find((r) => r.relation_type === "temporal.before");
    const causes = record.payload.causal_relations.find((r) => r.relation_type === "causal.causes");
    assert.ok(before);
    assert.ok(causes);
    assert.equal(before.source_event_id, causes.source_event_id);
    assert.equal(before.target_event_id, causes.target_event_id);
    assert.ok(before.evidence.length >= 1);
    assert.ok(causes.evidence.length >= 1);
    assert.equal(record.payload.consistency.valid, true);
    assert.equal(record.payload.consistency.strict_before_cycle_count, 0);

    const validation = await runPython([
      nlu6Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", events,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await runPython([
      nlu6Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", events,
      "--output", output,
      "--checkpoint", checkpoint,
      "--provider", "heuristic",
    ]);
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects stale NLU-5 event registry lineage", async () => {
  const fixture = await buildFixture([
    "安達打開門。",
    "因此島村進入教室。",
  ]);
  const output = path.join(fixture.temp, "relations.jsonl");
  const tamperedEvents = path.join(fixture.temp, "events-tampered.jsonl");
  try {
    const { characters, events } = await buildDependencies(fixture);
    await runPython([
      nlu6Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", events,
      "--output", output,
      "--provider", "heuristic",
    ]);

    const eventRecord = JSON.parse((await readFile(events, "utf8")).trim());
    assert.ok(eventRecord.payload.event_mentions.length > 0);
    eventRecord.payload.event_mentions[0].confidence =
      eventRecord.payload.event_mentions[0].confidence >= 0.99
        ? eventRecord.payload.event_mentions[0].confidence - 0.01
        : eventRecord.payload.event_mentions[0].confidence + 0.01;
    await writeFile(tamperedEvents, JSON.stringify(eventRecord) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu6Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu6Config,
      "--character-resolution", characters,
      "--event-analysis", tamperedEvents,
      "--input", output,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.ok(
      /analysis_id must be deterministic|event registry hash mismatch/u.test(report.errors[0].error),
      report.errors[0].error,
    );
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("provider after label is normalized from event-a/event-b semantics, never narrative order", async () => {
  const pythonCode = [
    "import json,runpy",
    "from pathlib import Path",
    "m=runpy.run_path(r'" + nlu6Script.replaceAll("\\", "\\\\") + "')",
    "c=json.loads(Path(r'" + nlu6Config.replaceAll("\\", "\\\\") + "').read_text(encoding='utf-8'))",
    "A='EVT-'+'A'*16; B='EVT-'+'B'*16; MA='EVM-'+'A'*16; MB='EVM-'+'B'*16; P='PAS-'+'1'*16",
    "pair={'pair_id':'ERP-'+'1'*16,'event_a':A,'event_b':B,'passage_ids':[P],'passage_gap':0}",
    "record={'subject':{'id':'NOV-'+'A'*16},'payload':{'event_mentions':[{'event_mention_id':MA,'passage_id':P,'context_span':{'start':0,'end':2}},{'event_mention_id':MB,'passage_id':P,'context_span':{'start':2,'end':4}}],'event_clusters':[{'event_id':A,'canonical_mention_id':MA,'mention_ids':[MA]},{'event_id':B,'canonical_mention_id':MB,'mention_ids':[MB]}],'coreference_links':[],'scope':{},'entity_registry_sha256':'0'*64}}",
    "passages={P:{'passage_id':P,'novel_id':'NOV-'+'A'*16,'char_start':0,'text':'甲乙丙丁'}}",
    "temporal,causal=m['normalize_decision'](pair,{'temporal':{'label':'after','score':0.95},'causal':[]},record,passages,c,'model')",
    "print(json.dumps({'source':temporal[0]['source_event_id'],'target':temporal[0]['target_event_id'],'normalized_from':temporal[0]['normalized_from']}))",
  ].join(";");
  const { stdout } = await runPython(["-c", pythonCode]);
  const result = JSON.parse(stdout.trim());
  assert.equal(result.source, "EVT-" + "B".repeat(16));
  assert.equal(result.target, "EVT-" + "A".repeat(16));
  assert.equal(result.normalized_from, "after");
});

test("strict temporal.before cycle detector rejects globally inconsistent order", async () => {
  const pythonCode = [
    "import json,runpy",
    "m=runpy.run_path(r'" + nlu6Script.replaceAll("\\", "\\\\") + "')",
    "A='EVT-'+'A'*16; B='EVT-'+'B'*16; C='EVT-'+'C'*16",
    "rows=[{'relation_type':'temporal.before','source_event_id':A,'target_event_id':B},{'relation_type':'temporal.before','source_event_id':B,'target_event_id':C},{'relation_type':'temporal.before','source_event_id':C,'target_event_id':A}]",
    "print(json.dumps({'cycles':m['count_before_cycles'](rows)}))",
  ].join(";");
  const { stdout } = await runPython(["-c", pythonCode]);
  const result = JSON.parse(stdout.trim());
  assert.ok(result.cycles >= 1);
});
