import Ajv2020 from "ajv/dist/2020.js";
import { hashExecutionInput } from "./pi-execution-contract.mjs";

// Read-only bounded metadata; no filesystem reads, dispatch or automatic tool selection.
// Definitions and availability are trusted host bindings, never API inputs.
const namePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,5}$/u;
const versionPattern = /^[1-9][0-9]{0,2}(?:\.[0-9]{1,3}){0,2}$/u;
const riskClasses = new Set(["read", "low-risk-write", "high-risk-write"]);
const routePolicies = new Set(["pi_default_intent", "diagnostic_read_only"]);
const schemaKeywords = new Set([
  "type", "properties", "required", "additionalProperties", "items", "prefixItems",
  "minItems", "maxItems", "uniqueItems", "minLength", "maxLength", "minimum", "maximum",
  "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "enum", "const", "pattern",
  "anyOf", "oneOf", "allOf", "not", "if", "then", "else", "format",
  "x-allow-empty", "minProperties", "maxProperties", "dependentRequired", "propertyNames",
]);
const decisionCodes = new Set([
  "UNKNOWN_CAPABILITY", "UNSUPPORTED_SCHEMA_VERSION", "CAPABILITY_UNAVAILABLE",
  "CAPABILITY_STATUS_UNCERTAIN", "CAPABILITY_NOT_DISPATCHABLE", "CAPABILITY_DEPRECATED",
  "CAPABILITY_EXPECTATION_REQUIRED", "CAPABILITY_VERSION_DRIFT", "CAPABILITY_SCHEMA_DRIFT",
]);
function fail(code) {
  throw Object.assign(new Error(code), { code, decision_required: decisionCodes.has(code) });
}
function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exact(value, required, optional = []) {
  if (!plain(value) || required.some(k => !Object.hasOwn(value, k))
    || Object.keys(value).some(k => ![...required, ...optional].includes(k))) fail("INVALID_CAPABILITY_CONTRACT");
  for (const key of Object.keys(value)) {
    const p = Object.getOwnPropertyDescriptor(value, key);
    if (!p || !("value" in p)) fail("INVALID_CAPABILITY_CONTRACT");
  }
}
function copyJson(value, maxBytes = 65536) {
  let nodes = 0;
  const visit = (v, depth) => {
    if (++nodes > 4096 || depth > 24) fail("CAPABILITY_CONTRACT_LIMIT");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && Buffer.byteLength(v, "utf8") <= 8192) return v;
    if (Array.isArray(v)) {
      if (v.length > 512 || Object.keys(v).length !== v.length) fail("INVALID_CAPABILITY_CONTRACT");
      const output = [];
      for (let i = 0; i < v.length; i++) {
        const p = Object.getOwnPropertyDescriptor(v, String(i));
        if (!p || !("value" in p)) fail("INVALID_CAPABILITY_CONTRACT");
        output.push(visit(p.value, depth + 1));
      }
      return output;
    }
    if (!plain(v)) fail("INVALID_CAPABILITY_CONTRACT");
    const output = Object.create(null);
    for (const key of Object.keys(v).sort()) {
      if (["__proto__", "prototype", "constructor"].includes(key)) fail("INVALID_CAPABILITY_CONTRACT");
      const p = Object.getOwnPropertyDescriptor(v, key);
      if (!p || !("value" in p)) fail("INVALID_CAPABILITY_CONTRACT");
      output[key] = visit(p.value, depth + 1);
    }
    return output;
  };
  const result = visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > maxBytes) fail("CAPABILITY_CONTRACT_LIMIT");
  return result;
}
export const hashCapabilityContract = value => hashExecutionInput(copyJson(value));
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const publicSchemaValidator = new Ajv2020({
  strict: false, allErrors: true, validateSchema: true, validateFormats: false,
  coerceTypes: false, useDefaults: false, removeAdditional: false,
});
function schema(value) {
  const result = copyJson(value, 24576);
  // Public metadata policy remains ours; JSON Schema syntax is delegated to Ajv.
  // Permissions, lifecycle admission and tool argument semantics are unchanged.
  function checkPublicationPolicy(s) {
    if (typeof s === "boolean") return;
    if (!plain(s)) fail("INVALID_CAPABILITY_SCHEMA");
    if (Object.keys(s).some(k => !schemaKeywords.has(k))) fail("UNSUPPORTED_PUBLIC_SCHEMA");
    if (s["x-allow-empty"] !== undefined && typeof s["x-allow-empty"] !== "boolean") fail("INVALID_CAPABILITY_SCHEMA");
    if (Array.isArray(s.enum) && (!s.enum.length
      || new Set(s.enum.map(hashCapabilityContract)).size !== s.enum.length)) fail("INVALID_CAPABILITY_SCHEMA");
    if (plain(s.properties)) Object.values(s.properties).forEach(checkPublicationPolicy);
    for (const key of ["items", "additionalProperties", "not", "if", "then", "else", "propertyNames"]) {
      if (s[key] !== undefined) checkPublicationPolicy(s[key]);
    }
    for (const key of ["anyOf", "oneOf", "allOf", "prefixItems"]) {
      if (Array.isArray(s[key])) s[key].forEach(checkPublicationPolicy);
    }
  }
  checkPublicationPolicy(result);
  if (!publicSchemaValidator.validateSchema(result) || !plain(result) || result.type !== "object")
    fail("INVALID_CAPABILITY_SCHEMA");
  return freeze(result);
}
function checkName(value) {
  if (typeof value !== "string" || value.length > 128 || !namePattern.test(value)) fail("INVALID_CAPABILITY_NAME");
}
function checkVersion(value) {
  if (typeof value !== "string" || !versionPattern.test(value)) fail("INVALID_CAPABILITY_VERSION");
}
function boundedResponse(value) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 65536) fail("CAPABILITY_RESPONSE_LIMIT");
  return freeze(copyJson(value));
}

