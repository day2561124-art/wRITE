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

function assertFinalResponseSafety(safety, label) {
  assert.equal(safety.candidate_only, true, label + ": safety candidate_only mismatch.");
  assert.equal(safety.no_candidate_save, true, label + ": safety no_candidate_save mismatch.");
  assert.equal(safety.no_approval, true, label + ": safety no_approval mismatch.");
  assert.equal(safety.no_adoption, true, label + ": safety no_adoption mismatch.");
  assert.equal(safety.no_canon_update, true, label + ": safety no_canon_update mismatch.");
  assert.equal(safety.no_active_engine_update, true, label + ": safety no_active_engine_update mismatch.");
  assert.equal(safety.can_modify_active_engine, false, label + ": safety can_modify_active_engine mismatch.");
  assert.equal(safety.can_update_canon, false, label + ": safety can_update_canon mismatch.");
  assert.equal(safety.can_confirm_adoption, false, label + ": safety can_confirm_adoption mismatch.");
}

function assertFinalResponse(result, expected, label) {
  const finalResponse = result.final_response_for_chat;
  const success = result.success_output_for_chat;
  const failure = result.failure_output_for_chat;
  const summary = result.full_neural_orchestration_summary;

  assert(finalResponse, label + ": final_response_for_chat missing.");
  assert.equal(finalResponse.used, true, label + ": final response should be used.");
  assert.equal(finalResponse.phase, "34O", label + ": final response phase mismatch.");
  assert.equal(finalResponse.surface_kind, "chatgpt_bridge_final_response_renderer_contract", label + ": final response surface kind mismatch.");
  assert.equal(finalResponse.must_output_body_exactly, true, label + ": exact body flag mismatch.");
  assert.equal(finalResponse.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(finalResponse.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(finalResponse.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(finalResponse.body_hash, sha256(finalResponse.body), label + ": body hash mismatch.");
  assertFinalResponseSafety(finalResponse.safety, label);

  assert.equal(summary.final_response_surface_used, true, label + ": summary final response flag mismatch.");
  assert.equal(summary.final_response_kind, expected.responseKind, label + ": summary final response kind mismatch.");
  assert.equal(summary.final_response_body_hash, finalResponse.body_hash, label + ": summary final response hash mismatch.");

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(success.used, true, label + ": success surface should be used.");
    assert.equal(failure.used, false, label + ": failure surface should be disabled.");
    assert.equal(finalResponse.response_kind, "final_candidate_text", label + ": success response kind mismatch.");
    assert.equal(finalResponse.source_surface, "success_output_for_chat", label + ": success source surface mismatch.");
    assert.equal(finalResponse.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(finalResponse.may_output_story_text, true, label + ": success story flag mismatch.");
    assert.equal(finalResponse.body, expected.finalCandidateText, label + ": body must equal expected candidate.");
    assert.equal(finalResponse.body, result.final_candidate_text, label + ": body must equal root candidate.");
    assert.equal(finalResponse.body, success.final_candidate_text_to_output, label + ": body must equal success output.");
    assert.equal(finalResponse.body_hash, result.final_candidate_hash, label + ": hash must equal root hash.");
    assert.equal(finalResponse.body_hash, success.final_candidate_hash, label + ": hash must equal success hash.");
    assert.equal(success.must_output_exact_final_candidate_text, true, label + ": exact candidate flag mismatch.");
  } else {
    assert.equal(success.used, false, label + ": success surface should be disabled.");
    assert.equal(failure.used, true, label + ": failure surface should be used.");
    assert.equal(finalResponse.response_kind, "pipeline_failure_notice", label + ": failure response kind mismatch.");
    assert.equal(finalResponse.source_surface, "failure_output_for_chat", label + ": failure source surface mismatch.");
    assert.equal(finalResponse.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(finalResponse.may_output_story_text, false, label + ": failure story flag mismatch.");
    assert.equal(result.final_candidate_text, "", label + ": failed result must not expose candidate text.");
    assert.equal(result.final_candidate_hash, "", label + ": failed result must not expose candidate hash.");
    assert.equal(finalResponse.body.includes(failure.failure_summary_for_chat), true, label + ": failure body missing summary.");
    assert.equal(finalResponse.body.includes(failure.recommended_operator_action), true, label + ": failure body missing operator action.");
    assert.equal(finalResponse.body.includes(expected.forbiddenStoryText), false, label + ": failure body must not include story candidate text.");
    assert.equal("final_candidate_text_to_output" in success, false, label + ": disabled success must not carry candidate output.");
    assert.equal("final_candidate_hash" in success, false, label + ": disabled success must not carry candidate hash.");
    assert.equal(failure.must_not_output_candidate, true, label + ": failure must_not_output_candidate mismatch.");
  }
}

function assertBridgeFinalResponseAlignment(bridge, expected, label) {
  assert.equal(bridge.ok, true, label + ": bridge ok mismatch.");
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", label + ": bridge tool name mismatch.");
  assert.equal(bridge.permission, "write_low_risk", label + ": bridge permission mismatch.");
  assert.deepEqual(bridge.created, [], label + ": bridge created outputs should be empty.");
  assert.equal(bridge.blocked, false, label + ": bridge blocked mismatch.");
  assertFinalResponse(bridge.result, expected, label + " result");

  const outer = bridge.full_neural_orchestration_summary;
  const inner = bridge.result.full_neural_orchestration_summary;
  const alignedKeys = [
    "failure_output_surface_used",
    "failure_output_next_action",
    "failure_output_blocked_stage",
    "success_output_surface_used",
    "success_output_next_action",
    "success_output_final_candidate_hash",
    "final_response_surface_used",
    "final_response_kind",
    "final_response_body_hash",
    "candidate_only",
    "active_engine_update_allowed",
    "canon_update_allowed",
  ];

  for (const key of alignedKeys) {
    assert.equal(outer[key], inner[key], label + ": outer/inner summary " + key + " mismatch.");
  }

  assert.equal(outer.final_response_surface_used, true, label + ": outer final response flag mismatch.");
  assert.equal(outer.final_response_kind, expected.responseKind, label + ": outer final response kind mismatch.");
  assert.equal(outer.final_response_body_hash, bridge.result.final_response_for_chat.body_hash, label + ": outer final response hash mismatch.");
  assert.equal(bridge.safety.can_modify_active_engine, false, label + ": outer safety active engine mismatch.");
  assert.equal(bridge.safety.can_modify_compressed_rules, false, label + ": outer safety compressed rules mismatch.");
  assert.equal(bridge.safety.can_activate_engine, false, label + ": outer safety activation mismatch.");
  assert.equal(bridge.safety.can_approve, false, label + ": outer safety approval mismatch.");
  assert.equal(bridge.safety.can_confirm_adoption, false, label + ": outer safety adoption mismatch.");
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
  task_prompt: "Phase34O ChatGPT bridge final response renderer contract.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34o_final_response_renderer_contract: true,
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
    warnings: [label + "_structural_revision_required"],
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
      responseKind: "pipeline_failure_notice",
      forbiddenStoryText: "千夜與九逃抵達地下走廊",
    },
  },
  {
    label: "revision provider missing",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34o-final-response",
        model_version: "revision-provider-missing",
      }),
      finalPolisherAdapter: structuralPolisherAdapter(label),
    }),
    expected: {
      responseKind: "pipeline_failure_notice",
      forbiddenStoryText: "千夜與九逃抵達地下走廊",
    },
  },
  {
    label: "revision exhausted",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34o-final-response",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter(label),
      revisionAdapter: async () => ({
        text: stillWeakRevision,
        model_name: "deterministic-phase34o-final-response",
        model_version: "revision-exhausted-still-weak",
      }),
    }),
    expected: {
      responseKind: "pipeline_failure_notice",
      forbiddenStoryText: "千夜與九逃又一次確認地下走廊",
    },
  },
  {
    label: "accepted after revision",
    input: inputWith({ max_revision_rounds: 2 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34o-final-response",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34o-final-response",
        model_version: "accepted-after-revision-final",
      }),
    }),
    expected: {
      responseKind: "final_candidate_text",
      finalCandidateText: revisedDraft,
      forbiddenStoryText: "",
    },
  },
];

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34o-"));

try {
  for (const item of cases) {
    const direct = await runFullNeuralWritingPipelineSingleEntryBridge(
      item.input,
      item.optionsFor("direct-" + item.label.replaceAll(" ", "-"), tempRoot),
    );
    assertFinalResponse(direct, item.expected, "direct " + item.label);

    const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
      item.input,
      item.optionsFor("bridge-" + item.label.replaceAll(" ", "-"), tempRoot),
    );
    assertBridgeFinalResponseAlignment(bridge, item.expected, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34n = "tests/phase34/phase34n-chatgpt-bridge-output-surface-symmetry-regression.test.mjs";
  const phase34o = "tests/phase34/phase34o-chatgpt-bridge-final-response-renderer-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34n), "run-all missing Phase34N predecessor.");
  assert(runAllText.includes(phase34o), "run-all missing Phase34O registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34n) < runAllText.indexOf(phase34o), "Phase34O should run after Phase34N.");
  assert(runAllText.indexOf(phase34o) < runAllText.indexOf(daily), "Phase34O should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34O ChatGPT bridge final response renderer contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
