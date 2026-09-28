import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  planCharacterCommunication,
} from "./character-communication-foundation-service.mjs";
import {
  buildWorldSimulationSubjectiveProspectiveConsequenceView,
} from "./world-simulation-subjective-prospective-consequence-service.mjs";
import {
  buildWorldSimulationSubjectiveCrossOptionPreferenceView,
} from "./world-simulation-subjective-cross-option-preference-service.mjs";
import {
  worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
} from "./world-simulation-effective-action-commitment-character-exposure-service.mjs";
import {
  buildWorldSimulationActionCommitmentReconsiderationEvidence,
} from "./world-simulation-action-commitment-reconsideration-evidence-service.mjs";
import {
  worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion,
} from "./world-simulation-action-commitment-subjective-execution-experience-service.mjs";
import {
  buildWorldSimulationActionCommitmentExperienceGroundedReconsideration,
} from "./world-simulation-action-commitment-experience-grounded-reconsideration-service.mjs";
import {
  assertWorldSimulationBodyToBrainSensoryEvidence,
} from "./world-simulation-body-brain-contract-service.mjs";
import {
  readCommittedWorldSimulationBodyInteroceptiveSignals,
  worldSimulationBodyInteroceptiveSignalVersion,
} from "./world-simulation-body-interoceptive-signal-service.mjs";
import { worldSimulationBodySpeechEffectorFeedbackVersion } from "./world-simulation-body-speech-effector-feedback-service.mjs";
import {
  readCommittedWorldSimulationBodyProprioceptiveFeedback,
  worldSimulationBodyProprioceptiveFeedbackVersion,
} from "./world-simulation-body-proprioceptive-feedback-service.mjs";
import {
  readCommittedWorldSimulationBodyVestibularFeedback,
  worldSimulationBodyVestibularFeedbackVersion,
} from "./world-simulation-body-vestibular-feedback-service.mjs";

export const worldSimulationCharacterBrainInputVersion =
  "character-runtime-v5-working-memory-output-gating-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function isRecoveredMemoryMindItem(value) {
  return isObject(value)
    && value.context_origin === "recovered_memory";
}

function withoutRecoveredMemoryAttentionDuplicates(attention) {
  if (!isObject(attention)) return cloneJson(attention ?? null);
  const projected = cloneJson(attention);
  if (isRecoveredMemoryMindItem(projected.focus)) {
    projected.focus = null;
  }
  for (const key of [
    "active_context",
    "peripheral_context",
    "fading_context",
    "suspended_context",
  ]) {
    if (!Object.hasOwn(projected, key)) continue;
    projected[key] = array(projected[key])
      .filter((item) => !isRecoveredMemoryMindItem(item));
  }
  return projected;
}

function workingContextSemanticKeys(workingContext) {
  if (!isObject(workingContext)) return new Set();
  return new Set([
    workingContext.focus,
    ...array(workingContext.active_context),
    ...array(workingContext.peripheral_context),
    ...array(workingContext.fading_context),
    ...array(workingContext.suspended_context),
  ]
    .filter(Boolean)
    .map((item) => JSON.stringify(item)));
}

function withoutOutputClosedAttention(attention, workingContext) {
  if (!isObject(attention)) return cloneJson(attention ?? null);
  const allowed = workingContextSemanticKeys(workingContext);
  const projected = cloneJson(attention);
  const isAllowed = (item) => Boolean(item)
    && allowed.has(JSON.stringify(item));
  if (!isAllowed(projected.focus)) projected.focus = null;
  for (const key of [
    "active_context",
    "peripheral_context",
    "fading_context",
    "suspended_context",
  ]) {
    if (!Object.hasOwn(projected, key)) continue;
    projected[key] = array(projected[key]).filter(isAllowed);
  }
  return projected;
}

