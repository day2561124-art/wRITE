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

function assertSuccessOutputForChat(result, label) {
  const surface = result.success_output_for_chat;
  assert(surface, `${label}: success output surface missing.`);
  assert.equal(surface.used, true, `${label}: success surface should be used.`);
  assert.equal(surface.phase, "34M", `${label}: success surface phase mismatch.`);
  assert.equal(
    surface.surface_kind,
    "chatgpt_bridge_success_output_human_readable_surface",
    `${label}: success surface kind mismatch.`,
  );
  assert.equal(surface.status, "ready_to_output_final_candidate_text", `${label}: success surface status mismatch.`);
  assert.equal(surface.pipeline_stage, "final_candidate_ready_after_revision", `${label}: surface stage mismatch.`);
  assert.equal(surface.stop_reason, null, `${label}: surface stop reason mismatch.`);
  assert.equal(surface.next_action, "output_final_candidate_text_to_chat", `${label}: surface next action mismatch.`);
  assert.equal(surface.can_output_to_chat, true, `${label}: surface output gate mismatch.`);
  assert.equal(surface.must_output_exact_final_candidate_text, true, `${label}: exact output flag mismatch.`);
  assert.equal(
    surface.must_output_exact_final_candidate_text_reason,
    "final_candidate_text_ready_after_full_pipeline_acceptance",
    `${label}: exact output reason mismatch.`,
  );

  assert.equal(surface.final_candidate_text_to_output, result.final_candidate_text, `${label}: surface final text mismatch.`);
  assert.equal(surface.final_candidate_text_to_output, revisedDraft, `${label}: surface should carry exact revised draft.`);
  assert.equal(surface.final_candidate_hash, result.final_candidate_hash, `${label}: surface hash should match root.`);
  assert.equal(surface.final_candidate_hash, sha256(revisedDraft), `${label}: surface hash mismatch.`);
  assert.equal(surface.final_candidate_source, "backend_recursive_revision", `${label}: surface source mismatch.`);
  assert.equal(surface.final_candidate_length, revisedDraft.length, `${label}: surface length mismatch.`);

  assert.equal(
    surface.final_candidate_ready_summary.includes("backend_recursive_revision"),
    true,
    `${label}: ready summary should include final source.`,
  );
  assert.equal(
    surface.success_summary_for_chat.includes("output final_candidate_text exactly as provided"),
    true,
    `${label}: success summary should instruct exact output.`,
  );
  assert.equal(
    surface.success_summary_for_chat.includes("without rewriting, summarizing, or saving it as canon"),
    true,
    `${label}: success summary should forbid rewrite/summarize/canon save.`,
  );

  assert.equal(surface.reader_acceptance_summary_for_chat.reader_response_used, true, `${label}: reader response flag mismatch.`);
  assert.equal(surface.reader_acceptance_summary_for_chat.accepted, true, `${label}: reader acceptance mismatch.`);
  assert.equal(surface.reader_acceptance_summary_for_chat.final_status, "accepted_after_revision", `${label}: reader final status mismatch.`);
  assert.equal(surface.reader_acceptance_summary_for_chat.revision_required_initially, true, `${label}: initial revision flag mismatch.`);
  assert.equal(surface.reader_acceptance_summary_for_chat.revision_required_finally, false, `${label}: final revision flag mismatch.`);
  assert.equal(surface.reader_acceptance_summary_for_chat.soft_acceptance_reached, true, `${label}: soft acceptance mismatch.`);

  assert.equal(surface.revision_summary_for_chat.recursive_revision_used, true, `${label}: recursive revision flag mismatch.`);
  assert.equal(surface.revision_summary_for_chat.revision_rounds_attempted, 1, `${label}: revision rounds mismatch.`);
  assert.equal(surface.revision_summary_for_chat.max_revision_rounds, 2, `${label}: max revision rounds mismatch.`);
  assert.equal(surface.revision_summary_for_chat.final_candidate_source, "backend_recursive_revision", `${label}: revision final source mismatch.`);

  assert.equal(surface.evidence_packet_summary_for_chat.evidence_surface_available, true, `${label}: evidence availability mismatch.`);
  assert.equal(surface.evidence_packet_summary_for_chat.evidence_final_status, "accepted_after_revision", `${label}: evidence final status mismatch.`);
  assert(["accepted", "accepted_after_revision"].includes(surface.evidence_packet_summary_for_chat.bridge_surface_status), `${label}: bridge surface status mismatch.`);
  assert.equal(surface.evidence_packet_summary_for_chat.operator_findings_count > 0, true, `${label}: operator findings count missing.`);
  assert.equal(surface.evidence_packet_summary_for_chat.rewrite_targets_count > 0, true, `${label}: rewrite targets count missing.`);

  assert.equal(surface.candidate_output_contract.output_field, "final_candidate_text", `${label}: output field mismatch.`);
  assert.equal(surface.candidate_output_contract.must_output_exact, true, `${label}: output exact contract mismatch.`);
  assert.equal(surface.candidate_output_contract.may_rewrite, false, `${label}: rewrite permission mismatch.`);
  assert.equal(surface.candidate_output_contract.may_summarize, false, `${label}: summarize permission mismatch.`);
  assert.equal(surface.candidate_output_contract.may_save_candidate, false, `${label}: save permission mismatch.`);
  assert.equal(surface.candidate_output_contract.may_approve, false, `${label}: approve permission mismatch.`);
  assert.equal(surface.candidate_output_contract.may_adopt, false, `${label}: adopt permission mismatch.`);
  assert.equal(surface.candidate_output_contract.may_update_canon, false, `${label}: canon permission mismatch.`);
  assert.equal(surface.candidate_output_contract.may_update_active_engine, false, `${label}: active engine permission mismatch.`);
  assert.equal(surface.candidate_output_contract.output_mode, "chat_text", `${label}: output mode mismatch.`);
  assert.equal(surface.candidate_output_contract.final_candidate_hash, result.final_candidate_hash, `${label}: contract hash mismatch.`);
  assert.equal(surface.candidate_output_contract.final_candidate_source, result.final_candidate_source, `${label}: contract source mismatch.`);

  assert.equal(surface.safety.candidate_only, true, `${label}: surface safety candidate_only mismatch.`);
  assert.equal(surface.safety.no_candidate_save, true, `${label}: surface safety no_candidate_save mismatch.`);
  assert.equal(surface.safety.no_approval, true, `${label}: surface safety no_approval mismatch.`);
  assert.equal(surface.safety.no_adoption, true, `${label}: surface safety no_adoption mismatch.`);
  assert.equal(surface.safety.no_canon_update, true, `${label}: surface safety no_canon_update mismatch.`);
  assert.equal(surface.safety.no_active_engine_update, true, `${label}: surface safety active engine mismatch.`);
  assert.equal(surface.safety.can_modify_active_engine, false, `${label}: surface safety active engine modify mismatch.`);
  assert.equal(surface.safety.can_update_canon, false, `${label}: surface safety canon update mismatch.`);
  assert.equal(surface.safety.can_confirm_adoption, false, `${label}: surface safety adoption mismatch.`);
}

