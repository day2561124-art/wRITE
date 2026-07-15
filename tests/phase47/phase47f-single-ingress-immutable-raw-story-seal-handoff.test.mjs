import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
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
  chatgptBridgeToolMetadata,
  chatgptBridgeTools,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { getNeuralTrace, listNeuralTraces } from "../../server/src/neural-trace-service.mjs";
import { buildRawStoryIntegrityManifest } from "../../server/src/raw-story-handoff-integrity-service.mjs";
import {
  getRawStoryHandoffReceipt,
  getRawStoryHandoffStorageStatus,
  rawStoryHandoffIdPattern,
} from "../../server/src/raw-story-handoff-seal-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const guards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const priorCapabilities = [
  ["scene_planner", chatgpt_bridge_use_scene_planner],
  ["character_simulator", chatgpt_bridge_use_character_simulator],
  ["neural_critic", chatgpt_bridge_use_neural_critic],
  ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
  ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
];
const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];
const protectedFiles = {
  active_engine: projectPaths.activeEngine,
  compressed_rules: projectPaths.compressedRules,
};
const protectedHashes = {
  active_engine: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};
const immutableEvidencePath = path.join(
  projectRoot,
  "config",
  "phase46d-real-chatgpt-immutable-raw-story-handoff-live-acceptance-evidence.json",
);

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

async function currentProtectedHashes() {
  return Object.fromEntries(await Promise.all(Object.entries(protectedFiles).map(
    async ([name, filePath]) => [name, sha256(await readFile(filePath))],
  )));
}

function assertGuardsFalse(response) {
  for (const guard of guards) {
    assert.equal(response[guard], false, `${guard} must remain false`);
    assert.equal(response.mutation_guards[guard], false, `mutation_guards.${guard} must remain false`);
  }
}

function objectHasKey(value, forbiddenKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, forbiddenKey)) return true;
  return Object.values(value).some((nested) => objectHasKey(nested, forbiddenKey));
}

async function beginSession(label) {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: `Phase47F single-ingress seal: ${label}`,
    chapter_mode: "specific_scene",
  });
  assert.equal(session.ok, true);
  assertGuardsFalse(session);
  return session;
}

async function makeReadySession(label) {
  const session = await beginSession(label);
  for (const [moduleName, invoke] of priorCapabilities) {
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "47F", module_name: moduleName },
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
  assert.equal(director.prose_generator, "ChatGPT");
  assertGuardsFalse(director);
  return { session, director };
}

const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));
const evidenceBefore = await readFile(immutableEvidencePath);

