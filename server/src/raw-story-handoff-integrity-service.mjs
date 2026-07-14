import { createHash } from "node:crypto";

export const rawStoryIntegrityManifestVersion = "phase47d-raw-story-integrity-manifest-v1";
export const rawStoryBoundaryWindowCodePoints = 256;
export const rawStoryChunkSizeBytes = 1024;
export const rawStoryMaximumChunkCount = 1024;

const sha256Pattern = /^[a-f0-9]{64}$/u;

function sha256Utf8(value) {
  return createHash("sha256").update(Buffer.from(String(value ?? ""), "utf8")).digest("hex");
}

function newlineMetrics(value) {
  let lfCount = 0;
  let crlfCount = 0;
  let crCount = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\r" && value[index + 1] === "\n") {
      crlfCount += 1;
      index += 1;
    } else if (value[index] === "\r") {
      crCount += 1;
    } else if (value[index] === "\n") {
      lfCount += 1;
    }
  }
  return { lf_count: lfCount, crlf_count: crlfCount, cr_count: crCount };
}

function utf8ChunkHashes(utf8Bytes) {
  const hashes = [];
  for (let start = 0; start < utf8Bytes.length; start += rawStoryChunkSizeBytes) {
    hashes.push(createHash("sha256").update(
      utf8Bytes.subarray(start, start + rawStoryChunkSizeBytes),
    ).digest("hex"));
  }
  return hashes;
}

export function buildRawStoryIntegrityManifest(rawStoryText) {
  if (typeof rawStoryText !== "string") {
    throw new TypeError("raw_story_text must be a string.");
  }
  const codePoints = Array.from(rawStoryText);
  const utf8Bytes = Buffer.from(rawStoryText, "utf8");
  const newlineProfile = newlineMetrics(rawStoryText);
  const newlineCount = newlineProfile.lf_count
    + newlineProfile.crlf_count
    + newlineProfile.cr_count;
  const prefix = codePoints.slice(0, rawStoryBoundaryWindowCodePoints).join("");
  const suffix = codePoints.slice(-rawStoryBoundaryWindowCodePoints).join("");
  return {
    manifest_version: rawStoryIntegrityManifestVersion,
    hash_algorithm: "sha256",
    text_encoding: "utf8",
    exact_sha256: sha256Utf8(rawStoryText),
    js_code_unit_length: rawStoryText.length,
    unicode_code_point_length: codePoints.length,
    utf8_byte_length: utf8Bytes.length,
    line_count: rawStoryText.length === 0 ? 0 : newlineCount + 1,
    newline_profile: newlineProfile,
    nfc_sha256: sha256Utf8(rawStoryText.normalize("NFC")),
    nfd_sha256: sha256Utf8(rawStoryText.normalize("NFD")),
    boundary_window_code_points: rawStoryBoundaryWindowCodePoints,
    prefix_sha256: sha256Utf8(prefix),
    suffix_sha256: sha256Utf8(suffix),
    chunk_size_bytes: rawStoryChunkSizeBytes,
    chunk_sha256: utf8ChunkHashes(utf8Bytes),
  };
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(value, allowedKeys, label) {
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknown.length) throw new Error(`${label} contains unknown fields: ${unknown.join(", ")}.`);
  const missing = allowedKeys.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}

