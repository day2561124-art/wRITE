import { strict as assert } from "node:assert";
import { buildEntityIntakePreview, loadEntityIntakeConfig, validateEntityIntakeConfig } from "../../server/src/entity-intake-service.mjs";
import { buildEntityRegistryPreview } from "../../server/src/entity-registry-preview-service.mjs";

// Basic config validation
const { config } = await loadEntityIntakeConfig();
validateEntityIntakeConfig(config);
assert.equal(config.mode, "read_only_preview");
assert.equal(config.canon_write_allowed, false);
assert.equal(config.approval_required_for_canon_change, true);
assert.equal(config.creates_formal_character_card, false);
assert.equal(config.creates_formal_weapon_card, false);
assert.equal(config.creates_formal_ability_card, false);

// engine hash unchanged
const registryPreview = await buildEntityRegistryPreview();
assert.equal(registryPreview.source_sha256_lf, config.expected_engine_sha256_lf);

// reuse registry: existing character should not create a new intake candidate
const previewFromEngine = await buildEntityIntakePreview({ source_text: "新角色：朝日奈千夜", source_type: "candidate_draft" });
// find existing reference (may be placed in intakes[] with status existing_entity_reference)
const existing = previewFromEngine.intakes.find((i) => i.display_name === "朝日奈千夜");
assert.ok(existing, "existing reference should be present");
assert.equal(existing.status, "existing_entity_reference");
assert.ok(existing.matched_existing_entity_id, "existing reference must include matched_existing_entity_id");

// existing-known character (秦無月) should be treated as existing_entity_reference, not a new intake
const previewQin = await buildEntityIntakePreview({ source_text: "新角色：秦無月", source_type: "candidate_draft" });
const qin = previewQin.intakes.find((i) => i.display_name === "秦無月");
assert.ok(qin, "秦無月 reference should be present");
assert.equal(qin.status, "existing_entity_reference");
assert.ok(qin.matched_existing_entity_id, "秦無月 should have matched_existing_entity_id");

// new character name that does not exist should produce a character_intake
const previewNewChar = await buildEntityIntakePreview({ source_text: "新角色：月見璃緒", source_type: "candidate_draft" });
const newChar = previewNewChar.intakes.find((i) => i.display_name === "月見璃緒");
assert.ok(newChar, "月見璃緒 intake should be present");
assert.equal(newChar.intake_kind, "character_intake");
assert.ok(["intake_candidate", "needs_completion"].includes(newChar.status), "status should be intake_candidate or needs_completion");
assert.equal(newChar.entity_kind, "character");
assert.ok(Array.isArray(newChar.missing_fields) && newChar.missing_fields.length > 0, "missing_fields must be non-empty");
assert.equal(newChar.canon_write_allowed, false);
assert.equal(newChar.approval_required_for_canon_change, true);
assert.equal(newChar.creates_formal_card, false);
assert.ok(!["approved","official","canon","canon_lock","active","finalized"].includes(newChar.status));

// plain sentence should not produce intake
const previewPlain = await buildEntityIntakePreview({ source_text: "秦無月走進教室。", source_type: "candidate_draft" });
assert.equal(previewPlain.intake_count, 0);

// new weapon intake marker
const previewWeapon = await buildEntityIntakePreview({ source_text: "新異能武裝：《月下無弦》", source_type: "candidate_draft" });
const w = previewWeapon.intakes.find((i) => i.display_name === "月下無弦");
assert.ok(w, "weapon intake should be present");
assert.equal(w.intake_kind, "weapon_intake");
assert.ok(w.missing_fields.includes("owner"));
assert.ok(w.missing_fields.includes("ability_nature"));
assert.ok(w.missing_fields.includes("activation_boundary"));
assert.ok(w.missing_fields.includes("limitation_or_cost"));

// owner link
const previewLink = await buildEntityIntakePreview({ source_text: "秦無月｜異能武裝：《月下無弦》", source_type: "candidate_draft" });
const link = previewLink.intakes.find((i) => i.intake_kind === "character_weapon_link_intake");
assert.ok(link, "link intake should be present");

// duplicate merging
const dupPreview = await buildEntityIntakePreview({ source_text: "新異能武裝：《月下無弦》\n新異能武裝：《月下無弦》", source_type: "candidate_draft" });
assert.equal(dupPreview.intake_count, 1);
const dup = dupPreview.intakes[0];
assert.ok(Array.isArray(dup.sources) && dup.sources.length === 1 || dup.sources.length === 2);

// forbidden small-section should not be extracted
const previewForbid = await buildEntityIntakePreview({ source_text: "能力本質：強化魔力\n主要招式：《斬擊》", source_type: "candidate_draft" });
assert.equal(previewForbid.intake_count, 0);

// preview counts consistent
for (const p of [previewFromEngine, previewNewChar, previewPlain, previewWeapon, previewLink, dupPreview, previewForbid]) {
  assert.equal(p.intake_count, (p.intakes || []).length);
  let sum = 0;
  for (const k of Object.keys(p.intake_counts_by_kind || {})) sum += p.intake_counts_by_kind[k] || 0;
  assert.equal(sum, p.intake_count);
}

console.log("Entity intake service tests passed.");
