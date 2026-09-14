import {
  buildWorldSimulationPersistentMoodInterpretationResolverView,
  projectWorldSimulationPersistentMoodInterpretation,
  worldSimulationPersistentMoodInterpretationVersion,
} from "./world-simulation-persistent-affective-tone-interpretation-service.mjs";

export const worldSimulationPersistentMoodNativeAdoptionVersion =
  "phase89c-persistent-mood-interpretation-native-adoption-v1";
export const persistentMoodContextCharacterViewVersion =
  "phase89c-persistent-mood-context-character-view-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function characterViewFromProjection(projection) {
  const sourceView = projection?.character_view;
  const currentMood = isObject(sourceView?.current_mood)
    ? cloneJson(sourceView.current_mood)
    : null;
  return assertWorldSimulationPersistentMoodContextCharacterView({
    version: persistentMoodContextCharacterViewVersion,
    status: currentMood
      ? "subjective_persistent_mood_context_available"
      : "no_subjective_persistent_mood_context",
    persistent_mood: currentMood,
    subjective_current_mood_interpretation_established:
      sourceView?.subjective_current_mood_interpretation_established === true,
    objective_current_mood_established: false,
    advisory_only: true,
    candidate_generation_authority: false,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    personality_revision_authority: false,
    world_truth_authority: false,
  });
}

export function buildWorldSimulationPersistentMoodNativeAdoptionContract() {
  return Object.freeze({
    version: worldSimulationPersistentMoodNativeAdoptionVersion,
    phase: "Phase89C",
    status: "persistent_mood_interpretation_native_adoption_installed",
    source_evidence_owner: "Phase89A",
    source_interpretation_owner: "Phase89B",
    exact_phase89b_resolver_view_reconstruction_required: true,
    character_view_sanitized: true,
    independent_persistent_mood_context: true,
    phase86b_affective_context_overwritten: false,
    subjective_interpretation_only: true,
    objective_current_mood_established: false,
    numeric_intensity_modeled: false,
    numeric_decay_rate_modeled: false,
    candidate_generation_authority: false,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    personality_revision_authority: false,
    world_truth_authority: false,
    same_turn_phase86_feedback_allowed: false,
    deliberation_grounding_installed: false,
  });
}

export function assertWorldSimulationPersistentMoodContextCharacterView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== persistentMoodContextCharacterViewVersion
      || !["subjective_persistent_mood_context_available", "no_subjective_persistent_mood_context"]
        .includes(view.status)
      || view.objective_current_mood_established !== false
      || view.advisory_only !== true
      || view.candidate_generation_authority !== false
      || view.action_selection_authority !== false
      || view.belief_revision_authority !== false
      || view.memory_rewrite_authority !== false
      || view.personality_revision_authority !== false
      || view.world_truth_authority !== false) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_CHARACTER_VIEW_INVALID",
      "Phase89C persistent mood context violates its bounded authority contract.",
    );
  }
  const hasMood = isObject(view.persistent_mood);
  if (hasMood !== (view.subjective_current_mood_interpretation_established === true)) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_CHARACTER_VIEW_INVALID",
      "Phase89C persistent mood context establishment flag does not match its qualitative interpretation.",
    );
  }
  if (hasMood) {
    const mood = view.persistent_mood;
    if (!text(mood.label)
        || !text(mood.interpretation)
        || !Number.isSafeInteger(mood.supporting_evidence_count)
        || mood.supporting_evidence_count < 1
        || mood.subjective_not_world_truth !== true
        || mood.evidence_backed !== true
        || mood.reversible_interpretation !== true
        || mood.objective_emotion_label_established !== false
        || mood.numeric_intensity_established !== false
        || mood.numeric_decay_rate_established !== false) {
      fail(
        "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_CHARACTER_VIEW_INVALID",
        "Phase89C persistent mood context contains invalid or authority-bearing mood content.",
      );
    }
  } else if (view.persistent_mood !== null) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_CHARACTER_VIEW_INVALID",
      "Phase89C absent mood context must use a null persistent_mood.",
    );
  }
  const serialized = JSON.stringify(view);
  const forbiddenFragments = [
    "evidence_ref",
    "evidence_hash",
    "resolver_view_hash",
    "projection_hash",
    "interpretation_ref",
    "interpretation_hash",
    "source_appraisal_hash",
    "source_turn_id",
  ];
  if (forbiddenFragments.some((fragment) => serialized.includes(fragment))) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_PRIVATE_LINEAGE",
      "Phase89C character-facing mood context exposed engine-only lineage metadata.",
    );
  }
  return Object.freeze(view);
}

export function adoptWorldSimulationPersistentMoodInterpretation(input = {}) {
  const character = text(input.character);
  const currentTurnId = text(input.current_turn_id ?? input.turn_id);
  if (!character || !currentTurnId || !Array.isArray(input.world_history?.turns)) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_INPUT_INVALID",
      "Phase89C requires canonical committed history, character identity, and a current turn boundary.",
    );
  }
  const canonicalInput = {
    world_history: input.world_history,
    character,
    current_turn_id: currentTurnId,
  };
  const canonicalView = buildWorldSimulationPersistentMoodInterpretationResolverView(
    canonicalInput,
  );
  const suppliedView = input.resolver_view;
  if (!isObject(suppliedView)
      || suppliedView.version !== worldSimulationPersistentMoodInterpretationVersion
      || suppliedView.resolver_view_hash !== canonicalView.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_NATIVE_ADOPTION_VIEW_STALE",
      "Phase89C requires the exact canonical Phase89B resolver view for the current committed history.",
    );
  }
  const projection = projectWorldSimulationPersistentMoodInterpretation({
    ...canonicalInput,
    resolver_view: suppliedView,
    interpretation_decisions: Array.isArray(input.interpretation_decisions)
      ? input.interpretation_decisions
      : [],
  });
  const characterView = characterViewFromProjection(projection);
  return Object.freeze({
    version: worldSimulationPersistentMoodNativeAdoptionVersion,
    phase: "Phase89C",
    character,
    current_turn_id: currentTurnId,
    source_projection_version: worldSimulationPersistentMoodInterpretationVersion,
    source_phase89a_evidence_hash: projection.source_phase89a_evidence_hash,
    source_phase89b_resolver_view_hash: projection.resolver_view_hash,
    source_phase89b_projection_hash: projection.projection_hash,
    projection,
    character_view: characterView,
    audit: Object.freeze({
      exact_phase89b_resolver_view_reconstructed: true,
      character_view_sanitized: true,
      phase86b_affective_context_overwritten: false,
      engine_lineage_forwarded_to_character_brain: false,
      objective_current_mood_established: false,
      numeric_intensity_modeled: false,
      numeric_decay_rate_modeled: false,
      candidate_generation_authority: false,
      action_selection_authority: false,
      belief_revision_authority: false,
      memory_rewritten: false,
      personality_revised: false,
      world_truth_authority_exposed: false,
      deliberation_grounding_performed: false,
    }),
  });
}
