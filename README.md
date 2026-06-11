# 武裝學院的二三事｜小說代理系統

本專案是《武裝學院的二三事》的本地小說創作代理資料庫與 Prompt Builder。目標是讓 AI 在每次起稿、驗稿或設定除錯前，都能先讀取最新版正史、正文寫作卡、錯誤報告、記憶與任務檢索結果，再組成可追蹤來源的任務提示。

完整開發與操作規格見 [`SKILL.md`](SKILL.md)。

## 快速開始

推薦直接啟動本機工作台啟動器：

```powershell
.\launcher.cmd
```

不需要開啟 VS Code；也可以直接在檔案總管雙擊 `launcher.cmd`。需要 Node.js 18 以上版本。

啟動器提供：

- 啟動或重啟 UI。
- 在瀏覽器開啟 UI。
- 開啟人設圖庫素材資料夾。
- 執行完整驗證。
- 建立桌面捷徑。
- 停止 UI。

若只想直接開 UI，也可以雙擊 `start-ui.cmd`。

啟動器亦支援命令列模式，並以 exit code 回報成功或失敗：

```powershell
.\launcher.ps1 -Status
.\launcher.ps1 -StartUi -NoOpen
.\launcher.ps1 -RunTests
.\launcher.ps1 -StopUi
```

介面會在瀏覽器開啟 `http://127.0.0.1:4173/`，提供：

- 正式母檔與來源信任狀態總覽。
- 起稿、檢索與任務提示流水線。
- 候選稿保存、驗稿提示與驗稿報告。
- 正史、寫作卡、驗稿卡、長線骨架與產物閱讀器。
- 人設、服裝、異能武裝與異能演出視覺圖庫。
- 草稿、驗稿、回饋與 MCP 稽核紀錄。
- 一鍵執行完整驗證。

候選稿、驗稿報告與回饋預設為「僅預覽」；取消勾選後，介面仍會在實際寫入前要求確認。伺服器只監聽本機 `127.0.0.1`。

若偏好命令列，最常用的一條指令是：

```powershell
node server/src/tools/run-pipeline.mjs --query "朝日奈千夜 九逃 醫療後座" --task "下一章正文候選：承接第十九章正式選拔第一場結束後的醫療後座，先保護未成立邊界，再準備正文候選。" --top 12
```

這會自動執行：

1. 重建全文與摘要上下文。
2. 依關鍵字檢索相關段落。
3. 組裝本次任務可用的 `task_prompt.md`。

每次流水線會先在 `data/outputs/runs/<run_id>/` 建立隔離產物與 `manifest.json`。三個步驟全部成功後，才會用單一交易發布四份正式輸出；若中途失敗，既有正式輸出保持不變。

主要輸出：

- `data/outputs/current_prompt.md`：全文母包，包含完整創作引擎與正文寫作卡。
- `data/outputs/generation_context.md`：摘要上下文，適合長期常駐或起稿前先讀。
- `data/outputs/retrieval_context.md`：本次任務的關鍵字檢索結果。
- `data/outputs/task_prompt.md`：真正交給 AI 起稿、驗稿或除錯的任務提示。

所有可指定的生成輸出都被限制在 `data/outputs/` 內；MCP 或 CLI 不得把生成內容覆寫到 Canon、政策或正式資料庫。

## 目前資料狀態

已匯入：

- Canon DB：`data/canon_db/active_engine.md`
- Canon DB 版本：`data/canon_db/versions/engine_v5.0.12.md`
- Writing Policy DB：`data/writing_policy_db/active_writing_card.md`
- Writing Policy DB 版本：`data/writing_policy_db/versions/writing_card_v2.8.md`
- Proofing Policy DB：`data/proofing_policy_db/active_proofing_card.md`
- Proofing Policy DB 版本：`data/proofing_policy_db/versions/proofing_card_v1.1.md`
- Proofing Policy 來源母檔：`data/proofing_policy_db/sources/proofing_card_v1.1.md`
- Longline DB：`data/longline_db/active_longline.md`
- Longline DB 版本：`data/longline_db/versions/longline_v1.1.md`
- Longline 來源轉錄：`data/longline_db/sources/longline_part1_national_representative_arc_v1.1.md`

尚待實際使用累積資料：

- `data/error_report_db/*.jsonl`
- `data/feedback_db/*.jsonl`
- `data/memory_store/*.json`

正式長線骨架已由使用者提供圖片轉錄並於 2026-06-07 匯入；原圖副本、`v1.0` 初始轉錄與 `v1.1` 使用者補字版本均保留可追溯關聯。第五篇章第二項原先遭遮擋的文字已由使用者確認為「達成場上目的」。

注意：空白或 placeholder 檔案不是授權 AI 自行補設定。若資料不足，AI 必須標記缺口，不得把推測寫成正史。

## 工具一覽

### 1. 重建上下文

```powershell
node server/src/tools/build-current-prompt.mjs
```

輸出：

- `data/outputs/current_prompt.md`
- `data/outputs/generation_context.md`

用途：

- 讀取 `active_engine.md`、`active_writing_card.md`、長線、錯誤報告與 memory。
- 產生全文版與摘要版上下文。
- 保留來源路徑、檔案大小、修改時間與 SHA-256。

### 2. 關鍵字檢索

```powershell
node server/src/tools/search-context.mjs 朝日奈千夜 九逃 醫療後座 --top 12
```

也可以指定輸出：

```powershell
node server/src/tools/search-context.mjs 正式選拔 戰鬥 後座 --top 8 --output data/outputs/retrieval_context_battle.md
```

輸出：

