import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildExtractedChatGptFinalOutput,
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

function assertNoFallback(output, label) {
  assert.equal(output.must_emit_exactly, true, label + ": must_emit_exactly mismatch.");
  assert.equal(output.no_extra_text, true, label + ": no_extra_text mismatch.");
  assert.equal(output.no_fallback, true, label + ": no_fallback mismatch.");
  assert.equal(output.may_include_extra_explanation, false, label + ": extra explanation flag mismatch.");
  assert.equal(output.may_rewrite, false, label + ": rewrite flag mismatch.");
  assert.equal(output.may_summarize, false, label + ": summarize flag mismatch.");
  assert.equal(output.may_fallback_to_final_candidate_text, false, label + ": final candidate fallback mismatch.");
  assert.equal(output.may_fallback_to_success_output, false, label + ": success output fallback mismatch.");
  assert.equal(output.may_fallback_to_failure_output, false, label + ": failure output fallback mismatch.");
  assert.equal(output.may_fallback_to_final_response, false, label + ": final response fallback mismatch.");
  assert.equal(output.may_construct_response, false, label + ": construct response mismatch.");
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

function assertExtractedOutput(result, expected, label) {
  const handoff = result.final_response_handoff_for_chat;
  const output = result.extracted_chatgpt_final_output;
  const summary = result.full_neural_orchestration_summary;

  assert(handoff, label + ": final_response_handoff_for_chat missing.");
  assert(output, label + ": extracted_chatgpt_final_output missing.");
  assert.equal(output.used, true, label + ": extracted output used mismatch.");
  assert.equal(output.phase, "34Q", label + ": extracted output phase mismatch.");
  assert.equal(output.surface_kind, "chatgpt_bridge_final_output_live_extraction_contract", label + ": surface kind mismatch.");
  assert.equal(output.extraction_contract_valid, true, label + ": extraction contract should be valid.");
  assert.deepEqual(output.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(output.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(output.can_emit_response_to_chat, true, label + ": can emit response mismatch.");
  assert.equal(output.output_source, "final_response_handoff_for_chat.body", label + ": output source mismatch.");
  assert.equal(output.final_output_source, "final_response_handoff_for_chat.body", label + ": final output source mismatch.");
  assert.equal(output.source_surface, "final_response_handoff_for_chat", label + ": source surface mismatch.");
  assert.equal(output.source_response_kind, handoff.response_kind, label + ": source response kind mismatch.");
  assert.equal(output.source_handoff_status, handoff.status, label + ": source handoff status mismatch.");
  assert.equal(output.output_text, handoff.body, label + ": output text must equal handoff body.");
  assert.equal(output.output_hash, handoff.body_hash, label + ": output hash must equal handoff hash.");
  assert.equal(output.output_hash, sha256(output.output_text), label + ": output hash mismatch.");
  assert.equal(summary.extracted_chatgpt_final_output_used, true, label + ": summary output used mismatch.");
  assert.equal(summary.extracted_chatgpt_final_output_valid, true, label + ": summary output valid mismatch.");
  assert.equal(summary.extracted_chatgpt_final_output_kind, expected.responseKind, label + ": summary output kind mismatch.");
  assert.equal(summary.extracted_chatgpt_final_output_hash, output.output_hash, label + ": summary output hash mismatch.");
  assert.equal(summary.extracted_chatgpt_final_output_source, "final_response_handoff_for_chat.body", label + ": summary output source mismatch.");
  assertNoFallback(output, label);
  assertOutputSafety(output.safety, label);

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(output.status, "ready_to_emit_final_candidate_text", label + ": success status mismatch.");
    assert.equal(output.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(output.handoff_contract_valid, true, label + ": success handoff validity mismatch.");
    assert.equal(output.may_output_story_text, true, label + ": success story output mismatch.");
    assert.equal(output.output_text, result.final_candidate_text, label + ": output must equal root final candidate.");
    assert.equal(output.output_text, result.success_output_for_chat.final_candidate_text_to_output, label + ": output must equal success surface.");
    assert.equal(output.output_text, expected.finalCandidateText, label + ": output must equal expected candidate.");
  } else {
    assert.equal(output.status, "ready_to_emit_pipeline_failure_notice", label + ": failure status mismatch.");
    assert.equal(output.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(output.handoff_contract_valid, true, label + ": failure handoff validity mismatch.");
    assert.equal(output.may_output_story_text, false, label + ": failure story output mismatch.");
    assert.equal(result.final_candidate_text, "", label + ": failed result must not expose candidate text.");
    assert.equal(result.final_candidate_hash, "", label + ": failed result must not expose candidate hash.");
    assert.equal(output.output_text.includes(result.failure_output_for_chat.failure_summary_for_chat), true, label + ": failure output missing summary.");
    assert.equal(output.output_text.includes(result.failure_output_for_chat.recommended_operator_action), true, label + ": failure output missing operator action.");
    assert.equal(output.output_text.includes(expected.forbiddenStoryText), false, label + ": failure output must not include story text.");
  }
}

function assertBridgeOutputAlignment(bridge, expected, label) {
  assert.equal(bridge.ok, true, label + ": bridge ok mismatch.");
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", label + ": tool name mismatch.");
  assert.equal(bridge.permission, "write_low_risk", label + ": permission mismatch.");
  assert.deepEqual(bridge.created, [], label + ": created outputs should be empty.");
  assert.equal(bridge.blocked, false, label + ": bridge blocked mismatch.");
  assertExtractedOutput(bridge.result, expected, label + " result");

  const outer = bridge.full_neural_orchestration_summary;
  const inner = bridge.result.full_neural_orchestration_summary;
  const alignedKeys = [
    "final_response_handoff_used",
    "final_response_handoff_valid",
    "final_response_handoff_kind",
    "final_response_handoff_body_hash",
    "extracted_chatgpt_final_output_used",
    "extracted_chatgpt_final_output_valid",
    "extracted_chatgpt_final_output_kind",
    "extracted_chatgpt_final_output_hash",
    "extracted_chatgpt_final_output_source",
    "candidate_only",
    "active_engine_update_allowed",
    "canon_update_allowed",
  ];

  for (const key of alignedKeys) {
    assert.equal(outer[key], inner[key], label + ": outer/inner summary " + key + " mismatch.");
  }

  assert.equal(outer.extracted_chatgpt_final_output_used, true, label + ": outer output used mismatch.");
  assert.equal(outer.extracted_chatgpt_final_output_valid, true, label + ": outer output valid mismatch.");
  assert.equal(outer.extracted_chatgpt_final_output_kind, expected.responseKind, label + ": outer output kind mismatch.");
  assert.equal(outer.extracted_chatgpt_final_output_hash, bridge.result.extracted_chatgpt_final_output.output_hash, label + ": outer output hash mismatch.");
  assert.equal(outer.extracted_chatgpt_final_output_source, "final_response_handoff_for_chat.body", label + ": outer output source mismatch.");
}

function assertInvalidExtraction() {
  const missing = buildExtractedChatGptFinalOutput(null);
  assert.equal(missing.used, true, "missing extraction: used mismatch.");
  assert.equal(missing.phase, "34Q", "missing extraction: phase mismatch.");
  assert.equal(missing.extraction_contract_valid, false, "missing extraction: should be invalid.");
  assert.equal(missing.response_kind, "extraction_contract_invalid_notice", "missing extraction: response kind mismatch.");
  assert.equal(missing.can_emit_response_to_chat, true, "missing extraction: can emit notice mismatch.");
  assert.equal(missing.can_output_to_chat, false, "missing extraction: output gate mismatch.");
  assert.equal(missing.output_hash, sha256(missing.output_text), "missing extraction: hash mismatch.");
  assert.equal(missing.validation_errors.includes("final_response_handoff_used_false_or_missing"), true, "missing extraction: validation error missing.");
  assert.equal(missing.operator_action, "inspect_final_response_handoff_for_chat_contract", "missing extraction: operator action mismatch.");
  assertNoFallback(missing, "missing extraction");
  assertOutputSafety(missing.safety, "missing extraction");

  const storyText = "合法正文候選";
  const invalidHandoff = buildFinalResponseHandoffForChat({
    used: true,
    phase: "34O",
    response_kind: "final_candidate_text",
    can_output_to_chat: true,
    body: storyText,
    body_hash: "bad-hash",
    source_surface: "success_output_for_chat",
    must_output_body_exactly: true,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: true,
  });

  const extractedNotice = buildExtractedChatGptFinalOutput(invalidHandoff);
  assert.equal(invalidHandoff.contract_valid, false, "invalid handoff should be invalid.");
  assert.equal(extractedNotice.extraction_contract_valid, true, "invalid handoff notice should be extractable.");
  assert.equal(extractedNotice.response_kind, "contract_invalid_notice", "invalid handoff notice response kind mismatch.");
  assert.equal(extractedNotice.status, "ready_to_emit_contract_invalid_notice", "invalid handoff notice status mismatch.");
  assert.equal(extractedNotice.output_source, "final_response_handoff_for_chat.body", "invalid handoff notice source mismatch.");
  assert.equal(extractedNotice.output_text, invalidHandoff.body, "invalid handoff notice body mismatch.");
  assert.equal(extractedNotice.output_hash, invalidHandoff.body_hash, "invalid handoff notice hash mismatch.");
  assert.equal(extractedNotice.output_text.includes(storyText), false, "invalid handoff notice must not echo story text.");
  assert.equal(extractedNotice.handoff_contract_valid, false, "invalid handoff validity should surface false.");
  assert.equal(extractedNotice.may_output_story_text, false, "invalid handoff notice story output mismatch.");
  assertNoFallback(extractedNotice, "invalid handoff notice");
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
  task_prompt: "Phase34Q ChatGPT bridge final output live extraction contract.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34q_final_output_live_extraction_contract: true,
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
        model_name: "deterministic-phase34q-final-output",
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
        model_name: "deterministic-phase34q-final-output",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34q-final-output",
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

assertInvalidExtraction();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34q-"));

try {
  for (const item of cases) {
    const direct = await runFullNeuralWritingPipelineSingleEntryBridge(
      item.input,
      item.optionsFor("direct-" + item.label.replaceAll(" ", "-"), tempRoot),
    );
    assertExtractedOutput(direct, item.expected, "direct " + item.label);

    const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(
      item.input,
      item.optionsFor("bridge-" + item.label.replaceAll(" ", "-"), tempRoot),
    );
    assertBridgeOutputAlignment(bridge, item.expected, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34p = "tests/phase34/phase34p-chatgpt-bridge-final-response-handoff-contract.test.mjs";
  const phase34q = "tests/phase34/phase34q-chatgpt-bridge-final-output-live-extraction-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34p), "run-all missing Phase34P predecessor.");
  assert(runAllText.includes(phase34q), "run-all missing Phase34Q registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34p) < runAllText.indexOf(phase34q), "Phase34Q should run after Phase34P.");
  assert(runAllText.indexOf(phase34q) < runAllText.indexOf(daily), "Phase34Q should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34Q ChatGPT bridge final output live extraction contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
