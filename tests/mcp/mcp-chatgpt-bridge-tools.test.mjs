import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import {
  chatgptBridgeToolMetadata,
  chatgptBridgeTools,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".phase14a-chatgpt-bridge-test";
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
  settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, suffix),
};
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert.strictEqual = (actual, expected, message) => {
  assert(Object.is(actual, expected), message ?? `Expected ${actual} to strictly equal ${expected}.`);
};
assert.equal = assert.strictEqual;

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

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine);
  const rulesBefore = await readFile(projectPaths.compressedRules);
  const transactionsBefore = await names(transactionDir);
  await Promise.all(Object.values(options).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));

  try {
    const toolNames = [
      "chatgpt_bridge_get_workbench_status",
      "chatgpt_bridge_get_current_inputs",
      "chatgpt_bridge_build_writing_context",
      "chatgpt_bridge_review_draft_ephemeral",
      "chatgpt_bridge_save_candidate",
      "chatgpt_bridge_build_proofing_context",
      "chatgpt_bridge_save_proof_report",
      "chatgpt_bridge_request_adoption",
      "chatgpt_bridge_build_settlement_context",
      "chatgpt_bridge_get_foreshadowing_settlement_surface",
      "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
      "chatgpt_bridge_save_settlement_report",
    ];
    for (const name of toolNames) {
      assert(typeof chatgptBridgeTools[name] === "function", `${name} is missing.`);
      const metadata = chatgptBridgeToolMetadata[name];
      assert(metadata.bridge_phase === "phase_14a_lite", `${name} phase is wrong.`);
      for (const capability of [
        "can_generate_locally",
        "can_call_external_llm",
        "can_modify_active_engine",
        "can_modify_compressed_rules",
        "can_apply_compressed_rules",
        "can_activate_engine",
        "can_approve",
        "can_confirm_adoption",
        "can_restore",
        "can_rollback",
        "can_execute_cleanup",
      ]) {
        assert(metadata[capability] === false, `${name} allows ${capability}.`);
      }
    }
    assert(
      chatgptBridgeTools.chatgpt_bridge_confirm_adoption === undefined,
      "Bridge exposed adoption confirmation.",
    );
    assert(
      chatgptBridgeTools.chatgpt_bridge_build_pending_engine_candidate === undefined,
      "Bridge exposed pending engine candidate creation.",
    );

    const status = await chatgptBridgeTools.chatgpt_bridge_get_workbench_status({}, options);
    assert(status.ok && status.result.records, "Workbench status failed.");
    const inputs = await chatgptBridgeTools.chatgpt_bridge_get_current_inputs({
      include_text: true,
      include_active_engine_metadata: true,
    }, options);
    assert(inputs.ok && inputs.result.inputs.task_prompt, "Current inputs failed.");
    assert(
      inputs.result.active_engine.text === undefined,
      "Current inputs leaked active engine text by default.",
    );

    const context = await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
      task_prompt: "Write a Phase 14A bridge fixture candidate.",
      use_current_inputs: true,
      include_active_engine: false,
    }, options);
    assert(context.ok && context.result.bundle.bundle_id, "Writing context failed.");
    assert(context.result.generated_locally === false, "Writing context generated locally.");
    assert(context.result.bundle.engine_first === true, "Bridge context was not engine-first.");
    assert(
      context.result.bundle.engine_components_valid === true,
      "Bridge context engine components were invalid.",
    );
    assert(
      context.result.bundle.neural_pipeline_required === true
        && context.result.bundle.required_neural_modules.length === 6,
      "Bridge context omitted the required neural pipeline.",
    );

    const candidate = await chatgptBridgeTools.chatgpt_bridge_save_candidate({
      source_bundle_id: context.result.bundle.bundle_id,
      chat_output_text: "# Bridge Candidate\n\nFixture body.",
      title: "Bridge Candidate",
      chapter: "Phase 14A",
    }, options);
    assert(candidate.ok && candidate.result.candidate_created, "Candidate save failed.");
    assert(candidate.result.candidate_only === true, "Candidate was not candidate-only.");

    // Ensure neural trace is marked complete for approval-gated tests
    const candidateMetaPath = path.join(options.writingCandidates, candidate.result.candidate_id, "candidate.json");
    const meta = JSON.parse(await readFile(candidateMetaPath, "utf8"));
    meta.missing_required_neural_modules = [];
    meta.neural_trace_complete = true;
    await writeFile(candidateMetaPath, `${JSON.stringify(meta, null, 2)}\n`);

    const proofing = await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
      candidate_id: candidate.result.candidate_id,
      include_active_engine: false,
    }, options);
    assert(proofing.ok && proofing.result.context, "Proofing context failed.");

    const proof = await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
      candidate_id: candidate.result.candidate_id,
      proofing_context_id: proofing.result.context.proofing_context_id,
      proof_report_text: "Pass. No protected-state changes.",
      verdict: "pass",
      severity: "none",
    }, options);
    assert(proof.ok && proof.result.proof_report_created, "Proof report save failed.");

    const adoption = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
      candidate_id: candidate.result.candidate_id,
      proof_report_id: proof.result.proof_report_id,
      reason: "Phase 14A fixture.",
    }, options);
    assert(adoption.ok && adoption.result.approval_item_created, "Adoption request failed.");
    assert(adoption.result.adopted === false, "Bridge adopted a candidate directly.");
    assert(
      adoption.result.next_action.includes("explicitly confirm"),
      "Adoption request omitted UI confirmation guidance.",
    );

    const confirmed = await confirmApprovalItem(adoption.result.approval_item_id, {
      confirm: true,
      approvedBy: "phase14a_test_fixture",
    }, options);
    const adoptedChapterId = confirmed.result.adopted_chapter_id;
    const settlement = await chatgptBridgeTools.chatgpt_bridge_build_settlement_context({
      adopted_chapter_id: adoptedChapterId,
      include_active_engine: false,
      include_writing_card: false,
      include_proofing_card: false,
      include_longline: false,
    }, options);
    assert(settlement.ok && settlement.result.context, "Settlement context failed.");

    const ledgerSurface = await chatgptBridgeTools.chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface({
      settlement_context_id: settlement.result.context.settlement_context_id,
      include_raw: false,
      include_markdown: true,
      max_rows: 10,
    }, options);
    assert(ledgerSurface.ok, "Ledger bridge surface failed.");
    assert.strictEqual(ledgerSurface.result.phase, "27P", "Ledger bridge surface phase drifted.");
    assert.equal(ledgerSurface.result.bridge_metadata.read_only_tool, true, "Ledger bridge surface is not read-only.");
    assert.equal(ledgerSurface.result.bridge_metadata.writes_files, false, "Ledger bridge surface writes files.");
    assert.equal(ledgerSurface.result.safety.mcp_can_approve, false, "Ledger bridge surface can approve.");
    assert.equal(ledgerSurface.result.safety.mcp_can_confirm_adoption, false, "Ledger bridge surface can confirm adoption.");
    assert.equal(ledgerSurface.result.safety.mcp_can_activate_engine, false, "Ledger bridge surface can activate engine.");

    const report = await chatgptBridgeTools.chatgpt_bridge_save_settlement_report({
      adopted_chapter_id: adoptedChapterId,
      settlement_context_id: settlement.result.context.settlement_context_id,
      settlement_report_text: "# Settlement Report\n\nFixture facts only.",
    }, options);
    assert(report.ok && report.result.settlement_report_created, "Settlement report failed.");
    assert(
      report.result.pending_engine_candidate_created === false,
      "Settlement report created a pending engine candidate.",
    );
    assert(report.result.active_engine_modified === false, "Settlement report changed engine.");

    const finalStatus = await chatgptBridgeTools.chatgpt_bridge_get_workbench_status({}, options);
    assert(finalStatus.result.records.writing_candidates === 1, "Candidate count is wrong.");
    assert(finalStatus.result.records.proof_reports === 1, "Proof report count is wrong.");
    assert(finalStatus.result.records.settlement_reports === 1, "Settlement report count is wrong.");
    assert(
      Buffer.compare(await readFile(projectPaths.activeEngine), activeBefore) === 0,
      "Bridge changed active_engine.md.",
    );
    assert(
      Buffer.compare(await readFile(projectPaths.compressedRules), rulesBefore) === 0,
      "Bridge changed compressed_rules.md.",
    );
    assert(hash(activeBefore) === hash(await readFile(projectPaths.activeEngine)), "Engine hash changed.");
    console.log("MCP ChatGPT bridge tools test passed.");
  } finally {
    await Promise.all(Object.values(options).map((directory) => (
      rm(directory, { recursive: true, force: true })
    )));
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP ChatGPT bridge tools test failed: ${error.message}`);
  process.exitCode = 1;
});
