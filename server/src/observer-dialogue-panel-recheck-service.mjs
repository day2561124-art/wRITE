import { hashAgentRunValue } from "./agent-run-service.mjs";

const list = value => Array.isArray(value) ? value : [];
const sceneOf = event => event?.scene_id ?? event?.location_id ?? null;
const recheckType = "dialogue_panel_recheck";
const prefix = "dialogue_panel_recheck_";
const validIdentity = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const validReferent = value => typeof value === "string" && /^learned_[a-f0-9]{24}$/u.test(value);
const validPlan = value => value && typeof value.character === "string" && typeof value.partner === "string"
  && value.character !== value.partner && validReferent(value.referent)
  && validIdentity(value.identity) && typeof value.action_id === "string";
const terminalMovement = new Set(["movement_completed", "movement_blocked"]);

export function isPanelRecheckQuestion(text) {
  return typeof text === "string" && /^(?:那)?現在(?:還是)?(?:一樣|跟上次一樣)(?:嗎[？?。]?|[？?])$/u.test(text.normalize("NFKC").trim());
}

function outcomeFor(turn, plan) {
  return list(turn?.action_outcomes).find(item => item.actor === plan.character && item.action_id === plan.action_id);
}

export function recentPanelQuote({history, character, partner, sceneId, snapshot}) {
  const [quotedTurn, questionTurn] = list(history?.turns).slice(-2);
  if (!quotedTurn || !questionTurn || sceneOf(quotedTurn.event) !== sceneId || sceneOf(questionTurn.event) !== sceneId
      || quotedTurn.revision_to !== questionTurn.revision_from || quotedTurn.next_state_hash !== questionTurn.previous_state_hash
      || questionTurn.revision_to !== snapshot.revision || questionTurn.next_state_hash !== snapshot.state_hash) return null;
  const matches = list(quotedTurn.dialogue_panel_quotes).filter(item =>
    validPlan(item) && item.character === character && item.partner === partner);
  if (matches.length !== 1) return null;
  const [quote] = matches;
  const outcome = outcomeFor(quotedTurn, quote);
  return outcome?.result === "communication_emitted" && outcome.communication_event?.addressee === partner ? quote : null;
}

export function committedPanelQuotes(proposals, selections, outcomes) {
  return list(proposals).filter(plan => validPlan(plan) && list(selections).some(item =>
    item.character === plan.character && item.action_id === plan.action_id)
    && list(outcomes).some(item => item.actor === plan.character && item.action_id === plan.action_id
      && item.result === "communication_emitted" && item.communication_event?.addressee === plan.partner));
}

export function suggestPanelApproach({target, request, visible, turnId}) {
  if (!target || !validIdentity(request?.identity) || visible?.identity !== request.identity) return null;
  const {dx_m: dx, dy_m: dy} = visible.position;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 2 || distance > 6) return null;
  const travel = (distance - 1.25) / distance;
  const actionId = prefix + hashAgentRunValue({character: target.observer, turnId, referent: request.referent}).slice(0, 20);
  return {
    candidate: {action_id: actionId, intent: "走近計時器，再確認一次面板", movement: {
      dx: Math.round(dx * travel * 1000) / 1000, dy: Math.round(dy * travel * 1000) / 1000,
    }},
    plan: {character: target.observer, partner: target.partner, referent: request.referent,
      identity: request.identity, action_id: actionId},
  };
}

export function schedulePanelRechecks({plans, selections, outcomes, turnId, sceneId}) {
  if (!sceneId || !turnId) return [];
  return list(plans).filter(plan => validPlan(plan) && plan.action_id.startsWith(prefix)
    && list(selections).some(item => item.character === plan.character && item.action_id === plan.action_id && item.candidate?.movement)
    && list(outcomes).some(item => item.actor === plan.character && item.action_id === plan.action_id
      && terminalMovement.has(item.result)))
    .map(plan => ({
      event_id: prefix + hashAgentRunValue({turnId, plan}).slice(0, 24),
      type: "observation", scene_id: sceneId, participants: [plan.character],
      dialogue_panel_recheck: {...plan, source_turn_id: turnId},
    }));
}

export function resolvePendingPanelRecheck({event, character, snapshot, history}) {
  const plan = event?.[recheckType];
  if (!validPlan(plan) || plan.character !== character || !plan.action_id.startsWith(prefix)) return null;
  const recent = list(history?.turns).slice(-33);
  const source = recent.findIndex(turn => turn.turn_id === plan.source_turn_id);
  const turn = recent[source], latest = recent.at(-1);
  if (!turn || latest?.revision_to !== snapshot.revision
      || latest.next_state_hash !== snapshot.state_hash || sceneOf(turn.event) !== sceneOf(event)
      || !list(turn.scheduled_events).includes(event.event_id)
      || event.event_id !== prefix + hashAgentRunValue({turnId: turn.turn_id,
        plan: {character, partner: plan.partner, referent: plan.referent, identity: plan.identity, action_id: plan.action_id}}).slice(0, 24)) return null;
  // Several residents can move in one turn. Only immediate sibling readbacks
  // from that same turn may appear between the movement and this readback.
  for (let index = source + 1; index < recent.length; index += 1) {
    const previous = recent[index - 1], sibling = recent[index];
    if (previous.revision_to !== sibling.revision_from || previous.next_state_hash !== sibling.previous_state_hash
        || sceneOf(sibling.event) !== sceneOf(event) || !sibling.event?.event_id?.startsWith(prefix)
        || !list(turn.scheduled_events).includes(sibling.event.event_id)) return null;
  }
  const outcome = outcomeFor(turn, plan);
  return terminalMovement.has(outcome?.result) ? {plan, moved: outcome.result === "movement_completed"} : null;
}

export function planPanelRecheckSpeech({character, partner, display}) {
  const content = display?.content ?? "我現在還不能確認。";
  return {character, addressee: partner, purpose: "回報複查結果", mode: "direct",
    communication_opportunity: "respond", public_content: content,
    ...(display ? {claim_kind: "uncertain_hypothesis", claim_source_kind: "current_perception"} : {}),
    surface_realization: {schema_version: "cc5-mandarin-clause-request-v1", semantic_anchor: content,
      clause: display ? {topic: "我剛看了面板", subject: "現在的上限", predicate: "是", object: display.duration}
        : {subject: "我", predicate: "現在還不能確認"}}};
}
