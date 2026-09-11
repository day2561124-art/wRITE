import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  agentRunPaths,
  getAgentRun,
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertNeuralSessionRunShape,
  neuralSessionModes,
} from "./shared-neural-core-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";

export const worldSimulationStateVersion = "phase62c-world-state-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function fixtureTransactionMetadata(options = {}) {
  if (!options.fixtureRoot) return {};
  const metadata = {
    test_transaction_dir: path.join(
      options.fixtureRoot,
      "data",
      "outputs",
      "logs",
      "transactions",
    ),
  };
  if (
    process.env.FILE_TRANSACTION_TEST_MODE === "1"
    && Number.isSafeInteger(options.testFailAfterTransactionCommits)
    && options.testFailAfterTransactionCommits > 0
  ) {
    metadata.test_fail_after_commits = options.testFailAfterTransactionCommits;
  }
  return metadata;
}

export function worldSimulationStatePaths(sessionId, options = {}) {
  const directory = agentRunPaths(sessionId, options).directory;
  return {
    state: path.join(directory, "world_state.json"),
    history: path.join(directory, "world_history.json"),
  };
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      const missing = new Error(`${label} is not initialized.`);
      missing.code = "WORLD_SIMULATION_STATE_NOT_INITIALIZED";
      throw missing;
    }
    throw error;
  }
}

async function readOptionalJson(filePath) {
  try {
    return { exists: true, value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, value: null };
    throw error;
  }
}

async function assertWorldSimulationRun(sessionId, options = {}) {
  const run = await getAgentRun(sessionId, options);
  assertNeuralSessionRunShape(run, neuralSessionModes.WORLD_SIMULATION);
  return run;
}

function stateEnvelope(sessionId, state, revision, metadata = {}) {
  const clonedState = cloneJson(requireObject(state, "world state"));
  return {
    version: worldSimulationStateVersion,
    world_simulation_session_id: sessionId,
    revision,
    state_hash: hashAgentRunValue(clonedState),
    state: clonedState,
    ...metadata,
  };
}

export async function initializeWorldSimulationState(
  sessionId,
  initialWorldState,
  options = {},
) {
  await assertWorldSimulationRun(sessionId, options);
  const now = new Date().toISOString();
  const envelope = stateEnvelope(sessionId, initialWorldState, 0, {
    initialized_at: now,
    updated_at: now,
    last_turn_id: null,
  });
  const history = {
    version: worldSimulationStateVersion,
    world_simulation_session_id: sessionId,
    turns: [],
  };
  const paths = worldSimulationStatePaths(sessionId, options);
  await commitFileTransaction(
    "world-simulation-state-initialize",
    [
      {
        type: "write",
        filePath: paths.state,
        contentFactory: async () => {
          const [existingState, existingHistory] = await Promise.all([
            readOptionalJson(paths.state),
            readOptionalJson(paths.history),
          ]);
          if (existingState.exists || existingHistory.exists) {
            const already = new Error(
              `World simulation state is already initialized for ${sessionId}.`,
            );
            already.code = "WORLD_SIMULATION_STATE_ALREADY_INITIALIZED";
            throw already;
          }
          return `${JSON.stringify(envelope, null, 2)}\n`;
        },
      },
      {
        type: "write",
        filePath: paths.history,
        content: `${JSON.stringify(history, null, 2)}\n`,
      },
    ],
    {
      world_simulation_session_id: sessionId,
      action: "initialize-world-state",
      ...fixtureTransactionMetadata(options),
    },
  );
  return cloneJson(envelope);
}

export async function getWorldSimulationState(sessionId, options = {}) {
  await assertWorldSimulationRun(sessionId, options);
  const envelope = await readJson(
    worldSimulationStatePaths(sessionId, options).state,
    "world simulation state",
  );
  if (envelope.world_simulation_session_id !== sessionId) {
    throw new Error("World simulation state lineage does not match the session.");
  }
  return cloneJson(envelope);
}

export async function getWorldSimulationHistory(sessionId, options = {}) {
  await assertWorldSimulationRun(sessionId, options);
  const history = await readJson(
    worldSimulationStatePaths(sessionId, options).history,
    "world simulation history",
  );
  if (history.world_simulation_session_id !== sessionId) {
    throw new Error("World simulation history lineage does not match the session.");
  }
  return cloneJson(history);
}


function arrayTurns(history) {
  return Array.isArray(history?.turns) ? history.turns : [];
}

