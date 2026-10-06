import {CAPABILITY_DEFINITIONS} from './pi-execution-contract.mjs';
import {createPiCapabilityIntrospection} from './pi-capability-introspection.mjs';

// Publish the registered host contract, never source files or caller modules.
// Only annotations are removed; validation keywords retain their exact values.
function publicSchema(value) {
 if(Array.isArray(value))return value.map(publicSchema);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!['description','title','default','$schema'].includes(key))
  .map(([key,item])=>[key,key==='properties'?Object.fromEntries(Object.entries(item).map(([name,schema])=>[name,publicSchema(schema)])):publicSchema(item)]));
}
export function createPiRuntimeCapabilityMetadata({tools,availability}={}) {
 if(!Array.isArray(tools))throw Error('INVALID_CAPABILITY_HOST_BINDING');
 const registry=new Map(tools.map(t=>[t.name,t]));
 const definitions=CAPABILITY_DEFINITIONS.map(cap=>{
  const tool=registry.get(cap.tool);if(!tool?.inputSchema)throw Error('CAPABILITY_SCHEMA_UNBOUND:'+cap.capability);
  const properties=Object.fromEntries([...cap.required,...cap.optional].map(name=>{
   const source=tool.inputSchema.properties?.[name];if(source===undefined)throw Error('CAPABILITY_FIELD_UNBOUND:'+cap.capability+':'+name);
   return [name,publicSchema(source)];
  }));
  return {capability_name:cap.capability,active_version:'1',versions:[{
   capability_version:'1',risk_class:tool.risk,input_schema:{type:'object',properties,required:[...cap.required],additionalProperties:false},
   output_schema:{type:'object',additionalProperties:true},deprecated:false,replacement_capability:null,
   route_policy:'pi_default_intent',pi_dispatchable:true,
  }]};
 });
 return createPiCapabilityIntrospection({definitions,availability});
}
