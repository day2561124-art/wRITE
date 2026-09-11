import {
  projectWorldSimulationCounterfactualReflectionReentry,
  worldSimulationCounterfactualReflectionReentryVersion,
} from "./world-simulation-counterfactual-reflection-reentry-service.mjs";

export const worldSimulationCounterfactualReflectionReentryAdoptionVersion =
  "phase81d-r1-counterfactual-reflection-reentry-native-adoption-v1";
export const counterfactualReflectionReminderCharacterViewVersion =
  "phase81d-r1-counterfactual-reflection-reminder-character-view-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function uniqueText(values) {
  return [...new Set(array(values).map(text).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "en"));
}

function assertCharacterInput(characterInput) {
  const input = cloneJson(characterInput);
  if (!isObject(input)
      || !text(input.character)
      || !isObject(input.cognition)
      || !Array.isArray(input.candidate_action_intents)
      || !isObject(input.subjective_action_deliberation)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_ADOPTION_INPUT_INVALID",
      "Phase81D-R1 requires the final bounded Character Brain input with canonical Phase74A deliberation.",
    );
  }
  return input;
}

function reminderFromCandidate(candidate) {
  return {
    current_action_id: candidate.current_action_id,
    historical_actual_selected_action_id:
      candidate.historical_actual_selected_action_id,
    historical_imagined_alternative_action_id:
      candidate.historical_imagined_alternative_action_id,
    historical_comparison_direction:
      candidate.historical_comparison_direction,
    historical_appraisal_kind:
      candidate.historical_appraisal_kind,
    historical_preparative_orientation:
      candidate.historical_preparative_orientation,
    matched_cue_kinds: uniqueText(
      candidate.exact_current_cue_matches.map((match) => match?.cue_kind),
    ),
    current_context_difference_present:
      candidate.current_context_difference_present === true,
    historical_counterfactual_is_candidate_evidence_only: true,
    historical_counterfactual_is_episodic_fact_memory: false,
    historical_alternative_was_experienced: false,
    historical_unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    causal_superiority_inferred: false,
    source_monitoring: {
      actual_anchor_source: "experienced_subjective_outcome",
      alternative_source: "imagined_decision_time_possibility",
      appraisal_source: "subjective_counterfactual_reflection",
      reminder_source: "prior_committed_counterfactual_reflection_reentry",
      sources_may_not_be_collapsed: true,
    },
  };
}

export function buildWorldSimulationCounterfactualReflectionReentryAdoptionContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualReflectionReentryAdoptionVersion,
    phase: "Phase81D-R1",
    status: "native_counterfactual_reflection_reentry_adoption_installed",
    source_projection_owner: "Phase81D",
    final_character_brain_phase74a_required: true,
    action_proposer_candidates_must_preexist: true,
    reentry_does_not_generate_action_candidates: true,
    reentry_does_not_mutate_base_cognition: true,
    engine_projection_character_facing: false,
    character_facing_reminder_is_sanitized: true,
    engine_session_turn_revision_hash_ref_metadata_exposed: false,
    reminder_is_advisory_only: true,
    automatic_preference_revision_allowed: false,
    automatic_action_selection_allowed: false,
    automatic_belief_revision_allowed: false,
    semantic_revision_allowed: false,
    world_truth_authority: false,
  });
}

