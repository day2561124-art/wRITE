import assert from "node:assert/strict";
import {
  buildWorldSimulationPersonTargetedSocialAppraisalResolverView,
  projectWorldSimulationPersonTargetedSocialAppraisals,
} from "../../server/src/world-simulation-person-targeted-social-appraisal-service.mjs";
import { worldSimulationListenerSocialInterpretationVersion } from "../../server/src/world-simulation-listener-social-interpretation-service.mjs";

function source(observer, perceivedPerson, meaning) {
  return {
    version: worldSimulationListenerSocialInterpretationVersion,
    observer,
    character_view: {
      observer,
      social_interpretations: [{
        version: worldSimulationListenerSocialInterpretationVersion,
        kind: "listener_subjective_social_interpretation",
        observer,
        evidence_ref: `evidence_${observer}`,
        perceived_speaker: perceivedPerson,
        interpretation_kind: "ambiguous",
        social_meaning: meaning,
        interpretation_subjective: true,
        speaker_attribution_subjective: true,
        actual_speaker_identity_known: false,
        world_truth_claimed: false,
        relationship_updated: false,
        belief_updated: false,
        action_selected: false,
      }],
    },
    audit: {
      relationship_write_performed: false,
      memory_write_performed: false,
      world_state_mutation_performed: false,
    },
  };
}
const b = buildWorldSimulationPersonTargetedSocialAppraisalResolverView({
  observer: "B",
  social_interpretation_projection: source("B", "mistaken_X", "像是在安慰我"),
  subjective_context: {
    prior_relationship: "先前互動讓我稍有戒心",
    expectation: "預期會受到批評",
    affect: "目前感到不安",
  },
});
const c = buildWorldSimulationPersonTargetedSocialAppraisalResolverView({
  observer: "C",
  social_interpretation_projection: source("C", "A", "像是在挖苦我"),
});
assert.equal(b.resolver_view.candidates[0].perceived_person, "mistaken_X");
assert.equal(b.resolver_view.candidates[0].subjective_context.belief, null);
assert.equal(c.resolver_view.candidates[0].subjective_context.prior_relationship, null);
assert.equal(b.resolver_view.candidates[0].target_identity_verified, false);
assert.equal(b.resolver_view.boundaries.subjective_context_source_certified_here, false);
const reference = b.resolver_view.candidates[0].evidence_ref;
const decisions = [{
  evidence_ref: reference,
  appraisal_kind: "ambivalent",
  concern: "想和對方維持合作",
  expectedness: "unexpected",
  significance: "meaningful",
  interpretation: "B 覺得話語友善，但仍保留戒心",
}];
const projected = projectWorldSimulationPersonTargetedSocialAppraisals({
  assembly: b, decisions,
});
const appraisal = projected.character_view.social_appraisals[0];
assert.equal(appraisal.observer, "B");
assert.equal(appraisal.perceived_person, "mistaken_X");
assert.equal(appraisal.appraisal_kind, "ambivalent");
assert.equal(appraisal.target_identity_verified, false);
assert.equal(appraisal.relationship_updated, false);
assert.equal(appraisal.memory_written, false);
assert.equal(appraisal.world_truth_claimed, false);
assert.equal(projected.audit.appraisal_count, 1);
assert.deepEqual(projectWorldSimulationPersonTargetedSocialAppraisals({ assembly: b, decisions }), projected);
assert.equal(projectWorldSimulationPersonTargetedSocialAppraisals({
  assembly: b, decisions: [],
}).audit.appraisal_count, 0);
assert.equal(projectWorldSimulationPersonTargetedSocialAppraisals({
  assembly: b, decisions: [{ evidence_ref: reference, appraisal_kind: "no_appraisal" }],
}).audit.appraisal_count, 0);
for (const invalid of [
  [{ ...decisions[0], evidence_ref: c.resolver_view.candidates[0].evidence_ref }],
  [{ ...decisions[0], trust_delta: 3 }],
  [{ ...decisions[0], relationship_updated: true }],
  [{ ...decisions[0], expectedness: "certain" }],
  [decisions[0], decisions[0]],
  [{ evidence_ref: reference, appraisal_kind: "no_appraisal", concern: "forced" }],
]) {
  assert.throws(() => projectWorldSimulationPersonTargetedSocialAppraisals({
    assembly: b, decisions: invalid,
  }));
}
assert.throws(() => buildWorldSimulationPersonTargetedSocialAppraisalResolverView({
  observer: "B", social_interpretation_projection: source("C", "A", "other"),
}), /same-observer/);
assert.throws(() => buildWorldSimulationPersonTargetedSocialAppraisalResolverView({
  observer: "B", social_interpretation_projection: source("B", "A", "other"),
  subjective_context: { true_speaker: "A" },
}), /unauthorized/);
const forged = structuredClone(b);
forged.source_projection_hash = "forged";
assert.throws(() => projectWorldSimulationPersonTargetedSocialAppraisals({
  assembly: forged, decisions,
}), /exact resolver view/);
console.log("CB-C4 person-targeted subjective social appraisal tests passed.");
