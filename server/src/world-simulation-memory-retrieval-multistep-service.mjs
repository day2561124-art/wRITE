import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationMemoryCueLinks,
  queryWorldSimulationMemoryAccessibility,
} from "./world-simulation-memory-accessibility-service.mjs";
import {
  projectWorldSimulationCueDiagnosticEvidence,
} from "./world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  assertWorldSimulationRetrievalCueOrientationStageBoundary,
  buildWorldSimulationRetrievalCueOrientationCharacterView,
  buildWorldSimulationRetrievalCueOrientationContract,
  buildWorldSimulationRetrievalCueOrientationOptions,
  buildWorldSimulationRetrievalCueOrientationResolverOptions,
  materializeWorldSimulationRetrievalCueOrientationEvidence,
} from "./world-simulation-retrieval-cue-orientation-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalCueSupportTopologyContract,
  projectWorldSimulationRetrievalCueSupportTopologyEvidence,
} from "./world-simulation-retrieval-cue-support-topology-evidence-service.mjs";
import {
  buildWorldSimulationAssociativeActivationCompositionEvidenceContract,
  projectWorldSimulationAssociativeActivationCompositionEvidence,
} from "./world-simulation-associative-activation-composition-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalCompetitionMonitoringEvidenceContract,
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence,
} from "./world-simulation-retrieval-competition-monitoring-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalSearchControlReadinessEvidenceContract,
  projectWorldSimulationRetrievalSearchControlReadinessEvidence,
} from "./world-simulation-retrieval-search-control-readiness-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalCueConditionedEpisodeEvidenceContract,
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence,
} from "./world-simulation-retrieval-cue-conditioned-episode-evidence-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalQuery,
  executeWorldSimulationMemoryRetrievalProcess,
} from "./world-simulation-memory-retrieval-process-service.mjs";

export const worldSimulationMemoryRetrievalProcessV3Version =
  "phase63c-memory-retrieval-process-v3";

const allowedInitiationModes =
  new Set([
    "deliberate",
    "spontaneous",
  ]);

const allowedTriggerOrigins =
  new Set([
    "self_generated",
    "external_prompt",
    "environmental_cue",
    "internally_reinstated_cue",
    "unspecified",
  ]);

const allowedRetrievalTaskModes =
  new Set([
    "free_recall",
    "cued_recall",
    "recognition",
    "source_query",
    "associative_recall",
    "unspecified",
  ]);

const allowedContentKinds =
  new Set([
    "gist",
    "detail",
    "sensory_fragment",
    "relational_fragment",
    "identity_fragment",
    "semantic_fragment",
    "unspecified",
  ]);

