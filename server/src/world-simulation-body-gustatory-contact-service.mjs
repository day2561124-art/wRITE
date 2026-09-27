import { getWorldSimulationHistory, getWorldSimulationState } from "./world-simulation-state-service.mjs";

export const worldSimulationBodyGustatoryContactVersion =
  "body-1g-committed-gustatory-contact-v1";
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const items = (value) => Array.isArray(value) ? value : [];
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function name(value) { return typeof value === "string" ? value.trim() : ""; }
function safeLabel(item, actor) {
  const label = record(item.gustatory_labels_by)[actor]
    ?? item.generic_gustatory_label;
  return typeof label === "string" && label.trim()
    ? label.trim().slice(0, 160) : "unidentified_taste";
}

// A selected action, a pickup, or a held object alone never proves oral contact.
// Only the world-adjudicated committed contact outcome opens this evidence path.
export function projectWorldSimulationBodyGustatoryContact({
  world_state, world_history, world_state_revision, character,
} = {}) {
  const actor = name(character);
  if (!actor) fail("BODY1G_CHARACTER_REQUIRED");
  const state = record(world_state);
  if (!Object.hasOwn(record(state.characters), actor))
    fail("BODY1G_CHARACTER_NOT_IN_WORLD");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1G_REVISION_REQUIRED");
  const turn = record(items(record(world_history).turns).at(-1));
  if (world_state_revision > 0 && turn.revision_to !== world_state_revision)
    fail("BODY1G_HISTORY_REVISION_MISMATCH");
  const physical = record(record(state.characters[actor]).physical_state);
  const available = record(physical.gustatory_reception).oral_contact_functional === true
    && physical.unconscious !== true && physical.incapacitated !== true;
  const observations = [];
  if (available) for (const selected of items(turn.selected_action_intents)) {
    if (selected?.character !== actor || selected.selection !== "candidate_action_intent")
      continue;
    const candidate = record(selected.candidate);
    const objectId = name(record(candidate.gustatory_sampling).object_id);
    const actionId = name(candidate.action_id);
    if (!objectId || !actionId || selected.action_id !== actionId) continue;
    const item = record(record(state.objects)[objectId]);
    const outcome = items(turn.action_outcomes).find((entry) =>
      entry?.actor === actor && entry.action_id === actionId
      && entry.result === "gustatory_contact_completed"
      && entry.sampled_object_id === objectId
      && entry.ingestion_asserted === false);
    if (!outcome || item.holder !== actor
      || record(item.gustatory_profile).sampleable !== true) continue;
    observations.push({
      sense: "gustatory", kind: "oral_contact_taste",
      perceptual_label: safeLabel(item, actor),
      source_world_revision: world_state_revision,
      ingestion_asserted: false,
      nutrition_asserted: false,
      subjective_preference_asserted: false,
    });
  }
  return {
    version: worldSimulationBodyGustatoryContactVersion,
    authority: "committed_world_oral_contact_and_body_receptor",
    character: actor, source_world_revision: world_state_revision,
    receptor_status: available ? "available" : "unavailable",
    gustatory_observations: observations,
    boundaries: {
      intention_is_not_oral_contact: true,
      holding_is_not_oral_contact: true,
      committed_world_contact_required: true,
      receptor_required: true,
      engine_object_id_exposed: false,
      ingestion_or_nutrition_inferred: false,
      subjective_liking_inferred: false,
    },
  };
}
export async function readCommittedWorldSimulationBodyGustatoryContact({
  session_id, character, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1G_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1G_STATE_HASH_CHANGED");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1G_COMMITTED_SNAPSHOT_CHANGED");
  const last = items(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1G_HISTORY_STATE_MISMATCH");
  return {
    ...projectWorldSimulationBodyGustatoryContact({
      world_state: first.state, world_history: history,
      world_state_revision: first.revision, character,
    }),
    world_state_hash: first.state_hash,
  };
}
export function buildWorldSimulationBodyGustatoryContactContract() {
  return {
    version: worldSimulationBodyGustatoryContactVersion,
    source: "committed_world_oral_contact_and_body_receptor",
    read_only: true,
    world_adjudicated_oral_contact_required: true,
    explicitly_sampleable_held_object_required: true,
    receptor_required: true,
    ingestion_modeled: false, nutrition_modeled: false,
    brain_receives_engine_object_id: false,
  };
}
