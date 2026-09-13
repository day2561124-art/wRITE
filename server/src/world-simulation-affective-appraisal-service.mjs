import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationPostOutcomeSubjectivePerceptionVersion } from "./world-simulation-post-outcome-subjective-perception-service.mjs";

import { assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle } from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { buildWorldSimulationSubjectiveActionDeliberationView } from "./world-simulation-subjective-action-deliberation-service.mjs";

export const worldSimulationAffectiveActionAppraisalVersion = "phase86d-action-aware-affective-appraisal-v1";
export const worldSimulationAffectiveAppraisalVersion = "phase86a-goal-relative-affective-appraisal-v1";
export const worldSimulationAffectiveReappraisalVersion = "phase86c-experience-grounded-reappraisal-v1";
export const affectiveAppraisalMaxConcerns = 8;
export const affectiveAppraisalDimensions = Object.freeze({
  goal_congruence: Object.freeze(["helps", "hinders", "mixed", "unrelated", "uncertain"]),
  expectedness: Object.freeze(["expected", "unexpected", "uncertain"]),
  coping_potential: Object.freeze(["possible", "limited", "uncertain"]),
});
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const text = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
const key = (v) => String(v ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
function fail(message) { const error = new Error(message); error.code = "WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID"; throw error; }
function freeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const item of Object.values(v)) freeze(item); } return v; }
function verify(value, field) {
  if (!object(value) || !text(value[field])) fail("Missing appraisal source hash.");
  const body = clone(value); delete body[field];
  if (hashAgentRunValue(body) !== value[field]) fail("Appraisal source hash mismatch.");
}
function goals(packet) {
  return [...new Set((Array.isArray(packet.cognition?.goals) ? packet.cognition.goals : [])
    .map(text).filter((goal) => goal && goal.length <= 512))].slice(0, affectiveAppraisalMaxConcerns);
}

export function buildWorldSimulationAffectiveAppraisalContexts(input = {}) {
  return buildContexts(input);
}

// Canonical history is read once; arbitrary decision-packet emotional fields
// never establish earlier experiences or their provenance.
export function buildWorldSimulationAffectiveReappraisalContexts(input = {}) {
  const prior = readCommittedAppraisals({ world_history: input.world_history, current_turn_id: input.turn_id });
  return buildContexts(input, prior);
}

export function buildWorldSimulationActionAwareAffectiveContexts(input = {}) {
  if (!text(input.world_simulation_session_id) || input.world_history?.world_simulation_session_id !== input.world_simulation_session_id
    || !Array.isArray(input.world_history?.turns)) fail("Action appraisal cannot borrow another world's history.");
  const replayIndex = input.world_history.turns.findIndex(turn => turn.turn_id === input.turn_id);
  const priorTurns = replayIndex < 0 ? input.world_history.turns : input.world_history.turns.slice(0, replayIndex);
  if (priorTurns.some(turn => !Number.isSafeInteger(turn.revision_to) || turn.revision_to > input.state_revision)) fail("Action appraisal cannot use history beyond its decision snapshot.");
  const prior = readCommittedAppraisals({ world_history: input.world_history, current_turn_id: input.turn_id });
  return buildContexts(input, prior, committedActions(input));
}

