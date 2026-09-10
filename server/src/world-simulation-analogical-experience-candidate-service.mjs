import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
} from "./world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection,
  worldSimulationExperientialMethodImpassePrecedentReentryVersion,
} from "./world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";

export const worldSimulationAnalogicalExperienceCandidateVersion =
  "phase80a-difference-aware-structural-analogy-candidate-v1";

const maximumAnalogyCandidateCount = 32;

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
function requiredString(value, label, maxLength = 512) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`Phase80A ${label} is required and must be bounded.`);
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_INPUT_INVALID";
    throw error;
  }
  return text;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function sameCharacter(left, right) {
  return requiredString(left, "character", 240).toLocaleLowerCase("zh-Hant-TW")
    === requiredString(right, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function projectionHash(value, hashField) {
  const body = cloneJson(value);
  delete body[hashField];
  return hashAgentRunValue(body);
}
function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: cloneJson(content) });
}

function verifyPhase79EEvidence(value) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !optionalString(projection.evidence_hash)
      || !Array.isArray(projection.impasse_evidence_contexts)
      || projection.impasse_count !== projection.impasse_evidence_contexts.length
      || projectionHash(projection, "evidence_hash") !== projection.evidence_hash) {
    const error = new Error("Phase80A requires one exact canonical Phase79E evidence projection.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PHASE79E_INVALID";
    throw error;
  }
  return projection;
}

function currentCueCatalogByImpasse(phase79E) {
  const contexts = new Map();
  for (const context of phase79E.impasse_evidence_contexts) {
    const impasseRef = requiredString(context?.impasse_ref, "Phase79E impasse_ref", 240);
    if (contexts.has(impasseRef) || !Array.isArray(context?.current_context_cue_catalog)) {
      const error = new Error("Phase80A requires unique Phase79E impasse contexts with cue catalogs.");
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PHASE79E_INVALID";
      throw error;
    }
    const cues = new Map();
    for (const cue of context.current_context_cue_catalog) {
      const cueRef = requiredString(cue?.cue_ref, "Phase79E cue_ref", 240);
      const cueKind = requiredString(cue?.cue_kind, "Phase79E cue_kind", 120);
      if (!Object.hasOwn(object(cue), "content") || cues.has(cueRef)) {
        const error = new Error("Phase80A found an invalid or duplicate Phase79E current cue.");
        error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PHASE79E_INVALID";
        throw error;
      }
      cues.set(cueRef, {
        current_cue_ref: cueRef,
        cue_kind: cueKind,
        content: cloneJson(cue.content),
        cue_content_hash: cueContentHash(cueKind, cue.content),
      });
    }
    contexts.set(impasseRef, cues);
  }
  return contexts;
}

