import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  readFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import {
  evaluateVisualLibraryFinalE2eAcceptanceDecision,
  loadVisualLibraryFinalE2eAcceptanceConfig,
  runVisualLibraryFinalE2eAcceptancePreview,
  validateVisualLibraryFinalE2eAcceptanceConfig,
  validateVisualLibraryFinalForbiddenSideEffects,
  validateVisualLibraryFinalNoWriteContract,
} from "../../server/src/visual-library-final-e2e-acceptance-service.mjs";
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
const canonDb = path.join(projectRoot, "data", "canon_db");
const approvalQueue = path.join(projectRoot, "data", "approval_queue");

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

const before = {
  index: await readFile(formalIndex),
  assets: await snapshot(formalAssets),
  engine: await readFile(activeEngine),
  canon: await snapshot(canonDb),
  approval: await snapshot(approvalQueue),
};

function decisionInput(overrides = {}) {
  return {
    forbidden_execute_argument: false,
    formal_baseline_acceptance: {
      active_engine_hash_passed: true,
      visual_index_line_count: 3,
      visual_assets_image_count: 3,
      expected_visual_index_line_count: 3,
      expected_visual_assets_image_count: 3,
    },
    preview_chain_acceptance: { passed: true },
    sandbox_confirmed_import_acceptance: { passed: true },
    sandbox_rollback_delete_restore_acceptance: { passed: true },
    ui_flow_acceptance: { passed: true },
    bridge_readiness_acceptance: { passed: true },
    no_write_contract_passed: true,
    forbidden_side_effects_passed: true,
    formal_write_side_effect_detected: false,
    include_sandbox: false,
    ...overrides,
  };
}