function assertSuccessSummary(result, label) {
  const summary = result.full_neural_orchestration_summary;
  assert(summary, `${label}: full neural summary missing.`);
  assert.equal(summary.used, true, `${label}: summary used mismatch.`);
  assert.equal(summary.pipeline_stage, "final_candidate_ready_after_revision", `${label}: summary stage mismatch.`);
  assert.equal(summary.writing_pipeline_complete, true, `${label}: summary completion mismatch.`);
  assert.equal(summary.acceptance_evidence_packet_bridge_surface_used, true, `${label}: evidence surface flag mismatch.`);
  assert.equal(summary.acceptance_evidence_final_status, "accepted_after_revision", `${label}: evidence final status mismatch.`);
  assert.equal(summary.failure_output_surface_used, false, `${label}: failure surface should not be used.`);
  assert.equal(summary.failure_output_next_action, null, `${label}: failure next action should be null.`);
  assert.equal(summary.failure_output_blocked_stage, null, `${label}: failure blocked stage should be null.`);
  assert.equal(summary.success_output_surface_used, true, `${label}: success surface flag mismatch.`);
  assert.equal(summary.success_output_next_action, "output_final_candidate_text_to_chat", `${label}: success next action mismatch.`);
  assert.equal(summary.success_output_final_candidate_hash, sha256(revisedDraft), `${label}: success summary hash mismatch.`);
  assert.equal(summary.candidate_only, true, `${label}: summary candidate_only mismatch.`);
  assert.equal(summary.active_engine_update_allowed, false, `${label}: summary active engine mismatch.`);
  assert.equal(summary.canon_update_allowed, false, `${label}: summary canon mismatch.`);
}

