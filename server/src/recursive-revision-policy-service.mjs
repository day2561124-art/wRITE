export const recursiveRevisionPolicyVersion = "recursive_revision_policy_v1";

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function includesAny(items, targets) {
  const set = new Set(array(items));
  return targets.some((target) => set.has(target));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeInput(raw = {}) {
  const critique = object(raw.critique);
  const polisher = object(raw.polisher);
  const repairPlanner = object(
    raw.foreshadowing_payoff_repair_planner
      ?? raw.foreshadowingPayoffRepairPlanner,
  );
  const readerResponseRevisionGate = object(
    raw.reader_response_revision_gate
      ?? raw.readerResponseRevisionGate,
  );
  const round = Number.isInteger(raw.round) && raw.round > 0 ? raw.round : 1;
  const maxRevisionRounds = Number.isInteger(raw.max_revision_rounds)
    ? raw.max_revision_rounds
    : (Number.isInteger(raw.maxRevisionRounds) ? raw.maxRevisionRounds : 2);

  return {
    critique,
    polisher,
    repairPlanner,
    readerResponseRevisionGate,
    round,
    maxRevisionRounds,
    suggestedReturnStage: text(
      raw.suggested_return_stage
        ?? raw.suggestedReturnStage
        ?? readerResponseRevisionGate.return_stage
        ?? readerResponseRevisionGate.suggested_return_stage
        ?? critique.suggested_return_stage
        ?? polisher.suggested_return_stage,
    ),
  };
}

function classifyRevisionType(input) {
  const critique = input.critique;
  const structuralReasons = array(critique.structural_reasons);
  const riskFlags = array(critique.risk_flags);
  const suggestedReturnStage = input.suggestedReturnStage;

  if (input.repairPlanner.revision_required === true) {
    return "foreshadowing_payoff_repair";
  }

  if (input.readerResponseRevisionGate.revision_required === true) {
    const gateRevisionType = text(input.readerResponseRevisionGate.revision_type);
    if (gateRevisionType && gateRevisionType !== "none") return gateRevisionType;
    return "structural_scene_rewrite";
  }

  if (
    critique.conflict_missing === true
    || suggestedReturnStage === "dramatic_conflict_manager"
    || includesAny(structuralReasons, [
      "missing_conflict",
      "unclear_opposition",
      "missing_stakes",
      "missing_required_choice",
    ])
  ) {
    return "conflict_reframe";
  }

  if (
    critique.missing_scene_function === true
    || critique.missing_concrete_action_or_cost === true
    || includesAny(structuralReasons, [
      "missing_scene_function",
      "battle_payment_insufficient",
      "scene_lacks_concrete_action",
      "scene_lacks_concrete_objects",
    ])
  ) {
    return "structural_scene_rewrite";
  }

  if (
    critique.weak_ending_hook === true
    || critique.pretty_but_empty_ending === true
    || includesAny(structuralReasons, [
      "missing_ending_event_hook",
      "ending_hook_is_pretty_sentence_only",
    ])
    || includesAny(riskFlags, ["pretty_but_empty_ending"])
  ) {
    return "ending_cleanup";
  }

  if (
    critique.over_explained_subtext === true
    || includesAny(riskFlags, [
      "subtext_over_explained",
      "dialogue_too_formal",
      "administrative_dialogue",
      "announcement_dialogue",
    ])
  ) {
    return "dialogue_rewrite";
  }

  if (riskFlags.length > 0 || structuralReasons.length > 0) {
    return "style_polish_only";
  }

  return "none";
}

function returnStageFor(revisionType, suggestedReturnStage) {
  if (suggestedReturnStage) return suggestedReturnStage;
  return {
    foreshadowing_payoff_repair: "foreshadowing_payoff_repair",
    conflict_reframe: "dramatic_conflict_manager",
    structural_scene_rewrite: "scene_planner",
    ending_cleanup: "raw_generation",
    dialogue_rewrite: "raw_generation",
    style_polish_only: "final_polisher",
    none: "final_polisher",
  }[revisionType] ?? "raw_generation";
}

function targetsFor(revisionType, critique, repairPlanner, readerResponseRevisionGate = {}) {
  const base = [];

  if (revisionType === "foreshadowing_payoff_repair") {
    base.push(
      "repair unpaid foreshadowing debts",
      "remove fake payoff claims",
      "preserve candidate-only settlement boundary",
    );
    for (const task of array(repairPlanner.repair_tasks)) {
      if (typeof task === "string") base.push(task);
      else if (task && typeof task === "object") base.push(text(task.summary ?? task.label ?? task.key));
    }
  }

  for (const target of array(readerResponseRevisionGate.rewrite_targets)) {
    base.push(text(target));
  }

  for (const trigger of array(readerResponseRevisionGate.triggers)) {
    const normalizedTrigger = object(trigger);
    const key = text(normalizedTrigger.key ?? normalizedTrigger.reason);
    if (key) base.push("address reader response trigger: " + key);
  }

  if (revisionType === "conflict_reframe") {
    base.push(
      "clarify who wants what",
      "clarify who blocks whom",
      "make the chapter cost visible",
      "produce a new status quo at the ending",
    );
  }

  if (revisionType === "structural_scene_rewrite") {
    base.push(
      "restore scene function",
      "add concrete action or cost",
      "make objects and movement carry pressure",
    );
  }

  if (revisionType === "ending_cleanup") {
    base.push(
      "replace pretty ending with event hook",
      "make the last beat change the situation",
      "carry one clear reader question forward",
    );
  }

  if (revisionType === "dialogue_rewrite") {
    base.push(
      "remove announcement dialogue",
      "reduce explained subtext",
      "make speech react to pressure instead of summarizing rules",
    );
  }

  if (revisionType === "style_polish_only") {
    base.push(
      "tighten prose without changing canon facts",
      "remove generic AI phrasing",
      "preserve scene result",
    );
  }

  for (const reason of array(critique.structural_reasons)) {
    base.push(`address structural reason: ${reason}`);
  }

  for (const flag of array(critique.risk_flags)) {
    base.push(`address risk flag: ${flag}`);
  }

  return unique(base);
}

function revisionRequiredFor(revisionType, critique, polisher, repairPlanner, readerResponseRevisionGate) {
  return revisionType !== "none"
    || polisher.needs_structural_revision === true
    || repairPlanner.revision_required === true
    || readerResponseRevisionGate.revision_required === true
    || array(critique.structural_reasons).length > 0
    || array(critique.risk_flags).length > 0;
}

export function buildRecursiveRevisionPolicy(raw = {}) {
  const input = normalizeInput(raw);
  const revisionType = classifyRevisionType(input);
  const revisionRequired = revisionRequiredFor(
    revisionType,
    input.critique,
    input.polisher,
    input.repairPlanner,
    input.readerResponseRevisionGate,
  );
  const returnStage = returnStageFor(revisionType, input.suggestedReturnStage);
  const retryAllowed = input.round < input.maxRevisionRounds;
  const escalationReason = revisionRequired && !retryAllowed
    ? "max_revision_round_reached"
    : null;

  return {
    used: true,
    phase: "34B",
    version: recursiveRevisionPolicyVersion,
    policy_kind: "recursive_revision_policy",
    policy_mode: "revision_loop_hardening",
    status: revisionRequired ? "revision_required" : "no_revision_needed",
    read_only: true,
    candidate_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    round: input.round,
    max_revision_rounds: input.maxRevisionRounds,
    retry_allowed: retryAllowed,
    revision_required: revisionRequired,
    revision_type: revisionType,
    return_stage: returnStage,
    reader_response_revision_gate: input.readerResponseRevisionGate.used === true ? {
      used: true,
      phase: input.readerResponseRevisionGate.phase ?? "34C",
      version: input.readerResponseRevisionGate.version ?? null,
      status: input.readerResponseRevisionGate.status ?? null,
      revision_required: input.readerResponseRevisionGate.revision_required === true,
      revision_type: input.readerResponseRevisionGate.revision_type ?? null,
      return_stage: input.readerResponseRevisionGate.return_stage ?? null,
      triggers: array(input.readerResponseRevisionGate.triggers),
      trace_id: input.readerResponseRevisionGate.trace_id ?? null,
    } : null,
    rewrite_targets: targetsFor(
      revisionType,
      input.critique,
      input.repairPlanner,
      input.readerResponseRevisionGate,
    ),
    preserve_constraints: [
      "preserve_canon_facts",
      "preserve_candidate_only_scope",
      "preserve_character_state",
      "preserve_timeline",
      "preserve_battle_result",
      "do_not_create_new_canon",
      "do_not_modify_active_engine",
    ],
    stop_conditions: [
      "final_polisher_status_completed",
      "needs_structural_revision_false",
      "polished_text_non_empty",
      "canon_status_candidate_only",
      "active_engine_update_allowed_false",
    ],
    escalation_reason: escalationReason,
    suggested_return_stage_from_polisher: input.suggestedReturnStage || null,
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_written: false,
      candidate_saved: false,
      approval_item_created: false,
      adoption_confirmed: false,
      rollback_executed: false,
    },
  };
}

export default buildRecursiveRevisionPolicy;
