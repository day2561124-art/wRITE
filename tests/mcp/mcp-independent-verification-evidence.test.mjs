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

test("GitHub collector requires exact provider identity, pinned workflow and complete ordered steps", async () => {
  const { createHash } = await import("node:crypto");
  const { createGitHubVerificationCollector } = await import("../../server/src/mcp-independent-verification-github.mjs");
  const commit = candidate.integration_commit;
  const bytes = Buffer.from("fixture reviewed definition");
  const required = { suite: "all", platform: "linux", workflow_id: 77,
    workflow_path: ".github/workflows/fixture.yml", workflow_sha256: createHash("sha256").update(bytes).digest("hex"),
    job_name: "full", runner_label: "ubuntu-latest", runner_group_name: "GitHub Actions",
    required_steps: ["Exact checkout", "Full gate"] };
  const policy = { repository: expected.repository, repository_id: 123, required: [required], max_age_ms: 600000 };
  const repository = { id: 123, full_name: expected.repository };
  const run = () => ({ id: 111, repository, head_repository: repository, head_sha: commit,
    workflow_id: 77, path: required.workflow_path + "@fixture", event: "push",
    status: "completed", conclusion: "success", run_attempt: 1,
    run_started_at: new Date(nowMs - 4000).toISOString(), updated_at: new Date(nowMs - 1000).toISOString() });
  const job = () => ({ id: 222, run_id: 111, head_sha: commit, name: "full", labels: ["ubuntu-latest"],
    runner_group_name: "GitHub Actions", status: "completed", conclusion: "success",
    started_at: new Date(nowMs - 3000).toISOString(), completed_at: new Date(nowMs - 2000).toISOString(),
    steps: required.required_steps.map((name, index) => ({ name, number: index + 1, status: "completed", conclusion: "success" })) });
  const req = { commit, runs: [{ suite: "all", platform: "linux", run_id: 111 }] };
  const build = overrides => createGitHubVerificationCollector({ policy, clock: () => nowMs,
    readRun: async () => run(), readWorkflowBytes: async () => bytes,
    readJobs: async args => { assert.equal(args.run_attempt, 1); return { total_count: 1, jobs: [job()] }; },
    ...overrides });
  const pass = await build()(req);
  assert.equal(pass.observed, true);
  assert.equal(pass.execution_authorized, false);
  assert.equal(pass.observations[0].provider_job_conclusion, "success");
  assert.equal(pass.observations[0].exit_code, undefined);
  assert.equal(pass.observations[0].passed, undefined);
  for (const [mutate, code] of [
    [r => { delete r.run_attempt; }, "GITHUB_RUN_IDENTITY_UNVERIFIED"],
    [r => { r.head_sha = "9".repeat(40); }, "GITHUB_RUN_IDENTITY_UNVERIFIED"],
    [r => { r.repository = { ...repository, id: 456 }; }, "GITHUB_RUN_IDENTITY_UNVERIFIED"],
    [r => { r.event = "pull_request"; }, "GITHUB_WORKFLOW_EVENT_UNSUPPORTED"],
    [r => { r.conclusion = "failure"; }, "GITHUB_RUN_NOT_SUCCESSFUL"],
  ]) {
    const result = await build({ readRun: async () => { const r = run(); mutate(r); return r; } })(req);
    assert.equal(result.code, code);
    assert.equal(result.observed, false);
  }
  assert.equal((await build({ readWorkflowBytes: async () => Buffer.from("different") })(req)).code,
    "GITHUB_WORKFLOW_DEFINITION_MISMATCH");
  assert.equal((await build({ readJobs: async () => ({ total_count: 2, jobs: [job()] }) })(req)).code,
    "GITHUB_JOB_LIST_INCOMPLETE");
  for (const [mutate, code] of [
    [j => { j.labels.push("self-hosted"); }, "GITHUB_JOB_IDENTITY_UNVERIFIED"],
    [j => { delete j.head_sha; }, "GITHUB_JOB_IDENTITY_UNVERIFIED"],
    [j => { j.conclusion = "skipped"; }, "GITHUB_JOB_NOT_SUCCESSFUL"],
    [j => { j.steps[1].conclusion = "skipped"; }, "GITHUB_STEP_EVIDENCE_INCOMPLETE"],
    [j => { j.steps.reverse(); j.steps[0].number = 1; j.steps[1].number = 2; }, "GITHUB_STEP_EVIDENCE_INCOMPLETE"],
    [j => { delete j.completed_at; }, "GITHUB_JOB_TIMESTAMP_UNVERIFIED"],
  ]) {
    const result = await build({ readJobs: async () => { const j = job(); mutate(j); return { total_count: 1, jobs: [j] }; } })(req);
    assert.equal(result.code, code);
    assert.equal(result.observed, false);
  }
  let calls = 0;
  assert.equal((await build({ readRun: async () => ({ ...run(), run_attempt: ++calls }) })(req)).code,
    "GITHUB_RUN_CHANGED_DURING_OBSERVATION");
  assert.equal((await build()({ ...req, repository: "attacker/repo" })).code, "INVALID_GITHUB_VERIFICATION_REQUEST");
});

