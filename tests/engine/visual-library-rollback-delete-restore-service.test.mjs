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
  loadVisualLibraryRollbackDeleteRestoreConfig,
  runVisualLibraryRollbackDeleteRestoreOperation,
  validateVisualLibraryRollbackDeleteRestoreConfig,
} from "../../server/src/visual-library-rollback-delete-restore-service.mjs";
import {
  loadVisualLibraryConfirmedImportConfig,
  runVisualLibraryConfirmedImport,
} from "../../server/src/visual-library-confirmed-import-service.mjs";
import {
  loadVisualLibraryControlledImportGuardConfig,
  runVisualLibraryControlledImportGuardPreview,
} from "../../server/src/visual-library-controlled-import-guard-service.mjs";
import {
  loadVisualLibraryFinalAcceptanceConfig,
  runVisualLibraryFinalAcceptancePreview,
} from "../../server/src/visual-library-final-acceptance-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const formalIndex = path.join(
  projectRoot,
  "data",
  "visual_db",
  "visual_index.jsonl",
);
const formalAssets = path.join(projectRoot, "data", "visual_db", "assets");
const activeEngine = path.join(
  projectRoot,
  "data",
  "canon_db",
  "active_engine.md",
);
const approvalQueue = path.join(projectRoot, "data", "approval_queue");
const fixtureRoot = path.join(
  projectRoot,
  "data",
  "visual_db",
  `.phase-19b-test-${process.pid}-${Date.now()}`,
);
const sourceRoot = path.join(fixtureRoot, "source");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

