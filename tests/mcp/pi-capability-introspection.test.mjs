import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const subjectUrl = process.env.PI_INTROSPECTION_SUBJECT_URL
  ?? new URL("../../server/src/pi-capability-introspection.mjs", import.meta.url).href;
const { createPiCapabilityIntrospection, hashCapabilityContract } = await import(subjectUrl);
const input = { type: "object", properties: { path: { type: "string", maxLength: 1024 } }, required: ["path"], additionalProperties: false };
const output = { type: "object", properties: { bytes: { type: "integer", minimum: 0 } }, additionalProperties: true };
function entry(name = "filesystem.read", overrides = {}) {
  return { capability_name: name, active_version: "1", versions: [{ capability_version: "1", risk_class: "read",
    input_schema: structuredClone(input), output_schema: structuredClone(output), deprecated: false,
    replacement_capability: null, route_policy: "pi_default_intent", pi_dispatchable: true, ...overrides }] };
}
const registry = (definitions = [entry()], extra = {}) => createPiCapabilityIntrospection({ definitions, ...extra });
function request(api, name = "filesystem.read") {
  const schema = api.getSchema({ capability_name: name });
  return { capability_name: name, expected_capability_version: schema.capability_version, expected_schema_hash: schema.schema_hash };
}

test("schema read returns the complete bounded public contract", () => {
  const s = registry().getSchema({ capability_name: "filesystem.read" });
  assert.deepEqual(Object.keys(s).sort(), ["availability", "capability_name", "capability_version", "deprecated",
    "input_schema", "output_schema", "pi_dispatchable", "replacement_capability", "required_fields", "risk_class",
    "route_policy", "schema_hash", "supported_schema_versions"].sort());
  assert.equal(s.capability_name, "filesystem.read"); assert.equal(s.risk_class, "read");
  assert.deepEqual([...s.required_fields], ["path"]); assert.match(s.schema_hash, /^[a-f0-9]{64}$/u);
  assert.ok(Buffer.byteLength(JSON.stringify(s)) < 65536);
});
test("schema hashes ignore object insertion order and retain all constraints", () => {
  const a = entry(), b = entry();
  b.versions[0].input_schema = { additionalProperties: false, required: ["path"],
    properties: { path: { maxLength: 1024, type: "string" } }, type: "object" };
  const first = registry([a]).getSchema({ capability_name: "filesystem.read" }).schema_hash;
  assert.equal(registry([b]).getSchema({ capability_name: "filesystem.read" }).schema_hash, first);
  b.versions[0].input_schema.properties.path.maxLength = 2048;
  assert.notEqual(registry([b]).getSchema({ capability_name: "filesystem.read" }).schema_hash, first);
});
test("a fresh Node process reconstructs the same schema hash without process memory", async () => {
  const definitions = [entry()];
  const expected = registry(definitions).getSchema({ capability_name: "filesystem.read" }).schema_hash;
  const code = `import {createPiCapabilityIntrospection} from ${JSON.stringify(subjectUrl)};
    console.log(createPiCapabilityIntrospection({definitions:${JSON.stringify(definitions)}}).getSchema({capability_name:'filesystem.read'}).schema_hash);`;
  const result = await run(process.execPath, ["--input-type=module", "-e", code], { timeout: 10000 });
  assert.equal(result.stdout.trim(), expected);
});
test("version query reads exactly the requested supported version", () => {
  const e = entry(); e.active_version = "2";
  e.versions.push({ ...structuredClone(e.versions[0]), capability_version: "2",
    input_schema: { ...structuredClone(input), required: [] } });
  const api = registry([e]);
  assert.equal(api.getSchema({ capability_name: "filesystem.read" }).capability_version, "2");
  const old = api.getSchema({ capability_name: "filesystem.read", expected_schema_version: "1" });
  assert.equal(old.capability_version, "1"); assert.deepEqual([...old.supported_schema_versions], ["1", "2"]);
  assert.throws(() => api.getSchema({ capability_name: "filesystem.read", expected_schema_version: "3" }), { code: "UNSUPPORTED_SCHEMA_VERSION", decision_required: true });
});
test("discovery lists selected names deterministically with bounded pagination", () => {
  const api = registry([entry("workspace.inspect"), entry("filesystem.read"), entry("filesystem.list")]);
  const first = api.list({ limit: 2 });
  assert.deepEqual(first.capabilities.map(c => c.capability_name), ["filesystem.list", "filesystem.read"]);
  assert.equal(first.truncated, true); assert.equal(first.next_offset, 2); assert.equal(first.total, 3);
  assert.deepEqual(api.list({ offset: 2, limit: 2 }).capabilities.map(c => c.capability_name), ["workspace.inspect"]);
  const selected = api.list({ capability_names: ["workspace.inspect", "filesystem.read"] });
  assert.deepEqual(selected.capabilities.map(c => c.capability_name), ["filesystem.read", "workspace.inspect"]);
  assert.equal(selected.catalogue_hash, first.catalogue_hash);
});
test("discovery cannot silently omit an unknown GPT selected capability", () => {
  assert.throws(() => registry().list({ capability_names: ["filesystem.read", "filesystem.missing"] }),
    { code: "UNKNOWN_CAPABILITY", decision_required: true });
});
test("unknown requested capability escalates without choosing a substitute", () => {
  const api = registry([entry("filesystem.write", { risk_class: "low-risk-write" })]);
  const r = api.validateExpectation({ capability_name: "filesystem.patch", expected_capability_version: "1", expected_schema_hash: "a".repeat(64) });
  assert.equal(r.code, "UNKNOWN_CAPABILITY"); assert.equal(r.ok, false); assert.equal(r.decision_required, true);
  assert.equal(r.capability_name, "filesystem.patch"); assert.equal(Object.hasOwn(r, "replacement_capability"), false);
});
test("schema read rejects paths, module names and arbitrary selectors", () => {
  const api = registry();
  for (const extra of [{ path: "C:/private" }, { module: "node:fs" }, { tool_name: "dev_create_file" }, { secret: "never-return" }]) {
    assert.throws(() => api.getSchema({ capability_name: "filesystem.read", ...extra }), { code: "INVALID_CAPABILITY_CONTRACT" });
  }
  assert.throws(() => api.getSchema({ capability_name: "../../server.mjs" }), { code: "INVALID_CAPABILITY_NAME" });
});
test("discovery input cannot supply source files, callbacks or host configuration", () => {
  const api = registry();
  assert.throws(() => api.list({ definitions: [entry()] }), { code: "INVALID_CAPABILITY_CONTRACT" });
  assert.throws(() => api.list({ availability: "available" }), { code: "INVALID_CAPABILITY_CONTRACT" });
  assert.throws(() => api.list({ path: "package.json" }), { code: "INVALID_CAPABILITY_CONTRACT" });
});
test("input size, duplicate names and pagination are strictly bounded", () => {
  const api = registry();
  for (const q of [{ limit: 0 }, { limit: 65 }, { offset: -1 }, { offset: 129 }, { limit: 1.5 },
    { capability_names: ["filesystem.read", "filesystem.read"] }]) {
    assert.throws(() => api.list(q), { code: "INVALID_CAPABILITY_QUERY" });
  }
  assert.throws(() => api.getSchema({ capability_name: "x".repeat(9000) }), { code: "INVALID_CAPABILITY_CONTRACT" });
});
test("matching explicit version and hash produces an observation, not dispatch", () => {
  const api = registry();
  const r = api.validateExpectation(request(api));
  assert.equal(r.ok, true); assert.equal(r.decision_required, false); assert.equal(r.code, null);
  assert.deepEqual(Object.keys(api).sort(), ["getSchema", "list", "validateExpectation"]);
});
test("missing pins require GPT decision rather than assuming current schema", () => {
  assert.equal(registry().validateExpectation({ capability_name: "filesystem.read" }).code, "CAPABILITY_EXPECTATION_REQUIRED");
});
test("version drift blocks even when the supplied hash is current", () => {
  const api = registry(), r = api.validateExpectation({ ...request(api), expected_capability_version: "2" });
  assert.equal(r.code, "CAPABILITY_VERSION_DRIFT"); assert.equal(r.decision_required, true); assert.equal(r.ok, false);
});
test("same version schema drift blocks without parameter repair", () => {
  const oldApi = registry(), oldRequest = request(oldApi);
  const changed = entry(); changed.versions[0].input_schema.required = [];
  const newApi = registry([changed]), snapshot = structuredClone(oldRequest);
  assert.equal(newApi.validateExpectation(oldRequest).code, "CAPABILITY_SCHEMA_DRIFT");
  assert.deepEqual(oldRequest, snapshot); assert.equal(newApi.validateExpectation(request(newApi)).ok, true);
});
test("risk, route and dispatchability changes participate in the schema hash", () => {
  const baseline = registry().getSchema({ capability_name: "filesystem.read" }).schema_hash;
  for (const override of [{ risk_class: "low-risk-write" }, { route_policy: "diagnostic_read_only" }, { pi_dispatchable: false }]) {
    assert.notEqual(registry([entry("filesystem.read", override)]).getSchema({ capability_name: "filesystem.read" }).schema_hash, baseline);
  }
});
test("deprecated metadata is readable but dispatch validation never follows replacement", () => {
  const definitions = [entry("filesystem.old", { deprecated: true, replacement_capability: "filesystem.read" }), entry()];
  const api = registry(definitions), schema = api.getSchema({ capability_name: "filesystem.old" });
  assert.equal(schema.deprecated, true); assert.equal(schema.replacement_capability, "filesystem.read");
  const r = api.validateExpectation(request(api, "filesystem.old"));
  assert.equal(r.code, "CAPABILITY_DEPRECATED"); assert.equal(r.capability_name, "filesystem.old");
  assert.equal(Object.hasOwn(r, "replacement_capability"), false);
});
test("non-dispatchable diagnostics do not become mutation capabilities", () => {
  const api = registry([entry("capability.list", { route_policy: "diagnostic_read_only", pi_dispatchable: false })]);
  assert.equal(api.validateExpectation(request(api, "capability.list")).code, "CAPABILITY_NOT_DISPATCHABLE");
  assert.throws(() => registry([entry("filesystem.write", { risk_class: "low-risk-write", route_policy: "diagnostic_read_only" })]),
    { code: "INVALID_CAPABILITY_HOST_BINDING" });
});
test("unavailable capabilities remain unavailable without selecting another tool", () => {
  const api = registry([entry()], { availability: () => "unavailable" });
  const s = api.getSchema({ capability_name: "filesystem.read" }); assert.equal(s.availability, "unavailable");
  assert.equal(api.list().capabilities[0].availability, "unavailable");
  assert.equal(api.validateExpectation(request(api)).code, "CAPABILITY_UNAVAILABLE");
});
test("untrusted availability results and failed host observations fail closed", () => {
  for (const availability of [() => true, () => Promise.resolve("available"), () => { throw new Error("private-path-and-secret"); }]) {
    const api = registry([entry()], { availability });
    const r = api.validateExpectation(request(api));
    assert.equal(r.code, "CAPABILITY_STATUS_UNCERTAIN"); assert.equal(r.ok, false);
    assert.equal(JSON.stringify(r).includes("private-path-and-secret"), false);
  }
});
test("availability changes do not alter the deterministic schema identity", () => {
  const a = registry([entry()], { availability: () => "available" });
  const b = registry([entry()], { availability: () => "unavailable" });
  assert.equal(a.getSchema({ capability_name: "filesystem.read" }).schema_hash, b.getSchema({ capability_name: "filesystem.read" }).schema_hash);
  assert.equal(a.list().catalogue_hash, b.list().catalogue_hash);
});
test("compiled definitions and returned schemas are isolated and immutable", () => {
  const defs = [entry()], api = registry(defs), before = request(api);
  defs[0].versions[0].input_schema.properties.path.type = "number";
  assert.deepEqual(request(api), before);
  const result = api.getSchema({ capability_name: "filesystem.read" });
  assert.throws(() => { result.input_schema.required.push("secret"); }, TypeError);
  assert.throws(() => { result.input_schema.properties.path.type = "number"; }, TypeError);
  assert.equal(api.validateExpectation(before).ok, true);
});
test("accessors, functions, prototype injection and cycles are rejected without invoking code", () => {
  let invoked = 0;
  const api = registry(), query = { capability_name: "filesystem.read" };
  Object.defineProperty(query, "path", { enumerable: true, get() { invoked++; return "secret"; } });
  assert.throws(() => api.getSchema(query), { code: "INVALID_CAPABILITY_CONTRACT" }); assert.equal(invoked, 0);
  const malformed = entry(); Object.defineProperty(malformed, "versions", { enumerable: true, get() { invoked++; return []; } });
  assert.throws(() => registry([malformed]), { code: "INVALID_CAPABILITY_CONTRACT" }); assert.equal(invoked, 0);
  assert.throws(() => hashCapabilityContract({ callback: () => {} }), { code: "INVALID_CAPABILITY_CONTRACT" });
  assert.throws(() => hashCapabilityContract(JSON.parse('{"__proto__":{}}')), { code: "INVALID_CAPABILITY_CONTRACT" });
  const cycle = {}; cycle.next = cycle;
  assert.throws(() => hashCapabilityContract(cycle), { code: "CAPABILITY_CONTRACT_LIMIT" });
});
test("schema source references, annotations and filesystem layout cannot leak", () => {
  for (const schema of [{ ...input, $ref: "file:///private/schema.json" },
    { ...input, description: "C:/private/internal-layout" }, { ...input, default: { secret: "do-not-publish" } }]) {
    assert.throws(() => registry([entry("filesystem.read", { input_schema: schema })]), { code: "UNSUPPORTED_PUBLIC_SCHEMA" });
  }
  assert.equal(JSON.stringify(registry().getSchema({ capability_name: "filesystem.read" })).includes("tool_name"), false);
});
test("host contracts reject duplicate versions, missing active versions and unresolved replacements", () => {
  const duplicate = entry(); duplicate.versions.push(structuredClone(duplicate.versions[0]));
  const absent = entry(); absent.active_version = "2";
  const replacement = entry("filesystem.old", { deprecated: true, replacement_capability: "filesystem.missing" });
  for (const e of [duplicate, absent, replacement]) assert.throws(() => registry([e]), { code: "INVALID_CAPABILITY_HOST_BINDING" });
});
test("bad expectation fields and malformed hashes are rejected", () => {
  const api = registry();
  assert.throws(() => api.validateExpectation({ ...request(api), tool_name: "dev_delete_file" }), { code: "INVALID_CAPABILITY_CONTRACT" });
  assert.throws(() => api.validateExpectation({ ...request(api), expected_schema_hash: "short" }), { code: "INVALID_CAPABILITY_SCHEMA_HASH" });
  assert.throws(() => api.validateExpectation({ ...request(api), expected_capability_version: "latest" }), { code: "INVALID_CAPABILITY_VERSION" });
});

