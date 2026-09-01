import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "./world-simulation-character-brain-input-service.mjs";
import {
  adjudicateWorldSimulationCausality,
  buildWorldSimulationCausalRuleContract,
} from "./world-simulation-causal-rule-engine.mjs";
import {
  runWorldSimulationNativeCapability,
} from "./world-simulation-neural-service.mjs";
import {
  buildWorldSimulationVisibilityQueryContract,
  queryWorldSimulationObserverVisibility,
  worldSimulationVisibilityQueryVersion,
} from "./world-simulation-visibility-query-service.mjs";
import {
  buildWorldSimulationDirectionalHeightVisibilityContract,
  queryWorldSimulationObserverDirectionalHeightVisibility,
  worldSimulationDirectionalHeightVisibilityVersion,
} from "./world-simulation-directional-height-visibility-service.mjs";
import {
  buildWorldSimulationIlluminationVisibilityContract,
  queryWorldSimulationObserverIlluminationVisibility,
  worldSimulationIlluminationVisibilityVersion,
} from "./world-simulation-illumination-visibility-service.mjs";
import {
  buildWorldSimulationAudibilityQueryContract,
  queryWorldSimulationObserverAudibility,
  worldSimulationAudibilityQueryVersion,
} from "./world-simulation-audibility-query-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveMemoryFormationContract,
  formWorldSimulationSubjectiveMemories,
  worldSimulationSubjectiveMemoryFormationVersion,
} from "./world-simulation-subjective-memory-formation-service.mjs";
import {
  buildWorldSimulationMemoryAccessibilityContract,
  queryWorldSimulationMemoryAccessibility,
  worldSimulationMemoryAccessibilityVersion,
} from "./world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationRetrievalPracticeActivationProjectionContract,
  projectWorldSimulationRetrievalPracticeActivation,
} from "./world-simulation-retrieval-practice-activation-projection-service.mjs";
import {
  buildWorldSimulationBaseLevelActivationProjectionContract,
  projectWorldSimulationBaseLevelActivation,
} from "./world-simulation-base-level-activation-projection-service.mjs";
import {
  buildWorldSimulationCueDiagnosticEvidenceProjectionContract,
  projectWorldSimulationCueDiagnosticEvidence,
} from "./world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessContract,
  buildWorldSimulationMemoryRetrievalQuery,
  executeWorldSimulationMemoryRetrievalProcess,
  worldSimulationMemoryRetrievalProcessVersion,
} from "./world-simulation-memory-retrieval-process-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
  worldSimulationMemoryRetrievalProcessV3Version,
} from "./world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalPersistence,
  buildWorldSimulationMemoryRetrievalPersistenceContract,
  worldSimulationMemoryRetrievalPersistenceVersion,
} from "./world-simulation-memory-retrieval-persistence-service.mjs";
import {
  assertWorldSimulationSession,
} from "./world-simulation-session-service.mjs";
import {
  getStructuredEntityRegistry,
  normalizeEntityName,
} from "./structured-canon-entity-registry-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationLoopVersion = "phase62c-event-loop-v1";
export const worldSimulationCharacterRuntimeVersion = "character-runtime-v1";
export const worldSimulationCharacterExperienceContractVersion =
  "committed-character-experience-receipt-v1";
export const worldSimulationCharacterExperienceProjectionVersion =
  "committed-character-experience-projection-v1";

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

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function sameCharacterName(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

const strippedCharacterExperienceObservationKeys = new Set([
  "world_state",
  "scene_state",
  "source_position",
  "target_position",
  "exact_source_position",
  "exact_target_position",
  "relative_position",
  "distance_m",
  "target_illumination_lux",
  "received_level_db",
  "reference_level_db",
  "reference_distance_m",
  "minimum_audible_db",
  "observer_thresholds_lux",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
]);

function keyIsCharacterExperiencePrivate(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || strippedCharacterExperienceObservationKeys.has(normalized);
}

function sanitizeCharacterExperienceObservationValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeCharacterExperienceObservationValue);
  }
  if (!isObject(value)) return cloneJson(value);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (keyIsCharacterExperiencePrivate(key)) continue;
    clean[key] = sanitizeCharacterExperienceObservationValue(child);
  }
  return clean;
}

function boundedCharacterExperienceObservation(perception) {
  const source = object(perception);
  return {
    observed: sanitizeCharacterExperienceObservationValue(array(source.observed)),
    audible: sanitizeCharacterExperienceObservationValue(array(source.audible)),
    other_senses: sanitizeCharacterExperienceObservationValue(array(source.other_senses)),
    information_boundary: sanitizeCharacterExperienceObservationValue(
      object(source.information_boundary),
    ),
  };
}

function safeCharacterOutcomeScalar(value) {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return cloneJson(value);
  return null;
}

function boundedOwnActionOutcome(outcome, selectedActionId) {
  const source = object(outcome);
  const boundedEvidence = object(
    source.character_experience
    ?? source.experience_for_actor,
  );
  const projected = {
    action_id: selectedActionId ?? null,
  };
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(boundedEvidence, key)) continue;
    const value = safeCharacterOutcomeScalar(boundedEvidence[key]);
    if (value !== null) projected[key] = value;
  }
  return Object.keys(projected).length > 1 ? projected : null;
}

function verifyCharacterExperienceProjectionEnvelope(projection) {
  if (!isObject(projection)) {
    throw new Error("Committed Character Experience projection must be an object.");
  }
  const projectionHash = nonEmptyString(
    projection.projection_hash,
    "committed character experience projection hash",
  );
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projectionHash) {
    const error = new Error("Committed Character Experience projection hash verification failed.");
    error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_PROJECTION_HASH_MISMATCH";
    throw error;
  }
  return cloneJson(projection);
}

function nextCommittedCharacterExperienceSequence(
  history,
  worldLineage,
  characterEntityId,
) {
  const sequences = [];
  for (const turn of array(history?.turns)) {
    const projection = turn?.committed_character_experience_projection;
    if (!isObject(projection)) continue;
    for (const characterProjection of array(projection.character_projections)) {
      if (characterProjection?.world_lineage !== worldLineage
        || characterProjection?.character_entity_id !== characterEntityId) {
        continue;
      }
      const sequence = Number(characterProjection.experience_sequence);
      if (!Number.isSafeInteger(sequence) || sequence < 1) {
        const error = new Error(
          `Committed Character Experience history contains an invalid sequence for ${characterEntityId}.`,
        );
        error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_HISTORY_SEQUENCE_INVALID";
        throw error;
      }
      sequences.push(sequence);
    }
  }
  sequences.sort((left, right) => left - right);
  for (let index = 0; index < sequences.length; index += 1) {
    const expected = index + 1;
    if (sequences[index] !== expected) {
      const error = new Error(
        `Committed Character Experience history sequence is not contiguous for ${characterEntityId}: expected ${expected}, found ${sequences[index]}.`,
      );
      error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_HISTORY_SEQUENCE_INVALID";
      throw error;
    }
  }
  return sequences.length + 1;
}

