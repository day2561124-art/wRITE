import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

// Minimal Final Polisher service for Phase 22R
export function runFinalPolisher(input = {}) {
  const candidateText = String(
    input.candidateText ?? input.candidate_text ?? "",
  );
  const result = {
    module: "final_polisher",
    status: "skipped",
    scope: "candidate_text_only",
    polish_goals: [
      "preserve_canon_and_causality",
      "remove_clear_repetition",
      "smooth_material_diction_friction",
    ],
    blocked_changes: [
      "canon_fact_change",
      "new_official_setting",
      "battle_result_change",
      "character_ability_change",
      "active_engine_change",
      "entity_registry_change",
    ],
    revision_report: {
      line_level_issues: [],
      paragraph_level_issues: [],
      dialogue_subtext_issues: [],
      sensory_weight_issues: [],
      ending_issues: [],
    },
    polished_text: "",
    input_hash_sha256: candidateText ? sha256(candidateText) : null,
    output_hash_sha256: null,
    text_identity_preserved: true,
    polish_suggestions: [],
    needs_structural_revision: false,
    structural_revision_reason: "",
    suggested_return_stage: "",
    warnings: [],
  };

  if (!candidateText) {
    result.status = "skipped";
    result.warnings.push("no_candidate_text");
    return result;
  }

  result.status = "completed";

  // Simple heuristics to detect issues
  const lines = candidateText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // detect abstract summary lines
  const abstractPatterns = [/\b總結\b|\b總之\b|\bin summary\b|\boverall\b|\b結論\b/iu];
  for (const ln of lines) {
    for (const pat of abstractPatterns) {
      if (pat.test(ln)) {
        result.revision_report.paragraph_level_issues.push({ type: "abstract_summary", example: ln.slice(0, 200) });
        result.polish_suggestions.push("把抽象總結改為具體動作或事件。");
        break;
      }
    }
  }

  // detect pretty ending (single-sentence thematic endings)
  const lastPara = lines.slice(-2).join(" ");
  if (/(hope|peace|meaning|意義|希望|美好|感想)/iu.test(lastPara) && lastPara.length < 200) {
    result.revision_report.ending_issues.push({ type: "pretty_ending_without_event", example: lastPara.slice(0,200) });
    result.polish_suggestions.push("章尾需要具體事件或通知收束，而非只有漂亮句子。");
  }

  // detect medical-record style injuries (keywords or colon-separated lists)
  if (/右腕|左腕|深割|麻感|擦傷|傷勢|縫合|出血|止血/.test(candidateText)) {
    result.revision_report.sensory_weight_issues.push({ type: "medical_record_style", example: candidateText.slice(0,200) });
    result.polish_suggestions.push("將醫療紀錄式詞彙轉為角色身體反應與具體動作描述。");
  }

  // detect dialogue too direct (very explicit emotion statements)
  if (/\b我(很|非常)?(悲傷|難過|生氣|害怕|絕望)\b/.test(candidateText)) {
    result.revision_report.dialogue_subtext_issues.push({ type: "too_explicit_emotion", example: "直接情緒陳述" });
    result.polish_suggestions.push("用停頓、視線或動作呈現情緒，而非直接陳述。");
  }

  // detect analysis-report tone (presence of words like '分析' '報告' or '結論' in character speech)
  if (/分析|報告|結論|統計|數據/.test(candidateText)) {
    result.revision_report.paragraph_level_issues.push({ type: "analysis_tone", example: "可能以分析報告口吻描述" });
    result.polish_suggestions.push("讓角色語氣更具體化、減少報告式敘述。");
  }

  // detect flat sentence rhythm (many sentences of similar length)
  const sentences = candidateText.split(/[。！？.!?]+/).map((s)=>s.trim()).filter(Boolean);
  if (sentences.length >= 4) {
    const lengths = sentences.map(s=>s.length);
    const avg = lengths.reduce((a,b)=>a+b,0)/lengths.length;
    const variance = lengths.reduce((a,b)=>a+Math.pow(b-avg,2),0)/lengths.length;
    if (variance < Math.pow(avg*0.25,2)) {
      result.revision_report.paragraph_level_issues.push({ type: "flat_rhythm", example: "句子長度過於平均" });
      result.polish_suggestions.push("調整長短句節奏，引入短句或長句以創造段落壓力。");
    }
  }

  // Report only. The final polisher must never synthesize replacement prose,
  // add bodily reactions, or explain causality/silence on the author's behalf.
  result.polished_text = candidateText;
  result.output_hash_sha256 = sha256(result.polished_text);
  result.text_identity_preserved =
    result.output_hash_sha256 === result.input_hash_sha256;

  // Structural revision detection: no new change/turn
  if (!/新|變局|下一場|候場|通知|壓力|限制|選擇/.test(candidateText) ) {
    result.needs_structural_revision = true;
    result.structural_revision_reason = "本章缺乏明確新變局或下一步壓力";
    result.suggested_return_stage = "writing_card_director";
  }

  return result;
}

export default runFinalPolisher;
