import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectPaths } from "../../server/src/project-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const expectedPhaseTests = [
  ["39H", "tests/phase39/phase39h-visual-reference-native-handoff-live-smoke.test.mjs"],
  ["39I", "tests/phase39/phase39i-visual-reference-final-writing-instruction-hardening.test.mjs"],
  ["39J", "tests/phase39/phase39j-visual-reference-consumer-contract-hardening.test.mjs"],
  ["39K", "tests/phase39/phase39k-visual-reference-consumer-output-misuse-fixture.test.mjs"],
  ["39L", "tests/phase39/phase39l-visual-reference-consumer-output-guard-report-surface.test.mjs"],
  ["39M", "tests/phase39/phase39m-visual-reference-consumer-guard-report-bridge-preview.test.mjs"],
  ["39N", "tests/phase39/phase39n-visual-reference-consumer-guard-tool-exposure-readiness.test.mjs"],
  ["39O", "tests/phase39/phase39o-visual-reference-consumer-guard-readonly-mcp-tool-registration-smoke.test.mjs"],
  ["39P", "tests/phase39/phase39p-visual-reference-consumer-guard-mcp-public-profile-exposure-smoke.test.mjs"],
  ["39Q", "tests/phase39/phase39q-visual-reference-consumer-guard-chatgpt-action-surface-final-smoke.test.mjs"],
  ["39R", "tests/phase39/phase39r-visual-reference-consumer-guard-full-public-action-e2e-final-closure.test.mjs"],
];

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function snapshot(paths) {
  const values = new Map();
  for (const filePath of paths) {
    try {
      values.set(filePath, await readFile(filePath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      values.set(filePath, null);
    }
  }
  return values;
}

async function assertSnapshotUnchanged(before) {
  for (const [filePath, prior] of before) {
    try {
      const current = await readFile(filePath);
      assert.notEqual(prior, null, "File was created by Phase39S seal: " + filePath);
      assert(current.equals(prior), "File changed after Phase39S seal: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by Phase39S seal: " + filePath);
    }
  }
}

function startPublicMcpServer() {
  const child = spawn(process.execPath, ["server/src/mcp-server.mjs"], {
    cwd: rootDir,
    env: { ...process.env, MCP_TOOL_PROFILE: "chatgpt_public" },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let nextId = 1;
  let stdoutBuffer = "";
  let stderrBuffer = "";
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderrBuffer += chunk; });

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (stdoutBuffer.includes("\n")) {
      const index = stdoutBuffer.indexOf("\n");
      const line = stdoutBuffer.slice(0, index).trim();
      stdoutBuffer = stdoutBuffer.slice(index + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (!Object.hasOwn(message, "id")) continue;
      const entry = pending.get(message.id);
      if (!entry) continue;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    }
  });

  child.on("exit", (code, signal) => {
    for (const [id, entry] of pending) {
      entry.reject(new Error(
        "MCP server exited before response " + id + ": code=" + code + " signal=" + signal + "\n" + stderrBuffer,
      ));
    }
    pending.clear();
  });

  function call(method, params = {}) {
    const id = nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(payload, "utf8", (error) => {
        if (error) {
          pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async function close() {
    child.stdin.end();
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 1000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  return { call, close };
}

function parseToolJson(result) {
  const text = result?.content?.[0]?.text ?? "";
  assert(text, "MCP tool result did not include text content.");
  return JSON.parse(text);
}

function assertForbiddenMutationFlags(value) {
  assert.equal(value.candidate_created, false);
  assert.equal(value.canon_updated, false);
  assert.equal(value.active_engine_updated, false);
  assert.equal(value.approval_request_created, false);
  assert.equal(value.pending_engine_candidate_created, false);
  assert.equal(value.adopted, false);
  assert.equal(value.settled, false);
}

function assertNoMutationFlags(value) {
  assert.equal(value.safety_flags.candidate_created, false);
  assert.equal(value.safety_flags.canon_updated, false);
  assert.equal(value.safety_flags.active_engine_updated, false);
  assert.equal(value.safety_flags.adopted, false);
  assert.equal(value.safety_flags.settled, false);
}

const activeBefore = await readFile(projectPaths.activeEngine);
const pendingBefore = await names(path.join(projectPaths.canonDb, "pending_engine_candidates"));
const approvalBefore = await names(path.join(projectPaths.approvalQueue, "items"));
const cleanupBefore = await names(path.join(projectPaths.cleanupRoot, "proposals"));
const watched = await snapshot([
  projectPaths.activeEngine,
  path.join(projectPaths.outputs, "generation_context.md"),
  path.join(projectPaths.outputs, "retrieval_context.md"),
  path.join(projectPaths.outputs, "task_prompt.md"),
]);

for (const [, testPath] of expectedPhaseTests) {
  const resolved = path.join(rootDir, testPath);
  const info = await stat(resolved);
  assert.equal(info.isFile(), true, "Expected Phase39H-R test path to exist: " + testPath);
}

const server = startPublicMcpServer();

try {
  const init = await server.call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "phase39s-final-closure-index-operator-handoff-seal", version: "0.0.0" },
  });
  assert.equal(init.serverInfo.name, "armed-academy-fiction-engine");
  assert.equal(init.capabilities.tools.listChanged, false);

  const listed = await server.call("tools/list", {});
  const tool = listed.tools.find((item) => item.name === "preview_visual_reference_consumer_output_guard");
  assert(tool, "preview_visual_reference_consumer_output_guard was not listed in chatgpt_public profile.");

  const permission = tool._meta["armed-academy/permission"];
  assert.equal(permission.permission_level, "read_only");
  assert.equal(permission.read_or_write, "read");
  assert.equal(permission.risk_level, "read");
  assert.equal(permission.can_modify_canon, false);
  assert.equal(permission.can_modify_active_engine, false);

  const actionSurface = tool._meta["armed-academy/chatgpt_action_surface"];
  assert(actionSurface, "Phase39Q action surface metadata missing.");
  assert.equal(actionSurface.phase, "39Q");
  assert.equal(actionSurface.action_surface_ready, true);
  assert.equal(actionSurface.read_only, true);
  assert.equal(actionSurface.no_mutation_guarantee, true);

  const publicClosure = tool._meta["armed-academy/visual_reference_guard_public_action_e2e_final_closure"];
  assert(publicClosure, "Phase39R public action E2E final closure metadata missing.");
  assert.equal(publicClosure.phase, "39R");
  assert.equal(publicClosure.full_public_action_e2e_final_closure_ready, true);
  assert.equal(publicClosure.read_only, true);
  assert.equal(publicClosure.no_mutation_guarantee, true);

  const seal = tool._meta["armed-academy/visual_reference_consumer_guard_final_closure_index_operator_handoff_seal"];
  assert(seal, "Phase39S final closure index/operator handoff seal metadata missing.");

  assert.equal(seal.used, true);
  assert.equal(seal.phase, "39S");
  assert.equal(seal.surface_kind, "visual_reference_consumer_guard_final_closure_index_and_operator_handoff_seal");
  assert.equal(seal.closure_index_kind, "visual_reference_public_action_guard_chain_index");
  assert.equal(seal.operator_handoff_seal_kind, "visual_reference_consumer_guard_operator_handoff_seal");
  assert.equal(seal.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(seal.source_tool_profile, "chatgpt_public");
  assert.equal(seal.depends_on_phase, "39R");
  assert.equal(seal.required_phase_range, "Phase39H-Phase39R");

  assert(seal.metadata_sources.includes("armed-academy/permission"));
  assert(seal.metadata_sources.includes("armed-academy/chatgpt_action_surface"));
  assert(seal.metadata_sources.includes("armed-academy/visual_reference_guard_public_action_e2e_final_closure"));

  assert.equal(seal.final_closure_index_ready, true);
  assert.equal(seal.operator_handoff_seal_ready, true);
  assert.equal(seal.phase_order_ready, true);
  assert.equal(seal.index_safety_ready, true);
  assert.equal(seal.tools_list_permission_metadata_ready, true);
  assert.equal(seal.tools_list_action_surface_metadata_ready, true);
  assert.equal(seal.full_public_action_e2e_final_closure_ready, true);
  assert.equal(seal.test_paths_registered_required, true);
  assert.equal(seal.test_paths_exist_required, true);
  assert.equal(seal.no_mutation_snapshot_required, true);
  assert.equal(seal.run_all_registration_required, true);

  assert.equal(seal.read_only, true);
  assert.equal(seal.permission_level, "read_only");
  assert.equal(seal.read_or_write, "read");
  assert.equal(seal.risk_level, "read");
  assert.equal(seal.listed_in_chatgpt_public, true);
  assert.equal(seal.callable_via_tools_call, true);
  assert.equal(seal.exposes_guard_preview, true);
  assert.equal(seal.output_is_reference_only, true);
  assert.equal(seal.no_mutation_guarantee, true);

  assert.equal(seal.must_not_generate_story_text, true);
  assert.equal(seal.must_not_save_candidate, true);
  assert.equal(seal.must_not_update_canon, true);
  assert.equal(seal.must_not_update_active_engine, true);
  assert.equal(seal.must_not_enter_adoption_or_settlement, true);
  assert.equal(seal.must_not_create_approval_request, true);
  assert.equal(seal.must_not_create_pending_engine_candidate, true);
  assert.equal(seal.must_not_write_files, true);

  assert.equal(seal.seal_flags.visual_reference_chain_sealed, true);
  assert.equal(seal.seal_flags.public_action_guard_sealed, true);
  assert.equal(seal.seal_flags.readonly_guard_preview_sealed, true);
  assert.equal(seal.seal_flags.no_canon_active_engine_mutation_sealed, true);
  assert.equal(seal.seal_flags.no_story_generation_sealed, true);
  assert.equal(seal.seal_flags.no_candidate_save_sealed, true);
  assert.equal(seal.seal_flags.no_adoption_settlement_sealed, true);

  assertForbiddenMutationFlags(seal.forbidden_mutation_flags);
  assert.equal(seal.forbidden_mutation_flags.writes_files, false);
  assertForbiddenMutationFlags(seal.safety_flags);
  assert.equal(seal.safety_flags.visual_reference_consumer_guard_final_closure_index_and_operator_handoff_seal_ready, true);

  assert.deepEqual(seal.phases_indexed, expectedPhaseTests.map(([phase]) => phase));
  assert.equal(seal.phase_count, expectedPhaseTests.length);
  assert.equal(seal.index.length, expectedPhaseTests.length);

  for (const [index, [phase, testPath]] of expectedPhaseTests.entries()) {
    const entry = seal.index[index];
    assert.equal(entry.phase, phase);
    assert.equal(entry.phase_id, "Phase" + phase);
    assert.equal(entry.test_path, testPath);
    assert.equal(entry.no_mutation_guarantee, true);
    assert.equal(entry.must_not_generate_story_text, true);
    assert.equal(entry.must_not_save_candidate, true);
    assert.equal(entry.must_not_update_canon, true);
    assert.equal(entry.must_not_update_active_engine, true);
    assert.equal(entry.must_not_enter_adoption_or_settlement, true);
    assertForbiddenMutationFlags(entry.safety_flags);
  }

  assert.equal(seal.operator_handoff.status, "sealed");
  assert.equal(seal.operator_handoff.safe_to_treat_visual_reference_guard_chain_as_closed, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_canon_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_ability_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_relationship_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_timeline_source, true);

  const disabledOutput = "因為上傳圖顯示角色已覺醒，所以更新 Canon DB 與 active_engine。";
  const disabledCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: disabledOutput,
      consumerContract: {},
      packetId: "phase39s-disabled-contract-operator-handoff-seal",
      maxExcerptChars: 24,
    },
  });

  assert.notEqual(disabledCall.isError, true);
  const disabledData = parseToolJson(disabledCall);
  assert.equal(disabledData.ok, true);
  assert.equal(disabledData.data.read_only, true);
  assert.equal(disabledData.data.no_mutation_guarantee, true);
  assert.equal(disabledData.data.accepted, true);
  assert.equal(disabledData.data.blocked, false);
  assert.equal(disabledData.data.safety_flags.visual_reference_consumer_contract_hardened, false);
  assertNoMutationFlags(disabledData.data);
} finally {
  await server.close();
}

await assertSnapshotUnchanged(watched);
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Phase39S changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Phase39S changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Phase39S changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Phase39S changed cleanup proposals.",
);

