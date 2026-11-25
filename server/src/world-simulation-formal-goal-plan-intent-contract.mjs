// Formal transport DTO contract. This module is intentionally independent
// of the World/Character Brain execution graph. It admits only subjective
// intents and observer-scoped opaque tokens, never state or outcome writes.
const string = (maxLength = 240) => ({ type: "string", minLength: 1, maxLength });
const enumString = (values) => ({ type: "string", enum: values });
const object = (properties, required) => ({ type: "object", additionalProperties: false, properties, required });
const array = (items, maxItems, minItems = 0) => ({ type: "array", items, maxItems, minItems });
const token = string(128);
const descriptor = (kindField, kinds, maxLabel) => object({
  [kindField]: enumString(kinds), label: string(maxLabel), context: { type: ["string", "null"], maxLength: 240 },
}, [kindField, "label"]);

export const formalGoalPlanIntentProperties = Object.freeze({
  goal_context_token: token,
  goal_intents: array({ oneOf: [
    object({
      operation: enumString(["propose"]),
      goal_kind: enumString(["achieve_state", "maintain_state", "avoid_state", "restore_state"]),
      domain: string(120),
      target_descriptor: object({ label: string(180), context: { type: ["string", "null"], maxLength: 240 } }, ["label"]),
      motivation_basis_tokens: { ...array(token, 12, 1), uniqueItems: true },
      motivation_relations: { ...array(enumString(["self_concordant_with", "supports", "conflicts_with", "externally_prompted_by"]), 4), uniqueItems: true },
    }, ["operation", "goal_kind", "domain", "target_descriptor", "motivation_basis_tokens"]),
    object({ operation: enumString(["commit", "suspend", "abandon"]), goal_token: token }, ["operation", "goal_token"]),
  ] }, 8),
  plan_context_token: token,
  plan_intents: array(object({
    goal_token: token,
    cue_descriptor: descriptor("cue_kind", ["situation", "opportunity", "obstacle", "task_juncture", "internal_state"], 200),
    response_descriptor: descriptor("response_kind", ["initiate_behavior", "cognitive_procedure", "communication", "avoidance", "seek_support"], 200),
  }, ["goal_token", "cue_descriptor", "response_descriptor"]), 8),
});

function fail(code = "WORLD_SIMULATION_FORMAL_GOAL_PLAN_INTENT_INVALID") {
  const error = new Error(code);
  error.code = code;
  throw error;
}

// Validate the exact public subset in the parent broker too, not only MCP.
function matches(schema, value) {
  if (schema.oneOf) return schema.oneOf.filter(option => matches(option, value)).length === 1;
  if (schema.type === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      && (schema.required ?? []).every(key => Object.hasOwn(value, key))
      && Object.entries(value).every(([key, item]) =>
        Object.hasOwn(schema.properties, key) && matches(schema.properties[key], item));
  }
  if (schema.type === "array") {
    return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= schema.maxItems
      && (!schema.uniqueItems || new Set(value).size === value.length)
      && value.every(item => matches(schema.items, item));
  }
  if (Array.isArray(schema.type) && value === null) return schema.type.includes("null");
  return typeof value === "string" && value.length <= (schema.maxLength ?? Infinity)
    && (schema.minLength === undefined || value.trim().length >= schema.minLength)
    && (!schema.enum || schema.enum.includes(value));
}

export function extractFormalGoalPlanIntentFields(input = {}) {
  const result = {};
  for (const [key, schema] of Object.entries(formalGoalPlanIntentProperties)) {
    if (!Object.hasOwn(input, key)) continue;
    if (!matches(schema, input[key])) fail();
    result[key] = JSON.parse(JSON.stringify(input[key]));
  }
  return result;
}

export function bindFormalGoalPlanIntents(input, characterInput) {
  const fields = extractFormalGoalPlanIntentFields(input);
  const goal = characterInput?.native_goal_decision;
  const plan = characterInput?.native_plan_decision;
  const has = (list, key, token) => Array.isArray(list) && list.some(item => item[key] === token);
  if (Object.hasOwn(fields, "goal_context_token") || Object.hasOwn(fields, "goal_intents")) {
    if (!goal || fields.goal_context_token !== goal.context_token || !Array.isArray(fields.goal_intents))
      fail("WORLD_SIMULATION_NATIVE_GOAL_CONTEXT_MISMATCH");
    for (const intent of fields.goal_intents) {
      if (intent.operation === "propose") {
        if (!intent.motivation_basis_tokens.every(token => has(goal.motivation_basis, "source_token", token)))
          fail("WORLD_SIMULATION_NATIVE_GOAL_SOURCE_TOKEN_INVALID");
      } else {
        const selected = goal.existing_goals?.find(item => item.goal_token === intent.goal_token);
        if (!selected) fail("WORLD_SIMULATION_NATIVE_GOAL_TOKEN_INVALID");
        if (intent.operation === "commit" && selected.state !== "proposed"
          || intent.operation === "suspend" && selected.state !== "committed")
          fail("WORLD_SIMULATION_MOTIVATIONAL_GOAL_STATE_TRANSITION_INVALID");
      }
    }
  }
  if (Object.hasOwn(fields, "plan_context_token") || Object.hasOwn(fields, "plan_intents")) {
    if (!plan || fields.plan_context_token !== plan.context_token || !Array.isArray(fields.plan_intents))
      fail("WORLD_SIMULATION_NATIVE_PLAN_CONTEXT_MISMATCH");
    for (const intent of fields.plan_intents) {
      if (!has(plan.committed_goals, "goal_token", intent.goal_token))
        fail("WORLD_SIMULATION_NATIVE_PLAN_GOAL_TOKEN_INVALID");
    }
  }
  return fields;
}
