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

function assertSymmetry(result, expected, label) {
  const success = result.success_output_for_chat;
  const failure = result.failure_output_for_chat;
  const summary = result.full_neural_orchestration_summary;

  assert(success, `${label}: success_output_for_chat missing.`);
  assert(failure, `${label}: failure_output_for_chat missing.`);
  assert(summary, `${label}: full neural summary missing.`);

  assert.equal(success.used, expected.successUsed, `${label}: success used mismatch.`);
  assert.equal(failure.used, expected.failureUsed, `${label}: failure used mismatch.`);
  assert.notEqual(success.used, failure.used, `${label}: success/failure surfaces must be mutually exclusive.`);

  assert.equal(result.can_output_to_chat, expected.canOutputToChat, `${label}: root output gate mismatch.`);
  assert.equal(result.next_action, expected.nextAction, `${label}: root next action mismatch.`);
  assert.equal(result.pipeline_stage, expected.pipelineStage, `${label}: pipeline stage mismatch.`);
  assert.equal(result.stop_reason, expected.stopReason, `${label}: stop reason mismatch.`);

  assert.equal(summary.failure_output_surface_used, expected.failureUsed, `${label}: summary failure surface flag mismatch.`);
  assert.equal(summary.success_output_surface_used, expected.successUsed, `${label}: summary success surface flag mismatch.`);
  assert.equal(
    summary.failure_output_next_action,
    expected.failureUsed ? expected.nextAction : null,
    `${label}: summary failure next action mismatch.`,
  );
  assert.equal(
    summary.failure_output_blocked_stage,
    expected.failureUsed ? expected.blockedStage : null,
    `${label}: summary failure blocked stage mismatch.`,
  );
  assert.equal(
    summary.success_output_next_action,
    expected.successUsed ? expected.nextAction : null,
    `${label}: summary success next action mismatch.`,
  );
  assert.equal(
    summary.success_output_final_candidate_hash,
    expected.successUsed ? result.final_candidate_hash : null,
    `${label}: summary success hash mismatch.`,
  );

  assert.equal(summary.candidate_only, true, `${label}: summary candidate_only mismatch.`);
  assert.equal(summary.active_engine_update_allowed, false, `${label}: summary active engine boundary mismatch.`);
  assert.equal(summary.canon_update_allowed, false, `${label}: summary canon boundary mismatch.`);

  if (expected.successUsed) {
    assert.equal(success.phase, "34M", `${label}: success phase mismatch.`);
    assert.equal(
      success.surface_kind,
      "chatgpt_bridge_success_output_human_readable_surface",
      `${label}: success surface kind mismatch.`,
    );
    assert.equal(success.status, "ready_to_output_final_candidate_text", `${label}: success status mismatch.`);
    assert.equal(success.can_output_to_chat, true, `${label}: success output gate mismatch.`);
    assert.equal(success.must_output_exact_final_candidate_text, true, `${label}: exact output flag mismatch.`);
    assert.equal(success.final_candidate_text_to_output, expected.finalCandidateText, `${label}: exact output text mismatch.`);
    assert.equal(success.final_candidate_hash, sha256(expected.finalCandidateText), `${label}: success hash mismatch.`);
    assert.equal(success.final_candidate_source, expected.finalCandidateSource, `${label}: success source mismatch.`);
    assert.equal(success.candidate_output_contract.output_field, "final_candidate_text", `${label}: output field mismatch.`);
    assert.equal(success.candidate_output_contract.must_output_exact, true, `${label}: output exact contract mismatch.`);
    assert.equal(success.candidate_output_contract.may_rewrite, false, `${label}: rewrite permission mismatch.`);
    assert.equal(success.candidate_output_contract.may_summarize, false, `${label}: summarize permission mismatch.`);
    assert.equal(success.candidate_output_contract.may_save_candidate, false, `${label}: save permission mismatch.`);
    assert.equal(success.candidate_output_contract.may_approve, false, `${label}: approve permission mismatch.`);
    assert.equal(success.candidate_output_contract.may_adopt, false, `${label}: adopt permission mismatch.`);
    assert.equal(success.candidate_output_contract.may_update_canon, false, `${label}: canon permission mismatch.`);
    assert.equal(success.candidate_output_contract.may_update_active_engine, false, `${label}: active engine permission mismatch.`);

    assert.equal(failure.used, false, `${label}: failure should be disabled on success.`);
    assert.equal(failure.reason, "final_candidate_available", `${label}: failure disabled reason mismatch.`);
    assert.equal(failure.can_output_to_chat, true, `${label}: disabled failure output gate mismatch.`);
    assert.equal(failure.must_not_output_candidate, false, `${label}: disabled failure must-not-output mismatch.`);

    assert.equal(result.final_candidate_text, expected.finalCandidateText, `${label}: root final candidate text mismatch.`);
    assert.equal(result.final_candidate_hash, sha256(expected.finalCandidateText), `${label}: root final hash mismatch.`);
    assert.equal(result.final_candidate_source, expected.finalCandidateSource, `${label}: root final source mismatch.`);
    assert.equal(result.single_entry_complete, true, `${label}: single entry completion mismatch.`);
    assert.equal(result.full_pipeline_acceptance_evidence_packet_bridge_surface.used, true, `${label}: evidence bridge surface should be used.`);
    assert.equal(
      result.full_pipeline_acceptance_evidence_packet_bridge_surface.acceptance_summary.final_status,
      expected.evidenceFinalStatus,
      `${label}: evidence final status mismatch.`,
    );
  } else {
    assert.equal(success.phase, "34M", `${label}: disabled success phase mismatch.`);
    assert.equal(
      success.surface_kind,
      "chatgpt_bridge_success_output_human_readable_surface",
      `${label}: disabled success surface kind mismatch.`,
    );
    assert.equal(success.status, "not_available", `${label}: disabled success status mismatch.`);
    assert.equal(success.reason, "final_candidate_text_missing", `${label}: disabled success reason mismatch.`);
    assert.equal(success.can_output_to_chat, false, `${label}: disabled success output gate mismatch.`);
    assert.equal(success.must_output_exact_final_candidate_text, false, `${label}: disabled exact output flag mismatch.`);
    assert.equal("final_candidate_text_to_output" in success, false, `${label}: disabled success must not carry output text.`);
    assert.equal("final_candidate_hash" in success, false, `${label}: disabled success must not carry final hash.`);

    assert.equal(failure.phase, "34L", `${label}: failure phase mismatch.`);
    assert.equal(
      failure.surface_kind,
      "chatgpt_bridge_failure_output_human_readable_surface",
      `${label}: failure surface kind mismatch.`,
    );
    assert.equal(failure.used, true, `${label}: failure should be used on failed pipeline.`);
    assert.equal(failure.can_output_to_chat, false, `${label}: failure output gate mismatch.`);
    assert.equal(failure.must_not_output_candidate, true, `${label}: failure must-not-output mismatch.`);
    assert.equal(failure.must_not_output_candidate_reason, "final_candidate_text_missing", `${label}: failure reason mismatch.`);
    assert.equal(failure.next_action, expected.nextAction, `${label}: failure next action mismatch.`);
    assert.equal(failure.blocked_stage, expected.blockedStage, `${label}: failure blocked stage mismatch.`);

    assert.equal(result.final_candidate_text, "", `${label}: failed root final text should be empty.`);
    assert.equal(result.final_candidate_hash, "", `${label}: failed root final hash should be empty.`);
    assert.equal(result.final_candidate_source, null, `${label}: failed root final source should be null.`);
    assert.equal(result.single_entry_complete, false, `${label}: failed single entry completion mismatch.`);
  }

  assert.equal(result.candidate_created, false, `${label}: candidate_created mismatch.`);
  assert.equal(result.candidate_id, null, `${label}: candidate_id mismatch.`);
  assert.equal(result.canon_status, "candidate_only", `${label}: canon status mismatch.`);
  assert.equal(result.adopted, false, `${label}: adopted mismatch.`);
  assert.equal(result.settled, false, `${label}: settled mismatch.`);

  assert.equal(result.pipeline_result.candidate_created, false, `${label}: pipeline candidate_created mismatch.`);
  assert.equal(result.pipeline_result.active_engine_update_allowed, false, `${label}: pipeline active engine boundary mismatch.`);
  assert.equal(result.pipeline_result.canon_update_allowed, false, `${label}: pipeline canon boundary mismatch.`);

  assertRootSafety(result, label);
}