test("GitHub read transport binds exact repository, immutable blob bytes and read-only requests", async () => {
  const { createHash } = await import("node:crypto");
  const { createGitHubVerificationReadClient } = await import("../../server/src/mcp-independent-verification-github-read.mjs");
  const repo = "owner/fixture";
  const commit = "1".repeat(40), root = "2".repeat(40), github = "3".repeat(40), workflows = "4".repeat(40);
  const bytes = Buffer.from("name: Fixture\n");
  const blob = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
  const tree = (sha, path, type, mode, child) => ({ sha, truncated: false, tree: [{ path, type, mode, sha: child }] });
  const fixtures = {
    ["/actions/runs/111"]: { id: 111 },
    ["/actions/runs/111/attempts/1/jobs?per_page=100"]: { total_count: 1, jobs: [{ id: 222 }] },
    ["/git/commits/" + commit]: { sha: commit, tree: { sha: root } },
    ["/git/trees/" + root]: tree(root, ".github", "tree", "040000", github),
    ["/git/trees/" + github]: tree(github, "workflows", "tree", "040000", workflows),
    ["/git/trees/" + workflows]: tree(workflows, "fixture.yml", "blob", "100644", blob),
    ["/git/blobs/" + blob]: { sha: blob, size: bytes.length, encoding: "base64", content: bytes.toString("base64") },
  };
  const base = "https://api.github.com/repos/" + repo;
  const requests = [];
  const credential = "fixture_readonly_token_12345";
  const make = (modify = (path, value) => value) => createGitHubVerificationReadClient({
    repository: repo, readCredential: async () => credential,
    fetchImpl: async (url, opts) => {
      assert.equal(url.startsWith(base + "/"), true);
      assert.equal(opts.method, "GET");
      assert.equal(opts.redirect, "error");
      assert.equal(opts.headers.Authorization, "Bearer " + credential);
      const p = url.slice(base.length); requests.push(p);
      assert.ok(Object.hasOwn(fixtures, p));
      const value = modify(p, structuredClone(fixtures[p]));
      return value instanceof Response ? value : new Response(JSON.stringify(value), { status: 200 });
    },
  });
  const client = make();
  assert.deepEqual(await client.readRun({ repository: repo, run_id: 111 }), { id: 111 });
  assert.deepEqual(await client.readJobs({ repository: repo, run_id: 111, run_attempt: 1 }), { total_count: 1, jobs: [{ id: 222 }] });
  const input = { repository: repo, commit, path: ".github/workflows/fixture.yml" };
  assert.deepEqual(await client.readWorkflowBytes(input), bytes);
  assert.equal(requests.length, 7);
  for (const bad of [{ ...input, repository: "other/repo" }, { ...input, commit: "main" }, { ...input, path: "../fixture.yml" }]) {
    await assert.rejects(client.readWorkflowBytes(bad), /GITHUB_READ_ONLY_EVIDENCE_UNAVAILABLE/);
  }
  assert.equal(requests.length, 7);
  const corruption = [
    ["/git/commits/" + commit, v => ({ ...v, sha: "9".repeat(40) })],
    ["/git/trees/" + root, v => ({ ...v, truncated: true })],
    ["/git/trees/" + workflows, v => ({ ...v, tree: [{ ...v.tree[0], mode: "120000" }] })],
    ["/git/blobs/" + blob, v => ({ ...v, content: Buffer.alloc(bytes.length, 65).toString("base64") })],
    ["/git/blobs/" + blob, v => ({ ...v, size: bytes.length + 1 })],
    ["/git/blobs/" + blob, v => ({ ...v, content: v.content + "!" })],
  ];
  for (const [target, mutate] of corruption) {
    await assert.rejects(make((p, v) => p === target ? mutate(v) : v).readWorkflowBytes(input),
      /GITHUB_READ_ONLY_EVIDENCE_UNAVAILABLE/);
  }
  const oversized = make(() => new Response("a".repeat(2 * 1024 * 1024 + 1), { status: 200 }));
  await assert.rejects(oversized.readRun({ repository: repo, run_id: 111 }), /GITHUB_READ_ONLY_EVIDENCE_UNAVAILABLE/);
  const unauthorized = make(() => new Response(credential, { status: 403 }));
  await assert.rejects(unauthorized.readRun({ repository: repo, run_id: 111 }), e =>
    e.message === "GITHUB_READ_ONLY_EVIDENCE_UNAVAILABLE" && !String(e).includes(credential));
});

