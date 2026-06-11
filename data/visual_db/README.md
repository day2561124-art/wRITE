# Visual Reference DB

This folder stores character visual references for the local workbench.

Rules:

- Images are visual references only. They do not create canon facts, ability mechanics, relationships, ranks, or timeline events by themselves.
- Put image files under `data/visual_db/assets/`.
- Add one JSONL record per image in `data/visual_db/visual_index.jsonl`.
- The local UI can upload PNG, JPG, WEBP, or GIF files up to 8 MB and will create the asset file plus JSONL index record automatically.
- The local UI can delete a visual reference after confirmation; deletion removes the JSONL record and its image asset only.
- UI upload/delete writes are serialized and transaction-backed; failed writes roll back the affected index or asset changes.
- Use `canon_status=approved_visual` and `trust_level=T3` only after the user explicitly approves the visual as stable reference.
- Armed-form images should include `notes` that separate appearance from established ability facts.

Suggested folders:

- `assets/characters/`
- `assets/armed_forms/`
- `assets/outfits/`
- `assets/abilities/`

Example JSONL record:

```json
{"visual_id":"VIS-CHIYA-ARMED-001","created_at":"2026-06-07T00:00:00.000Z","character":"朝日奈千夜","category":"armed_form","title":"正式選拔期武裝外觀","canon_status":"reference","trust_level":"T7","source":"user_imported","path":"data/visual_db/assets/armed_forms/chiya_armed_001.png","notes":"Visual reference only; does not establish new ability mechanics.","description":"Silhouette and weapon outline reference for drafting consistency.","ability_state":"visual_only","tags":["千夜","異能武裝","正式選拔"]}
```
