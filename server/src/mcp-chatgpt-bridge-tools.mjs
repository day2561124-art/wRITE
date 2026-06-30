import {
  buildChatgptBridgeProofingContext,
  buildChatgptBridgeSettlementContext,
  buildChatgptBridgeWritingContext,
  chatgptBridgeSafety,
  getChatgptBridgeCurrentInputs,
  getChatgptBridgeForeshadowingSettlementSurface,
  getChatgptBridgeWorkbenchStatus,
  requestChatgptBridgeAdoption,
  runChatgptBridgeFullRecursiveWritingPipeline,
  saveChatgptBridgeCandidate,
  saveChatgptBridgeProofReport,
  saveChatgptBridgeSettlementReport,
} from "./chatgpt-bridge-service.mjs";
import {
  chatgpt_bridge_get_entity_registry_summary as _get_entity_registry_summary_handler,
  chatgpt_bridge_search_canon_entities as _search_canon_entities_handler,
  chatgpt_bridge_get_canon_entity_detail as _get_canon_entity_detail_handler,
  chatgpt_bridge_get_entity_conflicts as _get_entity_conflicts_handler,
  chatgpt_bridge_get_entity_registry_provenance as _get_registry_provenance_handler,
} from "./chatgpt-bridge-entity-registry-tools.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";
import { getAdoptedWritingSettlementContext } from "./adopted-writing-settlement-service.mjs";
import { buildForeshadowingSettlementSurface } from "./foreshadowing-settlement-surface-service.mjs";
import {
  buildForeshadowingSettlementOperatorReviewPanel,
} from "./foreshadowing-settlement-operator-review-panel-service.mjs";
import {
  buildForeshadowingSettlementOperatorReviewPanelUi,
} from "./foreshadowing-settlement-operator-review-panel-ui-service.mjs";
import {
  buildForeshadowingSettlementOperatorHandoffPacket,
} from "./foreshadowing-settlement-operator-handoff-packet-service.mjs";
import {
  buildForeshadowingSettlementOperatorHandoffAuditReceipt,
} from "./foreshadowing-settlement-operator-handoff-audit-receipt-service.mjs";
import {
  buildForeshadowingSettlementOperatorDecisionLedger,
} from "./foreshadowing-settlement-operator-decision-ledger-service.mjs";
import {
  buildForeshadowingSettlementOperatorLedgerUi,
} from "./foreshadowing-settlement-operator-ledger-ui-service.mjs";
import {
  buildForeshadowingSettlementOperatorLedgerBridgeSurface,
} from "./foreshadowing-settlement-operator-ledger-bridge-service.mjs";
import {
  runVisualLibraryMcpReadonlyToolPreview,
} from "./visual-library-mcp-readonly-tool-service.mjs";
import {
  runFullNeuralWritingPipelineSingleEntryBridge,
} from "./full-neural-writing-pipeline-single-entry-bridge-service.mjs";

