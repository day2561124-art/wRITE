import { createDevOperationJournalService } from "../server/src/mcp-development-journal-tools.mjs";

const [mode, ...extra] = process.argv.slice(2);

try {
  if (process.platform !== "win32" || extra.length || !["--inspect", "--apply"].includes(mode)) {
    throw new Error("Usage: node scripts/reconcile-trpg-supervisor-resume.mjs [--inspect|--apply]");
  }
  if (process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL === "1") throw new Error("TEST_JOURNAL_MODE_DISABLED");
  const result = await createDevOperationJournalService().reconcileTrpgResume({ apply: mode === "--apply" });
  console.log(JSON.stringify(result));
  if (mode === "--apply" && (result.status.health !== "healthy" || result.status.reconciliation_required)) process.exitCode = 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
