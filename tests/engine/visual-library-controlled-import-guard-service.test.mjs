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
  buildControlledImportPreflightManifestPreview,
  buildControlledImportPreWriteGate,
  evaluateControlledImportGuardDecision,
  loadVisualLibraryControlledImportGuardConfig,
  runVisualLibraryControlledImportGuardPreview,
  validateControlledImportNoWriteSafety,
  validateVisualLibraryControlledImportGuardConfig,
} from "../../server/src/visual-library-controlled-import-guard-service.mjs";
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
  `.phase-18g-test-${process.pid}-${Date.now()}`,
);
const emptyFixtureRoot = `${fixtureRoot}-empty`;
const missingFixtureRoot = `${fixtureRoot}-missing`;

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

function safeNoWrite() {
  return {
    writes_visual_index: false,
    writes_visual_assets: false,
    copies_files: false,
    moves_files: false,
    deletes_files: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    updates_active_engine: false,
    updates_canon_db: false,
  };
}

const visualIndexBefore = await readFile(visualIndexPath);
const activeEngineBefore = await readFile(activeEnginePath);
const assetsBefore = await directorySnapshot(visualAssetsRoot);
const approvalQueueBefore = await directorySnapshot(approvalQueueRoot);

try {
  const { config } = await loadVisualLibraryControlledImportGuardConfig();
  assert.equal(validateVisualLibraryControlledImportGuardConfig(config), config);
  assert.throws(
    () => validateVisualLibraryControlledImportGuardConfig({
      ...structuredClone(config),
      copies_files: true,
    }),
    /copies_files must be false/u,
  );
  assert.equal(
    buildControlledImportPreWriteGate({
      providedText: config.required_pre_write_confirmation_text,
      requiredText: config.required_pre_write_confirmation_text,
    }).accepted,
    true,
  );

  const missingPreview = await runVisualLibraryControlledImportGuardPreview({
    sourceDir: path.relative(projectRoot, missingFixtureRoot),
  });
  assert.equal(
    missingPreview.controlled_import_guard_decision,
    "empty_controlled_import_guard_preview_passed",
  );

  await mkdir(emptyFixtureRoot, { recursive: true });
  const emptyPreview = await runVisualLibraryControlledImportGuardPreview({
    sourceDir: path.relative(projectRoot, emptyFixtureRoot),
  });
  assert.equal(
    emptyPreview.controlled_import_guard_decision,
    "empty_controlled_import_guard_preview_passed",
  );

  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "scene-background.png"),
    Buffer.concat([tinyPng, Buffer.from("scene", "utf8")]),
  );
  const sourceDir = path.relative(projectRoot, fixtureRoot);
  const readyPreview = await runVisualLibraryControlledImportGuardPreview({
    sourceDir,
    confirmText: config.required_simulation_confirmation_text,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
  });
  assert.equal(
    readyPreview.controlled_import_guard_decision,
    "ready_for_phase_19a_confirmed_import",
  );
  assert.equal(readyPreview.controlled_import_items.length, 1);
  const readyItem = readyPreview.controlled_import_items[0];
  assert.equal(
    readyItem.guard_decision,
    "ready_for_phase_19a_confirmed_import",
  );
  assert.equal(readyItem.ui_guard_card.can_enter_phase_19a, true);
  for (const field of [
    "can_write_visual_index",
    "can_copy_visual_asset",
    "can_write_approval_queue",
    "can_create_approval_item",
    "can_create_canon_visual_lock",
    "can_confirm_real_import",
  ]) {
    assert.equal(readyItem.ui_guard_card[field], false);
  }

  const simulationBlocked = await runVisualLibraryControlledImportGuardPreview({
    sourceDir,
    preWriteConfirmText: config.required_pre_write_confirmation_text,
  });
  assert.equal(
    simulationBlocked.controlled_import_items[0].guard_decision,
    "blocked_by_simulation_confirmation_gate",
  );
  const preWriteBlocked = await runVisualLibraryControlledImportGuardPreview({
    sourceDir,
    confirmText: config.required_simulation_confirmation_text,
  });
  assert.equal(
    preWriteBlocked.controlled_import_items[0].guard_decision,
    "blocked_by_pre_write_confirmation_gate",
  );

  const acceptanceCase = readyPreview.controlled_import_items[0];
  const { config: simulationConfig } =
    await loadVisualLibraryImportSimulationConfig();
  const baseInput = {
    acceptance_case: {
      passed: true,
      actual_decision: "approval_queue_import_dry_run_ready",
      blocked_reasons: [],
      warnings: [],
      no_write_summary: safeNoWrite(),
      pipeline_results: {
        import_simulation: {
          category: acceptanceCase.proposed_visual_index_record.category,
          proposed_visual_index_record:
            acceptanceCase.proposed_visual_index_record,
        },
        pending_import_readiness: {
          readiness_decision: "ready_for_human_visual_import_review",
          proposed_visual_index_record:
            acceptanceCase.proposed_visual_index_record,
        },
        approval_queue_dry_run: {
          dry_run_decision: "approval_queue_import_dry_run_ready",
          lineage: {
            source_file: acceptanceCase.source_file,
            source_sha256: acceptanceCase.source_sha256,
            source_size_bytes: acceptanceCase.source_size_bytes,
            proposed_visual_id: acceptanceCase.proposed_visual_id,
            proposed_target_path: acceptanceCase.proposed_target_path,
          },
        },
      },
    },
    source_dir_absolute: fixtureRoot,
    visual_assets_root_absolute: visualAssetsRoot,
    simulation_config: simulationConfig,
    visual_index_empty: true,
    simulation_confirmation_accepted: true,
    pre_write_confirmation_accepted: true,
  };
  const cases = [
    ["final_acceptance_passed", false, "blocked_final_acceptance_not_passed"],
    ["source_exists", false, "blocked_missing_source_file"],
    ["source_hash_matches", false, "blocked_source_hash_mismatch"],
    ["target_path_safe", false, "blocked_unsafe_target_path"],
    ["visual_index_empty", false, "blocked_visual_index_not_empty"],
    ["target_not_occupied", false, "blocked_target_already_occupied"],
    ["category_valid", false, "blocked_requires_manual_category_review"],
    ["duplicate_resolved", false, "blocked_duplicate_requires_manual_review"],
    ["lineage_complete", false, "blocked_incomplete_lineage"],
    ["no_write_safety_passed", false, "blocked_no_write_safety_violation"],
  ];
  for (const [field, value, expected] of cases) {
    const item = await buildControlledImportPreflightManifestPreview({
      ...baseInput,
      [field]: value,
    });
    assert.equal(item.guard_decision, expected);
  }

  assert.equal(
    validateControlledImportNoWriteSafety({
      ...safeNoWrite(),
      creates_canon_visual_lock: true,
    }).valid,
    false,
  );
  assert.equal(
    evaluateControlledImportGuardDecision({
      simulation_confirmation_accepted: true,
      pre_write_confirmation_accepted: true,
      preconditions: {
        final_acceptance_passed: true,
        source_exists: true,
        source_hash_matches: true,
        target_path_safe: true,
        visual_index_empty: true,
        target_not_occupied: true,
        category_valid: true,
        duplicate_resolved: true,
        lineage_complete: true,
        no_write_safety_passed: true,
      },
    }),
    "ready_for_phase_19a_confirmed_import",
  );

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
  console.log("Visual library controlled import guard service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(emptyFixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
  assert.deepEqual(await directorySnapshot(approvalQueueRoot), approvalQueueBefore);
}
