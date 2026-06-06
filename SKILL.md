---
name: novel-agent-system
description: 長篇群像小說 AI 寫作代理系統規格。Use when building, operating, or extending a ChatGPT App / MCP based fiction-writing agent that combines CAG, RAG, error reports, feedback learning, layered memory, Neural Critic, and Canon Guard for chapter drafting, proofing, rewriting, and settlement.
---

# 長篇群像小說 AI 寫作代理系統規格

本文件定義一套以 ChatGPT App / MCP 為入口的小說創作代理系統。系統不是單純 Prompt 工具，也不是讓 AI 自行永久訓練成名作家，而是：

> CAG / RAG 混合檢索 + 錯誤報告驅動 + Feedback Learning Loop + 分層 Memory + Neural Critic + Canon Guard + ChatGPT App / MCP 的小說創作代理系統。

系統必須在每次寫作前讀取最新版正史資料、正文寫作卡、錯誤報告、使用者偏好與當前任務上下文，再進行正文生成、驗稿、重寫、錯誤報告候選生成、回饋寫入與結算建議。

## 1. 系統定位

本系統是「混合式神經寫作系統」。它不是單純 RAG，也不是純神經網路黑箱。

系統把「創作判斷」與「資料權限」分層處理：

- 神經網路負責創作、模糊判斷、角色模擬、語感判斷、錯誤歸納與重寫。
- 資料庫與規則層負責正史、版本、硬設定、合法承接位置、未支付邊界與權限控管。
- AI 不能自行把候選稿寫入正史。
- AI 不能把未支付方向當成已成立結果。
- AI 不能把錯誤報告反向改寫正式設定。
- 正史更新必須經使用者正式採用與正式章節結算。

核心目標是讓 AI 在有限上下文中穩定創作，同時保護長篇群像小說最容易失控的部分：正史承接、角色主體性、伏筆支付、能力邊界、章節承重與使用者偏好。

## 2. 核心資料庫分工

### Canon DB｜正史資料庫

來源：

- `data/canon_db/active_engine.md`
- `data/canon_db/versions/engine_vX.X.X.md`

用途：

- 世界觀
- 人物資料
- 能力資料
- 關係邊界
- 正式正史
- 合法承接位置
- 已成立傷勢
- 已支付伏筆
- 未支付技能方向之防越界資料

權限：

- Canon DB 擁有最高權限。
- 只能由正式章節結算流程更新。
- 不得由候選正文、錯誤報告、Feedback Memory 或正文寫作卡直接覆蓋。
- 若其他資料與 Canon DB 衝突，以 Canon DB 為準。
- 若 Canon DB 資訊不足，AI 必須標記不確定，不得自行補成正史。

### Writing Policy DB｜寫作規則庫

來源：

- `data/writing_policy_db/active_writing_card.md`
- `data/writing_policy_db/versions/writing_card_vX.X.md`

用途：

- 候選正文如何成稿
- 章節承重
- 群像調度
- 戰鬥描寫
- 醫療後座
- 日常與戀愛
- 對話自然度
- 場景波峰
- 修稿順序

權限：

- Writing Policy DB 決定「怎麼寫」。
- Writing Policy DB 不能決定「什麼已成正史」。
- Writing Policy DB 不能覆蓋 Canon DB。
- 寫作卡可調整文風、節奏、場景策略與修稿順序，但不得新增正式事件、正式設定或正式關係結論。

### Error Report DB｜錯誤報告庫

路徑：

```text
data/error_report_db/
  canon_errors.jsonl
  character_errors.jsonl
  dialogue_errors.jsonl
  pacing_errors.jsonl
  battle_errors.jsonl
  preference_errors.jsonl
  compressed_rules.md
```

用途：

- 記錄 AI 過去在本作品中犯過的錯。
- 生成前檢索相關錯誤。
- 下次寫作時避免重犯。
- 把使用者退稿原因轉成可檢索、可執行的修正規則。

錯誤類型：

- 正史承接錯誤
- 角色工具人錯誤
- 對話 AI 腔錯誤
- 章節流程化錯誤
- 戰鬥過度安全錯誤
- 使用者偏好錯誤

權限：

- Error Report DB 可以約束下次生成。
- Error Report DB 不能反向修改 Canon DB。
- Error Report DB 不能把退稿內容、候選正文或使用者未採用方向升格為正史。

