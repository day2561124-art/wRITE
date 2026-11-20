import assert from "node:assert/strict";
import {
  bindObserverPanelMemory, dialoguePanelReadSource, dialoguePanelStatement, historicalDialoguePanelMemory, panelReadingContents,
} from "../../server/src/observer-dialogue-panel-memory-service.mjs";
import { learnedDialogueMemoryStage } from "../../server/src/observer-dialogue-learning-service.mjs";
import { planDialogueCountdownAnswer } from "../../server/src/observer-dialogue-answer-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";

const character = "甲";
const speaker = "乙";
const referent = "learned_" + "1".repeat(24);
const descriptor = {anchor: "架上", color: "白色", kind: "計時器"};
const identity = "e".repeat(64);
const observed_at = "2026-11-20T10:32:00+08:00";
const sync = {referent, descriptor, identity, seconds: 3000, observed_at, observation_index: 3, revision: 4};
const observation = panelReadingContents(3000).content;
const seal = {receipt: sync, observation, observationIndex: 3, encodedAt: observed_at};
const binding = bindObserverPanelMemory(seal);
assert.equal(binding.source.channel, dialoguePanelReadSource);
assert.deepEqual(binding.panel_reading, {observed_at: "2026-11-20T02:32:00.000Z", max_countdown_seconds: 3000});
assert.deepEqual(binding.panel_lineage, {identity, revision: 4});
for (const incorrect of [
  {...seal, receipt: null}, {...seal, observationIndex: 2}, {...seal, observation: "面板顯示最多能倒數60分鐘。"},
  {...seal, encodedAt: "2026-11-20T10:35:00+08:00"}, {...seal, receipt: {...sync, observed_at: "昨天"}},
]) assert.equal(bindObserverPanelMemory(incorrect), null);

const memory = (id, secs, at, revision, device = identity) => ({
  memory_id: id, encoded_at: at, source: {sense: "visual"},
  content: {referent_id: referent, referent_description: descriptor, detail_type: "runtime", statement_kind: dialoguePanelStatement,
    lesson: panelReadingContents(secs).lesson, panel_reading: {observed_at: at, max_countdown_seconds: secs}},
  internal_provenance: {dialogue_source_channel: dialoguePanelReadSource,
    dialogue_panel_identity: device, dialogue_panel_revision: revision},
});
const older = memory("older", 1800, "2026-11-20T09:00:00+08:00", 1);
const recent = memory("recent", 3000, observed_at, 4);
const request = {speaker, kind: "max_countdown", referent, remembered_descriptor: descriptor};
const base = {request, memories: [recent, older], revision: 8, simulationTime: "2026-11-20T11:45:00+08:00"};
const picked = historicalDialoguePanelMemory(base);
assert.deepEqual(picked, {memory_id: "recent", lesson: recent.content.lesson, duration: "50分鐘", identity, seconds: 3000});
assert.equal(historicalDialoguePanelMemory({...base, memories: []}), null);
assert.equal(historicalDialoguePanelMemory({...base, memories: [older, {...recent, content: {
  ...recent.content, referent_id: "some_other_referent",
}}]}).memory_id, "older");
for (const blocked of [
  {...base, request: {...request, referent_collision: true}},
  {...base, revision: 4},
  {...base, simulationTime: "2026-11-20T10:00:00+08:00"},
  {...base, memories: [older, {...recent, source_confused: true}]},
  {...base, memories: [older, recent, memory("different", 600, observed_at, 5, "f".repeat(64))]},
  {...base, memories: [older, recent, memory("tie", 600, observed_at, 4)]},
]) assert.deepEqual(historicalDialoguePanelMemory(blocked), {memory_id: null});

function choose(records, history) {
  return learnedDialogueMemoryStage({stage: "recovery", request_field: "runtime",
    historical_panel: history, current_frontier: {candidate_memory_records: records}});
}
const hearsay = {memory_id: "rumor", content: {lesson: "它最多能倒數五分鐘。", detail_type: "runtime"}};
assert.equal(choose([older, recent, hearsay], picked).recovered_selections[0].source_memory_ref, "recent");
assert.equal(choose([older, hearsay], picked).recovered_selections.length, 0);
assert.equal(choose([older, recent, hearsay], null).recovered_selections[0].source_memory_ref, "rumor");

const working_context = {focus: {context_origin: "recovered_memory", content: recent.content.lesson}};
const content_grounding = {source_memory_ref: "recent", materialized_by_kernel: true, selector: {kind: "json_pointer", path: "/lesson"}};
const input = {character, request, target: {observer: character, partner: speaker}, historicalPanel: picked,
  cognition: {working_context},
  retrieval: {recovered_fragments: [{source_memory_ref: "recent", content: recent.content.lesson, content_grounding}]}};
const speak = options => buildCharacterCommunicationActionCandidate({character, cognition: {...options.cognition,
  communication_goal: planDialogueCountdownAnswer(options)}}).communication;
const historicalSpeech = speak(input);
assert.equal(historicalSpeech.surface_realization.surface_text, "我上次看面板時，上限是50分鐘。");
assert.equal(historicalSpeech.message.semantic_content, recent.content.lesson);
assert.equal(historicalSpeech.message.world_truth_claimed, false);
assert.equal(speak({...input, retrieval: null}).surface_realization.surface_text, "我不確定，得再查一下。");
console.log("Timestamped firsthand panel memories require an exact read, preserve device identity and recover only the latest admitted observation.");
