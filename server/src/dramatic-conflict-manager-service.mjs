import { createHash } from "node:crypto";

export const dramaticConflictManagerVersion = "dramatic_conflict_manager_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function list(value, maximum = 12, itemMaximum = 240) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item ?? ""), itemMaximum))
    .filter(Boolean)
    .slice(0, maximum);
}

function normalizedName(value) {
  return text(value, 120).replace(/\s+/gu, " ");
}

function namesFromValue(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      const entry = object(item);
      return [
        entry.character_name,
        entry.characterName,
        entry.canonical_name,
        entry.name,
        entry.actor,
      ].filter(Boolean);
    });
  }
  return [];
}

function uniqueNames(values, maximum = 24) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const name = normalizedName(value);
    const key = name.toLocaleLowerCase("zh-Hant-TW");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= maximum) break;
  }
  return result;
}

function collectNames(rawInput) {
  const generation = object(rawInput.generation_context ?? rawInput.generationContext);
  const retrieval = object(rawInput.retrieval_context ?? rawInput.retrievalContext);
  const plan = object(rawInput.dramatic_conflict_plan ?? rawInput.dramaticConflictPlan);
  return uniqueNames([
    ...namesFromValue(rawInput.character_names ?? rawInput.characterNames ?? rawInput.characters),
    ...namesFromValue(generation.characters ?? generation.character_names ?? generation.focus_characters),
    ...namesFromValue(retrieval.characters ?? retrieval.character_names),
    ...namesFromValue(plan.characters),
    plan.protagonist,
    plan.opposition,
  ]);
}

function normalizePlan(rawPlan = {}, rawInput = {}) {
  const plan = object(rawPlan);
  const generation = object(rawInput.generation_context ?? rawInput.generationContext);
  const retrieval = object(rawInput.retrieval_context ?? rawInput.retrievalContext);
  const sourcePlan = object(generation.dramatic_conflict_plan ?? generation.dramaticConflictPlan);
  const merged = { ...sourcePlan, ...plan };
  const characters = collectNames({ ...rawInput, dramatic_conflict_plan: merged });
  const protagonist = text(
    merged.protagonist
      ?? merged.primary_actor
      ?? merged.primaryActor
      ?? merged.pov_character
      ?? characters[0],
    120,
  );
  const opposition = text(
    merged.opposition
      ?? merged.antagonist
      ?? merged.blocking_force
      ?? merged.blockingForce
      ?? merged.obstacle_actor
      ?? characters.find((name) => name !== protagonist),
    160,
  );
  return {
    scene_function: text(
      merged.scene_function ?? merged.sceneFunction ?? generation.scene_function ?? generation.scene ?? retrieval.scene_function,
      260,
    ),
    protagonist,
    protagonist_want: text(
      merged.protagonist_want ?? merged.protagonistWant ?? merged.want ?? merged.goal ?? generation.goal,
      260,
    ),
    opposition,
    opposition_pressure: text(
      merged.opposition_pressure ?? merged.oppositionPressure ?? merged.obstacle ?? merged.blocking_force ?? merged.blockingForce,
      300,
    ),
    stakes: text(merged.stakes ?? merged.risk ?? generation.stakes, 300),
    ticking_clock: text(merged.ticking_clock ?? merged.tickingClock ?? merged.deadline, 220),
    escalation_steps: list(merged.escalation_steps ?? merged.escalationSteps, 6, 240),
    reversal_or_reveal: text(
      merged.reversal_or_reveal ?? merged.reversalOrReveal ?? merged.turning_point ?? merged.turningPoint,
      300,
    ),
    required_choice: text(merged.required_choice ?? merged.requiredChoice ?? merged.choice, 260),
    cost_or_payment: text(merged.cost_or_payment ?? merged.costOrPayment ?? merged.cost ?? merged.payment, 260),
    winner: text(merged.winner ?? merged.chapter_winner ?? merged.chapterWinner, 160),
    loser: text(merged.loser ?? merged.chapter_loser ?? merged.chapterLoser, 160),
    new_status_quo: text(
      merged.new_status_quo ?? merged.newStatusQuo ?? merged.ending_state ?? merged.endingState,
      320,
    ),
    ending_hook: text(merged.ending_hook ?? merged.endingHook ?? merged.hook, 260),
    must_not_resolve: list(merged.must_not_resolve ?? merged.mustNotResolve, 8, 220),
    continuity_constraints: list(merged.continuity_constraints ?? merged.continuityConstraints, 8, 240),
    characters,
  };
}

function missingCodes(plan) {
  const missing = [];
  if (!plan.protagonist) missing.push("missing_protagonist");
  if (!plan.protagonist_want) missing.push("missing_protagonist_want");
  if (!plan.opposition && !plan.opposition_pressure) missing.push("missing_opposition");
  if (!plan.stakes) missing.push("missing_stakes");
  if (!plan.reversal_or_reveal && !plan.required_choice) missing.push("missing_turning_point_or_choice");
  if (!plan.cost_or_payment) missing.push("missing_cost_or_payment");
  if (!plan.new_status_quo && !plan.ending_hook) missing.push("missing_new_status_quo_or_hook");
  return missing;
}

function buildOneChapterOneChangeContract(plan) {
  return {
    chapter_must_change: true,
    change_definition: "The chapter should end with a materially different situation, not only a prettier restatement.",
    required_fields: [
      "protagonist_want",
      "opposition_pressure",
      "stakes",
      "reversal_or_reveal",
      "cost_or_payment",
      "new_status_quo",
    ],
    provider_usage: [
      "Make the want visible through action.",
      "Make opposition resist in-scene instead of as abstract exposition.",
      "Pay at least one cost before the ending.",
      "End on a changed situation or concrete next pressure.",
    ],
    acceptance_hint: {
      pretty_sentence_only_is_not_enough: true,
      pure_setup_without_changed_state_should_be_revised: true,
      preserve_candidate_only_scope: true,
    },
    observed_plan: {
      protagonist: plan.protagonist,
      want: plan.protagonist_want,
      opposition: plan.opposition || plan.opposition_pressure,
      cost: plan.cost_or_payment,
      new_status_quo: plan.new_status_quo,
    },
  };
}

export async function buildDramaticConflictManagerContext(rawInput = {}, options = {}) {
  const rawPlan = object(
    options.dramaticConflictPlan
      ?? rawInput.dramatic_conflict_plan
      ?? rawInput.dramaticConflictPlan
      ?? {},
  );
  const plan = normalizePlan(rawPlan, rawInput);
  const missing = missingCodes(plan);
  const status = missing.length ? "incomplete" : "completed";
  const warnings = [
    ...(missing.length ? ["dramatic_conflict_plan_incomplete"] : []),
    ...missing,
  ];
  const context = {
    used: true,
    phase: "26A",
    version: dramaticConflictManagerVersion,
    status,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    plan,
    missing_fields: missing,
    one_chapter_one_change_contract: buildOneChapterOneChangeContract(plan),
    provider_contract: {
      generation_payload_key: "dramatic_conflict_manager",
      revision_payload_key: "dramatic_conflict_manager",
      final_polisher_payload_key: "dramatic_conflict_manager",
      candidate_report_key: "dramatic_conflict_manager",
    },
    warnings,
  };
  context.trace_id = `dramatic_conflict_${sha256(JSON.stringify({ status, plan, missing })).slice(0, 16)}`;
  return context;
}

export default buildDramaticConflictManagerContext;
