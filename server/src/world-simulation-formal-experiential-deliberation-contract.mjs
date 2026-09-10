export const worldSimulationFormalImpasseDeliberationVersion =
  "phase79m-formal-experiential-deliberation-v1";

export const worldSimulationFormalImpasseDecisionKinds = Object.freeze({
  PHASE76D: "experiential_knowledge_reentry",
  PHASE76E: "experiential_method_transfer",
  PHASE79B: "experiential_method_competition_resolution",
  PHASE79F: "experiential_method_impasse_reresolution",
  PHASE79J: "experiential_method_impasse_precedent_reresolution",
  PHASE80B: "analogical_experience_adaptation",
  ACTION: "action_selection",
});

export const worldSimulationFormalImpasseMaximumReferenceItems = 8;
export const worldSimulationFormalImpassePreferences = Object.freeze([
  "left_preferred",
  "right_preferred",
  "indifferent",
]);

const maximumDecisionItems = 64;
const impassePreferences = new Set(worldSimulationFormalImpassePreferences);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function stageLabel(kind) {
  switch (kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      return "Phase76D";
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      return "Phase76E";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B:
      return "Phase79B";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
      return "Phase79F";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      return "Phase79J";
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      return "Phase80B";
    default:
      return null;
  }
}

function responseField(kind) {
  switch (kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      return "activated_semantic_refs";
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      return "transfer_mappings";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B:
      return "preference_decisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      return "preference_revisions";
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      return "adaptation_decisions";
    default:
      return null;
  }
}

function assertResponseEnvelope(characterInput, response) {
  const kind = text(characterInput?.decision_kind);
  const field = responseField(kind);
  const task = characterInput?.experiential_deliberation;
  if (!field
      || !isObject(task)
      || task.version !== worldSimulationFormalImpasseDeliberationVersion
      || !isObject(response)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      "Phase79M submission is not bound to a valid experiential deliberation task.",
    );
  }
  const keys = Object.keys(response);
  if (keys.length !== 1 || keys[0] !== field || !Array.isArray(response[field])) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
      `Phase79M ${stageLabel(kind)} response must contain only ${field}.`,
    );
  }
  if (response[field].length > maximumDecisionItems) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      `Phase79M ${field} exceeds the bounded response size.`,
    );
  }
  return { kind, field, task, values: response[field] };
}

function normalizePhase76D(task, values) {
  const candidates = array(task.candidate_personal_semantics);
  const allowed = new Set(candidates.map((candidate) => text(candidate?.semantic_ref)).filter(Boolean));
  const limit = Number.isSafeInteger(task.response_contract?.maximum_selection_count)
    ? task.response_contract.maximum_selection_count
    : allowed.size;
  if (values.length > limit) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      "Phase79M Phase76D activation selection exceeds the canonical limit.",
    );
  }
  const refs = values.map((value) => text(isObject(value) ? value.semantic_ref : value));
  if (refs.some((ref) => !ref)
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !allowed.has(ref))) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_OUT_OF_VIEW",
      "Phase79M Phase76D may select only unique semantic refs from the current bounded resolver view.",
    );
  }
  return refs;
}

function normalizePhase76E(task, values) {
  const candidateRefs = new Set(
    array(task.method_candidates).map((candidate) => text(candidate?.transfer_ref)).filter(Boolean),
  );
  const cueRefs = new Set(
    array(task.current_cue_catalog).map((cue) => text(cue?.cue_ref)).filter(Boolean),
  );
  const supportedKinds = new Set(array(task.response_contract?.supported_mapping_kinds));
  const limit = Number.isSafeInteger(task.response_contract?.maximum_transfer_count)
    ? task.response_contract.maximum_transfer_count
    : candidateRefs.size;
  if (values.length > limit) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      "Phase79M Phase76E mapping selection exceeds the canonical limit.",
    );
  }
  const seen = new Set();
  return values.map((raw, index) => {
    if (!isObject(raw)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
        `Phase79M Phase76E transfer_mappings[${index}] must be an object.`,
      );
    }
    const allowedKeys = new Set(["transfer_ref", "mapping_kind", "current_cue_refs"]);
    if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
        "Phase79M Phase76E mapping contains fields outside the canonical transfer contract.",
      );
    }
    const transferRef = text(raw.transfer_ref);
    const mappingKind = text(raw.mapping_kind);
    const refs = array(raw.current_cue_refs).map(text);
    if (!transferRef
        || seen.has(transferRef)
        || !candidateRefs.has(transferRef)
        || !mappingKind
        || !supportedKinds.has(mappingKind)
        || refs.length < 1
        || refs.length > worldSimulationFormalImpasseMaximumReferenceItems
        || refs.some((ref) => !ref)
        || new Set(refs).size !== refs.length
        || refs.some((ref) => !cueRefs.has(ref))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_OUT_OF_VIEW",
        `Phase79M Phase76E transfer_mappings[${index}] is outside the bounded resolver view.`,
      );
    }
    seen.add(transferRef);
    return {
      transfer_ref: transferRef,
      mapping_kind: mappingKind,
      current_cue_refs: refs,
    };
  });
}

