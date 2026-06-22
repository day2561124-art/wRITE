import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAdoptedWritingSettlementContext,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import {
  buildApprovalQueueReadinessReport,
} from "../../server/src/approval-queue-readiness-service.mjs";
import { getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import {
  getWritingCandidateDetail,
} from "../../server/src/chat-output-candidate-service.mjs";
import { approvalQueueReadinessTools } from "../../server/src/mcp-approval-queue-readiness-tools.mjs";
import { adoptedWritingSettlementTools } from "../../server/src/mcp-adopted-writing-settlement-tools.mjs";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";
import {
  getAdoptedWritingDetail,
  listAdoptedWritings,
} from "../../server/src/writing-candidate-adoption-service.mjs";

const suffix = ".phase27i-foreshadowing-settlement-live-adoption-smoke-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
  settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, suffix),
  pendingEngineCandidates: path.join(projectPaths.pendingEngineCandidates, suffix),
  activeEnginePath,
};

const root = process.cwd();
const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
  projectPaths.entityRegistryData,
  projectPaths.entityRegistryIndex,
  projectPaths.entityRegistryBuildReport,
  projectPaths.entityRegistryConflictReport,
  projectPaths.entityRegistryProvenance,
  projectPaths.visualIndex,
];

const REQUIRED_NEURAL_MODULES = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function hashFile(filePath) {
  return hash(await readFile(filePath));
}

async function snapshotProtectedFiles() {
  const entries = await Promise.all(protectedFiles.map(async (filePath) => [filePath, await hashFile(filePath)]));
  return new Map(entries);
}

