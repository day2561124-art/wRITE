import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  getAgentRun,
} from "../../server/src/agent-run-service.mjs";
import {
  compileWorldSimulationCapabilityEnvelope,
  verifyWorldSimulationCapabilityAdapterEnvelope,
  worldSimulationCapabilityAssuranceModes,
} from "../../server/src/world-simulation-capability-envelope-service.mjs";
import {
  invokeSharedNeuralCoreAdapter,
  neuralSessionModes,
} from "../../server/src/shared-neural-core-service.mjs";
import {
  buildWorldSimulationEngineIntegrityRuntimeContract,
  worldSimulationEngineIntegrityRuntimeVersion,
} from "../../server/src/world-simulation-engine-integrity-capability-runtime-service.mjs";
import {
  runWorldSimulationNativeCapability,
} from "../../server/src/world-simulation-neural-service.mjs";
import {
  prepareWorldSimulationTurn,
  resolveWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62a-r1-engine-integrity-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

await rm(fixtureRoot, { recursive: true, force: true });

const character = "伊萊亞斯・諾爾";
const initialWorldState = {
  simulation_time: "2026-08-25T06:00:00+08:00",
  event_queue: [{
    event_id: "evt-r1-step3",
    type: "observation",
    scene_id: "lab-r1-step3",
    participants: [character],
    summary: "R1 Step 3 engine-integrity fixture",
  }],
  scenes: {
    "lab-r1-step3": {
      scene_id: "lab-r1-step3",
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: {
        [character]: { x: 2, y: 2 },
      },
      public_visual: ["地面有白線"],
      observable_by: {
        [character]: {
          visual: ["前方沒有障礙物"],
          audible: [],
        },
      },
    },
  },
  characters: {
    [character]: {
      known: ["正在等待"],
      current_goal: "等待下一步",
      current_action: "站在原地",
    },
  },
  memories: {
    [character]: [],
  },
  available_actions: {
    [character]: [{
      action_id: "wait",
      intent: "留在原地等待",
    }],
  },
};

try {
  const contract = buildWorldSimulationEngineIntegrityRuntimeContract();
  assert.equal(
    contract.version,
    worldSimulationEngineIntegrityRuntimeVersion,
  );
  assert.deepEqual(
    new Set(contract.capabilities),
    new Set([
      "world_scene_causal_analyzer",
      "world_agency_guard",
      "world_consistency_critic",
    ]),
  );
  assert.equal(contract.scene_neural_advisory_is_causal_input, false);
  assert.equal(contract.consistency_neural_advisory_is_commit_gate, false);
  assert.equal(contract.agency_neural_advisory_is_security_policy, false);
  assert.equal(contract.adapter_receives_detached_envelope_copy, true);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62A-R1 Step 3 fixture",
    seed: "phase62a-r1-step3",
    rules: { world_first: true },
    initial_world_state: initialWorldState,
  }, options);
  const sessionId = session.world_simulation_session_id;

  let sceneAdapterSawEnvelope = false;
  const scene = await useWorldSimulationCapability(
    "world_scene_causal_analyzer",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        scene_state: initialWorldState.scenes["lab-r1-step3"],
        simulation_time: initialWorldState.simulation_time,
        simultaneous_actions: [],
      },
    },
    {
      ...options,
      adapter: async (envelope) => {
        sceneAdapterSawEnvelope = true;
        assert.match(envelope.schema_version, /^phase62a-r1-/u);
        assert.equal(envelope.capability_name, "world_scene_causal_analyzer");

        // The adapter receives a detached copy. Mutating it must not
        // mutate the canonical engine envelope or trusted result.
        envelope.authorized_inputs.protected_base.spatial_state = {
          malicious_rewrite: true,
        };
        envelope.capability_name = "world_consistency_critic";

        return {
          interpretive_annotations: [{
            annotation: "場景資料可以做額外語義檢查",
            related_entities: [character],
            uncertainty_note: "僅 advisory",
          }],
        };
      },
    },
  );
  assert.equal(sceneAdapterSawEnvelope, true);
  assert.equal(
    scene.output.spatial_state.malicious_rewrite,
    undefined,
    "Adapter mutation must not rewrite trusted scene analysis.",
  );
  assert.equal(
    scene.output.trusted_execution_view.spatial_state.malicious_rewrite,
    undefined,
  );
  assert.equal(
    Array.isArray(scene.output.neural_advisory.interpretive_annotations),
    true,
  );
  assert.equal(
    scene.output.r1_engine_integrity.neural_advisory_is_authoritative,
    false,
  );

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_scene_causal_analyzer",
      {
        world_simulation_session_id: sessionId,
        capability_input: {
          scene_state: initialWorldState.scenes["lab-r1-step3"],
          simultaneous_actions: [],
        },
      },
      {
        ...options,
        adapter: async () => ({
          advisory_findings: [{
            advisory_type: "bad_authority_masquerade",
            message: "pretend authority",
            winner: character,
          }],
        }),
      },
    ),
    (error) => (
      error?.code
        === "WORLD_SIMULATION_CAPABILITY_NEURAL_ADVISORY_AUTHORITY_FORBIDDEN"
      || /advisory.*authority/iu.test(error?.message ?? "")
    ),
  );

  const consistency = await useWorldSimulationCapability(
    "world_consistency_critic",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        state_transitions: [{
          entity: character,
          field: "location",
          from: "A",
          to: "B",
        }],
        object_holders: [],
        knowledge_transitions: [],
        action_outcomes: [],
      },
    },
    {
      ...options,
      adapter: async () => ({
        advisory_findings: [{
          advisory_type: "semantic_review",
          message: "可以再人工檢查這個轉場是否缺少上下文。",
          related_entities: [character],
          related_fields: ["location"],
          review_recommended: true,
        }],
      }),
    },
  );
  assert.equal(consistency.output.hard_conflict_count, 1);
  assert.equal(consistency.output.commit_gate_view.hard_conflict_count, 1);
  assert.equal(consistency.output.findings.length, 1);
  assert.equal(consistency.output.neural_advisory.advisory_findings.length, 1);

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_consistency_critic",
      {
        world_simulation_session_id: sessionId,
        capability_input: {
          state_transitions: [{
            entity: character,
            field: "location",
            from: "A",
            to: "B",
          }],
        },
      },
      {
        ...options,
        adapter: async () => ({
          hard_conflict_count: 0,
        }),
      },
    ),
    (error) => (
      error?.code
        === "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN"
    ),
  );

  const nativeConsistency = await runWorldSimulationNativeCapability(
    "world_consistency_critic",
    {
      state_transitions: [{
        entity: character,
        field: "location",
        from: "A",
        to: "B",
      }],
    },
    {
      ...options,
      run_id: sessionId,
      adapter: async () => ({
        advisory_findings: [{
          advisory_type: "invalid",
          message: "try to impersonate hard authority",
          must_fix: false,
        }],
      }),
    },
  );
  assert.equal(nativeConsistency.output.hard_conflict_count, 1);
  assert.equal(
    nativeConsistency.output.commit_gate_view.hard_conflict_count,
    1,
  );
  assert.equal(
    nativeConsistency.output.r1_engine_integrity.fallback_to_trusted_base,
    true,
  );
  assert.equal(
    nativeConsistency.output.neural_advisory,
    undefined,
  );

  const agency = await useWorldSimulationCapability(
    "world_agency_guard",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character,
        decision_request: {
          dramatic_priority: "讓這一幕更刺激",
        },
      },
    },
    {
      ...options,
      adapter: async () => ({
        advisory_findings: [{
          advisory_type: "semantic_control_signal",
          message: "這個要求帶有戲劇性控制傾向。",
          related_entities: [character],
          review_recommended: true,
        }],
      }),
    },
  );
  assert.equal(agency.output.findings.length, 1);
  assert.equal(
    agency.output.findings[0].must_ignore_for_character_choice,
    true,
  );
  assert.equal(agency.output.policy_diagnostic_view.findings.length, 1);
  assert.equal(
    agency.output.r1_engine_integrity.agency_neural_advisory_is_security_policy,
    false,
  );

  const compiled = compileWorldSimulationCapabilityEnvelope({
    capability_name: "world_scene_causal_analyzer",
    invocation_id: "step3-integrity-test",
    subject: null,
    protected_base: {
      scene_identity: { scene_id: "lab-r1-step3" },
      spatial_state: {},
      interaction_constraints: [],
      simultaneous_actions: [],
      adjudication_inputs: [],
    },
    source_channels: [],
  }, {
    assurance_mode:
      worldSimulationCapabilityAssuranceModes.DIRECT_CALLER_ASSERTED,
  });

  const validVerification =
    verifyWorldSimulationCapabilityAdapterEnvelope(
      compiled.adapter_envelope,
      {
        capability_name: "world_scene_causal_analyzer",
        require_compiler_attestation: true,
      },
    );
  assert.equal(validVerification.ok, true);

  const tampered = structuredClone(compiled.adapter_envelope);
  tampered.purpose = "tampered-purpose";
  assert.throws(
    () => verifyWorldSimulationCapabilityAdapterEnvelope(
      tampered,
      { capability_name: "world_scene_causal_analyzer" },
    ),
    (error) => (
      error?.code
        === "WORLD_SIMULATION_CAPABILITY_ENVELOPE_INTEGRITY_INVALID"
    ),
  );

  assert.throws(
    () => verifyWorldSimulationCapabilityAdapterEnvelope(
      compiled.adapter_envelope,
      { capability_name: "world_consistency_critic" },
    ),
    (error) => (
      error?.code
        === "WORLD_SIMULATION_CAPABILITY_ENVELOPE_BINDING_INVALID"
    ),
  );

  const detachedValidCopy = structuredClone(compiled.adapter_envelope);
  assert.throws(
    () => verifyWorldSimulationCapabilityAdapterEnvelope(
      detachedValidCopy,
      {
        capability_name: "world_scene_causal_analyzer",
        require_compiler_attestation: true,
      },
    ),
    (error) => (
      error?.code
        === "WORLD_SIMULATION_CAPABILITY_ENVELOPE_ATTESTATION_REQUIRED"
    ),
  );

  const run = await getAgentRun(sessionId, options);
  await assert.rejects(
    () => invokeSharedNeuralCoreAdapter({
      run,
      session_mode: neuralSessionModes.WORLD_SIMULATION,
      capability_name: "world_consistency_critic",
      input: {
        state_transitions: [],
      },
      adapter: async () => ({
        advisory_findings: [],
      }),
    }),
    (error) => (
      error?.code === "WORLD_SIMULATION_CAPABILITY_ENVELOPE_REQUIRED"
    ),
    "Raw world input must not bypass the R1 mediation boundary.",
  );

  const prepared = await prepareWorldSimulationTurn(
    {
      world_simulation_session_id: sessionId,
      event_id: "evt-r1-step3",
    },
    options,
  );
  assert.ok(prepared.scene_analysis.trusted_execution_view);

  prepared.scene_analysis.neural_advisory = {
    interpretive_annotations: [{
      annotation: "NEURAL_SCENE_ADVISORY_SENTINEL",
    }],
  };

  await assert.rejects(
    () => resolveWorldSimulationTurn(
      prepared,
      {
        [character]: { action_id: "wait" },
      },
      {
        ...options,
        causalAdjudicator: async (input) => {
          assert.equal(
            JSON.stringify(input.scene_analysis)
              .includes("NEURAL_SCENE_ADVISORY_SENTINEL"),
            false,
            "Neural scene advisory must not enter causal adjudication.",
          );
          const expected = new Error("EXPECTED_STEP3_TEST_STOP");
          expected.code = "EXPECTED_STEP3_TEST_STOP";
          throw expected;
        },
      },
    ),
    (error) => error?.code === "EXPECTED_STEP3_TEST_STOP",
  );

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R1 Step 3",
    runtime_version: worldSimulationEngineIntegrityRuntimeVersion,
    scene_advisory_causal_authority: false,
    consistency_advisory_commit_authority: false,
    agency_advisory_security_authority: false,
    advisory_vocabulary_sealed: true,
    canonical_envelope_hash_verified: true,
    compiler_attestation_verified: true,
    adapter_envelope_detached: true,
    shared_core_complete_mediation_verified: true,
    native_invalid_advisory_falls_back: true,
  }));
  console.log(
    "Phase62A-R1 Step 3 engine-integrity runtime test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
