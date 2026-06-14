# Phase 19G — Visual Library Controlled Import Trial

This phase runs a controlled trial that performs a real write to the formal visual library paths under a strict, confirm-and-execute guarded flow, then immediately rolls back to maintain the formal empty baseline. The trial is intended to validate the actual write/rollback mechanics and safety envelopes without permanently changing the repository.

Key guarantees:
- Requires `--execute` and four explicit confirmation texts.
- Uses existing Phase 19A confirmed import core and Phase 19B rollback core.
- Ensures `data/visual_db/visual_index.jsonl` and `data/visual_db/assets` are restored byte-for-byte to pre-trial state.
- Does not modify `data/canon_db/active_engine.md`, Canon DB, compressed rules, approval queue, or create approval items / canon_visual_lock.

See `config/visual-library-controlled-import-trial.json` and `server/src/visual-library-controlled-import-trial-service.mjs` for implementation details.
