import { hashAgentRunValue } from "./agent-run-service.mjs";
import { committedDescriptor, dialogueClarificationFragment, dialogueDescriptorQuery,
  dialogueDescription, matchesDescriptor, namedByDescription, sameDescriptor } from "./observer-dialogue-description-service.mjs";
import { dialogueClarificationQuestion } from "./observer-dialogue-clarification-service.mjs";
import { isDialoguePanelMemory } from "./observer-dialogue-panel-memory-service.mjs";
import { findTestimonyRetraction, revisedTestimonyBody, singleUncontestedTestimony } from "./observer-dialogue-testimony-revision-service.mjs";

export const observerDialogueLearningVersion = "observer-dialogue-learning-v1";
export function learnedDialogueLineageHash(record) {
  if (record?.internal_provenance?.dialogue_learning_version !== observerDialogueLearningVersion) return null;
  // Recall changes derived usage counters, not the original experience.
  const {retrieval_history, retrieval_history_legacy_baseline, recall_count, last_recalled_at, ...source} = record;
  return hashAgentRunValue(source);
}
export function dialogueMemoriesCanCompete(left, right) {
  const leftLearned = left?.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion;
  const rightLearned = right?.internal_provenance?.dialogue_learning_version === observerDialogueLearningVersion;
  if (!leftLearned && !rightLearned) return true;
  return leftLearned && rightLearned && Boolean(left.content?.detail_type && left.content?.referent_id)
    && left.content.referent_id === right.content?.referent_id
    && left.content.detail_type === right.content?.detail_type;
}
const activeTopic = "learned_dialogue";
const unique = list => [...new Set(list)];
const normalize = value => value.normalize("NFKC").trim().toLocaleLowerCase("zh-Hant-TW");
const intro = /^(?:這|那)(?:個|具|台|支|顆|款|套|只)[\p{L}\p{N} ]{0,18}(?:叫做?|名叫|名字是|稱作)[「『“"]([^」』”"]{2,32})[」』”"]/u;
const createsSecond = /另一(?:個|具|台|支|顆|款|套|只)|同名|也叫同一個名字/u;
const uncertainty = /(?:如果|假如|聽說|可能|也許|據說|不確定|聽不清|有人說|好像|我記得|印象中|我猜|大概|多半|不一定|估計|恐怕|我以為|原以為)/u;
const question = /[？?]|(?:嗎|呢)(?:[。！!]?)$|(?:幾|多少|多久|在哪|什麼時候|哪種|哪個|哪一?[台臺支件]|能不能|可不可以|有沒有)/u;
const defer = /(?:暫且|暫時|先)(?:別|不要|不)(?:談|聊|看|查|提)|先(?:放著|擱著|放一邊)|(?:不是|不在).{0,9}(?:要談|重點|範圍)|(?:晚點|等一下|稍後).{0,5}再/u;
const resume = /(?:回到|說回|談回|重提)(?:剛才|先前|方才|之前)(?:那(?:個|件|項)|的話題)/u;
const aliasClause = /^(?:(?:我們|大家|平常)?也?可以叫它|(?:我們|大家|平常)?也叫它|它也叫|簡稱)[「『“"]([^」』”"]{2,24})[」』”"]/u;
const nameShape = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,31}$/u;
const factTypes = [
  ["runtime", /(?:運作|續航|撐|跑|運轉|倒數|計時|開機|能用).{0,10}(?:秒|分鐘|小時|鐘頭)|(?:能用|運作|倒數|續航|計時|還能).{0,12}(?:多久|多長時間)/u],
  ["location", /(?:放在|放進|收在|收進|掛在|擺在|留在|位於|在哪|怎麼找)/u],
  ["power", /(?:額定|充電|插電|接電|供電|電量|電池|幾伏)/u],
  ["constraint", /(?:只能|不能|不可|必須|要先|適合|不適用|限制)/u],
];
function field(text) {
  const matches = factTypes.filter(([, pattern]) => pattern.test(text));
  return matches[0]?.[0] ?? null;
}
const dialogueClauses = text => text.split(/(?<=[。！？!?；;])|[，,\n]/u).map(value => value.trim()).filter(Boolean);
function requestedField(text) {
  const fields = unique(dialogueClauses(text).filter(clause => question.test(clause)).map(field));
  return fields.length === 1 ? fields[0] : null;
}

