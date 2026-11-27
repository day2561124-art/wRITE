// Synthetic Journal verification benchmark for issue #122.
// Never opens the managed Journal; all files are generated in a temporary root.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { canonicalJson, createDevOperationJournalService } from "../server/src/mcp-development-journal-tools.mjs";
import { createPiProductionRouteStore } from "../server/src/pi-production-execution-route.mjs";
import { createPiProductionExecutionController } from "../server/src/pi-production-execution-controller.mjs";
import { REQUIRED_DECISION_BOUNDARIES } from "../server/src/pi-execution-contract.mjs";
import { requestTraceChannel, runRequestTrace } from "../server/src/mcp-request-tracing.mjs";

const count = Number(process.argv[2] ?? 66000);
const includePi = process.argv[3] === "--pi";
if (!Number.isSafeInteger(count) || count < 2 || count > 100000 || count % 2 !== 0
  || process.argv.length > 4 || (process.argv.length === 4 && !includePi)) {
  throw new Error("Usage: node scripts/benchmark-nexa-journal-verification.mjs [even event count 2..100000] [--pi]");
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
    JSON.parse(await readFile(path.join(eventsPath, name), "utf8"))));
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
  let pi_fixture = null;
  if (includePi) {
    // An in-process controller and synthetic transport isolate the persistence
    // cost from actual MCP IPC, OAuth, protected host and Git process latency.
    // This is NOT a live worker or production authorization acceptance test.
    const route = createPiProductionRouteStore({ journal: service });
    await route.change({ mode: "pi_default", expected_revision: 0,
      decision_id: "gpt-journal-scale-fixture", gate_hash: "a".repeat(64) },
    { validateGate: async () => true });
    const context = {
      project_id: "writer_workbench",
      workstream_id: "dev_workstream_20261125-000000_000000000001",
      workspace_id: "dev_workspace_000000000000000000000001",
    };
    let dispatches = 0;
    const host = createPiProductionExecutionController({
      journal: service, route, transport: {
        callTool: async () => { dispatches++; return { ok: true }; },
        resolveWorkspace: async () => ({ ...context, state: "active", workspace_type: "isolated_worktree" }),
        queryOperation: async () => ({ reconciliation_state: "unknown" }),
      },
    });
    const intent = {
      schema_version: 1, intent_id: "journal-scale-read-fixture", goal: "Measure synthetic read-only execution",
      context, constraints: ["Fixture only"],
      requested_actions: [{ step_id: "read", capability: "filesystem.read",
        input: { path: "package.json" }, depends_on: [] }],
      mutation_plan: [], verification: { focused: [], affected: [], full: [] },
      completion_conditions: ["Read step has a terminal receipt"],
      permissions: { read: true, write: false, workspace_create: false,
        tests: false, commit: false, integrate: false, push: false },
      decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES],
    };
    const traces = [];
    const observe = ({ stage, duration_ms, ok }) => traces.push({ stage, duration_ms, ok });
    const before = await service.verify();
    observations.length = 0;
    requestTraceChannel.subscribe(observe);
    const start = performance.now();
    let completed;
    try {
      completed = await runRequestTrace(randomUUID(), () => host.execute(intent));
    } finally { requestTraceChannel.unsubscribe(observe); }
    const elapsed_ms = performance.now() - start;
    const verification = observations.splice(0);
    assert.equal(completed.state.status, "COMPLETED");
    assert.deepEqual(completed.state.completed_steps, ["read"]);
    assert.equal(dispatches, 1);
    const after = await service.verify();
    assert.equal(after.dangling_operations.length, 0);
    assert.equal(after.active_operations.length, 0);
    pi_fixture = { mode: "in_process_synthetic_transport", elapsed_ms, dispatches,
      state: completed.state.status, added_events: after.head.latest_sequence - before.head.latest_sequence,
      verification_count: verification.length, verification, traces };
  }
  // Unlike the read-only Pi fixture above, directly exercise the changed
  // begin/terminal append path against the same 66k physical event files.
  const beforeAppend = await service.verify();
  observations.length = 0;
  const startBegin = performance.now();
  const operation = await service.begin({ operation_type: "fixture", tool_name: "dev_fixture" });
  const begin_ms = performance.now() - startBegin;
  const begin_verification = observations.splice(0);
  const startComplete = performance.now();
  await service.complete(operation.operation_id);
  const complete_ms = performance.now() - startComplete;
  const complete_verification = observations.splice(0);
  assert.equal(begin_verification.length, 1);
  assert.equal(complete_verification.length, 1);
  for (const sample of [...begin_verification, ...complete_verification]) {
    assert.equal(sample.completed, true);
    assert.ok(sample.prefix_files_checked >= count);
  }
  const afterAppend = await service.verify();
  assert.equal(afterAppend.head.latest_sequence, beforeAppend.head.latest_sequence + 2);
  assert.equal(afterAppend.events[beforeAppend.head.latest_sequence].previous_event_hash, beforeAppend.head.latest_event_hash);
  assert.equal(afterAppend.events.at(-1).operation_id, operation.operation_id);
  assert.equal(afterAppend.events.at(-1).stage, "operation_completed");
  assert.equal(afterAppend.active_operations.length, 0);
  assert.equal(afterAppend.dangling_operations.length, 0);
  const append_fixture = { begin_ms, complete_ms, begin_verification, complete_verification };
  console.log(JSON.stringify({ schema_version: 1, platform: process.platform,
    node: process.version, event_count: count, generation_ms, measurements, pi_fixture, append_fixture }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