const allowedControlActions =
  new Set([
    "continue",
    "stop",
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

  for (
    const child
    of Object.values(value)
  ) {
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
  code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_V3_INVALID",
) {
  const text =
    optionalString(value);

  if (text) {
    return text;
  }

  const error =
    new Error(
      `${label} is required.`,
    );

  error.code =
    code;

  throw error;
}

function positiveInteger(
  value,
  label,
) {
  const number =
    Number(value);

  if (
    Number.isSafeInteger(number)
    && number > 0
  ) {
    return number;
  }

  const error =
    new Error(
      `${label} must be a positive safe integer.`,
    );

  error.code =
    "WORLD_SIMULATION_MEMORY_RETRIEVAL_STEP_BUDGET_INVALID";

  throw error;
}

function memoryIdFor(
  record,
  label,
) {
  if (!isObject(record)) {
    const error =
      new Error(
        `${label} must be an object.`,
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_MEMORY_INVALID";

    throw error;
  }

  const memoryId =
    String(
      record.memory_id
      ?? record.id
      ?? "",
    ).trim();

  if (memoryId) {
    return memoryId;
  }

  const error =
    new Error(
      `${label}.memory_id is required.`,
    );

  error.code =
    "WORLD_SIMULATION_MEMORY_RETRIEVAL_MEMORY_ID_REQUIRED";

  throw error;
}

function buildMemoryIndex(
  records,
) {
  const byId =
    new Map();

  array(records)
    .forEach(
      (
        record,
        index,
      ) => {
        const memoryId =
          memoryIdFor(
            record,
            `memory_records[${index}]`,
          );

        if (
          byId.has(memoryId)
        ) {
          const error =
            new Error(
              `Duplicate memory_id in frozen snapshot: ${memoryId}`,
            );

          error.code =
            "WORLD_SIMULATION_MEMORY_RETRIEVAL_MEMORY_DUPLICATE";

          throw error;
        }

        byId.set(
          memoryId,
          {
            memory_id:
              memoryId,
            snapshot_index:
              index,
            record:
              record,
          },
        );
      },
    );

  return byId;
}

function candidateRefs(
  records,
) {
  return array(records)
    .map(
      (
        record,
        candidateIndex,
      ) => ({
        memory_id:
          memoryIdFor(
            record,
            `candidate_memory_records[${candidateIndex}]`,
          ),
        candidate_index:
          candidateIndex,
      }),
    );
}

function cueIdentity(
  cue,
) {
  return JSON.stringify([
    cue?.kind
    ?? null,
    cue?.value
    ?? null,
  ]);
}

function selectorIdentity(
  selector,
) {
  if (
    selector?.kind
    === "whole_content"
  ) {
    return "whole_content";
  }

  if (
    selector?.kind
    === "json_pointer"
  ) {
    return `json_pointer:${selector.path}`;
  }

  return JSON.stringify(
    selector
    ?? null,
  );
}

function normalizeSelector(
  raw,
) {
  if (
    raw === null
    || raw === undefined
  ) {
    return {
      kind:
        "whole_content",
    };
  }

  if (!isObject(raw)) {
    const error =
      new Error(
        "retrieval selector must be an object when present.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID";

    throw error;
  }

  const kind =
    optionalString(
      raw.kind,
    );

  if (
    kind
    === "whole_content"
  ) {
    return {
      kind,
    };
  }

  if (
    kind
    === "json_pointer"
  ) {
    return {
      kind,
      path:
        requiredString(
          raw.path,
          "selector.path",
          "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID",
        ),
    };
  }

  const error =
    new Error(
      `Unsupported retrieval selector kind: ${kind ?? "missing"}.`,
    );

  error.code =
    "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID";

  throw error;
}

function normalizeTarget(
  rawTarget,
) {
  if (
    rawTarget === null
    || rawTarget === undefined
  ) {
    return {
      value:
        null,
      grounded:
        false,
      kind:
        null,
      memory_id:
        null,
      requested_selectors:
        [],
    };
  }

  if (!isObject(rawTarget)) {
    return {
      value:
        cloneJson(rawTarget),
      grounded:
        false,
      kind:
        null,
      memory_id:
        null,
      requested_selectors:
        [],
    };
  }

  const kind =
    optionalString(
      rawTarget.kind,
    );

  if (
    kind
    === "memory_ref"
  ) {
    const memoryId =
      requiredString(
        rawTarget.memory_id,
        "target.memory_id",
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_INVALID",
      );

    return {
      value:
        cloneJson(rawTarget),
      grounded:
        true,
      kind,
      memory_id:
        memoryId,
      requested_selectors: [
        {
          kind:
            "whole_content",
        },
      ],
    };
  }

  if (
    kind
    === "memory_content"
  ) {
    const memoryId =
      requiredString(
        rawTarget.memory_id,
        "target.memory_id",
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_INVALID",
      );

    const requestedSelectors =
      array(
        rawTarget.requested_selectors,
      ).map(
        normalizeSelector,
      );

    if (
      !requestedSelectors.length
    ) {
      const error =
        new Error(
          "memory_content target requires requested_selectors.",
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_INVALID";

      throw error;
    }

    return {
      value:
        cloneJson(rawTarget),
      grounded:
        true,
      kind,
      memory_id:
        memoryId,
      requested_selectors:
        requestedSelectors,
    };
  }

  return {
    value:
      cloneJson(rawTarget),
    grounded:
      false,
    kind:
      kind
      ?? null,
    memory_id:
      null,
    requested_selectors:
      [],
  };
}

function normalizeInitiation(
  raw,
) {
  const value =
    object(raw);

  const mode =
    optionalString(
      value.mode,
    );

  if (
    !allowedInitiationModes
      .has(mode)
  ) {
    const error =
      new Error(
        "initiation.mode must be deliberate or spontaneous.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_INITIATION_INVALID";

    throw error;
  }

  const triggerOrigin =
    optionalString(
      value.trigger_origin,
    )
    ?? "unspecified";

  if (
    !allowedTriggerOrigins
      .has(triggerOrigin)
  ) {
    const error =
      new Error(
        `Unsupported retrieval trigger_origin: ${triggerOrigin}`,
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_TRIGGER_ORIGIN_INVALID";

    throw error;
  }

  return {
    mode,
    trigger_origin:
      triggerOrigin,
  };
}

function normalizeRetrievalTask(
  raw,
) {
  const mode =
    optionalString(
      object(raw).mode,
    )
    ?? "unspecified";

  if (
    !allowedRetrievalTaskModes
      .has(mode)
  ) {
    const error =
      new Error(
        `Unsupported retrieval task mode: ${mode}`,
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_TASK_INVALID";

    throw error;
  }

  return {
    mode,
  };
}

function normalizeControl(
  raw,
) {
  if (!isObject(raw)) {
    const error =
      new Error(
        "continuation resolver must return an object.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_CONTINUATION_INVALID";

    throw error;
  }

  for (
    const forbiddenField
    of [
      "reinstated_cues",
      "selected_reinstatement_cues",
      "next_internal_cues",
    ]
  ) {
    if (
      Object.hasOwn(
        raw,
        forbiddenField,
      )
    ) {
      const error =
        new Error(
          `Continuation resolver may select grounded cue option refs but may not author ${forbiddenField}.`,
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_AUTHORED_REINSTATED_CUE_FORBIDDEN";

      throw error;
    }
  }

  const controlAction =
    optionalString(
      raw.control_action,
    );

  if (
    !allowedControlActions
      .has(controlAction)
  ) {
    const error =
      new Error(
        "continuation.control_action must be continue or stop.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_CONTINUATION_INVALID";

    throw error;
  }

  return {
    control_action:
      controlAction,
    control_reason:
      optionalString(
        raw.control_reason,
      )
      ?? null,
    selected_reinstatement_cue_refs:
      array(
        raw.selected_reinstatement_cue_refs,
      ).map(
        (value) =>
          requiredString(
            value,
            "selected_reinstatement_cue_refs[]",
            "WORLD_SIMULATION_MEMORY_RETRIEVAL_REINSTATED_CUE_SELECTION_INVALID",
          ),
      ),
  };
}

function canonicalFrontier(
  accessibilityResult,
  cueDiagnosticEvidenceProjection = null,
) {
  const result =
    object(
      accessibilityResult,
    );

  const cueDiagnosticProjection =
    object(
      cueDiagnosticEvidenceProjection,
    );

  const records =
    cloneJson(
      array(
        result.candidate_memory_records,
      ),
    );

  const refs =
    candidateRefs(
      records,
    );

  const candidateIds =
    new Set(
      refs.map(
        (ref) =>
          ref.memory_id,
      ),
    );

  const evaluations =
    array(
      result.candidate_evaluations,
    ).filter(
      (evaluation) =>
        candidateIds.has(
          String(
            evaluation?.memory_id
            ?? "",
          ),
        ),
    );

  const activeCues =
    cloneJson(
      array(
        result.active_retrieval_cues,
      ),
    );

  const activeCueHash =
    hashAgentRunValue(
      activeCues,
    );

  const candidateSetHash =
    hashAgentRunValue(
      records,
    );

  const frontierId =
    `memory_retrieval_frontier_${hashAgentRunValue({
      version:
        worldSimulationMemoryRetrievalProcessV3Version,
      active_cue_hash:
        activeCueHash,
      candidate_set_hash:
        candidateSetHash,
      candidate_refs:
        refs,
      cue_diagnostic_projection_id:
        cueDiagnosticProjection.projection_id
        ?? null,
      cue_diagnostic_evidence_hash:
        cueDiagnosticProjection.evidence_hash
        ?? null,
      cue_diagnostic_applicable:
        cueDiagnosticProjection.applicable
        === true,
    }).slice(0, 24)}`;

  return {
    frontier_id:
      frontierId,
    model_mode:
      result.model_mode
      ?? null,
    active_cues:
      activeCues,
    active_cue_hash:
      activeCueHash,
    candidate_set_hash:
      candidateSetHash,
    candidate_count:
      records.length,
    candidate_refs:
      refs,
    candidate_records:
      records,
    candidate_evaluations:
      cloneJson(
        evaluations,
      ),
    cue_diagnostic_projection: {
      version:
        cueDiagnosticProjection.version
        ?? null,
      projection_id:
        cueDiagnosticProjection.projection_id
        ?? null,
      evidence_hash:
        cueDiagnosticProjection.evidence_hash
        ?? null,
      applicable:
        cueDiagnosticProjection.applicable
        === true,
    },
  };
}

function publicFrontier(
  frontier,
) {
  return {
    frontier_id:
      frontier.frontier_id,
    active_cues:
      cloneJson(
        frontier.active_cues,
      ),
    active_cue_hash:
      frontier.active_cue_hash,
    candidate_set_hash:
      frontier.candidate_set_hash,
    candidate_count:
      frontier.candidate_count,
    candidate_refs:
      cloneJson(
        frontier.candidate_refs,
      ),
    cue_diagnostic_projection:
      cloneJson(
        frontier.cue_diagnostic_projection
        ?? {
          version: null,
          projection_id: null,
          evidence_hash: null,
          applicable: false,
        },
      ),
  };
}

function safeMemoryView(
  record,
) {
  const source =
    isObject(
      record?.source,
    )
      ? {
        kind:
          record.source.kind
          ?? null,
        actor:
          record.source.actor
          ?? null,
        sense:
          record.source.sense
          ?? null,
      }
      : {
        kind:
          record?.source_kind
          ?? null,
        actor:
          record?.source_actor
          ?? null,
        sense:
          null,
      };

  return {
    memory_id:
      memoryIdFor(
        record,
        "candidate_memory_record",
      ),
    content:
      cloneJson(
        Object.hasOwn(
          record,
          "content",
        )
          ? record.content
          : record.memory
            ?? record.summary
            ?? null,
      ),
    memory_type:
      record.memory_type
      ?? null,
    source,
    perceptual_certainty_at_encoding:
      record.perceptual_certainty_at_encoding
      ?? null,
    perceptual_clarity_at_encoding:
      record.perceptual_clarity_at_encoding
      ?? null,
    possibly_incorrect:
      record.possibly_incorrect
      === true,
    source_confused:
      record.source_confused
      === true,
  };
}

function safeEvaluationView(
  evaluation,
) {
  return {
    memory_id:
      evaluation?.memory_id
      ?? null,
    cue_matches:
      cloneJson(
        array(
          evaluation?.cue_matches,
        ),
      ),
    cue_competition:
      cloneJson(
        array(
          evaluation?.cue_competition,
        ),
      ),
  };
}

function resolverFrontierView(
  frontier,
  includeContent,
) {
  const result = {
    ...publicFrontier(
      frontier,
    ),
    candidate_evaluations:
      frontier.candidate_evaluations
        .map(
          safeEvaluationView,
        ),
  };

  if (includeContent) {
    result.candidate_memory_records =
      frontier.candidate_records
        .map(
          safeMemoryView,
        );
  }

  return result;
}

function resolverInitiationFrontierView(
  frontier,
) {
  return {
    frontier_id:
      frontier.frontier_id,
    active_cue_hash:
      frontier.active_cue_hash,
    candidate_set_hash:
      frontier.candidate_set_hash,
    candidate_count:
      frontier.candidate_count,
    candidate_refs:
      cloneJson(
        frontier.candidate_refs,
      ),
  };
}

function resolverInitiationQueryView(
  query,
  frontier,
) {
  const result =
    cloneJson(
      query,
    );

  result.initial_frontier =
    resolverInitiationFrontierView(
      frontier,
    );

  result.boundaries = {
    ...object(
      result.boundaries,
    ),
    initiation_raw_active_cues_visible:
      false,
    initiation_candidate_competition_visible:
      false,
    initiation_r4a_projection_metadata_visible:
      false,
  };

  return result;
}

function assertMemorySnapshot(
  query,
  memoryRecords,
) {
  const memoryIndex =
    buildMemoryIndex(
      memoryRecords,
    );

  const snapshotHash =
    hashAgentRunValue(
      cloneJson(
        memoryRecords,
      ),
    );

  if (
    snapshotHash
    !== query.memory_snapshot
      ?.snapshot_hash
    || memoryIndex.size
    !== query.memory_snapshot
      ?.memory_count
  ) {
    const error =
      new Error(
        "Phase63C v3 frozen subjective-memory snapshot changed during retrieval.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_MEMORY_SNAPSHOT_MISMATCH";

    throw error;
  }

  return memoryIndex;
}

function assertInitialFrontier(
  query,
  initialAccessibilityResult,
  initialCueDiagnosticProjection = null,
) {
  const frontier =
    canonicalFrontier(
      initialAccessibilityResult,
      initialCueDiagnosticProjection,
    );

  const expected =
    query.initial_frontier
    ?? {};

  if (
    frontier.frontier_id
      !== expected.frontier_id
    || frontier.active_cue_hash
      !== expected.active_cue_hash
    || frontier.candidate_set_hash
      !== expected.candidate_set_hash
    || frontier.candidate_count
      !== expected.candidate_count
    || JSON.stringify(
      frontier.candidate_refs,
    )
      !== JSON.stringify(
        expected.candidate_refs
        ?? [],
      )
  ) {
    const error =
      new Error(
        "Phase63C v3 initial candidate frontier no longer matches the frozen retrieval query.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_INITIAL_FRONTIER_MISMATCH";

    throw error;
  }

  return frontier;
}

function assertAccessibilityBaseContext(
  query,
  accessibilityBaseInput,
  memoryRecords,
) {
  const base =
    cloneJson(
      object(
        accessibilityBaseInput,
      ),
    );

  base.memory_records =
    cloneJson(
      memoryRecords,
    );

  const contextHash =
    hashAgentRunValue(
      base,
    );

  if (
    contextHash
    !== query.accessibility_context
      ?.context_hash
  ) {
    const error =
      new Error(
        "Phase63C v3 accessibility base context changed during retrieval.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_ACCESSIBILITY_CONTEXT_MISMATCH";

    throw error;
  }

  return base;
}

function targetRelationForSelection(
  selection,
  target,
) {
  if (
    target.value === null
    || target.value === undefined
  ) {
    return "unresolved";
  }

  if (!target.grounded) {
    return "unresolved";
  }

  const sourceMemoryId =
    typeof selection?.source_memory_ref
    === "string"
      ? selection.source_memory_ref.trim()
      : String(
        selection?.memory_id
        ?? selection?.source_memory_ref?.memory_id
        ?? "",
      ).trim();

  return sourceMemoryId
    === target.memory_id
      ? "target_related"
      : "non_target";
}

function normalizeRecoverySelections(
  values,
  target,
) {
  return array(values)
    .map(
      (
        raw,
        index,
      ) => {
        if (!isObject(raw)) {
          const error =
            new Error(
              `recovered_selections[${index}] must be an object.`,
            );

          error.code =
            "WORLD_SIMULATION_MEMORY_RETRIEVAL_RECOVERY_INVALID";

          throw error;
        }

        if (
          Object.hasOwn(
            raw,
            "content",
          )
        ) {
          const error =
            new Error(
              "Phase63C v3 resolver may select grounded source content but may not author recovered content.",
            );

          error.code =
            "WORLD_SIMULATION_MEMORY_RETRIEVAL_AUTHORED_CONTENT_FORBIDDEN";

          throw error;
        }

        const contentKind =
          optionalString(
            raw.content_kind,
          )
          ?? "unspecified";

        if (
          !allowedContentKinds
            .has(contentKind)
        ) {
          const error =
            new Error(
              `Unsupported recovered content_kind: ${contentKind}.`,
            );

          error.code =
            "WORLD_SIMULATION_MEMORY_RETRIEVAL_CONTENT_KIND_INVALID";

          throw error;
        }

        return {
          ...cloneJson(raw),
          selector:
            normalizeSelector(
              raw.selector,
            ),
          content_kind:
            contentKind,
          target_relation:
            targetRelationForSelection(
              raw,
              target,
            ),
        };
      },
    );
}

function stableFragment(
  query,
  fragment,
) {
  const grounding =
    object(
      fragment?.content_grounding,
    );

  const selector =
    normalizeSelector(
      grounding.selector,
    );

  const fragmentId =
    `memory_retrieval_fragment_v3_${hashAgentRunValue({
      version:
        worldSimulationMemoryRetrievalProcessV3Version,
      query_id:
        query.query_id,
      source_memory_ref:
        fragment.source_memory_ref,
      selector,
      content_kind:
        fragment.content_kind,
      target_relation:
        fragment.target_relation,
    }).slice(0, 24)}`;

  return {
    ...cloneJson(fragment),
    fragment_id:
      fragmentId,
    content_grounding: {
      ...cloneJson(
        grounding,
      ),
      selector,
      materialized_by_kernel:
        true,
      phase63c_v3_grounded:
        true,
    },
  };
}

function materializeStepRecovery({
  query,
  frontier,
  initiation,
  retrievalTask,
  target,
  recoveryResolution,
}) {
  if (!isObject(recoveryResolution)) {
    const error =
      new Error(
        "recovery resolver must return an object.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_RECOVERY_INVALID";

    throw error;
  }

  const normalizedSelections =
    normalizeRecoverySelections(
      recoveryResolution.recovered_selections,
      target,
    );

  const step3Query =
    buildWorldSimulationMemoryRetrievalQuery({
      character:
        query.character,
      turn_id:
        `${query.turn_id}:phase63c-v3:${frontier.frontier_id}`,
      phase63b_version:
        query.phase63b_version,
      candidate_memory_records:
        frontier.candidate_records,
      initial_cues:
        frontier.active_cues,
      retrieval_goal:
        null,
    });

  const step3Result =
    executeWorldSimulationMemoryRetrievalProcess({
      query:
        step3Query,
      candidate_memory_records:
        frontier.candidate_records,
      resolution: {
        process_occurred:
          true,
        initiation:
          cloneJson(
            initiation,
          ),
        retrieval_task:
          cloneJson(
            retrievalTask,
          ),
        target:
          null,
        contacted_candidate_refs:
          cloneJson(
            array(
              recoveryResolution.contacted_candidate_refs,
            ),
          ),
        recovered_selections:
          normalizedSelections,
        termination: {
          reason:
            "phase63c_v3_step_materialization",
        },
      },
    });

  const fragments =
    step3Result.recovered_fragments
      .map(
        (fragment) =>
          stableFragment(
            query,
            fragment,
          ),
      );

  const memories =
    cloneJson(
      step3Result.recovered_memories,
    );

  return {
    contacted_candidate_refs:
      cloneJson(
        step3Result
          .retrieval_process
          ?.steps
          ?.[0]
          ?.contacted_candidate_refs
        ?? [],
      ),
    recovered:
      fragments.map(
        (
          fragment,
          index,
        ) => ({
          fragment,
          character_view:
            memories[index]
            ?? null,
          selector:
            normalizeSelector(
              fragment.content_grounding
                ?.selector,
            ),
          source_memory_ref:
            fragment.source_memory_ref,
        }),
      ),
  };
}

function classifyTargetOutcome(
  target,
  recoveredUnique,
) {
  if (
    target.value === null
    || target.value === undefined
  ) {
    return "not_applicable";
  }

  if (!target.grounded) {
    return "failed";
  }

  const relevant =
    recoveredUnique.filter(
      (item) =>
        item.source_memory_ref
        === target.memory_id,
    );

  if (!relevant.length) {
    return "failed";
  }

  if (
    target.kind
    === "memory_ref"
  ) {
    return relevant.some(
      (item) =>
        item.selector.kind
        === "whole_content",
    )
      ? "satisfied"
      : "partially_satisfied";
  }

  if (
    relevant.some(
      (item) =>
        item.selector.kind
        === "whole_content",
    )
  ) {
    return "satisfied";
  }

  const recoveredSelectors =
    new Set(
      relevant.map(
        (item) =>
          selectorIdentity(
            item.selector,
          ),
      ),
    );

  const requestedSelectors =
    target.requested_selectors
      .map(
        selectorIdentity,
      );

  const recoveredRequested =
    requestedSelectors.filter(
      (identity) =>
        recoveredSelectors.has(
          identity,
        ),
    );

  if (
    recoveredRequested.length
    === requestedSelectors.length
  ) {
    return "satisfied";
  }

  return recoveredRequested.length
    ? "partially_satisfied"
    : "failed";
}

function stepTargetRelation(
  recovered,
) {
  const relations =
    new Set(
      recovered.map(
        (item) =>
          item.fragment
            ?.target_relation
          ?? "unresolved",
      ),
    );

  if (
    relations.has(
      "target_related",
    )
  ) {
    return "target_related";
  }

  if (
    relations.has(
      "non_target",
    )
  ) {
    return "non_target";
  }

  return "unresolved";
}

function uniqueRecoveryIdentity(
  recovered,
) {
  return JSON.stringify([
    recovered.source_memory_ref,
    selectorIdentity(
      recovered.selector,
    ),
    recovered.fragment
      ?.content_kind
    ?? "unspecified",
    recovered.fragment
      ?.target_relation
    ?? "unresolved",
  ]);
}

function buildRecoveryOccurrences(
  query,
  stepIndex,
  recovered,
) {
  return recovered.map(
    (
      item,
      occurrenceIndex,
    ) => ({
      recovery_occurrence_id:
        `memory_retrieval_occurrence_${hashAgentRunValue({
          version:
            worldSimulationMemoryRetrievalProcessV3Version,
          query_id:
            query.query_id,
          step_index:
            stepIndex,
          occurrence_index:
            occurrenceIndex,
          fragment_id:
            item.fragment.fragment_id,
        }).slice(0, 24)}`,
      fragment_id:
        item.fragment.fragment_id,
      source_memory_ref:
        item.source_memory_ref,
    }),
  );
}

function cueOptionsForStep({
  query,
  stepIndex,
  recovered,
  occurrences,
  memoryIndex,
}) {
  const result = [];
  const firstRecoveryByMemory =
    new Map();

  recovered.forEach(
    (
      item,
      index,
    ) => {
      if (
        !firstRecoveryByMemory
          .has(item.source_memory_ref)
      ) {
        firstRecoveryByMemory.set(
          item.source_memory_ref,
          {
            recovered:
              item,
            occurrence:
              occurrences[index],
          },
        );
      }
    },
  );

  for (
    const [
      memoryId,
      groundingRecovery,
    ]
    of firstRecoveryByMemory.entries()
  ) {
    const memory =
      memoryIndex.get(
        memoryId,
      );

    if (!memory) {
      continue;
    }

    const links =
      buildWorldSimulationMemoryCueLinks(
        memory.record,
      );

    links.forEach(
      (
        link,
        linkIndex,
      ) => {
        if (
          link?.kind
          === "internally_reinstated"
        ) {
          return;
        }

        if (
          ![
            "string",
            "number",
            "boolean",
          ].includes(
            typeof link?.value,
          )
        ) {
          return;
        }

        const cueOptionId =
          `memory_retrieval_cue_option_${hashAgentRunValue({
            version:
              worldSimulationMemoryRetrievalProcessV3Version,
            query_id:
              query.query_id,
            step_index:
              stepIndex,
            source_memory_ref:
              memoryId,
            source_recovery_occurrence_id:
              groundingRecovery
                .occurrence
                .recovery_occurrence_id,
            source_cue_link_index:
              linkIndex,
            cue_identity:
              cueIdentity(
                link,
              ),
            source_cue_link_source:
              link.source
              ?? null,
          }).slice(0, 24)}`;

        result.push({
          cue_option_id:
            cueOptionId,
          cue: {
            kind:
              link.kind,
            value:
              cloneJson(
                link.value,
              ),
          },
          grounding: {
            source_memory_ref:
              memoryId,
            source_recovery_occurrence_id:
              groundingRecovery
                .occurrence
                .recovery_occurrence_id,
            source_fragment_id:
              groundingRecovery
                .recovered
                .fragment
                .fragment_id,
            source_cue_link_index:
              linkIndex,
            source_cue_link_source:
              link.source
              ?? null,
          },
        });
      },
    );
  }

  return result;
}

function selectReinstatedCues(
  control,
  availableOptions,
) {
  const byId =
    new Map(
      availableOptions.map(
        (option) => [
          option.cue_option_id,
          option,
        ],
      ),
    );

  const selected = [];
  const seen =
    new Set();

  for (
    const optionId
    of control
      .selected_reinstatement_cue_refs
  ) {
    if (
      seen.has(optionId)
    ) {
      continue;
    }

    const option =
      byId.get(
        optionId,
      );

    if (!option) {
      const error =
        new Error(
          `Selected reinstatement cue ${optionId} is not grounded in the completed retrieval step.`,
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_REINSTATED_CUE_SELECTION_INVALID";

      throw error;
    }

    seen.add(
      optionId,
    );

    selected.push(
      option,
    );
  }

  return {
    selected_options:
      selected,
    active_internal_cues:
      selected.map(
        (option) => ({
          kind:
            option.cue.kind,
          value:
            cloneJson(
              option.cue.value,
            ),
          source:
            "phase63c_internal_reinstatement",
        }),
      ),
  };
}

function baseActiveCues(
  accessibilityBaseInput,
) {
  return cloneJson(
    array(
      accessibilityBaseInput
        ?.retrieval_context
        ?.active_cues,
    ),
  );
}

function reevaluateFrontier({
  query,
  accessibilityBaseInput,
  memoryRecords,
  internalCues,
}) {
  const nextInput =
    cloneJson(
      accessibilityBaseInput,
    );

  nextInput.memory_records =
    cloneJson(
      memoryRecords,
    );

  nextInput.retrieval_context = {
    ...cloneJson(
      object(
        nextInput.retrieval_context,
      ),
    ),
    active_cues: [
      ...baseActiveCues(
        accessibilityBaseInput,
      ),
      ...cloneJson(
        internalCues,
      ),
    ],
  };

  const result =
    queryWorldSimulationMemoryAccessibility(
      nextInput,
    );

  const cueDiagnosticEvidenceProjection =
    projectWorldSimulationCueDiagnosticEvidence({
      memory_accessibility_query:
        result,
    });

  if (
    result.memory_accessibility_version
    !== query.phase63b_version
  ) {
    const error =
      new Error(
        "Phase63C v3 accessibility re-evaluation changed Phase63B version within one retrieval process.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_ACCESSIBILITY_VERSION_MISMATCH";

    throw error;
  }

  return canonicalFrontier(
    result.result,
    cueDiagnosticEvidenceProjection,
  );
}

function resolverAuditEntry(
  stage,
  stepIndex,
  input,
  output,
) {
  return {
    stage,
    step_index:
      stepIndex,
    input_hash:
      hashAgentRunValue(
        input,
      ),
    output_hash:
      hashAgentRunValue(
        output,
      ),
  };
}

async function callResolver(
  resolver,
  stage,
  stepIndex,
  input,
  audit,
) {
  const frozenInput =
    deepFreeze(
      cloneJson(
        input,
      ),
    );

  const raw =
    await resolver(
      cloneJson(
        frozenInput,
      ),
    );

  if (!isObject(raw)) {
    const error =
      new Error(
        `memoryRetrievalStageResolver must return an object for stage ${stage}.`,
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_STAGE_RESOLVER_INVALID_OUTPUT";

    throw error;
  }

  const output =
    cloneJson(
      raw,
    );

  audit.push(
    resolverAuditEntry(
      stage,
      stepIndex,
      frozenInput,
      output,
    ),
  );

  return output;
}

function retrievalExperience(
  processOccurred,
  initiation = null,
  targetOutcome = null,
  recoveredAnyContent = false,
) {
  return {
    process_occurred:
      processOccurred,
    initiation_mode:
      initiation?.mode
      ?? null,
    target_outcome:
      targetOutcome,
    recovered_any_content:
      recoveredAnyContent,
  };
}

const schemas =
  deepFreeze({
    memory_retrieval_query_v3: {
      type:
        "object",
      required: [
        "query_id",
        "character",
        "turn_id",
        "phase63b_version",
        "memory_snapshot",
        "accessibility_context",
        "initial_frontier",
      ],
    },
    retrieval_step_v3: {
      type:
        "object",
      required: [
        "step_index",
        "frontier",
        "contacted_candidate_refs",
        "recovered_fragments",
        "recovery_occurrences",
        "new_reinstatement_cue_options",
        "selected_reinstatement_cue_refs",
        "reinstated_cues",
        "step_target_relation",
        "cumulative_target_outcome_after_step",
        "continuation",
        "termination_after_step",
      ],
    },
  });

export function buildWorldSimulationMemoryRetrievalV3Schemas() {
  return cloneJson(
    schemas,
  );
}

export function buildWorldSimulationMemoryRetrievalProcessV3Contract() {
  return {
    version:
      worldSimulationMemoryRetrievalProcessV3Version,
    phase:
      "Phase63C Step 4",
    status:
      "multi_step_grounded_dynamic_frontier_runtime_installed",
    step3_single_step_kernel_reused_as_grounded_materialization_primitive:
      true,
    multi_step_retrieval_execution_installed:
      true,
    dynamic_candidate_frontier_installed:
      true,
    frozen_subjective_memory_snapshot_installed:
      true,
    candidate_frontier_is_process_wide_frozen_set:
      false,
    phase63b_is_cue_canonicalization_authority:
      true,
    phase63b_read_only_reevaluation_reused:
      true,
    phase64a_r4a_frontier_evidence_bound:
      true,
    phase64a_r4a_dynamic_frontier_evidence_recomputed:
      true,
    phase64a_r4a_selectivity_scalar_exposed_to_resolver:
      false,
    phase64a_r4a_candidate_membership_authority:
      false,
    phase64a_r4a_candidate_order_authority:
      false,
    phase64a_r4b1_retrieval_cue_orientation_evidence:
      buildWorldSimulationRetrievalCueOrientationContract(),
    phase64a_r4b1_new_resolver_stage_added:
      false,
    phase64a_r4b1_orientation_is_process_wide_baseline:
      true,
    phase64a_r4b1_attention_weight_modeled:
      false,
    phase64a_r4b1_candidate_membership_authority:
      false,
    phase64a_r4b1_candidate_order_authority:
      false,
    phase64a_r4b1_raw_engine_cues_exposed_at_initiation:
      false,
    phase64a_r4b1_candidate_competition_exposed_at_initiation:
      false,
    phase64a_r4b2_retrieval_cue_support_topology_evidence:
      buildWorldSimulationRetrievalCueSupportTopologyContract(),
    phase64a_r4b2_new_resolver_stage_added:
      false,
    phase64a_r4b2_initial_frontier_bound:
      true,
    phase64a_r4b2_dynamic_support_topology_recomputation:
      false,
    phase64a_r4b2_phase63c_reinstated_cues_included:
      false,
    phase64a_r4b2_retrieval_resolver_support_topology_exposed:
      false,
    phase64a_r4b2_candidate_membership_authority:
      false,
    phase64a_r4b2_candidate_order_authority:
      false,
    phase64a_r4b2_retrieval_contact_authority:
      false,
    phase64a_r4b2_retrieval_recovery_authority:
      false,
    phase64a_r4b2_full_support_topology_persisted:
      false,
    phase64a_r4b3_associative_activation_composition_evidence:
      buildWorldSimulationAssociativeActivationCompositionEvidenceContract(),
    phase64a_r4b3_new_resolver_stage_added:
      false,
    phase64a_r4b3_requires_explicit_r3_projection_input:
      true,
    phase64a_r4b3_initial_frontier_bound:
      true,
    phase64a_r4b3_dynamic_recomputation:
      false,
    phase64a_r4b3_phase63c_reinstated_cues_included:
      false,
    phase64a_r4b3_retrieval_resolver_evidence_exposed:
      false,
    phase64a_r4b3_candidate_membership_authority:
      false,
    phase64a_r4b3_candidate_order_authority:
      false,
    phase64a_r4b3_retrieval_contact_authority:
      false,
    phase64a_r4b3_retrieval_recovery_authority:
      false,
    phase64a_r4b3_scalar_associative_activation_modeled:
      false,
    phase64a_r4b3_full_evidence_persisted:
      false,
    phase64a_r4c_retrieval_competition_monitoring_evidence:
      buildWorldSimulationRetrievalCompetitionMonitoringEvidenceContract(),
    phase64a_r4c_new_resolver_stage_added:
      false,
    phase64a_r4c_initial_frontier_bound:
      true,
    phase64a_r4c_dynamic_recomputation:
      false,
    phase64a_r4c_phase63c_reinstated_cues_included:
      false,
    phase64a_r4c_retrieval_resolver_evidence_exposed:
      false,
    phase64a_r4c_candidate_membership_authority:
      false,
    phase64a_r4c_candidate_order_authority:
      false,
    phase64a_r4c_activation_rank_authority:
      false,
    phase64a_r4c_competition_winner_modeled:
      false,
    phase64a_r4c_retrieval_probability_modeled:
      false,
    phase64a_r4c_retrieval_contact_authority:
      false,
    phase64a_r4c_retrieval_recovery_authority:
      false,
    phase64a_r4c_search_control_authority:
      false,
    phase64a_r4c_full_probe_reports_persisted:
      false,
    phase64a_r4d_retrieval_search_control_readiness_evidence:
      buildWorldSimulationRetrievalSearchControlReadinessEvidenceContract(),
    phase64a_r4d_post_hoc_after_termination:
      true,
    phase64a_r4d_new_resolver_stage_added:
      false,
    phase64a_r4d_retrieval_resolver_evidence_exposed:
      false,
    phase64a_r4d_cue_epoch_basis:
      "contiguous_active_cue_hash",
    phase64a_r4d_technical_step_budget_used_as_cognitive_evidence:
      false,
    phase64a_r4d_cognitive_failure_threshold_modeled:
      false,
    phase64a_r4d_continuation_decision_authority:
      false,
    phase64a_r4d_cue_shift_selection_authority:
      false,
    phase64a_r4d_stop_decision_authority:
      false,
    phase64a_r4d_search_control_authority:
      false,
    phase64a_r4d_new_attempt_creation_authority:
      false,
    phase64a_r4d_retrieval_contact_authority:
      false,
    phase64a_r4d_retrieval_recovery_authority:
      false,
    phase64a_r4d_character_metacognition_modeled:
      false,
    phase64a_r4d_full_evidence_persisted:
      false,
    phase64a_r4e1_retrieval_cue_conditioned_episode_evidence:
      buildWorldSimulationRetrievalCueConditionedEpisodeEvidenceContract(),
    phase64a_r4e1_source_completed_step_prefix_required:
      true,
    phase64a_r4e1_explicit_process_termination_required:
      false,
    phase64a_r4e1_cue_conditioned_episode_basis:
      "contiguous_canonical_active_cue_hash",
    phase64a_r4e1_same_cue_hash_after_intervening_episode_opens_new_episode:
      true,
    phase64a_r4e1_retrieval_attempt_ontology_claimed:
      false,
    phase64a_r4e1_cue_hash_change_claimed_as_new_retrieval_attempt:
      false,
    phase64a_r4e1_new_resolver_stage_added:
      false,
    phase64a_r4e1_retrieval_resolver_evidence_exposed:
      false,
    phase64a_r4e1_cue_selection_authority:
      false,
    phase64a_r4e1_continuation_decision_authority:
      false,
    phase64a_r4e1_stop_decision_authority:
      false,
    phase64a_r4e1_new_attempt_creation_authority:
      false,
    phase64a_r4e1_retrieval_contact_authority:
      false,
    phase64a_r4e1_retrieval_recovery_authority:
      false,
    phase64a_r4e1_character_subjective_awareness_modeled:
      false,
    phase64a_r4e1_full_evidence_persisted:
      false,
    internally_reinstated_is_cue_provenance_not_semantic_kind:
      true,
    resolver_authored_reinstated_cue_content_allowed:
      false,
    resolver_selects_grounded_cue_option_refs_only:
      true,
    recovery_occurrence_tracking_installed:
      true,
    cross_step_repeat_recovery_preserved:
      true,
    cumulative_target_outcome_installed:
      true,
    target_may_be_outside_initial_frontier:
      true,
    target_must_exist_in_frozen_memory_snapshot_when_grounded:
      true,
    future_frontier_content_visible_to_earlier_step_resolver:
      false,
    non_frontier_candidate_diagnostics_visible_to_resolver:
      false,
    staged_resolver_lifecycle: [
      "initiation",
      "recovery",
      "continuation",
    ],
    target_satisfaction_forces_termination:
      false,
    technical_step_budget_is_cognitive_stopping_rule:
      false,
    technical_step_budget_exhaustion_fails_closed:
      true,
    retrieval_event_persistence_installed:
      false,
    retrieval_history_mutation_installed:
      false,
    same_cycle_phase63b_history_feedback_allowed:
      false,
    retrieval_reinforcement_modeled:
      false,
    retrieval_induced_forgetting_modeled:
      false,
    reconsolidation_modeled:
      false,
    source_confusion_modeled:
      false,
    memory_content_rewrite_modeled:
      false,
    character_brain_receives_candidate_frontiers:
      false,
    character_brain_receives_reinstated_cue_engine_provenance:
      false,
    character_brain_memory_channel:
      "recovered_memories",
    character_brain_retrieval_experience_channel:
      "retrieval_experience",
    schemas:
      buildWorldSimulationMemoryRetrievalV3Schemas(),
  };
}

export function buildWorldSimulationMemoryRetrievalQueryV3(
  input = {},
) {
  const character =
    requiredString(
      input.character,
      "character",
    );

  const turnId =
    requiredString(
      input.turn_id,
      "turn_id",
    );

  const phase63bVersion =
    requiredString(
      input.phase63b_version,
      "phase63b_version",
    );

  const memoryRecords =
    cloneJson(
      array(
        input.memory_records,
      ),
    );

  const memoryIndex =
    buildMemoryIndex(
      memoryRecords,
    );

  const snapshotHash =
    hashAgentRunValue(
      memoryRecords,
    );

  const accessibilityBaseInput =
    cloneJson(
      object(
        input.accessibility_base_input,
      ),
    );

  accessibilityBaseInput.memory_records =
    cloneJson(
      memoryRecords,
    );

  const accessibilityContextHash =
    hashAgentRunValue(
      accessibilityBaseInput,
    );

  const suppliedAccessibilityVersion =
    optionalString(
      input.initial_accessibility_query
        ?.memory_accessibility_version,
    );

  if (
    suppliedAccessibilityVersion
    && suppliedAccessibilityVersion
    !== phase63bVersion
  ) {
    const error =
      new Error(
        "MemoryRetrievalQueryV3 phase63b_version does not match the supplied initial accessibility query.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_ACCESSIBILITY_VERSION_MISMATCH";

    throw error;
  }

  const initialAccessibilityResult =
    cloneJson(
      input.initial_accessibility_result
      ?? input.initial_accessibility_query
        ?.result
      ?? {},
    );

  const initialFrontier =
    canonicalFrontier(
      initialAccessibilityResult,
      input.initial_cue_diagnostic_projection,
    );

  for (
    const ref
    of initialFrontier.candidate_refs
  ) {
    if (
      !memoryIndex.has(
        ref.memory_id,
      )
    ) {
      const error =
        new Error(
          `Initial frontier references memory outside frozen snapshot: ${ref.memory_id}`,
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_INITIAL_FRONTIER_OUTSIDE_SNAPSHOT";

      throw error;
    }
  }

  const retrievalGoal =
    cloneJson(
      input.retrieval_goal
      ?? null,
    );

  const queryId =
    `memory_retrieval_query_v3_${hashAgentRunValue({
      version:
        worldSimulationMemoryRetrievalProcessV3Version,
      character,
      turn_id:
        turnId,
      phase63b_version:
        phase63bVersion,
      memory_snapshot_hash:
        snapshotHash,
      accessibility_context_hash:
        accessibilityContextHash,
      initial_frontier_id:
        initialFrontier.frontier_id,
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
    retrieval_goal:
      retrievalGoal,
    memory_snapshot: {
      snapshot_hash:
        snapshotHash,
      memory_count:
        memoryRecords.length,
      content_embedded:
        false,
      refs_embedded:
        false,
    },
    accessibility_context: {
      context_hash:
        accessibilityContextHash,
      model_mode:
        initialFrontier.model_mode,
    },
    initial_frontier:
      publicFrontier(
        initialFrontier,
      ),
    boundaries: {
      query_is_engine_side:
        true,
      query_embeds_full_memory_snapshot:
        false,
      query_embeds_non_frontier_memory_refs:
        false,
      initial_frontier_is_not_process_wide_candidate_set:
        true,
      cue_diagnostic_evidence_bound_to_frontier_identity:
        true,
      cue_diagnostic_selectivity_scalar_embedded:
        false,
      future_frontier_content_hidden:
        true,
      same_process_memory_snapshot_frozen:
        true,
      same_cycle_retrieval_history_feedback_allowed:
        false,
      query_mutates_persistent_memory:
        false,
    },
  });
}

export async function executeWorldSimulationMemoryRetrievalProcessV3(
  input = {},
) {
  const query =
    cloneJson(
      object(
        input.query,
      ),
    );

  if (
    !query.query_id
  ) {
    const error =
      new Error(
        "Phase63C v3 execution requires a MemoryRetrievalQueryV3.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_QUERY_REQUIRED";

    throw error;
  }

  const memoryRecords =
    cloneJson(
      array(
        input.memory_records,
      ),
    );

  const memoryIndex =
    assertMemorySnapshot(
      query,
      memoryRecords,
    );

  const initialAccessibilityResult =
    cloneJson(
      input.initial_accessibility_result
      ?? input.initial_accessibility_query
        ?.result
      ?? {},
    );

  let currentFrontier =
    assertInitialFrontier(
      query,
      initialAccessibilityResult,
      input.initial_cue_diagnostic_projection,
    );

  const accessibilityBaseInput =
    assertAccessibilityBaseContext(
      query,
      input.accessibility_base_input,
      memoryRecords,
    );

  const resolver =
    typeof input.resolver
    === "function"
      ? input.resolver
      : null;

  if (!resolver) {
    return deepFreeze({
      version:
        worldSimulationMemoryRetrievalProcessV3Version,
      process_occurred:
        false,
      retrieval_process:
        null,
      recovered_fragments: [],
      recovery_occurrences: [],
      recovered_memories: [],
      target_outcome:
        null,
      recovered_any_content:
        false,
      retrieval_experience:
        retrievalExperience(
          false,
        ),
      resolver_audit: [],
      engine_audit: {
        memory_snapshot_verified:
          true,
        accessibility_base_context_verified:
          true,
        initial_frontier_verified:
          true,
        missing_stage_resolver_means_no_process:
          true,
        multi_step_search_executed:
          false,
        internally_reinstated_cues_executed:
          false,
        world_state_mutated:
          false,
      },
    });
  }

  const resolverAudit = [];

  const cueOrientationOptionSet =
    buildWorldSimulationRetrievalCueOrientationOptions({
      query_id:
        query.query_id,
      source_frontier_id:
        currentFrontier.frontier_id,
      active_cues:
        currentFrontier.active_cues,
    });

  const cueOrientationResolverOptions =
    buildWorldSimulationRetrievalCueOrientationResolverOptions(
      cueOrientationOptionSet,
    );

  const initiationResolution =
    await callResolver(
      resolver,
      "initiation",
      null,
      {
        stage:
          "initiation",
        character:
          query.character,
        query:
          resolverInitiationQueryView(
            query,
            currentFrontier,
          ),
        initial_frontier:
          resolverInitiationFrontierView(
            currentFrontier,
          ),
        available_cue_orientation_options:
          cloneJson(
            cueOrientationResolverOptions,
          ),
        perception:
          cloneJson(
            input.perception
            ?? {},
          ),
        character_state:
          cloneJson(
            input.character_state
            ?? {},
          ),
        boundaries: {
          candidate_content_visible_at_initiation:
            false,
          non_frontier_memory_refs_visible:
            false,
          world_state_visible:
            false,
          full_world_event_visible:
            false,
          raw_active_cues_visible:
            false,
          candidate_competition_visible:
            false,
          r4a_diagnosticity_visible:
            false,
          engine_cue_identity_visible:
            false,
          cue_orientation_options_are_kernel_grounded:
            true,
        },
      },
      resolverAudit,
    );

  if (
    initiationResolution
      .process_occurred
    !== true
  ) {
    return deepFreeze({
      version:
        worldSimulationMemoryRetrievalProcessV3Version,
      process_occurred:
        false,
      retrieval_process:
        null,
      recovered_fragments: [],
      recovery_occurrences: [],
      recovered_memories: [],
      target_outcome:
        null,
      recovered_any_content:
        false,
      retrieval_experience:
        retrievalExperience(
          false,
        ),
      resolver_audit:
        resolverAudit,
      engine_audit: {
        memory_snapshot_verified:
          true,
        accessibility_base_context_verified:
          true,
        initial_frontier_verified:
          true,
        explicit_initiation_resolution_used:
          true,
        no_process_is_not_failed_retrieval:
          true,
        multi_step_search_executed:
          false,
        internally_reinstated_cues_executed:
          false,
        world_state_mutated:
          false,
      },
    });
  }

  const technicalStepBudget =
    positiveInteger(
      input.technical_step_budget,
      "technical_step_budget",
    );

  const initiation =
    normalizeInitiation(
      initiationResolution.initiation,
    );

  const cueOrientationEvidence =
    materializeWorldSimulationRetrievalCueOrientationEvidence({
      query_id:
        query.query_id,
      source_frontier_id:
        currentFrontier.frontier_id,
      initiation,
      resolution:
        initiationResolution
          .cue_orientation_resolution
        ?? null,
      option_set:
        cueOrientationOptionSet,
    });

  const cueOrientationCharacterView =
    buildWorldSimulationRetrievalCueOrientationCharacterView(
      cueOrientationEvidence,
    );

  const cueSupportTopologyEvidence =
    input.initial_cue_diagnostic_projection
      ?.applicable
    === true
      ? projectWorldSimulationRetrievalCueSupportTopologyEvidence({
        query_id:
          query.query_id,
        source_initial_frontier:
          publicFrontier(
            currentFrontier,
          ),
        cue_orientation_evidence:
          cueOrientationEvidence,
        cue_diagnostic_projection:
          input.initial_cue_diagnostic_projection,
      })
      : null;

  const associativeActivationCompositionEvidence =
    cueSupportTopologyEvidence
    && input.initial_base_level_activation_projection
      ? projectWorldSimulationAssociativeActivationCompositionEvidence({
        query_id:
          query.query_id,
        character:
          query.character,
        turn_id:
          query.turn_id,
        base_level_activation_projection:
          input.initial_base_level_activation_projection,
        cue_diagnostic_projection:
          input.initial_cue_diagnostic_projection,
        cue_support_topology_evidence:
          cueSupportTopologyEvidence,
      })
      : null;

  const retrievalCompetitionMonitoringEvidence =
    associativeActivationCompositionEvidence
      ? projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
        query_id:
          query.query_id,
        associative_activation_composition_evidence:
          associativeActivationCompositionEvidence,
      })
      : null;

  const retrievalTask =
    normalizeRetrievalTask(
      initiationResolution.retrieval_task,
    );

  const targetValue =
    Object.hasOwn(
      initiationResolution,
      "target",
    )
      ? initiationResolution.target
      : initiation.mode
        === "spontaneous"
        ? null
        : query.retrieval_goal;

  const target =
    normalizeTarget(
      targetValue,
    );

  if (
    target.grounded
    && !memoryIndex.has(
      target.memory_id,
    )
  ) {
    const error =
      new Error(
        `Grounded retrieval target ${target.memory_id} is outside the frozen subjective-memory snapshot.`,
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_OUTSIDE_SNAPSHOT";

    throw error;
  }

  const steps = [];
  const allOccurrences = [];
  const recoveredUniqueByIdentity =
    new Map();

  const availableCueOptionsById =
    new Map();

  let termination =
    null;

  let selectedInternalCues = [];
  let selectedInternalCueCount = 0;

  for (
    let stepIndex = 0;
    stepIndex < technicalStepBudget;
    stepIndex += 1
  ) {
    const targetOutcomeBeforeStep =
      classifyTargetOutcome(
        target,
        [
          ...recoveredUniqueByIdentity
            .values(),
        ],
      );

    const recoveryResolution =
      await callResolver(
        resolver,
        "recovery",
        stepIndex,
        {
          stage:
            "recovery",
          character:
            query.character,
          query_id:
            query.query_id,
          process: {
            initiation:
              cloneJson(
                initiation,
              ),
            retrieval_task:
              cloneJson(
                retrievalTask,
              ),
            target:
              cloneJson(
                target.value,
              ),
            cue_orientation:
              cloneJson(
                cueOrientationCharacterView,
              ),
            step_index:
              stepIndex,
            target_outcome_so_far:
              targetOutcomeBeforeStep,
          },
          current_frontier:
            resolverFrontierView(
              currentFrontier,
              true,
            ),
          recovered_memories_so_far:
            [
              ...recoveredUniqueByIdentity
                .values(),
            ]
              .map(
                (item) =>
                  cloneJson(
                    item.character_view,
                  ),
              ),
          perception:
            cloneJson(
              input.perception
              ?? {},
            ),
          character_state:
            cloneJson(
              input.character_state
              ?? {},
            ),
          boundaries: {
            only_current_frontier_content_visible:
              true,
            non_frontier_candidate_diagnostics_visible:
              false,
            full_memory_cue_links_visible:
              false,
            resolver_may_author_recovered_content:
              false,
          },
        },
        resolverAudit,
      );

    assertWorldSimulationRetrievalCueOrientationStageBoundary(
      "recovery",
      recoveryResolution,
    );

    const stepMaterialization =
      materializeStepRecovery({
        query,
        frontier:
          currentFrontier,
        initiation,
        retrievalTask,
        target,
        recoveryResolution,
      });

    const recoveredThisStep =
      stepMaterialization.recovered;

    const occurrences =
      buildRecoveryOccurrences(
        query,
        stepIndex,
        recoveredThisStep,
      );

    allOccurrences.push(
      ...occurrences,
    );

    recoveredThisStep.forEach(
      (item) => {
        const identity =
          uniqueRecoveryIdentity(
            item,
          );

        if (
          !recoveredUniqueByIdentity
            .has(identity)
        ) {
          recoveredUniqueByIdentity.set(
            identity,
            item,
          );
        }
      },
    );

    const cumulativeRecovered =
      [
        ...recoveredUniqueByIdentity
          .values(),
      ];

    const cumulativeTargetOutcome =
      classifyTargetOutcome(
        target,
        cumulativeRecovered,
      );

    const newCueOptions =
      cueOptionsForStep({
        query,
        stepIndex,
        recovered:
          recoveredThisStep,
        occurrences,
        memoryIndex,
      });

    for (const option of newCueOptions) {
      if (
        !availableCueOptionsById
          .has(option.cue_option_id)
      ) {
        availableCueOptionsById.set(
          option.cue_option_id,
          option,
        );
      }
    }

    const availableCueOptions =
      [
        ...availableCueOptionsById
          .values(),
      ];

    const continuationResolution =
      await callResolver(
        resolver,
        "continuation",
        stepIndex,
        {
          stage:
            "continuation",
          character:
            query.character,
          query_id:
            query.query_id,
          process: {
            initiation:
              cloneJson(
                initiation,
              ),
            retrieval_task:
              cloneJson(
                retrievalTask,
              ),
            target:
              cloneJson(
                target.value,
              ),
            cue_orientation:
              cloneJson(
                cueOrientationCharacterView,
              ),
            step_index:
              stepIndex,
            target_outcome_so_far:
              cumulativeTargetOutcome,
          },
          this_step: {
            recovered_memories:
              recoveredThisStep.map(
                (item) =>
                  cloneJson(
                    item.character_view,
                  ),
              ),
            recovery_occurrences:
              cloneJson(
                occurrences,
              ),
          },
          recovered_memories_so_far:
            cumulativeRecovered.map(
              (item) =>
                cloneJson(
                  item.character_view,
                ),
            ),
          available_reinstatement_cues:
            cloneJson(
              availableCueOptions,
            ),
          perception:
            cloneJson(
              input.perception
              ?? {},
            ),
          character_state:
            cloneJson(
              input.character_state
              ?? {},
            ),
          boundaries: {
            cue_options_are_kernel_grounded:
              true,
            resolver_may_author_cue_kind_or_value:
              false,
            target_satisfaction_forces_stop:
              false,
          },
        },
        resolverAudit,
      );

    assertWorldSimulationRetrievalCueOrientationStageBoundary(
      "continuation",
      continuationResolution,
    );

    const control =
      normalizeControl(
        continuationResolution,
      );

    if (
      control.control_action
      === "stop"
      && control
        .selected_reinstatement_cue_refs
        .length
    ) {
      const error =
        new Error(
          "A stopping retrieval step may not activate cues for a nonexistent next step.",
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_REINSTATED_CUE_SELECTION_INVALID";

      throw error;
    }

    const selected =
      selectReinstatedCues(
        control,
        availableCueOptions,
      );

    const stepRecord = {
      step_index:
        stepIndex,
      frontier:
        publicFrontier(
          currentFrontier,
        ),
      contacted_candidate_refs:
        cloneJson(
          stepMaterialization
            .contacted_candidate_refs,
        ),
      recovered_fragments:
        recoveredThisStep.map(
          (item) =>
            cloneJson(
              item.fragment,
            ),
        ),
      recovery_occurrences:
        cloneJson(
          occurrences,
        ),
      new_reinstatement_cue_options:
        cloneJson(
          newCueOptions,
        ),
      selected_reinstatement_cue_refs:
        selected.selected_options
          .map(
            (option) =>
              option.cue_option_id,
          ),
      reinstated_cues:
        cloneJson(
          selected.active_internal_cues,
        ),
      step_target_relation:
        stepTargetRelation(
          recoveredThisStep,
        ),
      cumulative_target_outcome_after_step:
        cumulativeTargetOutcome,
      continuation: {
        control_action:
          control.control_action,
        control_reason:
          control.control_reason,
        next_step_created:
          control.control_action
          === "continue",
      },
      termination_after_step:
        control.control_action
        === "stop",
    };

    steps.push(
      stepRecord,
    );

    if (
      control.control_action
      === "stop"
    ) {
      termination = {
        reason:
          control.control_reason
          ?? "resolver_stop",
        step_index:
          stepIndex,
        cognitive_control_stop:
          true,
        technical_step_limit_reached:
          false,
      };

      break;
    }

    if (
      stepIndex + 1
      >= technicalStepBudget
    ) {
      const error =
        new Error(
          "Phase63C v3 technical step budget exhausted while retrieval control requested continuation.",
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_STEP_BUDGET_EXHAUSTED";

      error.technical_step_budget =
        technicalStepBudget;

      error.completed_step_count =
        steps.length;

      throw error;
    }

    if (
      selected.active_internal_cues.length
      && currentFrontier.model_mode
      !== "cue_dependent_v2"
    ) {
      const error =
        new Error(
          "Internally reinstated cue-driven dynamic frontier re-evaluation requires Phase63B cue_dependent_v2.",
        );

      error.code =
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_DYNAMIC_FRONTIER_REQUIRES_PHASE63B_NATIVE_V2";

      throw error;
    }

    selectedInternalCues =
      cloneJson(
        selected.active_internal_cues,
      );

    selectedInternalCueCount +=
      selectedInternalCues.length;

    currentFrontier =
      reevaluateFrontier({
        query,
        accessibilityBaseInput,
        memoryRecords,
        internalCues:
          selectedInternalCues,
      });
  }

  if (!termination) {
    const error =
      new Error(
        "Phase63C v3 retrieval process ended without an explicit cognitive-control stop.",
      );

    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_PROCESS_UNTERMINATED";

    throw error;
  }

  const retrievalCueConditionedEpisodeEvidence =
    projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
      query_id:
        query.query_id,
      source_initial_frontier:
        query.initial_frontier,
      initiation,
      search_steps:
        steps,
    });

  const retrievalSearchControlReadinessEvidence =
    projectWorldSimulationRetrievalSearchControlReadinessEvidence({
      query_id:
        query.query_id,
      source_initial_frontier:
        query.initial_frontier,
      search_steps:
        steps,
      termination,
      initial_retrieval_competition_monitoring_evidence:
        retrievalCompetitionMonitoringEvidence,
    });

  const recoveredUnique =
    [
      ...recoveredUniqueByIdentity
        .values(),
    ];

  const targetOutcome =
    classifyTargetOutcome(
      target,
      recoveredUnique,
    );

  const retrievalProcessId =
    `memory_retrieval_process_v3_${hashAgentRunValue({
      version:
        worldSimulationMemoryRetrievalProcessV3Version,
      query_id:
        query.query_id,
      initiation,
      retrieval_task:
        retrievalTask,
      target:
        target.value,
      cue_orientation_evidence_hash:
        cueOrientationEvidence.evidence_hash,
      cue_support_topology_evidence_hash:
        cueSupportTopologyEvidence
          ?.evidence_hash
        ?? null,
      associative_activation_composition_evidence_hash:
        associativeActivationCompositionEvidence
          ?.evidence_hash
        ?? null,
      retrieval_competition_monitoring_evidence_hash:
        retrievalCompetitionMonitoringEvidence
          ?.evidence_hash
        ?? null,
      retrieval_cue_conditioned_episode_evidence_hash:
        retrievalCueConditionedEpisodeEvidence
          .evidence_hash,
      retrieval_search_control_readiness_evidence_hash:
        retrievalSearchControlReadinessEvidence
          .evidence_hash,
      step_hashes:
        steps.map(
          (step) =>
            hashAgentRunValue(
              step,
            ),
        ),
      termination,
    }).slice(0, 24)}`;

  const retrievalProcess = {
    retrieval_process_id:
      retrievalProcessId,
    query_id:
      query.query_id,
    character:
      query.character,
    turn_id:
      query.turn_id,
    initiation,
    retrieval_task:
      retrievalTask,
    target:
      cloneJson(
        target.value,
      ),
    search_orientation:
      cloneJson(
        cueOrientationEvidence,
      ),
    initial_cue_support_topology_evidence_hash:
      cueSupportTopologyEvidence
        ?.evidence_hash
      ?? null,
    initial_associative_activation_composition_evidence_hash:
      associativeActivationCompositionEvidence
        ?.evidence_hash
      ?? null,
    initial_retrieval_competition_monitoring_evidence_hash:
      retrievalCompetitionMonitoringEvidence
        ?.evidence_hash
      ?? null,
    retrieval_cue_conditioned_episode_evidence_hash:
      retrievalCueConditionedEpisodeEvidence
        .evidence_hash,
    retrieval_search_control_readiness_evidence_hash:
      retrievalSearchControlReadinessEvidence
        .evidence_hash,
    frozen_memory_snapshot: {
      phase63b_version:
        query.phase63b_version,
      snapshot_hash:
        query.memory_snapshot
          .snapshot_hash,
      memory_count:
        query.memory_snapshot
          .memory_count,
    },
    initial_frontier:
      cloneJson(
        query.initial_frontier,
      ),
    steps:
      cloneJson(
        steps,
      ),
    termination:
      cloneJson(
        termination,
      ),
  };

  const recoveredAnyContent =
    recoveredUnique.length > 0;

  return deepFreeze({
    version:
      worldSimulationMemoryRetrievalProcessV3Version,
    process_occurred:
      true,
    retrieval_process:
      retrievalProcess,
    initial_cue_support_topology_evidence:
      cueSupportTopologyEvidence
        ? cloneJson(cueSupportTopologyEvidence)
        : null,
    initial_associative_activation_composition_evidence:
      associativeActivationCompositionEvidence
        ? cloneJson(associativeActivationCompositionEvidence)
        : null,
    initial_retrieval_competition_monitoring_evidence:
      retrievalCompetitionMonitoringEvidence
        ? cloneJson(retrievalCompetitionMonitoringEvidence)
        : null,
    retrieval_cue_conditioned_episode_evidence:
      cloneJson(
        retrievalCueConditionedEpisodeEvidence,
      ),
    retrieval_search_control_readiness_evidence:
      cloneJson(
        retrievalSearchControlReadinessEvidence,
      ),
    recovered_fragments:
      recoveredUnique.map(
        (item) =>
          cloneJson(
            item.fragment,
          ),
      ),
    recovery_occurrences:
      cloneJson(
        allOccurrences,
      ),
    recovered_memories:
      recoveredUnique.map(
        (item) =>
          cloneJson(
            item.character_view,
          ),
      ),
    target_outcome:
      targetOutcome,
    recovered_any_content:
      recoveredAnyContent,
    retrieval_experience:
      retrievalExperience(
        true,
        initiation,
        targetOutcome,
        recoveredAnyContent,
      ),
    resolver_audit:
      cloneJson(
        resolverAudit,
      ),
    engine_audit: {
      memory_snapshot_verified:
        true,
      accessibility_base_context_verified:
        true,
      initial_frontier_verified:
        true,
      cue_diagnostic_frontier_evidence_bound:
        Boolean(
          query.initial_frontier
            ?.cue_diagnostic_projection
            ?.projection_id,
        ),
      cue_diagnostic_dynamic_frontier_recomputation_enabled:
        true,
      cue_diagnostic_selectivity_scalar_exposed_to_resolver:
        false,
      retrieval_cue_orientation_evidence_materialized:
        true,
      retrieval_cue_orientation_is_process_wide_baseline:
        true,
      retrieval_cue_orientation_attention_weight_modeled:
        false,
      retrieval_cue_orientation_changed_candidate_membership:
        false,
      retrieval_cue_orientation_changed_candidate_order:
        false,
      retrieval_cue_orientation_changed_retrieval_contact:
        false,
      retrieval_cue_orientation_raw_engine_cues_exposed_at_initiation:
        false,
      retrieval_cue_orientation_candidate_competition_exposed_at_initiation:
        false,
      retrieval_cue_support_topology_evidence_materialized:
        Boolean(
          cueSupportTopologyEvidence,
        ),
      retrieval_cue_support_topology_initial_frontier_bound:
        Boolean(
          cueSupportTopologyEvidence,
        ),
      retrieval_cue_support_topology_exposed_to_resolver:
        false,
      retrieval_cue_support_topology_dynamic_recomputation_used:
        false,
      retrieval_cue_support_topology_reinstated_cues_included:
        false,
      retrieval_cue_support_topology_full_evidence_persisted:
        false,
      associative_activation_composition_evidence_materialized:
        Boolean(
          associativeActivationCompositionEvidence,
        ),
      associative_activation_composition_source_r3_projection_supplied:
        Boolean(
          input.initial_base_level_activation_projection,
        ),
      associative_activation_composition_initial_frontier_bound:
        Boolean(
          associativeActivationCompositionEvidence,
        ),
      associative_activation_composition_exposed_to_resolver:
        false,
      associative_activation_composition_dynamic_recomputation_used:
        false,
      associative_activation_composition_reinstated_cues_included:
        false,
      associative_activation_composition_scalar_activation_modeled:
        false,
      associative_activation_composition_full_evidence_persisted:
        false,
      retrieval_competition_monitoring_evidence_materialized:
        Boolean(
          retrievalCompetitionMonitoringEvidence,
        ),
      retrieval_competition_monitoring_source_r4b3_evidence_supplied:
        Boolean(
          associativeActivationCompositionEvidence,
        ),
      retrieval_competition_monitoring_initial_frontier_bound:
        Boolean(
          retrievalCompetitionMonitoringEvidence,
        ),
      retrieval_competition_monitoring_evidence_exposed_to_resolver:
        false,
      retrieval_competition_monitoring_candidate_probe_reports_materialized:
        false,
      retrieval_competition_monitoring_exhaustive_pairwise_matrix_materialized:
        false,
      retrieval_competition_monitoring_dynamic_recomputation_used:
        false,
      retrieval_competition_monitoring_reinstated_cues_included:
        false,
      retrieval_competition_monitoring_competition_winner_modeled:
        false,
      retrieval_competition_monitoring_retrieval_probability_modeled:
        false,
      retrieval_competition_monitoring_retrieval_contact_authority:
        false,
      retrieval_competition_monitoring_retrieval_recovery_authority:
        false,
      retrieval_competition_monitoring_search_control_authority:
        false,
      retrieval_competition_monitoring_full_evidence_persisted:
        false,
      retrieval_cue_conditioned_episode_evidence_materialized:
        true,
      retrieval_cue_conditioned_episode_runtime_materialization_post_hoc_after_termination:
        true,
      retrieval_cue_conditioned_episode_count:
        retrievalCueConditionedEpisodeEvidence
          .observation
          .cue_conditioned_episode_count,
      retrieval_cue_conditioned_episode_transition_count:
        retrievalCueConditionedEpisodeEvidence
          .observation
          .cue_transition_count,
      retrieval_cue_conditioned_episode_evidence_exposed_to_resolver:
        false,
      retrieval_cue_conditioned_episode_retrieval_attempt_ontology_claimed:
        false,
      retrieval_cue_conditioned_episode_cue_hash_change_claimed_as_new_retrieval_attempt:
        false,
      retrieval_cue_conditioned_episode_cue_selection_authority:
        false,
      retrieval_cue_conditioned_episode_continuation_decision_authority:
        false,
      retrieval_cue_conditioned_episode_stop_decision_authority:
        false,
      retrieval_cue_conditioned_episode_new_attempt_creation_authority:
        false,
      retrieval_cue_conditioned_episode_retrieval_contact_authority:
        false,
      retrieval_cue_conditioned_episode_retrieval_recovery_authority:
        false,
      retrieval_cue_conditioned_episode_character_subjective_awareness_modeled:
        false,
      retrieval_cue_conditioned_episode_full_evidence_persisted:
        false,
      retrieval_search_control_readiness_evidence_materialized:
        true,
      retrieval_search_control_readiness_post_hoc_after_termination:
        true,
      retrieval_search_control_readiness_source_r4c_supplied:
        Boolean(
          retrievalCompetitionMonitoringEvidence,
        ),
      retrieval_search_control_readiness_cue_epoch_count:
        retrievalSearchControlReadinessEvidence
          .observation
          .cue_epoch_count,
      retrieval_search_control_readiness_evidence_exposed_to_resolver:
        false,
      retrieval_search_control_readiness_technical_budget_used_as_cognitive_evidence:
        false,
      retrieval_search_control_readiness_sam_failure_semantics_claimed:
        false,
      retrieval_search_control_readiness_cognitive_failure_threshold_modeled:
        false,
      retrieval_search_control_readiness_retrieval_cost_benefit_modeled:
        false,
      retrieval_search_control_readiness_retrieval_latency_modeled:
        false,
      retrieval_search_control_readiness_feeling_of_knowing_modeled:
        false,
      retrieval_search_control_readiness_competitor_inhibition_modeled:
        false,
      retrieval_search_control_readiness_search_control_authority:
        false,
      retrieval_search_control_readiness_cue_shift_selection_authority:
        false,
      retrieval_search_control_readiness_stop_decision_authority:
        false,
      retrieval_search_control_readiness_new_attempt_creation_authority:
        false,
      retrieval_search_control_readiness_retrieval_contact_authority:
        false,
      retrieval_search_control_readiness_retrieval_recovery_authority:
        false,
      retrieval_search_control_readiness_character_metacognition_modeled:
        false,
      retrieval_search_control_readiness_full_evidence_persisted:
        false,
      retrieval_step_count:
        steps.length,
      recovery_occurrence_count:
        allOccurrences.length,
      unique_recovered_fragment_count:
        recoveredUnique.length,
      dynamic_frontier_reevaluation_count:
        Math.max(
          0,
          steps.length - 1,
        ),
      selected_internal_cue_count:
        selectedInternalCueCount,
      internally_reinstated_cues_executed:
        selectedInternalCueCount > 0,
      future_frontier_content_exposed_to_earlier_resolver:
        false,
      non_frontier_candidate_diagnostics_exposed_to_resolver:
        false,
      resolver_authored_recovered_content_accepted:
        false,
      resolver_authored_reinstated_cue_content_accepted:
        false,
      technical_step_budget:
        technicalStepBudget,
      technical_step_budget_used_as_cognitive_stop:
        false,
      same_cycle_retrieval_history_feedback_used:
        false,
      retrieval_event_persisted:
        false,
      retrieval_history_mutated:
        false,
      reinforcement_applied:
        false,
      competitor_debuff_applied:
        false,
      reconsolidation_applied:
        false,
      world_state_mutated:
        false,
    },
  });
}
