// One explicitly authorized host recovery. No MCP tool or command selector.
import {createHash} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
export const REVIEWED_INDEX_REFRESH = {
  "id": "reviewed-mcp-startup-index-refresh-20261108-v1",
  "root": "E:/武裝學院的二三事",
  "head": "38aaab44d374e4e4474a764ba444e7c09f5415f8",
  "index_entries_sha256": "c2f456f97dc7f98fee04635258f8380a21ca2d16fcdb61166c4020b4a9400203",
  "parent": {
    "actor": {
      "profile": "chatgpt_developer",
      "runtime": "writer_workbench",
      "tool_name": "powershell_run"
    },
    "diagnostic": {
      "hostname": "SDCP",
      "owner_pid": 24348
    },
    "event_hash": "d5d448058641ec07a4b643468e0b4ca530adc2bb8a1454807e92c17d2e5a0cc4",
    "journal_event_id": "dev_journal_event_80d86ea812b3459db1e91841d2d99134",
    "links": [],
    "operation_id": "dev_operation_14be4a13e6424d2a8035e88bbd462031",
    "operation_type": "mcp_mutation",
    "parent_operation_id": null,
    "previous_event_hash": "1c30019668770bfd51ea4082b21bd3a90b277858f6e6021239af545bb6238df4",
    "reconciles_event_id": null,
    "reconciliation_key": "mcp-startup-repair-index-refresh-20261108-01",
    "request_fingerprint_sha256": "a64e9c5cf7295cf0438a4ef6350f601333bc18be9d178c408e81808acb1041d0",
    "result": {},
    "schema_version": 1,
    "sequence": 60385,
    "stage": "operation_started",
    "targets": [],
    "timestamp": "2026-11-07T18:17:40.869Z",
    "tool_name": "powershell_run",
    "workspace_id": "dev_workspace_shared_repository_v1",
    "workstream_id": null
  },
  "child": {
    "actor": {
      "profile": "chatgpt_developer",
      "runtime": "writer_workbench",
      "tool_name": "powershell_run"
    },
    "diagnostic": {
      "hostname": "SDCP",
      "owner_pid": 24348
    },
    "event_hash": "044dd8f7e514e698fdc154f207bbdea4a6c10966ab9ee5ecb854e38cba96c2d9",
    "journal_event_id": "dev_journal_event_ab7be4df2e7c44a48b6412b55ac5ff93",
    "links": [],
    "operation_id": "dev_operation_e9bd8cb0fdbf4876912f17ff5786a0cd",
    "operation_type": "powershell_maintenance",
    "parent_operation_id": "dev_operation_14be4a13e6424d2a8035e88bbd462031",
    "previous_event_hash": "d5d448058641ec07a4b643468e0b4ca530adc2bb8a1454807e92c17d2e5a0cc4",
    "reconciles_event_id": null,
    "reconciliation_key": null,
    "request_fingerprint_sha256": null,
    "result": {
      "command_sha256": "39964da0789541c7366889276e9f86667046064e5df1c81109e4e052e499e844",
      "cwd": "E:\\武裝學院的二三事",
      "elevated": false,
      "timeout_ms": 120000
    },
    "schema_version": 1,
    "sequence": 60386,
    "stage": "operation_started",
    "targets": [],
    "timestamp": "2026-11-07T18:17:55.139Z",
    "tool_name": "powershell_run",
    "workspace_id": "dev_workspace_shared_repository_v1",
    "workstream_id": null
  },
  "artifacts": {
    "outputs/mcp-startup-repair/refresh-main-index.mjs": "320a47dee0c8d54e9ac06c346b0461b4645a475df551d5509db54d95cf82e900",
    "outputs/mcp-startup-repair/index-refresh.json": "a6c7ef628082503118a47fb017cff03b269244a63f46f8cc71b6aa3e807e2c79",
    "outputs/mcp-startup-repair/index-refresh-evidence.json": "02c88abb081e3d6b7cda4acbbc5309973c78bbcc04f77e940dbc5f22ca8c0986",
    "outputs/mcp-startup-repair/unrelated-before-integration.json": "23d193e156ff42e1ca48933653806d1132fd6604bf9a316a3d694d1d4b5dc13e",
    "outputs/mcp-startup-repair/recovery-authorization.json": "c2d2f842a2d173312ca41d69b7fa87a661303bbd5134adb5679bd542699dfe31"
  },
  "working": {
    ".gitignore": "fa59d6002fc0b5a50f4f5c832bd8df9acd6b6f70742e3341749126672ed32f55",
    "config/canon-zones.json": "ff42d430cbebbb88dd09686ef00f797d27b8e7eca22ac0a443afd86fd46f65d1",
    "config/engine-components.json": "a6292f0cd67316a217744e3bf34c80e3ab045637dafd0c98e47041e357982bae",
    "config/entity-intake.json": "09a75fa97b79c77d96612b8e486ba53be6d9be0b6d27929bb8f6b2e2a325d019",
    "config/entity-registry.json": "d8961dd3e855cabfcee88126551daf79d77f822490571b9a77d2a42f8bc8be1b",
    "config/settlement-completion-reminders.json": "4d4a8aca4c9597732ac8a926f374232999b86953229f820970f69347a4dfb780",
    "config/visual-asset-registry.json": "bd95e64eeee51c02b8f48f2988a8e584c7ebc476384f3ec3e59b95617086f401",
    "config/visual-library-approval-queue-import-dry-run.json": "44f99b5d9660f17adf6ed6e7ffbd67d99ec12a005b8037047ea3ae966eebeceb",
    "config/visual-library-bridge-readiness.json": "cd8775332877d834de9d66e80ed8e034e00ea210dc6b61510cf212a034640dbe",
    "config/visual-library-confirmed-import.json": "bdf00c5af8e9290f9ec76433750caf8550cd5e990297acd266dd486ebf5adbe8",
    "config/visual-library-controlled-import-guard.json": "9562ae1f77ccb2a25571cc77a5626fa0bd5271d9538b1f9a392379a11df4135c",
    "config/visual-library-controlled-import-trial.json": "110318b2a4631db0f08eaedb9f2f802069c87b402741579a15696c10b8d7ee67",
    "config/visual-library-final-acceptance.json": "db6cd09d09952f4dd64299fe982dc7b01f3edbf03855e80c4e6cd1ff8f5a85d5",
    "config/visual-library-final-e2e-acceptance.json": "1583bdd7be9574eb5a0e8ee869e634c7e633fe69ea3b14407de515b34855018e",
    "config/visual-library-import-simulation.json": "a4710cc19ce0bf05271aa11d3626d7736adf82d4f9d7ec24a493c0b6e9399e45",
    "config/visual-library-mcp-readonly-tool-registration.json": "65183804a55514eba1c6501d927b9c3a71b6c1c3dfb9ae114cdd2ad82291a731",
    "config/visual-library-pending-import-readiness.json": "5955c8fade1f1679b16e448d9b3e6c74a69297992643cf0d06a3ccf096b7b6fa",
    "config/visual-library-persistent-baseline-activation.json": "7e3ef2ed1e59e944a28513252c66153feb2a773d6f3a09453354c87648ae5bdf",
    "config/visual-library-persistent-baseline-transition.json": "ec5e39a0cf6a259f9df01124749217ff47862eeb4037783d8f4f6f48473f87f6",
    "config/visual-library-persistent-import-operator-checklist.json": "e5591bd814d3d22007339a53948aa7ab936c2609546056f138b627fc3d47150a",
    "config/visual-library-rebuild-intake.json": "ea257d584f19ccc176b20913ebd8f6757113119f3521efefd0922ed49475fce4",
    "config/visual-library-rollback-delete-restore.json": "9fe83b249164e3c311ddb55fd635f917a1a0b9d953c55b9d70e34c84b4b336a9",
    "config/visual-library-ui-import-flow.json": "cf799bbcda1fd7bec783635654701a1127d858762cfe063b9b2d0ab413499054",
    "config/visual-link-approval-queue-candidate.json": "60aeeac6d6e793471e80039088911060b3d556094532d30095a9bdb7d22aae08",
    "config/visual-link-approval-queue-import-dry-run.json": "339a96d99f2be6338f7e90ec4605dcd0e69566182e21700f538418ff00ed30f8",
    "config/visual-link-approval-queue-import-guard.json": "85b4e0d0297f0113e1ba708b904caeaeae49c6d021eecd230fab1269697cfcc6",
    "config/visual-link-approval-readiness.json": "8c0684efcebe330a9060382d658e57d57437c8a5f3d21bdb85fee932ffa1accd",
    "config/visual-link-final-acceptance.json": "097d92c062a0e11e0d13f70fa4a477af10c17a089e484d44466237230e1489a8",
    "data/canon_db/active_engine.md": "308b7f1dd270d76a3f414c62fd2610b552d221b5a2de0fb1c40a833d510291b5",
    "data/entity_registry/conflict_report.json": "23e3d34b0efdecec64123527902b37a78ea9e84cd54e9f93b472e6d1d02ef4a0",
    "data/entity_registry/entity_registry.index.json": "724033f003366213fa388e2691b796960dd0827e14ff608b161ca14ab3704ab4",
    "data/entity_registry/entity_registry.json": "9c7e6d5580a9d3ae7b7b3731b5ab3faadc17168a571fd04f7db69d2f45804203",
    "data/entity_registry/entity_registry_build_report.json": "450d03db2c2ef8e062d88b878f9314ce20285ebc139ffa2bd806bb18cb7688c8",
    "data/entity_registry/provenance.json": "144f668d3810eb2d81585aa3e45986cad976ddb0185c7751125f31d687b40fb7",
    "tests/maintenance/mcp-tool-inventory-baseline-reconciliation.test.mjs": "0519bb6c051b27676ad06107f18eb81a7adab39d63b2797833e4e24ed39cbba3",
    "scripts/start-mcp-tailscale.ps1": "d8d3e97afaf83046887a5f1cab5464bbd8891ae0e5709289dcae98b57917efd2"
  },
  "approval_sha256": "c2d2f842a2d173312ca41d69b7fa87a661303bbd5134adb5679bd542699dfe31",
  "decision_id": "gpt-mcp-startup-index-refresh-recovery-20261108"
};
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};freeze(REVIEWED_INDEX_REFRESH);
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const fail=()=>{throw Error('UNSAFE_INDEX_REFRESH_RECOVERY');};
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
const terminal=e=>['operation_completed','operation_failed','operation_recovered'].includes(e.stage);
export function indexRefreshResult(profile=REVIEWED_INDEX_REFRESH){
 return {outcome:'failed_intended_effect_observed',reconciliation_required:false,execution_ok:false,ok:false,
  recovery_profile:profile.id,decision_owner:'GPT',decision_id:profile.decision_id,approval_sha256:profile.approval_sha256,
  evidence_sha256:sha(stable(profile.artifacts)),parent_start_hash:profile.parent.event_hash,child_start_hash:profile.child.event_hash,
  observed_effect:'index_metadata_refresh_attempt',overlay_exit_code:128,index_entries_sha256:profile.index_entries_sha256,
  shell_exit_code_observed:false,automatic_replay_allowed:false};
}
export function validateIndexRefreshRecovery(events,event,profile=REVIEWED_INDEX_REFRESH){
 const expected=[profile.parent,profile.child].find(e=>e.operation_id===event.operation_id);if(!expected)return;
 // Ordinary automatic recovery remains ambiguous. Only this exact failed-effect
 // receipt may settle this reviewed case; it never asserts shell success.
 if(event.stage==='operation_started')return;
 if(event.stage==='operation_recovered'&&event.result?.outcome==='ambiguous_effect'&&event.result?.reconciliation_required===true)return;
 const started=events.find(e=>e.operation_id===expected.operation_id&&e.stage==='operation_started');
 if(!started||stable(started)!==stable(expected)||event.stage!=='operation_recovered'
  ||event.reconciles_event_id!==started.journal_event_id||event.sequence<=started.sequence
  ||['operation_type','tool_name','workstream_id','workspace_id','parent_operation_id','reconciliation_key','request_fingerprint_sha256'].some(k=>event[k]!==started[k])
  ||stable(event.targets)!==stable(started.targets)||stable(event.links)!==stable(started.links)
  ||stable(event.result)!==stable(indexRefreshResult(profile)))fail();
 if(expected.operation_id===profile.parent.operation_id){
  const children=events.filter(e=>e.operation_id===profile.child.operation_id&&terminal(e));
  if(children.length!==1||children[0].sequence>=event.sequence||stable(children[0].result)!==stable(indexRefreshResult(profile)))fail();
  validateIndexRefreshRecovery(events,children[0],profile);
 }
}
async function safeRead(root,name){
 if(path.isAbsolute(name)||name.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))fail();
 let current=root;for(const part of name.split('/')){current=path.join(current,part);if((await lstat(current)).isSymbolicLink())fail();}
 const s=await lstat(current);if(!s.isFile()||s.size>32*1024*1024)fail();return readFile(current);
}
export async function inspectIndexRefreshRecovery({journal,root=REVIEWED_INDEX_REFRESH.root,profile=REVIEWED_INDEX_REFRESH,snapshot}){
 if(await realpath(root)!==await realpath(profile.root))fail();
 const v=snapshot??await journal.verify(),ids=[profile.child.operation_id,profile.parent.operation_id];
 if(v.active_operations.length||v.dangling_operations.some(id=>!ids.includes(id)))fail();
 for(const expected of [profile.parent,profile.child]){
  const entries=v.events.filter(e=>e.operation_id===expected.operation_id),start=entries.find(e=>e.stage==='operation_started');
  if(stable(start)!==stable(expected)||start.diagnostic.hostname!==os.hostname()||alive(start.diagnostic.owner_pid))fail();
  const done=entries.filter(terminal);if(done.length>1)fail();if(done.length){if(stable(done[0].result)!==stable(indexRefreshResult(profile)))fail();validateIndexRefreshRecovery(v.events,done[0],profile);}
 }
 for(const [name,digest]of Object.entries({...profile.artifacts,...profile.working}))if(sha(await safeRead(root,name))!==digest)fail();
 const git=async(...args)=>(await run(process.platform==='win32'?'git.exe':'git',['--no-pager','-c','core.fsmonitor=false',...args],{cwd:root,windowsHide:true,timeout:15000,maxBuffer:32*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}})).stdout;
 if((await git('rev-parse','HEAD')).trim()!==profile.head||sha(await git('ls-files','--stage','-z'))!==profile.index_entries_sha256
  ||(await git('diff','--cached','--name-only')).trim())fail();
 return {verified:true,head:v.head,pending:ids.filter(id=>!v.events.some(e=>e.operation_id===id&&terminal(e))),v};
}
// The trusted host supplies exclusion/audit authority. A CLI flag, environment
// variable or MCP caller cannot create this lease or select another command.
export async function recoverIndexRefreshOperations({journal,authority,root=REVIEWED_INDEX_REFRESH.root,profile=REVIEWED_INDEX_REFRESH}){
 if(typeof authority!=='function')throw Error('HOST_RECOVERY_AUTHORITY_REQUIRED');
 return authority(profile,async lease=>{
  if(!lease||typeof lease.assertExclusive!=='function'||await lease.assertExclusive()!==true||lease.approval_sha256!==profile.approval_sha256)throw Error('HOST_RECOVERY_AUTHORITY_REQUIRED');
  const records=[];
  for(const id of [profile.child.operation_id,profile.parent.operation_id]){
   let proof=await inspectIndexRefreshRecovery({journal,root,profile});
   if(!proof.pending.includes(id)){records.push({operation_id:id,reconciled:true});continue;}
   const started=proof.v.events.find(e=>e.operation_id===id&&e.stage==='operation_started');
   const event=await journal.recover(id,{reconciles_event_id:started.journal_event_id,result:indexRefreshResult(profile),beforeAppend:async snapshot=>{
    if(await lease.assertExclusive()!==true)throw Error('HOST_RECOVERY_AUTHORITY_REQUIRED');
    const current=await inspectIndexRefreshRecovery({journal,root,profile,snapshot});
    if(stable(current.head)!==stable(snapshot.head)||!current.pending.includes(id))fail();
    validateIndexRefreshRecovery(snapshot.events,{...started,stage:'operation_recovered',sequence:snapshot.head.latest_sequence+1,reconciles_event_id:started.journal_event_id,result:indexRefreshResult(profile)},profile);
   }});
   records.push({operation_id:id,event_hash:event.event_hash,stage:event.stage});
  }
  return {records,journal:await journal.status()};
 });
}
