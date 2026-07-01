import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildFinalResponseHandoffForChat,
  runFullNeuralWritingPipelineSingleEntryBridge,
} from "../../server/src/full-neural-writing-pipeline-single-entry-bridge-service.mjs";
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

function assertNoFallback(handoff, label) {
  assert.equal(handoff.chatgpt_must_output_body, true, label + ": ChatGPT must output body mismatch.");
  assert.equal(handoff.final_output_source, "final_response_for_chat.body", label + ": final output source mismatch.");
  assert.equal(handoff.must_output_body_exactly, true, label + ": exact body flag mismatch.");
  assert.equal(handoff.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(handoff.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(handoff.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(handoff.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(handoff.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(handoff.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(handoff.may_construct_response, false, label + ": construct response permission mismatch.");
}

function assertHandoffSafety(safety, label) {
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

function assertValidHandoff(result, expected, label) {
  const finalResponse = result.final_response_for_chat;
  const handoff = result.final_response_handoff_for_chat;
  const summary = result.full_neural_orchestration_summary;

  assert(finalResponse, label + ": final_response_for_chat missing.");
  assert(handoff, label + ": final_response_handoff_for_chat missing.");
  assert.equal(handoff.used, true, label + ": handoff used mismatch.");
  assert.equal(handoff.phase, "34P", label + ": handoff phase mismatch.");
  assert.equal(handoff.surface_kind, "chatgpt_bridge_final_response_handoff_contract", label + ": surface kind mismatch.");
  assert.equal(handoff.contract_valid, true, label + ": contract should be valid.");
  assert.deepEqual(handoff.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(handoff.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(handoff.source_surface, "final_response_for_chat", label + ": source surface mismatch.");
  assert.equal(handoff.source_response_kind, finalResponse.response_kind, label + ": source response kind mismatch.");
  assert.equal(handoff.source_response_surface, finalResponse.source_surface, label + ": source response surface mismatch.");
  assert.equal(handoff.body, finalResponse.body, label + ": handoff body must equal final response body.");
  assert.equal(handoff.body_hash, finalResponse.body_hash, label + ": handoff hash must equal final response hash.");
  assert.equal(handoff.body_hash, sha256(handoff.body), label + ": handoff body hash mismatch.");
  assert.equal(handoff.can_emit_response_to_chat, true, label + ": can emit response mismatch.");
  assert.equal(summary.final_response_handoff_used, true, label + ": summary handoff used mismatch.");
  assert.equal(summary.final_response_handoff_valid, true, label + ": summary handoff valid mismatch.");
  assert.equal(summary.final_response_handoff_kind, expected.responseKind, label + ": summary handoff kind mismatch.");
  assert.equal(summary.final_response_handoff_body_hash, handoff.body_hash, label + ": summary handoff hash mismatch.");
  assertNoFallback(handoff, label);
  assertHandoffSafety(handoff.safety, label);

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(handoff.status, "ready_to_handoff_final_candidate_text", label + ": success handoff status mismatch.");
    assert.equal(handoff.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(handoff.may_output_story_text, true, label + ": success story output flag mismatch.");
    assert.equal(handoff.body, result.final_candidate_text, label + ": success handoff body must equal root final candidate.");
    assert.equal(handoff.body, result.success_output_for_chat.final_candidate_text_to_output, label + ": success handoff body must equal success output.");
    assert.equal(handoff.body, expected.finalCandidateText, label + ": success handoff body must equal expected candidate.");
  } else {
    assert.equal(handoff.status, "ready_to_handoff_pipeline_failure_notice", label + ": failure handoff status mismatch.");
    assert.equal(handoff.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(handoff.may_output_story_text, false, label + ": failure story output flag mismatch.");
    assert.equal(result.final_candidate_text, "", label + ": failed result must not expose candidate text.");
    assert.equal(result.final_candidate_hash, "", label + ": failed result must not expose candidate hash.");
    assert.equal(handoff.body.includes(result.failure_output_for_chat.failure_summary_for_chat), true, label + ": failure handoff missing summary.");
    assert.equal(handoff.body.includes(result.failure_output_for_chat.recommended_operator_action), true, label + ": failure handoff missing operator action.");
    assert.equal(handoff.body.includes(expected.forbiddenStoryText), false, label + ": failure handoff must not include story text.");
  }
}

function assertBridgeHandoffAlignment(bridge, expected, label) {
  assert.equal(bridge.ok, true, label + ": bridge ok mismatch.");
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", label + ": tool name mismatch.");
  assert.equal(bridge.permission, "write_low_risk", label + ": permission mismatch.");
  assert.deepEqual(bridge.created, [], label + ": created outputs should be empty.");
  assert.equal(bridge.blocked, false, label + ": bridge blocked mismatch.");
  assertValidHandoff(bridge.result, expected, label + " result");

  const outer = bridge.full_neural_orchestration_summary;
  const inner = bridge.result.full_neural_orchestration_summary;
  const alignedKeys = [
    "final_response_surface_used",
    "final_response_kind",
    "final_response_body_hash",
    "final_response_handoff_used",
    "final_response_handoff_valid",
    "final_response_handoff_kind",
    "final_response_handoff_body_hash",
    "candidate_only",
    "active_engine_update_allowed",
    "canon_update_allowed",
  ];

  for (const key of alignedKeys) {
    assert.equal(outer[key], inner[key], label + ": outer/inner summary " + key + " mismatch.");
  }

  assert.equal(outer.final_response_handoff_used, true, label + ": outer handoff used mismatch.");
  assert.equal(outer.final_response_handoff_valid, true, label + ": outer handoff valid mismatch.");
  assert.equal(outer.final_response_handoff_kind, expected.responseKind, label + ": outer handoff kind mismatch.");
  assert.equal(outer.final_response_handoff_body_hash, bridge.result.final_response_handoff_for_chat.body_hash, label + ": outer handoff hash mismatch.");
}

function assertInvalidHandoff() {
  const missing = buildFinalResponseHandoffForChat(null);
  assert.equal(missing.used, true, "missing contract: handoff should be used.");
  assert.equal(missing.phase, "34P", "missing contract: phase mismatch.");
  assert.equal(missing.contract_valid, false, "missing contract: should be invalid.");
  assert.equal(missing.response_kind, "contract_invalid_notice", "missing contract: response kind mismatch.");
  assert.equal(missing.can_emit_response_to_chat, true, "missing contract: can emit notice mismatch.");
  assert.equal(missing.can_output_to_chat, false, "missing contract: output gate mismatch.");
  assert.equal(missing.may_output_story_text, false, "missing contract: story output mismatch.");
  assert.equal(missing.body_hash, sha256(missing.body), "missing contract: hash mismatch.");
  assert.equal(missing.validation_errors.includes("final_response_for_chat_used_false_or_missing"), true, "missing contract: validation error missing.");
  assert.equal(missing.operator_action, "inspect_final_response_for_chat_contract", "missing contract: operator action mismatch.");
  assert.equal(missing.may_fallback_to_final_candidate_text, false, "missing contract: final candidate fallback mismatch.");
  assert.equal(missing.may_fallback_to_success_output, false, "missing contract: success fallback mismatch.");
  assert.equal(missing.may_fallback_to_failure_output, false, "missing contract: failure fallback mismatch.");
  assert.equal(missing.may_construct_response, false, "missing contract: construct response mismatch.");
  assertHandoffSafety(missing.safety, "missing contract");

  const body = "合法正文候選";
  const tampered = buildFinalResponseHandoffForChat({
    used: true,
    phase: "34O",
    response_kind: "final_candidate_text",
    can_output_to_chat: true,
    body,
    body_hash: "bad-hash",
    source_surface: "success_output_for_chat",
    must_output_body_exactly: true,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: true,
  });

  assert.equal(tampered.contract_valid, false, "tampered contract: should be invalid.");
  assert.equal(tampered.response_kind, "contract_invalid_notice", "tampered contract: response kind mismatch.");
  assert.equal(tampered.validation_errors.includes("final_response_body_hash_mismatch"), true, "tampered contract: hash validation missing.");
  assert.equal(tampered.body.includes(body), false, "tampered contract notice must not echo story text.");
  assert.equal(tampered.may_fallback_to_final_candidate_text, false, "tampered contract: final candidate fallback mismatch.");
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
  task_prompt: "Phase34P ChatGPT bridge final response handoff contract.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34p_final_response_handoff_contract: true,
    character_names: ["朝日奈千夜", "九逃"],
    dramatic_conflict_plan: conflictPlan,
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
  aesthetic_memory_context: {
    principles: [
      "一章一變局。",
      "普通行動先直寫，幽默只能加味。",
      "角色對話不能公告式交接。",
      "結尾必須留下事件鉤子，不靠漂亮句子收尾。",
    ],
  },
  save_candidate: false,
  build_proofing_context: false,
  enable_character_voice_guard: false,
  include_character_mind_state_ledger: true,
  include_dramatic_conflict_manager: true,
  include_foreshadowing_causal_graph: true,
  include_foreshadowing_payoff_guard: false,
  include_foreshadowing_payoff_repair_planner: false,
  include_foreshadowing_payoff_acceptance_gate: false,
  include_foreshadowing_settlement_diff_preview: false,
  include_reader_response_revision_gate: true,
  include_reader_response_simulator: true,
  include_aesthetic_memory_context: true,
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
    characterMindStateLedger: {
      version: "phase34p-test-ledger-v1",
      updated_at: "2026-07-01T00:00:00.000Z",
      characters: [
        {
          character_name: "朝日奈千夜",
          current_emotion: "急迫但冷靜",
          body_state: "手掌按上門禁感應板",
          unspoken_pressure: "知道開門會切斷退路，但不開門線索就會消失",
          recent_event_traces: ["門禁燈第二次閃紅", "撤離線正在熄滅"],
          relationship_attitudes: {
            "九逃": "相信他會記住退路，也接受他會反對自己",
          },
          visible_reactions_allowed: ["按上感應板", "把終端固定到九逃掌心", "跨進門內"],
          hidden_reactions_reserved: ["害怕自己判斷錯卻不能停下"],
          continuity_constraints: ["不得把門禁倒數寫成流程確認"],
          evidence_refs: ["phase34p-final-response-handoff"],
        },
        {
          character_name: "九逃",
          current_emotion: "焦躁且警戒",
          body_state: "抓住千夜袖口、盯著撤離線",
          unspoken_pressure: "知道自己阻止不了她，只能把代價記下來",
          recent_event_traces: ["看見撤離路線一格一格熄滅"],
          relationship_attitudes: {
            "朝日奈千夜": "嘴上阻止但仍跟著她跨進門",
          },
          visible_reactions_allowed: ["抓住袖口", "低聲阻止", "罵了一聲仍追上去"],
          hidden_reactions_reserved: ["擔心這次真的回不來"],
          continuity_constraints: ["吐槽不能消解危機代價"],
          evidence_refs: ["phase34p-final-response-handoff"],
        },
      ],
    },
    readerResponseRevisionGate: {
      dramatic_conflict_plan: conflictPlan,
      reader_questions_to_carry_forward: [
        "門內的人為什麼知道朝日奈千夜的名字？",
        "九逃記住的熄滅路線之後能不能變成逃生線？",
      ],
    },
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
        model_name: "deterministic-phase34p-final-handoff",
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
        model_name: "deterministic-phase34p-final-handoff",
        model_version: "revision-exhausted-initial",
      }),
      finalPolisherAdapter: structuralPolisherAdapter(label),
      revisionAdapter: async () => ({
        text: stillWeakRevision,
        model_name: "deterministic-phase34p-final-handoff",
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
        model_name: "deterministic-phase34p-final-handoff",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34p-final-handoff",
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

assertInvalidHandoff();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34p-"));

try {
  for (const item of cases) {
    const direct = await runFullNeuralWritingPipelineSingleEntryBridge(
      item.input,
      item.optionsFor("direct-" + item.label.replaceAll(" ", "-"), tempRoot),
    );
    assertValidHandoff(direct, item.expected, "direct " + item.label);

    const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
      item.input,
      item.optionsFor("bridge-" + item.label.replaceAll(" ", "-"), tempRoot),
    );
    assertBridgeHandoffAlignment(bridge, item.expected, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34o = "tests/phase34/phase34o-chatgpt-bridge-final-response-renderer-contract.test.mjs";
  const phase34p = "tests/phase34/phase34p-chatgpt-bridge-final-response-handoff-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34o), "run-all missing Phase34O predecessor.");
  assert(runAllText.includes(phase34p), "run-all missing Phase34P registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34o) < runAllText.indexOf(phase34p), "Phase34P should run after Phase34O.");
  assert(runAllText.indexOf(phase34p) < runAllText.indexOf(daily), "Phase34P should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34P ChatGPT bridge final response handoff contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
