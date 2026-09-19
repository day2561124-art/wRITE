import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationMemoryAffectLifecycleClosureContract,
  projectWorldSimulationMemoryAffectLifecycleClosure,
  memoryAffectAdmittedRecollectionLimit,
  worldSimulationMemoryAffectLifecycleClosureVersion,
} from "../../server/src/world-simulation-memory-affect-lifecycle-closure-service.mjs";
import {
  persistentMoodContextCharacterViewVersion,
  worldSimulationPersistentMoodNativeAdoptionVersion,
} from "../../server/src/world-simulation-persistent-mood-native-adoption-service.mjs";
import {
  memoryRetrievalEventSchemaVersion,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";

const character = "千夜";
const turnId = "phase96-current-turn";
const memoryId = "phase96-secret-memory-ref";
const recoveredContent = "A remembered gesture.";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function moodAdoption(present) {
  const mood = present ? {
    label: "uneasy",
    interpretation: "An earlier obstruction still feels unresolved.",
    supporting_evidence_count: 1,
    subjective_not_world_truth: true,
    evidence_backed: true,
    reversible_interpretation: true,
    objective_emotion_label_established: false,
    numeric_intensity_established: false,
    numeric_decay_rate_established: false,
  } : null;
  const view = {
    version: persistentMoodContextCharacterViewVersion,
    status: present
      ? "subjective_persistent_mood_context_available"
      : "no_subjective_persistent_mood_context",
    persistent_mood: mood,
    subjective_current_mood_interpretation_established: present,
    objective_current_mood_established: false,
    advisory_only: true,
    candidate_generation_authority: false,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    personality_revision_authority: false,
    world_truth_authority: false,
  };
  return {
    version: worldSimulationPersistentMoodNativeAdoptionVersion,
    character,
    current_turn_id: turnId,
    source_phase89b_projection_hash: "phase89b-projection-hash",
    projection: { projection_hash: "phase89b-projection-hash" },
    character_view: view,
  };
}
function canonicalEvent() {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: "phase96-canonical-retrieval-event",
    character,
    turn_id: turnId,
    immutable: true,
    recovered_any_content: true,
    memory_recoveries: [{
      source_memory_ref: memoryId,
      memory_recovery_id: "phase96-memory-recovery",
      recovered_fragment_ids: ["phase96-fragment"],
    }],
    recovered_content: [{
      source_memory_ref: memoryId,
      fragment_id: "phase96-fragment",
      content: recoveredContent,
    }],
  };
  return { ...body, retrieval_event_hash: hashAgentRunValue(body) };
}
function context(content = recoveredContent) {
  return {
    focus: {
      context_origin: "recovered_memory",
      content,
      source_confused: true,
      possibly_incorrect: true,
    },
    active_context: [],
    peripheral_context: [],
    fading_context: [],
    suspended_context: [],
  };
}
const event = canonicalEvent();
function input(overrides = {}) {
  return {
    character,
    current_turn_id: turnId,
    world_state: {
      memories: {
        [character]: [{
          memory_id: memoryId,
          content: recoveredContent,
          formation_stage: "encoded_unconsolidated",
        }],
      },
      retrieval_events: {
        [event.retrieval_event_id]: clone(event),
      },
    },
    retrieval_event: clone(event),
    recovered_memories: [{ content: recoveredContent }],
    runtime_working_context: context(),
    working_context: context(),
    persistent_mood_native_adoption: moodAdoption(true),
    ...overrides,
  };
}

