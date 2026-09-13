import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationAffectiveContinuity } from "./world-simulation-affective-appraisal-service.mjs";
import { assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle } from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { buildWorldSimulationSubjectiveActionDeliberationView } from "./world-simulation-subjective-action-deliberation-service.mjs";
import { worldSimulationPostOutcomeSubjectivePerceptionVersion } from "./world-simulation-post-outcome-subjective-perception-service.mjs";

export const worldSimulationCopingIntentionVersion = "phase86e-explicit-coping-intention-v1";
export const copingStrategies = Object.freeze(["seek_information", "change_situation", "regulate_response", "seek_support", "wait_and_monitor"]);
const limit = 8;
const text = value => typeof value === "string" && value.trim() ? value.trim() : null;
const key = value => String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
const object = value => value && typeof value === "object" && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function fail(message) { const error = new Error(message); error.code = "WORLD_SIMULATION_COPING_INTENTION_INVALID"; throw error; }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function verify(value, field) { if (!object(value) || !text(value[field])) fail("Missing coping record hash."); const body = clone(value); delete body[field]; if (hashAgentRunValue(body) !== value[field]) fail("Coping record hash mismatch."); }
function goals(value) { return [...new Set((Array.isArray(value) ? value : []).map(text).filter(v => v && v.length <= 512))].slice(0, limit); }
function priorTurns(input) {
  if (!text(input.character) || !text(input.current_turn_id) || !text(input.world_history?.world_simulation_session_id) || !Array.isArray(input.world_history.turns)) fail("Coping requires character identity and committed world history.");
  const all = input.world_history.turns;
  const index = all.findIndex(turn => turn.turn_id === input.current_turn_id);
  const boundary = index < 0 ? Infinity : all[index].revision_to;
  const prior = index < 0 ? all : all.slice(0, index);
  let previous = -1; const seen = new Set();
  for (const turn of prior) {
    if (!text(turn.turn_id) || !text(turn.committed_at) || !Number.isSafeInteger(turn.revision_to)
      || turn.revision_to !== turn.revision_from + 1 || turn.revision_to <= previous || turn.revision_to >= boundary || seen.has(turn.turn_id)) fail("Coping history must preserve committed chronology.");
    seen.add(turn.turn_id); previous = turn.revision_to;
  }
  return prior;
}

export function buildWorldSimulationCopingChoiceContext(input = {}) {
  priorTurns(input);
  const currentGoals = goals(input.current_goals);
  const continuity = projectWorldSimulationAffectiveContinuity({ ...input, current_goals: currentGoals });
  const body = { version: worldSimulationCopingIntentionVersion, world_simulation_session_id: input.world_history.world_simulation_session_id,
    turn_id: input.current_turn_id, character: input.character, goals: currentGoals, appraisals: continuity.recent_appraisals };
  const context_hash = hashAgentRunValue(body);
  return freeze({ context_hash, source_goals: currentGoals, character_view: {
    appraisals: body.appraisals.map((entry, index) => ({ appraisal_ref: "coping_appraisal_" + hashAgentRunValue({ context_hash, index }).slice(0,24), ...entry })),
    response_contract: { optional_field: "coping_intention", fields: ["appraisal_ref", "strategy", "reason", "desired_change"], allowed_strategies: copingStrategies,
      selected_action_required: true, maximum_text_characters: 400, omission_means_no_stated_coping_intention: true },
    self_reported_intention_only: true, automatic_action_selection: false,
  } });
}
function decision(context, raw) {
  const fields = ["appraisal_ref", "strategy", "reason", "desired_change"];
  if (!object(raw) || Object.keys(raw).some(field => !fields.includes(field))) fail("Unsupported coping intention fields.");
  const appraisal = context.character_view.appraisals.find(entry => entry.appraisal_ref === raw.appraisal_ref);
  if (!appraisal || !copingStrategies.includes(raw.strategy)) fail("Coping intention must refer to an available own appraisal and strategy.");
  for (const field of ["reason", "desired_change"]) if (!text(raw[field]) || raw[field].trim().length > 400) fail("Coping intention needs bounded reason and desired change.");
  return { appraisal_ref: raw.appraisal_ref, goal: appraisal.goal, strategy: raw.strategy, reason: raw.reason.trim(), desired_change: raw.desired_change.trim() };
}
function selectedReceipt(input, character) {
  const bundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(input.subjective_choice_commitment_receipts, {
    world_simulation_session_id: input.world_simulation_session_id, turn_id: input.turn_id, state_revision: input.state_revision, world_state_hash: input.world_state_hash });
  const receipts = bundle.receipts.filter(entry => key(entry.character) === key(character));
  const selected = (input.selected_action_intents ?? []).filter(entry => key(entry.character) === key(character));
  if (receipts.length !== 1 || selected.length !== 1) fail("Coping requires one selected action and commitment for its character.");
  const receipt = receipts[0], choice = selected[0];
  if (receipt.selection_kind !== "candidate_action_intent" || choice.selection !== receipt.selection_kind
    || choice.action_id !== receipt.action_id || choice.candidate?.action_id !== choice.action_id || !text(choice.intent) || choice.intent !== choice.candidate.intent) fail("Rejecting all actions cannot claim a chosen coping action.");
  const view = buildWorldSimulationSubjectiveActionDeliberationView({ character, cognition: {}, candidate_action_intents: [choice.candidate] });
  if (view.action_options[0].action_ref !== receipt.action_ref) fail("Coping action differs from its choice commitment.");
  return { receipt, choice };
}
function recordFor(input, character, currentGoals, raw) {
  const context = buildWorldSimulationCopingChoiceContext({ world_history: input.world_history, character, current_turn_id: input.turn_id, current_goals: currentGoals });
  const intention = decision(context, raw);
  const { receipt, choice } = selectedReceipt(input, character);
  const body = { version: worldSimulationCopingIntentionVersion, character, source_goals: context.source_goals,
    source_context_hash: context.context_hash, source_choice_receipt_hash: receipt.receipt_hash,
    action_id: receipt.action_id, action_intent: choice.intent, ...intention,
    self_reported_intention: true, intention_recorded_before_outcome: true, effectiveness_established: false, plan_lifecycle_changed: false };
  return { ...body, record_hash: hashAgentRunValue(body) };
}

