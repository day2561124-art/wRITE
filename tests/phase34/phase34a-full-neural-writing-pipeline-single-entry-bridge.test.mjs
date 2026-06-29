import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
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
  "走廊的門禁燈第二次閃紅時，千夜把手按在感應板上。",
  "九逃叫她等，聲音壓得很低，不是命令，是他已經看見退路會被鎖死。",
  "她沒有回頭，只把終端轉給他看。地圖上的舊路線正在一格一格熄滅，像有人從背後把橋抽走。",
  "「現在不進去，下一道門就會關。」千夜說。",
  "「進去的話，我們也回不來。」九逃回她。",
  "選擇在那一秒變成代價。門開了，舊路徑從終端上消失，九逃罵了一聲，還是跟著她跨進去。",
  "門在身後合上時，裡面有人先一步喊出了千夜的名字。",
].join("\n\n");

const blockedText = "這一章正式設定為千夜新增能力為絕對支配。故事結束。";

const conflictPlan = {
  protagonist: "千夜",
  protagonist_want: "在門禁鎖死前進入下一條路線",
  opposition: "九逃與即將封閉的門禁系統",
  opposition_pressure: "九逃想阻止她，門禁系統會關閉退路",
  stakes: "等待會失去前進路線，進入會失去退路",
  reversal_or_reveal: "開門不是安全，而是刪除舊退路",
  required_choice: "千夜必須在等待支援與強行進入之間選擇",
  cost_or_payment: "舊路徑從終端上消失",
  new_status_quo: "隊伍被迫進入不能回頭的新戰場",
  ending_hook: "門內有人先一步喊出千夜的名字",
};

const baseInput = {
  task_prompt: "Phase34A single entry bridge deterministic writing smoke.",
  generation_context: {
    scene: "night corridor",
    chapter_turn: "door entry deletes the old route",
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
  },
  character_names: ["千夜", "九逃"],
  reader_response_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
  aesthetic_memory_context: {
    principles: [
      "一章一變局。",
      "普通行動先直寫，幽默只能加味。",
      "角色對話不能公告式交接。",
    ],
  },
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34a-"));

const options = {
  gptWritingContexts: path.join(tempRoot, "contexts"),
  writingCandidates: path.join(tempRoot, "candidates"),
  proofingContexts: path.join(tempRoot, "proofing"),
};

try {
  assert.equal(
    fullNeuralWritingPipelineSingleEntryBridgeVersion,
    "full_neural_writing_pipeline_single_entry_bridge_v1",
  );

  const missingProvider = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, options);
  assert.equal(missingProvider.status, "failed");
  assert.equal(missingProvider.stop_reason, "generation_provider_required");
  assert.equal(missingProvider.candidate_created, false);
  assert.equal(missingProvider.proofing_context.built, false);
  assert.equal(missingProvider.safety.active_engine_update_allowed, false);
  assert.equal(missingProvider.safety.canon_update_allowed, false);

  const preview = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, {
    ...options,
    generationAdapter: async () => ({
      text: completeText,
      model_name: "deterministic",
      model_version: "phase34a",
    }),
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.phase, "34A");
  assert.equal(preview.single_entry_bridge, true);
  assert.equal(preview.status, "completed");
  assert.equal(preview.candidate_created, false);
  assert.equal(preview.proofing_context.built, false);
  assert.equal(preview.reader_response_simulator.used, true);
  assert.equal(preview.reader_response_simulator.phase, "29A");
  assert.equal(preview.aesthetic_memory_context.used, true);
  assert.equal(preview.integrated_modules.full_recursive_writing_pipeline, true);
  assert.equal(preview.integrated_modules.reader_response_simulator, true);
  assert.equal(preview.integrated_modules.aesthetic_memory_context, true);
  assert.equal(preview.can_output_to_chat, true);
  assert.equal(preview.next_action, "output_final_candidate_text_to_chat");
  assert.match(preview.workflow.deterministic_digest, /^sha256:[a-f0-9]{64}$/u);
  assert(preview.final_candidate_text.length > 0, "preview final candidate text should not be empty.");
  assert(preview.final_candidate_text.includes("千夜"), "preview final candidate should preserve 千夜.");
  assert(preview.final_candidate_text.includes("九逃"), "preview final candidate should preserve 九逃.");
  assert(preview.final_candidate_text.includes("門"), "preview final candidate should preserve the door scene object.");

  const savedWithProofing = await runFullNeuralWritingPipelineSingleEntryBridge({
    ...baseInput,
    save_candidate: true,
    build_proofing_context: true,
  }, {
    ...options,
    generationAdapter: async () => ({
      text: completeText,
      model_name: "deterministic",
      model_version: "phase34a",
    }),
  });

  assert.equal(savedWithProofing.status, "completed");
  assert.equal(savedWithProofing.candidate_created, true);
  assert.match(savedWithProofing.candidate_id, /^writing_candidate_\d{8}-\d{6}-[a-f0-9]{8}$/u);
  assert.equal(savedWithProofing.proofing_context.built, true);
  assert.match(savedWithProofing.proofing_context.proofing_context_id, /^proofctx_\d{8}-\d{6}-[a-f0-9]{8}$/u);
  assert.equal(savedWithProofing.proofing_context.active_engine_update_allowed, false);
  assert.equal(savedWithProofing.proofing_context.canon_update_allowed, false);
  assert.equal(savedWithProofing.next_action, "review_proofing_context");

  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({
      text: completeText,
      model_name: "deterministic",
      model_version: "phase34a",
    }),
  });

  assert.equal(bridge.ok, true);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(bridge.permission, "write_low_risk");
  assert.equal(bridge.result.phase, "34A");
  assert.equal(bridge.result.single_entry_bridge, true);
  assert.equal(bridge.result.can_output_to_chat, true);
  assert.equal(bridge.full_neural_orchestrator_used, true);
  assert.equal(
    bridge.full_neural_orchestration_summary.orchestrator_version,
    "full_neural_writing_pipeline_single_entry_bridge_v1",
  );

  const failedRevision = await runFullNeuralWritingPipelineSingleEntryBridge({
    ...baseInput,
    max_revision_rounds: 1,
  }, {
    ...options,
    generationAdapter: async () => ({ text: blockedText }),
    revisionAdapter: async () => ({ text: blockedText }),
  });

  assert.equal(failedRevision.status, "failed");
  assert.equal(failedRevision.single_entry_complete, false);
  assert.equal(failedRevision.stop_reason, "max_revision_rounds_exhausted");
  assert.equal(failedRevision.final_candidate_text, "");
  assert.equal(failedRevision.candidate_created, false);
  assert.equal(failedRevision.next_action, "review_revision_failure");

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  assert(
    runAllText.includes("tests/phase34/phase34a-full-neural-writing-pipeline-single-entry-bridge.test.mjs"),
    "run-all missing Phase34A registration.",
  );
  assert(
    runAllText.indexOf("tests/phase34/phase34a-full-neural-writing-pipeline-single-entry-bridge.test.mjs")
      < runAllText.indexOf("tests/scripts/daily-scripts.test.mjs"),
    "Phase34A should run before Daily scripts and docs.",
  );

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34A full neural writing pipeline single entry bridge tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}