import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { reviewIndependentVerification } from "../../server/src/mcp-independent-verification-evidence.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const nowMs = 1795755600000;
const candidate = { integration_candidate_id: "dev_integration_20261127-050000_aabbccddeeff",
  revision: 4, integration_commit: "1".repeat(40), source_head: "2".repeat(40), target_head: "3".repeat(40) };
const required = [
  { suite: "all", platform: "linux", workflow_sha256: "a".repeat(64) },
  { suite: "mcp_pi_postseal", platform: "windows", workflow_sha256: "b".repeat(64) },
];
const expected = { repository: "day2561124-art/wRITE", candidate, required,
  issuer: "independent-fixture", max_age_ms: 600000 };
function body() {
  return { schema_version: 1, issuer: expected.issuer, repository: expected.repository,
    candidate: structuredClone(candidate), issued_at_ms: nowMs - 1000, expires_at_ms: nowMs + 1000,
    results: required.map((row, index) => ({ ...row, commit: candidate.integration_commit,
      run_id: 111, job_id: 222 + index, run_attempt: 1, completed_at_ms: nowMs - 2000,
      execution_ok: true, passed: true, timed_out: false, skipped: false, exit_code: 0 })) };
}
function signed(value, key = privateKey) {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  return { payload, signature: sign(null, Buffer.from(payload), key).toString("base64url") };
}
function review(envelope, overrides = {}) {
  return reviewIndependentVerification({ envelope, expected, pinnedPublicKey: publicKey, nowMs, ...overrides });
}
test("independent evidence binds exact candidate and complete suite/platform plan, not execution permission", () => {
  const r = review(signed(body()));
  assert.equal(r.verified, true);
  assert.equal(r.execution_authorized, false);
  assert.equal(r.integration_commit, candidate.integration_commit);
  assert.equal(r.candidate_revision, candidate.revision);
  assert.equal(r.suite_count, 2);
  assert.match(r.receipt_sha256, /^[a-f0-9]{64}$/u);
});
test("forged, substituted and ambiguous signed evidence cannot satisfy the gate", () => {
  const other = generateKeyPairSync("ed25519");
  assert.equal(review(signed(body(), other.privateKey)).code, "VERIFICATION_SIGNATURE_INVALID");
  const env = signed(body());
  assert.equal(review({ ...env, payload: env.payload.replace('"revision":4', '"revision":5') }).code, "VERIFICATION_SIGNATURE_INVALID");
  const duplicate = JSON.stringify(body()).replace('"schema_version":1', '"schema_version":1,"schema_version":1');
  assert.equal(review(signed(duplicate)).code, "INVALID_VERIFICATION_PAYLOAD");
  assert.equal(review(env, { pinnedPublicKey: undefined }).verified, false);
});
test("stale candidate, stale run, missing full suite, failed, skipped and wrong workflow reject independently", () => {
  const mutations = [
    [b => { b.candidate.revision++; }, "VERIFICATION_CANDIDATE_MISMATCH"],
    [b => { b.results[0].commit = "9".repeat(40); }, "VERIFICATION_CANDIDATE_MISMATCH"],
    [b => { b.results[0].completed_at_ms = nowMs - 600001; }, "INVALID_VERIFICATION_JOB"],
    [b => { b.expires_at_ms = nowMs; }, "VERIFICATION_RECEIPT_EXPIRED"],
    [b => { b.results.shift(); }, "VERIFICATION_COVERAGE_MISMATCH"],
    [b => { b.results[0] = { ...b.results[1] }; }, "VERIFICATION_COVERAGE_MISMATCH"],
    [b => { b.results[0].suite = "mcp_hermetic_core"; }, "VERIFICATION_COVERAGE_MISMATCH"],
    [b => { b.results[0].workflow_sha256 = "c".repeat(64); }, "VERIFICATION_COVERAGE_MISMATCH"],
    [b => { b.results[0].passed = false; }, "VERIFICATION_SUITE_FAILED"],
    [b => { b.results[0].skipped = true; }, "VERIFICATION_SUITE_FAILED"],
    [b => { b.results[0].timed_out = true; }, "VERIFICATION_SUITE_FAILED"],
    [b => { b.results[0].exit_code = 1; }, "VERIFICATION_SUITE_FAILED"],
    [b => { b.repository = "another/repository"; }, "VERIFICATION_CANDIDATE_MISMATCH"],
  ];
  for (const [mutate, code] of mutations) {
    const value = body(); mutate(value);
    const r = review(signed(value));
    assert.equal(r.code, code);
    assert.equal(r.verified, false);
    assert.equal(r.execution_authorized, false);
  }
});
test("unbound or duplicate trusted required plan cannot accept evidence", () => {
  for (const plan of [undefined, { ...expected, required: [] }, { ...expected, required: [required[0], required[0]] }]) {
    assert.equal(review(signed(body()), { expected: plan }).code, "INVALID_TRUSTED_VERIFICATION_PLAN");
  }
});

