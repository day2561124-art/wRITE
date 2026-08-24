import assert from "node:assert/strict";
import {
  readFile,
  rm,
} from "node:fs/promises";
import path from "node:path";

import {
  projectRoot,
} from "../../server/src/project-paths.mjs";

import {
  buildWorldSimulationLoopContract,
  prepareWorldSimulationTurn,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";

import {
  buildWorldSimulationCapabilityContract,
} from "../../server/src/world-simulation-neural-service.mjs";

import {
  buildWorldSimulationMemoryRetrievalProcessContract,
  buildWorldSimulationMemoryRetrievalQuery,
  worldSimulationMemoryRetrievalProcessVersion,
} from "../../server/src/world-simulation-memory-retrieval-process-service.mjs";

import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";

const contract =
  buildWorldSimulationMemoryRetrievalProcessContract();

assert.equal(
  contract.version,
  "phase63c-memory-retrieval-process-v1",
);

assert.equal(
  worldSimulationMemoryRetrievalProcessVersion,
  contract.version,
);

assert.equal(
  contract.retrieval_process_schema_installed,
  true,
);

assert.equal(
  contract.retrieval_event_schema_installed,
  true,
);

assert.equal(
  contract.retrieval_process_execution_installed,
  false,
);

assert.equal(
  contract.retrieval_event_persistence_installed,
  false,
);

assert.equal(
  contract.candidate_content_barrier_enforced,
  true,
);

assert.equal(
  contract.native_recovered_memory_channel_installed,
  true,
);

assert.equal(
  contract.native_recovered_memory_channel,
  "recovered_memories",
);

assert.equal(
  contract.native_recovered_memories_without_retrieval_kernel,
  "empty",
);

assert.equal(
  contract.legacy_projector_api_preserved,
  true,
);

assert.equal(
  contract.legacy_projector_native_character_brain_path_active,
  false,
);

assert.equal(
  contract.candidate_content_barrier_owner,
  "Phase63C Step2",
);

assert.equal(
  contract.retrieval_event_store_authority,
  "world_state.retrieval_events",
);

assert.equal(
  contract.retrieval_event_immutability_required,
  true,
);

assert.equal(
  contract.retrieval_event_immutability_enforced,
  false,
);

assert.equal(
  contract.retrieval_history_append_only_required,
  true,
);

assert.equal(
  contract.retrieval_history_append_only_enforced,
  false,
);

assert.equal(
  contract.retrieval_history_authority,
  "retrieval_event_reference",
);

assert.equal(
  contract.recall_summary_is_authoritative,
  false,
);

assert.equal(
  contract.same_cycle_phase63b_feedback_allowed,
  false,
);

assert.equal(
  contract.multi_step_retrieval_schema_supported,
  true,
);

assert.equal(
  contract.spontaneous_retrieval_schema_supported,
  true,
);

assert.equal(
  contract.failed_retrieval_event_supported,
  true,
);

assert.equal(
  contract.partial_outcome_uses_arbitrary_percentage,
  false,
);

assert.equal(
  contract.retrieval_reinforcement_modeled,
  false,
);

assert.equal(
  contract.retrieval_induced_forgetting_modeled,
  false,
);

assert.equal(
  contract.reconsolidation_modeled,
  false,
);

assert.equal(
  contract.source_confusion_modeled,
  false,
);

assert.equal(
  contract.direct_world_state_mutation_allowed,
  false,
);

assert.equal(
  contract.authoritative_mutation_owner,
  "phase62k-authoritative-mutation-executor-v1",
);

const processSchema =
  contract.schemas.retrieval_process;

assert(
  processSchema
    .properties
    .initiation
    .properties
    .mode
    .enum
    .includes(
      "deliberate",
    ),
);

assert(
  processSchema
    .properties
    .initiation
    .properties
    .mode
    .enum
    .includes(
      "spontaneous",
    ),
);

assert(
  processSchema
    .properties
    .retrieval_task
    .properties
    .mode
    .enum
    .includes(
      "recognition",
    ),
);

const eventSchema =
  contract.schemas.retrieval_event;

for (
  const value
  of [
    "satisfied",
    "partially_satisfied",
    "failed",
    "not_applicable",
  ]
) {
  assert(
    eventSchema
      .properties
      .target_outcome
      .enum
      .includes(value),
  );
}

const secretA =
  "SECRET_CANDIDATE_CONTENT_A";

const secretB =
  "SECRET_CANDIDATE_CONTENT_B";

const candidateInput = [
  {
    memory_id:
      "memory_a",

    content:
      secretA,

    accessibility_score:
      null,
  },

  {
    memory_id:
      "memory_b",

    content:
      secretB,

    candidate_diagnostics: {
      engine_only:
        true,
    },
  },
];

const candidateSnapshot =
  JSON.stringify(
    candidateInput,
  );

const query =
  buildWorldSimulationMemoryRetrievalQuery({
    character:
      "伊萊亞斯・諾爾",

    turn_id:
      "turn_phase63c_step1",

    phase63b_version:
      "phase63b-cue-dependent-memory-accessibility-v2",

    candidate_memory_records:
      candidateInput,

    initial_cues: [
      {
        kind:
          "spatial_context",

        value:
          "third-practicum-room",
      },
    ],

    retrieval_goal: {
      kind:
        "unspecified",
    },
  });

assert.equal(
  JSON.stringify(
    candidateInput,
  ),
  candidateSnapshot,
  "Phase63C query builder mutated candidate input",
);

assert.equal(
  query.candidate_count,
  2,
);

assert.deepEqual(
  query.candidate_refs,
  [
    {
      memory_id:
        "memory_a",

      candidate_index:
        0,
    },

    {
      memory_id:
        "memory_b",

      candidate_index:
        1,
    },
  ],
);

assert.equal(
  JSON.stringify(
    query,
  ).includes(
    secretA,
  ),
  false,
);

assert.equal(
  JSON.stringify(
    query,
  ).includes(
    secretB,
  ),
  false,
);

assert.equal(
  query.boundaries
    .query_embeds_candidate_content,
  false,
);

assert.equal(
  query.boundaries
    .query_forwarded_to_character_brain,
  false,
);

assert.equal(
  query.boundaries
    .query_embeds_candidate_accessibility_diagnostics,
  false,
);

assert.equal(
  query.boundaries
    .global_candidate_content_barrier_enforced,
  true,
);

assert.equal(
  query.boundaries
    .global_candidate_content_barrier_owner,
  "Phase63C Step2",
);

assert.equal(
  query.boundaries
    .candidate_set_frozen_for_process,
  true,
);

assert.equal(
  Object.isFrozen(
    query,
  ),
  true,
);

assert.equal(
  Object.isFrozen(
    query.candidate_refs,
  ),
  true,
);

const queryAgain =
  buildWorldSimulationMemoryRetrievalQuery({
    character:
      "伊萊亞斯・諾爾",

    turn_id:
      "turn_phase63c_step1",

    phase63b_version:
      "phase63b-cue-dependent-memory-accessibility-v2",

    candidate_memory_records:
      candidateInput,

    initial_cues: [
      {
        kind:
          "spatial_context",

        value:
          "third-practicum-room",
      },
    ],

    retrieval_goal: {
      kind:
        "unspecified",
    },
  });

assert.equal(
  queryAgain.query_id,
  query.query_id,
);

assert.equal(
  queryAgain.candidate_set_hash,
  query.candidate_set_hash,
);

assert.throws(
  () =>
    buildWorldSimulationMemoryRetrievalQuery({
      character:
        "伊萊亞斯・諾爾",

      turn_id:
        "duplicate-candidate",

      phase63b_version:
        "phase63b-cue-dependent-memory-accessibility-v2",

      candidate_memory_records: [
        {
          memory_id:
            "duplicate",
        },
        {
          memory_id:
            "duplicate",
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_DUPLICATE",
);

const loopContract =
  buildWorldSimulationLoopContract();

assert.equal(
  loopContract
    .subjective_memory_retrieval_process
    .version,
  contract.version,
);

assert.equal(
  loopContract
    .memory_context_projection
    .phase63c_schema_contract_installed,
  true,
);

assert.equal(
  loopContract
    .memory_context_projection
    .candidate_content_barrier_enforced,
  true,
);

assert.equal(
  loopContract
    .memory_context_projection
    .candidate_content_barrier_owner,
  "Phase63C Step2",
);

assert.equal(
  loopContract
    .memory_context_projection
    .native_character_brain_memory_channel,
  "recovered_memories",
);

assert.equal(
  loopContract
    .memory_context_projection
    .legacy_projector_output_engine_only_in_native_loop,
  true,
);

assert.equal(
  loopContract
    .memory_context_projection
    .legacy_projected_memory_content_forwarded_to_character_brain,
  false,
);

assert.equal(
  loopContract
    .memory_context_projection
    .native_retrieval_process_execution_installed,
  false,
);

const legacyProjectorContract =
  buildWorldSimulationCapabilityContract(
    "world_memory_retriever",
  );

assert.equal(
  legacyProjectorContract
    .architecture_role,
  "legacy_candidate_context_projector_preserved_for_direct_compatibility",
);

assert.equal(
  legacyProjectorContract
    .phase63c_schema_contract_installed,
  true,
);

assert.equal(
  legacyProjectorContract
    .direct_legacy_projector_api_preserved,
  true,
);

assert.equal(
  legacyProjectorContract
    .candidate_content_barrier_enforced_in_native_world_loop,
  true,
);

assert.equal(
  legacyProjectorContract
    .native_world_loop_forwards_projected_content_to_character_brain,
  false,
);

// Step 1 installs the canonical schema/service contract,
// but deliberately does not add a new neural capability yet.
assert.equal(
  buildWorldSimulationCapabilityContract(
    "world_memory_retrieval_process",
  ),
  null,
);

const legacyDoc =
  await readFile(
    new URL(
      "../../docs/WORLD-SIMULATION-MEMORY-ACCESSIBILITY-RETRIEVAL.md",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  legacyDoc,
  /Legacy Phase63B v1 design note/u,
);

assert.equal(
  legacyDoc.includes(
    "Recall reinforcement/retrieval practice belongs to Phase63C",
  ),
  false,
);

const step2FixtureRoot =
  path.join(
    projectRoot,
    "tests",
    ".tmp",
    `phase63c-step2-barrier-${process.pid}-${Date.now()}`,
  );

await rm(
  step2FixtureRoot,
  {
    recursive: true,
    force: true,
  },
);

const unretrievedSecret =
  "SECRET_UNRETRIEVED_MEMORY_CONTENT_PHASE63C_STEP2";

let step2RuntimeVerified =
  false;

try {
  const character =
    "phase63c-step2-observer";

  const sceneId =
    "phase63c-step2-room";

  const eventId =
    "phase63c-step2-event";

  const session =
    await beginWorldSimulationSession(
      {
        simulation_label:
          "Phase63C Step2 candidate-content barrier fixture",

        seed:
          "phase63c-step2",

        rules: {
          event_driven:
            true,

          persistent_causality:
            true,
        },

        initial_world_state: {
          simulation_time:
            "2026-08-24T23:55:00+08:00",

          event_queue: [
            {
              event_id:
                eventId,

              type:
                "phase63c_step2_memory_barrier",

              scene_id:
                sceneId,

              participants: [
                character,
              ],
            },
          ],

          scenes: {
            [sceneId]: {
              scene_id:
                sceneId,

              dimensions: {
                width_m:
                  8,

                depth_m:
                  8,
              },

              entity_positions: {
                [character]: {
                  x:
                    2,

                  y:
                    2,
                },
              },

              obstacles: [],
              structures: [],
              doors: [],
            },
          },

          characters: {
            [character]: {
              known: [
                "自己正在測試場景中",
              ],

              current_goal:
                "留在原地",

              current_action:
                "等待",
            },
          },

          memories: {
            [character]: [
              {
                memory_id:
                  "phase63c-step2-secret-memory",

                memory_type:
                  "episodic_direct_perception",

                content:
                  unretrievedSecret,

                accessible:
                  true,

                suppressed:
                  false,
              },
            ],
          },

          objects: {},

          available_actions: {
            [character]: [
              {
                action_id:
                  "remain-still",

                intent:
                  "留在原地",
              },
            ],
          },
        },
      },
      {
        fixtureRoot:
          step2FixtureRoot,
      },
    );

  const prepared =
    await prepareWorldSimulationTurn(
      {
        world_simulation_session_id:
          session.world_simulation_session_id,

        event_id:
          eventId,
      },
      {
        fixtureRoot:
          step2FixtureRoot,
      },
    );

  // The Phase63B engine-side audit still owns the actual
  // candidate record and therefore proves the candidate was
  // not merely removed to make the leakage assertion pass.
  assert.equal(
    JSON.stringify(
      prepared.memory_accessibility_queries,
    ).includes(
      unretrievedSecret,
    ),
    true,
  );

  // The frozen 63C query contains refs/hash only.
  assert.equal(
    prepared.memory_retrieval_queries.length,
    1,
  );

  assert.equal(
    JSON.stringify(
      prepared.memory_retrieval_queries,
    ).includes(
      unretrievedSecret,
    ),
    false,
  );

  assert.equal(
    prepared
      .memory_retrieval_queries[0]
      .query
      .candidate_refs[0]
      .memory_id,
    "phase63c-step2-secret-memory",
  );

  const preparedPacket =
    prepared.decision_packets[0];

  assert.equal(
    JSON.stringify(
      preparedPacket,
    ).includes(
      unretrievedSecret,
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      preparedPacket,
      "projected_memories",
    ),
    false,
  );

  assert.deepEqual(
    preparedPacket
      .recovered_memories,
    [],
  );

  assert.deepEqual(
    preparedPacket
      .retrieved_memories,
    [],
  );

  assert.equal(
    Object.hasOwn(
      preparedPacket.cognition,
      "projected_memories",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      preparedPacket.cognition,
      "retrieved_memories",
    ),
    false,
  );

  assert.deepEqual(
    preparedPacket
      .cognition
      .recovered_memories,
    [],
  );

  const brainInputs = [];

  const turn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          session.world_simulation_session_id,

        event_id:
          eventId,
      },
      {
        fixtureRoot:
          step2FixtureRoot,

        characterBrain:
          async (packet) => {
            brainInputs.push(
              packet,
            );

            assert.equal(
              JSON.stringify(
                packet,
              ).includes(
                unretrievedSecret,
              ),
              false,
            );

            assert.equal(
              Object.hasOwn(
                packet,
                "projected_memories",
              ),
              false,
            );

            assert.deepEqual(
              packet.recovered_memories,
              [],
            );

            assert.deepEqual(
              packet.retrieved_memories,
              [],
            );

            assert.equal(
              JSON.stringify(
                packet.cognition,
              ).includes(
                unretrievedSecret,
              ),
              false,
            );

            return {
              action_id:
                "remain-still",
            };
          },

        causalAdjudicator:
          async (input) => ({
            causal_resolution_id:
              "phase63c-step2-noop",

            next_world_state:
              structuredClone(
                input.world_state,
              ),

            state_transitions:
              [],

            action_outcomes: [
              {
                actor:
                  character,

                action_id:
                  "remain-still",

                result:
                  "remained_still",

                causal_evidence:
                  "fixture intentionally performs no hard-state movement",
              },
            ],

            knowledge_transitions:
              [],

            scheduled_events:
              [],
          }),
      },
    );

  assert.equal(
    turn.ok,
    true,
  );

  assert.equal(
    turn.committed,
    true,
  );

  assert.equal(
    brainInputs.length,
    1,
  );

  step2RuntimeVerified =
    true;
} finally {
  await rm(
    step2FixtureRoot,
    {
      recursive: true,
      force: true,
    },
  );
}

const report = {
  memory_retrieval_process_version:
    contract.version,

  retrieval_process_schema_installed:
    contract.retrieval_process_schema_installed,

  retrieval_event_schema_installed:
    contract.retrieval_event_schema_installed,

  retrieval_event_store_authority:
    contract.retrieval_event_store_authority,

  retrieval_event_immutability_required:
    contract.retrieval_event_immutability_required,

  retrieval_event_immutability_enforced:
    contract.retrieval_event_immutability_enforced,

  retrieval_history_append_only_required:
    contract.retrieval_history_append_only_required,

  retrieval_history_append_only_enforced:
    contract.retrieval_history_append_only_enforced,

  retrieval_history_authority:
    contract.retrieval_history_authority,

  recall_summary_is_authoritative:
    contract.recall_summary_is_authoritative,

  retrieval_reinforcement_modeled:
    contract.retrieval_reinforcement_modeled,

  retrieval_induced_forgetting_modeled:
    contract.retrieval_induced_forgetting_modeled,

  reconsolidation_modeled:
    contract.reconsolidation_modeled,

  source_confusion_modeled:
    contract.source_confusion_modeled,

  same_cycle_phase63b_feedback_allowed:
    contract.same_cycle_phase63b_feedback_allowed,

  multi_step_retrieval_schema_supported:
    contract.multi_step_retrieval_schema_supported,

  spontaneous_retrieval_schema_supported:
    contract.spontaneous_retrieval_schema_supported,

  failed_retrieval_event_supported:
    contract.failed_retrieval_event_supported,

  partial_outcome_uses_arbitrary_percentage:
    contract.partial_outcome_uses_arbitrary_percentage,

  candidate_content_barrier_enforced:
    contract.candidate_content_barrier_enforced,

  native_recovered_memory_channel:
    contract.native_recovered_memory_channel,

  unretrieved_candidate_content_reaches_character_brain:
    false,

  step2_runtime_information_barrier_verified:
    step2RuntimeVerified,

  native_retrieval_process_capability_activated:
    buildWorldSimulationCapabilityContract(
      "world_memory_retrieval_process",
    ) !== null,

  legacy_projector_api_preserved:
    contract.legacy_projector_api_preserved,

  legacy_projector_native_character_brain_path_active:
    contract.legacy_projector_native_character_brain_path_active,
};

console.log(
  JSON.stringify(
    report,
  ),
);

console.log(
  "Phase63C memory retrieval process Step 2 candidate-content barrier test passed.",
);
