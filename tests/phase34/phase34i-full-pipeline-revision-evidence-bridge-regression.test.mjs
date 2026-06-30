import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { runFullNeuralWritingPipelineSingleEntryBridge } from "../../server/src/full-neural-writing-pipeline-single-entry-bridge-service.mjs";
import { chatgpt_bridge_run_full_neural_writing_pipeline } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();
const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];

const transactionDir = path.join(projectPaths.outputLogs, "transactions");

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

function assertSafety(result, label) {
  assert.equal(result.candidate_created, false, `${label}: candidate should not be saved.`);
  assert.equal(result.can_output_to_chat, true, `${label}: final candidate should be bridge-readable.`);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat", `${label}: next action should be chat output.`);
  assert.equal(result.pipeline_result.active_engine_update_allowed, false, `${label}: active engine update must stay blocked.`);
  assert.equal(result.pipeline_result.canon_update_allowed, false, `${label}: canon update must stay blocked.`);
  assert.equal(result.safety?.can_modify_active_engine ?? false, false, `${label}: bridge must not modify active engine.`);
  assert.equal(result.safety?.can_activate_engine ?? false, false, `${label}: bridge must not activate engine.`);
  assert.equal(result.safety?.can_confirm_adoption ?? false, false, `${label}: bridge must not confirm adoption.`);
}

function assertEvidencePacket(packet, finalText, label) {
  assert(packet, `${label}: evidence packet missing.`);
  assert.equal(packet.used, true, `${label}: packet should be used.`);
  assert.equal(packet.phase, "34D", `${label}: packet phase should be 34D.`);
  assert.equal(packet.packet_kind, "full_pipeline_acceptance_evidence_packet", `${label}: packet kind mismatch.`);
  assert.equal(packet.acceptance_summary.accepted, true, `${label}: packet should mark accepted.`);
  assert.equal(packet.acceptance_summary.soft_acceptance_reached, true, `${label}: soft acceptance should be reached.`);
  assert.equal(packet.acceptance_summary.revision_required_initially, true, `${label}: initial revision should be required.`);
  assert.equal(packet.acceptance_summary.revision_required_finally, false, `${label}: final revision should not be required.`);
  assert.equal(packet.acceptance_summary.recursive_revision_used, true, `${label}: recursive revision should be used.`);
  assert.equal(packet.acceptance_summary.rounds_attempted, 1, `${label}: exactly one revision round expected.`);
  assert.equal(packet.acceptance_summary.final_status, "accepted_after_revision", `${label}: final status mismatch.`);
  assert.equal(packet.acceptance_summary.pipeline_stage, "final_candidate_ready_after_revision", `${label}: pipeline stage mismatch.`);
  assert.equal(packet.decision_chain.reader_response_revision_gate.status, "revision_required", `${label}: initial gate should require revision.`);
  assert.equal(packet.decision_chain.reader_response_revision_gate.revision_required, true, `${label}: initial gate revision flag mismatch.`);
  assert.equal(packet.decision_chain.recursive_revision_policy.status, "revision_required", `${label}: policy should require revision.`);
  assert.equal(packet.decision_chain.final_reader_response_revision_gate.status, "no_revision_needed", `${label}: final gate should accept.`);
  assert.equal(packet.decision_chain.final_reader_response_revision_gate.revision_required, false, `${label}: final gate revision flag mismatch.`);
  assert(packet.decision_chain.revision_rounds.length >= 1, `${label}: revision round evidence missing.`);
  assert(packet.operator_findings.length > 0, `${label}: operator findings should be exposed.`);
  assert(packet.operator_findings.some((finding) => finding.source === "reader_response_revision_gate"), `${label}: reader gate finding missing.`);
  assert(packet.operator_findings.some((finding) => finding.rewrite_targets.length > 0), `${label}: rewrite targets missing.`);
  assert.notEqual(hash(finalText), "", `${label}: final text hash should be derivable.`);
}

