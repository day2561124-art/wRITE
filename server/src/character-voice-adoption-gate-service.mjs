import {
  formatCharacterVoiceGuardForDisplay,
} from "./character-voice-guard-display.mjs";

export const CHARACTER_VOICE_HIGH_RISK_CONFIRMATION_TEXT =
  "確認採用高風險角色語氣候選";

function metadataOf(value) {
  return value?.metadata ?? value ?? {};
}

function displayOf(value) {
  const metadata = metadataOf(value);
  const existing = value?.character_voice_guard_display
    ?? metadata.character_voice_guard_display;
  if (existing && typeof existing === "object" && "blocking" in existing) {
    return existing;
  }
  return formatCharacterVoiceGuardForDisplay(
    value?.character_voice_guard
      ?? metadata.character_voice_guard
      ?? value,
  );
}

function displayRank(display) {
  if (display?.blocking === true) return 4;
  if (display?.verdict === "warn" || display?.severity === "medium") return 3;
  if (display?.used === true && display?.registry_loaded === false) return 2;
  if (display?.used === false) return 1;
  return 0;
}

export function buildCharacterVoiceAdoptionGate(
  candidateOrMetadata,
  proofOrMetadata = null,
) {
  const displays = [displayOf(candidateOrMetadata)];
  if (proofOrMetadata) displays.push(displayOf(proofOrMetadata));
  const display = displays.sort((left, right) => displayRank(right) - displayRank(left))[0];

  let riskLevel = "normal";
  let status = "pass";
  let reason = null;
  let requiresApprovalQueue = false;
  let requiresSecondConfirmation = false;
  let requiresExactConfirmationText = false;

  if (display.blocking === true) {
    riskLevel = "high";
    status = "requires_second_confirmation";
    reason = "character_voice_guard_blocking";
    requiresApprovalQueue = true;
    requiresSecondConfirmation = true;
    requiresExactConfirmationText = true;
  } else if (display.verdict === "warn" || display.severity === "medium") {
    riskLevel = "medium";
    status = "requires_attention";
    reason = "character_voice_guard_requires_attention";
    requiresApprovalQueue = true;
  } else if (display.used === false) {
    riskLevel = "medium";
    status = "not_used";
    reason = "character_voice_guard_not_used";
  } else if (display.registry_loaded === false) {
    riskLevel = "medium";
    status = "missing_registry";
    reason = "character_voice_registry_missing";
  }

  return {
    checked: true,
    used: display.used === true,
    registry_loaded: display.registry_loaded === true,
    verdict: display.verdict ?? null,
    severity: display.severity ?? null,
    findings_count: display.findings_count ?? 0,
    blocking: display.blocking === true,
    requires_approval_queue: requiresApprovalQueue,
    requires_second_confirmation: requiresSecondConfirmation,
    requires_exact_confirmation_text: requiresExactConfirmationText,
    exact_confirmation_text: CHARACTER_VOICE_HIGH_RISK_CONFIRMATION_TEXT,
    risk_level: riskLevel,
    status,
    reason,
    display,
  };
}

export function assertCharacterVoiceAdoptionAllowed({
  candidate,
  proof,
  approvalItem,
}) {
  const gate = buildCharacterVoiceAdoptionGate(candidate, proof);
  if (gate.blocking !== true) return gate;
  const recordedGate = approvalItem?.details?.character_voice_adoption_gate;
  if (
    !approvalItem
    || approvalItem.action_type !== "adopt_writing_candidate"
    || approvalItem.requires_second_confirmation !== true
    || recordedGate?.blocking !== true
    || !recordedGate?.exact_confirmation_text
  ) {
    throw new Error(
      "Character Voice Guard blocking adoption requires approval queue second confirmation.",
    );
  }
  return gate;
}

export default {
  buildCharacterVoiceAdoptionGate,
  assertCharacterVoiceAdoptionAllowed,
};