function requireNonnegativeInteger(value, label, maximum) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be an integer from 0 through ${maximum}.`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !sha256Pattern.test(value)) {
    throw new Error(`${label} must be exactly 64 lowercase hexadecimal characters.`);
  }
}

export function validateRawStoryIntegrityManifest(manifest, options = {}) {
  const value = requirePlainObject(manifest, "raw_story_integrity_manifest");
  const keys = [
    "manifest_version",
    "hash_algorithm",
    "text_encoding",
    "exact_sha256",
    "js_code_unit_length",
    "unicode_code_point_length",
    "utf8_byte_length",
    "line_count",
    "newline_profile",
    "nfc_sha256",
    "nfd_sha256",
    "boundary_window_code_points",
    "prefix_sha256",
    "suffix_sha256",
    "chunk_size_bytes",
    "chunk_sha256",
  ];
  requireExactKeys(value, keys, "raw_story_integrity_manifest");
  if (value.manifest_version !== rawStoryIntegrityManifestVersion) {
    throw new Error(`raw_story_integrity_manifest.manifest_version must be ${rawStoryIntegrityManifestVersion}.`);
  }
  if (value.hash_algorithm !== "sha256" || value.text_encoding !== "utf8") {
    throw new Error("raw_story_integrity_manifest must use sha256 over UTF-8 bytes.");
  }
  requireSha256(value.exact_sha256, "raw_story_integrity_manifest.exact_sha256");
  if (options.declared_raw_story_sha256 && value.exact_sha256 !== options.declared_raw_story_sha256) {
    throw new Error("raw_story_integrity_manifest.exact_sha256 must match raw_story_sha256.");
  }
  requireNonnegativeInteger(value.js_code_unit_length, "raw_story_integrity_manifest.js_code_unit_length", 500_000);
  requireNonnegativeInteger(value.unicode_code_point_length, "raw_story_integrity_manifest.unicode_code_point_length", 250_000);
  requireNonnegativeInteger(value.utf8_byte_length, "raw_story_integrity_manifest.utf8_byte_length", 1_000_000);
  requireNonnegativeInteger(value.line_count, "raw_story_integrity_manifest.line_count", 250_001);
  const newlineProfile = requirePlainObject(
    value.newline_profile,
    "raw_story_integrity_manifest.newline_profile",
  );
  requireExactKeys(newlineProfile, ["lf_count", "crlf_count", "cr_count"], "raw_story_integrity_manifest.newline_profile");
  requireNonnegativeInteger(newlineProfile.lf_count, "raw_story_integrity_manifest.newline_profile.lf_count", 250_000);
  requireNonnegativeInteger(newlineProfile.crlf_count, "raw_story_integrity_manifest.newline_profile.crlf_count", 250_000);
  requireNonnegativeInteger(newlineProfile.cr_count, "raw_story_integrity_manifest.newline_profile.cr_count", 250_000);
  for (const field of ["nfc_sha256", "nfd_sha256", "prefix_sha256", "suffix_sha256"]) {
    requireSha256(value[field], `raw_story_integrity_manifest.${field}`);
  }
  if (value.boundary_window_code_points !== rawStoryBoundaryWindowCodePoints) {
    throw new Error(`raw_story_integrity_manifest.boundary_window_code_points must be ${rawStoryBoundaryWindowCodePoints}.`);
  }
  if (value.chunk_size_bytes !== rawStoryChunkSizeBytes) {
    throw new Error(`raw_story_integrity_manifest.chunk_size_bytes must be ${rawStoryChunkSizeBytes}.`);
  }
  if (!Array.isArray(value.chunk_sha256) || value.chunk_sha256.length > rawStoryMaximumChunkCount) {
    throw new Error(`raw_story_integrity_manifest.chunk_sha256 must contain at most ${rawStoryMaximumChunkCount} items.`);
  }
  for (const [index, hash] of value.chunk_sha256.entries()) {
    requireSha256(hash, `raw_story_integrity_manifest.chunk_sha256[${index}]`);
  }
  const expectedChunkCount = Math.ceil(value.utf8_byte_length / rawStoryChunkSizeBytes);
  if (value.chunk_sha256.length !== expectedChunkCount) {
    throw new Error("raw_story_integrity_manifest chunk count must match utf8_byte_length and chunk_size_bytes.");
  }
  return value;
}

function sameNewlineProfile(left, right) {
  return left.lf_count === right.lf_count
    && left.crlf_count === right.crlf_count
    && left.cr_count === right.cr_count;
}

function buildChunkComparison(declaredManifest, receivedManifest) {
  const declaredChunks = declaredManifest.chunk_sha256;
  const receivedChunks = receivedManifest.chunk_sha256;
  const commonCount = Math.min(declaredChunks.length, receivedChunks.length);
  let matchingPrefixChunkCount = 0;
  while (
    matchingPrefixChunkCount < commonCount
    && declaredChunks[matchingPrefixChunkCount] === receivedChunks[matchingPrefixChunkCount]
  ) {
    matchingPrefixChunkCount += 1;
  }
  const allCommonChunksMatch = matchingPrefixChunkCount === commonCount;
  const firstMismatchingChunkIndex = allCommonChunksMatch
    ? (declaredChunks.length === receivedChunks.length ? null : commonCount)
    : matchingPrefixChunkCount;
  const approximateStart = firstMismatchingChunkIndex === null
    ? null
    : firstMismatchingChunkIndex * rawStoryChunkSizeBytes;
  const maximumLength = Math.max(
    declaredManifest.utf8_byte_length,
    receivedManifest.utf8_byte_length,
  );
  return {
    chunk_size_bytes: rawStoryChunkSizeBytes,
    declared_chunk_count: declaredChunks.length,
    received_chunk_count: receivedChunks.length,
    first_mismatching_chunk_index: firstMismatchingChunkIndex,
    matching_prefix_chunk_count: matchingPrefixChunkCount,
    approximate_mismatch_byte_window_start: approximateStart,
    approximate_mismatch_byte_window_end: approximateStart === null
      ? null
      : Math.min(approximateStart + rawStoryChunkSizeBytes, maximumLength),
    location_semantics: "Approximate zero-based UTF-8 byte chunk window only; this is not an exact first-differing-byte offset, and insertion or deletion can shift every later chunk.",
  };
}

export function buildRawStoryMismatchForensics(input = {}) {
  if (typeof input.received_raw_story_text !== "string") {
    throw new TypeError("received_raw_story_text must be a string.");
  }
  const receivedMetrics = buildRawStoryIntegrityManifest(input.received_raw_story_text);
  if (input.declared_manifest === undefined || input.declared_manifest === null) {
    return {
      diagnostics_available: true,
      declared_manifest_present: false,
      received_metrics: receivedMetrics,
      comparisons: null,
      chunk_localization: {
        chunk_size_bytes: rawStoryChunkSizeBytes,
        declared_chunk_count: null,
        received_chunk_count: receivedMetrics.chunk_sha256.length,
        first_mismatching_chunk_index: null,
        matching_prefix_chunk_count: null,
        approximate_mismatch_byte_window_start: null,
        approximate_mismatch_byte_window_end: null,
        location_semantics: "Caller chunk evidence is absent; no mismatch byte window can be inferred.",
      },
      classifications: {
        possible_newline_representation_difference: false,
        possible_unicode_normalization_difference: false,
        possible_boundary_mutation: false,
        possible_internal_content_mutation: false,
        length_difference_detected: false,
        insufficient_forensic_evidence: true,
      },
    };
  }

  const declaredManifest = validateRawStoryIntegrityManifest(input.declared_manifest, {
    declared_raw_story_sha256: input.declared_raw_story_sha256,
  });
  const comparisons = {
    js_code_unit_length_match: declaredManifest.js_code_unit_length === receivedMetrics.js_code_unit_length,
    unicode_code_point_length_match: declaredManifest.unicode_code_point_length === receivedMetrics.unicode_code_point_length,
    utf8_byte_length_match: declaredManifest.utf8_byte_length === receivedMetrics.utf8_byte_length,
    line_count_match: declaredManifest.line_count === receivedMetrics.line_count,
    newline_profile_match: sameNewlineProfile(declaredManifest.newline_profile, receivedMetrics.newline_profile),
    nfc_hash_match: declaredManifest.nfc_sha256 === receivedMetrics.nfc_sha256,
    nfd_hash_match: declaredManifest.nfd_sha256 === receivedMetrics.nfd_sha256,
    prefix_hash_match: declaredManifest.prefix_sha256 === receivedMetrics.prefix_sha256,
    suffix_hash_match: declaredManifest.suffix_sha256 === receivedMetrics.suffix_sha256,
  };
  const chunkLocalization = buildChunkComparison(declaredManifest, receivedMetrics);
  const possibleUnicodeNormalizationDifference = comparisons.nfc_hash_match
    || comparisons.nfd_hash_match;
  const possibleNewlineRepresentationDifference = !comparisons.newline_profile_match;
  const possibleBoundaryMutation = !comparisons.prefix_hash_match
    || !comparisons.suffix_hash_match;
  const lengthDifferenceDetected = !comparisons.js_code_unit_length_match
    || !comparisons.unicode_code_point_length_match
    || !comparisons.utf8_byte_length_match;
  const possibleInternalContentMutation = comparisons.prefix_hash_match
    && comparisons.suffix_hash_match
    && chunkLocalization.first_mismatching_chunk_index !== null
    && !possibleUnicodeNormalizationDifference
    && !possibleNewlineRepresentationDifference;
  return {
    diagnostics_available: true,
    declared_manifest_present: true,
    received_metrics: receivedMetrics,
    comparisons,
    chunk_localization: chunkLocalization,
    classifications: {
      possible_newline_representation_difference: possibleNewlineRepresentationDifference,
      possible_unicode_normalization_difference: possibleUnicodeNormalizationDifference,
      possible_boundary_mutation: possibleBoundaryMutation,
      possible_internal_content_mutation: possibleInternalContentMutation,
      length_difference_detected: lengthDifferenceDetected,
      insufficient_forensic_evidence: false,
    },
  };
}
