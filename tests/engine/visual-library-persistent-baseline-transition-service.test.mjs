import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
  loadVisualLibraryPersistentBaselineTransitionConfig,
  runVisualLibraryPersistentBaselineTransitionPreview,
  validateVisualLibraryPersistentBaselineTransitionConfig,
} from "../../server/src/visual-library-persistent-baseline-transition-service.mjs";
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
  `phase19h-a-${process.pid}-${Date.now()}`,
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
        const metadata = await stat(absolute);
        const content = await readFile(absolute);
        const hash = createHash("sha256").update(content).digest("hex");
        entries.push(`f:${relative}:${metadata.size}:${hash}`);
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

async function createSandboxConfig(baseConfig) {
  const index = path.join(fixtureRoot, "visual_index.jsonl");
  const assets = path.join(fixtureRoot, "assets");
  const intake = path.join(fixtureRoot, "intake");
  const engine = path.join(fixtureRoot, "active_engine.md");
  const compressed = path.join(fixtureRoot, "compressed_rules.md");
  const approval = path.join(fixtureRoot, "approval_queue");
  await mkdir(assets, { recursive: true });
  await mkdir(intake, { recursive: true });
  await mkdir(approval, { recursive: true });
  await writeFile(index, "");
  await writeFile(engine, formalBefore.engine);
  await writeFile(compressed, formalBefore.compressed);
  return {
    ...structuredClone(baseConfig),
    formal_visual_index_path: path.relative(projectRoot, index),
    formal_assets_root: path.relative(projectRoot, assets),
    formal_intake_root: path.relative(projectRoot, intake),
    active_engine_path: path.relative(projectRoot, engine),
    compressed_rules_path: path.relative(projectRoot, compressed),
    approval_queue_root: path.relative(projectRoot, approval),
  };
}

