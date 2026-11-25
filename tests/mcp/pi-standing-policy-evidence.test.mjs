import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";
import { createStandingPolicyEvidenceReader } from "../../server/src/pi-standing-policy-evidence.mjs";

const workspace = { workspace_id: "dev_workspace_" + "a".repeat(24),
  workstream_id: "dev_workstream_20261125-010000_" + "b".repeat(12),
  workspace_type: "isolated_worktree", lifecycle_state: "active",
  workstream_state: "active", healthy: true, mutation_allowed: true };
const policy = { schema_version: 1, policy_id: "pi_standing_" + "c".repeat(32),
  project_id: "writer_workbench", principal: "verified-test-principal", enabled: true,
  issued_at_ms: 100, expires_at_ms: 200, workspace_ids: [workspace.workspace_id],
  capabilities: ["filesystem.read", "filesystem.write", "verification.focused", "git.commit"] };
const request = { policy_id: policy.policy_id, policy_sha256: hashExecutionInput(policy),
  principal: policy.principal, workspace, capabilities: ["filesystem.write"] };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-standing-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, policy.policy_id + ".policy.json");
  const revokedFile = path.join(root, policy.policy_id + ".revocation.json");
  await writeFile(file, JSON.stringify(policy));
  let now = 150;
  return { root, file, revokedFile, review: createStandingPolicyEvidenceReader({ root, clock: () => now }),
    setTime: value => { now = value; } };
}

test("host evidence matches only the pinned policy content and remains review-only", async t => {
  const f = await fixture(t);
  const result = await f.review(request);
  assert.equal(result.scope_matches, true);
  assert.equal(result.execution_authorized, false);
  assert.equal(result.policy_sha256, request.policy_sha256);
  for (const change of [
    { policy_sha256: "f".repeat(64) }, { principal: "another-principal" },
    { policy_id: "../unsafe" }, { policy_id: "pi_standing_" + "f".repeat(32) },
    { capabilities: ["git.push"] },
    { workspace: { ...workspace, workspace_id: "dev_workspace_" + "d".repeat(24) } },
  ]) {
    const rejected = await f.review({ ...request, ...change });
    assert.equal(rejected.scope_matches, false);
    assert.equal(rejected.execution_authorized, false);
  }
  await writeFile(f.file, JSON.stringify({ ...policy, capabilities: [...policy.capabilities, "filesystem.patch"] }));
  assert.equal((await f.review(request)).scope_matches, false);
});

test("host evidence is checked afresh for time and revocation on every review", async t => {
  const f = await fixture(t);
  assert.equal((await f.review(request)).scope_matches, true);
  f.setTime(200);
  assert.equal((await f.review(request)).scope_matches, false);
  f.setTime(150);
  await writeFile(f.revokedFile, "{invalid");
  assert.equal((await f.review(request)).scope_matches, false);
  const restarted = createStandingPolicyEvidenceReader({ root: f.root, clock: () => 150 });
  assert.equal((await restarted(request)).scope_matches, false);
});

test("missing, malformed, oversized and non-file host evidence is refused", async t => {
  const f = await fixture(t);
  for (const root of [undefined, ".", path.join(f.root, "missing")]) {
    assert.equal((await createStandingPolicyEvidenceReader({ root, clock: () => 150 })(request)).scope_matches, false);
  }
  await writeFile(f.file, "{invalid");
  assert.equal((await f.review(request)).scope_matches, false);
  await writeFile(f.file, " ".repeat(64 * 1024 + 1));
  assert.equal((await f.review(request)).scope_matches, false);
  await rm(f.file);
  assert.equal((await f.review(request)).scope_matches, false);
  await mkdir(f.file);
  assert.equal((await f.review(request)).scope_matches, false);
});
