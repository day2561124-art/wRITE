import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

const configPath = path.join(
  projectRoot,
  "config",
  "visual-library-rebuild-intake.json",
);

const noWriteFlags = [
  "writes_visual_index",
  "writes_visual_assets",
  "copies_files",
  "moves_files",
  "deletes_files",
  "updates_active_engine",
  "updates_canon_db",
  "writes_approval_queue",
  "creates_approval_item",
  "creates_canon_visual_lock",
];

const categoryRules = [
  {
    category: "characters",
    terms: ["character", "characters", "char", "角色", "人物"],
  },
  {
    category: "armed_forms",
    terms: ["weapon", "weapons", "armed", "arm", "武器", "武裝"],
  },
  {
    category: "abilities",
    terms: ["ability", "abilities", "power", "能力"],
  },
  {
    category: "expressions",
    terms: ["expression", "expressions", "face", "表情"],
  },
  {
    category: "outfits",
    terms: ["outfit", "outfits", "clothes", "costume", "服裝"],
  },
  {
    category: "scenes",
    terms: ["scene", "scenes", "bg", "background", "場景"],
  },
];

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error(`${label} must be a non-empty array.`);
  }
  for (const item of value) requireString(item, `${label} item`);
  return value;
}

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256Lf(value) {
  return sha256Buffer(Buffer.from(normalizeLf(value), "utf8"));
}

function stableId(prefix, seed, length = 16) {
  return `${prefix}${sha256Buffer(Buffer.from(seed, "utf8")).slice(0, length)}`;
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

function sanitizeStem(value) {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "visual";
}

function categoryRisk(category) {
  return category === "unknown" ? "medium" : "low";
}

function highestRisk(candidates, rejectedFiles) {
  if (
    candidates.some((candidate) => candidate.risk_summary.risk_level === "medium")
    || rejectedFiles.length
  ) {
    return "medium";
  }
  return "low";
}

async function collectFiles(directory, sourceRoot, output) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = normalizeRelativePath(path.relative(sourceRoot, absolutePath));
    if (entry.isSymbolicLink()) {
      output.push({
        absolutePath,
        relativePath,
        kind: "symlink",
      });
      continue;
    }
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, sourceRoot, output);
      continue;
    }
    if (entry.isFile()) {
      output.push({
        absolutePath,
        relativePath,
        kind: "file",
      });
    }
  }
}

export function validateVisualLibraryRebuildIntakeConfig(config) {
  requireObject(config, "visual library rebuild intake config");
  if (config.schema_version !== 1) throw new Error("schema_version must be 1.");
  if (config.phase !== "18B") throw new Error("phase must be 18B.");
  if (config.mode !== "read_only_visual_library_rebuild_intake_preview") {
    throw new Error("mode must be read_only_visual_library_rebuild_intake_preview.");
  }
  requireString(config.default_source_dir, "default_source_dir");
  requireString(config.visual_assets_root, "visual_assets_root");
  requireString(config.visual_index_path, "visual_index_path");
  requireString(config.active_engine_path, "active_engine_path");
  const expectedHash = requireString(
    config.expected_engine_sha256_lf,
    "expected_engine_sha256_lf",
  );
  if (!/^[A-F0-9]{64}$/u.test(expectedHash)) {
    throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  }
  const extensions = requireStringArray(config.allowed_extensions, "allowed_extensions");
  if (extensions.some((extension) => !/^\.[a-z0-9]+$/u.test(extension))) {
    throw new Error("allowed_extensions must contain lowercase dot-prefixed extensions.");
  }
  const categories = requireStringArray(config.category_candidates, "category_candidates");
  const expectedCategories = categoryRules.map((rule) => rule.category);
  if (JSON.stringify(categories) !== JSON.stringify(expectedCategories)) {
    throw new Error(`category_candidates must be ${expectedCategories.join(", ")}.`);
  }
  if (config.read_only !== true) throw new Error("read_only must be true.");
  if (config.preview_only !== true) throw new Error("preview_only must be true.");
  for (const flag of noWriteFlags) {
    if (config[flag] !== false) throw new Error(`${flag} must be false.`);
  }
  return config;
}

export async function loadVisualLibraryRebuildIntakeConfig(options = {}) {
  if (options.config) {
    return {
      config: validateVisualLibraryRebuildIntakeConfig(
        structuredClone(options.config),
      ),
      config_path: null,
    };
  }
  const resolvedConfigPath = options.configPath
    ? resolveProjectPath(options.configPath, "visual library rebuild intake config")
    : configPath;
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  return {
    config: validateVisualLibraryRebuildIntakeConfig(config),
    config_path: normalizeProjectPath(resolvedConfigPath),
  };
}

