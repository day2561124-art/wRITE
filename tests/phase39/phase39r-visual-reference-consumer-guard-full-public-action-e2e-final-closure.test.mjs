import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChatgptNativeNeuralWritingHandoff,
} from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const taskPrompt = "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。";

const expectedNeuralModules = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
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
      assert.notEqual(prior, null, "File was created by full public action E2E final closure: " + filePath);
      assert(current.equals(prior), "File changed after full public action E2E final closure: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by full public action E2E final closure: " + filePath);
    }
  }
}

function fakeContextBundle() {
  const visual_uploaded_references = {
    loaded: true,
    reference_count: 2,
    injection_scope: "writing_context_visual_only",
    canon_status: "reference_only",
    safety_contract: {
      visual_only: true,
      must_not_establish_canon: true,
      must_not_infer_abilities: true,
      must_not_infer_relationships: true,
      must_not_update_active_engine: true,
      must_not_update_canon_db: true,
    },
    items: [
      {
        visual_id: "VIS-PHASE39R-MISAKI-REVERSAL",
        character: "御先反轉型態",
        title: "御先反轉型態 user uploaded visual reference",
        canon_status: "reference",
        ability_state: "visual_only",
        visual_usage_scope: "visual_only_reference",
        allowed_usage: ["appearance guidance", "pose guidance", "style guidance", "atmosphere guidance"],
        forbidden_usage: ["canon facts", "ability mechanics", "soul weapons", "relationships", "ranks", "factions", "timeline events", "chapter outcomes"],
      },
      {
        visual_id: "VIS-PHASE39R-CATWOLF",
        character: "貓狼",
        title: "貓狼 user uploaded visual reference",
        canon_status: "reference",
        ability_state: "visual_only",
        visual_usage_scope: "visual_only_reference",
        allowed_usage: ["appearance guidance", "pose guidance", "style guidance", "atmosphere guidance"],
        forbidden_usage: ["canon facts", "ability mechanics", "soul weapons", "relationships", "ranks", "factions", "timeline events", "chapter outcomes"],
      },
    ],
  };

  return {
    bundle_id: "phase39r-visual-reference-consumer-guard-full-public-action-e2e-final-closure-context",
    task_prompt: taskPrompt,
    output_mode: "chat_only",
    neural_pipeline_required: true,
    required_neural_modules: expectedNeuralModules,
    engine_components_status: {
      components: {
        neural_pipeline: {
          modules: expectedNeuralModules.map((name) => ({
            name,
            required_status: "available",
          })),
        },
      },
    },
    active_engine_excerpt_or_reference: {
      text: "active_engine reference only: text canon overrides visual-only references.",
    },
    writing_card_excerpt_or_reference: {
      text: "圖片只能作外觀、姿態、服裝與氛圍參考。",
    },
    proofing_card_excerpt_or_reference: {
      text: "Full public action E2E final closure must remain readonly and reference-only.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史。",
    },
    retrieval_context: { phase: "39R", visual_uploaded_references },
    generation_context: { phase: "39R", visual_uploaded_references },
  };
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

  return { call, close, stderr: () => stderrBuffer };
}

function parseToolJson(result) {
  const text = result?.content?.[0]?.text ?? "";
  assert(text, "MCP tool result did not include text content.");
  return JSON.parse(text);
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

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39R",
    route_expectation: "visual_reference_consumer_guard_full_public_action_e2e_final_closure",
  },
  retrieval_context: { acceptance_smoke: "phase39r" },
  chapter_mode: "next_chapter",
  output_mode: "chatgpt_native_handoff",
  max_context_chars: 48000,
}, {
  buildGptWritingContextFn: async () => fakeContextBundle(),
});

assert.equal(result.tool_name, "chatgpt_bridge_build_full_neural_writing_handoff");
assert.equal(result.status, "ready_for_chatgpt_native_generation");
assert.equal(result.candidate_created, false);
assert.equal(result.candidate_id, null);
assert.equal(result.canon_updated, false);
assert.equal(result.active_engine_updated, false);
assert.equal(result.adopted, false);
assert.equal(result.settled, false);

