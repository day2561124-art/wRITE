import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, readdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import {
  neuralWritingBrainRequiredModulesContractVersion,
  requiredNeuralWritingBrainModules,
  buildNeuralWritingBrainRequiredModulesContract,
} from "../../server/src/neural-writing-brain-required-modules-contract-service.mjs";
import {
  fullNeuralWritingPipelineSingleEntryBridgeVersion,
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
  task_prompt: "Phase36A required neural writing brain modules contract deterministic smoke.",
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

const protectedBefore = new Map();
for (const file of protectedFiles) {
  protectedBefore.set(file, hash(await readFile(file, "utf8")));
}

const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase36a-"));

const options = {
  gptWritingContexts: path.join(tempRoot, "contexts"),
  writingCandidates: path.join(tempRoot, "candidates"),
  proofingContexts: path.join(tempRoot, "proofing"),
  characterMindStateLedger: {
    version: "phase36a-test-ledger-v1",
    updated_at: "2026-07-01T00:00:00.000Z",
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
        evidence_refs: ["phase36a-smoke"],
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
        evidence_refs: ["phase36a-smoke"],
      },
    ],
  },
  generationAdapter: async () => ({
    text: completeText,
    model_name: "deterministic",
    model_version: "phase36a",
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

try {
  assert.equal(
    neuralWritingBrainRequiredModulesContractVersion,
    "neural_writing_brain_required_modules_contract_v1",
  );
  assert.deepEqual(requiredNeuralWritingBrainModules, [
    "one_click_writing_orchestrator",
    "recursive_self_rewrite_loop",
    "character_psychological_state_tracker",
    "dramatic_conflict_tension_manager",
    "reader_experience_simulator",
    "foreshadowing_causality_graph",
    "long_term_aesthetic_memory",
  ]);

  const standaloneInvalid = buildNeuralWritingBrainRequiredModulesContract({});
  assert.equal(standaloneInvalid.contract_valid, false);
  assert.equal(standaloneInvalid.required_brain_modules_count, 7);
  assert.equal(standaloneInvalid.can_emit_final_output, false);
  assert.equal(standaloneInvalid.all_required_brain_modules_loaded, false);
  assert.equal(standaloneInvalid.all_required_brain_modules_used, false);
  assert.equal(standaloneInvalid.all_required_brain_modules_have_evidence, false);
  assert.equal(standaloneInvalid.all_required_brain_modules_linked_to_final_candidate, false);
  assert.equal(standaloneInvalid.missing_required_brain_modules.length, 7);

  const preview = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, options);
  const contract = preview.neural_writing_brain_required_modules_contract;

  assert.equal(preview.ok, true);
  assert.equal(preview.phase, "34A");
  assert.equal(preview.version, fullNeuralWritingPipelineSingleEntryBridgeVersion);
  assert.equal(contract.used, true);
  assert.equal(contract.phase, "36A");
  assert.equal(contract.contract_valid, true);
  assert.deepEqual(contract.validation_errors, []);
  assert.equal(contract.required_brain_modules_count, 7);
  assert.equal(contract.all_required_brain_modules_loaded, true);
  assert.equal(contract.all_required_brain_modules_used, true);
  assert.equal(contract.all_required_brain_modules_have_evidence, true);
  assert.equal(contract.all_required_brain_modules_linked_to_final_candidate, true);
  assert.deepEqual(contract.missing_required_brain_modules, []);
  assert.equal(contract.can_emit_final_output, true);
  assert.equal(preview.can_output_to_chat, true);
  assert.equal(preview.final_response_for_chat.response_kind, "final_candidate_text");
  assert.equal(preview.final_response_handoff_for_chat.contract_valid, true);
  assert.equal(preview.extracted_chatgpt_final_output.extraction_contract_valid, true);
  assert.equal(preview.integrated_modules.neural_writing_brain_required_modules_contract, true);

  for (const entry of contract.required_brain_module_entries) {
    assert.equal(entry.contract_valid, true, entry.key + " should be valid.");
    assert.equal(entry.loaded, true, entry.key + " should be loaded.");
    assert.equal(entry.used, true, entry.key + " should be used.");
    assert.equal(entry.evidence, true, entry.key + " should have evidence.");
    assert.equal(entry.linked_to_final_candidate, true, entry.key + " should link to final candidate.");
    assert.match(entry.evidence_hash, /^[a-f0-9]{64}$/u);
  }

  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  assert.equal(bridge.ok, true);
  assert.equal(bridge.chatgpt_final_output.contract_valid, true);
  assert.equal(bridge.chatgpt_final_output.can_output_to_chat, true);
  assert.equal(bridge.chatgpt_final_output.may_output_story_text, true);
  assert.equal(bridge.chatgpt_final_output.output_text, completeText);
  assert.equal(
    bridge.result.neural_writing_brain_required_modules_contract.can_emit_final_output,
    true,
  );

  const missingForeshadowing = await runFullNeuralWritingPipelineSingleEntryBridge({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);

  const missingContract = missingForeshadowing.neural_writing_brain_required_modules_contract;
  assert.equal(missingContract.contract_valid, false);
  assert.equal(missingContract.can_emit_final_output, false);
  assert.equal(missingContract.all_required_brain_modules_used, false);
  assert.equal(
    missingContract.missing_required_brain_modules.includes("foreshadowing_causality_graph"),
    true,
  );
  assert.equal(missingForeshadowing.can_output_to_chat, false);
  assert.equal(
    missingForeshadowing.next_action,
    "inspect_neural_writing_brain_required_modules_contract",
  );
  assert.equal(missingForeshadowing.success_output_for_chat.used, false);
  assert.equal(missingForeshadowing.success_output_for_chat.reason, "required_brain_modules_contract_invalid");
  assert.equal(missingForeshadowing.failure_output_for_chat.used, true);
  assert.equal(
    missingForeshadowing.failure_output_for_chat.blocked_stage,
    "neural_writing_brain_required_modules_contract",
  );
  assert.equal(missingForeshadowing.final_response_for_chat.response_kind, "pipeline_failure_notice");
  assert.equal(missingForeshadowing.final_response_for_chat.may_output_story_text, false);
  assert.equal(missingForeshadowing.extracted_chatgpt_final_output.may_output_story_text, false);
  assert.equal(missingForeshadowing.extracted_chatgpt_final_output.can_output_to_chat, false);
  assert.equal(
    missingForeshadowing.extracted_chatgpt_final_output.output_text.includes("Neural writing brain required modules contract invalid."),
    true,
  );
  assert.equal(
    missingForeshadowing.extracted_chatgpt_final_output.output_text.includes(completeText),
    false,
  );

  const bridgeBlocked = await chatgpt_bridge_run_full_neural_writing_pipeline({
    ...baseInput,
    include_foreshadowing_causal_graph: false,
  }, options);

  assert.equal(bridgeBlocked.ok, true);
  assert.equal(bridgeBlocked.result.neural_writing_brain_required_modules_contract.contract_valid, false);
  assert.equal(bridgeBlocked.result.neural_writing_brain_required_modules_contract.can_emit_final_output, false);
  assert.equal(bridgeBlocked.chatgpt_final_output.contract_valid, true);
  assert.equal(bridgeBlocked.chatgpt_final_output.can_output_to_chat, false);
  assert.equal(bridgeBlocked.chatgpt_final_output.may_output_story_text, false);
  assert.equal(
    bridgeBlocked.chatgpt_final_output.output_text.includes("Neural writing brain required modules contract invalid."),
    true,
  );
  assert.equal(bridgeBlocked.chatgpt_final_output.output_text.includes(completeText), false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase36Path = "tests/phase36/phase36a-neural-writing-brain-required-modules-contract.test.mjs";
  assert(runAllText.includes(phase36Path), "run-all missing Phase36A registration.");
  assert(
    runAllText.indexOf("tests/phase35/phase35d-chatgpt-real-action-final-output-runtime-final-seal.test.mjs")
      < runAllText.indexOf(phase36Path),
    "Phase36A should run after Phase35D.",
  );
  assert(
    runAllText.indexOf(phase36Path)
      < runAllText.indexOf("tests/scripts/daily-scripts.test.mjs"),
    "Phase36A should run before Daily scripts and docs.",
  );

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase36A neural writing brain required modules contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}