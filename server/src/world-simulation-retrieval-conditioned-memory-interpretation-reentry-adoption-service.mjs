import {
  projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry,
  worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion,
} from "./world-simulation-retrieval-conditioned-memory-interpretation-reentry-service.mjs";

export const worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion =
  "phase87b-retrieval-conditioned-memory-interpretation-native-adoption-v1";
export const retrievalConditionedMemoryInterpretationCharacterViewVersion =
  "phase87b-retrieval-conditioned-memory-interpretation-character-view-v1";

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

function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function characterViewFromProjection(projection) {
  return assertWorldSimulationRetrievalConditionedMemoryInterpretationCharacterView({
    version: retrievalConditionedMemoryInterpretationCharacterViewVersion,
    source: "current_successful_retrieval_of_prior_committed_memory_interpretation",
    interpretation_count: projection.interpretations.length,
    interpretations: cloneJson(projection.interpretations),
    advisory_only: true,
    candidate_generation_authority: false,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    retrieval_strength_authority: false,
    storage_strength_authority: false,
    world_truth_authority: false,
  });
}

export function buildWorldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionContract() {
  return Object.freeze({
    version: worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion,
    phase: "Phase87B",
    status: "retrieval_conditioned_memory_interpretation_native_adoption_installed",
    source_projection_owner: "Phase87A",
    deterministic_phase63c_persistence_preview_required: true,
    canonical_preview_retrieval_event_required: true,
    resolve_time_persistence_lineage_revalidation_required: true,
    character_view_sanitized: true,
    source_memory_identity_exposed: false,
    retrieval_event_identity_exposed: false,
    projection_hash_exposed: false,
    advisory_only: true,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    retrieval_strength_authority: false,
    storage_strength_authority: false,
    world_truth_authority: false,
    same_turn_phase85e_interpretation_feedback_allowed: false,
  });
}

export function assertWorldSimulationRetrievalConditionedMemoryInterpretationCharacterView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== retrievalConditionedMemoryInterpretationCharacterViewVersion
      || view.source !== "current_successful_retrieval_of_prior_committed_memory_interpretation"
      || !Number.isSafeInteger(view.interpretation_count)
      || view.interpretation_count < 0
      || !Array.isArray(view.interpretations)
      || view.interpretation_count !== view.interpretations.length
      || view.advisory_only !== true
      || view.candidate_generation_authority !== false
      || view.action_selection_authority !== false
      || view.belief_revision_authority !== false
      || view.memory_rewrite_authority !== false
      || view.retrieval_strength_authority !== false
      || view.storage_strength_authority !== false
      || view.world_truth_authority !== false) {
    fail(
      "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_CHARACTER_VIEW_INVALID",
      "Phase87B character-facing interpretation view violates its bounded authority contract.",
    );
  }

  for (const interpretation of view.interpretations) {
    if (!isObject(interpretation)
        || !text(interpretation.prior_interpretation)
        || !text(interpretation.later_interpretation)
        || !["challenges", "supersedes"].includes(interpretation.relation)
        || interpretation.retrieval_conditioned !== true
        || interpretation.subjective_not_world_truth !== true
        || interpretation.original_memory_preserved !== true
        || interpretation.belief_adoption_implied !== false) {
      fail(
        "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_CHARACTER_VIEW_INVALID",
        "Phase87B character-facing interpretation contains invalid or authority-bearing content.",
      );
    }
  }

  const serialized = JSON.stringify(view);
  const forbiddenFragments = [
    "memory_id",
    "source_memory_ref",
    "retrieval_event_id",
    "retrieval_event_hash",
    "memory_recovery_id",
    "claim_event_id",
    "relation_event_id",
    "projection_hash",
    "world_state_hash",
    "state_revision",
  ];
  if (forbiddenFragments.some((fragment) => serialized.includes(fragment))) {
    fail(
      "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_PRIVATE_LINEAGE",
      "Phase87B character-facing interpretation exposed engine-only lineage metadata.",
    );
  }
  return Object.freeze(view);
}

