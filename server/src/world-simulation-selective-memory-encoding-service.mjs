import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationSelectiveMemoryEncodingVersion =
  "phase90a-native-selective-memory-encoding-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function decisionKey(character, sense, senseIndex) {
  return [
    String(character ?? "").trim().toLocaleLowerCase("zh-Hant-TW"),
    String(sense ?? "").trim().toLowerCase(),
    Number(senseIndex),
  ].join(":");
}

function normalizedEvidence(raw, index) {
  if (!isObject(raw)) {
    const error = new Error(`attention_encoding_evidence[${index}] must be an object.`);
    error.code = "WORLD_SIMULATION_SELECTIVE_ENCODING_EVIDENCE_INVALID";
    throw error;
  }
  const sense = optionalString(raw.sense)?.toLowerCase() ?? null;
  const senseIndex = Number(raw.sense_index);
  if (!["visual", "auditory", "other"].includes(sense)
      || !Number.isSafeInteger(senseIndex)
      || senseIndex < 0) {
    const error = new Error(
      `attention_encoding_evidence[${index}] must identify visual, auditory, or other sense plus a non-negative sense_index.`,
    );
    error.code = "WORLD_SIMULATION_SELECTIVE_ENCODING_EVIDENCE_INVALID";
    throw error;
  }
  const processingLevel = optionalString(raw.processing_level)?.toLowerCase()
    ?? "not_admitted";
  const gateOutcome = optionalString(raw.current_mind_gate_outcome)?.toLowerCase()
    ?? "reject";
  return {
    sense,
    sense_index: senseIndex,
    processing_level: processingLevel,
    current_mind_gate_outcome: gateOutcome,
    goal_relevance: raw.goal_relevance === true,
    expectation_violation: raw.expectation_violation === true,
    immediate_constraint_or_urgency:
      raw.immediate_constraint_or_urgency === true,
    encoding_exclusion_supported:
      raw.encoding_exclusion_supported === true,
    interruption_state: optionalString(raw.interruption_state) ?? "none",
  };
}

function policyDecision(character, evidence) {
  const supportedByMeaning = evidence.goal_relevance
    || evidence.expectation_violation
    || evidence.immediate_constraint_or_urgency;
  const attended = evidence.processing_level === "focus"
    || evidence.processing_level === "active";
  const explicitlyRejected = evidence.processing_level === "not_admitted"
    && evidence.current_mind_gate_outcome === "reject"
    && evidence.encoding_exclusion_supported === true;

  let decision = "unspecified";
  const reasonCodes = [];

  if (supportedByMeaning || attended) {
    decision = "encode";
    if (attended) reasonCodes.push(`attended_${evidence.processing_level}`);
    if (evidence.goal_relevance) reasonCodes.push("goal_relevance");
    if (evidence.expectation_violation) reasonCodes.push("expectation_violation");
    if (evidence.immediate_constraint_or_urgency) {
      reasonCodes.push("immediate_constraint_or_urgency");
    }
  } else if (explicitlyRejected) {
    decision = "do_not_encode";
    reasonCodes.push("explicit_bounded_encoding_exclusion");
  } else {
    reasonCodes.push("bounded_evidence_insufficient_for_selective_override");
  }

  return {
    character,
    sense: evidence.sense,
    sense_index: evidence.sense_index,
    decision,
    reason: reasonCodes.join("+"),
    source: "phase90a_native_selective_encoding_policy",
    policy_evidence: cloneJson(evidence),
  };
}

export function buildWorldSimulationSelectiveMemoryEncodingContract() {
  return Object.freeze({
    version: worldSimulationSelectiveMemoryEncodingVersion,
    phase: "Phase90A",
    status: "native_selective_memory_encoding_installed",
    owner: "engine_native_programmatic_policy",
    input_scope: "bounded_perception_current_mind_encoding_evidence_only",
    supported_decisions: ["encode", "do_not_encode", "unspecified"],
    attention_is_evidence_not_binary_memory_gate: true,
    focus_is_not_required_for_encoding: true,
    non_focus_goal_relevance_may_support_encoding: true,
    non_focus_expectation_violation_may_support_encoding: true,
    non_focus_urgency_may_support_encoding: true,
    peripheral_observation_auto_discarded: false,
    current_mind_reject_alone_may_skip_encoding: false,
    explicit_bounded_encoding_exclusion_required_for_skip: true,
    numeric_encoding_probability_modeled: false,
    universal_encoding_threshold_modeled: false,
    single_memory_strength_modeled: false,
    memory_content_rewrite_allowed: false,
    world_truth_authority: false,
    character_brain_direct_encoding_authority: false,
    formal_transport_callback_required: false,
  });
}

export function buildWorldSimulationNativeSelectiveMemoryEncodingDecisions(
  input = {},
) {
  const preparedTurn = isObject(input.prepared_turn)
    ? input.prepared_turn
    : input;
  const decisions = [];
  const seen = new Set();

  for (const packet of array(preparedTurn.decision_packets)) {
    const character = optionalString(packet?.character);
    if (!character) continue;
    const envelope = array(preparedTurn.attention_encoding_evidence)
      .find((item) => sameCharacter(item?.character, character));
    const rawEvidence = array(
      envelope?.evidence
      ?? packet?.attention_encoding_evidence,
    );
    rawEvidence.forEach((raw, index) => {
      const evidence = normalizedEvidence(raw, index);
      const key = decisionKey(character, evidence.sense, evidence.sense_index);
      if (seen.has(key)) {
        const error = new Error(`Duplicate Phase90A encoding evidence for ${key}.`);
        error.code = "WORLD_SIMULATION_SELECTIVE_ENCODING_EVIDENCE_DUPLICATE";
        throw error;
      }
      seen.add(key);
      decisions.push(policyDecision(character, evidence));
    });
  }

  const result = {
    version: worldSimulationSelectiveMemoryEncodingVersion,
    phase: "Phase90A",
    decisions: decisions.map((decision) => ({
      character: decision.character,
      sense: decision.sense,
      sense_index: decision.sense_index,
      decision: decision.decision,
      reason: decision.reason,
      source: decision.source,
    })),
    decision_evidence: decisions,
    audit: {
      native_policy_used: true,
      decision_count: decisions.length,
      encode_count: decisions.filter((item) => item.decision === "encode").length,
      do_not_encode_count:
        decisions.filter((item) => item.decision === "do_not_encode").length,
      unspecified_count:
        decisions.filter((item) => item.decision === "unspecified").length,
      bounded_character_information_only: true,
      world_state_exposed: false,
      raw_world_event_exposed: false,
      attention_is_binary_memory_gate: false,
      peripheral_observation_auto_discarded: false,
      numeric_probability_used: false,
      universal_threshold_used: false,
      single_memory_strength_used: false,
      memory_content_rewritten: false,
      character_brain_direct_memory_mutation_allowed: false,
    },
  };
  result.policy_input_hash = hashAgentRunValue({
    turn_id: preparedTurn.turn_id ?? null,
    attention_encoding_evidence: preparedTurn.attention_encoding_evidence ?? [],
  });
  result.policy_output_hash = hashAgentRunValue({
    version: result.version,
    decisions: result.decisions,
  });
  return Object.freeze(cloneJson(result));
}
