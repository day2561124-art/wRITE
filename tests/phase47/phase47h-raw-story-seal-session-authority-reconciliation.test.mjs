import assert from "node:assert/strict";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  externalBrainMutationGuards,
  externalBrainOwnership,
  externalBrainPreGenerationCapabilities,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_seal_raw_story_handoff,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_final_polisher,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];
const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));

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
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function snapshotTree(root) {
  const snapshot = {};
  async function visit(current, relative = "") {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const childRelative = path.join(relative, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) await visit(absolute, childRelative);
      else if (entry.isFile()) {
        const metadata = await stat(absolute);
        snapshot[childRelative] = `${metadata.size}:${sha256(await readFile(absolute))}`;
      }
    }
  }
  await visit(root);
  return snapshot;
}

function assertGuardsFalse(response) {
  for (const guard of ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"]) {
    assert.equal(response[guard], false, `${guard} must remain false`);
    assert.equal(response.mutation_guards[guard], false, `mutation_guards.${guard} must remain false`);
  }
}

async function beginReadySession(label) {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: `Phase47H ${label}`,
    chapter_mode: "specific_scene",
  });
  assert.equal(session.ok, true);
  assertGuardsFalse(session);
  for (const [moduleName, invoke] of [
    ["scene_planner", chatgpt_bridge_use_scene_planner],
    ["character_simulator", chatgpt_bridge_use_character_simulator],
    ["neural_critic", chatgpt_bridge_use_neural_critic],
    ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
    ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
  ]) {
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "47H", module_name: moduleName },
    });
    assert.equal(response.ok, true);
    assert.equal(response.trace.status, "success");
  }
  const director = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assert.equal(director.ok, true);
  assert.equal(director.capability_output.integration_mode, "same_author_cognition_synthesis");
  return { session, director };
}

try {
  assert.deepEqual(externalBrainPreGenerationCapabilities, [
    "run_scene_planner",
    "run_character_simulator",
    "run_neural_critic",
    "run_style_drift_detector",
    "run_over_governance_detector",
    "run_writing_card_director",
  ]);
  assert.equal(externalBrainOwnership.orchestration_owner, "chatgpt");
  assert.equal(externalBrainOwnership.final_prose_generator, "chatgpt");
  assert.deepEqual(externalBrainMutationGuards, Object.fromEntries([
    ["candidate_created", false],
    ["canon_updated", false],
    ["active_engine_updated", false],
    ["adopted", false],
    ["settled", false],
  ]));

  const { session } = await beginReadySession("authoritative seal validation");
  const persistenceRoots = [
    path.join(projectPaths.agentRuns, session.external_brain_session_id),
    path.join(projectPaths.neuralModuleOutputs, session.external_brain_session_id),
    path.join(projectPaths.gptWritingContexts, session.writing_context_bundle_id),
  ];
  const beforeSeal = Object.fromEntries(await Promise.all(
    persistenceRoots.map(async (root) => [root, await snapshotTree(root)]),
  ));

  const story = "第47H章\n她把紙張折好，留在原處。";
  const sealed = await chatgpt_bridge_seal_raw_story_handoff({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: story,
  });
  assert.equal(sealed.ok, true);
  assert.equal(sealed.handoff_route, "single_ingress_immutable_seal");
  assert.match(sealed.raw_story_handoff_id, /^raw_story_handoff_/u);
  assert.equal(sealed.raw_story_sha256, sha256(story));
  assert.equal(sealed.runtime_process_instance_id?.length > 0, true);
  assert.equal(sealed.raw_story_text, undefined);
  assert.equal(JSON.stringify(sealed).includes(story), false);
  assertGuardsFalse(sealed);
  for (const root of persistenceRoots) {
    assert.deepEqual(await snapshotTree(root), beforeSeal[root], `seal wrote persistent data under ${root}`);
  }

  const blockedRun = await chatgpt_bridge_seal_raw_story_handoff({
    external_brain_session_id: "agent_run_20991231-000000-00000000",
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: story,
  });
  assert.equal(blockedRun.ok, false);
  assert.equal(blockedRun.blocked, true);
  assert.equal(blockedRun.raw_story_handoff_id, null);

  const wrongMode = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: "Phase47H wrong-mode",
    chapter_mode: "specific_scene",
  });
  assert.equal(wrongMode.ok, true);
  const blockedMode = await chatgpt_bridge_seal_raw_story_handoff({
    external_brain_session_id: wrongMode.external_brain_session_id,
    writing_context_bundle_id: wrongMode.writing_context_bundle_id,
    raw_story_text: story,
  });
  assert.equal(blockedMode.ok, false);
  assert.equal(blockedMode.blocked, true);

  const missingCapability = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: "Phase47H missing-capability",
    chapter_mode: "specific_scene",
  });
  await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: missingCapability.external_brain_session_id,
    writing_context_bundle_id: missingCapability.writing_context_bundle_id,
    capability_input: { phase: "47H", module_name: "scene_planner" },
  });
  const blockedCapability = await chatgpt_bridge_seal_raw_story_handoff({
    external_brain_session_id: missingCapability.external_brain_session_id,
    writing_context_bundle_id: missingCapability.writing_context_bundle_id,
    raw_story_text: story,
  });
  assert.equal(blockedCapability.ok, false);
  assert.equal(blockedCapability.blocked_stage, "pre_generation_capability_gate");

  const finalPolisherSuccess = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  });
  assert.equal(finalPolisherSuccess.ok, true);
  assert.equal(finalPolisherSuccess.runtime_process_instance_id, sealed.runtime_process_instance_id);
  assert.equal(finalPolisherSuccess.raw_story_integrity.exact_match, true);
  assert.equal(finalPolisherSuccess.handoff_route, "single_ingress_immutable_seal");

  const reused = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  });
  assert.equal(reused.ok, false);
  assert.match(reused.blocked_reason, /consumed/u);

  const directStory = "直接路由仍然可用。";
  const directMatched = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: directStory,
    raw_story_sha256: sha256(directStory),
  });
  assert.equal(directMatched.ok, true);
  assert.equal(directMatched.handoff_route, "direct_exact_sha256");

  console.log("Phase47H raw-story seal session authority reconciliation PASS.");
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
