import assert from "node:assert/strict";
import {
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
  executeWorldSimulationMemoryRetrievalProcess,
  worldSimulationMemoryRetrievalProcessVersion,
} from "../../server/src/world-simulation-memory-retrieval-process-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";

const contract =
  buildWorldSimulationMemoryRetrievalProcessContract();

assert.equal(
  contract.version,
  "phase63c-memory-retrieval-process-v2",
);
assert.equal(
  worldSimulationMemoryRetrievalProcessVersion,
  contract.version,
);
assert.equal(contract.retrieval_process_schema_installed, true);
assert.equal(contract.retrieval_event_schema_installed, true);
assert.equal(contract.retrieval_process_execution_installed, true);
assert.equal(contract.single_step_retrieval_execution_installed, true);
assert.equal(contract.multi_step_retrieval_execution_installed, false);
assert.equal(contract.retrieval_event_persistence_installed, false);
assert.equal(contract.candidate_content_barrier_enforced, true);
assert.equal(contract.native_recovered_memory_channel, "recovered_memories");
assert.equal(contract.retrieval_experience_channel_installed, true);
assert.equal(contract.missing_retrieval_resolver_means_no_process, true);
assert.equal(contract.candidate_presence_implies_process, false);
assert.equal(contract.candidate_order_implies_success, false);
assert.equal(contract.grounded_fragment_materialization_installed, true);
assert.equal(contract.recovered_content_authored_by_resolver_allowed, false);
assert.equal(contract.partial_recovery_uses_source_selectors, true);
assert.equal(contract.string_partial_slicing_allowed, false);
assert.equal(contract.generated_gist_without_source_trace_allowed, false);
assert.equal(contract.partial_outcome_uses_arbitrary_percentage, false);
assert.equal(contract.universal_retrieval_probability_modeled, false);
assert.equal(contract.universal_success_threshold_modeled, false);
assert.equal(contract.unseeded_randomness_used_by_kernel, false);
assert.equal(contract.retrieval_reinforcement_modeled, false);
assert.equal(contract.retrieval_induced_forgetting_modeled, false);
assert.equal(contract.reconsolidation_modeled, false);
assert.equal(contract.direct_world_state_mutation_allowed, false);
assert.equal(
  contract.authoritative_mutation_owner,
  "phase62k-authoritative-mutation-executor-v1",
);

