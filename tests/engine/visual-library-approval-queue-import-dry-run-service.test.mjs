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
  buildVisualLibraryApprovalItemDryRunPayload,
  buildVisualLibraryApprovalQueueGuardPreview,
  loadVisualLibraryApprovalQueueImportDryRunConfig,
  runVisualLibraryApprovalQueueImportDryRunPreview,
  validateVisualLibraryApprovalItemLineage,
  validateVisualLibraryApprovalItemNoWriteSafety,
  validateVisualLibraryApprovalItemRisk,
  validateVisualLibraryApprovalQueueImportDryRunConfig,
} from "../../server/src/visual-library-approval-queue-import-dry-run-service.mjs";
import {
  loadVisualLibraryImportSimulationConfig,
} from "../../server/src/visual-library-import-simulation-service.mjs";
import {
  runVisualLibraryPendingImportReadinessPreview,
} from "../../server/src/visual-library-pending-import-readiness-service.mjs";
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
  `.phase-18e-test-${process.pid}-${Date.now()}`,
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
  const { config } =
    await loadVisualLibraryApprovalQueueImportDryRunConfig();
  assert.equal(
    validateVisualLibraryApprovalQueueImportDryRunConfig(config),
    config,
  );
  assert.throws(
    () => validateVisualLibraryApprovalQueueImportDryRunConfig({
      ...structuredClone(config),
      creates_approval_item: true,
    }),
    /creates_approval_item must be false/u,
  );
  assert.equal(
    sha256Lf(activeEngineBefore.toString("utf8")),
    config.expected_engine_sha256_lf,
  );

  const emptyPreview =
    await runVisualLibraryApprovalQueueImportDryRunPreview();
  assert.equal(
    emptyPreview.approval_queue_dry_run_summary.decision,
    "empty_approval_queue_import_dry_run",
  );
  assert.deepEqual(emptyPreview.approval_item_previews, []);
  assert.deepEqual(emptyPreview.guard_cards, []);
  assert.deepEqual(emptyPreview.blocked_items, []);

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
  const sourceDir = path.relative(projectRoot, fixtureRoot);

  const confirmedReadiness =
    await runVisualLibraryPendingImportReadinessPreview({
      sourceDir,
      confirmText: config.required_confirmation_text,
    });
  const lockedReadiness = {
    ...confirmedReadiness,
    confirmation_gate: {
      ...confirmedReadiness.confirmation_gate,
      provided: false,
      accepted: false,
      decision: "locked_by_confirmation_gate",
    },
  };
  const lockedPreview =
    await runVisualLibraryApprovalQueueImportDryRunPreview({
      sourceDir,
      readinessPreview: lockedReadiness,
    });
  const lockedScene = lockedPreview.blocked_items.find(
    (item) => item.lineage.source_file === "scene-background.png",
  );
  assert.equal(lockedScene.dry_run_decision, "blocked_by_confirmation_gate");

  const confirmedPreview =
    await runVisualLibraryApprovalQueueImportDryRunPreview({
      sourceDir,
      confirmText: config.required_confirmation_text,
    });
  const readyScene = confirmedPreview.approval_item_previews.find(
    (item) => item.lineage.source_file === "scene-background.png",
  );
  assert.equal(
    readyScene.dry_run_decision,
    "approval_queue_import_dry_run_ready",
  );
  assert.equal(
    readyScene.guard_summary.real_approval_queue_write_allowed,
    false,
  );
  const readyCard = confirmedPreview.guard_cards.find(
    (card) => (
      card.approval_item_preview_id
      === readyScene.approval_item_preview_id
    ),
  );
  assert.equal(readyCard.can_write_approval_queue, false);
  assert.equal(readyCard.can_create_approval_item, false);
  assert.equal(readyCard.can_confirm_import, false);
  assert.equal(readyCard.can_write_visual_index, false);
  assert.equal(readyCard.can_copy_visual_asset, false);
  assert.equal(readyCard.can_create_canon_visual_lock, false);

  const unknown = confirmedPreview.blocked_items.find(
    (item) => item.lineage.source_file === "misc-reference.png",
  );
  assert.equal(
    unknown.dry_run_decision,
    "blocked_requires_manual_category_review",
  );
  assert.ok(
    unknown.blocked_reasons.some(
      (reason) => reason.includes("blocked_requires_manual_category_review"),
    ),
  );
  const duplicate = confirmedPreview.blocked_items.find(
    (item) => (
      item.dry_run_decision
      === "blocked_duplicate_requires_manual_review"
    ),
  );
  assert.ok(duplicate);

  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig();
  const readyCandidate = confirmedReadiness.pending_candidates.find(
    (candidate) => candidate.lineage.source_file === "scene-background.png",
  );
  assert.equal(
    validateVisualLibraryApprovalItemLineage({
      ...readyCandidate.lineage,
      pending_candidate_id: readyCandidate.pending_candidate_id,
    }).valid,
    true,
  );
  assert.equal(
    validateVisualLibraryApprovalItemRisk(readyCandidate.risk_summary).acceptable,
    true,
  );
  assert.equal(
    validateVisualLibraryApprovalItemNoWriteSafety(
      readyCandidate.no_write_summary,
    ).valid,
    true,
  );

  const unsafeCandidate = {
    ...readyCandidate,
    lineage: {
      ...readyCandidate.lineage,
      proposed_target_path: "../outside.png",
    },
    proposed_visual_index_record: {
      ...readyCandidate.proposed_visual_index_record,
      path: "../outside.png",
    },
  };
  const unsafeItem = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: unsafeCandidate,
    config,
    simulationConfig,
    confirmationGate: confirmedReadiness.confirmation_gate,
    visualIndexRecords: 0,
  });
  assert.equal(unsafeItem.dry_run_decision, "blocked_unsafe_target_path");

  const incompleteItem = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: readyCandidate,
    config,
    simulationConfig,
    confirmationGate: confirmedReadiness.confirmation_gate,
    visualIndexRecords: 0,
    lineage: {
      ...readyCandidate.lineage,
      pending_candidate_id: readyCandidate.pending_candidate_id,
      source_sha256: null,
    },
  });
  assert.equal(incompleteItem.dry_run_decision, "blocked_incomplete_lineage");

  const unsafeSummary = {
    ...readyCandidate.no_write_summary,
    writes_approval_queue: true,
  };
  const safetyViolationItem = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: readyCandidate,
    config,
    simulationConfig,
    confirmationGate: confirmedReadiness.confirmation_gate,
    visualIndexRecords: 0,
    noWrite: unsafeSummary,
  });
  assert.equal(
    safetyViolationItem.dry_run_decision,
    "blocked_no_write_safety_violation",
  );

  const nonEmptyIndexItem = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: readyCandidate,
    config,
    simulationConfig,
    confirmationGate: confirmedReadiness.confirmation_gate,
    visualIndexRecords: 1,
  });
  assert.equal(
    nonEmptyIndexItem.dry_run_decision,
    "blocked_visual_index_not_empty",
  );

  const blockedReadinessCandidate = confirmedReadiness.blocked_candidates[0];
  const blockedReadinessItem = buildVisualLibraryApprovalItemDryRunPayload({
    candidate: blockedReadinessCandidate,
    config,
    simulationConfig,
    confirmationGate: confirmedReadiness.confirmation_gate,
    visualIndexRecords: 0,
  });
  assert.notEqual(
    blockedReadinessItem.dry_run_decision,
    "approval_queue_import_dry_run_ready",
  );
  const guardCard = buildVisualLibraryApprovalQueueGuardPreview(
    safetyViolationItem,
  );
  assert.equal(guardCard.can_write_approval_queue, false);
  assert.ok(guardCard.disabled_actions.includes("create_approval_item"));

  for (const item of confirmedPreview.approval_item_previews) {
    assert.equal(item.no_write_summary.writes_visual_index, false);
    assert.equal(item.no_write_summary.writes_visual_assets, false);
    assert.equal(item.no_write_summary.copies_files, false);
    assert.equal(item.no_write_summary.moves_files, false);
    assert.equal(item.no_write_summary.deletes_files, false);
    assert.equal(item.no_write_summary.writes_approval_queue, false);
    assert.equal(item.no_write_summary.creates_approval_item, false);
    assert.equal(item.no_write_summary.creates_canon_visual_lock, false);
    assert.equal(item.no_write_summary.updates_active_engine, false);
    assert.equal(item.no_write_summary.updates_canon_db, false);
  }

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);

  console.log(
    "Visual library Approval Queue import dry-run service test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
}
