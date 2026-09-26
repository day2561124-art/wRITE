import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience,
  worldSimulationSocialAppraisalExperienceBridgeVersion,
} from "../../server/src/world-simulation-social-appraisal-memory-bridge-service.mjs";
import { worldSimulationPersonTargetedSocialAppraisalVersion } from "../../server/src/world-simulation-person-targeted-social-appraisal-service.mjs";

function appraisal(character, person, meaning) {
  const body = {
    version: worldSimulationPersonTargetedSocialAppraisalVersion,
    kind: "person_targeted_subjective_social_appraisal",
    observer: character,
    evidence_ref: `evidence_${character}`,
    perceived_person: person,
    source_interpretation_hash: `interpretation_${character}`,
    appraisal_kind: "ambivalent",
    concern: "維持合作",
    expectedness: "uncertain",
    significance: "meaningful",
    interpretation: meaning,
    attribution_subjective: true,
    target_identity_verified: false,
    relationship_updated: false,
    memory_written: false,
    world_truth_claimed: false,
  };
  return { ...body, appraisal_hash: hashAgentRunValue(body) };
}
const b = appraisal("B", "mistaken_X", "B 覺得對方表面友善但可能在嘲諷");
const input = {
  turn_id: "turn_c4",
  decision_packets: [
    { character: "B", perception: { social_appraisals: [b] } },
    { character: "C", perception: {} },
  ],
  person_targeted_social_appraisal_projections: [
    { character: "B", version: worldSimulationPersonTargetedSocialAppraisalVersion,
      character_view_hash: hashAgentRunValue({ observer: "B", social_appraisals: [b] }),
      audit: { appraisal_count: 1 },
      relationship_write_performed: false, memory_write_performed: false,
      world_state_mutation_performed: false },
    { character: "C", version: worldSimulationPersonTargetedSocialAppraisalVersion,
      character_view_hash: hashAgentRunValue({ observer: "C", social_appraisals: [] }),
      audit: { appraisal_count: 0 },
      relationship_write_performed: false, memory_write_performed: false,
      world_state_mutation_performed: false },
  ],
};
const bridge = bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(input);
assert.equal(bridge.version, worldSimulationSocialAppraisalExperienceBridgeVersion);
assert.equal(bridge.source_entries.length, 1);
assert.equal(bridge.experience_packets.length, 1);
assert.equal(bridge.experience_packets[0].character, "B");
const observation = bridge.experience_packets[0].perception.other_senses[0];
assert.equal(observation.kind, "person_targeted_subjective_social_experience");
assert.equal(observation.perceived_person, "mistaken_X");
assert.equal(observation.target_identity_verified, false);
assert.equal(observation.internal_social_appraisal_hash, b.appraisal_hash);
assert.equal(bridge.boundaries.phase63_social_experience_admission_installed, false);
assert.equal(bridge.boundaries.memory_write_performed, false);
assert.equal(JSON.stringify(bridge).includes("source_action_id"), false);
assert.deepEqual(bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(input), bridge);
const crossOwner = structuredClone(input);
crossOwner.decision_packets[0].perception.social_appraisals[0].observer = "C";
assert.throws(() => bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(crossOwner));
const altered = structuredClone(input);
altered.decision_packets[0].perception.social_appraisals[0].interpretation = "改寫過的內容";
assert.throws(() => bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(altered), /differs/);
const forgedSummary = structuredClone(input);
forgedSummary.person_targeted_social_appraisal_projections[0].character_view_hash = "forged";
assert.throws(() => bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(forgedSummary), /differs/);
const malformed = structuredClone(input);
malformed.decision_packets[1].perception.social_appraisals = {};
assert.throws(() => bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(malformed), /must be an array/);
const missing = structuredClone(input);
missing.person_targeted_social_appraisal_projections.pop();
assert.throws(() => bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(missing), /lacks/);
const duplicated = structuredClone(input);
duplicated.decision_packets.push(structuredClone(duplicated.decision_packets[0]));
assert.throws(() => bridgeWorldSimulationSocialAppraisalsToSubjectiveExperience(duplicated), /Duplicate character/);
console.log("CB-C4 social appraisal experience bridge tests passed.");
