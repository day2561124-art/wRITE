import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  externalBrainSessionClassifications as C,
  scanExternalBrainSessions,
} from "../../server/src/external-brain-session-lineage-service.mjs";
import {
  activeSessionLivenessDiagnostics as D,
  auditActiveExternalBrainSessions,
  buildExternalBrainSessionReconciliationPlan,
  executeExternalBrainSessionReconciliation,
  reconciliationRecommendations as R,
  retireExternalBrainSession,
} from "../../server/src/external-brain-session-reconciliation-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const now = new Date("2026-07-15T12:00:00.000Z");
const fixtureRoot = path.join(projectRoot, "tests", ".tmp", "external-brain-session-phase3b");
const modules = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, json(value), "utf8");
}

function identity(stamp, suffix) {
  return {
    runId: `agent_run_${stamp}-${suffix}`,
    bundleId: `gptctx_${stamp}-${suffix}`,
  };
}

async function makeSession({
  stamp,
  suffix,
  status = "running",
  lifecycle = "ACTIVE",
  createdAt = "2026-07-10T00:00:00.000Z",
  lastActivityAt = createdAt,
  explicitBundle = true,
  bundleStamp = stamp,
  traceSpecs = [],
  retiredAt = null,
}) {
  const { runId } = identity(stamp, suffix);
  const bundleId = `gptctx_${bundleStamp}-${suffix}`;
  const run = {
    run_id: runId,
    task_type: "draft_generation",
    created_at: createdAt,
    updated_at: lastActivityAt,
    created_by: "chatgpt",
    mode: "chatgpt_owned_external_brain",
    external_brain_session_id: runId,
    ...(explicitBundle ? { writing_context_bundle_id: bundleId } : {}),
    session_lifecycle_status: lifecycle,
    last_activity_at: lastActivityAt,
    status,
    output_hash: null,
    warning: false,
    blocked: false,
    ...(retiredAt ? {
      retired_at: retiredAt,
      retired_by: "fixture",
      retirement_reason: "fixture retirement",
    } : {}),
  };
  await writeJson(path.join(fixtureRoot, "data", "agent_runs", runId, "run.json"), run);
  await writeJson(path.join(fixtureRoot, "data", "agent_runs", runId, "neural_modules_used.json"), {
    neural_modules_used: [],
  });
  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "gpt_writing_contexts", bundleId, "bundle.json"),
    { bundle_id: bundleId, created_at: createdAt },
  );
  await writeFile(
    path.join(fixtureRoot, "data", "outputs", "gpt_writing_contexts", bundleId, "context_for_chat.md"),
    "# fixture context\n",
    "utf8",
  );
  const traces = [];
  for (const [index, spec] of traceSpecs.entries()) {
    const traceId = `neural_trace_${stamp}-${(index + 1).toString(16).padStart(8, "0")}`;
    const trace = {
      run_id: runId,
      ...(spec.explicitBundle === false ? {} : explicitBundle ? { writing_context_bundle_id: bundleId } : {}),
      trace_id: traceId,
      task_type: "draft_generation",
      module_name: spec.module_name,
      model_name: "fixture-model",
      model_version: "v1",
      called_at: spec.called_at ?? lastActivityAt,
      input_hash: createHash("sha256").update(`${traceId}:input`).digest("hex"),
      output_hash: createHash("sha256").update(`${traceId}:output`).digest("hex"),
      status: spec.status ?? "success",
      error_message: spec.status === "failed" ? "fixture failure" : null,
    };
    await writeJson(path.join(fixtureRoot, "data", "agent_runs", "neural_traces", `${traceId}.json`), trace);
    traces.push(trace);
  }
  return { runId, bundleId, traces };
}

async function writeTransaction(name, metadata, completedAt = "2026-07-10T00:00:00.000Z") {
  await writeJson(path.join(fixtureRoot, "data", "outputs", "logs", "transactions", `${name}.json`), {
    transaction_id: name,
    name: "fixture",
    status: "committed",
    started_at: completedAt,
    completed_at: completedAt,
    affected_paths: [],
    metadata,
    rollback_available: true,
  });
}

