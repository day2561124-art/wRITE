# Phase63A — Subjective Memory Formation

Phase63A connects bounded character perception to persistent subjective memory without promoting perception or memory into objective world truth.

- Only the already-filtered per-character perception packet may seed direct-perception memories. Raw World State facts, engine target IDs, exact sound-source IDs, and hidden scene data are not memory-content sources.
- Each persisted memory records direct-perception provenance (`sense`, event/turn lineage, observation hash), encoding time, and whether confidence/clarity came from the observation, an explicit character memory-encoding profile, or remained unspecified.
- Numeric confidence and clarity have no hidden human defaults. If neither the observation nor the character's explicit `memory_encoding_profile` supplies them, they stay `null`.
- Memory formation does not add entries to objective `known` / `known_facts` state. A memory remains subjective evidence that later cognition may interpret, doubt, or misremember.
- New memories are committed only after the turn passes consistency review and are written through the existing Phase62K authoritative mutation executor. They cannot retroactively affect the action decision that produced the same turn.
- The existing `world_memory_retriever` preserves the new provenance and metric-origin fields when those memories become available on later turns.
- The formation service is input-immutable and deterministic. It emits memory transitions, not a replacement World State; ChatGPT/Character Brain does not create or edit persisted memory records directly.

Phase63A does **not** yet model active clarity decay, consolidation/reconsolidation, source-confusion drift, inference-to-memory conversion, or post-outcome sensory capture. Those require later explicit phases rather than hidden cognitive defaults.
