#!/usr/bin/env node
import { buildEntityIntakePreview, compileEntityIntakeSummary, loadEntityIntakeConfig } from "../server/src/entity-intake-service.mjs";
import { readFile } from "node:fs/promises";

async function main() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") opts.json = true;
    else if (a === "--text") opts.source_text = args[++i] || "";
    else if (a === "--file") opts.source_path = args[++i] || null;
    else if (a === "--source_type") opts.source_type = args[++i] || null;
    else if (a === "--source_label") opts.source_label = args[++i] || null;
  }

  const { config } = await loadEntityIntakeConfig();
  const preview = await buildEntityIntakePreview(opts);
  if (preview.blocking_warnings && preview.blocking_warnings.length > 0) {
    console.error("Blocking warnings:", preview.blocking_warnings);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }
  const summary = compileEntityIntakeSummary(preview);
  console.log("Source:", preview.source_path);
  console.log("Engine hash:", summary.engine_sha256_lf || preview.engine_sha256_lf);
  console.log(`Intakes: ${preview.intake_count}`);
  for (const it of (preview.intakes || [])) {
    console.log(`- ${it.intake_kind} ${it.intake_id} ${it.display_name} ${it.status} ${it.extraction_rule} ${it.source_path} [${it.source_line_start}-${it.source_line_end}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
