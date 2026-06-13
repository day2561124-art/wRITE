#!/usr/bin/env node
import {
  buildVisualLinkApprovalQueueImportGuardPreview,
  compileVisualLinkApprovalQueueImportGuardSummary
} from '../server/src/visual-link-approval-queue-import-guard-service.mjs';

function parseArgs(argv) {
  const parsed = { json: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--text') parsed.text = argv[++index] || '';
    else if (arg === '--source-path') parsed.sourcePath = argv[++index] || null;
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv);
  const options = {};
  if (args.text) options.source_text = args.text;
  if (args.sourcePath) options.source_path = args.sourcePath;

  const preview = await buildVisualLinkApprovalQueueImportGuardPreview(options);
  console.log(
    args.json
      ? JSON.stringify(preview, null, 2)
      : compileVisualLinkApprovalQueueImportGuardSummary(preview)
  );
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
