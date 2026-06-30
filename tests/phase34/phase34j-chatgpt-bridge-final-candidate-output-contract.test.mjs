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

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
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

function assertRootSafety(result, label) {
  assert.equal(result.safety.candidate_only, true, `${label}: root safety candidate_only mismatch.`);
  assert.equal(result.safety.active_engine_update_allowed, false, `${label}: root safety active engine update mismatch.`);
  assert.equal(result.safety.canon_update_allowed, false, `${label}: root safety canon update mismatch.`);
  assert.equal(result.safety.direct_adoption_allowed, false, `${label}: root safety direct adoption mismatch.`);
  assert.equal(result.safety.approval_confirmed, false, `${label}: root safety approval confirmation mismatch.`);
  assert.equal(result.safety.adoption_confirmed, false, `${label}: root safety adoption confirmation mismatch.`);
  assert.equal(result.safety.rollback_executed, false, `${label}: root safety rollback mismatch.`);
  assert.equal(result.safety.recovery_executed, false, `${label}: root safety recovery mismatch.`);
}

function assertOuterBridgeSafety(bridge, label) {
  assert.equal(bridge.safety.can_modify_active_engine, false, `${label}: outer safety active engine modify mismatch.`);
  assert.equal(bridge.safety.can_modify_compressed_rules, false, `${label}: outer safety compressed rules modify mismatch.`);
  assert.equal(bridge.safety.can_activate_engine, false, `${label}: outer safety engine activation mismatch.`);
  assert.equal(bridge.safety.can_approve, false, `${label}: outer safety approval mismatch.`);
  assert.equal(bridge.safety.can_confirm_adoption, false, `${label}: outer safety adoption confirmation mismatch.`);
}

function assertEvidencePacket(packet, result, label) {
  assert(packet, `${label}: evidence packet missing.`);
  assert.equal(packet.used, true, `${label}: evidence packet should be used.`);
  assert.equal(packet.phase, "34D", `${label}: evidence packet phase mismatch.`);
  assert.equal(packet.packet_kind, "full_pipeline_acceptance_evidence_packet", `${label}: evidence packet kind mismatch.`);
  assert(["accepted", "accepted_after_revision"].includes(packet.status), `${label}: evidence packet status should be accepted-compatible.`);
  assert.equal(packet.read_only, true, `${label}: evidence packet read_only mismatch.`);
  assert.equal(packet.candidate_only, true, `${label}: evidence packet candidate_only mismatch.`);
  assert.equal(packet.no_candidate_save, true, `${label}: evidence packet candidate save boundary mismatch.`);
  assert.equal(packet.no_approval, true, `${label}: evidence packet approval boundary mismatch.`);
  assert.equal(packet.no_adoption, true, `${label}: evidence packet adoption boundary mismatch.`);
  assert.equal(packet.no_canon_update, true, `${label}: evidence packet canon boundary mismatch.`);
  assert.equal(packet.no_active_engine_update, true, `${label}: evidence packet active engine boundary mismatch.`);

  assert.equal(packet.pipeline_source.status, result.status, `${label}: packet source status should match root.`);
  assert.equal(packet.pipeline_source.pipeline_stage, result.pipeline_stage, `${label}: packet source stage should match root.`);
  assert.equal(packet.pipeline_source.final_candidate_hash, result.final_candidate_hash, `${label}: packet source hash should match root.`);
  assert.equal(packet.pipeline_source.final_candidate_source, result.final_candidate_source, `${label}: packet source final source should match root.`);
  assert.equal(packet.pipeline_source.candidate_created, false, `${label}: packet source candidate_created mismatch.`);
  assert.equal(packet.pipeline_source.canon_status, "candidate_only", `${label}: packet source canon_status mismatch.`);
  assert.equal(packet.pipeline_source.adopted, false, `${label}: packet source adopted mismatch.`);
  assert.equal(packet.pipeline_source.settled, false, `${label}: packet source settled mismatch.`);

  assert.equal(packet.acceptance_summary.accepted, true, `${label}: packet accepted mismatch.`);
  assert.equal(packet.acceptance_summary.soft_acceptance_reached, true, `${label}: packet soft acceptance mismatch.`);
  assert.equal(packet.acceptance_summary.revision_required_initially, true, `${label}: packet initial revision flag mismatch.`);
  assert.equal(packet.acceptance_summary.revision_required_finally, false, `${label}: packet final revision flag mismatch.`);
  assert.equal(packet.acceptance_summary.recursive_revision_used, true, `${label}: packet recursive revision flag mismatch.`);
  assert.equal(packet.acceptance_summary.rounds_attempted, 1, `${label}: packet rounds mismatch.`);
  assert.equal(packet.acceptance_summary.final_status, "accepted_after_revision", `${label}: packet final status mismatch.`);
  assert.equal(packet.acceptance_summary.pipeline_stage, result.pipeline_stage, `${label}: packet stage mismatch.`);
  assert.equal(packet.acceptance_summary.final_candidate_source, result.final_candidate_source, `${label}: packet final source mismatch.`);

  assert.equal(packet.decision_chain.reader_response_revision_gate.status, "revision_required", `${label}: packet initial gate status mismatch.`);
  assert.equal(packet.decision_chain.reader_response_revision_gate.revision_required, true, `${label}: packet initial gate flag mismatch.`);
  assert.equal(packet.decision_chain.recursive_revision_policy.status, "revision_required", `${label}: packet policy status mismatch.`);
  assert.equal(packet.decision_chain.final_reader_response_revision_gate.status, "no_revision_needed", `${label}: packet final gate status mismatch.`);
  assert.equal(packet.decision_chain.final_reader_response_revision_gate.revision_required, false, `${label}: packet final gate flag mismatch.`);
  assert(packet.operator_findings.length > 0, `${label}: packet operator findings missing.`);
}

