# Core Invariants (單一來源母檔範例)

此檔為建議的「核心不可變項」單一來源，用於集中保存系統的硬規則、核心裁定與單一來源判定，並供 SKILL.md 以鏈結方式引用。

範例內容：

- `formal_phase_source`: 本系統中決定正式階段 (初顯者／成形者／契合者／成熟者／超脫者) 的唯一母源文件為 `docs/core_invariants.md`。SKILL.md 中若有角色階段註記，應以本檔為最終裁定來源。
- `canon_write_lock`: 只有 explicit human confirmation（包含 confirmation file）與 CI gate 通過時，才允許覆寫 `data/canon_db/active_engine.md`。
- `trace_schema`: Trace 必須遵守 repository 中的 JSON schema，示例不能包含非 JSON 佔位符（例如 `meta: {...}`）。

使用說明：在 SKILL.md 中出現關鍵硬規則的地方，請以簡短摘要替代正文，並以連結指向本檔以取得完整裁定。
