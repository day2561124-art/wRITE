#!/usr/bin/env node
import { runVisualLibraryMcpReadonlyToolPreview, loadVisualLibraryMcpReadonlyToolConfig } from "../server/src/visual-library-mcp-readonly-tool-service.mjs";

function parseArgs(argv) {
  const out = { json: false, pretty: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--pretty") out.pretty = true;
    else if (a === "--execute") out.execute = true;
    else if (a === "--confirm-text") out.confirm_text = argv[i + 1] ?? "";
    else if (a === "--source-dir") { out.source_dir = argv[i + 1]; i++; }
    else if (a === "--output-mode") { out.output_mode = argv[i + 1]; i++; }
  }
  return out;
}

async function main() {
  const cfg = (await loadVisualLibraryMcpReadonlyToolConfig()).config;
  const argv = parseArgs(process.argv);
  const input = {};
  if (argv.source_dir) input.source_dir = argv.source_dir;
  if (argv.execute) input.execute = true;
  if (argv.confirm_text) input.confirm_text = argv.confirm_text;
  if (argv.output_mode) input.output_mode = argv.output_mode;
  const result = await runVisualLibraryMcpReadonlyToolPreview(input, { config: cfg });
  if (argv.json || argv.pretty) {
    console.log(argv.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result));
    return;
  }
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
