import assert from "node:assert/strict";
import { planDialogueCountdownAnswer, projectDialogueCountdownDisplay } from "../../server/src/observer-dialogue-answer-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";

const character = "收聽者";
const speaker = "對話者";
const descriptor = {anchor: "架上", color: "白色", kind: "計時器"};
const request = {speaker, kind: "max_countdown", referent: "learned_example", descriptor};
const target = {observer: character, partner: speaker};
const fact = "它最多能倒數四十分鐘。";
const entry = (memory_id, lesson, channel = "observed_text", referent_id = request.referent) => ({
  memory_id, content: {referent_id, detail_type: "runtime", lesson},
  internal_provenance: {dialogue_learning_version: observerDialogueLearningVersion, dialogue_source_channel: channel},
});
const one = entry("m1", fact);
const retrieval = {recovered_fragments: [{source_memory_ref: "m1", content: fact,
  content_grounding: {source_memory_ref: "m1", selector: {kind: "json_pointer", path: "/lesson"}, materialized_by_kernel: true}}]};
const working_context = {focus: {context_origin: "recovered_memory", content: fact}};
const base = {character, target, request, cognition: {working_context}, retrieval, memories: [one]};
const emitted = input => {
  const communication_goal = planDialogueCountdownAnswer(input);
  return buildCharacterCommunicationActionCandidate({character, cognition: {...input.cognition, communication_goal}})?.communication;
};
assert.equal(emitted(base).surface_realization.surface_text, "我記得最多能倒數四十分鐘。");
assert.equal(emitted({...base, memories: [entry("m1", fact, "understood_testimony")]}).surface_realization.surface_text,
  "我記得有人說最多能倒數四十分鐘。");
for (const change of [
  {retrieval: null},
  {cognition: {working_context: {focus: {context_origin: "committed_experience", content: fact}}}},
  {cognition: {working_context: {focus: {...working_context.focus, source_confused: true}}}},
  {memories: [one, entry("m2", "它最多能倒數五十分鐘。", "heard_text")]},
  {memories: [entry("m1", fact, "observed_text", "other_referent")]},
]) assert.equal(emitted({...base, ...change}).surface_realization.surface_text, "我不確定，得再查一下。");
assert.equal(emitted({...base, memories: [one, entry("m2", "它最多能倒數2400秒。")]}).surface_realization.surface_text,
  "我記得最多能倒數四十分鐘。");
assert.equal(planDialogueCountdownAnswer({...base, target: {...target, partner: "旁人"}}), null);

const visible = {kind: "visible_object", perceptual_object_ref: "p1", perceptual_label: "架上那台白色計時器",
  illumination_tier: "clear", visibility_extent: "full", relative_position: {dx_m: 1, dy_m: 0}};
const visibility = {clear_objects: ["o1"], perception_visual_observations: [visible],
  perceptual_object_bindings: [{object_id: "o1", perceptual_object_ref: "p1"}]};
const objects = {o1: {public_runtime_display: {kind: "countdown_limit_panel", max_countdown_seconds: 3000}}};
const read = {request, visibility, objects};
const display = projectDialogueCountdownDisplay(read);
assert.equal(display.content, "面板顯示最多能倒數50分鐘。");
assert.equal(display.duration, "50分鐘");
assert.equal(display.seconds, 3000);
assert.match(display.identity, /^[a-f0-9]{64}$/u);
const seen = emitted({...base, display, cognition: {...base.cognition, perception: {observed: [display.content]}}});
assert.equal(seen.surface_realization.surface_text, "我看了一下面板，最多能倒數50分鐘。");
assert.equal(seen.message.world_truth_claimed, false);
assert.equal(emitted({...base, display}).surface_realization.surface_text, "我記得最多能倒數四十分鐘。");
for (const change of [
  {...read, objects: {o1: {private_countdown_seconds: 3000}}},
  {...read, request: {...request, descriptor: null}},
  {...read, request: {...request, descriptor: {...descriptor, anchor: "桌上"}}},
  {...read, visibility: {...visibility, clear_objects: []}},
  {...read, visibility: {...visibility, perception_visual_observations: [{...visible, visibility_extent: "partial"}]}},
  {...read, visibility: {...visibility, perception_visual_observations: [{...visible, relative_position: {dx_m: 3, dy_m: 0}}]}},
  {...read, visibility: {clear_objects: ["o1", "o2"],
    perception_visual_observations: [visible, {...visible, perceptual_object_ref: "p2"}],
    perceptual_object_bindings: [...visibility.perceptual_object_bindings, {object_id: "o2", perceptual_object_ref: "p2"}]}},
]) assert.equal(projectDialogueCountdownDisplay(change), null);
console.log("Spoken countdown answers preserve memory source, refuse contradictory recollections, and report only a currently legible panel.");
