import assert from "node:assert/strict";
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
  buildCharacterTurnSimulation,
  characterTurnSimulationVersion,
} from "../../server/src/character-turn-simulation-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

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
      await rm(path.join(directory, name), {
        recursive: true,
        force: true,
      });
    }
  }
}

function assertNoBoundaryLeak(simulation) {
  const known = new Set(simulation.known);
  for (const guessed of simulation.guessed) {
    assert.equal(known.has(guessed), false, "guessed leaked into known");
  }
  const fragment = simulation.next_turn_reaction?.speakable_fragment ?? "";
  for (const withheld of simulation.refuses_to_admit) {
    assert.equal(
      fragment.includes(withheld),
      false,
      "refuses_to_admit leaked into speakable_fragment",
    );
  }
}

const direct = buildCharacterTurnSimulation({
  taskPrompt:
    "甲：「你昨天沒回我。」乙：「忙。」甲：「喔。」只模擬乙的下一回合。",
  writingContext: {
    inputs: {
      generation_context: {
        active_characters: ["甲", "乙"],
        immediate_pressure: "乙察覺甲不高興",
        character_states: {
          乙: {
            current_emotion: "疲憊且心虛",
            body_state: "肩膀僵硬",
            known_facts: ["甲昨天傳過訊息", "自己沒有回覆"],
            assumptions: ["甲可能因未回覆而失望"],
            visible_reactions_allowed: [
              "停頓後移開視線",
              "手指收緊手機",
            ],
            hidden_reactions_reserved: ["其實看見了訊息"],
            continuity_constraints: ["不能突然完整坦白"],
          },
        },
      },
    },
  },
  capabilityInput: {
    character: "乙",
  },
});

assert.equal(direct.simulation_version, characterTurnSimulationVersion);
assert.equal(
  direct.simulation_status,
  "derived_character_specific_next_turn_ready",
);
assert.equal(direct.turn_scope, "single_next_turn_only");
assert.equal(direct.character, "乙");
assert.equal(direct.next_turn_reaction.trigger, "喔。");
assert.equal(
  direct.next_turn_reaction.likely_action,
  "停頓後移開視線",
);
assert.equal(direct.next_turn_reaction.speech_act, "暫不作答");
assert.match(direct.immediate_goal, /停頓後移開視線/u);
assert.match(direct.speech_ceiling, /不得直接說出保留內容/u);
assert.deepEqual(direct.known, ["甲昨天傳過訊息", "自己沒有回覆"]);
assert.deepEqual(direct.guessed, ["甲可能因未回覆而失望"]);
assert(direct.felt.includes("疲憊且心虛"));
assert(direct.felt.includes("身體：肩膀僵硬"));
assert.deepEqual(direct.refuses_to_admit, ["其實看見了訊息"]);
assert.equal(
  direct.simulation_basis.reaction_source,
  "visible_reactions_allowed",
);
assert.equal(
  direct.simulation_basis.no_psychology_inferred_from_canon_identity_facts,
  true,
);
assertNoBoundaryLeak(direct);

const guarded = buildCharacterTurnSimulation({
  taskPrompt: "甲：「你有看到訊息嗎？」只模擬乙的下一回合。",
  writingContext: {
    inputs: {
      generation_context: {
        active_characters: ["甲", "乙"],
      },
    },
  },
  capabilityInput: {
    character: "乙",
    known: ["甲正在等答案"],
    guessed: ["甲可能已經知道真相"],
    refuses_to_admit: ["其實看見了訊息"],
    next_turn_reaction: {
      likely_action: "移開視線",
      speakable_fragment: "其實看見了訊息",
    },
  },
});

assert.equal(guarded.next_turn_reaction.speakable_fragment, undefined);
assert(
  guarded.uncertainty.some((item) => /was removed/iu.test(item)),
);
assertNoBoundaryLeak(guarded);

const insufficient = buildCharacterTurnSimulation({
  writingContext: { inputs: { generation_context: {} } },
  capabilityInput: { character: "乙" },
});
assert.equal(
  insufficient.simulation_status,
  "insufficient_character_specific_input",
);
assert.equal(insufficient.next_turn_reaction.likely_action, null);
assert.equal(
  insufficient.simulation_basis.reaction_source,
  "insufficient_evidence",
);

