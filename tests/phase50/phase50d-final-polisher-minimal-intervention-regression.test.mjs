import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

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
  enforceFinalPolisherMinimalIntervention,
  finalPolisherMinimalInterventionGuardVersion,
} from "../../server/src/final-polisher-minimal-intervention-guard-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const rawStory = [
  "甲：「你昨天沒回我。」",
  "乙：「忙。」",
  "甲：「喔。」",
].join("\n");

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

function hasProseKey(value) {
  if (!value || typeof value !== "object") return false;
  const proseKeys = new Set([
    "polished_text",
    "revised_text",
    "rewritten_text",
    "revision_text",
    "replacement_text",
    "final_text",
    "final_prose",
    "story_text",
    "output_text",
    "candidate_text",
    "final_candidate_text",
    "revised_story_text",
  ]);
  return Object.entries(value).some(([key, item]) => (
    proseKeys.has(key)
    || (item && typeof item === "object" && hasProseKey(item))
  ));
}

async function readySession(label) {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt: `${label}。保留短對話的停頓，不替沉默解釋。`,
    chapter_mode: "specific_scene",
    generation_context: {
      active_characters: ["甲", "乙"],
      scene_now: "甲問乙為何沒有回覆訊息",
      immediate_pressure: "乙不願解釋",
    },
  });
  assert.equal(session.ok, true);
  const common = {
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  };
  for (const invoke of [
    chatgpt_bridge_use_scene_planner,
    chatgpt_bridge_use_character_simulator,
    chatgpt_bridge_use_neural_critic,
    chatgpt_bridge_use_style_drift_detector,
    chatgpt_bridge_use_over_governance_detector,
    chatgpt_bridge_use_writing_card_director,
  ]) {
    const result = await invoke(common);
    assert.equal(result.ok, true);
  }
  return common;
}

const reportOnly = enforceFinalPolisherMinimalIntervention({
  raw_story_text: rawStory,
  capability_output: {
    result_type: "final_polisher_report",
    text_change_required: false,
    release_recommendation: "release_as_is",
  },
});
assert.equal(reportOnly.accepted, true);
assert.equal(
  reportOnly.public_guard.guard_version,
  finalPolisherMinimalInterventionGuardVersion,
);
assert.equal(reportOnly.public_guard.raw_story_sha256, sha256(rawStory));
assert.equal(reportOnly.public_guard.release_story_sha256, sha256(rawStory));
assert.equal(reportOnly.public_guard.text_identity_preserved, true);
assert.equal(reportOnly.public_guard.prose_payload_count, 0);
assert.deepEqual(reportOnly.public_guard.violations, []);

const exactEcho = enforceFinalPolisherMinimalIntervention({
  raw_story_text: rawStory,
  capability_output: {
    result_type: "final_polisher_report",
    polished_text: rawStory,
  },
});
assert.equal(exactEcho.accepted, true);
assert.equal(exactEcho.public_guard.prose_payload_count, 1);
assert.equal(exactEcho.public_guard.changed_prose_payload_count, 0);
assert.equal(exactEcho.public_guard.text_identity_preserved, true);
assert.equal(exactEcho.capability_output.polished_text, rawStory);

const mutationCases = [
  {
    name: "dialogue",
    field: "polished_text",
    text: `${rawStory}\n乙：「其實我一直在等你。」`,
    violation: "added_dialogue_forbidden",
  },
  {
    name: "psychology",
    field: "revised_text",
    text: `${rawStory}\n乙其實害怕被甲討厭。`,
    violation: "added_psychology_forbidden",
  },
  {
    name: "causal",
    field: "final_text",
    text: `${rawStory}\n因為乙不知道怎麼回答，所以只說了一個字。`,
    violation: "added_causal_explanation_forbidden",
  },
  {
    name: "silence",
    field: "replacement_text",
    text: `${rawStory}\n乙沒有回答，因為他不願承認自己在意。`,
    violation: "silence_explanation_forbidden",
  },
];

