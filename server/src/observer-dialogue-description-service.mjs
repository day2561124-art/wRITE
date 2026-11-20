// A small Mandarin observation grammar. Descriptions are local evidence,
// not world-object IDs. A location is an observed anchor at introduction,
// never proof of the current position or that a replacement is the same item.
const places = "桌上|架上|層架上|櫃上|櫃裡|抽屜裡|門邊|門口|窗邊|牆邊|地上|箱裡|工作臺上";
const colors = "[紅橙黃綠藍紫黑白灰銀金]色|透明";
const kinds = "計時器|定時器|手電筒|照明燈|感測器|充電器|遙控器|水壺|收音機|電風扇|標記筆";
const measure = "個|具|台|臺|支|顆|款|套|只|盞|把|部";
const trait = "(?:(" + colors + ")的?)?";
const objectKind = "(" + kinds + ")";
const anchored = "(" + places + ")";
const appearance = new RegExp("^(?:在)?" + anchored
  + "(?:有|擺著|放著|出現了?|又多了|另有)(一|兩|二|三|幾|另一)(?:" + measure + ")"
  + trait + objectKind, "u");
const reference = new RegExp("^(?:在)?" + anchored + "?(?:(?:這|那)(?:" + measure + "))?"
  + trait + objectKind, "u");
const shortReference = new RegExp("^(?:在)?" + anchored + "那(?:" + measure + ")"
  + trait + "(?:" + objectKind + ")?$", "u");
const colorFragment = new RegExp("^(" + colors + ")的?那(?:" + measure + ")(?:" + objectKind + ")?$", "u");
const qualifierStop = /^(?:[。！？?!；;、\s]|$|也?叫|名叫|名字是|稱作|最多|至少|能|還|可|在|不|要|需|只|當前|目前|現在|原本|今天|會|的(?:電量|電池|限制|續航)|放|收|擺|掛|壞|怎麼|有|各|與|和|跟)/u;
const placeValue = new RegExp("^" + anchored + "$", "u");
const kindValue = new RegExp("^" + objectKind + "$", "u");
const colorValue = new RegExp("^(?:" + colors + ")$", "u");

export const sameDescriptor = (a, b) => Boolean(a && b
  && a.anchor === b.anchor && a.color === b.color && a.kind === b.kind);

export function committedDescriptor(value) {
  const descriptor = dialogueDescriptorQuery(value);
  return descriptor?.anchor ? descriptor : null;
}

export function dialogueDescriptorQuery(value) {
  if (!value || typeof value !== "object"
      || value.anchor !== null && !placeValue.test(value.anchor)
      || !kindValue.test(value.kind)
      || value.color !== null && !colorValue.test(value.color)) return null;
  return {anchor: value.anchor, color: value.color, kind: value.kind};
}

export function dialogueClarificationFragment(value) {
  const text = value.normalize("NFKC").trim().replace(/[。！!]$/u, "").trim()
    .replace(/^(?:(?:我指|我說)的是|就是|是)/u, "");
  if (!text || text.length > 40 || /^(?:不是|不對|並非|別|不要|也不是|不確定|那(?:個|台|臺|支|部)$|它$)/u.test(text)) return null;
  const short = text.match(shortReference);
  if (short) return {text, anchor: short[1], color: short[2] ?? null, kind: short[3] ?? null};
  const colorShort = text.match(colorFragment);
  if (colorShort) return {text, anchor: null, color: colorShort[1], kind: colorShort[2] ?? null};
  const full = dialogueDescription(text);
  if (full?.mode === "reference" && full.lead === text && (full.anchor || full.color)) {
    return {text, anchor: full.anchor, color: full.color, kind: full.kind};
  }
  const exactName = text.match(/^(?:[「『"])?([\p{L}\p{N} _-]{2,32})(?:[」』"])?$/u);
  return exactName ? {text: exactName[1], anchor: null, color: null, kind: null} : null;
}

export function matchesDescriptor(known, request) {
  return Boolean(known && known.kind === request.kind
    && (!request.anchor || known.anchor === request.anchor)
    && (!request.color || !known.color || known.color === request.color));
}

export function dialogueDescription(line) {
  const text = line.trim();
  const seen = text.match(appearance);
  if (seen && qualifierStop.test(text.slice(seen[0].length))) {
    const [lead, anchor, count, color, kind] = seen;
    return {lead, anchor, color: color ?? null, kind,
      mode: count === "一" && !/(?:又多了|另有)/u.test(lead) ? "appearance" : "collision"};
  }
  const matched = text.match(reference);
  if (!matched || !qualifierStop.test(text.slice(matched[0].length))) return null;
  const [lead, anchor, color, kind] = matched;
  return {lead, anchor: anchor ?? null, color: color ?? null, kind, mode: "reference"};
}

export function namedByDescription(clause, descriptor) {
  if (descriptor?.mode !== "reference" || !descriptor.anchor || !descriptor.color) return null;
  return clause.slice(descriptor.lead.length)
    .match(/^(?:也?叫做?|名叫|名字是|稱作)[「『“"]([^」』”"]{2,32})[」』”"][。！!]?$/u)?.[1] ?? null;
}
