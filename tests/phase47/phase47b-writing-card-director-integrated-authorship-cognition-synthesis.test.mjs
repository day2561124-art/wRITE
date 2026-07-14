import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  externalBrainMutationGuards,
  externalBrainOwnership,
  externalBrainPreGenerationCapabilities,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_final_polisher,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import {
  loadVerifiedPriorAuthorshipCognition,
  priorAuthorshipCognitionModules,
} from "../../server/src/external-brain-cognition-output-service.mjs";
import { getNeuralTrace, hashNeuralValue } from "../../server/src/neural-trace-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const guards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const priorCalls = [
  ["scene_planner", chatgpt_bridge_use_scene_planner],
  ["character_simulator", chatgpt_bridge_use_character_simulator],
  ["neural_critic", chatgpt_bridge_use_neural_critic],
  ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
  ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
];
const expectedPreGenerationCapabilities = [
  ...priorCalls.map(([moduleName]) => `run_${moduleName}`),
  "run_writing_card_director",
];
const expectedNeuralModules = [
  ...priorAuthorshipCognitionModules,
  "writing_card_director",
  "final_polisher",
];
const expectedExternalBrainMcpTools = [
  "chatgpt_bridge_begin_external_brain_writing_session",
  ...expectedNeuralModules.map((moduleName) => `chatgpt_bridge_use_${moduleName}`),
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
const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];

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

async function currentProtectedHashes() {
  return Object.fromEntries(await Promise.all(Object.entries(protectedFiles).map(
    async ([name, filePath]) => [name, sha256(await readFile(filePath))],
  )));
}

async function runTraceUsage(runId) {
  const usage = JSON.parse(await readFile(
    path.join(projectPaths.agentRuns, runId, "neural_modules_used.json"),
    "utf8",
  ));
  return usage.neural_modules_used ?? [];
}

function assertGuardsFalse(response) {
  for (const guard of guards) {
    assert.equal(response[guard], false, `${guard} must remain false`);
    assert.equal(response.mutation_guards[guard], false, `mutation_guards.${guard} must remain false`);
  }
}

async function beginSession(label) {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: `Phase47B integrated authorship cognition: ${label}`,
    chapter_mode: "specific_scene",
  });
  assert.equal(session.ok, true);
  assert.equal(session.orchestration_owner, "ChatGPT");
  assert.equal(session.prose_generator, "ChatGPT");
  assertGuardsFalse(session);
  return session;
}

function semanticOutput(moduleName, revision = 1) {
  return {
    result_type: {
      scene_planner: "scene_plan",
      character_simulator: "character_simulation",
      neural_critic: "neural_critique",
      style_drift_detector: "style_drift_report",
      over_governance_detector: "over_governance_report",
    }[moduleName],
    raw_marker: `PHASE47B_EXACT_${moduleName.toUpperCase()}_${revision}`,
    semantic_value: {
      revision,
      concern: `${moduleName} exact semantic cognition`,
      unknown_may_remain: true,
    },
  };
}

async function runPriorCognition(session, options = {}) {
  const results = new Map();
  for (const [moduleName, invoke] of priorCalls) {
    const output = options.outputs?.[moduleName] ?? semanticOutput(moduleName);
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "47B", module_name: moduleName },
    }, { adapter: async () => output });
    assert.equal(response.ok, true);
    assert.equal(response.trace.status, "success");
    assert.equal(response.trace.module_name, moduleName);
    assertGuardsFalse(response);
    results.set(moduleName, { output, response });
  }
  return results;
}

function recordPath(session, moduleName, traceId) {
  return path.join(
    projectPaths.neuralModuleOutputs,
    session.external_brain_session_id,
    session.writing_context_bundle_id,
    moduleName,
    `${traceId}.json`,
  );
}

