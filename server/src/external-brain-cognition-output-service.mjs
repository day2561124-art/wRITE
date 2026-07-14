import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assertAgentRunId } from "./agent-run-service.mjs";
import { atomicWriteFile } from "./file-transactions.mjs";
import {
  assertNeuralTraceId,
  getNeuralTrace,
  hashNeuralValue,
} from "./neural-trace-service.mjs";
import { projectPaths } from "./project-paths.mjs";

const writingContextBundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;

export const priorAuthorshipCognitionModules = Object.freeze([
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
]);

const resultTypes = Object.freeze({
  scene_planner: "scene_plan",
  character_simulator: "character_simulation",
  neural_critic: "neural_critique",
  style_drift_detector: "style_drift_report",
  over_governance_detector: "over_governance_report",
});

function assertWritingContextBundleId(bundleId) {
  if (typeof bundleId !== "string" || !writingContextBundleIdPattern.test(bundleId)) {
    throw new Error("writing_context_bundle_id is invalid.");
  }
  return bundleId;
}

function assertPriorModule(moduleName) {
  if (!priorAuthorshipCognitionModules.includes(moduleName)) {
    throw new Error(`Unsupported prior cognition module: ${moduleName}.`);
  }
  return moduleName;
}

function cognitionOutputDirectory(runId, bundleId, moduleName) {
  assertAgentRunId(runId);
  assertWritingContextBundleId(bundleId);
  assertPriorModule(moduleName);
  return path.join(projectPaths.neuralModuleOutputs, runId, bundleId, moduleName);
}

function cognitionOutputPath(runId, bundleId, moduleName, traceId) {
  assertNeuralTraceId(traceId);
  return path.join(cognitionOutputDirectory(runId, bundleId, moduleName), `${traceId}.json`);
}

export function serializeCognitionCapabilityOutput(capabilityOutput) {
  const serialized = JSON.stringify(capabilityOutput);
  if (serialized === undefined) {
    throw new TypeError("capability_output must be JSON-serializable.");
  }
  return serialized;
}

function recordSortKey(record) {
  return `${String(record.called_at ?? "")}\u0000${String(record.trace_id ?? "")}`;
}

function integrityFailure(moduleName, code, message, record = null) {
  return {
    module_name: moduleName,
    code,
    message,
    trace_id: record?.trace_id ?? null,
    output_hash: record?.output_hash ?? null,
  };
}

async function readSelectedRecord(runId, bundleId, moduleName) {
  const directory = cognitionOutputDirectory(runId, bundleId, moduleName);
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return { missing: true };
    throw error;
  }
  const recordNames = names.filter((name) => (
    name.endsWith(".json") && /^neural_trace_\d{8}-\d{6}-[a-f0-9]{8}\.json$/u.test(name)
  ));
  if (recordNames.length === 0) return { missing: true };

  const records = [];
  for (const name of recordNames) {
    try {
      records.push(JSON.parse(await readFile(path.join(directory, name), "utf8")));
    } catch (error) {
      return {
        failure: integrityFailure(
          moduleName,
          "cognition_output_record_unreadable",
          `Prior cognition output record is unreadable for ${moduleName}: ${error.message}`,
        ),
      };
    }
  }
  records.sort((a, b) => recordSortKey(b).localeCompare(recordSortKey(a)));
  return { record: records[0] };
}

async function verifySelectedRecord(record, expected) {
  const { runId, bundleId, moduleName } = expected;
  const expectedCapabilityName = `run_${moduleName}`;
  const expectedResultType = resultTypes[moduleName];
  const checks = [
    [record?.run_id === runId, "run_id_mismatch", `Prior cognition run_id mismatch for ${moduleName}.`],
    [record?.external_brain_session_id === runId, "session_id_mismatch", `Prior cognition external_brain_session_id mismatch for ${moduleName}.`],
    [record?.writing_context_bundle_id === bundleId, "writing_context_bundle_id_mismatch", `Prior cognition writing_context_bundle_id mismatch for ${moduleName}.`],
    [record?.capability_name === expectedCapabilityName, "capability_identity_mismatch", `Prior cognition capability identity mismatch for ${moduleName}.`],
    [record?.module_name === moduleName, "module_identity_mismatch", `Prior cognition module identity mismatch for ${moduleName}.`],
    [record?.result_type === expectedResultType, "result_type_mismatch", `Prior cognition result_type mismatch for ${moduleName}.`],
    [typeof record?.trace_id === "string", "trace_id_missing", `Prior cognition trace_id is missing for ${moduleName}.`],
    [typeof record?.output_hash === "string", "output_hash_missing", `Prior cognition output_hash is missing for ${moduleName}.`],
    [Object.hasOwn(record ?? {}, "capability_output"), "capability_output_missing", `Prior cognition capability_output is missing for ${moduleName}.`],
  ];
  for (const [ok, code, message] of checks) {
    if (!ok) return integrityFailure(moduleName, code, message, record);
  }

  let trace;
  try {
    assertNeuralTraceId(record.trace_id);
    trace = await getNeuralTrace(record.trace_id);
  } catch (error) {
    return integrityFailure(
      moduleName,
      "trace_missing",
      `Successful neural trace is missing for prior cognition ${moduleName}: ${error.message}`,
      record,
    );
  }
  if (trace.status !== "success") {
    return integrityFailure(moduleName, "trace_not_success", `Prior cognition trace status is not success for ${moduleName}.`, record);
  }
  if (trace.run_id !== runId) {
    return integrityFailure(moduleName, "trace_run_id_mismatch", `Prior cognition trace run_id mismatch for ${moduleName}.`, record);
  }
  if (trace.module_name !== moduleName) {
    return integrityFailure(moduleName, "trace_module_identity_mismatch", `Prior cognition trace module identity mismatch for ${moduleName}.`, record);
  }
  if (trace.output_summary?.result_type !== expectedResultType) {
    return integrityFailure(moduleName, "trace_result_type_mismatch", `Prior cognition trace result_type mismatch for ${moduleName}.`, record);
  }
  if (trace.output_hash !== record.output_hash) {
    return integrityFailure(moduleName, "trace_output_hash_mismatch", `Prior cognition trace output_hash mismatch for ${moduleName}.`, record);
  }
  if (trace.called_at !== record.called_at) {
    return integrityFailure(moduleName, "trace_call_identity_mismatch", `Prior cognition trace call identity mismatch for ${moduleName}.`, record);
  }
  const semanticOutputHash = hashNeuralValue(serializeCognitionCapabilityOutput(record.capability_output));
  if (semanticOutputHash !== record.output_hash) {
    return integrityFailure(moduleName, "semantic_output_hash_mismatch", `Prior cognition semantic output hash mismatch for ${moduleName}.`, record);
  }
  return null;
}

