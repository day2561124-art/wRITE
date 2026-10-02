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
const contractScript = path.join(rootDir, "scripts", "fiction-sample-nlu-contract-v1.py");
const schemaPath = path.join(rootDir, "schemas", "fiction-nlu-analysis-record-v1.schema.json");

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
      reject(new Error("NLU contract test timed out"));
    }, 30_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
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
      reject(new Error(`python NLU contract exited ${code}, expected ${expectCode}\n${stdout}\n${stderr}`));
    });
  });
}

async function buildFixture() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-nlu-contract-"));
  const records = path.join(temp, "records");
  await mkdir(records, { recursive: true });

  const text = "她在門口停了一下，最後還是小聲說了晚安。";
  const passage = {
    passage_id: "PAS-1111111111111111",
    scene_id: "SCN-2222222222222222",
    novel_id: "NOV-3333333333333333",
    source_id: "SRC-4444444444444444",
    source_order: 1,
    char_start: 0,
    char_end: text.length,
    text,
    content_sha256: sha256(text),
  };
  const scene = {
    scene_id: passage.scene_id,
    novel_id: passage.novel_id,
    source_order: 1,
    char_start: 0,
    char_end: text.length,
    scene_hash: sha256(text),
  };
  const novelTextHash = sha256("fixture novel");
  const novel = {
    novel_id: passage.novel_id,
    source_id: passage.source_id,
    author_id: "AUT-5555555555555555",
    title: "fixture",
    language: "zh-Hant",
    text: { char_count: text.length, text_sha256: novelTextHash },
  };

  await writeFile(path.join(records, "passages_v1.jsonl"), JSON.stringify(passage) + "\n", "utf8");
  await writeFile(path.join(records, "scenes_v1.jsonl"), JSON.stringify(scene) + "\n", "utf8");
  await writeFile(path.join(records, "novels_v1.jsonl"), JSON.stringify(novel) + "\n", "utf8");

  return { temp, passage, scene, novel };
}

function baseRecord(passage) {
  const spanStart = 0;
  const spanEnd = 8;
  return {
    analysis_id: "ANL-0000000000000000",
    schema_version: "fiction_nlu_analysis_record_v1",
    analysis_kind: "semantic_classification",
    analysis_version: "semantic_classification_v2",
    status: "provisional",
    subject: {
      level: "passage",
      id: passage.passage_id,
      content_hash_kind: "passage_content_sha256",
      content_sha256: passage.content_sha256,
    },
    method: {
      type: "hybrid",
      name: "fixture-classifier",
      version: "1",
      model_id: null,
    },
    confidence: 0.9,
    evidence: [
      {
        passage_id: passage.passage_id,
        scene_id: passage.scene_id,
        novel_id: passage.novel_id,
        content_sha256: passage.content_sha256,
        span_start: spanStart,
        span_end: spanEnd,
        quote_sha256: sha256(passage.text.slice(spanStart, spanEnd)),
      },
    ],
    provenance: {
      created_at: "2026-10-02T00:00:00Z",
      producer: "fixture",
      input_sha256: sha256("fixture input"),
      code_sha256: null,
      model_sha256: null,
      notes: null,
    },
    retrieval_admission: {
      state: "not_admitted",
      contract_version: "fiction_nlu_retrieval_admission_v1",
      notes: "NLU-only development",
    },
    payload: {
      labels: ["dialogue", "relationship_progression"],
    },
  };
}

async function materializeRecord(temp, record) {
  const draftPath = path.join(temp, "draft.json");
  await writeFile(draftPath, JSON.stringify(record), "utf8");
  const { stdout } = await runPython([contractScript, "make-id", "--input", draftPath]);
  record.analysis_id = stdout.trim();
  const jsonlPath = path.join(temp, "analysis.jsonl");
  await writeFile(jsonlPath, JSON.stringify(record) + "\n", "utf8");
  return jsonlPath;
}

test("NLU analysis JSON Schema declares additive evidence and retrieval boundary", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(schema.properties.schema_version.const, "fiction_nlu_analysis_record_v1");
  assert.ok(schema.required.includes("subject"));
  assert.ok(schema.required.includes("evidence"));
  assert.ok(schema.required.includes("retrieval_admission"));
  assert.deepEqual(
    schema.properties.retrieval_admission.properties.state.enum,
    ["not_admitted", "eligible", "admitted"],
  );
});

test("valid additive NLU record binds to canonical passage hash and evidence span", async () => {
  const fixture = await buildFixture();
  try {
    const record = baseRecord(fixture.passage);
    const input = await materializeRecord(fixture.temp, record);
    const { stdout } = await runPython([
      contractScript,
      "validate",
      "--db-root",
      fixture.temp,
      "--input",
      input,
    ]);
    const report = JSON.parse(stdout);
    assert.equal(report.record_count, 1);
    assert.equal(report.valid_count, 1);
    assert.equal(report.error_count, 0);
    assert.equal(report.retrieval_admission_open, false);
    assert.match(record.analysis_id, /^ANL-[A-F0-9]{16}$/);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("stale subject hash is rejected even when the analysis id is regenerated", async () => {
  const fixture = await buildFixture();
  try {
    const record = baseRecord(fixture.passage);
    record.subject.content_sha256 = "a".repeat(64);
    const input = await materializeRecord(fixture.temp, record);
    const { stdout } = await runPython(
      [
        contractScript,
        "validate",
        "--db-root",
        fixture.temp,
        "--input",
        input,
      ],
      { expectCode: 1 },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /subject content hash is stale/);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("evidence quote hash is checked against the canonical passage span", async () => {
  const fixture = await buildFixture();
  try {
    const record = baseRecord(fixture.passage);
    record.evidence[0].quote_sha256 = "b".repeat(64);
    const input = await materializeRecord(fixture.temp, record);
    const { stdout } = await runPython(
      [
        contractScript,
        "validate",
        "--db-root",
        fixture.temp,
        "--input",
        input,
      ],
      { expectCode: 1 },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.error_count, 1);
    assert.match(report.errors[0].error, /quote_sha256 does not match/);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});

test("retrieval admission remains closed unless integration explicitly opens it", async () => {
  const fixture = await buildFixture();
  try {
    const record = baseRecord(fixture.passage);
    record.retrieval_admission.state = "eligible";
    const input = await materializeRecord(fixture.temp, record);

    const closed = await runPython(
      [
        contractScript,
        "validate",
        "--db-root",
        fixture.temp,
        "--input",
        input,
      ],
      { expectCode: 1 },
    );
    assert.match(JSON.parse(closed.stdout).errors[0].error, /retrieval admission is closed/);

    const open = await runPython([
      contractScript,
      "validate",
      "--db-root",
      fixture.temp,
      "--input",
      input,
      "--allow-retrieval-admission",
    ]);
    assert.equal(JSON.parse(open.stdout).error_count, 0);
  } finally {
    await rm(fixture.temp, { recursive: true, force: true });
  }
});