async function mutateRecord(session, moduleName, traceId, mutation) {
  const filePath = recordPath(session, moduleName, traceId);
  const record = JSON.parse(await readFile(filePath, "utf8"));
  mutation(record);
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

async function assertIntegrityBlock(label, mutation) {
  const session = await beginSession(label);
  const results = await runPriorCognition(session);
  await mutation(session, results);
  const before = await runTraceUsage(session.external_brain_session_id);
  const response = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assert.equal(response.ok, false);
  assert.equal(response.blocked, true);
  assert.equal(response.trace.status, "not_executed");
  assert.equal(response.trace.trace_id, null);
  assert(response.invalid_prior_cognition_sources.length > 0);
  assert.match(response.blocked_reason, /Invalid prior cognition sources/iu);
  assertGuardsFalse(response);
  const after = await runTraceUsage(session.external_brain_session_id);
  assert.equal(after.length, before.length);
  assert.equal(after.some((trace) => trace.module_name === "writing_card_director"), false);
}

const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));
const immutableEvidenceBefore = await readFile(immutableEvidencePath);

try {
  assert.deepEqual(externalBrainPreGenerationCapabilities, expectedPreGenerationCapabilities);
  assert.equal(externalBrainPreGenerationCapabilities.length, 6);
  assert.deepEqual(priorAuthorshipCognitionModules, priorCalls.map(([moduleName]) => moduleName));
  assert.deepEqual(externalBrainMutationGuards, Object.fromEntries(guards.map((guard) => [guard, false])));
  assert.equal(externalBrainOwnership.orchestration_owner, "chatgpt");
  assert.equal(externalBrainOwnership.final_prose_generator, "chatgpt");

  const neuralModuleSource = await readFile(path.join(projectRoot, "server", "src", "neural-module-service.mjs"), "utf8");
  const moduleSpecsBlock = neuralModuleSource.match(/const moduleSpecs = \{([\s\S]*?)\n\};\n\nfunction inputText/u)?.[1];
  assert(moduleSpecsBlock, "neural module specs must remain inspectable");
  const moduleNames = [...moduleSpecsBlock.matchAll(/^  ([a-z_]+): \{/gmu)].map((match) => match[1]);
  assert.deepEqual(moduleNames, expectedNeuralModules);
  assert.equal(moduleNames.length, 7);

  const mcpServerSource = await readFile(path.join(projectRoot, "server", "src", "mcp-server.mjs"), "utf8");
  const exposedExternalBrainTools = [...mcpServerSource.matchAll(/name: "(chatgpt_bridge_(?:begin_external_brain_writing_session|use_(?:scene_planner|character_simulator|neural_critic|style_drift_detector|over_governance_detector|writing_card_director|final_polisher)))"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(exposedExternalBrainTools, expectedExternalBrainMcpTools);
  assert.doesNotMatch(`${neuralModuleSource}\n${mcpServerSource}`, /authorship_synthesizer|run_authorship_synthesizer/iu);

  const protectedBefore = await currentProtectedHashes();
  assert.deepEqual(protectedBefore, protectedHashes);

  const blockedSession = await beginSession("director precondition block");
  const tracesBeforeBlock = await runTraceUsage(blockedSession.external_brain_session_id);
  const blockedDirector = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: blockedSession.external_brain_session_id,
    writing_context_bundle_id: blockedSession.writing_context_bundle_id,
  });
  assert.equal(blockedDirector.ok, false);
  assert.equal(blockedDirector.blocked, true);
  assert.deepEqual(blockedDirector.missing_prior_cognition_modules, priorAuthorshipCognitionModules);
  assert.match(blockedDirector.blocked_reason, /Missing prior cognition modules: scene_planner, character_simulator, neural_critic, style_drift_detector, over_governance_detector/iu);
  assert.equal(blockedDirector.trace.status, "not_executed");
  assert.equal(blockedDirector.trace.trace_id, null);
  assertGuardsFalse(blockedDirector);
  assert.deepEqual(
    await runTraceUsage(blockedSession.external_brain_session_id),
    tracesBeforeBlock,
  );

  const session = await beginSession("exact output continuity and synthesis");
  const results = await runPriorCognition(session);
  for (const [moduleName, { output, response }] of results) {
    const record = JSON.parse(await readFile(recordPath(session, moduleName, response.trace.trace_id), "utf8"));
    assert.equal(record.run_id, session.external_brain_session_id);
    assert.equal(record.external_brain_session_id, session.external_brain_session_id);
    assert.equal(record.writing_context_bundle_id, session.writing_context_bundle_id);
    assert.equal(record.capability_name, `run_${moduleName}`);
    assert.equal(record.module_name, moduleName);
    assert.equal(record.result_type, output.result_type);
    assert.equal(record.trace_id, response.trace.trace_id);
    assert.deepEqual(record.capability_output, output);
    assert.equal(record.output_hash, hashNeuralValue(JSON.stringify(output)));
    assert.equal(record.output_hash, response.trace.output_hash);
  }

  const newestSceneOutput = semanticOutput("scene_planner", 2);
  const newestScene = await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  }, { adapter: async () => newestSceneOutput });
  assert.equal(newestScene.ok, true);
  const selected = await loadVerifiedPriorAuthorshipCognition({
    run_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.selected_sources.map((source) => source.module_name), priorAuthorshipCognitionModules);
  assert.equal(selected.selected_sources[0].trace_id, newestScene.trace.trace_id);
  assert.deepEqual(selected.selected_sources[0].capability_output, newestSceneOutput);

  let directorAdapterInput = null;
  const customDirectorOutput = {
    result_type: "writing_card_director_context",
    integration_mode: "same_author_cognition_synthesis",
    handoff: "compact custom adapter proof",
  };
  const customDirector = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: { selected_technique_families: [] },
  }, {
    adapter: async (input) => {
      directorAdapterInput = input;
      return customDirectorOutput;
    },
  });
  assert.equal(customDirector.ok, true);
  assert.deepEqual(customDirector.capability_output, customDirectorOutput);
  const injected = directorAdapterInput.authorship_cognition_sources;
  assert.equal(injected.integration_mode, "same_author_cognition_synthesis");
  assert.deepEqual(injected.canonical_ordering, priorAuthorshipCognitionModules);
  assert.deepEqual(injected.source_manifest.map((source) => source.module_name), priorAuthorshipCognitionModules);
  assert.deepEqual(injected.prior_cognition_outputs.map((source) => source.module_name), priorAuthorshipCognitionModules);
  assert.deepEqual(
    injected.prior_cognition_outputs.map((source) => source.capability_output),
    [newestSceneOutput, ...priorAuthorshipCognitionModules.slice(1).map((moduleName) => results.get(moduleName).output)],
  );

  const director = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: { selected_technique_families: [] },
  });
  assert.equal(director.ok, true);
  assert.equal(director.capability_output.result_type, "writing_card_director_context");
  assert.equal(director.capability_output.integration_mode, "same_author_cognition_synthesis");
  assert.deepEqual(director.capability_output.source_cognition_manifest.map((source) => source.module_name), priorAuthorshipCognitionModules);
  assert(director.capability_output.source_cognition_manifest.every((source) => source.consumption_status === "verified_and_consumed"));
  const directorText = JSON.stringify(director.capability_output);
  for (const phrase of [
    "semantic_deduplication",
    "authority_arbitration",
    "conflict_arbitration",
    "attention_compression",
    "scene_constraint_reconstruction",
    "Canon hard facts and Canon DB",
    "active_engine P0 hard constraints",
    "established causal continuity",
    "low-confidence Writing Card suggestions",
    "Unknown is a valid author conclusion",
    "Reject or suppress unsupported",
    "without increasing prose weight",
    "Module boundaries should dissolve before prose generation",
    "Write the people first",
    "natural Traditional Chinese",
    "Do not seek a theme",
    "opt-in cognitive methods",
    "ChatGPT",
  ]) assert.match(directorText, new RegExp(phrase, "iu"));
  assert.match(directorText, /Do not expose private chain-of-thought/iu);
  assert.doesNotMatch(directorText, /show (?:your|the) (?:private )?chain-of-thought|output (?:your )?reasoning transcript/iu);
  for (const field of ["story_body", "polished_text", "chatgpt_final_output", "final_candidate_text"]) {
    assert.equal(Object.hasOwn(director.capability_output, field), false);
  }
  assert.equal(director.capability_output.final_prose_ownership.owner, "ChatGPT");
  assert.equal(director.capability_output.final_prose_ownership.writer_workbench_generates_story_prose, false);
  for (const moduleName of priorAuthorshipCognitionModules) {
    assert.doesNotMatch(directorText, new RegExp(`PHASE47B_EXACT_${moduleName.toUpperCase()}`, "u"));
  }
  const directorBytes = Buffer.byteLength(JSON.stringify(director), "utf8");
  assert(directorBytes < 16 * 1024, `director response exceeds Phase44C compact contract: ${directorBytes} bytes`);
  assertGuardsFalse(director);

  const rawStory = "她沒有回答那個問題，只把窗邊的椅子挪回原位。";
  const polished = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: rawStory,
    raw_story_sha256: sha256(rawStory),
  });
  assert.equal(polished.ok, true);
  assert.equal(polished.generation_boundary, "post_generation");
  assert.equal(polished.raw_story_integrity.exact_match, true);
  assert.equal(polished.raw_story_integrity.final_polisher_executed, true);
  assert.equal(polished.capability_output.prose_ownership.final_prose_generator, "ChatGPT");
  assertGuardsFalse(polished);

  const crossSession = await beginSession("cross-session records are not reusable");
  const crossSessionDirector = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: crossSession.external_brain_session_id,
    writing_context_bundle_id: crossSession.writing_context_bundle_id,
  });
  assert.deepEqual(crossSessionDirector.missing_prior_cognition_modules, priorAuthorshipCognitionModules);

  const otherBundleSession = await beginSession("cross-bundle records are not reusable");
  const crossBundleDirector = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: otherBundleSession.writing_context_bundle_id,
  });
  assert.equal(crossBundleDirector.ok, false);
  assert.deepEqual(crossBundleDirector.missing_prior_cognition_modules, priorAuthorshipCognitionModules);

  await assertIntegrityBlock("record run_id mismatch", async (caseSession, caseResults) => {
    const traceId = caseResults.get("scene_planner").response.trace.trace_id;
    await mutateRecord(caseSession, "scene_planner", traceId, (record) => {
      record.run_id = "agent_run_20000101-000000-00000000";
    });
  });
  await assertIntegrityBlock("record bundle mismatch", async (caseSession, caseResults) => {
    const traceId = caseResults.get("character_simulator").response.trace.trace_id;
    await mutateRecord(caseSession, "character_simulator", traceId, (record) => {
      record.writing_context_bundle_id = "gptctx_20000101-000000-00000000";
    });
  });
  await assertIntegrityBlock("semantic output hash mismatch", async (caseSession, caseResults) => {
    const traceId = caseResults.get("neural_critic").response.trace.trace_id;
    await mutateRecord(caseSession, "neural_critic", traceId, (record) => {
      record.capability_output.semantic_value.concern = "tampered after trace";
    });
  });
  await assertIntegrityBlock("trace missing", async (caseSession, caseResults) => {
    const traceId = caseResults.get("style_drift_detector").response.trace.trace_id;
    await mutateRecord(caseSession, "style_drift_detector", traceId, (record) => {
      record.trace_id = "neural_trace_20000101-000000-00000000";
    });
  });
  await assertIntegrityBlock("failed trace cannot be consumed", async (caseSession, caseResults) => {
    const failed = await chatgpt_bridge_use_scene_planner({
      external_brain_session_id: caseSession.external_brain_session_id,
      writing_context_bundle_id: caseSession.writing_context_bundle_id,
    }, { adapter: async () => { throw new Error("Phase47B failed output fixture"); } });
    assert.equal(failed.ok, false);
    assert.equal(failed.trace.status, "failed");
    const traceId = caseResults.get("scene_planner").response.trace.trace_id;
    const failedTrace = await getNeuralTrace(failed.trace.trace_id);
    await mutateRecord(caseSession, "scene_planner", traceId, (record) => {
      record.trace_id = failed.trace.trace_id;
      record.called_at = failedTrace.called_at;
    });
  });

  assert.deepEqual(await currentProtectedHashes(), protectedBefore);
  assert.deepEqual(await readFile(immutableEvidencePath), immutableEvidenceBefore);
  console.log(`Phase47B writing-card-director integrated authorship cognition synthesis PASS: director_bytes=${directorBytes}`);
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
