import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveClaims,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimConflictRevisions,
} from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  resolveWorldSimulationSubjectiveBeliefs,
} from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefRevisionContract,
  buildWorldSimulationSubjectiveBeliefRevisions,
  subjectiveBeliefRevisionEventSchemaVersion,
  subjectiveBeliefRevisionHistoryReferenceSchemaVersion,
  worldSimulationSubjectiveBeliefRevisionVersion,
} from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";

const character = "伊萊亞斯・諾爾";
const priorTurnId = "world_turn_phase66a_prior";
const currentTurnId = "world_turn_phase66a_current";

function memoryFixture(memoryId, turnId, description) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: {
      kind: "visual_observation",
      description,
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    internal_provenance: {
      event_id: `event_${memoryId}`,
      scene_id: "scene_phase66a",
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v1",
    },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    last_recalled_at: null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}

function executeProjection(worldState, turnId, suffix, projection) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${suffix}`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: projection.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: projection.result.preview_world_state,
    queue,
  });
  return {
    projection,
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}

function executeClaimProjection(worldState, turnId, sourceMemories, proposals) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_claim",
    buildWorldSimulationSubjectiveClaims({
      world_state: worldState,
      turn_id: turnId,
      source_memory_records: sourceMemories.map((memory) => ({
        character,
        memory_record: memory,
      })),
      claim_proposals: proposals,
    }),
  );
}

function executeRelationProjection(worldState, turnId, proposals) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_claim_relation",
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state: worldState,
      turn_id: turnId,
      relation_proposals: proposals,
    }),
  );
}

function buildRevision(worldState, turnId, resolution) {
  return buildWorldSimulationSubjectiveBeliefRevisions({
    world_state: worldState,
    turn_id: turnId,
    resolution: resolution.result,
  });
}

function executeRevision(worldState, turnId, revision) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_belief_revision",
    revision,
  );
}

const priorMemory = memoryFixture(
  "memory_phase66a_prior",
  priorTurnId,
  "先前看見阿灰在伊萊亞斯抬手後改變方向。",
);
const currentMemoryA = memoryFixture(
  "memory_phase66a_current_a",
  currentTurnId,
  "這次看見阿灰在沒有明顯手勢時自行改變方向。",
);
const currentMemoryB = memoryFixture(
  "memory_phase66a_current_b",
  currentTurnId,
  "同一回合也看見阿灰在伊萊亞斯視線移開後繼續改變方向。",
);

const baseWorldState = {
  simulation_time: "2026-09-07T02:00:00+08:00",
  memories: {
    [character]: [
      priorMemory,
      currentMemoryA,
      currentMemoryB,
    ],
  },
};

const priorClaimBuild = executeClaimProjection(
  baseWorldState,
  priorTurnId,
  [priorMemory],
  [
    {
      proposal_ref: "phase66a-prior-directed-control",
      character,
      proposition: "阿灰的方向變化可能依賴伊萊亞斯的有意識指令。",
      evidence: [
        {
          source_memory_ref: priorMemory.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const priorClaim = priorClaimBuild.projection.result.claim_events_created[0];

const currentClaimBuild = executeClaimProjection(
  priorClaimBuild.world_state,
  currentTurnId,
  [currentMemoryA, currentMemoryB],
  [
    {
      proposal_ref: "phase66a-current-autonomy-a",
      character,
      proposition: "阿灰可能具有不依賴伊萊亞斯明顯有意識指令的自主行動能力。",
      evidence: [
        {
          source_memory_ref: currentMemoryA.memory_id,
          relation: "supports",
        },
      ],
    },
    {
      proposal_ref: "phase66a-current-autonomy-b",
      character,
      proposition: "阿灰的自主移動可能在伊萊亞斯沒有注意時仍然發生。",
      evidence: [
        {
          source_memory_ref: currentMemoryB.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const currentClaims = currentClaimBuild.projection.result.claim_events_created;
const currentClaimA = currentClaims.find(
  (event) => event.derivation.proposal_ref === "phase66a-current-autonomy-a",
);
const currentClaimB = currentClaims.find(
  (event) => event.derivation.proposal_ref === "phase66a-current-autonomy-b",
);
const worldStateWithClaims = currentClaimBuild.world_state;

assert.ok(priorClaim);
assert.ok(currentClaimA);
assert.ok(currentClaimB);

// Contract: Phase66A persists revision history only. Effective current belief
// remains a separate Phase66B projection and same-turn Character Brain feedback
// remains forbidden.
const contract = buildWorldSimulationSubjectiveBeliefRevisionContract();
assert.equal(contract.version, worldSimulationSubjectiveBeliefRevisionVersion);
assert.equal(contract.phase, "Phase66A");
assert.equal(
  contract.status,
  "append_only_subjective_belief_revision_events_installed",
);
assert.equal(
  contract.revision_event_schema_version,
  subjectiveBeliefRevisionEventSchemaVersion,
);
assert.equal(
  contract.revision_history_reference_schema_version,
  subjectiveBeliefRevisionHistoryReferenceSchemaVersion,
);
assert.equal(contract.immutable_event_write_once_required, true);
assert.equal(contract.append_only_history_required, true);
assert.equal(contract.per_character_previous_event_hash_chain_required, true);
assert.equal(contract.source_resolution_decision_hash_pinned, true);
assert.equal(contract.source_claim_hashes_pinned, true);
assert.equal(contract.source_relation_hashes_pinned, true);
assert.equal(contract.unresolved_decision_creates_revision_event, false);
assert.equal(contract.historical_claim_mutation_allowed, false);
assert.equal(contract.historical_relation_mutation_allowed, false);
assert.equal(contract.historical_revision_mutation_allowed, false);
assert.equal(contract.effective_belief_projection_installed, false);
assert.equal(contract.character_brain_exposure_installed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.hidden_semantic_graph_traversal_allowed, false);
assert.equal(contract.deterministic_history_order_is_epistemic_precedence, false);
assert.equal(
  contract.authoritative_mutation_owner,
  "phase62k-authoritative-mutation-executor-v1",
);
assert.equal(contract.native_world_loop_adoption_installed, true);
assert.equal(contract.current_belief_projection_owner, "Phase66B");

const mutationContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(
  mutationContract.execution
    .phase66a_subjective_belief_revision_event_write_once_enforced,
  true,
);
assert.equal(
  mutationContract.execution
    .phase66a_subjective_belief_revision_event_content_address_verified,
  true,
);
assert.equal(
  mutationContract.execution
    .phase66a_subjective_belief_revision_history_append_only_enforced,
  true,
);
assert.equal(
  mutationContract.execution
    .phase66a_per_character_revision_hash_chain_enforced,
  true,
);

// 1-4. An unopposed Phase65D adopt decision becomes one immutable,
// content-addressed Phase66A event and one append-only history reference.
const unopposedResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: worldStateWithClaims,
  turn_id: currentTurnId,
});
assert.equal(unopposedResolution.result.decision_count, 2);
assert.deepEqual(
  unopposedResolution.result.decisions.map((decision) => decision.action),
  ["adopt", "adopt"],
);

const unopposedRevision = buildRevision(
  worldStateWithClaims,
  currentTurnId,
  unopposedResolution,
);
assert.equal(unopposedRevision.ok, true);
assert.equal(unopposedRevision.result.processed_resolution_decision_count, 2);
assert.equal(unopposedRevision.result.actionable_resolution_decision_count, 2);
assert.equal(unopposedRevision.result.unresolved_resolution_decision_count, 0);
assert.equal(unopposedRevision.result.revision_events_created.length, 2);
assert.equal(unopposedRevision.result.history_references_appended.length, 2);

const firstAdoption = unopposedRevision.result.revision_events_created[0];
assert.equal(firstAdoption.schema_version, subjectiveBeliefRevisionEventSchemaVersion);
assert.equal(firstAdoption.immutable, true);
assert.equal(firstAdoption.resolution_action, "adopt");
assert.equal(firstAdoption.from_commitment, null);
assert.equal(firstAdoption.to_commitment, "active");
assert.equal(firstAdoption.adopted_claim_event_ids.length, 1);
assert.deepEqual(firstAdoption.superseded_claim_event_ids, []);
assert.equal(firstAdoption.semantic_state.subjective_not_world_truth, true);
assert.equal(firstAdoption.semantic_state.world_truth_verified, false);
assert.equal(firstAdoption.semantic_state.confidence, null);
assert.equal(firstAdoption.semantic_state.probability, null);
assert.equal(firstAdoption.semantic_state.effective_belief_projection_applied, false);
assert.equal(firstAdoption.engine_audit.unresolved_decision_persisted, false);
assert.equal(firstAdoption.engine_audit.world_truth_authority_claimed, false);
assert.equal(firstAdoption.engine_audit.confidence_probability_modeled, false);
assert.equal(firstAdoption.engine_audit.last_write_wins_applied, false);
assert.equal(
  firstAdoption.engine_audit.same_turn_character_brain_feedback_allowed,
  false,
);
const firstAdoptionBody = structuredClone(firstAdoption);
delete firstAdoptionBody.belief_revision_event_hash;
assert.equal(
  firstAdoption.belief_revision_event_hash,
  hashAgentRunValue(firstAdoptionBody),
);
assert.equal(
  firstAdoption.source_resolution_decision_hash,
  firstAdoption.source_resolution_decision.decision_hash,
);
assert.equal(firstAdoption.claim_references.length, 1);
const adoptedClaim = worldStateWithClaims.subjective_claim_events[
  firstAdoption.adopted_claim_event_ids[0]
];
assert.equal(
  firstAdoption.claim_references[0].claim_event_hash,
  adoptedClaim.claim_event_hash,
);

// The deterministic per-character event chain serializes append history but is
// not epistemic precedence. With two same-turn adopt events, the second pins the
// first event hash only as an integrity predecessor.
const secondAdoption = unopposedRevision.result.revision_events_created[1];
assert.equal(
  secondAdoption.previous_belief_revision_event_id,
  firstAdoption.belief_revision_event_id,
);
assert.equal(
  secondAdoption.previous_belief_revision_event_hash,
  firstAdoption.belief_revision_event_hash,
);
assert.equal(
  secondAdoption.derivation.deterministic_sort_used_as_epistemic_precedence,
  false,
);

const unopposedExecution = executeRevision(
  worldStateWithClaims,
  currentTurnId,
  unopposedRevision,
);
assert.equal(
  Object.keys(
    unopposedExecution.world_state.subjective_belief_revision_events,
  ).length,
  2,
);
assert.equal(
  unopposedExecution.world_state.subjective_belief_revision_history.length,
  2,
);
assert.equal(
  unopposedExecution.execution.execution.sole_final_world_state_writer,
  true,
);

// 5. Replaying the same decisions over the committed state is idempotent.
const replayRevision = buildRevision(
  unopposedExecution.world_state,
  currentTurnId,
  unopposedResolution,
);
assert.equal(replayRevision.result.revision_events_created.length, 0);
assert.equal(replayRevision.result.history_references_appended.length, 0);
assert.equal(replayRevision.result.state_transitions.length, 0);
assert.equal(replayRevision.result.already_persisted_revision_event_ids.length, 2);
assert.deepEqual(
  replayRevision.result.preview_world_state,
  unopposedExecution.world_state,
);

// 6. One unambiguous supersession yields an adopt event for the new source and
// a supersede event for the prior target. Neither historical claim nor relation
// is rewritten.
const singleSupersessionBuild = executeRelationProjection(
  worldStateWithClaims,
  currentTurnId,
  [
    {
      proposal_ref: "phase66a-single-supersession",
      character,
      source_claim_event_id: currentClaimA.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
  ],
);
const singleSupersessionInputSnapshot = structuredClone(
  singleSupersessionBuild.world_state,
);
const singleSupersessionResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: singleSupersessionBuild.world_state,
  turn_id: currentTurnId,
});
assert.deepEqual(
  singleSupersessionResolution.result.decisions.map((decision) => decision.action),
  ["adopt", "adopt", "supersede"],
  "the unrelated second current-turn claim remains independently adoptable",
);
const singleSupersessionRevision = buildRevision(
  singleSupersessionBuild.world_state,
  currentTurnId,
  singleSupersessionResolution,
);
assert.equal(singleSupersessionRevision.result.revision_events_created.length, 3);
const supersedeEvent = singleSupersessionRevision.result.revision_events_created.find(
  (event) => event.resolution_action === "supersede",
);
const sourceAdoptionEvent = singleSupersessionRevision.result.revision_events_created.find(
  (event) =>
    event.resolution_action === "adopt"
    && event.adopted_claim_event_ids.includes(currentClaimA.claim_event_id),
);
assert.ok(supersedeEvent);
assert.ok(sourceAdoptionEvent);
assert.deepEqual(
  supersedeEvent.superseded_claim_event_ids,
  [priorClaim.claim_event_id],
);
assert.equal(supersedeEvent.relation_references.length, 1);
assert.equal(
  supersedeEvent.relation_references[0].relation,
  "supersedes",
);
assert.equal(
  supersedeEvent.relation_references[0].target_claim_event_id,
  priorClaim.claim_event_id,
);
assert.deepEqual(
  singleSupersessionBuild.world_state,
  singleSupersessionInputSnapshot,
  "building Phase66A revision events must not rewrite claims or relations",
);

const singleSupersessionExecution = executeRevision(
  singleSupersessionBuild.world_state,
  currentTurnId,
  singleSupersessionRevision,
);
assert.deepEqual(
  singleSupersessionExecution.world_state.subjective_claim_events,
  singleSupersessionInputSnapshot.subjective_claim_events,
);
assert.deepEqual(
  singleSupersessionExecution.world_state.subjective_claim_relation_events,
  singleSupersessionInputSnapshot.subjective_claim_relation_events,
);

// 7. Competing superseders remain unresolved in Phase65D and therefore create
// no Phase66A revision event. No synthetic durable containers are introduced.
const competingBuild = executeRelationProjection(
  worldStateWithClaims,
  currentTurnId,
  [
    {
      proposal_ref: "phase66a-competing-a",
      character,
      source_claim_event_id: currentClaimA.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
    {
      proposal_ref: "phase66a-competing-b",
      character,
      source_claim_event_id: currentClaimB.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
  ],
);
const competingResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: competingBuild.world_state,
  turn_id: currentTurnId,
});
assert.deepEqual(
  competingResolution.result.decisions.map((decision) => decision.action),
  ["unresolved"],
);
const competingRevision = buildRevision(
  competingBuild.world_state,
  currentTurnId,
  competingResolution,
);
assert.equal(competingRevision.result.actionable_resolution_decision_count, 0);
assert.equal(competingRevision.result.unresolved_resolution_decision_count, 1);
assert.equal(competingRevision.result.revision_events_created.length, 0);
assert.equal(competingRevision.result.state_transitions.length, 0);
assert.equal(
  Object.hasOwn(
    competingRevision.result.preview_world_state,
    "subjective_belief_revision_events",
  ),
  false,
);
assert.equal(
  Object.hasOwn(
    competingRevision.result.preview_world_state,
    "subjective_belief_revision_history",
  ),
  false,
);

// 8/9. Source decisions and source claims are independently hash-verified at
// the Phase66A boundary.
const tamperedDecisionResolution = structuredClone(unopposedResolution);
tamperedDecisionResolution.result.decisions[0].reason = "tampered";
assert.throws(
  () => buildRevision(
    worldStateWithClaims,
    currentTurnId,
    tamperedDecisionResolution,
  ),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_HASH_MISMATCH",
);

const tamperedClaimState = structuredClone(worldStateWithClaims);
tamperedClaimState.subjective_claim_events[
  currentClaimA.claim_event_id
].proposition = "tampered proposition";
assert.throws(
  () => buildRevision(
    tamperedClaimState,
    currentTurnId,
    unopposedResolution,
  ),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CLAIM_HASH_MISMATCH",
);

// 10. Phase62K rejects overwrite of an already committed revision event.
const committedRevisionState = unopposedExecution.world_state;
const committedEventId = firstAdoption.belief_revision_event_id;
const committedEvent = committedRevisionState.subjective_belief_revision_events[
  committedEventId
];
const forgedOverwrite = structuredClone(committedEvent);
forgedOverwrite.resolution_reason = "attempted overwrite";
const forgedBody = structuredClone(forgedOverwrite);
delete forgedBody.belief_revision_event_hash;
forgedOverwrite.belief_revision_event_hash = hashAgentRunValue(forgedBody);
const overwriteQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${currentTurnId}:subjective_belief_revision`,
  world_state_hash: hashAgentRunValue(committedRevisionState),
  state_transitions: [
    {
      entity: "world",
      field: `subjective_belief_revision_events.${committedEventId}`,
      from: structuredClone(committedEvent),
      to: forgedOverwrite,
      cause: "forbidden overwrite fixture",
      source_layer: "subjective_belief_revision",
    },
  ],
  elapsed_ms: 0,
});
const overwritePreview = structuredClone(committedRevisionState);
overwritePreview.subjective_belief_revision_events[committedEventId] =
  structuredClone(forgedOverwrite);
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: committedRevisionState,
    preview_world_state: overwritePreview,
    queue: overwriteQueue,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_IMMUTABILITY_VIOLATION",
);

