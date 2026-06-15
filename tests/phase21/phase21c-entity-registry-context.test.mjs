import assert from "node:assert";
import {
  buildChatgptBridgeWritingContext,
  buildChatgptBridgeProofingContext,
} from "../../server/src/chatgpt-bridge-service.mjs";

async function run() {
  // Disabled behavior: should not include entity context
  const disabled = await buildChatgptBridgeWritingContext({ includeEntityRegistry: false });
  assert(!disabled.entity_registry_context, "disabled: no entity_registry_context when not requested");

  const enabled = await buildChatgptBridgeWritingContext({ includeEntityRegistry: true, entityLimit: 5 });
  assert(enabled.entity_registry_context, "enabled: entity_registry_context present");
  assert(Array.isArray(enabled.entity_registry_context.entities), "entities array present");

  // Proofing mirrors writing behavior
  const p = await buildChatgptBridgeProofingContext({ includeEntityRegistry: true, entityLimit: 3 });
  assert(p.entity_registry_context, "proofing: entity_registry_context present");
  assert(Array.isArray(p.entity_registry_context.entities), "proofing entities array");

  console.log("Phase21C entity registry context test passed.");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
