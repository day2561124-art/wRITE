import assert from "node:assert/strict";
import {
  buildMinimalWritingCardPromptContext,
  compactPromptPayloadValue,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";

const compacted = compactPromptPayloadValue({
  empty_string: "   ",
  empty_array: [],
  empty_object: {},
  null_value: null,
  undefined_value: undefined,
  false_value: false,
  zero_value: 0,
  nested: {
    empty: [],
    keep: "canon",
  },
  list: [
    null,
    "",
    {},
    [],
    false,
    0,
    "timeline",
  ],
});

assert.deepEqual(compacted, {
  false_value: false,
  zero_value: 0,
  nested: {
    keep: "canon",
  },
  list: [
    false,
    0,
    "timeline",
  ],
});

const minimalDirector = buildMinimalWritingCardPromptContext({
  version: "v1.0.0",
  context_kind: "writing_card_director_context",
  created_at: "2026-07-17T00:00:00.000Z",
  source: "writing_card_director_service",
  basis: {
    writing_card_version: "v4.1-minimal",
  },
  fusion_mode: "mature_creator_fused_into_writing_card",
  scene_engine_rules: {
    battle: {
      require_rules_and_costs: true,
    },
    romance: {
      keep_pressure: true,
    },
  },
  heuristics: {
    combined_text_sample: "internal diagnostic text",
    counts: {
      battle: 0,
      romance: 0,
    },
    predominant_tone: "daily",
    selected_archetype: null,
  },
  input_summary: {
    task_prompt_present: true,
  },
  chapter_anchor_summary: {
    chapter: null,
    required_core_characters: ["夜"],
    forbidden_characters: [],
    locked_result: null,
    anchor_confidence: "high",
    guard_severity: "medium",
  },
  twelve_core_judgments: [],
  archetype_engines: [],
  chapter_turn: null,
  scene_function: "",
  character_pressure_map: {},
  sensory_anchors: [],
  subtext_targets: [],
  anti_patterns: [],
  ending_event_hook: null,
  revision_priority: [],
});

assert.deepEqual(minimalDirector, {
  context_kind: "writing_card_director_context",
  chapter_anchor_summary: {
    required_core_characters: ["夜"],
    anchor_confidence: "high",
    guard_severity: "medium",
  },
});

assert.equal(
  Object.hasOwn(minimalDirector, "scene_engine_rules"),
  false,
);

assert.equal(
  Object.hasOwn(minimalDirector, "heuristics"),
  false,
);

assert.equal(
  Object.hasOwn(minimalDirector, "input_summary"),
  false,
);

assert.equal(
  Object.hasOwn(minimalDirector, "chapter_turn"),
  false,
);

assert.equal(
  Object.hasOwn(minimalDirector, "sensory_anchors"),
  false,
);

const explicitDirector = buildMinimalWritingCardPromptContext({
  context_kind: "writing_card_director_context",
  chapter_anchor_summary: {
    required_core_characters: ["千夜"],
  },
  scene_function: "守住門口直到撤離完成",
  chapter_turn: "撤離路線被切斷",
  ending_event_hook: "門外傳來第二次敲擊",
  sensory_anchors: ["雨聲"],
});

assert.deepEqual(explicitDirector, {
  context_kind: "writing_card_director_context",
  chapter_anchor_summary: {
    required_core_characters: ["千夜"],
  },
  chapter_turn: "撤離路線被切斷",
  scene_function: "守住門口直到撤離完成",
  sensory_anchors: ["雨聲"],
  ending_event_hook: "門外傳來第二次敲擊",
});

console.log(
  "Phase48F minimal prompt payload tests passed.",
);