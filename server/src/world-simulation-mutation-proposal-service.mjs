import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";

export const worldSimulationMutationProposalBoundaryVersion = "phase62l-mutation-proposal-boundary-v1";

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

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

export function projectWorldSimulationMutationProposals(input = {}) {
  const transitions = array(input.state_transitions);
  const producerTransitionStart = Math.min(
    nonNegativeInteger(input.producer_transition_start, 0),
    transitions.length,
  );
  const producer = String(input.producer ?? "causal_subsystem").trim() || "causal_subsystem";
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: input.turn_id ?? null,
    world_state_hash: input.world_state_hash ?? null,
    state_transitions: transitions,
    causal_timeline: object(input.causal_timeline),
    elapsed_ms: input.elapsed_ms ?? 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: object(input.world_state),
    preview_world_state: object(input.preview_world_state),
    queue,
    scene_id: input.scene_id ?? null,
  });
  const producerTransitions = transitions.slice(producerTransitionStart);
  const audit = {
    version: worldSimulationMutationProposalBoundaryVersion,
    producer,
    cumulative_proposal_count: transitions.length,
    producer_proposal_count: producerTransitions.length,
    producer_transition_start: producerTransitionStart,
    projection_queue_hash: queue.queue_hash,
    projection_execution_hash: execution.execution.execution_hash,
    subsystem_preview_world_state_authoritative: false,
    executor_projection_is_only_inter_subsystem_handoff_state: true,
    hidden_preview_writes_rejected_at_boundary: true,
    committed_world_state_written_here: false,
  };
  audit.audit_hash = hashAgentRunValue({
    version: audit.version,
    producer: audit.producer,
    cumulative_proposal_count: audit.cumulative_proposal_count,
    producer_proposal_count: audit.producer_proposal_count,
    projection_queue_hash: audit.projection_queue_hash,
    projection_execution_hash: audit.projection_execution_hash,
    projected_world_state: execution.next_world_state,
  });
  return {
    projected_world_state: cloneJson(execution.next_world_state),
    audit,
  };
}

export function buildWorldSimulationMutationProposalBoundaryContract() {
  return {
    version: worldSimulationMutationProposalBoundaryVersion,
    owner: "programmatic_mutation_proposal_boundary",
    subsystem_interface: {
      next_world_state_return_value_is_preview_only: true,
      state_transitions_are_mutation_proposals: true,
      inter_subsystem_world_state_handoffs_use_executor_projection_only: true,
      hidden_preview_writes_rejected_before_handoff: true,
    },
    final_commit_authority: "chronological_mutation_executor_only",
    character_brain_may_create_mutation_proposals: false,
    known_boundary: "Phase62L removes mutable subsystem draft state from inter-subsystem handoffs. Combat, physics, actor-state, and spatial solvers may still use isolated mutable drafts internally while computing proposals; later phases may make those internal solvers structurally pure.",
  };
}
