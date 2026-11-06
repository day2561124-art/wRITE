# Pi 1.0.4 → 1.5.0（2026-11-07）

本變更僅升級隔離 Sidecar 的精確 npm 依賴並補上可重跑的相容性驗證。GPT 決策、Pi 調度、MCP 執行，以及 Workbench 的 durable execution、Journal、Checkpoint、retry、resume、reconciliation、冪等與權限邊界沿用原實作。

## 身分與發布資訊

- 基準 HEAD：570563664d351017d87dd0f13961ed5f7d34e4ab。
- 工作流：dev_workstream_20261106-172522_66d14f794366。
- 工作區：dev_workspace_aab1238d9c0a46a58fbe2fa3（接續既有、健康且鎖定的隔離 worktree）。
- 回復基準：dev_checkpoint_68de6ace89d14abebc930558987f2e76；內容 ID 474907d253da0296097cd9cf406916685e008013fa74003ffc7b81815e8fb034；健康、完整、Git HEAD 一致。
- npm 套件：@earendil-works/pi-coding-agent；目標精確版本 1.5.0；官方發布日 2026-11-02。
- Node 要求：>=22.19.0；實測 Node 24.18.0、npm 11.16.0。
- npm 1.5.0 integrity：sha512-xNDZ5kqowO6Z03FS2gwAkPEGk1ssxVcYKQ6qZId84mFEvwACvvyc2l0vAMOS+c5zvxLRMLBE9r4y44IGYkMJaQ==。
- 既有 main 含其他未提交工作；不納入本次 commit，也不清理任何其他工作區。

## 上游差異與處理

| 版本 | 相關變化 | 本專案處理 |
| --- | --- | --- |
| 1.1 | agent_settled 增加 aborted；工具輸出與 Codemode async 描述修正 | 保留自有生命週期與取消狀態；以現有 durable 測試驗證 |
| 1.2 | before_agent_start 以 messageType 區分 user/custom；啟動期間視為 busy；MCP reachesTools/readiness 與 resources 行為調整；移除未發布的 client/plugin 匯出 | 掃描確認正式碼未使用被移除匯出或舊事件假設；SDK proof 驗證 user 事件、MCP readiness 與巢狀工具事件 |
| 1.3 | 內部 Pi 套件改精確版；恢復 active tools；Codemode 取消與 worker 存活限制修正 | 使用 npm 產生鎖檔；實際重開 Session 驗證工具集合和 Codemode store |
| 1.4 | Codemode worker 改為排隊等候；summary 與供應商預設調整 | 保留主機端並行、deadline、輸出與記憶體上限；不採用新內建機制取代 Workbench 保護 |
| 1.5 | pi-schema 驗證與 MCP JSON Schema coercion；TypeBox 特有驗證不再適用；Session 寫入失敗修正；Tool Search 中文與排序修正 | 真實 MCP 測試驗證字串數字轉換、非法值拒絕、權限拒絕及錯誤；Workbench 橋接仍由主機嚴格驗證；補中文搜尋、Session 磁碟恢復測試 |

1.5.0 亦更動上游模型目錄與部分供應商預設。本次未修改模型、供應商、MCP 設定或 production route。正式 Workbench 調度路徑未建立依賴上游預設模型的 AgentSession；新增測試明確選取暫存 fixture 模型，替換測試串流，禁止外部模型請求。

已掃描 server、scripts、tests 的套件、SDK、Session、Codemode 與 MCP 引用，並審閱 runner.mjs、codemode-loader.mjs、codemode-worker.mjs、codemode-proof.mjs、pi-agent-execution-service.mjs 及相關調度與持久化層。相容的正式 runtime 檔案不為升級而重構。

## 安裝與可重跑驗證

