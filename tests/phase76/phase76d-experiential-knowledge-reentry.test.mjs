import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveEpisodeSegmentations,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import {
  buildWorldSimulationExperientialKnowledgeReentryContract,
  buildWorldSimulationExperientialKnowledgeReentryResolverView,
  projectWorldSimulationExperientialKnowledgeReentry,
  worldSimulationExperientialKnowledgeReentryVersion,
} from "../../server/src/world-simulation-experiential-knowledge-reentry-service.mjs";

const character = "伊萊亞斯・諾爾";
const otherCharacter = "柊木璃央";

function memoryFixture(memoryId, turnId, description) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: { kind: "visual_observation", description },
    source: { kind: "direct_perception", sense: "visual" },
    internal_provenance: {
      event_id: `engine_${memoryId}`,
      scene_id: `scene_${memoryId}`,
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v2",
    },
    retrieval_cues: { memory_type: "episodic_direct_perception" },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    last_recalled_at: null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
    encoded_at: `${turnId}:encoded`,
  };
}

function source(characterName, memory) {
  return { character: characterName, memory_record: structuredClone(memory) };
}

function executeTransition(worldState, previewWorldState, stateTransitions, turnId) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: turnId,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: stateTransitions,
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: previewWorldState,
    queue,
  }).next_world_state;
}

function addLifeEvent(worldState, turnId, memory) {
  const segmentation = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [source(character, memory)],
  });
  const segmented = executeTransition(
    worldState,
    segmentation.result.preview_world_state,
    segmentation.result.state_transitions,
    `${turnId}:subjective_episode_segmentation`,
  );
  const sourceIds = [
    ...segmentation.result.segmentation_events_created.map((event) => event.segmentation_event_id),
    ...segmentation.result.already_persisted_segmentation_event_ids,
  ];
  const life = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmented,
    turn_id: turnId,
    source_segmentation_event_ids: sourceIds,
    organization_decisions: [],
  });
  const nextWorld = executeTransition(
    segmented,
    life.result.preview_world_state,
    life.result.state_transitions,
    `${turnId}:autobiographical_life_event`,
  );
  return {
    world_state: nextWorld,
    organization_event_id: life.result.organization_events_created[0].organization_event_id,
  };
}

function lifeRef(worldState, organizationEventId) {
  const event = worldState.autobiographical_life_event_organization_events[organizationEventId];
  return {
    life_event_id: event.life_event_id,
    organization_event_id: event.organization_event_id,
    organization_event_hash: event.organization_event_hash,
  };
}

function addRecurringSemantic(worldState, turnId, currentOrganizationId, refs) {
  const view = buildWorldSimulationPersonalSemanticMemoryResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: [currentOrganizationId],
  });
  const derivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: [currentOrganizationId],
    semantic_decisions: [{
      character,
      operation: "form",
      semantic_category: "recurring_event_pattern",
      semantic_key: "blocked-direct-route-seek-alternative",
      semantic_descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "when_direct_route_blocked_seek_alternative_route",
        object_ref: "alternative-route-method",
        qualifiers: ["blocked-route", "alternative-means"],
      },
      source_life_event_refs: refs,
      resolver_view_hash: view.resolver_view_hash,
      source: "programmatic_personal_semantic_memory_resolver",
    }],
  });
  return executeTransition(
    worldState,
    derivation.result.preview_world_state,
    derivation.result.state_transitions,
    `${turnId}:personal_semantic_memory`,
  );
}

const contract = buildWorldSimulationExperientialKnowledgeReentryContract();
assert.equal(contract.phase, "Phase76D");
assert.equal(contract.version, worldSimulationExperientialKnowledgeReentryVersion);
assert.equal(contract.source_owner, "Phase67C");
assert.equal(contract.committed_prior_turn_source_only, true);
assert.equal(contract.same_character_source_only, true);
assert.equal(contract.cue_dependent_access_required, true);
assert.equal(contract.resolver_selects_opaque_semantic_refs_only, true);
assert.equal(contract.resolver_may_author_semantic_content, false);
assert.equal(contract.missing_resolver_means_no_reentry, true);
assert.equal(contract.current_mind_admission_output_gating_reused, true);
assert.equal(contract.direct_current_mind_write_allowed, false);
assert.equal(contract.direct_subjective_belief_write_allowed, false);
assert.equal(contract.direct_plan_or_goal_mutation_allowed, false);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.prior_method_is_advisory_not_command, true);
assert.equal(contract.current_context_revalidation_required, true);
assert.equal(contract.exact_case_replay_required, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.confidence_probability_modeled, false);

