import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "./world-simulation-experiential-method-impasse-deliberation-service.mjs";

export const worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion =
  "phase79e-experiential-method-impasse-discriminating-evidence-v1";

const supportedCueKinds = Object.freeze([
  "perception",
  "attention",
  "working_context",
  "subjective_cognition",
  "self_interpretation_context",
  "self_model_context",
]);
const maximumCuesPerKind = 8;

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
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
const privateContextKeys = new Set([
  "world_state",
  "scene_state",
  "raw_world_state",
  "raw_world_event",
  "causal_evidence",
  "causal_chain",
  "world_truth",
  "world_truth_verified",
  "internal_provenance",
  "source_life_event_refs",
  "support_life_event_refs",
  "counterevidence_life_event_refs",
  "confidence",
  "probability",
  "utility",
  "utility_score",
  "priority_score",
  "feasibility_score",
  "success_probability",
  "outcome",
  "result",
]);
function privateKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || privateContextKeys.has(normalized)
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || normalized.endsWith("_hash")
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || normalized.includes("world_state")
    || normalized.includes("causal_")
    || normalized.includes("runtime")
    || normalized.includes("trace_")
    || normalized.includes("projection_hash")
    || normalized.includes("resolver_view_hash");
}
function sanitize(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) {
    return value.slice(0, maximumCuesPerKind).map((item) => sanitize(item, depth + 1));
  }
  if (!isObject(value)) {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      return cloneJson(value);
    }
    return null;
  }
  const clean = {};
  for (const [key, child] of Object.entries(value).slice(0, 32)) {
    if (privateKey(key)) continue;
    const safe = sanitize(child, depth + 1);
    if (safe !== undefined) clean[key] = safe;
  }
  return clean;
}
function present(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function verifyImpasse(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodImpasseDeliberationVersion
      || !optionalString(projection.impasse_hash)
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.impasse_contexts)) {
    const error = new Error("Phase79E requires an exact canonical Phase79D impasse projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_EVIDENCE_SOURCE_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.impasse_hash;
  if (hashAgentRunValue(body) !== projection.impasse_hash) {
    const error = new Error("Phase79E Phase79D impasse hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_EVIDENCE_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function buildCueCatalog(currentContext, character, turnId) {
  const source = object(currentContext);
  const catalog = [];
  for (const cueKind of supportedCueKinds) {
    if (!Object.hasOwn(source, cueKind)) continue;
    const content = sanitize(source[cueKind]);
    if (!present(content)) continue;
    const cueRef = `phase79e_cue_${hashAgentRunValue({
      version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
      character,
      current_turn_id: turnId,
      cue_kind: cueKind,
      content,
    }).slice(0, 24)}`;
    catalog.push({
      cue_ref: cueRef,
      cue_kind: cueKind,
      content,
      current_turn_only: true,
      character_visible_context_only: true,
      world_truth_authority: false,
    });
  }
  return catalog.sort((left, right) => compareText(left.cue_ref, right.cue_ref));
}

export function buildWorldSimulationExperientialMethodImpasseDiscriminatingEvidenceContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    phase: "Phase79E",
    status: "experiential_method_impasse_discriminating_evidence_installed",
    source_owner: "Phase79D",
    exact_phase79d_hash_required: true,
    tie_and_conflict_impasses_only: true,
    supported_current_context_cue_kinds: [...supportedCueKinds],
    current_character_visible_context_only: true,
    bounded_cue_catalog_only: true,
    downstream_may_select_discriminating_evidence: true,
    preference_authored: false,
    arbitrary_tie_breaking_allowed: false,
    direct_action_selection_allowed: false,
    semantic_revision_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    numeric_similarity_confidence_probability_utility_modeled: false,
    same_turn_learning_feedback_allowed: false,
    world_truth_authority_claimed: false,
  });
}

export function projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence(input = {}) {
  const impasse = verifyImpasse(input.experiential_method_impasse_deliberation);
  const cueCatalog = buildCueCatalog(input.current_context, impasse.character, impasse.current_turn_id);
  const contexts = array(impasse.impasse_contexts).map((entry) => {
    if (!["tie_impasse", "conflict_impasse"].includes(entry.impasse_type)
        || !optionalString(entry.impasse_ref)
        || !Array.isArray(entry.retained_method_refs)
        || !Array.isArray(entry.candidate_methods)) {
      const error = new Error(`Phase79E cannot consume invalid impasse ${entry?.impasse_ref ?? "unknown"}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_EVIDENCE_CONTEXT_INVALID";
      throw error;
    }
    return {
      impasse_ref: entry.impasse_ref,
      impasse_type: entry.impasse_type,
      retained_method_refs: cloneJson(entry.retained_method_refs).sort(compareText),
      candidate_methods: cloneJson(entry.candidate_methods),
      unresolved_competition_refs: cloneJson(array(entry.unresolved_competition_refs)).sort(compareText),
      current_context_cue_catalog: cloneJson(cueCatalog),
      evidence_selection_contract: {
        select_only_from_current_context_cue_catalog: true,
        evidence_must_discriminate_retained_methods_downstream: true,
        no_evidence_may_preserve_impasse: true,
        preference_may_be_authored_here: false,
        action_selection_may_be_authored_here: false,
        semantic_revision_may_be_authored_here: false,
      },
    };
  }).sort((left, right) => compareText(left.impasse_ref, right.impasse_ref));

  const projection = {
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    character: impasse.character,
    current_turn_id: impasse.current_turn_id,
    source_phase79d_impasse_hash: impasse.impasse_hash,
    impasse_evidence_contexts: contexts,
    impasse_count: contexts.length,
    cue_count: cueCatalog.length,
    deliberation_evidence_available: contexts.length > 0 && cueCatalog.length > 0,
    audit: {
      exact_phase79d_source_verified: true,
      tie_conflict_only: true,
      current_character_visible_context_only: true,
      bounded_cue_catalog_only: true,
      preference_authored: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      same_turn_learning_feedback_performed: false,
    },
  };
  projection.evidence_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
