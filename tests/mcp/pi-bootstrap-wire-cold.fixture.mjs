import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=process.env.PI_POSTSEAL_WIRE_FIXTURE_ROOT;
if(!root||path.basename(root)!=='repo'||!/^pi-wire-[A-Za-z0-9]+$/u.test(path.basename(path.dirname(root)))||path.resolve(root,'..','..')!==path.resolve(os.tmpdir()))throw Error('FIXTURE_ROOT_REQUIRED');
const target=pathToFileURL(path.join(root,'server','src','pi-production-execution-controller.mjs')).href;
const actual=target+'?pi_postseal_actual';
registerHooks({load(url,context,next){if(url!==target)return next(url,context);
 return {format:'module',shortCircuit:true,source:`
 import * as original from ${JSON.stringify(actual)};
 export * from ${JSON.stringify(actual)};
 import {writeFile} from 'node:fs/promises';
 export function createPiProductionExecutionController(options={}) {
  if(process.env.PI_POSTSEAL_WIRE_EXIT!=='1')return original.createPiProductionExecutionController(options);
  return original.createPiProductionExecutionController({...options,executionHook:async(stage,record)=>{
   await options.executionHook?.(stage,record);
   if(stage==='after_receipt'&&record.state.completed_steps.includes('checkpoint')) {
    const receipt=record.receipts.find(r=>r.step_id==='checkpoint');
    const physical=JSON.parse(receipt.evidence.content[0].text);
    await writeFile(${JSON.stringify(path.join(root,'..','exit-checkpoint.json'))},JSON.stringify({pid:process.pid,operation_id:record.state.operation_id,binding:record.runtime.lifecycle_binding,checkpoint:physical}));
    process.exit(73);
   }
  }});
 }
 `};
}});
