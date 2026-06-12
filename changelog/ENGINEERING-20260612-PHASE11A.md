Phase 11A: Backup / Export / Restore preview (initial)

- Added backup-export-service to create immutable backup packages under `data/backups/project_backups/`.
- Backups include `files/` (actual file copies), `manifest.json`, `backup.json`, and `README.md`.
- Added verification and preview endpoints and MCP tools.
- Restore requests create approval items and do not perform direct restores.
- Export bundles (active_engine) available under `data/backups/exports/`.
- Visual assets excluded by default; include_visual_assets must be true to include `data/visual_db`.
