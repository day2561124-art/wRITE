import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStdioSession } from "../../server/src/mcp-http-stdio-adapter.mjs";
import { resolveActiveEngineDependencies } from "../../server/src/active-engine-dependency-manifest.mjs";
import { extractDirectMcpToolNames } from "../../server/src/mcp-tool-inventory.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "mcp-server.mjs");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const publicReadPaths = [...new Set([
  path.join(rootDir, "config", "engine-components.json"),
  activeEnginePath,
  ...resolveActiveEngineDependencies().map((dependency) => dependency.filePath),
  path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(rootDir, "server", "src", "neural-module-service.mjs"),
  path.join(rootDir, "docs", "DAILY-WORKFLOW.md"),
])];

const publicToolNames = [
  "dev_list_directory",
  "dev_read_file",
  "dev_search_files",
  "get_engine_components_status",
  "get_active_engine_dependency_status",
  "chatgpt_bridge_get_workbench_status",
  "chatgpt_bridge_begin_world_simulation_session",
  "chatgpt_bridge_prepare_world_turn",
  "chatgpt_bridge_submit_world_character_action",
  "chatgpt_bridge_resolve_world_turn",
  "chatgpt_bridge_get_current_inputs",
  "chatgpt_bridge_build_writing_context",
  "chatgpt_bridge_save_candidate",
  "chatgpt_bridge_build_full_neural_writing_handoff",
  "chatgpt_bridge_begin_external_brain_writing_session",
  "chatgpt_bridge_review_draft_ephemeral",
  "chatgpt_bridge_use_scene_planner",
  "chatgpt_bridge_use_character_simulator",
  "chatgpt_bridge_use_neural_critic",
  "chatgpt_bridge_use_style_drift_detector",
  "chatgpt_bridge_use_over_governance_detector",
  "chatgpt_bridge_use_writing_card_director",
  "chatgpt_bridge_seal_raw_story_handoff",
  "chatgpt_bridge_use_final_polisher",
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "chatgpt_bridge_build_proofing_context",
  "chatgpt_bridge_save_proof_report",
  "chatgpt_bridge_request_adoption",
  "chatgpt_bridge_build_settlement_context",
  "chatgpt_bridge_get_foreshadowing_settlement_surface",
  "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
  "chatgpt_bridge_save_settlement_report",
  "build_pending_engine_candidate_review",
  "get_pending_engine_candidate_review",
  "list_pending_engine_candidate_reviews",
  "request_pending_engine_candidate_activation",
  "approval_queue_bridge_readiness_report",
  "chatgpt_bridge_search_visual_assets",
  "chatgpt_bridge_get_visual_asset",
  "preview_visual_reference_consumer_output_guard",
];

const blockedToolNames = [
  "dev_read_file_range",
  "dev_git_status",
  "dev_git_diff",
  "dev_git_diff_check",
  "dev_apply_patch",
  "dev_delete_file",
  "dev_run_tests",
  "dev_git_commit",
  "dev_git_push",
  "activate_engine_version",
  "compress_error_rules",
  "import_policy_file",
  "commit_error_report",
  "create_settlement_proposal",
  "build_pending_engine_candidate_from_settlement_report",
  "query_mcp_audit",
];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function runStdioSession(profile, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        MCP_TOOL_PROFILE: profile,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(
          stdout
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
        );
      } catch (error) {
        reject(new Error(`Could not parse MCP output: ${error.message}\n${stdout}`));
      }
    });

    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
    child.stdin.end();
  });
}

