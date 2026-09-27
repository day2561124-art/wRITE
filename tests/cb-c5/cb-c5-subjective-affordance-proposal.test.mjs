import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildWorldSimulationSubjectiveAffordanceEvidenceCatalog } from "../../server/src/world-simulation-subjective-affordance-evidence-service.mjs";
import {
  admitWorldSimulationSubjectiveAffordanceProposal,
  materializeWorldSimulationSubjectiveAffordanceCausalSelection,
  nativeSubjectiveAffordanceProposalCapability,
  resolveWorldSimulationNativeSubjectiveAffordanceProposal,
} from "../../server/src/world-simulation-subjective-affordance-proposal-service.mjs";

const source = {
  character: "Alice",
  current_turn_id: "turn-9",
  perception: { character: "Alice", observed: [
    { object_id: "token-1", position: { x: 1, y: 0 } },
    { location_id: "hall-1" },
  ] },
  cognition: { character: "Alice", experiential_method_guidance: {
    character: "Alice", current_turn_id: "turn-9",
    character_view: {
      advisory_only: true, selected_action_authority: false,
      transferred_methods: [{
        transfer_ref: "phase76e_method_prior_pickup",
        method_skeleton: {
          relation: "pickup",
          method_ref: "ordinary_object_pickup",
          qualifiers: [],
        },
        source_knowledge_status: "supported",
        subjective_not_world_truth: true,
      }],
    },
  } },
};
const sourceSnapshot = structuredClone(source);
const catalog = buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(source);
assert.equal(catalog.represented_means_catalog.length, 1,
  "Canonical Phase76E method must enter the C5-B catalog.");
const proposal = {
  observation_ref: catalog.observation_catalog.find((item) => item.subject_ref === "token-1").observation_ref,
  means_ref: catalog.represented_means_catalog[0].means_ref,
};
const menu = [{ action_id: "menu-1", intent: "wait" }];
const admit = (overrides = {}) => admitWorldSimulationSubjectiveAffordanceProposal({
  character: "Alice", current_turn_id: "turn-9",
  evidence_catalog: catalog, proposal, available_actions: menu, ...overrides,
});
const accepted = admit();
assert.equal(accepted.admitted, true);
assert.deepEqual(accepted.available_actions[0], menu[0]);
assert.equal(accepted.available_actions[1].object_interaction.type, "pickup");
assert.equal(accepted.available_actions[1].object_interaction.object_id, "token-1");
assert.equal(accepted.communication_slot_reserved, true);
assert.equal(accepted.objective_feasibility_verified, false);
assert.deepEqual(admit(), accepted, "replay identity must be deterministic");
assert.deepEqual(source, sourceSnapshot, "catalog + proposal must be read-only");
assert.deepEqual(menu, [{ action_id: "menu-1", intent: "wait" }]);

for (const hostile of [
  { ...proposal, object_id: "hidden-token" },
  { ...proposal, ability: "teleport" },
  { ...proposal, world_state: { objects: { "token-1": {} } } },
  { ...proposal, observation_ref: "stale-ref" },
  { ...proposal, means_ref: "fictitious-skill" },
  { observation_ref: catalog.observation_catalog.find((item) => item.subject_kind === "place").observation_ref, means_ref: proposal.means_ref },
]) assert.equal(admit({ proposal: hostile }).admitted, false);
assert.equal(admit({ character: "Bob" }).admitted, false);
assert.equal(admit({ current_turn_id: "turn-10" }).admitted, false);
assert.equal(admit({ evidence_catalog: { ...catalog, catalog_hash: "forged" } }).admitted, false);
for (const [name, change] of [
  ["invented_skill", (item) => { item.method_skeleton.method_ref = "teleport"; }],
  ["unrelated_method", (item) => { item.method_skeleton.relation = "open"; }],
  ["contested_method", (item) => { item.source_knowledge_status = "contested"; }],
]) {
  const negative = structuredClone(source);
  change(negative.cognition.experiential_method_guidance.character_view.transferred_methods[0]);
  const negativeCatalog = buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(negative);
  assert.equal(admit({
    evidence_catalog: negativeCatalog,
    proposal: {
      observation_ref: negativeCatalog.observation_catalog.find((item) => item.subject_kind === "object").observation_ref,
      means_ref: negativeCatalog.represented_means_catalog[0].means_ref,
    },
  }).admitted, false, name);
}
const stale = structuredClone(source);
stale.cognition.experiential_method_guidance.current_turn_id = "turn-8";
const staleCatalog = buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(stale);
assert.equal(staleCatalog.represented_means_catalog.length, 0);
assert.equal(admit({
  evidence_catalog: staleCatalog,
  proposal,
}).admitted, false, "stale method ref must fail closed");
const largeMenu = Array.from({ length: 25 }, (_, index) => ({
  action_id: `menu-${index}`, intent: "wait",
}));
const bounded = admit({ available_actions: largeMenu });
assert.equal(bounded.admitted, true);
assert.equal(bounded.menu_truncated, true);
assert.equal(bounded.menu_preserved_count, 22);
assert.equal(bounded.available_actions.length, 23);
assert.equal(nativeSubjectiveAffordanceProposalCapability,
  "subjective_affordance_proposal_v1");
