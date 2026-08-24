import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationMemoryRetrievalPersistenceVersion =
  "phase63c-retrieval-event-persistence-v1";

export const memoryRetrievalEventSchemaVersion =
  "phase63c-retrieval-event-v1";

export const memoryRetrievalHistoryReferenceSchemaVersion =
  "phase63c-retrieval-history-ref-v1";

export const memoryRetrievalLegacyBaselineSchemaVersion =
  "phase63c-retrieval-history-legacy-baseline-v1";

const successfulCanonicalRoles = new Set([
  "recovered",
  "partially_recovered",
  "non_target_recovered",
]);

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function object(value) {
  return isObject(value)
    ? value
    : {};
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

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function optionalString(value) {
  return typeof value === "string"
    && value.trim()
    ? value.trim()
    : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_PERSISTENCE_INVALID",
) {
  const text = optionalString(value);

  if (text) return text;

  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null)
    === JSON.stringify(right ?? null);
}

function memoryIdFor(record, label) {
  if (!isObject(record)) {
    const error = new Error(`${label} must be an object.`);
    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_PERSISTENCE_MEMORY_INVALID";
    throw error;
  }

  const memoryId =
    String(
      record.memory_id
      ?? record.id
      ?? "",
    ).trim();

  if (memoryId) return memoryId;

  const error = new Error(`${label}.memory_id is required.`);
  error.code =
    "WORLD_SIMULATION_MEMORY_RETRIEVAL_PERSISTENCE_MEMORY_ID_REQUIRED";
  throw error;
}