export async function commitWorldSimulationTurn(
  sessionId,
  input = {},
  options = {},
) {
  await assertWorldSimulationRun(sessionId, options);
  requireObject(input, "world simulation turn commit");
  if (!Number.isSafeInteger(input.expected_revision)) {
    throw new Error("expected_revision is required for a world-state commit.");
  }
  if (typeof input.expected_state_hash !== "string" || !input.expected_state_hash) {
    throw new Error("expected_state_hash is required for a world-state commit.");
  }
  const turnId = String(input.turn_id ?? "").trim();
  if (!turnId) throw new Error("turn_id is required for a world-state commit.");
  if (input.subjective_choice_commitment_receipts !== undefined
      && input.subjective_choice_commitment_receipts !== null) {
    assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
      input.subjective_choice_commitment_receipts,
      {
        world_simulation_session_id: sessionId,
        turn_id: turnId,
        state_revision: input.expected_revision,
        world_state_hash: input.expected_state_hash,
      },
    );
  }
  const nextWorldState = requireObject(input.next_world_state, "next_world_state");
  const paths = worldSimulationStatePaths(sessionId, options);
  let committedEnvelope = null;
  let committedHistoryEntry = null;

  await commitFileTransaction(
    "world-simulation-turn-commit",
    [
      {
        type: "write",
        filePath: paths.state,
        contentFactory: async () => {
          const current = await readJson(paths.state, "world simulation state");
          if (current.world_simulation_session_id !== sessionId) {
            throw new Error("World simulation state lineage does not match the session.");
          }
          if (current.revision !== input.expected_revision) {
            const stale = new Error(
              `World simulation state revision changed: expected ${input.expected_revision}, current ${current.revision}.`,
            );
            stale.code = "WORLD_SIMULATION_STALE_REVISION";
            throw stale;
          }
          if (current.state_hash !== input.expected_state_hash) {
            const stale = new Error("World simulation state hash changed before commit.");
            stale.code = "WORLD_SIMULATION_STALE_STATE_HASH";
            throw stale;
          }
          const now = new Date().toISOString();
          committedEnvelope = stateEnvelope(
            sessionId,
            nextWorldState,
            current.revision + 1,
            {
              initialized_at: current.initialized_at ?? now,
              updated_at: now,
              last_turn_id: turnId,
              previous_state_hash: current.state_hash,
            },
          );
          return `${JSON.stringify(committedEnvelope, null, 2)}\n`;
        },
      },
      {
        type: "write",
        filePath: paths.history,
        contentFactory: async () => {
          const history = await readJson(paths.history, "world simulation history");
          if (history.world_simulation_session_id !== sessionId) {
            throw new Error("World simulation history lineage does not match the session.");
          }
          if (arrayTurns(history).some((turn) => turn.turn_id === turnId)) {
            const duplicate = new Error(`World simulation turn already committed: ${turnId}`);
            duplicate.code = "WORLD_SIMULATION_DUPLICATE_TURN";
            throw duplicate;
          }
          const now = committedEnvelope?.updated_at ?? new Date().toISOString();
          committedHistoryEntry = cloneJson({
            turn_id: turnId,
            committed_at: now,
            revision_from: input.expected_revision,
            revision_to: committedEnvelope.revision,
            previous_state_hash: input.expected_state_hash,
            next_state_hash: committedEnvelope.state_hash,
            event: input.event ?? null,
            selected_action_intents: input.selected_action_intents ?? [],
            subjective_choice_commitment_receipts:
              input.subjective_choice_commitment_receipts ?? null,
            state_transitions: input.state_transitions ?? [],
            action_outcomes: input.action_outcomes ?? [],
            knowledge_transitions: input.knowledge_transitions ?? [],
            scheduled_events: input.scheduled_events ?? [],
            causal_timeline: input.causal_timeline ?? null,
            chronological_mutation_queue: input.chronological_mutation_queue ?? null,
            chronological_mutation_execution: input.chronological_mutation_execution ?? null,
            mutation_proposal_boundary: input.mutation_proposal_boundary ?? null,
            pure_proposal_producers: input.pure_proposal_producers ?? null,
            immutable_causal_evaluators: input.immutable_causal_evaluators ?? null,
            immutable_physics_effects: input.immutable_physics_effects ?? null,
            immutable_projectile_lifecycle: input.immutable_projectile_lifecycle ?? null,
            immutable_ability_field_lifecycle: input.immutable_ability_field_lifecycle ?? null,
            immutable_event_queries: input.immutable_event_queries ?? null,
            immutable_event_arbitration: input.immutable_event_arbitration ?? null,
            cross_layer_event_arbitration: input.cross_layer_event_arbitration ?? null,
            causal_epochs: input.causal_epochs ?? null,
            fixed_point_convergence: input.fixed_point_convergence ?? null,
            visibility_queries: input.visibility_queries ?? [],
            directional_height_visibility_queries: input.directional_height_visibility_queries ?? [],
            illumination_visibility_queries: input.illumination_visibility_queries ?? [],
            audibility_queries: input.audibility_queries ?? [],
            memory_accessibility_queries: input.memory_accessibility_queries ?? [],
            subjective_memory_encoding_decisions: input.subjective_memory_encoding_decisions ?? null,
            subjective_memory_episode_bindings: input.subjective_memory_episode_bindings ?? null,
            subjective_memory_plasticity:
              input.subjective_memory_plasticity ?? null,
            subjective_memory_plasticity_mutation_queue:
              input.subjective_memory_plasticity_mutation_queue ?? null,
            subjective_memory_plasticity_mutation_execution:
              input.subjective_memory_plasticity_mutation_execution ?? null,
            subjective_memory_formation: input.subjective_memory_formation ?? null,
            subjective_memory_mutation_queue: input.subjective_memory_mutation_queue ?? null,
            subjective_memory_mutation_execution: input.subjective_memory_mutation_execution ?? null,
            subjective_episode_segmentation:
              input.subjective_episode_segmentation ?? null,
            subjective_episode_segmentation_mutation_queue:
              input.subjective_episode_segmentation_mutation_queue ?? null,
            subjective_episode_segmentation_mutation_execution:
              input.subjective_episode_segmentation_mutation_execution ?? null,
            autobiographical_life_event_organization_decision_resolution:
              input.autobiographical_life_event_organization_decision_resolution ?? null,
            autobiographical_life_event_organization:
              input.autobiographical_life_event_organization ?? null,
            autobiographical_life_event_organization_mutation_queue:
              input.autobiographical_life_event_organization_mutation_queue ?? null,
            autobiographical_life_event_organization_mutation_execution:
              input.autobiographical_life_event_organization_mutation_execution ?? null,
            multi_experience_schema_evidence:
              input.multi_experience_schema_evidence ?? null,
            relational_schema_induction:
              input.relational_schema_induction ?? null,
            relational_schema_promotion_resolution:
              input.relational_schema_promotion_resolution ?? null,
            relational_schema_semantic_promotion:
              input.relational_schema_semantic_promotion ?? null,
            relational_schema_semantic_promotion_mutation_queue:
              input.relational_schema_semantic_promotion_mutation_queue ?? null,
            relational_schema_semantic_promotion_mutation_execution:
              input.relational_schema_semantic_promotion_mutation_execution ?? null,
            personal_semantic_memory_decision_resolution:
              input.personal_semantic_memory_decision_resolution ?? null,
            personal_semantic_memory_derivation:
              input.personal_semantic_memory_derivation ?? null,
            personal_semantic_memory_mutation_queue:
              input.personal_semantic_memory_mutation_queue ?? null,
            personal_semantic_memory_mutation_execution:
              input.personal_semantic_memory_mutation_execution ?? null,
            autobiographical_life_period_organization_decision_resolution:
              input.autobiographical_life_period_organization_decision_resolution ?? null,
            autobiographical_life_period_organization:
              input.autobiographical_life_period_organization ?? null,
            autobiographical_life_period_organization_mutation_queue:
              input.autobiographical_life_period_organization_mutation_queue ?? null,
            autobiographical_life_period_organization_mutation_execution:
              input.autobiographical_life_period_organization_mutation_execution ?? null,
            experience_grounded_subjective_learning_interpretation_resolution:
              input.experience_grounded_subjective_learning_interpretation_resolution ?? null,
            experiential_knowledge_reentry_projections:
              input.experiential_knowledge_reentry_projections ?? null,
            experiential_method_transfer_projections:
              input.experiential_method_transfer_projections ?? null,
            experiential_method_competition_projections:
              input.experiential_method_competition_projections ?? null,
            experiential_method_competition_resolution_projections:
              input.experiential_method_competition_resolution_projections ?? null,
            experiential_method_competition_guidance_projections:
              input.experiential_method_competition_guidance_projections ?? null,
            experiential_method_impasse_deliberation_projections:
              input.experiential_method_impasse_deliberation_projections ?? null,
            experiential_method_impasse_discriminating_evidence_projections:
              input.experiential_method_impasse_discriminating_evidence_projections ?? null,
            experiential_method_impasse_reresolution_projections:
              input.experiential_method_impasse_reresolution_projections ?? null,
            experiential_method_impasse_precedent_reentry_projections:
              input.experiential_method_impasse_precedent_reentry_projections ?? null,
            analogical_experience_candidate_projections:
              input.analogical_experience_candidate_projections ?? null,
            experiential_method_impasse_precedent_reresolution_projections:
              input.experiential_method_impasse_precedent_reresolution_projections ?? null,
            experiential_method_candidate_attribution_projections:
              input.experiential_method_candidate_attribution_projections ?? null,
            selected_experiential_method_application_receipts:
              input.selected_experiential_method_application_receipts ?? null,
            experiential_method_impasse_resolution_application_lineage:
              input.experiential_method_impasse_resolution_application_lineage ?? null,
            analogical_experience_application_lineage:
              input.analogical_experience_application_lineage ?? null,
            analogical_experience_outcome_evidence:
              input.analogical_experience_outcome_evidence ?? null,
            analogical_experience_retention_capsules:
              input.analogical_experience_retention_capsules ?? null,
            analogical_experience_retention_reentry_projections:
              input.analogical_experience_retention_reentry_projections ?? null,
            analogical_experience_retention_reuse_projections:
              input.analogical_experience_retention_reuse_projections ?? null,
            experiential_method_outcome_credit_resolution:
              input.experiential_method_outcome_credit_resolution ?? null,
            experiential_method_impasse_resolution_outcome_evidence:
              input.experiential_method_impasse_resolution_outcome_evidence ?? null,
            experiential_method_semantic_revision:
              input.experiential_method_semantic_revision ?? null,
            experiential_method_semantic_revision_mutation_queue:
              input.experiential_method_semantic_revision_mutation_queue ?? null,
            experiential_method_semantic_revision_mutation_execution:
              input.experiential_method_semantic_revision_mutation_execution ?? null,
            contextual_schema_refinement_evidence:
              input.contextual_schema_refinement_evidence ?? null,
            contextual_schema_specialization_resolution:
              input.contextual_schema_specialization_resolution ?? null,
            contextual_schema_specialization_admission_resolution:
              input.contextual_schema_specialization_admission_resolution ?? null,
            contextual_schema_specialization_semantic_retention:
              input.contextual_schema_specialization_semantic_retention ?? null,
            contextual_schema_specialization_semantic_retention_mutation_queue:
              input.contextual_schema_specialization_semantic_retention_mutation_queue ?? null,
            contextual_schema_specialization_semantic_retention_mutation_execution:
              input.contextual_schema_specialization_semantic_retention_mutation_execution ?? null,
            subjective_claim_proposal_resolution:
              input.subjective_claim_proposal_resolution ?? null,
            subjective_claim_projection:
              input.subjective_claim_projection ?? null,
            subjective_claim_mutation_queue:
              input.subjective_claim_mutation_queue ?? null,
            subjective_claim_mutation_execution:
              input.subjective_claim_mutation_execution ?? null,
            subjective_claim_relation_proposal_resolution:
              input.subjective_claim_relation_proposal_resolution ?? null,
            subjective_claim_conflict_revision_projection:
              input.subjective_claim_conflict_revision_projection ?? null,
            subjective_claim_relation_mutation_queue:
              input.subjective_claim_relation_mutation_queue ?? null,
            subjective_claim_relation_mutation_execution:
              input.subjective_claim_relation_mutation_execution ?? null,
            subjective_belief_resolution:
              input.subjective_belief_resolution ?? null,
            subjective_belief_revision_projection:
              input.subjective_belief_revision_projection ?? null,
            subjective_belief_revision_mutation_queue:
              input.subjective_belief_revision_mutation_queue ?? null,
            subjective_belief_revision_mutation_execution:
              input.subjective_belief_revision_mutation_execution ?? null,
            committed_character_current_mind_projection:
              input.committed_character_current_mind_projection ?? null,
            post_outcome_subjective_perception_projection:
              input.post_outcome_subjective_perception_projection ?? null,
            post_outcome_counterfactual_alternative_evidence:
              input.post_outcome_counterfactual_alternative_evidence ?? null,
            post_outcome_counterfactual_appraisal:
              input.post_outcome_counterfactual_appraisal ?? null,
            post_outcome_counterfactual_reflection_retention:
              input.post_outcome_counterfactual_reflection_retention ?? null,
            post_outcome_subjective_memory_bridge:
              input.post_outcome_subjective_memory_bridge ?? null,
            post_outcome_subjective_memory_formation:
              input.post_outcome_subjective_memory_formation ?? null,
            post_outcome_subjective_memory_mutation_queue:
              input.post_outcome_subjective_memory_mutation_queue ?? null,
            post_outcome_subjective_memory_mutation_execution:
              input.post_outcome_subjective_memory_mutation_execution ?? null,
            committed_character_experience_projection:
              input.committed_character_experience_projection ?? null,
            trace_ids: input.trace_ids ?? [],
            causal_resolution_id: input.causal_resolution_id ?? null,
          });
          const nextHistory = {
            ...history,
            turns: [...arrayTurns(history), committedHistoryEntry],
          };
          return `${JSON.stringify(nextHistory, null, 2)}\n`;
        },
      },
    ],
    {
      world_simulation_session_id: sessionId,
      action: "commit-world-turn",
      turn_id: turnId,
      expected_revision: input.expected_revision,
      ...fixtureTransactionMetadata(options),
    },
  );

  return {
    state: cloneJson(committedEnvelope),
    history_entry: cloneJson(committedHistoryEntry),
  };
}
