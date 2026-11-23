import { createHash } from 'node:crypto';

export const TRPG_LAUNCH_RESOLUTION = 'trpg_isolated_launch_attempt_observed';
export const TRPG_LAUNCH_RESOLUTION_TOOL = 'pi.journal.resolve_trpg_launch_attempt';
export const TRPG_LAUNCH_OUTCOME = 'launch_attempt_observed_result_unknown';

const incident = Object.freeze({
  parentId: 'dev_operation_7f1939fc82fb497a851065f9f40c60e1',
  childId: 'dev_operation_aab1879692fd4345b5a3a10263fe15b8',
  parentStart: '0c9fe6422ffa53923d50fec6b40fd8a6fa65f4630b3f80755b185f9f95e21d5f',
  childStart: 'ee2f701cda13f020eb92cb19623e94337276a63dcd959ca276aa20f65e2bf350',
  parentEnd: '84d846c02e265cbe5ef627b497f60e79dcf91e9b4b0659f03306221324048a18',
  childEnd: '1b4afa5960eff8ca55a37f7f2dc0d6dadb67f6c8664f864fe48034a145fc8453',
  claimHash: '4b1291eccd24918087f2dc217d51a93b0d66dd339752fff9dfb637dc641e046f',
  commandHash: 'eacfc993c579819815e826f520e13fc5d39fc5d5a071d1828e5bfb082e28c791',
  fingerprint: '1e76c6311b106539a3087b9c11b4c0afe361af3f063953469bc66baf70e5e9a1',
  key: 'pi-authorized-e8411b15d74d129989f2854526535d3d546cfdd4ebbf8050aa7078ffa1bc69fc',
  piId: 'pi_operation_9738faef4dbb4192918c7f27fa7eb207',
  intentId: 'trpg-start-second-channel-isolated-gateway-20261117-v1',
  decisionId: 'gpt-trpg-isolated-launch-attempt-20261117',
  fileStamp: Date.parse('2026-11-17T11:28:39.081Z'),
  filenames: ['remote-trpg-start-20261117-112839081.err.log', 'remote-trpg-start-20261117-112839081.out.log'],
});
const workspace = 'dev_workspace_shared_repository_v1';
const reason = 'Redirection files establish launch preparation only. The process start, readiness and exit code remain unknown. Close the incident without replay.';
const hash = value => createHash('sha256').update(value).digest('hex');
const reject = code => { throw new Error(code); };
const unsafe = () => reject('UNSAFE_TRPG_LAUNCH_RESOLUTION');

function validateObservations(rows) {
  if (!Array.isArray(rows) || rows.length !== incident.filenames.length) unsafe();
  for (const [i, row] of rows.entries()) {
    if (Object.keys(row ?? {}).sort().join(',') !== 'bytes,created_ms,name'
      || row.name !== incident.filenames[i] || row.bytes !== 0
      || !Number.isSafeInteger(row.created_ms) || Math.abs(row.created_ms - incident.fileStamp) > 2000) unsafe();
  }
}

export function trpgLaunchProofs(observations) {
  validateObservations(observations);
  return [[incident.childId, incident.childEnd, null], [incident.parentId, incident.parentEnd, incident.fingerprint]]
    .map(([operation_id, expected_terminal_hash, request_fingerprint_sha256]) => ({
      resolution_kind: TRPG_LAUNCH_RESOLUTION, operation_id, expected_terminal_hash, request_fingerprint_sha256,
      decision_owner: 'GPT', decision_id: incident.decisionId, reason, observations,
    }));
}

