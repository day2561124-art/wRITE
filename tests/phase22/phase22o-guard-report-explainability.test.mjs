import assert from "node:assert/strict";
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

function findP1(result) {
  return result.guard_report.find((entry) => entry.code === "P1_TOO_MANY_NEW_NAMES");
}

// Known current-arc names and short names with role suffixes must remain whitelisted.
{
  const candidate = [
    "朝日奈千夜與九逃在醫療後座確認九逃勝，裁定中止沒有改變。",
    "岬戶老師看了終端，槐野同學補上紀錄，梶浦同學和霧生同學在觀眾席外安靜等候。",
    "沙耶同學沒有插話，只提醒千夜明日複查前不要逞強。",
  ].join("\n");
  const result = evaluateCandidateAgainstAnchor(makeBundle(), candidate);
  assert.equal(findP1(result), undefined, "Known current-arc names must not trigger P1_TOO_MANY_NEW_NAMES");
  assert.equal(result.blocked, false, "Known current-arc names must not block the candidate");
}

// Explicit unknown-name introductions should still trigger non-blocking P1 and now include explainability details.
{
  const candidate = [
    "朝日奈千夜與九逃在醫療後座確認九逃勝，裁定中止沒有改變。",
    "新生名叫霧島澪，轉學生叫做白川遙，旁聽者代號是雨宮。",
    "青峰老師和黑川醫師被臨時叫進處置室。",
  ].join("\n");
  const result = evaluateCandidateAgainstAnchor(makeBundle(), candidate);
  const p1 = findP1(result);

  assert.ok(p1, "Explicit unknown-name introductions should trigger P1_TOO_MANY_NEW_NAMES");
  assert.equal(result.blocked, false, "P1 must remain non-blocking");
  assert.ok(Array.isArray(p1.detected_names), "P1 must preserve detected_names as a string[]");
  assert.ok(p1.detected_names.every((name) => typeof name === "string"), "detected_names entries must be strings");
  assert.ok(p1.detected_names.length >= 4, "P1 should include the detected unknown names");

  assert.ok(Array.isArray(p1.detected_name_details), "P1 must include detected_name_details");
  assert.ok(
    p1.detected_name_details.some((detail) => detail.reason === "explicit_introduction"),
    "detected_name_details must include explicit_introduction reasons",
  );
  assert.ok(
    p1.detected_name_details.some((detail) => detail.reason === "role_suffix"),
    "detected_name_details must include role_suffix reasons",
  );
  for (const detail of p1.detected_name_details) {
    assert.equal(typeof detail.name, "string", "detail.name must be a string");
    assert.equal(typeof detail.evidence, "string", "detail.evidence must be a string");
    assert.ok(detail.evidence.length > 0, "detail.evidence must not be empty");
    assert.equal(
      detail.whitelist_status,
      "not_in_known_name_whitelist",
      "detail.whitelist_status must explain whitelist filtering",
    );
  }
}

// P0 result alignment must remain unchanged: wrong locked-result rewrites still block.
{
  const candidate = "朝日奈千夜勝。九逃敗。這場比賽結果改寫為千夜勝。";
  const result = evaluateCandidateAgainstAnchor(makeBundle(), candidate);
  assert.ok(
    result.guard_report.some((entry) => entry.code === "P0_RESULT_CONFLICT"),
    "Wrong locked-result rewrite must still trigger P0_RESULT_CONFLICT",
  );
  assert.equal(result.blocked, true, "P0_RESULT_CONFLICT must still block the candidate");
}

console.log("Phase22O guard report explainability tests passed.");
