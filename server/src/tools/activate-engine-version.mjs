import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const engineVersionsDir = path.join(rootDir, "data", "canon_db", "versions");
const backupDir = path.join(rootDir, "data", "outputs", "logs", "engine_activation_backups");
const activationLogPath = path.join(rootDir, "data", "outputs", "logs", "engine_activations.jsonl");

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/activate-engine-version.mjs (--version vX.Y.Z | --candidate <path>) [options]",
    "",
    "Options:",
    "  --active <path>                 Default: data/canon_db/active_engine.md",
    "  --required-current-sha <sha>    Abort unless current active_engine.md has this SHA-256",
    "  --reason <text>                 Human-readable reason for the activation log",
    "  --dry-run                       Print the activation plan without writing",
    "  --confirm ACTIVATE              Required for a real activation write",
    "",
    "Examples:",
    "  node server/src/tools/activate-engine-version.mjs --version v5.0.12 --dry-run",
    "  node server/src/tools/activate-engine-version.mjs --candidate data/canon_db/versions/engine_v5.0.13.md --required-current-sha <sha> --confirm ACTIVATE",
    "",
    "Safety:",
    "  - The tool never writes unless --confirm ACTIVATE is present.",
    "  - A real activation backs up the previous active engine before replacing it.",
    "  - Use --required-current-sha when activating after review to guard against unseen active-file changes.",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function normalizeVersion(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function versionToCandidatePath(version) {
  return path.join(engineVersionsDir, `engine_${version}.md`);
}

function parseArgs(argv) {
  const options = {
    activePath: activeEnginePath,
    candidatePath: "",
    version: "",
    requiredCurrentSha: "",
    reason: "",
    dryRun: false,
    confirmToken: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--active") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--active requires a path.");
      }
      options.activePath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--candidate") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--candidate requires a path.");
      }
      options.candidatePath = resolvePath(value);
      index += 1;
      continue;
    }

    if (arg === "--version") {
      options.version = normalizeVersion(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--required-current-sha") {
      options.requiredCurrentSha = String(argv[index + 1] ?? "").trim().toLowerCase();
      index += 1;
      continue;
    }

    if (arg === "--reason") {
      options.reason = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--confirm") {
      options.confirmToken = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const sourceCount = [options.candidatePath, options.version].filter(Boolean).length;
  if (sourceCount !== 1) {
    throw new Error("Provide exactly one candidate source: --version or --candidate.");
  }

  if (!options.candidatePath) {
    options.candidatePath = versionToCandidatePath(options.version);
  }

  if (options.requiredCurrentSha && !/^[a-f0-9]{64}$/.test(options.requiredCurrentSha)) {
    throw new Error("--required-current-sha must be a full SHA-256 hex digest.");
  }

  return options;
}

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function inferVersion(candidatePath, text) {
  const candidates = [
    path.basename(candidatePath),
    text.slice(0, 2000),
  ];

  for (const candidate of candidates) {
    const match = candidate.match(/v\d+(?:\.\d+)+/i);
    if (match) {
      return normalizeVersion(match[0]);
    }
  }

  return "";
}

function timestampForFile(date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
}

function slugify(value) {
  return String(value || "unknown")
    .replace(/[^\p{L}\p{N}.]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "unknown";
}

async function fileSnapshot(filePath) {
  const [text, stats] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath),
  ]);

  return {
    text,
    bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
    sha256: hashText(text),
  };
}

async function appendActivationLog(entry) {
  await mkdir(path.dirname(activationLogPath), { recursive: true });
  await writeFile(activationLogPath, `${JSON.stringify(entry)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const [active, candidate] = await Promise.all([
    fileSnapshot(options.activePath),
    fileSnapshot(options.candidatePath),
  ]);

  if (options.requiredCurrentSha && active.sha256 !== options.requiredCurrentSha) {
    throw new Error(`Current active SHA mismatch. Expected ${options.requiredCurrentSha}, got ${active.sha256}.`);
  }

  const candidateVersion = options.version || inferVersion(options.candidatePath, candidate.text) || "unknown";
  const identical = active.sha256 === candidate.sha256;
  const now = new Date();
  const timestamp = timestampForFile(now);
  const backupPath = path.join(
    backupDir,
    `${timestamp}_active_engine_before_${slugify(candidateVersion)}.md`,
  );
  const activationId = `ENGINE-ACT-${timestamp}-${candidate.sha256.slice(0, 8).toUpperCase()}`;

  console.log("Engine activation plan:");
  console.log(`- Active target: ${normalizePath(options.activePath)}`);
  console.log(`- Candidate: ${normalizePath(options.candidatePath)}`);
  console.log(`- Candidate version: ${candidateVersion}`);
  console.log(`- Current active SHA-256: ${active.sha256}`);
  console.log(`- Candidate SHA-256: ${candidate.sha256}`);
  console.log(`- Candidate bytes: ${candidate.bytes}`);
  console.log(`- Backup path on real activation: ${normalizePath(backupPath)}`);
  console.log(`- Required current SHA guard: ${options.requiredCurrentSha || "none"}`);
  console.log(`- Dry run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- Confirm token: ${options.confirmToken || "none"}`);

  if (identical) {
    console.log("");
    console.log("Candidate content is identical to the current active engine.");
  }

  if (options.dryRun) {
    console.log("");
    console.log("Dry run complete. No files written.");
    return;
  }

  if (options.confirmToken !== "ACTIVATE") {
    console.log("");
    console.log("No files written. Add --confirm ACTIVATE after review to perform a real activation.");
    return;
  }

  if (identical) {
    console.log("");
    console.log("No files written because the candidate already matches active_engine.md.");
    return;
  }

  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFile(backupPath, active.text, "utf8");
  await writeFile(options.activePath, candidate.text, "utf8");
  await appendActivationLog({
    activation_id: activationId,
    activated_at: now.toISOString(),
    active: normalizePath(options.activePath),
    candidate: normalizePath(options.candidatePath),
    candidate_version: candidateVersion,
    previous_active_sha256: active.sha256,
    new_active_sha256: candidate.sha256,
    backup: normalizePath(backupPath),
    required_current_sha: options.requiredCurrentSha || null,
    reason: options.reason || null,
  });

  console.log("");
  console.log("Activation complete.");
  console.log(`- Activation ID: ${activationId}`);
  console.log(`- Wrote backup: ${normalizePath(backupPath)}`);
  console.log(`- Replaced active engine: ${normalizePath(options.activePath)}`);
  console.log(`- Appended log: ${normalizePath(activationLogPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
