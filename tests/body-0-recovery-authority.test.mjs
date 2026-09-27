import assert from "node:assert/strict";
import {
  buildWorldSimulationBodyAuthorityContract,
  projectWorldSimulationBodyAuthority,
} from "../server/src/world-simulation-body-authority-service.mjs";
import {
  assertWorldSimulationBasicRecoveryAuthority,
  buildWorldSimulationBasicRecoveryAuthorityContract,
  projectWorldSimulationBasicRecoveryAuthority,
  worldSimulationBodyRecoveryAuthorityVersion,
} from "../server/src/world-simulation-body-recovery-authority-service.mjs";

const injuredPhysical = {
  health_current: 62,
  health_max: 100,
  injuries: [
    {
      injury_id: "injury_arm_1",
      region: "left_arm",
      severity: "severe",
      diagnosis: "fracture",
      damage: 38,
    },
  ],
  recovery_rate: 999,
};

const recovery = projectWorldSimulationBasicRecoveryAuthority({
  physical_state: injuredPhysical,
});
assert.equal(recovery.version, worldSimulationBodyRecoveryAuthorityVersion);
assert.equal(recovery.status, "recovery_required");
assert.equal(recovery.recovery_required, true);
assert.equal(recovery.repair_targets.length, 1);
assert.deepEqual(recovery.repair_targets[0], {
  injury_id: "injury_arm_1",
  ordinal: 0,
  region: "left_arm",
  severity: "severe",
  status: "unresolved_repair_target",
});
assert.equal(recovery.evidence.health_deficit_known, true);
assert.equal(recovery.boundaries.fixed_hp_regeneration_allowed, false);
assert.equal(recovery.boundaries.automatic_injury_removal_allowed, false);
assert.equal(recovery.boundaries.elapsed_time_alone_causes_recovery, false);
assert.equal(recovery.boundaries.single_recovery_rate_authoritative, false);
assert.equal(JSON.stringify(recovery).includes("999"), false);
assert.equal(JSON.stringify(recovery).includes("fracture"), false);
assert.deepEqual(assertWorldSimulationBasicRecoveryAuthority(recovery), recovery);

const noRecordedNeed = projectWorldSimulationBasicRecoveryAuthority({
  physical_state: {
    health_current: 100,
    health_max: 100,
    injuries: [],
  },
});
assert.equal(noRecordedNeed.status, "no_recorded_recovery_need");
assert.equal(noRecordedNeed.recovery_required, false);

const unknownMax = projectWorldSimulationBasicRecoveryAuthority({
  physical_state: {
    health_current: 62,
    injuries: [],
  },
});
assert.equal(unknownMax.status, "no_recorded_recovery_need");
assert.equal(unknownMax.evidence.health_max_known, false);
assert.equal(unknownMax.evidence.health_deficit_known, false);

const world = {
  characters: {
    aria: { physical_state: injuredPhysical },
  },
  scenes: {
    yard: { entity_positions: { aria: { x: 1, y: 2 } } },
  },
};
const body = projectWorldSimulationBodyAuthority({
  world_state: world,
  scene_id: "yard",
  character: "aria",
});
assert.equal(body.objective_body_state.health_max, 100);
assert.deepEqual(body.objective_body_state.recovery_state, recovery);
assert.equal(Object.hasOwn(body.brain_evidence, "recovery_state"), false);
assert.equal(JSON.stringify(body.brain_evidence).includes("fracture"), false);
assert.equal(JSON.stringify(body.brain_evidence).includes("severe"), false);

const contract = buildWorldSimulationBasicRecoveryAuthorityContract();
assert.equal(contract.fixed_hp_regeneration_prohibited, true);
assert.equal(contract.elapsed_time_is_not_sufficient_recovery_cause, true);
assert.equal(contract.full_tissue_repair_physiology_deferred_to_body_core, true);

const bodyContract = buildWorldSimulationBodyAuthorityContract();
assert.equal(bodyContract.basic_recovery_authority_installed, true);
assert.equal(bodyContract.fixed_hp_regeneration_prohibited, true);
assert.equal(bodyContract.elapsed_time_alone_causes_recovery, false);
assert.equal(bodyContract.body0_authority_gate_closed, true);

console.log("BODY-0D basic recovery authority / BODY-0 gate tests passed.");
