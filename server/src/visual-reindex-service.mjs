import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectPaths } from "./project-paths.mjs";
import {
  validateVisualRecord,
  visualCategoryAssetDirectories,
} from "./visual-db.mjs";

const categoryByDirectory = new Map(
  Object.entries(visualCategoryAssetDirectories).map(([category, directory]) => [directory, category]),
);

async function readExistingRecords(indexPath) {
  let text;
  try {
    text = await readFile(indexPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const records = [];
  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    const line = raw.trim();
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid existing visual index JSON at line ${index + 1}: ${error.message}`);
    }
    const validation = validateVisualRecord(record);
    if (validation.errors.length > 0) {
      throw new Error(
        `Invalid existing visual index record at line ${index + 1}: ${validation.errors.join("; ")}`,
      );
    }
    records.push(record);
  }
  return records;
}

async function findPngFiles(directory) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".png") {
        files.push(filePath);
      }
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.localeCompare(b, "en"));
}

function projectAssetPath(assetsPath, filePath) {
  const relative = path.relative(assetsPath, filePath).replaceAll(path.sep, "/");
  return `data/visual_db/assets/${relative}`;
}

function categoryForAsset(assetsPath, filePath) {
  const [topDirectory = ""] = path.relative(assetsPath, filePath).split(path.sep);
  return categoryByDirectory.get(topDirectory) ?? "scene_reference";
}

function visualId(projectPath) {
  const digest = createHash("sha256").update(projectPath).digest("hex").slice(0, 16).toUpperCase();
  return `VIS-REINDEX-${digest}`;
}

async function buildImportedRecord(assetsPath, filePath) {
  const projectPath = projectAssetPath(assetsPath, filePath);
  const fileStats = await stat(filePath);
  const record = {
    visual_id: visualId(projectPath),
    created_at: fileStats.mtime.toISOString(),
    character: "unknown",
    category: categoryForAsset(assetsPath, filePath),
    title: path.basename(filePath),
    canon_status: "reference",
    trust_level: "T7",
    source: "reindexed_from_assets",
    status: "imported",
    path: projectPath,
    notes: "Reindexed visual reference only; does not establish canon facts or ability mechanics.",
    description: "",
    ability_state: "visual_only",
    tags: [],
  };
  const validation = validateVisualRecord(record);
  if (validation.errors.length > 0) {
    throw new Error(`Generated invalid visual record for ${projectPath}: ${validation.errors.join("; ")}`);
  }
  return record;
}

export async function reindexVisualAssets({
  assetsPath = projectPaths.visualAssets,
  indexPath = projectPaths.visualIndex,
} = {}) {
  const [files, existingRecords] = await Promise.all([
    findPngFiles(assetsPath),
    readExistingRecords(indexPath),
  ]);
  const recordsByPath = new Map(existingRecords.map((record) => [record.path, record]));

  for (const filePath of files) {
    const assetPath = projectAssetPath(assetsPath, filePath);
    if (!recordsByPath.has(assetPath)) {
      recordsByPath.set(assetPath, await buildImportedRecord(assetsPath, filePath));
    }
  }

  const records = files.map((filePath) => recordsByPath.get(projectAssetPath(assetsPath, filePath)));
  const content = records.length > 0
    ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
    : "";
  await mkdir(path.dirname(indexPath), { recursive: true });
  const temporaryPath = `${indexPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, indexPath);

  return {
    assetsScanned: files.length,
    records: records.length,
    imported: records.filter((record) => record.source === "reindexed_from_assets").length,
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  reindexVisualAssets()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(`Visual asset reindex failed: ${error.message}`);
      process.exitCode = 1;
    });
}
