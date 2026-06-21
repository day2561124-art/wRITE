import assert from "node:assert/strict";
import {
  buildForeshadowingPayoffRepairPlannerContext,
  shouldUseForeshadowingPayoffRepairPlanner,
} from "../../server/src/foreshadowing-payoff-repair-planner-service.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";

const fakeGuardFixture = {
  used: true,
  phase: "27B",
  status: "needs_revision",
  blocking: true,
  fake_payoffs: [
    {
      id: "pretty_callback",
      debt_id: "door_warning",
      payoff_types: ["decorative_callback"],
      rejection_reason: "decorative_callback",
      summary: "The old warning is mentioned beautifully, but nothing changes.",
    },
  ],
  unpaid_required_debts: [
    {
      id: "door_warning",
      label: "old door warning",
      promise: "the warning must cost the team a route",
      payoff_requirements: ["route_loss", "changed_state"],
    },
  ],
  unresolved_promises: [
    {
      id: "pay_door_warning",
      promise: "this chapter should pay the warning through consequence",
      expected_motion: "warning becomes route loss",
    },
  ],
};

assert.equal(shouldUseForeshadowingPayoffRepairPlanner({}), false);
assert.equal(shouldUseForeshadowingPayoffRepairPlanner({ include_foreshadowing_payoff_repair_planner: true }), true);
assert.equal(shouldUseForeshadowingPayoffRepairPlanner({}, { foreshadowingPayoffRepairPlanner: {} }), true);

const disabled = await buildForeshadowingPayoffRepairPlannerContext({
  foreshadowing_payoff_guard: fakeGuardFixture,
});
assert.equal(disabled.used, false);
assert.equal(disabled.status, "disabled");

const repairPlanner = await buildForeshadowingPayoffRepairPlannerContext({
  include_foreshadowing_payoff_repair_planner: true,
  foreshadowing_payoff_guard: fakeGuardFixture,
});
assert.equal(repairPlanner.used, true);
assert.equal(repairPlanner.phase, "27C");
assert.equal(repairPlanner.status, "needs_revision");
assert.equal(repairPlanner.revision_required, true);
assert.equal(repairPlanner.candidate_only, true);
assert.equal(repairPlanner.no_auto_persist, true);
assert.equal(repairPlanner.no_canon_update, true);
assert.equal(repairPlanner.no_active_engine_update, true);
assert.equal(repairPlanner.repair_tasks[0].source_type, "fake_payoff");
assert.equal(repairPlanner.repair_tasks[0].repair_action, "replace_fake_callback_with_scene_consequence");
assert(repairPlanner.repair_tasks[0].required_true_payoff_types.includes("route_loss"));
assert.equal(repairPlanner.revision_plan_patch.force_revision, true);
assert.equal(repairPlanner.revision_plan_patch.suggested_return_stage, "foreshadowing_payoff_repair");
assert(repairPlanner.final_polisher_guidance.reject_if_candidate_still_contains.includes("decorative_callback"));
assert.equal(repairPlanner.provider_contract.revision_payload_key, "foreshadowing_payoff_repair_planner");
assert(repairPlanner.warnings.includes("fake_payoff_repair_required"));
assert(repairPlanner.trace_id.startsWith("foreshadowing_payoff_repair_"));

const passedPlanner = await buildForeshadowingPayoffRepairPlannerContext({}, {
  foreshadowingPayoffRepairPlanner: {
    foreshadowing_payoff_guard: {
      used: true,
      phase: "27B",
      status: "passed",
      blocking: false,
      fake_payoffs: [],
      unpaid_required_debts: [],
      unresolved_promises: [],
    },
  },
});
assert.equal(passedPlanner.used, true);
assert.equal(passedPlanner.status, "passed");
assert.equal(passedPlanner.revision_required, false);
assert.equal(passedPlanner.repair_tasks.length, 0);

const graphFixture = {
  debts: [
    {
      id: "door_warning",
      label: "old door warning",
      status: "payoff_ready",
      promise: "the old warning must cost the team a route",
      payoff_requirements: ["route_loss", "changed_state"],
    },
  ],
  chapter_promises: [],
};

let finalPolisherCalls = 0;
let revisionCalls = 0;
const pipeline = await runFullRecursiveWritingPipeline({
  task_prompt: "Phase27C payoff repair planner pipeline test.",
  generation_context: { scene: "fake payoff repair smoke" },
  retrieval_context: { scope: "candidate only" },
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: false,
  include_foreshadowing_payoff_guard: true,
  include_foreshadowing_payoff_repair_planner: true,
  enable_character_voice_guard: false,
  save_candidate: false,
  max_revision_rounds: 2,
}, {
  foreshadowingPayoffGuard: {
    foreshadowing_causal_graph: graphFixture,
  },
  foreshadowingPayoffRepairPlanner: {},
  generationAdapter: async (payload) => {
    assert.equal(payload.foreshadowing_payoff_repair_planner.used, false);
    return {
      text: "The old warning was remembered in a beautiful sentence, but the route stayed open.",
      provider_trace_id: "phase27c-generation",
      foreshadowing_payoffs: [
        {
          id: "pretty_callback",
          debt_id: "door_warning",
          payoff_types: ["decorative_callback"],
          summary: "The warning is mentioned without state change.",
        },
      ],
    };
  },
  finalPolisherAdapter: async (payload) => {
    finalPolisherCalls += 1;
    if (finalPolisherCalls === 1) {
      assert.equal(payload.foreshadowing_payoff_repair_planner.used, true);
      assert.equal(payload.foreshadowing_payoff_repair_planner.revision_required, true);
      assert.equal(payload.foreshadowing_payoff_repair_planner.repair_tasks[0].source_type, "fake_payoff");
    }
    return {
      status: "completed",
      polished_text: payload.raw_draft_text,
      needs_structural_revision: false,
      warnings: [],
    };
  },
  revisionAdapter: async (payload) => {
    revisionCalls += 1;
    assert.equal(payload.foreshadowing_payoff_repair_planner.used, true);
    assert.equal(payload.foreshadowing_payoff_repair_planner.revision_required, true);
    assert.equal(payload.revision_plan.foreshadowing_payoff_repair.force_revision, true);
    return {
      text: "Chiya hit confirm; the terminal sealed the return corridor into grey static, forcing the team onto the left route.",
      provider_trace_id: "phase27c-revision",
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
});

assert.equal(pipeline.status, "completed");
assert.equal(pipeline.recursive_revision.used, true);
assert.equal(pipeline.recursive_revision.rounds_attempted, 1);
assert.equal(revisionCalls, 1);
assert.equal(finalPolisherCalls, 2);
assert.equal(pipeline.foreshadowing_payoff_repair_planner.used, true);
assert.equal(pipeline.foreshadowing_payoff_repair_planner.phase, "27C");
assert.equal(pipeline.foreshadowing_payoff_repair_planner.revision_required, false);
assert.equal(pipeline.foreshadowing_payoff_repair_planner.repair_tasks.length, 0);
assert.equal(pipeline.report.foreshadowing_payoff_repair_planner_used, true);
assert.equal(pipeline.report.foreshadowing_payoff_repair_planner_candidate_only, true);
assert.equal(pipeline.report.foreshadowing_payoff_repair_planner_no_auto_persist, true);

console.log("Phase27C foreshadowing payoff repair planner tests passed.");