// A receipt proves which listed intent was chosen; it does not prove execution,
// coping motivation, or effectiveness. Those must not be inferred from choice.
function committedActions(input) {
  if (!text(input.world_simulation_session_id) || !Number.isSafeInteger(input.state_revision)
    || input.state_revision < 0 || !text(input.world_state_hash) || !Array.isArray(input.selected_action_intents)) fail("Action appraisal requires canonical world and choice lineage.");
  const bundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(input.subjective_choice_commitment_receipts, {
    world_simulation_session_id: input.world_simulation_session_id, turn_id: input.turn_id,
    state_revision: input.state_revision, world_state_hash: input.world_state_hash,
  });
  const choices = new Map();
  for (const choice of input.selected_action_intents) {
    if (!text(choice?.character) || choices.has(key(choice.character))) fail("Ambiguous action selection owner.");
    choices.set(key(choice.character), choice);
  }
  if (choices.size !== bundle.receipts.length) fail("Action selections and receipts must cover the same characters.");
  const actions = new Map();
  const seen = new Set();
  for (const receipt of bundle.receipts) {
    const owner = key(receipt.character);
    const choice = choices.get(owner);
    if (seen.has(owner) || !choice || choice.selection !== receipt.selection_kind || choice.action_id !== receipt.action_id) fail("Action appraisal selection differs from its receipt.");
    seen.add(owner);
    if (receipt.selection_kind === "reject_all") continue;
    if (receipt.selection_kind !== "candidate_action_intent" || choice.candidate?.action_id !== choice.action_id
      || !text(choice.intent) || choice.intent !== choice.candidate.intent || choice.intent.length > 600) fail("Action intent requires the selected canonical candidate.");
    const view = buildWorldSimulationSubjectiveActionDeliberationView({ character: receipt.character, cognition: {}, candidate_action_intents: [choice.candidate] });
    if (view.action_options[0].action_ref !== receipt.action_ref) fail("Selected action content differs from its commitment.");
    actions.set(owner, { action_id: receipt.action_id, action_ref: receipt.action_ref,
      choice_receipt_id: receipt.receipt_id, choice_receipt_hash: receipt.receipt_hash,
      intent: choice.intent });
  }
  return actions;
}

function safeActionExperience(value) {
  return { intent: text(value?.intent), performed: typeof value?.performed === "boolean" ? value.performed : null,
    perceived_result: text(value?.perceived_result), perceived_status: text(value?.perceived_status),
    chosen_as_coping_established: false, actual_effectiveness_established: false };
}

function rememberedAppraisal(appraisal) {
  return { goal: appraisal.goal, goal_congruence: appraisal.goal_congruence,
    expectedness: appraisal.expectedness, coping_potential: appraisal.coping_potential,
    interpretation: appraisal.interpretation, historical_subjective_appraisal: true,
    current_mood_established: false, action_selection_implied: false,
    ...(appraisal.action_experience ? { action_experience: safeActionExperience(appraisal.action_experience) } : {}) };
}

// A replay scans history once. Context rebuilding reads at most eight entries
// per visible goal instead of rescanning the growing prefix for every turn.
function relevantAppraisals(prior, character, currentGoals) {
  const byGoal = prior.characters.get(key(character));
  const selected = [...currentGoals].map((goal) => byGoal?.get(goal)).filter(Boolean);
  return { entries: selected.flatMap((group) => group.entries)
    .sort((a, b) => a.order - b.order).map((item) => item.appraisal),
    total: selected.reduce((sum, group) => sum + group.total, 0) };
}

function rememberInIndex(prior, appraisal) {
  const character = key(appraisal.character);
  if (!prior.characters.has(character)) prior.characters.set(character, new Map());
  const byGoal = prior.characters.get(character);
  if (!byGoal.has(appraisal.goal)) byGoal.set(appraisal.goal, { entries: [], total: 0 });
  const group = byGoal.get(appraisal.goal);
  group.total++;
  group.entries.push({ order: prior.next_order++, appraisal });
  if (group.entries.length > affectiveContinuityMaxEntries) group.entries.shift();
}

