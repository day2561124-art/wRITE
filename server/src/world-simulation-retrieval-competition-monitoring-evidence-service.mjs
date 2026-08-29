import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  compareWorldSimulationAssociativeCompositionEvidence,
  worldSimulationAssociativeActivationCompositionEvidenceVersion,
} from "./world-simulation-associative-activation-composition-evidence-service.mjs";

export const worldSimulationRetrievalCompetitionMonitoringEvidenceVersion =
  "phase64a-r4c-retrieval-competition-monitoring-evidence-v1";

export const retrievalCompetitionMonitoringEvidenceSchemaVersion =
  "phase64a-r4c-retrieval-competition-monitoring-evidence-v1";

const allowedCompetitionStatuses = new Set([
  "known_dominated_on_modeled_dimensions",
  "undominated_on_modeled_dimensions",
  "not_certifiable_due_to_incomplete_evidence",
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
  code = "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_INVALID",
) {
  const text = optionalString(value);

  if (text) return text;

  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function uniqueStrings(
  values,
  label,
  code = "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_DUPLICATE",
) {
  const normalized =
    array(values).map(
      (value, index) =>
        requiredString(
          value,
          `${label}[${index}]`,
          code,
        ),
    );

  if (
    new Set(normalized).size
    !== normalized.length
  ) {
    const error = new Error(`${label} contains duplicate values.`);
    error.code = code;
    throw error;
  }

  return normalized;
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null)
    === JSON.stringify(right ?? null);
}

function assertNoUnsupportedOverrides(input) {
  const forbidden = [
    "competition_formula",
    "winner_selector",
    "activation_threshold",
    "retrieval_threshold",
    "noise_model",
    "sampling_rule",
    "retrieval_probability_model",
    "latency_model",
    "search_control_policy",
  ];

  for (const key of forbidden) {
    if (Object.hasOwn(object(input), key)) {
      const error = new Error(
        `Phase64A-R4C v1 does not accept caller-supplied ${key}.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_OVERRIDE_FORBIDDEN";
      error.field = key;
      throw error;
    }
  }
}

function r4b3EvidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    character:
      evidence.character,
    turn_id:
      evidence.turn_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r3_projection_id:
      evidence.source_r3_projection_id,
    source_r3_projection_hash:
      evidence.source_r3_projection_hash,
    source_r4a_projection_id:
      evidence.source_r4a_projection_id,
    source_r4a_evidence_hash:
      evidence.source_r4a_evidence_hash,
    source_r4b2_topology_evidence_id:
      evidence.source_r4b2_topology_evidence_id,
    source_r4b2_evidence_hash:
      evidence.source_r4b2_evidence_hash,
    candidate_memory_ids:
      cloneJson(
        evidence.candidate_memory_ids,
      ),
    selected_cue_profiles:
      cloneJson(
        evidence.selected_cue_profiles,
      ),
    candidate_evidence:
      cloneJson(
        evidence.candidate_evidence,
      ),
    dominance:
      cloneJson(
        evidence.dominance,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

function assertR4B3Evidence(raw, queryId = null) {
  const evidence = object(raw);

  if (
    evidence.version
    !== worldSimulationAssociativeActivationCompositionEvidenceVersion
  ) {
    const error = new Error(
      "Phase64A-R4C requires canonical Phase64A-R4B3 associative activation composition evidence.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_VERSION_MISMATCH";
    throw error;
  }

  if (
    queryId
    && evidence.query_id !== queryId
  ) {
    const error = new Error(
      "Phase64A-R4C source R4B3 query binding mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_QUERY_MISMATCH";
    throw error;
  }

  const evidenceHash =
    requiredString(
      evidence.evidence_hash,
      "associative_activation_composition_evidence.evidence_hash",
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_INVALID",
    );

  const actualHash =
    hashAgentRunValue(
      r4b3EvidenceBody(evidence),
    );

  if (actualHash !== evidenceHash) {
    const error = new Error(
      "Phase64A-R4B3 source evidence hash mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_associative_activation_composition_${evidenceHash.slice(0, 24)}`;

  if (
    evidence.composition_evidence_id
    !== expectedId
  ) {
    const error = new Error(
      "Phase64A-R4B3 source evidence id mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_ID_MISMATCH";
    throw error;
  }

  const candidateIds =
    uniqueStrings(
      evidence.candidate_memory_ids,
      "associative_activation_composition_evidence.candidate_memory_ids",
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_CANDIDATE_DUPLICATE",
    );

  const candidateEvidence =
    array(
      evidence.candidate_evidence,
    );

  if (
    candidateEvidence.length
    !== candidateIds.length
  ) {
    const error = new Error(
      "Phase64A-R4B3 source candidate evidence count mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_CANDIDATE_COVERAGE_MISMATCH";
    throw error;
  }

  candidateEvidence.forEach(
    (entry, index) => {
      if (
        !isObject(entry)
        || entry.memory_id !== candidateIds[index]
        || entry.candidate_index !== index
      ) {
        const error = new Error(
          `Phase64A-R4B3 source candidate order mismatch at index ${index}.`,
        );
        error.code =
          "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_CANDIDATE_ORDER_MISMATCH";
        throw error;
      }
    },
  );

  if (
    evidence.dominance?.mode
    !== "lazy_pairwise_evidence_component_comparison_v1"
    || evidence.dominance
      ?.exhaustive_pairwise_matrix_materialized
      !== false
  ) {
    const error = new Error(
      "Phase64A-R4C requires canonical R4B3 lazy dominance evidence without an exhaustive pair matrix.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_R4B3_DOMINANCE_CONTRACT_MISMATCH";
    throw error;
  }

  return {
    evidence,
    evidence_hash:
      evidenceHash,
    candidate_ids:
      candidateIds,
  };
}

function monitorEvidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r4b3_composition_evidence_id:
      evidence.source_r4b3_composition_evidence_id,
    source_r4b3_evidence_hash:
      evidence.source_r4b3_evidence_hash,
    candidate_memory_ids:
      cloneJson(
        evidence.candidate_memory_ids,
      ),
    monitoring:
      cloneJson(
        evidence.monitoring,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

function assertMonitoringEvidence(raw) {
  const evidence = object(raw);

  if (
    evidence.version
    !== worldSimulationRetrievalCompetitionMonitoringEvidenceVersion
  ) {
    const error = new Error(
      "Competition probe requires canonical Phase64A-R4C monitoring evidence.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_VERSION_MISMATCH";
    throw error;
  }

  const evidenceHash =
    requiredString(
      evidence.evidence_hash,
      "competition_monitoring_evidence.evidence_hash",
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_INVALID",
    );

  const actualHash =
    hashAgentRunValue(
      monitorEvidenceBody(evidence),
    );

  if (actualHash !== evidenceHash) {
    const error = new Error(
      "Phase64A-R4C monitoring evidence hash mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_retrieval_competition_monitor_${evidenceHash.slice(0, 24)}`;

  if (
    evidence.competition_monitor_evidence_id
    !== expectedId
  ) {
    const error = new Error(
      "Phase64A-R4C monitoring evidence id mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_ID_MISMATCH";
    throw error;
  }

  const candidateIds =
    uniqueStrings(
      evidence.candidate_memory_ids,
      "competition_monitoring_evidence.candidate_memory_ids",
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_CANDIDATE_DUPLICATE",
    );

  if (
    evidence.monitoring?.mode
      !== "lazy_candidate_dominance_probe_v1"
    || evidence.monitoring
      ?.exhaustive_pairwise_matrix_materialized
      !== false
  ) {
    const error = new Error(
      "Phase64A-R4C monitoring mode is not canonical.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_MODE_MISMATCH";
    throw error;
  }

  return {
    evidence,
    evidence_hash:
      evidenceHash,
    candidate_ids:
      candidateIds,
  };
}

function assertMonitorSourceBinding(
  monitoring,
  r4b3,
) {
  if (
    monitoring.evidence.query_id
      !== r4b3.evidence.query_id
    || monitoring.evidence.source_initial_frontier_id
      !== r4b3.evidence.source_initial_frontier_id
    || monitoring.evidence.source_r4b3_composition_evidence_id
      !== r4b3.evidence.composition_evidence_id
    || monitoring.evidence.source_r4b3_evidence_hash
      !== r4b3.evidence_hash
    || !sameValue(
      monitoring.candidate_ids,
      r4b3.candidate_ids,
    )
  ) {
    const error = new Error(
      "Phase64A-R4C monitoring evidence no longer matches its canonical Phase64A-R4B3 source.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_SOURCE_BINDING_MISMATCH";
    throw error;
  }
}

export function buildWorldSimulationRetrievalCompetitionMonitoringEvidenceContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
    phase:
      "Phase64A-R4C",
    status:
      "retrieval_competition_monitoring_evidence",
    source_phase64a_r4b3_required:
      true,
    source_r4b3_evidence_hash_recomputed:
      true,
    source_r4b3_candidate_set_preserved:
      true,
    evidence_is_query_conditioned:
      true,
    evidence_is_initial_frontier_bound:
      true,
    monitoring_mode:
      "lazy_candidate_dominance_probe_v1",
    single_candidate_probe_relation_evaluations:
      "at_most_N_minus_1",
    full_frontier_probe_materialization_required:
      false,
    early_exit_on_dominator_witness_allowed:
      true,
    incomplete_comparison_blocks_undominated_certification:
      true,
    later_dominator_overrides_earlier_incomplete_comparison:
      true,
    exhaustive_pairwise_matrix_materialized:
      false,
    relation_histogram_materialized:
      false,
    candidate_membership_authority:
      false,
    candidate_order_authority:
      false,
    activation_rank_authority:
      false,
    competition_winner_modeled:
      false,
    retrieval_probability_modeled:
      false,
    retrieval_latency_modeled:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    search_control_authority:
      false,
    reinstated_cue_selection_authority:
      false,
    new_attempt_creation_authority:
      false,
    character_subjective_awareness_modeled:
      false,
    new_resolver_stage_added:
      false,
    resolver_exposure_allowed:
      false,
    full_probe_reports_persistence_allowed:
      false,
    non_contacted_competition_witness_persistence_allowed:
      false,
    dynamic_frontier_recomputation_used:
      false,
    phase63c_reinstated_cues_included:
      false,
  });
}

export function projectWorldSimulationRetrievalCompetitionMonitoringEvidence(
  input = {},
) {
  assertNoUnsupportedOverrides(input);

  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const r4b3 =
    assertR4B3Evidence(
      input.associative_activation_composition_evidence,
      queryId,
    );

  const body = {
    schema_version:
      retrievalCompetitionMonitoringEvidenceSchemaVersion,
    version:
      worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
    query_id:
      queryId,
    source_initial_frontier_id:
      r4b3.evidence.source_initial_frontier_id,
    source_r4b3_composition_evidence_id:
      r4b3.evidence.composition_evidence_id,
    source_r4b3_evidence_hash:
      r4b3.evidence_hash,
    candidate_memory_ids:
      cloneJson(
        r4b3.candidate_ids,
      ),
    monitoring: {
      mode:
        "lazy_candidate_dominance_probe_v1",
      candidate_probe_reports_materialized:
        false,
      exhaustive_pairwise_matrix_materialized:
        false,
      relation_histogram_materialized:
        false,
      candidate_order_is_competition_authority:
        false,
      competition_winner_modeled:
        false,
      activation_order_modeled:
        false,
      retrieval_probability_modeled:
        false,
      retrieval_latency_modeled:
        false,
      retrieval_contact_authority:
        false,
      retrieval_recovery_authority:
        false,
      search_control_authority:
        false,
    },
    boundaries: {
      evidence_is_query_conditioned:
        true,
      evidence_is_initial_frontier_bound:
        true,
      source_r4b3_candidate_set_preserved:
        true,
      candidate_membership_changed:
        false,
      candidate_order_changed:
        false,
      activation_rank_inferred:
        false,
      competition_winner_inferred:
        false,
      retrieval_probability_inferred:
        false,
      retrieval_latency_inferred:
        false,
      retrieval_contact_changed:
        false,
      retrieval_recovery_changed:
        false,
      search_control_changed:
        false,
      reinstated_cue_selection_changed:
        false,
      new_attempt_created:
        false,
      character_subjective_awareness_exposed:
        false,
      resolver_exposure_allowed:
        false,
      full_probe_reports_persistence_allowed:
        false,
      non_contacted_competition_witness_persistence_allowed:
        false,
      dynamic_frontier_recomputation_used:
        false,
      phase63c_reinstated_cues_included:
        false,
    },
    immutable:
      true,
  };

  const evidenceHash =
    hashAgentRunValue(body);

  return deepFreeze({
    ...body,
    competition_monitor_evidence_id:
      `memory_retrieval_competition_monitor_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

export function probeWorldSimulationRetrievalCompetitionMonitoringEvidence(
  monitoringEvidence,
  associativeActivationCompositionEvidence,
  candidateMemoryId,
) {
  const monitoring =
    assertMonitoringEvidence(
      monitoringEvidence,
    );

  const r4b3 =
    assertR4B3Evidence(
      associativeActivationCompositionEvidence,
      monitoring.evidence.query_id,
    );

  assertMonitorSourceBinding(
    monitoring,
    r4b3,
  );

  const candidateId =
    requiredString(
      candidateMemoryId,
      "candidateMemoryId",
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_CANDIDATE_REQUIRED",
    );

  if (
    !monitoring.candidate_ids.includes(
      candidateId,
    )
  ) {
    const error = new Error(
      "Competition probe candidate must belong to the Phase64A-R4C initial candidate frontier.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_PROBE_CANDIDATE_UNKNOWN";
    throw error;
  }

  const peerIds =
    monitoring.candidate_ids.filter(
      (memoryId) => memoryId !== candidateId,
    );

  let incompleteSeen = false;
  let evaluatedPeerCount = 0;

  for (const peerId of peerIds) {
    const comparison =
      compareWorldSimulationAssociativeCompositionEvidence(
        r4b3.evidence,
        candidateId,
        peerId,
      );

    evaluatedPeerCount += 1;

    if (
      comparison.relation
      === "right_evidence_dominates"
    ) {
      const report = {
        candidate_memory_id:
          candidateId,
        peer_candidate_count:
          peerIds.length,
        evaluated_peer_count:
          evaluatedPeerCount,
        complete_peer_scan:
          evaluatedPeerCount === peerIds.length,
        competition_status:
          "known_dominated_on_modeled_dimensions",
        dominator_witness_memory_id:
          peerId,
        source_r4b3_evidence_hash:
          r4b3.evidence_hash,
      };

      return deepFreeze(report);
    }

    if (
      comparison.relation
      === "not_comparable_due_to_incomplete_evidence"
    ) {
      incompleteSeen = true;
    }
  }

  const competitionStatus =
    incompleteSeen
      ? "not_certifiable_due_to_incomplete_evidence"
      : "undominated_on_modeled_dimensions";

  if (!allowedCompetitionStatuses.has(competitionStatus)) {
    const error = new Error(
      "Unexpected Phase64A-R4C competition status.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_COMPETITION_MONITORING_STATUS_INVALID";
    throw error;
  }

  return deepFreeze({
    candidate_memory_id:
      candidateId,
    peer_candidate_count:
      peerIds.length,
    evaluated_peer_count:
      evaluatedPeerCount,
    complete_peer_scan:
      true,
    competition_status:
      competitionStatus,
    source_r4b3_evidence_hash:
      r4b3.evidence_hash,
  });
}