const turn1 = "world_turn_phase76d_001";
const memory1 = memoryFixture(
  "memory_phase76d_001",
  turn1,
  "正門受阻後改找側邊通道。",
);
let world = { memories: { [character]: [memory1] } };
const life1 = addLifeEvent(world, turn1, memory1);
world = life1.world_state;

const turn2 = "world_turn_phase76d_002";
const memory2 = memoryFixture(
  "memory_phase76d_002",
  turn2,
  "另一處入口受阻後再次尋找替代通路。",
);
world = structuredClone(world);
world.memories[character].push(memory2);
const life2 = addLifeEvent(world, turn2, memory2);
world = addRecurringSemantic(
  life2.world_state,
  turn2,
  life2.organization_event_id,
  [
    lifeRef(life2.world_state, life1.organization_event_id),
    lifeRef(life2.world_state, life2.organization_event_id),
  ],
);

const currentTurn = "world_turn_phase76d_003";
const resolverView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
  world_state: world,
  character,
  current_turn_id: currentTurn,
  current_context: {
    perception: {
      observed: [{ description: "眼前主要通路被堵住。", target_id: "hidden-target-id" }],
    },
    current_goal: "抵達建築內部",
    current_action: "尋找可行入口",
    hidden_engine_id: "must-not-leak",
    causal_evidence: "hidden-world-cause",
  },
});
assert.equal(resolverView.version, worldSimulationExperientialKnowledgeReentryVersion);
assert.equal(resolverView.character, character);
assert.equal(resolverView.candidate_personal_semantics.length, 1);
assert.equal(resolverView.selection_contract.no_match_may_return_empty, true);
assert.equal(resolverView.selection_contract.semantic_content_authoring_allowed, false);
assert.equal(resolverView.boundaries.same_character_candidates_only, true);
assert.equal(resolverView.boundaries.current_turn_phase67c_semantics_excluded, true);
const candidate = resolverView.candidate_personal_semantics[0];
assert.equal(candidate.semantic_category, "recurring_event_pattern");
assert.equal(candidate.knowledge_status, "supported");
assert.equal(candidate.subjective_not_world_truth, true);
assert.equal(candidate.epistemic_acceptance_decided, false);
assert.equal(
  candidate.semantic_descriptor.predicate,
  "when_direct_route_blocked_seek_alternative_route",
);

const serializedResolver = JSON.stringify(resolverView);
for (const hidden of [
  "must-not-leak",
  "hidden-world-cause",
  "hidden-target-id",
  "support_life_event_refs",
  "counterevidence_life_event_refs",
]) {
  assert.equal(
    serializedResolver.includes(hidden),
    false,
    `Phase76D resolver leaked hidden/internal value: ${hidden}`,
  );
}

const noMatch = projectWorldSimulationExperientialKnowledgeReentry({
  resolver_view: resolverView,
  activated_semantic_refs: [],
});
assert.equal(noMatch.character_view.experiential_knowledge.length, 0);
assert.equal(noMatch.audit.direct_action_selection, false);

const reentry = projectWorldSimulationExperientialKnowledgeReentry({
  resolver_view: resolverView,
  activated_semantic_refs: [candidate.semantic_ref],
});
assert.equal(reentry.activated_semantics.length, 1);
assert.equal(reentry.character_view.experiential_knowledge.length, 1);
const knowledge = reentry.character_view.experiential_knowledge[0];
assert.equal(knowledge.kind, "recalled_experiential_knowledge");
assert.equal(knowledge.knowledge_status, "supported");
assert.equal(knowledge.subjective_not_world_truth, true);
assert.equal(knowledge.advisory_only, true);
assert.equal(knowledge.prior_method_not_direct_action_command, true);
assert.equal(knowledge.current_context_revalidation_required, true);
assert.equal(
  knowledge.semantic_descriptor.object_ref,
  "alternative-route-method",
);
assert.equal(JSON.stringify(reentry.character_view).includes(candidate.semantic_ref), false);
assert.equal(reentry.audit.resolver_authored_semantic_content, false);
assert.equal(reentry.audit.existing_current_mind_gating_targeted, true);
assert.equal(reentry.audit.existing_phase73_phase74_phase75_adaptation_preserved, true);
assert.equal(reentry.audit.world_truth_authority_claimed, false);
assert.equal(reentry.audit.confidence_probability_modeled, false);

