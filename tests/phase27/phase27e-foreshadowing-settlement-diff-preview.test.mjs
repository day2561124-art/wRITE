import assert from "node:assert/strict";
import {
  buildForeshadowingSettlementDiffPreviewContext,
  shouldUseForeshadowingSettlementDiffPreview,
} from "../../server/src/foreshadowing-settlement-diff-preview-service.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";

assert.equal(shouldUseForeshadowingSettlementDiffPreview({}), false);
assert.equal(shouldUseForeshadowingSettlementDiffPreview({ include_foreshadowing_settlement_diff_preview: true }), true);
assert.equal(shouldUseForeshadowingSettlementDiffPreview({}, { foreshadowingSettlementDiffPreview: {} }), true);

const disabled = await buildForeshadowingSettlementDiffPreviewContext({
  foreshadowing_payoff_guard: { used: true },
});
assert.equal(disabled.used, false);
assert.equal(disabled.status, "disabled");

const preview = await buildForeshadowingSettlementDiffPreviewContext({
  include_foreshadowing_settlement_diff_preview: true,
  foreshadowing_causal_graph: {
    used: true,
    graph: {
      debts: [
        {
          id: "door_warning",
          label: "old door warning",
          status: "payoff_ready",
          promise: "warning must cost the team a route",
        },
        {
          id: "mirror_name",
          label: "mirror name",
          status: "open",
          promise: "name must stay unresolved",
        },
      ],
    },
  },
  foreshadowing_payoff_guard: {
    used: true,
    status: "passed",
    blocking: false,
    detected_payoffs: [
      {
        id: "route_loss_payoff",
        debt_id: "door_warning",
        payoff_types: ["action", "changed_state", "route_loss"],
        consequence: "The return route is sealed.",
      },
    ],
    fake_payoffs: [],
    unpaid_required_debts: [],
    unresolved_promises: [],
  },
  foreshadowing_payoff_repair_planner: {
    used: true,
    status: "passed",
    revision_required: false,
    repair_tasks: [],
  },
  foreshadowing_payoff_acceptance_gate: {
    used: true,
    status: "passed",
    can_enter_adoption_review: true,
    blocking_reasons: [],
  },
});
assert.equal(preview.used, true);
assert.equal(preview.phase, "27E");
assert.equal(preview.status, "preview_ready");
assert.equal(preview.preview_only, true);
assert.equal(preview.candidate_only, true);
assert.equal(preview.no_auto_persist, true);
assert.equal(preview.no_canon_update, true);
assert.equal(preview.no_active_engine_update, true);
assert.equal(preview.pending_engine_candidate_created, false);
assert.equal(preview.settlement_diff_preview.paid_foreshadowing_debts.length, 1);
assert.equal(preview.settlement_diff_preview.paid_foreshadowing_debts[0].debt_id, "door_warning");
assert.equal(preview.settlement_diff_preview.kept_open_debts.some((item) => item.debt_id === "mirror_name"), true);
assert.equal(preview.canon_intake_preview.direct_canon_write_allowed, false);
assert(preview.trace_id.startsWith("foreshadowing_settlement_diff_preview_"));

const blockedPreview = await buildForeshadowingSettlementDiffPreviewContext({}, {
  foreshadowingSettlementDiffPreview: {
    foreshadowing_causal_graph: { used: true, graph: { debts: [] } },
    foreshadowing_payoff_guard: {
      used: true,
      blocking: true,
      detected_payoffs: [],
      fake_payoffs: [{ id: "pretty_callback", debt_id: "door_warning", rejection_reason: "decorative_callback" }],
      unpaid_required_debts: [{ id: "door_warning", promise: "still unpaid" }],
      unresolved_promises: [],
    },
    foreshadowing_payoff_repair_planner: {
      used: true,
      revision_required: true,
      repair_tasks: [{ id: "repair_fake", severity: "blocking", debt_id: "door_warning", issue: "fake_payoff" }],
    },
    foreshadowing_payoff_acceptance_gate: {
      used: true,
      can_enter_adoption_review: false,
      blocking_reasons: ["fake_payoffs_present"],
    },
  },
});
assert.equal(blockedPreview.status, "blocked_preview");
assert.equal(blockedPreview.settlement_diff_preview.blocked_canon_intake_items.length >= 2, true);
assert(blockedPreview.warnings.includes("foreshadowing_settlement_canon_intake_blocked_items_present"));

const graphFixture = {
  debts: [
    {
      id: "door_warning",
      label: "old door warning",
      status: "payoff_ready",
      promise: "the warning must become route loss",
      payoff_requirements: ["route_loss", "changed_state"],
    },
    {
      id: "mirror_name",
      label: "mirror name",
      status: "open",
      promise: "kept open by design",
    },
  ],
  chapter_promises: [],
};

const pipeline = await runFullRecursiveWritingPipeline({
  task_prompt: "Phase27E settlement diff preview pipeline test.",
  generation_context: { scene: "settlement preview smoke" },
  retrieval_context: { scope: "candidate only" },
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: true,
  include_foreshadowing_payoff_guard: true,
  include_foreshadowing_payoff_repair_planner: true,
  include_foreshadowing_payoff_acceptance_gate: true,
  include_foreshadowing_settlement_diff_preview: true,
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
  foreshadowingSettlementDiffPreview: {},
  generationAdapter: async (payload) => {
    assert.equal(payload.foreshadowing_settlement_diff_preview.used, false);
    return {
      text: "Chiya struck the terminal; the sealed return corridor collapsed into static and forced the team onto the left route.",
      provider_trace_id: "phase27e-generation",
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
  finalPolisherAdapter: async (payload) => ({
    status: "completed",
    polished_text: payload.raw_draft_text,
    needs_structural_revision: false,
    warnings: [],
    foreshadowing_payoffs: payload.foreshadowing_payoff_guard.detected_payoffs ?? [],
  }),
});

assert.equal(pipeline.status, "completed");
assert.equal(pipeline.foreshadowing_settlement_diff_preview.used, true);
assert.equal(pipeline.foreshadowing_settlement_diff_preview.phase, "27E");
assert.equal(pipeline.foreshadowing_settlement_diff_preview.preview_only, true);
assert.equal(pipeline.foreshadowing_settlement_diff_preview.no_canon_update, true);
assert.equal(pipeline.foreshadowing_settlement_diff_preview.no_active_engine_update, true);
assert.equal(pipeline.foreshadowing_settlement_diff_preview.pending_engine_candidate_created, false);
assert.equal(pipeline.foreshadowing_settlement_diff_preview.settlement_diff_preview.paid_foreshadowing_debts.length, 1);
assert.equal(pipeline.report.foreshadowing_settlement_diff_preview_used, true);
assert.equal(pipeline.report.foreshadowing_settlement_diff_preview_candidate_only, true);
assert.equal(pipeline.report.foreshadowing_settlement_diff_preview_no_auto_persist, true);

console.log("Phase27E foreshadowing settlement diff preview tests passed.");
