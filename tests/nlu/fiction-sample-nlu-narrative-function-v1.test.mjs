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
const nlu7Script = path.join(rootDir, "scripts", "fiction-sample-nlu-plot-graph-v1.py");
const nlu7Config = path.join(rootDir, "config", "fiction-nlu-plot-graph-v1.json");
const nlu8Script = path.join(rootDir, "scripts", "fiction-sample-nlu-narrative-function-v1.py");
const nlu8Config = path.join(rootDir, "config", "fiction-nlu-narrative-function-v1.json");
const nlu8Schema = path.join(rootDir, "schemas", "fiction-nlu-narrative-function-v1.schema.json");

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
      reject(new Error("NLU-8 test timed out"));
    }, 90_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === expectCode) resolve({ code, stdout, stderr });
      else reject(new Error("python exited " + code + ", expected " + expectCode + "\n" + stdout + "\n" + stderr));
    });
  });
}

async function buildFixture(texts) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu8-"));
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
    title: "narrative function fixture",
    language: "zh-Hant",
    text: { char_count: cursor, text_sha256: sha256(texts.join("\n")) },
  };
  await writeFile(path.join(records, "passages_v1.jsonl"), passages.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "scenes_v1.jsonl"), scenes.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "novels_v1.jsonl"), JSON.stringify(novel) + "\n", "utf8");
  return { temp };
}

async function buildDependencies(fixture) {
  const characters = path.join(fixture.temp, "characters.jsonl");
  const events = path.join(fixture.temp, "events.jsonl");
  const relations = path.join(fixture.temp, "relations.jsonl");
  const plot = path.join(fixture.temp, "plot.jsonl");

  await runPython([
    nlu2Script, "resolve", "--db-root", fixture.temp, "--config", nlu2Config,
    "--output", characters, "--provider", "heuristic",
    "--seed-name", "安達", "--seed-name", "島村", "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
  ]);
  await runPython([
    nlu5Script, "extract", "--db-root", fixture.temp, "--config", nlu5Config,
    "--character-resolution", characters, "--output", events, "--provider", "heuristic",
  ]);
  await runPython([
    nlu6Script, "extract", "--db-root", fixture.temp, "--config", nlu6Config,
    "--character-resolution", characters, "--event-analysis", events,
    "--output", relations, "--provider", "heuristic",
  ]);
  await runPython([
    nlu7Script, "compile", "--db-root", fixture.temp, "--config", nlu7Config,
    "--character-resolution", characters, "--event-analysis", events,
    "--event-relation", relations, "--output", plot,
  ]);
  return { characters, events, relations, plot };
}

function analyzeArgs(fixture, deps, output, checkpoint = null, provider = "heuristic") {
  const args = [
    nlu8Script, "analyze", "--db-root", fixture.temp, "--config", nlu8Config,
    "--character-resolution", deps.characters, "--event-analysis", deps.events,
    "--event-relation", deps.relations, "--plot-graph", deps.plot,
    "--output", output, "--provider", provider,
  ];
  if (checkpoint) args.push("--checkpoint", checkpoint);
  return args;
}

test("NLU-8 contract separates salience from function and forbids screenplay-position truth", async () => {
  const config = JSON.parse(await readFile(nlu8Config, "utf8"));
  const schema = JSON.parse(await readFile(nlu8Schema, "utf8"));
  assert.equal(config.salience_policy.independent_from_function_labels, true);
  assert.equal(config.salience_policy.position_is_not_salience, true);
  assert.equal(config.high_risk_label_gates["function.climax"].position_prior_allowed, false);
  assert.equal(schema.properties.scope.properties.complete_narrative_function_claim.const, false);
  assert.equal(schema.properties.scope.properties.complete_salience_ranking_claim.const, false);
  assert.equal(schema.properties.scope.properties.screenplay_structure_assumed.const, false);
});