export function assertWorldSimulationCounterfactualReflectionReminderCharacterView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== counterfactualReflectionReminderCharacterViewVersion
      || view.source !== "prior_committed_counterfactual_reflection_reentry"
      || !Number.isSafeInteger(view.reminder_count)
      || view.reminder_count < 0
      || !Array.isArray(view.reminders)
      || view.reminder_count !== view.reminders.length
      || view.advisory_only !== true
      || view.candidate_generation_authority !== false
      || view.preference_revision_authority !== false
      || view.action_selection_authority !== false
      || view.belief_revision_authority !== false
      || view.semantic_revision_authority !== false
      || view.world_truth_authority !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CHARACTER_VIEW_INVALID",
      "Phase81D-R1 character-facing reminder view violates its bounded authority contract.",
    );
  }
  for (const reminder of view.reminders) {
    if (!isObject(reminder)
        || !text(reminder.current_action_id)
        || !text(reminder.historical_actual_selected_action_id)
        || !text(reminder.historical_imagined_alternative_action_id)
        || !text(reminder.historical_comparison_direction)
        || !text(reminder.historical_appraisal_kind)
        || !text(reminder.historical_preparative_orientation)
        || !Array.isArray(reminder.matched_cue_kinds)
        || reminder.matched_cue_kinds.length === 0
        || reminder.matched_cue_kinds.some((kind) => !text(kind))
        || new Set(reminder.matched_cue_kinds).size !== reminder.matched_cue_kinds.length
        || reminder.historical_counterfactual_is_candidate_evidence_only !== true
        || reminder.historical_counterfactual_is_episodic_fact_memory !== false
        || reminder.historical_alternative_was_experienced !== false
        || reminder.historical_unchosen_outcome_observed !== false
        || reminder.counterfactual_world_truth_claimed !== false
        || reminder.causal_superiority_inferred !== false
        || !isObject(reminder.source_monitoring)
        || reminder.source_monitoring.actual_anchor_source !== "experienced_subjective_outcome"
        || reminder.source_monitoring.alternative_source !== "imagined_decision_time_possibility"
        || reminder.source_monitoring.appraisal_source !== "subjective_counterfactual_reflection"
        || reminder.source_monitoring.reminder_source
          !== "prior_committed_counterfactual_reflection_reentry"
        || reminder.source_monitoring.sources_may_not_be_collapsed !== true) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CHARACTER_VIEW_INVALID",
        "Phase81D-R1 character-facing reminder contains invalid or authority-bearing content.",
      );
    }
  }

  const serialized = JSON.stringify(view);
  const forbiddenFragments = [
    "world_simulation_session_id",
    "current_turn_id",
    "state_revision",
    "world_state_hash",
    "projection_hash",
    "source_turn_id",
    "source_revision_to",
    "source_phase81",
    "capsule_ref",
    "capsule_hash",
    "reentry_candidate_ref",
    "reentry_candidate_hash",
    "current_action_ref",
    "historical_actual_selected_action_ref",
    "historical_imagined_alternative_action_ref",
  ];
  if (forbiddenFragments.some((fragment) => serialized.includes(fragment))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_CHARACTER_VIEW_PRIVATE_LINEAGE",
      "Phase81D-R1 character-facing reminder exposed engine-only lineage metadata.",
    );
  }
  return Object.freeze(view);
}

export function adoptWorldSimulationCounterfactualReflectionReentry(input = {}) {
  const characterInput = assertCharacterInput(input.character_input);
  const projection = projectWorldSimulationCounterfactualReflectionReentry({
    world_simulation_session_id: input.world_simulation_session_id,
    character: characterInput.character,
    current_turn_id: input.current_turn_id,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: input.current_world_state_hash,
    current_cognition: characterInput.cognition,
    current_candidate_action_intents: characterInput.candidate_action_intents,
    source_phase74a_deliberation: characterInput.subjective_action_deliberation,
    world_history: input.world_history,
  });

  const characterView = assertWorldSimulationCounterfactualReflectionReminderCharacterView({
    version: counterfactualReflectionReminderCharacterViewVersion,
    source: "prior_committed_counterfactual_reflection_reentry",
    reminder_count: projection.reentry_candidate_count,
    reminders: projection.reentry_candidates.map(reminderFromCandidate),
    advisory_only: true,
    candidate_generation_authority: false,
    preference_revision_authority: false,
    action_selection_authority: false,
    belief_revision_authority: false,
    semantic_revision_authority: false,
    world_truth_authority: false,
  });

  return Object.freeze({
    version: worldSimulationCounterfactualReflectionReentryAdoptionVersion,
    phase: "Phase81D-R1",
    source_projection_version: worldSimulationCounterfactualReflectionReentryVersion,
    projection,
    character_view: characterView,
    audit: Object.freeze({
      final_character_brain_phase74a_verified: true,
      action_candidates_preexisted_reentry: true,
      base_cognition_mutated: false,
      engine_projection_forwarded_to_character_brain: false,
      character_view_sanitized: true,
      imagined_alternative_preserved_as_counterfactual: true,
      automatic_preference_action_belief_revision: false,
      semantic_revision_performed: false,
      world_truth_authority_exposed: false,
    }),
  });
}