// 11. Existing history cannot be truncated or reordered.
const truncatedHistory = committedRevisionState.subjective_belief_revision_history
  .slice(0, 1);
const truncateQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${currentTurnId}:subjective_belief_revision`,
  world_state_hash: hashAgentRunValue(committedRevisionState),
  state_transitions: [
    {
      entity: "world",
      field: "subjective_belief_revision_history",
      from: structuredClone(
        committedRevisionState.subjective_belief_revision_history,
      ),
      to: truncatedHistory,
      cause: "forbidden history truncation fixture",
      source_layer: "subjective_belief_revision",
    },
  ],
  elapsed_ms: 0,
});
const truncatePreview = structuredClone(committedRevisionState);
truncatePreview.subjective_belief_revision_history = truncatedHistory;
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: committedRevisionState,
    preview_world_state: truncatePreview,
    queue: truncateQueue,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_APPEND_ONLY_VIOLATION",
);

// 12. A legitimate Phase66A event cannot be executed by an unrelated queue.
const wrongTurnQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${currentTurnId}:wrong_revision_queue`,
  world_state_hash: hashAgentRunValue(worldStateWithClaims),
  state_transitions: unopposedRevision.result.state_transitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: worldStateWithClaims,
    preview_world_state: unopposedRevision.result.preview_world_state,
    queue: wrongTurnQueue,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_QUEUE_TURN_MISMATCH",
);

