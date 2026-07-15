import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  approveCleanupProposal,
  createCleanupProposal,
  executeCleanupProposal,
} from "../../server/src/cleanup-proposal-service.mjs";
import {
  externalBrainSessionClassifications as C,
  scanExternalBrainSessions,
} from "../../server/src/external-brain-session-lineage-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const now = new Date("2026-07-15T00:00:00.000Z");
const fixtureRoot = path.join(projectRoot, "tests", ".tmp", "external-brain-session-lineage");
const executionFixtureRoot = path.join(projectRoot, "tests", ".tmp", "external-brain-session-execution");
const modules = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
  "final_polisher",
];

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, json(value), "utf8");
}

function ids(stamp, suffix) {
  return {
    runId: `agent_run_${stamp}-${suffix}`,
    bundleId: `gptctx_${stamp}-${suffix}`,
  };
}

async function makeSession(root, {
  stamp,
  suffix,
  status = "success",
  taskType = "draft_generation",
  explicitBundle = true,
  traceModules = [],
  createdAt = "2026-05-01T00:00:00.000Z",
}) {
  const { runId, bundleId } = ids(stamp, suffix);
  const run = {
    run_id: runId,
    task_type: taskType,
    created_at: createdAt,
    updated_at: createdAt,
    created_by: taskType === "test" ? "phase3a_test" : "chatgpt",
    mode: "chatgpt_owned_external_brain",
    external_brain_session_id: runId,
    ...(explicitBundle ? { writing_context_bundle_id: bundleId } : {}),
    status,
    blocked: status === "failed",
  };
  await writeJson(path.join(root, "data", "agent_runs", runId, "run.json"), run);
  await writeJson(
    path.join(root, "data", "outputs", "gpt_writing_contexts", bundleId, "bundle.json"),
    { bundle_id: bundleId, bundle_kind: "gpt_writing_context", created_at: createdAt },
  );
  await writeFile(
    path.join(root, "data", "outputs", "gpt_writing_contexts", bundleId, "context_for_chat.md"),
    "# synthetic context\n",
    "utf8",
  );
  const traceIds = [];
  for (const [index, moduleName] of traceModules.entries()) {
    const traceId = `neural_trace_${stamp}-${String(index + 1).padStart(8, "0")}`;
    const outputHash = createHash("sha256").update(`${runId}:${moduleName}`).digest("hex");
    const trace = {
      run_id: runId,
      ...(explicitBundle ? { writing_context_bundle_id: bundleId } : {}),
      trace_id: traceId,
      module_name: moduleName,
      task_type: taskType,
      called_at: createdAt,
      output_hash: outputHash,
      status: "success",
    };
    await writeJson(path.join(root, "data", "agent_runs", "neural_traces", `${traceId}.json`), trace);
    if (index < 5 && explicitBundle) {
      await writeJson(
        path.join(root, "data", "agent_runs", "neural_outputs", runId, bundleId, moduleName, `${traceId}.json`),
        {
          run_id: runId,
          external_brain_session_id: runId,
          writing_context_bundle_id: bundleId,
          trace_id: traceId,
          module_name: moduleName,
          output_hash: outputHash,
        },
      );
    }
    traceIds.push(traceId);
  }
  return { runId, bundleId, traceIds };
}

