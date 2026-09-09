import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationMultiExperienceSchemaEvidenceVersion,
} from "./world-simulation-multi-experience-schema-evidence-service.mjs";

export const worldSimulationRelationalSchemaInductionVersion =
  "phase77b-relational-schema-induction-v1";

const maximumSourceEvidencePerProposal = 8;
const maximumQualifiersPerProposal = 8;
const allowedGroundingFields = new Set([
  "action",
  "performed",
  "perceived_result",
  "perceived_status",
]);
const forbiddenProposalKeys = new Set([
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
function requiredString(value, label, maxLength = 1200) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} is required and must be at most ${maxLength} characters.`);
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_INPUT_INVALID";
    throw error;
  }
  return text;
}
function characterKey(value) {
  return requiredString(value, "character", 300).toLocaleLowerCase("zh-Hant-TW");
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
      const error = new Error(`Phase77B proposal contains forbidden field ${path}.${key}.`);
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_FORBIDDEN_FIELD";
      throw error;
    }
    verifyNoForbiddenKeys(child, `${path}.${key}`);
  }
}

function verifyPhase77AEvidence(evidence) {
  const source = object(evidence);
  if (source.version !== worldSimulationMultiExperienceSchemaEvidenceVersion
      || !optionalString(source.evidence_view_hash)
      || !isObject(source.resolver_view)
      || source.resolver_view.version !== worldSimulationMultiExperienceSchemaEvidenceVersion
      || !optionalString(source.resolver_view.resolver_view_hash)
      || !Array.isArray(source.resolver_view.character_contexts)
      || !Array.isArray(source.internal_lineage)) {
    const error = new Error("Phase77B requires one canonical Phase77A evidence projection.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_PHASE77A_INVALID";
    throw error;
  }
  const resolverBody = cloneJson(source.resolver_view);
  const resolverHash = resolverBody.resolver_view_hash;
  delete resolverBody.resolver_view_hash;
  if (hashAgentRunValue(resolverBody) !== resolverHash) {
    const error = new Error("Phase77B Phase77A resolver-view hash verification failed.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_PHASE77A_HASH_MISMATCH";
    throw error;
  }
  const evidenceBody = cloneJson(source);
  const evidenceHash = evidenceBody.evidence_view_hash;
  delete evidenceBody.evidence_view_hash;
  if (hashAgentRunValue(evidenceBody) !== evidenceHash) {
    const error = new Error("Phase77B Phase77A evidence-view hash verification failed.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_PHASE77A_HASH_MISMATCH";
    throw error;
  }
  return source;
}

function flattenedEvidence(context) {
  return [
    ...array(context.current_anchor_evidence),
    ...array(context.prior_comparison_evidence),
  ];
}

export function buildWorldSimulationRelationalSchemaInductionContract() {
  return deepFreeze({
    version: worldSimulationRelationalSchemaInductionVersion,
    phase: "Phase77B",
    status: "bounded_relational_schema_induction_installed",
    source_owner: "Phase77A",
    phase77a_exact_projection_hash_verified: true,
    same_character_only: true,
    minimum_distinct_life_events: 2,
    current_turn_anchor_must_participate: true,
    prior_comparison_evidence_must_participate: true,
    one_to_one_evidence_mapping_required: true,
    exact_experience_index_required: true,
    parallel_connectivity_required: true,
    systematicity_minimum_grounding_fields: ["action", "perceived_result"],
    schema_output: "proposal_only",
    semantic_descriptor_shape: ["predicate", "object_ref", "qualifiers"],
    phase67c_durable_semantic_owner: true,
    phase77c_promotion_owner: true,
    recurrence_count_auto_promotes_schema: false,
    surface_similarity_alone_is_sufficient: false,
    numeric_similarity_threshold_modeled: false,
    numeric_confidence_probability_modeled: false,
    raw_world_state_exposed: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    internal_life_event_episode_memory_lineage_exposed_to_resolver: false,
    direct_belief_plan_goal_current_mind_world_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
  });
}

export function buildWorldSimulationRelationalSchemaInductionResolverView(input = {}) {
  const evidence = verifyPhase77AEvidence(input.multi_experience_schema_evidence);
  const characterContexts = array(evidence.resolver_view.character_contexts)
    .filter((context) => context?.comparison_ready === true)
    .map((context) => ({
      character: requiredString(context.character, "Phase77A character", 300),
      current_anchor_evidence: cloneJson(array(context.current_anchor_evidence)),
      prior_comparison_evidence: cloneJson(array(context.prior_comparison_evidence)),
      minimum_distinct_life_events_for_schema: 2,
    }))
    .sort((left, right) => left.character.localeCompare(right.character, "zh-Hant-TW"));
  const resolverView = {
    version: worldSimulationRelationalSchemaInductionVersion,
    source_phase77a_version: evidence.version,
    source_phase77a_evidence_view_hash: evidence.evidence_view_hash,
    turn_id: requiredString(evidence.turn_id, "Phase77A turn_id", 500),
    character_contexts: characterContexts,
    proposal_contract: {
      mapping_kind: "relational_pattern",
      minimum_source_evidence_refs: 2,
      maximum_source_evidence_refs: maximumSourceEvidencePerProposal,
      source_refs_must_include_current_anchor: true,
      source_refs_must_include_prior_comparison: true,
      evidence_grounding_must_be_one_to_one: true,
      exact_experience_index_required: true,
      allowed_grounding_fields: [...allowedGroundingFields],
      required_grounding_fields_per_evidence: ["action", "perceived_result"],
      schema_descriptor_fields: ["predicate", "object_ref", "qualifiers"],
      schema_descriptor_is_subjective_pattern_proposal_not_world_truth: true,
    },
    boundaries: {
      phase77a_internal_lineage_exposed: false,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      other_character_private_state_exposed: false,
      numeric_similarity_confidence_probability_requested: false,
      recurrence_count_voting_requested: false,
      durable_semantic_write_requested: false,
      character_brain_feedback_requested: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  return deepFreeze(resolverView);
}

function normalizeDescriptor(raw) {
  const descriptor = object(raw);
  const qualifiers = array(descriptor.qualifiers).map((value, index) =>
    requiredString(value, `schema_descriptor.qualifiers[${index}]`, 300));
  if (qualifiers.length > maximumQualifiersPerProposal) {
    const error = new Error(`Phase77B schema descriptor supports at most ${maximumQualifiersPerProposal} qualifiers.`);
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_DESCRIPTOR_INVALID";
    throw error;
  }
  return {
    predicate: requiredString(descriptor.predicate, "schema_descriptor.predicate", 300),
    object_ref: requiredString(descriptor.object_ref, "schema_descriptor.object_ref", 800),
    qualifiers: [...new Set(qualifiers)].sort(compareText),
  };
}

export function projectWorldSimulationRelationalSchemaInduction(input = {}) {
  const evidence = verifyPhase77AEvidence(input.multi_experience_schema_evidence);
  const resolverView = buildWorldSimulationRelationalSchemaInductionResolverView({
    multi_experience_schema_evidence: evidence,
  });
  const expectedResolverHash = optionalString(input.resolver_view_hash);
  if (expectedResolverHash && expectedResolverHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase77B resolver-view hash does not match canonical Phase77A evidence.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_RESOLVER_VIEW_MISMATCH";
    throw error;
  }
  const contexts = new Map(
    array(resolverView.character_contexts).map((context) => [characterKey(context.character), context]),
  );
  const lineageByEvidenceRef = new Map(
    array(evidence.internal_lineage).map((item) => [item?.evidence_ref, item]),
  );
  const proposals = [];
  const internalLineage = [];
  const seenProposalIdentities = new Set();
  for (const rawProposal of array(input.schema_proposals)) {
    verifyNoForbiddenKeys(rawProposal);
    const proposal = object(rawProposal);
    if (proposal.mapping_kind !== "relational_pattern") {
      const error = new Error("Phase77B mapping_kind must be relational_pattern.");
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_MAPPING_KIND_INVALID";
      throw error;
    }
    const character = requiredString(proposal.character, "schema proposal character", 300);
    const context = contexts.get(characterKey(character));
    if (!context) {
      const error = new Error(`Phase77B proposal character ${character} has no comparison-ready Phase77A context.`);
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_CHARACTER_INVALID";
      throw error;
    }
    const evidenceByRef = new Map(
      flattenedEvidence(context).map((item) => [item?.evidence_ref, item]),
    );
    const currentRefs = new Set(array(context.current_anchor_evidence).map((item) => item?.evidence_ref));
    const priorRefs = new Set(array(context.prior_comparison_evidence).map((item) => item?.evidence_ref));
    const rawSourceRefs = array(proposal.source_evidence_refs)
      .map((value, index) => requiredString(value, `source_evidence_refs[${index}]`, 200));
    const sourceRefs = [...new Set(rawSourceRefs)];
    if (sourceRefs.length !== rawSourceRefs.length
        || sourceRefs.length < 2 || sourceRefs.length > maximumSourceEvidencePerProposal
        || !sourceRefs.some((ref) => currentRefs.has(ref))
        || !sourceRefs.some((ref) => priorRefs.has(ref))
        || sourceRefs.some((ref) => !evidenceByRef.has(ref))) {
      const error = new Error("Phase77B proposal must use 2-8 same-character Phase77A refs including current and prior evidence.");
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_EVIDENCE_REFS_INVALID";
      throw error;
    }
    const sourceLineage = sourceRefs.map((ref) => lineageByEvidenceRef.get(ref));
    if (sourceLineage.some((item) => !isObject(item)
        || characterKey(item.character) !== characterKey(character))) {
      const error = new Error("Phase77B source lineage must resolve to the same proposal character.");
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_CHARACTER_INVALID";
      throw error;
    }
    if (new Set(sourceLineage.map((item) => item.life_event_id)).size < 2) {
      const error = new Error("Phase77B proposal must preserve at least two distinct canonical LifeEvents.");
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_DISTINCT_LIFE_EVENTS_REQUIRED";
      throw error;
    }
    const groundings = array(proposal.evidence_groundings);
    if (groundings.length !== sourceRefs.length) {
      const error = new Error("Phase77B evidence grounding must map one-to-one onto source evidence refs.");
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID";
      throw error;
    }
    const groundingRefs = new Set();
    const normalizedGroundings = groundings.map((rawGrounding, index) => {
      const grounding = object(rawGrounding);
      const evidenceRef = requiredString(
        grounding.evidence_ref,
        `evidence_groundings[${index}].evidence_ref`,
        200,
      );
      if (!sourceRefs.includes(evidenceRef) || groundingRefs.has(evidenceRef)) {
        const error = new Error("Phase77B evidence grounding must use each source evidence ref exactly once.");
        error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID";
        throw error;
      }
      groundingRefs.add(evidenceRef);
      const fields = [...new Set(array(grounding.grounding_fields)
        .map((value, fieldIndex) => requiredString(
          value,
          `evidence_groundings[${index}].grounding_fields[${fieldIndex}]`,
          80,
        )))];
      if (fields.some((field) => !allowedGroundingFields.has(field))
          || !fields.includes("action")
          || !fields.includes("perceived_result")) {
        const error = new Error("Phase77B each evidence grounding must include action and perceived_result using only canonical fields.");
        error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID";
        throw error;
      }
      const evidenceItem = evidenceByRef.get(evidenceRef);
      const experiences = array(evidenceItem?.bounded_experiences);
      const experienceIndex = grounding.experience_index;
      if (!Number.isInteger(experienceIndex)
          || experienceIndex < 0
          || experienceIndex >= experiences.length) {
        const error = new Error(`Phase77B evidence ${evidenceRef} requires an exact valid experience_index.`);
        error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID";
        throw error;
      }
      const groundedExperience = object(experiences[experienceIndex]);
      if (!optionalString(groundedExperience.action)
          || !Object.hasOwn(groundedExperience, "perceived_result")) {
        const error = new Error(`Phase77B evidence ${evidenceRef} lacks the required action/result relational grounding.`);
        error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID";
        throw error;
      }
      return {
        evidence_ref: evidenceRef,
        experience_index: experienceIndex,
        grounding_fields: fields.sort(compareText),
      };
    }).sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
    const descriptor = normalizeDescriptor(proposal.schema_descriptor);
    const identity = {
      version: worldSimulationRelationalSchemaInductionVersion,
      character: characterKey(character),
      source_phase77a_evidence_view_hash: evidence.evidence_view_hash,
      source_evidence_refs: [...sourceRefs].sort(compareText),
      schema_descriptor: descriptor,
      evidence_groundings: normalizedGroundings,
    };
    const identityHash = hashAgentRunValue(identity);
    if (seenProposalIdentities.has(identityHash)) continue;
    seenProposalIdentities.add(identityHash);
    const proposalRef = `phase77b_schema_${identityHash.slice(0, 24)}`;
    proposals.push({
      proposal_ref: proposalRef,
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [...sourceRefs].sort(compareText),
      schema_descriptor: descriptor,
      evidence_groundings: normalizedGroundings,
      subjective_pattern_not_world_truth: true,
      durable_semantic_write_performed: false,
    });
    internalLineage.push({
      proposal_ref: proposalRef,
      character,
      source_evidence_refs: [...sourceRefs].sort(compareText),
      source_life_event_refs: sourceLineage
        .map((item) => ({
          life_event_id: item.life_event_id,
          latest_organization_event_id: item.latest_organization_event_id,
          latest_organization_event_hash: item.latest_organization_event_hash,
        }))
        .sort((left, right) => compareText(left.life_event_id, right.life_event_id)),
    });
  }
  proposals.sort((left, right) => compareText(left.proposal_ref, right.proposal_ref));
  internalLineage.sort((left, right) => compareText(left.proposal_ref, right.proposal_ref));
  const projection = {
    version: worldSimulationRelationalSchemaInductionVersion,
    turn_id: resolverView.turn_id,
    source_phase77a_version: evidence.version,
    source_phase77a_evidence_view_hash: evidence.evidence_view_hash,
    resolver_view_hash: resolverView.resolver_view_hash,
    schema_proposals: proposals,
    proposal_count: proposals.length,
    internal_lineage: internalLineage,
    audit: {
      comparison_ready_character_count: resolverView.character_contexts.length,
      one_to_one_evidence_mapping_verified: true,
      exact_experience_index_grounding_verified: true,
      current_anchor_and_prior_evidence_required: true,
      distinct_life_events_required: true,
      parallel_connectivity_required: true,
      systematicity_grounding_required: true,
      action_and_perceived_result_required_per_case: true,
      recurrence_count_auto_promoted: false,
      surface_similarity_alone_used: false,
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
