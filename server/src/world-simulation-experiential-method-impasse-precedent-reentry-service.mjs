import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "./world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion } from "./world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import { worldSimulationExperientialMethodImpasseReresolutionVersion } from "./world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence,
  worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
} from "./world-simulation-experiential-method-impasse-resolution-outcome-evidence-service.mjs";

export const worldSimulationExperientialMethodImpassePrecedentReentryVersion =
  "phase79i-experiential-method-impasse-precedent-reentry-v1";

const maximumHistoryTurnsScanned = 128;
const maximumPrecedentCount = 32;
const maximumSelectedCueCountPerPrecedent = 16;

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
function requiredString(value, label, maxLength = 512, code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`Phase79I ${label} is required and must be bounded.`);
    error.code = code;
    throw error;
  }
  return text;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredString(value, "character", 240)
    .toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function sameStringArray(left, right) {
  const a = [...array(left)].sort(compareText);
  const b = [...array(right)].sort(compareText);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function projectionHash(value, hashField) {
  const body = cloneJson(value);
  delete body[hashField];
  return hashAgentRunValue(body);
}
function verifyHashedProjection(value, {
  version,
  hashField,
  label,
  code,
}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== version
      || !optionalString(projection[hashField])
      || projectionHash(projection, hashField) !== projection[hashField]) {
    const error = new Error(`Phase79I requires an exact canonical ${label}.`);
    error.code = code;
    throw error;
  }
  return projection;
}
function normalizeMethodSkeleton(value, label) {
  const skeleton = object(value);
  const relation = requiredString(
    skeleton.relation,
    `${label}.relation`,
    600,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_INVALID",
  );
  const methodRef = requiredString(
    skeleton.method_ref,
    `${label}.method_ref`,
    600,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_INVALID",
  );
  const qualifiers = array(skeleton.qualifiers).map((qualifier, index) =>
    requiredString(
      qualifier,
      `${label}.qualifiers[${index}]`,
      300,
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_INVALID",
    )).sort(compareText);
  if (qualifiers.length > 16 || new Set(qualifiers).size !== qualifiers.length) {
    const error = new Error("Phase79I method qualifiers must be unique and bounded.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_INVALID";
    throw error;
  }
  return { relation, method_ref: methodRef, qualifiers };
}
function methodIdentity(candidate, label) {
  const transferRef = requiredString(
    candidate?.transfer_ref,
    `${label}.transfer_ref`,
    240,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_INVALID",
  );
  const methodSkeleton = normalizeMethodSkeleton(candidate?.method_skeleton, `${label}.method_skeleton`);
  return {
    transfer_ref: transferRef,
    method_skeleton: methodSkeleton,
    method_skeleton_hash: hashAgentRunValue(methodSkeleton),
  };
}
function methodSet(context, label) {
  const methods = array(context?.candidate_methods).map((candidate, index) =>
    methodIdentity(candidate, `${label}.candidate_methods[${index}]`));
  if (methods.length < 2) {
    const error = new Error("Phase79I precedent comparison requires at least two candidate methods.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_SET_INVALID";
    throw error;
  }
  const hashes = methods.map((method) => method.method_skeleton_hash);
  if (new Set(hashes).size !== hashes.length) {
    const error = new Error("Phase79I refuses an impasse whose candidate method skeleton identities are ambiguous.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_METHOD_IDENTITY_AMBIGUOUS";
    throw error;
  }
  return {
    methods,
    method_skeleton_hashes: [...hashes].sort(compareText),
    method_set_hash: hashAgentRunValue([...hashes].sort(compareText)),
  };
}
function cueIdentity(cue, label) {
  const cueKind = requiredString(
    cue?.cue_kind,
    `${label}.cue_kind`,
    120,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CUE_INVALID",
  );
  if (!Object.hasOwn(object(cue), "content")) {
    const error = new Error(`Phase79I ${label}.content is required.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CUE_INVALID";
    throw error;
  }
  const content = cloneJson(cue.content);
  return {
    cue_kind: cueKind,
    content,
    cue_content_hash: hashAgentRunValue({ cue_kind: cueKind, content }),
  };
}
function verifyCurrentSources(input, expectedCharacter, currentTurnId) {
  const impasse = verifyHashedProjection(input.current_impasse_deliberation, {
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    hashField: "impasse_hash",
    label: "current Phase79D impasse projection",
    code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_PHASE79D_INVALID",
  });
  if (!sameCharacter(impasse.character, expectedCharacter)
      || impasse.current_turn_id !== currentTurnId
      || !Array.isArray(impasse.impasse_contexts)) {
    const error = new Error("Phase79I current Phase79D character/turn lineage is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_LINEAGE_MISMATCH";
    throw error;
  }
  const evidence = verifyHashedProjection(input.current_impasse_discriminating_evidence, {
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    hashField: "evidence_hash",
    label: "current Phase79E evidence projection",
    code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_PHASE79E_INVALID",
  });
  if (!sameCharacter(evidence.character, expectedCharacter)
      || evidence.current_turn_id !== currentTurnId
      || evidence.source_phase79d_impasse_hash !== impasse.impasse_hash
      || !Array.isArray(evidence.impasse_evidence_contexts)) {
    const error = new Error("Phase79I current Phase79D/79E lineage is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_LINEAGE_MISMATCH";
    throw error;
  }
  const reresolution = verifyHashedProjection(input.current_impasse_reresolution, {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    hashField: "reresolution_hash",
    label: "current Phase79F re-resolution projection",
    code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_PHASE79F_INVALID",
  });
  if (!sameCharacter(reresolution.character, expectedCharacter)
      || reresolution.current_turn_id !== currentTurnId
      || reresolution.source_phase79d_impasse_hash !== impasse.impasse_hash
      || reresolution.source_phase79e_evidence_hash !== evidence.evidence_hash
      || !Array.isArray(reresolution.remaining_impasse_refs)) {
    const error = new Error("Phase79I current Phase79D/79E/79F lineage is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_LINEAGE_MISMATCH";
    throw error;
  }
  return { impasse, evidence, reresolution };
}
function verifyHistoricalPhase79D(value, turnId, character) {
  const projection = verifyHashedProjection(value, {
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    hashField: "impasse_hash",
    label: "historical Phase79D impasse projection",
    code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79D_INVALID",
  });
  if (projection.current_turn_id !== turnId || !sameCharacter(projection.character, character)) {
    const error = new Error("Phase79I historical Phase79D character/turn lineage mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
    throw error;
  }
  return projection;
}
function verifyHistoricalPhase79E(value, turnId, character, phase79DHash) {
  const projection = verifyHashedProjection(value, {
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    hashField: "evidence_hash",
    label: "historical Phase79E evidence projection",
    code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79E_INVALID",
  });
  if (projection.current_turn_id !== turnId
      || !sameCharacter(projection.character, character)
      || projection.source_phase79d_impasse_hash !== phase79DHash) {
    const error = new Error("Phase79I historical Phase79D/79E lineage mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
    throw error;
  }
  return projection;
}
function verifyHistoricalPhase79F(value, turnId, character, phase79DHash, phase79EHash) {
  const projection = verifyHashedProjection(value, {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    hashField: "reresolution_hash",
    label: "historical Phase79F re-resolution projection",
    code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79F_INVALID",
  });
  if (projection.current_turn_id !== turnId
      || !sameCharacter(projection.character, character)
      || projection.source_phase79d_impasse_hash !== phase79DHash
      || projection.source_phase79e_evidence_hash !== phase79EHash) {
    const error = new Error("Phase79I historical Phase79D/79E/79F lineage mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
    throw error;
  }
  return projection;
}
function selectedHistoricalCues(phase79FResult, phase79EContext) {
  const selectedRefs = [...new Set(array(phase79FResult?.applied_preference_revisions)
    .flatMap((revision) => array(revision?.evidence_cue_refs))
    .map((ref) => requiredString(
      ref,
      "historical Phase79F evidence_cue_ref",
      240,
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_CUE_INVALID",
    )))].sort(compareText);
  if (selectedRefs.length === 0 || selectedRefs.length > maximumSelectedCueCountPerPrecedent) {
    const error = new Error("Phase79I historical resolved impasse must preserve a bounded non-empty selected cue set.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_CUE_INVALID";
    throw error;
  }
  const cueByRef = new Map(array(phase79EContext?.current_context_cue_catalog)
    .map((cue) => [cue?.cue_ref, cue]));
  return selectedRefs.map((ref, index) => {
    const cue = cueByRef.get(ref);
    if (!cue) {
      const error = new Error(`Phase79I historical Phase79F cue ${ref} is absent from its Phase79E catalog.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_CUE_MISMATCH";
      throw error;
    }
    return {
      historical_cue_ref: ref,
      ...cueIdentity(cue, `historical_selected_cues[${index}]`),
    };
  });
}
function currentCueMap(currentPhase79EContext) {
  const map = new Map();
  for (const [index, cue] of array(currentPhase79EContext?.current_context_cue_catalog).entries()) {
    const identity = cueIdentity(cue, `current_context_cue_catalog[${index}]`);
    const ref = requiredString(
      cue?.cue_ref,
      `current_context_cue_catalog[${index}].cue_ref`,
      240,
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CUE_INVALID",
    );
    const refs = map.get(identity.cue_content_hash) ?? [];
    refs.push(ref);
    map.set(identity.cue_content_hash, refs.sort(compareText));
  }
  return map;
}
function precedentKind(assessment) {
  if (assessment === "supports_prior_method") return "supported_resolution_selected_method_precedent";
  if (assessment === "counterevidence_for_prior_method") return "counterevidenced_resolution_selected_method_precedent";
  return "ambiguous_resolution_selected_method_precedent";
}

export function buildWorldSimulationExperientialMethodImpassePrecedentReentryContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    phase: "Phase79I",
    status: "prior_committed_impasse_resolution_precedent_reentry_evidence_installed",
    source_history_owner: "WorldSimulationHistory",
    source_chain: ["Phase79D", "Phase79E", "Phase79F", "Phase79H"],
    current_remaining_impasse_source: "Phase79F",
    same_character_prior_committed_turns_only: true,
    current_and_historical_method_identity: "exact_normalized_method_skeleton_set",
    transfer_ref_cross_turn_equality_required: false,
    historical_selected_resolution_cues_only: true,
    current_context_matching_mode: "exact_cue_kind_and_content_only",
    fuzzy_semantic_similarity_modeled: false,
    precedent_automatically_validates_preference: false,
    precedent_automatically_selects_preference: false,
    precedent_automatically_selects_action: false,
    supported_counterevidenced_and_ambiguous_precedents_retained: true,
    historical_method_outcome_is_not_counterfactual_comparison: true,
    numeric_success_rate_confidence_probability_utility_reward_modeled: false,
    world_truth_authority_claimed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    resolver_used: false,
    technical_history_window_not_cognitive_weight: true,
    maximum_history_turns_scanned: maximumHistoryTurnsScanned,
    maximum_precedent_count: maximumPrecedentCount,
    same_turn_feedback_allowed: false,
  });
}

