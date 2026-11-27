import path from "node:path";
import { createIndependentVerifierService } from "./mcp-independent-verification-service.mjs";
import { createIndependentTestOutcomeObserver } from "./mcp-independent-verification-outcome.mjs";
import { createIndependentOutcomeAttestationReader, createIndependentReceiptReader } from "./mcp-independent-verification-receipt-store.mjs";
import { createIndependentCandidateEvidenceGate } from "./mcp-independent-verification-candidate.mjs";

// Trusted host composition only. No request can provide an outcome observer,
// choose an evidence path, enroll a key, or activate integration authority.
// Host enrollment must independently establish actual service identities,
// ownership and ACLs before calling these constructors.
const fail=code=>{throw Object.assign(new Error(code),{code});};
function absoluteRoot(value) {
  if(typeof value!=="string" || !path.isAbsolute(value) || value.includes("\0"))
    fail("INDEPENDENT_HOST_ROOT_INVALID");
  const resolved=path.resolve(value);
  return process.platform==="win32"?resolved.toLowerCase():resolved;
}
function distinctRoots(a,b) {
  const first=absoluteRoot(a),second=absoluteRoot(b);
  const contains=(parent,child)=>{
    const rel=path.relative(parent,child);
    return rel==="" || (!path.isAbsolute(rel) && rel!==".." && !rel.startsWith(".."+path.sep));
  };
  if(contains(first,second)||contains(second,first)) fail("INDEPENDENT_HOST_ROOTS_OVERLAP");
}

export function createProtectedIndependentVerifierService({
  policy, readContext, readRunSelection, signPayload, pinnedPublicKey, readCredential, fetchImpl,
  receiptRoot, assertReceiptDirectory, outcomeRoot, assertOutcomeDirectory, supervisor, pinnedSupervisorKey,
  clock=Date.now
}={}) {
  distinctRoots(receiptRoot,outcomeRoot);
  const readAttestation=createIndependentOutcomeAttestationReader({
    root:outcomeRoot,assertProtectedDirectory:assertOutcomeDirectory
  });
  const observeTestOutcome=createIndependentTestOutcomeObserver({
    repository:policy?.repository,supervisor,pinnedSupervisorKey,pinnedIssuerKey:pinnedPublicKey,
    readAttestation,maxAgeMs:policy?.max_age_ms,clock
  });
  return createIndependentVerifierService({policy,readContext,readRunSelection,signPayload,pinnedPublicKey,
    readCredential,fetchImpl,receiptRoot,assertProtectedDirectory:assertReceiptDirectory,
    observeTestOutcome,clock});
}

// Consumer has only the pinned receipt public key and read-only access.
// It never loads supervisor/issuer private keys or executes tests.
export function createProtectedIndependentCandidateGate({
  policy,pinnedPublicKey,receiptRoot,assertReceiptDirectory,clock=Date.now
}={}) {
  return createIndependentCandidateEvidenceGate({policy,pinnedPublicKey,
    readEnvelope:createIndependentReceiptReader({root:receiptRoot,assertProtectedDirectory:assertReceiptDirectory}),
    clock});
}
