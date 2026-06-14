import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  buildVisualImportOperationPreview,
  evaluateVisualImportConfirmationGate,
  loadVisualLibraryImportSimulationConfig,
  runVisualLibraryImportSimulationPreview,
  validateVisualImportTargetPath,
  validateVisualLibraryImportSimulationConfig,
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
const fixtureRoot = path.join(
  projectRoot,
  "data",
  "visual_db",
  `.phase-18c-test-${process.pid}-${Date.now()}`,
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
      entries.push(`${child.isDirectory() ? "d" : "f"}:${relative}`);
      if (child.isDirectory()) await walk(absolute);
    }
  }
  await walk(directory);
  return entries;
}

const visualIndexBefore = await readFile(visualIndexPath);
const activeEngineBefore = await readFile(activeEnginePath);
const assetsBefore = await directorySnapshot(visualAssetsRoot);

try {
  const { config } = await loadVisualLibraryImportSimulationConfig();
  assert.equal(validateVisualLibraryImportSimulationConfig(config), config);
  assert.equal(config.required_confirmation_text, "確認模擬視覺匯入");
  assert.throws(
    () => validateVisualLibraryImportSimulationConfig({
      ...structuredClone(config),
      copies_files: true,
    }),
    /copies_files must be false/u,
  );
  assert.equal(
    sha256Lf(activeEngineBefore.toString("utf8")),
    config.expected_engine_sha256_lf,
  );

  const defaultPreview = await runVisualLibraryImportSimulationPreview();
  assert.equal(
    defaultPreview.import_plan_summary.decision,
    "empty_import_simulation",
  );
  assert.equal(defaultPreview.import_plan_summary.operation_count, 0);
  assert.equal(defaultPreview.import_plan_summary.blocked_operation_count, 0);
  assert.deepEqual(defaultPreview.operations, []);
  assert.equal(defaultPreview.confirmation_gate.accepted, false);
  assert.equal(
    evaluateVisualImportConfirmationGate(config, "確認視覺匯入").decision,
    "locked_by_confirmation_gate",
  );

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
  const lockedPreview = await runVisualLibraryImportSimulationPreview({
    sourceDir,
  });
  const lockedScene = lockedPreview.operations.find(
    (operation) => operation.source_file === "scene-background.png",
  );
  assert.equal(lockedScene.import_decision, "blocked_by_confirmation_gate");
  assert.equal(lockedScene.copy_source_file_preview, false);

  const confirmedPreview = await runVisualLibraryImportSimulationPreview({
    sourceDir,
    confirmText: config.required_confirmation_text,
  });
  assert.equal(confirmedPreview.confirmation_gate.accepted, true);
  assert.equal(
    confirmedPreview.confirmation_gate.decision,
    "simulated_confirmation_accepted",
  );
  const confirmedScene = confirmedPreview.operations.find(
    (operation) => operation.source_file === "scene-background.png",
  );
  assert.equal(confirmedScene.import_decision, "simulated_import_ready");
  assert.equal(confirmedScene.copy_source_file_preview, true);
  assert.equal(confirmedScene.proposed_visual_index_record.created_at, null);
  assert.equal(
    confirmedScene.proposed_visual_index_record.status,
    "simulated_only",
  );

  const unknown = confirmedPreview.operations.find(
    (operation) => operation.source_file === "misc-reference.png",
  );
  assert.equal(
    unknown.import_decision,
    "blocked_requires_manual_category_review",
  );
  assert.ok(unknown.warnings.includes("requires_manual_category_review"));

  const duplicate = confirmedPreview.operations.find(
    (operation) => operation.duplicate_status === "duplicate_candidate",
  );
  assert.equal(
    duplicate.import_decision,
    "blocked_duplicate_requires_manual_review",
  );
  const primary = confirmedPreview.operations.find(
    (operation) => operation.duplicate_status === "primary_candidate",
  );
  assert.equal(primary.import_decision, "simulated_import_ready");

  const unsupported = confirmedPreview.operations.find(
    (operation) => operation.source_file === "notes.txt",
  );
  assert.equal(unsupported.import_decision, "rejected_unsupported_extension");

  const intakePreview = await scanVisualLibraryIntakePreview({ sourceDir });
  const safeCandidate = intakePreview.candidates.find(
    (candidate) => candidate.source_file === "scene-background.png",
  );
  assert.equal(validateVisualImportTargetPath(safeCandidate, config).valid, true);

  const unsafeCandidate = {
    ...safeCandidate,
    proposed_target_path: "../outside.png",
  };
  assert.equal(validateVisualImportTargetPath(unsafeCandidate, config).valid, false);
  const acceptedGate = evaluateVisualImportConfirmationGate(
    config,
    config.required_confirmation_text,
  );
  const unsafeOperation = await buildVisualImportOperationPreview({
    candidate: unsafeCandidate,
    config,
    confirmationGate: acceptedGate,
    sourceRoot: fixtureRoot,
  });
  assert.equal(unsafeOperation.import_decision, "blocked_unsafe_target_path");

  const missingOperation = await buildVisualImportOperationPreview({
    candidate: {
      ...safeCandidate,
      source_file: "scene-missing.png",
    },
    config,
    confirmationGate: acceptedGate,
    sourceRoot: fixtureRoot,
  });
  assert.equal(missingOperation.import_decision, "blocked_missing_source_file");

  for (const operation of confirmedPreview.operations) {
    assert.equal(operation.no_write_summary.writes_visual_index, false);
    assert.equal(operation.no_write_summary.writes_visual_assets, false);
    assert.equal(operation.no_write_summary.copies_files, false);
    assert.equal(operation.no_write_summary.moves_files, false);
    assert.equal(operation.no_write_summary.deletes_files, false);
    assert.equal(operation.no_write_summary.updates_active_engine, false);
    assert.equal(operation.no_write_summary.updates_canon_db, false);
    assert.equal(operation.no_write_summary.writes_approval_queue, false);
    assert.equal(operation.no_write_summary.creates_approval_item, false);
    assert.equal(operation.no_write_summary.creates_canon_visual_lock, false);
  }

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);

  console.log("Visual library import simulation service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
}
