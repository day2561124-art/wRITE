import {
  worldSimulationExperientialKnowledgeReentryVersion,
} from "./world-simulation-experiential-knowledge-reentry-service.mjs";
import {
  worldSimulationExperientialMethodTransferVersion,
} from "./world-simulation-experiential-method-transfer-service.mjs";
import {
  worldSimulationExperientialMethodCompetitionResolutionVersion,
} from "./world-simulation-experiential-method-competition-resolution-service.mjs";
import {
  worldSimulationExperientialMethodImpasseReresolutionVersion,
} from "./world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
} from "./world-simulation-experiential-method-impasse-precedent-reresolution-service.mjs";
import {
  worldSimulationAnalogicalExperienceAdaptationVersion,
} from "./world-simulation-analogical-experience-adaptation-service.mjs";
import {
  worldSimulationAnalogicalExperienceRetentionReuseVersion,
} from "./world-simulation-analogical-experience-retention-reuse-service.mjs";
import {
  worldSimulationCounterfactualPreparativeRevalidationVersion,
} from "./world-simulation-counterfactual-preparative-revalidation-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceReuseVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-outcome-deliberation-service.mjs";

import {
  worldSimulationFormalImpasseDecisionKinds,
  worldSimulationFormalImpasseDeliberationVersion,
  worldSimulationFormalImpasseMaximumReferenceItems,
  worldSimulationFormalImpassePreferences,
} from "./world-simulation-formal-experiential-deliberation-contract.mjs";

export {
  buildWorldSimulationFormalImpasseStoredSubmission,
  validateWorldSimulationFormalImpasseDeliberationSubmission,
  worldSimulationFormalImpasseDecisionKinds,
  worldSimulationFormalImpasseDeliberationVersion,
} from "./world-simulation-formal-experiential-deliberation-contract.mjs";

const maximumReferenceItems = worldSimulationFormalImpasseMaximumReferenceItems;
const impassePreferences = new Set(worldSimulationFormalImpassePreferences);

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
  const trimmed = value.trim();
  return trimmed || null;
}

function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function completedKey(kind, character) {
  return `${kind}\u0000${characterKey(character)}`;
}

function stageLabel(kind) {
  switch (kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      return "Phase76D";
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      return "Phase76E";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B:
      return "Phase79B";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
      return "Phase79F";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      return "Phase79J";
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      return "Phase80B";
    case worldSimulationFormalImpasseDecisionKinds.PHASE80H:
      return "Phase80H";
    case worldSimulationFormalImpasseDecisionKinds.PHASE81E:
      return "Phase81E";
    case worldSimulationFormalImpasseDecisionKinds.PHASE81J:
      return "Phase81J";
    case worldSimulationFormalImpasseDecisionKinds.PHASE81O:
      return "Phase81O";
    default:
      return null;
  }
}

function expectedVersion(kind) {
  switch (kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      return worldSimulationExperientialKnowledgeReentryVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      return worldSimulationExperientialMethodTransferVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B:
      return worldSimulationExperientialMethodCompetitionResolutionVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
      return worldSimulationExperientialMethodImpasseReresolutionVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      return worldSimulationExperientialMethodImpassePrecedentReresolutionVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      return worldSimulationAnalogicalExperienceAdaptationVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE80H:
      return worldSimulationAnalogicalExperienceRetentionReuseVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE81E:
      return worldSimulationCounterfactualPreparativeRevalidationVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE81J:
      return worldSimulationCounterfactualLinkedExperienceReuseVersion;
    case worldSimulationFormalImpasseDecisionKinds.PHASE81O:
      return worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion;
    default:
      return null;
  }
}

function responseField(kind) {
  switch (kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      return "activated_semantic_refs";
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      return "transfer_mappings";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B:
      return "preference_decisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      return "preference_revisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      return "adaptation_decisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE80H:
      return "reuse_decisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE81E:
      return "preparative_revalidation_decisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE81J:
      return "linked_experience_reuse_decisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE81O:
      return "reuse_outcome_deliberation_decisions";
    default:
      return null;
  }
}

