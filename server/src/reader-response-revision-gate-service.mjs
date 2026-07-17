import { createHash } from "node:crypto";

export const readerResponseRevisionGateVersion = "reader_response_revision_gate_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function nestedScore(source, summaryKey, objectKey, fallback = 0) {
  const summary = object(source.reader_response_summary);
  if (Number.isFinite(summary[summaryKey])) return summary[summaryKey];

  const nested = object(source[objectKey]);
  if (Number.isFinite(nested.score)) return nested.score;

  return fallback;
}

function statusOf(source, objectKey, fallback = "") {
  return text(object(source[objectKey]).status) || fallback;
}

function disabledSourceDigest(raw) {
  return sha256(JSON.stringify({
    candidate_text: raw.candidate_text ?? raw.candidateText ?? "",
    reader_response_simulator: raw.reader_response_simulator ?? raw.readerResponseSimulator ?? null,
  }));
}

export function disabledReaderResponseRevisionGate(status = "disabled") {
  return {
    used: false,
    phase: "34C",
    version: readerResponseRevisionGateVersion,
    gate_kind: "reader_response_revision_gate",
    status,
    read_only: true,
    integration_only: true,
    candidate_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    revision_required: false,
    revision_type: "none",
    return_stage: "final_polisher",
    rewrite_targets: [],
    stop_conditions: [],
    triggers: [],
    warnings: [],
    safety_boundary: {
      read_only: true,
      integration_only: true,
      no_generation: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_register_mcp_tool: false,
      can_modify_runtime_ui: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_written: false,
      candidate_saved: false,
      approval_item_created: false,
      adoption_confirmed: false,
    },
    trace_id: null,
  };
}

function trigger(key, severity, revisionType, returnStage, reason, rewriteTargets) {
  return {
    key,
    severity,
    revision_type: revisionType,
    return_stage: returnStage,
    reason,
    rewrite_targets: rewriteTargets,
  };
}

function buildTriggers(readerResponse, metrics, softAcceptable) {
  if (softAcceptable) return [];

  const triggers = [];

  if (
    metrics.readerExpectationStatus
    && !["clear", "ready", "usable", "satisfied", "complete"].includes(metrics.readerExpectationStatus)
  ) {
    triggers.push(trigger(
      "reader_expectation_unclear",
      95,
      "conflict_reframe",
      "dramatic_conflict_manager",
      "Reader cannot clearly understand the scene promise or expected payoff.",
      [
        "clarify who wants what before the scene turns",
        "clarify what the reader should wait to see paid off",
        "make the chapter promise visible through action rather than explanation",
      ],
    ));
  }

  if (metrics.chapterTurnScore < 60) {
    triggers.push(trigger(
      "chapter_turn_not_visible",
      metrics.chapterTurnScore < 45 ? 90 : 76,
      "conflict_reframe",
      "dramatic_conflict_manager",
      "Chapter ending does not create a strong enough new status quo.",
      [
        "make the ending situation materially different from the opening situation",
        "add a visible choice, cost, or irreversible movement",
        "make one chapter-level change impossible to ignore",
      ],
    ));
  }

  if (metrics.hookStrengthScore < 60) {
    triggers.push(trigger(
      "ending_hook_weak",
      metrics.hookStrengthScore < 45 ? 88 : 76,
      "ending_cleanup",
      "raw_generation",
      "Ending hook is not strong enough to carry continuation desire.",
      [
        "replace soft closing with a concrete unanswered pressure",
        "make the last beat change the reader question",
        "carry one clear reader question forward",
      ],
    ));
  }

  if (metrics.dialogueTensionScore < 50) {
    triggers.push(trigger(
      "dialogue_tension_weak",
      72,
      "dialogue_rewrite",
      "raw_generation",
      "Dialogue does not create enough friction, subtext, or pressure.",
      [
        "increase dialogue friction without turning speech into exposition",
        "make speech react to pressure instead of summarizing rules",
        "replace report-like dialogue with character-specific response",
      ],
    ));
  }

  if (metrics.emotionalCurveScore < 45) {
    triggers.push(trigger(
      "emotional_curve_flat",
      70,
      "structural_scene_rewrite",
      "scene_planner",
      "The emotional curve is too flat to carry reader pressure.",
      [
        "add visible emotional pressure",
        "vary reaction beats",
        "make the scene turn affect the character state",
      ],
    ));
  }

  if (metrics.skimRiskScore >= 75) {
    triggers.push(trigger(
      "skim_risk_high",
      74,
      "structural_scene_rewrite",
      "scene_planner",
      "Reader skim risk is too high.",
      [
        "reduce report-like exposition",
        "increase concrete action beats",
        "make each paragraph carry pressure or consequence",
      ],
    ));
  }

  if (metrics.overallScore < 55) {
    triggers.push(trigger(
      "overall_reader_response_weak",
      68,
      "structural_scene_rewrite",
      "scene_planner",
      "Overall reader response score is below usable threshold.",
      [
        "raise reader-facing pressure before style polish",
        "repair scene purpose before final wording",
        "make the reader's next question explicit through event",
      ],
    ));
  }

  return triggers;
}

