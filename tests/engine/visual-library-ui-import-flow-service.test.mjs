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
  loadVisualLibraryUiImportFlowConfig,
  runVisualLibraryUiImportFlowPreview,
  validateVisualLibraryUiImportFlowConfig,
} from "../../server/src/visual-library-ui-import-flow-service.mjs";
import {
  loadVisualLibraryConfirmedImportConfig,
} from "../../server/src/visual-library-confirmed-import-service.mjs";
import {
  loadVisualLibraryRollbackDeleteRestoreConfig,
} from "../../server/src/visual-library-rollback-delete-restore-service.mjs";
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
  `.phase-19c-test-${process.pid}-${Date.now()}`,
);
const sourceRoot = path.join(fixtureRoot, "source");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

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
    assetsRoot: path.relative(projectRoot, assets),
    trashRoot: path.relative(projectRoot, trash),
    restoreRoot: path.relative(projectRoot, restore),
    visualIndexPath: path.relative(projectRoot, index),
  };
}

function readyGuard(content) {
  const item = {
    controlled_import_item_id: "PHASE19C-SANDBOX-READY",
    source_file: "scene-background.png",
    source_sha256:
      createHash("sha256").update(content).digest("hex").toUpperCase(),
    source_size_bytes: content.length,
    proposed_visual_id: "VIS-PHASE19C-SANDBOX-001",
    proposed_target_path:
      "data/visual_db/assets/scenes/scene-background.png",
    proposed_visual_index_record: {
      visual_id: "VIS-PHASE19C-SANDBOX-001",
      created_at: "2026-01-01T00:00:00.000Z",
      category: "scenes",
      title: "phase19c sandbox",
      path: "data/visual_db/assets/scenes/scene-background.png",
    },
    guard_decision: "ready_for_phase_19a_confirmed_import",
  };
  return {
    controlled_import_guard_summary: {
      item_count: 1,
      ready_count: 1,
      blocked_count: 0,
    },
    controlled_import_items: [item],
    blocked_items: [],
    controlled_import_guard_decision: "ready_for_phase_19a_confirmed_import",
  };
}

const indexBefore = await readFile(formalIndex);
const engineBefore = await readFile(activeEngine);
const assetsBefore = await snapshot(formalAssets);
const approvalBefore = await snapshot(approvalQueue);

