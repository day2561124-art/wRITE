// Copied only into a disposable fixture's server/src directory. Never loaded by
// a production entry point. Real host/session/worker logic and results are kept.
import {registerHooks} from 'node:module';
import {readFile,writeFile,access,rename} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(path.basename(root)!=='repo'||!/^mcp-memory-[A-Za-z0-9]+$/.test(path.basename(path.dirname(root)))
 ||path.dirname(path.dirname(root))!==path.resolve(os.tmpdir()))throw Error('DISPOSABLE_MEMORY_FIXTURE_REQUIRED');
const control=path.join(root,'test-control');
export async function fixtureGate(kind,record={}){
 const enabled=await access(path.join(control,'gate-'+kind)).then(()=>true,e=>{if(e.code!=='ENOENT')throw e;return false;});
 if(!enabled)return;
 const entered=path.join(control,'entered-'+kind+'.json'),temporary=entered+'.'+process.pid+'.tmp';
 await writeFile(temporary,JSON.stringify({pid:process.pid,...record}));await rename(temporary,entered);
 const deadline=Date.now()+20000;
 while(Date.now()<deadline){
  try{await readFile(path.join(control,'release-'+kind));return;}catch(e){if(e.code!=='ENOENT')throw e;}
  await new Promise(r=>setTimeout(r,20));
 }
 throw Error('FIXTURE_GATE_NOT_RELEASED');
}
const names=['mcp-development-readonly-tools.mjs','pi-production-execution-controller.mjs','process-control.mjs'];
const targets=new Map(names.map(name=>[pathToFileURL(path.join(root,'server/src',name)).href,name]));
registerHooks({load(url,context,next){
 const name=targets.get(url);if(!name)return next(url,context);
 const actual=url+'?memory-fixture-original';
 let source=`export * from ${JSON.stringify(actual)};import * as original from ${JSON.stringify(actual)};`;
 if(name==='mcp-development-readonly-tools.mjs')source+=`
 import {fixtureGate} from ${JSON.stringify(import.meta.url)};
 export async function dev_read_file(input={},options={}){
  if(input.path==='tests/session-memory-slow.txt')await fixtureGate('read');
  return original.dev_read_file(input,options);
 }`;
 if(name==='pi-production-execution-controller.mjs')source+=`
 import {fixtureGate} from ${JSON.stringify(import.meta.url)};
 export function createPiProductionExecutionController(options={}){
  return original.createPiProductionExecutionController({...options,executionHook:async(stage,record)=>{
   await options.executionHook?.(stage,record);
   if(process.argv.includes('--pi-worker')&&stage==='before_dispatch')await fixtureGate('worker',{operation_id:record.state.operation_id});
  }});
 }`;
 if(name==='process-control.mjs')source+=`
 // All fixture operations are reads; no session child owns a physical task tree.
 // Use its held handle, not taskkill /T against possibly reused Windows PPIDs.
 export function terminateProcessTree(child){
  if(child&&child.exitCode===null&&child.signalCode===null)child.kill();
 }`;
 return {format:'module',shortCircuit:true,source};
}});
