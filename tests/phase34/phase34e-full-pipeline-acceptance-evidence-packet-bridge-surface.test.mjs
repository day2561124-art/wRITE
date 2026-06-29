import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildFullPipelineAcceptanceEvidencePacketBridgeSurface,
  disabledFullPipelineAcceptanceEvidencePacketBridgeSurface,
  fullPipelineAcceptanceEvidencePacketBridgeSurfaceVersion,
} from "../../server/src/full-pipeline-acceptance-evidence-packet-bridge-surface-service.mjs";
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

function assertSurfaceSafety(surface) {
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
  assert.equal(surface.no_mutation_snapshot.active_engine_modified, false);
  assert.equal(surface.no_mutation_snapshot.compressed_rules_modified, false);
  assert.equal(surface.no_mutation_snapshot.canon_written, false);
  assert.equal(surface.no_mutation_snapshot.settlement_written, false);
  assert.equal(surface.no_mutation_snapshot.candidate_saved, false);
  assert.equal(surface.no_mutation_snapshot.approval_item_created, false);
  assert.equal(surface.no_mutation_snapshot.adoption_confirmed, false);
}

const disabled = disabledFullPipelineAcceptanceEvidencePacketBridgeSurface("not_started");
assert.equal(disabled.used, false);
assert.equal(disabled.phase, "34E");
assert.equal(disabled.version, fullPipelineAcceptanceEvidencePacketBridgeSurfaceVersion);
assertSurfaceSafety(disabled);

const directSurface = buildFullPipelineAcceptanceEvidencePacketBridgeSurface({
  full_pipeline_acceptance_evidence_packet: {
    used: true,
    phase: "34D",
    version: "full_pipeline_acceptance_evidence_packet_v1",
    status: "accepted",
    trace_id: "packet_fixture",
    acceptance_summary: {
      accepted: true,
      soft_acceptance_reached: true,
      revision_required_initially: true,
      revision_required_finally: false,
      recursive_revision_used: true,
      rounds_attempted: 1,
      final_status: "accepted_after_revision",
      pipeline_stage: "final_candidate_ready_after_revision",
    },
    decision_chain: {
      reader_response_simulator: {
        used: true,
        phase: "29A",
        status: "completed",
      },
      reader_response_revision_gate: {
        used: true,
        phase: "34C",
        status: "revision_required",
        revision_required: true,
        revision_type: "structural_scene_rewrite",
        return_stage: "scene_planner",
        rewrite_targets: ["make one chapter-level change impossible to ignore"],
      },
      recursive_revision_policy: {
        used: true,
        phase: "34B",
        status: "revision_required",
        revision_required: true,
        revision_type: "structural_scene_rewrite",
        return_stage: "scene_planner",
      },
      revision_plan: {
        return_stage: "scene_planner",
        rewrite_targets: ["add concrete action or cost"],
      },
      revision_rounds: [{ round: 1, accepted: true }],
      final_reader_response_revision_gate: {
        used: true,
        phase: "34C",
        status: "no_revision_needed",
        revision_required: false,
      },
    },
    operator_findings: [{
      severity: "high",
      source: "reader_response_revision_gate",
      key: "chapter_turn_not_visible",
      finding: "Chapter ending does not create a strong enough new status quo.",
      revision_type: "conflict_reframe",
      return_stage: "dramatic_conflict_manager",
      rewrite_targets: ["make the ending situation materially different from the opening situation"],
    }],
  },
}, {
  bridge_surface: "unit_test",
});

assert.equal(directSurface.used, true);
assert.equal(directSurface.phase, "34E");
assert.equal(directSurface.bridge_surface, "unit_test");
assert.equal(directSurface.acceptance_summary.final_status, "accepted_after_revision");
assert.equal(directSurface.decision_chain_summary.reader_response_revision_gate_status, "revision_required");
assert.equal(directSurface.decision_chain_summary.final_reader_response_revision_gate_status, "no_revision_needed");
assert(directSurface.rewrite_targets.length > 0);
assert(directSurface.operator_cards.length > 0);
assert.equal(directSurface.next_action, "output_final_candidate_text_to_chat");
assertSurfaceSafety(directSurface);

const conflictPlan = {
  protagonist: "千夜",
  protagonist_want: "在門禁鎖死前進入下一條路線",
  opposition: "九逃與即將封閉的門禁系統",
  opposition_pressure: "九逃想阻止她，門禁系統會關閉退路",
  stakes: "等待會失去前進路線，進入會失去退路",
  reversal_or_reveal: "開門不是安全，而是刪除舊退路",
  required_choice: "千夜必須在等待支援與強行進入之間選擇",
  cost_or_payment: "舊路徑從終端上消失",
  new_status_quo: "隊伍被迫進入不能回頭的新戰場",
  ending_hook: "門內有人先一步喊出千夜的名字",
};

const weakText = [
  "千夜確認資料。九逃確認流程。終端顯示目前狀態，門禁系統依照規則進行更新，所有資訊都被整理成可以判讀的項目。",
  "大家看著狀態，依序理解目前的狀況，相關條件也都逐項成立。於是她們知道接下來應該處理門禁、路線、支援與回報。",
  "事情好像差不多，畫面安靜下來。",
].join("\n\n");

const strongText = [
  "千夜在門禁燈第二次閃紅之前把手按上去。九逃叫她等，聲音壓得很低，不是命令，是他已經看見退路會被鎖死。",
  "她沒有回頭，只把終端轉給他看。地圖上的舊路線正在一格一格熄滅，像有人從背後把橋抽走。",
  "『現在不進去，下一道門就會關。』千夜說。『進去的話，我們也回不來。』九逃回她。",
  "選擇在那一秒變成代價。門開了，舊路徑從終端上消失，九逃罵了一聲，還是跟著她跨進去。",
  "他們沒有贏，只是把戰場推到不能回頭的地方。門在身後合上時，裡面有人先一步喊出了千夜的名字。",
].join("\n\n");

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34e-"));

