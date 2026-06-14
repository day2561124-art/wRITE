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
  buildProposedTargetPath,
  buildProposedVisualId,
  inferVisualCategoryCandidate,
  loadVisualLibraryRebuildIntakeConfig,
  scanVisualLibraryIntakePreview,
  validateVisualLibraryRebuildIntakeConfig,
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
  `.phase-18b-test-${process.pid}-${Date.now()}`,
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

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const visualIndexBefore = await readFile(visualIndexPath);
const activeEngineBefore = await readFile(activeEnginePath);
const assetsBefore = await directorySnapshot(visualAssetsRoot);

try {
  const loaded = await loadVisualLibraryRebuildIntakeConfig();
  const config = loaded.config;
  assert.equal(validateVisualLibraryRebuildIntakeConfig(config), config);
  assert.throws(
    () => validateVisualLibraryRebuildIntakeConfig({
      ...structuredClone(config),
      writes_visual_index: true,
    }),
    /writes_visual_index must be false/u,
  );
  assert.throws(
    () => validateVisualLibraryRebuildIntakeConfig({
      ...structuredClone(config),
      expected_engine_sha256_lf: "not-a-hash",
    }),
    /uppercase SHA-256/u,
  );
  assert.equal(config.phase, "18B");
  assert.equal(config.read_only, true);
  assert.equal(config.preview_only, true);
  for (const key of [
    "writes_visual_index",
    "writes_visual_assets",
    "copies_files",
    "moves_files",
    "deletes_files",
    "updates_active_engine",
    "updates_canon_db",
    "writes_approval_queue",
    "creates_approval_item",
    "creates_canon_visual_lock",
  ]) {
    assert.equal(config[key], false, `${key} must be false`);
  }
  assert.equal(
    sha256Lf(activeEngineBefore.toString("utf8")),
    config.expected_engine_sha256_lf,
  );

  const defaultPreview = await scanVisualLibraryIntakePreview();
  assert.equal(defaultPreview.source_dir, config.default_source_dir);
  assert.equal(defaultPreview.scanned_file_count, 3);
  assert.equal(defaultPreview.accepted_candidate_count, 3);
  assert.equal(defaultPreview.rejected_file_count, 0);
  assert.deepEqual(
    defaultPreview.candidates.map((item) => item.source_file).sort(),
    [
      "phase-19h-b-selected/asahina-chiya-character-sheet.png",
      "phase-19h-b-selected/jiu-tao-character-sheet.png",
      "phase-19h-b-selected/misaki-character-sheet.png",
    ],
  );

  await mkdir(fixtureRoot, { recursive: true });
  const categoryFixtures = [
    ["character-hero.png", "characters"],
    ["armed-weapon.jpg", "armed_forms"],
    ["ability-power.webp", "abilities"],
    ["expression-face.gif", "expressions"],
    ["outfit-costume.jpeg", "outfits"],
    ["scene-background.png", "scenes"],
    ["misc-reference.png", "unknown"],
  ];
  for (let index = 0; index < categoryFixtures.length; index += 1) {
    const [fileName] = categoryFixtures[index];
    await writeFile(
      path.join(fixtureRoot, fileName),
      Buffer.concat([tinyPng, Buffer.from(String(index), "utf8")]),
    );
  }
  await writeFile(path.join(fixtureRoot, "duplicate-a.png"), tinyPng);
  await writeFile(path.join(fixtureRoot, "duplicate-b.png"), tinyPng);
  await writeFile(path.join(fixtureRoot, "notes.txt"), "not an image");

  for (const [fileName, expectedCategory] of categoryFixtures) {
    assert.equal(
      inferVisualCategoryCandidate(fileName).category_candidate,
      expectedCategory,
    );
  }

  const preview = await scanVisualLibraryIntakePreview({
    sourceDir: path.relative(projectRoot, fixtureRoot),
  });
  assert.equal(preview.scanned_file_count, 10);
  assert.equal(preview.accepted_candidate_count, 9);
  assert.equal(preview.rejected_file_count, 1);
  assert.equal(preview.duplicate_group_count, 1);
  assert.equal(preview.rejected_files[0].rejection_reason, "unsupported_extension");
  assert.equal(preview.risk_level, "medium");

  for (const candidate of preview.candidates) {
    assert.match(candidate.intake_candidate_id, /^VIC-[A-F0-9]{16}$/u);
    assert.match(candidate.sha256, /^[A-F0-9]{64}$/u);
    assert.equal(candidate.size_bytes > 0, true);
    assert.equal(candidate.canon_status, "reference_candidate");
    assert.equal(candidate.trust_level, "T7");
    assert.equal(candidate.status, "preview_only");
    assert.equal(candidate.no_write_summary.writes_visual_index, false);
    assert.equal(candidate.no_write_summary.writes_visual_assets, false);
    assert.equal(candidate.no_write_summary.creates_canon_visual_lock, false);
    assert.equal(candidate.proposed_visual_id, buildProposedVisualId(candidate));
    assert.equal(candidate.proposed_target_path, buildProposedTargetPath(candidate));
  }

  const duplicateCandidates = preview.candidates.filter(
    (candidate) => candidate.duplicate_group_id,
  );
  assert.equal(duplicateCandidates.length, 2);
  assert.deepEqual(
    duplicateCandidates.map((candidate) => candidate.duplicate_status).sort(),
    ["duplicate_candidate", "primary_candidate"],
  );

  const unknown = preview.candidates.find(
    (candidate) => candidate.category_candidate === "unknown",
  );
  assert.ok(unknown);
  assert.equal(unknown.risk_summary.risk_level, "medium");
  assert.ok(unknown.warnings.includes("unknown_category_candidate"));

  assert.equal(preview.summary.phase, "18B");
  assert.equal(preview.summary.writes_visual_index, false);
  assert.equal(preview.summary.writes_visual_assets, false);
  assert.equal(preview.summary.updates_active_engine, false);
  assert.equal(preview.summary.updates_canon_db, false);
  assert.equal(preview.summary.creates_canon_visual_lock, false);

  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);

  console.log("Visual library rebuild intake service test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  assert.deepEqual(await readFile(visualIndexPath), visualIndexBefore);
  assert.deepEqual(await readFile(activeEnginePath), activeEngineBefore);
  assert.deepEqual(await directorySnapshot(visualAssetsRoot), assetsBefore);
}