function primaryRevisionType(triggers) {
  const first = triggers[0];
  return first?.revision_type ?? "none";
}

function primaryReturnStage(triggers) {
  const first = triggers[0];
  return first?.return_stage ?? "final_polisher";
}

function buildRewriteTargets(readerResponse, triggers) {
  const targets = [];

  for (const suggestion of array(readerResponse.revision_suggestions)) {
    targets.push(text(suggestion));
  }

  for (const item of triggers) {
    for (const target of array(item.rewrite_targets)) {
      targets.push(text(target));
    }
  }

  if (triggers.some((item) => item.key === "reader_expectation_unclear")) {
    targets.push(
      "clarify who wants what before the scene turns",
      "clarify what the reader should wait to see paid off",
      "make the chapter promise visible through action rather than explanation",
    );
  }

  if (triggers.some((item) => item.key === "chapter_turn_not_visible")) {
    targets.push(
      "make the ending situation materially different from the opening situation",
      "add a visible choice, cost, or irreversible movement",
      "make one chapter-level change impossible to ignore",
    );
  }

  if (triggers.some((item) => item.key === "ending_hook_weak")) {
    targets.push(
      "replace soft closing with a concrete unanswered pressure",
      "make the last beat change the reader question",
      "carry one clear reader question forward",
    );
  }

  if (triggers.some((item) => item.key === "dialogue_tension_weak")) {
    targets.push(
      "increase dialogue friction without turning speech into exposition",
      "make speech react to pressure instead of summarizing rules",
      "replace report-like dialogue with character-specific response",
    );
  }

  if (triggers.length > 0) {
    targets.push(
      "raise reader-facing pressure before style polish",
      "repair scene purpose before final wording",
      "make the reader's next question explicit through event",
    );
  }

  return unique(targets);
}

