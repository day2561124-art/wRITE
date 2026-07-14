import { createHash, randomBytes } from "node:crypto";
import {
  buildRawStoryIntegrityManifest,
} from "./raw-story-handoff-integrity-service.mjs";
import {
  createEphemeralRawStoryHandoffBroker,
  createRawStoryHandoffId,
  rawStoryHandoffIdPattern,
} from "./raw-story-handoff-ephemeral-broker.mjs";

export { rawStoryHandoffIdPattern };

const agentRunIdPattern = /^agent_run_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const writingContextBundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
let runtimeProcessInstanceId = null;

function createRuntimeProcessInstanceId() {
  const random = randomBytes(12).toString("hex");
  const stamp = new Date().toISOString().replace(/[-:T.]/gu, "").slice(0, 14);
  return `runtime_process_${stamp}-${random}`;
}

export function getRuntimeProcessInstanceId() {
  if (!runtimeProcessInstanceId) runtimeProcessInstanceId = createRuntimeProcessInstanceId();
  return runtimeProcessInstanceId;
}

function requireRunId(value) {
  if (typeof value !== "string" || !agentRunIdPattern.test(value)) {
    throw new Error("external_brain_session_id is invalid for raw-story handoff sealing.");
  }
  return value;
}

function requireBundleId(value) {
  if (typeof value !== "string" || !writingContextBundleIdPattern.test(value)) {
    throw new Error("writing_context_bundle_id is invalid for raw-story handoff sealing.");
  }
  return value;
}

export const inProcessRawStoryHandoffBroker = createEphemeralRawStoryHandoffBroker({
  ownership: "explicit_in_process_runtime_adapter",
  storage_scope: "process_local_ephemeral_memory",
});

export function resolveRawStoryHandoffBroker(options = {}) {
  return options.rawStoryHandoffBroker ?? inProcessRawStoryHandoffBroker;
}

export function assertRawStoryHandoffSessionScope(input = {}) {
  const runId = requireRunId(input.run_id);
  const bundleId = requireBundleId(input.writing_context_bundle_id);
  if (input.runtime_process_instance_id !== undefined && typeof input.runtime_process_instance_id === "string") {
    if (input.runtime_process_instance_id !== getRuntimeProcessInstanceId()) {
      throw new Error("runtime_process_instance_id does not match the current process runtime instance.");
    }
  }
  return { run_id: runId, writing_context_bundle_id: bundleId, runtime_process_instance_id: getRuntimeProcessInstanceId() };
}

export async function sealRawStoryHandoff(input = {}, options = {}) {
  const scope = assertRawStoryHandoffSessionScope(input);
  if (typeof input.raw_story_text !== "string" || !input.raw_story_text.trim()) {
    throw new Error("raw_story_text is required for single-ingress sealing.");
  }
  const manifest = buildRawStoryIntegrityManifest(input.raw_story_text);
  const ingressSha = createHash("sha256").update(input.raw_story_text, "utf8").digest("hex");
  return resolveRawStoryHandoffBroker(options).store({
    raw_story_handoff_id: createRawStoryHandoffId(),
    run_id: scope.run_id,
    writing_context_bundle_id: scope.writing_context_bundle_id,
    raw_story_text: input.raw_story_text,
    seal_ingress_raw_story_sha256: ingressSha,
    raw_story_integrity_manifest: manifest,
  });
}

export async function acquireRawStoryHandoff(input = {}, options = {}) {
  return resolveRawStoryHandoffBroker(options).acquire(input);
}

export async function releaseRawStoryHandoffAcquisition(acquisition, options = {}) {
  if (!acquisition) return null;
  return resolveRawStoryHandoffBroker(options).abort({
    raw_story_handoff_id: acquisition.raw_story_handoff_id,
    handoff_lease_id: acquisition.handoff_lease_id,
  });
}

export async function completeRawStoryHandoffConsumption(acquisition, options = {}) {
  return resolveRawStoryHandoffBroker(options).consume({
    raw_story_handoff_id: acquisition.raw_story_handoff_id,
    handoff_lease_id: acquisition.handoff_lease_id,
  });
}

export function getRawStoryHandoffReceipt(handoffId) {
  return inProcessRawStoryHandoffBroker.getReceipt(handoffId);
}

export function getRawStoryHandoffStorageStatus() {
  return inProcessRawStoryHandoffBroker.getStorageStatus();
}
