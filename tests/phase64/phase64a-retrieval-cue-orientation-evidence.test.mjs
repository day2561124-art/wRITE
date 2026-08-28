import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import path from "node:path";

import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  projectWorldSimulationCueDiagnosticEvidence,
} from "../../server/src/world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQueryV3,
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalPersistence,
  buildWorldSimulationMemoryRetrievalPersistenceContract,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  assertWorldSimulationRetrievalCueOrientationStageBoundary,
  buildWorldSimulationRetrievalCueOrientationCharacterView,
  buildWorldSimulationRetrievalCueOrientationContract,
  buildWorldSimulationRetrievalCueOrientationOptions,
  buildWorldSimulationRetrievalCueOrientationResolverOptions,
  materializeWorldSimulationRetrievalCueOrientationEvidence,
  worldSimulationRetrievalCueOrientationEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-cue-orientation-evidence-service.mjs";

const contract =
  buildWorldSimulationRetrievalCueOrientationContract();

assert.equal(
  contract.version,
  worldSimulationRetrievalCueOrientationEvidenceVersion,
);
assert.equal(contract.trigger_and_orientation_distinguished, true);
assert.equal(contract.spontaneous_strategic_orientation_allowed, false);
assert.equal(contract.orientation_is_process_wide_baseline, true);
assert.equal(contract.grounded_option_ref_selection_required, true);
assert.equal(contract.raw_engine_cue_identity_exposed_to_resolver, false);
assert.equal(contract.phase64a_r4a_diagnosticity_exposed_to_orientation_selector, false);
assert.equal(contract.candidate_competition_exposed_to_orientation_selector, false);
assert.equal(contract.attention_weight_modeled, false);
assert.equal(contract.candidate_membership_authority, false);
assert.equal(contract.candidate_order_authority, false);
assert.equal(contract.retrieval_contact_authority, false);
assert.equal(contract.retrieval_recovery_authority, false);
assert.equal(contract.persistent_memory_mutation_authority, false);

const directOptionSet =
  buildWorldSimulationRetrievalCueOrientationOptions({
    query_id:
      "r4b1-direct-query",
    source_frontier_id:
      "r4b1-direct-frontier",
    active_cues: [
      {
        kind: "spatial_context",
        value: "ENGINE_PRIVATE_SCENE_DIRECT",
        source: "current_environment",
        sources: ["current_environment"],
      },
      {
        kind: "semantic",
        value: "bridge",
        source: "explicit_retrieval_context",
        sources: ["explicit_retrieval_context"],
      },
      {
        kind: "entity",
        value: "ENGINE_PRIVATE_ENTITY_DIRECT",
        source: "explicit_context_cue",
        sources: ["explicit_context_cue"],
      },
    ],
  });

const directResolverOptions =
  buildWorldSimulationRetrievalCueOrientationResolverOptions(
    directOptionSet,
  );

assert.equal(Object.isFrozen(directOptionSet), true);
assert.equal(Object.isFrozen(directResolverOptions), true);
assert.equal(directResolverOptions.length, 2);
assert.equal(
  JSON.stringify(directResolverOptions)
    .includes("ENGINE_PRIVATE_SCENE_DIRECT"),
  false,
);
assert.equal(
  JSON.stringify(directResolverOptions)
    .includes("ENGINE_PRIVATE_ENTITY_DIRECT"),
  false,
);
assert.equal(
  directOptionSet.omitted_count,
  1,
  "engine-side explicit_context_cue without a proven character-safe surface must be omitted",
);

const directBridge =
  directResolverOptions.find(
    (option) =>
      option.character_surface
        ?.representation
      === "bridge",
  );
const directSurroundings =
  directResolverOptions.find(
    (option) =>
      option.character_surface
        ?.representation
      === "current_surroundings",
  );

assert.ok(directBridge);
assert.ok(directSurroundings);

const deliberateSelected =
  materializeWorldSimulationRetrievalCueOrientationEvidence({
    query_id:
      "r4b1-direct-query",
    source_frontier_id:
      "r4b1-direct-frontier",
    initiation: {
      mode: "deliberate",
      trigger_origin: "external_prompt",
    },
    option_set:
      directOptionSet,
    resolution: {
      trigger: {
        grounding_status: "grounded",
        selected_cue_option_refs: [
          directSurroundings.cue_option_id,
        ],
      },
      orientation: {
        status: "selected",
        selected_cue_option_refs: [
          directBridge.cue_option_id,
        ],
      },
    },
  });

