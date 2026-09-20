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
  `cc1-native-loop-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const basis = "B 正在看的書尚未看完";
const privatePurpose = "希望 B 留下";
const privateContent = "我很依戀 B";

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-1 native communication loop",
    seed: "cc1-native-loop",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-20T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc1",
        type: "friend_departure",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "B 準備離開",
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-20T00:00:00+08:00",
          dimensions: { width_m: 6, depth_m: 6 },
          entity_positions: {
            A: { x: 2, y: 2 },
            B: { x: 3, y: 2 },
          },
          observable_by: {
            A: { visual: ["B 正準備離開"], audible: [] },
            B: { visual: ["A 還在房間裡"], audible: [] },
          },
        },
      },
      characters: {
        A: {
          known: [basis],
          current_goal: "和 B 繼續相處",
          relationships: { B: "朋友" },
          communication_goal: {
            character: "A",
            purpose: privatePurpose,
            addressee: "B",
            mode: "indirect",
            private_content: privateContent,
            withhold_private_content: true,
            basis_claim: basis,
          },
        },
        B: {
          known: ["自己準備離開"],
          current_goal: "離開房間",
          relationships: { A: "朋友" },
        },
      },
      memories: { A: [], B: [] },
      available_actions: {
        A: Array.from({ length: 24 }, (_, index) => ({
          action_id: `a-existing-${index + 1}`,
          intent: `既有候選 ${index + 1}`,
        })),
        B: [],
      },
    },
    initial_world_state_summary: {
      current_event: "evt-cc1",
      named_characters: 2,
    },
  }, options);

  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc1_test_identity_resolver",
      formal: true,
    }),
  });

  let aCandidateId = null;
  let bPacketText = null;
  const result = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc1",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterBrain: async (packet) => {
        if (packet.character === "A") {
          assert.equal(packet.communication_foundation.mode, "indirect");
          assert.equal(packet.communication_foundation.purpose, privatePurpose);
          assert.equal(packet.communication_foundation.withheld_private_content, privateContent);
          const candidate = packet.candidate_action_intents.find(
            (item) => item.communication?.schema_version === "cc1-bounded-communication-action-v1",
          );
          assert.ok(candidate, "A must receive a bounded communication action candidate.");
          assert.equal(candidate.communication.addressee, "B");
          assert.equal(candidate.communication.message.semantic_content, basis);
          assert.equal(candidate.communication.message.epistemic_status, "character_known");
          const candidateText = JSON.stringify(candidate);
          assert.equal(candidateText.includes(privatePurpose), false);
          assert.equal(candidateText.includes(privateContent), false);
          assert.equal(candidateText.includes("cognition.known"), false);
          aCandidateId = candidate.action_id;
          return { action_id: candidate.action_id };
        }
        bPacketText = JSON.stringify(packet);
        assert.equal(Object.hasOwn(packet, "communication_foundation"), false);
        assert.equal(bPacketText.includes(privatePurpose), false);
        assert.equal(bPacketText.includes(privateContent), false);
        return "reject_all";
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.committed, true);
  assert.ok(aCandidateId);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(history.turns.length, 1);
  const committedTurn = history.turns[0];
  const selectedA = committedTurn.selected_action_intents.find(
    (item) => item.character === "A",
  );
  assert.equal(selectedA.action_id, aCandidateId);
  const selectedText = JSON.stringify(selectedA);
  assert.equal(selectedText.includes(privatePurpose), false);
  assert.equal(selectedText.includes(privateContent), false);

  const emitted = committedTurn.action_outcomes.find(
    (outcome) => outcome.actor === "A" && outcome.result === "communication_emitted",
  );
  assert.ok(emitted, "Selected communication must reach committed causal history.");
  assert.equal(emitted.character_experience.performed, true);
  assert.equal(emitted.communication_event.schema_version, "cc1-world-communication-event-v1");
  assert.equal(selectedA.candidate.communication.ir.schema_version, "character-communication-ir-v1");
  assert.deepEqual(emitted.communication_event.public_ir_lineage, {
    source_action_id: selectedA.action_id,
    source_ir_schema_version: selectedA.candidate.communication.ir.schema_version,
    source_projection: "public_only",
    relation: "derived_from_selected_communication_ir",
  });
  assert.equal(Object.hasOwn(emitted.communication_event, "communication_ir"), false,
    "World must link rather than copy speaker-authored IR.");
  assert.equal(emitted.communication_event.addressee, "B");
  assert.equal(emitted.communication_event.channel, "speech");
  assert.equal(emitted.communication_event.expression_mode, "indirect");
  assert.equal(emitted.communication_event.semantic_content, basis);
  assert.equal(emitted.communication_event.epistemic_status, "character_known");
  assert.equal(emitted.communication_event.surface_realization_complete, false);
  assert.equal(emitted.communication_event.private_purpose_exposed, false);
  assert.equal(emitted.communication_event.withheld_private_content_exposed, false);
  assert.equal(emitted.communication_event.world_truth_claimed, false);
  const emittedText = JSON.stringify(emitted.communication_event);
  assert.equal(emittedText.includes(privatePurpose), false);
  assert.equal(emittedText.includes(privateContent), false);
  assert.equal(emittedText.includes("cognition.known"), false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-1 native communication loop tests passed.");
