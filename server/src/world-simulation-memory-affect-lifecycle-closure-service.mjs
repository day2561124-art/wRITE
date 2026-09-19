import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveMemoryConsolidationStates,
} from "./world-simulation-adaptive-memory-consolidation-service.mjs";
import {
  projectWorldSimulationEffectiveMemoryReconsolidationStates,
} from "./world-simulation-memory-reconsolidation-lifecycle-service.mjs";
import {
  assertWorldSimulationPersistentMoodContextCharacterView,
  worldSimulationPersistentMoodNativeAdoptionVersion,
} from "./world-simulation-persistent-mood-native-adoption-service.mjs";
import {
  memoryRetrievalEventSchemaVersion,
} from "./world-simulation-memory-retrieval-persistence-service.mjs";

export const worldSimulationMemoryAffectLifecycleClosureVersion =
  "phase96-memory-affect-lifecycle-closure-v1";
export const memoryAffectAdmittedRecollectionLimit = 8;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function clone(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) freeze(item);
  return value;
}
function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function sameCharacter(left, right) {
  return text(left)?.toLocaleLowerCase("zh-Hant-TW")
    === text(right)?.toLocaleLowerCase("zh-Hant-TW");
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function currentMindItems(value) {
  const context = object(value);
  const items = [
    context.focus,
    ...array(context.active_context),
    ...array(context.peripheral_context),
    ...array(context.fading_context),
    ...array(context.suspended_context),
  ];
  return items.filter((item) => isObject(item) && item.context_origin === "recovered_memory");
}

function canonicalEvent(event, character, turnId, worldState) {
  if (!isObject(event)
    || event.schema_version !== memoryRetrievalEventSchemaVersion
    || event.immutable !== true
    || !text(event.retrieval_event_id)
    || !text(event.retrieval_event_hash)
    || !sameCharacter(event.character, character)
    || event.turn_id !== turnId
    || !Array.isArray(event.memory_recoveries)
    || !Array.isArray(event.recovered_content)
    || typeof event.recovered_any_content !== "boolean") {
    fail("WORLD_SIMULATION_MEMORY_AFFECT_RETRIEVAL_EVENT_INVALID",
      "Phase96 requires the same-character, same-turn immutable Phase63C RetrievalEvent.");
  }
  const body = clone(event);
  delete body.retrieval_event_hash;
  if (hashAgentRunValue(body) !== event.retrieval_event_hash
    || JSON.stringify(object(worldState.retrieval_events)[event.retrieval_event_id])
      !== JSON.stringify(event)) {
    fail("WORLD_SIMULATION_MEMORY_AFFECT_RETRIEVAL_EVENT_MISMATCH",
      "Phase96 cannot use detached or rehashed retrieval evidence.");
  }
  return event;
}

function matchedAdmittedMemories(workingContext, runtimeWorkingContext, recoveredMemories) {
  // Require both the Runtime's admitted representation and the final
  // Character Brain working context. Neural cognition cannot forge admission.
  const recovered = array(recoveredMemories);
  const runtimeAdmittedContent = new Set(
    currentMindItems(runtimeWorkingContext)
      .filter((item) => Object.hasOwn(item, "content"))
      .map((item) => JSON.stringify(item.content)),
  );
  const admitted = [];
  const seen = new Set();
  for (const item of currentMindItems(workingContext)) {
    if (!Object.hasOwn(item, "content")) continue;
    const semantic = JSON.stringify(item.content);
    if (!runtimeAdmittedContent.has(semantic)) continue;
    if (!recovered.some((memory) =>
      isObject(memory)
      && Object.hasOwn(memory, "content")
      && JSON.stringify(memory.content) === semantic)) continue;
    if (seen.has(semantic)) continue;
    seen.add(semantic);
    admitted.push(item);
  }
  return admitted;
}

export function buildWorldSimulationMemoryAffectLifecycleClosureContract() {
  return freeze({
    version: worldSimulationMemoryAffectLifecycleClosureVersion,
    phase: "Phase96",
    status: "read_only_memory_affect_lifecycle_closure_installed",
    source_retrieval_owner: "Phase63C",
    source_current_mind_owner: "Character Runtime",
    source_mood_owner: "Phase89C",
    source_consolidation_owner: "Phase91",
    source_reconsolidation_owner: "Phase92",
    same_character_current_turn_retrieval_required: true,
    actually_recovered_and_runtime_admitted_memory_required: true,
    prior_retained_recollection_alone_sufficient: false,
    omission_means_no_admitted_memory_affect_context: true,
    mood_absence_does_not_invent_current_mood: true,
    recollection_may_inform_affective_interpretation_not_establish_it: true,
    current_mood_may_color_recollection_not_rewrite_it: true,
    mood_congruence_or_incongruence_not_inferred: true,
    lifecycle_stage_is_not_memory_accuracy_or_world_truth: true,
    source_uncertainty_cannot_be_cleared_by_affect: true,
    numerical_affect_bias_modeled: false,
    retrieval_selection_overridden: false,
    memory_content_rewritten: false,
    affective_history_rewritten: false,
    consolidation_stage_advanced: false,
    reconsolidation_stage_advanced: false,
    belief_or_action_authority: false,
    engine_memory_refs_exposed: false,
    world_truth_authority: false,
  });
}

export function projectWorldSimulationMemoryAffectLifecycleClosure(input = {}) {
  const character = text(input.character);
  const currentTurnId = text(input.current_turn_id);
  if (!character || !currentTurnId || !isObject(input.world_state)) {
    fail("WORLD_SIMULATION_MEMORY_AFFECT_INPUT_INVALID",
      "Phase96 requires a current character/turn and canonical read-only world state.");
  }
  const moodAdoption = input.persistent_mood_native_adoption;
  if (!isObject(moodAdoption)
    || moodAdoption.version !== worldSimulationPersistentMoodNativeAdoptionVersion
    || !sameCharacter(moodAdoption.character, character)
    || moodAdoption.current_turn_id !== currentTurnId
    || !text(moodAdoption.source_phase89b_projection_hash)
    || !isObject(moodAdoption.projection)
    || moodAdoption.projection.projection_hash
      !== moodAdoption.source_phase89b_projection_hash) {
    fail("WORLD_SIMULATION_MEMORY_AFFECT_MOOD_LINEAGE_INVALID",
      "Phase96 accepts only the same-character current-turn Phase89C adoption.");
  }
  const mood = assertWorldSimulationPersistentMoodContextCharacterView(
    moodAdoption.character_view,
  );
  const recovered = array(input.recovered_memories);
  const admitted = matchedAdmittedMemories(
    input.working_context,
    input.runtime_working_context,
    recovered,
  );
  if (!admitted.length) {
    return freeze({
      version: worldSimulationMemoryAffectLifecycleClosureVersion,
      phase: "Phase96",
      character,
      current_turn_id: currentTurnId,
      character_view: null,
      engine_audit: {
        status: "no_current_turn_admitted_recollection",
        admitted_current_recollection_count: 0,
        lifecycle_replayed: false,
        memory_or_mood_rewritten: false,
        world_truth_authority: false,
      },
    });
  }
  const event = canonicalEvent(
    input.retrieval_event,
    character,
    currentTurnId,
    input.world_state,
  );
  if (event.recovered_any_content !== true
    || !event.memory_recoveries.length
    || !event.recovered_content.length) {
    fail("WORLD_SIMULATION_MEMORY_AFFECT_RECOVERY_MISMATCH",
      "A Current Mind recollection cannot be attributed to an unsuccessful current-turn retrieval.");
  }
  const eventContent = new Set(
    event.recovered_content.map((item) => JSON.stringify(item?.content)),
  );
  if (admitted.some((item) => !eventContent.has(JSON.stringify(item.content)))) {
    fail("WORLD_SIMULATION_MEMORY_AFFECT_RECOVERY_MISMATCH",
      "Runtime-admitted content is not in the canonical same-turn RetrievalEvent.");
  }

  // Revalidate canonical lifecycle stores on a read-only path. Their states
  // remain engine-side and do not turn subjective recollection into certainty.
  const consolidation = projectWorldSimulationEffectiveMemoryConsolidationStates({
    world_state: input.world_state,
  });
  const reconsolidation = projectWorldSimulationEffectiveMemoryReconsolidationStates({
    world_state: input.world_state,
  });
  const memoryRefs = new Set(
    event.memory_recoveries.map((item) => text(item?.source_memory_ref)).filter(Boolean),
  );
  const consolidationMatched = consolidation.states.filter((item) =>
    sameCharacter(item.character, character) && memoryRefs.has(item.memory_id));
  const reconsolidationMatched = reconsolidation.interpretation_update_states.filter((item) =>
    sameCharacter(item.character, character) && memoryRefs.has(item.memory_id));

  const sourceUncertain = admitted.some((item) =>
    item.source_confused === true || item.possibly_incorrect === true);
  const truncation = admitted.length > memoryAffectAdmittedRecollectionLimit;
  const hasMood = mood.subjective_current_mood_interpretation_established === true;
  const characterView = {
    version: worldSimulationMemoryAffectLifecycleClosureVersion,
    status: hasMood
      ? "admitted_recollection_and_subjective_mood_available"
      : "admitted_recollection_without_established_current_mood",
    admitted_recollection_present: true,
    admitted_recollection_count: Math.min(admitted.length, memoryAffectAdmittedRecollectionLimit),
    admitted_recollection_truncated: truncation,
    subjective_current_mood_available: hasMood,
    recollection_may_inform_current_affective_interpretation: true,
    current_subjective_mood_may_color_recollection: hasMood,
    recollection_determined_current_mood: false,
    mood_determined_retrieval: false,
    mood_congruence_established: false,
    mood_incongruence_established: false,
    recollection_source_uncertain: sourceUncertain,
    affect_clears_source_uncertainty: false,
    lifecycle_stage_establishes_accuracy: false,
    memory_content_rewritten: false,
    affective_history_rewritten: false,
    current_mood_rewritten: false,
    action_or_belief_authority: false,
    world_truth_authority: false,
    advisory_only: true,
  };
  const body = {
    version: worldSimulationMemoryAffectLifecycleClosureVersion,
    phase: "Phase96",
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    engine_audit: {
      status: "read_only_canonical_lifecycle_revalidated",
      source_retrieval_event_hash: event.retrieval_event_hash,
      source_phase89c_projection_hash: moodAdoption.source_phase89b_projection_hash,
      admitted_current_recollection_count: admitted.length,
      consolidated_recovered_memory_count: consolidationMatched.filter((item) =>
        item.effective_consolidation_stage === "consolidated").length,
      reconsolidation_update_state_count: reconsolidationMatched.length,
      lifecycle_replayed: true,
      private_recovery_refs_exposed: false,
      hidden_candidate_content_inspected: false,
      stored_memory_rewritten: false,
      affective_history_rewritten: false,
      consolidation_or_reconsolidation_advanced: false,
      world_truth_authority: false,
    },
  };
  return freeze({ ...body, projection_hash: hashAgentRunValue(body) });
}
