# Phase 17D: Canon Zones Preview

Phase 17D is a read-only planning and roundtrip-validation phase. It does not
split `data/canon_db/active_engine.md`, create a replacement Canon database, or
change the active engine.

## Scope

- `config/canon-zones.json` defines candidate zones with exact heading anchors.
- Canon Zones are preview candidates, not a formal Canon DB structure.
- The preview service reads the active engine, normalizes line endings to LF,
  validates the expected SHA-256, and slices continuous non-overlapping zones.
- The roundtrip compiler preview rejoins those in-memory slices and verifies
  byte-for-byte equality after LF normalization.
- No preview command writes output files or modifies Canon data.

## Safety Boundaries

- `active_engine.md` remains the sole active Canon source.
- No public or private MCP tool is added.
- No activation, approval bypass, Canon update, backup, or output artifact is
  created.
- Zone `update_policy` is `preview_only`.

Phase 17E may use these candidates as input to Entity Registry ID planning. It
must not treat the Phase 17D configuration as an already-migrated Canon DB.

## Acceptance

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\show-active-engine-hash.ps1
node .\scripts\canon-zone-roundtrip-preview.mjs
node .\scripts\canon-zone-roundtrip-preview.mjs --json
npm test
npm run test:mcp
npm run bridge:dry-run
npm run test:bridge:e2e
```

Acceptance requires the source and roundtrip LF SHA-256 values to equal
`D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB`,
with no blocking warnings and no diff for `active_engine.md`.