function summarizeFullNeuralSurface(result = {}) {
  const existingSummary = result?.full_neural_orchestration_summary ?? null;
  if (existingSummary) {
    return {
      used: existingSummary.used === true,
      orchestrator_version: existingSummary.orchestrator_version ?? null,
      pipeline_stage: existingSummary.pipeline_stage ?? null,
      context_bundle_id: existingSummary.context_bundle_id ?? result?.source_bundle_id ?? null,
      writing_pipeline_complete: existingSummary.writing_pipeline_complete ?? null,
      acceptance_evidence_packet_bridge_surface_used:
        existingSummary.acceptance_evidence_packet_bridge_surface_used
        ?? result?.full_pipeline_acceptance_evidence_packet_bridge_surface?.used === true,
      acceptance_evidence_final_status:
        existingSummary.acceptance_evidence_final_status
        ?? result?.full_pipeline_acceptance_evidence_packet_bridge_surface?.acceptance_summary?.final_status
        ?? null,
      failure_output_surface_used:
        existingSummary.failure_output_surface_used
        ?? result?.failure_output_for_chat?.used === true,
      failure_output_next_action:
        existingSummary.failure_output_next_action
        ?? (result?.failure_output_for_chat?.used === true ? result.failure_output_for_chat.next_action : null),
      failure_output_blocked_stage:
        existingSummary.failure_output_blocked_stage
        ?? (result?.failure_output_for_chat?.used === true ? result.failure_output_for_chat.blocked_stage : null),
      success_output_surface_used:
        existingSummary.success_output_surface_used
        ?? result?.success_output_for_chat?.used === true,
      success_output_next_action:
        existingSummary.success_output_next_action
        ?? (result?.success_output_for_chat?.used === true
          ? result.success_output_for_chat.next_action
          : null),
      success_output_final_candidate_hash:
        existingSummary.success_output_final_candidate_hash
        ?? (result?.success_output_for_chat?.used === true
          ? result.success_output_for_chat.final_candidate_hash
          : null),
      final_response_surface_used:
        existingSummary.final_response_surface_used
        ?? result?.final_response_for_chat?.used === true,
      final_response_kind:
        existingSummary.final_response_kind
        ?? (result?.final_response_for_chat?.used === true
          ? result.final_response_for_chat.response_kind
          : null),
      final_response_body_hash:
        existingSummary.final_response_body_hash
        ?? (result?.final_response_for_chat?.used === true
          ? result.final_response_for_chat.body_hash
          : null),
      final_response_handoff_used:
        existingSummary.final_response_handoff_used
        ?? result?.final_response_handoff_for_chat?.used === true,
      final_response_handoff_valid:
        existingSummary.final_response_handoff_valid
        ?? result?.final_response_handoff_for_chat?.contract_valid === true,
      final_response_handoff_kind:
        existingSummary.final_response_handoff_kind
        ?? (result?.final_response_handoff_for_chat?.used === true
          ? result.final_response_handoff_for_chat.response_kind
          : null),
      final_response_handoff_body_hash:
        existingSummary.final_response_handoff_body_hash
        ?? (result?.final_response_handoff_for_chat?.used === true
          ? result.final_response_handoff_for_chat.body_hash
          : null),
      extracted_chatgpt_final_output_used:
        existingSummary.extracted_chatgpt_final_output_used
        ?? result?.extracted_chatgpt_final_output?.used === true,
      extracted_chatgpt_final_output_valid:
        existingSummary.extracted_chatgpt_final_output_valid
        ?? result?.extracted_chatgpt_final_output?.extraction_contract_valid === true,
      extracted_chatgpt_final_output_kind:
        existingSummary.extracted_chatgpt_final_output_kind
        ?? (result?.extracted_chatgpt_final_output?.used === true
          ? result.extracted_chatgpt_final_output.response_kind
          : null),
      extracted_chatgpt_final_output_hash:
        existingSummary.extracted_chatgpt_final_output_hash
        ?? (result?.extracted_chatgpt_final_output?.used === true
          ? result.extracted_chatgpt_final_output.output_hash
          : null),
      extracted_chatgpt_final_output_source:
        existingSummary.extracted_chatgpt_final_output_source
        ?? (result?.extracted_chatgpt_final_output?.used === true
          ? result.extracted_chatgpt_final_output.output_source
          : null),
      candidate_only: existingSummary.candidate_only ?? true,
      active_engine_update_allowed: existingSummary.active_engine_update_allowed ?? false,
      canon_update_allowed: existingSummary.canon_update_allowed ?? false,
    };
  }

  const report = result?.full_neural_orchestration_report
    ?? result?.final_polisher_result?.orchestration_report
    ?? null;

  if (!report) {
    return {
      used: result?.full_neural_orchestrator_used === true,
      orchestrator_version: result?.full_neural_orchestrator_version ?? null,
      pipeline_stage: result?.full_neural_pipeline_stage ?? null,
      context_bundle_id: result?.source_bundle_id ?? null,
      writing_pipeline_complete: null,
      final_response_surface_used: result?.final_response_for_chat?.used === true,
      final_response_kind: result?.final_response_for_chat?.used === true
        ? result.final_response_for_chat.response_kind
        : null,
      final_response_body_hash: result?.final_response_for_chat?.used === true
        ? result.final_response_for_chat.body_hash
        : null,
      final_response_handoff_used: result?.final_response_handoff_for_chat?.used === true,
      final_response_handoff_valid:
        result?.final_response_handoff_for_chat?.contract_valid === true,
      final_response_handoff_kind: result?.final_response_handoff_for_chat?.used === true
        ? result.final_response_handoff_for_chat.response_kind
        : null,
      final_response_handoff_body_hash: result?.final_response_handoff_for_chat?.used === true
        ? result.final_response_handoff_for_chat.body_hash
        : null,
      extracted_chatgpt_final_output_used: result?.extracted_chatgpt_final_output?.used === true,
      extracted_chatgpt_final_output_valid:
        result?.extracted_chatgpt_final_output?.extraction_contract_valid === true,
      extracted_chatgpt_final_output_kind: result?.extracted_chatgpt_final_output?.used === true
        ? result.extracted_chatgpt_final_output.response_kind
        : null,
      extracted_chatgpt_final_output_hash: result?.extracted_chatgpt_final_output?.used === true
        ? result.extracted_chatgpt_final_output.output_hash
        : null,
      extracted_chatgpt_final_output_source: result?.extracted_chatgpt_final_output?.used === true
        ? result.extracted_chatgpt_final_output.output_source
        : null,
      candidate_only: true,
      active_engine_update_allowed: false,
      canon_update_allowed: false,
    };
  }

  return {
    used: true,
    orchestrator_version: report.orchestration_version ?? null,
    pipeline_stage: report.pipeline_stage ?? null,
    context_bundle_id: report.context_bundle_id ?? result?.source_bundle_id ?? null,
    writing_pipeline_complete: report.writing_pipeline_complete ?? null,
    final_response_surface_used: result?.final_response_for_chat?.used === true,
    final_response_kind: result?.final_response_for_chat?.used === true
      ? result.final_response_for_chat.response_kind
      : null,
    final_response_body_hash: result?.final_response_for_chat?.used === true
      ? result.final_response_for_chat.body_hash
      : null,
    final_response_handoff_used: result?.final_response_handoff_for_chat?.used === true,
    final_response_handoff_valid:
      result?.final_response_handoff_for_chat?.contract_valid === true,
    final_response_handoff_kind: result?.final_response_handoff_for_chat?.used === true
      ? result.final_response_handoff_for_chat.response_kind
      : null,
    final_response_handoff_body_hash: result?.final_response_handoff_for_chat?.used === true
      ? result.final_response_handoff_for_chat.body_hash
      : null,
    extracted_chatgpt_final_output_used: result?.extracted_chatgpt_final_output?.used === true,
    extracted_chatgpt_final_output_valid:
      result?.extracted_chatgpt_final_output?.extraction_contract_valid === true,
    extracted_chatgpt_final_output_kind: result?.extracted_chatgpt_final_output?.used === true
      ? result.extracted_chatgpt_final_output.response_kind
      : null,
    extracted_chatgpt_final_output_hash: result?.extracted_chatgpt_final_output?.used === true
      ? result.extracted_chatgpt_final_output.output_hash
      : null,
    extracted_chatgpt_final_output_source: result?.extracted_chatgpt_final_output?.used === true
      ? result.extracted_chatgpt_final_output.output_source
      : null,
    candidate_only: report.candidate_only ?? true,
    active_engine_update_allowed: report.active_engine_update_allowed ?? false,
    canon_update_allowed: report.canon_update_allowed ?? false,
  };
}

