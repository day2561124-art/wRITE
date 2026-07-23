import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  detectDeclaredSceneLocation,
  evaluateSceneCompatibility,
} from "./canon-logic-compatibility-service.mjs";
import {
  flattenPlannedEntityManifest,
  hydratePlannedEntityManifest,
  normalizePlannedEntityManifest,
  plannedEntityManifestCategories,
} from "./canon-entity-hydration-service.mjs";
import { projectPaths } from "./project-paths.mjs";
import {
  getStructuredEntityRegistry,
} from "./structured-canon-entity-registry-service.mjs";
import {
  originalCandidateStatus,
} from "./formal-writing-contracts.mjs";

const registryCategoryMap = Object.freeze({
  characters: "characters",
  organizations: "organizations",
  locations: "locations",
  abilities: "abilities",
  weapons: "weapons",
  status_effects: "status_effects",
  timeline_events: "timeline_events",
  chapter_events: "chapter_events",
});

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function uniqueBy(values, keyFor) {
  const output = [];
  const seen = new Set();
  for (const value of values) {
    const key = keyFor(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function lineEvidence(draftText, mention) {
  const lines = String(draftText ?? "").replace(/\r\n?/gu, "\n").split("\n");
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const column = lines[index].indexOf(mention);
    if (column < 0) continue;
    output.push({
      line_reference: `L${index + 1}`,
      line_start: index + 1,
      line_end: index + 1,
      column_start: column + 1,
      column_end: column + mention.length,
      quote: lines[index].trim().slice(0, 180),
    });
  }
  return output.slice(0, 4);
}

function originalCandidateEntry({
  name,
  category,
  draftText,
  validationScope = [
    "general_world_rules",
    "existing_canon_contact_points",
  ],
  extra = {},
}) {
  return {
    name,
    category,
    ...originalCandidateStatus(),
    canon_missing: false,
    validation_scope: validationScope,
    exact_line_evidence: lineEvidence(draftText, name),
    ...extra,
  };
}

function occurrenceInsideOriginalName(
  text,
  occurrenceIndex,
  matchedName,
  originalCharacterNames,
) {
  for (const originalName of originalCharacterNames) {
    if (originalName === matchedName || !originalName.includes(matchedName)) {
      continue;
    }
    let originalIndex = text.indexOf(originalName);
    while (originalIndex >= 0) {
      if (
        occurrenceIndex >= originalIndex
        && occurrenceIndex + matchedName.length
          <= originalIndex + originalName.length
      ) {
        return true;
      }
      originalIndex = text.indexOf(originalName, originalIndex + 1);
    }
  }
  return false;
}

function exactCharacterNameOccurrence(text, index, name) {
  const before = index > 0 ? text[index - 1] : "";
  const after = text[index + name.length] ?? "";
  const isHan = (value) => /\p{Script=Han}/u.test(value);
  if (isHan(before)) {
    const prefix = text.slice(Math.max(0, index - 3), index);
    if (!/(?:與|和|由|讓|對|向|替|給|叫|是|找|問|看見)$/u.test(prefix)) {
      return false;
    }
  }
  if (isHan(after)) {
    const suffix = text.slice(index + name.length, index + name.length + 4);
    if (
      !/^(?:的|是|在|從|向|對|與|和|被|為|來|去|走|站|坐|說|問|答|看|等|持|按|把|將|仍|也|卻|便|就|只|又|已|正|沒|不|能|會|踏|進|離|召|展|握|抬|轉|點|同學|老師)/u
        .test(suffix)
    ) {
      return false;
    }
  }
  return true;
}

function registryMentions(
  draftText,
  registry,
  originalCharacterNames = [],
) {
  const detections = [];
  for (const category of plannedEntityManifestCategories) {
    const records = registry?.[registryCategoryMap[category]] ?? [];
    for (const entity of records) {
      const names = [
        entity.entity_id,
        entity.canonical_name,
        ...(Array.isArray(entity.aliases) ? entity.aliases : []),
      ].map((value) => String(value ?? "").trim())
        .filter((value) => value.length >= 2)
        .sort((left, right) => right.length - left.length);
      const mention = names.find((name) => {
        const text = String(draftText);
        let index = text.indexOf(name);
        while (index >= 0) {
          const suffix = text.slice(index + name.length);
          const embeddedOrganizationName = category === "characters"
            && /^(?:武裝)?學院|^軌道實習校|^學生/u.test(suffix);
          const embeddedOriginalFullName = category === "characters"
            && occurrenceInsideOriginalName(
              text,
              index,
              name,
              originalCharacterNames,
            );
          const nonExactCharacterName = category === "characters"
            && name !== entity.entity_id
            && !exactCharacterNameOccurrence(text, index, name);
          if (
            !embeddedOrganizationName
            && !embeddedOriginalFullName
            && !nonExactCharacterName
          ) {
            return true;
          }
          index = text.indexOf(name, index + name.length);
        }
        return false;
      });
      if (!mention) continue;
      detections.push({
        category,
        entity_type: entity.entity_type
          ?? category.replace(/s$/u, ""),
        entity_id: entity.entity_id,
        canonical_name: entity.canonical_name,
        matched_text: mention,
        match_type: mention === entity.entity_id
          ? "entity_id"
          : mention === entity.canonical_name
            ? "exact"
            : "alias",
        exact_line_evidence: lineEvidence(draftText, mention),
      });
    }
  }
  return uniqueBy(
    detections.sort((left, right) => (
      right.matched_text.length - left.matched_text.length
    )),
    (entry) => `${entry.category}\u0000${entry.entity_id}`,
  );
}

function plannedKeys(manifest, registry) {
  const keys = new Set();
  for (const item of flattenPlannedEntityManifest(manifest)) {
    keys.add(`${item.category}\u0000${item.requested_name}`);
    const records = registry?.[registryCategoryMap[item.category]] ?? [];
    const exact = records.find((record) => (
      record.canonical_name === item.requested_name
      || (record.aliases ?? []).includes(item.requested_name)
      || record.entity_id === item.entity_id
    ));
    if (exact) {
      keys.add(`${item.category}\u0000${exact.canonical_name}`);
      keys.add(`${item.category}\u0000${exact.entity_id}`);
    }
  }
  return keys;
}

function lateAddedDetections(detections, planned) {
  return detections.filter((detection) => (
    !planned.has(`${detection.category}\u0000${detection.canonical_name}`)
    && !planned.has(`${detection.category}\u0000${detection.entity_id}`)
  ));
}

function manifestFromDetections(detections) {
  const manifest = Object.fromEntries(
    plannedEntityManifestCategories.map((category) => [category, []]),
  );
  for (const detection of detections) {
    manifest[detection.category].push({
      name: detection.canonical_name,
      entity_id: detection.entity_id,
      canon_expected: true,
    });
  }
  return manifest;
}

function possibleOriginalCharacterNames(draftText, knownNames) {
  const values = [];
  const text = String(draftText ?? "");
  for (const match of text.matchAll(
    /(?:^|\n)\s*([\p{Script=Han}A-Za-z・]{2,12})\s*[：:]\s*[「『“"]/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:名叫|自稱|路人|新生|訪客)\s*[「『“"]?([\p{Script=Han}A-Za-z・]{2,12})[」』”"]?/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:^|[，。！？!?\n])\s*([\p{Script=Han}A-Za-z・]{2,12})(?=\s*(?:展開|召喚|使用|揮動|握住|啟動|驅動)《)/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:^|[，。！？!?\n])\s*([\p{Script=Han}A-Za-z・]{2,12})(?=\s*(?:是|身為|擔任)[^，。！？!?\n]{0,20}(?:院長|局長|校長))/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:^|[，。！？!?\n])\s*([\p{Script=Han}A-Za-z・]{2,12})(?=\s*(?:是|成為|作為|身為)[^，。！？!?\n]{0,24}(?:新生|學生))/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:反派|幕後者|校內敵對人物|家族利益人物|犯罪者|灰色合作者)\s*[「『“"]?([\p{Script=Han}A-Za-z・]{2,12})[」』”"]?/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:^|[，。！？!?\n])\s*([\p{Script=Han}A-Za-z・]{2,12})(?=\s*(?:是|成為|作為|身為)[^，。！？!?\n]{0,20}(?:新反派|反派|幕後者|敵對人物|犯罪者|灰色合作者))/gu,
  )) {
    values.push(match[1].trim());
  }
  for (const match of text.matchAll(
    /(?:^|[，。！？!?\n])\s*([\p{Script=Han}A-Za-z・]{2,12})(?=\s*(?:自稱|聲稱|表示自己|第一次(?:遇見|見到)|初次(?:遇見|見到)))/gu,
  )) {
    values.push(match[1].trim());
  }
  return [...new Set(values)].filter((name) => (
    !knownNames.has(name)
    && !/^(?:老師|學生|少女|少年|訪客|路人)$/u.test(name)
  )).map((name) => {
    const evidenceText = lineEvidence(text, name)
      .map((entry) => entry.quote)
      .join("\n");
    const antagonist = /反派|幕後者|敵對人物|犯罪者|灰色合作者/u
      .test(evidenceText);
    return originalCandidateEntry({
      name,
      category: "characters",
      draftText: text,
      extra: {
        original_entity_type: antagonist
          ? "antagonist"
          : "named_character",
        ...(antagonist ? { story_role: "antagonist" } : {}),
      },
    });
  });
}

function originalWeaponCandidates(draftText, registry) {
  const registeredNames = new Set(
    (registry?.weapons ?? []).flatMap((entity) => [
      String(entity.canonical_name ?? "").trim(),
      ...(Array.isArray(entity.aliases)
        ? entity.aliases.map((alias) => (
          String(alias).replace(/[《》]/gu, "").trim()
        ))
        : []),
    ]).filter(Boolean),
  );
  return uniqueBy(
    [...String(draftText ?? "").matchAll(/《([^》]{2,40})》/gu)]
      .map((match) => match[1].trim())
      .filter((name) => !registeredNames.has(name))
      .map((name) => originalCandidateEntry({
        name,
        category: "weapons",
        draftText,
        validationScope: ["general_world_rules"],
        extra: {
          original_entity_type: "soul_weapon",
        },
      })),
    (entry) => entry.name,
  );
}

function originalOrganizationCandidates(draftText, registry) {
  const text = String(draftText ?? "");
  const registeredNames = new Set(
    (registry?.organizations ?? []).flatMap((entity) => [
      entity.canonical_name,
      ...(Array.isArray(entity.aliases) ? entity.aliases : []),
    ]).map((name) => String(name ?? "").trim()).filter(Boolean),
  );
  const candidates = [];
  const patterns = [
    /(?:敵對組織|恐怖組織|犯罪集團|非法研究勢力|官方派系|家族派閥|城市地下組織|地下組織|新組織|組織|勢力)\s*[「『“"]([^」』”"\n]{2,30})[」』”"]/gu,
    /[「『“"]([^」』”"\n]{2,30})[」』”"]\s*(?:是|為|成為)?\s*(?:新成立的)?(?:敵對組織|恐怖組織|犯罪集團|非法研究勢力|官方派系|家族派閥|城市地下組織|地下組織|新組織)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1].trim();
      if (!name || registeredNames.has(name)) continue;
      const hostile = /敵對|恐怖|犯罪|非法|地下/u.test(match[0]);
      candidates.push(originalCandidateEntry({
        name,
        category: "organizations",
        draftText: text,
        extra: {
          original_entity_type: hostile
            ? "hostile_faction"
            : "organization",
        },
      }));
    }
  }
  return uniqueBy(candidates, (entry) => entry.name);
}

function originalAbilityCandidates(draftText, registry) {
  const text = String(draftText ?? "");
  const registeredNames = new Set(
    (registry?.abilities ?? []).flatMap((entity) => [
      entity.canonical_name,
      ...(Array.isArray(entity.aliases) ? entity.aliases : []),
    ]).map((name) => String(name ?? "").trim()).filter(Boolean),
  );
  const candidates = [];
  for (const match of text.matchAll(
    /(?:新能力|能力|異能|術式)\s*[「『“"]([^」』”"\n]{2,40})[」』”"]/gu,
  )) {
    const name = match[1].trim();
    if (!name || registeredNames.has(name)) continue;
    candidates.push(originalCandidateEntry({
      name,
      category: "abilities",
      draftText: text,
      validationScope: ["general_world_rules"],
      extra: {
        original_entity_type: "ability",
      },
    }));
  }
  return uniqueBy(candidates, (entry) => entry.name);
}

function hydratedCharacterEntries(...hydrations) {
  return uniqueBy(
    hydrations.flatMap((hydration) => (
      hydration?.resolved_entities ?? []
    )).filter((entry) => entry.category === "characters"),
    (entry) => entry.entity_id,
  );
}

function weaponOwner(entity) {
  const cells = String(entity?.source_excerpt ?? "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  return cells[0] && cells[0] !== entity?.canonical_name
    ? cells[0]
    : null;
}

function ownershipCompatibilityFindings({
  draftText,
  detectedEntities,
  originalCandidates,
  registry,
  scene,
}) {
  const output = [];
  const characters = [
    ...detectedEntities
      .filter((entry) => entry.category === "characters")
      .map((entry) => ({
        name: entry.canonical_name,
        entity_id: entry.entity_id,
        evidence: entry.exact_line_evidence,
      })),
    ...originalCandidates
      .filter((entry) => entry.category === "characters")
      .map((entry) => ({
      name: entry.name,
      entity_id: null,
      evidence: entry.exact_line_evidence,
      })),
  ];
  const weapons = detectedEntities.filter(
    (entry) => entry.category === "weapons",
  );
  for (const weapon of weapons) {
    const registryWeapon = (registry?.weapons ?? []).find(
      (entry) => entry.entity_id === weapon.entity_id,
    );
    const owner = weaponOwner(registryWeapon);
    if (!owner) continue;
    for (const character of characters) {
      if (character.name === owner) continue;
      const evidence = (weapon.exact_line_evidence ?? []).find(
        (item) => String(item.quote ?? "").includes(character.name),
      );
      if (
        !evidence
        || !/(?:展開|召喚|使用|揮動|握住|啟動|驅動)/u.test(
          evidence.quote ?? "",
        )
      ) {
        continue;
      }
      output.push({
        character_id: character.entity_id,
        character_name: character.name,
        affiliation: null,
        scene_location_id: scene?.location_id ?? null,
        scene_location: scene?.name ?? null,
        scene_organization: scene?.organization ?? null,
        access_level: scene?.access_level ?? "unknown",
        status: "hard_conflict",
        issue_type: "ability_or_weapon_ownership_conflict",
        required_grounding: [],
        canon_evidence: [weapon.entity_id],
        reason: `The supplied Canon weapon record identifies ${owner}, not ${character.name}, as the established owner.`,
        exact_line_evidence: [evidence],
      });
    }
  }
  const canonicalNightStar = (registry?.characters ?? []).find(
    (entry) => entry.canonical_name === "夜星",
  );
  for (const candidate of originalCandidates) {
    const evidence = (candidate.exact_line_evidence ?? []).find((item) => (
      /(?:夜星(?:武裝)?學院)[^，。！？!?\n]{0,12}院長|院長[^，。！？!?\n]{0,12}夜星(?:武裝)?學院/u
        .test(item.quote ?? "")
    ));
    if (!evidence || !canonicalNightStar) continue;
    output.push({
      character_id: null,
      character_name: candidate.name,
      affiliation: null,
      scene_location_id: scene?.location_id ?? null,
      scene_location: scene?.name ?? null,
      scene_organization: "夜星武裝學院",
      access_level: scene?.access_level ?? "unknown",
      status: "hard_conflict",
      issue_type: "exclusive_organization_role_conflict",
      required_grounding: [],
      canon_evidence: [canonicalNightStar.entity_id],
      reason: "The original candidate is assigned an organization leadership identity already held by an established Canon character.",
      exact_line_evidence: [evidence],
    });
  }
  return output;
}

function canonContactCompatibilityFindings({
  draftText,
  originalCandidates,
  constraints,
}) {
  const output = [];
  const source = constraints
    && typeof constraints === "object"
    && !Array.isArray(constraints)
    ? constraints
    : {};
  const characters = originalCandidates.filter(
    (entry) => entry.category === "characters",
  );
  for (const constraint of source.exclusive_relationships ?? []) {
    const canonName = String(
      constraint?.canon_entity_name ?? constraint?.canon_name ?? "",
    ).trim();
    if (!canonName || constraint?.explicitly_closed !== true) continue;
    const allowedNames = new Set(
      (constraint.allowed_names ?? []).map((name) => String(name).trim()),
    );
    const relationshipPattern = constraint.relationship_pattern
      ? new RegExp(constraint.relationship_pattern, "u")
      : /兄|弟|姊|姐|妹|兄弟|姊妹|姐妹/u;
    for (const candidate of characters) {
      if (allowedNames.has(candidate.name)) continue;
      const evidence = (candidate.exact_line_evidence ?? []).find(
        (entry) => (
          String(entry.quote ?? "").includes(canonName)
          && relationshipPattern.test(String(entry.quote ?? ""))
        ),
      );
      if (!evidence) continue;
      output.push({
        character_id: null,
        character_name: candidate.name,
        affiliation: null,
        scene_location_id: null,
        scene_location: null,
        scene_organization: null,
        access_level: "unknown",
        status: "hard_conflict",
        issue_type: "exclusive_relationship_conflict",
        required_grounding: [],
        canon_evidence: [constraint.canon_evidence].filter(Boolean),
        reason: `The supplied Canon constraint closes ${canonName}'s ${constraint.relationship_type ?? "relationship"} roster and does not include ${candidate.name}.`,
        exact_line_evidence: [evidence],
      });
    }
  }
  for (const constraint of source.closed_historical_events ?? []) {
    const eventName = String(constraint?.event_name ?? "").trim();
    if (!eventName || constraint?.participant_list_closed !== true) continue;
    const allowedNames = new Set(
      (constraint.participant_names ?? []).map((name) => String(name).trim()),
    );
    for (const candidate of characters) {
      if (allowedNames.has(candidate.name)) continue;
      const evidence = (candidate.exact_line_evidence ?? []).find(
        (entry) => (
          String(entry.quote ?? "").includes(eventName)
          && /參與|參加|在場|親歷/u.test(String(entry.quote ?? ""))
        ),
      );
      if (!evidence) continue;
      output.push({
        character_id: null,
        character_name: candidate.name,
        affiliation: null,
        scene_location_id: null,
        scene_location: null,
        scene_organization: null,
        access_level: "unknown",
        status: "hard_conflict",
        issue_type: "closed_historical_event_participation_conflict",
        required_grounding: [],
        canon_evidence: [constraint.canon_evidence].filter(Boolean),
        reason: `The supplied Canon constraint closes the participant list for ${eventName} and does not include ${candidate.name}.`,
        exact_line_evidence: [evidence],
      });
    }
  }
  return output;
}

export async function buildDraftEntityAudit({
  draftText = "",
  plannedEntityManifest = {},
  plannedEntityHydration = {},
  relevantCanon = {},
  sceneLocation = null,
  timelineConstraints = [],
  statusConstraints = [],
  canonContactConstraints = {},
  activeEngineContent = null,
  activeEnginePath = "data/canon_db/active_engine.md",
  activeEngineHash = null,
} = {}, options = {}) {
  const draft = String(draftText ?? "");
  if (!draft.trim()) {
    return {
      draft_entity_audit: {
        schema_version: "phase59-draft-entity-audit-v1",
        status: "inactive",
        planned_entities: [],
        detected_entities: [],
        late_added_entities: [],
        hydrated_late_entities: [],
        unresolved_entities: [],
        original_candidates: [],
        canon_coverage_complete: true,
      },
      draft_canon_coverage: {
        named_canon_entities: 0,
        hydrated_entities: 0,
        late_added_entities: 0,
        unresolved_entities: 0,
        coverage_complete: true,
      },
      scene_compatibility: {
        schema_version: "phase59-scene-compatibility-v1",
        scene_location: null,
        findings: [],
      },
      relevant_canon,
      post_draft_diagnostic_composition: {
        total_chars: 0,
        active_engine_retrieval_chars: 0,
        active_engine_full_text_included: false,
        full_active_engine_fallback_used: false,
      },
    };
  }

  const manifest = normalizePlannedEntityManifest(plannedEntityManifest);
  const { registry } = await getStructuredEntityRegistry(
    options.entityRegistryOptions ?? {},
  );
  const preliminaryOriginalCharacters =
    possibleOriginalCharacterNames(draft, new Set());
  const detectedEntities = registryMentions(
    draft,
    registry,
    preliminaryOriginalCharacters.map((entry) => entry.name),
  );
  const planned = plannedKeys(manifest, registry);
  const lateAddedEntities = lateAddedDetections(detectedEntities, planned);
  const currentEngine = activeEngineContent ?? await readFile(
    options.activeEnginePath ?? projectPaths.activeEngine,
    "utf8",
  );
  const currentHash = activeEngineHash ?? sha256(currentEngine);
  const lateHydration = await hydratePlannedEntityManifest({
    plannedEntityManifest: manifestFromDetections(lateAddedEntities),
    relevantCanon,
    activeEngineContent: currentEngine,
    activeEnginePath,
    activeEngineHash: currentHash,
  }, options);
  const knownNames = new Set(
    detectedEntities.flatMap((entry) => [
      entry.canonical_name,
      entry.matched_text,
    ]),
  );
  const originalCandidates = [
    ...possibleOriginalCharacterNames(draft, knownNames),
    ...originalOrganizationCandidates(draft, registry),
    ...originalAbilityCandidates(draft, registry),
    ...originalWeaponCandidates(draft, registry),
  ];
  const unresolvedEntities =
    lateHydration.planned_entity_hydration.unresolved_entities;
  const allHydratedCanonEntities = uniqueBy([
    ...(plannedEntityHydration.resolved_entities ?? []),
    ...lateHydration.planned_entity_hydration.resolved_entities,
  ], (entry) => `${entry.category}\u0000${entry.entity_id}`);
  const location = sceneLocation
    ? sceneLocation
    : detectDeclaredSceneLocation(draft);
  const compatibility = evaluateSceneCompatibility({
    characters: hydratedCharacterEntries(
      plannedEntityHydration,
      lateHydration.planned_entity_hydration,
    ),
    sceneLocation: location,
    draftText: draft,
    timelineConstraints,
    statusConstraints,
  });
  compatibility.findings.push(...ownershipCompatibilityFindings({
    draftText: draft,
    detectedEntities,
    originalCandidates,
    registry,
    scene: compatibility.scene_location,
  }));
  compatibility.findings.push(...canonContactCompatibilityFindings({
    draftText: draft,
    originalCandidates,
    constraints: canonContactConstraints,
  }));
  const draftCanonCoverage = {
    named_canon_entities: detectedEntities.length,
    hydrated_entities: allHydratedCanonEntities.length,
    late_added_entities: lateAddedEntities.length,
    unresolved_entities: unresolvedEntities.length,
    coverage_complete: unresolvedEntities.length === 0
      && lateAddedEntities.every((late) => (
        allHydratedCanonEntities.some(
          (hydrated) => hydrated.entity_id === late.entity_id,
        )
      )),
  };
  const audit = {
    schema_version: "phase59-draft-entity-audit-v1",
    status: "complete",
    draft_sha256: sha256(draft),
    planned_entities: flattenPlannedEntityManifest(manifest),
    detected_entities: detectedEntities,
    late_added_entities: lateAddedEntities,
    hydrated_late_entities:
      lateHydration.planned_entity_hydration.resolved_entities,
    unresolved_entities: unresolvedEntities,
    original_candidates: originalCandidates,
    canon_coverage_complete: draftCanonCoverage.coverage_complete,
    retrieval_policy: {
      identity_match_rules: [
        "same_category_exact_full_name",
        "registered_alias_exact",
        "explicit_entity_id",
      ],
      ambiguity_requires_same_category_equal_rank: true,
      original_candidates_are_not_canon_errors: true,
      character_identity_match_rules: [
        "same_category_exact_full_name",
        "registered_alias_exact",
        "explicit_entity_id",
      ],
      forbidden_original_character_merge_signals: [
        "shared_surname",
        "similar_name",
        "overlapping_characters",
        "similar_pronunciation",
        "similar_appearance",
        "similar_story_function",
      ],
      fuzzy_matching_allowed: false,
      original_candidate_validation_scope: [
        "general_world_rules",
        "existing_canon_contact_points",
        "timeline_contact_points",
        "exclusive_roles",
        "exclusive_relationships",
        "exclusive_weapon_ownership",
      ],
      full_active_engine_fallback_allowed: false,
    },
  };
  const compositionPayload = {
    draft_entity_audit: audit,
    draft_canon_coverage: draftCanonCoverage,
    scene_compatibility: compatibility,
    relevant_canon_delta: lateHydration.relevant_canon_delta,
  };
  return {
    draft_entity_audit: audit,
    draft_canon_coverage: draftCanonCoverage,
    scene_compatibility: compatibility,
    relevant_canon: lateHydration.relevant_canon,
    relevant_canon_delta: lateHydration.relevant_canon_delta,
    post_draft_diagnostic_composition: {
      total_chars: JSON.stringify(compositionPayload, null, 2).length,
      draft_entity_audit_chars: JSON.stringify(audit, null, 2).length,
      scene_compatibility_chars:
        JSON.stringify(compatibility, null, 2).length,
      active_engine_retrieval_chars:
        lateHydration.composition.active_engine_retrieval_chars,
      active_engine_full_text_included: false,
      full_active_engine_fallback_used: false,
      original_formal_context_mutated: false,
    },
  };
}