test("independent issuer signs only exact provider and separately observed test outcomes", async () => {
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { createIndependentVerificationIssuer } = await import("../../server/src/mcp-independent-verification-issuer.mjs");
  const { reviewIndependentVerification } = await import("../../server/src/mcp-independent-verification-evidence.mjs");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const now = Date.now();
  const candidate = { integration_candidate_id: "dev_integration_20261127-010000_aabbccddeeff", revision: 2,
    integration_commit: "1".repeat(40), source_head: "1".repeat(40), target_head: "2".repeat(40) };
  const row = { suite: "all", platform: "linux", workflow_sha256: "3".repeat(64) };
  const required = [row];
  const policy = { repository: "owner/disposable", issuer: "fixture-issuer", required, max_age_ms: 60000, receipt_ttl_ms: 30000 };
  const context = { candidate, plan: { required_suites: ["all"] }, observation_only: true, execution_authorized: false };
  const request = { integration_candidate_id: candidate.integration_candidate_id, expected_revision: 2 };
  const binding = { ...row, commit: candidate.integration_commit, run_id: 10, job_id: 20, run_attempt: 1, completed_at_ms: now - 50000 };
  const observation = { observed: true, execution_authorized: false, commit: candidate.integration_commit,
    observations: [{ ...binding, provider_job_conclusion: "success" }] };
  let signs = 0;
  const make = overrides => createIndependentVerificationIssuer({
    readContext: async () => context, resolvePolicy: async () => policy,
    collectProviderObservation: async () => observation,
    observeTestOutcome: async b => ({ ...b, execution_ok: true, passed: true, timed_out: false, skipped: false, exit_code: 0 }),
    signPayload: async payload => { signs++; return sign(null, payload, privateKey); },
    pinnedPublicKey: publicKey, clock: () => now, ...overrides,
  });
  const result = await make()(request);
  assert.equal(result.issued, true);
  assert.equal(result.execution_authorized, false);
  assert.equal(result.expires_at_ms, now + 10000);
  assert.equal(signs, 1);
  const { receipt_ttl_ms, ...expected } = policy;
  assert.equal(reviewIndependentVerification({ envelope: result.envelope,
    expected: { ...expected, candidate }, pinnedPublicKey: publicKey, nowMs: now }).verified, true);
  assert.equal((await make()({ ...request, required: [] })).issued, false);
  assert.equal((await make({ collectProviderObservation: async () => ({ ...observation, observations: [] }) })(request)).issued, false);
  assert.equal((await make({ observeTestOutcome: async () => ({ ...binding, provider_job_conclusion: "success" }) })(request)).issued, false);
  assert.equal((await make({ observeTestOutcome: async b => ({ ...b, execution_ok: true, passed: true, timed_out: false, skipped: false, exit_code: 0, job_id: 99 }) })(request)).issued, false);
  assert.equal((await make({ resolvePolicy: async () => ({ ...policy, required: [{ ...row, suite: "mcp_hermetic_core" }] }) })(request)).issued, false);
  let calls = 0;
  assert.equal((await make({ readContext: async () => ++calls === 1 ? context : { ...context, candidate: { ...candidate, revision: 3 } } })(request)).issued, false);
  assert.equal((await make({ clock: () => now + 10001 })(request)).issued, false);
  assert.equal(signs, 1, "No invalid observation reaches signing");
  const wrong = generateKeyPairSync("ed25519");
  assert.equal((await make({ signPayload: async payload => sign(null, payload, wrong.privateKey) })(request)).issued, false);
});

