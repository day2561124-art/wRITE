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
const script = path.join(rootDir, "scripts", "fiction-sample-nlu-style-features-v1.py");
const config = path.join(rootDir, "config", "fiction-nlu-style-features-v1.json");
const schema = path.join(rootDir, "schemas", "fiction-nlu-style-features-v1.schema.json");

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
      reject(new Error("NLU-9 test timed out"));
    }, 60_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === expectCode) resolve({ code, stdout, stderr });
      else reject(new Error("python exited " + code + ", expected " + expectCode + "\n" + stdout + "\n" + stderr));
    });
  });
}

async function buildFixture(text) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu9-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const passage = {
    passage_id: "PAS-" + "1".repeat(16),
    scene_id: "SCN-" + "1".repeat(16),
    novel_id: "NOV-" + "A".repeat(16),
    source_id: "SRC-" + "B".repeat(16),
    source_order: 1,
    char_start: 0,
    char_end: text.length,
    text,
    content_sha256: sha256(text),
    status: "accepted",
  };
  const scene = {
    scene_id: passage.scene_id,
    novel_id: passage.novel_id,
    source_order: 1,
    char_start: 0,
    char_end: text.length,
    scene_hash: passage.content_sha256,
  };
  const novel = {
    novel_id: passage.novel_id,
    source_id: passage.source_id,
    author_id: "AUT-" + "C".repeat(16),
    title: "style fixture",
    language: "zh-Hant",
    text: {
      char_count: text.length,
      text_sha256: sha256(text),
    },
  };

  await writeFile(path.join(records, "passages_v1.jsonl"), JSON.stringify(passage) + "\n", "utf8");
  await writeFile(path.join(records, "scenes_v1.jsonl"), JSON.stringify(scene) + "\n", "utf8");
  await writeFile(path.join(records, "novels_v1.jsonl"), JSON.stringify(novel) + "\n", "utf8");
  return { temp, passage };
}

async function extract(fixture, output, checkpoint = null) {
  const args = [
    script, "extract",
    "--db-root", fixture.temp,
    "--config", config,
    "--output", output,
  ];
  if (checkpoint) args.push("--checkpoint", checkpoint);
  return runPython(args);
}

test("NLU-9 contract is passage-level deterministic measurement, not profile/authorship truth", async () => {
  const cfg = JSON.parse(await readFile(config, "utf8"));
  const sch = JSON.parse(await readFile(schema, "utf8"));
  assert.equal(cfg.config_version, "fiction_nlu_style_features_v1");
  assert.equal(cfg.subject_policy.level, "passage");
  assert.equal(cfg.output_policy.author_attribution_claim, false);
  assert.equal(cfg.output_policy.style_profile_claim, false);
  assert.equal(cfg.output_policy.semantic_quality_claim, false);
  assert.equal(sch.properties.scope.properties.author_attribution_claim.const, false);
  assert.equal(sch.properties.scope.properties.style_profile_claim.const, false);
  assert.equal(sch.properties.scope.properties.semantic_quality_claim.const, false);
});

test("NLU-9 measures sentence rhythm, punctuation, dialogue, diversity, and literal markers from exact passage", async () => {
  const text = "「你還好嗎？」她問。\n我點了點頭，說：「還好。」\n但是雨還在下……";
  const fixture = await buildFixture(text);
  const output = path.join(fixture.temp, "style.jsonl");
  try {
    const { stdout } = await extract(fixture, output);
    const summary = JSON.parse(stdout.trim());
    assert.equal(summary.written, 1);
    assert.equal(summary.errors, 0);

    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const payload = record.payload;
    assert.equal(record.analysis_kind, "style_features");
    assert.equal(record.analysis_version, "explicit_style_features_v1");
    assert.equal(record.subject.level, "passage");
    assert.equal(record.retrieval_admission.state, "not_admitted");
    assert.equal(payload.scope.author_attribution_claim, false);
    assert.equal(payload.scope.style_profile_claim, false);
    assert.equal(payload.scope.semantic_quality_claim, false);
    assert.ok(payload.counts.sentence_count >= 3);
    assert.equal(payload.counts.paragraph_count, 3);
    assert.equal(payload.dialogue.quote_pair_count, 2);
    assert.ok(payload.dialogue.dialogue_char_ratio > 0);
    assert.ok(payload.punctuation_rates_per_1000.question > 0);
    assert.ok(payload.punctuation_rates_per_1000.ellipsis > 0);
    assert.ok(payload.literal_marker_rates_per_1000.function_words["在"] > 0);
    assert.ok(payload.lexical_surface.unique_han_ratio > 0);
    assert.equal(payload.consistency.valid, true);

    const validation = await runPython([
      script, "validate",
      "--db-root", fixture.temp,
      "--config", config,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("same canonical passage deterministically reproduces analysis id and payload; checkpoint resume skips", async () => {
  const text = ("她走到窗邊，看著雨落下。然後她回頭說：「今天也一樣呢。」\n").repeat(10);
  const fixture = await buildFixture(text);
  const outA = path.join(fixture.temp, "style-a.jsonl");
  const outB = path.join(fixture.temp, "style-b.jsonl");
  const checkpoint = path.join(fixture.temp, "checkpoint.json");
  try {
    await extract(fixture, outA, checkpoint);
    await extract(fixture, outB);
    const a = JSON.parse((await readFile(outA, "utf8")).trim());
    const b = JSON.parse((await readFile(outB, "utf8")).trim());
    assert.equal(a.analysis_id, b.analysis_id);
    assert.deepEqual(a.payload, b.payload);
    assert.equal(a.payload.sample_quality.tier, "stable");
    assert.equal(a.payload.sample_quality.stable_for_passage_style, true);

    const resume = await extract(fixture, outA, checkpoint);
    const resumed = JSON.parse(resume.stdout.trim());
    assert.equal(resumed.written, 0);
    assert.equal(resumed.skipped, 1);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("validator rejects tampered explicit style measurements", async () => {
  const fixture = await buildFixture("她說：「等等。」然後停下腳步。");
  const output = path.join(fixture.temp, "style.jsonl");
  const tampered = path.join(fixture.temp, "style-tampered.jsonl");
  try {
    await extract(fixture, output);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    record.payload.sentence_rhythm.mean_chars += 1;
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      script, "validate",
      "--db-root", fixture.temp,
      "--config", config,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /deterministic projection/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
