export const neuralAdapterProvenanceVersion =
  "phase62a-r2-neural-adapter-provenance-v1";

export const neuralAdapterExecutionKinds = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  UNATTESTED_CALLABLE: "unattested_callable",
  DETERMINISTIC_PROGRAMMATIC: "deterministic_programmatic",
  MODEL_BACKED_ATTESTED: "model_backed_attested",
});

const provenanceByAdapter = new WeakMap();

function requireAdapter(adapter) {
  if (typeof adapter !== "function") {
    throw new TypeError("neural adapter attestation requires a function.");
  }
  return adapter;
}

function text(value, maxLength = 240) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function attestationRecord(executionKind, metadata = {}) {
  const modelBacked =
    executionKind === neuralAdapterExecutionKinds.MODEL_BACKED_ATTESTED;
  const deterministicProgrammatic =
    executionKind === neuralAdapterExecutionKinds.DETERMINISTIC_PROGRAMMATIC;
  return Object.freeze({
    provenance_version: neuralAdapterProvenanceVersion,
    execution_kind: executionKind,
    attested: true,
    model_backed: modelBacked,
    deterministic_programmatic: deterministicProgrammatic,
    source: text(metadata.source ?? metadata.attestation_source),
    provider_id: text(metadata.provider_id ?? metadata.providerId),
    model_name: text(metadata.model_name ?? metadata.modelName),
    model_version: text(metadata.model_version ?? metadata.modelVersion),
  });
}

function attest(adapter, executionKind, metadata = {}) {
  requireAdapter(adapter);
  provenanceByAdapter.set(
    adapter,
    attestationRecord(executionKind, metadata),
  );
  return adapter;
}

export function attestDeterministicNeuralAdapter(
  adapter,
  metadata = {},
) {
  return attest(
    adapter,
    neuralAdapterExecutionKinds.DETERMINISTIC_PROGRAMMATIC,
    metadata,
  );
}

export function attestModelBackedNeuralAdapter(
  adapter,
  metadata = {},
) {
  return attest(
    adapter,
    neuralAdapterExecutionKinds.MODEL_BACKED_ATTESTED,
    metadata,
  );
}

export function getNeuralAdapterProvenance(adapter) {
  if (typeof adapter !== "function") {
    return {
      provenance_version: neuralAdapterProvenanceVersion,
      execution_kind: neuralAdapterExecutionKinds.NOT_CONFIGURED,
      attested: false,
      model_backed: false,
      deterministic_programmatic: false,
      source: null,
      provider_id: null,
      model_name: null,
      model_version: null,
    };
  }
  const attested = provenanceByAdapter.get(adapter);
  if (attested) return { ...attested };
  return {
    provenance_version: neuralAdapterProvenanceVersion,
    execution_kind: neuralAdapterExecutionKinds.UNATTESTED_CALLABLE,
    attested: false,
    model_backed: false,
    deterministic_programmatic: false,
    source: null,
    provider_id: null,
    model_name: null,
    model_version: null,
  };
}

export function buildNeuralAdapterExecutionEvidence(
  adapter,
  {
    invoked = false,
    completed = false,
  } = {},
) {
  const provenance = getNeuralAdapterProvenance(adapter);
  const adapterConfigured = typeof adapter === "function";
  const adapterInvoked = adapterConfigured && invoked === true;
  const adapterCompleted = adapterInvoked && completed === true;
  const modelBackedExecutionEvidenced =
    adapterCompleted && provenance.model_backed === true;
  return {
    neural_adapter_provenance_version:
      provenance.provenance_version,
    adapter_configured: adapterConfigured,
    adapter_invoked: adapterInvoked,
    adapter_completed: adapterCompleted,
    neural_adapter_execution_kind:
      provenance.execution_kind,
    neural_adapter_attested:
      provenance.attested,
    neural_adapter_model_backed:
      provenance.model_backed,
    neural_adapter_deterministic_programmatic:
      provenance.deterministic_programmatic,
    neural_adapter_source:
      provenance.source,
    neural_adapter_provider_id:
      provenance.provider_id,
    neural_adapter_model_name:
      provenance.model_name,
    neural_adapter_model_version:
      provenance.model_version,
    model_backed_execution_evidenced:
      modelBackedExecutionEvidenced,
  };
}