function buildCandidate(precedent, currentCueByRef, phase79I) {
  if (precedent.all_historical_resolution_cues_exactly_match_current_context === true) {
    return null;
  }
  if (precedent.historical_dominant_method_skeleton_hash
      !== precedent.current_corresponding_method_skeleton_hash) {
    const error = new Error("Phase80A refuses a precedent without exact dominant method-skeleton correspondence.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_METHOD_STRUCTURE_MISMATCH";
    throw error;
  }

  const historicalCueByRef = new Map(array(precedent.historical_selected_cues).map((cue) => {
    const ref = requiredString(cue?.historical_cue_ref, "historical_cue_ref", 240);
    const cueKind = requiredString(cue?.cue_kind, "historical cue_kind", 120);
    if (!Object.hasOwn(object(cue), "content")) {
      const error = new Error("Phase80A historical selected cue is missing content.");
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PRECEDENT_INVALID";
      throw error;
    }
    const contentHash = cueContentHash(cueKind, cue.content);
    if (cue.cue_content_hash !== contentHash) {
      const error = new Error("Phase80A historical selected cue content hash is inconsistent.");
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PRECEDENT_INVALID";
      throw error;
    }
    return [ref, {
      historical_cue_ref: ref,
      cue_kind: cueKind,
      content: cloneJson(cue.content),
      cue_content_hash: contentHash,
    }];
  }));
  if (historicalCueByRef.size !== precedent.historical_selected_cues.length) {
    const error = new Error("Phase80A historical selected cue refs must be unique.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PRECEDENT_INVALID";
    throw error;
  }

  const listedPairs = array(precedent.exact_current_cue_matches).map((match) => {
    const historicalRef = requiredString(match?.historical_cue_ref, "matched historical_cue_ref", 240);
    const currentRef = requiredString(match?.current_cue_ref, "matched current_cue_ref", 240);
    const historicalCue = historicalCueByRef.get(historicalRef);
    const currentCue = currentCueByRef.get(currentRef);
    if (!historicalCue || !currentCue
        || match.exact_cue_kind_and_content_match !== true
        || match.historical_cue_kind !== historicalCue.cue_kind
        || match.historical_cue_content_hash !== historicalCue.cue_content_hash
        || currentCue.cue_kind !== historicalCue.cue_kind
        || currentCue.cue_content_hash !== historicalCue.cue_content_hash) {
      const error = new Error("Phase80A exact cue alignment is inconsistent with canonical Phase79E/79I sources.");
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_CUE_ALIGNMENT_INVALID";
      throw error;
    }
    return {
      historical_cue_ref: historicalRef,
      current_cue_ref: currentRef,
      cue_kind: historicalCue.cue_kind,
      cue_content_hash: historicalCue.cue_content_hash,
      exact_kind_and_content_alignment: true,
    };
  }).sort((left, right) => compareText(left.historical_cue_ref, right.historical_cue_ref)
    || compareText(left.current_cue_ref, right.current_cue_ref));

  const recomputedPairs = [...historicalCueByRef.values()].flatMap((historicalCue) =>
    [...currentCueByRef.values()]
      .filter((currentCue) => currentCue.cue_kind === historicalCue.cue_kind
        && currentCue.cue_content_hash === historicalCue.cue_content_hash)
      .map((currentCue) => ({
        historical_cue_ref: historicalCue.historical_cue_ref,
        current_cue_ref: currentCue.current_cue_ref,
        cue_kind: historicalCue.cue_kind,
        cue_content_hash: historicalCue.cue_content_hash,
        exact_kind_and_content_alignment: true,
      })))
    .sort((left, right) => compareText(left.historical_cue_ref, right.historical_cue_ref)
      || compareText(left.current_cue_ref, right.current_cue_ref));
  const pairKey = (pair) => `${pair.historical_cue_ref}\u0000${pair.current_cue_ref}`;
  if (listedPairs.length !== recomputedPairs.length
      || listedPairs.some((pair, index) => pairKey(pair) !== pairKey(recomputedPairs[index]))) {
    const error = new Error("Phase80A requires Phase79I exact cue matches to be complete against the canonical Phase79E catalog.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_CUE_ALIGNMENT_INVALID";
    throw error;
  }

  const alignedCuePairs = recomputedPairs;
  const matchedHistoricalRefs = new Set(alignedCuePairs.map((pair) => pair.historical_cue_ref));
  const matchedCurrentRefs = new Set(alignedCuePairs.map((pair) => pair.current_cue_ref));

  const historicalUnmatchedCues = [...historicalCueByRef.values()]
    .filter((cue) => !matchedHistoricalRefs.has(cue.historical_cue_ref))
    .sort((left, right) => compareText(left.historical_cue_ref, right.historical_cue_ref));
  const currentAdditionalCues = [...currentCueByRef.values()]
    .filter((cue) => !matchedCurrentRefs.has(cue.current_cue_ref))
    .sort((left, right) => compareText(left.current_cue_ref, right.current_cue_ref));

  if (historicalUnmatchedCues.length === 0) {
    const error = new Error("Phase80A near-miss precedent must preserve at least one historical context difference.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_DIFFERENCE_REQUIRED";
    throw error;
  }

  const identity = {
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    source_phase79i_precedent_ref: precedent.precedent_ref,
    source_phase79i_precedent_hash: precedent.precedent_hash,
    current_impasse_ref: precedent.current_impasse_ref,
    source_turn_id: precedent.source_turn_id,
    source_revision_to: precedent.source_revision_to,
    historical_impasse_ref: precedent.historical_impasse_ref,
    method_set_hash: precedent.method_set_hash,
    historical_dominant_method_skeleton_hash:
      precedent.historical_dominant_method_skeleton_hash,
    current_corresponding_method_ref: precedent.current_corresponding_method_ref,
    current_corresponding_method_skeleton_hash:
      precedent.current_corresponding_method_skeleton_hash,
    method_outcome_assessment: precedent.method_outcome_assessment,
    precedent_kind: precedent.precedent_kind,
    alignment_kind: "exact_method_structure_with_context_difference",
    aligned_cue_pairs: alignedCuePairs,
    historical_unmatched_cues: historicalUnmatchedCues,
    current_additional_cues: currentAdditionalCues,
  };
  const candidateHash = hashAgentRunValue(identity);
  return {
    analogy_candidate_ref: `phase80a_analogy_${candidateHash.slice(0, 24)}`,
    analogy_candidate_hash: candidateHash,
    ...identity,
    aligned_cue_count: alignedCuePairs.length,
    historical_unmatched_cue_count: historicalUnmatchedCues.length,
    current_additional_cue_count: currentAdditionalCues.length,
    exact_method_structure_alignment: true,
    context_difference_present: true,
    adaptation_required: true,
    direct_reuse_allowed: false,
    comparative_preference_validated: false,
    automatic_preference_selected: false,
    action_selection_performed: false,
    semantic_revision_performed: false,
    world_truth_authority: false,
    source_current_state_revision: phase79I.current_state_revision,
  };
}

export function buildWorldSimulationAnalogicalExperienceCandidateContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    phase: "Phase80A",
    status: "difference_aware_structural_analogy_candidate_evidence_installed",
    source_owners: ["Phase79E", "Phase79I"],
    exact_phase79e_hash_required: true,
    exact_phase79i_projection_and_lineage_required: true,
    same_character_same_turn_required: true,
    phase79i_exact_method_skeleton_identity_preserved: true,
    phase79j_exact_full_cue_match_cases_excluded: true,
    near_miss_context_difference_required: true,
    explicit_aligned_cues_projected: true,
    explicit_historical_unmatched_cues_projected: true,
    explicit_current_additional_cues_projected: true,
    adaptation_required_before_reuse: true,
    direct_reuse_allowed: false,
    preference_resolution_performed: false,
    action_selection_performed: false,
    semantic_revision_performed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    fuzzy_semantic_similarity_modeled: false,
    historical_outcome_is_comparative_truth: false,
    world_truth_authority_claimed: false,
    character_brain_exposure_allowed: false,
    technical_counts_are_not_similarity_scores: true,
    maximum_analogy_candidate_count: maximumAnalogyCandidateCount,
  });
}

export function assertWorldSimulationAnalogicalExperienceCandidateProjection(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationAnalogicalExperienceCandidateVersion
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Number.isInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !optionalString(projection.current_world_state_hash)
      || !optionalString(projection.source_phase79e_evidence_hash)
      || !optionalString(projection.source_phase79i_precedent_reentry_hash)
      || !Array.isArray(projection.analogy_candidates)
      || projection.analogy_candidate_count !== projection.analogy_candidates.length
      || projection.analogy_candidate_count > maximumAnalogyCandidateCount
      || !optionalString(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    const error = new Error("Phase80A analogy-candidate projection is invalid.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_INVALID";
    throw error;
  }
  for (const key of [
    "character",
    "current_turn_id",
    "current_state_revision",
    "current_world_state_hash",
  ]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      const error = new Error(`Phase80A projection ${key} does not match expected lineage.`);
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_LINEAGE_MISMATCH";
      throw error;
    }
  }
  const refs = new Set();
  for (const candidate of projection.analogy_candidates) {
    if (!isObject(candidate)
        || !optionalString(candidate.analogy_candidate_ref)
        || !optionalString(candidate.analogy_candidate_hash)
        || !optionalString(candidate.source_phase79i_precedent_ref)
        || candidate.alignment_kind !== "exact_method_structure_with_context_difference"
        || candidate.exact_method_structure_alignment !== true
        || candidate.context_difference_present !== true
        || candidate.adaptation_required !== true
        || candidate.direct_reuse_allowed !== false
        || candidate.comparative_preference_validated !== false
        || candidate.automatic_preference_selected !== false
        || candidate.action_selection_performed !== false
        || candidate.semantic_revision_performed !== false
        || candidate.world_truth_authority !== false
        || candidate.source_current_state_revision !== projection.current_state_revision
        || !Array.isArray(candidate.aligned_cue_pairs)
        || !Array.isArray(candidate.historical_unmatched_cues)
        || candidate.historical_unmatched_cues.length === 0
        || !Array.isArray(candidate.current_additional_cues)
        || candidate.aligned_cue_count !== candidate.aligned_cue_pairs.length
        || candidate.historical_unmatched_cue_count !== candidate.historical_unmatched_cues.length
        || candidate.current_additional_cue_count !== candidate.current_additional_cues.length) {
      const error = new Error("Phase80A analogy candidate is structurally invalid.");
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_INVALID";
      throw error;
    }
    const identity = cloneJson(candidate);
    for (const key of [
      "analogy_candidate_ref",
      "analogy_candidate_hash",
      "aligned_cue_count",
      "historical_unmatched_cue_count",
      "current_additional_cue_count",
      "exact_method_structure_alignment",
      "context_difference_present",
      "adaptation_required",
      "direct_reuse_allowed",
      "comparative_preference_validated",
      "automatic_preference_selected",
      "action_selection_performed",
      "semantic_revision_performed",
      "world_truth_authority",
      "source_current_state_revision",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (candidate.analogy_candidate_hash !== expectedHash
        || candidate.analogy_candidate_ref !== `phase80a_analogy_${expectedHash.slice(0, 24)}`
        || refs.has(candidate.analogy_candidate_ref)) {
      const error = new Error("Phase80A analogy candidate identity verification failed.");
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_HASH_MISMATCH";
      throw error;
    }
    refs.add(candidate.analogy_candidate_ref);
  }
  return deepFreeze(projection);
}

export function projectWorldSimulationAnalogicalExperienceCandidates(input = {}) {
  const phase79E = verifyPhase79EEvidence(input.source_phase79e_discriminating_evidence);
  const phase79I = assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection(
    input.source_phase79i_precedent_reentry,
  );
  if (phase79I.version !== worldSimulationExperientialMethodImpassePrecedentReentryVersion
      || !sameCharacter(phase79E.character, phase79I.character)
      || phase79E.current_turn_id !== phase79I.current_turn_id
      || phase79I.source_phase79e_evidence_hash !== phase79E.evidence_hash) {
    const error = new Error("Phase80A Phase79E/79I character, turn, or exact source lineage does not match.");
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_LINEAGE_MISMATCH";
    throw error;
  }

  const cueCatalogs = currentCueCatalogByImpasse(phase79E);
  const analogyCandidates = [];
  let exactMatchCaseCount = 0;
  for (const precedent of phase79I.precedent_cases) {
    if (precedent.all_historical_resolution_cues_exactly_match_current_context === true) {
      exactMatchCaseCount += 1;
      continue;
    }
    const currentCueByRef = cueCatalogs.get(precedent.current_impasse_ref);
    if (!currentCueByRef) {
      const error = new Error(`Phase80A precedent ${precedent.precedent_ref} cannot resolve its current Phase79E impasse context.`);
      error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_LINEAGE_MISMATCH";
      throw error;
    }
    const candidate = buildCandidate(precedent, currentCueByRef, phase79I);
    if (candidate) analogyCandidates.push(candidate);
  }
  analogyCandidates.sort((left, right) => compareText(left.analogy_candidate_ref, right.analogy_candidate_ref));
  const bounded = analogyCandidates.slice(0, maximumAnalogyCandidateCount);
  const projection = {
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    character: phase79I.character,
    current_turn_id: phase79I.current_turn_id,
    current_state_revision: phase79I.current_state_revision,
    current_world_state_hash: phase79I.current_world_state_hash,
    source_phase79e_evidence_hash: phase79E.evidence_hash,
    source_phase79i_precedent_reentry_hash: phase79I.projection_hash,
    source_phase79i_precedent_count: phase79I.precedent_count,
    source_phase79i_exact_full_cue_match_count: exactMatchCaseCount,
    source_phase79i_near_miss_count: analogyCandidates.length,
    analogy_candidate_count: bounded.length,
    analogy_candidates: bounded,
    audit: {
      exact_phase79e_hash_verified: true,
      exact_phase79i_projection_and_lineage_verified: true,
      same_character_same_turn_verified: true,
      exact_method_skeleton_identity_inherited_from_phase79i: true,
      phase79j_exact_full_cue_match_cases_excluded: true,
      near_miss_context_difference_required: true,
      aligned_cues_and_context_differences_projected: true,
      adaptation_required_before_reuse: true,
      direct_reuse_performed: false,
      preference_resolution_performed: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      fuzzy_semantic_similarity_used: false,
      historical_outcome_treated_as_comparative_truth: false,
      world_truth_authority_claimed: false,
      character_brain_exposure_performed: false,
      technical_counts_are_similarity_scores: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