function characterBrainCognition(packet, recollectionV3, outputGatingV5) {
  const cognition = isObject(packet.cognition)
    ? cloneJson(packet.cognition)
    : {};
  if (!recollectionV3 && !outputGatingV5) return cognition;

  if (!isObject(cognition.working_context)) {
    const error = new Error(
      outputGatingV5
        ? "Character Runtime v5 output gating requires Runtime-owned cognition.working_context."
        : "Character Runtime v3 recollection ingress requires Runtime-owned cognition.working_context.",
    );
    error.code = outputGatingV5
      ? "WORLD_SIMULATION_WORKING_MEMORY_OUTPUT_GATE_CONTEXT_REQUIRED"
      : "WORLD_SIMULATION_RECOLLECTION_CURRENT_MIND_REQUIRED";
    throw error;
  }

  if (outputGatingV5 && Object.hasOwn(cognition, "attention")) {
    cognition.attention = withoutOutputClosedAttention(
      cognition.attention,
      cognition.working_context,
    );
  }

  if (!recollectionV3) return cognition;

  // Phase63C recovered content may exist in several internal plumbing layers,
  // but Character Brain sees that semantic content only through the Runtime
  // Current Mind working context. Retrieval process state remains top-level.
  delete cognition.recovered_memories;
  delete cognition.retrieved_memories;
  delete cognition.projected_memories;
  delete cognition.retrieval_experience;
  if (Object.hasOwn(cognition, "attention")) {
    cognition.attention = withoutRecoveredMemoryAttentionDuplicates(
      cognition.attention,
    );
  }
  return cognition;
}

const PROPRIOCEPTIVE_FEEDBACK_KEYS = new Set([
  "modality", "signal", "source_world_revision",
  "exact_world_position_exposed", "exact_displacement_exposed",
  "world_axis_direction_exposed", "subjective_movement_belief_asserted",
]);
function boundedCommittedProprioception(projection, character) {
  const source = isObject(projection) ? projection : {};
  const position = isObject(source.position_sense) ? source.position_sense : {};
  const boundaries = isObject(source.boundaries) ? source.boundaries : {};
  if (source.version !== worldSimulationBodyProprioceptiveFeedbackVersion
      || source.authority !== "committed_world_body_state_and_history"
      || source.character !== character
      || !Number.isSafeInteger(source.source_world_revision)
      || source.source_world_revision < 0
      || !Array.isArray(source.movement_feedback)
      || source.movement_feedback.length > 32
      || Object.keys(position).some((key) =>
        !["status", "exact_world_position_exposed"].includes(key))
      || !["whole_body_position_signal_available", "unavailable"].includes(position.status)
      || position.exact_world_position_exposed !== false
      || position.status === "unavailable" && source.movement_feedback.length !== 0
      || boundaries.motor_intention_is_not_movement_feedback !== true
      || boundaries.action_outcome_alone_is_not_movement_feedback !== true
      || boundaries.movement_feedback_requires_committed_position_transition !== true
      || boundaries.movement_feedback_requires_current_state_match !== true
      || boundaries.objective_world_coordinates_exposed !== false
      || boundaries.world_axis_direction_exposed !== false
      || boundaries.subjective_body_belief_asserted !== false) {
    const error = new Error("BODY1L_PROPRIOCEPTIVE_EVIDENCE_INVALID");
    error.code = "BODY1L_PROPRIOCEPTIVE_EVIDENCE_INVALID";
    throw error;
  }
  for (const signal of source.movement_feedback) {
    if (!isObject(signal)
        || Object.keys(signal).some((key) => !PROPRIOCEPTIVE_FEEDBACK_KEYS.has(key))
        || signal.modality !== "proprioception"
        || signal.signal !== "whole_body_translation_detected"
        || signal.source_world_revision !== source.source_world_revision
        || signal.exact_world_position_exposed !== false
        || signal.exact_displacement_exposed !== false
        || signal.world_axis_direction_exposed !== false
        || signal.subjective_movement_belief_asserted !== false) {
      const error = new Error("BODY1L_PROPRIOCEPTIVE_SIGNAL_INVALID");
      error.code = "BODY1L_PROPRIOCEPTIVE_SIGNAL_INVALID";
      throw error;
    }
  }
  return {
    version: source.version,
    character,
    source_world_revision: source.source_world_revision,
    position_sense: { status: position.status },
    movement_feedback: source.movement_feedback.map((signal) => ({
      modality: signal.modality,
      signal: signal.signal,
      source_world_revision: signal.source_world_revision,
    })),
  };
}

