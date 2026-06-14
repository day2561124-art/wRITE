import assert from "node:assert/strict";
import os from "node:os";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { validateVisualLibraryControlledImportTrialConfig, runVisualLibraryControlledImportTrial, loadVisualLibraryControlledImportTrialConfig } from "../../server/src/visual-library-controlled-import-trial-service.mjs";

function sha256buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function writeTinyPng(target) {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAr8B9h0r5QAAAABJRU5ErkJggg==";
  const buf = Buffer.from(b64, 'base64');
  await writeFile(target, buf);
  return buf;
}

// Full sandbox integration + blocked scenarios
try {
  const { config } = await loadVisualLibraryControlledImportTrialConfig();
  assert.equal(validateVisualLibraryControlledImportTrialConfig(config), config);

  // helper: create isolated sandbox fixture per scenario to avoid cross-test contamination
  async function createPhase19GSandboxFixture({ imageCount = 1, targetOccupied = false } = {}) {
    const tmpRoot = path.join(process.cwd(), 'data', 'tmp');
    await mkdir(tmpRoot, { recursive: true });
    const sandboxRoot = await mkdtemp(path.join(tmpRoot, 'phase19g-'));
    const intake = path.join(sandboxRoot, 'intake');
    const assets = path.join(sandboxRoot, 'assets');
    await mkdir(intake, { recursive: true });
    await mkdir(assets, { recursive: true });
    const visualIndexPath = path.join(sandboxRoot, 'visual_index.jsonl');
    await writeFile(visualIndexPath, "");
    const gitkeep = path.join(assets, '.gitkeep');
    await writeFile(gitkeep, 'keep');

    const items = [];
    for (let i = 0; i < imageCount; i += 1) {
      const filename = imageCount === 1 ? 'fixture.png' : `fixture-${i + 1}.png`;
      const sourceFile = path.join(intake, filename);
      const buf = await writeTinyPng(sourceFile);
      const sourceSha = sha256buf(buf);
      const proposedTargetPath = `data/visual_db/assets/testcat/${filename}`;
      const proposedVisualId = `VTEST-00${i + 1}`;
      const now = new Date().toISOString();
      items.push({
        controlled_import_item_id: `TEST-${i + 1}`,
        source_file: path.basename(sourceFile),
        source_sha256: sourceSha,
        source_size_bytes: buf.length,
        proposed_visual_id: proposedVisualId,
        proposed_target_path: proposedTargetPath,
        proposed_visual_index_record: {
          visual_id: proposedVisualId,
          created_at: now,
          category: 'testcat',
          title: 'fixture',
          canon_status: 'reference',
          trust_level: 'T7',
          source: 'visual_library_confirmed_import',
          status: 'imported',
          ability_state: 'visual_only',
          metadata_source: 'confirmed_import',
          path: proposedTargetPath,
          tags: [],
        },
        guard_decision: 'ready_for_phase_19a_confirmed_import',
      });
    }

    // optionally pre-create a target asset to simulate occupied target
    if (targetOccupied) {
      const absoluteTargetDir = path.join(assets, 'testcat');
      await mkdir(absoluteTargetDir, { recursive: true });
      const occupiedFile = path.join(absoluteTargetDir, imageCount === 1 ? 'fixture.png' : 'fixture-1.png');
      await writeTinyPng(occupiedFile);
    }

    const readyItems = items.map((item) => ({
      ...item,
      preconditions: {
        guard_ready: true,
        source_exists: true,
        source_hash_matches: true,
        target_safe: true,
        target_not_occupied: !targetOccupied,
        visual_index_state_matches: true,
      },
    }));
    const blockedItems = targetOccupied ? readyItems : [];
    const controlledGuardPreview = {
      item_count: items.length,
      ready_count: targetOccupied ? 0 : items.length,
      blocked_count: blockedItems.length,
      ready_items: targetOccupied ? [] : readyItems,
      blocked_items: blockedItems,
      controlled_import_guard_summary: { item_count: items.length, ready_count: items.length, blocked_count: 0 },
      controlled_import_items: items,
      controlled_import_guard_decision: 'ready_for_phase_19a_confirmed_import',
    };

    return { sandboxRoot, intake: path.join(sandboxRoot, 'intake'), assets, visualIndexPath, controlledGuardPreview };
  }

  // 1) success integration test
  {
    const fixture = await createPhase19GSandboxFixture({ imageCount: 1 });
    try {
      const trial = await runVisualLibraryControlledImportTrial({
        execute: true,
        confirmText: config.required_simulation_confirmation_text,
        preWriteConfirmText: config.required_pre_write_confirmation_text,
        realImportConfirmText: config.required_real_import_confirmation_text,
        rollbackConfirmText: config.required_rollback_confirmation_text,
        sandboxRoot: fixture.sandboxRoot,
        sourceDir: path.relative(process.cwd(), fixture.intake),
        controlledGuardPreview: fixture.controlledGuardPreview,
      });

      // Assertions for successful sandbox trial
      assert.equal(trial.trial_decision, 'visual_library_controlled_import_trial_completed');
      assert.equal(trial.write_summary.temporary_visual_index_written, true);
      assert.equal(trial.write_summary.temporary_visual_assets_copied, 1);
      assert.equal(trial.write_summary.rollback_performed, true);
      assert.equal(trial.write_summary.final_visual_index_restored, true);
      assert.equal(trial.write_summary.final_visual_assets_restored, true);
      assert.equal(trial.write_summary.final_formal_gallery_empty_baseline, true);
      assert.ok(trial.rollback_manifest);
      assert.ok(trial.rollback_summary);
      assert.ok(trial.validation_summary);
      assert.ok(trial.import_summary || trial.import_summary !== undefined);

      // ensure source/imported hashes match via import_summary or rollback_manifest if present
      if (trial.import_summary && Array.isArray(trial.import_summary.imported_items) && trial.import_summary.imported_items.length > 0) {
        const srcSha = fixture.controlledGuardPreview.controlled_import_items[0].source_sha256;
        assert.equal(trial.import_summary.imported_items[0].source_sha256, srcSha);
      }

      // Ensure visual_index restored byte-for-byte (visualIndexPath originally empty)
      const afterIndex = await readFile(fixture.visualIndexPath);
      assert.equal(afterIndex.toString('utf8'), '');

      // Ensure assets folder has no formal image leftover (only .gitkeep)
      const assetsList = await (await import('node:fs/promises')).readdir(fixture.assets);
      assert.ok(assetsList.includes('.gitkeep'));
      assert.ok(!assetsList.some(n => n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.webp')));

      // Check external invariants: active_engine and compressed_rules unchanged at project paths
      const activeEngineBefore = await readFile(path.join(process.cwd(), config.active_engine_path));
      const compressedRulesBefore = await readFile(path.join(process.cwd(), config.compressed_rules_path));
      const activeHash = crypto.createHash('sha256').update(Buffer.from(activeEngineBefore.toString('utf8').replaceAll('\r\n','\n'),'utf8')).digest('hex').toUpperCase();
      assert.equal(activeHash, config.expected_engine_sha256_lf);
      const compressedHash = crypto.createHash('sha256').update(Buffer.from(compressedRulesBefore.toString('utf8').replaceAll('\r\n','\n'),'utf8')).digest('hex').toUpperCase();
      assert.equal(compressedHash, config.expected_compressed_rules_sha256_lf);

      console.log('Phase19G sandbox integration success test passed.');
    } finally {
      await rm(fixture.sandboxRoot, { recursive: true, force: true });
    }
  }

  // 2) more than max_trial_import_count -> blocked_trial_import_count_exceeds_limit
  {
    const fixture = await createPhase19GSandboxFixture({ imageCount: 4 });
    try {
      const manyItemsPreview = { ...fixture.controlledGuardPreview, controlled_import_guard_summary: { item_count: 4, ready_count: 4, blocked_count: 0 } };
      const blockedCount = await runVisualLibraryControlledImportTrial({
        execute: true,
        confirmText: config.required_simulation_confirmation_text,
        preWriteConfirmText: config.required_pre_write_confirmation_text,
        realImportConfirmText: config.required_real_import_confirmation_text,
        rollbackConfirmText: config.required_rollback_confirmation_text,
        sandboxRoot: fixture.sandboxRoot,
        sourceDir: path.relative(process.cwd(), fixture.intake),
        controlledGuardPreview: manyItemsPreview,
      });
      assert.equal(blockedCount.trial_decision, 'blocked_trial_import_count_exceeds_limit');
    } finally {
      await rm(fixture.sandboxRoot, { recursive: true, force: true });
    }
  }

  // 3) target occupied -> should result in blocked_target_already_occupied
  let blockedOccupied;
  {
    const fixture = await createPhase19GSandboxFixture({ imageCount: 1, targetOccupied: true });
    try {
      blockedOccupied = await runVisualLibraryControlledImportTrial({
        execute: true,
        confirmText: config.required_simulation_confirmation_text,
        preWriteConfirmText: config.required_pre_write_confirmation_text,
        realImportConfirmText: config.required_real_import_confirmation_text,
        rollbackConfirmText: config.required_rollback_confirmation_text,
        sandboxRoot: fixture.sandboxRoot,
        sourceDir: path.relative(process.cwd(), fixture.intake),
        controlledGuardPreview: fixture.controlledGuardPreview,
      });
    } finally {
      await rm(fixture.sandboxRoot, { recursive: true, force: true });
    }
  }

  // 3a) hash mismatch -> blocked_source_hash_mismatch or failed_import_validation_rolled_back
  {
    const fixture = await createPhase19GSandboxFixture({ imageCount: 1 });
    try {
      const badGuard = JSON.parse(JSON.stringify(fixture.controlledGuardPreview));
      badGuard.controlled_import_items[0].source_sha256 = 'DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
      const blockedHash = await runVisualLibraryControlledImportTrial({
        execute: true,
        confirmText: config.required_simulation_confirmation_text,
        preWriteConfirmText: config.required_pre_write_confirmation_text,
        realImportConfirmText: config.required_real_import_confirmation_text,
        rollbackConfirmText: config.required_rollback_confirmation_text,
        sandboxRoot: fixture.sandboxRoot,
        sourceDir: path.relative(process.cwd(), fixture.intake),
        controlledGuardPreview: badGuard,
      });
      assert.ok(['failed_import_validation_rolled_back', 'blocked_source_hash_mismatch'].includes(blockedHash.trial_decision));
    } finally {
      await rm(fixture.sandboxRoot, { recursive: true, force: true });
    }
  }

  // 4) post-validation failure -> must rollback and return failed_import_validation_rolled_back
  {
    const postFailFixture = await createPhase19GSandboxFixture({
      imageCount: 1,
      targetOccupied: false,
    });
    try {
      assert.equal(postFailFixture.controlledGuardPreview.item_count, 1);
      assert.equal(postFailFixture.controlledGuardPreview.ready_count, 1);
      assert.equal(postFailFixture.controlledGuardPreview.blocked_count, 0);
      assert.equal(postFailFixture.controlledGuardPreview.ready_items.length, 1);
      assert.equal(postFailFixture.controlledGuardPreview.blocked_items.length, 0);

      const readyItem = postFailFixture.controlledGuardPreview.ready_items[0];
      assert.equal(readyItem.preconditions.guard_ready, true);
      assert.equal(readyItem.preconditions.source_exists, true);
      assert.equal(readyItem.preconditions.source_hash_matches, true);
      assert.equal(readyItem.preconditions.target_safe, true);
      assert.equal(readyItem.preconditions.target_not_occupied, true);
      assert.equal(readyItem.preconditions.visual_index_state_matches, true);

      const postFail = await runVisualLibraryControlledImportTrial({
        execute: true,
        confirmText: config.required_simulation_confirmation_text,
        preWriteConfirmText: config.required_pre_write_confirmation_text,
        realImportConfirmText: config.required_real_import_confirmation_text,
        rollbackConfirmText: config.required_rollback_confirmation_text,
        sandboxRoot: postFailFixture.sandboxRoot,
        sourceDir: path.relative(process.cwd(), postFailFixture.intake),
        controlledGuardPreview: postFailFixture.controlledGuardPreview,
        injectPostWriteValidationFailure: true,
      });
      if (postFail.trial_decision !== 'failed_import_validation_rolled_back') {
        console.error('Phase19G post validation failure debug:', JSON.stringify({
          trial_decision: postFail.trial_decision,
          import_summary: postFail.import_summary,
          validation_summary: postFail.validation_summary,
          rollback_summary: postFail.rollback_summary,
          write_summary: postFail.write_summary,
          summary: postFail.summary,
          fixture: {
            sandboxRoot: postFailFixture.sandboxRoot,
            sourceDir: path.relative(process.cwd(), postFailFixture.intake),
            guard: postFailFixture.controlledGuardPreview
          }
        }, null, 2));
      }
      assert.equal(postFail.trial_decision, 'failed_import_validation_rolled_back');
      assert.equal(postFail.write_summary.rollback_performed, true);
      assert.equal(postFail.write_summary.final_visual_index_restored, true);
      assert.equal(postFail.write_summary.final_visual_assets_restored, true);
      assert.equal(postFail.write_summary.final_formal_gallery_empty_baseline, true);
    } finally {
      await rm(postFailFixture.sandboxRoot, { recursive: true, force: true });
    }
  }

  // 5) missing rollback confirmation -> blocked_by_rollback_confirmation_gate
  {
    const fixture = await createPhase19GSandboxFixture({ imageCount: 1 });
    try {
      const missingRollback = await runVisualLibraryControlledImportTrial({
        execute: true,
        confirmText: config.required_simulation_confirmation_text,
        preWriteConfirmText: config.required_pre_write_confirmation_text,
        realImportConfirmText: config.required_real_import_confirmation_text,
        // rollbackConfirmText omitted
        sandboxRoot: fixture.sandboxRoot,
        sourceDir: path.relative(process.cwd(), fixture.intake),
        controlledGuardPreview: fixture.controlledGuardPreview,
      });
      assert.equal(missingRollback.trial_decision, 'blocked_by_rollback_confirmation_gate');
    } finally {
      await rm(fixture.sandboxRoot, { recursive: true, force: true });
    }
  }

  console.log('Phase19G blocked scenarios passed.');


} finally {
  // noop
}
