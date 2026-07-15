import {
  canonCharacterMentionStatuses,
  originalEntityFreedomContract,
  parseActiveEngineCharacterRecords,
  resolveCanonCharacterMentions,
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

function collectPossibleOriginalEntities(rawStoryText, canonNames) {
  const story = String(rawStoryText ?? "");
  const candidates = [];
  const collect = (pattern, category, reason) => {
    for (const match of story.matchAll(pattern)) {
      const name = String(match[1] ?? "").trim();
      if (!name || canonNames.has(name)) continue;
      candidates.push({
        entity_name: name,
        entity_category: category,
        classification: "possible_original_entity",
        resolution_status: canonCharacterMentionStatuses.none,
        reason,
        canon_absence_is_error: false,
        automatic_persistence: false,
      });
    }
  };

  collect(
    /(?:名叫|叫做|叫作|自稱)\s*([\p{Script=Han}・·]{2,16}?)(?=的|[，,。；;！!？?：:\s]|$)/gu,
    "character",
    "explicit_original_character_introduction",
  );
  collect(
    /(?:成立了|成立|設立了|設立|新設了|新設)\s*([\p{Script=Han}]{2,24}(?:委員會|辦公室|局|署|廳|處|部))/gu,
    "administrative_agency",
    "new_agency_introduction",
  );
  collect(
    /(?:新城市|城市|新城)\s*([\p{Script=Han}]{2,10}?)(?=今年|明年|去年|第一次|首次|剛|已|將|在|的|[，,。；;！!？?：:\s]|$)/gu,
    "city",
    "new_city_introduction",
  );
  collect(
    /(?:^|[，,。；;！!？?：:\s「『“"]|的)([\p{Script=Han}]{2,12}(?:共和國|王國|帝國|聯邦))/gu,
    "country",
    "country_name_without_existing_character_identity",
  );
  return uniqueBy(candidates, (item) => `${item.entity_category}:${item.entity_name}`);
}

export function expandGeneratedCastCanonGrounding(input = {}) {
  const rawStoryText = String(input.rawStoryText ?? "");
  const activeEngineContent = String(input.activeEngineContent ?? "");
  const sourceFile = String(input.sourceFile ?? "data/canon_db/active_engine.md");
  const preGeneration = input.existingCharacterCanonGrounding ?? {};
  const preGenerationCharacters = Array.isArray(preGeneration.characters)
    ? preGeneration.characters
    : [];
  const records = parseActiveEngineCharacterRecords(activeEngineContent, { sourceFile });
  const resolution = resolveCanonCharacterMentions(rawStoryText, records);
  const preGenerationNames = new Set(
    preGenerationCharacters.map((character) => character.canonical_name),
  );

  // SERVICE INTEGRITY INVARIANT: integrity gate must be passed to produce formal expansion
  const integrityGatePassed = input.integrityValidated === true;

  // GENERATED CHARACTER HANDLING: only build merged characters if integrity gate passed
  let generatedCharacters = [];
  let mergedCharacters = preGenerationCharacters.map((character) => ({
    ...character,
    grounding_classification: "pre_generation_existing_canon_character",
  }));

  if (integrityGatePassed) {
    generatedCharacters = resolution.confirmed_characters
      .filter((character) => !preGenerationNames.has(character.canonical_name))
      .map((character) => ({
        ...character,
        grounding_classification: "generated_existing_canon_character",
        match_sources: ["verified_raw_story_text"],
      }));
    mergedCharacters = [
      ...mergedCharacters,
      ...generatedCharacters,
    ];
  }

  const generatedNames = new Set(
    generatedCharacters.map((character) => character.canonical_name),
  );
  const canonNames = new Set(records.map((record) => record.canonical_name));
  const possibleOriginalEntities = collectPossibleOriginalEntities(rawStoryText, canonNames);

  // AMBIGUOUS CANON CANDIDATES: collect for semantic identity resolution (not binding hard facts)
  const ambiguousExistingCanonCandidates = resolution.ambiguous_mentions
    .map((mention) => {
      const record = records.find((r) => r.canonical_name === mention.canonical_name);
      if (!record) return null;
      return {
        canonical_name: mention.canonical_name,
        source_authority: record.source_authority,
        gender: record.gender,
        pronouns: record.pronouns,
        identity_facts: record.identity_facts,
        affiliation_facts: record.affiliation_facts,
        appearance_facts: record.appearance_facts,
        relationship_or_position_facts: record.relationship_or_position_facts,
        explicit_body_traits: record.explicit_body_traits,
        mention_evidence: mention,
        identity_not_confirmed: true,
        identity_resolution_required: true,
        do_not_apply_as_grounded_hard_facts_warning: "Candidate Canon facts are identity-resolution evidence only. They do not become binding until ChatGPT semantically confirms that the exact passage refers to the existing Canon entity.",
      };
    })
    .filter((item) => item !== null);

  return {
    schema_version: "phase48b-generated-cast-canon-grounding-v1",
    loaded: activeEngineContent.length > 0,
    source_authority: preGeneration.source_authority
      ?? "active_engine_canon_high_authority",
    source_file: sourceFile,
    source_scope: "full_active_engine_after_verified_raw_story_integrity",
    matched_character_count: mergedCharacters.length,
    pre_generation_character_count: preGenerationCharacters.length,
    generated_existing_canon_character_count: generatedCharacters.length,
    pre_generation_characters: preGenerationCharacters.map((character) => (
      character.canonical_name
    )),
    generated_existing_canon_characters: generatedCharacters.map((character) => (
      character.canonical_name
    )),
    ambiguous_mentions: resolution.ambiguous_mentions,
    ambiguous_existing_canon_candidates: ambiguousExistingCanonCandidates,
    original_or_unresolved_mentions: possibleOriginalEntities,
    characters: mergedCharacters,
    body_trait_policy: preGeneration.body_trait_policy ?? null,
    authority_contract: preGeneration.authority_contract ?? null,
    // ORIGINAL ENTITY FREEDOM INVARIANT: always provided, not conditional on entity grounding
    original_entity_freedom: { ...originalEntityFreedomContract },
    expansion_metadata: {
      mode: "expansion_not_restriction",
      integrity_gate_required: true,
      integrity_gate_passed: integrityGatePassed,
      raw_story_sha256: input.rawStorySha256 ?? null,
      generated_existing_character_names: [...generatedNames],
      ambiguous_mentions_remain_unresolved: true,
      canon_absence_blocks_final_polisher: false,
      original_entities_persisted: false,
      formal_expansion_applied: integrityGatePassed,
    },
  };
}

export default expandGeneratedCastCanonGrounding;
