import assert from "node:assert/strict";
import {
  chatgptBridgeTools,
  chatgptBridgeToolMetadata,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";

const exportedToolNames = Object.keys(chatgptBridgeTools);

assert(
  exportedToolNames.includes("chatgpt_bridge_run_full_neural_writing_pipeline"),
  "ChatGPT-facing tool surface must expose the full neural writing pipeline entry.",
);

assert(
  !exportedToolNames.includes("chatgpt_bridge_run_full_recursive_writing_pipeline"),
  "ChatGPT-facing public tool surface should not prefer the legacy recursive pipeline over the full neural single-entry pipeline.",
);

assert.equal(
  typeof chatgptBridgeTools.chatgpt_bridge_run_full_neural_writing_pipeline,
  "function",
  "Full neural writing pipeline tool must be callable from chatgptBridgeTools.",
);

const neuralMetadata =
  chatgptBridgeToolMetadata.chatgpt_bridge_run_full_neural_writing_pipeline;

assert.equal(
  neuralMetadata?.chatgpt_story_generation_primary_entry,
  true,
  "Full neural writing pipeline metadata must mark it as the primary ChatGPT story generation entry.",
);

assert.equal(
  neuralMetadata?.canonical_chatgpt_full_neural_pipeline_entry,
  true,
  "Full neural writing pipeline metadata must mark it as the canonical full neural entry.",
);

assert.equal(
  neuralMetadata?.canonical_final_output_field,
  "extracted_chatgpt_final_output.output_text",
  "Full neural writing pipeline metadata must identify the canonical final output field.",
);

assert.equal(
  neuralMetadata?.must_emit_extracted_final_output_exactly,
  true,
  "Full neural writing pipeline metadata must require exact final output emission.",
);

assert.equal(neuralMetadata?.no_rewrite, true);
assert.equal(neuralMetadata?.no_summary, true);
assert.equal(neuralMetadata?.no_extra_explanation, true);

const routeTerms = neuralMetadata?.use_when_user_asks_for ?? [];
for (const term of ["正式續寫", "下一章", "只輸出正文", "從章名開始", "write", "continue", "generate"]) {
  assert(
    routeTerms.includes(term),
    `Full neural writing pipeline routing terms must include ${term}.`,
  );
}

const contextMetadata =
  chatgptBridgeToolMetadata.chatgpt_bridge_build_writing_context;

assert.equal(
  contextMetadata?.context_only,
  true,
  "Writing context metadata must mark context-only status.",
);

assert.equal(
  contextMetadata?.not_final_story_output_tool,
  true,
  "Writing context metadata must mark it is not a final story output tool.",
);

assert.equal(
  contextMetadata?.use_for_final_story_output,
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "Writing context metadata must route final story output to the full neural writing pipeline.",
);

assert.match(
  contextMetadata?.context_tool_routing_warning ?? "",
  /Context-only|Do not use.*final story|正式續寫|下一章|只輸出正文|從章名開始|chatgpt_bridge_run_full_neural_writing_pipeline/i,
  "Writing context routing warning must explicitly prevent final-output misuse.",
);

const recursiveMetadata =
  chatgptBridgeToolMetadata.chatgpt_bridge_run_full_recursive_writing_pipeline;

assert.equal(
  recursiveMetadata?.legacy_recursive_pipeline_entry,
  true,
  "Recursive pipeline metadata should remain available as legacy backend entry.",
);

assert.equal(
  recursiveMetadata?.prefer_for_chatgpt_story_generation,
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "Recursive pipeline metadata must point ChatGPT story generation to the full neural entry.",
);

console.log("Phase 38C ChatGPT full pipeline usable surface calibration passed.");
