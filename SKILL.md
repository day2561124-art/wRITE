---
name: writer-workbench
description: 《武裝學院的二三事》Writer Workbench 的現行頂層操作契約與架構導航。Use when operating, maintaining, or extending the current Writer Workbench architecture, Character Runtime / Cognition, world simulation, writing workflow, or controlled development runtime.
---

# Writer Workbench — Current Operating Contract

本文件是目前 repository 的頂層操作契約與導航頁，不再充當歷史 roadmap、Phase 日誌或過時的完整系統設計稿。

它的用途只有三個：

1. 定義跨模組都必須遵守的穩定 authority / safety / development invariants。
2. 說明目前 Writer Workbench 的主要 runtime 邊界，以及不同 runtime 之間誰可以讀什麼、誰可以決定什麼、誰可以寫什麼。
3. 把細節導向 repository 中的現行正式文件與測試，而不是在本檔複製一份容易腐化的第二真相來源。

**不要在這裡硬編最新 Phase、最新 commit SHA、origin/main hash、tool count 或一次性 milestone。** 這些都應從實際 repository、Development Journal、workstream/integration registry、authoritative remote status 與對應 architecture document 取得。

---

## 1. Project Direction

Writer Workbench 目前不只是小說 Prompt 工具，而是一套同時服務下列能力的受控系統：

- fiction writing / proofing / settlement；
- Canon、Entity、Longline、Visual 與 Feedback workflow；
- ChatGPT-owned external-brain writing orchestration；
- event-driven world simulation；
- Character Runtime / Cognition；
- subjective memory、retrieval、belief、self-model、motivation、goal、planning 與後續認知能力；
- controlled development runtime、workstream、isolated workspace、checkpoint、transaction、integration、Journal 與 cleanup governance。

長期角色目標是：

> 共享的是能力架構，不是角色的人生、主觀內容或決策結果。每個角色必須依自己的經歷、可見資訊、記憶、信念、目標、能力與當下條件形成行動。

世界模擬的長期方向是：

> 角色像世界中的人，而不是劇情控制器的傀儡；世界由可追蹤的因果與正式 mutation authority 推進，而不是由模型直接改寫硬狀態。

---

## 2. Authority Is Layered

所有功能都必須先回答一個問題：**這個模組擁有的是建議權、選擇權、裁決權、還是正式寫入權？**

不同 authority 不可因為資料「看起來合理」就互相越級。

核心原則：

- World Truth 不等於 Character Perception。
- Character Perception 不等於 Subjective Memory。
- Subjective Memory 不等於 Subjective Claim。
- Subjective Claim 不等於 Effective Belief。
- Belief 不等於 World Truth。
- Character intent / selected action 不等於 action result。
- Candidate writing 不等於 Canon。
- Feedback、error report、working memory、derived projection 都不能自行升格成 Canon。
- Read projection 不能因為方便而獲得 durable mutation authority。
- 模型輸出不能因為宣稱 `authoritative`、`model_backed`、`final` 或其他文字而自行取得權限。

權限應由 server-owned contract、provenance、正式 workflow 與測試證據決定。

---

## 3. Shared Neural Core: Shared Architecture, Hard Mode Boundaries

目前 Shared Neural Core 提供共用的執行／routing 架構，但至少必須維持兩個硬隔離 session mode：

- `writing`
- `world_simulation`

共用 core 不代表兩個模式可以混用 payload 或 authority。

### Writing mode

Writing mode 可以使用小說生成與評論所需的 writing context、Canon context、寫作規則與相關能力，但不得取得 world-simulation 的硬狀態裁決權。

### World-simulation mode

World-simulation mode 可以使用角色認知、感知、記憶檢索、候選行動與一致性評估能力，但必須拒絕用 plot goal、camera priority、desired romance progress、desired narrative result 等敘事控制訊號來操控角色選擇。

### Mode lock

