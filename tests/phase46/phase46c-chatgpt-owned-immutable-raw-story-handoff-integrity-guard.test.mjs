import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { getAgentRun } from "../../server/src/agent-run-service.mjs";
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
import { listNeuralTraces } from "../../server/src/neural-trace-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const guards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const preGenerationCapabilities = [
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_writing_card_director,
];
const protectedFiles = {
  active_engine: projectPaths.activeEngine,
  compressed_rules: projectPaths.compressedRules,
};
const protectedHashes = {
  active_engine: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};
const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];
const omitted = Symbol("omitted");

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

function assertGuardsFalse(response) {
  for (const guard of guards) {
    assert.equal(response[guard], false, `${guard} must remain false`);
    assert.equal(response.mutation_guards[guard], false, `mutation_guards.${guard} must remain false`);
  }
}

async function readySession(label) {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: `Phase46C immutable handoff regression: ${label}`,
    chapter_mode: "specific_scene",
  });
  assert.equal(session.ok, true);
  assertGuardsFalse(session);
  for (const invoke of preGenerationCapabilities) {
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "46C", case: label },
    });
    assert.equal(response.ok, true);
    assert.equal(response.trace.status, "success");
    assertGuardsFalse(response);
  }
  return session;
}

async function callFinalPolisher(session, rawStoryText, declaredHash = omitted) {
  const input = {
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: rawStoryText,
  };
  if (declaredHash !== omitted) input.raw_story_sha256 = declaredHash;
  return await chatgpt_bridge_use_final_polisher(input);
}

function assertMatched(response, expectedHash) {
  assert.equal(response.ok, true);
  assert.equal(response.raw_story_sha256, expectedHash);
  assert.deepEqual(response.raw_story_integrity, {
    guard_used: true,
    status: "matched",
    declared_raw_story_sha256: expectedHash,
    received_raw_story_sha256: expectedHash,
    exact_match: true,
    blocked_stage: null,
    final_polisher_executed: true,
  });
  assert.equal(response.trace.module_name, "final_polisher");
  assert.equal(response.trace.status, "success");
  assert.match(response.trace.trace_id, /^neural_trace_/u);
  assert.equal(response.agent_run_status, "success");
  assertGuardsFalse(response);
}

function assertBlocked(response, status, declaredHash, receivedHash) {
  assert.equal(response.ok, false);
  assert.equal(response.blocked, true);
  assert.equal(response.capability_output, null);
  const { forensics, ...primaryIntegrityVerdict } = response.raw_story_integrity;
  assert.deepEqual(primaryIntegrityVerdict, {
    guard_used: true,
    status,
    declared_raw_story_sha256: declaredHash,
    received_raw_story_sha256: receivedHash,
    exact_match: false,
    blocked_stage: "raw_story_handoff_integrity",
    final_polisher_executed: false,
  });
  if (status === "mismatch") {
    assert.equal(forensics.diagnostics_available, true);
    assert.equal(forensics.declared_manifest_present, false);
    assert.equal(forensics.comparisons, null);
    assert.equal(forensics.classifications.insufficient_forensic_evidence, true);
  } else {
    assert.equal(forensics, undefined);
  }
  assert.equal(response.trace.trace_id, null);
  assert.equal(response.trace.module_name, "final_polisher");
  assert.equal(response.trace.status, "not_executed");
  assert.notEqual(response.agent_run_status, "success");
  assertGuardsFalse(response);
}

async function assertNoFinalPolisherTrace(session, traceCountBefore) {
  const traces = await listNeuralTraces({ run_id: session.external_brain_session_id });
  assert.equal(traces.length, traceCountBefore);
  assert.equal(traces.some((trace) => trace.module_name === "final_polisher"), false);
  assert.notEqual((await getAgentRun(session.external_brain_session_id)).status, "success");
}

const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));

