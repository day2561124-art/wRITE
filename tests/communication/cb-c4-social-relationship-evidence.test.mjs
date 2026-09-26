import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationSocialAppraisalExperienceBridgeVersion } from "../../server/src/world-simulation-social-appraisal-memory-bridge-service.mjs";
import { buildWorldSimulationCommittedSocialRelationshipEvidence } from "../../server/src/world-simulation-social-relationship-evidence-service.mjs";

const h = (seed) => hashAgentRunValue({ seed });
function fixture(turn, kind, memoryId, appraisalHash) {
  const source = { character: "B", appraisal_hash: appraisalHash,
    source_interpretation_hash: h(`interpretation-${turn}`) };
  const bridge = {
    version: worldSimulationSocialAppraisalExperienceBridgeVersion,
    turn_id: turn,
    source_entries: [source],
    experience_packets: [],
    boundaries: {},
  };
  bridge.bridge_hash = hashAgentRunValue(bridge);
  const memory = {
    memory_id: memoryId,
    memory_type: "episodic_social_experience",
    source: { kind: "subjective_social_experience" },
    content: {
      perceived_person: "A",
      appraisal_kind: kind,
      interpretation: `B perceived A as ${kind}`,
      expectedness: "uncertain",
      significance: "meaningful",
      attribution_subjective: true,
      target_identity_verified: false,
      world_truth_claimed: false,
    },
    internal_provenance: {
      turn_id: turn,
      social_appraisal_hash: appraisalHash,
      social_interpretation_hash: source.source_interpretation_hash,
      social_bridge_version: worldSimulationSocialAppraisalExperienceBridgeVersion,
    },
  };
  return { bridge, memory, formation: {
    result: { character_updates: [{ character: "B", memory_records: [memory] }] },
  } };
}
const first = fixture("turn-1", "affiliative", "memory-one", h("appraisal-1"));
const initial = {
  characters: { A: { relationships: { B: "朋友" } },
    B: { relationships: { A: "朋友" } } },
  memories: { A: [], B: [first.memory] },
};
function project(worldState, turn, data, formation = data.formation) {
  return buildWorldSimulationCommittedSocialRelationshipEvidence({
    world_state: worldState,
    turn_id: turn,
    social_appraisal_experience_bridge: data.bridge,
    subjective_memory_formation: formation,
  });
}
const skipped = project({ ...initial, memories: { A: [], B: [] } },
  "turn-1", first, { result: {
    character_updates: [{ character: "B", memory_records: [] }],
  } });
assert.equal(skipped.state_transitions.length, 0);
assert.equal(skipped.preview_world_state.characters.B.relationships.A, "朋友");

const created = project(initial, "turn-1", first);
assert.equal(created.state_transitions.length, 1);
assert.equal(created.evidence_created.length, 1);
assert.equal(created.preview_world_state.characters.B.relationships.A.prior_description, "朋友");
assert.equal(created.preview_world_state.characters.B.relationships.A.social_evidence.length, 1);
assert.equal(created.preview_world_state.characters.A.relationships.B, "朋友");
const replayed = project(created.preview_world_state, "turn-1", first);
assert.equal(replayed.state_transitions.length, 0);
assert.deepEqual(replayed.preview_world_state, created.preview_world_state);

const second = fixture("turn-2", "adverse", "memory-two", h("appraisal-2"));
const prior = structuredClone(created.preview_world_state);
prior.memories.B.push(second.memory);
const contradicted = project(prior, "turn-2", second);
assert.deepEqual(contradicted.preview_world_state.characters.B.relationships.A.social_evidence
  .map((item) => item.appraisal_kind), ["affiliative", "adverse"]);
assert.equal(contradicted.preview_world_state.characters.B.relationships.A.prior_description, "朋友");

const tampered = structuredClone(initial);
tampered.memories.B[0].content.interpretation = "changed after formation";
assert.throws(() => project(tampered, "turn-1", first),
  { code: "WORLD_SIMULATION_SOCIAL_RELATIONSHIP_EVIDENCE_INVALID" });
const foreign = structuredClone(first);
foreign.formation.result.character_updates[0].character = "A";
assert.throws(() => project(initial, "turn-1", foreign),
  { code: "WORLD_SIMULATION_SOCIAL_RELATIONSHIP_EVIDENCE_INVALID" });
console.log("CB-C4 committed social relationship evidence tests passed.");
