import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptOperatorCompactDiagnosticsFinalClosureIndex,
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

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const completeText = [
  "門禁燈第三次閃紅時，千夜沒有再往前衝。",
  "她把手從感應板上移開，反而蹲下去看地面。細小的靈力粉塵沿著門縫往內流，像有人在另一側緩慢吸氣。",
  "九逃壓低聲音問：「現在才發現不對？」",
  "「不是現在。」千夜說，「是它剛剛故意讓我們以為只有一道門。」",
  "終端地圖跳出新的灰色線段，退路沒有消失，卻被折成另一個方向。九逃的表情沉下去，因為那條線正通往舊訓練場。",
  "門內傳來敲擊聲。三下，停一下，再三下。",
  "那不是求救，是有人在替他們倒數。",
].join("\n\n");

const decoyText = [
  completeText,
  "DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36E",
].join("\n\n");

const conflictPlan = {
  protagonist: "千夜",
  protagonist_want: "判斷門禁陷阱真正的路線",
  opposition: "被偽裝成普通門禁的折返陷阱",
  opposition_pressure: "門禁燈倒數、退路被折向舊訓練場",
  stakes: "走錯會把主角群送進預設伏擊點",
  reversal_or_reveal: "門不是封閉退路，而是在折疊退路方向",
  required_choice: "千夜必須停下來觀察而不是立刻硬闖",
  cost_or_payment: "拖延讓門內的人先一步知道他們的位置",
  new_status_quo: "隊伍被迫承認敵人能預判他們的路線",
  ending_hook: "門內敲擊聲變成倒數",
};

const baseInput = {
  task_prompt: "Phase36E compact diagnostics final closure deterministic smoke.",
  generation_context: {
    scene: "red door access light",
    chapter_turn: "door route is folded toward old training ground",
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
  },
  character_names: ["千夜", "九逃"],
  reader_response_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道倒數節奏？"],
  aesthetic_memory_context: {
    principles: [
      "一章一變局。",
      "普通行動先直寫。",
      "結尾必須留下事件鉤子，不靠漂亮句子收尾。",
    ],
  },
};

