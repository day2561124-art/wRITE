import assert from 'node:assert/strict';
import fs from 'fs';
import { loadVisualAssetRegistryConfig, validateVisualAssetRegistryConfig, buildVisualAssetRegistryPreview } from '../../server/src/visual-asset-registry-preview-service.mjs';
import crypto from 'node:crypto';

function sha256Lf(input) {
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g, '\n'), 'utf8').digest('hex').toUpperCase();
}

async function runTests() {
  try {
    // 1. config schema
    const cfg = loadVisualAssetRegistryConfig();
    assert.strictEqual(cfg.mode, 'read_only_preview');
    assert.strictEqual(cfg.canon_write_allowed, false);
    assert.strictEqual(cfg.approval_required_for_canon_change, true);
    assert.strictEqual(cfg.updates_canon_db, false);
    assert.strictEqual(cfg.updates_active_engine, false);
    assert.strictEqual(cfg.updates_visual_index, false);
    assert.strictEqual(cfg.creates_patch_candidate, false);
    assert.strictEqual(cfg.creates_formal_visual_card, false);
    assert.strictEqual(cfg.creates_canon_visual_lock, false);
    validateVisualAssetRegistryConfig(cfg);

    // 2. active_engine hash unchanged
    const engRaw = fs.readFileSync(cfg.source_engine_path, 'utf8');
    const h = sha256Lf(engRaw);
    assert.strictEqual(h, cfg.expected_engine_sha256_lf);

    // 3. visual_index readable
    const vi = fs.readFileSync(cfg.source_visual_index_path, 'utf8');
    const vih = sha256Lf(vi);
    assert.ok(vih);

    // 4. explicit markers produce assets and candidates
    const text = 'character_visual: 朝日奈千夜 | file: images/chiyo.png\nweapon_visual: 未竟折門 | file: images/fold-gate.png\nlocation_visual: 白櫻市 | file: images/shirozakura.png\n';
    const preview = await buildVisualAssetRegistryPreview({ source_text: text, source_type: 'manual', source_label: 'test' });
    assert.ok(preview.visual_asset_count >= 3);
    const findByName = (name) => preview.visual_assets.find(a => a.display_name && a.display_name.includes(name));
    const char = findByName('朝日奈千夜');
    const weap = findByName('未竟折門');
    const loc = findByName('白櫻市');
    assert.ok(char, 'character asset missing');
    assert.ok(weap, 'weapon asset missing');
    assert.ok(loc, 'location asset missing');

    for (const a of preview.visual_assets) {
      if (a.linked_entity_candidates && a.linked_entity_candidates.length) {
        for (const l of a.linked_entity_candidates) assert.strictEqual(l.requires_human_confirmation, true);
      }
    }

    // 5. linked candidates kinds and top-level sync
    const charLink = (char.linked_entity_candidates || [])[0];
    const weapLink = (weap.linked_entity_candidates || [])[0];
    const locLink = (loc.linked_entity_candidates || [])[0];
    assert.ok(charLink, 'character link candidate missing');
    assert.ok(weapLink, 'weapon link candidate missing');
    assert.ok(locLink, 'location link candidate missing');

    assert.strictEqual(charLink.entity_kind, 'character');
    assert.strictEqual(weapLink.entity_kind, 'weapon');
    assert.strictEqual(locLink.entity_kind, 'location');

    assert.strictEqual(char.matched_existing_entity_id, charLink.entity_id);
    assert.strictEqual(char.matched_existing_entity_kind, charLink.entity_kind);
    assert.strictEqual(char.canon_link_confidence, charLink.link_confidence);

    assert.ok(preview.link_counts_by_entity_kind.character >= 1);
    assert.ok(preview.link_counts_by_entity_kind.weapon >= 1);
    assert.ok(preview.link_counts_by_entity_kind.location >= 1);

    // 6. status canon_visual_lock rejected/converted
    const textLock = 'character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock\n';
    const previewLock = await buildVisualAssetRegistryPreview({ source_text: textLock, source_type: 'manual' });
    assert.ok(previewLock.visual_assets.length >= 1);
    for (const a of previewLock.visual_assets) {
      assert.notStrictEqual(a.status, 'canon_visual_lock');
      assert.strictEqual(a.creates_canon_visual_lock, false);
    }

    // 7. ordinary sentence does not trigger
    const textOrd = '這張圖看起來像朝日奈千夜。\nfile: images/chiyo.png\n';
    const previewOrd = await buildVisualAssetRegistryPreview({ source_text: textOrd, source_type: 'manual' });
    assert.strictEqual(previewOrd.visual_asset_count, 0);

    // 8. file path alone does not trigger
    const previewFileOnly = await buildVisualAssetRegistryPreview({ source_text: 'file: images/chiyo.png\n', source_type: 'manual' });
    assert.strictEqual(previewFileOnly.visual_asset_count, 0);

    // 9. duplicate assets merged and no duplicate link candidates
    const dupText = ['character_visual: 朝日奈千夜 | file: images/chiyo.png','character_visual: 朝日奈千夜 | file: images/chiyo.png'].join('\n');
    const previewDup = await buildVisualAssetRegistryPreview({ source_text: dupText, source_type: 'manual' });
    const ids = new Set();
    const dupAssets = [];
    for (const a of previewDup.visual_assets) {
      if (ids.has(a.visual_asset_id)) dupAssets.push(a.visual_asset_id);
      ids.add(a.visual_asset_id);
      const seen = new Set();
      for (const l of a.linked_entity_candidates || []) {
        const key = a.visual_asset_id + '|' + l.entity_id;
        if (seen.has(key)) throw new Error('duplicate visual link candidate: ' + key);
        seen.add(key);
      }
    }
    assert.deepStrictEqual(dupAssets, []);

    console.log('Visual asset registry preview service test passed.');
    process.exit(0);
  } catch (err) {
    console.error('Visual asset registry preview service test failed.');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

await runTests();