try {
  const protectedBefore = await currentProtectedHashes();
  assert.deepEqual(protectedBefore, protectedHashes);

  const mcpServerSource = await readFile(path.join(projectRoot, "server", "src", "mcp-server.mjs"), "utf8");
  const finalPolisherTool = mcpServerSource.match(
    /name: "chatgpt_bridge_use_final_polisher"[\s\S]*?handler: async \(args\) => jsonContent\(await chatgpt_bridge_use_final_polisher\(args\)\),/u,
  )?.[0];
  assert(finalPolisherTool, "production final-polisher MCP tool definition must be inspectable");
  assert.match(finalPolisherTool, /raw_story_sha256: \{ type: "string", minLength: 64, maxLength: 64, pattern: "\^\[a-f0-9\]\{64\}\$" \}/u);
  assert.match(finalPolisherTool, /raw_story_handoff_id/u);
  assert.match(finalPolisherTool, /\["external_brain_session_id", "writing_context_bundle_id"\]/u);

  // Case A — exact ASCII match through the production external-brain capability path.
  const asciiSession = await readySession("exact ASCII match");
  const asciiHash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal(sha256("abc"), asciiHash);
  const asciiResult = await callFinalPolisher(asciiSession, "abc", asciiHash);
  assertMatched(asciiResult, asciiHash);
  const asciiTraces = await listNeuralTraces({ run_id: asciiSession.external_brain_session_id });
  assert.equal(asciiTraces.filter((trace) => trace.module_name === "final_polisher" && trace.status === "success").length, 1);

  // Case B — a valid but wrong declaration hard-blocks before trace creation or run finalization.
  const mismatchSession = await readySession("declared mismatch");
  const mismatchTraceCount = (await listNeuralTraces({ run_id: mismatchSession.external_brain_session_id })).length;
  const wrongHash = "0".repeat(64);
  const mismatchResult = await callFinalPolisher(mismatchSession, "abc", wrongHash);
  assertBlocked(mismatchResult, "mismatch", wrongHash, asciiHash);
  assert.match(mismatchResult.blocked_reason, /does not match the exact received raw_story_text.*not executed/iu);
  await assertNoFinalPolisherTrace(mismatchSession, mismatchTraceCount);

  // Case C — exact string hashing remains whitespace and newline sensitive, with no repair or normalization.
  assert.equal(new Set([sha256("abc"), sha256("abc "), sha256("abc\n")]).size, 3);
  const whitespaceSession = await readySession("whitespace sensitivity and invalid declarations");
  const whitespaceTraceCount = (await listNeuralTraces({ run_id: whitespaceSession.external_brain_session_id })).length;
  const trailingSpace = await callFinalPolisher(whitespaceSession, "abc ", asciiHash);
  const trailingNewline = await callFinalPolisher(whitespaceSession, "abc\n", asciiHash);
  assertBlocked(trailingSpace, "mismatch", asciiHash, sha256("abc "));
  assertBlocked(trailingNewline, "mismatch", asciiHash, sha256("abc\n"));
  assert.notEqual(trailingSpace.raw_story_integrity.received_raw_story_sha256, trailingNewline.raw_story_integrity.received_raw_story_sha256);
  await assertNoFinalPolisherTrace(whitespaceSession, whitespaceTraceCount);

  // Case D — long-form Traditional Chinese passes exactly; one punctuation change with the old hash blocks.
  const traditionalChineseStory = [
    "午休鐘響過一輪，教室後門還卡著半截沒收進來的掃把。千夜把便當盒推到桌角，沒有替任何人解釋早上的事。",
    "九逃從走廊回來時，先低頭看了看椅腳旁那灘水。他跨過去，把借來的傘靠在窗邊。",
    "",
    "『你下午還去嗎？』",
    "『不知道。』",
    "",
    "窗外有人催著交社團名單。九逃應了一聲，拿起筆，話題就停在那裡。",
  ].join("\n");
  const traditionalHash = sha256(traditionalChineseStory);
  const traditionalMatchSession = await readySession("Traditional Chinese exact match");
  assertMatched(
    await callFinalPolisher(traditionalMatchSession, traditionalChineseStory, traditionalHash),
    traditionalHash,
  );

  const modifiedStory = traditionalChineseStory.replace("『你下午還去嗎？』", "『你下午還去嗎。』");
  assert.notEqual(modifiedStory, traditionalChineseStory);
  const traditionalMismatchSession = await readySession("Traditional Chinese punctuation mismatch");
  const traditionalTraceCount = (await listNeuralTraces({ run_id: traditionalMismatchSession.external_brain_session_id })).length;
  assertBlocked(
    await callFinalPolisher(traditionalMismatchSession, modifiedStory, traditionalHash),
    "mismatch",
    traditionalHash,
    sha256(modifiedStory),
  );
  await assertNoFinalPolisherTrace(traditionalMismatchSession, traditionalTraceCount);

  // Case E — missing, uppercase, short, and non-hex declarations are rejected before neural execution.
  const invalidDeclarations = [
    [omitted, null],
    [asciiHash.toUpperCase(), asciiHash.toUpperCase()],
    ["a".repeat(63), "a".repeat(63)],
    ["g".repeat(64), "g".repeat(64)],
  ];
  for (const [declared, observableDeclared] of invalidDeclarations) {
    const response = await callFinalPolisher(whitespaceSession, "abc", declared);
    assertBlocked(response, "invalid_declared_hash", observableDeclared, asciiHash);
    assert.match(response.blocked_reason, /exactly 64 lowercase hexadecimal characters.*not executed/iu);
  }
  await assertNoFinalPolisherTrace(whitespaceSession, whitespaceTraceCount);

  assert.deepEqual(await currentProtectedHashes(), protectedBefore);
  console.log("Phase46C immutable raw-story handoff integrity guard PASS.");
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