test("independent issuer publishes immutable exact receipts and the restarted consumer re-verifies them", async t => {
  const { mkdtemp, realpath, readdir, readFile, writeFile, rm, mkdir, link } = await import("node:fs/promises");
  const { default: os } = await import("node:os");
  const { default: path } = await import("node:path");
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { createIndependentVerificationIssuer } = await import("../../server/src/mcp-independent-verification-issuer.mjs");
  const { createIndependentCandidateEvidenceGate } = await import("../../server/src/mcp-independent-verification-candidate.mjs");
  const { createIndependentReceiptPublisher, createIndependentReceiptReader, createIndependentReceiptPublicationRecovery } = await import("../../server/src/mcp-independent-verification-receipt-store.mjs");
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(),"r16-receipt-exchange-")));
  t.after(() => rm(root,{recursive:true,force:true}));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const now = Date.now();
  let time = now;
  let allowed = true;
  const candidate = { integration_candidate_id: "dev_integration_20261127-010000_aabbccddeeff",
    revision:2,integration_commit:"1".repeat(40),source_head:"1".repeat(40),target_head:"2".repeat(40) };
  const row={suite:"all",platform:"linux",workflow_sha256:"3".repeat(64)};
  const policy={repository:"owner/disposable",issuer:"fixture-issuer",max_age_ms:60000,
    required:[row],receipt_ttl_ms:30000};
  const plan={required_suites:["all"]};
  const context={candidate,plan,observation_only:true,execution_authorized:false};
  const request={integration_candidate_id:candidate.integration_candidate_id,expected_revision:2};
  const binding={...row,commit:candidate.integration_commit,run_id:10,job_id:20,run_attempt:1,completed_at_ms:now-2000};
  let jobId=20;
  const issue=createIndependentVerificationIssuer({readContext:async()=>context,resolvePolicy:async()=>policy,
    collectProviderObservation:async()=>({observed:true,execution_authorized:false,commit:candidate.integration_commit,
      observations:[{...binding,job_id:jobId,provider_job_conclusion:"success"}]}),
    observeTestOutcome:async b=>({...b,execution_ok:true,passed:true,timed_out:false,skipped:false,exit_code:0}),
    signPayload:async payload=>sign(null,payload,privateKey),pinnedPublicKey:publicKey,clock:()=>time});
  const assertProtectedDirectory=async({directory,role})=>allowed&&directory===root&&["issuer","consumer"].includes(role);
  const {receipt_ttl_ms,...expectedPolicy}=policy;
  const publish=createIndependentReceiptPublisher({root,assertProtectedDirectory,pinnedPublicKey:publicKey,
    resolveExpected:async c=>({...expectedPolicy,candidate:c}),clock:()=>time});
  const reader=()=>createIndependentReceiptReader({root,assertProtectedDirectory});
  const issued=await issue(request);
  assert.equal(issued.issued,true);
  await assert.rejects(reader()(candidate),{code:"ENOENT"});
  const published=await publish(candidate,issued.envelope);
  assert.equal(published.created,true);
  assert.equal(published.execution_authorized,false);
  assert.equal((await publish(candidate,issued.envelope)).created,false);
  assert.equal((await readdir(root)).length,1);
  const name=(await readdir(root))[0];
  const file=path.join(root,name);
  const original=await readFile(file);
  assert.deepEqual(await reader()(candidate),issued.envelope);
  const makeGate=()=>createIndependentCandidateEvidenceGate({policy:{repository:policy.repository,issuer:policy.issuer,
    max_age_ms:policy.max_age_ms,suite_workflows:policy.required,additional_required:[]},
    pinnedPublicKey:publicKey,readEnvelope:reader(),clock:()=>time});
  const proof=await makeGate().reviewForValidation({...candidate,state:"preflight_passed"},plan);
  assert.equal(proof.verified,true);
  assert.equal(proof.execution_authorized,false);
  assert.equal(proof.receipt_sha256,published.receipt_sha256);
  jobId++;
  const different=await issue(request);
  assert.equal(different.issued,true);
  await assert.rejects(publish(candidate,different.envelope),{code:"INDEPENDENT_RECEIPT_CONFLICT"});
  assert.deepEqual(await readFile(file),original);
  await assert.rejects(publish(candidate,{...issued.envelope,signature:"A".repeat(86)}),{code:"INDEPENDENT_RECEIPT_PROOF_INVALID"});
  assert.deepEqual(await readFile(file),original);
  await assert.rejects(reader()({...candidate,revision:3}),{code:"ENOENT"});
  await assert.rejects(reader()({...candidate,integration_candidate_id:"../other"}),{code:"INDEPENDENT_RECEIPT_IDENTITY_INVALID"});
  allowed=false;
  await assert.rejects(reader()(candidate),{code:"INDEPENDENT_RECEIPT_DIRECTORY_UNVERIFIED"});
  allowed=true;
  const alias=path.join(root,"unexpected-hardlink");
  await link(file,alias);
  await assert.rejects(reader()(candidate),{code:"INDEPENDENT_RECEIPT_FILE_UNVERIFIED"});
  await rm(alias);
  // Simulate the exact on-disk state left by a publisher interrupted after
  // atomic link but before unlink. The consumer cannot use it prematurely.
  const temporary = path.join(root, "." + name + ".aabbccdd-1234-4567-8899-aabbccddeeff.tmp");
  await link(file, temporary);
  let leaseAvailable = false;
  const recover = createIndependentReceiptPublicationRecovery({root,assertProtectedDirectory,pinnedPublicKey:publicKey,
    resolveExpected:async c=>({...expectedPolicy,candidate:c}),clock:()=>time,
    withQuiescentPublisher:async action=>{
      if (!leaseAvailable) throw Error("PUBLISHER_ACTIVE");
      return action();
    }});
  await assert.rejects(reader()(candidate),{code:"INDEPENDENT_RECEIPT_FILE_UNVERIFIED"});
  await assert.rejects(recover(candidate),/PUBLISHER_ACTIVE/);
  leaseAvailable=true;
  allowed=false;
  await assert.rejects(recover(candidate),{code:"INDEPENDENT_RECEIPT_DIRECTORY_UNVERIFIED"});
  allowed=true;
  await link(file,alias);
  await assert.rejects(recover(candidate),{code:"INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED"});
  await rm(alias);
  time=issued.expires_at_ms;
  await assert.rejects(recover(candidate),{code:"INDEPENDENT_RECEIPT_PROOF_INVALID"});
  time=now;
  assert.equal((await recover(candidate)).recovered,true);
  assert.deepEqual(await readdir(root),[name]);
  assert.deepEqual(await readFile(file),original);
  assert.deepEqual(await reader()(candidate),issued.envelope);
  await assert.rejects(recover(candidate),{code:"INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED"});
  // Actual on-disk tampering is still rejected by the signature consumer.
  await writeFile(file,JSON.stringify({...issued.envelope,signature:"A".repeat(86)}));
  assert.equal((await makeGate().reviewForValidation({...candidate,state:"preflight_passed"},plan)).verified,false);
  await writeFile(file,original);
  time=issued.expires_at_ms;
  assert.equal((await makeGate().reviewForValidation({...candidate,state:"preflight_passed"},plan)).code,"VERIFICATION_RECEIPT_EXPIRED");
  await assert.rejects(publish(candidate,issued.envelope),{code:"INDEPENDENT_RECEIPT_PROOF_INVALID"});
});