function withFullNeuralSurface(result = {}) {
  const summary = summarizeFullNeuralSurface(result);
  return {
    ...result,
    full_neural_orchestrator_used: summary.used,
    full_neural_orchestrator_version: summary.orchestrator_version,
    full_neural_pipeline_stage: summary.pipeline_stage,
    full_neural_orchestration_summary: summary,
  };
}

function response(toolName, permission, result, created = []) {
  const surfacedResult = withFullNeuralSurface(result ?? {});
  const fullNeuralSummary = summarizeFullNeuralSurface(surfacedResult);

  return {
    ok: result?.ok !== false,
    tool_name: toolName,
    permission,
    result: surfacedResult,
    created,
    warnings: result?.warnings ?? [],
    blocked: result?.blocked === true,
    blocked_reason: result?.blocked_reason ?? null,
    full_neural_orchestrator_used: fullNeuralSummary.used === true,
    full_neural_orchestration_summary: fullNeuralSummary,
    safety: chatgptBridgeSafety,
  };
}

function blocked(toolName, permission, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission,
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
    safety: chatgptBridgeSafety,
  };
}

function tool(name, permission, handler, createdFor = () => []) {
  return async (input = {}, options = {}) => {
    try {
      const result = await handler(input, options);
      return response(name, permission, result, createdFor(result));
    } catch (error) {
      return blocked(name, permission, error);
    }
  };
}

