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
  assert.deepEqual(Object.keys(scene.focal_attention), [
    "focal_consciousness",
    "attention_priority",
    "perception_boundary",
    "ignored_information",
    "body_first_signals",
    "environment_entry_reason",
  ]);
  assert.match(asText(scene), /do not default to a panoramic or cinematic establishing shot/iu);
  assert.match(asText(scene), /current attention, action, bodily load, and pressure/iu);
  assert.match(asText(scene), /deliberate narrator distance.*scene or time transitions.*multi-POV transitions/iu);
  assert.match(asText(scene), /not narrator-led transition/iu);
  assert.match(asText(scene), /precision added only to look concrete.*narrative, character, or causal source/iu);
  assert.match(asText(scene), /combat causality.*physical position.*timing pressure.*navigation.*canon/iu);

  const character = outputs.get("character_simulator");
  assert.deepEqual(Object.keys(character.character_cognition), [
    "self_story",
    "misrecognized_motive",
    "avoided_question",
    "false_certainty",
    "behavioral_leak",
    "awareness_threshold",
  ]);
  assert.match(asText(character), /actual motive may remain unknown|never force a guessed true motive/iu);
  assert.match(asText(character), /backstage cognition|precise self-analysis/iu);
  assert.match(asText(character), /established character voice.*prior behavior.*current scene pressure/iu);
  assert.match(asText(character), /Human irregularity is not randomness.*not a menu of anti-AI behaviors/iu);
  assert.doesNotMatch(asText(character), /answer a different question|mishear|decline to repeat|apology is expected/iu);

  const critic = outputs.get("neural_critic");
  const riskCodes = critic.risks.map((risk) => risk.code);
  assert.deepEqual(riskCodes, [
    "character_reaction_too_correct",
    "self_awareness_overcompleted",
    "scene_function_overoptimization",
    "supporting_actor_functionality",
    "narrative_information_without_attention_source",
    "character_gender_or_pronoun_conflict",
    "unsupported_body_trait_invention",
    "appearance_fact_conflict",
    "canon_entity_name_collision",
    "original_entity_freedom_violation",
    "generated_existing_character_ungrounded",
  ]);
  assert.match(asText(critic), /every character.*reaction best suited|supporting character or bystander/iu);
  const attentionSourceRisk = critic.risks.find((risk) => risk.code === "narrative_information_without_attention_source");
  assert.match(attentionSourceRisk.question, /character attention.*deliberate narrator distance.*scene or time transition.*multi-POV transition.*causal need/iu);
  assert.match(attentionSourceRisk.question, /source-less placement.*do not require every fact to be character-noticed/iu);
  assert.match(asText(critic), /Do not require, manufacture, reverse-engineer, or optimize.*theme/iu);
  assert.match(asText(critic), /Do not search for a chapter theme.*natural meaning may emerge/iu);
  assert.doesNotMatch(asText(critic), /Do not pursue theme/iu);

  const style = outputs.get("style_drift_detector");
  assert.equal(style.narrative_camera_template_sequences.length, 3);
  assert.match(style.detection_method, /narrative grammar.*sequence shape.*cluster density/iu);
  assert.match(style.detection_method, /not a banned-word list/iu);
  assert.match(style.detection_method, /no single word or isolated gesture/iu);
  assert.match(style.detection_method, /repeated narrative jobs.*sequence reuse rather than lexical avoidance/iu);
  assert.match(asText(style), /environment establishing shot.*distant ambient sound.*spatial filtering metaphor.*character microreaction.*short dialogue reveal/iu);
  assert.match(asText(style), /microreaction repeatedly used as a camera bridge.*sensory statement immediately proved.*spatial-filter metaphor.*environment.*gesture.*dialogue paragraph cadence/iu);
  assert.doesNotMatch(asText(style.cluster_cognition), /fingertip stops|small frowns|delayed answers/iu);
  assert.match(asText(style), /生成式攝影機拍場景/u);
  assert.match(asText(style), /Sentence rhythm must follow the character's current attention and pressure/iu);

  const governance = outputs.get("over_governance_detector");
  assert.match(asText(governance), /Do not copy cognition field names, structures, or proof sentences into prose/iu);
  assert.match(asText(governance), /unknown motive.*ability shortcut.*focal consciousness.*supporting character's independent purpose/iu);

  const director = outputs.get("writing_card_director");
  assert.match(asText(director), /Write the people first/iu);
  assert.match(asText(director), /natural Traditional Chinese narrative flow/iu);
  assert.match(asText(director), /Do not seek a theme, symbolic closure/iu);
  assert.match(asText(director.technique_learning_principle), /opt-in cognitive methods.*never default simultaneous directives.*prose-style imitation.*ChatGPT owns selection/iu);
  assert.deepEqual(director.available_technique_families, [
    "constraint_driven_conflict",
    "restriction_and_pressure",
    "relational_comedy",
    "ensemble_motion",
    "subtle_relationships",
  ]);
  assert.deepEqual(director.selected_technique_families, []);
  assert.deepEqual(director.active_technique_cognition, {});
  assert.doesNotMatch(asText(director), /incorrect hypothesis|natural useless banter|groups separate and naturally collide/iu);
  assert.equal(director.technique_selection_policy.default_selection, "none");
  assert.match(asText(director.technique_selection_policy), /No more than one or two technique families/iu);
  assert.match(asText(director.technique_selection_policy), /Never alter a scene merely to demonstrate a learned technique/iu);
  assert.match(asText(director.technique_selection_policy), /Character truth, canon, causal continuity, and natural Traditional Chinese override/iu);

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
    assert.deepEqual(response.capability_output.selected_technique_families, selectedFamilies);
    assert.deepEqual(Object.keys(response.capability_output.active_technique_cognition), selectedFamilies);
    return response.capability_output;
  }

  const explicitEmpty = assertSelectedDirector(await invokeDirector([]), []);
  assert.deepEqual(explicitEmpty.active_technique_cognition, {});

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
  const findings = new Map(report.findings.map((finding) => [finding.code, finding]));
  const phase45Findings = [
    "pattern_saturation",
    "symmetry_overcompleted",
    "callback_saturation",
    "echo_only_callback",
    "author_hand_visible",
    "strong_beat_dilution",
  ];
  const phase46Findings = [
    "narrative_camera_template",
    "human_diction_friction",
    "referent_and_spatial_ambiguity",
    "functional_overcompression",
    "self_awareness_overcompleted",
  ];
  for (const code of [...phase45Findings, ...phase46Findings]) {
    assert(findings.has(code), `Missing final-polisher finding: ${code}`);
  }
  assert.equal(findings.size, 11);

  const camera = findings.get("narrative_camera_template");
  assert.equal(camera.severity, "high");
  assert.match(camera.evidence[0].requirement, /at least two exact passages or precise local sequences/iu);
  assert.match(camera.evidence[0].requirement, /sequence\/cluster pattern|single word.*never sufficient/iu);
  assert.match(camera.diagnosis, /character attention.*deliberate narrator distance.*legitimate transition.*causal need/iu);
  assert.doesNotMatch(camera.diagnosis, /instead of character-led attention/iu);
  assert.match(camera.revision_action, /Reorder information.*delete source-less establishing narration.*character action or attention.*preserve and clarify a legitimate narrator-led transition/iu);
  assert.match(camera.revision_action, /never use synonym-only replacement/iu);
  assert(camera.preserve.includes("legitimate_narrator_distance"));
  assert(camera.preserve.includes("legitimate_transition"));

  const diction = findings.get("human_diction_friction");
  assert.equal(diction.severity, "medium");
  assert.match(diction.evidence[0].requirement, /exact passage/iu);
  assert.match(diction.revision_action, /minimum revision.*preserve character voice.*original rhythm/iu);
  assert.match(diction.revision_action, /do not beautify/iu);

  const ambiguity = findings.get("referent_and_spatial_ambiguity");
  assert.match(ambiguity.revision_action, /minimum information.*do not add unnecessary spatial explanation/iu);

  const compression = findings.get("functional_overcompression");
  assert(["medium", "high"].includes(compression.severity));
  assert.match(compression.revision_action, /Never add filler, banter, sensory detail, or random objects to prove naturalness/iu);
  assert.match(compression.revision_action, /remove immediate interpretation or needless payoff.*minor beat end without callback.*supporting actor.*ordinary concern/iu);
  assert.match(compression.revision_action, /stop making each reaction complete the previous line's dramatic job/iu);

  const awareness = findings.get("self_awareness_overcompleted");
  assert.equal(awareness.severity, "high");
  assert.doesNotMatch(asText(awareness), /I don't know/iu);
  assert.match(awareness.evidence[0].requirement, /explicit uncertainty.*unresolved emotion.*demonstrated confusion.*incomplete self-knowledge/iu);
  assert.match(awareness.evidence[0].requirement, /established awareness.*established voice.*prior behavior/iu);
  assert.match(awareness.diagnosis, /Precise articulation alone is not a defect/iu);
  assert.match(awareness.diagnosis, /healthy, mature, expressive characters are valid/iu);
  assert.match(awareness.revision_action, /never invent or solve a true hidden motive/iu);
  assert.match(awareness.revision_action, /Unknown remains valid/iu);
  assert.match(awareness.revision_action, /minimal intervention/iu);
  assert.match(report.final_revision_instruction, /natural human-written Traditional Chinese/iu);
  assert.match(report.final_revision_instruction, /remove AI narrative grammar only when sequence or cluster evidence exists/iu);
  assert.match(report.final_revision_instruction, /prefer subtraction over beautification or theme completion/iu);
  assert.match(report.final_revision_instruction, /ChatGPT remains the final prose generator/iu);

  assert.deepEqual(await currentProtectedHashes(), hashesBefore);
  console.log(`Phase46A existing-neural human-prose cognition upgrade PASS: final_polisher_mcp_bytes=${finalPolisherMcpBytes}`);
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}
