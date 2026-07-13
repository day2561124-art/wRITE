import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_final_polisher,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const rawStory = "Phase44C ChatGPT-native test prose：雨聲越過廊柱，她在門前停住，終於說出那個名字。";
const mutationGuards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const legacySurface = (key) => key === "chatgpt_final_output" || key.startsWith("chatgpt_operator_compact_diagnostics");
const capabilities = [
  ["scene_planner", chatgpt_bridge_use_scene_planner, { result_type: "scene_plan", beats: ["獨特場景節拍 A", "獨特場景節拍 B"], turn: "門外腳步停止" }],
  ["character_simulator", chatgpt_bridge_use_character_simulator, { result_type: "character_simulation", inner_state: "想開門卻害怕認出來人", action: "手仍扣在門閂上" }],
  ["neural_critic", chatgpt_bridge_use_neural_critic, { result_type: "neural_critique", risk: "避免用旁白提前解釋來客身份", revision_target: "讓聲音先抵達" }],
  ["style_drift_detector", chatgpt_bridge_use_style_drift_detector, { result_type: "style_drift_report", drift_risk: "medium", evidence: "連續抽象心理說明會削弱雨夜觸感" }],
  ["over_governance_detector", chatgpt_bridge_use_over_governance_detector, { result_type: "over_governance_report", warning: "限制條款不可進入正文", release: "允許角色做出意外但合乎性格的選擇" }],
  ["writing_card_director", chatgpt_bridge_use_writing_card_director, { result_type: "writing_card_director_context", direction: "以門閂的細小震動承載決定", ending: "用具體事件轉折收束" }],
];

function assertCompactSemanticResponse(response, capability, session, expectedOutput) {
  assert.equal(response.ok, true);
  assert.equal(response.architecture_route, "chatgpt_owned_external_brain");
  assert.equal(response.external_brain_session_id, session.external_brain_session_id);
  assert.equal(response.writing_context_bundle_id, session.writing_context_bundle_id);
  assert.equal(response.capability_name, `run_${capability}`);
  assert.equal(response.generation_boundary, "pre_generation");
  assert.equal(response.orchestration_owner, "ChatGPT");
  assert.equal(response.prose_generator, "ChatGPT");
  assert.equal(response.full_neural_orchestrator_used, false);
  assert.deepEqual(response.capability_output, expectedOutput);
  assert.doesNotMatch(JSON.stringify(response.capability_output), /Writer Workbench executed|please integrate|generic acknowledgement/iu);
  assert.match(response.trace.trace_id, /^neural_trace_/u);
  assert.equal(response.trace.run_id, session.external_brain_session_id);
  assert.equal(response.trace.module_name, capability);
  assert.equal(response.trace.status, "success");
  assert.match(response.trace.output_hash, /^[a-f0-9]{64}$/u);
  for (const guard of mutationGuards) assert.equal(response.mutation_guards[guard], false);
  assert.equal("writing_context" in response, false);
  assert.equal("context_for_chat" in response, false);
  assert.equal(Object.keys(response).some(legacySurface), false);
  assert(Buffer.byteLength(JSON.stringify(response), "utf8") < 16 * 1024);
}

const session = await chatgpt_bridge_begin_external_brain_writing_session({
  task_prompt: "Phase44C individual semantic handoff：寫一段雨夜門前的角色抉擇。",
  chapter_mode: "specific_scene",
});
assert.equal(session.ok, true);

const directSizes = {};
const traceIds = [];
for (const [capability, invoke, semanticOutput] of capabilities) {
  const response = await invoke({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: { regression: "semantic_content_preservation" },
  }, { adapter: async () => semanticOutput });
  assertCompactSemanticResponse(response, capability, session, semanticOutput);
  directSizes[capability] = Buffer.byteLength(JSON.stringify(response), "utf8");
  traceIds.push(response.trace.trace_id);
}

const finalSemanticOutput = {
  raw_story_sha256: sha256(rawStory),
  polished_text: `${rawStory}\n\n門，從裡面開了。`,
  revision_report: [{ dimension: "ending_event", action: "added_concrete_turn" }],
};
const polished = await chatgpt_bridge_use_final_polisher({
  external_brain_session_id: session.external_brain_session_id,
  writing_context_bundle_id: session.writing_context_bundle_id,
  raw_story_text: rawStory,
  raw_story_sha256: sha256(rawStory),
}, { adapter: async () => finalSemanticOutput });
assert.equal(polished.ok, true);
assert.equal(polished.architecture_route, "chatgpt_owned_external_brain");
assert.equal(polished.generation_boundary, "post_generation");
assert.equal(polished.raw_story_sha256, sha256(rawStory));
assert.deepEqual(polished.capability_output, finalSemanticOutput);
assert.equal(typeof polished.capability_output.polished_text, "string");
assert(Array.isArray(polished.capability_output.revision_report));
assert.equal(polished.trace.module_name, "final_polisher");
assert.equal(polished.trace.status, "success");
assert.match(polished.trace.trace_id, /^neural_trace_/u);
assert.match(polished.trace.output_hash, /^[a-f0-9]{64}$/u);
for (const guard of mutationGuards) assert.equal(polished.mutation_guards[guard], false);
assert.equal(Object.keys(polished).some(legacySurface), false);
directSizes.final_polisher = Buffer.byteLength(JSON.stringify(polished), "utf8");
assert(directSizes.final_polisher < 16 * 1024);
traceIds.push(polished.trace.trace_id);
assert.equal(new Set(traceIds).size, 7);

console.log(`Phase 44C individual semantic handoff passed: semantic=6/6, traces=7/7, raw_story_sha256=${sha256(rawStory)}, direct_sizes=${JSON.stringify(directSizes)}`);