function answerKind(text) {
  const clauses = dialogueClauses(text).filter(clause => question.test(clause));
  return clauses.length === 1 && !/(?:已經|剩|還能|不能|不是|如果|假如|可否|能不能|以前)/u.test(clauses[0])
    && /(?:能|可以|最多)倒數(?:多久|多長時間|幾(?:秒|分鐘|小時))/u.test(clauses[0]) ? "max_countdown"
    : clauses.length === 1 && field(clauses[0]) === "location"
      && /(?:在哪(?:裡|裏)?|放在哪(?:裡|裏)?)/u.test(clauses[0]) ? "object_location" : null;
}

function permittedName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return nameShape.test(name) ? name : null;
}

export function observerLearningObservations(perception, character, verifiedReceiptHashes = []) {
  const out = [];
  const receipts = new Set(verifiedReceiptHashes);
  for (const [sense, values] of [["visual", perception?.observed], ["auditory", perception?.audible]]) {
    if (!Array.isArray(values)) continue;
    for (const [index, observed] of values.slice(0, 48).entries()) {
      const receiptHash = sense === "auditory" && observed?.kind === "understood_utterance"
        && observed.schema_version === "cc2-listener-understood-utterance-v1"
        && observed.observer === character && observed.speech_content_intelligible === true
        && observed.speaker_identity_recognized === true && observed.public_event_committed === true
        && observed.world_truth_claimed === false ? hashAgentRunValue(observed) : null;
      const receipt = receiptHash !== null && receipts.has(receiptHash);
      // Plain visual or audible text is a subjective observation. A typed
      // speech object is usable only through the listener's own receipt.
      const text = typeof observed === "string" ? observed : receipt ? observed.semantic_content : null;
      if (typeof text === "string" && text.trim() && text.length <= 1000) {
        out.push({sense, index, text, channel: receipt ? "understood_testimony"
          : sense === "auditory" ? "heard_text" : "observed_text",
        ...(receipt ? {receipt_hash: receiptHash} : {}),
        ...(receipt && typeof observed.speaker === "string" && observed.speaker.length <= 240
          && observed.speaker.trim() && observed.speaker !== character ? {speaker: observed.speaker} : {})});
      }
    }
  }
  return out;
}

function localRegistry(memories) {
  const records = new Map();
  for (const memory of Array.isArray(memories) ? memories : []) {
    if (memory?.internal_provenance?.dialogue_learning_version !== observerDialogueLearningVersion) continue;
    const c = memory.content;
    if (!/^learned_[a-f0-9]{24}$/u.test(c?.referent_id ?? "")) continue;
    const descriptor = committedDescriptor(c.referent_description);
    const name = permittedName(c.referent_name);
    if (!name && !descriptor) continue;
    const id = c.referent_id;
    const entry = records.get(id) ?? {id, name: null, aliases: [], descriptor: null, collision: false};
    entry.name = name ?? entry.name;
    entry.descriptor = entry.descriptor ?? descriptor;
    entry.collision ||= c.referent_description_collision === true;
    entry.aliases = unique([...entry.aliases, ...(Array.isArray(c.referent_aliases) ? c.referent_aliases : [])
      .map(permittedName).filter(Boolean)]).slice(0, 8);
    records.set(id, entry);
  }
  return records;
}

export function observerDialogueReferentDescriptor(memories, referent) {
  const entry = localRegistry(memories).get(referent);
  return entry && !entry.collision ? entry.descriptor : null;
}

// A substring of a different name is not evidence that this referent was
// mentioned. Quoted names are literal; unquoted names must end at a clause
// boundary or a known Mandarin grammatical connector, not an arbitrary suffix.
const quotedName = /「([^」]*)」|『([^』]*)』|“([^”]*)”|"([^"]*)"/gu;
const nameCharacter = /^[\p{L}\p{M}\p{N}_-]/u;
const nameCharacterEnd = /[\p{L}\p{M}\p{N}_-]$/u;
const startsAfter = /(?:和|跟|與|或|以及|或者|還有|不是|而非|請問|問一下|想知道|我猜|我以為|大概|恐怕|問的是|指的是|是指|至於|關於|也許|可能|假如|聽說|據說|如果|認為|看到|拿出|找到|看一下|那台|這台|那個|這個|那支|這支)$/u;
const endsBefore = /^(?:的|是|不|沒|嗎|呢|吧|啊|呀|了|最[多少]|至少|還|可以|不可|可否|能|會|要|得|放|收|擺|掛|留|位於|在|在哪|用|開機|運作|運轉|啟動|倒數|計時|續航|電量|電池|額定|充電|供電|限制|先|現在|目前|只能|必須|適合|還有|和|跟|與|或|以及|哪|幾|多少|多久|先前|原本)/u;
const isLeftBoundary = text => !nameCharacterEnd.test(text.trimEnd()) || startsAfter.test(text.trimEnd());
const isRightBoundary = text => !nameCharacter.test(text.trimStart()) || endsBefore.test(text.trimStart());

