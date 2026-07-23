import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_get_current_inputs,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  buildExternalBrainGenerationSurface,
} from "../../server/src/external-brain-generation-surface-service.mjs";

const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];

async function names(directory) {
  try {
  const compatibilitySurface = buildExternalBrainGenerationSurface(
    "writing_card_director",
    {
      result_type: "writing_card_director_context",
      hard_authority: [
        "Canon",
        "causal continuity",
        "character identity and state",
        "timeline",
        "explicit user requirements",
      ],
      arbitration_rule:
        "Use only material hard constraints; do not convert diagnostics into prose requirements.",
      original_entity_freedom: {
        contract: {
          original_entity_creation_allowed: true,
          entity_categories: [
            "character",
            "country",
            "region",
            "city",
            "administrative_area",
            "administrative_agency",
            "official_institution",
            "school",
            "organization",
            "company",
            "faction",
            "facility",
          ],
        },
      },
      character_canon_grounding_loaded: true,
      character_canon_grounding_count: 1,
      character_hard_facts: [{
        canonical_name: "初夢",
        source_authority: "control-plane-only",
        source_file: "data/canon_db/active_engine.md",
        gender: "male",
        pronouns: { third_person: "他", second_person: "你" },
        appearance_facts: ["白髮、紫色與桃色挑染、紫眼"],
      }],
      story_material_cognition: {
        grounded_material: ["control-plane-only"],
      },
    },
  );
  assert.equal(compatibilitySurface.character_canon_grounding_loaded, true);
  assert.equal(compatibilitySurface.character_hard_facts[0].gender, "male");
  assert.match(
    compatibilitySurface.character_hard_facts[0].appearance_facts.join("；"),
    /白髮.*桃色.*紫眼/u,
  );
  assert(
    compatibilitySurface.original_entity_freedom.contract.entity_categories
      .includes("organization"),
  );
  assert.equal(
    JSON.stringify(compatibilitySurface).includes("source_authority"),
    false,
  );
  assert.equal(
    JSON.stringify(compatibilitySurface).includes("source_file"),
    false,
  );
  assert.equal(
    JSON.stringify(compatibilitySurface).includes("grounded_material"),
    false,
  );

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

function assertGenerationSurface(response, moduleName) {
  assert.equal(response.ok, true);
  assert.equal(response.capability_name, `run_${moduleName}`);
  assert.equal(response.generation_surface.used, true);
  assert.equal(response.generation_surface.full_cognition_retained, true);
  assert.equal(
    response.generation_surface.control_plane_excluded_from_capability_output,
    true,
  );
  assert.equal(response.capability_output.generation_surface_only, true);
  assert.equal(
    response.capability_output.generation_surface_version,
    "phase50a-external-brain-generation-surface-v1",
  );
  const visible = JSON.stringify(response.capability_output);
  for (const forbidden of [
    "story_material_cognition",
    "grounded_material",
    "source_cognition_manifest",
    "contract_version",
    "guardrails",
    "output_hash",
    "trace_id",
    "source_file",
    "source_authority",
  ]) {
    assert.equal(
      visible.includes(forbidden),
      false,
      `${moduleName} leaked control-plane field ${forbidden}`,
    );
  }
  assert(
    Buffer.byteLength(JSON.stringify(response), "utf8") < 6 * 1024,
    `${moduleName} response exceeded compact generation-surface limit`,
  );
}

async function persistedRecord(session, moduleName, traceId) {
  return JSON.parse(await readFile(path.join(
    projectPaths.neuralModuleOutputs,
    session.external_brain_session_id,
    session.writing_context_bundle_id,
    moduleName,
    `${traceId}.json`,
  ), "utf8"));
}

const baselines = new Map(await Promise.all(
  cleanupRoots.map(async (root) => [root, await names(root)]),
));
const currentInputsFixtureRoot = path.join(
  projectPaths.outputs,
  `phase50a-current-inputs-${process.pid}-${Date.now()}`,
);

try {
  await mkdir(currentInputsFixtureRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(currentInputsFixtureRoot, "task_prompt.md"),
      `LOCAL_SCENE_ONLY\n${"T".repeat(41_412)}`,
      "utf8",
    ),
    writeFile(
      path.join(currentInputsFixtureRoot, "generation_context.md"),
      `UNRELATED_GENERATION_ARCHIVE\n${"G".repeat(24_759)}`,
      "utf8",
    ),
    writeFile(
      path.join(currentInputsFixtureRoot, "retrieval_context.md"),
      `UNRELATED_VISUAL_ARCHIVE\n${"R".repeat(14_593)}`,
      "utf8",
    ),
  ]);
  const currentInputs = await chatgpt_bridge_get_current_inputs({
    include_text: false,
    include_active_engine_metadata: true,
    include_active_engine_text: false,
  }, { outputs: currentInputsFixtureRoot });
  assert.equal(currentInputs.ok, true);
  assert(currentInputs.result.inputs.task_prompt);
  assert(currentInputs.result.inputs.task_prompt.chars > 41_000);
  assert(currentInputs.result.inputs.generation_context.chars > 24_000);
  assert(currentInputs.result.inputs.retrieval_context.chars > 14_000);
  assert.equal(currentInputs.result.inputs.task_prompt.text, undefined);
  assert.equal(currentInputs.result.inputs.generation_context.text, undefined);
  assert.equal(currentInputs.result.inputs.retrieval_context.text, undefined);
  assert.equal(currentInputs.result.active_engine.text, undefined);
  assert.equal(
    Object.keys(currentInputs).some((key) => (
      key === "chatgpt_final_output"
      || key.startsWith("chatgpt_operator_compact_diagnostics")
    )),
    false,
  );
  assert(
    Buffer.byteLength(JSON.stringify(currentInputs), "utf8") < 8 * 1024,
  );

  const session = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt:
      "甲：『你昨天沒回我。』乙：『忙。』甲：『喔。』只模擬乙的下一回合。",
    chapter_mode: "specific_scene",
    generation_context: {
      active_characters: ["甲", "乙"],
      scene_now: "甲說完『喔』之後",
      immediate_pressure: "乙察覺甲不高興",
      unrelated_archive: {
        competition: "九逃勝負結果",
        medical: "醫療後座與換藥",
        class: "七班沉澱",
      },
    },
    retrieval_context: {
      unrelated_visuals: [
        "御先反轉型態",
        "貓狼視覺資料",
        "雪弟視覺資料",
        "空音視覺資料",
      ],
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
      next_natural_turn: "乙停頓，不立即解釋",
      do_not_resolve: ["不要完成和解"],
    },
  });
  assertGenerationSurface(scene, "scene_planner");
  assert.equal(scene.capability_output.scene_now, "甲說完『喔』之後");
  assert.equal(scene.capability_output.next_natural_turn, "乙停頓，不立即解釋");

  const character = await chatgpt_bridge_use_character_simulator({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
    capability_input: {
      character: "乙",
      active_characters: ["甲", "乙"],
      known: ["甲昨天傳過訊息", "自己沒有回覆"],
      guessed: ["甲可能在意"],
      felt: ["疲憊", "些微心虛"],
      refuses_to_admit: ["其實看見了訊息"],
      immediate_goal: "先避開追問",
      speech_ceiling: "最多承認忙，不能說完整原因",
      last_utterance: "喔。",
      next_turn_reaction: {
        impulse: "停一下",
        likely_action: "視線移開",
      },
      uncertainty: ["之後是否補回覆"],
    },
  });
  assertGenerationSurface(character, "character_simulator");
  assert.equal(character.capability_output.character, "乙");
  assert.equal(
    character.capability_output.simulation_status,
    "character_specific_next_turn_ready",
  );
  assert.deepEqual(character.capability_output.known, [
    "甲昨天傳過訊息",
    "自己沒有回覆",
  ]);
  assert.equal(
    character.capability_output.next_turn_reaction.likely_action,
    "視線移開",
  );

  const critic = await chatgpt_bridge_use_neural_critic({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assertGenerationSurface(critic, "neural_critic");
  assert.equal(
    critic.capability_output.draft_evidence_status,
    "not_available_pre_generation",
  );

  const style = await chatgpt_bridge_use_style_drift_detector({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assertGenerationSurface(style, "style_drift_detector");
  assert.equal(
    style.capability_output.pre_generation_status,
    "inactive_without_draft_evidence",
  );

  const governance = await chatgpt_bridge_use_over_governance_detector({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assertGenerationSurface(governance, "over_governance_detector");

  for (const [moduleName, response] of [
    ["scene_planner", scene],
    ["character_simulator", character],
    ["neural_critic", critic],
    ["style_drift_detector", style],
    ["over_governance_detector", governance],
  ]) {
    const stored = await persistedRecord(
      session,
      moduleName,
      response.trace.trace_id,
    );
    assert.equal(stored.output_hash, response.trace.output_hash);
    if (
      moduleName === "neural_critic"
      || moduleName === "style_drift_detector"
    ) {
      assert.equal(
        stored.capability_output.module_contract,
        undefined,
      );
      assert.equal(
        stored.capability_output.analysis_status,
        "inactive_without_draft_evidence",
      );
    } else {
      assert(stored.capability_output.module_contract);
      assert.equal(
        stored.capability_output.module_contract.module,
        moduleName,
      );
    }
  }

  const storedCharacter = await persistedRecord(
    session,
    "character_simulator",
    character.trace.trace_id,
  );
  const storedCharacterText =
    JSON.stringify(storedCharacter.capability_output);
  assert.equal(
    storedCharacterText.includes("unrelated_visuals"),
    false,
  );
  assert.equal(
    storedCharacterText.includes("forbidden_characters"),
    false,
  );
  assert.equal(
    storedCharacter.capability_output.module_contract.module,
    "character_simulator",
  );

  const director = await chatgpt_bridge_use_writing_card_director({
    external_brain_session_id: session.external_brain_session_id,
    writing_context_bundle_id: session.writing_context_bundle_id,
  });
  assertGenerationSurface(director, "writing_card_director");
  assert.equal(
    director.capability_output.integration_mode,
    "same_author_cognition_synthesis",
  );
  assert.equal(
    director.capability_output.generation_card.character_turn_states[0].character,
    "乙",
  );
  assert.equal(
    director.capability_output.generation_card.next_natural_turn,
    "乙停頓，不立即解釋",
  );
  const directorVisible = JSON.stringify(director.capability_output);
  for (const unrelated of [
    "九逃勝負結果",
    "醫療後座與換藥",
    "七班沉澱",
    "御先反轉型態",
    "貓狼視覺資料",
  ]) {
    assert.equal(directorVisible.includes(unrelated), false);
  }

  console.log(
    "Phase50A context isolation and generation-surface handoff passed.",
  );
} finally {
  await rm(currentInputsFixtureRoot, { recursive: true, force: true });
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, baselines.get(root));
  }
}
