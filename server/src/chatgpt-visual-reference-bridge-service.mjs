import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
} from "./project-paths.mjs";

const visualIndexPath = path.join(
  projectRoot,
  "data",
  "visual_db",
  "visual_index.jsonl",
);

const visualAssetsRoot = path.join(
  projectRoot,
  "data",
  "visual_db",
  "assets",
);

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 20;

const mimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function requireObject(value, label = "arguments") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function optionalString(value, label) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value.trim();
}

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function normalizeIndexedPath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\/+/u, "");
}

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = mimeByExtension.get(extension);

  if (!mimeType) {
    throw new Error(
      `Unsupported visual asset type: ${extension || "(no extension)"}`,
    );
  }

  return mimeType;
}

function recordSearchText(record) {
  return [
    record.visual_id,
    record.character,
    record.entity,
    record.category,
    record.title,
    record.status,
    record.canon_status,
    record.source,
    record.description,
    record.notes,
    record.ability_state,
    ...(Array.isArray(record.tags) ? record.tags : []),
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value))
    .join("\n")
    .toLocaleLowerCase();
}

function includesNormalized(actual, expected) {
  if (!expected) return true;
  return normalizeSearchText(actual).includes(normalizeSearchText(expected));
}

function metadataFromRecord(record) {
  let mimeType = null;

  try {
    mimeType = mimeTypeForPath(record.path);
  } catch {
    mimeType = null;
  }

  return {
    visual_id: record.visual_id ?? null,
    character: record.character ?? record.entity ?? null,
    category: record.category ?? null,
    title: record.title ?? null,
    status: record.status ?? null,
    canon_status: record.canon_status ?? null,
    trust_level: record.trust_level ?? null,
    source: record.source ?? null,
    path: record.path ?? null,
    mime_type: mimeType,
    description: record.description ?? "",
    notes: record.notes ?? "",
    ability_state: record.ability_state ?? null,
    tags: Array.isArray(record.tags) ? record.tags : [],
  };
}

export async function loadVisualIndexRecords() {
  const text = await readFile(visualIndexPath, "utf8");

  const records = [];

  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    try {
      const record = JSON.parse(line);

      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("record must be an object");
      }

      records.push(record);
    } catch (error) {
      throw new Error(
        `Invalid visual index JSONL at line ${index + 1}: ${error.message}`,
      );
    }
  }

  return records;
}

