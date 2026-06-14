import assert from "node:assert/strict";
import {
  loadVisualLibraryMcpReadonlyToolConfig,
  validateVisualLibraryMcpReadonlyToolConfig,
  buildVisualLibraryMcpReadonlyToolDefinition,
  buildVisualLibraryMcpReadonlyToolInputSchema,
  runVisualLibraryMcpReadonlyToolPreview,
} from "../../server/src/visual-library-mcp-readonly-tool-service.mjs";

try {
  const { config } = await loadVisualLibraryMcpReadonlyToolConfig();
  assert.equal(validateVisualLibraryMcpReadonlyToolConfig(config), config);

  const def = buildVisualLibraryMcpReadonlyToolDefinition(config);
  assert.equal(def.name, config.tool_name);
  assert.equal(def.read_only, true);
  assert.equal(def.preview_only, true);
  assert.equal(def.accepts_execute, false);

  const schema = buildVisualLibraryMcpReadonlyToolInputSchema();
  const forbidden = [
    "execute",
    "confirm_text",
    "real_import_confirm_text",
    "delete_confirm_text",
    "restore_confirm_text",
    "rollback_confirm_text",
  ];
  for (const key of forbidden) {
    assert(!Object.prototype.hasOwnProperty.call(schema.properties, key), `schema must not contain ${key}`);
  }

  const empty = await runVisualLibraryMcpReadonlyToolPreview({}, { config });
  assert.ok(["empty_visual_library_mcp_readonly_preview_passed", "visual_library_mcp_readonly_preview_ready"].includes(empty.tool_decision));
  assert.equal(empty.action_availability?.can_execute, false);

  const blocked = await runVisualLibraryMcpReadonlyToolPreview({ execute: true }, { config });
  assert.equal(blocked.tool_decision, "blocked_forbidden_execute_argument");

  const blocked2 = await runVisualLibraryMcpReadonlyToolPreview({ confirm_text: "yes" }, { config });
  assert.equal(blocked2.tool_decision, "blocked_forbidden_confirmation_argument");

  console.log("Visual library MCP readonly tool service tests passed.");
} catch (err) {
  console.error(err);
  process.exit(1);
}
