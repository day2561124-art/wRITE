#!/usr/bin/env node
import { buildSettlementCompletionReminderPreview } from "../server/src/settlement-completion-reminder-service.mjs";
import { argv } from "node:process";

function usage() {
  console.log("Usage: node scripts/settlement-completion-reminders-preview.mjs [--json] [--text '...'] [--file path] [--source_type manual|adopted_chapter|settlement_report]");
}

async function main() {
  const args = argv.slice(2);
  let asJson = false;
  let text = null;
  let file = null;
  let source_type = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") asJson = true;
    else if (a === "--text") { text = args[i + 1]; i++; }
    else if (a === "--file") { file = args[i + 1]; i++; }
    else if (a === "--source_type") { source_type = args[i + 1]; i++; }
    else if (a === "--help" || a === "-h") { usage(); return; }
  }

  const options = {};
  if (text) options.source_text = text;
  if (file) options.source_path = file;
  if (source_type) options.source_type = source_type;

  const preview = await buildSettlementCompletionReminderPreview(options);
  if (preview.blocking_warnings && preview.blocking_warnings.length) {
    console.error(JSON.stringify(preview, null, 2));
    process.exit(1);
  }
  if (asJson) {
    console.log(JSON.stringify(preview));
    return;
  }

  // human summary
  console.log(`Settlement Completion Reminder Preview: reminders=${preview.reminder_count}`);
  for (const r of preview.reminders || []) {
    console.log(`- ${r.reminder_kind}: ${r.display_name} (${r.status}) lines ${r.source_line_start}-${r.source_line_end}`);
    if (r.naming_warnings && r.naming_warnings.length) console.log(`  naming_warnings: ${r.naming_warnings.join(", ")}`);
    if (r.missing_fields && r.missing_fields.length) console.log(`  missing: ${r.missing_fields.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(2);
});
