// Pure release admission gate. This module does not read files, install software,
// execute scripts, or confer administrator authority. The trusted host must load
// the release key and state from its separately protected configuration.
import { createHash, createPublicKey, verify } from "node:crypto";

const repository = "day2561124-art/wRITE";
const commitPattern = /^[0-9a-f]{40}$/u;
const hashPattern = /^[0-9a-f]{64}$/u;
const maxTicketBytes = 8192;
const maxArtifactBytes = 1024 * 1024 * 1024;
const maxLifetimeMs = 24 * 60 * 60 * 1000;
const keys = ["schema_version", "repository", "channel", "sequence", "from_commit",
  "to_commit", "artifact_sha256", "artifact_bytes", "ci_run_id", "issued_at_ms", "expires_at_ms"];
function denied(code) { throw Object.assign(new Error(code), { code }); }
function exactObject(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every(key => Object.hasOwn(value, key));
}
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function signatureBytes(value) {
  // Ed25519 signatures are exactly 64 bytes. Reject noncanonical base64.
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{86}==$/u.test(value)) denied("RELEASE_SIGNATURE_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 64 || bytes.toString("base64") !== value) denied("RELEASE_SIGNATURE_INVALID");
  return bytes;
}
export function canonicalReleaseTicket(ticket) {
  if (!exactObject(ticket, keys)
    || ticket.schema_version !== 1 || ticket.repository !== repository || ticket.channel !== "protected-stable"
    || !integer(ticket.sequence) || ticket.sequence < 1
    || typeof ticket.from_commit !== "string" || !commitPattern.test(ticket.from_commit)
    || typeof ticket.to_commit !== "string" || !commitPattern.test(ticket.to_commit)
    || ticket.from_commit === ticket.to_commit
    || typeof ticket.artifact_sha256 !== "string" || !hashPattern.test(ticket.artifact_sha256)
    || !integer(ticket.artifact_bytes) || ticket.artifact_bytes < 1 || ticket.artifact_bytes > maxArtifactBytes
    || !integer(ticket.ci_run_id) || ticket.ci_run_id < 1
    || !integer(ticket.issued_at_ms) || !integer(ticket.expires_at_ms)
    || ticket.expires_at_ms <= ticket.issued_at_ms
    || ticket.expires_at_ms - ticket.issued_at_ms > maxLifetimeMs) denied("RELEASE_TICKET_INVALID");
  return Buffer.from(JSON.stringify(Object.fromEntries(keys.map(key => [key, ticket[key]]))), "utf8");
}

// trustedKey and state are operator/host inputs, NEVER dispatcher or ticket inputs.
// Admission must be followed by protected durable reservation before any effect.
// A verified ticket is NOT proof that artifact bytes, CI, ACLs or deployment passed.
export function admitProtectedRelease({ ticketBytes, signature, trustedKey, state, nowMs }) {
  if (!Buffer.isBuffer(ticketBytes) || ticketBytes.length < 1 || ticketBytes.length > maxTicketBytes)
    denied("RELEASE_TICKET_INVALID");
  let ticket;
  try { ticket = JSON.parse(ticketBytes.toString("utf8")); } catch { denied("RELEASE_TICKET_INVALID"); }
  const canonical = canonicalReleaseTicket(ticket);
  // No duplicate JSON members, alternate encodings, trailing bytes or whitespace.
  if (!canonical.equals(ticketBytes)) denied("RELEASE_TICKET_NONCANONICAL");
  let key;
  try { key = createPublicKey(trustedKey); } catch { denied("RELEASE_TRUST_KEY_INVALID"); }
  if (key.asymmetricKeyType !== "ed25519") denied("RELEASE_TRUST_KEY_INVALID");
  if (!verify(null, canonical, key, signatureBytes(signature))) denied("RELEASE_SIGNATURE_INVALID");
  if (!exactObject(state, ["active_commit", "last_reserved_sequence", "pending_release"])
    || typeof state.active_commit !== "string" || !commitPattern.test(state.active_commit)
    || !integer(state.last_reserved_sequence) || !integer(nowMs)) denied("RELEASE_HOST_STATE_INVALID");
  if (state.pending_release !== null) denied("RELEASE_RECONCILIATION_REQUIRED");
  if (nowMs < ticket.issued_at_ms || nowMs >= ticket.expires_at_ms) denied("RELEASE_TICKET_EXPIRED");
  if (ticket.sequence <= state.last_reserved_sequence) denied("RELEASE_SEQUENCE_REPLAY");
  if (ticket.from_commit !== state.active_commit) denied("RELEASE_ACTIVE_COMMIT_MISMATCH");
  return Object.freeze({
    admission: "verified_ticket_only",
    ticket_sha256: createHash("sha256").update(canonical).digest("hex"),
    sequence: ticket.sequence,
    from_commit: ticket.from_commit,
    to_commit: ticket.to_commit,
    artifact_sha256: ticket.artifact_sha256,
    artifact_bytes: ticket.artifact_bytes,
    ci_run_id: ticket.ci_run_id,
    expires_at_ms: ticket.expires_at_ms,
    deployment_authorized: false,
  });
}