const VESTIBULAR_FEEDBACK_KEYS = new Set([
  "modality", "signal", "source_world_revision",
]);
function boundedCommittedVestibularFeedback(projection, character) {
  const source = isObject(projection) ? projection : {};
  const orientation = isObject(source.head_orientation_sense)
    ? source.head_orientation_sense : {};
  const boundaries = isObject(source.boundaries) ? source.boundaries : {};
  const invalid = (code) => {
    const error = new Error(code);
    error.code = code;
    throw error;
  };
  if (source.version !== worldSimulationBodyVestibularFeedbackVersion
      || source.authority !== "committed_world_body_state_and_history"
      || source.character !== character
      || !Number.isSafeInteger(source.source_world_revision)
      || source.source_world_revision < 0
      || !Array.isArray(source.head_rotation_feedback)
      || source.head_rotation_feedback.length > 1
      || Object.keys(orientation).some((key) => key !== "status")
      || !["head_orientation_signal_available", "unavailable"].includes(orientation.status)
      || orientation.status === "unavailable" && source.head_rotation_feedback.length !== 0
      || boundaries.motor_intention_is_not_rotation_feedback !== true
      || boundaries.action_outcome_alone_is_not_rotation_feedback !== true
      || boundaries.rotation_requires_committed_facing_transition_and_current_state_match !== true
      || boundaries.exact_world_angle_exposed !== false
      || boundaries.angular_velocity_or_acceleration_inferred !== false
      || boundaries.subjective_orientation_belief_asserted !== false) {
    invalid("BODY1N_VESTIBULAR_EVIDENCE_INVALID");
  }
  for (const signal of source.head_rotation_feedback) {
    if (!isObject(signal)
        || Object.keys(signal).some((key) => !VESTIBULAR_FEEDBACK_KEYS.has(key))
        || signal.modality !== "vestibular"
        || signal.signal !== "head_rotation_detected"
        || signal.source_world_revision !== source.source_world_revision) {
      invalid("BODY1N_VESTIBULAR_SIGNAL_INVALID");
    }
  }
  return {
    version: source.version,
    character,
    source_world_revision: source.source_world_revision,
    head_orientation_sense: { status: orientation.status },
    head_rotation_feedback: source.head_rotation_feedback.map((signal) => ({
      modality: signal.modality,
      signal: signal.signal,
      source_world_revision: signal.source_world_revision,
    })),
  };
}

const SPEECH_FEEDBACK_KEYS = new Set([
  "action_id", "status", "temporal_stream_registered",
  "physical_sound_registered", "source_world_revision",
]);
function boundedCommittedSpeechFeedback(projection, character) {
  const source = isObject(projection) ? projection : {};
  const boundaries = isObject(source.boundaries) ? source.boundaries : {};
  if (source.version !== worldSimulationBodySpeechEffectorFeedbackVersion
      || source.authority !== "committed_world_speech_outcome"
      || source.character !== character
      || !Number.isSafeInteger(source.source_world_revision)
      || source.source_world_revision < 0
      || !Array.isArray(source.feedback) || source.feedback.length > 16
      || boundaries.selection_is_not_emission !== true
      || boundaries.emission_is_not_acoustic_registration !== true
      || boundaries.acoustic_registration_is_not_listener_audibility !== true
      || boundaries.surface_text_exposed !== false
      || boundaries.semantic_content_exposed !== false
      || boundaries.respiratory_capacity_inferred !== false
      || boundaries.subjective_belief_asserted !== false) {
    const error = new Error("BODY1J_SPEECH_FEEDBACK_INVALID");
    error.code = "BODY1J_SPEECH_FEEDBACK_INVALID";
    throw error;
  }
  for (const item of source.feedback) {
    if (!isObject(item)
        || Object.keys(item).some((key) => !SPEECH_FEEDBACK_KEYS.has(key))
        || typeof item.action_id !== "string" || !item.action_id.trim()
        || !["speech_emitted", "speech_not_emitted", "emission_unconfirmed"].includes(item.status)
        || typeof item.temporal_stream_registered !== "boolean"
        || typeof item.physical_sound_registered !== "boolean"
        || item.source_world_revision !== source.source_world_revision
        || item.status !== "speech_emitted"
          && (item.temporal_stream_registered || item.physical_sound_registered)) {
      const error = new Error("BODY1J_SPEECH_FEEDBACK_ITEM_INVALID");
      error.code = "BODY1J_SPEECH_FEEDBACK_ITEM_INVALID";
      throw error;
    }
  }
  return {
    version: source.version, character,
    source_world_revision: source.source_world_revision,
    feedback: source.feedback.map((item) => ({
      action_id: item.action_id,
      status: item.status,
      source_world_revision: item.source_world_revision,
    })),
  };
}

const INTEROCEPTIVE_SIGNAL_KEYS = new Set([
  "modality", "channel", "signal", "direction", "source_world_revision",
  "objective_energy_value_exposed", "change_magnitude_exposed",
  "subjective_fatigue_asserted", "subjective_hunger_asserted",
  "subjective_feeling_asserted", "character_belief_asserted",
]);

