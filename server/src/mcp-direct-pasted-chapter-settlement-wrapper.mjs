import {
  saveChatgptBridgeSettlementReport as legacySaveSettlementReport,
} from "./chatgpt-bridge-service.mjs";
import {
  finalizePreparedPastedChapter,
  settlePastedChapter,
} from "./direct-pasted-chapter-settlement-service.mjs";
import {
  saveDirectChapterSettlementSummary,
} from "./direct-chapter-settlement-summary-service.mjs";

export const directSettlementEnvelopeMarkers = Object.freeze({
  summary: "[[DIRECT_CHAPTER_SETTLEMENT_SUMMARY]]",
  prepare: "[[DIRECT_PASTED_CHAPTER_SETTLEMENT_PREPARE]]",
  finalize: "[[DIRECT_PASTED_CHAPTER_SETTLEMENT_FINALIZE]]",
});

const directSettlementSafety = Object.freeze({
  bridge_phase: "phase_42a_direct_pasted_chapter_settlement",
  existing_tool_schema_modified: false,
  can_generate_locally: false,
  can_call_external_llm: false,
  can_modify_active_engine: false,
  can_modify_compressed_rules: false,
  can_apply_compressed_rules: false,
  can_activate_engine: false,
  can_approve: false,
  can_confirm_adoption: true,
  can_restore: false,
  can_rollback: false,
  can_execute_cleanup: false,
  direct_pasted_chapter_settlement_allowed: true,
  explicit_user_confirmation_required: true,
});

function parseEnvelope(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/^\uFEFF/u, "");
  for (const [mode, marker] of Object.entries(directSettlementEnvelopeMarkers)) {
    if (!normalized.startsWith(marker)) continue;
    const payload = normalized
      .slice(marker.length)
      .replace(/^\r?\n/u, "");
    return { mode, marker, payload };
  }
  return null;
}

function withSafety(result, envelopeMode) {
  return {
    ...result,
    direct_settlement_envelope_mode: envelopeMode,
    pending_engine_candidate_created:
      result?.pending_engine_candidate_created === true,
    active_engine_modified: false,
    engine_activation_requested: false,
    safety: directSettlementSafety,
  };
}

export async function chatgpt_bridge_save_settlement_report(input = {}, options = {}) {
  const envelope = parseEnvelope(input?.settlement_report_text);
  if (!envelope) {
    return legacySaveSettlementReport(input, options);
  }

  if (!envelope.payload.trim()) {
    throw new Error(`${envelope.mode} direct settlement envelope payload is empty.`);
  }

  if (envelope.mode === "summary") {
    const result = await saveDirectChapterSettlementSummary({
      settlement_summary_text: envelope.payload,
      summary: input.summary,
      source: input.source ?? "chatgpt",
      dry_run:
        input.dry_run === true
        || input.dryRun === true,
    }, options);

    const envelopeResult = withSafety(
      result,
      "summary",
    );

    return {
      ...envelopeResult,
      safety: {
        ...envelopeResult.safety,
        can_confirm_adoption: false,
        direct_pasted_chapter_settlement_allowed: false,
        direct_chapter_summary_settlement_allowed: true,
        full_chapter_persistence_allowed: false,
        writing_candidate_creation_allowed: false,
        pending_engine_candidate_creation_allowed: false,
      },
    };
  }
  if (envelope.mode === "prepare") {
    const result = await settlePastedChapter({
      mode: "prepare",
      chapter_text: envelope.payload,
      user_confirmed_chapter_settlement: true,
      source: input.source ?? "chatgpt",
      include_active_engine: true,
      include_writing_card: true,
      include_proofing_card: true,
      include_longline: true,
      include_foreshadowing_settlement_proposal_bridge: true,
      dry_run: input.dry_run === true,
    }, options);

    return withSafety({
      ...result,
      finalize_call_contract: {
        tool_name: "chatgpt_bridge_save_settlement_report",
        adopted_chapter_id: result.adopted_chapter_id ?? null,
        settlement_context_id: result.settlement_context_id ?? null,
        settlement_report_text_prefix: directSettlementEnvelopeMarkers.finalize,
        instruction:
          "Generate the complete settlement report, prefix settlement_report_text with "
          + `${directSettlementEnvelopeMarkers.finalize} followed by a newline, `
          + "then call this same tool with the returned adopted_chapter_id and settlement_context_id.",
      },
    }, "prepare");
  }

  const result = await finalizePreparedPastedChapter({
    adopted_chapter_id: input.adopted_chapter_id,
    settlement_context_id: input.settlement_context_id,
    settlement_report_text: envelope.payload,
    summary: input.summary,
    reason: input.reason,
    source: input.source ?? "chatgpt",
  }, options);
  return withSafety(result, "finalize");
}