- 預設為 `data/outputs/retrieval_context.md`

用途：

- 從 Canon DB、Writing Policy DB、Proofing DB、Longline DB、Error Report DB 與 Memory Store 檢索相關段落。
- 每筆結果保留 source、version、paragraph ID、line range、authority、score 與 hits。

### 3. 組裝任務提示

```powershell
node server/src/tools/build-task-prompt.mjs --mode next-chapter --task "下一章正文候選：承接第十九章正式選拔第一場結束後的醫療後座，先保護未成立邊界，再準備正文候選。"
```

可用模式：

- `next-chapter`：下一章正文候選。
- `proofread`：正式採用前驗稿精修。
- `settle`：正式章節結算。
- `debug`：設定除錯。

輸出：

- `data/outputs/task_prompt.md`

用途：

- 將 `generation_context.md` 與 `retrieval_context.md` 組合成任務提示。
- 在開頭加入使用者任務、任務模式、禁止事項、工作順序與 Canon Guard 檢查清單。

### 4. 一鍵流水線

```powershell
node server/src/tools/run-pipeline.mjs --query "朝日奈千夜 九逃 醫療後座" --task "下一章正文候選：承接第十九章正式選拔第一場結束後的醫療後座，先保護未成立邊界，再準備正文候選。" --top 12
```

用途：

- 一次跑完 `build-current-prompt.mjs`、`search-context.mjs` 與 `build-task-prompt.mjs`。
- 檢索排名結合精確詞、中文 n-gram、BM25、來源權威與信任層級。
- 各步驟先寫入獨立 run 目錄，完成後才交易式發布正式輸出。
- 這是目前推薦的日常入口。

查詢用法：

```powershell
node server/src/tools/run-pipeline.mjs --help
```

### 5. 匯入政策檔

目前可用通用匯入工具：

```powershell
node server/src/tools/import-policy-file.mjs --kind proofing --source "E:\設定集\完整設定檔\研究包\完稿後驗稿卡_v1.0.md" --dry-run
```

支援類型：

- `engine`：匯入 `data/canon_db/active_engine.md`，並保存到 `data/canon_db/versions/`。
- `writing`：匯入 `data/writing_policy_db/active_writing_card.md`，並保存到 `data/writing_policy_db/versions/`。
- `proofing`：匯入 `data/proofing_policy_db/active_proofing_card.md`，並保存到 `data/proofing_policy_db/versions/`。
- `longline`：匯入 `data/longline_db/active_longline.md`，並保存到 `data/longline_db/versions/`。

先 dry-run 檢查匯入計畫：

```powershell
node server/src/tools/import-policy-file.mjs --kind proofing --source "E:\設定集\完整設定檔\研究包\完稿後驗稿卡_v1.0.md" --dry-run
```

如果檔名或內文沒有 `vX.Y` 版本號，需手動指定：

```powershell
node server/src/tools/import-policy-file.mjs --kind proofing --source "E:\設定集\完整設定檔\研究包\完稿後驗稿卡.md" --version v1.0 --dry-run
```

確認匯入計畫無誤後，正式匯入必須加確認碼：

```powershell
node server/src/tools/import-policy-file.mjs --kind proofing --source "E:\設定集\完整設定檔\研究包\完稿後驗稿卡_v1.0.md" --confirm IMPORT_POLICY
```

注意：

- 匯入工具不會修改來源檔。
- 沒有 `--confirm IMPORT_POLICY` 不會寫入。
- 匯入後會依需要更新 active 檔與版本檔。
- active 檔被替換前會備份到 `data/outputs/logs/policy_import_backups/`。
- 匯入紀錄會追加到 `data/outputs/logs/policy_imports.jsonl`。
- 既有版本檔內容不同時不會覆蓋，除非加上 `--force`。
- 正式《完稿後驗稿卡》母檔 `v1.1` 已匯入；來源、active 與版本檔由 golden test 鎖定為完全一致。

### 6. 寫入使用者回饋

最小 Feedback Learning Loop 工具：

```powershell
node server/src/tools/add-feedback.mjs --type rejected --chapter "第二十章候選稿" --feedback "整章只有公告和等待，沒有角色選擇造成的支付，醫療後座也沒有真的改變下一場判斷。" --characters "朝日奈千夜,九逃" --scene-type "正式選拔,醫療後座" --dry-run
```

確認輸出無誤後，移除 `--dry-run` 才會寫入：

- `data/feedback_db/rejected_drafts.jsonl`
- `data/feedback_db/pending_error_reports.jsonl`

支援類型：

- `rejected`：退稿原因；預設同步產生 pending error candidate。
- `accepted`：採用稿紀錄；不會產生錯誤候選。
- `revision`：修訂對紀錄。
- `preference`：偏好對紀錄。

常用參數：

- `--severity P0..P4`：手動指定嚴重度。
- `--category <text>`：手動指定錯誤分類。
- `--draft-file <path>`：附上候選稿檔案，工具會記錄 SHA-256。
- `--no-candidate`：只記 raw feedback，不產生 pending error candidate。

注意：

- `pending_error_reports.jsonl` 只是待審錯誤候選，不是正式 Error Report DB。
- 高嚴重度錯誤仍需使用者確認後，才能寫入正式錯誤報告庫。
- 任何 feedback 都不能直接更新 Canon DB。

### 7. 確認錯誤報告候選

列出待審錯誤候選：

```powershell
node server/src/tools/commit-error-report.mjs --list
```

預覽最新候選會寫入哪個正式錯誤庫：

```powershell
node server/src/tools/commit-error-report.mjs --latest --dry-run
```

