import { randomUUID } from 'node:crypto';

// Pure IPC contract: importing a supervisor never loads execution stores.
export const PI_DURABLE_WORKER_PROTOCOL='writer-workbench/pi-durable-worker/v1';

const inspectionProtocol = 'writer-workbench/pi-inspection/v1';
const requestIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const maxPending = 32;
const safeErrors = new Set(['PI_INSPECTION_UNAVAILABLE','PI_INSPECTION_NOT_READY','PI_INSPECTION_TIMEOUT',
  'PI_INSPECTION_FAILED','PI_INSPECTION_BUSY','UNKNOWN_PI_OPERATION','WORKSPACE_CONTEXT_MISMATCH',
  'LEGACY_OPERATION_NOT_MIGRATED','CORRUPT_STATE','CORRUPT_ROUTE_STATE','CORRUPT_WORKER_DEFERRAL',
  'JOURNAL_LOCK_CONTENDED','JOURNAL_SNAPSHOT_UNSTABLE','JOURNAL_LOCK_RELEASE_FAILED']);
const unavailable = () => new Error('PI_INSPECTION_UNAVAILABLE');
const exactKeys = (value,keys) => value && typeof value==='object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',')===keys;

// Only the already exposed exact observational status selector is accepted.
// Normalize field order so in-flight coalescing cannot cross contexts or IDs.
// No commands, paths, general tool arguments, or authorization tokens cross IPC.
function requestKey(view,selector) {
  if (view==='journal'||view==='route') return selector===undefined?{key:view,selector:undefined}:null;
  if (view!=='operation') return null;
  const byOperation=exactKeys(selector,'context,operation_id')
    && typeof selector.operation_id==='string' && /^pi_operation_[a-f0-9]{32}$/u.test(selector.operation_id);
  const byIntent=exactKeys(selector,'context,intent_id')
    && typeof selector.intent_id==='string' && selector.intent_id.length>=1 && selector.intent_id.length<=128;
  if(!byOperation&&!byIntent) return null;
  const c=selector.context;
  if(!exactKeys(c,'project_id,workspace_id,workstream_id')||c.project_id!=='writer_workbench')return null;
  if(c.workstream_id===null){
    if(c.workspace_id!=='dev_workspace_shared_repository_v1')return null;
  }else if(typeof c.workstream_id!=='string'||!/^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u.test(c.workstream_id)
    ||typeof c.workspace_id!=='string'||! /^(?:dev_workspace_[a-f0-9]{24}|dev_workspace_shared_repository_v1)$/u.test(c.workspace_id))return null;
  const normalized={...(byOperation?{operation_id:selector.operation_id}:{intent_id:selector.intent_id}),
    context:{project_id:c.project_id,workspace_id:c.workspace_id,workstream_id:c.workstream_id}};
  return {key:JSON.stringify([view,normalized]),selector:normalized};
}

export function createPiInspectionClient(channel, { timeoutMs }) {
  const pending = new Map();
  let closed = false;
  function finish(entry, error, value) {
    if (pending.get(entry.key) !== entry) return;
    clearTimeout(entry.timer);
    pending.delete(entry.key);
    if (error) entry.reject(error);
    else entry.resolve(value);
  }
  function onMessage(message) {
    if (message?.protocol !== inspectionProtocol || message.kind !== 'response') return;
    const request=requestKey(message.view,message.selector);
    const entry=request&&pending.get(request.key);
    if (!entry || entry.id !== message.id) return;
    if (message.ok === true && message.value && typeof message.value === 'object') {
      finish(entry, null, message.value);
    } else {
      finish(entry, new Error(safeErrors.has(message.code)?message.code:'PI_INSPECTION_FAILED'));
    }
  }
  function close() {
    closed = true;
    channel.off('message', onMessage);
    channel.off('disconnect', close);
    for (const entry of pending.values()) finish(entry, unavailable());
  }
  channel.on('message', onMessage);
  channel.once('disconnect', close);
  function inspect(view,selector) {
    const request=requestKey(view,selector);
    if (closed || !request || !channel.connected || typeof channel.send !== 'function') {
      return Promise.reject(unavailable());
    }
    const existing = pending.get(request.key);
    if (existing) return existing.promise;
    if(pending.size>=maxPending)return Promise.reject(new Error('PI_INSPECTION_BUSY'));
    const entry = { key:request.key, id: randomUUID() };
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    pending.set(entry.key, entry);
    entry.timer = setTimeout(() => finish(entry, new Error('PI_INSPECTION_TIMEOUT')), timeoutMs);
    entry.timer.unref?.();
    try {
      channel.send({ protocol: inspectionProtocol, kind: 'request', id: entry.id, view,
        ...(request.selector===undefined?{}:{selector:request.selector}) }, error => {
        if (error) finish(entry, unavailable());
      });
    } catch {
      finish(entry, unavailable());
    }
    return entry.promise;
  }
  return { inspect, close };
}

export function attachPiInspector(channel, inspect) {
  const active=new Set();
  let detached=false;
  const onMessage = async message => {
    if (detached||message?.protocol !== inspectionProtocol || message.kind !== 'request'
      || typeof message.id!=='string'||!requestIdPattern.test(message.id)) return;
    const request=requestKey(message.view,message.selector);
    if(!request||active.has(message.id))return;
    const response = { protocol: inspectionProtocol, kind: 'response', id: message.id, view: message.view,
      ...(request.selector===undefined?{}:{selector:request.selector}) };
    if(active.size>=maxPending){
      response.code='PI_INSPECTION_BUSY';
    }else{
      active.add(message.id);
      try {
        response.value = await inspect(message.view,request.selector);
        response.ok = true;
      } catch (error) {
        const code=error?.code??error?.message;
        response.code = safeErrors.has(code)?code:'PI_INSPECTION_FAILED';
      } finally {active.delete(message.id);}
    }
    if (!detached&&channel.connected) {
      try { channel.send(response, () => {}); } catch { /* IPC closed between check and send. */ }
    }
  };
  channel.on('message', onMessage);
  return () => {detached=true;channel.off('message', onMessage);};
}