const baseInput = {
  task_prompt: "Phase34E full pipeline acceptance evidence packet bridge surface smoke.",
  generation_context: {
    scene: "night corridor",
    chapter_turn: "terminal warning forces a visible decision",
  },
  retrieval_context: {
    scope: "candidate only",
  },
  reader_response_conflict_plan: conflictPlan,
  reader_questions_to_carry_forward: ["門內的人為什麼知道千夜的名字？"],
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

try {
  let capturedRevisionPayload = null;
  const options = {
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    proofingContexts: path.join(tempRoot, "proofing"),
    generationAdapter: async () => ({ text: weakText }),
    finalPolisherAdapter: deterministicFinalPolisherAdapter,
    revisionAdapter: async (payload) => {
      capturedRevisionPayload = payload;
      return { text: strongText };
    },
  };

  const result = await runFullNeuralWritingPipelineSingleEntryBridge(baseInput, options);

  assert(capturedRevisionPayload, "revision adapter should be called by reader response revision gate.");
  assert.equal(result.status, "completed");
  assert.equal(result.pipeline_stage, "final_candidate_ready_after_revision");
  assert.equal(result.candidate_created, false);
  assert.equal(result.can_output_to_chat, true);
  assert.equal(result.next_action, "output_final_candidate_text_to_chat");

  assert(result.pipeline_result.full_pipeline_acceptance_evidence_packet, "Phase34D packet missing from pipeline result.");
  assert.equal(result.pipeline_result.full_pipeline_acceptance_evidence_packet.phase, "34D");
  assert.equal(result.pipeline_result.full_pipeline_acceptance_evidence_packet.used, true);
  assert.equal(
    result.pipeline_result.full_pipeline_acceptance_evidence_packet.acceptance_summary.final_status,
    "accepted_after_revision",
  );

  const surface = result.full_pipeline_acceptance_evidence_packet_bridge_surface;
  assert(surface, "Phase34E bridge surface missing.");
  assert.equal(surface.used, true);
  assert.equal(surface.phase, "34E");
  assert.equal(surface.version, fullPipelineAcceptanceEvidencePacketBridgeSurfaceVersion);
  assert.equal(surface.bridge_surface, "chatgpt_bridge_single_entry");
  assert.equal(surface.acceptance_summary.accepted, true);
  assert.equal(surface.acceptance_summary.soft_acceptance_reached, true);
  assert.equal(surface.acceptance_summary.revision_required_initially, true);
  assert.equal(surface.acceptance_summary.revision_required_finally, false);
  assert.equal(surface.acceptance_summary.final_status, "accepted_after_revision");
  assert.equal(surface.decision_chain_summary.reader_response_revision_gate_status, "revision_required");
  assert.equal(surface.decision_chain_summary.recursive_revision_policy_status, "revision_required");
  assert.equal(surface.decision_chain_summary.final_reader_response_revision_gate_status, "no_revision_needed");
  assert(surface.rewrite_targets.length > 0, "Bridge surface should expose rewrite targets.");
  assert(surface.operator_findings.length > 0, "Bridge surface should expose operator findings.");
  assert(surface.operator_cards.length >= 3, "Bridge surface should expose operator cards.");
  assert.equal(surface.next_action, "output_final_candidate_text_to_chat");
  assertSurfaceSafety(surface);

  assert.equal(result.integrated_modules.full_pipeline_acceptance_evidence_packet_bridge_surface, true);
  assert.equal(
    result.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used,
    true,
  );
  assert.equal(
    result.full_neural_orchestration_summary.acceptance_evidence_final_status,
    "accepted_after_revision",
  );

  const bridge = await chatgpt_bridge_run_full_neural_writing_pipeline(baseInput, options);
  assert.equal(bridge.ok, true);
  assert.equal(bridge.tool_name, "chatgpt_bridge_run_full_neural_writing_pipeline");
  assert.equal(bridge.result.full_pipeline_acceptance_evidence_packet_bridge_surface.phase, "34E");
  assert.equal(bridge.result.full_pipeline_acceptance_evidence_packet_bridge_surface.used, true);
  assert.equal(
    bridge.result.full_pipeline_acceptance_evidence_packet_bridge_surface.acceptance_summary.final_status,
    "accepted_after_revision",
  );
  assert.equal(bridge.full_neural_orchestration_summary.acceptance_evidence_packet_bridge_surface_used, true);
  assert.equal(bridge.full_neural_orchestration_summary.acceptance_evidence_final_status, "accepted_after_revision");
  assert.equal(bridge.safety.can_modify_active_engine, false);
  assert.equal(bridge.safety.can_activate_engine, false);
  assert.equal(bridge.safety.can_confirm_adoption, false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34d = "tests/phase34/phase34d-full-pipeline-acceptance-evidence-packet.test.mjs";
  const phase34e = "tests/phase34/phase34e-full-pipeline-acceptance-evidence-packet-bridge-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34d), "run-all missing Phase34D predecessor.");
  assert(runAllText.includes(phase34e), "run-all missing Phase34E registration.");
  assert(runAllText.indexOf(phase34d) < runAllText.indexOf(phase34e), "Phase34E should run after Phase34D.");
  assert(runAllText.indexOf(phase34e) < runAllText.indexOf(daily), "Phase34E should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34E full pipeline acceptance evidence packet bridge surface tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}