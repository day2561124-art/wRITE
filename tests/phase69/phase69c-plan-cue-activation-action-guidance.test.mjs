import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  motivationalGoalEventSchemaVersion,
  motivationalGoalHistoryReferenceSchemaVersion,
  worldSimulationMotivationGoalIntegrationVersion,
} from "../../server/src/world-simulation-motivation-goal-integration-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionEvents,
  buildWorldSimulationGoalImplementationIntentionResolverView,
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionRevisionResolverView,
  buildWorldSimulationGoalImplementationIntentionRevisions,
} from "../../server/src/world-simulation-goal-implementation-intention-revision-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionActivationContract,
  buildWorldSimulationGoalImplementationIntentionActivationResolverView,
  buildWorldSimulationNativeImplementationIntentionActivationView,
  nativeImplementationIntentionActivationCapability,
  projectWorldSimulationGoalImplementationIntentionActivation,
  resolveWorldSimulationNativeImplementationIntentionActivationIntent,
  worldSimulationGoalImplementationIntentionActivationVersion,
} from "../../server/src/world-simulation-goal-implementation-intention-activation-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  prepareWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function goalHash(event) { const body = clone(event); delete body.goal_event_hash; return hashAgentRunValue(body); }
function goalRef(event) {
  return {
    schema_version: motivationalGoalHistoryReferenceSchemaVersion,
    derived_index: true,
    goal_event_id: event.goal_event_id,
    goal_event_hash: event.goal_event_hash,
    goal_id: event.goal_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    previous_goal_event_id: event.previous_goal_event_id,
    previous_goal_event_hash: event.previous_goal_event_hash,
    status: event.status,
  };
}
function makeGoalEvent({ character, goalId, turnId, operation, previous = null }) {
  const event = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation,
    goal_id: goalId,
    goal_kind: "maintain_state",
    domain: "relationships",
    target_descriptor: { label: "keep_companions_safe", context: "academy_conflict" },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "self_aspect_source_69c",
      source_event_hash: "self_aspect_hash_69c",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `goal_resolver_${turnId}`,
    previous_goal_event_id: previous?.goal_event_id ?? null,
    previous_goal_event_hash: previous?.goal_event_hash ?? null,
    subjective_not_world_truth: true,
    world_truth_verified: false,
    proposed_is_not_committed: true,
    committed_goal_is_selected_action: false,
    action_plan_generated: false,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    character_brain_direct_write: false,
    status: "motivational_goal_event_recorded",
    goal_event_id: `goal_event_${turnId}`,
  };
  event.goal_event_hash = goalHash(event);
  return event;
}
function executeBuilt(world, turnId, layer, built) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${layer}`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}
function revise(world, turnId, decision) {
  const resolver = buildWorldSimulationGoalImplementationIntentionRevisionResolverView({ world_state: world, turn_id: turnId });
  const built = buildWorldSimulationGoalImplementationIntentionRevisions({
    world_state: world,
    turn_id: turnId,
    revision_decisions: [{ ...decision, resolver_view_hash: resolver.resolver_view_hash }],
  });
  return executeBuilt(world, turnId, "goal_implementation_intention_revision", built);
}

const elias = "伊萊亞斯・諾爾";
const goalId = "motivational_goal_phase69c_committed_001";
const proposed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69c_goal_001", operation: "propose" });
const committed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69c_goal_002", operation: "commit", previous: proposed });
let world = {
  motivational_goal_events: {
    [proposed.goal_event_id]: proposed,
    [committed.goal_event_id]: committed,
  },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};

const planTurnA = "world_turn_phase69c_plan_001";
const planResolverA = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: world, turn_id: planTurnA });
const formedA = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: planTurnA,
  implementation_intention_decisions: [{
    character: elias,
    goal_id: goalId,
    cue_descriptor: { cue_kind: "obstacle", label: "companion_is_threatened", context: "academy_conflict" },
    response_descriptor: { response_kind: "seek_support", label: "coordinate_with_nearby_ally", context: "planning_only" },
    resolver_view_hash: planResolverA.resolver_view_hash,
  }],
});
world = executeBuilt(world, planTurnA, "goal_implementation_intention", formedA);
const planA = formedA.result.implementation_intention_events_created[0];

const planTurnB = "world_turn_phase69c_plan_002";
const planResolverB = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: world, turn_id: planTurnB });
const formedB = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: planTurnB,
  implementation_intention_decisions: [{
    character: elias,
    goal_id: goalId,
    cue_descriptor: { cue_kind: "opportunity", label: "trusted_ally_is_available", context: "academy_conflict" },
    response_descriptor: { response_kind: "communication", label: "request_coordinated_cover", context: "planning_only" },
    resolver_view_hash: planResolverB.resolver_view_hash,
  }],
});
world = executeBuilt(world, planTurnB, "goal_implementation_intention", formedB);
const planB = formedB.result.implementation_intention_events_created[0];
world = revise(world, "world_turn_phase69c_challenge", {
  character: elias,
  operation: "challenge",
  target_implementation_intention_id: planA.implementation_intention_id,
});
world = revise(world, "world_turn_phase69c_suspend", {
  character: elias,
  operation: "suspend",
  target_implementation_intention_id: planB.implementation_intention_id,
});

const contract = buildWorldSimulationGoalImplementationIntentionActivationContract();
assert.equal(contract.phase, "Phase69C");
assert.equal(contract.read_only_projection_only, true);
assert.equal(contract.durable_state_created, false);
assert.equal(contract.action_selection_authority_claimed, false);
assert.equal(contract.causal_outcome_authority_claimed, false);
assert.equal(contract.numeric_activation_utility_priority_probability_confidence_modeled, false);

const resolverView = buildWorldSimulationGoalImplementationIntentionActivationResolverView({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase69c_current",
  current_context: {
    perception: {
      visible_summary: "A companion is under pressure while a trusted ally is nearby.",
      engine_target_id: "must_not_leak",
    },
    working_context: [{ content: "protect companion" }],
    subjective_cognition: { beliefs: [{ proposition: "coordination may help" }] },
    internal_id: "must_not_leak",
  },
});
assert.equal(resolverView.version, worldSimulationGoalImplementationIntentionActivationVersion);
assert.equal(resolverView.plans.length, 1, "Suspended plans must not reach the Phase69C resolver view.");
assert.equal(resolverView.plans[0].reconsideration_state, "challenged");
assert.equal(resolverView.plans[0].if_cue.label, "companion_is_threatened");
assert.equal(Object.hasOwn(resolverView.plans[0], "implementation_intention_id"), false);
assert.equal(Object.hasOwn(resolverView.current_context.perception, "engine_target_id"), false);
assert.equal(Object.hasOwn(resolverView.current_context, "internal_id"), false);
assert.equal(resolverView.action_selection_requested, false);
assert.equal(resolverView.feasibility_judgment_requested, false);

const ref = resolverView.plans[0].plan_ref;

// CB-C3-E Native adoption: Character Brain receives a second opaque token
// layer, not Phase69C engine plan refs, and can only admit cue applicability.
const nativeActivationView =
  buildWorldSimulationNativeImplementationIntentionActivationView({
    resolver_view: resolverView,
  });
assert.equal(nativeActivationView.plans.length, 1);
assert.equal(nativeActivationView.cue_applicability_judgment_only, true);
assert.equal(nativeActivationView.action_selection_requested, false);
assert.equal(nativeActivationView.world_truth_judgment_requested, false);
assert.equal(nativeActivationView.engine_plan_refs_exposed, false);
assert.equal(JSON.stringify(nativeActivationView).includes(ref), false);
assert.equal(nativeActivationView.plans[0].if_cue.label, "companion_is_threatened");
const admittedNativeActivation =
  resolveWorldSimulationNativeImplementationIntentionActivationIntent({
    resolver_view: resolverView,
    brain_result: {
      plan_activation_context_token: nativeActivationView.context_token,
      activated_plan_tokens: [nativeActivationView.plans[0].plan_token],
    },
  });
assert.deepEqual(admittedNativeActivation.activated_plan_refs, [ref]);
assert.equal(admittedNativeActivation.durable_write_performed, false);
assert.equal(admittedNativeActivation.action_selection_authority, false);
assert.equal(
  resolveWorldSimulationNativeImplementationIntentionActivationIntent({
    resolver_view: resolverView,
    brain_result: "reject_all",
  }).explicit_activation_intent_present,
  false,
);
assert.throws(() =>
  resolveWorldSimulationNativeImplementationIntentionActivationIntent({
    resolver_view: resolverView,
    brain_result: {
      plan_activation_context_token: "forged",
      activated_plan_tokens: [nativeActivationView.plans[0].plan_token],
    },
  }), (error) =>
  error?.code === "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_CONTEXT_MISMATCH");
assert.throws(() =>
  resolveWorldSimulationNativeImplementationIntentionActivationIntent({
    resolver_view: resolverView,
    brain_result: {
      plan_activation_context_token: nativeActivationView.context_token,
      activated_plan_tokens: ["plan_unknown"],
    },
  }), (error) =>
  error?.code === "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_TOKEN_INVALID");
assert.throws(() =>
  resolveWorldSimulationNativeImplementationIntentionActivationIntent({
    resolver_view: resolverView,
    brain_result: {
      plan_activation_context_token: nativeActivationView.context_token,
      activated_plan_tokens: [
        nativeActivationView.plans[0].plan_token,
        nativeActivationView.plans[0].plan_token,
      ],
    },
  }), (error) =>
  error?.code === "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_DUPLICATE_TOKEN");

const activation = projectWorldSimulationGoalImplementationIntentionActivation({
  resolver_view: resolverView,
  activated_plan_refs: [ref],
});
assert.equal(activation.activated_plan_count, 1);
assert.equal(activation.implementation_intention_guidance[0].cue_applicable, true);
assert.equal(activation.implementation_intention_guidance[0].advisory_only, true);
assert.equal(activation.implementation_intention_guidance[0].selected_action_authority, false);
assert.equal(activation.implementation_intention_guidance[0].executable_action_id, null);
assert.equal(Object.hasOwn(activation.implementation_intention_guidance[0], "plan_ref"), false);
assert.equal(activation.action_selection_authority_claimed, false);
assert.equal(activation.causal_outcome_authority_claimed, false);

const none = projectWorldSimulationGoalImplementationIntentionActivation({
  resolver_view: resolverView,
  activated_plan_refs: [],
});
assert.equal(none.activated_plan_count, 0);
assert.deepEqual(none.implementation_intention_guidance, []);

assert.throws(
  () => projectWorldSimulationGoalImplementationIntentionActivation({
    resolver_view: resolverView,
    activated_plan_refs: [ref, ref],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_DUPLICATE_REF",
);
assert.throws(
  () => projectWorldSimulationGoalImplementationIntentionActivation({
    resolver_view: resolverView,
    activated_plan_refs: ["phase69c_plan_unknown"],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_UNKNOWN_REF",
);

const sameTurnWorld = clone(world);
sameTurnWorld.goal_implementation_intention_revision_history.at(-1).source_turn_id = "world_turn_phase69c_same_turn";
const sameTurnEventId = sameTurnWorld.goal_implementation_intention_revision_history.at(-1).revision_event_id;
sameTurnWorld.goal_implementation_intention_revision_events[sameTurnEventId].source_turn_id = "world_turn_phase69c_same_turn";
const revisedBody = clone(sameTurnWorld.goal_implementation_intention_revision_events[sameTurnEventId]);
delete revisedBody.revision_event_hash;
const revisedHash = hashAgentRunValue(revisedBody);
sameTurnWorld.goal_implementation_intention_revision_events[sameTurnEventId].revision_event_hash = revisedHash;
sameTurnWorld.goal_implementation_intention_revision_history.at(-1).revision_event_hash = revisedHash;
assert.throws(
  () => buildWorldSimulationGoalImplementationIntentionActivationResolverView({
    world_state: sameTurnWorld,
    character: elias,
    current_turn_id: "world_turn_phase69c_same_turn",
    current_context: {},
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_SAME_TURN_CONTAMINATION",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canonical prepare-path regression: with no legacy Phase69C resolver, the
// same Character Runtime performs a bounded cue-applicability cognition pass.
// Its admitted guidance reaches Action Proposer cognition without creating an
// action, mutating World, or exposing Phase69C engine plan refs.
const fixtureRoot = path.resolve(
  __dirname,
  "../.tmp",
  `cbc3-native-phase69c-${process.pid}-${Date.now()}`,
);
fs.rmSync(fixtureRoot, { recursive: true, force: true });
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CB-C3 native Phase69C cue activation",
    seed: "cbc3-native-phase69c",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: {
      ...clone(world),
      simulation_time: "2026-09-26T00:00:00.000Z",
      event_queue: [{
        event_id: "cbc3-phase69c-native-event",
        type: "observation",
        scene_id: "room",
        participants: [elias],
        summary: "A companion is under pressure.",
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-26T00:00:00.000Z",
          dimensions: { width_m: 6, depth_m: 6 },
          entity_positions: { [elias]: { x: 1, y: 1 } },
          observable_by: { [elias]: { visual: [], audible: [] } },
        },
      },
      characters: {
        [elias]: { known: [], uncertain: [], current_goal: "保護同伴" },
      },
      available_actions: { [elias]: [] },
    },
  }, { fixtureRoot });
  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: "character_elias",
      canonical_name: character,
      formal: true,
      identity_source: "cbc3_phase69c_native_test",
    }),
  });
  let nativeActivationBrainCalls = 0;
  const prepared = await prepareWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "cbc3-phase69c-native-event",
  }, {
    fixtureRoot,
    characterRuntimeManager: runtimeManager,
    characterBrainNativeCapabilities: [
      nativeImplementationIntentionActivationCapability,
    ],
    characterBrain: async (packet) => {
      nativeActivationBrainCalls += 1;
      const view = packet?.cognition?.implementation_intention_activation;
      assert.ok(view);
      assert.equal(view.plans.length, 1);
      assert.equal(view.engine_plan_refs_exposed, false);
      assert.equal(packet.boundaries.action_selection_authority, false);
      assert.equal(JSON.stringify(view).includes(ref), false);
      return {
        plan_activation_context_token: view.context_token,
        activated_plan_tokens: [view.plans[0].plan_token],
      };
    },
  });
  assert.equal(nativeActivationBrainCalls, 1);
  assert.equal(prepared.decision_packets.length, 1);
  const nativeGuidance =
    prepared.decision_packets[0].cognition.implementation_intention_guidance;
  assert.equal(nativeGuidance.implementation_intentions.length, 1);
  assert.equal(nativeGuidance.advisory_only, true);
  assert.equal(nativeGuidance.selected_action_authority, false);
  assert.equal(
    nativeGuidance.implementation_intentions[0].then_response.label,
    "coordinate_with_nearby_ally",
  );
  assert.equal(
    Object.hasOwn(nativeGuidance.implementation_intentions[0], "plan_ref"),
    false,
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
assert.match(loopSource, /implementationIntentionCueActivationResolver/);
assert.match(loopSource, /characterCognition\.implementation_intention_guidance\s*=/);
const guidanceIndex = loopSource.indexOf("characterCognition.implementation_intention_guidance =");
const proposerIndex = loopSource.indexOf('"world_action_proposer"', guidanceIndex);
assert.ok(guidanceIndex >= 0 && proposerIndex > guidanceIndex, "Phase69C guidance must be built before Action Proposer.");
assert.doesNotMatch(loopSource.slice(guidanceIndex, proposerIndex), /submit_world_character_action|executeWorldSimulationChronologicalMutationQueue/);

const replayA = projectWorldSimulationGoalImplementationIntentionActivation({ resolver_view: resolverView, activated_plan_refs: [ref] });
const replayB = projectWorldSimulationGoalImplementationIntentionActivation({ resolver_view: clone(resolverView), activated_plan_refs: [ref] });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(Object.hasOwn(world, "phase69c_activation_events"), false);

console.log("Phase69C plan-cue activation / action-proposal guidance tests passed.");
