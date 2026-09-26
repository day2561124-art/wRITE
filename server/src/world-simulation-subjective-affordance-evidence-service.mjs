import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationSubjectiveAffordanceEvidenceVersion =
  "cb-c5b-subjective-affordance-evidence-v1";

export const worldSimulationSubjectiveAffordanceEvidenceMaxObservations = 32;
export const worldSimulationSubjectiveAffordanceEvidenceMaxMeans = 24;
export const worldSimulationSubjectiveAffordanceEvidenceMaxGaps = 32;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedString(value, label, maxLength = 240) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_EVIDENCE_INPUT_INVALID";
    throw error;
  }
  return text;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function characterKey(value) {
  const text = optionalString(value);
  return text ? text.toLocaleLowerCase("zh-Hant-TW") : "";
}

function sameCharacter(left, right) {
  return Boolean(characterKey(left))
    && characterKey(left) === characterKey(right);
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function semanticValuePresent(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "string") return Boolean(value.trim());
  return true;
}

function boundedValue(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 24).map((item) => boundedValue(item, depth + 1));
  }
  if (isObject(value)) {
    const result = {};
    for (const [key, child] of Object.entries(value).slice(0, 48)) {
      const lower = key.toLowerCase();
      if (
        lower === "world_state"
        || lower === "raw_world_event"
        || lower === "hidden_world_state"
        || lower === "memory_store"
        || lower.startsWith("engine_")
        || lower === "probability"
        || lower === "confidence"
        || lower === "feasibility_score"
        || lower === "utility"
        || lower === "priority"
      ) {
        continue;
      }
      result[key] = boundedValue(child, depth + 1);
    }
    return result;
  }
  if (typeof value === "string") return value.slice(0, 1200);
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  return null;
}

function gapRecord(kind, sourcePath, reason, extra = {}) {
  return {
    gap_kind: kind,
    source_path: sourcePath,
    reason,
    ...extra,
  };
}

const observationIdentifierFields = Object.freeze([
  ["object_id", "object"],
  ["entity_id", "entity"],
  ["target_id", "target"],
  ["place_id", "place"],
  ["location_id", "place"],
  ["scene_id", "place"],
]);

function observationIdentity(raw) {
  const value = object(raw);
  for (const [field, kind] of observationIdentifierFields) {
    const ref = optionalString(value[field]);
    if (ref) return { field, kind, ref };
  }
  return null;
}

function observationDescriptor(raw, identity) {
  const value = object(raw);
  const descriptor = {
    [identity.field]: identity.ref,
  };
  for (const field of [
    "position",
    "relative_position",
    "distance",
    "direction",
    "relation",
    "state",
    "status",
    "kind",
    "type",
  ]) {
    if (semanticValuePresent(value[field])) {
      descriptor[field] = boundedValue(value[field]);
    }
  }
  return descriptor;
}

