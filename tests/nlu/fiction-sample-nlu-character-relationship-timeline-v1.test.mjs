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
const nlu3Script = path.join(rootDir, "scripts", "fiction-sample-nlu-relationship-extract-v1.py");
const nlu3Config = path.join(rootDir, "config", "fiction-nlu-character-relationship-v1.json");
const nlu4Script = path.join(rootDir, "scripts", "fiction-sample-nlu-relationship-timeline-v1.py");
const nlu4Config = path.join(rootDir, "config", "fiction-nlu-character-relationship-timeline-v1.json");
const nlu4Schema = path.join(rootDir, "schemas", "fiction-nlu-character-relationship-timeline-v1.schema.json");

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
      reject(new Error("NLU-4 test timed out"));
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
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu4-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const texts = [
    "安達和島村是朋友。",
    "安達相信島村。",
    "安達懷疑島村。",
    "安達喜歡島村。",
    "安達看著島村，兩人都沒有說話。",
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
    title: "timeline fixture",
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
  const relationships = path.join(fixture.temp, "relationships.jsonl");

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
    nlu3Script, "extract",
    "--db-root", fixture.temp,
    "--config", nlu3Config,
    "--character-resolution", characters,
    "--output", relationships,
    "--provider", "heuristic",
  ]);
  return { characters, relationships };
}

test("NLU-4 config and schema explicitly reject latent/global relationship truth semantics", async () => {
  const config = JSON.parse(await readFile(nlu4Config, "utf8"));
  const schema = JSON.parse(await readFile(nlu4Schema, "utf8"));
  assert.equal(config.config_version, "fiction_nlu_character_relationship_timeline_v1");
  assert.equal(config.ordering_policy.basis, "narrative_passage_order");
  assert.equal(config.ordering_policy.nonlinear_story_time_resolved, false);
  assert.equal(config.change_policy.no_termination_inference, true);
  assert.equal(schema.properties.scope.properties.complete_relationship_history_claim.const, false);
});

test("NLU-4 compiles ordered snapshots, preserves conflicts, and treats later absence as not observed rather than ended", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "timeline.jsonl");
  const checkpoint = path.join(fixture.temp, "timeline-checkpoint.json");
  try {
    const { characters, relationships } = await buildDependencies(fixture);
    const { stdout } = await runPython([
      nlu4Script, "compile",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", relationships,
      "--output", output,
      "--checkpoint", checkpoint,
    ]);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);
    assert.ok(summary.timelines >= 1);
    assert.ok(summary.snapshots >= 5);
    assert.ok(summary.tracks >= 3);
    assert.ok(summary.change_events >= summary.snapshots);
    assert.ok(summary.conflict_events >= 1);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    assert.equal(record.analysis_kind, "relationship_timeline");
    assert.equal(record.analysis_version, "character_relationship_timeline_v1");
    assert.equal(record.status, "provisional");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(record.payload.scope.complete_relationship_history_claim, false);
    assert.equal(record.payload.ordering.basis, "narrative_passage_order");
    assert.equal(record.payload.ordering.nonlinear_story_time_resolved, false);
    assert.equal(record.payload.consistency.valid, true);

    const timeline = record.payload.timelines[0];
    assert.ok(timeline.tracks.some((t) => t.relation_id === "social.friend_of"));
    assert.ok(timeline.tracks.some((t) => t.relation_id === "affect.trusts"));
    assert.ok(timeline.tracks.some((t) => t.relation_id === "affect.distrusts"));
    assert.ok(timeline.conflict_events.some(
      (e) =>
        [e.relation_id_a, e.relation_id_b].sort().join("|") ===
        ["affect.trusts", "affect.distrusts"].sort().join("|"),
    ));

    const zeroSnapshots = timeline.snapshots.filter((s) => s.assertion_ids.length === 0);
    assert.ok(zeroSnapshots.length >= 1);
    assert.ok(zeroSnapshots.every((s) => s.absence_semantics === "not_observed_not_ended"));
    assert.ok(timeline.change_events.some((e) => e.event_type === "evidence_became_unobserved"));
    assert.ok(timeline.change_events.every((e) => !("ended" in e)));

    const validation = await runPython([
      nlu4Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", relationships,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);

    const resume = await runPython([
      nlu4Script, "compile",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", relationships,
      "--output", output,
      "--checkpoint", checkpoint,
    ]);
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects a timeline that rewrites deterministic snapshot history", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "timeline.jsonl");
  const tampered = path.join(fixture.temp, "timeline-tampered.jsonl");
  try {
    const { characters, relationships } = await buildDependencies(fixture);
    await runPython([
      nlu4Script, "compile",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", relationships,
      "--output", output,
    ]);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const timeline = record.payload.timelines[0];
    assert.ok(timeline.snapshots.length > 0);
    timeline.snapshots[0].track_ids = [];
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu4Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", relationships,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /deterministic projection/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects stale NLU-3 relationship lineage", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "timeline.jsonl");
  const tamperedRelationships = path.join(fixture.temp, "relationships-tampered.jsonl");
  try {
    const { characters, relationships } = await buildDependencies(fixture);
    await runPython([
      nlu4Script, "compile",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", relationships,
      "--output", output,
    ]);
    const relationshipRecord = JSON.parse((await readFile(relationships, "utf8")).trim());
    assert.ok(relationshipRecord.payload.assertions.length > 0);
    const originalScore = relationshipRecord.payload.assertions[0].score;
    relationshipRecord.payload.assertions[0].score =
      originalScore >= 0.99 ? originalScore - 0.01 : originalScore + 0.01;
    await writeFile(tamperedRelationships, JSON.stringify(relationshipRecord) + "\n", "utf8");

    const { stdout } = await runPython([
      nlu4Script, "validate",
      "--db-root", fixture.temp,
      "--config", nlu4Config,
      "--character-resolution", characters,
      "--relationship", tamperedRelationships,
      "--input", output,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.ok(
      /analysis_id must be deterministic|relationship registry hash mismatch|deterministic projection/u.test(report.errors[0].error),
      report.errors[0].error,
    );
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
