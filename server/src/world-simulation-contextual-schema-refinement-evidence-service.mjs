import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationMultiExperienceSchemaEvidenceView,
  worldSimulationMultiExperienceSchemaEvidenceVersion,
} from "./world-simulation-multi-experience-schema-evidence-service.mjs";
import {
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";

export const worldSimulationContextualSchemaRefinementEvidenceVersion =
  "phase78a-contextual-schema-refinement-evidence-v1";

const maximumEvidencePerRole = 24;

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
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_REFINEMENT_EVIDENCE_INPUT_INVALID";
  throw error;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function refKey(ref) {
  return `${ref?.life_event_id ?? ""}\u0000${ref?.organization_event_id ?? ""}`;
}

function publicEvidenceByRef(phase77a) {
  const map = new Map();
  for (const context of array(phase77a?.resolver_view?.character_contexts)) {
    for (const item of [
      ...array(context.current_anchor_evidence),
      ...array(context.prior_comparison_evidence),
    ]) {
      if (optionalString(item?.evidence_ref)) map.set(item.evidence_ref, cloneJson(item));
    }
  }
  return map;
}

function evidenceForSemanticRefs(refs, lineageByLifeEvent, publicByRef, role) {
  const evidence = [];
  const mappings = [];
  const seen = new Set();
  for (const ref of array(refs)) {
    const lineage = lineageByLifeEvent.get(ref?.life_event_id);
    if (!lineage || seen.has(lineage.evidence_ref)) continue;
    const visible = publicByRef.get(lineage.evidence_ref);
    if (!visible) continue;
    seen.add(lineage.evidence_ref);
    evidence.push({
      evidence_ref: visible.evidence_ref,
      role,
      bounded_experiences: cloneJson(array(visible.bounded_experiences)),
      experience_count: Number(visible.experience_count ?? array(visible.bounded_experiences).length),
      subjective_not_world_truth: true,
    });
    mappings.push({
      evidence_ref: visible.evidence_ref,
      life_event_id: lineage.life_event_id,
      latest_organization_event_id: lineage.latest_organization_event_id,
      latest_organization_event_hash: lineage.latest_organization_event_hash,
      semantic_life_event_ref: cloneJson(ref),
    });
    if (evidence.length >= maximumEvidencePerRole) break;
  }
  evidence.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
  mappings.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
  return { evidence, mappings };
}

export function buildWorldSimulationContextualSchemaRefinementEvidenceContract() {
  return deepFreeze({
    version: worldSimulationContextualSchemaRefinementEvidenceVersion,
    phase: "Phase78A",
    status: "bounded_contextual_schema_refinement_evidence_installed",
    source_semantic_owner: "Phase67C",
    source_experience_evidence_owner: "Phase77A",
    recurring_event_pattern_only: true,
    contested_schema_only: true,
    current_turn_counterevidence_required: true,
    support_and_counterexample_evidence_separated: true,
    source_schema_identity_preserved: true,
    semantic_rewrite_performed: false,
    specialized_schema_authored: false,
    durable_semantic_write_performed: false,
    automatic_exception_rule_created: false,
    recurrence_count_auto_resolves_contestation: false,
    numeric_similarity_confidence_probability_modeled: false,
    raw_world_state_exposed: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    internal_semantic_identity_exposed_to_future_refiner: false,
    direct_belief_plan_goal_current_mind_world_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    future_refinement_owner: "Phase78B",
  });
}

export function buildWorldSimulationContextualSchemaRefinementEvidenceView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const sourceOrganizationEventIds = [...new Set(array(input.source_organization_event_ids)
    .map((value) => requiredString(value, "source_organization_event_id")))];
  const currentOrganizationSet = new Set(sourceOrganizationEventIds);

  const semanticProjection = projectWorldSimulationEffectivePersonalSemanticMemories({
    world_state: worldState,
  });
  const phase77a = buildWorldSimulationMultiExperienceSchemaEvidenceView({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
  });
  if (phase77a.version !== worldSimulationMultiExperienceSchemaEvidenceVersion) {
    const error = new Error("Phase78A requires canonical Phase77A evidence.");
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_REFINEMENT_PHASE77A_INVALID";
    throw error;
  }

  const publicByRef = publicEvidenceByRef(phase77a);
  const lineageByLifeEvent = new Map(
    array(phase77a.internal_lineage).map((item) => [item.life_event_id, item]),
  );
  const candidates = [];
  const internalLineage = [];

  for (const [character, memories] of Object.entries(
    semanticProjection.memories_by_character ?? {},
  )) {
    for (const semantic of Object.values(object(memories))) {
      if (semantic?.semantic_category !== "recurring_event_pattern"
          || semantic?.state !== "contested") continue;
      const counterRefs = array(semantic.counterevidence_life_event_refs);
      const currentCounterRefs = counterRefs.filter((ref) =>
        currentOrganizationSet.has(ref?.organization_event_id));
      if (!currentCounterRefs.length) continue;

      const support = evidenceForSemanticRefs(
        semantic.support_life_event_refs,
        lineageByLifeEvent,
        publicByRef,
        "supporting_experience",
      );
      const counter = evidenceForSemanticRefs(
        counterRefs,
        lineageByLifeEvent,
        publicByRef,
        "counterexample_experience",
      );
      const currentCounterEvidenceRefs = new Set(
        counter.mappings
          .filter((mapping) => currentOrganizationSet.has(
            mapping.semantic_life_event_ref?.organization_event_id,
          ))
          .map((mapping) => mapping.evidence_ref),
      );
      if (!support.evidence.length || !counter.evidence.length
          || !currentCounterEvidenceRefs.size) continue;

      const descriptor = cloneJson(object(semantic.semantic_descriptor));
      const candidateIdentity = {
        version: worldSimulationContextualSchemaRefinementEvidenceVersion,
        turn_id: turnId,
        character,
        semantic_memory_id: semantic.semantic_memory_id,
        semantic_descriptor_hash: semantic.semantic_descriptor_hash,
        current_counterexample_evidence_refs: [...currentCounterEvidenceRefs].sort(compareText),
      };
      const candidateRef = `phase78a_refinement_${hashAgentRunValue(candidateIdentity).slice(0, 24)}`;
      candidates.push({
        refinement_candidate_ref: candidateRef,
        character,
        source_schema: {
          predicate: descriptor.predicate ?? null,
          object_ref: descriptor.object_ref ?? null,
          qualifiers: cloneJson(array(descriptor.qualifiers)).sort(compareText),
          knowledge_status: "contested",
          subjective_not_world_truth: true,
        },
        supporting_experience_evidence: support.evidence,
        counterexample_experience_evidence: counter.evidence.map((item) => ({
          ...item,
          current_turn_counterexample: currentCounterEvidenceRefs.has(item.evidence_ref),
        })),
        supporting_evidence_count: support.evidence.length,
        counterexample_evidence_count: counter.evidence.length,
        current_turn_counterexample_count: currentCounterEvidenceRefs.size,
        refinement_not_authored_yet: true,
        subjective_not_world_truth: true,
      });
      internalLineage.push({
        refinement_candidate_ref: candidateRef,
        character,
        source_semantic_memory_id: semantic.semantic_memory_id,
        source_semantic_key: semantic.semantic_key,
        source_semantic_descriptor_hash: semantic.semantic_descriptor_hash,
        supporting_evidence_lineage: support.mappings,
        counterexample_evidence_lineage: counter.mappings,
        current_counterevidence_life_event_refs: cloneJson(currentCounterRefs),
      });
    }
  }

  candidates.sort((left, right) => compareText(
    left.refinement_candidate_ref,
    right.refinement_candidate_ref,
  ));
  internalLineage.sort((left, right) => compareText(
    left.refinement_candidate_ref,
    right.refinement_candidate_ref,
  ));

  const resolverView = {
    version: worldSimulationContextualSchemaRefinementEvidenceVersion,
    turn_id: turnId,
    refinement_candidates: candidates,
    refinement_requirements: {
      contested_recurring_event_pattern_required: true,
      at_least_one_supporting_experience_required: true,
      at_least_one_counterexample_experience_required: true,
      current_turn_counterexample_required: true,
      source_relation_and_method_identity_must_be_preserved_downstream: true,
      refinement_must_narrow_applicability_not_rewrite_history: true,
    },
    boundaries: {
      source_phase67c_projection_verified: true,
      source_phase77a_evidence_verified: true,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      semantic_memory_id_exposed: false,
      semantic_key_exposed: false,
      life_event_identity_exposed: false,
      internal_lineage_exposed: false,
      semantic_rewrite_requested: false,
      specialized_schema_authoring_requested: false,
      numeric_similarity_confidence_probability_requested: false,
      direct_durable_write_requested: false,
      same_turn_character_brain_feedback_requested: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  const result = {
    version: worldSimulationContextualSchemaRefinementEvidenceVersion,
    turn_id: turnId,
    source_phase67c_version: worldSimulationPersonalSemanticMemoryVersion,
    source_phase67c_projection_hash: semanticProjection.projection_hash,
    source_phase77a_evidence_view_hash: phase77a.evidence_view_hash,
    resolver_view: resolverView,
    internal_lineage: internalLineage,
    refinement_candidate_count: candidates.length,
    audit: {
      recurring_event_pattern_only: true,
      contested_schema_only: true,
      current_turn_counterevidence_required: true,
      supporting_and_counterexample_evidence_separated: true,
      semantic_rewrite_performed: false,
      specialized_schema_authored: false,
      durable_semantic_write_performed: false,
      recurrence_count_auto_resolved_contestation: false,
      numeric_similarity_confidence_probability_modeled: false,
      world_truth_authority_claimed: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  result.evidence_hash = hashAgentRunValue(result);
  return deepFreeze(result);
}
