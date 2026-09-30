import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const statement = "男孩已離開房子";
const spoken = "男孩離開了房子。";
async function runScenario({ label, bFacing, bHasCue }) {
const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8p-${label}-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8P multimodal subjective social lifecycle",
    seed: "cc8p-multimodal-social",
    rules: { event_driven: true, persistent_causality: true,
      communication_action_seconds: 0.25 },
    initial_world_state: {
      simulation_time: "2026-09-22T00:00:00+08:00",
      event_queue: [{
        event_id: "speak", type: "conversation", scene_id: "room",
        participants: ["A", "B"], summary: "A speaks with B while C and D are nearby",
        next_events: [{
          event_id: "hear", type: "continue_conversation", scene_id: "room",
          participants: ["B", "C", "D"], summary: "Listeners form distinct impressions",
          next_events: [{
            event_id: "later", type: "continue_conversation", scene_id: "room",
            participants: ["B", "C", "D"], summary: "Listeners decide with their own histories",
          }],
        }],
      }],
      scenes: { room: {
        scene_id: "room", simulation_time: "2026-09-22T00:00:00+08:00",
        dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: {
          A: { x: 2, y: 2 }, B: { x: 3, y: 2 },
          C: { x: 3, y: 3 }, D: { x: 7, y: 7 },
        },
        entity_visual_detail_profiles: {
          A: { head_orientation_discernible: true, head_orientation_max_distance_m: 6 },
        },
        audibility_profiles: {
          B: { minimum_audible_db: 35 },
          C: { minimum_audible_db: 35 },
          D: { minimum_audible_db: 1000 },
        },
        observable_by: Object.fromEntries(["A", "B", "C", "D"]
          .map((name) => [name, { visual: [], audible: [] }])),
      } },
      characters: {
        A: {
          known: [statement], current_goal: "告知 B",
          facing_degrees: 90, physical_state: {},
          relationships: { B: "熟人", C: "熟人", D: "熟人" },
          speech_acoustics: { sound_level_db_at_1m: 60 },
          communication_goal: {
            character: "A", purpose: "告知", addressee: "B",
            mode: "direct", public_content: statement,
            claim_kind: "sincere_assertion",
            communication_context: { intentional_display: {
              modality: "gaze", target: "B",
              intended_meaning: "私人希望 B 注意這次分享",
            } },
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1",
              semantic_anchor: statement,
              clause: { subject: "男孩", predicate: "離開",
                aspect_particle: "了", object: "房子" },
            },
          },
        },
        ...Object.fromEntries(["B", "C", "D"].map((name) => [name, {
          known: [], current_goal: "自行判斷如何回應 A",
          facing_degrees: name === "B" ? bFacing : 0,
          horizontal_fov_degrees: 90, physical_state: {},
          relationships: { A: "熟人" },
          communication_voice_identity_evidence: [{
            observer: name, source_speaker: "A", perceived_speaker: "A",
            evidence_kind: "familiar_voice", identity_status: "identified",
            active: true,
          }],
        }])),
      },
      memories: { A: [], B: [], C: [], D: [] },
      available_actions: {
        A: [],
        ...Object.fromEntries(["B", "C"].map((name) => [name, [
          { action_id: "approach-A", intent: "主動靠近 A" },
          { action_id: "distance-A", intent: "與 A 保持距離" },
        ]])),
        D: [],
      },
    },
  }, options);
  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (name) => ({
      entity_id: `character_${name.toLowerCase()}`,
      canonical_name: name, identity_source: "c4_divergent_test",
      formal: true,
    }),
  });
  const sid = session.world_simulation_session_id;
  const first = await runWorldSimulationTurn({
    world_simulation_session_id: sid, event_id: "speak",
  }, { ...options, characterRuntimeManager: runtimeManager,
    characterBrain: async (packet) => {
      if (packet.character !== "A") return "reject_all";
      const candidate = packet.candidate_action_intents.find(
        (item) => item.communication?.surface_realization_complete === true);
      assert.ok(candidate);
      return { action_id: candidate.action_id };
    },
  });
  assert.equal(first.committed, true);
  const firstHistory = await getWorldSimulationHistory(sid, options);
  const communication = firstHistory.turns[0].action_outcomes.find(
    (item) => item.result === "communication_emitted");
  assert.ok(communication);
  assert.equal(communication.communication_event.embodied_display.realized, true);
  const privateActionId = communication.action_id;

  const cueAccess = new Map();
  const saw = new Map();
  const second = await runWorldSimulationTurn({
    world_simulation_session_id: sid, event_id: "hear",
  }, {
    ...options, characterRuntimeManager: runtimeManager,
    characterCommunicationListenerInterpretationResolver: async (view) => {
      if (view.observer === "D") {
        assert.equal(view.speech_candidates.length, 0);
        return [];
      }
      assert.equal(view.speech_candidates.length, 1);
      const candidate = view.speech_candidates[0];
      assert.equal(candidate.emitted_surface_signal, spoken);
      const hasCue = candidate.coexpressed_visual_cues.length > 0;
      cueAccess.set(view.observer, hasCue);
      assert.equal(hasCue, view.observer === "B" && bHasCue);
      assert.equal(candidate.visual_coexpression_relation,
        hasCue ? "same_committed_action" : null);
      assert.equal(candidate.visual_coexpression_intent_inferred, false);
      assert.equal(JSON.stringify(view).includes(privateActionId), false);
      assert.equal(JSON.stringify(view).includes("私人希望 B 注意這次分享"), false);
      return [{
        speech_candidate_id: view.speech_candidates[0].speech_candidate_id,
        heard_surface: spoken, interpreted_content: statement,
        // This fixture resolver authors a defeasible interpretation from its own
        // bounded cue access. Production does not map gaze directly to valence.
        interpreted_interaction_function: hasCue
          ? "subjectively_directed_informing" : "subjectively_ambiguous_informing",
        speech_content_intelligible: true, understanding_attested: true,
      }];
    },
    listenerSocialInterpretationResolver: async (view) => {
      if (view.observer === "D") {
        assert.equal(view.candidates.length, 0);
        return [];
      }
      assert.equal(view.candidates.length, 1);
      return [{
        evidence_ref: view.candidates[0].evidence_ref,
        interpretation_kind: view.candidates[0].interpreted_interaction_function
          === "subjectively_directed_informing" ? "affiliative" : "adverse",
        social_meaning: view.candidates[0].interpreted_interaction_function
          === "subjectively_directed_informing"
          ? "聽者將這次發話解讀為友善" : "聽者將這次發話解讀為挖苦",
      }];
    },
    personTargetedSocialAppraisalResolver: async (view) => {
      if (view.observer === "D") {
        assert.equal(view.candidates.length, 0);
        return [];
      }
      assert.equal(view.candidates.length, 1);
      return [{
        evidence_ref: view.candidates[0].evidence_ref,
        appraisal_kind: view.candidates[0].interpreted_social_meaning
          === "聽者將這次發話解讀為友善" ? "affiliative" : "adverse",
        concern: "與 A 後續如何相處",
        expectedness: "uncertain", significance: "meaningful",
        interpretation: view.candidates[0].interpreted_social_meaning,
      }];
    },
    characterBrain: async (packet) => {
      saw.set(packet.character, packet.perception.social_appraisals ?? []);
      const matchingPaths = [];
      const inspect = (value, trail = []) => {
        if (typeof value === "string" && value.includes(privateActionId))
          matchingPaths.push(trail.join("."));
        if (value && typeof value === "object") {
          for (const [key, child] of Object.entries(value)) {
            // Sealed CC-6D explicitly permits the source locator only inside
            // the listener-private CC-2 testimony receipt. Preserve that
            // contract while rejecting it everywhere else in the packet.
            if (key === "source_action_id" && child === privateActionId
                && value.schema_version === "cc2-listener-understood-utterance-v1"
                && value.kind === "understood_utterance"
                && value.observer === packet.character
                && value.attribution_subjective === true
                && value.world_truth_claimed === false)
              continue;
            inspect(child, [...trail, key]);
          }
        }
      };
      inspect(packet);
      assert.deepEqual(matchingPaths, [], "source action ID locations: " + matchingPaths.join(", "));
      assert.equal(JSON.stringify(packet).includes("私人希望 B 注意這次分享"), false);
      assert.equal(packet.cognition.relationship_cognition.A, "熟人");
      return "reject_all";
    },
  });
  assert.equal(second.committed, true);
  assert.deepEqual([...saw.keys()].sort(), ["B", "C", "D"]);
  assert.deepEqual(["B", "C", "D"].map((name) => saw.get(name).length),
    [1, 1, 0]);
  const stateAtT1 = (await getWorldSimulationState(sid, options)).state;
  assert.deepEqual(stateAtT1.characters.B.relationships.A.social_evidence
    .map((item) => item.appraisal_kind), [bHasCue ? "affiliative" : "adverse"]);
  assert.deepEqual(stateAtT1.characters.C.relationships.A.social_evidence
    .map((item) => item.appraisal_kind), ["adverse"]);
  assert.equal(stateAtT1.characters.D.relationships.A, "熟人");
  assert.equal(stateAtT1.characters.A.relationships.B, "熟人");

  assert.deepEqual(Object.fromEntries(cueAccess), { B: bHasCue, C: false });
  for (const name of ["B", "C"]) {
    const memories = stateAtT1.memories[name].filter(
      (item) => item.memory_type === "episodic_social_experience");
    assert.equal(memories.length, 1);
    assert.equal(memories[0].subjective_memory_not_world_truth, true);
    assert.equal(memories[0].content.world_truth_claimed, false);
    assert.equal(memories[0].content.target_identity_verified, false);
    assert.equal(memories[0].content.appraisal_kind,
      name === "B" && bHasCue ? "affiliative" : "adverse");
    assert.equal(JSON.stringify(memories[0].content).includes(privateActionId), false);
  }
  assert.equal(stateAtT1.memories.D.filter(
    (item) => item.memory_type === "episodic_social_experience").length, 0);

  const decisions = new Map();
  const third = await runWorldSimulationTurn({
    world_simulation_session_id: sid, event_id: "later",
  }, { ...options, characterRuntimeManager: runtimeManager,
    characterBrain: async (packet) => {
      const relationship = packet.cognition.relationship_cognition.A;
      if (packet.character === "D") {
        assert.equal(relationship, "熟人");
        decisions.set("D", "reject_all");
        return "reject_all";
      }
      const evidence = relationship.social_evidence;
      assert.equal(evidence.length, 1);
      const expected = packet.character === "B" && bHasCue ? "affiliative" : "adverse";
      assert.equal(evidence[0].appraisal_kind, expected);
      assert.equal(JSON.stringify(relationship).includes("social_appraisal_hash"), false);
      // Later character choice reads its admitted relationship evidence.
      const actionId = evidence[0].appraisal_kind === "affiliative"
        ? "approach-A" : "distance-A";
      assert.ok(packet.candidate_action_intents.some((item) => item.action_id === actionId));
      decisions.set(packet.character, actionId);
      return { action_id: actionId };
    },
  });
  assert.equal(third.committed, true);
  assert.deepEqual(Object.fromEntries(decisions),
    { B: bHasCue ? "approach-A" : "distance-A", C: "distance-A", D: "reject_all" });
  const history = await getWorldSimulationHistory(sid, options);
  assert.equal(history.turns.length, 3);
  const final = (await getWorldSimulationState(sid, options)).state;
  assert.equal(final.characters.D.relationships.A, "熟人");
  assert.equal(final.characters.B.relationships.A.social_evidence.length, 1);
  assert.equal(final.characters.C.relationships.A.social_evidence.length, 1);
  return Object.fromEntries(decisions);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
}
// Only B facing changes: speech, source action plan, auditory configuration,
// other observers and subjective resolver rules remain identical.
const visible = await runScenario({ label: "visible", bFacing: 180, bHasCue: true });
const turnedAway = await runScenario({ label: "turned-away", bFacing: 0, bHasCue: false });
assert.notEqual(visible.B, turnedAway.B);
assert.equal(visible.C, turnedAway.C);
assert.equal(visible.D, turnedAway.D);
console.log("CC-8P multimodal subjective social lifecycle tests passed.");