### Feedback DB｜回饋資料庫

路徑：

```text
data/feedback_db/
  accepted_drafts.jsonl
  rejected_drafts.jsonl
  revision_pairs.jsonl
  preference_pairs.jsonl
  pending_error_reports.jsonl
```

用途：

- 記錄採用稿。
- 記錄退稿原因。
- 記錄 A/B 稿偏好。
- 產生錯誤報告候選。
- 支援 Feedback Learning Loop。

權限：

- Feedback DB 是學習素材，不是正史。
- 採用稿只有在正式章節結算後，才可影響 Canon DB。
- 退稿與偏好可影響 Preference Memory、Error Report DB 候選與寫作策略。

### Memory Store｜記憶層

路徑：

```text
data/memory_store/
  canon_memory.json
  preference_memory.json
  working_memory.json
```

分工：

- Canon Memory：只能由正式結算更新，用於快取正史摘要與可承接狀態。
- Preference Memory：可由回饋迴圈更新，用於記錄使用者偏好、常見退稿原因與風格取向。
- Working Memory：只保存本輪任務上下文，任務結束後可丟棄。

權限：

- Canon Memory 不得高於 Canon DB。
- Preference Memory 不得把未採用內容當正史。
- Working Memory 不得跨任務污染正式資料。

## 3. CAG / RAG 分工

### CAG｜常駐上下文

CAG 放每次都必須知道的穩定核心。它應該短、穩定、壓縮後可長期重用。

內容：

- 現行正史位置
- `active_engine` 摘要
- `active_writing_card` 摘要
- 專案最高禁止事項
- 高頻錯誤壓縮規則
- 任務模式規則

範例：

```text
正史止於目前 active_engine 所記錄之正式章節。
不得承接未正式採用稿。
不得把未支付方向寫成正史。
候選正文未正式採用與結算前不成正史。
每章必須有承諾、推進與支付。
```

CAG 禁止放入大量未整理資料。若資料過長，必須先壓縮成穩定規則或摘要，再進入常駐上下文。

### RAG｜動態檢索

RAG 負責本次任務需要的資料。

內容：

- 特定角色資料
- 特定能力卡
- 特定章節正史
- 特定錯誤報告
- 特定寫作卡段落
- 特定長線邊界

要求：

- RAG 回傳資料必須保留來源、版本與段落 ID。
- RAG 結果必須標示資料類型，例如 `canon`、`writing_policy`、`error_report`、`feedback`、`memory`。
- 若多筆資料互相衝突，必須依權限排序處理：Canon DB > 正式結算資料 > Writing Policy DB > Error Report DB > Feedback DB > Preference Memory > Working Memory。
- RAG 找不到資料時，不得用推測補成正史。

## 4. 神經寫作系統模組

### Embedding Retriever

功能：

- 搜尋相關角色、設定、錯誤報告、寫作規則。
- 支援語意檢索與關鍵字檢索。
- 回傳來源、版本、段落 ID、相似度與資料權限層級。
- 在生成前為本次任務組合最小必要上下文。

輸出應包含：

- `matched_documents`
- `source_path`
- `version`
- `section_id`
- `relevance_reason`
- `authority_level`

### Scene Planner

功能：

- 判斷本章真正該寫什麼主戲。
- 避免章節只靠公告、等待、流程推進。
- 確認本章至少支付一個具體後果。
- 明確列出本章承諾、推進、支付與不可越界處。

輸出應包含：

- 本章主戲
- 角色主動選擇
- 必須支付的後果
- 不得提前定案的方向
- 場景順序與波峰

### Character Simulator

功能：

- 模擬角色當下目的、壓力、誤判、面子、逃避與選擇。
- 避免角色變工具人。
- 避免群像排隊發言。
- 檢查每個重要角色是否有自己的資訊差、情緒代價與行動邏輯。

輸出應包含：

- 角色當下想要什麼
- 角色怕失去什麼
- 角色誤判什麼
- 角色願意犧牲什麼
- 角色在場景中造成什麼變化

### Draft Generator

功能：

- 根據 Canon DB、Writing Policy DB、CAG、RAG、錯誤報告與任務上下文生成正文候選。
- 只輸出正文或指定格式。
- 不更新正式資料。
- 不自行補足未查到的正式設定。

