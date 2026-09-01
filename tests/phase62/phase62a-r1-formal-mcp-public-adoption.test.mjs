import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import {
  isWorldSimulationMcpToolName,
  summarizeWorldSimulationMcpAuditArguments,
  worldSimulationFormalPublicBlockedTools,
  worldSimulationFormalPublicToolNames,
  worldSimulationLegacyCapabilityToolNames,
  worldSimulationMcpBoundaryVersion,
} from "../../server/src/world-simulation-mcp-boundary-service.mjs";
import {
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const serverPath = path.join(
  rootDir,
  "server",
  "src",
  "mcp-http-server.mjs",
);
const mcpServerPath = path.join(
  rootDir,
  "server",
  "src",
  "mcp-server.mjs",
);

const actor = "羅恩・維薩爾";
const sceneId = "STEP4B2_INTERNAL_SCENE_SECRET";
const eventId = "STEP4B2_INTERNAL_EVENT_SECRET";
const eventMetadataSecret = "STEP4B2_EVENT_METADATA_SECRET";
const unretrievedSecret = "STEP4B2_UNRETRIEVED_MEMORY_SECRET";
const auditSecret = "STEP4B2_MCP_AUDIT_SECRET";

const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  path.join(projectPaths.outputLogs, "transactions"),
  path.join(projectPaths.outputLogs, "mcp_audit_intents"),
];

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewEntries(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(
        path.join(directory, name),
        { recursive: true, force: true },
      );
    }
  }
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer().unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("Unable to reserve HTTP port."));
        return;
      }
      server.close((error) => (
        error
          ? reject(error)
          : resolve(address.port)
      ));
    });
  });
}

async function waitForPort(child, port, readStderr) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `HTTP MCP server exited before readiness.\n${readStderr()}`,
      );
    }
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({
        host: "127.0.0.1",
        port,
      });
      const finish = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(250);
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.once("timeout", () => finish(false));
    });
    if (ready) return;
    await delay(100);
  }
  throw new Error(
    `HTTP MCP readiness timed out.\n${readStderr()}`,
  );
}

async function stopChild(child) {
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function connectClient(port, name) {
  const client = new Client(
    { name, version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
    ),
  );
  return client;
}

function parseToolResult(result) {
  assert.equal(result?.content?.[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

function initialWorldState() {
  return {
    simulation_time: "2026-08-25T17:40:00.000+08:00",
    world_rules: {
      default_movement_speed_mps: 1,
      collision_radius_m: 0.3,
      door_interaction_seconds: 0.5,
      object_interaction_seconds: 0.5,
      attack_attempt_seconds: 0.5,
    },
    event_queue: [{
      event_id: eventId,
      type: "step4b2_internal_event",
      scene_id: sceneId,
      participants: [actor],
      engine_metadata: {
        private_note: eventMetadataSecret,
      },
      memory_retrieval_context: {
        retrieval_goal: {
          kind: "memory_ref",
          memory_id: "step4b2-secret-memory",
        },
      },
    }],
    scenes: {
      [sceneId]: {
        scene_id: sceneId,
        dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: {
          [actor]: { x: 1, y: 1 },
        },
        doors: {
          "gate-a": { open: false, locked: false },
        },
        obstacles: [],
        structures: [],
        observable_by: {
          [actor]: {
            visual: ["gate-a 在前方"],
            audible: ["空調低鳴"],
          },
        },
      },
    },
    characters: {
      [actor]: {
        known: ["自己在訓練室"],
        current_goal: "打開門",
        current_action: "站在門前",
        movement_speed_mps: 1,
        reach_m: 1.25,
      },
    },
    memories: {
      [actor]: [{
        memory_id: "step4b2-secret-memory",
        content: unretrievedSecret,
        accessible: true,
        suppressed: false,
        source: {
          kind: "direct_perception",
          sense: "visual",
        },
      }],
    },
    objects: {},
    available_actions: {
      [actor]: [{
        action_id: "open-gate",
        intent: "打開 gate-a",
        door_interaction: {
          door_id: "gate-a",
          operation: "open",
        },
      }],
    },
  };
}

function spawnHttpParent(configPath) {
  const child = spawn(
    process.execPath,
    [serverPath, "--config", configPath],
    {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return {
    child,
    readStderr: () => stderr,
  };
}

function listFullTools() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [mcpServerPath],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          MCP_TOOL_PROFILE: "full",
        },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`full MCP exited ${code}: ${stderr}`));
        return;
      }
      try {
        const messages = stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(
          messages.find((message) => message.id === "list")
            ?.result
            ?.tools
          ?? [],
        );
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(`${JSON.stringify({
      jsonrpc: "2.0",
      id: "list",
      method: "tools/list",
      params: {},
    })}\n`);
  });
}

