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
const nlu7Schema = path.join(rootDir, "schemas", "fiction-nlu-plot-graph-v1.schema.json");

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
      reject(new Error("NLU-7 test timed out"));
    }, 60_000);
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
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu7-"));
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
    title: "plot graph fixture",
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

  await runPython([
    nlu2Script, "resolve", "--db-root", fixture.temp, "--config", nlu2Config,
    "--output", characters, "--provider", "heuristic",
    "--seed-name", "安達", "--seed-name", "島村",
    "--novel-id", "NOV-AAAAAAAAAAAAAAAA",
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
  return { characters, events, relations };
}

async function compilePlot(fixture, deps, output, checkpoint = null) {
  const args = [
    nlu7Script, "compile", "--db-root", fixture.temp, "--config", nlu7Config,
    "--character-resolution", deps.characters, "--event-analysis", deps.events,
    "--event-relation", deps.relations, "--output", output,
  ];
  if (checkpoint) args.push("--checkpoint", checkpoint);
  return runPython(args);
}

test("NLU-7 contract keeps salience and narrative function unresolved", async () => {
  const config = JSON.parse(await readFile(nlu7Config, "utf8"));
  const schema = JSON.parse(await readFile(nlu7Schema, "utf8"));
  assert.equal(config.config_version, "fiction_nlu_plot_graph_v1");
  assert.equal(config.edge_policy.invent_missing_edges, false);
  assert.equal(config.component_policy.assign_narrative_function, false);
  assert.equal(schema.properties.scope.properties.complete_plot_graph_claim.const, false);
  assert.equal(schema.properties.scope.properties.narrative_function_resolved.const, false);
  assert.equal(schema.properties.scope.properties.salience_resolved.const, false);
});

test("NLU-7 assembles admitted event relations into deterministic components and temporal layers", async () => {
  const fixture = await buildFixture(["安達打開門。", "因此島村走進教室。"]);
  const output = path.join(fixture.temp, "plot.jsonl");
  const checkpoint = path.join(fixture.temp, "plot-checkpoint.json");
  try {
    const deps = await buildDependencies(fixture);
    const { stdout } = await compilePlot(fixture, deps, output, checkpoint);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.nodes >= 2);
    assert.ok(summary.edges >= 1);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.analysis_kind, "plot_structure");
    assert.equal(record.analysis_version, "plot_graph_v1");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(record.payload.scope.complete_plot_graph_claim, false);
    assert.equal(record.payload.scope.narrative_function_resolved, false);
    assert.equal(record.payload.scope.salience_resolved, false);
    assert.equal(record.payload.graph_stats.node_count, record.payload.nodes.length);
    assert.equal(record.payload.graph_stats.edge_count, record.payload.edges.length);
    assert.ok(record.payload.components.some((c) => c.node_ids.length >= 2));
    assert.ok(record.payload.temporal_layers.length >= 1);
    assert.ok(record.payload.edges.every((e) => e.source_relation_id.startsWith("ERL-")));

    const validation = await runPython([
      nlu7Script, "validate", "--db-root", fixture.temp, "--config", nlu7Config,
      "--character-resolution", deps.characters, "--event-analysis", deps.events,
      "--event-relation", deps.relations, "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await compilePlot(fixture, deps, output, checkpoint);
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("NLU-7 invents no graph edges when NLU-6 admitted no relations", async () => {
  const fixture = await buildFixture(["安達打開門。", "島村走進教室。"]);
  const output = path.join(fixture.temp, "plot.jsonl");
  try {
    const deps = await buildDependencies(fixture);
    await compilePlot(fixture, deps, output);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.payload.edges.length, 0);
    assert.equal(record.payload.graph_stats.edge_count, 0);
    assert.equal(record.payload.graph_stats.component_count, record.payload.nodes.length);
    assert.equal(record.payload.graph_stats.singleton_component_count, record.payload.nodes.length);
    assert.ok(record.payload.components.every((component) => component.node_ids.length === 1));
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects stale NLU-6 event-relation lineage", async () => {
  const fixture = await buildFixture(["安達打開門。", "因此島村走進教室。"]);
  const output = path.join(fixture.temp, "plot.jsonl");
  const tamperedRelations = path.join(fixture.temp, "relations-tampered.jsonl");
  try {
    const deps = await buildDependencies(fixture);
    await compilePlot(fixture, deps, output);

    const relationRecord = JSON.parse((await readFile(deps.relations, "utf8")).trim());
    const rows = [
      ...relationRecord.payload.temporal_relations,
      ...relationRecord.payload.causal_relations,
    ];
    assert.ok(rows.length > 0);
    rows[0].score = rows[0].score >= 0.99 ? rows[0].score - 0.01 : rows[0].score + 0.01;
    await writeFile(tamperedRelations, JSON.stringify(relationRecord) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu7Script, "validate", "--db-root", fixture.temp, "--config", nlu7Config,
      "--character-resolution", deps.characters, "--event-analysis", deps.events,
      "--event-relation", tamperedRelations, "--input", output,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.ok(
      /analysis_id must be deterministic|event relation registry hash mismatch/u.test(report.errors[0].error),
      report.errors[0].error,
    );
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects a plot graph whose deterministic edge projection is tampered", async () => {
  const fixture = await buildFixture(["安達打開門。", "因此島村走進教室。"]);
  const output = path.join(fixture.temp, "plot.jsonl");
  const tampered = path.join(fixture.temp, "plot-tampered.jsonl");
  try {
    const deps = await buildDependencies(fixture);
    await compilePlot(fixture, deps, output);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.ok(record.payload.edges.length > 0);
    record.payload.edges[0].score = Math.max(0, record.payload.edges[0].score - 0.01);
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu7Script, "validate", "--db-root", fixture.temp, "--config", nlu7Config,
      "--character-resolution", deps.characters, "--event-analysis", deps.events,
      "--event-relation", deps.relations, "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /deterministic projection/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
