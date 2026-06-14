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
  loadVisualLibraryPersistentImportOperatorChecklistConfig,
  runVisualLibraryPersistentImportOperatorChecklist,
  validateVisualLibraryPersistentImportOperatorChecklistConfig,
} from "../../server/src/visual-library-persistent-import-operator-checklist-service.mjs";
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
  `phase19h-lite-${process.pid}-${Date.now()}`,
);

function sha256Lf(value) {
  return createHash("sha256")
    .update(String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n"))
    .digest("hex")
    .toUpperCase();
}

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
        entries.push(
          `f:${relative}:${metadata.size}:`
          + createHash("sha256").update(content).digest("hex"),
        );
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
    await loadVisualLibraryPersistentImportOperatorChecklistConfig();
  assert.equal(
    validateVisualLibraryPersistentImportOperatorChecklistConfig(config),
    config,
  );
  assert.throws(
    () => validateVisualLibraryPersistentImportOperatorChecklistConfig({
      ...structuredClone(config),
      writes_visual_index: true,
    }),
    /writes_visual_index must be false/u,
  );

  const ready = await runVisualLibraryPersistentImportOperatorChecklist();
  assert.equal(
    ready.checklist_decision,
    "persistent_import_operator_checklist_ready",
  );
  assert.equal(ready.source_state.formal_visual_index_non_empty_lines, 0);
  assert.equal(ready.source_state.formal_assets_image_count, 0);
  assert.equal(ready.source_state.active_engine_hash_matches, true);
  assert.equal(ready.required_operator_steps.length, 15);
  assert.equal(ready.required_confirmation_gates.length, 4);
  assert.deepEqual(
    ready.required_confirmation_gates.map((gate) => gate.required_text),
    [
      config.required_simulation_confirmation_text,
      config.required_pre_write_confirmation_text,
      config.required_real_import_confirmation_text,
      config.required_persistent_baseline_transition_confirmation_text,
    ],
  );
  for (const action of [
    "execute",
    "import",
    "rollback",
    "delete",
    "restore",
    "write_visual_index",
    "copy_assets",
    "write_approval_queue",
    "modify_canon_db",
    "modify_active_engine",
    "modify_compressed_rules",
    "change_mcp_tool_count",
    "create_mcp_write_tool",
  ]) assert.ok(ready.forbidden_actions.includes(action));
  assert.equal(ready.safety_summary.no_write_operations_invoked, true);
  assert.equal(ready.safety_summary.mcp_tool_count_changed, false);

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
    await runVisualLibraryPersistentImportOperatorChecklist({
      config: sandboxConfig,
    });
  assert.equal(
    nonEmptyIndex.checklist_decision,
    "blocked_formal_visual_index_not_empty",
  );

  await writeFile(sandboxIndex, "");
  await writeFile(path.join(sandboxAssets, "fixture.png"), Buffer.from("png"));
  const nonEmptyAssets =
    await runVisualLibraryPersistentImportOperatorChecklist({
      config: sandboxConfig,
    });
  assert.equal(
    nonEmptyAssets.checklist_decision,
    "blocked_formal_assets_not_empty",
  );

  await rm(path.join(sandboxAssets, "fixture.png"));
  const hashMismatch =
    await runVisualLibraryPersistentImportOperatorChecklist({
      config: {
        ...sandboxConfig,
        expected_engine_sha256_lf: "A".repeat(64),
      },
    });
  assert.equal(
    hashMismatch.checklist_decision,
    "blocked_active_engine_hash_mismatch",
  );
  const invalid = await runVisualLibraryPersistentImportOperatorChecklist({
    config: { ...sandboxConfig, this_phase_is_preview_only: false },
  });
  assert.equal(invalid.checklist_decision, "blocked_config_invalid");

  const prettyCli = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-persistent-import-operator-checklist-preview.mjs",
      "--pretty",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(prettyCli.status, 0, prettyCli.stderr);
  assert.equal(JSON.parse(prettyCli.stdout).phase, "19H-Lite");

  const dangerousCli = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-persistent-import-operator-checklist-preview.mjs",
      "--execute",
      "--json",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(dangerousCli.status, 0, dangerousCli.stderr);
  assert.equal(
    JSON.parse(dangerousCli.stdout).checklist_decision,
    "blocked_forbidden_argument",
  );
  const confirmationCli = spawnSync(
    process.execPath,
    [
      "scripts/visual-library-persistent-import-operator-checklist-preview.mjs",
      "--confirm-text",
      "forbidden",
      "--json",
    ],
    { cwd: projectRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(confirmationCli.status, 0, confirmationCli.stderr);
  assert.equal(
    JSON.parse(confirmationCli.stdout).checklist_decision,
    "blocked_forbidden_argument",
  );

  assert.equal(
    sha256Lf(formalBefore.engine.toString("utf8")),
    config.expected_engine_sha256_lf,
  );
  assert.deepEqual(await readFile(formalIndex), formalBefore.index);
  assert.deepEqual(await snapshot(formalAssets), formalBefore.assets);
  assert.deepEqual(await readFile(activeEngine), formalBefore.engine);
  assert.deepEqual(await readFile(compressedRules), formalBefore.compressed);
  assert.deepEqual(await snapshot(approvalQueue), formalBefore.approval);
  assert.deepEqual(await snapshot(canonDb), formalBefore.canon);
  console.log(
    "Visual library persistent import operator checklist service test passed.",
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
