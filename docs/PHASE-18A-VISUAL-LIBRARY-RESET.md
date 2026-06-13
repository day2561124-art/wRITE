# Phase 18A — Visual Library Reset / Empty Gallery Baseline

目的
- 清空 `data/visual_db/visual_index.jsonl` 以建立「空圖庫但功能完整」的 baseline，讓系統與測試支援 0 records。

為何重置
- 專案中已無實際圖片檔案，但 `visual_index.jsonl` 遺留 64 筆 stale records，造成測試與 UI 假設非空。

邊界與保證
- 只清 visual index（`data/visual_db/visual_index.jsonl`），不修改 Canon DB、`active_engine.md` 或任何 writing/proofing card。
- 不建立 approval items、canon_visual_lock，或更新 Approval Queue。
- 保留 `data/visual_db/assets/` 目錄（若需保留空目錄，可使用 .gitkeep）。

測試 / 行為變更
- Visual DB contract 與 UI server contract 測試已調整，允許 `visual_index` 為 0 records。
- Visual reindex / metadata / upload / delete 測試會在測試內建立臨時 fixture（上傳測試圖片），測試結束後恢復到空 index。
- 任何依賴舊全域 64 筆索引的測試已改為使用內建 fixture 或短期建立的測試資源。

後續
- 空圖庫 baseline 不影響未來上傳功能；上傳流程與 reindex 可以用臨時測試檔案重建 index。
- 若要恢復舊索引，請從備份或遠端來源還原 `visual_index.jsonl`（此操作需明確授權）。
