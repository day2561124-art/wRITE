import { getWorldSimulationState } from "./world-simulation-state-service.mjs";
import { resolveWorldSimulationTurn, resolveWorldSimulationTurnWithPostEncodingClaimIntents } from "./world-simulation-loop-service.mjs";
import { resolveWorldSimulationNativeGoalDecisionIntents } from "./world-simulation-motivation-goal-integration-service.mjs";
import { resolveWorldSimulationNativeImplementationIntentionIntents } from "./world-simulation-goal-to-plan-implementation-intention-service.mjs";

const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

// Trusted engine execution only. The broker supplies frozen selections and
// optionally the parent-owned single-resolution post-encoding handoff.
export async function runFormalWorldResolution(acquisition, loopOptions = {}, postEncoding = null) {
    const goalPlanIntents = acquisition.goal_plan_intents ?? {};
    const goalDecisions = [];
    const planDecisions = [];
    if (Object.keys(goalPlanIntents).length > 0) {
      const snapshot = await getWorldSimulationState(acquisition.prepared_turn.world_simulation_session_id, loopOptions);
      if (snapshot.revision !== acquisition.prepared_turn.state_revision
        || snapshot.state_hash !== acquisition.prepared_turn.world_state_hash) {
        fail("WORLD_SIMULATION_FORMAL_PREPARED_TURN_STALE", "Goal and plan intents no longer match the committed snapshot.");
      }
      for (const packet of acquisition.prepared_turn.decision_packets) {
        if (!Object.hasOwn(goalPlanIntents, packet.character)) continue;
        const intent = goalPlanIntents[packet.character];
        const context = { world_state: snapshot.state, character: packet.character, turn_id: acquisition.prepared_turn.turn_id };
        if (Object.hasOwn(intent, "goal_intents")) {
          goalDecisions.push(...resolveWorldSimulationNativeGoalDecisionIntents({
            ...context, context_token: intent.goal_context_token, goal_intents: intent.goal_intents,
          }).goal_decisions);
        }
        if (Object.hasOwn(intent, "plan_intents")) {
          planDecisions.push(...resolveWorldSimulationNativeImplementationIntentionIntents({
            ...context, context_token: intent.plan_context_token, plan_intents: intent.plan_intents,
          }).implementation_intention_decisions);
        }
      }
    }
    // The final ACTION round already contains the same-snapshot Phase81D/81E
    // projections that shaped the Character Brain surface. Resolve consumes
    // those exact ephemeral projections rather than recomputing cognition after
    // action submission.
    const resolutionOptions = {
        ...loopOptions,
        ...(goalDecisions.length ? { motivationalGoalResolver: async () => cloneJson(goalDecisions) } : {}),
        ...(planDecisions.length ? { goalImplementationIntentionResolver: async () => cloneJson(planDecisions) } : {}),
        counterfactualReflectionReentryProjections:
          acquisition.prepared_turn.counterfactual_reflection_reentry_projections ?? [],
        counterfactualLinkedExperienceReentryProjections:
          acquisition.prepared_turn.counterfactual_linked_experience_reentry_projections ?? [],
        counterfactualLinkedExperienceReuseOutcomeReentryProjections:
          acquisition.prepared_turn.counterfactual_linked_experience_reuse_outcome_reentry_projections ?? [],
        counterfactualLinkedExperienceReuseOutcomeDeliberationProjections:
          acquisition.prepared_turn.counterfactual_linked_experience_reuse_outcome_deliberation_projections ?? [],
        counterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjections:
          acquisition.prepared_turn.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections ?? [],
        counterfactualLinkedExperienceReuseProjections:
          acquisition.prepared_turn.counterfactual_linked_experience_reuse_projections ?? [],
        counterfactualPreparativeRevalidationProjections:
          acquisition.prepared_turn.counterfactual_preparative_revalidation_projections ?? [],
    };
    return postEncoding ? resolveWorldSimulationTurnWithPostEncodingClaimIntents(
      acquisition.prepared_turn, acquisition.selected_actions, postEncoding, resolutionOptions,
    ) : resolveWorldSimulationTurn(acquisition.prepared_turn, acquisition.selected_actions, resolutionOptions);
}

// No full World result crosses the continuation boundary.
export function summarizeFormalWorldResolution(result) {
  return {
    ok: result?.ok === true, committed: result?.committed === true,
    blocked_reason: result?.committed === true ? null : "world_resolution_blocked",
    revision: result?.revision ?? null,
    previous_state_hash: result?.previous_state_hash ?? null,
    next_state_hash: result?.next_state_hash ?? null,
  };
}
