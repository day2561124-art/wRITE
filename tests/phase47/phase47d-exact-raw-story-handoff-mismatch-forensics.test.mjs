import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { getAgentRun } from "../../server/src/agent-run-service.mjs";
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
  buildRawStoryIntegrityManifest,
  rawStoryBoundaryWindowCodePoints,
  rawStoryChunkSizeBytes,
  rawStoryIntegrityManifestVersion,
  rawStoryMaximumChunkCount,
} from "../../server/src/raw-story-handoff-integrity-service.mjs";
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
const expectedPreGenerationCapabilities = [
  ...priorCapabilities.map(([moduleName]) => `run_${moduleName}`),
  "run_writing_card_director",
];
const expectedNeuralModules = [
  ...priorCapabilities.map(([moduleName]) => moduleName),
  "writing_card_director",
  "final_polisher",
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

function objectHasKey(value, forbiddenKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, forbiddenKey)) return true;
  return Object.values(value).some((nested) => objectHasKey(nested, forbiddenKey));
}

async function beginSession(label) {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: `Phase47D exact raw-story mismatch forensics: ${label}`,
    chapter_mode: "specific_scene",
  });
  assert.equal(session.ok, true);
  assert.equal(session.orchestration_owner, "ChatGPT");
  assert.equal(session.prose_generator, "ChatGPT");
  assertGuardsFalse(session);
  return session;
}

async function makeReadySession(label) {
  const session = await beginSession(label);
  for (const [moduleName, invoke] of priorCapabilities) {
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "47D", module_name: moduleName },
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
  assert.equal(director.full_neural_orchestrator_used, false);
  assertGuardsFalse(director);
  return { session, director };
}

async function mismatchCall(session, declaredText, receivedText, options = {}) {
  const input = {
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: receivedText,
    raw_story_sha256: sha256(declaredText),
  };
  if (options.with_manifest !== false) {
    input.raw_story_integrity_manifest = buildRawStoryIntegrityManifest(declaredText);
  }
  const response = await chatgpt_bridge_use_final_polisher(input);
  assert.equal(response.ok, false);
  assert.equal(response.blocked, true);
  assert.equal(response.raw_story_integrity.status, "mismatch");
  assert.equal(response.raw_story_integrity.exact_match, false);
  assert.equal(response.raw_story_integrity.blocked_stage, "raw_story_handoff_integrity");
  assert.equal(response.raw_story_integrity.final_polisher_executed, false);
  assert.equal(response.trace.trace_id, null);
  assert.equal(response.trace.status, "not_executed");
  assert.equal(response.full_neural_orchestrator_used, false);
  assert.equal(response.capability_output, null);
  assertGuardsFalse(response);
  assert.equal(objectHasKey(response, "raw_story_text"), false);
  assert.equal(objectHasKey(response, "story_body"), false);
  assert.doesNotMatch(JSON.stringify(response), new RegExp(receivedText.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  return response;
}

const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));
const evidenceBefore = await readFile(immutableEvidencePath);

