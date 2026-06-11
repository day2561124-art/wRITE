import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createAgentRun } from "../../server/src/agent-run-service.mjs";
import { createApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import {
  describeSourceFile,
  readonlyToolMetadata,
  readonlyTools,
} from "../../server/src/mcp-readonly-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  adoptCandidateDraft,
  saveCandidateDraft,
  saveProofReport,
  updateCandidateDraftStatus,
} from "../../server/src/writing-workflow-service.mjs";

const fixtureCanon = path.join(projectPaths.canonDb, ".mcp-readonly-test");
const fixtureActive = path.join(fixtureCanon, "active_engine.md");
const fixturePending = path.join(fixtureCanon, "pending_engine_candidates");
const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".mcp-readonly-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".mcp-readonly-test");
const fixtureCleanup = path.join(projectPaths.cleanupRoot, ".mcp-readonly-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

const options = {
  writingWorkflow: fixtureWorkflow,
  activeEnginePath: fixtureActive,
  pendingEngineCandidates: fixturePending,
  approvalQueue: fixtureApproval,
  cleanupRoot: fixtureCleanup,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function snapshot(paths) {
  const values = new Map();
  for (const filePath of paths) {
    try {
      values.set(filePath, await readFile(filePath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      values.set(filePath, null);
    }
  }
  return values;
}

async function assertSnapshotUnchanged(before) {
  for (const [filePath, prior] of before) {
    try {
      const current = await readFile(filePath);
      assert(prior !== null, `File was created by read-only tools: ${filePath}`);
      assert(current.equals(prior), `File changed after read-only tools: ${filePath}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert(prior === null, `File was removed by read-only tools: ${filePath}`);
    }
  }
}

function settlement(candidateText) {
  return `## 新版完整創作引擎候選\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function expectReject(action, message) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
}

async function setupCleanupProposal() {
  const proposalId = "cleanup_proposal_20240101-000000-1234abcd";
  const directory = path.join(fixtureCleanup, "proposals", proposalId);
  const proposal = {
    cleanup_proposal_id: proposalId,
    created_at: "2024-01-01T00:00:00.000Z",
    created_by: "readonly_test",
    title: "Read-only cleanup proposal fixture",
    summary: "Fixture only.",
    retention_policy: {
      keep_latest_archives: 10,
      keep_latest_snapshots: 10,
      rejected_candidate_days: 90,
      failed_candidate_days: 90,
      blocked_candidate_days: 90,
      trash_retention_days: 30,
    },
    eligible_items: [],
    must_keep_items: [],
    needs_review_items: [],
    blocked_items: [],
    risk_summary: {
      high_risk_count: 0,
      pinned_count: 0,
      rollback_required_count: 0,
      eligible_count: 0,
    },
  };
  await writeJson(path.join(directory, "proposal.json"), proposal);
  await writeJson(path.join(directory, "status.json"), {
    status: "draft",
    approved_at: null,
    rejected_at: null,
    deferred_at: null,
    executed_at: null,
    reason: null,
    can_execute: false,
  });
  await writeJson(path.join(directory, "scan_report.json"), {
    scanned_at: "2024-01-01T00:00:00.000Z",
    retention_policy: proposal.retention_policy,
    eligible_items: [],
    must_keep_items: [],
    needs_review_items: [],
    blocked_items: [],
    risk_summary: proposal.risk_summary,
  });
}

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = hash(productionActive);
  const agentRunsBefore = await names(projectPaths.agentRuns);
  const transactionsBefore = await names(transactionDir);
  await Promise.all([
    rm(fixtureCanon, { recursive: true, force: true }),
    rm(fixtureWorkflow, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
    rm(fixtureCleanup, { recursive: true, force: true }),
  ]);
  await mkdir(fixtureCanon, { recursive: true });
  await writeFile(fixtureActive, productionActive);

  try {
    const draft = await saveCandidateDraft({
      draftText: "# Read-only candidate draft\n\nFixture text.",
      sourceChapter: "Read-only fixture",
    }, options);
    await saveProofReport({
      draftId: draft.metadata.draft_id,
      proofText: "## P2\nMinor issue.\n\n## P4\nSmall note.",
    }, options);
    const adopted = await adoptCandidateDraft(draft.metadata.draft_id, {
      confirm: true,
      adoptedBy: "readonly_test",
    }, options);
    await updateCandidateDraftStatus(draft.metadata.draft_id, {
      status: "blocked",
      blocked_reason: "readonly inactive fixture",
    }, options);

    const candidate = await importSettlementResult({
      rawText: settlement(`${productionActive.toString("utf8").trimEnd()}\n\n## Read-only candidate marker\n`),
      sourceChapter: "Read-only fixture",
    }, options);
    const approvalItem = await createApprovalItem({
      actionType: "activate_engine_candidate",
      targetType: "pending_engine_candidate",
      targetId: candidate.metadata.candidate_id,
      title: "Readonly approval item",
      riskLevel: candidate.risk_report.risk_level,
      links: { candidate_id: candidate.metadata.candidate_id },
    }, options);
    await setupCleanupProposal();
    const run = await createAgentRun({
      task_type: "test",
      requires_neural_modules: true,
      required_neural_modules: ["scene_planner"],
      input: "No success trace for read-only test.",
    });

    const watched = await snapshot([
      projectPaths.activeEngine,
      fixtureActive,
      path.join(fixturePending, candidate.metadata.candidate_id, "status.json"),
      path.join(fixtureApproval, "items", approvalItem.approval_item_id, "status.json"),
      path.join(fixtureCleanup, "proposals", "cleanup_proposal_20240101-000000-1234abcd", "status.json"),
      path.join(projectPaths.agentRuns, run.run_id, "neural_modules_used.json"),
    ]);
    const pendingBefore = await names(fixturePending);
    const approvalBefore = await names(path.join(fixtureApproval, "items"));
    const cleanupBefore = await names(path.join(fixtureCleanup, "proposals"));

    const source = await describeSourceFile("active_engine", fixtureActive, "active");
    assert(source.exists && source.hash === hash(productionActive), "Source metadata hash was wrong.");
    assert(source.source_path.endsWith("data/canon_db/.mcp-readonly-test/active_engine.md"), "Source path was wrong.");

    for (const [name, metadata] of Object.entries(readonlyToolMetadata)) {
      assert(metadata.permission === "read_only", `${name} permission was not read_only.`);
      assert(metadata.writes_files === false, `${name} writes_files was not false.`);
      assert(metadata.can_modify_active_engine === false, `${name} can_modify_active_engine was not false.`);
      assert(metadata.requires_user_confirmation === false, `${name} unexpectedly requires confirmation.`);
      assert(typeof readonlyTools[name] === "function", `${name} function was not exported.`);
    }

    const active = await readonlyTools.get_active_engine({}, options);
    assert(active.ok && active.data.content.includes("#"), "Active engine read failed.");
    assert(active.sources[0].canon_status === "active", "Active source canon_status was wrong.");
    const missing = await readonlyTools.get_active_engine({}, {
      ...options,
      activeEnginePath: path.join(fixtureCanon, "missing_active_engine.md"),
    });
    assert(missing.blocked && missing.blocked_reason === "active_engine_missing", "Missing active was not blocked.");

    for (const name of [
      "get_active_writing_card",
      "get_active_proofing_card",
      "get_active_longline",
      "get_generation_context",
      "get_retrieval_context",
      "get_task_prompt",
    ]) {
      const result = await readonlyTools[name]({}, options);
      assert("sources" in result && Array.isArray(result.sources), `${name} omitted sources.`);
      assert(result.blocked === false, `${name} unexpectedly blocked.`);
    }

    const latestDraft = await readonlyTools.get_latest_candidate_draft({}, options);
    assert(latestDraft.ok, "Latest draft read failed.");
    assert(latestDraft.data.active_canon === false, "Candidate draft was marked active canon.");
    assert(latestDraft.canon_status === "inactive_candidate", "Blocked draft was not inactive.");

    const latestProof = await readonlyTools.get_latest_proof_report({}, options);
    assert(latestProof.data.issue_summary.p2_count === 1, "Proof P2 count was wrong.");
    assert(latestProof.data.issue_summary.p4_count === 1, "Proof P4 count was wrong.");

    const latestAdopted = await readonlyTools.get_latest_adopted_chapter({}, options);
    assert(latestAdopted.data.active_canon === false, "Adopted chapter was marked active canon.");
    assert(
      latestAdopted.canon_status === "adopted_pending_settlement",
      "Adopted chapter canon status was wrong.",
    );
    assert(latestAdopted.data.adopted_chapter_id === adopted.metadata.adopted_chapter_id, "Adopted id was wrong.");

    const pending = await readonlyTools.get_pending_engine_candidates({}, options);
    assert(pending.data.count === 1, "Pending candidate count was wrong.");
    assert(pending.data.candidates[0].active_canon === false, "Pending candidate was marked active.");

    const approval = await readonlyTools.get_approval_queue_status({}, options);
    assert(approval.data.counts.pending === 1, "Approval pending count was wrong.");

    const neural = await readonlyTools.get_neural_usage_for_run({ run_id: run.run_id }, options);
    assert(neural.ok && neural.data.warning === true, "Neural missing warning was not reported.");
    assert(neural.warnings.includes("neural_trace_missing"), "Neural warning label was absent.");
    await expectReject(
      () => readonlyTools.get_neural_usage_for_run({ run_id: "../active_engine.md" }, options),
      "run_id traversal was accepted.",
    );

    const cleanup = await readonlyTools.get_cleanup_proposals({}, options);
    assert(cleanup.data.count === 1, "Cleanup proposal count was wrong.");
    assert(cleanup.data.proposals[0].status === "draft", "Cleanup proposal status was wrong.");

    const project = await readonlyTools.get_project_status({}, options);
    assert(project.ok, "Project status failed.");
    assert(project.data.counts.candidate_drafts === 1, "Project status draft count was wrong.");
    assert(project.data.counts.pending_engine_candidates === 1, "Project status pending count was wrong.");
    assert(project.data.counts.approval_queue_pending === 1, "Project status approval count was wrong.");
    assert(project.data.counts.cleanup_proposals === 1, "Project status cleanup count was wrong.");

    await assertSnapshotUnchanged(watched);
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production active changed.");
    assert(
      JSON.stringify([...await names(fixturePending)].sort()) === JSON.stringify([...pendingBefore].sort()),
      "Read-only tools created or removed pending candidates.",
    );
    assert(
      JSON.stringify([...await names(path.join(fixtureApproval, "items"))].sort())
        === JSON.stringify([...approvalBefore].sort()),
      "Read-only tools created or removed approval items.",
    );
    assert(
      JSON.stringify([...await names(path.join(fixtureCleanup, "proposals"))].sort())
        === JSON.stringify([...cleanupBefore].sort()),
      "Read-only tools created or removed cleanup proposals.",
    );

    console.log("MCP read-only tools test passed.");
  } finally {
    await Promise.all([
      rm(fixtureCanon, { recursive: true, force: true }),
      rm(fixtureWorkflow, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
      rm(fixtureCleanup, { recursive: true, force: true }),
    ]);
    await removeNew(projectPaths.agentRuns, agentRunsBefore);
    await removeNew(transactionDir, transactionsBefore);
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Cleanup changed active.");
  }
}

main().catch((error) => {
  console.error(`MCP read-only tools test failed: ${error.message}`);
  process.exitCode = 1;
});
