import { hashAgentRunValue } from "./agent-run-service.mjs";

const version = "observer-dialogue-clarification-v1";
const correctionQuestion = {request_field: "runtime", answer_kind: "max_countdown"};
const sameTurnPair = (first, second, sceneId, snapshot) => Boolean(first && second && sceneId && snapshot
  && sceneOf(first) === sceneId && sceneOf(second) === sceneId
  && first.revision_to === second.revision_from && first.next_state_hash === second.previous_state_hash
  && second.revision_to === snapshot.revision && second.next_state_hash === snapshot.state_hash);
const list = value => Array.isArray(value) ? value : [];
const sceneOf = turn => turn?.event?.scene_id ?? turn?.event?.location_id ?? null;
export const dialogueClarificationQuestion = "你指的是哪一件？";

function directSpeech(turn, speaker, addressee) {
  return list(turn?.action_outcomes).filter(row => {
    const event = row?.communication_event;
    return row?.actor === speaker && typeof row.action_id === "string" && row.result === "communication_emitted"
      && event?.schema_version === "cc1-world-communication-event-v1"
      && event.channel === "speech" && event.addressee === addressee && event.surface_realization_complete === true;
  });
}

function receivedDirectSpeech({observer, speaker, turn, understanding, receipts}) {
  if (understanding?.observer !== observer || understanding?.version !== "cc6c-listener-speech-understanding-v1") return null;
  const emissions = directSpeech(turn, speaker, observer);
  if (emissions.length !== 1) return null;
  const [{action_id: actionId}] = emissions;
  const heard = list(understanding.audit?.decisions).filter(entry => entry.source_action_id === actionId
    && entry.source_turn_id === turn.turn_id && entry.source_speaker === speaker && entry.reception_verified === true);
  if (heard.length !== 1) return null;
  const understood = list(receipts).filter(receipt => receipt.observer === observer
    && receipt.speaker === speaker && receipt.source_action_id === actionId);
  return understood.length === 1 ? understood[0] : null;
}

// World-only joins: do not disclose objective speaker identity, recipient
// metadata or action/turn identifiers to the character policy.
export function admitDialogueClarificationTarget({
  observer, clarification, sceneId, history, understanding, receipts,
}) {
  const turn = list(history?.turns).at(-1);
  const speaker = clarification?.speaker;
  if (!speaker || !sceneId || sceneOf(turn) !== sceneId) return null;
  const heard = receivedDirectSpeech({observer, speaker, turn, understanding, receipts});
  if (!heard || hashAgentRunValue(heard) !== clarification.receipt_hash) return null;
  return {observer, partner: speaker, ...(clarification.request ? {request: clarification.request} : {})};
}

// Only correctly attributed, understood speech from the same committed
// emission can provide shared context. Listener interpretation is subjective:
// two listeners count as sharing a cue only if their interpretations match.
export function dialogueHearingAttestations({observer, sceneId, history, understanding, receipts}) {
  const turn = list(history?.turns).at(-1);
  if (!sceneId || sceneOf(turn) !== sceneId || understanding?.observer !== observer
      || understanding?.version !== "cc6c-listener-speech-understanding-v1") return [];
  const results = [];
  for (const receipt of list(receipts)) {
    if (receipt.observer !== observer || !receipt.speaker || typeof receipt.semantic_content !== "string") continue;
    const heard = list(understanding.audit?.decisions).filter(decision => decision.source_action_id === receipt.source_action_id
      && decision.source_speaker === receipt.speaker && decision.source_turn_id === turn.turn_id
      && decision.reception_verified === true);
    if (heard.length !== 1 || !heard[0].speech_candidate_id) continue;
    results.push({observer, emission: hashAgentRunValue({
      turn_id: turn.turn_id, action_id: receipt.source_action_id, speaker: receipt.speaker,
      interpreted: receipt.semantic_content,
    }), receipt_hash: hashAgentRunValue(receipt)});
  }
  return results;
}

export function dialogueThreadAnchorsWithAudience(anchors, attestations) {
  return list(anchors).map(({receipt_hash, ...anchor}) => {
    const matches = list(attestations).filter(item => item.observer === anchor.observer
      && item.receipt_hash === receipt_hash && item.emission);
    if (matches.length !== 1 || anchor.kind !== "focused") return anchor;
    const shared = [...new Set(list(attestations).filter(item => item.emission === matches[0].emission
      && item.observer !== anchor.observer && item.observer !== anchor.partner).map(item => item.observer))];
    return shared.length ? {...anchor, shared_with: shared} : anchor;
  });
}

// The immediate follow-up may come from the original partner or from a
// bystander who shared the actual understood cue, never from presence alone.
export function recentDialogueThreadAnchor({observer, sceneId, history, snapshot}) {
  const [anchorTurn, speechTurn] = list(history?.turns).slice(-2);
  if (!sameTurnPair(anchorTurn, speechTurn, sceneId, snapshot)) return null;
  const anchors = list(anchorTurn.dialogue_thread_anchors).filter(item => item?.observer === observer
    && typeof item.partner === "string" && item.partner && item.partner !== observer && /^learned_[a-f0-9]{24}$/u.test(item.referent)
    && ["focused", "paused"].includes(item.kind));
  if (anchors.length !== 1) return null;
  const [anchor] = anchors;
  const eligible = new Set([anchor.partner, ...(anchor.kind === "focused" ? list(anchor.shared_with) : [])]);
  const speakers = [...eligible].filter(partner => directSpeech(speechTurn, partner, observer).length === 1);
  return speakers.length === 1 ? {...anchor, partner: speakers[0]} : null;
}

