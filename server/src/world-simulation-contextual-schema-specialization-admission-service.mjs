import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationContextualSchemaRefinementEvidenceVersion,
} from "./world-simulation-contextual-schema-refinement-evidence-service.mjs";
import {
  worldSimulationContextualSchemaSpecializationVersion,
} from "./world-simulation-contextual-schema-specialization-service.mjs";
import {
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";

export const worldSimulationContextualSchemaSpecializationAdmissionVersion =
  "phase78c-contextual-schema-specialization-admission-v1";

const allowedDecisionKeys = new Set([
  "specialization_proposal_ref",
  "decision",
  "reason",
]);
const forbiddenDecisionKeys = new Set([
  "predicate",
  "object_ref",
  "qualifiers",
  "semantic_descriptor",
  "semantic_key",
  "semantic_memory_id",
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
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_INPUT_INVALID";
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
function verifyHashedProjection(value, version, hashField, label, code) {
  const projection = object(value);
  if (projection.version !== version || !optionalString(projection[hashField])) {
    const error = new Error(`Phase78C requires one canonical ${label} projection.`);
    error.code = code;
    throw error;
  }
  const body = cloneJson(projection);
  const expected = body[hashField];
  delete body[hashField];
  if (hashAgentRunValue(body) !== expected) {
    const error = new Error(`Phase78C ${label} hash verification failed.`);
    error.code = `${code}_HASH_MISMATCH`;
    throw error;
  }
  return projection;
}
function verifyDecisionShape(value) {
  if (!isObject(value)) {
    const error = new Error("Phase78C admission decision must be an object.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DECISION_INVALID";
    throw error;
  }
  const unknown = Object.keys(value).filter((key) => !allowedDecisionKeys.has(key));
  if (unknown.length) {
    const error = new Error(`Phase78C admission decision has unexpected field(s): ${unknown.join(", ")}.`);
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DECISION_SHAPE_INVALID";
    throw error;
  }
  for (const key of Object.keys(value)) {
    if (forbiddenDecisionKeys.has(key.toLowerCase())) {
      const error = new Error(`Phase78C admission decision contains forbidden authority field ${key}.`);
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
}
function phase78ALineageFor(evidence, refinementCandidateRef) {
  const matches = array(evidence.internal_lineage)
    .filter((item) => item?.refinement_candidate_ref === refinementCandidateRef);
  if (matches.length !== 1) {
    const error = new Error(`Phase78C requires exactly one Phase78A lineage record for ${refinementCandidateRef}.`);
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_LINEAGE_INVALID";
    throw error;
  }
  return object(matches[0]);
}
function phase78BLineageFor(projection, proposalRef) {
  const matches = array(projection.internal_lineage)
    .filter((item) => item?.specialization_proposal_ref === proposalRef);
  if (matches.length !== 1) {
    const error = new Error(`Phase78C requires exactly one Phase78B lineage record for ${proposalRef}.`);
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_LINEAGE_INVALID";
    throw error;
  }
  return object(matches[0]);
}
function canonicalLifeEventRefs(lineage) {
  const refs = [];
  const seen = new Set();
  for (const mapping of [
    ...array(lineage.supporting_evidence_lineage),
    ...array(lineage.counterexample_evidence_lineage),
  ]) {
    const ref = object(mapping.semantic_life_event_ref);
    const lifeEventId = requiredString(ref.life_event_id, "semantic_life_event_ref.life_event_id", 500);
    const organizationEventId = requiredString(
      ref.organization_event_id,
      "semantic_life_event_ref.organization_event_id",
      500,
    );
    const organizationEventHash = requiredString(
      ref.organization_event_hash,
      "semantic_life_event_ref.organization_event_hash",
      200,
    );
    const key = `${lifeEventId}\u0000${organizationEventId}\u0000${organizationEventHash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      life_event_id: lifeEventId,
      organization_event_id: organizationEventId,
      organization_event_hash: organizationEventHash,
    });
  }
  refs.sort((left, right) => compareText(left.organization_event_id, right.organization_event_id));
  if (new Set(refs.map((item) => item.life_event_id)).size < 2) {
    const error = new Error("Phase78C specialized recurring schema requires at least two distinct canonical LifeEvents.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DISTINCT_LIFE_EVENTS_REQUIRED";
    throw error;
  }
  return refs;
}
function exactExistingSemanticMatches(worldState, character, descriptor) {
  const effective = projectWorldSimulationEffectivePersonalSemanticMemories({ world_state: worldState });
  const wanted = characterKey(character);
  let memories = {};
  for (const [name, items] of Object.entries(effective.memories_by_character ?? {})) {
    if (characterKey(name) === wanted) {
      memories = object(items);
      break;
    }
  }
  const target = {
    subject_scope: "self_autobiographical_experience",
    predicate: descriptor.predicate,
    object_ref: descriptor.object_ref,
    qualifiers: [...array(descriptor.qualifiers)].sort(compareText),
  };
  return Object.values(memories)
    .filter((memory) => memory?.semantic_category === "recurring_event_pattern"
      && sameValue(memory?.semantic_descriptor, target))
    .sort((left, right) => compareText(left.semantic_memory_id, right.semantic_memory_id));
}
function sourceSemantic(worldState, character, semanticMemoryId, expectedDescriptorHash) {
  const effective = projectWorldSimulationEffectivePersonalSemanticMemories({ world_state: worldState });
  const wanted = characterKey(character);
  let memories = {};
  for (const [name, items] of Object.entries(effective.memories_by_character ?? {})) {
    if (characterKey(name) === wanted) {
      memories = object(items);
      break;
    }
  }
  const semantic = memories[semanticMemoryId] ?? null;
  if (!semantic
      || semantic.semantic_category !== "recurring_event_pattern"
      || semantic.state !== "contested"
      || semantic.semantic_descriptor_hash !== expectedDescriptorHash) {
    const error = new Error("Phase78C source semantic must still be the exact contested recurring-event schema from Phase78A.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_SOURCE_STALE";
    throw error;
  }
  return semantic;
}

export function buildWorldSimulationContextualSchemaSpecializationAdmissionContract() {
  return deepFreeze({
    version: worldSimulationContextualSchemaSpecializationAdmissionVersion,
    phase: "Phase78C",
    status: "explicit_contextual_schema_specialization_admission_installed",
    source_owner: "Phase78B",
    source_evidence_owner: "Phase78A",
    durable_semantic_owner: worldSimulationPersonalSemanticMemoryVersion,
    explicit_admit_or_skip_required: true,
    missing_admitter_means_no_admission: true,
    exact_phase78a_hash_required: true,
    exact_phase78b_hash_required: true,
    source_contested_schema_must_still_exist: true,
    source_contested_state_preserved: true,
    source_history_rewrite_allowed: false,
    narrowed_descriptor_only: true,
    phase67c_append_only_form_or_support_required: true,
    exact_existing_specialized_descriptor_may_support: true,
    fuzzy_similarity_auto_merge_allowed: false,
    direct_durable_semantic_write_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    world_truth_authority_claimed: false,
    numeric_similarity_confidence_probability_modeled: false,
  });
}

export function buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView(input = {}) {
  const evidence = verifyHashedProjection(
    input.contextual_schema_refinement_evidence,
    worldSimulationContextualSchemaRefinementEvidenceVersion,
    "evidence_hash",
    "Phase78A evidence",
    "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_PHASE78A_INVALID",
  );
  const projection = verifyHashedProjection(
    input.contextual_schema_specialization,
    worldSimulationContextualSchemaSpecializationVersion,
    "projection_hash",
    "Phase78B specialization",
    "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_PHASE78B_INVALID",
  );
  if (projection.source_phase78a_evidence_hash !== evidence.evidence_hash
      || projection.turn_id !== evidence.turn_id) {
    const error = new Error("Phase78C Phase78A/78B source linkage does not match.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_SOURCE_MISMATCH";
    throw error;
  }
  const candidates = array(projection.specialization_proposals).map((proposal) => ({
    specialization_proposal_ref: requiredString(
      proposal?.specialization_proposal_ref,
      "specialization_proposal_ref",
      200,
    ),
    refinement_candidate_ref: requiredString(
      proposal?.refinement_candidate_ref,
      "refinement_candidate_ref",
      200,
    ),
    character: requiredString(proposal?.character, "character", 300),
    source_schema: cloneJson(proposal?.source_schema),
    narrowing_qualifiers: cloneJson(array(proposal?.narrowing_qualifiers)),
    specialized_descriptor: cloneJson(proposal?.specialized_descriptor),
    subjective_pattern_not_world_truth: proposal?.subjective_pattern_not_world_truth === true,
    admission_eligible: proposal?.proposal_only === true
      && proposal?.source_contested_state_preserved === true
      && proposal?.durable_semantic_write_performed === false,
  })).sort((left, right) => compareText(
    left.specialization_proposal_ref,
    right.specialization_proposal_ref,
  ));
  const view = {
    version: worldSimulationContextualSchemaSpecializationAdmissionVersion,
    source_phase78a_evidence_hash: evidence.evidence_hash,
    source_phase78b_projection_hash: projection.projection_hash,
    turn_id: projection.turn_id,
    candidates,
    decision_contract: {
      decision_shape: ["specialization_proposal_ref", "decision", "reason"],
      allowed_decisions: ["admit", "skip"],
      admitter_may_author_schema_content: false,
      admitter_may_choose_semantic_identity: false,
      admitter_may_choose_phase67c_operation: false,
      only_admission_eligible_candidates_may_be_admitted: true,
    },
    boundaries: {
      phase78a_internal_lineage_exposed: false,
      phase78b_internal_lineage_exposed: false,
      source_semantic_identity_exposed: false,
      life_event_identity_exposed: false,
      existing_semantic_store_exposed: false,
      raw_world_state_exposed: false,
      hidden_causal_evidence_exposed: false,
      durable_write_requested: false,
      source_contested_state_resolution_requested: false,
      character_brain_feedback_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

export function projectWorldSimulationContextualSchemaSpecializationAdmission(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const evidence = verifyHashedProjection(
    input.contextual_schema_refinement_evidence,
    worldSimulationContextualSchemaRefinementEvidenceVersion,
    "evidence_hash",
    "Phase78A evidence",
    "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_PHASE78A_INVALID",
  );
  const projection = verifyHashedProjection(
    input.contextual_schema_specialization,
    worldSimulationContextualSchemaSpecializationVersion,
    "projection_hash",
    "Phase78B specialization",
    "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_PHASE78B_INVALID",
  );
  const resolverView = buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView({
    contextual_schema_refinement_evidence: evidence,
    contextual_schema_specialization: projection,
  });
  if (requiredString(input.resolver_view_hash, "resolver_view_hash", 128)
      !== resolverView.resolver_view_hash) {
    const error = new Error("Phase78C resolver view hash mismatch.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_RESOLVER_VIEW_MISMATCH";
    throw error;
  }
  if (input.admission_decisions !== undefined && !Array.isArray(input.admission_decisions)) {
    const error = new Error("Phase78C admission_decisions must be an array.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DECISION_INVALID";
    throw error;
  }
  const proposalByRef = new Map(array(projection.specialization_proposals)
    .map((item) => [item?.specialization_proposal_ref, item]));
  const candidateByRef = new Map(array(resolverView.candidates)
    .map((item) => [item.specialization_proposal_ref, item]));
  const seen = new Set();
  const semanticIdentities = new Set();
  const admissions = [];
  const semanticDecisions = [];
  let skippedCount = 0;

  for (const rawDecision of array(input.admission_decisions)) {
    verifyDecisionShape(rawDecision);
    const decision = object(rawDecision);
    const proposalRef = requiredString(
      decision.specialization_proposal_ref,
      "specialization_proposal_ref",
      200,
    );
    if (seen.has(proposalRef)) {
      const error = new Error(`Phase78C received duplicate admission decision for ${proposalRef}.`);
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DECISION_DUPLICATE";
      throw error;
    }
    seen.add(proposalRef);
    const proposal = proposalByRef.get(proposalRef);
    const candidate = candidateByRef.get(proposalRef);
    if (!proposal || !candidate) {
      const error = new Error(`Phase78C cannot resolve specialization proposal ${proposalRef}.`);
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_PROPOSAL_UNRESOLVED";
      throw error;
    }
    const disposition = requiredString(decision.decision, "decision", 40);
    if (disposition !== "admit" && disposition !== "skip") {
      const error = new Error("Phase78C decision must be admit or skip.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DECISION_INVALID";
      throw error;
    }
    if (disposition === "skip") {
      skippedCount += 1;
      admissions.push({
        specialization_proposal_ref: proposalRef,
        decision: "skip",
        reason: optionalString(decision.reason) ?? "explicit_programmatic_skip",
        phase67c_operation: null,
        semantic_memory_id: null,
      });
      continue;
    }
    if (candidate.admission_eligible !== true) {
      const error = new Error(`Phase78C cannot admit ineligible proposal ${proposalRef}.`);
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_INELIGIBLE";
      throw error;
    }
    const bLineage = phase78BLineageFor(projection, proposalRef);
    if (bLineage.refinement_candidate_ref !== proposal.refinement_candidate_ref) {
      const error = new Error("Phase78C Phase78B lineage refinement reference mismatch.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_LINEAGE_INVALID";
      throw error;
    }
    const aLineage = phase78ALineageFor(evidence, proposal.refinement_candidate_ref);
    if (bLineage.source_semantic_memory_id !== aLineage.source_semantic_memory_id
        || bLineage.source_semantic_key !== aLineage.source_semantic_key
        || bLineage.source_semantic_descriptor_hash !== aLineage.source_semantic_descriptor_hash) {
      const error = new Error("Phase78C Phase78A/78B semantic lineage mismatch.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_LINEAGE_INVALID";
      throw error;
    }
    sourceSemantic(
      worldState,
      proposal.character,
      aLineage.source_semantic_memory_id,
      aLineage.source_semantic_descriptor_hash,
    );
    const sourceQualifiers = [...array(proposal.source_schema?.qualifiers)].sort(compareText);
    const specialized = object(proposal.specialized_descriptor);
    const specializedQualifiers = [...array(specialized.qualifiers)].sort(compareText);
    if (specialized.predicate !== proposal.source_schema?.predicate
        || specialized.object_ref !== proposal.source_schema?.object_ref
        || sourceQualifiers.some((qualifier) => !specializedQualifiers.includes(qualifier))
        || specializedQualifiers.length <= sourceQualifiers.length) {
      const error = new Error("Phase78C specialized descriptor must strictly preserve and narrow the source schema.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_NOT_STRICT_NARROWING";
      throw error;
    }
    const lifeEventRefs = canonicalLifeEventRefs(aLineage);
    const matches = exactExistingSemanticMatches(worldState, proposal.character, specialized);
    if (matches.length > 1) {
      skippedCount += 1;
      admissions.push({
        specialization_proposal_ref: proposalRef,
        decision: "skip",
        reason: "ambiguous_exact_existing_specialized_identity",
        phase67c_operation: null,
        semantic_memory_id: null,
      });
      continue;
    }
    const existing = matches[0] ?? null;
    const descriptor = {
      predicate: requiredString(specialized.predicate, "specialized predicate", 160),
      object_ref: requiredString(specialized.object_ref, "specialized object_ref", 320),
      qualifiers: specializedQualifiers.map((value) => requiredString(value, "specialized qualifier", 160)),
    };
    if (descriptor.qualifiers.length > 16 || new Set(descriptor.qualifiers).size !== descriptor.qualifiers.length) {
      const error = new Error("Phase78C specialized descriptor is outside Phase67C qualifier bounds.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DESCRIPTOR_NOT_DURABLE";
      throw error;
    }
    const descriptorHash = hashAgentRunValue(descriptor);
    const semanticKey = existing?.semantic_key
      ?? `contextual_specialization:${descriptorHash.slice(0, 40)}`;
    const identity = existing?.semantic_memory_id
      ? `existing:${existing.semantic_memory_id}`
      : `new:${characterKey(proposal.character)}:${descriptorHash}`;
    if (semanticIdentities.has(identity)) {
      const error = new Error("Phase78C received multiple admissions for one specialized semantic identity in one turn.");
      error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_DUPLICATE_SEMANTIC_IDENTITY";
      throw error;
    }
    semanticIdentities.add(identity);
    const reason = optionalString(decision.reason)
      ?? "explicit_phase78c_contextual_schema_specialization_admission";
    semanticDecisions.push({
      character: proposal.character,
      operation: existing ? "support" : "form",
      semantic_category: "recurring_event_pattern",
      semantic_key: semanticKey,
      ...(existing ? { semantic_memory_id: existing.semantic_memory_id } : {}),
      semantic_descriptor: descriptor,
      source_life_event_refs: lifeEventRefs,
      reason,
      source: "programmatic_personal_semantic_memory_resolver",
    });
    admissions.push({
      specialization_proposal_ref: proposalRef,
      refinement_candidate_ref: proposal.refinement_candidate_ref,
      decision: "admit",
      reason,
      phase67c_operation: existing ? "support" : "form",
      semantic_memory_id: existing?.semantic_memory_id ?? null,
      semantic_key: semanticKey,
      descriptor_hash: descriptorHash,
      source_contested_semantic_memory_id: aLineage.source_semantic_memory_id,
      source_contested_state_preserved: true,
      exact_existing_specialized_identity_reused: Boolean(existing),
    });
  }

  admissions.sort((left, right) => compareText(
    left.specialization_proposal_ref,
    right.specialization_proposal_ref,
  ));
  semanticDecisions.sort((left, right) =>
    characterKey(left.character).localeCompare(characterKey(right.character), "en")
      || compareText(left.semantic_key, right.semantic_key));
  const result = {
    version: worldSimulationContextualSchemaSpecializationAdmissionVersion,
    turn_id: resolverView.turn_id,
    source_phase78a_evidence_hash: evidence.evidence_hash,
    source_phase78b_projection_hash: projection.projection_hash,
    resolver_view_hash: resolverView.resolver_view_hash,
    admissions,
    admission_decision_count: seen.size,
    emitted_phase67c_semantic_decision_count: semanticDecisions.length,
    semantic_decisions: semanticDecisions,
    audit: {
      exact_phase78a_hash_verified: true,
      exact_phase78b_hash_verified: true,
      explicit_admission_required: true,
      source_contested_schema_verified: true,
      source_contested_state_preserved: true,
      source_history_rewrite_performed: false,
      strict_narrowing_verified: true,
      phase67c_durable_semantic_owner_preserved: true,
      append_only_form_or_support_only: true,
      exact_existing_specialized_descriptor_may_support: true,
      fuzzy_similarity_auto_merge_used: false,
      skipped_decision_count: skippedCount,
      direct_durable_semantic_write_performed: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_modeled: false,
      same_turn_character_brain_feedback: false,
    },
  };
  result.projection_hash = hashAgentRunValue(result);
  return deepFreeze(result);
}
