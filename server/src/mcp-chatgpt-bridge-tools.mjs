import { createHash } from "node:crypto";
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


function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

const chatgptFinalOutputToolSurfaceKind = "chatgpt_bridge_final_output_tool_surface_contract";
const chatgptFinalOutputToolSurfaceSource = "result.extracted_chatgpt_final_output.output_text";

function buildChatgptFinalOutputLockFields() {
  return {
    must_emit_exactly: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_fallback_to_final_candidate_text: false,
    may_fallback_to_success_output: false,
    may_fallback_to_failure_output: false,
    may_fallback_to_final_response: false,
    may_fallback_to_final_response_handoff: false,
    may_fallback_to_extracted_chatgpt_final_output: false,
    may_fallback_to_extracted_output_recomposition: false,
    may_construct_response: false,
  };
}

function buildChatgptFinalOutputSafety(sourceSafety = {}) {
  return {
    ...chatgptBridgeSafety,
    ...(sourceSafety ?? {}),
    candidate_only: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    can_modify_active_engine: false,
    can_update_canon: false,
    can_confirm_adoption: false,
  };
}

function buildUnusedChatgptFinalOutputToolSurface() {
  return {
    used: false,
    phase: "34R",
    surface_kind: chatgptFinalOutputToolSurfaceKind,
    reason: "not_a_chatgpt_final_output_tool_result",
  };
}

export function buildChatgptFinalOutputToolSurface(surfacedResult = {}) {
  const extracted = surfacedResult?.extracted_chatgpt_final_output ?? null;
  const validationErrors = [];

  if (extracted?.used !== true) {
    validationErrors.push("extracted_chatgpt_final_output_used_false_or_missing");
  }

  if (extracted?.extraction_contract_valid !== true) {
    validationErrors.push("extracted_chatgpt_final_output_contract_invalid");
  }

  if (typeof extracted?.output_text !== "string") {
    validationErrors.push("output_text_missing_or_not_string");
  }

  if (typeof extracted?.output_hash !== "string" || extracted.output_hash.length === 0) {
    validationErrors.push("output_hash_missing");
  } else if (typeof extracted?.output_text === "string" && extracted.output_hash !== sha256(extracted.output_text)) {
    validationErrors.push("output_hash_mismatch");
  }

  if (extracted?.must_emit_exactly !== true) {
    validationErrors.push("extracted_must_emit_exactly_not_true");
  }

  if (extracted?.no_extra_text !== true) {
    validationErrors.push("extracted_no_extra_text_not_true");
  }

  if (extracted?.no_fallback !== true) {
    validationErrors.push("extracted_no_fallback_not_true");
  }

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT bridge final output tool surface contract invalid.",
      "blocked_stage: chatgpt_final_output",
      "operator_action: inspect_result_extracted_chatgpt_final_output_contract",
    ].join("\n");

    return {
      used: true,
      phase: "34R",
      surface_kind: chatgptFinalOutputToolSurfaceKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_tool_surface_contract_invalid_notice",
      response_kind: "tool_surface_contract_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "chatgpt_final_output.tool_surface_contract_invalid_notice",
      final_output_source: "chatgpt_final_output.tool_surface_contract_invalid_notice",
      source: "chatgpt_final_output.tool_surface_contract_invalid_notice",
      source_surface: "chatgpt_final_output",
      source_response_kind: extracted?.response_kind ?? null,
      source_status: extracted?.status ?? null,
      source_output_hash: extracted?.output_hash ?? null,
      source_output_source: extracted?.output_source ?? null,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(extracted?.safety),
    };
  }

  return {
    used: true,
    phase: "34R",
    surface_kind: chatgptFinalOutputToolSurfaceKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_to_emit_chatgpt_final_output",
    response_kind: extracted.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: extracted.can_output_to_chat === true,
    may_output_story_text: extracted.may_output_story_text === true,
    output_text: extracted.output_text,
    output_hash: extracted.output_hash,
    output_source: chatgptFinalOutputToolSurfaceSource,
    final_output_source: chatgptFinalOutputToolSurfaceSource,
    source: chatgptFinalOutputToolSurfaceSource,
    source_surface: "result.extracted_chatgpt_final_output",
    source_response_kind: extracted.response_kind ?? null,
    source_status: extracted.status ?? null,
    source_output_hash: extracted.output_hash,
    source_output_source: extracted.output_source ?? null,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(extracted?.safety),
  };
}


const chatgptFinalOutputConsumerSurfaceKind = "chatgpt_bridge_final_output_consumer_contract";
const chatgptFinalOutputConsumerSource = "chatgpt_final_output.output_text";

export function buildChatgptFinalOutputConsumerEmission(toolResponse = {}) {
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const validationErrors = [];

  if (rootOutput?.used !== true) {
    validationErrors.push("chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("output_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("output_hash_missing");
  } else if (typeof rootOutput?.output_text === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("output_hash_mismatch");
  }

  if (rootOutput?.must_emit_exactly !== true) {
    validationErrors.push("chatgpt_final_output_must_emit_exactly_not_true");
  }

  if (rootOutput?.no_extra_text !== true) {
    validationErrors.push("chatgpt_final_output_no_extra_text_not_true");
  }

  if (rootOutput?.no_fallback !== true) {
    validationErrors.push("chatgpt_final_output_no_fallback_not_true");
  }

  if (rootOutput?.may_rewrite !== false) {
    validationErrors.push("chatgpt_final_output_may_rewrite_not_false");
  }

  if (rootOutput?.may_summarize !== false) {
    validationErrors.push("chatgpt_final_output_may_summarize_not_false");
  }

  if (rootOutput?.may_include_extra_explanation !== false) {
    validationErrors.push("chatgpt_final_output_extra_explanation_not_false");
  }

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT final output consumer contract invalid.",
      "blocked_stage: chatgpt_final_output_consumer",
      "operator_action: inspect_chatgpt_final_output_root_contract",
    ].join("\n");

    return {
      used: true,
      phase: "34S",
      surface_kind: chatgptFinalOutputConsumerSurfaceKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_consumer_contract_invalid_notice",
      response_kind: "consumer_contract_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "chatgpt_final_output_consumer.contract_invalid_notice",
      final_output_source: "chatgpt_final_output_consumer.contract_invalid_notice",
      source: "chatgpt_final_output_consumer.contract_invalid_notice",
      source_surface: "chatgpt_final_output_consumer",
      source_response_kind: rootOutput?.response_kind ?? null,
      source_status: rootOutput?.status ?? null,
      source_output_hash: rootOutput?.output_hash ?? null,
      source_output_source: rootOutput?.output_source ?? null,
      consumer_must_emit_output_text_exactly: true,
      consumer_output_source: "chatgpt_final_output.output_text",
      consumer_may_read_result: false,
      consumer_may_read_result_final_candidate_text: false,
      consumer_may_read_result_success_output: false,
      consumer_may_read_result_failure_output: false,
      consumer_may_read_result_final_response: false,
      consumer_may_read_result_final_response_handoff: false,
      consumer_may_read_result_extracted_chatgpt_final_output: false,
      consumer_may_recompose_from_result: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(rootOutput?.safety),
    };
  }

  return {
    used: true,
    phase: "34S",
    surface_kind: chatgptFinalOutputConsumerSurfaceKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_to_emit_consumer_final_output",
    response_kind: rootOutput.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: rootOutput.can_output_to_chat === true,
    may_output_story_text: rootOutput.may_output_story_text === true,
    output_text: rootOutput.output_text,
    output_hash: rootOutput.output_hash,
    output_source: chatgptFinalOutputConsumerSource,
    final_output_source: chatgptFinalOutputConsumerSource,
    source: chatgptFinalOutputConsumerSource,
    source_surface: "chatgpt_final_output",
    source_response_kind: rootOutput.response_kind ?? null,
    source_status: rootOutput.status ?? null,
    source_output_hash: rootOutput.output_hash,
    source_output_source: rootOutput.output_source ?? null,
    consumer_must_emit_output_text_exactly: true,
    consumer_output_source: "chatgpt_final_output.output_text",
    consumer_may_read_result: false,
    consumer_may_read_result_final_candidate_text: false,
    consumer_may_read_result_success_output: false,
    consumer_may_read_result_failure_output: false,
    consumer_may_read_result_final_response: false,
    consumer_may_read_result_final_response_handoff: false,
    consumer_may_read_result_extracted_chatgpt_final_output: false,
    consumer_may_recompose_from_result: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(rootOutput.safety),
  };
}


const chatgptFinalOutputE2EComplianceSurfaceKind = "chatgpt_final_output_end_to_end_compliance_smoke";
const chatgptFinalOutputE2EComplianceSource = "buildChatgptFinalOutputConsumerEmission.output_text";

