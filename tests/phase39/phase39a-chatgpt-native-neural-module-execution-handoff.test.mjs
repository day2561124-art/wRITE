import assert from "node:assert/strict";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildChatgptNativeNeuralWritingHandoff } from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const taskPrompt = "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。";
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

async function names(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewEntries(dirPath, before) {
  for (const name of await names(dirPath)) {
    if (!before.has(name)) {
      await rm(path.join(dirPath, name), { recursive: true, force: true });
    }
  }
}

function fakeContextBundle() {
  return {
    bundle_id: "phase39a-native-neural-execution-context",
    task_prompt: taskPrompt,
    output_mode: "chat_only",
    neural_pipeline_required: true,
    required_neural_modules: [
      "run_scene_planner",
      "run_character_simulator",
      "run_neural_critic",
      "run_style_drift_detector",
      "run_over_governance_detector",
    ],
    engine_components_status: {
      components: {
        neural_pipeline: {
          required: true,
          modules: [
            { name: "run_scene_planner", required_status: "available" },
            { name: "run_character_simulator", required_status: "available" },
            { name: "run_neural_critic", required_status: "available" },
            { name: "run_style_drift_detector", required_status: "available" },
            { name: "run_over_governance_detector", required_status: "available" },
          ],
        },
      },
    },
    active_engine_excerpt_or_reference: {
      text: "active_engine reference only: preserve canon and do not update active_engine.",
    },
    writing_card_excerpt_or_reference: {
      text: "正文需自然承接群像、避免工程語氣、避免公告式整理。",
    },
    proofing_card_excerpt_or_reference: {
      text: "不得輸出工程說明；只輸出正文時需從章名開始。",
    },
    longline_excerpt_or_reference: {
      text: "長線承接：以角色、事件、壓力與具體行動推進。",
    },
    retrieval_context: {
      text: "Phase39A validates ChatGPT-native neural module execution handoff.",
    },
    generation_context: {
      text: "ChatGPT is the final prose generator after neural execution handoff.",
    },
    aesthetic_memory_context: {
      text: "避免行政流程感與工程說明；保持小說正文感。",
    },
    character_state_context: {
      text: "群像角色依場景位置、資訊差與壓力自然反應。",
    },
    foreshadowing_context: {
      text: "門、門縫、折門壓力仍在背景推進。",
    },
    reader_simulator_context: {
      text: "維持高密度章節推進與一章一變局。",
    },
  };
}

const neuralAdapters = {
  scene_planner: async () => ({
    summary: "scene plan created for ChatGPT-native handoff",
    beats: ["chapter title", "opening pressure", "scene turn"],
  }),
  character_simulator: async () => ({
    summary: "character simulation created",
    focus: ["千夜", "九逃", "群像反應"],
  }),
  neural_critic: async () => ({
    summary: "critic notes created",
    cautions: ["avoid engineering prose", "preserve causality"],
  }),
  style_drift_detector: async () => ({
    summary: "style drift check created",
    drift_risk: "low",
  }),
  over_governance_detector: async () => ({
    summary: "over-governance check created",
    warning: "do not write checklist prose into story",
  }),
  writing_card_director: async () => ({
    summary: "writing card director guidance created",
    guidance: "write vivid story prose directly",
  }),
  final_polisher: async () => ({
    summary: "editorial brain pre-handoff guidance created",
    guidance: "final polish belongs to ChatGPT-native prose response",
  }),
};

const agentRunsBefore = await names(projectPaths.agentRuns);
const tracesBefore = await names(projectPaths.neuralTraces);
const transactionsBefore = await names(transactionDir);

try {
  const result = await buildChatgptNativeNeuralWritingHandoff({
    task_prompt: taskPrompt,
    generation_context: {
      phase: "39A",
      route_expectation: "chatgpt_native_neural_module_execution_handoff",
    },
    retrieval_context: {
      acceptance_smoke: "phase39a",
    },
    chapter_mode: "next_chapter",
    output_mode: "chatgpt_native_handoff",
    max_context_chars: 48000,
  }, {
    buildGptWritingContextFn: async () => fakeContextBundle(),
    chatgptNativeNeuralAdapters: neuralAdapters,
  });

  assert.equal(result.tool_name, "chatgpt_bridge_build_full_neural_writing_handoff");
  assert.equal(result.status, "ready_for_chatgpt_native_generation");
  assert.equal(result.output_mode, "chatgpt_native_handoff");
  assert.equal(result.candidate_created, false);
  assert.equal(result.candidate_id, null);
  assert.equal(result.canon_updated, false);
  assert.equal(result.active_engine_updated, false);
  assert.equal(result.adopted, false);
  assert.equal(result.settled, false);

  const handoff = result.chatgpt_native_writing_handoff;
  assert.equal(handoff.used, true);
  assert.equal(handoff.contract_valid, true);
  assert.equal(handoff.surface_kind, "chatgpt_native_full_neural_writing_handoff");
  assert.match(handoff.final_chatgpt_writing_instruction, /neural_module_execution_results/u);
  assert.match(handoff.final_chatgpt_writing_instruction, /neural_trace_summary/u);
  assert.match(handoff.final_chatgpt_writing_instruction, /直接依使用者任務輸出正文/u);

  assert.equal(handoff.constraints.tool_must_not_generate_story_text, true);
  assert.equal(handoff.constraints.chatgpt_must_generate_after_handoff, true);
  assert.equal(handoff.constraints.save_candidate, false);
  assert.equal(handoff.constraints.canon_update_allowed, false);
  assert.equal(handoff.constraints.active_engine_update_allowed, false);
  assert.equal(handoff.constraints.backend_provider_required, false);

  const diagnostics = handoff.neural_modules_diagnostics;
  assert.equal(diagnostics.required_modules_checked, true);
  assert.equal(diagnostics.required_modules_executed, true);
  assert.equal(diagnostics.chatgpt_native_neural_modules_executed, true);
  assert.equal(diagnostics.module_results_attached_to_handoff, true);
  assert.equal(diagnostics.neural_trace_created, true);

  assert.equal(handoff.chatgpt_native_neural_modules_executed, true);
  assert.equal(handoff.module_results_attached_to_handoff, true);
  assert.equal(handoff.neural_trace_created, true);

  const moduleResults = handoff.neural_module_execution_results;
  assert(Array.isArray(moduleResults));
  assert.equal(moduleResults.length, 7);

  const expectedModules = [
    "run_scene_planner",
    "run_character_simulator",
    "run_neural_critic",
    "run_style_drift_detector",
    "run_over_governance_detector",
    "run_writing_card_director",
    "run_final_polisher",
  ];

  assert.deepEqual(moduleResults.map((item) => item.module_name), expectedModules);

  for (const moduleResult of moduleResults) {
    assert.equal(moduleResult.status, "success");
    assert.equal(typeof moduleResult.module_name, "string");
    assert.equal(moduleResult.input_hash.length, 64);
    assert.equal(moduleResult.output_hash.length, 64);
    assert.match(moduleResult.trace_id, /^neural_trace_\d{8}-\d{6}-[a-f0-9]{8}$/u);
    assert.equal(typeof moduleResult.called_at, "string");
    assert.equal(typeof moduleResult.result_summary, "string");
    assert(moduleResult.result_summary.length > 0);
    assert.equal(typeof moduleResult.result_excerpt, "string");
    assert(moduleResult.result_excerpt.length > 0);
  }

  const traceSummary = handoff.neural_trace_summary;
  assert.match(traceSummary.run_id, /^agent_run_\d{8}-\d{6}-[a-f0-9]{8}$/u);
  assert.equal(traceSummary.trace_count, 7);
  assert.equal(traceSummary.success_count, 7);
  assert.equal(traceSummary.failed_count, 0);
  assert.equal(traceSummary.skipped_count, 0);
  assert.equal(traceSummary.used_neural_network, true);
  assert.deepEqual(traceSummary.required_neural_modules, expectedModules);
  assert.deepEqual(traceSummary.missing_required_neural_modules, []);
  assert.equal(traceSummary.traces.length, 7);

  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "chatgpt_final_output",
    "extracted_chatgpt_final_output",
    "final_response_handoff_for_chat",
    "generation_provider_required",
  ]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  }

  assert.equal(serialized.includes("final_candidate_text"), false);
  assert.equal(serialized.includes("polished_text"), false);
  assert.equal(serialized.includes("candidate_save_later"), false);

  console.log("Phase39A ChatGPT native neural module execution handoff tests passed.");
} finally {
  await removeNewEntries(projectPaths.agentRuns, agentRunsBefore);
  await removeNewEntries(projectPaths.neuralTraces, tracesBefore);
  await removeNewEntries(transactionDir, transactionsBefore);
}
