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
      assert.notEqual(prior, null, "File was created by Phase40A native route acceptance smoke: " + filePath);
      assert(current.equals(prior), "File changed after Phase40A native route acceptance smoke: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by Phase40A native route acceptance smoke: " + filePath);
    }
  }
}

function fakeVisualReferences() {
  return {
    loaded: true,
    reference_count: 3,
    injection_scope: "writing_context_visual_only",
    canon_status: "reference_only",
    native_writing_route_acceptance_smoke: true,
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
        visual_id: "VIS-PHASE40A-MISAKI-REFERENCE",
        character: "御先",
        title: "御先 user uploaded visual reference",
        canon_status: "reference",
        ability_state: "visual_only",
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
          "ability mechanics",
          "soul weapons",
          "relationships",
          "ranks",
          "factions",
          "timeline events",
          "chapter outcomes",
        ],
      },
      {
        visual_id: "VIS-PHASE40A-CATWOLF-REFERENCE",
        character: "貓狼",
        title: "貓狼 user uploaded visual reference",
        canon_status: "reference",
        ability_state: "visual_only",
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
          "ability mechanics",
          "soul weapons",
          "relationships",
          "ranks",
          "factions",
          "timeline events",
          "chapter outcomes",
        ],
      },
      {
        visual_id: "VIS-PHASE40A-ATMOSPHERE-REFERENCE",
        character: "visual atmosphere reference",
        title: "corridor light / outfit silhouette / atmosphere reference",
        canon_status: "reference",
        ability_state: "visual_only",
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
          "ability mechanics",
          "soul weapons",
          "relationships",
          "ranks",
          "factions",
          "timeline events",
          "chapter outcomes",
        ],
      },
    ],
  };
}

function fakeContextBundle() {
  const visual_uploaded_references = fakeVisualReferences();

  return {
    bundle_id: "phase40a-visual-reference-sealed-chain-native-writing-route-acceptance-smoke-context",
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
        "Visual references cannot establish abilities, Soul-Weapons, relationships, ranks, factions, timeline events, chapter events, or chapter outcomes.",
      ].join("\n"),
    },
    writing_card_excerpt_or_reference: {
      text: [
        "圖片只能作外觀、姿態、服裝／造型、風格與氛圍參考。",
        "不得由圖片推斷 Canon facts、能力、異能武裝、角色關係、階級、陣營、時間線或章節結果。",
      ].join("\n"),
    },
    proofing_card_excerpt_or_reference: {
      text: "Phase40A native writing route must accept the sealed visual reference chain without mutating Canon or active_engine.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史；visual-only references never override text canon.",
    },
    retrieval_context: {
      phase: "40A",
      route_expectation: "visual_reference_sealed_chain_native_writing_route_acceptance_smoke",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "40A",
      route_expectation: "visual_reference_sealed_chain_native_writing_route_acceptance_smoke",
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
    phase: "40A",
    route_expectation: "visual_reference_sealed_chain_native_writing_route_acceptance_smoke",
  },
  retrieval_context: {
    phase: "40A",
    route_expectation: "visual_reference_sealed_chain_native_writing_route_acceptance_smoke",
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
assert.match(handoff.final_chatgpt_writing_instruction, /僅可作外觀、姿態、服裝／造型、畫面氣質與氛圍參考/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不得從上傳圖推斷、建立或確認正史能力/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不得把 visual-only reference 寫成 Canon facts/u);
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

const compactBundle = handoff.writing_context.compact_bundle_excerpt;
assert.equal(compactBundle.retrieval_context.visual_uploaded_references.loaded, true);
assert.equal(compactBundle.retrieval_context.visual_uploaded_references.injection_scope, "writing_context_visual_only");
assert.equal(compactBundle.retrieval_context.visual_uploaded_references.canon_status, "reference_only");
assert.equal(compactBundle.generation_context.visual_uploaded_references.loaded, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_establish_canon, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_infer_abilities, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_infer_relationships, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_update_active_engine, true);
assert.equal(compactBundle.generation_context.visual_uploaded_references.safety_contract.must_not_update_canon_db, true);

assert(handoff.forbidden_mistakes.includes("Do not save candidate."));
assert(handoff.forbidden_mistakes.includes("Do not update Canon."));
assert(handoff.forbidden_mistakes.includes("Do not update active_engine."));
assert(handoff.forbidden_mistakes.includes("Do not mark adopted or settled."));
assert(handoff.forbidden_mistakes.includes("Consumer contract must preserve visual-only reference boundaries."));

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

const server = startPublicMcpServer();

try {
  const init = await server.call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "phase40a-visual-reference-sealed-chain-native-writing-route-acceptance-smoke",
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
  assertReadonlySeal(seal);
  assertNoMutationFlags(seal);

  assert.deepEqual(
    seal.phases_indexed,
    ["39H", "39I", "39J", "39K", "39L", "39M", "39N", "39O", "39P", "39Q", "39R"],
  );
  assert.equal(seal.operator_handoff.status, "sealed");
  assert.equal(seal.operator_handoff.safe_to_treat_visual_reference_guard_chain_as_closed, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_canon_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_ability_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_relationship_source, true);
  assert.equal(seal.operator_handoff.must_not_use_visual_reference_as_timeline_source, true);

  const acceptableFixtureOutput = [
    "第〇章　視線只落在衣角",
    "",
    "角色站在走廊燈下，衣角與姿態被光線拉出安靜的輪廓；這只是畫面描寫，不確認任何能力、武裝、關係、階級、陣營、時間線或章節結果。",
  ].join("\n");

  const validCall = await server.call("tools/call", {
    name: "preview_visual_reference_consumer_output_guard",
    arguments: {
      outputText: acceptableFixtureOutput,
      consumerContract,
      packetId: "phase40a-native-route-accepted-output-fixture",
      maxExcerptChars: 80,
    },
  });

  assert.notEqual(validCall.isError, true, "Phase40A accepted output fixture unexpectedly failed.");
  const validData = parseToolJson(validCall);
  assert.equal(validData.ok, true);
  assert.equal(validData.blocked, false);
  assert.equal(validData.data.accepted, true);
  assert.equal(validData.data.blocked, false);
  assert.equal(validData.data.read_only, true);
  assert.equal(validData.data.no_mutation_guarantee, true);
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
} finally {
  await server.close();
}

await assertSnapshotUnchanged(watched);
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Phase40A changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Phase40A changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Phase40A changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Phase40A changed cleanup proposals.",
);

const runAllSource = await readFile(path.join(rootDir, "tests", "run-all.mjs"), "utf8");
assert(
  runAllSource.includes("tests/phase39/phase39s-visual-reference-consumer-guard-final-closure-index-operator-handoff-seal.test.mjs"),
  "run-all missing Phase39S prerequisite registration.",
);
assert(
  runAllSource.includes("tests/phase40/phase40a-visual-reference-sealed-chain-native-writing-route-acceptance-smoke.test.mjs"),
  "run-all missing Phase40A registration.",
);
assert(
  runAllSource.includes("tests/mcp/mcp-readonly-tools.test.mjs"),
  "run-all missing MCP readonly tools regression.",
);

console.log("Phase40A visual reference sealed chain native writing route acceptance smoke tests passed.");