export function buildChatgptFinalOutputE2EComplianceEmission(toolResponse = {}) {
  const consumer = buildChatgptFinalOutputConsumerEmission(toolResponse);
  const validationErrors = [];

  if (consumer?.used !== true) {
    validationErrors.push("consumer_emission_used_false_or_missing");
  }

  if (consumer?.contract_valid !== true) {
    validationErrors.push("consumer_emission_contract_invalid");
  }

  if (typeof consumer?.output_text !== "string") {
    validationErrors.push("consumer_output_text_missing_or_not_string");
  }

  if (typeof consumer?.output_hash !== "string" || consumer.output_hash.length === 0) {
    validationErrors.push("consumer_output_hash_missing");
  } else if (typeof consumer?.output_text === "string" && consumer.output_hash !== sha256(consumer.output_text)) {
    validationErrors.push("consumer_output_hash_mismatch");
  }

  if (consumer?.consumer_must_emit_output_text_exactly !== true) {
    validationErrors.push("consumer_must_emit_output_text_exactly_not_true");
  }

  if (consumer?.consumer_output_source !== "chatgpt_final_output.output_text") {
    validationErrors.push("consumer_output_source_not_root_chatgpt_final_output");
  }

  if (consumer?.consumer_may_read_result !== false) {
    validationErrors.push("consumer_may_read_result_not_false");
  }

  if (consumer?.consumer_may_recompose_from_result !== false) {
    validationErrors.push("consumer_may_recompose_from_result_not_false");
  }

  if (consumer?.must_emit_exactly !== true) {
    validationErrors.push("consumer_must_emit_exactly_not_true");
  }

  if (consumer?.no_extra_text !== true) {
    validationErrors.push("consumer_no_extra_text_not_true");
  }

  if (consumer?.no_fallback !== true) {
    validationErrors.push("consumer_no_fallback_not_true");
  }

  if (consumer?.may_rewrite !== false) {
    validationErrors.push("consumer_may_rewrite_not_false");
  }

  if (consumer?.may_summarize !== false) {
    validationErrors.push("consumer_may_summarize_not_false");
  }

  if (consumer?.may_include_extra_explanation !== false) {
    validationErrors.push("consumer_extra_explanation_not_false");
  }

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT final output E2E compliance contract invalid.",
      "blocked_stage: final_chatgpt_output_emit",
      "operator_action: inspect_consumer_emission_contract",
    ].join("\n");

    return {
      used: true,
      phase: "34T",
      surface_kind: chatgptFinalOutputE2EComplianceSurfaceKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_e2e_contract_invalid_notice",
      response_kind: "e2e_contract_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "final_chatgpt_output_emit.e2e_contract_invalid_notice",
      final_output_source: "final_chatgpt_output_emit.e2e_contract_invalid_notice",
      source: "final_chatgpt_output_emit.e2e_contract_invalid_notice",
      source_surface: "final_chatgpt_output_emit",
      source_response_kind: consumer?.response_kind ?? null,
      source_status: consumer?.status ?? null,
      source_output_hash: consumer?.output_hash ?? null,
      source_output_source: consumer?.output_source ?? null,
      final_chatgpt_output_text: outputText,
      final_chatgpt_output_hash: sha256(outputText),
      final_chatgpt_output_source: "final_chatgpt_output_emit.e2e_contract_invalid_notice",
      final_must_emit_exactly: true,
      final_no_extra_text: true,
      final_no_fallback: true,
      final_may_read_tool_response_result: false,
      final_may_rewrite: false,
      final_may_summarize: false,
      final_may_include_extra_explanation: false,
      final_may_construct_response: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(consumer?.safety),
    };
  }

  return {
    used: true,
    phase: "34T",
    surface_kind: chatgptFinalOutputE2EComplianceSurfaceKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_to_emit_final_chatgpt_output_text",
    response_kind: consumer.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: consumer.can_output_to_chat === true,
    may_output_story_text: consumer.may_output_story_text === true,
    output_text: consumer.output_text,
    output_hash: consumer.output_hash,
    output_source: chatgptFinalOutputE2EComplianceSource,
    final_output_source: chatgptFinalOutputE2EComplianceSource,
    source: chatgptFinalOutputE2EComplianceSource,
    source_surface: "chatgpt_final_output_consumer",
    source_response_kind: consumer.response_kind ?? null,
    source_status: consumer.status ?? null,
    source_output_hash: consumer.output_hash,
    source_output_source: consumer.output_source ?? null,
    final_chatgpt_output_text: consumer.output_text,
    final_chatgpt_output_hash: consumer.output_hash,
    final_chatgpt_output_source: chatgptFinalOutputE2EComplianceSource,
    final_must_emit_exactly: true,
    final_no_extra_text: true,
    final_no_fallback: true,
    final_may_read_tool_response_result: false,
    final_may_rewrite: false,
    final_may_summarize: false,
    final_may_include_extra_explanation: false,
    final_may_construct_response: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(consumer.safety),
  };
}

export function emitChatgptFinalOutputText(toolResponse = {}) {
  return buildChatgptFinalOutputE2EComplianceEmission(toolResponse).output_text;
}


const chatgptFinalOutputOperatorHandoffChecklistSurfaceKind = "chatgpt_final_output_operator_handoff_checklist";
const chatgptFinalOutputOperatorRequiredExpression = "emitChatgptFinalOutputText(tool_response)";

function buildChatgptFinalOutputOperatorChecklistItems() {
  return [
    {
      id: "must_emit_final_function_return_value_exactly",
      status: "required",
      instruction: "Output exactly emitChatgptFinalOutputText(tool_response).",
      required_value: true,
    },
    {
      id: "must_not_add_explanation",
      status: "required",
      instruction: "Do not add explanation, prefix, suffix, markdown, summary, or operator notes.",
      required_value: true,
    },
    {
      id: "must_not_rewrite_or_summarize",
      status: "required",
      instruction: "Do not rewrite, polish, shorten, expand, summarize, or repair the final output text.",
      required_value: true,
    },
    {
      id: "must_not_read_or_fallback_to_result_surfaces",
      status: "required",
      instruction: "Do not read or fallback to any result.* output surface.",
      forbidden_sources: [
        "result.final_candidate_text",
        "result.success_output_for_chat",
        "result.failure_output_for_chat",
        "result.final_response_for_chat",
        "result.final_response_handoff_for_chat",
        "result.extracted_chatgpt_final_output",
      ],
      required_value: true,
    },
    {
      id: "must_preserve_candidate_only_safety",
      status: "required",
      instruction: "Treat emitted text as candidate-only; do not save, approve, adopt, update canon, or update active_engine.",
      required_value: true,
    },
  ];
}

export function buildChatgptFinalOutputOperatorHandoffChecklist(toolResponse = {}) {
  const e2e = buildChatgptFinalOutputE2EComplianceEmission(toolResponse);
  const finalText = emitChatgptFinalOutputText(toolResponse);
  const validationErrors = [];

  if (e2e?.used !== true) {
    validationErrors.push("e2e_emission_used_false_or_missing");
  }

  if (e2e?.contract_valid !== true) {
    validationErrors.push("e2e_emission_contract_invalid");
  }

  if (typeof e2e?.output_text !== "string") {
    validationErrors.push("e2e_output_text_missing_or_not_string");
  }

  if (typeof e2e?.output_hash !== "string" || e2e.output_hash.length === 0) {
    validationErrors.push("e2e_output_hash_missing");
  } else if (typeof e2e?.output_text === "string" && e2e.output_hash !== sha256(e2e.output_text)) {
    validationErrors.push("e2e_output_hash_mismatch");
  }

  if (finalText !== e2e?.output_text) {
    validationErrors.push("emit_function_output_text_mismatch");
  }

  if (e2e?.final_chatgpt_output_text !== e2e?.output_text) {
    validationErrors.push("final_chatgpt_output_text_mismatch");
  }

  if (e2e?.final_must_emit_exactly !== true) {
    validationErrors.push("final_must_emit_exactly_not_true");
  }

  if (e2e?.final_no_extra_text !== true) {
    validationErrors.push("final_no_extra_text_not_true");
  }

  if (e2e?.final_no_fallback !== true) {
    validationErrors.push("final_no_fallback_not_true");
  }

  if (e2e?.final_may_read_tool_response_result !== false) {
    validationErrors.push("final_may_read_tool_response_result_not_false");
  }

  if (e2e?.final_may_rewrite !== false) {
    validationErrors.push("final_may_rewrite_not_false");
  }

  if (e2e?.final_may_summarize !== false) {
    validationErrors.push("final_may_summarize_not_false");
  }

  if (e2e?.final_may_include_extra_explanation !== false) {
    validationErrors.push("final_may_include_extra_explanation_not_false");
  }

  if (e2e?.final_may_construct_response !== false) {
    validationErrors.push("final_may_construct_response_not_false");
  }

  const checklistItems = buildChatgptFinalOutputOperatorChecklistItems();

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT final output operator handoff checklist contract invalid.",
      "blocked_stage: final_output_operator_handoff_checklist",
      "operator_action: inspect_final_output_e2e_compliance_contract",
    ].join("\n");

    return {
      used: true,
      phase: "34U",
      surface_kind: chatgptFinalOutputOperatorHandoffChecklistSurfaceKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_operator_handoff_checklist_contract_invalid_notice",
      response_kind: "operator_handoff_checklist_contract_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      required_output_expression: chatgptFinalOutputOperatorRequiredExpression,
      operator_must_emit_expression_result_exactly: true,
      operator_output_text: outputText,
      operator_output_hash: sha256(outputText),
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "operator_handoff_checklist.contract_invalid_notice",
      final_output_source: "operator_handoff_checklist.contract_invalid_notice",
      source: "operator_handoff_checklist.contract_invalid_notice",
      source_surface: "chatgpt_final_output_operator_handoff_checklist",
      source_response_kind: e2e?.response_kind ?? null,
      source_status: e2e?.status ?? null,
      source_output_hash: e2e?.output_hash ?? null,
      source_output_source: e2e?.output_source ?? null,
      checklist_items: checklistItems,
      checklist_passed: false,
      forbidden_sources: checklistItems.find((item) => item.id === "must_not_read_or_fallback_to_result_surfaces").forbidden_sources,
      upstream_reference_chain: [
        "emitChatgptFinalOutputText(tool_response)",
        "buildChatgptFinalOutputE2EComplianceEmission(tool_response).output_text",
        "buildChatgptFinalOutputConsumerEmission(tool_response).output_text",
        "tool_response.chatgpt_final_output.output_text",
      ],
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(e2e?.safety),
    };
  }

  return {
    used: true,
    phase: "34U",
    surface_kind: chatgptFinalOutputOperatorHandoffChecklistSurfaceKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_to_use_operator_handoff_checklist",
    response_kind: e2e.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: e2e.can_output_to_chat === true,
    may_output_story_text: e2e.may_output_story_text === true,
    required_output_expression: chatgptFinalOutputOperatorRequiredExpression,
    operator_must_emit_expression_result_exactly: true,
    operator_output_text: finalText,
    operator_output_hash: sha256(finalText),
    output_text: finalText,
    output_hash: sha256(finalText),
    output_source: "emitChatgptFinalOutputText(tool_response)",
    final_output_source: "emitChatgptFinalOutputText(tool_response)",
    source: "emitChatgptFinalOutputText(tool_response)",
    source_surface: "chatgpt_final_output_e2e_compliance",
    source_response_kind: e2e.response_kind ?? null,
    source_status: e2e.status ?? null,
    source_output_hash: e2e.output_hash,
    source_output_source: e2e.output_source ?? null,
    checklist_items: checklistItems,
    checklist_passed: true,
    forbidden_sources: checklistItems.find((item) => item.id === "must_not_read_or_fallback_to_result_surfaces").forbidden_sources,
    upstream_reference_chain: [
      "emitChatgptFinalOutputText(tool_response)",
      "buildChatgptFinalOutputE2EComplianceEmission(tool_response).output_text",
      "buildChatgptFinalOutputConsumerEmission(tool_response).output_text",
      "tool_response.chatgpt_final_output.output_text",
    ],
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(e2e.safety),
  };
}


const chatgptFinalOutputFinalClosureIndexSurfaceKind = "chatgpt_final_output_contract_final_closure_index";
const chatgptFinalOutputFinalClosureRequiredEntryPoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputFinalClosureChecklistFunction = "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)";