const options = {
  characterMindStateLedger: {
    version: "phase36e-test-ledger-v1",
    updated_at: "2026-07-02T00:00:00.000Z",
    characters: [
      {
        character_name: "千夜",
        current_emotion: "警戒但冷靜",
        body_state: "蹲下觀察門縫靈力粉塵",
        unspoken_pressure: "不想讓隊伍被門禁陷阱牽著走",
        recent_event_traces: ["門禁燈第三次閃紅"],
        relationship_attitudes: {
          "九逃": "信任對方會立刻跟上自己的判斷",
        },
        visible_reactions_allowed: ["停步", "蹲下", "壓低聲音說明觀察結果"],
        hidden_reactions_reserved: ["對門內倒數聲感到不安"],
        continuity_constraints: ["不得把門禁陷阱當作普通行政流程處理"],
        evidence_refs: ["phase36e-smoke"],
      },
      {
        character_name: "九逃",
        current_emotion: "焦躁且戒備",
        body_state: "壓低聲音、注意退路",
        unspoken_pressure: "擔心千夜判斷太晚但仍選擇配合",
        recent_event_traces: ["退路被折向舊訓練場"],
        relationship_attitudes: {
          "千夜": "嘴上質疑但行動上配合",
        },
        visible_reactions_allowed: ["壓低聲音吐槽", "觀察終端地圖"],
        hidden_reactions_reserved: ["意識到敵人可能預判路線"],
        continuity_constraints: ["吐槽不能蓋過危機判斷"],
        evidence_refs: ["phase36e-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36e",
  }),
  finalPolisherAdapter: async ({ raw_draft_text }) => ({
    status: "completed",
    polished_text: raw_draft_text,
    needs_structural_revision: false,
    suggested_return_stage: null,
    revision_report: {
      structural_gate: {
        accepted: true,
        reasons: [],
      },
      risk_flags: [],
    },
    warnings: [],
  }),
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));

const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36e-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const validCompact = valid.chatgpt_operator_compact_diagnostics;
  const validConsumer = valid.chatgpt_operator_compact_diagnostics_consumer;
  const validClosure = valid.chatgpt_operator_compact_diagnostics_final_closure_index;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);

  assert.equal(validCompact.phase, "36C");
  assert.equal(validCompact.blocked, false);
  assert.equal(validConsumer.phase, "36D");
  assert.equal(validConsumer.contract_valid, true);
  assert.equal(validConsumer.blocked, false);

  assert.equal(validClosure.used, true);
  assert.equal(validClosure.phase, "36E");
  assert.equal(validClosure.surface_kind, "chatgpt_bridge_operator_compact_diagnostics_final_closure_index");
  assert.equal(validClosure.contract_valid, true);
  assert.deepEqual(validClosure.validation_errors, []);
  assert.equal(validClosure.status, "operator_compact_diagnostics_final_closure_clear_ready");
  assert.equal(validClosure.response_kind, "operator_compact_diagnostics_final_closure_index");
  assert.equal(validClosure.phase_range, "36A-36E");
  assert.equal(validClosure.phase_dependency_chain_complete, true);
  assert.equal(validClosure.closure_entry_count, 5);
  assert.deepEqual(validClosure.required_phase_order, ["36A", "36B", "36C", "36D", "36E"]);
  assert.equal(validClosure.closure_entries.some((entry) => entry.phase === "36A"), true);
  assert.equal(validClosure.closure_entries.some((entry) => entry.phase === "36B"), true);
  assert.equal(validClosure.closure_entries.some((entry) => entry.phase === "36C"), true);
  assert.equal(validClosure.closure_entries.some((entry) => entry.phase === "36D"), true);
  assert.equal(validClosure.closure_entries.some((entry) => entry.phase === "36E"), true);
  assert.equal(validClosure.blocked, false);
  assert.equal(validClosure.operator_readiness_status, "compact_diagnostics_chain_clear");
  assert.equal(validClosure.can_emit_operator_message, false);
  assert.equal(validClosure.can_output_to_chat, false);
  assert.equal(validClosure.may_output_story_text, false);
  assert.equal(validClosure.must_not_output_candidate, true);
  assert.equal(validClosure.root_output_hash, valid.chatgpt_final_output.output_hash);
  assert.equal(validClosure.compact_surface_hash, validCompact.compact_diagnostics_hash);
  assert.equal(validClosure.consumer_surface_hash, validConsumer.operator_display_hash);
  assert.equal(validClosure.final_closure_is_reference_only, true);
  assert.equal(validClosure.final_closure_adds_output_layer, false);
  assert.equal(validClosure.final_closure_must_not_replace_final_output, true);
  assert.equal(validClosure.final_closure_must_not_be_emitted_as_chat_output, true);
  assert.equal(validClosure.final_closure_must_not_be_emitted_as_story_text, true);
  assert.equal(validClosure.final_closure_requires_root_final_output, true);
  assert.equal(validClosure.final_closure_root_final_output_must_remain_canonical, true);
  assert.equal(validClosure.final_closure_requires_top_level_compact_surface, true);
  assert.equal(validClosure.final_closure_requires_top_level_consumer_surface, true);
  assert.equal(validClosure.final_closure_requires_no_result_read, true);
  assert.equal(validClosure.final_closure_requires_no_nested_candidate_read, true);
  assert.equal(validClosure.final_closure_requires_no_nested_brain_contract_read, true);
  assert.equal(validClosure.final_closure_requires_no_recomposition, true);
  assert.equal(validClosure.must_not_emit_final_closure_index, true);
  assert.equal(validClosure.must_not_emit_compact_consumer_surface, true);
  assert.equal(validClosure.must_not_emit_compact_surface_as_story_text, true);
  assert.equal(validClosure.must_not_emit_result_surface, true);
  assert.equal(validClosure.must_not_read_result, true);
  assert.equal(validClosure.must_not_read_nested_result_candidate_text, true);
  assert.equal(validClosure.must_not_read_nested_brain_contract, true);
  assert.equal(validClosure.must_not_recompose_response, true);
  assert.equal(validClosure.no_new_output_layer, true);
  assert.equal(validClosure.may_read_tool_response_result, false);
  assert.equal(validClosure.may_update_canon, false);
  assert.equal(validClosure.may_update_active_engine, false);
  assert.equal(Object.hasOwn(validClosure, "output_text"), false);
  assert.equal(Object.hasOwn(validClosure, "operator_display_text"), false);
  assert.equal(validClosure.forbidden_sources.includes("tool_response.result.final_candidate_text"), true);
  assert.equal(validClosure.forbidden_sources.includes("tool_response.result.neural_writing_brain_required_modules_contract"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index") < validKeys.indexOf("result"), true);

  const blocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);
  const blockedCompact = blocked.chatgpt_operator_compact_diagnostics;
  const blockedConsumer = blocked.chatgpt_operator_compact_diagnostics_consumer;
  const blockedClosure = blocked.chatgpt_operator_compact_diagnostics_final_closure_index;
  const blockedKeys = Object.keys(blocked);

  assert.equal(blocked.ok, true);
  assert.equal(blocked.chatgpt_final_output.response_kind, "pipeline_failure_notice");
  assert.equal(blocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(blocked.chatgpt_final_output.may_output_story_text, false);
  assert.equal(blocked.chatgpt_final_output.output_text.includes(completeText), false);

  assert.equal(blockedCompact.phase, "36C");
  assert.equal(blockedCompact.blocked, true);
  assert.equal(blockedCompact.missing_modules.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedConsumer.phase, "36D");
  assert.equal(blockedConsumer.contract_valid, true);
  assert.equal(blockedConsumer.blocked, true);

  assert.equal(blockedClosure.used, true);
  assert.equal(blockedClosure.phase, "36E");
  assert.equal(blockedClosure.contract_valid, true);
  assert.deepEqual(blockedClosure.validation_errors, []);
  assert.equal(blockedClosure.status, "operator_compact_diagnostics_final_closure_blocked_ready");
  assert.equal(blockedClosure.blocked, true);
  assert.equal(blockedClosure.blocked_reason, "required_brain_modules_contract_invalid");
  assert.equal(blockedClosure.operator_readiness_status, "blocked_reason_readable_from_top_level_compact_diagnostics");
  assert.equal(blockedClosure.can_emit_operator_message, false);
  assert.equal(blockedClosure.can_output_to_chat, false);
  assert.equal(blockedClosure.may_output_story_text, false);
  assert.equal(blockedClosure.must_not_output_candidate, true);
  assert.equal(blockedClosure.must_not_output_candidate_reason, "required_brain_modules_contract_invalid");
  assert.equal(blockedClosure.compact_surface_blocked, true);
  assert.equal(blockedClosure.consumer_surface_blocked, true);
  assert.equal(blockedClosure.compact_surface_may_output_story_text, false);
  assert.equal(blockedClosure.consumer_surface_may_output_story_text, false);
  assert.equal(blockedClosure.root_output_hash, blocked.chatgpt_final_output.output_hash);
  assert.equal(blockedClosure.compact_surface_hash, blockedCompact.compact_diagnostics_hash);
  assert.equal(blockedClosure.consumer_surface_hash, blockedConsumer.operator_display_hash);
  assert.equal(blockedClosure.final_closure_is_reference_only, true);
  assert.equal(blockedClosure.final_closure_requires_no_result_read, true);
  assert.equal(blockedClosure.final_closure_requires_no_nested_candidate_read, true);
  assert.equal(blockedClosure.final_closure_requires_no_nested_brain_contract_read, true);
  assert.equal(blockedClosure.must_not_read_result, true);
  assert.equal(blockedClosure.must_not_read_nested_result_candidate_text, true);
  assert.equal(blockedClosure.must_not_read_nested_brain_contract, true);
  assert.equal(Object.hasOwn(blockedClosure, "output_text"), false);
  assert.equal(Object.hasOwn(blockedClosure, "operator_display_text"), false);
  assert.equal(blockedKeys.indexOf("chatgpt_operator_compact_diagnostics") < blockedKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer"), true);
  assert.equal(blockedKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer") < blockedKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index"), true);
  assert.equal(blockedKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index") < blockedKeys.indexOf("result"), true);

  const decoy = clone(blocked);
  decoy.result.final_candidate_text = decoyText;
  decoy.result.success_output_for_chat = {
    used: true,
    output_text: decoyText,
    output_hash: hash(decoyText),
  };
  decoy.result.failure_output_for_chat = {
    used: true,
    output_text: decoyText,
    output_hash: hash(decoyText),
  };
  decoy.result.extracted_chatgpt_final_output.output_text = decoyText;
  decoy.result.extracted_chatgpt_final_output.output_hash = hash(decoyText);

  const decoyClosure = buildChatgptOperatorCompactDiagnosticsFinalClosureIndex(decoy);
  assert.equal(decoyClosure.contract_valid, true);
  assert.equal(decoyClosure.blocked, true);
  assert.equal(decoyClosure.root_output_hash, blockedClosure.root_output_hash);
  assert.equal(decoyClosure.compact_surface_hash, blockedClosure.compact_surface_hash);
  assert.equal(decoyClosure.consumer_surface_hash, blockedClosure.consumer_surface_hash);
  assert.equal(JSON.stringify(decoyClosure).includes("DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36E"), false);

  const invalid = buildChatgptOperatorCompactDiagnosticsFinalClosureIndex({
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
    chatgpt_final_output: blocked.chatgpt_final_output,
    chatgpt_operator_compact_diagnostics: blocked.chatgpt_operator_compact_diagnostics,
    result: blocked.result,
  });

  assert.equal(invalid.contract_valid, false);
  assert.equal(invalid.validation_errors.includes("top_level_compact_diagnostics_consumer_missing"), true);
  assert.equal(invalid.validation_errors.includes("compact_consumer_used_false_or_missing"), true);
  assert.equal(invalid.status, "operator_compact_diagnostics_final_closure_invalid");
  assert.equal(invalid.can_output_to_chat, false);
  assert.equal(invalid.may_output_story_text, false);
  assert.equal(invalid.final_closure_is_reference_only, true);
  assert.equal(Object.hasOwn(invalid, "output_text"), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36d = "tests/phase36/phase36d-chatgpt-bridge-operator-compact-diagnostics-consumer-renderer-contract.test.mjs";
  const phase36e = "tests/phase36/phase36e-chatgpt-bridge-operator-compact-diagnostics-final-closure-index.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36d), "run-all missing Phase36D predecessor.");
  assert(runAllText.includes(phase36e), "run-all missing Phase36E registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36d) < runAllText.indexOf(phase36e), "Phase36E should run after Phase36D.");
  assert(runAllText.indexOf(phase36e) < runAllText.indexOf(daily), "Phase36E should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36E ChatGPT bridge operator compact diagnostics final closure index tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
