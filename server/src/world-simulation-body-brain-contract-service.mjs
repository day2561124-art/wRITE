import {
  readCommittedWorldSimulationBodyAuthority,
  worldSimulationBodyAuthorityVersion,
} from "./world-simulation-body-authority-service.mjs";

export const worldSimulationBodyBrainContractVersion =
  "body-0c-brain-body-command-sensory-evidence-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function issue(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requiredText(value, code) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw issue(code);
  return text;
}

const PROPRIOCEPTIVE = new Set(["position_signal_available", "unavailable"]);
const NOCICEPTIVE = new Set(["injury_signal_possible", "none_from_recorded_injuries"]);
const MOVEMENT = new Set(["movement_restricted", "movement_not_known_restricted"]);

export function buildWorldSimulationBodyToBrainSensoryEvidence({
  body_authority_projection,
} = {}) {
  const projection = object(body_authority_projection);
  const brain = object(projection.brain_evidence);
  if (projection.version !== worldSimulationBodyAuthorityVersion) {
    throw issue("BODY0C_BODY_AUTHORITY_VERSION_INVALID");
  }
  const character = requiredText(brain.character, "BODY0C_BODY_EVIDENCE_CHARACTER_REQUIRED");
  if (!PROPRIOCEPTIVE.has(brain.proprioceptive_access)
      || !NOCICEPTIVE.has(brain.nociceptive_signal)
      || !MOVEMENT.has(brain.movement_signal)
      || brain.subjective_pain_asserted !== false
      || brain.diagnosis_asserted !== false
      || brain.movement_completed_asserted !== false) {
    throw issue("BODY0C_BODY_EVIDENCE_BOUNDARY_INVALID");
  }

  return Object.freeze({
    version: worldSimulationBodyBrainContractVersion,
    direction: "body_to_brain",
    authority: "bounded_body_sensory_evidence",
    character,
    source_body_authority_version: projection.version,
    signals: Object.freeze({
      proprioception: Object.freeze({
        availability: brain.proprioceptive_access,
      }),
      nociception: Object.freeze({
        status: brain.nociceptive_signal,
      }),
      movement_constraint: Object.freeze({
        status: brain.movement_signal,
      }),
      interoception: Object.freeze({
        status: "interface_installed_detailed_signals_deferred_to_body1",
        signals: Object.freeze([]),
      }),
    }),
    boundaries: Object.freeze({
      objective_body_state_exposed: false,
      numerical_health_exposed: false,
      injury_diagnosis_exposed: false,
      injury_severity_exposed: false,
      subjective_pain_asserted: false,
      subjective_feeling_asserted: false,
      movement_completed_asserted: false,
      body_signal_is_character_belief: false,
      detailed_interoception_deferred_to_body1: true,
      active_sampling_deferred_to_body1: true,
    }),
  });
}

export function assertWorldSimulationBodyToBrainSensoryEvidence(value, {
  character,
} = {}) {
  const evidence = object(value);
  const signals = object(evidence.signals);
  const proprioception = object(signals.proprioception);
  const nociception = object(signals.nociception);
  const movement = object(signals.movement_constraint);
  const interoception = object(signals.interoception);
  const boundaries = object(evidence.boundaries);
  if (evidence.version !== worldSimulationBodyBrainContractVersion
      || evidence.direction !== "body_to_brain"
      || evidence.authority !== "bounded_body_sensory_evidence"
      || evidence.source_body_authority_version !== worldSimulationBodyAuthorityVersion
      || !PROPRIOCEPTIVE.has(proprioception.availability)
      || !NOCICEPTIVE.has(nociception.status)
      || !MOVEMENT.has(movement.status)
      || interoception.status !== "interface_installed_detailed_signals_deferred_to_body1"
      || !Array.isArray(interoception.signals)
      || interoception.signals.length !== 0
      || boundaries.objective_body_state_exposed !== false
      || boundaries.numerical_health_exposed !== false
      || boundaries.injury_diagnosis_exposed !== false
      || boundaries.injury_severity_exposed !== false
      || boundaries.subjective_pain_asserted !== false
      || boundaries.subjective_feeling_asserted !== false
      || boundaries.movement_completed_asserted !== false
      || boundaries.body_signal_is_character_belief !== false
      || boundaries.detailed_interoception_deferred_to_body1 !== true
      || boundaries.active_sampling_deferred_to_body1 !== true) {
    throw issue("BODY0C_BODY_TO_BRAIN_EVIDENCE_INVALID");
  }
  const actor = requiredText(evidence.character, "BODY0C_BODY_EVIDENCE_CHARACTER_REQUIRED");
  if (character !== undefined && actor !== character) {
    throw issue("BODY0C_BODY_TO_BRAIN_CHARACTER_MISMATCH");
  }
  return clone(evidence);
}