function normalizePhase79B(task, values) {
  const context = task.competition_context;
  if (!isObject(context)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      "Phase79M Phase79B response is missing its bounded competition context.",
    );
  }
  const allowedRefs = new Set(
    array(context.competition_pairs).map((pair) => text(pair?.competition_ref)).filter(Boolean),
  );
  const allowedPreferences = new Set(array(task.response_contract?.allowed_preferences));
  const seen = new Set();
  return values.map((raw, index) => {
    if (!isObject(raw)
        || Object.keys(raw).some((key) => !["competition_ref", "preference"].includes(key))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
        `Phase79M Phase79B preference_decisions[${index}] has an invalid shape.`,
      );
    }
    const competitionRef = text(raw.competition_ref);
    const preference = text(raw.preference);
    if (!competitionRef
        || seen.has(competitionRef)
        || !allowedRefs.has(competitionRef)
        || !preference
        || !allowedPreferences.has(preference)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_OUT_OF_VIEW",
        `Phase79M Phase79B preference_decisions[${index}] is outside the bounded resolver view.`,
      );
    }
    seen.add(competitionRef);
    return { competition_ref: competitionRef, preference };
  });
}

function normalizePhase80B(task, values) {
  const candidates = array(task.analogy_candidates);
  const candidateByRef = new Map(
    candidates.map((candidate) => [text(candidate?.analogy_candidate_ref), candidate]),
  );
  const maxDecisions = Number.isSafeInteger(task.response_contract?.maximum_adaptation_decision_count)
    ? task.response_contract.maximum_adaptation_decision_count
    : candidates.length;
  const maxRefs = Number.isSafeInteger(task.response_contract?.maximum_reference_items_per_kind)
    ? task.response_contract.maximum_reference_items_per_kind
    : worldSimulationFormalImpasseMaximumReferenceItems;
  if (values.length > maxDecisions) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      "Phase79M Phase80B adaptation selection exceeds the canonical limit.",
    );
  }
  const seen = new Set();
  const normalizeRefs = (raw, allowed, label) => {
    const refs = array(raw).map(text);
    if (refs.length > maxRefs
        || refs.some((ref) => !ref)
        || new Set(refs).size !== refs.length
        || refs.some((ref) => !allowed.has(ref))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_OUT_OF_VIEW",
        `Phase79M Phase80B ${label} contains duplicate or out-of-view refs.`,
      );
    }
    return [...refs].sort();
  };
  return values.map((raw, index) => {
    if (!isObject(raw)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
        `Phase79M Phase80B adaptation_decisions[${index}] must be an object.`,
      );
    }
    const allowedKeys = new Set([
      "analogy_candidate_ref",
      "retain_aligned_current_cue_refs",
      "drop_historical_cue_refs",
      "incorporate_current_cue_refs",
    ]);
    if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
        "Phase79M Phase80B adaptation contains fields outside the bounded response contract.",
      );
    }
    const candidateRef = text(raw.analogy_candidate_ref);
    const candidate = candidateByRef.get(candidateRef);
    if (!candidateRef || !candidate || seen.has(candidateRef)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_OUT_OF_VIEW",
        "Phase79M Phase80B adaptation references an unknown or duplicate analogy candidate.",
      );
    }
    seen.add(candidateRef);
    const aligned = new Set(array(candidate.aligned_current_cues).map((cue) => text(cue?.current_cue_ref)).filter(Boolean));
    const historical = new Set(array(candidate.historical_difference_cues).map((cue) => text(cue?.historical_cue_ref)).filter(Boolean));
    const current = new Set(array(candidate.current_additional_cues).map((cue) => text(cue?.current_cue_ref)).filter(Boolean));
    const retain = normalizeRefs(raw.retain_aligned_current_cue_refs, aligned, "retain_aligned_current_cue_refs");
    const drop = normalizeRefs(raw.drop_historical_cue_refs, historical, "drop_historical_cue_refs");
    const incorporate = normalizeRefs(raw.incorporate_current_cue_refs, current, "incorporate_current_cue_refs");
    if (drop.length === 0 && incorporate.length === 0) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
        "Phase79M Phase80B adaptation must address at least one context difference.",
      );
    }
    return {
      analogy_candidate_ref: candidateRef,
      retain_aligned_current_cue_refs: retain,
      drop_historical_cue_refs: drop,
      incorporate_current_cue_refs: incorporate,
    };
  });
}

