import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  buildPendingVisualImportCandidatePreview,
  buildVisualImportApprovalReadinessCard,
  loadVisualLibraryPendingImportReadinessConfig,
  runVisualLibraryPendingImportReadinessPreview,
  validatePendingVisualImportLineage,
  validateVisualLibraryPendingImportReadinessConfig,
} from "../../server/src/visual-library-pending-import-readiness-service.mjs";
import {
  buildVisualImportOperationPreview,
  evaluateVisualImportConfirmationGate,
  loadVisualLibraryImportSimulationConfig,
  runVisualLibraryImportSimulationPreview,
} from "../../server/src/visual-library-import-simulation-service.mjs";
import {
  scanVisualLibraryIntakePreview,
} from "../../server/src/visual-library-rebuild-intake-service.mjs";
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
  `.phase-18d-test-${process.pid}-${Date.now()}`,
);

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256Lf(value) {
  return sha256(Buffer.from(
    String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n"),
    "utf8",
  ));
}

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
  const { config } = await loadVisualLibraryPendingImportReadinessConfig();
  assert.equal(validateVisualLibraryPendingImportReadinessConfig(config), config);
  assert.throws(
    () => validateVisualLibraryPendingImportReadinessConfig({
      ...structuredClone(config),
      writes_approval_queue: true,
    }),
    /writes_approval_queue must be false/u,
  );
  assert.equal(
    sha256Lf(activeEngineBefore.toString("utf8")),
    config.expected_engine_sha256_lf,
  );

  const emptyPreview = await runVisualLibraryPendingImportReadinessPreview();
  assert.equal(
    emptyPreview.approval_readiness_summary.decision,
    "empty_approval_readiness_preview",
  );
  assert.deepEqual(emptyPreview.pending_candidates, []);
  assert.deepEqual(emptyPreview.readiness_cards, []);
  assert.deepEqual(emptyPreview.blocked_candidates, []);

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
  await writeFile(path.join(fixtureRoot, "notes.txt"), "unsupported");
  const sourceDir = path.relative(projectRoot, fixtureRoot);

  const lockedPreview = await runVisualLibraryPendingImportReadinessPreview({
    sourceDir,
  });
  const lockedScene = lockedPreview.blocked_candidates.find(
    (candidate) => candidate.lineage.source_file === "scene-background.png",
  );
  assert.equal(
    lockedScene.readiness_decision,
    "blocked_by_confirmation_gate",
  );

  const confirmedPreview = await runVisualLibraryPendingImportReadinessPreview({
    sourceDir,
    confirmText: config.required_confirmation_text,
  });
  const readyScene = confirmedPreview.pending_candidates.find(
    (candidate) => candidate.lineage.source_file === "scene-background.png",
  );
  assert.equal(
    readyScene.readiness_decision,
    "ready_for_human_visual_import_review",
  );
  const readyCard = confirmedPreview.readiness_cards.find(
    (card) => card.pending_candidate_id === readyScene.pending_candidate_id,
  );
  assert.equal(readyCard.can_submit_to_approval_queue, false);
  assert.equal(readyCard.can_confirm_import, false);
  assert.deepEqual(
    readyCard.required_human_checks,
    [
      "source image identity check",
      "category check",
      "duplicate check",
      "canon status check",
      "target path check",
      "no canon_visual_lock check",
    ],
  );
  assert.ok(readyCard.disabled_actions.includes("submit_to_approval_queue"));
  assert.ok(readyCard.disabled_actions.includes("confirm_import"));

  const unknown = confirmedPreview.blocked_candidates.find(
    (candidate) => candidate.lineage.source_file === "misc-reference.png",
  );
  assert.equal(
    unknown.readiness_decision,
    "blocked_requires_manual_category_review",
  );
  const duplicate = confirmedPreview.blocked_candidates.find(
    (candidate) => (
      candidate.readiness_decision
      === "blocked_duplicate_requires_manual_review"
    ),
  );
  assert.ok(duplicate);
  const unsupported = confirmedPreview.blocked_candidates.find(
    (candidate) => candidate.lineage.source_file === "notes.txt",
  );
  assert.equal(
    unsupported.readiness_decision,
    "rejected_unsupported_extension",
  );

  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig();
  const intakePreview = await scanVisualLibraryIntakePreview({ sourceDir });
  const safeCandidate = intakePreview.candidates.find(
    (candidate) => candidate.source_file === "scene-background.png",
  );
  const acceptedGate = evaluateVisualImportConfirmationGate(
    simulationConfig,
    simulationConfig.required_confirmation_text,
  );
  const safeOperation = await buildVisualImportOperationPreview({
    candidate: safeCandidate,
    config: simulationConfig,
    confirmationGate: acceptedGate,
    sourceRoot: fixtureRoot,
  });
  const unsafeOperation = {
    ...safeOperation,
    proposed_target_path: "../outside.png",
    proposed_visual_index_record: {
      ...safeOperation.proposed_visual_index_record,
      path: "../outside.png",
    },
  };
  const unsafeCandidatePreview = buildPendingVisualImportCandidatePreview({
    operation: unsafeOperation,
    config,
    simulationConfig,
    visualIndexRecords: 0,
  });
  assert.equal(
    unsafeCandidatePreview.readiness_decision,
    "blocked_unsafe_target_path",
  );

  const incompleteCandidate = buildPendingVisualImportCandidatePreview({
    operation: safeOperation,
    config,
    simulationConfig,
    visualIndexRecords: 0,
    lineage: {
      intake_candidate_id: safeOperation.intake_candidate_id,
      import_operation_id: safeOperation.operation_id,
      source_file: safeOperation.source_file,
      source_sha256: null,
      source_size_bytes: safeOperation.source_size_bytes,
      proposed_visual_id: safeOperation.proposed_visual_id,
      proposed_target_path: safeOperation.proposed_target_path,
    },
  });
  assert.equal(
    incompleteCandidate.readiness_decision,
    "blocked_incomplete_lineage",
  );
  assert.equal(
    validatePendingVisualImportLineage(incompleteCandidate.lineage).complete,
    false,
  );

  const nonEmptyIndexCandidate = buildPendingVisualImportCandidatePreview({
    operation: safeOperation,
    config,
    simulationConfig,
    visualIndexRecords: 1,
  });
  assert.equal(
    nonEmptyIndexCandidate.readiness_decision,
    "blocked_visual_index_not_empty",
  );

  const missingOperation = await buildVisualImportOperationPreview({
    candidate: {
      ...safeCandidate,
      source_file: "scene-missing.png",
    },
    config: simulationConfig,
    confirmationGate: acceptedGate,
    sourceRoot: fixtureRoot,
  });
  const missingCandidate = buildPendingVisualImportCandidatePreview({
    operation: missingOperation,
    config,
    simulationConfig,
    visualIndexRecords: 0,
  });
  assert.equal(
    missingCandidate.readiness_decision,
    "blocked_missing_source_file",
  );

  const unsupportedOperation = {
    operation_id: "VIO-UNSUPPORTED",
    intake_candidate_id: "VIC-UNSUPPORTED",
    source_file: "notes.txt",
    source_sha256: sha256(Buffer.from("unsupported", "utf8")),
    source_size_bytes: 11,
    category: "scenes",
    proposed_visual_id: "VIS-INTAKE-UNSUPPORTED",
    proposed_target_path:
      "data/visual_db/assets/scenes/notes-unsupported.txt",
    proposed_visual_index_record: null,
    duplicate_status: null,
    duplicate_group_id: null,
    import_decision: "rejected_unsupported_extension",
    blocked_reasons: ["unsupported_extension"],
    warnings: ["unsupported_extension"],
  };
  const unsupportedCandidate = buildPendingVisualImportCandidatePreview({
    operation: unsupportedOperation,
    config,
    simulationConfig,
    visualIndexRecords: 0,
  });
  assert.equal(
    unsupportedCandidate.readiness_decision,
    "rejected_unsupported_extension",
  );
  const unsupportedCard = buildVisualImportApprovalReadinessCard(
    unsupportedCandidate,
  );
  assert.equal(unsupportedCard.can_submit_to_approval_queue, false);

  for (const candidate of [
    ...confirmedPreview.pending_candidates,
    ...confirmedPreview.blocked_candidates,
  ]) {
    assert.equal(candidate.no_write_summary.writes_visual_index, false);
    assert.equal(candidate.no_write_summary.writes_visual_assets, false);
    assert.equal(candidate.no_write_summary.copies_files, false);
    assert.equal(candidate.no_write_summary.moves_files, false);
    assert.equal(candidate.no_write_summary.deletes_files, false);
    assert.equal(candidate.no_write_summary.writes_approval_queue, false);
    assert.equal(candidate.no_write_summary.creates_approval_item, false);
    assert.equal(candidate.no_write_summary.creates_canon_visual_lock, false);
    assert.equal(candidate.no_write_summary.updates_active_engine, false);
    assert.equal(candidate.no_write_summary.updates_canon_db, false);
  }

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);

  console.log("Visual library pending import readiness service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
}
