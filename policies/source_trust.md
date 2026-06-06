# Source Trust / Provenance（來源可信度與溯源）

摘要：每筆可檢索資料需標註來源等級（`source_trust_level`）以避免 unknown 資料污染正史。此文件摘錄並整理 SKILL.md 的來源可信度規範。

## 建議來源等級（簡要）

- T0：使用者本輪明確指令（最高優先）
- T1：`active_engine`
- T2：正式採用章節 / 正式設定
- T3：`active_writing_card`
- T4：Story Graph canon node / Timeline canon event
- T5：Error Reports
- T6：Preference Memory
- T7：candidate draft / pending proposal
- T8：unknown source
- T9：rejected / forbidden / deprecated

## Metadata 欄位

每筆資料應包含：

- `source_id, source_type, source_trust_level, source_path, source_version, source_section, canon_status, created_at, updated_at, created_by, approved_by_user, can_be_used_for_canon, can_be_used_for_style, can_be_used_for_error_learning, can_be_used_for_retrieval, forbidden_reason`

## 硬規則摘要

1. 僅 T0/T1/T2 可作為高信任正史來源。
2. T3 用於寫法目的，不決定正史。
3. T8 必須人工確認，T9 禁用於承接。
4. 若資料來源缺少 trust level，預設為 T8（unknown）。

此文件應與 ingestion pipeline（`data/ingestion/`）與 retrieval index 建置流程整合，並提供快速檢查工具（source-trust-checker）用於 CI。