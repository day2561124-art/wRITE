import assert from "node:assert/strict";
import {
  buildForeshadowingPayoffAcceptanceGateContext,
  shouldUseForeshadowingPayoffAcceptanceGate,
} from "../../server/src/foreshadowing-payoff-acceptance-gate-service.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";

assert.equal(shouldUseForeshadowingPayoffAcceptanceGate({}), false);
assert.equal(shouldUseForeshadowingPayoffAcceptanceGate({ include_foreshadowing_payoff_acceptance_gate: true }), true);
assert.equal(shouldUseForeshadowingPayoffAcceptanceGate({}, { foreshadowingPayoffAcceptanceGate: {} }), true);

const disabled = await buildForeshadowingPayoffAcceptanceGateContext({
  foreshadowing_payoff_guard: { used: true, blocking: false },
});
assert.equal(disabled.used, false);
assert.equal(disabled.status, "disabled");

const readyGate = await buildForeshadowingPayoffAcceptanceGateContext({
  include_foreshadowing_payoff_acceptance_gate: true,
  foreshadowing_causal_graph: {
    used: true,
    phase: "27A",
    status: "passed",
  },
  foreshadowing_payoff_guard: {
    used: true,
    phase: "27B",
    status: "passed",
    blocking: false,
    fake_payoffs: [],
    unpaid_required_debts: [],
    unresolved_promises: [],
  },
  foreshadowing_payoff_repair_planner: {
    used: true,
    phase: "27C",
    status: "passed",
    revision_required: false,
    repair_tasks: [],
  },
});
assert.equal(readyGate.used, true);
assert.equal(readyGate.phase, "27D");
assert.equal(readyGate.status, "passed");
assert.equal(readyGate.readiness_status, "ready_for_adoption_review");
assert.equal(readyGate.can_enter_adoption_review, true);
assert.equal(readyGate.requires_human_approval, true);
assert.equal(readyGate.direct_adoption_allowed, false);
assert.equal(readyGate.no_canon_update, true);
assert.equal(readyGate.no_active_engine_update, true);
assert.equal(readyGate.blocking_reasons.length, 0);
assert.equal(readyGate.checks.payoff_guard_passed, true);
assert(readyGate.trace_id.startsWith("foreshadowing_payoff_acceptance_"));

const blockedGate = await buildForeshadowingPayoffAcceptanceGateContext({}, {
  foreshadowingPayoffAcceptanceGate: {
    foreshadowing_causal_graph: {
      used: true,
      phase: "27A",
      status: "passed",
    },
    foreshadowing_payoff_guard: {
      used: true,
      phase: "27B",
      status: "needs_revision",
      blocking: true,
      fake_payoffs: [{ id: "pretty_callback" }],
      unpaid_required_debts: [{ id: "door_warning" }],
      unresolved_promises: [],
    },
    foreshadowing_payoff_repair_planner: {
      used: true,
      phase: "27C",
      status: "needs_revision",
      revision_required: true,
      repair_tasks: [{ id: "repair_fake", severity: "blocking" }],
    },
  },
});
assert.equal(blockedGate.status, "blocked");
assert.equal(blockedGate.can_enter_adoption_review, false);
assert(blockedGate.blocking_reasons.includes("foreshadowing_payoff_guard_blocking"));
assert(blockedGate.blocking_reasons.includes("fake_payoffs_present"));
assert(blockedGate.blocking_reasons.includes("unpaid_required_debts_present"));
assert(blockedGate.blocking_reasons.includes("foreshadowing_payoff_repair_revision_required"));
assert(blockedGate.warnings.includes("foreshadowing_payoff_acceptance_blocked"));

const graphFixture = {
  debts: [
    {
      id: "door_warning",
      label: "old door warning",
      status: "payoff_ready",
      promise: "the warning must become route loss",
      payoff_requirements: ["route_loss", "changed_state"],
    },
  ],
  chapter_promises: [],
};

const pipeline = await runFullRecursiveWritingPipeline({
  task_prompt: "Phase27D payoff acceptance gate pipeline test.",
  generation_context: { scene: "acceptance gate smoke" },
  retrieval_context: { scope: "candidate only" },
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: true,
  include_foreshadowing_payoff_guard: true,
  include_foreshadowing_payoff_repair_planner: true,
  include_foreshadowing_payoff_acceptance_gate: true,
  enable_character_voice_guard: false,
  save_candidate: false,
}, {
  foreshadowingCausalGraph: {
    graph: graphFixture,
  },
  foreshadowingPayoffGuard: {
    foreshadowing_causal_graph: graphFixture,
  },
  foreshadowingPayoffRepairPlanner: {},
  foreshadowingPayoffAcceptanceGate: {},
  generationAdapter: async (payload) => {
    assert.equal(payload.foreshadowing_payoff_acceptance_gate.used, false);
    return {
      text: "Chiya struck the terminal; the sealed return corridor collapsed into static and forced the team onto the left route.",
      provider_trace_id: "phase27d-generation",
      foreshadowing_payoffs: [
        {
          id: "route_loss_payoff",
          debt_id: "door_warning",
          payoff_types: ["action", "changed_state", "route_loss"],
          consequence: "The return route is sealed and the team loses the clean retreat.",
        },
      ],
    };
  },
  finalPolisherAdapter: async (payload) => {
    assert.equal(payload.foreshadowing_payoff_acceptance_gate.used, false);
    return {
      status: "completed",
      polished_text: payload.raw_draft_text,
      needs_structural_revision: false,
      warnings: [],
      foreshadowing_payoffs: payload.foreshadowing_payoff_guard.detected_payoffs ?? [],
    };
  },
});

assert.equal(pipeline.status, "completed");
assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.used, true);
assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.phase, "27D");
assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.status, "passed");
assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.can_enter_adoption_review, true);
assert.equal(pipeline.foreshadowing_payoff_acceptance_gate.direct_adoption_allowed, false);
assert.equal(pipeline.report.foreshadowing_payoff_acceptance_gate_used, true);
assert.equal(pipeline.report.foreshadowing_payoff_acceptance_ready, true);
assert.equal(pipeline.report.foreshadowing_payoff_acceptance_candidate_only, true);
assert.equal(pipeline.report.foreshadowing_payoff_acceptance_no_auto_persist, true);

console.log("Phase27D foreshadowing payoff acceptance gate tests passed.");
