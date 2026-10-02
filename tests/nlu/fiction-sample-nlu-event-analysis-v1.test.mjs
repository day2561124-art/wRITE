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
const nlu5Schema = path.join(rootDir, "schemas", "fiction-nlu-event-analysis-v1.schema.json");

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
      reject(new Error("NLU-5 test timed out"));
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

async function buildFixture() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu5-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const texts = [
    "安達走進教室。",
    "島村看向安達。",
    "安達對島村說晚安。",
    "安達說早安。",
    "安達說晚安。",
  ];
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
    title: "event fixture",
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

async function createCharacterResolution(fixture) {
  const output = path.join(fixture.temp, "characters.jsonl");
  await runPython([
    nlu2Script, "resolve",
    "--db-root", fixture.temp,
    "--config", nlu2Config,
    "--output", output,
    "--provider", "heuristic",
    "--seed-name", "安達",
    "--seed-name", "島村",
    "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
  ]);
  return output;
}

test("NLU-5 config/schema keep event inventory provisional and temporal/causal relations unresolved", async () => {
  const config = JSON.parse(await readFile(nlu5Config, "utf8"));
  const schema = JSON.parse(await readFile(nlu5Schema, "utf8"));
  assert.equal(config.config_version, "fiction_nlu_event_analysis_v1");
  assert.equal(config.coreference_policy.singleton_default, true);
  assert.equal(config.coreference_policy.automatic_exact_trigger_merge, false);
  assert.equal(schema.properties.scope.properties.complete_event_inventory_claim.const, false);
  assert.equal(schema.properties.scope.properties.temporal_relations_resolved.const, false);
  assert.equal(schema.properties.scope.properties.causal_relations_resolved.const, false);
});

test("NLU-5 consumes NLU-2 grounding and leaves repeated similar events as singleton clusters without explicit coref", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "events.jsonl");
  const checkpoint = path.join(fixture.temp, "events-checkpoint.json");
  try {
    const characters = await createCharacterResolution(fixture);
    const { stdout } = await runPython([
      nlu5Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu5Config,
      "--character-resolution", characters,
      "--output", output,
      "--checkpoint", checkpoint,
      "--provider", "heuristic",
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.event_mentions >= 5);
    assert.equal(summary.event_clusters, summary.event_mentions);
    assert.equal(summary.coreference_links, 0);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.analysis_kind, "event");
    assert.equal(record.analysis_version, "event_analysis_v1");
    assert.equal(record.status, "provisional");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(record.payload.scope.complete_event_inventory_claim, false);
    assert.equal(record.payload.scope.temporal_relations_resolved, false);
    assert.equal(record.payload.scope.causal_relations_resolved, false);
    assert.equal(record.payload.consistency.valid, true);

    const communications = record.payload.event_mentions.filter((m) => m.event_type === "event.communication");
    assert.ok(communications.length >= 3);
    assert.ok(communications.some((m) => m.arguments.some((a) => a.entity_id !== null)));

    const validation = await runPython([
      nlu5Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu5Config,
      "--character-resolution", characters,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await runPython([
      nlu5Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu5Config,
      "--character-resolution", characters,
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

test("bounded coref merge requires explicit high-confidence decision and shared grounded participant", async () => {
  const pythonCode = [
    "import json,runpy",
    "from pathlib import Path",
    "m=runpy.run_path(r'" + nlu5Script.replaceAll("\\", "\\\\") + "')",
    "c=json.loads(Path(r'" + nlu5Config.replaceAll("\\", "\\\\") + "').read_text(encoding='utf-8'))",
    "p1={'passage_id':'PAS-'+'1'*16,'novel_id':'NOV-'+'A'*16,'char_start':0,'text':'安達離開教室。'}",
    "p2={'passage_id':'PAS-'+'2'*16,'novel_id':'NOV-'+'A'*16,'char_start':20,'text':'安達離開教室這件事被再次提起。'}",
    "eid='CHR-'+'1'*16",
    "ev=lambda mid,pid,start: {'event_mention_id':mid,'event_type':'event.movement','passage_id':pid,'scene_id':None,'confidence':0.95,'trigger':{'surface':'離開','start':start,'end':start+2,'quote_sha256':m['sha256_text']('離開')},'context_span':{'start':0,'end':8},'context_sha256':'x','arguments':[{'role':'actor','surface':'安達','passage_span':{'start':0,'end':2},'entity_id':eid,'mention_id':'MEN-'+'1'*16}],'source':'model'}",
    "a='EVM-'+'1'*16; b='EVM-'+'2'*16",
    "mentions=[ev(a,p1['passage_id'],2),ev(b,p2['passage_id'],2)]",
    "passages={p1['passage_id']:p1,p2['passage_id']:p2}",
    "single=m['cluster_mentions'](mentions,passages,c,decisions=[])",
    "merged=m['cluster_mentions'](mentions,passages,c,decisions=[{'mention_a':a,'mention_b':b,'same_event':True,'confidence':0.96}])",
    "weak=m['cluster_mentions'](mentions,passages,c,decisions=[{'mention_a':a,'mention_b':b,'same_event':True,'confidence':0.50}])",
    "print(json.dumps({'single_clusters':len(single[0]),'single_links':len(single[1]),'merged_clusters':len(merged[0]),'merged_links':len(merged[1]),'weak_clusters':len(weak[0]),'weak_links':len(weak[1])}))",
  ].join(";");

  const { stdout } = await runPython(["-c", pythonCode]);
  const result = JSON.parse(stdout.trim());
  assert.equal(result.single_clusters, 2);
  assert.equal(result.single_links, 0);
  assert.equal(result.merged_clusters, 1);
  assert.equal(result.merged_links, 1);
  assert.equal(result.weak_clusters, 2);
  assert.equal(result.weak_links, 0);
});

test("validator rejects a multi-mention event cluster without connecting coreference evidence", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "events.jsonl");
  const tampered = path.join(fixture.temp, "events-tampered.jsonl");
  try {
    const characters = await createCharacterResolution(fixture);
    await runPython([
      nlu5Script, "extract",
      "--db-root", fixture.temp,
      "--config", nlu5Config,
      "--character-resolution", characters,
      "--output", output,
      "--provider", "heuristic",
    ]);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const communications = record.payload.event_mentions.filter((m) => m.event_type === "event.communication");
    assert.ok(communications.length >= 2);
    const a = communications[0];
    const b = communications[1];
    const firstCluster = record.payload.event_clusters.find((c) => c.mention_ids.includes(a.event_mention_id));
    const secondClusterIndex = record.payload.event_clusters.findIndex((c) => c.mention_ids.includes(b.event_mention_id));
    assert.ok(firstCluster);
    assert.ok(secondClusterIndex >= 0);

    firstCluster.mention_ids.push(b.event_mention_id);
    firstCluster.mention_ids.sort();
    firstCluster.participant_entity_ids = [...new Set([
      ...firstCluster.participant_entity_ids,
      ...record.payload.event_clusters[secondClusterIndex].participant_entity_ids,
    ])].sort();
    record.payload.event_clusters.splice(secondClusterIndex, 1);
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu5Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu5Config,
      "--character-resolution", characters,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /connecting coref evidence|canonical mention mismatch|non-deterministic event id/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
