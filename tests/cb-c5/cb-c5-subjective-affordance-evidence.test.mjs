import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog,
  buildWorldSimulationSubjectiveAffordanceEvidenceContract,
  worldSimulationSubjectiveAffordanceEvidenceVersion,
} from "../../server/src/world-simulation-subjective-affordance-evidence-service.mjs";

const contract = buildWorldSimulationSubjectiveAffordanceEvidenceContract();
assert.equal(contract.version, worldSimulationSubjectiveAffordanceEvidenceVersion);
assert.equal(contract.phase, "CB-C5-B");
assert.equal(contract.read_only_projection_only, true);
assert.equal(contract.same_character_packet_required, true);
assert.equal(contract.ordinary_observer_bounded_perception_only, true);
assert.equal(contract.typed_target_or_place_ref_required, true);
assert.equal(contract.subjective_belief_alone_is_capability_proof, false);
assert.equal(contract.free_text_goal_inference_allowed, false);
assert.equal(contract.semantic_similarity_matching_performed, false);
assert.equal(contract.action_candidate_created, false);
assert.equal(contract.action_selected, false);
assert.equal(contract.objective_feasibility_verified, false);
assert.equal(contract.causal_outcome_asserted, false);
assert.equal(contract.raw_world_state_read, false);
assert.equal(contract.engine_private_phase72_evidence_read, false);
assert.equal(contract.durable_state_written, false);

const aliceInput = {
  character: "Alice",
  current_turn_id: "turn-7",
  perception: {
    character: "Alice",
    observed: [
      {
        object_id: "door-west",
        state: "closed",
        position: { x: 4, y: 1 },
      },
      {
        location_id: "west-hall",
        relation: "visible_exit_area",
      },
      {
        description: "a glint behind the sealed wall",
      },
    ],
    audible: [],
    other_senses: [],
  },
  cognition: {
    character: "Alice",
    implementation_intention_guidance: [
      {
        if_cue: { kind: "closed_passage_visible" },
        then_response: { relation: "open", object_ref: "door-like barrier" },
        reconsideration_state: "active",
        cue_applicable: true,
        advisory_only: true,
        selected_action_authority: false,
        executable_action_id: null,
      },
    ],
    experiential_method_guidance: {
      character: "Alice",
      current_turn_id: "turn-7",
      character_view: {
        source: "competition_resolved_cue_grounded_experiential_methods",
        transferred_methods: [
          {
            transfer_ref: "phase76e_method_open_barrier",
            method_skeleton: {
              relation: "manipulate_latch_then_move",
              method_ref: "learned-door-method",
              qualifiers: ["close_reach"],
            },
            source_knowledge_status: "supported",
            subjective_not_world_truth: true,
          },
        ],
        advisory_only: true,
        selected_action_authority: false,
      },
    },
    self_model_context: {
      character: "Alice",
      current_turn_id: "turn-7",
      character_view: {
        source: "committed_prior_turn_effective_revised_structured_self_model",
        aspects: [
          {
            aspect_type: "capability_appraisal",
            domain: "manual_skill",
            relation: "can_attempt",
            object: "simple_latch_manipulation",
            qualifiers: ["ordinary_reach"],
            subjective_not_world_truth: true,
          },
          {
            aspect_type: "personality_tendency",
            domain: "temperament",
            relation: "prefers",
            object: "caution",
            qualifiers: [],
            subjective_not_world_truth: true,
          },
        ],
      },
    },
    subjective_cognition: {
      beliefs: [
        {
          proposition: "There may be a hidden key behind the wall.",
        },
      ],
    },
  },
  world_state: {
    hidden_objects: [
      {
        object_id: "secret-key-unperceived",
        location_id: "sealed-room-unperceived",
      },
    ],
  },
  phase72_private_evidence: {
    means_status: "feasible",
    object_id: "secret-key-unperceived",
  },
};

const aliceSnapshot = structuredClone(aliceInput);
const aliceCatalog =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(aliceInput);

assert.deepEqual(aliceInput, aliceSnapshot, "C5-B must not mutate caller input.");
assert.equal(aliceCatalog.version, worldSimulationSubjectiveAffordanceEvidenceVersion);
assert.equal(aliceCatalog.character, "Alice");
assert.equal(aliceCatalog.current_turn_id, "turn-7");
assert.equal(aliceCatalog.status, "subjective_affordance_evidence_ready");
assert.equal(aliceCatalog.counts.perception_source_entry_count, 3);
assert.equal(aliceCatalog.counts.observation_evidence_count, 2);
assert.equal(aliceCatalog.counts.represented_means_count, 3);
assert.equal(aliceCatalog.counts.provenance_gap_count, 1);
assert.deepEqual(
  aliceCatalog.observation_catalog.map((entry) => entry.subject_ref).sort(),
  ["door-west", "west-hall"],
);
assert.deepEqual(
  aliceCatalog.represented_means_catalog.map((entry) => entry.source_kind).sort(),
  [
    "experiential_method_guidance",
    "implementation_intention_guidance",
    "structured_self_model_capability_appraisal",
  ],
);
assert.equal(
  aliceCatalog.provenance_gaps[0].reason,
  "typed_target_or_place_ref_missing",
);
assert.equal(aliceCatalog.boundaries.raw_world_state_read, false);
assert.equal(aliceCatalog.boundaries.engine_private_phase72_evidence_read, false);
assert.equal(aliceCatalog.boundaries.action_candidate_created, false);
assert.equal(aliceCatalog.boundaries.objective_feasibility_verified, false);
assert.equal(Object.isFrozen(aliceCatalog), true);
assert.equal(Object.isFrozen(aliceCatalog.observation_catalog), true);

