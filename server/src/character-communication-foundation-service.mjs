import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildCharacterCommunicationIr } from "./character-communication-ir-service.mjs";

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

// The v3/v5 Runtime owns the Current Mind readout. Recovered memories,
// memory-candidate catalogs, and attention compatibility aliases cannot
// independently authorize an utterance about a recollection.
function admittedRecollection(cognition, character, content) {
  const working = isRecord(cognition.working_context)
    ? cognition.working_context : {};
  const entries = [
    ["cognition.working_context.focus", working.focus],
    ...["active_context", "peripheral_context", "fading_context", "suspended_context"]
      .flatMap((key) => list(working[key]).slice(0, 16)
        .map((item, index) => [`cognition.working_context.${key}[${index}]`, item])),
  ];
  for (const [sourceRef, item] of entries) {
    if (!isRecord(item) || item.context_origin !== "recovered_memory"
      || item.content !== content
      || (item.character != null && item.character !== character)) continue;
    return { sourceRef, item };
  }
  return null;
}

// Perception is already scoped to the observer by World. Match only an exact
// current sensory item: hearing a claim is not proof that the claim is true,
// and a hidden scene fact is not a percept.
function currentPerceptionSource(perception, content) {
  const scoped = isRecord(perception) ? perception : {};
  for (const channel of ["observed", "audible", "other_senses"]) {
    const items = list(scoped[channel]).slice(0, 32);
    const index = items.findIndex((item) => item === content);
    if (index >= 0) return {
      sourceRef: `perception.${channel}[${index}]`,
      channel,
    };
  }
  return null;
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

    // CC-2: a declared factual assertion or uncertain hypothesis must be
    // grounded in the same character's accessible cognition. A communication
    // goal alone authorizes an intention/request, not a new factual claim.
    const claimKind = goal.claim_kind == null ? null : string(goal.claim_kind, 40);
    if (goal.claim_kind != null
      && !["sincere_assertion", "uncertain_hypothesis", "deliberate_deception"]
        .includes(claimKind))
      fail("Unsupported or ungrounded communication claim kind.");
    // Deception is an explicit speaker-side act, not a generator license to
    // invent a factual source. These commitments describe the actor's
    // intention and contrary subjective basis, not a semantic truth verdict.
    const deception = claimKind === "deliberate_deception"
      ? goal.deception_intent : null;
    if (claimKind === "deliberate_deception"
      && (!isRecord(deception)
        || deception.intends_addressee_to_believe !== true
        || deception.speaker_regards_claim_as_contrary !== true
        || string(deception.addressee, 240) !== addressee
        || string(deception.target_belief) !== content
        || !string(deception.contrary_known_content)
        || string(deception.contrary_known_content) === content))
      fail("Deliberate deception requires actor-authored contrary belief and addressee intention.");
    const sourceKind = goal.claim_source_kind == null
      ? null : string(goal.claim_source_kind, 40);
    if (goal.claim_source_kind != null
      && !["retrieved_memory", "current_perception"].includes(sourceKind))
      fail("Unsupported communication claim source.");
    if (sourceKind != null && claimKind !== "uncertain_hypothesis")
      fail("A sensory or recollection source can ground only an explicitly uncertain claim.");
    const contraryIndex = claimKind === "deliberate_deception"
      ? list(cognition.known).findIndex(
        (value) => value === deception.contrary_known_content,
      ) : -1;
    const recollection = sourceKind === "retrieved_memory"
      ? admittedRecollection(cognition, character, content) : null;
    // The native action proposer supplies cognition (including its observer-
    // bounded perception), while the Character Brain packet also has a top-
    // level perception view. Prefer the explicit packet view when supplied;
    // never combine it with a potentially stale cognition fallback.
    const perceived = isRecord(characterInput.perception)
      ? characterInput.perception : cognition.perception;
    const percept = sourceKind === "current_perception"
      ? currentPerceptionSource(perceived, content) : null;
    const sourceCollection = claimKind === "sincere_assertion"
      ? "known" : "uncertain";
    const sourceIndex = claimKind == null || sourceKind != null
      ? -1
      : list(cognition[sourceCollection]).findIndex((value) => value === content);
    if (claimKind && (claimKind === "deliberate_deception"
      ? contraryIndex < 0 : sourceIndex < 0 && !recollection && !percept)) {
      return copy({
        version: characterCommunicationFoundationVersion,
        character, addressee, purpose, mode,
        external_action: "none",
        message: null,
        blocked_reason: claimKind === "deliberate_deception"
          ? "deception_contrary_basis_not_in_same_character_known"
          : sourceKind === "retrieved_memory"
            ? "recollection_not_admitted_to_current_mind"
            : sourceKind === "current_perception"
              ? "claim_not_in_same_character_current_perception"
              : "claim_not_in_same_character_accessible_cognition",
        withheld_private_content: withheld,
        other_character_goal_inferred: false,
        world_truth_claimed: false,
      });
    }
    const sourceRef = claimKind === "deliberate_deception"
      ? `cognition.known[${contraryIndex}]`
      : recollection
        ? recollection.sourceRef
        : percept
          ? percept.sourceRef
          : claimKind
            ? `cognition.${sourceCollection}[${sourceIndex}]`
            : "cognition.communication_goal";
    const epistemicStatus = claimKind === "sincere_assertion"
      ? "character_known"
      : claimKind === "uncertain_hypothesis"
        ? "character_uncertain"
        : claimKind === "deliberate_deception"
          ? "speaker_asserted"
          : "speaker_intention";
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "speech",
      message: {
        speech_act: claimKind ? "assert" : "inform_or_request",
        semantic_content: content,
        epistemic_status: epistemicStatus,
        source: sourceRef,
        ...(claimKind ? {
          claim_provenance: {
            schema_version: "cc2-speaker-claim-provenance-v1",
            claim_kind: claimKind,
            source_kind: claimKind === "deliberate_deception"
              ? "same_character_contrary_known_basis"
              : recollection
                ? "admitted_recollection_current_mind"
                : percept
                  ? "same_character_current_perception"
                  : "same_character_accessible_cognition",
            source_ref: sourceRef,
            epistemic_status: epistemicStatus,
            ...(claimKind === "deliberate_deception" ? {
              intended_addressee: addressee,
              intended_target_belief: content,
              contrary_known_content: deception.contrary_known_content,
              actor_authored_contrary_belief: true,
              speaker_intends_to_mislead: true,
              semantic_contradiction_verified: false,
            } : {}),
            ...(recollection ? {
              possibly_incorrect: recollection.item.possibly_incorrect !== false,
              source_confused: recollection.item.source_confused === true,
              recollection_certainty_not_inferred: true,
            } : {}),
            ...(percept ? {
              sensory_channel: percept.channel,
              perception_does_not_establish_world_truth: true,
            } : {}),
            world_truth_claimed: false,
          },
        } : {}),
      },
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
  const communicationIr = buildCharacterCommunicationIr(plan, { publicOnly: true });
  const identity = {
    version: characterCommunicationFoundationVersion,
    character: plan.character,
    addressee: plan.addressee,
    mode: plan.mode,
    channel,
    public_message: publicMessage,
    communication_ir: communicationIr,
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
      ir: communicationIr,
      surface_realization_complete: false,
      private_purpose_exposed: false,
      withheld_private_content_exposed: false,
      world_truth_claimed: false,
    },
  });
}
