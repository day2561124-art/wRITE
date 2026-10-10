import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(process.platform!=='win32'){
  console.log('Windows lifecycle pipe race regression skipped on this platform.');
}else{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>[
    'path','systemroot','windir','comspec','temp','tmp','pathext',
  ].includes(key.toLowerCase())));
  for(const mode of ['initial','reload','recovery']){
    const result=spawnSync(process.execPath,[
      path.join(root,'tests/mcp/fixtures/mcp-lifecycle-write-worker.mjs'),mode,
    ],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:20000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.match(result.stderr,/write EPIPE/);
    assert.doesNotMatch(result.stderr,/Unhandled 'error' event/);
    const proof=JSON.parse(result.stdout.trim());
    assert.equal(proof.status,'PASS');
    assert.equal(proof.mode,mode);
    assert.equal(proof.real_windows_pipe,true);
    assert.equal(proof.mutation_replayed,false);
    assert.equal(proof.pending_calls,0);
  }
  console.log('Windows initial, reload and recovery lifecycle pipe error regressions passed.');
}
