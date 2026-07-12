import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  createAgentRun,
  finalizeAgentRun,
  getAgentRun,
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
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
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const objectStringHash = sha256("[object Object]");
const mutationGuardNames = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const protectedFiles = {
  active_engine: path.join(projectPaths.activeEngine),
  compressed_rules: path.join(projectPaths.compressedRules),
};
const expectedProtectedHashes = {
  active_engine: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};
const specimen = [
  "千夜用纏著繃帶的右手提起左邊書包，九逃也用受傷的左手提起右邊書包。",
  "兩人同時伸手，又同時因反射縮回。",
  "走到門邊，他們同時轉頭；那句反射性的玩笑，也同時落下。",
  "下一秒，兩人又因反射去扶同一扇門。她刻意沒有踩進任何一塊影子裡。",
  "『誰？』",
  "『……』",
  "『九逃？』",
  "『沒有。』",
  "兩人同時低頭，最後同時沒有伸手。",
].join("\n");
const capabilityCalls = [
  ["scene_planner", chatgpt_bridge_use_scene_planner],
  ["character_simulator", chatgpt_bridge_use_character_simulator],
  ["neural_critic", chatgpt_bridge_use_neural_critic],
  ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
  ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
  ["writing_card_director", chatgpt_bridge_use_writing_card_director],
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

async function fileHash(filePath) {
  return sha256(await readFile(filePath));
}

const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];
const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));

