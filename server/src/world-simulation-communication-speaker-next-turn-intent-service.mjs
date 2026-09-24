import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationSpeakerNextTurnIntentVersion =
  "cc7q-speaker-scoped-next-turn-intent-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
function fail(message) {
  const error = new Error(message);
  error.code = "CC7Q_SPEAKER_NEXT_TURN_INTENT_INVALID";
  throw error;
}
function bounded(value, label) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 240)
    fail(`${label} must be bounded nonblank text.`);
  return value.trim();
}
function exact(value, allowed, label) {
  if (!record(value) || Object.keys(value).some((field) => !allowed.includes(field)))
    fail(`${label} contains non-contract fields.`);
}
function hash(value, prefix) {
  return `${prefix}_${hashAgentRunValue(value).slice(0, 24)}`;
}
const modes = new Set([
  "nominate_addressee", "yield_open_floor", "retain_turn",
]);
export function buildWorldSimulationSpeakerNextTurnIntentContract() {
  return {
    version: worldSimulationSpeakerNextTurnIntentVersion,
    source: "post_causal_selected_emitted_speech_outcome_only",
    caller_must_install_speaker_scoped_resolver: true,
    one_speaker_action_per_resolver_view: true,
    addressee_is_not_automatic_nomination: true,
    speech_act_is_not_automatic_nomination: true,
    acoustic_segment_end_is_not_floor_handoff: true,
    nomination_requires_explicit_same_speaker_choice: true,
    nomination_target_limited_to_public_addressee_here: true,
    yield_open_floor_does_not_select_next: true,
    silence_and_resolver_absence_are_legal: true,
    private_speech_content_forwarded_to_resolver: false,
    speaker_identity_forwarded_to_other_observers: false,
    audit_contains_surface_or_semantic_text: false,
    intention_is_post_causal_precommit: true,
    actual_public_invitation_emitted: false,
    actual_floor_awarded: false,
    next_speaker_selected_by_world: false,
    overlapping_speech_started: false,
    interruption_judged: false,
    grounding_or_belief_changed: false,
    world_action_replanned: false,
    fixed_gap_threshold_used: false,
  };
}

/**
 * Separate explicit speaker-side intention from listener CC-7O/7P guesses.
 * Only a selected emission's public speaker/addressee/action identity enters
 * the resolver; it never receives another character's private interpretation,
 * hidden speech content or future increments. The output is tentative World
 * evidence and never an actual floor award or an emitted invitation.
 */
export async function runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes = [],
  resolver = null,
} = {}) {
  if (!Array.isArray(action_outcomes) || action_outcomes.length > 4096)
    fail("action_outcomes must be a bounded list.");
  if (resolver !== null && typeof resolver !== "function")
    fail("resolver must be an optional speaker-scoped function.");
  const candidates = [];
  const seen = new Set();
  for (const outcome of action_outcomes) {
    // CC-1 speech without CC-5 realized surface is valid legacy World
    // communication, but not yet eligible for this CC-7Q speech-bound hook.
    if (outcome?.result !== "communication_emitted"
        || outcome.communication_event?.channel !== "speech"
        || outcome.communication_event?.surface_realization_complete !== true)
      continue;
    const event = outcome.communication_event;
    const actor = bounded(outcome.actor, "actor");
    const addressee = bounded(event.addressee, "addressee");
    const actionId = bounded(outcome.action_id, "action_id");
    if (actor === addressee
        || event.schema_version !== "cc1-world-communication-event-v1"
        || event.actor !== actor
        || event.surface_realization_complete !== true
        || !record(event.surface_realization)
        || event.surface_realization.source_action_id !== actionId
        || typeof event.surface_text !== "string"
        || !event.surface_text.trim()
        || event.surface_realization.surface_text !== event.surface_text
        || typeof outcome.duration_ms !== "number"
        || !Number.isFinite(outcome.duration_ms)
        || outcome.duration_ms <= 0)
      fail("CC-7Q requires an internally linked emitted realized speech outcome.");
    if (seen.has(actionId))
      fail("Duplicate selected speech action in CC-7Q.");
    seen.add(actionId);
    candidates.push({ actor, addressee, action_id: actionId });
  }
  candidates.sort((a, b) =>
    a.action_id.localeCompare(b.action_id, "en")
    || a.actor.localeCompare(b.actor, "en"));
  const intents = [];
  const audit = [];
  for (const source of candidates) {
    if (!resolver) continue;
    const view = {
      schema_version: worldSimulationSpeakerNextTurnIntentVersion,
      actor: source.actor,
      source_action_id: source.action_id,
      current_public_addressee: source.addressee,
      world_turn_status: "post_causal_precommit",
      boundaries: buildWorldSimulationSpeakerNextTurnIntentContract(),
    };
    const decision = await resolver(copy(view));
    if (decision == null) continue;
    exact(decision, ["mode", "target"], "speaker decision");
    const mode = bounded(decision.mode, "mode");
    if (!modes.has(mode)) fail("Unsupported speaker next-turn intent.");
    const target = decision.target == null ? null :
      bounded(decision.target, "target");
    if (mode === "nominate_addressee"
        ? target !== source.addressee
        : target !== null)
      fail("Only explicit nomination of this speech's addressee is supported.");
    const identity = {
      version: worldSimulationSpeakerNextTurnIntentVersion,
      actor: source.actor,
      action_id: source.action_id,
      addressee: source.addressee,
      mode, target,
    };
    const id = hash(identity, "speaker_next_turn_intent");
    intents.push({
      schema_version: worldSimulationSpeakerNextTurnIntentVersion,
      intention_id: id,
      actor: source.actor,
      source_action_id: source.action_id,
      mode,
      intended_next_speaker: target,
      source_addressee: source.addressee,
      provisional_only: true,
      world_floor_awarded: false,
      public_invitation_emitted: false,
      world_action_replanned: false,
    });
    audit.push({
      intention_ref: id,
      source_action_ref: hash({
        version: worldSimulationSpeakerNextTurnIntentVersion,
        action_id: source.action_id,
      }, "source_action"),
      actor_ref: hash({
        version: worldSimulationSpeakerNextTurnIntentVersion,
        actor: source.actor,
      }, "speaker"),
      target_ref: target === null ? null : hash({
        version: worldSimulationSpeakerNextTurnIntentVersion,
        actor: source.actor, target,
      }, "target"),
      mode,
      provisional_only: true,
      world_floor_awarded: false,
      public_invitation_emitted: false,
      world_action_replanned: false,
    });
  }
  return copy({
    audit: {
      schema_version: worldSimulationSpeakerNextTurnIntentVersion,
      status: resolver ? "speaker_provisional_intentions_only"
        : "resolver_not_installed",
      eligible_emitted_speech_count: candidates.length,
      decision_count: audit.length,
      nomination_count: audit.filter((e) =>
        e.mode === "nominate_addressee").length,
      open_floor_yield_count: audit.filter((e) =>
        e.mode === "yield_open_floor").length,
      retain_turn_count: audit.filter((e) =>
        e.mode === "retain_turn").length,
      decisions: audit,
      boundaries: buildWorldSimulationSpeakerNextTurnIntentContract(),
    },
    engine_private_intentions: intents,
  });
}

export default runWorldSimulationSpeakerNextTurnIntent;
