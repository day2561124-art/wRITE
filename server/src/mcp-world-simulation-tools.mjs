import {
  useWorldSimulationCapability,
} from "./world-simulation-session-service.mjs";
import {
  beginFormalWorldSimulationSession,
  prepareFormalWorldSimulationTurn,
  resolveFormalWorldSimulationTurn,
  submitFormalWorldSimulationCharacterAction,
} from "./world-simulation-formal-turn-transport-service.mjs";
import {
  createWorldSimulationPreparedTurnBrokerIpcClient,
} from "./world-simulation-prepared-turn-broker-ipc.mjs";
import {
  worldSimulationCommonPermissions,
} from "./world-simulation-neural-service.mjs";

export const worldSimulationFormalMcpPublicAdoptionVersion =
  "phase62a-r1-step4b2-formal-mcp-public-adoption-v1";

// An HTTP-spawned mcp-server has a dedicated Node IPC channel. Capture that
// parent broker transport once for the child lifetime. If the parent later
// disconnects, the client fails closed rather than falling back to child-local
// prepared-turn memory.
const parentPreparedTurnBrokerIpcClient =
  typeof process.send === "function"
    ? createWorldSimulationPreparedTurnBrokerIpcClient()
    : null;

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    architecture_route: "chatgpt_owned_world_simulation",
    blocked: true,
    blocked_reason: error instanceof Error ? error.message : String(error),
    blocked_code: error?.code ?? null,
    mutation_guards: { ...worldSimulationCommonPermissions },
  };
}



function formalBlocked(toolName, error) {
  const errorCode =
    typeof error?.code === "string" && error.code
      ? error.code
      : "WORLD_SIMULATION_FORMAL_TRANSPORT_BLOCKED";
  return {
    ok: false,
    tool_name: toolName,
    architecture_route: "chatgpt_owned_world_simulation",
    blocked: true,
    blocked_reason: errorCode,
    blocked_code: errorCode,
    mutation_guards: { ...worldSimulationCommonPermissions },
  };
}

function preparedTurnBrokerOptions(options = {}) {
  if (options.preparedTurnBroker || !parentPreparedTurnBrokerIpcClient) {
    return options;
  }
  return {
    ...options,
    preparedTurnBroker: parentPreparedTurnBrokerIpcClient,
  };
}

function formalPublicAdoptionSurface(result = {}) {
  const httpParentBrokerAdoptionInstalled =
    Boolean(parentPreparedTurnBrokerIpcClient);
  return {
    ...result,
    formal_mcp_public_adoption_version:
      worldSimulationFormalMcpPublicAdoptionVersion,
    mcp_public_adoption_installed: true,
    http_parent_broker_adoption_installed:
      httpParentBrokerAdoptionInstalled,
    prepared_turn_transport_scope:
      httpParentBrokerAdoptionInstalled
        ? "mcp_http_parent_process_ephemeral_memory"
        : "process_local_ephemeral_memory",
    ...(result?.boundaries && typeof result.boundaries === "object"
      ? {
        boundaries: {
          ...result.boundaries,
          mcp_public_adoption_installed: true,
          http_parent_broker_adoption_installed:
            httpParentBrokerAdoptionInstalled,
        },
      }
      : {}),
  };
}

export async function chatgpt_bridge_begin_world_simulation_session(
  input = {},
  options = {},
) {
  try {
    return {
      tool_name: "chatgpt_bridge_begin_world_simulation_session",
      ...formalPublicAdoptionSurface(
        await beginFormalWorldSimulationSession(input, options),
      ),
      blocked: false,
      blocked_reason: null,
    };
  } catch (error) {
    return formalBlocked("chatgpt_bridge_begin_world_simulation_session", error);
  }
}

function formalTurnTool(toolName, invoke) {
  return async (input = {}, options = {}) => {
    try {
      return {
        tool_name: toolName,
        ...formalPublicAdoptionSurface(
          await invoke(
            input,
            preparedTurnBrokerOptions(options),
          ),
        ),
        blocked: false,
        blocked_reason: null,
      };
    } catch (error) {
      return formalBlocked(toolName, error);
    }
  };
}

export const chatgpt_bridge_prepare_world_turn = formalTurnTool(
  "chatgpt_bridge_prepare_world_turn",
  prepareFormalWorldSimulationTurn,
);

export const chatgpt_bridge_submit_world_character_action = formalTurnTool(
  "chatgpt_bridge_submit_world_character_action",
  submitFormalWorldSimulationCharacterAction,
);

export const chatgpt_bridge_resolve_world_turn = formalTurnTool(
  "chatgpt_bridge_resolve_world_turn",
  resolveFormalWorldSimulationTurn,
);

// Individual world capabilities remain available to the full/debug MCP profile
// for diagnostics and compatibility. They are not the formal chatgpt_public
// world-simulation mainline after Step4B-2.
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