export function inferVisualCategoryCandidate(sourceFile) {
  const searchable = String(sourceFile).normalize("NFKC").toLowerCase();
  for (const rule of categoryRules) {
    const term = rule.terms.find((candidate) => searchable.includes(candidate));
    if (term) {
      return {
        category_candidate: rule.category,
        category_reason: `matched filename/path keyword: ${term}`,
      };
    }
  }
  return {
    category_candidate: "unknown",
    category_reason: "no supported category keyword matched the filename or path",
  };
}

export function buildProposedVisualId(input) {
  const sha256 = typeof input === "string" ? input : input.sha256;
  return `VIS-INTAKE-${requireString(sha256, "sha256").slice(0, 16).toUpperCase()}`;
}

export function buildProposedTargetPath(input) {
  const category = input.category_candidate === "unknown"
    ? "unknown"
    : input.category_candidate;
  const extension = requireString(input.extension, "extension").toLowerCase();
  const stem = sanitizeStem(path.basename(input.file_name, extension));
  const suffix = requireString(input.sha256, "sha256").slice(0, 12).toLowerCase();
  return `data/visual_db/assets/${category}/${stem}-${suffix}${extension}`;
}

export function buildVisualIntakeCandidate(input) {
  const category = inferVisualCategoryCandidate(input.source_file);
  const warnings = [];
  if (category.category_candidate === "unknown") {
    warnings.push("unknown_category_candidate");
  }
  const candidate = {
    intake_candidate_id: stableId(
      "VIC-",
      `${input.source_file}|${input.sha256}`,
    ),
    source_file: input.source_file,
    file_name: input.file_name,
    extension: input.extension,
    size_bytes: input.size_bytes,
    sha256: input.sha256,
    duplicate_group_id: null,
    duplicate_status: "unique",
    category_candidate: category.category_candidate,
    category_reason: category.category_reason,
    proposed_visual_id: buildProposedVisualId(input),
    proposed_target_path: buildProposedTargetPath({
      ...input,
      ...category,
    }),
    canon_status: "reference_candidate",
    trust_level: "T7",
    source: "visual_library_rebuild_intake_preview",
    status: "preview_only",
    warnings,
    risk_summary: {
      risk_level: categoryRisk(category.category_candidate),
      reasons: category.category_candidate === "unknown"
        ? ["category_requires_human_review"]
        : [],
    },
    no_write_summary: {
      writes_visual_index: false,
      writes_visual_assets: false,
      copies_files: false,
      moves_files: false,
      deletes_files: false,
      updates_active_engine: false,
      updates_canon_db: false,
      writes_approval_queue: false,
      creates_approval_item: false,
      creates_canon_visual_lock: false,
    },
  };
  return candidate;
}

export function detectVisualIntakeDuplicates(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const group = groups.get(candidate.sha256) ?? [];
    group.push(candidate);
    groups.set(candidate.sha256, group);
  }
  const duplicateGroups = [];
  for (const [sha256, group] of groups) {
    group.sort((left, right) => left.source_file.localeCompare(right.source_file, "en"));
    if (group.length < 2) continue;
    const duplicateGroupId = `VDG-${sha256.slice(0, 16)}`;
    group.forEach((candidate, index) => {
      candidate.duplicate_group_id = duplicateGroupId;
      candidate.duplicate_status = index === 0
        ? "primary_candidate"
        : "duplicate_candidate";
      candidate.warnings.push(
        index === 0
          ? "duplicate_group_primary_candidate"
          : "duplicate_content_candidate",
      );
      candidate.risk_summary = {
        risk_level: "medium",
        reasons: [
          ...candidate.risk_summary.reasons,
          "duplicate_content_requires_human_review",
        ],
      };
    });
    duplicateGroups.push({
      duplicate_group_id: duplicateGroupId,
      sha256,
      candidate_count: group.length,
      primary_candidate_id: group[0].intake_candidate_id,
      candidate_ids: group.map((candidate) => candidate.intake_candidate_id),
    });
  }
  duplicateGroups.sort((left, right) => (
    left.duplicate_group_id.localeCompare(right.duplicate_group_id, "en")
  ));
  return duplicateGroups;
}

export function compileVisualLibraryRebuildIntakeSummary(preview) {
  requireObject(preview, "visual library rebuild intake preview");
  return {
    phase: "18B",
    mode: "read_only_visual_library_rebuild_intake_preview",
    source_dir: preview.source_dir,
    scanned_file_count: preview.scanned_file_count,
    accepted_candidate_count: preview.accepted_candidate_count,
    rejected_file_count: preview.rejected_file_count,
    duplicate_group_count: preview.duplicate_group_count,
    warning_count: preview.warning_count,
    risk_level: preview.risk_level,
    writes_visual_index: false,
    writes_visual_assets: false,
    updates_active_engine: false,
    updates_canon_db: false,
    creates_canon_visual_lock: false,
  };
}

