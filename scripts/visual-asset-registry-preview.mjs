#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { buildVisualAssetRegistryPreview, compileVisualAssetRegistrySummary, loadVisualAssetRegistryConfig } from '../server/src/visual-asset-registry-preview-service.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { json: false, text: null, file: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') out.json = true;
    else if (a === '--text') out.text = args[++i] || '';
    else if (a === '--file') out.file = args[++i] || '';
    else if (a === '--help') {
      console.log('Usage: node scripts/visual-asset-registry-preview.mjs [--json] [--text "..."] [--file path]');
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const config = loadVisualAssetRegistryConfig();
  const options = { config };
  if (args.text) {
    options.source_text = args.text;
    options.source_type = 'manual';
    options.source_label = 'cli_text';
  } else if (args.file) {
    options.source_path = path.resolve(process.cwd(), args.file);
    options.source_type = 'manual_file';
    options.source_label = args.file;
  } else {
    options.source_type = 'visual_index';
  }

  const preview = await buildVisualAssetRegistryPreview(options);

  if (args.json) {
    // output pure JSON
    process.stdout.write(JSON.stringify(preview, null, 2));
    process.exit(preview.blocking_warnings && preview.blocking_warnings.length ? 1 : 0);
  }

  // human summary
  const summary = compileVisualAssetRegistrySummary(preview);
  console.log(summary);
  if (preview.visual_assets && preview.visual_assets.length) {
    console.log('Example assets:');
    for (const a of preview.visual_assets.slice(0, 10)) {
      console.log(`- ${a.asset_kind} | ${a.display_name} | ${a.file_path || '-'} | status:${a.status}`);
      if (a.linked_entity_candidates && a.linked_entity_candidates.length) {
        for (const l of a.linked_entity_candidates) console.log(`  -> candidate: ${l.entity_display_name || l.entity_id} (requires_human_confirmation:${l.requires_human_confirmation})`);
      }
    }
  }
  process.exit(preview.blocking_warnings && preview.blocking_warnings.length ? 1 : 0);
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(2);
});
