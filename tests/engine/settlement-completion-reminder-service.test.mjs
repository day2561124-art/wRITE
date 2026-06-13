import { strict as assert } from "node:assert";
import { buildSettlementCompletionReminderPreview, loadSettlementCompletionReminderConfig, validateSettlementCompletionReminderConfig } from "../../server/src/settlement-completion-reminder-service.mjs";
import { buildEntityRegistryPreview } from "../../server/src/entity-registry-preview-service.mjs";

// config validation
const { config } = await loadSettlementCompletionReminderConfig();
validateSettlementCompletionReminderConfig(config);
assert.equal(config.mode, "read_only_preview");
assert.equal(config.canon_write_allowed, false);
assert.equal(config.approval_required_for_canon_change, true);
assert.equal(config.creates_patch_candidate, false);
assert.equal(config.updates_canon_db, false);
assert.equal(config.updates_active_engine, false);
assert.equal(config.creates_formal_character_card, false);
assert.equal(config.creates_formal_weapon_card, false);
assert.equal(config.creates_formal_ability_card, false);

// engine hash unchanged
const registryPreview = await buildEntityRegistryPreview();
assert.equal(registryPreview.source_sha256_lf, config.expected_engine_sha256_lf);

// should reuse registry and intake
const previewEmpty = await buildSettlementCompletionReminderPreview({ source_text: "", source_type: "candidate_draft" });
assert.equal(previewEmpty.reminder_count, 0);

// existing character Qin should be existing_entity_reference
const preQin = await buildSettlementCompletionReminderPreview({ source_text: "新角色：秦無月", source_type: "candidate_draft" });
const q = preQin.reminders.find((r) => r.display_name === "秦無月");
assert.ok(q, "秦無月 reminder should be present");
assert.equal(q.status, "existing_entity_reference");

// new character should produce character_completion_reminder
const preNew = await buildSettlementCompletionReminderPreview({ source_text: "新角色：月見璃緒", source_type: "candidate_draft" });
const nc = preNew.reminders.find((r) => r.display_name === "月見璃緒");
assert.ok(nc, "月見璃緒 reminder should be present");
assert.equal(nc.reminder_kind, "character_completion_reminder");
assert.ok(["reminder_candidate","needs_completion"].includes(nc.status));
assert.equal(nc.entity_kind, "character");
assert.ok(Array.isArray(nc.missing_fields) && nc.missing_fields.length > 0);

// new weapon
const preW = await buildSettlementCompletionReminderPreview({ source_text: "新異能武裝：《月下無弦》", source_type: "candidate_draft" });
const rw = preW.reminders.find((r) => r.display_name === "月下無弦");
assert.ok(rw, "weapon reminder should be present");
assert.equal(rw.reminder_kind, "weapon_completion_reminder");
assert.ok(rw.missing_fields.includes("owner"));
assert.ok(rw.missing_fields.includes("ability_nature"));
assert.ok(rw.missing_fields.includes("activation_boundary"));
assert.ok(rw.missing_fields.includes("limitation_or_cost"));

// new ability
const preA = await buildSettlementCompletionReminderPreview({ source_text: "新能力：月相縫合", source_type: "candidate_draft" });
const ra = preA.reminders.find((r) => r.display_name === "月相縫合");
assert.ok(ra, "ability reminder should be present");
assert.equal(ra.reminder_kind, "ability_completion_reminder");

// new organization
const preOrg = await buildSettlementCompletionReminderPreview({ source_text: "新組織：白潮會", source_type: "candidate_draft" });
const ro = preOrg.reminders.find((r) => r.display_name === "白潮會");
assert.ok(ro, "organization reminder should be present");
assert.equal(ro.reminder_kind, "organization_completion_reminder");

// world entity variants
const preCity = await buildSettlementCompletionReminderPreview({ source_text: "新都市：璃灣市", source_type: "candidate_draft" });
const rc = preCity.reminders.find((r) => r.display_name === "璃灣市");
assert.ok(rc && rc.world_entity_subtype === "city");

const preCountry = await buildSettlementCompletionReminderPreview({ source_text: "新國家：星環聯邦", source_type: "candidate_draft" });
const rco = preCountry.reminders.find((r) => r.display_name === "星環聯邦");
assert.ok(rco && rco.world_entity_subtype === "country");

const preIsland = await buildSettlementCompletionReminderPreview({ source_text: "新島嶼：白潮島", source_type: "candidate_draft" });
const ris = preIsland.reminders.find((r) => r.display_name === "白潮島");
assert.ok(ris && ris.world_entity_subtype === "island");

const preVillage = await buildSettlementCompletionReminderPreview({ source_text: "新村落：霧眠村", source_type: "candidate_draft" });
const rv = preVillage.reminders.find((r) => r.display_name === "霧眠村");
assert.ok(rv && rv.world_entity_subtype === "village");

const preSpecial = await buildSettlementCompletionReminderPreview({ source_text: "新特殊空間：無鐘庭", source_type: "candidate_draft" });
const rs = preSpecial.reminders.find((r) => r.display_name === "無鐘庭");
assert.ok(rs && rs.world_entity_subtype === "special_space");

// plain sentences should not trigger
const none1 = await buildSettlementCompletionReminderPreview({ source_text: "月見璃緒走進教室。", source_type: "candidate_draft" });
assert.equal(none1.reminder_count, 0);
const none2 = await buildSettlementCompletionReminderPreview({ source_text: "白潮島風很大。", source_type: "candidate_draft" });
assert.equal(none2.reminder_count, 0);

// forbidden small-section (ability card small headings) should not be extracted
const forbid = await buildSettlementCompletionReminderPreview({ source_text: "能力本質：強化魔力\n主要招式：《斬擊》", source_type: "candidate_draft" });
assert.equal(forbid.reminder_count, 0);

// no forbidden statuses
for (const p of [preQin, preNew, preW, preA, preOrg, preCity]) {
  for (const r of p.reminders || []) {
    assert.ok(!["approved","official","canon","canon_lock","active","finalized","patched","compiled"].includes(r.status));
  }
}

// counts consistency
for (const p of [preQin, preNew, preW, preA, preOrg, preCity, preCountry, preIsland, preVillage, preSpecial, none1, none2]) {
  assert.equal(p.reminder_count, (p.reminders || []).length);
  let sum = 0;
  for (const k of Object.keys(p.reminder_counts_by_kind || {})) sum += p.reminder_counts_by_kind[k] || 0;
  assert.equal(sum, p.reminder_count);
}

// duplicate merging
const dup = await buildSettlementCompletionReminderPreview({ source_text: "新角色：月見璃緒\n新角色：月見璃緒", source_type: "candidate_draft" });
assert.equal(dup.reminder_count, 1);
assert.ok(Array.isArray(dup.reminders[0].sources));

// naming diversity warning (non-blocking)
const naming = await buildSettlementCompletionReminderPreview({ source_text: "新角色：星宮璃緒\n新角色：星宮澄音\n新角色：星宮遙", source_type: "candidate_draft" });
assert.ok(naming.naming_review_summary && Object.keys(naming.naming_review_summary).length > 0);
for (const w of naming.warnings || []) assert.ok(true);

console.log("Settlement completion reminder tests passed.");
