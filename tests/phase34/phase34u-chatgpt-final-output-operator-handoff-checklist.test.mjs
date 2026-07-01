import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptFinalOutputE2EComplianceEmission,
  buildChatgptFinalOutputOperatorHandoffChecklist,
  emitChatgptFinalOutputText,
  chatgpt_bridge_run_full_neural_writing_pipeline,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
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

function assertNoFallback(output, label) {
  assert.equal(output.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(output.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(output.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(output.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(output.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(output.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(output.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(output.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(output.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(output.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(output.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(output.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(output.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
}

function assertOutputSafety(safety, label) {
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

function assertChecklist(checklist, expected, label) {
  const e2e = buildChatgptFinalOutputE2EComplianceEmission(expected.toolResponse);
  const finalText = emitChatgptFinalOutputText(expected.toolResponse);

  assert.equal(checklist.used, true, label + ": used mismatch.");
  assert.equal(checklist.phase, "34U", label + ": phase mismatch.");
  assert.equal(checklist.surface_kind, "chatgpt_final_output_operator_handoff_checklist", label + ": surface kind mismatch.");
  assert.equal(checklist.contract_valid, true, label + ": contract valid mismatch.");
  assert.deepEqual(checklist.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(checklist.status, "ready_to_use_operator_handoff_checklist", label + ": status mismatch.");
  assert.equal(checklist.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(checklist.required_output_expression, "emitChatgptFinalOutputText(tool_response)", label + ": required expression mismatch.");
  assert.equal(checklist.operator_must_emit_expression_result_exactly, true, label + ": operator exact emit mismatch.");
  assert.equal(checklist.operator_output_text, finalText, label + ": operator output text mismatch.");
  assert.equal(checklist.output_text, finalText, label + ": output text mismatch.");
  assert.equal(checklist.operator_output_hash, sha256(finalText), label + ": operator output hash mismatch.");
  assert.equal(checklist.output_hash, sha256(finalText), label + ": output hash mismatch.");
  assert.equal(checklist.output_source, "emitChatgptFinalOutputText(tool_response)", label + ": output source mismatch.");
  assert.equal(checklist.final_output_source, "emitChatgptFinalOutputText(tool_response)", label + ": final output source mismatch.");
  assert.equal(checklist.source, "emitChatgptFinalOutputText(tool_response)", label + ": source mismatch.");
  assert.equal(checklist.source_surface, "chatgpt_final_output_e2e_compliance", label + ": source surface mismatch.");
  assert.equal(checklist.source_response_kind, e2e.response_kind, label + ": source response kind mismatch.");
  assert.equal(checklist.source_status, e2e.status, label + ": source status mismatch.");
  assert.equal(checklist.source_output_hash, e2e.output_hash, label + ": source output hash mismatch.");
  assert.equal(checklist.source_output_source, e2e.output_source, label + ": source output source mismatch.");
  assert.equal(checklist.checklist_passed, true, label + ": checklist pass mismatch.");
  assert.equal(Array.isArray(checklist.checklist_items), true, label + ": checklist items should be array.");
  assert.equal(checklist.checklist_items.length >= 5, true, label + ": checklist items too short.");
  assert.deepEqual(checklist.upstream_reference_chain, [
    "emitChatgptFinalOutputText(tool_response)",
    "buildChatgptFinalOutputE2EComplianceEmission(tool_response).output_text",
    "buildChatgptFinalOutputConsumerEmission(tool_response).output_text",
    "tool_response.chatgpt_final_output.output_text",
  ], label + ": upstream chain mismatch.");

  const forbidden = [
    "result.final_candidate_text",
    "result.success_output_for_chat",
    "result.failure_output_for_chat",
    "result.final_response_for_chat",
    "result.final_response_handoff_for_chat",
    "result.extracted_chatgpt_final_output",
  ];

  assert.deepEqual(checklist.forbidden_sources, forbidden, label + ": forbidden source list mismatch.");
  for (const source of forbidden) {
    assert.equal(checklist.output_text.includes(source), false, label + ": output should not include forbidden source literal.");
  }

  assertNoFallback(checklist, label);
  assertOutputSafety(checklist.safety, label);
  assert.equal(checklist.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(checklist.may_save_candidate, false, label + ": may_save_candidate mismatch.");
  assert.equal(checklist.may_approve_candidate, false, label + ": may_approve_candidate mismatch.");
  assert.equal(checklist.may_adopt_candidate, false, label + ": may_adopt_candidate mismatch.");
  assert.equal(checklist.may_update_canon, false, label + ": may_update_canon mismatch.");
  assert.equal(checklist.may_update_active_engine, false, label + ": may_update_active_engine mismatch.");

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(checklist.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(checklist.may_output_story_text, true, label + ": success story output mismatch.");
    assert.equal(checklist.output_text, expected.finalCandidateText, label + ": success final text mismatch.");
  } else {
    assert.equal(checklist.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(checklist.may_output_story_text, false, label + ": failure story output mismatch.");
    assert.equal(checklist.output_text.includes(expected.forbiddenStoryText), false, label + ": failure checklist must not include forbidden story text.");
  }
}

function assertInvalidChecklist() {
  const checklist = buildChatgptFinalOutputOperatorHandoffChecklist({});
  assert.equal(checklist.used, true, "invalid checklist: used mismatch.");
  assert.equal(checklist.phase, "34U", "invalid checklist: phase mismatch.");
  assert.equal(checklist.contract_valid, false, "invalid checklist should be invalid.");
  assert.equal(checklist.response_kind, "operator_handoff_checklist_contract_invalid_notice", "invalid checklist response kind mismatch.");
  assert.equal(checklist.required_output_expression, "emitChatgptFinalOutputText(tool_response)", "invalid checklist required expression mismatch.");
  assert.equal(checklist.operator_must_emit_expression_result_exactly, true, "invalid checklist exact emit mismatch.");
  assert.equal(checklist.can_emit_response_to_chat, true, "invalid checklist can emit mismatch.");
  assert.equal(checklist.can_output_to_chat, false, "invalid checklist output gate mismatch.");
  assert.equal(checklist.checklist_passed, false, "invalid checklist should not pass.");
  assert.equal(checklist.output_hash, sha256(checklist.output_text), "invalid checklist hash mismatch.");
  assert.equal(checklist.operator_output_hash, sha256(checklist.operator_output_text), "invalid checklist operator hash mismatch.");
  assert.equal(checklist.validation_errors.includes("e2e_emission_contract_invalid"), true, "invalid checklist missing e2e contract error.");
  assertNoFallback(checklist, "invalid checklist");
  assertOutputSafety(checklist.safety, "invalid checklist");

  const forbiddenStoryText = "這段正文候選不可被 operator checklist invalid notice echo。";
  const invalid = buildChatgptFinalOutputOperatorHandoffChecklist({
    chatgpt_final_output: {
      used: true,
      contract_valid: false,
      response_kind: "final_candidate_text",
      status: "invalid_root_story_surface",
      output_text: forbiddenStoryText,
      output_hash: "bad-hash",
      output_source: "result.extracted_chatgpt_final_output.output_text",
      must_emit_exactly: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      safety: {},
    },
    result: {
      final_candidate_text: forbiddenStoryText,
    },
  });

  assert.equal(invalid.contract_valid, false, "invalid story checklist should be invalid.");
  assert.equal(invalid.output_text.includes(forbiddenStoryText), false, "invalid checklist must not echo story text.");
  assert.equal(invalid.operator_output_text.includes(forbiddenStoryText), false, "invalid checklist operator output must not echo story text.");
  assert.equal(invalid.validation_errors.includes("e2e_emission_contract_invalid"), true, "invalid story checklist missing e2e error.");
  assertNoFallback(invalid, "invalid story checklist");
  assertOutputSafety(invalid.safety, "invalid story checklist");
}

function assertChecklistIgnoresDecoyResultSurfaces() {
  const rootText = "ROOT ONLY：Phase34U operator checklist 最終輸出只能是這一段。";
  const forbiddenTexts = [
    "FORBIDDEN result.final_candidate_text",
    "FORBIDDEN success_output_for_chat",
    "FORBIDDEN failure_output_for_chat",
    "FORBIDDEN final_response_for_chat",
    "FORBIDDEN final_response_handoff_for_chat",
    "FORBIDDEN extracted_chatgpt_final_output",
  ];

  const toolResponse = {
    chatgpt_final_output: {
      used: true,
      phase: "34R",
      surface_kind: "chatgpt_bridge_final_output_tool_surface_contract",
      contract_valid: true,
      validation_errors: [],
      status: "ready_to_emit_chatgpt_final_output",
      response_kind: "final_candidate_text",
      can_emit_response_to_chat: true,
      can_output_to_chat: true,
      may_output_story_text: true,
      output_text: rootText,
      output_hash: sha256(rootText),
      output_source: "result.extracted_chatgpt_final_output.output_text",
      final_output_source: "result.extracted_chatgpt_final_output.output_text",
      source: "result.extracted_chatgpt_final_output.output_text",
      source_surface: "result.extracted_chatgpt_final_output",
      source_response_kind: "final_candidate_text",
      source_status: "ready_to_emit_final_candidate_text",
      source_output_hash: sha256("FORBIDDEN extracted_chatgpt_final_output"),
      source_output_source: "final_response_handoff_for_chat.body",
      must_emit_exactly: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_fallback_to_final_candidate_text: false,
      may_fallback_to_success_output: false,
      may_fallback_to_failure_output: false,
      may_fallback_to_final_response: false,
      may_fallback_to_final_response_handoff: false,
      may_fallback_to_extracted_chatgpt_final_output: false,
      may_fallback_to_extracted_output_recomposition: false,
      may_construct_response: false,
      safety: {
        candidate_only: true,
        no_candidate_save: true,
        no_approval: true,
        no_adoption: true,
        no_canon_update: true,
        no_active_engine_update: true,
        can_modify_active_engine: false,
        can_update_canon: false,
        can_confirm_adoption: false,
      },
    },
    result: {
      final_candidate_text: forbiddenTexts[0],
      success_output_for_chat: {
        final_candidate_text_to_output: forbiddenTexts[1],
      },
      failure_output_for_chat: {
        failure_summary_for_chat: forbiddenTexts[2],
        recommended_operator_action: forbiddenTexts[2],
      },
      final_response_for_chat: {
        body: forbiddenTexts[3],
      },
      final_response_handoff_for_chat: {
        body: forbiddenTexts[4],
      },
      extracted_chatgpt_final_output: {
        used: true,
        output_text: forbiddenTexts[5],
        output_hash: sha256(forbiddenTexts[5]),
      },
    },
  };

  const checklist = buildChatgptFinalOutputOperatorHandoffChecklist(toolResponse);
  assert.equal(checklist.contract_valid, true, "decoy checklist should be valid.");
  assert.equal(checklist.output_text, rootText, "checklist output must use emit function result.");
  assert.equal(checklist.operator_output_text, rootText, "operator output must use emit function result.");
  assert.equal(checklist.required_output_expression, "emitChatgptFinalOutputText(tool_response)", "required expression mismatch.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(checklist.output_text.includes(forbidden), false, "checklist output must ignore fallback text: " + forbidden);
    assert.equal(checklist.operator_output_text.includes(forbidden), false, "operator output must ignore fallback text: " + forbidden);
  }

  assertNoFallback(checklist, "decoy checklist");
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
  task_prompt: "Phase34U ChatGPT final output operator handoff checklist.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34u_final_output_operator_handoff_checklist: true,
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
      version: "phase34u-test-ledger-v1",
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
          evidence_refs: ["phase34u-final-output-operator-handoff-checklist"],
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
          evidence_refs: ["phase34u-final-output-operator-handoff-checklist"],
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
    label: "revision provider missing",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34u-final-output-checklist",
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
    label: "accepted after revision",
    input: inputWith({ max_revision_rounds: 2 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34u-final-output-checklist",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34u-final-output-checklist",
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

assertInvalidChecklist();
assertChecklistIgnoresDecoyResultSurfaces();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34u-"));

try {
  for (const item of cases) {
    const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
      item.input,
      item.optionsFor("bridge-" + item.label.replaceAll(" ", "-"), tempRoot),
    );

    assert.equal(bridge.ok, true, item.label + ": bridge ok mismatch.");
    assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", item.label + ": tool name mismatch.");
    assert.equal(bridge.permission, "write_low_risk", item.label + ": permission mismatch.");
    assert.deepEqual(bridge.created, [], item.label + ": created outputs should be empty.");
    assert.equal(bridge.blocked, false, item.label + ": bridge blocked mismatch.");

    const checklist = buildChatgptFinalOutputOperatorHandoffChecklist(bridge);
    assertChecklist(checklist, { ...item.expected, toolResponse: bridge }, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34t = "tests/phase34/phase34t-chatgpt-final-output-e2e-compliance-smoke.test.mjs";
  const phase34u = "tests/phase34/phase34u-chatgpt-final-output-operator-handoff-checklist.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34t), "run-all missing Phase34T predecessor.");
  assert(runAllText.includes(phase34u), "run-all missing Phase34U registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34t) < runAllText.indexOf(phase34u), "Phase34U should run after Phase34T.");
  assert(runAllText.indexOf(phase34u) < runAllText.indexOf(daily), "Phase34U should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34U ChatGPT final output operator handoff checklist tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
