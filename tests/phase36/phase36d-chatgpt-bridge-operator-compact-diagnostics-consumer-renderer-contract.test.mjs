import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  buildChatgptOperatorCompactDiagnosticsConsumerEmission,
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
  "DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36D",
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
  task_prompt: "Phase36D compact diagnostics consumer deterministic smoke.",
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
    version: "phase36d-test-ledger-v1",
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
        evidence_refs: ["phase36d-smoke"],
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
        evidence_refs: ["phase36d-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36d",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36d-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  const valid = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  const validCompact = valid.chatgpt_operator_compact_diagnostics;
  const validConsumer = valid.chatgpt_operator_compact_diagnostics_consumer;
  const validKeys = Object.keys(valid);

  assert.equal(valid.ok, true);
  assert.equal(valid.chatgpt_final_output.response_kind, "final_candidate_text");
  assert.equal(valid.chatgpt_final_output.output_text, completeText);

  assert.equal(validCompact.used, true);
  assert.equal(validCompact.phase, "36C");
  assert.equal(validCompact.blocked, false);
  assert.equal(validCompact.may_output_story_text, true);

  assert.equal(validConsumer.used, true);
  assert.equal(validConsumer.phase, "36D");
  assert.equal(
    validConsumer.surface_kind,
    "chatgpt_bridge_operator_compact_diagnostics_consumer_renderer_contract",
  );
  assert.equal(validConsumer.contract_valid, true);
  assert.equal(validConsumer.blocked, false);
  assert.equal(validConsumer.status, "operator_compact_diagnostics_consumer_clear");
  assert.equal(validConsumer.can_emit_operator_message, true);
  assert.equal(validConsumer.can_output_to_chat, false);
  assert.equal(validConsumer.may_output_story_text, false);
  assert.equal(validConsumer.operator_display_text, validCompact.compact_diagnostics_text);
  assert.equal(validConsumer.output_text, validCompact.compact_diagnostics_text);
  assert.equal(validConsumer.operator_display_text.includes("READY:"), true);
  assert.equal(validConsumer.operator_display_text.includes(completeText), false);
  assert.equal(validConsumer.root_output_hash, valid.chatgpt_final_output.output_hash);
  assert.equal(validConsumer.consumer_must_read_top_level_compact_diagnostics, true);
  assert.equal(validConsumer.consumer_must_not_read_result, true);
  assert.equal(validConsumer.consumer_must_not_read_nested_candidate_text, true);
  assert.equal(validConsumer.consumer_must_not_read_nested_brain_contract, true);
  assert.equal(validConsumer.consumer_must_not_replace_root_final_output, true);
  assert.equal(validConsumer.consumer_must_not_emit_compact_surface_as_story_text, true);
  assert.equal(validConsumer.root_final_output_still_required, true);
  assert.equal(validConsumer.root_final_output_must_remain_canonical, true);
  assert.equal(validConsumer.compact_consumer_is_reference_only, true);
  assert.equal(validConsumer.compact_consumer_must_not_replace_final_output, true);
  assert.equal(validConsumer.compact_consumer_must_not_be_emitted_as_story_text, true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics") < validKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer"), true);
  assert.equal(validKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer") < validKeys.indexOf("result"), true);

  const blocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);
  const blockedCompact = blocked.chatgpt_operator_compact_diagnostics;
  const blockedConsumer = blocked.chatgpt_operator_compact_diagnostics_consumer;
  const blockedKeys = Object.keys(blocked);

  assert.equal(blocked.ok, true);
  assert.equal(blocked.chatgpt_final_output.response_kind, "pipeline_failure_notice");
  assert.equal(blocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(blocked.chatgpt_final_output.may_output_story_text, false);
  assert.equal(blocked.chatgpt_final_output.output_text.includes(completeText), false);

  assert.equal(blockedCompact.used, true);
  assert.equal(blockedCompact.phase, "36C");
  assert.equal(blockedCompact.blocked, true);
  assert.equal(blockedCompact.may_output_story_text, false);
  assert.equal(blockedCompact.missing_modules.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedCompact.compact_diagnostics_text.includes("BLOCKED:"), true);

  assert.equal(blockedConsumer.used, true);
  assert.equal(blockedConsumer.phase, "36D");
  assert.equal(blockedConsumer.contract_valid, true);
  assert.equal(blockedConsumer.blocked, true);
  assert.equal(blockedConsumer.status, "operator_compact_diagnostics_consumer_blocked");
  assert.equal(blockedConsumer.response_kind, "operator_compact_diagnostics_blocked_renderer");
  assert.equal(blockedConsumer.can_output_to_chat, false);
  assert.equal(blockedConsumer.may_output_story_text, false);
  assert.equal(blockedConsumer.must_not_output_candidate, true);
  assert.equal(blockedConsumer.operator_display_text, blockedCompact.compact_diagnostics_text);
  assert.equal(blockedConsumer.output_text, blockedCompact.compact_diagnostics_text);
  assert.equal(blockedConsumer.operator_display_source, "chatgpt_operator_compact_diagnostics.compact_diagnostics_text");
  assert.equal(blockedConsumer.operator_display_text.includes("BLOCKED:"), true);
  assert.equal(blockedConsumer.operator_display_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedConsumer.operator_display_text.includes("Do not output final_candidate_text."), true);
  assert.equal(blockedConsumer.operator_display_text.includes(completeText), false);
  assert.equal(blockedConsumer.missing_modules.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedConsumer.blocked_checks.includes("foreshadowing_causality_graph:not_used"), true);
  assert.equal(blockedConsumer.operator_next_steps.includes("Do not output final_candidate_text."), true);
  assert.equal(blockedConsumer.consumer_must_read_top_level_compact_diagnostics, true);
  assert.equal(blockedConsumer.consumer_must_not_read_result, true);
  assert.equal(blockedConsumer.consumer_must_not_read_nested_candidate_text, true);
  assert.equal(blockedConsumer.consumer_must_not_read_nested_brain_contract, true);
  assert.equal(blockedConsumer.consumer_must_not_recompose_from_result, true);
  assert.equal(blockedConsumer.consumer_must_not_replace_root_final_output, true);
  assert.equal(blockedConsumer.root_final_output_still_required, true);
  assert.equal(blockedConsumer.compact_consumer_must_not_be_emitted_as_story_text, true);
  assert.equal(blockedConsumer.forbidden_sources.includes("tool_response.result.final_candidate_text"), true);
  assert.equal(blockedConsumer.forbidden_sources.includes("tool_response.result.extracted_chatgpt_final_output"), true);
  assert.equal(blockedKeys.indexOf("chatgpt_operator_compact_diagnostics") < blockedKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer"), true);
  assert.equal(blockedKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer") < blockedKeys.indexOf("result"), true);

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

  const decoyConsumer = buildChatgptOperatorCompactDiagnosticsConsumerEmission(decoy);
  assert.equal(decoyConsumer.contract_valid, true);
  assert.equal(decoyConsumer.output_text, blockedConsumer.output_text);
  assert.equal(decoyConsumer.operator_display_text, blockedConsumer.operator_display_text);
  assert.equal(decoyConsumer.output_text.includes("DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36D"), false);
  assert.equal(decoyConsumer.operator_display_text.includes("DECOY_NESTED_RESULT_TEXT_MUST_NOT_BE_READ_BY_PHASE36D"), false);

  const invalid = buildChatgptOperatorCompactDiagnosticsConsumerEmission({
    ok: true,
    tool_name: "chatgpt_bridge_run_full_neural_writing_pipeline",
    permission: "write_low_risk",
    chatgpt_final_output: blocked.chatgpt_final_output,
    result: blocked.result,
  });
  assert.equal(invalid.contract_valid, false);
  assert.equal(invalid.validation_errors.includes("top_level_compact_diagnostics_missing"), true);
  assert.equal(invalid.validation_errors.includes("compact_diagnostics_used_false_or_missing"), true);
  assert.equal(invalid.can_output_to_chat, false);
  assert.equal(invalid.may_output_story_text, false);
  assert.equal(invalid.output_text.includes("consumer contract invalid"), true);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36c = "tests/phase36/phase36c-chatgpt-bridge-operator-compact-diagnostics-surface.test.mjs";
  const phase36d = "tests/phase36/phase36d-chatgpt-bridge-operator-compact-diagnostics-consumer-renderer-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36c), "run-all missing Phase36C predecessor.");
  assert(runAllText.includes(phase36d), "run-all missing Phase36D registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36c) < runAllText.indexOf(phase36d), "Phase36D should run after Phase36C.");
  assert(runAllText.indexOf(phase36d) < runAllText.indexOf(daily), "Phase36D should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36D ChatGPT bridge operator compact diagnostics consumer renderer contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
