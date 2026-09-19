import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationInterferenceBoundedMemoryDistortionContract,
  projectWorldSimulationInterferenceBoundedMemoryDistortion,
  worldSimulationInterferenceBoundedMemoryDistortionVersion,
} from "../../server/src/world-simulation-interference-bounded-memory-distortion-service.mjs";

const temporal = [
  { memory_ref: "memory-old", encoded_at: "2026-01-01T00:00:00.000Z" },
  { memory_ref: "memory-target", encoded_at: "2026-01-02T00:00:00.000Z" },
  { memory_ref: "memory-new", encoded_at: "2026-01-03T00:00:00.000Z" },
  { memory_ref: "memory-unknown-time", encoded_at: null },
];

function project(overrides = {}) {
  return projectWorldSimulationInterferenceBoundedMemoryDistortion({
    query_id: "phase95-query",
    character: "千夜",
    step_index: 0,
    recovered_memory_evidence: [
      {
        source_memory_ref: "memory-target",
        fragment_id: "fragment-target",
        content_kind: "detail",
        target_relation: "target_related",
      },
    ],
    candidate_temporal_evidence: temporal,
    competition_relations: [],
    source_monitoring: {
      source_query_requested: false,
      source_confusion_observed: false,
      source_status: "not_queried",
      source_uncertainty_reasons: [],
    },
    source_monitoring_projection_hash: "phase94-projection-hash",
    ...overrides,
  });
}

const contract =
  buildWorldSimulationInterferenceBoundedMemoryDistortionContract();

assert.equal(
  contract.version,
  worldSimulationInterferenceBoundedMemoryDistortionVersion,
);
assert.equal(contract.phase, "Phase95");
assert.equal(contract.proactive_interference_requires_earlier_explicit_competitor, true);
assert.equal(contract.retroactive_interference_requires_later_explicit_competitor, true);
assert.equal(contract.temporal_direction_requires_encoded_at_lineage, true);
assert.equal(contract.undirected_competition_supported_when_time_unavailable_or_equal, true);
assert.equal(contract.competition_uses_existing_accessibility_or_cue_competition_refs, true);
assert.equal(contract.source_confusion_distortion_requires_phase94_evidence, true);
assert.equal(contract.gist_distortion_requires_actually_recovered_gist_fragment, true);
assert.equal(contract.random_distortion_allowed, false);
assert.equal(contract.generated_memory_content_allowed, false);
assert.equal(contract.hidden_candidate_content_inspected, false);
assert.equal(contract.unrecovered_memory_content_inspected, false);
assert.equal(contract.stored_memory_content_rewritten, false);
assert.equal(contract.stored_memory_source_rewritten, false);
assert.equal(contract.distortion_is_world_truth, false);
assert.equal(contract.interference_effect_established, false);
assert.equal(contract.numeric_interference_probability_modeled, false);
assert.equal(contract.numeric_distortion_probability_modeled, false);
assert.equal(contract.continuation_authority_replaced, false);

const baseline = project();
assert.equal(baseline.character_view.competing_memory_evidence_present, false);
assert.equal(
  baseline.character_view.interference_direction_status,
  "no_competing_memory_evidence",
);
assert.equal(baseline.character_view.proactive_interference_candidate, false);
assert.equal(baseline.character_view.retroactive_interference_candidate, false);
assert.equal(
  baseline.character_view.bounded_distortion_status,
  "no_bounded_distortion_evidence",
);
assert.deepEqual(baseline.character_view.distortion_cause_kinds, []);
assert.equal(baseline.character_view.distortion_content_generated, false);
assert.equal(baseline.character_view.stored_memory_content_rewritten, false);
assert.equal(baseline.character_view.stored_memory_source_rewritten, false);
assert.equal(baseline.character_view.distortion_not_world_truth, true);
assert.equal(baseline.character_view.random_distortion_allowed, false);
assert.equal(baseline.engine_evidence.hidden_candidate_content_inspected, false);
assert.equal(baseline.engine_evidence.unrecovered_memory_content_inspected, false);
assert.equal(Object.isFrozen(baseline.character_view), true);

const proactive = project({
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-old"],
    },
  ],
});
assert.equal(proactive.character_view.competing_memory_evidence_present, true);
assert.equal(
  proactive.character_view.interference_direction_status,
  "proactive_interference_candidate",
);
assert.equal(proactive.character_view.proactive_interference_candidate, true);
assert.equal(proactive.character_view.retroactive_interference_candidate, false);
assert.equal(proactive.character_view.interference_effect_established, false);
assert.equal(proactive.engine_evidence.competition_lineage.length, 1);
assert.deepEqual(proactive.engine_evidence.competition_lineage[0], {
  recovered_memory_ref: "memory-target",
  competitor_memory_ref: "memory-old",
  direction: "proactive_interference_candidate",
  recovered_encoded_at: "2026-01-02T00:00:00.000Z",
  competitor_encoded_at: "2026-01-01T00:00:00.000Z",
});