function buildObservationCatalog(character, currentTurnId, perception, gaps) {
  const channels = [
    ["visual", array(perception.observed)],
    ["audible", array(perception.audible)],
    ["other_senses", array(perception.other_senses)],
  ];
  const candidates = [];
  let sourceCount = 0;

  for (const [channel, entries] of channels) {
    for (let index = 0; index < entries.length; index += 1) {
      sourceCount += 1;
      const raw = entries[index];
      const sourcePath = `perception.${
        channel === "visual" ? "observed" : channel
      }[${index}]`;
      if (!isObject(raw)) {
        gaps.push(gapRecord(
          "observation_provenance_missing",
          sourcePath,
          "observation_is_not_typed_object",
        ));
        continue;
      }
      const identity = observationIdentity(raw);
      if (!identity) {
        gaps.push(gapRecord(
          "observation_provenance_missing",
          sourcePath,
          "typed_target_or_place_ref_missing",
        ));
        continue;
      }
      if (identity.ref.length > 240) {
        gaps.push(gapRecord(
          "observation_provenance_missing",
          sourcePath,
          "typed_target_or_place_ref_out_of_bounds",
        ));
        continue;
      }
      const descriptor = observationDescriptor(raw, identity);
      const base = {
        character,
        current_turn_id: currentTurnId,
        source_channel: channel,
        source_index: index,
        subject_kind: identity.kind,
        subject_ref: identity.ref,
        subject_ref_field: identity.field,
        descriptor,
        observer_bounded_perception_only: true,
        subjective_opportunity_evidence_only: true,
        world_truth_authority: false,
      };
      const hash = hashAgentRunValue({
        version: worldSimulationSubjectiveAffordanceEvidenceVersion,
        ...base,
      });
      candidates.push({
        observation_ref: `cb_c5b_observation_${hash.slice(0, 24)}`,
        observation_hash: hash,
        ...base,
      });
    }
  }

  const deduplicated = [];
  const seen = new Set();
  for (const entry of candidates) {
    const key = [
      entry.source_channel,
      entry.subject_kind,
      entry.subject_ref,
      hashAgentRunValue(entry.descriptor),
    ].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(entry);
  }

  deduplicated.sort((left, right) =>
    compareText(left.source_channel, right.source_channel)
      || compareText(left.subject_kind, right.subject_kind)
      || compareText(left.subject_ref, right.subject_ref)
      || compareText(left.observation_ref, right.observation_ref));

  return {
    source_count: sourceCount,
    records: deduplicated.slice(
      0,
      worldSimulationSubjectiveAffordanceEvidenceMaxObservations,
    ),
    truncated:
      deduplicated.length
      > worldSimulationSubjectiveAffordanceEvidenceMaxObservations,
  };
}

function methodRecord(character, currentTurnId, sourceKind, sourcePath, content, upstreamRef = null) {
  const bounded = boundedValue(content);
  if (!semanticValuePresent(bounded)) return null;
  const base = {
    character,
    current_turn_id: currentTurnId,
    source_kind: sourceKind,
    source_path: sourcePath,
    upstream_ref: upstreamRef,
    represented_means: bounded,
    advisory_only: true,
    action_selection_authority: false,
    objective_feasibility_verified: false,
    world_truth_authority: false,
  };
  const hash = hashAgentRunValue({
    version: worldSimulationSubjectiveAffordanceEvidenceVersion,
    ...base,
  });
  return {
    means_ref: `cb_c5b_means_${hash.slice(0, 24)}`,
    means_hash: hash,
    ...base,
  };
}

function implementationGuidanceRecords(character, currentTurnId, cognition, gaps) {
  const raw = cognition.implementation_intention_guidance;
  const guidance = Array.isArray(raw)
    ? raw
    : array(object(raw).implementation_intention_guidance);
  const records = [];
  for (let index = 0; index < guidance.length; index += 1) {
    const item = object(guidance[index]);
    const sourcePath = `cognition.implementation_intention_guidance[${index}]`;
    if (
      item.advisory_only !== true
      || item.selected_action_authority !== false
      || !semanticValuePresent(item.then_response)
    ) {
      gaps.push(gapRecord(
        "represented_means_provenance_missing",
        sourcePath,
        "implementation_guidance_not_canonical_advisory_means",
      ));
      continue;
    }
    const record = methodRecord(
      character,
      currentTurnId,
      "implementation_intention_guidance",
      sourcePath,
      {
        if_cue: item.if_cue ?? null,
        then_response: item.then_response,
        reconsideration_state: item.reconsideration_state ?? null,
        cue_applicable: item.cue_applicable === true,
      },
    );
    if (record) records.push(record);
  }
  return records;
}

