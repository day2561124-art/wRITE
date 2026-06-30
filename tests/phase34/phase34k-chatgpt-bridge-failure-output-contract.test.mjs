import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { runFullNeuralWritingPipelineSingleEntryBridge } from "../../server/src/full-neural-writing-pipeline-single-entry-bridge-service.mjs";
import { chatgpt_bridge_run_full_neural_writing_pipeline } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();
const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];

const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
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

function assertRootSafety(result, label) {
  assert.equal(result.safety.candidate_only, true, `${label}: root safety candidate_only mismatch.`);
  assert.equal(result.safety.active_engine_update_allowed, false, `${label}: root safety active engine update mismatch.`);
  assert.equal(result.safety.canon_update_allowed, false, `${label}: root safety canon update mismatch.`);
  assert.equal(result.safety.direct_adoption_allowed, false, `${label}: root safety direct adoption mismatch.`);
  assert.equal(result.safety.approval_confirmed, false, `${label}: root safety approval confirmation mismatch.`);
  assert.equal(result.safety.adoption_confirmed, false, `${label}: root safety adoption confirmation mismatch.`);
  assert.equal(result.safety.rollback_executed, false, `${label}: root safety rollback mismatch.`);
  assert.equal(result.safety.recovery_executed, false, `${label}: root safety recovery mismatch.`);
}

function assertOuterBridgeSafety(bridge, label) {
  assert.equal(bridge.safety.can_modify_active_engine, false, `${label}: outer safety active engine modify mismatch.`);
  assert.equal(bridge.safety.can_modify_compressed_rules, false, `${label}: outer safety compressed rules modify mismatch.`);
  assert.equal(bridge.safety.can_activate_engine, false, `${label}: outer safety engine activation mismatch.`);
  assert.equal(bridge.safety.can_approve, false, `${label}: outer safety approval mismatch.`);
  assert.equal(bridge.safety.can_confirm_adoption, false, `${label}: outer safety adoption confirmation mismatch.`);
}

function assertNoCandidateMutation(result, label) {
  assert.equal(result.candidate_created, false, `${label}: candidate_created mismatch.`);
  assert.equal(result.candidate_id, null, `${label}: candidate_id should be null.`);
  assert.equal(result.canon_status, "candidate_only", `${label}: canon status mismatch.`);
  assert.equal(result.adopted, false, `${label}: adopted mismatch.`);
  assert.equal(result.settled, false, `${label}: settled mismatch.`);

  assert.equal(result.pipeline_result.candidate_created, false, `${label}: pipeline candidate_created mismatch.`);
  assert.equal(result.pipeline_result.candidate_id, null, `${label}: pipeline candidate_id should be null.`);
  assert.equal(result.pipeline_result.canon_status, "candidate_only", `${label}: pipeline canon status mismatch.`);
  assert.equal(result.pipeline_result.adopted, false, `${label}: pipeline adopted mismatch.`);
  assert.equal(result.pipeline_result.settled, false, `${label}: pipeline settled mismatch.`);
  assert.equal(result.pipeline_result.active_engine_update_allowed, false, `${label}: pipeline active engine boundary mismatch.`);
  assert.equal(result.pipeline_result.canon_update_allowed, false, `${label}: pipeline canon boundary mismatch.`);
  assert.equal(result.pipeline_result.direct_adoption_allowed, false, `${label}: pipeline adoption boundary mismatch.`);
}

