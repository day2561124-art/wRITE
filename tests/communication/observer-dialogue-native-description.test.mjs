import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { observerDialogueLearningVersion } from "../../server/src/observer-dialogue-learning-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager, replayWorldSimulationCommittedCharacterExperiences, runWorldSimulationTurn,
  scheduleWorldSimulationAutonomousCognitionOpportunities,
  dispatchWorldSimulationAutonomousCognitionOpportunities,
} from "../../server/src/world-simulation-loop-service.mjs";
import { nativeGoalDecisionViewVersion } from "../../server/src/world-simulation-motivation-goal-integration-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const actor = "收聽者";
const speaker = "提問者";
const other = "未聽見的人";
const firstFact = "它最多能倒數九十分鐘。";
const secondFact = "它最多能倒數四十分鐘。";
const question = "白色計時器能倒數多久？";
const prompt = "你指的是哪一件？";
const shortReply = "架上那台。";
async function run(scenario) {
  const temp = path.join(projectRoot, "tests", ".tmp");
  await mkdir(temp, {recursive: true});
  const fixtureRoot = await mkdtemp(path.join(temp, "native-description-clarification-"));
  const answers = {
    recalled_speech: "我記得最多能倒數四十分鐘。",
    heard_speech: "我記得有人說最多能倒數四十分鐘。",
    panel_speech: "我看了一下面板，最多能倒數50分鐘。",
    historical_panel_speech: "我看了一下面板，最多能倒數50分鐘。",
    unencoded_panel_speech: "我看了一下面板，最多能倒數50分鐘。",
    far_panel_speech: "我記得最多能倒數四十分鐘。",
    conflict_speech: "我不確定，得再查一下。",
  };
  assert.ok(["short_reply", "repeat_reply", "full_question", "wrong_recipient", "not_selected", "not_heard"].includes(scenario)
    || Object.hasOwn(answers, scenario));
  const expectedSpeech = answers[scenario];
  const historical = ["historical_panel_speech", "unencoded_panel_speech"].includes(scenario);
  const encodedPanel = ["panel_speech", "historical_panel_speech"].includes(scenario);
  const panelVisible = encodedPanel || scenario === "unencoded_panel_speech";
  const panelContent = "面板顯示最多能倒數50分鐘。";
  const historicalLesson = "我當時看到面板顯示最多能倒數50分鐘。";
  const conflict = scenario === "conflict_speech";
  const repeatQuestion = scenario === "full_question";
  const selectsClarification = scenario !== "not_selected";
  const shouldRecover = !conflict && (Boolean(expectedSpeech) || ["short_reply", "repeat_reply", "full_question"].includes(scenario));
  const replyCandidate = buildCharacterCommunicationActionCandidate({character: speaker, cognition: {
    communication_goal: {character: speaker, addressee: scenario === "wrong_recipient" ? other : actor,
      purpose: "指明問的是哪台", mode: "direct", public_content: shortReply,
      surface_realization: {semantic_anchor: shortReply, clause: {omit_subject: true, predicate: "架上那台"}}},
  }});
  const time = "2026-11-20T10:30:00+08:00";
  const runtime = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async character => ({
      entity_id: character === actor ? "description-listener" : character === speaker ? "description-speaker" : "description-other",
      canonical_name: character, identity_source: "fixture", formal: true,
    }),
  });
  const options = {fixtureRoot, characterRuntimeManager: runtime, groundDialogueReferents: true, learnDialogueReferents: true};
  const all = [actor, speaker, other];
  const room = (id, visual = null, audible = null) => ({
    scene_id: id, simulation_time: time, dimensions: {width_m: 8, depth_m: 8},
    entity_positions: {[speaker]: {x: 2,y: 2}, [actor]: {x: 3,y: 2}, [other]: {x: 3,y: 3}},
    audibility_profiles: {[actor]: {minimum_audible_db: 35}, [speaker]: {minimum_audible_db: 35},
      [other]: {minimum_audible_db: 1000}},
    observable_by: {[speaker]: {visual: [], audible: []},
      [actor]: {visual: visual ? [visual] : [], audible: audible ? [audible] : []},
      [other]: {visual: [], audible: []}},
  });
  const evt = (event_id, scene_id, participants, next_events = [], type = "observation") =>
    ({event_id, scene_id, participants, next_events, type});
  const exchange = (suffix, next = []) => {
    const scene = historical && suffix ? "away" : "room";
    const answer = evt("answer" + suffix, repeatQuestion ? "answer" : scene, [actor,other], next);
    const reply = evt("reply" + suffix, scene, [speaker,other], [answer], "continue_conversation");
    const clarify = evt("clarify" + suffix, scene, [actor,other], [repeatQuestion ? answer : reply], "continue_conversation");
    return evt("ask" + suffix, scene, all, [clarify], "conversation");
  };
  const repeat = scenario === "repeat_reply";
  const firstExchange = exchange("", repeat || historical ? [exchange("-again")] : []);
  const observe2 = evt("observe2", "shelf", [actor,other],
    [conflict ? evt("conflict", "conflict", [actor,other], [firstExchange]) : firstExchange]);
  const observe1 = evt("observe1", "desk", [actor,other], [observe2]);

  try {
    const started = await beginWorldSimulationSession({
      simulation_label: "Native ambiguity clarification", seed: "descriptor-native-clarification",
      rules: {event_driven: true, persistent_causality: true, communication_action_seconds: 0.25},
      initial_world_state: {
        simulation_time: time, event_queue: [observe1],
        scenes: {room: room("room"), away: room("away"), desk: room("desk", "桌上有一台白色計時器。" + firstFact),
          shelf: scenario === "heard_speech" ? room("shelf", null, "架上有一台白色計時器。" + secondFact)
            : room("shelf", "架上有一台白色計時器。" + secondFact),
          conflict: room("conflict", null, "架上那台白色計時器最多能倒數六十分鐘。"),
          answer: room("answer", null, "架上那台白色計時器能倒數多久？")},
        objects: panelVisible || scenario === "far_panel_speech" ? {
          shelf_timer_internal: {scene_id: "room", position: {x: panelVisible ? 4 : 6, y: 2},
            visual_label: "架上那台白色計時器", public_runtime_display: {kind: "countdown_limit_panel", max_countdown_seconds: 3000}},
          other_timer_internal: {scene_id: "elsewhere", position: {x: 4, y: 2},
            visual_label: "架上那台白色計時器", public_runtime_display: {kind: "countdown_limit_panel", max_countdown_seconds: 777}},
        } : {},
        characters: {
          [actor]: {
            current_goal: "弄清楚提問所指的計時器",
            speech_acoustics: {sound_level_db_at_1m: 60},
            memory_retrieval_profile: {enabled: true, model_mode: "cue_dependent_v2"},
            communication_voice_identity_evidence: [{
              observer: actor, source_speaker: speaker, perceived_speaker: speaker, evidence_kind: "familiar_voice",
              identity_status: "identified", active: true,
            }],
          },
          [speaker]: {
            current_goal: "問倒數時間", speech_acoustics: {sound_level_db_at_1m: 60},
            communication_goal: {character: speaker, addressee: actor, purpose: "詢問倒數時間", mode: "direct",
              public_content: question, surface_realization: {semantic_anchor: question,
                clause: {subject: "白色計時器", predicate: "能倒數", object: "多久", punctuation: "？"}}},
          },
          [other]: {current_goal: "在場等候"},
        },
        memories: Object.fromEntries(all.map(character => [character, []])),
        available_actions: {[speaker]: [replyCandidate]},
      },
    }, options);
    const sid = started.world_simulation_session_id;
    const input = event_id => ({world_simulation_session_id: sid, event_id});
    const learned = state => state.memories[actor]
      .filter(memory => memory.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion);
    for (const id of ["observe1", "observe2", ...(conflict ? ["conflict"] : [])]) {
      assert.ok((await runWorldSimulationTurn(input(id), {...options, characterBrain: async () => "reject_all"})).committed);
    }
    const before = learned((await getWorldSimulationState(sid, options)).state);
    assert.equal(before.length, conflict ? 3 : 2);
    assert.equal(before[1].source.sense, scenario === "heard_speech" ? "auditory" : "visual");
    assert.notEqual(before[0].content.referent_id, before[1].content.referent_id);
    async function runExchange(suffix) {
      const previousReading = historical && Boolean(suffix);
      const wantedSpeech = previousReading
        ? encodedPanel ? "我上次看面板時，上限是50分鐘。" : answers.recalled_speech
        : expectedSpeech;
      const quoteCurrent = scenario !== "historical_panel_speech" || previousReading;
      assert.ok((await runWorldSimulationTurn(input("ask" + suffix), {...options, characterBrain: async packet => {
        if (packet.character !== speaker) return "reject_all";
        const candidate = packet.candidate_action_intents.find(row => row.communication?.surface_realization?.surface_text === question);
        assert.ok(candidate);
        return {action_id: candidate.action_id};
      }})).committed);
      assert.ok((await runWorldSimulationTurn(input("clarify" + suffix), {
        ...options,
        characterCommunicationListenerInterpretationResolver: async ({observer, speech_candidates}) => {
          assert.equal(observer, actor);
          assert.equal(speech_candidates.length, 1);
          const [speech] = speech_candidates;
          assert.equal(speech.emitted_surface_signal, question);
          return [{speech_candidate_id: speech.speech_candidate_id, heard_surface: question, interpreted_content: question,
            speech_content_intelligible: true, understanding_attested: true}];
        },
        characterBrain: async packet => {
          if (packet.character === other) {
            assert.equal(packet.cognition.dialogue_clarification, undefined);
            assert.ok(!JSON.stringify(packet).includes(question));
            return "reject_all";
          }
          assert.equal(packet.character, actor);
          assert.equal(packet.cognition.dialogue_clarification?.speaker, speaker);
          assert.equal(packet.cognition.dialogue_clarification?.reason, "multiple_matching_objects");
          assert.equal(packet.retrieval_experience.recovered_any_content, false);
          assert.ok(!JSON.stringify(packet.cognition.working_context).includes(firstFact));
          const candidate = packet.candidate_action_intents.find(row => row.communication?.surface_realization?.surface_text === prompt);
          assert.ok(candidate, "Clarification should be a real selectable speech action");
          return selectsClarification ? {action_id: candidate.action_id} : "reject_all";
        },
      })).committed);
      const history = await getWorldSimulationHistory(sid, options);
      const committedAsk = history.turns.at(-1);
      const clarification = committedAsk.action_outcomes.find(row => row.actor === actor && row.result === "communication_emitted");
      assert.equal(committedAsk.dialogue_clarification_requests?.length ?? 0, Number(selectsClarification));
      if (selectsClarification) {
        assert.equal(clarification.communication_event.surface_text, prompt);
        assert.equal(clarification.communication_event.addressee, speaker);
        assert.equal(committedAsk.dialogue_clarification_requests[0].action_id, clarification.action_id);
      } else assert.equal(clarification, undefined);
      const interpret = ({observer, speech_candidates}, intendedObserver, intendedText, attest) =>
        observer === intendedObserver && attest ? speech_candidates
          .filter(item => item.emitted_surface_signal === intendedText)
          .map(item => ({speech_candidate_id: item.speech_candidate_id, heard_surface: intendedText,
            interpreted_content: intendedText, speech_content_intelligible: true, understanding_attested: true}))
          : [];
      if (!repeatQuestion) {
        let heardPrompt = false;
        assert.ok((await runWorldSimulationTurn(input("reply" + suffix), {
          ...options,
          characterCommunicationListenerInterpretationResolver: async view => {
            heardPrompt ||= view.observer === speaker && view.speech_candidates.some(item => item.emitted_surface_signal === prompt);
            return interpret(view, speaker, prompt, scenario !== "not_heard");
          },
          characterBrain: async packet => packet.character === speaker ? {action_id: replyCandidate.action_id} : "reject_all",
        })).committed);
        assert.equal(heardPrompt, selectsClarification);
        const afterReply = (await getWorldSimulationHistory(sid, options)).turns.at(-1);
        assert.ok(afterReply.action_outcomes.some(row => row.actor === speaker && row.result === "communication_emitted"
          && row.communication_event.surface_text === shortReply));
        if (["short_reply", "recalled_speech"].includes(scenario) || (repeat && suffix === "")) {
          await runtime.releaseWorldLineage(sid, options);
          assert.ok((await replayWorldSimulationCommittedCharacterExperiences(sid, options)).ok);
        }
      }
      let receivedShortReply = false;
      const beforeAnswer = await getWorldSimulationState(sid, options);
      assert.ok((await runWorldSimulationTurn(input("answer" + suffix), {
        ...options,
        ...(scenario === "unencoded_panel_speech" && !suffix ? {
          memoryEncodingDecider: async ({character_packets}) => {
            const index = character_packets.find(packet => packet.character === actor).perception.observed.indexOf(panelContent);
            assert.notEqual(index, -1);
            return [{character: actor, sense: "visual", sense_index: index, decision: "do_not_encode"}];
          },
        } : {}),
        characterCommunicationListenerInterpretationResolver: async view => interpret(view, actor, shortReply, !repeatQuestion),
        characterBrain: async packet => {
          if (packet.character === actor) {
            if (conflict) {
              // GREEN control: the same actor already receives canonical CB-C3
              // goal decisions in an ordinary Native event turn.
              assert.equal(packet.native_goal_decision?.version, nativeGoalDecisionViewVersion);
              assert.equal(packet.native_goal_decision.character, actor);
              assert.equal(packet.native_goal_decision.world_truth_exposed, false);
              assert.equal(packet.boundaries.native_goal_decision_explicit_intent_only, true);
              assert.equal(packet.boundaries.native_goal_decision_world_write_authority, false);
            }
            const serialized = JSON.stringify(packet.cognition.working_context);
            receivedShortReply = packet.perception.audible.some(item => item?.kind === "understood_utterance" && item.semantic_content === shortReply);
            if (!conflict) {
              assert.equal(packet.retrieval_experience.recovered_any_content, shouldRecover);
              assert.equal(serialized.includes(previousReading && encodedPanel ? historicalLesson : secondFact), shouldRecover);
            }
            assert.ok(!serialized.includes(firstFact));
            assert.ok(!JSON.stringify(packet).includes("dialogue_clarification_requests"));
            if (previousReading) assert.ok(!packet.perception.observed.includes(panelContent));
            const speech = packet.candidate_action_intents.find(item => item.communication?.surface_realization?.surface_text === wantedSpeech
              && typeof wantedSpeech === "string");
            if (wantedSpeech) {
              assert.ok(speech, JSON.stringify({scenario, candidates: packet.candidate_action_intents}));
              assert.equal(speech.communication.message.world_truth_claimed, false);
              assert.equal(speech.communication.message.epistemic_status, conflict ? "speaker_intention" : "character_uncertain");
              assert.ok(!JSON.stringify(packet).includes("shelf_timer_internal"));
              return quoteCurrent ? {action_id: speech.action_id} : "reject_all";
            }
            if (!shouldRecover) assert.ok(!packet.candidate_action_intents.some(item => item.communication));
          }
          if (packet.character === other) {
            assert.equal(packet.retrieval_experience.recovered_any_content, false);
          }
          return "reject_all";
        },
      })).committed);
      assert.equal(receivedShortReply, !repeatQuestion);
      if (wantedSpeech && quoteCurrent) {
        const turn = (await getWorldSimulationHistory(sid, options)).turns.at(-1);
        const spoken = turn.action_outcomes.find(row => row.actor === actor && row.result === "communication_emitted");
        assert.equal(spoken?.communication_event.surface_text, wantedSpeech);
        assert.equal(spoken.communication_event.addressee, speaker);
        assert.equal(spoken.communication_event.world_truth_claimed, false);
      }
      if (panelVisible && !suffix) {
        const outcome = await getWorldSimulationState(sid, options);
        const recordings = learned(outcome.state).filter(memory => memory.content.statement_kind === "observed_panel_readout");
        if (recordings.length !== Number(encodedPanel)) {
          const turn = (await getWorldSimulationHistory(sid, options)).turns.at(-1);
          assert.fail(JSON.stringify({expected: Number(encodedPanel), actual: recordings.length,
            panel_memories: outcome.state.memories[actor].filter(record => JSON.stringify(record.content).includes("面板")),
            encoding: turn.subjective_memory_encoding_decisions.decisions.filter(row => row.character === actor && row.sense === "visual"),
          }));
        }
        if (encodedPanel) {
          const [record] = recordings;
          assert.equal(record.content.referent_id, before[1].content.referent_id);
          assert.equal(record.content.panel_reading.max_countdown_seconds, 3000);
          assert.equal(record.content.panel_reading.observed_at, new Date(beforeAnswer.state.simulation_time).toISOString());
          assert.equal(record.encoded_at, record.content.panel_reading.observed_at);
          assert.equal(record.internal_provenance.dialogue_panel_revision, beforeAnswer.revision);
          assert.equal(record.source.sense, "visual");
          assert.equal(record.subjective_memory_not_world_truth, true);
        }
      }
      return [receivedShortReply, clarification?.action_id, clarification?.communication_acoustic_signal.sound_id,
        wantedSpeech && quoteCurrent ? wantedSpeech : null];
    }
    const [receivedShortReply, firstAction, firstSound] = await runExchange("");
    if (repeat) {
      const [heardAgain, secondAction, secondSound] = await runExchange("-again");
      assert.ok(heardAgain);
      assert.equal(secondAction, firstAction, "the same clarifying action identity should be reusable");
      assert.notEqual(secondSound, firstSound, "each utterance must have its own emitted sound");
    }
    let laterSpeech = null;
    if (historical) {
      await runtime.releaseWorldLineage(sid, options);
      assert.ok((await replayWorldSimulationCommittedCharacterExperiences(sid, options)).ok);
      laterSpeech = (await runExchange("-again"))[3];
    }
    const final = (await getWorldSimulationState(sid, options)).state;
    if (conflict) {
      // Expected-red Native acceptance: a committed statement of uncertainty
      // should surface the corresponding question without the caller forging
      // pending_internal_cues. An idle trigger is not enough.
      const worldHistory = await getWorldSimulationHistory(sid, options);
      const answerTurn = worldHistory.turns.at(-1);
      assert.ok(answerTurn.action_outcomes.some(row =>
        row.actor === actor && row.result === "communication_emitted"
        && row.communication_event?.surface_text === answers.conflict_speech
        && row.communication_event?.speech_act === "acknowledge_unresolved_question"),
      "Precondition: the speaker-owned pending-check intention must be selected, emitted, and punctuated as a statement.");
      const next = await scheduleWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id: sid,
        runtime_context_by_character: {[actor]: {idle: true}},
      }, options);
      const ownOpportunity = next.scheduler_projection.opportunities.find(item => item.character === actor);
      assert.ok(ownOpportunity?.trigger_kinds.includes("unresolved_question"),
        "Precondition: committed uncertain speech must generate an unresolved-question C2 cue.");

      // RED C2→C3 bridge: the same real-world evidence must reach the
      // character's bounded motivational decision interface. Do not invent a
      // pending cue, inject a current_goal, or choose a ready-made action.
      const cognitivePackets = [];
      const thought = await dispatchWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id: sid,
        runtime_context_by_character: {[actor]: {idle: true}},
      }, {...options, characterBrain: async packet => {
        if (packet.character === actor) cognitivePackets.push(structuredClone(packet));
        return {disposition: "autonomous_question_noted"};
      }});
      assert.ok(thought.dispatches.some(row =>
        row.character === actor && row.trigger_kinds.includes("unresolved_question")),
      "Precondition: C2 actually dispatched this character's World-grounded question.");

      const ownMind = cognitivePackets.find(packet => packet.character === actor);
      // The regular Native Brain packet already uses this exact CB-C3 field.
      // The independent C2 path must reuse it, not invent a duplicate API.
      const goalView = ownMind?.native_goal_decision;
      assert.equal(goalView?.version, nativeGoalDecisionViewVersion,
        "Native C2→C3 gap: a World-triggered autonomous thought lacks the existing Native goal decision interface.");
      assert.equal(goalView.character, actor);
      assert.equal(goalView.bounded_view_only, true);
      assert.equal(goalView.world_truth_exposed, false);
      assert.equal(goalView.source_event_ids_exposed, false);
      assert.equal(goalView.goal_ids_exposed, false);
      assert.equal(ownMind.boundaries.native_goal_decision_explicit_intent_only, true);
      assert.equal(ownMind.boundaries.native_goal_decision_world_write_authority, false);
      assert.equal(ownMind.boundaries.native_goal_decision_action_authority, false);
      assert.equal(thought.durable_cognitive_write_performed, false,
        "Providing a C3 decision view alone must not silently commit any goal.");
    }
    assert.equal(learned(final).length, conflict || encodedPanel ? 3 : 2);
    assert.ok(!final.memories[other].some(memory => memory.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion));
    console.log(JSON.stringify({scenario, short_reply_heard: receivedShortReply, recovered_expected_fact: shouldRecover,
      spoken: historical && encodedPanel ? null : expectedSpeech ?? null, later_spoken: laterSpeech}));
  } finally {
    await rm(fixtureRoot, {recursive: true, force: true});
  }
}

const selectedScenario = process.argv[2] ?? process.env.DIALOGUE_CLARIFICATION_CASE;
await Promise.all((selectedScenario ? [selectedScenario] : ["recalled_speech", "historical_panel_speech", "conflict_speech"]).map(run));
