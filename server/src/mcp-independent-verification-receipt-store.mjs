import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, lstat, realpath, link, unlink } from "node:fs/promises";
import path from "node:path";
import { reviewIndependentVerification } from "./mcp-independent-verification-evidence.mjs";

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

async function readEnvelopeFile(store, name) {
  const beforeRoot = await store.check();
  const filename = path.join(store.directory, name);
  const before = await lstat(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1
    || before.size < 1 || before.size > maxBytes) fail("INDEPENDENT_RECEIPT_FILE_UNVERIFIED");
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !sameStat(before, stat) || stat.size !== before.size || stat.nlink !== 1)
      fail("INDEPENDENT_RECEIPT_FILE_CHANGED");
    // Bounded read even if the file is modified concurrently.
    const buffer = Buffer.alloc(maxBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    const current = await lstat(filename);
    const afterRoot = await store.check();
    if (offset !== stat.size || offset > maxBytes || !sameStat(stat, after) || !sameStat(stat, current)
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

export function createIndependentReceiptReader({ root, assertProtectedDirectory } = {}) {
  const store = boundary({ root, assertProtectedDirectory, role: "consumer" });
  return async function readEnvelope(candidate) {
    // Returned data is untrusted until the candidate evidence gate verifies
    // its signature, policy, expiry and exact identity.
    return readEnvelopeFile(store, candidateName(candidate));
  };
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
