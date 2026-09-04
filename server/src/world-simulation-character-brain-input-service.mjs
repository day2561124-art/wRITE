export const worldSimulationCharacterBrainInputVersion =
  "character-runtime-v3-recollection-single-exposure-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function isRecoveredMemoryMindItem(value) {
  return isObject(value)
    && value.context_origin === "recovered_memory";
}

function withoutRecoveredMemoryAttentionDuplicates(attention) {
  if (!isObject(attention)) return cloneJson(attention ?? null);
  const projected = cloneJson(attention);
  if (isRecoveredMemoryMindItem(projected.focus)) {
    projected.focus = null;
  }
  for (const key of [
    "active_context",
    "peripheral_context",
    "fading_context",
    "suspended_context",
  ]) {
    if (!Object.hasOwn(projected, key)) continue;
    projected[key] = array(projected[key])
      .filter((item) => !isRecoveredMemoryMindItem(item));
  }
  return projected;
}

function characterBrainCognition(packet, recollectionV3) {
  const cognition = isObject(packet.cognition)
    ? cloneJson(packet.cognition)
    : {};
  if (!recollectionV3) return cognition;

  if (!isObject(cognition.working_context)) {
    const error = new Error(
      "Character Runtime v3 recollection ingress requires Runtime-owned cognition.working_context.",
    );
    error.code = "WORLD_SIMULATION_RECOLLECTION_CURRENT_MIND_REQUIRED";
    throw error;
  }

  // Phase63C recovered content may exist in several internal plumbing layers,
  // but Character Brain sees that semantic content only through the Runtime
  // Current Mind working context. Retrieval process state remains top-level.
  delete cognition.recovered_memories;
  delete cognition.retrieved_memories;
  delete cognition.projected_memories;
  delete cognition.retrieval_experience;
  if (Object.hasOwn(cognition, "attention")) {
    cognition.attention = withoutRecoveredMemoryAttentionDuplicates(
      cognition.attention,
    );
  }
  return cognition;
}

export function buildWorldSimulationCharacterBrainInput(
  decisionPacket = {},
  options = {},
) {
  const packet = isObject(decisionPacket)
    ? decisionPacket
    : {};
  const recollectionV3 =
    packet.boundaries?.recollection_reinstatement_v3_installed === true;

  const input = {
    character:
      packet.character
      ?? null,

    perception:
      cloneJson(
        packet.perception
        ?? {},
      ),

    ...(
      recollectionV3
        ? {}
        : {
            recovered_memories:
              cloneJson(
                packet.recovered_memories
                ?? [],
              ),
          }
    ),

    retrieval_experience:
      cloneJson(
        packet.retrieval_experience
        ?? {
          process_occurred: false,
          initiation_mode: null,
          target_outcome: null,
          recovered_any_content: false,
        },
      ),

    cognition:
      characterBrainCognition(packet, recollectionV3),

    candidate_action_intents:
      cloneJson(
        packet.candidate_action_intents
        ?? [],
      ),

    boundaries:
      cloneJson(
        packet.boundaries
        ?? {},
      ),
  };

  // Historical compatibility aliases are never allowed to bypass v3's
  // single-semantic-exposure gate. Callers without the v3 packet boundary
  // retain the old explicit opt-in behavior.
  if (!recollectionV3
    && options.include_legacy_retrieved_memories_alias === true) {
    input.retrieved_memories =
      cloneJson(
        packet.recovered_memories
        ?? [],
      );
  }

  return input;
}
