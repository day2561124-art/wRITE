import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const mcpServerPath = path.join(rootDir, "server", "src", "mcp-server.mjs");

const STATUS_TOOL = "chatgpt_bridge_get_workbench_status";
const HANDOFF_TOOL = "chatgpt_bridge_build_full_neural_writing_handoff";
const PRIMARY_TOOL = "chatgpt_bridge_begin_external_brain_writing_session";
const EXPECTED_MODULES = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
  "run_final_polisher",
];

function runMcpSession(requests, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [mcpServerPath], {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(
        new Error(
          `MCP stdio session timed out after ${timeoutMs} ms.\nSTDERR:\n${stderr}`,
        ),
      );
    }, timeoutMs);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(
          new Error(
            `MCP server exited with code ${code}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
          ),
        );
        return;
      }

      try {
        const messages = stdout
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(messages);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse MCP stdout as newline-delimited JSON: ${error.message}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
          ),
        );
      }
    });

    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
    child.stdin.end();
  });
}

function responseById(messages, id) {
  const response = messages.find((message) => message?.id === id);
  assert.ok(response, `Missing MCP response id=${id}`);
  assert.equal(response.error, undefined, `Unexpected MCP error for id=${id}`);
  return response;
}

function parseToolPayload(response) {
  assert.notEqual(
    response?.result?.isError,
    true,
    "tools/call returned isError=true",
  );

  const textItem = response?.result?.content?.find(
    (item) => item?.type === "text" && typeof item?.text === "string",
  );

  assert.ok(textItem, "tools/call response is missing text content");
  return JSON.parse(textItem.text);
}

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "maintenance-chatgpt-native-handoff-tool-selection-routing-guard",
        version: "1",
      },
    },
  },
  {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: STATUS_TOOL,
      arguments: {},
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: HANDOFF_TOOL,
      arguments: {
        task_prompt:
          "Formal short scene generation for live tool identity routing guard. Use the latest Writer Workbench canon and writing rules. Do not save a candidate and do not update Canon or active_engine.",
        chapter_mode: "specific_scene",
        max_context_chars: 48000,
        enable_character_voice_guard: true,
        output_mode: "chatgpt_native_handoff",
      },
    },
  },
];

const messages = await runMcpSession(requests);
responseById(messages, 1);

const toolListResponse = responseById(messages, 2);
const tools = toolListResponse?.result?.tools ?? [];
const statusTool = tools.find((tool) => tool?.name === STATUS_TOOL);
const handoffTool = tools.find((tool) => tool?.name === HANDOFF_TOOL);
const primaryTool = tools.find((tool) => tool?.name === PRIMARY_TOOL);

assert.ok(statusTool, `${STATUS_TOOL} must be exposed`);
assert.ok(handoffTool, `${HANDOFF_TOOL} must be exposed`);
assert.ok(primaryTool, `${PRIMARY_TOOL} must be exposed`);

assert.match(
  statusTool.description ?? "",
  /Status inspection only: do not use or substitute this tool for formal story writing/u,
);
assert.match(
  statusTool.description ?? "",
  /chatgpt_bridge_begin_external_brain_writing_session/u,
);
assert.match(
  handoffTool.description ?? "",
  /aggregate compatibility/u,
);
assert.match(
  handoffTool.description ?? "",
  /not the architecture-primary route/u,
);
assert.match(
  primaryTool.description ?? "",
  /Architecture-primary formal writing entry/u,
);
assert.match(primaryTool.description ?? "", /ChatGPT individually orchestrates six pre-generation/u);

const statusPayload = parseToolPayload(responseById(messages, 3));
const handoffPayload = parseToolPayload(responseById(messages, 4));

assert.equal(statusPayload.tool_name, STATUS_TOOL);
assert.notEqual(statusPayload.tool_name, HANDOFF_TOOL);

assert.equal(handoffPayload.tool_name, HANDOFF_TOOL);
assert.equal(handoffPayload?.result?.tool_name, HANDOFF_TOOL);
assert.notEqual(handoffPayload.tool_name, STATUS_TOOL);

assert.equal(
  handoffPayload?.result?.status,
  "ready_for_chatgpt_native_generation",
);
assert.equal(
  handoffPayload?.result?.output_mode,
  "chatgpt_native_handoff",
);
assert.equal(
  handoffPayload?.result?.orchestration_mode,
  "writer_workbench_aggregate_compatibility",
);
assert.equal(handoffPayload?.result?.architecture_primary_route, false);

const handoff = handoffPayload?.result?.chatgpt_native_writing_handoff;
assert.equal(handoff?.used, true);
assert.equal(handoff?.contract_valid, true);
assert.equal(handoff?.orchestration_mode, "writer_workbench_aggregate_compatibility");
assert.equal(handoff?.orchestration_owner, "writer_workbench");
assert.equal(handoff?.runtime_host, "writer_workbench_runtime");
assert.equal(handoff?.final_prose_generator, "chatgpt");
assert.equal(handoffPayload?.result?.candidate_created, false);
assert.equal(handoffPayload?.result?.canon_updated, false);
assert.equal(handoffPayload?.result?.active_engine_updated, false);
assert.equal(handoffPayload?.result?.adopted, false);
assert.equal(handoffPayload?.result?.settled, false);

const diagnostics = handoff?.neural_modules_diagnostics;
const summary = handoff?.neural_trace_summary;

assert.equal(diagnostics?.required_modules_executed, true);
assert.equal(diagnostics?.chatgpt_native_neural_modules_executed, true);
assert.equal(diagnostics?.module_results_attached_to_handoff, true);
assert.equal(diagnostics?.neural_trace_created, true);
assert.equal(diagnostics?.neural_execution_status, "success");

assert.equal(summary?.trace_count, 7);
assert.equal(summary?.success_count, 7);
assert.equal(summary?.failed_count, 0);
assert.equal(summary?.skipped_count, 0);
assert.equal(summary?.used_neural_network, true);
assert.deepEqual(summary?.missing_required_neural_modules, []);
assert.deepEqual(
  [...(summary?.required_neural_modules ?? [])].sort(),
  [...EXPECTED_MODULES].sort(),
);
assert.equal(diagnostics?.neural_trace_run_id, summary?.run_id);
assert.match(summary?.run_id ?? "", /^agent_run_/u);
assert.match(handoff?.handoff_hash_sha256 ?? "", /^[a-f0-9]{64}$/u);

const executionResults = handoff?.neural_module_execution_results ?? [];
assert.equal(executionResults.length, 7);

for (const moduleName of EXPECTED_MODULES) {
  const result = executionResults.find(
    (item) => item?.module_name === moduleName,
  );

  assert.ok(result, `Missing neural execution result: ${moduleName}`);
  assert.equal(result.status, "success", `${moduleName} must succeed`);
  assert.match(result.trace_id ?? "", /^neural_trace_/u);
}

console.log(
  `Maintenance live tool identity routing guard passed: requested ${HANDOFF_TOOL}, returned ${handoffPayload.tool_name}, neural=${summary.success_count}/${summary.trace_count}, run_id=${summary.run_id}`,
);