export function projectWorldSimulationCharacterExperienceEvidence(input = {}) {
  const preparedTurn = object(input.prepared_turn);
  const selected = array(input.selected_action_intents);
  const actionOutcomes = array(input.action_outcomes);
  const runtimeIdentities = array(input.runtime_identities);
  const characterProjections = array(preparedTurn.decision_packets).map((packet, projectionSlot) => {
    const character = nonEmptyString(packet?.character, "decision packet character");
    const runtimeIdentity = runtimeIdentities.find((item) => sameCharacterName(item?.character, character));
    if (!runtimeIdentity) {
      const error = new Error(`Committed Character Experience projection is missing Runtime identity for ${character}.`);
      error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_RUNTIME_IDENTITY_REQUIRED";
      throw error;
    }
    const worldLineage = nonEmptyString(
      runtimeIdentity.world_lineage,
      "committed character experience world lineage",
    );
    const characterEntityId = nonEmptyString(
      runtimeIdentity.character_entity_id,
      "committed character experience character entity_id",
    );
    const experienceSequence = Number(runtimeIdentity.experience_sequence);
    if (!Number.isSafeInteger(experienceSequence) || experienceSequence < 1) {
      const error = new Error(
        `Committed Character Experience sequence is invalid for ${character}.`,
      );
      error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_SEQUENCE_INVALID";
      throw error;
    }
    const ownSelection = selected.find((item) => sameCharacterName(item?.character, character)) ?? null;
    const participated = ownSelection?.selection === "candidate_action_intent";
    const observation = boundedCharacterExperienceObservation(packet?.perception);
    const ownActionOutcomes = participated
      ? actionOutcomes
        .filter((outcome) => sameCharacterName(outcome?.actor, character))
        .map((outcome) => boundedOwnActionOutcome(outcome, ownSelection.action_id ?? null))
        .filter(Boolean)
      : [];
    const observedSomething = observation.observed.length > 0
      || observation.audible.length > 0
      || observation.other_senses.length > 0;
    return {
      projection_slot: projectionSlot,
      experience_sequence: experienceSequence,
      world_lineage: worldLineage,
      character_entity_id: characterEntityId,
      canonical_name: runtimeIdentity.canonical_name ?? character,
      identity_source:
        runtimeIdentity.identity_source
        ?? "historical_committed_character_experience_projection",
      formal_identity: runtimeIdentity.formal_identity === true,
      character,
      experience: {
        roles: {
          participant: participated,
          observer: observedSomething,
        },
        participation: participated
          ? {
              selected_intent: {
                action_id: ownSelection.action_id ?? null,
                intent: ownSelection.intent ?? null,
              },
              experienced_action_outcomes: ownActionOutcomes,
              selected_intent_is_not_outcome: true,
            }
          : {
              selected_intent: null,
              experienced_action_outcomes: [],
              selected_intent_is_not_outcome: true,
            },
        observation,
      },
      boundaries: {
        source_is_bounded_character_information: true,
        raw_world_state_included: false,
        hidden_causal_chain_included: false,
        other_character_private_state_included: false,
        exact_engine_geometry_included: false,
        participant_intent_promoted_to_success: false,
        objective_action_result_auto_exposed: false,
        post_outcome_experience_requires_explicit_bounded_actor_evidence: true,
      },
    };
  });
  const projection = {
    experience_contract_version: worldSimulationCharacterExperienceContractVersion,
    projection_version: worldSimulationCharacterExperienceProjectionVersion,
    historical_semantics_version: worldSimulationCharacterExperienceProjectionVersion,
    turn_id: nonEmptyString(preparedTurn.turn_id, "prepared turn_id"),
    character_projections: characterProjections,
    boundaries: {
      objective_world_history_remains_source_of_truth: true,
      full_next_world_state_stored_here: false,
      replay_uses_stored_historical_projection: true,
      current_perception_engine_reinterpretation_required_for_replay: false,
      character_brain_authors_projection: false,
      character_brain_authors_receipt: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return cloneJson(projection);
}

function buildCommittedCharacterExperienceReceipt({
  worldLineage,
  runtimeSnapshot,
  historyEntry,
  projectionEnvelope,
  characterProjection,
}) {
  const revision = Number(historyEntry?.revision_to);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Committed Character Experience receipt requires a committed revision.");
  }
  const committedTurnId = nonEmptyString(
    historyEntry?.turn_id,
    "committed character experience history turn_id",
  );
  if (projectionEnvelope?.turn_id !== committedTurnId) {
    const error = new Error(
      "Committed Character Experience projection turn_id does not match committed history.",
    );
    error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_TURN_MISMATCH";
    throw error;
  }
  const experienceSequence = Number(characterProjection?.experience_sequence);
  if (!Number.isSafeInteger(experienceSequence) || experienceSequence < 1) {
    const error = new Error("Committed Character Experience receipt sequence is invalid.");
    error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_SEQUENCE_INVALID";
    throw error;
  }
  const receiptIdentity = {
    world_lineage: worldLineage,
    committed_turn_id: committedTurnId,
    committed_revision: revision,
    character_entity_id: runtimeSnapshot.character_entity_id,
    projection_slot: characterProjection.projection_slot,
    experience_sequence: experienceSequence,
    experience_contract_version: projectionEnvelope.experience_contract_version,
    projection_version: projectionEnvelope.projection_version,
  };
  return {
    receipt_id: `character_experience_${hashAgentRunValue(receiptIdentity).slice(0, 28)}`,
    experience_contract_version: projectionEnvelope.experience_contract_version,
    projection_version: projectionEnvelope.projection_version,
    historical_semantics_version: projectionEnvelope.historical_semantics_version,
    projection_hash: projectionEnvelope.projection_hash,
    world_lineage: worldLineage,
    committed_turn_id: committedTurnId,
    committed_revision: revision,
    projection_slot: characterProjection.projection_slot,
    experience_sequence: experienceSequence,
    character_entity_id: runtimeSnapshot.character_entity_id,
    character: characterProjection.character,
    experience: cloneJson(characterProjection.experience),
    boundaries: {
      world_truth_is_not_character_experience: true,
      character_experience_is_not_memory: true,
      full_world_state_exposed: false,
      hidden_causal_chain_exposed: false,
      projector_metadata_exposed_to_character_brain: false,
      durable_mind_mutation: false,
    },
  };
}

export async function resolveWorldSimulationFormalCharacterIdentity(
  character,
  options = {},
) {
  const requestedName = nonEmptyString(character, "character");
  const normalizedRequestedName = normalizeEntityName(requestedName);
  const { registry } = await getStructuredEntityRegistry(
    options.characterIdentityRegistryOptions ?? {},
  );
  // Registry status may reflect incomplete character details (for example an
  // unconfirmed ability). Formal Runtime identity is the stable character
  // entity_id itself, not whether every character field is already settled.
  const matches = array(registry.characters).filter((entity) => {
    if (entity.entity_id === requestedName) return true;
    const names = [entity.canonical_name, ...array(entity.aliases)];
    return names.some((name) => normalizeEntityName(name) === normalizedRequestedName);
  });

  if (matches.length === 1) {
    return {
      entity_id: nonEmptyString(matches[0].entity_id, "character entity_id"),
      canonical_name: nonEmptyString(matches[0].canonical_name, "character canonical_name"),
      identity_source: "structured_canon_entity_registry",
      formal: true,
    };
  }

  if (matches.length > 1) {
    const error = new Error(
      `Formal character identity is ambiguous for ${requestedName}.`,
    );
    error.code = "WORLD_SIMULATION_CHARACTER_IDENTITY_AMBIGUOUS";
    throw error;
  }

  if (options.fixtureRoot) {
    return {
      entity_id: `fixture_character_${hashAgentRunValue({ character: requestedName }).slice(0, 20)}`,
      canonical_name: requestedName,
      identity_source: "test_fixture_ephemeral_identity",
      formal: false,
    };
  }

  const error = new Error(
    `Formal character identity could not be resolved for ${requestedName}.`,
  );
  error.code = "WORLD_SIMULATION_CHARACTER_IDENTITY_NOT_FOUND";
  throw error;
}

async function resolveCharacterRuntimeWorldLineage(
  worldSimulationSessionId,
  options = {},
) {
  const sessionId = nonEmptyString(
    worldSimulationSessionId,
    "world_simulation_session_id",
  );
  if (typeof options.characterRuntimeWorldLineageResolver !== "function") {
    return sessionId;
  }
  return nonEmptyString(
    await options.characterRuntimeWorldLineageResolver({
      world_simulation_session_id: sessionId,
    }),
    "character runtime world lineage",
  );
}

function createCharacterRuntimeInstance({ worldLineage, identity }) {
  const runtimeId = `character_runtime_${hashAgentRunValue({
    world_lineage: worldLineage,
    character_entity_id: identity.entity_id,
  }).slice(0, 20)}`;
  let queueTail = Promise.resolve();
  let activeTurns = 0;
  let pendingTurns = 0;
  let pendingExperienceDeliveries = 0;
  let lastCommittedExperienceRevision = null;
  let lastCommittedExperienceSequence = 0;
  const consumedExperienceReceiptIds = new Set();
  const recentExperienceReceipts = [];
  const lifecycle = {
    turns_started: 0,
    turns_completed: 0,
    turns_failed: 0,
    max_concurrent_turns: 0,
  };
  const experienceLifecycle = {
    delivery_attempts: 0,
    committed_experience_effect_count: 0,
    duplicate_delivery_attempts: 0,
    delivery_failures: 0,
  };

  function enqueueRuntimeOperation(execute, onSettled) {
    const queued = queueTail.then(execute, execute);
    const tracked = queued.finally(onSettled);
    queueTail = tracked.then(() => undefined, () => undefined);
    return tracked;
  }

  async function runTurn(brainInput, characterBrain) {
    if (typeof characterBrain !== "function") {
      const error = new Error("Character Runtime requires a characterBrain backend.");
      error.code = "WORLD_SIMULATION_CHARACTER_BRAIN_REQUIRED";
      throw error;
    }
    const execute = async () => {
      lifecycle.turns_started += 1;
      activeTurns += 1;
      lifecycle.max_concurrent_turns = Math.max(
        lifecycle.max_concurrent_turns,
        activeTurns,
      );
      if (activeTurns !== 1) {
        activeTurns -= 1;
        const error = new Error("Character Runtime turn became reentrant.");
        error.code = "WORLD_SIMULATION_CHARACTER_RUNTIME_REENTRANT";
        throw error;
      }
      try {
        const selection = await characterBrain(cloneJson(brainInput));
        lifecycle.turns_completed += 1;
        return selection;
      } catch (error) {
        lifecycle.turns_failed += 1;
        throw error;
      } finally {
        activeTurns -= 1;
      }
    };
    pendingTurns += 1;
    return enqueueRuntimeOperation(execute, () => {
      pendingTurns -= 1;
    });
  }

  async function consumeCommittedExperience(receipt) {
    const detachedReceipt = cloneJson(receipt);
    pendingExperienceDeliveries += 1;
    return enqueueRuntimeOperation(async () => {
      experienceLifecycle.delivery_attempts += 1;
      try {
        if (detachedReceipt.character_entity_id !== identity.entity_id) {
          const error = new Error("Committed Character Experience receipt character identity does not match Runtime identity.");
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_IDENTITY_MISMATCH";
          throw error;
        }
        if (consumedExperienceReceiptIds.has(detachedReceipt.receipt_id)) {
          experienceLifecycle.duplicate_delivery_attempts += 1;
          return {
            consumed: false,
            duplicate: true,
            receipt_id: detachedReceipt.receipt_id,
            committed_revision: detachedReceipt.committed_revision,
            experience_sequence: detachedReceipt.experience_sequence,
          };
        }
        const revision = Number(detachedReceipt.committed_revision);
        if (!Number.isSafeInteger(revision) || revision < 1) {
          const error = new Error("Committed Character Experience receipt revision is invalid.");
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_REVISION_INVALID";
          throw error;
        }
        const experienceSequence = Number(detachedReceipt.experience_sequence);
        if (!Number.isSafeInteger(experienceSequence) || experienceSequence < 1) {
          const error = new Error("Committed Character Experience receipt sequence is invalid.");
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_SEQUENCE_INVALID";
          throw error;
        }
        const expectedExperienceSequence = lastCommittedExperienceSequence + 1;
        if (experienceSequence !== expectedExperienceSequence) {
          const error = new Error(
            `Committed Character Experience receipt is out of order: expected sequence ${expectedExperienceSequence}, received ${experienceSequence}.`,
          );
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_OUT_OF_ORDER";
          throw error;
        }
        if (lastCommittedExperienceRevision !== null
          && revision <= lastCommittedExperienceRevision) {
          const error = new Error(
            `Committed Character Experience receipt revision is out of order: last ${lastCommittedExperienceRevision}, received ${revision}.`,
          );
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_OUT_OF_ORDER";
          throw error;
        }
        consumedExperienceReceiptIds.add(detachedReceipt.receipt_id);
        lastCommittedExperienceRevision = revision;
        lastCommittedExperienceSequence = experienceSequence;
        experienceLifecycle.committed_experience_effect_count += 1;
        recentExperienceReceipts.push(detachedReceipt);
        if (recentExperienceReceipts.length > 16) recentExperienceReceipts.shift();
        return {
          consumed: true,
          duplicate: false,
          receipt_id: detachedReceipt.receipt_id,
          committed_revision: revision,
          experience_sequence: experienceSequence,
        };
      } catch (error) {
        experienceLifecycle.delivery_failures += 1;
        throw error;
      }
    }, () => {
      pendingExperienceDeliveries -= 1;
    });
  }

  function snapshot() {
    return {
      runtime_version: worldSimulationCharacterRuntimeVersion,
      runtime_id: runtimeId,
      world_lineage: worldLineage,
      character_entity_id: identity.entity_id,
      canonical_name: identity.canonical_name,
      identity_source: identity.identity_source,
      formal_identity: identity.formal === true,
      lifecycle: cloneJson(lifecycle),
      active_turns: activeTurns,
      pending_turns: pendingTurns,
      pending_runtime_operations: pendingTurns + pendingExperienceDeliveries,
      committed_experience: {
        ...cloneJson(experienceLifecycle),
        last_committed_revision: lastCommittedExperienceRevision,
        last_experience_sequence: lastCommittedExperienceSequence,
        pending_deliveries: pendingExperienceDeliveries,
        recent_receipts: cloneJson(recentExperienceReceipts),
        receipt_identity_cache_size: consumedExperienceReceiptIds.size,
      },
      durable_mind_persistence: false,
      durable_mind_mutation_count: 0,
    };
  }

  return { runTurn, consumeCommittedExperience, snapshot };
}

export function createWorldSimulationCharacterRuntimeManager(config = {}) {
  const identityResolver = typeof config.identityResolver === "function"
    ? config.identityResolver
    : resolveWorldSimulationFormalCharacterIdentity;
  const runtimes = new Map();

  function getOrCreateRuntimeByResolvedIdentity({ worldLineage, identity }) {
    const resolvedWorldLineage = nonEmptyString(
      worldLineage,
      "character runtime world lineage",
    );
    const entityId = nonEmptyString(identity?.entity_id, "character entity_id");
    const key = JSON.stringify([resolvedWorldLineage, entityId]);
    let runtime = runtimes.get(key);
    if (!runtime) {
      runtime = createCharacterRuntimeInstance({
        worldLineage: resolvedWorldLineage,
        identity: {
          entity_id: entityId,
          canonical_name: identity?.canonical_name ?? entityId,
          identity_source: identity?.identity_source ?? "resolved_character_runtime_identity",
          formal: identity?.formal === true,
        },
      });
      runtimes.set(key, runtime);
    }
    return runtime;
  }

  async function getRuntime(input = {}, options = {}) {
    const character = nonEmptyString(input.character, "character");
    const worldLineage = await resolveCharacterRuntimeWorldLineage(
      input.world_simulation_session_id,
      options,
    );
    const identity = await identityResolver(character, options);
    return getOrCreateRuntimeByResolvedIdentity({
      worldLineage,
      identity: {
        entity_id: identity?.entity_id,
        canonical_name: identity?.canonical_name ?? character,
        identity_source: identity?.identity_source ?? "custom_character_identity_resolver",
        formal: identity?.formal === true,
      },
    });
  }

  async function runCharacterTurn(input = {}, options = {}) {
    const runtime = await getRuntime(input, options);
    return runtime.runTurn(input.brain_input, input.characterBrain);
  }

  async function deliverCommittedExperience(input = {}, options = {}) {
    const historyEntry = object(input.history_entry);
    const projectionEnvelope = verifyCharacterExperienceProjectionEnvelope(
      input.projection_envelope
      ?? historyEntry.committed_character_experience_projection,
    );
    const characterProjection = object(input.character_projection);
    const character = nonEmptyString(characterProjection.character, "experience projection character");
    const runtime = getOrCreateRuntimeByResolvedIdentity({
      worldLineage: nonEmptyString(
        characterProjection.world_lineage,
        "historical committed character experience world lineage",
      ),
      identity: {
        entity_id: nonEmptyString(
          characterProjection.character_entity_id,
          "historical committed character experience character entity_id",
        ),
        canonical_name: characterProjection.canonical_name ?? character,
        identity_source:
          characterProjection.identity_source
          ?? "historical_committed_character_experience_projection",
        formal: characterProjection.formal_identity === true,
      },
    });
    const runtimeSnapshot = runtime.snapshot();
    const receipt = buildCommittedCharacterExperienceReceipt({
      worldLineage: runtimeSnapshot.world_lineage,
      runtimeSnapshot,
      historyEntry,
      projectionEnvelope,
      characterProjection,
    });
    const result = await runtime.consumeCommittedExperience(receipt);
    return {
      ...result,
      character,
      character_entity_id: runtimeSnapshot.character_entity_id,
      receipt: cloneJson(receipt),
    };
  }

  async function deliverCommittedExperienceProjection(input = {}, options = {}) {
    const historyEntry = object(input.history_entry);
    const projectionEnvelope = verifyCharacterExperienceProjectionEnvelope(
      historyEntry.committed_character_experience_projection,
    );
    const characterProjections = array(projectionEnvelope.character_projections);
    const settledDeliveries = await Promise.allSettled(
      characterProjections.map((characterProjection) => (
        deliverCommittedExperience({
          world_simulation_session_id: input.world_simulation_session_id,
          history_entry: historyEntry,
          projection_envelope: projectionEnvelope,
          character_projection: characterProjection,
        }, options)
      )),
    );
    const deliveries = settledDeliveries
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value);
    const failures = settledDeliveries
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "rejected")
      .map(({ item, index }) => ({
        projection_slot: characterProjections[index]?.projection_slot ?? index,
        character: characterProjections[index]?.character ?? null,
        character_entity_id: characterProjections[index]?.character_entity_id ?? null,
        error_code:
          item.reason?.code
          ?? "WORLD_SIMULATION_CHARACTER_EXPERIENCE_DELIVERY_FAILED",
        error_message: item.reason?.message ?? String(item.reason),
      }));
    return {
      projection_version: projectionEnvelope.projection_version,
      experience_contract_version: projectionEnvelope.experience_contract_version,
      projection_hash: projectionEnvelope.projection_hash,
      delivery_count: characterProjections.length,
      consumed_count: deliveries.filter((item) => item.consumed === true).length,
      duplicate_count: deliveries.filter((item) => item.duplicate === true).length,
      failed_count: failures.length,
      delivery_failed: failures.length > 0,
      replay_required: failures.length > 0,
      deliveries,
      failures,
    };
  }

  async function inspectRuntime(input = {}, options = {}) {
    return (await getRuntime(input, options)).snapshot();
  }

  async function releaseWorldLineage(worldSimulationSessionId, options = {}) {
    const worldLineage = await resolveCharacterRuntimeWorldLineage(
      worldSimulationSessionId,
      options,
    );
    const matching = [...runtimes.entries()].filter(([, runtime]) => (
      runtime.snapshot().world_lineage === worldLineage
    ));
    if (matching.some(([, runtime]) => runtime.snapshot().pending_runtime_operations > 0)) {
      const error = new Error(
        `Character Runtime world lineage ${worldLineage} is busy and cannot be released.`,
      );
      error.code = "WORLD_SIMULATION_CHARACTER_RUNTIME_LINEAGE_BUSY";
      throw error;
    }
    for (const [key] of matching) runtimes.delete(key);
    return matching.length;
  }

  return {
    runtime_version: worldSimulationCharacterRuntimeVersion,
    experience_contract_version: worldSimulationCharacterExperienceContractVersion,
    experience_projection_version: worldSimulationCharacterExperienceProjectionVersion,
    getRuntime,
    runCharacterTurn,
    deliverCommittedExperience,
    deliverCommittedExperienceProjection,
    inspectRuntime,
    releaseWorldLineage,
    runtimeCount: () => runtimes.size,
  };
}

