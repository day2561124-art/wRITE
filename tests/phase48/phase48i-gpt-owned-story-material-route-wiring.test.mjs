import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  externalBrainPreGenerationCapabilities,
  shouldEnableStoryMaterialCognition,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  buildStoryMaterialCognitionContract,
} from "../../server/src/neural-module-service.mjs";

const expectedPreGenerationCapabilities = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
];

assert.deepEqual(
  [...externalBrainPreGenerationCapabilities],
  expectedPreGenerationCapabilities,
);

for (const capabilityName of expectedPreGenerationCapabilities) {
  assert.equal(
    shouldEnableStoryMaterialCognition(capabilityName),
    true,
    `${capabilityName} must enable story-material cognition on the formal default-adapter route`,
  );

  assert.equal(
    shouldEnableStoryMaterialCognition(capabilityName, {
      adapter: async () => ({}),
    }),
    false,
    `${capabilityName} custom-adapter compatibility route must preserve its exact output by default`,
  );

  assert.equal(
    shouldEnableStoryMaterialCognition(capabilityName, {
      adapter: async () => ({}),
      story_material_cognition_output: true,
    }),
    true,
    `${capabilityName} custom adapter must support explicit story-material opt-in`,
  );

  assert.equal(
    shouldEnableStoryMaterialCognition(capabilityName, {
      story_material_cognition_output: false,
    }),
    false,
    `${capabilityName} must support explicit story-material opt-out`,
  );
}

assert.equal(
  shouldEnableStoryMaterialCognition("run_final_polisher"),
  false,
);

const externalBrainSource = await readFile(
  "server/src/chatgpt-owned-external-brain-service.mjs",
  "utf8",
);
const neuralModuleSource = await readFile(
  "server/src/neural-module-service.mjs",
  "utf8",
);

const formalRouteLine =
  "story_material_cognition_output: shouldEnableStoryMaterialCognition(capabilityName, options),";

assert.equal(
  externalBrainSource.split(formalRouteLine).length - 1,
  1,
  "the formal GPT-owned story-material route must be wired exactly once",
);

assert.match(
  neuralModuleSource,
  /options\.story_material_cognition_output\s*!==\s*true/u,
  "story-material cognition must remain an independent neural-module opt-in",
);

assert.match(
  neuralModuleSource,
  /moduleName\s*===\s*"final_polisher"/u,
  "Final Polisher must remain outside pre-generation story-material attachment",
);

const sampleInput = {
  task_prompt:
    "正式續寫下一章；讓角色經歷事件，不替角色的人生整理意義。",
  writing_context: {
    content: {
      chapter_anchor: {
        current_event: "上一事件已留下具體後果。",
        unresolved_consequence: "角色仍有話沒有說完。",
      },
    },
  },
};

for (const capabilityName of expectedPreGenerationCapabilities) {
  const moduleName = capabilityName.slice(4);
  const contract = buildStoryMaterialCognitionContract(
    moduleName,
    sampleInput,
  );

  assert(contract, `${moduleName} must expose story-material cognition`);
  assert.equal(contract.capability_consumer, "ChatGPT");
  assert.equal(
    contract.guardrails.final_story_judgment_owner,
    "ChatGPT",
  );
}

assert.equal(
  buildStoryMaterialCognitionContract("final_polisher", sampleInput),
  null,
);

console.log(
  "Phase48I GPT-owned story-material compatible formal route wiring passed.",
);