function assertFinalCandidateRoot(result, label) {
  assert.equal(result.ok, true, `${label}: ok mismatch.`);
  assert.equal(result.phase, "34A", `${label}: phase mismatch.`);
  assert.equal(result.name, "full-neural-writing-pipeline-single-entry-bridge", `${label}: bridge name mismatch.`);
  assert.equal(result.single_entry_bridge, true, `${label}: single entry marker mismatch.`);
  assert.equal(result.status, "completed", `${label}: status mismatch.`);
  assert.equal(result.pipeline_stage, "final_candidate_ready_after_revision", `${label}: pipeline stage mismatch.`);
  assert.equal(result.stop_reason, null, `${label}: stop reason should be null.`);
  assert.equal(result.single_entry_complete, true, `${label}: single entry completion mismatch.`);
  assert.equal(result.final_candidate_text, revisedDraft, `${label}: final candidate text mismatch.`);
  assert.equal(result.final_candidate_hash, sha256(revisedDraft), `${label}: final candidate hash mismatch.`);
  assert.equal(result.final_candidate_source, "backend_recursive_revision", `${label}: final candidate source mismatch.`);
  assert.equal(result.output_mode, "chat_text", `${label}: output mode mismatch.`);
  assert.equal(result.can_output_to_chat, true, `${label}: root output gate mismatch.`);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat", `${label}: root next action mismatch.`);

  assert.equal(result.candidate_created, false, `${label}: candidate_created mismatch.`);
  assert.equal(result.candidate_id, null, `${label}: candidate_id should be null.`);
  assert.equal(result.canon_status, "candidate_only", `${label}: canon status mismatch.`);
  assert.equal(result.adopted, false, `${label}: adopted mismatch.`);
  assert.equal(result.settled, false, `${label}: settled mismatch.`);

  assert.equal(result.failure_output_for_chat.used, false, `${label}: failure surface should not be used.`);
  assert.equal(result.failure_output_for_chat.reason, "final_candidate_available", `${label}: failure surface reason mismatch.`);

  assert.equal(result.pipeline_result.final_candidate_text, result.final_candidate_text, `${label}: pipeline final text should match root.`);
  assert.equal(result.pipeline_result.final_candidate_hash, result.final_candidate_hash, `${label}: pipeline final hash should match root.`);
  assert.equal(result.pipeline_result.pipeline_stage, result.pipeline_stage, `${label}: pipeline stage should match root.`);
  assert.equal(result.pipeline_result.status, result.status, `${label}: pipeline status should match root.`);
  assert.equal(result.pipeline_result.candidate_created, false, `${label}: pipeline candidate_created mismatch.`);
  assert.equal(result.pipeline_result.active_engine_update_allowed, false, `${label}: pipeline active engine boundary mismatch.`);
  assert.equal(result.pipeline_result.canon_update_allowed, false, `${label}: pipeline canon boundary mismatch.`);

  assert.equal(result.full_pipeline_acceptance_evidence_packet.used, true, `${label}: evidence packet should be used.`);
  assert.equal(result.full_pipeline_acceptance_evidence_packet.acceptance_summary.final_status, "accepted_after_revision", `${label}: packet final status mismatch.`);
  assert.equal(result.full_pipeline_acceptance_evidence_packet_bridge_surface.used, true, `${label}: evidence surface should be used.`);
  assert.equal(result.full_pipeline_acceptance_evidence_packet_bridge_surface.acceptance_summary.final_status, "accepted_after_revision", `${label}: surface final status mismatch.`);

  assertSuccessOutputForChat(result, label);
  assertSuccessSummary(result, label);
  assertRootSafety(result, label);
}

