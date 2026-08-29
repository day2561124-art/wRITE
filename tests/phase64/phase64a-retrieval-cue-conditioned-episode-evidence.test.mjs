import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationRetrievalCueConditionedEpisodeEvidenceContract,
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence,
  validateWorldSimulationRetrievalCueConditionedEpisodeEvidence,
  worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-cue-conditioned-episode-evidence-service.mjs";

const contract =
  buildWorldSimulationRetrievalCueConditionedEpisodeEvidenceContract();

assert.equal(
  contract.phase,
  "Phase64A-R4E1",
);
assert.equal(
  contract.source_phase63c_completed_step_prefix_required,
  true,
);
assert.equal(
  contract.explicit_process_termination_required,
  false,
);
assert.equal(
  contract.cue_conditioned_episode_basis,
  "contiguous_canonical_active_cue_hash",
);
assert.equal(
  contract.same_cue_hash_after_intervening_episode_opens_new_episode,
  true,
);
assert.equal(
  contract.episode_identity_is_contiguous_occurrence_not_global_cue_identity,
  true,
);
assert.equal(
  contract.retrieval_attempt_ontology_claimed,
  false,
);
assert.equal(
  contract.cue_hash_change_claimed_as_new_retrieval_attempt,
  false,
);
assert.equal(
  contract.raw_cue_content_materialized,
  false,
);
assert.equal(
  contract.resolver_exposure_allowed,
  false,
);
assert.equal(
  contract.cue_selection_authority,
  false,
);
assert.equal(
  contract.continuation_decision_authority,
  false,
);
assert.equal(
  contract.stop_decision_authority,
  false,
);
assert.equal(
  contract.new_attempt_creation_authority,
  false,
);
assert.equal(
  contract.retrieval_contact_authority,
  false,
);
assert.equal(
  contract.retrieval_recovery_authority,
  false,
);
assert.equal(
  contract.semantic_access_authority,
  false,
);
assert.equal(
  contract.persistent_memory_mutation_authority,
  false,
);
assert.equal(
  contract.character_subjective_awareness_modeled,
  false,
);

const queryId =
  "phase64a-r4e1-synthetic-query";
const initialFrontier = {
  frontier_id:
    "frontier-a0",
  active_cue_hash:
    "cue-hash-a",
};
const steps = [
  {
    step_index: 0,
    frontier: {
      frontier_id:
        "frontier-a0",
      active_cue_hash:
        "cue-hash-a",
    },
    selected_reinstatement_cue_refs: [
      "cue-option-a-to-b",
    ],
    reinstated_cues: [
      {
        kind:
          "semantic",
        value:
          "raw-cue-content-must-not-be-copied",
      },
    ],
    continuation: {
      control_action:
        "continue",
    },
    termination_after_step:
      false,
  },
  {
    step_index: 1,
    frontier: {
      frontier_id:
        "frontier-b1",
      active_cue_hash:
        "cue-hash-b",
    },
    selected_reinstatement_cue_refs: [
      "cue-option-b-to-a",
    ],
    continuation: {
      control_action:
        "continue",
    },
    termination_after_step:
      false,
  },
  {
    step_index: 2,
    frontier: {
      frontier_id:
        "frontier-a2",
      active_cue_hash:
        "cue-hash-a",
    },
    selected_reinstatement_cue_refs: [],
    continuation: {
      control_action:
        "stop",
    },
    termination_after_step:
      true,
  },
];

const evidence =
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
    query_id:
      queryId,
    source_initial_frontier:
      initialFrontier,
    initiation: {
      mode:
        "deliberate",
      trigger_origin:
        "self_generated",
    },
    search_steps:
      steps,
  });