function nameMentions(text, registry) {
  const value = normalize(text);
  const names = [...registry.values()].flatMap(entry => [entry.name, ...entry.aliases]
    .filter(Boolean).map(name => ({entry, name: normalize(name)})));
  const quoted = [...value.matchAll(quotedName)].map(hit => ({
    start: hit.index, end: hit.index + hit[0].length, value: hit.slice(1).find(field => field !== undefined)?.trim(),
  }));
  const found = [];
  let unidentified = false;
  for (const token of quoted) {
    const exact = names.filter(item => item.name === token.value);
    for (const {entry} of exact) found.push({...token, entry});
    // A quoted subject before a fact or question is an explicit name, even
    // when it has never been learned. Quoted values elsewhere are not subjects.
    if (!exact.length && permittedName(token.value)
        && isLeftBoundary(value.slice(0, token.start))
        && endsBefore.test(value.slice(token.end).trimStart())
        && (field(value.slice(token.end)) || question.test(value.slice(token.end)))) unidentified = true;
  }
  for (const {entry, name} of names) {
    for (let start = value.indexOf(name); start !== -1; start = value.indexOf(name, start + name.length)) {
      const end = start + name.length;
      if (quoted.some(token => token.start < end && start < token.end)) continue;
      if (!isLeftBoundary(value.slice(0, start))) continue;
      if (isRightBoundary(value.slice(end))) found.push({start, end, entry});
      else if (!names.some(other => other.name.length > name.length && other.name.startsWith(name)
        && value.startsWith(other.name, start) && isRightBoundary(value.slice(start + other.name.length)))) {
        unidentified = true;
      }
    }
  }
  const longest = found.filter(hit => !found.some(other => other.start <= hit.start && other.end >= hit.end
    && (other.start < hit.start || other.end > hit.end)));
  return {entries: [...new Map(longest.map(hit => [hit.entry.id, hit.entry])).values()], unidentified};
}

const byMention = (text, registry) => nameMentions(text, registry).entries;

function statementFor(clause) {
  const text = clause.trim();
  if (!text || question.test(text) || defer.test(text) || uncertainty.test(text)) return null;
  const detailType = field(text);
  return detailType ? {lesson: text, detail_type: detailType} : null;
}

const focusOn = (referent, evidence) => ({mode: "focus", topic: activeTopic, referent, evidence});
const sourceKey = source => source.sense + ":" + source.index;
const provisionalEntry = (character, descriptor) => ({
  id: "learned_" + hashAgentRunValue({character, description: descriptor}).slice(0, 24),
  name: null, aliases: [], descriptor,
});

function descriptiveBinding(source, entry, detail, collision = false) {
  return {
    source, referent_id: entry.id, referent_name: entry.name,
    referent_aliases: entry.aliases, referent_description: entry.descriptor,
    ...(collision ? {referent_description_collision: true} : {}),
    detail,
  };
}