限制：

- 不得承接未正式採用內容。
- 不得把未支付方向寫成正史。
- 不得自行定案代表資格、正式名額、正式編組、重大能力突破、長期失能、死亡或重大關係翻轉。
- 若任務要求超出可承接範圍，必須先回報風險。

### Neural Critic

功能：

- 評估候選稿是否流程化。
- 評估角色是否工具人。
- 評估對話是否 AI 腔。
- 評估戰鬥是否過度安全。
- 評估醫療後座、關係後座、勝負後座是否具體支付。
- 評估是否違反使用者已知偏好。

輸出應包含：

- 問題位置
- 問題類型
- 嚴重度
- 為什麼不好
- 應該如何修
- 是否需要結構重寫

### Rewrite Agent

功能：

- 根據 Neural Critic 與 Canon Guard 的結果重寫。
- P0 / P1 問題不得只修句，必須重寫結構或場景。
- P2 問題通常需要重排主戲。
- P3 / P4 可局部修句。

限制：

- 重寫不得繞過 Canon Guard。
- 重寫不得把修稿建議擴張成新正史。
- 重寫後必須重新經過 Canon Guard 與 Neural Critic。

### Preference Ranker

功能：

- 比較多版候選稿。
- 根據使用者過去偏好選出較接近的一版。
- 產生 `preference_pairs` 記錄。
- 將偏好歸因到可重用規則，而不是只記錄單次喜好。

輸出應包含：

- 推薦版本
- 推薦理由
- 使用者偏好依據
- 兩版差異
- 可寫入的偏好候選

## 5. Canon Guard 正史保護器

Canon Guard 是最高安全閘門。任何正文候選、驗稿結果、重寫稿、結算候選或工具寫入，都必須先通過 Canon Guard。

必須檢查：

- 是否承接未正式採用稿。
- 是否把候選內容當成正史。
- 是否提前支付長線骨架。
- 是否把未支付技能方向寫成已掌握能力。
- 是否自行新增角色關係、能力突破、正式名額、正式編組、長期傷勢、死亡或重大關係翻轉。
- 是否讓正文寫作卡覆蓋創作引擎。
- 是否讓錯誤報告反向修改正式設定。
- 是否讓 Feedback Memory 把退稿內容當成正式事件。

若發現 P0 正史硬錯：

```text
直接停止或退稿，不得局部修補硬過。
```

Canon Guard 輸出應包含：

- `status`: `pass`、`needs_revision`、`reject`
- `severity`: `P0` 至 `P4`
- `conflict_type`
- `conflicting_source`
- `candidate_claim`
- `canon_claim`
- `required_action`

## 6. Feedback Learning Loop

Feedback Learning Loop 將使用者回饋轉成可檢索、可驗證、可持續改進的資料，但不得繞過正史權限。

### 可自動執行

- 分析使用者退稿原因。
- 標記錯誤類型。
- 判斷嚴重度。
- 產生錯誤報告候選。
- 產生下次修正規則。
- 寫入 `pending_error_reports`。
- 下次生成前檢索相關錯誤。
- 組合 `generation_context`。
- 根據錯誤報告重寫正文。

### 需要使用者確認

- 正式寫入高權重錯誤報告。
- 更新 `compressed_rules.md`。
- 更新 `active_writing_card`。
- 更新 `active_engine`。
- 套用正式章節結算。
- 刪除或覆蓋長期資料。

### 建議流程

```text
使用者退稿
↓
add_feedback_raw()
↓
generate_error_report_candidate()
↓
classify_severity()
↓
若 P3 / P4：
    可自動寫入低風險錯誤庫
若 P0 / P1 / P2：
    pending_review
    等使用者確認
↓
commit_error_report()
↓
下次生成時 search_error_reports()
↓
build_generation_context()
↓
AI 根據錯誤報告避錯與重寫
```

### 回饋寫入原則

- 原始回饋先進 Feedback DB。
- 錯誤報告候選先進 `pending_error_reports.jsonl`。
- 高嚴重度錯誤必須等待使用者確認。
- 使用者確認後，才可寫入正式 Error Report DB。
- 任何回饋都不得直接更新 Canon DB。

## 7. 錯誤報告格式

錯誤報告使用 JSONL，一行一筆。