function normalizeImpasse(task, kind, values) {
  const contexts = array(task.impasse_contexts);
  const contextByRef = new Map(contexts.map((context) => [context.impasse_ref, context]));
  const referenceField = kind === worldSimulationFormalImpasseDecisionKinds.PHASE79F
    ? "evidence_cue_refs"
    : "precedent_refs";
  const seen = new Set();
  return values.map((raw, index) => {
    if (!isObject(raw)) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
        `Phase79M preference_revisions[${index}] must be an object.`,
      );
    }
    const allowedKeys = new Set([
      "impasse_ref",
      "competition_ref",
      "preference",
      referenceField,
    ]);
    if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
        "Phase79M impasse revision contains fields outside the bounded response contract.",
      );
    }
    const impasseRef = text(raw.impasse_ref);
    const competitionRef = text(raw.competition_ref);
    const preference = text(raw.preference);
    const context = contextByRef.get(impasseRef);
    const pair = array(context?.competition_pairs)
      .find((candidate) => candidate?.competition_ref === competitionRef);
    const refs = array(raw[referenceField]).map(text);
    const allowedRefs = new Set(
      kind === worldSimulationFormalImpasseDecisionKinds.PHASE79F
        ? array(context?.current_context_cue_catalog).map((cue) => cue?.cue_ref)
        : array(context?.eligible_precedents).map((precedent) => precedent?.precedent_ref),
    );
    if (!context
        || !pair
        || !competitionRef
        || seen.has(competitionRef)
        || !preference
        || !impassePreferences.has(preference)
        || refs.length < 1
        || refs.length > worldSimulationFormalImpasseMaximumReferenceItems
        || refs.some((ref) => !ref)
        || new Set(refs).size !== refs.length
        || refs.some((ref) => !allowedRefs.has(ref))) {
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_OUT_OF_VIEW",
        `Phase79M preference_revisions[${index}] is outside the bounded resolver view.`,
      );
    }
    seen.add(competitionRef);
    return {
      impasse_ref: impasseRef,
      competition_ref: competitionRef,
      preference,
      [referenceField]: refs,
    };
  });
}

export function validateWorldSimulationFormalImpasseDeliberationSubmission(input = {}) {
  const characterInput = isObject(input.character_input) ? input.character_input : {};
  const response = isObject(input.deliberation_response)
    ? input.deliberation_response
    : { preference_revisions: input.preference_revisions };
  const envelope = assertResponseEnvelope(characterInput, response);
  let normalized;
  switch (envelope.kind) {
    case worldSimulationFormalImpasseDecisionKinds.PHASE76D:
      normalized = normalizePhase76D(envelope.task, envelope.values);
      break;
    case worldSimulationFormalImpasseDecisionKinds.PHASE76E:
      normalized = normalizePhase76E(envelope.task, envelope.values);
      break;
    case worldSimulationFormalImpasseDecisionKinds.PHASE79B:
      normalized = normalizePhase79B(envelope.task, envelope.values);
      break;
    case worldSimulationFormalImpasseDecisionKinds.PHASE79F:
    case worldSimulationFormalImpasseDecisionKinds.PHASE79J:
      normalized = normalizeImpasse(envelope.task, envelope.kind, envelope.values);
      break;
    case worldSimulationFormalImpasseDecisionKinds.PHASE80B:
      normalized = normalizePhase80B(envelope.task, envelope.values);
      break;
    default:
      fail(
        "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
        "Phase79M submission requires a supported experiential deliberation stage.",
      );
  }
  return { [envelope.field]: cloneJson(normalized) };
}

export function buildWorldSimulationFormalImpasseStoredSubmission(input = {}) {
  const binding = isObject(input.resolver_binding) ? input.resolver_binding : {};
  const characterInput = isObject(input.character_input) ? input.character_input : {};
  if (binding.version !== worldSimulationFormalImpasseDeliberationVersion
      || binding.decision_kind !== characterInput.decision_kind
      || !sameCharacter(binding.character, characterInput.character)
      || !text(binding.resolver_view_hash)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_BINDING_INVALID",
      "Phase79M engine-side resolver binding does not match the public character task.",
    );
  }
  const deliberationResponse = validateWorldSimulationFormalImpasseDeliberationSubmission({
    character_input: characterInput,
    deliberation_response: input.deliberation_response,
    preference_revisions: input.preference_revisions,
  });
  return {
    version: worldSimulationFormalImpasseDeliberationVersion,
    decision_kind: binding.decision_kind,
    character: binding.character,
    resolver_view_hash: binding.resolver_view_hash,
    deliberation_response: deliberationResponse,
  };
}