async function resolveSafeVisualAssetPath(rawPath) {
  const candidate = optionalString(rawPath, "asset_path");

  if (!candidate) {
    throw new Error("asset_path must be a non-empty string.");
  }

  if (path.isAbsolute(candidate)) {
    throw new Error("asset_path must be project-relative.");
  }

  const assetRootResolved = path.resolve(visualAssetsRoot);
  const candidateResolved = path.resolve(projectRoot, candidate);

  /*
   * First perform lexical containment checking.
   * This rejects ../ traversal before touching the filesystem.
   */
  const lexicalRelative = path.relative(
    assetRootResolved,
    candidateResolved,
  );

  if (
    lexicalRelative === ".." ||
    lexicalRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(lexicalRelative)
  ) {
    throw new Error(
      "asset_path escapes data/visual_db/assets.",
    );
  }

  let assetRootReal;
  let candidateReal;

  try {
    assetRootReal = await realpath(assetRootResolved);
  } catch (error) {
    throw new Error(
      `Visual asset root is unavailable: ${error.message}`,
    );
  }

  try {
    candidateReal = await realpath(candidateResolved);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Visual asset does not exist.");
    }
    throw error;
  }

  /*
   * Perform containment checking again after realpath so symlinks
   * cannot escape the visual asset root.
   */
  const realRelative = path.relative(
    assetRootReal,
    candidateReal,
  );

  if (
    realRelative === ".." ||
    realRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(realRelative)
  ) {
    throw new Error(
      "Resolved visual asset escapes data/visual_db/assets.",
    );
  }

  const fileStat = await stat(candidateReal);

  if (!fileStat.isFile()) {
    throw new Error("Visual asset is not a file.");
  }

  if (fileStat.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Visual asset exceeds ${MAX_IMAGE_BYTES} byte limit.`,
    );
  }

  return {
    absolutePath: candidateReal,
    projectPath: normalizeProjectPath(candidateReal),
    bytes: fileStat.size,
  };
}

export async function chatgptBridgeSearchVisualAssets(input = {}) {
  requireObject(input);

  const query = optionalString(input.query, "query");
  const character = optionalString(
    input.character ?? input.entity,
    "character",
  );
  const category = optionalString(input.category, "category");
  const status = optionalString(input.status, "status");
  const title = optionalString(input.title, "title");

  const rawLimit = input.limit ?? DEFAULT_SEARCH_LIMIT;

  if (
    !Number.isInteger(rawLimit) ||
    rawLimit < 1 ||
    rawLimit > MAX_SEARCH_LIMIT
  ) {
    throw new Error(
      `limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}.`,
    );
  }

  const records = await loadVisualIndexRecords();

  const queryNormalized = normalizeSearchText(query);

  const matches = records.filter((record) => {
    if (
      queryNormalized &&
      !recordSearchText(record).includes(queryNormalized)
    ) {
      return false;
    }

    if (
      character &&
      !includesNormalized(
        record.character ?? record.entity,
        character,
      )
    ) {
      return false;
    }

    if (
      category &&
      !includesNormalized(record.category, category)
    ) {
      return false;
    }

    if (
      status &&
      !includesNormalized(
        record.status ?? record.canon_status,
        status,
      )
    ) {
      return false;
    }

    if (
      title &&
      !includesNormalized(record.title, title)
    ) {
      return false;
    }

    return true;
  });

  return {
    ok: true,
    tool_name: "chatgpt_bridge_search_visual_assets",
    permission: "read_only",
    index_source: normalizeProjectPath(visualIndexPath),
    total_index_records: records.length,
    matched_records: matches.length,
    returned_records: Math.min(matches.length, rawLimit),
    results: matches
      .slice(0, rawLimit)
      .map(metadataFromRecord),
  };
}

export async function chatgptBridgeGetVisualAsset(input = {}) {
  requireObject(input);

  const visualId = optionalString(
    input.visual_id ?? input.visualId,
    "visual_id",
  );

  const requestedAssetPath = optionalString(
    input.asset_path ?? input.assetPath,
    "asset_path",
  );

  if (!visualId && !requestedAssetPath) {
    throw new Error(
      "Either visual_id or asset_path is required.",
    );
  }

  const records = await loadVisualIndexRecords();
  let record = null;
  let resolvedAsset = null;

  if (visualId) {
    record = records.find(
      (candidate) =>
        String(candidate.visual_id ?? "")
          .toLocaleLowerCase() ===
        visualId.toLocaleLowerCase(),
    );

    if (!record) {
      throw new Error(
        `Unknown visual_id: ${visualId}`,
      );
    }

    if (!record.path) {
      throw new Error(
        `Visual index record has no asset path: ${visualId}`,
      );
    }

    resolvedAsset = await resolveSafeVisualAssetPath(record.path);
  } else {
    /*
     * Validate the supplied path before attempting index matching.
     * This makes traversal attempts fail explicitly.
     */
    resolvedAsset = await resolveSafeVisualAssetPath(
      requestedAssetPath,
    );

    const normalizedRequestedPath = normalizeIndexedPath(
      resolvedAsset.projectPath,
    );

    record = records.find(
      (candidate) =>
        normalizeIndexedPath(candidate.path) ===
        normalizedRequestedPath,
    );

    if (!record) {
      throw new Error(
        "asset_path is not registered in visual_index.jsonl.",
      );
    }
  }

  const mimeType = mimeTypeForPath(resolvedAsset.absolutePath);
  const buffer = await readFile(resolvedAsset.absolutePath);

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Visual asset exceeds ${MAX_IMAGE_BYTES} byte limit.`,
    );
  }

  const metadata = {
    ok: true,
    tool_name: "chatgpt_bridge_get_visual_asset",
    permission: "read_only",
    visual_reference_only: true,
    visual_id: record.visual_id ?? null,
    character: record.character ?? record.entity ?? null,
    category: record.category ?? null,
    title: record.title ?? null,
    status: record.status ?? null,
    canon_status: record.canon_status ?? null,
    trust_level: record.trust_level ?? null,
    source: record.source ?? null,
    path: resolvedAsset.projectPath,
    mime_type: mimeType,
    bytes: buffer.length,
    ability_state: record.ability_state ?? null,
    notes: record.notes ?? "",
    description: record.description ?? "",
    tags: Array.isArray(record.tags) ? record.tags : [],
    safety: {
      read_only: true,
      writes_visual_index: false,
      writes_visual_assets: false,
      updates_active_engine: false,
      updates_canon_db: false,
    },
  };

  /*
   * IMPORTANT:
   * This function returns an MCP ToolResult directly.
   * Do NOT pass this through jsonContent().
   */
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(metadata, null, 2),
      },
      {
        type: "image",
        data: buffer.toString("base64"),
        mimeType,
      },
    ],
  };
}

export const visualChatgptBridgeInfo = Object.freeze({
  visual_index_path: normalizeProjectPath(visualIndexPath),
  visual_assets_root: normalizeProjectPath(visualAssetsRoot),
  max_image_bytes: MAX_IMAGE_BYTES,
  supported_mime_types: [...new Set(mimeByExtension.values())],
  read_only: true,
});
