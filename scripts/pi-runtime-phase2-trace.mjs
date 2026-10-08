// Trusted fixture-only preload. No production tracing activation or MCP API.
import {registerHooks} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {channel} from 'node:diagnostics_channel';
import {performance} from 'node:perf_hooks';
import {appendFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

const root=process.env.PI_PRESSURE_PHASE2_FIXTURE_ROOT;
if(!root||path.basename(root)!=='repo'||!/^pi-phase2-[a-zA-Z0-9]+$/u.test(path.basename(path.dirname(root)))
  ||path.resolve(root,'..','..')!==path.resolve(os.tmpdir())||realpathSync(root)!==path.resolve(root))
  throw Error('PHASE2_OWNED_TEMP_FIXTURE_REQUIRED');
const output=path.join(root,'..','trace.jsonl');
const spans=new AsyncLocalStorage(), events=channel('writer-workbench.pi-pressure.phase2');
let sequence=0;
events.subscribe(event=>appendFileSync(output,JSON.stringify(event)+'\n'));
export async function span(label, callback) {
  const parent=spans.getStore();
  const frame={id:++sequence,parent:parent?.id??null,request:parent?.request??null,label,children:0};
  const started=performance.now();
  let ok=false;
  try {const result=await spans.run(frame,callback);ok=true;return result;}
  finally {
    const ms=performance.now()-started;
    if(parent)parent.children+=ms;
    events.publish({kind:'span',...frame,ms,exclusive_ms:Math.max(0,ms-frame.children),ok,pid:process.pid});
  }
}
const received=new Map();
export function receive(message) {
  if(message?.id!==undefined&&received.size<256)received.set(String(message.id),performance.now());
}
export async function dispatchTrace(message,callback) {
  const request=String(message?.id??'notification');
  const start=performance.now(), entered=received.get(request)??start;
  received.delete(request);
  events.publish({kind:'queue',request,ms:start-entered,tool:message?.params?.name??null,pid:process.pid});
  return spans.run({id:null,request,children:0},()=>span('mcp.dispatch',callback));
}

const helper=JSON.stringify(import.meta.url);
const functions={
  'mcp-development-journal-tools.mjs':['verify','captureSnapshot','initialize','readProductionRoutes','readExecutionProjections','appendExecutionProjection','assertMutationAllowed'],
  'mcp-development-checkpoint-tools.mjs':['acquireStoreLock','withLock','initialize'],
  'mcp-powershell-maintenance-tools.mjs':['runPowerShellProcess'],
  'pi-production-execution-controller.mjs':['prepare'],
  'mcp-server.mjs':['auditSnapshotMap','auditedToolCall','callToolDirect'],
};
function wrapFunction(source,name,label) {
  const token='async function '+name+'(';
  if(!source.includes(token))return source;
  return source.replace(token,`async function ${name}(...args) {return __phase2Span(${JSON.stringify(label)},()=>__phase2_${name}(...args));}\nasync function __phase2_${name}(`);
}
registerHooks({load(url,context,next) {
  const result=next(url,context);
  if(!url.startsWith(pathToFileURL(path.join(root,'server','src')).href+'/')||url.includes('?phase2Original'))return result;
  const name=path.basename(new URL(url).pathname);
  if(!functions[name]&&name!=='pi-reliable-execution-engine.mjs')return result;
  let source=String(result.source);
  source=`import {span as __phase2Span, receive as __phase2Receive, dispatchTrace as __phase2Dispatch} from ${helper};\n`+source;
  for(const fn of functions[name]??[])source=wrapFunction(source,fn,name.replace('.mjs','')+'.'+fn);
  if(name==='mcp-server.mjs') {
    source=source.replace('function enqueueMessage(message, framing) {','function enqueueMessage(message, framing) {\n__phase2Receive(message);');
    source=source.replace('const response = await dispatch(message);','const response = await __phase2Dispatch(message,()=>dispatch(message));');
    source=source.replace('await ensureRuntimeReady();','await __phase2Span("runtime.readiness",()=>ensureRuntimeReady());');
    source=source.replaceAll('await tool.handler(effectiveArgs)','await __phase2Span("capability."+tool.name,()=>tool.handler(effectiveArgs))');
    source=source.replace('await writeMessage(response, framing);','await __phase2Span("mcp.serialize_and_write",()=>writeMessage(response, framing));');
  }
  if(name==='pi-reliable-execution-engine.mjs') {
    source=source.replace('await store.admit(source,{retry_policy:retryPolicy})','await __phase2Span("pi.admission",()=>store.admit(source,{retry_policy:retryPolicy}))');
    source=source.replace('await store.command({...args(),command})','await __phase2Span("pi.state_command",()=>store.command({...args(),command}))');
    source=source.replace('await adapter.execute(record.intent,stepId,binding())','await __phase2Span("pi.dispatch",()=>adapter.execute(record.intent,stepId,binding()))');
    source=source.replace('await adapter.reconcile(record.intent,call.step_id,binding())','await __phase2Span("pi.reconciliation",()=>adapter.reconcile(record.intent,call.step_id,binding()))');
  }
  return {...result,source};
}});
