import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCharacterCommunicationActionCandidate,
} from "../../server/src/character-communication-foundation-service.mjs";
import {
  realizeCharacterCommunicationMandarin,
} from "../../server/src/character-communication-mandarin-realization-service.mjs";
import { validateCommunicationSurfaceRealization } from "../../server/src/world-simulation-causal-rule-engine.mjs";

const request = (semanticAnchor, clause) => ({
  schema_version: "cc5-mandarin-clause-request-v1",
  semantic_anchor: semanticAnchor,
  clause,
});

test("CC-5 realizes a bounded Mandarin SVO clause with aspect", () => {
  const semantic = "男孩已離開房子";
  const result = realizeCharacterCommunicationMandarin({
    external_action: "speech",
    message: { semantic_content: semantic, speech_act: "assert" },
    surface_realization_request: request(semantic, {
      subject: "男孩",
      predicate: "離開",
      aspect_particle: "了",
      object: "房子",
    }),
  });
  assert.equal(result.surface_text, "男孩離開了房子。");
  assert.equal(result.schema_version, "cc5-mandarin-clause-realization-v1");
  assert.equal(result.boundaries.lexical_choice_inferred, false);
  assert.equal(result.boundaries.classifier_inferred, false);
  assert.equal(result.boundaries.subject_omission_inferred, false);
  assert.equal(result.boundaries.model_generation_required, false);
});

test("CC-5 keeps modal before explicit negation and never guesses morphology", () => {
  const semantic = "他應該不去上學";
  const result = realizeCharacterCommunicationMandarin({
    external_action: "speech",
    message: { semantic_content: semantic, speech_act: "assert" },
    surface_realization_request: request(semantic, {
      subject: "他",
      modal: "應該",
      negation: "不",
      predicate: "去",
      object: "上學",
    }),
  });
  assert.equal(result.surface_text, "他應該不去上學。");
  assert.equal(result.clause_features.negation, "不");
});

test("CC-5 supports only explicit subject omission", () => {
  const semantic = "請先等等";
  const result = realizeCharacterCommunicationMandarin({
    external_action: "speech",
    message: { semantic_content: semantic, speech_act: "request" },
    surface_realization_request: request(semantic, {
      omit_subject: true,
      pre_predicate_modifiers: ["先"],
      predicate: "等等",
      sentence_final_particle: "吧",
    }),
  });
  assert.equal(result.surface_text, "先等等吧。");
  assert.equal(result.clause_features.subject_omitted_explicitly, true);

  assert.throws(() => realizeCharacterCommunicationMandarin({
    external_action: "speech",
    message: { semantic_content: semantic, speech_act: "request" },
    surface_realization_request: request(semantic, {
      predicate: "等等",
    }),
  }), { code: "CHARACTER_COMMUNICATION_MANDARIN_REALIZATION_INVALID" });
});

test("CC-5 query punctuation is derived only from explicit speech form", () => {
  const semantic = "那本書尚未看完";
  const result = realizeCharacterCommunicationMandarin({
    external_action: "speech",
    message: { semantic_content: semantic, speech_act: "indirect_query" },
    surface_realization_request: request(semantic, {
      subject: "你",
      pre_predicate_modifiers: ["還"],
      predicate: "要看",
      object: "那本書",
      sentence_final_particle: "嗎",
    }),
  });
  assert.equal(result.surface_text, "你還要看那本書嗎？");
});

test("CC-5 rejects a realization that is not bound to selected semantics", () => {
  assert.throws(() => realizeCharacterCommunicationMandarin({
    external_action: "speech",
    message: { semantic_content: "A", speech_act: "assert" },
    surface_realization_request: request("B", {
      subject: "我",
      predicate: "知道",
    }),
  }), { code: "CHARACTER_COMMUNICATION_MANDARIN_REALIZATION_INVALID" });
});

test("CC-5 candidate stays unrealized when speaker authored no surface plan", () => {
  const candidate = buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "告知",
        addressee: "B",
        mode: "direct",
        public_content: "今天下雨",
      },
    },
  });
  assert.equal(candidate.communication.surface_realization_complete, false);
  assert.equal(Object.hasOwn(candidate.communication, "surface_realization"), false);
});

test("CC-5 candidate carries only a validated public realization", () => {
  const semantic = "男孩已離開房子";
  const candidate = buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "告知",
        addressee: "B",
        mode: "direct",
        public_content: semantic,
        surface_realization: request(semantic, {
          subject: "男孩",
          predicate: "離開",
          aspect_particle: "了",
          object: "房子",
        }),
      },
    },
  });
  assert.equal(candidate.communication.surface_realization_complete, true);
  assert.equal(candidate.communication.surface_realization.surface_text, "男孩離開了房子。");
  assert.equal(candidate.communication.ir.modalities.speech.surface_realization_complete, false,
    "Semantic IR remains planning-only; observable surface is a separate bounded layer.");
});

test("CC-5 refuses exact withheld private content in the realized surface", () => {
  assert.throws(() => buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "挽留",
        addressee: "B",
        mode: "direct",
        private_content: "我很依戀 B",
        withhold_private_content: true,
        public_content: "請留下",
        surface_realization: request("請留下", {
          omit_subject: true,
          predicate: "我很依戀 B",
        }),
      },
    },
  }), { code: "CHARACTER_COMMUNICATION_MANDARIN_REALIZATION_INVALID" });
});

test("CC-5 World rejects tampered text, clause features and request independently", () => {
  const semantic = "男孩已離開房子";
  const candidate = buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: { communication_goal: {
      character: "A",
      purpose: "告知",
      addressee: "B",
      mode: "direct",
      public_content: semantic,
      surface_realization: request(semantic, {
        subject: "男孩",
        predicate: "離開",
        aspect_particle: "了",
        object: "房子",
      }),
    } },
  });
  const message = candidate.communication.message;
  const original = candidate.communication;
  const validate = (communication) =>
    validateCommunicationSurfaceRealization("A", candidate, communication, message);
  assert.equal(validate(original).ok, true);
  for (const mutate of [
    (value) => { value.surface_realization.surface_text = "他知道你的秘密。"; },
    (value) => { value.surface_realization.clause_features.negation = "不"; },
    (value) => { value.surface_realization.surface_request.clause.predicate = "知道"; },
    (value) => { value.surface_realization.semantic_anchor = "其他主張"; },
    (value) => { value.surface_realization.boundaries.world_truth_claimed = true; },
  ]) {
    const altered = structuredClone(original);
    mutate(altered);
    assert.equal(validate(altered).ok, false, "Altered realization must not reach World.");
  }
});

test("CC-5 surface realization cannot be attached to silence or nonverbal mode", () => {
  assert.throws(() => buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "示意",
        addressee: "B",
        mode: "nonverbal",
        nonverbal_signal: "點頭",
        surface_realization: request("點頭", {
          subject: "我",
          predicate: "點頭",
        }),
      },
    },
  }), { code: "CHARACTER_COMMUNICATION_FOUNDATION_INVALID" });
});
