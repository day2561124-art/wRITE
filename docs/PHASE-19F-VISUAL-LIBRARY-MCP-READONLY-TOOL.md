# Phase 19F — MCP Read-only Tool Registration for Visual Library

This phase registers a single MCP tool for read-only preview of the Visual Library UI import flow.

Tool name: `chatgpt_bridge_visual_library_ui_import_flow_preview`

Key constraints:
- Read-only and preview-only.
- Must not accept `execute` or confirmation arguments.
- Must not write visual index, assets, Approval Queue, approval items, `canon_visual_lock`, or modify `active_engine.md` or Canon DB.

Config: `config/visual-library-mcp-readonly-tool-registration.json`
Service: `server/src/visual-library-mcp-readonly-tool-service.mjs`
CLI preview: `scripts/visual-library-mcp-readonly-tool-preview.mjs`
Tests: `tests/engine/visual-library-mcp-readonly-tool-service.test.mjs`

This registration increases the MCP tool count by one and surfaces the tool to the ChatGPT bridge as a read-only capability.
