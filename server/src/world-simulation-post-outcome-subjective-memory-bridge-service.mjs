import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "./world-simulation-post-outcome-subjective-perception-service.mjs";

export const worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion =
  "phase76b-post-outcome-subjective-memory-bridge-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return Boolean(characterKey(left)) && characterKey(left) === characterKey(right);
}

function safeScalar(value) {
  if (value === null || value === undefined) return null;
  return ["string", "number", "boolean"].includes(typeof value)
    ? cloneJson(value)
    : null;
}

function verifyProjection(rawProjection, turnId) {
  const projection = object(rawProjection);
  if (projection.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
      || projection.turn_id !== turnId
      || !text(projection.projection_hash)
      || !Array.isArray(projection.character_experiences)) {
    const error = new Error(
      "Phase76B requires a canonical Phase76A post-outcome subjective perception projection.",
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SOURCE_INVALID";
    throw error;
  }

  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    const error = new Error(
      "Phase76B source Phase76A projection failed immutable hash verification.",
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SOURCE_HASH_MISMATCH";
    throw error;
  }

  return cloneJson(projection);
}

function canonicalExperienceEntry(rawEntry, turnId) {
  const entry = object(rawEntry);
  const character = text(entry.character);
  const actionId = text(entry.action_id);
  const sourceRef = text(entry.subjective_perception_ref);
  const experience = object(entry.experience);
  const sourceOutcomeHashes = array(entry.source_outcome_hashes).map(text).filter(Boolean);
  const sourceTransitionHashes = array(entry.source_transition_hashes).map(text).filter(Boolean);

  if (entry.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
      || entry.turn_id !== turnId
      || !character
      || !actionId
      || !sourceRef
      || !Object.keys(experience).length
      || entry.objective_result_label_exposed !== false
      || entry.causal_evidence_exposed !== false
      || entry.exact_engine_geometry_exposed !== false
      || entry.other_character_private_state_exposed !== false
      || entry.raw_result_interpreted_as_perceived_success_or_failure !== false) {
    const error = new Error(
      "Phase76B received an invalid Phase76A character experience entry.",
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SOURCE_ENTRY_INVALID";
    throw error;
  }

  const canonicalIdentity = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    turn_id: turnId,
    character,
    action_id: actionId,
    experience: cloneJson(experience),
    source_outcome_hashes: sourceOutcomeHashes,
    source_transition_hashes: sourceTransitionHashes,
  };
  const expectedRef =
    `phase76a_post_outcome_${hashAgentRunValue(canonicalIdentity).slice(0, 24)}`;
  if (expectedRef !== sourceRef) {
    const error = new Error(
      `Phase76B source experience ${sourceRef} is not a canonical Phase76A receipt.` ,
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SOURCE_REF_INVALID";
    throw error;
  }

  const boundedExperience = {};
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(experience, key)) continue;
    const value = safeScalar(experience[key]);
    if (value !== null) boundedExperience[key] = value;
  }
  if (!Object.keys(boundedExperience).length) {
    const error = new Error(
      `Phase76B source experience ${sourceRef} contains no bounded character experience.`,
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SOURCE_ENTRY_INVALID";
    throw error;
  }

  return {
    character,
    action_id: actionId,
    subjective_perception_ref: sourceRef,
    subjective_perception_hash: hashAgentRunValue(canonicalIdentity),
    experience: boundedExperience,
  };
}

function selectionIndex(selectedActionIntents) {
  const byCharacterAction = new Map();
  for (const selected of array(selectedActionIntents)) {
    if (!isObject(selected) || selected.selection !== "candidate_action_intent") continue;
    const character = text(selected.character);
    const actionId = text(selected.action_id ?? selected.candidate?.action_id);
    if (!character || !actionId) continue;
    const key = `${characterKey(character)}\u0000${actionId}`;
    if (byCharacterAction.has(key)) {
      const error = new Error(
        `Phase76B received duplicate selected action ${actionId} for ${character}.`,
      );
      error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SELECTION_DUPLICATE";
      throw error;
    }
    byCharacterAction.set(key, {
      character,
      action_id: actionId,
      intent: text(selected.intent ?? selected.candidate?.intent),
    });
  }
  return byCharacterAction;
}

function memoryObservation(entry, selection) {
  const safe = {
    kind: "post_outcome_action_experience",
    ...(selection.intent ? { action: selection.intent } : {}),
  };
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (Object.hasOwn(entry.experience, key)) {
      safe[key] = cloneJson(entry.experience[key]);
    }
  }

  // Phase63 strips internal_* fields from remembered content while preserving
  // these exact values in engine-side memory provenance.
  return {
    ...safe,
    internal_post_outcome_subjective_perception_ref:
      entry.subjective_perception_ref,
    internal_post_outcome_subjective_perception_hash:
      entry.subjective_perception_hash,
    internal_post_outcome_bridge_version:
      worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
  };
}