- session mode 一旦建立即屬於其正式 lineage；
- writing session 不得偷用 world-only capability；
- world session 不得偷用 writing-only capability；
- compatibility wrapper 也不能繞過既有 session mode；
- model execution provenance 與 output acceptance 是兩件不同的事。

詳細規格以：

- `docs/SHARED-NEURAL-CORE-DUAL-MODE.md`

為準。

---

## 4. World Simulation Authority Boundary

世界模擬採 event-driven persistent loop，而不是把整個世界每秒全部跑一次。

核心資料流應維持：

```text
Persisted World State
-> queue-head event
-> scene causal analysis
-> per-character perception
-> per-character memory retrieval
-> per-character cognition
-> candidate action intents
-> character selects bounded intent
-> programmatic causal adjudication
-> consistency checks
-> authoritative chronological mutation
-> persisted next state / history
```

重要不變式：

- Character Brain 不得直接看到完整 World State。
- Character Brain 不得取得其他角色不可見的 hidden truth。
- Character Brain 只能從自己的合法候選行動中選擇，或拒絕全部。
- Character Brain 不得決定「行動是否成功」或直接產生 authoritative next state。
- 神經／模型層不得直接寫 hard world state。
- 因果結果與 next state 必須由程式化 adjudication / authoritative mutation boundary 決定。
- stale prepared turn 不得覆寫更新後的 world state。
- consistency conflict 必須阻止 commit，而不是硬吞衝突。

詳細規格以：

- `docs/WORLD-SIMULATION-MAIN-LOOP.md`
- `docs/WORLD-SIMULATION-AUTHORITATIVE-MUTATION-EXECUTOR.md`
- `docs/WORLD-SIMULATION-CHRONOLOGICAL-MUTATION-QUEUE.md`
- `docs/WORLD-SIMULATION-CROSS-LAYER-EVENT-ARBITRATION.md`

為準。

---

## 5. Character Runtime / Cognition

Character Runtime 的架構機制可以共用，但主觀狀態必須以角色為邊界。

### Per-character isolation

下列資料在語義上都必須保持角色隔離，除非某個正式 phase 明確定義了合法共享機制：

- perception；
- subjective memory；
- memory retrieval history / cues；
- subjective claims；
- effective beliefs；
- autobiographical organization；
- self narrative / self model；
- motivation / goals；
- plans / implementation intentions；
- learned subjective outcome evidence；
- future derived character-specific cognition state。

**共享能力架構 != 共享角色記憶。**

### No omniscient cognition

角色只能根據已合法進入該角色 subjective boundary 的資訊形成主觀認知。World Truth、engine provenance、debug state、其他角色私人狀態不能直接成為角色知道的內容。

### Replayable cognition where history matters

對可修訂、可追溯的長期認知狀態，優先採用：

```text
immutable evidence/history
+
replayable effective projection
```

而不是不可追溯的 last-write-wins 物件。

### Same-turn leakage prohibition

如果某個 cognition write 是本回合後段才形成的，它不能逆流進入同一回合較早的 Character Brain 決策。需要嚴格維持 prepare / decide / resolve / commit 的時間與 authority 邊界。

主要架構文件位於：

- `docs/WORLD-SIMULATION-SUBJECTIVE-COGNITION-READ-PROJECTION.md`
- `docs/WORLD-SIMULATION-AUTOBIOGRAPHICAL-MEMORY-ARCHITECTURE.md`
- `docs/WORLD-SIMULATION-SELF-NARRATIVE-SELF-INTERPRETATION-ARCHITECTURE.md`
- `docs/WORLD-SIMULATION-STRUCTURED-SELF-MODEL-ARCHITECTURE.md`
- `docs/WORLD-SIMULATION-SELF-MODEL-REVISION-ARCHITECTURE.md`
- `docs/WORLD-SIMULATION-MOTIVATION-GOAL-INTEGRATION-ARCHITECTURE.md`

