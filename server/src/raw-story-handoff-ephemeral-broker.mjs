import { createHash, randomBytes } from "node:crypto";
import {
  buildRawStoryIntegrityManifest,
} from "./raw-story-handoff-integrity-service.mjs";

export const rawStoryHandoffBrokerProtocol = "writer_workbench.raw_story_handoff_broker.v1";
export const rawStoryHandoffBrokerStorageScope = "mcp_http_parent_process_ephemeral_memory";
export const rawStoryHandoffIdPattern = /^raw_story_handoff_\d{8}-\d{6}-[a-f0-9]{12}$/u;

const agentRunIdPattern = /^agent_run_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const writingContextBundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function compactTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:T.]/gu, "").slice(0, 14);
}

function handoffTimestamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function requirePattern(value, pattern, message) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(message);
  return value;
}

function requireRunId(value) {
  return requirePattern(value, agentRunIdPattern, "external_brain_session_id is invalid for raw-story handoff sealing.");
}

function requireBundleId(value) {
  return requirePattern(value, writingContextBundleIdPattern, "writing_context_bundle_id is invalid for raw-story handoff sealing.");
}

function requireHandoffId(value) {
  return requirePattern(value, rawStoryHandoffIdPattern, "raw_story_handoff_id is invalid.");
}

function requireLeaseId(value) {
  return requirePattern(value, /^raw_story_lease_[a-f0-9]{32}$/u, "raw-story handoff lease identity is invalid.");
}

function publicReceipt(record) {
  if (!record) return null;
  return {
    raw_story_handoff_id: record.raw_story_handoff_id,
    run_id: record.run_id,
    writing_context_bundle_id: record.writing_context_bundle_id,
    raw_story_sha256: record.raw_story_sha256,
    created_at: record.created_at,
    status: record.lifecycle_status,
    lifecycle_status: record.lifecycle_status,
    acquired_at: record.acquired_at ?? null,
    consumed_at: record.consumed_at ?? null,
    invalidated_at: record.invalidated_at ?? null,
    payload_reference_active: typeof record.raw_story_text === "string",
    payload_release_semantics: typeof record.raw_story_text === "string"
      ? "active_process_local_reference"
      : "process_local_reference_released_not_secure_memory_erase",
    storage_scope: "process_local_ephemeral_memory",
    broker_storage_scope: record.broker_storage_scope,
    broker_runtime_process_instance_id: record.broker_runtime_process_instance_id,
    broker_persistence: "none",
    persists_across_process_restart: false,
  };
}

export function createRawStoryHandoffId(date = new Date()) {
  return `raw_story_handoff_${handoffTimestamp(date)}-${randomBytes(6).toString("hex")}`;
}