test("nested schema types and flag keywords are validated before publication", () => {
  for (const nested of [{ type: "unknown" }, { type: [] }, { type: ["string", "string"] },
    { type: ["string", 3] }, { uniqueItems: "true" }, { pattern: 3 }, { format: false }]) {
    assert.throws(() => registry([entry("filesystem.read", {
      input_schema: { type: "object", properties: { value: nested } },
    })]), { code: "INVALID_CAPABILITY_SCHEMA" });
  }
});
test("invalid numeric and cardinality constraints cannot acquire a trusted hash", () => {
  for (const nested of [{ maxLength: -1 }, { minItems: 0.5 }, { maxProperties: "10" },
    { minimum: "0" }, { exclusiveMaximum: true }, { multipleOf: 0 }]) {
    assert.throws(() => registry([entry("filesystem.read", {
      input_schema: { type: "object", properties: { value: nested } },
    })]), { code: "INVALID_CAPABILITY_SCHEMA" });
  }
});
test("enum and dependency declarations must contain valid distinct members", () => {
  for (const invalid of [{ enum: "yes" }, { enum: [] }, { enum: [{ a: 1, b: 2 }, { b: 2, a: 1 }] },
    { dependentRequired: [] }, { dependentRequired: { path: "bytes" } },
    { dependentRequired: { path: ["bytes", "bytes"] } }]) {
    assert.throws(() => registry([entry("filesystem.read", { input_schema: { type: "object", ...invalid } })]),
      { code: "INVALID_CAPABILITY_SCHEMA" });
  }
});
test("Ajv rejects empty logical alternatives and empty tuple declarations; omission remains valid", () => {
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    assert.throws(() => registry([entry("filesystem.read", { input_schema: { type: "object", [key]: [] } })]),
      { code: "INVALID_CAPABILITY_SCHEMA" });
  }
  assert.throws(() => registry([entry("filesystem.read", {
    input_schema: { type: "object", properties: { value: { type: "array", prefixItems: [] } } },
  })]), { code: "INVALID_CAPABILITY_SCHEMA" });
  const api = registry([entry("filesystem.read", {
    input_schema: { type: "object", properties: { value: { type: ["array", "null"] } } },
  })]);
  assert.equal(api.validateExpectation(request(api)).ok, true);
});
test("catalogue identity is independent of locale collation and version insertion order", async () => {
  const defs = [entry()];
  defs[0].versions.push({ ...structuredClone(defs[0].versions[0]), capability_version: "1.10" });
  defs[0].versions.push({ ...structuredClone(defs[0].versions[0]), capability_version: "1.2" });
  const expected = registry(defs).list().catalogue_hash;
  defs[0].versions.reverse();
  const code = `import {createPiCapabilityIntrospection} from ${JSON.stringify(subjectUrl)};
    String.prototype.localeCompare = () => { throw new Error('locale dependency'); };
    console.log(createPiCapabilityIntrospection({definitions:${JSON.stringify(defs)}}).list().catalogue_hash);`;
  const result = await run(process.execPath, ["--input-type=module", "-e", code], { timeout: 10000 });
  assert.equal(result.stdout.trim(), expected);
});
test("malformed version records fail with the contract error instead of an unclassified exception", () => {
  const e = entry(); e.versions = [null];
  assert.throws(() => registry([e]), { code: "INVALID_CAPABILITY_CONTRACT" });
});
