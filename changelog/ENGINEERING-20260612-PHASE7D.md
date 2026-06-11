Phase 7D: MCP approval request E2E / UI confirmation boundary

- 新增端對端測試：`tests/mcp/mcp-approval-request-e2e.test.mjs`。
- 驗證 MCP approval request tools 能建立 `approval_queue` item，UI / approval queue 可讀取並由 UI (confirmApprovalItem) 執行高風險操作。
- 保持安全邊界：MCP 工具僅建立 approval request，不會直接 approve / activate / rollback / execute cleanup。
- 測試使用 fixture roots 並於結束時清理，確保 `data/canon_db/active_engine.md` 未被修改。