function assertBridgeSurface(surface, result, label) {
  assert(surface, `${label}: bridge surface missing.`);
  assert.equal(surface.used, true, `${label}: bridge surface should be used.`);
  assert.equal(surface.phase, "34E", `${label}: bridge surface phase mismatch.`);
  assert.equal(surface.surface_kind, "full_pipeline_acceptance_evidence_packet_bridge_surface", `${label}: bridge surface kind mismatch.`);
  assert.equal(surface.bridge_surface, "chatgpt_bridge_single_entry", `${label}: bridge surface source mismatch.`);
  assert(["accepted", "accepted_after_revision"].includes(surface.status), `${label}: bridge surface status should be accepted-compatible.`);
  assert.equal(surface.read_only, true, `${label}: bridge surface read_only mismatch.`);
  assert.equal(surface.preview_only, true, `${label}: bridge surface preview_only mismatch.`);
  assert.equal(surface.no_candidate_save, true, `${label}: bridge surface candidate save boundary mismatch.`);
  assert.equal(surface.no_approval, true, `${label}: bridge surface approval boundary mismatch.`);
  assert.equal(surface.no_adoption, true, `${label}: bridge surface adoption boundary mismatch.`);
  assert.equal(surface.no_canon_update, true, `${label}: bridge surface canon boundary mismatch.`);
  assert.equal(surface.no_active_engine_update, true, `${label}: bridge surface active engine boundary mismatch.`);

  assert.equal(surface.acceptance_summary.accepted, true, `${label}: surface accepted mismatch.`);
  assert.equal(surface.acceptance_summary.soft_acceptance_reached, true, `${label}: surface soft acceptance mismatch.`);
  assert.equal(surface.acceptance_summary.revision_required_initially, true, `${label}: surface initial revision flag mismatch.`);
  assert.equal(surface.acceptance_summary.revision_required_finally, false, `${label}: surface final revision flag mismatch.`);
  assert.equal(surface.acceptance_summary.recursive_revision_used, true, `${label}: surface recursive revision flag mismatch.`);
  assert.equal(surface.acceptance_summary.rounds_attempted, 1, `${label}: surface rounds mismatch.`);
  assert.equal(surface.acceptance_summary.final_status, "accepted_after_revision", `${label}: surface final status mismatch.`);
  assert.equal(surface.acceptance_summary.pipeline_stage, result.pipeline_stage, `${label}: surface stage mismatch.`);
  assert.equal(surface.acceptance_summary.final_candidate_source, result.final_candidate_source, `${label}: surface final source mismatch.`);

  assert.equal(surface.decision_chain_summary.reader_response_revision_gate_status, "revision_required", `${label}: surface initial gate status mismatch.`);
  assert.equal(surface.decision_chain_summary.recursive_revision_policy_status, "revision_required", `${label}: surface policy status mismatch.`);
  assert.equal(surface.decision_chain_summary.final_reader_response_revision_gate_status, "no_revision_needed", `${label}: surface final gate status mismatch.`);
  assert.equal(surface.decision_chain_summary.final_reader_response_revision_required, false, `${label}: surface final gate flag mismatch.`);
  assert(surface.rewrite_targets.length > 0, `${label}: surface rewrite targets missing.`);
  assert(surface.operator_findings.length > 0, `${label}: surface operator findings missing.`);
  assert(surface.operator_cards.length >= 3, `${label}: surface operator cards missing.`);
  assert.equal(surface.next_action, "output_final_candidate_text_to_chat", `${label}: surface next action mismatch.`);

  assert.equal(surface.bridge_metadata.read_only_tool, true, `${label}: surface read-only metadata mismatch.`);
  assert.equal(surface.bridge_metadata.writes_files, false, `${label}: surface writes_files mismatch.`);
  assert.deepEqual(surface.bridge_metadata.writes_only_to, [], `${label}: surface writes_only_to mismatch.`);
  assert.equal(surface.bridge_metadata.source_phase, "34D", `${label}: surface source phase mismatch.`);
  assert.equal(surface.bridge_metadata.source_packet_available, true, `${label}: surface source packet availability mismatch.`);
  assert.equal(surface.bridge_metadata.chatgpt_safe_preview, true, `${label}: surface safe preview mismatch.`);

  assert.equal(surface.safety.mcp_can_generate, false, `${label}: surface generate safety mismatch.`);
  assert.equal(surface.safety.mcp_can_save_candidate, false, `${label}: surface save safety mismatch.`);
  assert.equal(surface.safety.mcp_can_approve, false, `${label}: surface approve safety mismatch.`);
  assert.equal(surface.safety.mcp_can_confirm_adoption, false, `${label}: surface adoption safety mismatch.`);
  assert.equal(surface.safety.mcp_can_activate_engine, false, `${label}: surface activation safety mismatch.`);
  assert.equal(surface.safety.mcp_can_update_canon, false, `${label}: surface canon safety mismatch.`);
  assert.equal(surface.safety.mcp_can_update_active_engine, false, `${label}: surface active engine safety mismatch.`);
}

