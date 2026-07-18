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
  buildStoryMaterialCognitionContract,
} from "../../server/src/neural-module-service.mjs";
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

const materialInput = {
  task_prompt: "續寫受傷後回到學院的下一段生活。",
  writing_context: {
    content: {
      chapter_anchor: {
        current_event: "正式對戰已結束，兩人都帶傷。",
        unresolved_consequence: "九逃仍介意千夜在最後停手。",
      },
    },
    inputs: {
      generation_context: {
        recent_event: "醫護人員要求兩人暫時避免使用受傷的手。",
        focus_characters: ["朝日奈千夜", "九逃"],
        relationship_state: "恢復正常說話，但尚未談完。",
      },
      retrieval_context: {
        pending_scene: "隔天上課前的短暫碰面。",
        injury_state: "包紮仍在，動作受限。",
      },
    },
  },
  capability_input: {
    chapter_title: "換手",
    rule_guard: "不要為了群像硬切視角。",
    draft_excerpt: "她們終於明白，彼此的重量應該共同承擔。",
  },
};

const sceneMaterial = buildStoryMaterialCognitionContract(
  "scene_planner",
  materialInput,
);
assert.equal(
  sceneMaterial.architecture_role,
  "chatgpt_external_brain_story_material",
);
assert.equal(
  sceneMaterial.capability_consumer,
  "ChatGPT",
);
assert.equal(sceneMaterial.guardrails.theme_first_forbidden, true);
assert.equal(
  sceneMaterial.guardrails.chapter_title_must_not_direct_events,
  true,
);
assert.equal(
  sceneMaterial.guardrails.rules_are_guardrails_not_plot_generators,
  true,
);
assert(
  sceneMaterial.grounded_material.some((item) => (
    item.content.includes("正式對戰")
    || item.content.includes("醫護人員")
    || item.content.includes("隔天上課")
  )),
);
assert(
  sceneMaterial.cognition_tasks.includes(
    "flag repeated emotional payment",
  ),
);

const characterMaterial = buildStoryMaterialCognitionContract(
  "character_simulator",
  materialInput,
);
assert(
  characterMaterial.grounded_material.some((item) => (
    item.content.includes("朝日奈千夜")
    || item.content.includes("尚未談完")
  )),
);
assert(
  characterMaterial.cognition_tasks.includes(
    "test whether dialogue is too complete, mature, correct, or thesis-like",
  ),
);

const criticMaterial = buildStoryMaterialCognitionContract(
  "neural_critic",
  materialInput,
);
assert(
  criticMaterial.cognition_tasks.includes(
    "check characters speaking for the author",
  ),
);
assert(
  criticMaterial.cognition_tasks.includes(
    "check premature reconciliation or conflict resolution",
  ),
);

const styleMaterial = buildStoryMaterialCognitionContract(
  "style_drift_detector",
  materialInput,
);
assert(
  styleMaterial.cognition_tasks.includes(
    "check uplifted or meaning-closing endings",
  ),
);
assert(
  styleMaterial.cognition_tasks.includes(
    "run again after draft evidence is available",
  ),
);

const governanceMaterial = buildStoryMaterialCognitionContract(
  "over_governance_detector",
  materialInput,
);
assert(
  governanceMaterial.cognition_tasks.includes(
    "treat rules as error boundaries rather than story generators",
  ),
);

const directorMaterial = buildStoryMaterialCognitionContract(
  "writing_card_director",
  {
    ...materialInput,
    authorship_cognition_sources: {
      prior_cognition_outputs: [
        {
          module_name: "scene_planner",
          result_type: "scene_plan",
          output_hash: "a".repeat(64),
          capability_output: {
            story_material_cognition: sceneMaterial,
          },
        },
        {
          module_name: "character_simulator",
          result_type: "character_simulation",
          output_hash: "b".repeat(64),
          capability_output: {
            story_material_cognition: characterMaterial,
          },
        },
      ],
    },
  },
);
assert.equal(directorMaterial.integrated_prior_cognition.length, 2);
assert.equal(
  directorMaterial.integrated_prior_cognition.every(
    (item) => item.story_material_present === true,
  ),
  true,
);
assert(
  directorMaterial.cognition_tasks.includes(
    "leave final selection, narration, dialogue, and prose to ChatGPT",
  ),
);
assert.equal(
  buildStoryMaterialCognitionContract("final_polisher", materialInput),
  null,
);

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
  "Phase48G minimal governance and external-brain story-material contracts passed.",
);
