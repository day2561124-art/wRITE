import crypto from 'crypto';
import fs from 'fs';

const ENDPOINT = 'http://127.0.0.1:8787/mcp';

function sha256OfFile(path) {
  const data = fs.readFileSync(path);
  return crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
}

async function postJson(body) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return text; }
}

async function run() {
  const activePath = 'data/canon_db/active_engine.md';
  const beforeSha = fs.existsSync(activePath) ? sha256OfFile(activePath) : null;

  console.log('Initialize...');
  const init = await postJson({ jsonrpc: '2.0', id: 'init-1', method: 'initialize', params: { protocolVersion: '1.0' } });
  console.log('initialize =>', init?.result ? 'OK' : init);

  console.log('tools/list...');
  const list = await postJson({ jsonrpc: '2.0', id: 'list-1', method: 'tools/list', params: {} });
  console.log('tools/list =>', Array.isArray(list?.result?.tools) ? `OK (${list.result.tools.length} tools)` : list);

  console.log('call chatgpt_bridge_get_workbench_status...');
  const call = await postJson({ jsonrpc: '2.0', id: 'call-1', method: 'tools/call', params: { name: 'chatgpt_bridge_get_workbench_status', arguments: {} } });
  console.log('call =>', call?.result ? 'OK' : call);

  const afterSha = fs.existsSync(activePath) ? sha256OfFile(activePath) : null;
  console.log('active_engine SHA before:', beforeSha);
  console.log('active_engine SHA after: ', afterSha);
  if (beforeSha && afterSha && beforeSha !== afterSha) {
    throw new Error('active_engine SHA changed');
  }
}

run().catch((err) => { console.error(err); process.exitCode = 2; });
