import { hashAgentRunValue } from "./agent-run-service.mjs";
import { committedDescriptor, dialogueDescription, sameDescriptor } from "./observer-dialogue-description-service.mjs";
import { observerDialogueLearningVersion } from "./observer-dialogue-learning-service.mjs";
import { isDialoguePanelMemory, panelReadingContents } from "./observer-dialogue-panel-memory-service.mjs";

const list = value => Array.isArray(value) ? value : [];
const digitAlphabet = "零一二三四五六七八九";
const smallChinese = /^[一二兩三四五六七八九]?(?:十[一二三四五六七八九]?)?$/u;
const numberPattern = /^[0-9]{1,6}$/u;

function countdownSeconds(value, unit) {
  let amount = null;
  if (numberPattern.test(value)) amount = Number(value);
  else if (value && smallChinese.test(value)) {
    const numeric = char => char === "兩" ? 2 : digitAlphabet.indexOf(char);
    const [tens, ones] = value.split("十");
    amount = ones === undefined ? numeric(tens)
      : (tens ? numeric(tens) : 1) * 10 + (ones ? numeric(ones) : 0);
  }
  return amount > 0 ? amount * ({秒: 1, 分鐘: 60, 小時: 3600}[unit]) : null;
}

// Do not turn a running time, a minimum, or a negative statement into an upper limit.
function recalledCountdown(lesson) {
  if (typeof lesson !== "string" || lesson.length > 110) return null;
  const text = lesson.normalize("NFKC").trim();
  const matched = text.match(/^([\p{L}\p{N} ]{0,44}?)最多(?:能|可以)倒數([0-9一二兩三四五六七八九十]{1,6})[ ]?(秒|分鐘|小時)[。！!]?$/u);
  if (!matched || /(?:不|沒|未|剩|假|如果|至少|只要|以為|以前|原本)/u.test(matched[1])) return null;
  const seconds = countdownSeconds(matched[2], matched[3]);
  return seconds ? {duration: matched[2] + matched[3], seconds} : null;
}

function visibleDescriptor(label) {
  if (typeof label !== "string") return null;
  const mention = dialogueDescription(label);
  return mention?.mode === "reference" && mention.lead === label ? committedDescriptor(mention) : null;
}

// Only an explicitly public, currently legible panel can supply this path.
// Neither object specifications nor prose observations certify a panel reading.
export function visibleDialogueCountdownPanel({request, visibility}) {
  if (request?.kind !== "max_countdown" || !request.descriptor) return null;
  const clear = new Set(list(visibility?.clear_objects));
  const observations = list(visibility?.perception_visual_observations);
  const matches = list(visibility?.perceptual_object_bindings).filter(binding => {
    if (!clear.has(binding.object_id)) return false;
    const visible = observations.filter(item => item?.kind === "visible_object"
      && item.perceptual_object_ref === binding.perceptual_object_ref);
    return visible.length === 1 && sameDescriptor(visibleDescriptor(visible[0].perceptual_label), request.descriptor);
  });
  if (matches.length !== 1) return null;
  const binding = matches[0];
  const observed = observations.find(item => item?.kind === "visible_object"
    && item.perceptual_object_ref === binding.perceptual_object_ref);
  const position = observed.relative_position;
  if (observed.illumination_tier !== "clear" || observed.visibility_extent !== "full"
      || !Number.isFinite(position?.dx_m) || !Number.isFinite(position?.dy_m)) return null;
  const identity = hashAgentRunValue({kind: "countdown_limit_panel", object_id: binding.object_id});
  return {object_id: binding.object_id, identity, position};
}

