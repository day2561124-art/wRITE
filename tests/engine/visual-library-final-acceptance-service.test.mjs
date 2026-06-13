import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  buildVisualLibraryFinalAcceptanceCase,
  buildVisualLibraryUiReadinessCardPreview,
  compileVisualLibraryFinalAcceptanceSummary,
  evaluateVisualLibraryFinalAcceptanceDecision,
  loadVisualLibraryFinalAcceptanceConfig,
  runVisualLibraryAcceptanceCasePipeline,
  runVisualLibraryFinalAcceptancePreview,
  validateVisualLibraryFinalAcceptanceConfig,
  validateVisualLibraryFinalAcceptanceNoWriteSafety,
} from "../../server/src/visual-library-final-acceptance-service.mjs";
import {
  buildVisualLibraryApprovalItemDryRunPayload,
  loadVisualLibraryApprovalQueueImportDryRunConfig,
} from "../../server/src/visual-library-approval-queue-import-dry-run-service.mjs";
import {
  loadVisualLibraryImportSimulationConfig,
} from "../../server/src/visual-library-import-simulation-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const visualIndexPath = path.join(
  projectRoot,
  "data",
  "visual_db",
  "visual_index.jsonl",
);
const visualAssetsRoot = path.join(projectRoot, "data", "visual_db", "assets");
const activeEnginePath = path.join(
  projectRoot,
  "data",
  "canon_db",
  "active_engine.md",
);
const approvalQueueRoot = path.join(projectRoot, "data", "approval_queue");
const fixtureRoot = path.join(
  projectRoot,
  "data",
  "visual_db",
  `.phase-18f-test-${process.pid}-${Date.now()}`,
);

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function directorySnapshot(directory) {
  const entries = [];
  async function walk(current) {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(directory, absolute).split(path.sep).join("/");
      if (child.isDirectory()) {
        entries.push(`d:${relative}`);
        await walk(absolute);
      } else {
        const metadata = await stat(absolute);
        entries.push(`f:${relative}:${metadata.size}`);
      }
    }
  }
  await walk(directory);
  return entries;
}

const visualIndexBefore = await readFile(visualIndexPath);
const activeEngineBefore = await readFile(activeEnginePath);
const assetsBefore = await directorySnapshot(visualAssetsRoot);
const approvalQueueBefore = await directorySnapshot(approvalQueueRoot);

