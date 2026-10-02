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
const classifyScript = path.join(rootDir, "scripts", "fiction-sample-nlu-classify-v2.py");
const taxonomyPath = path.join(rootDir, "config", "fiction-nlu-semantic-taxonomy-v2.json");
const payloadSchemaPath = path.join(rootDir, "schemas", "fiction-nlu-semantic-classification-v2.schema.json");

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
      reject(new Error("NLU-1 test timed out"));
    }, 30_000);
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
        return;
      }
      reject(new Error("python exited " + code + ", expected " + expectCode + "\n" + stdout + "\n" + stderr));
    });
  });
}

async function buildFixture() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu1-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const passages = [
    {
      passage_id: "PAS-1111111111111111",
      scene_id: "SCN-1111111111111111",
      novel_id: "NOV-1111111111111111",
      source_id: "SRC-1111111111111111",
      source_order: 1,
      char_start: 0,
      char_end: 0,
      text: "她有些害羞地低下頭，兩人牽手一起慢慢走回家。氣氛很平靜，她小聲說晚安。",
      status: "accepted",
      semantic_labels: {
        discourse: { bucket: "mixed_dialogue_narration" },
        active_facets: [],
      },
    },
    {
      passage_id: "PAS-2222222222222222",
      scene_id: "SCN-2222222222222222",
      novel_id: "NOV-1111111111111111",
      source_id: "SRC-1111111111111111",
      source_order: 2,
      char_start: 100,
      char_end: 0,
      text: "爆炸突然響起，他立刻閃避攻擊，拉著同伴逃離危險區域。",
      status: "golden",
      semantic_labels: {
        discourse: { bucket: "narration_heavy" },
        active_facets: ["combat_action"],
      },
    },
  ];
  for (const p of passages) {
    p.char_end = p.char_start + p.text.length;
    p.content_sha256 = sha256(p.text);
  }

  const scenes = passages.map((p) => ({
    scene_id: p.scene_id,
    novel_id: p.novel_id,
    source_order: p.source_order,
    char_start: p.char_start,
    char_end: p.char_end,
    scene_hash: sha256("scene:" + p.scene_id),
  }));
  const novel = {
    novel_id: "NOV-1111111111111111",
    source_id: "SRC-1111111111111111",
    author_id: "AUT-1111111111111111",
    title: "fixture",
    language: "zh-Hant",
    text: { char_count: 1000, text_sha256: sha256("fixture novel") },
  };

  await writeFile(path.join(records, "passages_v1.jsonl"), passages.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "scenes_v1.jsonl"), scenes.map(JSON.stringify).join("\n") + "\n", "utf8");
  await writeFile(path.join(records, "novels_v1.jsonl"), JSON.stringify(novel) + "\n", "utf8");
  return { temp, passages };
}

test("taxonomy and payload schema expose hierarchical multi-label contract", async () => {
  const taxonomy = JSON.parse(await readFile(taxonomyPath, "utf8"));
  const schema = JSON.parse(await readFile(payloadSchemaPath, "utf8"));
  assert.equal(taxonomy.taxonomy_version, "fiction_nlu_semantic_taxonomy_v2");
  assert.deepEqual(taxonomy.hierarchy.dimensions, ["discourse", "activity", "interaction", "emotion_signal", "tension"]);
  assert.equal(taxonomy.dimensions.discourse.selection, "exactly_one");
  assert.equal(taxonomy.dimensions.interaction.selection, "multi");
  assert.equal(schema.properties.assertion_scope.const, "passage_semantic_interpretation_not_canonical_truth");
});