assert.deepEqual(resolveWorldSimulationNativeSubjectiveAffordanceProposal(
  catalog, {
    subjective_affordance_catalog_hash: catalog.catalog_hash,
    subjective_affordance_proposal: proposal,
  },
), proposal);
assert.equal(resolveWorldSimulationNativeSubjectiveAffordanceProposal(
  catalog, {
    subjective_affordance_catalog_hash: "stale",
    subjective_affordance_proposal: proposal,
  },
), null);
assert.equal(resolveWorldSimulationNativeSubjectiveAffordanceProposal(
  catalog, {
    subjective_affordance_catalog_hash: catalog.catalog_hash,
    subjective_affordance_proposal: { ...proposal, action_id: "forged" },
  },
), null);
assert.equal(resolveWorldSimulationNativeSubjectiveAffordanceProposal(
  catalog, "reject_all",
), null);

const opaqueSource = structuredClone(source);
opaqueSource.perception.observed[0] = {
  perceptual_object_ref: "cb_c5d_object_visible_token",
  perceptual_label: "small brass token",
  relative_position: { dx_m: 0.5, dy_m: 0 },
};
const opaqueCatalog =
  buildWorldSimulationSubjectiveAffordanceEvidenceCatalog(opaqueSource);
const opaqueProposal = {
  observation_ref:
    opaqueCatalog.observation_catalog.find(
      (item) => item.subject_ref === "cb_c5d_object_visible_token",
    ).observation_ref,
  means_ref: opaqueCatalog.represented_means_catalog[0].means_ref,
};
const opaqueAccepted = admitWorldSimulationSubjectiveAffordanceProposal({
  character: "Alice",
  current_turn_id: "turn-9",
  evidence_catalog: opaqueCatalog,
  proposal: opaqueProposal,
  available_actions: menu,
  perceptual_object_bindings: [{
    perceptual_object_ref: "cb_c5d_object_visible_token",
    object_id: "token-1",
  }],
});
assert.equal(opaqueAccepted.admitted, true);
assert.deepEqual(
  opaqueAccepted.candidate.object_interaction,
  {
    type: "pickup",
    perceptual_object_ref: "cb_c5d_object_visible_token",
  },
);
assert.equal(
  Object.hasOwn(opaqueAccepted.candidate.object_interaction, "object_id"),
  false,
);
assert.equal(JSON.stringify(opaqueAccepted.candidate).includes("token-1"), false);
assert.equal(opaqueAccepted.private_binding.object_id, "token-1");
const materialized =
  materializeWorldSimulationSubjectiveAffordanceCausalSelection({
    selected_action_intent: {
      character: "Alice",
      selection: "candidate_action_intent",
      action_id: opaqueAccepted.candidate.action_id,
      intent: opaqueAccepted.candidate.intent,
      candidate: opaqueAccepted.candidate,
    },
    current_turn_id: "turn-9",
    private_bindings: [opaqueAccepted.private_binding],
  });
assert.equal(materialized.materialized, true);
assert.equal(
  materialized.selected_action_intent.candidate.object_interaction.object_id,
  "token-1",
);
assert.equal(
  Object.hasOwn(
    opaqueAccepted.candidate.object_interaction,
    "object_id",
  ),
  false,
  "Causal materialization must not mutate the Character Brain candidate.",
);
assert.throws(
  () => materializeWorldSimulationSubjectiveAffordanceCausalSelection({
    selected_action_intent: {
      character: "Alice",
      selection: "candidate_action_intent",
      action_id: opaqueAccepted.candidate.action_id,
      candidate: opaqueAccepted.candidate,
    },
    current_turn_id: "turn-9",
    private_bindings: [],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_CAUSAL_BINDING_MISSING",
);
const tamperedBinding = {
  ...structuredClone(opaqueAccepted.private_binding),
  object_id: "hidden-token",
};
assert.throws(
  () => materializeWorldSimulationSubjectiveAffordanceCausalSelection({
    selected_action_intent: {
      character: "Alice",
      selection: "candidate_action_intent",
      action_id: opaqueAccepted.candidate.action_id,
      candidate: opaqueAccepted.candidate,
    },
    current_turn_id: "turn-9",
    private_bindings: [tamperedBinding],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_CAUSAL_BINDING_INVALID",
);
assert.equal(
  admitWorldSimulationSubjectiveAffordanceProposal({
    character: "Alice",
    current_turn_id: "turn-9",
    evidence_catalog: opaqueCatalog,
    proposal: opaqueProposal,
    available_actions: menu,
    perceptual_object_bindings: [],
  }).admitted,
  false,
);

const directory = path.dirname(fileURLToPath(import.meta.url));
const loop = fs.readFileSync(path.resolve(directory, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
const resolverIndex = loop.indexOf("subjectiveAffordanceProposalResolver");
const proposerIndex = loop.indexOf('"world_action_proposer"', resolverIndex);
assert.ok(resolverIndex > 0 && proposerIndex > resolverIndex);
console.log("CB-C5-C grounded subjective affordance proposal tests passed.");
