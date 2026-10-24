import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {computeWorkspaceSnapshot} from '../../server/src/mcp-development-journal-tools.mjs';
import {createWorkspaceChangeClock} from '../../server/src/mcp-workspace-change-clock.mjs';
import {createWorkspaceChangeClockProvider} from '../../server/src/mcp-workspace-change-clock-provider.mjs';
const exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
async function ownedRepo(){
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-porcelain-r138-'));
 const hooks=path.join(root,'empty-hooks');await mkdir(hooks);
 const git=async args=>(await exec(process.platform==='win32'?'git.exe':'git',['--no-optional-locks','-c','core.hooksPath='+hooks,'-c','commit.gpgsign=false',...args],{cwd:root,windowsHide:true,shell:false,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0'}})).stdout;
 await git(['-c','init.templateDir='+hooks,'init','-b','main']);
 await git(['config','user.name','Snapshot Path Regression']);await git(['config','user.email','snapshot@test.invalid']);
 await git(['config','core.quotepath','true']);
 await writeFile(path.join(root,'.gitignore'),'empty-hooks/\n');await writeFile(path.join(root,'base.txt'),'baseline\n');
 await git(['add','--all']);await git(['commit','-m','isolated baseline']);
 const context={root,workspace_id:'dev_workspace_'+randomUUID().replaceAll('-','').slice(0,24),current_head:(await git(['rev-parse','HEAD'])).trim(),workspace_type:'isolated_worktree'};
 const snapshot=()=>computeWorkspaceSnapshot(context,{allowParentSnapshotAuthority:false,allowMemoryFingerprintCache:false});
 const cleanup=async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('pi-porcelain-r138-'));await rm(root,{recursive:true,force:true});};
 return {root,git,snapshot,cleanup};
}
test('quoted Unicode snapshots keep exact path under core.quotepath=true',async()=>{
 const h=await ownedRepo();try{
  const n='保留目錄/原生檔案.txt',body=Buffer.from('exact native content\n');await mkdir(path.join(h.root,'保留目錄'));await writeFile(path.join(h.root,n),body);
  const display=await h.git(['status','--porcelain=v1','--untracked-files=all']);assert.ok(display.includes('\\'));
  const s=await h.snapshot();assert.equal(s.manifest.length,1);assert.equal(s.manifest[0].path,n);assert.equal(s.manifest[0].sha256,sha(body));assert.equal(s.manifest[0].state,'untracked');
 }finally{await h.cleanup();}
});
test('tracked Unicode modifications preserve native path and content hash',async()=>{
 const h=await ownedRepo();try{
  const n='前導 空白.txt';await writeFile(path.join(h.root,n),'old\n');await h.git(['add','--all']);await h.git(['commit','-m','tracked Unicode']);
  const body=Buffer.from('changed\n');await writeFile(path.join(h.root,n),body);
  const s=await h.snapshot();assert.equal(s.manifest.length,1);assert.equal(s.manifest[0].path,n);assert.equal(s.manifest[0].state,'modified');assert.equal(s.manifest[0].sha256,sha(body));
 }finally{await h.cleanup();}
});
test('NUL rename source field is consumed without becoming a status record',async()=>{
 const h=await ownedRepo();try{
  await h.git(['mv','base.txt','重新命名.txt']);await writeFile(path.join(h.root,'另外.txt'),'second\n');
  const s=await h.snapshot();assert.deepEqual(s.manifest.map(e=>e.path).sort(),['另外.txt','重新命名.txt'].sort());
  assert.ok(s.manifest.every(e=>e.artifact_type==='file'&&/^[a-f0-9]{64}$/.test(e.sha256)));
 }finally{await h.cleanup();}
});
test('native Git projection keeps the unstaged status prefix and rejects missed changes',async()=>{
 const h=await ownedRepo();let provider;
 try{
  await writeFile(path.join(h.root,'base.txt'),'modified without staging\n');
  const snapshot=await h.snapshot(),workspace_id='dev_workspace_shared_repository_v1';
  const clock=createWorkspaceChangeClock({provider_instance_id:'porcelain-native-git-projection'});
  let child,sequence=0;
  const emit=value=>child.stdout.emit('data',Buffer.from(JSON.stringify(value)+'\n'));
  provider=createWorkspaceChangeClockProvider({change_clock:clock,platform:'win32',fence_timeout_ms:1000,start_timeout_ms:1000,
   describe_workspace:async()=>({workspace_id,repository_root:h.root,watch_roots:[h.root],root_identity:'test-fixture-identity',fence_root:path.join(h.root,'tests/.tmp/.writer-workbench-watch-fences')}),
   root_identity_resolver:async()=> 'test-fixture-identity',
   // Only the watcher protocol is simulated. The default Git projection
   // validator is deliberately retained and reads the real owned repository.
   spawn_helper:()=>{child=new EventEmitter();child.pid=12345;child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.exitCode=null;child.signalCode=null;
    child.kill=signal=>{child.signalCode=signal;setImmediate(()=>child.emit('exit',null,signal));return true;};
    queueMicrotask(()=>emit({kind:'ready',watcher_count:1,roots:[h.root],process_id:child.pid}));return child;},
   write_fence:async filePath=>{queueMicrotask(()=>emit({kind:'event',sequence:++sequence,watch_index:0,root:h.root,change_type:'Created',full_path:filePath}));},
   remove_fence:async()=>{},
  });
  assert.equal((await provider.ensureReady({workspace_id})).ready,true);
  const begin=clock.beginSynchronization({workspace_id});assert.equal(begin.started,true);
  const fence=await provider.fenceSynchronization({workspace_id,token:begin.token,snapshot});assert.equal(fence.ok,true,fence.reason);
  assert.equal(fence.git_projection_checked,true);assert.equal(clock.completeSynchronization({workspace_id,token:begin.token}).completed,true);
  await writeFile(path.join(h.root,'missed.txt'),'not reported by simulated watcher\n');
  const reuse=await provider.prepareReuse({workspace_id,snapshot});assert.equal(reuse.ok,false);assert.equal(reuse.reason,'git_projection_changed');
 }finally{if(provider)provider.close();await h.cleanup();}
});
test('strict porcelain NUL parser preserves status whitespace and literal names',async()=>{
 const {parseGitPorcelainV1Z}=await import('../../server/src/git-status-porcelain.mjs');
 assert.deepEqual(parseGitPorcelainV1Z(' M 空 白.txt\0?? literal -> target.txt\0R  新名.txt\0原名.txt\0?? tail.txt\0'),[
  {status:' M',path:'空 白.txt',original_path:null},{status:'??',path:'literal -> target.txt',original_path:null},
  {status:'R ',path:'新名.txt',original_path:'原名.txt'},{status:'??',path:'tail.txt',original_path:null},
 ]);
 assert.deepEqual(parseGitPorcelainV1Z(''),[]);
 assert.equal(parseGitPorcelainV1Z('?? back\\slash.txt\0')[0].path,'back\\slash.txt');
 for(const malformed of ['?? lost terminator','R  target\0','?? \0',' M valid\0\0','## branch\0','ZZ invalid\0'])assert.throws(()=>parseGitPorcelainV1Z(malformed));
 assert.throws(()=>parseGitPorcelainV1Z(Buffer.from([0x3f,0x3f,0x20,0xff,0x00])));
});