function boundedCommittedInteroception(projection, character) {
  const evidence = isObject(projection) ? projection : {};
  const signals = evidence.signals;
  if (evidence.version !== worldSimulationBodyInteroceptiveSignalVersion
      || evidence.authority !== "committed_internal_body_state_change"
      || evidence.character !== character
      || !Number.isSafeInteger(evidence.source_world_revision)
      || evidence.source_world_revision < 0
      || evidence.channel_status !== "available"
        && evidence.channel_status !== "unavailable"
      || !Array.isArray(signals)
      || signals.length > 32
      || evidence.channel_status === "unavailable" && signals.length !== 0
      || !isObject(evidence.boundaries)
      || evidence.boundaries.objective_energy_value_exposed !== false
      || evidence.boundaries.physiological_fatigue_inferred !== false
      || evidence.boundaries.hunger_inferred !== false
      || evidence.boundaries.subjective_feeling_inferred !== false
      || evidence.boundaries.character_belief_inferred !== false) {
    const error = new Error("BODY1I_INTEROCEPTIVE_EVIDENCE_INVALID");
    error.code = "BODY1I_INTEROCEPTIVE_EVIDENCE_INVALID";
    throw error;
  }
  for (const signal of signals) {
    if (!isObject(signal)
        || Object.keys(signal).some((key) => !INTEROCEPTIVE_SIGNAL_KEYS.has(key))
        || signal.modality !== "interoception"
        || signal.channel !== "internal_energy_state"
        || signal.signal !== "internal_energy_change_detected"
        || !["increase", "decrease"].includes(signal.direction)
        || signal.source_world_revision !== evidence.source_world_revision
        || signal.objective_energy_value_exposed !== false
        || signal.change_magnitude_exposed !== false
        || signal.subjective_fatigue_asserted !== false
        || signal.subjective_hunger_asserted !== false
        || signal.subjective_feeling_asserted !== false
        || signal.character_belief_asserted !== false) {
      const error = new Error("BODY1I_INTEROCEPTIVE_SIGNAL_INVALID");
      error.code = "BODY1I_INTEROCEPTIVE_SIGNAL_INVALID";
      throw error;
    }
  }
  return {
    version: evidence.version,
    character,
    source_world_revision: evidence.source_world_revision,
    channel_status: evidence.channel_status,
    signals: signals.map(({ modality, channel, signal, direction, source_world_revision }) =>
      ({ modality, channel, signal, direction, source_world_revision })),
  };
}

