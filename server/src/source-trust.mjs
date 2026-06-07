import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, "..", "..");

const source = (
  sourceId,
  sourceType,
  sourceTrustLevel,
  sourcePath,
  canonStatus,
  capabilities = {},
  placeholderPatterns = [],
) => ({
  source_id: sourceId,
  source_type: sourceType,
  source_trust_level: sourceTrustLevel,
  source_path: sourcePath,
  canon_status: canonStatus,
  created_by: "repository",
  approved_by_user: sourceTrustLevel === "T1" || sourceTrustLevel === "T3",
  can_be_used_for_canon: false,
  can_be_used_for_style: false,
  can_be_used_for_error_learning: false,
  can_be_used_for_retrieval: true,
  forbidden_reason: "",
  ...capabilities,
  placeholder_patterns: placeholderPatterns,
});

export const sourceTrustCatalog = [
  source(
    "active_engine",
    "canon_database",
    "T1",
    "data/canon_db/active_engine.md",
    "canon",
    { can_be_used_for_canon: true },
  ),
  source(
    "active_writing_card",
    "writing_policy",
    "T3",
    "data/writing_policy_db/active_writing_card.md",
    "policy",
    { can_be_used_for_style: true },
  ),
  source(
    "active_proofing_card",
    "proofing_policy",
    "T3",
    "data/proofing_policy_db/active_proofing_card.md",
    "policy",
    { can_be_used_for_style: true },
    [/尚未建立正式版本/u, /尚未匯入正式驗稿卡/u],
  ),
  source(
    "active_longline",
    "longline_policy",
    "T3",
    "data/longline_db/active_longline.md",
    "policy",
    {},
    [/缺檔保護卡/u, /尚未匯入正式長線骨架/u],
  ),
  source(
    "compressed_error_rules",
    "compressed_error_rules",
    "T5",
    "data/error_report_db/compressed_rules.md",
    "derived_rule",
    { can_be_used_for_error_learning: true },
    [/尚未建立正式版本/u, /尚未建立正式錯誤壓縮規則/u],
  ),
  ...[
    "canon_errors",
    "character_errors",
    "dialogue_errors",
    "pacing_errors",
    "battle_errors",
    "preference_errors",
  ].map((sourceId) =>
    source(
      sourceId,
      "error_report",
      "T5",
      `data/error_report_db/${sourceId}.jsonl`,
      "error_report",
      { can_be_used_for_error_learning: true },
    )),
  source(
    "pending_error_reports",
    "pending_error_candidate",
    "T7",
    "data/feedback_db/pending_error_reports.jsonl",
    "candidate",
  ),
  source(
    "canon_memory",
    "memory_cache",
    "T6",
    "data/memory_store/canon_memory.json",
    "memory",
  ),
  source(
    "preference_memory",
    "preference_memory",
    "T6",
    "data/memory_store/preference_memory.json",
    "memory",
    { can_be_used_for_style: true },
  ),
  source(
    "working_memory",
    "working_memory",
    "T8",
    "data/memory_store/working_memory.json",
    "working",
  ),
];

const catalogById = new Map(sourceTrustCatalog.map((entry) => [entry.source_id, entry]));
const requiredFields = [
  "source_id",
  "source_type",
  "source_trust_level",
  "source_path",
  "source_version",
  "source_section",
  "canon_status",
  "created_at",
  "updated_at",
  "created_by",
  "approved_by_user",
  "can_be_used_for_canon",
  "can_be_used_for_style",
  "can_be_used_for_error_learning",
  "can_be_used_for_retrieval",
  "forbidden_reason",
];

function isPlaceholder(entry, text) {
  return entry.placeholder_patterns.some((pattern) => pattern.test(text));
}

export function sourceTrustFor(
  sourceId,
  text,
  {
    sourceVersion = "active",
    sourceSection = "whole_file",
    createdAt = "",
    updatedAt = "",
    exists = true,
  } = {},
) {
  const registered = catalogById.get(sourceId);
  const entry = registered ?? source(
    sourceId,
    "unknown",
    "T8",
    "",
    "unknown",
    { can_be_used_for_retrieval: false },
  );
  const placeholder = exists && registered ? isPlaceholder(entry, text) : false;
  const missing = !exists;
  const downgraded = placeholder || missing || !registered;
  const reason = missing
    ? "registered source is missing"
    : placeholder
      ? "placeholder content is not a formal adopted source"
      : !registered
        ? "source is not registered in the trust catalog"
        : "";

  const metadata = {
    ...entry,
    source_trust_level: downgraded ? "T8" : entry.source_trust_level,
    source_version: sourceVersion,
    source_section: sourceSection,
    created_at: createdAt,
    updated_at: updatedAt,
    approved_by_user: downgraded ? false : entry.approved_by_user,
    can_be_used_for_canon: downgraded ? false : entry.can_be_used_for_canon,
    can_be_used_for_style: downgraded ? false : entry.can_be_used_for_style,
    can_be_used_for_error_learning: downgraded
      ? false
      : entry.can_be_used_for_error_learning,
    can_be_used_for_retrieval: registered ? entry.can_be_used_for_retrieval : false,
    forbidden_reason: reason,
  };
  delete metadata.placeholder_patterns;
  return metadata;
}

export function validateSourceTrustMetadata(metadata) {
  const errors = [];
  for (const field of requiredFields) {
    if (!(field in metadata)) {
      errors.push(`missing metadata field: ${field}`);
    }
  }

  if (!/^T[0-9]$/u.test(metadata.source_trust_level ?? "")) {
    errors.push(`invalid source_trust_level: ${metadata.source_trust_level}`);
  }

  for (const field of [
    "approved_by_user",
    "can_be_used_for_canon",
    "can_be_used_for_style",
    "can_be_used_for_error_learning",
    "can_be_used_for_retrieval",
  ]) {
    if (typeof metadata[field] !== "boolean") {
      errors.push(`${field} must be boolean`);
    }
  }

  if (metadata.source_trust_level === "T8" && metadata.can_be_used_for_canon) {
    errors.push("T8 source cannot be used for canon");
  }
  if (metadata.source_trust_level === "T9" && metadata.can_be_used_for_retrieval) {
    errors.push("T9 source cannot be used for retrieval");
  }

  return errors;
}

export function sourcePathFor(entry) {
  return path.join(rootDir, ...entry.source_path.split("/"));
}