export function createEphemeralRawStoryHandoffBroker(options = {}) {
  const records = new Map();
  const brokerStorageScope = options.storage_scope ?? rawStoryHandoffBrokerStorageScope;
  const brokerRuntimeProcessInstanceId = options.broker_runtime_process_instance_id
    ?? `broker_runtime_${compactTimestamp()}-${randomBytes(12).toString("hex")}`;

  function store(input = {}) {
    const handoffId = requireHandoffId(input.raw_story_handoff_id);
    const runId = requireRunId(input.run_id);
    const bundleId = requireBundleId(input.writing_context_bundle_id);
    if (typeof input.raw_story_text !== "string" || !input.raw_story_text.trim()) {
      throw new Error("raw_story_text is required for single-ingress sealing.");
    }
    if (records.has(handoffId)) throw new Error("raw_story_handoff_id already exists in the parent broker.");

    const parentReceivedSha = sha256(input.raw_story_text);
    if (input.seal_ingress_raw_story_sha256 !== parentReceivedSha) {
      throw new Error("raw-story broker ingress SHA-256 mismatch; handoff was not created.");
    }
    const parentManifest = buildRawStoryIntegrityManifest(input.raw_story_text);
    if (JSON.stringify(input.raw_story_integrity_manifest) !== JSON.stringify(parentManifest)) {
      throw new Error("raw-story broker ingress integrity manifest mismatch; handoff was not created.");
    }

    const record = {
      raw_story_handoff_id: handoffId,
      run_id: runId,
      writing_context_bundle_id: bundleId,
      raw_story_sha256: parentReceivedSha,
      seal_ingress_raw_story_sha256: input.seal_ingress_raw_story_sha256,
      parent_broker_received_raw_story_sha256: parentReceivedSha,
      raw_story_integrity_manifest: parentManifest,
      raw_story_text: input.raw_story_text,
      created_at: new Date().toISOString(),
      lifecycle_status: "sealed",
      broker_storage_scope: brokerStorageScope,
      broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
      lease_id: null,
    };
    records.set(handoffId, record);
    return {
      ...publicReceipt(record),
      raw_story_integrity_manifest: parentManifest,
      seal_ingress_raw_story_sha256: input.seal_ingress_raw_story_sha256,
      parent_broker_received_raw_story_sha256: parentReceivedSha,
      internal_payload_continuity_exact_match: true,
    };
  }

  function acquire(input = {}) {
    const handoffId = requireHandoffId(input.raw_story_handoff_id);
    const runId = requireRunId(input.run_id);
    const bundleId = requireBundleId(input.writing_context_bundle_id);
    const record = records.get(handoffId);
    if (!record) throw new Error("raw_story_handoff_id was not found in parent-process ephemeral seal storage.");
    if (record.run_id !== runId) throw new Error("raw_story_handoff_id belongs to a different external_brain_session_id.");
    if (record.writing_context_bundle_id !== bundleId) throw new Error("raw_story_handoff_id belongs to a different writing_context_bundle_id.");
    if (record.lifecycle_status === "consumed") {
      throw new Error("raw_story_handoff_id has already been consumed and its exact payload reference was released.");
    }
    if (record.lifecycle_status === "invalidated") {
      throw new Error("raw_story_handoff_id was invalidated and its exact payload reference was released.");
    }
    if (record.lifecycle_status !== "sealed") {
      throw new Error("raw_story_handoff_id is already acquired and cannot be consumed concurrently.");
    }
    if (typeof record.raw_story_text !== "string") throw new Error("raw_story_handoff_id has no active exact payload reference.");

    const leaseId = `raw_story_lease_${randomBytes(16).toString("hex")}`;
    record.lifecycle_status = "acquired";
    record.acquired_at = new Date().toISOString();
    record.lease_id = leaseId;
    return {
      raw_story_handoff_id: handoffId,
      handoff_lease_id: leaseId,
      run_id: record.run_id,
      writing_context_bundle_id: record.writing_context_bundle_id,
      raw_story_sha256: record.raw_story_sha256,
      seal_ingress_raw_story_sha256: record.seal_ingress_raw_story_sha256,
      parent_broker_received_raw_story_sha256: record.parent_broker_received_raw_story_sha256,
      raw_story_integrity_manifest: record.raw_story_integrity_manifest,
      raw_story_text: record.raw_story_text,
      created_at: record.created_at,
      lifecycle_status: record.lifecycle_status,
      broker_storage_scope: brokerStorageScope,
      broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
      broker_persistence: "none",
    };
  }

  function terminalTransition(input, lifecycleStatus) {
    const handoffId = requireHandoffId(input.raw_story_handoff_id);
    const leaseId = requireLeaseId(input.handoff_lease_id);
    const record = records.get(handoffId);
    if (!record || record.lifecycle_status !== "acquired" || record.lease_id !== leaseId) {
      throw new Error("raw_story_handoff_id is not held by the supplied active broker lease.");
    }
    record.lifecycle_status = lifecycleStatus;
    record.lease_id = null;
    delete record.raw_story_text;
    if (lifecycleStatus === "consumed") record.consumed_at = new Date().toISOString();
    else record.invalidated_at = new Date().toISOString();
    return publicReceipt(record);
  }

  return Object.freeze({
    ownership: options.ownership ?? "mcp_http_parent",
    storage_scope: brokerStorageScope,
    persistence: "none",
    broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
    store,
    acquire,
    consume: (input = {}) => terminalTransition(input, "consumed"),
    abort: (input = {}) => terminalTransition(input, "invalidated"),
    getReceipt: (handoffId) => publicReceipt(records.get(requireHandoffId(handoffId))),
    getStorageStatus: () => ({
      storage_scope: "process_local_ephemeral_memory",
      broker_storage_scope: brokerStorageScope,
      broker_runtime_process_instance_id: brokerRuntimeProcessInstanceId,
      broker_persistence: "none",
      persists_across_process_restart: false,
      active_payload_count: [...records.values()].filter((record) => typeof record.raw_story_text === "string").length,
      receipt_count: records.size,
      secure_memory_erase_claimed: false,
    }),
  });
}
