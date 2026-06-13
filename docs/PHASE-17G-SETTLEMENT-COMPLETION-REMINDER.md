# Phase 17G — Settlement Completion Reminder

Phase 17G 實作 read-only / candidate-only 的 Completion Reminder 機制。

- 作用：當採用章節、settlement report、或人工標記中出現新實體（角色、武裝、能力、地點、組織、世界實體）時，產生補完提醒（reminder candidate），指出缺哪些欄位、是否需要命名檢查，但絕不寫入 Canon DB、active_engine 或建立正式卡片。
- 輸入來源：`adopted_chapter` / `settlement_report` / `manual` / `candidate_draft`。
- 輸出：preview JSON，包含 `reminders[]` 與 `naming_review_summary`，皆為 candidate-only。

關係：
- 17E (`entity-registry-preview`) 用來判斷是否已存在。
- 17F (`entity-intake`) 接收明確的 intake markers，17G 在 intake 之上產生補完提醒。
- 17I：若使用者確認，才由 17I 產生 local patch candidate（非本階段）。
- 17J：active_engine 編譯器（非本階段）。

命名多樣性原則：
- 17G 會執行保守的命名多樣性檢查，若同批新增名單過度模板化，產生 naming warnings（非阻斷）。
- 例外情況（家族、氏族、編號系統等）會記錄為 `allowed_shared_pattern_reason`。

參考檔案：
- `config/settlement-completion-reminders.json`
- `server/src/settlement-completion-reminder-service.mjs`
- `scripts/settlement-completion-reminders-preview.mjs`