function characterMemoryRecords(worldState, character) {
  const memories = object(worldState?.memories);

  if (Object.hasOwn(memories, character)) {
    return array(memories[character]);
  }

  const normalized =
    String(character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");

  for (const [key, value] of Object.entries(memories)) {
    if (
      String(key)
        .trim()
        .toLocaleLowerCase("zh-Hant-TW")
      === normalized
    ) {
      return array(value);
    }
  }

  return [];
}

function characterMemoryKey(worldState, character) {
  const memories = object(worldState?.memories);

  if (Object.hasOwn(memories, character)) {
    return character;
  }

  const normalized =
    String(character ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");

  for (const key of Object.keys(memories)) {
    if (
      String(key)
        .trim()
        .toLocaleLowerCase("zh-Hant-TW")
      === normalized
    ) {
      return key;
    }
  }

  return character;
}

function timestampMs(value) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function laterTimestamp(left, right) {
  const leftMs = timestampMs(left);
  const rightMs = timestampMs(right);

  if (leftMs === null) return right ?? null;
  if (rightMs === null) return left ?? null;

  return rightMs > leftMs
    ? right
    : left;
}

function explicitSuccessfulLegacyEntry(entry) {
  if (!isObject(entry)) return false;

  if (
    entry.schema_version
    === memoryRetrievalHistoryReferenceSchemaVersion
  ) {
    return successfulCanonicalRoles.has(
      optionalString(entry.role),
    );
  }

  if (entry.success === true) return true;

  const outcome =
    optionalString(
      entry.outcome
      ?? entry.result
      ?? entry.status,
    )?.toLowerCase()
    ?? null;

  return [
    "success",
    "successful",
    "successful_recall",
    "successful_retrieval",
  ].includes(outcome);
}

function successfulLegacyEntryTimestamp(entry) {
  if (!explicitSuccessfulLegacyEntry(entry)) {
    return null;
  }

  return entry.occurred_at
    ?? entry.recalled_at
    ?? entry.retrieved_at
    ?? entry.timestamp
    ?? entry.at
    ?? null;
}

function canonicalReference(entry) {
  return isObject(entry)
    && entry.schema_version
      === memoryRetrievalHistoryReferenceSchemaVersion
    && Boolean(
      optionalString(entry.retrieval_event_id),
    );
}

function captureLegacyBaseline(
  record,
  firstEventId,
) {
  if (
    isObject(
      record
        ?.retrieval_history_legacy_baseline,
    )
  ) {
    return cloneJson(
      record.retrieval_history_legacy_baseline,
    );
  }

  const history =
    array(
      record?.retrieval_history,
    );

  const legacyHistory =
    history.filter(
      (entry) =>
        !canonicalReference(entry),
    );

  if (legacyHistory.length) {
    const successful =
      legacyHistory.filter(
        explicitSuccessfulLegacyEntry,
      );

    let lastSuccessful = null;

    for (const entry of successful) {
      lastSuccessful =
        laterTimestamp(
          lastSuccessful,
          successfulLegacyEntryTimestamp(entry),
        );
    }

    return {
      schema_version:
        memoryRetrievalLegacyBaselineSchemaVersion,
      source:
        "legacy_inline_history",
      successful_recall_count:
        successful.length,
      last_successful_recall_at:
        lastSuccessful,
      captured_before_retrieval_event_id:
        firstEventId,
      source_history_hash:
        hashAgentRunValue(
          cloneJson(legacyHistory),
        ),
      source_summary_hash:
        null,
      immutable:
        true,
    };
  }

  const recallCount =
    Number.isSafeInteger(
      Number(record?.recall_count),
    )
    && Number(record?.recall_count) >= 0
      ? Number(record.recall_count)
      : 0;

  const lastRecalledAt =
    record?.last_recalled_at
    ?? null;

  const hasLegacySummary =
    Object.hasOwn(
      object(record),
      "recall_count",
    )
    || Object.hasOwn(
      object(record),
      "last_recalled_at",
    );

  return {
    schema_version:
      memoryRetrievalLegacyBaselineSchemaVersion,
    source:
      hasLegacySummary
        ? "legacy_summary_fallback"
        : "none",
    successful_recall_count:
      recallCount,
    last_successful_recall_at:
      lastRecalledAt,
    captured_before_retrieval_event_id:
      firstEventId,
    source_history_hash:
      null,
    source_summary_hash:
      hasLegacySummary
        ? hashAgentRunValue({
          recall_count:
            record?.recall_count
            ?? null,
          last_recalled_at:
            record?.last_recalled_at
            ?? null,
        })
        : null,
    immutable:
      true,
  };
}

function normalizeProcessWrapper(raw, index) {
  const wrapper =
    isObject(raw)
      ? raw
      : {};

  const result =
    isObject(wrapper.result)
      ? wrapper.result
      : wrapper;

  const process =
    isObject(result.retrieval_process)
      ? result.retrieval_process
      : null;

  return {
    index,
    observer:
      optionalString(
        wrapper.observer
        ?? process?.character,
      ),
    version:
      optionalString(
        wrapper.version
        ?? result.version,
      ),
    result:
      result,
    process:
      process,
    process_occurred:
      result.process_occurred === true
      && Boolean(process),
  };
}

function groundedTarget(raw) {
  if (!isObject(raw)) {
    return {
      grounded: false,
      memory_id: null,
      kind: null,
    };
  }

  const kind =
    optionalString(raw.kind);

  if (
    ![
      "memory_ref",
      "memory_content",
    ].includes(kind)
  ) {
    return {
      grounded: false,
      memory_id: null,
      kind,
    };
  }

  const memoryId =
    optionalString(
      raw.memory_id,
    );

  return {
    grounded:
      Boolean(memoryId),
    memory_id:
      memoryId,
    kind,
  };
}

function selectorForFragment(fragment) {
  const selector =
    fragment
      ?.content_grounding
      ?.selector;

  if (!isObject(selector)) {
    return {
      kind:
        "whole_content",
    };
  }

  return cloneJson(selector);
}

function recoveryExtent(fragments) {
  return fragments.some(
    (fragment) =>
      selectorForFragment(fragment)
        .kind
      === "whole_content",
  )
    ? "whole_content"
    : "partial_content";
}

function buildSyntheticOccurrences(
  processResult,
  retrievalProcessId,
) {
  if (
    array(
      processResult.recovery_occurrences,
    ).length
  ) {
    return cloneJson(
      processResult.recovery_occurrences,
    );
  }

  return array(
    processResult.recovered_fragments,
  ).map(
    (fragment, index) => ({
      recovery_occurrence_id:
        `memory_retrieval_occurrence_persisted_${hashAgentRunValue({
          retrieval_process_id:
            retrievalProcessId,
          fragment_id:
            fragment?.fragment_id
            ?? null,
          occurrence_index:
            index,
          source:
            "single_step_fragment_occurrence",
        }).slice(0, 24)}`,
      fragment_id:
        fragment?.fragment_id
        ?? null,
      source_memory_ref:
        fragment?.source_memory_ref
        ?? null,
      occurrence_origin:
        "phase63c_step3_single_step_fragment",
    }),
  );
}

function canonicalSearchSteps(
  process,
  processResult,
  occurrences,
) {
  const optionById =
    new Map();

  const occurrenceIdsByFragment =
    new Map();

  for (const occurrence of occurrences) {
    const fragmentId =
      optionalString(
        occurrence?.fragment_id,
      );

    if (!fragmentId) continue;

    if (
      !occurrenceIdsByFragment
        .has(fragmentId)
    ) {
      occurrenceIdsByFragment.set(
        fragmentId,
        [],
      );
    }

    occurrenceIdsByFragment
      .get(fragmentId)
      .push(
        occurrence
          .recovery_occurrence_id,
      );
  }

  return array(process?.steps)
    .map((step, index) => {
      for (
        const option
        of array(
          step
            ?.new_reinstatement_cue_options,
        )
      ) {
        const optionId =
          optionalString(
            option?.cue_option_id,
          );

        if (optionId) {
          optionById.set(
            optionId,
            cloneJson(option),
          );
        }
      }

      const recoveredFragmentIds =
        array(
          step?.recovered_fragments,
        )
          .map(
            (fragment) =>
              optionalString(
                fragment?.fragment_id,
              ),
          )
          .filter(Boolean);

      const recoveryOccurrenceIds =
        [
          ...new Set(
            recoveredFragmentIds
              .flatMap(
                (fragmentId) =>
                  occurrenceIdsByFragment
                    .get(fragmentId)
                  ?? [],
              ),
          ),
        ];

      const selectedCues =
        array(
          step
            ?.selected_reinstatement_cue_refs,
        )
          .map(
            (optionId) =>
              optionById.get(
                String(optionId),
              ),
          )
          .filter(Boolean)
          .map(
            (option) => ({
              kind:
                option?.cue?.kind
                ?? null,
              value:
                cloneJson(
                  option?.cue?.value
                  ?? null,
                ),
              source:
                "phase63c_internal_reinstatement",
              grounding:
                cloneJson(
                  option?.grounding
                  ?? {},
                ),
            }),
          );

      const frontier =
        isObject(step?.frontier)
          ? {
            frontier_id:
              step.frontier.frontier_id
              ?? null,
            active_cue_hash:
              step.frontier.active_cue_hash
              ?? null,
            candidate_set_hash:
              step.frontier.candidate_set_hash
              ?? null,
            candidate_count:
              step.frontier.candidate_count
              ?? null,
          }
          : {
            frontier_id:
              null,
            active_cue_hash:
              hashAgentRunValue(
                cloneJson(
                  step?.active_cues
                  ?? [],
                ),
              ),
            candidate_set_hash:
              process
                ?.frozen_candidate_set
                ?.candidate_set_hash
              ?? null,
            candidate_count:
              process
                ?.frozen_candidate_set
                ?.candidate_count
              ?? null,
          };

      const controlAction =
        optionalString(
          step
            ?.continuation
            ?.control_action,
        )
        ?? (
          step
            ?.termination_after_step
          === true
            ? "stop"
            : "continue"
        );

      return {
        step_index:
          Number.isSafeInteger(
            Number(step?.step_index),
          )
            ? Number(step.step_index)
            : index,
        frontier_evidence:
          frontier,
        contacted_memory_refs:
          array(
            step
              ?.contacted_candidate_refs,
          )
            .map(
              (ref) =>
                optionalString(
                  typeof ref === "string"
                    ? ref
                    : ref?.memory_id,
                ),
            )
            .filter(Boolean),
        recovered_fragment_ids:
          recoveredFragmentIds,
        recovery_occurrence_ids:
          recoveryOccurrenceIds,
        selected_reinstated_cues:
          selectedCues,
        step_target_relation:
          step
            ?.step_target_relation
          ?? step?.target_relation
          ?? "unresolved",
        cumulative_target_outcome_after_step:
          step
            ?.cumulative_target_outcome_after_step
          ?? (
            index
            === array(process?.steps).length - 1
              ? processResult.target_outcome
              : null
          ),
        continuation: {
          control_action:
            controlAction,
        },
        termination_after_step:
          step
            ?.termination_after_step
          === true,
      };
    });
}

function buildMemoryRecoveries(
  eventSeed,
  target,
  fragments,
  occurrences,
) {
  const byMemory =
    new Map();

  fragments.forEach(
    (fragment) => {
      const memoryId =
        optionalString(
          fragment
            ?.source_memory_ref,
        );

      if (!memoryId) {
        const error = new Error(
          "RecoveredFragment.source_memory_ref is required for RetrievalEvent persistence.",
        );
        error.code =
          "WORLD_SIMULATION_MEMORY_RETRIEVAL_PERSISTENCE_FRAGMENT_SOURCE_REQUIRED";
        throw error;
      }

      if (!byMemory.has(memoryId)) {
        byMemory.set(
          memoryId,
          [],
        );
      }

      byMemory.get(memoryId)
        .push(
          cloneJson(fragment),
        );
    },
  );

  return [
    ...byMemory.entries(),
  ].map(
    ([memoryId, memoryFragments]) => {
      const fragmentIds =
        memoryFragments
          .map(
            (fragment) =>
              optionalString(
                fragment?.fragment_id,
              ),
          )
          .filter(Boolean);

      const occurrenceIds =
        occurrences
          .filter(
            (occurrence) =>
              optionalString(
                occurrence
                  ?.source_memory_ref,
              )
              === memoryId,
          )
          .map(
            (occurrence) =>
              optionalString(
                occurrence
                  ?.recovery_occurrence_id,
              ),
          )
          .filter(Boolean);

      const targetRelation =
        target.grounded
          ? (
            target.memory_id
            === memoryId
              ? "target"
              : "non_target"
          )
          : "unresolved";

      const extent =
        recoveryExtent(
          memoryFragments,
        );

      const recoveryId =
        `memory_recovery_${hashAgentRunValue({
          event_seed:
            eventSeed,
          source_memory_ref:
            memoryId,
          recovered_fragment_ids:
            fragmentIds,
          recovery_occurrence_ids:
            occurrenceIds,
          recovery_extent:
            extent,
          target_relation:
            targetRelation,
        }).slice(0, 24)}`;

      return {
        memory_recovery_id:
          recoveryId,
        source_memory_ref:
          memoryId,
        recovered_fragment_ids:
          fragmentIds,
        recovery_occurrence_ids:
          occurrenceIds,
        recovery_extent:
          extent,
        target_relation:
          targetRelation,
      };
    },
  );
}

function buildHistoryReference(
  event,
  memoryRecovery,
  role,
) {
  return {
    schema_version:
      memoryRetrievalHistoryReferenceSchemaVersion,
    retrieval_event_id:
      event.retrieval_event_id,
    retrieval_event_hash:
      event.retrieval_event_hash,
    memory_recovery_id:
      memoryRecovery
        ?.memory_recovery_id
      ?? null,
    role,
  };
}

function roleForRecovery(memoryRecovery) {
  if (
    memoryRecovery.target_relation
    === "non_target"
  ) {
    return "non_target_recovered";
  }

  return memoryRecovery.recovery_extent
    === "whole_content"
      ? "recovered"
      : "partially_recovered";
}

function eventTimeForReference(
  reference,
  retrievalEvents,
) {
  const eventId =
    optionalString(
      reference
        ?.retrieval_event_id,
    );

  if (!eventId) return null;

  const event =
    retrievalEvents[eventId];

  if (!isObject(event)) {
    const error = new Error(
      `Canonical retrieval-history reference cannot resolve RetrievalEvent ${eventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_HISTORY_REFERENCE_UNRESOLVED";
    throw error;
  }

  if (
    optionalString(
      reference
        ?.retrieval_event_hash,
    )
    !== optionalString(
      event.retrieval_event_hash,
    )
  ) {
    const error = new Error(
      `Canonical retrieval-history reference hash does not match RetrievalEvent ${eventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_HISTORY_REFERENCE_HASH_MISMATCH";
    throw error;
  }

  return event.occurred_at
    ?? null;
}

function rebuildCompatibilitySummaries(
  record,
  retrievalEvents,
) {
  const baseline =
    object(
      record
        ?.retrieval_history_legacy_baseline,
    );

  const baselineCount =
    Number.isSafeInteger(
      Number(
        baseline
          .successful_recall_count,
      ),
    )
      ? Math.max(
        0,
        Number(
          baseline
            .successful_recall_count,
        ),
      )
      : 0;

  let lastSuccessful =
    baseline
      .last_successful_recall_at
    ?? null;

  const successfulEventIds =
    new Set();

  for (
    const reference
    of array(
      record?.retrieval_history,
    )
  ) {
    if (
      !canonicalReference(reference)
      || !successfulCanonicalRoles.has(
        optionalString(
          reference.role,
        ),
      )
    ) {
      continue;
    }

    const eventId =
      reference.retrieval_event_id;

    if (
      successfulEventIds.has(eventId)
    ) {
      continue;
    }

    successfulEventIds.add(eventId);

    lastSuccessful =
      laterTimestamp(
        lastSuccessful,
        eventTimeForReference(
          reference,
          retrievalEvents,
        ),
      );
  }

  return {
    recall_count:
      baselineCount
      + successfulEventIds.size,
    last_recalled_at:
      lastSuccessful,
  };
}

function eventForProcess(
  normalized,
  turnId,
  occurredAt,
) {
  const process =
    normalized.process;

  const result =
    normalized.result;

  const processHash =
    hashAgentRunValue(
      cloneJson(process),
    );

  const target =
    groundedTarget(
      process.target,
    );

  const occurrences =
    buildSyntheticOccurrences(
      result,
      process.retrieval_process_id,
    );

  const searchSteps =
    canonicalSearchSteps(
      process,
      result,
      occurrences,
    );

  const fragments =
    cloneJson(
      array(
        result.recovered_fragments,
      ),
    );

  const eventSeed = {
    persistence_version:
      worldSimulationMemoryRetrievalPersistenceVersion,
    retrieval_process_id:
      process.retrieval_process_id,
    retrieval_process_version:
      normalized.version,
    retrieval_process_hash:
      processHash,
    character:
      process.character
      ?? normalized.observer,
    turn_id:
      turnId,
    occurred_at:
      occurredAt,
  };

  const memoryRecoveries =
    buildMemoryRecoveries(
      eventSeed,
      target,
      fragments,
      occurrences,
    );

  const eventId =
    `memory_retrieval_event_${hashAgentRunValue(
      eventSeed,
    ).slice(0, 24)}`;

  const controlAnnotations =
    array(process.steps)
      .map(
        (step, index) => {
          const reason =
            optionalString(
              step
                ?.continuation
                ?.control_reason,
            )
            ?? (
              index
              === array(process.steps).length - 1
                ? optionalString(
                  process
                    ?.termination
                    ?.reason,
                )
                : null
            );

          return reason
            ? {
              step_index:
                step?.step_index
                ?? index,
              control_reason:
                reason,
              subjective_character_thought:
                false,
            }
            : null;
        },
      )
      .filter(Boolean);

  const eventBody = {
    schema_version:
      memoryRetrievalEventSchemaVersion,
    retrieval_event_id:
      eventId,
    retrieval_process_id:
      process.retrieval_process_id,
    retrieval_process_version:
      normalized.version,
    retrieval_process_hash:
      processHash,
    character:
      requiredString(
        process.character
        ?? normalized.observer,
        "RetrievalEvent.character",
      ),
    turn_id:
      turnId,
    occurred_at:
      occurredAt,
    occurred_at_precision:
      "turn_context",
    initiation:
      cloneJson(
        process.initiation
        ?? null,
      ),
    retrieval_task:
      cloneJson(
        process.retrieval_task
        ?? null,
      ),
    target:
      cloneJson(
        process.target
        ?? null,
      ),
    search_steps:
      searchSteps,
    recovered_content:
      fragments,
    recovery_occurrences:
      occurrences,
    memory_recoveries:
      memoryRecoveries,
    target_outcome:
      result.target_outcome
      ?? null,
    recovered_any_content:
      result.recovered_any_content
      === true,
    termination:
      cloneJson(
        process.termination
        ?? null,
      ),
    engine_audit: {
      resolver_trace_hash:
        hashAgentRunValue(
          cloneJson(
            normalized
              ?.result
              ?.resolver_audit
            ?? [],
          ),
        ),
      control_annotations:
        controlAnnotations,
      control_reason_is_subjective_character_thought:
        false,
      counterfactual_reinstatement_options_persisted:
        false,
      non_contacted_candidate_refs_persisted:
        false,
      same_cycle_phase63b_feedback_used:
        false,
      strengthening_applied:
        false,
      competitor_weakening_applied:
        false,
      confidence_rewritten:
        false,
      memory_content_rewritten:
        false,
      reconsolidation_applied:
        false,
    },
    immutable:
      true,
  };

  const eventHash =
    hashAgentRunValue(
      eventBody,
    );

  const event = {
    ...eventBody,
    retrieval_event_hash:
      eventHash,
  };

  return deepFreeze({
    event,
    target,
  });
}

function cloneWorldState(value) {
  return cloneJson(
    object(value),
  );
}

export function buildWorldSimulationMemoryRetrievalPersistenceContract() {
  return {
    version:
      worldSimulationMemoryRetrievalPersistenceVersion,
    phase:
      "Phase63C Step 5",
    status:
      "immutable_retrieval_event_persistence_installed",
    retrieval_event_schema_version:
      memoryRetrievalEventSchemaVersion,
    retrieval_history_reference_schema_version:
      memoryRetrievalHistoryReferenceSchemaVersion,
    legacy_baseline_schema_version:
      memoryRetrievalLegacyBaselineSchemaVersion,
    retrieval_event_persistence_installed:
      true,
    per_memory_recovery_records_installed:
      true,
    failed_target_attempt_history_installed:
      true,
    search_steps_persist_actual_path_only:
      true,
    counterfactual_cue_options_persisted:
      false,
    historical_recovered_content_snapshotted:
      true,
    retrieval_event_write_once_required:
      true,
    retrieval_history_append_only_required:
      true,
    legacy_baseline_immutable_required:
      true,
    compatibility_summaries_rebuildable:
      true,
    recovery_occurrence_count_is_recall_count:
      false,
    same_cycle_phase63b_history_feedback_allowed:
      false,
    retrieval_reinforcement_modeled:
      false,
    retrieval_induced_forgetting_modeled:
      false,
    reconsolidation_modeled:
      false,
    memory_content_rewrite_modeled:
      false,
    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",
  };
}

export function buildWorldSimulationMemoryRetrievalPersistence(
  input = {},
) {
  const worldState =
    cloneWorldState(
      input.world_state,
    );

  const turnId =
    requiredString(
      input.turn_id,
      "turn_id",
    );

  const occurredAt =
    input.occurred_at
    ?? null;

  const normalizedProcesses =
    array(
      input.retrieval_processes,
    )
      .map(
        normalizeProcessWrapper,
      )
      .filter(
        (entry) =>
          entry.process_occurred,
      );

  const preview =
    cloneWorldState(
      worldState,
    );

  const existingEvents =
    object(
      worldState.retrieval_events,
    );

  const allEvents =
    {
      ...cloneJson(
        existingEvents,
      ),
    };

  const createdEvents = [];
  const alreadyPersisted = [];
  const eventTransitions = [];
  const refsByCharacterMemory =
    new Map();

  const pushReference = (
    character,
    memoryId,
    event,
    memoryRecovery,
    role,
  ) => {
    const key =
      JSON.stringify([
        character,
        memoryId,
      ]);

    if (!refsByCharacterMemory.has(key)) {
      refsByCharacterMemory.set(
        key,
        {
          character,
          memory_id:
            memoryId,
          refs: [],
        },
      );
    }

    refsByCharacterMemory
      .get(key)
      .refs
      .push(
        buildHistoryReference(
          event,
          memoryRecovery,
          role,
        ),
      );
  };

  for (
    const normalized
    of normalizedProcesses
  ) {
    const built =
      eventForProcess(
        normalized,
        turnId,
        occurredAt,
      );

    const event =
      built.event;

    const existing =
      existingEvents[
        event.retrieval_event_id
      ];

    if (isObject(existing)) {
      if (
        optionalString(
          existing
            .retrieval_event_hash,
        )
        !== event.retrieval_event_hash
        || !sameValue(
          existing,
          event,
        )
      ) {
        const error = new Error(
          `RetrievalEvent ${event.retrieval_event_id} already exists with different immutable content.`,
        );
        error.code =
          "WORLD_SIMULATION_RETRIEVAL_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }

      alreadyPersisted.push(
        event.retrieval_event_id,
      );
    } else {
      createdEvents.push(
        event,
      );

      allEvents[
        event.retrieval_event_id
      ] =
        cloneJson(event);

      preview.retrieval_events =
        object(
          preview.retrieval_events,
        );

      preview.retrieval_events[
        event.retrieval_event_id
      ] =
        cloneJson(event);

      eventTransitions.push({
        entity:
          "world",
        field:
          `retrieval_events.${event.retrieval_event_id}`,
        from:
          null,
        to:
          cloneJson(event),
        cause:
          `persist immutable RetrievalEvent ${event.retrieval_event_id}`,
        source_layer:
          "memory_retrieval_history",
      });
    }

    const authoritativeEvent =
      allEvents[
        event.retrieval_event_id
      ]
      ?? event;

    for (
      const recovery
      of array(
        authoritativeEvent
          .memory_recoveries,
      )
    ) {
      pushReference(
        authoritativeEvent.character,
        recovery.source_memory_ref,
        authoritativeEvent,
        recovery,
        roleForRecovery(
          recovery,
        ),
      );
    }

    const target =
      groundedTarget(
        authoritativeEvent.target,
      );

    if (
      target.grounded
      && authoritativeEvent
        .target_outcome
      === "failed"
      && !array(
        authoritativeEvent
          .memory_recoveries,
      ).some(
        (recovery) =>
          recovery.source_memory_ref
          === target.memory_id,
      )
    ) {
      pushReference(
        authoritativeEvent.character,
        target.memory_id,
        authoritativeEvent,
        null,
        "target_attempt_failed",
      );
    }
  }

  const memoryTransitions = [];
  const historyUpdates = [];

  const groupedByCharacter =
    new Map();

  for (
    const group
    of refsByCharacterMemory.values()
  ) {
    if (
      !groupedByCharacter
        .has(group.character)
    ) {
      groupedByCharacter.set(
        group.character,
        [],
      );
    }

    groupedByCharacter
      .get(group.character)
      .push(group);
  }

  for (
    const [
      character,
      memoryGroups,
    ]
    of groupedByCharacter.entries()
  ) {
    const memoryKey =
      characterMemoryKey(
        worldState,
        character,
      );

    const existingRaw =
      characterMemoryRecords(
        worldState,
        character,
      );

    const before =
      cloneJson(
        existingRaw,
      );

    const after =
      cloneJson(
        existingRaw,
      );

    const indexById =
      new Map();

    after.forEach(
      (record, index) => {
        indexById.set(
          memoryIdFor(
            record,
            `memories.${character}[${index}]`,
          ),
          index,
        );
      },
    );

    for (
      const memoryGroup
      of memoryGroups
    ) {
      const memoryIndex =
        indexById.get(
          memoryGroup.memory_id,
        );

      if (
        memoryIndex === undefined
      ) {
        const error = new Error(
          `RetrievalEvent references memory ${memoryGroup.memory_id} that is absent from persisted character memory state.`,
        );
        error.code =
          "WORLD_SIMULATION_MEMORY_RETRIEVAL_HISTORY_MEMORY_NOT_FOUND";
        throw error;
      }

      const record =
        cloneJson(
          after[memoryIndex],
        );

      const existingHistory =
        array(
          record.retrieval_history,
        );

      const firstEventId =
        memoryGroup
          .refs[0]
          ?.retrieval_event_id
        ?? null;

      record.retrieval_history_legacy_baseline =
        captureLegacyBaseline(
          record,
          firstEventId,
        );

      const seenCanonical =
        new Set(
          existingHistory
            .filter(
              canonicalReference,
            )
            .map(
              (entry) =>
                JSON.stringify([
                  entry.retrieval_event_id,
                  entry.memory_recovery_id
                  ?? null,
                  entry.role
                  ?? null,
                ]),
            ),
        );

      const appended = [];

      for (
        const ref
        of memoryGroup.refs
      ) {
        const identity =
          JSON.stringify([
            ref.retrieval_event_id,
            ref.memory_recovery_id
            ?? null,
            ref.role
            ?? null,
          ]);

        if (
          seenCanonical.has(identity)
        ) {
          continue;
        }

        seenCanonical.add(identity);
        appended.push(
          cloneJson(ref),
        );
      }

      record.retrieval_history = [
        ...cloneJson(
          existingHistory,
        ),
        ...appended,
      ];

      const summaries =
        rebuildCompatibilitySummaries(
          record,
          allEvents,
        );

      record.recall_count =
        summaries.recall_count;

      record.last_recalled_at =
        summaries.last_recalled_at;

      after[memoryIndex] =
        record;

      historyUpdates.push({
        character,
        memory_id:
          memoryGroup.memory_id,
        appended_reference_count:
          appended.length,
        recall_count:
          record.recall_count,
        last_recalled_at:
          record.last_recalled_at,
        legacy_baseline_source:
          record
            .retrieval_history_legacy_baseline
            ?.source
          ?? null,
      });
    }

    if (
      !sameValue(
        before,
        after,
      )
    ) {
      preview.memories =
        object(
          preview.memories,
        );

      preview.memories[memoryKey] =
        cloneJson(after);

      memoryTransitions.push({
        entity:
          "world",
        field:
          `memories.${memoryKey}`,
        from:
          cloneJson(before),
        to:
          cloneJson(after),
        cause:
          `append Phase63C RetrievalEvent history references for ${character}`,
        source_layer:
          "memory_retrieval_history",
      });
    }
  }

  return deepFreeze({
    version:
      worldSimulationMemoryRetrievalPersistenceVersion,
    result: {
      retrieval_events_created:
        cloneJson(
          createdEvents,
        ),
      already_persisted_retrieval_event_ids:
        cloneJson(
          alreadyPersisted,
        ),
      history_updates:
        cloneJson(
          historyUpdates,
        ),
      state_transitions: [
        ...cloneJson(
          eventTransitions,
        ),
        ...cloneJson(
          memoryTransitions,
        ),
      ],
      preview_world_state:
        preview,
      audit: {
        completed_retrieval_process_count:
          normalizedProcesses.length,
        created_retrieval_event_count:
          createdEvents.length,
        already_persisted_event_count:
          alreadyPersisted.length,
        retrieval_history_update_count:
          historyUpdates.length,
        search_steps_persist_actual_path_only:
          true,
        counterfactual_cue_options_persisted:
          false,
        same_cycle_phase63b_feedback_used:
          false,
        retrieval_reinforcement_applied:
          false,
        competitor_weakening_applied:
          false,
        confidence_rewritten:
          false,
        memory_content_rewritten:
          false,
        reconsolidation_applied:
          false,
        direct_world_state_commit_performed:
          false,
        authoritative_mutation_owner:
          "phase62k-authoritative-mutation-executor-v1",
      },
    },
  });
}
