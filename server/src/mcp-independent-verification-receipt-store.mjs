import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, lstat, realpath, link, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { reviewIndependentVerification } from "./mcp-independent-verification-evidence.mjs";
import { createIndependentTestOutcomeObserver } from "./mcp-independent-verification-outcome.mjs";

// Fixed host-owned filesystem exchange. Host installation must independently
// verify the issuer-only writer ACL and consumer read-only ACL. Neither an
// environment variable nor a supplied callback is itself a production trust
// decision. No MCP registration, directory creation or key provisioning.
const id = /^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const sha = /^[a-f0-9]{40}$/u;
const fields = ["integration_candidate_id", "revision", "integration_commit", "source_head", "target_head"];
const maxBytes = 400 * 1024; // bounded JSON envelope, including UTF-8 escaping
const fail = code => { throw Object.assign(new Error(code), { code }); };
const exact = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
function candidateName(candidate) {
  if (!exact(candidate, fields) || typeof candidate.integration_candidate_id !== "string"
    || !id.test(candidate.integration_candidate_id) || !Number.isSafeInteger(candidate.revision)
    || candidate.revision < 1 || !fields.slice(2).every(key => typeof candidate[key] === "string" && sha.test(candidate[key])))
    fail("INDEPENDENT_RECEIPT_IDENTITY_INVALID");
  return candidate.integration_candidate_id + ".r" + candidate.revision + "." + candidate.integration_commit + ".json";
}
const normalized = value => process.platform === "win32" ? path.normalize(value).toLowerCase() : path.normalize(value);
const sameStat = (a, b) => a.dev === b.dev && a.ino === b.ino;
function boundary({ root, assertProtectedDirectory, role }) {
  if (typeof root !== "string" || !path.isAbsolute(root) || root.includes("\0")
    || typeof assertProtectedDirectory !== "function") fail("INDEPENDENT_RECEIPT_HOST_UNBOUND");
  const directory = path.resolve(root);
  async function check() {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || normalized(await realpath(directory)) !== normalized(directory)
      || await assertProtectedDirectory(Object.freeze({ directory, role })) !== true)
      fail("INDEPENDENT_RECEIPT_DIRECTORY_UNVERIFIED");
    const again = await lstat(directory);
    if (!again.isDirectory() || again.isSymbolicLink() || !sameStat(stat, again))
      fail("INDEPENDENT_RECEIPT_DIRECTORY_CHANGED");
    return again;
  }
  return { directory, check };
}

async function readEnvelopeFile(store, name, byteLimit = maxBytes) {
  const beforeRoot = await store.check();
  const filename = path.join(store.directory, name);
  const before = await lstat(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1
    || before.size < 1 || before.size > byteLimit) fail("INDEPENDENT_RECEIPT_FILE_UNVERIFIED");
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !sameStat(before, stat) || stat.size !== before.size || stat.nlink !== 1)
      fail("INDEPENDENT_RECEIPT_FILE_CHANGED");
    // Bounded read even if the file is modified concurrently.
    const buffer = Buffer.alloc(byteLimit + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    const current = await lstat(filename);
    const afterRoot = await store.check();
    if (offset !== stat.size || offset > byteLimit || !sameStat(stat, after) || !sameStat(stat, current)
      || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs
      || current.isSymbolicLink() || current.nlink !== 1 || !sameStat(beforeRoot, afterRoot))
      fail("INDEPENDENT_RECEIPT_FILE_CHANGED");
    const raw = buffer.subarray(0, offset).toString("utf8");
    const envelope = JSON.parse(raw);
    if (!exact(envelope, ["payload", "signature"]) || typeof envelope.payload !== "string"
      || typeof envelope.signature !== "string" || JSON.stringify(envelope) !== raw)
      fail("INDEPENDENT_RECEIPT_FORMAT_INVALID");
    return Object.freeze(envelope);
  } finally { await handle.close(); }
}