確認無誤後正式提交：

```powershell
node server/src/tools/commit-error-report.mjs --error-id E-PACING-20260605-154542981-CFB73822 --confirm COMMIT
```

路由規則：

- `正史承接錯誤` / `E-CANON-*` → `data/error_report_db/canon_errors.jsonl`
- `角色工具人錯誤` / `E-CHARACTER-*` → `data/error_report_db/character_errors.jsonl`
- `對話 AI 腔錯誤` / `E-DIALOGUE-*` → `data/error_report_db/dialogue_errors.jsonl`
- `章節流程化` / `E-PACING-*` → `data/error_report_db/pacing_errors.jsonl`
- `戰鬥過度安全` / `E-BATTLE-*` → `data/error_report_db/battle_errors.jsonl`
- `使用者偏好` / `E-PREFERENCE-*` → `data/error_report_db/preference_errors.jsonl`

正式提交會：

- append 一筆 `status: active` 的正式錯誤報告到對應 `error_report_db/*.jsonl`。
- 將 `pending_error_reports.jsonl` 中該筆標記為 `committed`。
- 追加審計紀錄到 `data/outputs/logs/error_report_commits.jsonl`。

注意：

- 這是高風險寫入工具，沒有 `--confirm COMMIT` 不會正式寫入。
- 若工具無法自動判斷目標錯誤庫，必須手動提供 `--target canon|character|dialogue|pacing|battle|preference`。
- 正式錯誤報告不能反向修改 Canon DB。

### 8. 驗證 JSONL 資料

驗證所有 feedback 與 error report JSONL：

```powershell
node server/src/tools/validate-jsonl.mjs --all
```

驗證單一檔案：

```powershell
node server/src/tools/validate-jsonl.mjs --file data/feedback_db/pending_error_reports.jsonl
```

指定 schema 驗證：

```powershell
node server/src/tools/validate-jsonl.mjs --file data/outputs/logs/sample.jsonl --schema error_report
```

目前 schema：

- `error_report`：正式錯誤報告與 `pending_error_reports.jsonl`。
- `feedback`：`accepted_drafts.jsonl` 與 `rejected_drafts.jsonl`。
- `generic_pair`：`revision_pairs.jsonl` 與 `preference_pairs.jsonl`。
- `visual_index`：人設圖庫索引 `data/visual_db/visual_index.jsonl`。

建議在下列情況後執行：

- `add-feedback.mjs` 寫入後。
- `commit-error-report.mjs` 正式提交後。
- 新增或修改人設圖庫 metadata 後。
- 手動編輯任何 `.jsonl` 檔後。

### 9. 人設圖庫

圖片放在：

```text
data/visual_db/assets/
```

也可以在本機 UI 的「圖庫」頁直接上傳 PNG、JPG、WEBP 或 GIF；系統會自動存入對應子資料夾並追加索引紀錄。單張圖片上限 8 MB。圖庫詳情頁提供刪除功能，確認後會移除索引紀錄與圖片檔。

索引檔：

```text
data/visual_db/visual_index.jsonl
```

每張圖一行 JSONL。分類可用：

- `character_design`：人設。
- `armed_form`：異能武裝外觀。
- `outfit`：服裝。
- `ability`：異能演出。
- `expression`：表情。
- `scene_reference`：場景參考。

視覺圖只能作為參考，不會單獨建立正史、能力效果、關係、排名或時間線事件。異能武裝圖建議在 `notes` 寫明「外觀參考」與「已成立能力事實」的邊界。

### 10. 神經網路模組使用證據

本機 UI 的「神經模組」頁只依據 `neural_trace` 判定是否實際使用模型。任務文字即使寫有「已使用神經網路模型」，沒有 success trace 仍顯示未使用或 warning。

資料路徑：

```text
data/agent_runs/<run_id>/run.json
data/agent_runs/<run_id>/neural_modules_used.json
data/agent_runs/<run_id>/warnings.json
data/agent_runs/<run_id>/blocked_reason.json
data/agent_runs/neural_traces/<trace_id>.json
data/agent_runs/neural_outputs/
```

Phase 1 提供 scene planner、character simulator、neural critic、style drift detector 與 over-governance detector wrapper。尚未接入真實本地 adapter 時會記錄 `skipped`，不會假裝 `success`。本階段不串 OpenAI API，也不修改 `active_engine.md`。

### 10.1. 正式章節結算匯入

本機 UI 的「結算匯入」頁可接收正式章節結算文字，解析其中的新版完整創作引擎區塊，並保存為 pending candidate：

```text
data/canon_db/pending_engine_candidates/<candidate_id>/
  raw_import.txt
  candidate_engine.md
  metadata.json
  diff.json
  risk_report.json
  status.json
```

系統會產生 line-based diff，並以本機規則檢查重大設定變更、污染詞、大量刪除與候選長度異常。解析失敗或 critical risk 會標記為 `blocked`；放棄候選只會將狀態標記為 `rejected`，資料夾仍保留。

Phase 2 的 `can_activate` 永遠為 `false`。啟用路由只回傳 `not_implemented_in_phase_2`，不建立 snapshot、archive、rollback 或 activation log，也不寫入 `data/canon_db/active_engine.md`。

### 11. 壓縮正式錯誤規則

先預覽目前正式錯誤報告可壓縮出的規則：

```powershell
node server/src/tools/compress-error-rules.mjs --dry-run
```

寫出候選檔供人工檢查，不影響 prompt 讀取：

```powershell
node server/src/tools/compress-error-rules.mjs --write-candidate
```

