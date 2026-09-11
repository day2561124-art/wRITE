import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  projectWorldSimulationExperientialKnowledgeReentry,
  worldSimulationExperientialKnowledgeReentryVersion,
} from "../../server/src/world-simulation-experiential-knowledge-reentry-service.mjs";
import {
  buildWorldSimulationExperientialMethodTransferResolverView,
  projectWorldSimulationExperientialMethodTransfer,
} from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import {
  projectWorldSimulationExperientialMethodCompetition,
} from "../../server/src/world-simulation-experiential-method-competition-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionResolutionResolverView,
  projectWorldSimulationExperientialMethodCompetitionResolution,
} from "../../server/src/world-simulation-experiential-method-competition-resolution-service.mjs";
import {
  projectWorldSimulationExperientialMethodCompetitionGuidance,
} from "../../server/src/world-simulation-experiential-method-competition-guidance-service.mjs";
import {
  projectWorldSimulationExperientialMethodImpasseDeliberation,
} from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import {
  projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence,
} from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseReresolutionResolverView,
  projectWorldSimulationExperientialMethodImpasseReresolution,
} from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-precedent-reresolution-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationContract,
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseResolverReplay,
  buildWorldSimulationFormalImpasseStoredSubmission,
  worldSimulationFormalImpasseDecisionKinds,
  worldSimulationFormalImpasseDeliberationVersion,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";
import {
  createEphemeralWorldSimulationPreparedTurnBroker,
} from "../../server/src/world-simulation-prepared-turn-ephemeral-broker.mjs";

const character = "千夜";
const turnId = "world_turn_phase79m_native_001";

