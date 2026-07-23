import { createHash } from "node:crypto";

const accessLevels = Object.freeze([
  "public",
  "internal",
  "restricted",
  "medical",
  "classified",
  "unknown",
]);

const justificationPattern =
  /(?:跨校(?:交流|任務|支援|協查)|受邀|邀請|合法通行|通行(?:牌|證|許可)|獲准|許可|正式協查|交流任務|任務指派|校方同意|院方同意)/u;

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function compact(value, maxChars = 360) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxChars) : null;
}

function canonicalOrganization(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/夜星/u.test(text)) return "夜星武裝學院";
  if (/白樞/u.test(text)) return "白樞軌道實習校";
  return text;
}

export function classifySceneAccessLevel(value, explicit = null) {
  if (accessLevels.includes(explicit)) return explicit;
  const text = String(value ?? "");
  if (/公開|大廳|廣場|接待區|校門/u.test(text)) return "public";
  if (/機密|核心檔|封存庫|最高權限/u.test(text)) return "classified";
  if (/醫療|診療|病房|保健/u.test(text)) return "medical";
  if (/限制|管制|檢測室|實驗室|內部檔案/u.test(text)) return "restricted";
  if (/內部|教職員|後台/u.test(text)) return "internal";
  return "unknown";
}

export function describeSceneLocation(value, overrides = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : { name: value };
  const name = compact(
    source.name
      ?? source.location
      ?? source.scene_location
      ?? overrides.name,
    160,
  );
  const organization = canonicalOrganization(
    source.organization
      ?? source.owner_organization
      ?? overrides.organization
      ?? name,
  );
  const accessLevel = classifySceneAccessLevel(
    name,
    source.access_level ?? overrides.access_level,
  );
  return {
    location_id: source.location_id
      ?? `SCENE-LOC-${sha256(
        `${name ?? "unknown"}|${organization ?? "unknown"}|${accessLevel}`,
      ).slice(0, 12).toUpperCase()}`,
    name: name ?? "unknown",
    organization,
    location_type: compact(
      source.location_type ?? overrides.location_type,
      80,
    ) ?? (
      /檢測室/u.test(name ?? "") ? "inspection_room"
        : /大廳/u.test(name ?? "") ? "lobby"
          : "unknown"
    ),
    access_level: accessLevel,
    source: source.source ?? "declared_scene_context",
    canon_status: source.canon_status ?? "declared_not_independently_canonized",
  };
}

function exactLineReferences(draftText, characterName, locationName) {
  const lines = String(draftText ?? "").replace(/\r\n?/gu, "\n").split("\n");
  const direct = lines.findIndex((line) => (
    line.includes(characterName) && line.includes(locationName)
  ));
  const characterLine = direct >= 0
    ? direct
    : lines.findIndex((line) => line.includes(characterName));
  if (characterLine < 0) return [];
  return [{
    line_reference: `L${characterLine + 1}`,
    line_start: characterLine + 1,
    line_end: characterLine + 1,
    quote: lines[characterLine].trim().slice(0, 180),
  }];
}

