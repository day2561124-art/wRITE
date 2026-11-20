import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { analyzeObserverDialogueLearning, observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import {
  admitDialogueClarificationReply, admitDialogueClarificationTarget, committedDialogueClarificationRequests,
  dialogueClarificationQuestion, recentDialogueThreadAnchor, stageDialogueClarificationRequest,
} from "../../server/src/observer-dialogue-clarification-service.mjs";

const observer = "值班員";
const partner = "提問者";
const other = "同事";
const sceneId = "器材室";
const id = index => "learned_" + String(index).padStart(24, "0");
const memory = (index, anchor, color, options = {}) => ({
  internal_provenance: {dialogue_learning_version: observerDialogueLearningVersion},
  content: {referent_id: id(index), referent_description: {anchor, color, kind: "計時器"}, ...options},
});
const memories = [
  memory(1, "桌上", "白色"),
  memory(2, "架上", "白色", {referent_name: "白鷺", referent_aliases: ["小鷺"]}),
];
const heard = (semantic_content, source_action_id, speaker = partner) => ({
  kind: "understood_utterance", schema_version: "cc2-listener-understood-utterance-v1", observer,
  speaker, semantic_content, source_action_id, speaker_identity_recognized: true, speech_content_intelligible: true,
  public_event_committed: true, world_truth_claimed: false,
});
function analyze(text, stored = memories, reply = null, additionalPerception = []) {
  const receipt = heard(text, reply ? "reply" : "ask");
  const receiptHash = hashAgentRunValue(receipt);
  return analyzeObserverDialogueLearning({character: observer, perception: {audible: [receipt, ...additionalPerception]},
    memories: stored, verifiedReceiptHashes: [receiptHash], clarificationReply: reply && {...reply, receipt_hash: receiptHash}});
}

const original = "白色計時器會用哪種電池？";
const question = analyze(original);
assert.equal(question.scope.mode, "ambiguous");
assert.deepEqual(question.clarification.request.referents, [id(1), id(2)]);
const pending = question.clarification.request;
assert.equal(pending.request_field, "power");
for (const text of ["架上那台。", "我指的是架上那臺。", "架上那台白色計時器。", "小鷺。", "是「白鷺」。"]) {
  const result = analyze(text, memories, pending);
  assert.equal(result.scope.referent, id(2), text);
  assert.equal(result.request_field, "power", text);
  assert.equal(result.bindings.size, 0, text);
}
assert.equal(analyze("架上那台。").request_field, null);
for (const text of ["對。", "那台。", "架上哪台？", "白色那台。", "門邊那台。", "不是架上那台。", "也許架上那台。"]) {
  assert.equal(analyze(text, memories, pending).request_field, null, text);
}
assert.equal(analyze("架上那台。", [...memories, memory(3, "窗邊", "白色")], pending).request_field, null);
assert.equal(analyze("架上那台。", [...memories, memory(2, "架上", "白色", {
  referent_description_collision: true,
})], pending).request_field, null);
assert.equal(analyze("架上那台。", memories, pending, ["桌上那台白色計時器可以用哪種電池？"]).scope.referent, id(1));
const colors = [memory(1, "桌上", "藍色"), memories[1]];
assert.equal(analyze("白色那台。", colors, analyze("計時器能倒數多久？", colors).clarification.request).scope.referent, id(2));

const event = {scene_id: sceneId};
const emitted = (actor, addressee, action_id, surface_text) => ({
  actor, action_id, result: "communication_emitted", communication_event: {
    schema_version: "cc1-world-communication-event-v1", channel: "speech", addressee,
    surface_text, surface_realization_complete: true,
  },
});
const decision = (source_speaker, source_turn_id, source_action_id) =>
  ({source_speaker, source_turn_id, source_action_id, reception_verified: true, speech_candidate_id: source_action_id});
const understanding = (...decisions) => ({version: "cc6c-listener-speech-understanding-v1", observer, audit: {decisions}});
const initial = {observer, sceneId, clarification: question.clarification,
  history: {turns: [{turn_id: "t1", event, action_outcomes: [emitted(partner, observer, "ask", original)]}]},
  understanding: understanding(decision(partner, "t1", "ask")), receipts: [heard(original, "ask")]};
const target = admitDialogueClarificationTarget(initial);
assert.equal(target.partner, partner);
assert.equal(admitDialogueClarificationTarget({...initial, receipts: [heard(original, "ask", other)]}), null);
assert.equal(admitDialogueClarificationTarget({...initial, history: {turns: [
  {turn_id: "t1", event, action_outcomes: [emitted(partner, other, "ask", original)]},
]}}), null);

const staged = stageDialogueClarificationRequest(target, "clarify");
const clarifySpeech = emitted(observer, partner, "clarify", dialogueClarificationQuestion);
assert.deepEqual(committedDialogueClarificationRequests([staged], [], [clarifySpeech]), []);
assert.deepEqual(committedDialogueClarificationRequests([staged], [{character: observer, action_id: "clarify"}], []), []);
const request = {turn_id: "t2", revision_to: 2, next_state_hash: "state-2", event,
  action_outcomes: [clarifySpeech],
  dialogue_clarification_requests: committedDialogueClarificationRequests(
    [staged], [{character: observer, action_id: "clarify"}], [clarifySpeech])};
const answer = {turn_id: "t3", revision_from: 2, revision_to: 3, previous_state_hash: "state-2",
  next_state_hash: "state-3", event, action_outcomes: [emitted(partner, observer, "reply", "架上那台。")],
  communication_listener_understanding_projections: [{character: partner, audit: {decisions: [decision(observer, "t2", "clarify")]}}],
  communication_speaker_recognition_projections: [{character: partner, audit: {decisions: [
    {speech_candidate_id: "clarify", listener_understanding_attested: true, speech_content_intelligible: true},
  ]}}],
};
const input = {observer, sceneId, snapshot: {revision: 3, state_hash: "state-3"},
  history: {turns: [request, answer]}, understanding: understanding(decision(partner, "t3", "reply")),
  receipts: [heard("架上那台。", "reply")]};
assert.equal(admitDialogueClarificationReply(input).request_field, "power");
for (const altered of [
  {...input, sceneId: "別的房間"},
  {...input, observer: other},
  {...input, snapshot: {revision: 4, state_hash: "state-4"}},
  {...input, receipts: [heard("架上那台。", "reply", other)]},
  {...input, understanding: understanding(decision(other, "t3", "reply"))},
  {...input, history: {turns: [{...request, action_outcomes: []}, answer]}},
  {...input, history: {turns: [request, {...answer, action_outcomes: [emitted(other, observer, "reply", "架上那台。")]}]}},
  {...input, history: {turns: [request, {...answer, action_outcomes: [emitted(partner, other, "reply", "架上那台。")]}]}},
  {...input, history: {turns: [request, {...answer, communication_speaker_recognition_projections: []}]}},
  {...input, history: {turns: [request, {...answer, action_outcomes: [...answer.action_outcomes,
    emitted(partner, observer, "reply2", "桌上那台。")]}]}},
]) assert.equal(admitDialogueClarificationReply(altered), null);
const anchor = {observer, partner, referent: id(2), kind: "focused"};
const anchorTurn = {...request, dialogue_thread_anchors: [anchor]};
const liveThread = {...input, history: {turns: [anchorTurn, answer]}};
assert.deepEqual(recentDialogueThreadAnchor(liveThread), anchor);
for (const altered of [
  {...liveThread, observer: other},
  {...liveThread, sceneId: "別的房間"},
  {...liveThread, snapshot: {revision: 3, state_hash: "uncommitted"}},
  {...liveThread, history: {turns: [anchorTurn, {...answer, previous_state_hash: "mismatch"}]}},
  {...liveThread, history: {turns: [anchorTurn, {...answer,
    action_outcomes: [emitted(other, observer, "reply", "它能倒數多久？")]}]}},
  {...liveThread, history: {turns: [anchorTurn, {...answer,
    action_outcomes: [emitted(partner, other, "reply", "它能倒數多久？")]}]}},
  {...liveThread, history: {turns: [{...anchorTurn, dialogue_thread_anchors: [anchor, anchor]}, answer]}},
]) assert.equal(recentDialogueThreadAnchor(altered), null);
console.log("Observer-dialogue clarification: request field, reply forms, unchanged candidate set and committed directed turn linkage verified.");
