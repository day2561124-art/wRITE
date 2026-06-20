const severityLabels = {
  none: "無",
  low: "低",
  medium: "中",
  high: "高",
};

function normalizedFindings(result) {
  if (!Array.isArray(result?.findings)) return [];
  return result.findings.map((item = {}) => {
    const characters = Array.isArray(item.characters)
      ? item.characters.filter((character) => typeof character === "string" && character.trim())
      : [];
    return {
      code: item.code ?? "",
      severity: item.severity ?? null,
      severity_label: severityLabels[item.severity] ?? item.severity ?? "未標示",
      characters,
      character_label: characters.length ? characters.join("、") : "未指定角色",
      message: item.message ?? "",
      evidence: item.evidence ?? "",
      recommendation: item.recommendation ?? "",
    };
  });
}

export function formatCharacterVoiceGuardForDisplay(result) {
  const used = result?.character_voice_guard_used === true;
  const registryLoaded = result?.character_voice_registry_loaded === true;
  const verdict = used
    ? result?.verdict ?? result?.character_voice_guard_verdict ?? null
    : null;
  const severity = used
    ? result?.severity ?? result?.character_voice_guard_severity ?? null
    : null;
  const findings = used ? normalizedFindings(result) : [];
  const findingsCount = used
    ? Number.isInteger(result?.character_voice_guard_findings_count)
      ? result.character_voice_guard_findings_count
      : findings.length
    : 0;

  let statusLabel = "尚未執行";
  let badgeClass = "is-missing";
  let blocking = false;
  if (used && (verdict === "fail" || severity === "high")) {
    statusLabel = "語氣高風險";
    badgeClass = "is-blocked";
    blocking = true;
  } else if (used && verdict === "warn") {
    statusLabel = "語氣需注意";
    badgeClass = "is-warning";
  } else if (used && verdict === "pass") {
    statusLabel = "語氣正常";
    badgeClass = "is-pass";
  }

  const summaryParts = [];
  if (!used) {
    summaryParts.push("Character Voice Drift Guard 尚未執行。");
  } else {
    summaryParts.push(`${statusLabel}；共 ${findingsCount} 筆發現。`);
  }
  if (used && !registryLoaded) {
    summaryParts.push("Character Voice Registry 未載入，檢查不完整。");
  }

  return {
    used,
    registry_loaded: used ? registryLoaded : false,
    registry_source_type: result?.character_voice_registry_source_type ?? null,
    registry_authority: result?.character_voice_registry_authority ?? null,
    registry_hash_sha256: result?.character_voice_registry_hash_sha256 ?? null,
    verdict,
    severity,
    findings_count: findingsCount,
    status_label: statusLabel,
    severity_label: severityLabels[severity] ?? severity ?? "未標示",
    blocking,
    badge_class: badgeClass,
    summary: summaryParts.join(" "),
    findings,
  };
}

export default {
  formatCharacterVoiceGuardForDisplay,
};