function experientialGuidanceRecords(character, currentTurnId, cognition, gaps) {
  const root = object(cognition.experiential_method_guidance);
  if (!Object.keys(root).length) return [];
  if (optionalString(root.character) && !sameCharacter(root.character, character)) {
    gaps.push(gapRecord(
      "represented_means_provenance_missing",
      "cognition.experiential_method_guidance",
      "cross_character_experiential_guidance_rejected",
    ));
    return [];
  }
  if (optionalString(root.current_turn_id) && root.current_turn_id !== currentTurnId) {
    gaps.push(gapRecord(
      "represented_means_provenance_missing",
      "cognition.experiential_method_guidance",
      "stale_experiential_guidance_rejected",
    ));
    return [];
  }
  const view = isObject(root.character_view) ? root.character_view : root;
  if (view.advisory_only !== true || view.selected_action_authority !== false) {
    gaps.push(gapRecord(
      "represented_means_provenance_missing",
      "cognition.experiential_method_guidance",
      "experiential_guidance_not_advisory",
    ));
    return [];
  }

  const records = [];
  for (let index = 0; index < array(view.transferred_methods).length; index += 1) {
    const method = object(view.transferred_methods[index]);
    const sourcePath =
      `cognition.experiential_method_guidance.transferred_methods[${index}]`;
    const transferRef = optionalString(method.transfer_ref);
    if (!transferRef || !isObject(method.method_skeleton)) {
      gaps.push(gapRecord(
        "represented_means_provenance_missing",
        sourcePath,
        "canonical_transfer_ref_or_method_skeleton_missing",
      ));
      continue;
    }
    const record = methodRecord(
      character,
      currentTurnId,
      "experiential_method_guidance",
      sourcePath,
      {
        method_skeleton: method.method_skeleton,
        source_knowledge_status: method.source_knowledge_status ?? null,
        subjective_not_world_truth: method.subjective_not_world_truth !== false,
      },
      transferRef,
    );
    if (record) records.push(record);
  }
  return records;
}

function capabilityAppraisalRecords(character, currentTurnId, cognition, gaps) {
  const root = object(cognition.self_model_context);
  if (!Object.keys(root).length) return [];
  if (optionalString(root.character) && !sameCharacter(root.character, character)) {
    gaps.push(gapRecord(
      "represented_means_provenance_missing",
      "cognition.self_model_context",
      "cross_character_self_model_rejected",
    ));
    return [];
  }
  const view = isObject(root.character_view) ? root.character_view : root;
  const committedPriorTurnSources = new Set([
    "committed_prior_turn_structured_self_model",
    "committed_prior_turn_effective_revised_structured_self_model",
  ]);
  if (!committedPriorTurnSources.has(optionalString(view.source))) {
    gaps.push(gapRecord(
      "represented_means_provenance_missing",
      "cognition.self_model_context",
      "committed_prior_turn_self_model_source_required",
    ));
    return [];
  }
  const records = [];
  for (let index = 0; index < array(view.aspects).length; index += 1) {
    const aspect = object(view.aspects[index]);
    if (aspect.aspect_type !== "capability_appraisal") continue;
    const sourcePath = `cognition.self_model_context.aspects[${index}]`;
    if (
      !optionalString(aspect.domain)
      || !optionalString(aspect.relation)
      || !optionalString(aspect.object)
      || aspect.subjective_not_world_truth !== true
    ) {
      gaps.push(gapRecord(
        "represented_means_provenance_missing",
        sourcePath,
        "capability_appraisal_descriptor_incomplete",
      ));
      continue;
    }
    const record = methodRecord(
      character,
      currentTurnId,
      "structured_self_model_capability_appraisal",
      sourcePath,
      {
        domain: aspect.domain,
        relation: aspect.relation,
        object: aspect.object,
        qualifiers: array(aspect.qualifiers),
        subjective_not_world_truth: true,
        self_model_accuracy_claimed: false,
      },
    );
    if (record) records.push(record);
  }
  return records;
}

function buildMeansCatalog(character, currentTurnId, cognition, gaps) {
  const candidates = [
    ...implementationGuidanceRecords(character, currentTurnId, cognition, gaps),
    ...experientialGuidanceRecords(character, currentTurnId, cognition, gaps),
    ...capabilityAppraisalRecords(character, currentTurnId, cognition, gaps),
  ];

  const deduplicated = [];
  const seen = new Set();
  for (const entry of candidates) {
    const key = [
      entry.source_kind,
      entry.upstream_ref ?? "",
      hashAgentRunValue(entry.represented_means),
    ].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(entry);
  }

  deduplicated.sort((left, right) =>
    compareText(left.source_kind, right.source_kind)
      || compareText(left.upstream_ref ?? "", right.upstream_ref ?? "")
      || compareText(left.means_ref, right.means_ref));

  return {
    records: deduplicated.slice(
      0,
      worldSimulationSubjectiveAffordanceEvidenceMaxMeans,
    ),
    truncated:
      deduplicated.length > worldSimulationSubjectiveAffordanceEvidenceMaxMeans,
  };
}

