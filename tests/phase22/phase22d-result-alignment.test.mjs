import assert from "node:assert";
import { evaluateCandidateAgainstAnchor } from "../../server/src/chapter-anchor-guard.mjs";

function makeBundle() {
  return {
    content: {
      chapter_anchor: {
        locked_result: "九逃勝",
        required_core_characters: ["朝日奈千夜", "九逃"],
        allowed_supporting_characters: [],
        forbidden_characters: ["江止澄", "蒼藤嵐", "周念今", "安岫", "建瑞凰"],
      },
    },
    anchor_confidence: "high",
  };
}

// 正向測試：合法第二十章醫療後座候選，包含「勝者，九逃」「九逃勝」「朝日奈千夜敗」
{
  const bundle = makeBundle();
  const candidate = "勝者，九逃。九逃勝。朝日奈千夜敗。醫療搬送至處置室後座，千夜與九逃的傷勢延續。";
  const res = evaluateCandidateAgainstAnchor(bundle, candidate);
  assert(Array.isArray(res.guard_report));
  assert(!res.guard_report.some((r) => r.code === "P0_RESULT_CONFLICT"), "Should NOT report P0_RESULT_CONFLICT for aligned candidate");
  assert(res.guard_report.some((r) => r.code === "P1_TOO_MANY_NEW_NAMES") === false || res.blocked === false, "P1 may exist but must not block");
}

// 負向測試：寫「朝日奈千夜勝」「九逃敗」必須 P0_RESULT_CONFLICT
{
  const bundle = makeBundle();
  const candidate = "朝日奈千夜勝。九逃敗。這場比賽結果改寫為千夜勝。";
  const res = evaluateCandidateAgainstAnchor(bundle, candidate);
  assert(res.guard_report.some((r) => r.code === "P0_RESULT_CONFLICT"), "Must report P0_RESULT_CONFLICT when opposite winner asserted");
}

// 負向測試：候選寫 forbidden character 勝，例如「蒼藤嵐勝」，必須 P0_FORBIDDEN_CHARACTER 或 P0_RESULT_CONFLICT
{
  const bundle = makeBundle();
  const candidate = "蒼藤嵐勝。比賽結果寫蒼藤嵐勝出。";
  const res = evaluateCandidateAgainstAnchor(bundle, candidate);
  assert(res.guard_report.some((r) => r.code === "P0_FORBIDDEN_CHARACTER") || res.guard_report.some((r) => r.code === "P0_RESULT_CONFLICT"), "Forbidden winner must trigger P0_FORBIDDEN_CHARACTER or P0_RESULT_CONFLICT");
}

// P1_TOO_MANY_NEW_NAMES 可存在但不得 block candidate
{
  const bundle = makeBundle();
  const manyNouns = Array.from({ length: 8 }).map((_, i) => `場地${i}號`).join("，");
  const candidate = `朝日奈千夜與九逃完成第一場後座確認，九逃勝，裁定中止。敘述含多個名詞：${manyNouns}。醫療處置、擔架、走廊處理流程描述。`;
  const res = evaluateCandidateAgainstAnchor(bundle, candidate);
  assert(res.guard_report.some((r) => r.code === "P1_TOO_MANY_NEW_NAMES") === true || res.guard_report.some((r) => r.code === "P1_TOO_MANY_NEW_NAMES") === false);
  assert(res.blocked === false, "P1 must not block the candidate");
}


// Phase22L regression: normal Chinese medical-afterseat prose must not be counted as hundreds of new names.
{
  const bundle = makeBundle();
  const candidate = [
    "朝日奈千夜坐在處置室長椅上，左肋還在鈍痛，右膝的短鎖感沒有完全退掉。",
    "九逃的左前臂重新包紮，醫療終端把明日複查與換藥提醒推到兩人的終端裡。",
    "訓練館南側一號帶的燈光還亮著，觀眾席慢慢安靜下來，安全牆後只剩場務整理紀錄。",
    "勝者仍是九逃，裁定中止沒有改變；醫療組只要求今晚不能沾水，短期訓練限制等明日複查後再確認。",
  ].join("\n");
  const res = evaluateCandidateAgainstAnchor(bundle, candidate);
  assert(!res.guard_report.some((r) => r.code === "P1_TOO_MANY_NEW_NAMES"), "Normal Chinese prose must not trigger P1_TOO_MANY_NEW_NAMES");
  assert(res.blocked === false, "Regression prose must not be blocked");
}

// Phase22L regression: explicit introduction of several unknown names should still produce non-blocking P1 with examples.
{
  const bundle = makeBundle();
  const candidate = "朝日奈千夜與九逃在醫療後座確認九逃勝。新生名叫霧島澪，轉學生名叫白川遙，醫師稱為槐野理子，教官稱為青峰直人。";
  const res = evaluateCandidateAgainstAnchor(bundle, candidate);
  const p1 = res.guard_report.find((r) => r.code === "P1_TOO_MANY_NEW_NAMES");
  assert(p1, "Explicit unknown-name introductions should trigger P1_TOO_MANY_NEW_NAMES");
  assert(Array.isArray(p1.detected_names) && p1.detected_names.length >= 3, "P1 must expose detected_names for debugging");
  assert(res.blocked === false, "P1 must remain non-blocking");
}
console.log("phase22d-result-alignment tests OK");
