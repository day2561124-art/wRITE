import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildForeshadowingSettlementProposalBridgeContext,
  shouldUseForeshadowingSettlementProposalBridge,
} from "../../server/src/foreshadowing-settlement-proposal-bridge-service.mjs";
import {
  buildAdoptedWritingSettlementContext,
  getAdoptedWritingSettlementContext,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

assert.equal(shouldUseForeshadowingSettlementProposalBridge({}), false);
assert.equal(shouldUseForeshadowingSettlementProposalBridge({ include_foreshadowing_settlement_proposal_bridge: true }), true);
assert.equal(shouldUseForeshadowingSettlementProposalBridge({
  foreshadowing_settlement_diff_preview: { used: true },
}), true);

const disabled = await buildForeshadowingSettlementProposalBridgeContext({});
assert.equal(disabled.used, false);
assert.equal(disabled.status, "disabled");

const ready = await buildForeshadowingSettlementProposalBridgeContext({
  include_foreshadowing_settlement_proposal_bridge: true,
  foreshadowing_settlement_diff_preview: {
    used: true,
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
        { debt_id: "mirror_name", reason: "still_open", promise: "Name remains unresolved." },
      ],
      blocked_canon_intake_items: [],
      allowed_candidate_settlement_items: [
        { type: "foreshadowing_payoff_paid", debt_id: "door_warning", payoff_id: "route_loss_payoff" },
      ],
    },
  },
});
assert.equal(ready.used, true);
assert.equal(ready.phase, "27F");
assert.equal(ready.status, "proposal_bridge_ready");
assert.equal(ready.preview_only, true);
assert.equal(ready.candidate_only, true);
assert.equal(ready.no_auto_persist, true);
assert.equal(ready.no_canon_update, true);
assert.equal(ready.no_active_engine_update, true);
assert.equal(ready.pending_engine_candidate_created, false);
assert.equal(ready.settlement_proposal_bridge.paid_count, 1);
assert.equal(ready.settlement_proposal_bridge.kept_open_count, 1);
assert.equal(ready.settlement_proposal_bridge.direct_canon_write_allowed, false);
assert.match(ready.chat_markdown, /Foreshadowing Settlement Proposal Bridge/u);
assert.match(ready.chat_markdown, /door_warning/u);

const blocked = await buildForeshadowingSettlementProposalBridgeContext({}, {
  foreshadowingSettlementProposalBridge: {
    foreshadowing_settlement_diff_preview: {
      used: true,
      settlement_diff_preview: {
        paid_foreshadowing_debts: [],
        kept_open_debts: [],
        blocked_canon_intake_items: [
          { source_type: "fake_payoff", id: "pretty_callback", reason: "decorative_callback" },
        ],
        allowed_candidate_settlement_items: [],
      },
    },
  },
});
assert.equal(blocked.status, "blocked_preview_bridged");
assert.equal(blocked.settlement_proposal_ready, false);
assert.equal(blocked.settlement_proposal_bridge.blocked_count, 1);
assert(blocked.warnings.includes("foreshadowing_settlement_bridge_blocked_canon_intake_items_present"));

const suffix = ".phase27f-foreshadowing-settlement-proposal-bridge-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
  settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, suffix),
  pendingEngineCandidates: path.join(projectPaths.pendingEngineCandidates, suffix),
  activeEnginePath,
};

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

const REQUIRED_NEURAL_MODULES = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
];

async function markCandidateNeuralTraceComplete(candidateId) {
  const metaPath = path.join(options.writingCandidates, candidateId, "candidate.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.missing_required_neural_modules = [];
  meta.neural_trace_complete = true;
  meta.neural_modules_used = REQUIRED_NEURAL_MODULES;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function createAdoptedWriting() {
  const candidate = await saveChatOutputAsWritingCandidate({
    chatOutputText: "# Adopted Chapter\n\nA route-loss payoff chapter.",
  }, options);
  await markCandidateNeuralTraceComplete(candidate.candidate_id);
  const proof = await saveChatOutputAsProofReport({
    candidateId: candidate.candidate_id,
    proofReportText: "Pass.",
    verdict: "pass",
    severity: "none",
  }, options);
  const request = await requestWritingCandidateAdoption({
    candidateId: candidate.candidate_id,
    proofReportId: proof.proof_report_id,
  }, options);
  const confirmed = await confirmApprovalItem(request.approval_item_id, {
    confirm: true,
    approvedBy: "phase27f_test",
  }, options);
  return confirmed.result.adopted_chapter_id;
}

const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const transactionsBefore = await names(transactionDir);
const productionHash = hash(await readFile(projectPaths.activeEngine));
const activeText = "# Phase27F Fixture Engine\n\nRule 1: fixture stable.\n";
for (const directory of Object.values(options).filter((value) => value !== activeEnginePath)) {
  await rm(directory, { recursive: true, force: true });
}
await mkdir(path.dirname(activeEnginePath), { recursive: true });
await writeFile(activeEnginePath, activeText, "utf8");

try {
  const adoptedChapterId = await createAdoptedWriting();
  const context = await buildAdoptedWritingSettlementContext({
    adopted_chapter_id: adoptedChapterId,
    include_active_engine: true,
    include_writing_card: false,
    include_proofing_card: false,
    include_longline: false,
    include_foreshadowing_settlement_proposal_bridge: true,
    foreshadowing_settlement_diff_preview: {
      used: true,
      settlement_diff_preview: {
        paid_foreshadowing_debts: [
          {
            debt_id: "door_warning",
            payoff_id: "route_loss_payoff",
            payoff_types: ["action", "changed_state", "route_loss"],
            consequence: "The return route is sealed.",
          },
        ],
        kept_open_debts: [
          { debt_id: "mirror_name", reason: "still_open", promise: "The mirror name remains unresolved." },
        ],
        blocked_canon_intake_items: [],
        allowed_candidate_settlement_items: [
          { type: "foreshadowing_payoff_paid", debt_id: "door_warning", payoff_id: "route_loss_payoff" },
        ],
      },
    },
  }, options);

  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.used, true);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.phase, "27F");
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.no_canon_update, true);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.no_active_engine_update, true);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.pending_engine_candidate_created, false);
  assert.equal(context.context.foreshadowing_settlement_proposal_bridge.settlement_proposal_bridge.paid_count, 1);
  assert.equal(context.context.foreshadowing_settlement_diff_preview.paid_foreshadowing_debts.length, 1);
  assert.equal(context.context.pending_engine_candidate_created, false);
  assert.equal(context.context.active_engine_modified, false);

  const readContext = await getAdoptedWritingSettlementContext(
    context.context.settlement_context_id,
    options,
  );
  assert.match(readContext.settlement_for_chat, /Foreshadowing Settlement Proposal Bridge/u);
  assert.match(readContext.settlement_for_chat, /door_warning/u);
  assert.match(readContext.settlement_for_chat, /no_canon_update: true/u);
  assert.equal(hash(await readFile(activeEnginePath)), hash(activeText));
  assert.equal(hash(await readFile(projectPaths.activeEngine)), productionHash);

  console.log("Phase27F foreshadowing settlement proposal bridge tests passed.");
} finally {
  await Promise.all([
    ...Object.values(options)
      .filter((value) => value !== activeEnginePath)
      .map((directory) => rm(directory, { recursive: true, force: true })),
    rm(activeEnginePath, { force: true }),
  ]);
  await removeNew(transactionDir, transactionsBefore);
}
