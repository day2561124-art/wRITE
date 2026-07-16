import {
  extractWorldEntityNames,
  parseActiveEngineWorldEntityRecords,
  resolveWorldEntityMentions,
  worldEntityMentionStatuses,
} from "./world-entity-canon-grounding-service.mjs";
import {
  originalEntityFreedomContract,
} from "./character-canon-grounding-service.mjs";

function uniqueBy(items, keyFor) {
  const seen = new Set();

  return items.filter((item) => {
    const key = keyFor(item);

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function expandGeneratedWorldEntityCanonGroundingBase(input = {}) {
  const rawStoryText = String(input.rawStoryText ?? "");
  const activeEngineContent = String(input.activeEngineContent ?? "");
  const sourceFile = String(
    input.sourceFile ?? "data/canon_db/active_engine.md",
  );
  const preGeneration = input.existingWorldEntityCanonGrounding ?? {};
  const preGenerationEntities = Array.isArray(preGeneration.entities)
    ? preGeneration.entities
    : [];

  const records = parseActiveEngineWorldEntityRecords(
    activeEngineContent,
    { sourceFile },
  );

  const integrityGatePassed = input.integrityValidated === true;

  const resolution = integrityGatePassed
    ? resolveWorldEntityMentions(rawStoryText, records)
    : {
        status: worldEntityMentionStatuses.none,
        confirmed_entities: [],
        ambiguous_mentions: [],
      };

  const preGenerationNames = new Set(
    preGenerationEntities.map((entity) => entity.canonical_name),
  );

  const generatedEntities = integrityGatePassed
    ? resolution.confirmed_entities
      .filter((entity) => (
        !preGenerationNames.has(entity.canonical_name)
      ))
      .map((entity) => ({
        ...entity,
        grounding_classification:
          "generated_existing_canon_world_entity",
        match_sources: ["verified_raw_story_text"],
      }))
    : [];

  const mergedEntities = [
    ...preGenerationEntities.map((entity) => ({
      ...entity,
      grounding_classification:
        entity.grounding_classification
        ?? "pre_generation_existing_canon_world_entity",
    })),
    ...generatedEntities,
  ];

  const recordByName = new Map(
    records.map((record) => [record.canonical_name, record]),
  );

  const ambiguousExistingCanonCandidates = integrityGatePassed
    ? resolution.ambiguous_mentions
      .map((mention) => {
        const record = recordByName.get(mention.canonical_name);

        if (!record) return null;

        return {
          ...record,
          mention_evidence: mention,
          identity_not_confirmed: true,
          identity_resolution_required: true,
          do_not_apply_as_grounded_hard_facts_warning:
            "Candidate world-entity facts are identity-resolution evidence only. They do not become binding until ChatGPT semantically confirms that the passage refers to this exact existing Canon world entity.",
        };
      })
      .filter((item) => item !== null)
    : [];

  const canonNames = new Set(
    records.map((record) => record.canonical_name),
  );

  const possibleOriginalWorldEntities = integrityGatePassed
    ? extractWorldEntityNames(rawStoryText)
      .filter((entity) => !canonNames.has(entity.canonical_name))
      .map((entity) => ({
        ...entity,
        classification: "possible_original_world_entity",
        resolution_status:
          worldEntityMentionStatuses.none,
        canon_absence_is_error: false,
        automatic_persistence: false,
      }))
    : [];

  return {
    schema_version:
      "phase48c-generated-world-entity-canon-grounding-v1",
    loaded: activeEngineContent.length > 0,
    source_authority:
      preGeneration.source_authority
      ?? "active_engine_canon_high_authority",
    source_file: sourceFile,
    source_scope:
      "full_active_engine_after_verified_raw_story_integrity",
    matched_world_entity_count: mergedEntities.length,
    pre_generation_world_entity_count:
      preGenerationEntities.length,
    generated_existing_canon_world_entity_count:
      generatedEntities.length,
    pre_generation_world_entities:
      preGenerationEntities.map((entity) => entity.canonical_name),
    generated_existing_canon_world_entities:
      generatedEntities.map((entity) => entity.canonical_name),
    ambiguous_mentions: resolution.ambiguous_mentions,
    ambiguous_existing_canon_world_entity_candidates:
      ambiguousExistingCanonCandidates,
    original_or_unresolved_world_entities: uniqueBy(
      possibleOriginalWorldEntities,
      (item) => `${item.entity_type}:${item.canonical_name}`,
    ),
    entities: mergedEntities,
    original_entity_freedom: {
      ...originalEntityFreedomContract,
    },
    authority_contract:
      preGeneration.authority_contract ?? null,
    expansion_metadata: {
      mode: "expansion_not_restriction",
      integrity_gate_required: true,
      integrity_gate_passed: integrityGatePassed,
      formal_expansion_applied: integrityGatePassed,
      raw_story_sha256: input.rawStorySha256 ?? null,
      generated_existing_world_entity_names:
        generatedEntities.map((entity) => entity.canonical_name),
      ambiguous_mentions_remain_unresolved: true,
      canon_absence_blocks_final_polisher: false,
      original_world_entities_persisted: false,
    },
  };
}

function classifyPhase48cExplicitWorldEntity(name) {
  if (
    /(?:委員會|辦公室|應變局|管理局|調查局|執行局|觀測局|巡禮局|局|署|廳|處|部)$/u
      .test(name)
  ) {
    return "administrative_agency";
  }

  if (/(?:學院|學校)$/u.test(name)) return "school";
  if (/(?:公司|集團)$/u.test(name)) return "company";
  if (/(?:共和國|王國|帝國|聯邦)$/u.test(name)) {
    return "country";
  }
  if (/(?:市|城|區|州|省|島|港)$/u.test(name)) {
    return "city_or_region";
  }
  if (/(?:中心|基地|設施|站|院|所)$/u.test(name)) {
    return "facility";
  }
  if (/(?:社|會|聯盟|協會|公會|教團|軍團)$/u.test(name)) {
    return "organization";
  }

  return "world_entity";
}

function collectPhase48cExplicitOriginalWorldEntities(
  rawStoryText,
) {
  const story = String(rawStoryText ?? "");
  const pattern = /(?:新成立(?:了)?(?:的)?|成立(?:了)?(?:的)?|新設(?:立)?(?:了)?(?:的)?|設立(?:了)?(?:的)?)\s*([\p{Script=Han}・·]{2,40}?(?:委員會|辦公室|應變局|管理局|調查局|執行局|觀測局|巡禮局|學院|學校|中心|公司|集團|聯盟|協會|公會|教團|軍團|共和國|王國|帝國|聯邦|基地|設施|局|署|廳|處|部|院|所|社|會|市|城|區|州|省|島|港|站))(?=也|已|將|正|準備|負責|開始|宣布|表示|派出|在|於|的|，|。|、|；|：|\s|$)/gu;
  const entities = [];
  const seen = new Set();

  for (const match of story.matchAll(pattern)) {
    const canonicalName = String(match[1] ?? "").trim();

    if (!canonicalName || seen.has(canonicalName)) continue;
    seen.add(canonicalName);

    entities.push({
      canonical_name: canonicalName,
      entity_type:
        classifyPhase48cExplicitWorldEntity(canonicalName),
      grounding_classification:
        "original_or_unresolved_world_entity",
      resolution_status: "no_existing_canon_match_required",
      introduction_evidence: {
        passage: String(match[0] ?? "").trim(),
        reason: "explicit_new_world_entity_introduction",
      },
      canon_absence_is_error: false,
      automatic_persistence: false,
    });
  }

  return entities;
}

function mergePhase48cOriginalWorldEntities(
  existingEntities,
  explicitEntities,
) {
  const merged = [];
  const seen = new Set();

  for (const entity of [
    ...(Array.isArray(existingEntities) ? existingEntities : []),
    ...(Array.isArray(explicitEntities) ? explicitEntities : []),
  ]) {
    const canonicalName = String(
      entity?.canonical_name
      ?? entity?.entity_name
      ?? "",
    ).trim();

    if (!canonicalName || seen.has(canonicalName)) continue;
    seen.add(canonicalName);

    merged.push({
      ...entity,
      canonical_name: canonicalName,
    });
  }

  return merged;
}

export function expandGeneratedWorldEntityCanonGrounding(
  input = {},
) {
  const baseResult =
    expandGeneratedWorldEntityCanonGroundingBase(input);

  if (!baseResult || typeof baseResult !== "object") {
    return baseResult;
  }

  const existingOriginalEntities = Array.isArray(
    baseResult.original_or_unresolved_world_entities,
  )
    ? baseResult.original_or_unresolved_world_entities
    : [];

  const explicitOriginalEntities =
    input.integrityValidated === true
      ? collectPhase48cExplicitOriginalWorldEntities(
        input.rawStoryText,
      )
      : [];

  return {
    ...baseResult,
    original_or_unresolved_world_entities:
      mergePhase48cOriginalWorldEntities(
        existingOriginalEntities,
        explicitOriginalEntities,
      ),
  };
}

export default expandGeneratedWorldEntityCanonGrounding;
