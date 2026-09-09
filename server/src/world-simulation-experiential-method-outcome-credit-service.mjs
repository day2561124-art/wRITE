import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationSelectedExperientialMethodApplicationReceiptBundle,
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "./world-simulation-experiential-method-application-lineage-service.mjs";
import {
  worldSimulationExperientialKnowledgeReentryVersion,
} from "./world-simulation-experiential-knowledge-reentry-service.mjs";
import {
  worldSimulationExperientialMethodTransferVersion,
} from "./world-simulation-experiential-method-transfer-service.mjs";
import {
  worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
} from "./world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import {
  subjectiveEpisodeSegmentationEventSchemaVersion,
  worldSimulationSubjectiveEpisodeSegmentationVersion,
} from "./world-simulation-subjective-episode-segmentation-service.mjs";
import {
  autobiographicalLifeEventOrganizationEventSchemaVersion,
  worldSimulationAutobiographicalLifeEventVersion,
} from "./world-simulation-autobiographical-life-event-service.mjs";
import {
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";

export const worldSimulationExperientialMethodOutcomeCreditVersion =
  "phase76g-experiential-method-outcome-credit-v1";

const supportedAssessments = Object.freeze([
  "supports_prior_method",
  "counterevidence_for_prior_method",
  "ambiguous_no_revision",
]);
const maximumApplicationCount = 16;

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
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label, maxLength = 600, code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function characterKey(value) {
  return requiredString(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function memoryId(record) {
  return optionalString(record?.memory_id ?? record?.id);
}
function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
function eventHash(event, field) {
  const body = cloneJson(event);
  delete body[field];
  return hashAgentRunValue(body);
}

function verifyReentryProjection(value, turnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialKnowledgeReentryVersion
      || projection.current_turn_id !== turnId
      || !optionalString(projection.character)
      || !optionalString(projection.reentry_hash)
      || !Array.isArray(projection.activated_semantics)
      || !isObject(projection.character_view)
      || !Array.isArray(projection.character_view.experiential_knowledge)) {
    const error = new Error("Phase76G requires a canonical current-turn Phase76D re-entry projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76D_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.reentry_hash;
  if (hashAgentRunValue(body) !== projection.reentry_hash
      || projection.activated_semantics.length
        !== projection.character_view.experiential_knowledge.length) {
    const error = new Error("Phase76G Phase76D re-entry projection failed immutable verification.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76D_HASH_MISMATCH";
    throw error;
  }
  const audit = object(projection.audit);
  if (audit.committed_prior_turn_source_only !== true
      || audit.same_character_source_only !== true
      || audit.cue_dependent_selection !== true
      || audit.resolver_selected_opaque_refs_only !== true
      || audit.resolver_authored_semantic_content !== false
      || audit.source_life_event_lineage_exposed_to_character !== false
      || audit.semantic_identity_exposed_to_character !== false
      || audit.direct_belief_write !== false
      || audit.direct_current_mind_write !== false
      || audit.direct_plan_or_goal_mutation !== false
      || audit.direct_action_selection !== false
      || audit.parallel_memory_or_belief_store_created !== false
      || audit.world_truth_authority_claimed !== false) {
    const error = new Error("Phase76G rejects a Phase76D source that does not preserve the sealed authority boundaries.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76D_BOUNDARY_INVALID";
    throw error;
  }
  return projection;
}

function verifyTransferProjection(value, turnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodTransferVersion
      || projection.current_turn_id !== turnId
      || !optionalString(projection.character)
      || !optionalString(projection.source_phase76d_reentry_hash)
      || !optionalString(projection.transfer_hash)
      || !Array.isArray(projection.transferred_method_mappings)
      || !isObject(projection.character_view)
      || !Array.isArray(projection.character_view.transferred_methods)) {
    const error = new Error("Phase76G requires a canonical current-turn Phase76E transfer projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76E_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.transfer_hash;
  if (hashAgentRunValue(body) !== projection.transfer_hash
      || projection.transferred_method_mappings.length
        !== projection.character_view.transferred_methods.length) {
    const error = new Error("Phase76G Phase76E transfer projection failed immutable verification.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76E_HASH_MISMATCH";
    throw error;
  }
  const audit = object(projection.audit);
  if (audit.canonical_phase76d_source_verified !== true
      || audit.recurring_event_pattern_only !== true
      || audit.relational_structure_transfer_only !== true
      || audit.source_surface_case_replayed !== false
      || audit.exact_action_replay_allowed !== false
      || audit.resolver_authored_method_content !== false
      || audit.resolver_authored_action_content !== false
      || audit.current_context_grounding_required !== true
      || audit.objective_feasibility_verified !== false
      || audit.world_truth_authority_claimed !== false
      || audit.direct_action_selection !== false
      || audit.direct_plan_goal_mutation !== false
      || audit.direct_belief_write !== false
      || audit.direct_current_mind_write !== false
      || audit.direct_world_state_mutation !== false
      || audit.parallel_memory_belief_plan_store_created !== false) {
    const error = new Error("Phase76G rejects a Phase76E source that does not preserve the sealed authority boundaries.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76E_BOUNDARY_INVALID";
    throw error;
  }
  return projection;
}

function verifyBridge(value, turnId) {
  const bridge = cloneJson(value);
  if (!isObject(bridge)
      || bridge.version !== worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion
      || bridge.turn_id !== turnId
      || !optionalString(bridge.bridge_hash)
      || !Array.isArray(bridge.source_entries)) {
    const error = new Error("Phase76G requires a canonical current-turn Phase76B post-outcome memory bridge.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76B_INVALID";
    throw error;
  }
  const body = cloneJson(bridge);
  delete body.bridge_hash;
  if (hashAgentRunValue(body) !== bridge.bridge_hash) {
    const error = new Error("Phase76G Phase76B bridge hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76B_HASH_MISMATCH";
    throw error;
  }
  const boundaries = object(bridge.boundaries);
  if (boundaries.canonical_phase76a_projection_required !== true
      || boundaries.same_character_selected_action_required !== true
      || boundaries.raw_action_outcomes_consumed !== false
      || boundaries.raw_state_transitions_consumed !== false
      || boundaries.raw_world_state_consumed !== false
      || boundaries.objective_result_label_exposed !== false
      || boundaries.causal_evidence_exposed !== false
      || boundaries.exact_engine_geometry_exposed !== false
      || boundaries.other_character_private_state_exposed !== false
      || boundaries.direct_subjective_memory_write !== false
      || boundaries.direct_subjective_claim_or_belief_write !== false
      || boundaries.direct_current_mind_write !== false
      || boundaries.world_state_mutation_applied !== false
      || boundaries.same_turn_character_brain_feedback_allowed !== false) {
    const error = new Error("Phase76G rejects a Phase76B bridge that does not preserve the sealed subjective-outcome boundary.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76B_BOUNDARY_INVALID";
    throw error;
  }
  return bridge;
}

function semanticSkeleton(knowledge) {
  const descriptor = object(knowledge?.semantic_descriptor);
  return {
    relation: requiredString(
      descriptor.predicate,
      "semantic_descriptor.predicate",
      160,
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_SEMANTIC_SOURCE_INVALID",
    ),
    method_ref: requiredString(
      descriptor.object_ref,
      "semantic_descriptor.object_ref",
      320,
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_SEMANTIC_SOURCE_INVALID",
    ),
    qualifiers: array(descriptor.qualifiers).map((item) =>
      requiredString(
        item,
        "semantic_descriptor.qualifier",
        160,
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_SEMANTIC_SOURCE_INVALID",
      )).sort(compareText),
  };
}

function projectionForCharacter(values, character, turnId, verifier, label) {
  const matches = array(values)
    .map((item) => verifier(item, turnId))
    .filter((item) => sameCharacter(item.character, character));
  if (matches.length !== 1) {
    const error = new Error(`Phase76G requires exactly one same-character ${label} projection.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_SOURCE_CARDINALITY_INVALID";
    throw error;
  }
  return matches[0];
}

function sourceSemanticForTransfer(reentry, transfer, transferRef) {
  if (transfer.source_phase76d_reentry_hash !== reentry.reentry_hash) {
    const error = new Error("Phase76G Phase76E transfer does not pin the supplied Phase76D re-entry projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_TRANSFER_REENTRY_MISMATCH";
    throw error;
  }
  const mapping = array(transfer.transferred_method_mappings)
    .find((item) => item?.transfer_ref === transferRef);
  if (!isObject(mapping)
      || !Number.isInteger(mapping.transfer_index)
      || mapping.transfer_index < 0
      || mapping.transfer_index >= transfer.character_view.transferred_methods.length) {
    const error = new Error(`Phase76G cannot resolve applied method ${transferRef} in its canonical Phase76E source.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_METHOD_UNRESOLVED";
    throw error;
  }
  const guidance = object(transfer.character_view.transferred_methods[mapping.transfer_index]);
  const skeleton = cloneJson(guidance.method_skeleton);
  if (!isObject(skeleton)
      || hashAgentRunValue(skeleton) !== mapping.method_skeleton_hash
      || guidance.source_knowledge_status !== mapping.source_knowledge_status) {
    const error = new Error("Phase76G Phase76E method guidance does not match its internal mapping.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_METHOD_LINEAGE_MISMATCH";
    throw error;
  }
  const matches = [];
  for (let index = 0; index < reentry.activated_semantics.length; index += 1) {
    const activated = object(reentry.activated_semantics[index]);
    const knowledge = object(reentry.character_view.experiential_knowledge[index]);
    if (activated.semantic_category !== "recurring_event_pattern"
        || knowledge.semantic_category !== "recurring_event_pattern") continue;
    const candidateSkeleton = semanticSkeleton(knowledge);
    if (hashAgentRunValue(candidateSkeleton) !== mapping.method_skeleton_hash) continue;
    if (activated.knowledge_status !== mapping.source_knowledge_status
        || knowledge.knowledge_status !== mapping.source_knowledge_status
        || hashAgentRunValue(knowledge.semantic_descriptor) !== activated.semantic_descriptor_hash) continue;
    matches.push({
      semantic_ref: requiredString(
        activated.semantic_ref,
        "activated semantic_ref",
        240,
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_SEMANTIC_SOURCE_INVALID",
      ),
      semantic_category: activated.semantic_category,
      semantic_key: requiredString(
        activated.semantic_key,
        "activated semantic_key",
        240,
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_SEMANTIC_SOURCE_INVALID",
      ),
      semantic_descriptor: cloneJson(knowledge.semantic_descriptor),
      semantic_descriptor_hash: activated.semantic_descriptor_hash,
      source_knowledge_status: activated.knowledge_status,
      method_skeleton: skeleton,
    });
  }
  return {
    unique: matches.length === 1,
    matches,
    method_skeleton: skeleton,
    source_knowledge_status: mapping.source_knowledge_status,
  };
}

function canonicalPostOutcomeMemory(worldState, sourceMemoryRecords, bridge, receipt) {
  const bridgeEntries = array(bridge.source_entries).filter((entry) =>
    sameCharacter(entry?.character, receipt.character)
    && entry?.action_id === receipt.action_id);
  if (bridgeEntries.length !== 1) return null;
  const bridgeEntry = bridgeEntries[0];
  const matchingSources = array(sourceMemoryRecords).filter((source) => {
    if (!isObject(source?.memory_record) || !sameCharacter(source.character, receipt.character)) return false;
    const record = source.memory_record;
    return record.memory_type === "episodic_action_experience"
      && record.source?.kind === "post_outcome_subjective_experience"
      && record.internal_provenance?.turn_id === receipt.turn_id
      && record.internal_provenance?.post_outcome_bridge_version
        === worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion
      && record.internal_provenance?.post_outcome_subjective_perception_ref
        === bridgeEntry.subjective_perception_ref
      && record.internal_provenance?.post_outcome_subjective_perception_hash
        === bridgeEntry.subjective_perception_hash
      && record.content?.kind === "post_outcome_action_experience";
  });
  if (matchingSources.length !== 1) return null;
  const source = matchingSources[0];
  const id = memoryId(source.memory_record);
  if (!id) return null;
  const canonicalRecords = array(
    Object.entries(object(worldState.memories))
      .find(([name]) => sameCharacter(name, receipt.character))?.[1],
  );
  const canonical = canonicalRecords.find((record) => memoryId(record) === id);
  if (!isObject(canonical) || !sameValue(canonical, source.memory_record)) return null;
  const boundedExperience = {};
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(canonical.content ?? {}, key)) continue;
    const value = canonical.content[key];
    if (["string", "number", "boolean"].includes(typeof value)) boundedExperience[key] = cloneJson(value);
  }
  if (canonical.subjective_memory_not_world_truth !== true) return null;
  return {
    memory_id: id,
    memory_hash: hashAgentRunValue(canonical),
    bounded_experience: boundedExperience,
    subjective_memory_not_world_truth: true,
  };
}

function currentLifeEventForMemory(worldState, sourceOrganizationEventIds, turnId, character, memory) {
  if (!memory) return null;
  const segmentationMatches = Object.values(object(worldState.subjective_episode_segmentation_events))
    .filter((event) => isObject(event)
      && event.schema_version === subjectiveEpisodeSegmentationEventSchemaVersion
      && event.version === worldSimulationSubjectiveEpisodeSegmentationVersion
      && event.source_turn_id === turnId
      && sameCharacter(event.character, character)
      && event.subjective_not_world_truth === true
      && event.world_truth_verified === false
      && event.memory_content_copied === false
      && event.character_brain_direct_write === false
      && event.segmentation_event_hash
      && eventHash(event, "segmentation_event_hash") === event.segmentation_event_hash
      && array(event.source_memory_refs).some((ref) =>
        ref?.memory_id === memory.memory_id && ref?.memory_hash === memory.memory_hash));
  if (segmentationMatches.length !== 1) return null;
  const segmentation = segmentationMatches[0];
  const allowed = new Set(array(sourceOrganizationEventIds));
  const organizationMatches = Object.values(object(worldState.autobiographical_life_event_organization_events))
    .filter((event) => isObject(event)
      && allowed.has(event.organization_event_id)
      && event.schema_version === autobiographicalLifeEventOrganizationEventSchemaVersion
      && event.version === worldSimulationAutobiographicalLifeEventVersion
      && event.source_turn_id === turnId
      && sameCharacter(event.character, character)
      && event.subjective_not_world_truth === true
      && event.world_truth_verified === false
      && event.memory_content_copied === false
      && event.episode_content_copied === false
      && event.character_brain_direct_write === false
      && event.source_segmentation_event_id === segmentation.segmentation_event_id
      && event.source_segmentation_event_hash === segmentation.segmentation_event_hash
      && event.organization_event_hash
      && eventHash(event, "organization_event_hash") === event.organization_event_hash);
  if (organizationMatches.length !== 1) return null;
  const organization = organizationMatches[0];
  return {
    life_event_id: organization.life_event_id,
    organization_event_id: organization.organization_event_id,
    organization_event_hash: organization.organization_event_hash,
  };
}

function effectiveSemantic(worldState, character, semanticRef) {
  const projection = projectWorldSimulationEffectivePersonalSemanticMemories({ world_state: worldState });
  let characterMemories = object(projection.memories_by_character?.[character]);
  if (!Object.keys(characterMemories).length) {
    const wanted = characterKey(character);
    for (const [name, records] of Object.entries(projection.memories_by_character ?? {})) {
      if (characterKey(name) === wanted) {
        characterMemories = object(records);
        break;
      }
    }
  }
  return characterMemories[semanticRef] ?? null;
}

function buildApplicationContext(input, receipt, receiptIndex) {
  const turnId = input.turn_id;
  const reentry = projectionForCharacter(
    input.experiential_knowledge_reentry_projections,
    receipt.character,
    turnId,
    verifyReentryProjection,
    "Phase76D",
  );
  const transfer = projectionForCharacter(
    input.experiential_method_transfer_projections,
    receipt.character,
    turnId,
    verifyTransferProjection,
    "Phase76E",
  );
  if (transfer.transfer_hash !== receipt.source_phase76e_transfer_hash) {
    const error = new Error("Phase76G Phase76F application receipt does not pin the supplied Phase76E transfer projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_APPLICATION_TRANSFER_MISMATCH";
    throw error;
  }
  const multiMethod = receipt.applied_method_refs.length !== 1;
  const sourceResolution = multiMethod
    ? { unique: false, matches: [], method_skeleton: null, source_knowledge_status: null }
    : sourceSemanticForTransfer(reentry, transfer, receipt.applied_method_refs[0]);
  const source = sourceResolution.unique ? sourceResolution.matches[0] : null;
  const semantic = source
    ? effectiveSemantic(input.world_state, receipt.character, source.semantic_ref)
    : null;
  const semanticVerified = isObject(semantic)
    && semantic.semantic_memory_id === source?.semantic_ref
    && semantic.semantic_category === source?.semantic_category
    && semantic.semantic_key === source?.semantic_key
    && semantic.semantic_descriptor_hash === source?.semantic_descriptor_hash
    && sameValue(semantic.semantic_descriptor, source?.semantic_descriptor);
  const latestSemanticEvent = semanticVerified
    ? object(object(input.world_state.personal_semantic_derivation_events)[
      semantic.latest_derivation_event_id
    ])
    : {};
  const semanticAlreadyRevisedThisTurn = semanticVerified
    && latestSemanticEvent.source_turn_id === turnId;
  const memory = canonicalPostOutcomeMemory(
    input.world_state,
    input.source_memory_records,
    input.phase76b_memory_bridge,
    receipt,
  );
  const lifeEventRef = currentLifeEventForMemory(
    input.world_state,
    input.source_organization_event_ids,
    turnId,
    receipt.character,
    memory,
  );
  const performed = memory?.bounded_experience?.performed === true;
  const uniqueMethod = !multiMethod && sourceResolution.unique && semanticVerified;
  const assessmentEligible = Boolean(memory && uniqueMethod);
  const semanticRevisionEligible = Boolean(
    assessmentEligible
      && performed
      && lifeEventRef
      && !semanticAlreadyRevisedThisTurn,
  );
  const identity = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    receipt_index: receiptIndex,
    phase76f_application_receipt_id: receipt.receipt_id,
    phase76f_application_receipt_hash: receipt.receipt_hash,
    character: receipt.character,
    action_id: receipt.action_id,
  };
  const applicationRef = `phase76g_application_${hashAgentRunValue(identity).slice(0, 24)}`;
  return {
    public: {
      application_ref: applicationRef,
      character: receipt.character,
      action: { action_id: receipt.action_id },
      method_skeleton: cloneJson(sourceResolution.method_skeleton),
      source_knowledge_status: sourceResolution.source_knowledge_status,
      subjective_experience: cloneJson(memory?.bounded_experience ?? {}),
      assessment_eligible: assessmentEligible,
      semantic_revision_currently_eligible: semanticRevisionEligible,
      ambiguity_reasons: [
        ...(multiMethod ? ["multiple_methods_attributed_to_selected_candidate"] : []),
        ...(!multiMethod && !sourceResolution.unique ? ["source_method_semantic_not_uniquely_resolved"] : []),
        ...(!memory ? ["canonical_post_outcome_subjective_experience_unresolved"] : []),
        ...(memory && !performed ? ["selected_action_not_confirmed_performed_in_subjective_experience"] : []),
        ...(assessmentEligible && performed && !lifeEventRef
          ? ["current_life_event_provenance_unavailable_for_semantic_revision"]
          : []),
        ...(assessmentEligible && performed && lifeEventRef && semanticAlreadyRevisedThisTurn
          ? ["source_semantic_already_revised_this_turn"]
          : []),
      ],
      subjective_not_world_truth: true,
    },
    internal: {
      application_ref: applicationRef,
      phase76f_application_receipt_id: receipt.receipt_id,
      phase76f_application_receipt_hash: receipt.receipt_hash,
      character: receipt.character,
      action_id: receipt.action_id,
      source_semantic_ref: source?.semantic_ref ?? null,
      source_semantic_category: source?.semantic_category ?? null,
      source_semantic_key: source?.semantic_key ?? null,
      source_semantic_descriptor_hash: source?.semantic_descriptor_hash ?? null,
      current_life_event_ref: cloneJson(lifeEventRef),
      assessment_eligible: assessmentEligible,
      semantic_revision_currently_eligible: semanticRevisionEligible,
      semantic_already_revised_this_turn: semanticAlreadyRevisedThisTurn,
      performed,
    },
  };
}

export function buildWorldSimulationExperientialMethodOutcomeCreditContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    phase: "Phase76G",
    status: "bounded_experiential_method_outcome_credit_and_phase67c_revise_retain_bridge_installed",
    source_application_owner: "Phase76F",
    subjective_outcome_owner: "Phase76A_Phase76B_Phase63",
    durable_semantic_revision_owner: "Phase67C",
    supported_assessments: [...supportedAssessments],
    exact_phase76f_receipt_hash_required: true,
    exact_phase76d_phase76e_lineage_required: true,
    exact_phase76b_post_outcome_memory_lineage_required: true,
    exact_phase67a_phase67b_life_event_lineage_required_for_semantic_revision: true,
    single_applied_method_required_for_credit: true,
    multiple_applied_methods_are_ambiguous: true,
    performed_true_required_for_support_or_counterevidence: true,
    same_semantic_second_revision_in_same_turn_allowed: false,
    resolver_selects_application_ref_and_assessment_only: true,
    resolver_may_author_semantic_identity: false,
    resolver_may_author_outcome: false,
    resolver_may_author_numeric_credit: false,
    resolver_may_assert_world_truth: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    objective_causation_claimed: false,
    successful_action_auto_credits_method: false,
    failed_action_auto_discredits_method: false,
    numeric_reward_q_value_success_rate_modeled: false,
    ambiguous_assessment_may_persist_without_semantic_revision: true,
    semantic_revision_operations: ["support", "counterevidence"],
    second_phase67c_append_only_pass_reused: true,
    parallel_semantic_memory_store_created: false,
    direct_belief_plan_goal_current_mind_world_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
  });
}

export function buildWorldSimulationExperientialMethodOutcomeCreditResolverContext(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id", 240);
  const bridge = verifyBridge(input.phase76b_memory_bridge, turnId);
  const receiptBundle = assertWorldSimulationSelectedExperientialMethodApplicationReceiptBundle(
    input.selected_application_receipts,
    { turn_id: turnId },
  );
  if (receiptBundle.receipt_count > maximumApplicationCount) {
    const error = new Error(`Phase76G accepts at most ${maximumApplicationCount} selected method applications per turn.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_APPLICATION_LIMIT";
    throw error;
  }
  const normalizedInput = {
    world_state: worldState,
    turn_id: turnId,
    phase76b_memory_bridge: bridge,
    source_memory_records: cloneJson(array(input.source_memory_records)),
    source_organization_event_ids: cloneJson(array(input.source_organization_event_ids)),
    experiential_knowledge_reentry_projections:
      cloneJson(array(input.experiential_knowledge_reentry_projections)),
    experiential_method_transfer_projections:
      cloneJson(array(input.experiential_method_transfer_projections)),
  };
  const applications = receiptBundle.receipts.map((receipt, index) =>
    buildApplicationContext(normalizedInput, receipt, index));
  const resolverView = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    applications: applications.map((entry) => entry.public),
    supported_assessments: [...supportedAssessments],
    decision_contract: {
      output_shape: "array_of_application_ref_assessment_pairs",
      application_ref_must_be_from_applications: true,
      support_or_counterevidence_requires_assessment_eligible: true,
      support_or_counterevidence_requires_semantic_revision_currently_eligible: true,
      ambiguous_no_revision_always_allowed_for_visible_application: true,
      semantic_identity_authoring_allowed: false,
      operation_authoring_allowed: false,
      outcome_authoring_allowed: false,
      causal_credit_score_authoring_allowed: false,
      world_truth_authoring_allowed: false,
      confidence_probability_reward_utility_authoring_allowed: false,
    },
    boundaries: {
      selected_phase76f_applications_only: true,
      bounded_subjective_post_outcome_experience_only: true,
      raw_action_outcome_exposed: false,
      raw_state_transition_exposed: false,
      hidden_causal_evidence_exposed: false,
      source_semantic_identity_exposed: false,
      life_event_identity_exposed: false,
      internal_application_lineage_exposed: false,
      objective_causation_requested: false,
      numeric_credit_requested: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  const internalLineage = applications.map((entry) => entry.internal);
  const context = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    source_phase76f_receipt_bundle_hash: receiptBundle.receipt_bundle_hash,
    source_phase76b_bridge_hash: bridge.bridge_hash,
    resolver_view: resolverView,
    internal_lineage: internalLineage,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}

const allowedDecisionFields = new Set(["application_ref", "assessment"]);
const forbiddenDecisionFields = new Set([
  "semantic_memory_id",
  "semantic_ref",
  "semantic_key",
  "semantic_descriptor",
  "operation",
  "outcome",
  "result",
  "success",
  "failure",
  "world_truth",
  "causal_credit",
  "credit_score",
  "reward",
  "q_value",
  "success_rate",
  "confidence",
  "probability",
  "utility",
]);

function verifyContext(value) {
  const context = cloneJson(value);
  if (!isObject(context)
      || context.version !== worldSimulationExperientialMethodOutcomeCreditVersion
      || !optionalString(context.context_hash)
      || !isObject(context.resolver_view)
      || !Array.isArray(context.internal_lineage)
      || context.resolver_view.version !== worldSimulationExperientialMethodOutcomeCreditVersion
      || !optionalString(context.resolver_view.resolver_view_hash)) {
    const error = new Error("Phase76G requires an exact canonical outcome-credit resolver context.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_CONTEXT_INVALID";
    throw error;
  }
  const body = cloneJson(context);
  delete body.context_hash;
  if (hashAgentRunValue(body) !== context.context_hash) {
    const error = new Error("Phase76G resolver context hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_CONTEXT_HASH_MISMATCH";
    throw error;
  }
  const viewBody = cloneJson(context.resolver_view);
  const viewHash = viewBody.resolver_view_hash;
  delete viewBody.resolver_view_hash;
  if (hashAgentRunValue(viewBody) !== viewHash
      || context.resolver_view.applications.length !== context.internal_lineage.length) {
    const error = new Error("Phase76G resolver view/internal lineage verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_CONTEXT_LINEAGE_MISMATCH";
    throw error;
  }
  return context;
}

function normalizeDecision(raw, context, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase76G assessment decision ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_DECISION_INVALID";
    throw error;
  }
  const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
  if (forbidden.length) {
    const error = new Error(`Phase76G resolver may not author authority/credit field(s): ${forbidden.join(", ")}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_AUTHORITY_FIELD_FORBIDDEN";
    throw error;
  }
  const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
  if (unknown.length) {
    const error = new Error(`Phase76G assessment decision contains unsupported field(s): ${unknown.join(", ")}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_DECISION_FIELD_FORBIDDEN";
    throw error;
  }
  const applicationRef = requiredString(
    raw.application_ref,
    `decisions[${index}].application_ref`,
    180,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_DECISION_INVALID",
  );
  const assessment = requiredString(
    raw.assessment,
    `decisions[${index}].assessment`,
    100,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_DECISION_INVALID",
  );
  if (!supportedAssessments.includes(assessment)) {
    const error = new Error(`Unsupported Phase76G assessment ${assessment}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_ASSESSMENT_INVALID";
    throw error;
  }
  const applicationIndex = context.resolver_view.applications
    .findIndex((item) => item.application_ref === applicationRef);
  if (applicationIndex < 0) {
    const error = new Error(`Phase76G assessment references application outside resolver view: ${applicationRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_APPLICATION_OUT_OF_VIEW";
    throw error;
  }
  const visible = context.resolver_view.applications[applicationIndex];
  const internal = context.internal_lineage[applicationIndex];
  const revising = assessment !== "ambiguous_no_revision";
  if (revising && (!visible.assessment_eligible
      || !visible.semantic_revision_currently_eligible
      || internal.performed !== true)) {
    const error = new Error("Phase76G support/counterevidence requires one uniquely attributable performed method application with exact current LifeEvent provenance.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_REVISION_NOT_ELIGIBLE";
    throw error;
  }
  return {
    application_ref: applicationRef,
    assessment,
    application_index: applicationIndex,
  };
}

export function projectWorldSimulationExperientialMethodOutcomeCredit(input = {}) {
  const context = verifyContext(input.resolver_context);
  const raw = array(input.assessment_decisions);
  if (raw.length > context.resolver_view.applications.length) {
    const error = new Error("Phase76G allows at most one assessment decision per visible application.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_DECISION_LIMIT";
    throw error;
  }
  const decisions = raw.map((item, index) => normalizeDecision(item, context, index));
  if (new Set(decisions.map((item) => item.application_ref)).size !== decisions.length) {
    const error = new Error("Phase76G allows at most one assessment per application.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_DECISION_DUPLICATE";
    throw error;
  }
  decisions.sort((left, right) => compareText(left.application_ref, right.application_ref));
  const assessments = [];
  const semanticDecisions = [];
  for (const decision of decisions) {
    const visible = context.resolver_view.applications[decision.application_index];
    const internal = context.internal_lineage[decision.application_index];
    const assessmentIdentity = {
      version: worldSimulationExperientialMethodOutcomeCreditVersion,
      turn_id: context.turn_id,
      application_ref: decision.application_ref,
      phase76f_application_receipt_id: internal.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: internal.phase76f_application_receipt_hash,
      assessment: decision.assessment,
    };
    const assessmentHash = hashAgentRunValue(assessmentIdentity);
    assessments.push({
      assessment_ref: `phase76g_credit_${assessmentHash.slice(0, 24)}`,
      assessment_hash: assessmentHash,
      ...assessmentIdentity,
      character: internal.character,
      action_id: internal.action_id,
      outcome_basis: "bounded_subjective_post_outcome_experience",
      objective_causation_claimed: false,
      numeric_credit_assigned: false,
      semantic_revision_emitted: decision.assessment !== "ambiguous_no_revision",
      semantic_revision_deferred: decision.assessment === "ambiguous_no_revision"
        && visible.assessment_eligible === true
        && visible.semantic_revision_currently_eligible === false,
      subjective_not_world_truth: true,
    });
    if (decision.assessment === "ambiguous_no_revision") continue;
    semanticDecisions.push({
      character: internal.character,
      operation: decision.assessment === "supports_prior_method"
        ? "support"
        : "counterevidence",
      semantic_category: internal.source_semantic_category,
      semantic_key: internal.source_semantic_key,
      semantic_memory_id: internal.source_semantic_ref,
      source_life_event_refs: [cloneJson(internal.current_life_event_ref)],
      reason: `phase76g_${decision.assessment}`,
      source: "programmatic_personal_semantic_memory_resolver",
    });
  }
  const projection = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: context.turn_id,
    source_phase76f_receipt_bundle_hash: context.source_phase76f_receipt_bundle_hash,
    source_phase76b_bridge_hash: context.source_phase76b_bridge_hash,
    resolver_view_hash: context.resolver_view.resolver_view_hash,
    assessment_count: assessments.length,
    assessments,
    semantic_decision_count: semanticDecisions.length,
    semantic_decisions: semanticDecisions,
    audit: {
      exact_phase76f_application_receipts_verified: true,
      exact_phase76b_subjective_experience_verified: true,
      exact_phase76d_phase76e_method_lineage_verified: true,
      multi_method_automatic_credit_allowed: false,
      performed_required_for_semantic_revision: true,
      current_phase67b_life_event_required_for_semantic_revision: true,
      raw_action_outcome_consumed: false,
      hidden_causal_evidence_consumed: false,
      objective_causation_claimed: false,
      success_auto_credits_method: false,
      failure_auto_discredits_method: false,
      numeric_reward_q_value_success_rate_modeled: false,
      phase67c_support_counterevidence_reused: true,
      parallel_semantic_store_created: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