確認候選無誤後，才更新正式 `compressed_rules.md`：

```powershell
node server/src/tools/compress-error-rules.mjs --update-active --confirm UPDATE_RULES
```

常用選項：

- `--top <n>`：限制最多輸出的壓縮規則數。
- `--min-count <n>`：只保留累積次數達標的規則群。
- `--include-archived`：連同 archived 正式錯誤報告一起納入。
- `--allow-empty`：沒有 active 正式錯誤時，仍允許刷新 no-rules guard。

輸出：

- 候選規則：`data/outputs/compressed_rule_candidates/*.md`
- 候選索引：`data/outputs/logs/compressed_rule_candidate_index.jsonl`
- 正式規則：`data/error_report_db/compressed_rules.md`
- 正式更新備份：`data/outputs/logs/compressed_rule_backups/`
- 正式更新紀錄：`data/outputs/logs/compressed_rule_updates.jsonl`

注意：

- 只讀取正式 `data/error_report_db/*.jsonl`。
- 預設只納入 `status: active` 的錯誤報告。
- 候選輸出不會被 `build-current-prompt.mjs` 當成正式規則。
- 沒有 `--confirm UPDATE_RULES` 不會更新正式 `compressed_rules.md`。
- 壓縮規則只能避錯、驗稿與重寫，不得反向修改 Canon DB。

### 12. 保存候選稿與驗稿報告

保存候選正文：

```powershell
node server/src/tools/save-draft.mjs --title "第二十章候選稿A" --chapter "第二十章" --text "正文內容"
```

也可以從檔案保存：

```powershell
node server/src/tools/save-draft.mjs --title "第二十章候選稿A" --chapter "第二十章" --source-file data/outputs/tmp_draft.md
```

輸出：

- `data/outputs/drafts/*.md`
- `data/outputs/logs/draft_index.jsonl`

保存驗稿報告：

```powershell
node server/src/tools/save-proof-report.mjs --title "第二十章候選稿A驗稿" --chapter "第二十章" --draft-id DRAFT-... --verdict needs_rewrite --severity P2 --text "驗稿報告內容"
```

輸出：

- `data/outputs/proof_reports/*.md`
- `data/outputs/logs/proof_report_index.jsonl`

注意：

- 保存候選稿不等於採用。
- 保存驗稿報告不等於正式結算。
- 兩者都不會更新 Canon DB。
- 每筆索引會記錄 SHA-256 與 `task_prompt.md` 來源。

### 13. 建立正式章節結算提案

從已確認採用的 draft 建立結算提案：

```powershell
node server/src/tools/create-settlement-proposal.mjs --chapter "第二十章" --title "第二十章結算提案" --draft-id DRAFT-... --confirm-adopted
```

從外部採用稿檔案建立：

```powershell
node server/src/tools/create-settlement-proposal.mjs --chapter "第二十章" --title "第二十章結算提案" --source-file data/outputs/adopted.md --confirm-adopted
```

可先 dry-run：

```powershell
node server/src/tools/create-settlement-proposal.mjs --chapter "第二十章" --title "第二十章結算提案" --draft-id DRAFT-... --dry-run
```

可手動加入提案項目：

```powershell
node server/src/tools/create-settlement-proposal.mjs --chapter "第二十章" --title "第二十章結算提案" --draft-id DRAFT-... --established "九逃完成換藥" --unsettled "不成立代表資格" --confirm-adopted
```

輸出：

- `data/outputs/settlement_proposals/*.md`
- `data/outputs/logs/settlement_proposal_index.jsonl`

注意：

- 這只是結算提案，不是新版 Canon DB。
- 沒有 `--confirm-adopted` 不會寫入。
- 本工具不得續寫、補戲、推定未成立結果。
- 本工具不會更新 `active_engine.md`。

### 14. 安全啟用 engine 版本

啟用前先 dry-run，確認候選版本、目前 active SHA 與備份位置：

> 已移除：本專案中的本地腳本 `server/src/tools/activate-engine-version.mjs` 已於近期重構時移除。
>
> 若需啟用新版本的 engine，請參閱 [changelog/ENGINEERING-20260607.md](changelog/ENGINEERING-20260607.md) 以了解替代流程與安全建議。


注意：

- 沒有 `--confirm ACTIVATE` 不會寫入。
- `--dry-run` 永遠不會寫入。
- 真正啟用時會先備份舊 `active_engine.md` 到 `data/outputs/logs/engine_activation_backups/`。
- 真正啟用後會追加紀錄到 `data/outputs/logs/engine_activations.jsonl`。
- 若候選內容與 active 完全相同，工具不會覆蓋。

### 15. MCP server 基礎入口

啟動本地 stdio MCP server：

```powershell
node server/src/mcp-server.mjs
```

查看支援方法與煙霧測試提示：

```powershell
node server/src/mcp-server.mjs --help
```

執行 MCP smoke test：

```powershell
node server/src/mcp-smoke-test.mjs
```

需要看完整 JSON-RPC 訊息時：

```powershell
node server/src/mcp-smoke-test.mjs --verbose
```

客戶端設定範例：

可直接參考：

- `config/mcp-client.example.json`：可攜模板，將 `<PROJECT_ROOT>` 替換成專案根目錄。
- `config/mcp-client.windows-local.example.json`：目前工作區 Windows 路徑範例，中文路徑已用 `\uXXXX` 轉義，方便舊版 Windows PowerShell 解析。

```json
{
  "mcpServers": {
    "armed-academy-fiction-engine": {
      "command": "node",
      "args": ["E:\\武裝學院的二三事\\server\\src\\mcp-server.mjs"],
      "cwd": "E:\\武裝學院的二三事"
    }
  }
}
```