function buildContexts(input, prior = null, actions = null) {
  const turn = text(input.turn_id);
  if (!turn || !Array.isArray(input.decision_packets)) fail("Appraisal requires a turn and native decision packets.");
  const source = input.post_outcome_subjective_perception;
  verify(source, "projection_hash");
  if (source.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
    || source.turn_id !== turn || !Array.isArray(source.character_experiences)
    || source.boundaries?.projection_is_subjective_observation_not_world_truth !== true
    || source.boundaries?.result_label_auto_exposure !== false) fail("Appraisal requires same-turn bounded Phase76A evidence.");
  const packets = new Map();
  for (const packet of input.decision_packets) {
    if (!text(packet?.character) || packets.has(key(packet.character))) fail("Ambiguous character packet.");
    packets.set(key(packet.character), packet);
  }
  const seen = new Set();
  const contexts = [];
  for (const experience of source.character_experiences) {
    const packet = packets.get(key(experience.character));
    if (!packet) fail("Subjective experience has no same-character decision packet.");
    if (seen.has(key(experience.character))) fail("Multiple same-turn experiences require explicit disambiguation.");
    seen.add(key(experience.character));
    if (experience.turn_id !== turn || experience.version !== source.version
      || !text(experience.subjective_perception_ref)
      || experience.objective_result_label_exposed !== false
      || experience.causal_evidence_exposed !== false
      || experience.other_character_private_state_exposed !== false
      || !object(experience.experience)) fail("Unbounded subjective experience.");
    const action = actions?.get(key(experience.character));
    if (actions !== null && (!action || action.action_id !== experience.action_id || action.action_id !== experience.experience.action_id)) fail("Subjective experience does not match the character's chosen action.");
    const concerns = goals(packet).map((goal, index) => ({
      concern_ref: "concern_" + hashAgentRunValue({ turn, character: packet.character, goal, index }).slice(0,24),
      goal,
    }));
    if (!concerns.length) continue;
    const body = { character: packet.character, turn_id: turn,
      source_perception_ref: experience.subjective_perception_ref,
      source_perception_projection_hash: source.projection_hash,
      subjective_experience: {
        performed: typeof experience.experience.performed === "boolean" ? experience.experience.performed : null,
        perceived_result: text(experience.experience.perceived_result),
        perceived_status: text(experience.experience.perceived_status),
      }, concerns };
    if (prior !== null) {
      body.prior_appraisals = relevantAppraisals(prior, packet.character, new Set(concerns.map((concern) => concern.goal))).entries
        .slice(-affectiveContinuityMaxEntries).map((entry) => ({
          prior_appraisal_ref: "prior_appraisal_" + entry.appraisal_hash.slice(0,24),
          ...rememberedAppraisal(entry),
        }));
    }
    if (actions !== null) body.selected_action = action;
    const context_hash = hashAgentRunValue(body);
    const context_ref = "affective_context_" + context_hash.slice(0,24);
    contexts.push({ ...body, context_hash, context_ref });
  }
  const body = { version: actions !== null ? worldSimulationAffectiveActionAppraisalVersion : prior === null ? worldSimulationAffectiveAppraisalVersion : worldSimulationAffectiveReappraisalVersion, turn_id: turn, contexts };
  return freeze({ ...body, bundle_hash: hashAgentRunValue(body) });
}

