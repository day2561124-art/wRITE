import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc5-native-loop-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const semantic = "男孩已離開房子";
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-5 Mandarin surface realization native loop",
    seed: "cc5-native-loop",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-21T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc5",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A 向 B 告知一件事",
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-21T00:00:00+08:00",
          dimensions: { width_m: 6, depth_m: 6 },
          entity_positions: {
            A: { x: 2, y: 2 },
            B: { x: 3, y: 2 },
          },
          observable_by: {
            A: { visual: ["B 在房間裡"], audible: [] },
            B: { visual: ["A 在房間裡"], audible: [] },
          },
        },
      },
      characters: {
        A: {
          known: [semantic],
          current_goal: "告知 B",
          relationships: { B: "朋友" },
          communication_goal: {
            character: "A",
            purpose: "告知",
            addressee: "B",
            mode: "direct",
            public_content: semantic,
            claim_kind: "sincere_assertion",
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1",
              semantic_anchor: semantic,
              clause: {
                subject: "男孩",
                predicate: "離開",
                aspect_particle: "了",
                object: "房子",
              },
            },
          },
        },
        B: {
          known: [],
          current_goal: "聽 A 說話",
          relationships: { A: "朋友" },
        },
      },
      memories: { A: [], B: [] },
      available_actions: { A: [], B: [] },
    },
    initial_world_state_summary: {
      current_event: "evt-cc5",
      named_characters: 2,
    },
  }, options);

  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc5_test_identity_resolver",
      formal: true,
    }),
  });

  let selectedActionId = null;
  const result = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc5",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterBrain: async (packet) => {
        if (packet.character !== "A") return "reject_all";
        const candidate = packet.candidate_action_intents.find(
          (item) => item.communication?.schema_version === "cc1-bounded-communication-action-v1",
        );
        assert.ok(candidate, "A must receive a communication action candidate.");
        assert.equal(candidate.communication.surface_realization_complete, true);
        assert.equal(
          candidate.communication.surface_realization.schema_version,
          "cc5-mandarin-clause-realization-v1",
        );
        assert.equal(candidate.communication.surface_realization.surface_text, "男孩離開了房子。");
        assert.equal(candidate.communication.surface_realization.semantic_anchor, semantic);
        assert.equal(
          candidate.communication.surface_realization.boundaries.listener_understanding_inferred,
          false,
        );
        selectedActionId = candidate.action_id;
        return { action_id: candidate.action_id };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.committed, true);
  assert.ok(selectedActionId);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const committedTurn = history.turns.at(-1);
  assert.ok(committedTurn);

  const selected = committedTurn.selected_action_intents.find(
    (item) => item.character === "A",
  );
  assert.equal(selected.action_id, selectedActionId);

  const emitted = committedTurn.action_outcomes.find(
    (outcome) => outcome.actor === "A" && outcome.result === "communication_emitted",
  );
  assert.ok(emitted, "Selected CC-5 communication must reach committed causal history.");

  const event = emitted.communication_event;
  assert.equal(event.schema_version, "cc1-world-communication-event-v1");
  assert.equal(event.semantic_content, semantic);
  assert.equal(event.surface_realization_complete, true);
  assert.equal(event.surface_text, "男孩離開了房子。");
  assert.deepEqual(event.surface_realization, {
    schema_version: "cc5-mandarin-clause-realization-v1",
    language: "zh",
    surface_text: "男孩離開了房子。",
    source_action_id: selectedActionId,
    semantic_anchor: semantic,
    relation: "derived_from_selected_candidate_surface_realization",
  });
  assert.equal(event.private_purpose_exposed, false);
  assert.equal(event.withheld_private_content_exposed, false);
  assert.equal(event.world_truth_claimed, false);

  assert.equal(
    JSON.stringify(event).includes("listener_understanding"),
    false,
    "World event must not claim listener understanding from utterance emission.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-5 native Mandarin realization loop tests passed.");