function phase76DResolverView() {
  const candidates = [
    {
      semantic_ref: "personal_semantic_phase79m_a",
      character,
      semantic_category: "recurring_event_pattern",
      semantic_key: "blocked-route-seek-side-path",
      semantic_descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "when_route_blocked_seek_side_path",
        object_ref: "side-path-method",
        qualifiers: ["blocked-route", "alternative-means"],
      },
      knowledge_status: "supported",
      subjective_not_world_truth: true,
      epistemic_acceptance_decided: false,
    },
    {
      semantic_ref: "personal_semantic_phase79m_b",
      character,
      semantic_category: "recurring_event_pattern",
      semantic_key: "blocked-route-probe-opening",
      semantic_descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "when_route_blocked_probe_opening",
        object_ref: "probe-opening-method",
        qualifiers: ["blocked-route", "alternative-means"],
      },
      knowledge_status: "supported",
      subjective_not_world_truth: true,
      epistemic_acceptance_decided: false,
    },
  ];
  const view = {
    version: worldSimulationExperientialKnowledgeReentryVersion,
    current_turn_id: turnId,
    character,
    cue_context: {
      perception: {
        observed: [{ description: "正面通路堵塞，側邊有可檢查的缺口。" }],
      },
      current_goal: "抵達內部",
      current_action: "評估替代通路",
    },
    candidate_personal_semantics: candidates,
    selection_contract: {
      select_only_if_relevant_to_current_cue_context: true,
      opaque_semantic_ref_selection_only: true,
      semantic_content_authoring_allowed: false,
      maximum_selection_count: 8,
      no_match_may_return_empty: true,
      confidence_probability_requested: false,
      world_truth_judgment_requested: false,
      action_selection_requested: false,
    },
    boundaries: {
      same_character_candidates_only: true,
      world_state_exposed: false,
      hidden_causal_evidence_exposed: false,
      numeric_activation_scores_exposed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return view;
}

function storeSubmission(decisionInput, deliberationResponse) {
  return buildWorldSimulationFormalImpasseStoredSubmission({
    resolver_binding: decisionInput.resolver_binding,
    character_input: decisionInput.character_input,
    deliberation_response: deliberationResponse,
  });
}

const contract = buildWorldSimulationFormalImpasseDeliberationContract();
assert.equal(contract.version, worldSimulationFormalImpasseDeliberationVersion);
assert.deepEqual(contract.stage_order, [
  "Phase76D",
  "Phase76E",
  "Phase79B",
  "Phase79F",
  "Phase80B",
  "Phase79J",
  "Phase80H",
  "Phase81E",
  "action_selection",
]);
assert.equal(contract.phase76d_experiential_reentry_supported, true);
assert.equal(contract.phase76e_method_transfer_supported, true);
assert.equal(contract.phase79b_qualitative_competition_supported, true);
assert.equal(contract.phase79f_current_context_deliberation_supported, true);
assert.equal(contract.phase80b_analogical_adaptation_deliberation_supported, true);
assert.equal(contract.phase79j_precedent_deliberation_supported, true);
assert.equal(contract.phase81e_counterfactual_preparative_revalidation_supported, true);
assert.equal(contract.neural_adapter_required, false);
assert.equal(contract.caller_runtime_callback_forwarded, false);
assert.equal(contract.raw_world_state_exposed, false);
assert.equal(contract.raw_world_history_exposed, false);
assert.equal(contract.numeric_scoring_requested, false);

// Phase76D: the formal Character Brain sees the canonical bounded recall view,
// selects only opaque semantic refs, and replay is accepted by the original
// Phase76D projector rather than by a new Phase79M authority path.
const phase76DView = phase76DResolverView();
let prior = [];
let round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    experiential_knowledge_reentry_resolver_views: [phase76DView],
  },
  prior_submissions: prior,
});
assert.equal(
  round.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE76D,
);
assert.equal(round.decision_inputs.length, 1);
assert.equal(round.decision_inputs[0].character_input.character, character);
assert.equal(
  round.decision_inputs[0].character_input.experiential_deliberation
    .response_contract.output_field,
  "activated_semantic_refs",
);
assert.equal(
  JSON.stringify(round.decision_inputs[0].character_input).includes("resolver_view_hash"),
  false,
);
const phase76DStored = storeSubmission(
  round.decision_inputs[0],
  {
    activated_semantic_refs:
      phase76DView.candidate_personal_semantics.map((candidate) => candidate.semantic_ref),
  },
);
prior.push(phase76DStored);
let replay = buildWorldSimulationFormalImpasseResolverReplay(prior);
const activatedRefs = await replay.experientialKnowledgeReentryResolver(phase76DView);
const phase76DProjection = projectWorldSimulationExperientialKnowledgeReentry({
  resolver_view: phase76DView,
  activated_semantic_refs: activatedRefs,
});
assert.equal(phase76DProjection.activated_semantics.length, 2);
assert.equal(phase76DProjection.audit.direct_action_selection, false);

// Phase76E: replay only canonical transfer/cue refs into the sealed transfer
// projector. Two mappings intentionally share the same cue set so Phase79A
// will have a real pairwise competition to pass downstream.
const phase76EView = buildWorldSimulationExperientialMethodTransferResolverView({
  character,
  current_turn_id: turnId,
  experiential_knowledge_reentry: phase76DProjection,
  current_context: {
    perception: { observed: [{ description: "正面通路堵塞，側邊有缺口。" }] },
    current_goal: "抵達內部",
    current_action: "評估替代通路",
  },
});
assert.equal(phase76EView.method_candidates.length, 2);
round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    experiential_knowledge_reentry_resolver_views: [phase76DView],
    experiential_method_transfer_resolver_views: [phase76EView],
  },
  prior_submissions: prior,
});
assert.equal(
  round.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE76E,
);
const transferCueRefs = [phase76EView.current_cue_catalog[0].cue_ref];
const mappingKind = phase76EView.selection_contract.supported_mapping_kinds[0];
const transferMappings = phase76EView.method_candidates.map((candidate) => ({
  transfer_ref: candidate.transfer_ref,
  mapping_kind: mappingKind,
  current_cue_refs: transferCueRefs,
}));
const phase76EStored = storeSubmission(
  round.decision_inputs[0],
  { transfer_mappings: transferMappings },
);
prior.push(phase76EStored);
replay = buildWorldSimulationFormalImpasseResolverReplay(prior);
const replayedMappings = await replay.experientialMethodTransferResolver(phase76EView);
const phase76EProjection = projectWorldSimulationExperientialMethodTransfer({
  resolver_view: phase76EView,
  transfer_mappings: replayedMappings,
});
assert.equal(phase76EProjection.transferred_method_mappings.length, 2);
assert.equal(phase76EProjection.audit.direct_action_selection, false);

