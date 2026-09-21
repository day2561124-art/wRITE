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
  // A direct caller of the shared IR must not bypass the speaker planner's
  // explicit disclosure boundary. Keep intended implications private, but
  // reject a verbatim withheld string inside any public signal payload.
  if (publicOnly && withheld
    && [semanticContent, signalIntent].some((value) => value?.includes(withheld)))
    fail("Public signal contains explicitly withheld private content.");
  // Only speaker-authored, explicitly supplied planning metadata may fill these
  // optional slots. Missing data stays unknown; World and listener state are
  // never reverse-filled from the planner.
  const context = isRecord(plan.ir_context) ? plan.ir_context : {};
  const safeList = (value, label, limit = 16) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > limit) fail(`${label} must be a bounded list.`);
    const normalized = value.map((item) => text(item, 240));
    if (normalized.some((item) => !item) || new Set(normalized).size !== normalized.length)
      fail(`${label} must contain distinct nonblank values.`);
    return normalized;
  };
  const overhearers = safeList(context.possible_overhearers, "possible_overhearers");
  if (overhearers.includes(speaker) || overhearers.includes(addressee))
    fail("Overhearers cannot duplicate speaker or primary addressee.");
  const referenceTargets = safeList(context.reference_targets, "reference_targets");
  const communicativeFunctions = safeList(context.communicative_functions, "communicative_functions");
  const allowedImplications = safeList(context.allowed_implications, "allowed_implications");
  const display = isRecord(context.intentional_display) ? context.intentional_display : {};
  const modulation = isRecord(context.state_dependent_modulation)
    ? context.state_dependent_modulation : {};
  const modalityContext = isRecord(context.modality_meanings) ? context.modality_meanings : {};
  const meaning = (key) => publicOnly ? null : text(modalityContext[key], 600);

  return copy({
    schema_version: characterCommunicationIrVersion,
    participants: {
      speaker,
      intended_addressees: [addressee],
      primary_addressee: addressee,
      possible_overhearers: publicOnly ? [] : overhearers,
    },
    communicative_goal: {
      purpose: publicOnly ? null : purpose,
      expression_mode: mode,
    },
    content: {
      semantic_content: semanticContent,
      event_content: publicOnly ? null : text(context.event_content),
      speech_act: speechAct,
      // Attribution is part of the *public* report; the private listener
      // receipt/action reference is not. No belief or truth is inferred.
      reported_speaker: text(sourceMessage.reported_speaker, 240),
      reference_targets: publicOnly ? [] : referenceTargets,
      information_structure: {
        topic: publicOnly ? null : text(context.topic, 240),
        focus: publicOnly ? null : text(context.focus, 240),
        contrast_set: publicOnly ? [] : safeList(context.contrast_set, "contrast_set"),
      },
      epistemic: {
        status: epistemicStatus,
        subjective_status: publicOnly ? null : text(context.subjective_status, 120),
        certainty: publicOnly ? null : text(context.certainty, 120),
        source: publicOnly ? null : epistemicSource,
        world_truth_claimed: false,
      },
    },
    disclosure: {
      withheld_private_content: publicOnly ? null : withheld,
      allowed_implications: publicOnly ? [] : allowedImplications,
      withheld_content_exposed: false,
      private_purpose_exposed: false,
    },
    pragmatics: {
      indirect,
      intended_effect: indirect && !publicOnly ? purpose : null,
      listener_inference_required: indirect,
      communicative_functions: publicOnly ? [] : communicativeFunctions,
      stance: publicOnly ? null : text(context.stance, 240),
      social_presentation_concern: publicOnly ? null : text(context.social_presentation_concern, 240),
    },
    modalities: {
      speech: channel === "speech"
        ? { intended_meaning: semanticContent, surface_realization_complete: false }
        : null,
      nonverbal: channel === "nonverbal"
        ? { intended_meaning: signalIntent, surface_realization_complete: false }
        : null,
      prosody: meaning("prosody"),
      voice: meaning("voice"),
      gaze: meaning("gaze"),
      face: meaning("face"),
      gesture: meaning("gesture"),
      body: meaning("body"),
      pause: meaning("pause"),
    },
    expression_planning: {
      intentional_display: {
        intended_meaning: publicOnly ? null : text(display.intended_meaning),
        modality: publicOnly ? null : text(display.modality, 120),
        target: publicOnly ? null : text(display.target, 240),
        // A display request is not an observed movement or a World signal.
        realized: false,
      },
      state_dependent_modulation: {
        speaker_state_basis: publicOnly ? null : text(modulation.speaker_state_basis, 240),
        expression_constraint: publicOnly ? null : text(modulation.expression_constraint, 240),
        intended_effect: publicOnly ? null : text(modulation.intended_effect, 240),
        realized: false,
      },
    },
    meaning_layers: {
      speaker_intended_content: semanticContent ?? signalIntent,
      observable_signal: null,
      listener_inferred_meanings: [],
    },
    interaction: {
      repair_of: publicOnly ? null : text(context.repair_of, 240),
      response_to: publicOnly ? null : text(context.response_to, 240),
      grounding_status: "not_yet_observed",
      interaction_id: publicOnly ? null : text(context.interaction_id, 240),
      thread_id: publicOnly ? null : text(context.thread_id, 240),
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
