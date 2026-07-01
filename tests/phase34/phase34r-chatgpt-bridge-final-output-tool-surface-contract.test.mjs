import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptFinalOutputToolSurface,
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
  assert.equal(output.may_fallback_to_final_response_handoff, false, label + ": final response handoff fallback mismatch.");
  assert.equal(output.may_fallback_to_extracted_chatgpt_final_output, false, label + ": extracted output direct fallback mismatch.");
  assert.equal(output.may_fallback_to_extracted_output_recomposition, false, label + ": extracted output recomposition mismatch.");
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

function assertRootFinalOutput(bridge, expected, label) {
  const rootOutput = bridge.chatgpt_final_output;
  const extracted = bridge.result.extracted_chatgpt_final_output;

  assert(rootOutput, label + ": root chatgpt_final_output missing.");
  assert(extracted, label + ": result extracted_chatgpt_final_output missing.");

  assert.equal(rootOutput.used, true, label + ": root output used mismatch.");
  assert.equal(rootOutput.phase, "34R", label + ": root output phase mismatch.");
  assert.equal(rootOutput.surface_kind, "chatgpt_bridge_final_output_tool_surface_contract", label + ": surface kind mismatch.");
  assert.equal(rootOutput.contract_valid, true, label + ": contract valid mismatch.");
  assert.deepEqual(rootOutput.validation_errors, [], label + ": validation errors should be empty.");
  assert.equal(rootOutput.status, "ready_to_emit_chatgpt_final_output", label + ": status mismatch.");
  assert.equal(rootOutput.response_kind, expected.responseKind, label + ": response kind mismatch.");
  assert.equal(rootOutput.can_emit_response_to_chat, true, label + ": can emit response mismatch.");
  assert.equal(rootOutput.output_source, "result.extracted_chatgpt_final_output.output_text", label + ": output source mismatch.");
  assert.equal(rootOutput.final_output_source, "result.extracted_chatgpt_final_output.output_text", label + ": final output source mismatch.");
  assert.equal(rootOutput.source, "result.extracted_chatgpt_final_output.output_text", label + ": source mismatch.");
  assert.equal(rootOutput.source_surface, "result.extracted_chatgpt_final_output", label + ": source surface mismatch.");
  assert.equal(rootOutput.source_response_kind, extracted.response_kind, label + ": source response kind mismatch.");
  assert.equal(rootOutput.source_status, extracted.status, label + ": source status mismatch.");
  assert.equal(rootOutput.source_output_hash, extracted.output_hash, label + ": source output hash mismatch.");
  assert.equal(rootOutput.source_output_source, extracted.output_source, label + ": source output source mismatch.");
  assert.equal(rootOutput.output_text, extracted.output_text, label + ": root output text must equal extracted output text.");
  assert.equal(rootOutput.output_hash, extracted.output_hash, label + ": root output hash must equal extracted output hash.");
  assert.equal(rootOutput.output_hash, sha256(rootOutput.output_text), label + ": root output hash mismatch.");
  assertNoFallback(rootOutput, label);
  assertOutputSafety(rootOutput.safety, label);

  if (expected.responseKind === "final_candidate_text") {
    assert.equal(rootOutput.can_output_to_chat, true, label + ": success output gate mismatch.");
    assert.equal(rootOutput.may_output_story_text, true, label + ": success story output mismatch.");
    assert.equal(rootOutput.output_text, bridge.result.final_candidate_text, label + ": root output must equal final candidate.");
    assert.equal(rootOutput.output_text, bridge.result.success_output_for_chat.final_candidate_text_to_output, label + ": root output must equal success surface.");
    assert.equal(rootOutput.output_text, expected.finalCandidateText, label + ": root output must equal expected candidate.");
  } else {
    assert.equal(rootOutput.can_output_to_chat, false, label + ": failure output gate mismatch.");
    assert.equal(rootOutput.may_output_story_text, false, label + ": failure story output mismatch.");
    assert.equal(bridge.result.final_candidate_text, "", label + ": failed result must not expose candidate text.");
    assert.equal(bridge.result.final_candidate_hash, "", label + ": failed result must not expose candidate hash.");
    assert.equal(rootOutput.output_text.includes(bridge.result.failure_output_for_chat.failure_summary_for_chat), true, label + ": failure output missing summary.");
    assert.equal(rootOutput.output_text.includes(bridge.result.failure_output_for_chat.recommended_operator_action), true, label + ": failure output missing operator action.");
    assert.equal(rootOutput.output_text.includes(expected.forbiddenStoryText), false, label + ": failure output must not include story text.");
  }
}