const aliceSerialized = JSON.stringify(aliceCatalog);
for (const hidden of [
  "secret-key-unperceived",
  "sealed-room-unperceived",
  "There may be a hidden key behind the wall.",
]) {
  assert.equal(
    aliceSerialized.includes(hidden),
    false,
    `C5-B must not derive affordance evidence from hidden or belief-only value: ${hidden}`,
  );
}
for (const forbiddenField of [
  "candidate_action_intents",
  "\"action_id\"",
  "\"means_status\"",
  "\"physical_executability\"",
  "\"authorization_status\"",
]) {
  assert.equal(
    aliceSerialized.includes(forbiddenField),
    false,
    `C5-B evidence catalog must not smuggle authority field ${forbiddenField}`,
  );
}

const aliceReplay =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(aliceInput);
assert.deepEqual(aliceReplay, aliceCatalog);
assert.equal(aliceReplay.catalog_hash, aliceCatalog.catalog_hash);

const bobCatalog =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    character: "Bob",
    current_turn_id: "turn-7",
    perception: {
      character: "Bob",
      observed: [
        {
          object_id: "table-east",
          state: "clear",
        },
      ],
      audible: [],
      other_senses: [],
    },
    cognition: {
      character: "Bob",
      implementation_intention_guidance: [
        {
          if_cue: { kind: "workspace_visible" },
          then_response: { relation: "inspect", object_ref: "workspace" },
          reconsideration_state: "active",
          cue_applicable: true,
          advisory_only: true,
          selected_action_authority: false,
        },
      ],
    },
  });

assert.deepEqual(
  bobCatalog.observation_catalog.map((entry) => entry.subject_ref),
  ["table-east"],
);
assert.equal(JSON.stringify(bobCatalog).includes("door-west"), false);
assert.notEqual(
  bobCatalog.catalog_hash,
  aliceCatalog.catalog_hash,
  "different observer evidence must produce a different bounded catalog",
);

const crossCharacterMethodCatalog =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    ...aliceInput,
    cognition: {
      ...aliceInput.cognition,
      experiential_method_guidance: {
        ...aliceInput.cognition.experiential_method_guidance,
        character: "Bob",
      },
    },
  });
assert.equal(crossCharacterMethodCatalog.counts.represented_means_count, 2);
assert.equal(
  crossCharacterMethodCatalog.provenance_gaps.some((gap) =>
    gap.reason === "cross_character_experiential_guidance_rejected"),
  true,
);
assert.equal(
  JSON.stringify(crossCharacterMethodCatalog).includes(
    "phase76e_method_open_barrier",
  ),
  false,
);

const staleMethodCatalog =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    ...aliceInput,
    cognition: {
      ...aliceInput.cognition,
      experiential_method_guidance: {
        ...aliceInput.cognition.experiential_method_guidance,
        current_turn_id: "turn-6",
      },
    },
  });
assert.equal(staleMethodCatalog.counts.represented_means_count, 2);
assert.equal(
  staleMethodCatalog.provenance_gaps.some((gap) =>
    gap.reason === "stale_experiential_guidance_rejected"),
  true,
);

assert.throws(
  () => buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    ...aliceInput,
    perception: {
      ...aliceInput.perception,
      character: "Bob",
    },
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_EVIDENCE_CHARACTER_MISMATCH",
);

assert.throws(
  () => buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    ...aliceInput,
    cognition: {
      ...aliceInput.cognition,
      character: "Bob",
    },
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_EVIDENCE_CHARACTER_MISMATCH",
);

const insufficientCatalog =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    character: "Alice",
    current_turn_id: "turn-8",
    perception: {
      character: "Alice",
      observed: [{ description: "untyped shape" }],
      audible: [],
      other_senses: [],
    },
    cognition: {
      character: "Alice",
      self_model_context: {
        character: "Alice",
        character_view: {
          source: "committed_prior_turn_structured_self_model",
          aspects: [
            {
              aspect_type: "personality_tendency",
              domain: "temperament",
              relation: "prefers",
              object: "caution",
              subjective_not_world_truth: true,
            },
          ],
        },
      },
      goals: ["free text goal must not become a capability"],
      subjective_cognition: {
        beliefs: [{ proposition: "I can probably teleport." }],
      },
    },
  });
assert.equal(insufficientCatalog.status, "insufficient_grounded_evidence");
assert.equal(insufficientCatalog.counts.observation_evidence_count, 0);
assert.equal(insufficientCatalog.counts.represented_means_count, 0);
assert.equal(
  JSON.stringify(insufficientCatalog).includes("teleport"),
  false,
);
assert.equal(
  JSON.stringify(insufficientCatalog).includes("free text goal"),
  false,
);

console.log("CB-C5-B subjective affordance evidence catalog tests passed.");
