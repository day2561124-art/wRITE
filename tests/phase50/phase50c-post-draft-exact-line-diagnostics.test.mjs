import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import {
  buildPostDraftNeuralCritique,
  buildPostDraftStyleDriftReport,
  postDraftLineDiagnosticVersion,
} from "../../server/src/post-draft-line-diagnostic-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function finding(output, issueType) {
  return output.findings.find((item) => item.issue_type === issueType);
}

function assertExactLineFinding(value) {
  assert.match(value.finding_id, /^F\d{2}$/u);
  assert(Number.isInteger(value.line_start));
  assert(Number.isInteger(value.line_end));
  assert.match(value.line_reference, /^L\d+(?:-L\d+)?$/u);
  assert(Number.isInteger(value.column_start));
  assert(Number.isInteger(value.column_end));
  assert.equal(typeof value.issue_type, "string");
  assert.equal(typeof value.severity, "string");
  assert.equal(typeof value.quote, "string");
  assert(value.quote.length > 0);
  assert.equal(typeof value.reason, "string");
  assert(value.reason.length > 0);
  assert.equal(typeof value.must_fix, "boolean");
  assert.equal(typeof value.minimal_direction, "string");
  assert(value.minimal_direction.length > 0);
  assert.equal(typeof value.confidence, "string");
}

const draft = [
  "甲：「我其實看見了訊息。」",
  "這意味著他們的關係終於完成了和解。",
  "Writer Workbench 規則要求他停下。",
  "她感到一陣悲傷。",
  "新的篇章就此展開。",
].join("\n");

const characterTurnStates = [{
  character: "甲",
  known: ["乙正在等答案"],
  guessed: ["乙其實在意"],
  refuses_to_admit: ["其實看見了訊息"],
  immediate_goal: "先避開追問",
  speech_ceiling: "不能說其實看見了訊息",
}];

const inactiveCritic = buildPostDraftNeuralCritique({
  taskPrompt: "禁止 Writer Workbench 術語進入正文。",
});
assert.equal(inactiveCritic.diagnostic_version, postDraftLineDiagnosticVersion);
assert.equal(inactiveCritic.analysis_phase, "pre_generation_compatibility");
assert.equal(inactiveCritic.analysis_status, "inactive_without_draft_evidence");
assert.equal(inactiveCritic.draft_evidence_status, "not_available_pre_generation");
assert.deepEqual(inactiveCritic.findings, []);

const inactiveStyle = buildPostDraftStyleDriftReport({ taskPrompt: "測試" });
assert.equal(inactiveStyle.analysis_status, "inactive_without_draft_evidence");
assert.equal(inactiveStyle.pre_generation_status, "inactive_without_draft_evidence");
assert.deepEqual(inactiveStyle.findings, []);

const directCritic = buildPostDraftNeuralCritique({
  taskPrompt: "禁止 Writer Workbench 術語進入正文。",
  capabilityInput: {
    draft_text: draft,
    character_turn_states: characterTurnStates,
    forbidden_content: ["Writer Workbench"],
  },
});
assert.equal(directCritic.analysis_phase, "post_generation_diagnostic");
assert.equal(directCritic.analysis_status, "exact_line_review_complete");
assert.equal(directCritic.draft_sha256, sha256(draft));
assert.equal(directCritic.draft_line_count, 5);
assert.equal(directCritic.release_recommendation, "minimal_targeted_revision_required");
assertExactLineFinding(finding(directCritic, "admission_boundary_violation"));
assert.equal(finding(directCritic, "admission_boundary_violation").line_reference, "L1");
assert.equal(finding(directCritic, "admission_boundary_violation").character, "甲");
assert.equal(finding(directCritic, "admission_boundary_violation").must_fix, true);
assertExactLineFinding(finding(directCritic, "explicit_user_requirement_violation"));
assert.equal(finding(directCritic, "explicit_user_requirement_violation").line_reference, "L3");

const directStyle = buildPostDraftStyleDriftReport({
  taskPrompt: "檢查正文風格漂移。",
  capabilityInput: { draft_text: draft },
});
assert.equal(directStyle.analysis_phase, "post_generation_diagnostic");
assert.equal(directStyle.draft_sha256, sha256(draft));
assert.equal(directStyle.draft_line_count, 5);
for (const [issueType, lineReference, mustFix] of [
  ["subtext_explicitly_explained", "L2", false],
  ["workflow_language_leak", "L3", true],
  ["generic_emotion_label", "L4", false],
  ["meaning_closed_ending", "L5", false],
]) {
  const item = finding(directStyle, issueType);
  assertExactLineFinding(item);
  assert.equal(item.line_reference, lineReference);
  assert.equal(item.must_fix, mustFix);
}

const cleanStyle = buildPostDraftStyleDriftReport({
  taskPrompt: "檢查正文。",
  capabilityInput: {
    draft_text: "她把杯子推回桌中央。\n門外的腳步停了一次，又繼續往樓下去。",
  },
});
assert.deepEqual(cleanStyle.findings, []);
assert.equal(cleanStyle.release_recommendation, "release_as_is_from_style_review");