function assertBridgeSurface(surface, label) {
  assert(surface, `${label}: bridge surface missing.`);
  assert.equal(surface.used, true, `${label}: surface should be used.`);
  assert.equal(surface.phase, "34E", `${label}: surface phase should be 34E.`);
  assert.equal(surface.surface_kind, "full_pipeline_acceptance_evidence_packet_bridge_surface", `${label}: surface kind mismatch.`);
  assert.equal(surface.bridge_surface, "chatgpt_bridge_single_entry", `${label}: bridge surface mismatch.`);
  assert.equal(surface.acceptance_summary.accepted, true, `${label}: surface should mark accepted.`);
  assert.equal(surface.acceptance_summary.soft_acceptance_reached, true, `${label}: soft acceptance should be visible.`);
  assert.equal(surface.acceptance_summary.revision_required_initially, true, `${label}: initial revision should be visible.`);
  assert.equal(surface.acceptance_summary.revision_required_finally, false, `${label}: final acceptance should be visible.`);
  assert.equal(surface.acceptance_summary.recursive_revision_used, true, `${label}: recursive revision should be visible.`);
  assert.equal(surface.acceptance_summary.rounds_attempted, 1, `${label}: surface rounds mismatch.`);
  assert.equal(surface.acceptance_summary.final_status, "accepted_after_revision", `${label}: surface final status mismatch.`);
  assert.equal(surface.acceptance_summary.pipeline_stage, "final_candidate_ready_after_revision", `${label}: surface pipeline stage mismatch.`);
  assert.equal(surface.decision_chain_summary.reader_response_revision_gate_status, "revision_required", `${label}: surface initial gate status mismatch.`);
  assert.equal(surface.decision_chain_summary.recursive_revision_policy_status, "revision_required", `${label}: surface policy status mismatch.`);
  assert.equal(surface.decision_chain_summary.final_reader_response_revision_gate_status, "no_revision_needed", `${label}: surface final gate status mismatch.`);
  assert(surface.rewrite_targets.length > 0, `${label}: surface rewrite targets missing.`);
  assert(surface.operator_findings.length > 0, `${label}: surface operator findings missing.`);
  assert(surface.operator_cards.length >= 3, `${label}: surface operator cards missing.`);
  assert.equal(surface.next_action, "output_final_candidate_text_to_chat", `${label}: surface next action mismatch.`);
  assert.equal(surface.read_only, true, `${label}: surface should be read-only.`);
  assert.equal(surface.preview_only, true, `${label}: surface should be preview-only.`);
  assert.equal(surface.no_candidate_save, true, `${label}: surface should not save candidates.`);
  assert.equal(surface.no_approval, true, `${label}: surface should not approve.`);
  assert.equal(surface.no_adoption, true, `${label}: surface should not adopt.`);
  assert.equal(surface.no_canon_update, true, `${label}: surface should not update canon.`);
  assert.equal(surface.no_active_engine_update, true, `${label}: surface should not update active engine.`);
  assert.equal(surface.bridge_metadata.read_only_tool, true, `${label}: bridge metadata read-only mismatch.`);
  assert.equal(surface.bridge_metadata.writes_files, false, `${label}: bridge surface must not write files.`);
  assert.deepEqual(surface.bridge_metadata.writes_only_to, [], `${label}: bridge writes target should be empty.`);
}

const conflictPlan = {
  protagonist: "朝日奈千夜",
  protagonist_want: "在門禁鎖死前確認門內是否有人偽造她的名字。",
  opposition: "九逃的阻止、門禁倒數、以及門內提前知道千夜名字的人。",
  opposition_pressure: "九逃知道進門後退路會消失，門禁倒數會讓她們失去唯一追蹤線。",
  stakes: "等待會失去追蹤線，進入會讓她們被迫留在無法回頭的地下區域。",
  reversal_or_reveal: "開門不是取得通行權，而是讓舊路線從終端地圖上被刪除。",
  required_choice: "千夜必須在保留退路與抓住門內線索之間選擇。",
  cost_or_payment: "她按下門禁後，九逃標記過的撤離路線全部熄滅。",
  new_status_quo: "千夜與九逃被迫進入不能回頭的新戰場，且門內的人已經掌握她的名字。",
  ending_hook: "門內的人在她開口前先喊出朝日奈千夜的名字。",
};

const weakDraft = [
  "千夜與九逃抵達地下走廊，開始確認門禁資料。終端顯示狀態正在更新，兩人依照流程理解目前的訊號與路線。",
  "九逃認為應該等待支援，千夜認為可以繼續調查。她們把門禁、支援、回報與路線條件整理完，知道情況有風險。",
  "最後她們決定之後再看。現場暫時安靜下來，後續可能會有新的發展。",
].join("\n\n");

