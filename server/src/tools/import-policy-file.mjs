import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

const kindSpecs = {
  engine: {
    label: "Canon DB active engine",
    activePath: path.join(rootDir, "data", "canon_db", "active_engine.md"),
    versionsDir: path.join(rootDir, "data", "canon_db", "versions"),
    versionPrefix: "engine",
  },
  writing: {
    label: "Writing Policy active writing card",
    activePath: path.join(rootDir, "data", "writing_policy_db", "active_writing_card.md"),
    versionsDir: path.join(rootDir, "data", "writing_policy_db", "versions"),
    versionPrefix: "writing_card",
  },
  proofing: {
    label: "Proofing Policy active proofing card",
    activePath: path.join(rootDir, "data", "proofing_policy_db", "active_proofing_card.md"),
    versionsDir: path.join(rootDir, "data", "proofing_policy_db", "versions"),
    versionPrefix: "proofing_card",
  },
  longline: {
    label: "Longline DB active longline",
    activePath: path.join(rootDir, "data", "longline_db", "active_longline.md"),
    versionsDir: path.join(rootDir, "data", "longline_db", "versions"),
    versionPrefix: "longline",
  },
};

const importLogPath = path.join(rootDir, "data", "outputs", "logs", "policy_imports.jsonl");
const backupDir = path.join(rootDir, "data", "outputs", "logs", "policy_import_backups");

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/import-policy-file.mjs --kind engine|writing|proofing|longline --source <path> [--version vX.Y] [--dry-run] [--force] [--confirm IMPORT_POLICY]",
    "",
    "Examples:",
    "  node server/src/tools/import-policy-file.mjs --kind proofing --source \"E:\\設定集\\完整設定檔\\研究包\\完稿後驗稿卡_v1.0.md\" --dry-run",
    "  node server/src/tools/import-policy-file.mjs --kind longline --source \"E:\\設定集\\完整設定檔\\長線骨架_v1.0.md\" --version v1.0 --confirm IMPORT_POLICY",
    "",
    "Notes:",
    "  - The source file is never modified.",
    "  - Real writes require --confirm IMPORT_POLICY.",
    "  - The tool writes the active file and a versioned copy under data/*/versions/ when content changes are needed.",
    "  - Active files are backed up before replacement.",
    "  - Existing version files are not overwritten unless --force is provided.",
  ].join("\n");
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function parseArgs(argv) {
  const options = {
    kind: "",
    sourcePath: "",
    version: "",
    dryRun: false,
    force: false,
    confirm: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--kind") {
      options.kind = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--source") {
      const source = argv[index + 1];
      if (!source) {
        throw new Error("--source requires a path.");
      }
      options.sourcePath = resolvePath(source);
      index += 1;
      continue;
    }

    if (arg === "--version") {
      options.version = normalizeVersion(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--confirm") {
      options.confirm = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!kindSpecs[options.kind]) {
    throw new Error("--kind must be one of: engine, writing, proofing, longline.");
  }

  if (!options.sourcePath) {
    throw new Error("--source is required.");
  }

  return options;
}

function normalizeVersion(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function inferVersion(sourcePath, text) {
  const candidates = [
    path.basename(sourcePath),
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

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
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

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalText(filePath) {
  try {
    return {
      exists: true,
      text: await readFile(filePath, "utf8"),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false,
        text: "",
      };
    }
    throw error;
  }
}

async function appendLog(entry) {
  await mkdir(path.dirname(importLogPath), { recursive: true });
  await writeFile(importLogPath, `${JSON.stringify(entry)}\n`, {
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

  const spec = kindSpecs[options.kind];
  const [sourceText, sourceStats] = await Promise.all([
    readFile(options.sourcePath, "utf8"),
    stat(options.sourcePath),
  ]);
  const version = options.version || inferVersion(options.sourcePath, sourceText);

  if (!version) {
    throw new Error("Could not infer version. Provide --version vX.Y.");
  }

  const versionPath = path.join(spec.versionsDir, `${spec.versionPrefix}_${version}.md`);
  const sourceSha256 = hashText(sourceText);
  const versionExists = await exists(versionPath);
  const activeSnapshot = await readOptionalText(spec.activePath);
  const activeSha256 = activeSnapshot.exists ? hashText(activeSnapshot.text) : "";
  let existingVersionSha256 = "";

  if (versionExists && !options.force) {
    const existingText = await readFile(versionPath, "utf8");
    existingVersionSha256 = hashText(existingText);
    if (existingVersionSha256 !== sourceSha256) {
      throw new Error(`Version file already exists with different content: ${normalizePath(versionPath)}. Use --force to overwrite.`);
    }
  } else if (versionExists) {
    existingVersionSha256 = hashText(await readFile(versionPath, "utf8"));
  }

  const activeNeedsWrite = activeSha256 !== sourceSha256;
  const versionNeedsWrite = !versionExists || existingVersionSha256 !== sourceSha256;
  const now = new Date();
  const backupPath = path.join(
    backupDir,
    `${timestampForFile(now)}_${options.kind}_active_before_import_${slugify(version)}.md`,
  );

  const summary = {
    kind: options.kind,
    label: spec.label,
    source: options.sourcePath,
    source_bytes: sourceStats.size,
    active: normalizePath(spec.activePath),
    version: normalizePath(versionPath),
    detected_version: version,
    sha256: sourceSha256,
    active_current_sha256: activeSha256 || null,
    version_current_sha256: existingVersionSha256 || null,
    active_needs_write: activeNeedsWrite,
    version_needs_write: versionNeedsWrite,
    backup: activeSnapshot.exists && activeNeedsWrite ? normalizePath(backupPath) : null,
    dry_run: options.dryRun,
    force: options.force,
  };

  console.log("Import plan:");
  console.log(`- Kind: ${summary.kind}`);
  console.log(`- Source: ${summary.source}`);
  console.log(`- Active target: ${summary.active}`);
  console.log(`- Version target: ${summary.version}`);
  console.log(`- Version: ${summary.detected_version}`);
  console.log(`- SHA-256: ${summary.sha256}`);
  console.log(`- Current active SHA-256: ${summary.active_current_sha256 || "missing"}`);
  console.log(`- Current version SHA-256: ${summary.version_current_sha256 || (versionExists ? "unknown" : "missing")}`);
  console.log(`- Active needs write: ${summary.active_needs_write ? "yes" : "no"}`);
  console.log(`- Version needs write: ${summary.version_needs_write ? "yes" : "no"}`);
  console.log(`- Backup path on active replacement: ${summary.backup || "none"}`);
  console.log(`- Dry run: ${summary.dry_run ? "yes" : "no"}`);
  console.log(`- Confirm token: ${options.confirm || "none"}`);

  if (options.dryRun) {
    console.log("");
    console.log("Dry run complete. No files written.");
    return;
  }

  if (!activeNeedsWrite && !versionNeedsWrite) {
    console.log("");
    console.log("No files written because active and version already match the source.");
    return;
  }

  if (options.confirm !== "IMPORT_POLICY") {
    console.log("");
    console.log("No files written. Add --confirm IMPORT_POLICY after review to perform a real import.");
    return;
  }

  await mkdir(spec.versionsDir, { recursive: true });
  if (activeNeedsWrite && activeSnapshot.exists) {
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, activeSnapshot.text, "utf8");
  }

  if (activeNeedsWrite) {
    await writeFile(spec.activePath, sourceText, "utf8");
  }

  if (versionNeedsWrite) {
    await writeFile(versionPath, sourceText, "utf8");
  }

  await appendLog({
    imported_at: now.toISOString(),
    ...summary,
    wrote_active: activeNeedsWrite,
    wrote_version: versionNeedsWrite,
  });

  console.log("");
  console.log("Import complete.");
  if (activeNeedsWrite) {
    console.log(`- Wrote ${summary.active}`);
  }
  if (versionNeedsWrite) {
    console.log(`- Wrote ${summary.version}`);
  }
  if (summary.backup) {
    console.log(`- Wrote backup ${summary.backup}`);
  }
  console.log(`- Logged ${normalizePath(importLogPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
