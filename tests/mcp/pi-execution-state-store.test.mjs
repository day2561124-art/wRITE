import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { createDevOperationJournalService, canonicalJson } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPiExecutionStateStore } from "../../server/src/pi-execution-state-store.mjs";
import { persistExecutionIntent } from "../../server/src/pi-execution-orchestrator.mjs";
import { REQUIRED_DECISION_BOUNDARIES, hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";

const exec = promisify(execFile);
const journalUrl = new URL("../../server/src/mcp-development-journal-tools.mjs", import.meta.url).href;
const storeUrl = new URL("../../server/src/pi-execution-state-store.mjs", import.meta.url).href;
const context = { project_id: "writer_workbench", workstream_id: "dev_workstream_20261003-084957_ea2f0234f257",
  workspace_id: "dev_workspace_6706581babde4884ab49af9b" };
function intent(overrides = {}) {
  return { schema_version: 1, intent_id: "intent-persistence-001", goal: "Inspect the selected package",
    context, constraints: ["Do not change production routing"],
    requested_actions: [{ step_id: "read", capability: "filesystem.read", input: { path: "package.json" }, depends_on: [] }],
    mutation_plan: [], verification: { focused: [], affected: [], full: [] },
    completion_conditions: ["GPT reviews evidence"],
    permissions: { read: true, workspace_create: false, write: false, tests: false, commit: false, integrate: false, push: false },
    decision_boundaries: [...REQUIRED_DECISION_BOUNDARIES], ...overrides };
}
async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-state-store-"));
  t.after(async () => {
    assert.equal(path.dirname(root), os.tmpdir());
    await rm(root, { recursive: true, force: true });
  });
  const storageRoot = path.join(root, "journal");
  const journal = createDevOperationJournalService({ storageRoot, ...options });
  return { root, storageRoot, journal, store: createPiExecutionStateStore({ journal }) };
}
function advanceArgs(record, status) {
  return { operation_id: record.state.operation_id, context, expected_revision: record.revision, status };
}
async function child(storageRoot, body) {
  const source = `import { createDevOperationJournalService } from ${JSON.stringify(journalUrl)};
import { createPiExecutionStateStore } from ${JSON.stringify(storeUrl)};
const journal = createDevOperationJournalService({storageRoot:process.argv[1]});
const store = createPiExecutionStateStore({journal});
const context = ${JSON.stringify(context)};
const sourceIntent = ${JSON.stringify(intent())};
${body}`;
  return exec(process.execPath, ["--input-type=module", "-e", source, storageRoot],
    { windowsHide: true, timeout: 30000, maxBuffer: 256 * 1024 });
}

test("a fresh Node process reconstructs intent, state, checkpoint and structured result", async t => {
  const { store, journal, storageRoot } = await fixture(t);
  let record = await store.admit(intent());
  record = await store.advance(advanceArgs(record, "ADMITTED"));
  record = await store.advance(advanceArgs(record, "PREPARING"));
  record = await store.checkpoint({ operation_id: record.state.operation_id, context, expected_revision: record.revision });
  const { stdout } = await child(storageRoot,
    `console.log(JSON.stringify(await store.inspect({operation_id:${JSON.stringify(record.state.operation_id)},context})))`);
  const restored = JSON.parse(stdout);
  assert.equal(restored.revision, 4);
  assert.deepEqual(restored.intent, record.intent);
  assert.deepEqual(restored.state, record.state);
  assert.deepEqual(restored.result, record.result);
  assert.equal(restored.state.checkpoint.at_revision, 3);
  assert.equal(restored.result.execution_enabled, false);
  assert.equal(restored.result.resume_dispatch_enabled, false);
  assert.equal(restored.result.decision_owner, "GPT");
  assert.equal((await journal.status()).active_operation_count, 0);
  assert.equal((await journal.status()).dangling_operation_count, 0);
});

test("same intent admission returns the durable current result without rewinding progress", async t => {
  const { store, journal } = await fixture(t);
  const first = await store.admit(intent());
  const later = await store.advance(advanceArgs(first, "ADMITTED"));
  const duplicate = await store.admit(intent());
  assert.equal(duplicate.state.operation_id, first.state.operation_id);
  assert.equal(duplicate.revision, later.revision);
  assert.equal(duplicate.state.status, "ADMITTED");
  assert.equal((await journal.verify()).events.length, 4);
  await assert.rejects(store.admit(intent({ goal: "Different scope under the same identity" })), /INTENT_ID_CONFLICT/);
});

test("cross-process concurrent admission creates one Pi identity", async t => {
  const { store, storageRoot, journal } = await fixture(t);
  const results = await Promise.all([child(storageRoot, "console.log(JSON.stringify(await store.admit(sourceIntent)))"),
    child(storageRoot, "console.log(JSON.stringify(await store.admit(sourceIntent)))")]);
  const records = results.map(x => JSON.parse(x.stdout));
  assert.equal(records[0].state.operation_id, records[1].state.operation_id);
  assert.equal((await journal.verify()).events.length, 2);
  assert.equal((await store.admit(intent())).revision, 1);
});