const leadingBlankDraft = "\n甲：「其實看見了訊息。」";
const leadingBlankCritic = buildPostDraftNeuralCritique({
  capabilityInput: {
    draft_text: leadingBlankDraft,
    character_turn_states: characterTurnStates,
  },
});
assert.equal(leadingBlankCritic.draft_sha256, sha256(leadingBlankDraft));
assert.equal(
  finding(leadingBlankCritic, "admission_boundary_violation").line_reference,
  "L2",
);

const baselines = new Map(await Promise.all(
  cleanupRoots.map(async (root) => [root, await names(root)]),
));

try {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: "寫甲與乙的短場景。禁止 Writer Workbench 術語進入正文。",
    chapter_mode: "specific_scene",
    generation_context: {
      active_characters: ["甲", "乙"],
      scene_now: "乙追問甲是否看過訊息",
      immediate_pressure: "甲不願承認已讀",
      character_states: {
        甲: {
          current_emotion: "心虛",
          known_facts: ["乙正在等答案"],
          assumptions: ["乙其實在意"],
          visible_reactions_allowed: ["把手機翻面"],
          hidden_reactions_reserved: ["其實看見了訊息"],
        },
      },
    },
  });
  assert.equal(session.ok, true);

  const common = {
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  };

  assert.equal((await chatgpt_bridge_use_scene_planner({
    ...common,
    capability_input: {
      active_characters: ["甲", "乙"],
      scene_now: "乙追問甲是否看過訊息",
      immediate_pressure: "甲不願承認已讀",
    },
  })).ok, true);
  assert.equal((await chatgpt_bridge_use_character_simulator({
    ...common,
    capability_input: { character: "甲" },
  })).ok, true);

  const preCritic = await chatgpt_bridge_use_neural_critic(common);
  assert.equal(preCritic.ok, true);
  assert.equal(preCritic.generation_boundary, "pre_generation");
  assert.equal(
    preCritic.capability_output.analysis_status,
    "inactive_without_draft_evidence",
  );

  const preStyle = await chatgpt_bridge_use_style_drift_detector(common);
  assert.equal(preStyle.ok, true);
  assert.equal(preStyle.generation_boundary, "pre_generation");
  assert.equal(
    preStyle.capability_output.analysis_status,
    "inactive_without_draft_evidence",
  );

  assert.equal((await chatgpt_bridge_use_over_governance_detector(common)).ok, true);
  assert.equal((await chatgpt_bridge_use_writing_card_director(common)).ok, true);

  const critic = await chatgpt_bridge_use_neural_critic({
    ...common,
    capability_input: {
      draft_text: draft,
      character_turn_states: characterTurnStates,
      forbidden_content: ["Writer Workbench"],
    },
  });
  assert.equal(critic.ok, true);
  assert.equal(critic.generation_boundary, "post_generation_diagnostic");
  assert.equal(critic.generation_surface.used, true);
  assert.equal(critic.capability_output.analysis_status, "exact_line_review_complete");
  assert.equal(critic.capability_output.draft_sha256, sha256(draft));
  assertExactLineFinding(
    finding(critic.capability_output, "admission_boundary_violation"),
  );
  assertExactLineFinding(
    finding(critic.capability_output, "explicit_user_requirement_violation"),
  );

  const style = await chatgpt_bridge_use_style_drift_detector({
    ...common,
    capability_input: { draft_text: draft },
  });
  assert.equal(style.ok, true);
  assert.equal(style.generation_boundary, "post_generation_diagnostic");
  assert.equal(style.capability_output.analysis_status, "exact_line_review_complete");
  assert.equal(style.capability_output.draft_sha256, sha256(draft));
  assertExactLineFinding(
    finding(style.capability_output, "workflow_language_leak"),
  );

  for (const response of [critic, style]) {
    const visible = JSON.stringify(response.capability_output);
    assert.equal(Object.hasOwn(response.capability_output, "draft_text"), false);
    assert.equal(Object.hasOwn(response.capability_output, "raw_draft_text"), false);
    assert.equal(visible.includes("story_material_cognition"), false);
    assert.equal(visible.includes("grounded_material"), false);
    assert.equal(visible.includes(draft), false);
    assert(Buffer.byteLength(JSON.stringify(response), "utf8") < 20 * 1024);
    for (const item of response.capability_output.findings) {
      assertExactLineFinding(item);
    }
  }

  const customOutput = {
    result_type: "neural_critique",
    custom: "adapter_output_remains_exact",
  };
  const custom = await chatgpt_bridge_use_neural_critic({
    ...common,
    capability_input: { draft_text: "甲推開門。" },
  }, { adapter: async () => customOutput });
  assert.equal(custom.generation_boundary, "post_generation_diagnostic");
  assert.deepEqual(custom.capability_output, customOutput);

  console.log(
    "Phase50C post-draft exact-line critic and style diagnostics passed.",
  );
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, baselines.get(root));
  }
}