async function snapshot(directory) {
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

async function sandbox(name) {
  const root = path.join(fixtureRoot, name);
  const assets = path.join(root, "assets");
  const trash = path.join(root, "trash");
  const restore = path.join(root, "restore");
  const index = path.join(root, "visual_index.jsonl");
  await Promise.all([
    mkdir(assets, { recursive: true }),
    mkdir(trash, { recursive: true }),
    mkdir(restore, { recursive: true }),
  ]);
  await writeFile(index, "");
  return {
    root,
    assets,
    trash,
    restore,
    index,
    assetsRel: path.relative(projectRoot, assets),
    trashRel: path.relative(projectRoot, trash),
    restoreRel: path.relative(projectRoot, restore),
    indexRel: path.relative(projectRoot, index),
  };
}

function operationArgs(box) {
  return {
    visualIndexPath: box.indexRel,
    assetsRoot: box.assetsRel,
    trashRoot: box.trashRel,
    restoreRoot: box.restoreRel,
    execute: true,
  };
}

async function importInto(box, readyGuard, sourceDir, importConfig) {
  return runVisualLibraryConfirmedImport({
    execute: true,
    sourceDir,
    visualAssetsRoot: box.assetsRel,
    visualIndexPath: box.indexRel,
    controlledGuardPreview: readyGuard,
    confirmText: importConfig.required_simulation_confirmation_text,
    preWriteConfirmText: importConfig.required_pre_write_confirmation_text,
    realImportConfirmText: importConfig.required_real_import_confirmation_text,
  });
}

const indexBefore = await readFile(formalIndex);
const engineBefore = await readFile(activeEngine);
const assetsBefore = await snapshot(formalAssets);
const approvalBefore = await snapshot(approvalQueue);

try {
  const { config } = await loadVisualLibraryRollbackDeleteRestoreConfig();
  assert.equal(validateVisualLibraryRollbackDeleteRestoreConfig(config), config);
  assert.throws(
    () => validateVisualLibraryRollbackDeleteRestoreConfig({
      ...structuredClone(config),
      creates_canon_visual_lock: true,
    }),
    /creates_canon_visual_lock must be false/u,
  );

  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation()).operation_decision,
    "blocked_missing_operation",
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      operation: "delete",
    })).operation_decision,
    "blocked_missing_execute_flag",
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      operation: "delete",
      execute: true,
      visualId: "VIS-X",
      confirmText: "wrong",
    })).operation_decision,
    "blocked_by_confirmation_gate",
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      operation: "unknown",
      execute: true,
    })).operation_decision,
    "blocked_unknown_operation",
  );

  await mkdir(sourceRoot, { recursive: true });
  const sourceContent = Buffer.concat([tinyPng, Buffer.from("phase19b")]);
  await writeFile(path.join(sourceRoot, "scene-background.png"), sourceContent);
  const sourceDir = path.relative(projectRoot, sourceRoot);
  const { config: guardConfig } =
    await loadVisualLibraryControlledImportGuardConfig();
  const { config: finalAcceptanceConfig } =
    await loadVisualLibraryFinalAcceptanceConfig();
  const finalAcceptancePreview = await runVisualLibraryFinalAcceptancePreview({
    sourceDir,
    confirmText: finalAcceptanceConfig.required_confirmation_text,
    visualIndexRecords: 0,
  });

  const readyGuard = await runVisualLibraryControlledImportGuardPreview({
    sourceDir,
    confirmText: guardConfig.required_simulation_confirmation_text,
    preWriteConfirmText: guardConfig.required_pre_write_confirmation_text,
    visualIndexRecords: 0,
    finalAcceptancePreview,
  });
  const { config: importConfig } =
    await loadVisualLibraryConfirmedImportConfig();

  const rollbackBox = await sandbox("rollback-success");
  const importedForRollback =
    await importInto(rollbackBox, readyGuard, sourceDir, importConfig);
  assert.equal(
    importedForRollback.confirmed_import_decision,
    "confirmed_visual_import_completed",
  );
  const unrelatedAsset = path.join(rollbackBox.assets, "scenes", "unrelated.png");
  await writeFile(unrelatedAsset, Buffer.from("unrelated"));
  const rollbackResult = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(rollbackBox),
    operation: "rollback-import",
    confirmText: config.required_rollback_confirmation_text,
    manifest: importedForRollback.rollback_manifest,
  });
  assert.equal(
    rollbackResult.operation_decision,
    "visual_import_rollback_completed",
  );
  assert.equal(await readFile(rollbackBox.index, "utf8"), "");
  assert.equal((await stat(unrelatedAsset)).isFile(), true);

  const deleteBox = await sandbox("delete-restore-success");
  const imported = await importInto(deleteBox, readyGuard, sourceDir, importConfig);
  const visualId = imported.imported_items[0].proposed_visual_id;
  const originalAsset = imported.imported_items[0].target_path;
  const unrelatedRecord = {
    ...imported.imported_items[0].visual_index_record,
    visual_id: "VIS-UNRELATED-001",
    path: "data/visual_db/assets/scenes/unrelated-record.png",
  };
  const currentRecord = JSON.parse((await readFile(deleteBox.index, "utf8")).trim());
  await writeFile(
    deleteBox.index,
    `${JSON.stringify(currentRecord)}\n${JSON.stringify(unrelatedRecord)}\n`,
  );
  await writeFile(
    path.join(deleteBox.assets, "scenes", "unrelated-record.png"),
    Buffer.from("keep"),
  );
  const deleteResult = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(deleteBox),
    operation: "delete",
    visualId,
    confirmText: config.required_delete_confirmation_text,
  });
  assert.equal(deleteResult.operation_decision, "visual_delete_completed");
  assert.equal(deleteResult.operation_manifest.operation_completed, true);
  const deletedRecords = (await readFile(deleteBox.index, "utf8"))
    .trim().split("\n").map(JSON.parse);
  assert.deepEqual(deletedRecords.map((item) => item.visual_id), [
    "VIS-UNRELATED-001",
  ]);
  assert.equal(await stat(deleteResult.operation_plan.trash_path).then(
    (item) => item.isFile(),
  ), true);
  assert.equal(sha256(await readFile(deleteResult.operation_plan.trash_path)), sha256(sourceContent));

  const restoreResult = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(deleteBox),
    operation: "restore",
    confirmText: config.required_restore_confirmation_text,
    manifest: deleteResult.operation_manifest,
  });
  assert.equal(restoreResult.operation_decision, "visual_restore_completed");
  assert.equal(sha256(await readFile(originalAsset)), sha256(sourceContent));
  const restoredIds = (await readFile(deleteBox.index, "utf8"))
    .trim().split("\n").map(JSON.parse).map((item) => item.visual_id);
  assert.ok(restoredIds.includes(visualId));
  assert.ok(restoredIds.includes("VIS-UNRELATED-001"));

  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(await sandbox("missing-rollback-manifest")),
      operation: "rollback-import",
      confirmText: config.required_rollback_confirmation_text,
    })).operation_decision,
    "blocked_missing_rollback_manifest",
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(await sandbox("missing-delete-id")),
      operation: "delete",
      confirmText: config.required_delete_confirmation_text,
    })).operation_decision,
    "blocked_missing_visual_id",
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(await sandbox("missing-restore-manifest")),
      operation: "restore",
      confirmText: config.required_restore_confirmation_text,
    })).operation_decision,
    "blocked_missing_restore_manifest",
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(await sandbox("id-not-found")),
      operation: "delete",
      visualId: "VIS-NOT-FOUND",
      confirmText: config.required_delete_confirmation_text,
    })).operation_decision,
    "blocked_visual_id_not_found",
  );

  const missingAssetBox = await sandbox("missing-asset");
  const missingImport = await importInto(
    missingAssetBox,
    readyGuard,
    sourceDir,
    importConfig,
  );
  await rm(missingImport.imported_items[0].target_path);
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(missingAssetBox),
      operation: "delete",
      visualId: missingImport.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
    })).operation_decision,
    "blocked_missing_visual_asset",
  );

  const mismatchBox = await sandbox("hash-mismatch");
  const mismatchImport = await importInto(
    mismatchBox,
    readyGuard,
    sourceDir,
    importConfig,
  );
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(mismatchBox),
      operation: "delete",
      visualId: mismatchImport.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
      expectedAssetSha256: "0".repeat(64),
    })).operation_decision,
    "blocked_asset_hash_mismatch",
  );

  const unsafeBox = await sandbox("unsafe");
  await writeFile(unsafeBox.index, `${JSON.stringify({
    ...currentRecord,
    visual_id: "VIS-UNSAFE",
    path: "../outside.png",
  })}\n`);
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(unsafeBox),
      operation: "delete",
      visualId: "VIS-UNSAFE",
      confirmText: config.required_delete_confirmation_text,
    })).operation_decision,
    "blocked_unsafe_target_path",
  );

  const occupiedTrashBox = await sandbox("trash-occupied");
  const occupiedImport = await importInto(
    occupiedTrashBox,
    readyGuard,
    sourceDir,
    importConfig,
  );
  const occupiedTrashPath = path.join(
    occupiedTrashBox.trash,
    occupiedImport.imported_items[0].proposed_visual_id,
    path.basename(occupiedImport.imported_items[0].target_path),
  );
  await mkdir(path.dirname(occupiedTrashPath), { recursive: true });
  await writeFile(occupiedTrashPath, "occupied");
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(occupiedTrashBox),
      operation: "delete",
      visualId: occupiedImport.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
    })).operation_decision,
    "blocked_trash_target_occupied",
  );

  const restoreOccupiedBox = await sandbox("restore-occupied");
  const restoreOccupiedImport = await importInto(
    restoreOccupiedBox,
    readyGuard,
    sourceDir,
    importConfig,
  );
  const deletedForOccupied = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(restoreOccupiedBox),
    operation: "delete",
    visualId: restoreOccupiedImport.imported_items[0].proposed_visual_id,
    confirmText: config.required_delete_confirmation_text,
  });
  await mkdir(path.dirname(restoreOccupiedImport.imported_items[0].target_path), {
    recursive: true,
  });
  await writeFile(restoreOccupiedImport.imported_items[0].target_path, "occupied");
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(restoreOccupiedBox),
      operation: "restore",
      confirmText: config.required_restore_confirmation_text,
      manifest: deletedForOccupied.operation_manifest,
    })).operation_decision,
    "blocked_restore_target_occupied",
  );

  const stateBox = await sandbox("state-mismatch");
  const stateImport = await importInto(stateBox, readyGuard, sourceDir, importConfig);
  assert.equal(
    (await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(stateBox),
      operation: "delete",
      visualId: stateImport.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
      expectedVisualIndexHash: "F".repeat(64),
    })).operation_decision,
    "blocked_visual_index_state_mismatch",
  );

  for (const failure of [
    ["index", "injectIndexWriteFailure", "failed_visual_index_write_rolled_back"],
    ["asset", "injectAssetOperationFailure", "failed_asset_operation_rolled_back"],
    ["validation", "injectPostOperationValidationFailure", "failed_post_operation_validation_rolled_back"],
  ]) {
    const box = await sandbox(`delete-failure-${failure[0]}`);
    const importResult = await importInto(box, readyGuard, sourceDir, importConfig);
    const beforeIndex = await readFile(box.index);
    const assetPath = importResult.imported_items[0].target_path;
    const result = await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(box),
      operation: "delete",
      visualId: importResult.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
      [failure[1]]: true,
    });
    assert.equal(result.operation_decision, failure[2]);
    assert.deepEqual(await readFile(box.index), beforeIndex);
    assert.equal(sha256(await readFile(assetPath)), sha256(sourceContent));
  }

  const restoreFailureBox = await sandbox("restore-failure");
  const restoreFailureImport = await importInto(
    restoreFailureBox,
    readyGuard,
    sourceDir,
    importConfig,
  );
  const restoreFailureDelete =
    await runVisualLibraryRollbackDeleteRestoreOperation({
      ...operationArgs(restoreFailureBox),
      operation: "delete",
      visualId: restoreFailureImport.imported_items[0].proposed_visual_id,
      confirmText: config.required_delete_confirmation_text,
    });
  const deletedIndex = await readFile(restoreFailureBox.index);
  const restoreFailure = await runVisualLibraryRollbackDeleteRestoreOperation({
    ...operationArgs(restoreFailureBox),
    operation: "restore",
    confirmText: config.required_restore_confirmation_text,
    manifest: restoreFailureDelete.operation_manifest,
    injectIndexWriteFailure: true,
  });
  assert.equal(
    restoreFailure.operation_decision,
    "failed_visual_index_write_rolled_back",
  );
  assert.deepEqual(await readFile(restoreFailureBox.index), deletedIndex);
  assert.equal(
    await stat(restoreFailureDelete.operation_plan.trash_path)
      .then((item) => item.isFile()),
    true,
  );

  assert.deepEqual(await readFile(formalIndex), indexBefore);
  assert.deepEqual(await readFile(activeEngine), engineBefore);
  assert.deepEqual(await snapshot(formalAssets), assetsBefore);
  assert.deepEqual(await snapshot(approvalQueue), approvalBefore);
  console.log("Visual library rollback/delete/restore service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(formalIndex), indexBefore);
  assert.deepEqual(await readFile(activeEngine), engineBefore);
  assert.deepEqual(await snapshot(formalAssets), assetsBefore);
  assert.deepEqual(await snapshot(approvalQueue), approvalBefore);
}