// Issuer-only offline repair. The trusted host must hold an exclusive
// publisher lease for the entire call (including all awaits). This is not an
// MCP operation. No caller-supplied path, broad deletion, or overwrite.
export function createIndependentReceiptPublicationRecovery({ root, assertProtectedDirectory,
  withQuiescentPublisher, pinnedPublicKey, resolveExpected, clock = Date.now } = {}) {
  const store = boundary({ root, assertProtectedDirectory, role: "issuer" });
  if (typeof withQuiescentPublisher !== "function" || typeof resolveExpected !== "function"
    || typeof clock !== "function" || !pinnedPublicKey) fail("INDEPENDENT_RECEIPT_HOST_UNBOUND");
  return async function recover(candidate) {
    const name = candidateName(candidate);
    candidate = structuredClone(candidate);
    return withQuiescentPublisher(async () => {
      const rootStat = await store.check();
      const filename = path.join(store.directory, name);
      const stat = await lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 2
        || stat.size < 1 || stat.size > maxBytes)
        fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
      const prefix = "." + name + ".";
      const entries = await readdir(store.directory);
      if (entries.length > 10000) fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
      const aliases = entries.filter(n => n.startsWith(prefix)
        && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/u.test(n.slice(prefix.length)));
      if (aliases.length !== 1) fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
      const alias = path.join(store.directory, aliases[0]);
      const other = await lstat(alias);
      if (!other.isFile() || other.isSymbolicLink() || other.nlink !== 2 || !sameStat(stat, other))
        fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
      // Read only the exact shared file. The ordinary consumer continues to
      // reject nlink=2 until the separately authorized repair is complete.
      const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const opened = await handle.stat();
        if (!sameStat(stat, opened) || opened.nlink !== 2 || opened.size !== stat.size)
          fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
        const buffer = Buffer.alloc(stat.size + 1);
        let offset = 0;
        while (offset < buffer.length) {
          const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
          if (!bytesRead) break;
          offset += bytesRead;
        }
        if (offset !== stat.size) fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
        const raw = buffer.subarray(0, offset).toString("utf8");
        const envelope = JSON.parse(raw);
        if (!exact(envelope, ["payload", "signature"]) || JSON.stringify(envelope) !== raw)
          fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
        const expected = structuredClone(await resolveExpected(Object.freeze(candidate)));
        if (!expected?.candidate || fields.some(k => expected.candidate[k] !== candidate[k]))
          fail("INDEPENDENT_RECEIPT_CONTEXT_CHANGED");
        const proof = reviewIndependentVerification({ envelope, expected, pinnedPublicKey, nowMs: clock() });
        if (!proof.verified) fail("INDEPENDENT_RECEIPT_PROOF_INVALID");
        const final = await lstat(filename), currentAlias = await lstat(alias), finalOpened = await handle.stat();
        if (!sameStat(rootStat, await store.check())
          || [final, currentAlias, finalOpened].some(v => !v.isFile() || v.isSymbolicLink()
            || v.nlink !== 2 || !sameStat(stat, v) || v.size !== stat.size
            || v.mtimeMs !== stat.mtimeMs || v.ctimeMs !== stat.ctimeMs))
          fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
        await unlink(alias);
        const stored = await readEnvelopeFile(store, name);
        if (stored.payload !== envelope.payload || stored.signature !== envelope.signature)
          fail("INDEPENDENT_RECEIPT_RECOVERY_UNVERIFIED");
        return Object.freeze({ recovered: true, execution_authorized: false, receipt_sha256: proof.receipt_sha256 });
      } finally { await handle.close(); }
    });
  };
}

export function createIndependentReceiptReader({ root, assertProtectedDirectory } = {}) {
  const store = boundary({ root, assertProtectedDirectory, role: "consumer" });
  return async function readEnvelope(candidate) {
    // Returned data is untrusted until the candidate evidence gate verifies
    // its signature, policy, expiry and exact identity.
    return readEnvelopeFile(store, candidateName(candidate));
  };
}

// Supervisor outcome exchange uses a separate protected directory from the
// issuer receipt store. An exact binding, not a caller-supplied path, selects
// one immutable envelope. Signature and freshness are verified by the
// separately pinned supervisor observer, never inferred from file existence.
const outcomeBindingFields = ["suite","platform","workflow_sha256","commit","run_id","job_id","run_attempt","completed_at_ms"];
export function independentOutcomeAttestationFilename(binding) {
  if (!exact(binding,outcomeBindingFields)
    || typeof binding.suite !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/u.test(binding.suite)
    || !["windows","linux"].includes(binding.platform)
    || typeof binding.workflow_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(binding.workflow_sha256)
    || typeof binding.commit !== "string" || !sha.test(binding.commit)
    || !outcomeBindingFields.slice(4).every(k=>Number.isSafeInteger(binding[k]) && binding[k]>0))
    fail("INDEPENDENT_OUTCOME_BINDING_INVALID");
  const canonical=Object.fromEntries(outcomeBindingFields.map(k=>[k,binding[k]]));
  return "outcome-"+createHash("sha256").update(JSON.stringify(canonical),"utf8").digest("hex")+".json";
}
export function createIndependentOutcomeAttestationReader({root,assertProtectedDirectory} = {}) {
  const store=boundary({root,assertProtectedDirectory,role:"outcome_consumer"});
  return async binding => readEnvelopeFile(store,independentOutcomeAttestationFilename(binding),100*1024);
}

