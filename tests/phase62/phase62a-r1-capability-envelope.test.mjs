import assert from "node:assert/strict";

import {
  buildWorldSimulationCapabilityEnvelopeContract,
  buildWorldSimulationCapabilityPolicyRegistry,
  compileWorldSimulationCapabilityEnvelope,
  materializeWorldSimulationCapabilitySourceRefs,
  resolveWorldSimulationCapabilityNeuralExtension,
  validateWorldSimulationCapabilityNeuralExtension,
  worldSimulationCapabilityAssuranceModes,
  worldSimulationCapabilityEnvelopeVersion,
  worldSimulationCapabilityPolicyVersion,
} from "../../server/src/world-simulation-capability-envelope-service.mjs";

const nativeExecution = {
  assurance_mode:
    worldSimulationCapabilityAssuranceModes.NATIVE_ENGINE_VERIFIED,
};
const directExecution = {
  assurance_mode:
    worldSimulationCapabilityAssuranceModes.DIRECT_CALLER_ASSERTED,
};

const registry = buildWorldSimulationCapabilityPolicyRegistry();
assert.equal(registry.registry_version, worldSimulationCapabilityPolicyVersion);
assert.equal(registry.envelope_version, worldSimulationCapabilityEnvelopeVersion);
assert.equal(Object.keys(registry.capabilities).length, 7);
assert.equal(
  registry.capabilities.world_character_cognition.trust_domain,
  "character_facing",
);
assert.equal(
  registry.capabilities.world_consistency_critic.output_pattern,
  "programmatic_hard_findings_plus_advisory_extension",
);

const contract = buildWorldSimulationCapabilityEnvelopeContract();
assert.equal(contract.disclosure_and_authority_are_separate, true);
assert.equal(contract.adapter_can_read_protected_base_but_cannot_rewrite_it, true);
assert.equal(contract.engine_exact_simulation_time_is_not_character_knowledge, true);
assert.equal(contract.engine_scene_id_is_not_character_knowledge, true);

assert.throws(
  () => compileWorldSimulationCapabilityEnvelope({
    capability_name: "not_registered",
    invocation_id: "inv_unknown",
  }, nativeExecution),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_POLICY_NOT_FOUND",
);

assert.throws(
  () => compileWorldSimulationCapabilityEnvelope({
    capability_name: "world_character_cognition",
    invocation_id: "inv_missing_subject",
    protected_base: {},
  }, nativeExecution),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_SUBJECT_REQUIRED",
);

assert.throws(
  () => compileWorldSimulationCapabilityEnvelope({
    capability_name: "world_character_cognition",
    invocation_id: "inv_self_promote",
    assurance_mode: "native_engine_verified",
    subject: { character: "伊萊亞斯・諾爾" },
  }, directExecution),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_ASSURANCE_ESCALATION_FORBIDDEN",
);