function assertResolverView(raw, kind) {
  if (!isObject(raw)
      || raw.version !== expectedVersion(kind)
      || !text(raw.resolver_view_hash)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      `Phase79M requires an exact bounded ${stageLabel(kind)} resolver view.`,
    );
  }
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE79B) {
    if (!Array.isArray(raw.character_contexts)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
        "Phase79M Phase79B resolver view requires character_contexts.",
      );
    }
  } else if (!text(raw.character) || !text(raw.current_turn_id)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      `Phase79M ${stageLabel(kind)} resolver view requires character/current_turn_id.`,
    );
  }
  if ((kind === worldSimulationFormalImpasseDecisionKinds.PHASE79F
      || kind === worldSimulationFormalImpasseDecisionKinds.PHASE79J)
      && !Array.isArray(raw.impasse_contexts)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      `Phase79M ${stageLabel(kind)} resolver view requires impasse_contexts.`,
    );
  }
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE80B
      && !Array.isArray(raw.analogy_candidates)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      "Phase79M Phase80B resolver view requires analogy_candidates.",
    );
  }
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE80H
      && !Array.isArray(raw.retained_analogy_candidates)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      "Phase79M Phase80H resolver view requires retained_analogy_candidates.",
    );
  }
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE81E
      && !Array.isArray(raw.preparative_revalidation_candidates)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      "Phase81E resolver view requires preparative_revalidation_candidates.",
    );
  }
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE81J
      && !Array.isArray(raw.linked_experience_candidates)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      "Phase81J resolver view requires linked_experience_candidates.",
    );
  }
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE81O
      && !Array.isArray(raw.reuse_outcome_candidates)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_VIEW_INVALID",
      "Phase81O resolver view requires reuse_outcome_candidates.",
    );
  }
  return cloneJson(raw);
}

function commonBoundaries() {
  return {
    phase79m_native_experiential_deliberation: true,
    bounded_character_information_only: true,
    same_character_only: true,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_world_history_exposed: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    engine_session_identity_exposed: false,
    engine_turn_identity_exposed: false,
    source_hashes_exposed: false,
    numeric_scores_requested: false,
    confidence_probability_utility_reward_requested: false,
    action_selection_requested: false,
    semantic_revision_requested: false,
    world_truth_judgment_requested: false,
    final_validation_owned_by_existing_phase_projector: true,
  };
}

function publicImpasseContext(context, kind) {
  const base = {
    impasse_ref: context?.impasse_ref ?? null,
    impasse_type: context?.impasse_type ?? null,
    candidate_methods: cloneJson(array(context?.candidate_methods)),
    competition_pairs: cloneJson(array(context?.competition_pairs)),
    revision_contract: cloneJson(context?.revision_contract ?? {}),
  };
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE79F) {
    return {
      ...base,
      current_context_cue_catalog:
        cloneJson(array(context?.current_context_cue_catalog)),
    };
  }
  return {
    ...base,
    eligible_precedents: cloneJson(array(context?.eligible_precedents)),
    eligible_precedent_count: array(context?.eligible_precedents).length,
  };
}

