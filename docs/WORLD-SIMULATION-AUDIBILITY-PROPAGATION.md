# World Simulation Audibility / Sound Propagation (Phase62Z)

Phase62Z adds a deterministic read-only audibility query before named-character perception. It models same-scene direct-path sound attenuation without changing causal outcome authority.

- Audibility enforcement requires an explicit observer hearing threshold in dB plus structured sound sources with explicit source level and position. No generic "human hearing" threshold is inferred.
- Direct-path free-field attenuation uses `20*log10(distance/reference_distance)` and is capped at the source reference distance so the query never invents near-field gain.
- `sound_blockers` and existing scene geometry can attenuate or fully block sound only when acoustic fields are explicit. Closed doors may attenuate sound; open doors do not retain closed-door attenuation.
- Character-facing auditory observations never include engine sound/entity/object IDs, exact source coordinates, or exact received dB. Coarse relative direction is emitted only when localization margin/sectors and observer facing are explicitly configured.
- Raw `scene.public_audio` and observer-scoped scene audio are bypassed while programmatic audibility is enforced; explicit caller-provided observer observations/sensory inputs remain compatible.
- The query is immutable and deterministic, returns no World State or mutation proposals, and its result/audit are persisted with committed turn history.

Phase62Z does not yet model cross-room graph propagation, reflections, diffraction, reverberation, propagation delay, vertical acoustics, or speech-content intelligibility. Hearing a sound never implies knowing who produced it.
