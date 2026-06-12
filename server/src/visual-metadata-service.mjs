import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectPaths } from "./project-paths.mjs";
import {
  isVisualAssetProjectPath,
  validateVisualRecord,
  visualCategories,
  visualCategoryLabels,
} from "./visual-db.mjs";

const categoryAliases = new Map([
  ...[...visualCategories].map((category) => [category, category]),
  ...Object.entries(visualCategoryLabels).map(([category, label]) => [label, category]),
  ["characters", "character_design"],
  ["armed_forms", "armed_form"],
  ["abilities", "ability"],
  ["outfits", "outfit"],
  ["expressions", "expression"],
  ["scenes", "scene_reference"],
  ["武裝", "armed_form"],
  ["能力", "ability"],
]);

function validateRecordOrThrow(record, label) {
  const validation = validateVisualRecord(record);
  if (validation.errors.length > 0) {
    throw new Error(`${label}: ${validation.errors.join("; ")}`);
  }
}

async function readIndex(indexPath) {
  const text = await readFile(indexPath, "utf8");
  return text.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid visual index JSON at line ${index + 1}: ${error.message}`);
    }
    validateRecordOrThrow(record, `Invalid visual index record at line ${index + 1}`);
    return record;
  });
}

function normalizeMappingEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Mapping entry ${index + 1} must be an object.`);
  }
  if (!isVisualAssetProjectPath(entry.path)) {
    throw new Error(`Mapping entry ${index + 1} has an invalid visual asset path.`);
  }
  const update = {};
  for (const field of ["title", "character"]) {
    if (field in entry) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) {
        throw new Error(`Mapping entry ${index + 1} ${field} must be a non-empty string.`);
      }
      update[field] = entry[field].trim();
    }
  }
  if ("category" in entry) {
    const category = categoryAliases.get(entry.category);
    if (!category) throw new Error(`Mapping entry ${index + 1} category is not recognized.`);
    update.category = category;
  }
  if ("tags" in entry) {
    if (
      !Array.isArray(entry.tags)
      || entry.tags.some((tag) => typeof tag !== "string" || !tag.trim())
    ) {
      throw new Error(`Mapping entry ${index + 1} tags must be an array of non-empty strings.`);
    }
    update.tags = [...new Set(entry.tags.map((tag) => tag.trim()))];
  }
  if (Object.keys(update).length === 0) {
    throw new Error(`Mapping entry ${index + 1} does not contain metadata fields.`);
  }
  return { path: entry.path, update };
}

export async function updateVisualMetadata({
  mapping,
  indexPath = projectPaths.visualIndex,
} = {}) {
  if (!Array.isArray(mapping)) throw new Error("Metadata mapping must be a JSON array.");
  const entries = mapping.map(normalizeMappingEntry);
  const records = await readIndex(indexPath);
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const updated = [];
  const skipped = [];
  const now = new Date().toISOString();

  for (const entry of entries) {
    const current = recordsByPath.get(entry.path);
    if (!current) {
      skipped.push({ path: entry.path, reason: "path_not_found" });
      continue;
    }
    const next = {
      ...current,
      ...entry.update,
      metadata_source: "manual_mapping",
      updated_at: now,
    };
    validateRecordOrThrow(next, `Updated visual record ${entry.path} is invalid`);
    recordsByPath.set(entry.path, next);
    updated.push(entry.path);
  }

  const nextRecords = records.map((record) => recordsByPath.get(record.path));
  for (const record of nextRecords) validateRecordOrThrow(record, `Final visual record ${record.path}`);
  const temporaryPath = `${indexPath}.tmp-${process.pid}`;
  await writeFile(
    temporaryPath,
    `${nextRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
  await rename(temporaryPath, indexPath);
  return { updated, skipped, records: nextRecords.length };
}

export async function updateVisualMetadataFromFile(mappingPath, options = {}) {
  const resolvedMappingPath = path.resolve(mappingPath);
  const mapping = JSON.parse(await readFile(resolvedMappingPath, "utf8"));
  return updateVisualMetadata({ ...options, mapping });
}
