import assert from "node:assert/strict";
import {
  buildWorldSimulationBodyAuthorityContract,
  projectWorldSimulationBodyAuthority,
} from "../server/src/world-simulation-body-authority-service.mjs";
import {
  assertWorldSimulationBodyToBrainSensoryEvidence,
  buildWorldSimulationBodyBrainContract,
  buildWorldSimulationBodyToBrainSensoryEvidence,
  buildWorldSimulationBrainToBodyMotorCommand,
  worldSimulationBodyBrainContractVersion,
} from "../server/src/world-simulation-body-brain-contract-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../server/src/world-simulation-character-brain-input-service.mjs";

const world = {
  characters: {
    aria: {
      physical_state: {
        health_current: 63,
        injuries: [{
          region: "left_arm",
          severity: "severe",
          diagnosis: "fracture",
          source_action_id: "strike-private",
        }],
        movement_multiplier: 0.4,
        immobilized: true,
        pain: "severe",
      },
    },
  },
  scenes: { yard: { entity_positions: { aria: { x: 7, y: 9 } } } },
};

const body = projectWorldSimulationBodyAuthority({
  world_state: world,
  scene_id: "yard",
  character: "aria",
});
const evidence = buildWorldSimulationBodyToBrainSensoryEvidence({
  body_authority_projection: body,
});
assert.equal(evidence.version, worldSimulationBodyBrainContractVersion);
assert.equal(evidence.direction, "body_to_brain");
assert.equal(evidence.character, "aria");
assert.equal(evidence.signals.proprioception.availability, "position_signal_available");
assert.equal(evidence.signals.nociception.status, "injury_signal_possible");
assert.equal(evidence.signals.movement_constraint.status, "movement_restricted");
assert.deepEqual(evidence.signals.interoception.signals, []);
for (const prohibited of [
  "63", "severe", "fracture", "left_arm", "strike-private", "\"x\":7", "\"y\":9",
]) {
  assert.equal(JSON.stringify(evidence).includes(prohibited), false);
}
assert.deepEqual(
  assertWorldSimulationBodyToBrainSensoryEvidence(evidence, { character: "aria" }),
  evidence,
);
assert.throws(() => assertWorldSimulationBodyToBrainSensoryEvidence(
  evidence,
  { character: "bystander" },
), { code: "BODY0C_BODY_TO_BRAIN_CHARACTER_MISMATCH" });

const selected = {
  character: "aria",
  selection: "candidate_action_intent",
  action_id: "walk-yard",
  candidate: {
    action_id: "walk-yard",
    movement: { destination: { x: 12, y: 9 } },
    objective_feasibility: "guaranteed",
    result: "movement_completed",
  },
};
const command = buildWorldSimulationBrainToBodyMotorCommand({
  character: "aria",
  selected_action_intent: selected,
});
assert.equal(command.command_status, "motor_command_requested");
assert.equal(command.action_id, "walk-yard");
assert.deepEqual(command.command_request, {
  kind: "selected_action_motor_intention",
  action_id: "walk-yard",
});
assert.equal(command.boundaries.execution_asserted, false);
assert.equal(command.boundaries.completed_movement_asserted, false);
assert.equal(JSON.stringify(command).includes("guaranteed"), false);
assert.equal(JSON.stringify(command).includes("movement_completed"), false);
const nonMotor = buildWorldSimulationBrainToBodyMotorCommand({
  character: "aria",
  selected_action_intent: {
    character: "aria",
    selection: "candidate_action_intent",
    action_id: "wait-and-think",
    candidate: { action_id: "wait-and-think", kind: "cognitive" },
  },
});
assert.equal(nonMotor.command_status, "no_motor_command_for_non_motor_intent");
assert.equal(nonMotor.action_id, "wait-and-think");
assert.equal(nonMotor.command_request, null);
const rejected = buildWorldSimulationBrainToBodyMotorCommand({
  character: "aria",
  selected_action_intent: { character: "aria", selection: "reject_all" },
});
assert.equal(rejected.command_status, "no_motor_command");
assert.equal(rejected.command_request, null);
assert.throws(() => buildWorldSimulationBrainToBodyMotorCommand({
  character: "aria",
  selected_action_intent: {
    character: "other",
    selection: "candidate_action_intent",
    action_id: "x",
    candidate: { action_id: "x", kind: "movement" },
  },
}), { code: "BODY0C_MOTOR_COMMAND_CHARACTER_MISMATCH" });
assert.throws(() => buildWorldSimulationBrainToBodyMotorCommand({
  character: "aria",
  selected_action_intent: {
    character: "aria",
    selection: "selected",
    action_id: "walk-yard",
    candidate: { action_id: "walk-yard", kind: "movement" },
  },
}), { code: "BODY0C_MOTOR_COMMAND_SELECTION_INVALID" });
assert.throws(() => buildWorldSimulationBrainToBodyMotorCommand({
  character: "aria",
  selected_action_intent: {
    character: "aria",
    selection: "candidate_action_intent",
    action_id: "walk-yard",
    candidate: { action_id: "different-action", kind: "movement" },
  },
}), { code: "BODY0C_MOTOR_COMMAND_ACTION_LINEAGE_MISMATCH" });

const brainInput = buildWorldSimulationCharacterBrainInput({
  character: "aria",
  perception: {},
  cognition: {},
  candidate_action_intents: [],
  boundaries: {},
}, { body_sensory_evidence: evidence });
assert.deepEqual(brainInput.body_sensory_evidence, evidence);
assert.equal(brainInput.boundaries.body_sensory_evidence_v1_installed, true);
assert.equal(brainInput.boundaries.body_sensory_evidence_objective_truth_exposed, false);
assert.throws(() => buildWorldSimulationCharacterBrainInput({
  character: "other",
  perception: {},
  cognition: {},
  candidate_action_intents: [],
  boundaries: {},
}, { body_sensory_evidence: evidence }), {
  code: "BODY0C_BODY_TO_BRAIN_CHARACTER_MISMATCH",
});

const contract = buildWorldSimulationBodyBrainContract();
assert.equal(contract.body_to_brain.evidence_is_signal_not_diagnosis, true);
assert.equal(contract.brain_to_body.command_is_intention_not_execution, true);
assert.equal(contract.brain_to_body.effectors_deferred_to_body1, true);
assert.equal(buildWorldSimulationBodyAuthorityContract().motor_intention_is_completed_movement, false);

console.log("BODY-0C Brain↔Body command/sensory evidence contract tests passed.");
