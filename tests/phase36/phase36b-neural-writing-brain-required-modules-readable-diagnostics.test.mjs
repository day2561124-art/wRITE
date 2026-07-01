import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  neuralWritingBrainRequiredModulesDiagnosticsVersion,
  buildNeuralWritingBrainRequiredModulesContract,
  buildNeuralWritingBrainRequiredModulesDiagnostics,
} from "../../server/src/neural-writing-brain-required-modules-contract-service.mjs";
import {
  runFullNeuralWritingPipelineSingleEntryBridge,
} from "../../server/src/full-neural-writing-pipeline-single-entry-bridge-service.mjs";
import {
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

const completeText = [
  "門禁燈第三次閃紅時，千夜沒有再往前衝。",
  "她把手從感應板上移開，反而蹲下去看地面。細小的靈力粉塵沿著門縫往內流，像有人在另一側緩慢吸氣。",
  "九逃壓低聲音問：「現在才發現不對？」",
  "「不是現在。」千夜說，「是它剛剛故意讓我們以為只有一道門。」",
  "終端地圖跳出新的灰色線段，退路沒有消失，卻被折成另一個方向。九逃的表情沉下去，因為那條線正通往舊訓練場。",
  "門內傳來敲擊聲。三下，停一下，再三下。",
  "那不是求救，是有人在替他們倒數。",
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
  task_prompt: "Phase36B readable diagnostics deterministic smoke.",
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
    version: "phase36b-test-ledger-v1",
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
        evidence_refs: ["phase36b-smoke"],
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
        evidence_refs: ["phase36b-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36b",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36b-"));

try {
  options.gptWritingContexts = path.join(tempRoot, "contexts");
  options.writingCandidates = path.join(tempRoot, "candidates");
  options.proofingContexts = path.join(tempRoot, "proofing");

  assert.equal(
    neuralWritingBrainRequiredModulesDiagnosticsVersion,
    "neural_writing_brain_required_modules_diagnostics_v1",
  );

  const standaloneInvalid = buildNeuralWritingBrainRequiredModulesContract({});
  assert.equal(standaloneInvalid.contract_valid, false);
  assert.equal(standaloneInvalid.operator_diagnostics.phase, "36B");
  assert.equal(standaloneInvalid.operator_diagnostics.contract_valid, false);
  assert.equal(standaloneInvalid.operator_diagnostics.blocked, true);
  assert.equal(standaloneInvalid.operator_diagnostics.blocked_module_count, 7);
  assert.equal(standaloneInvalid.operator_diagnostics.can_output_to_chat, false);
  assert.equal(standaloneInvalid.operator_diagnostics.may_output_story_text, false);
  assert.equal(
    standaloneInvalid.operator_diagnostics.summary_for_chat.includes("ChatGPT must not output story text"),
    true,
  );
  assert.equal(
    standaloneInvalid.operator_diagnostics.diagnostic_checklist_for_operator.includes("Do not output final_candidate_text."),
    true,
  );

  const rebuiltStandaloneDiagnostics =
    buildNeuralWritingBrainRequiredModulesDiagnostics(standaloneInvalid);
  assert.deepEqual(
    rebuiltStandaloneDiagnostics.blocked_module_diagnostics.map((item) => item.key),
    standaloneInvalid.operator_diagnostics.blocked_module_diagnostics.map((item) => item.key),
  );

  const validPreview = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, options);
  const validDiagnostics =
    validPreview.neural_writing_brain_required_modules_contract.operator_diagnostics;

  assert.equal(validPreview.can_output_to_chat, true);
  assert.equal(validPreview.final_response_for_chat.response_kind, "final_candidate_text");
  assert.equal(validDiagnostics.phase, "36B");
  assert.equal(validDiagnostics.contract_valid, true);
  assert.equal(validDiagnostics.blocked, false);
  assert.equal(validDiagnostics.blocked_module_count, 0);
  assert.deepEqual(validDiagnostics.blocked_module_diagnostics, []);
  assert.equal(validDiagnostics.can_emit_final_output, true);
  assert.equal(validDiagnostics.may_output_story_text, true);
  assert.equal(validDiagnostics.summary_for_chat.includes("diagnostics clear"), true);

  const blockedPreview = await runFullNeuralWritingPipelineSingleEntryBridge({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);

  const blockedContract =
    blockedPreview.neural_writing_brain_required_modules_contract;
  const blockedDiagnostics = blockedContract.operator_diagnostics;
  const blockedForeshadowing = blockedDiagnostics.blocked_module_diagnostics
    .find((item) => item.key === "foreshadowing_causality_graph");

  assert.equal(blockedContract.contract_valid, false);
  assert.equal(blockedDiagnostics.phase, "36B");
  assert.equal(blockedDiagnostics.contract_valid, false);
  assert.equal(blockedDiagnostics.blocked, true);
  assert.equal(blockedDiagnostics.can_output_to_chat, false);
  assert.equal(blockedDiagnostics.may_output_story_text, false);
  assert.equal(blockedDiagnostics.summary_for_chat.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedDiagnostics.summary_for_chat.includes("not_used"), true);
  assert.equal(blockedForeshadowing.key, "foreshadowing_causality_graph");
  assert.equal(blockedForeshadowing.label, "伏筆與因果圖");
  assert.equal(blockedForeshadowing.missing_reasons.includes("not_used"), true);
  assert.equal(blockedForeshadowing.missing_requirements.includes("used"), true);
  assert.equal(
    blockedForeshadowing.recommended_operator_action.includes("foreshadowing_causality_graph"),
    true,
  );

  assert.equal(blockedPreview.failure_output_for_chat.used, true);
  assert.equal(blockedPreview.failure_output_for_chat.operator_diagnostics.phase, "36B");
  assert.equal(blockedPreview.failure_output_for_chat.blocked_module_diagnostics.length > 0, true);
  assert.equal(
    blockedPreview.failure_output_for_chat.failure_summary_for_chat.includes("foreshadowing_causality_graph"),
    true,
  );
  assert.equal(
    blockedPreview.failure_output_for_chat.failure_summary_for_chat.includes("ChatGPT must not output story text"),
    true,
  );
  assert.equal(blockedPreview.final_response_for_chat.response_kind, "pipeline_failure_notice");
  assert.equal(blockedPreview.final_response_for_chat.body.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedPreview.final_response_for_chat.body.includes(completeText), false);
  assert.equal(blockedPreview.extracted_chatgpt_final_output.output_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(blockedPreview.extracted_chatgpt_final_output.output_text.includes(completeText), false);

  const bridgeBlocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);

  assert.equal(bridgeBlocked.ok, true);
  assert.equal(bridgeBlocked.result.neural_writing_brain_required_modules_contract.operator_diagnostics.phase, "36B");
  assert.equal(bridgeBlocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(bridgeBlocked.chatgpt_final_output.may_output_story_text, false);
  assert.equal(bridgeBlocked.chatgpt_final_output.output_text.includes("foreshadowing_causality_graph"), true);
  assert.equal(bridgeBlocked.chatgpt_final_output.output_text.includes("Do not output final_candidate_text"), true);
  assert.equal(bridgeBlocked.chatgpt_final_output.output_text.includes(completeText), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36a = "tests/phase36/phase36a-neural-writing-brain-required-modules-contract.test.mjs";
  const phase36b = "tests/phase36/phase36b-neural-writing-brain-required-modules-readable-diagnostics.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";

  assert(runAllText.includes(phase36a), "run-all missing Phase36A predecessor.");
  assert(runAllText.includes(phase36b), "run-all missing Phase36B registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase36a) < runAllText.indexOf(phase36b), "Phase36B should run after Phase36A.");
  assert(runAllText.indexOf(phase36b) < runAllText.indexOf(daily), "Phase36B should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36B neural writing brain required modules readable diagnostics tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
