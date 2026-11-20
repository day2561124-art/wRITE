import { hashAgentRunValue } from "./agent-run-service.mjs";

const version = "observer-dialogue-clarification-v1";
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
