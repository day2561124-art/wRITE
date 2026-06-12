import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..", "..");
const expectedHash = "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB";
const scriptNames = [
  "safe-status.ps1",
  "daily-health-check.ps1",
  "pre-commit-check.ps1",
  "clean-runtime-backups.ps1",
  "show-active-engine-hash.ps1",
];
const docNames = [
  "DAILY-WORKFLOW.md",
  "SAFETY-CHECKLIST.md",
  "BACKUP-EXPORT-RESTORE.md",
  "TROUBLESHOOTING.md",
  "PHASE-MAP.md",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    return (await stat(path.join(rootDir, relativePath))).isFile();
  } catch {
    return false;
  }
}

async function main() {
  for (const name of scriptNames) {
    assert(await exists(`scripts/${name}`), `Missing scripts/${name}.`);
  }
  assert(await exists("scripts/README.md"), "Missing scripts/README.md.");
  for (const name of docNames) {
    assert(await exists(`docs/${name}`), `Missing docs/${name}.`);
  }

  const scripts = await Promise.all(scriptNames.map((name) => text(`scripts/${name}`)));
  const combinedScripts = scripts.join("\n");
  for (const forbidden of [
    /\bgit\s+add\b/iu,
    /\bgit\s+commit\b/iu,
    /confirmApprovalItem/iu,
    /activatePendingCandidate/iu,
    /requestRestoreFromBackup/iu,
  ]) {
    assert(!forbidden.test(combinedScripts), `Daily script contains forbidden operation: ${forbidden}`);
  }
  const tagCommands = combinedScripts
    .split(/\r?\n/u)
    .filter((line) => /&\s*git\s+tag\b/iu.test(line));
  assert(
    tagCommands.every((line) => line.includes("--list")),
    "Daily script contains a mutating git tag command.",
  );

  const cleanScript = await text("scripts/clean-runtime-backups.ps1");
  assert(cleanScript.includes("[switch]$ConfirmClean"), "Cleanup script has no ConfirmClean switch.");
  assert(cleanScript.includes("if (-not $ConfirmClean)"), "Cleanup script is not dry-run by default.");
  for (const allowed of ["project_backups", "exports", "restore_previews"]) {
    assert(cleanScript.includes(`"${allowed}"`), `Cleanup allowlist omitted ${allowed}.`);
  }
  for (const protectedPath of ["data\\canon_db", "data\\outputs", "data\\visual_db"]) {
    assert(
      !cleanScript.includes(`Join-Path $projectRoot "${protectedPath}"`),
      `Cleanup script targets protected path ${protectedPath}.`,
    );
  }

  const preCommit = await text("scripts/pre-commit-check.ps1");
  for (const guarded of [
    "data/backups/",
    "data/feedback_loop/",
    "data/visual_db/assets/",
    "data/outputs/",
    "data/canon_db/active_engine.md",
  ]) {
    assert(preCommit.includes(`"${guarded}"`), `Pre-commit guard omitted ${guarded}.`);
  }
  const hashScript = await text("scripts/show-active-engine-hash.ps1");
  assert(hashScript.includes(expectedHash), "Expected active engine SHA256 is missing.");

  const docs = await Promise.all(docNames.map((name) => text(`docs/${name}`)));
  const combinedDocs = docs.join("\n");
  assert(combinedDocs.includes("git add ."), "Docs do not warn about broad staging.");
  assert(combinedDocs.includes(expectedHash), "Docs omit the active engine SHA256 baseline.");
  assert(combinedDocs.includes("preview-only"), "Docs omit restore preview-only behavior.");
  assert(combinedDocs.includes("approval-only"), "Docs omit restore request approval-only behavior.");
  assert(combinedDocs.includes("Phase 10A"), "Phase map omits Phase 10A.");
  assert(combinedDocs.includes("Feedback Learning Loop"), "Phase 10A name is missing.");
  assert(combinedDocs.includes("Phase 10B"), "Phase map omits Phase 10B.");
  assert(combinedDocs.includes("不會套用"), "Phase 10A apply boundary is missing.");
  assert(combinedDocs.includes("Phase 11B"), "Phase map omits Phase 11B.");
  assert(combinedDocs.includes("尚未實作"), "Phase 11B is not marked unimplemented.");

  console.log("Daily scripts and docs test passed.");
}

main().catch((error) => {
  console.error(`Daily scripts and docs test failed: ${error.message}`);
  process.exitCode = 1;
});