try {
  const { config } = await loadVisualLibraryFinalAcceptanceConfig();
  assert.equal(validateVisualLibraryFinalAcceptanceConfig(config), config);
  assert.throws(
    () => validateVisualLibraryFinalAcceptanceConfig({
      ...structuredClone(config),
      writes_approval_queue: true,
    }),
    /writes_approval_queue must be false/u,
  );

  const missingSourcePreview = await runVisualLibraryFinalAcceptancePreview({
    sourceDir: `data/visual_db/.phase-18f-missing-${process.pid}`,
  });
  assert.equal(
    missingSourcePreview.final_acceptance_decision,
    "empty_final_acceptance_preview_passed",
  );
  assert.equal(missingSourcePreview.acceptance_summary.case_count, 0);
  assert.equal(missingSourcePreview.acceptance_summary.failed_count, 0);

  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(path.join(fixtureRoot, "character-primary.png"), tinyPng);
  await writeFile(path.join(fixtureRoot, "character-duplicate.png"), tinyPng);
  await writeFile(
    path.join(fixtureRoot, "scene-background.png"),
    Buffer.concat([tinyPng, Buffer.from("scene", "utf8")]),
  );
  await writeFile(
    path.join(fixtureRoot, "misc-reference.png"),
    Buffer.concat([tinyPng, Buffer.from("unknown", "utf8")]),
  );
  await writeFile(path.join(fixtureRoot, "unsupported.txt"), "not an image");
  const sourceDir = path.relative(projectRoot, fixtureRoot);

  const lockedPreview = await runVisualLibraryFinalAcceptancePreview({
    sourceDir,
  });
  const lockedScene = lockedPreview.acceptance_cases.find(
    (item) => item.case_name === "scene-background.png",
  );
  assert.equal(lockedScene.actual_decision, "blocked_by_confirmation_gate");

  const confirmedPreview = await runVisualLibraryFinalAcceptancePreview({
    sourceDir,
    confirmText: config.required_confirmation_text,
  });
  const readyScene = confirmedPreview.acceptance_cases.find(
    (item) => item.case_name === "scene-background.png",
  );
  assert.equal(
    readyScene.actual_decision,
    "approval_queue_import_dry_run_ready",
  );
  for (const field of [
    "can_write_approval_queue",
    "can_create_approval_item",
    "can_confirm_import",
    "can_write_visual_index",
    "can_copy_visual_asset",
    "can_create_canon_visual_lock",
  ]) {
    assert.equal(readyScene.ui_readiness_card[field], false);
  }
  assert.deepEqual(
    readyScene.ui_readiness_card.allowed_preview_actions,
    [
      "view_final_acceptance_summary",
      "view_approval_payload_preview",
      "view_lineage",
      "view_risk_summary",
      "view_guard_summary",
      "view_no_write_summary",
    ],
  );

  const unknown = confirmedPreview.acceptance_cases.find(
    (item) => item.case_name === "misc-reference.png",
  );
  assert.ok([
    "blocked_requires_manual_category_review",
    "blocked_by_readiness_decision",
  ].includes(unknown.actual_decision));
  assert.ok(
    [...unknown.blocked_reasons, ...unknown.warnings].some(
      (reason) => reason.includes("category"),
    ),
  );
  const duplicate = confirmedPreview.acceptance_cases.find(
    (item) => item.actual_decision
      === "blocked_duplicate_requires_manual_review",
  );
  assert.ok(duplicate);
  assert.ok(
    [...duplicate.blocked_reasons, ...duplicate.warnings].some(
      (reason) => reason.includes("duplicate"),
    ),
  );
  const unsupported = confirmedPreview.acceptance_cases.find(
    (item) => item.case_name === "unsupported.txt",
  );
  assert.equal(
    unsupported.actual_decision,
    "rejected_unsupported_extension",
  );

  const pipeline = await runVisualLibraryAcceptanceCasePipeline({
    sourceDir,
    confirmText: config.required_confirmation_text,
  });
  const readyCandidate =
    pipeline.pending_import_readiness.pending_candidates.find(
      (item) => item.lineage.source_file === "scene-background.png",
    );
  const { config: dryRunConfig } =
    await loadVisualLibraryApprovalQueueImportDryRunConfig();
  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig();
  const confirmationGate = pipeline.import_simulation.confirmation_gate;

  const unsafeCandidate = {
    ...readyCandidate,
    lineage: {
      ...readyCandidate.lineage,
      proposed_target_path: "../outside.png",
    },
  };
  const unsafeDryRun = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: unsafeCandidate,
    config: dryRunConfig,
    simulationConfig,
    confirmationGate,
    visualIndexRecords: 0,
  });
  const unsafeCase = buildVisualLibraryFinalAcceptanceCase({
    case_name: "unsafe target",
    source_file: "scene-background.png",
    expected_decision: "blocked_unsafe_target_path",
    pipeline_results: {
      approval_queue_dry_run: unsafeDryRun,
    },
  });
  assert.equal(unsafeCase.actual_decision, "blocked_unsafe_target_path");
  assert.equal(unsafeCase.passed, true);

  const incompleteDryRun = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: readyCandidate,
    config: dryRunConfig,
    simulationConfig,
    confirmationGate,
    visualIndexRecords: 0,
    lineage: {
      ...readyCandidate.lineage,
      pending_candidate_id: readyCandidate.pending_candidate_id,
      source_sha256: null,
    },
  });
  const incompleteCase = buildVisualLibraryFinalAcceptanceCase({
    case_name: "incomplete lineage",
    expected_decision: "blocked_incomplete_lineage",
    pipeline_results: {
      approval_queue_dry_run: incompleteDryRun,
    },
  });
  assert.equal(incompleteCase.actual_decision, "blocked_incomplete_lineage");
  assert.equal(incompleteCase.passed, true);

  const noWriteViolation = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: readyCandidate,
    config: dryRunConfig,
    simulationConfig,
    confirmationGate,
    visualIndexRecords: 0,
    noWrite: {
      ...readyCandidate.no_write_summary,
      writes_approval_queue: true,
    },
  });
  const noWriteCase = buildVisualLibraryFinalAcceptanceCase({
    case_name: "no-write safety violation",
    expected_decision: "blocked_no_write_safety_violation",
    pipeline_results: {
      approval_queue_dry_run: noWriteViolation,
    },
  });
  assert.equal(
    noWriteCase.actual_decision,
    "blocked_no_write_safety_violation",
  );
  assert.equal(noWriteCase.passed, true);

  const unsafeCard = buildVisualLibraryUiReadinessCardPreview({
    case_id: "unsafe-card",
    source_file: "scene-background.png",
    actual_decision: "approval_queue_import_dry_run_ready",
  });
  unsafeCard.can_write_approval_queue = true;
  assert.equal(
    validateVisualLibraryFinalAcceptanceNoWriteSafety({
      no_write_summary: readyScene.no_write_summary,
      ui_readiness_card: unsafeCard,
    }).valid,
    false,
  );
  assert.equal(
    evaluateVisualLibraryFinalAcceptanceDecision({
      case_count: 1,
      failed_count: 0,
      unexpected_write_capability_count: 1,
      visual_index_unchanged: true,
      visual_assets_unchanged: true,
      active_engine_unchanged: true,
    }),
    "failed_unexpected_write_capability",
  );
  assert.equal(
    evaluateVisualLibraryFinalAcceptanceDecision({
      case_count: 1,
      failed_count: 0,
      unexpected_write_capability_count: 0,
      visual_index_unchanged: false,
      visual_assets_unchanged: true,
      active_engine_unchanged: true,
    }),
    "failed_visual_index_modified",
  );
  assert.equal(
    evaluateVisualLibraryFinalAcceptanceDecision({
      case_count: 1,
      failed_count: 0,
      unexpected_write_capability_count: 0,
      visual_index_unchanged: true,
      visual_assets_unchanged: false,
      active_engine_unchanged: true,
    }),
    "failed_visual_assets_modified",
  );
  assert.equal(
    evaluateVisualLibraryFinalAcceptanceDecision({
      case_count: 1,
      failed_count: 0,
      unexpected_write_capability_count: 0,
      visual_index_unchanged: true,
      visual_assets_unchanged: true,
      active_engine_unchanged: false,
    }),
    "failed_active_engine_modified",
  );

  const combinedPreview = {
    ...confirmedPreview,
    acceptance_cases: [
      ...confirmedPreview.acceptance_cases,
      unsafeCase,
      incompleteCase,
      noWriteCase,
    ],
  };
  const summary = compileVisualLibraryFinalAcceptanceSummary(combinedPreview);
  assert.equal(summary.passed_count, summary.case_count);
  assert.equal(summary.failed_count, 0);
  assert.equal(
    summary.final_acceptance_decision,
    "visual_library_final_acceptance_passed",
  );
  assert.equal(
    confirmedPreview.final_acceptance_decision,
    "visual_library_final_acceptance_passed",
  );

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);

  console.log("Visual library final acceptance service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
}
