import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chatgptBridgeTools,
} from "../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../server/src/project-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const defaultFixtureRoot = ".phase14b-chatgpt-bridge-e2e";
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const syntheticAdoptedChapterId = "adopted_chapter_20260613-140000-14b00000";

const candidateFixture = [
  "# Phase 14B Dry Run Candidate",
  "",
  "This is deterministic fixture output standing in for ChatGPT.",
  "It verifies candidate intake without calling any LLM.",
  "It is not canon and must not modify active_engine.",
].join("\n");

const proofFixture = [
  "# Phase 14B Dry Run Proof Report",
  "",
  "Verdict: needs_revision",
  "Severity: P3",
  "",
  "This deterministic fixture verifies proof report intake.",
  "It does not approve adoption, confirm adoption, or settle the candidate.",
].join("\n");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    cleanup: false,
    json: false,
    includeSettlementFixture: false,
    fixtureRoot: defaultFixtureRoot,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--cleanup") options.cleanup = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--include-settlement-fixture") {
      options.includeSettlementFixture = true;
    } else if (argument === "--fixture-root") {
      index += 1;
      options.fixtureRoot = argv[index] ?? "";
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function fixtureName(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("--fixture-root requires a non-empty value.");
  }
  const normalized = value.trim().replaceAll("\\", "/");
  const name = path.posix.basename(normalized);
  if (!/^\.[a-z0-9][a-z0-9._-]{2,79}$/iu.test(name)) {
    throw new Error(
      "--fixture-root must resolve to a dot-prefixed fixture name using letters, numbers, dot, underscore, or hyphen.",
    );
  }
  return name;
}

function fixtureOptions(name) {
  return {
    gptWritingContexts: path.join(projectPaths.gptWritingContexts, name),
    writingCandidates: path.join(projectPaths.writingCandidates, name),
    proofingContexts: path.join(projectPaths.proofingContexts, name),
    proofReports: path.join(projectPaths.proofReports, name),
    approvalQueue: path.join(projectPaths.approvalQueue, name),
    adoptedWritings: path.join(projectPaths.adoptedWritings, name),
    settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, name),
    settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, name),
  };
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function cleanupNewEntries(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

async function cleanupFixtures(options, transactionsBefore) {
  await Promise.all([
    ...Object.values(options).map((directory) => (
      rm(directory, { recursive: true, force: true })
    )),
    cleanupNewEntries(transactionDir, transactionsBefore),
  ]);
}

function requireToolSuccess(response, step) {
  if (!response?.ok || response.blocked) {
    throw new Error(`${step} failed: ${response?.blocked_reason ?? "unknown bridge error"}`);
  }
  return response.result;
}

async function createSyntheticAdoptedWriting(options, candidateId, proofReportId) {
  const directory = path.join(options.adoptedWritings, syntheticAdoptedChapterId);
  const chapterPath = path.join(directory, "chapter.md");
  const adoptionPath = path.join(directory, "adoption.json");
  const chapterText = [
    "# Phase 14B Synthetic Adopted Writing",
    "",
    "Fixture-only adopted content for settlement context coverage.",
  ].join("\n");
  const adoption = {
    adopted_chapter_id: syntheticAdoptedChapterId,
    record_kind: "synthetic_phase_14b_fixture",
    created_at: "2026-06-13T14:00:00.000Z",
    candidate_id: candidateId,
    proof_report_id: proofReportId,
    approval_item_id: null,
    approved_by_user: false,
    source: "phase_14b_synthetic_fixture",
    canon_status: "adopted_chapter",
    settled: false,
    settlement_created: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    content_path: path.relative(projectRoot, chapterPath).replaceAll(path.sep, "/"),
    adoption_path: path.relative(projectRoot, adoptionPath).replaceAll(path.sep, "/"),
  };
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(chapterPath, `${chapterText}\n`, "utf8"),
    writeFile(adoptionPath, `${JSON.stringify(adoption, null, 2)}\n`, "utf8"),
  ]);
}

function summaryTemplate(fixtureRoot) {
  return {
    ok: false,
    phase: "phase_14b",
    workflow: "chatgpt_bridge_e2e_dry_run",
    fixture_root: fixtureRoot,
    steps: {
      status_read: false,
      current_inputs_read: false,
      writing_context_built: false,
      candidate_saved: false,
      proofing_context_built: false,
      proof_report_saved: false,
      adoption_request_created: false,
      stopped_at_approval_queue: false,
      settlement_context_built_from_fixture: false,
    },
    safety: {
      external_llm_called: false,
      local_generation_called: false,
      approval_confirmed: false,
      adoption_confirmed: false,
      adopted_chapter_created: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      compressed_rules_modified: false,
      restore_executed: false,
      rollback_executed: false,
    },
    hashes: {
      active_engine_before: null,
      active_engine_after: null,
      compressed_rules_before: null,
      compressed_rules_after: null,
    },
    artifacts: {
      writing_context_id: null,
      candidate_id: null,
      proofing_context_id: null,
      proof_report_id: null,
      adoption_request_id: null,
      settlement_context_id: null,
    },
    fixture: {
      synthetic_adopted_writing_used: false,
      synthetic_adopted_writing_persisted: false,
      cleanup_completed: false,
    },
  };
}

