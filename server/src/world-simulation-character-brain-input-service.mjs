import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
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
        packet.perception
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