assert.equal(
  evidence.version,
  worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
);
assert.equal(
  evidence.process_termination_observed,
  true,
);
assert.equal(
  evidence.cue_conditioned_episodes.length,
  3,
  "A→B→A must remain three contiguous cue-conditioned episodes",
);
assert.deepEqual(
  evidence.cue_conditioned_episodes.map(
    (episode) =>
      episode.cue_set_hash,
  ),
  [
    "cue-hash-a",
    "cue-hash-b",
    "cue-hash-a",
  ],
);
assert.deepEqual(
  evidence.cue_conditioned_episodes.map(
    (episode) =>
      episode.episode_index,
  ),
  [
    0,
    1,
    2,
  ],
);
assert.notEqual(
  evidence.cue_conditioned_episodes[0].episode_id,
  evidence.cue_conditioned_episodes[2].episode_id,
  "repeated cue hashes after an intervening episode must not collapse to one global cue identity",
);
assert.equal(
  evidence.cue_conditioned_episodes[0].initial_process_episode,
  true,
);
assert.equal(
  evidence.cue_conditioned_episodes[0].initial_trigger_origin,
  "self_generated",
);
assert.equal(
  evidence.cue_conditioned_episodes[1].initial_trigger_origin,
  null,
);
assert.equal(
  evidence.cue_transitions.length,
  2,
);
assert.deepEqual(
  evidence.cue_transitions.map(
    (transition) =>
      transition.provenance_kind,
  ),
  [
    "grounded_internal_reinstatement_selection",
    "grounded_internal_reinstatement_selection",
  ],
);
assert.deepEqual(
  evidence.cue_transitions[0]
    .selected_reinstatement_cue_refs,
  [
    "cue-option-a-to-b",
  ],
);
assert.equal(
  evidence.cue_transitions[0]
    .retrieval_attempt_created,
  false,
);
assert.equal(
  evidence.observation
    .cue_conditioned_episode_count,
  3,
);
assert.equal(
  evidence.observation
    .cue_transition_count,
  2,
);
assert.equal(
  evidence.observation
    .distinct_cue_hash_count,
  2,
);
assert.equal(
  evidence.observation
    .repeated_cue_hash_after_intervening_episode_observed,
  true,
);
assert.equal(
  evidence.observation
    .grounded_internal_reinstatement_transition_count,
  2,
);
assert.equal(
  evidence.observation
    .unattributed_cue_transition_count,
  0,
);
assert.equal(
  evidence.boundaries
    .retrieval_attempt_ontology_claimed,
  false,
);
assert.equal(
  evidence.boundaries
    .cue_hash_change_claimed_as_new_retrieval_attempt,
  false,
);
assert.equal(
  evidence.boundaries
    .retrieval_attempt_created,
  false,
);
assert.equal(
  evidence.boundaries
    .resolver_exposure_allowed,
  false,
);
assert.equal(
  JSON.stringify(evidence)
    .includes(
      "raw-cue-content-must-not-be-copied",
    ),
  false,
  "R4E1 must track transition provenance without materializing raw cue content",
);
assert.ok(
  Object.isFrozen(
    evidence,
  ),
);
assert.ok(
  Object.isFrozen(
    evidence.cue_conditioned_episodes,
  ),
);
assert.ok(
  Object.isFrozen(
    evidence.cue_transitions[0],
  ),
);

const validated =
  validateWorldSimulationRetrievalCueConditionedEpisodeEvidence(
    evidence,
  );
assert.deepEqual(
  validated,
  evidence,
);
assert.ok(
  Object.isFrozen(
    validated,
  ),
);

const tampered =
  structuredClone(
    evidence,
  );
tampered.observation.cue_transition_count = 99;
assert.throws(
  () =>
    validateWorldSimulationRetrievalCueConditionedEpisodeEvidence(
      tampered,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_EVIDENCE_HASH_MISMATCH",
);

const sameCuePrefix =
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
    query_id:
      "phase64a-r4e1-same-cue-prefix",
    source_initial_frontier: {
      frontier_id:
        "frontier-same-0",
      active_cue_hash:
        "cue-hash-same",
    },
    search_steps: [
      {
        step_index: 0,
        frontier: {
          frontier_id:
            "frontier-same-0",
          active_cue_hash:
            "cue-hash-same",
        },
        selected_reinstatement_cue_refs: [
          "cue-option-same",
        ],
        continuation: {
          control_action:
            "continue",
        },
        termination_after_step:
          false,
      },
      {
        step_index: 1,
        frontier: {
          frontier_id:
            "frontier-same-1",
          active_cue_hash:
            "cue-hash-same",
        },
        selected_reinstatement_cue_refs: [],
        continuation: {
          control_action:
            "continue",
        },
        termination_after_step:
          false,
      },
    ],
  });

assert.equal(
  sameCuePrefix.process_termination_observed,
  false,
  "R4E1 must remain usable on a completed Phase63C step prefix",
);
assert.equal(
  sameCuePrefix.cue_conditioned_episodes.length,
  1,
  "same contiguous canonical active-cue hash must remain one episode even if a cue ref was selected",
);
assert.equal(
  sameCuePrefix.cue_conditioned_episodes[0].step_count,
  2,
);
assert.equal(
  sameCuePrefix.cue_transitions.length,
  0,
);

const unattributed =
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
    query_id:
      "phase64a-r4e1-unattributed-transition",
    source_initial_frontier: {
      frontier_id:
        "frontier-u0",
      active_cue_hash:
        "cue-hash-u0",
    },
    search_steps: [
      {
        step_index: 0,
        frontier: {
          frontier_id:
            "frontier-u0",
          active_cue_hash:
            "cue-hash-u0",
        },
        selected_reinstatement_cue_refs: [],
        continuation: {
          control_action:
            "continue",
        },
        termination_after_step:
          false,
      },
      {
        step_index: 1,
        frontier: {
          frontier_id:
            "frontier-u1",
          active_cue_hash:
            "cue-hash-u1",
        },
        selected_reinstatement_cue_refs: [],
        continuation: {
          control_action:
            "stop",
        },
        termination_after_step:
          true,
      },
    ],
  });