test("host verifier service composes exact provider reads, independent outcomes and protected receipt publication", async t => {
  const { createHash } = await import("node:crypto");
  const { mkdtemp, realpath, readdir, readFile, rm } = await import("node:fs/promises");
  const { default: os } = await import("node:os");
  const { default: path } = await import("node:path");
  const { createIndependentVerifierService } = await import("../../server/src/mcp-independent-verification-service.mjs");
  const { createIndependentReceiptReader } = await import("../../server/src/mcp-independent-verification-receipt-store.mjs");
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "r16-composed-verifier-")));
  t.after(() => rm(root,{recursive:true,force:true}));
  const {publicKey:key, privateKey:signer} = generateKeyPairSync("ed25519");
  const now = Date.now();
  const c = {...candidate};
  const repository = {id:123,full_name:"owner/disposable"};
  const bytes = Buffer.from("reviewed fixture workflow\n");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const blob = createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
  const rootTree="4".repeat(40), githubTree="5".repeat(40), workflowsTree="6".repeat(40);
  const workflows = [
    {suite:"all",platform:"linux",workflow_id:77,workflow_path:".github/workflows/fixture.yml",
      workflow_sha256:digest,job_name:"full",runner_label:"ubuntu-latest",runner_group_name:"GitHub Actions",
      required_steps:["Exact checkout","Full gate"]},
    {suite:"mcp_pi_postseal",platform:"windows",workflow_id:77,workflow_path:".github/workflows/fixture.yml",
      workflow_sha256:digest,job_name:"postseal",runner_label:"windows-latest",runner_group_name:"GitHub Actions",
      required_steps:["Exact checkout","Postseal gate"]}
  ];
  const policy = {repository:repository.full_name,repository_id:repository.id,issuer:"fixture-verifier",
    max_age_ms:60000,receipt_ttl_ms:30000,workflows,additional_required:["mcp_pi_postseal"]};
  let context = {candidate:c,plan:{required_suites:["all"]},observation_only:true,execution_authorized:false};
  let providerPass = true, outcomePass = true, allowed = true, mutateDuringSigning = false;
  let signs = 0, outcomes = 0, selections = 0;
  const run = {id:111,repository,head_repository:repository,head_sha:c.integration_commit,workflow_id:77,
    path:workflows[0].workflow_path+"@fixture",event:"push",status:"completed",conclusion:"success",run_attempt:1,
    run_started_at:new Date(now-4000).toISOString(),updated_at:new Date(now-1000).toISOString()};
  const jobs = workflows.map((w,i)=>({id:222+i,run_id:111,head_sha:c.integration_commit,name:w.job_name,
    labels:[w.runner_label],runner_group_name:w.runner_group_name,status:"completed",conclusion:"success",
    started_at:new Date(now-3000).toISOString(),completed_at:new Date(now-2000).toISOString(),
    steps:w.required_steps.map((name,j)=>({name,number:j+1,status:"completed",conclusion:"success"}))}));
  const tree=(sha,path,type,mode,child)=>({sha,truncated:false,tree:[{path,type,mode,sha:child}]});
  const fixtures={
    "/actions/runs/111":run,
    "/actions/runs/111/attempts/1/jobs?per_page=100":{total_count:2,jobs},
    ["/git/commits/"+c.integration_commit]:{sha:c.integration_commit,tree:{sha:rootTree}},
    ["/git/trees/"+rootTree]:tree(rootTree,".github","tree","040000",githubTree),
    ["/git/trees/"+githubTree]:tree(githubTree,"workflows","tree","040000",workflowsTree),
    ["/git/trees/"+workflowsTree]:tree(workflowsTree,"fixture.yml","blob","100644",blob),
    ["/git/blobs/"+blob]:{sha:blob,size:bytes.length,encoding:"base64",content:bytes.toString("base64")}
  };
  const base="https://api.github.com/repos/"+repository.full_name;
  const assertProtectedDirectory=async({directory,role})=>allowed&&directory===root&&["issuer","consumer"].includes(role);
  const options={policy,readContext:async()=>structuredClone(context),
    readRunSelection:async(identity,required)=>{
      selections++;assert.deepEqual(identity,c);assert.equal(required.length,2);
      return required.map(({suite,platform})=>({suite,platform,run_id:111}));
    },
    observeTestOutcome:async binding=>{
      outcomes++;return {...binding,execution_ok:outcomePass,passed:outcomePass,timed_out:false,skipped:false,exit_code:outcomePass?0:1};
    },
    signPayload:async payload=>{
      signs++;
      if(mutateDuringSigning) context={...context,candidate:{...c,revision:c.revision+1}};
      return sign(null,payload,signer);
    },
    pinnedPublicKey:key,readCredential:async()=>"fixture_readonly_token_12345",
    fetchImpl:async(url,opts)=>{
      assert.equal(opts.method,"GET");assert.equal(opts.redirect,"error");
      assert.ok(url.startsWith(base+"/"));
      const endpoint=url.slice(base.length);assert.ok(Object.hasOwn(fixtures,endpoint));
      const value=structuredClone(fixtures[endpoint]);
      if(endpoint==="/actions/runs/111"&&!providerPass)value.conclusion="failure";
      return new Response(JSON.stringify(value),{status:200});
    },
    receiptRoot:root,assertProtectedDirectory,clock:()=>now};
  assert.throws(()=>createIndependentVerifierService({...options,observeTestOutcome:undefined}),/INDEPENDENT_VERIFIER_HOST_UNBOUND/);
  const service=createIndependentVerifierService(options);
  const request={integration_candidate_id:c.integration_candidate_id,expected_revision:c.revision};
  assert.equal((await service.verifyAndPublish({...request,runs:[]})).published,false);
  assert.equal(selections,0);
  providerPass=false;
  assert.equal((await service.verifyAndPublish(request)).published,false);
  assert.equal(outcomes,0);assert.equal(signs,0);
  providerPass=true;outcomePass=false;
  assert.equal((await service.verifyAndPublish(request)).published,false);
  assert.equal(signs,0);assert.deepEqual(await readdir(root),[]);
  outcomePass=true;mutateDuringSigning=true;
  assert.equal((await service.verifyAndPublish(request)).published,false);
  assert.deepEqual(await readdir(root),[]);
  mutateDuringSigning=false;context={...context,candidate:c};
  allowed=false;
  const denied=await service.verifyAndPublish(request);
  assert.equal(denied.published,false);assert.equal(denied.publication_unconfirmed,true);
  assert.deepEqual(await readdir(root),[]);
  allowed=true;
  const accepted=await service.verifyAndPublish(request);
  assert.equal(accepted.published,true);assert.equal(accepted.created,true);
  assert.equal(accepted.execution_authorized,false);
  const reader=createIndependentReceiptReader({root,assertProtectedDirectory});
  const envelope=await reader(c);
  const proof=reviewIndependentVerification({envelope,pinnedPublicKey:key,nowMs:now,
    expected:{candidate:c,repository:policy.repository,issuer:policy.issuer,max_age_ms:policy.max_age_ms,
      required:workflows.map(({suite,platform,workflow_sha256})=>({suite,platform,workflow_sha256}))}});
  assert.equal(proof.verified,true);assert.equal(proof.receipt_sha256,accepted.receipt_sha256);
  assert.equal(proof.suite_count,2);
  const [name]=await readdir(root), original=await readFile(path.join(root,name));
  const replay=await service.verifyAndPublish(request);
  assert.equal(replay.published,true);assert.equal(replay.created,false);
  assert.deepEqual(await readFile(path.join(root,name)),original);
});
