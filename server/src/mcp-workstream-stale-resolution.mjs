// Typed trusted-host evidence. This module has no dispatch or mutation entry.
import {createHash} from 'node:crypto';
import {lstat, readFile, readdir, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fingerprintMcpMutationRequest} from './mcp-operation-reconciliation-context.mjs';

export const WORKSTREAM_STALE_RESOLUTION = 'workstream_stale_before_write';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = /^[a-f0-9]{64}$/u;
// Reviewed implementations have the sole registry write after the locked CAS.
// A different implementation needs review rather than a permissive source regex.
const reviewedSources = new Set([
  '48acec9d232a35a10cdfb8aa0a950f21524281fef76d4836baf30a57103aa000',
  '1a1a5a0e6bf9ec9a1bbfd505c3b4189a79153a87b964965fba5e33ba0c189bc3',
]);
const fail = () => { throw new Error('UNSAFE_WORKSTREAM_STALE_RESOLUTION'); };

export function validateWorkstreamStaleResolution(events, input) {
  const own = events.filter(e => e.operation_id === input.operation_id);
  const started = own.find(e => e.stage === 'operation_started');
  const terminal = own.find(e => ['operation_failed', 'operation_completed', 'operation_recovered'].includes(e.stage));
  const request = input.original_request;
  if (!started || !terminal || own.length !== 2
    || started.operation_type !== 'mcp_mutation' || started.tool_name !== 'dev_workspace_update_workstream'
    || terminal.stage !== 'operation_failed' || terminal.result?.outcome !== 'ambiguous_effect'
    || terminal.operation_type !== started.operation_type || terminal.tool_name !== started.tool_name
    || terminal.workspace_id !== started.workspace_id || terminal.workstream_id !== started.workstream_id
    || terminal.reconciliation_key !== started.reconciliation_key || terminal.request_fingerprint_sha256 !== started.request_fingerprint_sha256
    || terminal.result?.reconciliation_required !== true || started.targets.length || terminal.targets.length
    || terminal.event_hash !== input.expected_terminal_hash || started.request_fingerprint_sha256 !== input.request_fingerprint_sha256
    || !request || Object.keys(request).sort().join(',') !== 'expected_revision,metadata,workstream_id'
    || !/^dev_workstream_\d{8}-\d{6}_[a-f0-9]{12}$/u.test(request.workstream_id ?? '')
    || !Number.isSafeInteger(request.expected_revision) || request.expected_revision < 1
    || !request.metadata || Array.isArray(request.metadata) || typeof request.metadata !== 'object'
    || fingerprintMcpMutationRequest(started.tool_name, request) !== input.request_fingerprint_sha256
    || !Number.isSafeInteger(input.observed_workstream_revision) || input.observed_workstream_revision < 1
    || input.observed_workstream_revision === request.expected_revision
    || !/^TX-\d{8}-\d{9}-[A-F0-9]{8}$/u.test(input.transaction_id ?? '')
    || !digest.test(input.transaction_sha256 ?? '') || !digest.test(input.registry_sha256 ?? '')
    || !reviewedSources.has(input.source_contract_sha256)
    || started.diagnostic?.hostname !== terminal.diagnostic?.hostname
    || started.diagnostic?.owner_pid !== terminal.diagnostic?.owner_pid
    || !Number.isFinite(Date.parse(started.timestamp)) || !Number.isFinite(Date.parse(terminal.timestamp))
    || Date.parse(terminal.timestamp) < Date.parse(started.timestamp)
    || Date.parse(terminal.timestamp) - Date.parse(started.timestamp) > 60000
    || started.timestamp.slice(0, 16) !== terminal.timestamp.slice(0, 16)
    || events.some(e => e.parent_operation_id === started.operation_id && e.stage === 'operation_started' && e.operation_type !== 'pi_terminal_resolution')
    || input.decision_owner !== 'GPT' || !/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(input.decision_id ?? '')
    || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1024) fail();
  return {started, terminal};
}

export async function inspectWorkstreamStaleResolution(root, started, terminal, input) {
  const base = await realpath(root);
  const read = async relative => {
    let current = base;
    const parts = relative.split('/');
    for (const [i, part] of parts.entries()) {
      current = path.join(current, part);
      const info = await lstat(current);
      if (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile() || info.size > 4 * 1024 * 1024)) fail();
    }
    return readFile(current);
  };
  const source = await read('server/src/mcp-development-workstream-tools.mjs');
  if (sha(source.toString('utf8').replaceAll('\r\n', '\n')) !== input.source_contract_sha256) fail();
  const bytes = await read('data/outputs/logs/development_runtime/workstream_registry.json');
  if (sha(bytes) !== input.registry_sha256) fail();
  const registry = JSON.parse(bytes.toString('utf8'));
  const {schema_version, revision, updated_at, workstreams} = registry;
  if (schema_version !== 1 || !Array.isArray(workstreams)
    || sha(JSON.stringify({schema_version, revision, updated_at, workstreams})) !== registry.checksum_sha256) fail();
  const matches = workstreams.filter(w => w.workstream_id === input.original_request.workstream_id);
  if (matches.length !== 1 || matches[0].revision !== input.observed_workstream_revision
    || !Number.isFinite(Date.parse(matches[0].updated_at)) || Date.parse(matches[0].updated_at) >= Date.parse(started.timestamp)
    || (started.workstream_id !== null && started.workstream_id !== matches[0].workstream_id)
    || (started.workspace_id !== 'dev_workspace_shared_repository_v1' && started.workspace_id !== matches[0].workspace_id)) fail();
  const prefix = 'TX-' + started.timestamp.slice(0, 16).replaceAll('-', '').replace('T', '-').replace(':', '');
  const directory = path.join(base, 'data/outputs/logs/transactions');
  const names = await readdir(directory);
  if (names.length > 500000) fail();
  const related = [];
  for (const name of names.filter(n => n.startsWith(prefix) && /^TX-\d{8}-\d{9}-[A-F0-9]{8}\.json$/u.test(n))) {
    const body = await read('data/outputs/logs/transactions/' + name);
    const tx = JSON.parse(body.toString('utf8'));
    if (tx.pid === started.diagnostic.owner_pid
      && Date.parse(tx.started_at) >= Date.parse(started.timestamp) && Date.parse(tx.started_at) <= Date.parse(terminal.timestamp)) related.push({tx, body, name});
  }
  const selected = related[0];
  if (related.length !== 1 || selected.name !== input.transaction_id + '.json') fail();
  const tx = selected.tx;
  if (sha(selected.body) !== input.transaction_sha256 || tx.transaction_id !== input.transaction_id
    || tx.name !== 'dev-workstream-registry' || tx.status !== 'rolled_back'
    || tx.metadata?.tool !== started.tool_name || tx.metadata?.runtime !== 'development_workstream_registry'
    || tx.affected_paths?.length !== 1 || tx.affected_paths[0] !== 'data/outputs/logs/development_runtime/workstream_registry.json'
    || !Array.isArray(tx.rollback_errors) || tx.rollback_errors.length || tx.rollback_available !== true
    || !Number.isFinite(Date.parse(tx.completed_at)) || Date.parse(tx.completed_at) < Date.parse(tx.started_at)
    || Date.parse(tx.completed_at) > Date.parse(terminal.timestamp)
    || tx.error !== `stale workstream revision: expected ${input.original_request.expected_revision}, current ${input.observed_workstream_revision}.`) fail();
  return {transaction_id: tx.transaction_id, verified: true};
}
