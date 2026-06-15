import {
  buildChatgptBridgeProofingContext,
  buildChatgptBridgeSettlementContext,
  buildChatgptBridgeWritingContext,
  chatgptBridgeSafety,
  getChatgptBridgeCurrentInputs,
  getChatgptBridgeWorkbenchStatus,
  requestChatgptBridgeAdoption,
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
import {
  runVisualLibraryMcpReadonlyToolPreview,
} from "./visual-library-mcp-readonly-tool-service.mjs";

function response(toolName, permission, result, created = []) {
  return {
    ok: result?.ok !== false,
    tool_name: toolName,
    permission,
    result,
    created,
    warnings: result?.warnings ?? [],
    blocked: result?.blocked === true,
    blocked_reason: result?.blocked_reason ?? null,
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
  (result) => result.candidate_created ? [{
    label: "writing_candidate",
    target_id: result.candidate_id,
    canon_status: "candidate_only",
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
  chatgpt_bridge_build_proofing_context,
  chatgpt_bridge_save_proof_report,
  chatgpt_bridge_request_adoption,
  chatgpt_bridge_build_settlement_context,
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