export async function scanVisualLibraryIntakePreview(options = {}) {
  const { config, config_path: loadedConfigPath } =
    await loadVisualLibraryRebuildIntakeConfig(options);
  const sourceDir = resolveProjectPath(
    options.sourceDir ?? options.source_dir ?? config.default_source_dir,
    "visual library intake source directory",
  );
  const activeEnginePath = resolveProjectPath(
    config.active_engine_path,
    "active engine path",
  );
  const visualIndexPath = resolveProjectPath(
    config.visual_index_path,
    "visual index path",
  );
  const visualAssetsRoot = resolveProjectPath(
    config.visual_assets_root,
    "visual assets root",
  );

  const engineText = await readFile(activeEnginePath, "utf8");
  const engineSha256Lf = sha256Lf(engineText);
  if (engineSha256Lf !== config.expected_engine_sha256_lf) {
    throw new Error(
      `engine hash mismatch: expected ${config.expected_engine_sha256_lf} got ${engineSha256Lf}`,
    );
  }
  await readFile(visualIndexPath);
  await lstat(visualAssetsRoot);

  const discovered = [];
  try {
    const sourceStat = await lstat(sourceDir);
    if (!sourceStat.isDirectory()) {
      throw new Error("visual library intake source must be a directory.");
    }
    await collectFiles(sourceDir, sourceDir, discovered);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const allowedExtensions = new Set(config.allowed_extensions);
  const candidates = [];
  const rejectedFiles = [];
  for (const file of discovered) {
    const extension = path.extname(file.relativePath).toLowerCase();
    if (file.kind === "symlink") {
      rejectedFiles.push({
        source_file: file.relativePath,
        file_name: path.basename(file.relativePath),
        extension,
        rejection_reason: "symbolic_links_are_not_scanned",
        warnings: ["symlink_rejected"],
      });
      continue;
    }
    if (!allowedExtensions.has(extension)) {
      rejectedFiles.push({
        source_file: file.relativePath,
        file_name: path.basename(file.relativePath),
        extension,
        rejection_reason: "unsupported_extension",
        warnings: ["unsupported_extension"],
      });
      continue;
    }
    try {
      const content = await readFile(file.absolutePath);
      candidates.push(buildVisualIntakeCandidate({
        source_file: file.relativePath,
        file_name: path.basename(file.relativePath),
        extension,
        size_bytes: content.byteLength,
        sha256: sha256Buffer(content),
      }));
    } catch (error) {
      rejectedFiles.push({
        source_file: file.relativePath,
        file_name: path.basename(file.relativePath),
        extension,
        rejection_reason: "file_read_error",
        warnings: [`file_read_error:${error.code ?? "unknown"}`],
      });
    }
  }

  candidates.sort((left, right) => left.source_file.localeCompare(right.source_file, "en"));
  rejectedFiles.sort((left, right) => left.source_file.localeCompare(right.source_file, "en"));
  const duplicateGroups = detectVisualIntakeDuplicates(candidates);
  const warningCount = candidates.reduce(
    (total, candidate) => total + candidate.warnings.length,
    rejectedFiles.reduce((total, file) => total + file.warnings.length, 0),
  );

  const preview = {
    schema_version: config.schema_version,
    phase: config.phase,
    mode: config.mode,
    config_path: loadedConfigPath,
    source_dir: normalizeProjectPath(sourceDir),
    source_dir_exists: discovered.length > 0 || await lstat(sourceDir)
      .then((stat) => stat.isDirectory())
      .catch(() => false),
    active_engine_path: normalizeProjectPath(activeEnginePath),
    active_engine_sha256_lf: engineSha256Lf,
    expected_engine_sha256_lf: config.expected_engine_sha256_lf,
    engine_hash_matches: true,
    visual_index_path: normalizeProjectPath(visualIndexPath),
    visual_assets_root: normalizeProjectPath(visualAssetsRoot),
    scanned_file_count: discovered.length,
    accepted_candidate_count: candidates.length,
    rejected_file_count: rejectedFiles.length,
    duplicate_group_count: duplicateGroups.length,
    warning_count: warningCount,
    risk_level: highestRisk(candidates, rejectedFiles),
    candidates,
    rejected_files: rejectedFiles,
    duplicate_groups: duplicateGroups,
    read_only: true,
    preview_only: true,
    writes_visual_index: false,
    writes_visual_assets: false,
    updates_active_engine: false,
    updates_canon_db: false,
    creates_canon_visual_lock: false,
  };
  preview.summary = compileVisualLibraryRebuildIntakeSummary(preview);
  return preview;
}