export function adoptWorldSimulationRetrievalConditionedMemoryInterpretationReentry(input = {}) {
  const character = text(input.character);
  const currentTurnId = text(input.current_turn_id ?? input.turn_id);
  if (!character || !currentTurnId || !isObject(input.retrieval_event)) {
    fail(
      "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_INPUT_INVALID",
      "Phase87B requires a character, current turn, and deterministic Phase63C preview RetrievalEvent.",
    );
  }

  const projection = projectWorldSimulationRetrievalConditionedMemoryInterpretationReentry({
    world_state: input.preview_world_state,
    character,
    current_turn_id: currentTurnId,
    retrieval_event: input.retrieval_event,
  });
  const characterView = characterViewFromProjection(projection);

  return Object.freeze({
    version: worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion,
    phase: "Phase87B",
    source_projection_version: worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion,
    character,
    current_turn_id: currentTurnId,
    source_retrieval_event_id: input.retrieval_event.retrieval_event_id,
    source_retrieval_event_hash: input.retrieval_event.retrieval_event_hash,
    source_projection_hash: projection.projection_hash,
    projection,
    character_view: characterView,
    audit: Object.freeze({
      deterministic_phase63c_preview_used: true,
      canonical_preview_retrieval_event_verified: true,
      character_view_sanitized: true,
      engine_lineage_forwarded_to_character_brain: false,
      base_memory_rewritten: false,
      retrieval_strength_mutated: false,
      storage_strength_mutated: false,
      belief_revision_performed: false,
      action_selected: false,
      world_truth_authority_exposed: false,
    }),
  });
}

export function assertWorldSimulationRetrievalConditionedMemoryInterpretationPersistenceLineage(input = {}) {
  const adoptions = array(input.adoptions);
  const createdEvents = array(input.retrieval_events_created);
  const persistedEvents = isObject(input.persisted_retrieval_events)
    ? input.persisted_retrieval_events
    : {};
  const createdById = new Map(
    createdEvents.map((event) => [event?.retrieval_event_id, event]),
  );

  const seenCharacters = new Set();
  for (const adoption of adoptions) {
    const normalizedCharacter = text(adoption?.character)?.toLocaleLowerCase("zh-Hant-TW") ?? null;
    if (!isObject(adoption)
        || adoption.version !== worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion
        || adoption.source_projection_version
          !== worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion
        || !text(adoption.source_retrieval_event_id)
        || !text(adoption.source_retrieval_event_hash)
        || !text(adoption.source_projection_hash)
        || !normalizedCharacter
        || !text(adoption.current_turn_id)
        || !isObject(adoption.projection)
        || adoption.projection.version
          !== worldSimulationRetrievalConditionedMemoryInterpretationReentryVersion
        || adoption.projection.projection_hash !== adoption.source_projection_hash
        || !sameCharacter(adoption.projection.character, adoption.character)
        || adoption.projection.current_turn_id !== adoption.current_turn_id
        || seenCharacters.has(normalizedCharacter)) {
      fail(
        "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_LINEAGE_INVALID",
        "Phase87B prepared adoption lineage is invalid or duplicated.",
      );
    }
    seenCharacters.add(normalizedCharacter);
    const expectedCharacterView = characterViewFromProjection(adoption.projection);
    const actualCharacterView =
      assertWorldSimulationRetrievalConditionedMemoryInterpretationCharacterView(
        adoption.character_view,
      );
    if (JSON.stringify(expectedCharacterView) !== JSON.stringify(actualCharacterView)) {
      fail(
        "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_CHARACTER_VIEW_MISMATCH",
        "Phase87B prepared character view no longer matches its engine-side Phase87A projection.",
      );
    }
    const created = createdById.get(adoption.source_retrieval_event_id);
    const persisted = persistedEvents[adoption.source_retrieval_event_id];
    for (const canonicalEvent of [created, persisted]) {
      if (!isObject(canonicalEvent)
          || canonicalEvent.retrieval_event_hash !== adoption.source_retrieval_event_hash
          || canonicalEvent.turn_id !== adoption.current_turn_id
          || !sameCharacter(canonicalEvent.character, adoption.character)) {
        fail(
          "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_PERSISTENCE_MISMATCH",
          "Phase87B Character Brain adoption does not match both the resolve-time created and canonical persisted Phase63C RetrievalEvent.",
        );
      }
    }
    if (JSON.stringify(created) !== JSON.stringify(persisted)) {
      fail(
        "WORLD_SIMULATION_RETRIEVAL_CONDITIONED_INTERPRETATION_ADOPTION_PERSISTENCE_MISMATCH",
        "Phase87B resolve-time created RetrievalEvent differs from the canonical event in the persistence preview world.",
      );
    }
  }

  return Object.freeze({
    version: worldSimulationRetrievalConditionedMemoryInterpretationReentryAdoptionVersion,
    verified_adoption_count: adoptions.length,
    persistence_lineage_verified: true,
  });
}
