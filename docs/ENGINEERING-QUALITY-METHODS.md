# Engineering quality methods v1

本指引只補強 GPT 主導工程的三項方法：TDD、系統化除錯、獨立審核。
適用於本倉工程與經各專案明確採用的通用工作流程，不是新的 runtime gate。
依任務風險選用，不增加額外模型、套件、服務、資料庫或使用者確認步驟。
既有 ExecutionIntent、授權、Workspace、Journal、Checkpoint、CI、整合與部署規範具有優先權。

## 1. TDD：RED → GREEN → REFACTOR

對可測量的行為變更、缺陷修正及回歸，優先執行：
- 找到最小真實行為案例；先加入或使用能重現目標問題的測試。
- RED：在修正前執行，確認失敗來自目標行為，而非語法、依賴、fixture、環境、權限或逾時。保留原始結果及基準版本。若測試原本就通過，重新檢查案例，不冒稱 RED。
- GREEN：實作最小正確修正，以相同案例確認通過。不得藉由刪除斷言、降低預期或無根據地更改 mock 取得通過。
- REFACTOR：僅在有必要時整理，保持既有行為，再執行相關回歸與原有必要驗收。不可把 focused PASS 當作整合 PASS。

在 Nexa/Pi 上，預期失敗的 RED 與後續 GREEN 使用分開的可追蹤操作；正式測試仍如實回傳失敗，不修改可靠執行狀態、不偽造成功退出、不重送已知終止或 UNKNOWN mutation。先核對操作結果及既有 recovery/decision boundary，再建立新的授權操作。使用同一已註冊隔離工作區及同一案例，記錄基準/候選、命令或 suite、operation/receipt ID、實際失敗原因及結果。

在 GitHub-only 模式，若 CI 無法執行 RED，保留案例及待驗證狀態；可用已確認的既有失敗證據，但不得假稱新測試已執行。文件、純格式、探索性研究或無可行自動測試的工作可採合理替代驗證，簡述原因；不得跳過原本必需的安全/驗收條件。

## 2. 系統化除錯

對未知根因、跨模組或重複發生的錯誤：
1. 重現並收集第一手證據：預期/實際結果、版本、環境、最小輸入、錯誤與 Trace/Journal。
2. 對照正常路徑，沿資料與因果流檢查各責任邊界，定位首次可觀察的偏差；區分根因、症狀、外部環境與預期行為。
3. 提出可否證假設與最小驗證。一次改變一個相關因素，記錄結果；假設未成立就重新調查，不疊加猜測性修補。
4. 根因有證據後才修正；使用 TDD 或適合該問題的回歸案例，確認沒有破壞相關模組與責任邊界。

同一問題若連續三次有根據的修正仍失敗，重新檢視架構、資料所有權、測試假設與既有設計；不要以三次為強制等待門檻，較早發現架構矛盾就立即評估。一般工程決策由 GPT 自主完成，既有安全/授權邊界不變。未知副作用、遺失回應及未解決的 durable owner 依原有 reconciliation 流程處理，不以除錯名義重播、繞過或清除正式狀態。

角色腦/世界模擬的審查須區分設計允許的人類式判斷錯誤與系統缺陷，不為讓角色永遠正確而改變角色行為。以該作品的權威設定與行為契約判定。

## 3. 獨立程式碼審核

對重要行為改動、跨模組、架構、持久化、並行、權限或高風險修正，優先安排與實作分離的審核。簡單低風險改動可採較短的差異審查。
- 審核輸入：使用者需求/已核准設計、範圍與禁止事項、精確 base/head SHA、差異、相關上下游契約及測試證據。不要求審核者接受實作者的結論。
- 優先使用實際可用的獨立審核代理或其他審核者；僅授予所需讀取能力。不得假設 Pi、CI、Copilot 或另一模型已執行審核。
- 查核需求正確性、權威邊界、安全、失敗/恢復、相容性、測試是否能偵測缺陷及不必要的複雜度；按風險列出可重現的發現、檔案/行號、證據與建議，避免形式化挑錯。
- GPT 核實每項發現，修正成立問題或記錄不採納的技術理由；有影響的修正之後重新驗證並審查新 head。
- 若沒有可用的獨立審核者，明確標記 self-review / independent review unavailable，分離自我審查並保留限制；不得將其稱為獨立審核。原本要求獨立審核的安全閘道仍不可略過。

## 接入既有工程

- GPT 在工程決策時選擇必要方法，使用現有 goal、constraints、completion_conditions 及精確 actions 傳達工作；不增加契約欄位，不改寫授權規則。
- Pi 負責既有執行；Nexa/Journal 提供可用的操作證據，PR/CI 提供 GitHub 上的候選差異及執行證據。GitHub-only 工作不得冒稱已寫入本機 Journal。
- 在現有工程回報或 PR 中記錄：適用方法、基準/候選、RED/GREEN 或替代驗證、根因證據（如適用）、審核類型與未處理問題、既有驗收結果、剩餘事項及接續點。不建立另一套強制表單。
- 任何方法均不能替代原本的整合、權限、測試、回退或正式部署閘道。以真實結果區分 PASS、FAIL、SKIPPED、NOT RUN、BLOCKED 及 UNKNOWN。
- 只在必要時增加步驟；不為遵循指引而擴大原本工程範圍。

## 採用與驗證狀態

本版是工程方法文件，不宣稱自動注入 ChatGPT 或 Nexa 的模型上下文，也不宣稱 runtime 強制執行。
支援 AGENTS.md 的代理可由根目錄入口載入；其他 GPT 工程會話應主動讀取本文件。
第一個適用的實際工程案例應驗證：RED/GREEN 的真實證據、除錯假設的因果鏈、精確版本審核與誠實審核身分。
本機 Nexa 恢復後，依既有工作區、Journal 和測試流程驗證實際接續；無須安裝 Superpowers。

參考：Superpowers 原始技能（選擇性借鑑，並非完整採用）
- https://github.com/obra/superpowers/tree/main/skills/test-driven-development
- https://github.com/obra/superpowers/tree/main/skills/systematic-debugging
- https://github.com/obra/superpowers/tree/main/skills/requesting-code-review
- https://github.com/obra/superpowers/tree/main/skills/receiving-code-review

既有規範：[PI-AUTONOMOUS-ENGINEERING.md](PI-AUTONOMOUS-ENGINEERING.md)、[PI-EXECUTION-POLICY-SIMPLIFICATION-V1.md](PI-EXECUTION-POLICY-SIMPLIFICATION-V1.md)、[PI-UPGRADE-20261107.md](PI-UPGRADE-20261107.md)。