function analyzeDescriptiveSource({character, source, lines, registry, named, previousReferent}) {
  const entries = [...registry.values()];
  const mentions = lines.map(line => ({line, mention: dialogueDescription(line)}))
    .filter(({mention}) => mention && (mention.anchor || mention.color
      || entries.some(entry => entry.descriptor?.kind === mention.kind)));
  // Bare kind terms (e.g. a disclosed name "計時器") must not eclipse
  // an independently resolved proper name.
  if (!mentions.length || (named.length && mentions.every(({mention}) => !mention.anchor && !mention.color))) return null;
  const {text} = source;
  const request = question.test(text);
  const unclear = (reason, pending) => ({unclear: true, ...(request ? {clarification: {
    evidence: text, reason, speaker: source.speaker ?? null, receipt_hash: source.receipt_hash ?? null,
    ...(pending ? {request: pending} : {}),
  }} : {})});
  if (uncertainty.test(text) || /(?:不是|而非|除了|或是|或者|以及|加上|還有|連同|與|和|跟).{0,16}(?:這|那|台|臺|支|個|具|色|盒|計時器)/u.test(text)) {
    return unclear("unsupported_or_multiple_descriptions");
  }
  if (mentions.length !== 1) return unclear("multiple_descriptions");
  const [{line, mention}] = mentions;
  const exact = committedDescriptor(mention);
  const matches = entries.filter(entry => matchesDescriptor(entry.descriptor, mention));
  if (mention.mode === "collision") {
    // This does not make the prior individual cease to exist. It only
    // invalidates what this description alone can identify in future turns.
    const known = matches.find(entry => sameDescriptor(entry.descriptor, exact));
    return {...unclear("duplicate_description"), collisions: request || !exact || known?.collision ? []
      : [descriptiveBinding(source, known ?? provisionalEntry(character, exact), null, true)]};
  }
  if (mention.mode === "appearance") {
    if (!exact || request || named.length || matches.length || createsSecond.test(text)) return unclear("unconfirmed_identity");
    const entry = provisionalEntry(character, exact);
    const details = lines.filter(item => item !== line && /^它(?:最|還|能|可|只|不|現在|目前|放|收|要|必)/u.test(item))
      .map(statementFor).filter(Boolean);
    if (field(line.slice(mention.lead.length))) {
      const sameClauseDetail = statementFor(line);
      if (sameClauseDetail) details.unshift(sameClauseDetail);
    }
    return {scope: focusOn(entry.id, text), binding: descriptiveBinding(source, entry, details.length === 1 ? details[0] : null)};
  }
  if (matches.length !== 1 || matches[0].collision) {
    const request_field = requestedField(text);
    const request_descriptor = dialogueDescriptorQuery(mention);
    const pending = matches.length >= 2 && matches.length <= 8 && request_field && request_descriptor
      ? {request_field, request_descriptor, referents: matches.map(entry => entry.id).sort(),
        answer_kind: answerKind(text)} : null;
    return unclear(matches.length ? "multiple_matching_objects" : "unrecognized_description", pending);
  }
  const entry = matches[0];
  if (mention.color && !entry.descriptor.color) return unclear("unrecognized_description");
  if (named.some(item => item.id !== entry.id)) return unclear("conflicting_identity_evidence");
  if (defer.test(text)) {
    return {scope: entry.id === previousReferent
      ? {mode: "shift", referent: entry.id, evidence: text, excluded_referents: [entry.id]} : null};
  }
  const declared = namedByDescription(line, mention);
  const newName = !request && sameDescriptor(entry.descriptor, exact) ? permittedName(declared) : null;
  if (declared && (!newName || (entry.name && normalize(entry.name) !== normalize(newName))
      || entries.some(other => other.id !== entry.id && [other.name, ...other.aliases].filter(Boolean)
        .some(name => normalize(name) === normalize(newName))))) return unclear("unconfirmed_name_link");
  const scope = focusOn(entry.id, text);
  const details = lines.filter(item => (item === line && !declared)
    || (item !== line && Boolean(newName) && /^它(?:最|還|能|可|只|不|現在|目前|放|收|要|必)/u.test(item)))
    .map(statementFor).filter(Boolean);
  // Partial descriptions may guide a recall, but must not permanently
  // attach a new assertion about a potentially different individual.
  return {scope, binding: !request && sameDescriptor(entry.descriptor, exact)
    && (newName || details.length === 1)
    ? descriptiveBinding(source, {...entry, name: newName ?? entry.name}, details.length === 1 ? details[0] : null)
    : null};
}

// A full directed correction can complete a recent question without
// becoming a fact/assertion about the corrected object.
function resolveNamedCorrection(reply, sources, registry) {
  if (reply?.request_field !== "runtime" || reply.answer_kind !== "max_countdown") return null;
  const received = sources.filter(item => item.receipt_hash === reply.receipt_hash);
  if (received.length !== 1 || uncertainty.test(received[0].text)) return null;
  const text = received[0].text.normalize("NFKC").trim();
  const match = /^(?:(?:不是|不對)[,，]\s*)?(?:(?:我)?(?:說|指|問)的是)\s*(.+?)[。！!]?$/u.exec(text);
  if (!match) return null;
  const supplied = match[1].trim();
  const quoted = /^(?:「([^」]+)」|『([^』]+)』|“([^”]+)”|"([^"]+)")$/u.exec(supplied);
  const name = permittedName(quoted ? quoted.slice(1).find(value => value !== undefined) : supplied);
  if (!name) return null;
  const entries = [...registry.values()].filter(entry => [entry.name, ...entry.aliases]
    .some(value => value && normalize(value) === normalize(name)));
  if (entries.length !== 1) return null;
  return {scope: focusOn(entries[0].id, received[0].text), field: reply.request_field, answer_kind: reply.answer_kind,
    from_correction: true};
}

