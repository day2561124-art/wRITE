import assert from "node:assert/strict";
import { runFullNeuralWritingPipelineSingleEntryBridge } from "../../server/src/full-neural-writing-pipeline-single-entry-bridge-service.mjs";

const result = await runFullNeuralWritingPipelineSingleEntryBridge({
  task_prompt: "Phase38E aesthetic memory context readiness: produce a deterministic full neural next-chapter preview.",
  generation_context: {
    chapter_mode: "next_chapter",
    phase: "38E",
  },
  retrieval_context: {
    active_engine_excerpt: "Phase38E deterministic aesthetic memory context readiness fixture.",
    registered_project_sources: ["active_engine", "writing_card", "longline"],
  },
  provider_type: "deterministic_test",
  provider_id: "phase38e-chatgpt-aesthetic-memory-provider",
  model_name: "deterministic-phase38e-chatgpt-aesthetic-memory",
  save_candidate: false,
  max_revision_rounds: 2,
  enable_character_voice_guard: true,
  output_mode: "chat_text",
});

assert.equal(result.single_entry_bridge, true);
assert.equal(result.ok, true);
assert.equal(result.status, "completed");
assert.equal(result.pipeline_stage, "final_candidate_ready");
assert.equal(result.stop_reason, null);

assert.equal(result.aesthetic_memory_context?.used, true);
assert.equal(result.aesthetic_memory_context?.loaded, true);
assert.equal(result.aesthetic_memory_context?.evidence, true);
assert.equal(result.aesthetic_memory_context?.status, "auto_loaded_from_builder_bridge_preview");
assert.equal(result.integrated_modules?.aesthetic_memory_context, true);

const contract = result.neural_writing_brain_required_modules_contract;
assert.equal(contract?.contract_valid, true);
assert.deepEqual(contract?.missing_required_brain_modules, []);
assert.equal(contract?.can_emit_final_output, true);

const aestheticEntry = contract.required_brain_module_entries
  .find((entry) => entry.key === "long_term_aesthetic_memory");

assert(aestheticEntry, "long_term_aesthetic_memory contract entry must exist.");
assert.equal(aestheticEntry.loaded, true);
assert.equal(aestheticEntry.used, true);
assert.equal(aestheticEntry.evidence, true);
assert.equal(aestheticEntry.contract_valid, true);

assert.equal(result.can_output_to_chat, true);
assert.equal(result.final_response_for_chat?.response_kind, "final_candidate_text");
assert.equal(result.final_response_handoff_for_chat?.may_output_story_text, true);
assert.equal(result.final_response_handoff_for_chat?.must_output_body_exactly, true);
assert.equal(result.final_response_handoff_for_chat?.may_include_extra_explanation, false);

assert.equal(result.extracted_chatgpt_final_output?.response_kind, "final_candidate_text");
assert.equal(result.extracted_chatgpt_final_output?.extraction_contract_valid, true);
assert.equal(typeof result.extracted_chatgpt_final_output?.output_text, "string");
assert(result.extracted_chatgpt_final_output.output_text.trim().length > 0);

console.log("Phase38E ChatGPT full neural aesthetic memory context readiness passed.");
