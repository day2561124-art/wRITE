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

const taskPrompt = "Continue the next chapter. Story text only. Start from the chapter title.";

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
      assert.notEqual(prior, null, "File was created by Phase40B post-output seal: " + filePath);
      assert(current.equals(prior), "File changed after Phase40B post-output seal: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by Phase40B post-output seal: " + filePath);
    }
  }
}

function fakeVisualReferences() {
  return {
    loaded: true,
    reference_count: 2,
    injection_scope: "writing_context_visual_only",
    canon_status: "reference_only",
    post_output_acceptance_seal: true,
    safety_contract: {
      visual_only: true,
      must_not_establish_canon: true,
      must_not_infer_abilities: true,
      must_not_infer_soul_weapons: true,
      must_not_infer_relationships: true,
      must_not_infer_timeline_events: true,
      must_not_update_active_engine: true,
      must_not_update_canon_db: true,
    },
    items: [
      {
        visual_id: "VIS-PHASE40B-VALID-REFERENCE",
        character: "phase40b-valid-reference-character",
        title: "visual-only outfit and posture reference",
        canon_status: "reference",
        visual_usage_scope: "visual_only_reference",
        allowed_usage: [
          "appearance guidance",
          "pose guidance",
          "outfit/design guidance",
          "style guidance",
          "atmosphere guidance",
        ],
        forbidden_usage: [
          "canon facts",
          "canon abilities",
          "ability mechanics",
          "ability limits",
          "soul weapons",
          "relationships",
          "ranks",
          "factions",
          "timeline events",
          "chapter events",
          "chapter outcomes",
          "Canon DB updates",
          "active_engine updates",
        ],
      },
      {
        visual_id: "VIS-PHASE40B-BLOCKED-MISUSE-FIXTURE",
        character: "phase40b-blocked-reference-character",
        title: "visual-only misuse fixture",
        canon_status: "reference",
        visual_usage_scope: "visual_only_reference",
        must_block_if_output_uses_visual_as_canon_source: true,
      },
    ],
  };
}

function fakeContextBundle() {
  const visual_uploaded_references = fakeVisualReferences();

  return {
    bundle_id: "phase40b-visual-reference-native-route-consumer-guard-post-output-acceptance-seal-context",
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
      text: [
        "active_engine reference only.",
        "Text canon overrides visual-only references.",
        "Visual-only references cannot establish abilities, Soul-Weapons, relationships, ranks, factions, timeline events, chapter events, or chapter outcomes.",
      ].join("\n"),
    },
    writing_card_excerpt_or_reference: {
      text: [
        "Phase40B verifies post-output consumer guard acceptance seal.",
        "Valid story-like output may use appearance, pose, outfit/design, style, and atmosphere only.",
        "Any output that uses uploaded images to confirm canon facts, abilities, Soul-Weapons, relationships, timeline events, Canon DB updates, or active_engine updates must be blocked by the guard.",
      ].join("\n"),
    },
    proofing_card_excerpt_or_reference: {
      text: "Consumer output guard must accept visual-only compliant prose and block visual-only misuse without mutation.",
    },
    longline_excerpt_or_reference: {
      text: "visual-only references never override text canon and never update active_engine.",
    },
    retrieval_context: {
      phase: "40B",
      route_expectation: "visual_reference_native_route_consumer_guard_post_output_acceptance_seal",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "40B",
      route_expectation: "visual_reference_native_route_consumer_guard_post_output_acceptance_seal",
      visual_uploaded_references,
    },
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
  const flags = value.safety_flags ?? value;
  assert.equal(flags.candidate_created, false);
  assert.equal(flags.canon_updated, false);
  assert.equal(flags.active_engine_updated, false);
  if (Object.hasOwn(flags, "approval_request_created")) {
    assert.equal(flags.approval_request_created, false);
  }
  if (Object.hasOwn(flags, "pending_engine_candidate_created")) {
    assert.equal(flags.pending_engine_candidate_created, false);
  }
  assert.equal(flags.adopted, false);
  assert.equal(flags.settled, false);
}