function assertSameCharacterPacket(character, perception, cognition) {
  if (optionalString(perception.character) && !sameCharacter(perception.character, character)) {
    const error = new Error(
      "CB-C5B subjective affordance evidence requires same-character perception.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_EVIDENCE_CHARACTER_MISMATCH";
    throw error;
  }
  if (optionalString(cognition.character) && !sameCharacter(cognition.character, character)) {
    const error = new Error(
      "CB-C5B subjective affordance evidence requires same-character cognition.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_EVIDENCE_CHARACTER_MISMATCH";
    throw error;
  }
}

export function buildWorldSimulationSubjectiveAffordanceEvidenceContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveAffordanceEvidenceVersion,
    phase: "CB-C5-B",
    status: "bounded_subjective_affordance_evidence_catalog_installed",
    read_only_projection_only: true,
    same_character_packet_required: true,
    ordinary_observer_bounded_perception_only: true,
    typed_target_or_place_ref_required: true,
    represented_means_sources: [
      "implementation_intention_guidance",
      "experiential_method_guidance",
      "structured_self_model_capability_appraisal",
    ],
    subjective_belief_alone_is_capability_proof: false,
    free_text_goal_inference_allowed: false,
    semantic_similarity_matching_performed: false,
    action_candidate_created: false,
    action_selected: false,
    objective_feasibility_verified: false,
    causal_outcome_asserted: false,
    raw_world_state_read: false,
    engine_private_phase72_evidence_read: false,
    durable_state_written: false,
    deterministic_catalog_identity_required: true,
    maximum_observation_count:
      worldSimulationSubjectiveAffordanceEvidenceMaxObservations,
    maximum_represented_means_count:
      worldSimulationSubjectiveAffordanceEvidenceMaxMeans,
    maximum_provenance_gap_count:
      worldSimulationSubjectiveAffordanceEvidenceMaxGaps,
  });
}

export function buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(input = {}) {
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const cognition = object(input.cognition);
  const perception = object(input.perception ?? cognition.perception);

  assertSameCharacterPacket(character, perception, cognition);

  const gaps = [];
  const observation = buildObservationCatalog(
    character,
    currentTurnId,
    perception,
    gaps,
  );
  const means = buildMeansCatalog(
    character,
    currentTurnId,
    cognition,
    gaps,
  );
  const boundedGaps = gaps.slice(
    0,
    worldSimulationSubjectiveAffordanceEvidenceMaxGaps,
  );

  const catalog = {
    version: worldSimulationSubjectiveAffordanceEvidenceVersion,
    character,
    current_turn_id: currentTurnId,
    status:
      observation.records.length && means.records.length
        ? "subjective_affordance_evidence_ready"
        : "insufficient_grounded_evidence",
    observation_catalog: observation.records,
    represented_means_catalog: means.records,
    provenance_gaps: boundedGaps,
    counts: {
      perception_source_entry_count: observation.source_count,
      observation_evidence_count: observation.records.length,
      represented_means_count: means.records.length,
      provenance_gap_count: boundedGaps.length,
    },
    truncation: {
      observation_catalog_truncated: observation.truncated,
      represented_means_catalog_truncated: means.truncated,
      provenance_gaps_truncated: gaps.length > boundedGaps.length,
    },
    boundaries: {
      same_character_only: true,
      observer_bounded_perception_only: true,
      typed_target_or_place_ref_required: true,
      represented_means_are_character_facing_subjective_context: true,
      subjective_belief_alone_used_as_capability_proof: false,
      free_text_goal_inference_used: false,
      semantic_similarity_matching_performed: false,
      action_candidate_created: false,
      action_selection_performed: false,
      objective_feasibility_verified: false,
      causal_outcome_asserted: false,
      raw_world_state_read: false,
      engine_private_phase72_evidence_read: false,
      direct_world_state_mutation: false,
      durable_learning_write: false,
    },
  };
  catalog.catalog_hash = hashAgentRunValue(catalog);
  return deepFreeze(cloneJson(catalog));
}