export function buildWorldSimulationCopingIntentionCommitments(input = {}) {
  if (input.world_history?.world_simulation_session_id !== input.world_simulation_session_id || !Number.isSafeInteger(input.state_revision) || input.state_revision < 0 || !text(input.turn_id) || !text(input.world_state_hash)) fail("Coping commitment requires the same world snapshot.");
  if (!Array.isArray(input.decision_packets) || !object(input.responses)) fail("Coping commitment requires native packets and character responses.");
  const records = [], seen = new Set();
  for (const packet of input.decision_packets) {
    if (!text(packet?.character) || seen.has(key(packet.character))) fail("Ambiguous coping character packet.");
    seen.add(key(packet.character));
    const matches = Object.entries(input.responses).filter(([name]) => key(name) === key(packet.character));
    if (matches.length > 1) fail("Ambiguous coping response owner.");
    const response = matches[0]?.[1];
    if (!object(response) || !Object.hasOwn(response, "coping_intention")) continue;
    if (priorTurns({ world_history: input.world_history, character: packet.character, current_turn_id: input.turn_id }).some(turn => turn.revision_to > input.state_revision)) fail("Coping cannot use future decision evidence.");
    const selected = input.selected_action_intents?.find(choice => key(choice.character) === key(packet.character));
    if (text(response.action_id ?? response.id) !== selected?.action_id) fail("Coping response must accompany the same selected action.");
    records.push(recordFor(input, packet.character, packet.cognition?.goals, response.coping_intention));
  }
  const body = { version: worldSimulationCopingIntentionVersion, world_simulation_session_id: input.world_simulation_session_id,
    turn_id: input.turn_id, state_revision: input.state_revision, world_state_hash: input.world_state_hash, records };
  return freeze({ ...body, bundle_hash: hashAgentRunValue(body) });
}

// At most eight remembered commitments are fully revalidated. Each appraisal
// context rebuild is a linear history scan; there is no recursive coping replay.
export function projectWorldSimulationCopingContinuity(input = {}) {
  const selected = [], currentGoals = new Set(goals(input.current_goals));
  for (const turn of priorTurns(input)) {
    const bundle = turn.coping_intention_commitments;
    if (bundle === null || bundle === undefined) continue;
    verify(bundle, "bundle_hash");
    if (bundle.version !== worldSimulationCopingIntentionVersion || bundle.turn_id !== turn.turn_id
      || bundle.world_simulation_session_id !== input.world_history.world_simulation_session_id
      || bundle.state_revision !== turn.revision_from || bundle.world_state_hash !== turn.previous_state_hash || !Array.isArray(bundle.records)) fail("Coping history crosses its commit boundary.");
    const seen = new Set();
    for (const record of bundle.records) {
      verify(record, "record_hash");
      if (!text(record.character) || seen.has(key(record.character))) fail("Duplicate coping history owner.");
      seen.add(key(record.character));
      if (key(record.character) === key(input.character) && currentGoals.has(record.goal)) selected.push({ turn, record });
    }
  }
  const recent = selected.slice(-limit).map(({ turn, record }) => {
    const rebuilt = recordFor({ world_history: input.world_history, world_simulation_session_id: input.world_history.world_simulation_session_id,
      turn_id: turn.turn_id, state_revision: turn.revision_from, world_state_hash: turn.previous_state_hash,
      selected_action_intents: turn.selected_action_intents, subjective_choice_commitment_receipts: turn.subjective_choice_commitment_receipts }, record.character, record.source_goals,
      { appraisal_ref: record.appraisal_ref, strategy: record.strategy, reason: record.reason, desired_change: record.desired_change });
    if (rebuilt.record_hash !== record.record_hash) fail("Coping history does not match its original appraisal and choice.");
    const source = turn.post_outcome_subjective_perception_projection;
    verify(source, "projection_hash");
    if (source.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion || source.turn_id !== turn.turn_id
      || source.boundaries?.projection_is_subjective_observation_not_world_truth !== true
      || source.boundaries?.result_label_auto_exposure !== false || !Array.isArray(source.character_experiences)) fail("Coping outcome requires bounded subjective perception.");
    const matches = source.character_experiences.filter(entry => key(entry.character) === key(record.character));
    if (matches.length > 1) fail("Ambiguous coping action experience.");
    const experience = matches[0];
    if (experience && (experience.action_id !== record.action_id || experience.experience?.action_id !== record.action_id
      || experience.turn_id !== turn.turn_id || experience.objective_result_label_exposed !== false
      || experience.other_character_private_state_exposed !== false || experience.causal_evidence_exposed !== false)) fail("Coping experience belongs to another action.");
    return { goal: record.goal, strategy: record.strategy, reason: record.reason, desired_change: record.desired_change,
      action_intent: record.action_intent, subjective_result: experience ? {
        performed: typeof experience.experience.performed === "boolean" ? experience.experience.performed : null,
        perceived_result: text(experience.experience.perceived_result), perceived_status: text(experience.experience.perceived_status),
      } : null, self_reported_intention: true, effectiveness_established: false, plan_lifecycle_changed: false };
  });
  return freeze({ recent_intentions: recent, truncated: selected.length > limit, effectiveness_established: false });
}