function assertReadonlyOutputGuardData(data) {
  assert.equal(data.tool_exposure_ready, true);
  assert.equal(data.mcp_preview_ready, true);
  assert.equal(data.read_only, true);
  assert.equal(data.no_mutation_guarantee, true);
  assert.equal(data.active_canon, false);
  assert.equal(data.mcp_tool_registered, true);
  assert.equal(data.mcp_tool_permission, "read_only");
  assert.equal(data.mcp_tool_writes_files, false);
  assert.equal(data.mcp_tool_can_modify_active_engine, false);
  assert.equal(data.mcp_tool_requires_user_confirmation, false);
  assert.equal(data.exposure_contract.must_not_generate_story_text, true);
  assert.equal(data.exposure_contract.must_not_save_candidate, true);
  assert.equal(data.exposure_contract.must_not_update_canon, true);
  assert.equal(data.exposure_contract.must_not_update_active_engine, true);
  assert.equal(data.exposure_contract.must_not_enter_adoption_or_settlement, true);
  assertNoMutationFlags(data);
}

function assertReadonlySeal(value) {
  assert.equal(value.read_only, true);
  assert.equal(value.no_mutation_guarantee, true);
  assert.equal(value.must_not_generate_story_text, true);
  assert.equal(value.must_not_save_candidate, true);
  assert.equal(value.must_not_update_canon, true);
  assert.equal(value.must_not_update_active_engine, true);
  assert.equal(value.must_not_enter_adoption_or_settlement, true);
  assert.equal(value.must_not_create_approval_request, true);
  assert.equal(value.must_not_create_pending_engine_candidate, true);
  assert.equal(value.must_not_write_files, true);
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
    phase: "40B",
    route_expectation: "visual_reference_native_route_consumer_guard_post_output_acceptance_seal",
  },
  retrieval_context: {
    phase: "40B",
    route_expectation: "visual_reference_native_route_consumer_guard_post_output_acceptance_seal",
  },
  chapter_mode: "next_chapter",
  output_mode: "chatgpt_native_handoff",
  max_context_chars: 48000,
}, {
  buildGptWritingContextFn: async () => fakeContextBundle(),
});

assert.equal(result.tool_name, "chatgpt_bridge_build_full_neural_writing_handoff");
assert.equal(result.status, "ready_for_chatgpt_native_generation");
assert.equal(result.output_mode, "chatgpt_native_handoff");
assert.equal(result.candidate_created, false);
assert.equal(result.candidate_id, null);
assert.equal(result.canon_updated, false);
assert.equal(result.active_engine_updated, false);
assert.equal(result.adopted, false);
assert.equal(result.settled, false);

const handoff = result.chatgpt_native_writing_handoff;
assert.equal(handoff.used, true);
assert.equal(handoff.contract_valid, true);
assert.equal(handoff.surface_kind, "chatgpt_native_full_neural_writing_handoff");
assert.equal(handoff.constraints.tool_must_not_generate_story_text, true);
assert.equal(handoff.constraints.chatgpt_may_generate_story_text, true);
assert.equal(handoff.constraints.save_candidate, false);
assert.equal(handoff.constraints.candidate_created, false);
assert.equal(handoff.constraints.canon_update_allowed, false);
assert.equal(handoff.constraints.active_engine_update_allowed, false);
assert.equal(handoff.constraints.adopted, false);
assert.equal(handoff.constraints.settled, false);
assert.equal(handoff.constraints.visual_reference_final_instruction_hardened, true);
assert.equal(handoff.constraints.visual_reference_consumer_contract_hardened, true);
assert.equal(handoff.constraints.visual_reference_canon_inference_allowed, false);
assert.equal(handoff.constraints.visual_reference_active_engine_update_allowed, false);
assert.equal(handoff.constraints.visual_reference_canon_db_update_allowed, false);

