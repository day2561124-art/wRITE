import test from "node:test";
import assert from "node:assert/strict";

import { buildCharacterCommunicationIr } from "../../server/src/character-communication-ir-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";

const basis = "B 正在看的書尚未看完";
const privateContent = "我很依戀 B";
const indirectInput = {
  character: "A",
  cognition: {
    known: [basis],
    communication_goal: {
      character: "A",
      purpose: "希望 B 留下",
      addressee: "B",
      mode: "indirect",
      private_content: privateContent,
      withhold_private_content: true,
      basis_claim: basis,
    },
  },
};

test("shared IR separates speaker intention from observable and listener-authored meaning", () => {
  const candidate = buildCharacterCommunicationActionCandidate(indirectInput);
  const ir = candidate.communication.ir;
  assert.equal(ir.schema_version, "character-communication-ir-v1");
  assert.equal(ir.participants.speaker, "A");
  assert.deepEqual(ir.participants.intended_addressees, ["B"]);
  assert.equal(ir.communicative_goal.purpose, null);
  assert.equal(ir.content.semantic_content, basis);
  assert.equal(ir.content.epistemic.status, "character_known");
  assert.equal(ir.content.epistemic.source, null);
  assert.equal(ir.content.epistemic.world_truth_claimed, false);
  assert.equal(ir.pragmatics.indirect, true);
  assert.equal(ir.pragmatics.listener_inference_required, true);
  assert.equal(ir.modalities.speech.intended_meaning, basis);
  assert.equal(ir.modalities.speech.surface_realization_complete, false);
  assert.equal(ir.interaction.grounding_status, "not_yet_observed");
  assert.equal(ir.boundaries.observable_signal_authored, false);
  assert.equal(ir.boundaries.listener_inferred_meaning_authored, false);
  assert.equal(ir.boundaries.listener_private_state_inferred, false);
});

test("shared IR keeps withheld content private while retaining disclosure provenance", () => {
  const candidate = buildCharacterCommunicationActionCandidate(indirectInput);
  const ir = candidate.communication.ir;
  assert.equal(ir.disclosure.withheld_private_content, null);
  assert.equal(ir.disclosure.withheld_content_exposed, false);
  assert.equal(ir.disclosure.private_purpose_exposed, false);
  assert.equal(JSON.stringify(candidate.communication.message).includes(privateContent), false);
});

test("nonverbal semantic intent uses the same IR without pretending realization occurred", () => {
  const candidate = buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "示意 B 先停下",
        addressee: "B",
        mode: "nonverbal",
        nonverbal_signal: "以視線示意 B 暫停",
      },
    },
  });
  assert.equal(candidate.communication.ir.modalities.speech, null);
  assert.equal(candidate.communication.ir.modalities.nonverbal.intended_meaning, "以視線示意 B 暫停");
  assert.equal(candidate.communication.ir.modalities.nonverbal.surface_realization_complete, false);
});

test("IR constructor rejects self-addressed or identity-incomplete plans", () => {
  assert.throws(() => buildCharacterCommunicationIr({
    character: "A", addressee: "A", purpose: "測試", mode: "direct",
  }), { code: "CHARACTER_COMMUNICATION_IR_INVALID" });
});