// Phase79B: let the Character Brain explicitly leave the competition
// unresolved. The existing Phase79B kernel must produce the tie impasse.
const phase79A = projectWorldSimulationExperientialMethodCompetition({
  experiential_method_transfer_projections: [phase76EProjection],
  current_turn_id: turnId,
  character,
});
const phase79BView =
  buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
    experiential_method_competition: phase79A,
    experiential_method_transfer_projections: [phase76EProjection],
  });
assert.equal(phase79BView.character_contexts[0].competition_pairs.length, 1);
round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    experiential_knowledge_reentry_resolver_views: [phase76DView],
    experiential_method_transfer_resolver_views: [phase76EView],
    experiential_method_competition_resolution_resolver_views: [phase79BView],
  },
  prior_submissions: prior,
});
assert.equal(
  round.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE79B,
);
const phase79BStored = storeSubmission(
  round.decision_inputs[0],
  { preference_decisions: [] },
);
prior.push(phase79BStored);
replay = buildWorldSimulationFormalImpasseResolverReplay(prior);
const phase79BPreferences = await replay.experientialMethodCompetitionResolver(phase79BView);
const phase79BResolution = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: phase79BView,
  preference_decisions: phase79BPreferences,
});
assert.equal(phase79BResolution.tie_impasse_count, 1);

const phase79C = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: phase76EProjection,
  experiential_method_competition_resolution: phase79BResolution,
});
const phase79D = projectWorldSimulationExperientialMethodImpasseDeliberation({
  experiential_method_competition_resolution: phase79BResolution,
  experiential_method_competition_guidance: phase79C,
});
const phase79E = projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
  experiential_method_impasse_deliberation: phase79D,
  current_context: {
    perception: { route_state: "side opening visible" },
    attention: { focus: "side opening" },
    working_context: [{ content: "probe opening before committing" }],
  },
});
const phase79FView = buildWorldSimulationExperientialMethodImpasseReresolutionResolverView({
  source_phase79b_resolver_view: phase79BView,
  source_phase79b_resolution: phase79BResolution,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: phase79E,
});
round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    experiential_knowledge_reentry_resolver_views: [phase76DView],
    experiential_method_transfer_resolver_views: [phase76EView],
    experiential_method_competition_resolution_resolver_views: [phase79BView],
    experiential_method_impasse_reresolution_resolver_views: [phase79FView],
  },
  prior_submissions: prior,
});
assert.equal(
  round.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE79F,
);
const impasse = phase79FView.impasse_contexts[0];
const pair = impasse.competition_pairs[0];
const cueRef = impasse.current_context_cue_catalog[0].cue_ref;
const phase79FStored = storeSubmission(
  round.decision_inputs[0],
  {
    preference_revisions: [{
      impasse_ref: impasse.impasse_ref,
      competition_ref: pair.competition_ref,
      preference: "left_preferred",
      evidence_cue_refs: [cueRef],
    }],
  },
);
prior.push(phase79FStored);
replay = buildWorldSimulationFormalImpasseResolverReplay(prior);
const phase79FRevisions =
  await replay.experientialMethodImpasseReresolutionResolver(phase79FView);
