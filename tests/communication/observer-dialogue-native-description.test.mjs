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
import {
  buildWorldSimulationNativeGoalDecisionView,
  nativeGoalDecisionViewVersion,
} from "../../server/src/world-simulation-motivation-goal-integration-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const actor = "收聽者";
const speaker = "提問者";
const other = "未聽見的人";
const firstFact = "它最多能倒數九十分鐘。";
const secondFact = "它最多能倒數四十分鐘。";
const question = "白色計時器能倒數多久？";
const prompt = "你指的是哪一件？";
const shortReply = "架上那台。";
async function run(scenario, {controlledClaimProbe = false, nativeClaimChoice = false} = {}) {
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
    // Explicitly *controlled* Phase65/66 pathway test, not autonomy evidence.
    // No memory, claim, belief, or goal is inserted into initial_world_state.
    // The resolver may cite only the engine's actual current-turn same-actor
    // subjective evidence. Preserve source modality: two statements about
    // what was seen/heard are NOT two verified timer specifications.
    const claimProbe = [
      {event: "observe2", fragment: "四十分鐘", sense: "visual",
        proposition: "我看見架上白色計時器有最多倒數四十分鐘的資訊。"},
      {event: "conflict", fragment: "六十分鐘", sense: "auditory",
        proposition: "我聽見架上白色計時器最多倒數六十分鐘的說法。"},
    ];
    const capturedClaimSources = [];
    const nativeInterpretationVisits = [];
    let selectedNativeClaimCount = 0;
    for (const id of ["observe1", "observe2", ...(conflict ? ["conflict"] : [])]) {
      const probe = controlledClaimProbe ? claimProbe.find(entry => entry.event === id) : null;
      assert.ok((await runWorldSimulationTurn(input(id), {
        ...options,
        characterBrain: async packet => {
          if (!nativeClaimChoice) return "reject_all";
          const view = packet.native_subjective_claim_decision;
          if (!view) {
            // An ordinary action reply can request post-encoding interpretation
            // without selecting a physical action. The first experience is
            // deliberately left uninterpreted; asking is not compulsory.
            return packet.character === actor && id !== "observe1"
              ? {action_id: "reject_all", request_subjective_claim_interpretation: true}
              : "reject_all";
          }
          assert.equal(packet.character, actor, "Only the requesting character receives the interpretation input.");
          assert.equal(view.character, actor);
          assert.equal(view.bounded_view_only, true);
          assert.equal(view.world_truth_exposed, false);
          assert.equal(view.durable_write_authority, false);
          assert.equal(view.action_selection_requested, false);
          assert.equal(view.source_memory_ids_exposed, false);
          assert.equal(typeof view.context_token, "string");
          assert.equal(id === "observe1", false, "A turn declining interpretation must not be forced into it.");
          assert.equal(JSON.stringify(view).includes("internal_provenance"), false);
          assert.equal(JSON.stringify(view).includes("source_memory_ref"), false);
          const observation = claimProbe.find(entry => entry.event === id);
          const matches = view.memory_sources.filter(memory =>
            memory.source?.sense === observation.sense
              && memory.subjective_memory_not_world_truth === true
              && JSON.stringify(memory.content).includes(observation.fragment));
          assert.ok(matches.length, "Only actual current-turn same-character encoded evidence may support an interpretation.");
          nativeInterpretationVisits.push({event: id, character: packet.character});
          // The actor is free to notice the visual evidence without adopting
          // a proposition. It explicitly forms a source-scoped claim only
          // about the later heard statement.
          if (id === "observe2") return {claim_context_token: view.context_token, claim_intents: []};
          selectedNativeClaimCount += 1;
          return {
            claim_context_token: view.context_token,
            claim_intents: [{
              proposition: observation.proposition,
              evidence: [{source_token: matches[0].source_token, relation: "supports"}],
            }],
          };
        },
        ...(probe ? {subjectiveClaimResolver: async view => {
          assert.equal(view.boundaries.current_turn_new_subjective_memories_only, true);
          assert.equal(view.boundaries.world_state_exposed, false);
          const evidence = view.character_evidence.find(entry => entry.character === actor);
          const matches = (evidence?.memories ?? []).filter(memory =>
            memory.source?.sense === probe.sense
              && memory.subjective_memory_not_world_truth === true
              && JSON.stringify(memory.content).includes(probe.fragment));
          console.log(JSON.stringify({
            scenario: "controlled_phase65_source_probe",
            event: id, actor_memory_count: evidence?.memories?.length ?? 0,
            matching_source_count: matches.length,
            seen_source_senses: (evidence?.memories ?? []).map(memory => memory.source?.sense),
          }));
          // Returning [] remains legal if the engine did not expose the
          // evidence. The post-commit assertions will locate that gap.
          if (!matches.length) return [];
          const source = matches[0];
          capturedClaimSources.push({event: id, source_memory_ref: source.source_memory_ref});
          return [{
            proposal_ref: "test_control_" + id, character: actor,
            proposition: probe.proposition,
            evidence: [{source_memory_ref: source.source_memory_ref, relation: "supports"}],
          }];
        }} : {}),
      })).committed);
    }
    const beforeState = (await getWorldSimulationState(sid, options)).state;
    const before = learned(beforeState);
    assert.equal(before.length, conflict ? 3 : 2);
    assert.equal(before[1].source.sense, scenario === "heard_speech" ? "auditory" : "visual");
    assert.notEqual(before[0].content.referent_id, before[1].content.referent_id);
    if (nativeClaimChoice) {
      const ownClaims = (beforeState.subjective_claim_history ?? []).filter(ref => ref.character === actor);
      const ownRevisions = (beforeState.subjective_belief_revision_history ?? []).filter(ref => ref.character === actor);
      const actorView = buildWorldSimulationNativeGoalDecisionView({
        world_state: beforeState, character: actor, turn_id: "native_claim_choice_followup",
      });
      const otherView = buildWorldSimulationNativeGoalDecisionView({
        world_state: beforeState, character: other, turn_id: "native_claim_choice_followup",
      });
      console.log(JSON.stringify({
        scenario: "native_subjective_claim_handoff",
        learned_dialogue_memories: before.length,
        requested_interpretation_turns: 2,
        actual_interpretation_callbacks: nativeInterpretationVisits.length,
        explicitly_selected_claims: selectedNativeClaimCount,
        committed_claims: ownClaims.length,
        committed_belief_revisions: ownRevisions.length,
        own_goal_basis_count: actorView.motivation_basis.length,
        other_goal_basis_count: otherView.motivation_basis.length,
      }));
      assert.deepEqual(nativeInterpretationVisits.map(visit => visit.event), ["observe2", "conflict"],
        "Native Phase65 gap: requested interpretation of real newly encoded evidence must reach the same Character Brain without a caller-supplied subjectiveClaimResolver.");
      assert.equal(selectedNativeClaimCount, 1);
      assert.equal(ownClaims.length, 1, "Only the explicitly authored claim may be committed.");
      assert.equal(ownRevisions.length, 1);
      assert.equal(actorView.motivation_basis.length, 1);
      assert.equal(otherView.motivation_basis.length, 0);
      assert.equal(actorView.existing_goals.length, 0);
      assert.equal((beforeState.subjective_claim_history ?? []).some(ref => ref.character !== actor), false);
      return;
    }
    if (controlledClaimProbe) {
      assert.equal(conflict, true);
      assert.equal(before[1].content.referent_id, before[2].content.referent_id,
        "The conflicting observations concern the same shelf timer.");
      const ownClaims = (beforeState.subjective_claim_history ?? [])
        .filter(ref => ref.character === actor);
      const ownRevisions = (beforeState.subjective_belief_revision_history ?? [])
        .filter(ref => ref.character === actor);
      const actorView = buildWorldSimulationNativeGoalDecisionView({
        world_state: beforeState, character: actor, turn_id: "controlled_future_goal_view",
      });
      const bystanderView = buildWorldSimulationNativeGoalDecisionView({
        world_state: beforeState, character: other, turn_id: "controlled_future_goal_view",
      });
      console.log(JSON.stringify({
        scenario: "controlled_phase65_66_68d_bridge",
        learned_dialogue_memories: before.length,
        resolver_evidence_selected: capturedClaimSources.length,
        actor_claim_refs: ownClaims.length,
        actor_belief_revision_refs: ownRevisions.length,
        actor_goal_basis_count: actorView.motivation_basis.length,
        bystander_goal_basis_count: bystanderView.motivation_basis.length,
        actor_existing_goals_count: actorView.existing_goals.length,
        autonomous_interpretation_tested: false,
      }));
      assert.equal(capturedClaimSources.length, 2,
        "Phase65 resolver must see both actual same-character timer observations, each on its own source turn.");
      assert.ok(ownClaims.length >= 2, "Phase65 authoritative claim writer must persist selected claims.");
      assert.ok(ownRevisions.length >= 2, "Phase66 must retain actual belief revision lineage for these source-scoped claims.");
      assert.ok(actorView.motivation_basis.length >= 2,
        "Existing Phase68D must provide the actor legal committed belief-based evidence.");
      assert.equal(bystanderView.motivation_basis.length, 0,
        "The unobserving bystander must not inherit the actor's motives.");
      assert.equal(actorView.existing_goals.length, 0,
        "Evidence admission alone must not create any durable goal.");

      // Separate controlled admission: both actors have fixture legacy goals,
      // so an explicit idle cue lets us compare their same-snapshot C2 views.
      // This is NOT the independent World-triggered autonomy test below.
      const beforeDispatch = await getWorldSimulationState(sid, options);
      const capturedViews = new Map();
      const controlledDispatch = await dispatchWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id: sid,
        runtime_context_by_character: {[actor]: {idle: true}, [other]: {idle: true}},
      }, {...options, characterBrain: async packet => {
        capturedViews.set(packet.character, structuredClone(packet));
        return {disposition: "inspect_without_goal_intent"};
      }});
      assert.equal(controlledDispatch.dispatch_count, 2);
      assert.equal(capturedViews.size, 2);
      for (const character of [actor, other]) {
        const input = capturedViews.get(character);
        const view = input?.native_goal_decision;
        assert.equal(view?.version, nativeGoalDecisionViewVersion);
        assert.equal(view.character, character);
        assert.equal(view.bounded_view_only, true);
        assert.equal(view.world_truth_exposed, false);
        assert.equal(view.source_event_ids_exposed, false);
        assert.equal(view.goal_ids_exposed, false);
        assert.equal(view.existing_goals.length, 0);
        assert.equal(input.boundaries.native_goal_decision_world_write_authority, false);
        assert.equal(input.boundaries.native_goal_decision_intent_submission_supported, false);
        assert.equal(JSON.stringify(input).includes(
          controlledDispatch.dispatches.find(row => row.character === character).opportunity_id), false,
          "C2 goal view must not expose its engine-private scheduler opportunity identity.");
      }
      assert.deepEqual(capturedViews.get(actor).native_goal_decision.motivation_basis.map(entry => entry.evidence),
        actorView.motivation_basis.map(entry => entry.evidence),
        "C2 must carry the actor's existing real committed Phase68D evidence.");
      assert.equal(capturedViews.get(other).native_goal_decision.motivation_basis.length, 0,
        "C2 must not transfer the actor's evidence to an unobserving character.");
      assert.equal(controlledDispatch.world_mutation_performed, false);
      assert.equal(controlledDispatch.action_selection_performed, false);
      assert.equal(controlledDispatch.durable_cognitive_write_performed, false);
      const afterDispatch = await getWorldSimulationState(sid, options);
      assert.equal(afterDispatch.revision, beforeDispatch.revision);
      assert.equal(afterDispatch.state_hash, beforeDispatch.state_hash);
      console.log(JSON.stringify({
        scenario: "controlled_c2_goal_view_readonly",
        actor_basis_count: capturedViews.get(actor).native_goal_decision.motivation_basis.length,
        bystander_basis_count: capturedViews.get(other).native_goal_decision.motivation_basis.length,
        world_revision_unchanged: true,
        autonomous_goal_formation_tested: false,
      }));
      return;
    }
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
      // The committed uncertain utterance alone must wake C2. No caller
      // idle flag or pending internal cue is allowed in this Native test.
      const worldHistory = await getWorldSimulationHistory(sid, options);
      const answerTurn = worldHistory.turns.at(-1);
      assert.ok(answerTurn.action_outcomes.some(row =>
        row.actor === actor && row.result === "communication_emitted"
        && row.communication_event?.surface_text === answers.conflict_speech
        && row.communication_event?.speech_act === "acknowledge_unresolved_question"),
      "Precondition: the speaker-owned pending-check intention must be selected, emitted, and punctuated as a statement.");
      const next = await scheduleWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id: sid,
      }, options);
      const ownOpportunity = next.scheduler_projection.opportunities.find(item => item.character === actor);
      assert.deepEqual(ownOpportunity?.trigger_kinds, ["unresolved_question"],
        "Precondition: only committed uncertain speech, not a manually supplied idle cue, must wake C2.");
      assert.equal(next.scheduler_projection.opportunity_count, 1,
        "No unrelated character may receive the speaker's private unresolved-question opportunity.");

      // Independent test-side observation, not a runtime injection:
      // determine whether the existing Phase68D evidence catalog has a
      // legal motivational basis even before wiring C2 to the C3 view.
      const directGoalView = buildWorldSimulationNativeGoalDecisionView({
        world_state: final, character: actor, turn_id: "diagnostic_future_c2_goal_turn",
      });
      const otherGoalView = buildWorldSimulationNativeGoalDecisionView({
        world_state: final, character: other, turn_id: "diagnostic_future_c2_goal_turn",
      });
      assert.equal(directGoalView.character, actor);
      assert.equal(directGoalView.world_truth_exposed, false);
      assert.equal(directGoalView.source_event_ids_exposed, false);
      assert.equal(directGoalView.goal_ids_exposed, false);
      console.log(JSON.stringify({
        scenario: "c2_goal_basis_readonly_audit",
        actor_motivation_basis_count: directGoalView.motivation_basis.length,
        bystander_motivation_basis_count: otherGoalView.motivation_basis.length,
        actor_existing_goals_count: directGoalView.existing_goals.length,
        actor_learned_dialogue_memories_count: learned(final).length,
        actor_subjective_claim_history_refs: (final.subjective_claim_history ?? [])
          .filter(ref => ref.character === actor).length,
        actor_subjective_belief_revision_history_refs: (final.subjective_belief_revision_history ?? [])
          .filter(ref => ref.character === actor).length,
      }));

      // Independently triggered C2→C3 view: no new goal, idle cue, or
      // caller-supplied investigation action. This does not require the
      // unassisted actor to have a nonempty Phase68D evidence catalog.
      const beforeThought = await getWorldSimulationState(sid, options);
      const cognitivePackets = [];
      const thought = await dispatchWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id: sid,
      }, {...options, characterBrain: async packet => {
        if (packet.character === actor) cognitivePackets.push(structuredClone(packet));
        return {disposition: "autonomous_question_noted"};
      }});
      assert.equal(thought.dispatch_count, 1);
      assert.ok(thought.dispatches.some(row =>
        row.character === actor && JSON.stringify(row.trigger_kinds) === JSON.stringify(["unresolved_question"])),
      "Precondition: C2 dispatched only this character's World-grounded question without an idle cue.");

      const ownMind = cognitivePackets.find(packet => packet.character === actor);
      const currentMind = ownMind?.cognition?.autonomous_opportunity?.current_mind ?? {};
      // Read-only diagnostic: distinguish a C2 trigger with a genuine
      // subject-specific internal context from a bare generic trigger kind.
      console.log(JSON.stringify({
        scenario: "c2_question_context_readonly_audit",
        current_mind_keys: Object.keys(currentMind).sort(),
        current_mind_mentions_question_subject: JSON.stringify(currentMind).includes("計時器"),
        current_mind_mentions_followup: JSON.stringify(currentMind).includes("查"),
        received_trigger_kinds: ownMind?.cognition?.autonomous_opportunity?.trigger_kinds ?? [],
      }));
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
      assert.equal(ownMind.boundaries.native_goal_decision_intent_submission_supported, false);
      assert.deepEqual(goalView.motivation_basis.map(entry => entry.evidence),
        directGoalView.motivation_basis.map(entry => entry.evidence));
      assert.equal(thought.durable_cognitive_write_performed, false,
        "Providing a C3 decision view alone must not silently commit any goal.");
      const afterThought = await getWorldSimulationState(sid, options);
      assert.equal(afterThought.revision, beforeThought.revision);
      assert.equal(afterThought.state_hash, beforeThought.state_hash);
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
// Run the isolated controlled conversion and readonly view test before
// the independent World-triggered C2→C3 acceptance test.
if (!selectedScenario || selectedScenario === "controlled_claim_probe") {
  await run("conflict_speech", {controlledClaimProbe: true});
}
if (!selectedScenario || selectedScenario === "native_claim_choice") {
  await run("conflict_speech", {nativeClaimChoice: true});
}
if (!["controlled_claim_probe", "native_claim_choice"].includes(selectedScenario)) {
  await Promise.all((selectedScenario ? [selectedScenario] : ["recalled_speech", "historical_panel_speech", "conflict_speech"])
    .map(scenario => run(scenario)));
}