const revisedDraft = [
  "門禁燈第二次閃紅時，千夜把手掌按上感應板。九逃從她身後抓住她的袖口，指節用力到發白。",
  "「等一下，不能現在開。」他說。",
  "終端地圖在兩人中間亮著。九逃剛才標好的撤離線一格一格變暗，像有人隔著螢幕把橋抽走。千夜看見最後一條灰線還在閃，倒數只剩七秒。",
  "「不開，線索就斷。」千夜說。",
  "「開了，我們就回不來。」九逃的聲音壓得很低，卻不是退縮。他在阻止她，也是在把選擇推回她手上。",
  "千夜沒有甩開他。她只是把另一隻手伸過去，替九逃把終端固定在他掌心。",
  "「記住剛才消失的路。」她說。「如果我判斷錯，你罵我。」",
  "「我現在就想罵。」",
  "「那就邊跑邊罵。」",
  "門開的瞬間，地圖上的舊路線全數熄滅。九逃罵了一聲，還是追上她。兩人跨進門內，身後的門像一塊沉下去的鐵，把走廊的回音切斷。",
  "黑暗裡有人先笑了一下。",
  "「朝日奈千夜，妳比我預想得快。」",
].join("\n\n");

const baseInput = {
  task_prompt: "Phase34I full pipeline revision evidence bridge regression.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34i_revision_evidence_bridge_regression: true,
  },
  retrieval_context: {
    scope: "candidate only",
    canon_write_allowed: false,
    active_engine_update_allowed: false,
  },
  character_names: ["朝日奈千夜", "九逃"],
  reader_response_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: [
    "門內的人為什麼知道朝日奈千夜的名字？",
    "九逃記住的熄滅路線之後能不能變成逃生線？",
  ],
  save_candidate: false,
  build_proofing_context: false,
  max_revision_rounds: 2,
  enable_character_voice_guard: false,
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: false,
  include_foreshadowing_payoff_guard: false,
  include_foreshadowing_payoff_repair_planner: false,
  include_foreshadowing_payoff_acceptance_gate: false,
  include_foreshadowing_settlement_diff_preview: false,
  include_reader_response_revision_gate: true,
  include_reader_response_simulator: true,
  include_aesthetic_memory_context: false,
};

const deterministicFinalPolisherAdapter = async ({ raw_draft_text }) => ({
  status: "completed",
  polished_text: raw_draft_text,
  needs_structural_revision: false,
  suggested_return_stage: null,
  revision_report: {
    structural_gate: {
      reasons: [],
      suggested_return_stage: null,
    },
    risk_flags: [],
  },
  warnings: [],
});

function buildOptions(label, tempRoot) {
  const revisionPayloads = [];
  return {
    revisionPayloads,
    options: {
      gptWritingContexts: path.join(tempRoot, label, "contexts"),
      writingCandidates: path.join(tempRoot, label, "candidates"),
      proofingContexts: path.join(tempRoot, label, "proofing"),
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-phase34i-evidence-bridge",
        model_version: "initial-weak",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async (payload) => {
        revisionPayloads.push(payload);
        return {
          text: revisedDraft,
          model_name: "deterministic-phase34i-evidence-bridge",
          model_version: "accepted-after-revision",
        };
      },
    },
  };
}

