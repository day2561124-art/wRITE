import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  memoryPlasticityEventSchemaVersion,
  memoryPlasticityHistoryReferenceSchemaVersion,
  worldSimulationMemoryPlasticityVersion,
} from "../../server/src/world-simulation-memory-plasticity-service.mjs";
import {
  buildWorldSimulationRetrievalPracticeActivationProjectionContract,
  projectWorldSimulationRetrievalPracticeActivation,
  retrievalPracticeActivationProjectionModelProfileHash,
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "../../server/src/world-simulation-retrieval-practice-activation-projection-service.mjs";

const character = "phase64a-r2-observer";
const asOf = "2026-08-28T01:30:00+08:00";
const currentTurnId = "turn_phase64a_r2_current";

function practiceEvent({
  id,
  memoryId,
  occurredAt,
  turnId,
  targetRelation = "target",
  recoveryExtent = "whole_content",
  eventCharacter = character,
}) {
  const plasticityEventId =
    `memory_plasticity_event_${id}`;
  const plasticityEffectId =
    `memory_plasticity_effect_${id}`;

  const body = {
    schema_version:
      memoryPlasticityEventSchemaVersion,
    plasticity_event_id:
      plasticityEventId,
    source_retrieval_event_id:
      `retrieval_event_${id}`,
    source_retrieval_event_hash:
      `retrieval_hash_${id}`,
    character:
      eventCharacter,
    source_turn_id:
      turnId,
    occurred_at:
      occurredAt,
    model_mode:
      "retrieval_practice_event_registration_v1",
    model_profile_schema_version:
      "phase64a-retrieval-practice-model-profile-v1",
    model_profile_hash:
      `fixture_profile_${id}`,
    effects: [
      {
        plasticity_effect_id:
          plasticityEffectId,
        source_memory_ref:
          memoryId,
        memory_recovery_id:
          `memory_recovery_${id}`,
        target_relation:
          targetRelation,
        recovery_extent:
          recoveryExtent,
        recovered_fragment_ids: [
          `fragment_${id}`,
        ],
        recovery_occurrence_ids: [
          `occurrence_${id}`,
        ],
        retrieval_practice_registered:
          true,
        source_memory_reactivation_occurred:
          true,
        whole_content_recovered:
          recoveryExtent === "whole_content",
        partial_content_recovered:
          recoveryExtent === "partial_content",
        recovery_occurrence_count_used_as_practice_count:
          false,
        quantitative_strength_delta:
          null,
      },
    ],
    outcome_summary: {
      retrieval_practice_effect_count: 1,
      processed_with_zero_effects: false,
    },
    engine_audit: {
      source_retrieval_event_hash_verified: true,
      same_source_turn_feedback_allowed: false,
      future_accessibility_projection_applied: false,
      retrieval_strength_delta_modeled: false,
      memory_content_rewritten: false,
    },
    immutable: true,
  };

  const event = {
    ...body,
    plasticity_event_hash:
      hashAgentRunValue(body),
  };

  const reference = {
    schema_version:
      memoryPlasticityHistoryReferenceSchemaVersion,
    plasticity_event_id:
      plasticityEventId,
    plasticity_event_hash:
      event.plasticity_event_hash,
    plasticity_effect_id:
      plasticityEffectId,
    source_retrieval_event_id:
      event.source_retrieval_event_id,
    source_retrieval_event_hash:
      event.source_retrieval_event_hash,
    character:
      eventCharacter,
    source_memory_ref:
      memoryId,
    role:
      "retrieval_practice_registered",
    derived_index:
      true,
  };

  return {
    event,
    reference,
  };
}

function memoryRecord(
  memoryId,
  cueValues,
) {
  return {
    memory_id:
      memoryId,
    memory_type:
      "episodic_direct_perception",
    content: {
      label:
        `content:${memoryId}`,
    },
    retrieval_cue_links:
      cueValues.map(
        (value) => ({
          kind: "semantic",
          value,
          source: "phase64a_r2_fixture",
        }),
      ),
    retrieval_eligible: true,
    suppressed: false,
  };
}

const memories = [
  memoryRecord(
    "memory_seed",
    ["seed", "bridge"],
  ),
  memoryRecord(
    "memory_unpracticed",
    ["bridge"],
  ),
  memoryRecord(
    "memory_frequency",
    ["bridge"],
  ),
  memoryRecord(
    "memory_single",
    ["bridge"],
  ),
  memoryRecord(
    "memory_recent",
    ["bridge"],
  ),
];

const fixtures = [
  practiceEvent({
    id: "frequency_1h",
    memoryId: "memory_frequency",
    occurredAt: "2026-08-28T00:30:00+08:00",
    turnId: "turn_frequency_1h",
  }),
  practiceEvent({
    id: "frequency_4h",
    memoryId: "memory_frequency",
    occurredAt: "2026-08-27T21:30:00+08:00",
    turnId: "turn_frequency_4h",
  }),
  practiceEvent({
    id: "single_30m",
    memoryId: "memory_single",
    occurredAt: "2026-08-28T01:00:00+08:00",
    turnId: "turn_single_30m",
    targetRelation: "non_target",
    recoveryExtent: "partial_content",
  }),
  practiceEvent({
    id: "recent_1m",
    memoryId: "memory_recent",
    occurredAt: "2026-08-28T01:29:00+08:00",
    turnId: "turn_recent_1m",
  }),
  practiceEvent({
    id: "same_turn_seed",
    memoryId: "memory_seed",
    occurredAt: asOf,
    turnId: currentTurnId,
  }),
  practiceEvent({
    id: "other_character",
    memoryId: "memory_recent",
    occurredAt: "2026-08-28T01:29:30+08:00",
    turnId: "turn_other_character",
    eventCharacter: "someone-else",
  }),
];

const worldState = {
  simulation_time:
    asOf,
  memory_plasticity_events:
    Object.fromEntries(
      fixtures.map(
        ({ event }) => [
          event.plasticity_event_id,
          event,
        ],
      ),
    ),
  memory_plasticity_history:
    fixtures.map(
      ({ reference }) =>
        reference,
    ),
};

const contract =
  buildWorldSimulationRetrievalPracticeActivationProjectionContract();

assert.equal(
  contract.version,
  "phase64a-retrieval-practice-activation-projection-v1",
);
assert.equal(
  contract.version,
  worldSimulationRetrievalPracticeActivationProjectionVersion,
);
assert.equal(
  contract.source_memory_plasticity_version,
  worldSimulationMemoryPlasticityVersion,
);
assert.equal(
  contract.model_profile_hash,
  retrievalPracticeActivationProjectionModelProfileHash,
);
assert.equal(
  contract.future_accessibility_projection_installed,
  true,
);
assert.equal(
  contract.projection_occurs_before_phase63b_candidate_freeze,
  true,
);
assert.equal(
  contract.phase63b_candidate_membership_authority_preserved,
  true,
);
assert.equal(
  contract.phase63c_dynamic_frontier_reuses_projected_snapshot_order,
  true,
);
assert.equal(
  contract.persistent_world_memory_order_mutated,
  false,
);
assert.equal(
  contract.source_memory_content_mutated,
  false,
);
assert.equal(
  contract.same_source_turn_feedback_allowed,
  false,
);
assert.equal(
  contract.non_target_recovery_is_real_practice,
  true,
);
assert.equal(
  contract.partial_recovery_receives_fractional_weight,
  false,
);
assert.equal(
  contract.activation_score_is_literal_human_retrieval_probability,
  false,
);

const worldStateSnapshot =
  structuredClone(worldState);
const memorySnapshot =
  structuredClone(memories);

const projection =
  projectWorldSimulationRetrievalPracticeActivation({
    world_state:
      worldState,
    character,
    current_turn_id:
      currentTurnId,
    as_of:
      asOf,
    memory_records:
      memories,
  });

assert.deepEqual(
  worldState,
  worldStateSnapshot,
  "R2 must remain a pure read-only projection over R1 history",
);
assert.deepEqual(
  memories,
  memorySnapshot,
  "R2 must not reorder or rewrite the authoritative memory array in place",
);
assert.deepEqual(
  projection.projected_memory_ids,
  [
    "memory_recent",
    "memory_frequency",
    "memory_single",
    "memory_seed",
    "memory_unpracticed",
  ],
  "recency+frequency activation should reorder only the ephemeral retrieval snapshot",
);
assert.deepEqual(
  new Set(projection.projected_memory_ids),
  new Set(memories.map((memory) => memory.memory_id)),
  "projection must preserve memory membership exactly",
);
assert.equal(
  projection.audit.memory_membership_preserved,
  true,
);
assert.equal(
  projection.audit.source_world_state_mutated,
  false,
);
assert.equal(
  projection.audit.candidate_pool_expanded,
  false,
);
assert.equal(
  projection.audit.same_source_turn_reference_count_excluded,
  1,
);
assert.equal(
  projection.audit.other_character_reference_count,
  1,
);
assert.equal(
  projection.audit.qualifying_prior_practice_reference_count,
  4,
);

const evidenceById =
  new Map(
    projection.activation_evidence
      .map(
        (entry) => [
          entry.memory_id,
          entry,
        ]),
  );

assert.equal(
  evidenceById.get("memory_frequency")
    .qualifying_prior_practice_count,
  2,
);
assert.equal(
  evidenceById.get("memory_single")
    .qualifying_prior_practice_count,
  1,
);
assert.equal(
  evidenceById.get("memory_single")
    .practice_traces[0]
    .target_relation,
  "non_target",
  "actually recovered non-target content remains real retrieval practice",
);
assert.equal(
  evidenceById.get("memory_single")
    .practice_traces[0]
    .recovery_extent,
  "partial_content",
);
assert.equal(
  evidenceById.get("memory_seed")
    .qualifying_prior_practice_count,
  0,
  "same-source-turn practice must not feed the current retrieval attempt",
);
assert.equal(
  evidenceById.get("memory_seed")
    .same_source_turn_reference_count_excluded,
  1,
);
assert.equal(
  evidenceById.get("memory_recent")
    .scalar_activation_is_literal_human_probability,
  false,
);
assert.equal(
  Number.isFinite(
    evidenceById.get("memory_recent")
      .activation_score,
  ),
  true,
);
assert.equal(
  evidenceById.get("memory_frequency")
    .activation_score
    > evidenceById.get("memory_single")
      .activation_score,
  true,
  "two older practices should be able to outweigh one moderately recent practice under the explicit activation equation",
);

for (const projectedRecord of projection.projected_memory_records) {
  const original = memories.find(
    (record) =>
      record.memory_id
      === projectedRecord.memory_id,
  );
  assert.deepEqual(
    projectedRecord,
    original,
    "projection may change search order but not stored subjective-memory content or metadata",
  );
}

const corruptWorldState =
  structuredClone(worldState);
const corruptEventId =
  fixtures[0].event.plasticity_event_id;
corruptWorldState.memory_plasticity_events[
  corruptEventId
].effects[0].target_relation =
  "tampered";

assert.throws(
  () =>
    projectWorldSimulationRetrievalPracticeActivation({
      world_state:
        corruptWorldState,
      character,
      current_turn_id:
        currentTurnId,
      as_of:
        asOf,
      memory_records:
        memories,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_EVENT_HASH_MISMATCH",
  "R2 must fail closed if immutable R1 evidence is tampered with",
);

const missingReferenceHashState =
  structuredClone(worldState);
delete missingReferenceHashState
  .memory_plasticity_history[0]
  .plasticity_event_hash;

assert.throws(
  () =>
    projectWorldSimulationRetrievalPracticeActivation({
      world_state:
        missingReferenceHashState,
      character,
      current_turn_id:
        currentTurnId,
      as_of:
        asOf,
      memory_records:
        memories,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_HISTORY_REFERENCE_INVALID",
  "R2 must require the canonical R1 history reference hash rather than resolving by event id alone",
);

const futureFixture =
  practiceEvent({
    id: "future",
    memoryId: "memory_recent",
    occurredAt: "2026-08-28T01:31:00+08:00",
    turnId: "turn_future",
  });
const futureWorldState =
  structuredClone(worldState);
futureWorldState.memory_plasticity_events[
  futureFixture.event.plasticity_event_id
] = futureFixture.event;
futureWorldState.memory_plasticity_history.push(
  futureFixture.reference,
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalPracticeActivation({
      world_state:
        futureWorldState,
      character,
      current_turn_id:
        currentTurnId,
      as_of:
        asOf,
      memory_records:
        memories,
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_FUTURE_EVENT",
  "future-dated R1 evidence must not retrocausally affect activation",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalPracticeActivation({
      world_state:
        worldState,
      character,
      current_turn_id:
        currentTurnId,
      as_of:
        asOf,
      memory_records: [
        memories[0],
        structuredClone(memories[0]),
      ],
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_PRACTICE_ACTIVATION_MEMORY_DUPLICATE",
);

// Runtime composition proof:
// the projected snapshot becomes Phase63B's input, and Phase63C keeps using
// that same frozen snapshot during internally reinstated-cue re-evaluation.
const retrievalMemoryRecords =
  projection.projected_memory_records;

const accessibilityBaseInput = {
  world_state:
    worldState,
  character,
  memory_records:
    retrievalMemoryRecords,
  memory_retrieval_profile: {
    enabled: true,
    model_mode: "cue_dependent_v2",
  },
  simulation_time:
    asOf,
  scene_id:
    null,
  perception: {},
  context_cues: {},
  retrieval_context: {
    active_cues: [
      {
        kind: "semantic",
        value: "seed",
        source: "phase64a_r2_initial_cue",
      },
    ],
  },
};

const initialAccessibility =
  queryWorldSimulationMemoryAccessibility(
    accessibilityBaseInput,
  );

assert.deepEqual(
  initialAccessibility.result
    .candidate_memory_records
    .map((record) => record.memory_id),
  ["memory_seed"],
  "Phase63B remains the candidate-membership authority",
);

const query =
  buildWorldSimulationMemoryRetrievalQueryV3({
    character,
    turn_id:
      currentTurnId,
    phase63b_version:
      initialAccessibility
        .memory_accessibility_version,
    memory_records:
      retrievalMemoryRecords,
    accessibility_base_input:
      accessibilityBaseInput,
    initial_accessibility_query:
      initialAccessibility,
    retrieval_goal:
      null,
  });

let bridgeCueOptionId = null;
let secondFrontierOrder = null;

const retrievalResult =
  await executeWorldSimulationMemoryRetrievalProcessV3({
    query,
    memory_records:
      retrievalMemoryRecords,
    accessibility_base_input:
      accessibilityBaseInput,
    initial_accessibility_query:
      initialAccessibility,
    technical_step_budget: 3,
    perception: {},
    character_state: {},
    resolver:
      async (input) => {
        if (input.stage === "initiation") {
          return {
            process_occurred: true,
            initiation: {
              mode: "spontaneous",
              trigger_origin: "environmental_cue",
            },
            retrieval_task: {
              mode: "associative_recall",
            },
            target: null,
          };
        }

        if (
          input.stage === "recovery"
          && input.process.step_index === 0
        ) {
          assert.deepEqual(
            input.current_frontier
              .candidate_memory_records
              .map((record) => record.memory_id),
            ["memory_seed"],
          );

          return {
            contacted_candidate_refs: [
              "memory_seed",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "memory_seed",
                selector: {
                  kind: "json_pointer",
                  path: "/label",
                },
                content_kind: "detail",
              },
            ],
          };
        }

        if (
          input.stage === "continuation"
          && input.process.step_index === 0
        ) {
          const bridge =
            input.available_reinstatement_cues
              .find(
                (option) =>
                  option.cue.kind
                    === "semantic"
                  && option.cue.value
                    === "bridge",
              );

          assert.ok(bridge);
          bridgeCueOptionId =
            bridge.cue_option_id;

          return {
            control_action: "continue",
            control_reason:
              "recovered bridge cue",
            selected_reinstatement_cue_refs: [
              bridge.cue_option_id,
            ],
          };
        }

        if (
          input.stage === "recovery"
          && input.process.step_index === 1
        ) {
          secondFrontierOrder =
            input.current_frontier
              .candidate_memory_records
              .map((record) => record.memory_id);

          assert.deepEqual(
            secondFrontierOrder,
            [
              "memory_recent",
              "memory_frequency",
              "memory_single",
              "memory_seed",
              "memory_unpracticed",
            ],
            "Phase63C dynamic frontier must retain the R2 projected snapshot order after cue reinstatement",
          );

          return {
            contacted_candidate_refs: [
              "memory_recent",
            ],
            recovered_selections: [
              {
                source_memory_ref:
                  "memory_recent",
                selector: {
                  kind: "json_pointer",
                  path: "/label",
                },
                content_kind: "detail",
              },
            ],
          };
        }

        if (
          input.stage === "continuation"
          && input.process.step_index === 1
        ) {
          return {
            control_action: "stop",
            control_reason:
              "fixture complete",
            selected_reinstatement_cue_refs: [],
          };
        }

        throw new Error(
          `Unexpected resolver stage ${input.stage} / ${input.process?.step_index}`,
        );
      },
  });

assert.equal(
  retrievalResult.process_occurred,
  true,
);
assert.equal(
  retrievalResult.retrieval_process.steps.length,
  2,
);
assert.equal(
  retrievalResult.retrieval_process.steps[0]
    .selected_reinstatement_cue_refs[0],
  bridgeCueOptionId,
);
assert.ok(secondFrontierOrder);

// Production adoption guard: R2 must not remain a standalone utility.
const loopSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-loop-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

for (
  const requiredSnippet
  of [
    "buildWorldSimulationRetrievalPracticeActivationProjectionContract",
    "projectWorldSimulationRetrievalPracticeActivation",
    "retrieval_practice_activation_projection:",
    "const retrievalPracticeActivationProjection =",
    "const retrievalMemoryRecords =",
    "memory_records:\n        cloneJson(\n          retrievalMemoryRecords,",
    "memory_records:\n            retrievalMemoryRecords,",
  ]
) {
  assert.equal(
    loopSource.replace(/\r\n?/g, "\n").includes(requiredSnippet),
    true,
    `world loop is missing Phase64A-R2 production wiring: ${requiredSnippet}`,
  );
}

const report = {
  ok: true,
  phase:
    "Phase64A-R2 Retrieval-Practice Activation Projection",
  version:
    worldSimulationRetrievalPracticeActivationProjectionVersion,
  r1_history_consumed_read_only: true,
  recency_frequency_activation_projected: true,
  non_target_retrieval_practice_projected: true,
  partial_recovery_not_fractionally_invented: true,
  same_source_turn_feedback_blocked: true,
  immutable_event_hash_verified: true,
  future_event_retrocausality_blocked: true,
  memory_membership_preserved: true,
  persistent_memory_order_preserved: true,
  phase63b_candidate_membership_authority_preserved: true,
  phase63c_dynamic_frontier_projection_preserved: true,
  native_world_loop_adoption_guarded: true,
  retrieval_probability_invented: false,
};

console.log(
  JSON.stringify(
    report,
    null,
    2,
  ),
);
