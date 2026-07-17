import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
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
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const guardNames = ["candidate_created", "canon_updated", "active_engine_updated", "adopted", "settled"];
const preGenerationCapabilities = [
  ["scene_planner", chatgpt_bridge_use_scene_planner],
  ["character_simulator", chatgpt_bridge_use_character_simulator],
  ["neural_critic", chatgpt_bridge_use_neural_critic],
  ["style_drift_detector", chatgpt_bridge_use_style_drift_detector],
  ["over_governance_detector", chatgpt_bridge_use_over_governance_detector],
  ["writing_card_director", chatgpt_bridge_use_writing_card_director],
];
const neuralModuleNames = [...preGenerationCapabilities.map(([name]) => name), "final_polisher"];
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

function asText(value) {
  return JSON.stringify(value);
}

function assertAllGuardsFalse(value) {
  for (const name of guardNames) {
    assert.equal(value[name], false, `${name} must remain false`);
    assert.equal(value.mutation_guards[name], false, `mutation_guards.${name} must remain false`);
  }
}

const cleanupBaselines = new Map(await Promise.all(cleanupRoots.map(async (root) => [root, await names(root)])));

try {
  assert.equal(externalBrainOwnership.final_prose_generator, "chatgpt");
  assert.deepEqual(
    externalBrainPreGenerationCapabilities,
    preGenerationCapabilities.map(([name]) => `run_${name}`),
  );
  assert.equal(externalBrainPreGenerationCapabilities.length, 6);
  assert.deepEqual(externalBrainMutationGuards, Object.fromEntries(guardNames.map((name) => [name, false])));

  const neuralModuleSource = await readFile(
    path.join(projectRoot, "server", "src", "neural-module-service.mjs"),
    "utf8",
  );
  const moduleSpecBody = neuralModuleSource.match(/const moduleSpecs = \{(?<body>[\s\S]*?)\n\};/u)?.groups.body;
  assert(moduleSpecBody, "neural-module-service moduleSpecs must remain inspectable");
  const moduleSpecNames = [...moduleSpecBody.matchAll(/^  ([a-z][a-z0-9_]*): \{$/gmu)].map((match) => match[1]);
  assert.deepEqual(moduleSpecNames, neuralModuleNames);
  assert.equal(moduleSpecNames.length, 7);

  const hashesBefore = await currentProtectedHashes();
  assert.deepEqual(hashesBefore, protectedHashes);

  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: "Phase46A regression：讓人物先於攝影機，保留不知道與普通摩擦。",
    chapter_mode: "specific_scene",
  });
  assert.equal(session.ok, true);
  assertAllGuardsFalse(session);

  const outputs = new Map();
  for (const [name, invoke] of preGenerationCapabilities) {
    const response = await invoke({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { phase: "46A" },
    });
    assert.equal(response.ok, true);
    assert.equal(response.capability_name, `run_${name}`);
    assert.equal(response.generation_boundary, "pre_generation");
    assert.equal(response.prose_generator, "ChatGPT");
    assertAllGuardsFalse(response);
    outputs.set(name, response.capability_output);
  }

  const scene = outputs.get("scene_planner");
  assert.equal(typeof scene, "object");
  assert.equal(
    Object.hasOwn(scene, "focal_attention"),
    false,
  );
  assert.equal(
    Object.hasOwn(scene, "scene_beats"),
    false,
  );

  const character = outputs.get("character_simulator");
  assert.equal(typeof character, "object");
  assert.equal(
    Object.hasOwn(character, "character_cognition"),
    false,
  );
  assert.equal(
    Object.hasOwn(character, "behavior_constraints"),
    false,
  );

  const critic = outputs.get("neural_critic");
  assert.equal(critic.evidence_only, true);
  assert.deepEqual(critic.hard_risk_scope, [
    "canon",
    "causality",
    "identity",
    "character_state",
    "timeline",
    "explicit_user_requirement",
  ]);
  assert.equal(Object.hasOwn(critic, "risks"), false);

  const style = outputs.get("style_drift_detector");
  assert.equal(typeof style, "object");
  assert.equal(
    Object.hasOwn(
      style,
      "narrative_camera_template_sequences",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(style, "cluster_cognition"),
    false,
  );

  const governance = outputs.get("over_governance_detector");
  assert.equal(typeof governance, "object");

  const director = outputs.get("writing_card_director");
  assert.deepEqual(director.hard_authority, [
    "Canon",
    "causal continuity",
    "character identity and state",
    "timeline",
    "explicit user requirements",
  ]);
  assert.match(
    director.arbitration_rule,
    /do not convert diagnostics into prose requirements/iu,
  );
  assert.equal(
    Object.hasOwn(
      director,
      "selected_technique_families",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      director,
      "active_technique_cognition",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      director,
      "technique_learning_principle",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      director,
      "available_technique_families",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      director,
      "technique_selection_policy",
    ),
    false,
  );

  async function invokeDirector(selectedTechniqueFamilies) {
    return await chatgpt_bridge_use_writing_card_director({
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: { selected_technique_families: selectedTechniqueFamilies },
    });
  }

  function assertSelectedDirector(response, selectedFamilies) {
    assert.equal(response.ok, true);
    assert.equal(response.orchestration_owner, "ChatGPT");
    assert.equal(response.prose_generator, "ChatGPT");
    assertAllGuardsFalse(response);

    if (selectedFamilies.length === 0) {
      assert.equal(
        Object.hasOwn(
          response.capability_output,
          "selected_technique_families",
        ),
        false,
      );
      assert.equal(
        Object.hasOwn(
          response.capability_output,
          "active_technique_cognition",
        ),
        false,
      );
    } else {
      assert.deepEqual(
        response.capability_output
          .selected_technique_families,
        selectedFamilies,
      );
      assert.deepEqual(
        Object.keys(
          response.capability_output
            .active_technique_cognition,
        ),
        selectedFamilies,
      );
    }

    return response.capability_output;
  }

  const explicitEmpty = assertSelectedDirector(
    await invokeDirector([]),
    [],
  );
  assert.equal(
    Object.hasOwn(
      explicitEmpty,
      "active_technique_cognition",
    ),
    false,
  );

  const oneFamily = assertSelectedDirector(
    await invokeDirector(["constraint_driven_conflict"]),
    ["constraint_driven_conflict"],
  );
  assert.match(asText(oneFamily.active_technique_cognition), /incorrect hypothesis.*observation.*test.*cost.*revision.*physical position reasoning/iu);
  assert.equal("relational_comedy" in oneFamily.active_technique_cognition, false);
  assert.equal("ensemble_motion" in oneFamily.active_technique_cognition, false);

  const twoFamilies = assertSelectedDirector(
    await invokeDirector(["relational_comedy", "subtle_relationships"]),
    ["relational_comedy", "subtle_relationships"],
  );
  assert.deepEqual(Object.keys(twoFamilies.active_technique_cognition), ["relational_comedy", "subtle_relationships"]);
  assert.match(asText(twoFamilies.active_technique_cognition), /natural useless banter.*distance change.*address form/iu);
  assert.equal("constraint_driven_conflict" in twoFamilies.active_technique_cognition, false);

  const deduplicated = assertSelectedDirector(
    await invokeDirector(["relational_comedy", "relational_comedy"]),
    ["relational_comedy"],
  );
  assert.deepEqual(Object.keys(deduplicated.active_technique_cognition), ["relational_comedy"]);

  const tooMany = await invokeDirector([
    "constraint_driven_conflict",
    "restriction_and_pressure",
    "relational_comedy",
  ]);
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.blocked, true);
  assert.match(tooMany.blocked_reason, /at most two unique families.*received 3/iu);
  assert.equal(tooMany.orchestration_owner, "ChatGPT");
  assert.equal(tooMany.prose_generator, "ChatGPT");
  for (const name of guardNames) assert.equal(tooMany.mutation_guards[name], false);

  const unknownFamily = await invokeDirector(["relational_comedy", "unknown_family"]);
  assert.equal(unknownFamily.ok, false);
  assert.equal(unknownFamily.blocked, true);
  assert.match(unknownFamily.blocked_reason, /Unknown technique family.*unknown_family/iu);
  assert.equal(unknownFamily.orchestration_owner, "ChatGPT");
  assert.equal(unknownFamily.prose_generator, "ChatGPT");
  for (const name of guardNames) assert.equal(unknownFamily.mutation_guards[name], false);

  const rawStory = "她本來想道歉，開口卻先問：『午餐還有嗎？』";
  const polished = await chatgpt_bridge_use_final_polisher({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    raw_story_text: rawStory,
    raw_story_sha256: sha256(rawStory),
  });
  assert.equal(polished.ok, true);
  assert.equal(polished.generation_boundary, "post_generation");
  assert.equal(polished.prose_generator, "ChatGPT");
  assertAllGuardsFalse(polished);
  const finalPolisherMcpBytes = Buffer.byteLength(JSON.stringify(polished, null, 2), "utf8");
  assert(finalPolisherMcpBytes < 14 * 1024, `final_polisher MCP response is not below 14 KiB: ${finalPolisherMcpBytes} bytes`);

  const report = polished.capability_output;
  assert.equal(
    report.editorial_mode,
    "evidence_triggered_minimal_review",
  );
  assert.equal(
    report.findings_review_mode,
    "hard_conflicts_and_exact_evidence_only",
  );
  assert.equal(Object.hasOwn(report, "findings"), false);
  assert.equal(report.text_change_required, false);
  assert.equal(report.release_recommendation, "release_as_is");
  assert.equal(
    Object.hasOwn(report, "final_revision_instruction"),
    false,
  );

  assert.deepEqual(await currentProtectedHashes(), hashesBefore);
  console.log(`Phase46A existing-neural human-prose cognition upgrade PASS: final_polisher_mcp_bytes=${finalPolisherMcpBytes}`);
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