function assertDisabledEvidence(result, label) {
  const packet = result.full_pipeline_acceptance_evidence_packet;
  assert(packet, `${label}: disabled evidence packet missing.`);
  assert.equal(packet.used, false, `${label}: disabled evidence packet should not be used.`);
  assert.equal(packet.phase, "34D", `${label}: disabled packet phase mismatch.`);
  assert.equal(packet.candidate_only, true, `${label}: disabled packet candidate_only mismatch.`);
  assert.equal(packet.no_candidate_save, true, `${label}: disabled packet candidate save boundary mismatch.`);
  assert.equal(packet.no_approval, true, `${label}: disabled packet approval boundary mismatch.`);
  assert.equal(packet.no_adoption, true, `${label}: disabled packet adoption boundary mismatch.`);
  assert.equal(packet.no_canon_update, true, `${label}: disabled packet canon boundary mismatch.`);
  assert.equal(packet.no_active_engine_update, true, `${label}: disabled packet active engine boundary mismatch.`);

  const surface = result.full_pipeline_acceptance_evidence_packet_bridge_surface;
  assert(surface, `${label}: disabled bridge surface missing.`);
  assert.equal(surface.used, false, `${label}: disabled bridge surface should not be used.`);
  assert.equal(surface.phase, "34E", `${label}: disabled surface phase mismatch.`);
  assert.equal(surface.status, "source_packet_unavailable", `${label}: disabled surface status mismatch.`);
  assert.equal(surface.bridge_metadata.source_packet_available, false, `${label}: disabled surface source availability mismatch.`);
  assert.equal(surface.next_action, "no_evidence_packet_available", `${label}: disabled surface next action mismatch.`);
  assert.equal(surface.no_candidate_save, true, `${label}: disabled surface candidate save boundary mismatch.`);
  assert.equal(surface.no_approval, true, `${label}: disabled surface approval boundary mismatch.`);
  assert.equal(surface.no_adoption, true, `${label}: disabled surface adoption boundary mismatch.`);
  assert.equal(surface.no_canon_update, true, `${label}: disabled surface canon boundary mismatch.`);
  assert.equal(surface.no_active_engine_update, true, `${label}: disabled surface active engine boundary mismatch.`);
}

