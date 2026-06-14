import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  loadPersistentBaselineSelectedSet,
  loadVisualLibraryPersistentBaselineActivationConfig,
  runVisualLibraryPersistentBaselineActivation,
  validatePersistentBaselineSelectedSet,
  validateVisualLibraryPersistentBaselineActivationConfig,
} from "../../server/src/visual-library-persistent-baseline-activation-service.mjs";
import {
  loadVisualLibraryRollbackDeleteRestoreConfig,
  runVisualLibraryRollbackDeleteRestoreOperation,
} from "../../server/src/visual-library-rollback-delete-restore-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const formalIndex = path.join(projectRoot, "data", "visual_db", "visual_index.jsonl");
const formalAssets = path.join(projectRoot, "data", "visual_db", "assets");
const activeEngine = path.join(projectRoot, "data", "canon_db", "active_engine.md");
const compressedRules = path.join(
  projectRoot,
  "data",
  "error_report_db",
  "compressed_rules.md",
);
const approvalQueue = path.join(projectRoot, "data", "approval_queue");
const canonDb = path.join(projectRoot, "data", "canon_db");
const fixtureRoot = path.join(
  projectRoot,
  "data",
  "tmp",
  `phase19h-b-${process.pid}-${Date.now()}`,
);

async function snapshot(root) {
  const entries = [];
  async function walk(current) {
    let children;
    try {
      children = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (child.isDirectory()) {
        entries.push(`d:${relative}`);
        await walk(absolute);
      } else {
        entries.push(`f:${relative}:${(await readFile(absolute)).toString("base64")}`);
      }
    }
  }
  await walk(root);
  return entries;
}

const formalBefore = {
  index: await readFile(formalIndex),
  assets: await snapshot(formalAssets),
  engine: await readFile(activeEngine),
  compressed: await readFile(compressedRules),
  approval: await snapshot(approvalQueue),
  canon: await snapshot(canonDb),
};

