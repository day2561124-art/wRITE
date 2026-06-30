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
}

function assertReadableFailureSurface(result, expected, label) {
  const surface = result.failure_output_for_chat;
  assert(surface, `${label}: failure output surface missing.`);
  assert.equal(surface.used, true, `${label}: failure surface should be used.`);
  assert.equal(surface.phase, "34L", `${label}: failure surface phase mismatch.`);
  assert.equal(
    surface.surface_kind,
    "chatgpt_bridge_failure_output_human_readable_surface",
    `${label}: failure surface kind mismatch.`,
  );

  assert.equal(surface.status, "failed", `${label}: status mismatch.`);
  assert.equal(surface.pipeline_stage, expected.pipelineStage, `${label}: pipeline stage mismatch.`);
  assert.equal(surface.stop_reason, expected.stopReason, `${label}: stop reason mismatch.`);
  assert.equal(surface.blocked_stage, expected.blockedStage, `${label}: blocked stage mismatch.`);
  assert.equal(surface.next_action, expected.nextAction, `${label}: next action mismatch.`);

  assert.equal(surface.can_output_to_chat, false, `${label}: output gate mismatch.`);
  assert.equal(surface.must_not_output_candidate, true, `${label}: must_not_output_candidate mismatch.`);
  assert.equal(
    surface.must_not_output_candidate_reason,
    "final_candidate_text_missing",
    `${label}: must-not-output reason mismatch.`,
  );

  assert.equal(
    surface.failure_summary_for_chat.includes(expected.pipelineStage),
    true,
    `${label}: readable summary should include pipeline stage.`,
  );
  assert.equal(
    surface.failure_summary_for_chat.includes(expected.stopReason),
    true,
    `${label}: readable summary should include stop reason.`,
  );
  assert.equal(
    surface.failure_summary_for_chat.includes("must not output story text"),
    true,
    `${label}: readable summary must warn ChatGPT not to output story text.`,
  );

  assert.equal(surface.failure_reason_for_operator, expected.reasonForOperator, `${label}: operator reason mismatch.`);
  assert.equal(surface.recommended_operator_action, expected.recommendedAction, `${label}: recommended action mismatch.`);
  assert.equal(surface.can_retry_after_configuration, expected.canRetryAfterConfiguration, `${label}: retry flag mismatch.`);
  assert.equal(surface.can_continue_revision, expected.canContinueRevision, `${label}: continue revision flag mismatch.`);
  assert.equal(surface.evidence_surface_available, expected.evidenceSurfaceAvailable, `${label}: evidence availability mismatch.`);
  assert.equal(surface.evidence_final_status, expected.evidenceFinalStatus, `${label}: evidence final status mismatch.`);
  assert.equal(surface.revision_rounds_attempted, expected.roundsAttempted, `${label}: revision rounds mismatch.`);
  assert.equal(surface.max_revision_rounds, 1, `${label}: max revision rounds mismatch.`);

  if (expected.evidenceSurfaceAvailable) {
    assert.equal(surface.rewrite_targets.length > 0, true, `${label}: rewrite targets should be surfaced.`);
    assert.equal(surface.operator_findings_count > 0, true, `${label}: operator findings count should be surfaced.`);
  } else {
    assert.deepEqual(surface.rewrite_targets, [], `${label}: rewrite targets should be empty without evidence.`);
    assert.equal(surface.operator_findings_count, 0, `${label}: operator findings count should be zero without evidence.`);
  }

  assert.equal(surface.safety.candidate_only, true, `${label}: safety candidate_only mismatch.`);
  assert.equal(surface.safety.no_candidate_save, true, `${label}: safety no_candidate_save mismatch.`);
  assert.equal(surface.safety.no_approval, true, `${label}: safety no_approval mismatch.`);
  assert.equal(surface.safety.no_adoption, true, `${label}: safety no_adoption mismatch.`);
  assert.equal(surface.safety.no_canon_update, true, `${label}: safety no_canon_update mismatch.`);
  assert.equal(surface.safety.no_active_engine_update, true, `${label}: safety no_active_engine_update mismatch.`);
  assert.equal(surface.safety.can_modify_active_engine, false, `${label}: safety active engine modify mismatch.`);
  assert.equal(surface.safety.can_update_canon, false, `${label}: safety canon update mismatch.`);
  assert.equal(surface.safety.can_confirm_adoption, false, `${label}: safety adoption confirmation mismatch.`);

  assert.equal(result.final_candidate_text, "", `${label}: final candidate should be empty.`);
  assert.equal(result.final_candidate_hash, "", `${label}: final candidate hash should be empty.`);
  assert.equal(result.final_candidate_source, null, `${label}: final candidate source should be null.`);
  assert.equal(result.can_output_to_chat, false, `${label}: root output gate mismatch.`);
  assert.equal(result.next_action, expected.nextAction, `${label}: root next action mismatch.`);
  assert.equal(result.candidate_created, false, `${label}: candidate_created mismatch.`);
  assert.equal(result.candidate_id, null, `${label}: candidate_id mismatch.`);
  assert.equal(result.adopted, false, `${label}: adopted mismatch.`);
  assert.equal(result.settled, false, `${label}: settled mismatch.`);

  assert.equal(result.full_neural_orchestration_summary.failure_output_surface_used, true, `${label}: summary surface flag mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.failure_output_next_action, expected.nextAction, `${label}: summary next action mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.failure_output_blocked_stage, expected.blockedStage, `${label}: summary blocked stage mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.writing_pipeline_complete, false, `${label}: summary completion mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.candidate_only, true, `${label}: summary candidate_only mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.active_engine_update_allowed, false, `${label}: summary active engine mismatch.`);
  assert.equal(result.full_neural_orchestration_summary.canon_update_allowed, false, `${label}: summary canon mismatch.`);

  assertRootSafety(result, label);
}

function assertBridgeReadableFailureSurface(bridge, expected, label) {
  assert.equal(bridge.ok, true, `${label}: bridge ok mismatch.`);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", `${label}: tool name mismatch.`);
  assert.equal(bridge.permission, "write_low_risk", `${label}: permission mismatch.`);
  assert.deepEqual(bridge.created, [], `${label}: created outputs should be empty.`);
  assert.equal(bridge.blocked, false, `${label}: bridge should not be blocked.`);
  assert.equal(bridge.blocked_reason, null, `${label}: blocked reason should be null.`);
  assert.equal(bridge.full_neural_orchestrator_used, true, `${label}: orchestrator flag mismatch.`);
  assertReadableFailureSurface(bridge.result, expected, `${label} result`);
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
  task_prompt: "Phase34L ChatGPT bridge failure readable surface.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34l_failure_readable_surface: true,
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

const expected = {
  generationProviderMissing: {
    pipelineStage: "generation_provider_required",
    stopReason: "generation_provider_required",
    blockedStage: "generation_provider_configuration",
    nextAction: "configure_backend_generation_provider",
    reasonForOperator: "Backend generation provider is not configured.",
    recommendedAction: "Configure backend generation provider, then rerun the full neural writing pipeline.",
    canRetryAfterConfiguration: true,
    canContinueRevision: false,
    evidenceSurfaceAvailable: false,
    evidenceFinalStatus: "source_packet_unavailable",
    roundsAttempted: 0,
  },
  revisionProviderMissing: {
    pipelineStage: "structural_revision_required",
    stopReason: "revision_provider_required",
    blockedStage: "revision_provider_configuration",
    nextAction: "configure_backend_revision_provider",
    reasonForOperator: "Backend revision provider is not configured.",
    recommendedAction: "Configure backend revision provider, then rerun the full neural writing pipeline.",
    canRetryAfterConfiguration: true,
    canContinueRevision: false,
    evidenceSurfaceAvailable: false,
    evidenceFinalStatus: "source_packet_unavailable",
    roundsAttempted: 0,
  },
  revisionExhausted: {
    pipelineStage: "structural_revision_required",
    stopReason: "max_revision_rounds_exhausted",
    blockedStage: "recursive_revision_exhausted",
    nextAction: "review_revision_failure",
    reasonForOperator: "Recursive revision reached the maximum round limit before acceptance.",
    recommendedAction: "Review recursive revision failure evidence before deciding whether to adjust revision policy or retry manually.",
    canRetryAfterConfiguration: false,
    canContinueRevision: false,
    evidenceSurfaceAvailable: true,
    evidenceFinalStatus: "revision_exhausted",
    roundsAttempted: 1,
  },
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34l-"));

try {
  const generationProviderMissingDirect = await runFullNeuralWritingPipelineSingleEntryBridge(
    baseInput,
    buildOptions("direct-generation-provider-missing", tempRoot),
  );
  assertReadableFailureSurface(
    generationProviderMissingDirect,
    expected.generationProviderMissing,
    "direct generation provider missing",
  );

  const generationProviderMissingBridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("bridge-generation-provider-missing", tempRoot),
  );
  assertBridgeReadableFailureSurface(
    generationProviderMissingBridge,
    expected.generationProviderMissing,
    "bridge generation provider missing",
  );

  const revisionProviderMissingDirect = await runFullNeuralWritingPipelineSingleEntryBridge(
    baseInput,
    buildOptions("direct-revision-provider-missing", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34l-readable-failure-surface",
        model_version: "revision-provider-missing",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("direct_revision_provider_missing"),
    }),
  );
  assertReadableFailureSurface(
    revisionProviderMissingDirect,
    expected.revisionProviderMissing,
    "direct revision provider missing",
  );

  const revisionProviderMissingBridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("bridge-revision-provider-missing", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34l-readable-failure-surface",
        model_version: "revision-provider-missing",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("bridge_revision_provider_missing"),
    }),
  );
  assertBridgeReadableFailureSurface(
    revisionProviderMissingBridge,
    expected.revisionProviderMissing,
    "bridge revision provider missing",
  );

  const revisionExhaustedDirect = await runFullNeuralWritingPipelineSingleEntryBridge(
    baseInput,
    buildOptions("direct-revision-exhausted", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34l-readable-failure-surface",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("direct_revision_exhausted"),
      revisionAdapter: async () => ({
        text: stillWeakRevision,
        model_name: "deterministic-phase34l-readable-failure-surface",
        model_version: "revision-exhausted-still-weak",
      }),
    }),
  );
  assertReadableFailureSurface(
    revisionExhaustedDirect,
    expected.revisionExhausted,
    "direct revision exhausted",
  );

  const revisionExhaustedBridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
    baseInput,
    buildOptions("bridge-revision-exhausted", tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34l-readable-failure-surface",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter("bridge_revision_exhausted"),
      revisionAdapter: async () => ({
        text: stillWeakRevision,
        model_name: "deterministic-phase34l-readable-failure-surface",
        model_version: "revision-exhausted-still-weak",
      }),
    }),
  );
  assertBridgeReadableFailureSurface(
    revisionExhaustedBridge,
    expected.revisionExhausted,
    "bridge revision exhausted",
  );

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34k = "tests/phase34/phase34k-chatgpt-bridge-failure-output-contract.test.mjs";
  const phase34l = "tests/phase34/phase34l-chatgpt-bridge-failure-readable-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34k), "run-all missing Phase34K predecessor.");
  assert(runAllText.includes(phase34l), "run-all missing Phase34L registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34k) < runAllText.indexOf(phase34l), "Phase34L should run after Phase34K.");
  assert(runAllText.indexOf(phase34l) < runAllText.indexOf(daily), "Phase34L should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34L ChatGPT bridge failure readable surface tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