const retroactive = project({
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-new"],
    },
  ],
});
assert.equal(
  retroactive.character_view.interference_direction_status,
  "retroactive_interference_candidate",
);
assert.equal(retroactive.character_view.proactive_interference_candidate, false);
assert.equal(retroactive.character_view.retroactive_interference_candidate, true);

const mixed = project({
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-old", "memory-new"],
    },
  ],
});
assert.equal(
  mixed.character_view.interference_direction_status,
  "mixed_proactive_and_retroactive_interference_candidate",
);
assert.equal(mixed.character_view.proactive_interference_candidate, true);
assert.equal(mixed.character_view.retroactive_interference_candidate, true);
assert.equal(mixed.engine_evidence.competition_lineage.length, 2);

const undirected = project({
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-unknown-time"],
    },
  ],
});
assert.equal(
  undirected.character_view.interference_direction_status,
  "undirected_competing_memory",
);
assert.equal(undirected.character_view.undirected_competing_memory_evidence, true);
assert.equal(undirected.character_view.interference_effect_established, false);

const targetPreferred = project({
  recovered_memory_evidence: [
    {
      source_memory_ref: "memory-target",
      fragment_id: "fragment-target",
      content_kind: "detail",
      target_relation: "target_related",
    },
    {
      source_memory_ref: "memory-old",
      fragment_id: "fragment-old",
      content_kind: "detail",
      target_relation: "non_target",
    },
  ],
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-old"],
    },
    {
      memory_ref: "memory-old",
      competitor_memory_refs: ["memory-new"],
    },
  ],
});
assert.equal(
  targetPreferred.character_view.competition_anchor_mode,
  "target_related_recovered_memory",
);
assert.equal(targetPreferred.engine_evidence.competition_lineage.length, 1);
assert.equal(
  targetPreferred.engine_evidence.competition_lineage[0].recovered_memory_ref,
  "memory-target",
);

const sourceConfusion = project({
  source_monitoring: {
    source_query_requested: true,
    source_confusion_observed: true,
    source_status: "uncertain_source_confusion_present",
    source_uncertainty_reasons: [
      "recollected_memory_marked_source_confused",
    ],
  },
  source_monitoring_projection_hash: "phase94-confusion-hash",
});
assert.equal(sourceConfusion.character_view.source_confusion_distortion_candidate, true);
assert.equal(sourceConfusion.character_view.gist_reconstruction_distortion_candidate, false);
assert.equal(
  sourceConfusion.character_view.bounded_distortion_status,
  "source_confusion_distortion_candidate",
);
assert.deepEqual(sourceConfusion.character_view.distortion_cause_kinds, [
  "source_confusion",
]);
assert.deepEqual(sourceConfusion.engine_evidence.distortion_cause_lineage, [
  {
    cause_kind: "source_confusion",
    source_phase94_projection_hash: "phase94-confusion-hash",
  },
]);

assert.throws(
  () => project({
    source_monitoring: {
      source_confusion_observed: true,
      source_status: "uncertain_source_confusion_present",
    },
    source_monitoring_projection_hash: null,
  }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_SOURCE_MONITORING_BINDING_REQUIRED",
);

const gist = project({
  recovered_memory_evidence: [
    {
      source_memory_ref: "memory-target",
      fragment_id: "fragment-gist",
      content_kind: "gist",
      target_relation: "target_related",
      content: "this field must be ignored by Phase95",
    },
  ],
});
assert.equal(gist.character_view.source_confusion_distortion_candidate, false);
assert.equal(gist.character_view.gist_reconstruction_distortion_candidate, true);
assert.equal(
  gist.character_view.bounded_distortion_status,
  "gist_reconstruction_distortion_candidate",
);
assert.deepEqual(gist.character_view.distortion_cause_kinds, [
  "gist_reconstruction",
]);
assert.deepEqual(gist.engine_evidence.distortion_cause_lineage, [
  {
    cause_kind: "gist_reconstruction",
    recovered_fragment_ids: ["fragment-gist"],
    recovered_memory_refs: ["memory-target"],
  },
]);
assert.equal(
  JSON.stringify(gist).includes("this field must be ignored by Phase95"),
  false,
  "Phase95 must not inspect or echo recovered memory content.",
);

assert.throws(
  () => project({
    recovered_memory_evidence: [
      {
        source_memory_ref: "memory-target",
        content_kind: "gist",
        target_relation: "target_related",
      },
    ],
  }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_GIST_BINDING_REQUIRED",
);

const combined = project({
  recovered_memory_evidence: [
    {
      source_memory_ref: "memory-target",
      fragment_id: "fragment-gist",
      content_kind: "gist",
      target_relation: "target_related",
    },
  ],
  source_monitoring: {
    source_confusion_observed: true,
    source_status: "uncertain_source_confusion_present",
    source_uncertainty_reasons: [
      "conflicting_recollected_source_actor",
    ],
  },
  source_monitoring_projection_hash: "phase94-combined-hash",
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-old"],
    },
  ],
});
assert.equal(
  combined.character_view.bounded_distortion_status,
  "multiple_bounded_distortion_causes",
);
assert.deepEqual(combined.character_view.distortion_cause_kinds, [
  "source_confusion",
  "gist_reconstruction",
]);
assert.equal(combined.character_view.proactive_interference_candidate, true);
assert.equal(combined.character_view.distortion_content_generated, false);
assert.equal(combined.engine_evidence.distortion_promoted_to_world_truth, false);

