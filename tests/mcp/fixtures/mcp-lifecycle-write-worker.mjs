import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStdioSession} from '../../../server/src/mcp-http-stdio-adapter.mjs';

const fixture=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(fixture,'../../..');
const mode=process.argv[2];
assert.ok(['initial','reload','recovery'].includes(mode));
const children=[],errors=[],observations=[];
const safeEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>[
  'path','systemroot','windir','comspec','temp','tmp','pathext',
].includes(key.toLowerCase())));
const killOwnedPeer=child=>{
  const result=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{
    windowsHide:true,encoding:'utf8',
  });
  assert.equal(result.status,0,result.stderr);
  assert.equal(child.exitCode,null,'race OS death before the exit event');
  assert.equal(child.stdin.writable,true,'exercise a real pipe write');
};
const session=createStdioSession({spawnProcess:()=>{
  const child=spawn(process.execPath,[path.join(fixture,'mcp-stdin-error-peer.mjs')],{
    cwd:root,env:safeEnv,windowsHide:true,stdio:['pipe','pipe','pipe','ipc'],
  });
  children.push(child);
  const generation=children.length;
  child.on('message',message=>observations.push({generation,message}));
  const write=child.stdin.write.bind(child.stdin);
  child.stdin.write=(frame,...args)=>{
    const message=JSON.parse(String(frame).trim());
    if((mode==='initial'&&generation===1&&message.method==='initialize')
      ||(mode!=='initial'&&generation===2&&message.method==='notifications/initialized')){
      killOwnedPeer(child);
    }
    return write(frame,...args);
  };
  child.stdin.on('error',error=>errors.push({generation,code:error.code}));
  return child;
},callTimeoutMs:1000,recoveryMaxAttempts:2,recoveryBaseDelayMs:0,recoveryMaxDelayMs:0});
const rpc=message=>new Promise((resolve,reject)=>session.call(message,
  (error,result)=>error?reject(error):resolve(result)));
const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{
  protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'lifecycle-pipe-test',version:'1'},
}};
const wait=async predicate=>{
  const end=Date.now()+8000;
  while(Date.now()<end){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}
  throw Error('bounded wait expired '+JSON.stringify(session.getStatus()));
};
let outcome;
try{
  if(mode==='initial'){
    await assert.rejects(rpc(initialize),error=>error.code==='CHILD_DEAD');
    await wait(()=>errors.some(error=>error.code==='EPIPE'));
    assert.equal(session.getStatus().generation,1);
    assert.equal(session.getStatus().recovering,false);
    outcome='incomplete_lifecycle_not_replayed';
  }else{
    await rpc(initialize);
    session.send({jsonrpc:'2.0',method:'notifications/initialized'});
    await rpc({jsonrpc:'2.0',id:2,method:'tools/list'});
    if(mode==='reload'){
      await assert.rejects(session.restart(),error=>error.code==='CHILD_DEAD');
      outcome='failed_reload_rejected';
    }else{
      killOwnedPeer(session.child);
      await assert.rejects(rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{
        name:'unsafe_write',arguments:{},
      }}),error=>error.code==='CHILD_DEAD');
      await wait(()=>session.getStatus().generation===3&&!session.getStatus().recovering);
      assert.equal(session.getStatus().last_recovery.ok,true);
      assert.equal(session.getStatus().last_recovery.attempts,2);
      await rpc({jsonrpc:'2.0',id:4,method:'ping'});
      outcome='failed_handshake_recovered_within_existing_budget';
    }
  }
  assert.ok(errors.some(error=>error.code==='EPIPE'));
  assert.equal(observations.filter(item=>item.generation>1&&item.message.tool==='unsafe_write').length,0);
  assert.equal(session.pendingCallCount(),0);
  console.log(JSON.stringify({status:'PASS',mode,outcome,real_windows_pipe:true,
    pipe_errors:errors,generation:session.getStatus().generation,mutation_replayed:false,pending_calls:0}));
}finally{
  session.close();
  for(const child of children){if(child.exitCode===null&&child.signalCode===null){
    const done=once(child,'close');child.kill();await done;
  }}
}
