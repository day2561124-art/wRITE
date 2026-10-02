import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const benchmarkScript = path.join(
  rootDir,
  "scripts",
  "fiction-sample-retrieval-benchmark-v1.py",
);

function runPython(args) {
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
      reject(new Error("benchmark test timed out"));
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
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`python benchmark failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

test("retrieval benchmark preserves UTF-8 queries and emits deterministic baseline metrics", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "fiction-retrieval-benchmark-"));
  try {
    const toolsDir = path.join(temp, "tools");
    const indexesDir = path.join(temp, "indexes");
    await mkdir(toolsDir, { recursive: true });
    await mkdir(indexesDir, { recursive: true });

    const fakeSearch = path.join(toolsDir, "fake-search.py");
    await writeFile(
      fakeSearch,
      [
        "from __future__ import annotations",
        "import json, sys",
        "q=sys.argv[1]",
        "if '害羞' in q:",
        "    results=[",
        "      {'passage_id':'PAS-H','status':'accepted','novel_id':'NOV-H'},",
        "      {'passage_id':'PAS-A','status':'accepted','novel_id':'NOV-A'},",
        "    ]",
        "else:",
        "    results=[",
        "      {'passage_id':'PAS-B','status':'golden','novel_id':'NOV-B'},",
        "      {'passage_id':'PAS-X','status':'accepted','novel_id':'NOV-X'},",
        "    ]",
        "print(json.dumps({'results':results},ensure_ascii=False))",
        "",
      ].join("\n"),
      "utf8",
    );

    for (const name of [
      "retrieval_index_v1.jsonl",
      "canonical_passage_fts_v1.sqlite3",
      "semantic_embeddings_v1.sqlite3",
    ]) {
      await writeFile(path.join(indexesDir, name), `fixture:${name}\n`, "utf8");
    }

    const benchmarkPath = path.join(temp, "benchmark.json");
    await writeFile(
      benchmarkPath,
      JSON.stringify(
        {
          schema_version: "fiction_sample_retrieval_benchmark_v1",
          benchmark_id: "fixture",
          k_values: [5],
          cases: [
            {
              id: "utf8",
              category: "dialogue",
              query: "害羞少女用很短的話間接示好",
              qrels_complete: false,
              qrels: { "PAS-A": 4, "PAS-H": -1 },
            },
            {
              id: "golden",
              category: "daily",
              query: "普通日常交流",
              qrels_complete: false,
              qrels: { "PAS-B": 4 },
            },
          ],
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const outputPath = path.join(temp, "report.json");
    const { stdout } = await runPython([
      benchmarkScript,
      "--db-root",
      temp,
      "--benchmark",
      benchmarkPath,
      "--search-script",
      fakeSearch,
      "--output",
      outputPath,
    ]);

    const report = JSON.parse(await readFile(outputPath, "utf8"));
    const streamed = JSON.parse(stdout);

    assert.equal(report.schema_version, "fiction_sample_retrieval_benchmark_report_v1");
    assert.equal(report.benchmark_id, "fixture");
    assert.equal(report.qrels_complete, false);
    assert.equal(report.case_count, 2);
    assert.equal(report.cases[0].query, "害羞少女用很短的話間接示好");
    assert.equal(report.cases[0].result_ids[1], "PAS-A");
    assert.equal(report.cases[0].metrics["mrr@5"], 0.5);
    assert.equal(report.cases[0].metrics["bad@5"], 1);
    assert.equal(report.macro["known_positive_recall@5"], 1);
    assert.equal(report.macro["mrr@5"], 0.75);
    assert.equal(report.macro["bad@5"], 0.5);
    assert.match(report.benchmark_sha256, /^[a-f0-9]{64}$/);
    assert.match(report.retrieval.search_script_sha256, /^[a-f0-9]{64}$/);
    assert.match(
      report.retrieval.artifacts.canonical_passage_fts_v1,
      /^[a-f0-9]{64}$/,
    );
    assert.deepEqual(streamed.macro, report.macro);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