assert.equal(
  unattributed.cue_transitions[0].provenance_kind,
  "observed_cue_set_change_unattributed",
  "R4E1 must preserve an observed transition without inventing a cause",
);
assert.equal(
  unattributed.observation
    .unattributed_cue_transition_count,
  1,
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
      query_id:
        "phase64a-r4e1-bad-initial",
      source_initial_frontier: {
        frontier_id:
          "frontier-a0",
        active_cue_hash:
          "cue-hash-a",
      },
      search_steps: [
        {
          step_index: 0,
          frontier: {
            frontier_id:
              "different-frontier",
            active_cue_hash:
              "cue-hash-a",
          },
          selected_reinstatement_cue_refs: [],
          continuation: {
            control_action:
              "stop",
          },
          termination_after_step:
            true,
        },
      ],
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_INITIAL_FRONTIER_MISMATCH",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
      query_id:
        "phase64a-r4e1-terminal-selection",
      source_initial_frontier: {
        frontier_id:
          "frontier-a0",
        active_cue_hash:
          "cue-hash-a",
      },
      search_steps: [
        {
          step_index: 0,
          frontier: {
            frontier_id:
              "frontier-a0",
            active_cue_hash:
              "cue-hash-a",
          },
          selected_reinstatement_cue_refs: [
            "illegal-terminal-cue",
          ],
          continuation: {
            control_action:
              "stop",
          },
          termination_after_step:
            true,
        },
      ],
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_TERMINAL_SELECTION_INVALID",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
      query_id:
        "phase64a-r4e1-override",
      source_initial_frontier:
        initialFrontier,
      search_steps:
        steps,
      new_attempt_policy: {
        after_cue_change:
          true,
      },
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_OVERRIDE_FORBIDDEN",
);

const multistepContract =
  buildWorldSimulationMemoryRetrievalProcessV3Contract();

assert.equal(
  multistepContract
    .phase64a_r4e1_retrieval_cue_conditioned_episode_evidence
    ?.phase,
  "Phase64A-R4E1",
);
assert.equal(
  multistepContract
    .phase64a_r4e1_retrieval_attempt_ontology_claimed,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e1_cue_hash_change_claimed_as_new_retrieval_attempt,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e1_retrieval_resolver_evidence_exposed,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e1_cue_selection_authority,
  false,
);
assert.equal(
  multistepContract
    .phase64a_r4e1_stop_decision_authority,
  false,
);

const multistepSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  multistepSource,
  /projectWorldSimulationRetrievalCueConditionedEpisodeEvidence\(\{[\s\S]*source_initial_frontier:[\s\S]*query\.initial_frontier[\s\S]*initiation,[\s\S]*search_steps:[\s\S]*steps/,
  "Phase63C v3 must materialize R4E1 from the actual completed search path",
);
assert.match(
  multistepSource,
  /retrieval_cue_conditioned_episode_evidence_hash:[\s\S]*retrievalCueConditionedEpisodeEvidence[\s\S]*\.evidence_hash/,
  "retrieval process identity must commit the R4E1 evidence hash",
);
assert.match(
  multistepSource,
  /retrieval_cue_conditioned_episode_evidence:[\s\S]*cloneJson\([\s\S]*retrievalCueConditionedEpisodeEvidence/,
  "Phase63C result must expose immutable engine-side R4E1 evidence",
);
assert.match(
  multistepSource,
  /retrieval_cue_conditioned_episode_evidence_exposed_to_resolver:[\s\S]*false/,
  "R4E1 evidence must remain invisible to Phase63C resolvers",
);
assert.match(
  multistepSource,
  /retrieval_cue_conditioned_episode_retrieval_attempt_ontology_claimed:[\s\S]*false/,
  "runtime audit must preserve episode != retrieval-attempt semantics",
);

const runAllSource =
  await readFile(
    new URL(
      "../run-all.mjs",
      import.meta.url,
    ),
    "utf8",
  );

const formalPath =
  "tests/phase64/phase64a-retrieval-cue-conditioned-episode-evidence.test.mjs";
assert.equal(
  runAllSource.split(formalPath).length - 1,
  1,
  "Phase64A-R4E1 formal test must be registered exactly once in tests/run-all.mjs",
);

console.log(
  "Phase64A-R4E1 cue-conditioned retrieval episode semantics and transition provenance passed.",
);