const contract = buildWorldSimulationMemoryAffectLifecycleClosureContract();
assert.equal(contract.version, worldSimulationMemoryAffectLifecycleClosureVersion);
assert.equal(contract.phase, "Phase96");
assert.equal(contract.source_retrieval_owner, "Phase63C");
assert.equal(contract.source_current_mind_owner, "Character Runtime");
assert.equal(contract.source_mood_owner, "Phase89C");
assert.equal(contract.source_consolidation_owner, "Phase91");
assert.equal(contract.source_reconsolidation_owner, "Phase92");
for (const key of [
  "same_character_current_turn_retrieval_required",
  "actually_recovered_and_runtime_admitted_memory_required",
  "omission_means_no_admitted_memory_affect_context",
  "mood_absence_does_not_invent_current_mood",
  "recollection_may_inform_affective_interpretation_not_establish_it",
  "current_mood_may_color_recollection_not_rewrite_it",
  "lifecycle_stage_is_not_memory_accuracy_or_world_truth",
  "source_uncertainty_cannot_be_cleared_by_affect",
  "mood_congruence_or_incongruence_not_inferred",
]) assert.equal(contract[key], true, key);
for (const key of [
  "prior_retained_recollection_alone_sufficient",
  "numerical_affect_bias_modeled",
  "retrieval_selection_overridden",
  "memory_content_rewritten",
  "affective_history_rewritten",
  "consolidation_stage_advanced",
  "reconsolidation_stage_advanced",
  "belief_or_action_authority",
  "engine_memory_refs_exposed",
  "world_truth_authority",
]) assert.equal(contract[key], false, key);

const goodInput = input();
const before = hashAgentRunValue(goodInput);
const projection = projectWorldSimulationMemoryAffectLifecycleClosure(goodInput);
assert.equal(hashAgentRunValue(goodInput), before, "Phase96 cannot mutate its inputs.");
assert.equal(projection.version, worldSimulationMemoryAffectLifecycleClosureVersion);
assert.equal(projection.character_view.status,
  "admitted_recollection_and_subjective_mood_available");
assert.equal(projection.character_view.admitted_recollection_count, 1);
assert.equal(projection.character_view.subjective_current_mood_available, true);
assert.equal(projection.character_view.recollection_may_inform_current_affective_interpretation, true);
assert.equal(projection.character_view.current_subjective_mood_may_color_recollection, true);
assert.equal(projection.character_view.recollection_determined_current_mood, false);
assert.equal(projection.character_view.mood_determined_retrieval, false);
assert.equal(projection.character_view.mood_congruence_established, false);
assert.equal(projection.character_view.mood_incongruence_established, false);
assert.equal(projection.character_view.recollection_source_uncertain, true);
assert.equal(projection.character_view.affect_clears_source_uncertainty, false);
assert.equal(projection.character_view.lifecycle_stage_establishes_accuracy, false);
assert.equal(projection.character_view.memory_content_rewritten, false);
assert.equal(projection.character_view.affective_history_rewritten, false);
assert.equal(projection.character_view.current_mood_rewritten, false);
assert.equal(projection.character_view.action_or_belief_authority, false);
assert.equal(projection.character_view.world_truth_authority, false);
assert.equal(projection.engine_audit.lifecycle_replayed, true);
assert.equal(projection.engine_audit.private_recovery_refs_exposed, false);
assert.equal(projection.engine_audit.hidden_candidate_content_inspected, false);
assert.equal(projection.engine_audit.consolidation_or_reconsolidation_advanced, false);
assert.equal(Object.isFrozen(projection.character_view), true);
const characterFacing = JSON.stringify(projection.character_view);
for(const forbidden of [
  memoryId, recoveredContent, "phase96-fragment", "phase96-canonical-retrieval-event",
  "phase89b-projection-hash", "encoded_at", "source_memory_ref",
  "retrieval_event_hash", "consolidation_stage", "SECRET_WORLD_TRUTH",
]) assert.equal(characterFacing.includes(forbidden), false, forbidden);

const abstainedMood = projectWorldSimulationMemoryAffectLifecycleClosure(input({
  persistent_mood_native_adoption: moodAdoption(false),
}));
assert.equal(abstainedMood.character_view.status,
  "admitted_recollection_without_established_current_mood");
assert.equal(abstainedMood.character_view.subjective_current_mood_available, false);
assert.equal(abstainedMood.character_view.current_subjective_mood_may_color_recollection, false);
assert.equal(abstainedMood.character_view.recollection_determined_current_mood, false);

const noCurrentRecovery = projectWorldSimulationMemoryAffectLifecycleClosure(input({
  recovered_memories: [],
}));
assert.equal(noCurrentRecovery.character_view, null);
assert.equal(noCurrentRecovery.engine_audit.lifecycle_replayed, false);