function assertSummary(summary, result, label) {
  assert(summary, `${label}: summary missing.`);
  assert.equal(summary.used, true, `${label}: summary used mismatch.`);
  assert.equal(summary.pipeline_stage, result.pipeline_stage, `${label}: summary stage should match root.`);
  assert.equal(summary.writing_pipeline_complete, true, `${label}: summary writing completion mismatch.`);
  assert.equal(summary.acceptance_evidence_packet_bridge_surface_used, true, `${label}: summary bridge surface flag mismatch.`);
  assert.equal(summary.acceptance_evidence_final_status, "accepted_after_revision", `${label}: summary final status mismatch.`);
  assert.equal(summary.candidate_only, true, `${label}: summary candidate_only mismatch.`);
  assert.equal(summary.active_engine_update_allowed, false, `${label}: summary active engine boundary mismatch.`);
  assert.equal(summary.canon_update_allowed, false, `${label}: summary canon boundary mismatch.`);
}

function assertFinalCandidateContract(result, label) {
  assert.equal(result.ok, true, `${label}: ok mismatch.`);
  assert.equal(result.phase, "34A", `${label}: phase mismatch.`);
  assert.equal(result.name, "full-neural-writing-pipeline-single-entry-bridge", `${label}: bridge name mismatch.`);
  assert.equal(result.single_entry_bridge, true, `${label}: single entry marker mismatch.`);
  assert.equal(result.status, "completed", `${label}: status mismatch.`);
  assert.equal(result.pipeline_stage, "final_candidate_ready_after_revision", `${label}: pipeline stage mismatch.`);
  assert.equal(result.stop_reason, null, `${label}: stop reason should be null.`);
  assert.equal(result.single_entry_complete, true, `${label}: single entry completion mismatch.`);
  assert.equal(result.final_candidate_text, revisedDraft, `${label}: final candidate text mismatch.`);
  assert.equal(result.final_candidate_text.length > 0, true, `${label}: final candidate text must be non-empty.`);
  assert.equal(result.final_candidate_text.includes("朝日奈千夜，妳比我預想得快。"), true, `${label}: final hook should be visible.`);
  assert.equal(result.final_candidate_hash, sha256(revisedDraft), `${label}: final candidate hash mismatch.`);
  assert.equal(result.final_candidate_source, "backend_recursive_revision", `${label}: final candidate source mismatch.`);
  assert.equal(result.output_mode, "chat_text", `${label}: output mode mismatch.`);
  assert.equal(result.can_output_to_chat, true, `${label}: output gate mismatch.`);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat", `${label}: next action mismatch.`);

  assert.equal(result.candidate_created, false, `${label}: candidate_created mismatch.`);
  assert.equal(result.candidate_id, null, `${label}: candidate_id should be null.`);
  assert.equal(result.canon_status, "candidate_only", `${label}: canon status mismatch.`);
  assert.equal(result.adopted, false, `${label}: adopted mismatch.`);
  assert.equal(result.settled, false, `${label}: settled mismatch.`);

  assert.equal(result.pipeline_result.final_candidate_text, result.final_candidate_text, `${label}: pipeline final text should match root.`);
  assert.equal(result.pipeline_result.final_candidate_hash, result.final_candidate_hash, `${label}: pipeline final hash should match root.`);
  assert.equal(result.pipeline_result.pipeline_stage, result.pipeline_stage, `${label}: pipeline stage should match root.`);
  assert.equal(result.pipeline_result.status, result.status, `${label}: pipeline status should match root.`);
  assert.equal(result.pipeline_result.candidate_created, false, `${label}: pipeline candidate_created mismatch.`);
  assert.equal(result.pipeline_result.active_engine_update_allowed, false, `${label}: pipeline active engine boundary mismatch.`);
  assert.equal(result.pipeline_result.canon_update_allowed, false, `${label}: pipeline canon boundary mismatch.`);

  assert.equal(result.integrated_modules.full_recursive_writing_pipeline, true, `${label}: recursive pipeline integration mismatch.`);
  assert.equal(result.integrated_modules.reader_response_simulator, true, `${label}: reader simulator integration mismatch.`);
  assert.equal(result.integrated_modules.full_pipeline_acceptance_evidence_packet_bridge_surface, true, `${label}: bridge surface integration mismatch.`);
  assert.equal(result.integrated_modules.candidate_save_bridge, true, `${label}: candidate save bridge integration mismatch.`);
  assert.equal(result.integrated_modules.proofing_context_bridge, true, `${label}: proofing bridge integration mismatch.`);

  assertEvidencePacket(result.full_pipeline_acceptance_evidence_packet, result, label);
  assertBridgeSurface(result.full_pipeline_acceptance_evidence_packet_bridge_surface, result, label);
  assertSummary(result.full_neural_orchestration_summary, result, label);
  assertRootSafety(result, label);
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
  task_prompt: "Phase34J ChatGPT bridge final candidate output contract.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34j_final_candidate_output_contract: true,
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
        model_name: "deterministic-phase34j-final-output-contract",
        model_version: "initial-weak",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async (payload) => {
        revisionPayloads.push(payload);
        return {
          text: revisedDraft,
          model_name: "deterministic-phase34j-final-output-contract",
          model_version: "accepted-after-revision",
        };
      },
    },
  };
}

