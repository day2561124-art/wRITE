# World Simulation Visibility / Occlusion — Phase62W

Phase62W adds a deterministic, read-only programmatic visibility query before named-character perception is sent to the neural character brain.

- Observer and target positions come from Scene State; rectangle geometry from `visibility_blockers`, `obstacles`, `structures`, and closed doors may occlude line of sight.
- Configured observer vision range is enforced. Transparent, explicitly non-blocking, inactive, or destroyed blockers do not block vision.
- Structured declared visuals bound to an occluded entity/object are filtered before the perception packet. Legacy unbound visual strings remain explicitly observer-authored inputs.
- Automatic character-facing visual descriptions require explicit perception/public visual labels. Engine entity/object IDs are never inferred into character-facing identity labels.
- The query is immutable and deterministic, emits no World State or mutation proposals, and its audit/result are recorded with the committed turn history.
- Phase62W does **not** yet model lighting thresholds, facing/FOV, stealth/camouflage, or sound propagation.

Boundary: the program decides whether a sight line is physically available; GPT may interpret visible evidence as the character, but cannot decide that a wall is transparent, reveal an occluded target, or create unseen world facts.
