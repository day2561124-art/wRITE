import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  normalizeProjectPath,
  projectPaths,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  parseVisualUploadedReferenceMetadataJsonl,
} from "./visual-uploaded-reference-metadata-enrichment-service.mjs";

const uploadedReferenceSource = "user_imported";
const requiredReferenceCanonStatus = "reference";
const requiredVisualOnlyAbilityState = "visual_only";
const requiredVisualUsageScope = "visual_only_reference";
const writingContextSafetyNote = (
  "Visual uploaded references may be injected into writing context only as "
  + "visual-only appearance, pose, style, and atmosphere guidance. They must "
  + "not establish or modify canon facts, ability mechanics, soul weapons, "
  + "relationships, ranks, factions, timeline events, or chapter outcomes."
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(value) {
  return normalizeString(value).length > 0;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const item of value) {
    const text = normalizeString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }
  return output;
}

export function analyzeVisualUploadedReferenceWritingContextRecord(record) {
  const identityPresent = hasText(record.visual_id)
    && hasText(record.character)
    && hasText(record.title)
    && hasText(record.path);
  const referenceOnlyContractPassed = record.source === uploadedReferenceSource
    && record.canon_status === requiredReferenceCanonStatus
    && record.ability_state === requiredVisualOnlyAbilityState
    && record.visual_usage_scope === requiredVisualUsageScope;
  const metadataReady = hasText(record.description)
    && normalizeTags(record.tags).length > 0
    && hasText(record.metadata_source)
    && hasText(record.metadata_enriched_at);
  const decision = !identityPresent
    ? "blocked_visual_uploaded_reference_writing_context_missing_identity"
    : !referenceOnlyContractPassed
      ? "blocked_visual_uploaded_reference_writing_context_not_visual_only"
      : !metadataReady
        ? "blocked_visual_uploaded_reference_writing_context_metadata_incomplete"
        : "visual_uploaded_reference_writing_context_injection_item_accepted";

  return {
    visual_id: record.visual_id ?? null,
    character: record.character ?? null,
    title: record.title ?? null,
    category: record.category ?? null,
    source: record.source ?? null,
    path: record.path ?? null,
    canon_status: record.canon_status ?? null,
    ability_state: record.ability_state ?? null,
    visual_usage_scope: record.visual_usage_scope ?? null,
    metadata_source: record.metadata_source ?? null,
    metadata_enriched_at: record.metadata_enriched_at ?? null,
    description: record.description ?? "",
    tags: normalizeTags(record.tags),
    identity_present: identityPresent,
    reference_only_contract_passed: referenceOnlyContractPassed,
    metadata_ready: metadataReady,
    inclusion_allowed: decision === "visual_uploaded_reference_writing_context_injection_item_accepted",
    allowed_usage: [
      "appearance guidance",
      "pose guidance",
      "style guidance",
      "atmosphere guidance",
    ],
    forbidden_usage: [
      "canon facts",
      "ability mechanics",
      "soul weapons",
      "relationships",
      "ranks",
      "factions",
      "timeline events",
      "chapter outcomes",
    ],
    decision,
  };
}

function summarizeVisualUploadedReferences(records, analyzedItems) {
  const acceptedItems = analyzedItems.filter((item) => item.inclusion_allowed);
  const blockedItems = analyzedItems.filter((item) => !item.inclusion_allowed);
  return {
    total_record_count: records.length,
    ignored_non_user_uploaded_count:
      records.filter((record) => record.source !== uploadedReferenceSource).length,
    user_uploaded_reference_count: analyzedItems.length,
    accepted_reference_count: acceptedItems.length,
    blocked_reference_count: blockedItems.length,
    all_references_visual_only: blockedItems.length === 0,
    writes_visual_index: false,
    writes_visual_assets: false,
    updates_active_engine: false,
    updates_canon_db: false,
  };
}

export async function buildVisualUploadedReferencesWritingContextInjection(
  options = {},
) {
  const visualIndexPath = options.visualIndexPath
    ? resolveProjectPath(options.visualIndexPath, "visual index path")
    : projectPaths.visualIndex;
  const visualIndexText = options.visualIndexText
    ?? await readFile(visualIndexPath, "utf8");
  const records = options.records
    ?? parseVisualUploadedReferenceMetadataJsonl(visualIndexText);
  const analyzedItems = records
    .filter((record) => record.source === uploadedReferenceSource)
    .map((record) => analyzeVisualUploadedReferenceWritingContextRecord(record));
  const acceptedItems = analyzedItems.filter((item) => item.inclusion_allowed);
  const summary = summarizeVisualUploadedReferences(records, analyzedItems);
  return {
    schema_version: 1,
    phase: "39G",
    mode: "visual_uploaded_references_writing_context_injection",
    loaded: acceptedItems.length > 0,
    visual_index_path: normalizeProjectPath(visualIndexPath),
    visual_index_hash_sha256: sha256(visualIndexText),
    source_filter: uploadedReferenceSource,
    injection_scope: "writing_context_visual_only",
    canon_status: "reference_only",
    reference_count: acceptedItems.length,
    blocked_reference_count: summary.blocked_reference_count,
    safety_contract: {
      visual_only: true,
      reference_only: true,
      may_guide_appearance: true,
      may_guide_pose: true,
      may_guide_style: true,
      may_guide_atmosphere: true,
      must_not_establish_canon: true,
      must_not_infer_abilities: true,
      must_not_infer_relationships: true,
      must_not_infer_ranks_or_factions: true,
      must_not_infer_timeline_events: true,
      must_not_update_active_engine: true,
      must_not_update_canon_db: true,
    },
    items: acceptedItems,
    blocked_items: analyzedItems.filter((item) => !item.inclusion_allowed),
    summary,
    side_effect_summary: {
      writes_visual_index: false,
      writes_visual_assets: false,
      updates_active_engine: false,
      updates_canon_db: false,
      contract_passed: true,
    },
    safety_notes: [writingContextSafetyNote],
    decision: summary.blocked_reference_count > 0
      ? "blocked_visual_uploaded_references_writing_context_injection"
      : acceptedItems.length > 0
        ? "visual_uploaded_references_writing_context_injection_accepted"
        : "visual_uploaded_references_writing_context_injection_no_references",
  };
}

export function serializeVisualUploadedReferencesWritingContextMarkdown(packet) {
  if (!packet || packet.loaded !== true) {
    return [
      "Visual uploaded references are not loaded for this context.",
      "Use active_engine and canon sources only.",
    ].join("\n");
  }
  const lines = [
    `loaded: ${packet.loaded}`,
    `reference_count: ${packet.reference_count}`,
    `injection_scope: ${packet.injection_scope}`,
    `canon_status: ${packet.canon_status}`,
    "safety: visual-only reference; do not infer canon facts, abilities, relationships, ranks, factions, timeline events, or chapter outcomes.",
    "",
  ];
  for (const item of packet.items) {
    lines.push(
      `- ${item.character} (${item.visual_id})`,
      `  - title: ${item.title}`,
      `  - path: ${item.path}`,
      `  - description: ${item.description}`,
      `  - tags: ${item.tags.join(", ")}`,
      "  - usage: appearance, pose, style, and atmosphere guidance only",
      "  - forbidden: canon facts, ability mechanics, relationships, ranks, factions, timeline events, chapter outcomes",
    );
  }
  return lines.join("\n");
}