後續 cognition phase 應延續上述 authority / replay / per-character 原則，不得只為新增功能而建立平行且互相競爭的第二套真相來源。

---

## 6. Memory and Retrieval

記憶系統目前的核心方向不是「把所有歷史塞進上下文」，而是建立可追溯、角色限定、按需取用的長期記憶與檢索機制。

核心不變式：

- subjective memory 由角色可合法感知／形成的內容構成；
- memory source 與 provenance 必須保留；
- autobiographical organization 應引用既有 memory / episode，而不是複製整份內容建立第二份記憶庫；
- retrieval 是 cue-dependent、bounded、可追溯的過程；
- 不建立隱形 semantic oracle；
- 不以自由 graph traversal 偷渡角色本來不知道的資訊；
- detailed episodic drill-down 應重用既有 memory-retrieval substrate，而不是每個 cognition phase 自建搜尋引擎；
- bounded read projection 用於 active cognition，完整 durable history 不應全量灌入每回合上下文。

主要文件：

- `docs/WORLD-SIMULATION-MEMORY-ACCESSIBILITY.md`
- `docs/WORLD-SIMULATION-MEMORY-ACCESSIBILITY-RETRIEVAL.md`
- `docs/WORLD-SIMULATION-MEMORY-RETRIEVAL-PROCESS.md`
- `docs/WORLD-SIMULATION-CHARACTER-RECOLLECTION-REINSTATEMENT.md`
- `docs/WORLD-SIMULATION-AUTOBIOGRAPHICAL-MEMORY-ARCHITECTURE.md`

---

## 7. Canon / Writing / Feedback Boundaries

Canon 與創作能力仍必須分層。

### Canon

Canon 是正式成立的故事事實來源。候選正文、proof report、feedback、error report、preference memory、working memory、LLM 推測都不是 Canon。

為維持既有 Canon contract 與 golden regression，相容性不變式必須保留以下精確語義：

- 不得承接未正式採用稿。
- 候選正文未正式採用與結算前不成正史。
- Error Report 只能作為避錯與修正規則，不能改寫正式設定。

涉及正式 Canon / active engine 的寫入必須走既有受控 adoption / settlement / activation / approval boundary。

### Writing policy

Writing policy 決定「怎麼寫」，不能自行決定「什麼已經正式發生」。

### Feedback / error learning

Feedback 可以影響：

- 下次生成策略；
- error report；
- preference；
- critique / rewrite guidance。

Feedback 不得直接：

- 改寫 Canon；
- 把退稿內容升格成正史；
- 把模型自評當成人類採用結果。

### Canon Guard

任何正式生成、proofing、settlement 或 activation 路徑，都必須保留對 Canon authority 的硬邊界。遇到 hard conflict 時應 fail closed，而不是靠模型「合理化」衝突。

核心 invariants 另見：

- `docs/core_invariants.md`
- `docs/SAFETY-CHECKLIST.md`
- `docs/DAILY-WORKFLOW.md`

---

## 8. External Brain / ChatGPT Bridge

External Brain 是受控的 ChatGPT-owned orchestration surface，不是第二個正式資料庫。

原則：

- formal writing 應從正式 architecture-primary entry 開始；
- session lineage、mode、context ownership 與 acceptance evidence 必須可追溯；
- external-brain session 本身不代表內容已採用；
- stale / abandoned session 的 retirement 必須遵守 lineage、governance pin 與 acceptance-evidence 保護；
- retirement 與 storage cleanup 是不同操作；retirement 不等於刪除；
- cleanup 必須走 server-owned scan / proposal / approval / execution boundary，不接受任意 caller path deletion。

參考：

- `docs/external-brain-session-authority-map.md`
- `docs/external-brain-session-retirement-and-reconciliation.md`

---

## 9. Development Runtime Contract

所有主工程開發應優先使用 Writer Workbench controlled development runtime，而不是用不受控 shell 直接操作 repository。