test("revision compare-and-swap rejects a stale writer in another process", async t => {
  const { store, storageRoot } = await fixture(t);
  const first = await store.admit(intent());
  await child(storageRoot, `await store.advance({operation_id:${JSON.stringify(first.state.operation_id)},
    context,expected_revision:1,status:"ADMITTED"})`);
  await assert.rejects(store.advance(advanceArgs(first, "ADMITTED")), /STATE_REVISION_CONFLICT/);
  const current = await store.inspect({ operation_id: first.state.operation_id, context });
  assert.equal(current.revision, 2);
});

test("workspace and workstream binding is checked before inspection or publication", async t => {
  const { store, journal } = await fixture(t);
  const first = await store.admit(intent());
  const other = { ...context, workspace_id: "dev_workspace_" + "a".repeat(24) };
  await assert.rejects(store.inspect({ operation_id: first.state.operation_id, context: other }), /WORKSPACE_CONTEXT_MISMATCH/);
  await assert.rejects(store.advance({ ...advanceArgs(first, "ADMITTED"), context: other }), /WORKSPACE_CONTEXT_MISMATCH/);
  await assert.rejects(store.inspect({ operation_id: first.state.operation_id }), /WORKSPACE_CONTEXT_MISMATCH/);
  assert.equal((await journal.verify()).events.length, 2);
});

test("durable planner stays deterministic and never dispatches a tool or changes production", async t => {
  const { store } = await fixture(t);
  let calls = 0;
  const result = await persistExecutionIntent(intent(), { store,
    adapter: { describe: () => { calls++; throw new Error("must not call adapter"); } } });
  assert.equal(result.phase, "B");
  assert.equal(result.state.status, "PREPARING");
  assert.equal(result.persistence_enabled, true);
  assert.equal(result.production_default_changed, false);
  assert.equal(calls, 0);
  const duplicate = await persistExecutionIntent(intent(), { store });
  assert.equal(duplicate.revision, result.revision);
});

test("checkpoint can reference an existing verified workspace checkpoint without copying its payload", async t => {
  const { journal } = await fixture(t);
  const checkpoint_id = "dev_checkpoint_" + "b".repeat(32);
  const snapshot = "c".repeat(64);
  const store = createPiExecutionStateStore({ journal, resolveCheckpoint: async () => ({
    checkpoint_id, workspace_id: context.workspace_id, workstream_id: context.workstream_id,
    workspace_snapshot_id: snapshot, git_head: "d".repeat(40) }) });
  const record = await store.admit(intent());
  const saved = await store.checkpoint({ operation_id: record.state.operation_id, context,
    expected_revision: record.revision, workspace_checkpoint_id: checkpoint_id });
  assert.equal(saved.state.checkpoint.workspace_checkpoint_id, checkpoint_id);
  assert.equal(saved.state.checkpoint.workspace_snapshot_id, snapshot);
  const events = (await journal.verify()).events;
  assert.equal(events.at(-1).links[0].checkpoint_id, checkpoint_id);
  const unbound = createPiExecutionStateStore({ journal });
  await assert.rejects(unbound.checkpoint({ operation_id: record.state.operation_id, context,
    expected_revision: saved.revision, workspace_checkpoint_id: checkpoint_id }), /CHECKPOINT_VERIFICATION_REQUIRED/);
});

test("foreign checkpoint evidence fails closed and does not append", async t => {
  const { journal } = await fixture(t);
  const store = createPiExecutionStateStore({ journal, resolveCheckpoint: async () => ({
    checkpoint_id: "dev_checkpoint_" + "b".repeat(32), workspace_id: "dev_workspace_" + "a".repeat(24) }) });
  const record = await store.admit(intent());
  await assert.rejects(store.checkpoint({ operation_id: record.state.operation_id, context, expected_revision: 1,
    workspace_checkpoint_id: "dev_checkpoint_" + "b".repeat(32) }), /CHECKPOINT_CONTEXT_MISMATCH/);
  assert.equal((await journal.verify()).events.length, 2);
});

test("decision escalation persists its resume point and cannot silently reopen", async t => {
  const { store, storageRoot } = await fixture(t);
  let record = await store.admit(intent());
  record = await store.advance(advanceArgs(record, "ADMITTED"));
  record = await store.advance(advanceArgs(record, "PREPARING"));
  record = await store.advance(advanceArgs(record, "DECISION_REQUIRED"));
  assert.equal(record.state.resume_point.phase, "PREPARING");
  assert.equal(record.result.decision_required, true);
  assert.equal(record.action_type, "decision_requested");
  await assert.rejects(store.advance(advanceArgs(record, "EXECUTING")), /INVALID_STATE_TRANSITION/);
  const { stdout } = await child(storageRoot,
    `console.log(JSON.stringify(await store.inspect({operation_id:${JSON.stringify(record.state.operation_id)},context})))`);
  assert.equal(JSON.parse(stdout).state.status, "DECISION_REQUIRED");
});

