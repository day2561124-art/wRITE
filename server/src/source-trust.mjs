import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  registeredSources,
} from "./source-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, "..", "..");

const source = (entry) => ({
  source_id: entry.source_id,
  source_type: entry.source_type,
  source_trust_level: entry.source_trust_level,
  source_path: entry.source_path,
  canon_status: entry.canon_status,
  created_by: "repository",
  approved_by_user: entry.source_trust_level === "T1" || entry.source_trust_level === "T3",
  can_be_used_for_canon: entry.can_be_used_for_canon,
  can_be_used_for_style: entry.can_be_used_for_style,
  can_be_used_for_error_learning: entry.can_be_used_for_error_learning,
  can_be_used_for_retrieval: entry.can_be_used_for_retrieval,
  forbidden_reason: "",
  placeholder_patterns: entry.placeholder_patterns,
});

export const sourceTrustCatalog = registeredSources.map(source);

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
  const entry = registered ?? {
    ...source({
      source_id: sourceId,
      source_type: "unknown",
      source_trust_level: "T8",
      source_path: "",
      canon_status: "unknown",
      can_be_used_for_canon: false,
      can_be_used_for_style: false,
      can_be_used_for_error_learning: false,
      can_be_used_for_retrieval: false,
      placeholder_patterns: [],
    }),
  };
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