// Use the selected surface's reply shape, not a planner's private intent.
const durationReply = /(?:最多能倒數|上限是|我猜(?:它能倒數|是)|應該是)[0-9零一二兩三四五六七八九十百千]+(?:秒|分鐘|小時)[。！!]?$/u;

// Capture a candidate question only when the observer actually made a
// selected and emitted response to its verified original speaker.
export function committedDialogueAnswerFollowups(questions, selections, outcomes) {
  const followups = [];
  for (const question of list(questions)) {
    const {observer, partner} = question;
    const replies = directSpeech({action_outcomes: outcomes}, observer, partner);
    if (replies.length !== 1) continue;
    const [reply] = replies;
    const selected = list(selections).filter(row => row.character === observer && row.action_id === reply.action_id);
    const spoken = reply.communication_event.surface_text;
    if (selected.length !== 1 || typeof spoken !== "string" || !durationReply.test(spoken.normalize("NFKC").trim())) continue;
    followups.push({observer, partner, response_action_id: reply.action_id});
  }
  return followups;
}

export function admitDialogueAnswerCorrection({observer, sceneId, history, snapshot, understanding, receipts}) {
  const [responseTurn, correctionTurn] = list(history?.turns).slice(-2);
  if (!sameTurnPair(responseTurn, correctionTurn, sceneId, snapshot)) return null;
  const matches = list(responseTurn.dialogue_answer_followups).filter(item => item.observer === observer);
  if (matches.length !== 1) return null;
  const {partner, response_action_id} = matches[0];
  if (directSpeech(responseTurn, observer, partner).filter(row => row.action_id === response_action_id).length !== 1) return null;
  const listening = list(correctionTurn.communication_listener_understanding_projections).filter(row => row.character === partner);
  const recognition = list(correctionTurn.communication_speaker_recognition_projections).filter(row => row.character === partner);
  if (listening.length !== 1 || recognition.length !== 1) return null;
  const heard = list(listening[0].audit?.decisions).filter(row => row.source_turn_id === responseTurn.turn_id
    && row.source_action_id === response_action_id && row.source_speaker === observer && row.reception_verified === true);
  if (heard.length !== 1 || list(recognition[0].audit?.decisions).filter(row => row.speech_candidate_id === heard[0].speech_candidate_id
    && row.listener_understanding_attested === true && row.speech_content_intelligible === true
    && row.perceived_speaker_matches_world_source === true).length !== 1) return null;
  const receipt = receivedDirectSpeech({observer, speaker: partner, turn: correctionTurn, understanding, receipts});
  return receipt ? {...correctionQuestion, receipt_hash: hashAgentRunValue(receipt)} : null;
}

export function stageDialogueClarificationRequest(target, actionId) {
  return target?.request && typeof actionId === "string"
    ? {...target, action_id: actionId, version} : null;
}

export function committedDialogueClarificationRequests(proposals, selections, outcomes) {
  return list(proposals).filter(proposal => {
    if (proposal?.version !== version) return false;
    const selected = list(selections).filter(row => row.character === proposal.observer
      && row.action_id === proposal.action_id);
    const emitted = directSpeech({action_outcomes: outcomes}, proposal.observer, proposal.partner)
      .filter(row => row.action_id === proposal.action_id
        && row.communication_event.surface_text === dialogueClarificationQuestion);
    return selected.length === 1 && emitted.length === 1;
  });
}

export function admitDialogueClarificationReply({
  observer, sceneId, history, snapshot, understanding, receipts,
}) {
  // A request expires after the partner's immediate reply turn and that
  // reply's listening turn. It cannot latch onto future unrelated speech.
  const [requestTurn, replyTurn] = list(history?.turns).slice(-2);
  if (!requestTurn || !replyTurn || !sceneId || sceneOf(requestTurn) !== sceneId || sceneOf(replyTurn) !== sceneId
      || requestTurn.revision_to !== replyTurn.revision_from
      || requestTurn.next_state_hash !== replyTurn.previous_state_hash
      || replyTurn.revision_to !== snapshot.revision || replyTurn.next_state_hash !== snapshot.state_hash) return null;
  const proposals = list(requestTurn.dialogue_clarification_requests).filter(row =>
    row.version === version && row.observer === observer);
  if (proposals.length !== 1) return null;
  const [pending] = proposals;
  if (directSpeech(requestTurn, observer, pending.partner).filter(row => row.action_id === pending.action_id
    && row.communication_event.surface_text === dialogueClarificationQuestion).length !== 1) return null;
  // The responder must have actually heard and interpreted this request
  // when deciding to speak. Merely uttering a matching fragment is not enough.
  const listening = list(replyTurn.communication_listener_understanding_projections).filter(row => row.character === pending.partner);
  const recognition = list(replyTurn.communication_speaker_recognition_projections).filter(row => row.character === pending.partner);
  if (listening.length !== 1 || recognition.length !== 1) return null;
  const heard = list(listening[0].audit?.decisions).filter(row => row.source_turn_id === requestTurn.turn_id
    && row.source_action_id === pending.action_id && row.source_speaker === observer && row.reception_verified === true);
  if (heard.length !== 1 || list(recognition[0].audit?.decisions).filter(row => row.speech_candidate_id === heard[0].speech_candidate_id
    && row.listener_understanding_attested === true && row.speech_content_intelligible === true).length !== 1) return null;
  const receipt = receivedDirectSpeech({observer, speaker: pending.partner, turn: replyTurn, understanding, receipts});
  return receipt ? {...pending.request, receipt_hash: hashAgentRunValue(receipt)} : null;
}
