# World Simulation Illumination Visibility (Phase62Y)

Phase62Y adds a deterministic read-only illumination refinement after Phase62W line-of-sight and Phase62X directional/height visibility.

- Lighting is enforced only when explicit observer lux thresholds and at least one explicit lighting input are present. The simulator does not invent dark-vision thresholds or scene brightness.
- Supported lighting inputs are `ambient_lux`, explicit per-target final illumination, and point lights with numeric reference illuminance. Point lights use inverse-square attenuation capped at their declared reference distance.
- Dedicated `light_blockers` can shadow a source-to-target path. Existing scene blockers participate only when they explicitly set `blocks_light: true`; this phase models light transport in 2D and does not yet solve vertical light rays.
- Geometrically visible targets are classified as `clear`, `dim`, `silhouette`, or `unresolved` from the observer's explicit lux thresholds. `unresolved` targets are withheld from visual perception.
- Normal identity/detail labels are used only at `clear` illumination. `dim` and `silhouette` observations require explicit low-light labels or fall back to generic non-identifying percepts.
- Target-bound declared visuals default to requiring `clear` illumination. They may explicitly opt into `dim`/`silhouette` tiers and still remain subject to Phase62X partial-visibility requirements.
- Engine entity/object IDs remain query-internal/history diagnostics and are never forwarded into character-facing visual observations.
- The query is input-immutable and deterministic, emits no World State or mutation proposals, and the character brain never decides lighting or illumination visibility.

Phase62Y still does not model stealth/camouflage, eye adaptation over time, spectral/color vision, volumetric smoke/fog, or sound propagation.