function assertAcceptedAfterRevisionResult(result, revisionPayloads, label) {
  assert.equal(result.ok, true, `${label}: bridge wrapper ok mismatch.`);
  assert.equal(result.status, "completed", `${label}: status mismatch.`);
  assert.equal(result.single_entry_complete, true, `${label}: single entry should complete.`);
  assert.equal(result.pipeline_stage, "final_candidate_ready_after_revision", `${label}: pipeline stage mismatch.`);
  assert.equal(result.final_candidate_source, "backend_recursive_revision", `${label}: final candidate source mismatch.`);
  assert.equal(result.final_candidate_text, revisedDraft, `${label}: final candidate text mismatch.`);
  assert.equal(result.final_candidate_text.includes("朝日奈千夜，妳比我預想得快"), true, `${label}: final hook missing.`);
  assert.equal(result.candidate_created, false, `${label}: candidate must not be created.`);
  assert.equal(result.can_output_to_chat, true, `${label}: output to chat should be allowed.`);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat", `${label}: next action mismatch.`);
  assert.equal(revisionPayloads.length, 1, `${label}: exactly one revision payload expected.`);
  assert(revisionPayloads[0].reader_response_revision_gate, `${label}: revision payload should include reader gate.`);
  assert(revisionPayloads[0].recursive_revision_policy, `${label}: revision payload should include recursive policy.`);
  assert(revisionPayloads[0].revision_plan, `${label}: revision payload should include revision plan.`);
  assert(revisionPayloads[0].reader_response_revision_gate.revision_required, `${label}: revision payload gate should require revision.`);
  assert(revisionPayloads[0].recursive_revision_policy.revision_required, `${label}: revision payload policy should require revision.`);

  assert.equal(result.integrated_modules.full_recursive_writing_pipeline, true, `${label}: full recursive pipeline should be integrated.`);
  assert.equal(result.integrated_modules.reader_response_simulator, true, `${label}: reader response simulator should be integrated.`);
  assert(result.full_pipeline_acceptance_evidence_packet, `${label}: root evidence packet should be present.`);
  assert(result.pipeline_result.full_pipeline_acceptance_evidence_packet, `${label}: pipeline evidence packet should be present.`);
  assert.equal(result.integrated_modules.full_pipeline_acceptance_evidence_packet_bridge_surface, true, `${label}: bridge surface should be integrated.`);

  assert.equal(result.pipeline_result.recursive_revision.used, true, `${label}: recursive revision should be used.`);
  assert.equal(result.pipeline_result.recursive_revision.status, "revised", `${label}: recursive revision status mismatch.`);
  assert.equal(result.pipeline_result.recursive_revision.rounds_attempted, 1, `${label}: recursive revision rounds mismatch.`);
  assert.equal(result.pipeline_result.reader_response_revision_gate.status, "no_revision_needed", `${label}: final pipeline gate status mismatch.`);
  assert.equal(result.pipeline_result.reader_response_revision_gate.revision_required, false, `${label}: final pipeline gate flag mismatch.`);

  assertEvidencePacket(result.full_pipeline_acceptance_evidence_packet, result.final_candidate_text, label);
  assertBridgeSurface(result.full_pipeline_acceptance_evidence_packet_bridge_surface, label);
  assertSafety(result, label);

  assert.equal(
    result.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used,
    true,
    `${label}: orchestration summary bridge surface flag mismatch.`,
  );
  assert.equal(
    result.full_neural_orchestration_summary.acceptance_evidence_final_status,
    "accepted_after_revision",
    `${label}: orchestration summary final status mismatch.`,
  );
}

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34i-"));

try {
  const directRun = buildOptions("direct", tempRoot);
  const direct = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, directRun.options);
  assertAcceptedAfterRevisionResult(direct, directRun.revisionPayloads, "direct single entry");

  const bridgeRun = buildOptions("chatgpt-bridge", tempRoot);
  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, bridgeRun.options);
  assert.equal(bridge.ok, true);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(bridge.permission, "write_low_risk");
  assert.equal(bridge.full_neural_orchestrator_used, true);
  assert.equal(bridge.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used, true);
  assert.equal(bridge.full_neural_orchestration_summary.acceptance_evidence_final_status, "accepted_after_revision");
  assert.equal(bridge.safety.can_modify_active_engine, false);
  assert.equal(bridge.safety.can_modify_compressed_rules, false);
  assert.equal(bridge.safety.can_activate_engine, false);
  assert.equal(bridge.safety.can_approve, false);
  assert.equal(bridge.safety.can_confirm_adoption, false);
  assertAcceptedAfterRevisionResult(bridge.result, bridgeRun.revisionPayloads, "chatgpt bridge result");

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34h = "tests/phase34/phase34h-full-pipeline-reader-acceptance-regression-matrix.test.mjs";
  const phase34i = "tests/phase34/phase34i-full-pipeline-revision-evidence-bridge-regression.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34h), "run-all missing Phase34H predecessor.");
  assert(runAllText.includes(phase34i), "run-all missing Phase34I registration.");
  assert(runAllText.indexOf(phase34h) < runAllText.indexOf(phase34i), "Phase34I should run after Phase34H.");
  assert(runAllText.indexOf(phase34i) < runAllText.indexOf(daily), "Phase34I should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34I full pipeline revision evidence bridge regression tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
