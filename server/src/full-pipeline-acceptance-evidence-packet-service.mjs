import { createHash } from "node:crypto";

export const fullPipelineAcceptanceEvidencePacketVersion = "full_pipeline_acceptance_evidence_packet_v1";

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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function clone(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value ?? null));
}

function severityLabel(value) {
  const severity = Number.isFinite(value) ? value : 0;
  if (severity >= 85) return "high";
  if (severity >= 70) return "medium";
  if (severity > 0) return "low";
  return "info";
}

export function disabledFullPipelineAcceptanceEvidencePacket(status = "disabled") {
  return {
    used: false,
    phase: "34D",
    version: fullPipelineAcceptanceEvidencePacketVersion,
    packet_kind: "full_pipeline_acceptance_evidence_packet",
    status,
    read_only: true,
    integration_only: true,
    candidate_only: true,
    report_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_settlement_update: true,
    pipeline_source: null,
    decision_chain: null,
    acceptance_summary: {
      accepted: false,
      soft_acceptance_reached: false,
      revision_required_initially: false,
      revision_required_finally: false,
      final_status: status,
    },
    operator_findings: [],
    operator_summary: [],
    warnings: [],
    safety_boundary: {
      read_only: true,
      integration_only: true,
      candidate_only: true,
      report_only: true,
      can_generate: false,
      can_auto_persist: false,
      can_save_candidate: false,
      can_create_approval: false,
      can_confirm_adoption: false,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_update_settlement: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_written: false,
      settlement_written: false,
      candidate_saved: false,
      approval_item_created: false,
      adoption_confirmed: false,
    },
    trace_id: null,
  };
}

function summarizeGate(gate) {
  const normalized = object(gate);
  if (Object.keys(normalized).length === 0) return null;
  return {
    used: normalized.used === true,
    phase: normalized.phase ?? null,
    version: normalized.version ?? null,
    gate_kind: normalized.gate_kind ?? null,
    status: normalized.status ?? null,
    revision_required: normalized.revision_required === true,
    revision_type: normalized.revision_type ?? null,
    return_stage: normalized.return_stage ?? null,
    rewrite_targets: array(normalized.rewrite_targets),
    triggers: array(normalized.triggers),
    stop_conditions: array(normalized.stop_conditions),
    reader_response_summary: normalized.reader_response_summary ?? null,
    source: normalized.source ?? null,
    warnings: array(normalized.warnings),
    trace_id: normalized.trace_id ?? null,
    read_only: normalized.read_only !== false,
    integration_only: normalized.integration_only !== false,
    candidate_only: normalized.candidate_only !== false,
    no_generation: normalized.no_generation !== false,
    no_auto_persist: normalized.no_auto_persist !== false,
    no_candidate_save: normalized.no_candidate_save !== false,
    no_approval: normalized.no_approval !== false,
    no_adoption: normalized.no_adoption !== false,
    no_canon_update: normalized.no_canon_update !== false,
    no_active_engine_update: normalized.no_active_engine_update !== false,
    no_compressed_rules_update: normalized.no_compressed_rules_update !== false,
  };
}

function summarizeReaderResponse(report) {
  const normalized = object(report);
  if (Object.keys(normalized).length === 0) return null;
  return {
    used: normalized.used === true,
    phase: normalized.phase ?? null,
    version: normalized.version ?? null,
    status: normalized.status ?? null,
    overall_reader_response_score: normalized.overall_reader_response_score ?? null,
    reader_response_summary: normalized.reader_response_summary ?? null,
    reader_expectation: normalized.reader_expectation ?? null,
    emotional_curve: normalized.emotional_curve ?? null,
    pacing_pressure: normalized.pacing_pressure ?? null,
    dialogue_tension: normalized.dialogue_tension ?? null,
    chapter_turn_satisfaction: normalized.chapter_turn_satisfaction ?? null,
    hook_strength: normalized.hook_strength ?? null,
    skim_risk: normalized.skim_risk ?? null,
    continuation_desire: normalized.continuation_desire ?? null,
    revision_suggestions: array(normalized.revision_suggestions),
    warnings: array(normalized.warnings),
    trace_id: normalized.trace_id ?? null,
  };
}

function summarizeRevisionRound(round) {
  const normalized = object(round);
  return {
    round: normalized.round ?? null,
    input_hash: normalized.input_hash ?? null,
    critique: clone(normalized.critique),
    recursive_revision_policy: clone(normalized.recursive_revision_policy),
    revision_plan: clone(normalized.revision_plan),
    reader_response_simulator: summarizeReaderResponse(normalized.reader_response_simulator),
    reader_response_revision_gate: summarizeGate(normalized.reader_response_revision_gate),
    revised_draft_hash: normalized.revised_draft_hash ?? "",
    revised_draft_chars: normalized.revised_draft_chars ?? 0,
    final_polisher_status: normalized.final_polisher_status ?? null,
    needs_structural_revision: normalized.needs_structural_revision === true,
    accepted: normalized.accepted === true,
    stop_reason: normalized.stop_reason ?? null,
  };
}