export const isDialogueCountdownQuestion = text => typeof text === "string" && answerKind(text) === "max_countdown";

function resolveClarificationFragment(reply, sources, registry) {
  if (!reply || !factTypes.some(([name]) => name === reply.request_field)) return null;
  const descriptor = dialogueDescriptorQuery(reply.request_descriptor);
  if (!descriptor || !Array.isArray(reply.referents) || reply.referents.length < 2 || reply.referents.length > 8) return null;
  const candidates = [...registry.values()].filter(entry => matchesDescriptor(entry.descriptor, descriptor));
  if (candidates.length !== reply.referents.length || candidates.some(entry => !reply.referents.includes(entry.id))) return null;
  const received = sources.filter(source => source.receipt_hash === reply.receipt_hash);
  if (received.length !== 1 || uncertainty.test(received[0].text) || question.test(received[0].text)) return null;
  const fragment = dialogueClarificationFragment(received[0].text);
  if (!fragment) return null;
  const matches = fragment.anchor || fragment.color
    ? candidates.filter(({descriptor: known}) => (!fragment.anchor || fragment.anchor === known.anchor)
      && (!fragment.kind || fragment.kind === known.kind)
      && (!fragment.color || !known.color || fragment.color === known.color))
    : candidates.filter(entry => [entry.name, ...entry.aliases].some(name => name && normalize(name) === normalize(fragment.text)));
  if (matches.length !== 1) return null;
  const [selected] = matches;
  if ((fragment.anchor || fragment.color) && (selected.collision || fragment.color && !selected.descriptor.color)) return null;
  return {scope: focusOn(selected.id, received[0].text), field: reply.request_field, answer_kind: reply.answer_kind,
    identifies_current_location: fragment.anchor != null && fragment.anchor === selected.descriptor.anchor};
}