test("candidate generation is bounded per inferred dimension and preserves deterministic discourse", async () => {
  const fixture = await buildFixture();
  try {
    const { stdout } = await runPython([
      classifyScript,
      "candidates",
      "--db-root", fixture.temp,
      "--taxonomy", taxonomyPath,
      "--passage-id", fixture.passages[0].passage_id,
    ]);
    const request = JSON.parse(stdout.trim());
    const byDimension = new Map();
    for (const candidate of request.candidates) {
      byDimension.set(candidate.dimension, (byDimension.get(candidate.dimension) ?? 0) + 1);
    }
    assert.equal(byDimension.get("discourse"), 1);
    for (const dimension of ["activity", "interaction", "emotion_signal", "tension"]) {
      assert.ok(byDimension.get(dimension) >= 3);
      assert.ok(byDimension.get(dimension) <= 6);
    }
    assert.ok(request.candidates.some((item) => item.label_id === "interaction.romantic_intimacy"));
    assert.ok(request.candidates.some((item) => item.label_id === "emotion_signal.embarrassment"));
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("heuristic provider produces NLU-0-valid provisional records with evidence and closed retrieval admission", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "analysis.jsonl");
  const checkpoint = path.join(fixture.temp, "checkpoint.json");
  const cache = path.join(fixture.temp, "cache");
  try {
    const first = await runPython([
      classifyScript,
      "classify",
      "--db-root", fixture.temp,
      "--taxonomy", taxonomyPath,
      "--output", output,
      "--checkpoint", checkpoint,
      "--cache-dir", cache,
      "--provider", "heuristic",
      "--limit", "2",
    ]);
    const summary = JSON.parse(first.stdout.trim());
    assert.equal(summary.written, 2);
    assert.equal(summary.errors, 0);

    const rows = (await readFile(output, "utf8")).trim().split(/\r?\n/u).map(JSON.parse);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.analysis_kind, "semantic_classification");
      assert.equal(row.analysis_version, "semantic_classification_v2");
      assert.equal(row.status, "provisional");
      assert.equal(row.retrieval_admission.state, "not_admitted");
      assert.equal(row.payload.hierarchy_check.valid, true);
      assert.equal(row.payload.active_labels.filter((id) => id.startsWith("discourse.")).length, 1);
      assert.equal(row.payload.active_labels.filter((id) => id.startsWith("tension.")).length, 1);
      for (const label of row.payload.labels.filter((item) => item.active)) {
        assert.ok(label.evidence.length >= 1, "missing evidence for " + label.label_id);
      }
    }

    const validation = await runPython([
      classifyScript,
      "validate",
      "--db-root", fixture.temp,
      "--taxonomy", taxonomyPath,
      "--input", output,
    ]);
    const report = JSON.parse(validation.stdout);
    assert.equal(report.valid_count, 2);
    assert.equal(report.error_count, 0);

    const resumed = await runPython([
      classifyScript,
      "classify",
      "--db-root", fixture.temp,
      "--taxonomy", taxonomyPath,
      "--output", output,
      "--checkpoint", checkpoint,
      "--cache-dir", cache,
      "--provider", "heuristic",
      "--limit", "2",
    ]);
    const resumeSummary = JSON.parse(resumed.stdout.trim());
    assert.equal(resumeSummary.written, 0);
    assert.equal(resumeSummary.skipped, 2);
    const rowsAfterResume = (await readFile(output, "utf8")).trim().split(/\r?\n/u);
    assert.equal(rowsAfterResume.length, 2);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("classification validator rejects tampered active-label evidence", async () => {
  const fixture = await buildFixture();
  const output = path.join(fixture.temp, "analysis.jsonl");
  const tampered = path.join(fixture.temp, "tampered.jsonl");
  try {
    await runPython([
      classifyScript,
      "classify",
      "--db-root", fixture.temp,
      "--taxonomy", taxonomyPath,
      "--output", output,
      "--provider", "heuristic",
      "--limit", "1",
    ]);
    const record = JSON.parse((await readFile(output, "utf8")).trim());
    const active = record.payload.labels.find((item) => item.active && item.dimension !== "discourse");
    assert.ok(active);
    active.evidence[0].quote_sha256 = "0".repeat(64);
    await writeFile(tampered, JSON.stringify(record) + "\n", "utf8");

    const { stdout } = await runPython([
      classifyScript,
      "validate",
      "--db-root", fixture.temp,
      "--taxonomy", taxonomyPath,
      "--input", tampered,
    ], { expectCode: 1 });
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /evidence hash mismatch/u);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
