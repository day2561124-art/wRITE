import assert from 'node:assert/strict';
import fs from 'fs';
import crypto from 'node:crypto';
import { buildVisualLinkApprovalQueueImportDryRunPreview, loadVisualLinkApprovalQueueImportDryRunConfig } from '../../server/src/visual-link-approval-queue-import-dry-run-service.mjs';

function sha256Lf(input){
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g,'\n'),'utf8').digest('hex').toUpperCase();
}

async function run(){
  try{
    const cfg = loadVisualLinkApprovalQueueImportDryRunConfig();
    assert.strictEqual(cfg.mode,'read_only_approval_queue_import_dry_run');
    assert.strictEqual(cfg.canon_write_allowed,false);
    assert.strictEqual(cfg.approval_queue_write_allowed,false);

    // engine hash check
    const engRaw = fs.readFileSync(cfg.source_engine_path,'utf8');
    assert.strictEqual(sha256Lf(engRaw), cfg.expected_engine_sha256_lf);

    // default preview
    const defaultPreview = await buildVisualLinkApprovalQueueImportDryRunPreview({});
    assert.ok(defaultPreview.engine_hash_matches === true);
    if((defaultPreview.import_dry_run_count||0) === 0){
      // allowed when no queue candidates exist in visual_index
    }

    // explicit markers
    const text = 'character_visual: 朝日奈千夜 | file: images/chiyo.png\nweapon_visual: 未竟折門 | file: images/fold-gate.png\nlocation_visual: 白櫻市 | file: images/shirozakura.png\n';
    const preview = await buildVisualLinkApprovalQueueImportDryRunPreview({ source_text: text, source_type: 'manual', source_label: 'test' });
    assert.ok(preview.import_dry_run_count >= 3);

    const findByName = (name) => preview.import_dry_run_items.find(i=>i.display_name && i.display_name.includes(name));
    const char = findByName('朝日奈千夜');
    const weap = findByName('未竟折門');
    const loc = findByName('白櫻市');
    assert.ok(char);
    assert.ok(weap);
    assert.ok(loc);

    if(char.import_dry_run_decision !== 'import_dry_run_ready') throw new Error('char.import_dry_run_decision mismatch: ' + String(char.import_dry_run_decision));
    if(char.selected_entity_kind !== 'character') throw new Error('char.selected_entity_kind mismatch');
    if(char.selected_entity_id !== 'char_f4938233ad3b') throw new Error('char.selected_entity_id mismatch');
    if(char.can_import_now !== false) throw new Error('char.can_import_now mismatch');
    if(char.can_write_approval_queue_now !== false) throw new Error('char.can_write_approval_queue_now mismatch');
    if(char.writes_approval_queue !== false) throw new Error('char.writes_approval_queue mismatch');

    // confirmation guard
    if(!char.confirmation_guard || char.confirmation_guard.required !== true) throw new Error('char.confirmation_guard missing or incorrect');
    if(char.confirmation_guard.currently_confirmed !== false) throw new Error('char.confirmation_guard currently_confirmed must be false');

    // lineage
    if(!char.lineage || char.lineage.lineage_complete !== true) throw new Error('char.lineage incomplete');

    // canon_link_candidate allowed as dry-run
    const textCanonLink = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate\n';
    const previewCanon = await buildVisualLinkApprovalQueueImportDryRunPreview({ source_text: textCanonLink });
    const citem = previewCanon.import_dry_run_items[0];
    assert.ok(citem);
    if(citem.import_dry_run_decision !== 'import_dry_run_ready') throw new Error('canon_link_candidate import decision mismatch');
    if(citem.writes_approval_queue !== false) throw new Error('canon_link_candidate writes_approval_queue must be false');

    // canon_visual_lock blocked
    const textLock = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock\n';
    const previewLock = await buildVisualLinkApprovalQueueImportDryRunPreview({ source_text: textLock });
    const lockItem = previewLock.import_dry_run_items[0];
    assert.ok(lockItem);
    if(lockItem.import_dry_run_decision !== 'blocked_forbidden_status') throw new Error('canon_visual_lock import decision mismatch');
    if(lockItem.risk_summary.risk_level !== 'high') throw new Error('canon_visual_lock risk_level mismatch');
    if(!(lockItem.risk_summary.blocking_risks && lockItem.risk_summary.blocking_risks.includes('forbidden_status'))) throw new Error('canon_visual_lock blocking_risks missing forbidden_status');
    if(lockItem.creates_approval_item !== false) throw new Error('canon_visual_lock creates_approval_item must be false');
    if(lockItem.writes_approval_queue !== false) throw new Error('canon_visual_lock writes_approval_queue must be false');
    if(lockItem.creates_canon_visual_lock !== false) throw new Error('canon_visual_lock creates_canon_visual_lock must be false');

    // ordinary sentence/file-only not trigger
    const previewOrd = await buildVisualLinkApprovalQueueImportDryRunPreview({ source_text: '這張圖看起來像朝日奈千夜。\n' });
    assert.strictEqual(previewOrd.import_dry_run_count,0);
    const previewFile = await buildVisualLinkApprovalQueueImportDryRunPreview({ source_text: 'file: images/chiyo.png\n' });
    assert.strictEqual(previewFile.import_dry_run_count,0);

    // duplicates avoided
    const dupText = ['character_visual: 朝日奈千夜 | file: images/chiyo.png','character_visual: 朝日奈千夜 | file: images/chiyo.png'].join('\n');
    const dupPreview = await buildVisualLinkApprovalQueueImportDryRunPreview({ source_text: dupText });
    const ids = new Set();
    for(const it of dupPreview.import_dry_run_items){
      const key = `${it.visual_asset_id}|${it.selected_entity_id}`;
      if(ids.has(key)) throw new Error('duplicate import dry-run item for visual_asset+entity');
      ids.add(key);
    }

    console.log('Visual link approval queue import dry-run service test passed.');
    process.exit(0);
  }catch(err){
    console.error('Visual link approval queue import dry-run service test failed.');
    console.error(err && err.stack?err.stack:err);
    process.exit(1);
  }
}

await run();
