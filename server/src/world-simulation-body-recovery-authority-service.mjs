export const worldSimulationBodyRecoveryAuthorityVersion =
  "body-0d-basic-recovery-authority-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function recoveryTarget(injury, index) {
  const record = object(injury);
  return Object.freeze({
    injury_id: text(record.injury_id),
    ordinal: index,
    region: text(record.region),
    severity: text(record.severity) ?? finite(record.severity),
    status: "unresolved_repair_target",
  });
}

export function projectWorldSimulationBasicRecoveryAuthority({
  physical_state,
} = {}) {
  const physical = object(physical_state);
  const injuries = array(physical.injuries);
  const healthCurrent = finite(physical.health_current);
  const healthMax = finite(physical.health_max);
  const healthDeficitKnown =
    healthCurrent !== null
    && healthMax !== null
    && healthMax >= 0
    && healthCurrent < healthMax;
  const repairTargets = injuries.map(recoveryTarget);
  const recoveryRequired = repairTargets.length > 0 || healthDeficitKnown;

  return Object.freeze({
    version: worldSimulationBodyRecoveryAuthorityVersion,
    authority: "objective_body_recovery_lifecycle",
    status: recoveryRequired
      ? "recovery_required"
      : "no_recorded_recovery_need",
    recovery_required: recoveryRequired,
    repair_targets: Object.freeze(repairTargets),
    evidence: Object.freeze({
      recorded_injury_count: repairTargets.length,
      health_deficit_known: healthDeficitKnown,
      health_current_known: healthCurrent !== null,
      health_max_known: healthMax !== null,
    }),
    causal_inputs: Object.freeze({
      tissue_specific_repair: "deferred_to_body_core",
      blood_flow: "deferred_to_body_core",
      nutrition: "deferred_to_body_core",
      rest_and_sleep: "deferred_to_body_core",
      infection_and_inflammation: "deferred_to_body_core",
      age_and_individual_variation: "deferred_to_body_core",
    }),
    boundaries: Object.freeze({
      fixed_hp_regeneration_allowed: false,
      automatic_injury_removal_allowed: false,
      elapsed_time_alone_causes_recovery: false,
      single_recovery_rate_authoritative: false,
      recovery_completion_asserted: false,
      subjective_recovery_feeling_asserted: false,
      full_repair_physiology_deferred: true,
    }),
  });
}

export function assertWorldSimulationBasicRecoveryAuthority(value) {
  const recovery = object(value);
  const evidence = object(recovery.evidence);
  const boundaries = object(recovery.boundaries);
  if (recovery.version !== worldSimulationBodyRecoveryAuthorityVersion
      || recovery.authority !== "objective_body_recovery_lifecycle"
      || !["recovery_required", "no_recorded_recovery_need"].includes(recovery.status)
      || recovery.recovery_required !== (recovery.status === "recovery_required")
      || !Array.isArray(recovery.repair_targets)
      || typeof evidence.recorded_injury_count !== "number"
      || evidence.recorded_injury_count !== recovery.repair_targets.length
      || boundaries.fixed_hp_regeneration_allowed !== false
      || boundaries.automatic_injury_removal_allowed !== false
      || boundaries.elapsed_time_alone_causes_recovery !== false
      || boundaries.single_recovery_rate_authoritative !== false
      || boundaries.recovery_completion_asserted !== false
      || boundaries.subjective_recovery_feeling_asserted !== false
      || boundaries.full_repair_physiology_deferred !== true) {
    const error = new Error("BODY0D_RECOVERY_AUTHORITY_INVALID");
    error.code = "BODY0D_RECOVERY_AUTHORITY_INVALID";
    throw error;
  }
  return clone(recovery);
}

export function buildWorldSimulationBasicRecoveryAuthorityContract() {
  return Object.freeze({
    version: worldSimulationBodyRecoveryAuthorityVersion,
    phase: "BODY-0D",
    owner: "objective_body_authority",
    recovery_state_is_objective_body_state: true,
    recorded_injury_or_known_health_deficit_can_require_recovery: true,
    elapsed_time_is_not_sufficient_recovery_cause: true,
    fixed_hp_regeneration_prohibited: true,
    automatic_injury_removal_prohibited: true,
    single_recovery_rate_prohibited: true,
    subjective_recovery_interpretation_belongs_to_brain: true,
    full_tissue_repair_physiology_deferred_to_body_core: true,
  });
}
