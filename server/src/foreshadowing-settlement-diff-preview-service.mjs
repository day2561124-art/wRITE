import { createHash } from "node:crypto";

export const foreshadowingSettlementDiffPreviewVersion = "foreshadowing_settlement_diff_preview_v1";

const TRUE_PAYOFF_TYPES = new Set([
  "action",
  "cost",
  "reveal",
  "changed_state",
  "irreversible_consequence",
  "route_loss",
  "relationship_shift",
  "knowledge_boundary_change",
  "tactical_state_change",
]);

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, maximum = 600) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function boolEnabled(value) {
  if (value === true) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function shouldUseForeshadowingSettlementDiffPreview(rawInput = {}, options = {}) {
  return rawInput.include_foreshadowing_settlement_diff_preview === true
    || rawInput.includeForeshadowingSettlementDiffPreview === true
    || boolEnabled(options.foreshadowingSettlementDiffPreview)
    || boolEnabled(options.foreshadowing_settlement_diff_preview);
}

function disabledContext(status = "disabled") {
  return {
    used: false,
    phase: "27E",
    version: foreshadowingSettlementDiffPreviewVersion,
    status,
    preview_only: true,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    settlement_diff_preview: {
      paid_foreshadowing_debts: [],
      kept_open_debts: [],
      blocked_canon_intake_items: [],
      allowed_candidate_settlement_items: [],
    },
    canon_intake_preview: {
      allowed: false,
      direct_canon_write_allowed: false,
      requires_settlement_review: true,
      notes: [],
    },
    warnings: [],
  };
}

function sourceConfig(rawInput = {}, options = {}) {
  return object(
    options.foreshadowingSettlementDiffPreview
      ?? options.foreshadowing_settlement_diff_preview
      ?? rawInput.foreshadowing_settlement_diff_preview
      ?? rawInput.foreshadowingSettlementDiffPreview
      ?? {},
  );
}

function sourceFrom(rawInput, options, config, snake, camel) {
  return object(config[snake] ?? config[camel] ?? options[camel] ?? options[snake] ?? rawInput[snake] ?? rawInput[camel]);
}

function debtIdOf(value) {
  const item = object(value);
  return text(item.debt_id ?? item.debtId ?? item.target_debt_id ?? item.targetDebtId ?? item.id, 160);
}

function payoffTypesOf(value) {
  const item = object(value);
  return array(item.payoff_types ?? item.payoffTypes ?? item.types)
    .map((entry) => text(entry, 120))
    .filter(Boolean);
}

function hasTruePayoffMotion(payoff) {
  const item = object(payoff);
  const types = payoffTypesOf(item);
  const hasTrueType = types.some((type) => TRUE_PAYOFF_TYPES.has(type));
  const hasConsequence = Boolean(text(
    item.consequence
      ?? item.changed_state
      ?? item.changedState
      ?? item.state_change_summary
      ?? item.stateChangeSummary,
    400,
  ));
  return hasTrueType && hasConsequence;
}

function uniqueByPayoffIdentity(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = [
      item.debt_id || "",
      item.promise_id || "",
      item.id || "",
      item.consequence || "",
      (item.payoff_types ?? []).join("|"),
    ].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function graphDebts(causalGraph) {
  const graph = object(causalGraph.graph ?? causalGraph);
  const debts = array(graph.debts ?? graph.foreshadowing_debts ?? causalGraph.debts ?? causalGraph.foreshadowing_debts);
  return debts.map((entry, index) => {
    const item = object(entry);
    return {
      id: text(item.id ?? item.debt_id ?? item.debtId, 160) || `debt_${index + 1}`,
      label: text(item.label ?? item.name ?? item.promise ?? item.summary, 240),
      status: text(item.status, 120),
      promise: text(item.promise ?? item.reader_promise ?? item.readerPromise, 420),
    };
  });
}

function detectedTruePayoffs(payoffGuard) {
  const normalized = array(payoffGuard.detected_payoffs ?? payoffGuard.payoffs ?? payoffGuard.true_payoffs)
    .filter((payoff) => {
      const item = object(payoff);
      if (item.classification === "true_payoff" || item.verdict === "true_payoff" || item.true_payoff === true) return true;
      return hasTruePayoffMotion(item);
    })
    .map((payoff, index) => {
      const item = object(payoff);
      return {
        id: text(item.id ?? item.payoff_id ?? item.payoffId, 160) || `payoff_${index + 1}`,
        debt_id: debtIdOf(item),
        promise_id: text(item.promise_id ?? item.promiseId, 160),
        payoff_types: payoffTypesOf(item),
        consequence: text(
          item.consequence
            ?? item.changed_state
            ?? item.changedState
            ?? item.state_change_summary
            ?? item.stateChangeSummary,
          420,
        ),
        source: "foreshadowing_payoff_guard",
      };
    });
  return uniqueByPayoffIdentity(normalized);
}

function fakePayoffItems(payoffGuard) {
  return array(payoffGuard.fake_payoffs).map((entry, index) => {
    const item = object(entry);
    return {
      id: text(item.id ?? item.payoff_id ?? item.payoffId, 160) || `fake_payoff_${index + 1}`,
      debt_id: debtIdOf(item),
      reason: text(item.rejection_reason ?? item.rejectionReason ?? item.issue, 180) || "fake_payoff",
      summary: text(item.summary ?? item.description, 420),
    };
  });
}

function unpaidDebtItems(payoffGuard) {
  return array(payoffGuard.unpaid_required_debts).map((entry, index) => {
    const item = object(entry);
    return {
      id: text(item.id ?? item.debt_id ?? item.debtId, 160) || `unpaid_debt_${index + 1}`,
      label: text(item.label ?? item.name ?? item.promise, 240),
      reason: "unpaid_required_debt",
      promise: text(item.promise ?? item.reader_promise ?? item.readerPromise, 420),
    };
  });
}

function unresolvedPromiseItems(payoffGuard) {
  return array(payoffGuard.unresolved_promises).map((entry, index) => {
    const item = object(entry);
    return {
      id: text(item.id ?? item.promise_id ?? item.promiseId, 160) || `unresolved_promise_${index + 1}`,
      reason: "unresolved_promise",
      promise: text(item.promise ?? item.label ?? item.name, 420),
    };
  });
}

function buildSettlementDiffPreview(causalGraph, payoffGuard, repairPlanner, acceptanceGate) {
  const truePayoffs = detectedTruePayoffs(payoffGuard);
  const trueDebtIds = new Set(truePayoffs.map((item) => item.debt_id).filter(Boolean));
  const debts = graphDebts(causalGraph);
  const fakeItems = fakePayoffItems(payoffGuard);
  const unpaidItems = unpaidDebtItems(payoffGuard);
  const unresolvedItems = unresolvedPromiseItems(payoffGuard);
  const repairTasks = array(repairPlanner.repair_tasks).map((entry, index) => {
    const item = object(entry);
    return {
      id: text(item.id, 180) || `repair_task_${index + 1}`,
      reason: text(item.issue, 180) || "repair_task",
      debt_id: text(item.debt_id, 160),
      severity: text(item.severity, 120),
    };
  });
  const paid = truePayoffs.map((payoff) => {
    const debt = debts.find((item) => item.id === payoff.debt_id) ?? {};
    return {
      debt_id: payoff.debt_id || null,
      promise_id: payoff.promise_id || null,
      label: debt.label ?? "",
      payoff_id: payoff.id,
      payoff_types: payoff.payoff_types,
      consequence: payoff.consequence,
      settlement_action: "mark_paid_in_candidate_settlement_preview",
      canon_write_allowed: false,
      requires_settlement_review: true,
    };
  });
  const keptOpen = [
    ...debts
      .filter((debt) => !trueDebtIds.has(debt.id))
      .map((debt) => ({
        debt_id: debt.id,
        label: debt.label,
        reason: debt.status === "payoff_ready" ? "not_paid_in_candidate" : "still_open",
        promise: debt.promise,
        settlement_action: "keep_open",
      })),
    ...unpaidItems.map((item) => ({
      debt_id: item.id,
      label: item.label,
      reason: item.reason,
      promise: item.promise,
      settlement_action: "keep_open",
    })),
  ];
  const blocked = [
    ...fakeItems.map((item) => ({
      source_type: "fake_payoff",
      id: item.id,
      debt_id: item.debt_id,
      reason: item.reason,
      summary: item.summary,
      canon_intake_allowed: false,
    })),
    ...repairTasks
      .filter((item) => item.severity === "blocking")
      .map((item) => ({
        source_type: "repair_task",
        id: item.id,
        debt_id: item.debt_id,
        reason: item.reason,
        canon_intake_allowed: false,
      })),
    ...unresolvedItems.map((item) => ({
      source_type: "unresolved_promise",
      id: item.id,
      reason: item.reason,
      promise: item.promise,
      canon_intake_allowed: false,
    })),
  ];
  if (acceptanceGate.used === true && acceptanceGate.can_enter_adoption_review !== true) {
    blocked.push({
      source_type: "acceptance_gate",
      id: "foreshadowing_payoff_acceptance_gate",
      reason: "not_ready_for_adoption_review",
      blocking_reasons: acceptanceGate.blocking_reasons ?? [],
      canon_intake_allowed: false,
    });
  }
  return {
    paid_foreshadowing_debts: paid,
    kept_open_debts: keptOpen,
    blocked_canon_intake_items: blocked,
    allowed_candidate_settlement_items: paid.map((item) => ({
      type: "foreshadowing_payoff_paid",
      debt_id: item.debt_id,
      payoff_id: item.payoff_id,
      requires_settlement_review: true,
      canon_write_allowed: false,
    })),
  };
  return uniqueByPayoffIdentity(normalized);
}

export async function buildForeshadowingSettlementDiffPreviewContext(rawInput = {}, options = {}) {
  if (!shouldUseForeshadowingSettlementDiffPreview(rawInput, options)) return disabledContext();

  const config = sourceConfig(rawInput, options);
  const causalGraph = sourceFrom(rawInput, options, config, "foreshadowing_causal_graph", "foreshadowingCausalGraph");
  const payoffGuard = sourceFrom(rawInput, options, config, "foreshadowing_payoff_guard", "foreshadowingPayoffGuard");
  const repairPlanner = sourceFrom(rawInput, options, config, "foreshadowing_payoff_repair_planner", "foreshadowingPayoffRepairPlanner");
  const acceptanceGate = sourceFrom(rawInput, options, config, "foreshadowing_payoff_acceptance_gate", "foreshadowingPayoffAcceptanceGate");
  const preview = buildSettlementDiffPreview(causalGraph, payoffGuard, repairPlanner, acceptanceGate);
  const blocked = preview.blocked_canon_intake_items.length > 0;
  const warnings = [];
  if (blocked) warnings.push("foreshadowing_settlement_canon_intake_blocked_items_present");
  if (preview.paid_foreshadowing_debts.length === 0) warnings.push("foreshadowing_settlement_no_paid_debts_detected");

  const result = {
    used: true,
    phase: "27E",
    version: foreshadowingSettlementDiffPreviewVersion,
    status: blocked ? "blocked_preview" : "preview_ready",
    preview_only: true,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    settlement_diff_preview: preview,
    canon_intake_preview: {
      allowed: false,
      direct_canon_write_allowed: false,
      requires_settlement_review: true,
      ready_for_human_review: !blocked,
      notes: [
        "This preview may be used to prepare settlement review only.",
        "It must not directly update Canon DB or active_engine.",
      ],
    },
    provider_contract: {
      settlement_report_key: "foreshadowing_settlement_diff_preview",
      pipeline_report_key: "foreshadowing_settlement_diff_preview",
      candidate_report_key: "foreshadowing_settlement_diff_preview",
    },
    warnings,
  };

  result.trace_id = `foreshadowing_settlement_diff_preview_${sha256(JSON.stringify({
    status: result.status,
    preview: result.settlement_diff_preview,
    warnings,
  })).slice(0, 16)}`;
  return result;
}

export default buildForeshadowingSettlementDiffPreviewContext;