function assertRevisionPayloads(revisionPayloads, label) {
  assert.equal(revisionPayloads.length, 1, `${label}: exactly one revision payload expected.`);
  const payload = revisionPayloads[0];
  assert(payload.reader_response_revision_gate, `${label}: revision payload reader gate missing.`);
  assert(payload.recursive_revision_policy, `${label}: revision payload policy missing.`);
  assert(payload.revision_plan, `${label}: revision payload plan missing.`);
  assert.equal(payload.reader_response_revision_gate.revision_required, true, `${label}: payload gate revision flag mismatch.`);
  assert.equal(payload.recursive_revision_policy.revision_required, true, `${label}: payload policy revision flag mismatch.`);
  assert(payload.revision_plan.rewrite_targets.length > 0, `${label}: payload rewrite targets missing.`);
}

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, sha256(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34j-"));

try {
  const directRun = buildOptions("direct", tempRoot);
  const direct = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, directRun.options);
  assertFinalCandidateContract(direct, "direct single entry");
  assertRevisionPayloads(directRun.revisionPayloads, "direct single entry");

  const bridgeRun = buildOptions("chatgpt-bridge", tempRoot);
  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, bridgeRun.options);

  assert.equal(bridge.ok, true);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(bridge.permission, "write_low_risk");
  assert.deepEqual(bridge.created, []);
  assert.equal(bridge.blocked, false);
  assert.equal(bridge.blocked_reason, null);
  assert.equal(bridge.full_neural_orchestrator_used, true);
  assertSummary(bridge.full_neural_orchestration_summary, bridge.result, "outer chatgpt bridge");
  assertOuterBridgeSafety(bridge, "outer chatgpt bridge");
  assertFinalCandidateContract(bridge.result, "chatgpt bridge result");
  assertRevisionPayloads(bridgeRun.revisionPayloads, "chatgpt bridge result");

  assert.equal(
    bridge.full_neural_orchestration_summary.pipeline_stage,
    bridge.result.full_neural_orchestration_summary.pipeline_stage,
    "outer summary stage should match inner summary.",
  );
  assert.equal(
    bridge.full_neural_orchestration_summary.acceptance_evidence_final_status,
    bridge.result.full_neural_orchestration_summary.acceptance_evidence_final_status,
    "outer summary final status should match inner summary.",
  );

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34i = "tests/phase34/phase34i-full-pipeline-revision-evidence-bridge-regression.test.mjs";
  const phase34j = "tests/phase34/phase34j-chatgpt-bridge-final-candidate-output-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34i), "run-all missing Phase34I predecessor.");
  assert(runAllText.includes(phase34j), "run-all missing Phase34J registration.");
  assert(runAllText.indexOf(phase34i) < runAllText.indexOf(phase34j), "Phase34J should run after Phase34I.");
  assert(runAllText.indexOf(phase34j) < runAllText.indexOf(daily), "Phase34J should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34J ChatGPT bridge final candidate output contract tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
