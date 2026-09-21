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

// A speaker may imply a withheld idea without literally disclosing it.
// Check only explicitly withheld text in the public semantic payload; do not
// attempt a semantic lie detector or inspect private implied meanings.
function guardLiteralDisclosure(publicContent, withheld) {
  if (withheld && publicContent?.includes(withheld))
    fail("Public expression contains explicitly withheld private content.");
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

// This is a consumer gate, not a producer of speech intelligibility.
// The existing acoustic query only establishes that a sound is audible.
// A future authoritative World listener projection must explicitly attest
// comprehension and source recognition in this observer-scoped packet.
function admittedUnderstoodTestimony(perception, character, intent, content) {
  const scoped = isRecord(perception) ? perception : {};
  if (scoped.character !== character) return null;
  if (scoped.information_boundary?.listener_receipt_verified !== true) return null;
  const index = list(scoped.audible).slice(0, 32).findIndex((item) =>
    isRecord(item)
    && item.schema_version === "cc2-listener-understood-utterance-v1"
    && item.kind === "understood_utterance"
    && item.observer === character
    && item.channel === "speech"
    && item.speaker === intent.speaker
    && item.semantic_content === content
    && item.source_action_id === intent.source_action_id
    && item.speech_content_intelligible === true
    && item.speaker_identity_recognized === true
    && item.public_event_committed === true
  );
  return index < 0 ? null : {
    sourceRef: `perception.audible[${index}]`,
    item: scoped.audible[index],
  };
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
  // CC-3: pragmatic/disclosure planning remains an explicit same-character
  // cognition decision. These fields describe what the speaker is trying to
  // make inferable or socially manageable; they never predict what a listener
  // actually understands, believes, or does. The IR owns validation and
  // bounded normalization of this optional context.
  const irContext = isRecord(goal.communication_context)
    ? copy(goal.communication_context) : null;
  if (mode === "silence") {
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "none",
      message: null,
      withheld_private_content: withheld,
      ...(irContext ? { ir_context: irContext } : {}),
      other_character_goal_inferred: false,
      world_truth_claimed: false,
    });
  }
  if (mode === "nonverbal") {
    const signal = string(goal.nonverbal_signal, 120);
    if (!signal) fail("Nonverbal expression needs character-authored signal intent.");
    guardLiteralDisclosure(signal, withheld);
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "nonverbal_signal",
      message: { signal_intent: signal, semantic_content: null },
      withheld_private_content: withheld,
      ...(irContext ? { ir_context: irContext } : {}),
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
    guardLiteralDisclosure(content, withheld);

    // CC-2: a declared factual assertion or uncertain hypothesis must be
    // grounded in the same character's accessible cognition. A communication
    // goal alone authorizes an intention/request, not a new factual claim.
    const claimKind = goal.claim_kind == null ? null : string(goal.claim_kind, 40);
    if (goal.claim_kind != null
      && !["sincere_assertion", "uncertain_hypothesis", "deliberate_deception",
        "explicit_assumption", "attributed_testimony"].includes(claimKind))
      fail("Unsupported or ungrounded communication claim kind.");
    // A testimony report attributes an understood utterance to its speaker.
    // It neither adopts the proposition nor infers the speaker's belief.
    const testimony = claimKind === "attributed_testimony"
      ? goal.testimony_intent : null;
    if (goal.testimony_intent != null && claimKind !== "attributed_testimony")
      fail("A testimony intention requires its explicit claim kind.");
    if (claimKind === "attributed_testimony"
      && (!isRecord(testimony)
        || !string(testimony.speaker, 240)
        || testimony.speaker === character
        || string(testimony.reported_content) !== content
        || typeof testimony.source_action_id !== "string"
        || !/^communication_[a-f0-9]{24}$/.test(testimony.source_action_id)))
      fail("Testimony requires a speaker-authored exact attributed report and action reference.");
    // A supposition is an explicitly framed speech act, not a newly known
    // fact, a recollection, or an uncertain report masquerading as evidence.
    // The speaker commits only to proposing the hypothetical, not its truth.
    const assumption = claimKind === "explicit_assumption"
      ? goal.assumption_intent : null;
    if (goal.assumption_intent != null && claimKind !== "explicit_assumption")
      fail("An assumption intention requires its explicit claim kind.");
    if (claimKind === "explicit_assumption"
      && (!isRecord(assumption)
        || string(assumption.addressee, 240) !== addressee
        || string(assumption.hypothetical_content) !== content
        || assumption.speaker_intends_hypothetical_frame !== true
        || assumption.not_asserted_as_fact !== true))
      fail("Assumption requires a matched speaker-authored hypothetical frame.");
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
      && !["retrieved_memory", "current_perception", "subjective_inference",
        "understood_testimony"].includes(sourceKind))
      fail("Unsupported communication claim source.");
    if (claimKind === "attributed_testimony" && sourceKind !== "understood_testimony")
      fail("Attributed testimony requires an explicitly understood listener source.");
    if (sourceKind === "understood_testimony" && claimKind !== "attributed_testimony")
      fail("A listener receipt only grounds an attributed testimony report.");
    if (sourceKind != null && sourceKind !== "understood_testimony"
      && claimKind !== "uncertain_hypothesis")
      fail("A sensory, recollection or inferential source can ground only an explicitly uncertain claim.");
    // A subjective inference is a character-authored relation to a premise,
    // not an engine-proven entailment. Never derive its premise from raw World,
    // Memory catalogs, the generator, or another person's cognition.
    const inference = sourceKind === "subjective_inference"
      ? goal.inference_intent : null;
    if (sourceKind === "subjective_inference"
      && (!isRecord(inference)
        || string(inference.conclusion) !== content
        || !string(inference.premise_content)
        || !["known", "uncertain"].includes(inference.premise_epistemic_status)
        || inference.premise_relation !== "supports"))
      fail("Subjective inference requires an actor-authored conclusion and bounded premise relation.");
    const inferenceCollection = inference?.premise_epistemic_status;
    const inferenceIndex = inference
      ? list(cognition[inferenceCollection]).findIndex(
        (value) => value === inference.premise_content,
      ) : -1;
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
    const receipt = sourceKind === "understood_testimony"
      ? admittedUnderstoodTestimony(perceived, character, testimony, content) : null;
    const sourceCollection = claimKind === "sincere_assertion"
      ? "known" : "uncertain";
    const sourceIndex = claimKind == null || sourceKind != null
      || claimKind === "explicit_assumption"
      ? -1
      : list(cognition[sourceCollection]).findIndex((value) => value === content);
    if (claimKind && (claimKind === "explicit_assumption"
      ? false
      : claimKind === "attributed_testimony"
        ? !receipt
      : claimKind === "deliberate_deception"
        ? contraryIndex < 0
        : sourceKind === "subjective_inference"
          ? inferenceIndex < 0
          : sourceIndex < 0 && !recollection && !percept)) {
      return copy({
        version: characterCommunicationFoundationVersion,
        character, addressee, purpose, mode,
        external_action: "none",
        message: null,
        blocked_reason: claimKind === "attributed_testimony"
          ? "testimony_not_in_same_character_verified_listener_receipt"
          : claimKind === "deliberate_deception"
            ? "deception_contrary_basis_not_in_same_character_known"
            : sourceKind === "subjective_inference"
            ? "inference_premise_not_in_same_character_accessible_cognition"
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
    const sourceRef = claimKind === "attributed_testimony"
      ? receipt.sourceRef
      : claimKind === "explicit_assumption"
        ? "cognition.communication_goal"
        : claimKind === "deliberate_deception"
        ? `cognition.known[${contraryIndex}]`
        : inference
          ? `cognition.${inferenceCollection}[${inferenceIndex}]`
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
        : claimKind === "attributed_testimony"
          ? "speaker_attributed_report"
          : claimKind === "deliberate_deception"
            ? "speaker_asserted"
            : claimKind === "explicit_assumption"
              ? "speaker_hypothetical"
              : "speaker_intention";
    return copy({
      version: characterCommunicationFoundationVersion,
      character, addressee, purpose, mode,
      external_action: "speech",
      message: {
        speech_act: claimKind === "attributed_testimony"
          ? "report_testimony"
          : claimKind === "explicit_assumption"
            ? "suppose" : claimKind ? "assert" : "inform_or_request",
        semantic_content: content,
        epistemic_status: epistemicStatus,
        ...(receipt ? { reported_speaker: testimony.speaker } : {}),
        source: sourceRef,
        ...(claimKind ? {
          claim_provenance: {
            schema_version: "cc2-speaker-claim-provenance-v1",
            claim_kind: claimKind,
            source_kind: receipt
              ? "same_character_understood_testimony_receipt"
              : claimKind === "explicit_assumption"
                ? "same_character_explicit_hypothetical_goal"
                : claimKind === "deliberate_deception"
                  ? "same_character_contrary_known_basis"
                  : inference
                  ? "same_character_subjective_inference"
                  : recollection
                    ? "admitted_recollection_current_mind"
                    : percept
                      ? "same_character_current_perception"
                      : "same_character_accessible_cognition",
            source_ref: sourceRef,
            epistemic_status: epistemicStatus,
            ...(receipt ? {
              reported_speaker: testimony.speaker,
              reported_content: content,
              receipt_action_id: testimony.source_action_id,
              listener_understanding_attested: true,
              reported_content_truth_inferred: false,
              speaker_private_belief_inferred: false,
            } : {}),
            ...(assumption ? {
              hypothetical_content: content,
              speaker_authored_hypothetical_frame: true,
              proposition_accepted_as_fact: false,
              inference_or_evidence_claimed: false,
            } : {}),
            ...(inference ? {
              premise_content: inference.premise_content,
              premise_epistemic_status: inference.premise_epistemic_status,
              premise_relation: "speaker_authored_supports",
              conclusion: content,
              semantic_entailment_verified: false,
              inference_confidence_inferred: false,
            } : {}),
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
      ...(irContext ? { ir_context: irContext } : {}),
      other_character_goal_inferred: false,
      world_truth_claimed: false,
    });
  }
  if (!basis) fail("Indirect communication requires an explicit semantic basis.");
  guardLiteralDisclosure(basis, withheld);
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
    ...(irContext ? { ir_context: irContext } : {}),
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
        ...(sourceMessage.reported_speaker
          ? { reported_speaker: sourceMessage.reported_speaker } : {}),
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