assert.match(handoff.final_chatgpt_writing_instruction, /Visual-only reference usage hardening/u);
assert.match(handoff.final_chatgpt_writing_instruction, /visual-only reference/u);
assert.match(handoff.final_chatgpt_writing_instruction, /Canon facts/u);
assert.match(handoff.final_chatgpt_writing_instruction, /active_engine/u);

const consumerContract = handoff.chatgpt_native_consumer_contract;
assert.equal(consumerContract.visual_reference_consumer_contract_hardened, true);
assert.equal(consumerContract.visual_reference_consumer_contract.enabled, true);
assert.equal(consumerContract.visual_reference_consumer_contract.visual_usage_scope, "visual_only_reference");
assert.equal(consumerContract.visual_reference_consumer_contract.canon_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.ability_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.soul_weapon_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.relationship_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.rank_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.faction_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.timeline_event_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.chapter_outcome_inference_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.canon_db_update_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.active_engine_update_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract.must_prefer_text_canon_over_visual_reference, true);
assert.equal(consumerContract.visual_reference_consumer_contract.must_not_establish_canon_from_visual_reference, true);
assert.equal(consumerContract.visual_reference_consumer_contract.must_not_update_active_engine_from_visual_reference, true);
assert.equal(consumerContract.visual_reference_consumer_contract.must_not_update_canon_db_from_visual_reference, true);

const compactBundle = handoff.writing_context.compact_bundle_excerpt;
assert.equal(compactBundle.retrieval_context.visual_uploaded_references.loaded, true);
assert.equal(compactBundle.retrieval_context.visual_uploaded_references.post_output_acceptance_seal, true);
assert.equal(compactBundle.retrieval_context.visual_uploaded_references.canon_status, "reference_only");
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_establish_canon, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_infer_abilities, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_infer_soul_weapons, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_infer_relationships, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_infer_timeline_events, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_update_active_engine, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_update_canon_db, true);

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

const validStoryLikeOutput = [
  "Chapter Zero - Light on the Sleeve",
  "",
  "The figure paused at the far end of the corridor, and the light only clarified posture, sleeve line, outfit texture, and atmosphere.",
  "It did not confirm any ability, Soul-Weapon, relationship, rank, faction, timeline event, chapter event, chapter outcome, Canon DB update, or active_engine update.",
].join("\n");

const visualMisuseOutput = [
  "Chapter Zero - Invalid Visual Inference",
  "",
  "The visual-only reference confirms canon ability and soul weapon awakening. The visual-only reference updates Canon DB and active_engine.",
].join("\n");

const disabledContractOutput = visualMisuseOutput;

const server = startPublicMcpServer();

