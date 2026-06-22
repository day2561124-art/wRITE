import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";
import {
  buildAdoptedWritingSettlementContext,
  getAdoptedWritingSettlementContext,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { adoptedWritingSettlementTools } from "../../server/src/mcp-adopted-writing-settlement-tools.mjs";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".phase27h-foreshadowing-settlement-full-workflow-smoke-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
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

async function createAdoptedWritingFromPipelineText(text) {
  const candidate = await saveChatOutputAsWritingCandidate({
    chatOutputText: text,
  }, options);
  await markCandidateNeuralTraceComplete(candidate.candidate_id);
  const proof = await saveChatOutputAsProofReport({
    candidateId: candidate.candidate_id,
    proofReportText: "Phase27H full workflow smoke proof pass.",
    verdict: "pass",
    severity: "none",
  }, options);
  const request = await requestWritingCandidateAdoption({
    candidateId: candidate.candidate_id,
    proofReportId: proof.proof_report_id,
  }, options);
  const confirmed = await confirmApprovalItem(request.approval_item_id, {
    confirm: true,
    approvedBy: "phase27h_test",
  }, options);
  return confirmed.result.adopted_chapter_id;
}

const graphFixture = {
  story_context_id: "phase27h_full_workflow_smoke",
  foreshadowing_debts: [
    {
      debt_id: "door_warning",
      label: "Door warning must become a route-loss consequence.",
      promise: "A marked door warns that the return route can be sealed.",
      required_payoff_type: "changed_state",
      current_status: "payoff_ready",
      severity: "hard",
      evidence: ["The door mark appears before the corridor turns."],
      expected_payoff_signals: ["route sealed", "return route lost"],
    },
    {
      debt_id: "mirror_name",
      label: "Mirror name remains unresolved.",
      promise: "A reflected name points to a later identity reveal.",
      required_payoff_type: "reveal",
      current_status: "open",
      severity: "soft",
      evidence: ["The mirror keeps the name partially hidden."],
    },
  ],
  candidate_payoff_events: [
    {
      payoff_id: "route_loss_payoff",
      debt_id: "door_warning",
      payoff_types: ["action", "changed_state", "route_loss"],
      consequence: "The return route is sealed after the door warning is paid.",
      evidence: ["The marked door shuts behind the characters."],
      confidence: 0.92,
    },
  ],
  current_chapter_focus: ["door_warning"],
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
      "# Phase 27H Fixture Chapter",
      "",
      "The marked door closed behind them, sealing the return route.",
      "The mirror name remained incomplete, waiting for a later reveal.",
    ].join("\n"),
    provider_trace_id: "phase27h-generation",
    foreshadowing_payoffs: [
      {
        id: "route_loss_payoff",
        debt_id: "door_warning",
        payoff_types: ["action", "changed_state", "route_loss"],
        consequence: "The marked door shuts behind them and seals the return route.",
        evidence: ["The marked door shuts behind the characters."],
        confidence: 0.92,
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
const activeText = "# Phase27H Fixture Engine\n\nRule 1: fixture stable.\n";

await resetFixtureDirectories();
await mkdir(path.dirname(activeEnginePath), { recursive: true });
await writeFile(activeEnginePath, activeText, "utf8");

try {
  const pipeline = await runFullRecursiveWritingPipeline({
    task_prompt: "Write a fixture chapter that pays a route-loss foreshadowing debt and keeps one soft debt open.",
    generation_context: {
      active_engine_excerpt: "Fixture engine excerpt.",
      current_arc: "Phase27H smoke arc",
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
  assert.match(pipeline.final_candidate_text, /marked door closed/u);

  assert.equal(pipeline.foreshadowing_causal_graph.used, true);
  assert.equal(pipeline.foreshadowing_causal_graph.phase, "27A");
  assert.equal(pipeline.foreshadowing_payoff_guard.used, true);
  assert.equal(pipeline.foreshadowing_payoff_guard.phase, "27B");
  assert.equal(pipeline.foreshadowing_payoff_guard.blocking, false);
  assert.equal(pipeline.foreshadowing_payoff_guard.fake_payoffs.length, 0);
  assert.equal(pipeline.foreshadowing_payoff_guard.unpaid_required_debts.length, 0);
  assert.equal(pipeline.foreshadowing_payoff_repair_planner.used, true);
  assert.equal(pipeline.foreshadowing_payoff_repair_planner.phase, "27C");
  assert.equal(pipeline.foreshadowing_payoff_repair_planner.revision_required, false);
  assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.used, true);
  assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.phase, "27D");
  assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.readiness_status, "ready_for_adoption_review");
  assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.can_enter_adoption_review, true);
  assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.direct_adoption_allowed, false);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.used, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.phase, "27E");
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.status, "preview_ready");
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.no_canon_update, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.no_active_engine_update, true);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.pending_engine_candidate_created, false);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.paid_foreshadowing_debts.length, 1);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.kept_open_debts.length, 1);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.blocked_canon_intake_items.length, 0);
  assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.allowed_candidate_settlement_items.length, 1);

  const adoptedChapterId = await createAdoptedWritingFromPipelineText(pipeline.final_candidate_text);
  const context = await buildAdoptedWritingSettlementContext({
    adopted_chapter_id: adoptedChapterId,
    include_active_engine: true,
    include_writing_card: false,
    include_proofing_card: false,
    include_longline: false,
    include_foreshadowing_settlement_proposal_bridge: true,
    foreshadowing_settlement_diff_preview: pipeline.foreshadowing_settlement_diff_preview,
  }, options);

  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.used, true);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.phase, "27F");
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.no_canon_update, true);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.no_active_engine_update, true);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.pending_engine_candidate_created, false);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.settlement_proposal_ready, true);
  assert.equal(context.context.foreshadowing_settlement_diff_preview.paid_foreshadowing_debts.length, 1);
  assert.equal(context.context.foreshadowing_settlement_diff_preview.kept_open_debts.length, 1);
  assert.equal(context.context.pending_engine_candidate_created, false);
  assert.equal(context.context.active_engine_modified, false);

  const readContext = await getAdoptedWritingSettlementContext(
    context.context.settlement_context_id,
    options,
  );
  assert.match(readContext.settlement_for_chat, /Foreshadowing Settlement Proposal Bridge/u);
  assert.match(readContext.settlement_for_chat, /route_loss_payoff/u);
  assert.match(readContext.settlement_for_chat, /no_canon_update: true/u);

  const mcpSurface = await adoptedWritingSettlementTools.get_foreshadowing_settlement_surface({
    id: context.context.settlement_context_id,
  }, options);
  assert.equal(mcpSurface.ok, true);
  assert.equal(mcpSurface.permission, "read_only");
  assert.equal(mcpSurface.result.phase, "27G");
  assert.equal(mcpSurface.result.source_phase, "27F");
  assert.equal(mcpSurface.result.status, "surface_ready");
  assert.equal(mcpSurface.result.counts.paid, 1);
  assert.equal(mcpSurface.result.counts.kept_open, 1);
  assert.equal(mcpSurface.result.counts.blocked, 0);
  assert.equal(mcpSurface.result.counts.allowed_candidate_items, 1);
  assert.equal(mcpSurface.result.safety.read_only, true);
  assert.equal(mcpSurface.result.safety.preview_only, true);
  assert.equal(mcpSurface.result.safety.candidate_only, true);
  assert.equal(mcpSurface.result.safety.no_auto_persist, true);
  assert.equal(mcpSurface.result.safety.no_canon_update, true);
  assert.equal(mcpSurface.result.safety.no_active_engine_update, true);
  assert.equal(mcpSurface.result.safety.pending_engine_candidate_created, false);
  assert.equal(mcpSurface.result.safety.active_engine_modified, false);
  assert.equal(mcpSurface.result.safety.requires_human_settlement_review, true);
  assert.match(mcpSurface.result.surface_markdown, /Foreshadowing Settlement Surface/u);
  assert.match(mcpSurface.result.surface_markdown, /ready_for_human_settlement_review/u);

  const bridgeSurface = await chatgptBridgeTools.chatgpt_bridge_get_foreshadowing_settlement_surface({
    id: context.context.settlement_context_id,
  }, options);
  assert.equal(bridgeSurface.ok, true);
  assert.equal(bridgeSurface.permission, "read_only");
  assert.equal(bridgeSurface.result.phase, "27G");
  assert.equal(bridgeSurface.result.generated_locally, false);
  assert.equal(bridgeSurface.result.status, "surface_ready");
  assert.equal(bridgeSurface.safety.can_modify_active_engine, false);
  assert.equal(bridgeSurface.safety.can_approve, false);

  assert.equal(await hashFile(activeEnginePath), hash(activeText));
  assert.equal(await hashFile(projectPaths.activeEngine), productionHash);
  await assertProtectedFilesUnchanged(protectedBefore);

  console.log("Phase27H foreshadowing settlement full workflow smoke tests passed.");
} finally {
  await resetFixtureDirectories();
  await removeNew(transactionDir, transactionsBefore);
}