目前支援：

- MCP methods：`initialize`、`tools/list`、`tools/call`、`ping`、`resources/list`、`resources/read`、`prompts/list`、`prompts/get`。
- Transport：newline-delimited JSON 與 `Content-Length` framing；header body 以 UTF-8 位元組長度解析。單一 JSON-RPC message body 上限為 16 MiB，`Content-Length` header 上限為 8 KiB。
- 只讀工具：`get_current_project_state`、`get_active_engine`、`get_active_writing_card`、`validate_jsonl`、`query_mcp_audit`。
- 低風險寫入：`add_feedback_raw`、`save_draft`、`save_proof_report`。
- 生成輸出工具：`build_generation_context`、`search_context`、`build_task_prompt`、`run_pipeline`。
- 高風險工具：`import_policy_file`、`commit_error_report`、`compress_error_rules`、`create_settlement_proposal`、`activate_engine_version`。

安全邊界：

- MCP server 只會呼叫白名單工具，不接受任意 shell 指令。
- 高風險工具仍需原工具的確認碼，例如 `IMPORT_POLICY`、`COMMIT`、`UPDATE_RULES`、`ACTIVATE`。
- `import_policy_file`、`compress_error_rules` 與 `activate_engine_version` 經 MCP 呼叫時預設 dry-run。
- Server 會在驗證原始 arguments 後，依 `inputSchema.default` 集中補值；cross-field guard、confirmation guard、handler 與 audit 共用同一組實際 arguments。
- 每個工具都會在 `inputSchema.x-null-normalization` 公開 null 契約：required 為 `reject`、optional with default 為 `applyDefault`、optional without default 為 `preserveNull`。Server 的驗證與補值流程直接讀取同一份 metadata。
- Optional argument 收到 `null` 時，有 `inputSchema.default` 的欄位會補成 default；沒有 default 的欄位保留 `null`，交由 handler 視為未指定。Required argument 的 `null` 仍會先被拒絕。
- 每個工具也會在 `inputSchema.x-empty-string-normalization` 公開 blank-string 契約：required 為 `rejectBlank`、optional with default 為 `applyDefault`、optional without default 為 `omit`、cross-field presence 為 `trimmedNonEmpty`。`""` 與純空白字串採相同語意。
- 每個工具會在 `inputSchema.x-string-array-normalization` 公開字串陣列契約：blank item 為 `rejectBlank`，非空白元素為 `preserve`。陣列可為空，但不得包含 `""` 或純空白元素。
- 所有字串欄位都會在標準 JSON Schema `maxLength` 公開上限：一般字串 4,096、`query` 8,192、任務／回饋／錯誤描述 65,536、完整 `text` 1,000,000 個 Unicode 字元。
- 所有字串陣列都會公開 `maxItems` 與 item `maxLength`：一般陣列最多 100 項、每項 16,384 字元；`files` 最多 256 項、每個路徑 4,096 字元。
- 所有正整數欄位都會公開標準 JSON Schema `maximum`：`query_mcp_audit.limit` 最多 1,000，`search_context.top` 與 `run_pipeline.top` 最多 100，`compress_error_rules.top` 與 `minCount` 最多 1,000。
- Transport 會在 JSON parse 與 schema 驗證前拒絕超過 16 MiB 的 message body；超大的 `Content-Length` body、newline frame 與超過 8 KiB 的 header 會回傳 `-32700`，串流丟棄該 frame 後繼續處理同一連線的後續請求。
- stdin 若在 newline frame、`Content-Length` header 或宣告長度尚未收滿的 body 中途結束，server 會在既有 pending responses 之後回傳對應 framing 的 `-32700`，不會靜默丟棄半個 request；已回報過的超限 frame 不會在 EOF 重複報錯。
- `Content-Length` header 只允許一份十進位非負安全整數；同值重複、不同值衝突、數字後尾隨垃圾、負值與超過 `Number.MAX_SAFE_INTEGER` 的宣告都會在讀取 body 前回傳 header-framed `-32700`。
- 尚未完成 dispatch 的 JSON-RPC messages 最多 256 個，包含 requests 與 notifications；超額 request 立即以原 framing 回傳 `-32000`，超額 notification 依 JSON-RPC 規則靜默丟棄。佇列下降後可繼續接收，不會永久鎖死連線。
- 所有 response 經同一個 stdout writer 依序送出；`process.stdout.write()` 回傳 `false` 時會同時等待 write callback 與 `drain`。待送 response 達 256 時暫停 stdin 與 frame parser，降到 128 後才解析既有 buffer 並恢復 stdin，避免慢速接收端造成無界記憶體增長。
- stdin 若在 stdout backpressure 暫停 parser 時結束，server 會先等 response queue 降水位、處理完 `inputBuffer` 中所有完整 frames，再做唯一一次 EOF 截斷判定；完整尾幀不會誤報，真正半幀的 `-32700` 會排在所有前序 responses 之後。
- 非只讀 MCP tool 會追加統一審計紀錄到 `data/outputs/logs/mcp_tool_audit.jsonl`；smoke test 會先驗證新增紀錄，再於結束時逐位元組恢復原始 audit log。

MCP resources：

- `resources/list` 目前暴露 29 個白名單資源，包含 active 母檔、memory、主要 outputs、JSONL 資料庫、README 與 SKILL。
- 每個 resource 會帶 `uri`、`name`、`description`、`mimeType` 與檔案 metadata。
- `resources/read` 只能讀白名單 URI，不接受任意本機路徑。