function assertFailureEvidence(result, expected, label) {
  const packet = result.full_pipeline_acceptance_evidence_packet;
  assert(packet, `${label}: evidence packet missing.`);
  assert.equal(packet.used, true, `${label}: evidence packet should be used.`);
  assert.equal(packet.phase, "34D", `${label}: evidence packet phase mismatch.`);
  assert.equal(packet.packet_kind, "full_pipeline_acceptance_evidence_packet", `${label}: evidence packet kind mismatch.`);
  assert.equal(packet.status, expected.packetStatus, `${label}: evidence packet status mismatch.`);
  assert.equal(packet.read_only, true, `${label}: evidence packet read_only mismatch.`);
  assert.equal(packet.candidate_only, true, `${label}: evidence packet candidate_only mismatch.`);
  assert.equal(packet.no_candidate_save, true, `${label}: evidence packet candidate save boundary mismatch.`);
  assert.equal(packet.no_approval, true, `${label}: evidence packet approval boundary mismatch.`);
  assert.equal(packet.no_adoption, true, `${label}: evidence packet adoption boundary mismatch.`);
  assert.equal(packet.no_canon_update, true, `${label}: evidence packet canon boundary mismatch.`);
  assert.equal(packet.no_active_engine_update, true, `${label}: evidence packet active engine boundary mismatch.`);

  assert.equal(packet.pipeline_source.status, result.status, `${label}: packet source status should match root.`);
  assert.equal(packet.pipeline_source.pipeline_stage, result.pipeline_stage, `${label}: packet source stage should match root.`);
  assert.equal(packet.pipeline_source.stop_reason, result.stop_reason, `${label}: packet source stop reason should match root.`);
  assert.equal(packet.pipeline_source.final_candidate_hash, "", `${label}: packet source final hash should be empty.`);
  assert.equal(packet.pipeline_source.final_candidate_source, null, `${label}: packet source final source should be null.`);
  assert.equal(packet.pipeline_source.candidate_created, false, `${label}: packet source candidate_created mismatch.`);
  assert.equal(packet.pipeline_source.canon_status, "candidate_only", `${label}: packet source canon_status mismatch.`);
  assert.equal(packet.pipeline_source.adopted, false, `${label}: packet source adopted mismatch.`);
  assert.equal(packet.pipeline_source.settled, false, `${label}: packet source settled mismatch.`);

  assert.equal(packet.acceptance_summary.accepted, false, `${label}: packet accepted mismatch.`);
  assert.equal(packet.acceptance_summary.soft_acceptance_reached, false, `${label}: packet soft acceptance mismatch.`);
  assert.equal(packet.acceptance_summary.revision_required_initially, true, `${label}: packet initial revision flag mismatch.`);
  assert.equal(packet.acceptance_summary.revision_required_finally, true, `${label}: packet final revision flag mismatch.`);
  assert.equal(packet.acceptance_summary.recursive_revision_used, true, `${label}: packet recursive revision flag mismatch.`);
  assert.equal(packet.acceptance_summary.rounds_attempted, expected.roundsAttempted, `${label}: packet rounds mismatch.`);
  assert.equal(packet.acceptance_summary.final_status, expected.evidenceFinalStatus, `${label}: packet final status mismatch.`);
  assert.equal(packet.acceptance_summary.pipeline_stage, expected.pipelineStage, `${label}: packet stage mismatch.`);
  assert.equal(packet.acceptance_summary.stop_reason, expected.stopReason, `${label}: packet stop reason mismatch.`);
  assert.equal(packet.operator_findings.length > 0, true, `${label}: packet operator findings missing.`);

  const surface = result.full_pipeline_acceptance_evidence_packet_bridge_surface;
  assert(surface, `${label}: bridge surface missing.`);
  assert.equal(surface.used, true, `${label}: bridge surface should be used.`);
  assert.equal(surface.phase, "34E", `${label}: bridge surface phase mismatch.`);
  assert.equal(surface.surface_kind, "full_pipeline_acceptance_evidence_packet_bridge_surface", `${label}: bridge surface kind mismatch.`);
  assert.equal(surface.bridge_surface, "chatgpt_bridge_single_entry", `${label}: bridge surface source mismatch.`);
  assert.equal(surface.status, expected.packetStatus, `${label}: bridge surface status mismatch.`);
  assert.equal(surface.read_only, true, `${label}: bridge surface read_only mismatch.`);
  assert.equal(surface.preview_only, true, `${label}: bridge surface preview_only mismatch.`);
  assert.equal(surface.no_candidate_save, true, `${label}: bridge surface candidate save boundary mismatch.`);
  assert.equal(surface.no_approval, true, `${label}: bridge surface approval boundary mismatch.`);
  assert.equal(surface.no_adoption, true, `${label}: bridge surface adoption boundary mismatch.`);
  assert.equal(surface.no_canon_update, true, `${label}: bridge surface canon boundary mismatch.`);
  assert.equal(surface.no_active_engine_update, true, `${label}: bridge surface active engine boundary mismatch.`);

  assert.equal(surface.acceptance_summary.accepted, false, `${label}: surface accepted mismatch.`);
  assert.equal(surface.acceptance_summary.soft_acceptance_reached, false, `${label}: surface soft acceptance mismatch.`);
  assert.equal(surface.acceptance_summary.revision_required_initially, true, `${label}: surface initial revision flag mismatch.`);
  assert.equal(surface.acceptance_summary.revision_required_finally, true, `${label}: surface final revision flag mismatch.`);
  assert.equal(surface.acceptance_summary.final_status, expected.evidenceFinalStatus, `${label}: surface final status mismatch.`);
  assert.equal(surface.acceptance_summary.pipeline_stage, expected.pipelineStage, `${label}: surface stage mismatch.`);
  assert.equal(surface.acceptance_summary.stop_reason, expected.stopReason, `${label}: surface stop reason mismatch.`);
  assert.equal(surface.decision_chain_summary.revision_rounds_count, expected.roundsAttempted, `${label}: surface revision rounds mismatch.`);
  assert.equal(surface.decision_chain_summary.final_reader_response_revision_required, true, `${label}: surface final gate flag mismatch.`);
  assert.equal(surface.operator_findings.length > 0, true, `${label}: surface operator findings missing.`);
  assert.equal(surface.operator_cards.length >= 2, true, `${label}: surface operator cards missing.`);
  assert.equal(surface.bridge_metadata.source_packet_available, true, `${label}: surface source packet availability mismatch.`);
  assert.equal(surface.next_action, expected.surfaceNextAction, `${label}: surface next action mismatch.`);

  assert.equal(surface.safety.mcp_can_generate, false, `${label}: surface generate safety mismatch.`);
  assert.equal(surface.safety.mcp_can_save_candidate, false, `${label}: surface save safety mismatch.`);
  assert.equal(surface.safety.mcp_can_approve, false, `${label}: surface approve safety mismatch.`);
  assert.equal(surface.safety.mcp_can_confirm_adoption, false, `${label}: surface adoption safety mismatch.`);
  assert.equal(surface.safety.mcp_can_activate_engine, false, `${label}: surface activation safety mismatch.`);
  assert.equal(surface.safety.mcp_can_update_canon, false, `${label}: surface canon safety mismatch.`);
  assert.equal(surface.safety.mcp_can_update_active_engine, false, `${label}: surface active engine safety mismatch.`);
}