test("NLU-8 end-to-end heuristic path scores every candidate and validates exact lineage/evidence", async () => {
  const fixture = await buildFixture(["安達打開門。", "因此島村走進教室。"]);
  const output = path.join(fixture.temp, "narrative.jsonl");
  const checkpoint = path.join(fixture.temp, "narrative-checkpoint.json");
  try {
    const deps = await buildDependencies(fixture);
    const { stdout } = await runPython(analyzeArgs(fixture, deps, output, checkpoint));
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.targets >= 3);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.analysis_kind, "narrative_function");
    assert.equal(record.analysis_version, "narrative_function_v1");
    assert.equal(record.status, "provisional");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(record.payload.scope.complete_narrative_function_claim, false);
    assert.equal(record.payload.scope.complete_salience_ranking_claim, false);
    assert.equal(record.payload.scope.screenplay_structure_assumed, false);

    const expectedScoreCount = record.payload.targets.reduce((sum, t) => sum + t.candidate_labels.length, 0);
    assert.equal(record.payload.function_scores.length, expectedScoreCount);
    assert.equal(record.payload.salience_scores.length, record.payload.targets.length);
    assert.ok(record.payload.salience_scores.every((row) => row.evidence.length > 0));
    assert.ok(record.payload.function_scores.every((row) => row.label !== "function.climax" || row.active === false));
    assert.ok(record.payload.function_scores.some((row) => row.label === "function.progression" && row.active === true));

    const validation = await runPython([
      nlu8Script, "validate", "--db-root", fixture.temp, "--config", nlu8Config,
      "--character-resolution", deps.characters, "--event-analysis", deps.events,
      "--event-relation", deps.relations, "--plot-graph", deps.plot, "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await runPython(analyzeArgs(fixture, deps, output, checkpoint));
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("high-risk gates reject unsupported turning-point/payoff and limit climax to one per component", async () => {
  const pythonCode = [
    "import json,runpy",
    "m=runpy.run_path(r'" + nlu8Script.replaceAll("\\", "\\\\") + "')",
    "C='PLC-'+'C'*16; A='PLN-'+'A'*16; B='PLN-'+'B'*16",
    "targets=[{'target_type':'node','target_id':A,'component_id':C,'candidate_labels':['function.turning_point','function.climax'],'graph_support':{'incoming_semantic_edges':1,'outgoing_semantic_edges':1,'downstream_reachable_count':2,'component_node_count':2}},{'target_type':'node','target_id':B,'component_id':C,'candidate_labels':['function.climax','function.payoff'],'graph_support':{'incoming_semantic_edges':1,'outgoing_semantic_edges':0,'downstream_reachable_count':0,'component_node_count':2}}]",
    "ev=[{'passage_id':'PAS-'+'1'*16,'span_start':0,'span_end':1,'quote_sha256':'0'*64,'node_ids':[A]}]",
    "rows=[{'target_type':'node','target_id':A,'label':'function.turning_point','score':0.99,'threshold':0.9,'source':'model','gate_evidence':{'high_consequence':False,'downstream_consequence':False},'evidence':ev.copy()},{'target_type':'node','target_id':A,'label':'function.climax','score':0.99,'threshold':0.94,'source':'model','gate_evidence':{'high_consequence':True,'downstream_consequence':False},'evidence':ev.copy()},{'target_type':'node','target_id':B,'label':'function.climax','score':0.98,'threshold':0.94,'source':'model','gate_evidence':{'high_consequence':True,'downstream_consequence':False},'evidence':[{'passage_id':'PAS-'+'2'*16,'span_start':0,'span_end':1,'quote_sha256':'0'*64,'node_ids':[B]}]},{'target_type':'node','target_id':B,'label':'function.payoff','score':0.99,'threshold':0.92,'source':'model','gate_evidence':{'high_consequence':False,'downstream_consequence':False},'evidence':[{'passage_id':'PAS-'+'2'*16,'span_start':0,'span_end':1,'quote_sha256':'0'*64,'node_ids':[B]}]}]",
    "out=m['apply_function_gates'](rows,targets,[])",
    "print(json.dumps([(x['label'],x['target_id'],x['active'],x['gate_status']) for x in out]))",
  ].join(";");
  const { stdout } = await runPython(["-c", pythonCode]);
  const rows = JSON.parse(stdout.trim());
  const turning = rows.find((x) => x[0] === "function.turning_point");
  const pay = rows.find((x) => x[0] === "function.payoff");
  const climaxes = rows.filter((x) => x[0] === "function.climax");
  assert.equal(turning[2], false);
  assert.equal(turning[3], "failed");
  assert.equal(pay[2], false);
  assert.equal(pay[3], "failed");
  assert.equal(climaxes.filter((x) => x[2] === true).length, 1);
});

test("validator rejects stale NLU-7 plot-graph lineage", async () => {
  const fixture = await buildFixture(["安達打開門。", "因此島村走進教室。"]);
  const output = path.join(fixture.temp, "narrative.jsonl");
  const tamperedPlot = path.join(fixture.temp, "plot-tampered.jsonl");
  try {
    const deps = await buildDependencies(fixture);
    await runPython(analyzeArgs(fixture, deps, output));
    const plot = JSON.parse((await readFile(deps.plot, "utf8")).trim());
    assert.ok(plot.payload.nodes.length > 0);
    plot.payload.nodes[0].confidence =
      plot.payload.nodes[0].confidence >= 0.99 ? plot.payload.nodes[0].confidence - 0.01 : plot.payload.nodes[0].confidence + 0.01;
    await writeFile(tamperedPlot, JSON.stringify(plot) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu8Script, "validate", "--db-root", fixture.temp, "--config", nlu8Config,
      "--character-resolution", deps.characters, "--event-analysis", deps.events,
      "--event-relation", deps.relations, "--plot-graph", tamperedPlot, "--input", output,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.ok(
      /analysis_id must be deterministic|plot graph registry hash mismatch|deterministic projection/u.test(report.errors[0].error),
      report.errors[0].error,
    );
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