常用 resource URI：

- `armed-academy://canon/active_engine`
- `armed-academy://writing-policy/active_writing_card`
- `armed-academy://outputs/task_prompt`
- `armed-academy://error-report/compressed_rules`
- `armed-academy://jsonl/data:outputs:logs:mcp_tool_audit.jsonl`

MCP prompts：

- `prompts/list` 目前暴露 5 個白名單 prompt 模板。
- `prompts/get` 只能讀白名單 prompt name，不接受任意檔案路徑。
- 若傳入 `arguments`，會附加在模板後的 `Runtime Arguments` 區塊。
- `compress_errors` 可用 `source_scope` 指定本次要壓縮的正式錯誤報告範圍。

Prompt names：

- `generate_chapter`
- `proofread_draft`
- `settle_chapter`
- `compress_errors`
- `rewrite_by_errors`

MCP 寫入審計欄位：

- `audit_id`、`created_at`、`status`
- `tool_name`、`risk`、`actor`
- `input_summary`：長文字只存長度、SHA-256 與短 preview。
- `affected_paths`、`previous_version`、`new_version`
- `confirmation_id`
- `result`：工具輸出摘要、是否錯誤、輸出 SHA-256

查詢 MCP audit：

```powershell
node server/src/tools/query-mcp-audit.mjs --latest --limit 5
```

依工具與確認碼查詢：

```powershell
node server/src/tools/query-mcp-audit.mjs --tool import_policy_file --confirmation-id none
```

輸出 JSON 摘要：

```powershell
node server/src/tools/query-mcp-audit.mjs --risk high-risk-write --json
```

Smoke test 會檢查：