try {
  const { config } = await loadVisualLibraryUiImportFlowConfig();
  assert.equal(validateVisualLibraryUiImportFlowConfig(config), config);
  assert.throws(
    () => validateVisualLibraryUiImportFlowConfig({
      ...structuredClone(config),
      writes_visual_index: true,
    }),
    /writes_visual_index must be false/u,
  );

  const empty = await runVisualLibraryUiImportFlowPreview({
    sourceDir: path.relative(projectRoot, path.join(fixtureRoot, "missing")),
  });
  assert.equal(
    empty.ui_flow_decision,
    "empty_ui_import_flow_preview_passed",
  );
  for (const field of [
    "wizard_steps",
    "review_cards",
    "operation_cards",
  ]) assert.ok(Array.isArray(empty[field]));
  assert.ok(empty.safety_panel);
  assert.ok(empty.action_bar);
  assert.equal(empty.safety_panel.formal_gallery_empty_baseline, false);
  assert.equal(empty.action_bar.can_write_approval_queue, false);
  assert.equal(empty.action_bar.can_create_approval_item, false);
  assert.equal(empty.action_bar.can_create_canon_visual_lock, false);

  await mkdir(sourceRoot, { recursive: true });
  const sourceContent = Buffer.concat([tinyPng, Buffer.from("phase19c")]);
  await writeFile(path.join(sourceRoot, "scene-background.png"), sourceContent);
  const sourceDir = path.relative(projectRoot, sourceRoot);
  const preview = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "preview",
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
  });
  assert.equal(
    preview.ui_flow_decision,
    "visual_library_ui_import_flow_preview_ready",
  );
  assert.equal(preview.wizard_steps.length, 10);
  assert.equal(preview.review_cards.length, 8);
  assert.equal(preview.operation_cards.length, 4);
  for (const key of [
    "intake",
    "simulation",
    "readiness",
    "approval_dry_run",
    "final_acceptance",
    "controlled_guard",
  ]) assert.ok(preview.pipeline_summaries[key]);
  assert.equal(preview.action_bar.can_import, false);
  const sandboxGuard = readyGuard(sourceContent);

  const noExecute = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "import",
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
    realImportConfirmText: config.required_real_import_confirmation_text,
  });
  assert.equal(noExecute.ui_flow_decision, "blocked_missing_execute_flag");
  const wrongConfirmation = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "import",
    execute: true,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
    realImportConfirmText: "wrong",
  });
  assert.equal(
    wrongConfirmation.ui_flow_decision,
    "blocked_by_confirmation_gate",
  );

  const importConfig = (await loadVisualLibraryConfirmedImportConfig()).config;
  const operationConfig =
    (await loadVisualLibraryRollbackDeleteRestoreConfig()).config;
  const importBox = await sandbox("import-rollback");
  const imported = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "import",
    execute: true,
    ...importBox,
    controlledGuardPreview: sandboxGuard,
    confirmText: importConfig.required_simulation_confirmation_text,
    preWriteConfirmText: importConfig.required_pre_write_confirmation_text,
    realImportConfirmText: importConfig.required_real_import_confirmation_text,
  });
  assert.equal(
    imported.ui_flow_decision,
    "sandbox_ui_import_flow_import_completed",
  );
  const rollback = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "rollback-import",
    execute: true,
    ...importBox,
    controlledGuardPreview: sandboxGuard,
    manifest: imported.operation_result.rollback_manifest,
    rollbackConfirmText: operationConfig.required_rollback_confirmation_text,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
  });
  assert.equal(
    rollback.ui_flow_decision,
    "sandbox_ui_import_flow_rollback_completed",
  );

  const deleteBox = await sandbox("delete-restore");
  const deleteImport = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "import",
    execute: true,
    ...deleteBox,
    controlledGuardPreview: sandboxGuard,
    confirmText: importConfig.required_simulation_confirmation_text,
    preWriteConfirmText: importConfig.required_pre_write_confirmation_text,
    realImportConfirmText: importConfig.required_real_import_confirmation_text,
  });
  const visualId =
    deleteImport.operation_result.imported_items[0].proposed_visual_id;
  const deleted = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "delete",
    execute: true,
    ...deleteBox,
    controlledGuardPreview: sandboxGuard,
    visualId,
    deleteConfirmText: operationConfig.required_delete_confirmation_text,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
  });
  assert.equal(
    deleted.ui_flow_decision,
    "sandbox_ui_import_flow_delete_completed",
  );
  const restored = await runVisualLibraryUiImportFlowPreview({
    sourceDir,
    operation: "restore",
    execute: true,
    ...deleteBox,
    controlledGuardPreview: sandboxGuard,
    manifest: deleted.operation_result.operation_manifest,
    restoreConfirmText: operationConfig.required_restore_confirmation_text,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
  });
  assert.equal(
    restored.ui_flow_decision,
    "sandbox_ui_import_flow_restore_completed",
  );

  assert.deepEqual(await readFile(formalIndex), indexBefore);
  assert.deepEqual(await readFile(activeEngine), engineBefore);
  assert.deepEqual(await snapshot(formalAssets), assetsBefore);
  assert.deepEqual(await snapshot(approvalQueue), approvalBefore);
  console.log("Visual library UI import flow service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(formalIndex), indexBefore);
  assert.deepEqual(await readFile(activeEngine), engineBefore);
  assert.deepEqual(await snapshot(formalAssets), assetsBefore);
  assert.deepEqual(await snapshot(approvalQueue), approvalBefore);
}
