import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { adoptedWritingSettlementTools } from "../../server/src/mcp-adopted-writing-settlement-tools.mjs";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { buildForeshadowingSettlementSurface } from "../../server/src/foreshadowing-settlement-surface-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260621-000000-27f00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260621-000000-27f00001",
  settlement_mode: "full",
  pending_engine_candidate_created: false,
  active_engine_modified: false,
  foreshadowing_settlement_proposal_bridge_used: true,
  foreshadowing_settlement_proposal_bridge: {
    used: true,
    phase: "27F",
    version: "foreshadowing_settlement_proposal_bridge_v1",
    preview_only: true,
    candidate_only: true,
    read_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    warnings: [],
    settlement_diff_preview: {
      paid_foreshadowing_debts: [
        {
          debt_id: "door_warning",
          payoff_id: "route_loss_payoff",
          payoff_types: ["action", "route_loss"],
          consequence: "The return route is sealed.",
        },
      ],
      kept_open_debts: [
        {
          debt_id: "mirror_name",
          reason: "still_open",
          promise: "The mirror name is still unresolved.",
        },
      ],
      blocked_canon_intake_items: [],
      allowed_candidate_settlement_items: [
        {
          type: "foreshadowing_payoff_paid",
          debt_id: "door_warning",
          payoff_id: "route_loss_payoff",
        },
      ],
    },
  },
  foreshadowing_settlement_diff_preview: {
    paid_foreshadowing_debts: [
      {
        debt_id: "door_warning",
        payoff_id: "route_loss_payoff",
        payoff_types: ["action", "route_loss"],
        consequence: "The return route is sealed.",
      },
    ],
    kept_open_debts: [
      {
        debt_id: "mirror_name",
        reason: "still_open",
        promise: "The mirror name is still unresolved.",
      },
    ],
    blocked_canon_intake_items: [],
    allowed_candidate_settlement_items: [
      {
        type: "foreshadowing_payoff_paid",
        debt_id: "door_warning",
        payoff_id: "route_loss_payoff",
      },
    ],
  },
};

const direct = buildForeshadowingSettlementSurface({ context: fixtureContext });
assert.equal(direct.used, true);
assert.equal(direct.phase, "27G");
assert.equal(direct.source_phase, "27F");
assert.equal(direct.status, "surface_ready");
assert.equal(direct.counts.paid, 1);
assert.equal(direct.counts.kept_open, 1);
assert.equal(direct.counts.blocked, 0);
assert.equal(direct.safety.read_only, true);
assert.equal(direct.safety.no_canon_update, true);
assert.equal(direct.safety.no_active_engine_update, true);
assert.equal(direct.safety.pending_engine_candidate_created, false);
assert.match(direct.surface_markdown, /Foreshadowing Settlement Surface/u);
assert.match(direct.surface_markdown, /door_warning/u);

const blocked = buildForeshadowingSettlementSurface({
  context: {
    ...fixtureContext,
    foreshadowing_settlement_diff_preview: {
      paid_foreshadowing_debts: [],
      kept_open_debts: [],
      blocked_canon_intake_items: [
        { source_type: "fake_payoff", id: "decorative_callback", reason: "decorative_callback" },
      ],
      allowed_candidate_settlement_items: [],
    },
  },
});
assert.equal(blocked.status, "blocked_surface");
assert.equal(blocked.counts.blocked, 1);
assert(blocked.warnings.includes("foreshadowing_settlement_surface_blocked_items_present"));

const missing = buildForeshadowingSettlementSurface({});
assert.equal(missing.used, false);
assert.equal(missing.status, "not_available");
assert(missing.warnings.includes("foreshadowing_settlement_surface_not_available"));

const suffix = ".phase27g-foreshadowing-settlement-surface-test";
const options = {
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
};
const activeBefore = await readFile(projectPaths.activeEngine);
const contextDir = path.join(options.settlementContexts, fixtureContext.settlement_context_id);

try {
  await rm(options.settlementContexts, { recursive: true, force: true });
  await mkdir(contextDir, { recursive: true });
  await writeFile(
    path.join(contextDir, "settlement_context.json"),
    `${JSON.stringify(fixtureContext, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(contextDir, "settlement_for_chat.md"),
    "# Settlement Fixture\n\n## Foreshadowing Settlement Proposal Bridge\n",
    "utf8",
  );

  const mcpSurface = await adoptedWritingSettlementTools.get_foreshadowing_settlement_surface({
    id: fixtureContext.settlement_context_id,
  }, options);
  assert.equal(mcpSurface.ok, true);
  assert.equal(mcpSurface.permission, "read_only");
  assert.equal(mcpSurface.result.phase, "27G");
  assert.equal(mcpSurface.result.counts.paid, 1);
  assert.equal(mcpSurface.result.safety.no_canon_update, true);
  assert.equal(mcpSurface.result.safety.no_active_engine_update, true);

  const bridgeSurface = await chatgptBridgeTools.chatgpt_bridge_get_foreshadowing_settlement_surface({
    id: fixtureContext.settlement_context_id,
  }, options);
  assert.equal(bridgeSurface.ok, true);
  assert.equal(bridgeSurface.permission, "read_only");
  assert.equal(bridgeSurface.result.phase, "27G");
  assert.equal(bridgeSurface.result.counts.allowed_candidate_items, 1);
  assert.equal(bridgeSurface.safety.can_modify_active_engine, false);
  assert.equal(bridgeSurface.safety.can_approve, false);
  assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

  console.log("Phase27G foreshadowing settlement surface tests passed.");
} finally {
  await rm(options.settlementContexts, { recursive: true, force: true });
}