export function projectDialogueCountdownDisplay({request, visibility, objects}) {
  const binding = visibleDialogueCountdownPanel({request, visibility});
  if (!binding || Math.hypot(binding.position.dx_m, binding.position.dy_m) > 2) return null;
  const object = objects && Object.hasOwn(objects, binding.object_id) ? objects[binding.object_id] : null;
  const panel = object?.public_runtime_display;
  const seconds = panel?.max_countdown_seconds;
  if (panel?.kind !== "countdown_limit_panel") return null;
  const reading = panelReadingContents(seconds);
  return reading ? {content: reading.content, duration: reading.duration, seconds,
    identity: binding.identity} : null;
}

export function planDialogueCountdownAnswer({character, target, request, display, cognition, retrieval, memories, historicalPanel}) {
  if (!target || target.observer !== character || target.partner !== request?.speaker || request?.kind !== "max_countdown") return null;
  function goal(content, clause, source) {
    return {
      character, purpose: "回答倒數時間", addressee: target.partner, mode: "direct",
      communication_opportunity: "respond", public_content: content,
      ...(source ? {claim_kind: "uncertain_hypothesis", claim_source_kind: source}
        : {unresolved_question_followup: true}),
      surface_realization: {schema_version: "cc5-mandarin-clause-request-v1",
        semantic_anchor: content, clause: source ? clause : {...clause, punctuation: "。"}},
    };
  }
  if (display && list(cognition?.perception?.observed).slice(0, 32).includes(display.content)) {
    return goal(display.content, {topic: "我看了一下面板", omit_subject: true,
      predicate: "最多能倒數", object: display.duration}, "current_perception");
  }

  const fragments = list(retrieval?.recovered_fragments);
  const fragment = fragments.length === 1 ? fragments[0] : null;
  const grounding = fragment?.content_grounding;
  const working = cognition?.working_context;
  const admitted = [working?.focus, ...list(working?.active_context)].some(item =>
    item?.context_origin === "recovered_memory" && item.content === fragment?.content
      && !item.possibly_incorrect && !item.source_confused);
  const recovered = admitted && grounding?.materialized_by_kernel === true
    && grounding.source_memory_ref === fragment.source_memory_ref
    && grounding.selector?.kind === "json_pointer" && grounding.selector.path === "/lesson";
  if (historicalPanel) {
    if (historicalPanel.memory_id && recovered && historicalPanel.memory_id === fragment.source_memory_ref
        && historicalPanel.lesson === fragment.content) {
      return goal(fragment.content, {topic: "我上次看面板時", subject: "上限", predicate: "是",
        object: historicalPanel.duration}, "retrieved_memory");
    }
    return goal("我不確定，得再查一下。", {topic: "我不確定", omit_subject: true, predicate: "得再查一下"}, null);
  }
  const evidence = list(memories).filter(record =>
    record?.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion
      && record.content?.referent_id === request.referent && record.content?.detail_type === "runtime"
      && !isDialoguePanelMemory(record) && !record.source_confused && !record.possibly_incorrect);
  // The frontier can contain just one of several contradictory memories.
  // Other committed records may only veto this reply, never supply its content.
  const distinctSeconds = new Set(evidence.map(record => recalledCountdown(record.content.lesson)?.seconds).filter(Boolean));
  const source = fragment && evidence.find(record => record.memory_id === fragment.source_memory_ref);
  const recalled = recalledCountdown(fragment?.content);
  const sourceChannel = source?.internal_provenance?.dialogue_source_channel;
  if (recalled && distinctSeconds.size === 1 && recovered && source?.content.lesson === fragment.content) {
    const auditory = ["heard_text", "understood_testimony"].includes(sourceChannel);
    return goal(fragment.content, {omit_subject: true, ...(request.from_correction ? {topic: "喔"} : {}),
      pre_predicate_modifiers: [auditory ? "我記得有人說" : "我記得"],
      predicate: "最多能倒數", object: recalled.duration}, "retrieved_memory");
  }
  // No unadmitted candidates or hidden values in a simple uncertain reply.
  return goal("我不確定，得再查一下。", {topic: "我不確定", omit_subject: true, predicate: "得再查一下"}, null);
}
