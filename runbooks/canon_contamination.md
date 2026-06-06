# Canon Contamination Incident Runbook

當系統偵測到正史污染風險（candidate 被寫入 Canon、unknown source 被當成正史等），依本 runbook 執行隔離與回滾流程。

## 1. 觸發條件

- candidate draft 被寫入 Canon DB。
- rejected draft 被承接為下一章正史。
- unknown source 被當成正史依據。
- Preference Memory 覆蓋 active_engine。
- Error Report 反向改寫正式設定。
- Story Graph candidate node 被當成 canon node。
- Timeline candidate event 被當成 canon event。
- active_writing_card 覆蓋 active_engine。
- RAG 檢索結果缺少 canon_status 卻被用於正式承接。
- Neural 推論被寫入 Canon Memory。
- 伏筆未經正式結算被標記為 paid。
- 未採用稿中的傷勢、勝負、關係、能力變化被承接。

## 2. 初步隔離

- 停止所有 high_risk / destructive 寫入。
- 進入 `canon_contamination_incident` 狀態。
- 標記 `affected_run_id` / `affected_transaction_id`。
- 快速生成 incident snapshot（若可用）。
- 把可疑資料標註為 `quarantined` 並從 index 中移除檢索結果。

## 3. 回滾與修復

- 回滾到最近 clean snapshot（若存在）。
- 重建 retrieval index。
- 執行 Canon Golden Tests、Retrieval Regression Tests、Negative Prompt Injection Tests。
- 產生 `incident_report` 並等待使用者確認。

## 4. 報告樣板

```json
{
  "incident_id": "string",
  "detected_at": "ISO-8601",
  "detected_by": "canon_guard | retrieval_eval | user | tool | trace_audit",
  "severity": "P0 | P1 | P2",
  "affected_run_id": "string",
  "affected_transaction_id": "string",
  "contamination_source": "string",
  "source_trust_level": "string",
  "canon_status": "string",
  "affected_paths": [],
  "rollback_snapshot": "string",
  "quarantined_items": [],
  "tests_run": [],
  "test_result": "pass | fail",
  "root_cause": "string",
  "prevention_rule": "string",
  "requires_user_confirmation": true,
  "final_status": "pending_user_review | resolved | unresolved"
}
```

## 5. 後續追蹤

- 保留 quarantined 資料以供審計，但不得重新啟用於 generation_context。
- 若回滾失敗，將系統進入維護模式並通知人工處理。

---

把此檔放入 `runbooks/`，並在發現污染事件時引用本 runbook 作為自動化隔離與人工處理指示。