function assertFailureContract(result, expected, label) {
  assert.equal(result.ok, true, `${label}: ok mismatch.`);
  assert.equal(result.phase, "34A", `${label}: phase mismatch.`);
  assert.equal(result.name, "full-neural-writing-pipeline-single-entry-bridge", `${label}: bridge name mismatch.`);
  assert.equal(result.single_entry_bridge, true, `${label}: single entry marker mismatch.`);
  assert.equal(result.status, "failed", `${label}: status mismatch.`);
  assert.equal(result.pipeline_stage, expected.pipelineStage, `${label}: pipeline stage mismatch.`);
  assert.equal(result.stop_reason, expected.stopReason, `${label}: stop reason mismatch.`);
  assert.equal(result.single_entry_complete, false, `${label}: single entry should not complete.`);
  assert.equal(result.final_candidate_text, "", `${label}: final candidate text should be empty.`);
  assert.equal(result.final_candidate_hash, "", `${label}: final candidate hash should be empty.`);
  assert.equal(result.final_candidate_source, null, `${label}: final candidate source should be null.`);
  assert.equal(result.output_mode, "chat_text", `${label}: output mode mismatch.`);
  assert.equal(result.can_output_to_chat, false, `${label}: output gate mismatch.`);
  assert.equal(result.next_action, expected.nextAction, `${label}: next action mismatch.`);

  assert.equal(result.pipeline_result.final_candidate_text, "", `${label}: pipeline final text should be empty.`);
  assert.equal(result.pipeline_result.final_candidate_hash, "", `${label}: pipeline final hash should be empty.`);
  assert.equal(result.pipeline_result.final_candidate_source, null, `${label}: pipeline final source should be null.`);
  assert.equal(result.pipeline_result.final_text_can_be_displayed, false, `${label}: pipeline display gate mismatch.`);
  assert.equal(result.pipeline_result.can_output_to_chat, false, `${label}: pipeline output gate mismatch.`);

  assert.equal(result.full_neural_orchestration_summary.used, true, `${label}: summary used mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.pipeline_stage, expected.pipelineStage, `${label}: summary stage mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.writing_pipeline_complete, false, `${label}: summary completion mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.candidate_only, true, `${label}: summary candidate_only mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.active_engine_update_allowed, false, `${label}: summary active engine boundary mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.canon_update_allowed, false, `${label}: summary canon boundary mismatch.`);

  assertNoCandidateMutation(result, label);
  assertRootSafety(result, label);

  if (expected.evidenceUsed) {
    assertFailureEvidence(result, expected, label);
    assert.equal(result.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used, true, `${label}: summary bridge surface flag mismatch.`);
    assert.equal(result.full_neural_orchestration_summary.acceptance_evidence_final_status, expected.evidenceFinalStatus, `${label}: summary evidence final status mismatch.`);
  } else {
    assertDisabledEvidence(result, label);
    assert.equal(result.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used, false, `${label}: summary bridge surface flag mismatch.`);
    assert.equal(result.full_neural_orchestration_summary.acceptance_evidence_final_status, "source_packet_unavailable", `${label}: summary evidence final status should report disabled evidence surface.`);
  }
}

function assertBridgeFailureContract(bridge, expected, label) {
  assert.equal(bridge.ok, true, `${label}: outer ok mismatch.`);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", `${label}: tool name mismatch.`);
  assert.equal(bridge.permission, "write_low_risk", `${label}: permission mismatch.`);
  assert.deepEqual(bridge.created, [], `${label}: created outputs should be empty.`);
  assert.equal(bridge.blocked, false, `${label}: bridge should not be blocked.`);
  assert.equal(bridge.blocked_reason, null, `${label}: blocked reason should be null.`);
  assert.equal(bridge.full_neural_orchestrator_used, true, `${label}: full neural flag mismatch.`);
  assert.equal(bridge.full_neural_orchestration_summary.pipeline_stage, expected.pipelineStage, `${label}: outer summary stage mismatch.`);
  assert.equal(bridge.full_neural_orchestration_summary.writing_pipeline_complete, false, `${label}: outer summary completion mismatch.`);
  assert.equal(bridge.full_neural_orchestration_summary.candidate_only, true, `${label}: outer summary candidate_only mismatch.`);
  assert.equal(bridge.full_neural_orchestration_summary.active_engine_update_allowed, false, `${label}: outer summary active engine boundary mismatch.`);
  assert.equal(bridge.full_neural_orchestration_summary.canon_update_allowed, false, `${label}: outer summary canon boundary mismatch.`);
  assert.equal(
    bridge.full_neural_orchestration_summary.pipeline_stage,
    bridge.result.full_neural_orchestration_summary.pipeline_stage,
    `${label}: outer summary stage should match inner summary.`,
  );
  assert.equal(
    bridge.full_neural_orchestration_summary.acceptance_evidence_final_status,
    bridge.result.full_neural_orchestration_summary.acceptance_evidence_final_status,
    `${label}: outer summary evidence final status should match inner summary.`,
  );

  assertOuterBridgeSafety(bridge, label);
  assertFailureContract(bridge.result, expected, `${label} result`);
}

const conflictPlan = {
  protagonist: "朝日奈千夜",
  protagonist_want: "在門禁鎖死前確認門內是否有人偽造她的名字。",
  opposition: "九逃的阻止、門禁倒數、以及門內提前知道千夜名字的人。",
  opposition_pressure: "九逃知道進門後退路會消失，門禁倒數會讓她們失去唯一追蹤線。",
  stakes: "等待會失去追蹤線，進入會讓她們被迫留在無法回頭的地下區域。",
  reversal_or_reveal: "開門不是取得通行權，而是讓舊路線從終端地圖上被刪除。",
  required_choice: "千夜必須在保留退路與抓住門內線索之間選擇。",
  cost_or_payment: "她按下門禁後，九逃標記過的撤離路線全部熄滅。",
  new_status_quo: "千夜與九逃被迫進入不能回頭的新戰場，且門內的人已經掌握她的名字。",
  ending_hook: "門內的人在她開口前先喊出朝日奈千夜的名字。",
};

const weakDraft = [
  "千夜與九逃抵達地下走廊，開始確認門禁資料。終端顯示狀態正在更新，兩人依照流程理解目前的訊號與路線。",
  "九逃認為應該等待支援，千夜認為可以繼續調查。她們把門禁、支援、回報與路線條件整理完，知道情況有風險。",
  "最後她們決定之後再看。現場暫時安靜下來，後續可能會有新的發展。",
].join("\n\n");

const stillWeakRevision = [
  "千夜與九逃又一次確認地下走廊的門禁資料，知道狀態正在更新，也知道路線有風險。",
  "兩人討論支援、回報、撤離條件與後續安排，最後仍然決定先保留選項。",
  "現場保持安靜，事件還沒有真正改變。",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase34K ChatGPT bridge failure output contract.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34k_failure_output_contract: true,
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
    active_engine_update_allowed: false,
  },
  character_names: ["朝日奈千夜", "九逃"],
  reader_response_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: [
    "門內的人為什麼知道朝日奈千夜的名字？",
    "九逃記住的熄滅路線之後能不能變成逃生線？",
  ],
  save_candidate: false,
  build_proofing_context: false,
  max_revision_rounds: 1,
  enable_character_voice_guard: false,
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: false,
  include_foreshadowing_payoff_guard: false,
  include_foreshadowing_payoff_repair_planner: false,
  include_foreshadowing_payoff_acceptance_gate: false,
  include_foreshadowing_settlement_diff_preview: false,
  include_reader_response_revision_gate: true,
  include_reader_response_simulator: true,
  include_aesthetic_memory_context: false,
};

function structuralPolisherAdapter(label) {
  return async ({ raw_draft_text }) => ({
    status: "completed",
    polished_text: raw_draft_text,
    needs_structural_revision: true,
    suggested_return_stage: "raw_generation",
    revision_report: {
      structural_gate: {
        reasons: ["missing_scene_function", "missing_ending_event_hook"],
        suggested_return_stage: "raw_generation",
      },
      risk_flags: ["scene_lacks_concrete_objects", "pretty_but_empty_ending"],
    },
    warnings: [`${label}_structural_revision_required`],
  });
}

function buildOptions(label, tempRoot, extra = {}) {
  return {
    gptWritingContexts: path.join(tempRoot, label, "contexts"),
    writingCandidates: path.join(tempRoot, label, "candidates"),
    proofingContexts: path.join(tempRoot, label, "proofing"),
    env: {},
    ...extra,
  };
}

const expectations = {
  generationProviderMissing: {
    pipelineStage: "generation_provider_required",
    stopReason: "generation_provider_required",
    nextAction: "configure_backend_generation_provider",
    evidenceUsed: false,
  },
  revisionProviderMissing: {
    pipelineStage: "structural_revision_required",
    stopReason: "revision_provider_required",
    nextAction: "configure_backend_revision_provider",
    evidenceUsed: false,
  },
  revisionExhausted: {
    pipelineStage: "structural_revision_required",
    stopReason: "max_revision_rounds_exhausted",
    nextAction: "review_revision_failure",
    evidenceUsed: true,
    packetStatus: "revision_required",
    evidenceFinalStatus: "revision_exhausted",
    surfaceNextAction: "review_revision_failure_or_continue_recursive_revision",
    roundsAttempted: 1,
  },
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34k-"));

try {
  const generationProviderMissingDirect = await runFullNeuralWritingPipelineSingleEntryBridge(
    baseInput,
    buildOptions("direct-generation-provider-missing", tempRoot),
  );
  assertFailureContract(
    generationProviderMissingDirect,
    expectations.generationProviderMissing,
    "direct generation provider missing",
  );

  const generationProviderMissingBridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("bridge-generation-provider-missing", tempRoot),
  );
  assertBridgeFailureContract(
    generationProviderMissingBridge,
    expectations.generationProviderMissing,
    "bridge generation provider missing",
  );

  const revisionProviderMissingDirect = await runFullNeuralWritingPipelineSingleEntryBridge(
    baseInput,
    buildOptions("direct-revision-provider-missing", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34k-failure-contract",
        model_version: "revision-provider-missing",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("direct_revision_provider_missing"),
    }),
  );
  assertFailureContract(
    revisionProviderMissingDirect,
    expectations.revisionProviderMissing,
    "direct revision provider missing",
  );

  const revisionProviderMissingBridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("bridge-revision-provider-missing", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34k-failure-contract",
        model_version: "revision-provider-missing",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("bridge_revision_provider_missing"),
    }),
  );
  assertBridgeFailureContract(
    revisionProviderMissingBridge,
    expectations.revisionProviderMissing,
    "bridge revision provider missing",
  );

  const directRevisionPayloads = [];
  const revisionExhaustedDirect = await runFullNeuralWritingPipelineSingleEntryBridge(
    baseInput,
    buildOptions("direct-revision-exhausted", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34k-failure-contract",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("direct_revision_exhausted"),
      revisionAdapter: async (payload) => {
        directRevisionPayloads.push(payload);
        return {
          text: stillWeakRevision,
          model_name: "deterministic-phase34k-failure-contract",
          model_version: "revision-exhausted-still-weak",
        };
      },
    }),
  );
  assertFailureContract(
    revisionExhaustedDirect,
    expectations.revisionExhausted,
    "direct revision exhausted",
  );
  assert.equal(directRevisionPayloads.length, 1, "direct revision exhausted: one revision payload expected.");

  const bridgeRevisionPayloads = [];
  const revisionExhaustedBridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("bridge-revision-exhausted", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34k-failure-contract",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("bridge_revision_exhausted"),
      revisionAdapter: async (payload) => {
        bridgeRevisionPayloads.push(payload);
        return {
          text: stillWeakRevision,
          model_name: "deterministic-phase34k-failure-contract",
          model_version: "revision-exhausted-still-weak",
        };
      },
    }),
  );
  assertBridgeFailureContract(
    revisionExhaustedBridge,
    expectations.revisionExhausted,
    "bridge revision exhausted",
  );
  assert.equal(bridgeRevisionPayloads.length, 1, "bridge revision exhausted: one revision payload expected.");

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34j = "tests/phase34/phase34j-chatgpt-bridge-final-candidate-output-contract.test.mjs";
  const phase34k = "tests/phase34/phase34k-chatgpt-bridge-failure-output-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34j), "run-all missing Phase34J predecessor.");
  assert(runAllText.includes(phase34k), "run-all missing Phase34K registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34j) < runAllText.indexOf(phase34k), "Phase34K should run after Phase34J.");
  assert(runAllText.indexOf(phase34k) < runAllText.indexOf(daily), "Phase34K should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34K ChatGPT bridge failure output contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