try {
  const { config } =
    await loadVisualLibraryPersistentBaselineTransitionConfig();
  assert.equal(
    validateVisualLibraryPersistentBaselineTransitionConfig(config),
    config,
  );
  assert.throws(
    () => validateVisualLibraryPersistentBaselineTransitionConfig({
      ...structuredClone(config),
      this_phase_updates_acceptance_baseline: true,
    }),
    /this_phase_updates_acceptance_baseline must be false/u,
  );

  const ready = await runVisualLibraryPersistentBaselineTransitionPreview();
  assert.equal(
    ready.transition_decision,
    "persistent_baseline_transition_tooling_ready",
  );
  assert.equal(ready.source_state.formal_visual_index_non_empty_lines, 0);
  assert.equal(ready.source_state.formal_assets_image_count, 0);
  assert.equal(ready.source_state.active_engine_hash_matches, true);
  assert.equal(ready.proposed_future_baseline.applied_in_this_phase, false);
  assert.equal(ready.next_phase_readiness.transition_tooling_ready, true);
  assert.equal(ready.next_phase_readiness.ready, false);
  assert.deepEqual(
    ready.next_phase_readiness.blocked_reasons,
    ["controlled_import_result_not_provided_or_not_usable"],
  );
  assert.equal(ready.required_confirmation_gates.length, 4);
  assert.deepEqual(
    ready.required_confirmation_gates.map((gate) => gate.required_text),
    [
      "確認模擬視覺匯入",
      "確認進入視覺正式匯入準備",
      "確認執行視覺正式匯入",
      "確認建立視覺圖庫非空正式基準",
    ],
  );
  assert.ok(ready.acceptance_update_plan.length >= 6);
  assert.ok(
    ready.acceptance_update_plan.some(
      (item) => item.target === "final_e2e_acceptance",
    ),
  );
  assert.ok(ready.rollback_plan.trigger_conditions.includes(
    "post_write_validation_failed",
  ));
  assert.ok(ready.rollback_plan.trigger_conditions.includes(
    "mcp_tools_count_changed",
  ));
  for (const action of [
    "execute",
    "import",
    "rollback",
    "delete",
    "restore",
    "write_visual_index",
    "copy_assets",
    "update_acceptance_baseline",
    "modify_active_engine",
    "modify_canon_db",
    "modify_compressed_rules",
    "write_approval_queue",
    "create_mcp_write_tool",
  ]) assert.ok(ready.forbidden_actions.includes(action));

  const sandboxConfig = await createSandboxConfig(config);
  const sandboxIndex = path.resolve(
    projectRoot,
    sandboxConfig.formal_visual_index_path,
  );
  const sandboxAssets = path.resolve(
    projectRoot,
    sandboxConfig.formal_assets_root,
  );
  await writeFile(sandboxIndex, `${JSON.stringify({ visual_id: "VTEST" })}\n`);
  const nonEmptyIndex =
    await runVisualLibraryPersistentBaselineTransitionPreview({
      config: sandboxConfig,
    });
  assert.equal(
    nonEmptyIndex.transition_decision,
    "blocked_formal_visual_index_not_empty",
  );

  await writeFile(sandboxIndex, "");
  await writeFile(path.join(sandboxAssets, "fixture.png"), Buffer.from("png"));
  const nonEmptyAssets =
    await runVisualLibraryPersistentBaselineTransitionPreview({
      config: sandboxConfig,
    });
  assert.equal(
    nonEmptyAssets.transition_decision,
    "blocked_formal_assets_not_empty",
  );

  await rm(path.join(sandboxAssets, "fixture.png"));
  const hashMismatch =
    await runVisualLibraryPersistentBaselineTransitionPreview({
      config: {
        ...sandboxConfig,
        expected_engine_sha256_lf: "A".repeat(64),
      },
    });
  assert.equal(
    hashMismatch.transition_decision,
    "blocked_active_engine_hash_mismatch",
  );
  const invalid = await runVisualLibraryPersistentBaselineTransitionPreview({
    config: { ...sandboxConfig, preview_only: false },
  });
  assert.equal(invalid.transition_decision, "blocked_config_invalid");

  const controlledImport =
    await runVisualLibraryPersistentBaselineTransitionPreview({
      config: sandboxConfig,
      controlledImportResult: {
        confirmed_import_decision: "confirmed_visual_import_completed",
        imported_items: [{ proposed_visual_id: "VTEST-001" }],
        rollback_manifest: { rollback_manifest_id: "TEST" },
      },
    });
  assert.equal(
    controlledImport.source_state.controlled_import_result
      .usable_for_future_activation,
    true,
  );
  assert.equal(controlledImport.next_phase_readiness.ready, true);

  const prettyCli = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-persistent-baseline-transition-preview.mjs",
      "--pretty",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(prettyCli.status, 0, prettyCli.stderr);
  assert.equal(
    JSON.parse(prettyCli.stdout).transition_decision,
    "persistent_baseline_transition_tooling_ready",
  );

  for (const argument of ["--execute", "--update-acceptance"]) {
    const dangerousCli = spawnSync(
      process.execPath,
      [
        "scripts/visual-library-persistent-baseline-transition-preview.mjs",
        argument,
        "--pretty",
      ],
      { cwd: projectRoot, encoding: "utf8", windowsHide: true },
    );
    assert.equal(dangerousCli.status, 0, dangerousCli.stderr);
    assert.equal(
      JSON.parse(dangerousCli.stdout).transition_decision,
      "blocked_forbidden_argument",
    );
  }

  const runAll = await readFile(
    path.join(projectRoot, "tests", "run-all.mjs"),
    "utf8",
  );
  assert.match(
    runAll,
    /visual-library-persistent-baseline-transition-service\.test\.mjs/u,
  );
  assert.equal(ready.safety_summary.no_write_operations_invoked, true);
  assert.equal(ready.safety_summary.acceptance_baseline_updated, false);
  assert.equal(ready.safety_summary.mcp_tool_count_changed, false);
  assert.deepEqual(await readFile(formalIndex), formalBefore.index);
  assert.deepEqual(await snapshot(formalAssets), formalBefore.assets);
  assert.deepEqual(await readFile(activeEngine), formalBefore.engine);
  assert.deepEqual(await readFile(compressedRules), formalBefore.compressed);
  assert.deepEqual(await snapshot(approvalQueue), formalBefore.approval);
  assert.deepEqual(await snapshot(canonDb), formalBefore.canon);
  console.log(
    "Visual library persistent baseline transition service test passed.",
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
