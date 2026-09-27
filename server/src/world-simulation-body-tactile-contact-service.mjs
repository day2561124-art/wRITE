import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyTactileContactVersion =
  "body-1c-committed-grasp-contact-v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function items(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function actorName(value) { return typeof value === "string" ? value.trim() : ""; }

// A selected pickup is only an intention. Contact requires a committed
// outcome, its holder transition, current ownership and a functional receptor.
export function projectWorldSimulationBodyTactileContact({
  world_state, world_history, world_state_revision, character,
} = {}) {
  const actor = actorName(character);
  if (!actor) fail("BODY1C_CHARACTER_REQUIRED");
  const state = record(world_state);
  if (!Object.hasOwn(record(state.characters), actor))
    fail("BODY1C_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1C_REVISION_REQUIRED");
  const turns = items(record(world_history).turns);
  const turn = record(turns.at(-1));
  if (world_state_revision > 0 && turn.revision_to !== world_state_revision)
    fail("BODY1C_HISTORY_REVISION_MISMATCH");
  const receptor = record(record(record(state.characters)[actor]).physical_state);
  const available = record(receptor.tactile_reception).hand_contact_functional === true;
  const contacts = [];
  if (available) for (const selected of items(turn.selected_action_intents)) {
    if (selected?.character !== actor || selected.selection === "reject_all") continue;
    const candidate = record(selected.candidate);
    const interaction = record(candidate.object_interaction);
    const objectId = actorName(interaction.object_id);
    const actionId = actorName(candidate.action_id);
    if (interaction.type !== "pickup" || !objectId || !actionId
        || selected.action_id !== actionId) continue;
    const outcome = items(turn.action_outcomes).find((entry) =>
      entry?.actor === actor && entry.action_id === actionId);
    const transition = items(turn.state_transitions).find((entry) =>
      entry?.entity === objectId && entry.field === "holder"
        && entry.to === actor && entry.action_id === actionId);
    if (outcome?.result !== "pickup_completed" || !transition
        || record(record(state.objects)[objectId]).holder !== actor) continue;
    const contactRef = hashAgentRunValue({
      version: worldSimulationBodyTactileContactVersion,
      actor, actionId, revision: world_state_revision,
    }).slice(0, 32);
    contacts.push({
      modality: "cutaneous_contact",
      signal: "hand_contact_detected",
      contact_ref: `contact_${contactRef}`,
      source_action_id: actionId,
      source_world_revision: world_state_revision,
      material_identity_asserted: false,
      texture_asserted: false,
      temperature_asserted: false,
      pain_asserted: false,
    });
  }
  return {
    version: worldSimulationBodyTactileContactVersion,
    authority: "committed_world_contact_and_body_receptor",
    character: actor,
    source_world_revision: world_state_revision,
    receptor_status: available ? "available" : "unavailable",
    tactile_signals: contacts,
    boundaries: {
      intention_is_not_contact: true,
      world_outcome_alone_is_not_body_signal: true,
      body_receptor_required: true,
      object_identity_exposed: false,
      subjective_touch_asserted: false,
    },
  };
}

export async function readCommittedWorldSimulationBodyTactileContact({
  session_id, character, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1C_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1C_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1C_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1C_HISTORY_STATE_MISMATCH");
  return {
    ...projectWorldSimulationBodyTactileContact({
      world_state: first.state, world_history: history,
      world_state_revision: first.revision, character,
    }),
    world_state_hash: first.state_hash,
  };
}

export function buildWorldSimulationBodyTactileContactContract() {
  return {
    version: worldSimulationBodyTactileContactVersion,
    source: "committed_world_contact_and_body_receptor",
    read_only: true,
    objective_contact_requires_pickup_outcome_transition_and_holder: true,
    hand_receptor_required_for_signal: true,
    object_identity_exposed: false,
    subjective_touch_asserted: false,
  };
}