try {
  const { config } =
    await loadVisualLibraryPersistentBaselineActivationConfig();
  const selectedSet = await loadPersistentBaselineSelectedSet(config);
  assert.equal(
    validateVisualLibraryPersistentBaselineActivationConfig(config),
    config,
  );
  assert.equal(
    validatePersistentBaselineSelectedSet(selectedSet, config),
    selectedSet,
  );
  assert.throws(
    () => validateVisualLibraryPersistentBaselineActivationConfig({
      ...structuredClone(config),
      updates_active_engine: true,
    }),
    /updates_active_engine must be false/u,
  );

  const sandbox = {
    index: path.join(fixtureRoot, "visual_index.jsonl"),
    assets: path.join(fixtureRoot, "assets"),
    intake: path.join(fixtureRoot, "intake"),
    engine: path.join(fixtureRoot, "active_engine.md"),
    compressed: path.join(fixtureRoot, "compressed_rules.md"),
    approval: path.join(fixtureRoot, "approval_queue"),
    canon: path.join(fixtureRoot, "canon_db"),
    manifest: path.join(fixtureRoot, "rollback-manifest.json"),
    trash: path.join(fixtureRoot, "trash"),
    restore: path.join(fixtureRoot, "restore"),
  };
  await Promise.all([
    mkdir(sandbox.assets, { recursive: true }),
    mkdir(sandbox.intake, { recursive: true }),
    mkdir(sandbox.approval, { recursive: true }),
    mkdir(sandbox.canon, { recursive: true }),
  ]);
  await writeFile(sandbox.index, "");
  await writeFile(sandbox.engine, formalBefore.engine);
  await writeFile(sandbox.compressed, formalBefore.compressed);
  await writeFile(path.join(sandbox.canon, "fixture.md"), "canon unchanged");
  for (const item of selectedSet.items) {
    await copyFile(
      path.join(projectRoot, item.target_path),
      path.join(sandbox.intake, item.source_file),
    );
  }
  const sandboxConfig = {
    ...structuredClone(config),
    formal_visual_index_path: path.relative(projectRoot, sandbox.index),
    formal_assets_root: path.relative(projectRoot, sandbox.assets),
    formal_intake_root: path.relative(projectRoot, sandbox.intake),
    active_engine_path: path.relative(projectRoot, sandbox.engine),
    compressed_rules_path: path.relative(projectRoot, sandbox.compressed),
    approval_queue_root: path.relative(projectRoot, sandbox.approval),
    canon_db_root: path.relative(projectRoot, sandbox.canon),
    rollback_manifest_path: path.relative(projectRoot, sandbox.manifest),
  };

  const preview = await runVisualLibraryPersistentBaselineActivation({
    config: sandboxConfig,
    selectedSet,
  });
  assert.equal(preview.activation_decision, "persistent_baseline_activation_ready");
  assert.equal(preview.activation_plan.preconditions.selected_items_ready, true);

  const blocked = await runVisualLibraryPersistentBaselineActivation({
    config: sandboxConfig,
    selectedSet,
    execute: true,
  });
  assert.equal(
    blocked.activation_decision,
    "blocked_by_simulation_confirmation_gate",
  );

  const activated = await runVisualLibraryPersistentBaselineActivation({
    config: sandboxConfig,
    selectedSet,
    execute: true,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
    realImportConfirmText: config.required_real_import_confirmation_text,
    transitionConfirmText:
      config.required_persistent_baseline_transition_confirmation_text,
    createdAt: "2026-06-14T00:00:00.000Z",
  });
  assert.equal(
    activated.activation_decision,
    "visual_library_persistent_baseline_activation_completed",
  );
  assert.equal(activated.imported_items.length, 3);
  assert.equal(activated.validation_summary.valid, true);
  assert.equal(activated.write_summary.rollback_manifest_written, true);
  assert.equal(
    (await readFile(sandbox.index, "utf8"))
      .split(/\r?\n/u)
      .filter((line) => line.trim()).length,
    3,
  );

  const { config: rollbackBase } =
    await loadVisualLibraryRollbackDeleteRestoreConfig();
  const rollbackConfig = {
    ...rollbackBase,
    visual_assets_root: sandboxConfig.formal_assets_root,
    visual_index_path: sandboxConfig.formal_visual_index_path,
    active_engine_path: sandboxConfig.active_engine_path,
    visual_trash_root: path.relative(projectRoot, sandbox.trash),
    visual_restore_root: path.relative(projectRoot, sandbox.restore),
  };
  const rolledBack = await runVisualLibraryRollbackDeleteRestoreOperation({
    operation: "rollback-import",
    execute: true,
    confirmText: rollbackConfig.required_rollback_confirmation_text,
    manifest: activated.rollback_manifest,
    config: rollbackConfig,
  });
  assert.equal(
    rolledBack.operation_decision,
    "visual_import_rollback_completed",
  );
  assert.equal((await readFile(sandbox.index, "utf8")), "");
  assert.equal((await snapshot(sandbox.assets)).filter(
    (entry) => entry.includes(".png:"),
  ).length, 0);

  const cliPayload = await runVisualLibraryPersistentBaselineActivation({ config: sandboxConfig });
  assert.ok([
    "persistent_baseline_activation_ready",
    "persistent_baseline_already_active",
  ].includes(cliPayload.activation_decision));

  assert.deepEqual(await readFile(formalIndex), formalBefore.index);
  assert.deepEqual(await snapshot(formalAssets), formalBefore.assets);
  assert.deepEqual(await readFile(activeEngine), formalBefore.engine);
  assert.deepEqual(await readFile(compressedRules), formalBefore.compressed);
  assert.deepEqual(await snapshot(approvalQueue), formalBefore.approval);
  assert.deepEqual(await snapshot(canonDb), formalBefore.canon);
  console.log(
    "Visual library persistent baseline activation service test passed.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(formalIndex), formalBefore.index);
  assert.deepEqual(await snapshot(formalAssets), formalBefore.assets);
  assert.deepEqual(await readFile(activeEngine), formalBefore.engine);
  assert.deepEqual(await readFile(compressedRules), formalBefore.compressed);
  assert.deepEqual(await snapshot(approvalQueue), formalBefore.approval);
  assert.deepEqual(await snapshot(canonDb), formalBefore.canon);
}