const deterministicInput = {
  competition_relations: [
    {
      memory_ref: "memory-target",
      competitor_memory_refs: ["memory-old", "memory-new", "memory-old"],
    },
  ],
};
assert.deepEqual(
  project(JSON.parse(JSON.stringify(deterministicInput))),
  project(deterministicInput),
  "Phase95 projection must be deterministic.",
);

const immutableInput = {
  query_id: "phase95-immutable",
  character: "千夜",
  step_index: 0,
  recovered_memory_evidence: [
    {
      source_memory_ref: "memory-target",
      fragment_id: "fragment-target",
      content_kind: "detail",
      target_relation: "target_related",
    },
  ],
  candidate_temporal_evidence: temporal,
  competition_relations: [],
  source_monitoring: {},
  source_monitoring_projection_hash: "phase94-hash",
};
const before = hashAgentRunValue(immutableInput);
projectWorldSimulationInterferenceBoundedMemoryDistortion(immutableInput);
assert.equal(hashAgentRunValue(immutableInput), before);

assert.throws(
  () => project({
    competition_relations: [
      {
        memory_ref: "memory-target",
        competitor_memory_refs: ["unknown-memory"],
      },
    ],
  }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_LINEAGE_INVALID",
);

assert.throws(
  () => projectWorldSimulationInterferenceBoundedMemoryDistortion({}),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_INTERFERENCE_BOUNDED_MEMORY_DISTORTION_INPUT_INVALID",
);

for (const forbidden of [
  "memory-old",
  "memory-target",
  "memory-new",
  "encoded_at",
  "projection-hash",
]) {
  assert.equal(
    JSON.stringify(combined.character_view).includes(forbidden),
    false,
    `${forbidden} must not leak into the Phase95 character view.`,
  );
}

const accessibilitySource = await readFile(
  "server/src/world-simulation-memory-accessibility-service.mjs",
  "utf8",
);
assert.match(accessibilitySource, /interference_competitor_refs:/);
assert.match(accessibilitySource, /competitor_memory_refs:/);

const retrievalSource = await readFile(
  "server/src/world-simulation-memory-retrieval-multistep-service.mjs",
  "utf8",
);
const phase94Index = retrievalSource.indexOf(
  "const familiarityRecognitionSourceMonitoring =",
);
const phase95Index = retrievalSource.indexOf(
  "const interferenceBoundedMemoryDistortion =",
);
const continuationIndex = retrievalSource.indexOf(
  "const continuationResolution =",
  phase95Index,
);
assert.ok(phase94Index >= 0, "Phase94 must remain installed.");
assert.ok(
  phase95Index > phase94Index,
  "Phase95 must consume bounded evidence after Phase94 source monitoring.",
);
assert.ok(
  continuationIndex > phase95Index,
  "Phase95 must project evidence before existing continuation control.",
);
assert.match(
  retrievalSource,
  /memory_distortion:\s*\r?\n\s*cloneJson\(\s*\r?\n\s*interferenceBoundedMemoryDistortion\.character_view/,
);
assert.match(
  retrievalSource,
  /interference_bounded_memory_distortion_projection_hash:/,
);
assert.match(
  retrievalSource,
  /interference_bounded_memory_distortion_evidence_hashes:/,
);
assert.match(
  retrievalSource,
  /phase95_hidden_candidate_content_inspected:\s*\r?\n\s*false/,
);
assert.match(
  retrievalSource,
  /phase95_generated_memory_content_allowed:\s*\r?\n\s*false/,
);
assert.match(
  retrievalSource,
  /phase95_stored_memory_content_rewritten:\s*\r?\n\s*false/,
);
assert.match(
  retrievalSource,
  /phase95_distortion_world_truth:\s*\r?\n\s*false/,
);

const persistenceSource = await readFile(
  "server/src/world-simulation-memory-retrieval-persistence-service.mjs",
  "utf8",
);
assert.match(
  persistenceSource,
  /validatePhase95InterferenceDistortionEvidenceBinding/,
);
assert.match(
  persistenceSource,
  /WORLD_SIMULATION_MEMORY_RETRIEVAL_PERSISTENCE_PHASE95_BINDING_MISMATCH/,
);
assert.match(
  persistenceSource,
  /phase95_interference_bounded_memory_distortion_full_evidence_persisted:\s*\r?\n\s*false/,
);
assert.match(
  persistenceSource,
  /phase95_projection_hash_committed_via_search_steps:/,
);
assert.match(
  persistenceSource,
  /phase95_evidence_binding_verified:/,
);
assert.match(
  persistenceSource,
  /phase95_non_contacted_competitor_refs_persisted:\s*\r?\n\s*false/,
);
assert.match(
  persistenceSource,
  /phase95_generated_memory_content_persisted:\s*\r?\n\s*false/,
);

console.log("Phase95 interference + bounded memory distortion: PASS");
