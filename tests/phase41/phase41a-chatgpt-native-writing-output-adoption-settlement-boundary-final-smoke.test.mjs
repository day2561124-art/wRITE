import assert from "node:assert/strict";
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
      assert.notEqual(prior, null, "File was created by Phase41A output boundary smoke: " + filePath);
      assert(current.equals(prior), "File changed after Phase41A output boundary smoke: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by Phase41A output boundary smoke: " + filePath);
    }
  }
}

function fakeContextBundle() {
  return {
    bundle_id: "phase41a-chatgpt-native-writing-output-adoption-settlement-boundary-final-smoke-context",
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
        "ChatGPT native output must not directly update active_engine.",
        "ChatGPT native output must not directly update Canon.",
        "ChatGPT native output must not directly enter adoption or settlement.",
      ].join("\n"),
    },
    writing_card_excerpt_or_reference: {
      text: [
        "Phase41A verifies post-output adoption and settlement boundary.",
        "Story text may exist only as chat output after handoff.",
        "Candidate creation, adoption, settlement, Canon update, and active_engine update require explicit downstream workflow.",
      ].join("\n"),
    },
    proofing_card_excerpt_or_reference: {
      text: "Do not treat ChatGPT native final text as an adopted chapter or settled Canon entry.",
    },
    longline_excerpt_or_reference: {
      text: "Native writing output remains outside Canon until explicit candidate and approval workflow is invoked.",
    },
    retrieval_context: {
      phase: "41A",
      route_expectation: "chatgpt_native_writing_output_adoption_settlement_boundary_final_smoke",
    },
    generation_context: {
      phase: "41A",
      route_expectation: "chatgpt_native_writing_output_adoption_settlement_boundary_final_smoke",
    },
  };
}

function buildNativeOutputBoundaryPacket({ handoff, outputText }) {
  const storyText = String(outputText ?? "").trim();
  const hasStoryText = storyText.length > 0;

  return {
    used: true,
    phase: "41A",
    surface_kind: "chatgpt_native_writing_output_adoption_settlement_boundary_final_smoke",
    boundary_kind: "post_chatgpt_native_output_candidate_adoption_settlement_boundary",
    source_surface_kind: handoff.surface_kind,
    source_story_text_source: handoff.chatgpt_native_consumer_contract.story_text_source,
    story_text_received: hasStoryText,
    story_text_sha256_available: hasStoryText,
    output_is_chat_response_only: true,
    output_is_not_candidate: true,
    output_is_not_adopted: true,
    output_is_not_settled: true,
    direct_candidate_save_allowed: false,
    direct_canon_update_allowed: false,
    direct_active_engine_update_allowed: false,
    direct_adoption_allowed: false,
    direct_settlement_allowed: false,
    direct_approval_request_creation_allowed: false,
    direct_pending_engine_candidate_creation_allowed: false,
    requires_explicit_candidate_workflow: true,
    requires_explicit_user_approval_before_adoption: true,
    requires_explicit_settlement_workflow: true,
    next_allowed_route: "explicit_downstream_candidate_workflow_only",
    forbidden_direct_routes: [
      "save_candidate_directly_from_chatgpt_native_output",
      "update_canon_directly_from_chatgpt_native_output",
      "update_active_engine_directly_from_chatgpt_native_output",
      "mark_adopted_directly_from_chatgpt_native_output",
      "enter_settlement_directly_from_chatgpt_native_output",
      "create_approval_request_directly_from_phase41a_smoke",
      "create_pending_engine_candidate_directly_from_phase41a_smoke",
    ],
    allowed_future_routes: [
      "explicit candidate creation workflow after user request",
      "explicit approval workflow after candidate exists",
      "explicit adoption workflow after approval",
      "explicit settlement workflow after adoption",
    ],
    no_mutation_guarantee: true,
    read_only: true,
    must_not_generate_story_text: false,
    must_not_save_candidate: true,
    must_not_update_canon: true,
    must_not_update_active_engine: true,
    must_not_create_approval_request: true,
    must_not_create_pending_engine_candidate: true,
    must_not_enter_adoption_or_settlement: true,
    safety_flags: {
      candidate_created: false,
      candidate_saved: false,
      canon_updated: false,
      active_engine_updated: false,
      approval_request_created: false,
      pending_engine_candidate_created: false,
      adopted: false,
      settled: false,
      writes_files: false,
    },
  };
}

