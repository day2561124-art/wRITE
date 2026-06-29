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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function assertBridgeSurface(surface) {
  assert(surface, "Phase34E bridge surface should be present.");
  assert.equal(surface.used, true);
  assert.equal(surface.phase, "34E");
  assert.equal(surface.surface_kind, "full_pipeline_acceptance_evidence_packet_bridge_surface");
  assert.equal(surface.bridge_surface, "chatgpt_bridge_single_entry");
  assert.equal(surface.acceptance_summary.accepted, true);
  assert.equal(surface.acceptance_summary.soft_acceptance_reached, true);
  assert.equal(surface.acceptance_summary.revision_required_initially, true);
  assert.equal(surface.acceptance_summary.revision_required_finally, false);
  assert.equal(surface.acceptance_summary.recursive_revision_used, true);
  assert.equal(surface.acceptance_summary.final_status, "accepted_after_revision");
  assert.equal(surface.decision_chain_summary.reader_response_revision_gate_status, "revision_required");
  assert.equal(surface.decision_chain_summary.recursive_revision_policy_status, "revision_required");
  assert.equal(surface.decision_chain_summary.final_reader_response_revision_gate_status, "no_revision_needed");
  assert(surface.rewrite_targets.length > 0, "Bridge surface should expose rewrite targets.");
  assert(surface.operator_findings.length > 0, "Bridge surface should expose operator findings.");
  assert(surface.operator_cards.length >= 3, "Bridge surface should expose operator cards.");
  assert.equal(surface.next_action, "output_final_candidate_text_to_chat");

  assert.equal(surface.read_only, true);
  assert.equal(surface.integration_only, true);
  assert.equal(surface.candidate_only, true);
  assert.equal(surface.report_only, true);
  assert.equal(surface.preview_only, true);
  assert.equal(surface.no_generation, true);
  assert.equal(surface.no_auto_persist, true);
  assert.equal(surface.no_candidate_save, true);
  assert.equal(surface.no_approval, true);
  assert.equal(surface.no_adoption, true);
  assert.equal(surface.no_canon_update, true);
  assert.equal(surface.no_active_engine_update, true);
  assert.equal(surface.no_compressed_rules_update, true);
  assert.equal(surface.no_settlement_update, true);
  assert.equal(surface.bridge_metadata.read_only_tool, true);
  assert.equal(surface.bridge_metadata.writes_files, false);
  assert.deepEqual(surface.bridge_metadata.writes_only_to, []);
  assert.equal(surface.safety.mcp_can_generate, false);
  assert.equal(surface.safety.mcp_can_save_candidate, false);
  assert.equal(surface.safety.mcp_can_approve, false);
  assert.equal(surface.safety.mcp_can_confirm_adoption, false);
  assert.equal(surface.safety.mcp_can_activate_engine, false);
  assert.equal(surface.safety.mcp_can_update_canon, false);
  assert.equal(surface.safety.mcp_can_update_active_engine, false);
  assert.equal(surface.safety.mcp_can_update_compressed_rules, false);
  assert.equal(surface.safety.mcp_can_update_settlement, false);
}

function assertEvidencePacket(packet) {
  assert(packet, "Phase34D evidence packet should be present.");
  assert.equal(packet.used, true);
  assert.equal(packet.phase, "34D");
  assert.equal(packet.packet_kind, "full_pipeline_acceptance_evidence_packet");
  assert.equal(packet.acceptance_summary.accepted, true);
  assert.equal(packet.acceptance_summary.soft_acceptance_reached, true);
  assert.equal(packet.acceptance_summary.revision_required_initially, true);
  assert.equal(packet.acceptance_summary.revision_required_finally, false);
  assert.equal(packet.acceptance_summary.recursive_revision_used, true);
  assert.equal(packet.acceptance_summary.final_status, "accepted_after_revision");
  assert.equal(packet.decision_chain.reader_response_revision_gate.status, "revision_required");
  assert.equal(packet.decision_chain.recursive_revision_policy.status, "revision_required");
  assert.equal(packet.decision_chain.final_reader_response_revision_gate.status, "no_revision_needed");
  assert(packet.operator_findings.length > 0, "Evidence packet should expose operator findings.");
}

