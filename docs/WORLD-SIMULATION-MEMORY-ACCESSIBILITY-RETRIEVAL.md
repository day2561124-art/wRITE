> **Legacy Phase63B v1 design note.** This document describes the older weighted accessibility model and is retained for compatibility/history. The canonical Phase63B v2 contract is `WORLD-SIMULATION-MEMORY-ACCESSIBILITY.md`; actual retrieval-process/event ownership is defined by Phase63C.

# Phase63B — Subjective Memory Accessibility / Retrieval Strength / Interference

Phase63B adds a deterministic read-only retrieval layer between persisted subjective memory and `world_memory_retriever`.

## Research-informed model boundary

The implementation treats durable storage and current retrievability as different quantities rather than continuously rewriting a single `clarity` value. This follows the storage-strength / retrieval-strength distinction used by Bjork & Bjork, and the broader finding that memory availability depends on recency, frequency, and exposure history (Anderson & Schooler, 1991, *Psychological Science*, doi:10.1111/j.1467-9280.1991.tb00174.x).

There is deliberately no universal built-in forgetting curve. Rubin & Wenzel (1996, *Psychological Review*, doi:10.1037/0033-295X.103.4.734) found several retention functions can fit empirical data well, so time-based accessibility is used only when an explicit profile selects `none`, `hyperbolic`, `exponential`, or `power` and supplies its parameters. Context is an explicit retrieval cue rather than objective truth; this is compatible with temporal-context accounts such as Howard & Kahana (2002, *Journal of Mathematical Psychology*, doi:10.1006/jmps.2001.1388).

## Programmatic boundary

- Persisted memory records are not decayed, deleted, or rewritten merely because simulation time advances.
- `storage_strength` and current `retrieval_strength` remain separate. Missing strengths are not inferred from confidence or clarity.
- A character/world retrieval profile must explicitly enable programmatic filtering. Missing profile data preserves legacy accessibility instead of inventing a normal-human memory constant.
- Optional score components are used only when both a positive explicit component weight and the required record/config data exist: encoding retrieval strength, storage strength, age accessibility, recall recency, recall frequency, and context match.
- Context matching uses only explicit machine-readable cues such as scene, sense, observation kind, or caller-supplied cue fields. Free-text semantic similarity is not guessed in this phase.
- Interference is applied only to memories carrying explicit `interference_keys`; the simulator does not infer semantic similarity between prose memories.
- A retrieval threshold may suppress a scored memory from the current retrieval result, but does not delete or mutate that memory.
- Exact retrieval-strength scores and component diagnostics remain simulator/history data and are not forwarded into the Character Brain packet.

Phase63B reads recall history if already present but does not update it. Phase63C owns actual retrieval-process and immutable RetrievalEvent recording, but does not apply a generic recall-reinforcement rule. Retrieval-history effects require an explicit later accessibility model; source confusion/distortion, consolidation/semanticization, and conditional reconsolidation remain separately owned later phases.
