import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractDirectMcpToolNames } from "../../server/src/mcp-tool-inventory.mjs";
import { readonlyTools } from "../../server/src/mcp-readonly-tools.mjs";
import {
  runVisualLibraryFinalE2eAcceptancePreview,
} from "../../server/src/visual-library-final-e2e-acceptance-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const historicalCommit = "4b4ec1e5c9fbe3347eb12b526680e542bcc201a5";
const directRegistrationCommit = "8dfc25818bc25391f4852b4c2eac81361ffa0bf6";
const readonlyImplementationCommit = "85bf4cdbc6d1d7d5e105303ff1e68fc121b66d42";
const addedToolName = "preview_visual_reference_consumer_output_guard";
const externalBrainToolNames = [
  "chatgpt_bridge_begin_external_brain_writing_session",
  "chatgpt_bridge_use_scene_planner",
  "chatgpt_bridge_use_character_simulator",
  "chatgpt_bridge_use_neural_critic",
  "chatgpt_bridge_use_style_drift_detector",
  "chatgpt_bridge_use_over_governance_detector",
  "chatgpt_bridge_use_writing_card_director",
  "chatgpt_bridge_use_final_polisher",
];
const expectedDirectDigest = "c2158ab55f337bef810861aaeeb1ee445ac285f517a68e64731052a191748531";
const expectedRuntimeDigest = expectedDirectDigest;
const expectedPublicDigest = "d9ba57f22adeb7493701bd705ba30aba22ff7166e3a8d9429b451f2bb64618eb";
const expectedPublicNames = [
  "get_engine_components_status",
  "chatgpt_bridge_get_workbench_status",
  "approval_queue_bridge_readiness_report",
  "chatgpt_bridge_get_current_inputs",
  "chatgpt_bridge_build_writing_context",
  "chatgpt_bridge_save_candidate",
  "chatgpt_bridge_build_full_neural_writing_handoff",
  ...externalBrainToolNames,
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "chatgpt_bridge_build_proofing_context",
  "chatgpt_bridge_save_proof_report",
  "chatgpt_bridge_request_adoption",
  "chatgpt_bridge_build_settlement_context",
  "chatgpt_bridge_get_foreshadowing_settlement_surface",
  "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
  "chatgpt_bridge_save_settlement_report",
  addedToolName,
];

function digest(names) {
  return createHash("sha256").update(names.join("\n")).digest("hex");
}

