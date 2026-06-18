import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";

async function runCase(name, adapters) {
  console.log(`\n=== ${name} ===`);
  const res = await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
    task_prompt: `Live test ${name}`,
    run_neural_traces: true,
    include_active_engine: false,
  }, { neuralAdapters: adapters });
  console.log('ok:', res.ok);
  console.log('neural_trace_complete:', res.result.bundle.neural_trace_complete);
  console.log('neural_modules_used:', res.result.bundle.neural_modules_used);
  console.log('missing_required_neural_modules:', res.result.bundle.missing_required_neural_modules ?? null);
}

(async () => {
  // adapters succeed for all modules
  const allAdapters = {
    scene_planner: async () => ({plan: true}),
    character_simulator: async () => ({sim: true}),
    neural_critic: async () => ({critique: true}),
    style_drift_detector: async () => ({drift: false}),
    over_governance_detector: async () => ({over: false}),
    writing_card_director: async () => ({director: true}),
  };
  await runCase('all-success', allAdapters);

  // adapters missing writing_card_director
  const partialAdapters = {
    scene_planner: async () => ({plan: true}),
    character_simulator: async () => ({sim: true}),
    neural_critic: async () => ({critique: true}),
    style_drift_detector: async () => ({drift: false}),
    over_governance_detector: async () => ({over: false}),
    // writing_card_director omitted
  };
  await runCase('missing-wcd', partialAdapters);
})();