function publicCharacterInput(view, kind, character = view.character) {
  let task;
  if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE76D) {
    task = {
      purpose:
        "Select only prior personal semantic experiences that are relevant to the bounded current cue context; returning none is valid.",
      cue_context: cloneJson(view.cue_context ?? {}),
      candidate_personal_semantics:
        cloneJson(array(view.candidate_personal_semantics)),
      response_contract: {
        output_field: "activated_semantic_refs",
        may_return_empty_array: true,
        opaque_refs_only: true,
        maximum_selection_count:
          view.selection_contract?.maximum_selection_count ?? 0,
      },
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE76E) {
    task = {
      purpose:
        "Map only recalled prior method structures that are grounded by canonical cues in the bounded current context; do not author an action.",
      method_candidates: cloneJson(array(view.method_candidates)),
      current_cue_catalog: cloneJson(array(view.current_cue_catalog)),
      response_contract: {
        output_field: "transfer_mappings",
        may_return_empty_array: true,
        required_mapping_fields: [
          "transfer_ref",
          "mapping_kind",
          "current_cue_refs",
        ],
        supported_mapping_kinds:
          cloneJson(array(view.selection_contract?.supported_mapping_kinds)),
        maximum_transfer_count:
          view.selection_contract?.maximum_transfer_count ?? 0,
      },
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE79B) {
    const context = array(view.character_contexts)
      .find((entry) => sameCharacter(entry?.character, character));
    task = {
      purpose:
        "Return qualitative pairwise preferences only for the bounded competing experiential methods. Omitted pairs remain unresolved.",
      competition_context: context
        ? {
          character: context.character,
          competing_methods: cloneJson(array(context.competing_methods)),
          competition_pairs: cloneJson(array(context.competition_pairs)),
          independent_method_refs:
            cloneJson(array(context.independent_method_refs)),
          resolution_required: context.resolution_required === true,
        }
        : null,
      response_contract: {
        output_field: "preference_decisions",
        may_return_empty_array: true,
        one_decision_per_competition_ref: true,
        allowed_preferences:
          cloneJson(array(view.selection_contract?.supported_preferences)),
      },
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE80B) {
    task = {
      purpose:
        "Adapt only the bounded near-miss structural analogy by selecting which aligned current cues remain relevant, which historical difference cues must be dropped, and which current additional cues must be incorporated. Do not author a method, preference, or action.",
      analogy_candidates: cloneJson(array(view.analogy_candidates)),
      response_contract: cloneJson(view.response_contract ?? {}),
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE80H) {
    task = {
      purpose:
        "Decide whether and how to reuse only the bounded retained adapted analogy in the current context. Select matched current cues to retain and explicitly address retained/current differences. Historical subjective outcome is evidence only; do not author a method, preference, or action.",
      retained_analogy_candidates:
        cloneJson(array(view.retained_analogy_candidates)),
      response_contract: cloneJson(view.response_contract ?? {}),
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE81E) {
    task = {
      purpose:
        "Judge only whether a prior preparative counterfactual reflection remains relevant as current deliberative evidence. Ground every judgment in exact current cue support and explicitly address context differences. Do not choose or prefer an action, rewrite belief or memory, or claim counterfactual world truth.",
      preparative_revalidation_candidates:
        cloneJson(array(view.preparative_revalidation_candidates)),
      response_contract: cloneJson(view.response_contract ?? {}),
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE81J) {
    task = {
      purpose:
        "Decide only whether and how to reuse a bounded prior counterfactual-linked experience as current deliberative evidence. Retain at least one action-defining exact current cue and explicitly address context differences. Prior subjective outcome is evidence only; do not judge effectiveness, choose or prefer an action, rewrite belief or memory, or claim counterfactual world truth.",
      linked_experience_candidates:
        cloneJson(array(view.linked_experience_candidates)),
      response_contract: cloneJson(view.response_contract ?? {}),
    };
  } else if (kind === worldSimulationFormalImpasseDecisionKinds.PHASE81O) {
    task = {
      purpose:
        "Decide only whether and how to reuse a bounded retained reuse-outcome case as current deliberative evidence. Both prior subjective outcomes remain source-distinct case evidence and must not be compared as proof of effectiveness. Retain at least one action-defining exact current cue and explicitly address context differences. Do not choose or prefer an action, assign outcome credit, rewrite belief or memory, or claim world truth.",
      reuse_outcome_candidates:
        cloneJson(array(view.reuse_outcome_candidates)),
      response_contract: cloneJson(view.response_contract ?? {}),
    };
  } else {
    const evidenceField = kind === worldSimulationFormalImpasseDecisionKinds.PHASE79F
      ? "evidence_cue_refs"
      : "precedent_refs";
    task = {
      purpose: kind === worldSimulationFormalImpasseDecisionKinds.PHASE79F
        ? "Use only bounded current-context discriminating cues to decide whether an unresolved method comparison now has a supported qualitative preference."
        : "Use only bounded evaluated historical precedents to decide whether an unresolved method comparison now has a supported qualitative preference.",
      impasse_contexts: array(view.impasse_contexts)
        .map((context) => publicImpasseContext(context, kind)),
      response_contract: {
        output_field: "preference_revisions",
        may_return_empty_array: true,
        one_revision_per_competition_ref: true,
        allowed_preferences: [...impassePreferences],
        required_reference_field: evidenceField,
        reference_count_per_revision: { minimum: 1, maximum: maximumReferenceItems },
        arbitrary_tie_breaking_allowed: false,
      },
    };
  }
  return {
    character,
    decision_kind: kind,
    experiential_deliberation: {
      version: worldSimulationFormalImpasseDeliberationVersion,
      stage: stageLabel(kind),
      ...task,
      selected_action_requested: false,
      explanation_or_hidden_reasoning_requested: false,
    },
    boundaries: commonBoundaries(),
  };
}

function resolverBinding(view, kind, character) {
  return {
    version: worldSimulationFormalImpasseDeliberationVersion,
    decision_kind: kind,
    character,
    resolver_view_hash: view.resolver_view_hash,
  };
}

function eligible(view, kind, character = view.character) {
  switch (kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      return array(view.candidate_personal_semantics).length > 0;
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      return array(view.method_candidates).length > 0
        && array(view.current_cue_catalog).length > 0;
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B: {
      const context = array(view.character_contexts)
        .find((entry) => sameCharacter(entry?.character, character));
      return context?.resolution_required === true
        && array(context.competition_pairs).length > 0;
    }
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
      return array(view.impasse_contexts).some((context) =>
        array(context?.current_context_cue_catalog).length > 0
          && array(context?.competition_pairs).length > 0);
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      return array(view.impasse_contexts).some((context) =>
        array(context?.eligible_precedents).length > 0
          && array(context?.competition_pairs).length > 0);
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      return array(view.analogy_candidates).length > 0;
    case worldSimulationFormalImpasseDecisionKinds.PHASE80H:
      return array(view.retained_analogy_candidates).length > 0;
    case worldSimulationFormalImpasseDecisionKinds.PHASE81E:
      return array(view.preparative_revalidation_candidates).length > 0;
    case worldSimulationFormalImpasseDecisionKinds.PHASE81J:
      return array(view.linked_experience_candidates).length > 0;
    case worldSimulationFormalImpasseDecisionKinds.PHASE81O:
      return array(view.reuse_outcome_candidates).length > 0;
    default:
      return false;
  }
}

function decisionInputsForViews(views, kind, completed) {
  const seen = new Set();
  const decisions = [];
  for (const raw of array(views)) {
    const view = assertResolverView(raw, kind);
    const characters = kind === worldSimulationFormalImpasseDecisionKinds.PHASE79B
      ? array(view.character_contexts).map((context) => text(context?.character)).filter(Boolean)
      : [view.character];
    for (const character of characters) {
      const key = characterKey(character);
      if (seen.has(key)) {
        fail(
          "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DUPLICATE_CHARACTER",
          `Phase79M received duplicate ${stageLabel(kind)} resolver views for ${character}.`,
        );
      }
      seen.add(key);
      if (completed.has(completedKey(kind, character))
          || !eligible(view, kind, character)) continue;
      decisions.push({
        decision_kind: kind,
        character_input: publicCharacterInput(view, kind, character),
        resolver_binding: resolverBinding(view, kind, character),
      });
    }
  }
  return decisions;
}

export function buildWorldSimulationFormalImpasseDeliberationContract() {
  return Object.freeze({
    version: worldSimulationFormalImpasseDeliberationVersion,
    phase: "Phase79M",
    status: "formal_native_experiential_deliberation_chain_installed",
    stage_order: [
      "Phase76D",
      "Phase76E",
      "Phase79B",
      "Phase79F",
      "Phase80B",
      "Phase79J",
      "Phase80H",
      "Phase81E",
      "Phase81J",
      "Phase81O",
      "action_selection",
    ],
    phase76d_experiential_reentry_supported: true,
    phase76e_method_transfer_supported: true,
    phase79b_qualitative_competition_supported: true,
    phase79f_current_context_deliberation_supported: true,
    phase80b_analogical_adaptation_deliberation_supported: true,
    phase79j_precedent_deliberation_supported: true,
    phase80h_retained_adapted_analogy_reuse_deliberation_supported: true,
    phase81e_counterfactual_preparative_revalidation_supported: true,
    phase81j_counterfactual_linked_experience_reuse_supported: true,
    phase81o_counterfactual_linked_reuse_outcome_deliberation_supported: true,
    same_snapshot_repreparation_required: true,
    same_character_only: true,
    resolver_view_hash_bound_engine_side: true,
    engine_turn_identity_exposed_to_character: false,
    raw_world_state_exposed: false,
    raw_world_history_exposed: false,
    raw_outcome_exposed: false,
    numeric_scoring_requested: false,
    neural_adapter_required: false,
    caller_runtime_callback_forwarded: false,
    action_selection_inferred_as_experiential_deliberation: false,
    final_validation_owner: "existing_Phase76D_76E_79B_79F_79J_projectors",
    unresolved_or_no_match_may_continue_without_forced_choice: true,
  });
}

export function buildWorldSimulationFormalImpasseDeliberationRound(input = {}) {
  const preparedTurn = isObject(input.prepared_turn) ? input.prepared_turn : {};
  const priorSubmissions = array(input.prior_submissions);
  const completed = new Set(priorSubmissions.map((submission) => completedKey(
    submission?.decision_kind,
    submission?.character,
  )));
  const stages = [
    [worldSimulationFormalImpasseDecisionKinds.PHASE76D,
      preparedTurn.experiential_knowledge_reentry_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE76E,
      preparedTurn.experiential_method_transfer_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE79B,
      preparedTurn.experiential_method_competition_resolution_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE79F,
      preparedTurn.experiential_method_impasse_reresolution_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE80B,
      preparedTurn.analogical_experience_adaptation_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE79J,
      preparedTurn.experiential_method_impasse_precedent_reresolution_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE80H,
      preparedTurn.analogical_experience_retention_reuse_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE81E,
      preparedTurn.counterfactual_preparative_revalidation_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE81J,
      preparedTurn.counterfactual_linked_experience_reuse_resolver_views],
    [worldSimulationFormalImpasseDecisionKinds.PHASE81O,
      preparedTurn.counterfactual_linked_experience_reuse_outcome_deliberation_resolver_views],
  ];
  for (const [kind, views] of stages) {
    const decisionInputs = decisionInputsForViews(views, kind, completed);
    if (decisionInputs.length > 0) {
      return {
        version: worldSimulationFormalImpasseDeliberationVersion,
        decision_round_kind: kind,
        decision_inputs: decisionInputs,
      };
    }
  }
  return null;
}

function normalizeStoredSubmissions(priorSubmissions) {
  const byKindAndCharacter = new Map();
  for (const raw of array(priorSubmissions)) {
    if (!isObject(raw)
        || !text(raw.decision_kind)
        || !text(raw.character)
        || !text(raw.resolver_view_hash)
        || !isObject(raw.deliberation_response)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_REPLAY_INVALID",
        "Phase79M stored experiential deliberation submission is invalid.",
      );
    }
    const key = completedKey(raw.decision_kind, raw.character);
    if (byKindAndCharacter.has(key)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_REPLAY_INVALID",
        "Phase79M accepts at most one stored submission per stage and character.",
      );
    }
    byKindAndCharacter.set(key, cloneJson(raw));
  }
  return byKindAndCharacter;
}

export function buildWorldSimulationFormalImpasseResolverReplay(priorSubmissions = []) {
  const byKindAndCharacter = normalizeStoredSubmissions(priorSubmissions);
  const singleCharacterReplay = (kind) => async (resolverView = {}) => {
    const character = text(resolverView.character);
    if (!character) return [];
    const submission = byKindAndCharacter.get(completedKey(kind, character));
    if (!submission) return [];
    if (submission.resolver_view_hash !== resolverView.resolver_view_hash) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_REPLAY_STALE",
        `Phase79M ${stageLabel(kind)} replay no longer matches the exact canonical resolver view.`,
      );
    }
    return cloneJson(submission.deliberation_response[responseField(kind)]);
  };
  const phase79BReplay = async (resolverView = {}) => {
    const decisions = [];
    for (const context of array(resolverView.character_contexts)) {
      const character = text(context?.character);
      if (!character) continue;
      const submission = byKindAndCharacter.get(completedKey(
        worldSimulationFormalImpasseDecisionKinds.PHASE79B,
        character,
      ));
      if (!submission) continue;
      if (submission.resolver_view_hash !== resolverView.resolver_view_hash) {
        fail(
          "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_REPLAY_STALE",
          "Phase79M Phase79B replay no longer matches the exact canonical resolver view.",
        );
      }
      decisions.push(...cloneJson(
        submission.deliberation_response.preference_decisions,
      ));
    }
    return decisions;
  };
  return {
    experientialKnowledgeReentryResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE76D),
    experientialMethodTransferResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE76E),
    experientialMethodCompetitionResolver: phase79BReplay,
    experientialMethodImpasseReresolutionResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE79F),
    experientialMethodImpassePrecedentReresolutionResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE79J),
    analogicalExperienceAdaptationResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE80B),
    analogicalExperienceRetentionReuseResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE80H),
    counterfactualPreparativeRevalidationResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE81E),
    counterfactualLinkedExperienceReuseResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE81J),
    counterfactualLinkedExperienceReuseOutcomeDeliberationResolver:
      singleCharacterReplay(worldSimulationFormalImpasseDecisionKinds.PHASE81O),
  };
}
