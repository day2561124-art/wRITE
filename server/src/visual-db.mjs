import path from "node:path";

export const visualCategorySpecs = [
  ["character_design", "人設"],
  ["armed_form", "異能武裝"],
  ["outfit", "服裝"],
  ["ability", "異能演出"],
  ["expression", "表情"],
  ["scene_reference", "場景參考"],
];

export const visualCategories = new Set(visualCategorySpecs.map(([key]) => key));
export const visualCategoryLabels = Object.fromEntries(visualCategorySpecs);
export const visualCanonStatusValues = new Set([
  "reference",
  "candidate",
  "approved_visual",
  "deprecated",
]);
export const visualTrustLevelValues = new Set(["T3", "T7", "T8"]);
export const visualSourceValues = new Set([
  "user_imported",
  "ai_generated_reference",
  "external_reference",
  "repository_fixture",
]);
export const allowedVisualImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export function isVisualAssetProjectPath(projectPath) {
  if (typeof projectPath !== "string") return false;
  const normalized = projectPath.replaceAll("\\", "/");
  const compact = path.posix.normalize(normalized);
  return (
    compact === normalized
    && normalized.startsWith("data/visual_db/assets/")
    && !normalized.includes("/../")
    && allowedVisualImageExtensions.has(path.posix.extname(normalized).toLowerCase())
  );
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function requireString(errors, record, field) {
  if (typeof record[field] !== "string" || !record[field].trim()) {
    errors.push(`${field} must be a non-empty string.`);
  }
}

function optionalString(errors, record, field) {
  if (field in record && record[field] !== "" && typeof record[field] !== "string") {
    errors.push(`${field} must be a string when present.`);
  }
}

export function validateVisualRecord(record) {
  const errors = [];
  const warnings = [];
  if (!isObject(record)) {
    return { errors: ["record must be an object."], warnings };
  }

  for (const field of [
    "visual_id",
    "created_at",
    "character",
    "category",
    "title",
    "canon_status",
    "trust_level",
    "source",
    "path",
    "tags",
  ]) {
    if (!(field in record)) errors.push(`missing required field: ${field}.`);
  }

  for (const field of [
    "visual_id",
    "created_at",
    "character",
    "category",
    "title",
    "canon_status",
    "trust_level",
    "source",
    "path",
  ]) {
    if (field in record) requireString(errors, record, field);
  }

  for (const field of ["updated_at", "notes", "description", "ability_state"]) {
    optionalString(errors, record, field);
  }

  if ("created_at" in record && !isIsoDate(record.created_at)) {
    errors.push("created_at must be a valid ISO date string.");
  }
  if ("updated_at" in record && record.updated_at && !isIsoDate(record.updated_at)) {
    errors.push("updated_at must be a valid ISO date string.");
  }
  if ("visual_id" in record && !String(record.visual_id).startsWith("VIS-")) {
    warnings.push("visual_id should start with VIS-.");
  }
  if ("category" in record && !visualCategories.has(record.category)) {
    errors.push(`category must be one of: ${[...visualCategories].join(", ")}.`);
  }
  if ("canon_status" in record && !visualCanonStatusValues.has(record.canon_status)) {
    errors.push(`canon_status must be one of: ${[...visualCanonStatusValues].join(", ")}.`);
  }
  if ("trust_level" in record && !visualTrustLevelValues.has(record.trust_level)) {
    errors.push(`trust_level must be one of: ${[...visualTrustLevelValues].join(", ")}.`);
  }
  if ("source" in record && !visualSourceValues.has(record.source)) {
    errors.push(`source must be one of: ${[...visualSourceValues].join(", ")}.`);
  }
  if ("path" in record && !isVisualAssetProjectPath(record.path)) {
    errors.push("path must point to an allowed image under data/visual_db/assets/.");
  }
  if (!Array.isArray(record.tags)) {
    errors.push("tags must be an array.");
  } else if (record.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
    errors.push("tags must contain non-empty strings.");
  }
  if (record.canon_status === "approved_visual" && record.trust_level !== "T3") {
    warnings.push("approved_visual records should use trust_level T3.");
  }
  if (record.category === "armed_form" && !String(record.notes ?? "").trim()) {
    warnings.push("armed_form records should include notes that separate visual reference from established ability facts.");
  }

  return { errors, warnings };
}
