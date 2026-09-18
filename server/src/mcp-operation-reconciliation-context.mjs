import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

export const MCP_RECONCILIATION_KEY_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$";
const reconciliationKeyPattern = new RegExp(MCP_RECONCILIATION_KEY_PATTERN_SOURCE, "u");
const contextStorage = new AsyncLocalStorage();

function canonicalJson(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Reconciliation fingerprint does not allow non-finite numbers.");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error("Reconciliation fingerprint supports JSON values only.");
}

export function normalizeMcpReconciliationKey(value, { optional = true } = {}) {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw new Error("reconciliation_key is required.");
  }
  if (typeof value !== "string") throw new Error("reconciliation_key must be a string.");
  const normalized = value.trim();
  if (!reconciliationKeyPattern.test(normalized)) {
    throw new Error("reconciliation_key must be 8-128 characters and contain only letters, digits, '.', '_', ':', or '-'.");
  }
  return normalized;
}

export function fingerprintMcpMutationRequest(toolName, args) {
  if (typeof toolName !== "string" || !toolName) throw new Error("toolName is required for reconciliation fingerprinting.");
  return createHash("sha256")
    .update(canonicalJson({ tool_name: toolName, arguments: args ?? {} }), "utf8")
    .digest("hex");
}

export function runWithMcpOperationReconciliationContext(context, callback) {
  const reconciliationKey = normalizeMcpReconciliationKey(context?.reconciliation_key, { optional: true });
  const requestFingerprint = context?.request_fingerprint_sha256 ?? null;
  if (requestFingerprint !== null && !/^[a-f0-9]{64}$/u.test(requestFingerprint)) {
    throw new Error("request_fingerprint_sha256 is invalid.");
  }
  if ((reconciliationKey === null) !== (requestFingerprint === null)) throw new Error("Reconciliation identity must be complete.");
  const toolName = typeof context?.tool_name === "string" ? context.tool_name : null;
  return contextStorage.run({
    reconciliation_key: reconciliationKey,
    request_fingerprint_sha256: requestFingerprint,
    tool_name: toolName,
    operation_id: null,
  }, callback);
}

export function getMcpOperationReconciliationContext() {
  return contextStorage.getStore() ?? null;
}
