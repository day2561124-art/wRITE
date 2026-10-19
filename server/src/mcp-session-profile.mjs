import fs from 'node:fs';

const bounds = Object.freeze({
  MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: [100, 24 * 60 * 60 * 1000],
  MCP_HTTP_MAX_IDLE_SESSION_COUNT: [1, 10_000],
});

function integerString(name, value) {
  const [minimum, maximum] = bounds[name];
  if (typeof value !== 'string' || !/^\d+$/u.test(value)
    || !Number.isSafeInteger(Number(value)) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`Invalid session memory profile: ${name} must be a string integer between ${minimum} and ${maximum}.`);
  }
  return String(Number(value));
}

// Read and validate the whole versioned profile even when the caller overrides
// both values. A broken deployment must never silently select legacy defaults.
export function readSessionMemoryProfile(profilePath, environment = {}) {
  let profile;
  try { profile = JSON.parse(fs.readFileSync(profilePath, 'utf8').replace(/^\uFEFF/u, '')); }
  catch (error) { throw new Error(`Cannot load session memory profile ${profilePath}: ${error.message}`, {cause: error}); }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)
    || Object.keys(profile).length !== Object.keys(bounds).length
    || Object.keys(profile).some(name => !Object.hasOwn(bounds, name))) {
    throw new Error('Invalid session memory profile: exactly the idle timeout and idle session count are required.');
  }
  const result = {};
  for (const name of Object.keys(bounds)) {
    const configured = integerString(name, profile[name]);
    result[name] = Object.hasOwn(environment, name)
      ? integerString(name, environment[name]?.trim()) : configured;
  }
  return result;
}
