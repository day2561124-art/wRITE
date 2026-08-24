import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationMemoryRetrievalProcessVersion =
  "phase63c-memory-retrieval-process-v1";

export const memoryRetrievalInitiationModes =
  Object.freeze([
    "deliberate",
    "spontaneous",
  ]);

export const memoryRetrievalTriggerOrigins =
  Object.freeze([
    "self_generated",
    "external_prompt",
    "environmental_cue",
    "internally_reinstated_cue",
    "unspecified",
  ]);

export const memoryRetrievalTaskModes =
  Object.freeze([
    "free_recall",
    "cued_recall",
    "recognition",
    "source_query",
    "associative_recall",
    "unspecified",
  ]);

export const memoryRetrievalTargetRelations =
  Object.freeze([
    "target_related",
    "non_target",
    "unresolved",
  ]);

export const memoryRetrievalContentKinds =
  Object.freeze([
    "gist",
    "detail",
    "sensory_fragment",
    "relational_fragment",
    "identity_fragment",
    "semantic_fragment",
    "unspecified",
  ]);

export const memoryRetrievalTargetOutcomes =
  Object.freeze([
    "satisfied",
    "partially_satisfied",
    "failed",
    "not_applicable",
  ]);

export const memoryRetrievalHistoryRoles =
  Object.freeze([
    "recovered",
    "partially_recovered",
    "non_target_recovered",
  ]);

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function cloneJson(value) {
  return JSON.parse(
    JSON.stringify(
      value ?? null,
    ),
  );
}

