import assert from "node:assert/strict";

import {
  resolveObserverDialogueScope, scopeConversationMemoryStage,
} from "../../server/src/observer-dialogue-scope-service.mjs";

const evidence = "這次我問的是舊計時器。";
const base = {perception: {audible: [evidence]}, previousTopic: "limit",
  previousReferent: "new_timer", groundReferents: true};
const resolve = result => resolveObserverDialogueScope({...base, resolve: () => result});
const focused = {mode: "focus", topic: "limit", referent: "old_timer", evidence};
assert.equal(await resolve({...focused, evidence: "private journal"}), null);
assert.equal(await resolve({...focused, excluded_topics: ["limit"]}), null);
assert.equal((await resolve({...focused, referent: "new_timer", excluded_referents: ["new_timer"]})).paused_referent, "new_timer");

const frontier = {candidate_count: 3, candidate_memory_records: [
  {memory_id: "old", content: {referent_id: "old_timer"}},
  {memory_id: "new", content: {referent_id: "new_timer"}},
  {memory_id: "untagged", content: {topic: "limit"}},
], candidate_refs: [{memory_id: "old"}, {memory_id: "new"}],
candidate_evaluations: [{memory_id: "new"}, {memory_id: "old"}]};
const recover = {stage: "recovery", current_frontier: frontier};
const denied = {contacted_candidate_refs: [], recovered_selections: []};

for (const answer of [{mode: "ambiguous"}, {...focused, referent: null}, {mode: "shift", evidence}]) {
  const scoped = scopeConversationMemoryStage(() => assert.fail("Unresolved scope contacted memory"), await resolve(answer));
  assert.deepEqual(await scoped({stage: "initiation"}), {process_occurred: false});
  assert.deepEqual(await scoped(recover), denied);
}

const scope = await resolve(focused);
assert.equal(scope.referent, "old_timer");
const expected = {contacted_candidate_refs: ["old"], recovered_selections: [{source_memory_ref: "old"}]};
const scoped = scopeConversationMemoryStage(view => {
  assert.equal(view.conversation_referent, "old_timer");
  assert.equal(view.current_frontier.candidate_count, 1);
  for (const field of ["candidate_memory_records", "candidate_refs", "candidate_evaluations"]) {
    assert.deepEqual(view.current_frontier[field].map(item => item.memory_id), ["old"]);
  }
  return expected;
}, scope);
assert.deepEqual(await scoped(recover), expected);
assert.equal(frontier.candidate_memory_records.length, 3);
const crossReferent = scopeConversationMemoryStage(() => ({
  ...expected, recovered_selections: [{source_memory_ref: "new"}],
}), scope);
assert.deepEqual(await crossReferent(recover), denied);
console.log("Observer dialogue scope keeps recovery on the grounded referent.");