function assertInvalidRootToolSurface() {
  const missing = buildChatgptFinalOutputToolSurface({});
  assert.equal(missing.used, true, "missing root surface: used mismatch.");
  assert.equal(missing.phase, "34R", "missing root surface: phase mismatch.");
  assert.equal(missing.contract_valid, false, "missing root surface should be invalid.");
  assert.equal(missing.response_kind, "tool_surface_contract_invalid_notice", "missing root surface response kind mismatch.");
  assert.equal(missing.can_emit_response_to_chat, true, "missing root surface can emit mismatch.");
  assert.equal(missing.can_output_to_chat, false, "missing root surface output gate mismatch.");
  assert.equal(missing.output_hash, sha256(missing.output_text), "missing root surface hash mismatch.");
  assert.equal(missing.validation_errors.includes("extracted_chatgpt_final_output_used_false_or_missing"), true, "missing root surface validation error missing.");
  assertNoFallback(missing, "missing root surface");
  assertOutputSafety(missing.safety, "missing root surface");

  const forbiddenStoryText = "這段正文候選不可以被 root invalid notice echo。";
  const invalid = buildChatgptFinalOutputToolSurface({
    extracted_chatgpt_final_output: {
      used: true,
      extraction_contract_valid: false,
      response_kind: "final_candidate_text",
      status: "invalid_story_surface",
      output_text: forbiddenStoryText,
      output_hash: "bad-hash",
      must_emit_exactly: true,
      no_extra_text: true,
      no_fallback: true,
    },
  });

  assert.equal(invalid.used, true, "invalid root surface: used mismatch.");
  assert.equal(invalid.contract_valid, false, "invalid root surface should be invalid.");
  assert.equal(invalid.response_kind, "tool_surface_contract_invalid_notice", "invalid root surface response kind mismatch.");
  assert.equal(invalid.output_text.includes(forbiddenStoryText), false, "invalid root surface must not echo story text.");
  assert.equal(invalid.validation_errors.includes("extracted_chatgpt_final_output_contract_invalid"), true, "invalid root surface contract error missing.");
  assert.equal(invalid.validation_errors.includes("output_hash_mismatch"), true, "invalid root surface hash error missing.");
  assertNoFallback(invalid, "invalid root surface");
  assertOutputSafety(invalid.safety, "invalid root surface");
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
  task_prompt: "Phase34R ChatGPT bridge final output tool surface contract.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34r_final_output_tool_surface_contract: true,
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
      version: "phase34r-test-ledger-v1",
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
          evidence_refs: ["phase34r-final-output-tool-surface"],
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
          evidence_refs: ["phase34r-final-output-tool-surface"],
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
        model_name: "deterministic-phase34r-final-output-tool-surface",
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
        model_name: "deterministic-phase34r-final-output-tool-surface",
        model_version: "accepted-after-revision-initial",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async () => ({
        text: revisedDraft,
        model_name: "deterministic-phase34r-final-output-tool-surface",
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

assertInvalidRootToolSurface();

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34r-"));

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
    assertRootFinalOutput(bridge, item.expected, "bridge " + item.label);
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34q = "tests/phase34/phase34q-chatgpt-bridge-final-output-live-extraction-contract.test.mjs";
  const phase34r = "tests/phase34/phase34r-chatgpt-bridge-final-output-tool-surface-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34q), "run-all missing Phase34Q predecessor.");
  assert(runAllText.includes(phase34r), "run-all missing Phase34R registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34q) < runAllText.indexOf(phase34r), "Phase34R should run after Phase34Q.");
  assert(runAllText.indexOf(phase34r) < runAllText.indexOf(daily), "Phase34R should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file), file + " protected hash changed.");
  }

  console.log("Phase34R ChatGPT bridge final output tool surface contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
