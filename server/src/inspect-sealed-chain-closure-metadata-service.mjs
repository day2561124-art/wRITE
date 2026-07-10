const METADATA_ALLOWLIST = Object.freeze([
  "source_chain",
  "source_chain_closed",
  "source_handoff_phase",
  "source_handoff_seal_digest",
  "explicit_scope_phase",
  "explicit_scope_id",
  "explicit_scope_acceptance_digest",
  "capability_contract_phase",
  "capability_contract_digest",
  "capability_contract_preview_digest",
  "capability_id",
  "capability_kind",
  "capability_scope",
  "capability_contract_status",
  "implementation_readiness_status",
  "full_run_all_status"
]);

const METADATA_KEYS = new Set(METADATA_ALLOWLIST);
const REQUIRED_IDENTITIES = Object.freeze({
  capability_id: "inspect_sealed_chain_closure_metadata",
  capability_kind: "read_only_status_inspection",
  capability_scope: "sealed_chain_closure_and_explicit_scope_metadata_only"
});

function reject(message) {
  throw new TypeError(message);
}

export function inspectSealedChainClosureMetadata(metadata) {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    reject("metadata_plain_object_required");
  }

  const prototype = Object.getPrototypeOf(metadata);
  if (prototype !== Object.prototype && prototype !== null) {
    reject("metadata_plain_object_required");
  }

  for (const key of Reflect.ownKeys(metadata)) {
    if (typeof key !== "string" || !METADATA_KEYS.has(key)) {
      reject(`metadata_key_not_allowed:${String(key)}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
    if (!descriptor || !("value" in descriptor)) {
      reject(`metadata_value_type_invalid:${key}`);
    }
    const expectedType = key === "source_chain_closed" ? "boolean" : "string";
    if (typeof descriptor.value !== expectedType) {
      reject(`metadata_value_type_invalid:${key}`);
    }
  }

  for (const [key, expected] of Object.entries(REQUIRED_IDENTITIES)) {
    if (!Object.hasOwn(metadata, key)) {
      reject(`metadata_identity_required:${key}`);
    }
    if (metadata[key] !== expected) {
      reject(`metadata_identity_mismatch:${key}`);
    }
  }

  return Object.freeze(Object.fromEntries(
    METADATA_ALLOWLIST
      .filter((key) => Object.hasOwn(metadata, key))
      .map((key) => [key, metadata[key]])
  ));
}