export function validateTrpgLaunchResolution(events, input, { requireChildReceipt = true } = {}) {
  const expected = trpgLaunchProofs(input.observations).find(x => x.operation_id === input.operation_id);
  const fields = Object.keys(expected ?? {});
  if (!expected || Object.keys(input).length !== fields.length
    || fields.some(k => k !== 'observations' && input[k] !== expected[k])) unsafe();
  const find = (hashValue, sequence, stage) => {
    const event = events.find(x => x.event_hash === hashValue && x.sequence === sequence && x.stage === stage);
    if (!event) unsafe();
    return event;
  };
  const parent = find(incident.parentStart, 65567, 'operation_started');
  const child = find(incident.childStart, 65568, 'operation_started');
  const parentTerminal = find(incident.parentEnd, 65652, 'operation_recovered');
  const childTerminal = find(incident.childEnd, 65651, 'operation_recovered');
  const claim = find(incident.claimHash, 65566, 'operation_completed').execution_projection;
  const action = claim?.intent?.requested_actions?.find(x => x.step_id === 'run');
  if (parent.operation_id !== incident.parentId || child.operation_id !== incident.childId
    || parent.operation_type !== 'mcp_mutation' || child.operation_type !== 'powershell_maintenance'
    || parent.parent_operation_id !== null || child.parent_operation_id !== parent.operation_id
    || parent.reconciliation_key !== incident.key || parent.request_fingerprint_sha256 !== incident.fingerprint
    || child.reconciliation_key !== null || child.request_fingerprint_sha256 !== null
    || child.result?.command_sha256 !== incident.commandHash || child.result.elevated !== false
    || child.result.timeout_ms !== 30000 || child.result.cwd !== 'E:\\武裝學院的二三事'
    || claim?.command?.type !== 'tool_call_started' || claim.state?.operation_id !== incident.piId
    || claim.intent?.intent_id !== incident.intentId || claim.runtime?.active_call?.idempotency_key !== incident.key
    || claim.runtime.owner?.pid !== child.diagnostic?.owner_pid || claim.runtime.owner?.hostname !== child.diagnostic?.hostname
    || action?.capability !== 'host.powershell' || action.idempotency_key !== incident.key
    || typeof action.input?.command !== 'string' || hash(action.input.command) !== incident.commandHash
    || parent.diagnostic?.owner_pid !== child.diagnostic?.owner_pid || parent.diagnostic?.hostname !== child.diagnostic?.hostname
    || [parent, child, parentTerminal, childTerminal].some(e =>
      e.tool_name !== 'powershell_run' || e.workspace_id !== workspace || e.workstream_id !== null || e.targets?.length !== 0)
    || [[parent, parentTerminal], [child, childTerminal]].some(([s,t]) =>
      t.operation_id !== s.operation_id || t.operation_type !== s.operation_type || t.parent_operation_id !== s.parent_operation_id
      || t.reconciles_event_id !== s.journal_event_id || t.result?.outcome !== 'ambiguous_effect'
      || t.result?.recovered_from_started_event_id !== s.journal_event_id || t.result?.reconciliation_required !== true)
    || events.some(e => e.stage === 'operation_started' && e.operation_type !== 'pi_terminal_resolution'
      && (e.parent_operation_id === child.operation_id || (e.parent_operation_id === parent.operation_id && e !== child)))) unsafe();
  if (requireChildReceipt && input.operation_id === parent.operation_id) {
    const receipt = events.find(e => e.operation_type === 'pi_terminal_resolution'
      && e.tool_name === TRPG_LAUNCH_RESOLUTION_TOOL && e.stage === 'operation_completed' && e.parent_operation_id === child.operation_id);
    const p = JSON.parse(receipt?.result?.resolution_record ?? 'null');
    if (!p || p.operation_id !== child.operation_id || receipt.reconciles_event_id !== childTerminal.journal_event_id
      || receipt.result.outcome !== TRPG_LAUNCH_OUTCOME || receipt.result.reconciliation_required !== false
      || JSON.stringify(p.observations) !== JSON.stringify(input.observations)) unsafe();
    validateTrpgLaunchResolution(events, p);
  }
  return input.operation_id === parent.operation_id
    ? { started: parent, terminal: parentTerminal, owners: [parent, child, parentTerminal, childTerminal] }
    : { started: child, terminal: childTerminal, owners: [parent, child, parentTerminal, childTerminal] };
}
