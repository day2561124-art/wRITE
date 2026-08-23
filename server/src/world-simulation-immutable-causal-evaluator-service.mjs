import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";

export const worldSimulationImmutableCausalEvaluatorVersion = "phase62n-immutable-causal-evaluator-v1";

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

function forbiddenWorldStateKeys(result) {
  return ["world_state", "next_world_state", "preview_world_state", "projected_world_state"]
    .filter((key) => Object.hasOwn(result, key));
}

export function runWorldSimulationImmutableCausalEvaluator(input = {}) {
  if (typeof input.evaluate !== "function") {
    const error = new Error("Immutable causal evaluator requires a synchronous evaluate function.");
    error.code = "WORLD_SIMULATION_IMMUTABLE_EVALUATOR_REQUIRED";
    throw error;
  }
  const evaluator = String(input.evaluator ?? "causal_effect").trim() || "causal_effect";
  const context = cloneJson(object(input.context));
  const contextHashBefore = hashAgentRunValue(context);

  const evaluateOnce = () => {
    const frozenContext = deepFreeze(cloneJson(context));
    const raw = object(input.evaluate(frozenContext));
    const forbidden = forbiddenWorldStateKeys(raw);
    if (forbidden.length) {
      const error = new Error(`Immutable causal evaluator ${evaluator} returned forbidden world-state fields: ${forbidden.join(", ")}.`);
      error.code = "WORLD_SIMULATION_IMMUTABLE_EVALUATOR_WORLD_STATE_FORBIDDEN";
      error.forbidden_fields = forbidden;
      throw error;
    }
    const mutationProposals = cloneJson(array(raw.mutation_proposals ?? raw.state_transitions));
    const {
      mutation_proposals: _discardedProposals,
      state_transitions: _discardedTransitions,
      ...result
    } = raw;
    return {
      mutation_proposals: mutationProposals,
      result: cloneJson(result),
    };
  };

  const first = evaluateOnce();
  const second = input.verify_determinism === false ? first : evaluateOnce();
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error(`Immutable causal evaluator ${evaluator} produced non-deterministic output for identical input.`);
    error.code = "WORLD_SIMULATION_CAUSAL_EVALUATOR_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }

  const contextHashAfter = hashAgentRunValue(context);
  if (contextHashBefore !== contextHashAfter) {
    const error = new Error(`Immutable causal evaluator ${evaluator} mutated its input context.`);
    error.code = "WORLD_SIMULATION_CAUSAL_EVALUATOR_INPUT_MUTATION";
    throw error;
  }

  const audit = {
    version: worldSimulationImmutableCausalEvaluatorVersion,
    evaluator,
    input_context_hash: contextHashBefore,
    output_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    evaluator_output_contains_world_state: false,
    mutation_proposals_only_for_state_change: true,
    mutation_proposal_count: first.mutation_proposals.length,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    evaluator_version: worldSimulationImmutableCausalEvaluatorVersion,
    evaluator,
    mutation_proposals: first.mutation_proposals,
    result: first.result,
    audit,
  };
}

export function projectWorldSimulationImmutableEvaluatorProposals(input = {}) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: array(input.mutation_proposals),
    causal_timeline: object(input.causal_timeline),
    elapsed_ms: input.elapsed_ms ?? 0,
  });
  const projection = projectWorldSimulationChronologicalMutationQueue({
    world_state: object(input.world_state),
    queue,
    scene_id: input.scene_id ?? null,
  });
  return {
    projected_world_state: projection.projected_world_state,
    projection_receipt: projection.projection,
    queue_hash: queue.queue_hash,
  };
}

export function buildWorldSimulationImmutableCausalEvaluatorContract() {
  return {
    version: worldSimulationImmutableCausalEvaluatorVersion,
    owner: "programmatic_immutable_causal_evaluation",
    evaluator_contract: {
      receives_frozen_cloned_context: true,
      may_return_world_state: false,
      returns_mutation_proposals_for_state_change: true,
      deterministic_replay_checked_for_identical_input: true,
      proposal_projection_is_separate_from_causal_evaluation: true,
    },
    migrated_effect_evaluators: [
      "combat_injury",
      "barrier_capacity_depletion",
    ],
    legacy_private_preview_adapter: {
      allowed: true,
      causal_authority: false,
      purpose: "mechanically project evaluator proposals into isolated legacy solver previews until deeper solver refactors remove preview objects entirely",
    },
    character_brain_may_decide_mutation_values: false,
    known_boundary: "Phase62N makes combat injury and barrier depletion causal decisions immutable proposal evaluators. Other solver internals, including projectile topology mutation and actor trajectory reconciliation, still have legacy private-preview implementations behind the pure producer boundary.",
  };
}
