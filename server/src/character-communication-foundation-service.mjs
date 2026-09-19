import { hashAgentRunValue } from "./agent-run-service.mjs";

/**
 * CC-1 bounded communication foundation. This is a same-character planning
 * projection, not a new action selector, world-truth oracle, or Chinese NLG.
 * A communication goal must have been authored in the character's cognition.
 */
export const characterCommunicationFoundationVersion =
  "cc1-communicative-intention-disclosure-planning-v1";

const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const string = (v, limit = 600) =>
  typeof v === "string" && v.trim() && [...v.trim()].length <= limit ? v.trim() : null;
const list = (v) => Array.isArray(v) ? v : [];

function fail(message) {
  const error = new Error(message);
  error.code = "CHARACTER_COMMUNICATION_FOUNDATION_INVALID";
  throw error;
}

/**
 * Deliberately accepts only the final character-facing cognition and an
 * explicitly retained communication goal. Raw world state and other
 * characters' private state have no parameter or fallback route.
 */
export function planCharacterCommunication(characterInput = {}) {
  const character = string(characterInput.character, 240);
  if (!character) fail("Same-character identity is required.");
  const cognition = isRecord(characterInput.cognition) ? characterInput.cognition : {};
  const goal = cognition.communication_goal;
  if (goal == null) return null;
  if (!isRecord(goal)) fail("communication_goal must be a structured character goal.");
  const owner = string(goal.character, 240);
  if (owner !== character) fail("Communication goal belongs to another character.");
  const purpose = string(goal.purpose, 240);
  const addressee = string(goal.addressee, 240);
  if (!purpose || !addressee || character === addressee) fail("Purpose and distinct addressee are required.");
  const mode = goal.mode;
  if (!["direct", "indirect", "silence", "nonverbal"].includes(mode))
    fail("Communication mode must be an explicit character-goal decision.");
  const privateContent = string(goal.private_content);
  if (goal.withhold_private_content === true && !privateContent)
    fail("Withholding requires a defined private content.");
  const withheld = goal.withhold_private_content === true ? privateContent : null;
  const basis = string(goal.basis_claim);
  if (mode === "silence") {
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "none",
      message: null,
      withheld_private_content: withheld,
      other_character_goal_inferred: false,
      world_truth_claimed: false,
    });
  }
  if (mode === "nonverbal") {
    const signal = string(goal.nonverbal_signal, 120);
    if (!signal) fail("Nonverbal expression needs character-authored signal intent.");
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "nonverbal_signal",
      message: { signal_intent: signal, semantic_content: null },
      withheld_private_content: withheld,
      other_character_goal_inferred: false,
      world_truth_claimed: false,
    });
  }
  if (mode === "direct") {
    if (goal.withhold_private_content === true && goal.express_private_content === true)
      fail("Direct expression may not reveal explicitly withheld content.");
    const content = string(goal.express_private_content === true
      ? privateContent
      : goal.public_content);
    if (!content) fail("Direct communication requires character-owned expressible content.");
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "speech",
      message: { speech_act: "inform_or_request", semantic_content: content, epistemic_status: "speaker_intention", source: "cognition.communication_goal" },
      withheld_private_content: withheld,
      other_character_goal_inferred: false,
      world_truth_claimed: false,
    });
  }
  if (!basis) fail("Indirect communication requires an explicit semantic basis.");
  if (basis === withheld) fail("Withheld inner content cannot be used as an indirect public basis.");
  const knownIndex = list(cognition.known).findIndex((v) => v === basis);
  const uncertainIndex = list(cognition.uncertain).findIndex((v) => v === basis);
  if (knownIndex < 0 && uncertainIndex < 0) {
    // No claim invention, no silent promotion of hidden world facts.
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "none",
      message: null,
      blocked_reason: "basis_not_in_same_character_accessible_cognition",
      withheld_private_content: withheld,
      other_character_goal_inferred: false,
      world_truth_claimed: false,
    });
  }
  const known = knownIndex >= 0;
  return copy({
    version: characterCommunicationFoundationVersion,
    character, addressee, purpose, mode,
    external_action: "speech",
    message: {
      speech_act: "indirect_query",
      semantic_content: basis,
      epistemic_status: known ? "character_known" : "character_uncertain",
      source: known ? `cognition.known[${knownIndex}]` : `cognition.uncertain[${uncertainIndex}]`,
      intended_pragmatic_effect: purpose,
      addressee_must_infer_indirect_intention: true,
      world_truth_claimed: false,
    },
    withheld_private_content: withheld,
    other_character_goal_inferred: false,
    world_truth_claimed: false,
  });
}

export function buildCharacterCommunicationActionCandidate(characterInput = {}) {
  const plan = planCharacterCommunication(characterInput);
  if (!plan || plan.external_action === "none") return null;
  const channel = plan.external_action === "speech" ? "speech" : "nonverbal";
  const sourceMessage = isRecord(plan.message) ? plan.message : {};
  const publicMessage = channel === "speech"
    ? {
        speech_act: sourceMessage.speech_act ?? null,
        semantic_content: sourceMessage.semantic_content ?? null,
        epistemic_status: sourceMessage.epistemic_status ?? null,
        addressee_must_infer_indirect_intention:
          sourceMessage.addressee_must_infer_indirect_intention === true,
        world_truth_claimed: false,
      }
    : {
        signal_intent: sourceMessage.signal_intent ?? null,
        semantic_content: sourceMessage.semantic_content ?? null,
        world_truth_claimed: false,
      };
  const identity = {
    version: characterCommunicationFoundationVersion,
    character: plan.character,
    addressee: plan.addressee,
    mode: plan.mode,
    channel,
    public_message: publicMessage,
  };
  return copy({
    action_id: `communication_${hashAgentRunValue(identity).slice(0, 24)}`,
    intent: `向${plan.addressee}表達`,
    target: plan.addressee,
    prerequisites: [],
    known_costs: [],
    blocked_by: [],
    communication: {
      schema_version: "cc1-bounded-communication-action-v1",
      channel,
      addressee: plan.addressee,
      expression_mode: plan.mode,
      message: publicMessage,
      surface_realization_complete: false,
      private_purpose_exposed: false,
      withheld_private_content_exposed: false,
      world_truth_claimed: false,
    },
  });
}