function assertOuterInnerSummaryAlignment(bridge, expected, label) {
  assert.equal(bridge.ok, true, `${label}: bridge ok mismatch.`);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", `${label}: tool name mismatch.`);
  assert.equal(bridge.permission, "write_low_risk", `${label}: permission mismatch.`);
  assert.deepEqual(bridge.created, [], `${label}: created outputs should be empty.`);
  assert.equal(bridge.blocked, false, `${label}: bridge should not be blocked.`);
  assert.equal(bridge.blocked_reason, null, `${label}: blocked reason should be null.`);
  assert.equal(bridge.full_neural_orchestrator_used, true, `${label}: full neural flag mismatch.`);

  assertSymmetry(bridge.result, expected, `${label} result`);

  const outer = bridge.full_neural_orchestration_summary;
  const inner = bridge.result.full_neural_orchestration_summary;
  const alignedKeys = [
    "pipeline_stage",
    "writing_pipeline_complete",
    "acceptance_evidence_packet_bridge_surface_used",
    "acceptance_evidence_final_status",
    "failure_output_surface_used",
    "failure_output_next_action",
    "failure_output_blocked_stage",
    "success_output_surface_used",
    "success_output_next_action",
    "success_output_final_candidate_hash",
    "candidate_only",
    "active_engine_update_allowed",
    "canon_update_allowed",
  ];

  for (const key of alignedKeys) {
    assert.equal(outer[key], inner[key], `${label}: outer/inner summary ${key} mismatch.`);
  }

  assert.equal(outer.failure_output_surface_used, expected.failureUsed, `${label}: outer failure flag mismatch.`);
  assert.equal(outer.success_output_surface_used, expected.successUsed, `${label}: outer success flag mismatch.`);
  assert.equal(
    outer.failure_output_next_action,
    expected.failureUsed ? expected.nextAction : null,
    `${label}: outer failure next action mismatch.`,
  );
  assert.equal(
    outer.success_output_next_action,
    expected.successUsed ? expected.nextAction : null,
    `${label}: outer success next action mismatch.`,
  );
  assert.equal(
    outer.success_output_final_candidate_hash,
    expected.successUsed ? sha256(expected.finalCandidateText) : null,
    `${label}: outer success hash mismatch.`,
  );

  assert.equal(bridge.safety.can_modify_active_engine, false, `${label}: outer safety active engine modify mismatch.`);
  assert.equal(bridge.safety.can_modify_compressed_rules, false, `${label}: outer safety compressed rules mismatch.`);
  assert.equal(bridge.safety.can_activate_engine, false, `${label}: outer safety activation mismatch.`);
  assert.equal(bridge.safety.can_approve, false, `${label}: outer safety approval mismatch.`);
  assert.equal(bridge.safety.can_confirm_adoption, false, `${label}: outer safety adoption mismatch.`);
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

const revisedDraft = [
  "門禁燈第二次閃紅時，千夜把手掌按上感應板。九逃從她身後抓住她的袖口，指節用力到發白。",
  "「等一下，不能現在開。」他說。",
  "終端地圖在兩人中間亮著。九逃剛才標好的撤離線一格一格變暗，像有人隔著螢幕把橋抽走。千夜看見最後一條灰線還在閃，倒數只剩七秒。",
  "「不開，線索就斷。」千夜說。",
  "「開了，我們就回不來。」九逃的聲音壓得很低，卻不是退縮。他在阻止她，也是在把選擇推回她手上。",
  "千夜沒有甩開他。她只是把另一隻手伸過去，替九逃把終端固定在他掌心。",
  "「記住剛才消失的路。」她說。「如果我判斷錯，你罵我。」",
  "「我現在就想罵。」",
  "「那就邊跑邊罵。」",
  "門開的瞬間，地圖上的舊路線全數熄滅。九逃罵了一聲，還是追上她。兩人跨進門內，身後的門像一塊沉下去的鐵，把走廊的回音切斷。",
  "黑暗裡有人先笑了一下。",
  "「朝日奈千夜，妳比我預想得快。」",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase34N ChatGPT bridge output surface symmetry regression matrix.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34n_output_surface_symmetry_regression: true,
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

function inputWith(overrides = {}) {
  return {
    ...baseInput,
    ...overrides,
    generation_context: {
      ...baseInput.generation_context,
      ...(overrides.generation_context ?? {}),
    },
    retrieval_context: {
      ...baseInput.retrieval_context,
      ...(overrides.retrieval_context ?? {}),
    },
  };
}

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

const deterministicFinalPolisherAdapter = async ({ raw_draft_text }) => ({
  status: "completed",
  polished_text: raw_draft_text,
  needs_structural_revision: false,
  suggested_return_stage: null,
  revision_report: {
    structural_gate: {
      reasons: [],
      suggested_return_stage: null,
    },
    risk_flags: [],
  },
  warnings: [],
});

function baseOptions(label, tempRoot, extra = {}) {
  return {
    gptWritingContexts: path.join(tempRoot, label, "contexts"),
    writingCandidates: path.join(tempRoot, label, "candidates"),
    proofingContexts: path.join(tempRoot, label, "proofing"),
    env: {},
    ...extra,
  };
}

const cases = [
  {
    label: "generation provider missing",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot),
    expected: {
      successUsed: false,
      failureUsed: true,
      canOutputToChat: false,
      pipelineStage: "generation_provider_required",
      stopReason: "generation_provider_required",
      blockedStage: "generation_provider_configuration",
      nextAction: "configure_backend_generation_provider",
      finalCandidateText: "",
      finalCandidateSource: null,
      evidenceFinalStatus: "source_packet_unavailable",
    },
  },
  {
    label: "revision provider missing",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34n-output-symmetry",
        model_version: "revision-provider-missing",
      }),
      finalPolisherAdapter: structuralPolisherAdapter(label),
    }),
    expected: {
      successUsed: false,
      failureUsed: true,
      canOutputToChat: false,
      pipelineStage: "structural_revision_required",
      stopReason: "revision_provider_required",
      blockedStage: "revision_provider_configuration",
      nextAction: "configure_backend_revision_provider",
      finalCandidateText: "",
      finalCandidateSource: null,
      evidenceFinalStatus: "source_packet_unavailable",
    },
  },
  {
    label: "revision exhausted",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34n-output-symmetry",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter(label),
      revisionAdapter: async () => ({
        text: stillWeakRevision,
        model_name: "deterministic-phase34n-output-symmetry",
        model_version: "revision-exhausted-still-weak",
      }),
    }),
    expected: {
      successUsed: false,
      failureUsed: true,
      canOutputToChat: false,
      pipelineStage: "structural_revision_required",
      stopReason: "max_revision_rounds_exhausted",
      blockedStage: "recursive_revision_exhausted",
      nextAction: "review_revision_failure",
      finalCandidateText: "",
      finalCandidateSource: null,
      evidenceFinalStatus: "revision_exhausted",
    },
  },
  {
    label: "accepted after revision",
    input: inputWith({ max_revision_rounds: 2 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34n-output-symmetry",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34n-output-symmetry",
        model_version: "accepted-after-revision-final",
      }),
    }),
    expected: {
      successUsed: true,
      failureUsed: false,
      canOutputToChat: true,
      pipelineStage: "final_candidate_ready_after_revision",
      stopReason: null,
      blockedStage: null,
      nextAction: "output_final_candidate_text_to_chat",
      finalCandidateText: revisedDraft,
      finalCandidateSource: "backend_recursive_revision",
      evidenceFinalStatus: "accepted_after_revision",
    },
  },
];

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34n-"));

try {
  for (const item of cases) {
    const direct = await runFullNeuralWritingPipelineSingleEntryBridge(
      item.input,
      item.optionsFor(`direct-${item.label.replaceAll(" ", "-")}`, tempRoot),
    );
    assertSymmetry(direct, item.expected, `direct ${item.label}`);

    const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
      item.input,
      item.optionsFor(`bridge-${item.label.replaceAll(" ", "-")}`, tempRoot),
    );
    assertOuterInnerSummaryAlignment(bridge, item.expected, `bridge ${item.label}`);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34m = "tests/phase34/phase34m-chatgpt-bridge-success-readable-surface.test.mjs";
  const phase34n = "tests/phase34/phase34n-chatgpt-bridge-output-surface-symmetry-regression.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34m), "run-all missing Phase34M predecessor.");
  assert(runAllText.includes(phase34n), "run-all missing Phase34N registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34m) < runAllText.indexOf(phase34n), "Phase34N should run after Phase34M.");
  assert(runAllText.indexOf(phase34n) < runAllText.indexOf(daily), "Phase34N should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34N ChatGPT bridge output surface symmetry regression tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
