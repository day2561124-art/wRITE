import assert from "node:assert/strict";

import {
  chatgptBridgeGetVisualAsset,
  chatgptBridgeSearchVisualAssets,
  visualChatgptBridgeInfo,
} from "./chatgpt-visual-reference-bridge-service.mjs";

const pngSignature = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);

console.log("=== Visual ChatGPT Bridge Smoke Test ===");

const search = await chatgptBridgeSearchVisualAssets({
  query: "柊木璃央",
  limit: 10,
});

assert.equal(search.ok, true);
assert(search.total_index_records > 0);
assert(search.results.length > 0);

const rio = search.results.find(
  (record) => record.character === "柊木璃央",
);

assert(rio, "柊木璃央 visual record not found.");
assert(rio.visual_id);
assert(rio.path);

console.log("index source:", search.index_source);
console.log("records found:", search.results.length);
console.log("tested visual id:", rio.visual_id);
console.log("asset path:", rio.path);

const toolResult = await chatgptBridgeGetVisualAsset({
  visual_id: rio.visual_id,
});

assert(toolResult);
assert(Array.isArray(toolResult.content));

const textPart = toolResult.content.find(
  (part) => part.type === "text",
);

const imagePart = toolResult.content.find(
  (part) => part.type === "image",
);

assert(textPart, "text metadata content missing.");
assert(imagePart, "native image content missing.");
assert.equal(imagePart.mimeType, "image/png");
assert(
  typeof imagePart.data === "string" &&
  imagePart.data.length > 0,
  "image base64 payload missing.",
);

const decoded = Buffer.from(imagePart.data, "base64");

assert(decoded.length > pngSignature.length);

assert(
  decoded.subarray(0, pngSignature.length).equals(pngSignature),
  "PNG magic bytes do not match.",
);

console.log("mime type:", imagePart.mimeType);
console.log("decoded bytes:", decoded.length);
console.log("native image content returned: true");

let traversalRejected = false;

try {
  await chatgptBridgeGetVisualAsset({
    asset_path: "../../package.json",
  });
} catch (error) {
  traversalRejected = true;
  console.log("path traversal rejection:", error.message);
}

assert.equal(
  traversalRejected,
  true,
  "Path traversal attempt was not rejected.",
);

console.log("path traversal guard: PASS");

let nonexistentRejected = false;

try {
  await chatgptBridgeGetVisualAsset({
    visual_id: "VIS-DOES-NOT-EXIST",
  });
} catch (error) {
  nonexistentRejected = true;
  console.log("nonexistent asset handling:", error.message);
}

assert.equal(
  nonexistentRejected,
  true,
  "Nonexistent visual_id was not rejected.",
);

const searchSerialized = JSON.stringify(search);

assert(
  !searchSerialized.includes('"type":"image"'),
  "Search result unexpectedly contains native image payload.",
);

console.log("search contains image payload: false");

console.log("");
console.log("VISUAL CHATGPT BRIDGE: PASS");
console.log("");
console.log(
  JSON.stringify(
    {
      ...visualChatgptBridgeInfo,
      tested_visual_id: rio.visual_id,
      tested_asset_path: rio.path,
      mime_type: imagePart.mimeType,
      decoded_bytes: decoded.length,
      native_image_content_returned: true,
      path_traversal_guard: "PASS",
    },
    null,
    2,
  ),
);