const conflictPlan = {
  protagonist: "朝日奈千夜",
  protagonist_want: "在城域封鎖前帶九逃穿過舊訓練棟地下走廊，確認門內是否有人偽造她的名字。",
  opposition: "九逃的阻止、門禁倒數、以及門內提前知道千夜名字的人。",
  opposition_pressure: "九逃知道進門後退路會消失，門禁倒數會讓她們失去唯一追蹤線。",
  stakes: "等待會失去追蹤線，進入會讓她們被迫留在無法回頭的地下區域。",
  reversal_or_reveal: "開門不是取得通行權，而是讓舊路線從終端地圖上被刪除。",
  required_choice: "千夜必須在保留退路與抓住門內線索之間選擇。",
  cost_or_payment: "她按下門禁後，九逃標記過的撤離路線全部熄滅。",
  new_status_quo: "千夜與九逃被迫進入不能回頭的新戰場，且門內的人已經掌握她的名字。",
  ending_hook: "門內的人在她開口前先喊出『朝日奈千夜』。",
};

const weakDraft = [
  "千夜與九逃抵達舊訓練棟地下走廊後，開始確認相關資料。終端系統顯示門禁狀態正在更新，兩人依照目前流程判讀場地狀況，並確認門內可能存在需要追蹤的訊號。",
  "九逃認為應該先回報，千夜則認為可以繼續調查。她們整理了門禁、路線、訊號與支援條件，知道情況有一些風險，但所有內容都還在可判斷範圍內。",
  "最後她們決定進入門內。事情暫時安靜下來，接下來應該會有新的發展。",
].join("\n\n");

const firstRevisionStillWeak = [
  "門禁燈閃了一下，千夜往前走，九逃跟在後面。他們看見終端上的資料改變，也知道路線可能會受到影響，所以千夜準備把門打開。",
  "九逃提醒她不能太快行動，千夜聽見了，但是她還是需要確認門內線索。兩人都知道如果等待會失去機會，如果進去也可能會失去退路。",
  "門打開後，終端上的地圖有一些變化。她們進入門內，場面因此產生了新的狀況。",
].join("\n\n");

