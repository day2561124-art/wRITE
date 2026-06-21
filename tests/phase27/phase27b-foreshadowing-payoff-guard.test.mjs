import assert from "node:assert/strict";
import {
  buildForeshadowingPayoffGuardContext,
  shouldUseForeshadowingPayoffGuard,
} from "../../server/src/foreshadowing-payoff-guard-service.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";

const graphFixture = {
  debts: [
    {
      id: "door_warning",
      label: "old door warning",
      status: "payoff_ready",
      promise: "the old warning must cost the team a route",
      payoff_requirements: ["route_loss", "changed_state"],
    },
    {
      id: "sealed_return_path",
      label: "sealed return path",
      status: "open",
      promise: "the team must later deal with no clean retreat",
    },
  ],
  chapter_promises: [
    {
      id: "pay_door_warning",
      promise: "this chapter should pay the door warning through consequence",
      expected_motion: "warning becomes route loss",
      current_status: "open",
      must_not_fake_payoff: true,
    },
  ],
};

assert.equal(shouldUseForeshadowingPayoffGuard({}), false);
assert.equal(shouldUseForeshadowingPayoffGuard({ include_foreshadowing_payoff_guard: true }), true);
assert.equal(shouldUseForeshadowingPayoffGuard({}, { foreshadowingPayoffGuard: { payoffs: [] } }), true);

const disabled = await buildForeshadowingPayoffGuardContext({
  generation_context: { foreshadowing_causal_graph: graphFixture },
});
assert.equal(disabled.used, false);
assert.equal(disabled.status, "disabled");

const truePayoff = await buildForeshadowingPayoffGuardContext({
  include_foreshadowing_payoff_guard: true,
}, {
  foreshadowingPayoffGuard: {
    foreshadowing_causal_graph: graphFixture,
    payoffs: [
      {
        id: "payoff_route_loss",
        debt_id: "door_warning",
        payoff_types: ["action", "cost", "changed_state", "route_loss"],
        consequence: "Chiya confirms the route and the terminal folds the return corridor into grey static.",
        evidence_refs: ["candidate:route-confirm"],
      },
    ],
  },
});
assert.equal(truePayoff.used, true);
assert.equal(truePayoff.phase, "27B");
assert.equal(truePayoff.status, "needs_revision");
assert.equal(truePayoff.candidate_only, true);
assert.equal(truePayoff.no_auto_persist, true);
assert.equal(truePayoff.no_canon_update, true);
assert.equal(truePayoff.no_active_engine_update, true);
assert.equal(truePayoff.detected_payoffs[0].true_payoff, true);
assert.equal(truePayoff.fake_payoffs.length, 0);
assert.equal(truePayoff.unpaid_required_debts.length, 0);
assert.equal(truePayoff.unresolved_promises[0].id, "pay_door_warning");
assert.equal(truePayoff.provider_contract.final_polisher_payload_key, "foreshadowing_payoff_guard");
assert(truePayoff.provider_guidance.must_reject.includes("decorative_callback"));
assert(truePayoff.trace_id.startsWith("foreshadowing_payoff_"));

const fakePayoff = await buildForeshadowingPayoffGuardContext({
  includeForeshadowingPayoffGuard: true,
}, {
  foreshadowingPayoffGuard: {
    foreshadowing_causal_graph: graphFixture,
    payoffs: [
      {
        id: "pretty_callback",
        debt_id: "door_warning",
        payoff_types: ["decorative_callback"],
        summary: "The old warning is mentioned in a beautiful sentence, but nothing changes.",
      },
    ],
  },
});
assert.equal(fakePayoff.status, "needs_revision");
assert.equal(fakePayoff.blocking, true);
assert.equal(fakePayoff.fake_payoffs[0].rejection_reason, "decorative_callback");
assert.equal(fakePayoff.unpaid_required_debts[0].id, "door_warning");
assert(fakePayoff.warnings.includes("fake_foreshadowing_payoff_detected"));
assert(fakePayoff.warnings.includes("payable_foreshadowing_debt_unpaid"));

const explanationOnly = await buildForeshadowingPayoffGuardContext({}, {
  foreshadowing_payoff_guard: {
    foreshadowing_causal_graph: graphFixture,
    payoffs: [
      {
        id: "explain_warning",
        debt_id: "door_warning",
        payoff_types: ["pure_explanation_payoff"],
        consequence: "The characters understand the warning, but no route, cost, relation, or tactical state changes.",
      },
    ],
  },
});
assert.equal(explanationOnly.used, true);
assert.equal(explanationOnly.fake_payoffs[0].fake_payoff, true);
assert.equal(explanationOnly.unpaid_required_debts[0].id, "door_warning");

const missingConsequence = await buildForeshadowingPayoffGuardContext({
  include_foreshadowing_payoff_guard: true,
}, {
  foreshadowingPayoffGuard: {
    foreshadowing_causal_graph: graphFixture,
    payoffs: [
      {
        id: "named_action_without_state_change",
        debt_id: "door_warning",
        payoff_types: ["action"],
        summary: "The warning is acted upon in wording only.",
      },
    ],
  },
});
assert.equal(missingConsequence.fake_payoffs[0].rejection_reason, "payoff_without_state_change");
assert.equal(missingConsequence.blocking, true);

const pipelinePayloads = [];
const pipeline = await runFullRecursiveWritingPipeline({
  task_prompt: "Phase27B pipeline payoff guard integration test.",
  generation_context: { scene: "route warning payoff smoke" },
  retrieval_context: { scope: "candidate only" },
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: false,
  include_foreshadowing_payoff_guard: true,
  enable_character_voice_guard: false,
  save_candidate: false,
  max_revision_rounds: 1,
}, {
  foreshadowingPayoffGuard: {
    foreshadowing_causal_graph: graphFixture,
  },
  generationAdapter: async (payload) => {
    pipelinePayloads.push(payload);
    assert.equal(payload.foreshadowing_payoff_guard.used, false);
    return {
      text: "Chiya pressed confirm and the old return corridor folded into grey static.",
      provider_trace_id: "phase27b-generation",
      foreshadowing_payoffs: [
        {
          id: "payoff_route_loss_pipeline",
          debt_id: "door_warning",
          payoff_types: ["action", "changed_state", "route_loss"],
          consequence: "The confirmed route erases the return corridor.",
        },
      ],
    };
  },
  finalPolisherAdapter: async (payload) => {
    assert.equal(payload.foreshadowing_payoff_guard.used, true);
    assert.equal(payload.foreshadowing_payoff_guard.fake_payoffs.length, 0);
    return {
      status: "completed",
      polished_text: payload.raw_draft_text,
      needs_structural_revision: false,
      warnings: [],
    };
  },
});

assert.equal(pipeline.status, "completed");
assert.equal(pipeline.foreshadowing_payoff_guard.used, true);
assert.equal(pipeline.foreshadowing_payoff_guard.phase, "27B");
assert.equal(pipeline.foreshadowing_payoff_guard.unpaid_required_debts.length, 0);
assert.equal(pipeline.foreshadowing_payoff_guard.fake_payoffs.length, 0);
assert.equal(pipeline.report.foreshadowing_payoff_guard_used, true);
assert.ok(["passed", "completed", "needs_revision"].includes(pipeline.report.foreshadowing_payoff_guard_status));
assert.equal(pipeline.report.foreshadowing_payoff_guard_candidate_only, true);
assert.equal(pipeline.report.foreshadowing_payoff_guard_no_auto_persist, true);
assert.equal(pipelinePayloads.length, 1);

console.log("Phase27B foreshadowing payoff guard tests passed.");