const phase79FResolution = projectWorldSimulationExperientialMethodImpasseReresolution({
  resolver_view: phase79FView,
  source_phase79b_resolver_view: phase79BView,
  source_phase79b_resolution: phase79BResolution,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: phase79E,
  preference_revisions: phase79FRevisions,
});
assert.equal(phase79FResolution.resolved_impasse_count, 1);
assert.equal(phase79FResolution.remaining_impasse_count, 0);
assert.equal(phase79FResolution.audit.action_selection_performed, false);

// Phase79J transport support is independently exercised with a bounded
// canonical-shape resolver view. Phase79J's own suite remains authoritative for
// its deeper F/I provenance validation; Phase79M only owns stage routing,
// response bounding, exact resolver-view replay, and action separation.
const phase79JView = {
  version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
  character,
  current_turn_id: turnId,
  impasse_contexts: [{
    impasse_ref: "phase79m-j-impasse",
    impasse_type: "tie_impasse",
    candidate_methods: [
      { transfer_ref: "method-left" },
      { transfer_ref: "method-right" },
    ],
    competition_pairs: [{
      competition_ref: "phase79m-j-competition",
      left_transfer_ref: "method-left",
      right_transfer_ref: "method-right",
    }],
    revision_contract: {
      preference_revision_requires_precedent_refs: true,
    },
    eligible_precedents: [{
      precedent_ref: "phase79m-precedent-1",
      historical_resolution_status: "resolved_dominant",
    }],
  }],
};
phase79JView.resolver_view_hash = hashAgentRunValue(phase79JView);
const completedBeforeJ = [
  phase76DStored,
  phase76EStored,
  phase79BStored,
  phase79FStored,
];
round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    experiential_method_impasse_precedent_reresolution_resolver_views: [phase79JView],
  },
  prior_submissions: completedBeforeJ,
});
assert.equal(
  round.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE79J,
);
const phase79JStored = storeSubmission(
  round.decision_inputs[0],
  {
    preference_revisions: [{
      impasse_ref: "phase79m-j-impasse",
      competition_ref: "phase79m-j-competition",
      preference: "right_preferred",
      precedent_refs: ["phase79m-precedent-1"],
    }],
  },
);
const jReplay = buildWorldSimulationFormalImpasseResolverReplay([
  ...completedBeforeJ,
  phase79JStored,
]);
assert.deepEqual(
  await jReplay.experientialMethodImpassePrecedentReresolutionResolver(phase79JView),
  phase79JStored.deliberation_response.preference_revisions,
);

// Exact hash binding: a changed same-character view cannot silently consume an
// earlier Character Brain answer.
const stale76DView = structuredClone(phase76DView);
stale76DView.resolver_view_hash = "different-resolver-view-hash";
await assert.rejects(
  () => replay.experientialKnowledgeReentryResolver(stale76DView),
  (error) => error?.code
    === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_REPLAY_STALE",
);

