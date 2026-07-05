import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadVisualLibraryFinalE2eAcceptanceConfig,
  runVisualLibraryFinalE2eAcceptancePreview,
  runVisualLibraryFormalBaselineAcceptance,
  validateVisualLibraryFinalE2eAcceptanceConfig,
} from "../../server/src/visual-library-final-e2e-acceptance-service.mjs";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function sha256Lf(value) {
  return createHash("sha256")
    .update(Buffer.from(
      String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n"),
      "utf8",
    ))
    .digest("hex")
    .toUpperCase();
}

function indexLine(id, filename) {
  return JSON.stringify({
    visual_id: id,
    status: "imported",
    path: `data/visual_db/assets/characters/${filename}`,
  });
}

async function createBaselineFixture({ indexCount, assetCount }) {
  const root = await mkdtemp(path.join(tmpdir(), "phase39d-visual-parity-"));
  const assets = path.join(root, "assets");
  const index = path.join(root, "visual_index.jsonl");
  const engine = path.join(root, "active_engine.md");
  await mkdir(assets, { recursive: true });
  for (let i = 1; i <= assetCount; i += 1) {
    await writeFile(path.join(assets, `visual-${i}.png`), tinyPng);
  }
  const lines = [];
  for (let i = 1; i <= indexCount; i += 1) {
    lines.push(indexLine(`VIS-PHASE39D-${i}`, `visual-${i}.png`));
  }
  await writeFile(index, `${lines.join("\n")}\n`);
  const engineText = "phase39d active engine fixture\n";
  await writeFile(engine, engineText);
  return {
    root,
    assets,
    index,
    engine,
    expectedEngineHash: sha256Lf(engineText),
  };
}

async function runFixtureBaseline(options) {
  const fixture = await createBaselineFixture(options);
  try {
    return await runVisualLibraryFormalBaselineAcceptance({
      visual_index_path: fixture.index,
      visual_assets_root: fixture.assets,
      active_engine_path: fixture.engine,
      expected_engine_hash: fixture.expectedEngineHash,
      expected_visual_index_line_count: 999,
      expected_visual_assets_image_count: 999,
      formal_baseline_count_policy: "visual_index_asset_parity",
    });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

const { config } = await loadVisualLibraryFinalE2eAcceptanceConfig();
assert.equal(config.formal_baseline_count_policy, "visual_index_asset_parity");
assert.equal(validateVisualLibraryFinalE2eAcceptanceConfig(config), config);
assert.throws(
  () => validateVisualLibraryFinalE2eAcceptanceConfig({
    ...structuredClone(config),
    formal_baseline_count_policy: "unknown_policy",
  }),
  /formal_baseline_count_policy must be one of/u,
);

const parityAccepted = await runFixtureBaseline({ indexCount: 2, assetCount: 2 });
assert.equal(parityAccepted.passed, true);
assert.equal(parityAccepted.visual_index_line_count, 2);
assert.equal(parityAccepted.visual_assets_image_count, 2);
assert.equal(parityAccepted.expected_visual_index_line_count, 2);
assert.equal(parityAccepted.expected_visual_assets_image_count, 2);
assert.equal(
  parityAccepted.decision,
  "formal_visual_library_index_asset_parity_accepted",
);

const parityBlocked = await runFixtureBaseline({ indexCount: 2, assetCount: 3 });
assert.equal(parityBlocked.passed, false);
assert.equal(parityBlocked.visual_index_line_count, 2);
assert.equal(parityBlocked.visual_assets_image_count, 3);
assert.equal(parityBlocked.expected_visual_index_line_count, 2);
assert.equal(parityBlocked.expected_visual_assets_image_count, 2);
assert.equal(
  parityBlocked.decision,
  "blocked_visual_index_asset_parity_mismatch",
);

const preview = await runVisualLibraryFinalE2eAcceptancePreview();
assert.equal(preview.formal_baseline_acceptance.passed, true);
assert.equal(
  preview.formal_baseline_acceptance.decision,
  "formal_visual_library_index_asset_parity_accepted",
);
assert.equal(
  preview.acceptance_matrix.find((item) => item.phase_source === "18A")
    .actual_decision,
  "formal_visual_library_index_asset_parity_accepted",
);
assert.equal(
  preview.final_acceptance_decision,
  "visual_library_final_e2e_preview_acceptance_passed",
);

console.log("Phase39D visual upload formal baseline parity hardening tests passed.");