export async function runChatgptBridgeE2eDryRun(rawOptions = {}) {
  const name = fixtureName(rawOptions.fixtureRoot ?? defaultFixtureRoot);
  const options = fixtureOptions(name);
  const transactionsBefore = await names(transactionDir);
  const pendingCandidatesBefore = await names(projectPaths.pendingEngineCandidates);
  const activeBefore = await readFile(projectPaths.activeEngine);
  const compressedBefore = await readFile(projectPaths.compressedRules);
  const summary = summaryTemplate(name);
  summary.hashes.active_engine_before = sha256(activeBefore);
  summary.hashes.compressed_rules_before = sha256(compressedBefore);

  await cleanupFixtures(options, transactionsBefore);
  try {
    requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_get_workbench_status({}, options),
      "workbench status",
    );
    summary.steps.status_read = true;

    requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_get_current_inputs({
        include_text: true,
        include_active_engine_text: false,
      }, options),
      "current inputs",
    );
    summary.steps.current_inputs_read = true;

    const writingContext = requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
        task_prompt: "Phase 14B deterministic ChatGPT bridge E2E dry run.",
        use_current_inputs: true,
        include_active_engine: false,
      }, options),
      "writing context",
    );
    summary.steps.writing_context_built = true;
    summary.artifacts.writing_context_id = writingContext.bundle.bundle_id;

    const candidate = requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_save_candidate({
        source_bundle_id: writingContext.bundle.bundle_id,
        chat_output_text: candidateFixture,
        title: "Phase 14B Dry Run Candidate",
        chapter: "Phase 14B",
      }, options),
      "candidate save",
    );
    summary.steps.candidate_saved = true;
    summary.artifacts.candidate_id = candidate.candidate_id;

    const proofingContext = requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
        candidate_id: candidate.candidate_id,
        include_active_engine: false,
      }, options),
      "proofing context",
    );
    summary.steps.proofing_context_built = true;
    summary.artifacts.proofing_context_id =
      proofingContext.context.proofing_context_id;

    const proofReport = requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
        candidate_id: candidate.candidate_id,
        proofing_context_id: proofingContext.context.proofing_context_id,
        proof_report_text: proofFixture,
        verdict: "needs_revision",
        severity: "P3",
        summary: "Deterministic Phase 14B fixture proof.",
      }, options),
      "proof report save",
    );
    summary.steps.proof_report_saved = true;
    summary.artifacts.proof_report_id = proofReport.proof_report_id;

    const adoptionRequest = requireToolSuccess(
      await chatgptBridgeTools.chatgpt_bridge_request_adoption({
        candidate_id: candidate.candidate_id,
        proof_report_id: proofReport.proof_report_id,
        reason: "Phase 14B dry-run request; stop at approval queue.",
        requested_by: "phase_14b_dry_run",
      }, options),
      "adoption request",
    );
    if (
      adoptionRequest.status !== "pending"
      || adoptionRequest.approval_item_created !== true
      || adoptionRequest.adopted !== false
    ) {
      throw new Error("Adoption request did not stop as a pending approval item.");
    }
    summary.steps.adoption_request_created = true;
    summary.steps.stopped_at_approval_queue = true;
    summary.artifacts.adoption_request_id = adoptionRequest.approval_item_id;

    if (rawOptions.includeSettlementFixture === true) {
      await createSyntheticAdoptedWriting(
        options,
        candidate.candidate_id,
        proofReport.proof_report_id,
      );
      summary.fixture.synthetic_adopted_writing_used = true;
      const settlementContext = requireToolSuccess(
        await chatgptBridgeTools.chatgpt_bridge_build_settlement_context({
          adopted_chapter_id: syntheticAdoptedChapterId,
          include_active_engine: false,
          include_writing_card: false,
          include_proofing_card: false,
          include_longline: false,
        }, options),
        "settlement context",
      );
      summary.steps.settlement_context_built_from_fixture = true;
      summary.artifacts.settlement_context_id =
        settlementContext.context.settlement_context_id;
    }

    const pendingCandidatesAfter = await names(projectPaths.pendingEngineCandidates);
    if (
      pendingCandidatesAfter.size !== pendingCandidatesBefore.size
      || [...pendingCandidatesBefore].some((entry) => !pendingCandidatesAfter.has(entry))
    ) {
      throw new Error("Pending engine candidate state changed during the dry run.");
    }

    const activeAfter = await readFile(projectPaths.activeEngine);
    const compressedAfter = await readFile(projectPaths.compressedRules);
    summary.hashes.active_engine_after = sha256(activeAfter);
    summary.hashes.compressed_rules_after = sha256(compressedAfter);
    summary.safety.active_engine_modified =
      Buffer.compare(activeBefore, activeAfter) !== 0;
    summary.safety.compressed_rules_modified =
      Buffer.compare(compressedBefore, compressedAfter) !== 0;
    if (
      summary.safety.active_engine_modified
      || summary.safety.compressed_rules_modified
    ) {
      throw new Error("Protected file hash changed during the dry run.");
    }
    summary.ok = true;
    return summary;
  } finally {
    await cleanupFixtures(options, transactionsBefore);
    summary.fixture.cleanup_completed = true;
    summary.fixture.synthetic_adopted_writing_persisted = false;
  }
}

function helpText() {
  return [
    "Usage: node scripts/chatgpt-bridge-e2e-dry-run.mjs [options]",
    "",
    "Options:",
    "  --dry-run                     Assert the guarded dry-run workflow (always safe).",
    "  --fixture-root <name>          Dot-prefixed isolated fixture name.",
    "  --cleanup                     Explicitly request cleanup (cleanup is always enforced).",
    "  --json                        Print machine-readable JSON only.",
    "  --include-settlement-fixture  Cover settlement context with synthetic adopted data.",
  ].join("\n");
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    console.log(helpText());
    return;
  }
  const summary = await runChatgptBridgeE2eDryRun(cli);
  if (cli.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log("ChatGPT Bridge Phase 14B E2E dry run passed.");
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(`ChatGPT Bridge Phase 14B E2E dry run failed: ${error.message}`);
    process.exitCode = 1;
  });
}