export function buildWorldSimulationPostOutcomeSubjectiveMemoryBridgeContract() {
  return Object.freeze({
    version: worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
    phase: "Phase76B",
    status: "bounded_post_outcome_subjective_experience_memory_bridge_installed",
    source: "canonical_phase76a_post_outcome_subjective_perception_only",
    selected_own_action_intent_may_be_used_as_character_context: true,
    raw_action_outcomes_exposed: false,
    raw_state_transitions_exposed: false,
    raw_world_state_exposed: false,
    objective_result_label_exposed: false,
    causal_evidence_exposed: false,
    exact_engine_geometry_exposed: false,
    other_character_private_state_exposed: false,
    direct_subjective_memory_write: false,
    direct_subjective_claim_or_belief_write: false,
    direct_current_mind_write: false,
    world_state_mutation_applied: false,
    same_turn_character_brain_feedback_allowed: false,
    output_target: "existing_phase63_subjective_memory_formation",
    downstream_claim_belief_owner: "existing_phase65_phase66_pipeline",
  });
}

export function bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory(input = {}) {
  const turnId = text(input.turn_id);
  if (!turnId) {
    const error = new Error("Phase76B post-outcome subjective memory bridge requires turn_id.");
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_TURN_REQUIRED";
    throw error;
  }

  const projection = verifyProjection(
    input.post_outcome_subjective_perception_projection,
    turnId,
  );
  const selections = selectionIndex(input.selected_action_intents);
  const packetByCharacter = new Map();
  const sourceEntries = [];

  for (const rawEntry of array(projection.character_experiences)) {
    const entry = canonicalExperienceEntry(rawEntry, turnId);
    const selection = selections.get(
      `${characterKey(entry.character)}\u0000${entry.action_id}`,
    );
    if (!selection || !sameCharacter(selection.character, entry.character)) {
      const error = new Error(
        `Phase76B cannot resolve the selected own action for ${entry.character}/${entry.action_id}.`,
      );
      error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SELECTION_UNRESOLVED";
      throw error;
    }

    const key = characterKey(entry.character);
    if (!packetByCharacter.has(key)) {
      packetByCharacter.set(key, {
        character: entry.character,
        perception: {
          observed: [],
          audible: [],
          other_senses: [],
          information_boundary: {
            source: "phase76b_post_outcome_subjective_memory_bridge",
            world_truth_authority: false,
            objective_result_label_exposed: false,
            causal_evidence_exposed: false,
            exact_engine_geometry_exposed: false,
            other_character_private_state_exposed: false,
          },
        },
      });
    }

    packetByCharacter.get(key).perception.other_senses.push(
      memoryObservation(entry, selection),
    );
    sourceEntries.push({
      character: entry.character,
      action_id: entry.action_id,
      subjective_perception_ref: entry.subjective_perception_ref,
      subjective_perception_hash: entry.subjective_perception_hash,
    });
  }

  const memoryFormationPackets = [...packetByCharacter.values()]
    .sort((left, right) => left.character.localeCompare(right.character, "zh-Hant-TW"));
  const body = {
    version: worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
    phase: "Phase76B",
    status: memoryFormationPackets.length > 0
      ? "bounded_post_outcome_subjective_memory_input_available"
      : "no_bounded_post_outcome_subjective_memory_input_available",
    turn_id: turnId,
    source_phase76a_projection_hash: projection.projection_hash,
    source_entries: sourceEntries,
    memory_formation_packets: memoryFormationPackets,
    boundaries: {
      canonical_phase76a_projection_required: true,
      same_character_selected_action_required: true,
      raw_action_outcomes_consumed: false,
      raw_state_transitions_consumed: false,
      raw_world_state_consumed: false,
      objective_result_label_exposed: false,
      causal_evidence_exposed: false,
      exact_engine_geometry_exposed: false,
      other_character_private_state_exposed: false,
      direct_subjective_memory_write: false,
      direct_subjective_claim_or_belief_write: false,
      direct_current_mind_write: false,
      world_state_mutation_applied: false,
      same_turn_character_brain_feedback_allowed: false,
    },
  };
  body.bridge_hash = hashAgentRunValue(body);
  return cloneJson(body);
}