function buildChatgptFinalOutputFinalClosureIndexEntries() {
  return [
    {
      phase: "34J",
      name: "ChatGPT bridge final candidate output contract",
      test_path: "tests/phase34/phase34j-chatgpt-bridge-final-candidate-output-contract.test.mjs",
      role: "candidate_success_output_contract",
    },
    {
      phase: "34K",
      name: "ChatGPT bridge failure output contract",
      test_path: "tests/phase34/phase34k-chatgpt-bridge-failure-output-contract.test.mjs",
      role: "pipeline_failure_output_contract",
    },
    {
      phase: "34L",
      name: "ChatGPT bridge failure readable surface",
      test_path: "tests/phase34/phase34l-chatgpt-bridge-failure-readable-surface.test.mjs",
      role: "failure_output_readable_surface",
    },
    {
      phase: "34M",
      name: "ChatGPT bridge success readable surface",
      test_path: "tests/phase34/phase34m-chatgpt-bridge-success-readable-surface.test.mjs",
      role: "success_output_readable_surface",
    },
    {
      phase: "34N",
      name: "ChatGPT bridge output surface symmetry regression",
      test_path: "tests/phase34/phase34n-chatgpt-bridge-output-surface-symmetry-regression.test.mjs",
      role: "success_failure_surface_symmetry_regression",
    },
    {
      phase: "34O",
      name: "ChatGPT bridge final response renderer contract",
      test_path: "tests/phase34/phase34o-chatgpt-bridge-final-response-renderer-contract.test.mjs",
      role: "final_response_for_chat_renderer_contract",
    },
    {
      phase: "34P",
      name: "ChatGPT bridge final response handoff contract",
      test_path: "tests/phase34/phase34p-chatgpt-bridge-final-response-handoff-contract.test.mjs",
      role: "final_response_handoff_for_chat_contract",
    },
    {
      phase: "34Q",
      name: "ChatGPT bridge final output live extraction contract",
      test_path: "tests/phase34/phase34q-chatgpt-bridge-final-output-live-extraction-contract.test.mjs",
      role: "extracted_chatgpt_final_output_contract",
    },
    {
      phase: "34R",
      name: "ChatGPT bridge final output tool surface contract",
      test_path: "tests/phase34/phase34r-chatgpt-bridge-final-output-tool-surface-contract.test.mjs",
      role: "root_chatgpt_final_output_tool_surface_contract",
    },
    {
      phase: "34S",
      name: "ChatGPT bridge final output consumer contract",
      test_path: "tests/phase34/phase34s-chatgpt-bridge-final-output-consumer-contract.test.mjs",
      role: "consumer_emission_contract",
    },
    {
      phase: "34T",
      name: "ChatGPT final output E2E compliance smoke",
      test_path: "tests/phase34/phase34t-chatgpt-final-output-e2e-compliance-smoke.test.mjs",
      role: "final_chatgpt_output_e2e_compliance_smoke",
    },
    {
      phase: "34U",
      name: "ChatGPT final output operator handoff checklist",
      test_path: "tests/phase34/phase34u-chatgpt-final-output-operator-handoff-checklist.test.mjs",
      role: "operator_handoff_checklist",
    },
  ];
}

function buildChatgptFinalOutputFinalClosureForbiddenSources() {
  return [
    "result.final_candidate_text",
    "result.success_output_for_chat",
    "result.failure_output_for_chat",
    "result.final_response_for_chat",
    "result.final_response_handoff_for_chat",
    "result.extracted_chatgpt_final_output",
  ];
}

function buildChatgptFinalOutputFinalClosureReferenceChain() {
  return [
    "emitChatgptFinalOutputText(tool_response)",
    "buildChatgptFinalOutputE2EComplianceEmission(tool_response).output_text",
    "buildChatgptFinalOutputConsumerEmission(tool_response).output_text",
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result.extracted_chatgpt_final_output.output_text",
    "tool_response.result.final_response_handoff_for_chat.body",
    "tool_response.result.final_response_for_chat.body",
    "tool_response.result.success_output_for_chat.final_candidate_text_to_output OR tool_response.result.failure_output_for_chat",
  ];
}

