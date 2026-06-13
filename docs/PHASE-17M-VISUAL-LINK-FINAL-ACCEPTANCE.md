# Phase 17M — Visual Link Final Acceptance Preview

目的：

- 快速完成 Visual Link workflow 的最終 read-only 驗收測試，串接 Phase 17H～17L，做 dry-run / preview，不做任何寫入。

邊界與限制：

- read-only、dry-run、final-acceptance-preview-only。
- 不寫 Approval Queue、不得建立 approval item、不得建立 canon_visual_lock。
- 不修改 `data/canon_db/active_engine.md`、`data/visual_db/visual_index.jsonl`，或任何 Canon DB 檔案。
- 不新增真正 UI route 或 server route，不新增 public MCP 工具。

Acceptance cases：

1. `character_visual: 朝日奈千夜 | file: images/chiyo.png`
2. `weapon_visual: 未竟折門 | file: images/fold-gate.png`
3. `location_visual: 白櫻市 | file: images/shirozakura.png`
4. `character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate`
5. `character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock`
6. 普通句子：`這張圖看起來像朝日奈千夜。`
7. 單獨檔案路徑：`file: images/chiyo.png`
8. duplicate case：同一 marker 出現兩次，必須 dedupe。

Final decision 規則摘要：

- `accepted_preview_chain_ready`：典型 marker（character / weapon / location / canon_link_candidate）可一路到 `ui_guard_ready`。
- `accepted_preview_chain_blocked_as_expected`：`canon_visual_lock` 必須被 guard 阻擋。
- `accepted_no_trigger_as_expected`：普通句子或單獨 file path 不應觸發任何 guard。
- 其他 `failed_*` 為不符預期情況。

CLI：

- `node scripts/visual-link-final-acceptance-preview.mjs`：執行內建 acceptance cases，輸出文字 summary。
- `node scripts/visual-link-final-acceptance-preview.mjs --json`：輸出可解析的 JSON。
- `node scripts/visual-link-final-acceptance-preview.mjs --text "..."`：針對單一輸入文字執行。

測試說明：

- 新增 `tests/engine/visual-link-final-acceptance-service.test.mjs`，驗證 config、hash 保持不變、內建 8 個 case 全部通過、duplicate dedupe、以及 CLI --json 可解析。
