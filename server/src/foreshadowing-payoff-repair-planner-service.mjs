import { createHash } from "node:crypto";

export const foreshadowingPayoffRepairPlannerVersion = "foreshadowing_payoff_repair_planner_v1";

const DEFAULT_TRUE_PAYOFF_TYPES = [
  "action",
  "cost",
  "changed_state",
  "irreversible_consequence",
];

const REJECTED_FAKE_PAYOFF_TYPES = [
  "fake_payoff",
  "pure_explanation_payoff",
  "decorative_callback",
  "no_consequence_callback",
  "pretty_sentence_callback",
  "promise_without_cost",
  "payoff_without_state_change",
];

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 800) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function list(value, maximum = 16, itemMaximum = 300) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item ?? ""), itemMaximum))
    .filter(Boolean)
    .slice(0, maximum);
}

function boolEnabled(value) {
  if (value === true) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function shouldUseForeshadowingPayoffRepairPlanner(rawInput = {}, options = {}) {
  return rawInput.include_foreshadowing_payoff_repair_planner === true
    || rawInput.includeForeshadowingPayoffRepairPlanner === true
    || boolEnabled(options.foreshadowingPayoffRepairPlanner)
    || boolEnabled(options.foreshadowing_payoff_repair_planner);
}

function disabledContext(status = "disabled") {
  return {
    used: false,
    phase: "27C",
    version: foreshadowingPayoffRepairPlannerVersion,
    status,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    revision_required: false,
    repair_tasks: [],
    revision_plan_patch: null,
    final_polisher_guidance: null,
    provider_guidance: null,
    warnings: [],
  };
}

function sourceConfig(rawInput = {}, options = {}) {
  return object(
    options.foreshadowingPayoffRepairPlanner
      ?? options.foreshadowing_payoff_repair_planner
      ?? rawInput.foreshadowing_payoff_repair_planner
      ?? rawInput.foreshadowingPayoffRepairPlanner
      ?? {},
  );
}

function sourceGuard(rawInput = {}, options = {}, config = {}) {
  return object(
    config.foreshadowing_payoff_guard
      ?? config.foreshadowingPayoffGuard
      ?? options.foreshadowingPayoffGuard
      ?? options.foreshadowing_payoff_guard
      ?? rawInput.foreshadowing_payoff_guard
      ?? rawInput.foreshadowingPayoffGuard
      ?? {},
  );
}

function normalizeDebt(entry, index) {
  const raw = object(entry);
  return {
    id: text(raw.id ?? raw.debt_id ?? raw.debtId ?? raw.key, 160) || `debt_${index + 1}`,
    label: text(raw.label ?? raw.name ?? raw.promise ?? raw.id, 260),
    promise: text(raw.promise ?? raw.reader_promise ?? raw.readerPromise, 420),
    payoff_requirements: list(raw.payoff_requirements ?? raw.payoffRequirements, 10, 160),
  };
}

function normalizePromise(entry, index) {
  const raw = object(entry);
  return {
    id: text(raw.id ?? raw.promise_id ?? raw.promiseId ?? raw.key, 160) || `promise_${index + 1}`,
    promise: text(raw.promise ?? raw.label ?? raw.name, 420),
    expected_motion: text(raw.expected_motion ?? raw.expectedMotion, 260),
  };
}

function normalizePayoff(entry, index) {
  const raw = object(entry);
  return {
    id: text(raw.id ?? raw.payoff_id ?? raw.payoffId, 160) || `fake_payoff_${index + 1}`,
    debt_id: text(raw.debt_id ?? raw.debtId ?? raw.target_debt_id ?? raw.targetDebtId, 160),
    promise_id: text(raw.promise_id ?? raw.promiseId ?? raw.target_promise_id ?? raw.targetPromiseId, 160),
    summary: text(raw.summary ?? raw.description, 500),
    payoff_types: list(raw.payoff_types ?? raw.payoffTypes ?? raw.types, 12, 120),
    rejected_payoff_types: list(raw.rejected_payoff_types ?? raw.rejectedPayoffTypes, 12, 120),
    rejection_reason: text(raw.rejection_reason ?? raw.rejectionReason, 120),
    consequence: text(
      raw.consequence
        ?? raw.changed_state
        ?? raw.changedState
        ?? raw.state_change_summary
        ?? raw.stateChangeSummary,
      420,
    ),
  };
}

function requiredPayoffTypes(debt = {}, promise = {}, fallback = DEFAULT_TRUE_PAYOFF_TYPES) {
  const fromDebt = list(debt.payoff_requirements ?? debt.payoffRequirements, 8, 120);
  const fromPromise = text(promise.expected_motion ?? promise.expectedMotion, 200)
    ? ["changed_state"]
    : [];
  const merged = [...new Set([...fromDebt, ...fromPromise, ...fallback])];
  return merged.slice(0, 8);
}

function taskId(prefix, source) {
  return `${prefix}_${sha256(JSON.stringify(source)).slice(0, 12)}`;
}

function buildFakePayoffTask(payoff, guard) {
  const debts = Array.isArray(guard.unpaid_required_debts) ? guard.unpaid_required_debts.map(normalizeDebt) : [];
  const promises = Array.isArray(guard.unresolved_promises) ? guard.unresolved_promises.map(normalizePromise) : [];
  const debt = debts.find((item) => item.id === payoff.debt_id) ?? {};
  const promise = promises.find((item) => item.id === payoff.promise_id) ?? {};
  const reason = payoff.rejection_reason
    || payoff.rejected_payoff_types[0]
    || payoff.payoff_types.find((type) => REJECTED_FAKE_PAYOFF_TYPES.includes(type))
    || "fake_payoff";
  const requiredTypes = requiredPayoffTypes(debt, promise);
  return {
    id: taskId("repair_fake_payoff", payoff),
    source_type: "fake_payoff",
    severity: "blocking",
    debt_id: payoff.debt_id || debt.id || null,
    promise_id: payoff.promise_id || promise.id || null,
    issue: reason,
    source_payoff_id: payoff.id,
    source_summary: payoff.summary,
    required_true_payoff_types: requiredTypes,
    repair_action: "replace_fake_callback_with_scene_consequence",
    repair_instruction:
      "Replace the decorative or explanation-only callback with an observable scene event that changes the tactical, relational, knowledge, route, cost, or world state.",
    required_scene_motion: [
      "show a concrete character action",
      "make the action cost something or close a route",
      "state the changed condition through event outcome rather than explanation",
    ],
    acceptance_criteria: [
      "candidate text contains a concrete event, not only interpretation",
      "payoff entry includes at least one true payoff type",
      "payoff entry includes a consequence or changed_state summary",
      "the previous fake callback is no longer the only payoff evidence",
    ],
    prohibited_fix: [
      "do not solve by adding a beautiful sentence only",
      "do not solve by having a character merely say they understand",
      "do not change canon or active_engine",
    ],
  };
}

function buildUnpaidDebtTask(debt) {
  const requiredTypes = requiredPayoffTypes(debt, {});
  return {
    id: taskId("repair_unpaid_debt", debt),
    source_type: "unpaid_required_debt",
    severity: "blocking",
    debt_id: debt.id,
    promise_id: null,
    issue: "payable_foreshadowing_debt_unpaid",
    source_summary: debt.promise || debt.label,
    required_true_payoff_types: requiredTypes,
    repair_action: "create_missing_payoff_scene_motion",
    repair_instruction:
      "Add or rewrite scene motion so this payable foreshadowing debt produces a concrete consequence before the candidate can be considered paid.",
    required_scene_motion: [
      "identify the debt in scene action",
      "force a cost, reveal, route loss, relationship shift, knowledge-boundary change, or tactical-state change",
      "make the resulting state impossible to ignore in later paragraphs",
    ],
    acceptance_criteria: [
      "the payable debt id is covered by a true payoff entry",
      "the candidate text changes the state connected to the debt",
      "the payoff is not only exposition",
    ],
    prohibited_fix: [
      "do not mark the debt as paid without text evidence",
      "do not update Canon or active_engine",
    ],
  };
}

function buildPromiseTask(promise) {
  return {
    id: taskId("repair_unresolved_promise", promise),
    source_type: "unresolved_chapter_promise",
    severity: "advisory",
    debt_id: null,
    promise_id: promise.id,
    issue: "chapter_promise_unresolved_by_payoff_guard",
    source_summary: promise.promise,
    required_true_payoff_types: ["changed_state", "action"],
    repair_action: "resolve_or_explicitly_defer_chapter_promise",
    repair_instruction:
      "Either pay this chapter promise through concrete state change or explicitly defer it as an open debt without pretending it has been paid.",
    required_scene_motion: [
      "make the promise visibly paid, or mark it as intentionally carried forward",
      "avoid false closure",
    ],
    acceptance_criteria: [
      "promise is not presented as paid unless a consequence exists",
      "deferred promise remains open and visible to later planning",
    ],
    prohibited_fix: [
      "do not hide unresolved promise behind narration",
    ],
  };
}

function buildRepairTasks(guard) {
  const fakePayoffs = Array.isArray(guard.fake_payoffs) ? guard.fake_payoffs.map(normalizePayoff) : [];
  const unpaidDebts = Array.isArray(guard.unpaid_required_debts) ? guard.unpaid_required_debts.map(normalizeDebt) : [];
  const unresolvedPromises = Array.isArray(guard.unresolved_promises) ? guard.unresolved_promises.map(normalizePromise) : [];
  const fakeDebtIds = new Set(fakePayoffs.map((item) => item.debt_id).filter(Boolean));
  const tasks = [
    ...fakePayoffs.map((item) => buildFakePayoffTask(item, guard)),
    ...unpaidDebts
      .filter((debt) => !fakeDebtIds.has(debt.id))
      .map((debt) => buildUnpaidDebtTask(debt, guard)),
    ...unresolvedPromises.map(buildPromiseTask),
  ];
  return tasks.slice(0, 20);
}

function buildRevisionPlanPatch(tasks) {
  const blockingTasks = tasks.filter((task) => task.severity === "blocking");
  return {
    force_revision: blockingTasks.length > 0,
    suggested_return_stage: blockingTasks.length > 0 ? "foreshadowing_payoff_repair" : null,
    preserve_canon_facts: true,
    preserve_character_state: true,
    preserve_timeline: true,
    preserve_candidate_only_scope: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    required_repairs: tasks,
    repair_priority_order: [
      "blocking fake payoff",
      "payable unpaid debt",
      "unresolved chapter promise",
    ],
    must_not_use: REJECTED_FAKE_PAYOFF_TYPES,
    provider_output_expectation: {
      must_return_revised_text: true,
      should_return_foreshadowing_payoffs: true,
      payoff_entries_must_include: [
        "debt_id or promise_id",
        "payoff_types",
        "consequence or changed_state",
      ],
    },
  };
}

function buildFinalPolisherGuidance(tasks) {
  return {
    purpose: "Use the repair planner to turn fake or unpaid foreshadowing payoff into concrete scene consequence.",
    repair_task_ids: tasks.map((task) => task.id),
    reject_if_candidate_still_contains: REJECTED_FAKE_PAYOFF_TYPES,
    accept_only_if: [
      "blocking repair tasks are resolved through concrete action and consequence",
      "payable debt has a true payoff entry",
      "decorative callback is not the only evidence",
    ],
  };
}

function buildProviderContract() {
  return {
    generation_payload_key: "foreshadowing_payoff_repair_planner",
    revision_payload_key: "foreshadowing_payoff_repair_planner",
    final_polisher_payload_key: "foreshadowing_payoff_repair_planner",
    candidate_proof_report_key: "foreshadowing_payoff_repair_planner",
    pipeline_report_key: "foreshadowing_payoff_repair_planner",
    candidate_report_key: "foreshadowing_payoff_repair_planner",
  };
}

export async function buildForeshadowingPayoffRepairPlannerContext(rawInput = {}, options = {}) {
  if (!shouldUseForeshadowingPayoffRepairPlanner(rawInput, options)) return disabledContext();

  const config = sourceConfig(rawInput, options);
  const guard = sourceGuard(rawInput, options, config);
  const tasks = buildRepairTasks(guard);
  const blockingTasks = tasks.filter((task) => task.severity === "blocking");
  const warnings = [];
  if (tasks.length) warnings.push("foreshadowing_payoff_repair_tasks_required");
  if (tasks.some((task) => task.source_type === "fake_payoff")) warnings.push("fake_payoff_repair_required");
  if (tasks.some((task) => task.source_type === "unpaid_required_debt")) warnings.push("unpaid_debt_repair_required");
  if (tasks.some((task) => task.source_type === "unresolved_chapter_promise")) warnings.push("chapter_promise_repair_or_defer_required");

  const planner = {
    used: true,
    phase: "27C",
    version: foreshadowingPayoffRepairPlannerVersion,
    status: tasks.length ? "needs_revision" : "passed",
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    revision_required: blockingTasks.length > 0,
    repair_tasks: tasks,
    blocking_task_ids: blockingTasks.map((task) => task.id),
    revision_plan_patch: buildRevisionPlanPatch(tasks),
    final_polisher_guidance: buildFinalPolisherGuidance(tasks),
    provider_contract: buildProviderContract(),
    warnings,
  };
  planner.provider_guidance = {
    purpose: "Plan actionable revisions for fake or missing foreshadowing payoff.",
    revision_payload_key: "foreshadowing_payoff_repair_planner",
    final_polisher_payload_key: "foreshadowing_payoff_repair_planner",
    required_repairs: tasks.map((task) => ({
      id: task.id,
      issue: task.issue,
      debt_id: task.debt_id,
      promise_id: task.promise_id,
      repair_action: task.repair_action,
      required_true_payoff_types: task.required_true_payoff_types,
    })),
  };
  planner.trace_id = `foreshadowing_payoff_repair_${sha256(JSON.stringify({
    status: planner.status,
    tasks: planner.repair_tasks,
    warnings,
  })).slice(0, 16)}`;
  return planner;
}

export default buildForeshadowingPayoffRepairPlannerContext;