try {
  assert.deepEqual(externalBrainOwnership, {
    architecture_role: "gpt_external_brain",
    orchestration_mode: "chatgpt_owned_external_brain",
    orchestration_owner: "chatgpt",
    capability_consumer: "chatgpt",
    capability_provider: "writer_workbench",
    runtime_host: "writer_workbench_runtime",
    final_prose_generator: "chatgpt",
  });
  assert.deepEqual(externalBrainPreGenerationCapabilities, capabilityCalls.map(([name]) => `run_${name}`));
  assert.deepEqual(externalBrainMutationGuards, Object.fromEntries(mutationGuardNames.map((name) => [name, false])));

  const protectedBefore = Object.fromEntries(await Promise.all(
    Object.entries(protectedFiles).map(async ([name, filePath]) => [name, await fileHash(filePath)]),
  ));
  assert.deepEqual(protectedBefore, expectedProtectedHashes);

  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: "Phase45A regression: ChatGPT writes the story and consumes a post-generation editorial contract.",
    chapter_mode: "specific_scene",
  });
  assert.equal(session.orchestration_owner, "ChatGPT");
  assert.equal(session.prose_generator, "ChatGPT");

  const premature = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: specimen,
  });
  assert.equal(premature.ok, false);
  assert.match(premature.blocked_reason, /requires all pre-generation capabilities first/iu);

  for (const [name, invoke] of capabilityCalls) {
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "45A" },
    });
    assert.equal(response.ok, true);
    assert.equal(response.generation_boundary, "pre_generation");
    assert.equal(response.capability_name, `run_${name}`);
    assert.equal(response.trace.status, "success");
  }

  const polished = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: specimen,
  });
  assert.equal(polished.ok, true);
  assert.equal(polished.generation_boundary, "post_generation");
  assert.equal(polished.orchestration_owner, "ChatGPT");
  assert.equal(polished.prose_generator, "ChatGPT");
  assert.equal(polished.full_neural_orchestrator_used, false);
  assert.equal(polished.raw_story_sha256, sha256(specimen));
  assert.equal(polished.trace.module_name, "final_polisher");
  assert.equal(polished.trace.status, "success");
  for (const guard of mutationGuardNames) assert.equal(polished[guard], false);

  const report = polished.capability_output;
  assert.equal(report.result_type, "final_polisher_report");
  assert.equal(report.editorial_mode, "subtractive_whole_draft_review");
  assert.equal(report.raw_story_sha256, sha256(specimen));
  assert.equal(report.editorial_review_required_for_success, true);
  assert.equal(report.text_change_required, false);
  assert.equal(report.release_recommendation, "release_as_is");
  assert.match(report.release_condition, /only after ChatGPT completes the whole-draft review/iu);
  assert.equal(report.prose_ownership.final_prose_generator, "ChatGPT");
  assert.equal(report.prose_ownership.writer_workbench_generated_final_prose, false);
  assert.equal("polished_text" in report, false);
  assert.equal("revision_report" in report, false);
  assert.equal(report.editorial_strategy.primary, "editorial_subtraction");
  assert.match(report.editorial_strategy.principle, /prefer deletion, de-synchronization, compression, or silence over beautification/iu);
  assert(report.editorial_strategy.prohibited_defaults.includes("metaphor_generation"));

  const findings = new Map(report.findings.map((finding) => [finding.code, finding]));
  for (const code of [
    "pattern_saturation",
    "symmetry_overcompleted",
    "callback_saturation",
    "echo_only_callback",
    "author_hand_visible",
    "strong_beat_dilution",
  ]) {
    const finding = findings.get(code);
    assert(finding, `Missing editorial domain: ${code}`);
    assert(["low", "medium", "high"].includes(finding.severity));
    assert(Array.isArray(finding.evidence) && finding.evidence.length > 0);
    assert.match(finding.evidence[0].binding, /exact_passage|precise_location/iu);
    assert(finding.diagnosis.length > 40);
    assert(finding.revision_action.length > 40);
    assert(Array.isArray(finding.preserve) && finding.preserve.length > 0);
  }
  assert.match(findings.get("symmetry_overcompleted").revision_action, /delete, weaken, or de-synchronize/iu);
  assert.match(findings.get("author_hand_visible").diagnosis, /rule-proof narration/iu);
  assert.match(findings.get("strong_beat_dilution").revision_action, /add no explanatory narration/iu);
  assert.match(report.protected_beats[0].selection_rule, /沒有。/u);
  assert.match(report.final_revision_instruction, /ChatGPT remains the final prose generator/iu);
  assert.match(report.final_revision_instruction, /Preserve canon, causal continuity, character agency, the chapter turn, and strong emotional beats/iu);
  assert.match(report.final_revision_instruction, /Do not mechanically apply every finding/iu);
  assert.match(report.final_revision_instruction, /output only the final revised story prose/iu);
  assert.match(report.final_revision_instruction, /release the original text unchanged/iu);

  const outputA = { chapter: 45, report: { status: "ready", codes: ["pattern_saturation"] } };
  const outputB = { chapter: 45, report: { status: "ready", codes: ["author_hand_visible"] } };
  const reorderedA = { report: { codes: ["pattern_saturation"], status: "ready" }, chapter: 45 };
  assert.notEqual(hashAgentRunValue(outputA), hashAgentRunValue(outputB));
  assert.equal(hashAgentRunValue(outputA), hashAgentRunValue(reorderedA));
  assert.equal(hashAgentRunValue("final prose"), sha256("final prose"));
  assert.equal(hashAgentRunValue("[object Object]"), objectStringHash);
  assert.notEqual(hashAgentRunValue(outputA), objectStringHash);
  assert.equal(hashAgentRunValue(null), sha256("null"));
  assert.equal(hashAgentRunValue(true), sha256("true"));
  assert.equal(hashAgentRunValue(45), sha256("45"));
  assert.equal(hashAgentRunValue(Buffer.from([0, 1, 2, 255])), sha256(Buffer.from([0, 1, 2, 255])));

  const runA = await createAgentRun({ task_type: "test", input: "hash-a" });
  const runB = await createAgentRun({ task_type: "test", input: "hash-b" });
  const finalizedA = await finalizeAgentRun(runA.run_id, { output: outputA });
  const finalizedB = await finalizeAgentRun(runB.run_id, { output: outputB });
  assert.notEqual(finalizedA.output_hash, finalizedB.output_hash);
  assert.equal(finalizedA.output_hash, hashAgentRunValue(reorderedA));
  assert.notEqual(finalizedA.output_hash, objectStringHash);
  assert.equal((await getAgentRun(runA.run_id)).output_hash, finalizedA.output_hash);

  const circularRun = await createAgentRun({ task_type: "test", input: "hash-circular" });
  const circular = {};
  circular.self = circular;
  await assert.rejects(
    () => finalizeAgentRun(circularRun.run_id, { output: circular }),
    /Cannot hash a circular value/iu,
  );

  const evidence = JSON.parse(await readFile(
    path.join(projectRoot, "config", "phase45a-final-polisher-editorial-subtraction-output-hash-integrity-evidence.json"),
    "utf8",
  ));
  assert.equal(evidence.phase, "45A");
  assert.equal(evidence.final_prose_generator, "ChatGPT");
  assert.equal(evidence.editorial_contract.editorial_review_required_for_success, true);
  assert.equal(evidence.editorial_contract.text_change_required_for_success, false);
  assert.equal(evidence.historical_evidence_policy.phase44c_evidence_modified, false);

  assert.deepEqual(Object.fromEntries(await Promise.all(
    Object.entries(protectedFiles).map(async ([name, filePath]) => [name, await fileHash(filePath)]),
  )), protectedBefore);

  console.log("Phase45A final-polisher editorial subtraction and output-hash integrity PASS.");
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