async function getChatgptBridgeForeshadowingSettlementSurfaceForMcp(input = {}, options = {}) {
  const bundle = await getAdoptedWritingSettlementContext(
    input.id ?? input.settlement_context_id ?? input.settlementContextId,
    options,
  );
  return {
    ...buildForeshadowingSettlementSurface(bundle),
    generated_locally: false,
    bridge_surface: "chatgpt_bridge",
    active_engine_modified: false,
    pending_engine_candidate_created: false,
  };
}

async function getChatgptBridgeForeshadowingSettlementOperatorLedgerSurfaceForMcp(
  input = {},
  options = {},
) {
  const settlementContextId = input.id ?? input.settlement_context_id ?? input.settlementContextId;
  const bundle = await getAdoptedWritingSettlementContext(settlementContextId, options);
  const settlementSurface = buildForeshadowingSettlementSurface(bundle);
  const operatorPanel = buildForeshadowingSettlementOperatorReviewPanel({
    surface: settlementSurface,
    readiness: input.readiness_report ?? input.readiness ?? input.approval_readiness ?? {},
  });
  const operatorPanelUi = buildForeshadowingSettlementOperatorReviewPanelUi(operatorPanel);
  const handoffPacket = buildForeshadowingSettlementOperatorHandoffPacket({
    operator_panel_ui: operatorPanelUi,
  });
  const auditReceipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({
    handoff_packet: handoffPacket,
  });
  const decisionLedger = buildForeshadowingSettlementOperatorDecisionLedger({
    audit_receipt: auditReceipt,
  });
  const ledgerUi = buildForeshadowingSettlementOperatorLedgerUi({
    operator_decision_ledger: decisionLedger,
  });

  return {
    ...buildForeshadowingSettlementOperatorLedgerBridgeSurface({
      operator_ledger_ui: ledgerUi,
      operator_decision_ledger: decisionLedger,
      settlement_context_id: settlementContextId,
      approval_item_id: operatorPanel.approval_item_id,
      include_raw: input.include_raw ?? input.includeRaw,
      include_markdown: input.include_markdown ?? input.includeMarkdown,
      max_rows: input.max_rows ?? input.maxRows,
    }),
    generated_locally: false,
    bridge_surface: "chatgpt_bridge_mcp",
    active_engine_modified: false,
    pending_engine_candidate_created: false,
  };
}

export const chatgpt_bridge_get_workbench_status = tool(
  "chatgpt_bridge_get_workbench_status",
  "read_only",
  (_input, options) => getChatgptBridgeWorkbenchStatus(options),
);

export const chatgpt_bridge_get_current_inputs = tool(
  "chatgpt_bridge_get_current_inputs",
  "read_only",
  getChatgptBridgeCurrentInputs,
);

export const chatgpt_bridge_build_writing_context = tool(
  "chatgpt_bridge_build_writing_context",
  "write_low_risk",
  buildChatgptBridgeWritingContext,
  (result) => result.bundle ? [{
    label: "writing_context",
    target_id: result.bundle.bundle_id,
    canon_status: "context_only",
  }] : [],
);

export const chatgpt_bridge_save_candidate = tool(
  "chatgpt_bridge_save_candidate",
  "write_low_risk",
  saveChatgptBridgeCandidate,
  (result) => {
    const fullNeuralSummary = summarizeFullNeuralSurface(result);
    return result.candidate_created ? [{
      label: "writing_candidate",
      target_id: result.candidate_id,
      canon_status: "candidate_only",
      full_neural_orchestrator_used: fullNeuralSummary.used === true,
      full_neural_orchestrator_version: fullNeuralSummary.orchestrator_version ?? null,
      full_neural_pipeline_stage: fullNeuralSummary.pipeline_stage ?? null,
    }] : [];
  },
);

