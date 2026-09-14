import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationPersistentAffectiveToneEvidence,
  worldSimulationPersistentAffectiveToneEvidenceVersion,
} from "./world-simulation-affective-appraisal-service.mjs";

export const worldSimulationPersistentMoodInterpretationVersion =
  "phase89b-bounded-qualitative-persistent-mood-interpretation-v1";
export const persistentMoodInterpretationCharacterViewVersion =
  "phase89b-persistent-mood-character-view-v1";

const maximumMoodLabelLength = 96;
const maximumInterpretationLength = 512;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}

function requiredText(value, label, maxLength) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_INPUT_INVALID",
      `Phase89B ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}

function characterViewFromInterpretation(interpretation) {
  if (!interpretation) {
    return Object.freeze({
      version: persistentMoodInterpretationCharacterViewVersion,
      source: "character_owned_phase89a_persistent_affective_tone_interpretation",
      status: "no_current_mood_interpretation",
      current_mood: null,
      subjective_current_mood_interpretation_established: false,
      objective_current_mood_established: false,
      advisory_only: true,
      action_selection_authority: false,
      belief_revision_authority: false,
      memory_rewrite_authority: false,
      personality_revision_authority: false,
      world_truth_authority: false,
    });
  }

  return Object.freeze({
    version: persistentMoodInterpretationCharacterViewVersion,
    source: "character_owned_phase89a_persistent_affective_tone_interpretation",
    status: "subjective_current_mood_interpretation_available",
    current_mood: {
      label: interpretation.subjective_mood_label,
      interpretation: interpretation.interpretation,
      supporting_evidence_count: interpretation.supporting_evidence_refs.length,
      subjective_not_world_truth: true,
      evidence_backed: true,
      reversible_interpretation: true,
      objective_emotion_label_established: false,
      numeric_intensity_established: false,
      numeric_decay_rate_established: false,
    },
    subjective_current_mood_interpretation_established: true,
    objective_current_mood_established: false,
    advisory_only: true,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    personality_revision_authority: false,
    world_truth_authority: false,
  });
}

export function buildWorldSimulationPersistentMoodInterpretationContract() {
  return Object.freeze({
    version: worldSimulationPersistentMoodInterpretationVersion,
    phase: "Phase89B",
    status: "bounded_qualitative_persistent_mood_interpretation_installed",
    source_owner: "Phase89A",
    interpretation_owner: "CharacterBrain",
    exact_phase89a_reconstruction_required: true,
    supporting_evidence_refs_required: true,
    omission_means_no_current_mood_interpretation: true,
    freeform_bounded_subjective_mood_label_allowed: true,
    qualitative_interpretation_only: true,
    objective_emotion_label_inferred: false,
    objective_current_mood_established: false,
    numeric_intensity_modeled: false,
    numeric_decay_rate_modeled: false,
    personality_baseline_modeled: false,
    action_selection_authority: false,
    belief_revision_authority: false,
    memory_rewrite_authority: false,
    personality_revision_authority: false,
    world_truth_authority: false,
    native_loop_adoption_installed: false,
    deliberation_grounding_installed: false,
  });
}

export function buildWorldSimulationPersistentMoodInterpretationResolverView(input = {}) {
  const evidence = projectWorldSimulationPersistentAffectiveToneEvidence(input);
  const visibleEntries = evidence.evidence_entries.map((entry) => ({
    evidence_ref: entry.evidence_ref,
    goal: entry.goal,
    goal_congruence: entry.goal_congruence,
    expectedness: entry.expectedness,
    coping_potential: entry.coping_potential,
    interpretation: entry.interpretation,
    historical_subjective_appraisal: true,
    historical_appraisal_is_current_fact: false,
    objective_emotion_label_established: false,
    world_truth_authority: false,
  }));
  const view = {
    version: worldSimulationPersistentMoodInterpretationVersion,
    phase: "Phase89B",
    character: evidence.character,
    source: "phase89a_bounded_persistent_affective_tone_evidence",
    source_version: worldSimulationPersistentAffectiveToneEvidenceVersion,
    status: visibleEntries.length > 0
      ? "persistent_affective_tone_evidence_available"
      : "no_persistent_affective_tone_evidence",
    evidence_count: visibleEntries.length,
    evidence_entries: visibleEntries,
    spans_multiple_committed_turns: evidence.spans_multiple_committed_turns,
    truncated: evidence.truncated,
    response_contract: {
      output_shape: "zero_or_one_subjective_mood_interpretation",
      required_fields: [
        "subjective_mood_label",
        "interpretation",
        "supporting_evidence_refs",
      ],
      supporting_evidence_refs_must_be_subset_of_visible_evidence: true,
      abstention_allowed: true,
      objective_emotion_or_world_truth_label_authoring_allowed: false,
      numeric_intensity_decay_probability_confidence_authoring_allowed: false,
      action_belief_memory_personality_authoring_allowed: false,
    },
    boundaries: {
      source_phase89a_only: true,
      historical_appraisal_is_current_fact: false,
      current_mood_not_precomputed_by_engine: true,
      character_brain_interpretation_required: true,
      same_turn_phase86_feedback_allowed: false,
      raw_world_state_exposed: false,
      raw_affective_history_lineage_exposed: false,
      objective_emotion_label_authority: false,
      numeric_intensity_or_decay_authority: false,
      action_selection_authority: false,
      belief_revision_authority: false,
      world_truth_authority: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}

export function assertWorldSimulationPersistentMoodInterpretationResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationPersistentMoodInterpretationVersion
      || view.phase !== "Phase89B"
      || !text(view.character)
      || view.source !== "phase89a_bounded_persistent_affective_tone_evidence"
      || view.source_version !== worldSimulationPersistentAffectiveToneEvidenceVersion
      || !Number.isSafeInteger(view.evidence_count)
      || view.evidence_count < 0
      || !Array.isArray(view.evidence_entries)
      || view.evidence_entries.length !== view.evidence_count
      || !text(view.resolver_view_hash)
      || hashWithout(view, "resolver_view_hash") !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_VIEW_INVALID",
      "Phase89B requires an exact bounded mood-interpretation resolver view.",
    );
  }

  const refs = new Set();
  for (const entry of view.evidence_entries) {
    if (!isObject(entry)
        || !/^phase89a_affective_tone_[a-f0-9]{24}$/.test(entry.evidence_ref)
        || refs.has(entry.evidence_ref)
        || !text(entry.goal)
        || !text(entry.interpretation)
        || entry.historical_subjective_appraisal !== true
        || entry.historical_appraisal_is_current_fact !== false
        || entry.objective_emotion_label_established !== false
        || entry.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_VIEW_INVALID",
        "Phase89B resolver view contains invalid or authority-bearing Phase89A evidence.",
      );
    }
    refs.add(entry.evidence_ref);
  }
  return Object.freeze(view);
}

const allowedDecisionFields = new Set([
  "subjective_mood_label",
  "interpretation",
  "supporting_evidence_refs",
]);

const authorityFieldFragments = [
  "intensity",
  "decay",
  "probability",
  "confidence",
  "utility",
  "reward",
  "q_value",
  "selected_action",
  "action_selection",
  "belief",
  "memory_rewrite",
  "personality",
  "world_truth",
  "objective_emotion",
];

function normalizeDecision(raw, view) {
  if (!isObject(raw)) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_DECISION_INVALID",
      "Phase89B interpretation decision must be an object.",
    );
  }
  const authorityFields = Object.keys(raw).filter((field) =>
    authorityFieldFragments.some((fragment) => field.includes(fragment)));
  if (authorityFields.length) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_AUTHORITY_FIELD_FORBIDDEN",
      `Phase89B may not author authority-bearing field(s): ${authorityFields.join(", ")}.`,
    );
  }
  const unsupported = Object.keys(raw).filter((field) => !allowedDecisionFields.has(field));
  if (unsupported.length) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_DECISION_FIELD_FORBIDDEN",
      `Phase89B decision contains unsupported field(s): ${unsupported.join(", ")}.`,
    );
  }

  const subjectiveMoodLabel = requiredText(
    raw.subjective_mood_label,
    "subjective_mood_label",
    maximumMoodLabelLength,
  );
  const interpretation = requiredText(
    raw.interpretation,
    "interpretation",
    maximumInterpretationLength,
  );
  if (!Array.isArray(raw.supporting_evidence_refs)
      || raw.supporting_evidence_refs.length === 0
      || raw.supporting_evidence_refs.length > view.evidence_count) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_SUPPORT_INVALID",
      "Phase89B requires a bounded non-empty subset of visible Phase89A evidence refs.",
    );
  }
  const supportingEvidenceRefs = raw.supporting_evidence_refs.map((value, index) =>
    requiredText(value, `supporting_evidence_refs[${index}]`, 128));
  if (new Set(supportingEvidenceRefs).size !== supportingEvidenceRefs.length) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_SUPPORT_INVALID",
      "Phase89B supporting evidence refs must be unique.",
    );
  }
  const visibleRefs = new Set(view.evidence_entries.map((entry) => entry.evidence_ref));
  if (supportingEvidenceRefs.some((ref) => !visibleRefs.has(ref))) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_SUPPORT_OUT_OF_VIEW",
      "Phase89B interpretation may cite only Phase89A evidence visible in its exact resolver view.",
    );
  }

  return {
    subjective_mood_label: subjectiveMoodLabel,
    interpretation,
    supporting_evidence_refs: [...supportingEvidenceRefs].sort(),
  };
}

export function projectWorldSimulationPersistentMoodInterpretation(input = {}) {
  const view = assertWorldSimulationPersistentMoodInterpretationResolverView(
    input.resolver_view,
  );
  const rebuilt = buildWorldSimulationPersistentMoodInterpretationResolverView(input);
  if (rebuilt.resolver_view_hash !== view.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_VIEW_STALE",
      "Phase89B resolver view no longer matches canonical Phase89A evidence.",
    );
  }

  const rawDecisions = array(input.interpretation_decisions);
  if (rawDecisions.length > 1) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_DECISION_LIMIT",
      "Phase89B accepts at most one current mood interpretation per character.",
    );
  }
  if (rawDecisions.length > 0 && view.evidence_count === 0) {
    fail(
      "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_SUPPORT_REQUIRED",
      "Phase89B cannot form a current mood interpretation without Phase89A evidence.",
    );
  }

  const normalized = rawDecisions.length ? normalizeDecision(rawDecisions[0], view) : null;
  const sourceEvidence = projectWorldSimulationPersistentAffectiveToneEvidence(input);
  let interpretation = null;
  if (normalized) {
    const identity = {
      version: worldSimulationPersistentMoodInterpretationVersion,
      character: view.character,
      source_phase89a_evidence_hash: sourceEvidence.evidence_hash,
      subjective_mood_label: normalized.subjective_mood_label,
      interpretation: normalized.interpretation,
      supporting_evidence_refs: normalized.supporting_evidence_refs,
    };
    const interpretationHash = hashAgentRunValue(identity);
    interpretation = {
      interpretation_ref: `phase89b_mood_${interpretationHash.slice(0, 24)}`,
      interpretation_hash: interpretationHash,
      ...identity,
      subjective_current_mood_interpretation: true,
      objective_current_mood_fact: false,
      objective_emotion_label_established: false,
      numeric_intensity_assigned: false,
      numeric_decay_rate_assigned: false,
      personality_baseline_assigned: false,
      action_selection_authority: false,
      belief_revision_authority: false,
      memory_rewrite_authority: false,
      personality_revision_authority: false,
      world_truth_authority: false,
      reversible_interpretation: true,
    };
  }

  const characterView = characterViewFromInterpretation(interpretation);
  const projection = {
    version: worldSimulationPersistentMoodInterpretationVersion,
    phase: "Phase89B",
    character: view.character,
    source_phase89a_version: worldSimulationPersistentAffectiveToneEvidenceVersion,
    source_phase89a_evidence_hash: sourceEvidence.evidence_hash,
    resolver_view_hash: view.resolver_view_hash,
    status: interpretation
      ? "subjective_current_mood_interpretation_formed"
      : "no_current_mood_interpretation",
    interpretation_count: interpretation ? 1 : 0,
    interpretations: interpretation ? [interpretation] : [],
    character_view: characterView,
    audit: {
      exact_phase89a_source_reconstructed: true,
      supporting_evidence_refs_verified: true,
      omission_preserved_as_no_interpretation: !interpretation,
      current_mood_precomputed_by_engine: false,
      objective_emotion_label_inferred: false,
      numeric_intensity_modeled: false,
      numeric_decay_rate_modeled: false,
      personality_baseline_modeled: false,
      action_selected: false,
      belief_revised: false,
      memory_rewritten: false,
      personality_revised: false,
      world_truth_authority_claimed: false,
      native_loop_adoption_performed: false,
      deliberation_grounding_performed: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return Object.freeze(cloneJson(projection));
}