格式：

```json
{
  "error_id": "E-PACING-0001",
  "created_at": "2026-06-05T00:00:00+08:00",
  "source": "user_feedback",
  "task_type": "chapter_draft",
  "chapter": "第二十章候選稿",
  "severity": "P2",
  "category": "章節流程化",
  "scene_type": ["正式選拔", "戰鬥"],
  "characters": ["朝日奈千夜", "九逃"],
  "bad_pattern": "整章只處理公告、等待、入場與規則說明，沒有角色選擇造成的變化。",
  "why_bad": "使用者要求章節必須有具體支付，不接受只用流程代替主戲。",
  "fix_rule": "正式競技章節必須讓至少一名角色因自身選擇失去主動權、受傷、錯過、暴露弱點或形成後續麻煩。",
  "example_bad": "角色依序入場，聽完規則，完成對戰。",
  "example_fix": "角色因醫療限制不能進入原本觀戰位置，導致錯過關鍵資訊，下一場判斷被迫改變。",
  "action": "structure_rewrite",
  "status": "active"
}
```

必要欄位：

- `error_id`：穩定唯一 ID。
- `created_at`：ISO 8601 時間。
- `source`：來源，例如 `user_feedback`、`critic_report`、`proofing`。
- `task_type`：任務類型。
- `chapter`：章節或候選稿標記。
- `severity`：`P0` 至 `P4`。
- `category`：錯誤分類。
- `scene_type`：場景類型陣列。
- `characters`：涉及角色陣列。
- `bad_pattern`：錯誤模式。
- `why_bad`：錯誤原因。
- `fix_rule`：下次可執行的修正規則。
- `example_bad`：錯誤例。
- `example_fix`：修正例。
- `action`：建議處理方式。
- `status`：`pending_review`、`active`、`archived`。

嚴重度：

```text
P0：正史硬錯，直接退稿。
P1：角色、能力或主戲重大錯，必須重寫。
P2：章節結構錯，需要重排主戲。
P3：語感與對話錯，可局部修句。
P4：偏好提醒，可下次生成前參考。
```

ID 命名建議：

```text
E-CANON-0001
E-CHARACTER-0001
E-DIALOGUE-0001
E-PACING-0001
E-BATTLE-0001
E-PREFERENCE-0001
```

## 8. MCP / ChatGPT App 工具設計

MCP tools 必須依權限分層。工具名稱需穩定、語意清楚，輸入輸出需可記錄。

### 只讀工具

```text
get_current_project_state()
get_active_engine()
get_active_writing_card()
search_error_reports()
build_generation_context()
```

規則：

- 只讀工具可自動呼叫。
- 只讀工具不得寫入任何長期資料。
- `build_generation_context()` 必須標示每段資料來源、版本與權限層級。

### 低風險寫入工具

```text
add_feedback_raw()
generate_error_report_candidate()
save_draft()
save_proof_report()
```

規則：

- 低風險寫入工具可半自動執行。
- 寫入位置必須是草稿、報告、候選或 pending 區域。
- 不得更新 Canon DB。
- 不得覆蓋現行正式版本。

###  高風險寫入工具

```text
commit_error_report()
update_compressed_rules()
activate_writing_card_version()
create_settlement_proposal()
approve_settlement()
activate_engine_version()
overwrite_active_engine()
```

規則：

- 高風險寫入工具必須二次確認。
- 執行前必須顯示差異、來源、影響範圍與回復方式。
- `overwrite_active_engine()` 原則上禁止常規使用，只能作為人工修復工具。
- `approve_settlement()` 與 `activate_engine_version()` 必須依正式章節結算流程執行。

### 工具審計要求

每個寫入工具都應記錄：

- `tool_name`
- `called_at`
- `actor`
- `input_summary`
- `affected_paths`
- `previous_version`
- `new_version`
- `confirmation_id`
- `result`

## 9. 任務模式

系統須支援以下任務模式。

### 下一章正文候選

輸入：

- `active_engine`
- `active_writing_card`
- 現行長線骨架
- 錯誤報告
- 任務指令

輸出：

- 完整正文候選
- 不更新正史

禁止：

- 不得承接未正式採用內容。
- 不得把未支付方向寫成正史。
- 不得自行定案代表資格、正式名額、正式編組、重大能力突破、長期失能、死亡或重大關係翻轉。

