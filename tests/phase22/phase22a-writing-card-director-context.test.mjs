import assert from "node:assert/strict";

import {
  buildWritingCardDirectorContext,
} from "../../server/src/writing-card-director-service.mjs";

const context = buildWritingCardDirectorContext({
  taskPrompt: "tone: battle",
  writingCardText: "battle scene",
});

for (const removedField of [
  "fusion_mode",
  "twelve_core_judgments",
  "archetype_engines",
  "scene_engine_rules",
  "heuristics",
  "input_summary",
  "chapter_anchor_summary",
  "chapter_turn",
  "scene_function",
  "character_pressure_map",
  "sensory_anchors",
  "subtext_targets",
  "anti_patterns",
  "ending_event_hook",
  "revision_priority",
]) {
  assert.equal(
    Object.hasOwn(context, removedField),
    false,
    `legacy technique field must be absent: ${removedField}`,
  );
}

assert.equal(context.context_kind, "writing_card_director_context");
assert.equal(context.basis.writing_card_version, "v4.1-minimal");

console.log("Writing card director context minimal surface test passed.");