- `initialize`、`tools/list`、`tools/call` 可正常回應。
- 17 個預期工具都有暴露。
- 未知工具、非物件 params、缺少工具 name 都必須回傳 JSON-RPC `-32602`，且 server 隨後仍可回應 `ping`。
- 已知只讀工具的無效 arguments 會回傳 `result.isError` 與 content 錯誤訊息，不會誤用 JSON-RPC protocol error。
- 17 個工具都會由 server 實際拒絕未宣告 arguments，落實 `inputSchema.additionalProperties: false`；非讀取工具另須留下零副作用的 `tool_error` audit。
- 所有 `inputSchema.enum` 欄位都會由 server 實際拒絕非法值；非讀取工具會留下零副作用的 `tool_error` audit，且型別錯誤仍保留原有型別訊息。
- Server 會集中驗證 `inputSchema` 的字串、布林、正整數及其 `minimum`／`maximum`、陣列與字串陣列元素；錯誤不會進入工具程式，非讀取工具仍留下零副作用 audit。
- 所有 `inputSchema.required` 欄位會由 server 集中驗證；缺少、`null` 或空字串都會在工具執行前被拒絕，非讀取工具留下零副作用 audit。
- Activation 的 `version`／`candidate`、settlement 的 `draftId`／`sourceFile`／`text` 必須恰好一項；commit 必須使用無 selector 的 `list=true`，或在 `errorId`／`feedbackId`／`latest` 中恰選一項。這些規則會公開在 `inputSchema.x-cross-field-constraints` 並由 server 執行。
- Smoke test 會直接讀取 `tools/list`，確認 17 個工具的 `additionalProperties`、type、array items、minimum、maximum、maxLength、maxItems、enum、required、default、null normalization、empty-string normalization、string-array normalization 與 cross-field metadata，並核對 enum／required／maximum／cross-field fixtures 沒有漏欄位。
- 目前 34 個 schema defaults 會逐項核對型別、enum／minimum／maximum 合法性與預期值；`validate_jsonl.all` 不宣告靜態 default，保留「未指定 files 時才驗證全部」的條件式行為。
- 17 個工具的 `x-null-normalization` 必須逐一符合統一契約；required-null、optional applyDefault 與 optional preserveNull 三種策略都有行為 fixture。
- 17 個工具的 `x-empty-string-normalization` 也必須逐一符合統一契約；required blank、optional applyDefault、optional omit 與 cross-field trimmed presence 四種策略都有行為 fixture。
- 17 個工具的 `x-string-array-normalization` 必須逐一符合統一契約；`files`、`established`、`unsettled`、`reminders`、`notes` 五個字串陣列欄位都有 blank-item fixture。
- 70 個字串欄位、5 個字串陣列與 5 個陣列 item 限制會逐一核對；8 個超限 fixtures 覆蓋四級字串、兩級 `maxItems` 與兩級 item `maxLength`，約 1 MB 的正文也必須在 handler 前被拒絕。
- 5 個正整數欄位的 `maximum` 會逐一核對；5 個超限 fixtures 必須收到精確錯誤訊息，4 個非只讀工具另須留下零副作用的 `tool_error` audit。
- 五個高風險工具會在 `inputSchema.x-confirmation` 公開 real-write 條件、確認欄位、必要值與錯誤訊息；server guard 直接讀取同一份 metadata，smoke test 再與缺碼 fixtures 交叉核對。
- Smoke test 會檢查 5 筆 default application audit；其中 commit 與 settlement 省略 `dryRun: false` 後仍須由 server 補值並在進入工具前觸發 confirmation guard。
- Smoke test 另含 6 個 optional `null` fixtures 與 4 筆 audit：default 欄位必須補值，無 default 欄位必須保留 `null`，所有呼叫都不得改動受保護檔案。
- 五個高風險工具的型別錯誤與必要條件缺漏會回傳 `result.isError`；audit 必須是 `tool_error`、`confirmation_id: null`、`affected_paths: []`。Settlement 的重複文字欄位也會拒絕非字串陣列或非字串元素。
- 五個高風險工具在 `dryRun: false` 但缺少各自 confirmation 時，會回傳 `result.isError`；audit 必須是 `tool_error`、`confirmation_id: null`、`affected_paths: []`。
- 四個字串 token 高風險工具在收到錯誤 token 時仍會拒絕；audit 會保留實際錯誤 token，但仍是 `tool_error` 且沒有 affected paths。
- 五個高風險工具在收到正確 confirmation 且 `dryRun: true` 時，必須完成計畫輸出；audit 為 `completed`、保留正確 `confirmation_id`，且 `affected_paths: []`。
- `import_policy_file` 與 `activate_engine_version` 在收到正確 confirmation、`dryRun: false`，但來源內容已完全一致時，必須完成 no-op；不得建立備份或操作紀錄，audit 為 `completed` 且 `affected_paths: []`。
- `activate_engine_version` 在正確確認下若 `requiredCurrentSha` 與 active engine 不符，必須回傳 `result.isError`；audit 為 `tool_error`、保留 `ACTIVATE`，且不得產生任何寫入。
- `resources/list` 會列出預期資源。
- `resources/read` 可讀取 `compressed_rules.md`。
- 未知 resource URI、非物件 params、缺少 URI 都必須回傳 JSON-RPC `-32602`，且 server 隨後仍可回應 `ping`。
- `prompts/list` 會列出 5 個模板。
- `prompts/get` 會逐一讀取 5 個模板，核對宣告參數、關鍵段落與完整 runtime arguments。
- 未知 prompt name、非物件 params、缺少 name 都必須回傳 JSON-RPC `-32602`，且 server 隨後仍可回應 `ping`。
- 未知 method、Invalid Request、Parse error 分別必須回傳 `-32601`、`-32600`、`-32700`，解析錯誤後 server 仍可回應 `ping`。
- 含中文 body 的 `Content-Length` request 必須回傳 header-framed response，並可在同一連線立即切回 newline framing。
- `Content-Length` header、header/body 分隔符與中文字 UTF-8 序列會被拆成 5 次 write，確認 server 可跨 chunk 完整重組。
- 兩個含中文內容的 `Content-Length` frames 會串接在單次 write 中，確認 parser 可逐幀回傳兩個 header responses。
- 一個 `Content-Length` frame 與一個 newline frame 會以此順序串接在單次 write 中，確認兩種 response framing 皆正確。
- 一個 newline frame 與一個 `Content-Length` frame 也會以反向順序串接在單次 write 中，確認 parser 可由 line 分支切回 header 分支。
- 非數字 `Content-Length` 會回傳 header-framed `-32700`；同一 write 中緊接的合法 newline request 仍可正常處理。
- 正確 `Content-Length` 包住無效 JSON body 時，也會回傳 header-framed `-32700`，並從 body 結尾正確處理後續 newline request。
- `Content-Length` 與 newline body 超過 16 MiB 時，必須分別回傳 header-framed 與 line-framed `-32700`；測試以 517 次分塊 write 跨過上限，丟棄超限 frame 後仍須正常回應 recovery ping。
- `Content-Length` header 超過 8 KiB 時，必須回傳 header-framed `-32700`；header/body 分隔符即使跨 chunk，後續 newline recovery ping 仍須成功。
- 三個獨立 server process 會分別以 2、2、3 次 write 傳入未換行 JSON、未完成 header、未收滿的 `Content-Length` body，再關閉 stdin；必須得到 1 個 line-framed 與 2 個 header-framed `-32700`，且每個 process 都自行以 exit code 0 結束。
- 5 個非法 `Content-Length` fixtures 覆蓋同值重複、不同值衝突、尾隨垃圾、負值與超安全整數；每個錯誤都必須 header-framed，且同一 write 緊接的 newline recovery ping 必須成功。
- Dispatch queue 壓力 fixture 會以一個唯讀工具請求壓住隊首，再送入 255 個 ping、1 個超額 notification 與 2 個超額 request；前 256 個 request 必須完成、2 個 request 必須收到 `-32000`、notification 不得產生 response，drain 後 recovery ping 必須成功。
- Stdout backpressure fixture 會先暫停讀取 child stdout，再以單次 write 傳入 1,024 個壞 JSON frame 與 1 個 recovery ping；延遲 100 ms 後恢復讀取，必須完整收到 1,024 個 `-32700` 與 recovery response，且不得留下半個 response。
- 兩個 backpressure/EOF 交錯 fixtures 各排入 1,024 個 parse errors 後立即關閉 stdin：完整 ping 尾幀必須成功且不得誤報截斷；半個 JSON 尾幀必須等前序 1,024 個 errors 全部送出後，最後才回 EOF `-32700`。
- `validate_jsonl` 可單檔檢查。
- `query_mcp_audit` 可查到 `import_policy_file` 審計紀錄。
- `import_policy_file`、`compress_error_rules` 與 `activate_engine_version` 維持 dry-run 預設。
- Smoke test 會核對 `server/src/tools/` 的 15 支正式腳本清單並逐支執行 `node --check`；過期底線版 activation、錯位 context builder 與根目錄 `outputs/` 產物必須保持不存在。
- Smoke test 期間會產生並驗證 MCP 寫入審計，成功或失敗後都必須逐位元組恢復原始 audit log，不得留下測試紀錄。
- `active_engine.md`、`active_writing_card.md`、`active_proofing_card.md`、`active_longline.md` 與 `compressed_rules.md` hash 不變。