// 13/14. No numerical truth confidence is invented, and identical evidence
// deterministically rebuilds identical event identities and transitions.
for (const event of singleSupersessionRevision.result.revision_events_created) {
  assert.equal(event.semantic_state.world_truth_verified, false);
  assert.equal(event.semantic_state.confidence, null);
  assert.equal(event.semantic_state.probability, null);
  assert.equal(event.engine_audit.world_truth_authority_claimed, false);
  assert.equal(event.engine_audit.confidence_probability_modeled, false);
}
const deterministicRevisionReplay = buildRevision(
  singleSupersessionBuild.world_state,
  currentTurnId,
  singleSupersessionResolution,
);
assert.deepEqual(
  deterministicRevisionReplay,
  singleSupersessionRevision,
);

// 15. Native wiring: Phase66A lives after Phase65D and before atomic commit,
// uses Phase62K for its final state, persists its evidence in history, and does
// not install Phase66B effective-belief projection or same-turn Brain exposure.
const loopSource = await readFile(
  new URL(
    "../../server/src/world-simulation-loop-service.mjs",
    import.meta.url,
  ),
  "utf8",
);
const stateSource = await readFile(
  new URL(
    "../../server/src/world-simulation-state-service.mjs",
    import.meta.url,
  ),
  "utf8",
);

