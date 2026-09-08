import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  subjectiveClaimEventSchemaVersion,
} from "./world-simulation-subjective-claim-projection-service.mjs";
import {
  projectWorldSimulationEffectiveSubjectiveBeliefs,
} from "./world-simulation-effective-subjective-belief-projection-service.mjs";
import {
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
} from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  buildWorldSimulationSubjectiveMeansFeasibilityInterpretationIdentity,
  buildWorldSimulationSubjectiveMeansFeasibilityMeansRef,
  worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
} from "./world-simulation-subjective-means-feasibility-interpretation-service.mjs";

export const worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion =
  "phase73c-subjective-means-feasibility-reconsideration-v1";
export const subjectiveMeansFeasibilityLinkageEventSchemaVersion =
  "phase73c-subjective-means-feasibility-linkage-event-v1";
export const subjectiveMeansFeasibilityLinkageHistoryReferenceSchemaVersion =
  "phase73c-subjective-means-feasibility-linkage-history-ref-v1";
export const subjectiveMeansFeasibilityReconsiderationTriggerProjectionVersion =
  "phase73c-subjective-means-feasibility-reconsideration-trigger-projection-v1";

const assessments = new Set([
  "perceived_feasible",
  "perceived_blocked",
  "uncertain",
]);
const maximumLinkagesPerTurn = 32;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) {
  return isObject(value) ? value : {};
}
function array(value) {
  return Array.isArray(value) ? value : [];
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_RECONSIDERATION_INPUT_INVALID";
  throw error;
}
function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return Boolean(characterKey(left)) && characterKey(left) === characterKey(right);
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function hashWithout(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function linkageEventHash(event) {
  return hashWithout(event, "linkage_event_hash");
}
function claimEventHash(event) {
  return hashWithout(event, "claim_event_hash");
}
function findCharacterRecords(container, character) {
  const entry = Object.entries(object(container))
    .find(([name]) => sameCharacter(name, character));
  return object(entry?.[1]);
}
function canonicalSourceMemoryRefs(decision) {
  return [...new Set(array(decision?.source_memory_refs).map(String))]
    .filter(Boolean)
    .sort(compareText);
}
function canonicalInterpretationIdentity(decision) {
  return buildWorldSimulationSubjectiveMeansFeasibilityInterpretationIdentity({
    turn_id: decision?.turn_id,
    character: decision?.character,
    target_means_ref: decision?.target_means_ref,
    assessment: decision?.assessment,
    proposition: decision?.proposition,
    source_memory_refs: decision?.source_memory_refs,
    grounding_refs: decision?.grounding_refs,
  });
}
function canonicalClaim(worldState, decision) {
  const candidates = Object.values(object(worldState.subjective_claim_events))
    .filter((claim) =>
      claim?.schema_version === subjectiveClaimEventSchemaVersion
      && claim?.immutable === true
      && sameCharacter(claim?.character, decision.character)
      && claim?.source_turn_id === decision.turn_id
      && claim?.derivation?.proposal_ref === decision.interpretation_ref);
  if (candidates.length !== 1) {
    const error = new Error(
      `Phase73C requires exactly one canonical Phase65 claim for interpretation ${decision.interpretation_ref}.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_CLAIM_UNRESOLVED";
    throw error;
  }
  const claim = candidates[0];
  if (!optionalString(claim.claim_event_id)
      || !optionalString(claim.claim_event_hash)
      || claimEventHash(claim) !== claim.claim_event_hash
      || claim.status !== "candidate_subjective_claim"
      || claim.proposition !== decision.proposition
      || claim.semantic_state?.world_truth_verified !== false
      || claim.engine_audit?.world_truth_authority_claimed !== false) {
    const error = new Error(
      `Phase73C source claim ${claim.claim_event_id ?? "<missing>"} is not canonical.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_CLAIM_INVALID";
    throw error;
  }
  const evidenceRefs = array(claim.evidence)
    .filter((entry) => entry?.relation === "supports")
    .map((entry) => String(entry?.source_memory_ref ?? ""))
    .filter(Boolean)
    .sort(compareText);
  if (!sameValue(evidenceRefs, canonicalSourceMemoryRefs(decision))) {
    const error = new Error(
      `Phase73C claim ${claim.claim_event_id} does not preserve the exact Phase73B memory evidence set.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_CLAIM_EVIDENCE_MISMATCH";
    throw error;
  }
  const referenced = array(worldState.subjective_claim_history).some((ref) =>
    ref?.claim_event_id === claim.claim_event_id
    && ref?.claim_event_hash === claim.claim_event_hash
    && sameCharacter(ref?.character, claim.character)
    && ref?.source_turn_id === claim.source_turn_id);
  if (!referenced) {
    const error = new Error(
      `Phase73C claim ${claim.claim_event_id} is not referenced by canonical Phase65 history.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_CLAIM_UNREFERENCED";
    throw error;
  }
  return claim;
}
function canonicalTargetPlan(worldState, decision) {
  const projection = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
    world_state: worldState,
  });
  const plans = findCharacterRecords(projection.plans_by_character, decision.character);
  const plan = plans[decision.implementation_intention_id];
  if (!plan
      || plan.goal_id !== decision.goal_id
      || !["active", "challenged", "suspended"].includes(plan.state)
      || plan.completed === true) {
    const error = new Error(
      `Phase73C target means ${decision.implementation_intention_id ?? "<missing>"} is not a canonical represented plan.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_TARGET_INVALID";
    throw error;
  }
  const expectedMeansRef = buildWorldSimulationSubjectiveMeansFeasibilityMeansRef(
    decision.character,
    plan,
  );
  if (expectedMeansRef !== decision.target_means_ref) {
    const error = new Error(
      `Phase73C target means ref ${decision.target_means_ref} does not match the canonical represented plan.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_TARGET_HASH_MISMATCH";
    throw error;
  }
  return plan;
}
function validateInterpretationDecision(worldState, raw, turnId) {
  const decision = cloneJson(object(raw));
  if (decision.version !== worldSimulationSubjectiveMeansFeasibilityInterpretationVersion
      || decision.turn_id !== turnId
      || !optionalString(decision.character)
      || !optionalString(decision.target_means_ref)
      || !assessments.has(decision.assessment)
      || !optionalString(decision.proposition)
      || !Array.isArray(decision.source_memory_refs)
      || !Array.isArray(decision.grounding_refs)
      || !optionalString(decision.interpretation_ref)
      || !optionalString(decision.goal_id)
      || !optionalString(decision.implementation_intention_id)) {
    const error = new Error("Phase73C requires a canonical normalized Phase73B interpretation decision.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_INTERPRETATION_INVALID";
    throw error;
  }
  const identity = canonicalInterpretationIdentity(decision);
  if (identity.interpretation_ref !== decision.interpretation_ref
      || !sameValue(identity.source_memory_refs, decision.source_memory_refs)
      || !sameValue(identity.grounding_refs, decision.grounding_refs)) {
    const error = new Error(
      `Phase73C interpretation ${decision.interpretation_ref} failed deterministic Phase73B identity verification.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_INTERPRETATION_HASH_MISMATCH";
    throw error;
  }
  canonicalTargetPlan(worldState, decision);
  const claim = canonicalClaim(worldState, decision);
  return { decision, claim };
}
function historyState(worldState) {
  const events = object(worldState.subjective_means_feasibility_linkage_events);
  const history = array(worldState.subjective_means_feasibility_linkage_history);
  const latestByCharacter = new Map();
  const seenIds = new Set();
  const seenInterpretations = new Set();
  for (const [index, ref] of history.entries()) {
    const event = object(events[ref?.linkage_event_id]);
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    const claim = object(object(worldState.subjective_claim_events)[event.claim_event_id]);
    if (!isObject(ref)
        || ref.schema_version !== subjectiveMeansFeasibilityLinkageHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.linkage_event_id)
        || seenIds.has(ref.linkage_event_id)
        || seenInterpretations.has(ref.interpretation_ref)
        || !Object.keys(event).length
        || event.schema_version !== subjectiveMeansFeasibilityLinkageEventSchemaVersion
        || event.version !== worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion
        || event.immutable !== true
        || event.linkage_event_id !== ref.linkage_event_id
        || linkageEventHash(event) !== event.linkage_event_hash
        || ref.linkage_event_hash !== event.linkage_event_hash
        || ref.interpretation_ref !== event.interpretation_ref
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.goal_id !== event.goal_id
        || ref.implementation_intention_id !== event.implementation_intention_id
        || ref.assessment !== event.assessment
        || ref.claim_event_id !== event.claim_event_id
        || ref.previous_linkage_event_id !== event.previous_linkage_event_id
        || ref.previous_linkage_event_hash !== event.previous_linkage_event_hash
        || event.previous_linkage_event_id !== (previous?.linkage_event_id ?? null)
        || event.previous_linkage_event_hash !== (previous?.linkage_event_hash ?? null)
        || !Object.keys(claim).length
        || claim.claim_event_hash !== event.claim_event_hash
        || claimEventHash(claim) !== claim.claim_event_hash
        || claim.derivation?.proposal_ref !== event.interpretation_ref
        || claim.proposition_hash !== event.proposition_hash
        || !sameCharacter(claim.character, event.character)
        || claim.source_turn_id !== event.source_turn_id
        || event.phase73b_interpretation_identity_verified !== true
        || event.phase65_claim_hash_pinned !== true
        || event.phase66_belief_authority_preserved !== true
        || event.subjective_not_world_truth !== true
        || event.world_truth_verified !== false
        || event.objective_feasibility_verified !== false
        || event.direct_belief_write !== false
        || event.direct_plan_mutation !== false
        || event.direct_goal_mutation !== false
        || event.same_turn_replanning_allowed !== false
        || event.status !== "subjective_means_feasibility_linkage_recorded") {
      const error = new Error(
        `Phase73C linkage history reference at index ${index} is invalid.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_HISTORY_INVALID";
      throw error;
    }
    latestByCharacter.set(key, event);
    seenIds.add(event.linkage_event_id);
    seenInterpretations.add(event.interpretation_ref);
  }
  return { events, history, latestByCharacter, seenIds, seenInterpretations };
}
function linkageEventFor(decision, claim, previous) {
  const base = {
    schema_version: subjectiveMeansFeasibilityLinkageEventSchemaVersion,
    version: worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: decision.turn_id,
    operation: "link_subjective_means_interpretation",
    interpretation_ref: decision.interpretation_ref,
    assessment: decision.assessment,
    target_means_ref: decision.target_means_ref,
    goal_id: decision.goal_id,
    implementation_intention_id: decision.implementation_intention_id,
    claim_event_id: claim.claim_event_id,
    claim_event_hash: claim.claim_event_hash,
    proposition_hash: claim.proposition_hash,
    source_memory_refs: canonicalSourceMemoryRefs(decision),
    previous_linkage_event_id: previous?.linkage_event_id ?? null,
    previous_linkage_event_hash: previous?.linkage_event_hash ?? null,
    phase73b_interpretation_identity_verified: true,
    phase65_claim_hash_pinned: true,
    phase66_belief_authority_preserved: true,
    subjective_not_world_truth: true,
    world_truth_verified: false,
    objective_feasibility_verified: false,
    direct_belief_write: false,
    direct_plan_mutation: false,
    direct_goal_mutation: false,
    same_turn_replanning_allowed: false,
    status: "subjective_means_feasibility_linkage_recorded",
  };
  const eventId = `subjective_means_feasibility_linkage_${hashAgentRunValue({
    version: worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
    character: characterKey(decision.character),
    source_turn_id: decision.turn_id,
    interpretation_ref: decision.interpretation_ref,
    claim_event_hash: claim.claim_event_hash,
    previous_linkage_event_hash: previous?.linkage_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, linkage_event_id: eventId };
  event.linkage_event_hash = linkageEventHash(event);
  return event;
}
function historyRefFor(event) {
  return {
    schema_version: subjectiveMeansFeasibilityLinkageHistoryReferenceSchemaVersion,
    derived_index: true,
    linkage_event_id: event.linkage_event_id,
    linkage_event_hash: event.linkage_event_hash,
    interpretation_ref: event.interpretation_ref,
    character: event.character,
    source_turn_id: event.source_turn_id,
    goal_id: event.goal_id,
    implementation_intention_id: event.implementation_intention_id,
    assessment: event.assessment,
    claim_event_id: event.claim_event_id,
    previous_linkage_event_id: event.previous_linkage_event_id,
    previous_linkage_event_hash: event.previous_linkage_event_hash,
    status: event.status,
  };
}
function authoritativeContext(turnId, decisions) {
  const context = {
    version: worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
    turn_id: turnId,
    phase73b_version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    interpretation_decisions: decisions.map(cloneJson),
    phase73b_interpretation_identity_recomputed: true,
    phase65_claim_membership_and_hash_verified: true,
    phase66_belief_authority_preserved: true,
    raw_world_state_exposed_to_interpreter: false,
    same_turn_replanning_allowed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return context;
}

export function buildWorldSimulationSubjectiveMeansFeasibilityLinkages(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const rawDecisions = array(input.interpretation_decisions);
  if (rawDecisions.length > maximumLinkagesPerTurn) {
    const error = new Error(`Phase73C allows at most ${maximumLinkagesPerTurn} linkage events per turn.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_TURN_LIMIT";
    throw error;
  }
  const canonical = rawDecisions.map((raw) => validateInterpretationDecision(worldState, raw, turnId));
  const replay = historyState(worldState);
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(replay.latestByCharacter);
  const seenInterpretations = new Set(replay.seenInterpretations);
  const created = [];
  const refs = [];
  const transitions = [];
  for (const { decision, claim } of canonical) {
    if (seenInterpretations.has(decision.interpretation_ref)) {
      const error = new Error(`Phase73C interpretation ${decision.interpretation_ref} is already linked.`);
      error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_DUPLICATE_INTERPRETATION";
      throw error;
    }
    const key = characterKey(decision.character);
    const event = linkageEventFor(decision, claim, latestByCharacter.get(key) ?? null);
    preview.subjective_means_feasibility_linkage_events = object(
      preview.subjective_means_feasibility_linkage_events,
    );
    if (preview.subjective_means_feasibility_linkage_events[event.linkage_event_id]) {
      const error = new Error(`Phase73C linkage ${event.linkage_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.subjective_means_feasibility_linkage_events[event.linkage_event_id] = cloneJson(event);
    const ref = historyRefFor(event);
    created.push(event);
    refs.push(ref);
    latestByCharacter.set(key, event);
    seenInterpretations.add(event.interpretation_ref);
    transitions.push({
      entity: "world",
      field: `subjective_means_feasibility_linkage_events.${event.linkage_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable Phase73C subjective-means semantic linkage ${event.linkage_event_id}`,
      source_layer: "subjective_means_feasibility_reconsideration",
    });
  }
  if (refs.length) {
    const nextHistory = [...replay.history.map(cloneJson), ...refs.map(cloneJson)];
    preview.subjective_means_feasibility_linkage_history = nextHistory;
    transitions.push({
      entity: "world",
      field: "subjective_means_feasibility_linkage_history",
      from: cloneJson(worldState.subjective_means_feasibility_linkage_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${refs.length} Phase73C subjective-means linkage history reference(s)`,
      source_layer: "subjective_means_feasibility_reconsideration",
    });
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
    result: {
      linkage_event_count: created.length,
      linkage_events_created: created,
      history_references_appended: refs,
      state_transitions: transitions,
      preview_world_state: preview,
      authoritative_validation_context: authoritativeContext(
        turnId,
        canonical.map(({ decision }) => decision),
      ),
      audit: {
        semantic_linkage_only: true,
        parallel_belief_store_created: false,
        phase66_belief_authority_preserved: true,
        objective_feasibility_verified: false,
        direct_plan_or_goal_mutation: false,
        same_turn_replanning_allowed: false,
      },
    },
  });
}

function priorCommittedBeliefWorld(worldState, excludedTurnId) {
  if (!excludedTurnId) return cloneJson(worldState);
  const history = array(worldState.subjective_belief_revision_history);
  let firstExcluded = -1;
  for (let index = 0; index < history.length; index += 1) {
    if (history[index]?.source_turn_id === excludedTurnId) {
      firstExcluded = index;
      break;
    }
  }
  if (firstExcluded < 0) return cloneJson(worldState);
  if (history.slice(firstExcluded).some((ref) => ref?.source_turn_id !== excludedTurnId)) {
    const error = new Error(
      `Phase73C excluded turn ${excludedTurnId} is not a trailing belief-revision segment.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_RECONSIDERATION_NONTRAILING_EXCLUSION";
    throw error;
  }
  const prior = cloneJson(worldState);
  prior.subjective_belief_revision_history = history.slice(0, firstExcluded).map(cloneJson);
  return prior;
}
function activeBeliefByClaim(worldState, character, excludedTurnId) {
  const prior = priorCommittedBeliefWorld(worldState, excludedTurnId);
  const projection = projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: prior,
    character,
  });
  return new Map(array(projection?.projection?.active_beliefs)
    .map((belief) => [belief.claim_event_id, belief]));
}
function triggerRefFor(body) {
  const hash = hashAgentRunValue({
    version: subjectiveMeansFeasibilityReconsiderationTriggerProjectionVersion,
    trigger: body,
  });
  return {
    ...body,
    trigger_ref: `phase73c_reconsideration_${hash.slice(0, 24)}`,
    trigger_hash: hash,
  };
}

export function projectWorldSimulationSubjectiveMeansReconsiderationTriggers(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const excludedTurnId = optionalString(input.excluded_turn_id ?? input.current_turn_id);
  const replay = historyState(worldState);
  const eligibleEvents = replay.history
    .map((ref) => replay.events[ref.linkage_event_id])
    .filter((event) => event?.source_turn_id !== excludedTurnId);
  const characters = [...new Set(eligibleEvents.map((event) => event.character))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-Hant-TW"));
  const activeByCharacter = new Map();
  for (const character of characters) {
    activeByCharacter.set(
      characterKey(character),
      activeBeliefByClaim(worldState, character, excludedTurnId),
    );
  }
  const groups = new Map();
  for (const event of eligibleEvents) {
    const active = activeByCharacter.get(characterKey(event.character));
    const belief = active?.get(event.claim_event_id);
    if (!belief || belief.claim_event_hash !== event.claim_event_hash) continue;
    const key = `${characterKey(event.character)}\u0000${event.goal_id}\u0000${event.implementation_intention_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ event, belief });
  }
  const triggers = [];
  let ambiguousGroupCount = 0;
  for (const values of groups.values()) {
    const assessmentSet = new Set(values.map(({ event }) => event.assessment));
    if (!assessmentSet.has("perceived_blocked")) continue;
    if (assessmentSet.has("perceived_feasible") || assessmentSet.has("uncertain")) {
      ambiguousGroupCount += 1;
      continue;
    }
    const first = values[0].event;
    const linkageRefs = values
      .filter(({ event }) => event.assessment === "perceived_blocked")
      .map(({ event, belief }) => ({
        linkage_event_id: event.linkage_event_id,
        linkage_event_hash: event.linkage_event_hash,
        interpretation_ref: event.interpretation_ref,
        claim_event_id: event.claim_event_id,
        claim_event_hash: event.claim_event_hash,
        latest_belief_revision_event_id: belief.latest_revision_event_id,
        latest_belief_revision_event_hash: belief.latest_revision_event_hash,
        source_turn_id: event.source_turn_id,
      }))
      .sort((left, right) => compareText(left.linkage_event_id, right.linkage_event_id));
    triggers.push(triggerRefFor({
      trigger_kind: "committed_subjective_means_block",
      character: first.character,
      goal_id: first.goal_id,
      source_implementation_intention_id: first.implementation_intention_id,
      active_blocked_linkage_refs: linkageRefs,
      assessment: "perceived_blocked",
      prior_committed_only: true,
      ambiguous_active_assessment: false,
      subjective_not_world_truth: true,
      objective_feasibility_verified: false,
    }));
  }
  triggers.sort((left, right) => compareText(characterKey(left.character), characterKey(right.character))
    || compareText(left.goal_id, right.goal_id)
    || compareText(left.source_implementation_intention_id, right.source_implementation_intention_id));
  return deepFreeze({
    version: subjectiveMeansFeasibilityReconsiderationTriggerProjectionVersion,
    triggers,
    projection_hash: hashAgentRunValue({
      version: subjectiveMeansFeasibilityReconsiderationTriggerProjectionVersion,
      excluded_turn_id: excludedTurnId,
      triggers,
    }),
    audit: {
      excluded_turn_id: excludedTurnId,
      linkage_event_count: eligibleEvents.length,
      trigger_count: triggers.length,
      ambiguous_active_assessment_group_count: ambiguousGroupCount,
      perceived_blocked_required: true,
      uncertain_alone_sufficient: false,
      perceived_feasible_sufficient: false,
      active_phase66_belief_required: true,
      same_turn_feedback_allowed: false,
      subjective_not_world_truth: true,
      objective_feasibility_verified: false,
      persistent_trigger_written: false,
    },
  });
}

export function buildWorldSimulationSubjectiveMeansFeasibilityReconsiderationContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
    phase: "Phase73C",
    status: "belief_grounded_later_turn_means_reconsideration_installed",
    semantic_linkage_store_only: true,
    parallel_belief_store_created: false,
    phase73b_interpretation_identity_hash_verified: true,
    phase65_claim_hash_and_history_membership_verified: true,
    phase66_active_belief_required_for_trigger: true,
    perceived_blocked_may_trigger_reconsideration: true,
    uncertain_auto_triggers_reconsideration: false,
    perceived_feasible_auto_triggers_reconsideration: false,
    conflicting_active_assessments_fail_closed: true,
    same_turn_feedback_allowed: false,
    prior_committed_only: true,
    direct_plan_mutation_allowed: false,
    direct_goal_mutation_allowed: false,
    phase71_owns_alternative_means_replanning: true,
    phase69b_owns_plan_lifecycle_revision: true,
    phase72_owns_objective_replacement_feasibility: true,
    world_truth_authority_claimed: false,
    objective_feasibility_verified: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
  });
}