### 開工時

先從實際系統確認：

1. local repository HEAD；
2. authoritative remote status；
3. active workstreams / isolated workspaces；
4. Development Journal health；
5. transaction / checkpoint / workspace registry health；
6. 是否有與本次 scope 重疊的 active workstream；
7. 目前真正未完成的 phase / gap。

**不要依賴舊聊天中的 SHA 或 phase 狀態作為唯一真相。**

### Workstream

對可獨立開發的改動：

- 建立 bounded workstream；
- 宣告 scope；
- 優先建立 isolated workspace；
- 不把 shared main 的 unrelated dirty state 複製進 isolated workspace；
- scope overlap 要先判斷，不可盲目並行。

### Journal

Development Journal 必須保持：

- `health = healthy`；
- hash chain verified；
- 無未解 dangling operation；
- 無需要 reconciliation 的異常。

如果 operation 因 tunnel / child crash / tool interruption 留下 dangling state，應先依正式 recovery / reconciliation 機制處理，不要假裝沒發生。

### Checkpoint / transaction

checkpoint、restore、multi-file transaction 皆由 server-owned runtime 控制。不可繞過 barrier gate、不可任意指定 CAS blob 或 Git internals。

---

## 10. Testing Strategy

日常開發預設採 **focused / dependency-aligned testing**，不是每個小改動都跑 repository-wide `all`。

現行允許的 suite：

- `affected`
- `world_simulation`
- `cognition`
- `memory_retrieval`
- `mcp`
- `mcp_tunnel`
- `all`

使用原則：

- 小範圍文件／程式修改：先跑 `affected` 或最直接相關 focused suite；
- Cognition phase：至少跑對應 cognition focused regression，必要時加 `world_simulation` / `memory_retrieval`；
- MCP surface / tool schema / launcher / transport：跑 `mcp`，涉及 tunnel 再跑 `mcp_tunnel`；
- phase 封板或跨模組改動：使用 dependency-aligned suite，加 diff-check、Journal health 與必要 integration validation；
- `all` 僅在重大 milestone、跨模組大改、affected selector fallback、或證據不足時使用。

測試失敗不能只記錄後略過。若 failure 與本次變更相關，必須修復並重跑；若明確 unrelated，必須保留可審核證據。

---

## 11. Commit / Integration / Push Contract

完成 isolated workstream 時，標準流程是：

```text
focused tests
-> git diff / diff-check
-> self-review
-> controlled commit
-> integration preflight
-> formal integration validation
-> controlled fast-forward integration
-> push canonical origin/main
-> authoritative remote verification
-> cleanup isolated workspace
-> final Journal / registry health check
```

禁止：

- force push；
- 任意 rebase / reset main；
- 用 local tracking ref 假裝 authoritative remote；
- 在 validation 尚未通過時硬 integration；
- 為了讓測試過而移除 authority guard；
- 把 unrelated dirty files 一起 stage。

Authoritative remote 應使用正式 remote-status 能力驗證，而不是只看本地 `origin/main` tracking ref。

---

## 12. Research Before New Capability Layers

當目前 phase 已完整封板、準備開下一個 Character Runtime / Cognition / World Simulation 能力層時，不應直接憑直覺開工。

先做：

1. 盤點現有 substrate，確認真正缺口；
2. 確認是否已有相同 authority owner，避免重建平行系統；
3. 研究相關 cognitive science / agent architecture / game simulation / memory / planning 方法；
4. 區分可借鑑的概念與不適合本專案 authority model 的做法；
5. 建立 bounded architecture decision；
6. 定義 acceptance invariants 與 regression scope；
7. 再開始實作。

研究的目的不是照抄外部系統，而是找到與本專案下列特性相容的做法：

- deterministic / replayable；
- per-character subjective boundary；
- bounded context；
- no World Truth leakage；
- no LLM hard-state authority；
- auditable provenance；
- event-driven execution；
- scalable long-term memory / cognition。