function assertBridgeSuccessSurface(bridge, label) {
  assert.equal(bridge.ok, true, `${label}: outer ok mismatch.`);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline", `${label}: tool name mismatch.`);
  assert.equal(bridge.permission, "write_low_risk", `${label}: permission mismatch.`);
  assert.deepEqual(bridge.created, [], `${label}: created outputs should be empty.`);
  assert.equal(bridge.blocked, false, `${label}: bridge should not be blocked.`);
  assert.equal(bridge.blocked_reason, null, `${label}: blocked reason should be null.`);
  assert.equal(bridge.full_neural_orchestrator_used, true, `${label}: full neural flag mismatch.`);

  assertSuccessSummary(bridge.result, `${label} outer result summary`);
  assertFinalCandidateRoot(bridge.result, `${label} result`);

  assert.equal(
    bridge.full_neural_orchestration_summary.pipeline_stage,
    bridge.result.full_neural_orchestration_summary.pipeline_stage,
    `${label}: outer summary stage should match inner summary.`,
  );
  assert.equal(
    bridge.full_neural_orchestration_summary.success_output_surface_used,
    bridge.result.full_neural_orchestration_summary.success_output_surface_used,
    `${label}: outer success surface flag should match inner summary.`,
  );
  assert.equal(
    bridge.full_neural_orchestration_summary.success_output_next_action,
    bridge.result.full_neural_orchestration_summary.success_output_next_action,
    `${label}: outer success next action should match inner summary.`,
  );
  assert.equal(
    bridge.full_neural_orchestration_summary.success_output_final_candidate_hash,
    bridge.result.full_neural_orchestration_summary.success_output_final_candidate_hash,
    `${label}: outer success hash should match inner summary.`,
  );

  assert.equal(bridge.safety.can_modify_active_engine, false, `${label}: outer safety active engine modify mismatch.`);
  assert.equal(bridge.safety.can_modify_compressed_rules, false, `${label}: outer safety compressed rules mismatch.`);
  assert.equal(bridge.safety.can_activate_engine, false, `${label}: outer safety activation mismatch.`);
  assert.equal(bridge.safety.can_approve, false, `${label}: outer safety approval mismatch.`);
  assert.equal(bridge.safety.can_confirm_adoption, false, `${label}: outer safety adoption mismatch.`);
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
  task_prompt: "Phase34M ChatGPT bridge success readable surface.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    phase34m_success_readable_surface: true,
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
        model_name: "deterministic-phase34m-success-readable-surface",
        model_version: "initial-weak",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async (payload) => {
        revisionPayloads.push(payload);
        return {
          text: revisedDraft,
          model_name: "deterministic-phase34m-success-readable-surface",
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34m-"));

try {
  const directRun = buildOptions("direct", tempRoot);
  const direct = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, directRun.options);
  assertFinalCandidateRoot(direct, "direct single entry");
  assertRevisionPayloads(directRun.revisionPayloads, "direct single entry");

  const bridgeRun = buildOptions("chatgpt-bridge", tempRoot);
  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, bridgeRun.options);
  assertBridgeSuccessSurface(bridge, "chatgpt bridge");
  assertRevisionPayloads(bridgeRun.revisionPayloads, "chatgpt bridge");

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34l = "tests/phase34/phase34l-chatgpt-bridge-failure-readable-surface.test.mjs";
  const phase34m = "tests/phase34/phase34m-chatgpt-bridge-success-readable-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34l), "run-all missing Phase34L predecessor.");
  assert(runAllText.includes(phase34m), "run-all missing Phase34M registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase34l) < runAllText.indexOf(phase34m), "Phase34M should run after Phase34L.");
  assert(runAllText.indexOf(phase34m) < runAllText.indexOf(daily), "Phase34M should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(sha256(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34M ChatGPT bridge success readable surface tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
