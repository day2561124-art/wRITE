import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter,once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createStdioSession} from '../../server/src/mcp-http-stdio-adapter.mjs';

function fakeChild() {
  const child=new EventEmitter();
  Object.assign(child,{pid:90001,exitCode:null,signalCode:null,connected:true,
    stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:{writable:true,write(_frame,cb){cb?.();return true;}}});
  child.kill=()=>{child.signalCode='SIGTERM';setImmediate(()=>child.emit('exit',null,'SIGTERM'));return true;};
  return child;
}

test('idle close uses the held child only and never traverses a numeric PID tree',()=>{
  const original=childProcess.spawnSync,treeCalls=[];
  childProcess.spawnSync=(...args)=>{treeCalls.push(args);return {status:1};};syncBuiltinESMExports();
  const child=fakeChild(),session=createStdioSession({spawnProcess:()=>child});
  try {
    assert.equal(session.pendingCallCount(),0);
    session.close();session.close();
    assert.equal(child.signalCode,'SIGTERM');
    assert.equal(treeCalls.length,0,'idle close must not call taskkill /T with a recyclable PID');
    assert.equal(session.getStatus().closed,true);
  } finally {childProcess.spawnSync=original;syncBuiltinESMExports();}
});

test('explicit close with a pending call retains existing active-call cleanup',async()=>{
  const original=childProcess.spawnSync,treeCalls=[];
  childProcess.spawnSync=(...args)=>{treeCalls.push(args);return {status:1};};syncBuiltinESMExports();
  const child=fakeChild(),session=createStdioSession({spawnProcess:()=>child});
  try {
    const pending=new Promise(resolve=>session.call({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'unsafe_write',arguments:{}}},error=>resolve(error)));
    assert(session.pendingCallCount()>0);
    session.close();
    assert.equal((await pending).code,'SESSION_CLOSED');
    assert.equal(child.signalCode,'SIGTERM');
    if(process.platform==='win32'){
      assert.equal(treeCalls.length,1);
      assert.equal(treeCalls[0][0],'taskkill.exe');
      assert.deepEqual(treeCalls[0][1],['/pid','90001','/t','/f']);
    }
  } finally {session.close();childProcess.spawnSync=original;syncBuiltinESMExports();}
});

test('real idle session exits while an independently held background process survives',async()=>{
  const peer=fileURLToPath(new URL('./fixtures/mcp-stdin-error-peer.mjs',import.meta.url));
  const children=[];
  const spawnPeer=()=>{const child=childProcess.spawn(process.execPath,[peer],{windowsHide:true,stdio:['pipe','pipe','pipe','ipc']});children.push(child);return child;};
  const background=spawnPeer(),session=createStdioSession({spawnProcess:spawnPeer});
  try {
    await new Promise((resolve,reject)=>session.call({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'idle-stop-test',version:'1'}}},(e,r)=>e?reject(e):resolve(r)));
    assert.equal(session.pendingCallCount(),0);
    const exited=once(session.child,'exit');session.close();await exited;
    assert.equal(background.exitCode,null);
    assert.equal(background.signalCode,null);
    assert.equal(background.killed,false);
    assert.equal(session.getStatus().closed,true);
  } finally {
    // Cleanup is limited to exact handles created by this fixture.
    for(const child of children)if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited;}
    session.close();
  }
});
