import { lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { atomicWriteFile, commitFileTransaction } from './file-transactions.mjs';
import { projectPaths } from './project-paths.mjs';

export const INTEGRATE_TOOL_NAME = 'dev_workspace_integrate';
const candidatePattern = '^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$';
export const integrationToolDefinition = {
  name: INTEGRATE_TOOL_NAME,
  description: '[high-risk-write] High-risk controlled local-main advancement for one exact ready integration candidate. Revalidates target/source/dependency freshness under the repository integration lock, refuses staged/conflicted/active-operation state, dry-runs dirty-main carry-forward, and advances only by the fixed validated fast-forward result while preserving unrelated dirty state.',
  inputSchema: {
    type: 'object',
    properties: {
      integration_candidate_id: { type: 'string', pattern: candidatePattern, maxLength: 64 },
      expected_revision: { type: 'integer', minimum: 1 },
    },
    required: ['integration_candidate_id', 'expected_revision'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false },
  _meta: {
    'armed-academy/permission': {
      tool_name: INTEGRATE_TOOL_NAME,
      permission_level: 'write_high_risk',
      read_or_write: 'write',
      risk_level: 'high-risk-write',
      requires_user_confirmation: true,
      requires_backup_before_write: false,
      allowed_sources: [
        'development_integration_registry',
        'development_workstream_registry',
        'repository_git_head',
        'repository_git_worktree_status',
        'repository_integration_lock',
        'mcp_client_expected_revision',
      ],
      forbidden_sources: ['unregistered_external_source', 'rejected_or_deprecated_source'],
      can_modify_canon: false,
      can_modify_active_engine: false,
      can_modify_story_graph: false,
      can_modify_memory: false,
      can_commit_error_report: false,
      log_required: true,
    },
  },
};

// This fixed local module is optional before Phase 2D is installed. Only absence
// is tolerated; a broken runtime or a symlink never grants a fallback route.
async function loadIntegrationRuntime() {
  const url = new URL('./mcp-development-integration-tools.mjs', import.meta.url);
  try {
    const info = await lstat(url);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe integration runtime module.');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  return import(url.href);
}

function validateArguments(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some((key) => !['integration_candidate_id', 'expected_revision'].includes(key))
    || typeof args.integration_candidate_id !== 'string'
    || !new RegExp(candidatePattern, 'u').test(args.integration_candidate_id)
    || !Number.isSafeInteger(args.expected_revision) || args.expected_revision < 1) {
    throw new Error('dev_workspace_integrate requires only a server-issued integration_candidate_id and positive expected_revision.');
  }
  return { integration_candidate_id: args.integration_candidate_id, expected_revision: args.expected_revision };
}

async function auditedIntegration(integrate, args, actor) {
  const auditId = `MCP-AUDIT-INTEGRATE-${randomUUID()}`;
  const intentPath = path.join(projectPaths.outputLogs, 'mcp_audit_intents', `${auditId}.json`);
  const record = {
    audit_id: auditId,
    created_at: new Date().toISOString(),
    status: 'started',
    tool_name: INTEGRATE_TOOL_NAME,
    risk: 'high-risk-write',
    actor,
    input_summary: args,
    ownership: 'mcp_http_parent',
  };
  // Fail closed before invoking the runtime if the durable intent cannot be written.
  await atomicWriteFile(intentPath, `${JSON.stringify(record)}\n`, {
    tool: 'mcp-audit-intent', audit_id: auditId,
  });
  let result;
  try {
    const candidate = await integrate(args);
    result = { content: [{ type: 'text', text: JSON.stringify(candidate) }] };
    record.status = 'completed';
    record.result = {
      integration_candidate_id: candidate.integration_candidate_id,
      revision: candidate.revision,
      state: candidate.state,
      integration_commit: candidate.integration_commit,
      failure_reason: candidate.failure_reason,
      stale_reason: candidate.stale_reason,
    };
  } catch (error) {
    record.status = 'tool_error';
    record.result = { code: error.code, message: error.message };
    result = { isError: true, content: [{ type: 'text', text: error.message }] };
  }
  await commitFileTransaction('mcp-audit-complete', [
    { type: 'append', filePath: path.join(projectPaths.outputLogs, 'mcp_tool_audit.jsonl'), content: `${JSON.stringify(record)}\n` },
    { type: 'delete', filePath: intentPath },
  ], { audit_id: auditId, tool_name: INTEGRATE_TOOL_NAME });
  return result;
}

// Runtime injection is an in-process test seam, never an MCP argument. The parent
// retains only this fixed function, not a tool registry or arbitrary dispatcher.
export function createParentIntegrationControl({
  profile,
  loadRuntime = loadIntegrationRuntime,
  audit = auditedIntegration,
}) {
  let integrate = null;
  let loading = null;
  async function prepare() {
    if (profile !== 'chatgpt_developer' || integrate) return;
    if (!loading) {
      loading = (async () => {
        const runtime = await loadRuntime();
        if (runtime === null) return;
        if (typeof runtime.dev_workspace_integrate !== 'function') {
          throw new Error('Integration runtime does not export dev_workspace_integrate.');
        }
        integrate = runtime.dev_workspace_integrate;
      })().finally(() => { loading = null; });
    }
    await loading;
  }
  function decorate(reply) {
    if (!integrate || profile !== 'chatgpt_developer' || !Array.isArray(reply?.result?.tools)) return reply;
    return {
      ...reply,
      result: {
        ...reply.result,
        tools: [
          ...reply.result.tools.filter((tool) => tool?.name !== INTEGRATE_TOOL_NAME),
          structuredClone(integrationToolDefinition),
        ],
      },
    };
  }
  async function call(message) {
    if (message?.method !== 'tools/call' || message?.params?.name !== INTEGRATE_TOOL_NAME) {
      throw new Error('Parent integration control accepts only dev_workspace_integrate.');
    }
    const id = message.id;
    if (id === undefined) return null;
    if (profile !== 'chatgpt_developer') {
      return { jsonrpc: '2.0', id, error: { code: -32602, message: `Tool not allowed by MCP tool profile ${profile}: ${INTEGRATE_TOOL_NAME}` } };
    }
    try {
      const args = validateArguments(message.params.arguments);
      await prepare();
      if (!integrate) throw new Error('Integration control is unavailable; load the Phase 2D runtime before bootstrap cleanup.');
      const actor = typeof message.params._meta?.actor === 'string' ? message.params._meta.actor.slice(0, 256) : 'mcp-client';
      return { jsonrpc: '2.0', id, result: await audit(integrate, args, actor) };
    } catch (error) {
      return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: error.message }] } };
    }
  }
  return { prepare, decorate, call };
}
