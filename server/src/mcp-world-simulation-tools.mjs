import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "./world-simulation-session-service.mjs";
import {
  worldSimulationCommonPermissions,
} from "./world-simulation-neural-service.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    architecture_route: "chatgpt_owned_world_simulation",
    blocked: true,
    blocked_reason: error instanceof Error ? error.message : String(error),
    mutation_guards: { ...worldSimulationCommonPermissions },
  };
}

export async function chatgpt_bridge_begin_world_simulation_session(
  input = {},
  options = {},
) {
  try {
    return {
      tool_name: "chatgpt_bridge_begin_world_simulation_session",
      ...(await beginWorldSimulationSession(input, options)),
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return blocked("chatgpt_bridge_begin_world_simulation_session", error);
  }
}

function capabilityTool(toolName, capabilityName) {
  return async (input = {}, options = {}) => {
    try {
      return {
        tool_name: toolName,
        ...(await useWorldSimulationCapability(
          capabilityName,
          input,
          options,
        )),
        blocked: false,
        blocked_reason: null,
      };
    } catch (error) {
      return blocked(toolName, error);
    }
  };
}

export const chatgpt_bridge_use_world_scene_causal_analyzer = capabilityTool(
  "chatgpt_bridge_use_world_scene_causal_analyzer",
  "world_scene_causal_analyzer",
);
export const chatgpt_bridge_use_world_perception_filter = capabilityTool(
  "chatgpt_bridge_use_world_perception_filter",
  "world_perception_filter",
);
export const chatgpt_bridge_use_world_memory_retriever = capabilityTool(
  "chatgpt_bridge_use_world_memory_retriever",
  "world_memory_retriever",
);
export const chatgpt_bridge_use_world_character_cognition = capabilityTool(
  "chatgpt_bridge_use_world_character_cognition",
  "world_character_cognition",
);
export const chatgpt_bridge_use_world_action_proposer = capabilityTool(
  "chatgpt_bridge_use_world_action_proposer",
  "world_action_proposer",
);
export const chatgpt_bridge_use_world_agency_guard = capabilityTool(
  "chatgpt_bridge_use_world_agency_guard",
  "world_agency_guard",
);
export const chatgpt_bridge_use_world_consistency_critic = capabilityTool(
  "chatgpt_bridge_use_world_consistency_critic",
  "world_consistency_critic",
);