const finalLiveRevision = [
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

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34f-"));

const baseInput = {
  task_prompt: "Phase34F live writing smoke for 武裝學院：turn a report-like corridor scene into a pressure-bearing candidate chapter beat.",
  generation_context: {
    project: "武裝學院的二三事",
    chapter_mode: "candidate only",
    scene: "舊訓練棟地下走廊，門禁倒數，門內有人知道千夜名字。",
    live_writing_smoke: true,
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
  aesthetic_memory_context: {
    principles: [
      "一章一變局。",
      "普通行動先直寫，幽默只能加味。",
      "角色對話不能公告式交接。",
      "不要把能力或系統當成日常捷徑。",
    ],
  },
  save_candidate: false,
  build_proofing_context: false,
  max_revision_rounds: 3,
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
  include_aesthetic_memory_context: true,
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

function buildOptions(label) {
  const revisionPayloads = [];
  let revisionCalls = 0;

  return {
    revisionPayloads,
    options: {
      gptWritingContexts: path.join(tempRoot, label, "contexts"),
      writingCandidates: path.join(tempRoot, label, "candidates"),
      proofingContexts: path.join(tempRoot, label, "proofing"),
      generationAdapter: async () => ({
        text: weakDraft,
        model_name: "deterministic-live-smoke",
        model_version: "phase34f-initial-weak",
      }),
      finalPolisherAdapter: deterministicFinalPolisherAdapter,
      revisionAdapter: async (payload) => {
        revisionCalls += 1;
        revisionPayloads.push(payload);
        if (revisionCalls === 1) {
          return {
            text: firstRevisionStillWeak,
            model_name: "deterministic-live-smoke",
            model_version: "phase34f-first-revision-still-weak",
          };
        }
        return {
          text: finalLiveRevision,
          model_name: "deterministic-live-smoke",
          model_version: "phase34f-final-live-revision",
        };
      },
    },
  };
}

try {
  const direct = buildOptions("direct");
  const result = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, direct.options);

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.single_entry_complete, true);
  assert.equal(result.pipeline_stage, "final_candidate_ready_after_revision");
  assert.equal(result.candidate_created, false);
  assert.equal(result.proofing_context.built, false);
  assert.equal(result.can_output_to_chat, true);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat");

  assert.equal(direct.revisionPayloads.length, 2, "Phase34F should exercise two recursive revision rounds.");
  assert(direct.revisionPayloads[0].recursive_revision_policy, "First revision payload should include recursive revision policy.");
  assert(direct.revisionPayloads[0].reader_response_revision_gate, "First revision payload should include reader response gate.");
  assert(direct.revisionPayloads[1].recursive_revision_policy, "Second revision payload should include recursive revision policy.");
  assert(direct.revisionPayloads[1].reader_response_revision_gate, "Second revision payload should include reader response gate.");
  assert.notEqual(hash(direct.revisionPayloads[0].draft_text), hash(direct.revisionPayloads[1].draft_text));
  assert.equal(result.final_candidate_text, finalLiveRevision);
  assert(result.final_candidate_text.includes("朝日奈千夜"));
  assert(result.final_candidate_text.includes("九逃"));
  assert(result.final_candidate_text.includes("不能現在開"));
  assert(result.final_candidate_text.includes("妳比我預想得快"));

  assert.equal(result.reader_response_simulator.used, true);
  assert.equal(result.reader_response_simulator.phase, "29A");
  assert(result.reader_response_simulator.overall_reader_response_score >= 60);
  assert(result.reader_response_simulator.dialogue_tension.score >= 60);
  assert(result.reader_response_simulator.emotional_curve.score >= 70);
  assert(result.reader_response_simulator.pacing_pressure.score >= 70);

  assert.equal(result.integrated_modules.full_recursive_writing_pipeline, true);
  assert.equal(result.integrated_modules.reader_response_simulator, true);
  assert.equal(result.integrated_modules.full_pipeline_acceptance_evidence_packet_bridge_surface, true);
  assert.equal(result.integrated_modules.aesthetic_memory_context, true);

  assertEvidencePacket(result.full_pipeline_acceptance_evidence_packet);
  assertBridgeSurface(result.full_pipeline_acceptance_evidence_packet_bridge_surface);

  assert.equal(result.pipeline_result.recursive_revision.used, true);
  assert.equal(result.pipeline_result.recursive_revision.status, "revised");
  assert.equal(result.pipeline_result.recursive_revision.rounds_attempted, 2);
  assert(result.pipeline_result.recursive_revision.rounds.length >= 2);
  assert.equal(
    result.pipeline_result.full_pipeline_acceptance_evidence_packet
      .decision_chain.reader_response_revision_gate.revision_required,
    true,
  );
  assert.equal(result.pipeline_result.reader_response_revision_gate.revision_required, false);
  assert.equal(
    result.pipeline_result.full_pipeline_acceptance_evidence_packet
      .decision_chain.final_reader_response_revision_gate.revision_required,
    false,
  );

  assert.equal(
    result.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used,
    true,
  );
  assert.equal(
    result.full_neural_orchestration_summary.acceptance_evidence_final_status,
    "accepted_after_revision",
  );

  const bridgeRun = buildOptions("bridge");
  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, bridgeRun.options);
  assert.equal(bridge.ok, true);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(bridge.permission, "write_low_risk");
  assert.equal(bridge.result.status, "completed");
  assert.equal(bridge.result.final_candidate_text, finalLiveRevision);
  assert.equal(bridgeRun.revisionPayloads.length, 2, "Bridge run should also exercise two revision rounds.");
  assertBridgeSurface(bridge.result.full_pipeline_acceptance_evidence_packet_bridge_surface);
  assert.equal(bridge.full_neural_orchestrator_used, true);
  assert.equal(bridge.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used, true);
  assert.equal(bridge.full_neural_orchestration_summary.acceptance_evidence_final_status, "accepted_after_revision");
  assert.equal(bridge.safety.can_modify_active_engine, false);
  assert.equal(bridge.safety.can_modify_compressed_rules, false);
  assert.equal(bridge.safety.can_activate_engine, false);
  assert.equal(bridge.safety.can_approve, false);
  assert.equal(bridge.safety.can_confirm_adoption, false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34e = "tests/phase34/phase34e-full-pipeline-acceptance-evidence-packet-bridge-surface.test.mjs";
  const phase34f = "tests/phase34/phase34f-full-pipeline-live-writing-smoke.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34e), "run-all missing Phase34E predecessor.");
  assert(runAllText.includes(phase34f), "run-all missing Phase34F registration.");
  assert(runAllText.indexOf(phase34e) < runAllText.indexOf(phase34f), "Phase34F should run after Phase34E.");
  assert(runAllText.indexOf(phase34f) < runAllText.indexOf(daily), "Phase34F should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34F full pipeline live writing smoke tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}