async function recursiveNames(root) {
  try {
    const output = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const target = path.join(root, entry.name);
      if (entry.isDirectory()) {
        for (const child of await recursiveNames(target)) output.push(`${entry.name}/${child}`);
      } else {
        output.push(entry.name);
      }
    }
    return output.sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function productionResidueSnapshot() {
  const roots = [
    projectPaths.gptWritingContexts,
    projectPaths.agentRuns,
    path.join(projectPaths.outputLogs, "transactions"),
    projectPaths.approvalQueue,
    projectPaths.writingWorkflow,
  ];
  return Object.fromEntries(await Promise.all(roots.map(async (root) => [
    root,
    await recursiveNames(root),
  ])));
}

function byId(scan, id) {
  const session = scan.sessions.find((entry) => entry.session_id === id);
  assert(session, `missing session ${id}`);
  return session;
}

const productionBefore = await productionResidueSnapshot();

try {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(executionFixtureRoot, { recursive: true, force: true });

  const active = await makeSession(fixtureRoot, {
    stamp: "20260714-010000", suffix: "00000001", status: "running",
    createdAt: "2026-07-14T01:00:00.000Z", traceModules: [],
  });
  const governance = await makeSession(fixtureRoot, {
    stamp: "20260501-020000", suffix: "00000002", traceModules: ["scene_planner"],
  });
  const acceptance = await makeSession(fixtureRoot, {
    stamp: "20260501-030000", suffix: "00000003", traceModules: ["scene_planner"],
  });
  const completed = await makeSession(fixtureRoot, {
    stamp: "20260501-040000", suffix: "00000004", traceModules: modules,
  });
  const recent = await makeSession(fixtureRoot, {
    stamp: "20260714-010000", suffix: "00000005", createdAt: "2026-07-14T01:00:00.000Z", traceModules: ["scene_planner"],
  });
  const failed = await makeSession(fixtureRoot, {
    stamp: "20260501-060000", suffix: "00000006", status: "failed", traceModules: ["scene_planner"],
  });
  const testSession = await makeSession(fixtureRoot, {
    stamp: "20260501-070000", suffix: "00000007", taskType: "test", traceModules: ["scene_planner"],
  });
  const inferred = await makeSession(fixtureRoot, {
    stamp: "20260501-080000", suffix: "00000008", explicitBundle: false, traceModules: [],
  });
  const unknown = ids("20260501-090000", "00000009");
  await mkdir(path.join(fixtureRoot, "data", "agent_runs", unknown.runId), { recursive: true });

  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", "writing_candidate_20260501-020100-00000002", "metadata.json"),
    {
      candidate_id: "writing_candidate_20260501-020100-00000002",
      source_bundle_id: governance.bundleId,
      canon_status: "candidate_only",
      adopted: false,
    },
  );
  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", "writing_candidate_20260501-020100-00000002", "status.json"),
    { status: "candidate_only" },
  );
  await writeJson(
    path.join(fixtureRoot, "config", "phase47-test-acceptance-evidence.json"),
    {
      phase: "47-test",
      immutable_evidence_record: true,
      external_brain_session_id: acceptance.runId,
      writing_context_bundle_id: acceptance.bundleId,
      trace_id: acceptance.traceIds[0],
    },
  );

  const options = { fixtureRoot, now };
  const scan = await scanExternalBrainSessions({}, options);
  assert.equal(byId(scan, active.runId).classification, C.ACTIVE_SESSION);
  assert.equal(byId(scan, active.runId).status, "must_keep");
  assert.equal(byId(scan, governance.runId).classification, C.GOVERNANCE_PINNED_SESSION);
  assert.equal(byId(scan, governance.runId).status, "must_keep");
  assert.equal(byId(scan, acceptance.runId).classification, C.ACCEPTANCE_EVIDENCE_PINNED_SESSION);
  assert.equal(byId(scan, acceptance.runId).status, "must_keep");
  assert.equal(byId(scan, completed.runId).classification, C.COMPLETED_UNADOPTED_SESSION);
  assert.equal(byId(scan, completed.runId).status, "eligible_for_cleanup");
  assert.equal(byId(scan, recent.runId).classification, C.COMPLETED_UNADOPTED_SESSION);
  assert.equal(byId(scan, recent.runId).status, "must_keep");
  assert.equal(byId(scan, failed.runId).classification, C.FAILED_OR_BLOCKED_SESSION);
  assert.equal(byId(scan, failed.runId).status, "needs_review");
  assert.equal(byId(scan, testSession.runId).classification, C.TEST_SESSION);
  assert.equal(byId(scan, testSession.runId).status, "eligible_for_cleanup");
  assert.equal(byId(scan, unknown.runId).classification, C.UNKNOWN_SESSION);
  assert.equal(byId(scan, unknown.runId).status, "blocked_from_cleanup");
  assert.equal(byId(scan, inferred.runId).classification, C.INCOMPLETE_SESSION);
  assert.equal(byId(scan, inferred.runId).status, "needs_review");
  assert.equal(byId(scan, inferred.runId).writing_context_bundle_ids.length, 0);
  assert.equal(byId(scan, inferred.runId).inferred_reference_count, 1);

  const completeLineage = byId(scan, completed.runId);
  assert.deepEqual(completeLineage.writing_context_bundle_ids, [completed.bundleId]);
  assert.equal(completeLineage.neural_trace_ids.length, 7);
  assert.equal(completeLineage.final_polisher_trace_ids.length, 1);
  assert.equal(completeLineage.neural_output_references.length, 5);
  assert.equal(completeLineage.ownership_proof_complete, true);

  const proposal = await createCleanupProposal({
    title: "Synthetic external brain session cleanup",
  }, options);
  const sessionItems = proposal.eligible_items.filter((item) => item.item_type === "external_brain_session");
  assert.equal(sessionItems.filter((item) => item.session_id === completed.runId).length, 1);
  assert.equal(sessionItems.find((item) => item.session_id === completed.runId).neural_trace_ids.length, 7);
  await approveCleanupProposal(proposal.cleanup_proposal_id, { confirm: true, approvedBy: "phase3a_test" }, options);

  const lateCandidateId = "writing_candidate_20260715-000001-00000004";
  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", lateCandidateId, "metadata.json"),
    { candidate_id: lateCandidateId, source_bundle_id: completed.bundleId, canon_status: "candidate_only" },
  );
  await writeJson(
    path.join(fixtureRoot, "data", "outputs", "writing_candidates", lateCandidateId, "status.json"),
    { status: "candidate_only" },
  );
  await assert.rejects(
    () => executeCleanupProposal(
      proposal.cleanup_proposal_id,
      { confirm: true, approvedBy: "phase3a_test" },
      options,
    ),
    /no longer eligible|lineage changed/iu,
  );
  await stat(path.join(fixtureRoot, "data", "agent_runs", completed.runId, "run.json"));

  const executable = await makeSession(executionFixtureRoot, {
    stamp: "20260502-010000", suffix: "10000001", traceModules: modules,
  });
  const executionOptions = { fixtureRoot: executionFixtureRoot, now };
  const executionProposal = await createCleanupProposal({ title: "Executable fixture session" }, executionOptions);
  assert.equal(executionProposal.eligible_items.length, 1);
  assert.equal(executionProposal.eligible_items[0].session_id, executable.runId);
  await approveCleanupProposal(
    executionProposal.cleanup_proposal_id,
    { confirm: true, approvedBy: "phase3a_test" },
    executionOptions,
  );
  const execution = await executeCleanupProposal(
    executionProposal.cleanup_proposal_id,
    { confirm: true, approvedBy: "phase3a_test" },
    executionOptions,
  );
  assert.equal(execution.moved_items.length, 1);
  assert.equal(execution.moved_items[0].deleted_file_count, 15);
  await assert.rejects(
    () => stat(path.join(executionFixtureRoot, "data", "agent_runs", executable.runId)),
    { code: "ENOENT" },
  );
  const tombstoneNames = await readdir(path.join(executionFixtureRoot, "data", "cleanup", "tombstones"));
  assert.equal(tombstoneNames.length, 1);
  const tombstone = JSON.parse(await readFile(
    path.join(executionFixtureRoot, "data", "cleanup", "tombstones", tombstoneNames[0]),
    "utf8",
  ));
  assert.equal(tombstone.session_id, executable.runId);
  assert.equal(tombstone.classification_at_cleanup, C.COMPLETED_UNADOPTED_SESSION);
  assert.equal(tombstone.deleted_file_count, 15);
  assert.equal(tombstone.approved_by, "phase3a_test");
  assert.equal(Object.hasOwn(tombstone, "raw_context_prose"), false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(executionFixtureRoot, { recursive: true, force: true });
}

const productionAfter = await productionResidueSnapshot();
assert.deepEqual(productionAfter, productionBefore, "Phase 3A tests created production session residue.");

console.log("External brain session lineage, retention, cleanup, live re-evaluation, and residue regression PASS.");
