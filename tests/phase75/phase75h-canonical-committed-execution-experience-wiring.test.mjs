import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  projectWorldSimulationCharacterExperienceEvidence,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  worldSimulationActionCommitmentExecutionFeedbackVersion,
} from "../../server/src/world-simulation-action-commitment-execution-feedback-service.mjs";
import {
  buildWorldSimulationActionCommitmentSubjectiveExecutionExperienceContract,
  projectWorldSimulationActionCommitmentSubjectiveExecutionExperience,
} from "../../server/src/world-simulation-action-commitment-subjective-execution-experience-service.mjs";

const character = "伊萊亞斯・諾爾";
const actionId = "phase75h-action-001";
const turnId = "phase75h-turn-001";
const sessionId = "phase75h-session";
const authoritativeOutcome = {
  actor: character,
  action_id: actionId,
  result: "engine_only_result",
  causal_evidence: "engine_only_cause",
  character_experience: {
    performed: true,
    perceived_result: "我感覺這一擊被擋下來了",
    perceived_status: "受阻",
  },
};

const committedExperience = projectWorldSimulationCharacterExperienceEvidence({
  prepared_turn: {
    turn_id: turnId,
    decision_packets: [{
      character,
      perception: {
        observed: [],
        audible: [],
        other_senses: [],
        information_boundary: {},
      },
    }],
  },
  selected_action_intents: [{
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: "向前攻擊",
  }],
  action_outcomes: [authoritativeOutcome],
  runtime_identities: [{
    character,
    world_lineage: sessionId,
    character_entity_id: "fixture-character-phase75h",
    canonical_name: character,
    identity_source: "test_fixture_ephemeral_identity",
    formal_identity: false,
    experience_sequence: 1,
  }],
});

assert.equal(
  committedExperience.character_projections[0]
    .experience.participation.experienced_action_outcomes[0].perceived_result,
  "我感覺這一擊被擋下來了",
);
assert.equal(
  Object.hasOwn(
    committedExperience.character_projections[0]
      .experience.participation.experienced_action_outcomes[0],
    "result",
  ),
  false,
);
assert.equal(
  Object.hasOwn(
    committedExperience.character_projections[0]
      .experience.participation.experienced_action_outcomes[0],
    "causal_evidence",
  ),
  false,
);

const history = {
  world_simulation_session_id: sessionId,
  turns: [{
    turn_id: turnId,
    revision_from: 9,
    revision_to: 10,
    previous_state_hash: "c".repeat(64),
    next_state_hash: "d".repeat(64),
    action_outcomes: [authoritativeOutcome],
    committed_character_experience_projection: committedExperience,
  }],
};
const executionFeedback = {
  ok: true,
  version: worldSimulationActionCommitmentExecutionFeedbackVersion,
  world_simulation_session_id: sessionId,
  character,
  projection: {
    status: "authoritative_execution_feedback_available",
    active_commitment_ref: "phase75a_commitment_phase75h",
    action_id: actionId,
    matching_outcome_count: 1,
    feedback: [{
      feedback_ref: "phase75e_feedback_phase75h",
      source_turn_id: turnId,
      outcome_index: 0,
      outcome_hash: hashAgentRunValue(authoritativeOutcome),
    }],
  },
};

const subjective = projectWorldSimulationActionCommitmentSubjectiveExecutionExperience({
  execution_feedback_projection: executionFeedback,
  world_history: history,
});
assert.equal(subjective.projection.subjective_feedback_count, 1);
assert.equal(subjective.projection.latest_subjective_feedback.performed, true);
assert.equal(
  subjective.projection.latest_subjective_feedback.perceived_result,
  "我感覺這一擊被擋下來了",
);
assert.equal(
  subjective.projection.latest_subjective_feedback.perceived_status,
  "受阻",
);
const serialized = JSON.stringify(subjective);
assert.equal(serialized.includes("engine_only_result"), false);
assert.equal(serialized.includes("engine_only_cause"), false);

const contract = buildWorldSimulationActionCommitmentSubjectiveExecutionExperienceContract();
assert.equal(
  contract.subjective_source,
  "committed_character_experience_projection_experienced_action_outcomes",
);

const tamperedProjection = structuredClone(committedExperience);
tamperedProjection.character_projections[0]
  .experience.participation.experienced_action_outcomes[0].perceived_result = "竄改";
assert.throws(
  () => projectWorldSimulationActionCommitmentSubjectiveExecutionExperience({
    execution_feedback_projection: executionFeedback,
    world_history: {
      ...history,
      turns: [{
        ...history.turns[0],
        committed_character_experience_projection: tamperedProjection,
      }],
    },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_EXPERIENCE_PROJECTION_HASH_MISMATCH",
);

console.log("Phase75H canonical committed execution experience wiring tests passed.");
