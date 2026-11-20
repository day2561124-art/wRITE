import { committedDescriptor, sameDescriptor } from "./observer-dialogue-description-service.mjs";

export const dialoguePanelReadSource = "direct_panel_readout";
export const dialoguePanelStatement = "observed_panel_readout";

export function panelReadingContents(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 86400) return null;
  const duration = seconds % 3600 === 0 ? (seconds / 3600) + "小時"
    : seconds % 60 === 0 ? (seconds / 60) + "分鐘" : seconds + "秒";
  return {duration, content: "面板顯示最多能倒數" + duration + "。",
    lesson: "我當時看到面板顯示最多能倒數" + duration + "。"};
}

function instant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function bindObserverPanelMemory({receipt, observation, observationIndex, encodedAt}) {
  if (receipt?.observation_index !== observationIndex || !Number.isSafeInteger(receipt?.revision)
      || receipt.revision < 0 || !/^[a-f0-9]{64}$/u.test(receipt.identity)
      || !/^learned_[a-f0-9]{24}$/u.test(receipt.referent)) return null;
  const descriptor = committedDescriptor(receipt.descriptor);
  const reading = panelReadingContents(receipt.seconds);
  const observedAt = instant(receipt.observed_at);
  if (!descriptor || !reading || observedAt === null || observedAt !== instant(encodedAt)
      || observation !== reading.content) return null;
  return {
    referent_id: receipt.referent, referent_name: null, referent_aliases: [],
    referent_description: descriptor,
    source: {channel: dialoguePanelReadSource, text: reading.content},
    detail: {lesson: reading.lesson, detail_type: "runtime"},
    panel_reading: {observed_at: new Date(observedAt).toISOString(), max_countdown_seconds: receipt.seconds},
    panel_lineage: {identity: receipt.identity, revision: receipt.revision},
  };
}

export function isDialoguePanelMemory(record) {
  return record?.internal_provenance?.dialogue_source_channel === dialoguePanelReadSource
    || record?.content?.statement_kind === dialoguePanelStatement;
}

// Choose the last witnessed identity, never a candidate value by majority.
// A conflict in one revision, or a second device with the same description,
// leaves no safe "last read" to attribute. Reading still goes through retrieval.
export function historicalDialoguePanelMemory({request, memories, revision, simulationTime}) {
  const candidates = (Array.isArray(memories) ? memories : []).filter(record =>
    record?.content?.referent_id === request?.referent && isDialoguePanelMemory(record));
  if (!candidates.length) return null;
  const unresolved = {memory_id: null};
  if (request?.kind !== "max_countdown" || request.referent_collision
      || !Number.isSafeInteger(revision) || instant(simulationTime) === null) return unresolved;
  const currentTime = instant(simulationTime);
  const historical = candidates.map(record => {
    const provenance = record.internal_provenance;
    const reading = record.content.panel_reading;
    const identity = provenance?.dialogue_panel_identity;
    const atRevision = provenance?.dialogue_panel_revision;
    const time = instant(reading?.observed_at);
    const value = panelReadingContents(reading?.max_countdown_seconds);
    return provenance?.dialogue_source_channel === dialoguePanelReadSource
      && record.content.statement_kind === dialoguePanelStatement
      && request.remembered_descriptor && sameDescriptor(record.content.referent_description, request.remembered_descriptor)
      && /^[a-f0-9]{64}$/u.test(identity) && Number.isSafeInteger(atRevision)
      && atRevision >= 0 && atRevision < revision && time !== null && time <= currentTime
      && time === instant(record.encoded_at) && value?.lesson === record.content.lesson
      && typeof record.memory_id === "string" && record.memory_id
      ? {record, identity, atRevision, time, value} : null;
  });
  if (historical.some(entry => !entry) || new Set(historical.map(entry => entry.identity)).size !== 1) return unresolved;
  const latestRevision = historical.reduce((latest, entry) => Math.max(latest, entry.atRevision), -1);
  const latest = historical.filter(entry => entry.atRevision === latestRevision);
  if (latest.length !== 1 || latest[0].record.possibly_incorrect || latest[0].record.source_confused
      || historical.some(entry => entry.time > latest[0].time)) return unresolved;
  const [selected] = latest;
  return {memory_id: selected.record.memory_id, lesson: selected.value.lesson, duration: selected.value.duration,
    identity: selected.identity, seconds: selected.record.content.panel_reading.max_countdown_seconds};
}