const defaultWorldSimulationCharacterRuntimeManager =
  createWorldSimulationCharacterRuntimeManager();

export async function replayWorldSimulationCommittedCharacterExperiences(
  worldSimulationSessionId,
  options = {},
) {
  const sessionId = nonEmptyString(
    worldSimulationSessionId,
    "world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const history = await getWorldSimulationHistory(sessionId, options);
  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.deliverCommittedExperienceProjection !== "function") {
    throw new Error(
      "characterRuntimeManager must provide deliverCommittedExperienceProjection().",
    );
  }
  const committedTurns = array(history.turns)
    .filter((turn) => isObject(turn?.committed_character_experience_projection))
    .sort((left, right) => Number(left.revision_to) - Number(right.revision_to));
  const replayed = [];
  for (const historyEntry of committedTurns) {
    replayed.push(await characterRuntimeManager.deliverCommittedExperienceProjection(
      {
        world_simulation_session_id: sessionId,
        history_entry: historyEntry,
      },
      options,
    ));
  }
  const failedCount = replayed.reduce((sum, item) => sum + (item.failed_count ?? 0), 0);
  return {
    ok: failedCount === 0,
    world_simulation_session_id: sessionId,
    replay_source: "immutable_committed_world_history",
    current_perception_engine_reanalysis_used: false,
    historical_projection_semantics_preserved: true,
    committed_turns_with_projection: committedTurns.length,
    delivery_count: replayed.reduce((sum, item) => sum + item.delivery_count, 0),
    consumed_count: replayed.reduce((sum, item) => sum + item.consumed_count, 0),
    duplicate_count: replayed.reduce((sum, item) => sum + item.duplicate_count, 0),
    failed_count: failedCount,
    replay_required: failedCount > 0,
    replays: replayed,
  };
}

function characterMapValue(map, character) {
  if (!isObject(map)) return undefined;
  if (Object.hasOwn(map, character)) return map[character];
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  for (const [key, value] of Object.entries(map)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) {
      return value;
    }
  }
  return undefined;
}

function currentEvent(worldState, requestedEventId = null) {
  const queue = array(worldState.event_queue);
  if (!queue.length) {
    const error = new Error("World simulation event_queue is empty.");
    error.code = "WORLD_SIMULATION_EVENT_QUEUE_EMPTY";
    throw error;
  }
  const event = object(queue[0]);
  const eventId = nonEmptyString(event.event_id ?? event.id, "event_queue[0].event_id");
  if (requestedEventId !== null && requestedEventId !== undefined) {
    const requested = nonEmptyString(requestedEventId, "event_id");
    if (requested !== eventId) {
      const error = new Error(
        `Event-driven simulation must resolve the queue head first: expected ${eventId}, received ${requested}.`,
      );
      error.code = "WORLD_SIMULATION_EVENT_ORDER_VIOLATION";
      throw error;
    }
  }
  return { ...cloneJson(event), event_id: eventId };
}

function currentScene(worldState, event) {
  const sceneId = event.scene_id ?? event.location_id ?? null;
  const scenes = object(worldState.scenes);
  if (sceneId && isObject(scenes[sceneId])) return cloneJson(scenes[sceneId]);
  if (isObject(worldState.scene_state)) return cloneJson(worldState.scene_state);
  if (isObject(worldState.current_scene)) return cloneJson(worldState.current_scene);
  throw new Error("World simulation state has no scene for the current event.");
}

function participantsForEvent(worldState, event) {
  const requested = array(event.participants ?? event.character_names)
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
  const active = requested.length
    ? requested
    : array(worldState.active_characters)
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean);
  if (!active.length) {
    throw new Error("Current world event has no named-character participants.");
  }
  return [...new Set(active)];
}

function runOptions(options, sessionId, source) {
  return {
    ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
    run_id: sessionId,
    source,
  };
}

function boundedMemoryProjectionMaxItems(
  value,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number)
    || number < 0
  ) {
    return null;
  }

  return Math.min(
    32,
    number,
  );
}