const cleanupBaselines = new Map(
  await Promise.all(
    cleanupRoots.map(async (directory) => [
      directory,
      await names(directory),
    ]),
  ),
);
const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), "phase62a-r1-step4b2-"),
);

let httpParentA = null;
let httpParentB = null;
let childA = null;
let childB = null;
let childC = null;
let committedSessionId = null;

try {
  assert.deepEqual(
    worldSimulationFormalPublicToolNames,
    [
      "chatgpt_bridge_begin_world_simulation_session",
      "chatgpt_bridge_prepare_world_turn",
      "chatgpt_bridge_submit_world_character_action",
      "chatgpt_bridge_resolve_world_turn",
    ],
  );
  assert.deepEqual(
    worldSimulationFormalPublicBlockedTools,
    worldSimulationLegacyCapabilityToolNames,
  );
  for (const toolName of [
    ...worldSimulationFormalPublicToolNames,
    ...worldSimulationLegacyCapabilityToolNames,
  ]) {
    assert.equal(
      isWorldSimulationMcpToolName(toolName),
      true,
      `${toolName} is missing Step4A/B2 audit redaction coverage`,
    );
  }

  const auditSummary =
    summarizeWorldSimulationMcpAuditArguments({
      initial_world_state: {
        hidden: auditSecret,
      },
      prepared_turn_handle:
        "world_prepared_turn_20260825-174000-0123456789ab",
    });
  assert.equal(
    JSON.stringify(auditSummary).includes(auditSecret),
    false,
  );
  assert.equal(
    auditSummary.sensitive_payload_preview_omitted,
    true,
  );
  assert.equal(
    auditSummary.redaction_policy,
    worldSimulationMcpBoundaryVersion,
  );

  const fullTools = await listFullTools();
  const fullNames = fullTools.map((tool) => tool.name);
  for (const toolName of worldSimulationFormalPublicToolNames) {
    assert(
      fullNames.includes(toolName),
      `full profile missing formal world tool ${toolName}`,
    );
  }
  for (const toolName of worldSimulationLegacyCapabilityToolNames) {
    assert(
      fullNames.includes(toolName),
      `full profile must retain debug capability ${toolName}`,
    );
  }

  const portA = await reservePort();
  const configA = path.join(temporaryDirectory, "mcp-http-a.json");
  await writeFile(
    configA,
    `${JSON.stringify({
      host: "127.0.0.1",
      port: portA,
    }, null, 2)}\n`,
    "utf8",
  );

  const parentA = spawnHttpParent(configA);
  httpParentA = parentA.child;
  await waitForPort(
    httpParentA,
    portA,
    parentA.readStderr,
  );

  childA = await connectClient(
    portA,
    "phase62a-r1-step4b2-child-a",
  );
  const publicToolsA = await childA.listTools();
  const publicNames =
    publicToolsA.tools.map((tool) => tool.name);

  for (const toolName of worldSimulationFormalPublicToolNames) {
    assert(
      publicNames.includes(toolName),
      `chatgpt_public missing formal tool ${toolName}`,
    );
  }
  for (const toolName of worldSimulationLegacyCapabilityToolNames) {
    assert.equal(
      publicNames.includes(toolName),
      false,
      `legacy capability leaked into chatgpt_public: ${toolName}`,
    );
  }

  const publicToolMap = new Map(
    publicToolsA.tools.map((tool) => [
      tool.name,
      tool,
    ]),
  );

  const beginSchema =
    publicToolMap.get(
      "chatgpt_bridge_begin_world_simulation_session",
    )?.inputSchema?.properties
    ?? {};
  assert.equal(
    beginSchema.initial_world_state?.type,
    "object",
  );

  const prepareSchema =
    publicToolMap.get(
      "chatgpt_bridge_prepare_world_turn",
    )?.inputSchema
    ?? {};
  assert.deepEqual(
    Object.keys(prepareSchema.properties ?? {}).sort(),
    ["world_simulation_session_id"],
  );

  const submitSchema =
    publicToolMap.get(
      "chatgpt_bridge_submit_world_character_action",
    )?.inputSchema
    ?? {};
  assert.deepEqual(
    Object.keys(submitSchema.properties ?? {}).sort(),
    [
      "action_id",
      "decision_handle",
      "prepared_turn_handle",
      "reject_all",
    ],
  );

  const resolveSchema =
    publicToolMap.get(
      "chatgpt_bridge_resolve_world_turn",
    )?.inputSchema
    ?? {};
  assert.deepEqual(
    Object.keys(resolveSchema.properties ?? {}).sort(),
    ["prepared_turn_handle"],
  );

  for (const forbidden of [
    "event_id",
    "world_state",
    "next_world_state",
    "selected_actions",
    "causal_resolution",
    "hard_conflict_count",
  ]) {
    assert.equal(
      Object.hasOwn(
        prepareSchema.properties ?? {},
        forbidden,
      )
      || Object.hasOwn(
        submitSchema.properties ?? {},
        forbidden,
      )
      || Object.hasOwn(
        resolveSchema.properties ?? {},
        forbidden,
      ),
      false,
      `formal MCP schema exposed forbidden authority field ${forbidden}`,
    );
  }

  const begin = parseToolResult(
    await childA.callTool({
      name: "chatgpt_bridge_begin_world_simulation_session",
      arguments: {
        simulation_label:
          "Phase62A-R1 Step4B-2 HTTP parent acceptance",
        seed: "phase62a-r1-step4b2",
        rules: {
          event_driven: true,
          persistent_causality: true,
        },
        initial_world_state: initialWorldState(),
        initial_world_state_summary: {
          named_characters: 1,
        },
      },
    }),
  );
  assert.equal(begin.ok, true);
  assert.equal(begin.blocked, false);
  assert.equal(begin.world_state_initialized, true);
  assert.equal(begin.world_state_revision, 0);
  assert.equal(begin.mcp_public_adoption_installed, true);
  assert.equal(
    begin.http_parent_broker_adoption_installed,
    true,
  );
  committedSessionId = begin.world_simulation_session_id;

  const prepared = parseToolResult(
    await childA.callTool({
      name: "chatgpt_bridge_prepare_world_turn",
      arguments: {
        world_simulation_session_id:
          begin.world_simulation_session_id,
      },
    }),
  );
  assert.equal(prepared.ok, true);
  assert.equal(prepared.blocked, false);
  assert.equal(prepared.ready_to_resolve, false);
  assert.equal(prepared.decision_count, 1);
  assert.equal(
    prepared.http_parent_broker_adoption_installed,
    true,
  );
  assert(prepared.prepared_turn_handle);
  assert(prepared.current_decision?.decision_handle);
  assert.equal(
    prepared.current_decision
      .character_input
      .character,
    actor,
  );
  const serializedDecision = JSON.stringify(
    prepared.current_decision.character_input,
  );
  for (const secret of [
    sceneId,
    eventId,
    eventMetadataSecret,
    unretrievedSecret,
  ]) {
    assert.equal(
      serializedDecision.includes(secret),
      false,
      `formal character surface leaked ${secret}`,
    );
  }
  assert.equal(
    Object.hasOwn(
      prepared.current_decision.character_input,
      "retrieved_memories",
    ),
    false,
  );
  assert.deepEqual(
    prepared.current_decision
      .character_input
      .recovered_memories,
    [],
  );

  // The preparer child may disappear after storing the complete turn.
  // The parent broker must preserve the PREPARED record for another child.
  await childA.close();
  childA = null;

  childB = await connectClient(
    portA,
    "phase62a-r1-step4b2-child-b",
  );

  const submitted = parseToolResult(
    await childB.callTool({
      name:
        "chatgpt_bridge_submit_world_character_action",
      arguments: {
        prepared_turn_handle:
          prepared.prepared_turn_handle,
        decision_handle:
          prepared.current_decision.decision_handle,
        action_id: "open-gate",
      },
    }),
  );
  assert.equal(submitted.ok, true);
  assert.equal(submitted.ready_to_resolve, true);
  assert.equal(submitted.current_decision, null);

  const resolved = parseToolResult(
    await childB.callTool({
      name: "chatgpt_bridge_resolve_world_turn",
      arguments: {
        prepared_turn_handle:
          prepared.prepared_turn_handle,
      },
    }),
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.committed, true);
  assert.equal(resolved.revision, 1);
  assert.equal(
    resolved.http_parent_broker_adoption_installed,
    true,
  );
  assert.equal(
    Object.hasOwn(resolved, "next_world_state"),
    false,
  );
  assert.equal(
    Object.hasOwn(resolved, "causal_resolution"),
    false,
  );

  const persisted =
    await getWorldSimulationState(
      begin.world_simulation_session_id,
    );
  assert.equal(persisted.revision, 1);
  assert.equal(
    persisted.state
      .scenes[sceneId]
      .doors["gate-a"]
      .open,
    true,
  );

  const replay = parseToolResult(
    await childB.callTool({
      name: "chatgpt_bridge_resolve_world_turn",
      arguments: {
        prepared_turn_handle:
          prepared.prepared_turn_handle,
      },
    }),
  );
  assert.equal(replay.ok, false);
  assert.equal(replay.blocked, true);

  // Prepare a second handle, then restart the HTTP parent. The world state
  // remains persisted, but the parent-only prepared payload must disappear.
  const restartSession = parseToolResult(
    await childB.callTool({
      name: "chatgpt_bridge_begin_world_simulation_session",
      arguments: {
        simulation_label:
          "Phase62A-R1 Step4B-2 restart invalidation",
        initial_world_state: initialWorldState(),
      },
    }),
  );
  const restartPrepared = parseToolResult(
    await childB.callTool({
      name: "chatgpt_bridge_prepare_world_turn",
      arguments: {
        world_simulation_session_id:
          restartSession.world_simulation_session_id,
      },
    }),
  );
  assert(restartPrepared.prepared_turn_handle);
  assert(restartPrepared.current_decision?.decision_handle);

  await childB.close();
  childB = null;
  await stopChild(httpParentA);
  httpParentA = null;

  const portB = await reservePort();
  const configB = path.join(temporaryDirectory, "mcp-http-b.json");
  await writeFile(
    configB,
    `${JSON.stringify({
      host: "127.0.0.1",
      port: portB,
    }, null, 2)}\n`,
    "utf8",
  );
  const parentB = spawnHttpParent(configB);
  httpParentB = parentB.child;
  await waitForPort(
    httpParentB,
    portB,
    parentB.readStderr,
  );

  childC = await connectClient(
    portB,
    "phase62a-r1-step4b2-child-c",
  );
  const afterRestart = parseToolResult(
    await childC.callTool({
      name:
        "chatgpt_bridge_submit_world_character_action",
      arguments: {
        prepared_turn_handle:
          restartPrepared.prepared_turn_handle,
        decision_handle:
          restartPrepared.current_decision.decision_handle,
        action_id: "open-gate",
      },
    }),
  );
  assert.equal(afterRestart.ok, false);
  assert.equal(afterRestart.blocked, true);
  assert.match(
    String(afterRestart.blocked_reason ?? ""),
    /NOT_FOUND|not found|prepared_turn|prepared turn/i,
  );

  // World MCP audit summaries are opaque: even an initial bootstrap snapshot
  // containing secrets must never be copied into the audit log.
  const auditLogPath =
    path.join(
      projectPaths.outputLogs,
      "mcp_tool_audit.jsonl",
    );
  let auditLog = "";
  try {
    auditLog = await readFile(auditLogPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const secret of [
    eventMetadataSecret,
    unretrievedSecret,
  ]) {
    assert.equal(
      auditLog.includes(secret),
      false,
      `world MCP audit persisted secret ${secret}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R1 Step 4B-2",
    boundary_version:
      worldSimulationMcpBoundaryVersion,
    formal_public_tool_count:
      worldSimulationFormalPublicToolNames.length,
    legacy_world_capabilities_public: false,
    initial_world_state_bootstrap_public: true,
    http_parent_prepared_turn_broker_installed: true,
    cross_child_prepare_submit_resolve_verified: true,
    preparer_disconnect_preserves_prepared_turn: true,
    parent_restart_invalidates_prepared_turn: true,
    one_shot_resolve_replay_rejected: true,
    raw_event_or_world_state_exposed_to_character_surface:
      false,
    unretrieved_candidate_content_exposed:
      false,
    formal_resolve_uses_native_programmatic_commit: true,
    world_mcp_audit_preview_leak: false,
    committed_world_session_verified:
      Boolean(committedSessionId),
  }));
  console.log(
    "Phase62A-R1 Step 4B-2 formal MCP public adoption test passed.",
  );
} finally {
  try { await childA?.close(); } catch {}
  try { await childB?.close(); } catch {}
  try { await childC?.close(); } catch {}
  await stopChild(httpParentA);
  await stopChild(httpParentB);
  await rm(
    temporaryDirectory,
    { recursive: true, force: true },
  );
  for (const [directory, before] of cleanupBaselines) {
    await removeNewEntries(directory, before);
  }
}