export function createIndependentReceiptPublisher({ root, assertProtectedDirectory, pinnedPublicKey, resolveExpected, clock = Date.now } = {}) {
  const store = boundary({ root, assertProtectedDirectory, role: "issuer" });
  if (typeof resolveExpected !== "function" || typeof clock !== "function" || !pinnedPublicKey)
    fail("INDEPENDENT_RECEIPT_HOST_UNBOUND");
  return async function publish(candidate, envelope) {
    const name = candidateName(candidate);
    candidate = structuredClone(candidate);
    envelope = structuredClone(envelope);
    const verify = async () => {
      const expected = structuredClone(await resolveExpected(Object.freeze(candidate)));
      if (!expected?.candidate || fields.some(key => expected.candidate[key] !== candidate[key]))
        fail("INDEPENDENT_RECEIPT_CONTEXT_CHANGED");
      const proof = reviewIndependentVerification({ envelope, expected, pinnedPublicKey, nowMs: clock() });
      if (!proof.verified) fail("INDEPENDENT_RECEIPT_PROOF_INVALID");
      return proof;
    };
    const proof = await verify();
    const directoryStat = await store.check();
    const bytes = Buffer.from(JSON.stringify(envelope), "utf8");
    if (bytes.length > maxBytes) fail("INDEPENDENT_RECEIPT_FORMAT_INVALID");
    const filename = path.join(store.directory, name);
    const temporary = path.join(store.directory, "." + name + "." + randomUUID() + ".tmp");
    // The protected directory must grant only the intended consumer group
    // read access (or the equivalent inherited Windows ACL).
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o640);
    let created = false;
    try {
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally { await handle.close(); }
      const latest = await verify();
      if (latest.receipt_sha256 !== proof.receipt_sha256 || !sameStat(directoryStat, await store.check()))
        fail("INDEPENDENT_RECEIPT_CONTEXT_CHANGED");
      try {
        // Link publishes a complete file without overwriting any prior
        // evidence. The temporary alias is removed before consumers may
        // accept nlink=1. No replace/force or mutable latest pointer.
        await link(temporary, filename);
        created = true;
      } catch (error) { if (error?.code !== "EEXIST") throw error; }
    } finally { await unlink(temporary); }
    if (process.platform !== "win32") {
      const dirHandle = await open(store.directory, constants.O_RDONLY);
      try { await dirHandle.sync(); } finally { await dirHandle.close(); }
    }
    if (!sameStat(directoryStat, await store.check())) fail("INDEPENDENT_RECEIPT_DIRECTORY_CHANGED");
    const stored = await readEnvelopeFile(store, name);
    if (stored.payload !== envelope.payload || stored.signature !== envelope.signature)
      fail("INDEPENDENT_RECEIPT_CONFLICT");
    await verify();
    return Object.freeze({ published: true, created, execution_authorized: false,
      receipt_sha256: proof.receipt_sha256, expires_at_ms: proof.expires_at_ms });
  };
}