const runtimeDidNotAdmit = projectWorldSimulationMemoryAffectLifecycleClosure(input({
  runtime_working_context: { focus: null },
}));
assert.equal(runtimeDidNotAdmit.character_view, null);
const brainDidNotRetain = projectWorldSimulationMemoryAffectLifecycleClosure(input({
  working_context: { focus: null },
}));
assert.equal(brainDidNotRetain.character_view, null);
const otherMemoryOnly = projectWorldSimulationMemoryAffectLifecycleClosure(input({
  working_context: context("unrecovered content"),
  runtime_working_context: context("unrecovered content"),
}));
assert.equal(otherMemoryOnly.character_view, null);
const forgedNeuralRecollection = projectWorldSimulationMemoryAffectLifecycleClosure(input({
  working_context: context("unrecovered content"),
}));
assert.equal(forgedNeuralRecollection.character_view, null);

const failedEvent = canonicalEvent();
failedEvent.recovered_any_content = false;
failedEvent.memory_recoveries = [];
failedEvent.recovered_content = [];
const failedBody = clone(failedEvent);
delete failedBody.retrieval_event_hash;
failedEvent.retrieval_event_hash = hashAgentRunValue(failedBody);
assert.throws(
  () => projectWorldSimulationMemoryAffectLifecycleClosure(input({
    retrieval_event: failedEvent,
    world_state: {
      ...goodInput.world_state,
      retrieval_events: { [failedEvent.retrieval_event_id]: failedEvent },
    },
  })),
  error => error?.code === "WORLD_SIMULATION_MEMORY_AFFECT_RECOVERY_MISMATCH",
);
assert.throws(
  () => projectWorldSimulationMemoryAffectLifecycleClosure(input({
    retrieval_event: { ...event, character: "別人" },
  })),
  error => error?.code === "WORLD_SIMULATION_MEMORY_AFFECT_RETRIEVAL_EVENT_INVALID",
);
assert.throws(
  () => projectWorldSimulationMemoryAffectLifecycleClosure(input({
    retrieval_event: { ...event, recovered_any_content: false },
  })),
  error => error?.code === "WORLD_SIMULATION_MEMORY_AFFECT_RETRIEVAL_EVENT_MISMATCH",
);
assert.throws(
  () => projectWorldSimulationMemoryAffectLifecycleClosure(input({
    persistent_mood_native_adoption: { ...moodAdoption(true), character: "別人" },
  })),
  error => error?.code === "WORLD_SIMULATION_MEMORY_AFFECT_MOOD_LINEAGE_INVALID",
);
assert.throws(
  () => projectWorldSimulationMemoryAffectLifecycleClosure(input({
    persistent_mood_native_adoption: {
      ...moodAdoption(true),
      source_phase89b_projection_hash: "detached",
    },
  })),
  error => error?.code === "WORLD_SIMULATION_MEMORY_AFFECT_MOOD_LINEAGE_INVALID",
);
assert.deepEqual(
  projectWorldSimulationMemoryAffectLifecycleClosure(input()),
  projectWorldSimulationMemoryAffectLifecycleClosure(input()),
  "Phase96 must be deterministic.",
);
assert.equal(memoryAffectAdmittedRecollectionLimit, 8);

const loopSource = await readFile(
  "server/src/world-simulation-loop-service.mjs",
  "utf8",
);
const phase89c = loopSource.indexOf(
  "const persistentMoodNativeAdoption =",
);
const phase96 = loopSource.indexOf(
  "const memoryAffectLifecycleClosure =",
);
const proposer = loopSource.indexOf(
  "const actionCandidates = await capability(",
  phase96,
);
assert.ok(phase89c >= 0 && phase96 > phase89c && proposer > phase96);
assert.match(loopSource, /memory_affect_lifecycle_closure:/);
assert.match(loopSource, /delete characterCognition\.memory_affect_context;/);
assert.match(loopSource, /runtime_working_context:\s*\r?\n\s*speculativeCurrentMind\.working_context/);
assert.match(loopSource, /working_context: characterCognition\.working_context/);
assert.match(loopSource, /memory_affect_context = cloneJson\(/);
assert.match(loopSource, /phase96_memory_affect_lifecycle_closure_installed:/);
assert.match(loopSource, /phase96_mood_or_memory_rewritten:\s*\r?\n\s*false/);

console.log("Phase96 memory–affect lifecycle closure: PASS");