鎖檔由正常 npm 程序產生，未手工編輯、未變更全域 npm：

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd ci --prefix scripts/pi-runtime --no-audit --no-fund
# 完成 1.0.4 基準測試後，僅在隔離工作區執行：
npm.cmd install --prefix scripts/pi-runtime --save-exact '@earendil-works/pi-coding-agent@1.5.0' --no-audit --no-fund
node scripts/pi-runtime/runner.mjs status
node scripts/pi-runtime/codemode-proof.mjs
node scripts/pi-runtime/sdk-proof.mjs
node --test --test-concurrency=1 --test-reporter=spec tests/mcp/mcp-pi-agent-execution.test.mjs tests/mcp/mcp-pi-codemode-bridge.test.mjs tests/mcp/pi-execution-contract.test.mjs tests/mcp/pi-execution-orchestrator.test.mjs tests/mcp/pi-execution-state-store.test.mjs tests/mcp/pi-reliable-execution.test.mjs tests/mcp/pi-production-execution.test.mjs
node tests/tools/mcp-contract.test.mjs
git diff --check
```

正式工程操作使用 dev_pi_execute_intent 與服務既有的 Workspace / Journal / Checkpoint / integration candidate 流程。上述 shell 命令列為重現命令，不取代授權與整合閘道。

SDK proof 透過實際 Pi AgentSession、Tool Search、Codemode 與本機 stdio MCP peer 執行工具，檢查實際結果、非法/hidden/禁止工具不送出、MCP 錯誤、逾時後恢復、巢狀生命週期、Session JSONL 重開、工具集合及 Codemode store。測試資料與設定只在自建暫存目錄，會依 SDK 生命週期關閉 MCP 後清理。外部模型請求數為 0。

Workbench 橋接回歸另外驗證秘密檔、路徑穿越、其他 workspace、額外參數、數字字串、未知工具、環境能力、輸出/呼叫上限、並行、記憶體耗盡、deadline 與恢復。原 durable 測試涵蓋程序退出、失回應、重試、receipt reconciliation、取消、CAS 與單一實際副作用。

## 基準與查核證據

- 接手稽核：pi_operation_7f99de06c5184d08a866df03be58295c。
- 原鎖檔安裝與 npm metadata：pi_operation_bd27a6c00671408f84f67cccbe98ac18。
- 基準測試及 npm 升級：pi_operation_7d145d0f40024d1180558ed425ce939e。
- 1.0.4 基準：188 項通過、0 失敗、0 跳過；Codemode Sandbox proof 通過。
- npm 升級內層 operation：dev_operation_c9cea61e480c4eb69878180702539ee2。
- 過程中的失敗 receipt 均保留。曾確認 PowerShell 5.1 預設 ASCII 管線破壞測試中文字串；後續以 ASCII 跳脫的 JavaScript 字串精確寫入 UTF-8，沒有修改全域編碼設定或降低驗收條件。
- 升級後結果、commit、integration candidate、切換後版本與 Journal 健康，以最終交付訊息及原生 immutable operation receipts 為準；此文件不以計畫冒充已部署。

## 安全切換與回退

全部必要工程測試通過後，透過既有受控整合流程將精確候選 commit 推進 main，保留 main 其他 dirty 工作；正式側僅依已驗證的精確鎖檔執行 npm ci --prefix scripts/pi-runtime，並從新程序驗證 Sidecar 與實際讀取鏈。production route 應維持 revision 1、pi_default；不為套件升級切換模型或路由。

若隔離候選驗證失敗，保留失敗證據與候選工作，正式環境不切換。需要重建基準時，可從上述 checkpoint 建立新的受控 recovery workspace，原工作區不覆寫。

若正式套件安裝或啟動驗證失敗，先停止繼續切換，保留當前 receipt 與 dirty-state 證據。在受控隔離工作區對升級 commit 建立正常 revert（保留歷史），或從基準 HEAD 取出原始兩個套件 manifest/lockfile，經既有審核與整合閘道套用；再以原始鎖檔執行 npm ci --prefix scripts/pi-runtime。必須驗證 Pi 1.0.4、SDK 探針、實際 Pi 讀取、production route 與 Journal 健康後才宣告恢復。不使用 reset --hard、clean、force push 或清理其他工作區。

## 來源

- [Pi 1.1.0](https://pi.dev/changelog/releases/1.1.0)
- [Pi 1.2.0](https://pi.dev/changelog/releases/1.2.0)
- [Pi 1.3.0](https://pi.dev/changelog/releases/1.3.0)
- [Pi 1.4.0](https://pi.dev/changelog/releases/1.4.0)
- [Pi 1.5.0](https://pi.dev/changelog/releases/1.5.0)
- [npm 套件](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
- 隔離安裝內的 CHANGELOG.md、package.json、SDK 型別宣告與實作，以及本次 npm view 與 npm install receipt。
