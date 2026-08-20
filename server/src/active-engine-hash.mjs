import { createHash } from "node:crypto";

export function normalizeLfText(content) {
  return content
    .toString("utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
}

export function calculateSha256Lf(content) {
  return createHash("sha256")
    .update(normalizeLfText(content), "utf8")
    .digest("hex")
    .toUpperCase();
}
