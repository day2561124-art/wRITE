import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import { getNeuralTrace, listNeuralTraces } from "../../server/src/neural-trace-service.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const guards = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const markerAlpha = "PHASE44D_SESSION_ALPHA";
const markerBeta = "PHASE44D_SESSION_BETA";
const rawAlpha = "PHASE44D_RAW_ALPHA｜雨沿著鐘樓石縫落下，她把尚未寄出的信壓在掌心。";
const rawBeta = "PHASE44D_RAW_BETA｜晨霧越過操場邊線，他將斷裂的徽章放回木盒。";
const unknownSession = "agent_run_20000101-000000-deadbeef";
const unknownBundle = "gptctx_20000101-000000-deadbeef";

const capabilityTools = {
  scene_planner: chatgpt_bridge_use_scene_planner,
  character_simulator: chatgpt_bridge_use_character_simulator,
  neural_critic: chatgpt_bridge_use_neural_critic,
  style_drift_detector: chatgpt_bridge_use_style_drift_detector,
  over_governance_detector: chatgpt_bridge_use_over_governance_detector,
  writing_card_director: chatgpt_bridge_use_writing_card_director,
};

async function treeDigest(relativePath) {
  const root = path.join(rootDir, relativePath);
  const records = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.join(prefix, entry.name).replaceAll("\\", "/");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) records.push(`${relative}:${sha256(await readFile(absolute))}`);
    }
  }
  await visit(root);
  return sha256(records.join("\n"));
}

function assertMutationGuards(response) {
  const boundary = response.mutation_guards ?? response;
  for (const guard of guards) assert.equal(boundary[guard], false, `${guard} must remain false`);
}

function assertSuccess(response, session, moduleName) {
  assert.equal(response.ok, true);
  assert.equal(response.external_brain_session_id, session.external_brain_session_id);
  assert.equal(response.writing_context_bundle_id, session.writing_context_bundle_id);
  assert.equal(response.trace.run_id, session.external_brain_session_id);
  assert.equal(response.trace.module_name, moduleName);
  assert.equal(response.trace.status, "success");
  assert.match(response.trace.trace_id, /^neural_trace_/u);
  assert.match(response.trace.output_hash, /^[a-f0-9]{64}$/u);
  assertMutationGuards(response);
}

function assertBlocked(response) {
  assert.equal(response.ok, false);
  assert.equal(response.blocked, true);
  assert.equal("capability_output" in response, false);
  assert.equal("trace" in response, false);
  assertMutationGuards(response);
}

async function invoke(session, moduleName, extra = {}) {
  return await capabilityTools[moduleName]({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: { phase: "44D", ...extra },
  });
}

const protectedStateBefore = {
  canon: await treeDigest("data/canon_db"),
  candidates: await treeDigest("data/outputs/writing_candidates"),
};

const sessionA = await chatgpt_bridge_begin_external_brain_writing_session({
  task_prompt: `${markerAlpha}：規劃雨夜鐘樓下的抉擇場景。`,
  chapter_mode: "specific_scene",
});
const sessionB = await chatgpt_bridge_begin_external_brain_writing_session({
  task_prompt: `${markerBeta}：規劃晨霧操場邊的告別場景。`,
  chapter_mode: "specific_scene",
});
assert.equal(sessionA.ok, true);
assert.equal(sessionB.ok, true);
assert.notEqual(sessionA.external_brain_session_id, sessionB.external_brain_session_id);
assert.notEqual(sessionA.writing_context_bundle_id, sessionB.writing_context_bundle_id);
assertMutationGuards(sessionA);
assertMutationGuards(sessionB);

const sceneA = await invoke(sessionA, "scene_planner");
const sceneB = await invoke(sessionB, "scene_planner");
assertSuccess(sceneA, sessionA, "scene_planner");
assertSuccess(sceneB, sessionB, "scene_planner");
assert.match(sceneA.capability_output.objective, new RegExp(markerAlpha, "u"));
assert.doesNotMatch(sceneA.capability_output.objective, new RegExp(markerBeta, "u"));
assert.match(sceneB.capability_output.objective, new RegExp(markerBeta, "u"));
assert.doesNotMatch(sceneB.capability_output.objective, new RegExp(markerAlpha, "u"));
assert.notEqual(sceneA.capability_output.input_digest, sceneB.capability_output.input_digest);

const cardA = await invoke(sessionA, "writing_card_director");
const cardB = await invoke(sessionB, "writing_card_director");
assertSuccess(cardA, sessionA, "writing_card_director");
assertSuccess(cardB, sessionB, "writing_card_director");
assert.match(cardA.capability_output.direction, new RegExp(markerAlpha, "u"));
assert.match(cardB.capability_output.direction, new RegExp(markerBeta, "u"));