for (const anchor of [
  "buildWorldSimulationSubjectiveBeliefRevisionContract",
  "const subjectiveBeliefRevision =",
  "buildWorldSimulationSubjectiveBeliefRevisions({",
  "const subjectiveBeliefRevisionMutationQueue =",
  "const subjectiveBeliefRevisionMutationExecution =",
  "subjective_belief_revision_projection:",
  "subjective_belief_revision_mutation_queue:",
  "subjective_belief_revision_mutation_execution:",
]) {
  assert.ok(loopSource.includes(anchor), `native loop must contain ${anchor}`);
}
for (const anchor of [
  "subjective_belief_revision_projection:",
  "subjective_belief_revision_mutation_queue:",
  "subjective_belief_revision_mutation_execution:",
]) {
  assert.ok(stateSource.includes(anchor), `world history must contain ${anchor}`);
}

const resolutionIndex = loopSource.indexOf(
  "const subjectiveBeliefResolution =",
);
const revisionIndex = loopSource.indexOf(
  "const subjectiveBeliefRevision =",
);
const revisionExecutionIndex = loopSource.indexOf(
  "const subjectiveBeliefRevisionMutationExecution =",
);
const commitIndex = loopSource.indexOf(
  "const committed = await commitWorldSimulationTurn",
);
assert.ok(resolutionIndex >= 0);
assert.ok(revisionIndex > resolutionIndex);
assert.ok(revisionExecutionIndex > revisionIndex);
assert.ok(commitIndex > revisionExecutionIndex);
assert.ok(
  loopSource.includes(
    "next_world_state: goalAdjustmentMutationExecution.next_world_state",
  ),
  "Phase66A final state must still come from the authoritative Phase62K executor",
);
assert.equal(
  loopSource.includes("effective_subjective_beliefs ="),
  false,
  "Phase66A must not sneak in Phase66B effective-belief state",
);

console.log("Phase66A append-only subjective belief revision event tests passed.");