function adapterCall(session, message) {
  return new Promise((resolve, reject) => {
    session.call(message, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

const listRequest = {
  jsonrpc: "2.0",
  id: "list",
  method: "tools/list",
  params: {},
};

const fullResponses = await runStdioSession("full", [listRequest]);
const fullNames = fullResponses[0].result.tools.map((tool) => tool.name);
const registeredNames = extractDirectMcpToolNames(await readFile(serverPath, "utf8"));
assert.deepEqual(fullNames, registeredNames, "full tools/list drifted from the MCP registry");
for (const toolName of blockedToolNames) {
  assert(fullNames.includes(toolName), `full profile is missing ${toolName}`);
}

const publicReadHashesBefore = new Map();
for (const filePath of publicReadPaths) {
  publicReadHashesBefore.set(filePath, sha256(await readFile(filePath)));
}
const publicRequests = [
  listRequest,
  {
    jsonrpc: "2.0",
    id: "component-status",
    method: "tools/call",
    params: {
      name: "get_engine_components_status",
      arguments: {},
    },
  },
  {
    jsonrpc: "2.0",
    id: "dependency-status",
    method: "tools/call",
    params: {
      name: "get_active_engine_dependency_status",
      arguments: {},
    },
  },
  ...blockedToolNames.map((name, index) => ({
    jsonrpc: "2.0",
    id: `blocked-${index}`,
    method: "tools/call",
    params: {
      name,
      arguments: {},
    },
  })),
  {
    jsonrpc: "2.0",
    id: "ping",
    method: "ping",
    params: {},
  },
];
const publicResponses = await runStdioSession("chatgpt_public", publicRequests);
const publicList = publicResponses.find((response) => response.id === "list");
const listedPublicNames = publicList.result.tools.map((tool) => tool.name);
assert.deepEqual(
  [...listedPublicNames].sort(),
  [...publicToolNames].sort(),
);

const publicToolMap = new Map(publicList.result.tools.map((tool) => [tool.name, tool]));
assert.equal(
  publicToolMap.has("dev_apply_patch"),
  false,
  "dev_apply_patch leaked into chatgpt_public",
);
assert.equal(
  publicToolMap.has("dev_run_tests"),
  false,
  "dev_run_tests leaked into chatgpt_public",
);

publicToolNames.push(
  "dev_read_file_range",
  "dev_git_status",
  "dev_git_diff",
  "dev_git_diff_check",
  "dev_delete_file",
);
const developerResponses = await runStdioSession("chatgpt_developer", [listRequest]);
const developerList = developerResponses[0];
const developerNames = developerList.result.tools.map((tool) => tool.name);
assert.deepEqual(
  [...developerNames].sort(),
  [...publicToolNames, "dev_apply_patch", "dev_run_tests", "dev_git_commit", "dev_git_push"].sort(),
  "chatgpt_developer must equal chatgpt_public plus the nine development range/write/test/Git tools",
);
for (const [toolName, expectedProperties, expectedSources] of [
  ["dev_git_status", ["includeUntracked"], ["repository_git_worktree_status"]],
  ["dev_git_diff", ["mode"], ["repository_git_worktree_diff", "repository_git_index_diff"]],
  ["dev_git_diff_check", ["mode"], ["repository_git_worktree_diff_check", "repository_git_index_diff_check"]],
]) {
  const gitTool = developerList.result.tools.find((tool) => tool.name === toolName);
  assert(gitTool, `chatgpt_developer is missing ${toolName}`);
  assert.equal(gitTool.annotations?.readOnlyHint, true);
  assert.equal(gitTool.inputSchema?.type, "object");
  assert.equal(gitTool.inputSchema?.additionalProperties, false);
  assert.deepEqual(Object.keys(gitTool.inputSchema?.properties ?? {}), expectedProperties);
  for (const forbiddenField of [
    "command", "args", "executable", "cwd", "env", "shell", "path", "pathspec",
  ]) {
    assert.equal(
      Object.hasOwn(gitTool.inputSchema?.properties ?? {}, forbiddenField),
      false,
      `${toolName} exposed forbidden field ${forbiddenField}`,
    );
  }
  if (toolName === "dev_git_status") {
    assert.equal(gitTool.inputSchema.properties.includeUntracked.type, "boolean");
    assert.equal(gitTool.inputSchema.properties.includeUntracked.default, true);
  } else {
    assert.equal(gitTool.inputSchema.properties.mode.type, "string");
    assert.deepEqual(gitTool.inputSchema.properties.mode.enum, ["working", "staged"]);
    assert.equal(gitTool.inputSchema.properties.mode.default, "working");
  }
  const permission = gitTool._meta?.["armed-academy/permission"];
  assert.equal(permission?.permission_level, "read_only");
  assert.equal(permission?.read_or_write, "read");
  assert.equal(permission?.risk_level, "read");
  assert.equal(permission?.log_required, false);
  assert.equal(permission?.can_modify_canon, false);
  assert.equal(permission?.can_modify_active_engine, false);
  assert.equal(permission?.can_modify_story_graph, false);
  assert.equal(permission?.can_modify_memory, false);
  assert.deepEqual(permission?.allowed_sources, expectedSources);
}

const developerRangeReadTool = developerList.result.tools.find(
  (tool) => tool.name === "dev_read_file_range",
);
assert(developerRangeReadTool, "chatgpt_developer is missing dev_read_file_range");
assert.equal(developerRangeReadTool.annotations?.readOnlyHint, true);
assert.deepEqual(
  Object.keys(developerRangeReadTool.inputSchema?.properties ?? {}).sort(),
  ["maxBytes", "path", "startLine"],
);
assert.deepEqual(developerRangeReadTool.inputSchema?.required, ["path"]);
assert.equal(developerRangeReadTool.inputSchema.properties.startLine.minimum, 1);
assert.equal(developerRangeReadTool.inputSchema.properties.startLine.default, 1);
assert.equal(developerRangeReadTool.inputSchema.properties.maxBytes.maximum, 262144);
assert.equal(developerRangeReadTool.inputSchema.properties.maxBytes.default, 262144);
const developerRangePermission = developerRangeReadTool._meta?.["armed-academy/permission"];
assert.equal(developerRangePermission?.permission_level, "read_only");
assert.equal(developerRangePermission?.read_or_write, "read");
assert.equal(developerRangePermission?.log_required, false);
assert.deepEqual(
  developerRangePermission?.allowed_sources,
  ["repository_large_text_file"],
);

const developerDeleteTool = developerList.result.tools.find(
  (tool) => tool.name === "dev_delete_file",
);
assert(developerDeleteTool, "chatgpt_developer is missing dev_delete_file");
assert.equal(developerDeleteTool.annotations?.readOnlyHint, false);
assert.deepEqual(developerDeleteTool.inputSchema?.required, ["path"]);
assert.deepEqual(
  Object.keys(developerDeleteTool.inputSchema?.properties ?? {}).sort(),
  ["expectedSha256", "path"],
);
assert.equal(developerDeleteTool.inputSchema.properties.expectedSha256.pattern, "^[A-Fa-f0-9]{64}$");
const developerDeletePermission = developerDeleteTool._meta?.["armed-academy/permission"];
assert.equal(developerDeletePermission?.permission_level, "write_low_risk");
assert.equal(developerDeletePermission?.read_or_write, "write");
assert.equal(developerDeletePermission?.log_required, true);
assert.equal(developerDeletePermission?.can_modify_canon, false);
assert.equal(developerDeletePermission?.can_modify_active_engine, false);
assert.deepEqual(
  developerDeletePermission?.allowed_sources,
  ["repository_development_text_file", "mcp_client_delete_request"],
);

const liveGitResponses = await runStdioSession("chatgpt_developer", [
  {
    jsonrpc: "2.0",
    id: "live-git-status",
    method: "tools/call",
    params: { name: "dev_git_status", arguments: { includeUntracked: true } },
  },
  {
    jsonrpc: "2.0",
    id: "live-git-diff-working",
    method: "tools/call",
    params: { name: "dev_git_diff", arguments: { mode: "working" } },
  },
  {
    jsonrpc: "2.0",
    id: "live-git-diff-check-working",
    method: "tools/call",
    params: { name: "dev_git_diff_check", arguments: { mode: "working" } },
  },
  {
    jsonrpc: "2.0",
    id: "live-git-diff-staged",
    method: "tools/call",
    params: { name: "dev_git_diff", arguments: { mode: "staged" } },
  },
  {
    jsonrpc: "2.0",
    id: "live-git-diff-check-staged",
    method: "tools/call",
    params: { name: "dev_git_diff_check", arguments: { mode: "staged" } },
  },
]);
function liveGitResult(id) {
  const response = liveGitResponses.find((item) => item.id === id);
  assert.equal(response?.error, undefined, `${id} returned JSON-RPC error`);
  assert.equal(response?.result?.isError, undefined, `${id} returned tool error`);
  return JSON.parse(response.result.content[0].text);
}
const liveGitStatus = liveGitResult("live-git-status");
const liveWorkingDiff = liveGitResult("live-git-diff-working");
const liveWorkingCheck = liveGitResult("live-git-diff-check-working");
const liveStagedDiff = liveGitResult("live-git-diff-staged");
const liveStagedCheck = liveGitResult("live-git-diff-check-staged");
assert.equal(liveGitStatus.execution_ok, true);
assert.equal(liveGitStatus.exit_code, 0);
assert.equal(liveWorkingDiff.execution_ok, true);
assert.equal(liveWorkingDiff.exit_code, 0);
assert.equal(liveWorkingCheck.execution_ok, true);
assert.equal(liveStagedDiff.execution_ok, true);
assert.equal(liveStagedDiff.exit_code, 0);
assert.equal(liveStagedCheck.execution_ok, true);
console.log(`DEV-GIT-RO live status: ${JSON.stringify({
  branch: liveGitStatus.branch,
  head: liveGitStatus.head,
  clean: liveGitStatus.clean,
  staged: liveGitStatus.staged,
  modified: liveGitStatus.modified,
  deleted: liveGitStatus.deleted,
  renamed: liveGitStatus.renamed,
  untracked: liveGitStatus.untracked,
  conflicted: liveGitStatus.conflicted,
  raw_truncated: liveGitStatus.raw_truncated,
  raw_characters: liveGitStatus.raw_characters,
  raw_bytes: liveGitStatus.raw_bytes,
})}`);
console.log(`DEV-GIT-RO live working diff: ${JSON.stringify({
  exit_code: liveWorkingDiff.exit_code,
  truncated: liveWorkingDiff.truncated,
  characters: liveWorkingDiff.characters,
  bytes: liveWorkingDiff.bytes,
})}`);
console.log(`DEV-GIT-RO live working diff-check: ${JSON.stringify({
  passed: liveWorkingCheck.passed,
  exit_code: liveWorkingCheck.exit_code,
  output: liveWorkingCheck.output,
})}`);
if (liveGitStatus.staged.length > 0) {
  console.log(`DEV-GIT-RO live staged diff: ${JSON.stringify({
    exit_code: liveStagedDiff.exit_code,
    truncated: liveStagedDiff.truncated,
    characters: liveStagedDiff.characters,
    bytes: liveStagedDiff.bytes,
    check_passed: liveStagedCheck.passed,
    check_exit_code: liveStagedCheck.exit_code,
  })}`);
}

const developerPatchTool = developerList.result.tools.find(
  (tool) => tool.name === "dev_apply_patch",
);
assert(developerPatchTool, "chatgpt_developer is missing dev_apply_patch");
assert.equal(developerPatchTool.annotations?.readOnlyHint, false);
const developerPatchSchema = developerPatchTool.inputSchema;
assert.equal(developerPatchSchema?.type, "object");
assert.equal(developerPatchSchema?.additionalProperties, false);
assert.deepEqual(developerPatchSchema?.required, ["path", "oldText", "newText"]);
assert.deepEqual(
  Object.keys(developerPatchSchema?.properties ?? {}).sort(),
  ["expectedSha256", "newText", "oldText", "path"].sort(),
);
assert.equal(developerPatchSchema.properties.path.type, "string");
assert.equal(developerPatchSchema.properties.path.maxLength, 4096);
assert.equal(developerPatchSchema.properties.oldText.type, "string");
assert.equal(developerPatchSchema.properties.oldText.minLength, 1);
assert.equal(developerPatchSchema.properties.oldText.maxLength, 262144);
assert.equal(developerPatchSchema.properties.newText.type, "string");
assert.equal(developerPatchSchema.properties.newText.maxLength, 262144);
assert.equal(developerPatchSchema.properties.newText["x-allow-empty"], true);
assert.equal(developerPatchSchema.properties.expectedSha256.type, "string");
assert.equal(developerPatchSchema.properties.expectedSha256.minLength, 64);
assert.equal(developerPatchSchema.properties.expectedSha256.maxLength, 64);
assert.equal(developerPatchSchema.properties.expectedSha256.pattern, "^[A-Fa-f0-9]{64}$");
assert.equal(Object.hasOwn(developerPatchSchema.properties.expectedSha256, "default"), false);
const developerPatchPermission = developerPatchTool._meta?.["armed-academy/permission"];
assert.equal(developerPatchPermission?.permission_level, "write_low_risk");
assert.equal(developerPatchPermission?.read_or_write, "write");
assert.equal(developerPatchPermission?.risk_level, "low-risk-write");
assert.equal(developerPatchPermission?.log_required, true);
assert.equal(developerPatchPermission?.can_modify_canon, false);
assert.equal(developerPatchPermission?.can_modify_active_engine, false);
assert.equal(developerPatchPermission?.can_modify_story_graph, false);
assert.equal(developerPatchPermission?.can_modify_memory, false);
assert.deepEqual(
  developerPatchPermission?.allowed_sources,
  ["repository_development_text_file", "mcp_client_exact_patch"],
);
assert(developerPatchPermission?.forbidden_sources?.includes("unregistered_external_source"));

const developerTestTool = developerList.result.tools.find(
  (tool) => tool.name === "dev_run_tests",
);
assert(developerTestTool, "chatgpt_developer is missing dev_run_tests");
assert.equal(developerTestTool.annotations?.readOnlyHint, false);
const developerTestSchema = developerTestTool.inputSchema;
assert.equal(developerTestSchema?.type, "object");
assert.equal(developerTestSchema?.additionalProperties, false);
assert.deepEqual(developerTestSchema?.required, ["suite"]);
assert.deepEqual(Object.keys(developerTestSchema?.properties ?? {}), ["suite"]);
assert.equal(developerTestSchema.properties.suite.type, "string");
assert.deepEqual(developerTestSchema.properties.suite.enum, ["mcp", "mcp_tunnel", "all"]);
for (const forbiddenField of [
  "command", "args", "cwd", "env", "program", "shell", "script", "path",
]) {
  assert.equal(
    Object.hasOwn(developerTestSchema.properties, forbiddenField),
    false,
    `dev_run_tests exposed forbidden field ${forbiddenField}`,
  );
}
const developerTestPermission = developerTestTool._meta?.["armed-academy/permission"];
assert.equal(developerTestPermission?.permission_level, "write_low_risk");
assert.equal(developerTestPermission?.read_or_write, "write");
assert.equal(developerTestPermission?.risk_level, "low-risk-write");
assert.equal(developerTestPermission?.log_required, true);
assert.equal(developerTestPermission?.can_modify_canon, false);
assert.equal(developerTestPermission?.can_modify_active_engine, false);
assert.equal(developerTestPermission?.can_modify_story_graph, false);
assert.equal(developerTestPermission?.can_modify_memory, false);
assert.deepEqual(
  developerTestPermission?.allowed_sources,
  ["repository_test_entrypoints", "server_owned_test_allowlist"],
);

const developerCommitTool = developerList.result.tools.find(
  (tool) => tool.name === "dev_git_commit",
);
assert(developerCommitTool, "chatgpt_developer is missing dev_git_commit");
assert.equal(developerCommitTool.annotations?.readOnlyHint, false);
const developerCommitSchema = developerCommitTool.inputSchema;
assert.equal(developerCommitSchema?.type, "object");
assert.equal(developerCommitSchema?.additionalProperties, false);
assert.deepEqual(developerCommitSchema?.required, ["paths", "message"]);
assert.deepEqual(
  Object.keys(developerCommitSchema?.properties ?? {}).sort(),
  ["message", "paths"],
);
assert.equal(developerCommitSchema.properties.paths.type, "array");
assert.equal(developerCommitSchema.properties.paths.minItems, 1);
assert.equal(developerCommitSchema.properties.paths.maxItems, 100);
assert.equal(developerCommitSchema.properties.paths.items.type, "string");
assert.equal(developerCommitSchema.properties.paths.items.maxLength, 4096);
assert.equal(developerCommitSchema.properties.message.type, "string");
assert.equal(developerCommitSchema.properties.message.minLength, 1);
assert.equal(developerCommitSchema.properties.message.maxLength, 500);
for (const forbiddenField of [
  "command", "args", "cwd", "env", "shell", "executable", "author", "date",
  "gpgSign", "noVerify", "amend", "all", "interactive", "pathspec",
]) {
  assert.equal(
    Object.hasOwn(developerCommitSchema.properties, forbiddenField),
    false,
    `dev_git_commit exposed forbidden field ${forbiddenField}`,
  );
}
const developerCommitPermission = developerCommitTool._meta?.["armed-academy/permission"];
assert.equal(developerCommitPermission?.permission_level, "write_low_risk");
assert.equal(developerCommitPermission?.read_or_write, "write");
assert.equal(developerCommitPermission?.risk_level, "low-risk-write");
assert.equal(developerCommitPermission?.log_required, true);
assert.equal(developerCommitPermission?.can_modify_canon, false);
assert.equal(developerCommitPermission?.can_modify_active_engine, false);
assert.equal(developerCommitPermission?.can_modify_story_graph, false);
assert.equal(developerCommitPermission?.can_modify_memory, false);
assert.deepEqual(
  developerCommitPermission?.allowed_sources,
  ["repository_development_paths", "repository_git_index", "mcp_client_commit_message"],
);

publicToolNames.splice(-5, 5);

const developerPushTool = developerList.result.tools.find(
  (tool) => tool.name === "dev_git_push",
);
assert(developerPushTool, "chatgpt_developer is missing dev_git_push");
assert.equal(developerPushTool.annotations?.readOnlyHint, false);
const developerPushSchema = developerPushTool.inputSchema;
assert.equal(developerPushSchema?.type, "object");
assert.equal(developerPushSchema?.additionalProperties, false);
assert.deepEqual(developerPushSchema?.required, ["expectedHead"]);
assert.deepEqual(Object.keys(developerPushSchema?.properties ?? {}), ["expectedHead"]);
assert.equal(developerPushSchema.properties.expectedHead.type, "string");
assert.equal(developerPushSchema.properties.expectedHead.minLength, 40);
assert.equal(developerPushSchema.properties.expectedHead.maxLength, 40);
assert.equal(developerPushSchema.properties.expectedHead.pattern, "^[A-Fa-f0-9]{40}$");
for (const forbiddenField of [
  "remote", "branch", "refspec", "url", "force", "forceWithLease", "tags", "delete",
  "setUpstream", "mirror", "atomic", "args", "command", "cwd", "env", "shell",
  "executable", "username", "password", "token", "credential", "confirm",
]) {
  assert.equal(
    Object.hasOwn(developerPushSchema.properties, forbiddenField),
    false,
    `dev_git_push exposed forbidden field ${forbiddenField}`,
  );
}
const developerPushPermission = developerPushTool._meta?.["armed-academy/permission"];
assert.equal(developerPushPermission?.permission_level, "write_high_risk");
assert.equal(developerPushPermission?.read_or_write, "write");
assert.equal(developerPushPermission?.risk_level, "high-risk-write");
assert.equal(developerPushPermission?.requires_user_confirmation, true);
assert.equal(developerPushPermission?.log_required, true);
assert.equal(developerPushPermission?.can_modify_canon, false);
assert.equal(developerPushPermission?.can_modify_active_engine, false);
assert.equal(developerPushPermission?.can_modify_story_graph, false);
assert.equal(developerPushPermission?.can_modify_memory, false);
assert.deepEqual(
  developerPushPermission?.allowed_sources,
  ["repository_git_head", "repository_git_remote_origin", "mcp_client_expected_head"],
);
assert.equal(listedPublicNames.includes("dev_git_push"), false);
assert.equal(publicToolMap.has("dev_git_push"), false);
assert.equal(publicToolNames.length, 40);
assert.equal(developerNames.length, 49);
assert.equal(fullNames.length, 107);

const formalWorldPublicNames = [
  "chatgpt_bridge_begin_world_simulation_session",
  "chatgpt_bridge_prepare_world_turn",
  "chatgpt_bridge_submit_world_character_action",
  "chatgpt_bridge_resolve_world_turn",
];
const legacyWorldCapabilityNames = [
  "chatgpt_bridge_use_world_scene_causal_analyzer",
  "chatgpt_bridge_use_world_perception_filter",
  "chatgpt_bridge_use_world_memory_retriever",
  "chatgpt_bridge_use_world_character_cognition",
  "chatgpt_bridge_use_world_action_proposer",
  "chatgpt_bridge_use_world_agency_guard",
  "chatgpt_bridge_use_world_consistency_critic",
];
for (const toolName of formalWorldPublicNames) {
  assert(publicToolMap.has(toolName), `chatgpt_public missing formal world tool ${toolName}`);
}
for (const toolName of legacyWorldCapabilityNames) {
  assert.equal(publicToolMap.has(toolName), false, `legacy world capability leaked into chatgpt_public: ${toolName}`);
}
const publicWorldBeginSchema = publicToolMap.get(
  "chatgpt_bridge_begin_world_simulation_session",
)?.inputSchema?.properties ?? {};
assert.equal(publicWorldBeginSchema.initial_world_state?.type, "object");
assert.deepEqual(
  Object.keys(publicToolMap.get("chatgpt_bridge_prepare_world_turn")?.inputSchema?.properties ?? {}).sort(),
  ["world_simulation_session_id"],
);
assert.deepEqual(
  Object.keys(publicToolMap.get("chatgpt_bridge_submit_world_character_action")?.inputSchema?.properties ?? {}).sort(),
  ["action_id", "decision_handle", "prepared_turn_handle", "reject_all"],
);
assert.deepEqual(
  Object.keys(publicToolMap.get("chatgpt_bridge_resolve_world_turn")?.inputSchema?.properties ?? {}).sort(),
  ["prepared_turn_handle"],
);
const publicNativeHandoffTool = publicToolMap.get(
  "chatgpt_bridge_build_full_neural_writing_handoff",
);
assert(
  publicNativeHandoffTool,
  "chatgpt_public missing chatgpt_bridge_build_full_neural_writing_handoff",
);
assert.match(
  publicNativeHandoffTool.description ?? "",
  /aggregate compatibility|not the architecture-primary route/i,
  "aggregate handoff description should preserve compatibility semantics",
);
assert.match(
  publicNativeHandoffTool.description ?? "",
  /does not call or require a backend generation provider|does not save a candidate|does not update Canon|does not update active_engine/i,
  "chatgpt_bridge_build_full_neural_writing_handoff description should preserve no-provider/no-canon/no-candidate safety",
);

const nativeHandoffSchema = publicNativeHandoffTool.inputSchema?.properties ?? {};
for (const forbiddenField of ["provider_type", "provider_id", "model_name", "save_candidate", "generation_provider"]) {
  assert.equal(
    Object.hasOwn(nativeHandoffSchema, forbiddenField),
    false,
    `native handoff schema leaked provider/candidate field ${forbiddenField}`,
  );
}

const nativePermission = publicNativeHandoffTool._meta?.["armed-academy/permission"];
assert.equal(nativePermission?.permission_level, "write_low_risk");
assert.equal(nativePermission?.can_modify_canon, false);
assert.equal(nativePermission?.can_modify_active_engine, false);
assert(nativePermission?.allowed_sources?.includes("user_input"));
assert(nativePermission?.allowed_sources?.includes("registered_project_sources"));
assert(nativePermission?.allowed_sources?.includes("gpt_writing_context_records"));
assert.equal(
  nativePermission?.allowed_sources?.includes("generation_provider"),
  false,
  "native handoff permissionSources must not require generation_provider",
);

const publicNeuralPipelineTool = publicToolMap.get(
  "chatgpt_bridge_run_full_neural_writing_pipeline",
);
assert(
  publicNeuralPipelineTool,
  "chatgpt_public missing chatgpt_bridge_run_full_neural_writing_pipeline fallback",
);
assert.match(
  publicNeuralPipelineTool.description ?? "",
  /Optional fallback|generation-provider|provider_type|not the ChatGPT-native mainline/i,
  "chatgpt_bridge_run_full_neural_writing_pipeline should be documented as optional provider fallback",
);
assert.match(
  publicNeuralPipelineTool.description ?? "",
  /not the ChatGPT-native mainline/i,
  "provider pipeline description should not claim primary ChatGPT orchestration ownership",
);
const publicContextTool = publicToolMap.get("chatgpt_bridge_build_writing_context");
assert.match(
  publicContextTool?.description ?? "",
  /context-only|context only|not.*final.*story|do not use.*final/i,
  "chatgpt_bridge_build_writing_context description should warn it is context-only and not final story output",
);
assert.match(
  publicContextTool?.description ?? "",
  /chatgpt_bridge_begin_external_brain_writing_session/i,
  "context tool should route formal writing to the GPT-owned external brain entry",
);

const primaryEntry = publicToolMap.get("chatgpt_bridge_begin_external_brain_writing_session");
assert.match(primaryEntry?.description ?? "", /Architecture-primary formal writing entry/i);
const ephemeralDraftReview = publicToolMap.get(
  "chatgpt_bridge_review_draft_ephemeral",
);
assert(ephemeralDraftReview, "chatgpt_public missing ephemeral draft review");
assert.equal(
  ephemeralDraftReview?.annotations?.readOnlyHint,
  true,
  "ephemeral draft review is not marked read-only",
);
assert.match(
  ephemeralDraftReview?.description ?? "",
  /ephemeral.*draft review|draft review.*ephemeral/i,
);
assert.match(
  ephemeralDraftReview?.description ?? "",
  /no candidate|creates no candidate/i,
);
assert.match(
  ephemeralDraftReview?.description ?? "",
  /no Canon|performs no Canon/i,
);
const ephemeralReviewSchema = ephemeralDraftReview?.inputSchema ?? {};
assert.deepEqual(
  [...(ephemeralReviewSchema.required ?? [])].sort(),
  ["draft_text", "task_prompt"],
);
for (const forbiddenField of [
  "persist_context",
  "external_brain_session_id",
  "writing_context_bundle_id",
]) {
  assert.equal(
    Object.hasOwn(ephemeralReviewSchema.properties ?? {}, forbiddenField),
    false,
    `ephemeral draft review exposed forbidden field ${forbiddenField}`,
  );
}
for (const name of [
  "scene_planner", "character_simulator", "neural_critic", "style_drift_detector",
  "over_governance_detector", "writing_card_director", "final_polisher",
]) assert(publicToolMap.has(`chatgpt_bridge_use_${name}`), `missing individual capability ${name}`);

const publicWritingContextSchema = publicToolMap.get(
  "chatgpt_bridge_build_writing_context",
)?.inputSchema?.properties;
for (const field of ["run_neural_traces", "runNeuralTraces"]) {
  assert.equal(
    publicWritingContextSchema?.[field]?.type,
    "boolean",
    `chatgpt_public chatgpt_bridge_build_writing_context did not expose ${field} as boolean`,
  );
  assert.equal(
    publicWritingContextSchema?.[field]?.default,
    false,
    `chatgpt_public chatgpt_bridge_build_writing_context ${field} default drifted`,
  );
  assert.match(
    publicWritingContextSchema?.[field]?.description ?? "",
    /default false/i,
    `chatgpt_public ${field} schema should document default false`,
  );
  assert.match(
    publicWritingContextSchema?.[field]?.description ?? "",
    /never fake trace success/i,
    `chatgpt_public ${field} schema should document no fake trace success`,
  );
}

const fullToolMap = new Map(fullResponses[0].result.tools.map((tool) => [tool.name, tool]));
for (const toolName of legacyWorldCapabilityNames) {
  assert(fullToolMap.has(toolName), `full profile lost world debug capability ${toolName}`);
}
for (const toolName of formalWorldPublicNames) {
  assert(fullToolMap.has(toolName), `full profile lost formal world tool ${toolName}`);
}
for (const toolName of ["chatgpt_bridge_build_writing_context", "build_gpt_writing_context"]) {
  const schema = fullToolMap.get(toolName)?.inputSchema?.properties;
  for (const field of ["run_neural_traces", "runNeuralTraces"]) {
    assert.equal(schema?.[field]?.type, "boolean", `full ${toolName} did not expose ${field} as boolean`);
    assert.equal(schema?.[field]?.default, false, `full ${toolName} ${field} default drifted`);
  }
}

for (const [index, toolName] of blockedToolNames.entries()) {
  assert(!listedPublicNames.includes(toolName), `${toolName} leaked into tools/list`);
  const response = publicResponses.find(
    (item) => item.id === `blocked-${index}`,
  );
  assert.equal(response.error.code, -32602);
  assert.equal(
    response.error.message,
    `Tool not allowed by MCP tool profile chatgpt_public: ${toolName}`,
    `${toolName} reached validation or execution instead of the profile guard`,
  );
}
assert.deepEqual(
  publicResponses.find((response) => response.id === "ping").result,
  {},
);

const componentStatusResponse = publicResponses.find(
  (response) => response.id === "component-status",
);
assert.equal(componentStatusResponse.result.isError, undefined);
const componentStatus = JSON.parse(componentStatusResponse.result.content[0].text);
assert.equal(componentStatus.ok, true);
assert.equal(componentStatus.read_only, true);
assert.equal(componentStatus.components.neural_pipeline.required, true);

const dependencyStatusResponse = publicResponses.find(
  (response) => response.id === "dependency-status",
);
assert.equal(dependencyStatusResponse.result.isError, undefined);
const dependencyStatus = JSON.parse(dependencyStatusResponse.result.content[0].text);
assert.equal(dependencyStatus.ok, true);
assert.equal(dependencyStatus.read_only, true);
assert.deepEqual(dependencyStatus.issues, []);

for (const filePath of publicReadPaths) {
  assert.equal(
    sha256(await readFile(filePath)),
    publicReadHashesBefore.get(filePath),
    `${path.relative(rootDir, filePath)} changed during public read-only call`,
  );
}

const originalAdapterProfile = process.env.MCP_TOOL_PROFILE;
delete process.env.MCP_TOOL_PROFILE;
const adapterSession = createStdioSession();
try {
  const adapterList = await adapterCall(adapterSession, {
    jsonrpc: "2.0",
    id: "adapter-list",
    method: "tools/list",
    params: {},
  });
  assert.deepEqual(
    adapterList.result.tools.map((tool) => tool.name).sort(),
    [...publicToolNames].sort(),
    "HTTP stdio adapter did not start its child with chatgpt_public",
  );
} finally {
  adapterSession.close();
}

publicToolNames.push(
  "dev_read_file_range",
  "dev_git_status",
  "dev_git_diff",
  "dev_git_diff_check",
  "dev_delete_file",
);
process.env.MCP_TOOL_PROFILE = "chatgpt_developer";
const developerAdapterSession = createStdioSession();
try {
  const adapterList = await adapterCall(developerAdapterSession, {
    jsonrpc: "2.0",
    id: "developer-adapter-list",
    method: "tools/list",
    params: {},
  });
  assert.deepEqual(
    adapterList.result.tools.map((tool) => tool.name).sort(),
    [...publicToolNames, "dev_apply_patch", "dev_run_tests", "dev_git_commit", "dev_git_push"].sort(),
    "HTTP stdio adapter did not honor MCP_TOOL_PROFILE=chatgpt_developer",
  );
} finally {
  developerAdapterSession.close();
  publicToolNames.splice(-5, 5);
  if (originalAdapterProfile === undefined) {
    delete process.env.MCP_TOOL_PROFILE;
  } else {
    process.env.MCP_TOOL_PROFILE = originalAdapterProfile;
  }
}

console.log(
  `MCP tool profile tests passed (public=${publicToolNames.length}, developer=${publicToolNames.length + 9}).`,
);