// The registry is derived from committed same-observer memories, never global
// objects or the text of another character. A candidate binding is ephemeral.
export function analyzeObserverDialogueLearning({
  character, perception, memories, previousReferent, pausedReferent, verifiedReceiptHashes, clarificationReply,
  allowDialogueContinuation, answerCorrection,
}) {
  const sources = observerLearningObservations(perception, character, verifiedReceiptHashes);
  const registry = localRegistry(memories);
  const found = [];
  const bindings = new Map();
  const collisionBindings = new Map();
  const clarifications = [];
  let ambiguous = false;
  let unresolvedDescription = false;
  const inheritedQuestions = new Set();
  for (const source of sources) {
    const {text} = source;
    const namedMatch = nameMentions(text, registry);
    const named = namedMatch.entries;
    const lines = dialogueClauses(text);
    const described = analyzeDescriptiveSource({character, source, lines, registry, named, previousReferent});
    if (described) {
      if (described.scope) found.push(described.scope);
      if (described.binding) bindings.set(sourceKey(source), described.binding);
      // One experience has one binding. With a less specific collision
      // statement we ask for clarification instead of rewriting many entries.
      if (described.collisions?.length === 1) collisionBindings.set(sourceKey(source), described.collisions[0]);
      if (described.clarification) clarifications.push(described.clarification);
      ambiguous ||= described.unclear === true;
      unresolvedDescription ||= described.unclear === true;
      continue;
    }
    const introductions = lines.map(line => ({line, match: line.match(intro)})).filter(x => x.match);
    if (named.length > 1 || introductions.length > 1
        || (createsSecond.test(text) && (named.length || introductions.length))) {
      ambiguous = true;
      continue;
    }
    const introduction = introductions[0] ?? null;
    if (introduction && (question.test(introduction.line) || uncertainty.test(introduction.line))) continue;
    const introducedName = introduction ? permittedName(introduction.match[1]) : null;
    const existingSameName = introducedName ? [...registry.values()]
      .find(entry => entry.name && normalize(entry.name) === normalize(introducedName)) : null;
    if (introducedName && named.some(entry => entry.id !== existingSameName?.id)) {
      ambiguous = true;
      continue;
    }
    const previous = registry.get(previousReferent);
    // A nameless turn may only carry a verified conversational referent.
    // An explicit introduction, name or description remains usable across
    // partners and scenes. Refusing a binding is not a ban on speculative talk.
    const bareQuestion = /^(?:那[，,\s]*)?(?:它|那(?:個|台|臺|支|顆|套)|這(?:個|台|臺|支|顆|套))(?:呢[？?。]?|[？?])$/u
      .test(text.trim());
    const pronoun = !introducedName && !named.length && question.test(text)
      && (bareQuestion || /^(?:那[，,\s]*)?(?:那(?:個|台|臺|支|顆|套)|這(?:個|台|臺|支|顆|套)|它)[\s，,]*(?:還|能|可以|在哪|要|可不可以|多久|放)/u.test(text));
    const wantsResume = !introducedName && !named.length && resume.test(text);
    const candidate = pronoun ? previous : wantsResume ? registry.get(pausedReferent) : null;
    const continuity = candidate && typeof allowDialogueContinuation === "function"
      && allowDialogueContinuation(source, candidate.id, wantsResume ? "paused" : "focused", bareQuestion);
    if (continuity && bareQuestion) inheritedQuestions.add(text);
    if ((!introducedName && namedMatch.unidentified) || ((pronoun || wantsResume) && !continuity)) {
      ambiguous = true;
      unresolvedDescription = true;
      if (question.test(text)) clarifications.push({
        evidence: text, reason: namedMatch.unidentified ? "unrecognized_name" : "unconfirmed_dialogue_thread",
        speaker: source.speaker ?? null, receipt_hash: source.receipt_hash ?? null,
      });
      continue;
    }
    const current = introducedName
      ? existingSameName ?? {id: "learned_" + hashAgentRunValue({character, name: normalize(introducedName)}).slice(0, 24),
        name: introducedName, aliases: []}
      : named[0] ?? (continuity ? candidate : null);
    if (defer.test(text)) {
      const blocked = named[0] ?? (/^(?:它|那(?:個|台|支|顆|套)|這(?:個|台|支|顆|套))/u.test(text) ? previous : null);
      if (blocked?.id === previous?.id && blocked) {
        found.push({mode: "shift", referent: blocked.id, evidence: text, excluded_referents: [blocked.id]});
      }
      continue;
    }
    if (!current) continue;
    found.push(focusOn(current.id, text));
    if (continuity) continue;
    const tentative = uncertainty.test(text);
    const aliases = tentative ? [] : lines.map(line => line.match(aliasClause))
      .map(match => permittedName(match?.[1])).filter(Boolean)
      .filter(alias => ![...registry.values()].some(entry => entry.id !== current.id
        && [entry.name, ...entry.aliases].filter(Boolean).some(name => normalize(name) === normalize(alias))));
    const introducedNames = [{...current, aliases: unique([...current.aliases, ...aliases])}];
    const details = tentative ? [] : lines.filter(line => !line.match(intro) && !line.match(aliasClause))
      .filter(line => byMention(line, registry).some(entry => entry.id === current.id)
        || (introducedName !== null && (/^(?:它|這[個台支顆套])/u.test(line)
          || byMention(line, introducedNames).length > 0)))
      .map(statementFor).filter(Boolean);
    if (!introducedName && !aliases.length && details.length !== 1) continue;
    const detail = details.length === 1 ? details[0] : null;
    const retraction = detail && revisedTestimonyBody(source.text) ? findTestimonyRetraction({
      source, memories, referent: current.id, detail,
    }) : null;
    bindings.set(sourceKey(source), {
      source, referent_id: current.id, referent_name: current.name,
      referent_aliases: unique([...current.aliases, ...aliases]).slice(0, 8),
      detail,
      ...(retraction ? {retracts_memory_id: retraction} : {}),
    });
  }
  const multiObject = new Set(found.map(result => result.mode + ":" + result.referent)).size > 1;
  const ordinaryScope = ambiguous || multiObject ? {mode: "ambiguous"} : found[0] ?? null;
  const inheritedQuestion = ordinaryScope?.mode === "focus" && inheritedQuestions.has(ordinaryScope.evidence);
  const ordinaryField = inheritedQuestion ? "runtime" : ordinaryScope?.mode === "focus" ? requestedField(ordinaryScope.evidence) : null;
  const fragment = !ambiguous && !multiObject && !ordinaryField && bindings.size === 0
    ? resolveClarificationFragment(clarificationReply, sources, registry)
      ?? resolveNamedCorrection(answerCorrection, sources, registry) : null;
  const confirmed = fragment && (!ordinaryScope
    || (ordinaryScope.mode === "focus" && ordinaryScope.referent === fragment.scope.referent)) ? fragment : null;
  const scope = confirmed?.scope ?? ordinaryScope;
  const answer = confirmed ? confirmed.answer_kind
    : inheritedQuestion ? "max_countdown" : scope?.mode === "focus" ? answerKind(scope.evidence) : null;
  const speakers = answer ? sources.filter(source => source.text === scope?.evidence && source.speaker && source.receipt_hash) : [];
  const entry = registry.get(scope?.referent);
  const currentDescription = answer && entry && !entry.collision
    && (confirmed ? confirmed.identifies_current_location
      : dialogueClauses(scope.evidence).some(clause => question.test(clause)
        && sameDescriptor(dialogueDescription(clause), entry.descriptor))) ? entry.descriptor : null;
  return {
    sources,
    scope,
    request_field: confirmed?.field ?? ordinaryField,
    answer_request: ["max_countdown", "object_location"].includes(answer) && entry && speakers.length === 1
      ? {kind: answer, referent: entry.id, descriptor: currentDescription,
        remembered_descriptor: entry.descriptor, referent_collision: entry.collision,
        speaker: speakers[0].speaker, receipt_hash: speakers[0].receipt_hash,
        ...(confirmed?.from_correction ? {from_correction: true} : {})} : null,
    unresolved_description: unresolvedDescription,
    clarification: clarifications.length === 1 && !found.length ? clarifications[0] : null,
    bindings: ambiguous || multiObject ? collisionBindings : bindings,
  };
}

