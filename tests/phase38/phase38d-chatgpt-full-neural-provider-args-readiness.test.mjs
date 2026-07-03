import assert from "node:assert/strict";
import { runFullNeuralWritingPipelineSingleEntryBridge } from "../../server/src/full-neural-writing-pipeline-single-entry-bridge-service.mjs";

const baseInput = {
  task_prompt: "Phase38D provider args readiness: produce a deterministic full neural next-chapter preview.",
  generation_context: {
    chapter_mode: "next_chapter",
    phase: "38D",
  },
  retrieval_context: {
    active_engine_excerpt: "Phase38D deterministic provider readiness fixture.",
    registered_project_sources: ["active_engine", "writing_card", "longline"],
  },
  provider_type: "deterministic_test",
  provider_id: "phase38d-chatgpt-mcp-raw-provider",
  model_name: "deterministic-phase38d-chatgpt-mcp-raw-provider",
  save_candidate: false,
  max_revision_rounds: 2,
  enable_character_voice_guard: true,
  output_mode: "chat_text",
};

const result = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput);

assert.equal(result.single_entry_bridge, true);
assert.equal(result.ok, true);
assert.equal(result.status, "completed");
assert.equal(result.pipeline_stage, "final_candidate_ready");
assert.notEqual(
  result.stop_reason,
  "generation_provider_required",
  "MCP-style raw provider_type=deterministic_test must not stop at generation_provider_required.",
);

assert.equal(typeof result.final_candidate_text, "string");
assert(result.final_candidate_text.trim().length > 0);

const failureWarnings = result.failure_output_for_chat?.warnings ?? [];
assert(
  !failureWarnings.includes("deterministic_test_provider_not_allowed"),
  "Explicit ChatGPT deterministic preview provider must not be blocked by deterministic_test_provider_not_allowed.",
);
assert(
  !failureWarnings.includes("generation_provider_required"),
  "Explicit ChatGPT deterministic preview provider must not report generation_provider_required.",
);

if (result.failure_output_for_chat?.used === true) {
  assert.notEqual(
    result.failure_output_for_chat?.stop_reason,
    "generation_provider_required",
    "Provider readiness must not regress to generation_provider_required.",
  );
  assert(
    !(result.failure_output_for_chat?.missing_required_brain_modules ?? []).includes("long_term_aesthetic_memory"),
    "Provider readiness path must not leave long_term_aesthetic_memory missing after Phase38E.",
  );
}

assert.equal(result.final_response_handoff_for_chat?.must_output_body_exactly, true);
assert.equal(result.final_response_handoff_for_chat?.may_include_extra_explanation, false);

console.log("Phase38D ChatGPT full neural provider args readiness passed.");
