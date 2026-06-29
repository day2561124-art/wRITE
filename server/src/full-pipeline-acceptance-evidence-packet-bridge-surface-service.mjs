import { createHash } from "node:crypto";

export const fullPipelineAcceptanceEvidencePacketBridgeSurfaceVersion =
  "full_pipeline_acceptance_evidence_packet_bridge_surface_v1";

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

function bool(value) {
  return value === true;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function clone(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value ?? null));
}

function sourcePacket(raw) {
  return object(
    raw.full_pipeline_acceptance_evidence_packet
      ?? raw.fullPipelineAcceptanceEvidencePacket
      ?? raw.evidence_packet
      ?? raw.evidencePacket
      ?? raw.packet
      ?? raw.pipeline_result?.full_pipeline_acceptance_evidence_packet
      ?? raw.pipelineResult?.full_pipeline_acceptance_evidence_packet,
  );
}

export function disabledFullPipelineAcceptanceEvidencePacketBridgeSurface(status = "disabled") {
  return {
    used: false,
    phase: "34E",
    version: fullPipelineAcceptanceEvidencePacketBridgeSurfaceVersion,
    surface_kind: "full_pipeline_acceptance_evidence_packet_bridge_surface",
    bridge_surface: "chatgpt_bridge",
    status,
    read_only: true,
    integration_only: true,
    candidate_only: true,
    report_only: true,
    preview_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_settlement_update: true,
    source_packet_trace_id: null,
    source_packet_version: null,
    acceptance_summary: {
      accepted: false,
      soft_acceptance_reached: false,
      revision_required_initially: false,
      revision_required_finally: false,
      final_status: status,
    },
    decision_chain_summary: {
      reader_response_simulator_used: false,
      reader_response_revision_gate_used: false,
      reader_response_revision_gate_status: null,
      recursive_revision_policy_used: false,
      recursive_revision_policy_status: null,
      final_reader_response_revision_gate_status: null,
    },
    rewrite_targets: [],
    operator_findings: [],
    operator_cards: [],
    bridge_metadata: {
      read_only_tool: true,
      writes_files: false,
      writes_only_to: [],
      source_phase: "34D",
      source_packet_available: false,
      chatgpt_safe_preview: true,
    },
    safety: {
      mcp_can_generate: false,
      mcp_can_save_candidate: false,
      mcp_can_approve: false,
      mcp_can_confirm_adoption: false,
      mcp_can_activate_engine: false,
      mcp_can_update_canon: false,
      mcp_can_update_active_engine: false,
      mcp_can_update_compressed_rules: false,
      mcp_can_update_settlement: false,
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
    next_action: "no_evidence_packet_available",
    warnings: [],
    trace_id: null,
  };
}

function findingSummary(finding) {
  const normalized = object(finding);
  return {
    severity: normalized.severity ?? "info",
    source: normalized.source ?? null,
    position: normalized.position ?? null,
    key: normalized.key ?? null,
    finding: text(normalized.finding) || text(normalized.reason) || "Evidence finding.",
    revision_type: normalized.revision_type ?? null,
    return_stage: normalized.return_stage ?? null,
    rewrite_targets: array(normalized.rewrite_targets),
    trace_id: normalized.trace_id ?? null,
  };
}

function collectRewriteTargets(...sources) {
  const targets = [];
  for (const source of sources) {
    for (const target of array(source?.rewrite_targets)) targets.push(text(target));
    for (const finding of array(source?.operator_findings)) {
      for (const target of array(finding?.rewrite_targets)) targets.push(text(target));
    }
    for (const trigger of array(source?.triggers)) {
      for (const target of array(trigger?.rewrite_targets)) targets.push(text(target));
    }
  }
  return unique(targets).slice(0, 50);
}

function buildOperatorCards(packet, initialGate, finalGate, policy) {
  const acceptance = object(packet.acceptance_summary);
  const findings = array(packet.operator_findings).map(findingSummary);
  const cards = [];

  cards.push({
    key: "acceptance",
    title: "Acceptance",
    status: acceptance.final_status ?? packet.status ?? "unknown",
    lines: [
      `accepted=${bool(acceptance.accepted)}`,
      `soft_acceptance_reached=${bool(acceptance.soft_acceptance_reached)}`,
      `revision_required_initially=${bool(acceptance.revision_required_initially)}`,
      `revision_required_finally=${bool(acceptance.revision_required_finally)}`,
    ],
  });

  cards.push({
    key: "reader_response_gate",
    title: "Reader Response Revision Gate",
    status: initialGate.status ?? "unavailable",
    lines: [
      `initial_revision_required=${bool(initialGate.revision_required)}`,
      `initial_revision_type=${initialGate.revision_type ?? "none"}`,
      `initial_return_stage=${initialGate.return_stage ?? "none"}`,
      `final_status=${finalGate.status ?? "unavailable"}`,
      `final_revision_required=${bool(finalGate.revision_required)}`,
    ],
  });

  if (policy && Object.keys(policy).length > 0) {
    cards.push({
      key: "recursive_revision_policy",
      title: "Recursive Revision Policy",
      status: policy.status ?? "unavailable",
      lines: [
        `revision_required=${bool(policy.revision_required)}`,
        `revision_type=${policy.revision_type ?? "none"}`,
        `return_stage=${policy.return_stage ?? "none"}`,
        `retry_allowed=${bool(policy.retry_allowed)}`,
      ],
    });
  }

  if (findings.length > 0) {
    cards.push({
      key: "operator_findings",
      title: "Operator Findings",
      status: `${findings.length} finding(s)`,
      lines: findings.slice(0, 5).map((finding) => {
        const key = finding.key ?? "finding";
        const stage = finding.return_stage ?? "unknown_stage";
        return `${finding.severity}:${key}->${stage}`;
      }),
    });
  }

  return cards;
}

function nextActionFor(acceptanceSummary) {
  if (acceptanceSummary.accepted && !acceptanceSummary.revision_required_finally) {
    return "output_final_candidate_text_to_chat";
  }
  if (acceptanceSummary.revision_required_finally) {
    return "review_revision_failure_or_continue_recursive_revision";
  }
  if (acceptanceSummary.revision_required_initially && !acceptanceSummary.accepted) {
    return "review_revision_failure";
  }
  return "review_pipeline_evidence_packet";
}

export function buildFullPipelineAcceptanceEvidencePacketBridgeSurface(raw = {}, options = {}) {
  const packet = sourcePacket(raw);
  if (Object.keys(packet).length === 0 || packet.used === false) {
    return disabledFullPipelineAcceptanceEvidencePacketBridgeSurface("source_packet_unavailable");
  }

  const decisionChain = object(packet.decision_chain);
  const initialReaderResponse = object(decisionChain.reader_response_simulator);
  const initialGate = object(decisionChain.reader_response_revision_gate);
  const recursivePolicy = object(decisionChain.recursive_revision_policy);
  const revisionPlan = object(decisionChain.revision_plan);
  const finalGate = object(decisionChain.final_reader_response_revision_gate);
  const acceptanceSummary = {
    accepted: bool(packet.acceptance_summary?.accepted),
    soft_acceptance_reached: bool(packet.acceptance_summary?.soft_acceptance_reached),
    revision_required_initially: bool(packet.acceptance_summary?.revision_required_initially),
    revision_required_finally: bool(packet.acceptance_summary?.revision_required_finally),
    recursive_revision_used: bool(packet.acceptance_summary?.recursive_revision_used),
    rounds_attempted: packet.acceptance_summary?.rounds_attempted ?? 0,
    max_revision_rounds: packet.acceptance_summary?.max_revision_rounds ?? null,
    final_status: packet.acceptance_summary?.final_status ?? packet.status ?? "unknown",
    pipeline_stage: packet.acceptance_summary?.pipeline_stage ?? null,
    stop_reason: packet.acceptance_summary?.stop_reason ?? null,
    final_candidate_source: packet.acceptance_summary?.final_candidate_source ?? null,
  };

  const operatorFindings = array(packet.operator_findings).map(findingSummary);
  const rewriteTargets = collectRewriteTargets(
    initialGate,
    finalGate,
    recursivePolicy,
    revisionPlan,
    { operator_findings: operatorFindings },
  );

  const surface = {
    used: true,
    phase: "34E",
    version: fullPipelineAcceptanceEvidencePacketBridgeSurfaceVersion,
    surface_kind: "full_pipeline_acceptance_evidence_packet_bridge_surface",
    bridge_surface: text(options.bridge_surface ?? options.bridgeSurface) || "chatgpt_bridge",
    status: packet.status ?? acceptanceSummary.final_status,
    read_only: true,
    integration_only: true,
    candidate_only: true,
    report_only: true,
    preview_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_settlement_update: true,
    source_packet_trace_id: packet.trace_id ?? null,
    source_packet_version: packet.version ?? null,
    source_packet_phase: packet.phase ?? null,
    source_packet_status: packet.status ?? null,
    acceptance_summary: acceptanceSummary,
    decision_chain_summary: {
      reader_response_simulator_used: initialReaderResponse.used === true,
      reader_response_simulator_status: initialReaderResponse.status ?? null,
      reader_response_revision_gate_used: initialGate.used === true,
      reader_response_revision_gate_status: initialGate.status ?? null,
      reader_response_revision_gate_revision_type: initialGate.revision_type ?? null,
      reader_response_revision_gate_return_stage: initialGate.return_stage ?? null,
      recursive_revision_policy_used: recursivePolicy.used === true,
      recursive_revision_policy_status: recursivePolicy.status ?? null,
      recursive_revision_policy_revision_type: recursivePolicy.revision_type ?? null,
      recursive_revision_policy_return_stage: recursivePolicy.return_stage ?? null,
      revision_plan_return_stage: revisionPlan.return_stage ?? null,
      revision_rounds_count: array(decisionChain.revision_rounds).length,
      final_reader_response_revision_gate_status: finalGate.status ?? null,
      final_reader_response_revision_required: finalGate.revision_required === true,
    },
    rewrite_targets: rewriteTargets,
    operator_findings: operatorFindings,
    operator_cards: buildOperatorCards(packet, initialGate, finalGate, recursivePolicy),
    bridge_metadata: {
      read_only_tool: true,
      writes_files: false,
      writes_only_to: [],
      source_phase: "34D",
      source_packet_available: true,
      source_packet_trace_id: packet.trace_id ?? null,
      source_packet_version: packet.version ?? null,
      chatgpt_safe_preview: true,
      include_raw_packet: options.include_raw_packet === true || options.includeRawPacket === true,
    },
    safety: {
      mcp_can_generate: false,
      mcp_can_save_candidate: false,
      mcp_can_approve: false,
      mcp_can_confirm_adoption: false,
      mcp_can_activate_engine: false,
      mcp_can_update_canon: false,
      mcp_can_update_active_engine: false,
      mcp_can_update_compressed_rules: false,
      mcp_can_update_settlement: false,
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
    next_action: nextActionFor(acceptanceSummary),
    warnings: array(packet.warnings),
  };

  if (surface.bridge_metadata.include_raw_packet) {
    surface.raw_packet = clone(packet);
  }

  surface.trace_id = "full_pipeline_acceptance_evidence_packet_bridge_surface_" + sha256(JSON.stringify({
    source_packet_trace_id: surface.source_packet_trace_id,
    final_status: surface.acceptance_summary.final_status,
    initial_gate_status: surface.decision_chain_summary.reader_response_revision_gate_status,
    final_gate_status: surface.decision_chain_summary.final_reader_response_revision_gate_status,
    rewrite_targets: surface.rewrite_targets,
  })).slice(0, 16);

  return surface;
}

export default buildFullPipelineAcceptanceEvidencePacketBridgeSurface;