import { hashExecutionInput } from "./pi-execution-contract.mjs";

const workstreamIdPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const operationIdPattern = /^dev_operation_[a-f0-9]{32}$/u;
const bootstrapIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const purposes = new Set(["primary", "experiment", "candidate"]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function boundedString(value, label, max) {
  if (typeof value !== "string") fail("INVALID_" + label.toUpperCase());
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > max || /\u0000/u.test(normalized)) fail("INVALID_" + label.toUpperCase());
  return normalized;
}
function normalizeIds(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16) fail("INVALID_" + label.toUpperCase());
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || !workstreamIdPattern.test(item)) fail("INVALID_" + label.toUpperCase());
    if (!out.includes(item)) out.push(item);
  }
  return out;
}
function normalizeScope(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 64) fail("INVALID_DECLARED_SCOPE");
  const out = [];
  for (const item of value) {
    const normalized = boundedString(item, "declared_scope", 256);
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}
export function normalizePiWorkstreamBootstrap(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_BOOTSTRAP_REQUEST");
  const allowed = new Set(["bootstrap_id","label","purpose","parent_workstream_id","depends_on","declared_scope"]);
  if (Object.keys(input).some(key => !allowed.has(key))) fail("INVALID_BOOTSTRAP_REQUEST");
  const bootstrap_id = boundedString(input.bootstrap_id, "bootstrap_id", 128);
  if (!bootstrapIdPattern.test(bootstrap_id)) fail("INVALID_BOOTSTRAP_ID");
  const label = boundedString(input.label, "label", 160);
  const purpose = input.purpose ?? "primary";
  if (!purposes.has(purpose)) fail("INVALID_BOOTSTRAP_PURPOSE");
  const parent_workstream_id = input.parent_workstream_id ?? null;
  if (parent_workstream_id !== null && (typeof parent_workstream_id !== "string" || !workstreamIdPattern.test(parent_workstream_id))) {
    fail("INVALID_PARENT_WORKSTREAM");
  }
  return {
    bootstrap_id,
    label,
    purpose,
    parent_workstream_id,
    depends_on: normalizeIds(input.depends_on, "depends_on"),
    declared_scope: normalizeScope(input.declared_scope),
  };
}
export function piWorkstreamBootstrapFingerprint(input) {
  const normalized = normalizePiWorkstreamBootstrap(input);
  return hashExecutionInput({ tool_name: "dev_pi_begin_workstream", arguments: normalized });
}

// Binding is derived solely from a durable tool/reconciliation receipt. It never
// changes GPT content, permissions, scope or the original intent identity.
export function piBootstrapBinding(previous, capability, fact) {
  const workstream_id=fact?.workstream_id,workspace_id=fact?.workspace_id;
  const revision=fact?.workstream_revision??fact?.revision;
  const base_head=fact?.base_head;
  if(!workstreamIdPattern.test(workstream_id??"") || !/^[a-f0-9]{40}$/u.test(base_head??"")
    || !Number.isSafeInteger(revision) || revision<1) fail("CORRUPT_BOOTSTRAP_RESULT");
  if(capability==="workspace.begin_workstream") {
    if(previous!==null || workspace_id!=="dev_workspace_shared_repository_v1") fail("CORRUPT_BOOTSTRAP_RESULT");
  } else if(capability==="workspace.create_isolated") {
    if(!previous || previous.workstream_id!==workstream_id || previous.base_head!==base_head
      || previous.workspace_id!=="dev_workspace_shared_repository_v1"
      || !/^dev_workspace_[a-f0-9]{24}$/u.test(workspace_id??"") || fact.state!=="active"
      || revision<=previous.workstream_revision) fail("CORRUPT_BOOTSTRAP_RESULT");
  } else fail("INVALID_BOOTSTRAP_CAPABILITY");
  return {project_id:"writer_workbench",workstream_id,workspace_id,workstream_revision:revision,base_head};
}
export function piBootstrapContext(binding, original) {
  return binding?{project_id:binding.project_id,workstream_id:binding.workstream_id,workspace_id:binding.workspace_id}:original;
}