test("host observer records signed evidence in real Journal without changing candidate readiness", async t => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { default: os } = await import("node:os");
  const { default: path } = await import("node:path");
  const { createDevOperationJournalService } = await import("../../server/src/mcp-development-journal-tools.mjs");
  const { createIndependentVerificationObserver } = await import("../../server/src/mcp-independent-verification-observer.mjs");
  const root = await mkdtemp(path.join(os.tmpdir(), "r16-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const journal = createDevOperationJournalService({ storageRoot: root });
  const state = { ...candidate, workspace_id: "dev_workspace_" + "a".repeat(24),
    workstream_id: "dev_workstream_20261127-050000_aabbccddeeff", state: "preflight_passed" };
  const policy = { repository: expected.repository, issuer: expected.issuer, required, max_age_ms: expected.max_age_ms };
  const request = { integration_candidate_id: candidate.integration_candidate_id, expected_revision: candidate.revision };
  let reads = 0;
  const make = overrides => createIndependentVerificationObserver({
    getCandidate: async () => structuredClone(state), resolvePolicy: async () => policy,
    readEnvelope: async observed => { reads++; assert.deepEqual(observed, candidate); return signed(body()); },
    pinnedPublicKey: publicKey, clock: () => nowMs, journal, ...overrides,
  });
  const observer = make();
  assert.equal((await observer({ ...request, publicKey })).verified, false);
  assert.equal(reads, 0);
  const accepted = await observer(request);
  assert.equal(accepted.verified, true);
  assert.equal(accepted.execution_authorized, false);
  assert.equal(accepted.observation_only, true);
  assert.equal(state.state, "preflight_passed");
  const reopened = createDevOperationJournalService({ storageRoot: root });
  const records = (await reopened.verify()).events;
  const events = records.filter(e => e.operation_id === accepted.operation_id);
  assert.equal(events.length, 2);
  assert.equal(events[1].operation_type, "independent_verification_observation");
  assert.equal(events[1].result.receipt_sha256, accepted.receipt_sha256);
  assert.equal(events[1].result.execution_authorized, false);
  assert.equal(events[1].result.passed, undefined);
  assert.equal(events[1].workspace_id, state.workspace_id);
  assert.equal(events[1].links.some(l => l.integration_candidate_id === candidate.integration_candidate_id), true);
  assert.equal(events[1].links.some(l => l.commit === candidate.integration_commit), true);
  assert.equal((await reopened.status()).chain_verified, true);
  assert.equal((await reopened.status()).active_operation_count, 0);
  const baseline = records.length;
  const raced = make({ readEnvelope: async () => { state.revision++; return signed(body()); } });
  assert.equal((await raced(request)).code, "VERIFICATION_CANDIDATE_STALE");
  state.revision = candidate.revision;
  const forged = make({ readEnvelope: async () => signed(body(), generateKeyPairSync("ed25519").privateKey) });
  assert.equal((await forged(request)).code, "VERIFICATION_SIGNATURE_INVALID");
  let policyReads = 0;
  const changed = make({ resolvePolicy: async () => ({ ...policy, max_age_ms: policy.max_age_ms - (policyReads++ ? 1 : 0) }) });
  assert.equal((await changed(request)).code, "VERIFICATION_POLICY_CHANGED");
  assert.equal((await reopened.verify()).events.length, baseline);
  const journalFailure = make({ journal: { begin: async () => { throw Error("fixture journal unavailable"); },
    complete: async () => assert.fail("must not publish success") } });
  await assert.rejects(journalFailure(request), /fixture journal unavailable/);
});
