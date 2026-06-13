import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  buildVisualLinkApprovalQueueImportGuardPreview,
  loadVisualLinkApprovalQueueImportGuardConfig,
  validateVisualLinkApprovalQueueImportGuardConfig
} from '../../server/src/visual-link-approval-queue-import-guard-service.mjs';

function sha256Lf(input) {
  return crypto
    .createHash('sha256')
    .update(String(input).replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex')
    .toUpperCase();
}

function clone(value) {
  return structuredClone(value);
}

async function run() {
  const config = loadVisualLinkApprovalQueueImportGuardConfig();
  assert.equal(validateVisualLinkApprovalQueueImportGuardConfig(config), true);
  assert.equal(config.mode, 'read_only_approval_queue_import_guard_preview');
  assert.equal(config.canon_write_allowed, false);
  assert.equal(config.approval_queue_write_allowed, false);
  assert.equal(config.visual_index_write_allowed, false);
  assert.equal(config.creates_ui_route, false);
  assert.equal(config.creates_server_route, false);

  const engineBefore = sha256Lf(fs.readFileSync(config.source_engine_path, 'utf8'));
  const visualIndexBefore = sha256Lf(fs.readFileSync(config.source_visual_index_path, 'utf8'));
  assert.equal(engineBefore, config.expected_engine_sha256_lf);

  const defaultPreview = await buildVisualLinkApprovalQueueImportGuardPreview();
  assert.equal(defaultPreview.engine_hash_matches, true);
  if (defaultPreview.guard_item_count === 0) {
    assert.equal(defaultPreview.summary_decision, 'blocked_no_import_dry_run_item');
    assert.deepEqual(defaultPreview.guard_items, []);
  }

  const text = [
    'character_visual: 朝日奈千夜 | file: images/chiyo.png',
    'weapon_visual: 未竟折門 | file: images/fold-gate.png',
    'location_visual: 白櫻市 | file: images/shirozakura.png'
  ].join('\n');
  const preview = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: text,
    source_type: 'manual',
    source_label: 'phase-17l-test'
  });
  assert.equal(preview.guard_item_count, 3);
  assert.equal(preview.summary_decision, 'ui_guard_ready');

  const byName = name => preview.guard_items.find(item => item.display_name === name);
  const character = byName('朝日奈千夜');
  const weapon = byName('未竟折門');
  const location = byName('白櫻市');
  assert.ok(character);
  assert.ok(weapon);
  assert.ok(location);

  assert.equal(character.guard_decision, 'ui_guard_ready');
  assert.equal(character.selected_entity_kind, 'character');
  assert.equal(character.selected_entity_id, 'char_f4938233ad3b');
  assert.equal(weapon.selected_entity_kind, 'weapon');
  assert.equal(weapon.selected_entity_id, 'weapon_2217f6d71e9e');
  assert.equal(location.selected_entity_kind, 'location');
  assert.equal(location.selected_entity_id, 'loc_7ab6b1a298dc');

  for (const item of preview.guard_items) {
    assert.match(item.guard_id, /^importguard_[A-F0-9]{12}$/);
    assert.equal(item.can_render_ui_card, true);
    assert.equal(item.can_import_now, false);
    assert.equal(item.can_write_approval_queue_now, false);
    assert.equal(item.writes_approval_queue, false);
    assert.equal(item.creates_approval_item, false);
    assert.equal(item.approval_queue_write_allowed, false);
    assert.equal(item.canon_write_allowed, false);
    assert.equal(item.creates_canon_visual_lock, false);
    assert.equal(item.creates_ui_route, false);
    assert.equal(item.creates_server_route, false);
    assert.equal(item.confirmation_guard.required, true);
    assert.equal(item.confirmation_guard.currently_confirmed, false);
    assert.equal(item.lineage.lineage_complete, true);
    assert.equal(item.ui_readiness_card.preview_only, true);
    assert.equal(item.ui_readiness_card.status_label, 'Ready for manual review preview');
    assert.deepEqual(item.disabled_actions, [
      'write_approval_queue',
      'create_approval_item',
      'create_canon_visual_lock',
      'update_active_engine',
      'update_visual_index'
    ]);
    assert.deepEqual(item.allowed_preview_actions, [
      'render_ui_readiness_card',
      'copy_payload_preview',
      'copy_lineage_summary'
    ]);
  }

  const repeated = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: text
  });
  assert.deepEqual(
    repeated.guard_items.map(item => item.guard_id),
    preview.guard_items.map(item => item.guard_id)
  );

  const canonCandidate = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate'
  });
  assert.equal(canonCandidate.guard_items[0].guard_decision, 'ui_guard_ready');
  assert.equal(canonCandidate.guard_items[0].creates_approval_item, false);

  const canonLock = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock'
  });
  assert.equal(canonLock.guard_items[0].guard_decision, 'blocked_forbidden_status');
  assert.equal(canonLock.guard_items[0].risk_summary.risk_level, 'high');
  assert.ok(canonLock.guard_items[0].risk_summary.blocking_risks.includes('forbidden_status'));
  assert.equal(canonLock.guard_items[0].writes_approval_queue, false);
  assert.equal(canonLock.guard_items[0].creates_approval_item, false);
  assert.equal(canonLock.guard_items[0].creates_canon_visual_lock, false);

  const ordinary = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: '這張圖看起來像朝日奈千夜。'
  });
  assert.equal(ordinary.guard_item_count, 0);
  const fileOnly = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: 'file: images/chiyo.png'
  });
  assert.equal(fileOnly.guard_item_count, 0);

  const duplicate = await buildVisualLinkApprovalQueueImportGuardPreview({
    source_text: [
      'character_visual: 朝日奈千夜 | file: images/chiyo.png',
      'character_visual: 朝日奈千夜 | file: images/chiyo.png'
    ].join('\n')
  });
  assert.equal(duplicate.guard_item_count, 1);

  const readySource = clone(character);
  readySource.import_dry_run_id = character.source_import_dry_run_id;
  readySource.import_dry_run_decision = 'import_dry_run_ready';
  const syntheticPreview = source => ({
    import_dry_run_items: [source],
    import_dry_run_count: 1
  });
  const decisionFor = async source => {
    const result = await buildVisualLinkApprovalQueueImportGuardPreview({
      importDryRunPreview: syntheticPreview(source)
    });
    return result.guard_items[0].guard_decision;
  };

  const missingPayload = clone(readySource);
  missingPayload.approval_queue_payload_preview = null;
  assert.equal(await decisionFor(missingPayload), 'blocked_missing_payload_preview');

  const missingEntity = clone(readySource);
  missingEntity.selected_entity_id = null;
  assert.equal(await decisionFor(missingEntity), 'blocked_missing_selected_entity');

  const missingLineage = clone(readySource);
  missingLineage.lineage.lineage_complete = false;
  assert.equal(await decisionFor(missingLineage), 'blocked_missing_lineage');

  const missingRisk = clone(readySource);
  missingRisk.risk_summary = null;
  assert.equal(await decisionFor(missingRisk), 'blocked_missing_risk_summary');

  const missingGuard = clone(readySource);
  missingGuard.confirmation_guard.required = false;
  assert.equal(await decisionFor(missingGuard), 'blocked_missing_confirmation_guard');

  const writeIntent = clone(readySource);
  writeIntent.writes_approval_queue = true;
  assert.equal(await decisionFor(writeIntent), 'blocked_forbidden_write_intent');

  const notReady = clone(readySource);
  notReady.import_dry_run_decision = 'blocked_queue_candidate_not_ready';
  assert.equal(await decisionFor(notReady), 'blocked_import_dry_run_not_ready');

  const cli = spawnSync(
    process.execPath,
    [
      'scripts/visual-link-approval-queue-import-guard-preview.mjs',
      '--text',
      'character_visual: 朝日奈千夜 | file: images/chiyo.png',
      '--json'
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  assert.equal(cli.status, 0, cli.stderr);
  const cliJson = JSON.parse(cli.stdout);
  assert.equal(cliJson.guard_items[0].guard_decision, 'ui_guard_ready');

  const summaryCli = spawnSync(
    process.execPath,
    [
      'scripts/visual-link-approval-queue-import-guard-preview.mjs',
      '--text',
      'weapon_visual: 未竟折門 | file: images/fold-gate.png'
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  assert.equal(summaryCli.status, 0, summaryCli.stderr);
  assert.match(summaryCli.stdout, /Summary decision: ui_guard_ready/);

  assert.equal(
    sha256Lf(fs.readFileSync(config.source_engine_path, 'utf8')),
    engineBefore
  );
  assert.equal(
    sha256Lf(fs.readFileSync(config.source_visual_index_path, 'utf8')),
    visualIndexBefore
  );

  console.log('Visual link approval queue import guard service test passed.');
}

run().catch(error => {
  console.error('Visual link approval queue import guard service test failed.');
  console.error(error?.stack || error);
  process.exitCode = 1;
});
