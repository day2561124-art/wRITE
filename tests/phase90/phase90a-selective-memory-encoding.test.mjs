import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildWorldSimulationNativeSelectiveMemoryEncodingDecisions,
  buildWorldSimulationSelectiveMemoryEncodingContract,
  worldSimulationSelectiveMemoryEncodingVersion,
} from "../../server/src/world-simulation-selective-memory-encoding-service.mjs";

const character = "千夜";

const contract = buildWorldSimulationSelectiveMemoryEncodingContract();
assert.equal(contract.phase, "Phase90A");
assert.equal(contract.attention_is_evidence_not_binary_memory_gate, true);
assert.equal(contract.focus_is_not_required_for_encoding, true);
assert.equal(contract.non_focus_goal_relevance_may_support_encoding, true);
assert.equal(contract.peripheral_observation_auto_discarded, false);
assert.equal(contract.current_mind_reject_alone_may_skip_encoding, false);
assert.equal(contract.explicit_bounded_encoding_exclusion_required_for_skip, true);
assert.equal(contract.numeric_encoding_probability_modeled, false);
assert.equal(contract.universal_encoding_threshold_modeled, false);
assert.equal(contract.single_memory_strength_modeled, false);
assert.equal(contract.memory_content_rewrite_allowed, false);
assert.equal(contract.world_truth_authority, false);

const preparedTurn = {
  turn_id: "phase90a-turn",
  decision_packets: [{ character }],
  attention_encoding_evidence: [{
    character,
    evidence: [
      {
        sense: "visual",
        sense_index: 0,
        processing_level: "focus",
        current_mind_gate_outcome: "admit",
        goal_relevance: false,
        expectation_violation: false,
        immediate_constraint_or_urgency: false,
      },
      {
        sense: "auditory",
        sense_index: 0,
        processing_level: "peripheral",
        current_mind_gate_outcome: "maintain",
        goal_relevance: true,
        expectation_violation: false,
        immediate_constraint_or_urgency: false,
      },
      {
        sense: "other",
        sense_index: 0,
        processing_level: "not_admitted",
        current_mind_gate_outcome: "reject",
        goal_relevance: false,
        expectation_violation: false,
        immediate_constraint_or_urgency: false,
        encoding_exclusion_supported: true,
      },
      {
        sense: "visual",
        sense_index: 1,
        processing_level: "not_admitted",
        current_mind_gate_outcome: "reject",
        goal_relevance: false,
        expectation_violation: false,
        immediate_constraint_or_urgency: false,
      },
    ],
  }],
};

const result = buildWorldSimulationNativeSelectiveMemoryEncodingDecisions({
  prepared_turn: preparedTurn,
});
assert.equal(result.version, worldSimulationSelectiveMemoryEncodingVersion);
assert.equal(result.audit.native_policy_used, true);
assert.equal(result.audit.encode_count, 2);
assert.equal(result.audit.do_not_encode_count, 1);
assert.equal(result.audit.unspecified_count, 1);
assert.deepEqual(
  result.decisions.map((entry) => [entry.sense, entry.sense_index, entry.decision]),
  [
    ["visual", 0, "encode"],
    ["auditory", 0, "encode"],
    ["other", 0, "do_not_encode"],
    ["visual", 1, "unspecified"],
  ],
);
assert.match(result.decisions[1].reason, /goal_relevance/);
assert.match(result.decisions[2].reason, /explicit_bounded_encoding_exclusion/);
assert.match(result.decisions[3].reason, /bounded_evidence_insufficient_for_selective_override/);
assert.equal(result.audit.attention_is_binary_memory_gate, false);
assert.equal(result.audit.numeric_probability_used, false);
assert.equal(result.audit.single_memory_strength_used, false);

const emptyEvidence = buildWorldSimulationNativeSelectiveMemoryEncodingDecisions({
  prepared_turn: {
    turn_id: "phase90a-no-evidence",
    decision_packets: [{ character }],
    attention_encoding_evidence: [],
  },
});
assert.deepEqual(emptyEvidence.decisions, []);
assert.equal(
  emptyEvidence.audit.decision_count,
  0,
  "missing bounded attention evidence must not invent an encoding decision",
);

assert.throws(
  () => buildWorldSimulationNativeSelectiveMemoryEncodingDecisions({
    prepared_turn: {
      turn_id: "phase90a-duplicate",
      decision_packets: [{ character }],
      attention_encoding_evidence: [{
        character,
        evidence: [
          { sense: "visual", sense_index: 0, processing_level: "focus", current_mind_gate_outcome: "admit" },
          { sense: "visual", sense_index: 0, processing_level: "active", current_mind_gate_outcome: "maintain" },
        ],
      }],
    },
  }),
  (error) => error?.code === "WORLD_SIMULATION_SELECTIVE_ENCODING_EVIDENCE_DUPLICATE",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
assert.match(loopSource, /attentionEncodingEvidence\.push\(\{/);
assert.match(loopSource, /buildWorldSimulationNativeSelectiveMemoryEncodingDecisions\(\{/);
assert.match(loopSource, /encoding_decisions:\s*subjectiveMemoryEncodingDecisions\.decisions/);
assert.match(loopSource, /native_policy_used_without_hook:\s*true/);
assert.match(loopSource, /focus_directly_controls_encoding:\s*false/);

console.log("Phase90A native selective memory encoding: PASS");