function misidentifiedMembership(draftText, characterName, affiliation, sceneOrganization) {
  if (!characterName || !affiliation || !sceneOrganization) return false;
  if (canonicalOrganization(affiliation) === canonicalOrganization(sceneOrganization)) {
    return false;
  }
  const sceneShort = sceneOrganization
    .replace(/武裝學院|軌道實習校|學院|實習校/gu, "");
  const escapedName = characterName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedSchool = sceneShort.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?:身為|作為|是|身分是)?\\s*(?:${escapedSchool}(?:武裝)?學院|${escapedSchool})\\s*(?:的)?學生[^\\n]{0,20}${escapedName}|${escapedName}[^\\n]{0,20}(?:是|身為|作為)\\s*(?:${escapedSchool}(?:武裝)?學院|${escapedSchool})\\s*(?:的)?學生`,
    "u",
  ).test(String(draftText ?? ""));
}

function constraintForCharacter(constraints, characterName) {
  return (Array.isArray(constraints) ? constraints : []).find((constraint) => (
    constraint
    && typeof constraint === "object"
    && String(
      constraint.character_name
        ?? constraint.character
        ?? constraint.name
        ?? "",
    ).trim() === characterName
  )) ?? null;
}

function statusPreventsPresence(constraint) {
  if (!constraint) return false;
  if (constraint.presence_allowed === false) return true;
  const content = [
    constraint.status,
    constraint.constraint,
    constraint.content,
  ].join("\n");
  return /(?:不得離開|不可離開|不能離開|臥床|禁止移動|不得到場|不可到場)/u.test(content);
}

function timelinePreventsPresence(constraint, sceneLocation) {
  if (!constraint) return false;
  if (
    constraint.presence_allowed === false
    || constraint.exclusive_presence === true
    || ["cannot_leave", "exclusive_location"].includes(constraint.exclusivity)
  ) {
    const otherLocation = String(
      constraint.location ?? constraint.required_location ?? "",
    ).trim();
    return !otherLocation || !String(sceneLocation ?? "").includes(otherLocation);
  }
  return false;
}

function compatibilityForCharacter({
  character,
  scene,
  draftText,
  timelineConstraints,
  statusConstraints,
}) {
  const characterName = compact(
    character.canonical_name
      ?? character.formal_name
      ?? character.name,
    80,
  );
  const affiliation = canonicalOrganization(character.affiliation);
  const sceneOrganization = canonicalOrganization(scene.organization);
  const canonEvidence = [
    ...(character.relevant_canon_record_ids ?? []),
    ...(character.canon_evidence ?? []),
  ];
  const requiredGrounding = [];
  let status = "compatible";
  let issueType = null;
  let reason = "No supplied Canon fact conflicts with this presence.";

  if (misidentifiedMembership(
    draftText,
    characterName,
    affiliation,
    sceneOrganization,
  )) {
    status = "hard_conflict";
    issueType = "misidentified_organization_membership";
    reason = "The draft identifies the character as a member of a different organization than the supplied Canon affiliation.";
  } else if (timelinePreventsPresence(
    constraintForCharacter(timelineConstraints, characterName),
    scene.name,
  )) {
    status = "hard_conflict";
    issueType = "timeline_presence_conflict";
    reason = "A supplied Canon timeline constraint places the character in an exclusive, non-interruptible location at the same time.";
  } else if (statusPreventsPresence(
    constraintForCharacter(statusConstraints, characterName),
  )) {
    status = "hard_conflict";
    issueType = "character_status_presence_conflict";
    reason = "A supplied current-status constraint explicitly prevents the character from reaching this scene.";
  } else if (
    !affiliation
    || !sceneOrganization
    || scene.access_level === "unknown"
  ) {
    status = "unknown";
    reason = "Canon or declared scene data is insufficient to determine affiliation or access compatibility.";
  } else if (affiliation !== sceneOrganization && scene.access_level !== "public") {
    if (justificationPattern.test(String(draftText ?? ""))) {
      status = "compatible";
      reason = "The draft supplies an explicit cross-organization task, invitation, assistance, or access basis.";
    } else {
      status = "requires_justification";
      issueType = "unexplained_cross_organization_presence";
      requiredGrounding.push(
        "cross_organization_visit_basis",
        "restricted_area_access_basis",
      );
      reason = "The character belongs to another organization and appears in a non-public area without an explicit visit or access basis.";
    }
  }

  return {
    character_id: character.entity_id ?? null,
    character_name: characterName,
    affiliation,
    scene_location_id: scene.location_id,
    scene_location: scene.name,
    scene_organization: sceneOrganization,
    access_level: scene.access_level,
    status,
    issue_type: issueType,
    required_grounding: requiredGrounding,
    canon_evidence: canonEvidence,
    reason,
    exact_line_evidence: exactLineReferences(
      draftText,
      characterName,
      scene.name,
    ),
  };
}

export function evaluateSceneCompatibility({
  characters = [],
  sceneLocation = null,
  draftText = "",
  timelineConstraints = [],
  statusConstraints = [],
} = {}) {
  const scene = describeSceneLocation(sceneLocation);
  return {
    schema_version: "phase59-scene-compatibility-v1",
    scene_location: scene,
    findings: (Array.isArray(characters) ? characters : [])
      .filter((character) => character && typeof character === "object")
      .map((character) => compatibilityForCharacter({
        character,
        scene,
        draftText,
        timelineConstraints,
        statusConstraints,
      })),
    policy: {
      cross_organization_presence_forbidden: false,
      requires_justification_is_prohibition: false,
      unknown_is_automatic_pass: false,
      unknown_is_automatic_conflict: false,
      backend_may_remove_characters: false,
      backend_may_rewrite_scene: false,
    },
  };
}

export function detectDeclaredSceneLocation(draftText = "") {
  const patterns = [
    /夜星(?:武裝)?學院限制檢測室/u,
    /夜星(?:武裝)?學院公開大廳/u,
    /白樞(?:軌道實習校)?[^，。！？!?\n]{0,12}(?:大廳|檢測室|教室|候站區)/u,
    /夜星(?:武裝)?學院[^，。！？!?\n]{0,12}(?:大廳|檢測室|教室|醫療區|訓練場)/u,
  ];
  for (const pattern of patterns) {
    const match = String(draftText ?? "").match(pattern);
    if (match) return describeSceneLocation(match[0]);
  }
  return describeSceneLocation("unknown");
}
