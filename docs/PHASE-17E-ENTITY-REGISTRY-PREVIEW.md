# Phase 17E — Entity Registry Preview

Phase 17E 實作一個只讀 (read-only) 的 Entity Registry Preview，用來從現有的 `active_engine.md` 與 Canon Zones preview 抽取候選的 entity（角色、武裝、組織、地點）。

重點：
- 嚴格為 preview / dry-run；不會寫入 Canon DB、active_engine.md、或建立任何正式卡片。
- 只使用 Canon Zones preview 作為解析來源；不做 LLM 推論或自行補完資料。
- Entity ID 為候選追蹤 ID（stable、可重算），非正式正史 ID。

輸出項目：
- 每個候選會帶 `entity_id`, `kind`, `display_name`, `status`, `source_zone_id`, `source_line_start`, `source_line_end`, `evidence_hash`, `extraction_rule`。
- `status` 僅允許 `registry_candidate`, `ambiguous_candidate`, `rejected_by_rule`。

用途與後續階段：
- Phase 17F：Character & Weapon Intake
- Phase 17G：Settlement Completion Reminder
- Phase 17I：Local Patch Engine
- Phase 17J：active_engine Compiler

驗收要點：
- 僅從 Canon Zones preview 中保守抽取候選。
- 不修改任何正式資料檔案或啟用新的 public MCP tools。
- Entity Preview 可由 `node scripts/entity-registry-preview.mjs` 以 summary 或 `--json` 完整輸出。
