import assert from "node:assert/strict";

export function normalizeLineEndings(text) {
  return text.replace(/\r\n?/gu, "\n");
}

export function assertImmediateRegistrationAdjacency({
  sourceText,
  previousRegistration,
  currentRegistration,
  message,
}) {
  assert.ok(
    normalizeLineEndings(sourceText).includes(`${previousRegistration}\n${currentRegistration}`),
    message,
  );
}