export async function readCommittedWorldSimulationBodyToBrainSensoryEvidence(
  input = {},
  options = {},
) {
  const projection = await readCommittedWorldSimulationBodyAuthority(input, options);
  return buildWorldSimulationBodyToBrainSensoryEvidence({
    body_authority_projection: projection,
  });
}

export function buildWorldSimulationBrainToBodyMotorCommand({
  character,
  selected_action_intent,
} = {}) {
  const actor = requiredText(character, "BODY0C_MOTOR_COMMAND_CHARACTER_REQUIRED");
  const selected = object(selected_action_intent);
  if (selected.character !== actor) {
    throw issue("BODY0C_MOTOR_COMMAND_CHARACTER_MISMATCH");
  }
  if (selected.selection === "reject_all") {
    return Object.freeze({
      version: worldSimulationBodyBrainContractVersion,
      direction: "brain_to_body",
      authority: "character_motor_intention_only",
      character: actor,
      command_status: "no_motor_command",
      action_id: null,
      command_request: null,
      boundaries: Object.freeze({
        objective_feasibility_asserted: false,
        execution_asserted: false,
        success_asserted: false,
        completed_movement_asserted: false,
        objective_body_state_write_allowed: false,
        effector_resolution_deferred_to_body1: true,
      }),
    });
  }
  if (selected.selection !== "candidate_action_intent") {
    throw issue("BODY0C_MOTOR_COMMAND_SELECTION_INVALID");
  }

  const candidate = object(selected.candidate);
  const candidateActionId = requiredText(
    candidate.action_id,
    "BODY0C_MOTOR_COMMAND_ACTION_ID_REQUIRED",
  );
  const selectedActionId = requiredText(
    selected.action_id,
    "BODY0C_MOTOR_COMMAND_ACTION_ID_REQUIRED",
  );
  if (candidateActionId !== selectedActionId) {
    throw issue("BODY0C_MOTOR_COMMAND_ACTION_LINEAGE_MISMATCH");
  }
  const actionId = selectedActionId;
  const motorIntentRecorded =
    candidate.kind === "movement"
    || Object.keys(object(candidate.movement)).length > 0
    || Object.keys(object(candidate.motor_command)).length > 0;
  if (!motorIntentRecorded) {
    return Object.freeze({
      version: worldSimulationBodyBrainContractVersion,
      direction: "brain_to_body",
      authority: "character_motor_intention_only",
      character: actor,
      command_status: "no_motor_command_for_non_motor_intent",
      action_id: actionId,
      command_request: null,
      boundaries: Object.freeze({
        objective_feasibility_asserted: false,
        execution_asserted: false,
        success_asserted: false,
        completed_movement_asserted: false,
        objective_body_state_write_allowed: false,
        effector_resolution_deferred_to_body1: true,
      }),
    });
  }
  return Object.freeze({
    version: worldSimulationBodyBrainContractVersion,
    direction: "brain_to_body",
    authority: "character_motor_intention_only",
    character: actor,
    command_status: "motor_command_requested",
    action_id: actionId,
    command_request: Object.freeze({
      kind: "selected_action_motor_intention",
      action_id: actionId,
    }),
    boundaries: Object.freeze({
      objective_feasibility_asserted: false,
      execution_asserted: false,
      success_asserted: false,
      completed_movement_asserted: false,
      objective_body_state_write_allowed: false,
      effector_resolution_deferred_to_body1: true,
    }),
  });
}

export function buildWorldSimulationBodyBrainContract() {
  return Object.freeze({
    version: worldSimulationBodyBrainContractVersion,
    phase: "BODY-0C",
    body_to_brain: Object.freeze({
      source: "committed_world_body_authority_projection",
      evidence_is_signal_not_diagnosis: true,
      evidence_is_not_character_belief: true,
      objective_body_state_is_private: true,
      detailed_interoception_deferred_to_body1: true,
      active_sampling_deferred_to_body1: true,
    }),
    brain_to_body: Object.freeze({
      source: "character_selected_action_intent",
      command_is_intention_not_execution: true,
      command_does_not_assert_objective_feasibility: true,
      command_does_not_assert_success: true,
      effectors_deferred_to_body1: true,
    }),
  });
}
