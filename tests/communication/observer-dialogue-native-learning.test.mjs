import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn,
  prepareWorldSimulationTurn, resolveWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const scratch = path.join(projectRoot, "tests", ".tmp");
await mkdir(scratch, {recursive: true});
const fixtureRoot = await mkdtemp(path.join(scratch, "native-dialogue-learning-"));
const actor = "收聽者";
const speaker = "介紹者";
const other = "未聽見的人";
const name = "砂棠計時器";
const emitted = `這台計時器叫「${name}」。`;
const anchors = [
  `${name}最多能倒數五十分鐘。`,
  `${name}能倒數多久？`,
];
const clocks = "2026-11-20T10:30:00+08:00";
const hasLearned = memory => memory?.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion;
const runtime = createWorldSimulationCharacterRuntimeManager({
  identityResolver: async character => ({
    entity_id: character === actor ? "native-listener" : character === speaker ? "native-speaker" : "native-other",
    canonical_name: character, identity_source: "fixture", formal: true,
  }),
});
const options = {fixtureRoot, characterRuntimeManager: runtime, groundDialogueReferents: true, learnDialogueReferents: true};
const room = (id, transcript = null) => ({
  scene_id: id, simulation_time: clocks, dimensions: {width_m: 8, depth_m: 8},
  entity_positions: {[speaker]: {x: 2,y: 2}, [actor]: {x: 3,y: 2}, [other]: {x: 3,y: 3}},
  audibility_profiles: {[actor]: {minimum_audible_db: 35}, [other]: {minimum_audible_db: 1000}},
  observable_by: {[speaker]: {visual: [], audible: []},
    [actor]: {visual: [], audible: transcript ? [transcript] : []}, [other]: {visual: [], audible: []}},
});
const followup = {event_id: "follow", type: "observation", scene_id: "later", participants: [actor,other],
  next_events: [{event_id: "question", type: "observation", scene_id: "question", participants: [actor,other]}]};
const event = {event_id: "introduce", type: "conversation", scene_id: "room", participants: [speaker,actor,other],
  next_events: [{event_id: "hear", type: "continue_conversation", scene_id: "room", participants: [actor,other],
    next_events: [followup]}]};
try {
  const started = await beginWorldSimulationSession({
    simulation_label: "Native speech introducing an unknown object",
    seed: "native-referent-learning",
    rules: {event_driven: true, persistent_causality: true, communication_action_seconds: 0.25},
    initial_world_state: {
      simulation_time: clocks, event_queue: [event],
      scenes: {room: room("room"), later: room("later", anchors[0]), question: room("question", anchors[1])},
      characters: {
        [speaker]: {
          known: [emitted], current_goal: "向值班員介紹計時器",
          relationships: {[actor]: "同事"}, speech_acoustics: {sound_level_db_at_1m: 60},
          communication_goal: {
            character: speaker, purpose: "告知", addressee: actor, mode: "direct",
            public_content: emitted, claim_kind: "sincere_assertion",
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1", semantic_anchor: emitted,
              clause: {subject: "這台計時器", predicate: "叫", object: `「${name}」`},
            },
          },
        },
        [actor]: {
          known: [], current_goal: "弄清楚計時器的用途", relationships: {[speaker]: "同事"},
          memory_retrieval_profile: {enabled: true, model_mode: "cue_dependent_v2"},
          communication_voice_identity_evidence: [{
            observer: actor, source_speaker: speaker, perceived_speaker: speaker, evidence_kind: "familiar_voice",
            identity_status: "identified", active: true,
          }],
        },
        [other]: {known: [], current_goal: "在場等候"},
      },
      memories: {[speaker]: [], [actor]: [], [other]: []}, available_actions: {},
    },
  }, options);
  const sid = started.world_simulation_session_id;
  const input = id => ({world_simulation_session_id: sid, event_id: id});
  const fired = await runWorldSimulationTurn(input("introduce"), {
    ...options, characterBrain: async packet => {
      if (packet.character !== speaker) return "reject_all";
      const candid = packet.candidate_action_intents.find(x => x.communication?.surface_realization_complete);
      assert.ok(candid);
      assert.equal(candid.communication.surface_realization.surface_text, emitted);
      return {action_id: candid.action_id};
    },
  });
  assert.ok(fired.committed);
  assert.equal(((await getWorldSimulationState(sid,options)).state.memories[actor] ?? []).filter(hasLearned).length,0);
  const heard = await prepareWorldSimulationTurn(input("hear"), {
    ...options,
    characterCommunicationListenerInterpretationResolver: async view => {
      assert.equal(view.observer, actor);
      assert.equal(view.speech_candidates.length, 1);
      const [source] = view.speech_candidates;
      assert.equal(source.emitted_surface_signal, emitted);
      return [{speech_candidate_id: source.speech_candidate_id, heard_surface: source.emitted_surface_signal,
        interpreted_content: source.emitted_surface_signal, speech_content_intelligible: true, understanding_attested: true}];
    },
  });
  const listenerPacket = heard.decision_packets.find(x => x.character === actor);
  assert.ok(listenerPacket.perception.audible.some(x => x?.kind === "understood_utterance" && x.semantic_content === emitted));
  assert.ok(!JSON.stringify(heard.decision_packets.find(x => x.character === other)).includes(name));
  assert.ok((await resolveWorldSimulationTurn(heard, {[actor]:"reject_all",[other]:"reject_all"}, options)).committed);
  const [named] = (await getWorldSimulationState(sid,options)).state.memories[actor].filter(hasLearned);
  assert.equal(named.content.referent_name, name);
  assert.equal(named.content.statement_kind, "observed_name");
  assert.equal(named.internal_provenance.dialogue_source_channel, "understood_testimony");
  assert.equal(named.content.lesson, null);
  for (const evt of ["follow", "question"]) {
    const prepared = await prepareWorldSimulationTurn(input(evt), options);
    if (evt === "question") {
      const recovered = prepared.memory_retrieval_processes.find(x => x.observer === actor).result.recovered_memories;
      assert.deepEqual(recovered.map(x => x.content), [anchors[0]]);
    }
    assert.ok((await resolveWorldSimulationTurn(prepared, {[actor]:"reject_all",[other]:"reject_all"}, options)).committed);
  }
  const final = (await getWorldSimulationState(sid,options)).state;
  assert.equal(final.memories[other].filter(hasLearned).length, 0);
  assert.ok(final.memories[actor].filter(hasLearned).every(x => x.content.referent_id === named.content.referent_id));
  console.log("Native learned-object dialogue: emitted → locally understood → learned → later bound detail → recalled; uninformed listener stayed unlearned.");
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
