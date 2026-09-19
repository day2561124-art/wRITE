import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationInterferenceBoundedMemoryDistortionVersion =
  "phase95-interference-bounded-memory-distortion-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_INPUT_INVALID";
  throw error;
}
function nonNegativeInteger(value, label) {
  const numeric = Number(value);
  if (Number.isSafeInteger(numeric) && numeric >= 0) return numeric;
  const error = new Error(`${label} must be a non-negative safe integer.`);
  error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_INPUT_INVALID";
  throw error;
}
function memoryRef(value, label) {
  const ref = optionalString(value);
  if (ref) return ref;
  const error = new Error(`${label} must be a non-empty memory ref.`);
  error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
  throw error;
}

function comparableTime(value) {
  if (Number.isFinite(Number(value)) && value !== null && value !== "") {
    return Number(value);
  }
  const text = optionalString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTemporalEvidence(values) {
  const byRef = new Map();

  for (const [index, raw] of array(values).entries()) {
    if (!isObject(raw)) {
      const error = new Error(`candidate_temporal_evidence[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
      throw error;
    }

    const ref = memoryRef(raw.memory_ref, `candidate_temporal_evidence[${index}].memory_ref`);
    const entry = {
      memory_ref: ref,
      encoded_at: raw.encoded_at ?? null,
      comparable_time: comparableTime(raw.encoded_at),
    };

    if (byRef.has(ref)) {
      const prior = byRef.get(ref);
      if (JSON.stringify(prior) !== JSON.stringify(entry)) {
        const error = new Error(`Conflicting temporal evidence for ${ref}.`);
        error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
        throw error;
      }
      continue;
    }

    byRef.set(ref, entry);
  }

  return byRef;
}

function normalizeRecovered(values, temporalByRef) {
  const recovered = [];
  const seen = new Set();

  for (const [index, raw] of array(values).entries()) {
    if (!isObject(raw)) {
      const error = new Error(`recovered_memory_evidence[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
      throw error;
    }

    const ref = memoryRef(raw.source_memory_ref, `recovered_memory_evidence[${index}].source_memory_ref`);
    if (!temporalByRef.has(ref)) {
      const error = new Error(`Recovered memory ${ref} is missing candidate temporal evidence.`);
      error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
      throw error;
    }

    const fragmentId = optionalString(raw.fragment_id);
    const contentKind = optionalString(raw.content_kind) ?? "unspecified";
    const targetRelation = optionalString(raw.target_relation) ?? "unresolved";
    const identity = JSON.stringify([ref, fragmentId, contentKind, targetRelation]);
    if (seen.has(identity)) continue;
    seen.add(identity);

    recovered.push({
      source_memory_ref: ref,
      fragment_id: fragmentId,
      content_kind: contentKind,
      target_relation: targetRelation,
    });
  }

  return recovered;
}

function normalizeCompetitionRelations(values, temporalByRef) {
  const byMemory = new Map();

  for (const [index, raw] of array(values).entries()) {
    if (!isObject(raw)) {
      const error = new Error(`competition_relations[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
      throw error;
    }

    const ref = memoryRef(raw.memory_ref, `competition_relations[${index}].memory_ref`);
    if (!temporalByRef.has(ref)) {
      const error = new Error(`Competition anchor ${ref} is missing candidate temporal evidence.`);
      error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
      throw error;
    }

    const refs = [...new Set(
      array(raw.competitor_memory_refs)
        .map((value, competitorIndex) =>
          memoryRef(
            value,
            `competition_relations[${index}].competitor_memory_refs[${competitorIndex}]`,
          ))
        .filter((value) => value !== ref),
    )];

    for (const competitorRef of refs) {
      if (!temporalByRef.has(competitorRef)) {
        const error = new Error(
          `Competition ref ${competitorRef} is missing candidate temporal evidence.`,
        );
        error.code = "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID";
        throw error;
      }
    }

    byMemory.set(ref, refs);
  }

  return byMemory;
}

function directionFor(anchor, competitor) {
  if (
    anchor.comparable_time === null
    || competitor.comparable_time === null
    || anchor.comparable_time === competitor.comparable_time
  ) {
    return "undirected_competing_memory";
  }

  return competitor.comparable_time < anchor.comparable_time
    ? "proactive_interference_candidate"
    : "retroactive_interference_candidate";
}

function sourceConfusionEvidence(view) {
  const source = object(view);
  const reasons = array(source.source_uncertainty_reasons)
    .map(optionalString)
    .filter(Boolean);

  return source.source_confusion_observed === true
    || source.source_status === "uncertain_source_confusion_present"
    || reasons.some((reason) =>
      reason === "recollected_memory_marked_source_confused"
      || reason.startsWith("conflicting_recollected_source_"));
}

function interferenceStatus(directions) {
  const set = new Set(directions);
  if (!set.size) return "no_competing_memory_evidence";
  if (set.size === 1) return [...set][0];
  if (
    set.has("proactive_interference_candidate")
    && set.has("retroactive_interference_candidate")
  ) {
    return set.has("undirected_competing_memory")
      ? "mixed_temporal_interference_with_undirected_competition"
      : "mixed_proactive_and_retroactive_interference_candidate";
  }
  return "mixed_interference_direction_evidence";
}

function distortionStatus(causes) {
  const set = new Set(causes);
  if (!set.size) return "no_bounded_distortion_evidence";
  if (set.size > 1) return "multiple_bounded_distortion_causes";
  if (set.has("source_confusion")) return "source_confusion_distortion_candidate";
  if (set.has("gist_reconstruction")) return "gist_reconstruction_distortion_candidate";
  return "bounded_distortion_candidate";
}

export function buildWorldSimulationInterferenceBoundedMemoryDistortionContract() {
  return deepFreeze({
    version: worldSimulationInterferenceBoundedMemoryDistortionVersion,
    phase: "Phase95",
    status: "bounded_interference_and_memory_distortion_evidence_installed",
    proactive_interference_requires_earlier_explicit_competitor: true,
    retroactive_interference_requires_later_explicit_competitor: true,
    temporal_direction_requires_encoded_at_lineage: true,
    undirected_competition_supported_when_time_unavailable_or_equal: true,
    competition_uses_existing_accessibility_or_cue_competition_refs: true,
    source_confusion_distortion_requires_phase94_evidence: true,
    gist_distortion_requires_actually_recovered_gist_fragment: true,
    random_distortion_allowed: false,
    generated_memory_content_allowed: false,
    hidden_candidate_content_inspected: false,
    unrecovered_memory_content_inspected: false,
    stored_memory_content_rewritten: false,
    stored_memory_source_rewritten: false,
    distortion_is_world_truth: false,
    interference_effect_established: false,
    numeric_interference_probability_modeled: false,
    numeric_distortion_probability_modeled: false,
    continuation_authority_replaced: false,
  });
}

export function projectWorldSimulationInterferenceBoundedMemoryDistortion(input = {}) {
  const queryId = requiredString(input.query_id, "query_id");
  const character = requiredString(input.character, "character");
  const stepIndex = nonNegativeInteger(input.step_index, "step_index");

  const temporalByRef = normalizeTemporalEvidence(input.candidate_temporal_evidence);
  const recovered = normalizeRecovered(input.recovered_memory_evidence, temporalByRef);
  const competitionByMemory = normalizeCompetitionRelations(
    input.competition_relations,
    temporalByRef,
  );

  const targetRelated = recovered.filter(
    (item) => item.target_relation === "target_related",
  );
  const anchors = targetRelated.length ? targetRelated : recovered;
  const anchorMode = targetRelated.length
    ? "target_related_recovered_memory"
    : recovered.length
      ? "current_recovered_memory"
      : "no_recovered_memory";

  const competitionLineage = [];
  const lineageSeen = new Set();

  for (const anchor of anchors) {
    const anchorTemporal = temporalByRef.get(anchor.source_memory_ref);
    const competitorRefs = competitionByMemory.get(anchor.source_memory_ref) ?? [];

    for (const competitorRef of competitorRefs) {
      const competitorTemporal = temporalByRef.get(competitorRef);
      const direction = directionFor(anchorTemporal, competitorTemporal);
      const identity = JSON.stringify([
        anchor.source_memory_ref,
        competitorRef,
        direction,
      ]);
      if (lineageSeen.has(identity)) continue;
      lineageSeen.add(identity);

      competitionLineage.push({
        recovered_memory_ref: anchor.source_memory_ref,
        competitor_memory_ref: competitorRef,
        direction,
        recovered_encoded_at: anchorTemporal.encoded_at,
        competitor_encoded_at: competitorTemporal.encoded_at,
      });
    }
  }

  const directions = competitionLineage.map((item) => item.direction);
  const sourceMonitoring = cloneJson(object(input.source_monitoring));
  const sourceMonitoringHash = optionalString(input.source_monitoring_projection_hash);
  const sourceConfusion = sourceConfusionEvidence(sourceMonitoring);

  if (sourceConfusion && !sourceMonitoringHash) {
    const error = new Error(
      "Phase95 source-confusion distortion evidence requires a bound Phase94 projection hash.",
    );
    error.code =
      "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_SOURCE_MONITORING_BINDING_REQUIRED";
    throw error;
  }

  const gistFragments = recovered.filter((item) => item.content_kind === "gist");
  for (const fragment of gistFragments) {
    if (!fragment.fragment_id) {
      const error = new Error(
        "Recovered gist distortion evidence requires a grounded fragment_id.",
      );
      error.code =
        "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_GIST_BINDING_REQUIRED";
      throw error;
    }
  }

  const distortionCauseKinds = [];
  const distortionCauseLineage = [];

  if (sourceConfusion) {
    distortionCauseKinds.push("source_confusion");
    distortionCauseLineage.push({
      cause_kind: "source_confusion",
      source_phase94_projection_hash: sourceMonitoringHash,
    });
  }

  if (gistFragments.length) {
    distortionCauseKinds.push("gist_reconstruction");
    distortionCauseLineage.push({
      cause_kind: "gist_reconstruction",
      recovered_fragment_ids: gistFragments.map((item) => item.fragment_id),
      recovered_memory_refs: [...new Set(
        gistFragments.map((item) => item.source_memory_ref),
      )],
    });
  }

  const uniqueDistortionCauseKinds = [...new Set(distortionCauseKinds)];
  const directionStatus = interferenceStatus(directions);
  const boundedDistortionStatus = distortionStatus(uniqueDistortionCauseKinds);
  const causeLineageHash = hashAgentRunValue({
    competition_lineage: competitionLineage,
    distortion_cause_lineage: distortionCauseLineage,
  });

  const characterView = {
    competing_memory_evidence_present: competitionLineage.length > 0,
    competition_anchor_mode: anchorMode,
    interference_direction_status: directionStatus,
    proactive_interference_candidate:
      directions.includes("proactive_interference_candidate"),
    retroactive_interference_candidate:
      directions.includes("retroactive_interference_candidate"),
    undirected_competing_memory_evidence:
      directions.includes("undirected_competing_memory"),
    interference_effect_established: false,
    bounded_distortion_status: boundedDistortionStatus,
    distortion_cause_kinds: uniqueDistortionCauseKinds,
    source_confusion_distortion_candidate: sourceConfusion,
    gist_reconstruction_distortion_candidate: gistFragments.length > 0,
    distortion_content_generated: false,
    stored_memory_content_rewritten: false,
    stored_memory_source_rewritten: false,
    distortion_not_world_truth: true,
    random_distortion_allowed: false,
  };

  const body = {
    version: worldSimulationInterferenceBoundedMemoryDistortionVersion,
    phase: "Phase95",
    query_id: queryId,
    character,
    step_index: stepIndex,
    character_view: characterView,
    engine_evidence: {
      competition_lineage: competitionLineage,
      distortion_cause_lineage: distortionCauseLineage,
      cause_lineage_hash: causeLineageHash,
      source_phase94_projection_hash: sourceMonitoringHash,
      recovered_memory_ref_count: [...new Set(
        recovered.map((item) => item.source_memory_ref),
      )].length,
      recovered_gist_fragment_count: gistFragments.length,
      hidden_candidate_content_inspected: false,
      unrecovered_memory_content_inspected: false,
      generated_memory_content: false,
      stored_memory_content_rewritten: false,
      stored_memory_source_rewritten: false,
      interference_effect_established: false,
      distortion_promoted_to_world_truth: false,
    },
  };

  return deepFreeze({
    ...body,
    projection_hash: hashAgentRunValue(body),
  });
}
