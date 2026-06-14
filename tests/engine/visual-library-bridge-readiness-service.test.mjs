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
import { spawnSync } from "node:child_process";
import {
  evaluateVisualLibraryBridgeReadinessDecision,
  loadVisualLibraryBridgeReadinessConfig,
  runVisualLibraryBridgeReadinessPreview,
  validateVisualLibraryBridgeNoWriteContract,
  validateVisualLibraryBridgeReadinessConfig,
} from "../../server/src/visual-library-bridge-readiness-service.mjs";
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
  `.phase-19d-test-${process.pid}-${Date.now()}`,
);
const sourceRoot = path.join(fixtureRoot, "source");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function snapshot(directory) {
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

const indexBefore = await readFile(formalIndex);
const engineBefore = await readFile(activeEngine);
const assetsBefore = await snapshot(formalAssets);
const approvalBefore = await snapshot(approvalQueue);

try {
  const { config } = await loadVisualLibraryBridgeReadinessConfig();
  assert.equal(validateVisualLibraryBridgeReadinessConfig(config), config);
  assert.throws(
    () => validateVisualLibraryBridgeReadinessConfig({
      ...structuredClone(config),
      bridge_allows_execute: true,
    }),
    /bridge_allows_execute must be false/u,
  );

  const empty = await runVisualLibraryBridgeReadinessPreview({
    sourceDir: path.relative(projectRoot, path.join(fixtureRoot, "missing")),
  });
  assert.equal(
    empty.bridge_readiness_decision,
    "empty_visual_library_bridge_readiness_preview_passed",
  );
  for (const field of [
    "ui_review_model",
    "bridge_tool_manifest_preview",
    "action_availability",
    "safety_envelope",
  ]) assert.ok(empty[field]);
  assert.equal(empty.bridge_tool_manifest_preview.read_only, true);
  assert.equal(empty.bridge_tool_manifest_preview.preview_only, true);
  assert.equal(empty.bridge_tool_manifest_preview.accepts_execute, false);
  assert.equal(empty.no_write_summary.invoked_ui_operation, "preview");
  assert.equal(empty.no_write_summary.execute_forwarded, false);

  const actions = empty.action_availability;
  for (const field of [
    "can_import",
    "can_rollback_import",
    "can_delete",
    "can_restore",
    "can_execute",
    "can_write_visual_index",
    "can_copy_visual_asset",
    "can_move_visual_asset",
    "can_delete_visual_asset",
    "can_write_approval_queue",
    "can_create_approval_item",
    "can_create_canon_visual_lock",
  ]) assert.equal(actions[field], false, `${field} must be false`);
  for (const operation of [
    "confirmed_visual_import_execute",
    "rollback_import_execute",
    "visual_delete_execute",
    "visual_restore_execute",
  ]) {
    assert.ok(
      empty.bridge_tool_manifest_preview.forbidden_operations.includes(operation),
    );
  }

  const cli = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-bridge-readiness-preview.mjs",
      "--execute",
      "--json",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(cli.status, 0, cli.stderr);
  const blocked = JSON.parse(cli.stdout);
  assert.equal(
    blocked.bridge_readiness_decision,
    "blocked_forbidden_execute_argument",
  );
  assert.equal(blocked.ui_review_model, null);
  assert.equal(blocked.no_write_summary.execute_forwarded, false);
  const prettyCli = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-bridge-readiness-preview.mjs",
      "--pretty",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(prettyCli.status, 0, prettyCli.stderr);
  assert.equal(
    JSON.parse(prettyCli.stdout).phase,
    "19D",
  );

  await mkdir(sourceRoot, { recursive: true });
  await writeFile(
    path.join(sourceRoot, "scene-background.png"),
    Buffer.concat([tinyPng, Buffer.from("phase19d")]),
  );
  const ready = await runVisualLibraryBridgeReadinessPreview({
    sourceDir: path.relative(projectRoot, sourceRoot),
  });
  assert.equal(
    ready.bridge_readiness_decision,
    "visual_library_bridge_preview_ready",
  );
  assert.equal(
    ready.ui_review_model.ui_flow_decision,
    "visual_library_ui_import_flow_preview_ready",
  );
  assert.equal(ready.ui_review_model.operation_result, null);

  const badContract = validateVisualLibraryBridgeNoWriteContract({
    ...config,
    writes_visual_index: true,
  });
  assert.equal(badContract.passed, false);
  assert.equal(evaluateVisualLibraryBridgeReadinessDecision({
    forbidden_execute_argument: false,
    active_engine_hash_passed: true,
    ui_review_model: {},
    no_write_contract_passed: false,
    action_availability: actions,
    formal_write_side_effect_detected: false,
    source_item_count: 1,
  }), "failed_no_write_contract_violation");
  assert.equal(evaluateVisualLibraryBridgeReadinessDecision({
    forbidden_execute_argument: false,
    active_engine_hash_passed: true,
    ui_review_model: {},
    no_write_contract_passed: true,
    action_availability: { ...actions, can_execute: true },
    formal_write_side_effect_detected: false,
    source_item_count: 1,
  }), "failed_forbidden_action_enabled");
  assert.equal(evaluateVisualLibraryBridgeReadinessDecision({
    forbidden_execute_argument: false,
    active_engine_hash_passed: true,
    ui_review_model: {},
    no_write_contract_passed: true,
    action_availability: { ...actions, can_write_approval_queue: true },
    formal_write_side_effect_detected: false,
    source_item_count: 1,
  }), "failed_forbidden_side_effect_capability");
  assert.equal(evaluateVisualLibraryBridgeReadinessDecision({
    forbidden_execute_argument: false,
    active_engine_hash_passed: true,
    ui_review_model: {},
    no_write_contract_passed: true,
    action_availability: actions,
    formal_write_side_effect_detected: true,
    source_item_count: 1,
  }), "failed_unexpected_formal_write_side_effect");

  const mismatch = await runVisualLibraryBridgeReadinessPreview({
    config: {
      ...config,
      expected_engine_sha256_lf: "A".repeat(64),
    },
  });
  assert.equal(
    mismatch.bridge_readiness_decision,
    "blocked_active_engine_hash_mismatch",
  );
  const unavailable = await runVisualLibraryBridgeReadinessPreview({
    uiImportFlowRunner: async () => null,
  });
  assert.equal(
    unavailable.bridge_readiness_decision,
    "blocked_ui_review_model_unavailable",
  );

  assert.deepEqual(await readFile(formalIndex), indexBefore);
  assert.deepEqual(await readFile(activeEngine), engineBefore);
  assert.deepEqual(await snapshot(formalAssets), assetsBefore);
  assert.deepEqual(await snapshot(approvalQueue), approvalBefore);
  console.log("Visual library bridge readiness service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(formalIndex), indexBefore);
  assert.deepEqual(await readFile(activeEngine), engineBefore);
  assert.deepEqual(await snapshot(formalAssets), assetsBefore);
  assert.deepEqual(await snapshot(approvalQueue), approvalBefore);
}