流程：

```text
讀取 CAG
↓
RAG 檢索任務相關資料
↓
Scene Planner 建立本章主戲
↓
Character Simulator 檢查角色主體性
↓
Draft Generator 生成候選正文
↓
Canon Guard 檢查正史硬錯
↓
Neural Critic 檢查品質錯誤
↓
必要時 Rewrite Agent 重寫
↓
輸出候選正文
```

### 正式採用前驗稿精修

輸入：

- `active_engine`
- `proofing_card`
- 候選正文
- 錯誤報告

輸出：

- 若可修：完整重寫正文
- 若不可修：退稿原因
- 若正式衝突：停止原因

流程：

```text
讀取候選正文
↓
Canon Guard 檢查硬性衝突
↓
Neural Critic 檢查結構、角色、對話、戰鬥與後座
↓
若 P0：停止並回報
若 P1 / P2：結構重寫
若 P3 / P4：局部修句或偏好調整
↓
輸出完整重寫稿或退稿原因
```

### 正式章節結算

輸入：

- `active_engine`
- 使用者明確採用的完整正文

輸出：

- 檢核結果
- 必要提醒
- 完成狀態
- 新版引擎候選

禁止：

- 不得續寫。
- 不得補戲。
- 不得推定未成立結果。
- 不得把未支付方向寫成正史。

流程：

```text
確認使用者明確採用
↓
抽取正式成立事件、傷勢、關係變化、能力變化與伏筆支付
↓
Canon Guard 檢查是否包含未支付或未成立推定
↓
產生 settlement_proposal
↓
等待使用者確認
↓
approve_settlement()
↓
activate_engine_version()
```

### 設定除錯

輸出：

- 問題清單
- 衝突原因
- 建議修正
- 可直接執行的下一步

流程：

```text
讀取相關 Canon DB 與版本資料
↓
搜尋 Writing Policy、Error Report 與 Feedback 是否造成誤導
↓
列出衝突與權限來源
↓
提出可審核修正方案
↓
需要更新正式資料時，走高風險確認流程
```

## 10. 建議專案結構

建議專案結構如下：

```text
novel-agent-system/
  SKILL.md
  README.md
  .env

  data/
    canon_db/
      active_engine.md
      versions/

    writing_policy_db/
      active_writing_card.md
      versions/

    proofing_policy_db/
      active_proofing_card.md
      versions/

    longline_db/
      active_longline.md
      versions/

    error_report_db/
      canon_errors.jsonl
      character_errors.jsonl
      dialogue_errors.jsonl
      pacing_errors.jsonl
      battle_errors.jsonl
      preference_errors.jsonl
      compressed_rules.md

    feedback_db/
      accepted_drafts.jsonl
      rejected_drafts.jsonl
      revision_pairs.jsonl
      preference_pairs.jsonl
      pending_error_reports.jsonl

    memory_store/
      canon_memory.json
      preference_memory.json
      working_memory.json

    outputs/
      drafts/
      proof_reports/
      settlement_proposals/
      logs/

  server/
    src/
      index.ts
      tools/
      services/

  prompts/
    generate_chapter.md
    proofread_draft.md
    settle_chapter.md
    compress_errors.md
    rewrite_by_errors.md
```

### 目錄用途

- `data/canon_db/`：正式正史與版本。
- `data/writing_policy_db/`：正文寫作卡與版本。
- `data/proofing_policy_db/`：驗稿與精修規則。
- `data/longline_db/`：長線骨架、伏筆邊界與未支付方向。
- `data/error_report_db/`：正式錯誤報告與壓縮規則。
- `data/feedback_db/`：回饋、退稿、採用、偏好與待審錯誤候選。
- `data/memory_store/`：分層記憶快取。
- `data/outputs/`：候選稿、驗稿報告、結算建議與工具日誌。
- `server/src/tools/`：MCP tool 實作。
- `server/src/services/`：檢索、守門、寫入、版本與審計服務。
- `prompts/`：各任務模式的 Prompt 模板。

## 11. 開發順序

### Phase 1｜本地 Prompt Builder

目標：

```text
能自動讀取 active_engine、active_writing_card、error_reports，生成 outputs/current_prompt.md。
``` 

(文件繼續...)
