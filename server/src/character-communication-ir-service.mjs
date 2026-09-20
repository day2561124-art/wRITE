export const characterCommunicationIrVersion = "character-communication-ir-v1";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const text = (value, limit = 600) =>
  typeof value === "string" && value.trim() && [...value.trim()].length <= limit
    ? value.trim()
    : null;

function fail(message) {
  const error = new Error(message);
  error.code = "CHARACTER_COMMUNICATION_IR_INVALID";
  throw error;
}

/**
 * Builds the shared semantic contract between speaker planning, world signals,
 * and later listener interpretation. It deliberately does not realize Chinese,
 * infer a listener's private state, or assert world truth.
 */
export function buildCharacterCommunicationIr(plan = {}, options = {}) {
  if (!isRecord(plan)) fail("Communication plan must be structured.");
  const speaker = text(plan.character, 240);
  const addressee = text(plan.addressee, 240);
  const purpose = text(plan.purpose, 240);
  const mode = text(plan.mode, 40);
  if (!speaker || !addressee || speaker === addressee || !purpose || !mode)
    fail("Speaker, distinct addressee, purpose, and expression mode are required.");

  const sourceMessage = isRecord(plan.message) ? plan.message : {};
  const channel = plan.external_action === "speech"
    ? "speech"
    : plan.external_action === "nonverbal_signal"
      ? "nonverbal"
      : "none";
  const semanticContent = text(sourceMessage.semantic_content);
  const signalIntent = text(sourceMessage.signal_intent, 240);
  const speechAct = text(sourceMessage.speech_act, 120);
  const epistemicStatus = text(sourceMessage.epistemic_status, 120);
  const epistemicSource = text(sourceMessage.source, 600);
  const indirect = sourceMessage.addressee_must_infer_indirect_intention === true;
  const withheld = text(plan.withheld_private_content);
  const publicOnly = options.publicOnly === true;

  return copy({
    schema_version: characterCommunicationIrVersion,
    participants: {
      speaker,
      intended_addressees: [addressee],
    },
    communicative_goal: {
      purpose: publicOnly ? null : purpose,
      expression_mode: mode,
    },
    content: {
      semantic_content: semanticContent,
      speech_act: speechAct,
      epistemic: {
        status: epistemicStatus,
        source: publicOnly ? null : epistemicSource,
        world_truth_claimed: false,
      },
    },
    disclosure: {
      withheld_private_content: publicOnly ? null : withheld,
      withheld_content_exposed: false,
      private_purpose_exposed: false,
    },
    pragmatics: {
      indirect,
      intended_effect: indirect && !publicOnly ? purpose : null,
      listener_inference_required: indirect,
    },
    modalities: {
      speech: channel === "speech"
        ? { intended_meaning: semanticContent, surface_realization_complete: false }
        : null,
      nonverbal: channel === "nonverbal"
        ? { intended_meaning: signalIntent, surface_realization_complete: false }
        : null,
    },
    interaction: {
      repair_of: null,
      response_to: null,
      grounding_status: "not_yet_observed",
    },
    boundaries: {
      speaker_intended_meaning_only: true,
      observable_signal_authored: false,
      listener_inferred_meaning_authored: false,
      listener_private_state_inferred: false,
      world_truth_claimed: false,
    },
  });
}