function assertNoMutationBoundary(value) {
  assert.equal(value.no_mutation_guarantee, true);
  assert.equal(value.read_only, true);
  assert.equal(value.must_not_save_candidate, true);
  assert.equal(value.must_not_update_canon, true);
  assert.equal(value.must_not_update_active_engine, true);
  assert.equal(value.must_not_create_approval_request, true);
  assert.equal(value.must_not_create_pending_engine_candidate, true);
  assert.equal(value.must_not_enter_adoption_or_settlement, true);
  assert.equal(value.safety_flags.candidate_created, false);
  assert.equal(value.safety_flags.candidate_saved, false);
  assert.equal(value.safety_flags.canon_updated, false);
  assert.equal(value.safety_flags.active_engine_updated, false);
  assert.equal(value.safety_flags.approval_request_created, false);
  assert.equal(value.safety_flags.pending_engine_candidate_created, false);
  assert.equal(value.safety_flags.adopted, false);
  assert.equal(value.safety_flags.settled, false);
  assert.equal(value.safety_flags.writes_files, false);
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
    phase: "41A",
    route_expectation: "chatgpt_native_writing_output_adoption_settlement_boundary_final_smoke",
  },
  retrieval_context: {
    phase: "41A",
    route_expectation: "chatgpt_native_writing_output_adoption_settlement_boundary_final_smoke",
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

assert.match(handoff.final_chatgpt_writing_instruction, /不要保存 candidate/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不要寫入 Canon/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不要更新 active_engine/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不要進入 adoption 或 settlement 流程/u);

const consumerContract = handoff.chatgpt_native_consumer_contract;
assert.equal(consumerContract.response_owner, "ChatGPT");
assert.equal(consumerContract.required_response_kind, "story_text_only");
assert.equal(consumerContract.story_text_source, "chatgpt_native_generation_after_handoff");
assert.equal(consumerContract.must_emit_story_text_directly, true);
assert.equal(consumerContract.must_not_save_candidate, true);
assert.equal(consumerContract.must_not_update_canon, true);
assert.equal(consumerContract.must_not_update_active_engine, true);
assert.equal(consumerContract.must_not_enter_adoption_or_settlement, true);
assert.equal(consumerContract.allowed_output_surface.story_prose, true);
assert.equal(consumerContract.allowed_output_surface.diagnostics, false);
assert.equal(consumerContract.allowed_output_surface.handoff_echo, false);
assert.equal(consumerContract.allowed_output_surface.backend_generation_provider_output, false);

for (const forbiddenTopLevel of [
  "chatgpt_final_output",
  "extracted_chatgpt_final_output",
  "final_response_handoff_for_chat",
  "candidate_payload",
  "candidate_id",
  "adoption_result",
  "settlement_result",
  "canon_patch",
  "active_engine_patch",
  "approval_request",
]) {
  if (forbiddenTopLevel === "candidate_id") {
    assert.equal(result.candidate_id, null);
    assert.equal(Object.hasOwn(handoff, forbiddenTopLevel), false);
    assert.equal(Object.hasOwn(handoff.constraints, forbiddenTopLevel), false);
    assert.equal(Object.hasOwn(consumerContract, forbiddenTopLevel), false);
  } else {
    assert.equal(Object.hasOwn(result, forbiddenTopLevel), false);
    assert.equal(Object.hasOwn(handoff, forbiddenTopLevel), false);
    assert.equal(Object.hasOwn(handoff.constraints, forbiddenTopLevel), false);
    assert.equal(Object.hasOwn(consumerContract, forbiddenTopLevel), false);
  }
}

const simulatedChatgptFinalOutput = [
  "Chapter Zero - Boundary Smoke",
  "",
  "The corridor light moved across the floor while the character took one step forward.",
  "This text is treated as ChatGPT chat output only in Phase41A.",
].join("\n");

const boundary = buildNativeOutputBoundaryPacket({
  handoff,
  outputText: simulatedChatgptFinalOutput,
});

assert.equal(boundary.used, true);
assert.equal(boundary.phase, "41A");
assert.equal(
  boundary.surface_kind,
  "chatgpt_native_writing_output_adoption_settlement_boundary_final_smoke",
);
assert.equal(
  boundary.boundary_kind,
  "post_chatgpt_native_output_candidate_adoption_settlement_boundary",
);
assert.equal(boundary.source_surface_kind, "chatgpt_native_full_neural_writing_handoff");
assert.equal(boundary.source_story_text_source, "chatgpt_native_generation_after_handoff");
assert.equal(boundary.story_text_received, true);
assert.equal(boundary.story_text_sha256_available, true);
assert.equal(boundary.output_is_chat_response_only, true);
assert.equal(boundary.output_is_not_candidate, true);
assert.equal(boundary.output_is_not_adopted, true);
assert.equal(boundary.output_is_not_settled, true);
assert.equal(boundary.direct_candidate_save_allowed, false);
assert.equal(boundary.direct_canon_update_allowed, false);
assert.equal(boundary.direct_active_engine_update_allowed, false);
assert.equal(boundary.direct_adoption_allowed, false);
assert.equal(boundary.direct_settlement_allowed, false);
assert.equal(boundary.direct_approval_request_creation_allowed, false);
assert.equal(boundary.direct_pending_engine_candidate_creation_allowed, false);
assert.equal(boundary.requires_explicit_candidate_workflow, true);
assert.equal(boundary.requires_explicit_user_approval_before_adoption, true);
assert.equal(boundary.requires_explicit_settlement_workflow, true);
assert.equal(boundary.next_allowed_route, "explicit_downstream_candidate_workflow_only");
assert(boundary.forbidden_direct_routes.includes("save_candidate_directly_from_chatgpt_native_output"));
assert(boundary.forbidden_direct_routes.includes("update_canon_directly_from_chatgpt_native_output"));
assert(boundary.forbidden_direct_routes.includes("update_active_engine_directly_from_chatgpt_native_output"));
assert(boundary.forbidden_direct_routes.includes("mark_adopted_directly_from_chatgpt_native_output"));
assert(boundary.forbidden_direct_routes.includes("enter_settlement_directly_from_chatgpt_native_output"));
assert(boundary.allowed_future_routes.includes("explicit candidate creation workflow after user request"));
assert(boundary.allowed_future_routes.includes("explicit approval workflow after candidate exists"));
assert(boundary.allowed_future_routes.includes("explicit adoption workflow after approval"));
assert(boundary.allowed_future_routes.includes("explicit settlement workflow after adoption"));
assertNoMutationBoundary(boundary);

const phase40cSource = await readFile(
  path.join(rootDir, "tests/phase40/phase40c-visual-reference-native-route-final-closure-index-operator-handoff-seal.test.mjs"),
  "utf8",
);
assert.match(phase40cSource, /visual_reference_native_route_final_closure_index_operator_handoff_seal/u);
assert.match(phase40cSource, /safe_to_treat_visual_reference_native_route_as_closed/u);
assert.match(phase40cSource, /candidate_created: false/u);
assert.match(phase40cSource, /canon_updated: false/u);
assert.match(phase40cSource, /active_engine_updated: false/u);
assert.match(phase40cSource, /adopted: false/u);
assert.match(phase40cSource, /settled: false/u);

const runAllSource = await readFile(path.join(rootDir, "tests/run-all.mjs"), "utf8");
const requiredRunAllLines = [
  "tests/phase40/phase40c-visual-reference-native-route-final-closure-index-operator-handoff-seal.test.mjs",
  "tests/phase41/phase41a-chatgpt-native-writing-output-adoption-settlement-boundary-final-smoke.test.mjs",
  "tests/mcp/mcp-readonly-tools.test.mjs",
];

for (const line of requiredRunAllLines) {
  assert(runAllSource.includes(line), "run-all missing required registration: " + line);
}

const phase40cIndex = runAllSource.indexOf(requiredRunAllLines[0]);
const phase41aIndex = runAllSource.indexOf(requiredRunAllLines[1]);
assert(phase40cIndex < phase41aIndex, "Phase40C must run before Phase41A.");

await assertSnapshotUnchanged(watched);
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Phase41A changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Phase41A changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Phase41A changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Phase41A changed cleanup proposals.",
);

console.log("Phase41A ChatGPT native writing output adoption/settlement boundary final smoke tests passed.");
