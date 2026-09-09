import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  worldSimulationRelationalSchemaInductionVersion,
} from "./world-simulation-relational-schema-induction-service.mjs";
import {
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";

export const worldSimulationRelationalSchemaPromotionVersion =
  "phase77c-relational-schema-promotion-v1";

const allowedDecisionKeys = new Set([
  "proposal_ref",
  "decision",
  "reason",
]);

const forbiddenDecisionKeys = new Set([
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
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_INPUT_INVALID";
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
function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
function verifyNoForbiddenKeys(value, path = "promotion_decision") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => verifyNoForbiddenKeys(child, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenDecisionKeys.has(String(key).toLowerCase())) {
      const error = new Error(`Phase77C promotion decision contains forbidden field ${path}.${key}.`);
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_FORBIDDEN_FIELD";
      throw error;
    }
    verifyNoForbiddenKeys(child, `${path}.${key}`);
  }
}

function verifyPromotionDecisionShape(value) {
  verifyNoForbiddenKeys(value);
  if (!isObject(value)) {
    const error = new Error("Phase77C promotion decision must be an object.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DECISION_INVALID";
    throw error;
  }
  const unknownKeys = Object.keys(value)
    .filter((key) => !allowedDecisionKeys.has(key));
  if (unknownKeys.length) {
    const error = new Error(
      `Phase77C promoter may author only proposal_ref, decision, and reason; unexpected field(s): ${unknownKeys.join(", ")}.`,
    );
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DECISION_SHAPE_INVALID";
    throw error;
  }
}

function verifyPhase77BProjection(value) {
  const projection = object(value);
  if (
    projection.version !== worldSimulationRelationalSchemaInductionVersion
    || !optionalString(projection.turn_id)
    || !optionalString(projection.projection_hash)
    || !Array.isArray(projection.schema_proposals)
    || !Array.isArray(projection.internal_lineage)
  ) {
    const error = new Error("Phase77C requires one canonical Phase77B relational schema projection.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_PHASE77B_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  const projectionHash = body.projection_hash;
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projectionHash) {
    const error = new Error("Phase77C Phase77B projection hash verification failed.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_PHASE77B_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function durableDescriptorEligibility(value) {
  const descriptor = object(value);
  const reasons = [];
  const predicate = optionalString(descriptor.predicate);
  const objectRef = optionalString(descriptor.object_ref);
  const qualifiers = array(descriptor.qualifiers);
  if (!predicate || predicate.length > 160) reasons.push("predicate_outside_phase67c_bound");
  if (!objectRef || objectRef.length > 320) reasons.push("object_ref_outside_phase67c_bound");
  if (qualifiers.length > 16) reasons.push("qualifier_count_outside_phase67c_bound");
  const normalizedQualifiers = [];
  for (const raw of qualifiers) {
    const text = optionalString(raw);
    if (!text || text.length > 160) {
      reasons.push("qualifier_outside_phase67c_bound");
      continue;
    }
    normalizedQualifiers.push(text);
  }
  if (new Set(normalizedQualifiers).size !== normalizedQualifiers.length) {
    reasons.push("duplicate_qualifier_outside_phase67c_contract");
  }
  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    descriptor: reasons.length === 0
      ? {
        predicate,
        object_ref: objectRef,
        qualifiers: [...normalizedQualifiers].sort(compareText),
      }
      : null,
  };
}

function lineageForProposal(projection, proposal) {
  const lineageMatches = array(projection.internal_lineage)
    .filter((item) => item?.proposal_ref === proposal.proposal_ref);
  if (lineageMatches.length !== 1) {
    const error = new Error(`Phase77C requires exactly one internal lineage record for ${proposal.proposal_ref}.`);
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_LINEAGE_INVALID";
    throw error;
  }
  const lineage = object(lineageMatches[0]);
  if (characterKey(lineage.character) !== characterKey(proposal.character)) {
    const error = new Error("Phase77C proposal and internal lineage character do not match.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_LINEAGE_INVALID";
    throw error;
  }
  const proposalRefs = [...array(proposal.source_evidence_refs)].sort(compareText);
  const lineageRefs = [...array(lineage.source_evidence_refs)].sort(compareText);
  if (!sameValue(proposalRefs, lineageRefs)) {
    const error = new Error("Phase77C proposal evidence refs do not match canonical Phase77B lineage.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_LINEAGE_INVALID";
    throw error;
  }
  const lifeEventRefs = array(lineage.source_life_event_refs).map((item, index) => ({
    life_event_id: requiredString(item?.life_event_id, `source_life_event_refs[${index}].life_event_id`, 500),
    organization_event_id: requiredString(
      item?.latest_organization_event_id,
      `source_life_event_refs[${index}].latest_organization_event_id`,
      500,
    ),
    organization_event_hash: requiredString(
      item?.latest_organization_event_hash,
      `source_life_event_refs[${index}].latest_organization_event_hash`,
      200,
    ),
  })).sort((left, right) => compareText(left.organization_event_id, right.organization_event_id));
  if (new Set(lifeEventRefs.map((item) => item.life_event_id)).size < 2) {
    const error = new Error("Phase77C promotion requires at least two distinct canonical LifeEvents.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DISTINCT_LIFE_EVENTS_REQUIRED";
    throw error;
  }
  return {
    ...lineage,
    source_life_event_refs: lifeEventRefs,
  };
}

function exactExistingSemanticMatches(worldState, character, descriptor) {
  const effective = projectWorldSimulationEffectivePersonalSemanticMemories({
    world_state: worldState,
  });
  let memories = {};
  const wantedCharacter = characterKey(character);
  for (const [name, items] of Object.entries(effective.memories_by_character ?? {})) {
    if (characterKey(name) === wantedCharacter) {
      memories = object(items);
      break;
    }
  }
  const targetDescriptor = {
    subject_scope: "self_autobiographical_experience",
    predicate: descriptor.predicate,
    object_ref: descriptor.object_ref,
    qualifiers: [...descriptor.qualifiers].sort(compareText),
  };
  return Object.values(memories)
    .filter((memory) => (
      memory?.semantic_category === "recurring_event_pattern"
      && sameValue(memory?.semantic_descriptor, targetDescriptor)
    ))
    .sort((left, right) => compareText(left.semantic_memory_id, right.semantic_memory_id));
}

export function buildWorldSimulationRelationalSchemaPromotionContract() {
  return deepFreeze({
    version: worldSimulationRelationalSchemaPromotionVersion,
    phase: "Phase77C",
    status: "explicit_relational_schema_semantic_promotion_installed",
    source_owner: "Phase77B",
    source_projection: worldSimulationRelationalSchemaInductionVersion,
    durable_semantic_owner: worldSimulationPersonalSemanticMemoryVersion,
    promotion_is_explicit_programmatic_decision: true,
    missing_promoter_means_no_promotion: true,
    same_character_only: true,
    minimum_distinct_life_events: 2,
    exact_phase77b_projection_hash_required: true,
    exact_phase77b_internal_lineage_required: true,
    exact_resolver_view_hash_required: true,
    phase67c_descriptor_bounds_required: true,
    descriptor_truncation_or_rewrite_allowed: false,
    semantic_category: "recurring_event_pattern",
    exact_existing_descriptor_match_may_support: true,
    fuzzy_similarity_auto_merge_allowed: false,
    ambiguous_exact_identity_auto_merge_allowed: false,
    recurrence_count_auto_promotes_schema: false,
    numeric_similarity_confidence_probability_modeled: false,
    world_truth_authority_claimed: false,
    direct_durable_semantic_write_allowed: false,
    phase67c_append_only_form_or_support_required: true,
    direct_belief_plan_goal_current_mind_world_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
  });
}

export function buildWorldSimulationRelationalSchemaPromotionResolverView(input = {}) {
  const projection = verifyPhase77BProjection(input.relational_schema_induction);
  const candidates = array(projection.schema_proposals).map((proposal) => {
    const eligibility = durableDescriptorEligibility(proposal?.schema_descriptor);
    return {
      proposal_ref: requiredString(proposal?.proposal_ref, "Phase77B proposal_ref", 200),
      character: requiredString(proposal?.character, "Phase77B character", 300),
      mapping_kind: proposal?.mapping_kind,
      schema_descriptor: cloneJson(proposal?.schema_descriptor),
      source_evidence_count: array(proposal?.source_evidence_refs).length,
      promotion_eligible: eligibility.eligible,
      ineligibility_reasons: eligibility.reasons,
      subjective_pattern_not_world_truth: proposal?.subjective_pattern_not_world_truth === true,
    };
  }).sort((left, right) => compareText(left.proposal_ref, right.proposal_ref));
  const view = {
    version: worldSimulationRelationalSchemaPromotionVersion,
    source_phase77b_version: projection.version,
    source_phase77b_projection_hash: projection.projection_hash,
    turn_id: requiredString(projection.turn_id, "Phase77B turn_id", 500),
    candidates,
    decision_contract: {
      decision_shape: ["proposal_ref", "decision", "reason"],
      allowed_decisions: ["promote", "skip"],
      promoter_may_author_schema_content: false,
      promoter_may_choose_semantic_identity: false,
      promoter_may_choose_form_or_support_operation: false,
      only_promotion_eligible_candidates_may_be_promoted: true,
    },
    boundaries: {
      phase77b_internal_lineage_exposed: false,
      life_event_ids_exposed: false,
      organization_event_ids_exposed: false,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      existing_semantic_store_exposed: false,
      fuzzy_similarity_requested: false,
      confidence_probability_requested: false,
      durable_write_requested: false,
      same_turn_character_brain_feedback_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

export function projectWorldSimulationRelationalSchemaPromotion(input = {}) {
  const projection = verifyPhase77BProjection(input.relational_schema_induction);
  const resolverView = buildWorldSimulationRelationalSchemaPromotionResolverView({
    relational_schema_induction: projection,
  });
  const expectedResolverHash = requiredString(
    input.resolver_view_hash,
    "resolver_view_hash",
    128,
  );
  if (expectedResolverHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase77C resolver-view hash does not match the canonical Phase77B projection.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_RESOLVER_VIEW_MISMATCH";
    throw error;
  }
  if (
    input.promotion_decisions !== undefined
    && !Array.isArray(input.promotion_decisions)
  ) {
    const error = new Error("Phase77C promotion_decisions must be an array when provided.");
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DECISION_INVALID";
    throw error;
  }
  const worldState = cloneJson(object(input.world_state));
  const proposalByRef = new Map(
    array(projection.schema_proposals).map((proposal) => [proposal?.proposal_ref, proposal]),
  );
  const candidateByRef = new Map(
    array(resolverView.candidates).map((candidate) => [candidate.proposal_ref, candidate]),
  );
  const seenDecisionRefs = new Set();
  const promotions = [];
  const semanticDecisions = [];
  const seenSemanticDecisionIdentities = new Set();
  let skippedCount = 0;
  let ambiguousExactIdentityCount = 0;

  for (const rawDecision of array(input.promotion_decisions)) {
    verifyPromotionDecisionShape(rawDecision);
    const decision = object(rawDecision);
    const proposalRef = requiredString(decision.proposal_ref, "promotion_decision.proposal_ref", 200);
    if (seenDecisionRefs.has(proposalRef)) {
      const error = new Error(`Phase77C received duplicate promotion decision for ${proposalRef}.`);
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DECISION_DUPLICATE";
      throw error;
    }
    seenDecisionRefs.add(proposalRef);
    const proposal = proposalByRef.get(proposalRef);
    const candidate = candidateByRef.get(proposalRef);
    if (!proposal || !candidate) {
      const error = new Error(`Phase77C cannot resolve Phase77B proposal ${proposalRef}.`);
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_PROPOSAL_UNRESOLVED";
      throw error;
    }
    const disposition = requiredString(decision.decision, "promotion_decision.decision", 40);
    if (disposition !== "promote" && disposition !== "skip") {
      const error = new Error("Phase77C decision must be promote or skip.");
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DECISION_INVALID";
      throw error;
    }
    if (disposition === "skip") {
      skippedCount += 1;
      promotions.push({
        proposal_ref: proposalRef,
        character: proposal.character,
        decision: "skip",
        reason: optionalString(decision.reason) ?? "explicit_programmatic_skip",
        phase67c_operation: null,
        semantic_memory_id: null,
      });
      continue;
    }
    if (candidate.promotion_eligible !== true) {
      const error = new Error(`Phase77C cannot promote ${proposalRef} because its descriptor is outside the durable Phase67C contract.`);
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DESCRIPTOR_NOT_DURABLE";
      throw error;
    }
    const eligibility = durableDescriptorEligibility(proposal.schema_descriptor);
    const lineage = lineageForProposal(projection, proposal);
    const matches = exactExistingSemanticMatches(
      worldState,
      proposal.character,
      eligibility.descriptor,
    );
    if (matches.length > 1) {
      ambiguousExactIdentityCount += 1;
      skippedCount += 1;
      promotions.push({
        proposal_ref: proposalRef,
        character: proposal.character,
        decision: "skip",
        reason: "ambiguous_exact_existing_semantic_identity",
        phase67c_operation: null,
        semantic_memory_id: null,
      });
      continue;
    }
    const existing = matches[0] ?? null;
    const descriptorHash = hashAgentRunValue(eligibility.descriptor);
    const semanticKey = existing?.semantic_key
      ?? `relational_schema:${descriptorHash.slice(0, 40)}`;
    const semanticDecisionIdentity = existing?.semantic_memory_id
      ? `${characterKey(proposal.character)}\u0000existing:${existing.semantic_memory_id}`
      : `${characterKey(proposal.character)}\u0000new:${descriptorHash}`;
    if (seenSemanticDecisionIdentities.has(semanticDecisionIdentity)) {
      const error = new Error(
        `Phase77C received multiple promoted proposals for the same durable semantic identity in one turn: ${proposalRef}.`,
      );
      error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DUPLICATE_SEMANTIC_IDENTITY_IN_TURN";
      throw error;
    }
    seenSemanticDecisionIdentities.add(semanticDecisionIdentity);
    const semanticDecision = {
      character: proposal.character,
      operation: existing ? "support" : "form",
      semantic_category: "recurring_event_pattern",
      semantic_key: semanticKey,
      ...(existing ? { semantic_memory_id: existing.semantic_memory_id } : {}),
      semantic_descriptor: cloneJson(eligibility.descriptor),
      source_life_event_refs: cloneJson(lineage.source_life_event_refs),
      reason: optionalString(decision.reason) ?? "explicit_phase77c_relational_schema_promotion",
      source: "programmatic_personal_semantic_memory_resolver",
    };
    semanticDecisions.push(semanticDecision);
    promotions.push({
      proposal_ref: proposalRef,
      character: proposal.character,
      decision: "promote",
      reason: semanticDecision.reason,
      phase67c_operation: semanticDecision.operation,
      semantic_memory_id: existing?.semantic_memory_id ?? null,
      semantic_key: semanticKey,
      descriptor_hash: descriptorHash,
      exact_existing_identity_reused: Boolean(existing),
    });
  }

  promotions.sort((left, right) => compareText(left.proposal_ref, right.proposal_ref));
  semanticDecisions.sort((left, right) => {
    const character = characterKey(left.character).localeCompare(characterKey(right.character), "en");
    if (character !== 0) return character;
    return compareText(left.semantic_key, right.semantic_key);
  });
  const result = {
    version: worldSimulationRelationalSchemaPromotionVersion,
    turn_id: resolverView.turn_id,
    source_phase77b_version: projection.version,
    source_phase77b_projection_hash: projection.projection_hash,
    resolver_view_hash: resolverView.resolver_view_hash,
    promotions,
    promotion_decision_count: seenDecisionRefs.size,
    emitted_phase67c_semantic_decision_count: semanticDecisions.length,
    semantic_decisions: semanticDecisions,
    audit: {
      phase77b_projection_hash_verified: true,
      exact_internal_lineage_required_for_promoted_schema: true,
      minimum_distinct_life_events_required: true,
      explicit_programmatic_promotion_required: true,
      missing_decision_means_no_promotion: true,
      descriptor_truncation_or_rewrite_used: false,
      phase67c_descriptor_bounds_enforced: true,
      phase67c_durable_semantic_owner_preserved: true,
      append_only_form_or_support_only: true,
      exact_existing_descriptor_match_may_support: true,
      fuzzy_similarity_auto_merge_used: false,
      ambiguous_exact_identity_auto_merge_used: false,
      ambiguous_exact_identity_count: ambiguousExactIdentityCount,
      skipped_decision_count: skippedCount,
      recurrence_count_auto_promoted: false,
      numeric_similarity_confidence_probability_modeled: false,
      world_truth_authority_claimed: false,
      direct_durable_semantic_write_performed: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  result.projection_hash = hashAgentRunValue(result);
  return deepFreeze(result);
}