export function buildWorldSimulationCharacterBrainInput(
  decisionPacket = {},
  options = {},
) {
  const packet = isObject(decisionPacket)
    ? decisionPacket
    : {};
  const recollectionV3 =
    packet.boundaries?.recollection_reinstatement_v3_installed === true;
  const outputGatingV5 =
    packet.boundaries?.selective_working_memory_output_gating_v5_installed === true;

  const input = {
    character:
      packet.character
      ?? null,

    perception:
      cloneJson(
        // The native cognition-only action proposer receives this already
        // observer-bounded view from world_character_cognition. Preserve it
        // for the final Brain input when no distinct packet view was sent.
        // An explicit (even empty) packet perception remains authoritative.
        packet.perception
        ?? packet.cognition?.perception
        ?? {},
      ),

    ...(
      recollectionV3
        ? {}
        : {
            recovered_memories:
              cloneJson(
                packet.recovered_memories
                ?? [],
              ),
          }
    ),

    retrieval_experience:
      cloneJson(
        packet.retrieval_experience
        ?? {
          process_occurred: false,
          initiation_mode: null,
          target_outcome: null,
          recovered_any_content: false,
        },
      ),

    cognition:
      characterBrainCognition(packet, recollectionV3, outputGatingV5),

    candidate_action_intents:
      cloneJson(
        packet.candidate_action_intents
        ?? [],
      ),

    boundaries:
      cloneJson(
        packet.boundaries
        ?? {},
      ),
  };

  const bodySensoryEvidence = options.body_sensory_evidence;
  if (bodySensoryEvidence !== undefined && bodySensoryEvidence !== null) {
    input.body_sensory_evidence =
      assertWorldSimulationBodyToBrainSensoryEvidence(
        bodySensoryEvidence,
        { character: input.character },
      );
    input.boundaries.body_sensory_evidence_v1_installed = true;
    input.boundaries.body_sensory_evidence_objective_truth_exposed = false;
    input.boundaries.body_sensory_evidence_is_character_belief = false;
  }

  if (options.body_interoceptive_signals !== undefined) {
    input.body_interoceptive_evidence = boundedCommittedInteroception(
      options.body_interoceptive_signals,
      input.character,
    );
    input.boundaries.body_interoceptive_evidence_v1_installed = true;
    input.boundaries.body_interoceptive_objective_state_exposed = false;
    input.boundaries.body_interoceptive_evidence_is_character_belief = false;
  }

  if (options.body_proprioceptive_feedback !== undefined) {
    input.body_proprioceptive_evidence = boundedCommittedProprioception(
      options.body_proprioceptive_feedback, input.character,
    );
    input.boundaries.body_proprioceptive_evidence_v1_installed = true;
    input.boundaries.body_proprioceptive_world_coordinates_exposed = false;
    input.boundaries.body_proprioceptive_exact_displacement_exposed = false;
    input.boundaries.body_proprioceptive_evidence_is_character_belief = false;
  }

  if (options.body_vestibular_feedback !== undefined) {
    input.body_vestibular_evidence = boundedCommittedVestibularFeedback(
      options.body_vestibular_feedback, input.character,
    );
    input.boundaries.body_vestibular_evidence_v1_installed = true;
    input.boundaries.body_vestibular_exact_world_angle_exposed = false;
    input.boundaries.body_vestibular_angular_dynamics_inferred = false;
    input.boundaries.body_vestibular_evidence_is_character_belief = false;
  }

  if (options.body_speech_effector_feedback !== undefined) {
    input.body_speech_effector_feedback = boundedCommittedSpeechFeedback(
      options.body_speech_effector_feedback, input.character,
    );
    input.boundaries.body_speech_effector_feedback_v1_installed = true;
    input.boundaries.body_speech_feedback_is_character_belief = false;
    input.boundaries.body_speech_feedback_is_listener_hearing = false;
    input.boundaries.body_speech_feedback_acoustic_registration_exposed = false;
    input.boundaries.body_speech_feedback_technical_stream_exposed = false;
  }

  const commitmentExposure =
    options.effective_action_commitment_character_exposure;
  if (commitmentExposure !== undefined && commitmentExposure !== null) {
    if (!isObject(commitmentExposure)
        || commitmentExposure.version
          !== worldSimulationEffectiveActionCommitmentCharacterExposureVersion
        || commitmentExposure.character !== input.character) {
      const error = new Error(
        "Character Brain input requires a same-character Phase75B commitment exposure.",
      );
      error.code = "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_INVALID";
      throw error;
    }
    input.cognition.effective_action_commitment = cloneJson({
      status: commitmentExposure.status,
      active_commitment: commitmentExposure.active_commitment,
      has_active_commitment: commitmentExposure.has_active_commitment,
      explicit_reject_all_cleared_prior_commitment:
        commitmentExposure.explicit_reject_all_cleared_prior_commitment,
      deliberation_boundary: commitmentExposure.deliberation_boundary,
    });
    input.boundaries.effective_action_commitment_character_exposure_v1_installed = true;
  }

  const subjectiveExecutionExperience =
    options.action_commitment_subjective_execution_experience;
  if (subjectiveExecutionExperience !== undefined
      && subjectiveExecutionExperience !== null) {
    if (!isObject(subjectiveExecutionExperience)
        || subjectiveExecutionExperience.version
          !== worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion
        || subjectiveExecutionExperience.character !== input.character
        || !isObject(subjectiveExecutionExperience.projection)) {
      const error = new Error(
        "Character Brain input requires a same-character Phase75F subjective execution experience.",
      );
      error.code = "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_EXPERIENCE_INVALID";
      throw error;
    }
    const subjectiveFeedback = array(
      subjectiveExecutionExperience.projection.subjective_feedback,
    );
    input.cognition.action_commitment_execution_experience = cloneJson({
      status: subjectiveFeedback.length
        ? "subjective_execution_feedback_available"
        : "no_subjective_execution_feedback",
      active_commitment_ref:
        subjectiveExecutionExperience.projection.active_commitment_ref,
      action_id: subjectiveExecutionExperience.projection.action_id,
      subjective_feedback_count: subjectiveFeedback.length,
      subjective_feedback: subjectiveFeedback,
      latest_subjective_feedback: subjectiveFeedback.length
        ? subjectiveFeedback[subjectiveFeedback.length - 1]
        : null,
    });
    input.boundaries.action_commitment_subjective_execution_experience_v1_installed = true;
  }

  if (typeof input.character === "string" && input.character.trim()) {
    input.subjective_action_deliberation =
      buildWorldSimulationSubjectiveActionDeliberationView({
        character: input.character,
        cognition: input.cognition,
        candidate_action_intents: input.candidate_action_intents,
      });
    input.subjective_prospective_consequence_simulation =
      buildWorldSimulationSubjectiveProspectiveConsequenceView({
        character: input.character,
        cognition: input.cognition,
        candidate_action_intents: input.candidate_action_intents,
        subjective_action_deliberation: input.subjective_action_deliberation,
      });
    input.subjective_cross_option_preference_resolution =
      buildWorldSimulationSubjectiveCrossOptionPreferenceView({
        character: input.character,
        cognition: input.cognition,
        candidate_action_intents: input.candidate_action_intents,
        subjective_action_deliberation: input.subjective_action_deliberation,
        subjective_prospective_consequence_simulation:
          input.subjective_prospective_consequence_simulation,
      });
    if (isObject(input.cognition.effective_action_commitment)) {
      input.action_commitment_reconsideration_evidence =
        buildWorldSimulationActionCommitmentReconsiderationEvidence({
          character: input.character,
          cognition: input.cognition,
          subjective_action_deliberation: input.subjective_action_deliberation,
          subjective_prospective_consequence_simulation:
            input.subjective_prospective_consequence_simulation,
          subjective_cross_option_preference_resolution:
            input.subjective_cross_option_preference_resolution,
        });
      input.boundaries.action_commitment_reconsideration_evidence_v1_installed = true;
      input.action_commitment_experience_grounded_reconsideration =
        buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
          character: input.character,
          base_reconsideration_evidence:
            input.action_commitment_reconsideration_evidence,
          subjective_execution_experience:
            input.cognition.action_commitment_execution_experience ?? {},
        });
      input.boundaries.action_commitment_experience_grounded_reconsideration_v1_installed = true;
    }
    input.boundaries.subjective_action_deliberation_grounding_v1_installed = true;
    input.boundaries.subjective_prospective_consequence_simulation_v1_installed = true;
    input.boundaries.subjective_cross_option_preference_resolution_v1_installed = true;
  }

  // CC-1 is a non-binding same-character planning view. It does not
  // select a world action or realize speech before the world emission gate.
  if (input.cognition.communication_goal != null) {
    input.communication_foundation = planCharacterCommunication(input);
    input.boundaries.communication_foundation_v1_installed = true;
    input.boundaries.communication_foundation_action_authority = false;
    input.boundaries.communication_foundation_world_truth_authority = false;
  }

  // Historical compatibility aliases are never allowed to bypass v3's
  // single-semantic-exposure gate. Callers without the v3 packet boundary
  // retain the old explicit opt-in behavior.
  if (!recollectionV3
    && options.include_legacy_retrieved_memories_alias === true) {
    input.retrieved_memories =
      cloneJson(
        packet.recovered_memories
        ?? [],
      );
  }

  // Only native Character Brain responses currently accept coping_intention.
  // Shared/formal readers retain the history without an unsupported response instruction.
  if (isObject(input.cognition.coping_context) && options.include_native_coping_response_contract !== true) {
    delete input.cognition.coping_context.response_contract;
  }
  return input;
}

// Read the committed World snapshot before admitting any internal-body signal
// into a Character Brain input. The pure builder keeps its existing callers.
export async function buildCommittedWorldSimulationCharacterBrainInput({
  session_id, decision_packet, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const character = decision_packet?.character;
  if (typeof character !== "string" || !character.trim()) {
    const error = new Error("BODY1I_CHARACTER_REQUIRED");
    error.code = "BODY1I_CHARACTER_REQUIRED";
    throw error;
  }
  const committed = await readCommittedWorldSimulationBodyInteroceptiveSignals({
    session_id, character, expected_revision, expected_state_hash,
  }, options);
  const proprioception = await readCommittedWorldSimulationBodyProprioceptiveFeedback({
    session_id, character, expected_revision, expected_state_hash,
  }, options);
  const vestibular = await readCommittedWorldSimulationBodyVestibularFeedback({
    session_id, character, expected_revision, expected_state_hash,
  }, options);
  return buildWorldSimulationCharacterBrainInput(decision_packet, {
    ...options,
    body_interoceptive_signals: committed,
    body_proprioceptive_feedback: proprioception,
    body_vestibular_feedback: vestibular,
  });
}
