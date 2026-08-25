import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  hashCanonicalValue,
} from "../../server/src/canonical-json-hash-service.mjs";
import {
  compileWorldSimulationCapabilityEnvelope,
  worldSimulationCapabilityAssuranceModes,
} from "../../server/src/world-simulation-capability-envelope-service.mjs";
import {
  invokeSharedNeuralCoreAdapter,
  neuralSessionModes,
} from "../../server/src/shared-neural-core-service.mjs";
import {
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getAgentRun,
} from "../../server/src/agent-run-service.mjs";
import {
  listNeuralTraces,
} from "../../server/src/neural-trace-service.mjs";
import {
  isMcpResourceAllowedForProfile,
  summarizeWorldSimulationMcpAuditArguments,
  summarizeWorldSimulationMcpAuditOutput,
  worldSimulationFormalPublicBlockedTools,
  worldSimulationLegacyCapabilityToolNames,
  worldSimulationMcpBoundaryVersion,
} from "../../server/src/world-simulation-mcp-boundary-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62a-r1-step4a-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const serverSrc = path.join(projectRoot, "server", "src");
const mcpServerPath = path.join(serverSrc, "mcp-server.mjs");

await rm(fixtureRoot, { recursive: true, force: true });

function runStdio(profile, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [mcpServerPath], {
      cwd: projectRoot,
      env: { ...process.env, MCP_TOOL_PROFILE: profile },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${profile} MCP Step4A probe timed out.`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${profile} MCP exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(stdout.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line)));
      } catch (error) {
        reject(new Error(`Could not parse MCP Step4A output: ${error.message}\n${stdout}`));
      }
    });
    child.stdin.end(`${requests.map((request) => JSON.stringify(request)).join("\n")}\n`);
  });
}

async function listMjsFiles(root) {
  const output = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
        output.push(absolute);
      }
    }
  }
  await visit(root);
  return output;
}

function relative(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

const character = "伊萊亞斯・諾爾";
const secretEventScene = "INTERNAL_SCENE_ID_STEP4A_SECRET";
const secretEventSummary = "INTERNAL_EVENT_SUMMARY_STEP4A_SECRET";
const secretEventMetadata = "INTERNAL_EVENT_METADATA_STEP4A_SECRET";
const adapterSecret = "ADAPTER_EXCEPTION_STEP4A_SECRET";

const initialWorldState = {
  simulation_time: "2026-08-25T06:30:00+08:00",
  event_queue: [{
    event_id: "INTERNAL_EVENT_ID_STEP4A_SECRET",
    type: "internal_scheduler_event_type",
    scene_id: secretEventScene,
    participants: [character],
    summary: secretEventSummary,
    engine_metadata: {
      private_note: secretEventMetadata,
    },
  }],
  scenes: {
    [secretEventScene]: {
      scene_id: secretEventScene,
      dimensions: { width_m: 6, depth_m: 6 },
      entity_positions: {
        [character]: { x: 2, y: 2 },
      },
      observable_by: {
        [character]: {
          visual: ["前方是一條白色站位線"],
          audible: ["空調低鳴"],
        },
      },
    },
  },
  characters: {
    [character]: {
      known: ["自己正在等待"],
      current_goal: "等待",
      current_action: "站在原地",
    },
  },
  memories: {
    [character]: [],
  },
  available_actions: {
    [character]: [{
      action_id: "wait",
      intent: "留在原地等待",
    }],
  },
};

try {
  const hashFixture = {
    z: [3, 2, 1],
    a: { nested: true, text: "固定雜湊" },
  };
  assert.equal(
    hashAgentRunValue(hashFixture),
    hashCanonicalValue(hashFixture),
    "Extracting the low-level canonical hash utility must preserve existing hashes.",
  );

  const auditSentinel = "WORLD_MCP_AUDIT_PREVIEW_SECRET";
  const auditSummary = summarizeWorldSimulationMcpAuditArguments({
    world_simulation_session_id: "agent_run_20260825-063000-1234abcd",
    capability_input: {
      scene_state: {
        hidden_scene_fields: {
          secret: auditSentinel,
        },
      },
      memory_records: [{ content: auditSentinel }],
    },
  });
  assert.equal(JSON.stringify(auditSummary).includes(auditSentinel), false);
  assert.equal(auditSummary.sensitive_payload_preview_omitted, true);
  assert.equal(auditSummary.redaction_policy, worldSimulationMcpBoundaryVersion);

  const auditOutput = summarizeWorldSimulationMcpAuditOutput({
    content: [{ type: "text", text: auditSentinel }],
  });
  assert.equal(JSON.stringify(auditOutput).includes(auditSentinel), false);
  assert.equal(auditOutput.text_preview_omitted, true);

  assert.equal(
    isMcpResourceAllowedForProfile(
      { filePath: path.join(projectRoot, "data", "outputs", "logs", "mcp_tool_audit.jsonl") },
      {
        profile_name: "chatgpt_public",
        output_logs_root: path.join(projectRoot, "data", "outputs", "logs"),
      },
    ),
    false,
  );
  assert.deepEqual(
    worldSimulationFormalPublicBlockedTools,
    worldSimulationLegacyCapabilityToolNames,
  );

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62A-R1 Step4A closure fixture",
    seed: "phase62a-r1-step4a",
    initial_world_state: initialWorldState,
  }, options);
  const sessionId = session.world_simulation_session_id;

  let brainPacket = null;
  await assert.rejects(
    () => runWorldSimulationTurn(
      {
        world_simulation_session_id: sessionId,
        event_id: "INTERNAL_EVENT_ID_STEP4A_SECRET",
      },
      {
        ...options,
        characterBrain: async (packet) => {
          brainPacket = structuredClone(packet);
          return { action_id: "wait" };
        },
        causalAdjudicator: async () => {
          const error = new Error("EXPECTED_STEP4A_CAUSAL_STOP");
          error.code = "EXPECTED_STEP4A_CAUSAL_STOP";
          throw error;
        },
      },
    ),
    (error) => error?.code === "EXPECTED_STEP4A_CAUSAL_STOP",
  );
  assert(brainPacket);
  assert.equal(Object.hasOwn(brainPacket, "event"), false);
  assert.equal(Object.hasOwn(brainPacket, "world_simulation_session_id"), false);
  assert.equal(Object.hasOwn(brainPacket, "turn_id"), false);
  assert.equal(JSON.stringify(brainPacket).includes(secretEventScene), false);
  assert.equal(JSON.stringify(brainPacket).includes(secretEventSummary), false);
  assert.equal(JSON.stringify(brainPacket).includes(secretEventMetadata), false);
  assert.equal(brainPacket.boundaries.raw_world_event_exposed, false);
  assert.equal(brainPacket.boundaries.engine_session_identity_exposed, false);
  assert.equal(brainPacket.boundaries.engine_turn_identity_exposed, false);

  const compiled = compileWorldSimulationCapabilityEnvelope({
    capability_name: "world_consistency_critic",
    invocation_id: "step4a-shared-core-valid",
    subject: null,
    protected_base: {
      review_input: {
        state_transitions: [],
        object_holders: [],
        knowledge_transitions: [],
        action_outcomes: [],
      },
      programmatic_findings: [],
      hard_conflict_count: 0,
      consistency_boundary: {},
    },
    source_channels: [],
  }, {
    assurance_mode: worldSimulationCapabilityAssuranceModes.DIRECT_CALLER_ASSERTED,
  });
  const run = await getAgentRun(sessionId, options);
  const detached = structuredClone(compiled.adapter_envelope);
  const validInvocation = await invokeSharedNeuralCoreAdapter({
    run,
    session_mode: neuralSessionModes.WORLD_SIMULATION,
    capability_name: "world_consistency_critic",
    input: detached,
    world_capability_canonical_envelope: compiled.adapter_envelope,
    adapter: async () => ({ advisory_findings: [] }),
  });
  assert.deepEqual(validInvocation.output, { advisory_findings: [] });

  await assert.rejects(
    () => invokeSharedNeuralCoreAdapter({
      run,
      session_mode: neuralSessionModes.WORLD_SIMULATION,
      capability_name: "world_consistency_critic",
      input: structuredClone(compiled.adapter_envelope),
      world_capability_canonical_envelope: structuredClone(compiled.adapter_envelope),
      adapter: async () => ({ advisory_findings: [] }),
    }),
    (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_ENVELOPE_ATTESTATION_REQUIRED",
    "A forged clone must not substitute for the compiler-minted canonical envelope.",
  );

  await assert.rejects(
    () => invokeSharedNeuralCoreAdapter({
      run,
      session_mode: neuralSessionModes.WORLD_SIMULATION,
      capability_name: "world_consistency_critic",
      input: compiled.adapter_envelope,
      world_capability_canonical_envelope: compiled.adapter_envelope,
      adapter: async () => ({ advisory_findings: [] }),
    }),
    (error) => error?.code === "WORLD_SIMULATION_CAPABILITY_ADAPTER_COPY_REQUIRED",
    "The neural adapter must never receive the engine-owned canonical envelope object.",
  );

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_consistency_critic",
      {
        world_simulation_session_id: sessionId,
        capability_input: {
          state_transitions: [],
        },
      },
      {
        ...options,
        adapter: async () => {
          throw new Error(adapterSecret);
        },
      },
    ),
    (error) => String(error?.message ?? "").includes(adapterSecret),
  );
  const traces = await listNeuralTraces({ ...options, run_id: sessionId });
  const failedTrace = traces.find((trace) => (
    trace.module_name === "world_consistency_critic"
    && trace.status === "failed"
  ));
  assert(failedTrace, "Expected one failed direct-adapter trace.");
  assert.equal(JSON.stringify(failedTrace).includes(adapterSecret), false);
  assert.match(failedTrace.error_message, /^world_simulation_error:/u);

  const productionFiles = await listMjsFiles(serverSrc);
  const nativeRunnerRefs = [];
  const compilerRefs = [];
  for (const filePath of productionFiles) {
    const source = await readFile(filePath, "utf8");
    if (source.includes("runWorldSimulationNativeCapability")) {
      nativeRunnerRefs.push(relative(filePath));
    }
    if (source.includes("compileWorldSimulationCapabilityEnvelope")) {
      compilerRefs.push(relative(filePath));
    }
  }
  assert.deepEqual(nativeRunnerRefs.sort(), [
    "server/src/world-simulation-loop-service.mjs",
    "server/src/world-simulation-neural-service.mjs",
  ]);
  assert.deepEqual(compilerRefs.sort(), [
    "server/src/world-simulation-capability-envelope-service.mjs",
    "server/src/world-simulation-character-facing-capability-runtime-service.mjs",
    "server/src/world-simulation-engine-integrity-capability-runtime-service.mjs",
  ]);
  const sharedCoreSource = await readFile(
    path.join(serverSrc, "shared-neural-core-service.mjs"),
    "utf8",
  );
  assert.equal(
    sharedCoreSource.includes("createWorldSimulationCapabilityMediationAttestation"),
    false,
    "Shared Core must not export an independently mintable mediation token.",
  );

  const listRequest = {
    jsonrpc: "2.0",
    id: "tools",
    method: "tools/list",
    params: {},
  };
  const resourcesRequest = {
    jsonrpc: "2.0",
    id: "resources",
    method: "resources/list",
    params: {},
  };
  const auditReadRequest = {
    jsonrpc: "2.0",
    id: "audit-read",
    method: "resources/read",
    params: {
      uri: "armed-academy://jsonl/data:outputs:logs:mcp_tool_audit.jsonl",
    },
  };
  const publicResponses = await runStdio(
    "chatgpt_public",
    [listRequest, resourcesRequest, auditReadRequest],
  );
  const publicTools = publicResponses.find((item) => item.id === "tools")?.result?.tools ?? [];
  const publicToolNames = publicTools.map((tool) => tool.name);
  assert.equal(publicToolNames.includes("chatgpt_bridge_use_world_memory_retriever"), false);
  for (const blockedName of worldSimulationFormalPublicBlockedTools) {
    assert.equal(publicToolNames.includes(blockedName), false);
  }
  const publicResources = publicResponses.find((item) => item.id === "resources")?.result?.resources ?? [];
  assert.equal(
    publicResources.some((resource) => (
      String(resource?.metadata?.path ?? "").startsWith("data/outputs/logs/")
    )),
    false,
    "chatgpt_public must not list output-log resources.",
  );
  const auditRead = publicResponses.find((item) => item.id === "audit-read");
  assert(auditRead?.error, "chatgpt_public resources/read must reject MCP audit-log access.");

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R1 Step 4A",
    boundary_version: worldSimulationMcpBoundaryVersion,
    character_brain_raw_event_exposed: false,
    character_brain_engine_identity_exposed: false,
    world_mcp_audit_preview_leak: false,
    chatgpt_public_output_log_resources_exposed: false,
    legacy_memory_projector_formal_public: false,
    independent_mediation_token_mint_exported: false,
    native_assurance_import_allowlist_verified: true,
    compiler_import_allowlist_verified: true,
    adapter_exception_persisted_in_trace: false,
  }));
  console.log("Phase62A-R1 Step 4A global boundary closure test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