try {
  const init = await server.call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "phase40b-visual-reference-native-route-consumer-guard-post-output-acceptance-seal",
      version: "0.0.0",
    },
  });
  assert.equal(init.serverInfo.name, "armed-academy-fiction-engine");
  assert.equal(init.capabilities.tools.listChanged, false);

  const listed = await server.call("tools/list", {});
  const guardTool = listed.tools.find((item) => item.name === "preview_visual_reference_consumer_output_guard");
  assert(guardTool, "preview_visual_reference_consumer_output_guard was not listed in chatgpt_public profile.");

  const permission = guardTool._meta["armed-academy/permission"];
  assert.equal(permission.permission_level, "read_only");
  assert.equal(permission.read_or_write, "read");
  assert.equal(permission.risk_level, "read");
  assert.equal(permission.can_modify_canon, false);
  assert.equal(permission.can_modify_active_engine, false);

  const actionSurface = guardTool._meta["armed-academy/chatgpt_action_surface"];
  assert(actionSurface, "Phase39Q action surface metadata missing.");
  assert.equal(actionSurface.phase, "39Q");
  assert.equal(actionSurface.action_surface_ready, true);
  assertReadonlySeal(actionSurface);
  assertNoMutationFlags(actionSurface);

  const publicClosure = guardTool._meta["armed-academy/visual_reference_guard_public_action_e2e_final_closure"];
  assert(publicClosure, "Phase39R public action E2E final closure metadata missing.");
  assert.equal(publicClosure.phase, "39R");
  assert.equal(publicClosure.full_public_action_e2e_final_closure_ready, true);
  assertReadonlySeal(publicClosure);
  assertNoMutationFlags(publicClosure);

  const seal = guardTool._meta["armed-academy/visual_reference_consumer_guard_final_closure_index_operator_handoff_seal"];
  assert(seal, "Phase39S final closure index/operator handoff seal metadata missing.");
  assert.equal(seal.phase, "39S");
  assert.equal(seal.final_closure_index_ready, true);
  assert.equal(seal.operator_handoff_seal_ready, true);
  assert.equal(seal.phase_order_ready, true);
  assert.equal(seal.index_safety_ready, true);
  assert.equal(seal.full_public_action_e2e_final_closure_ready, true);
  assert.equal(seal.seal_flags.visual_reference_chain_sealed, true);
  assert.equal(seal.seal_flags.public_action_guard_sealed, true);
  assert.equal(seal.seal_flags.readonly_guard_preview_sealed, true);
  assert.equal(seal.seal_flags.no_canon_active_engine_mutation_sealed, true);
  assert.equal(seal.operator_handoff.status, "sealed");
  assert.equal(seal.operator_handoff.safe_to_treat_visual_reference_guard_chain_as_closed, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_canon_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_ability_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_relationship_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_timeline_source, true);
  assertReadonlySeal(seal);
  assertNoMutationFlags(seal);

  const validCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: validStoryLikeOutput,
      consumerContract,
      packetId: "phase40b-valid-post-output-acceptance-seal",
      maxExcerptChars: 120,
    },
  });

  assert.notEqual(validCall.isError, true, "Phase40B valid post-output guard call unexpectedly failed.");
  const validData = parseToolJson(validCall);
  assert.equal(validData.ok, true);
  assert.equal(validData.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(validData.canon_status, "readonly_preview");
  assert.equal(validData.blocked, false);
  assert.equal(validData.data.phase, "39N");
  assertReadonlyOutputGuardData(validData.data);
  assert.equal(validData.data.accepted, true);
  assert.equal(validData.data.blocked, false);
  assert.equal(validData.data.severity, "pass");
  assert.equal(validData.data.error_count, 0);
  assert.deepEqual(validData.data.misuse_details, []);
  assert.equal(validData.data.bridge_preview.accepted, true);
  assert.equal(validData.data.bridge_preview.blocked, false);
  assert.equal(validData.data.bridge_preview.operator_review.required, false);
  assert.equal(validData.data.bridge_preview.ui_preview.status, "accepted");
  assert.equal(validData.data.bridge_preview.report.contract_enabled, true);
  assert.equal(validData.data.bridge_preview.report.accepted, true);
  assert.equal(validData.data.bridge_preview.report.blocked, false);
  assert.equal(validData.data.bridge_preview.report.safety_flags.visual_reference_consumer_contract_hardened, true);

  const invalidCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: visualMisuseOutput,
      consumerContract,
      packetId: "phase40b-blocked-post-output-acceptance-seal",
      maxExcerptChars: 120,
    },
  });

  assert.notEqual(invalidCall.isError, true, "Phase40B invalid post-output guard call unexpectedly errored.");
  const invalidData = parseToolJson(invalidCall);
  assert.equal(invalidData.ok, true);
  assert.equal(invalidData.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(invalidData.canon_status, "readonly_preview");
  assert.equal(invalidData.blocked, false);
  assert.equal(invalidData.data.phase, "39N");
  assertReadonlyOutputGuardData(invalidData.data);
  assert.equal(invalidData.data.accepted, false);
  assert.equal(invalidData.data.blocked, true);
  assert.equal(invalidData.data.severity, "error");
  assert(invalidData.data.error_count >= 1);
  assert(invalidData.data.misuse_details.includes("visual_reference_english_canon_or_story_inference"));
  assert(invalidData.data.misuse_details.includes("visual_reference_english_canon_db_or_active_engine_update"));
  assert.equal(invalidData.data.bridge_preview.accepted, false);
  assert.equal(invalidData.data.bridge_preview.blocked, true);
  assert.equal(invalidData.data.bridge_preview.operator_review.required, true);
  assert.equal(invalidData.data.bridge_preview.operator_review.reason, "visual_only_reference_misuse_detected");
  assert.equal(invalidData.data.bridge_preview.ui_preview.status, "blocked");
  assert.equal(invalidData.data.bridge_preview.report.contract_enabled, true);
  assert.equal(invalidData.data.bridge_preview.report.accepted, false);
  assert.equal(invalidData.data.bridge_preview.report.blocked, true);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.visual_reference_consumer_contract_hardened, true);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.canon_inference_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.ability_inference_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.soul_weapon_inference_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.relationship_inference_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.timeline_event_inference_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.chapter_outcome_inference_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.canon_db_update_allowed, false);
  assert.equal(invalidData.data.bridge_preview.report.safety_flags.active_engine_update_allowed, false);

  const disabledCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: disabledContractOutput,
      consumerContract: {},
      packetId: "phase40b-disabled-contract-post-output-acceptance-seal",
      maxExcerptChars: 120,
    },
  });

  assert.notEqual(disabledCall.isError, true, "Phase40B disabled-contract guard call unexpectedly errored.");
  const disabledData = parseToolJson(disabledCall);
  assert.equal(disabledData.ok, true);
  assert.equal(disabledData.tool_name, "preview_visual_reference_consumer_output_guard");
  assert.equal(disabledData.canon_status, "readonly_preview");
  assert.equal(disabledData.blocked, false);
  assert.equal(disabledData.data.phase, "39N");
  assertReadonlyOutputGuardData(disabledData.data);
  assert.equal(disabledData.data.accepted, true);
  assert.equal(disabledData.data.blocked, false);
  assert.equal(disabledData.data.severity, "pass");
  assert.equal(disabledData.data.bridge_preview.report.contract_enabled, false);
  assert.equal(disabledData.data.bridge_preview.report.safety_flags.visual_reference_consumer_contract_hardened, false);
  assert.equal(disabledData.data.bridge_preview.operator_review.required, false);
  assert.equal(disabledData.data.bridge_preview.ui_preview.status, "accepted");
} finally {
  await server.close();
}

await assertSnapshotUnchanged(watched);
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Phase40B changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Phase40B changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Phase40B changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Phase40B changed cleanup proposals.",
);

const runAllSource = await readFile(path.join(rootDir, "tests", "run-all.mjs"), "utf8");
assert(
  runAllSource.includes("tests/phase40/phase40a-visual-reference-sealed-chain-native-writing-route-acceptance-smoke.test.mjs"),
  "run-all missing Phase40A prerequisite registration.",
);
assert(
  runAllSource.includes("tests/phase40/phase40b-visual-reference-native-route-consumer-guard-post-output-acceptance-seal.test.mjs"),
  "run-all missing Phase40B registration.",
);
assert(
  runAllSource.includes("tests/phase39/phase39s-visual-reference-consumer-guard-final-closure-index-operator-handoff-seal.test.mjs"),
  "run-all missing Phase39S prerequisite registration.",
);
assert(
  runAllSource.includes("tests/mcp/mcp-readonly-tools.test.mjs"),
  "run-all missing MCP readonly tools regression.",
);

console.log("Phase40B visual reference native route consumer guard post-output acceptance seal tests passed.");