// Supervisor-owned writer counterpart to the protected outcome reader. This
// is NOT an adapter from CI logs or provider conclusions. Only the enrolled
// supervisor's separately trusted raw observation source can supply facts.
// No caller-supplied binding, exit code, arbitrary filename or key enrollment.
export function createIndependentOutcomeAttestationPublisher({
  root, assertProtectedDirectory, repository, supervisor, pinnedSupervisorKey,
  pinnedIssuerKey, readObservation, signPayload, maxAgeMs, ttlMs, clock=Date.now
}={}) {
  const store=boundary({root,assertProtectedDirectory,role:"outcome_supervisor"});
  if (typeof readObservation!=="function" || typeof signPayload!=="function"
    || typeof clock!=="function" || !Number.isSafeInteger(ttlMs) || ttlMs<1
    || !Number.isSafeInteger(maxAgeMs) || ttlMs>maxAgeMs)
    fail("INDEPENDENT_OUTCOME_PUBLISHER_HOST_UNBOUND");
  const observerOptions={repository,supervisor,pinnedSupervisorKey,pinnedIssuerKey,maxAgeMs,clock};
  // Validate distinct Ed25519 identities before accessing any observation.
  createIndependentTestOutcomeObserver({...observerOptions,readAttestation:async()=>fail("INDEPENDENT_OUTCOME_SOURCE_UNAVAILABLE")});
  const keys=["execution_ok","passed","timed_out","skipped","exit_code"];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function observation(value) {
    if (!exact(value,["binding","outcome"]) || !exact(value.outcome,keys)
      || keys.slice(0,4).some(k=>typeof value.outcome[k]!=="boolean")
      || !(value.outcome.exit_code===null || (Number.isInteger(value.outcome.exit_code)
        && value.outcome.exit_code>=-2147483648 && value.outcome.exit_code<=4294967295))
      || (value.outcome.passed && (!value.outcome.execution_ok || value.outcome.timed_out
        || value.outcome.skipped || value.outcome.exit_code!==0)))
      fail("INDEPENDENT_OUTCOME_RESULT_INVALID");
    const name=independentOutcomeAttestationFilename(value.binding);
    return {name,binding:Object.fromEntries(outcomeBindingFields.map(k=>[k,value.binding[k]])),
      outcome:Object.fromEntries(keys.map(k=>[k,value.outcome[k]]))};
  }
  return async function publish(observationId) {
    if (typeof observationId!=="string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(observationId))
      fail("INDEPENDENT_OUTCOME_OBSERVATION_ID_INVALID");
    const current=async()=>observation(structuredClone(await readObservation(observationId)));
    const first=await current(),directoryStat=await store.check(),now=clock();
    if (!Number.isSafeInteger(now) || now<first.binding.completed_at_ms
      || now-first.binding.completed_at_ms>=maxAgeMs) fail("INDEPENDENT_OUTCOME_EXPIRED");
    const verify=async envelope=>{
      const observe=createIndependentTestOutcomeObserver({...observerOptions,readAttestation:async()=>envelope});
      const verified=await observe(first.binding);
      if (!same(Object.fromEntries(keys.map(k=>[k,verified[k]])),first.outcome))
        fail("INDEPENDENT_OUTCOME_PUBLICATION_CONFLICT");
    };
    const fence=async()=>{
      if (!same(first,await current()) || !sameStat(directoryStat,await store.check()))
        fail("INDEPENDENT_OUTCOME_OBSERVATION_CHANGED");
    };
    // Identical already-published observations are idempotent, not re-signed.
    // Expired or conflicting existing records are not overwritten or renewed.
    try {
      const prior=await readEnvelopeFile(store,first.name,100*1024);
      await verify(prior);await fence();
      return Object.freeze({published:true,created:false,execution_authorized:false,
        attestation_sha256:createHash("sha256").update(JSON.stringify(prior)).digest("hex")});
    } catch(error) { if(error?.code!=="ENOENT") throw error; }
    const expires=Math.min(now+ttlMs,first.binding.completed_at_ms+maxAgeMs);
    const payload=JSON.stringify({schema_version:1,supervisor,repository,binding:first.binding,
      observed_at_ms:now,expires_at_ms:expires,outcome:first.outcome});
    const signature=await signPayload(Buffer.from(payload,"utf8"));
    if (!Buffer.isBuffer(signature)||signature.length!==64) fail("INDEPENDENT_OUTCOME_SIGNATURE_INVALID");
    const envelope={payload,signature:signature.toString("base64url")};
    await verify(envelope);await fence();
    const filename=path.join(store.directory,first.name);
    const temporary=path.join(store.directory,"."+first.name+"."+randomUUID()+".tmp");
    const handle=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o640);
    let created=false;
    try {
      try { await handle.writeFile(JSON.stringify(envelope));await handle.sync(); }
      finally { await handle.close(); }
      await fence();await verify(envelope);
      try { await link(temporary,filename);created=true; }
      catch(error) { if(error?.code!=="EEXIST") throw error; }
    } finally { await unlink(temporary); }
    if (process.platform!=="win32") {
      const dirHandle=await open(store.directory,constants.O_RDONLY);
      try {await dirHandle.sync();} finally {await dirHandle.close();}
    }
    await fence();
    const stored=await readEnvelopeFile(store,first.name,100*1024);
    await verify(stored);await fence();
    // If another writer won the atomic publication, validate the exact same
    // binding and outcome; never assert that our own signature was stored.
    if (created && !same(stored,envelope)) fail("INDEPENDENT_OUTCOME_PUBLICATION_CONFLICT");
    return Object.freeze({published:true,created,execution_authorized:false,
      attestation_sha256:createHash("sha256").update(JSON.stringify(stored)).digest("hex")});
  };
}
