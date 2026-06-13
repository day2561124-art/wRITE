import assert from 'node:assert/strict';
import fs from 'fs';
import crypto from 'node:crypto';
import { buildVisualLinkApprovalQueueCandidatePreview, loadVisualLinkApprovalQueueCandidateConfig } from '../../server/src/visual-link-approval-queue-candidate-service.mjs';

function sha256Lf(input){
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g,'\n'),'utf8').digest('hex').toUpperCase();
}

async function run(){
  try{
    const cfg = loadVisualLinkApprovalQueueCandidateConfig();
    assert.strictEqual(cfg.mode,'read_only_approval_queue_candidate_preview');
    assert.strictEqual(cfg.canon_write_allowed,false);
    assert.strictEqual(cfg.approval_queue_write_allowed,false);

    // engine hash check
    const engRaw = fs.readFileSync(cfg.source_engine_path,'utf8');
    assert.strictEqual(sha256Lf(engRaw), cfg.expected_engine_sha256_lf);

    // default preview
    const defaultPreview = await buildVisualLinkApprovalQueueCandidatePreview({});
    assert.ok(defaultPreview.engine_hash_matches === true);

    // when no readiness items, queue should be empty
    if((defaultPreview.queue_candidate_count||0) === 0){
      // allowed: no readiness items in visual_index
    }

    // explicit marker inputs
    const text = 'character_visual: 朝日奈千夜 | file: images/chiyo.png\nweapon_visual: 未竟折門 | file: images/fold-gate.png\nlocation_visual: 白櫻市 | file: images/shirozakura.png\n';
    const preview = await buildVisualLinkApprovalQueueCandidatePreview({ source_text: text, source_type: 'manual', source_label: 'test' });
    // should have at least 3 queue candidates (character/weapon/location)
    assert.ok(preview.queue_candidate_count >= 3);

    const findByName = (name) => preview.queue_candidates.find(i=>i.display_name && i.display_name.includes(name));
    const char = findByName('朝日奈千夜');
    const weap = findByName('未竟折門');
    const loc = findByName('白櫻市');
    assert.ok(char);
    assert.ok(weap);
    assert.ok(loc);

    // character checks
    if(char.queue_candidate_decision !== 'queue_candidate_preview_ready') throw new Error('char.queue_candidate_decision mismatch: ' + String(char.queue_candidate_decision));
    if(char.selected_entity_kind !== 'character') throw new Error('char.selected_entity_kind mismatch: ' + String(char.selected_entity_kind));
    if(char.selected_entity_id !== 'char_f4938233ad3b') throw new Error('char.selected_entity_id mismatch: ' + String(char.selected_entity_id));
    if(char.can_write_approval_queue_now !== false) throw new Error('char.can_write_approval_queue_now mismatch');
    if(char.creates_approval_item !== false) throw new Error('char.creates_approval_item mismatch');

    // weapon
    if(weap.queue_candidate_decision !== 'queue_candidate_preview_ready') throw new Error('weap.queue_candidate_decision mismatch: ' + String(weap.queue_candidate_decision));
    if(weap.selected_entity_kind !== 'weapon') throw new Error('weap.selected_entity_kind mismatch: ' + String(weap.selected_entity_kind));
    if(weap.selected_entity_id !== 'weapon_2217f6d71e9e') throw new Error('weap.selected_entity_id mismatch: ' + String(weap.selected_entity_id));

    // location
    if(loc.queue_candidate_decision !== 'queue_candidate_preview_ready') throw new Error('loc.queue_candidate_decision mismatch: ' + String(loc.queue_candidate_decision));
    if(loc.selected_entity_kind !== 'location') throw new Error('loc.selected_entity_kind mismatch: ' + String(loc.selected_entity_kind));
    if(loc.selected_entity_id !== 'loc_7ab6b1a298dc') throw new Error('loc.selected_entity_id mismatch: ' + String(loc.selected_entity_id));

    // canon_link_candidate status should be allowed as preview
    const textCanonLink = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate\n';
    const previewCanon = await buildVisualLinkApprovalQueueCandidatePreview({ source_text: textCanonLink });
    const citem = previewCanon.queue_candidates[0];
    assert.ok(citem);
    if(citem.queue_candidate_decision !== 'queue_candidate_preview_ready') throw new Error('canon_link_candidate decision mismatch: ' + String(citem.queue_candidate_decision));
    if(citem.creates_approval_item !== false) throw new Error('canon_link_candidate creates_approval_item mismatch');

    // canon_visual_lock should be blocked
    const textLock = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock\n';
    const previewLock = await buildVisualLinkApprovalQueueCandidatePreview({ source_text: textLock });
    const lockItem = previewLock.queue_candidates[0];
    assert.ok(lockItem);
    if(lockItem.queue_candidate_decision !== 'blocked_forbidden_status') throw new Error('canon_visual_lock decision mismatch: ' + String(lockItem.queue_candidate_decision));

    // ordinary sentence, file-only do not trigger
    const previewOrd = await buildVisualLinkApprovalQueueCandidatePreview({ source_text: '這張圖看起來像朝日奈千夜。\n' });
    assert.strictEqual(previewOrd.queue_candidate_count,0);
    const previewFile = await buildVisualLinkApprovalQueueCandidatePreview({ source_text: 'file: images/chiyo.png\n' });
    assert.strictEqual(previewFile.queue_candidate_count,0);

    // duplicates avoided
    const dupText = ['character_visual: 朝日奈千夜 | file: images/chiyo.png','character_visual: 朝日奈千夜 | file: images/chiyo.png'].join('\n');
    const dupPreview = await buildVisualLinkApprovalQueueCandidatePreview({ source_text: dupText });
    const ids = new Set();
    for(const it of dupPreview.queue_candidates){
      const key = `${it.visual_asset_id}|${it.selected_entity_id}`;
      if(ids.has(key)) throw new Error('duplicate queue candidate for visual_asset+entity');
      ids.add(key);
    }

    console.log('Visual link approval queue candidate service test passed.');
    process.exit(0);
  }catch(err){
    console.error('Visual link approval queue candidate service test failed.');
    console.error(err && err.stack?err.stack:err);
    process.exit(1);
  }
}

await run();
