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
  loadVisualLibraryConfirmedImportConfig,
  runVisualLibraryConfirmedImport,
  validateVisualLibraryConfirmedImportConfig,
} from "../../server/src/visual-library-confirmed-import-service.mjs";
import {
  loadVisualLibraryControlledImportGuardConfig,
  runVisualLibraryControlledImportGuardPreview,
} from "../../server/src/visual-library-controlled-import-guard-service.mjs";
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
  `.phase-19a-test-${process.pid}-${Date.now()}`,
);
const sourceRoot = path.join(fixtureRoot, "source");
const sandboxesRoot = path.join(fixtureRoot, "sandboxes");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
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

async function sandbox(name) {
  const root = path.join(sandboxesRoot, name);
  const assets = path.join(root, "assets");
  const index = path.join(root, "visual_index.jsonl");
  await mkdir(assets, { recursive: true });
  await writeFile(index, "");
  return {
    root,
    assets,
    index,
    assetsRelative: path.relative(projectRoot, assets),
    indexRelative: path.relative(projectRoot, index),
  };
}

function clonedGuard(readyGuard, mutate = (value) => value) {
  const guard = structuredClone(readyGuard);
  guard.controlled_import_items = guard.controlled_import_items.map(mutate);
  guard.blocked_items = [];
  guard.controlled_import_guard_decision =
    "ready_for_phase_19a_confirmed_import";
  return guard;
}

const visualIndexBefore = await readFile(visualIndexPath);
const activeEngineBefore = await readFile(activeEnginePath);
const assetsBefore = await directorySnapshot(visualAssetsRoot);
const approvalQueueBefore = await directorySnapshot(approvalQueueRoot);

