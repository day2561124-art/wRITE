import { randomUUID } from 'node:crypto';

// Pure IPC contract: importing a supervisor never loads execution stores.
export const PI_DURABLE_WORKER_PROTOCOL='writer-workbench/pi-durable-worker/v1';

const inspectionProtocol = 'writer-workbench/pi-inspection/v1';
const views = new Set(['journal', 'route']);
const requestIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const unavailable = () => new Error('PI_INSPECTION_UNAVAILABLE');

export function createPiInspectionClient(channel, { timeoutMs }) {
  const pending = new Map();
  let closed = false;
  function finish(entry, error, value) {
    if (pending.get(entry.view) !== entry) return;
    clearTimeout(entry.timer);
    pending.delete(entry.view);
    if (error) entry.reject(error);
    else entry.resolve(value);
  }
  function onMessage(message) {
    if (message?.protocol !== inspectionProtocol || message.kind !== 'response') return;
    const entry = pending.get(message.view);
    if (!entry || entry.id !== message.id) return;
    if (message.ok === true && message.value && typeof message.value === 'object') {
      finish(entry, null, message.value);
    } else {
      const error = /^PI_INSPECTION_(?:UNAVAILABLE|NOT_READY|TIMEOUT|FAILED)$/u.test(message.code)
        ? new Error(message.code) : new Error('PI_INSPECTION_FAILED');
      finish(entry, error);
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
  function inspect(view) {
    if (closed || !views.has(view) || !channel.connected || typeof channel.send !== 'function') {
      return Promise.reject(unavailable());
    }
    const existing = pending.get(view);
    if (existing) return existing.promise;
    const entry = { view, id: randomUUID() };
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    pending.set(view, entry);
    entry.timer = setTimeout(() => finish(entry, new Error('PI_INSPECTION_TIMEOUT')), timeoutMs);
    entry.timer.unref?.();
    try {
      channel.send({ protocol: inspectionProtocol, kind: 'request', id: entry.id, view }, error => {
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
  const onMessage = async message => {
    if (message?.protocol !== inspectionProtocol || message.kind !== 'request'
      || !views.has(message.view) || !requestIdPattern.test(message.id)) return;
    const response = { protocol: inspectionProtocol, kind: 'response', id: message.id, view: message.view };
    try {
      response.value = await inspect(message.view);
      response.ok = true;
    } catch (error) {
      response.code = /^PI_INSPECTION_(?:UNAVAILABLE|NOT_READY|TIMEOUT)$/u.test(error?.message)
        ? error.message : 'PI_INSPECTION_FAILED';
    }
    if (channel.connected) {
      try { channel.send(response, () => {}); } catch { /* IPC closed between check and send. */ }
    }
  };
  channel.on('message', onMessage);
  return () => channel.off('message', onMessage);
}