for (const forbiddenProtectedBase of [
  { world_state: { secret: true } },
  { scene_state: { hidden: true } },
  { character_state: { engine_internal: true } },
  { simulation_time: "2026-08-25T05:00:00+08:00" },
  { scene_id: "internal_scene_03" },
]) {
  assert.throws(
    () => compileWorldSimulationCapabilityEnvelope({
      capability_name: "world_character_cognition",
      invocation_id: `inv_forbidden_${Object.keys(forbiddenProtectedBase)[0]}`,
      subject: { character: "伊萊亞斯・諾爾" },
      protected_base: forbiddenProtectedBase,
    }, nativeExecution),
    (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_SOURCE_DISCLOSURE_FORBIDDEN",
  );
}

assert.throws(
  () => compileWorldSimulationCapabilityEnvelope({
    capability_name: "world_perception_filter",
    invocation_id: "inv_engine_only_source",
    subject: { character: "伊萊亞斯・諾爾" },
    protected_base: {},
    source_channels: [{
      source_ref: "engine_secret_obs",
      channel: "visual",
      claim_domain: "perception",
      assurance_origin: "programmatic_derived",
      audience: ["engine"],
      payload: { content: "門後有人" },
    }],
  }, nativeExecution),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_SOURCE_DISCLOSURE_FORBIDDEN",
);

const cognitionInput = {
  capability_name: "world_character_cognition",
  invocation_id: "world_turn_001:伊萊亞斯:character_cognition",
  subject: { character: "伊萊亞斯・諾爾" },
  protected_base: {
    character: "伊萊亞斯・諾爾",
    perception: {
      observed: ["桌上的水瓶"],
      audible: [],
      other_senses: [],
    },
    recovered_memories: [{ memory_id: "m1", content: "明早七點集合" }],
    known: ["自己現在在宿舍"],
    uncertain: [],
    needs: { fatigue: 0.5 },
    emotion: "平靜",
    attention: ["水瓶"],
    goals: ["準時集合"],
    values: {},
    relationship_cognition: {},
    current_action: "整理背包",
  },
  source_channels: [{
    source_ref: "recovered_memory:m1",
    channel: "recovered_memory",
    claim_domain: "memory_recovery",
    assurance_origin: "programmatic_derived",
    audience: ["engine", "character:伊萊亞斯・諾爾"],
    producer: "phase63c-memory-retrieval-process-v3",
    payload: {
      memory_id: "m1",
      content: "明早七點集合",
    },
  }],
};

const compiledA = compileWorldSimulationCapabilityEnvelope(
  cognitionInput,
  nativeExecution,
);
const compiledB = compileWorldSimulationCapabilityEnvelope(
  cognitionInput,
  nativeExecution,
);
assert.deepEqual(compiledA, compiledB);
assert.equal(compiledA.adapter_envelope.envelope_id, compiledB.adapter_envelope.envelope_id);
assert.equal(compiledA.adapter_envelope.envelope_hash, compiledB.adapter_envelope.envelope_hash);
assert.equal(
  Object.hasOwn(compiledA.adapter_envelope, "trusted_materialization_context"),
  false,
);
assert.equal(
  Object.hasOwn(compiledA.adapter_envelope.authorized_inputs.sources[0], "producer"),
  false,
);
assert.equal(
  compiledA.trusted_materialization_context.provenance_manifest[0].producer,
  "phase63c-memory-retrieval-process-v3",
);

const directCompiled = compileWorldSimulationCapabilityEnvelope(
  cognitionInput,
  directExecution,
);
assert.equal(
  directCompiled.trusted_materialization_context.provenance_manifest[0].assurance_origin,
  "caller_asserted",
  "Direct callers must not self-promote programmatic source claims to engine verification.",
);
assert.equal(
  directCompiled.trusted_materialization_context.provenance_manifest[0].claimed_assurance_origin,
  "programmatic_derived",
);

const validCognitionExtension = validateWorldSimulationCapabilityNeuralExtension(
  compiledA.adapter_envelope,
  {
    subjective_inferences: ["可能該先確認鬧鐘"],
    salience: ["集合時間"],
    deliberative_pressures: ["疲勞", "時間"],
    proposed_attention_shift: ["終端鬧鐘"],
  },
);
assert.equal(validCognitionExtension.ok, true);
assert.equal(validCognitionExtension.assurance_origin, "neural_derived");
assert.deepEqual(
  validCognitionExtension.intended_audience,
  ["engine", "character:伊萊亞斯・諾爾"],
);

assert.throws(
  () => validateWorldSimulationCapabilityNeuralExtension(
    compiledA.adapter_envelope,
    { known: ["測試已取消"] },
  ),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN",
);

assert.throws(
  () => validateWorldSimulationCapabilityNeuralExtension(
    compiledA.adapter_envelope,
    { audience: ["shared_public"] },
  ),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_ASSURANCE_ESCALATION_FORBIDDEN",
);

assert.throws(
  () => validateWorldSimulationCapabilityNeuralExtension(
    compiledA.adapter_envelope,
    { made_up_extension_field: true },
  ),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_NEURAL_OUTPUT_SCHEMA_INVALID",
);

const perceptionA = compileWorldSimulationCapabilityEnvelope({
  capability_name: "world_perception_filter",
  invocation_id: "world_turn_001:伊萊亞斯:perception",
  subject: { character: "伊萊亞斯・諾爾" },
  protected_base: {
    observed: [{ content: "牆上的鐘顯示 05:03" }],
    audible: [],
    other_senses: [],
  },
  source_channels: [{
    source_ref: "visual:clock:1",
    channel: "visual",
    claim_domain: "perception",
    assurance_origin: "programmatic_derived",
    audience: ["engine", "character:伊萊亞斯・諾爾"],
    producer: "phase62y-illumination-visibility",
    payload: { content: "牆上的鐘顯示 05:03" },
  }],
}, nativeExecution);

const perceptionB = compileWorldSimulationCapabilityEnvelope({
  capability_name: "world_perception_filter",
  invocation_id: "world_turn_001:璃央:perception",
  subject: { character: "柊木璃央" },
  protected_base: {
    observed: [{ content: "門口的指示燈" }],
    audible: [],
    other_senses: [],
  },
  source_channels: [{
    source_ref: "visual:door-light:1",
    channel: "visual",
    claim_domain: "perception",
    assurance_origin: "programmatic_derived",
    audience: ["engine", "character:柊木璃央"],
    producer: "phase62y-illumination-visibility",
    payload: { content: "門口的指示燈" },
  }],
}, nativeExecution);

const eliasRef = perceptionA.adapter_envelope.authorized_source_refs[0];
const liaoRef = perceptionB.adapter_envelope.authorized_source_refs[0];

const validPerceptionExtension = validateWorldSimulationCapabilityNeuralExtension(
  perceptionA.adapter_envelope,
  { attended_observation_refs: [eliasRef] },
);
assert.equal(validPerceptionExtension.ok, true);

assert.throws(
  () => validateWorldSimulationCapabilityNeuralExtension(
    perceptionA.adapter_envelope,
    { attended_observation_refs: ["not_a_scoped_ref"] },
  ),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_SOURCE_REF_UNKNOWN",
);

assert.throws(
  () => validateWorldSimulationCapabilityNeuralExtension(
    perceptionA.adapter_envelope,
    { attended_observation_refs: [liaoRef] },
  ),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_CROSS_ENVELOPE_REF_FORBIDDEN",
);

const materialized = materializeWorldSimulationCapabilitySourceRefs({
  envelope: perceptionA.adapter_envelope,
  trusted_materialization_context: perceptionA.trusted_materialization_context,
  source_refs: [eliasRef],
});
assert.equal(materialized.length, 1);
assert.equal(materialized[0].payload.content, "牆上的鐘顯示 05:03");
assert.equal(materialized[0].producer, "phase62y-illumination-visibility");

assert.throws(
  () => materializeWorldSimulationCapabilitySourceRefs({
    envelope: perceptionA.adapter_envelope,
    trusted_materialization_context: perceptionA.trusted_materialization_context,
    source_refs: [liaoRef],
  }),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_CROSS_ENVELOPE_REF_FORBIDDEN",
);

const consistency = compileWorldSimulationCapabilityEnvelope({
  capability_name: "world_consistency_critic",
  invocation_id: "world_turn_001:consistency",
  protected_base: {
    findings: [{ issue_type: "state_changed_without_recorded_cause", must_fix: true }],
    hard_conflict_count: 1,
    consistency_boundary: { programmatic_authority: true },
  },
  source_channels: [{
    source_ref: "consistency:hard:1",
    channel: "hard_finding",
    claim_domain: "diagnostic",
    assurance_origin: "programmatic_derived",
    audience: ["engine"],
    producer: "world_consistency_critic_programmatic_base",
    payload: { issue_type: "state_changed_without_recorded_cause" },
  }],
}, nativeExecution);

assert.throws(
  () => validateWorldSimulationCapabilityNeuralExtension(
    consistency.adapter_envelope,
    { hard_conflict_count: 0 },
  ),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN",
);

const nativeFallback = resolveWorldSimulationCapabilityNeuralExtension({
  envelope: compiledA.adapter_envelope,
  extension: { known: ["非法覆寫"] },
  failure_mode: "native_optional",
});
assert.equal(nativeFallback.accepted, false);
assert.equal(nativeFallback.fallback_to_trusted_base, true);
assert.equal(
  nativeFallback.violation.code,
  "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN",
);

assert.throws(
  () => resolveWorldSimulationCapabilityNeuralExtension({
    envelope: compiledA.adapter_envelope,
    extension: { known: ["非法覆寫"] },
    failure_mode: "direct_explicit",
  }),
  (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN",
);

console.log(JSON.stringify({
  phase: "Phase62A-R1 Step 1",
  capability_policy_version: worldSimulationCapabilityPolicyVersion,
  capability_envelope_version: worldSimulationCapabilityEnvelopeVersion,
  registered_capability_count: Object.keys(registry.capabilities).length,
  disclosure_and_authority_separated: true,
  character_subject_required: true,
  payload_assurance_self_promotion_rejected: true,
  direct_caller_engine_assurance_rejected: true,
  character_raw_world_state_rejected: true,
  character_raw_scene_state_rejected: true,
  full_character_state_rejected: true,
  engine_simulation_time_not_character_input: true,
  engine_scene_id_not_character_input: true,
  engine_provenance_not_adapter_visible: true,
  envelope_scoped_source_refs_verified: true,
  cross_envelope_refs_rejected: true,
  protected_base_override_rejected: true,
  neural_audience_authoring_rejected: true,
  neural_assurance_escalation_rejected: true,
  hard_consistency_findings_protected: true,
  deterministic_envelope_verified: true,
  native_optional_invalid_extension_falls_back: true,
  direct_explicit_invalid_extension_throws: true,
  runtime_adoption_installed: false,
}));
console.log("Phase62A-R1 Step 1 capability envelope test passed.");