function firstRoundWithReaderGate(rounds) {
  return array(rounds).find((round) => object(round.reader_response_revision_gate).used === true)
    ?? null;
}

function collectGateFindings(gate, position) {
  const normalized = object(gate);
  const findings = [];

  for (const trigger of array(normalized.triggers)) {
    const item = object(trigger);
    findings.push({
      severity: severityLabel(item.severity),
      source: "reader_response_revision_gate",
      position,
      key: item.key ?? null,
      finding: text(item.reason) || text(item.key) || "Reader response gate requested revision.",
      revision_type: item.revision_type ?? normalized.revision_type ?? null,
      return_stage: item.return_stage ?? normalized.return_stage ?? null,
      rewrite_targets: array(item.rewrite_targets),
      trace_id: normalized.trace_id ?? null,
    });
  }

  if (findings.length === 0 && normalized.revision_required === true) {
    findings.push({
      severity: "medium",
      source: "reader_response_revision_gate",
      position,
      key: "reader_response_revision_required",
      finding: "Reader response gate required revision without a detailed trigger list.",
      revision_type: normalized.revision_type ?? null,
      return_stage: normalized.return_stage ?? null,
      rewrite_targets: array(normalized.rewrite_targets),
      trace_id: normalized.trace_id ?? null,
    });
  }

  return findings;
}

function collectPolicyFindings(policy) {
  const normalized = object(policy);
  if (normalized.revision_required !== true) return [];
  return [{
    severity: normalized.escalation_reason ? "high" : "medium",
    source: "recursive_revision_policy",
    position: "revision_loop",
    key: normalized.revision_type ?? "revision_required",
    finding: `Recursive revision policy routed the candidate to ${normalized.return_stage ?? "unknown stage"}.`,
    revision_type: normalized.revision_type ?? null,
    return_stage: normalized.return_stage ?? null,
    rewrite_targets: array(normalized.rewrite_targets),
    trace_id: normalized.reader_response_revision_gate?.trace_id ?? null,
  }];
}

function finalStatusFor(result, accepted, softAcceptanceReached, recursiveRevisionUsed) {
  if (accepted && recursiveRevisionUsed) return "accepted_after_revision";
  if (accepted) return "accepted";
  if (text(result.stop_reason) === "max_revision_rounds_exhausted") return "revision_exhausted";
  if (text(result.pipeline_stage) === "structural_revision_required") return "revision_required";
  return text(result.stop_reason) || text(result.pipeline_stage) || "not_accepted";
}

function buildOperatorSummary(acceptanceSummary, findings) {
  const lines = [];

  if (acceptanceSummary.revision_required_initially) {
    lines.push("Initial reader response or structural gate required revision.");
  } else {
    lines.push("Initial reader response did not require recursive revision.");
  }

  if (acceptanceSummary.accepted && acceptanceSummary.revision_required_initially) {
    lines.push("Candidate reached acceptance after recursive revision.");
  } else if (acceptanceSummary.accepted) {
    lines.push("Candidate reached acceptance without recursive revision.");
  } else {
    lines.push("Candidate has not reached acceptance.");
  }

  if (acceptanceSummary.revision_required_finally) {
    lines.push("Final gate still reports revision pressure.");
  } else if (acceptanceSummary.soft_acceptance_reached) {
    lines.push("Final gate reached soft acceptance conditions.");
  }

  if (findings.length > 0) {
    lines.push(`Operator findings recorded: ${findings.length}.`);
  }

  return lines;
}