export function assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodImpassePrecedentReentryVersion
      || !optionalString(projection.world_simulation_session_id)
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Number.isInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !optionalString(projection.current_world_state_hash)
      || !optionalString(projection.source_phase79d_impasse_hash)
      || !optionalString(projection.source_phase79e_evidence_hash)
      || !optionalString(projection.source_phase79f_reresolution_hash)
      || !Array.isArray(projection.precedent_cases)
      || projection.precedent_count !== projection.precedent_cases.length
      || projection.precedent_count > maximumPrecedentCount
      || !isObject(projection.history_window)
      || !optionalString(projection.projection_hash)) {
    const error = new Error("Phase79I precedent re-entry projection is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    const error = new Error("Phase79I precedent re-entry projection hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HASH_MISMATCH";
    throw error;
  }
  for (const key of ["world_simulation_session_id", "character", "current_turn_id", "current_state_revision", "current_world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      const error = new Error(`Phase79I projection ${key} does not match expected lineage.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_LINEAGE_MISMATCH";
      throw error;
    }
  }
  const seen = new Set();
  for (const precedent of projection.precedent_cases) {
    if (!isObject(precedent)
        || !optionalString(precedent.precedent_ref)
        || !optionalString(precedent.precedent_hash)
        || precedent.current_impasse_ref === undefined
        || !optionalString(precedent.current_impasse_ref)
        || !optionalString(precedent.source_turn_id)
        || !Number.isInteger(precedent.source_revision_to)
        || precedent.source_revision_to < 1
        || !optionalString(precedent.historical_impasse_ref)
        || !optionalString(precedent.method_set_hash)
        || !optionalString(precedent.historical_dominant_method_skeleton_hash)
        || !optionalString(precedent.current_corresponding_method_ref)
        || !optionalString(precedent.current_corresponding_method_skeleton_hash)
        || precedent.historical_dominant_method_skeleton_hash !== precedent.current_corresponding_method_skeleton_hash
        || !["supports_prior_method", "counterevidence_for_prior_method", "ambiguous_no_revision"]
          .includes(precedent.method_outcome_assessment)
        || !optionalString(precedent.precedent_kind)
        || !Array.isArray(precedent.historical_selected_cues)
        || precedent.historical_selected_cues.length === 0
        || !Array.isArray(precedent.exact_current_cue_matches)
        || precedent.exact_current_cue_match_count !== precedent.exact_current_cue_matches.length
        || precedent.comparative_preference_validated !== false
        || precedent.automatic_current_preference_selected !== false
        || precedent.counterfactual_superiority_inferred !== false
        || precedent.world_truth_authority !== false) {
      const error = new Error("Phase79I precedent case is invalid.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CASE_INVALID";
      throw error;
    }
    if (precedent.precedent_kind !== precedentKind(precedent.method_outcome_assessment)) {
      const error = new Error("Phase79I precedent kind does not match its historical outcome assessment.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CASE_INVALID";
      throw error;
    }
    const identity = cloneJson(precedent);
    delete identity.precedent_ref;
    delete identity.precedent_hash;
    delete identity.comparative_preference_validated;
    delete identity.automatic_current_preference_selected;
    delete identity.counterfactual_superiority_inferred;
    delete identity.world_truth_authority;
    const expectedHash = hashAgentRunValue(identity);
    if (precedent.precedent_hash !== expectedHash
        || precedent.precedent_ref !== `phase79i_precedent_${expectedHash.slice(0, 24)}`) {
      const error = new Error("Phase79I precedent identity verification failed.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CASE_HASH_MISMATCH";
      throw error;
    }
    if (seen.has(precedent.precedent_ref)) {
      const error = new Error(`Phase79I duplicate precedent ${precedent.precedent_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CASE_DUPLICATE";
      throw error;
    }
    seen.add(precedent.precedent_ref);
  }
  return deepFreeze(projection);
}

export function projectWorldSimulationExperientialMethodImpassePrecedentReentry(input = {}) {
  const worldSimulationSessionId = requiredString(input.world_simulation_session_id, "world_simulation_session_id", 240);
  const character = requiredString(input.character, "character", 240);
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id", 240);
  if (!Number.isInteger(input.current_state_revision) || input.current_state_revision < 0) {
    const error = new Error("Phase79I current_state_revision must be a non-negative integer.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_INPUT_INVALID";
    throw error;
  }
  const currentWorldStateHash = requiredString(input.current_world_state_hash, "current_world_state_hash", 128);
  const current = verifyCurrentSources(input, character, currentTurnId);
  const history = cloneJson(input.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== worldSimulationSessionId
      || !Array.isArray(history.turns)) {
    const error = new Error("Phase79I requires canonical same-session World Simulation history.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_INVALID";
    throw error;
  }

  const currentImpasseByRef = new Map(array(current.impasse.impasse_contexts)
    .map((context) => [context.impasse_ref, context]));
  const currentEvidenceByRef = new Map(array(current.evidence.impasse_evidence_contexts)
    .map((context) => [context.impasse_ref, context]));
  const remainingRefs = [...new Set(array(current.reresolution.remaining_impasse_refs)
    .map((ref) => requiredString(ref, "current remaining impasse ref", 240)))].sort(compareText);
  const currentContexts = remainingRefs.map((impasseRef) => {
    const impasseContext = currentImpasseByRef.get(impasseRef);
    const evidenceContext = currentEvidenceByRef.get(impasseRef);
    if (!impasseContext || !evidenceContext) {
      const error = new Error(`Phase79I current remaining impasse ${impasseRef} lacks exact Phase79D/79E context.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_CURRENT_LINEAGE_MISMATCH";
      throw error;
    }
    return {
      impasse_ref: impasseRef,
      method_set: methodSet(impasseContext, `current_impasse[${impasseRef}]`),
      cue_map: currentCueMap(evidenceContext),
    };
  });

  const priorTurns = history.turns.filter((turn) => {
    if (!isObject(turn) || turn.turn_id === currentTurnId) return false;
    if (!Number.isInteger(turn.revision_to) || turn.revision_to < 1) return false;
    return turn.revision_to <= input.current_state_revision;
  });
  const historyWindowTruncated = priorTurns.length > maximumHistoryTurnsScanned;
  const scannedTurns = priorTurns.slice(-maximumHistoryTurnsScanned);
  const precedents = [];

  for (const turn of scannedTurns) {
    const phase79HRaw = turn.experiential_method_impasse_resolution_outcome_evidence;
    if (phase79HRaw === null || phase79HRaw === undefined) continue;
    const phase79H = assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence(
      phase79HRaw,
      {
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turn.turn_id,
        state_revision: turn.revision_from,
        world_state_hash: turn.previous_state_hash,
      },
    );
    if (phase79H.version !== worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion) {
      const error = new Error("Phase79I historical Phase79H version mismatch.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79H_INVALID";
      throw error;
    }
    for (const outcomeEvidence of phase79H.evidence_records) {
      if (!sameCharacter(outcomeEvidence.character, character)) continue;
      // Phase79K can preserve a Phase79J-resolved method through selected
      // application and subjective outcome evidence, but Phase79I's sealed
      // historical reconstruction below still knows how to recover resolution
      // cues only from a Phase79F-resolved impasse. Never misattribute a
      // Phase79J resolution outcome to its necessarily-unresolved Phase79F
      // ancestor. A later retention closure may add explicit Phase79J history
      // reconstruction without weakening this Phase79F path.
      if (outcomeEvidence.resolution_source_owner === "Phase79J") continue;
      const phase79FRaw = array(turn.experiential_method_impasse_reresolution_projections)
        .find((projection) => projection?.reresolution_hash === outcomeEvidence.phase79f_reresolution_hash);
      if (!phase79FRaw) {
        const error = new Error("Phase79I historical Phase79H cannot resolve its exact Phase79F source.");
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
        throw error;
      }
      const phase79F = verifyHashedProjection(phase79FRaw, {
        version: worldSimulationExperientialMethodImpasseReresolutionVersion,
        hashField: "reresolution_hash",
        label: "historical Phase79F re-resolution projection",
        code: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79F_INVALID",
      });
      const phase79DRaw = array(turn.experiential_method_impasse_deliberation_projections)
        .find((projection) => projection?.impasse_hash === phase79F.source_phase79d_impasse_hash);
      const phase79ERaw = array(turn.experiential_method_impasse_discriminating_evidence_projections)
        .find((projection) => projection?.evidence_hash === phase79F.source_phase79e_evidence_hash);
      if (!phase79DRaw || !phase79ERaw) {
        const error = new Error("Phase79I historical Phase79F cannot resolve its exact Phase79D/79E sources.");
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
        throw error;
      }
      const phase79D = verifyHistoricalPhase79D(phase79DRaw, turn.turn_id, character);
      const phase79E = verifyHistoricalPhase79E(
        phase79ERaw,
        turn.turn_id,
        character,
        phase79D.impasse_hash,
      );
      verifyHistoricalPhase79F(
        phase79F,
        turn.turn_id,
        character,
        phase79D.impasse_hash,
        phase79E.evidence_hash,
      );
      const historicalImpasse = array(phase79D.impasse_contexts)
        .find((context) => context?.impasse_ref === outcomeEvidence.impasse_ref);
      const historicalEvidence = array(phase79E.impasse_evidence_contexts)
        .find((context) => context?.impasse_ref === outcomeEvidence.impasse_ref);
      const historicalResult = array(phase79F.impasse_results)
        .find((result) => result?.impasse_ref === outcomeEvidence.impasse_ref);
      if (!historicalImpasse || !historicalEvidence || !historicalResult
          || historicalResult.resolved !== true
          || historicalResult.resolution_status !== "resolved_dominant"
          || historicalResult.dominant_method_ref !== outcomeEvidence.dominant_method_ref) {
        const error = new Error("Phase79I historical impasse/outcome lineage is inconsistent.");
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
        throw error;
      }
      const historicalMethodSet = methodSet(
        historicalImpasse,
        `historical_impasse[${outcomeEvidence.impasse_ref}]`,
      );
      const historicalDominant = historicalMethodSet.methods
        .find((method) => method.transfer_ref === outcomeEvidence.dominant_method_ref);
      if (!historicalDominant) {
        const error = new Error("Phase79I historical dominant method is absent from the historical impasse method set.");
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH";
        throw error;
      }
      const historicalCues = selectedHistoricalCues(historicalResult, historicalEvidence);

      for (const currentContext of currentContexts) {
        if (!sameStringArray(
          currentContext.method_set.method_skeleton_hashes,
          historicalMethodSet.method_skeleton_hashes,
        )) continue;
        const currentCorresponding = currentContext.method_set.methods
          .find((method) => method.method_skeleton_hash === historicalDominant.method_skeleton_hash);
        if (!currentCorresponding) continue;
        const cueMatches = historicalCues.flatMap((cue) =>
          array(currentContext.cue_map.get(cue.cue_content_hash)).map((currentCueRef) => ({
            historical_cue_ref: cue.historical_cue_ref,
            historical_cue_kind: cue.cue_kind,
            historical_cue_content_hash: cue.cue_content_hash,
            current_cue_ref: currentCueRef,
            exact_cue_kind_and_content_match: true,
          })));
        const identity = {
          version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
          current_impasse_ref: currentContext.impasse_ref,
          source_turn_id: turn.turn_id,
          source_revision_to: turn.revision_to,
          historical_impasse_ref: outcomeEvidence.impasse_ref,
          source_phase79d_impasse_hash: phase79D.impasse_hash,
          source_phase79e_evidence_hash: phase79E.evidence_hash,
          source_phase79f_reresolution_hash: phase79F.reresolution_hash,
          source_phase79h_projection_hash: phase79H.projection_hash,
          source_phase79h_evidence_ref: outcomeEvidence.evidence_ref,
          method_set_hash: historicalMethodSet.method_set_hash,
          historical_dominant_method_skeleton_hash: historicalDominant.method_skeleton_hash,
          current_corresponding_method_ref: currentCorresponding.transfer_ref,
          current_corresponding_method_skeleton_hash: currentCorresponding.method_skeleton_hash,
          method_outcome_assessment: outcomeEvidence.method_outcome_assessment,
          precedent_kind: precedentKind(outcomeEvidence.method_outcome_assessment),
          historical_selected_cues: historicalCues.map((cue) => ({
            historical_cue_ref: cue.historical_cue_ref,
            cue_kind: cue.cue_kind,
            content: cloneJson(cue.content),
            cue_content_hash: cue.cue_content_hash,
          })),
          exact_current_cue_match_count: cueMatches.length,
          exact_current_cue_matches: cueMatches,
          all_historical_resolution_cues_exactly_match_current_context:
            historicalCues.length > 0
            && new Set(cueMatches.map((match) => match.historical_cue_ref)).size === historicalCues.length,
        };
        const precedentHash = hashAgentRunValue(identity);
        precedents.push({
          precedent_ref: `phase79i_precedent_${precedentHash.slice(0, 24)}`,
          precedent_hash: precedentHash,
          ...identity,
          comparative_preference_validated: false,
          automatic_current_preference_selected: false,
          counterfactual_superiority_inferred: false,
          world_truth_authority: false,
        });
      }
    }
  }

  precedents.sort((left, right) => {
    if (left.source_revision_to !== right.source_revision_to) {
      return right.source_revision_to - left.source_revision_to;
    }
    return compareText(left.precedent_ref, right.precedent_ref);
  });
  const boundedPrecedents = precedents.slice(0, maximumPrecedentCount);
  const projection = {
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    world_simulation_session_id: worldSimulationSessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: currentWorldStateHash,
    source_phase79d_impasse_hash: current.impasse.impasse_hash,
    source_phase79e_evidence_hash: current.evidence.evidence_hash,
    source_phase79f_reresolution_hash: current.reresolution.reresolution_hash,
    remaining_impasse_refs: remainingRefs,
    precedent_count: boundedPrecedents.length,
    precedent_cases: boundedPrecedents,
    history_window: {
      total_prior_committed_turn_count: priorTurns.length,
      scanned_turn_count: scannedTurns.length,
      maximum_history_turns_scanned: maximumHistoryTurnsScanned,
      truncated: historyWindowTruncated,
      technical_bound_only: true,
      recency_is_not_confidence_or_utility: true,
    },
    audit: {
      same_character_prior_committed_turns_only: true,
      same_turn_history_ignored: true,
      exact_phase79d_phase79e_phase79f_phase79h_history_lineage_required: true,
      exact_normalized_method_skeleton_set_match_required: true,
      transfer_ref_cross_turn_equality_required: false,
      historical_selected_resolution_cues_only: true,
      exact_cue_kind_and_content_matching_only: true,
      fuzzy_semantic_similarity_used: false,
      supported_counterevidenced_and_ambiguous_precedents_retained: true,
      historical_method_outcome_treated_as_counterfactual_comparison: false,
      comparative_preference_validated: false,
      automatic_current_preference_selected: false,
      numeric_success_rate_confidence_probability_utility_reward_modeled: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      world_truth_authority_claimed: false,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: currentWorldStateHash,
  });
}