assert.equal(deliberateSelected.orientation.status, "selected");
assert.equal(deliberateSelected.orientation.grounded_cue_refs.length, 1);
assert.equal(deliberateSelected.trigger.grounding_status, "grounded");
assert.equal(deliberateSelected.boundaries.attention_weight_modeled, false);
assert.equal(deliberateSelected.boundaries.candidate_membership_changed, false);
assert.equal(deliberateSelected.boundaries.candidate_order_changed, false);

const characterView =
  buildWorldSimulationRetrievalCueOrientationCharacterView(
    deliberateSelected,
  );
assert.equal(
  JSON.stringify(characterView)
    .includes("ENGINE_PRIVATE_SCENE_DIRECT"),
  false,
);
assert.equal(characterView.orientation.status, "selected");

const deliberateUnspecified =
  materializeWorldSimulationRetrievalCueOrientationEvidence({
    query_id: "r4b1-direct-query",
    source_frontier_id: "r4b1-direct-frontier",
    initiation: {
      mode: "deliberate",
      trigger_origin: "self_generated",
    },
    option_set: directOptionSet,
  });
assert.equal(deliberateUnspecified.orientation.status, "unspecified");
assert.equal(deliberateUnspecified.trigger.grounding_status, "unspecified");

const deliberateNoOrientation =
  materializeWorldSimulationRetrievalCueOrientationEvidence({
    query_id: "r4b1-direct-query",
    source_frontier_id: "r4b1-direct-frontier",
    initiation: {
      mode: "deliberate",
      trigger_origin: "self_generated",
    },
    option_set: directOptionSet,
    resolution: {
      orientation: {
        status: "no_explicit_orientation",
        selected_cue_option_refs: [],
      },
    },
  });
assert.equal(deliberateNoOrientation.orientation.status, "no_explicit_orientation");

const spontaneousUnresolved =
  materializeWorldSimulationRetrievalCueOrientationEvidence({
    query_id: "r4b1-direct-query",
    source_frontier_id: "r4b1-direct-frontier",
    initiation: {
      mode: "spontaneous",
      trigger_origin: "environmental_cue",
    },
    option_set: directOptionSet,
    resolution: {
      trigger: {
        grounding_status: "unresolved",
        selected_cue_option_refs: [],
      },
    },
  });
assert.equal(spontaneousUnresolved.orientation.status, "not_applicable");
assert.equal(spontaneousUnresolved.orientation.applicable, false);
assert.equal(spontaneousUnresolved.trigger.grounding_status, "unresolved");

