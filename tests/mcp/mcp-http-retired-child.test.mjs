import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs/promises';
import {createStdioSession} from '../../server/src/mcp-http-stdio-adapter.mjs';

// Event injection checks the generation-isolation contract. It is a unit test,
// separate from the real Windows pipe tests; it is not a production receipt.
const children=[],delayed=[];
const session=createStdioSession({spawnProcess:()=>{
  const child=new EventEmitter();child.pid=94000+children.length;
  child.exitCode=null;child.signalCode=null;child.connected=true;
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  child.stdin=new EventEmitter();child.stdin.writable=true;
  child.stdin.write=(frame,callback)=>{
    const message=JSON.parse(String(frame).trim());
    if(message.method==='test/defer-write'){
      delayed.push(callback);return true;
    }
    callback?.(null);
    if(message.id!==undefined){
      const result=message.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{},serverInfo:{name:'generation-unit',version:'1'}}:
        message.method==='tools/list'?{tools:[]}:{source:'current'};
      setTimeout(()=>child.stdout.emit('data',JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\n'),message.method==='test/slow'?75:0);
    }
    return true;
  };
  child.kill=()=>{child.signalCode='SIGTERM';child.stdin.writable=false;setImmediate(()=>child.emit('exit',null,'SIGTERM'));return true;};
  children.push(child);return child;
},callTimeoutMs:100,recoveryBaseDelayMs:0,recoveryMaxDelayMs:0});
const rpc=message=>new Promise((resolve,reject)=>session.call(message,(error,result)=>error?reject(error):resolve(result)));
try{
  await rpc({jsonrpc:'2.0',id:1,method:'initialize'});
  session.send({jsonrpc:'2.0',method:'notifications/initialized'});
  const original=session.child;
  const deferred=rpc({jsonrpc:'2.0',id:2,method:'test/defer-write'});
  await assert.rejects(deferred,error=>error.code==='CHILD_HUNG');
  const until=Date.now()+2000;
  while(session.getStatus().recovering||session.getStatus().generation!==2){
    assert.ok(Date.now()<until);await new Promise(resolve=>setTimeout(resolve,5));
  }
  const fresh=rpc({jsonrpc:'2.0',id:3,method:'test/slow'});
  original.stdout.emit('data',JSON.stringify({jsonrpc:'2.0',id:3,result:{source:'retired'}})+'\n');
  const response=await fresh;
  const beforeCallbackGeneration=session.getStatus().generation;
  delayed[0](Object.assign(new Error('late retired write failure'),{code:'EPIPE'}));
  await new Promise(resolve=>setTimeout(resolve,30));
  const proof={kind:'INJECTED_RETIRED_CHILD_EVENT_UNIT_CONTRACT',response_source:response.result.source,generation_before_late_callback:beforeCallbackGeneration,generation_after_late_callback:session.getStatus().generation,mock_transport:true,production_mutated:false};
  if(process.env.RETIRED_CHILD_REPORT)await fs.writeFile(process.env.RETIRED_CHILD_REPORT,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  if(process.env.RETIRED_CHILD_OBSERVE_ONLY!=='1'){
    assert.equal(proof.response_source,'current','retired stdout must not settle a fresh generation request');
    assert.equal(proof.generation_after_late_callback,beforeCallbackGeneration,'retired write callback must not restart current child');
  }
  console.log(JSON.stringify(proof));
}finally{session.close();}
