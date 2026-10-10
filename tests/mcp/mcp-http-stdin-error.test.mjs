import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(process.platform!=='win32'){
 console.log('Windows pipe death/write race regression skipped on this platform.');
}else{
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['path','systemroot','windir','comspec','temp','tmp','pathext'].includes(key.toLowerCase())));
 const result=spawnSync(process.execPath,[path.join(root,'tests/mcp/fixtures/mcp-stdin-error-worker.mjs')],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:20000});
 assert.ifError(result.error);
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stderr,/write EPIPE/);
 assert.doesNotMatch(result.stderr,/Unhandled 'error' event/);
 const proof=JSON.parse(result.stdout.trim());
 assert.equal(proof.real_windows_pipe,true);
 assert.equal(proof.generation,2);
 assert.equal(proof.mutation_replayed,false);
 assert.equal(proof.pending_calls,0);
 console.log('Windows real pipe EPIPE survival, recovery and no mutation replay regression passed.');
}
