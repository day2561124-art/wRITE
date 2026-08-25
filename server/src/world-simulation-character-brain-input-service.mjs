export const worldSimulationCharacterBrainInputVersion =
  "phase62a-r1-step4b1-character-brain-input-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function buildWorldSimulationCharacterBrainInput(
  decisionPacket = {},
  options = {},
) {
  const packet = isObject(decisionPacket)
    ? decisionPacket
    : {};

  const input = {
    character:
      packet.character
      ?? null,

    perception:
      cloneJson(
        packet.perception
        ?? {},
      ),

    recovered_memories:
      cloneJson(
        packet.recovered_memories
        ?? [],
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
      cloneJson(
        packet.cognition
        ?? {},
      ),

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

  // Existing direct/native callers retain the historical alias only when
  // they explicitly request it. Formal MCP transport never requests it.
  if (options.include_legacy_retrieved_memories_alias === true) {
    input.retrieved_memories =
      cloneJson(
        packet.recovered_memories
        ?? [],
      );
  }

  return input;
}
