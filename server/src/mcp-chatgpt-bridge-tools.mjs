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


const chatgptFinalOutputNegativeRuntimeSmokeKind = "chatgpt_final_output_negative_runtime_smoke";
const chatgptFinalOutputNegativeRuntimeRequiredEntrypoint = "acceptChatgptFinalOutputFromRealActionSurface(tool_response)";
const chatgptFinalOutputNegativeRuntimeCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputNegativeRuntimeRootField = "tool_response.chatgpt_final_output.output_text";
const chatgptFinalOutputNegativeRuntimeContract = "buildChatgptFinalOutputOperatorRuntimeContract(tool_response)";
const chatgptFinalOutputNegativeRuntimeFinalSeal = "buildChatgptFinalOutputFinalClosureSeal(tool_response)";

function buildChatgptFinalOutputNegativeRuntimeForbiddenSources() {
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
    "buildChatgptFinalOutputNegativeRuntimeSmoke(tool_response)",
  ];
}

export function buildChatgptFinalOutputNegativeRuntimeSmoke(toolResponse = {}) {
  const runtimeContract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const finalSeal = buildChatgptFinalOutputFinalClosureSeal(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const forbiddenSources = buildChatgptFinalOutputNegativeRuntimeForbiddenSources();
  const validationErrors = [];

  if (runtimeContract?.used !== true) {
    validationErrors.push("operator_runtime_contract_used_false_or_missing");
  }

  if (runtimeContract?.phase !== "35A") {
    validationErrors.push("operator_runtime_contract_phase_not_35a");
  }

  if (runtimeContract?.contract_valid !== true) {
    validationErrors.push("operator_runtime_contract_invalid");
  }

  if (runtimeContract?.status !== "operator_runtime_contract_ready") {
    validationErrors.push("operator_runtime_contract_status_not_ready");
  }

  if (runtimeContract?.can_emit_response_to_chat !== false) {
    validationErrors.push("operator_runtime_contract_can_emit_response_to_chat_not_false");
  }

  if (runtimeContract?.can_output_to_chat !== false) {
    validationErrors.push("operator_runtime_contract_can_output_to_chat_not_false");
  }

  if (runtimeContract?.may_output_story_text !== false) {
    validationErrors.push("operator_runtime_contract_may_output_story_text_not_false");
  }

  if (runtimeContract?.runtime_required_entrypoint !== chatgptFinalOutputNegativeRuntimeRequiredEntrypoint) {
    validationErrors.push("operator_runtime_contract_required_entrypoint_mismatch");
  }

  if (runtimeContract?.runtime_must_call !== chatgptFinalOutputNegativeRuntimeRequiredEntrypoint) {
    validationErrors.push("operator_runtime_contract_must_call_mismatch");
  }

  if (runtimeContract?.runtime_required_root_field !== chatgptFinalOutputNegativeRuntimeRootField) {
    validationErrors.push("operator_runtime_contract_root_field_mismatch");
  }

  if (runtimeContract?.runtime_must_emit_exact_return_value !== true) {
    validationErrors.push("operator_runtime_contract_exact_return_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_runtime_contract !== true) {
    validationErrors.push("operator_runtime_contract_self_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_final_seal !== true) {
    validationErrors.push("operator_runtime_contract_final_seal_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_final_smoke !== true) {
    validationErrors.push("operator_runtime_contract_final_smoke_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_readiness !== true) {
    validationErrors.push("operator_runtime_contract_readiness_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_live_acceptance !== true) {
    validationErrors.push("operator_runtime_contract_live_acceptance_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_final_closure_index !== true) {
    validationErrors.push("operator_runtime_contract_index_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_operator_checklist !== true) {
    validationErrors.push("operator_runtime_contract_checklist_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_result_surface !== true) {
    validationErrors.push("operator_runtime_contract_result_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_read_result !== true) {
    validationErrors.push("operator_runtime_contract_result_read_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_read_final_seal_for_chat_output !== true) {
    validationErrors.push("operator_runtime_contract_final_seal_read_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_read_final_smoke_for_chat_output !== true) {
    validationErrors.push("operator_runtime_contract_final_smoke_read_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_recompose_response !== true) {
    validationErrors.push("operator_runtime_contract_recomposition_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_rewrite !== true) {
    validationErrors.push("operator_runtime_contract_rewrite_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_summarize !== true) {
    validationErrors.push("operator_runtime_contract_summarize_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_add_explanation !== true) {
    validationErrors.push("operator_runtime_contract_add_explanation_guard_not_true");
  }

  if (runtimeContract?.runtime_contract_is_reference_only !== true) {
    validationErrors.push("operator_runtime_contract_reference_only_not_true");
  }

  if (runtimeContract?.runtime_contract_must_not_replace_final_output !== true) {
    validationErrors.push("operator_runtime_contract_replace_guard_not_true");
  }

  if (runtimeContract?.runtime_contract_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("operator_runtime_contract_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_contract_adds_output_layer !== false) {
    validationErrors.push("operator_runtime_contract_adds_output_layer_not_false");
  }

  if (runtimeContract?.no_new_output_layer !== true) {
    validationErrors.push("operator_runtime_contract_no_new_output_layer_not_true");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_output_text");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "reference_final_output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_reference_final_output_text");
  }

  if (finalSeal?.used !== true) {
    validationErrors.push("final_closure_seal_used_false_or_missing");
  }

  if (finalSeal?.phase !== "34Z") {
    validationErrors.push("final_closure_seal_phase_not_34z");
  }

  if (finalSeal?.contract_valid !== true) {
    validationErrors.push("final_closure_seal_contract_invalid");
  }

  if (finalSeal?.final_seal_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("final_closure_seal_emit_guard_not_true");
  }

  if (finalSeal?.final_seal_may_not_be_read_for_chat_output !== true) {
    validationErrors.push("final_closure_seal_read_guard_not_true");
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
    validationErrors.push("negative_runtime_entrypoint_text_missing_or_not_string");
  }

  if (typeof canonicalText !== "string") {
    validationErrors.push("canonical_entrypoint_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof canonicalText === "string" && finalText !== canonicalText) {
    validationErrors.push("negative_runtime_entrypoint_canonical_entrypoint_mismatch");
  }

  if (typeof finalText === "string" && typeof rootOutput?.output_text === "string" && finalText !== rootOutput.output_text) {
    validationErrors.push("negative_runtime_entrypoint_root_output_text_mismatch");
  }

  if (typeof finalText === "string" && typeof finalSeal?.reference_final_output_text === "string" && finalText !== finalSeal.reference_final_output_text) {
    validationErrors.push("negative_runtime_entrypoint_final_seal_reference_mismatch");
  }

  if (runtimeContract?.runtime_output_matches_root !== true) {
    validationErrors.push("runtime_contract_output_matches_root_not_true");
  }

  if (runtimeContract?.runtime_output_matches_canonical_emit !== true) {
    validationErrors.push("runtime_contract_output_matches_canonical_emit_not_true");
  }

  if (runtimeContract?.runtime_output_matches_final_seal_reference !== true) {
    validationErrors.push("runtime_contract_output_matches_final_seal_reference_not_true");
  }

  if (runtimeContract?.may_read_tool_response_result !== false) {
    validationErrors.push("runtime_contract_may_read_tool_response_result_not_false");
  }

  if (runtimeContract?.may_rewrite !== false) {
    validationErrors.push("runtime_contract_may_rewrite_not_false");
  }

  if (runtimeContract?.may_summarize !== false) {
    validationErrors.push("runtime_contract_may_summarize_not_false");
  }

  if (runtimeContract?.may_include_extra_explanation !== false) {
    validationErrors.push("runtime_contract_extra_explanation_not_false");
  }

  if (runtimeContract?.may_construct_response !== false) {
    validationErrors.push("runtime_contract_may_construct_response_not_false");
  }

  if (runtimeContract?.may_save_candidate !== false) {
    validationErrors.push("runtime_contract_may_save_candidate_not_false");
  }

  if (runtimeContract?.may_approve_candidate !== false) {
    validationErrors.push("runtime_contract_may_approve_candidate_not_false");
  }

  if (runtimeContract?.may_adopt_candidate !== false) {
    validationErrors.push("runtime_contract_may_adopt_candidate_not_false");
  }

  if (runtimeContract?.may_update_canon !== false) {
    validationErrors.push("runtime_contract_may_update_canon_not_false");
  }

  if (runtimeContract?.may_update_active_engine !== false) {
    validationErrors.push("runtime_contract_may_update_active_engine_not_false");
  }

  const contractValid = validationErrors.length === 0;
  const negativeHash = contractValid && typeof finalText === "string" ? sha256(finalText) : null;

  return {
    used: true,
    phase: "35B",
    surface_kind: chatgptFinalOutputNegativeRuntimeSmokeKind,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? "negative_runtime_smoke_passed"
      : "negative_runtime_smoke_failed",
    response_kind: contractValid
      ? "negative_runtime_smoke_reference"
      : "negative_runtime_smoke_invalid_reference",
    can_emit_response_to_chat: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    phase_dependency: "35A",
    phase_range: "34J-35B",
    operator_runtime_contract: chatgptFinalOutputNegativeRuntimeContract,
    final_closure_seal: chatgptFinalOutputNegativeRuntimeFinalSeal,
    negative_runtime_required_entrypoint: chatgptFinalOutputNegativeRuntimeRequiredEntrypoint,
    negative_runtime_canonical_entrypoint: chatgptFinalOutputNegativeRuntimeCanonicalEntrypoint,
    negative_runtime_required_root_field: chatgptFinalOutputNegativeRuntimeRootField,
    negative_runtime_must_call: chatgptFinalOutputNegativeRuntimeRequiredEntrypoint,
    negative_runtime_must_emit_exact_return_value: true,
    negative_runtime_decoy_isolation_required: true,
    negative_runtime_smoke_passed: contractValid,
    negative_runtime_must_not_emit_negative_smoke: true,
    negative_runtime_must_not_emit_runtime_contract: true,
    negative_runtime_must_not_emit_final_seal: true,
    negative_runtime_must_not_emit_final_smoke: true,
    negative_runtime_must_not_emit_readiness: true,
    negative_runtime_must_not_emit_live_acceptance: true,
    negative_runtime_must_not_emit_final_closure_index: true,
    negative_runtime_must_not_emit_operator_checklist: true,
    negative_runtime_must_not_emit_result_surface: true,
    negative_runtime_must_not_read_result: true,
    negative_runtime_must_not_recompose_response: true,
    negative_runtime_must_not_rewrite: true,
    negative_runtime_must_not_summarize: true,
    negative_runtime_must_not_add_explanation: true,
    negative_runtime_reference_output_hash: negativeHash,
    negative_runtime_reference_output_source: contractValid ? chatgptFinalOutputNegativeRuntimeRequiredEntrypoint : null,
    negative_runtime_output_matches_root: contractValid && typeof finalText === "string" && finalText === rootOutput?.output_text,
    negative_runtime_output_matches_canonical_emit: contractValid && typeof finalText === "string" && finalText === canonicalText,
    negative_runtime_output_matches_final_seal_reference: contractValid && typeof finalText === "string" && finalText === finalSeal?.reference_final_output_text,
    negative_runtime_output_matches_operator_runtime_contract: contractValid && runtimeContract?.runtime_output_matches_root === true,
    negative_runtime_smoke_is_reference_only: true,
    negative_runtime_smoke_must_not_replace_final_output: true,
    negative_runtime_smoke_must_not_be_emitted_as_chat_output: true,
    negative_runtime_smoke_adds_output_layer: false,
    no_new_output_layer: true,
    negative_runtime_invalid_notice: contractValid ? null : [
      "ChatGPT final output negative runtime smoke failed.",
      "blocked_stage: final_output_negative_runtime_smoke",
      "operator_action: inspect_phase35a_operator_runtime_contract",
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
    safety: buildChatgptFinalOutputSafety(runtimeContract?.safety),
  };
}


const chatgptFinalOutputRuntimeClosureIndexKind = "chatgpt_final_output_runtime_closure_index";
const chatgptFinalOutputRuntimeClosureEntrypoint = "acceptChatgptFinalOutputFromRealActionSurface(tool_response)";
const chatgptFinalOutputRuntimeClosureCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputRuntimeClosureRootField = "tool_response.chatgpt_final_output.output_text";

function buildChatgptFinalOutputRuntimeClosureIndexEntries() {
  return [
    {
      phase: "35A",
      name: "ChatGPT real action final output operator runtime contract",
      test_path: "tests/phase35/phase35a-chatgpt-real-action-final-output-operator-runtime-contract.test.mjs",
      role: "positive_operator_runtime_contract",
      reference: "buildChatgptFinalOutputOperatorRuntimeContract(tool_response)",
    },
    {
      phase: "35B",
      name: "ChatGPT real action final output negative runtime smoke",
      test_path: "tests/phase35/phase35b-chatgpt-real-action-final-output-negative-runtime-smoke.test.mjs",
      role: "negative_runtime_decoy_isolation_smoke",
      reference: "buildChatgptFinalOutputNegativeRuntimeSmoke(tool_response)",
    },
  ];
}

function buildChatgptFinalOutputRuntimeClosureIndexForbiddenSources() {
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
    "buildChatgptFinalOutputNegativeRuntimeSmoke(tool_response)",
    "buildChatgptFinalOutputRuntimeClosureIndex(tool_response)",
  ];
}

export function buildChatgptFinalOutputRuntimeClosureIndex(toolResponse = {}) {
  const runtimeContract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const negativeSmoke = buildChatgptFinalOutputNegativeRuntimeSmoke(toolResponse);
  const finalSeal = buildChatgptFinalOutputFinalClosureSeal(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const closureEntries = buildChatgptFinalOutputRuntimeClosureIndexEntries();
  const forbiddenSources = buildChatgptFinalOutputRuntimeClosureIndexForbiddenSources();
  const validationErrors = [];

  if (runtimeContract?.used !== true) {
    validationErrors.push("operator_runtime_contract_used_false_or_missing");
  }

  if (runtimeContract?.phase !== "35A") {
    validationErrors.push("operator_runtime_contract_phase_not_35a");
  }

  if (runtimeContract?.contract_valid !== true) {
    validationErrors.push("operator_runtime_contract_invalid");
  }

  if (runtimeContract?.status !== "operator_runtime_contract_ready") {
    validationErrors.push("operator_runtime_contract_status_not_ready");
  }

  if (runtimeContract?.runtime_required_entrypoint !== chatgptFinalOutputRuntimeClosureEntrypoint) {
    validationErrors.push("operator_runtime_contract_entrypoint_mismatch");
  }

  if (runtimeContract?.runtime_required_root_field !== chatgptFinalOutputRuntimeClosureRootField) {
    validationErrors.push("operator_runtime_contract_root_field_mismatch");
  }

  if (runtimeContract?.runtime_must_emit_exact_return_value !== true) {
    validationErrors.push("operator_runtime_contract_exact_return_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_runtime_contract !== true) {
    validationErrors.push("operator_runtime_contract_self_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_final_seal !== true) {
    validationErrors.push("operator_runtime_contract_final_seal_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_final_smoke !== true) {
    validationErrors.push("operator_runtime_contract_final_smoke_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_readiness !== true) {
    validationErrors.push("operator_runtime_contract_readiness_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_live_acceptance !== true) {
    validationErrors.push("operator_runtime_contract_live_acceptance_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_final_closure_index !== true) {
    validationErrors.push("operator_runtime_contract_final_closure_index_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_operator_checklist !== true) {
    validationErrors.push("operator_runtime_contract_operator_checklist_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_emit_result_surface !== true) {
    validationErrors.push("operator_runtime_contract_result_surface_emit_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_read_result !== true) {
    validationErrors.push("operator_runtime_contract_result_read_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_recompose_response !== true) {
    validationErrors.push("operator_runtime_contract_recompose_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_rewrite !== true) {
    validationErrors.push("operator_runtime_contract_rewrite_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_summarize !== true) {
    validationErrors.push("operator_runtime_contract_summarize_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_add_explanation !== true) {
    validationErrors.push("operator_runtime_contract_explanation_guard_not_true");
  }

  if (runtimeContract?.runtime_contract_is_reference_only !== true) {
    validationErrors.push("operator_runtime_contract_reference_only_not_true");
  }

  if (runtimeContract?.runtime_contract_adds_output_layer !== false) {
    validationErrors.push("operator_runtime_contract_adds_output_layer_not_false");
  }

  if (runtimeContract?.no_new_output_layer !== true) {
    validationErrors.push("operator_runtime_contract_no_new_output_layer_not_true");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_output_text");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "reference_final_output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_reference_final_output_text");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "runtime_reference_output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_runtime_reference_output_text");
  }

  if (negativeSmoke?.used !== true) {
    validationErrors.push("negative_runtime_smoke_used_false_or_missing");
  }

  if (negativeSmoke?.phase !== "35B") {
    validationErrors.push("negative_runtime_smoke_phase_not_35b");
  }

  if (negativeSmoke?.contract_valid !== true) {
    validationErrors.push("negative_runtime_smoke_invalid");
  }

  if (negativeSmoke?.status !== "negative_runtime_smoke_passed") {
    validationErrors.push("negative_runtime_smoke_status_not_passed");
  }

  if (negativeSmoke?.phase_dependency !== "35A") {
    validationErrors.push("negative_runtime_smoke_phase_dependency_not_35a");
  }

  if (negativeSmoke?.negative_runtime_required_entrypoint !== chatgptFinalOutputRuntimeClosureEntrypoint) {
    validationErrors.push("negative_runtime_smoke_entrypoint_mismatch");
  }

  if (negativeSmoke?.negative_runtime_canonical_entrypoint !== chatgptFinalOutputRuntimeClosureCanonicalEntrypoint) {
    validationErrors.push("negative_runtime_smoke_canonical_entrypoint_mismatch");
  }

  if (negativeSmoke?.negative_runtime_required_root_field !== chatgptFinalOutputRuntimeClosureRootField) {
    validationErrors.push("negative_runtime_smoke_root_field_mismatch");
  }

  if (negativeSmoke?.negative_runtime_must_emit_exact_return_value !== true) {
    validationErrors.push("negative_runtime_smoke_exact_return_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_decoy_isolation_required !== true) {
    validationErrors.push("negative_runtime_smoke_decoy_isolation_not_required");
  }

  if (negativeSmoke?.negative_runtime_smoke_passed !== true) {
    validationErrors.push("negative_runtime_smoke_passed_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_negative_smoke !== true) {
    validationErrors.push("negative_runtime_smoke_self_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_runtime_contract !== true) {
    validationErrors.push("negative_runtime_smoke_runtime_contract_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_final_seal !== true) {
    validationErrors.push("negative_runtime_smoke_final_seal_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_final_smoke !== true) {
    validationErrors.push("negative_runtime_smoke_final_smoke_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_readiness !== true) {
    validationErrors.push("negative_runtime_smoke_readiness_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_live_acceptance !== true) {
    validationErrors.push("negative_runtime_smoke_live_acceptance_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_final_closure_index !== true) {
    validationErrors.push("negative_runtime_smoke_final_closure_index_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_operator_checklist !== true) {
    validationErrors.push("negative_runtime_smoke_operator_checklist_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_emit_result_surface !== true) {
    validationErrors.push("negative_runtime_smoke_result_surface_emit_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_read_result !== true) {
    validationErrors.push("negative_runtime_smoke_result_read_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_recompose_response !== true) {
    validationErrors.push("negative_runtime_smoke_recompose_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_rewrite !== true) {
    validationErrors.push("negative_runtime_smoke_rewrite_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_summarize !== true) {
    validationErrors.push("negative_runtime_smoke_summarize_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_add_explanation !== true) {
    validationErrors.push("negative_runtime_smoke_explanation_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_smoke_is_reference_only !== true) {
    validationErrors.push("negative_runtime_smoke_reference_only_not_true");
  }

  if (negativeSmoke?.negative_runtime_smoke_adds_output_layer !== false) {
    validationErrors.push("negative_runtime_smoke_adds_output_layer_not_false");
  }

  if (negativeSmoke?.no_new_output_layer !== true) {
    validationErrors.push("negative_runtime_smoke_no_new_output_layer_not_true");
  }

  if (Object.hasOwn(negativeSmoke ?? {}, "output_text")) {
    validationErrors.push("negative_runtime_smoke_exposes_output_text");
  }

  if (Object.hasOwn(negativeSmoke ?? {}, "reference_final_output_text")) {
    validationErrors.push("negative_runtime_smoke_exposes_reference_final_output_text");
  }

  if (Object.hasOwn(negativeSmoke ?? {}, "negative_runtime_reference_output_text")) {
    validationErrors.push("negative_runtime_smoke_exposes_negative_runtime_reference_output_text");
  }

  if (finalSeal?.used !== true) {
    validationErrors.push("final_closure_seal_used_false_or_missing");
  }

  if (finalSeal?.phase !== "34Z") {
    validationErrors.push("final_closure_seal_phase_not_34z");
  }

  if (finalSeal?.contract_valid !== true) {
    validationErrors.push("final_closure_seal_contract_invalid");
  }

  if (finalSeal?.final_output_must_still_use_entrypoint !== true) {
    validationErrors.push("final_closure_seal_entrypoint_guard_not_true");
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
    validationErrors.push("runtime_closure_entrypoint_text_missing_or_not_string");
  }

  if (typeof canonicalText !== "string") {
    validationErrors.push("runtime_closure_canonical_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof canonicalText === "string" && finalText !== canonicalText) {
    validationErrors.push("runtime_closure_entrypoint_canonical_mismatch");
  }

  if (typeof finalText === "string" && typeof rootOutput?.output_text === "string" && finalText !== rootOutput.output_text) {
    validationErrors.push("runtime_closure_entrypoint_root_mismatch");
  }

  if (runtimeContract?.runtime_output_matches_root !== true) {
    validationErrors.push("runtime_contract_output_matches_root_not_true");
  }

  if (negativeSmoke?.negative_runtime_output_matches_root !== true) {
    validationErrors.push("negative_runtime_output_matches_root_not_true");
  }

  const actualPhases = closureEntries.map((entry) => entry.phase);
  if (JSON.stringify(actualPhases) !== JSON.stringify(["35A", "35B"])) {
    validationErrors.push("runtime_closure_index_phase_order_mismatch");
  }

  if (!closureEntries.every((entry) => entry.phase && entry.name && entry.test_path && entry.role && entry.reference)) {
    validationErrors.push("runtime_closure_index_entry_shape_invalid");
  }

  const contractValid = validationErrors.length === 0;
  const closureHash = contractValid && typeof finalText === "string" ? sha256(finalText) : null;

  return {
    used: true,
    phase: "35C",
    surface_kind: chatgptFinalOutputRuntimeClosureIndexKind,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? "runtime_closure_index_ready"
      : "runtime_closure_index_invalid",
    response_kind: contractValid
      ? "runtime_closure_index_reference"
      : "runtime_closure_index_invalid_reference",
    can_emit_response_to_chat: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    phase_range: "35A-35B",
    phase_dependency: "35B",
    closure_scope: "chatgpt_real_action_final_output_runtime",
    runtime_final_entrypoint: chatgptFinalOutputRuntimeClosureEntrypoint,
    runtime_canonical_entrypoint: chatgptFinalOutputRuntimeClosureCanonicalEntrypoint,
    root_consumable_field: chatgptFinalOutputRuntimeClosureRootField,
    runtime_closure_index_entries: closureEntries,
    runtime_closure_index_is_reference_only: true,
    runtime_closure_index_must_not_replace_final_output: true,
    runtime_closure_index_must_not_be_emitted_as_chat_output: true,
    runtime_closure_index_may_not_be_read_for_chat_output: true,
    runtime_output_must_still_use_entrypoint: true,
    runtime_closure_index_adds_output_layer: false,
    no_new_output_layer: true,
    runtime_must_emit_exact_return_value: true,
    runtime_must_not_emit_runtime_contract: true,
    runtime_must_not_emit_negative_smoke: true,
    runtime_must_not_emit_runtime_closure_index: true,
    runtime_must_not_emit_final_seal: true,
    runtime_must_not_emit_final_smoke: true,
    runtime_must_not_emit_readiness: true,
    runtime_must_not_emit_live_acceptance: true,
    runtime_must_not_emit_final_closure_index: true,
    runtime_must_not_emit_operator_checklist: true,
    runtime_must_not_emit_result_surface: true,
    runtime_must_not_read_result: true,
    runtime_must_not_recompose_response: true,
    runtime_must_not_rewrite: true,
    runtime_must_not_summarize: true,
    runtime_must_not_add_explanation: true,
    runtime_closure_reference_output_hash: closureHash,
    runtime_closure_reference_output_source: contractValid ? chatgptFinalOutputRuntimeClosureEntrypoint : null,
    runtime_closure_output_matches_root: contractValid && typeof finalText === "string" && finalText === rootOutput?.output_text,
    runtime_closure_output_matches_canonical_emit: contractValid && typeof finalText === "string" && finalText === canonicalText,
    runtime_closure_output_matches_operator_runtime_contract: contractValid && runtimeContract?.runtime_output_matches_root === true,
    runtime_closure_output_matches_negative_runtime_smoke: contractValid && negativeSmoke?.negative_runtime_output_matches_root === true,
    runtime_closure_invalid_notice: contractValid ? null : [
      "ChatGPT final output runtime closure index invalid.",
      "blocked_stage: final_output_runtime_closure_index",
      "operator_action: inspect_phase35a_phase35b_runtime_chain",
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
    safety: buildChatgptFinalOutputSafety(negativeSmoke?.safety),
  };
}


const chatgptFinalOutputRuntimeFinalSealKind = "chatgpt_final_output_runtime_final_seal";
const chatgptFinalOutputRuntimeFinalSealEntrypoint = "acceptChatgptFinalOutputFromRealActionSurface(tool_response)";
const chatgptFinalOutputRuntimeFinalSealCanonicalEntrypoint = "emitChatgptFinalOutputText(tool_response)";
const chatgptFinalOutputRuntimeFinalSealRootField = "tool_response.chatgpt_final_output.output_text";

function buildChatgptFinalOutputRuntimeFinalSealEntries() {
  return [
    {
      phase: "35A",
      name: "ChatGPT real action final output operator runtime contract",
      test_path: "tests/phase35/phase35a-chatgpt-real-action-final-output-operator-runtime-contract.test.mjs",
      role: "positive_operator_runtime_contract",
      reference: "buildChatgptFinalOutputOperatorRuntimeContract(tool_response)",
    },
    {
      phase: "35B",
      name: "ChatGPT real action final output negative runtime smoke",
      test_path: "tests/phase35/phase35b-chatgpt-real-action-final-output-negative-runtime-smoke.test.mjs",
      role: "negative_runtime_decoy_isolation_smoke",
      reference: "buildChatgptFinalOutputNegativeRuntimeSmoke(tool_response)",
    },
    {
      phase: "35C",
      name: "ChatGPT real action final output runtime closure index",
      test_path: "tests/phase35/phase35c-chatgpt-real-action-final-output-runtime-closure-index.test.mjs",
      role: "runtime_closure_index",
      reference: "buildChatgptFinalOutputRuntimeClosureIndex(tool_response)",
    },
  ];
}

function buildChatgptFinalOutputRuntimeFinalSealForbiddenSources() {
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
    "buildChatgptFinalOutputNegativeRuntimeSmoke(tool_response)",
    "buildChatgptFinalOutputRuntimeClosureIndex(tool_response)",
    "buildChatgptFinalOutputRuntimeFinalSeal(tool_response)",
  ];
}

export function buildChatgptFinalOutputRuntimeFinalSeal(toolResponse = {}) {
  const runtimeContract = buildChatgptFinalOutputOperatorRuntimeContract(toolResponse);
  const negativeSmoke = buildChatgptFinalOutputNegativeRuntimeSmoke(toolResponse);
  const runtimeClosureIndex = buildChatgptFinalOutputRuntimeClosureIndex(toolResponse);
  const finalText = acceptChatgptFinalOutputFromRealActionSurface(toolResponse);
  const canonicalText = emitChatgptFinalOutputText(toolResponse);
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const finalSealEntries = buildChatgptFinalOutputRuntimeFinalSealEntries();
  const forbiddenSources = buildChatgptFinalOutputRuntimeFinalSealForbiddenSources();
  const validationErrors = [];

  if (runtimeContract?.used !== true) {
    validationErrors.push("operator_runtime_contract_used_false_or_missing");
  }

  if (runtimeContract?.phase !== "35A") {
    validationErrors.push("operator_runtime_contract_phase_not_35a");
  }

  if (runtimeContract?.contract_valid !== true) {
    validationErrors.push("operator_runtime_contract_invalid");
  }

  if (runtimeContract?.runtime_required_entrypoint !== chatgptFinalOutputRuntimeFinalSealEntrypoint) {
    validationErrors.push("operator_runtime_contract_entrypoint_mismatch");
  }

  if (runtimeContract?.runtime_required_root_field !== chatgptFinalOutputRuntimeFinalSealRootField) {
    validationErrors.push("operator_runtime_contract_root_field_mismatch");
  }

  if (runtimeContract?.runtime_must_emit_exact_return_value !== true) {
    validationErrors.push("operator_runtime_contract_exact_return_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_read_result !== true) {
    validationErrors.push("operator_runtime_contract_result_read_guard_not_true");
  }

  if (runtimeContract?.runtime_must_not_recompose_response !== true) {
    validationErrors.push("operator_runtime_contract_recompose_guard_not_true");
  }

  if (runtimeContract?.runtime_contract_is_reference_only !== true) {
    validationErrors.push("operator_runtime_contract_reference_only_not_true");
  }

  if (runtimeContract?.runtime_contract_adds_output_layer !== false) {
    validationErrors.push("operator_runtime_contract_adds_output_layer_not_false");
  }

  if (runtimeContract?.no_new_output_layer !== true) {
    validationErrors.push("operator_runtime_contract_no_new_output_layer_not_true");
  }

  if (negativeSmoke?.used !== true) {
    validationErrors.push("negative_runtime_smoke_used_false_or_missing");
  }

  if (negativeSmoke?.phase !== "35B") {
    validationErrors.push("negative_runtime_smoke_phase_not_35b");
  }

  if (negativeSmoke?.contract_valid !== true) {
    validationErrors.push("negative_runtime_smoke_invalid");
  }

  if (negativeSmoke?.status !== "negative_runtime_smoke_passed") {
    validationErrors.push("negative_runtime_smoke_status_not_passed");
  }

  if (negativeSmoke?.negative_runtime_required_entrypoint !== chatgptFinalOutputRuntimeFinalSealEntrypoint) {
    validationErrors.push("negative_runtime_smoke_entrypoint_mismatch");
  }

  if (negativeSmoke?.negative_runtime_required_root_field !== chatgptFinalOutputRuntimeFinalSealRootField) {
    validationErrors.push("negative_runtime_smoke_root_field_mismatch");
  }

  if (negativeSmoke?.negative_runtime_decoy_isolation_required !== true) {
    validationErrors.push("negative_runtime_smoke_decoy_isolation_not_required");
  }

  if (negativeSmoke?.negative_runtime_smoke_passed !== true) {
    validationErrors.push("negative_runtime_smoke_passed_not_true");
  }

  if (negativeSmoke?.negative_runtime_must_not_read_result !== true) {
    validationErrors.push("negative_runtime_smoke_result_read_guard_not_true");
  }

  if (negativeSmoke?.negative_runtime_smoke_is_reference_only !== true) {
    validationErrors.push("negative_runtime_smoke_reference_only_not_true");
  }

  if (negativeSmoke?.negative_runtime_smoke_adds_output_layer !== false) {
    validationErrors.push("negative_runtime_smoke_adds_output_layer_not_false");
  }

  if (negativeSmoke?.no_new_output_layer !== true) {
    validationErrors.push("negative_runtime_smoke_no_new_output_layer_not_true");
  }

  if (runtimeClosureIndex?.used !== true) {
    validationErrors.push("runtime_closure_index_used_false_or_missing");
  }

  if (runtimeClosureIndex?.phase !== "35C") {
    validationErrors.push("runtime_closure_index_phase_not_35c");
  }

  if (runtimeClosureIndex?.contract_valid !== true) {
    validationErrors.push("runtime_closure_index_invalid");
  }

  if (runtimeClosureIndex?.status !== "runtime_closure_index_ready") {
    validationErrors.push("runtime_closure_index_status_not_ready");
  }

  if (runtimeClosureIndex?.phase_range !== "35A-35B") {
    validationErrors.push("runtime_closure_index_phase_range_mismatch");
  }

  if (runtimeClosureIndex?.phase_dependency !== "35B") {
    validationErrors.push("runtime_closure_index_dependency_not_35b");
  }

  if (runtimeClosureIndex?.closure_scope !== "chatgpt_real_action_final_output_runtime") {
    validationErrors.push("runtime_closure_index_scope_mismatch");
  }

  if (runtimeClosureIndex?.runtime_final_entrypoint !== chatgptFinalOutputRuntimeFinalSealEntrypoint) {
    validationErrors.push("runtime_closure_index_entrypoint_mismatch");
  }

  if (runtimeClosureIndex?.runtime_canonical_entrypoint !== chatgptFinalOutputRuntimeFinalSealCanonicalEntrypoint) {
    validationErrors.push("runtime_closure_index_canonical_entrypoint_mismatch");
  }

  if (runtimeClosureIndex?.root_consumable_field !== chatgptFinalOutputRuntimeFinalSealRootField) {
    validationErrors.push("runtime_closure_index_root_field_mismatch");
  }

  if (runtimeClosureIndex?.runtime_closure_index_is_reference_only !== true) {
    validationErrors.push("runtime_closure_index_reference_only_not_true");
  }

  if (runtimeClosureIndex?.runtime_closure_index_must_not_replace_final_output !== true) {
    validationErrors.push("runtime_closure_index_replace_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_closure_index_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("runtime_closure_index_emit_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_closure_index_may_not_be_read_for_chat_output !== true) {
    validationErrors.push("runtime_closure_index_read_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_output_must_still_use_entrypoint !== true) {
    validationErrors.push("runtime_closure_index_entrypoint_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_closure_index_adds_output_layer !== false) {
    validationErrors.push("runtime_closure_index_adds_output_layer_not_false");
  }

  if (runtimeClosureIndex?.no_new_output_layer !== true) {
    validationErrors.push("runtime_closure_index_no_new_output_layer_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_emit_exact_return_value !== true) {
    validationErrors.push("runtime_closure_index_exact_return_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_emit_runtime_contract !== true) {
    validationErrors.push("runtime_closure_index_runtime_contract_emit_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_emit_negative_smoke !== true) {
    validationErrors.push("runtime_closure_index_negative_smoke_emit_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_emit_runtime_closure_index !== true) {
    validationErrors.push("runtime_closure_index_self_emit_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_read_result !== true) {
    validationErrors.push("runtime_closure_index_result_read_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_recompose_response !== true) {
    validationErrors.push("runtime_closure_index_recompose_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_rewrite !== true) {
    validationErrors.push("runtime_closure_index_rewrite_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_summarize !== true) {
    validationErrors.push("runtime_closure_index_summarize_guard_not_true");
  }

  if (runtimeClosureIndex?.runtime_must_not_add_explanation !== true) {
    validationErrors.push("runtime_closure_index_explanation_guard_not_true");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_output_text");
  }

  if (Object.hasOwn(runtimeContract ?? {}, "runtime_reference_output_text")) {
    validationErrors.push("operator_runtime_contract_exposes_runtime_reference_output_text");
  }

  if (Object.hasOwn(negativeSmoke ?? {}, "output_text")) {
    validationErrors.push("negative_runtime_smoke_exposes_output_text");
  }

  if (Object.hasOwn(negativeSmoke ?? {}, "negative_runtime_reference_output_text")) {
    validationErrors.push("negative_runtime_smoke_exposes_negative_reference_output_text");
  }

  if (Object.hasOwn(runtimeClosureIndex ?? {}, "output_text")) {
    validationErrors.push("runtime_closure_index_exposes_output_text");
  }

  if (Object.hasOwn(runtimeClosureIndex ?? {}, "runtime_closure_reference_output_text")) {
    validationErrors.push("runtime_closure_index_exposes_runtime_closure_reference_output_text");
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
    validationErrors.push("runtime_final_seal_entrypoint_text_missing_or_not_string");
  }

  if (typeof canonicalText !== "string") {
    validationErrors.push("runtime_final_seal_canonical_text_missing_or_not_string");
  }

  if (typeof finalText === "string" && typeof canonicalText === "string" && finalText !== canonicalText) {
    validationErrors.push("runtime_final_seal_entrypoint_canonical_mismatch");
  }

  if (typeof finalText === "string" && typeof rootOutput?.output_text === "string" && finalText !== rootOutput.output_text) {
    validationErrors.push("runtime_final_seal_entrypoint_root_mismatch");
  }

  if (runtimeContract?.runtime_output_matches_root !== true) {
    validationErrors.push("runtime_contract_output_matches_root_not_true");
  }

  if (negativeSmoke?.negative_runtime_output_matches_root !== true) {
    validationErrors.push("negative_runtime_output_matches_root_not_true");
  }

  if (runtimeClosureIndex?.runtime_closure_output_matches_root !== true) {
    validationErrors.push("runtime_closure_output_matches_root_not_true");
  }

  const actualPhases = finalSealEntries.map((entry) => entry.phase);
  if (JSON.stringify(actualPhases) !== JSON.stringify(["35A", "35B", "35C"])) {
    validationErrors.push("runtime_final_seal_phase_order_mismatch");
  }

  if (!finalSealEntries.every((entry) => entry.phase && entry.name && entry.test_path && entry.role && entry.reference)) {
    validationErrors.push("runtime_final_seal_entry_shape_invalid");
  }

  const contractValid = validationErrors.length === 0;
  const sealHash = contractValid && typeof finalText === "string" ? sha256(finalText) : null;

  return {
    used: true,
    phase: "35D",
    surface_kind: chatgptFinalOutputRuntimeFinalSealKind,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? "runtime_final_seal_closed"
      : "runtime_final_seal_invalid",
    response_kind: contractValid
      ? "runtime_final_seal_reference"
      : "runtime_final_seal_invalid_reference",
    can_emit_response_to_chat: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    phase_range: "35A-35C",
    phase_dependency: "35C",
    seal_scope: "chatgpt_real_action_final_output_runtime",
    runtime_final_entrypoint: chatgptFinalOutputRuntimeFinalSealEntrypoint,
    runtime_canonical_entrypoint: chatgptFinalOutputRuntimeFinalSealCanonicalEntrypoint,
    root_consumable_field: chatgptFinalOutputRuntimeFinalSealRootField,
    runtime_final_seal_entries: finalSealEntries,
    runtime_final_seal_is_reference_only: true,
    runtime_final_seal_must_not_replace_final_output: true,
    runtime_final_seal_must_not_be_emitted_as_chat_output: true,
    runtime_final_seal_may_not_be_read_for_chat_output: true,
    runtime_output_must_still_use_entrypoint: true,
    runtime_final_seal_adds_output_layer: false,
    no_new_output_layer: true,
    runtime_must_emit_exact_return_value: true,
    runtime_must_not_emit_runtime_contract: true,
    runtime_must_not_emit_negative_smoke: true,
    runtime_must_not_emit_runtime_closure_index: true,
    runtime_must_not_emit_runtime_final_seal: true,
    runtime_must_not_emit_final_seal: true,
    runtime_must_not_emit_final_smoke: true,
    runtime_must_not_emit_readiness: true,
    runtime_must_not_emit_live_acceptance: true,
    runtime_must_not_emit_final_closure_index: true,
    runtime_must_not_emit_operator_checklist: true,
    runtime_must_not_emit_result_surface: true,
    runtime_must_not_read_result: true,
    runtime_must_not_recompose_response: true,
    runtime_must_not_rewrite: true,
    runtime_must_not_summarize: true,
    runtime_must_not_add_explanation: true,
    runtime_final_seal_reference_output_hash: sealHash,
    runtime_final_seal_reference_output_source: contractValid ? chatgptFinalOutputRuntimeFinalSealEntrypoint : null,
    runtime_final_seal_output_matches_root: contractValid && typeof finalText === "string" && finalText === rootOutput?.output_text,
    runtime_final_seal_output_matches_canonical_emit: contractValid && typeof finalText === "string" && finalText === canonicalText,
    runtime_final_seal_output_matches_operator_runtime_contract: contractValid && runtimeContract?.runtime_output_matches_root === true,
    runtime_final_seal_output_matches_negative_runtime_smoke: contractValid && negativeSmoke?.negative_runtime_output_matches_root === true,
    runtime_final_seal_output_matches_runtime_closure_index: contractValid && runtimeClosureIndex?.runtime_closure_output_matches_root === true,
    runtime_final_seal_invalid_notice: contractValid ? null : [
      "ChatGPT final output runtime final seal invalid.",
      "blocked_stage: final_output_runtime_final_seal",
      "operator_action: inspect_phase35a_to_phase35c_runtime_chain",
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
    safety: buildChatgptFinalOutputSafety(runtimeClosureIndex?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsSurfaceKind =
  "chatgpt_bridge_operator_compact_diagnostics_surface";
const chatgptOperatorCompactDiagnosticsVersion =
  "chatgpt_bridge_operator_compact_diagnostics_surface_v1";

function compactStringArray(value, maximum = 12) {
  return (Array.isArray(value) ? value : [])
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .slice(0, maximum);
}

function compactBlockedChecks(blockedModules = []) {
  return (Array.isArray(blockedModules) ? blockedModules : [])
    .flatMap((item) => compactStringArray(item?.missing_reasons, 8)
      .map((reason) => `${item.key}:${reason}`))
    .slice(0, 32);
}

function compactModuleRows(blockedModules = []) {
  return (Array.isArray(blockedModules) ? blockedModules : [])
    .map((item) => ({
      key: item.key ?? null,
      label: item.label ?? null,
      missing_reasons: compactStringArray(item.missing_reasons, 8),
      missing_requirements: compactStringArray(item.missing_requirements, 8),
      recommended_operator_action: item.recommended_operator_action ?? null,
    }))
    .slice(0, 12);
}

function compactDiagnosticsText({
  blocked,
  summaryForChat,
  missingModules,
  blockedChecks,
  operatorNextSteps,
}) {
  if (!blocked) {
    return [
      "READY: required brain modules diagnostics clear.",
      summaryForChat,
    ].filter(Boolean).join("\n");
  }

  return [
    "BLOCKED: required brain modules contract invalid.",
    summaryForChat,
    "missing_modules: " + (missingModules.length ? missingModules.join(", ") : "none"),
    "blocked_checks: " + (blockedChecks.length ? blockedChecks.join(", ") : "unknown"),
    "operator_next_steps: " + (operatorNextSteps.length ? operatorNextSteps.join(" | ") : "Inspect required brain module diagnostics."),
  ].filter(Boolean).join("\n");
}

export function buildChatgptOperatorCompactDiagnosticsSurface(
  surfacedResult = {},
  chatgptFinalOutput = null,
) {
  const brainContract =
    surfacedResult?.neural_writing_brain_required_modules_contract ?? null;
  const diagnostics =
    brainContract?.operator_diagnostics
    ?? brainContract?.readable_diagnostics
    ?? null;

  if (diagnostics?.used !== true) {
    return {
      used: false,
      phase: "36C",
      surface_kind: chatgptOperatorCompactDiagnosticsSurfaceKind,
      version: chatgptOperatorCompactDiagnosticsVersion,
      reason: "required_brain_modules_operator_diagnostics_missing",
      contract_valid: false,
      compact_surface_valid: false,
      blocked: false,
      can_output_to_chat: chatgptFinalOutput?.can_output_to_chat === true,
      may_output_story_text: chatgptFinalOutput?.may_output_story_text === true,
      safety: buildChatgptFinalOutputSafety(chatgptFinalOutput?.safety),
    };
  }

  const blockedModules = Array.isArray(diagnostics.blocked_module_diagnostics)
    ? diagnostics.blocked_module_diagnostics
    : [];
  const missingModules = compactStringArray(
    diagnostics.missing_required_brain_modules,
    12,
  );
  const blockedChecks = compactBlockedChecks(blockedModules);
  const operatorNextSteps = compactStringArray(
    diagnostics.diagnostic_checklist_for_operator,
    12,
  );
  const blocked = diagnostics.blocked === true || diagnostics.contract_valid !== true;
  const summaryForChat = diagnostics.summary_for_chat ?? "";
  const summaryForOperator = diagnostics.summary_for_operator ?? "";
  const outputText = compactDiagnosticsText({
    blocked,
    summaryForChat,
    missingModules,
    blockedChecks,
    operatorNextSteps,
  });

  return {
    used: true,
    phase: "36C",
    surface_kind: chatgptOperatorCompactDiagnosticsSurfaceKind,
    version: chatgptOperatorCompactDiagnosticsVersion,
    status: blocked
      ? "operator_compact_diagnostics_blocked"
      : "operator_compact_diagnostics_clear",
    contract_valid: true,
    compact_surface_valid: true,
    source_contract_valid: brainContract?.contract_valid === true,
    source_diagnostics_valid: diagnostics.diagnostics_valid === true,
    source_phase: diagnostics.phase ?? null,
    source_surface_kind: diagnostics.surface_kind ?? null,

    blocked,
    blocked_reason: blocked ? diagnostics.blocked_reason ?? "required_brain_modules_contract_invalid" : null,
    response_kind: chatgptFinalOutput?.response_kind ?? null,
    can_output_to_chat: blocked ? false : chatgptFinalOutput?.can_output_to_chat === true,
    may_output_story_text: blocked ? false : chatgptFinalOutput?.may_output_story_text === true,
    must_not_output_candidate: blocked,
    must_not_output_candidate_reason: blocked ? "required_brain_modules_contract_invalid" : null,

    summary_for_chat: summaryForChat,
    summary_for_operator: summaryForOperator,
    missing_modules: missingModules,
    blocked_checks: blockedChecks,
    blocked_module_count: Number.isInteger(diagnostics.blocked_module_count)
      ? diagnostics.blocked_module_count
      : blockedModules.length,
    blocked_module_summaries: compactModuleRows(blockedModules),
    operator_next_steps: operatorNextSteps,
    first_operator_action: diagnostics.first_operator_action ?? null,

    compact_diagnostics_text: outputText,
    compact_diagnostics_hash: sha256(outputText),
    compact_diagnostics_source:
      "tool_response.result.neural_writing_brain_required_modules_contract.operator_diagnostics",

    root_chatgpt_final_output_present: chatgptFinalOutput?.used === true,
    root_output_hash: chatgptFinalOutput?.output_hash ?? null,
    root_output_source: chatgptFinalOutput?.output_source ?? null,
    compact_surface_is_reference_only: true,
    compact_surface_must_not_replace_final_output: true,
    compact_surface_must_not_be_emitted_as_story_text: true,
    final_output_must_still_use_root_chatgpt_final_output: true,

    safety: buildChatgptFinalOutputSafety(chatgptFinalOutput?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsConsumerSurfaceKind =
  "chatgpt_bridge_operator_compact_diagnostics_consumer_renderer_contract";
const chatgptOperatorCompactDiagnosticsConsumerVersion =
  "chatgpt_bridge_operator_compact_diagnostics_consumer_renderer_contract_v1";

function buildChatgptOperatorCompactDiagnosticsConsumerForbiddenSources() {
  return [
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.final_response_for_chat",
    "tool_response.result.final_response_handoff_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.result.neural_writing_brain_required_modules_contract.operator_diagnostics",
    "tool_response.result.neural_writing_brain_required_modules_contract.readable_diagnostics",
  ];
}

export function buildChatgptOperatorCompactDiagnosticsConsumerEmission(toolResponse = {}) {
  const compact = toolResponse?.chatgpt_operator_compact_diagnostics ?? null;
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const compactIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics");
  const consumerIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer");
  const resultIndex = topLevelKeys.indexOf("result");
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsConsumerForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (compactIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_missing");
  }

  if (resultIndex >= 0 && compactIndex >= 0 && compactIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_should_precede_result");
  }

  if (resultIndex >= 0 && consumerIndex >= 0 && consumerIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_consumer_should_precede_result");
  }

  if (compact?.used !== true) {
    validationErrors.push("compact_diagnostics_used_false_or_missing");
  }

  if (compact?.phase !== "36C") {
    validationErrors.push("compact_diagnostics_phase_not_36c");
  }

  if (compact?.surface_kind !== chatgptOperatorCompactDiagnosticsSurfaceKind) {
    validationErrors.push("compact_diagnostics_surface_kind_mismatch");
  }

  if (compact?.compact_surface_valid !== true) {
    validationErrors.push("compact_surface_valid_not_true");
  }

  if (compact?.contract_valid !== true) {
    validationErrors.push("compact_contract_valid_not_true");
  }

  if (typeof compact?.compact_diagnostics_text !== "string") {
    validationErrors.push("compact_diagnostics_text_missing_or_not_string");
  }

  if (typeof compact?.compact_diagnostics_hash !== "string" || compact.compact_diagnostics_hash.length === 0) {
    validationErrors.push("compact_diagnostics_hash_missing");
  } else if (
    typeof compact?.compact_diagnostics_text === "string"
    && compact.compact_diagnostics_hash !== sha256(compact.compact_diagnostics_text)
  ) {
    validationErrors.push("compact_diagnostics_hash_mismatch");
  }

  if (compact?.compact_surface_is_reference_only !== true) {
    validationErrors.push("compact_surface_reference_only_not_true");
  }

  if (compact?.compact_surface_must_not_replace_final_output !== true) {
    validationErrors.push("compact_surface_replace_guard_not_true");
  }

  if (compact?.compact_surface_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("compact_surface_story_emit_guard_not_true");
  }

  if (compact?.final_output_must_still_use_root_chatgpt_final_output !== true) {
    validationErrors.push("compact_surface_root_final_output_guard_not_true");
  }

  if (rootOutput?.used !== true) {
    validationErrors.push("root_chatgpt_final_output_used_false_or_missing");
  }

  if (rootOutput?.contract_valid !== true) {
    validationErrors.push("root_chatgpt_final_output_contract_invalid");
  }

  if (typeof rootOutput?.output_hash !== "string" || rootOutput.output_hash.length === 0) {
    validationErrors.push("root_chatgpt_final_output_hash_missing");
  }

  if (typeof rootOutput?.output_text !== "string") {
    validationErrors.push("root_chatgpt_final_output_text_missing_or_not_string");
  } else if (typeof rootOutput?.output_hash === "string" && rootOutput.output_hash !== sha256(rootOutput.output_text)) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  const blocked = compact?.blocked === true;
  const compactText = typeof compact?.compact_diagnostics_text === "string"
    ? compact.compact_diagnostics_text
    : "";
  const outputText = validationErrors.length > 0
    ? [
      "ChatGPT operator compact diagnostics consumer contract invalid.",
      "blocked_stage: operator_compact_diagnostics_consumer",
      "operator_action: inspect_top_level_chatgpt_operator_compact_diagnostics",
    ].join("\n")
    : compactText;

  const contractValid = validationErrors.length === 0;

  return {
    used: true,
    phase: "36D",
    surface_kind: chatgptOperatorCompactDiagnosticsConsumerSurfaceKind,
    version: chatgptOperatorCompactDiagnosticsConsumerVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_consumer_blocked"
        : "operator_compact_diagnostics_consumer_clear"
      : "operator_compact_diagnostics_consumer_invalid",
    response_kind: contractValid
      ? blocked
        ? "operator_compact_diagnostics_blocked_renderer"
        : "operator_compact_diagnostics_clear_renderer"
      : "operator_compact_diagnostics_consumer_invalid_notice",

    blocked: contractValid ? blocked : true,
    blocked_reason: contractValid ? compact.blocked_reason ?? null : "operator_compact_diagnostics_consumer_invalid",
    can_emit_operator_message: true,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? compact?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "operator_compact_diagnostics_is_reference_only",

    required_consumer_field:
      "tool_response.chatgpt_operator_compact_diagnostics.compact_diagnostics_text",
    required_summary_field:
      "tool_response.chatgpt_operator_compact_diagnostics.summary_for_chat",
    required_next_steps_field:
      "tool_response.chatgpt_operator_compact_diagnostics.operator_next_steps",
    root_final_output_field:
      "tool_response.chatgpt_final_output.output_text",

    operator_display_text: outputText,
    operator_display_hash: sha256(outputText),
    operator_display_source: contractValid
      ? "chatgpt_operator_compact_diagnostics.compact_diagnostics_text"
      : "chatgpt_operator_compact_diagnostics_consumer.invalid_notice",
    output_text: outputText,
    output_hash: sha256(outputText),
    output_source: contractValid
      ? "chatgpt_operator_compact_diagnostics.compact_diagnostics_text"
      : "chatgpt_operator_compact_diagnostics_consumer.invalid_notice",

    summary_for_chat: contractValid ? compact.summary_for_chat ?? "" : "",
    summary_for_operator: contractValid ? compact.summary_for_operator ?? "" : "",
    missing_modules: contractValid ? compactStringArray(compact.missing_modules, 12) : [],
    blocked_checks: contractValid ? compactStringArray(compact.blocked_checks, 32) : [],
    operator_next_steps: contractValid ? compactStringArray(compact.operator_next_steps, 12) : [],
    first_operator_action: contractValid ? compact.first_operator_action ?? null : null,

    compact_source_phase: compact?.phase ?? null,
    compact_source_status: compact?.status ?? null,
    compact_source_hash: compact?.compact_diagnostics_hash ?? null,
    root_output_hash: rootOutput?.output_hash ?? null,
    root_output_source: rootOutput?.output_source ?? null,
    root_response_kind: rootOutput?.response_kind ?? null,

    consumer_must_read_top_level_compact_diagnostics: true,
    consumer_must_not_read_result: true,
    consumer_must_not_read_nested_candidate_text: true,
    consumer_must_not_read_nested_brain_contract: true,
    consumer_must_not_recompose_from_result: true,
    consumer_must_not_replace_root_final_output: true,
    consumer_must_not_emit_compact_surface_as_story_text: true,
    root_final_output_still_required: true,
    root_final_output_must_remain_canonical: true,
    compact_consumer_is_reference_only: true,
    compact_consumer_must_not_replace_final_output: true,
    compact_consumer_must_not_be_emitted_as_story_text: true,

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
    safety: buildChatgptFinalOutputSafety(rootOutput?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsFinalClosureIndexKind =
  "chatgpt_bridge_operator_compact_diagnostics_final_closure_index";
const chatgptOperatorCompactDiagnosticsFinalClosureIndexVersion =
  "chatgpt_bridge_operator_compact_diagnostics_final_closure_index_v1";

function buildChatgptOperatorCompactDiagnosticsFinalClosureEntries() {
  return [
    {
      phase: "36A",
      name: "neural writing brain required modules contract",
      test_path: "tests/phase36/phase36a-neural-writing-brain-required-modules-contract.test.mjs",
      role: "required_brain_modules_hard_contract",
      required: true,
    },
    {
      phase: "36B",
      name: "required brain modules readable diagnostics",
      test_path: "tests/phase36/phase36b-neural-writing-brain-required-modules-readable-diagnostics.test.mjs",
      role: "operator_readable_blocked_reason_surface",
      required: true,
    },
    {
      phase: "36C",
      name: "ChatGPT bridge operator compact diagnostics surface",
      test_path: "tests/phase36/phase36c-chatgpt-bridge-operator-compact-diagnostics-surface.test.mjs",
      role: "top_level_compact_operator_surface",
      required: true,
    },
    {
      phase: "36D",
      name: "ChatGPT bridge operator compact diagnostics consumer renderer contract",
      test_path: "tests/phase36/phase36d-chatgpt-bridge-operator-compact-diagnostics-consumer-renderer-contract.test.mjs",
      role: "top_level_consumer_renderer_contract",
      required: true,
    },
    {
      phase: "36E",
      name: "ChatGPT bridge operator compact diagnostics final closure index",
      test_path: "tests/phase36/phase36e-chatgpt-bridge-operator-compact-diagnostics-final-closure-index.test.mjs",
      role: "final_closure_index",
      required: true,
    },
  ];
}

function buildChatgptOperatorCompactDiagnosticsFinalClosureForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsConsumerForbiddenSources(),
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsFinalClosureIndex(tool_response).output_text",
  ];
}

export function buildChatgptOperatorCompactDiagnosticsFinalClosureIndex(toolResponse = {}) {
  const compact = toolResponse?.chatgpt_operator_compact_diagnostics ?? null;
  const consumer = toolResponse?.chatgpt_operator_compact_diagnostics_consumer ?? null;
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const compactIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics");
  const consumerIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer");
  const closureIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index");
  const resultIndex = topLevelKeys.indexOf("result");
  const closureEntries = buildChatgptOperatorCompactDiagnosticsFinalClosureEntries();
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsFinalClosureForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (compactIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_missing");
  }

  if (consumerIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_consumer_missing");
  }

  if (resultIndex >= 0 && compactIndex >= 0 && compactIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_should_precede_result");
  }

  if (resultIndex >= 0 && consumerIndex >= 0 && consumerIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_consumer_should_precede_result");
  }

  if (resultIndex >= 0 && closureIndex >= 0 && closureIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_final_closure_should_precede_result");
  }

  if (compactIndex >= 0 && consumerIndex >= 0 && compactIndex > consumerIndex) {
    validationErrors.push("compact_diagnostics_should_precede_consumer");
  }

  if (consumerIndex >= 0 && closureIndex >= 0 && consumerIndex > closureIndex) {
    validationErrors.push("consumer_should_precede_final_closure_index");
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
  } else if (
    typeof rootOutput?.output_text === "string"
    && rootOutput.output_hash !== sha256(rootOutput.output_text)
  ) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (compact?.used !== true) {
    validationErrors.push("compact_diagnostics_used_false_or_missing");
  }

  if (compact?.phase !== "36C") {
    validationErrors.push("compact_diagnostics_phase_not_36c");
  }

  if (compact?.contract_valid !== true) {
    validationErrors.push("compact_diagnostics_contract_invalid");
  }

  if (compact?.compact_surface_valid !== true) {
    validationErrors.push("compact_surface_valid_not_true");
  }

  if (compact?.compact_surface_is_reference_only !== true) {
    validationErrors.push("compact_surface_reference_only_not_true");
  }

  if (compact?.compact_surface_must_not_replace_final_output !== true) {
    validationErrors.push("compact_surface_replace_guard_not_true");
  }

  if (compact?.compact_surface_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("compact_surface_story_emit_guard_not_true");
  }

  if (compact?.final_output_must_still_use_root_chatgpt_final_output !== true) {
    validationErrors.push("compact_surface_root_final_output_guard_not_true");
  }

  if (typeof compact?.compact_diagnostics_text !== "string") {
    validationErrors.push("compact_diagnostics_text_missing_or_not_string");
  }

  if (typeof compact?.compact_diagnostics_hash !== "string" || compact.compact_diagnostics_hash.length === 0) {
    validationErrors.push("compact_diagnostics_hash_missing");
  } else if (
    typeof compact?.compact_diagnostics_text === "string"
    && compact.compact_diagnostics_hash !== sha256(compact.compact_diagnostics_text)
  ) {
    validationErrors.push("compact_diagnostics_hash_mismatch");
  }

  if (consumer?.used !== true) {
    validationErrors.push("compact_consumer_used_false_or_missing");
  }

  if (consumer?.phase !== "36D") {
    validationErrors.push("compact_consumer_phase_not_36d");
  }

  if (consumer?.contract_valid !== true) {
    validationErrors.push("compact_consumer_contract_invalid");
  }

  if (consumer?.consumer_must_read_top_level_compact_diagnostics !== true) {
    validationErrors.push("compact_consumer_top_level_read_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_result !== true) {
    validationErrors.push("compact_consumer_result_read_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_nested_candidate_text !== true) {
    validationErrors.push("compact_consumer_nested_candidate_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_nested_brain_contract !== true) {
    validationErrors.push("compact_consumer_nested_brain_contract_guard_not_true");
  }

  if (consumer?.consumer_must_not_recompose_from_result !== true) {
    validationErrors.push("compact_consumer_recompose_guard_not_true");
  }

  if (consumer?.consumer_must_not_replace_root_final_output !== true) {
    validationErrors.push("compact_consumer_root_replace_guard_not_true");
  }

  if (consumer?.consumer_must_not_emit_compact_surface_as_story_text !== true) {
    validationErrors.push("compact_consumer_story_emit_guard_not_true");
  }

  if (consumer?.root_final_output_still_required !== true) {
    validationErrors.push("compact_consumer_root_final_output_required_not_true");
  }

  if (consumer?.root_final_output_must_remain_canonical !== true) {
    validationErrors.push("compact_consumer_root_canonical_guard_not_true");
  }

  if (consumer?.compact_consumer_is_reference_only !== true) {
    validationErrors.push("compact_consumer_reference_only_not_true");
  }

  if (consumer?.compact_consumer_must_not_replace_final_output !== true) {
    validationErrors.push("compact_consumer_replace_guard_not_true");
  }

  if (consumer?.compact_consumer_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("compact_consumer_story_output_guard_not_true");
  }

  if (consumer?.may_read_tool_response_result !== false) {
    validationErrors.push("compact_consumer_may_read_result_not_false");
  }

  if (consumer?.may_update_canon !== false) {
    validationErrors.push("compact_consumer_may_update_canon_not_false");
  }

  if (consumer?.may_update_active_engine !== false) {
    validationErrors.push("compact_consumer_may_update_active_engine_not_false");
  }

  if (
    typeof compact?.compact_diagnostics_text === "string"
    && typeof consumer?.operator_display_text === "string"
    && consumer.operator_display_text !== compact.compact_diagnostics_text
  ) {
    validationErrors.push("consumer_display_text_compact_text_mismatch");
  }

  if (
    typeof consumer?.root_output_hash === "string"
    && typeof rootOutput?.output_hash === "string"
    && consumer.root_output_hash !== rootOutput.output_hash
  ) {
    validationErrors.push("consumer_root_output_hash_mismatch");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? compact.blocked === true || consumer.blocked === true : true;

  return {
    used: true,
    phase: "36E",
    surface_kind: chatgptOperatorCompactDiagnosticsFinalClosureIndexKind,
    version: chatgptOperatorCompactDiagnosticsFinalClosureIndexVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_final_closure_blocked_ready"
        : "operator_compact_diagnostics_final_closure_clear_ready"
      : "operator_compact_diagnostics_final_closure_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_final_closure_index"
      : "operator_compact_diagnostics_final_closure_invalid_index",

    phase_range: "36A-36E",
    phase_dependency_chain_complete: contractValid,
    closure_entries: closureEntries,
    closure_entry_count: closureEntries.length,
    required_phase_order: ["36A", "36B", "36C", "36D", "36E"],
    verified_top_level_surfaces: [
      "chatgpt_final_output",
      "chatgpt_operator_compact_diagnostics",
      "chatgpt_operator_compact_diagnostics_consumer",
      "chatgpt_operator_compact_diagnostics_final_closure_index",
    ],

    blocked,
    blocked_reason: contractValid
      ? compact.blocked_reason ?? consumer.blocked_reason ?? null
      : "operator_compact_diagnostics_final_closure_invalid",
    can_emit_operator_message: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? compact?.must_not_output_candidate_reason ?? consumer?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "final_closure_index_is_reference_only",

    operator_readiness_status: contractValid
      ? blocked
        ? "blocked_reason_readable_from_top_level_compact_diagnostics"
        : "compact_diagnostics_chain_clear"
      : "operator_compact_diagnostics_chain_invalid",
    operator_required_display_field:
      "tool_response.chatgpt_operator_compact_diagnostics_consumer.operator_display_text",
    operator_required_compact_field:
      "tool_response.chatgpt_operator_compact_diagnostics.compact_diagnostics_text",
    root_final_output_field:
      "tool_response.chatgpt_final_output.output_text",

    compact_surface_status: compact?.status ?? null,
    compact_surface_hash: compact?.compact_diagnostics_hash ?? null,
    compact_surface_blocked: compact?.blocked === true,
    compact_surface_may_output_story_text: compact?.may_output_story_text === true,
    consumer_surface_status: consumer?.status ?? null,
    consumer_surface_hash: consumer?.operator_display_hash ?? null,
    consumer_surface_blocked: consumer?.blocked === true,
    consumer_surface_may_output_story_text: consumer?.may_output_story_text === true,
    root_output_hash: rootOutput?.output_hash ?? null,
    root_output_source: rootOutput?.output_source ?? null,
    root_response_kind: rootOutput?.response_kind ?? null,

    final_closure_is_reference_only: true,
    final_closure_adds_output_layer: false,
    final_closure_must_not_replace_final_output: true,
    final_closure_must_not_be_emitted_as_chat_output: true,
    final_closure_must_not_be_emitted_as_story_text: true,
    final_closure_requires_root_final_output: true,
    final_closure_root_final_output_must_remain_canonical: true,
    final_closure_requires_top_level_compact_surface: true,
    final_closure_requires_top_level_consumer_surface: true,
    final_closure_requires_no_result_read: true,
    final_closure_requires_no_nested_candidate_read: true,
    final_closure_requires_no_nested_brain_contract_read: true,
    final_closure_requires_no_recomposition: true,

    must_not_emit_final_closure_index: true,
    must_not_emit_compact_consumer_surface: true,
    must_not_emit_compact_surface_as_story_text: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

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
    safety: buildChatgptFinalOutputSafety(rootOutput?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmokeKind =
  "chatgpt_bridge_operator_compact_diagnostics_live_tool_call_acceptance_smoke";
const chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmokeVersion =
  "chatgpt_bridge_operator_compact_diagnostics_live_tool_call_acceptance_smoke_v1";
const chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceEntrypoint =
  "acceptChatgptOperatorCompactDiagnosticsFromLiveToolCall(tool_response)";
const chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceField =
  "tool_response.chatgpt_operator_compact_diagnostics_consumer.operator_display_text";
const chatgptOperatorCompactDiagnosticsLiveToolCallCanonicalField =
  "tool_response.chatgpt_operator_compact_diagnostics.compact_diagnostics_text";

function buildChatgptOperatorCompactDiagnosticsLiveToolCallForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsFinalClosureForbiddenSources(),
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index",
    "buildChatgptOperatorCompactDiagnosticsFinalClosureIndex(tool_response)",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_required_display_field",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_required_compact_field",
  ];
}

export function buildChatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmoke(toolResponse = {}) {
  const compact = toolResponse?.chatgpt_operator_compact_diagnostics ?? null;
  const consumer = toolResponse?.chatgpt_operator_compact_diagnostics_consumer ?? null;
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const compactIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics");
  const consumerIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer");
  const closureIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index");
  const liveIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke");
  const resultIndex = topLevelKeys.indexOf("result");
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsLiveToolCallForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (compactIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_missing");
  }

  if (consumerIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_consumer_missing");
  }

  if (closureIndex < 0) {
    validationErrors.push("top_level_final_closure_index_missing");
  }

  if (resultIndex >= 0 && compactIndex >= 0 && compactIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_should_precede_result");
  }

  if (resultIndex >= 0 && consumerIndex >= 0 && consumerIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_consumer_should_precede_result");
  }

  if (resultIndex >= 0 && closureIndex >= 0 && closureIndex > resultIndex) {
    validationErrors.push("final_closure_index_should_precede_result");
  }

  if (resultIndex >= 0 && liveIndex >= 0 && liveIndex > resultIndex) {
    validationErrors.push("live_acceptance_smoke_should_precede_result");
  }

  if (compactIndex >= 0 && consumerIndex >= 0 && compactIndex > consumerIndex) {
    validationErrors.push("compact_diagnostics_should_precede_consumer");
  }

  if (consumerIndex >= 0 && closureIndex >= 0 && consumerIndex > closureIndex) {
    validationErrors.push("consumer_should_precede_final_closure_index");
  }

  if (closureIndex >= 0 && liveIndex >= 0 && closureIndex > liveIndex) {
    validationErrors.push("final_closure_index_should_precede_live_acceptance");
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
  } else if (
    typeof rootOutput?.output_text === "string"
    && rootOutput.output_hash !== sha256(rootOutput.output_text)
  ) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (compact?.used !== true) {
    validationErrors.push("compact_diagnostics_used_false_or_missing");
  }

  if (compact?.phase !== "36C") {
    validationErrors.push("compact_diagnostics_phase_not_36c");
  }

  if (compact?.contract_valid !== true) {
    validationErrors.push("compact_diagnostics_contract_invalid");
  }

  if (compact?.compact_surface_valid !== true) {
    validationErrors.push("compact_surface_valid_not_true");
  }

  if (typeof compact?.compact_diagnostics_text !== "string") {
    validationErrors.push("compact_diagnostics_text_missing_or_not_string");
  }

  if (typeof compact?.compact_diagnostics_hash !== "string" || compact.compact_diagnostics_hash.length === 0) {
    validationErrors.push("compact_diagnostics_hash_missing");
  } else if (
    typeof compact?.compact_diagnostics_text === "string"
    && compact.compact_diagnostics_hash !== sha256(compact.compact_diagnostics_text)
  ) {
    validationErrors.push("compact_diagnostics_hash_mismatch");
  }

  if (compact?.compact_surface_must_not_replace_final_output !== true) {
    validationErrors.push("compact_surface_replace_guard_not_true");
  }

  if (compact?.compact_surface_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("compact_surface_story_emit_guard_not_true");
  }

  if (consumer?.used !== true) {
    validationErrors.push("compact_consumer_used_false_or_missing");
  }

  if (consumer?.phase !== "36D") {
    validationErrors.push("compact_consumer_phase_not_36d");
  }

  if (consumer?.contract_valid !== true) {
    validationErrors.push("compact_consumer_contract_invalid");
  }

  if (consumer?.required_consumer_field !== chatgptOperatorCompactDiagnosticsLiveToolCallCanonicalField) {
    validationErrors.push("compact_consumer_required_field_not_compact_diagnostics_text");
  }

  if (typeof consumer?.operator_display_text !== "string") {
    validationErrors.push("consumer_operator_display_text_missing_or_not_string");
  }

  if (typeof consumer?.operator_display_hash !== "string" || consumer.operator_display_hash.length === 0) {
    validationErrors.push("consumer_operator_display_hash_missing");
  } else if (
    typeof consumer?.operator_display_text === "string"
    && consumer.operator_display_hash !== sha256(consumer.operator_display_text)
  ) {
    validationErrors.push("consumer_operator_display_hash_mismatch");
  }

  if (
    typeof consumer?.operator_display_text === "string"
    && typeof compact?.compact_diagnostics_text === "string"
    && consumer.operator_display_text !== compact.compact_diagnostics_text
  ) {
    validationErrors.push("consumer_operator_display_text_compact_text_mismatch");
  }

  if (consumer?.operator_display_source !== "chatgpt_operator_compact_diagnostics.compact_diagnostics_text") {
    validationErrors.push("consumer_operator_display_source_mismatch");
  }

  if (consumer?.consumer_must_read_top_level_compact_diagnostics !== true) {
    validationErrors.push("consumer_top_level_compact_read_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_result !== true) {
    validationErrors.push("consumer_result_read_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_nested_candidate_text !== true) {
    validationErrors.push("consumer_nested_candidate_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_nested_brain_contract !== true) {
    validationErrors.push("consumer_nested_brain_contract_guard_not_true");
  }

  if (consumer?.consumer_must_not_recompose_from_result !== true) {
    validationErrors.push("consumer_recompose_guard_not_true");
  }

  if (consumer?.consumer_must_not_replace_root_final_output !== true) {
    validationErrors.push("consumer_root_replace_guard_not_true");
  }

  if (consumer?.root_final_output_still_required !== true) {
    validationErrors.push("consumer_root_final_output_required_not_true");
  }

  if (consumer?.root_final_output_must_remain_canonical !== true) {
    validationErrors.push("consumer_root_canonical_guard_not_true");
  }

  if (consumer?.compact_consumer_is_reference_only !== true) {
    validationErrors.push("consumer_reference_only_not_true");
  }

  if (consumer?.compact_consumer_must_not_replace_final_output !== true) {
    validationErrors.push("consumer_replace_guard_not_true");
  }

  if (consumer?.compact_consumer_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("consumer_story_emit_guard_not_true");
  }

  if (consumer?.may_read_tool_response_result !== false) {
    validationErrors.push("consumer_may_read_result_not_false");
  }

  if (consumer?.may_rewrite !== false) {
    validationErrors.push("consumer_may_rewrite_not_false");
  }

  if (consumer?.may_summarize !== false) {
    validationErrors.push("consumer_may_summarize_not_false");
  }

  if (consumer?.may_update_canon !== false) {
    validationErrors.push("consumer_may_update_canon_not_false");
  }

  if (consumer?.may_update_active_engine !== false) {
    validationErrors.push("consumer_may_update_active_engine_not_false");
  }

  if (
    typeof consumer?.root_output_hash === "string"
    && typeof rootOutput?.output_hash === "string"
    && consumer.root_output_hash !== rootOutput.output_hash
  ) {
    validationErrors.push("consumer_root_output_hash_mismatch");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? consumer.blocked === true || compact.blocked === true : true;
  const acceptedText = contractValid
    ? consumer.operator_display_text
    : [
      "ChatGPT operator compact diagnostics live tool-call acceptance smoke invalid.",
      "blocked_stage: operator_compact_diagnostics_live_tool_call_acceptance",
      "operator_action: inspect_top_level_operator_compact_diagnostics_consumer",
    ].join("\n");

  return {
    used: true,
    phase: "36F",
    surface_kind: chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmokeKind,
    version: chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmokeVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_live_tool_call_blocked_accepted"
        : "operator_compact_diagnostics_live_tool_call_clear_accepted"
      : "operator_compact_diagnostics_live_tool_call_acceptance_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_live_tool_call_acceptance_reference"
      : "operator_compact_diagnostics_live_tool_call_acceptance_invalid_reference",

    live_tool_call_shape: "mcp_tool_response_wrapper",
    live_acceptance_entrypoint: chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceEntrypoint,
    live_acceptance_required_field: chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceField,
    live_acceptance_canonical_field: chatgptOperatorCompactDiagnosticsLiveToolCallCanonicalField,
    live_acceptance_must_call: chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceEntrypoint,
    live_acceptance_must_accept_exact_return_value: true,

    blocked,
    blocked_reason: contractValid
      ? compact.blocked_reason ?? consumer.blocked_reason ?? null
      : "operator_compact_diagnostics_live_tool_call_acceptance_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? compact?.must_not_output_candidate_reason ?? consumer?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "live_acceptance_smoke_is_reference_only",

    accepted_operator_display_text: acceptedText,
    accepted_operator_display_hash: sha256(acceptedText),
    accepted_operator_display_source: contractValid
      ? chatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceField
      : "operator_compact_diagnostics_live_tool_call_acceptance.invalid_notice",
    accepted_operator_display_matches_consumer: contractValid
      && typeof consumer?.operator_display_text === "string"
      && acceptedText === consumer.operator_display_text,
    accepted_operator_display_matches_compact: contractValid
      && typeof compact?.compact_diagnostics_text === "string"
      && acceptedText === compact.compact_diagnostics_text,
    accepted_operator_display_is_blocked_notice: contractValid && blocked && acceptedText.includes("BLOCKED:"),
    accepted_operator_display_is_clear_notice: contractValid && !blocked && acceptedText.includes("READY:"),

    compact_surface_status: compact?.status ?? null,
    compact_surface_hash: compact?.compact_diagnostics_hash ?? null,
    compact_surface_blocked: compact?.blocked === true,
    consumer_surface_status: consumer?.status ?? null,
    consumer_surface_hash: consumer?.operator_display_hash ?? null,
    consumer_surface_blocked: consumer?.blocked === true,
    final_closure_index_present: closureIndex >= 0,
    final_closure_index_is_reference_only: true,
    final_closure_index_must_not_be_read_for_accepted_text: true,
    root_output_hash: rootOutput?.output_hash ?? null,
    root_output_source: rootOutput?.output_source ?? null,
    root_response_kind: rootOutput?.response_kind ?? null,

    live_acceptance_is_reference_only: true,
    live_acceptance_adds_output_layer: false,
    live_acceptance_must_not_replace_final_output: true,
    live_acceptance_must_not_be_emitted_as_chat_output: true,
    live_acceptance_must_not_be_emitted_as_story_text: true,
    live_acceptance_requires_root_final_output: true,
    live_acceptance_root_final_output_must_remain_canonical: true,
    live_acceptance_requires_top_level_consumer_surface: true,
    live_acceptance_requires_no_result_read: true,
    live_acceptance_requires_no_final_closure_index_read_for_text: true,
    live_acceptance_requires_no_nested_candidate_read: true,
    live_acceptance_requires_no_nested_brain_contract_read: true,
    live_acceptance_requires_no_recomposition: true,

    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_compact_surface_as_story_text: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_final_closure_index_for_accepted_text: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

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
    safety: buildChatgptFinalOutputSafety(rootOutput?.safety),
  };
}

export function acceptChatgptOperatorCompactDiagnosticsFromLiveToolCall(toolResponse = {}) {
  return buildChatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmoke(
    toolResponse,
  ).accepted_operator_display_text;
}


const chatgptOperatorCompactDiagnosticsRuntimeFinalSealKind =
  "chatgpt_bridge_operator_compact_diagnostics_runtime_final_seal";
const chatgptOperatorCompactDiagnosticsRuntimeFinalSealVersion =
  "chatgpt_bridge_operator_compact_diagnostics_runtime_final_seal_v1";
const chatgptOperatorCompactDiagnosticsRuntimeFinalSealEntrypoint =
  "sealChatgptOperatorCompactDiagnosticsRuntimeFinalAcceptance(tool_response)";

function buildChatgptOperatorCompactDiagnosticsRuntimeFinalSealForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsLiveToolCallForbiddenSources(),
    "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsRuntimeFinalSeal(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsRuntimeFinalSeal(tool_response).operator_display_text",
  ];
}

export function buildChatgptOperatorCompactDiagnosticsRuntimeFinalSeal(toolResponse = {}) {
  const compact = toolResponse?.chatgpt_operator_compact_diagnostics ?? null;
  const consumer = toolResponse?.chatgpt_operator_compact_diagnostics_consumer ?? null;
  const closure = toolResponse?.chatgpt_operator_compact_diagnostics_final_closure_index ?? null;
  const live = toolResponse?.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke ?? null;
  const rootOutput = toolResponse?.chatgpt_final_output ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const compactIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics");
  const consumerIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_consumer");
  const closureIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_closure_index");
  const liveIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke");
  const sealIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_runtime_final_seal");
  const resultIndex = topLevelKeys.indexOf("result");
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsRuntimeFinalSealForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (compactIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_missing");
  }

  if (consumerIndex < 0) {
    validationErrors.push("top_level_compact_diagnostics_consumer_missing");
  }

  if (closureIndex < 0) {
    validationErrors.push("top_level_final_closure_index_missing");
  }

  if (liveIndex < 0) {
    validationErrors.push("top_level_live_tool_call_acceptance_missing");
  }

  if (resultIndex >= 0 && compactIndex >= 0 && compactIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_should_precede_result");
  }

  if (resultIndex >= 0 && consumerIndex >= 0 && consumerIndex > resultIndex) {
    validationErrors.push("compact_diagnostics_consumer_should_precede_result");
  }

  if (resultIndex >= 0 && closureIndex >= 0 && closureIndex > resultIndex) {
    validationErrors.push("final_closure_index_should_precede_result");
  }

  if (resultIndex >= 0 && liveIndex >= 0 && liveIndex > resultIndex) {
    validationErrors.push("live_acceptance_smoke_should_precede_result");
  }

  if (resultIndex >= 0 && sealIndex >= 0 && sealIndex > resultIndex) {
    validationErrors.push("runtime_final_seal_should_precede_result");
  }

  if (compactIndex >= 0 && consumerIndex >= 0 && compactIndex > consumerIndex) {
    validationErrors.push("compact_diagnostics_should_precede_consumer");
  }

  if (consumerIndex >= 0 && closureIndex >= 0 && consumerIndex > closureIndex) {
    validationErrors.push("consumer_should_precede_final_closure_index");
  }

  if (closureIndex >= 0 && liveIndex >= 0 && closureIndex > liveIndex) {
    validationErrors.push("final_closure_index_should_precede_live_acceptance");
  }

  if (liveIndex >= 0 && sealIndex >= 0 && liveIndex > sealIndex) {
    validationErrors.push("live_acceptance_should_precede_runtime_final_seal");
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
  } else if (
    typeof rootOutput?.output_text === "string"
    && rootOutput.output_hash !== sha256(rootOutput.output_text)
  ) {
    validationErrors.push("root_chatgpt_final_output_hash_mismatch");
  }

  if (compact?.used !== true) {
    validationErrors.push("compact_diagnostics_used_false_or_missing");
  }

  if (compact?.phase !== "36C") {
    validationErrors.push("compact_diagnostics_phase_not_36c");
  }

  if (compact?.contract_valid !== true) {
    validationErrors.push("compact_diagnostics_contract_invalid");
  }

  if (typeof compact?.compact_diagnostics_text !== "string") {
    validationErrors.push("compact_diagnostics_text_missing_or_not_string");
  }

  if (typeof compact?.compact_diagnostics_hash !== "string" || compact.compact_diagnostics_hash.length === 0) {
    validationErrors.push("compact_diagnostics_hash_missing");
  } else if (
    typeof compact?.compact_diagnostics_text === "string"
    && compact.compact_diagnostics_hash !== sha256(compact.compact_diagnostics_text)
  ) {
    validationErrors.push("compact_diagnostics_hash_mismatch");
  }

  if (compact?.compact_surface_must_not_replace_final_output !== true) {
    validationErrors.push("compact_surface_replace_guard_not_true");
  }

  if (compact?.compact_surface_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("compact_surface_story_emit_guard_not_true");
  }

  if (consumer?.used !== true) {
    validationErrors.push("compact_consumer_used_false_or_missing");
  }

  if (consumer?.phase !== "36D") {
    validationErrors.push("compact_consumer_phase_not_36d");
  }

  if (consumer?.contract_valid !== true) {
    validationErrors.push("compact_consumer_contract_invalid");
  }

  if (typeof consumer?.operator_display_text !== "string") {
    validationErrors.push("consumer_operator_display_text_missing_or_not_string");
  }

  if (typeof consumer?.operator_display_hash !== "string" || consumer.operator_display_hash.length === 0) {
    validationErrors.push("consumer_operator_display_hash_missing");
  } else if (
    typeof consumer?.operator_display_text === "string"
    && consumer.operator_display_hash !== sha256(consumer.operator_display_text)
  ) {
    validationErrors.push("consumer_operator_display_hash_mismatch");
  }

  if (consumer?.operator_display_source !== "chatgpt_operator_compact_diagnostics.compact_diagnostics_text") {
    validationErrors.push("consumer_operator_display_source_mismatch");
  }

  if (consumer?.consumer_must_not_read_result !== true) {
    validationErrors.push("consumer_result_read_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_nested_candidate_text !== true) {
    validationErrors.push("consumer_nested_candidate_guard_not_true");
  }

  if (consumer?.consumer_must_not_read_nested_brain_contract !== true) {
    validationErrors.push("consumer_nested_brain_contract_guard_not_true");
  }

  if (consumer?.consumer_must_not_recompose_from_result !== true) {
    validationErrors.push("consumer_recompose_guard_not_true");
  }

  if (consumer?.consumer_must_not_replace_root_final_output !== true) {
    validationErrors.push("consumer_root_replace_guard_not_true");
  }

  if (consumer?.compact_consumer_is_reference_only !== true) {
    validationErrors.push("consumer_reference_only_not_true");
  }

  if (consumer?.may_read_tool_response_result !== false) {
    validationErrors.push("consumer_may_read_result_not_false");
  }

  if (consumer?.may_update_canon !== false) {
    validationErrors.push("consumer_may_update_canon_not_false");
  }

  if (consumer?.may_update_active_engine !== false) {
    validationErrors.push("consumer_may_update_active_engine_not_false");
  }

  if (closure?.used !== true) {
    validationErrors.push("final_closure_used_false_or_missing");
  }

  if (closure?.phase !== "36E") {
    validationErrors.push("final_closure_phase_not_36e");
  }

  if (closure?.contract_valid !== true) {
    validationErrors.push("final_closure_contract_invalid");
  }

  if (closure?.final_closure_is_reference_only !== true) {
    validationErrors.push("final_closure_reference_only_not_true");
  }

  if (closure?.final_closure_must_not_replace_final_output !== true) {
    validationErrors.push("final_closure_replace_guard_not_true");
  }

  if (closure?.final_closure_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("final_closure_chat_emit_guard_not_true");
  }

  if (closure?.final_closure_requires_no_result_read !== true) {
    validationErrors.push("final_closure_no_result_read_guard_not_true");
  }

  if (closure?.final_closure_requires_no_nested_candidate_read !== true) {
    validationErrors.push("final_closure_no_nested_candidate_guard_not_true");
  }

  if (closure?.final_closure_requires_no_nested_brain_contract_read !== true) {
    validationErrors.push("final_closure_no_nested_brain_contract_guard_not_true");
  }

  if (live?.used !== true) {
    validationErrors.push("live_acceptance_used_false_or_missing");
  }

  if (live?.phase !== "36F") {
    validationErrors.push("live_acceptance_phase_not_36f");
  }

  if (live?.contract_valid !== true) {
    validationErrors.push("live_acceptance_contract_invalid");
  }

  if (typeof live?.accepted_operator_display_text !== "string") {
    validationErrors.push("live_accepted_operator_display_text_missing_or_not_string");
  }

  if (typeof live?.accepted_operator_display_hash !== "string" || live.accepted_operator_display_hash.length === 0) {
    validationErrors.push("live_accepted_operator_display_hash_missing");
  } else if (
    typeof live?.accepted_operator_display_text === "string"
    && live.accepted_operator_display_hash !== sha256(live.accepted_operator_display_text)
  ) {
    validationErrors.push("live_accepted_operator_display_hash_mismatch");
  }

  if (live?.accepted_operator_display_source !== "tool_response.chatgpt_operator_compact_diagnostics_consumer.operator_display_text") {
    validationErrors.push("live_accepted_operator_display_source_mismatch");
  }

  if (live?.accepted_operator_display_matches_consumer !== true) {
    validationErrors.push("live_accepted_operator_display_consumer_match_not_true");
  }

  if (live?.accepted_operator_display_matches_compact !== true) {
    validationErrors.push("live_accepted_operator_display_compact_match_not_true");
  }

  if (live?.live_acceptance_is_reference_only !== true) {
    validationErrors.push("live_acceptance_reference_only_not_true");
  }

  if (live?.live_acceptance_adds_output_layer !== false) {
    validationErrors.push("live_acceptance_adds_output_layer_not_false");
  }

  if (live?.live_acceptance_must_not_replace_final_output !== true) {
    validationErrors.push("live_acceptance_replace_guard_not_true");
  }

  if (live?.live_acceptance_must_not_be_emitted_as_chat_output !== true) {
    validationErrors.push("live_acceptance_chat_emit_guard_not_true");
  }

  if (live?.live_acceptance_must_not_be_emitted_as_story_text !== true) {
    validationErrors.push("live_acceptance_story_emit_guard_not_true");
  }

  if (live?.live_acceptance_requires_no_result_read !== true) {
    validationErrors.push("live_acceptance_no_result_read_guard_not_true");
  }

  if (live?.live_acceptance_requires_no_final_closure_index_read_for_text !== true) {
    validationErrors.push("live_acceptance_no_final_closure_text_read_guard_not_true");
  }

  if (live?.live_acceptance_requires_no_nested_candidate_read !== true) {
    validationErrors.push("live_acceptance_no_nested_candidate_guard_not_true");
  }

  if (live?.live_acceptance_requires_no_nested_brain_contract_read !== true) {
    validationErrors.push("live_acceptance_no_nested_brain_contract_guard_not_true");
  }

  if (live?.live_acceptance_requires_no_recomposition !== true) {
    validationErrors.push("live_acceptance_no_recomposition_guard_not_true");
  }

  if (live?.must_not_read_result !== true) {
    validationErrors.push("live_acceptance_must_not_read_result_guard_not_true");
  }

  if (live?.must_not_read_final_closure_index_for_accepted_text !== true) {
    validationErrors.push("live_acceptance_must_not_read_final_closure_guard_not_true");
  }

  if (live?.must_not_read_nested_result_candidate_text !== true) {
    validationErrors.push("live_acceptance_must_not_read_nested_candidate_guard_not_true");
  }

  if (live?.must_not_read_nested_brain_contract !== true) {
    validationErrors.push("live_acceptance_must_not_read_nested_brain_guard_not_true");
  }

  if (live?.must_not_recompose_response !== true) {
    validationErrors.push("live_acceptance_must_not_recompose_guard_not_true");
  }

  if (live?.may_read_tool_response_result !== false) {
    validationErrors.push("live_acceptance_may_read_result_not_false");
  }

  if (live?.may_update_canon !== false) {
    validationErrors.push("live_acceptance_may_update_canon_not_false");
  }

  if (live?.may_update_active_engine !== false) {
    validationErrors.push("live_acceptance_may_update_active_engine_not_false");
  }

  if (
    typeof compact?.compact_diagnostics_text === "string"
    && typeof consumer?.operator_display_text === "string"
    && compact.compact_diagnostics_text !== consumer.operator_display_text
  ) {
    validationErrors.push("compact_text_consumer_display_mismatch");
  }

  if (
    typeof consumer?.operator_display_text === "string"
    && typeof live?.accepted_operator_display_text === "string"
    && consumer.operator_display_text !== live.accepted_operator_display_text
  ) {
    validationErrors.push("consumer_display_live_accepted_mismatch");
  }

  const runtimeAcceptedText = acceptChatgptOperatorCompactDiagnosticsFromLiveToolCall(toolResponse);

  if (
    typeof live?.accepted_operator_display_text === "string"
    && runtimeAcceptedText !== live.accepted_operator_display_text
  ) {
    validationErrors.push("runtime_acceptance_entrypoint_live_text_mismatch");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? live.blocked === true || consumer.blocked === true || compact.blocked === true : true;
  const sealedText = contractValid
    ? runtimeAcceptedText
    : [
      "ChatGPT operator compact diagnostics runtime final seal invalid.",
      "blocked_stage: operator_compact_diagnostics_runtime_final_seal",
      "operator_action: inspect_phase36c_to_phase36f_operator_diagnostics_chain",
    ].join("\n");

  return {
    used: true,
    phase: "36G",
    surface_kind: chatgptOperatorCompactDiagnosticsRuntimeFinalSealKind,
    version: chatgptOperatorCompactDiagnosticsRuntimeFinalSealVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_runtime_final_seal_blocked"
        : "operator_compact_diagnostics_runtime_final_seal_clear"
      : "operator_compact_diagnostics_runtime_final_seal_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_runtime_final_seal_reference"
      : "operator_compact_diagnostics_runtime_final_seal_invalid_reference",

    runtime_final_seal_entrypoint: chatgptOperatorCompactDiagnosticsRuntimeFinalSealEntrypoint,
    runtime_final_seal_dependency_chain: ["36A", "36B", "36C", "36D", "36E", "36F", "36G"],
    runtime_final_seal_dependency_chain_complete: contractValid,
    runtime_final_seal_required_accepted_text_source:
      "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    runtime_final_seal_required_live_entrypoint:
      "acceptChatgptOperatorCompactDiagnosticsFromLiveToolCall(tool_response)",
    runtime_final_seal_required_consumer_field:
      "tool_response.chatgpt_operator_compact_diagnostics_consumer.operator_display_text",
    runtime_final_seal_required_compact_field:
      "tool_response.chatgpt_operator_compact_diagnostics.compact_diagnostics_text",
    runtime_final_seal_forbidden_text_sources: forbiddenSources,

    blocked,
    blocked_reason: contractValid
      ? compact.blocked_reason ?? consumer.blocked_reason ?? live.blocked_reason ?? null
      : "operator_compact_diagnostics_runtime_final_seal_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? compact?.must_not_output_candidate_reason ?? consumer?.must_not_output_candidate_reason ?? live?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "runtime_final_seal_is_reference_only",

    sealed_operator_display_text: sealedText,
    sealed_operator_display_hash: sha256(sealedText),
    sealed_operator_display_source: contractValid
      ? "acceptChatgptOperatorCompactDiagnosticsFromLiveToolCall(tool_response)"
      : "operator_compact_diagnostics_runtime_final_seal.invalid_notice",
    sealed_operator_display_matches_live_acceptance: contractValid
      && typeof live?.accepted_operator_display_text === "string"
      && sealedText === live.accepted_operator_display_text,
    sealed_operator_display_matches_consumer: contractValid
      && typeof consumer?.operator_display_text === "string"
      && sealedText === consumer.operator_display_text,
    sealed_operator_display_matches_compact: contractValid
      && typeof compact?.compact_diagnostics_text === "string"
      && sealedText === compact.compact_diagnostics_text,
    sealed_operator_display_is_blocked_notice: contractValid && blocked && sealedText.includes("BLOCKED:"),
    sealed_operator_display_is_clear_notice: contractValid && !blocked && sealedText.includes("READY:"),

    compact_surface_status: compact?.status ?? null,
    compact_surface_hash: compact?.compact_diagnostics_hash ?? null,
    consumer_surface_status: consumer?.status ?? null,
    consumer_surface_hash: consumer?.operator_display_hash ?? null,
    final_closure_surface_status: closure?.status ?? null,
    live_acceptance_status: live?.status ?? null,
    live_acceptance_hash: live?.accepted_operator_display_hash ?? null,
    root_output_hash: rootOutput?.output_hash ?? null,
    root_output_source: rootOutput?.output_source ?? null,
    root_response_kind: rootOutput?.response_kind ?? null,

    runtime_final_seal_is_reference_only: true,
    runtime_final_seal_adds_output_layer: false,
    runtime_final_seal_must_not_replace_final_output: true,
    runtime_final_seal_must_not_be_emitted_as_chat_output: true,
    runtime_final_seal_must_not_be_emitted_as_story_text: true,
    runtime_final_seal_requires_root_final_output: true,
    runtime_final_seal_root_final_output_must_remain_canonical: true,
    runtime_final_seal_requires_live_acceptance_surface: true,
    runtime_final_seal_requires_no_result_read: true,
    runtime_final_seal_requires_no_final_closure_index_read_for_text: true,
    runtime_final_seal_requires_no_nested_candidate_read: true,
    runtime_final_seal_requires_no_nested_brain_contract_read: true,
    runtime_final_seal_requires_no_recomposition: true,

    must_not_emit_runtime_final_seal: true,
    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_compact_surface_as_story_text: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_final_closure_index_for_accepted_text: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

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
    safety: buildChatgptFinalOutputSafety(rootOutput?.safety),
  };
}

export function sealChatgptOperatorCompactDiagnosticsRuntimeFinalAcceptance(toolResponse = {}) {
  return buildChatgptOperatorCompactDiagnosticsRuntimeFinalSeal(
    toolResponse,
  ).sealed_operator_display_text;
}


const chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistKind =
  "chatgpt_bridge_operator_compact_diagnostics_operator_handoff_final_checklist";
const chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistVersion =
  "chatgpt_bridge_operator_compact_diagnostics_operator_handoff_final_checklist_v1";
const chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text";

function buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistForbiddenSources() {
  return [
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsFinalClosureIndex(tool_response)",
    "buildChatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmoke(tool_response)",
    "buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklist(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklist(tool_response).operator_display_text",
  ];
}

export function buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklist(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const sealIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_runtime_final_seal");
  const resultIndex = topLevelKeys.indexOf("result");
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (sealIndex < 0) {
    validationErrors.push("top_level_runtime_final_seal_missing");
  }

  if (resultIndex >= 0 && sealIndex >= 0 && sealIndex > resultIndex) {
    validationErrors.push("runtime_final_seal_should_precede_result");
  }

  if (runtimeSeal?.used !== true) {
    validationErrors.push("runtime_final_seal_used_false_or_missing");
  }

  if (runtimeSeal?.phase !== "36G") {
    validationErrors.push("runtime_final_seal_phase_not_36g");
  }

  if (runtimeSeal?.contract_valid !== true) {
    validationErrors.push("runtime_final_seal_contract_invalid");
  }

  if (typeof runtimeSeal?.sealed_operator_display_text !== "string") {
    validationErrors.push("sealed_operator_display_text_missing_or_not_string");
  }

  if (typeof runtimeSeal?.sealed_operator_display_hash !== "string" || runtimeSeal.sealed_operator_display_hash.length === 0) {
    validationErrors.push("sealed_operator_display_hash_missing");
  } else if (
    typeof runtimeSeal?.sealed_operator_display_text === "string"
    && runtimeSeal.sealed_operator_display_hash !== sha256(runtimeSeal.sealed_operator_display_text)
  ) {
    validationErrors.push("sealed_operator_display_hash_mismatch");
  }

  if (runtimeSeal?.runtime_final_seal_is_reference_only !== true) {
    validationErrors.push("runtime_final_seal_reference_only_not_true");
  }

  if (runtimeSeal?.runtime_final_seal_adds_output_layer !== false) {
    validationErrors.push("runtime_final_seal_adds_output_layer_not_false");
  }

  if (runtimeSeal?.runtime_final_seal_must_not_replace_final_output !== true) {
    validationErrors.push("runtime_final_seal_replace_guard_not_true");
  }

  if (runtimeSeal?.runtime_final_seal_requires_no_result_read !== true) {
    validationErrors.push("runtime_final_seal_no_result_read_guard_not_true");
  }

  if (runtimeSeal?.runtime_final_seal_requires_no_final_closure_index_read_for_text !== true) {
    validationErrors.push("runtime_final_seal_no_final_closure_text_read_guard_not_true");
  }

  if (runtimeSeal?.runtime_final_seal_requires_no_nested_candidate_read !== true) {
    validationErrors.push("runtime_final_seal_no_nested_candidate_read_guard_not_true");
  }

  if (runtimeSeal?.runtime_final_seal_requires_no_nested_brain_contract_read !== true) {
    validationErrors.push("runtime_final_seal_no_nested_brain_contract_guard_not_true");
  }

  if (runtimeSeal?.runtime_final_seal_requires_no_recomposition !== true) {
    validationErrors.push("runtime_final_seal_no_recomposition_guard_not_true");
  }

  if (runtimeSeal?.can_output_to_chat !== false) {
    validationErrors.push("runtime_final_seal_can_output_to_chat_not_false");
  }

  if (runtimeSeal?.may_output_story_text !== false) {
    validationErrors.push("runtime_final_seal_may_output_story_text_not_false");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? runtimeSeal.blocked === true : true;

  return {
    used: true,
    phase: "36H",
    surface_kind: chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistKind,
    version: chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_operator_handoff_final_checklist_blocked"
        : "operator_compact_diagnostics_operator_handoff_final_checklist_clear"
      : "operator_compact_diagnostics_operator_handoff_final_checklist_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_operator_handoff_final_checklist_reference"
      : "operator_compact_diagnostics_operator_handoff_final_checklist_invalid_reference",

    handoff_checklist_dependency_chain: ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H"],
    handoff_checklist_dependency_chain_complete: contractValid,
    handoff_checklist_required_read_field:
      chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistRequiredField,
    handoff_checklist_must_read_exact_field: true,
    handoff_checklist_must_not_read_result: true,
    handoff_checklist_must_not_read_final_closure_index_for_text: true,
    handoff_checklist_must_not_use_live_acceptance_as_final_output: true,
    handoff_checklist_must_not_emit_self: true,
    handoff_checklist_must_not_replace_root_chatgpt_final_output: true,
    handoff_checklist_root_chatgpt_final_output_remains_canonical: true,

    blocked,
    blocked_reason: contractValid
      ? runtimeSeal.blocked_reason ?? null
      : "operator_compact_diagnostics_operator_handoff_final_checklist_invalid",
    can_emit_operator_message: false,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? runtimeSeal?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "operator_handoff_final_checklist_is_reference_only",

    sealed_operator_display_source_field:
      chatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistRequiredField,
    sealed_operator_display_hash_reference: contractValid
      ? runtimeSeal.sealed_operator_display_hash
      : null,
    sealed_operator_display_source_reference: contractValid
      ? runtimeSeal.sealed_operator_display_source
      : null,
    sealed_operator_display_is_blocked_notice: contractValid
      && runtimeSeal.sealed_operator_display_is_blocked_notice === true,
    sealed_operator_display_is_clear_notice: contractValid
      && runtimeSeal.sealed_operator_display_is_clear_notice === true,

    operator_next_step:
      "Read tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text only.",
    operator_must_not_read: forbiddenSources,
    forbidden_sources: forbiddenSources,

    operator_handoff_final_checklist_is_reference_only: true,
    operator_handoff_final_checklist_adds_output_layer: false,
    operator_handoff_final_checklist_must_not_replace_final_output: true,
    operator_handoff_final_checklist_must_not_be_emitted_as_chat_output: true,
    operator_handoff_final_checklist_must_not_be_emitted_as_story_text: true,
    operator_handoff_final_checklist_requires_runtime_final_seal: true,
    operator_handoff_final_checklist_requires_no_result_read: true,
    operator_handoff_final_checklist_requires_no_final_closure_index_read_for_text: true,
    operator_handoff_final_checklist_requires_no_live_acceptance_as_final_output: true,
    operator_handoff_final_checklist_requires_no_recomposition: true,

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
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeKind =
  "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke";
const chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeVersion =
  "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke_v1";
const chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text";

function buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklistForbiddenSources(),
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmoke(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmoke(tool_response).operator_display_text",
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromRealChatgptWritingEntry(toolResponse = {}) {
  return toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal?.sealed_operator_display_text;
}

export function buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmoke(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const handoffChecklist =
    toolResponse?.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const sealIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_runtime_final_seal");
  const handoffIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist");
  const entryIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke");
  const resultIndex = topLevelKeys.indexOf("result");
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeForbiddenSources();
  const acceptedText = acceptChatgptOperatorCompactDiagnosticsFromRealChatgptWritingEntry(toolResponse);
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (sealIndex < 0) {
    validationErrors.push("top_level_runtime_final_seal_missing");
  }

  if (handoffIndex < 0) {
    validationErrors.push("top_level_operator_handoff_final_checklist_missing");
  }

  if (resultIndex >= 0 && sealIndex >= 0 && sealIndex > resultIndex) {
    validationErrors.push("runtime_final_seal_should_precede_result");
  }

  if (resultIndex >= 0 && handoffIndex >= 0 && handoffIndex > resultIndex) {
    validationErrors.push("operator_handoff_final_checklist_should_precede_result");
  }

  if (sealIndex >= 0 && handoffIndex >= 0 && sealIndex > handoffIndex) {
    validationErrors.push("runtime_final_seal_should_precede_handoff_final_checklist");
  }

  if (handoffIndex >= 0 && entryIndex >= 0 && handoffIndex > entryIndex) {
    validationErrors.push("handoff_final_checklist_should_precede_real_chatgpt_entry_smoke");
  }

  if (resultIndex >= 0 && entryIndex >= 0 && entryIndex > resultIndex) {
    validationErrors.push("real_chatgpt_entry_smoke_should_precede_result");
  }

  if (runtimeSeal?.used !== true) {
    validationErrors.push("runtime_final_seal_used_false_or_missing");
  }

  if (runtimeSeal?.phase !== "36G") {
    validationErrors.push("runtime_final_seal_phase_not_36g");
  }

  if (runtimeSeal?.contract_valid !== true) {
    validationErrors.push("runtime_final_seal_contract_invalid");
  }

  if (typeof runtimeSeal?.sealed_operator_display_text !== "string") {
    validationErrors.push("runtime_final_seal_text_missing_or_not_string");
  }

  if (typeof runtimeSeal?.sealed_operator_display_hash !== "string" || runtimeSeal.sealed_operator_display_hash.length === 0) {
    validationErrors.push("runtime_final_seal_hash_missing");
  } else if (
    typeof runtimeSeal?.sealed_operator_display_text === "string"
    && runtimeSeal.sealed_operator_display_hash !== sha256(runtimeSeal.sealed_operator_display_text)
  ) {
    validationErrors.push("runtime_final_seal_hash_mismatch");
  }

  if (handoffChecklist?.used !== true) {
    validationErrors.push("operator_handoff_final_checklist_used_false_or_missing");
  }

  if (handoffChecklist?.phase !== "36H") {
    validationErrors.push("operator_handoff_final_checklist_phase_not_36h");
  }

  if (handoffChecklist?.contract_valid !== true) {
    validationErrors.push("operator_handoff_final_checklist_contract_invalid");
  }

  if (
    handoffChecklist?.handoff_checklist_required_read_field
    !== chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeRequiredField
  ) {
    validationErrors.push("operator_handoff_final_checklist_required_field_mismatch");
  }

  if (handoffChecklist?.handoff_checklist_must_read_exact_field !== true) {
    validationErrors.push("operator_handoff_final_checklist_exact_field_guard_not_true");
  }

  if (handoffChecklist?.operator_handoff_final_checklist_is_reference_only !== true) {
    validationErrors.push("operator_handoff_final_checklist_reference_only_not_true");
  }

  if (handoffChecklist?.operator_handoff_final_checklist_adds_output_layer !== false) {
    validationErrors.push("operator_handoff_final_checklist_adds_output_layer_not_false");
  }

  if (handoffChecklist?.operator_handoff_final_checklist_requires_no_result_read !== true) {
    validationErrors.push("operator_handoff_final_checklist_no_result_read_guard_not_true");
  }

  if (handoffChecklist?.operator_handoff_final_checklist_requires_no_final_closure_index_read_for_text !== true) {
    validationErrors.push("operator_handoff_final_checklist_no_final_closure_read_guard_not_true");
  }

  if (handoffChecklist?.operator_handoff_final_checklist_requires_no_live_acceptance_as_final_output !== true) {
    validationErrors.push("operator_handoff_final_checklist_no_live_acceptance_output_guard_not_true");
  }

  if (handoffChecklist?.operator_handoff_final_checklist_requires_no_recomposition !== true) {
    validationErrors.push("operator_handoff_final_checklist_no_recomposition_guard_not_true");
  }

  if (typeof acceptedText !== "string") {
    validationErrors.push("accepted_operator_message_text_missing_or_not_string");
  }

  if (
    typeof acceptedText === "string"
    && typeof runtimeSeal?.sealed_operator_display_text === "string"
    && acceptedText !== runtimeSeal.sealed_operator_display_text
  ) {
    validationErrors.push("accepted_operator_message_text_runtime_seal_mismatch");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid
    ? runtimeSeal.blocked === true || handoffChecklist.blocked === true
    : true;
  const acceptedOperatorMessageText = contractValid
    ? acceptedText
    : [
      "ChatGPT operator compact diagnostics real ChatGPT writing entry smoke invalid.",
      "blocked_stage: operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
      "operator_action: inspect_phase36h_operator_handoff_final_checklist",
    ].join("\n");

  return {
    used: true,
    phase: "36I",
    surface_kind: chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeKind,
    version: chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_real_chatgpt_writing_entry_blocked"
        : "operator_compact_diagnostics_real_chatgpt_writing_entry_clear"
      : "operator_compact_diagnostics_real_chatgpt_writing_entry_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_real_chatgpt_writing_entry_reference"
      : "operator_compact_diagnostics_real_chatgpt_writing_entry_invalid_reference",

    real_chatgpt_entry_dependency_chain: ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I"],
    real_chatgpt_entry_dependency_chain_complete: contractValid,
    real_chatgpt_entry_required_read_field:
      chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeRequiredField,
    real_chatgpt_entry_must_read_exact_field: true,
    real_chatgpt_entry_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromRealChatgptWritingEntry(tool_response)",
    real_chatgpt_entry_accepted_source:
      chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeRequiredField,

    blocked,
    blocked_reason: contractValid
      ? runtimeSeal.blocked_reason ?? handoffChecklist.blocked_reason ?? null
      : "operator_compact_diagnostics_real_chatgpt_writing_entry_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? runtimeSeal?.must_not_output_candidate_reason
        ?? handoffChecklist?.must_not_output_candidate_reason
        ?? "required_brain_modules_contract_invalid"
      : "real_chatgpt_writing_entry_smoke_is_reference_only",

    accepted_operator_message_text: acceptedOperatorMessageText,
    accepted_operator_message_hash: sha256(acceptedOperatorMessageText),
    accepted_operator_message_source: contractValid
      ? chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeRequiredField
      : "operator_compact_diagnostics_real_chatgpt_writing_entry.invalid_notice",
    accepted_operator_message_matches_runtime_final_seal: contractValid
      && typeof runtimeSeal?.sealed_operator_display_text === "string"
      && acceptedOperatorMessageText === runtimeSeal.sealed_operator_display_text,
    accepted_operator_message_matches_handoff_required_field: contractValid
      && handoffChecklist.handoff_checklist_required_read_field
        === chatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeRequiredField,
    accepted_operator_message_is_blocked_notice: contractValid && blocked && acceptedOperatorMessageText.includes("BLOCKED:"),
    accepted_operator_message_is_clear_notice: contractValid && !blocked && acceptedOperatorMessageText.includes("READY:"),

    runtime_final_seal_status: runtimeSeal?.status ?? null,
    runtime_final_seal_hash: runtimeSeal?.sealed_operator_display_hash ?? null,
    operator_handoff_final_checklist_status: handoffChecklist?.status ?? null,
    operator_handoff_final_checklist_required_read_field:
      handoffChecklist?.handoff_checklist_required_read_field ?? null,

    real_chatgpt_entry_is_reference_only: true,
    real_chatgpt_entry_adds_output_layer: false,
    real_chatgpt_entry_must_not_replace_final_output: true,
    real_chatgpt_entry_must_not_be_emitted_as_chat_output: true,
    real_chatgpt_entry_must_not_be_emitted_as_story_text: true,
    real_chatgpt_entry_requires_runtime_final_seal: true,
    real_chatgpt_entry_requires_operator_handoff_final_checklist: true,
    real_chatgpt_entry_requires_no_result_read: true,
    real_chatgpt_entry_requires_no_final_closure_index_read_for_text: true,
    real_chatgpt_entry_requires_no_live_acceptance_as_final_output: true,
    real_chatgpt_entry_requires_no_handoff_surface_as_output: true,
    real_chatgpt_entry_requires_no_recomposition: true,

    must_not_emit_real_chatgpt_entry_smoke: true,
    must_not_emit_operator_handoff_final_checklist: true,
    must_not_emit_runtime_final_seal: true,
    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_final_closure_index_for_accepted_text: true,
    must_not_read_live_acceptance_as_final_output: true,
    must_not_read_handoff_output_fields: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

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
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealKind =
  "chatgpt_bridge_operator_compact_diagnostics_final_operator_emission_hard_seal";
const chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealVersion =
  "chatgpt_bridge_operator_compact_diagnostics_final_operator_emission_hard_seal_v1";
const chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text";

function buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmokeForbiddenSources(),
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal(tool_response).operator_display_text",
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromFinalOperatorEmissionHardSeal(toolResponse = {}) {
  return toolResponse?.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal?.sealed_final_operator_emission_text;
}

export function buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const handoffChecklist =
    toolResponse?.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist ?? null;
  const realEntry =
    toolResponse?.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const sealIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_runtime_final_seal");
  const handoffIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist");
  const realEntryIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke");
  const hardSealIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal");
  const resultIndex = topLevelKeys.indexOf("result");
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  if (sealIndex < 0) {
    validationErrors.push("top_level_runtime_final_seal_missing");
  }

  if (handoffIndex < 0) {
    validationErrors.push("top_level_operator_handoff_final_checklist_missing");
  }

  if (realEntryIndex < 0) {
    validationErrors.push("top_level_real_chatgpt_writing_entry_smoke_missing");
  }

  if (resultIndex >= 0 && sealIndex >= 0 && sealIndex > resultIndex) {
    validationErrors.push("runtime_final_seal_should_precede_result");
  }

  if (resultIndex >= 0 && handoffIndex >= 0 && handoffIndex > resultIndex) {
    validationErrors.push("operator_handoff_final_checklist_should_precede_result");
  }

  if (resultIndex >= 0 && realEntryIndex >= 0 && realEntryIndex > resultIndex) {
    validationErrors.push("real_chatgpt_entry_smoke_should_precede_result");
  }

  if (resultIndex >= 0 && hardSealIndex >= 0 && hardSealIndex > resultIndex) {
    validationErrors.push("final_operator_emission_hard_seal_should_precede_result");
  }

  if (sealIndex >= 0 && handoffIndex >= 0 && sealIndex > handoffIndex) {
    validationErrors.push("runtime_final_seal_should_precede_handoff_final_checklist");
  }

  if (handoffIndex >= 0 && realEntryIndex >= 0 && handoffIndex > realEntryIndex) {
    validationErrors.push("handoff_final_checklist_should_precede_real_chatgpt_entry_smoke");
  }

  if (realEntryIndex >= 0 && hardSealIndex >= 0 && realEntryIndex > hardSealIndex) {
    validationErrors.push("real_chatgpt_entry_smoke_should_precede_final_operator_emission_hard_seal");
  }

  if (runtimeSeal?.used !== true) {
    validationErrors.push("runtime_final_seal_used_false_or_missing");
  }

  if (runtimeSeal?.phase !== "36G") {
    validationErrors.push("runtime_final_seal_phase_not_36g");
  }

  if (runtimeSeal?.contract_valid !== true) {
    validationErrors.push("runtime_final_seal_contract_invalid");
  }

  if (typeof runtimeSeal?.sealed_operator_display_text !== "string") {
    validationErrors.push("runtime_final_seal_text_missing_or_not_string");
  }

  if (typeof runtimeSeal?.sealed_operator_display_hash !== "string" || runtimeSeal.sealed_operator_display_hash.length === 0) {
    validationErrors.push("runtime_final_seal_hash_missing");
  } else if (
    typeof runtimeSeal?.sealed_operator_display_text === "string"
    && runtimeSeal.sealed_operator_display_hash !== sha256(runtimeSeal.sealed_operator_display_text)
  ) {
    validationErrors.push("runtime_final_seal_hash_mismatch");
  }

  if (handoffChecklist?.used !== true) {
    validationErrors.push("operator_handoff_final_checklist_used_false_or_missing");
  }

  if (handoffChecklist?.phase !== "36H") {
    validationErrors.push("operator_handoff_final_checklist_phase_not_36h");
  }

  if (handoffChecklist?.contract_valid !== true) {
    validationErrors.push("operator_handoff_final_checklist_contract_invalid");
  }

  if (realEntry?.used !== true) {
    validationErrors.push("real_chatgpt_entry_smoke_used_false_or_missing");
  }

  if (realEntry?.phase !== "36I") {
    validationErrors.push("real_chatgpt_entry_smoke_phase_not_36i");
  }

  if (realEntry?.contract_valid !== true) {
    validationErrors.push("real_chatgpt_entry_smoke_contract_invalid");
  }

  if (
    realEntry?.real_chatgpt_entry_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text"
  ) {
    validationErrors.push("real_chatgpt_entry_required_field_mismatch");
  }

  if (realEntry?.real_chatgpt_entry_must_read_exact_field !== true) {
    validationErrors.push("real_chatgpt_entry_exact_field_guard_not_true");
  }

  if (realEntry?.real_chatgpt_entry_is_reference_only !== true) {
    validationErrors.push("real_chatgpt_entry_reference_only_not_true");
  }

  if (realEntry?.real_chatgpt_entry_adds_output_layer !== false) {
    validationErrors.push("real_chatgpt_entry_adds_output_layer_not_false");
  }

  if (realEntry?.real_chatgpt_entry_requires_no_result_read !== true) {
    validationErrors.push("real_chatgpt_entry_no_result_read_guard_not_true");
  }

  if (realEntry?.real_chatgpt_entry_requires_no_final_closure_index_read_for_text !== true) {
    validationErrors.push("real_chatgpt_entry_no_final_closure_text_guard_not_true");
  }

  if (realEntry?.real_chatgpt_entry_requires_no_live_acceptance_as_final_output !== true) {
    validationErrors.push("real_chatgpt_entry_no_live_acceptance_output_guard_not_true");
  }

  if (realEntry?.real_chatgpt_entry_requires_no_handoff_surface_as_output !== true) {
    validationErrors.push("real_chatgpt_entry_no_handoff_surface_output_guard_not_true");
  }

  if (realEntry?.real_chatgpt_entry_requires_no_recomposition !== true) {
    validationErrors.push("real_chatgpt_entry_no_recomposition_guard_not_true");
  }

  if (typeof realEntry?.accepted_operator_message_text !== "string") {
    validationErrors.push("accepted_operator_message_text_missing_or_not_string");
  }

  if (typeof realEntry?.accepted_operator_message_hash !== "string" || realEntry.accepted_operator_message_hash.length === 0) {
    validationErrors.push("accepted_operator_message_hash_missing");
  } else if (
    typeof realEntry?.accepted_operator_message_text === "string"
    && realEntry.accepted_operator_message_hash !== sha256(realEntry.accepted_operator_message_text)
  ) {
    validationErrors.push("accepted_operator_message_hash_mismatch");
  }

  if (
    typeof realEntry?.accepted_operator_message_text === "string"
    && typeof runtimeSeal?.sealed_operator_display_text === "string"
    && realEntry.accepted_operator_message_text !== runtimeSeal.sealed_operator_display_text
  ) {
    validationErrors.push("accepted_operator_message_text_runtime_final_seal_mismatch");
  }

  if (
    typeof realEntry?.accepted_operator_message_hash === "string"
    && typeof runtimeSeal?.sealed_operator_display_hash === "string"
    && realEntry.accepted_operator_message_hash !== runtimeSeal.sealed_operator_display_hash
  ) {
    validationErrors.push("accepted_operator_message_hash_runtime_final_seal_mismatch");
  }

  if (realEntry?.accepted_operator_message_source !== "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text") {
    validationErrors.push("accepted_operator_message_source_not_runtime_final_seal");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid
    ? runtimeSeal.blocked === true || handoffChecklist.blocked === true || realEntry.blocked === true
    : true;
  const sealedFinalOperatorEmissionText = contractValid
    ? realEntry.accepted_operator_message_text
    : [
      "ChatGPT final operator emission hard seal invalid.",
      "blocked_stage: operator_compact_diagnostics_final_operator_emission_hard_seal",
      "operator_action: inspect_phase36i_real_chatgpt_writing_entry_smoke",
    ].join("\n");

  return {
    used: true,
    phase: "36J",
    surface_kind: chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealKind,
    version: chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_final_operator_emission_hard_seal_blocked"
        : "operator_compact_diagnostics_final_operator_emission_hard_seal_clear"
      : "operator_compact_diagnostics_final_operator_emission_hard_seal_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_final_operator_emission_hard_seal_reference"
      : "operator_compact_diagnostics_final_operator_emission_hard_seal_invalid_reference",

    final_operator_emission_dependency_chain: ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J"],
    final_operator_emission_dependency_chain_complete: contractValid,
    final_operator_emission_required_read_field:
      chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealRequiredField,
    final_operator_emission_must_read_exact_field: true,
    final_operator_emission_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromFinalOperatorEmissionHardSeal(tool_response)",
    final_operator_emission_accepted_source:
      chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealRequiredField,

    blocked,
    blocked_reason: contractValid
      ? runtimeSeal.blocked_reason ?? handoffChecklist.blocked_reason ?? realEntry.blocked_reason ?? null
      : "operator_compact_diagnostics_final_operator_emission_hard_seal_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? runtimeSeal?.must_not_output_candidate_reason
        ?? handoffChecklist?.must_not_output_candidate_reason
        ?? realEntry?.must_not_output_candidate_reason
        ?? "required_brain_modules_contract_invalid"
      : "final_operator_emission_hard_seal_is_reference_only",

    sealed_final_operator_emission_text: sealedFinalOperatorEmissionText,
    sealed_final_operator_emission_hash: sha256(sealedFinalOperatorEmissionText),
    sealed_final_operator_emission_source: contractValid
      ? chatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealRequiredField
      : "operator_compact_diagnostics_final_operator_emission_hard_seal.invalid_notice",
    sealed_final_operator_emission_matches_real_chatgpt_entry: contractValid
      && typeof realEntry?.accepted_operator_message_text === "string"
      && sealedFinalOperatorEmissionText === realEntry.accepted_operator_message_text,
    sealed_final_operator_emission_matches_runtime_final_seal: contractValid
      && typeof runtimeSeal?.sealed_operator_display_text === "string"
      && sealedFinalOperatorEmissionText === runtimeSeal.sealed_operator_display_text,
    sealed_final_operator_emission_matches_handoff_required_field: contractValid
      && handoffChecklist.handoff_checklist_required_read_field
        === "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text",
    sealed_final_operator_emission_is_blocked_notice: contractValid && blocked && sealedFinalOperatorEmissionText.includes("BLOCKED:"),
    sealed_final_operator_emission_is_clear_notice: contractValid && !blocked && sealedFinalOperatorEmissionText.includes("READY:"),

    runtime_final_seal_status: runtimeSeal?.status ?? null,
    runtime_final_seal_hash: runtimeSeal?.sealed_operator_display_hash ?? null,
    operator_handoff_final_checklist_status: handoffChecklist?.status ?? null,
    real_chatgpt_entry_status: realEntry?.status ?? null,
    real_chatgpt_entry_hash: realEntry?.accepted_operator_message_hash ?? null,

    final_operator_emission_hard_seal_is_reference_only: true,
    final_operator_emission_hard_seal_adds_output_layer: false,
    final_operator_emission_hard_seal_must_not_replace_final_output: true,
    final_operator_emission_hard_seal_must_not_be_emitted_as_story_text: true,
    final_operator_emission_hard_seal_must_not_be_used_as_candidate_text: true,
    final_operator_emission_hard_seal_requires_runtime_final_seal: true,
    final_operator_emission_hard_seal_requires_operator_handoff_final_checklist: true,
    final_operator_emission_hard_seal_requires_real_chatgpt_entry_smoke: true,
    final_operator_emission_hard_seal_requires_no_result_read: true,
    final_operator_emission_hard_seal_requires_no_chatgpt_final_output_text_read: true,
    final_operator_emission_hard_seal_requires_no_final_closure_index_read_for_text: true,
    final_operator_emission_hard_seal_requires_no_live_acceptance_as_final_output: true,
    final_operator_emission_hard_seal_requires_no_handoff_surface_as_output: true,
    final_operator_emission_hard_seal_requires_no_recomposition: true,
    final_operator_emission_hard_seal_requires_no_fallback: true,

    must_not_emit_final_operator_emission_hard_seal_as_story_text: true,
    must_not_emit_real_chatgpt_entry_smoke: true,
    must_not_emit_operator_handoff_final_checklist: true,
    must_not_emit_runtime_final_seal: true,
    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_chatgpt_final_output_text_for_operator_emission: true,
    must_not_read_final_closure_index_for_operator_emission: true,
    must_not_read_live_acceptance_as_final_output: true,
    must_not_read_handoff_output_fields: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_read_chatgpt_final_output_text: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsPublicContractFreezeKind =
  "chatgpt_bridge_operator_compact_diagnostics_public_contract_freeze";
const chatgptOperatorCompactDiagnosticsPublicContractFreezeVersion =
  "chatgpt_bridge_operator_compact_diagnostics_public_contract_freeze_v1";
const chatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text";

function buildChatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredTopLevelKeys() {
  return [
    "chatgpt_final_output",
    "chatgpt_operator_compact_diagnostics",
    "chatgpt_operator_compact_diagnostics_consumer",
    "chatgpt_operator_compact_diagnostics_final_closure_index",
    "chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "chatgpt_operator_compact_diagnostics_runtime_final_seal",
    "chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
    "chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal",
  ];
}

function buildChatgptOperatorCompactDiagnosticsPublicContractFreezeForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSealForbiddenSources(),
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsPublicContractFreeze(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsPublicContractFreeze(tool_response).operator_display_text",
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromPublicContractFreeze(toolResponse = {}) {
  return toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_freeze?.public_contract_sealed_operator_message_text;
}

export function buildChatgptOperatorCompactDiagnosticsPublicContractFreeze(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const handoffChecklist =
    toolResponse?.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist ?? null;
  const realEntry =
    toolResponse?.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke ?? null;
  const hardSeal =
    toolResponse?.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const resultIndex = topLevelKeys.indexOf("result");
  const freezeIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_freeze");
  const requiredTopLevelKeys = buildChatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredTopLevelKeys();
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsPublicContractFreezeForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  for (const key of requiredTopLevelKeys) {
    if (!topLevelKeys.includes(key)) {
      validationErrors.push(`top_level_key_missing:${key}`);
    }
  }

  for (let index = 1; index < requiredTopLevelKeys.length; index += 1) {
    const previousKey = requiredTopLevelKeys[index - 1];
    const currentKey = requiredTopLevelKeys[index];
    const previousIndex = topLevelKeys.indexOf(previousKey);
    const currentIndex = topLevelKeys.indexOf(currentKey);
    if (previousIndex >= 0 && currentIndex >= 0 && previousIndex > currentIndex) {
      validationErrors.push(`top_level_key_order_invalid:${previousKey}>${currentKey}`);
    }
  }

  for (const key of requiredTopLevelKeys) {
    const keyIndex = topLevelKeys.indexOf(key);
    if (resultIndex >= 0 && keyIndex >= 0 && keyIndex > resultIndex) {
      validationErrors.push(`top_level_key_should_precede_result:${key}`);
    }
  }

  const hardSealKeyIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal");
  if (freezeIndex >= 0 && hardSealKeyIndex >= 0 && hardSealKeyIndex > freezeIndex) {
    validationErrors.push("final_operator_emission_hard_seal_should_precede_public_contract_freeze");
  }

  if (resultIndex >= 0 && freezeIndex >= 0 && freezeIndex > resultIndex) {
    validationErrors.push("public_contract_freeze_should_precede_result");
  }

  if (runtimeSeal?.used !== true) {
    validationErrors.push("runtime_final_seal_used_false_or_missing");
  }

  if (runtimeSeal?.phase !== "36G") {
    validationErrors.push("runtime_final_seal_phase_not_36g");
  }

  if (runtimeSeal?.contract_valid !== true) {
    validationErrors.push("runtime_final_seal_contract_invalid");
  }

  if (handoffChecklist?.used !== true) {
    validationErrors.push("operator_handoff_final_checklist_used_false_or_missing");
  }

  if (handoffChecklist?.phase !== "36H") {
    validationErrors.push("operator_handoff_final_checklist_phase_not_36h");
  }

  if (handoffChecklist?.contract_valid !== true) {
    validationErrors.push("operator_handoff_final_checklist_contract_invalid");
  }

  if (realEntry?.used !== true) {
    validationErrors.push("real_chatgpt_entry_smoke_used_false_or_missing");
  }

  if (realEntry?.phase !== "36I") {
    validationErrors.push("real_chatgpt_entry_smoke_phase_not_36i");
  }

  if (realEntry?.contract_valid !== true) {
    validationErrors.push("real_chatgpt_entry_smoke_contract_invalid");
  }

  if (hardSeal?.used !== true) {
    validationErrors.push("final_operator_emission_hard_seal_used_false_or_missing");
  }

  if (hardSeal?.phase !== "36J") {
    validationErrors.push("final_operator_emission_hard_seal_phase_not_36j");
  }

  if (hardSeal?.contract_valid !== true) {
    validationErrors.push("final_operator_emission_hard_seal_contract_invalid");
  }

  if (
    handoffChecklist?.handoff_checklist_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text"
  ) {
    validationErrors.push("operator_handoff_final_checklist_required_field_mismatch");
  }

  if (
    realEntry?.real_chatgpt_entry_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text"
  ) {
    validationErrors.push("real_chatgpt_entry_required_field_mismatch");
  }

  if (
    hardSeal?.final_operator_emission_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text"
  ) {
    validationErrors.push("final_operator_emission_required_field_mismatch");
  }

  if (hardSeal?.final_operator_emission_must_read_exact_field !== true) {
    validationErrors.push("final_operator_emission_exact_field_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_is_reference_only !== true) {
    validationErrors.push("final_operator_emission_hard_seal_reference_only_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_adds_output_layer !== false) {
    validationErrors.push("final_operator_emission_hard_seal_adds_output_layer_not_false");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_result_read !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_result_read_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_chatgpt_final_output_text_read !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_chatgpt_final_output_text_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_final_closure_index_read_for_text !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_final_closure_text_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_live_acceptance_as_final_output !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_live_acceptance_output_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_handoff_surface_as_output !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_handoff_surface_output_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_recomposition !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_recomposition_guard_not_true");
  }

  if (hardSeal?.final_operator_emission_hard_seal_requires_no_fallback !== true) {
    validationErrors.push("final_operator_emission_hard_seal_no_fallback_guard_not_true");
  }

  if (typeof hardSeal?.sealed_final_operator_emission_text !== "string") {
    validationErrors.push("sealed_final_operator_emission_text_missing_or_not_string");
  }

  if (typeof hardSeal?.sealed_final_operator_emission_hash !== "string" || hardSeal.sealed_final_operator_emission_hash.length === 0) {
    validationErrors.push("sealed_final_operator_emission_hash_missing");
  } else if (
    typeof hardSeal?.sealed_final_operator_emission_text === "string"
    && hardSeal.sealed_final_operator_emission_hash !== sha256(hardSeal.sealed_final_operator_emission_text)
  ) {
    validationErrors.push("sealed_final_operator_emission_hash_mismatch");
  }

  if (
    typeof hardSeal?.sealed_final_operator_emission_text === "string"
    && typeof realEntry?.accepted_operator_message_text === "string"
    && hardSeal.sealed_final_operator_emission_text !== realEntry.accepted_operator_message_text
  ) {
    validationErrors.push("sealed_final_operator_emission_text_real_entry_mismatch");
  }

  if (
    typeof hardSeal?.sealed_final_operator_emission_text === "string"
    && typeof runtimeSeal?.sealed_operator_display_text === "string"
    && hardSeal.sealed_final_operator_emission_text !== runtimeSeal.sealed_operator_display_text
  ) {
    validationErrors.push("sealed_final_operator_emission_text_runtime_final_seal_mismatch");
  }

  if (
    typeof hardSeal?.sealed_final_operator_emission_hash === "string"
    && typeof runtimeSeal?.sealed_operator_display_hash === "string"
    && hardSeal.sealed_final_operator_emission_hash !== runtimeSeal.sealed_operator_display_hash
  ) {
    validationErrors.push("sealed_final_operator_emission_hash_runtime_final_seal_mismatch");
  }

  if (hardSeal?.sealed_final_operator_emission_source !== "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text") {
    validationErrors.push("sealed_final_operator_emission_source_not_real_chatgpt_entry");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid
    ? runtimeSeal.blocked === true
      || handoffChecklist.blocked === true
      || realEntry.blocked === true
      || hardSeal.blocked === true
    : true;
  const publicContractSealedOperatorMessageText = contractValid
    ? hardSeal.sealed_final_operator_emission_text
    : [
      "ChatGPT bridge final response public contract freeze invalid.",
      "blocked_stage: operator_compact_diagnostics_public_contract_freeze",
      "operator_action: inspect_phase36j_final_operator_emission_hard_seal",
    ].join("\n");

  return {
    used: true,
    phase: "36K",
    surface_kind: chatgptOperatorCompactDiagnosticsPublicContractFreezeKind,
    version: chatgptOperatorCompactDiagnosticsPublicContractFreezeVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_public_contract_freeze_blocked"
        : "operator_compact_diagnostics_public_contract_freeze_clear"
      : "operator_compact_diagnostics_public_contract_freeze_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_public_contract_freeze_reference"
      : "operator_compact_diagnostics_public_contract_freeze_invalid_reference",

    public_contract_dependency_chain: ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K"],
    public_contract_dependency_chain_complete: contractValid,
    public_contract_top_level_required_keys: requiredTopLevelKeys,
    public_contract_top_level_order_valid: contractValid,
    public_contract_required_read_field:
      chatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredField,
    public_contract_must_read_exact_field: true,
    public_contract_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromPublicContractFreeze(tool_response)",
    public_contract_accepted_source:
      chatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredField,

    blocked,
    blocked_reason: contractValid
      ? runtimeSeal.blocked_reason
        ?? handoffChecklist.blocked_reason
        ?? realEntry.blocked_reason
        ?? hardSeal.blocked_reason
        ?? null
      : "operator_compact_diagnostics_public_contract_freeze_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? runtimeSeal?.must_not_output_candidate_reason
        ?? handoffChecklist?.must_not_output_candidate_reason
        ?? realEntry?.must_not_output_candidate_reason
        ?? hardSeal?.must_not_output_candidate_reason
        ?? "required_brain_modules_contract_invalid"
      : "public_contract_freeze_is_reference_only",

    public_contract_sealed_operator_message_text: publicContractSealedOperatorMessageText,
    public_contract_sealed_operator_message_hash: sha256(publicContractSealedOperatorMessageText),
    public_contract_sealed_operator_message_source: contractValid
      ? chatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredField
      : "operator_compact_diagnostics_public_contract_freeze.invalid_notice",
    public_contract_sealed_operator_message_matches_final_operator_emission_hard_seal: contractValid
      && typeof hardSeal?.sealed_final_operator_emission_text === "string"
      && publicContractSealedOperatorMessageText === hardSeal.sealed_final_operator_emission_text,
    public_contract_sealed_operator_message_matches_runtime_final_seal: contractValid
      && typeof runtimeSeal?.sealed_operator_display_text === "string"
      && publicContractSealedOperatorMessageText === runtimeSeal.sealed_operator_display_text,
    public_contract_sealed_operator_message_matches_real_chatgpt_entry: contractValid
      && typeof realEntry?.accepted_operator_message_text === "string"
      && publicContractSealedOperatorMessageText === realEntry.accepted_operator_message_text,
    public_contract_sealed_operator_message_is_blocked_notice: contractValid && blocked && publicContractSealedOperatorMessageText.includes("BLOCKED:"),
    public_contract_sealed_operator_message_is_clear_notice: contractValid && !blocked && publicContractSealedOperatorMessageText.includes("READY:"),

    runtime_final_seal_status: runtimeSeal?.status ?? null,
    runtime_final_seal_hash: runtimeSeal?.sealed_operator_display_hash ?? null,
    operator_handoff_final_checklist_status: handoffChecklist?.status ?? null,
    real_chatgpt_entry_status: realEntry?.status ?? null,
    final_operator_emission_hard_seal_status: hardSeal?.status ?? null,
    final_operator_emission_hard_seal_hash: hardSeal?.sealed_final_operator_emission_hash ?? null,

    public_contract_freeze_is_reference_only: true,
    public_contract_freeze_adds_output_layer: false,
    public_contract_freeze_must_not_replace_final_output: true,
    public_contract_freeze_must_not_be_emitted_as_story_text: true,
    public_contract_freeze_must_not_be_used_as_candidate_text: true,
    public_contract_freeze_requires_runtime_final_seal: true,
    public_contract_freeze_requires_operator_handoff_final_checklist: true,
    public_contract_freeze_requires_real_chatgpt_entry_smoke: true,
    public_contract_freeze_requires_final_operator_emission_hard_seal: true,
    public_contract_freeze_requires_no_result_read: true,
    public_contract_freeze_requires_no_chatgpt_final_output_text_read: true,
    public_contract_freeze_requires_no_final_closure_index_read_for_text: true,
    public_contract_freeze_requires_no_live_acceptance_as_final_output: true,
    public_contract_freeze_requires_no_handoff_surface_as_output: true,
    public_contract_freeze_requires_no_real_entry_surface_as_output: true,
    public_contract_freeze_requires_no_hard_seal_surface_as_story_text: true,
    public_contract_freeze_requires_no_recomposition: true,
    public_contract_freeze_requires_no_fallback: true,

    must_not_emit_public_contract_freeze_as_story_text: true,
    must_not_emit_final_operator_emission_hard_seal_as_story_text: true,
    must_not_emit_real_chatgpt_entry_smoke: true,
    must_not_emit_operator_handoff_final_checklist: true,
    must_not_emit_runtime_final_seal: true,
    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_chatgpt_final_output_text_for_public_contract: true,
    must_not_read_final_closure_index_for_public_contract: true,
    must_not_read_live_acceptance_as_final_output: true,
    must_not_read_handoff_output_fields: true,
    must_not_read_real_entry_output_fields: true,
    must_not_read_hard_seal_output_fields: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_read_chatgpt_final_output_text: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}


const chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeKind =
  "chatgpt_bridge_operator_compact_diagnostics_public_contract_final_live_extraction_smoke";
const chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeVersion =
  "chatgpt_bridge_operator_compact_diagnostics_public_contract_final_live_extraction_smoke_v1";
const chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.public_contract_sealed_operator_message_text";

function buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsPublicContractFreezeForbiddenSources(),
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke(tool_response).operator_display_text",
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromPublicContractFinalLiveExtractionSmoke(toolResponse = {}) {
  return toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke?.live_extracted_operator_message_text;
}

export function buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const handoffChecklist =
    toolResponse?.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist ?? null;
  const realEntry =
    toolResponse?.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke ?? null;
  const hardSeal =
    toolResponse?.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal ?? null;
  const publicFreeze =
    toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_freeze ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const resultIndex = topLevelKeys.indexOf("result");
  const freezeIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_freeze");
  const liveIndex = topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke");
  const requiredTopLevelKeys = [
    ...buildChatgptOperatorCompactDiagnosticsPublicContractFreezeRequiredTopLevelKeys(),
    "chatgpt_operator_compact_diagnostics_public_contract_freeze",
  ];
  const forbiddenSources = buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionForbiddenSources();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  for (const key of requiredTopLevelKeys) {
    if (!topLevelKeys.includes(key)) {
      validationErrors.push("top_level_key_missing:" + key);
    }
  }

  for (let index = 1; index < requiredTopLevelKeys.length; index += 1) {
    const previousKey = requiredTopLevelKeys[index - 1];
    const currentKey = requiredTopLevelKeys[index];
    const previousIndex = topLevelKeys.indexOf(previousKey);
    const currentIndex = topLevelKeys.indexOf(currentKey);
    if (previousIndex >= 0 && currentIndex >= 0 && previousIndex > currentIndex) {
      validationErrors.push("top_level_key_order_invalid:" + previousKey + ">" + currentKey);
    }
  }

  for (const key of requiredTopLevelKeys) {
    const keyIndex = topLevelKeys.indexOf(key);
    if (resultIndex >= 0 && keyIndex >= 0 && keyIndex > resultIndex) {
      validationErrors.push("top_level_key_should_precede_result:" + key);
    }
  }

  if (freezeIndex < 0) {
    validationErrors.push("top_level_public_contract_freeze_missing");
  }

  if (freezeIndex >= 0 && liveIndex >= 0 && freezeIndex > liveIndex) {
    validationErrors.push("public_contract_freeze_should_precede_final_live_extraction_smoke");
  }

  if (resultIndex >= 0 && liveIndex >= 0 && liveIndex > resultIndex) {
    validationErrors.push("final_live_extraction_smoke_should_precede_result");
  }

  if (runtimeSeal?.used !== true) {
    validationErrors.push("runtime_final_seal_used_false_or_missing");
  }

  if (runtimeSeal?.phase !== "36G") {
    validationErrors.push("runtime_final_seal_phase_not_36g");
  }

  if (runtimeSeal?.contract_valid !== true) {
    validationErrors.push("runtime_final_seal_contract_invalid");
  }

  if (handoffChecklist?.used !== true) {
    validationErrors.push("operator_handoff_final_checklist_used_false_or_missing");
  }

  if (handoffChecklist?.phase !== "36H") {
    validationErrors.push("operator_handoff_final_checklist_phase_not_36h");
  }

  if (handoffChecklist?.contract_valid !== true) {
    validationErrors.push("operator_handoff_final_checklist_contract_invalid");
  }

  if (realEntry?.used !== true) {
    validationErrors.push("real_chatgpt_entry_smoke_used_false_or_missing");
  }

  if (realEntry?.phase !== "36I") {
    validationErrors.push("real_chatgpt_entry_smoke_phase_not_36i");
  }

  if (realEntry?.contract_valid !== true) {
    validationErrors.push("real_chatgpt_entry_smoke_contract_invalid");
  }

  if (hardSeal?.used !== true) {
    validationErrors.push("final_operator_emission_hard_seal_used_false_or_missing");
  }

  if (hardSeal?.phase !== "36J") {
    validationErrors.push("final_operator_emission_hard_seal_phase_not_36j");
  }

  if (hardSeal?.contract_valid !== true) {
    validationErrors.push("final_operator_emission_hard_seal_contract_invalid");
  }

  if (publicFreeze?.used !== true) {
    validationErrors.push("public_contract_freeze_used_false_or_missing");
  }

  if (publicFreeze?.phase !== "36K") {
    validationErrors.push("public_contract_freeze_phase_not_36k");
  }

  if (publicFreeze?.contract_valid !== true) {
    validationErrors.push("public_contract_freeze_contract_invalid");
  }

  if (
    publicFreeze?.public_contract_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text"
  ) {
    validationErrors.push("public_contract_freeze_required_field_mismatch");
  }

  if (publicFreeze?.public_contract_must_read_exact_field !== true) {
    validationErrors.push("public_contract_freeze_exact_field_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_is_reference_only !== true) {
    validationErrors.push("public_contract_freeze_reference_only_not_true");
  }

  if (publicFreeze?.public_contract_freeze_adds_output_layer !== false) {
    validationErrors.push("public_contract_freeze_adds_output_layer_not_false");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_result_read !== true) {
    validationErrors.push("public_contract_freeze_no_result_read_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_chatgpt_final_output_text_read !== true) {
    validationErrors.push("public_contract_freeze_no_chatgpt_final_output_text_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_final_closure_index_read_for_text !== true) {
    validationErrors.push("public_contract_freeze_no_final_closure_text_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_live_acceptance_as_final_output !== true) {
    validationErrors.push("public_contract_freeze_no_live_acceptance_output_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_handoff_surface_as_output !== true) {
    validationErrors.push("public_contract_freeze_no_handoff_surface_output_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_real_entry_surface_as_output !== true) {
    validationErrors.push("public_contract_freeze_no_real_entry_surface_output_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_hard_seal_surface_as_story_text !== true) {
    validationErrors.push("public_contract_freeze_no_hard_seal_story_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_recomposition !== true) {
    validationErrors.push("public_contract_freeze_no_recomposition_guard_not_true");
  }

  if (publicFreeze?.public_contract_freeze_requires_no_fallback !== true) {
    validationErrors.push("public_contract_freeze_no_fallback_guard_not_true");
  }

  if (typeof publicFreeze?.public_contract_sealed_operator_message_text !== "string") {
    validationErrors.push("public_contract_sealed_operator_message_text_missing_or_not_string");
  }

  if (typeof publicFreeze?.public_contract_sealed_operator_message_hash !== "string" || publicFreeze.public_contract_sealed_operator_message_hash.length === 0) {
    validationErrors.push("public_contract_sealed_operator_message_hash_missing");
  } else if (
    typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
    && publicFreeze.public_contract_sealed_operator_message_hash !== sha256(publicFreeze.public_contract_sealed_operator_message_text)
  ) {
    validationErrors.push("public_contract_sealed_operator_message_hash_mismatch");
  }

  if (
    typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
    && typeof hardSeal?.sealed_final_operator_emission_text === "string"
    && publicFreeze.public_contract_sealed_operator_message_text !== hardSeal.sealed_final_operator_emission_text
  ) {
    validationErrors.push("public_contract_sealed_operator_message_text_hard_seal_mismatch");
  }

  if (
    typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
    && typeof runtimeSeal?.sealed_operator_display_text === "string"
    && publicFreeze.public_contract_sealed_operator_message_text !== runtimeSeal.sealed_operator_display_text
  ) {
    validationErrors.push("public_contract_sealed_operator_message_text_runtime_final_seal_mismatch");
  }

  if (
    typeof publicFreeze?.public_contract_sealed_operator_message_hash === "string"
    && typeof runtimeSeal?.sealed_operator_display_hash === "string"
    && publicFreeze.public_contract_sealed_operator_message_hash !== runtimeSeal.sealed_operator_display_hash
  ) {
    validationErrors.push("public_contract_sealed_operator_message_hash_runtime_final_seal_mismatch");
  }

  if (publicFreeze?.public_contract_sealed_operator_message_source !== "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text") {
    validationErrors.push("public_contract_sealed_operator_message_source_not_hard_seal");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid
    ? runtimeSeal.blocked === true
      || handoffChecklist.blocked === true
      || realEntry.blocked === true
      || hardSeal.blocked === true
      || publicFreeze.blocked === true
    : true;
  const liveExtractedOperatorMessageText = contractValid
    ? publicFreeze.public_contract_sealed_operator_message_text
    : [
      "ChatGPT public contract final live extraction smoke invalid.",
      "blocked_stage: operator_compact_diagnostics_public_contract_final_live_extraction_smoke",
      "operator_action: inspect_phase36k_public_contract_freeze",
    ].join("\n");

  return {
    used: true,
    phase: "36L",
    surface_kind: chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeKind,
    version: chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_public_contract_final_live_extraction_blocked"
        : "operator_compact_diagnostics_public_contract_final_live_extraction_clear"
      : "operator_compact_diagnostics_public_contract_final_live_extraction_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_public_contract_final_live_extraction_reference"
      : "operator_compact_diagnostics_public_contract_final_live_extraction_invalid_reference",

    final_live_extraction_dependency_chain: ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L"],
    final_live_extraction_dependency_chain_complete: contractValid,
    final_live_extraction_required_read_field:
      chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeRequiredField,
    final_live_extraction_must_read_exact_field: true,
    final_live_extraction_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromPublicContractFinalLiveExtractionSmoke(tool_response)",
    final_live_extraction_accepted_source:
      chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeRequiredField,

    blocked,
    blocked_reason: contractValid
      ? runtimeSeal.blocked_reason
        ?? handoffChecklist.blocked_reason
        ?? realEntry.blocked_reason
        ?? hardSeal.blocked_reason
        ?? publicFreeze.blocked_reason
        ?? null
      : "operator_compact_diagnostics_public_contract_final_live_extraction_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? runtimeSeal?.must_not_output_candidate_reason
        ?? handoffChecklist?.must_not_output_candidate_reason
        ?? realEntry?.must_not_output_candidate_reason
        ?? hardSeal?.must_not_output_candidate_reason
        ?? publicFreeze?.must_not_output_candidate_reason
        ?? "required_brain_modules_contract_invalid"
      : "public_contract_final_live_extraction_is_reference_only",

    live_extracted_operator_message_text: liveExtractedOperatorMessageText,
    live_extracted_operator_message_hash: sha256(liveExtractedOperatorMessageText),
    live_extracted_operator_message_source: contractValid
      ? chatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmokeRequiredField
      : "operator_compact_diagnostics_public_contract_final_live_extraction.invalid_notice",
    live_extracted_operator_message_matches_public_contract_freeze: contractValid
      && typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
      && liveExtractedOperatorMessageText === publicFreeze.public_contract_sealed_operator_message_text,
    live_extracted_operator_message_matches_final_operator_emission_hard_seal: contractValid
      && typeof hardSeal?.sealed_final_operator_emission_text === "string"
      && liveExtractedOperatorMessageText === hardSeal.sealed_final_operator_emission_text,
    live_extracted_operator_message_matches_runtime_final_seal: contractValid
      && typeof runtimeSeal?.sealed_operator_display_text === "string"
      && liveExtractedOperatorMessageText === runtimeSeal.sealed_operator_display_text,
    live_extracted_operator_message_is_blocked_notice: contractValid && blocked && liveExtractedOperatorMessageText.includes("BLOCKED:"),
    live_extracted_operator_message_is_clear_notice: contractValid && !blocked && liveExtractedOperatorMessageText.includes("READY:"),

    runtime_final_seal_status: runtimeSeal?.status ?? null,
    operator_handoff_final_checklist_status: handoffChecklist?.status ?? null,
    real_chatgpt_entry_status: realEntry?.status ?? null,
    final_operator_emission_hard_seal_status: hardSeal?.status ?? null,
    public_contract_freeze_status: publicFreeze?.status ?? null,
    public_contract_freeze_hash: publicFreeze?.public_contract_sealed_operator_message_hash ?? null,

    public_contract_final_live_extraction_is_reference_only: true,
    public_contract_final_live_extraction_adds_output_layer: false,
    public_contract_final_live_extraction_must_not_replace_final_output: true,
    public_contract_final_live_extraction_must_not_be_emitted_as_story_text: true,
    public_contract_final_live_extraction_must_not_be_used_as_candidate_text: true,
    public_contract_final_live_extraction_requires_public_contract_freeze: true,
    public_contract_final_live_extraction_requires_no_result_read: true,
    public_contract_final_live_extraction_requires_no_chatgpt_final_output_text_read: true,
    public_contract_final_live_extraction_requires_no_final_closure_index_read_for_text: true,
    public_contract_final_live_extraction_requires_no_live_acceptance_as_final_output: true,
    public_contract_final_live_extraction_requires_no_handoff_surface_as_output: true,
    public_contract_final_live_extraction_requires_no_real_entry_surface_as_output: true,
    public_contract_final_live_extraction_requires_no_hard_seal_surface_as_story_text: true,
    public_contract_final_live_extraction_requires_no_public_freeze_surface_as_story_text: true,
    public_contract_final_live_extraction_requires_no_recomposition: true,
    public_contract_final_live_extraction_requires_no_fallback: true,

    must_not_emit_public_contract_final_live_extraction_as_story_text: true,
    must_not_emit_public_contract_freeze_as_story_text: true,
    must_not_emit_final_operator_emission_hard_seal_as_story_text: true,
    must_not_emit_real_chatgpt_entry_smoke: true,
    must_not_emit_operator_handoff_final_checklist: true,
    must_not_emit_runtime_final_seal: true,
    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_chatgpt_final_output_text_for_final_live_extraction: true,
    must_not_read_final_closure_index_for_final_live_extraction: true,
    must_not_read_live_acceptance_as_final_output: true,
    must_not_read_handoff_output_fields: true,
    must_not_read_real_entry_output_fields: true,
    must_not_read_hard_seal_output_fields: true,
    must_not_read_public_freeze_output_fields: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_read_chatgpt_final_output_text: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}



const chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistKind =
  "chatgpt_bridge_operator_compact_diagnostics_final_emission_operator_checklist";
const chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistVersion =
  "chatgpt_bridge_operator_compact_diagnostics_final_emission_operator_checklist_v1";
const chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text";

function buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredTopLevelKeys() {
  return [
    "chatgpt_final_output",
    "chatgpt_operator_compact_diagnostics",
    "chatgpt_operator_compact_diagnostics_consumer",
    "chatgpt_operator_compact_diagnostics_final_closure_index",
    "chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "chatgpt_operator_compact_diagnostics_runtime_final_seal",
    "chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
    "chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal",
    "chatgpt_operator_compact_diagnostics_public_contract_freeze",
    "chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke",
  ];
}

function buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionForbiddenSources(),
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_closure_index.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke.accepted_operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(tool_response).operator_display_text",
  ];
}

function buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistItems() {
  return [
    {
      id: "must_read_phase36l_live_extracted_operator_message_text",
      status: "required",
      instruction: "Read only tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text.",
      required_read_field: chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredField,
      required_value: true,
    },
    {
      id: "must_emit_referenced_operator_message_exactly",
      status: "required",
      instruction: "For the final operator emission path, emit the referenced 36L live-extracted operator message exactly.",
      required_value: true,
    },
    {
      id: "must_not_read_result_or_candidate_text",
      status: "required",
      instruction: "Do not read result.*, final_candidate_text, success/failure output, diagnostics output_text, or nested candidate text.",
      required_value: true,
    },
    {
      id: "must_not_rewrite_summarize_or_recompose",
      status: "required",
      instruction: "Do not rewrite, summarize, repair, recompose, or fallback to any alternate surface.",
      required_value: true,
    },
    {
      id: "must_preserve_candidate_only_safety",
      status: "required",
      instruction: "Do not save, approve, adopt, update canon, or update active_engine from this checklist.",
      required_value: true,
    },
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromFinalEmissionOperatorChecklist(toolResponse = {}) {
  return toolResponse?.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist?.final_emission_operator_checklist_message_text;
}

export function buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const publicFreeze = toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_freeze ?? null;
  const finalLive =
    toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const resultIndex = topLevelKeys.indexOf("result");
  const liveIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke");
  const checklistIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_emission_operator_checklist");
  const requiredTopLevelKeys =
    buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredTopLevelKeys();
  const forbiddenSources =
    buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistForbiddenSources();
  const checklistItems =
    buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistItems();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  for (const key of requiredTopLevelKeys) {
    if (!topLevelKeys.includes(key)) {
      validationErrors.push("top_level_key_missing:" + key);
    }
  }

  for (let index = 1; index < requiredTopLevelKeys.length; index += 1) {
    const previousKey = requiredTopLevelKeys[index - 1];
    const currentKey = requiredTopLevelKeys[index];
    const previousIndex = topLevelKeys.indexOf(previousKey);
    const currentIndex = topLevelKeys.indexOf(currentKey);
    if (previousIndex >= 0 && currentIndex >= 0 && previousIndex > currentIndex) {
      validationErrors.push("top_level_key_order_invalid:" + previousKey + ">" + currentKey);
    }
  }

  for (const key of requiredTopLevelKeys) {
    const keyIndex = topLevelKeys.indexOf(key);
    if (resultIndex >= 0 && keyIndex >= 0 && keyIndex > resultIndex) {
      validationErrors.push("top_level_key_should_precede_result:" + key);
    }
  }

  if (liveIndex < 0) {
    validationErrors.push("top_level_public_contract_final_live_extraction_smoke_missing");
  }

  if (liveIndex >= 0 && checklistIndex >= 0 && liveIndex > checklistIndex) {
    validationErrors.push("public_contract_final_live_extraction_should_precede_final_emission_operator_checklist");
  }

  if (resultIndex >= 0 && checklistIndex >= 0 && checklistIndex > resultIndex) {
    validationErrors.push("final_emission_operator_checklist_should_precede_result");
  }

  if (runtimeSeal?.used !== true) {
    validationErrors.push("runtime_final_seal_used_false_or_missing");
  }

  if (runtimeSeal?.phase !== "36G") {
    validationErrors.push("runtime_final_seal_phase_not_36g");
  }

  if (runtimeSeal?.contract_valid !== true) {
    validationErrors.push("runtime_final_seal_contract_invalid");
  }

  if (publicFreeze?.used !== true) {
    validationErrors.push("public_contract_freeze_used_false_or_missing");
  }

  if (publicFreeze?.phase !== "36K") {
    validationErrors.push("public_contract_freeze_phase_not_36k");
  }

  if (publicFreeze?.contract_valid !== true) {
    validationErrors.push("public_contract_freeze_contract_invalid");
  }

  if (finalLive?.used !== true) {
    validationErrors.push("public_contract_final_live_extraction_used_false_or_missing");
  }

  if (finalLive?.phase !== "36L") {
    validationErrors.push("public_contract_final_live_extraction_phase_not_36l");
  }

  if (finalLive?.contract_valid !== true) {
    validationErrors.push("public_contract_final_live_extraction_contract_invalid");
  }

  if (
    finalLive?.final_live_extraction_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.public_contract_sealed_operator_message_text"
  ) {
    validationErrors.push("public_contract_final_live_extraction_required_field_mismatch");
  }

  if (finalLive?.final_live_extraction_must_read_exact_field !== true) {
    validationErrors.push("public_contract_final_live_extraction_exact_field_guard_not_true");
  }

  if (typeof finalLive?.live_extracted_operator_message_text !== "string") {
    validationErrors.push("live_extracted_operator_message_text_missing_or_not_string");
  }

  if (
    typeof finalLive?.live_extracted_operator_message_hash !== "string"
    || finalLive.live_extracted_operator_message_hash.length === 0
  ) {
    validationErrors.push("live_extracted_operator_message_hash_missing");
  } else if (
    typeof finalLive?.live_extracted_operator_message_text === "string"
    && finalLive.live_extracted_operator_message_hash !== sha256(finalLive.live_extracted_operator_message_text)
  ) {
    validationErrors.push("live_extracted_operator_message_hash_mismatch");
  }

  if (
    finalLive?.live_extracted_operator_message_source
    !== "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.public_contract_sealed_operator_message_text"
  ) {
    validationErrors.push("live_extracted_operator_message_source_not_public_contract_freeze");
  }

  if (
    typeof finalLive?.live_extracted_operator_message_text === "string"
    && typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
    && finalLive.live_extracted_operator_message_text !== publicFreeze.public_contract_sealed_operator_message_text
  ) {
    validationErrors.push("live_extracted_operator_message_text_public_contract_freeze_mismatch");
  }

  if (
    typeof finalLive?.live_extracted_operator_message_hash === "string"
    && typeof publicFreeze?.public_contract_sealed_operator_message_hash === "string"
    && finalLive.live_extracted_operator_message_hash !== publicFreeze.public_contract_sealed_operator_message_hash
  ) {
    validationErrors.push("live_extracted_operator_message_hash_public_contract_freeze_mismatch");
  }

  if (
    typeof finalLive?.live_extracted_operator_message_text === "string"
    && typeof runtimeSeal?.sealed_operator_display_text === "string"
    && finalLive.live_extracted_operator_message_text !== runtimeSeal.sealed_operator_display_text
  ) {
    validationErrors.push("live_extracted_operator_message_text_runtime_final_seal_mismatch");
  }

  if (
    typeof finalLive?.live_extracted_operator_message_hash === "string"
    && typeof runtimeSeal?.sealed_operator_display_hash === "string"
    && finalLive.live_extracted_operator_message_hash !== runtimeSeal.sealed_operator_display_hash
  ) {
    validationErrors.push("live_extracted_operator_message_hash_runtime_final_seal_mismatch");
  }

  if (finalLive?.public_contract_final_live_extraction_is_reference_only !== true) {
    validationErrors.push("public_contract_final_live_extraction_reference_only_not_true");
  }

  if (finalLive?.public_contract_final_live_extraction_adds_output_layer !== false) {
    validationErrors.push("public_contract_final_live_extraction_adds_output_layer_not_false");
  }

  if (finalLive?.public_contract_final_live_extraction_requires_no_result_read !== true) {
    validationErrors.push("public_contract_final_live_extraction_no_result_read_guard_not_true");
  }

  if (finalLive?.public_contract_final_live_extraction_requires_no_recomposition !== true) {
    validationErrors.push("public_contract_final_live_extraction_no_recomposition_guard_not_true");
  }

  if (finalLive?.public_contract_final_live_extraction_requires_no_fallback !== true) {
    validationErrors.push("public_contract_final_live_extraction_no_fallback_guard_not_true");
  }


  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? finalLive.blocked === true : true;
  const finalEmissionOperatorChecklistMessageText = contractValid
    ? finalLive.live_extracted_operator_message_text
    : [
      "ChatGPT final emission operator checklist invalid.",
      "blocked_stage: operator_compact_diagnostics_final_emission_operator_checklist",
      "operator_action: inspect_phase36l_public_contract_final_live_extraction_smoke",
    ].join("\n");

  return {
    used: true,
    phase: "36M",
    surface_kind: chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistKind,
    version: chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_final_emission_operator_checklist_blocked"
        : "operator_compact_diagnostics_final_emission_operator_checklist_clear"
      : "operator_compact_diagnostics_final_emission_operator_checklist_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_final_emission_operator_checklist_reference"
      : "operator_compact_diagnostics_final_emission_operator_checklist_invalid_reference",

    final_emission_operator_checklist_dependency_chain:
      ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L", "36M"],
    final_emission_operator_checklist_dependency_chain_complete: contractValid,
    final_emission_operator_checklist_required_read_field:
      chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredField,
    final_emission_operator_checklist_must_read_exact_field: true,
    final_emission_operator_checklist_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromFinalEmissionOperatorChecklist(tool_response)",
    final_emission_operator_checklist_accepted_source:
      chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredField,

    blocked,
    blocked_reason: contractValid
      ? finalLive.blocked_reason ?? null
      : "operator_compact_diagnostics_final_emission_operator_checklist_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? finalLive?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "final_emission_operator_checklist_is_reference_only",

    final_emission_operator_checklist_items: checklistItems,
    final_emission_operator_checklist_items_complete: contractValid,
    final_emission_operator_checklist_message_text: finalEmissionOperatorChecklistMessageText,
    final_emission_operator_checklist_message_hash: sha256(finalEmissionOperatorChecklistMessageText),
    final_emission_operator_checklist_message_source: contractValid
      ? chatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistRequiredField
      : "operator_compact_diagnostics_final_emission_operator_checklist.invalid_notice",
    final_emission_operator_checklist_message_matches_final_live_extraction: contractValid
      && typeof finalLive?.live_extracted_operator_message_text === "string"
      && finalEmissionOperatorChecklistMessageText === finalLive.live_extracted_operator_message_text,
    final_emission_operator_checklist_message_matches_public_contract_freeze: contractValid
      && typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
      && finalEmissionOperatorChecklistMessageText === publicFreeze.public_contract_sealed_operator_message_text,
    final_emission_operator_checklist_message_matches_runtime_final_seal: contractValid
      && typeof runtimeSeal?.sealed_operator_display_text === "string"
      && finalEmissionOperatorChecklistMessageText === runtimeSeal.sealed_operator_display_text,
    final_emission_operator_checklist_message_is_blocked_notice:
      contractValid && blocked && finalEmissionOperatorChecklistMessageText.includes("BLOCKED:"),
    final_emission_operator_checklist_message_is_clear_notice:
      contractValid && !blocked && finalEmissionOperatorChecklistMessageText.includes("READY:"),

    public_contract_final_live_extraction_status: finalLive?.status ?? null,
    public_contract_final_live_extraction_hash: finalLive?.live_extracted_operator_message_hash ?? null,
    public_contract_freeze_status: publicFreeze?.status ?? null,
    runtime_final_seal_status: runtimeSeal?.status ?? null,

    final_emission_operator_checklist_is_reference_only: true,
    final_emission_operator_checklist_adds_output_layer: false,
    final_emission_operator_checklist_must_not_replace_final_output: true,
    final_emission_operator_checklist_must_not_be_emitted_as_story_text: true,
    final_emission_operator_checklist_must_not_be_used_as_candidate_text: true,
    final_emission_operator_checklist_requires_public_contract_final_live_extraction: true,
    final_emission_operator_checklist_requires_no_result_read: true,
    final_emission_operator_checklist_requires_no_chatgpt_final_output_text_read: true,
    final_emission_operator_checklist_requires_no_final_closure_index_read_for_text: true,
    final_emission_operator_checklist_requires_no_live_acceptance_as_final_output: true,
    final_emission_operator_checklist_requires_no_handoff_surface_as_output: true,
    final_emission_operator_checklist_requires_no_real_entry_surface_as_output: true,
    final_emission_operator_checklist_requires_no_hard_seal_surface_as_story_text: true,
    final_emission_operator_checklist_requires_no_public_freeze_surface_as_story_text: true,
    final_emission_operator_checklist_requires_no_final_live_extraction_surface_as_story_text: true,
    final_emission_operator_checklist_requires_no_recomposition: true,
    final_emission_operator_checklist_requires_no_fallback: true,

    must_not_emit_final_emission_operator_checklist_as_story_text: true,
    must_not_emit_public_contract_final_live_extraction_as_story_text: true,
    must_not_emit_public_contract_freeze_as_story_text: true,
    must_not_emit_final_operator_emission_hard_seal_as_story_text: true,
    must_not_emit_real_chatgpt_entry_smoke: true,
    must_not_emit_operator_handoff_final_checklist: true,
    must_not_emit_runtime_final_seal: true,
    must_not_emit_live_acceptance_smoke: true,
    must_not_emit_final_closure_index: true,
    must_not_emit_result_surface: true,
    must_not_read_result: true,
    must_not_read_chatgpt_final_output_text_for_final_emission_operator_checklist: true,
    must_not_read_final_closure_index_for_final_emission_operator_checklist: true,
    must_not_read_live_acceptance_as_final_output: true,
    must_not_read_handoff_output_fields: true,
    must_not_read_real_entry_output_fields: true,
    must_not_read_hard_seal_output_fields: true,
    must_not_read_public_freeze_output_fields: true,
    must_not_read_final_live_extraction_output_fields: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_read_chatgpt_final_output_text: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}



const chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeKind =
  "chatgpt_bridge_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke";
const chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeVersion =
  "chatgpt_bridge_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke_v1";
const chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text";

function buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredTopLevelKeys() {
  return [
    "chatgpt_final_output",
    "chatgpt_operator_compact_diagnostics",
    "chatgpt_operator_compact_diagnostics_consumer",
    "chatgpt_operator_compact_diagnostics_final_closure_index",
    "chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "chatgpt_operator_compact_diagnostics_runtime_final_seal",
    "chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
    "chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal",
    "chatgpt_operator_compact_diagnostics_public_contract_freeze",
    "chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke",
    "chatgpt_operator_compact_diagnostics_final_emission_operator_checklist",
  ];
}

function buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklistForbiddenSources(),
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke(tool_response).operator_display_text",
  ];
}

function buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeItems() {
  return [
    {
      id: "must_read_phase36m_final_emission_operator_checklist_message_text",
      status: "required",
      instruction: "Read only tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text.",
      required_read_field: chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredField,
      required_value: true,
    },
    {
      id: "must_emit_phase36m_message_exactly_for_live_mcp_contract",
      status: "required",
      instruction: "The live MCP final emission contract must reference the exact Phase36M checklist message.",
      required_value: true,
    },
    {
      id: "must_not_read_result_or_chatgpt_final_output",
      status: "required",
      instruction: "Do not read result.*, chatgpt_final_output.output_text, or nested candidate text.",
      required_value: true,
    },
    {
      id: "must_ignore_lower_diagnostics_output_decoys",
      status: "required",
      instruction: "Ignore output_text/operator_display_text decoys on lower diagnostics surfaces.",
      required_value: true,
    },
    {
      id: "must_preserve_candidate_only_and_no_canon_write",
      status: "required",
      instruction: "Do not save, approve, adopt, update canon, or update active_engine from this smoke.",
      required_value: true,
    },
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromLiveMcpFinalEmissionContractSmoke(toolResponse = {}) {
  return toolResponse?.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke?.live_mcp_final_emission_contract_message_text;
}

export function buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke(toolResponse = {}) {
  const runtimeSeal = toolResponse?.chatgpt_operator_compact_diagnostics_runtime_final_seal ?? null;
  const publicFreeze = toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_freeze ?? null;
  const finalLive =
    toolResponse?.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke ?? null;
  const checklist =
    toolResponse?.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const resultIndex = topLevelKeys.indexOf("result");
  const checklistIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_final_emission_operator_checklist");
  const smokeIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke");
  const requiredTopLevelKeys =
    buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredTopLevelKeys();
  const forbiddenSources =
    buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeForbiddenSources();
  const smokeItems =
    buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeItems();
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  for (const key of requiredTopLevelKeys) {
    if (!topLevelKeys.includes(key)) {
      validationErrors.push("top_level_key_missing:" + key);
    }
  }

  for (let index = 1; index < requiredTopLevelKeys.length; index += 1) {
    const previousKey = requiredTopLevelKeys[index - 1];
    const currentKey = requiredTopLevelKeys[index];
    const previousIndex = topLevelKeys.indexOf(previousKey);
    const currentIndex = topLevelKeys.indexOf(currentKey);
    if (previousIndex >= 0 && currentIndex >= 0 && previousIndex > currentIndex) {
      validationErrors.push("top_level_key_order_invalid:" + previousKey + ">" + currentKey);
    }
  }

  for (const key of requiredTopLevelKeys) {
    const keyIndex = topLevelKeys.indexOf(key);
    if (resultIndex >= 0 && keyIndex >= 0 && keyIndex > resultIndex) {
      validationErrors.push("top_level_key_should_precede_result:" + key);
    }
  }

  if (checklistIndex < 0) {
    validationErrors.push("top_level_final_emission_operator_checklist_missing");
  }

  if (checklistIndex >= 0 && smokeIndex >= 0 && checklistIndex > smokeIndex) {
    validationErrors.push("final_emission_operator_checklist_should_precede_live_mcp_final_emission_contract_smoke");
  }

  if (resultIndex >= 0 && smokeIndex >= 0 && smokeIndex > resultIndex) {
    validationErrors.push("live_mcp_final_emission_contract_smoke_should_precede_result");
  }

  if (runtimeSeal?.used !== true) validationErrors.push("runtime_final_seal_used_false_or_missing");
  if (runtimeSeal?.phase !== "36G") validationErrors.push("runtime_final_seal_phase_not_36g");
  if (runtimeSeal?.contract_valid !== true) validationErrors.push("runtime_final_seal_contract_invalid");

  if (publicFreeze?.used !== true) validationErrors.push("public_contract_freeze_used_false_or_missing");
  if (publicFreeze?.phase !== "36K") validationErrors.push("public_contract_freeze_phase_not_36k");
  if (publicFreeze?.contract_valid !== true) validationErrors.push("public_contract_freeze_contract_invalid");

  if (finalLive?.used !== true) validationErrors.push("public_contract_final_live_extraction_used_false_or_missing");
  if (finalLive?.phase !== "36L") validationErrors.push("public_contract_final_live_extraction_phase_not_36l");
  if (finalLive?.contract_valid !== true) validationErrors.push("public_contract_final_live_extraction_contract_invalid");

  if (checklist?.used !== true) validationErrors.push("final_emission_operator_checklist_used_false_or_missing");
  if (checklist?.phase !== "36M") validationErrors.push("final_emission_operator_checklist_phase_not_36m");
  if (checklist?.contract_valid !== true) validationErrors.push("final_emission_operator_checklist_contract_invalid");

  if (
    checklist?.final_emission_operator_checklist_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text"
  ) {
    validationErrors.push("final_emission_operator_checklist_required_field_mismatch");
  }

  if (checklist?.final_emission_operator_checklist_must_read_exact_field !== true) {
    validationErrors.push("final_emission_operator_checklist_exact_field_guard_not_true");
  }

  if (typeof checklist?.final_emission_operator_checklist_message_text !== "string") {
    validationErrors.push("final_emission_operator_checklist_message_text_missing_or_not_string");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_hash !== "string"
    || checklist.final_emission_operator_checklist_message_hash.length === 0
  ) {
    validationErrors.push("final_emission_operator_checklist_message_hash_missing");
  } else if (
    typeof checklist?.final_emission_operator_checklist_message_text === "string"
    && checklist.final_emission_operator_checklist_message_hash !== sha256(checklist.final_emission_operator_checklist_message_text)
  ) {
    validationErrors.push("final_emission_operator_checklist_message_hash_mismatch");
  }

  if (
    checklist?.final_emission_operator_checklist_message_source
    !== "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text"
  ) {
    validationErrors.push("final_emission_operator_checklist_message_source_not_final_live_extraction");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_text === "string"
    && typeof finalLive?.live_extracted_operator_message_text === "string"
    && checklist.final_emission_operator_checklist_message_text !== finalLive.live_extracted_operator_message_text
  ) {
    validationErrors.push("final_emission_operator_checklist_message_text_final_live_extraction_mismatch");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_hash === "string"
    && typeof finalLive?.live_extracted_operator_message_hash === "string"
    && checklist.final_emission_operator_checklist_message_hash !== finalLive.live_extracted_operator_message_hash
  ) {
    validationErrors.push("final_emission_operator_checklist_message_hash_final_live_extraction_mismatch");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_text === "string"
    && typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
    && checklist.final_emission_operator_checklist_message_text !== publicFreeze.public_contract_sealed_operator_message_text
  ) {
    validationErrors.push("final_emission_operator_checklist_message_text_public_contract_freeze_mismatch");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_hash === "string"
    && typeof publicFreeze?.public_contract_sealed_operator_message_hash === "string"
    && checklist.final_emission_operator_checklist_message_hash !== publicFreeze.public_contract_sealed_operator_message_hash
  ) {
    validationErrors.push("final_emission_operator_checklist_message_hash_public_contract_freeze_mismatch");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_text === "string"
    && typeof runtimeSeal?.sealed_operator_display_text === "string"
    && checklist.final_emission_operator_checklist_message_text !== runtimeSeal.sealed_operator_display_text
  ) {
    validationErrors.push("final_emission_operator_checklist_message_text_runtime_final_seal_mismatch");
  }

  if (
    typeof checklist?.final_emission_operator_checklist_message_hash === "string"
    && typeof runtimeSeal?.sealed_operator_display_hash === "string"
    && checklist.final_emission_operator_checklist_message_hash !== runtimeSeal.sealed_operator_display_hash
  ) {
    validationErrors.push("final_emission_operator_checklist_message_hash_runtime_final_seal_mismatch");
  }

  if (checklist?.final_emission_operator_checklist_is_reference_only !== true) {
    validationErrors.push("final_emission_operator_checklist_reference_only_not_true");
  }

  if (checklist?.final_emission_operator_checklist_adds_output_layer !== false) {
    validationErrors.push("final_emission_operator_checklist_adds_output_layer_not_false");
  }

  if (checklist?.final_emission_operator_checklist_requires_no_result_read !== true) {
    validationErrors.push("final_emission_operator_checklist_no_result_read_guard_not_true");
  }

  if (checklist?.final_emission_operator_checklist_requires_no_chatgpt_final_output_text_read !== true) {
    validationErrors.push("final_emission_operator_checklist_no_chatgpt_final_output_text_guard_not_true");
  }

  if (checklist?.final_emission_operator_checklist_requires_no_final_live_extraction_surface_as_story_text !== true) {
    validationErrors.push("final_emission_operator_checklist_no_final_live_story_surface_guard_not_true");
  }

  if (checklist?.final_emission_operator_checklist_requires_no_recomposition !== true) {
    validationErrors.push("final_emission_operator_checklist_no_recomposition_guard_not_true");
  }

  if (checklist?.final_emission_operator_checklist_requires_no_fallback !== true) {
    validationErrors.push("final_emission_operator_checklist_no_fallback_guard_not_true");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? checklist.blocked === true : true;
  const liveMcpFinalEmissionContractMessageText = contractValid
    ? checklist.final_emission_operator_checklist_message_text
    : [
      "ChatGPT live MCP final emission contract smoke invalid.",
      "blocked_stage: operator_compact_diagnostics_live_mcp_final_emission_contract_smoke",
      "operator_action: inspect_phase36m_final_emission_operator_checklist",
    ].join("\n");

  return {
    used: true,
    phase: "37A",
    surface_kind: chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeKind,
    version: chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_live_mcp_final_emission_contract_blocked"
        : "operator_compact_diagnostics_live_mcp_final_emission_contract_clear"
      : "operator_compact_diagnostics_live_mcp_final_emission_contract_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_live_mcp_final_emission_contract_reference"
      : "operator_compact_diagnostics_live_mcp_final_emission_contract_invalid_reference",

    live_mcp_final_emission_contract_dependency_chain:
      ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L", "36M", "37A"],
    live_mcp_final_emission_contract_dependency_chain_complete: contractValid,
    live_mcp_final_emission_contract_required_read_field:
      chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredField,
    live_mcp_final_emission_contract_must_read_exact_field: true,
    live_mcp_final_emission_contract_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromLiveMcpFinalEmissionContractSmoke(tool_response)",
    live_mcp_final_emission_contract_accepted_source:
      chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredField,

    blocked,
    blocked_reason: contractValid
      ? checklist.blocked_reason ?? null
      : "operator_compact_diagnostics_live_mcp_final_emission_contract_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? checklist?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "live_mcp_final_emission_contract_is_reference_only",

    live_mcp_final_emission_contract_items: smokeItems,
    live_mcp_final_emission_contract_items_complete: contractValid,
    live_mcp_final_emission_contract_message_text: liveMcpFinalEmissionContractMessageText,
    live_mcp_final_emission_contract_message_hash: sha256(liveMcpFinalEmissionContractMessageText),
    live_mcp_final_emission_contract_message_source: contractValid
      ? chatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeRequiredField
      : "operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.invalid_notice",
    live_mcp_final_emission_contract_message_matches_final_emission_operator_checklist: contractValid
      && typeof checklist?.final_emission_operator_checklist_message_text === "string"
      && liveMcpFinalEmissionContractMessageText === checklist.final_emission_operator_checklist_message_text,
    live_mcp_final_emission_contract_message_matches_final_live_extraction: contractValid
      && typeof finalLive?.live_extracted_operator_message_text === "string"
      && liveMcpFinalEmissionContractMessageText === finalLive.live_extracted_operator_message_text,
    live_mcp_final_emission_contract_message_matches_public_contract_freeze: contractValid
      && typeof publicFreeze?.public_contract_sealed_operator_message_text === "string"
      && liveMcpFinalEmissionContractMessageText === publicFreeze.public_contract_sealed_operator_message_text,
    live_mcp_final_emission_contract_message_matches_runtime_final_seal: contractValid
      && typeof runtimeSeal?.sealed_operator_display_text === "string"
      && liveMcpFinalEmissionContractMessageText === runtimeSeal.sealed_operator_display_text,
    live_mcp_final_emission_contract_message_is_blocked_notice:
      contractValid && blocked && liveMcpFinalEmissionContractMessageText.includes("BLOCKED:"),
    live_mcp_final_emission_contract_message_is_clear_notice:
      contractValid && !blocked && liveMcpFinalEmissionContractMessageText.includes("READY:"),

    final_emission_operator_checklist_status: checklist?.status ?? null,
    final_emission_operator_checklist_hash: checklist?.final_emission_operator_checklist_message_hash ?? null,
    public_contract_final_live_extraction_status: finalLive?.status ?? null,
    public_contract_freeze_status: publicFreeze?.status ?? null,
    runtime_final_seal_status: runtimeSeal?.status ?? null,

    live_mcp_final_emission_contract_is_reference_only: true,
    live_mcp_final_emission_contract_adds_output_layer: false,
    live_mcp_final_emission_contract_must_not_replace_final_output: true,
    live_mcp_final_emission_contract_must_not_be_emitted_as_story_text: true,
    live_mcp_final_emission_contract_must_not_be_used_as_candidate_text: true,
    live_mcp_final_emission_contract_requires_final_emission_operator_checklist: true,
    live_mcp_final_emission_contract_requires_no_result_read: true,
    live_mcp_final_emission_contract_requires_no_chatgpt_final_output_text_read: true,
    live_mcp_final_emission_contract_requires_no_final_live_extraction_surface_as_story_text: true,
    live_mcp_final_emission_contract_requires_no_final_emission_operator_checklist_surface_as_story_text: true,
    live_mcp_final_emission_contract_requires_no_recomposition: true,
    live_mcp_final_emission_contract_requires_no_fallback: true,

    must_not_read_result: true,
    must_not_read_chatgpt_final_output_text_for_live_mcp_final_emission_contract: true,
    must_not_read_final_live_extraction_output_fields: true,
    must_not_read_final_emission_operator_checklist_output_fields: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_read_chatgpt_final_output_text: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
  };
}



const chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealKind =
  "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal";
const chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealVersion =
  "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_v1";
const chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredField =
  "tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.live_mcp_final_emission_contract_message_text";

function buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredTopLevelKeys() {
  return [
    "chatgpt_final_output",
    "chatgpt_operator_compact_diagnostics",
    "chatgpt_operator_compact_diagnostics_consumer",
    "chatgpt_operator_compact_diagnostics_final_closure_index",
    "chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke",
    "chatgpt_operator_compact_diagnostics_runtime_final_seal",
    "chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist",
    "chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
    "chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal",
    "chatgpt_operator_compact_diagnostics_public_contract_freeze",
    "chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke",
    "chatgpt_operator_compact_diagnostics_final_emission_operator_checklist",
    "chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke",
  ];
}

function buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealForbiddenSources() {
  return [
    ...buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmokeForbiddenSources(),
    "tool_response.chatgpt_final_output.output_text",
    "tool_response.result",
    "tool_response.result.final_candidate_text",
    "tool_response.result.success_output_for_chat",
    "tool_response.result.failure_output_for_chat",
    "tool_response.result.final_response_for_chat",
    "tool_response.result.final_response_handoff_for_chat",
    "tool_response.result.extracted_chatgpt_final_output",
    "tool_response.result.neural_writing_brain_required_modules_contract",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.operator_display_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.output_text",
    "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.operator_display_text",
    "buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal(tool_response).output_text",
    "buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal(tool_response).operator_display_text",
  ];
}

function buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealItems() {
  return [
    {
      id: "must_read_phase37a_live_mcp_final_emission_message_text",
      status: "required",
      instruction: "Read only tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.live_mcp_final_emission_contract_message_text.",
      required_read_field:
        chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredField,
      required_value: true,
    },
    {
      id: "must_not_directly_read_phase36m_final_emission_operator_checklist",
      status: "required",
      instruction: "Do not directly read Phase36M final_emission_operator_checklist_message_text from the real ChatGPT consumer extraction path.",
      forbidden_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text",
      required_value: true,
    },
    {
      id: "must_not_read_result_or_chatgpt_final_output",
      status: "required",
      instruction: "Do not read result.*, chatgpt_final_output.output_text, or nested candidate text.",
      required_value: true,
    },
    {
      id: "must_ignore_36l_36m_37a_output_text_decoys",
      status: "required",
      instruction: "Ignore output_text/operator_display_text decoys on 36L, 36M, and 37A diagnostics surfaces.",
      required_value: true,
    },
    {
      id: "must_preserve_consumer_hard_seal_reference_only",
      status: "required",
      instruction: "The consumer hard seal is reference-only and must not become a story/candidate output layer.",
      required_value: true,
    },
  ];
}

export function acceptChatgptOperatorCompactDiagnosticsFromRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal(toolResponse = {}) {
  return toolResponse
    ?.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke
    ?.live_mcp_final_emission_contract_message_text;
}

export function buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal(toolResponse = {}) {
  const liveMcp =
    toolResponse?.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke ?? null;
  const topLevelKeys = toolResponse != null && typeof toolResponse === "object"
    ? Object.keys(toolResponse)
    : [];
  const resultIndex = topLevelKeys.indexOf("result");
  const liveMcpIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke");
  const extractionIndex =
    topLevelKeys.indexOf("chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal");
  const requiredTopLevelKeys =
    buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredTopLevelKeys();
  const forbiddenSources =
    buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealForbiddenSources();
  const sealItems =
    buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealItems();
  const acceptedText =
    acceptChatgptOperatorCompactDiagnosticsFromRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal(toolResponse);
  const validationErrors = [];

  if (toolResponse == null || typeof toolResponse !== "object") {
    validationErrors.push("tool_response_missing_or_not_object");
  }

  if (toolResponse?.tool_name !== "chatgpt_bridge_run_full_neural_writing_pipeline") {
    validationErrors.push("tool_response_tool_name_not_full_neural_pipeline");
  }

  for (const key of requiredTopLevelKeys) {
    if (!topLevelKeys.includes(key)) {
      validationErrors.push("top_level_key_missing:" + key);
    }
  }

  for (let index = 1; index < requiredTopLevelKeys.length; index += 1) {
    const previousKey = requiredTopLevelKeys[index - 1];
    const currentKey = requiredTopLevelKeys[index];
    const previousIndex = topLevelKeys.indexOf(previousKey);
    const currentIndex = topLevelKeys.indexOf(currentKey);
    if (previousIndex >= 0 && currentIndex >= 0 && previousIndex > currentIndex) {
      validationErrors.push("top_level_key_order_invalid:" + previousKey + ">" + currentKey);
    }
  }

  for (const key of requiredTopLevelKeys) {
    const keyIndex = topLevelKeys.indexOf(key);
    if (resultIndex >= 0 && keyIndex >= 0 && keyIndex > resultIndex) {
      validationErrors.push("top_level_key_should_precede_result:" + key);
    }
  }

  if (liveMcpIndex < 0) {
    validationErrors.push("top_level_live_mcp_final_emission_contract_smoke_missing");
  }

  if (liveMcpIndex >= 0 && extractionIndex >= 0 && liveMcpIndex > extractionIndex) {
    validationErrors.push("live_mcp_final_emission_contract_smoke_should_precede_real_chatgpt_operator_extraction_consumer_hard_seal");
  }

  if (resultIndex >= 0 && extractionIndex >= 0 && extractionIndex > resultIndex) {
    validationErrors.push("real_chatgpt_operator_extraction_consumer_hard_seal_should_precede_result");
  }

  if (liveMcp?.used !== true) {
    validationErrors.push("live_mcp_final_emission_contract_used_false_or_missing");
  }

  if (liveMcp?.phase !== "37A") {
    validationErrors.push("live_mcp_final_emission_contract_phase_not_37a");
  }

  if (liveMcp?.contract_valid !== true) {
    validationErrors.push("live_mcp_final_emission_contract_invalid");
  }

  if (
    liveMcp?.live_mcp_final_emission_contract_required_read_field
    !== "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text"
  ) {
    validationErrors.push("live_mcp_final_emission_contract_required_field_mismatch");
  }

  if (liveMcp?.live_mcp_final_emission_contract_must_read_exact_field !== true) {
    validationErrors.push("live_mcp_final_emission_contract_exact_field_guard_not_true");
  }

  if (typeof liveMcp?.live_mcp_final_emission_contract_message_text !== "string") {
    validationErrors.push("live_mcp_final_emission_contract_message_text_missing_or_not_string");
  }

  if (
    typeof liveMcp?.live_mcp_final_emission_contract_message_hash !== "string"
    || liveMcp.live_mcp_final_emission_contract_message_hash.length === 0
  ) {
    validationErrors.push("live_mcp_final_emission_contract_message_hash_missing");
  } else if (
    typeof liveMcp?.live_mcp_final_emission_contract_message_text === "string"
    && liveMcp.live_mcp_final_emission_contract_message_hash !== sha256(liveMcp.live_mcp_final_emission_contract_message_text)
  ) {
    validationErrors.push("live_mcp_final_emission_contract_message_hash_mismatch");
  }

  if (
    liveMcp?.live_mcp_final_emission_contract_message_source
    !== "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text"
  ) {
    validationErrors.push("live_mcp_final_emission_contract_message_source_not_phase36m_reference");
  }

  if (liveMcp?.live_mcp_final_emission_contract_message_matches_final_emission_operator_checklist !== true) {
    validationErrors.push("live_mcp_final_emission_contract_message_not_matched_to_final_emission_operator_checklist");
  }

  if (liveMcp?.live_mcp_final_emission_contract_is_reference_only !== true) {
    validationErrors.push("live_mcp_final_emission_contract_reference_only_not_true");
  }

  if (liveMcp?.live_mcp_final_emission_contract_adds_output_layer !== false) {
    validationErrors.push("live_mcp_final_emission_contract_adds_output_layer_not_false");
  }

  if (liveMcp?.live_mcp_final_emission_contract_requires_no_result_read !== true) {
    validationErrors.push("live_mcp_final_emission_contract_no_result_read_guard_not_true");
  }

  if (liveMcp?.live_mcp_final_emission_contract_requires_no_chatgpt_final_output_text_read !== true) {
    validationErrors.push("live_mcp_final_emission_contract_no_chatgpt_final_output_text_guard_not_true");
  }

  if (liveMcp?.live_mcp_final_emission_contract_requires_no_final_emission_operator_checklist_surface_as_story_text !== true) {
    validationErrors.push("live_mcp_final_emission_contract_no_36m_story_surface_guard_not_true");
  }

  if (liveMcp?.live_mcp_final_emission_contract_requires_no_recomposition !== true) {
    validationErrors.push("live_mcp_final_emission_contract_no_recomposition_guard_not_true");
  }

  if (liveMcp?.live_mcp_final_emission_contract_requires_no_fallback !== true) {
    validationErrors.push("live_mcp_final_emission_contract_no_fallback_guard_not_true");
  }

  if (typeof acceptedText !== "string") {
    validationErrors.push("accepted_operator_message_text_missing_or_not_string");
  }

  if (
    typeof acceptedText === "string"
    && typeof liveMcp?.live_mcp_final_emission_contract_message_text === "string"
    && acceptedText !== liveMcp.live_mcp_final_emission_contract_message_text
  ) {
    validationErrors.push("accepted_operator_message_text_live_mcp_contract_mismatch");
  }

  const contractValid = validationErrors.length === 0;
  const blocked = contractValid ? liveMcp.blocked === true : true;
  const extractedOperatorMessageText = contractValid
    ? acceptedText
    : [
      "ChatGPT real ChatGPT live MCP final emission operator extraction consumer hard seal invalid.",
      "blocked_stage: operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal",
      "operator_action: inspect_phase37a_live_mcp_final_emission_contract_smoke",
    ].join("\n");

  return {
    used: true,
    phase: "37B",
    surface_kind:
      chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealKind,
    version:
      chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? blocked
        ? "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_blocked"
        : "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_clear"
      : "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_invalid",
    response_kind: contractValid
      ? "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_reference"
      : "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_invalid_reference",

    real_chatgpt_live_mcp_operator_extraction_dependency_chain:
      ["36A", "36B", "36C", "36D", "36E", "36F", "36G", "36H", "36I", "36J", "36K", "36L", "36M", "37A", "37B"],
    real_chatgpt_live_mcp_operator_extraction_dependency_chain_complete: contractValid,
    real_chatgpt_live_mcp_operator_extraction_required_read_field:
      chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredField,
    real_chatgpt_live_mcp_operator_extraction_must_read_exact_field: true,
    real_chatgpt_live_mcp_operator_extraction_acceptance_function:
      "acceptChatgptOperatorCompactDiagnosticsFromRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal(tool_response)",
    real_chatgpt_live_mcp_operator_extraction_accepted_source:
      chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredField,

    blocked,
    blocked_reason: contractValid
      ? liveMcp.blocked_reason ?? null
      : "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_invalid",
    can_emit_operator_message: contractValid,
    can_output_to_chat: false,
    may_output_story_text: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: blocked
      ? liveMcp?.must_not_output_candidate_reason ?? "required_brain_modules_contract_invalid"
      : "real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_is_reference_only",

    real_chatgpt_live_mcp_operator_extraction_items: sealItems,
    real_chatgpt_live_mcp_operator_extraction_items_complete: contractValid,
    real_chatgpt_live_mcp_operator_extraction_message_text: extractedOperatorMessageText,
    real_chatgpt_live_mcp_operator_extraction_message_hash: sha256(extractedOperatorMessageText),
    real_chatgpt_live_mcp_operator_extraction_message_source: contractValid
      ? chatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSealRequiredField
      : "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.invalid_notice",
    real_chatgpt_live_mcp_operator_extraction_message_matches_live_mcp_final_emission_contract: contractValid
      && typeof liveMcp?.live_mcp_final_emission_contract_message_text === "string"
      && extractedOperatorMessageText === liveMcp.live_mcp_final_emission_contract_message_text,
    real_chatgpt_live_mcp_operator_extraction_message_hash_matches_live_mcp_final_emission_contract: contractValid
      && typeof liveMcp?.live_mcp_final_emission_contract_message_hash === "string"
      && sha256(extractedOperatorMessageText) === liveMcp.live_mcp_final_emission_contract_message_hash,
    real_chatgpt_live_mcp_operator_extraction_message_is_blocked_notice:
      contractValid && blocked && extractedOperatorMessageText.includes("BLOCKED:"),
    real_chatgpt_live_mcp_operator_extraction_message_is_clear_notice:
      contractValid && !blocked && extractedOperatorMessageText.includes("READY:"),

    live_mcp_final_emission_contract_status: liveMcp?.status ?? null,
    live_mcp_final_emission_contract_hash: liveMcp?.live_mcp_final_emission_contract_message_hash ?? null,
    live_mcp_final_emission_contract_source: liveMcp?.live_mcp_final_emission_contract_message_source ?? null,

    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_is_reference_only: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_adds_output_layer: false,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_must_not_replace_final_output: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_must_not_be_emitted_as_story_text: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_must_not_be_used_as_candidate_text: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_live_mcp_final_emission_contract: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_result_read: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_chatgpt_final_output_text_read: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_phase36l_direct_read: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_phase36m_direct_read: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_recomposition: true,
    real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_fallback: true,

    must_not_read_result: true,
    must_not_read_chatgpt_final_output_text_for_real_chatgpt_live_mcp_operator_extraction: true,
    must_not_read_phase36l_final_live_extraction_message_text: true,
    must_not_read_phase36m_final_emission_operator_checklist_message_text: true,
    must_not_read_37a_output_text_decoy: true,
    must_not_read_nested_result_candidate_text: true,
    must_not_read_nested_brain_contract: true,
    must_not_recompose_response: true,

    forbidden_sources: forbiddenSources,
    no_new_output_layer: true,
    no_extra_text: true,
    no_fallback: true,
    may_rewrite: false,
    may_summarize: false,
    may_include_extra_explanation: false,
    may_construct_response: false,
    may_read_tool_response_result: false,
    may_read_chatgpt_final_output_text: false,
    may_read_phase36m_final_emission_operator_checklist_message_text: false,
    may_save_candidate: false,
    may_approve_candidate: false,
    may_adopt_candidate: false,
    may_update_canon: false,
    may_update_active_engine: false,
    ...buildChatgptFinalOutputLockFields(),
    safety: buildChatgptFinalOutputSafety(toolResponse?.chatgpt_final_output?.safety),
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
  const operatorCompactDiagnostics =
    buildChatgptOperatorCompactDiagnosticsSurface(surfacedResult, chatgptFinalOutput);
  const operatorCompactDiagnosticsConsumer =
    buildChatgptOperatorCompactDiagnosticsConsumerEmission({
      ok: result?.ok !== false,
      tool_name: toolName,
      permission,
      chatgpt_final_output: chatgptFinalOutput,
      chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
      result: surfacedResult,
    });
  const operatorCompactDiagnosticsFinalClosure =
    buildChatgptOperatorCompactDiagnosticsFinalClosureIndex({
      ok: result?.ok !== false,
      tool_name: toolName,
      permission,
      chatgpt_final_output: chatgptFinalOutput,
      chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
      chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
      result: surfacedResult,
    });
  const operatorCompactDiagnosticsLiveAcceptance =
    buildChatgptOperatorCompactDiagnosticsLiveToolCallAcceptanceSmoke({
      ok: result?.ok !== false,
      tool_name: toolName,
      permission,
      chatgpt_final_output: chatgptFinalOutput,
      chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
      chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
      chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
      result: surfacedResult,
    });
  const operatorCompactDiagnosticsRuntimeFinalSeal =
    buildChatgptOperatorCompactDiagnosticsRuntimeFinalSeal({
      ok: result?.ok !== false,
      tool_name: toolName,
      permission,
      chatgpt_final_output: chatgptFinalOutput,
      chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
      chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
      chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
      chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
      result: surfacedResult,
    });
  let operatorCompactDiagnosticsOperatorHandoffFinalChecklist;
  try {
    operatorCompactDiagnosticsOperatorHandoffFinalChecklist =
      buildChatgptOperatorCompactDiagnosticsOperatorHandoffFinalChecklist({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
      });
  } catch (error) {
    operatorCompactDiagnosticsOperatorHandoffFinalChecklist = {
      used: true,
      phase: "36H",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_operator_handoff_final_checklist",
      version: "chatgpt_bridge_operator_compact_diagnostics_operator_handoff_final_checklist_v1",
      contract_valid: false,
      validation_errors: [
        "operator_handoff_final_checklist_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_operator_handoff_final_checklist_invalid",
      response_kind: "operator_compact_diagnostics_operator_handoff_final_checklist_invalid_reference",
      handoff_checklist_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text",
      blocked: true,
      blocked_reason: "operator_handoff_final_checklist_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      operator_handoff_final_checklist_is_reference_only: true,
      operator_handoff_final_checklist_adds_output_layer: false,
      operator_handoff_final_checklist_must_not_replace_final_output: true,
      operator_handoff_final_checklist_requires_no_result_read: true,
      operator_handoff_final_checklist_requires_no_final_closure_index_read_for_text: true,
      operator_handoff_final_checklist_requires_no_live_acceptance_as_final_output: true,
      operator_handoff_final_checklist_requires_no_recomposition: true,
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
    };
  }

  let operatorCompactDiagnosticsRealChatgptWritingEntrySmoke;
  try {
    operatorCompactDiagnosticsRealChatgptWritingEntrySmoke =
      buildChatgptOperatorCompactDiagnosticsRealChatgptWritingEntrySmoke({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
      });
  } catch (error) {
    operatorCompactDiagnosticsRealChatgptWritingEntrySmoke = {
      used: true,
      phase: "36I",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke",
      version: "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke_v1",
      contract_valid: false,
      validation_errors: [
        "real_chatgpt_writing_entry_smoke_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_real_chatgpt_writing_entry_invalid",
      response_kind: "operator_compact_diagnostics_real_chatgpt_writing_entry_invalid_reference",
      real_chatgpt_entry_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_runtime_final_seal.sealed_operator_display_text",
      blocked: true,
      blocked_reason: "real_chatgpt_writing_entry_smoke_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      real_chatgpt_entry_is_reference_only: true,
      real_chatgpt_entry_adds_output_layer: false,
      real_chatgpt_entry_must_not_replace_final_output: true,
      real_chatgpt_entry_requires_no_result_read: true,
      real_chatgpt_entry_requires_no_final_closure_index_read_for_text: true,
      real_chatgpt_entry_requires_no_live_acceptance_as_final_output: true,
      real_chatgpt_entry_requires_no_handoff_surface_as_output: true,
      real_chatgpt_entry_requires_no_recomposition: true,
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
    };
  }

  let operatorCompactDiagnosticsFinalOperatorEmissionHardSeal;
  try {
    operatorCompactDiagnosticsFinalOperatorEmissionHardSeal =
      buildChatgptOperatorCompactDiagnosticsFinalOperatorEmissionHardSeal({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
        chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke:
          operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
      });
  } catch (error) {
    operatorCompactDiagnosticsFinalOperatorEmissionHardSeal = {
      used: true,
      phase: "36J",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_final_operator_emission_hard_seal",
      version: "chatgpt_bridge_operator_compact_diagnostics_final_operator_emission_hard_seal_v1",
      contract_valid: false,
      validation_errors: [
        "final_operator_emission_hard_seal_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_final_operator_emission_hard_seal_invalid",
      response_kind: "operator_compact_diagnostics_final_operator_emission_hard_seal_invalid_reference",
      final_operator_emission_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke.accepted_operator_message_text",
      blocked: true,
      blocked_reason: "final_operator_emission_hard_seal_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      final_operator_emission_hard_seal_is_reference_only: true,
      final_operator_emission_hard_seal_adds_output_layer: false,
      final_operator_emission_hard_seal_must_not_replace_final_output: true,
      final_operator_emission_hard_seal_requires_no_result_read: true,
      final_operator_emission_hard_seal_requires_no_chatgpt_final_output_text_read: true,
      final_operator_emission_hard_seal_requires_no_final_closure_index_read_for_text: true,
      final_operator_emission_hard_seal_requires_no_live_acceptance_as_final_output: true,
      final_operator_emission_hard_seal_requires_no_handoff_surface_as_output: true,
      final_operator_emission_hard_seal_requires_no_recomposition: true,
      final_operator_emission_hard_seal_requires_no_fallback: true,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_read_chatgpt_final_output_text: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
    };
  }

  let operatorCompactDiagnosticsPublicContractFreeze;
  try {
    operatorCompactDiagnosticsPublicContractFreeze =
      buildChatgptOperatorCompactDiagnosticsPublicContractFreeze({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
        chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
        chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
        chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
        chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke:
          operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
        chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal:
          operatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
        result: surfacedResult,
      });
  } catch (error) {
    operatorCompactDiagnosticsPublicContractFreeze = {
      used: true,
      phase: "36K",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_public_contract_freeze",
      version: "chatgpt_bridge_operator_compact_diagnostics_public_contract_freeze_v1",
      contract_valid: false,
      validation_errors: [
        "public_contract_freeze_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_public_contract_freeze_invalid",
      response_kind: "operator_compact_diagnostics_public_contract_freeze_invalid_reference",
      public_contract_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal.sealed_final_operator_emission_text",
      blocked: true,
      blocked_reason: "public_contract_freeze_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      public_contract_freeze_is_reference_only: true,
      public_contract_freeze_adds_output_layer: false,
      public_contract_freeze_must_not_replace_final_output: true,
      public_contract_freeze_requires_no_result_read: true,
      public_contract_freeze_requires_no_chatgpt_final_output_text_read: true,
      public_contract_freeze_requires_no_final_closure_index_read_for_text: true,
      public_contract_freeze_requires_no_live_acceptance_as_final_output: true,
      public_contract_freeze_requires_no_handoff_surface_as_output: true,
      public_contract_freeze_requires_no_real_entry_surface_as_output: true,
      public_contract_freeze_requires_no_hard_seal_surface_as_story_text: true,
      public_contract_freeze_requires_no_recomposition: true,
      public_contract_freeze_requires_no_fallback: true,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_read_chatgpt_final_output_text: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
    };
  }

  let operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke;
  try {
    operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke =
      buildChatgptOperatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
        chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
        chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
        chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
        chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke:
          operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
        chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal:
          operatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
        chatgpt_operator_compact_diagnostics_public_contract_freeze:
          operatorCompactDiagnosticsPublicContractFreeze,
        result: surfacedResult,
      });
  } catch (error) {
    operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke = {
      used: true,
      phase: "36L",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_public_contract_final_live_extraction_smoke",
      version: "chatgpt_bridge_operator_compact_diagnostics_public_contract_final_live_extraction_smoke_v1",
      contract_valid: false,
      validation_errors: [
        "public_contract_final_live_extraction_smoke_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_public_contract_final_live_extraction_invalid",
      response_kind: "operator_compact_diagnostics_public_contract_final_live_extraction_invalid_reference",
      final_live_extraction_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_public_contract_freeze.public_contract_sealed_operator_message_text",
      blocked: true,
      blocked_reason: "public_contract_final_live_extraction_smoke_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      public_contract_final_live_extraction_is_reference_only: true,
      public_contract_final_live_extraction_adds_output_layer: false,
      public_contract_final_live_extraction_must_not_replace_final_output: true,
      public_contract_final_live_extraction_requires_no_result_read: true,
      public_contract_final_live_extraction_requires_no_chatgpt_final_output_text_read: true,
      public_contract_final_live_extraction_requires_no_final_closure_index_read_for_text: true,
      public_contract_final_live_extraction_requires_no_live_acceptance_as_final_output: true,
      public_contract_final_live_extraction_requires_no_handoff_surface_as_output: true,
      public_contract_final_live_extraction_requires_no_real_entry_surface_as_output: true,
      public_contract_final_live_extraction_requires_no_hard_seal_surface_as_story_text: true,
      public_contract_final_live_extraction_requires_no_public_freeze_surface_as_story_text: true,
      public_contract_final_live_extraction_requires_no_recomposition: true,
      public_contract_final_live_extraction_requires_no_fallback: true,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_read_chatgpt_final_output_text: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
    };
  }


  let operatorCompactDiagnosticsFinalEmissionOperatorChecklist;
  try {
    operatorCompactDiagnosticsFinalEmissionOperatorChecklist =
      buildChatgptOperatorCompactDiagnosticsFinalEmissionOperatorChecklist({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
        chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
        chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
        chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
        chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke:
          operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
        chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal:
          operatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
        chatgpt_operator_compact_diagnostics_public_contract_freeze:
          operatorCompactDiagnosticsPublicContractFreeze,
        chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke:
          operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke,
        result: surfacedResult,
      });
  } catch (error) {
    const invalidText = [
      "ChatGPT final emission operator checklist invalid.",
      "blocked_stage: operator_compact_diagnostics_final_emission_operator_checklist",
      "operator_action: inspect_phase36l_public_contract_final_live_extraction_smoke",
    ].join("\n");
    operatorCompactDiagnosticsFinalEmissionOperatorChecklist = {
      used: true,
      phase: "36M",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_final_emission_operator_checklist",
      version: "chatgpt_bridge_operator_compact_diagnostics_final_emission_operator_checklist_v1",
      contract_valid: false,
      validation_errors: [
        "final_emission_operator_checklist_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_final_emission_operator_checklist_invalid",
      response_kind: "operator_compact_diagnostics_final_emission_operator_checklist_invalid_reference",
      final_emission_operator_checklist_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke.live_extracted_operator_message_text",
      blocked: true,
      blocked_reason: "final_emission_operator_checklist_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      final_emission_operator_checklist_message_text: invalidText,
      final_emission_operator_checklist_message_hash: sha256(invalidText),
      final_emission_operator_checklist_message_source:
        "operator_compact_diagnostics_final_emission_operator_checklist.invalid_notice",
      final_emission_operator_checklist_is_reference_only: true,
      final_emission_operator_checklist_adds_output_layer: false,
      final_emission_operator_checklist_must_not_replace_final_output: true,
      final_emission_operator_checklist_requires_no_result_read: true,
      final_emission_operator_checklist_requires_no_chatgpt_final_output_text_read: true,
      final_emission_operator_checklist_requires_no_final_closure_index_read_for_text: true,
      final_emission_operator_checklist_requires_no_live_acceptance_as_final_output: true,
      final_emission_operator_checklist_requires_no_handoff_surface_as_output: true,
      final_emission_operator_checklist_requires_no_real_entry_surface_as_output: true,
      final_emission_operator_checklist_requires_no_hard_seal_surface_as_story_text: true,
      final_emission_operator_checklist_requires_no_public_freeze_surface_as_story_text: true,
      final_emission_operator_checklist_requires_no_final_live_extraction_surface_as_story_text: true,
      final_emission_operator_checklist_requires_no_recomposition: true,
      final_emission_operator_checklist_requires_no_fallback: true,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_read_chatgpt_final_output_text: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
    };
  }


  let operatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke;
  try {
    operatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke =
      buildChatgptOperatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
        chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
        chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
        chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
        chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke:
          operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
        chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal:
          operatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
        chatgpt_operator_compact_diagnostics_public_contract_freeze:
          operatorCompactDiagnosticsPublicContractFreeze,
        chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke:
          operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke,
        chatgpt_operator_compact_diagnostics_final_emission_operator_checklist:
          operatorCompactDiagnosticsFinalEmissionOperatorChecklist,
        result: surfacedResult,
      });
  } catch (error) {
    const invalidText = [
      "ChatGPT live MCP final emission contract smoke invalid.",
      "blocked_stage: operator_compact_diagnostics_live_mcp_final_emission_contract_smoke",
      "operator_action: inspect_phase36m_final_emission_operator_checklist",
    ].join("\n");
    operatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke = {
      used: true,
      phase: "37A",
      surface_kind: "chatgpt_bridge_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke",
      version: "chatgpt_bridge_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke_v1",
      contract_valid: false,
      validation_errors: [
        "live_mcp_final_emission_contract_smoke_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_live_mcp_final_emission_contract_invalid",
      response_kind: "operator_compact_diagnostics_live_mcp_final_emission_contract_invalid_reference",
      live_mcp_final_emission_contract_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_final_emission_operator_checklist.final_emission_operator_checklist_message_text",
      blocked: true,
      blocked_reason: "live_mcp_final_emission_contract_smoke_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      live_mcp_final_emission_contract_message_text: invalidText,
      live_mcp_final_emission_contract_message_hash: sha256(invalidText),
      live_mcp_final_emission_contract_message_source:
        "operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.invalid_notice",
      live_mcp_final_emission_contract_is_reference_only: true,
      live_mcp_final_emission_contract_adds_output_layer: false,
      live_mcp_final_emission_contract_must_not_replace_final_output: true,
      live_mcp_final_emission_contract_requires_no_result_read: true,
      live_mcp_final_emission_contract_requires_no_chatgpt_final_output_text_read: true,
      live_mcp_final_emission_contract_requires_no_final_live_extraction_surface_as_story_text: true,
      live_mcp_final_emission_contract_requires_no_final_emission_operator_checklist_surface_as_story_text: true,
      live_mcp_final_emission_contract_requires_no_recomposition: true,
      live_mcp_final_emission_contract_requires_no_fallback: true,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_read_chatgpt_final_output_text: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
    };
  }

  let operatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal;
  try {
    operatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal =
      buildChatgptOperatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal({
        ok: result?.ok !== false,
        tool_name: toolName,
        permission,
        chatgpt_final_output: chatgptFinalOutput,
        chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
        chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
        chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
        chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
        chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
        chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist:
          operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
        chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke:
          operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
        chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal:
          operatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
        chatgpt_operator_compact_diagnostics_public_contract_freeze:
          operatorCompactDiagnosticsPublicContractFreeze,
        chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke:
          operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke,
        chatgpt_operator_compact_diagnostics_final_emission_operator_checklist:
          operatorCompactDiagnosticsFinalEmissionOperatorChecklist,
        chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke:
          operatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke,
        result: surfacedResult,
      });
  } catch (error) {
    const invalidText = [
      "ChatGPT real ChatGPT live MCP final emission operator extraction consumer hard seal invalid.",
      "blocked_stage: operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal",
      "operator_action: inspect_phase37a_live_mcp_final_emission_contract_smoke",
    ].join("\n");
    operatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal = {
      used: true,
      phase: "37B",
      surface_kind:
        "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal",
      version:
        "chatgpt_bridge_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_v1",
      contract_valid: false,
      validation_errors: [
        "real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_builder_threw",
        String(error?.message ?? error),
      ],
      status: "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_invalid",
      response_kind:
        "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_invalid_reference",
      real_chatgpt_live_mcp_operator_extraction_required_read_field:
        "tool_response.chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke.live_mcp_final_emission_contract_message_text",
      blocked: true,
      blocked_reason: "real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal_builder_threw",
      can_emit_operator_message: false,
      can_output_to_chat: false,
      may_output_story_text: false,
      must_not_output_candidate: true,
      real_chatgpt_live_mcp_operator_extraction_message_text: invalidText,
      real_chatgpt_live_mcp_operator_extraction_message_hash: sha256(invalidText),
      real_chatgpt_live_mcp_operator_extraction_message_source:
        "operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal.invalid_notice",
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_is_reference_only: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_adds_output_layer: false,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_must_not_replace_final_output: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_live_mcp_final_emission_contract: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_result_read: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_chatgpt_final_output_text_read: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_phase36l_direct_read: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_phase36m_direct_read: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_recomposition: true,
      real_chatgpt_live_mcp_operator_extraction_consumer_hard_seal_requires_no_fallback: true,
      no_new_output_layer: true,
      no_extra_text: true,
      no_fallback: true,
      may_rewrite: false,
      may_summarize: false,
      may_include_extra_explanation: false,
      may_construct_response: false,
      may_read_tool_response_result: false,
      may_read_chatgpt_final_output_text: false,
      may_read_phase36m_final_emission_operator_checklist_message_text: false,
      may_save_candidate: false,
      may_approve_candidate: false,
      may_adopt_candidate: false,
      may_update_canon: false,
      may_update_active_engine: false,
    };
  }

  return {
    ok: result?.ok !== false,
    tool_name: toolName,
    permission,
    chatgpt_final_output: chatgptFinalOutput,
    chatgpt_operator_compact_diagnostics: operatorCompactDiagnostics,
    chatgpt_operator_compact_diagnostics_consumer: operatorCompactDiagnosticsConsumer,
    chatgpt_operator_compact_diagnostics_final_closure_index: operatorCompactDiagnosticsFinalClosure,
    chatgpt_operator_compact_diagnostics_live_tool_call_acceptance_smoke: operatorCompactDiagnosticsLiveAcceptance,
    chatgpt_operator_compact_diagnostics_runtime_final_seal: operatorCompactDiagnosticsRuntimeFinalSeal,
    chatgpt_operator_compact_diagnostics_operator_handoff_final_checklist: operatorCompactDiagnosticsOperatorHandoffFinalChecklist,
    chatgpt_operator_compact_diagnostics_real_chatgpt_writing_entry_smoke: operatorCompactDiagnosticsRealChatgptWritingEntrySmoke,
    chatgpt_operator_compact_diagnostics_final_operator_emission_hard_seal: operatorCompactDiagnosticsFinalOperatorEmissionHardSeal,
    chatgpt_operator_compact_diagnostics_public_contract_freeze: operatorCompactDiagnosticsPublicContractFreeze,
    chatgpt_operator_compact_diagnostics_public_contract_final_live_extraction_smoke: operatorCompactDiagnosticsPublicContractFinalLiveExtractionSmoke,
    chatgpt_operator_compact_diagnostics_final_emission_operator_checklist: operatorCompactDiagnosticsFinalEmissionOperatorChecklist,
    chatgpt_operator_compact_diagnostics_live_mcp_final_emission_contract_smoke: operatorCompactDiagnosticsLiveMcpFinalEmissionContractSmoke,
    chatgpt_operator_compact_diagnostics_real_chatgpt_live_mcp_final_emission_operator_extraction_consumer_hard_seal:
      operatorCompactDiagnosticsRealChatgptLiveMcpFinalEmissionOperatorExtractionConsumerHardSeal,
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