async function recursiveNames(root) {
  try {
    const output = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const target = path.join(root, entry.name);
      if (entry.isDirectory()) {
        for (const child of await recursiveNames(target)) output.push(`${entry.name}/${child}`);
      } else output.push(entry.name);
    }
    return output.sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function productionSnapshot() {
  const roots = [
    projectPaths.gptWritingContexts,
    projectPaths.agentRuns,
    path.join(projectPaths.outputLogs, "transactions"),
    projectPaths.approvalQueue,
    projectPaths.writingWorkflow,
  ];
  return Object.fromEntries(await Promise.all(roots.map(async (root) => [root, await recursiveNames(root)])));
}

function byId(scan, runId) {
  const session = scan.sessions.find((entry) => entry.session_id === runId);
  assert(session, `Missing fixture session ${runId}`);
  return session;
}

const productionBefore = await productionSnapshot();

try {
  await rm(fixtureRoot, { recursive: true, force: true });
  const recent = await makeSession({
    stamp: "20260714-120000", suffix: "00000001",
    createdAt: "2026-07-14T12:00:00.000Z", lastActivityAt: "2026-07-14T12:00:00.000Z",
  });
  const oldRecentTrace = await makeSession({
    stamp: "20260501-010000", suffix: "00000002",
    createdAt: "2026-05-01T01:00:00.000Z", lastActivityAt: "2026-05-01T01:00:00.000Z",
    traceSpecs: [{ module_name: "scene_planner", called_at: "2026-07-14T18:00:00.000Z" }],
  });
  const stale = await makeSession({ stamp: "20260710-020000", suffix: "00000003" });
  const governance = await makeSession({ stamp: "20260710-030000", suffix: "00000004" });
  const acceptance = await makeSession({ stamp: "20260710-040000", suffix: "00000005" });
  const retirement = await makeSession({ stamp: "20260710-050000", suffix: "00000006" });
  const abandonedOld = await makeSession({
    stamp: "20260501-060000", suffix: "00000007", status: "running", lifecycle: "ABANDONED",
    createdAt: "2026-05-01T06:00:00.000Z", lastActivityAt: "2026-05-02T06:00:00.000Z",
    retiredAt: "2026-05-02T06:00:00.000Z",
  });
  const exactCompletion = await makeSession({
    stamp: "20260710-070000", suffix: "00000008",
    traceSpecs: [...modules.map((module_name) => ({ module_name })), { module_name: "final_polisher" }],
  });
  const failedFinal = await makeSession({
    stamp: "20260710-080000", suffix: "00000009",
    traceSpecs: [{ module_name: "final_polisher", status: "failed" }],
  });
  const recoverable = await makeSession({
    stamp: "20260501-090000", bundleStamp: "20260502-090000", suffix: "0000000a",
    status: "success", lifecycle: "COMPLETED", explicitBundle: false,
    createdAt: "2026-05-01T09:00:00.000Z", lastActivityAt: "2026-05-01T09:01:00.000Z",
  });
  const split = await makeSession({
    stamp: "20260501-100000", bundleStamp: "20260502-100000", suffix: "0000000b",
    status: "success", lifecycle: "COMPLETED", explicitBundle: false,
  });
  const conflict = await makeSession({
    stamp: "20260501-110000", bundleStamp: "20260502-110000", suffix: "0000000c",
    status: "success", lifecycle: "COMPLETED", explicitBundle: false,
  });
  const conflictBundle2 = "gptctx_20260503-110000-0000000c";
  await writeJson(path.join(fixtureRoot, "data", "outputs", "gpt_writing_contexts", conflictBundle2, "bundle.json"), {
    bundle_id: conflictBundle2,
  });
  const lateGovernance = await makeSession({ stamp: "20260710-120000", suffix: "0000000d" });

  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", "writing_candidate_20260710-030100-00000004", "metadata.json"),
    { candidate_id: "writing_candidate_20260710-030100-00000004", source_bundle_id: governance.bundleId },
  );
  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", "writing_candidate_20260710-030100-00000004", "status.json"),
    { status: "candidate_only" },
  );
  await writeJson(path.join(fixtureRoot, "config", "phase47-fixture-acceptance-evidence.json"), {
    external_brain_session_id: acceptance.runId,
    writing_context_bundle_id: acceptance.bundleId,
  });
  await writeTransaction("TX-RECOVERABLE", {
    run_id: recoverable.runId,
    writing_context_bundle_id: recoverable.bundleId,
  });
  await writeTransaction("TX-SPLIT-RUN", { run_id: split.runId });
  await writeTransaction("TX-SPLIT-BUNDLE", { bundle_id: split.bundleId }, "2026-07-10T00:00:00.001Z");
  await writeTransaction("TX-CONFLICT-1", { run_id: conflict.runId, bundle_id: conflict.bundleId });
  await writeTransaction("TX-CONFLICT-2", { run_id: conflict.runId, bundle_id: conflictBundle2 });

  const options = { fixtureRoot, now };
  let scan = await scanExternalBrainSessions({}, options);
  assert.equal(byId(scan, recent.runId).classification, C.ACTIVE_SESSION);
  assert.equal(byId(scan, oldRecentTrace.runId).classification, C.ACTIVE_SESSION);
  assert.equal(byId(scan, stale.runId).classification, C.STALE_ACTIVE_SESSION);
  assert.equal(byId(scan, stale.runId).status, "needs_review");
  assert.equal(scan.eligible_items.some((item) => item.session_id === stale.runId), false);
  assert.equal(byId(scan, governance.runId).classification, C.GOVERNANCE_PINNED_SESSION);
  assert.equal(byId(scan, acceptance.runId).classification, C.ACCEPTANCE_EVIDENCE_PINNED_SESSION);
  assert.equal(byId(scan, abandonedOld.runId).classification, C.ABANDONED_SESSION);
  assert.equal(byId(scan, abandonedOld.runId).status, "eligible_for_cleanup");
  assert.notEqual(byId(scan, failedFinal.runId).classification, C.COMPLETED_UNADOPTED_SESSION);

  const protectedSentinel = path.join(fixtureRoot, "data", "canon_db", "active_engine.md");
  const candidateSentinel = path.join(fixtureRoot, "data", "writing_workflow", "candidate_drafts", "sentinel.json");
  const settlementSentinel = path.join(fixtureRoot, "data", "writing_workflow", "settlements", "contexts", "sentinel.json");
  await mkdir(path.dirname(protectedSentinel), { recursive: true });
  await writeFile(protectedSentinel, "protected\n", "utf8");
  await writeJson(candidateSentinel, { protected: true });
  await writeJson(settlementSentinel, { protected: true });
  const sentinelsBefore = await Promise.all(
    [protectedSentinel, candidateSentinel, settlementSentinel].map((filePath) => readFile(filePath)),
  );
  await retireExternalBrainSession(retirement.runId, {
    retired_by: "phase3b_test",
    retirement_reason: "operator ended the fixture session",
  }, options);
  scan = await scanExternalBrainSessions({}, options);
  assert.equal(byId(scan, retirement.runId).classification, C.ABANDONED_SESSION);
  assert.equal(byId(scan, retirement.runId).status, "must_keep");
  const retiredRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", retirement.runId, "run.json"), "utf8"));
  assert.equal(retiredRun.status, "running");
  assert.equal(retiredRun.session_lifecycle_status, "ABANDONED");
  const sentinelsAfter = await Promise.all(
    [protectedSentinel, candidateSentinel, settlementSentinel].map((filePath) => readFile(filePath)),
  );
  assert.deepEqual(sentinelsAfter, sentinelsBefore);

  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", "writing_candidate_20260710-120100-0000000d", "metadata.json"),
    { candidate_id: "writing_candidate_20260710-120100-0000000d", source_bundle_id: lateGovernance.bundleId },
  );
  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", "writing_candidate_20260710-120100-0000000d", "status.json"),
    { status: "candidate_only" },
  );
  await assert.rejects(
    () => retireExternalBrainSession(lateGovernance.runId, {
      retired_by: "phase3b_test",
      retirement_reason: "must be blocked",
    }, options),
    /blocked by a live governance/iu,
  );

  const liveness = await auditActiveExternalBrainSessions({}, options);
  const exactLiveness = liveness.sessions.find((item) => item.session_id === exactCompletion.runId);
  assert.equal(exactLiveness.diagnostic, D.FINAL_POLISHER_COMPLETED_BUT_RUN_STILL_RUNNING);
  assert.equal(exactLiveness.recommendation, R.DETERMINISTIC_COMPLETION_RECONCILIATION);
  const failedLiveness = liveness.sessions.find((item) => item.session_id === failedFinal.runId);
  assert.notEqual(failedLiveness.recommendation, R.DETERMINISTIC_COMPLETION_RECONCILIATION);

  const plan = await buildExternalBrainSessionReconciliationPlan({}, options);
  const backfillItem = plan.items.find((item) => item.session_id === recoverable.runId && item.action === R.DETERMINISTIC_BACKFILL);
  assert(backfillItem);
  assert.deepEqual(backfillItem.recovered_bundle_ids, [recoverable.bundleId]);
  assert.match(backfillItem.deterministic_evidence_sources[0].source_sha256, /^[a-f0-9]{64}$/u);
  const splitItem = plan.items.find((item) => item.session_id === split.runId && item.before_classification);
  assert.equal(splitItem.action, R.REVIEW_REQUIRED);
  assert.deepEqual(splitItem.recovered_bundle_ids, []);
  const conflictItem = plan.items.find((item) => item.session_id === conflict.runId && item.before_classification);
  assert.equal(conflictItem.action, R.REVIEW_REQUIRED);
  assert.equal(conflictItem.remaining_ambiguity, "multiple_deterministic_bundle_candidates");

  const execution = await executeExternalBrainSessionReconciliation(plan, {
    confirm: true,
    actor: "phase3b_test",
  }, options);
  assert.equal(execution.executed_count, 2);
  assert.equal(execution.automatic_retirement_count, 0);
  assert.equal(execution.production_cleanup_count, 0);
  const backfillAudit = execution.results.find((result) => (
    result.audit.schema_version === "external-brain-session-lineage-backfill-audit-v1"
  )).audit;
  assert.deepEqual(backfillAudit.evidence_sha256, [backfillItem.deterministic_evidence_sources[0].source_sha256]);
  const backfilledRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", recoverable.runId, "run.json"), "utf8"));
  assert.equal(backfilledRun.writing_context_bundle_id, recoverable.bundleId);
  assert.equal(backfilledRun.external_brain_session_id, recoverable.runId);
  const completedRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", exactCompletion.runId, "run.json"), "utf8"));
  assert.equal(completedRun.status, "success");
  assert.equal(completedRun.session_lifecycle_status, "COMPLETED");
  assert.equal(completedRun.output_hash, exactCompletion.traces.at(-1).output_hash);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

const productionAfter = await productionSnapshot();
assert.deepEqual(productionAfter, productionBefore, "Phase 3B tests created production session residue.");

console.log("External brain session retirement, stale activity, deterministic reconciliation, and residue regression PASS.");
