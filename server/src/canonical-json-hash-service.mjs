import { createHash } from "node:crypto";

function canonicalJson(value, ancestors = new Set()) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Cannot hash a non-finite number.");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") throw new TypeError("Cannot hash a BigInt value.");
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Cannot hash a ${typeof value} value.`);
  }
  if (ancestors.has(value)) throw new TypeError("Cannot hash a circular value.");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Cannot hash a non-plain object.");
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], ancestors)}`)
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function stableSerializeCanonicalValue(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return value;
  return canonicalJson(value);
}

export function hashCanonicalValue(value) {
  return createHash("sha256")
    .update(stableSerializeCanonicalValue(value))
    .digest("hex");
}