function memoryProjectionPolicyFor(
  event,
  character,
  accessibilityResult,
) {
  const eventPolicy =
    object(
      event?.memory_projection_policy,
    );

  const byCharacter =
    object(
      eventPolicy.by_character,
    );

  const characterPolicy =
    object(
      characterMapValue(
        byCharacter,
        character,
      ),
    );

  const hasCharacterLimit =
    Object.hasOwn(
      characterPolicy,
      "max_items",
    );

  const hasEventLimit =
    Object.hasOwn(
      eventPolicy,
      "max_items",
    );

  if (
    hasCharacterLimit
    || hasEventLimit
  ) {
    const raw =
      hasCharacterLimit
        ? characterPolicy.max_items
        : eventPolicy.max_items;

    const maxItems =
      boundedMemoryProjectionMaxItems(
        raw,
      );

    if (maxItems === null) {
      const error = new Error(
        "memory_projection_policy.max_items must be an integer from 0 through 32.",
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_PROJECTION_MAX_ITEMS_INVALID";

      throw error;
    }

    return {
      max_items:
        maxItems,

      origin:
        hasCharacterLimit
          ? "event_character_projection_policy"
          : "event_projection_policy",
    };
  }

  const legacyMax =
    boundedMemoryProjectionMaxItems(
      accessibilityResult
        ?.legacy_projection_max_items,
    );

  if (legacyMax !== null) {
    return {
      max_items:
        legacyMax,

      origin:
        "legacy_phase63b_profile_compatibility",
    };
  }

  return {
    max_items:
      null,

    origin:
      "default_memory_context_projection_policy",
  };
}

async function capability(sessionId, name, input, options, traceIds) {
  const result = await runWorldSimulationNativeCapability(
    name,
    input,
    runOptions(options, sessionId, `world_simulation_loop:${name}`),
  );
  traceIds.push(result.trace.trace_id);
  return result.output;
}

async function resolveMemoryRetrievalResolution(
  context,
  options,
) {
  const resolver =
    typeof options.memoryRetrievalResolver === "function"
      ? options.memoryRetrievalResolver
      : null;

  if (!resolver) {
    return {
      resolution: {
        process_occurred: false,
      },
      audit: {
        resolver_used: false,
        missing_resolver_means_no_process: true,
        candidate_presence_implies_process: false,
        world_state_exposed_to_resolver: false,
        full_world_event_exposed_to_resolver: false,
        candidate_content_engine_side_only: true,
      },
    };
  }

  const input = {
    character:
      context.character,
    query:
      cloneJson(context.query),
    candidate_memory_records:
      cloneJson(context.candidate_memory_records),
    candidate_evaluations:
      cloneJson(context.candidate_evaluations),
    perception:
      cloneJson(context.perception),
    character_state:
      cloneJson(context.character_state),
  };

  const inputSnapshot =
    cloneJson(input);

  const raw =
    await resolver(
      cloneJson(inputSnapshot),
    );

  if (!isObject(raw)) {
    const error = new Error(
      "memoryRetrievalResolver must return one explicit retrieval-process resolution object.",
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_RESOLVER_INVALID_OUTPUT";
    throw error;
  }

  return {
    resolution:
      cloneJson(raw),
    audit: {
      resolver_used: true,
      input_context_hash:
        hashAgentRunValue(inputSnapshot),
      world_state_exposed_to_resolver: false,
      full_world_event_exposed_to_resolver: false,
      candidate_content_engine_side_only: true,
      resolver_may_author_recovered_content: false,
      resolver_selects_source_grounding_only: true,
    },
  };
}

function candidateSelection(candidateOutput, selection, character) {
  const candidates = array(candidateOutput.candidate_action_intents);
  if (selection === null || selection === undefined || selection === "reject_all") {
    return {
      character,
      selection: "reject_all",
      action_id: null,
      intent: null,
      candidate: null,
    };
  }
  const actionId = typeof selection === "string"
    ? selection.trim()
    : String(selection?.action_id ?? selection?.id ?? "").trim();
  if (!actionId) {
    throw new Error(`Character brain selection for ${character} must provide action_id or reject_all.`);
  }
  const candidate = candidates.find((item) => String(item.action_id) === actionId);
  if (!candidate) {
    const error = new Error(
      `Character brain selected unavailable action ${actionId} for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_ACTION_NOT_AVAILABLE";
    throw error;
  }
  return {
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: candidate.intent ?? null,
    candidate: cloneJson(candidate),
  };
}

function assertCausalResolution(value) {
  if (!isObject(value)) {
    throw new Error("causalAdjudicator must return an object.");
  }
  if (!isObject(value.next_world_state)) {
    throw new Error("causalAdjudicator must return next_world_state.");
  }
  return value;
}

function applySubjectiveMemoryPreview(worldState, formationResult) {
  const preview = cloneJson(worldState);
  preview.memories = object(preview.memories);
  for (const update of array(formationResult?.character_updates)) {
    const character = String(update?.character ?? "").trim();
    if (!character || !Array.isArray(update?.memory_records) || update.memory_records.length === 0) continue;
    const current = array(characterMapValue(preview.memories, character)).map(cloneJson);
    preview.memories[character] = [...current, ...update.memory_records.map(cloneJson)];
  }
  return preview;
}

export function buildWorldSimulationLoopContract() {
  return {
    version: worldSimulationLoopVersion,
    scheduling: "event_driven",
    world_state_owner: "programmatic_world_simulator",
    character_choice_owner: "chatgpt_character_brain",
    character_runtime: {
      version: worldSimulationCharacterRuntimeVersion,
      identity: "world_lineage_plus_formal_character_entity_id",
      current_world_lineage_carrier: "world_simulation_session_id",
      current_world_lineage_carrier_is_permanent_world_philosophy: false,
      same_runtime_reentrant: false,
      same_runtime_turns_serialized: true,
      different_runtimes_share_turn_lock: false,
      storage_scope: "process_local_ephemeral_memory",
      lifecycle_release_requires_idle: true,
      delegates_existing_character_brain_backend: true,
      durable_mind_persistence: false,
      durable_mind_mutation_before_world_commit: false,
      committed_experience_delivery: "at_least_once_with_idempotent_runtime_consumption",
      committed_experience_ordering_scope: "world_lineage_plus_character_entity_id",
      committed_experience_ordering_mechanism:
        "contiguous_per_character_experience_sequence_plus_committed_revision",
      committed_experience_sequence_source: "immutable_committed_world_history",
      committed_experience_global_delivery_lock: false,
      durable_experience_cursor_installed: false,
    },
    committed_character_experience: {
      experience_contract_version: worldSimulationCharacterExperienceContractVersion,
      projection_version: worldSimulationCharacterExperienceProjectionVersion,
      owner: "server_owned_programmatic_boundary",
      world_truth_is_character_experience: false,
      character_experience_is_memory: false,
      established_only_after_successful_world_commit: true,
      blocked_or_failed_commit_delivery_count: 0,
      history_storage: "hybrid_event_projection",
      objective_source_of_truth: "committed_world_history",
      full_next_world_state_stored_in_projection: false,
      deterministic_receipt_identity: true,
      replay_uses_historical_projection_semantics: true,
      replay_reinterprets_history_with_current_perception_engine: false,
      participant_and_observer_channels_distinct: true,
      participant_intent_is_successful_outcome: false,
      objective_action_result_auto_exposed: false,
      explicit_bounded_actor_experience_evidence_required_for_post_outcome_experience: true,
      hidden_world_truth_allowed: false,
      projector_metadata_exposed_to_character_brain: false,
      gpt_may_author_receipt: false,
      gpt_may_modify_projection_version: false,
      receipt_auto_consolidates_memory: false,
      phase63_subjective_memory_contract_replaced: false,
    },
    causal_outcome_owner: "programmatic_causal_adjudicator",
    commit_policy: "consistency_critic_must_report_zero_hard_conflicts",
    character_brain_receives_world_truth: false,
    character_brain_receives_engine_simulation_time: false,
    character_brain_receives_engine_scene_id: false,
    character_brain_receives_capability_runtime_metadata: false,
    character_brain_receives_raw_world_event: false,
    character_brain_receives_session_or_turn_identity: false,
    character_facing_capability_envelopes_enforced: true,
    engine_integrity_capability_envelopes_enforced: true,
    scene_neural_advisory_is_causal_input: false,
    consistency_neural_advisory_is_commit_gate: false,
    agency_neural_advisory_is_security_policy: false,
    neural_capabilities_may_mutate_world_state: false,
    causal_adjudicator_required: true,
    visibility_and_occlusion: buildWorldSimulationVisibilityQueryContract(),
    directional_height_visibility: buildWorldSimulationDirectionalHeightVisibilityContract(),
    illumination_visibility: buildWorldSimulationIlluminationVisibilityContract(),
    audibility_and_sound_propagation: buildWorldSimulationAudibilityQueryContract(),
    subjective_memory_formation: buildWorldSimulationSubjectiveMemoryFormationContract(),
    subjective_memory_accessibility: buildWorldSimulationMemoryAccessibilityContract(),
    retrieval_practice_activation_projection:
      buildWorldSimulationRetrievalPracticeActivationProjectionContract(),
    base_level_activation_projection:
      buildWorldSimulationBaseLevelActivationProjectionContract(),
    query_relative_cue_diagnostic_evidence_projection:
      buildWorldSimulationCueDiagnosticEvidenceProjectionContract(),
    subjective_memory_retrieval_process: buildWorldSimulationMemoryRetrievalProcessV3Contract(),
    subjective_memory_retrieval_process_step3_compatibility:
      buildWorldSimulationMemoryRetrievalProcessContract(),
    subjective_memory_retrieval_persistence:
      buildWorldSimulationMemoryRetrievalPersistenceContract(),

    memory_context_projection: {
      owner:
        "engine_memory_context_projector",

      accessibility_candidate_set_is_authoritative_input:
        true,

      projection_budget_is_separate_from_memory_accessibility:
        true,

      projection_budget_is_cognitive_capacity:
        false,

      projection_budget_zero_allowed:
        true,

      legacy_phase63b_max_items_fallback_supported:
        true,

      actual_retrieval_success_asserted:
        false,

      output_is_character_brain_memory_context_projection:
        true,

      engine_retrieval_context_exposed_to_character_brain:
        false,

      engine_projection_policy_exposed_to_character_brain:
        false,

      projection_appends_retrieval_history:
        false,

      projection_updates_recall_count:
        false,

      projection_updates_last_recalled_at:
        false,

      same_cycle_projection_feeds_memory_accessibility:
        false,

      actual_retrieval_event_owner:
        "Phase63C",

      phase63c_schema_contract_installed:
        true,

      phase63c_runtime_version:
        worldSimulationMemoryRetrievalProcessV3Version,

      phase63c_step3_compatibility_runtime_version:
        worldSimulationMemoryRetrievalProcessVersion,

      candidate_content_barrier_enforced:
        true,

      candidate_content_barrier_owner:
        "Phase63C Step2",

      native_character_brain_memory_channel:
        "recovered_memories",

      native_recovered_memories_default_empty_until_retrieval_kernel:
        false,

      missing_retrieval_resolver_means_no_process:
        true,

      retrieval_experience_channel:
        "retrieval_experience",

      legacy_projector_api_preserved:
        true,

      legacy_projector_output_engine_only_in_native_loop:
        true,

      legacy_projected_memory_content_forwarded_to_character_brain:
        false,

      native_retrieval_process_execution_installed:
        true,

      retrieval_event_persistence_installed:
        true,

      retrieval_event_persistence_version:
        worldSimulationMemoryRetrievalPersistenceVersion,

      same_cycle_retrieval_history_feedback_allowed:
        false,
    },

    subjective_memory_retrieval_stage_resolution_hook: {
      owner:
        "programmatic_memory_retrieval_stage_resolver",

      optional:
        true,

      option_name:
        "memoryRetrievalStageResolver",

      staged_lifecycle:
        true,

      stages: [
        "initiation",
        "recovery",
        "continuation",
      ],

      conditional_stages: [
        "cue_construction",
      ],

      cue_construction_request_field:
        "cue_construction_requested",

      cue_construction_actual_materialized_sources_only:
        true,

      cue_construction_character_state_exposed:
        false,

      cue_construction_full_memory_records_exposed:
        false,

      cue_construction_unrecovered_memory_content_exposed:
        false,

      cue_construction_world_state_exposed:
        false,

      cue_construction_future_event_queue_exposed:
        false,

      episode_local_evidence_reprojection_is_engine_side:
        true,

      episode_local_evidence_reprojection_r4b1_process_wide_baseline_reused:
        true,

      r4d_used_during_episode_local_reprojection:
        false,

      global_termination_decision_semantics_engine_side:
        true,

      global_termination_new_resolver_stage_added:
        false,

      global_termination_stopping_rule_modeled:
        false,

      global_termination_r4d_consumed_online:
        false,

      technical_step_budget_option:
        "memoryRetrievalTechnicalStepBudget",

      technical_step_budget_is_cognitive_stopping_rule:
        false,

      technical_step_budget_exhaustion_fails_closed:
        true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      future_frontier_content_visible_to_earlier_stage:
        false,

      non_frontier_candidate_diagnostics_visible:
        false,

      resolver_may_author_recovered_memory_content:
        false,

      resolver_may_author_reinstated_cue_content:
        false,

      legacy_single_step_hook_preserved:
        true,
    },

    subjective_memory_retrieval_resolution_hook: {
      owner:
        "programmatic_memory_retrieval_resolver",

      optional: true,

      missing_hook_means_no_retrieval_process:
        true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      receives_frozen_candidate_content_engine_side:
        true,

      receives_phase63b_candidate_evaluations:
        true,

      receives_bounded_perception:
        true,

      receives_character_own_state:
        true,

      may_author_recovered_memory_content:
        false,

      selects_source_grounding_only:
        true,
    },

    subjective_memory_encoding_decision_hook: {
      owner:
        "programmatic_memory_encoding_decider",

      optional: true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      receives_bounded_perception:
        true,

      receives_bounded_cognition:
        true,

      character_brain_direct_encoding_control_allowed:
        false,

      missing_hook_preserves_legacy_encoding:
        true,
    },

    subjective_memory_episode_binding_hook: {
      owner:
        "programmatic_subjective_episode_binder",

      optional:
        true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      receives_bounded_perception:
        true,

      receives_bounded_cognition:
        true,

      receives_encoding_decisions:
        true,

      automatic_event_segmentation:
        false,

      world_event_id_auto_used_as_episode_id:
        false,

      character_brain_direct_episode_binding_allowed:
        false,
    },
    character_perception_visuals_use_programmatic_visibility: true,
    character_perception_visuals_use_directional_height_visibility: true,
    character_perception_visuals_use_illumination_visibility: true,
    character_perception_audio_uses_programmatic_audibility: true,
    built_in_causal_rule_engine: buildWorldSimulationCausalRuleContract(),
    custom_causal_adjudicator_override_supported: true,
    stale_state_commit_rejected: true,
    replay_chain_uses_state_hashes: true,
  };
}

export async function prepareWorldSimulationTurn(input = {}, options = {}) {
  const sessionId = nonEmptyString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const snapshot = await getWorldSimulationState(sessionId, options);
  const worldState = snapshot.state;
  const event = currentEvent(worldState, input.event_id ?? null);
  const sceneState = currentScene(worldState, event);
  const participants = participantsForEvent(worldState, event);
  const traceIds = [];
  const visibilityQueries = [];
  const directionalHeightVisibilityQueries = [];
  const illuminationVisibilityQueries = [];
  const audibilityQueries = [];
  const memoryAccessibilityQueries = [];
  const memoryRetrievalQueries = [];
  const memoryRetrievalProcesses = [];

  const turnId = `world_turn_${hashAgentRunValue({
    world_simulation_session_id: sessionId,
    revision: snapshot.revision,
    state_hash: snapshot.state_hash,
    event_id: event.event_id,
  }).slice(0, 20)}`;

  const sceneAnalysis = await capability(
    sessionId,
    "world_scene_causal_analyzer",
    {
      scene_state: sceneState,
      simulation_time: worldState.simulation_time ?? event.simulation_time ?? null,
      simultaneous_actions: [],
    },
    options,
    traceIds,
  );

  const decisionPackets = [];
  for (const character of participants) {
    const characterState = object(characterMapValue(worldState.characters, character));
    const memories = array(characterMapValue(worldState.memories, character));
    const retrievalPracticeActivationProjection =
      projectWorldSimulationRetrievalPracticeActivation({
        world_state:
          worldState,
        character,
        current_turn_id:
          turnId,
        as_of:
          worldState.simulation_time
          ?? event.simulation_time
          ?? null,
        memory_records:
          memories,
      });
    const baseLevelActivationProjection =
      projectWorldSimulationBaseLevelActivation({
        memory_records:
          memories,
        retrieval_practice_projection:
          retrievalPracticeActivationProjection,
      });
    const retrievalMemoryRecords =
      baseLevelActivationProjection
        .projected_memory_records;
    const availableActions = array(
      characterMapValue(worldState.available_actions, character),
    );
    const visibilityQuery = queryWorldSimulationObserverVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    visibilityQueries.push({
      observer: character,
      version: visibilityQuery.visibility_query_version,
      result: cloneJson(visibilityQuery.result),
      audit: cloneJson(visibilityQuery.audit),
    });
    const directionalHeightVisibilityQuery = queryWorldSimulationObserverDirectionalHeightVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    directionalHeightVisibilityQueries.push({
      observer: character,
      version: directionalHeightVisibilityQuery.directional_height_visibility_version,
      result: cloneJson(directionalHeightVisibilityQuery.result),
      audit: cloneJson(directionalHeightVisibilityQuery.audit),
    });
    const illuminationVisibilityQuery = queryWorldSimulationObserverIlluminationVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    illuminationVisibilityQueries.push({
      observer: character,
      version: illuminationVisibilityQuery.illumination_visibility_version,
      result: cloneJson(illuminationVisibilityQuery.result),
      audit: cloneJson(illuminationVisibilityQuery.audit),
    });
    const audibilityQuery = queryWorldSimulationObserverAudibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    audibilityQueries.push({
      observer: character,
      version: audibilityQuery.audibility_query_version,
      result: cloneJson(audibilityQuery.result),
      audit: cloneJson(audibilityQuery.audit),
    });
    const perception = await capability(
      sessionId,
      "world_perception_filter",
      {
        character,
        scene_state: sceneState,
        simulation_time: worldState.simulation_time ?? event.simulation_time ?? null,
        programmatic_visibility: {
          enforced: true,
          version: illuminationVisibilityQuery.illumination_visibility_version,
          base_visibility_version: visibilityQuery.visibility_query_version,
          directional_height_visibility_version: directionalHeightVisibilityQuery.directional_height_visibility_version,
          directional_height_visibility_enforced: true,
          illumination_visibility_enforced: illuminationVisibilityQuery.result.lighting_enforced === true,
          visual_observations: cloneJson(
            illuminationVisibilityQuery.result.perception_visual_observations,
          ),
        },
        programmatic_audibility: {
          enforced: audibilityQuery.result.audibility_enforced === true,
          version: audibilityQuery.audibility_query_version,
          auditory_observations: cloneJson(
            audibilityQuery.result.perception_auditory_observations,
          ),
        },
      },
      options,
      traceIds,
    );
    const characterPerception = cloneJson(
      perception.character_view
      ?? {
        character,
        observed: perception.observed ?? [],
        audible: perception.audible ?? [],
        other_senses: perception.other_senses ?? [],
        information_boundary: perception.information_boundary ?? {},
      },
    );

    const memoryAccessibilityBaseInput = {
      world_state:
        cloneJson(
          worldState,
        ),
      character,
      memory_records:
        cloneJson(
          retrievalMemoryRecords,
        ),
      simulation_time:
        worldState.simulation_time
        ?? event.simulation_time
        ?? null,
      scene_id:
        sceneState.scene_id
        ?? event.scene_id
        ?? event.location_id
        ?? null,
      perception:
        cloneJson(
          characterPerception,
        ),

      context_cues:
        cloneJson(
          object(
            event.memory_context_cues,
          ),
        ),

      retrieval_context:
        cloneJson(
          object(
            event.memory_retrieval_context,
          ),
        ),
    };

    const memoryAccessibilityQuery =
      queryWorldSimulationMemoryAccessibility(
        memoryAccessibilityBaseInput,
      );
    const cueDiagnosticEvidenceProjection =
      projectWorldSimulationCueDiagnosticEvidence({
        memory_accessibility_query:
          memoryAccessibilityQuery,
      });
    memoryAccessibilityQueries.push({
      observer: character,
      version: memoryAccessibilityQuery.memory_accessibility_version,
      result: cloneJson(memoryAccessibilityQuery.result),
      audit: cloneJson(memoryAccessibilityQuery.audit),
      retrieval_practice_activation_projection:
        cloneJson(
          retrievalPracticeActivationProjection.audit,
        ),
      base_level_activation_projection:
        cloneJson(
          baseLevelActivationProjection.audit,
        ),
      query_relative_cue_diagnostic_evidence_projection:
        cloneJson(
          cueDiagnosticEvidenceProjection.audit,
        ),
    });
    const memoryProjectionPolicy =
      memoryProjectionPolicyFor(
        event,
        character,
        memoryAccessibilityQuery.result,
      );

    const authoritativeCandidateRecords =
      cloneJson(
        memoryAccessibilityQuery
          .result
          .candidate_memory_records,
      );

    const retrievalContext =
      object(
        event.memory_retrieval_context,
      );

    const stagedMemoryRetrievalResolver =
      typeof options.memoryRetrievalStageResolver === "function"
        ? options.memoryRetrievalStageResolver
        : null;

    let memoryRetrievalQuery;
    let memoryRetrievalProcess;
    let memoryRetrievalResolutionAudit;

    if (stagedMemoryRetrievalResolver) {
      memoryRetrievalQuery =
        buildWorldSimulationMemoryRetrievalQueryV3({
          character,
          turn_id:
            turnId,
          phase63b_version:
            memoryAccessibilityQuery
              .memory_accessibility_version,
          memory_records:
            retrievalMemoryRecords,
          accessibility_base_input:
            memoryAccessibilityBaseInput,
          initial_accessibility_query:
            memoryAccessibilityQuery,
          initial_cue_diagnostic_projection:
            cueDiagnosticEvidenceProjection,
          retrieval_goal:
            retrievalContext
              .retrieval_goal
            ?? null,
        });

      memoryRetrievalProcess =
        await executeWorldSimulationMemoryRetrievalProcessV3({
          query:
            memoryRetrievalQuery,
          memory_records:
            retrievalMemoryRecords,
          accessibility_base_input:
            memoryAccessibilityBaseInput,
          initial_accessibility_query:
            memoryAccessibilityQuery,
          initial_base_level_activation_projection:
            baseLevelActivationProjection,
          initial_cue_diagnostic_projection:
            cueDiagnosticEvidenceProjection,
          resolver:
            stagedMemoryRetrievalResolver,
          technical_step_budget:
            options.memoryRetrievalTechnicalStepBudget,
          perception:
            characterPerception,
          character_state:
            characterState,
        });

      memoryRetrievalResolutionAudit = {
        resolver_used:
          true,
        staged_lifecycle:
          true,
        stage_audit:
          cloneJson(
            memoryRetrievalProcess
              .resolver_audit
            ?? [],
          ),
        world_state_exposed_to_resolver:
          false,
        full_world_event_exposed_to_resolver:
          false,
        future_frontier_content_exposed_to_earlier_stage:
          false,
        associative_activation_composition_evidence_exposed_to_resolver:
          false,
        retrieval_competition_monitoring_evidence_exposed_to_resolver:
          false,
        retrieval_search_control_readiness_evidence_exposed_to_resolver:
          false,
        grounded_retrieval_cue_construction_evidence_exposed_to_resolver:
          false,
        retrieval_episode_local_reprojection_evidence_exposed_to_resolver:
          false,
        retrieval_global_termination_decision_evidence_exposed_to_resolver:
          false,
        global_termination_r4d_consumed_online:
          false,
        r4d_used_during_episode_local_reprojection:
          false,
        cue_construction_character_state_exposed:
          false,
        cue_construction_full_memory_records_exposed:
          false,
        cue_construction_unrecovered_memory_content_exposed:
          false,
        cue_construction_world_state_exposed:
          false,
        cue_construction_future_event_queue_exposed:
          false,
        resolver_may_author_recovered_content:
          false,
        resolver_may_author_reinstated_cue_content:
          false,
      };
    } else {
      memoryRetrievalQuery =
        buildWorldSimulationMemoryRetrievalQuery({
          character,

          turn_id:
            turnId,

          phase63b_version:
            memoryAccessibilityQuery
              .memory_accessibility_version,

          candidate_memory_records:
            authoritativeCandidateRecords,

          initial_cues:
            array(
              retrievalContext
                .active_cues,
            ),

          retrieval_goal:
            retrievalContext
              .retrieval_goal
            ?? null,
        });

      const memoryRetrievalResolution =
        await resolveMemoryRetrievalResolution(
          {
            character,
            query:
              memoryRetrievalQuery,
            candidate_memory_records:
              authoritativeCandidateRecords,
            candidate_evaluations:
              memoryAccessibilityQuery
                .result
                .candidate_evaluations
              ?? [],
            perception:
              characterPerception,
            character_state:
              characterState,
          },
          options,
        );

      memoryRetrievalProcess =
        executeWorldSimulationMemoryRetrievalProcess({
          query:
            memoryRetrievalQuery,
          candidate_memory_records:
            authoritativeCandidateRecords,
          resolution:
            memoryRetrievalResolution.resolution,
        });

      memoryRetrievalResolutionAudit =
        cloneJson(
          memoryRetrievalResolution.audit,
        );
    }

    memoryRetrievalQueries.push({
      observer:
        character,

      version:
        memoryRetrievalProcess.version,

      query:
        cloneJson(
          memoryRetrievalQuery,
        ),
    });

    memoryRetrievalProcesses.push({
      observer:
        character,
      version:
        memoryRetrievalProcess.version,
      resolution_audit:
        cloneJson(
          memoryRetrievalResolutionAudit,
        ),
      result:
        cloneJson(
          memoryRetrievalProcess,
        ),
    });

    // Step 2 preserves the legacy projector invocation for
    // compatibility and neural trace continuity, but its output
    // is engine-only in the native world-loop path.
    const legacyMemoryProjection = await capability(
      sessionId,
      "world_memory_retriever",
      {
        character,

        memory_records:
          memories,

        query:
          event.memory_query
          ?? event.summary
          ?? event.type
          ?? null,

        projection_max_items:
          memoryProjectionPolicy
            .max_items
          ?? undefined,

        projection_policy_origin:
          memoryProjectionPolicy
            .origin,

        programmatic_memory_accessibility: {
          candidate_set_authoritative:
            true,

          accessibility_enforced:
            memoryAccessibilityQuery
              .result
              .accessibility_enforced
            === true,

          // Deprecated compatibility field retained for
          // capability consumers that still inspect it.
          enforced:
            memoryAccessibilityQuery
              .result
              .accessibility_enforced
            === true,

          version:
            memoryAccessibilityQuery
              .memory_accessibility_version,

          candidate_memory_records:
            authoritativeCandidateRecords,

          // Deprecated compatibility alias.
          memory_records:
            cloneJson(
              authoritativeCandidateRecords,
            ),
        },
      },
      options,
      traceIds,
    );
    // Phase63C Step 3 accepts only content that the actual
    // retrieval kernel materialized from the frozen candidate set.
    const recoveredMemories =
      cloneJson(
        memoryRetrievalProcess
          .recovered_memories
        ?? [],
      );

    const retrievalExperience =
      cloneJson(
        memoryRetrievalProcess
          .retrieval_experience
        ?? {
          process_occurred: false,
          initiation_mode: null,
          target_outcome: null,
          recovered_any_content: false,
        },
      );

    const cognition = await capability(
      sessionId,
      "world_character_cognition",
      {
        character,
        character_state: characterState,
        perception: characterPerception,

        recovered_memories:
          recoveredMemories,

        retrieval_experience:
          retrievalExperience,

        current_action:
          characterState.current_action
          ?? null,
      },
      options,
      traceIds,
    );
    const characterCognition = cloneJson(
      cognition.character_view
      ?? cognition,
    );
    const actionCandidates = await capability(
      sessionId,
      "world_action_proposer",
      {
        character,
        available_actions: availableActions,
        cognition: characterCognition,
        current_action: characterState.current_action ?? null,
      },
      options,
      traceIds,
    );
    const characterActionCandidates = cloneJson(
      actionCandidates.character_view
      ?? actionCandidates,
    );
    decisionPackets.push({
      character,

      perception:
        cloneJson(
          characterPerception,
        ),

      recovered_memories:
        cloneJson(
          recoveredMemories,
        ),

      // Deprecated compatibility alias. In the native Phase63C
      // path this aliases actually recovered content only and
      // never aliases Phase63B projected candidate content.
      retrieved_memories:
        cloneJson(
          recoveredMemories,
        ),

      retrieval_experience:
        cloneJson(
          retrievalExperience,
        ),

      cognition:
        cloneJson(
          characterCognition,
        ),
      candidate_action_intents:
        cloneJson(
          characterActionCandidates.candidate_action_intents,
        ),
      action_consideration:
        cloneJson(
          characterActionCandidates.neural_consideration
          ?? null,
        ),
      boundaries: {
        world_truth_exposed: false,
        r1_character_facing_envelopes_enforced: true,
        engine_simulation_time_exposed: false,
        engine_scene_id_exposed: false,
        capability_contract_metadata_exposed: false,
        capability_runtime_metadata_exposed: false,
        raw_world_event_exposed: false,
        engine_event_identity_exposed: false,
        engine_session_identity_exposed: false,
        engine_turn_identity_exposed: false,
        may_choose_action_intent_only: true,
        may_decide_outcome: false,
        programmatic_visibility_enforced: true,
        directional_height_visibility_enforced: true,
        illumination_visibility_enforced: illuminationVisibilityQuery.result.lighting_enforced === true,
        programmatic_audibility_enforced: audibilityQuery.result.audibility_enforced === true,
        programmatic_memory_accessibility_enforced:
          memoryAccessibilityQuery
            .result
            .accessibility_enforced
          === true,

        memory_accessibility_candidate_set_authoritative:
          true,

        memory_context_is_projection_not_successful_retrieval:
          true,

        candidate_content_barrier_enforced:
          true,

        unretrieved_candidate_content_exposed_to_character_brain:
          false,

        native_character_brain_memory_channel:
          "recovered_memories",

        recovered_memory_count:
          recoveredMemories.length,

        native_retrieval_process_execution_installed:
          true,

        retrieval_process_occurred:
          retrievalExperience
            .process_occurred
          === true,

        retrieval_target_outcome:
          retrievalExperience
            .target_outcome
          ?? null,

        legacy_memory_projection_engine_only:
          true,

        memory_projection_max_items:
          legacyMemoryProjection
            .projection_max_items,

        memory_projection_budget_is_cognitive_capacity:
          false,

        memory_retrieval_strength_scores_exposed:
          false,
        engine_visibility_target_ids_exposed: false,
        engine_sound_source_ids_exposed: false,
      },
    });
  }

  return {
    ok: true,
    loop_version: worldSimulationLoopVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    event,
    scene_analysis: cloneJson(sceneAnalysis),
    decision_packets: decisionPackets,
    visibility_queries: visibilityQueries,
    directional_height_visibility_queries: directionalHeightVisibilityQueries,
    illumination_visibility_queries: illuminationVisibilityQueries,
    audibility_queries: audibilityQueries,
    memory_accessibility_queries: memoryAccessibilityQueries,
    memory_retrieval_queries: memoryRetrievalQueries,
    memory_retrieval_processes: memoryRetrievalProcesses,
    trace_ids: traceIds,
    causal_boundary: {
      world_state_not_returned_to_character_brain: true,
      character_brain_selects_intent_only: true,
      character_brain_receives_engine_simulation_time: false,
      character_brain_receives_engine_scene_id: false,
      character_brain_receives_capability_runtime_metadata: false,
      character_brain_receives_raw_world_event: false,
      character_brain_receives_session_or_turn_identity: false,
      character_facing_capability_envelopes_enforced: true,
      causal_adjudicator_has_exclusive_outcome_authority: true,
      scene_neural_advisory_forwarded_to_causal_adjudicator: false,
      consistency_neural_advisory_controls_commit_gate: false,
      programmatic_visibility_query_version: worldSimulationVisibilityQueryVersion,
      directional_height_visibility_query_version: worldSimulationDirectionalHeightVisibilityVersion,
      illumination_visibility_query_version: worldSimulationIlluminationVisibilityVersion,
      audibility_query_version: worldSimulationAudibilityQueryVersion,
      subjective_memory_formation_version: worldSimulationSubjectiveMemoryFormationVersion,
      subjective_memory_accessibility_version: worldSimulationMemoryAccessibilityVersion,

      subjective_memory_uses_bounded_perception_only:
        true,

      memory_accessibility_candidate_set_is_projection_input:
        true,

      memory_accessibility_candidate_set_is_engine_only_in_native_loop:
        true,

      candidate_content_barrier_enforced:
        true,

      native_character_brain_memory_channel:
        "recovered_memories",

      native_retrieval_process_execution_installed:
        true,

      missing_retrieval_resolver_means_no_process:
        true,

      legacy_projected_memory_content_forwarded_to_character_brain:
        false,

      memory_projection_budget_separate_from_accessibility:
        true,

      memory_projection_asserts_successful_retrieval:
        false,

      memory_accessibility_scores_not_forwarded_to_character_brain:
        true,
      visibility_engine_target_ids_not_forwarded_to_character_brain: true,
      sound_engine_source_ids_not_forwarded_to_character_brain: true,
    },
  };
}

async function resolveMemoryEncodingDecisions(
  preparedTurn,
  options,
) {
  const decider =
    typeof options.memoryEncodingDecider === "function"
      ? options.memoryEncodingDecider
      : null;

  if (!decider) {
    return {
      decisions: [],
      audit: {
        decider_used: false,

        missing_decider_preserved_legacy_encoding:
          true,

        bounded_character_information_only:
          true,

        world_state_exposed_to_decider:
          false,

        full_world_event_exposed_to_decider:
          false,

        character_brain_direct_memory_mutation_allowed:
          false,
      },
    };
  }

  // The encoding decider receives only already-bounded
  // per-character information.
  //
  // It does NOT receive:
  // - World State
  // - scene state
  // - raw event payload
  // - hidden causal data
  const input = {
    turn_id:
      preparedTurn.turn_id,

    character_packets:
      array(preparedTurn.decision_packets)
        .map((packet) => ({
          character:
            packet.character
            ?? null,

          perception:
            cloneJson(
              packet.perception
              ?? {},
            ),

          cognition:
            cloneJson(
              packet.cognition
              ?? {},
            ),
        })),
  };

  const inputSnapshot =
    cloneJson(input);

  const inputHash =
    hashAgentRunValue(inputSnapshot);

  // The decider receives a detached clone. Any mutation
  // performed by the callee cannot mutate engine-owned input.
  const raw =
    await decider(
      cloneJson(inputSnapshot),
    );

  if (!Array.isArray(raw)) {
    const error = new Error(
      "memoryEncodingDecider must return an array of explicit encoding decisions.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECIDER_INVALID_OUTPUT";

    throw error;
  }

  return {
    decisions:
      cloneJson(raw),

    audit: {
      decider_used: true,

      input_context_hash:
        inputHash,

      decision_count:
        raw.length,

      bounded_character_information_only:
        true,

      world_state_exposed_to_decider:
        false,

      full_world_event_exposed_to_decider:
        false,

      character_brain_direct_memory_mutation_allowed:
        false,
    },
  };
}

async function resolveMemoryEpisodeBindings(
  preparedTurn,
  encodingDecisions,
  options,
) {
  const binder =
    typeof options.memoryEpisodeBinder === "function"
      ? options.memoryEpisodeBinder
      : null;

  if (!binder) {
    return {
      bindings: [],

      audit: {
        binder_used:
          false,

        automatic_segmentation_used:
          false,

        world_state_exposed_to_binder:
          false,

        full_world_event_exposed_to_binder:
          false,

        world_event_identity_auto_used:
          false,

        missing_binder_preserves_unbound_atomic_traces:
          true,
      },
    };
  }

  const input = {
    turn_id:
      preparedTurn.turn_id,

    character_packets:
      array(preparedTurn.decision_packets)
        .map((packet) => ({
          character:
            packet.character
            ?? null,

          perception:
            cloneJson(
              packet.perception
              ?? {},
            ),

          cognition:
            cloneJson(
              packet.cognition
              ?? {},
            ),
        })),

    encoding_decisions:
      cloneJson(
        encodingDecisions.decisions
        ?? [],
      ),
  };

  const inputSnapshot =
    cloneJson(input);

  const inputHash =
    hashAgentRunValue(inputSnapshot);

  // The binder receives a detached clone. Any mutation
  // performed by the callee cannot mutate engine-owned input.
  const raw =
    await binder(
      cloneJson(inputSnapshot),
    );

  if (!Array.isArray(raw)) {
    const error = new Error(
      "memoryEpisodeBinder must return an array of explicit subjective episode bindings.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDER_INVALID_OUTPUT";

    throw error;
  }

  return {
    bindings:
      cloneJson(raw),

    audit: {
      binder_used:
        true,

      input_context_hash:
        inputHash,

      binding_count:
        raw.length,

      automatic_segmentation_used:
        false,

      world_state_exposed_to_binder:
        false,

      full_world_event_exposed_to_binder:
        false,

      world_event_identity_auto_used:
        false,

      character_brain_direct_episode_binding_allowed:
        false,
    },
  };
}

export async function resolveWorldSimulationTurn(
  preparedTurn,
  selectedActions,
  options = {},
) {
  if (!isObject(preparedTurn)) throw new Error("preparedTurn must be an object.");
  const sessionId = nonEmptyString(
    preparedTurn.world_simulation_session_id,
    "preparedTurn.world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const snapshot = await getWorldSimulationState(sessionId, options);
  if (snapshot.revision !== preparedTurn.state_revision
    || snapshot.state_hash !== preparedTurn.world_state_hash) {
    const stale = new Error("Prepared world turn is stale and cannot be adjudicated.");
    stale.code = "WORLD_SIMULATION_PREPARED_TURN_STALE";
    throw stale;
  }
  const causalAdjudicator = typeof options.causalAdjudicator === "function"
    ? options.causalAdjudicator
    : adjudicateWorldSimulationCausality;

  const selected = [];
  for (const packet of array(preparedTurn.decision_packets)) {
    const character = nonEmptyString(packet.character, "decision packet character");
    selected.push(candidateSelection(
      { candidate_action_intents: packet.candidate_action_intents },
      characterMapValue(selectedActions, character),
      character,
    ));
  }

  const preAdjudicationHash = hashAgentRunValue(snapshot.state);
  const causalResolution = assertCausalResolution(await causalAdjudicator({
    world_simulation_session_id: sessionId,
    turn_id: preparedTurn.turn_id,
    world_state: cloneJson(snapshot.state),
    world_state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    event: cloneJson(preparedTurn.event),
    scene_analysis: cloneJson(
      preparedTurn.scene_analysis?.trusted_execution_view
      ?? preparedTurn.scene_analysis,
    ),
    selected_action_intents: cloneJson(selected),
  }));
  if (hashAgentRunValue(snapshot.state) !== preAdjudicationHash) {
    throw new Error("causalAdjudicator mutated the persisted input snapshot in place.");
  }

  const traceIds = [...array(preparedTurn.trace_ids)];
  const consistency = await capability(
    sessionId,
    "world_consistency_critic",
    {
      state_transitions: array(causalResolution.state_transitions),
      object_holders: array(causalResolution.object_holders),
      knowledge_transitions: array(causalResolution.knowledge_transitions),
      action_outcomes: array(causalResolution.action_outcomes),
    },
    options,
    traceIds,
  );

  const consistencyCommitGate =
    consistency.commit_gate_view
    ?? consistency;

  if ((consistencyCommitGate.hard_conflict_count ?? 0) > 0) {
    return {
      ok: false,
      committed: false,
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      previous_state_hash: snapshot.state_hash,
      next_state_hash: null,
      selected_action_intents: selected,
      consistency,
      trace_ids: traceIds,
      blocked_reason: "world_consistency_critic_reported_hard_conflicts",
      causal_resolution_discarded: true,
    };
  }

  const retrievalOccurredAt =
    array(preparedTurn.decision_packets)
      .map((packet) =>
        packet?.perception?.simulation_time
        ?? null
      )
      .find((value) =>
        value !== null
        && value !== undefined
      )
    ?? preparedTurn.event?.simulation_time
    ?? snapshot.state?.simulation_time
    ?? null;

  const subjectiveMemoryRetrievalPersistence =
    buildWorldSimulationMemoryRetrievalPersistence({
      world_state:
        causalResolution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      occurred_at:
        retrievalOccurredAt,
      retrieval_processes:
        preparedTurn.memory_retrieval_processes
        ?? [],
    });

  const subjectiveMemoryRetrievalMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:retrieval_history`,
      world_state_hash:
        hashAgentRunValue(
          causalResolution.next_world_state,
        ),
      state_transitions:
        subjectiveMemoryRetrievalPersistence
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveMemoryRetrievalMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        causalResolution.next_world_state,
      preview_world_state:
        subjectiveMemoryRetrievalPersistence
          .result
          .preview_world_state,
      queue:
        subjectiveMemoryRetrievalMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const retrievalPersistedWorldState =
    subjectiveMemoryRetrievalMutationExecution
      .next_world_state;

  const subjectiveMemoryEncodingDecisions =
    await resolveMemoryEncodingDecisions(
      preparedTurn,
      options,
    );

  const subjectiveMemoryEpisodeBindings =
    await resolveMemoryEpisodeBindings(
      preparedTurn,
      subjectiveMemoryEncodingDecisions,
      options,
    );

  const subjectiveMemoryFormation =
    formWorldSimulationSubjectiveMemories({
      world_state:
        retrievalPersistedWorldState,

      turn_id:
        preparedTurn.turn_id,

      event:
        preparedTurn.event,

      decision_packets:
        preparedTurn.decision_packets,

      encoding_decisions:
        subjectiveMemoryEncodingDecisions.decisions,

      episode_bindings:
        subjectiveMemoryEpisodeBindings.bindings,
    });
  const subjectiveMemoryPreview = applySubjectiveMemoryPreview(
    retrievalPersistedWorldState,
    subjectiveMemoryFormation.result,
  );
  const subjectiveMemoryMutationQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${preparedTurn.turn_id}:subjective_memory`,
    world_state_hash: hashAgentRunValue(retrievalPersistedWorldState),
    state_transitions: subjectiveMemoryFormation.result.memory_transitions,
    elapsed_ms: 0,
  });
  const subjectiveMemoryMutationExecution = executeWorldSimulationChronologicalMutationQueue({
    world_state: retrievalPersistedWorldState,
    preview_world_state: subjectiveMemoryPreview,
    queue: subjectiveMemoryMutationQueue,
    scene_id: preparedTurn.event?.scene_id ?? preparedTurn.event?.location_id ?? null,
  });

  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.inspectRuntime !== "function"
    || typeof characterRuntimeManager?.deliverCommittedExperienceProjection !== "function") {
    throw new Error(
      "characterRuntimeManager must provide inspectRuntime() and deliverCommittedExperienceProjection().",
    );
  }
  const committedHistoryBeforeTurn = await getWorldSimulationHistory(
    sessionId,
    options,
  );
  const committedCharacterRuntimeIdentities = [];
  for (const packet of array(preparedTurn.decision_packets)) {
    const runtimeSnapshot = await characterRuntimeManager.inspectRuntime(
      {
        world_simulation_session_id: sessionId,
        character: packet.character,
      },
      options,
    );
    committedCharacterRuntimeIdentities.push({
      character: packet.character,
      world_lineage: runtimeSnapshot.world_lineage,
      character_entity_id: runtimeSnapshot.character_entity_id,
      canonical_name: runtimeSnapshot.canonical_name,
      identity_source: runtimeSnapshot.identity_source,
      formal_identity: runtimeSnapshot.formal_identity === true,
      experience_sequence: nextCommittedCharacterExperienceSequence(
        committedHistoryBeforeTurn,
        runtimeSnapshot.world_lineage,
        runtimeSnapshot.character_entity_id,
      ),
    });
  }

  // This projection is only commit evidence at this point. No Character
  // Experience Receipt exists until the atomic world commit below succeeds.
  const committedCharacterExperienceProjection =
    projectWorldSimulationCharacterExperienceEvidence({
      prepared_turn: preparedTurn,
      selected_action_intents: selected,
      action_outcomes: array(causalResolution.action_outcomes),
      runtime_identities: committedCharacterRuntimeIdentities,
    });

  const committed = await commitWorldSimulationTurn(
    sessionId,
    {
      expected_revision: snapshot.revision,
      expected_state_hash: snapshot.state_hash,
      turn_id: preparedTurn.turn_id,
      next_world_state: subjectiveMemoryMutationExecution.next_world_state,
      event: preparedTurn.event,
      selected_action_intents: selected,
      state_transitions: array(causalResolution.state_transitions),
      action_outcomes: array(causalResolution.action_outcomes),
      knowledge_transitions: array(causalResolution.knowledge_transitions),
      scheduled_events: array(causalResolution.scheduled_events),
      causal_timeline: cloneJson(causalResolution.causal_timeline ?? null),
      chronological_mutation_queue: cloneJson(causalResolution.chronological_mutation_queue ?? null),
      chronological_mutation_execution: cloneJson(causalResolution.chronological_mutation_execution ?? null),
      mutation_proposal_boundary: cloneJson(causalResolution.mutation_proposal_boundary ?? null),
      pure_proposal_producers: cloneJson(causalResolution.pure_proposal_producers ?? null),
      immutable_causal_evaluators: cloneJson(causalResolution.immutable_causal_evaluators ?? null),
      immutable_physics_effects: cloneJson(causalResolution.immutable_physics_effects ?? null),
      immutable_projectile_lifecycle: cloneJson(causalResolution.immutable_projectile_lifecycle ?? null),
      immutable_ability_field_lifecycle: cloneJson(causalResolution.immutable_ability_field_lifecycle ?? null),
      immutable_event_queries: cloneJson(causalResolution.immutable_event_queries ?? null),
      immutable_event_arbitration: cloneJson(causalResolution.immutable_event_arbitration ?? null),
      cross_layer_event_arbitration: cloneJson(causalResolution.cross_layer_event_arbitration ?? null),
      causal_epochs: cloneJson(causalResolution.causal_epochs ?? null),
      fixed_point_convergence: cloneJson(causalResolution.fixed_point_convergence ?? null),
      visibility_queries: cloneJson(preparedTurn.visibility_queries ?? []),
      directional_height_visibility_queries: cloneJson(
        preparedTurn.directional_height_visibility_queries ?? [],
      ),
      illumination_visibility_queries: cloneJson(preparedTurn.illumination_visibility_queries ?? []),
      audibility_queries: cloneJson(preparedTurn.audibility_queries ?? []),
      memory_accessibility_queries: cloneJson(preparedTurn.memory_accessibility_queries ?? []),

      subjective_memory_encoding_decisions:
        cloneJson(
          subjectiveMemoryEncodingDecisions,
        ),

      subjective_memory_episode_bindings:
        cloneJson(
          subjectiveMemoryEpisodeBindings,
        ),

      subjective_memory_retrieval_persistence:
        cloneJson(
          subjectiveMemoryRetrievalPersistence,
        ),
      subjective_memory_retrieval_mutation_queue:
        cloneJson(
          subjectiveMemoryRetrievalMutationQueue,
        ),
      subjective_memory_retrieval_mutation_execution:
        cloneJson(
          subjectiveMemoryRetrievalMutationExecution.execution,
        ),

      subjective_memory_formation:
        cloneJson(
          subjectiveMemoryFormation,
        ),
      subjective_memory_mutation_queue: cloneJson(subjectiveMemoryMutationQueue),
      subjective_memory_mutation_execution: cloneJson(subjectiveMemoryMutationExecution.execution),
      committed_character_experience_projection:
        cloneJson(committedCharacterExperienceProjection),
      trace_ids: traceIds,
      causal_resolution_id: causalResolution.causal_resolution_id ?? null,
    },
    options,
  );

  let committedExperienceDelivery;
  try {
    committedExperienceDelivery = await characterRuntimeManager
      .deliverCommittedExperienceProjection(
        {
          world_simulation_session_id: sessionId,
          history_entry: committed.history_entry,
        },
        options,
      );
  } catch (error) {
    // World commit is already authoritative. Preserve the replayable history
    // projection and surface post-commit delivery failure without pretending
    // the atomic world commit rolled back.
    committedExperienceDelivery = {
      projection_version:
        committedCharacterExperienceProjection.projection_version,
      experience_contract_version:
        committedCharacterExperienceProjection.experience_contract_version,
      projection_hash:
        committedCharacterExperienceProjection.projection_hash,
      delivery_count:
        committedCharacterExperienceProjection.character_projections.length,
      consumed_count: 0,
      duplicate_count: 0,
      delivery_failed: true,
      replay_required: true,
      error_code: error?.code ?? "WORLD_SIMULATION_CHARACTER_EXPERIENCE_DELIVERY_FAILED",
      error_message: error?.message ?? String(error),
    };
  }

  return {
    ok: true,
    committed: true,
    world_simulation_session_id: sessionId,
    turn_id: preparedTurn.turn_id,
    revision: committed.state.revision,
    previous_state_hash: snapshot.state_hash,
    next_state_hash: committed.state.state_hash,
    selected_action_intents: selected,
    consistency,

    subjective_memory_encoding_decisions:
      cloneJson(
        subjectiveMemoryEncodingDecisions,
      ),

    subjective_memory_episode_bindings:
      cloneJson(
        subjectiveMemoryEpisodeBindings,
      ),

    subjective_memory_retrieval_persistence: {
      version:
        worldSimulationMemoryRetrievalPersistenceVersion,
      created_retrieval_event_count:
        subjectiveMemoryRetrievalPersistence
          .result
          .retrieval_events_created
          .length,
      history_update_count:
        subjectiveMemoryRetrievalPersistence
          .result
          .history_updates
          .length,
      mutation_count:
        subjectiveMemoryRetrievalMutationQueue
          .mutation_count,
      authoritative_executor:
        subjectiveMemoryRetrievalMutationExecution
          .execution
          .version,
    },

    subjective_memory_formation: {
      version: worldSimulationSubjectiveMemoryFormationVersion,
      created_memory_count: subjectiveMemoryFormation.result.created_memory_count,
      mutation_count: subjectiveMemoryMutationQueue.mutation_count,
      authoritative_executor: subjectiveMemoryMutationExecution.execution.version,
    },
    committed_character_experience: {
      experience_contract_version:
        committedCharacterExperienceProjection.experience_contract_version,
      projection_version:
        committedCharacterExperienceProjection.projection_version,
      projection_hash:
        committedCharacterExperienceProjection.projection_hash,
      receipt_count:
        committedCharacterExperienceProjection.character_projections.length,
      delivered_count:
        committedExperienceDelivery.consumed_count ?? 0,
      duplicate_delivery_count:
        committedExperienceDelivery.duplicate_count ?? 0,
      delivery_failed:
        committedExperienceDelivery.delivery_failed === true,
      replay_required:
        committedExperienceDelivery.replay_required === true,
      established_after_world_commit: true,
      durable_mind_mutation_count: 0,
    },
    trace_ids: traceIds,
    causal_resolution_id: causalResolution.causal_resolution_id ?? null,
    next_event: array(causalResolution.next_world_state.event_queue)[0] ?? null,
  };
}

export async function runWorldSimulationTurn(input = {}, options = {}) {
  if (typeof options.characterBrain !== "function") {
    const error = new Error("Phase62C requires a characterBrain function for named-character action choice.");
    error.code = "WORLD_SIMULATION_CHARACTER_BRAIN_REQUIRED";
    throw error;
  }
  const prepared = await prepareWorldSimulationTurn(input, options);
  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.runCharacterTurn !== "function"
    || typeof characterRuntimeManager?.inspectRuntime !== "function"
    || typeof characterRuntimeManager?.deliverCommittedExperienceProjection !== "function") {
    throw new Error(
      "characterRuntimeManager must provide runCharacterTurn(), inspectRuntime(), and deliverCommittedExperienceProjection().",
    );
  }
  const selections = {};
  for (const packet of prepared.decision_packets) {
    // Single-source Character Brain ingress projector. Runtime identity and
    // world-lineage metadata remain engine-side and are never added here.
    // Formal transport uses the same projector without the historical
    // retrieved_memories alias.
    const brainInput = buildWorldSimulationCharacterBrainInput(
      packet,
      {
        include_legacy_retrieved_memories_alias: true,
      },
    );
    selections[packet.character] = await characterRuntimeManager.runCharacterTurn(
      {
        world_simulation_session_id: prepared.world_simulation_session_id,
        character: packet.character,
        brain_input: brainInput,
        characterBrain: options.characterBrain,
      },
      options,
    );
  }
  return resolveWorldSimulationTurn(
    prepared,
    selections,
    {
      ...options,
      characterRuntimeManager,
    },
  );
}
