import assert from "node:assert/strict";
import { findPackageJSON } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Optional installed sidecar package path for isolated research checkouts.
// This command is not an MCP execution entry and never calls a model.
const packageLocation = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2]))
  : new URL("./package.json", import.meta.url);
const agentPackage = findPackageJSON("@earendil-works/pi-coding-agent", packageLocation);
const codemodePackage = findPackageJSON("@earendil-works/pi-codemode", pathToFileURL(agentPackage));
const codemodeManifest = JSON.parse(await readFile(codemodePackage, "utf8"));
const entry = codemodeManifest.exports?.["."] ?? codemodeManifest.main;
const importEntry = typeof entry === "string" ? entry : entry?.import ?? entry?.default;
assert.equal(typeof importEntry, "string");
const { CodemodeSandbox } = await import(new URL(importEntry, pathToFileURL(codemodePackage)));
let hostCalls = 0;
const sandbox = new CodemodeSandbox({
  timeoutMs: 5_000,
  memoryLimitBytes: 32 * 1024 * 1024,
  tools: [{
    name: "fixture_double",
    description: "Read-only deterministic fixture; host validates arguments.",
    inputSchema: { type: "object", properties: { value: { type: "integer" } }, required: ["value"], additionalProperties: false },
    execute(args) {
      // Pi schemas describe declarations; the host must enforce them.
      assert(args && typeof args === "object" && !Array.isArray(args));
      assert.deepEqual(Object.keys(args), ["value"]);
      assert(Number.isSafeInteger(args.value));
      hostCalls += 1;
      return { value: args.value * 2 };
    },
  }],
});
try {
  const batch = await sandbox.execute("const r = await Promise.all([tools.fixture_double({value: 2}), tools.fixture_double({value: 3})]); return r.reduce((sum, item) => sum + item.value, 0);");
  assert.equal(batch.ok, true);
  assert.equal(batch.value, 10);
  assert.equal(hostCalls, 2);
  assert.equal(batch.calls.length, 2);
  assert(batch.calls.every((call) => call.status === "ok"));

  const globals = await sandbox.execute("return [typeof process, typeof require, typeof fetch, typeof setTimeout, typeof models];");
  assert.equal(globals.ok, true);
  assert.deepEqual(globals.value, Array(5).fill("undefined"));

  const unknown = await sandbox.execute("return await tools.arbitrary_shell({command: 'fixture'});");
  assert.equal(unknown.ok, false);
  assert.equal(hostCalls, 2);

  const invalid = await sandbox.execute("return await tools.fixture_double({value: 2, command: 'fixture'});");
  assert.equal(invalid.ok, false);
  assert.equal(hostCalls, 2);

  const timeout = await sandbox.execute("while (true) {}", { timeoutMs: 200 });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.error.kind, "timeout");

  const afterTimeout = await sandbox.execute("return 7;");
  assert.equal(afterTimeout.ok, true);
  assert.equal(afterTimeout.value, 7);
  console.log(JSON.stringify({ ok: true, model_requests: 0, checks: ["batch", "unavailable_globals", "unknown_tool", "host_validation", "cpu_timeout", "post_timeout_execution"] }));
} finally {
  await sandbox.close();
}