export function worldSimulationAffectiveAppraisalResolverViews(bundle) {
  verify(bundle, "bundle_hash");
  if (![worldSimulationAffectiveAppraisalVersion, worldSimulationAffectiveReappraisalVersion, worldSimulationAffectiveActionAppraisalVersion].includes(bundle.version) || !Array.isArray(bundle.contexts)) fail("Invalid appraisal context bundle.");
  const seen = new Set();
  for (const context of bundle.contexts) {
    const body = clone(context); delete body.context_ref; delete body.context_hash;
    if (context.turn_id !== bundle.turn_id || !text(context.character)
      || hashAgentRunValue(body) !== context.context_hash
      || context.context_ref !== "affective_context_" + context.context_hash.slice(0,24)
      || seen.has(key(context.character)) || !Array.isArray(context.concerns)
      || !context.concerns.length || context.concerns.length > affectiveAppraisalMaxConcerns) fail("Invalid appraisal context lineage.");
    seen.add(key(context.character));
    if (bundle.version !== worldSimulationAffectiveAppraisalVersion) {
      if (!Array.isArray(context.prior_appraisals) || context.prior_appraisals.length > affectiveContinuityMaxEntries) fail("Unbounded reappraisal history.");
      const refs = new Set();
      for (const prior of context.prior_appraisals) {
        if (!object(prior) || !/^prior_appraisal_[a-f0-9]{24}$/.test(prior.prior_appraisal_ref)
          || refs.has(prior.prior_appraisal_ref) || !context.concerns.some((concern) => concern.goal === prior.goal)
          || !text(prior.interpretation) || prior.interpretation.length > 512
          || Object.keys(prior).sort().join() !== ["prior_appraisal_ref", ...Object.keys(rememberedAppraisal(prior))].sort().join()
          || prior.historical_subjective_appraisal !== true || prior.current_mood_established !== false || prior.action_selection_implied !== false
          || Object.entries(affectiveAppraisalDimensions).some(([dimension, allowed]) => !allowed.includes(prior[dimension]))) fail("Invalid prior appraisal context.");
        if (Object.hasOwn(prior, "action_experience") && (!text(prior.action_experience?.intent)
          || prior.action_experience.intent.length > 600
          || hashAgentRunValue(prior.action_experience) !== hashAgentRunValue(safeActionExperience(prior.action_experience)))) fail("Unbounded historical action experience.");
        refs.add(prior.prior_appraisal_ref);
      }
    } else if (context.prior_appraisals !== undefined) fail("Legacy appraisal cannot assert reappraisal evidence.");
    if (bundle.version === worldSimulationAffectiveActionAppraisalVersion) {
      if (!object(context.selected_action) || !text(context.selected_action.intent) || context.selected_action.intent.length > 600
        || !text(context.selected_action.choice_receipt_hash) || !text(context.selected_action.action_ref)) fail("Missing action commitment context.");
    } else if (context.selected_action !== undefined) fail("Legacy appraisal cannot assert action commitment context.");
    for (const [index, concern] of context.concerns.entries()) {
      if (!text(concern.goal) || concern.goal.length > 512
        || concern.concern_ref !== "concern_" + hashAgentRunValue({ turn: bundle.turn_id, character: context.character, goal: concern.goal, index }).slice(0,24)) fail("Invalid concern lineage.");
    }
  }
  return freeze(bundle.contexts.map((context) => ({
    context_ref: context.context_ref, character: context.character,
    subjective_experience: {
      performed: typeof context.subjective_experience?.performed === "boolean" ? context.subjective_experience.performed : null,
      perceived_result: text(context.subjective_experience?.perceived_result),
      perceived_status: text(context.subjective_experience?.perceived_status),
    }, concerns: context.concerns.map(({ concern_ref, goal }) => ({ concern_ref, goal })),
    ...(bundle.version !== worldSimulationAffectiveAppraisalVersion ? { prior_appraisals: clone(context.prior_appraisals) } : {}),
    ...(bundle.version === worldSimulationAffectiveActionAppraisalVersion ? { selected_action: { intent: context.selected_action.intent } } : {}),
    allowed_dimensions: clone(affectiveAppraisalDimensions),
    boundaries: { subjective_appraisal_only: true, emotion_label_inferred: false,
      numerical_intensity_allowed: false, action_selection_allowed: false, world_truth_authority: false },
  })));
}

