import { hashAgentRunValue } from "./agent-run-service.mjs";
import { subjectiveActionDeliberationCharacterViewVersion } from "./world-simulation-subjective-action-deliberation-service.mjs";
import { subjectiveProspectiveConsequenceCharacterViewVersion } from "./world-simulation-subjective-prospective-consequence-service.mjs";
import { subjectiveCrossOptionPreferenceCharacterViewVersion } from "./world-simulation-subjective-cross-option-preference-service.mjs";

export const worldSimulationActionCommitmentReconsiderationEvidenceVersion =
  "phase75c-action-commitment-reconsideration-evidence-v1";

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function text(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

function assertViews(input, character) {
  const deliberation = input.subjective_action_deliberation;
  const prospection = input.subjective_prospective_consequence_simulation;
  const preference = input.subjective_cross_option_preference_resolution;
  if (!isObject(deliberation) || deliberation.version !== subjectiveActionDeliberationCharacterViewVersion || deliberation.character !== character) {
    fail("WORLD_SIMULATION_ACTION_COMMITMENT_RECONSIDERATION_PHASE74A_INVALID", "Phase75C requires a same-character canonical Phase74A deliberation view.");
  }
  if (!isObject(prospection) || prospection.version !== subjectiveProspectiveConsequenceCharacterViewVersion || prospection.character !== character || prospection.source_deliberation_view_hash !== deliberation.deliberation_view_hash) {
    fail("WORLD_SIMULATION_ACTION_COMMITMENT_RECONSIDERATION_PHASE74B_INVALID", "Phase75C requires a same-character Phase74B view linked to Phase74A.");
  }
  if (!isObject(preference) || preference.version !== subjectiveCrossOptionPreferenceCharacterViewVersion || preference.character !== character || preference.source_deliberation_view_hash !== deliberation.deliberation_view_hash || preference.source_prospection_view_hash !== prospection.prospective_consequence_view_hash) {
    fail("WORLD_SIMULATION_ACTION_COMMITMENT_RECONSIDERATION_PHASE74C_INVALID", "Phase75C requires a same-character Phase74C view linked to Phase74A/74B.");
  }
  return { deliberation, prospection, preference };
}

function evidenceRef(character, kind, sourceRefs) {
  const refs = [...new Set(sourceRefs.filter(Boolean))].sort();
  return {
    evidence_ref: `phase75c_evidence_${hashAgentRunValue({ version: worldSimulationActionCommitmentReconsiderationEvidenceVersion, character, kind, refs }).slice(0, 24)}`,
    evidence_kind: kind,
    source_refs: refs,
    qualitative_only: true,
    does_not_decide_reconsideration: true,
  };
}

export function buildWorldSimulationActionCommitmentReconsiderationEvidenceContract() {
  return Object.freeze({
    version: worldSimulationActionCommitmentReconsiderationEvidenceVersion,
    phase: "Phase75C",
    status: "bounded_action_commitment_reconsideration_evidence_installed",
    active_commitment_required_for_reconsideration: true,
    current_candidate_membership_checked: true,
    blocker_cost_uncertainty_context_referenced: true,
    alternative_option_context_referenced: true,
    goal_value_belief_pressure_context_referenced: true,
    historical_belief_change_inferred: false,
    automatic_reconsideration_decision: false,
    automatic_commitment_revoke: false,
    automatic_replacement_action_selection: false,
    numeric_reconsideration_score: false,
    character_brain_remains_reconsideration_and_choice_owner: true,
    causal_outcome_authority_claimed: false,
    world_truth_authority_claimed: false,
    world_state_mutation_allowed: false,
  });
}

export function buildWorldSimulationActionCommitmentReconsiderationEvidence(input = {}) {
  const character = text(input.character);
  if (!character) fail("WORLD_SIMULATION_ACTION_COMMITMENT_RECONSIDERATION_INPUT_INVALID", "character is required.");
  const cognition = isObject(input.cognition) ? input.cognition : {};
  const commitmentState = isObject(cognition.effective_action_commitment) ? cognition.effective_action_commitment : {};
  const active = commitmentState.has_active_commitment === true && isObject(commitmentState.active_commitment)
    ? commitmentState.active_commitment
    : null;
  const { deliberation, prospection, preference } = assertViews(input, character);

  if (!active) {
    return Object.freeze(cloneJson({
      version: worldSimulationActionCommitmentReconsiderationEvidenceVersion,
      character,
      status: "no_active_commitment_to_reconsider",
      active_commitment_ref: null,
      evidence: [],
      evidence_count: 0,
      reconsideration_boundary: {
        character_brain_owns_reconsideration_decision: true,
        automatic_revoke: false,
        automatic_replacement_selection: false,
      },
    }));
  }

  const actionId = text(active.action_id);
  const commitmentRef = text(active.commitment_ref);
  if (!actionId || !commitmentRef) fail("WORLD_SIMULATION_ACTION_COMMITMENT_RECONSIDERATION_COMMITMENT_INVALID", "Active commitment requires action_id and commitment_ref.");

  const option = array(deliberation.action_options).find((item) => item?.action_id === actionId) ?? null;
  const prospect = array(prospection.action_prospects).find((item) => item?.action_id === actionId) ?? null;
  const groundingByKind = new Map(array(deliberation.cognition_grounding_catalog).map((g) => [g?.grounding_kind, g?.grounding_ref]));
  const evidence = [];

  evidence.push(evidenceRef(character, option ? "committed_action_still_candidate" : "committed_action_not_in_current_candidate_set", [commitmentRef, option?.action_ref]));

  if (prospect) {
    const branches = array(prospect.consequence_branches);
    const blockerRefs = branches.filter((b) => b?.branch_kind === "blocking_contingency").map((b) => b.branch_ref);
    const costRefs = branches.filter((b) => b?.branch_kind === "known_cost_exposure" || b?.branch_kind === "time_resource_exposure").map((b) => b.branch_ref);
    const uncertaintyRefs = branches.filter((b) => b?.branch_kind === "epistemic_uncertainty_contingency").map((b) => b.branch_ref);
    if (blockerRefs.length) evidence.push(evidenceRef(character, "blocking_contingency_present", blockerRefs));
    if (costRefs.length) evidence.push(evidenceRef(character, "known_cost_or_resource_exposure_present", costRefs));
    if (uncertaintyRefs.length) evidence.push(evidenceRef(character, "epistemic_uncertainty_present", uncertaintyRefs));
  }

  if (array(deliberation.action_options).some((item) => item?.action_id !== actionId)) {
    evidence.push(evidenceRef(character, "alternative_options_available", array(preference.pairwise_comparisons)
      .filter((pair) => pair?.left_action_id === actionId || pair?.right_action_id === actionId)
      .map((pair) => pair.comparison_ref)));
  }

  const contextRefs = [
    "active_goal", "value_context", "known_context", "uncertain_context",
    "relationship_context", "decision_pressure", "emotion_context", "current_action",
  ].map((kind) => groundingByKind.get(kind)).filter(Boolean);
  if (contextRefs.length) evidence.push(evidenceRef(character, "current_deliberative_context_available", contextRefs));

  const result = {
    version: worldSimulationActionCommitmentReconsiderationEvidenceVersion,
    character,
    status: "reconsideration_evidence_available",
    active_commitment_ref: commitmentRef,
    committed_action_id: actionId,
    evidence,
    evidence_count: evidence.length,
    reconsideration_boundary: {
      evidence_is_reason_to_review_not_instruction_to_drop: true,
      absence_of_trigger_does_not_make_commitment_irrevocable: true,
      blocker_branch_is_not_objective_failure: true,
      uncertainty_is_not_negative_outcome_prediction: true,
      alternative_presence_is_not_alternative_superiority: true,
      historical_belief_change_not_inferred_without_snapshot: true,
      character_brain_owns_reconsideration_decision: true,
      character_brain_owns_final_action_choice: true,
      automatic_revoke: false,
      automatic_replacement_selection: false,
      numeric_reconsideration_score_computed: false,
      causal_outcome_not_asserted: true,
    },
    information_boundary: {
      same_character_only: true,
      semantic_content_duplicated: false,
      raw_world_state_exposed: false,
      other_character_private_cognition_exposed: false,
      world_truth_authority_claimed: false,
      causal_outcome_authority_claimed: false,
    },
  };
  result.reconsideration_evidence_hash = hashAgentRunValue(result);
  return Object.freeze(cloneJson(result));
}
