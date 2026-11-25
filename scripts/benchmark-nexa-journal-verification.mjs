// Synthetic Journal verification benchmark for issue #122.
// Never opens the managed Journal; all files are generated in a temporary root.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { canonicalJson, createDevOperationJournalService } from "../server/src/mcp-development-journal-tools.mjs";

const count = Number(process.argv[2] ?? 66000);
if (!Number.isSafeInteger(count) || count < 2 || count > 100000 || count % 2 !== 0 || process.argv.length > 3) {
  throw new Error("Usage: node scripts/benchmark-nexa-journal-verification.mjs [even event count 2..100000]");
}
const digest = value => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const root = await mkdtemp(path.join(os.tmpdir(), "nexa-journal-benchmark-"));
try {
  const storageRoot = path.join(root, "journal");
  const seed = createDevOperationJournalService({ storageRoot, verificationTimingObserver: null });
  const started = await seed.begin({ operation_type: "fixture", tool_name: "dev_fixture" });
  await seed.complete(started.operation_id);
  const eventsPath = path.join(storageRoot, "events");
  const names = (await readdir(eventsPath)).sort();
  assert.equal(names.length, 2);
  const templates = await Promise.all(names.map(async name =>
    JSON.parse(await readFile(path.join(eventsPath, name), "utf8")))));
  let previous = templates[1].event_hash;
  let last = templates[1];
  let batch = [];
  const makeStart = performance.now();
  for (let sequence = 3; sequence <= count; sequence++) {
    const template = templates[(sequence - 1) % 2];
    const { event_hash: discarded, ...payload } = template;
    const event = { ...payload, sequence, previous_event_hash: previous,
      journal_event_id: "dev_journal_event_" + sequence.toString(16).padStart(32, "0"),
      operation_id: "dev_operation_" + Math.ceil(sequence / 2).toString(16).padStart(32, "0") };
    event.event_hash = digest(event);
    previous = event.event_hash;
    last = event;
    const filename = String(sequence).padStart(12, "0") + "-" + event.journal_event_id + ".json";
    batch.push(writeFile(path.join(eventsPath, filename), canonicalJson(event) + "\n", { flag: "wx" }));
    if (batch.length === 32) { await Promise.all(batch); batch = []; }
  }
  await Promise.all(batch);
  await writeFile(path.join(storageRoot, "head.json"), canonicalJson({
    schema_version: 1, latest_sequence: last.sequence,
    latest_event_id: last.journal_event_id, latest_event_hash: last.event_hash,
  }) + "\n");
  const generation_ms = performance.now() - makeStart;
  const observations = [];
  const service = createDevOperationJournalService({
    storageRoot, verificationTimingObserver: record => observations.push(record),
  });
  async function measure(label, callers) {
    const start = performance.now();
    const results = await Promise.all(Array.from({ length: callers }, () => service.verify()));
    const elapsed_ms = performance.now() - start;
    for (const result of results) {
      assert.equal(result.head.latest_sequence, count);
      assert.equal(result.head.latest_event_hash, last.event_hash);
      assert.equal(result.events.length, count);
    }
    return { label, callers, elapsed_ms, verification: observations.splice(0) };
  }
  const measurements = [];
  measurements.push(await measure("cold", 1));
  measurements.push(await measure("warm", 1));
  measurements.push(await measure("coalesced", 3));
  assert.equal(measurements[0].verification[0].suffix_files_loaded, count);
  assert.equal(measurements[1].verification[0].prefix_files_checked, count);
  assert.equal(measurements[2].verification.length, 1);
  console.log(JSON.stringify({ schema_version: 1, platform: process.platform,
    node: process.version, event_count: count, generation_ms, measurements }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
