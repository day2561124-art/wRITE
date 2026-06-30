import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  acceptChatgptFinalOutputFromRealActionSurface,
  buildChatgptFinalOutputRealActionFinalSmoke,
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
  "buildChatgptFinalOutputRealActionSurfaceReadiness(tool_response)",
];

function assertNoFallback(smoke, label) {
  assert.equal(smoke.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(smoke.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(smoke.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(smoke.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(smoke.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(smoke.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(smoke.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(smoke.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(smoke.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(smoke.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(smoke.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(smoke.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(smoke.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(smoke.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
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

function assertRealActionFinalSmoke(toolResponse, expected, label) {
  const readiness = buildChatgptFinalOutputRealActionSurfaceReadiness(toolResponse);
  const smoke = buildChatgptFinalOutputRealActionFinalSmoke(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);

  assert.equal(smoke.used, true, label + ": used mismatch.");
  assert.equal(smoke.phase, "34Y", label + ": phase mismatch.");
  assert.equal(smoke.surface_kind, "chatgpt_final_output_real_action_final_smoke", label + ": surface kind mismatch.");
  assert.equal(smoke.contract_valid, true, label + ": contract valid mismatch.");
  assert.deepEqual(smoke.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(smoke.status, "real_action_final_output_smoke_passed", label + ": status mismatch.");
  assert.equal(smoke.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(smoke.real_action_final_smoke_passed, true, label + ": smoke passed mismatch.");
  assert.equal(smoke.final_action_output_entrypoint, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", label + ": final action entrypoint mismatch.");
  assert.equal(smoke.canonical_final_output_entrypoint, "emitChatgptFinalOutputText(tool_response)", label + ": canonical entrypoint mismatch.");
  assert.equal(smoke.required_chatgpt_consumable_field, "tool_response.chatgpt_final_output.output_text", label + ": consumable field mismatch.");
  assert.equal(smoke.final_smoke_output_text, finalText, label + ": final smoke text mismatch.");
  assert.equal(smoke.final_smoke_output_text, canonicalText, label + ": canonical output mismatch.");
  assert.equal(smoke.final_smoke_output_text, toolResponse.chatgpt_final_output.output_text, label + ": root output mismatch.");
  assert.equal(smoke.final_smoke_output_text, readiness.accepted_chatgpt_output_text, label + ": readiness accepted text mismatch.");
  assert.equal(smoke.final_smoke_output_hash, sha256(finalText), label + ": final smoke hash mismatch.");
  assert.equal(smoke.output_text, finalText, label + ": output text mismatch.");
  assert.equal(smoke.output_hash, sha256(finalText), label + ": output hash mismatch.");
  assert.equal(smoke.output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", label + ": output source mismatch.");
  assert.equal(smoke.final_output_source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", label + ": final output source mismatch.");
  assert.equal(smoke.source, "acceptChatgptFinalOutputFromRealActionSurface(tool_response)", label + ": source mismatch.");
  assert.equal(smoke.source_surface, "chatgpt_final_output_real_action_final_smoke", label + ": source surface mismatch.");
  assert.equal(smoke.source_response_kind, readiness.response_kind, label + ": source response kind mismatch.");
  assert.equal(smoke.source_status, readiness.status, label + ": source status mismatch.");
  assert.equal(smoke.source_output_hash, readiness.accepted_chatgpt_output_hash, label + ": source output hash mismatch.");
  assert.equal(smoke.source_output_source, readiness.accepted_chatgpt_output_source, label + ": source output source mismatch.");
  assert.equal(smoke.root_output_text_hash, toolResponse.chatgpt_final_output.output_hash, label + ": root output hash mismatch.");
  assert.equal(smoke.final_smoke_output_matches_root, true, label + ": root match flag mismatch.");
  assert.equal(smoke.final_smoke_output_matches_canonical_emit, true, label + ": canonical match flag mismatch.");
  assert.equal(smoke.final_smoke_output_matches_real_action_readiness, true, label + ": readiness match flag mismatch.");
  assert.equal(smoke.final_smoke_is_reference_only, true, label + ": reference-only flag mismatch.");
  assert.equal(smoke.final_smoke_must_not_replace_final_output, true, label + ": replacement guard mismatch.");
  assert.equal(smoke.final_smoke_must_not_be_emitted_as_chat_output, true, label + ": smoke emit guard mismatch.");
  assert.equal(smoke.final_smoke_must_emit_final_text_exactly, true, label + ": exact final text flag mismatch.");
  assert.equal(smoke.final_smoke_requires_no_result_read, true, label + ": no result read flag mismatch.");
  assert.equal(smoke.final_smoke_requires_no_index_read, true, label + ": no index read flag mismatch.");
  assert.equal(smoke.final_smoke_requires_no_checklist_read, true, label + ": no checklist read flag mismatch.");
  assert.equal(smoke.final_smoke_requires_no_recomposition, true, label + ": no recomposition flag mismatch.");
  assert.equal(smoke.must_not_emit_readiness_surface, true, label + ": readiness emit guard mismatch.");
  assert.equal(smoke.must_not_emit_live_acceptance_surface, true, label + ": live acceptance emit guard mismatch.");
  assert.equal(smoke.must_not_emit_final_closure_index, true, label + ": final closure emit guard mismatch.");
  assert.equal(smoke.must_not_emit_operator_checklist, true, label + ": operator checklist emit guard mismatch.");
  assert.equal(smoke.must_not_emit_result_surface, true, label + ": result emit guard mismatch.");
  assert.deepEqual(smoke.forbidden_sources, expectedForbiddenSources, label + ": forbidden sources mismatch.");
  assert.equal(smoke.no_new_output_layer, true, label + ": no_new_output_layer mismatch.");
  assertNoFallback(smoke, label);
  assertOutputSafety(smoke.safety, label);

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(smoke.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(smoke.may_output_story_text, true, label + ": success story output mismatch.");
    assert.equal(smoke.final_smoke_output_text, expected.finalCandidateText, label + ": success final text mismatch.");
  } else {
    assert.equal(smoke.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(smoke.may_output_story_text, false, label + ": failure story output mismatch.");
    assert.equal(smoke.final_smoke_output_text.includes(expected.forbiddenStoryText), false, label + ": failure smoke must not include forbidden story text.");
  }
}

function assertInvalidRealActionFinalSmoke() {
  const smoke = buildChatgptFinalOutputRealActionFinalSmoke({});
  assert.equal(smoke.used, true, "invalid smoke: used mismatch.");
  assert.equal(smoke.phase, "34Y", "invalid smoke: phase mismatch.");
  assert.equal(smoke.contract_valid, false, "invalid smoke should be invalid.");
  assert.equal(smoke.response_kind, "real_action_final_smoke_invalid_notice", "invalid smoke response kind mismatch.");
  assert.equal(smoke.real_action_final_smoke_passed, false, "invalid smoke should not pass.");
  assert.equal(smoke.can_emit_response_to_chat, true, "invalid smoke can emit mismatch.");
  assert.equal(smoke.can_output_to_chat, false, "invalid smoke output gate mismatch.");
  assert.equal(smoke.final_smoke_output_hash, sha256(smoke.final_smoke_output_text), "invalid smoke final hash mismatch.");
  assert.equal(smoke.output_hash, sha256(smoke.output_text), "invalid smoke output hash mismatch.");
  assert.equal(smoke.validation_errors.includes("real_action_readiness_contract_invalid"), true, "invalid smoke missing readiness contract error.");
  assert.equal(smoke.validation_errors.includes("root_chatgpt_final_output_used_false_or_missing"), true, "invalid smoke missing root used error.");
  assert.deepEqual(smoke.forbidden_sources, expectedForbiddenSources, "invalid smoke forbidden sources mismatch.");
  assertNoFallback(smoke, "invalid smoke");
  assertOutputSafety(smoke.safety, "invalid smoke");

  const forbiddenStoryText = "這段正文候選不可被 real action final smoke invalid notice echo。";
  const invalid = buildChatgptFinalOutputRealActionFinalSmoke({
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

  assert.equal(invalid.contract_valid, false, "invalid story smoke should be invalid.");
  assert.equal(invalid.final_smoke_output_text.includes(forbiddenStoryText), false, "invalid smoke final text must not echo story text.");
  assert.equal(invalid.output_text.includes(forbiddenStoryText), false, "invalid smoke output must not echo story text.");
  assert.equal(invalid.validation_errors.includes("real_action_readiness_contract_invalid"), true, "invalid story smoke missing readiness error.");
  assertNoFallback(invalid, "invalid story smoke");
  assertOutputSafety(invalid.safety, "invalid story smoke");
}

function assertRealActionFinalSmokeIgnoresAllDecoys() {
  const rootText = "ROOT ONLY：Phase34Y real action final smoke 只能輸出這一段。";
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
    "FORBIDDEN readiness serialized text",
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
      real_action_readiness: forbiddenTexts[10],
    },
    created: [],
    warnings: [],
    blocked: false,
    blocked_reason: null,
  };

  const smoke = buildChatgptFinalOutputRealActionFinalSmoke(toolResponse);
  assert.equal(smoke.contract_valid, true, "decoy final smoke should be valid.");
  assert.equal(smoke.real_action_final_smoke_passed, true, "decoy final smoke should pass.");
  assert.equal(smoke.final_smoke_output_text, rootText, "final smoke text must use root output.");
  assert.equal(smoke.output_text, rootText, "final smoke output must use root output.");
  assert.equal(smoke.final_smoke_output_matches_root, true, "root match mismatch.");
  assert.equal(smoke.final_smoke_output_matches_canonical_emit, true, "canonical match mismatch.");
  assert.equal(smoke.final_smoke_output_matches_real_action_readiness, true, "readiness match mismatch.");
  assert.equal(smoke.final_smoke_requires_no_result_read, true, "no result read mismatch.");
  assert.equal(smoke.final_smoke_requires_no_index_read, true, "no index read mismatch.");
  assert.equal(smoke.final_smoke_requires_no_checklist_read, true, "no checklist read mismatch.");
  assert.equal(smoke.final_smoke_requires_no_recomposition, true, "no recomposition mismatch.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(smoke.final_smoke_output_text.includes(forbidden), false, "final smoke text must ignore decoy: " + forbidden);
    assert.equal(smoke.output_text.includes(forbidden), false, "output text must ignore decoy: " + forbidden);
  }

  assertNoFallback(smoke, "decoy final smoke");
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
  task_prompt: "Phase34Y ChatGPT final output real action final smoke.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34y_real_action_final_smoke: true,
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
    label: "revision provider missing",
    input: inputWith({ max_revision_rounds: 1 }),
    optionsFor: (label, tempRoot) => baseOptions(label, tempRoot, {
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34y-real-action-final-smoke",
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
        model_name: "deterministic-phase34y-real-action-final-smoke",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34y-real-action-final-smoke",
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

assertInvalidRealActionFinalSmoke();
assertRealActionFinalSmokeIgnoresAllDecoys();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34y-"));

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

    assertRealActionFinalSmoke(bridge, item.expected, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34x = "tests/phase34/phase34x-chatgpt-final-output-real-action-surface-readiness.test.mjs";
  const phase34y = "tests/phase34/phase34y-chatgpt-final-output-real-action-final-smoke.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34x), "run-all missing Phase34X predecessor.");
  assert(runAllText.includes(phase34y), "run-all missing Phase34Y registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34x) < runAllText.indexOf(phase34y), "Phase34Y should run after Phase34X.");
  assert(runAllText.indexOf(phase34y) < runAllText.indexOf(daily), "Phase34Y should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34Y ChatGPT final output real action final smoke tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
