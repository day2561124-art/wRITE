import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  acceptChatgptFinalOutputFromLiveToolCall,
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputRealActionSurfaceReadiness,
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

const expectedForbiddenSources = [
  "tool_response.result",
  "tool_response.result.final_candidate_text",
  "tool_response.result.success_output_for_chat",
  "tool_response.result.failure_output_for_chat",
  "tool_response.result.final_response_for_chat",
  "tool_response.result.final_response_handoff_for_chat",
  "tool_response.result.extracted_chatgpt_final_output",
  "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
  "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
  "buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(tool_response)",
];

function assertNoFallback(readiness, label) {
  assert.equal(readiness.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(readiness.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(readiness.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(readiness.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(readiness.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(readiness.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(readiness.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(readiness.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(readiness.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(readiness.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(readiness.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(readiness.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(readiness.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(readiness.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
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

function assertRealActionReadiness(toolResponse, expected, label) {
  const readiness = buildChatgptFinalOutputRealActionSurfaceReadiness(toolResponse);
  const acceptedByRealAction = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const acceptedByLiveToolCall = acceptChatgptFinalOutputFromLiveToolCall(toolResponse);
  const emittedText = emitChatgptFinalOutputText(toolResponse);
  const topLevelKeys = Object.keys(toolResponse);

  assert.equal(readiness.used, true, label + ": used mismatch.");
  assert.equal(readiness.phase, "34X", label + ": phase mismatch.");
  assert.equal(readiness.surface_kind, "chatgpt_final_output_real_action_surface_readiness", label + ": surface kind mismatch.");
  assert.equal(readiness.contract_valid, true, label + ": contract valid mismatch.");
  assert.deepEqual(readiness.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(readiness.status, "ready_for_real_chatgpt_action_final_output", label + ": status mismatch.");
  assert.equal(readiness.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(readiness.real_action_surface_ready, true, label + ": action readiness mismatch.");
  assert.equal(readiness.real_action_surface_shape, "chatgpt_action_mcp_tool_response_wrapper", label + ": action surface shape mismatch.");
  assert.equal(readiness.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", label + ": tool name mismatch.");
  assert.equal(readiness.permission, "write_low_risk", label + ": permission mismatch.");
  assert.equal(readiness.final_action_output_entrypoint, "acceptChatgptFinalOutputFromLiveToolCall(tool_response)", label + ": action entrypoint mismatch.");
  assert.equal(readiness.canonical_final_output_entrypoint, "emitChatgptFinalOutputText(tool_response)", label + ": canonical entrypoint mismatch.");
  assert.equal(readiness.required_chatgpt_consumable_field, "tool_response.chatgpt_final_output.output_text", label + ": consumable field mismatch.");
  assert.equal(readiness.accepted_chatgpt_output_text, emittedText, label + ": readiness accepted text must equal emit function.");
  assert.equal(readiness.accepted_chatgpt_output_text, acceptedByLiveToolCall, label + ": readiness accepted text must equal live helper.");
  assert.equal(readiness.accepted_chatgpt_output_text, acceptedByRealAction, label + ": readiness accepted text must equal real action helper.");
  assert.equal(readiness.accepted_chatgpt_output_text, toolResponse.chatgpt_final_output.output_text, label + ": readiness accepted text must equal root output.");
  assert.equal(readiness.accepted_chatgpt_output_hash, sha256(emittedText), label + ": accepted hash mismatch.");
  assert.equal(readiness.output_text, emittedText, label + ": output text mismatch.");
  assert.equal(readiness.output_hash, sha256(emittedText), label + ": output hash mismatch.");
  assert.equal(readiness.output_source, "acceptChatgptFinalOutputFromLiveToolCall(tool_response)", label + ": output source mismatch.");
  assert.equal(readiness.final_output_source, "acceptChatgptFinalOutputFromLiveToolCall(tool_response)", label + ": final output source mismatch.");
  assert.equal(readiness.source, "acceptChatgptFinalOutputFromLiveToolCall(tool_response)", label + ": source mismatch.");
  assert.equal(readiness.source_surface, "chatgpt_final_output_real_action_surface_readiness", label + ": source surface mismatch.");
  assert.equal(readiness.root_chatgpt_final_output_present, true, label + ": root presence mismatch.");
  assert.equal(readiness.root_chatgpt_final_output_before_result, true, label + ": root ordering mismatch.");
  assert.equal(topLevelKeys.indexOf("chatgpt_final_output") < topLevelKeys.indexOf("result"), true, label + ": wrapper key order mismatch.");
  assert.equal(readiness.root_tool_surface, "tool_response.chatgpt_final_output.output_text", label + ": root tool surface mismatch.");
  assert.equal(readiness.root_output_text_hash, toolResponse.chatgpt_final_output.output_hash, label + ": root output hash mismatch.");
  assert.equal(readiness.result_surface_present_but_not_required, true, label + ": result presence-but-not-required mismatch.");
  assert.equal(readiness.action_consumer_requires_result_read, false, label + ": result read requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_result_extraction, false, label + ": result extraction requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_index_read, false, label + ": index read requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_operator_checklist_read, false, label + ": checklist read requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_response_recomposition, false, label + ": recomposition requirement mismatch.");
  assert.equal(readiness.action_must_emit_accepted_text_exactly, true, label + ": exact accepted text flag mismatch.");
  assert.equal(readiness.action_must_not_emit_readiness_surface, true, label + ": readiness surface emit guard mismatch.");
  assert.equal(readiness.action_must_not_emit_live_acceptance_surface, true, label + ": live acceptance emit guard mismatch.");
  assert.equal(readiness.action_must_not_emit_final_closure_index, true, label + ": final closure emit guard mismatch.");
  assert.equal(readiness.action_must_not_emit_operator_checklist, true, label + ": operator checklist emit guard mismatch.");
  assert.equal(readiness.action_must_not_emit_result_surface, true, label + ": result emit guard mismatch.");
  assert.deepEqual(readiness.forbidden_sources, expectedForbiddenSources, label + ": forbidden sources mismatch.");
  assert.equal(readiness.no_new_output_layer, true, label + ": no_new_output_layer mismatch.");
  assert.equal(readiness.readiness_surface_is_reference_only, true, label + ": reference-only flag mismatch.");
  assert.equal(readiness.readiness_surface_must_not_replace_final_output, true, label + ": replacement guard mismatch.");
  assertNoFallback(readiness, label);
  assertOutputSafety(readiness.safety, label);

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(readiness.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(readiness.may_output_story_text, true, label + ": success story output mismatch.");
    assert.equal(readiness.accepted_chatgpt_output_text, expected.finalCandidateText, label + ": success final text mismatch.");
  } else {
    assert.equal(readiness.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(readiness.may_output_story_text, false, label + ": failure story output mismatch.");
    assert.equal(readiness.accepted_chatgpt_output_text.includes(expected.forbiddenStoryText), false, label + ": failure readiness must not include forbidden story text.");
  }
}

function assertInvalidRealActionReadiness() {
  const readiness = buildChatgptFinalOutputRealActionSurfaceReadiness({});
  assert.equal(readiness.used, true, "invalid readiness: used mismatch.");
  assert.equal(readiness.phase, "34X", "invalid readiness: phase mismatch.");
  assert.equal(readiness.contract_valid, false, "invalid readiness should be invalid.");
  assert.equal(readiness.response_kind, "real_action_surface_readiness_invalid_notice", "invalid readiness response kind mismatch.");
  assert.equal(readiness.real_action_surface_ready, false, "invalid readiness should not be ready.");
  assert.equal(readiness.real_action_surface_shape, "chatgpt_action_mcp_tool_response_wrapper", "invalid readiness shape mismatch.");
  assert.equal(readiness.can_emit_response_to_chat, true, "invalid readiness can emit mismatch.");
  assert.equal(readiness.can_output_to_chat, false, "invalid readiness output gate mismatch.");
  assert.equal(readiness.accepted_chatgpt_output_hash, sha256(readiness.accepted_chatgpt_output_text), "invalid readiness accepted hash mismatch.");
  assert.equal(readiness.output_hash, sha256(readiness.output_text), "invalid readiness output hash mismatch.");
  assert.equal(readiness.validation_errors.includes("tool_response_ok_not_true"), true, "invalid readiness missing ok error.");
  assert.equal(readiness.validation_errors.includes("root_chatgpt_final_output_top_level_missing"), true, "invalid readiness missing root top-level error.");
  assert.equal(readiness.validation_errors.includes("live_acceptance_contract_invalid"), true, "invalid readiness missing live acceptance error.");
  assert.deepEqual(readiness.forbidden_sources, expectedForbiddenSources, "invalid readiness forbidden sources mismatch.");
  assertNoFallback(readiness, "invalid readiness");
  assertOutputSafety(readiness.safety, "invalid readiness");

  const forbiddenStoryText = "這段正文候選不可被 real action readiness invalid notice echo。";
  const invalid = buildChatgptFinalOutputRealActionSurfaceReadiness({
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
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
    created: [],
    warnings: [],
    blocked: false,
    blocked_reason: null,
  });

  assert.equal(invalid.contract_valid, false, "invalid story readiness should be invalid.");
  assert.equal(invalid.accepted_chatgpt_output_text.includes(forbiddenStoryText), false, "invalid readiness accepted text must not echo story text.");
  assert.equal(invalid.output_text.includes(forbiddenStoryText), false, "invalid readiness output must not echo story text.");
  assert.equal(invalid.validation_errors.includes("root_chatgpt_final_output_contract_invalid"), true, "invalid story readiness missing root contract error.");
  assertNoFallback(invalid, "invalid story readiness");
  assertOutputSafety(invalid.safety, "invalid story readiness");
}

function assertRealActionReadinessIgnoresDecoySurfaces() {
  const rootText = "ROOT ONLY：Phase34X real action surface 只能輸出這一段。";
  const forbiddenTexts = [
    "FORBIDDEN tool_response.result",
    "FORBIDDEN result.final_candidate_text",
    "FORBIDDEN success_output_for_chat",
    "FORBIDDEN failure_output_for_chat",
    "FORBIDDEN final_response_for_chat",
    "FORBIDDEN final_response_handoff_for_chat",
    "FORBIDDEN extracted_chatgpt_final_output",
    "FORBIDDEN final closure index serialized text",
    "FORBIDDEN operator checklist serialized text",
    "FORBIDDEN live acceptance serialized text",
  ];

  const toolResponse = {
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
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
      decoy_result_surface: forbiddenTexts[0],
      final_candidate_text: forbiddenTexts[1],
      success_output_for_chat: {
        final_candidate_text_to_output: forbiddenTexts[2],
      },
      failure_output_for_chat: {
        failure_summary_for_chat: forbiddenTexts[3],
        recommended_operator_action: forbiddenTexts[3],
      },
      final_response_for_chat: {
        body: forbiddenTexts[4],
      },
      final_response_handoff_for_chat: {
        body: forbiddenTexts[5],
      },
      extracted_chatgpt_final_output: {
        used: true,
        output_text: forbiddenTexts[6],
        output_hash: sha256(forbiddenTexts[6]),
      },
      final_closure_index: forbiddenTexts[7],
      operator_handoff_checklist: forbiddenTexts[8],
      live_acceptance_smoke: forbiddenTexts[9],
    },
    created: [],
    warnings: [],
    blocked: false,
    blocked_reason: null,
  };

  const readiness = buildChatgptFinalOutputRealActionSurfaceReadiness(toolResponse);
  const acceptedText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);

  assert.equal(readiness.contract_valid, true, "decoy readiness should be valid.");
  assert.equal(readiness.real_action_surface_ready, true, "decoy readiness should be ready.");
  assert.equal(readiness.accepted_chatgpt_output_text, rootText, "readiness accepted text must use root output.");
  assert.equal(readiness.output_text, rootText, "readiness output must use root output.");
  assert.equal(acceptedText, rootText, "real action helper must use root output.");
  assert.equal(readiness.action_consumer_requires_result_read, false, "result read requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_index_read, false, "index read requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_operator_checklist_read, false, "checklist read requirement mismatch.");
  assert.equal(readiness.action_consumer_requires_response_recomposition, false, "recomposition requirement mismatch.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(readiness.accepted_chatgpt_output_text.includes(forbidden), false, "accepted text must ignore decoy: " + forbidden);
    assert.equal(acceptedText.includes(forbidden), false, "real action helper text must ignore decoy: " + forbidden);
  }

  assertNoFallback(readiness, "decoy readiness");
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
  task_prompt: "Phase34X ChatGPT final output real action surface readiness.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34x_real_action_surface_readiness: true,
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
      version: "phase34x-test-ledger-v1",
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
          evidence_refs: ["phase34x-real-action-surface-readiness"],
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
          evidence_refs: ["phase34x-real-action-surface-readiness"],
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
        model_name: "deterministic-phase34x-real-action-surface-readiness",
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
        model_name: "deterministic-phase34x-real-action-surface-readiness",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34x-real-action-surface-readiness",
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

assertInvalidRealActionReadiness();
assertRealActionReadinessIgnoresDecoySurfaces();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34x-"));

try {
  for (const item of cases) {
    const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
      item.input,
      item.optionsFor("bridge-" + item.label.replaceAll(" ", "-"), tempRoot),
    );

    assert.equal(bridge.ok, true, item.label + ": bridge ok mismatch.");
    assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", item.label + ": tool name mismatch.");
    assert.equal(bridge.permission, "write_low_risk", item.label + ": permission mismatch.");
    assert.equal(bridge.chatgpt_final_output.used, true, item.label + ": root final output used mismatch.");
    assert.equal(bridge.result != null, true, item.label + ": result missing.");
    assert.deepEqual(bridge.created, [], item.label + ": created outputs should be empty.");
    assert.equal(bridge.blocked, false, item.label + ": bridge blocked mismatch.");

    assertRealActionReadiness(bridge, item.expected, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34w = "tests/phase34/phase34w-chatgpt-final-output-live-tool-call-acceptance-smoke.test.mjs";
  const phase34x = "tests/phase34/phase34x-chatgpt-final-output-real-action-surface-readiness.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34w), "run-all missing Phase34W predecessor.");
  assert(runAllText.includes(phase34x), "run-all missing Phase34X registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34w) < runAllText.indexOf(phase34x), "Phase34X should run after Phase34W.");
  assert(runAllText.indexOf(phase34x) < runAllText.indexOf(daily), "Phase34X should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34X ChatGPT final output real action surface readiness tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