assert.throws(
  () => projectWorldSimulationExperientialKnowledgeReentry({
    resolver_view: resolverView,
    activated_semantic_refs: [candidate.semantic_ref, candidate.semantic_ref],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_DUPLICATE",
);
assert.throws(
  () => projectWorldSimulationExperientialKnowledgeReentry({
    resolver_view: resolverView,
    activated_semantic_refs: ["personal_semantic_memory_not_in_view"],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_OUT_OF_VIEW",
);

const otherView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
  world_state: world,
  character: otherCharacter,
  current_turn_id: currentTurn,
  current_context: { current_goal: "進入建築" },
});
assert.equal(otherView.candidate_personal_semantics.length, 0);

// A canonically formed current-turn semantic memory is never eligible for
// re-entry in the same turn that created it. Build it through the ordinary
// Phase67A/B/C chronology instead of forging immutable semantic history.
const sameTurnMemory = memoryFixture(
  "memory_phase76d_same_turn",
  currentTurn,
  "這一回合剛注意到牆面上的維修標記。",
);
const sameTurnBase = structuredClone(world);
sameTurnBase.memories[character].push(sameTurnMemory);
const sameTurnLife = addLifeEvent(sameTurnBase, currentTurn, sameTurnMemory);
const sameTurnSemanticView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: sameTurnLife.world_state,
  turn_id: currentTurn,
  source_organization_event_ids: [sameTurnLife.organization_event_id],
});
const sameTurnDerivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
  world_state: sameTurnLife.world_state,
  turn_id: currentTurn,
  source_organization_event_ids: [sameTurnLife.organization_event_id],
  semantic_decisions: [{
    character,
    operation: "form",
    semantic_category: "autobiographical_fact",
    semantic_key: "noticed-maintenance-mark-this-turn",
    semantic_descriptor: {
      subject_scope: "self_autobiographical_experience",
      predicate: "noticed",
      object_ref: "maintenance-mark",
      qualifiers: ["current-turn"],
    },
    source_life_event_refs: [
      lifeRef(sameTurnLife.world_state, sameTurnLife.organization_event_id),
    ],
    resolver_view_hash: sameTurnSemanticView.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
});
const sameTurnWorld = executeTransition(
  sameTurnLife.world_state,
  sameTurnDerivation.result.preview_world_state,
  sameTurnDerivation.result.state_transitions,
  `${currentTurn}:personal_semantic_memory`,
);
const sameTurnView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
  world_state: sameTurnWorld,
  character,
  current_turn_id: currentTurn,
  current_context: { current_goal: "進入建築" },
});
assert.equal(
  sameTurnView.candidate_personal_semantics.some(
    (item) => item.semantic_key === "noticed-maintenance-mark-this-turn",
  ),
  false,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const stateSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"),
  "utf8",
);
const reentryViewIndex = loopSource.indexOf(
  "const experientialKnowledgeReentryResolverView =",
);
const currentMindIndex = loopSource.indexOf(
  "await characterRuntimeManager.prepareSpeculativeCurrentMind(",
  reentryViewIndex,
);
const cognitionIndex = loopSource.indexOf(
  '"world_character_cognition"',
  currentMindIndex,
);
const actionProposerIndex = loopSource.indexOf(
  '"world_action_proposer"',
  cognitionIndex,
);
assert.ok(
  reentryViewIndex >= 0
    && currentMindIndex > reentryViewIndex
    && cognitionIndex > currentMindIndex
    && actionProposerIndex > cognitionIndex,
  "Phase76D must re-enter knowledge before Current Mind, cognition, and action proposal.",
);
assert.match(
  loopSource.slice(reentryViewIndex, currentMindIndex + 1800),
  /experiential_knowledge:\s*\n\s*experientialKnowledgeReentry\.character_view\.experiential_knowledge/,
);
assert.match(loopSource, /sourceKind:\s*"experiential_knowledge"/);
assert.match(
  loopSource,
  /candidate\.source_kind === "experiential_knowledge"[\s\S]{0,120}\? "recalled_experiential_knowledge"/,
);
assert.match(loopSource, /experiential_knowledge_reentry_projections:/);
assert.match(stateSource, /experiential_knowledge_reentry_projections:/);

console.log("Phase76D cue-dependent experiential knowledge re-entry tests passed.");
