# Phase 17H — Visual Asset Registry Preview

17H 提供一個 Read-only / Candidate-only 的 Visual Asset Registry Preview。主要目的是從現有的 visual index 或人工提供的 visual metadata 建立可供審查的 visual asset 候選清單，並嘗試建立圖片與正史 entity 的候選連結。

核心原則：
- 完全 read-only：不寫入 Canon DB、`active_engine.md`、或 `visual_index.jsonl`。
- 圖片僅作為 reference / candidate reference，絕不自動成為正史或覆蓋角色外觀設定。
- `canon_visual_lock` 必須人工確認，不會自動建立。
- 僅依賴明確標記或 visual_index 中已有的 metadata；禁止從圖片檔名或自然語言推論角色/地點/武裝。

流程：
1. 讀取 `config/visual-asset-registry.json`，確認為 `read_only_preview`。
2. 以 `visual_index.jsonl`、`--file` 或 `--text` 的明確標記為資料來源，抽取 visual assets（保守解析）。
3. 呼叫 Phase 17E 的 Entity Registry Preview 取得現有 entities，並嘗試以明確 entity id 或明確 entity display name（唯一命中）建立 `linked_entity_candidate`。
4. 將候選條目與來源 evidence 一起輸出，等待人工審查。後續 Phase 17I / 17J 才可能建立 patch candidate 或編入 active_engine。

CLI：`scripts/visual-asset-registry-preview.mjs`（預設 human summary，`--json` 輸出純 JSON，不會產生任何 artifact 或修改檔案）

注意：此階段設計為保守且可審查；任何會修改正式資料的動作都必須在後續階段與人工批准後執行。
