import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";

export const canonZoneConfigPath = path.join(
  projectRoot,
  "config",
  "canon-zones.json",
);

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

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function sha256Lf(value) {
  return createHash("sha256")
    .update(normalizeLf(value), "utf8")
    .digest("hex")
    .toUpperCase();
}

function anchorOffsets(text, anchor) {
  const lines = text.split("\n");
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    if (line === anchor) offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

function resolveAnchor(text, anchor, boundary) {
  if (anchor === boundary) return boundary === "BOF" ? 0 : text.length;
  const offsets = anchorOffsets(text, anchor);
  if (offsets.length === 0) throw new Error(`Canon zone anchor not found: ${anchor}`);
  if (offsets.length > 1) throw new Error(`Canon zone anchor is not unique: ${anchor}`);
  return offsets[0];
}

function lineNumberAtOffset(text, offset) {
  if (offset <= 0) return 1;
  return text.slice(0, offset).split("\n").length;
}

export function validateCanonZoneConfig(config) {
  requireObject(config, "canon zone config");
  if (config.schema_version !== 1) {
    throw new Error("canon zone config schema_version must be 1.");
  }
  if (config.source_component !== "canon_data") {
    throw new Error("canon zone config source_component must be canon_data.");
  }
  requireString(config.source_path, "source_path");
  const expectedHash = requireString(config.expected_sha256_lf, "expected_sha256_lf");
  if (!/^[A-F0-9]{64}$/u.test(expectedHash)) {
    throw new Error("expected_sha256_lf must be an uppercase SHA-256.");
  }
  if (config.mode !== "read_only_preview") {
    throw new Error("canon zone config mode must be read_only_preview.");
  }
  if (!Array.isArray(config.zones) || config.zones.length === 0) {
    throw new Error("canon zone config zones must be a non-empty array.");
  }
  const ids = new Set();
  config.zones.forEach((zone, index) => {
    requireObject(zone, `zones[${index}]`);
    const id = requireString(zone.id, `zones[${index}].id`);
    if (ids.has(id)) throw new Error(`Duplicate canon zone id: ${id}`);
    ids.add(id);
    requireString(zone.label, `zones[${index}].label`);
    requireString(zone.start, `zones[${index}].start`);
    requireString(zone.end_before, `zones[${index}].end_before`);
    requireString(zone.component_hint, `zones[${index}].component_hint`);
    if (zone.update_policy !== "preview_only") {
      throw new Error(`zones[${index}].update_policy must be preview_only.`);
    }
  });
  if (config.zones[0].start !== "BOF") {
    throw new Error("The first canon zone must start at BOF.");
  }
  if (config.zones.at(-1).end_before !== "EOF") {
    throw new Error("The final canon zone must end before EOF.");
  }
  return config;
}

export async function loadCanonZoneConfig(options = {}) {
  if (options.config) {
    return {
      config: validateCanonZoneConfig(structuredClone(options.config)),
      config_path: null,
    };
  }
  const configPath = options.configPath
    ? resolveProjectPath(options.configPath, "canon zone config")
    : canonZoneConfigPath;
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return {
    config: validateCanonZoneConfig(config),
    config_path: normalizeProjectPath(configPath),
  };
}

export function compileCanonZonesPreview(preview) {
  requireObject(preview, "canon zone preview");
  if (!Array.isArray(preview.zones)) {
    throw new Error("canon zone preview zones must be an array.");
  }
  const parts = preview.zones.map((zone) => {
    if (typeof zone.content !== "string") {
      throw new Error(`Canon zone content is unavailable: ${zone.id ?? "unknown"}`);
    }
    return zone.content;
  });
  return parts.join("");
}

export async function buildCanonZonePreview(options = {}) {
  const { config, config_path: configPath } = await loadCanonZoneConfig(options);
  const sourcePath = options.sourcePath
    ? resolveProjectPath(options.sourcePath, "canon zone source")
    : resolveProjectPath(config.source_path, "canon zone source");
  const sourceText = normalizeLf(
    options.sourceText ?? await readFile(sourcePath, "utf8"),
  );
  const sourceHash = sha256Lf(sourceText);
  if (sourceHash !== config.expected_sha256_lf) {
    throw new Error(
      `Canon zone source hash mismatch: expected ${config.expected_sha256_lf}, got ${sourceHash}.`,
    );
  }

  const zones = [];
  let previousEnd = 0;
  for (const zoneConfig of config.zones) {
    const startOffset = resolveAnchor(sourceText, zoneConfig.start, "BOF");
    const endOffset = resolveAnchor(sourceText, zoneConfig.end_before, "EOF");
    if (startOffset !== previousEnd) {
      throw new Error(
        `Canon zones must be continuous: ${zoneConfig.id} starts at ${startOffset}, expected ${previousEnd}.`,
      );
    }
    if (endOffset <= startOffset) {
      throw new Error(`Canon zone order is invalid: ${zoneConfig.id}.`);
    }
    const content = sourceText.slice(startOffset, endOffset);
    const zone = {
      id: zoneConfig.id,
      label: zoneConfig.label,
      start_line: lineNumberAtOffset(sourceText, startOffset),
      end_line: lineNumberAtOffset(sourceText, endOffset - 1),
      start_offset: startOffset,
      end_offset: endOffset,
      chars: content.length,
      sha256_lf: sha256Lf(content),
      start: zoneConfig.start,
      end_before: zoneConfig.end_before,
      component_hint: zoneConfig.component_hint,
      update_policy: zoneConfig.update_policy,
    };
    Object.defineProperty(zone, "content", {
      value: content,
      enumerable: false,
      writable: false,
    });
    zones.push(zone);
    previousEnd = endOffset;
  }
  if (previousEnd !== sourceText.length) {
    throw new Error(
      `Canon zones do not cover EOF: ended at ${previousEnd}, source length ${sourceText.length}.`,
    );
  }

  const preview = {
    schema_version: config.schema_version,
    mode: config.mode,
    read_only: true,
    source_component: config.source_component,
    source_path: normalizeProjectPath(sourcePath),
    config_path: configPath,
    source_sha256_lf: sourceHash,
    expected_sha256_lf: config.expected_sha256_lf,
    hash_matches: sourceHash === config.expected_sha256_lf,
    roundtrip_sha256_lf: null,
    roundtrip_matches_source: false,
    zones,
    warnings: [],
    blocking_warnings: [],
  };
  const roundtripText = compileCanonZonesPreview(preview);
  preview.roundtrip_sha256_lf = sha256Lf(roundtripText);
  preview.roundtrip_matches_source = roundtripText === sourceText;
  if (!preview.roundtrip_matches_source) {
    preview.blocking_warnings.push("roundtrip_content_mismatch");
  }
  if (preview.roundtrip_sha256_lf !== sourceHash) {
    preview.blocking_warnings.push("roundtrip_hash_mismatch");
  }
  return preview;
}