const candidateInput = [
  {
    memory_id: "memory_a",
    memory_type: "episodic_direct_perception",
    content: {
      actor: "伊萊亞斯",
      action: "伸手摸了摸阿灰背甲",
      expression: "皺眉",
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
  },
  {
    memory_id: "memory_b",
    content: {
      sound: "金屬碰撞聲",
      location: "門邊",
    },
    source: {
      kind: "direct_perception",
      sense: "auditory",
    },
  },
];

const query =
  buildWorldSimulationMemoryRetrievalQuery({
    character: "伊萊亞斯・諾爾",
    turn_id: "turn_phase63c_step3",
    phase63b_version: "phase63b-cue-dependent-memory-accessibility-v2",
    candidate_memory_records: candidateInput,
    initial_cues: [
      {
        kind: "spatial_context",
        value: "third-practicum-room",
      },
    ],
    retrieval_goal: {
      kind: "memory_content",
      memory_id: "memory_a",
      requested_selectors: [
        {
          kind: "json_pointer",
          path: "/actor",
        },
        {
          kind: "json_pointer",
          path: "/action",
        },
      ],
    },
  });

assert.equal(query.candidate_count, 2);
assert.equal(JSON.stringify(query).includes("伸手摸了摸阿灰背甲"), false);
assert.equal(query.boundaries.query_embeds_candidate_content, false);
assert.equal(Object.isFrozen(query), true);

const noProcess =
  executeWorldSimulationMemoryRetrievalProcess({
    query,
    candidate_memory_records: candidateInput,
  });

assert.equal(noProcess.process_occurred, false);
assert.deepEqual(noProcess.recovered_memories, []);
assert.equal(noProcess.target_outcome, null);
assert.deepEqual(
  noProcess.retrieval_experience,
  {
    process_occurred: false,
    initiation_mode: null,
    target_outcome: null,
    recovered_any_content: false,
  },
);

const partial =
  executeWorldSimulationMemoryRetrievalProcess({
    query,
    candidate_memory_records: candidateInput,
    resolution: {
      process_occurred: true,
      initiation: {
        mode: "deliberate",
        trigger_origin: "self_generated",
      },
      retrieval_task: {
        mode: "cued_recall",
      },
      contacted_candidate_refs: [
        "memory_a",
      ],
      recovered_selections: [
        {
          source_memory_ref: "memory_a",
          selector: {
            kind: "json_pointer",
            path: "/actor",
          },
          content_kind: "identity_fragment",
          target_relation: "target_related",
        },
      ],
    },
  });

assert.equal(partial.process_occurred, true);
assert.equal(partial.target_outcome, "partially_satisfied");
assert.equal(partial.recovered_any_content, true);
assert.equal(partial.recovered_fragments.length, 1);
assert.equal(partial.recovered_fragments[0].content, "伊萊亞斯");
assert.equal(
  partial.recovered_fragments[0]
    .content_grounding.selector.path,
  "/actor",
);
assert.equal(
  partial.recovered_fragments[0]
    .content_grounding.materialized_by_kernel,
  true,
);
assert.equal(
  Object.hasOwn(partial.recovered_memories[0], "content_grounding"),
  false,
);
assert.equal(
  Object.hasOwn(partial.recovered_memories[0], "source_memory_ref"),
  false,
);
assert.equal(
  JSON.stringify(partial.recovered_memories)
    .includes("伸手摸了摸阿灰背甲"),
  false,
);

const satisfied =
  executeWorldSimulationMemoryRetrievalProcess({
    query,
    candidate_memory_records: candidateInput,
    resolution: {
      process_occurred: true,
      initiation: {
        mode: "deliberate",
      },
      retrieval_task: {
        mode: "cued_recall",
      },
      contacted_candidate_refs: ["memory_a"],
      recovered_selections: [
        {
          source_memory_ref: "memory_a",
          selector: {
            kind: "json_pointer",
            path: "/actor",
          },
          content_kind: "identity_fragment",
          target_relation: "target_related",
        },
        {
          source_memory_ref: "memory_a",
          selector: {
            kind: "json_pointer",
            path: "/action",
          },
          content_kind: "detail",
          target_relation: "target_related",
        },
      ],
    },
  });

assert.equal(satisfied.target_outcome, "satisfied");
assert.equal(satisfied.recovered_memories.length, 2);

const nonTargetQuery =
  buildWorldSimulationMemoryRetrievalQuery({
    character: "夜",
    turn_id: "turn_non_target",
    phase63b_version: "phase63b-cue-dependent-memory-accessibility-v2",
    candidate_memory_records: candidateInput,
    retrieval_goal: {
      kind: "memory_ref",
      memory_id: "memory_a",
    },
  });

const failedWithNonTarget =
  executeWorldSimulationMemoryRetrievalProcess({
    query: nonTargetQuery,
    candidate_memory_records: candidateInput,
    resolution: {
      process_occurred: true,
      initiation: {
        mode: "deliberate",
        trigger_origin: "self_generated",
      },
      retrieval_task: {
        mode: "associative_recall",
      },
      contacted_candidate_refs: [
        "memory_a",
        "memory_b",
      ],
      recovered_selections: [
        {
          source_memory_ref: "memory_b",
          content_kind: "sensory_fragment",
          target_relation: "non_target",
        },
      ],
    },
  });

assert.equal(failedWithNonTarget.target_outcome, "failed");
assert.equal(failedWithNonTarget.recovered_any_content, true);
assert.equal(
  failedWithNonTarget.recovered_memories[0].target_relation,
  "non_target",
);

const spontaneous =
  executeWorldSimulationMemoryRetrievalProcess({
    query:
      buildWorldSimulationMemoryRetrievalQuery({
        character: "梅芙・柯林斯",
        turn_id: "turn_spontaneous",
        phase63b_version: "phase63b-cue-dependent-memory-accessibility-v2",
        candidate_memory_records: [candidateInput[1]],
      }),
    candidate_memory_records: [candidateInput[1]],
    resolution: {
      process_occurred: true,
      initiation: {
        mode: "spontaneous",
        trigger_origin: "environmental_cue",
      },
      retrieval_task: {
        mode: "associative_recall",
      },
      contacted_candidate_refs: ["memory_b"],
      recovered_selections: [
        {
          source_memory_ref: "memory_b",
          content_kind: "sensory_fragment",
          target_relation: "unresolved",
        },
      ],
    },
  });

assert.equal(spontaneous.target_outcome, "not_applicable");
assert.equal(spontaneous.recovered_any_content, true);

assert.throws(
  () =>
    executeWorldSimulationMemoryRetrievalProcess({
      query,
      candidate_memory_records: candidateInput,
      resolution: {
        process_occurred: true,
        initiation: {
          mode: "deliberate",
        },
        contacted_candidate_refs: ["memory_a"],
        recovered_selections: [
          {
            source_memory_ref: "memory_a",
            content: "RESOLVER_AUTHORED_FAKE_MEMORY",
            target_relation: "target_related",
          },
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_MEMORY_RETRIEVAL_AUTHORED_CONTENT_FORBIDDEN",
);

assert.throws(
  () =>
    executeWorldSimulationMemoryRetrievalProcess({
      query,
      candidate_memory_records: candidateInput,
      resolution: {
        process_occurred: true,
        initiation: {
          mode: "deliberate",
        },
        contacted_candidate_refs: ["memory_a"],
        recovered_selections: [
          {
            source_memory_ref: "memory_a",
            selector: {
              kind: "json_pointer",
              path: "/missing",
            },
          },
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_NOT_FOUND",
);

assert.throws(
  () =>
    executeWorldSimulationMemoryRetrievalProcess({
      query,
      candidate_memory_records: candidateInput,
      resolution: {
        process_occurred: true,
        initiation: {
          mode: "deliberate",
        },
        reinstated_cues: [
          {
            kind: "internally_reinstated",
            value: "later-step-cue",
          },
        ],
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_MEMORY_RETRIEVAL_MULTI_STEP_NOT_INSTALLED",
);

const alteredCandidates =
  structuredClone(candidateInput);
alteredCandidates[0].content.actor = "被竄改";
assert.throws(
  () =>
    executeWorldSimulationMemoryRetrievalProcess({
      query,
      candidate_memory_records: alteredCandidates,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_SET_MISMATCH",
);

const loopContract =
  buildWorldSimulationLoopContract();
assert.equal(
  loopContract
    .memory_context_projection
    .native_retrieval_process_execution_installed,
  true,
);
assert.equal(
  loopContract
    .memory_context_projection
    .missing_retrieval_resolver_means_no_process,
  true,
);
assert.equal(
  loopContract
    .memory_context_projection
    .legacy_projected_memory_content_forwarded_to_character_brain,
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
    .native_world_loop_forwards_projected_content_to_character_brain,
  false,
);

const fixtureRoot =
  path.join(
    projectRoot,
    "tests",
    ".tmp",
    `phase63c-step3-kernel-${process.pid}-${Date.now()}`,
  );

await rm(
  fixtureRoot,
  {
    recursive: true,
    force: true,
  },
);

const recoveredAction =
  "阿灰撞過活動擋板";
const unretrievedSecret =
  "SECRET_SAME_MEMORY_UNRETRIEVED_DETAIL";

let nativeLoopVerified = false;

try {
  const character = "phase63c-step3-observer";
  const sceneId = "phase63c-step3-room";
  const eventId = "phase63c-step3-event";

  const session =
    await beginWorldSimulationSession(
      {
        simulation_label:
          "Phase63C Step3 actual retrieval kernel fixture",
        seed:
          "phase63c-step3",
        rules: {
          event_driven: true,
          persistent_causality: true,
        },
        initial_world_state: {
          simulation_time:
            "2026-08-25T01:20:00+08:00",
          event_queue: [
            {
              event_id: eventId,
              type: "phase63c_step3_retrieval",
              scene_id: sceneId,
              participants: [character],
              memory_retrieval_context: {
                retrieval_goal: {
                  value: "remember recent collision",
                },
              },
            },
          ],
          scenes: {
            [sceneId]: {
              scene_id: sceneId,
              dimensions: {
                width_m: 8,
                depth_m: 8,
              },
              entity_positions: {
                [character]: {
                  x: 2,
                  y: 2,
                },
              },
              obstacles: [],
              structures: [],
              doors: [],
            },
          },
          characters: {
            [character]: {
              known: ["自己正在測試場景中"],
              current_goal: "回想剛才發生的事",
              current_action: "思考",
            },
          },
          memories: {
            [character]: [
              {
                memory_id: "phase63c-step3-source-memory",
                memory_type: "episodic_direct_perception",
                content: {
                  action: recoveredAction,
                  hidden_detail: unretrievedSecret,
                },
                source: {
                  kind: "direct_perception",
                  sense: "visual",
                },
                perceptual_certainty_at_encoding: "medium",
                perceptual_clarity_at_encoding: "partial",
                possibly_incorrect: true,
                source_confused: true,
                accessible: true,
                suppressed: false,
              },
            ],
          },
          objects: {},
          available_actions: {
            [character]: [
              {
                action_id: "remain-still",
                intent: "留在原地",
              },
            ],
          },
        },
      },
      {
        fixtureRoot,
      },
    );

  const resolverInputs = [];
  const memoryRetrievalResolver =
    async (input) => {
      resolverInputs.push(structuredClone(input));
      assert.equal(
        JSON.stringify(input).includes(unretrievedSecret),
        true,
        "engine-side resolver must receive the frozen subjective candidate content",
      );
      return {
        process_occurred: true,
        initiation: {
          mode: "deliberate",
          trigger_origin: "self_generated",
        },
        retrieval_task: {
          mode: "cued_recall",
        },
        target: {
          kind: "memory_content",
          memory_id: "phase63c-step3-source-memory",
          requested_selectors: [
            {
              kind: "json_pointer",
              path: "/action",
            },
          ],
        },
        contacted_candidate_refs: [
          "phase63c-step3-source-memory",
        ],
        recovered_selections: [
          {
            source_memory_ref:
              "phase63c-step3-source-memory",
            selector: {
              kind: "json_pointer",
              path: "/action",
            },
            content_kind: "detail",
            target_relation: "target_related",
          },
        ],
      };
    };

  const prepared =
    await prepareWorldSimulationTurn(
      {
        world_simulation_session_id:
          session.world_simulation_session_id,
        event_id: eventId,
      },
      {
        fixtureRoot,
        memoryRetrievalResolver,
      },
    );

  assert.equal(prepared.memory_retrieval_processes.length, 1);
  assert.equal(
    prepared.memory_retrieval_processes[0]
      .result.target_outcome,
    "satisfied",
  );
  assert.equal(
    JSON.stringify(prepared.memory_accessibility_queries)
      .includes(unretrievedSecret),
    true,
  );
  assert.equal(
    JSON.stringify(prepared.decision_packets)
      .includes(unretrievedSecret),
    false,
  );
  assert.equal(
    JSON.stringify(prepared.decision_packets)
      .includes(recoveredAction),
    true,
  );
  assert.deepEqual(
    prepared.decision_packets[0]
      .retrieval_experience,
    {
      process_occurred: true,
      initiation_mode: "deliberate",
      target_outcome: "satisfied",
      recovered_any_content: true,
    },
  );

  const brainInputs = [];
  const turn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          session.world_simulation_session_id,
        event_id: eventId,
      },
      {
        fixtureRoot,
        memoryRetrievalResolver,
        characterBrain:
          async (packet) => {
            brainInputs.push(structuredClone(packet));
            const serializedPacket = JSON.stringify(packet);
            assert.equal(
              serializedPacket.includes(unretrievedSecret),
              false,
            );
            assert.equal(
              serializedPacket.includes(recoveredAction),
              true,
            );
            assert.equal(
              serializedPacket.split(recoveredAction).length - 1,
              1,
              "one recollection must have one semantic exposure at final Character Brain ingress",
            );
            assert.equal(
              packet.retrieval_experience.target_outcome,
              "satisfied",
            );
            assert.equal(
              Object.hasOwn(packet, "recovered_memories"),
              false,
              "v3 final Brain ingress must not bypass Current Mind with raw recovered_memories",
            );
            assert.equal(
              Object.hasOwn(packet, "retrieved_memories"),
              false,
              "legacy alias must not bypass v3 single semantic exposure",
            );
            assert.equal(
              Object.hasOwn(packet, "projected_memories"),
              false,
            );
            assert.equal(
              Object.hasOwn(packet.cognition, "recovered_memories"),
              false,
              "cognition must not duplicate recollection content outside working_context",
            );
            assert.equal(
              Object.hasOwn(packet.cognition, "retrieval_experience"),
              false,
              "retrieval_experience must have one final character-facing process-state exposure",
            );
            assert.equal(
              JSON.stringify(packet.cognition.attention).includes(recoveredAction),
              false,
              "attention compatibility view must not duplicate recovered-memory semantics",
            );
            const workingContextItems = [
              packet.cognition.working_context?.focus,
              ...(packet.cognition.working_context?.active_context ?? []),
              ...(packet.cognition.working_context?.peripheral_context ?? []),
              ...(packet.cognition.working_context?.fading_context ?? []),
              ...(packet.cognition.working_context?.suspended_context ?? []),
            ].filter(Boolean);
            const recollection = workingContextItems.find(
              (item) => item.context_origin === "recovered_memory"
                && item.content === recoveredAction,
            );
            assert.ok(
              recollection,
              "actual Phase63C recovered content must be reinstated through Current Mind working_context",
            );
            assert.equal(recollection.content_kind, "detail");
            assert.equal(recollection.target_relation, "target_related");
            assert.equal(recollection.memory_type, "episodic_direct_perception");
            assert.equal(recollection.perceptual_certainty_at_encoding, "medium");
            assert.equal(recollection.perceptual_clarity_at_encoding, "partial");
            assert.equal(recollection.possibly_incorrect, true);
            assert.equal(recollection.source_confused, true);
            assert.deepEqual(recollection.source, {
              kind: "direct_perception",
              actor: null,
              sense: "visual",
            });
            for (const forbidden of [
              "phase63c-step3-source-memory",
              "memory_retrieval_process_",
              "memory_retrieval_fragment_",
              "source_memory_ref",
              "candidate_set_hash",
              "recollection_occurrence_hash",
            ]) {
              assert.equal(
                serializedPacket.includes(forbidden),
                false,
                `Character Brain must not receive recollection engine provenance ${forbidden}`,
              );
            }
            assert.equal(
              packet.boundaries.recollection_reinstatement_v3_installed,
              true,
            );
            assert.equal(
              packet.boundaries.native_character_brain_memory_channel,
              "cognition.working_context",
            );
            return {
              action_id: "remain-still",
            };
          },
        causalAdjudicator:
          async (input) => ({
            causal_resolution_id:
              "phase63c-step3-noop",
            next_world_state:
              structuredClone(input.world_state),
            state_transitions: [],
            action_outcomes: [
              {
                actor: character,
                action_id: "remain-still",
                result: "remained_still",
                causal_evidence:
                  "fixture intentionally performs no hard-state movement",
              },
            ],
            knowledge_transitions: [],
            scheduled_events: [],
          }),
      },
    );

  assert.equal(turn.ok, true);
  assert.equal(turn.committed, true);
  assert.equal(brainInputs.length, 1);
  assert.equal(resolverInputs.length >= 2, true);
  nativeLoopVerified = true;
} finally {
  await rm(
    fixtureRoot,
    {
      recursive: true,
      force: true,
    },
  );
}

const report = {
  ok: true,
  phase: "Phase63C Step 3",
  retrieval_process_version:
    worldSimulationMemoryRetrievalProcessVersion,
  kernel: "single_step_evidence_grounded",
  deliberate_retrieval_supported: true,
  spontaneous_retrieval_supported: true,
  failed_retrieval_supported: true,
  partial_grounded_fragments_supported: true,
  non_target_recovery_supported: true,
  candidate_content_barrier_preserved: true,
  native_loop_verified: nativeLoopVerified,
  retrieval_event_persistence_installed: false,
  multi_step_search_installed: false,
};

console.log(JSON.stringify(report, null, 2));