export function buildChatgptFinalOutputContractFinalClosureIndex(toolResponse = {}) {
  const checklist = buildChatgptFinalOutputOperatorHandoffChecklist(toolResponse);
  const finalText = emitChatgptFinalOutputText(toolResponse);
  const indexEntries = buildChatgptFinalOutputFinalClosureIndexEntries();
  const forbiddenSources = buildChatgptFinalOutputFinalClosureForbiddenSources();
  const referenceChain = buildChatgptFinalOutputFinalClosureReferenceChain();
  const validationErrors = [];

  if (checklist?.used !== true) {
    validationErrors.push("operator_handoff_checklist_used_false_or_missing");
  }

  if (checklist?.contract_valid !== true) {
    validationErrors.push("operator_handoff_checklist_contract_invalid");
  }

  if (checklist?.required_output_expression !== chatgptFinalOutputFinalClosureRequiredEntryPoint) {
    validationErrors.push("required_output_expression_mismatch");
  }

  if (checklist?.operator_must_emit_expression_result_exactly !== true) {
    validationErrors.push("operator_must_emit_expression_result_exactly_not_true");
  }

  if (typeof finalText !== "string") {
    validationErrors.push("emit_final_text_missing_or_not_string");
  }

  if (typeof checklist?.operator_output_text !== "string") {
    validationErrors.push("operator_output_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof checklist?.operator_output_text === "string" && checklist.operator_output_text !== finalText) {
    validationErrors.push("operator_output_text_emit_function_mismatch");
  }

  if (typeof checklist?.operator_output_hash !== "string" || checklist.operator_output_hash.length === 0) {
    validationErrors.push("operator_output_hash_missing");
  } else if (typeof checklist?.operator_output_text === "string" && checklist.operator_output_hash !== sha256(checklist.operator_output_text)) {
    validationErrors.push("operator_output_hash_mismatch");
  }

  if (checklist?.checklist_passed !== true) {
    validationErrors.push("operator_checklist_not_passed");
  }

  if (checklist?.no_extra_text !== true) {
    validationErrors.push("checklist_no_extra_text_not_true");
  }

  if (checklist?.no_fallback !== true) {
    validationErrors.push("checklist_no_fallback_not_true");
  }

  if (checklist?.may_rewrite !== false) {
    validationErrors.push("checklist_may_rewrite_not_false");
  }

  if (checklist?.may_summarize !== false) {
    validationErrors.push("checklist_may_summarize_not_false");
  }

  if (checklist?.may_include_extra_explanation !== false) {
    validationErrors.push("checklist_extra_explanation_not_false");
  }

  if (checklist?.may_construct_response !== false) {
    validationErrors.push("checklist_may_construct_response_not_false");
  }

  if (checklist?.may_read_tool_response_result !== false) {
    validationErrors.push("checklist_may_read_tool_response_result_not_false");
  }

  if (checklist?.may_update_canon !== false) {
    validationErrors.push("checklist_may_update_canon_not_false");
  }

  if (checklist?.may_update_active_engine !== false) {
    validationErrors.push("checklist_may_update_active_engine_not_false");
  }

  if (JSON.stringify(checklist?.forbidden_sources ?? []) !== JSON.stringify(forbiddenSources)) {
    validationErrors.push("forbidden_sources_mismatch");
  }

  if (!indexEntries.every((entry) => entry.phase && entry.test_path && entry.role)) {
    validationErrors.push("final_closure_index_entry_shape_invalid");
  }

  const expectedPhases = ["34J", "34K", "34L", "34M", "34N", "34O", "34P", "34Q", "34R", "34S", "34T", "34U"];
  const actualPhases = indexEntries.map((entry) => entry.phase);
  if (JSON.stringify(actualPhases) !== JSON.stringify(expectedPhases)) {
    validationErrors.push("final_closure_index_phase_order_mismatch");
  }

  if (validationErrors.length > 0) {
    const notice = [
      "ChatGPT final output contract final closure index invalid.",
      "blocked_stage: final_output_contract_final_closure_index",
      "operator_action: inspect_phase34_final_output_operator_handoff_checklist",
    ].join("\n");

    return {
      used: true,
      phase: "34V",
      surface_kind: chatgptFinalOutputFinalClosureIndexSurfaceKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_final_closure_index_contract_invalid_notice",
      response_kind: "final_closure_index_contract_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      phase_range: "34J-34U",
      covered_phases: expectedPhases,
      final_unique_output_entrypoint: chatgptFinalOutputFinalClosureRequiredEntryPoint,
      final_operator_handoff_checklist: chatgptFinalOutputFinalClosureChecklistFunction,
      root_tool_surface: "tool_response.chatgpt_final_output.output_text",
      no_new_output_layer: true,
      index_is_reference_only: true,
      index_must_not_replace_final_output: true,
      index_must_not_be_emitted_as_chat_output: true,
      final_output_must_still_use_entrypoint: true,
      reference_final_output_text: notice,
      reference_final_output_hash: sha256(notice),
      contract_invalid_notice_text: notice,
      contract_invalid_notice_hash: sha256(notice),
      forbidden_sources: forbiddenSources,
      upstream_reference_chain: referenceChain,
      final_closure_index_entries: indexEntries,
      source_response_kind: checklist?.response_kind ?? null,
      source_status: checklist?.status ?? null,
      source_output_hash: checklist?.operator_output_hash ?? null,
      source_output_source: checklist?.output_source ?? null,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(checklist?.safety),
    };
  }

  return {
    used: true,
    phase: "34V",
    surface_kind: chatgptFinalOutputFinalClosureIndexSurfaceKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_to_use_final_closure_index",
    response_kind: checklist.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: checklist.can_output_to_chat === true,
    may_output_story_text: checklist.may_output_story_text === true,
    phase_range: "34J-34U",
    covered_phases: indexEntries.map((entry) => entry.phase),
    final_unique_output_entrypoint: chatgptFinalOutputFinalClosureRequiredEntryPoint,
    final_operator_handoff_checklist: chatgptFinalOutputFinalClosureChecklistFunction,
    root_tool_surface: "tool_response.chatgpt_final_output.output_text",
    internal_source_chain: [
      "success_output_for_chat / failure_output_for_chat",
      "final_response_for_chat",
      "final_response_handoff_for_chat",
      "extracted_chatgpt_final_output",
      "chatgpt_final_output",
      "consumer emission contract",
      "E2E compliance emission",
      "operator handoff checklist",
      "emitChatgptFinalOutputText(tool_response)",
    ],
    upstream_reference_chain: referenceChain,
    final_closure_index_entries: indexEntries,
    final_closure_status: "phase34_output_contract_closed",
    no_new_output_layer: true,
    index_is_reference_only: true,
    index_must_not_replace_final_output: true,
    index_must_not_be_emitted_as_chat_output: true,
    final_output_must_still_use_entrypoint: true,
    reference_final_output_text: finalText,
    reference_final_output_hash: sha256(finalText),
    reference_final_output_source: chatgptFinalOutputFinalClosureRequiredEntryPoint,
    forbidden_sources: forbiddenSources,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(checklist.safety),
  };
}


const chatgptFinalOutputLiveToolCallAcceptanceSmokeSurfaceKind = "chatgpt_final_output_live_tool_call_acceptance_smoke";
const chatgptFinalOutputLiveToolCallAcceptanceEntrypoint = "emitChatgptFinalOutputText(tool_response)";

export function buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(toolResponse = {}) {
  const finalClosureIndex = buildChatgptFinalOutputContractFinalClosureIndex(toolResponse);
  const acceptedText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (rootOutput?.used !== true) {
    validationErrors.push("root_chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("root_chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("root_chatgpt_final_output_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("root_chatgpt_final_output_hash_missing");
  } else if (typeof rootOutput?.output_text === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (toolResponse?.result == null || typeof toolResponse.result !== "object") {
    validationErrors.push("tool_response_result_missing_or_not_object");
  }

  if (finalClosureIndex?.used !== true) {
    validationErrors.push("final_closure_index_used_false_or_missing");
  }

  if (finalClosureIndex?.contract_valid !== true) {
    validationErrors.push("final_closure_index_contract_invalid");
  }

  if (finalClosureIndex?.final_unique_output_entrypoint !== chatgptFinalOutputLiveToolCallAcceptanceEntrypoint) {
    validationErrors.push("final_closure_entrypoint_mismatch");
  }

  if (finalClosureIndex?.root_tool_surface !== "tool_response.chatgpt_final_output.output_text") {
    validationErrors.push("final_closure_root_tool_surface_mismatch");
  }

  if (finalClosureIndex?.no_new_output_layer !== true) {
    validationErrors.push("final_closure_no_new_output_layer_not_true");
  }

  if (finalClosureIndex?.index_is_reference_only !== true) {
    validationErrors.push("final_closure_index_reference_only_not_true");
  }

  if (finalClosureIndex?.index_must_not_replace_final_output !== true) {
    validationErrors.push("final_closure_index_replace_guard_not_true");
  }

  if (finalClosureIndex?.index_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("final_closure_index_emit_guard_not_true");
  }

  if (finalClosureIndex?.final_output_must_still_use_entrypoint !== true) {
    validationErrors.push("final_closure_output_entrypoint_guard_not_true");
  }

  if (typeof acceptedText !== "string") {
    validationErrors.push("accepted_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_text === "string" && acceptedText !== rootOutput.output_text) {
    validationErrors.push("accepted_text_root_output_text_mismatch");
  }

  if (typeof finalClosureIndex?.reference_final_output_text === "string" && acceptedText !== finalClosureIndex.reference_final_output_text) {
    validationErrors.push("accepted_text_final_closure_reference_mismatch");
  }

  if (finalClosureIndex?.may_read_tool_response_result !== false) {
    validationErrors.push("final_closure_may_read_tool_response_result_not_false");
  }

  if (finalClosureIndex?.may_rewrite !== false) {
    validationErrors.push("final_closure_may_rewrite_not_false");
  }

  if (finalClosureIndex?.may_summarize !== false) {
    validationErrors.push("final_closure_may_summarize_not_false");
  }

  if (finalClosureIndex?.may_include_extra_explanation !== false) {
    validationErrors.push("final_closure_extra_explanation_not_false");
  }

  if (finalClosureIndex?.may_construct_response !== false) {
    validationErrors.push("final_closure_construct_response_not_false");
  }

  if (finalClosureIndex?.may_update_canon !== false) {
    validationErrors.push("final_closure_update_canon_not_false");
  }

  if (finalClosureIndex?.may_update_active_engine !== false) {
    validationErrors.push("final_closure_update_active_engine_not_false");
  }

  const forbiddenSources = [
    "result.final_candidate_text",
    "result.success_output_for_chat",
    "result.failure_output_for_chat",
    "result.final_response_for_chat",
    "result.final_response_handoff_for_chat",
    "result.extracted_chatgpt_final_output",
    "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
    "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
  ];

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT final output live tool call acceptance smoke invalid.",
      "blocked_stage: final_output_live_tool_call_acceptance",
      "operator_action: inspect_live_tool_call_final_output_contract",
    ].join("\n");

    return {
      used: true,
      phase: "34W",
      surface_kind: chatgptFinalOutputLiveToolCallAcceptanceSmokeSurfaceKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_live_tool_call_acceptance_invalid_notice",
      response_kind: "live_tool_call_acceptance_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      live_tool_call_shape: "mcp_tool_response_wrapper",
      final_unique_output_entrypoint: chatgptFinalOutputLiveToolCallAcceptanceEntrypoint,
      accepted_chatgpt_output_text: outputText,
      accepted_chatgpt_output_hash: sha256(outputText),
      accepted_chatgpt_output_source: "live_tool_call_acceptance.invalid_notice",
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "live_tool_call_acceptance.invalid_notice",
      final_output_source: "live_tool_call_acceptance.invalid_notice",
      source: "live_tool_call_acceptance.invalid_notice",
      source_surface: "chatgpt_final_output_live_tool_call_acceptance_smoke",
      source_response_kind: finalClosureIndex?.response_kind ?? null,
      source_status: finalClosureIndex?.status ?? null,
      source_output_hash: finalClosureIndex?.reference_final_output_hash ?? null,
      source_output_source: finalClosureIndex?.reference_final_output_source ?? null,
      must_emit_accepted_text_exactly: true,
      must_not_emit_index: true,
      must_not_emit_operator_checklist: true,
      must_not_emit_result_surface: true,
      must_not_emit_result_final_candidate_text: true,
      must_not_emit_result_success_output: true,
      must_not_emit_result_failure_output: true,
      must_not_emit_result_final_response: true,
      must_not_emit_result_final_response_handoff: true,
      must_not_emit_result_extracted_chatgpt_final_output: true,
      forbidden_sources: forbiddenSources,
      no_new_output_layer: true,
      acceptance_smoke_is_reference_only: true,
      acceptance_smoke_must_not_replace_final_output: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(finalClosureIndex?.safety),
    };
  }

  return {
    used: true,
    phase: "34W",
    surface_kind: chatgptFinalOutputLiveToolCallAcceptanceSmokeSurfaceKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_to_accept_live_tool_call_final_output",
    response_kind: finalClosureIndex.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: finalClosureIndex.can_output_to_chat === true,
    may_output_story_text: finalClosureIndex.may_output_story_text === true,
    live_tool_call_shape: "mcp_tool_response_wrapper",
    final_unique_output_entrypoint: chatgptFinalOutputLiveToolCallAcceptanceEntrypoint,
    accepted_chatgpt_output_text: acceptedText,
    accepted_chatgpt_output_hash: sha256(acceptedText),
    accepted_chatgpt_output_source: chatgptFinalOutputLiveToolCallAcceptanceEntrypoint,
    output_text: acceptedText,
    output_hash: sha256(acceptedText),
    output_source: chatgptFinalOutputLiveToolCallAcceptanceEntrypoint,
    final_output_source: chatgptFinalOutputLiveToolCallAcceptanceEntrypoint,
    source: chatgptFinalOutputLiveToolCallAcceptanceEntrypoint,
    source_surface: "chatgpt_final_output_live_tool_call_acceptance",
    source_response_kind: finalClosureIndex.response_kind ?? null,
    source_status: finalClosureIndex.status ?? null,
    source_output_hash: finalClosureIndex.reference_final_output_hash,
    source_output_source: finalClosureIndex.reference_final_output_source ?? null,
    root_tool_surface: "tool_response.chatgpt_final_output.output_text",
    root_output_text_hash: rootOutput.output_hash,
    final_closure_index_status: finalClosureIndex.status,
    final_closure_index_is_reference_only: finalClosureIndex.index_is_reference_only === true,
    final_closure_index_must_not_be_emitted_as_chat_output: finalClosureIndex.index_must_not_be_emitted_as_chat_output === true,
    must_emit_accepted_text_exactly: true,
    must_not_emit_index: true,
    must_not_emit_operator_checklist: true,
    must_not_emit_result_surface: true,
    must_not_emit_result_final_candidate_text: true,
    must_not_emit_result_success_output: true,
    must_not_emit_result_failure_output: true,
    must_not_emit_result_final_response: true,
    must_not_emit_result_final_response_handoff: true,
    must_not_emit_result_extracted_chatgpt_final_output: true,
    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    acceptance_smoke_is_reference_only: true,
    acceptance_smoke_must_not_replace_final_output: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(finalClosureIndex.safety),
  };
}

export function acceptChatgptFinalOutputFromLiveToolCall(toolResponse = {}) {
  return buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(toolResponse).accepted_chatgpt_output_text;
}


const chatgptFinalOutputRealActionSurfaceReadinessKind = "chatgpt_final_output_real_action_surface_readiness";
const chatgptFinalOutputRealActionSurfaceEntrypoint = "acceptChatgptFinalOutputFromLiveToolCall(tool_response)";
const chatgptFinalOutputRealActionCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputRealActionConsumableField = "tool_response.chatgpt_final_output.output_text";

export function buildChatgptFinalOutputRealActionSurfaceReadiness(toolResponse = {}) {
  const liveAcceptance = buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(toolResponse);
  const acceptedText = acceptChatgptFinalOutputFromLiveToolCall(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object" ? Object.keys(toolResponse) : [];
  const rootIndex = topLevelKeys.indexOf("chatgpt_final_output");
  const resultIndex = topLevelKeys.indexOf("result");
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.ok !== true) {
    validationErrors.push("tool_response_ok_not_true");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (toolResponse?.permission !== "write_low_risk") {
    validationErrors.push("tool_response_permission_not_write_low_risk");
  }

  if (toolResponse?.blocked !== false) {
    validationErrors.push("tool_response_blocked_not_false");
  }

  if (!Array.isArray(toolResponse?.created)) {
    validationErrors.push("tool_response_created_not_array");
  }

  if (rootIndex < 0) {
    validationErrors.push("root_chatgpt_final_output_top_level_missing");
  }

  if (resultIndex < 0) {
    validationErrors.push("result_top_level_missing");
  }

  if (rootIndex >= 0 && resultIndex >= 0 && rootIndex > resultIndex) {
    validationErrors.push("root_chatgpt_final_output_should_precede_result");
  }

  if (rootOutput?.used !== true) {
    validationErrors.push("root_chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("root_chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("root_chatgpt_final_output_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("root_chatgpt_final_output_hash_missing");
  } else if (typeof rootOutput?.output_text === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (liveAcceptance?.used !== true) {
    validationErrors.push("live_acceptance_used_false_or_missing");
  }

  if (liveAcceptance?.contract_valid !== true) {
    validationErrors.push("live_acceptance_contract_invalid");
  }

  if (liveAcceptance?.final_unique_output_entrypoint !== chatgptFinalOutputRealActionCanonicalEntrypoint) {
    validationErrors.push("live_acceptance_canonical_entrypoint_mismatch");
  }

  if (liveAcceptance?.root_tool_surface !== chatgptFinalOutputRealActionConsumableField) {
    validationErrors.push("live_acceptance_root_tool_surface_mismatch");
  }

  if (liveAcceptance?.must_emit_accepted_text_exactly !== true) {
    validationErrors.push("live_acceptance_must_emit_accepted_text_exactly_not_true");
  }

  if (liveAcceptance?.must_not_emit_index !== true) {
    validationErrors.push("live_acceptance_must_not_emit_index_not_true");
  }

  if (liveAcceptance?.must_not_emit_operator_checklist !== true) {
    validationErrors.push("live_acceptance_must_not_emit_operator_checklist_not_true");
  }

  if (liveAcceptance?.must_not_emit_result_surface !== true) {
    validationErrors.push("live_acceptance_must_not_emit_result_surface_not_true");
  }

  if (liveAcceptance?.no_new_output_layer !== true) {
    validationErrors.push("live_acceptance_no_new_output_layer_not_true");
  }

  if (liveAcceptance?.acceptance_smoke_is_reference_only !== true) {
    validationErrors.push("live_acceptance_reference_only_not_true");
  }

  if (liveAcceptance?.acceptance_smoke_must_not_replace_final_output !== true) {
    validationErrors.push("live_acceptance_replace_guard_not_true");
  }

  if (typeof acceptedText !== "string") {
    validationErrors.push("accepted_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_text === "string" && acceptedText !== rootOutput.output_text) {
    validationErrors.push("accepted_text_root_output_text_mismatch");
  }

  if (typeof liveAcceptance?.accepted_chatgpt_output_text === "string" && acceptedText !== liveAcceptance.accepted_chatgpt_output_text) {
    validationErrors.push("accepted_text_live_acceptance_mismatch");
  }

  if (liveAcceptance?.may_read_tool_response_result !== false) {
    validationErrors.push("live_acceptance_may_read_tool_response_result_not_false");
  }

  if (liveAcceptance?.may_rewrite !== false) {
    validationErrors.push("live_acceptance_may_rewrite_not_false");
  }

  if (liveAcceptance?.may_summarize !== false) {
    validationErrors.push("live_acceptance_may_summarize_not_false");
  }

  if (liveAcceptance?.may_include_extra_explanation !== false) {
    validationErrors.push("live_acceptance_extra_explanation_not_false");
  }

  if (liveAcceptance?.may_construct_response !== false) {
    validationErrors.push("live_acceptance_construct_response_not_false");
  }

  if (liveAcceptance?.may_update_canon !== false) {
    validationErrors.push("live_acceptance_update_canon_not_false");
  }

  if (liveAcceptance?.may_update_active_engine !== false) {
    validationErrors.push("live_acceptance_update_active_engine_not_false");
  }

  const forbiddenSources = [
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.final_response_for_chat",
    "tool_response.result.final_response_handoff_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
    "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
    "buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(tool_response)",
  ];

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT final output real action surface readiness invalid.",
      "blocked_stage: final_output_real_action_surface_readiness",
      "operator_action: inspect_real_action_tool_response_surface",
    ].join("\n");

    return {
      used: true,
      phase: "34X",
      surface_kind: chatgptFinalOutputRealActionSurfaceReadinessKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_real_action_surface_readiness_invalid_notice",
      response_kind: "real_action_surface_readiness_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      real_action_surface_ready: false,
      real_action_surface_shape: "chatgpt_action_mcp_tool_response_wrapper",
      final_action_output_entrypoint: chatgptFinalOutputRealActionSurfaceEntrypoint,
      canonical_final_output_entrypoint: chatgptFinalOutputRealActionCanonicalEntrypoint,
      required_chatgpt_consumable_field: chatgptFinalOutputRealActionConsumableField,
      accepted_chatgpt_output_text: outputText,
      accepted_chatgpt_output_hash: sha256(outputText),
      accepted_chatgpt_output_source: "real_action_surface_readiness.invalid_notice",
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "real_action_surface_readiness.invalid_notice",
      final_output_source: "real_action_surface_readiness.invalid_notice",
      source: "real_action_surface_readiness.invalid_notice",
      source_surface: "chatgpt_final_output_real_action_surface_readiness",
      source_response_kind: liveAcceptance?.response_kind ?? null,
      source_status: liveAcceptance?.status ?? null,
      source_output_hash: liveAcceptance?.accepted_chatgpt_output_hash ?? null,
      source_output_source: liveAcceptance?.accepted_chatgpt_output_source ?? null,
      root_chatgpt_final_output_present: rootIndex >= 0,
      root_chatgpt_final_output_before_result: rootIndex >= 0 && resultIndex >= 0 && rootIndex < resultIndex,
      result_surface_present_but_not_required: resultIndex >= 0,
      action_consumer_requires_result_read: false,
      action_consumer_requires_result_extraction: false,
      action_consumer_requires_index_read: false,
      action_consumer_requires_operator_checklist_read: false,
      action_consumer_requires_response_recomposition: false,
      action_must_emit_accepted_text_exactly: true,
      action_must_not_emit_readiness_surface: true,
      action_must_not_emit_live_acceptance_surface: true,
      action_must_not_emit_final_closure_index: true,
      action_must_not_emit_operator_checklist: true,
      action_must_not_emit_result_surface: true,
      forbidden_sources: forbiddenSources,
      no_new_output_layer: true,
      readiness_surface_is_reference_only: true,
      readiness_surface_must_not_replace_final_output: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(liveAcceptance?.safety),
    };
  }

  return {
    used: true,
    phase: "34X",
    surface_kind: chatgptFinalOutputRealActionSurfaceReadinessKind,
    contract_valid: true,
    validation_errors: [],
    status: "ready_for_real_chatgpt_action_final_output",
    response_kind: liveAcceptance.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: liveAcceptance.can_output_to_chat === true,
    may_output_story_text: liveAcceptance.may_output_story_text === true,
    real_action_surface_ready: true,
    real_action_surface_shape: "chatgpt_action_mcp_tool_response_wrapper",
    tool_name: toolResponse.tool_name,
    permission: toolResponse.permission,
    final_action_output_entrypoint: chatgptFinalOutputRealActionSurfaceEntrypoint,
    canonical_final_output_entrypoint: chatgptFinalOutputRealActionCanonicalEntrypoint,
    required_chatgpt_consumable_field: chatgptFinalOutputRealActionConsumableField,
    accepted_chatgpt_output_text: acceptedText,
    accepted_chatgpt_output_hash: sha256(acceptedText),
    accepted_chatgpt_output_source: chatgptFinalOutputRealActionSurfaceEntrypoint,
    output_text: acceptedText,
    output_hash: sha256(acceptedText),
    output_source: chatgptFinalOutputRealActionSurfaceEntrypoint,
    final_output_source: chatgptFinalOutputRealActionSurfaceEntrypoint,
    source: chatgptFinalOutputRealActionSurfaceEntrypoint,
    source_surface: "chatgpt_final_output_real_action_surface_readiness",
    source_response_kind: liveAcceptance.response_kind ?? null,
    source_status: liveAcceptance.status ?? null,
    source_output_hash: liveAcceptance.accepted_chatgpt_output_hash,
    source_output_source: liveAcceptance.accepted_chatgpt_output_source ?? null,
    root_chatgpt_final_output_present: true,
    root_chatgpt_final_output_before_result: rootIndex < resultIndex,
    root_tool_surface: chatgptFinalOutputRealActionConsumableField,
    root_output_text_hash: rootOutput.output_hash,
    result_surface_present_but_not_required: resultIndex >= 0,
    action_consumer_requires_result_read: false,
    action_consumer_requires_result_extraction: false,
    action_consumer_requires_index_read: false,
    action_consumer_requires_operator_checklist_read: false,
    action_consumer_requires_response_recomposition: false,
    action_must_emit_accepted_text_exactly: true,
    action_must_not_emit_readiness_surface: true,
    action_must_not_emit_live_acceptance_surface: true,
    action_must_not_emit_final_closure_index: true,
    action_must_not_emit_operator_checklist: true,
    action_must_not_emit_result_surface: true,
    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    readiness_surface_is_reference_only: true,
    readiness_surface_must_not_replace_final_output: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(liveAcceptance.safety),
  };
}

export function acceptChatgptFinalOutputFromRealActionSurface(toolResponse = {}) {
  return buildChatgptFinalOutputRealActionSurfaceReadiness(toolResponse).accepted_chatgpt_output_text;
}


const chatgptFinalOutputRealActionFinalSmokeKind = "chatgpt_final_output_real_action_final_smoke";
const chatgptFinalOutputRealActionFinalSmokeEntrypoint = "acceptChatgptFinalOutputFromRealActionSurface(tool_response)";
const chatgptFinalOutputRealActionFinalSmokeCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputRealActionFinalSmokeRootField = "tool_response.chatgpt_final_output.output_text";

export function buildChatgptFinalOutputRealActionFinalSmoke(toolResponse = {}) {
  const readiness = buildChatgptFinalOutputRealActionSurfaceReadiness(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const validationErrors = [];

  if (readiness?.used !== true) {
    validationErrors.push("real_action_readiness_used_false_or_missing");
  }

  if (readiness?.contract_valid !== true) {
    validationErrors.push("real_action_readiness_contract_invalid");
  }

  if (readiness?.real_action_surface_ready !== true) {
    validationErrors.push("real_action_surface_not_ready");
  }

  if (readiness?.final_action_output_entrypoint !== "acceptChatgptFinalOutputFromLiveToolCall(tool_response)") {
    validationErrors.push("real_action_readiness_entrypoint_mismatch");
  }

  if (readiness?.canonical_final_output_entrypoint !== chatgptFinalOutputRealActionFinalSmokeCanonicalEntrypoint) {
    validationErrors.push("canonical_entrypoint_mismatch");
  }

  if (readiness?.required_chatgpt_consumable_field !== chatgptFinalOutputRealActionFinalSmokeRootField) {
    validationErrors.push("required_consumable_field_mismatch");
  }

  if (rootOutput?.used !== true) {
    validationErrors.push("root_chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("root_chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("root_chatgpt_final_output_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("root_chatgpt_final_output_hash_missing");
  } else if (typeof rootOutput?.output_text === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (typeof finalText !== "string") {
    validationErrors.push("final_smoke_text_missing_or_not_string");
  }

  if (typeof canonicalText !== "string") {
    validationErrors.push("canonical_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof canonicalText === "string" && finalText !== canonicalText) {
    validationErrors.push("final_smoke_text_canonical_text_mismatch");
  }

  if (typeof finalText === "string" && typeof rootOutput?.output_text === "string" && finalText !== rootOutput.output_text) {
    validationErrors.push("final_smoke_text_root_output_text_mismatch");
  }

  if (typeof finalText === "string" && typeof readiness?.accepted_chatgpt_output_text === "string" && finalText !== readiness.accepted_chatgpt_output_text) {
    validationErrors.push("final_smoke_text_readiness_accepted_text_mismatch");
  }

  if (readiness?.action_must_emit_accepted_text_exactly !== true) {
    validationErrors.push("readiness_must_emit_accepted_text_exactly_not_true");
  }

  if (readiness?.action_must_not_emit_readiness_surface !== true) {
    validationErrors.push("readiness_surface_emit_guard_not_true");
  }

  if (readiness?.action_must_not_emit_live_acceptance_surface !== true) {
    validationErrors.push("live_acceptance_surface_emit_guard_not_true");
  }

  if (readiness?.action_must_not_emit_final_closure_index !== true) {
    validationErrors.push("final_closure_index_emit_guard_not_true");
  }

  if (readiness?.action_must_not_emit_operator_checklist !== true) {
    validationErrors.push("operator_checklist_emit_guard_not_true");
  }

  if (readiness?.action_must_not_emit_result_surface !== true) {
    validationErrors.push("result_surface_emit_guard_not_true");
  }

  if (readiness?.action_consumer_requires_result_read !== false) {
    validationErrors.push("action_consumer_requires_result_read_not_false");
  }

  if (readiness?.action_consumer_requires_result_extraction !== false) {
    validationErrors.push("action_consumer_requires_result_extraction_not_false");
  }

  if (readiness?.action_consumer_requires_index_read !== false) {
    validationErrors.push("action_consumer_requires_index_read_not_false");
  }

  if (readiness?.action_consumer_requires_operator_checklist_read !== false) {
    validationErrors.push("action_consumer_requires_operator_checklist_read_not_false");
  }

  if (readiness?.action_consumer_requires_response_recomposition !== false) {
    validationErrors.push("action_consumer_requires_response_recomposition_not_false");
  }

  if (readiness?.may_read_tool_response_result !== false) {
    validationErrors.push("readiness_may_read_tool_response_result_not_false");
  }

  if (readiness?.may_rewrite !== false) {
    validationErrors.push("readiness_may_rewrite_not_false");
  }

  if (readiness?.may_summarize !== false) {
    validationErrors.push("readiness_may_summarize_not_false");
  }

  if (readiness?.may_include_extra_explanation !== false) {
    validationErrors.push("readiness_extra_explanation_not_false");
  }

  if (readiness?.may_construct_response !== false) {
    validationErrors.push("readiness_construct_response_not_false");
  }

  if (readiness?.may_update_canon !== false) {
    validationErrors.push("readiness_update_canon_not_false");
  }

  if (readiness?.may_update_active_engine !== false) {
    validationErrors.push("readiness_update_active_engine_not_false");
  }

  const forbiddenSources = [
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.final_response_for_chat",
    "tool_response.result.final_response_handoff_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
    "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
    "buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(tool_response)",
    "buildChatgptFinalOutputRealActionSurfaceReadiness(tool_response)",
  ];

  if (validationErrors.length > 0) {
    const outputText = [
      "ChatGPT final output real action final smoke invalid.",
      "blocked_stage: final_output_real_action_final_smoke",
      "operator_action: inspect_real_action_surface_readiness",
    ].join("\n");

    return {
      used: true,
      phase: "34Y",
      surface_kind: chatgptFinalOutputRealActionFinalSmokeKind,
      contract_valid: false,
      validation_errors: validationErrors,
      status: "ready_to_emit_real_action_final_smoke_invalid_notice",
      response_kind: "real_action_final_smoke_invalid_notice",
      can_emit_response_to_chat: true,
      can_output_to_chat: false,
      may_output_story_text: false,
      real_action_final_smoke_passed: false,
      final_action_output_entrypoint: chatgptFinalOutputRealActionFinalSmokeEntrypoint,
      canonical_final_output_entrypoint: chatgptFinalOutputRealActionFinalSmokeCanonicalEntrypoint,
      required_chatgpt_consumable_field: chatgptFinalOutputRealActionFinalSmokeRootField,
      final_smoke_output_text: outputText,
      final_smoke_output_hash: sha256(outputText),
      final_smoke_output_source: "real_action_final_smoke.invalid_notice",
      output_text: outputText,
      output_hash: sha256(outputText),
      output_source: "real_action_final_smoke.invalid_notice",
      final_output_source: "real_action_final_smoke.invalid_notice",
      source: "real_action_final_smoke.invalid_notice",
      source_surface: "chatgpt_final_output_real_action_final_smoke",
      source_response_kind: readiness?.response_kind ?? null,
      source_status: readiness?.status ?? null,
      source_output_hash: readiness?.accepted_chatgpt_output_hash ?? null,
      source_output_source: readiness?.accepted_chatgpt_output_source ?? null,
      final_smoke_is_reference_only: true,
      final_smoke_must_not_replace_final_output: true,
      final_smoke_must_not_be_emitted_as_chat_output: true,
      final_smoke_must_emit_final_text_exactly: true,
      final_smoke_requires_no_result_read: true,
      final_smoke_requires_no_index_read: true,
      final_smoke_requires_no_checklist_read: true,
      final_smoke_requires_no_recomposition: true,
      must_not_emit_readiness_surface: true,
      must_not_emit_live_acceptance_surface: true,
      must_not_emit_final_closure_index: true,
      must_not_emit_operator_checklist: true,
      must_not_emit_result_surface: true,
      forbidden_sources: forbiddenSources,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
      ...buildChatgptFinalOutputLockFields(),
      safety: buildChatgptFinalOutputSafety(readiness?.safety),
    };
  }

  return {
    used: true,
    phase: "34Y",
    surface_kind: chatgptFinalOutputRealActionFinalSmokeKind,
    contract_valid: true,
    validation_errors: [],
    status: "real_action_final_output_smoke_passed",
    response_kind: readiness.response_kind ?? null,
    can_emit_response_to_chat: true,
    can_output_to_chat: readiness.can_output_to_chat === true,
    may_output_story_text: readiness.may_output_story_text === true,
    real_action_final_smoke_passed: true,
    final_action_output_entrypoint: chatgptFinalOutputRealActionFinalSmokeEntrypoint,
    canonical_final_output_entrypoint: chatgptFinalOutputRealActionFinalSmokeCanonicalEntrypoint,
    required_chatgpt_consumable_field: chatgptFinalOutputRealActionFinalSmokeRootField,
    final_smoke_output_text: finalText,
    final_smoke_output_hash: sha256(finalText),
    final_smoke_output_source: chatgptFinalOutputRealActionFinalSmokeEntrypoint,
    output_text: finalText,
    output_hash: sha256(finalText),
    output_source: chatgptFinalOutputRealActionFinalSmokeEntrypoint,
    final_output_source: chatgptFinalOutputRealActionFinalSmokeEntrypoint,
    source: chatgptFinalOutputRealActionFinalSmokeEntrypoint,
    source_surface: "chatgpt_final_output_real_action_final_smoke",
    source_response_kind: readiness.response_kind ?? null,
    source_status: readiness.status ?? null,
    source_output_hash: readiness.accepted_chatgpt_output_hash,
    source_output_source: readiness.accepted_chatgpt_output_source ?? null,
    root_output_text_hash: rootOutput.output_hash,
    final_smoke_output_matches_root: finalText === rootOutput.output_text,
    final_smoke_output_matches_canonical_emit: finalText === canonicalText,
    final_smoke_output_matches_real_action_readiness: finalText === readiness.accepted_chatgpt_output_text,
    final_smoke_is_reference_only: true,
    final_smoke_must_not_replace_final_output: true,
    final_smoke_must_not_be_emitted_as_chat_output: true,
    final_smoke_must_emit_final_text_exactly: true,
    final_smoke_requires_no_result_read: true,
    final_smoke_requires_no_index_read: true,
    final_smoke_requires_no_checklist_read: true,
    final_smoke_requires_no_recomposition: true,
    must_not_emit_readiness_surface: true,
    must_not_emit_live_acceptance_surface: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_operator_checklist: true,
    must_not_emit_result_surface: true,
    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(readiness.safety),
  };
}


const chatgptFinalOutputFinalClosureSealKind = "chatgpt_final_output_final_closure_seal";
const chatgptFinalOutputFinalClosureSealEntrypoint = "acceptChatgptFinalOutputFromRealActionSurface(tool_response)";
const chatgptFinalOutputFinalClosureSealCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputFinalClosureSealRootField = "tool_response.chatgpt_final_output.output_text";
const chatgptFinalOutputFinalClosureSealFinalSmoke = "buildChatgptFinalOutputRealActionFinalSmoke(tool_response)";

function buildChatgptFinalOutputFinalClosureSealEntries() {
  return [
    {
      phase: "34J",
      name: "ChatGPT bridge final candidate output contract",
      test_path: "tests/phase34/phase34j-chatgpt-bridge-final-candidate-output-contract.test.mjs",
      role: "candidate_success_output_contract",
    },
    {
      phase: "34K",
      name: "ChatGPT bridge failure output contract",
      test_path: "tests/phase34/phase34k-chatgpt-bridge-failure-output-contract.test.mjs",
      role: "pipeline_failure_output_contract",
    },
    {
      phase: "34L",
      name: "ChatGPT bridge failure readable surface",
      test_path: "tests/phase34/phase34l-chatgpt-bridge-failure-readable-surface.test.mjs",
      role: "failure_output_readable_surface",
    },
    {
      phase: "34M",
      name: "ChatGPT bridge success readable surface",
      test_path: "tests/phase34/phase34m-chatgpt-bridge-success-readable-surface.test.mjs",
      role: "success_output_readable_surface",
    },
    {
      phase: "34N",
      name: "ChatGPT bridge output surface symmetry regression",
      test_path: "tests/phase34/phase34n-chatgpt-bridge-output-surface-symmetry-regression.test.mjs",
      role: "success_failure_surface_symmetry_regression",
    },
    {
      phase: "34O",
      name: "ChatGPT bridge final response renderer contract",
      test_path: "tests/phase34/phase34o-chatgpt-bridge-final-response-renderer-contract.test.mjs",
      role: "final_response_for_chat_renderer_contract",
    },
    {
      phase: "34P",
      name: "ChatGPT bridge final response handoff contract",
      test_path: "tests/phase34/phase34p-chatgpt-bridge-final-response-handoff-contract.test.mjs",
      role: "final_response_handoff_for_chat_contract",
    },
    {
      phase: "34Q",
      name: "ChatGPT bridge final output live extraction contract",
      test_path: "tests/phase34/phase34q-chatgpt-bridge-final-output-live-extraction-contract.test.mjs",
      role: "extracted_chatgpt_final_output_contract",
    },
    {
      phase: "34R",
      name: "ChatGPT bridge final output tool surface contract",
      test_path: "tests/phase34/phase34r-chatgpt-bridge-final-output-tool-surface-contract.test.mjs",
      role: "root_chatgpt_final_output_tool_surface_contract",
    },
    {
      phase: "34S",
      name: "ChatGPT bridge final output consumer contract",
      test_path: "tests/phase34/phase34s-chatgpt-bridge-final-output-consumer-contract.test.mjs",
      role: "consumer_emission_contract",
    },
    {
      phase: "34T",
      name: "ChatGPT final output E2E compliance smoke",
      test_path: "tests/phase34/phase34t-chatgpt-final-output-e2e-compliance-smoke.test.mjs",
      role: "final_chatgpt_output_e2e_compliance_smoke",
    },
    {
      phase: "34U",
      name: "ChatGPT final output operator handoff checklist",
      test_path: "tests/phase34/phase34u-chatgpt-final-output-operator-handoff-checklist.test.mjs",
      role: "operator_handoff_checklist",
    },
    {
      phase: "34V",
      name: "ChatGPT final output contract final closure index",
      test_path: "tests/phase34/phase34v-chatgpt-final-output-contract-final-closure-index.test.mjs",
      role: "contract_final_closure_index",
    },
    {
      phase: "34W",
      name: "ChatGPT final output live tool call acceptance smoke",
      test_path: "tests/phase34/phase34w-chatgpt-final-output-live-tool-call-acceptance-smoke.test.mjs",
      role: "live_tool_call_acceptance_smoke",
    },
    {
      phase: "34X",
      name: "ChatGPT final output real action surface readiness",
      test_path: "tests/phase34/phase34x-chatgpt-final-output-real-action-surface-readiness.test.mjs",
      role: "real_action_surface_readiness",
    },
    {
      phase: "34Y",
      name: "ChatGPT final output real action final smoke",
      test_path: "tests/phase34/phase34y-chatgpt-final-output-real-action-final-smoke.test.mjs",
      role: "real_action_final_smoke_endpoint",
    },
  ];
}

function buildChatgptFinalOutputFinalClosureSealForbiddenSources() {
  return [
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.final_response_for_chat",
    "tool_response.result.final_response_handoff_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
    "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
    "buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(tool_response)",
    "buildChatgptFinalOutputRealActionSurfaceReadiness(tool_response)",
    "buildChatgptFinalOutputRealActionFinalSmoke(tool_response)",
    "buildChatgptFinalOutputFinalClosureSeal(tool_response)",
  ];
}

export function buildChatgptFinalOutputFinalClosureSeal(toolResponse = {}) {
  const finalSmoke = buildChatgptFinalOutputRealActionFinalSmoke(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const sealEntries = buildChatgptFinalOutputFinalClosureSealEntries();
  const forbiddenSources = buildChatgptFinalOutputFinalClosureSealForbiddenSources();
  const expectedPhases = [
    "34J", "34K", "34L", "34M", "34N", "34O", "34P", "34Q", "34R",
    "34S", "34T", "34U", "34V", "34W", "34X", "34Y",
  ];
  const validationErrors = [];

  if (finalSmoke?.used !== true) {
    validationErrors.push("real_action_final_smoke_used_false_or_missing");
  }

  if (finalSmoke?.phase !== "34Y") {
    validationErrors.push("real_action_final_smoke_phase_not_34y");
  }

  if (finalSmoke?.contract_valid !== true) {
    validationErrors.push("real_action_final_smoke_contract_invalid");
  }

  if (finalSmoke?.real_action_final_smoke_passed !== true) {
    validationErrors.push("real_action_final_smoke_not_passed");
  }

  if (finalSmoke?.final_action_output_entrypoint !== chatgptFinalOutputFinalClosureSealEntrypoint) {
    validationErrors.push("final_action_output_entrypoint_mismatch");
  }

  if (finalSmoke?.canonical_final_output_entrypoint !== chatgptFinalOutputFinalClosureSealCanonicalEntrypoint) {
    validationErrors.push("canonical_final_output_entrypoint_mismatch");
  }

  if (finalSmoke?.required_chatgpt_consumable_field !== chatgptFinalOutputFinalClosureSealRootField) {
    validationErrors.push("required_chatgpt_consumable_field_mismatch");
  }

  if (rootOutput?.used !== true) {
    validationErrors.push("root_chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("root_chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("root_chatgpt_final_output_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("root_chatgpt_final_output_hash_missing");
  } else if (typeof rootOutput?.output_text === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (typeof finalText !== "string") {
    validationErrors.push("final_entrypoint_text_missing_or_not_string");
  }

  if (typeof canonicalText !== "string") {
    validationErrors.push("canonical_entrypoint_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof canonicalText === "string" && finalText !== canonicalText) {
    validationErrors.push("final_entrypoint_canonical_entrypoint_mismatch");
  }

  if (typeof finalText === "string" && typeof rootOutput?.output_text === "string" && finalText !== rootOutput.output_text) {
    validationErrors.push("final_entrypoint_root_output_text_mismatch");
  }

  if (typeof finalText === "string" && typeof finalSmoke?.final_smoke_output_text === "string" && finalText !== finalSmoke.final_smoke_output_text) {
    validationErrors.push("final_entrypoint_final_smoke_output_text_mismatch");
  }

  if (finalSmoke?.final_smoke_output_matches_root !== true) {
    validationErrors.push("final_smoke_output_matches_root_not_true");
  }

  if (finalSmoke?.final_smoke_output_matches_canonical_emit !== true) {
    validationErrors.push("final_smoke_output_matches_canonical_emit_not_true");
  }

  if (finalSmoke?.final_smoke_is_reference_only !== true) {
    validationErrors.push("final_smoke_reference_only_not_true");
  }

  if (finalSmoke?.final_smoke_must_not_replace_final_output !== true) {
    validationErrors.push("final_smoke_replace_guard_not_true");
  }

  if (finalSmoke?.final_smoke_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("final_smoke_emit_guard_not_true");
  }

  if (finalSmoke?.final_smoke_must_emit_final_text_exactly !== true) {
    validationErrors.push("final_smoke_exact_text_guard_not_true");
  }

  if (finalSmoke?.final_smoke_requires_no_result_read !== true) {
    validationErrors.push("final_smoke_no_result_read_guard_not_true");
  }

  if (finalSmoke?.final_smoke_requires_no_index_read !== true) {
    validationErrors.push("final_smoke_no_index_read_guard_not_true");
  }

  if (finalSmoke?.final_smoke_requires_no_checklist_read !== true) {
    validationErrors.push("final_smoke_no_checklist_read_guard_not_true");
  }

  if (finalSmoke?.final_smoke_requires_no_recomposition !== true) {
    validationErrors.push("final_smoke_no_recomposition_guard_not_true");
  }

  if (finalSmoke?.must_not_emit_readiness_surface !== true) {
    validationErrors.push("must_not_emit_readiness_surface_not_true");
  }

  if (finalSmoke?.must_not_emit_live_acceptance_surface !== true) {
    validationErrors.push("must_not_emit_live_acceptance_surface_not_true");
  }

  if (finalSmoke?.must_not_emit_final_closure_index !== true) {
    validationErrors.push("must_not_emit_final_closure_index_not_true");
  }

  if (finalSmoke?.must_not_emit_operator_checklist !== true) {
    validationErrors.push("must_not_emit_operator_checklist_not_true");
  }

  if (finalSmoke?.must_not_emit_result_surface !== true) {
    validationErrors.push("must_not_emit_result_surface_not_true");
  }

  if (finalSmoke?.may_read_tool_response_result !== false) {
    validationErrors.push("final_smoke_may_read_tool_response_result_not_false");
  }

  if (finalSmoke?.may_rewrite !== false) {
    validationErrors.push("final_smoke_may_rewrite_not_false");
  }

  if (finalSmoke?.may_summarize !== false) {
    validationErrors.push("final_smoke_may_summarize_not_false");
  }

  if (finalSmoke?.may_include_extra_explanation !== false) {
    validationErrors.push("final_smoke_extra_explanation_not_false");
  }

  if (finalSmoke?.may_construct_response !== false) {
    validationErrors.push("final_smoke_may_construct_response_not_false");
  }

  if (finalSmoke?.may_save_candidate !== false) {
    validationErrors.push("final_smoke_may_save_candidate_not_false");
  }

  if (finalSmoke?.may_approve_candidate !== false) {
    validationErrors.push("final_smoke_may_approve_candidate_not_false");
  }

  if (finalSmoke?.may_adopt_candidate !== false) {
    validationErrors.push("final_smoke_may_adopt_candidate_not_false");
  }

  if (finalSmoke?.may_update_canon !== false) {
    validationErrors.push("final_smoke_may_update_canon_not_false");
  }

  if (finalSmoke?.may_update_active_engine !== false) {
    validationErrors.push("final_smoke_may_update_active_engine_not_false");
  }

  if (!sealEntries.every((entry) => entry.phase && entry.name && entry.test_path && entry.role)) {
    validationErrors.push("final_closure_seal_entry_shape_invalid");
  }

  const actualPhases = sealEntries.map((entry) => entry.phase);
  if (JSON.stringify(actualPhases) !== JSON.stringify(expectedPhases)) {
    validationErrors.push("final_closure_seal_phase_order_mismatch");
  }

  if (actualPhases.at(-1) !== "34Y") {
    validationErrors.push("final_closure_seal_endpoint_not_34y");
  }

  const contractValid = validationErrors.length === 0;
  const referenceText = contractValid ? finalText : null;

  return {
    used: true,
    phase: "34Z",
    surface_kind: chatgptFinalOutputFinalClosureSealKind,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? "final_output_final_closure_sealed"
      : "final_output_final_closure_seal_invalid",
    response_kind: contractValid
      ? "final_closure_seal_reference"
      : "final_closure_seal_invalid_reference",
    can_emit_response_to_chat: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    phase_range: "34J-34Y",
    covered_phases: expectedPhases,
    final_smoke_endpoint_phase: "34Y",
    final_smoke_endpoint: chatgptFinalOutputFinalClosureSealFinalSmoke,
    real_action_final_smoke: chatgptFinalOutputFinalClosureSealFinalSmoke,
    final_unique_entrypoint: chatgptFinalOutputFinalClosureSealEntrypoint,
    final_action_output_entrypoint: chatgptFinalOutputFinalClosureSealEntrypoint,
    canonical_final_output_entrypoint: chatgptFinalOutputFinalClosureSealCanonicalEntrypoint,
    root_consumable_field: chatgptFinalOutputFinalClosureSealRootField,
    reference_final_output_text: referenceText,
    reference_final_output_hash: typeof referenceText === "string" ? sha256(referenceText) : null,
    reference_final_output_source: contractValid ? chatgptFinalOutputFinalClosureSealEntrypoint : null,
    reference_final_output_matches_root: contractValid && referenceText === rootOutput?.output_text,
    reference_final_output_matches_canonical_emit: contractValid && referenceText === canonicalText,
    reference_final_output_matches_final_smoke: contractValid && referenceText === finalSmoke?.final_smoke_output_text,
    final_seal_is_reference_only: true,
    final_seal_must_not_replace_final_output: true,
    final_seal_must_not_be_emitted_as_chat_output: true,
    final_seal_may_not_be_read_for_chat_output: true,
    final_output_must_still_use_entrypoint: true,
    final_seal_adds_output_layer: false,
    no_new_output_layer: true,
    seal_contract_invalid_notice: contractValid ? null : [
      "ChatGPT final output final closure seal invalid.",
      "blocked_stage: final_output_final_closure_seal",
      "operator_action: inspect_phase34_real_action_final_smoke",
    ].join("\n"),
    forbidden_sources: forbiddenSources,
    final_closure_seal_entries: sealEntries,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(finalSmoke?.safety),
  };
}


const chatgptFinalOutputOperatorRuntimeContractKind = "chatgpt_final_output_operator_runtime_contract";
const chatgptFinalOutputOperatorRuntimeRequiredEntrypoint = "acceptChatgptFinalOutputFromRealActionSurface(tool_response)";
const chatgptFinalOutputOperatorRuntimeCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputOperatorRuntimeRootField = "tool_response.chatgpt_final_output.output_text";
const chatgptFinalOutputOperatorRuntimeFinalSeal = "buildChatgptFinalOutputFinalClosureSeal(tool_response)";

function buildChatgptFinalOutputOperatorRuntimeForbiddenSources() {
  return [
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.final_response_for_chat",
    "tool_response.result.final_response_handoff_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "buildChatgptFinalOutputOperatorHandoffChecklist(tool_response)",
    "buildChatgptFinalOutputContractFinalClosureIndex(tool_response)",
    "buildChatgptFinalOutputLiveToolCallAcceptanceSmoke(tool_response)",
    "buildChatgptFinalOutputRealActionSurfaceReadiness(tool_response)",
    "buildChatgptFinalOutputRealActionFinalSmoke(tool_response)",
    "buildChatgptFinalOutputFinalClosureSeal(tool_response)",
    "buildChatgptFinalOutputOperatorRuntimeContract(tool_response)",
  ];
}

export function buildChatgptFinalOutputOperatorRuntimeContract(toolResponse = {}) {
  const finalSeal = buildChatgptFinalOutputFinalClosureSeal(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const forbiddenSources = buildChatgptFinalOutputOperatorRuntimeForbiddenSources();
  const validationErrors = [];

  if (finalSeal?.used !== true) {
    validationErrors.push("final_closure_seal_used_false_or_missing");
  }

  if (finalSeal?.phase !== "34Z") {
    validationErrors.push("final_closure_seal_phase_not_34z");
  }

  if (finalSeal?.contract_valid !== true) {
    validationErrors.push("final_closure_seal_contract_invalid");
  }

  if (finalSeal?.status !== "final_output_final_closure_sealed") {
    validationErrors.push("final_closure_seal_status_not_sealed");
  }

  if (finalSeal?.can_emit_response_to_chat !== false) {
    validationErrors.push("final_closure_seal_can_emit_response_to_chat_not_false");
  }

  if (finalSeal?.can_output_to_chat !== false) {
    validationErrors.push("final_closure_seal_can_output_to_chat_not_false");
  }

  if (finalSeal?.may_output_story_text !== false) {
    validationErrors.push("final_closure_seal_may_output_story_text_not_false");
  }

  if (finalSeal?.final_unique_entrypoint !== chatgptFinalOutputOperatorRuntimeRequiredEntrypoint) {
    validationErrors.push("final_closure_seal_unique_entrypoint_mismatch");
  }

  if (finalSeal?.final_action_output_entrypoint !== chatgptFinalOutputOperatorRuntimeRequiredEntrypoint) {
    validationErrors.push("final_closure_seal_action_entrypoint_mismatch");
  }

  if (finalSeal?.canonical_final_output_entrypoint !== chatgptFinalOutputOperatorRuntimeCanonicalEntrypoint) {
    validationErrors.push("final_closure_seal_canonical_entrypoint_mismatch");
  }

  if (finalSeal?.root_consumable_field !== chatgptFinalOutputOperatorRuntimeRootField) {
    validationErrors.push("final_closure_seal_root_consumable_field_mismatch");
  }

  if (finalSeal?.final_seal_is_reference_only !== true) {
    validationErrors.push("final_closure_seal_reference_only_not_true");
  }

  if (finalSeal?.final_seal_must_not_replace_final_output !== true) {
    validationErrors.push("final_closure_seal_replace_guard_not_true");
  }

  if (finalSeal?.final_seal_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("final_closure_seal_emit_guard_not_true");
  }

  if (finalSeal?.final_seal_may_not_be_read_for_chat_output !== true) {
    validationErrors.push("final_closure_seal_read_guard_not_true");
  }

  if (finalSeal?.final_output_must_still_use_entrypoint !== true) {
    validationErrors.push("final_closure_seal_final_output_entrypoint_guard_not_true");
  }

  if (finalSeal?.final_seal_adds_output_layer !== false) {
    validationErrors.push("final_closure_seal_adds_output_layer_not_false");
  }

  if (finalSeal?.no_new_output_layer !== true) {
    validationErrors.push("final_closure_seal_no_new_output_layer_not_true");
  }

  if (rootOutput?.used !== true) {
    validationErrors.push("root_chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("root_chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("root_chatgpt_final_output_text_missing_or_not_string");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("root_chatgpt_final_output_hash_missing");
  } else if (typeof rootOutput?.output_text === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (typeof finalText !== "string") {
    validationErrors.push("runtime_entrypoint_text_missing_or_not_string");
  }

  if (typeof canonicalText !== "string") {
    validationErrors.push("canonical_entrypoint_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof canonicalText === "string" && finalText !== canonicalText) {
    validationErrors.push("runtime_entrypoint_canonical_entrypoint_mismatch");
  }

  if (typeof finalText === "string" && typeof rootOutput?.output_text === "string" && finalText !== rootOutput.output_text) {
    validationErrors.push("runtime_entrypoint_root_output_text_mismatch");
  }

  if (typeof finalText === "string" && typeof finalSeal?.reference_final_output_text === "string" && finalText !== finalSeal.reference_final_output_text) {
    validationErrors.push("runtime_entrypoint_final_seal_reference_mismatch");
  }

  if (finalSeal?.reference_final_output_matches_root !== true) {
    validationErrors.push("final_seal_reference_matches_root_not_true");
  }

  if (finalSeal?.reference_final_output_matches_canonical_emit !== true) {
    validationErrors.push("final_seal_reference_matches_canonical_emit_not_true");
  }

  if (finalSeal?.reference_final_output_matches_final_smoke !== true) {
    validationErrors.push("final_seal_reference_matches_final_smoke_not_true");
  }

  if (finalSeal?.may_read_tool_response_result !== false) {
    validationErrors.push("final_seal_may_read_tool_response_result_not_false");
  }

  if (finalSeal?.may_rewrite !== false) {
    validationErrors.push("final_seal_may_rewrite_not_false");
  }

  if (finalSeal?.may_summarize !== false) {
    validationErrors.push("final_seal_may_summarize_not_false");
  }

  if (finalSeal?.may_include_extra_explanation !== false) {
    validationErrors.push("final_seal_extra_explanation_not_false");
  }

  if (finalSeal?.may_construct_response !== false) {
    validationErrors.push("final_seal_may_construct_response_not_false");
  }

  if (finalSeal?.may_save_candidate !== false) {
    validationErrors.push("final_seal_may_save_candidate_not_false");
  }

  if (finalSeal?.may_approve_candidate !== false) {
    validationErrors.push("final_seal_may_approve_candidate_not_false");
  }

  if (finalSeal?.may_adopt_candidate !== false) {
    validationErrors.push("final_seal_may_adopt_candidate_not_false");
  }

  if (finalSeal?.may_update_canon !== false) {
    validationErrors.push("final_seal_may_update_canon_not_false");
  }

  if (finalSeal?.may_update_active_engine !== false) {
    validationErrors.push("final_seal_may_update_active_engine_not_false");
  }

  const contractValid = validationErrors.length === 0;
  const runtimeHash = contractValid && typeof finalText === "string" ? sha256(finalText) : null;

  return {
    used: true,
    phase: "35A",
    surface_kind: chatgptFinalOutputOperatorRuntimeContractKind,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? "operator_runtime_contract_ready"
      : "operator_runtime_contract_invalid",
    response_kind: contractValid
      ? "operator_runtime_contract_reference"
      : "operator_runtime_contract_invalid_reference",
    can_emit_response_to_chat: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    phase_dependency: "34Z",
    phase_range: "34J-35A",
    final_closure_seal: chatgptFinalOutputOperatorRuntimeFinalSeal,
    runtime_required_entrypoint: chatgptFinalOutputOperatorRuntimeRequiredEntrypoint,
    runtime_required_expression: chatgptFinalOutputOperatorRuntimeRequiredEntrypoint,
    runtime_must_call: chatgptFinalOutputOperatorRuntimeRequiredEntrypoint,
    runtime_must_emit_exact_return_value: true,
    runtime_must_not_emit_runtime_contract: true,
    runtime_must_not_emit_final_seal: true,
    runtime_must_not_emit_final_smoke: true,
    runtime_must_not_emit_readiness: true,
    runtime_must_not_emit_live_acceptance: true,
    runtime_must_not_emit_final_closure_index: true,
    runtime_must_not_emit_operator_checklist: true,
    runtime_must_not_emit_result_surface: true,
    runtime_must_not_read_result: true,
    runtime_must_not_read_final_seal_for_chat_output: true,
    runtime_must_not_read_final_smoke_for_chat_output: true,
    runtime_must_not_recompose_response: true,
    runtime_must_not_rewrite: true,
    runtime_must_not_summarize: true,
    runtime_must_not_add_explanation: true,
    runtime_required_root_field: chatgptFinalOutputOperatorRuntimeRootField,
    runtime_reference_output_hash: runtimeHash,
    runtime_reference_output_source: contractValid ? chatgptFinalOutputOperatorRuntimeRequiredEntrypoint : null,
    runtime_output_matches_root: contractValid && typeof finalText === "string" && finalText === rootOutput?.output_text,
    runtime_output_matches_canonical_emit: contractValid && typeof finalText === "string" && finalText === canonicalText,
    runtime_output_matches_final_seal_reference: contractValid && typeof finalText === "string" && finalText === finalSeal?.reference_final_output_text,
    runtime_contract_is_reference_only: true,
    runtime_contract_must_not_replace_final_output: true,
    runtime_contract_must_not_be_emitted_as_chat_output: true,
    runtime_contract_adds_output_layer: false,
    no_new_output_layer: true,
    runtime_contract_invalid_notice: contractValid ? null : [
      "ChatGPT final output operator runtime contract invalid.",
      "blocked_stage: final_output_operator_runtime_contract",
      "operator_action: inspect_phase34_final_closure_seal",
    ].join("\n"),
    forbidden_sources: forbiddenSources,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(finalSeal?.safety),
  };
}

function shouldRequireChatgptFinalOutputToolSurface(toolName, surfacedResult = {}) {
  return toolName === "chatgpt_bridge_run_full_neural_writing_pipeline"
    || surfacedResult?.extracted_chatgpt_final_output != null;
}

function response(toolName, permission, result, created = []) {
  const surfacedResult = withFullNeuralSurface(result ?? {});
  const fullNeuralSummary = summarizeFullNeuralSurface(surfacedResult);
  const chatgptFinalOutput = shouldRequireChatgptFinalOutputToolSurface(toolName, surfacedResult)
    ? buildChatgptFinalOutputToolSurface(surfacedResult)
    : buildUnusedChatgptFinalOutputToolSurface();

  return {
    ok: result?.ok !== false,
    tool_name: toolName,
    permission,
    chatgpt_final_output: chatgptFinalOutput,
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
