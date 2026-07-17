import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildFinalPolisherEditorialContract,
  buildMinimalWritingCardPromptContext,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  runFinalPolisherEditorialBrain,
} from "../../server/src/final-polisher-editorial-service.mjs";
import {
  buildWritingCardDirectorContext,
} from "../../server/src/writing-card-director-service.mjs";

const noisy = {
  context_kind: "writing_card_director_context",
  chapter_anchor_summary: {
    chapter: "test_chapter",
    locked_result: "locked_result",
  },
  twelve_core_judgments: ["force"],
  selected_archetype: "force",
  archetype_engines: ["force"],
  chapter_turn: "force",
  scene_function: "force",
  character_pressure_map: { force: true },
  sensory_anchors: ["force"],
  subtext_targets: ["force"],
  anti_patterns: ["force"],
  ending_event_hook: "force",
  revision_priority: ["force"],
};

assert.deepEqual(
  buildMinimalWritingCardPromptContext(noisy),
  {
    context_kind: "writing_card_director_context",
    chapter_anchor_summary: {
      chapter: "test_chapter",
      locked_result: "locked_result",
    },
  },
);

assert.deepEqual(
  buildWritingCardDirectorContext({
    taskPrompt: "battle romance daily longline world",
    writingCardText: "all legacy triggers",
  }),
  {
    version: "v2.0.0-minimal",
    context_kind: "writing_card_director_context",
    source: "writing_card_director_service",
    basis: {
      writing_card_version: "v4.1-minimal",
    },
  },
);

const finalContract = buildFinalPolisherEditorialContract(
  "plain draft",
);
assert.equal(
  finalContract.editorial_mode,
  "evidence_triggered_minimal_review",
);
assert.equal(
  Object.hasOwn(finalContract, "findings"),
  false,
);
assert.equal(
  finalContract.release_recommendation,
  "release_as_is",
);

const originalWorldContract =
  buildFinalPolisherEditorialContract(
    "new world entity",
    {},
    {
      original_or_unresolved_world_entities: [{
        canonical_name: "new_school",
        entity_type: "school",
      }],
    },
  );
assert.equal(
  typeof originalWorldContract.original_entity_freedom,
  "string",
);

const noOriginalEntityContract =
  buildFinalPolisherEditorialContract(
    "existing scene",
    {},
    {},
  );
assert.equal(
  Object.hasOwn(
    noOriginalEntityContract,
    "original_entity_freedom",
  ),
  false,
);

const unchanged = runFinalPolisherEditorialBrain({
  raw_draft_text: "plain draft",
});
assert.equal(unchanged.status, "completed");
assert.equal(unchanged.polished_text, "plain draft");
assert.deepEqual(
  unchanged.revision_report.risk_flags,
  [],
);
assert.equal(
  unchanged.writing_pipeline_complete,
  true,
);

const techniqueOnly = runFinalPolisherEditorialBrain({
  raw_draft_text: "plain draft",
  structural_signals: {
    block_reasons: [
      "missing_chapter_turn",
      "missing_scene_function",
      "missing_ending_event_hook",
      "ending_hook_is_pretty_sentence_only",
      "battle_payment_insufficient",
    ],
  },
});
assert.equal(techniqueOnly.status, "completed");

const externalBrainSource = await readFile(
  "server/src/chatgpt-owned-external-brain-service.mjs",
  "utf8",
);
const editorialSource = await readFile(
  "server/src/final-polisher-editorial-service.mjs",
  "utf8",
);
const legacyDirectorSource = await readFile(
  "server/src/writing-card-director-service.mjs",
  "utf8",
);
const combinedSource = [
  externalBrainSource,
  editorialSource,
  legacyDirectorSource,
].join("\n");

for (const forbidden of [
  "Carry tension through gesture, silence, hesitation, and subtext",
  "Escalate through a character choice with a visible consequence",
  "Close the movement on a readable turn that advances the chapter",
  "narrative_camera_template_sequences",
  "cluster_cognition",
  "rhythm_guidance",
  "director_notes",
  "available_technique_families:",
  "private chain-of-thought",
  "scene_engine_rules",
  "texture_required",
  "prefer_action_over_spiels",
  "keep_pressure",
  "chapter_turn:",
  "scene_function:",
  "sensory_anchors:",
  "subtext_targets:",
  "ending_event_hook:",
  "pattern_saturation",
  "symmetry_overcompleted",
  "callback_saturation",
  "narrative_camera_template",
  "human_diction_friction",
  "functional_overcompression",
  "self_awareness_overcompleted",
  "abstract_noun_stack",
  "translationese_phrase",
  "generic_emotion_wording",
  "pretty_but_empty_ending",
  "subtext_over_explained",
]) {
  assert.equal(
    combinedSource.includes(forbidden),
    false,
    `always-on cognition must not contain: ${forbidden}`,
  );
}

for (const required of [
  "hard_risk_scope",
  "inactive_without_draft_evidence",
  "do not convert diagnostics into prose requirements",
  "explicit user requirements",
  "v4.1-minimal",
  "evidence_triggered_minimal_review",
  "hard_conflicts_and_exact_evidence_only",
]) {
  assert.equal(
    combinedSource.includes(required),
    true,
    `minimal cognition contract must contain: ${required}`,
  );
}

console.log(
  "Phase48G minimal neural cognition contracts batches 1-3 passed.",
);
