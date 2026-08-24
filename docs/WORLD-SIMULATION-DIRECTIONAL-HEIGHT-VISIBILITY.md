# World Simulation Directional + Height Visibility (Phase62X)

Phase62X extends the Phase62W line-of-sight query without changing its legacy contract. The simulation loop still records the Phase62W LOS query, then applies a second immutable directional/height refinement before visual observations reach the character brain.

- Horizontal FOV is enforced only when both observer facing and a numeric horizontal FOV are explicitly present. `0°` faces `+x`; no facing/FOV is inferred from prose, action names, or target positions.
- Vertical refinement is enabled only when observer eye height and target numeric height are explicit. Posture labels such as `standing`, `crouching`, or `prone` never imply hidden height constants.
- Rectangular blockers may add bounded vertical geometry with `base_z_m` plus `top_z_m` / `occlusion_height_m` / `vertical_height_m`. A legacy blocker with no vertical geometry keeps Phase62W full-height occlusion semantics.
- Bounded cover can produce `full`, `partial`, or `none` target visibility. Partial visibility is computed from the target vertical interval and the sight ray through blocker prisms.
- Target-bound declared visual text is withheld on partial visibility unless it explicitly allows partial visibility or declares a satisfied `required_visible_fraction`. Unbound observer-authored visual strings remain legacy-compatible.
- Engine entity/object IDs remain query-internal/history diagnostics and are not forwarded into character-facing perception observations.
- The query is read-only, input-immutable, and deterministic. It returns no world state and no mutation proposals; the character brain never decides FOV or height-occlusion results.

Phase62X still does not model lighting thresholds, stealth/camouflage, or sound propagation.