export function createPiCapabilityIntrospection({ definitions, availability = () => "available" } = {}) {
  if (!Array.isArray(definitions) || !definitions.length || definitions.length > 128
    || typeof availability !== "function") fail("INVALID_CAPABILITY_HOST_BINDING");
  const registry = new Map();
  for (const source of definitions) {
    const entry = copyJson(source);
    exact(entry, ["capability_name", "active_version", "versions"]);
    checkName(entry.capability_name); checkVersion(entry.active_version);
    if (registry.has(entry.capability_name) || !Array.isArray(entry.versions)
      || !entry.versions.length || entry.versions.length > 8) fail("INVALID_CAPABILITY_HOST_BINDING");
    const versions = new Map();
    const supported = entry.versions.map(v => {
      if (!plain(v)) fail("INVALID_CAPABILITY_CONTRACT");
      checkVersion(v.capability_version);
      return v.capability_version;
    }).sort();
    for (const v of entry.versions) {
      exact(v, ["capability_version", "risk_class", "input_schema", "output_schema",
        "deprecated", "replacement_capability", "route_policy", "pi_dispatchable"]);
      checkVersion(v.capability_version);
      if (versions.has(v.capability_version) || !riskClasses.has(v.risk_class)
        || !routePolicies.has(v.route_policy) || typeof v.deprecated !== "boolean"
        || typeof v.pi_dispatchable !== "boolean") fail("INVALID_CAPABILITY_HOST_BINDING");
      if (v.replacement_capability !== null) checkName(v.replacement_capability);
      if ((!v.deprecated && v.replacement_capability !== null)
        || (v.route_policy === "diagnostic_read_only" && v.risk_class !== "read")) fail("INVALID_CAPABILITY_HOST_BINDING");
      const input = schema(v.input_schema), output = schema(v.output_schema);
      const body = {
        capability_name: entry.capability_name, capability_version: v.capability_version,
        risk_class: v.risk_class, input_schema: input, output_schema: output,
        required_fields: [...(input.required ?? [])].sort(), supported_schema_versions: [...supported],
        deprecated: v.deprecated, replacement_capability: v.replacement_capability,
        route_policy: v.route_policy, pi_dispatchable: v.pi_dispatchable,
      };
      const metadata = freeze({ ...body, schema_hash: hashCapabilityContract(body) });
      versions.set(v.capability_version, metadata);
    }
    if (!versions.has(entry.active_version)) fail("INVALID_CAPABILITY_HOST_BINDING");
    registry.set(entry.capability_name, { active: entry.active_version, versions });
  }
  for (const entry of registry.values()) for (const metadata of entry.versions.values()) {
    if (metadata.replacement_capability !== null && !registry.has(metadata.replacement_capability)) fail("INVALID_CAPABILITY_HOST_BINDING");
  }
  const ordered = [...registry.keys()].sort();
  const catalogueHash = hashCapabilityContract(ordered.map(name => {
    const entry = registry.get(name);
    return { capability_name: name, active_version: entry.active,
      versions: [...entry.versions.values()].map(v => ({ version: v.capability_version, hash: v.schema_hash }))
        .sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0) };
  }));
  function selected(name, version) {
    checkName(name);
    const entry = registry.get(name);
    if (!entry) fail("UNKNOWN_CAPABILITY");
    if (version !== undefined) checkVersion(version);
    const result = entry.versions.get(version ?? entry.active);
    if (!result) fail("UNSUPPORTED_SCHEMA_VERSION");
    return result;
  }
  function observedAvailability(name) {
    try {
      const status = availability(name);
      return ["available", "unavailable"].includes(status) ? status : "unknown";
    } catch { return "unknown"; }
  }
  function getSchema(input) {
    const args = copyJson(input, 4096);
    exact(args, ["capability_name"], ["expected_schema_version"]);
    const metadata = selected(args.capability_name, args.expected_schema_version);
    return boundedResponse({ ...metadata, availability: observedAvailability(args.capability_name) });
  }
  function list(input = {}) {
    const args = copyJson(input, 16384);
    exact(args, [], ["capability_names", "offset", "limit"]);
    const offset = args.offset ?? 0, limit = args.limit ?? 32;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 128
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 64) fail("INVALID_CAPABILITY_QUERY");
    let names = ordered;
    if (args.capability_names !== undefined) {
      if (!Array.isArray(args.capability_names) || args.capability_names.length > 64
        || new Set(args.capability_names).size !== args.capability_names.length) fail("INVALID_CAPABILITY_QUERY");
      args.capability_names.forEach(name => selected(name));
      names = [...args.capability_names].sort();
    }
    const capabilities = names.slice(offset, offset + limit).map(name => {
      const m = selected(name);
      return { capability_name: name, capability_version: m.capability_version, risk_class: m.risk_class,
        availability: observedAvailability(name), pi_dispatchable: m.pi_dispatchable,
        deprecated: m.deprecated, schema_hash: m.schema_hash };
    });
    const next = offset + capabilities.length;
    return boundedResponse({ catalogue_hash: catalogueHash, total: names.length, returned: capabilities.length,
      offset, next_offset: next < names.length ? next : null, truncated: next < names.length, capabilities });
  }
  // An observation only. No tool choice, rewriting, execution or retry occurs here.
  function validateExpectation(input) {
    const args = copyJson(input, 4096);
    exact(args, ["capability_name"], ["expected_capability_version", "expected_schema_hash"]);
    let metadata;
    try { metadata = selected(args.capability_name); }
    catch (error) {
      if (!decisionCodes.has(error.code)) throw error;
      return boundedResponse({ ok: false, decision_required: true, code: error.code, capability_name: args.capability_name });
    }
    const facts = { capability_name: metadata.capability_name, actual_capability_version: metadata.capability_version,
      actual_schema_hash: metadata.schema_hash };
    let code = null;
    const available = observedAvailability(metadata.capability_name);
    if (available === "unknown") code = "CAPABILITY_STATUS_UNCERTAIN";
    else if (available === "unavailable") code = "CAPABILITY_UNAVAILABLE";
    else if (metadata.deprecated) code = "CAPABILITY_DEPRECATED";
    else if (!metadata.pi_dispatchable) code = "CAPABILITY_NOT_DISPATCHABLE";
    else if (args.expected_capability_version === undefined || args.expected_schema_hash === undefined) code = "CAPABILITY_EXPECTATION_REQUIRED";
    else {
      checkVersion(args.expected_capability_version);
      if (typeof args.expected_schema_hash !== "string" || !/^[a-f0-9]{64}$/u.test(args.expected_schema_hash)) fail("INVALID_CAPABILITY_SCHEMA_HASH");
      if (args.expected_capability_version !== metadata.capability_version) code = "CAPABILITY_VERSION_DRIFT";
      else if (args.expected_schema_hash !== metadata.schema_hash) code = "CAPABILITY_SCHEMA_DRIFT";
    }
    return boundedResponse(code ? { ...facts, ok: false, decision_required: true, code }
      : { ...facts, ok: true, decision_required: false, code: null });
  }
  return Object.freeze({ getSchema, list, validateExpectation });
}