export async function persistExternalBrainCognitionOutput(input = {}) {
  const runId = assertAgentRunId(input.run_id);
  const bundleId = assertWritingContextBundleId(input.writing_context_bundle_id);
  const moduleName = assertPriorModule(input.module_name);
  const trace = input.trace;
  if (!trace || trace.status !== "success") {
    throw new Error("Only a successful neural wrapper output may be persisted as prior cognition.");
  }
  if (trace.run_id !== runId || trace.module_name !== moduleName) {
    throw new Error("Cognition output identity must match its successful neural trace.");
  }
  const capabilityName = `run_${moduleName}`;
  if (input.capability_name !== capabilityName) {
    throw new Error(`capability_name must be ${capabilityName}.`);
  }
  const resultType = resultTypes[moduleName];
  if (input.result_type !== resultType || trace.output_summary?.result_type !== resultType) {
    throw new Error("Cognition output result_type must match the neural module specification and trace.");
  }
  const semanticOutputHash = hashNeuralValue(
    serializeCognitionCapabilityOutput(input.capability_output),
  );
  if (semanticOutputHash !== trace.output_hash) {
    throw new Error("Cognition output semantic hash must match the successful neural trace output_hash.");
  }
  const record = {
    schema_version: "phase47b-external-brain-cognition-output-v1",
    recorded_at: new Date().toISOString(),
    called_at: trace.called_at,
    run_id: runId,
    external_brain_session_id: runId,
    writing_context_bundle_id: bundleId,
    capability_name: capabilityName,
    module_name: moduleName,
    result_type: resultType,
    trace_id: trace.trace_id,
    output_hash: trace.output_hash,
    capability_output: input.capability_output,
  };
  await atomicWriteFile(
    cognitionOutputPath(runId, bundleId, moduleName, trace.trace_id),
    `${JSON.stringify(record, null, 2)}\n`,
    {
      name: "external-brain-cognition-output",
      run_id: runId,
      writing_context_bundle_id: bundleId,
      module_name: moduleName,
      trace_id: trace.trace_id,
    },
  );
  return record;
}

export async function loadVerifiedPriorAuthorshipCognition(input = {}) {
  const runId = assertAgentRunId(input.run_id);
  const bundleId = assertWritingContextBundleId(input.writing_context_bundle_id);
  const selectedSources = [];
  const missingModules = [];
  const integrityFailures = [];

  for (const moduleName of priorAuthorshipCognitionModules) {
    const selected = await readSelectedRecord(runId, bundleId, moduleName);
    if (selected.missing) {
      missingModules.push(moduleName);
      continue;
    }
    if (selected.failure) {
      integrityFailures.push(selected.failure);
      continue;
    }
    const failure = await verifySelectedRecord(selected.record, { runId, bundleId, moduleName });
    if (failure) {
      integrityFailures.push(failure);
      continue;
    }
    selectedSources.push({
      capability_name: selected.record.capability_name,
      module_name: moduleName,
      result_type: selected.record.result_type,
      trace_id: selected.record.trace_id,
      output_hash: selected.record.output_hash,
      capability_output: selected.record.capability_output,
    });
  }

  return {
    ok: missingModules.length === 0 && integrityFailures.length === 0,
    run_id: runId,
    writing_context_bundle_id: bundleId,
    canonical_ordering: [...priorAuthorshipCognitionModules],
    missing_modules: missingModules,
    integrity_failures: integrityFailures,
    selected_sources: selectedSources,
  };
}
