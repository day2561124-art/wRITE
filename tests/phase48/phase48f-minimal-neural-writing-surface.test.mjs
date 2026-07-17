import assert from "node:assert/strict";
import {
  runFinalPolisherEditorialBrain,
} from "../../server/src/final-polisher-editorial-service.mjs";
import {
  evaluateCandidateAgainstAnchor,
} from "../../server/src/chapter-anchor-guard.mjs";

function hasIssueCode(value, expectedCode) {
  const visited = new Set();
  const pending = [value];

  while (pending.length > 0) {
    const current = pending.pop();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (current.code === expectedCode) {
      return true;
    }

    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }

    pending.push(...Object.values(current));
  }

  return false;
}

const minimal = runFinalPolisherEditorialBrain({
  raw_draft_text:
    "# Candidate\\n\\n戰鬥開始。真正的風暴才剛開始。",
});

assert.equal(minimal.status, "completed");
assert.equal(minimal.needs_structural_revision, false);
assert.equal(minimal.suggested_return_stage, null);
assert(minimal.polished_text.includes("真正的風暴才剛開始"));
assert(
  !minimal.revision_report.risk_flags.includes(
    "ending_hook_is_pretty_sentence_only",
  ),
);
assert(
  !minimal.revision_report.risk_flags.includes(
    "battle_payment_insufficient",
  ),
);

const directEmotion = runFinalPolisherEditorialBrain({
  raw_draft_text: "# Candidate\\n\\n她很難過，但沒有解釋。",
});

assert.equal(directEmotion.status, "completed");
assert(
  !directEmotion.revision_report.risk_flags.includes(
    "emotion_over_named",
  ),
);

const originalExpression = runFinalPolisherEditorialBrain({
  raw_draft_text:
    "# Candidate\\n\\n她感受到一種難以言喻的壓迫感在胸口蔓延。",
});

assert(originalExpression.polished_text.includes("難以言喻的壓迫感"));
assert(!originalExpression.polished_text.includes("胸口悶了一下"));

const explicitCanonClaim = runFinalPolisherEditorialBrain({
  raw_draft_text:
    "# Candidate\n\n這一章正式設定為千夜新增能力為絕對支配。故事結束。",
});

assert.equal(
  explicitCanonClaim.status,
  "needs_structural_revision",
);
assert.equal(
  explicitCanonClaim.needs_structural_revision,
  true,
);
assert.equal(
  explicitCanonClaim.suggested_return_stage,
  "writing_card_director",
);
assert(
  explicitCanonClaim.revision_report.risk_flags.includes(
    "unauthorized_new_canon_claim",
  ),
);

const explicitBlock = runFinalPolisherEditorialBrain({
  raw_draft_text: "# Candidate\\n\\n她推開門。",
  structural_signals: {
    block_reasons: ["unauthorized_new_canon_claim"],
  },
});

assert.equal(explicitBlock.status, "needs_structural_revision");
assert.equal(explicitBlock.needs_structural_revision, true);

const requiredNightBundle = {
  anchor_confidence: "high",
  content: {
    chapter_anchor: {
      required_core_characters: ["夜"],
      forbidden_characters: [],
    },
  },
};

const falseRequiredMention = evaluateCandidateAgainstAnchor(
  requiredNightBundle,
  "千夜沿著走廊離開。昨夜的雨直到深夜才停。",
);

assert(
  hasIssueCode(falseRequiredMention, "P0_WRONG_CORE_CAST"),
);

const actualRequiredMention = evaluateCandidateAgainstAnchor(
  requiredNightBundle,
  "夜抬起手，示意所有人停下。",
);

assert(
  !hasIssueCode(actualRequiredMention, "P0_WRONG_CORE_CAST"),
);

const forbiddenNightBundle = {
  anchor_confidence: "low",
  content: {
    chapter_anchor: {
      required_core_characters: [],
      forbidden_characters: ["夜"],
    },
  },
};

const falseForbiddenMention = evaluateCandidateAgainstAnchor(
  forbiddenNightBundle,
  "夜星看向千夜，窗外已是深夜。",
);

assert(
  !hasIssueCode(falseForbiddenMention, "P0_FORBIDDEN_CHARACTER"),
);

const actualForbiddenMention = evaluateCandidateAgainstAnchor(
  forbiddenNightBundle,
  "「夜，停下。」",
);

assert(
  hasIssueCode(actualForbiddenMention, "P0_FORBIDDEN_CHARACTER"),
);

console.log(
  "Phase48F minimal neural writing surface batch 1 tests passed.",
);