export function projectWorldSimulationAffectiveAppraisals(input = {}) {
  const bundle = input.context_bundle;
  worldSimulationAffectiveAppraisalResolverViews(bundle);
  if (!Array.isArray(input.decisions)) fail("Appraisal decisions must be an array.");
  const byRef = new Map(bundle.contexts.map((context) => [context.context_ref, context]));
  const seen = new Set();
  const appraisals = [];
  const fields = new Set(["context_ref", "concern_ref", "goal_congruence", "expectedness", "coping_potential", "interpretation"]);
  if (bundle.version !== worldSimulationAffectiveAppraisalVersion) fields.add("reappraises_ref");
  for (const decision of input.decisions) {
    if (!object(decision) || Object.keys(decision).some((field) => !fields.has(field))) fail("Unsupported appraisal decision fields.");
    const context = byRef.get(decision.context_ref);
    const concern = context?.concerns.find((item) => item.concern_ref === decision.concern_ref);
    if (!context || !concern) fail("Appraisal references another context or character's concern.");
    if (Object.hasOwn(decision, "reappraises_ref") && !context.prior_appraisals?.some((entry) =>
      entry.prior_appraisal_ref === decision.reappraises_ref && entry.goal === concern.goal)) fail("Reappraisal must reference this character's earlier appraisal of the same goal.");
    const identity = context.context_ref + ":" + concern.concern_ref;
    if (seen.has(identity)) fail("Duplicate appraisal for the same experience and concern.");
    seen.add(identity);
    for (const [dimension, allowed] of Object.entries(affectiveAppraisalDimensions)) {
      if (!allowed.includes(decision[dimension])) fail("Unsupported appraisal dimension.");
    }
    const interpretation = text(decision.interpretation);
    if (!interpretation || interpretation.length > 512) fail("A bounded subjective interpretation is required.");
    const body = { version: bundle.version, character: context.character,
      source_turn_id: bundle.turn_id, source_context_ref: context.context_ref, source_context_hash: context.context_hash,
      source_perception_ref: context.source_perception_ref,
      source_perception_projection_hash: context.source_perception_projection_hash,
      concern_ref: concern.concern_ref, goal: concern.goal,
      goal_congruence: decision.goal_congruence, expectedness: decision.expectedness,
      coping_potential: decision.coping_potential, interpretation,
      ...(Object.hasOwn(decision, "reappraises_ref") ? { reappraises_ref: decision.reappraises_ref } : {}),
      ...(bundle.version === worldSimulationAffectiveActionAppraisalVersion ? {
        source_choice_receipt_hash: context.selected_action.choice_receipt_hash,
        action_experience: safeActionExperience({ ...context.subjective_experience, intent: context.selected_action.intent }),
      } : {}),
      subjective_not_world_truth: true, objective_emotion_label_established: false,
      current_mood_established: false, action_selection_applied: false };
    appraisals.push({ ...body, appraisal_hash: hashAgentRunValue(body) });
  }
  appraisals.sort((a,b)=>a.source_context_ref.localeCompare(b.source_context_ref)||a.concern_ref.localeCompare(b.concern_ref));
  const body = { version: bundle.version, turn_id: bundle.turn_id,
    source_bundle_hash: bundle.bundle_hash, appraisals,
    audit: { same_character_concerns_required: true, automatic_emotion_labeling: false,
      numeric_intensity_modeled: false, world_state_mutated: false, action_selection_applied: false } };
  return freeze({ ...body, projection_hash: hashAgentRunValue(body) });
}

export const worldSimulationAffectiveContinuityVersion = "phase86b-committed-affective-continuity-v1";
export const affectiveContinuityMaxEntries = 8;

// Read committed history, preserving historical appraisals as remembered
// subjective meaning. This does not establish the character's current mood.
export function projectWorldSimulationAffectiveContinuity(input = {}) {
  if (!Array.isArray(input.world_history?.turns) || !text(input.character) || !text(input.current_turn_id)) fail("Affective continuity requires committed history and character identity.");
  const currentGoals = new Set(goals({ cognition: { goals: input.current_goals } }));
  const selected = relevantAppraisals(readCommittedAppraisals(input), input.character, currentGoals);
  const entries = selected.entries.map(rememberedAppraisal);
  return freeze({ source: "committed_goal_relative_affective_history",
    recent_appraisals: entries.slice(-affectiveContinuityMaxEntries),
    truncated: selected.total > affectiveContinuityMaxEntries,
    current_mood_established: false, historical_appraisal_is_current_fact: false });
}

