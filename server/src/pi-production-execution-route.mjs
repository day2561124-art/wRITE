import {hashExecutionInput} from "./pi-execution-contract.mjs";
import {validatePiExecutionHistory} from "./pi-execution-state-store.mjs";
import {reliableFailure,reliableJson} from "./pi-reliable-execution-state.mjs";
import {readDevProductionRoutes,appendDevProductionRoute} from "./mcp-development-journal-tools.mjs";
const initial=Object.freeze({schema_version:1,revision:0,previous_route_hash:null,route_hash:null,mode:"legacy_direct",decision_id:null,decision_owner:"GPT",gate_hash:null,updated_at:null});
function freeze(v){if(v&&typeof v==="object"){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function validatePiProductionRouteHistory(events){
 let prior=initial;const decisions=new Set();
 for(const e of events){let r;try{r=JSON.parse(e.result.route_record);}catch{reliableFailure("CORRUPT_ROUTE_STATE");}
  const keys=["schema_version","revision","previous_route_hash","route_hash","mode","decision_id","decision_owner","gate_hash","updated_at"];
  if(!r||Object.keys(r).sort().join(",")!==keys.sort().join(",")||r.schema_version!==1||r.revision!==prior.revision+1
   ||r.previous_route_hash!==prior.route_hash||!["pi_default","pi_paused"].includes(r.mode)||r.decision_owner!=="GPT"
   ||typeof r.decision_id!=="string"||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(r.decision_id)||decisions.has(r.decision_id)
   ||(r.mode==="pi_default"&&!/^[a-f0-9]{64}$/u.test(r.gate_hash))
   ||(r.mode==="pi_paused"&&r.gate_hash!==null)||typeof r.updated_at!=="string"||!Number.isFinite(Date.parse(r.updated_at))
   ||(prior.updated_at&&r.updated_at<prior.updated_at)||e.operation_type!=="pi_production_route"||e.stage!=="operation_completed"
   ||e.tool_name!=="pi.route.persist"||e.result.route_hash!==r.route_hash||e.result.route_revision!==r.revision)reliableFailure("CORRUPT_ROUTE_STATE");
  const {route_hash,...body}=r;if(route_hash!==hashExecutionInput(body))reliableFailure("CORRUPT_ROUTE_STATE");
  decisions.add(r.decision_id);prior=freeze(reliableJson(r));
 }return prior;
}
export function createPiProductionRouteStore({journal={readProductionRoutes:readDevProductionRoutes,appendProductionRoute:appendDevProductionRoute},clock=()=>new Date().toISOString()}={}){
 if(typeof journal.readProductionRoutes!=="function"||typeof journal.appendProductionRoute!=="function")reliableFailure("INVALID_ROUTE_STORE_BINDING");
 return Object.freeze({inspect:async()=>validatePiProductionRouteHistory(await journal.readProductionRoutes()),
 history:async()=>{const events=await journal.readProductionRoutes();validatePiProductionRouteHistory(events);return freeze(reliableJson(events));},
 change:async(source,{validateGate}={})=>{
  if(typeof validateGate!=="function")reliableFailure("CUTOVER_GATE_REQUIRED");
  const p=reliableJson(source);
  if(!p||Object.keys(p).sort().join(",")!=="decision_id,expected_revision,gate_hash,mode"
   ||!Number.isSafeInteger(p.expected_revision)||p.expected_revision<0||!["pi_default","pi_paused"].includes(p.mode)
   ||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(p.decision_id)
   ||(p.mode==="pi_default"&&!/^[a-f0-9]{64}$/u.test(p.gate_hash))||(p.mode==="pi_paused"&&p.gate_hash!==null))reliableFailure("INVALID_ROUTE_DECISION");
  const prior=validatePiProductionRouteHistory(await journal.readProductionRoutes());
  const body={schema_version:1,revision:p.expected_revision+1,previous_route_hash:prior.route_hash,mode:p.mode,decision_id:p.decision_id,decision_owner:"GPT",gate_hash:p.gate_hash,updated_at:clock()};
  const record={...body,route_hash:hashExecutionInput(body)};
  const published=await journal.appendProductionRoute(record,{expected_revision:p.expected_revision,validateHistory:validatePiProductionRouteHistory,
   validateGate:async evidence=>{const latest=validatePiExecutionHistory(evidence.verification.events.filter(e=>e.execution_projection!==undefined));
    if([...latest.values()].some(e=>e.execution_projection.runtime?.owner!==null&&e.execution_projection.runtime?.owner!==undefined))reliableFailure("ROUTE_ACTIVE_EXECUTION");
    if(await validateGate(evidence)!==true)reliableFailure("CUTOVER_GATE_FAILED");return true;}});
  return freeze(reliableJson(JSON.parse(published.result.route_record)));
 }});
}