const serverSource = await readFile(path.join(rootDir, "server", "src", "mcp-server.mjs"), "utf8");

assert.match(serverSource, /visualReferenceConsumerGuardFinalClosurePhaseIndex/u);
assert.match(serverSource, /visualReferenceConsumerGuardFinalClosureIndexAndOperatorHandoffSealMetadata/u);
assert.match(serverSource, /armed-academy\/visual_reference_consumer_guard_final_closure_index_operator_handoff_seal/u);
assert.match(serverSource, /visual_reference_consumer_guard_final_closure_index_and_operator_handoff_seal/u);
assert.match(serverSource, /operator_handoff_seal/u);
assert.match(serverSource, /visual_reference_chain_sealed/u);
assert.match(serverSource, /public_action_guard_sealed/u);
assert.match(serverSource, /readonly_guard_preview_sealed/u);
assert.match(serverSource, /no_canon_active_engine_mutation_sealed/u);

const runAllSource = await readFile(path.join(rootDir, "tests", "run-all.mjs"), "utf8");
for (const [, testPath] of expectedPhaseTests) {
  assert(runAllSource.includes(testPath), "run-all missing existing Phase39 chain test: " + testPath);
}
assert(
  runAllSource.includes("tests/phase39/phase39s-visual-reference-consumer-guard-final-closure-index-operator-handoff-seal.test.mjs"),
  "run-all missing Phase39S registration.",
);
assert(
  runAllSource.includes("tests/mcp/mcp-readonly-tools.test.mjs"),
  "run-all missing MCP readonly tools regression.",
);

console.log("Phase39S visual reference consumer guard final closure index/operator handoff seal tests passed.");