## 資料權限順序

若資料互相衝突，依下列順序處理：

```text
Canon DB > 正式結算資料 > Writing Policy DB > Error Report DB > Feedback DB > Preference Memory > Working Memory
```

硬規則：

1. 候選正文永遠不能直接進正史。
2. 寫作卡不能覆蓋創作引擎。
3. 錯誤報告不能反向改寫正式設定。
4. Feedback Memory 不能把未採用內容當正史。
5. RAG 找到的資料必須保留來源與版本。
6. CAG 只放壓縮後的穩定核心，不放大量未整理資料。
7. 正史更新必須經正式章節結算與使用者確認。
8. MCP 寫入工具必須分權限。
9. `active_engine` 只能由正式章節結算流程更新。
10. `active_writing_card` 只能由寫作卡升級流程更新。
11. 未支付技能方向只能作為防越界索引，不得當作已掌握能力。
12. 使用者未正式採用的候選正文不得進入 Canon DB。
13. `overwrite_active_engine` 不得由 AI 自動執行。

## 建議工作流

### 下一章正文候選

1. 先決定本次任務關鍵字，例如角色名、場景、能力、錯誤類型。
2. 跑 `run-pipeline.mjs`。
3. 打開 `data/outputs/task_prompt.md`。
4. 將 `task_prompt.md` 交給 AI 起稿。
5. 起稿前先檢查 Canon Guard 風險。
6. 候選正文完成後仍不得寫入正史。

## 測試

完整本機與 CI gate：

```powershell
node tests/run-all.mjs
```

也可以使用標準指令：

```powershell
npm.cmd test
```

完整測試會依序檢查 JSON/JSONL、visual index、15 個來源登錄與信任紀錄、路徑越界防護、交易回滾、管線失敗原子性、7 個 Canon golden fixtures、UI 伺服器與路由契約，以及 17 個 MCP 工具的 schema、權限、稽核與傳輸契約。CI 同時在 Ubuntu Node 18、Windows Node 18 與 Ubuntu Node 24 執行。

### 正式採用前驗稿

1. 準備候選正文。
2. 用候選正文相關角色、場景、能力與錯誤類型跑檢索。
3. 用 `--mode proofread` 組裝任務提示。
4. 若發現 P0 正史硬錯，停止並退稿。
5. 若是 P1 / P2，重寫結構或場景。
6. 若是 P3 / P4，可局部修句。

### 正式章節結算

1. 只使用使用者明確採用的完整正文。
2. 用 `--mode settle` 組裝任務提示。
3. 只抽取正式成立事項、未成立邊界與新版引擎候選。
4. 等使用者確認後才可更新 `active_engine.md`。

## 專案結構

```text
launcher.cmd
launcher.ps1
start-ui.cmd

data/
  canon_db/
    active_engine.md
    versions/
    pending_engine_candidates/
      <candidate_id>/
        raw_import.txt
        candidate_engine.md
        metadata.json
        diff.json
        risk_report.json
        status.json
    rejected_engine_candidates/
    activation_logs/
  writing_policy_db/
    active_writing_card.md
    versions/
  proofing_policy_db/
    active_proofing_card.md
    sources/
    versions/
  longline_db/
    active_longline.md
  error_report_db/
    *.jsonl
    compressed_rules.md
  feedback_db/
    *.jsonl
  memory_store/
    *.json
  visual_db/
    visual_index.jsonl
    assets/
      characters/
      armed_forms/
      outfits/
      abilities/
      expressions/
      scenes/
  agent_runs/
    <run_id>/
      run.json
      neural_modules_used.json
      warnings.json
      blocked_reason.json
    neural_traces/
      <trace_id>.json
    neural_outputs/
  outputs/
    current_prompt.md
    generation_context.md
    retrieval_context.md
    task_prompt.md
    runs/
      <run_id>/manifest.json
    compressed_rule_candidates/
    logs/
      mcp_tool_audit.jsonl
      transactions/

config/
  README.md
  mcp-client.example.json
  mcp-client.windows-local.example.json

server/src/
  file-transactions.mjs
  mcp-server.mjs
  mcp-smoke-test.mjs
  process-control.mjs
  project-paths.mjs
  source-registry.mjs
  source-trust.mjs
  visual-db.mjs
  tools/
    build-current-prompt.mjs
    search-context.mjs
    build-task-prompt.mjs
    run-pipeline.mjs
    import-policy-file.mjs
    add-feedback.mjs
    commit-error-report.mjs
    validate-jsonl.mjs
    query-mcp-audit.mjs
    compress-error-rules.mjs
    save-draft.mjs
    save-proof-report.mjs
    create-settlement-proposal.mjs
    activate-engine-version.mjs
    source-trust-checker.mjs
    validate-json-codeblocks.mjs

tests/
  pipeline/
  security/
  transactions/
  golden/
  tools/
  ui/

prompts/
  generate_chapter.md
  proofread_draft.md
  settle_chapter.md
  compress_errors.md
  rewrite_by_errors.md
```

## 下一步開發

目前狀態：

1. 正式 Canon、寫作卡、驗稿卡與長線骨架均已匯入。
2. 按 `active_longline.md` 的篇章方向持續承接，但不得把未發生長線提前寫成 Canon。
3. 錯誤壓縮規則須等待正式錯誤報告累積，不得由 AI 自行生成高權重規則。

本機工程、交易式寫入、隔離式流水線、混合檢索、正式政策匯入、contract tests、golden tests 與跨平台 CI gate 均已完成；目前沒有外部正式母檔阻塞。
