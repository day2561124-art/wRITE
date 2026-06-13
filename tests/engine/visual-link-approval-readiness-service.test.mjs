import assert from 'node:assert/strict';
import fs from 'fs';
import { buildVisualLinkApprovalReadinessPreview, loadVisualLinkApprovalReadinessConfig } from '../../server/src/visual-link-approval-readiness-service.mjs';
import { buildVisualAssetRegistryPreview } from '../../server/src/visual-asset-registry-preview-service.mjs';
import crypto from 'node:crypto';

function sha256Lf(input){
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g,'\n'),'utf8').digest('hex').toUpperCase();
}

async function run(){
  try{
    const cfg = loadVisualLinkApprovalReadinessConfig();
    assert.strictEqual(cfg.mode,'read_only_approval_readiness_preview');
    assert.strictEqual(cfg.canon_write_allowed,false);
    assert.strictEqual(cfg.approval_queue_write_allowed,false);

    // engine hash check
    const engRaw = fs.readFileSync(cfg.source_engine_path,'utf8');
    assert.strictEqual(sha256Lf(engRaw), cfg.expected_engine_sha256_lf);

    // default preview (from visual_index via 17H)
    const defaultPreview = await buildVisualLinkApprovalReadinessPreview({});
    // readiness items may be zero if visual_index has no explicit assets
    assert.ok(defaultPreview.engine_hash_matches === true);

    // explicit text: character, weapon, location
    const text = 'character_visual: 朝日奈千夜 | file: images/chiyo.png\nweapon_visual: 未竟折門 | file: images/fold-gate.png\nlocation_visual: 白櫻市 | file: images/shirozakura.png\n';
    const preview = await buildVisualLinkApprovalReadinessPreview({ source_text: text, source_type: 'manual', source_label: 'test' });
    assert.ok(preview.readiness_count >= 3);

    const findByName = (name) => preview.readiness_items.find(i=>i.display_name && i.display_name.includes(name));
    const char = findByName('朝日奈千夜');
    const weap = findByName('未竟折門');
    const loc = findByName('白櫻市');
    assert.ok(char);
    assert.ok(weap);
    assert.ok(loc);

    


    // character should be ready
    if(char.decision !== 'ready_for_human_visual_link_review') throw new Error('character.decision mismatch: ' + String(char.decision));
    if(char.selected_entity_kind !== 'character') throw new Error('character.selected_entity_kind mismatch: ' + String(char.selected_entity_kind));
    if(char.selected_entity_id !== 'char_f4938233ad3b') throw new Error('character.selected_entity_id mismatch: ' + String(char.selected_entity_id));
    if(char.can_create_approval_item_now !== false) throw new Error('character.can_create_approval_item_now mismatch');
    if(char.canon_write_allowed !== false) throw new Error('character.canon_write_allowed mismatch');

    // weapon
    if(weap.decision !== 'ready_for_human_visual_link_review') throw new Error('weapon.decision mismatch: ' + String(weap.decision));
    if(weap.selected_entity_kind !== 'weapon') throw new Error('weapon.selected_entity_kind mismatch: ' + String(weap.selected_entity_kind));
    if(weap.selected_entity_id !== 'weapon_2217f6d71e9e') throw new Error('weapon.selected_entity_id mismatch: ' + String(weap.selected_entity_id));

    // location
    if(loc.decision !== 'ready_for_human_visual_link_review') throw new Error('location.decision mismatch: ' + String(loc.decision));
    if(loc.selected_entity_kind !== 'location') throw new Error('location.selected_entity_kind mismatch: ' + String(loc.selected_entity_kind));
    if(loc.selected_entity_id !== 'loc_7ab6b1a298dc') throw new Error('location.selected_entity_id mismatch: ' + String(loc.selected_entity_id));

    // canon_link_candidate status case
    const textCanonLink = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate\n';
    const previewCanon = await buildVisualLinkApprovalReadinessPreview({ source_text: textCanonLink });
    const citem = previewCanon.readiness_items[0];
    assert.ok(citem);
    if(citem.decision !== 'ready_for_human_visual_link_review') throw new Error('canon_link_candidate decision mismatch: ' + String(citem.decision));
    if(citem.creates_canon_visual_lock !== false) throw new Error('canon_link_candidate creates_canon_visual_lock mismatch');

    // canon_visual_lock should be blocked
    const textLock = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock\n';
    const previewLock = await buildVisualLinkApprovalReadinessPreview({ source_text: textLock });
    const lockItem = previewLock.readiness_items[0];
    assert.ok(lockItem);
    if(lockItem.decision !== 'blocked_forbidden_status') throw new Error('canon_visual_lock decision mismatch: ' + String(lockItem.decision));

    // ordinary sentence, file-only do not trigger
    const previewOrd = await buildVisualLinkApprovalReadinessPreview({ source_text: '這張圖看起來像朝日奈千夜。\n' });
    assert.strictEqual(previewOrd.readiness_count,0);
    const previewFile = await buildVisualLinkApprovalReadinessPreview({ source_text: 'file: images/chiyo.png\n' });
    assert.strictEqual(previewFile.readiness_count,0);

    // ensure no duplicates
    const dupText = ['character_visual: 朝日奈千夜 | file: images/chiyo.png','character_visual: 朝日奈千夜 | file: images/chiyo.png'].join('\n');
    const dupPreview = await buildVisualLinkApprovalReadinessPreview({ source_text: dupText });
    const ids = new Set();
    for(const it of dupPreview.readiness_items){
      if(ids.has(it.visual_asset_id)) throw new Error('duplicate readiness item for visual_asset_id');
      ids.add(it.visual_asset_id);
    }

    console.log('Visual link approval readiness service test passed.');
    process.exit(0);
  }catch(err){
    console.error('Visual link approval readiness service test failed.');
    console.error(err && err.stack?err.stack:err);
    process.exit(1);
  }
}

await run();