try {
  const { config } = await loadVisualLibraryConfirmedImportConfig();
  assert.equal(validateVisualLibraryConfirmedImportConfig(config), config);
  assert.throws(
    () => validateVisualLibraryConfirmedImportConfig({
      ...structuredClone(config),
      writes_approval_queue: true,
    }),
    /writes_approval_queue must be false/u,
  );

  const noExecute = await runVisualLibraryConfirmedImport();
  assert.equal(
    noExecute.confirmed_import_decision,
    "blocked_missing_execute_flag",
  );
  assert.equal(noExecute.write_summary.visual_index_written, false);

  const common = {
    execute: true,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
    realImportConfirmText: config.required_real_import_confirmation_text,
  };
  assert.equal(
    (await runVisualLibraryConfirmedImport({
      ...common,
      confirmText: undefined,
    })).confirmed_import_decision,
    "blocked_by_simulation_confirmation_gate",
  );
  assert.equal(
    (await runVisualLibraryConfirmedImport({
      ...common,
      preWriteConfirmText: undefined,
    })).confirmed_import_decision,
    "blocked_by_pre_write_confirmation_gate",
  );
  assert.equal(
    (await runVisualLibraryConfirmedImport({
      ...common,
      realImportConfirmText: undefined,
    })).confirmed_import_decision,
    "blocked_by_real_import_confirmation_gate",
  );

  await mkdir(sourceRoot, { recursive: true });
  const sourceFile = path.join(sourceRoot, "scene-background.png");
  const sourceContent = Buffer.concat([tinyPng, Buffer.from("phase19a")]);
  await writeFile(sourceFile, sourceContent);
  const sourceDir = path.relative(projectRoot, sourceRoot);
  const { config: guardConfig } =
    await loadVisualLibraryControlledImportGuardConfig();
  const readyGuard = await runVisualLibraryControlledImportGuardPreview({
    sourceDir,
    confirmText: guardConfig.required_simulation_confirmation_text,
    preWriteConfirmText: guardConfig.required_pre_write_confirmation_text,
  });
  assert.equal(
    readyGuard.controlled_import_guard_decision,
    "ready_for_phase_19a_confirmed_import",
  );

  const successBox = await sandbox("success");
  const success = await runVisualLibraryConfirmedImport({
    ...common,
    sourceDir,
    visualAssetsRoot: successBox.assetsRelative,
    visualIndexPath: successBox.indexRelative,
    controlledGuardPreview: readyGuard,
  });
  assert.equal(
    success.confirmed_import_decision,
    "confirmed_visual_import_completed",
  );
  assert.equal(success.imported_items.length, 1);
  const successIndex = await readFile(successBox.index, "utf8");
  const successRecord = JSON.parse(successIndex.trim());
  assert.equal(successRecord.source, "visual_library_confirmed_import");
  assert.equal(successRecord.metadata_source, "confirmed_import");
  assert.equal(successRecord.status, "imported");
  assert.ok(successRecord.path.startsWith("data/visual_db/assets/"));
  const successAsset = await readFile(success.imported_items[0].target_path);
  assert.equal(sha256(successAsset), sha256(sourceContent));
  assert.equal(success.rollback_manifest.rollback_completed, false);

  const repeated = await runVisualLibraryConfirmedImport({
    ...common,
    sourceDir,
    visualAssetsRoot: successBox.assetsRelative,
    visualIndexPath: successBox.indexRelative,
    controlledGuardPreview: readyGuard,
  });
  assert.equal(
    repeated.confirmed_import_decision,
    "blocked_target_already_occupied",
  );

  const blockedCases = [
    {
      name: "missing-source",
      expected: "blocked_missing_source_file",
      guard: clonedGuard(readyGuard, (item) => ({
        ...item,
        source_file: "missing.png",
      })),
    },
    {
      name: "hash-mismatch",
      expected: "blocked_source_hash_mismatch",
      guard: clonedGuard(readyGuard, (item) => ({
        ...item,
        source_sha256: "0".repeat(64),
      })),
    },
    {
      name: "unsafe-target",
      expected: "blocked_unsafe_target_path",
      guard: clonedGuard(readyGuard, (item) => ({
        ...item,
        proposed_target_path: "../outside.png",
      })),
    },
  ];
  for (const blockedCase of blockedCases) {
    const box = await sandbox(blockedCase.name);
    const result = await runVisualLibraryConfirmedImport({
      ...common,
      sourceDir,
      visualAssetsRoot: box.assetsRelative,
      visualIndexPath: box.indexRelative,
      controlledGuardPreview: blockedCase.guard,
    });
    assert.equal(result.confirmed_import_decision, blockedCase.expected);
    assert.equal((await directorySnapshot(box.assets)).length, 0);
  }

  const stateBox = await sandbox("index-state");
  const stateMismatch = await runVisualLibraryConfirmedImport({
    ...common,
    sourceDir,
    visualAssetsRoot: stateBox.assetsRelative,
    visualIndexPath: stateBox.indexRelative,
    controlledGuardPreview: readyGuard,
    expectedVisualIndexHash: "F".repeat(64),
  });
  assert.equal(
    stateMismatch.confirmed_import_decision,
    "blocked_visual_index_state_mismatch",
  );

  const failureCases = [
    {
      name: "asset-copy-failure",
      option: "injectAssetCopyFailure",
      expected: "failed_asset_copy_rolled_back",
    },
    {
      name: "index-write-failure",
      option: "injectIndexWriteFailure",
      expected: "failed_visual_index_write_rolled_back",
    },
    {
      name: "post-validation-failure",
      option: "injectPostWriteValidationFailure",
      expected: "failed_post_write_validation_rolled_back",
    },
  ];
  for (const failureCase of failureCases) {
    const box = await sandbox(failureCase.name);
    const result = await runVisualLibraryConfirmedImport({
      ...common,
      sourceDir,
      visualAssetsRoot: box.assetsRelative,
      visualIndexPath: box.indexRelative,
      controlledGuardPreview: readyGuard,
      [failureCase.option]: true,
    });
    assert.equal(result.confirmed_import_decision, failureCase.expected);
    assert.equal(result.rollback_manifest.rollback_completed, true);
    assert.equal(await readFile(box.index, "utf8"), "");
    assert.equal((await directorySnapshot(box.assets)).length, 0);
  }

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
  console.log("Visual library confirmed import service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
}
