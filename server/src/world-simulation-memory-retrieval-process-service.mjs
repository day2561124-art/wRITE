import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationMemoryRetrievalProcessVersion = "phase63c-memory-retrieval-process-v2";

export const memoryRetrievalInitiationModes = Object.freeze(["deliberate", "spontaneous"]);
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

const initiationModeSet = new Set(memoryRetrievalInitiationModes);
const triggerOriginSet = new Set(memoryRetrievalTriggerOrigins);
const taskModeSet = new Set(memoryRetrievalTaskModes);
const targetRelationSet = new Set(memoryRetrievalTargetRelations);
const contentKindSet = new Set(memoryRetrievalContentKinds);

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
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_QUERY_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function memoryIdFor(record, label) {
  if (!isObject(record)) {
    const error = new Error(`${label} must be an object.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_INVALID";
    throw error;
  }
  const memoryId = String(record.memory_id ?? record.id ?? "").trim();
  if (memoryId) return memoryId;
  const error = new Error(`${label}.memory_id is required.`);
  error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_ID_REQUIRED";
  throw error;
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
      query_id: { type: "string" },
      character: { type: "string" },
      turn_id: { type: "string" },
      phase63b_version: { type: "string" },
      candidate_set_hash: { type: "string" },
      candidate_count: { type: "integer", minimum: 0 },
      initial_cues: { type: "array" },
      retrieval_goal: { type: ["object", "string", "number", "boolean", "null"] },
      candidate_refs: {
        type: "array",
        items: {
          type: "object",
          required: ["memory_id", "candidate_index"],
          properties: {
            memory_id: { type: "string" },
            candidate_index: { type: "integer", minimum: 0 },
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
      "termination",
    ],
    properties: {
      retrieval_process_id: { type: "string" },
      query_id: { type: "string" },
      character: { type: "string" },
      turn_id: { type: "string" },
      initiation: {
        type: "object",
        required: ["mode"],
        properties: {
          mode: { type: "string", enum: memoryRetrievalInitiationModes },
          trigger_origin: { type: "string", enum: memoryRetrievalTriggerOrigins },
        },
      },
      retrieval_task: {
        type: "object",
        required: ["mode"],
        properties: {
          mode: { type: "string", enum: memoryRetrievalTaskModes },
        },
      },
      target: { type: ["object", "string", "number", "boolean", "null"] },
      initial_cues: { type: "array" },
      frozen_candidate_set: {
        type: "object",
        required: ["phase63b_version", "candidate_set_hash", "candidate_count"],
      },
      steps: { type: "array" },
      termination: { type: "object" },
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
      step_index: { type: "integer", minimum: 0 },
      active_cues: { type: "array" },
      contacted_candidate_refs: { type: "array" },
      recovered_fragments: { type: "array" },
      reinstated_cues: { type: "array" },
      target_relation: { type: "string", enum: memoryRetrievalTargetRelations },
      termination_after_step: { type: "boolean" },
    },
  },
  recovered_fragment: {
    type: "object",
    required: [
      "fragment_id",
      "source_memory_ref",
      "content",
      "content_kind",
      "target_relation",
      "content_grounding",
    ],
    properties: {
      fragment_id: { type: "string" },
      source_memory_ref: { type: "string" },
      content: {},
      content_kind: { type: "string", enum: memoryRetrievalContentKinds },
      target_relation: { type: "string", enum: memoryRetrievalTargetRelations },
      content_grounding: { type: "object" },
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
      retrieval_event_id: { type: "string" },
      retrieval_process_id: { type: "string" },
      character: { type: "string" },
      turn_id: { type: "string" },
      occurred_at: { type: ["string", "number", "null"] },
      initiation: { type: "object" },
      retrieval_task: { type: "object" },
      target: { type: ["object", "string", "number", "boolean", "null"] },
      initial_cues: { type: "array" },
      search_steps: { type: "array" },
      recovered_memory_refs: { type: "array" },
      recovered_content: { type: "array" },
      target_outcome: { type: "string", enum: memoryRetrievalTargetOutcomes },
      recovered_any_content: { type: "boolean" },
      termination: { type: "object" },
      engine_audit: { type: "object" },
      immutable: { const: true },
    },
  },
  retrieval_history_reference: {
    type: "object",
    required: ["retrieval_event_id", "role"],
    properties: {
      retrieval_event_id: { type: "string" },
      role: { type: "string", enum: memoryRetrievalHistoryRoles },
    },
  },
});

function candidateReference(record, candidateIndex) {
  return {
    memory_id: memoryIdFor(record, `candidate_memory_records[${candidateIndex}]`),
    candidate_index: candidateIndex,
  };
}

function buildCandidateIndex(candidateRecords) {
  const refs = [];
  const byId = new Map();
  candidateRecords.forEach((record, candidateIndex) => {
    const ref = candidateReference(record, candidateIndex);
    if (byId.has(ref.memory_id)) {
      const error = new Error(`Duplicate candidate memory_id: ${ref.memory_id}`);
      error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_DUPLICATE";
      throw error;
    }
    refs.push(ref);
    byId.set(ref.memory_id, { record, ref });
  });
  return { refs, by_id: byId };
}

function assertFrozenCandidateSet(query, candidateRecords) {
  const candidateIndex = buildCandidateIndex(candidateRecords);
  const candidateSetHash = hashAgentRunValue(cloneJson(candidateRecords));
  if (candidateSetHash !== query.candidate_set_hash) {
    const error = new Error(
      "Phase63C candidate snapshot no longer matches the frozen retrieval query.",
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_SET_MISMATCH";
    throw error;
  }
  if (
    candidateRecords.length !== query.candidate_count
    || JSON.stringify(candidateIndex.refs) !== JSON.stringify(query.candidate_refs)
  ) {
    const error = new Error(
      "Phase63C candidate refs no longer match the frozen retrieval query.",
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CANDIDATE_REFS_MISMATCH";
    throw error;
  }
  return candidateIndex;
}

function normalizeInitiation(raw) {
  const source = isObject(raw) ? raw : {};
  const mode = optionalString(source.mode);
  if (!initiationModeSet.has(mode)) {
    const error = new Error(
      "retrieval resolution initiation.mode must be deliberate or spontaneous.",
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_INITIATION_INVALID";
    throw error;
  }
  const triggerOrigin = optionalString(source.trigger_origin) ?? "unspecified";
  if (!triggerOriginSet.has(triggerOrigin)) {
    const error = new Error(`Unsupported retrieval trigger_origin: ${triggerOrigin}`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_TRIGGER_ORIGIN_INVALID";
    throw error;
  }
  return { mode, trigger_origin: triggerOrigin };
}

function normalizeRetrievalTask(raw) {
  const mode = optionalString(isObject(raw) ? raw.mode : null) ?? "unspecified";
  if (!taskModeSet.has(mode)) {
    const error = new Error(`Unsupported retrieval task mode: ${mode}`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_TASK_INVALID";
    throw error;
  }
  return { mode };
}

function normalizeCandidateRef(raw, label, candidateIndex) {
  const memoryId = typeof raw === "string"
    ? raw.trim()
    : String(raw?.memory_id ?? raw?.id ?? "").trim();
  if (!memoryId) {
    const error = new Error(`${label} must identify one candidate memory.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CONTACT_INVALID";
    throw error;
  }
  const candidate = candidateIndex.by_id.get(memoryId);
  if (!candidate) {
    const error = new Error(`${label} references non-candidate memory ${memoryId}.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_NON_CANDIDATE_REFERENCE";
    throw error;
  }
  return cloneJson(candidate.ref);
}

function normalizeContactedRefs(values, candidateIndex) {
  const ids = new Set();
  const refs = [];
  array(values).forEach((raw, index) => {
    const ref = normalizeCandidateRef(
      raw,
      `contacted_candidate_refs[${index}]`,
      candidateIndex,
    );
    if (ids.has(ref.memory_id)) return;
    ids.add(ref.memory_id);
    refs.push(ref);
  });
  return { refs, ids };
}

function decodeJsonPointerToken(token) {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function materializeJsonPointer(value, path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    const error = new Error("json_pointer selector.path must start with '/'.");
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID";
    throw error;
  }
  const tokens = path.slice(1).split("/").map(decodeJsonPointerToken);
  let current = value;
  for (const token of tokens) {
    if (["__proto__", "prototype", "constructor"].includes(token)) {
      const error = new Error(`Unsafe JSON pointer token in ${path}.`);
      error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID";
      throw error;
    }
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/u.test(token) || Number(token) >= current.length) {
        const error = new Error(`JSON pointer ${path} is outside the source memory content.`);
        error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_NOT_FOUND";
        throw error;
      }
      current = current[Number(token)];
      continue;
    }
    if (!isObject(current) || !Object.hasOwn(current, token)) {
      const error = new Error(`JSON pointer ${path} is not grounded in source memory content.`);
      error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_NOT_FOUND";
      throw error;
    }
    current = current[token];
  }
  return cloneJson(current);
}

function memoryContent(record) {
  if (Object.hasOwn(record, "content")) return record.content;
  if (Object.hasOwn(record, "memory")) return record.memory;
  if (Object.hasOwn(record, "summary")) return record.summary;
  return null;
}

function normalizeSelector(raw) {
  if (raw === null || raw === undefined) return { kind: "whole_content" };
  if (!isObject(raw)) {
    const error = new Error("recovered selection selector must be an object when present.");
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID";
    throw error;
  }
  const kind = optionalString(raw.kind);
  if (kind === "whole_content") return { kind };
  if (kind === "json_pointer") {
    return {
      kind,
      path: requiredString(
        raw.path,
        "selector.path",
        "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID",
      ),
    };
  }
  const error = new Error(`Unsupported recovered-content selector kind: ${kind ?? "missing"}.`);
  error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SELECTOR_INVALID";
  throw error;
}

function selectorIdentity(selector) {
  return selector.kind === "whole_content"
    ? "whole_content"
    : `${selector.kind}:${selector.path}`;
}

function materializeSelection(
  raw,
  selectionIndex,
  candidateIndex,
  contactedIds,
  processIdentity,
) {
  if (!isObject(raw)) {
    const error = new Error(`recovered_selections[${selectionIndex}] must be an object.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_RECOVERY_INVALID";
    throw error;
  }
  if (Object.hasOwn(raw, "content")) {
    const error = new Error(
      "Retrieval resolver must select grounded source content; it may not author recovered content directly.",
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_AUTHORED_CONTENT_FORBIDDEN";
    throw error;
  }

  const sourceRef = normalizeCandidateRef(
    raw.source_memory_ref ?? raw.memory_id,
    `recovered_selections[${selectionIndex}].source_memory_ref`,
    candidateIndex,
  );
  if (!contactedIds.has(sourceRef.memory_id)) {
    const error = new Error(
      `Recovered memory ${sourceRef.memory_id} was not recorded as contacted in this retrieval step.`,
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_RECOVERY_WITHOUT_CONTACT";
    throw error;
  }

  const contentKind = optionalString(raw.content_kind) ?? "unspecified";
  if (!contentKindSet.has(contentKind)) {
    const error = new Error(`Unsupported recovered content_kind: ${contentKind}.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_CONTENT_KIND_INVALID";
    throw error;
  }
  const targetRelation = optionalString(raw.target_relation) ?? "unresolved";
  if (!targetRelationSet.has(targetRelation)) {
    const error = new Error(`Unsupported recovered target_relation: ${targetRelation}.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_RELATION_INVALID";
    throw error;
  }

  const selector = normalizeSelector(raw.selector);
  const sourceRecord = candidateIndex.by_id.get(sourceRef.memory_id).record;
  const sourceContent = memoryContent(sourceRecord);
  if (sourceContent === null || sourceContent === undefined) {
    const error = new Error(
      `Source memory ${sourceRef.memory_id} has no recoverable subjective content.`,
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_SOURCE_CONTENT_MISSING";
    throw error;
  }
  const content = selector.kind === "whole_content"
    ? cloneJson(sourceContent)
    : materializeJsonPointer(sourceContent, selector.path);

  const fragmentId = `memory_retrieval_fragment_${hashAgentRunValue({
    version: worldSimulationMemoryRetrievalProcessVersion,
    process_identity: processIdentity,
    source_memory_ref: sourceRef.memory_id,
    selector,
    content_kind: contentKind,
    target_relation: targetRelation,
  }).slice(0, 24)}`;

  const source = isObject(sourceRecord.source)
    ? {
      kind: sourceRecord.source.kind ?? null,
      actor: sourceRecord.source.actor ?? null,
      sense: sourceRecord.source.sense ?? null,
    }
    : {
      kind: sourceRecord.source_kind ?? null,
      actor: sourceRecord.source_actor ?? null,
      sense: null,
    };

  return {
    fragment: {
      fragment_id: fragmentId,
      source_memory_ref: sourceRef.memory_id,
      content,
      content_kind: contentKind,
      target_relation: targetRelation,
      content_grounding: {
        source_memory_ref: sourceRef.memory_id,
        selector: cloneJson(selector),
        materialized_by_kernel: true,
      },
    },
    character_view: {
      content,
      content_kind: contentKind,
      target_relation: targetRelation,
      source,
      memory_type: sourceRecord.memory_type ?? null,
      perceptual_certainty_at_encoding: sourceRecord.perceptual_certainty_at_encoding ?? null,
      perceptual_clarity_at_encoding: sourceRecord.perceptual_clarity_at_encoding ?? null,
      possibly_incorrect: sourceRecord.possibly_incorrect === true,
      source_confused: sourceRecord.source_confused === true,
    },
    selector,
    source_ref: sourceRef,
  };
}

function normalizeTarget(rawTarget) {
  if (!isObject(rawTarget)) {
    return {
      value: cloneJson(rawTarget ?? null),
      grounded: false,
      kind: null,
      memory_id: null,
      requested_selectors: [],
    };
  }
  const kind = optionalString(rawTarget.kind);
  if (kind === "memory_ref") {
    const memoryId = requiredString(
      rawTarget.memory_id,
      "target.memory_id",
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_INVALID",
    );
    return {
      value: cloneJson(rawTarget),
      grounded: true,
      kind,
      memory_id: memoryId,
      requested_selectors: [{ kind: "whole_content" }],
    };
  }
  if (kind === "memory_content") {
    const memoryId = requiredString(
      rawTarget.memory_id,
      "target.memory_id",
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_INVALID",
    );
    const requestedSelectors = array(rawTarget.requested_selectors).map(normalizeSelector);
    if (!requestedSelectors.length) {
      const error = new Error("memory_content target requires requested_selectors.");
      error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_INVALID";
      throw error;
    }
    return {
      value: cloneJson(rawTarget),
      grounded: true,
      kind,
      memory_id: memoryId,
      requested_selectors: requestedSelectors,
    };
  }
  return {
    value: cloneJson(rawTarget),
    grounded: false,
    kind: kind ?? null,
    memory_id: null,
    requested_selectors: [],
  };
}

function classifyTargetOutcome(target, initiation, recovered) {
  if (target.value === null || target.value === undefined) return "not_applicable";
  const targetRelated = recovered.filter(
    (item) => item.fragment.target_relation === "target_related",
  );
  if (!target.grounded) return targetRelated.length ? "partially_satisfied" : "failed";
  const relevant = targetRelated.filter(
    (item) => item.source_ref.memory_id === target.memory_id,
  );
  if (!relevant.length) return "failed";
  if (target.kind === "memory_ref") {
    return relevant.some((item) => item.selector.kind === "whole_content")
      ? "satisfied"
      : "partially_satisfied";
  }
  if (relevant.some((item) => item.selector.kind === "whole_content")) return "satisfied";
  const recoveredSelectors = new Set(relevant.map((item) => selectorIdentity(item.selector)));
  const requested = target.requested_selectors.map(selectorIdentity);
  const recoveredRequestedCount = requested.filter(
    (identity) => recoveredSelectors.has(identity),
  ).length;
  if (recoveredRequestedCount === requested.length) return "satisfied";
  return recoveredRequestedCount > 0 ? "partially_satisfied" : "failed";
}

function stepTargetRelation(recovered) {
  const relations = new Set(recovered.map((item) => item.fragment.target_relation));
  if (relations.has("target_related")) return "target_related";
  if (relations.has("non_target")) return "non_target";
  return "unresolved";
}

function retrievalExperience(processOccurred, initiation = null, targetOutcome = null, recoveredAny = false) {
  return {
    process_occurred: processOccurred,
    initiation_mode: initiation?.mode ?? null,
    target_outcome: targetOutcome,
    recovered_any_content: recoveredAny,
  };
}

export function buildWorldSimulationMemoryRetrievalSchemas() {
  return cloneJson(schemas);
}

export function buildWorldSimulationMemoryRetrievalProcessContract() {
  return {
    version: worldSimulationMemoryRetrievalProcessVersion,
    phase: "Phase63C",
    status: "step3_single_step_actual_retrieval_kernel_installed",
    retrieval_process_schema_installed: true,
    retrieval_event_schema_installed: true,
    retrieval_process_execution_installed: true,
    single_step_retrieval_execution_installed: true,
    multi_step_retrieval_execution_installed: false,
    retrieval_event_persistence_installed: false,
    candidate_content_barrier_enforced: true,
    candidate_content_barrier_owner: "Phase63C Step2",
    native_recovered_memory_channel_installed: true,
    native_recovered_memory_channel: "recovered_memories",
    native_recovered_memories_without_process: "empty",
    retrieval_experience_channel_installed: true,
    retrieval_initiation_requires_explicit_engine_resolution: true,
    missing_retrieval_resolver_means_no_process: true,
    candidate_presence_implies_process: false,
    candidate_order_implies_success: false,
    grounded_fragment_materialization_installed: true,
    recovered_content_authored_by_resolver_allowed: false,
    partial_recovery_uses_source_selectors: true,
    string_partial_slicing_allowed: false,
    generated_gist_without_source_trace_allowed: false,
    legacy_projector_api_preserved: true,
    legacy_projector_native_character_brain_path_active: false,
    retrieval_event_store_authority: "world_state.retrieval_events",
    retrieval_event_immutability_required: true,
    retrieval_event_immutability_enforced: false,
    retrieval_history_append_only_required: true,
    retrieval_history_append_only_enforced: false,
    retrieval_history_authority: "retrieval_event_reference",
    recall_summary_is_authoritative: false,
    recall_count_is_rebuildable_summary: true,
    last_recalled_at_is_rebuildable_summary: true,
    same_cycle_phase63b_feedback_allowed: false,
    multi_step_retrieval_schema_supported: true,
    internally_reinstated_cues_schema_supported: true,
    internally_reinstated_cues_execution_installed: false,
    spontaneous_retrieval_schema_supported: true,
    deliberate_retrieval_schema_supported: true,
    failed_retrieval_event_supported: true,
    non_target_recovery_schema_supported: true,
    partial_outcome_uses_arbitrary_percentage: false,
    universal_retrieval_probability_modeled: false,
    universal_success_threshold_modeled: false,
    unseeded_randomness_used_by_kernel: false,
    retrieval_reinforcement_modeled: false,
    retrieval_induced_forgetting_modeled: false,
    reconsolidation_modeled: false,
    source_confusion_modeled: false,
    confidence_rewrite_modeled: false,
    memory_content_rewrite_modeled: false,
    direct_world_state_mutation_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    schemas: buildWorldSimulationMemoryRetrievalSchemas(),
  };
}

export function buildWorldSimulationMemoryRetrievalQuery(input = {}) {
  const character = requiredString(input.character, "character");
  const turnId = requiredString(input.turn_id, "turn_id");
  const phase63bVersion = requiredString(input.phase63b_version, "phase63b_version");
  const candidateRecords = array(input.candidate_memory_records);
  const candidateSnapshot = cloneJson(candidateRecords);
  const candidateIndex = buildCandidateIndex(candidateRecords);
  const candidateSetHash = hashAgentRunValue(candidateSnapshot);
  const initialCues = cloneJson(array(input.initial_cues));
  const retrievalGoal = cloneJson(input.retrieval_goal ?? null);
  const queryId = `memory_retrieval_query_${hashAgentRunValue({
    version: worldSimulationMemoryRetrievalProcessVersion,
    character,
    turn_id: turnId,
    phase63b_version: phase63bVersion,
    candidate_set_hash: candidateSetHash,
    initial_cues: initialCues,
    retrieval_goal: retrievalGoal,
  }).slice(0, 24)}`;
  return deepFreeze({
    query_id: queryId,
    character,
    turn_id: turnId,
    phase63b_version: phase63bVersion,
    candidate_set_hash: candidateSetHash,
    candidate_count: candidateIndex.refs.length,
    initial_cues: initialCues,
    retrieval_goal: retrievalGoal,
    candidate_refs: candidateIndex.refs,
    boundaries: {
      query_is_engine_side: true,
      query_embeds_candidate_content: false,
      query_forwarded_to_character_brain: false,
      query_embeds_candidate_accessibility_diagnostics: false,
      global_candidate_content_barrier_enforced: true,
      global_candidate_content_barrier_owner: "Phase63C Step2",
      candidate_set_frozen_for_process: true,
      query_mutates_persistent_memory: false,
    },
  });
}

export function executeWorldSimulationMemoryRetrievalProcess(input = {}) {
  const query = isObject(input.query) ? cloneJson(input.query) : null;
  if (!query) {
    const error = new Error("Phase63C retrieval execution requires a MemoryRetrievalQuery.");
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_QUERY_REQUIRED";
    throw error;
  }

  const candidateRecords = cloneJson(array(input.candidate_memory_records));
  const candidateIndex = assertFrozenCandidateSet(query, candidateRecords);
  const rawResolution = isObject(input.resolution)
    ? cloneJson(input.resolution)
    : { process_occurred: false };

  if (rawResolution.process_occurred !== true) {
    return deepFreeze({
      version: worldSimulationMemoryRetrievalProcessVersion,
      process_occurred: false,
      retrieval_process: null,
      recovered_fragments: [],
      recovered_memories: [],
      target_outcome: null,
      recovered_any_content: false,
      retrieval_experience: retrievalExperience(false),
      engine_audit: {
        candidate_set_verified: true,
        candidate_count: candidateRecords.length,
        explicit_retrieval_resolution_used: isObject(input.resolution),
        no_process_is_not_failed_retrieval: true,
        resolver_authored_memory_content_accepted: false,
        multi_step_search_executed: false,
        internally_reinstated_cues_executed: false,
        world_state_mutated: false,
      },
    });
  }

  if (array(rawResolution.reinstated_cues).length || array(rawResolution.steps).length > 1) {
    const error = new Error(
      "Phase63C Step 3 supports one retrieval step only; internally reinstated cues belong to Step 4.",
    );
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_MULTI_STEP_NOT_INSTALLED";
    throw error;
  }

  const initiation = normalizeInitiation(rawResolution.initiation);
  const retrievalTask = normalizeRetrievalTask(rawResolution.retrieval_task);
  const targetValue = Object.hasOwn(rawResolution, "target")
    ? rawResolution.target
    : initiation.mode === "spontaneous"
      ? null
      : query.retrieval_goal;
  const target = normalizeTarget(targetValue);

  if (target.grounded && !candidateIndex.by_id.has(target.memory_id)) {
    const error = new Error(`Retrieval target ${target.memory_id} is not in the frozen candidate set.`);
    error.code = "WORLD_SIMULATION_MEMORY_RETRIEVAL_TARGET_NOT_CANDIDATE";
    throw error;
  }

  const contacted = normalizeContactedRefs(
    rawResolution.contacted_candidate_refs,
    candidateIndex,
  );
  const processIdentity = {
    query_id: query.query_id,
    initiation,
    retrieval_task: retrievalTask,
    target: target.value,
    contacted_candidate_refs: contacted.refs,
  };

  const recovered = [];
  const seenRecovery = new Set();
  array(rawResolution.recovered_selections).forEach((selection, selectionIndex) => {
    const materialized = materializeSelection(
      selection,
      selectionIndex,
      candidateIndex,
      contacted.ids,
      processIdentity,
    );
    const identity = JSON.stringify([
      materialized.source_ref.memory_id,
      selectorIdentity(materialized.selector),
      materialized.fragment.content_kind,
      materialized.fragment.target_relation,
    ]);
    if (seenRecovery.has(identity)) return;
    seenRecovery.add(identity);
    recovered.push(materialized);
  });

  const targetOutcome = classifyTargetOutcome(target, initiation, recovered);
  const termination = {
    reason: optionalString(rawResolution.termination?.reason) ?? "single_step_completed",
    step_limit_reached: true,
  };
  const retrievalProcessId = `memory_retrieval_process_${hashAgentRunValue({
    version: worldSimulationMemoryRetrievalProcessVersion,
    query_id: query.query_id,
    initiation,
    retrieval_task: retrievalTask,
    target: target.value,
    contacted_candidate_refs: contacted.refs,
    recovered_fragment_ids: recovered.map((item) => item.fragment.fragment_id),
    termination,
  }).slice(0, 24)}`;

  const retrievalStep = {
    step_index: 0,
    active_cues: cloneJson(query.initial_cues ?? []),
    contacted_candidate_refs: cloneJson(contacted.refs),
    recovered_fragments: recovered.map((item) => cloneJson(item.fragment)),
    reinstated_cues: [],
    target_relation: stepTargetRelation(recovered),
    termination_after_step: true,
  };
  const retrievalProcess = {
    retrieval_process_id: retrievalProcessId,
    query_id: query.query_id,
    character: query.character,
    turn_id: query.turn_id,
    initiation,
    retrieval_task: retrievalTask,
    target: cloneJson(target.value),
    initial_cues: cloneJson(query.initial_cues ?? []),
    frozen_candidate_set: {
      phase63b_version: query.phase63b_version,
      candidate_set_hash: query.candidate_set_hash,
      candidate_count: query.candidate_count,
    },
    steps: [retrievalStep],
    termination,
  };
  const recoveredAnyContent = recovered.length > 0;

  return deepFreeze({
    version: worldSimulationMemoryRetrievalProcessVersion,
    process_occurred: true,
    retrieval_process: retrievalProcess,
    recovered_fragments: recovered.map((item) => cloneJson(item.fragment)),
    recovered_memories: recovered.map((item) => cloneJson(item.character_view)),
    target_outcome: targetOutcome,
    recovered_any_content: recoveredAnyContent,
    retrieval_experience: retrievalExperience(
      true,
      initiation,
      targetOutcome,
      recoveredAnyContent,
    ),
    engine_audit: {
      candidate_set_verified: true,
      candidate_count: candidateRecords.length,
      explicit_retrieval_resolution_used: true,
      contacted_candidate_count: contacted.refs.length,
      recovered_fragment_count: recovered.length,
      resolver_authored_memory_content_accepted: false,
      source_grounded_materialization_enforced: true,
      arbitrary_partial_recall_percentage_used: false,
      universal_probability_used: false,
      universal_threshold_used: false,
      unseeded_randomness_used: false,
      reinforcement_applied: false,
      failure_weakening_applied: false,
      competitor_debuff_applied: false,
      reconsolidation_applied: false,
      multi_step_search_executed: false,
      internally_reinstated_cues_executed: false,
      world_state_mutated: false,
    },
  });
}