test("terminal cancellation is durable; checkpoints and reopen are forbidden", async t => {
  const { store } = await fixture(t);
  let record = await store.admit(intent());
  record = await store.advance(advanceArgs(record, "CANCELLED"));
  assert.equal(record.action_type, "operation_cancelled");
  await assert.rejects(store.advance(advanceArgs(record, "ADMITTED")), /INVALID_STATE_TRANSITION/);
  await assert.rejects(store.checkpoint({ operation_id: record.state.operation_id, context,
    expected_revision: record.revision }), /TERMINAL_OPERATION/);
});

test("unrequested verification is recorded accurately and pending actions cannot be completed", async t => {
  const { store } = await fixture(t);
  let record = await store.admit(intent());
  assert.deepEqual(record.state.verification_state, { focused: "not_requested", affected: "not_requested", full: "not_requested" });
  for (const status of ["ADMITTED", "PREPARING", "EXECUTING", "VERIFYING", "COMMITTING"]) {
    record = await store.advance(advanceArgs(record, status));
  }
  await assert.rejects(store.advance(advanceArgs(record, "COMPLETED")), /INCOMPLETE_EXECUTION/);
  assert.deepEqual(record.result.remaining, ["read"]);
  assert.deepEqual(record.result.completed, []);
});

function writeIntent(size, count = 1) {
  const requested_actions = Array.from({ length: count }, (_, index) => ({
    step_id: "write-" + index, capability: "filesystem.write",
    input: { path: "server/large-" + index + ".mjs", content: "x".repeat(size) },
    depends_on: [], idempotency_key: "intent-persistence-001:write-" + index,
  }));
  return intent({ requested_actions, mutation_plan: requested_actions.map(action => ({
    step_id: action.step_id, target: action.input.path, expected_change: "Create GPT supplied bytes",
    input_sha256: hashExecutionInput(action.input),
  })), permissions: { ...intent().permissions, write: true } });
}
test("legal 200 KiB mutation content survives restart without enabling dispatch", async t => {
  const { store, storageRoot } = await fixture(t);
  const source = writeIntent(200 * 1024);
  const saved = await store.admit(source);
  const fresh = createPiExecutionStateStore({ journal: createDevOperationJournalService({ storageRoot }) });
  const restored = await fresh.inspect({ operation_id: saved.state.operation_id, context });
  assert.deepEqual(restored.intent, source);
  assert.equal(restored.result.execution_enabled, false);
  const names = (await readdir(path.join(storageRoot, "events"))).sort();
  const raw = await readFile(path.join(storageRoot, "events", names.at(-1)), "utf8");
  assert.ok(Buffer.byteLength(raw) > 128 * 1024);
});
test("oversize contract is rejected before any journal event is written", async t => {
  const { store, journal } = await fixture(t);
  await assert.rejects(store.admit(writeIntent(256 * 1024, 2)), /CONTRACT_SIZE_LIMIT/);
  assert.equal((await journal.verify()).events.length, 0);
});

test("generic Development Journal operations coexist with durable Pi records", async t => {
  const { store, journal, storageRoot } = await fixture(t);
  const first = await store.admit(intent());
  const generic = await journal.begin({ operation_type: "fixture_read", tool_name: "fixture.read",
    workspace_id: context.workspace_id, workstream_id: context.workstream_id });
  await journal.complete(generic.operation_id, { result: { observed: true } });
  const second = await store.advance(advanceArgs(first, "ADMITTED"));
  const fresh = createPiExecutionStateStore({ journal: createDevOperationJournalService({ storageRoot }) });
  assert.equal((await fresh.inspect({ operation_id: first.state.operation_id, context })).revision, second.revision);
  assert.equal((await journal.verify()).events.length, 6);
});

test("checkpoint cannot move time backwards even when still later than creation", async t => {
  const { journal } = await fixture(t);
  let now = "2026-10-03T09:02:00.000Z";
  const store = createPiExecutionStateStore({ journal, clock: () => now });
  let record = await store.admit(intent(), { timestamp: "2026-10-03T09:00:00.000Z" });
  record = await store.advance(advanceArgs(record, "ADMITTED"));
  now = "2026-10-03T09:01:00.000Z";
  await assert.rejects(store.checkpoint({ operation_id: record.state.operation_id, context,
    expected_revision: record.revision }), /NON_MONOTONIC_STATE_TIME/);
  assert.equal((await journal.verify()).events.length, 4);
});