export const chatgpt_bridge_run_full_recursive_writing_pipeline = tool(
  "chatgpt_bridge_run_full_recursive_writing_pipeline",
  "write_low_risk",
  runChatgptBridgeFullRecursiveWritingPipeline,
  (result) => result.candidate_created ? [{
    label: "writing_candidate",
    target_id: result.candidate_id,
    canon_status: "candidate_only",
  }] : [],
);

export const chatgpt_bridge_run_full_neural_writing_pipeline = tool(
  "chatgpt_bridge_run_full_neural_writing_pipeline",
  "write_low_risk",
  runFullNeuralWritingPipelineSingleEntryBridge,
  (result) => result.candidate_created ? [{
    label: "writing_candidate",
    target_id: result.candidate_id,
    canon_status: "candidate_only",
    full_neural_single_entry_bridge_used: true,
    proofing_context_built: result.proofing_context?.built === true,
  }] : [],
);
export const chatgpt_bridge_build_proofing_context = tool(
  "chatgpt_bridge_build_proofing_context",
  "write_low_risk",
  buildChatgptBridgeProofingContext,
  (result) => result.context ? [{
    label: "proofing_context",
    target_id: result.context.proofing_context_id,
    canon_status: "context_only",
  }] : [],
);

export const chatgpt_bridge_save_proof_report = tool(
  "chatgpt_bridge_save_proof_report",
  "write_low_risk",
  saveChatgptBridgeProofReport,
  (result) => result.proof_report_created ? [{
    label: "proof_report",
    target_id: result.proof_report_id,
    canon_status: "candidate_only",
  }] : [],
);

export const chatgpt_bridge_request_adoption = tool(
  "chatgpt_bridge_request_adoption",
  "write_low_risk",
  requestChatgptBridgeAdoption,
  (result) => result.approval_item_created ? [{
    label: "approval_item",
    target_id: result.approval_item_id,
    canon_status: "approval_required",
  }] : [],
);

export const chatgpt_bridge_build_settlement_context = tool(
  "chatgpt_bridge_build_settlement_context",
  "write_low_risk",
  buildChatgptBridgeSettlementContext,
  (result) => result.context ? [{
    label: "settlement_context",
    target_id: result.context.settlement_context_id,
    canon_status: "context_only",
  }] : [],
);

export const chatgpt_bridge_get_foreshadowing_settlement_surface = tool(
  "chatgpt_bridge_get_foreshadowing_settlement_surface",
  "read_only",
  getChatgptBridgeForeshadowingSettlementSurfaceForMcp,
);

export const chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface = tool(
  "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
  "read_only",
  getChatgptBridgeForeshadowingSettlementOperatorLedgerSurfaceForMcp,
);

export const chatgpt_bridge_save_settlement_report = tool(
  "chatgpt_bridge_save_settlement_report",
  "write_low_risk",
  saveChatgptBridgeSettlementReport,
  (result) => result.settlement_report_created ? [{
    label: "settlement_report",
    target_id: result.settlement_report_id,
    canon_status: "settlement_report_only",
  }] : [],
);

export const chatgpt_bridge_visual_library_ui_import_flow_preview = tool(
  "chatgpt_bridge_visual_library_ui_import_flow_preview",
  "read_only",
  runVisualLibraryMcpReadonlyToolPreview,
);

export const chatgpt_bridge_get_entity_registry_summary = tool(
  "chatgpt_bridge_get_entity_registry_summary",
  "read_only",
  _get_entity_registry_summary_handler,
);

export const chatgpt_bridge_search_canon_entities = tool(
  "chatgpt_bridge_search_canon_entities",
  "read_only",
  _search_canon_entities_handler,
);

export const chatgpt_bridge_get_canon_entity_detail = tool(
  "chatgpt_bridge_get_canon_entity_detail",
  "read_only",
  _get_canon_entity_detail_handler,
);

export const chatgpt_bridge_get_entity_conflicts = tool(
  "chatgpt_bridge_get_entity_conflicts",
  "read_only",
  _get_entity_conflicts_handler,
);

