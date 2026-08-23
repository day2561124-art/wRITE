import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";
import {
  projectWorldSimulationMutationProposals,
} from "./world-simulation-mutation-proposal-service.mjs";

export const worldSimulationPureProposalProducerVersion = "phase62m-pure-proposal-producer-v1";

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

export function runWorldSimulationPureProposalProducer(input = {}) {
  if (typeof input.solve !== "function") {
    const error = new Error("Pure proposal producer requires a synchronous solve function.");
    error.code = "WORLD_SIMULATION_PURE_PROPOSAL_SOLVER_REQUIRED";
    throw error;
  }
  const producer = String(input.producer ?? "causal_subsystem").trim() || "causal_subsystem";
  const rootWorldState = cloneJson(object(input.root_world_state));
  const authoritativeWorldState = cloneJson(object(input.authoritative_world_state));
  const existingTransitions = cloneJson(array(input.existing_state_transitions));
  const isolatedPreviewWorldState = cloneJson(authoritativeWorldState);
  const solverResult = object(input.solve({
    authoritative_world_state: cloneJson(authoritativeWorldState),
    isolated_preview_world_state: isolatedPreviewWorldState,
  }));
  if (!isObject(solverResult.next_world_state)) {
    const error = new Error(`Pure proposal producer ${producer} did not return its private preview for boundary validation.`);
    error.code = "WORLD_SIMULATION_PRIVATE_PREVIEW_REQUIRED";
    throw error;
  }
  const producerTransitions = cloneJson(array(solverResult.state_transitions ?? solverResult.mutation_proposals));
  const cumulativeTransitions = [...existingTransitions, ...producerTransitions];
  const validation = projectWorldSimulationMutationProposals({
    producer,
    producer_transition_start: existingTransitions.length,
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    world_state: rootWorldState,
    preview_world_state: solverResult.next_world_state,
    state_transitions: cumulativeTransitions,
    causal_timeline: object(input.causal_timeline),
    elapsed_ms: input.elapsed_ms ?? solverResult.elapsed_ms ?? 0,
    scene_id: input.scene_id ?? null,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: cumulativeTransitions,
    causal_timeline: object(input.causal_timeline),
    elapsed_ms: input.elapsed_ms ?? solverResult.elapsed_ms ?? 0,
  });
  const projection = projectWorldSimulationChronologicalMutationQueue({
    world_state: rootWorldState,
    queue,
    scene_id: input.scene_id ?? null,
  });
  const {
    next_world_state: _discardedPreview,
    next_world_state_authority: _discardedAuthority,
    state_transitions: _discardedTransitions,
    mutation_proposals: _discardedProposals,
    ...publicResult
  } = solverResult;
  const proposalPackage = {
    version: worldSimulationPureProposalProducerVersion,
    producer,
    mutation_proposals: producerTransitions,
    proposal_count: producerTransitions.length,
    producer_return_contains_world_state: false,
    internal_preview_discarded_before_return: true,
    hidden_preview_writes_rejected_before_return: true,
    inter_subsystem_projection_queue_hash: queue.queue_hash,
    inter_subsystem_projection_hash: projection.projection.projection_hash,
    projection_is_mutation_only_and_may_omit_semantically_default_sparse_fields: true,
  };
  proposalPackage.package_hash = hashAgentRunValue({
    version: proposalPackage.version,
    producer,
    mutation_proposals: producerTransitions,
    public_result: publicResult,
    projection_hash: proposalPackage.inter_subsystem_projection_hash,
  });
  const audit = {
    ...validation.audit,
    pure_proposal_producer_version: worldSimulationPureProposalProducerVersion,
    producer_return_contains_world_state: false,
    internal_preview_discarded_before_return: true,
    hidden_preview_writes_rejected_before_return: true,
    proposal_package_hash: proposalPackage.package_hash,
  };
  return {
    proposal_package: proposalPackage,
    result: cloneJson(publicResult),
    audit,
  };
}

export function projectWorldSimulationPureProposalTransitions(input = {}) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: array(input.state_transitions),
    causal_timeline: object(input.causal_timeline),
    elapsed_ms: input.elapsed_ms ?? 0,
  });
  const projection = projectWorldSimulationChronologicalMutationQueue({
    world_state: object(input.root_world_state),
    queue,
    scene_id: input.scene_id ?? null,
  });
  return {
    projected_world_state: projection.projected_world_state,
    projection_receipt: projection.projection,
    queue_hash: queue.queue_hash,
  };
}

export function buildWorldSimulationPureProposalProducerContract() {
  return {
    version: worldSimulationPureProposalProducerVersion,
    owner: "programmatic_pure_mutation_proposal_interface",
    producer_output: {
      world_state_returned: false,
      mutation_proposals_returned: true,
      causal_metadata_and_outcomes_may_be_returned: true,
      internal_mutable_preview_discarded_before_return: true,
    },
    handoff: {
      next_subsystem_reads_executor_projection_only: true,
      hidden_preview_write_rejected_before_producer_return: true,
      mutation_preconditions_checked_during_projection: true,
    },
    migrated_producers: [
      "spatial_rules",
      "continuous_actor_state_precombat",
      "combat",
      "continuous_physics",
      "continuous_actor_state_postphysics",
    ],
    final_commit_authority: "chronological_mutation_executor_only",
    character_brain_may_return_world_state_or_mutation_proposals: false,
    known_boundary: "Phase62M removes world-state objects from the public return values of all five causal producer boundaries. Legacy solver internals may still mutate isolated private preview clones while calculating proposals; those private previews are validated and discarded before returning to orchestration.",
  };
}