export function observerDialogueClarification(analysis) {
  if (!analysis?.clarification) return null;
  const {speaker, reason} = analysis.clarification;
  // Do not repeat private remembered descriptions to another character.
  return {reason, speaker, question: dialogueClarificationQuestion,
    action_selection_required: true, world_truth_claimed: false};
}

export function observerDialogueClarificationGoal(character, clarification) {
  if (!clarification?.speaker || !clarification.question) return null;
  return {
    character, purpose: "釐清所指物品", addressee: clarification.speaker, mode: "direct",
    public_content: clarification.question,
    surface_realization: {schema_version: "cc5-mandarin-clause-request-v1",
      semantic_anchor: clarification.question,
      clause: {subject: "你", predicate: "指的是", object: "哪一件", punctuation: "？"}},
  };
}

export function learnedDialogueMemoryStage(view) {
  if (view.stage === "initiation") {
    return view.request_field && view.conversation_referent?.startsWith("learned_") && view.initial_frontier.candidate_count > 0
      ? {process_occurred: true, initiation: {mode: "spontaneous", trigger_origin: "environmental_cue"},
        retrieval_task: {mode: "associative_recall"}, target: null}
      : {process_occurred: false};
  }
  if (view.stage === "recovery") {
    const requestField = view.request_field;
    const eligible = (view.current_frontier.candidate_memory_records ?? [])
      .filter(record => typeof record.content?.lesson === "string" && !record.possibly_incorrect && !record.source_confused)
      .filter(record => requestField && record.content.detail_type === requestField)
      .filter(record => view.historical_panel
        ? view.historical_panel.memory_id === record.memory_id && isDialoguePanelMemory(record)
        : !isDialoguePanelMemory(record));
    // The full committed evidence may veto a stale retrieval frontier.
    const all = Array.isArray(view.committed_referent_memories)
      ? view.committed_referent_memories : eligible;
    const selected = view.historical_panel ? null
      : singleUncontestedTestimony(all, view.conversation_referent, requestField);
    const record = view.historical_panel
      ? (unique(eligible.map(item => normalize(item.content.lesson))).length === 1 ? eligible[0] : null)
      : selected && eligible.find(item => item.memory_id === selected.memory_id) ? selected : null;
    return record ? {
      contacted_candidate_refs: [record.memory_id],
      recovered_selections: [{source_memory_ref: record.memory_id, content_kind: "detail",
        selector: {kind: "json_pointer", path: "/lesson"}}],
    } : {contacted_candidate_refs: [], recovered_selections: []};
  }
  return {control_action: "stop", control_reason: "Bounded learned-object lookup", selected_reinstatement_cue_refs: []};
}