try {
  assert.deepEqual(externalBrainPreGenerationCapabilities, expectedPreGenerationCapabilities);
  assert.equal(externalBrainPreGenerationCapabilities.length, 6);
  assert.equal(externalBrainOwnership.orchestration_owner, "chatgpt");
  assert.equal(externalBrainOwnership.final_prose_generator, "chatgpt");
  assert.deepEqual(externalBrainMutationGuards, Object.fromEntries(guards.map((guard) => [guard, false])));

  const neuralModuleSource = await readFile(path.join(projectRoot, "server", "src", "neural-module-service.mjs"), "utf8");
  const moduleSpecsBlock = neuralModuleSource.match(/const moduleSpecs = \{([\s\S]*?)\r?\n\};\r?\n\r?\nfunction inputText/u)?.[1];
  assert(moduleSpecsBlock);
  assert.deepEqual(
    [...moduleSpecsBlock.matchAll(/^  ([a-z_]+): \{/gmu)].map((match) => match[1]),
    expectedNeuralModules,
  );
  const externalBrainSource = await readFile(
    path.join(projectRoot, "server", "src", "chatgpt-owned-external-brain-service.mjs"),
    "utf8",
  );
  assert.match(externalBrainSource, /integration_mode: "same_author_cognition_synthesis"/u);
  assert.match(externalBrainSource, /authorship_cognition_sources/u);

  const mcpServerSource = await readFile(path.join(projectRoot, "server", "src", "mcp-server.mjs"), "utf8");
  const finalPolisherSchema = mcpServerSource.match(
    /name: "chatgpt_bridge_use_final_polisher"[\s\S]*?handler: async \(args\) => jsonContent\(await chatgpt_bridge_use_final_polisher\(args\)\),/u,
  )?.[0];
  assert(finalPolisherSchema);
  assert.match(finalPolisherSchema, /raw_story_integrity_manifest/u);
  assert.match(finalPolisherSchema, /chunk_sha256:[\s\S]*?maxItems: 1024/u);
  assert.match(finalPolisherSchema, /raw_story_handoff_id/u);
  assert.match(finalPolisherSchema, /\["external_brain_session_id", "writing_context_bundle_id"\]/u);
  assert.doesNotMatch(
    finalPolisherSchema.match(/\}, \["external_brain_session_id"[\s\S]*?\]\),/u)?.[0] ?? "",
    /raw_story_integrity_manifest"/u,
  );

  const protectedBefore = await currentProtectedHashes();
  assert.deepEqual(protectedBefore, protectedHashes);

  const emptyManifest = buildRawStoryIntegrityManifest("");
  assert.equal(emptyManifest.line_count, 0);
  assert.deepEqual(emptyManifest.chunk_sha256, []);
  assert.equal(emptyManifest.exact_sha256, sha256(""));

  const mixedNewlines = "A\r\n😀\nB\r";
  const mixedManifest = buildRawStoryIntegrityManifest(mixedNewlines);
  assert.deepEqual(mixedManifest, buildRawStoryIntegrityManifest(mixedNewlines));
  assert.equal(mixedManifest.manifest_version, rawStoryIntegrityManifestVersion);
  assert.equal(mixedManifest.js_code_unit_length, 8);
  assert.equal(mixedManifest.unicode_code_point_length, 7);
  assert.equal(mixedManifest.utf8_byte_length, 10);
  assert.equal(mixedManifest.line_count, 4);
  assert.deepEqual(mixedManifest.newline_profile, { lf_count: 1, crlf_count: 1, cr_count: 1 });

  const composed = "é";
  const decomposed = "e\u0301";
  const composedManifest = buildRawStoryIntegrityManifest(composed);
  const decomposedManifest = buildRawStoryIntegrityManifest(decomposed);
  assert.notEqual(composedManifest.exact_sha256, decomposedManifest.exact_sha256);
  assert.equal(composedManifest.nfc_sha256, decomposedManifest.nfc_sha256);
  assert.equal(composedManifest.nfd_sha256, decomposedManifest.nfd_sha256);

  const boundaryText = `${"甲".repeat(300)}${"乙".repeat(300)}`;
  const boundaryManifest = buildRawStoryIntegrityManifest(boundaryText);
  assert.equal(boundaryManifest.boundary_window_code_points, rawStoryBoundaryWindowCodePoints);
  assert.equal(boundaryManifest.prefix_sha256, sha256("甲".repeat(256)));
  assert.equal(boundaryManifest.suffix_sha256, sha256("乙".repeat(256)));

  const chunkText = "x".repeat(2500);
  const chunkManifest = buildRawStoryIntegrityManifest(chunkText);
  assert.equal(chunkManifest.chunk_size_bytes, rawStoryChunkSizeBytes);
  assert.equal(chunkManifest.chunk_sha256.length, 3);
  assert.equal(chunkManifest.chunk_sha256[0], sha256("x".repeat(1024)));
  assert.equal(chunkManifest.chunk_sha256[1], sha256("x".repeat(1024)));
  assert.equal(chunkManifest.chunk_sha256[2], sha256("x".repeat(452)));
  assert(rawStoryMaximumChunkCount >= Math.ceil((250_000 * 4) / rawStoryChunkSizeBytes));

  const blockedSession = await beginSession("mismatch matrix");
  const usageBeforeMismatch = await runTraceUsage(blockedSession.external_brain_session_id);

  const missingHash = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: blockedSession.external_brain_session_id,
    writing_context_bundle_id: blockedSession.writing_context_bundle_id,
    raw_story_text: "missing hash specimen",
  });
  assert.equal(missingHash.ok, false);
  assert.equal(missingHash.raw_story_integrity.status, "invalid_declared_hash");
  assert.equal(missingHash.raw_story_integrity.final_polisher_executed, false);
  assert.equal("forensics" in missingHash.raw_story_integrity, false);

  const invalidHash = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: blockedSession.external_brain_session_id,
    writing_context_bundle_id: blockedSession.writing_context_bundle_id,
    raw_story_text: "invalid hash specimen",
    raw_story_sha256: "A".repeat(64),
  });
  assert.equal(invalidHash.ok, false);
  assert.equal(invalidHash.raw_story_integrity.status, "invalid_declared_hash");
  assert.equal(invalidHash.raw_story_integrity.final_polisher_executed, false);

  const noManifest = await mismatchCall(
    blockedSession,
    "caller-declared exact specimen",
    "runtime-received exact specimen",
    { with_manifest: false },
  );
  assert.equal(noManifest.raw_story_integrity.forensics.diagnostics_available, true);
  assert.equal(noManifest.raw_story_integrity.forensics.declared_manifest_present, false);
  assert.equal(noManifest.raw_story_integrity.forensics.comparisons, null);
  assert.equal(noManifest.raw_story_integrity.forensics.classifications.insufficient_forensic_evidence, true);
  for (const [key, value] of Object.entries(noManifest.raw_story_integrity.forensics.classifications)) {
    if (key !== "insufficient_forensic_evidence") assert.equal(value, false);
  }

  const internalDeclared = `${"A".repeat(1400)}X${"B".repeat(1400)}`;
  const internalReceived = `${"A".repeat(1400)}Y${"B".repeat(1400)}`;
  const internal = await mismatchCall(blockedSession, internalDeclared, internalReceived);
  assert.equal(internal.raw_story_integrity.forensics.comparisons.js_code_unit_length_match, true);
  assert.equal(internal.raw_story_integrity.forensics.comparisons.utf8_byte_length_match, true);
  assert.equal(internal.raw_story_integrity.forensics.comparisons.prefix_hash_match, true);
  assert.equal(internal.raw_story_integrity.forensics.comparisons.suffix_hash_match, true);
  assert.equal(internal.raw_story_integrity.forensics.chunk_localization.first_mismatching_chunk_index, 1);
  assert.equal(internal.raw_story_integrity.forensics.chunk_localization.matching_prefix_chunk_count, 1);
  assert.equal(internal.raw_story_integrity.forensics.chunk_localization.approximate_mismatch_byte_window_start, 1024);
  assert.match(internal.raw_story_integrity.forensics.chunk_localization.location_semantics, /not an exact first-differing-byte offset/iu);
  assert.equal(internal.raw_story_integrity.forensics.classifications.possible_internal_content_mutation, true);
  assert.equal("exact_first_differing_byte" in internal.raw_story_integrity.forensics.chunk_localization, false);

  const leadingDeclared = `X${"m".repeat(700)}`;
  const leading = await mismatchCall(blockedSession, leadingDeclared, `Y${"m".repeat(700)}`);
  assert.equal(leading.raw_story_integrity.forensics.comparisons.prefix_hash_match, false);
  assert.equal(leading.raw_story_integrity.forensics.comparisons.suffix_hash_match, true);
  assert.equal(leading.raw_story_integrity.forensics.classifications.possible_boundary_mutation, true);

  const trailingDeclared = `${"m".repeat(700)}X`;
  const trailing = await mismatchCall(blockedSession, trailingDeclared, `${"m".repeat(700)}Y`);
  assert.equal(trailing.raw_story_integrity.forensics.comparisons.prefix_hash_match, true);
  assert.equal(trailing.raw_story_integrity.forensics.comparisons.suffix_hash_match, false);

  const newlineMismatch = await mismatchCall(blockedSession, "第一行\n第二行", "第一行\r\n第二行");
  assert.equal(newlineMismatch.raw_story_integrity.forensics.comparisons.newline_profile_match, false);
  assert.equal(newlineMismatch.raw_story_integrity.forensics.classifications.possible_newline_representation_difference, true);
  assert.deepEqual(
    newlineMismatch.raw_story_integrity.forensics.received_metrics.newline_profile,
    { lf_count: 0, crlf_count: 1, cr_count: 0 },
  );

  const normalizationMismatch = await mismatchCall(blockedSession, `字${composed}句`, `字${decomposed}句`);
  assert.equal(normalizationMismatch.raw_story_integrity.forensics.comparisons.nfc_hash_match, true);
  assert.equal(normalizationMismatch.raw_story_integrity.forensics.comparisons.nfd_hash_match, true);
  assert.equal(normalizationMismatch.raw_story_integrity.forensics.classifications.possible_unicode_normalization_difference, true);
  assert.equal(normalizationMismatch.raw_story_integrity.final_polisher_executed, false);

  const trimMismatch = await mismatchCall(blockedSession, " trim-only ", "trim-only");
  assert.equal(trimMismatch.raw_story_integrity.forensics.classifications.length_difference_detected, true);
  const trailingNewlineMismatch = await mismatchCall(blockedSession, "尾行\n", "尾行");
  assert.equal(trailingNewlineMismatch.raw_story_integrity.forensics.comparisons.line_count_match, false);
  const bomMismatch = await mismatchCall(blockedSession, "\uFEFFBOM specimen", "BOM specimen");
  assert.equal(bomMismatch.raw_story_integrity.forensics.comparisons.prefix_hash_match, false);
  const spaceMismatch = await mismatchCall(blockedSession, "甲　乙", "甲 乙");
  assert.equal(spaceMismatch.raw_story_integrity.forensics.comparisons.utf8_byte_length_match, false);

  assert.deepEqual(await runTraceUsage(blockedSession.external_brain_session_id), usageBeforeMismatch);
  assert.notEqual((await getAgentRun(blockedSession.external_brain_session_id)).status, "success");

  const { session: readySession, director } = await makeReadySession("matched compact path");
  assert.equal(director.capability_output.integration_mode, "same_author_cognition_synthesis");
  const exactStory = "她把門推回原位，沒有替那聲遲來的道歉補上解釋。";
  const matched = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: readySession.external_brain_session_id,
    writing_context_bundle_id: readySession.writing_context_bundle_id,
    raw_story_text: exactStory,
    raw_story_sha256: sha256(exactStory),
  });
  assert.equal(matched.ok, true);
  assert.equal(matched.raw_story_integrity.status, "matched");
  assert.equal(matched.raw_story_integrity.exact_match, true);
  assert.equal(matched.raw_story_integrity.final_polisher_executed, true);
  assert.equal("forensics" in matched.raw_story_integrity, false);
  assert.equal(matched.trace.status, "success");
  assert.equal(matched.prose_generator, "ChatGPT");
  assert.equal(matched.full_neural_orchestrator_used, false);
  assert(Buffer.byteLength(JSON.stringify(matched), "utf8") < 16 * 1024);
  assertGuardsFalse(matched);

  assert.deepEqual(await currentProtectedHashes(), protectedBefore);
  assert.deepEqual(await readFile(immutableEvidencePath), evidenceBefore);
  console.log("Phase47D exact raw-story handoff mismatch forensics PASS.");
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