test("concurrent state writers across processes cannot overwrite one another", async t => {
  const { store, storageRoot } = await fixture(t);
  const first = await store.admit(intent());
  const body = "console.log(JSON.stringify(await store.advance(" + JSON.stringify(advanceArgs(first, "ADMITTED")) + ")))";
  const results = await Promise.allSettled([child(storageRoot, body), child(storageRoot, body)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected");
  assert.match(rejected.reason.stderr, /STATE_REVISION_CONFLICT/);
  assert.equal((await store.inspect({ operation_id: first.state.operation_id, context })).revision, 2);
});

for (const corruption of ["identity", "invented_progress", "revision_gap", "missing_payload", "future_schema"]) {
  test("a hash-valid journal still rejects semantic corruption: " + corruption, async t => {
    const { store, storageRoot } = await fixture(t);
    const first = await store.admit(intent());
    const names = (await readdir(path.join(storageRoot, "events"))).sort();
    const file = path.join(storageRoot, "events", names.at(-1));
    const event = JSON.parse(await readFile(file, "utf8"));
    if (corruption === "missing_payload") delete event.execution_projection;
    else {
      const payload = event.execution_projection;
      if (corruption === "identity") payload.state.intent_hash = "a".repeat(64);
      if (corruption === "invented_progress") { payload.state.pending_steps = []; payload.state.completed_steps = ["read"]; }
      if (corruption === "revision_gap") payload.revision = 2;
      if (corruption === "future_schema") payload.schema_version = 2;
      const { projection_hash: ignored, ...body } = payload;
      payload.projection_hash = hashExecutionInput(body);
      event.result.projection_hash = payload.projection_hash;
      event.result.result_hash = hashExecutionInput(payload.state);
      event.result.state_revision = payload.revision;
    }
    const { event_hash: ignored, ...body } = event;
    event.event_hash = hashExecutionInput(body);
    await writeFile(file, canonicalJson(event));
    const headPath = path.join(storageRoot, "head.json");
    const head = JSON.parse(await readFile(headPath, "utf8"));
    head.latest_event_hash = event.event_hash;
    await writeFile(headPath, canonicalJson(head));
    const journal = createDevOperationJournalService({ storageRoot });
    const fresh = createPiExecutionStateStore({ journal });
    await assert.rejects(fresh.inspect({ operation_id: first.state.operation_id, context }), /CORRUPT_STATE/);
    await assert.rejects(fresh.admit(intent()), /CORRUPT_STATE/);
  });
}

test("altered journal payload is rejected after restart rather than trusting its state", async t => {
  const { store, storageRoot } = await fixture(t);
  await store.admit(intent());
  const names = (await readdir(path.join(storageRoot, "events"))).sort();
  const file = path.join(storageRoot, "events", names.at(-1));
  const event = JSON.parse(await readFile(file, "utf8"));
  event.execution_projection.state.pending_steps = [];
  await writeFile(file, canonicalJson(event));
  const fresh = createPiExecutionStateStore({ journal: createDevOperationJournalService({ storageRoot }) });
  await assert.rejects(fresh.admit(intent()), /CORRUPT_STATE/);
});

for (const stage of ["before_events", "after_started", "after_completed", "after_head"]) {
  test("actual process exit at publication boundary: " + stage, async t => {
    const { store, storageRoot } = await fixture(t);
    const first = await store.admit(intent());
    const source = `import { createDevOperationJournalService } from ${JSON.stringify(journalUrl)};
import { createPiExecutionStateStore } from ${JSON.stringify(storeUrl)};
const journal = createDevOperationJournalService({storageRoot:process.argv[1],
executionPublicationHook: async point => {if(point===${JSON.stringify(stage)}) process.exit(73)}});
const store = createPiExecutionStateStore({journal});
await store.advance(${JSON.stringify(advanceArgs(first, "ADMITTED"))});`;
    await assert.rejects(exec(process.execPath, ["--input-type=module", "-e", source, storageRoot],
      { windowsHide: true, timeout: 30000 }), e => e.code === 73);
    const fresh = createPiExecutionStateStore({ journal: createDevOperationJournalService({ storageRoot }) });
    if (["after_started", "after_completed"].includes(stage)) {
      await assert.rejects(fresh.inspect({ operation_id: first.state.operation_id, context }), /CORRUPT_STATE/);
      await assert.rejects(fresh.admit(intent()), /CORRUPT_STATE/);
    } else {
      const restored = await fresh.inspect({ operation_id: first.state.operation_id, context });
      assert.equal(restored.state.status, stage === "after_head" ? "ADMITTED" : "CREATED");
      const duplicate = await fresh.admit(intent());
      assert.equal(duplicate.revision, restored.revision);
    }
  });
}