export const chatgpt_bridge_get_entity_registry_provenance = tool(
  "chatgpt_bridge_get_entity_registry_provenance",
  "read_only",
  _get_registry_provenance_handler,
);

export const chatgptBridgeTools = {
  chatgpt_bridge_get_workbench_status,
  chatgpt_bridge_get_current_inputs,
  chatgpt_bridge_build_writing_context,
  chatgpt_bridge_save_candidate,
  chatgpt_bridge_run_full_recursive_writing_pipeline,
  chatgpt_bridge_build_proofing_context,
  chatgpt_bridge_save_proof_report,
  chatgpt_bridge_request_adoption,
  chatgpt_bridge_build_settlement_context,
  chatgpt_bridge_get_foreshadowing_settlement_surface,
  chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface,
  chatgpt_bridge_save_settlement_report,
  chatgpt_bridge_visual_library_ui_import_flow_preview,
  chatgpt_bridge_get_entity_registry_summary,
  chatgpt_bridge_search_canon_entities,
  chatgpt_bridge_get_canon_entity_detail,
  chatgpt_bridge_get_entity_conflicts,
  chatgpt_bridge_get_entity_registry_provenance,
};

const readMetadata = {
  permission: "read_only",
  writes_files: false,
  writes_only_to: [],
  ...chatgptBridgeSafety,
};

function writeMetadata(writesOnlyTo, extra = {}) {
  return {
    permission: "write_low_risk",
    writes_files: true,
    writes_only_to: writesOnlyTo.map(normalizeProjectPath),
    ...chatgptBridgeSafety,
    ...extra,
  };
}

export const chatgptBridgeToolMetadata = {
  chatgpt_bridge_get_workbench_status: { ...readMetadata },
  chatgpt_bridge_get_current_inputs: { ...readMetadata },
  chatgpt_bridge_build_writing_context: writeMetadata([
    projectPaths.gptWritingContexts,
    projectPaths.outputLogs,
  ]),
  chatgpt_bridge_save_candidate: writeMetadata([
    projectPaths.writingCandidates,
    projectPaths.outputLogs,
  ]),
  chatgpt_bridge_run_full_recursive_writing_pipeline: writeMetadata([
    projectPaths.gptWritingContexts,
    projectPaths.writingCandidates,
    projectPaths.outputLogs,
  ], {
    generation_preview_when_save_candidate_false: true,
    candidate_only_when_saved: true,
  }),
  chatgpt_bridge_build_proofing_context: writeMetadata([
    projectPaths.proofingContexts,
    projectPaths.outputLogs,
  ]),
  chatgpt_bridge_save_proof_report: writeMetadata([
    projectPaths.proofReports,
    projectPaths.writingCandidates,
    projectPaths.outputLogs,
  ]),
  chatgpt_bridge_request_adoption: writeMetadata([
    projectPaths.approvalQueue,
    projectPaths.writingCandidates,
    projectPaths.outputLogs,
  ], {
    creates_approval_item: true,
    requires_user_confirmation: true,
  }),
  chatgpt_bridge_build_settlement_context: writeMetadata([
    projectPaths.adoptedWritingSettlementContexts,
    projectPaths.adoptedWritings,
    projectPaths.outputLogs,
  ]),
  chatgpt_bridge_get_foreshadowing_settlement_surface: {
    ...readMetadata,
    permission: "read",
    writes_files: false,
    writes_only_to: [],
  },
  chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface: {
    ...readMetadata,
    permission: "read",
    writes_files: false,
    writes_only_to: [],
    bridge_surface_phase: "phase_27p",
  },
  chatgpt_bridge_save_settlement_report: writeMetadata([
    projectPaths.adoptedWritingSettlementReports,
    projectPaths.adoptedWritings,
    projectPaths.outputLogs,
  ]),
  chatgpt_bridge_visual_library_ui_import_flow_preview: { ...readMetadata },
  chatgpt_bridge_get_entity_registry_summary: { ...readMetadata },
  chatgpt_bridge_search_canon_entities: { ...readMetadata },
  chatgpt_bridge_get_canon_entity_detail: { ...readMetadata },
  chatgpt_bridge_get_entity_conflicts: { ...readMetadata },
  chatgpt_bridge_get_entity_registry_provenance: { ...readMetadata },
};