// The generic validator rejects an authority field even if its value looks
// harmless. Character Brain may choose refs/preferences, never world truth,
// numeric utility, or actions inside the experiential deliberation response.
assert.throws(
  () => buildWorldSimulationFormalImpasseStoredSubmission({
    resolver_binding: {
      version: worldSimulationFormalImpasseDeliberationVersion,
      decision_kind: worldSimulationFormalImpasseDecisionKinds.PHASE79F,
      character,
      resolver_view_hash: phase79FView.resolver_view_hash,
    },
    character_input: publicDecisionInputForTest(round, character),
    deliberation_response: { preference_revisions: [], action_id: "forbidden" },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
);

// Broker authority split: an experiential-deliberation lease cannot accept an
// action selection. Completing the deliberation moves the same handle back to
// PREPARING so transport can reprepare the unchanged world snapshot.
const broker = createEphemeralWorldSimulationPreparedTurnBroker();
const brokerRound = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    experiential_knowledge_reentry_resolver_views: [phase76DView],
  },
  prior_submissions: [],
});
const brokerReceipt = broker.store({
  world_simulation_session_id: "world_simulation_phase79m",
  state_revision: 7,
  world_state_hash: "phase79m-world-state-hash",
  prepared_turn: {
    world_simulation_session_id: "world_simulation_phase79m",
    state_revision: 7,
    world_state_hash: "phase79m-world-state-hash",
  },
  decision_inputs: brokerRound.decision_inputs,
  decision_round_kind: brokerRound.decision_round_kind,
});
assert.equal(
  brokerReceipt.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE76D,
);
assert.throws(
  () => broker.submitDecision({
    prepared_turn_handle: brokerReceipt.prepared_turn_handle,
    decision_handle: brokerReceipt.current_decision.decision_handle,
    action_id: "forbidden-action",
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ACTION_SUBMISSION_DURING_IMPASSE_DELIBERATION",
);
const brokerSubmitted = broker.submitDeliberation({
  prepared_turn_handle: brokerReceipt.prepared_turn_handle,
  decision_handle: brokerReceipt.current_decision.decision_handle,
  preparer_owner_id: "phase79m-test-owner",
  deliberation_response: { activated_semantic_refs: [] },
});
assert.equal(brokerSubmitted.repreparation_required, true);
assert.equal(brokerSubmitted.receipt.lifecycle_status, "preparing");
assert.equal(brokerSubmitted.receipt.deliberation_submission_count, 1);

// With every eligible stage completed/absent, Phase79M returns null so the
// existing formal transport proceeds to ordinary action selection.
assert.equal(
  buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: {},
    prior_submissions: [
      phase76DStored,
      phase76EStored,
      phase79BStored,
      phase79FStored,
      phase79JStored,
    ],
  }),
  null,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const transportSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-formal-turn-transport-service.mjs"),
  "utf8",
);
const stateSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"),
  "utf8",
);
for (const field of [
  "experiential_knowledge_reentry_resolver_views",
  "experiential_method_transfer_resolver_views",
  "experiential_method_competition_resolution_resolver_views",
  "experiential_method_impasse_reresolution_resolver_views",
  "experiential_method_impasse_precedent_reresolution_resolver_views",
]) {
  assert.match(loopSource, new RegExp(`${field}:`));
  assert.equal(
    stateSource.includes(`${field}:`),
    false,
    `${field} must remain PreparedTurn-ephemeral and absent from durable history persistence.`,
  );
}
assert.match(transportSource, /prepareFormalDecisionRound/);
assert.match(transportSource, /formalReplayLoopOptions/);
assert.match(transportSource, /buildWorldSimulationFormalImpasseResolverReplay/);
assert.match(transportSource, /deliberation_response/);
assert.match(transportSource, /formal_transport_accepts_runtime_callbacks:\s*false/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase79M",
  stage_order: contract.stage_order,
  canonical_phase76d_replay_verified: true,
  canonical_phase76e_replay_verified: true,
  canonical_phase79b_replay_verified: true,
  canonical_phase79f_replay_verified: true,
  phase79j_transport_stage_verified: true,
  same_snapshot_broker_repreparation_verified: true,
  action_and_deliberation_authority_separated: true,
  resolver_views_persisted_to_world_history: false,
  caller_runtime_callback_forwarded: false,
  numeric_scoring_added: false,
}));
console.log("Phase79M native qualitative experiential deliberation tests passed.");

function publicDecisionInputForTest(jRound, expectedCharacter) {
  // Build a minimal valid Phase79F character task specifically for the negative
  // response-envelope assertion above; keeping this helper local avoids
  // depending on the Phase79J round currently held in `round`.
  const fRound = buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: {
      experiential_method_impasse_reresolution_resolver_views: [phase79FView],
    },
    prior_submissions: [phase76DStored, phase76EStored, phase79BStored],
  });
  assert.equal(fRound.decision_inputs[0].character_input.character, expectedCharacter);
  return fRound.decision_inputs[0].character_input;
}
