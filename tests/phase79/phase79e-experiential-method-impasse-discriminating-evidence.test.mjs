import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseDiscriminatingEvidenceContract,
  projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence,
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import { buildWorldSimulationLoopContract } from "../../server/src/world-simulation-loop-service.mjs";

function impasseProjection() {
  const projection = {
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    character: "千夜",
    current_turn_id: "turn-79e",
    source_phase79b_resolution_hash: "resolution-source",
    source_phase79c_guidance_hash: "guidance-source",
    impasse_contexts: [{
      impasse_ref: "impasse-a",
      character: "千夜",
      current_turn_id: "turn-79e",
      source_resolution_ref: "resolution-a",
      impasse_type: "tie_impasse",
      retained_method_refs: ["method-a", "method-b"],
      unresolved_competition_refs: ["competition-a"],
      cyclic_preference_detected: false,
      candidate_methods: [
        {
          transfer_ref: "method-a",
          method_skeleton: { relation: "probe_then_commit", method_ref: "semantic-a", qualifiers: [] },
          source_knowledge_status: "supported",
          mapping_kind: "relational_analogy",
          current_context_basis: ["perception"],
          current_context_grounded: true,
          advisory_only: true,
        },
        {
          transfer_ref: "method-b",
          method_skeleton: { relation: "commit_then_adjust", method_ref: "semantic-b", qualifiers: [] },
          source_knowledge_status: "supported",
          mapping_kind: "relational_analogy",
          current_context_basis: ["perception"],
          current_context_grounded: true,
          advisory_only: true,
        },
      ],
      deliberation_contract: {
        seek_additional_discriminating_current_context_evidence: true,
        preserve_all_retained_methods_until_resolved: true,
        qualitative_resolution_only: true,
        new_preference_may_be_authored_here: false,
        action_selection_may_be_authored_here: false,
        semantic_revision_may_be_authored_here: false,
        arbitrary_tie_breaking_allowed: false,
      },
    }],
    impasse_count: 1,
    deliberation_required: true,
    audit: {
      exact_phase79b_source_verified: true,
      exact_phase79c_source_verified: true,
      tie_conflict_only: true,
      retained_method_lineage_verified: true,
      bounded_existing_context_basis_only: true,
      new_preference_authored: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      same_turn_learning_feedback_performed: false,
    },
  };
  projection.impasse_hash = hashAgentRunValue(projection);
  return projection;
}

const contract = buildWorldSimulationExperientialMethodImpasseDiscriminatingEvidenceContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion);
assert.equal(contract.source_owner, "Phase79D");
assert.equal(contract.current_character_visible_context_only, true);
assert.equal(contract.preference_authored, false);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.arbitrary_tie_breaking_allowed, false);

const impasse = impasseProjection();
const evidence = projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
  experiential_method_impasse_deliberation: impasse,
  current_context: {
    perception: {
      visible_route: "left corridor is blocked",
      target_id: "engine-target-secret",
      causal_evidence: "must-not-leak",
      confidence: 0.99,
      probability: 0.95,
      utility_score: 999,
      priority_score: 999,
      feasibility_score: 999,
      success_probability: 0.9,
      outcome: "must-not-become-impasse-authority",
      result: "must-not-become-impasse-authority",
    },
    attention: { focus: "blocked left corridor", engine_runtime: "hidden" },
    working_context: [{ content: "right corridor remains open", internal_ref: "hidden" }],
    subjective_cognition: { beliefs: [{ proposition: "probing first is safer" }], projection_hash: "hidden" },
    self_interpretation_context: { active: "prefers verification before commitment" },
    self_model_context: { caution_style: "deliberate" },
  },
});
assert.equal(evidence.version, worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion);
assert.equal(evidence.source_phase79d_impasse_hash, impasse.impasse_hash);
assert.equal(evidence.impasse_count, 1);
assert.equal(evidence.deliberation_evidence_available, true);
assert.ok(evidence.cue_count >= 4);
assert.deepEqual(evidence.impasse_evidence_contexts[0].retained_method_refs, ["method-a", "method-b"]);
assert.equal(evidence.impasse_evidence_contexts[0].evidence_selection_contract.preference_may_be_authored_here, false);
const serialized = JSON.stringify(
  evidence.impasse_evidence_contexts[0].current_context_cue_catalog,
);
assert.doesNotMatch(
  serialized,
  /engine-target-secret|must-not-leak|engine_runtime|internal_ref|projection_hash|must-not-become-impasse-authority|confidence|probability|utility_score|priority_score|feasibility_score|success_probability|outcome|result/,
);
assert.match(serialized, /left corridor is blocked/);
assert.match(serialized, /right corridor remains open/);
assert.equal(evidence.audit.preference_authored, false);
assert.equal(evidence.audit.action_selection_performed, false);
assert.equal(evidence.audit.numeric_similarity_confidence_probability_utility_modeled, false);

const tampered = structuredClone(impasse);
tampered.impasse_contexts[0].retained_method_refs.push("method-c");
assert.throws(
  () => projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
    experiential_method_impasse_deliberation: tampered,
    current_context: { perception: { visible: true } },
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_EVIDENCE_SOURCE_HASH_MISMATCH",
);

const noImpasse = impasseProjection();
noImpasse.impasse_contexts = [];
noImpasse.impasse_count = 0;
noImpasse.deliberation_required = false;
delete noImpasse.impasse_hash;
noImpasse.impasse_hash = hashAgentRunValue(noImpasse);
const empty = projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
  experiential_method_impasse_deliberation: noImpasse,
  current_context: { perception: { visible: true } },
});
assert.equal(empty.impasse_count, 0);
assert.equal(empty.deliberation_evidence_available, false);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.experiential_method_impasse_discriminating_evidence.version,
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
const stateSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"), "utf8");
const impasseIndex = loopSource.indexOf("const experientialMethodImpasseDeliberation =");
const cognitionIndex = loopSource.indexOf("const characterCognition =", impasseIndex);
const evidenceIndex = loopSource.indexOf("const experientialMethodImpasseDiscriminatingEvidence =", cognitionIndex);
const actionProposerIndex = loopSource.indexOf('"world_action_proposer"', evidenceIndex);
assert.ok(impasseIndex >= 0 && cognitionIndex > impasseIndex && evidenceIndex > cognitionIndex && actionProposerIndex > evidenceIndex);
assert.match(loopSource, /experiential_method_impasse_discriminating_evidence_projections:/);
assert.match(stateSource, /experiential_method_impasse_discriminating_evidence_projections:/);

console.log("Phase79E experiential method impasse discriminating evidence tests passed.");