async function assertProtectedFilesUnchanged(before) {
  for (const [filePath, expectedHash] of before.entries()) {
    assert.equal(await hashFile(filePath), expectedHash, `${filePath} must remain unchanged`);
  }
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

async function resetFixtureDirectories() {
  await Promise.all([
    ...Object.values(options)
      .filter((value) => value !== activeEnginePath)
      .map((directory) => rm(directory, { recursive: true, force: true })),
    rm(activeEnginePath, { force: true }),
  ]);
}

async function markCandidateNeuralTraceComplete(candidateId) {
  const metaPath = path.join(options.writingCandidates, candidateId, "candidate.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.missing_required_neural_modules = [];
  meta.neural_trace_complete = true;
  meta.neural_modules_used = REQUIRED_NEURAL_MODULES;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

function result(response, label) {
  assert.equal(response.ok, true, `${label} failed: ${response.blocked_reason ?? response.error ?? "unknown"}`);
  assert.notEqual(response.blocked, true, `${label} was blocked: ${response.blocked_reason}`);
  return response.result;
}

const graphFixture = {
  story_context_id: "phase27i_live_adoption_smoke",
  foreshadowing_debts: [
    {
      debt_id: "sealed_gate_warning",
      label: "Gate warning must become a confirmed route-loss consequence.",
      promise: "A sealed gate warning must cost the team their return route.",
      required_payoff_type: "changed_state",
      current_status: "payoff_ready",
      severity: "hard",
      evidence: ["The gate warning appears before the retreat route is chosen."],
      expected_payoff_signals: ["gate sealed", "return route lost"],
    },
    {
      debt_id: "mirror_name_aftershock",
      label: "Mirror name remains unresolved after adoption.",
      promise: "A reflected name remains open for a later identity reveal.",
      required_payoff_type: "reveal",
      current_status: "open",
      severity: "soft",
      evidence: ["The mirror only shows the first character of the name."],
    },
  ],
  candidate_payoff_events: [
    {
      payoff_id: "sealed_gate_route_loss_payoff",
      debt_id: "sealed_gate_warning",
      payoff_types: ["action", "changed_state", "route_loss"],
      consequence: "The sealed gate cuts off the return route after the earlier warning.",
      evidence: ["The gate locks behind the team and removes the retreat route."],
      confidence: 0.94,
    },
  ],
  current_chapter_focus: ["sealed_gate_warning"],
  open_debt_policy: "allow_soft_open_debts",
};

let generationCalls = 0;
let polisherCalls = 0;

const generationAdapter = async (payload) => {
  generationCalls += 1;
  assert.equal(payload.foreshadowing_causal_graph.used, true);
  assert.equal(payload.foreshadowing_payoff_guard.used, false);
  assert.equal(payload.foreshadowing_payoff_repair_planner.used, false);
  assert.equal(payload.foreshadowing_payoff_acceptance_gate.used, false);
  assert.equal(payload.foreshadowing_settlement_diff_preview.used, false);
  return {
    text: [
      "# Phase 27I Fixture Chapter",
      "",
      "The sealed gate warning stopped being a symbol when the lock slammed down behind them.",
      "Their return route vanished, and the mirror name stayed half-lit for another night.",
    ].join("\n"),
    provider_trace_id: "phase27i-generation",
    foreshadowing_payoffs: [
      {
        id: "sealed_gate_route_loss_payoff",
        debt_id: "sealed_gate_warning",
        payoff_types: ["action", "changed_state", "route_loss"],
        consequence: "The gate locks behind the team and removes the retreat route.",
        evidence: ["The gate locks behind the team and removes the retreat route."],
        confidence: 0.94,
      },
    ],
  };
};

const finalPolisherAdapter = async (payload) => {
  polisherCalls += 1;
  assert.equal(payload.foreshadowing_payoff_guard.used, true);
  assert.equal(payload.foreshadowing_payoff_repair_planner.used, true);
  assert.equal(payload.foreshadowing_payoff_acceptance_gate.used, false);
  assert.equal(payload.foreshadowing_settlement_diff_preview.used, false);
  return {
    status: "completed",
    polished_text: payload.raw_draft_text,
    needs_structural_revision: false,
    warnings: [],
    foreshadowing_payoffs: payload.foreshadowing_payoff_guard.detected_payoffs,
  };
};

const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const transactionsBefore = await names(transactionDir);
const protectedBefore = await snapshotProtectedFiles();
const productionHash = await hashFile(projectPaths.activeEngine);
const productionPendingBefore = await names(projectPaths.pendingEngineCandidates);
const activeText = "# Phase27I Fixture Engine\n\nRule 1: live-like adoption smoke fixture.\n";

await resetFixtureDirectories();
await mkdir(path.dirname(activeEnginePath), { recursive: true });
await writeFile(activeEnginePath, activeText, "utf8");

try {
  const pipeline = await runFullRecursiveWritingPipeline({
    task_prompt: "Write a fixture chapter that pays a sealed-gate foreshadowing debt and keeps a soft mirror debt open.",
    generation_context: {
      active_engine_excerpt: "Phase27I fixture engine excerpt.",
      current_arc: "Phase27I live adoption smoke arc",
    },
    retrieval_context: {
      foreshadowing_debts: graphFixture.foreshadowing_debts,
      candidate_payoff_events: graphFixture.candidate_payoff_events,
    },
    include_character_mind_state_ledger: false,
    include_dramatic_conflict_manager: false,
    include_foreshadowing_causal_graph: true,
    include_foreshadowing_payoff_guard: true,
    include_foreshadowing_payoff_repair_planner: true,
    include_foreshadowing_payoff_acceptance_gate: true,
    include_foreshadowing_settlement_diff_preview: true,
    enable_character_voice_guard: false,
    save_candidate: false,
    max_revision_rounds: 2,
  }, {
    generationAdapter,
    revisionAdapter: generationAdapter,
    finalPolisherAdapter,
    foreshadowingCausalGraph: graphFixture,
    foreshadowingPayoffGuard: {
      foreshadowing_causal_graph: graphFixture,
    },
    foreshadowingPayoffRepairPlanner: {},
    foreshadowingPayoffAcceptanceGate: {},
    foreshadowingSettlementDiffPreview: {},
  });

  assert.equal(pipeline.status, "completed");
  assert.equal(generationCalls, 1);
  assert.equal(polisherCalls, 1);
  assert.match(pipeline.final_candidate_text, /sealed gate warning/u);
  assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.can_enter_adoption_review, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.status, "preview_ready");
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.no_canon_update, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.no_active_engine_update, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.pending_engine_candidate_created, false);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.paid_foreshadowing_debts.length, 1);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.kept_open_debts.length, 1);

  const writing = result(await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
    task_prompt: "Phase 27I live-like adoption fixture.",
    use_current_inputs: true,
    include_active_engine: false,
    include_writing_card: false,
    include_proofing_card: false,
    include_longline: false,
  }, options), "writing context");

  const candidate = result(await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: pipeline.final_candidate_text,
    title: "Phase 27I Fixture Candidate",
  }, options), "candidate");
  await markCandidateNeuralTraceComplete(candidate.candidate_id);

  const proofing = result(await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
    candidate_id: candidate.candidate_id,
    include_active_engine: false,
    include_writing_card: false,
    include_proofing_card: false,
    include_longline: false,
  }, options), "proofing context");

  const proof = result(await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
    candidate_id: candidate.candidate_id,
    proofing_context_id: proofing.context.proofing_context_id,
    proof_report_text: "Phase27I live-like adoption smoke proof pass.",
    verdict: "pass",
    severity: "none",
  }, options), "proof report");

  const adoptionRequest = result(await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: candidate.candidate_id,
    proof_report_id: proof.proof_report_id,
    reason: "Phase 27I live-like adoption review fixture.",
  }, options), "adoption request");

  const item = await getApprovalItem(adoptionRequest.approval_item_id, options);
  assert.equal(item.source, "chatgpt_bridge");
  assert.equal(item.request_kind, "candidate_adoption");
  assert.equal(item.status.status, "pending");
  assert.equal(item.lineage.candidate_id, candidate.candidate_id);
  assert.equal(item.lineage.proof_report_id, proof.proof_report_id);
  assert.equal(item.lineage.proofing_context_id, proofing.context.proofing_context_id);
  assert.equal(item.lineage.writing_context_id, writing.bundle.bundle_id);
  assert(item.safety_snapshot.active_engine_hash_at_request);
  assert(item.safety_snapshot.compressed_rules_hash_at_request);

  const readiness = await buildApprovalQueueReadinessReport(
    adoptionRequest.approval_item_id,
    options,
  );
  assert.equal(readiness.ok, false);
  assert.equal(readiness.decision, "blocked");
  assert.deepEqual(readiness.blocking_reasons, ["guard_blocked_P0"]);
  assert.equal(readiness.safety.bridge_can_approve, false);
  assert.equal(readiness.safety.bridge_can_confirm_adoption, false);
  assert.equal(readiness.safety.bridge_can_activate_engine, false);
  assert.equal(readiness.decision, "blocked");
  assert.equal(readiness.lineage.candidate.exists, true);
  assert.equal(readiness.lineage.proof_report.exists, true);
  assert.equal(readiness.lineage.proofing_context.exists, true);
  assert.equal(readiness.lineage.writing_context.exists, true);
  for (const field of [
    "bridge_can_approve",
    "bridge_can_confirm_adoption",
    "bridge_can_activate_engine",
    "bridge_can_modify_active_engine",
    "bridge_can_modify_compressed_rules",
  ]) {
    assert.equal(readiness.safety[field], false, `${field} must remain denied`);
  }

  const readinessTool = await approvalQueueReadinessTools.approval_queue_bridge_readiness_report({
    request_id: adoptionRequest.approval_item_id,
    include_lineage_preview: true,
    max_preview_chars: 240,
  }, options);
  assert.equal(readinessTool.ok, false);
  assert.equal(readinessTool.permission, "read");
  assert.equal(readinessTool.can_approve, false);
  assert.equal(readinessTool.can_confirm_adoption, false);
  assert.equal(
    (await listAdoptedWritings({ candidateId: candidate.candidate_id }, options)).length,
    0,
  );

  const blockedCandidate = await getWritingCandidateDetail(candidate.candidate_id, options);
  assert.equal(blockedCandidate.metadata.adopted, false);
  assert.equal(blockedCandidate.metadata.settled, false);

  assert.equal(pipeline.foreshadowing_settlement_diff_preview.used, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.status, "preview_ready");
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.paid_foreshadowing_debts.length, 1);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.kept_open_debts.length, 1);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.allowed_candidate_settlement_items.length, 1);

  assert.equal(await hashFile(activeEnginePath), hash(activeText));
  assert.equal(await hashFile(projectPaths.activeEngine), productionHash);
  const productionPendingAfter = await names(projectPaths.pendingEngineCandidates);
  assert.deepEqual(productionPendingAfter, productionPendingBefore);
  await assertProtectedFilesUnchanged(protectedBefore);

  console.log("Phase27I foreshadowing settlement live approval blocked smoke tests passed.");
} finally {
  await resetFixtureDirectories();
  await removeNew(transactionDir, transactionsBefore);
}