export function buildFullPipelineAcceptanceEvidencePacket(pipelineResult = {}, options = {}) {
  const result = object(pipelineResult);
  if (Object.keys(result).length === 0) {
    return disabledFullPipelineAcceptanceEvidencePacket("empty_pipeline_result");
  }

  const recursiveRevision = object(result.recursive_revision);
  const rounds = array(recursiveRevision.rounds);
  const initialRound = firstRoundWithReaderGate(rounds);
  const firstRound = object(rounds[0]);
  const initialReaderResponseSimulator = initialRound
    ? initialRound.reader_response_simulator
    : result.reader_response_simulator;
  const initialReaderResponseRevisionGate = initialRound
    ? initialRound.reader_response_revision_gate
    : result.reader_response_revision_gate;
  const finalReaderResponseSimulator = result.reader_response_simulator;
  const finalReaderResponseRevisionGate = result.reader_response_revision_gate;

  const initialGateSummary = summarizeGate(initialReaderResponseRevisionGate);
  const finalGateSummary = summarizeGate(finalReaderResponseRevisionGate);
  const recursiveRevisionPolicy = firstRound.recursive_revision_policy ?? null;
  const revisionPlan = firstRound.revision_plan ?? null;
  const revisionRoundReports = rounds.map(summarizeRevisionRound);

  const accepted = result.status === "completed"
    && Boolean(text(result.final_candidate_text))
    && result.final_polisher?.needs_structural_revision !== true;

  const recursiveRevisionUsed = recursiveRevision.used === true;
  const revisionRequiredInitially =
    initialGateSummary?.revision_required === true
    || result.final_polisher?.needs_structural_revision === true
    || recursiveRevisionUsed;

  const revisionRequiredFinally =
    finalGateSummary?.revision_required === true
    || result.final_polisher?.needs_structural_revision === true
    || result.pipeline_stage === "structural_revision_required";

  const softAcceptanceReached =
    accepted
    && finalGateSummary?.revision_required !== true
    && result.final_polisher?.needs_structural_revision !== true;

  const acceptanceSummary = {
    accepted,
    soft_acceptance_reached: softAcceptanceReached,
    revision_required_initially: revisionRequiredInitially,
    revision_required_finally: revisionRequiredFinally,
    recursive_revision_used: recursiveRevisionUsed,
    rounds_attempted: recursiveRevision.rounds_attempted ?? rounds.length,
    max_revision_rounds: recursiveRevision.max_revision_rounds ?? null,
    final_status: finalStatusFor(result, accepted, softAcceptanceReached, recursiveRevisionUsed),
    pipeline_stage: result.pipeline_stage ?? null,
    stop_reason: result.stop_reason ?? null,
    final_candidate_source: result.final_candidate_source ?? null,
  };

  const operatorFindings = [
    ...collectGateFindings(initialReaderResponseRevisionGate, "initial"),
    ...collectPolicyFindings(recursiveRevisionPolicy),
  ];

  const warnings = unique([
    ...array(result.report?.warnings),
    ...array(initialGateSummary?.warnings),
    ...array(finalGateSummary?.warnings),
  ]);

  const packet = {
    used: true,
    phase: "34D",
    version: fullPipelineAcceptanceEvidencePacketVersion,
    packet_kind: "full_pipeline_acceptance_evidence_packet",
    status: text(options.status) || acceptanceSummary.final_status,
    built_at: text(options.built_at ?? options.builtAt) || new Date().toISOString(),
    read_only: true,
    integration_only: true,
    candidate_only: true,
    report_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_settlement_update: true,
    pipeline_source: {
      pipeline_stage: result.pipeline_stage ?? null,
      status: result.status ?? null,
      stop_reason: result.stop_reason ?? null,
      final_candidate_hash: result.final_candidate_hash ?? "",
      final_candidate_source: result.final_candidate_source ?? null,
      candidate_created: result.candidate_created === true,
      canon_status: result.canon_status ?? null,
      adopted: result.adopted === true,
      settled: result.settled === true,
      trace_ids: array(result.report?.trace_ids),
      provider_trace_ids: array(result.provider_trace_ids),
    },
    decision_chain: {
      reader_response_simulator: summarizeReaderResponse(initialReaderResponseSimulator),
      reader_response_revision_gate: initialGateSummary,
      recursive_revision_policy: clone(recursiveRevisionPolicy),
      revision_plan: clone(revisionPlan),
      revision_rounds: revisionRoundReports,
      final_reader_response_simulator: summarizeReaderResponse(finalReaderResponseSimulator),
      final_reader_response_revision_gate: finalGateSummary,
    },
    acceptance_summary: acceptanceSummary,
    operator_findings: operatorFindings,
    operator_summary: buildOperatorSummary(acceptanceSummary, operatorFindings),
    warnings,
    safety_boundary: {
      read_only: true,
      integration_only: true,
      candidate_only: true,
      report_only: true,
      can_generate: false,
      can_auto_persist: false,
      can_save_candidate: false,
      can_create_approval: false,
      can_confirm_adoption: false,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_update_settlement: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      canon_written: false,
      settlement_written: false,
      candidate_saved: false,
      approval_item_created: false,
      adoption_confirmed: false,
    },
  };

  packet.trace_id = "full_pipeline_acceptance_evidence_packet_" + sha256(JSON.stringify({
    pipeline_stage: packet.pipeline_source.pipeline_stage,
    status: packet.status,
    final_status: packet.acceptance_summary.final_status,
    initial_gate_status: packet.decision_chain.reader_response_revision_gate?.status ?? null,
    final_gate_status: packet.decision_chain.final_reader_response_revision_gate?.status ?? null,
    findings: packet.operator_findings.map((item) => item.key),
  })).slice(0, 16);

  return packet;
}

export default buildFullPipelineAcceptanceEvidencePacket;