import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationContextualSchemaRefinementEvidenceVersion,
} from "./world-simulation-contextual-schema-refinement-evidence-service.mjs";

export const worldSimulationContextualSchemaSpecializationVersion =
  "phase78b-contextual-schema-specialization-v1";

const maximumNarrowingQualifiers = 4;
const maximumEvidenceRefsPerGrounding = 8;
const forbiddenProposalKeys = new Set([
  "predicate",
  "object_ref",
  "semantic_descriptor",
  "semantic_memory_id",
  "semantic_key",
  "knowledge_status",
  "state",
  "confidence",
  "confidence_score",
  "probability",
  "probability_score",
  "similarity",
  "similarity_score",
  "success_rate",
  "failure_rate",
  "reward",
  "q_value",
  "utility",
  "world_truth",
  "causal_evidence",
  "causal_chain",
  "raw_action_outcome",
  "world_state",
]);

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
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label, maxLength = 300) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} is required and must be at most ${maxLength} characters.`);
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_INPUT_INVALID";
    throw error;
  }
  return text;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function verifyNoForbiddenKeys(value, path = "proposal") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => verifyNoForbiddenKeys(child, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenProposalKeys.has(String(key).toLowerCase())) {
      const error = new Error(`Phase78B proposal contains forbidden authority field ${path}.${key}.`);
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
    verifyNoForbiddenKeys(child, `${path}.${key}`);
  }
}

function verifyPhase78AEvidence(value) {
  const source = object(value);
  if (source.version !== worldSimulationContextualSchemaRefinementEvidenceVersion
      || !optionalString(source.evidence_hash)
      || !isObject(source.resolver_view)
      || source.resolver_view.version !== worldSimulationContextualSchemaRefinementEvidenceVersion
      || !optionalString(source.resolver_view.resolver_view_hash)
      || !Array.isArray(source.resolver_view.refinement_candidates)
      || !Array.isArray(source.internal_lineage)) {
    const error = new Error("Phase78B requires one canonical Phase78A refinement-evidence projection.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_PHASE78A_INVALID";
    throw error;
  }
  const resolverBody = cloneJson(source.resolver_view);
  const resolverHash = resolverBody.resolver_view_hash;
  delete resolverBody.resolver_view_hash;
  if (hashAgentRunValue(resolverBody) !== resolverHash) {
    const error = new Error("Phase78B Phase78A resolver-view hash verification failed.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_PHASE78A_HASH_MISMATCH";
    throw error;
  }
  const evidenceBody = cloneJson(source);
  const evidenceHash = evidenceBody.evidence_hash;
  delete evidenceBody.evidence_hash;
  if (hashAgentRunValue(evidenceBody) !== evidenceHash) {
    const error = new Error("Phase78B Phase78A evidence hash verification failed.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_PHASE78A_HASH_MISMATCH";
    throw error;
  }
  return source;
}

export function buildWorldSimulationContextualSchemaSpecializationContract() {
  return deepFreeze({
    version: worldSimulationContextualSchemaSpecializationVersion,
    phase: "Phase78B",
    status: "bounded_contextual_schema_specialization_proposals_installed",
    source_owner: "Phase78A",
    source_phase78a_exact_hash_verified: true,
    source_schema_predicate_preserved: true,
    source_schema_object_ref_preserved: true,
    source_schema_qualifiers_preserved: true,
    additive_narrowing_qualifiers_only: true,
    maximum_narrowing_qualifiers: maximumNarrowingQualifiers,
    support_and_counterexample_grounding_required: true,
    current_turn_counterexample_grounding_required: true,
    source_contested_state_preserved: true,
    source_history_rewrite_allowed: false,
    schema_output: "proposal_only",
    durable_semantic_write_performed: false,
    phase67c_durable_semantic_owner: true,
    future_admission_owner: "Phase78C",
    numeric_similarity_confidence_probability_modeled: false,
    world_truth_authority_claimed: false,
    raw_world_state_exposed: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    internal_semantic_identity_exposed_to_resolver: false,
    direct_belief_plan_goal_current_mind_world_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
  });
}

export function buildWorldSimulationContextualSchemaSpecializationResolverView(input = {}) {
  const evidence = verifyPhase78AEvidence(input.contextual_schema_refinement_evidence);
  const view = {
    version: worldSimulationContextualSchemaSpecializationVersion,
    source_phase78a_version: evidence.version,
    source_phase78a_evidence_hash: evidence.evidence_hash,
    turn_id: requiredString(evidence.turn_id, "Phase78A turn_id", 500),
    refinement_candidates: cloneJson(array(evidence.resolver_view.refinement_candidates)),
    proposal_contract: {
      refinement_candidate_ref_required: true,
      source_predicate_and_object_ref_are_immutable: true,
      existing_qualifiers_are_immutable: true,
      additive_narrowing_qualifiers_only: true,
      maximum_narrowing_qualifiers: maximumNarrowingQualifiers,
      each_new_qualifier_requires_contrast_grounding: true,
      each_contrast_grounding_requires_support_and_counterexample_refs: true,
      at_least_one_grounding_must_include_current_turn_counterexample: true,
      output_is_reviewable_proposal_only: true,
    },
    boundaries: {
      phase78a_internal_lineage_exposed: false,
      source_semantic_memory_id_exposed: false,
      source_semantic_key_exposed: false,
      source_life_event_identity_exposed: false,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      durable_semantic_write_requested: false,
      source_contested_state_resolution_requested: false,
      numeric_similarity_confidence_probability_requested: false,
      character_brain_feedback_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizedRefs(rawRefs, label, allowedRefs) {
  const refs = array(rawRefs).map((value, index) =>
    requiredString(value, `${label}[${index}]`, 200));
  if (!refs.length || refs.length > maximumEvidenceRefsPerGrounding
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowedRefs.has(ref))) {
    const error = new Error(`Phase78B ${label} must be a unique non-empty bounded set from the candidate evidence.`);
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_GROUNDING_INVALID";
    throw error;
  }
  return [...refs].sort(compareText);
}

export function projectWorldSimulationContextualSchemaSpecialization(input = {}) {
  const evidence = verifyPhase78AEvidence(input.contextual_schema_refinement_evidence);
  const resolverView = buildWorldSimulationContextualSchemaSpecializationResolverView({
    contextual_schema_refinement_evidence: evidence,
  });
  const suppliedHash = optionalString(input.resolver_view_hash);
  if (suppliedHash && suppliedHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase78B resolver-view hash does not match canonical Phase78A evidence.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_RESOLVER_VIEW_MISMATCH";
    throw error;
  }
  if (!Array.isArray(input.specialization_proposals ?? [])) {
    const error = new Error("Phase78B specialization_proposals must be an array.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_INPUT_INVALID";
    throw error;
  }
  const candidates = new Map(array(resolverView.refinement_candidates)
    .map((candidate) => [candidate?.refinement_candidate_ref, candidate]));
  const lineageByRef = new Map(array(evidence.internal_lineage)
    .map((entry) => [entry?.refinement_candidate_ref, entry]));
  const proposals = [];
  const internalLineage = [];
  const seenCandidates = new Set();

  for (const raw of input.specialization_proposals ?? []) {
    verifyNoForbiddenKeys(raw);
    const proposal = object(raw);
    const candidateRef = requiredString(
      proposal.refinement_candidate_ref,
      "refinement_candidate_ref",
      200,
    );
    if (seenCandidates.has(candidateRef)) {
      const error = new Error("Phase78B accepts at most one specialization proposal per refinement candidate.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_DUPLICATE_CANDIDATE";
      throw error;
    }
    const candidate = candidates.get(candidateRef);
    const sourceLineage = lineageByRef.get(candidateRef);
    if (!candidate || !sourceLineage) {
      const error = new Error(`Phase78B proposal references unknown refinement candidate ${candidateRef}.`);
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_CANDIDATE_INVALID";
      throw error;
    }
    const baseQualifiers = array(candidate.source_schema?.qualifiers)
      .map((value, index) => requiredString(value, `source qualifier ${index}`, 300))
      .sort(compareText);
    const rawQualifiers = array(proposal.narrowing_qualifiers)
      .map((value, index) => requiredString(value, `narrowing_qualifiers[${index}]`, 300));
    const narrowingQualifiers = [...new Set(rawQualifiers)].sort(compareText);
    if (!narrowingQualifiers.length
        || narrowingQualifiers.length !== rawQualifiers.length
        || narrowingQualifiers.length > maximumNarrowingQualifiers
        || narrowingQualifiers.some((qualifier) => baseQualifiers.includes(qualifier))) {
      const error = new Error("Phase78B requires 1-4 unique genuinely new narrowing qualifiers.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_QUALIFIER_INVALID";
      throw error;
    }

    const supportRefs = new Set(array(candidate.supporting_experience_evidence)
      .map((item) => item?.evidence_ref).filter(Boolean));
    const counterRefs = new Set(array(candidate.counterexample_experience_evidence)
      .map((item) => item?.evidence_ref).filter(Boolean));
    const currentCounterRefs = new Set(array(candidate.counterexample_experience_evidence)
      .filter((item) => item?.current_turn_counterexample === true)
      .map((item) => item?.evidence_ref).filter(Boolean));
    const groundingByQualifier = new Map();
    for (const [index, rawGrounding] of array(proposal.contrast_groundings).entries()) {
      const grounding = object(rawGrounding);
      const qualifier = requiredString(
        grounding.qualifier,
        `contrast_groundings[${index}].qualifier`,
        300,
      );
      if (!narrowingQualifiers.includes(qualifier) || groundingByQualifier.has(qualifier)) {
        const error = new Error("Phase78B contrast grounding must map one-to-one to each narrowing qualifier.");
        error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_GROUNDING_INVALID";
        throw error;
      }
      groundingByQualifier.set(qualifier, {
        qualifier,
        supporting_evidence_refs: normalizedRefs(
          grounding.supporting_evidence_refs,
          "supporting_evidence_refs",
          supportRefs,
        ),
        counterexample_evidence_refs: normalizedRefs(
          grounding.counterexample_evidence_refs,
          "counterexample_evidence_refs",
          counterRefs,
        ),
      });
    }
    if (groundingByQualifier.size !== narrowingQualifiers.length) {
      const error = new Error("Phase78B requires exactly one contrast grounding per narrowing qualifier.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_GROUNDING_INVALID";
      throw error;
    }
    const groundings = narrowingQualifiers.map((qualifier) => groundingByQualifier.get(qualifier));
    if (!groundings.some((grounding) =>
      grounding.counterexample_evidence_refs.some((ref) => currentCounterRefs.has(ref)))) {
      const error = new Error("Phase78B specialization must ground at least one qualifier in a current-turn counterexample.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_CURRENT_COUNTEREXAMPLE_REQUIRED";
      throw error;
    }

    const specializedDescriptor = {
      predicate: requiredString(candidate.source_schema?.predicate, "source predicate", 300),
      object_ref: requiredString(candidate.source_schema?.object_ref, "source object_ref", 800),
      qualifiers: [...baseQualifiers, ...narrowingQualifiers].sort(compareText),
    };
    const identity = {
      version: worldSimulationContextualSchemaSpecializationVersion,
      source_phase78a_evidence_hash: evidence.evidence_hash,
      refinement_candidate_ref: candidateRef,
      specialized_descriptor: specializedDescriptor,
      contrast_groundings: groundings,
    };
    const proposalRef = `phase78b_specialization_${hashAgentRunValue(identity).slice(0, 24)}`;
    proposals.push({
      specialization_proposal_ref: proposalRef,
      refinement_candidate_ref: candidateRef,
      character: candidate.character,
      source_schema: cloneJson(candidate.source_schema),
      narrowing_qualifiers: narrowingQualifiers,
      specialized_descriptor: specializedDescriptor,
      contrast_groundings: groundings,
      source_contested_state_preserved: true,
      source_history_rewrite_performed: false,
      subjective_pattern_not_world_truth: true,
      proposal_only: true,
      durable_semantic_write_performed: false,
    });
    internalLineage.push({
      specialization_proposal_ref: proposalRef,
      refinement_candidate_ref: candidateRef,
      source_semantic_memory_id: sourceLineage.source_semantic_memory_id,
      source_semantic_key: sourceLineage.source_semantic_key,
      source_semantic_descriptor_hash: sourceLineage.source_semantic_descriptor_hash,
    });
    seenCandidates.add(candidateRef);
  }

  proposals.sort((left, right) => compareText(
    left.specialization_proposal_ref,
    right.specialization_proposal_ref,
  ));
  internalLineage.sort((left, right) => compareText(
    left.specialization_proposal_ref,
    right.specialization_proposal_ref,
  ));
  const projection = {
    version: worldSimulationContextualSchemaSpecializationVersion,
    turn_id: resolverView.turn_id,
    source_phase78a_evidence_hash: evidence.evidence_hash,
    resolver_view_hash: resolverView.resolver_view_hash,
    specialization_proposals: proposals,
    proposal_count: proposals.length,
    internal_lineage: internalLineage,
    audit: {
      exact_phase78a_source_verified: true,
      source_predicate_preserved: true,
      source_object_ref_preserved: true,
      source_qualifiers_preserved: true,
      additive_narrowing_qualifiers_only: true,
      support_and_counterexample_grounding_required: true,
      current_turn_counterexample_grounding_required: true,
      source_contested_state_preserved: true,
      source_history_rewrite_performed: false,
      durable_semantic_write_performed: false,
      phase67c_semantic_decision_emitted: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_modeled: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