function duplicates(names) {
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

function gitShow(ref, filePath) {
  return execFileSync("git", ["show", `${ref}:${filePath}`], {
    cwd: rootDir,
    encoding: "utf8",
  });
}

function listRuntimeTools(profile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server/src/mcp-server.mjs"], {
      cwd: rootDir,
      env: { ...process.env, MCP_TOOL_PROFILE: profile },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${profile} MCP tools/list timed out.`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${profile} MCP exited code=${code} signal=${signal}: ${stderr}`));
        return;
      }
      try {
        const messages = stdout.trim().split(/\r?\n/u).filter(Boolean)
          .map((line) => JSON.parse(line));
        resolve(messages.find((message) => message.id === 2)?.result?.tools ?? []);
      } catch (error) {
        reject(error);
      }
    });
    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "maintenance-inventory-test", version: "1" },
        },
      },
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ];
    child.stdin.end(`${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
  });
}

const config = JSON.parse(await readFile(
  path.join(rootDir, "config", "visual-library-final-e2e-acceptance.json"),
  "utf8",
));
const currentSource = await readFile(
  path.join(rootDir, "server", "src", "mcp-server.mjs"),
  "utf8",
);
const historicalNames = extractDirectMcpToolNames(gitShow(
  historicalCommit,
  "server/src/mcp-server.mjs",
));
const directNames = extractDirectMcpToolNames(currentSource);

assert(historicalNames);
assert(directNames);
assert.equal(historicalNames.length, 70);
assert.equal(directNames.length, 79);
assert.equal(config.expected_mcp_tool_count, directNames.length);
assert.deepEqual(duplicates(directNames), []);
assert.deepEqual(
  directNames.filter((name) => !historicalNames.includes(name)),
  [...externalBrainToolNames, addedToolName],
);
assert.deepEqual(historicalNames.filter((name) => !directNames.includes(name)), []);
assert.equal(digest(directNames), expectedDirectDigest);

const parserFixture = `const toolDefinitions = [
  /*
    name: "comment_decoy",
  */
  "prompt text with name: \\"inline_string_decoy\\"",
  {
    name: "real_tool",
    description: \`prompt line
    name: "prompt_decoy",
    \`,
  },
];
const toolRegistry = new Map();`;
assert.deepEqual(extractDirectMcpToolNames(parserFixture), ["real_tool"]);

const registrationCommit = execFileSync(
  "git",
  ["show", "--format=%H%n%s", "--name-only", directRegistrationCommit],
  { cwd: rootDir, encoding: "utf8" },
);
assert.match(registrationCommit, /Expose visual reference guard in ChatGPT public MCP profile/u);
assert.match(registrationCommit, /server\/src\/mcp-server\.mjs/u);
assert.match(
  registrationCommit,
  /tests\/phase39\/phase39p-visual-reference-consumer-guard-mcp-public-profile-exposure-smoke\.test\.mjs/u,
);
const implementationCommit = execFileSync(
  "git",
  ["show", "--format=%H%n%s", "--name-only", readonlyImplementationCommit],
  { cwd: rootDir, encoding: "utf8" },
);
assert.match(implementationCommit, /Add visual reference consumer guard readonly MCP tool/u);
assert.match(
  implementationCommit,
  /tests\/phase39\/phase39o-visual-reference-consumer-guard-readonly-mcp-tool-registration-smoke\.test\.mjs/u,
);

const [fullTools, publicTools] = await Promise.all([
  listRuntimeTools("full"),
  listRuntimeTools("chatgpt_public"),
]);
const fullNames = fullTools.map((tool) => tool.name);
const publicNames = publicTools.map((tool) => tool.name);
assert.equal(fullNames.length, 79);
assert.deepEqual(duplicates(fullNames), []);
assert.equal(digest(fullNames), expectedRuntimeDigest);
assert.deepEqual(publicNames, expectedPublicNames);
assert.deepEqual(duplicates(publicNames), []);
assert.equal(digest(publicNames), expectedPublicDigest);
assert.equal(Object.keys(readonlyTools).length, 18);
assert.equal(typeof readonlyTools[addedToolName], "function");

const fullAddedTool = fullTools.find((tool) => tool.name === addedToolName);
const publicAddedTool = publicTools.find((tool) => tool.name === addedToolName);
assert(fullAddedTool);
assert(publicAddedTool);
assert.match(fullAddedTool.description, /^\[read\]/u);
assert.equal(fullAddedTool.annotations.readOnlyHint, true);
assert.equal(fullAddedTool._meta["armed-academy/permission"].risk_level, "read");
assert.equal(fullAddedTool._meta["armed-academy/permission"].permission_level, "read_only");
assert.equal(fullAddedTool._meta["armed-academy/permission"].can_modify_canon, false);
assert.equal(fullAddedTool._meta["armed-academy/permission"].can_modify_active_engine, false);

const preview = await runVisualLibraryFinalE2eAcceptancePreview();
assert.equal(preview.bridge_readiness_acceptance.actual_mcp_tool_count, 79);
assert.equal(preview.bridge_readiness_acceptance.expected_mcp_tool_count, 79);
assert.equal(preview.bridge_readiness_acceptance.passed, true);
assert.equal(preview.final_acceptance_decision, "visual_library_final_e2e_preview_acceptance_passed");

const runAllText = await readFile(path.join(rootDir, "tests", "run-all.mjs"), "utf8");
assert.equal(/Phase 43K|phase43k/i.test(runAllText), false);
const phase43KTests = (await readdir(path.join(rootDir, "tests", "phase43")))
  .filter((name) => /^phase43k/i.test(name));
assert.deepEqual(phase43KTests, []);

console.log("Maintenance MCP tool inventory baseline reconciliation tests passed.");