for (const testCase of mutationCases) {
  const guarded = enforceFinalPolisherMinimalIntervention({
    raw_story_text: rawStory,
    capability_output: {
      result_type: "final_polisher_report",
      nested: {
        [testCase.field]: testCase.text,
      },
    },
  });
  assert.equal(guarded.accepted, false, testCase.name);
  assert.equal(guarded.public_guard.text_identity_preserved, false, testCase.name);
  assert(guarded.public_guard.violations.includes("changed_prose_payload_forbidden"));
  assert(guarded.public_guard.violations.includes(testCase.violation), testCase.name);
  assert.equal(hasProseKey(guarded.capability_output), false, testCase.name);
  assert.equal(JSON.stringify(guarded.capability_output).includes(testCase.text), false);
}

const baselines = new Map(await Promise.all(
  cleanupRoots.map(async (root) => [root, await names(root)]),
));

try {
  const defaultSession = await readySession("Phase50D default exact release");
  const defaultResult = await chatgpt_bridge_use_final_polisher({
    ...defaultSession,
    raw_story_text: rawStory,
    raw_story_sha256: sha256(rawStory),
  });
  assert.equal(defaultResult.ok, true);
  assert.equal(defaultResult.trace.status, "success");
  assert.equal(defaultResult.raw_story_sha256, sha256(rawStory));
  assert.equal(
    defaultResult.capability_output.release_story_sha256,
    sha256(rawStory),
  );
  assert.equal(defaultResult.capability_output.text_identity_preserved, true);
  assert.equal(defaultResult.capability_output.text_change_required, false);
  assert.equal(defaultResult.capability_output.release_recommendation, "release_as_is");
  assert.equal(hasProseKey(defaultResult.capability_output), false);
  assert.equal(
    defaultResult.final_polisher_minimal_intervention_guard
      .text_identity_preserved,
    true,
  );
  assert.equal(
    defaultResult.final_polisher_minimal_intervention_guard
      .release_story_sha256,
    sha256(rawStory),
  );

  const exactEchoSession = await readySession("Phase50D exact custom echo");
  const exactEchoResult = await chatgpt_bridge_use_final_polisher({
    ...exactEchoSession,
    raw_story_text: rawStory,
    raw_story_sha256: sha256(rawStory),
  }, {
    adapter: async () => ({
      result_type: "final_polisher_report",
      polished_text: rawStory,
      revision_report: [{ action: "release_exact_raw_story" }],
    }),
  });
  assert.equal(exactEchoResult.ok, true);
  assert.equal(exactEchoResult.capability_output.polished_text, rawStory);
  assert.equal(
    exactEchoResult.final_polisher_minimal_intervention_guard
      .changed_prose_payload_count,
    0,
  );

  const blockedSession = await readySession("Phase50D changed prose rejection");
  const changedText = `${rawStory}\n乙沒有回答，因為他其實害怕失去甲。`;
  const blockedResult = await chatgpt_bridge_use_final_polisher({
    ...blockedSession,
    raw_story_text: rawStory,
    raw_story_sha256: sha256(rawStory),
  }, {
    adapter: async () => ({
      result_type: "final_polisher_report",
      polished_text: changedText,
      revision_report: [{ action: "explain_silence" }],
    }),
  });
  assert.equal(blockedResult.ok, false);
  assert.equal(blockedResult.blocked, true);
  assert.equal(
    blockedResult.blocked_stage,
    "final_polisher_minimal_intervention_guard",
  );
  assert.equal(
    blockedResult.trace.status,
    "blocked_by_minimal_intervention_guard",
  );
  assert.equal(hasProseKey(blockedResult.capability_output), false);
  assert.equal(JSON.stringify(blockedResult).includes(changedText), false);
  assert(
    blockedResult.final_polisher_minimal_intervention_guard
      .violations.includes("silence_explanation_forbidden"),
  );
  assert.notEqual(blockedResult.agent_run_status, "completed");
  assert.notEqual(blockedResult.session_lifecycle_status, "COMPLETED");

  console.log(
    "Phase50D final-polisher minimal-intervention regression hardening passed.",
  );
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, baselines.get(root));
  }
}