function deepFreeze(value) {
  if (
    !value
    || typeof value !== "object"
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return value;
}

function nonEmptyString(
  value,
  label,
) {
  if (
    typeof value !== "string"
    || !value.trim()
  ) {
    const error = new Error(
      `${label} is required.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_QUERY_INVALID";

    throw error;
  }

  return value.trim();
}

const schemas = deepFreeze({
  memory_retrieval_query: {
    type: "object",

    required: [
      "query_id",
      "character",
      "turn_id",
      "phase63b_version",
      "candidate_set_hash",
      "candidate_count",
      "candidate_refs",
    ],

    properties: {
      query_id: {
        type: "string",
      },

      character: {
        type: "string",
      },

      turn_id: {
        type: "string",
      },

      phase63b_version: {
        type: "string",
      },

      candidate_set_hash: {
        type: "string",
      },

      candidate_count: {
        type: "integer",
        minimum: 0,
      },

      initial_cues: {
        type: "array",
      },

      retrieval_goal: {
        type: [
          "object",
          "string",
          "null",
        ],
      },

      candidate_refs: {
        type: "array",

        items: {
          type: "object",

          required: [
            "memory_id",
            "candidate_index",
          ],

          properties: {
            memory_id: {
              type: "string",
            },

            candidate_index: {
              type: "integer",
              minimum: 0,
            },
          },
        },
      },
    },
  },

  retrieval_process: {
    type: "object",

    required: [
      "retrieval_process_id",
      "query_id",
      "character",
      "turn_id",
      "initiation",
      "retrieval_task",
      "frozen_candidate_set",
      "steps",
    ],

    properties: {
      retrieval_process_id: {
        type: "string",
      },

      query_id: {
        type: "string",
      },

      character: {
        type: "string",
      },

      turn_id: {
        type: "string",
      },

      initiation: {
        type: "object",

        required: [
          "mode",
        ],

        properties: {
          mode: {
            type: "string",
            enum:
              memoryRetrievalInitiationModes,
          },

          trigger_origin: {
            type: "string",
            enum:
              memoryRetrievalTriggerOrigins,
          },
        },
      },

      retrieval_task: {
        type: "object",

        required: [
          "mode",
        ],

        properties: {
          mode: {
            type: "string",
            enum:
              memoryRetrievalTaskModes,
          },
        },
      },

      target: {
        type: [
          "object",
          "string",
          "null",
        ],
      },

      initial_cues: {
        type: "array",
      },

      frozen_candidate_set: {
        type: "object",

        required: [
          "phase63b_version",
          "candidate_set_hash",
          "candidate_count",
        ],
      },

      steps: {
        type: "array",
      },

      termination: {
        type: [
          "object",
          "null",
        ],
      },
    },
  },

  retrieval_step: {
    type: "object",

    required: [
      "step_index",
      "active_cues",
      "contacted_candidate_refs",
      "recovered_fragments",
      "reinstated_cues",
      "target_relation",
      "termination_after_step",
    ],

    properties: {
      step_index: {
        type: "integer",
        minimum: 0,
      },

      active_cues: {
        type: "array",
      },

      contacted_candidate_refs: {
        type: "array",
      },

      recovered_fragments: {
        type: "array",
      },

      reinstated_cues: {
        type: "array",
      },

      target_relation: {
        type: "string",
        enum:
          memoryRetrievalTargetRelations,
      },

      termination_after_step: {
        type: "boolean",
      },
    },
  },

  recovered_fragment: {
    type: "object",

    required: [
      "fragment_id",
      "content",
      "content_kind",
      "target_relation",
    ],

    properties: {
      fragment_id: {
        type: "string",
      },

      source_memory_ref: {
        type: [
          "string",
          "null",
        ],
      },

      content: {},

      content_kind: {
        type: "string",
        enum:
          memoryRetrievalContentKinds,
      },

      target_relation: {
        type: "string",
        enum:
          memoryRetrievalTargetRelations,
      },
    },
  },

  retrieval_event: {
    type: "object",

    required: [
      "retrieval_event_id",
      "retrieval_process_id",
      "character",
      "turn_id",
      "initiation",
      "retrieval_task",
      "search_steps",
      "recovered_memory_refs",
      "recovered_content",
      "target_outcome",
      "recovered_any_content",
      "termination",
      "engine_audit",
      "immutable",
    ],

    properties: {
      retrieval_event_id: {
        type: "string",
      },

      retrieval_process_id: {
        type: "string",
      },

      character: {
        type: "string",
      },

      turn_id: {
        type: "string",
      },

      occurred_at: {
        type: [
          "string",
          "number",
          "null",
        ],
      },

      initiation: {
        type: "object",
      },

      retrieval_task: {
        type: "object",
      },

      target: {
        type: [
          "object",
          "string",
          "null",
        ],
      },

      initial_cues: {
        type: "array",
      },

      search_steps: {
        type: "array",
      },

      recovered_memory_refs: {
        type: "array",
      },

      recovered_content: {
        type: "array",
      },

      target_outcome: {
        type: "string",
        enum:
          memoryRetrievalTargetOutcomes,
      },

      recovered_any_content: {
        type: "boolean",
      },

      termination: {
        type: "object",
      },

      engine_audit: {
        type: "object",
      },

      immutable: {
        const: true,
      },
    },
  },

  retrieval_history_reference: {
    type: "object",

    required: [
      "retrieval_event_id",
      "role",
    ],

    properties: {
      retrieval_event_id: {
        type: "string",
      },

      role: {
        type: "string",
        enum:
          memoryRetrievalHistoryRoles,
      },
    },
  },
});

function candidateReference(
  record,
  candidateIndex,
) {
  if (!isObject(record)) {
    const error = new Error(
      `candidate_memory_records[${candidateIndex}] must be an object.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_INVALID";

    throw error;
  }

  const memoryId =
    String(
      record.memory_id
      ?? record.id
      ?? "",
    ).trim();

  if (!memoryId) {
    const error = new Error(
      `candidate_memory_records[${candidateIndex}].memory_id is required.`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_ID_REQUIRED";

    throw error;
  }

  return {
    memory_id:
      memoryId,

    candidate_index:
      candidateIndex,
  };
}

export function buildWorldSimulationMemoryRetrievalSchemas() {
  return cloneJson(
    schemas,
  );
}

export function buildWorldSimulationMemoryRetrievalProcessContract() {
  return {
    version:
      worldSimulationMemoryRetrievalProcessVersion,

    phase:
      "Phase63C",

    status:
      "schema_contract_and_candidate_content_barrier_installed_retrieval_kernel_not_activated",

    retrieval_process_schema_installed:
      true,

    retrieval_event_schema_installed:
      true,

    retrieval_process_execution_installed:
      false,

    retrieval_event_persistence_installed:
      false,

    candidate_content_barrier_enforced:
      true,

    candidate_content_barrier_owner:
      "Phase63C Step2",

    native_recovered_memory_channel_installed:
      true,

    native_recovered_memory_channel:
      "recovered_memories",

    native_recovered_memories_without_retrieval_kernel:
      "empty",

    legacy_projector_api_preserved:
      true,

    legacy_projector_native_character_brain_path_active:
      false,

    retrieval_event_store_authority:
      "world_state.retrieval_events",

    retrieval_event_immutability_required:
      true,

    retrieval_event_immutability_enforced:
      false,

    retrieval_history_append_only_required:
      true,

    retrieval_history_append_only_enforced:
      false,

    retrieval_history_authority:
      "retrieval_event_reference",

    recall_summary_is_authoritative:
      false,

    recall_count_is_rebuildable_summary:
      true,

    last_recalled_at_is_rebuildable_summary:
      true,

    same_cycle_phase63b_feedback_allowed:
      false,

    multi_step_retrieval_schema_supported:
      true,

    internally_reinstated_cues_schema_supported:
      true,

    spontaneous_retrieval_schema_supported:
      true,

    deliberate_retrieval_schema_supported:
      true,

    failed_retrieval_event_supported:
      true,

    non_target_recovery_schema_supported:
      true,

    partial_outcome_uses_arbitrary_percentage:
      false,

    universal_retrieval_probability_modeled:
      false,

    universal_success_threshold_modeled:
      false,

    retrieval_reinforcement_modeled:
      false,

    retrieval_induced_forgetting_modeled:
      false,

    reconsolidation_modeled:
      false,

    source_confusion_modeled:
      false,

    confidence_rewrite_modeled:
      false,

    memory_content_rewrite_modeled:
      false,

    direct_world_state_mutation_allowed:
      false,

    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",

    schemas:
      buildWorldSimulationMemoryRetrievalSchemas(),
  };
}

export function buildWorldSimulationMemoryRetrievalQuery(
  input = {},
) {
  const character =
    nonEmptyString(
      input.character,
      "character",
    );

  const turnId =
    nonEmptyString(
      input.turn_id,
      "turn_id",
    );

  const phase63bVersion =
    nonEmptyString(
      input.phase63b_version,
      "phase63b_version",
    );

  const candidateRecords =
    array(
      input.candidate_memory_records,
    );

  const candidateSnapshot =
    cloneJson(
      candidateRecords,
    );

  const candidateRefs =
    candidateRecords.map(
      candidateReference,
    );

  const seenIds =
    new Set();

  for (
    const ref
    of candidateRefs
  ) {
    if (
      seenIds.has(
        ref.memory_id,
      )
    ) {
      const error = new Error(
        `Duplicate candidate memory_id: ${ref.memory_id}`,
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_DUPLICATE";

      throw error;
    }

    seenIds.add(
      ref.memory_id,
    );
  }

  const candidateSetHash =
    hashAgentRunValue(
      candidateSnapshot,
    );

  const initialCues =
    cloneJson(
      array(
        input.initial_cues,
      ),
    );

  const retrievalGoal =
    cloneJson(
      input.retrieval_goal
      ?? null,
    );

  const queryId =
    `memory_retrieval_query_${hashAgentRunValue({
      version:
        worldSimulationMemoryRetrievalProcessVersion,

      character,
      turn_id:
        turnId,

      phase63b_version:
        phase63bVersion,

      candidate_set_hash:
        candidateSetHash,

      initial_cues:
        initialCues,

      retrieval_goal:
        retrievalGoal,
    }).slice(0, 24)}`;

  return deepFreeze({
    query_id:
      queryId,

    character,

    turn_id:
      turnId,

    phase63b_version:
      phase63bVersion,

    candidate_set_hash:
      candidateSetHash,

    candidate_count:
      candidateRefs.length,

    initial_cues:
      initialCues,

    retrieval_goal:
      retrievalGoal,

    candidate_refs:
      candidateRefs,

    boundaries: {
      query_is_engine_side:
        true,

      query_embeds_candidate_content:
        false,

      query_forwarded_to_character_brain:
        false,

      query_embeds_candidate_accessibility_diagnostics:
        false,

      global_candidate_content_barrier_enforced:
        true,

      global_candidate_content_barrier_owner:
        "Phase63C Step2",

      candidate_set_frozen_for_process:
        true,

      query_mutates_persistent_memory:
        false,
    },
  });
}
