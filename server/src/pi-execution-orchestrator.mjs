import { createExecutionIntent, createOperationState, transitionOperation } from "./pi-execution-contract.mjs";
import { createMcpCapabilityAdapter } from "./pi-mcp-adapter.mjs";
import { createPiExecutionStateStore } from "./pi-execution-state-store.mjs";

// Opt-in durable planning only; no tool dispatch or production routing is added.
export async function persistExecutionIntent(source, { store = createPiExecutionStateStore() } = {}) {
  let record = await store.admit(source);
  for (const [before, after] of [["CREATED", "ADMITTED"], ["ADMITTED", "PREPARING"]]) {
    if (record.state.status === before) {
      record = await store.advance({ operation_id: record.state.operation_id, context: record.intent.context,
        expected_revision: record.revision, status: after });
    }
  }
  return Object.freeze({ ...record.result, intent: record.intent, state: record.state,
    projection_hash: record.projection_hash, journal_receipt: record.journal_receipt });
}

// Phase A is a deterministic planner. It executes no tools, generates no patches,
// creates no agent session and cannot select a production route.
export function planExecutionIntent(source, options = {}) {
  const intent = createExecutionIntent(source);
  const adapter = options.adapter ?? createMcpCapabilityAdapter();
  let state = createOperationState(intent, options);
  state = transitionOperation(state, "ADMITTED", state.created_at);
  state = transitionOperation(state, "PREPARING", state.created_at);
  const steps = Object.freeze(intent.requested_actions.map(action => adapter.describe(intent, action.step_id)));
  return Object.freeze({
    schema_version: 1, phase: "A", mode: "shadow", intent, state, steps,
    production_default_changed: false, model_requests: 0,
    execution_enabled: false, persistence_enabled: false,
    decision_owner: "GPT", execution_owner: "Pi", tool_owner: "MCP",
  });
}
