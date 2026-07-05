import { readFile } from "node:fs/promises";
import {
  normalizeProjectPath,
  projectPaths,
  resolveProjectPath,
} from "./project-paths.mjs";

const uploadedReferenceSource = "user_imported";
const requiredReferenceCanonStatus = "reference";
const requiredVisualOnlyAbilityState = "visual_only";
const visualOnlySafetyNote =
  "Preview only: visual uploaded references may guide appearance, pose, style, and atmosphere, but must not establish canon facts, ability mechanics, relationships, ranks, or timeline events.";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(value) {
  return normalizeString(value).length > 0;
}

function hasTags(value) {
  return Array.isArray(value)
    && value.some((item) => hasText(item));
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = normalizeString(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }
  return output;
}

function normalizeCategoryTag(value) {
  return normalizeString(value).replaceAll("_", "-").toLowerCase();
}

export function parseVisualUploadedReferenceMetadataJsonl(text) {
  return String(text)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `Invalid visual index JSONL at line ${index + 1}: ${error.message}`,
        );
      }
    });
}

export function buildRecommendedVisualOnlyTags(record) {
  return uniqueStrings([
    record.character,
    record.title,
    normalizeCategoryTag(record.category),
    "user-uploaded-reference",
    "visual-only",
    "reference-only",
  ]);
}

export function buildRecommendedVisualOnlyDescription(record) {
  const label = normalizeString(record.character)
    || normalizeString(record.title)
    || normalizeString(record.visual_id)
    || "未命名圖片";
  return `${label}的使用者上傳視覺參考圖。僅作外觀、造型、姿態與氛圍參考，不建立能力、身分、關係、階級或時間線正史。`;
}

function metadataCompletenessScore(fields) {
  const checks = [
    fields.visual_id_present,
    fields.character_present,
    fields.title_present,
    fields.path_present,
    fields.description_present,
    fields.tags_present,
    fields.notes_present,
    fields.reference_only_contract_present,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function analyzeVisualUploadedReferenceMetadata(record) {
  const fields = {
    visual_id_present: hasText(record.visual_id),
    character_present: hasText(record.character),
    title_present: hasText(record.title),
    path_present: hasText(record.path),
    description_present: hasText(record.description),
    tags_present: hasTags(record.tags),
    notes_present: hasText(record.notes),
    reference_only_contract_present:
      record.canon_status === requiredReferenceCanonStatus
      && record.ability_state === requiredVisualOnlyAbilityState,
  };
  const missingFields = [];
  for (const [field, present] of Object.entries(fields)) {
    if (!present) missingFields.push(field.replace(/_present$/u, ""));
  }
  const identityFieldsPresent = fields.visual_id_present
    && fields.character_present
    && fields.title_present
    && fields.path_present;
  const referenceOnlyContractPassed = fields.reference_only_contract_present;
  const decision = !identityFieldsPresent
    ? "blocked_visual_uploaded_reference_metadata_missing_required_identity"
    : !referenceOnlyContractPassed
      ? "blocked_visual_uploaded_reference_metadata_not_reference_only"
      : "visual_uploaded_reference_metadata_enrichment_preview_accepted";
  return {
    visual_id: record.visual_id ?? null,
    character: record.character ?? null,
    title: record.title ?? null,
    category: record.category ?? null,
    source: record.source ?? null,
    path: record.path ?? null,
    canon_status: record.canon_status ?? null,
    ability_state: record.ability_state ?? null,
    status: record.status ?? null,
    description_present: fields.description_present,
    tags_present: fields.tags_present,
    notes_present: fields.notes_present,
    reference_only_contract_passed: referenceOnlyContractPassed,
    metadata_completeness_score: metadataCompletenessScore(fields),
    missing_fields: missingFields,
    recommended_visual_only_tags: buildRecommendedVisualOnlyTags(record),
    recommended_description: buildRecommendedVisualOnlyDescription(record),
    metadata_update_preview_only: true,
    writes_visual_index: false,
    writes_visual_assets: false,
    updates_active_engine: false,
    updates_canon_db: false,
    safety_notes: [visualOnlySafetyNote],
    decision,
  };
}

function summarizeMetadataEnrichment(records, items) {
  return {
    total_record_count: records.length,
    ignored_non_user_uploaded_count:
      records.filter((record) => record.source !== uploadedReferenceSource).length,
    user_uploaded_reference_count: items.length,
    accepted_count: items.filter((item) => item.decision
      === "visual_uploaded_reference_metadata_enrichment_preview_accepted").length,
    blocked_count: items.filter((item) => item.decision
      !== "visual_uploaded_reference_metadata_enrichment_preview_accepted").length,
    missing_description_count:
      items.filter((item) => !item.description_present).length,
    missing_tags_count: items.filter((item) => !item.tags_present).length,
    preview_only: true,
  };
}

export async function runVisualUploadedReferenceMetadataEnrichmentPreview(
  options = {},
) {
  const visualIndexPath = options.visualIndexPath
    ? resolveProjectPath(options.visualIndexPath, "visual index path")
    : projectPaths.visualIndex;
  const visualIndexText = options.visualIndexText
    ?? await readFile(visualIndexPath, "utf8");
  const records = options.records
    ?? parseVisualUploadedReferenceMetadataJsonl(visualIndexText);
  const items = records
    .filter((record) => record.source === uploadedReferenceSource)
    .map((record) => analyzeVisualUploadedReferenceMetadata(record));
  const summary = summarizeMetadataEnrichment(records, items);
  return {
    schema_version: 1,
    phase: "39E",
    mode: "visual_uploaded_reference_metadata_enrichment_preview",
    visual_index_path: normalizeProjectPath(visualIndexPath),
    source_filter: uploadedReferenceSource,
    preview_only: true,
    no_write_summary: {
      writes_visual_index: false,
      writes_visual_assets: false,
      updates_active_engine: false,
      updates_canon_db: false,
      contract_passed: true,
    },
    items,
    summary,
    safety_notes: [visualOnlySafetyNote],
    decision: summary.blocked_count === 0
      ? "visual_uploaded_reference_metadata_enrichment_preview_accepted"
      : "blocked_visual_uploaded_reference_metadata_enrichment_preview",
  };
}
