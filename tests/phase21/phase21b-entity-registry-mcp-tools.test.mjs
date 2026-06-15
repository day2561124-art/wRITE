import assert from "node:assert";
import path from "node:path";
import {
  chatgpt_bridge_get_entity_registry_summary,
  chatgpt_bridge_search_canon_entities,
  chatgpt_bridge_get_canon_entity_detail,
  chatgpt_bridge_get_entity_conflicts,
  chatgpt_bridge_get_entity_registry_provenance,
} from "../../server/src/chatgpt-bridge-entity-registry-tools.mjs";

async function run() {
  const summary = await chatgpt_bridge_get_entity_registry_summary();
  assert(summary.ok === true, "summary should be ok");
  assert(typeof summary.total_entities === "number", "summary.total_entities present");

  const search = await chatgpt_bridge_search_canon_entities({ q: "", limit: 5 });
  assert(search.ok === true, "search ok");
  assert(Array.isArray(search.entities), "entities array");

  const first = search.entities[0];
  if (first) {
    const detail = await chatgpt_bridge_get_canon_entity_detail({ entity_id: first.entity_id });
    assert(detail.ok === true, "detail ok for existing entity");
    assert(detail.entity.entity_id === first.entity_id, "detail matches id");
  }

  const conflicts = await chatgpt_bridge_get_entity_conflicts({ limit: 5 });
  assert(conflicts.ok === true, "conflicts ok");
  assert(typeof conflicts.total_conflicts === "number", "conflict count present");

  const prov = await chatgpt_bridge_get_entity_registry_provenance();
  assert(prov.ok === true, "provenance ok");
  assert('active_engine_hash_at_build' in prov, "provenance has hashes");

  console.log("Phase21B entity registry MCP tools test passed.");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
