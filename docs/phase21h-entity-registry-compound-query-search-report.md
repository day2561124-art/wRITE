# Phase 21H｜Entity Registry 中文 compound query 命中品質修正

## 目標

修正 ChatGPT bridge writing context 在啟用 entity registry 時，對中文複合查詢命中品質不足的問題。

代表查詢：

朝日奈千夜 九逃 醫療後座 未成立邊界

原先問題是該查詢會被當成整串文字比對，導致 entity_registry_context.entities 可能回傳空陣列。

## 修改範圍

- server/src/chatgpt-bridge-service.mjs
- server/src/chatgpt-bridge-entity-registry-tools.mjs

## 主要修正

### Writing context entity registry 查詢

chatgpt_bridge_build_writing_context 的 entity registry context 建構流程改為：

- 將中文 compound query 依空白與常見標點切成 token。
- 對 canonical_name、entity_id、aliases、source_excerpt、source_section、related_chapters、related_characters、related_entities 建立 haystack。
- 以 score 排序候選 entity。
- 保留 entityLimit 截斷與既有安全邊界。
- 不讀取 active_engine 全文至 ChatGPT 回傳內容。
- 不修改 canon、active_engine、compressed_rules 或任何 adoption/settlement 狀態。

### Direct entity search function

chatgpt_bridge_search_canon_entities 同步改善：

- 不再只比對 canonical_name / entity_id。
- 增加 aliases、source excerpt、related fields 查詢。
- 對 compound query 進行 token-based scoring。
- 維持 status/source trust 排序原則，canon 仍優先於 candidate。

## 驗證結果

### MCP profile 狀態

chatgpt_public profile 不允許直接呼叫 chatgpt_bridge_search_canon_entities。

因此 live MCP direct search 會被 profile 擋下，這是預期權限行為，不代表搜尋函式失敗。

### Live writing context 驗證

使用 chatgpt_bridge_build_writing_context：

- entityQuery = 朝日奈千夜 九逃 醫療後座 未成立邊界
- includeEntityRegistry = true
- entityLimit = 20

驗證結果：

- entity_enabled = True
- entity_count = 20

前段命中包含：

- STATUS-九逃-傷勢-醫療後座
- CHAR-九逃
- CHAR-朝日奈千夜
- ABILITY-5-14-1-A-朝日奈千夜-時櫻嘯命-時間操控完整能力體系
- STATUS-九逃-九逃與千夜第一場後座

### Direct function 驗證

直接 import chatgpt_bridge_search_canon_entities 驗證：

- q = 朝日奈千夜 九逃 醫療後座 未成立邊界
- total_matches = 24
- returned = 20
- warnings = []

另查 朝日奈千夜 時，CHAR-朝日奈千夜 存在於 registry/index，但其 status 為 candidate / source tier T7 candidate，因此在 direct search 中仍可能被 canon ability/status/chapter event 排在前面。這符合 source trust 排序，不視為 Phase 21H blocker。

## 測試

已通過：

- npm run test:mcp
- npm test

完整測試結果：

- MCP contract tests passed.
- All tests passed.

## 安全與正史邊界

本階段只修改 ChatGPT bridge entity retrieval/search 品質。

未執行、未修改：

- active_engine
- compressed_rules
- Canon DB 正史內容
- adopted chapter
- settlement report
- pending engine candidate
- approval queue 採用狀態
- high-risk confirmation / activation / cleanup

## 結論

Phase 21H 完成。

ChatGPT bridge writing context 現在可在中文 compound query 下取得相關 entity registry context，不再因完整字串比對造成空 entities。