try {
  const { config } = await loadVisualLibraryFinalE2eAcceptanceConfig();
  assert.equal(validateVisualLibraryFinalE2eAcceptanceConfig(config), config);
  assert.throws(
    () => validateVisualLibraryFinalE2eAcceptanceConfig({
      ...structuredClone(config),
      formal_execute_allowed: true,
    }),
    /formal_execute_allowed must be false/u,
  );

  const preview = await runVisualLibraryFinalE2eAcceptancePreview();
  assert.equal(
    preview.final_acceptance_decision,
    "visual_library_final_e2e_preview_acceptance_passed",
  );
  assert.equal(preview.formal_baseline_acceptance.passed, true);
  assert.equal(
    preview.formal_baseline_acceptance.formal_gallery_configured_baseline,
    true,
  );
  assert.equal(preview.preview_chain_acceptance.passed, true);
  assert.equal(preview.ui_flow_acceptance.passed, true);
  assert.equal(preview.bridge_readiness_acceptance.passed, true);
  assert.equal(preview.bridge_readiness_acceptance.actual_mcp_tool_count, 66);
  assert.equal(preview.acceptance_matrix.length, 11);
  for (const phase of [
    "18B",
    "18C",
    "18D",
    "18E",
    "18F",
    "18G",
    "19A",
    "19B",
    "19C",
    "19D",
  ]) {
    assert.ok(
      preview.acceptance_matrix.some((item) => item.phase_source === phase),
      `missing acceptance matrix phase ${phase}`,
    );
  }
  for (const field of [
    "formal_writes_visual_index",
    "formal_writes_visual_assets",
    "formal_copies_files",
    "formal_moves_files",
    "formal_deletes_files",
    "formal_writes_approval_queue",
    "formal_creates_approval_item",
    "formal_creates_canon_visual_lock",
    "formal_updates_active_engine",
    "formal_updates_canon_db",
  ]) assert.equal(preview.no_write_summary[field], false);

  const sandbox = await runVisualLibraryFinalE2eAcceptancePreview({
    includeSandbox: true,
  });
  assert.equal(
    sandbox.final_acceptance_decision,
    "visual_library_final_e2e_acceptance_passed",
  );
  assert.equal(sandbox.sandbox_confirmed_import_acceptance.passed, true);
  assert.equal(
    sandbox.sandbox_confirmed_import_acceptance.no_execute_decision,
    "blocked_missing_execute_flag",
  );
  assert.equal(
    sandbox.sandbox_rollback_delete_restore_acceptance.passed,
    true,
  );
  assert.deepEqual(
    sandbox.ui_flow_acceptance.sandbox_decisions,
    [
      "sandbox_ui_import_flow_import_completed",
      "sandbox_ui_import_flow_rollback_completed",
      "sandbox_ui_import_flow_delete_completed",
      "sandbox_ui_import_flow_restore_completed",
    ],
  );

  const cliPretty = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-final-e2e-acceptance-preview.mjs",
      "--pretty",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(cliPretty.status, 0, cliPretty.stderr);
  assert.equal(JSON.parse(cliPretty.stdout).phase, "19E");
  const cliBlocked = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-final-e2e-acceptance-preview.mjs",
      "--execute",
      "--json",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(cliBlocked.status, 0, cliBlocked.stderr);
  assert.equal(
    JSON.parse(cliBlocked.stdout).final_acceptance_decision,
    "blocked_forbidden_execute_argument",
  );

  assert.equal(
    validateVisualLibraryFinalNoWriteContract({
      ...config,
      writes_visual_index: true,
    }).passed,
    false,
  );
  assert.equal(
    validateVisualLibraryFinalForbiddenSideEffects({
      approval_queue_write_count: 1,
      approval_item_created: true,
      canon_visual_lock_count: 1,
      canon_db_changed: false,
    }).passed,
    false,
  );

  const decisions = [
    [
      { forbidden_execute_argument: true },
      "blocked_forbidden_execute_argument",
    ],
    [
      {
        formal_baseline_acceptance: {
          active_engine_hash_passed: false,
          visual_index_line_count: 3,
          visual_assets_image_count: 3,
          expected_visual_index_line_count: 3,
          expected_visual_assets_image_count: 3,
        },
      },
      "blocked_active_engine_hash_mismatch",
    ],
    [
      {
        formal_baseline_acceptance: {
          active_engine_hash_passed: true,
          visual_index_line_count: 2,
          visual_assets_image_count: 3,
          expected_visual_index_line_count: 3,
          expected_visual_assets_image_count: 3,
        },
      },
      "blocked_visual_index_baseline_mismatch",
    ],
    [
      {
        formal_baseline_acceptance: {
          active_engine_hash_passed: true,
          visual_index_line_count: 3,
          visual_assets_image_count: 2,
          expected_visual_index_line_count: 3,
          expected_visual_assets_image_count: 3,
        },
      },
      "blocked_visual_assets_baseline_mismatch",
    ],
    [
      { preview_chain_acceptance: { passed: false } },
      "failed_preview_chain_acceptance",
    ],
    [
      { sandbox_confirmed_import_acceptance: { passed: false } },
      "failed_sandbox_confirmed_import_acceptance",
    ],
    [
      { sandbox_rollback_delete_restore_acceptance: { passed: false } },
      "failed_sandbox_rollback_delete_restore_acceptance",
    ],
    [
      { ui_flow_acceptance: { passed: false } },
      "failed_ui_flow_acceptance",
    ],
    [
      { bridge_readiness_acceptance: { passed: false } },
      "failed_bridge_readiness_acceptance",
    ],
    [
      { no_write_contract_passed: false },
      "failed_no_write_contract_violation",
    ],
    [
      { forbidden_side_effects_passed: false },
      "failed_forbidden_side_effect_detected",
    ],
    [
      { formal_write_side_effect_detected: true },
      "failed_unexpected_formal_write_side_effect",
    ],
  ];
  for (const [overrides, expected] of decisions) {
    assert.equal(
      evaluateVisualLibraryFinalE2eAcceptanceDecision(
        decisionInput(overrides),
      ),
      expected,
    );
  }

  assert.deepEqual(await readFile(formalIndex), before.index);
  assert.deepEqual(await snapshot(formalAssets), before.assets);
  assert.deepEqual(await readFile(activeEngine), before.engine);
  assert.deepEqual(await snapshot(canonDb), before.canon);
  assert.deepEqual(await snapshot(approvalQueue), before.approval);
  console.log("Visual library final E2E acceptance service test passed.");
} finally {
  assert.deepEqual(await readFile(formalIndex), before.index);
  assert.deepEqual(await snapshot(formalAssets), before.assets);
  assert.deepEqual(await readFile(activeEngine), before.engine);
  assert.deepEqual(await snapshot(canonDb), before.canon);
  assert.deepEqual(await snapshot(approvalQueue), before.approval);
}