try {
  assert.deepEqual(await currentProtectedHashes(), protectedHashes);
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
  assert.deepEqual(externalBrainMutationGuards, Object.fromEntries(guards.map((guard) => [guard, false])));

  assert.equal(typeof chatgptBridgeTools.chatgpt_bridge_seal_raw_story_handoff, "function");
  const sealMetadata = chatgptBridgeToolMetadata.chatgpt_bridge_seal_raw_story_handoff;
  assert.equal(sealMetadata.permission, "write_low_risk");
  assert.equal(sealMetadata.writes_files, false);
  assert.deepEqual(sealMetadata.writes_only_to, []);
  assert.equal(sealMetadata.storage_scope, "process_local_ephemeral_memory");
  assert.equal(sealMetadata.persists_across_process_restart, false);
  assert.equal(sealMetadata.secure_memory_erase_claimed, false);

  const mcpSource = await readFile(path.join(projectRoot, "server", "src", "mcp-server.mjs"), "utf8");
  const sealSchema = mcpSource.match(
    /name: "chatgpt_bridge_seal_raw_story_handoff"[\s\S]*?handler: async \(args\) => jsonContent\(await chatgpt_bridge_seal_raw_story_handoff\(args\)\),/u,
  )?.[0];
  assert(sealSchema);
  assert.match(sealSchema, /\["external_brain_session_id", "writing_context_bundle_id", "raw_story_text"\]/u);
  const finalSchema = mcpSource.match(
    /name: "chatgpt_bridge_use_final_polisher"[\s\S]*?handler: async \(args\) => jsonContent\(await chatgpt_bridge_use_final_polisher\(args\)\),/u,
  )?.[0];
  assert(finalSchema);
  assert.match(finalSchema, /raw_story_handoff_id/u);
  assert.match(finalSchema, /\["external_brain_session_id", "writing_context_bundle_id"\]/u);

  const unready = await beginSession("seal pre-generation gate");
  const premature = await chatgpt_bridge_seal_raw_story_handoff({
    external_brain_session_id: unready.external_brain_session_id,
    writing_context_bundle_id: unready.writing_context_bundle_id,
    raw_story_text: "這段正文不能提早進入 seal。",
  });
  assert.equal(premature.ok, false);
  assert.equal(premature.raw_story_handoff_id, null);
  assert.equal(premature.blocked_stage, "pre_generation_capability_gate");
  assert.equal(premature.missing_pre_generation_capabilities.length, 6);
  assertGuardsFalse(premature);

  const { session, director } = await makeReadySession("successful one-shot lifecycle");
  assert.equal(director.capability_output.integration_mode, "same_author_cognition_synthesis");
  const exactStory = "第47F章\r\n她把門推回原位。😀\n\uFEFF那句話沒有被改寫，也沒有被再次提交。 ";
  const persistenceRoots = [
    path.join(projectPaths.agentRuns, session.external_brain_session_id),
    path.join(projectPaths.neuralModuleOutputs, session.external_brain_session_id),
    path.join(projectPaths.gptWritingContexts, session.writing_context_bundle_id),
  ];
  const diskBeforeSeal = Object.fromEntries(await Promise.all(
    persistenceRoots.map(async (root) => [root, await snapshotTree(root)]),
  ));
  const sessionRunPath = path.join(projectPaths.agentRuns, session.external_brain_session_id, "run.json");
  const runBeforeSeal = JSON.parse(await readFile(sessionRunPath, "utf8"));
  const topLevelBeforeSeal = Object.fromEntries(await Promise.all(
    cleanupRoots.map(async (root) => [root, [...await names(root)].sort()]),
  ));
  const traceFilesBeforeSeal = Object.fromEntries(await Promise.all(
    (await listNeuralTraces({ run_id: session.external_brain_session_id })).map(async (trace) => {
      const filePath = path.join(projectPaths.neuralTraces, `${trace.trace_id}.json`);
      return [trace.trace_id, sha256(await readFile(filePath))];
    }),
  ));
  const storageBefore = getRawStoryHandoffStorageStatus();
  const sealed = await chatgpt_bridge_seal_raw_story_handoff({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: exactStory,
  });
  assert.equal(sealed.ok, true);
  assert.match(sealed.raw_story_handoff_id, rawStoryHandoffIdPattern);
  assert.equal(sealed.raw_story_sha256, sha256(exactStory));
  assert.deepEqual(sealed.raw_story_integrity_manifest, buildRawStoryIntegrityManifest(exactStory));
  assert.equal(sealed.handoff_route, "single_ingress_immutable_seal");
  assert.equal(sealed.lifecycle_status, "sealed");
  assert.equal(sealed.storage_scope, "process_local_ephemeral_memory");
  assert.equal(sealed.persists_across_process_restart, false);
  assert.equal(objectHasKey(sealed, "raw_story_text"), false);
  assert.equal(JSON.stringify(sealed).includes(exactStory), false);
  assertGuardsFalse(sealed);
  assert.equal(getRawStoryHandoffStorageStatus().active_payload_count, storageBefore.active_payload_count + 1);
  for (const root of persistenceRoots) {
    const after = await snapshotTree(root);
    const before = { ...diskBeforeSeal[root] };
    if (root === path.join(projectPaths.agentRuns, session.external_brain_session_id)) {
      delete after["run.json"];
      delete before["run.json"];
    }
    assert.deepEqual(after, before, `seal wrote unexpected persistent data under ${root}`);
  }
  const runAfterSeal = JSON.parse(await readFile(sessionRunPath, "utf8"));
  const activityFields = new Set(["last_activity_at", "last_activity_source", "updated_at"]);
  const withoutActivity = (run) => Object.fromEntries(
    Object.entries(run).filter(([key]) => !activityFields.has(key)),
  );
  assert.deepEqual(withoutActivity(runAfterSeal), withoutActivity(runBeforeSeal));
  assert.equal(runAfterSeal.session_lifecycle_status, "ACTIVE");
  assert.equal(runAfterSeal.last_activity_source, `raw_story_handoff_sealed:${sealed.raw_story_handoff_id}`);
  assert(Date.parse(runAfterSeal.last_activity_at) >= Date.parse(runBeforeSeal.last_activity_at));
  for (const root of cleanupRoots) {
    const afterNames = [...await names(root)].sort();
    if (root === path.join(projectPaths.outputLogs, "transactions")) {
      const beforeNames = new Set(topLevelBeforeSeal[root]);
      const additions = afterNames.filter((name) => !beforeNames.has(name));
      assert.equal(additions.length, 1, "seal activity update must create exactly one safe-write transaction manifest");
      const manifest = JSON.parse(await readFile(path.join(root, additions[0]), "utf8"));
      assert.equal(manifest.metadata.run_id, session.external_brain_session_id);
      assert.equal(manifest.metadata.action, "external-brain-session-activity");
      assert.equal(JSON.stringify(manifest).includes(exactStory), false);
      continue;
    }
    assert.deepEqual(afterNames, topLevelBeforeSeal[root], `seal created a disk entry under ${root}`);
  }
  assert.deepEqual(Object.fromEntries(await Promise.all(
    Object.keys(traceFilesBeforeSeal).map(async (traceId) => [
      traceId,
      sha256(await readFile(path.join(projectPaths.neuralTraces, `${traceId}.json`))),
    ]))), traceFilesBeforeSeal);

  const secondSession = await beginSession("scope rejection fixture");
  const traceCountBeforeBlocks = (await listNeuralTraces({ run_id: session.external_brain_session_id })).length;
  const mixed = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
    raw_story_text: exactStory,
    raw_story_sha256: sha256(exactStory),
  });
  assert.equal(mixed.ok, false);
  assert.equal(mixed.handoff_route, "invalid_mixed_handoff_routes");
  assert.equal(mixed.trace.status, "not_executed");

  const unknown = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_handoff_id: "raw_story_handoff_20000101-000000-000000000000",
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.raw_story_integrity.blocked_stage, "raw_story_handoff_seal_resolution");

  const crossRun = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: secondSession.external_brain_session_id,
    writing_context_bundle_id: secondSession.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  });
  assert.equal(crossRun.ok, false);
  assert.match(crossRun.blocked_reason, /different external_brain_session_id/u);

  const crossBundle = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: secondSession.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  });
  assert.equal(crossBundle.ok, false);
  assert.match(crossBundle.blocked_reason, /different writing_context_bundle_id/u);
  assert.equal(
    (await listNeuralTraces({ run_id: session.external_brain_session_id })).length,
    traceCountBeforeBlocks,
  );
  assert.equal(getRawStoryHandoffReceipt(sealed.raw_story_handoff_id).status, "sealed");

  let finalAdapterInput = null;
  const finalOutput = {
    result_type: "final_polisher_editorial_contract",
    operation: "subtractive_editorial_review",
    exact_payload_observed: true,
  };
  const polished = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  }, {
    adapter: async (input) => {
      finalAdapterInput = input;
      return finalOutput;
    },
  });
  assert.equal(polished.ok, true);
  assert.equal(polished.handoff_route, "single_ingress_immutable_seal");
  assert.equal(polished.raw_story_integrity.integrity_route, "single_ingress_immutable_seal");
  assert.equal(polished.raw_story_integrity.status, "matched");
  assert.equal(polished.raw_story_integrity.exact_match, true);
  assert.equal(polished.raw_story_integrity.final_polisher_executed, true);
  assert.equal(polished.raw_story_integrity.payload_reference_active, false);
  assert.equal(polished.raw_story_integrity.payload_release_semantics, "process_local_reference_released_not_secure_memory_erase");
  assert.equal(Object.hasOwn(polished.raw_story_integrity, "declared_raw_story_sha256"), false);
  assert.equal(finalAdapterInput.raw_story_text, exactStory);
  assert.equal(finalAdapterInput.raw_story_sha256, sha256(exactStory));
  assert.equal(finalAdapterInput.raw_story_handoff_id, sealed.raw_story_handoff_id);
  assert.deepEqual(polished.capability_output, finalOutput);
  const persistedFinalTrace = await getNeuralTrace(polished.trace.trace_id);
  assert.equal(persistedFinalTrace.run_id, session.external_brain_session_id);
  assert.equal(persistedFinalTrace.writing_context_bundle_id, session.writing_context_bundle_id);
  assert.equal(persistedFinalTrace.raw_story_handoff_id, sealed.raw_story_handoff_id);
  assert.equal(objectHasKey(polished, "raw_story_text"), false);
  assertGuardsFalse(polished);

  const receipt = getRawStoryHandoffReceipt(sealed.raw_story_handoff_id);
  assert.equal(receipt.status, "consumed");
  assert.equal(receipt.payload_reference_active, false);
  assert.equal(receipt.payload_release_semantics, "process_local_reference_released_not_secure_memory_erase");
  assert.equal(objectHasKey(receipt, "raw_story_text"), false);
  assert.equal(getRawStoryHandoffStorageStatus().active_payload_count, storageBefore.active_payload_count);

  const traceCountAfterSuccess = (await listNeuralTraces({ run_id: session.external_brain_session_id })).length;
  const reused = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  });
  assert.equal(reused.ok, false);
  assert.match(reused.blocked_reason, /already been consumed/u);
  assert.equal(reused.trace.status, "not_executed");
  assert.equal(
    (await listNeuralTraces({ run_id: session.external_brain_session_id })).length,
    traceCountAfterSuccess,
  );

  const directMismatchSession = await beginSession("Phase47D direct mismatch compatibility");
  const declaredStory = "直接路由原文\n";
  const receivedStory = "直接路由原文";
  const directMismatch = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: directMismatchSession.external_brain_session_id,
    writing_context_bundle_id: directMismatchSession.writing_context_bundle_id,
    raw_story_text: receivedStory,
    raw_story_sha256: sha256(declaredStory),
    raw_story_integrity_manifest: buildRawStoryIntegrityManifest(declaredStory),
  });
  assert.equal(directMismatch.ok, false);
  assert.equal(directMismatch.handoff_route, "direct_exact_sha256");
  assert.equal(directMismatch.raw_story_integrity.status, "mismatch");
  assert.equal(directMismatch.raw_story_integrity.forensics.diagnostics_available, true);
  assert.equal(directMismatch.raw_story_integrity.forensics.declared_manifest_present, true);
  assert.equal(directMismatch.trace.status, "not_executed");

  const { session: directSession } = await makeReadySession("direct exact compatibility");
  const directStory = "直接 exact SHA-256 路由仍可使用。";
  const directMatched = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: directSession.external_brain_session_id,
    writing_context_bundle_id: directSession.writing_context_bundle_id,
    raw_story_text: directStory,
    raw_story_sha256: sha256(directStory),
  });
  assert.equal(directMatched.ok, true);
  assert.equal(directMatched.handoff_route, "direct_exact_sha256");
  assert.equal(directMatched.raw_story_integrity.declared_raw_story_sha256, sha256(directStory));
  assert.equal(directMatched.raw_story_integrity.received_raw_story_sha256, sha256(directStory));
  assert.equal(directMatched.raw_story_integrity.exact_match, true);
  assertGuardsFalse(directMatched);

  assert.deepEqual(await currentProtectedHashes(), protectedHashes);
  assert.deepEqual(await readFile(immutableEvidencePath), evidenceBefore);
  console.log("Phase47F single-ingress immutable raw-story seal handoff PASS.");
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