assert.throws(
  () =>
    materializeWorldSimulationRetrievalCueOrientationEvidence({
      query_id: "r4b1-direct-query",
      source_frontier_id: "r4b1-direct-frontier",
      initiation: {
        mode: "spontaneous",
        trigger_origin: "environmental_cue",
      },
      option_set: directOptionSet,
      resolution: {
        orientation: {
          status: "selected",
          selected_cue_option_refs: [
            directBridge.cue_option_id,
          ],
        },
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SPONTANEOUS_ORIENTATION_FORBIDDEN",
);

assert.throws(
  () =>
    materializeWorldSimulationRetrievalCueOrientationEvidence({
      query_id: "r4b1-direct-query",
      source_frontier_id: "r4b1-direct-frontier",
      initiation: {
        mode: "deliberate",
        trigger_origin: "self_generated",
      },
      option_set: directOptionSet,
      resolution: {
        orientation: {
          status: "selected",
          selected_cue_option_refs: ["fabricated-cue-ref"],
        },
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SELECTION_INVALID",
);

assert.throws(
  () =>
    materializeWorldSimulationRetrievalCueOrientationEvidence({
      query_id: "r4b1-direct-query",
      source_frontier_id: "r4b1-direct-frontier",
      initiation: {
        mode: "deliberate",
        trigger_origin: "self_generated",
      },
      option_set: directOptionSet,
      resolution: {
        orientation: {
          status: "selected",
          selected_cue_option_refs: [
            directBridge.cue_option_id,
            directBridge.cue_option_id,
          ],
        },
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SELECTION_DUPLICATE",
);

assert.equal(
  assertWorldSimulationRetrievalCueOrientationStageBoundary(
    "recovery",
    {
      contacted_candidate_refs: [],
    },
  ),
  true,
);
assert.throws(
  () =>
    assertWorldSimulationRetrievalCueOrientationStageBoundary(
      "continuation",
      {
        cue_orientation_resolution: {},
      },
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_PROCESS_WIDE_MUTATION_FORBIDDEN",
);

const character =
  "phase64a-r4b1-observer";
const secretScene =
  "ENGINE_PRIVATE_SCENE_R4B1_777";

const memories = [
  {
    memory_id: "r4b1-memory-a",
    content: {
      detail: "橋邊的燈亮著",
    },
    retrieval_cues: {
      scene_id: secretScene,
      memory_type: "episodic_direct_perception",
    },
    retrieval_cue_links: [
      {
        kind: "semantic",
        value: "bridge",
        source: "fixture-bridge",
      },
    ],
    retrieval_eligible: true,
    suppressed: false,
  },
  {
    memory_id: "r4b1-memory-b",
    content: {
      detail: "同一地點的另一段記憶",
    },
    retrieval_cues: {
      scene_id: secretScene,
      memory_type: "episodic_direct_perception",
    },
    retrieval_eligible: true,
    suppressed: false,
  },
];

const accessibilityBase = {
  character,
  memory_records: memories,
  memory_retrieval_profile: {
    enabled: true,
    model_mode: "cue_dependent_v2",
  },
  simulation_time: "2026-08-28T20:30:00+08:00",
  scene_id: secretScene,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind: "semantic",
        value: "bridge",
        source: "explicit_retrieval_context",
      },
    ],
  },
};

const initialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    accessibilityBase,
  );
const initialR4A =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      initialAccessibility,
  });

assert.equal(
  JSON.stringify(initialAccessibility.result)
    .includes(secretScene),
  true,
  "engine-side Phase63B evidence should retain canonical scene identity",
);
assert.equal(
  JSON.stringify(initialAccessibility.result)
    .includes("candidate_fan_out"),
  true,
  "fixture must actually contain fan evidence that R4B1 initiation hides",
);

const query =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character,
    turn_id: "r4b1-turn",
    phase63b_version:
      initialAccessibility.memory_accessibility_version,
    memory_records: memories,
    accessibility_base_input: accessibilityBase,
    initial_accessibility_query: initialAccessibility,
    initial_cue_diagnostic_projection: initialR4A,
    retrieval_goal: null,
  });

const initialCandidateIds =
  query.initial_frontier.candidate_refs
    .map((ref) => ref.memory_id);

let selectedBridgeOptionId = null;
let selectedSurroundingsOptionId = null;
let initialCharacterOrientationView = null;

const result =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query,
    memory_records: memories,
    accessibility_base_input: accessibilityBase,
    initial_accessibility_query: initialAccessibility,
    initial_cue_diagnostic_projection: initialR4A,
    technical_step_budget: 2,
    perception: {
      current_activity: "remembering",
    },
    character_state: {
      mood: "neutral",
    },
    resolver:
      async (input) => {
        if (input.stage === "initiation") {
          const serialized =
            JSON.stringify(input);

          assert.equal(serialized.includes(secretScene), false);
          assert.equal(serialized.includes("candidate_fan_out"), false);
          assert.equal(serialized.includes("competing_memory_ids"), false);
          assert.equal(serialized.includes("query_relative_selectivity_share"), false);
          assert.equal(Object.hasOwn(input.initial_frontier, "active_cues"), false);
          assert.equal(Object.hasOwn(input.initial_frontier, "candidate_evaluations"), false);
          assert.equal(Object.hasOwn(input.initial_frontier, "cue_diagnostic_projection"), false);
          assert.equal(Object.hasOwn(input.query.initial_frontier, "active_cues"), false);
          assert.equal(Object.hasOwn(input.query.initial_frontier, "cue_diagnostic_projection"), false);

          const options =
            input.available_cue_orientation_options;
          const bridge =
            options.find(
              (option) =>
                option.character_surface?.representation
                === "bridge",
            );
          const surroundings =
            options.find(
              (option) =>
                option.character_surface?.representation
                === "current_surroundings",
            );

          assert.ok(bridge);
          assert.ok(surroundings);

          selectedBridgeOptionId =
            bridge.cue_option_id;
          selectedSurroundingsOptionId =
            surroundings.cue_option_id;

          return {
            process_occurred: true,
            initiation: {
              mode: "deliberate",
              trigger_origin: "external_prompt",
            },
            retrieval_task: {
              mode: "cued_recall",
            },
            target: null,
            cue_orientation_resolution: {
              trigger: {
                grounding_status: "grounded",
                selected_cue_option_refs: [
                  selectedSurroundingsOptionId,
                ],
              },
              orientation: {
                status: "selected",
                selected_cue_option_refs: [
                  selectedBridgeOptionId,
                ],
              },
            },
          };
        }

        if (input.stage === "recovery") {
          initialCharacterOrientationView =
            input.process.cue_orientation;

          const serializedOrientation =
            JSON.stringify(
              input.process.cue_orientation,
            );

          assert.equal(serializedOrientation.includes(secretScene), false);
          assert.equal(serializedOrientation.includes("canonical_cue"), false);
          assert.equal(input.process.cue_orientation.orientation.status, "selected");
          assert.equal(
            input.process.cue_orientation.orientation.selected_cues[0].cue_option_id,
            selectedBridgeOptionId,
          );

          return {
            contacted_candidate_refs: [
              "r4b1-memory-a",
            ],
            recovered_selections: [
              {
                source_memory_ref: "r4b1-memory-a",
                selector: {
                  kind: "whole_content",
                },
                content_kind: "detail",
              },
            ],
          };
        }

        if (input.stage === "continuation") {
          assert.deepEqual(
            input.process.cue_orientation,
            initialCharacterOrientationView,
            "process-wide orientation must remain stable across retrieval steps",
          );

          return {
            control_action: "stop",
            control_reason: "r4b1 fixture complete",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(`Unexpected resolver stage: ${input.stage}`);
      },
  });

assert.equal(result.process_occurred, true);
assert.equal(result.retrieval_process.search_orientation.version, worldSimulationRetrievalCueOrientationEvidenceVersion);
assert.equal(result.retrieval_process.search_orientation.trigger.grounding_status, "grounded");
assert.equal(result.retrieval_process.search_orientation.orientation.status, "selected");
assert.equal(
  result.retrieval_process.search_orientation.orientation.grounded_cue_refs[0].cue_option_id,
  selectedBridgeOptionId,
);
assert.equal(
  result.retrieval_process.search_orientation.trigger.grounded_cue_refs[0].cue_option_id,
  selectedSurroundingsOptionId,
);
const persistedTriggerCanonicalCue =
  result.retrieval_process.search_orientation.trigger.grounded_cue_refs[0].canonical_cue;
assert.equal(
  persistedTriggerCanonicalCue.kind,
  "spatial_context",
  "engine-side evidence must preserve canonical cue kind",
);
assert.equal(
  persistedTriggerCanonicalCue.value,
  secretScene.toLocaleLowerCase("zh-Hant-TW"),
  "engine-side evidence must preserve Phase63B-normalized canonical grounding even though resolver cannot see it",
);
assert.deepEqual(
  result.retrieval_process.steps[0].frontier.candidate_refs
    .map((ref) => ref.memory_id),
  initialCandidateIds,
  "R4B1 evidence must not alter Phase63B candidate membership",
);
assert.equal(result.engine_audit.retrieval_cue_orientation_evidence_materialized, true);
assert.equal(result.engine_audit.retrieval_cue_orientation_attention_weight_modeled, false);
assert.equal(result.engine_audit.retrieval_cue_orientation_changed_candidate_membership, false);
assert.equal(result.engine_audit.retrieval_cue_orientation_changed_candidate_order, false);
assert.equal(result.engine_audit.retrieval_cue_orientation_changed_retrieval_contact, false);
assert.equal(result.engine_audit.retrieval_cue_orientation_raw_engine_cues_exposed_at_initiation, false);
assert.equal(result.engine_audit.retrieval_cue_orientation_candidate_competition_exposed_at_initiation, false);

const persistenceContract =
  buildWorldSimulationMemoryRetrievalPersistenceContract();
assert.equal(persistenceContract.retrieval_cue_orientation_evidence_persisted, true);
assert.equal(persistenceContract.retrieval_cue_orientation_persists_actual_selection_only, true);
assert.equal(
  persistenceContract.authoritative_mutation_owner,
  "phase62k-authoritative-mutation-executor-v1",
);

const persistence =
  buildWorldSimulationMemoryRetrievalPersistence({
    world_state: {
      simulation_time: "2026-08-28T20:30:00+08:00",
      retrieval_events: {},
      memories: {
        [character]: memories,
      },
    },
    turn_id: "r4b1-turn",
    occurred_at: "2026-08-28T20:30:00+08:00",
    retrieval_processes: [
      {
        observer: character,
        version: result.version,
        result,
      },
    ],
  });

assert.equal(persistence.result.retrieval_events_created.length, 1);
const persistedEvent =
  persistence.result.retrieval_events_created[0];
assert.equal(
  persistedEvent.search_orientation.orientation_evidence_id,
  result.retrieval_process.search_orientation.orientation_evidence_id,
);
assert.equal(persistedEvent.search_orientation.orientation.status, "selected");
assert.equal(persistedEvent.engine_audit.retrieval_cue_orientation_evidence_persisted, true);
assert.equal(persistedEvent.engine_audit.retrieval_cue_orientation_counterfactual_options_persisted, false);
assert.equal(
  JSON.stringify(persistedEvent.search_orientation)
    .includes("available_cue_orientation_options"),
  false,
  "counterfactual available orientation options must not be persisted",
);

const multistepContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();
assert.equal(multistepContract.phase64a_r4b1_new_resolver_stage_added, false);
assert.equal(multistepContract.phase64a_r4b1_orientation_is_process_wide_baseline, true);
assert.equal(multistepContract.phase64a_r4b1_attention_weight_modeled, false);
assert.equal(multistepContract.phase64a_r4b1_candidate_membership_authority, false);
assert.equal(multistepContract.phase64a_r4b1_raw_engine_cues_exposed_at_initiation, false);
assert.equal(multistepContract.phase64a_r4b1_candidate_competition_exposed_at_initiation, false);
assert.deepEqual(
  multistepContract.staged_resolver_lifecycle,
  ["initiation", "recovery", "continuation"],
);

const multistepSource =
  (
    await readFile(
      path.join(
        projectRoot,
        "server/src/world-simulation-memory-retrieval-multistep-service.mjs",
      ),
      "utf8",
    )
  ).replace(/\r\n/g, "\n");
const persistenceSource =
  (
    await readFile(
      path.join(
        projectRoot,
        "server/src/world-simulation-memory-retrieval-persistence-service.mjs",
      ),
      "utf8",
    )
  ).replace(/\r\n/g, "\n");
const runAllSource =
  (
    await readFile(
      path.join(
        projectRoot,
        "tests/run-all.mjs",
      ),
      "utf8",
    )
  ).replace(/\r\n/g, "\n");

assert.match(
  multistepSource,
  /available_cue_orientation_options:\s*cloneJson\(\s*cueOrientationResolverOptions,/,
);
assert.match(
  multistepSource,
  /resolverInitiationQueryView\(\s*query,\s*currentFrontier,/,
);
assert.match(
  multistepSource,
  /search_orientation:\s*cloneJson\(\s*cueOrientationEvidence,/,
);
assert.match(
  multistepSource,
  /assertWorldSimulationRetrievalCueOrientationStageBoundary\(\s*"recovery"/,
);
assert.match(
  multistepSource,
  /assertWorldSimulationRetrievalCueOrientationStageBoundary\(\s*"continuation"/,
);
assert.match(
  persistenceSource,
  /search_orientation:\s*cloneJson\(\s*process\.search_orientation/,
);
assert.match(
  runAllSource,
  /Phase 64A-R4B1 retrieval cue orientation evidence/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase64A-R4B1 Retrieval Cue Orientation Evidence",
  deliberate_grounded_orientation_verified: true,
  spontaneous_orientation_forbidden: true,
  unresolved_spontaneous_trigger_supported: true,
  raw_engine_cue_identity_exposed_at_initiation: false,
  candidate_competition_exposed_at_initiation: false,
  r4a_diagnosticity_exposed_at_initiation: false,
  process_wide_orientation_maintenance_verified: true,
  candidate_membership_changed: false,
  candidate_order_authority_added: false,
  attention_weight_invented: false,
  retrieval_event_orientation_persistence_verified: true,
  phase62k_persistent_writer_preserved: true,
}));
console.log("Phase64A-R4B1 retrieval cue orientation evidence: PASS");