function readCommittedAppraisals(input) {
  if (!Array.isArray(input.world_history?.turns) || !text(input.current_turn_id)) fail("Reappraisal requires canonical history and a turn boundary.");
  const entries = { characters: new Map(), next_order: 0 };
  const seenTurns = new Set();
  let previousRevision = -1;
  // If replaying a known turn, its committed successors are future evidence.
  const replayIndex = input.world_history.turns.findIndex((turn) => turn.turn_id === input.current_turn_id);
  const replayRevision = replayIndex < 0 ? Infinity : input.world_history.turns[replayIndex].revision_to;
  if (replayIndex >= 0 && !Number.isSafeInteger(replayRevision)) fail("Historical replay needs a canonical revision boundary.");
  const priorTurns = replayIndex < 0 ? input.world_history.turns : input.world_history.turns.slice(0, replayIndex);
  for (const turn of priorTurns) {
    if (turn.affective_appraisal_record === null || turn.affective_appraisal_record === undefined) continue;
    if (!object(turn.affective_appraisal_record)) fail("Malformed committed appraisal record.");
    if (!text(turn.turn_id) || !text(turn.committed_at) || !Number.isSafeInteger(turn.revision_to)
      || turn.revision_to !== turn.revision_from + 1 || turn.revision_to <= previousRevision || turn.revision_to >= replayRevision || seenTurns.has(turn.turn_id)) fail("Affective history lacks unique committed turn lineage.");
    seenTurns.add(turn.turn_id);
    previousRevision = turn.revision_to;
    const record = turn.affective_appraisal_record;
    const bundle = record.context_bundle;
    worldSimulationAffectiveAppraisalResolverViews(bundle);
    if (bundle.turn_id !== turn.turn_id) fail("Affective history crosses turn boundaries.");
    const source = turn.post_outcome_subjective_perception_projection;
    const rebuiltBundle = buildContexts({ turn_id: turn.turn_id,
      decision_packets: (source?.character_experiences ?? []).map((experience) => ({ character: bundle.contexts.find((context) => key(context.character) === key(experience.character))?.character ?? experience.character,
        cognition: { goals: bundle.contexts.find((context) => key(context.character) === key(experience.character))?.concerns.map((concern) => concern.goal) ?? [] } })),
      post_outcome_subjective_perception: source }, bundle.version !== worldSimulationAffectiveAppraisalVersion ? entries : null,
      bundle.version === worldSimulationAffectiveActionAppraisalVersion ? committedActions({
        world_simulation_session_id: input.world_history.world_simulation_session_id, turn_id: turn.turn_id,
        state_revision: turn.revision_from, world_state_hash: turn.previous_state_hash,
        selected_action_intents: turn.selected_action_intents,
        subjective_choice_commitment_receipts: turn.subjective_choice_commitment_receipts,
      }) : null);
    if (rebuiltBundle.bundle_hash !== bundle.bundle_hash) fail("Affective history is detached from its committed subjective perception.");
    verify(record.projection, "projection_hash");
    if (!Array.isArray(record.projection.appraisals)) fail("Invalid persisted appraisals.");
    const rebuilt = projectWorldSimulationAffectiveAppraisals({ context_bundle: bundle,
      decisions: record.projection.appraisals.map((entry) => ({ context_ref: entry.source_context_ref,
        concern_ref: entry.concern_ref, goal_congruence: entry.goal_congruence,
        expectedness: entry.expectedness, coping_potential: entry.coping_potential,
        interpretation: entry.interpretation,
        ...(Object.hasOwn(entry, "reappraises_ref") ? { reappraises_ref: entry.reappraises_ref } : {}) })) });
    if (rebuilt.projection_hash !== record.projection.projection_hash) fail("Persisted appraisal content does not match its canonical context.");
    for (const appraisal of rebuilt.appraisals) rememberInIndex(entries, appraisal);
  }
  return entries;
}