const explicitCompatibility = buildCharacterTurnSimulation({
  writingContext: {
    inputs: {
      generation_context: { active_characters: ["甲", "乙"] },
    },
  },
  capabilityInput: {
    character: "乙",
    last_utterance: "喔。",
    immediate_goal: "先避開追問",
    speech_ceiling: "最多承認忙，不能說完整原因",
    next_turn_reaction: {
      impulse: "停一下",
      likely_action: "視線移開",
    },
  },
});
assert.equal(
  explicitCompatibility.simulation_status,
  "character_specific_next_turn_ready",
);
assert.equal(
  explicitCompatibility.next_turn_reaction.likely_action,
  "視線移開",
);

const baselines = new Map(await Promise.all(
  cleanupRoots.map(async (root) => [root, await names(root)]),
));

try {
  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt:
      "甲：「你昨天沒回我。」乙：「忙。」甲：「喔。」只模擬乙的下一回合。",
    chapter_mode: "specific_scene",
    generation_context: {
      active_characters: ["甲", "乙"],
      scene_now: "甲說完『喔』之後",
      immediate_pressure: "乙察覺甲不高興",
      character_states: {
        乙: {
          current_emotion: "疲憊且心虛",
          body_state: "肩膀僵硬",
          known_facts: ["甲昨天傳過訊息", "自己沒有回覆"],
          assumptions: ["甲可能因未回覆而失望"],
          visible_reactions_allowed: ["停頓後移開視線"],
          hidden_reactions_reserved: ["其實看見了訊息"],
          continuity_constraints: ["不能突然完整坦白"],
        },
      },
    },
    retrieval_context: {
      unrelated_characters: ["九逃", "貓狼", "雪弟"],
    },
  });
  assert.equal(session.ok, true);

  const scene = await chatgpt_bridge_use_scene_planner({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: {
      active_characters: ["甲", "乙"],
      scene_now: "甲說完『喔』之後",
      immediate_pressure: "乙察覺甲不高興",
      next_natural_turn: "乙先做出一個最小反應",
      do_not_resolve: ["不要完成和解"],
    },
  });
  assert.equal(scene.ok, true);

  const character = await chatgpt_bridge_use_character_simulator({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: {
      character: "乙",
    },
  });
  assert.equal(character.ok, true);
  assert.equal(character.generation_surface.used, true);
  assert.equal(
    character.capability_output.simulation_version,
    characterTurnSimulationVersion,
  );
  assert.equal(
    character.capability_output.simulation_status,
    "derived_character_specific_next_turn_ready",
  );
  assert.equal(
    character.capability_output.next_turn_reaction.likely_action,
    "停頓後移開視線",
  );
  assert.equal(
    character.capability_output.next_turn_reaction.trigger,
    "喔。",
  );
  assertNoBoundaryLeak(character.capability_output);
  const visible = JSON.stringify(character.capability_output);
  for (const forbidden of [
    "story_material_cognition",
    "grounded_material",
    "source_file",
    "source_authority",
    "trace_id",
    "output_hash",
    "九逃",
    "貓狼",
    "雪弟",
  ]) {
    assert.equal(visible.includes(forbidden), false);
  }
  assert(Buffer.byteLength(JSON.stringify(character), "utf8") < 8 * 1024);

  const critic = await chatgpt_bridge_use_neural_critic({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  const style = await chatgpt_bridge_use_style_drift_detector({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  const governance = await chatgpt_bridge_use_over_governance_detector({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assert.equal(critic.ok, true);
  assert.equal(style.ok, true);
  assert.equal(governance.ok, true);

  const director = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assert.equal(director.ok, true);
  const turn = director.capability_output
    .generation_card
    .character_turn_states[0];
  assert.equal(turn.character, "乙");
  assert.equal(turn.turn_scope, "single_next_turn_only");
  assert.equal(turn.next_turn_reaction.likely_action, "停頓後移開視線");
  assert.match(turn.knowledge_boundary, /never promoted/iu);
  assert.match(turn.admission_boundary, /cannot be emitted/iu);
  assert.match(turn.resolution_boundary, /exactly one next turn/iu);
  assert.equal(
    JSON.stringify(director.capability_output).includes("九逃"),
    false,
  );

  console.log(
    "Phase50B character simulator substantive single-turn cognition passed.",
  );
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, baselines.get(root));
  }
}