const handoff = result.chatgpt_native_writing_handoff;
const consumerContract = handoff.chatgpt_native_consumer_contract;

assert.equal(handoff.constraints.visual_reference_final_instruction_hardened, true);
assert.equal(handoff.constraints.visual_reference_consumer_contract_hardened, true);
assert.equal(consumerContract.visual_reference_consumer_contract_hardened, true);
assert.equal(consumerContract.visual_reference_consumer_contract.enabled, true);

const server = startPublicMcpServer();

try {
  const init = await server.call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "phase39r-public-action-e2e-final-closure", version: "0.0.0" },
  });
  assert.equal(init.serverInfo.name, "armed-academy-fiction-engine");
  assert.equal(init.capabilities.tools.listChanged, false);

  const listed = await server.call("tools/list", {});
  const tool = listed.tools.find((item) => item.name === "preview_visual_reference_consumer_output_guard");
  assert(tool, "preview_visual_reference_consumer_output_guard was not listed in chatgpt_public profile.");

  const permission = tool._meta["armed-academy/permission"];
  assert.equal(permission.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(permission.permission_level, "read_only");
  assert.equal(permission.read_or_write, "read");
  assert.equal(permission.risk_level, "read");
  assert.equal(permission.requires_user_confirmation, false);
  assert.equal(permission.requires_backup_before_write, false);
  assert.equal(permission.can_modify_canon, false);
  assert.equal(permission.can_modify_active_engine, false);
  assert.equal(permission.can_modify_story_graph, false);
  assert.equal(permission.can_modify_memory, false);
  assert.equal(permission.log_required, false);

  const actionSurface = tool._meta["armed-academy/chatgpt_action_surface"];
  assert(actionSurface, "ChatGPT action surface metadata missing.");
  assert.equal(actionSurface.phase, "39Q");
  assert.equal(actionSurface.action_surface_ready, true);
  assert.equal(actionSurface.read_only, true);
  assert.equal(actionSurface.no_mutation_guarantee, true);
  assert.equal(actionSurface.must_not_generate_story_text, true);
  assert.equal(actionSurface.must_not_save_candidate, true);
  assert.equal(actionSurface.must_not_update_canon, true);
  assert.equal(actionSurface.must_not_update_active_engine, true);
  assert.equal(actionSurface.must_not_enter_adoption_or_settlement, true);
  assert.equal(actionSurface.must_not_create_approval_request, true);
  assert.equal(actionSurface.must_not_create_pending_engine_candidate, true);
  assert.equal(actionSurface.must_not_write_files, true);
  assertNoMutationFlags(actionSurface);

  const closure = tool._meta["armed-academy/visual_reference_guard_public_action_e2e_final_closure"];
  assert(closure, "Visual reference guard public action E2E final closure metadata missing.");
  assert.equal(closure.used, true);
  assert.equal(closure.phase, "39R");
  assert.equal(
    closure.surface_kind,
    "visual_reference_consumer_guard_full_public_action_e2e_final_closure",
  );
  assert.equal(closure.closure_kind, "chatgpt_public_action_e2e_final_closure");
  assert.equal(closure.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(closure.source_tool_profile, "chatgpt_public");
  assert.equal(closure.depends_on_phase, "39Q");
  assert(closure.metadata_sources.includes("armed-academy/permission"));
  assert(closure.metadata_sources.includes("armed-academy/chatgpt_action_surface"));
  assert.equal(closure.full_public_action_e2e_final_closure_ready, true);
  assert.equal(closure.tools_list_permission_metadata_ready, true);
  assert.equal(closure.tools_list_action_surface_metadata_ready, true);
  assert.equal(closure.tools_call_valid_payload_required, true);
  assert.equal(closure.tools_call_blocked_payload_required, true);
  assert.equal(closure.tools_call_disabled_contract_payload_required, true);
  assert.equal(closure.no_mutation_snapshot_required, true);
  assert.equal(closure.run_all_registration_required, true);
  assert.equal(closure.read_only, true);
  assert.equal(closure.permission_level, "read_only");
  assert.equal(closure.read_or_write, "read");
  assert.equal(closure.risk_level, "read");
  assert.equal(closure.listed_in_chatgpt_public, true);
  assert.equal(closure.callable_via_tools_call, true);
  assert.equal(closure.exposes_guard_preview, true);
  assert.equal(closure.output_is_reference_only, true);
  assert.equal(closure.closure_must_not_replace_final_output, true);
  assert.equal(closure.closure_must_not_be_emitted_as_story_text, true);
  assert.equal(closure.no_mutation_guarantee, true);
  assert.equal(closure.must_not_generate_story_text, true);
  assert.equal(closure.must_not_save_candidate, true);
  assert.equal(closure.must_not_update_canon, true);
  assert.equal(closure.must_not_update_active_engine, true);
  assert.equal(closure.must_not_enter_adoption_or_settlement, true);
  assert.equal(closure.must_not_create_approval_request, true);
  assert.equal(closure.must_not_create_pending_engine_candidate, true);
  assert.equal(closure.must_not_write_files, true);
  assert.equal(closure.closure_contract.valid_payload_must_accept, true);
  assert.equal(closure.closure_contract.invalid_payload_must_return_readonly_blocked_result, true);
  assert.equal(closure.closure_contract.disabled_contract_payload_must_accept_without_mutation, true);
  assert.equal(closure.closure_contract.must_preserve_permission_metadata, true);
  assert.equal(closure.closure_contract.must_preserve_action_surface_metadata, true);
  assert.equal(closure.closure_contract.must_preserve_no_mutation_snapshot, true);
  assert.equal(closure.safety_flags.visual_reference_guard_full_public_action_e2e_final_closure_ready, true);
  assert.equal(closure.safety_flags.candidate_created, false);
  assert.equal(closure.safety_flags.canon_updated, false);
  assert.equal(closure.safety_flags.active_engine_updated, false);
  assert.equal(closure.safety_flags.approval_request_created, false);
  assert.equal(closure.safety_flags.pending_engine_candidate_created, false);
  assert.equal(closure.safety_flags.adopted, false);
  assert.equal(closure.safety_flags.settled, false);

  for (const forbiddenPublicTool of [
    "activate_engine_version",
    "import_policy_file",
    "commit_error_report",
    "compress_error_rules",
  ]) {
    assert(
      !listed.tools.some((item) => item.name === forbiddenPublicTool),
      forbiddenPublicTool + " must not be listed in chatgpt_public profile.",
    );
  }

  const validOutput = "第〇章　雨光落在袖口\n\n貓狼站在窗邊，外套剪影被走廊燈拉長；這只讓畫面更冷，沒有替任何能力、關係或時間線下定論。";

  const validCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: validOutput,
      consumerContract,
      packetId: "phase39r-valid-public-action-e2e-final-closure",
      maxExcerptChars: 80,
    },
  });
  assert.notEqual(validCall.isError, true, "valid public action E2E call unexpectedly failed.");
  const validData = parseToolJson(validCall);

  assert.equal(validData.ok, true);
  assert.equal(validData.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(validData.canon_status, "readonly_preview");
  assert.equal(validData.blocked, false);
  assert.equal(validData.data.phase, "39N");
  assert.equal(validData.data.tool_exposure_ready, true);
  assert.equal(validData.data.mcp_preview_ready, true);
  assert.equal(validData.data.read_only, true);
  assert.equal(validData.data.no_mutation_guarantee, true);
  assert.equal(validData.data.accepted, true);
  assert.equal(validData.data.blocked, false);
  assert.equal(validData.data.severity, "pass");
  assert.equal(validData.data.active_canon, false);
  assert.equal(validData.data.mcp_tool_registered, true);
  assert.equal(validData.data.mcp_tool_permission, "read_only");
  assert.equal(validData.data.mcp_tool_writes_files, false);
  assert.equal(validData.data.mcp_tool_can_modify_active_engine, false);
  assert.equal(validData.data.mcp_tool_requires_user_confirmation, false);
  assert.equal(validData.data.exposure_contract.must_not_generate_story_text, true);
  assert.equal(validData.data.exposure_contract.must_not_save_candidate, true);
  assert.equal(validData.data.exposure_contract.must_not_update_canon, true);
  assert.equal(validData.data.exposure_contract.must_not_update_active_engine, true);
  assert.equal(validData.data.exposure_contract.must_not_enter_adoption_or_settlement, true);
  assertNoMutationFlags(validData.data);

  const invalidOutput = "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒，並依據圖片更新 Canon DB 與 active_engine。";

  const invalidCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: invalidOutput,
      consumerContract,
      packetId: "phase39r-invalid-public-action-e2e-final-closure",
      maxExcerptChars: 24,
    },
  });
  assert.notEqual(invalidCall.isError, true);
  const invalidData = parseToolJson(invalidCall);

  assert.equal(invalidData.ok, true);
  assert.equal(invalidData.data.tool_exposure_ready, true);
  assert.equal(invalidData.data.mcp_preview_ready, true);
  assert.equal(invalidData.data.read_only, true);
  assert.equal(invalidData.data.no_mutation_guarantee, true);
  assert.equal(invalidData.data.accepted, false);
  assert.equal(invalidData.data.blocked, true);
  assert.equal(invalidData.data.severity, "error");
  assert(invalidData.data.misuse_details.includes("visual_reference_canon_or_story_inference"));
  assert(invalidData.data.misuse_details.includes("visual_reference_canon_db_or_active_engine_update"));
  assert.equal(invalidData.data.exposure_contract.may_expose_as_readonly_tool, true);
  assert.equal(invalidData.data.exposure_contract.may_expose_to_mcp, true);
  assert.equal(invalidData.data.exposure_contract.must_not_generate_story_text, true);
  assert.equal(invalidData.data.exposure_contract.must_not_save_candidate, true);
  assert.equal(invalidData.data.exposure_contract.must_not_update_canon, true);
  assert.equal(invalidData.data.exposure_contract.must_not_update_active_engine, true);
  assert.equal(invalidData.data.exposure_contract.must_not_enter_adoption_or_settlement, true);
  assertNoMutationFlags(invalidData.data);
  assert.equal(invalidData.data.bridge_preview.blocked, true);
  assert.equal(invalidData.data.bridge_preview.operator_review.required, true);
  assert.equal(invalidData.data.bridge_preview.ui_preview.status, "blocked");

  const disabledCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: invalidOutput,
      consumerContract: {},
      packetId: "phase39r-disabled-public-action-e2e-final-closure",
    },
  });
  assert.notEqual(disabledCall.isError, true);
  const disabledData = parseToolJson(disabledCall);
  assert.equal(disabledData.ok, true);
  assert.equal(disabledData.data.tool_exposure_ready, true);
  assert.equal(disabledData.data.mcp_preview_ready, true);
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
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Full public action E2E final closure changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Full public action E2E final closure changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Full public action E2E final closure changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Full public action E2E final closure changed cleanup proposals.",
);

for (const forbiddenTopLevel of [
  "chatgpt_final_output",
  "extracted_chatgpt_final_output",
  "final_response_handoff_for_chat",
  "generation_provider_required",
]) {
  assert.equal(Object.hasOwn(result, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff.constraints, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(consumerContract, forbiddenTopLevel), false);
}

const serverSource = await readFile(
  path.join(rootDir, "server", "src", "mcp-server.mjs"),
  "utf8",
);

assert.match(serverSource, /visualReferenceGuardPublicActionE2eFinalClosureMetadata/u);
assert.match(serverSource, /armed-academy\/visual_reference_guard_public_action_e2e_final_closure/u);
assert.match(serverSource, /visual_reference_consumer_guard_full_public_action_e2e_final_closure/u);
assert.match(serverSource, /tools_call_valid_payload_required/u);
assert.match(serverSource, /tools_call_blocked_payload_required/u);
assert.match(serverSource, /tools_call_disabled_contract_payload_required/u);
assert.match(serverSource, /no_mutation_snapshot_required/u);
assert.match(serverSource, /must_not_update_active_engine/u);
assert.match(serverSource, /must_not_enter_adoption_or_settlement/u);

console.log("Phase39R visual reference consumer guard full public action E2E final closure tests passed.");
