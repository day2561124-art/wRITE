import { createHash } from "node:crypto";

export const foreshadowingPayoffAcceptanceGateVersion = "foreshadowing_payoff_acceptance_gate_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function boolEnabled(value) {
  if (value === true) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function shouldUseForeshadowingPayoffAcceptanceGate(rawInput = {}, options = {}) {
  return rawInput.include_foreshadowing_payoff_acceptance_gate === true
    || rawInput.includeForeshadowingPayoffAcceptanceGate === true
    || boolEnabled(options.foreshadowingPayoffAcceptanceGate)
    || boolEnabled(options.foreshadowing_payoff_acceptance_gate);
}

function disabledContext(status = "disabled") {
  return {
    used: false,
    phase: "27D",
    version: foreshadowingPayoffAcceptanceGateVersion,
    status,
    readiness_status: "not_evaluated",
    can_enter_adoption_review: false,
    requires_human_approval: true,
    direct_adoption_allowed: false,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    checks: {},
    blocking_reasons: [],
    advisory_reasons: [],
    warnings: [],
  };
}

function sourceConfig(rawInput = {}, options = {}) {
  return object(
    options.foreshadowingPayoffAcceptanceGate
      ?? options.foreshadowing_payoff_acceptance_gate
      ?? rawInput.foreshadowing_payoff_acceptance_gate
      ?? rawInput.foreshadowingPayoffAcceptanceGate
      ?? {},
  );
}

function sourceFrom(rawInput, options, config, snake, camel) {
  return object(config[snake] ?? config[camel] ?? options[camel] ?? options[snake] ?? rawInput[snake] ?? rawInput[camel]);
}

function count(value) {
  return array(value).length;
}

function buildChecks(causalGraph, payoffGuard, repairPlanner) {
  const fakePayoffCount = count(payoffGuard.fake_payoffs);
  const unpaidDebtCount = count(payoffGuard.unpaid_required_debts);
  const unresolvedPromiseCount = count(payoffGuard.unresolved_promises);
  const blockingRepairTaskCount = array(repairPlanner.repair_tasks)
    .filter((task) => object(task).severity === "blocking").length;
  return {
    causal_graph_used: causalGraph.used === true,
    payoff_guard_used: payoffGuard.used === true,
    payoff_guard_passed:
      payoffGuard.used === true
      && payoffGuard.blocking !== true
      && fakePayoffCount === 0
      && unpaidDebtCount === 0,
    repair_planner_used: repairPlanner.used === true,
    repair_planner_clear:
      repairPlanner.used !== true
      || (
        repairPlanner.revision_required !== true
        && blockingRepairTaskCount === 0
        && repairPlanner.status !== "needs_revision"
      ),
    fake_payoff_count: fakePayoffCount,
    unpaid_required_debt_count: unpaidDebtCount,
    unresolved_promise_count: unresolvedPromiseCount,
    blocking_repair_task_count: blockingRepairTaskCount,
  };
}

function buildDecision(checks, causalGraph, payoffGuard, repairPlanner) {
  const blocking = [];
  const advisory = [];

  if (checks.payoff_guard_used !== true) {
    blocking.push("foreshadowing_payoff_guard_not_run");
  }
  if (payoffGuard.blocking === true) {
    blocking.push("foreshadowing_payoff_guard_blocking");
  }
  if (checks.fake_payoff_count > 0) {
    blocking.push("fake_payoffs_present");
  }
  if (checks.unpaid_required_debt_count > 0) {
    blocking.push("unpaid_required_debts_present");
  }
  if (repairPlanner.used === true && repairPlanner.revision_required === true) {
    blocking.push("foreshadowing_payoff_repair_revision_required");
  }
  if (checks.blocking_repair_task_count > 0) {
    blocking.push("blocking_payoff_repair_tasks_present");
  }
  if (repairPlanner.used === true && repairPlanner.status === "needs_revision") {
    blocking.push("foreshadowing_payoff_repair_planner_needs_revision");
  }

  if (causalGraph.used !== true) {
    advisory.push("foreshadowing_causal_graph_not_run");
  }
  if (repairPlanner.used !== true) {
    advisory.push("foreshadowing_payoff_repair_planner_not_run");
  }
  if (checks.unresolved_promise_count > 0) {
    advisory.push("unresolved_promises_still_visible");
  }

  const uniqueBlocking = [...new Set(blocking)];
  const uniqueAdvisory = [...new Set(advisory)];
  return {
    blocking_reasons: uniqueBlocking,
    advisory_reasons: uniqueAdvisory,
    can_enter_adoption_review: uniqueBlocking.length === 0,
    readiness_status: uniqueBlocking.length === 0
      ? "ready_for_adoption_review"
      : "blocked",
  };
}

export async function buildForeshadowingPayoffAcceptanceGateContext(rawInput = {}, options = {}) {
  if (!shouldUseForeshadowingPayoffAcceptanceGate(rawInput, options)) return disabledContext();

  const config = sourceConfig(rawInput, options);
  const causalGraph = sourceFrom(rawInput, options, config, "foreshadowing_causal_graph", "foreshadowingCausalGraph");
  const payoffGuard = sourceFrom(rawInput, options, config, "foreshadowing_payoff_guard", "foreshadowingPayoffGuard");
  const repairPlanner = sourceFrom(rawInput, options, config, "foreshadowing_payoff_repair_planner", "foreshadowingPayoffRepairPlanner");

  const checks = buildChecks(causalGraph, payoffGuard, repairPlanner);
  const decision = buildDecision(checks, causalGraph, payoffGuard, repairPlanner);
  const warnings = decision.blocking_reasons.length
    ? ["foreshadowing_payoff_acceptance_blocked", ...decision.blocking_reasons]
    : [];

  const gate = {
    used: true,
    phase: "27D",
    version: foreshadowingPayoffAcceptanceGateVersion,
    status: decision.can_enter_adoption_review ? "passed" : "blocked",
    readiness_status: decision.readiness_status,
    can_enter_adoption_review: decision.can_enter_adoption_review,
    requires_human_approval: true,
    direct_adoption_allowed: false,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    checks,
    blocking_reasons: decision.blocking_reasons,
    advisory_reasons: decision.advisory_reasons,
    adoption_readiness_contract: {
      scope: "foreshadowing_payoff_only",
      ready_does_not_mean_direct_adoption: true,
      approval_queue_still_required: true,
      canon_update_allowed: false,
      active_engine_update_allowed: false,
    },
    provider_contract: {
      candidate_proof_report_key: "foreshadowing_payoff_acceptance_gate",
      pipeline_report_key: "foreshadowing_payoff_acceptance_gate",
      candidate_report_key: "foreshadowing_payoff_acceptance_gate",
    },
    warnings,
  };

  gate.trace_id = `foreshadowing_payoff_acceptance_${sha256(JSON.stringify({
    status: gate.status,
    checks: gate.checks,
    blocking_reasons: gate.blocking_reasons,
    advisory_reasons: gate.advisory_reasons,
  })).slice(0, 16)}`;
  return gate;
}

export default buildForeshadowingPayoffAcceptanceGateContext;
