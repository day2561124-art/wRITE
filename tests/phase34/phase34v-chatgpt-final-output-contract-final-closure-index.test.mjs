import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptFinalOutputContractFinalClosureIndex,
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
  "result.final_candidate_text",
  "result.success_output_for_chat",
  "result.failure_output_for_chat",
  "result.final_response_for_chat",
  "result.final_response_handoff_for_chat",
  "result.extracted_chatgpt_final_output",
];

const expectedPhases = ["34J", "34K", "34L", "34M", "34N", "34O", "34P", "34Q", "34R", "34S", "34T", "34U"];

function assertNoFallback(index, label) {
  assert.equal(index.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(index.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(index.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(index.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(index.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(index.may_construct_response, false, label + ": construct response mismatch.");
  assert.equal(index.may_read_tool_response_result, false, label + ": may_read_tool_response_result mismatch.");
  assert.equal(index.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(index.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(index.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(index.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(index.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(index.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output fallback mismatch.");
  assert.equal(index.may_fallback_to_extracted_output_recomposition, false, label + ": extracted recomposition mismatch.");
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

function assertFinalClosureIndex(index, expected, label) {
  const finalText = emitChatgptFinalOutputText(expected.toolResponse);

  assert.equal(index.used, true, label + ": used mismatch.");
  assert.equal(index.phase, "34V", label + ": phase mismatch.");
  assert.equal(index.surface_kind, "chatgpt_final_output_contract_final_closure_index", label + ": surface kind mismatch.");
  assert.equal(index.contract_valid, true, label + ": contract valid mismatch.");
  assert.deepEqual(index.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(index.status, "ready_to_use_final_closure_index", label + ": status mismatch.");
  assert.equal(index.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(index.phase_range, "34J-34U", label + ": phase range mismatch.");
  assert.deepEqual(index.covered_phases, expectedPhases, label + ": covered phases mismatch.");
  assert.equal(index.final_unique_output_entrypoint, "emitChatgptFinalOutputText(tool_response)", label + ": final entrypoint mismatch.");
  assert.equal(index.final_operator_handoff_checklist, "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)", label + ": checklist function mismatch.");
  assert.equal(index.root_tool_surface, "tool_response.chatgpt_final_output.output_text", label + ": root surface mismatch.");
  assert.equal(index.final_closure_status, "phase34_output_contract_closed", label + ": closure status mismatch.");
  assert.equal(index.no_new_output_layer, true, label + ": no_new_output_layer mismatch.");
  assert.equal(index.index_is_reference_only, true, label + ": index reference flag mismatch.");
  assert.equal(index.index_must_not_replace_final_output, true, label + ": index replacement guard mismatch.");
  assert.equal(index.index_must_not_be_emitted_as_chat_output, true, label + ": index emit guard mismatch.");
  assert.equal(index.final_output_must_still_use_entrypoint, true, label + ": final output entrypoint guard mismatch.");
  assert.equal(index.reference_final_output_text, finalText, label + ": reference final text mismatch.");
  assert.equal(index.reference_final_output_hash, sha256(finalText), label + ": reference final hash mismatch.");
  assert.equal(index.reference_final_output_source, "emitChatgptFinalOutputText(tool_response)", label + ": reference source mismatch.");
  assert.deepEqual(index.forbidden_sources, expectedForbiddenSources, label + ": forbidden sources mismatch.");
  assert.equal(Array.isArray(index.final_closure_index_entries), true, label + ": index entries should be array.");
  assert.equal(index.final_closure_index_entries.length, expectedPhases.length, label + ": index entry count mismatch.");
  assert.deepEqual(index.final_closure_index_entries.map((entry) => entry.phase), expectedPhases, label + ": phase order mismatch.");

  for (const entry of index.final_closure_index_entries) {
    assert.equal(typeof entry.name, "string", label + ": entry name missing for " + entry.phase);
    assert.equal(typeof entry.test_path, "string", label + ": entry test path missing for " + entry.phase);
    assert.equal(entry.test_path.includes("tests/phase34/phase34" + entry.phase.slice(2).toLowerCase()), true, label + ": entry test path should match phase " + entry.phase);
    assert.equal(typeof entry.role, "string", label + ": entry role missing for " + entry.phase);
  }

  assert.deepEqual(index.internal_source_chain, [
    "success_output_for_chat / failure_output_for_chat",
    "final_response_for_chat",
    "final_response_handoff_for_chat",
    "extracted_chatgpt_final_output",
    "chatgpt_final_output",
    "consumer emission contract",
    "E2E compliance emission",
    "operator handoff checklist",
    "emitChatgptFinalOutputText(tool_response)",
  ], label + ": internal source chain mismatch.");

  assert.deepEqual(index.upstream_reference_chain, [
    "emitChatgptFinalOutputText(tool_response)",
    "buildChatgptFinalOutputE2EComplianceEmission(tool_response).output_text",
    "buildChatgptFinalOutputConsumerEmission(tool_response).output_text",
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result.extracted_chatgpt_final_output.output_text",
    "tool_response.result.final_response_handoff_for_chat.body",
    "tool_response.result.final_response_for_chat.body",
    "tool_response.result.success_output_for_chat.final_candidate_text_to_output OR tool_response.result.failure_output_for_chat",
  ], label + ": upstream reference chain mismatch.");

  assertNoFallback(index, label);
  assertOutputSafety(index.safety, label);
  assert.equal(index.may_save_candidate, false, label + ": may_save_candidate mismatch.");
  assert.equal(index.may_approve_candidate, false, label + ": may_approve_candidate mismatch.");
  assert.equal(index.may_adopt_candidate, false, label + ": may_adopt_candidate mismatch.");
  assert.equal(index.may_update_canon, false, label + ": may_update_canon mismatch.");
  assert.equal(index.may_update_active_engine, false, label + ": may_update_active_engine mismatch.");

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(index.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(index.may_output_story_text, true, label + ": success story output mismatch.");
    assert.equal(index.reference_final_output_text, expected.finalCandidateText, label + ": success final text mismatch.");
  } else {
    assert.equal(index.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(index.may_output_story_text, false, label + ": failure story output mismatch.");
    assert.equal(index.reference_final_output_text.includes(expected.forbiddenStoryText), false, label + ": failure index must not include forbidden story text.");
  }
}

function assertInvalidFinalClosureIndex() {
  const index = buildChatgptFinalOutputContractFinalClosureIndex({});
  assert.equal(index.used, true, "invalid index: used mismatch.");
  assert.equal(index.phase, "34V", "invalid index: phase mismatch.");
  assert.equal(index.contract_valid, false, "invalid index should be invalid.");
  assert.equal(index.response_kind, "final_closure_index_contract_invalid_notice", "invalid index response kind mismatch.");
  assert.equal(index.can_emit_response_to_chat, true, "invalid index can emit mismatch.");
  assert.equal(index.can_output_to_chat, false, "invalid index output gate mismatch.");
  assert.equal(index.phase_range, "34J-34U", "invalid index phase range mismatch.");
  assert.deepEqual(index.covered_phases, expectedPhases, "invalid index covered phases mismatch.");
  assert.equal(index.final_unique_output_entrypoint, "emitChatgptFinalOutputText(tool_response)", "invalid index entrypoint mismatch.");
  assert.equal(index.final_operator_handoff_checklist, "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)", "invalid index checklist mismatch.");
  assert.equal(index.root_tool_surface, "tool_response.chatgpt_final_output.output_text", "invalid index root surface mismatch.");
  assert.equal(index.no_new_output_layer, true, "invalid index no_new_output_layer mismatch.");
  assert.equal(index.index_is_reference_only, true, "invalid index reference flag mismatch.");
  assert.equal(index.index_must_not_replace_final_output, true, "invalid index replace guard mismatch.");
  assert.equal(index.index_must_not_be_emitted_as_chat_output, true, "invalid index emit guard mismatch.");
  assert.equal(index.reference_final_output_hash, sha256(index.reference_final_output_text), "invalid index reference hash mismatch.");
  assert.equal(index.contract_invalid_notice_hash, sha256(index.contract_invalid_notice_text), "invalid index notice hash mismatch.");
  assert.equal(index.validation_errors.includes("operator_handoff_checklist_contract_invalid"), true, "invalid index missing checklist contract error.");
  assert.deepEqual(index.forbidden_sources, expectedForbiddenSources, "invalid index forbidden sources mismatch.");
  assert.deepEqual(index.final_closure_index_entries.map((entry) => entry.phase), expectedPhases, "invalid index phase order mismatch.");
  assertNoFallback(index, "invalid index");
  assertOutputSafety(index.safety, "invalid index");

  const forbiddenStoryText = "這段正文候選不可被 final closure index invalid notice echo。";
  const invalid = buildChatgptFinalOutputContractFinalClosureIndex({
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

  assert.equal(invalid.contract_valid, false, "invalid story index should be invalid.");
  assert.equal(invalid.reference_final_output_text.includes(forbiddenStoryText), false, "invalid index must not echo story text.");
  assert.equal(invalid.contract_invalid_notice_text.includes(forbiddenStoryText), false, "invalid index notice must not echo story text.");
  assert.equal(invalid.validation_errors.includes("operator_handoff_checklist_contract_invalid"), true, "invalid story index missing checklist error.");
  assertNoFallback(invalid, "invalid story index");
  assertOutputSafety(invalid.safety, "invalid story index");
}

function assertFinalClosureIndexIgnoresDecoyResultSurfaces() {
  const rootText = "ROOT ONLY：Phase34V final closure index 只能把這段視為最終輸出參照。";
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

  const index = buildChatgptFinalOutputContractFinalClosureIndex(toolResponse);
  assert.equal(index.contract_valid, true, "decoy index should be valid.");
  assert.equal(index.reference_final_output_text, rootText, "index reference text must use emit function result.");
  assert.equal(index.final_unique_output_entrypoint, "emitChatgptFinalOutputText(tool_response)", "entrypoint mismatch.");
  assert.equal(index.no_new_output_layer, true, "decoy index should not create a new output layer.");
  assert.equal(index.index_must_not_be_emitted_as_chat_output, true, "decoy index emit guard mismatch.");

  for (const forbidden of forbiddenTexts) {
    assert.equal(index.reference_final_output_text.includes(forbidden), false, "index reference text must ignore fallback text: " + forbidden);
  }

  assertNoFallback(index, "decoy index");
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
  task_prompt: "Phase34V ChatGPT final output contract final closure index.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34v_final_output_contract_final_closure_index: true,
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
        model_name: "deterministic-phase34v-final-closure-index",
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
        model_name: "deterministic-phase34v-final-closure-index",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34v-final-closure-index",
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

assertInvalidFinalClosureIndex();
assertFinalClosureIndexIgnoresDecoyResultSurfaces();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34v-"));

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

    const index = buildChatgptFinalOutputContractFinalClosureIndex(bridge);
    assertFinalClosureIndex(index, { ...item.expected, toolResponse: bridge }, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34u = "tests/phase34/phase34u-chatgpt-final-output-operator-handoff-checklist.test.mjs";
  const phase34v = "tests/phase34/phase34v-chatgpt-final-output-contract-final-closure-index.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34u), "run-all missing Phase34U predecessor.");
  assert(runAllText.includes(phase34v), "run-all missing Phase34V registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34u) < runAllText.indexOf(phase34v), "Phase34V should run after Phase34U.");
  assert(runAllText.indexOf(phase34v) < runAllText.indexOf(daily), "Phase34V should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34V ChatGPT final output contract final closure index tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