---

## 13. Sealed Phases and Regression Policy

已經完成正式 acceptance、commit、integration、push、authoritative remote verification 的 phase，視為 sealed baseline。

後續不得因為「想整理」就重做 sealed implementation。

只有在出現下列證據時才重新打開：

- authoritative regression；
- failing scoped test；
- broken integration invariant；
- security / authority boundary violation；
- newer accepted architecture 明確要求 migration。

如果只是下一能力層需要新功能，應建立新的 phase / workstream，在現有 substrate 上擴充。

---

## 14. Source-of-Truth Navigation

`SKILL.md` 只保存長期穩定契約。遇到細節時，優先查對應正式來源：

| 類型 | 主要來源 |
| --- | --- |
| 核心硬規則 | `docs/core_invariants.md` |
| 日常 workflow | `docs/DAILY-WORKFLOW.md` |
| 安全檢查 | `docs/SAFETY-CHECKLIST.md` |
| Shared Neural Core | `docs/SHARED-NEURAL-CORE-DUAL-MODE.md` |
| World main loop | `docs/WORLD-SIMULATION-MAIN-LOOP.md` |
| Character memory | `docs/WORLD-SIMULATION-AUTOBIOGRAPHICAL-MEMORY-ARCHITECTURE.md` |
| Memory retrieval | `docs/WORLD-SIMULATION-MEMORY-RETRIEVAL-PROCESS.md` |
| Subjective cognition | `docs/WORLD-SIMULATION-SUBJECTIVE-COGNITION-READ-PROJECTION.md` |
| Self model | `docs/WORLD-SIMULATION-STRUCTURED-SELF-MODEL-ARCHITECTURE.md` |
| Motivation / goals | `docs/WORLD-SIMULATION-MOTIVATION-GOAL-INTEGRATION-ARCHITECTURE.md` |
| External Brain authority | `docs/external-brain-session-authority-map.md` |
| External Brain retirement | `docs/external-brain-session-retirement-and-reconciliation.md` |
| Phase / historical map | `docs/PHASE-MAP.md` 與對應 phase docs |
| 實際行為 | production code + focused tests |
| 當前開發狀態 | workstream / workspace / integration registry + Development Journal |
| 正式 remote 狀態 | authoritative remote-status tool |

如果文件與 production behavior / focused tests 明顯衝突，不要默默選一邊。先判斷哪一側才是正式 authority，修復 drift，並留下 regression evidence。

---

## 15. What Must Not Return to This File

為避免 `SKILL.md` 再次腐化，以下內容不要重新塞回來：

- 從 Phase 1 開始一路累積的完整歷史 roadmap；
- 某天的最新 commit SHA；
- 某次工具數量；
- 長篇 duplicated schema；
- 已有正式 architecture doc 的全文複製；
- 暫時性 TODO；
- 特定聊天才能理解的操作筆記；
- 已棄用工具清單；
- 假想但尚未落地的 API；
- 任何把 candidate / feedback / memory 誤寫成 Canon authority 的規則。

如果某項規則只對單一 phase 有效，放進 phase-specific architecture document 與測試；如果它跨 phase、跨 runtime 長期成立，才考慮升格到本檔。

---

## 16. Final Operating Rule

接手 Writer Workbench 時，先看**實際系統現在是什麼**，再決定下一步；不要讓舊聊天、舊 roadmap 或過時文件替代 repository truth。

開發新能力時，優先重用既有 substrate，維持 authority 邊界與 replayability；不要為了讓角色「看起來更聰明」而給模型更多不該擁有的真相或寫入權。

對 Character Runtime 而言，最重要的長期原則仍是：

> **共享的是認知機制；每個角色擁有自己的經歷、記憶、主觀世界、信念、目標與選擇。世界結果則由正式因果與 mutation authority 裁定。**