export function buildReaderResponseRevisionGate(raw = {}, options = {}) {
  const readerResponse = object(
    raw.reader_response_simulator
      ?? raw.readerResponseSimulator
      ?? raw.reader_response
      ?? raw.readerResponse,
  );

  if (readerResponse.used === false || Object.keys(readerResponse).length === 0) {
    return disabledReaderResponseRevisionGate("disabled");
  }

  const source = object(readerResponse.source);
  const candidateText = text(raw.candidate_text ?? raw.candidateText);

  const metrics = {
    readerExpectationStatus: statusOf(readerResponse, "reader_expectation", "unknown"),
    emotionalCurveScore: nestedScore(readerResponse, "emotional_curve_score", "emotional_curve", 0),
    pacingPressureScore: nestedScore(readerResponse, "pacing_pressure_score", "pacing_pressure", 0),
    dialogueTensionScore: nestedScore(readerResponse, "dialogue_tension_score", "dialogue_tension", 0),
    chapterTurnScore: nestedScore(readerResponse, "chapter_turn_satisfaction_score", "chapter_turn_satisfaction", 0),
    hookStrengthScore: nestedScore(readerResponse, "hook_strength_score", "hook_strength", 0),
    skimRiskScore: nestedScore(readerResponse, "skim_risk_score", "skim_risk", 0),
    continuationDesireScore: nestedScore(readerResponse, "continuation_desire_score", "continuation_desire", 0),
    overallScore: number(readerResponse.overall_reader_response_score, 0),
  };

  const softAcceptableAfterRevision =
    metrics.overallScore >= 60
    && metrics.skimRiskScore <= 30
    && metrics.pacingPressureScore >= 70
    && metrics.dialogueTensionScore >= 60
    && metrics.emotionalCurveScore >= 70
    && metrics.chapterTurnScore >= 60
    && metrics.hookStrengthScore >= 60
    && candidateText.length >= 180;

  const triggers = buildTriggers(readerResponse, metrics, softAcceptableAfterRevision);
  const revisionRequired = triggers.length > 0;
  const revisionType = primaryRevisionType(triggers);
  const returnStage = primaryReturnStage(triggers);
  const warnings = [];

  if (
    readerResponse.status === "incomplete"
    || array(readerResponse.missing_fields).length > 0
    || array(readerResponse.warnings).includes("reader_response_input_incomplete")
  ) {
    warnings.push("reader_response_report_incomplete");
  }

  if (revisionRequired) {
    warnings.push("reader_response_revision_required");
  }

  if (softAcceptableAfterRevision && warnings.includes("reader_response_report_incomplete")) {
    warnings.push("reader_response_soft_acceptance_after_revision");
  }

  const candidateDigest = text(source.candidate_text_digest)
    || sha256(candidateText)
    || disabledSourceDigest(raw);

  return {
    used: true,
    phase: "34C",
    version: readerResponseRevisionGateVersion,
    gate_kind: "reader_response_revision_gate",
    status: revisionRequired ? "revision_required" : "no_revision_needed",
    read_only: true,
    integration_only: true,
    candidate_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    source: {
      reader_response_trace_id: readerResponse.trace_id ?? null,
      reader_response_version: readerResponse.version ?? null,
      candidate_text_digest: candidateDigest,
      overall_reader_response_score: metrics.overallScore,
    },
    reader_response_summary: {
      reader_expectation_status: metrics.readerExpectationStatus,
      emotional_curve_score: metrics.emotionalCurveScore,
      pacing_pressure_score: metrics.pacingPressureScore,
      dialogue_tension_score: metrics.dialogueTensionScore,
      chapter_turn_satisfaction_score: metrics.chapterTurnScore,
      hook_strength_score: metrics.hookStrengthScore,
      skim_risk_score: metrics.skimRiskScore,
      continuation_desire_score: metrics.continuationDesireScore,
    },
    revision_required: revisionRequired,
    revision_type: revisionType,
    return_stage: returnStage,
    rewrite_targets: buildRewriteTargets(readerResponse, triggers),
    stop_conditions: [
      "reader_response_revision_gate_status_no_revision_needed",
      "overall_reader_response_score_at_least_60_after_revision",
      "pacing_pressure_score_at_least_70_after_revision",
      "dialogue_tension_score_at_least_60_after_revision",
      "emotional_curve_score_at_least_70_after_revision",
      "skim_risk_below_high",
      "canon_status_candidate_only",
      "active_engine_update_allowed_false",
    ],
    triggers,
    warnings,
    safety_boundary: {
      read_only: true,
      integration_only: true,
      no_generation: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_register_mcp_tool: false,
      can_modify_runtime_ui: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_written: false,
      candidate_saved: false,
      approval_item_created: false,
      adoption_confirmed: false,
    },
    trace_id: "reader_response_revision_gate_" + sha256(JSON.stringify({
      candidateDigest,
      revisionRequired,
      revisionType,
      returnStage,
      triggers: triggers.map((item) => item.key),
      metrics,
    })).slice(0, 16),
  };
}

export default buildReaderResponseRevisionGate;
