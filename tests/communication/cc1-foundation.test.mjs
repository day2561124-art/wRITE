import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCharacterCommunicationActionCandidate,
  planCharacterCommunication,
} from "../../server/src/character-communication-foundation-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";

const basis = "B 正在看的書尚未看完";
const goal = (mode, overrides = {}) => ({
  character: "A",
  purpose: "希望 B 留下",
  addressee: "B",
  mode,
  private_content: "我很依戀 B",
  withhold_private_content: true,
  basis_claim: basis,
  ...overrides,
});
const packet = (g, known = [basis], uncertain = []) => ({
  character: "A",
  cognition: { known, uncertain, communication_goal: g },
  candidate_action_intents: [],
});

test("indirect retention has same-character known grounding without exposing private motive as speech", () => {
  const value = planCharacterCommunication(packet(goal("indirect")));
  assert.equal(value.external_action, "speech");
  assert.equal(value.message.speech_act, "indirect_query");
  assert.equal(value.message.source, "cognition.known[0]");
  assert.equal(value.message.epistemic_status, "character_known");
  assert.notEqual(value.message.semantic_content, value.withheld_private_content);
  assert.equal(value.message.world_truth_claimed, false);
});

test("direct expression follows character's distinct disclosure decision", () => {
  const value = planCharacterCommunication(packet(goal("direct", {
    withhold_private_content: false,
    express_private_content: true,
  })));
  assert.equal(value.message.semantic_content, "我很依戀 B");
  assert.equal(value.mode, "direct");
});

test("silence emits no message even with a compatible known basis", () => {
  const value = planCharacterCommunication(packet(goal("silence")));
  assert.equal(value.external_action, "none");
  assert.equal(value.message, null);
});

test("unknown pretext cannot be fabricated", () => {
  const value = planCharacterCommunication(packet(goal("indirect"), []));
  assert.equal(value.external_action, "none");
  assert.equal(value.blocked_reason, "basis_not_in_same_character_accessible_cognition");
});

test("speaker uncertainty is preserved rather than promoted to fact", () => {
  const value = planCharacterCommunication(packet(goal("indirect"), [], [basis]));
  assert.equal(value.message.epistemic_status, "character_uncertain");
  assert.equal(value.message.source, "cognition.uncertain[0]");
});

test("same shared planner works for other identities, cannot read A's goal as B", () => {
  assert.throws(() => planCharacterCommunication({
    character: "B",
    cognition: { known: [basis], communication_goal: goal("indirect") },
  }), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
  const b = planCharacterCommunication({
    character: "B",
    cognition: {
      known: ["A 的畫還沒畫完"],
      communication_goal: {
        character: "B", addressee: "A", purpose: "希望 A 留下",
        mode: "indirect", basis_claim: "A 的畫還沒畫完",
      },
    },
  });
  assert.equal(b.message.source, "cognition.known[0]");
  assert.equal(b.character, "B");
});

test("communication action candidate exposes only public message semantics", () => {
  const candidate = buildCharacterCommunicationActionCandidate(packet(goal("indirect")));
  assert.ok(candidate.action_id.startsWith("communication_"));
  assert.equal(candidate.communication.channel, "speech");
  assert.equal(candidate.communication.addressee, "B");
  assert.equal(candidate.communication.message.semantic_content, basis);
  assert.equal(candidate.communication.message.epistemic_status, "character_known");
  assert.equal(Object.hasOwn(candidate.communication.message, "source"), false);
  assert.equal(Object.hasOwn(candidate.communication.message, "intended_pragmatic_effect"), false);
  const serialized = JSON.stringify(candidate);
  assert.equal(serialized.includes("我很依戀 B"), false);
  assert.equal(serialized.includes("希望 B 留下"), false);
});

test("native Character Brain input carries only non-binding communication projection", () => {
  const p = buildWorldSimulationCharacterBrainInput(packet(goal("indirect")));
  assert.equal(p.communication_foundation.message.semantic_content, basis);
  assert.equal(p.boundaries.communication_foundation_action_authority, false);
  assert.equal(p.boundaries.communication_foundation_world_truth_authority, false);
  assert.equal(p.candidate_action_intents.length, 0);
});
