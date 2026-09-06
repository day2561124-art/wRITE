import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveSubjectiveBeliefs,
  worldSimulationEffectiveSubjectiveBeliefProjectionVersion,
} from "./world-simulation-effective-subjective-belief-projection-service.mjs";

export const worldSimulationSubjectiveBeliefCharacterProjectionVersion =
  "phase66c-bounded-subjective-belief-character-projection-v1";

export const worldSimulationSubjectiveBeliefCharacterMaxBeliefs = 16;

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
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
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function optionalString(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code =
    "WORLD_SIMULATION_SUBJECTIVE_BELIEF_CHARACTER_PROJECTION_INPUT_INVALID";
  throw error;
}

function sameCharacter(left, right) {
  return String(left ?? "")
    .trim()
    .toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
}

function compareCodeUnits(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function exactDistinctPropositions(activeBeliefs) {
  const seen = new Set();
  const propositions = [];

  for (const entry of activeBeliefs) {
    const proposition = requiredString(
      entry?.proposition,
      "effective belief proposition",
    );

    if (
      entry?.commitment !== "active"
      || entry?.subjective_not_world_truth !== true
      || entry?.confidence !== null
      || entry?.probability !== null
    ) {
      const error = new Error(
        "Phase66C requires canonical active Phase66B belief entries.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_CHARACTER_PROJECTION_EFFECTIVE_ENTRY_INVALID";
      throw error;
    }

    if (seen.has(proposition)) continue;
    seen.add(proposition);
    propositions.push(proposition);
  }

  return propositions.sort(compareCodeUnits);
}

function assertNoSameTurnRevision(worldState, character, currentTurnId) {
  for (const reference of array(worldState.subjective_belief_revision_history)) {
    if (!sameCharacter(reference?.character, character)) continue;
    if (reference?.source_turn_id !== currentTurnId) continue;

    const error = new Error(
      `Phase66C cannot expose belief state after same-turn revision ${reference?.belief_revision_event_id ?? "unknown"}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_CHARACTER_PROJECTION_SAME_TURN_REVISION_PRESENT";
    throw error;
  }
}

export function buildWorldSimulationSubjectiveBeliefCharacterProjectionContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveBeliefCharacterProjectionVersion,
    phase: "Phase66C",
    status: "bounded_subjective_belief_character_exposure_installed",
    source_projection_version:
      worldSimulationEffectiveSubjectiveBeliefProjectionVersion,
    source_scope:
      "same_character_committed_prior_turn_effective_subjective_beliefs_only",
    source_projection_remains_engine_only: true,
    consumer_specific_read_dto: true,
    character_brain_exposure_installed: true,
    action_proposer_exposure_installed: true,
    nested_under_subjective_cognition: true,
    active_beliefs_exposed: true,
    superseded_beliefs_exposed: false,
    suspended_beliefs_exposed: false,
    withdrawn_beliefs_exposed: false,
    claim_identity_exposed: false,
    claim_hash_exposed: false,
    revision_identity_exposed: false,
    revision_hash_exposed: false,
    resolver_audit_exposed: false,
    source_decision_exposed: false,
    raw_evidence_exposed: false,
    world_truth_authority_exposed: false,
    confidence_probability_exposed: false,
    exact_text_deduplication_applied: true,
    semantic_equivalence_inference_applied: false,
    duplicate_active_claim_count_used_as_credibility: false,
    deterministic_lexical_sort_used_for_transport_only: true,
    deterministic_sort_is_epistemic_precedence: false,
    max_beliefs: worldSimulationSubjectiveBeliefCharacterMaxBeliefs,
    truncation_is_credibility_ranking: false,
    same_turn_revision_feedback_allowed: false,
    same_turn_revision_contamination_policy: "fail_closed",
    as_of_revision_reconstruction_installed: false,
    projection_persistence_installed: false,
    world_state_mutation_allowed: false,
    character_brain_may_mutate_belief_history: false,
    action_proposer_may_mutate_belief_history: false,
  });
}

export function projectWorldSimulationSubjectiveBeliefsForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(
    input.current_turn_id,
    "current_turn_id",
  );
  const inputHashBefore = hashAgentRunValue(worldState);

  const effective = projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: worldState,
    character,
  });

  // Phase66C intentionally does not pretend that a post-revision effective
  // snapshot can be losslessly rewound to the character's pre-turn belief
  // state. The native loop must call this before same-turn Phase65/66 writes.
  // If that ordering is violated, fail closed rather than leak same-turn
  // cognition back into Character Brain or Action Proposer.
  assertNoSameTurnRevision(worldState, character, currentTurnId);

  const activeBeliefs = array(effective.projection?.active_beliefs);
  const propositions = exactDistinctPropositions(activeBeliefs);
  const selected = propositions.slice(
    0,
    worldSimulationSubjectiveBeliefCharacterMaxBeliefs,
  );

  const characterView = {
    source:
      "committed_prior_turn_effective_subjective_belief_projection",
    beliefs: selected.map((proposition) => ({
      proposition,
      commitment: "active",
      subjective_not_world_truth: true,
    })),
    beliefs_truncated: selected.length < propositions.length,
  };

  if (hashAgentRunValue(worldState) !== inputHashBefore) {
    const error = new Error(
      "Phase66C character belief projection mutated its world-state input.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_CHARACTER_PROJECTION_INPUT_MUTATED";
    throw error;
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationSubjectiveBeliefCharacterProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_version:
        worldSimulationEffectiveSubjectiveBeliefProjectionVersion,
      source_projection_hash:
        effective.projection?.projection_hash ?? null,
      source_revision_event_count:
        effective.projection?.source_revision_event_count ?? 0,
      source_active_belief_count: activeBeliefs.length,
      distinct_exact_proposition_count: propositions.length,
      projected_belief_count: selected.length,
      exact_text_deduplication_applied: true,
      semantic_equivalence_inference_applied: false,
      duplicate_active_claim_count_used_as_credibility: false,
      deterministic_lexical_sort_used_as_epistemic_precedence: false,
      truncation_used_as_credibility_ranking: false,
      superseded_beliefs_exposed: false,
      claim_identity_exposed: false,
      revision_identity_exposed: false,
      hashes_exposed: false,
      source_decision_exposed: false,
      raw_evidence_exposed: false,
      world_truth_authority_exposed: false,
      confidence_probability_exposed: false,
      same_turn_revision_feedback_allowed: false,
      persistent_projection_written: false,
      world_state_mutated: false,
    },
    boundaries: {
      same_character_only: true,
      committed_prior_turn_only: true,
      same_turn_revision_contamination_policy: "fail_closed",
      active_commitments_only: true,
      source_projection_engine_only: true,
      character_brain_may_observe_bounded_beliefs: true,
      action_proposer_may_observe_bounded_beliefs: true,
      character_brain_may_mutate_belief_history: false,
      action_proposer_may_mutate_belief_history: false,
      world_truth_authority_exposed: false,
      confidence_probability_exposed: false,
    },
  });
}
