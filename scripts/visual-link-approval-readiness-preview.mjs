#!/usr/bin/env node
import fs from 'fs';
import { buildVisualLinkApprovalReadinessPreview, compileVisualLinkApprovalReadinessSummary } from '../server/src/visual-link-approval-readiness-service.mjs';

function parseArgs(argv){
  const ret = { json:false };
  for(let i=2;i<argv.length;i++){
    const a = argv[i];
    if(a === '--json') ret.json = true;
    else if(a === '--text') ret.text = argv[++i] || '';
    else if(a === '--source-path') ret['source-path'] = argv[++i] || null;
  }
  return ret;
}

async function main(){
  const argv = parseArgs(process.argv);
  const opts = {};
  if(argv.text) opts.source_text = argv.text;
  if(argv['source-path']) opts.source_path = argv['source-path'];
  const preview = await buildVisualLinkApprovalReadinessPreview(opts);
  if(argv.json) console.log(JSON.stringify(preview,null,2));
  else console.log(compileVisualLinkApprovalReadinessSummary(preview));
}

main().catch(e=>{ console.error(e&&e.stack?e.stack:e); process.exit(1); });