const successIdsBeforeFailures = new Set([
  ...(await listNeuralTraces({ run_id: sessionA.external_brain_session_id })),
  ...(await listNeuralTraces({ run_id: sessionB.external_brain_session_id })),
].filter((trace) => trace.status === "success").map((trace) => trace.trace_id));

const failedAttempts = [
  await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: sessionA.external_brain_session_id,
    writing_context_bundle_id: sessionB.writing_context_bundle_id,
  }),
  await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: sessionB.external_brain_session_id,
    writing_context_bundle_id: sessionA.writing_context_bundle_id,
  }),
  await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: unknownSession,
    writing_context_bundle_id: sessionA.writing_context_bundle_id,
  }),
  await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: sessionA.external_brain_session_id,
    writing_context_bundle_id: unknownBundle,
  }),
  await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: unknownSession,
    writing_context_bundle_id: unknownBundle,
  }),
];
for (const failed of failedAttempts) assertBlocked(failed);

const successIdsAfterFailures = new Set([
  ...(await listNeuralTraces({ run_id: sessionA.external_brain_session_id })),
  ...(await listNeuralTraces({ run_id: sessionB.external_brain_session_id })),
].filter((trace) => trace.status === "success").map((trace) => trace.trace_id));
assert.deepEqual(successIdsAfterFailures, successIdsBeforeFailures);

const retryOne = await invoke(sessionA, "character_simulator", { attempt: 1 });
const retryTwo = await invoke(sessionA, "character_simulator", { attempt: 2 });
assertSuccess(retryOne, sessionA, "character_simulator");
assertSuccess(retryTwo, sessionA, "character_simulator");
assert.notEqual(retryOne.trace.trace_id, retryTwo.trace.trace_id);
assert.equal((await getNeuralTrace(retryOne.trace.trace_id)).trace_id, retryOne.trace.trace_id);
assert.equal((await getNeuralTrace(retryTwo.trace.trace_id)).trace_id, retryTwo.trace.trace_id);

for (const session of [sessionA, sessionB]) {
  for (const moduleName of ["character_simulator", "neural_critic", "style_drift_detector", "over_governance_detector"]) {
    if (session === sessionA && moduleName === "character_simulator") continue;
    const result = await invoke(session, moduleName);
    assertSuccess(result, session, moduleName);
  }
}

const alphaHash = sha256(rawAlpha);
const betaHash = sha256(rawBeta);
assert.notEqual(alphaHash, betaHash);
const polishA1 = await chatgpt_bridge_use_final_polisher({
  external_brain_session_id: sessionA.external_brain_session_id,
  writing_context_bundle_id: sessionA.writing_context_bundle_id,
  raw_story_text: rawAlpha,
});
const polishA2 = await chatgpt_bridge_use_final_polisher({
  external_brain_session_id: sessionA.external_brain_session_id,
  writing_context_bundle_id: sessionA.writing_context_bundle_id,
  raw_story_text: rawAlpha,
});
const polishB = await chatgpt_bridge_use_final_polisher({
  external_brain_session_id: sessionB.external_brain_session_id,
  writing_context_bundle_id: sessionB.writing_context_bundle_id,
  raw_story_text: rawBeta,
});
assertSuccess(polishA1, sessionA, "final_polisher");
assertSuccess(polishA2, sessionA, "final_polisher");
assertSuccess(polishB, sessionB, "final_polisher");
assert.equal(polishA1.generation_boundary, "post_generation");
assert.equal(polishA1.raw_story_sha256, alphaHash);
assert.equal(polishA2.raw_story_sha256, alphaHash);
assert.equal(polishB.raw_story_sha256, betaHash);
assert.notEqual(polishA1.trace.trace_id, polishA2.trace.trace_id);

assert.deepEqual({
  canon: await treeDigest("data/canon_db"),
  candidates: await treeDigest("data/outputs/writing_candidates"),
}, protectedStateBefore);

console.log(JSON.stringify({
  result: "Phase44D direct session binding/isolation/trace integrity PASS",
  session_a: sessionA.external_brain_session_id,
  bundle_a: sessionA.writing_context_bundle_id,
  session_b: sessionB.external_brain_session_id,
  bundle_b: sessionB.writing_context_bundle_id,
  success_trace_count_before_failures: successIdsBeforeFailures.size,
  success_trace_count_after_failures: successIdsAfterFailures.size,
  retry_trace_ids: [retryOne.trace.trace_id, retryTwo.trace.trace_id],
  retry_output_hashes: [retryOne.trace.output_hash, retryTwo.trace.output_hash],
  final_polisher_a_trace_ids: [polishA1.trace.trace_id, polishA2.trace.trace_id],
  final_polisher_b_trace_id: polishB.trace.trace_id,
  sha_alpha: alphaHash,
  sha_beta: betaHash,
}, null, 2));
