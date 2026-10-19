import {fileURLToPath} from 'node:url';
import {readSessionMemoryProfile} from '../server/src/mcp-session-profile.mjs';

// WinSW rendering uses the versioned values, never the rendering shell's
// incidental environment. The Listener separately validates explicit overrides.
const sessionEnvironment = readSessionMemoryProfile(fileURLToPath(new URL('../config/mcp-session-memory-profile.json', import.meta.url)));
console.log(JSON.stringify(sessionEnvironment));
