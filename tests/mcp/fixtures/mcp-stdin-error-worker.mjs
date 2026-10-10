import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../../..');
const {createStdioSession}=await import(pathToFileURL(path.join(root,'server/src/mcp-http-stdio-adapter.mjs')));
const observations=[], children=[];
const safeEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>['path','systemroot','windir','comspec','temp','tmp','pathext'].includes(key.toLowerCase())));
const session=createStdioSession({spawnProcess:()=>{
 const child=spawn(process.execPath,[path.join(out,'mcp-stdin-error-peer.mjs')],{cwd:root,env:safeEnv,windowsHide:true,stdio:['pipe','pipe','pipe','ipc']});
 child.on('message',m=>observations.push({generation:children.indexOf(child)+1,message:m}));children.push(child);return child;
},callTimeoutMs:1000,readonlyRetryBaseDelayMs:1,recoveryMaxAttempts:2,recoveryBaseDelayMs:0,recoveryMaxDelayMs:0});
const rpc=m=>new Promise((resolve,reject)=>session.call(m,(e,r)=>e?reject(e):resolve(r)));
const wait=async predicate=>{const end=Date.now()+8000;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('bounded wait expired '+JSON.stringify(session.getStatus()));};
try{
 await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'epipe-probe',version:'1'}}});
 session.send({jsonrpc:'2.0',method:'notifications/initialized'});
 await rpc({jsonrpc:'2.0',id:2,method:'tools/list'});
 const original=session.child;
 // Block the event loop while terminating this owned peer, so exit has not yet
 // updated adapter state when the next write races the OS pipe closure.
 if(process.platform==='win32'){
  const kill=spawnSync('taskkill.exe',['/PID',String(original.pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});assert.equal(kill.status,0,kill.stderr);
 }else{process.kill(original.pid,'SIGKILL');}
 assert.equal(original.exitCode,null,'exercise death before the exit event is delivered');
 assert.equal(original.stdin.writable,true,'exercise write race rather than preflight not writable');
 await assert.rejects(rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'unsafe_write',arguments:{}}}),e=>e.code==='CHILD_DEAD');
 await wait(()=>session.getStatus().generation===2&&!session.getStatus().recovering);
 assert.equal(session.getStatus().last_recovery.ok,true);
 assert.equal(observations.filter(x=>x.generation===2&&x.message.tool==='unsafe_write').length,0,'mutation must never replay');
 await rpc({jsonrpc:'2.0',id:4,method:'ping'});
 assert.equal(session.pendingCallCount(),0);
 // Errors arriving after replacement or close must be consumed without disturbing new calls.
 original.stdin.emit('error',Object.assign(new Error('late pipe error'),{code:'EPIPE'}));
 assert.equal(session.getStatus().generation,2);
 console.log(JSON.stringify({status:'PASS',real_windows_pipe:process.platform==='win32',generation:2,mutation_replayed:false,pending_calls:0,observations}));
}finally{
 session.close();
 for(const child of children){const exited=child.exitCode!==null||child.signalCode!==null;if(!exited){const done=once(child,'close');child.kill();await done;}}
 session.child.stdin.emit('error',Object.assign(new Error('closed session late error'),{code:'EPIPE'}));
}
