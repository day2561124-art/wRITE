# Phase 17F — Character & Weapon Intake (Candidate-only)

Phase 17F 實作 candidate-only 的 Character & Weapon Intake 預覽功能。

- 目標：當 GPT、settlement 或人工輸入出現疑似新角色／新武裝時，產生 intake candidate（只讀、僅候選），不修改 `active_engine.md`。
- 絕對禁止：寫入 Canon DB、建立正式角色/武裝/能力卡、修改 `active_engine.md`。
- 關係：17E 提供現有 entity registry 作為參考；17F 只接收並標記可能的新候選，後續 Phase 17G/17I 處理補完與 patch。

詳見 repository 中的 `config/entity-intake.json`、`server/src/entity-intake-service.mjs`、`scripts/entity-intake-preview.mjs`。

設計說明：
- `intakes[]` 會包含 candidate 項目；在目前實作中，若來源名稱已存在於 Entity Registry Preview，該項目會以 `status: "existing_entity_reference"` 出現在 `intakes[]`（而非自動建立正式卡片）。
- `existing_entity_reference` 表示發現了與既有 registry entity 的匹配，**不會**觸發 Canon DB 寫入或正式卡片建立。
- 未匹配到的候選才會以 `status: "intake_candidate"`（或 `needs_completion` / `ambiguous_intake_candidate`）出現，並包含 `missing_fields`、`completion_required` 等欄位以供後續人工確認。

（備註：若未來希望把已存在參考分流到 `existing_references[]`，可在 service 中做調整；目前文件與測試皆以 `intakes[]` 內包含 `existing_entity_reference` 為準。）
