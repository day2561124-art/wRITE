import { createConnection } from "node:net";

const endpoint = Object.freeze({ host: "127.0.0.1", port: 9876 });
const maxObjects = 256;
const maxResponseBytes = 128 * 1024;
const sceneQuery = [
  "import bpy",
  "from itertools import islice",
  "objects = bpy.context.scene.objects",
  `result = {"object_count": len(objects), "objects": [{"name": obj.name, "type": obj.type} for obj in islice(objects, ${maxObjects})]}`,
].join("\n");

const failureMessages = {
  BLENDER_UNAVAILABLE: "Open Blender and start the local Blender Lab server on 127.0.0.1:9876.",
  BLENDER_TIMEOUT: "Blender Lab did not answer the scene query in time.",
  BLENDER_INVALID_RESPONSE: "Blender Lab returned an invalid scene-query response.",
  BLENDER_QUERY_FAILED: "Blender Lab could not read the current scene.",
};

function failure(code) {
  return { ok: false, code, message: failureMessages[code] };
}

function parseScene(frame) {
  const decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(frame));
  if (decoded?.status === "error") return failure("BLENDER_QUERY_FAILED");
  const result = decoded?.result;
  if (decoded?.status !== "ok" ||
      !Number.isSafeInteger(result?.object_count) || result.object_count < 0 ||
      !Array.isArray(result?.objects) ||
      result.objects.length !== Math.min(result.object_count, maxObjects) ||
      !result.objects.every(obj => typeof obj?.name === "string" && obj.name.length > 0 &&
        obj.name.length <= 256 && typeof obj.type === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(obj.type))) {
    return failure("BLENDER_INVALID_RESPONSE");
  }
  return {
    ok: true,
    object_count: result.object_count,
    objects: result.objects.map(({ name, type }) => ({ name, type })),
    truncated: result.object_count > result.objects.length,
  };
}

// These dependencies are injectable only by local tests, never via tool arguments.
export function createBlenderLabClient({ connect = createConnection, timeoutMs = 3000 } = {}) {
  return (code, parse, { mutation = false } = {}) => new Promise(resolve => {
    const request = JSON.stringify({ type: "execute", code, strict_json: true }) + "\0";
    let socket;
    let connected = false;
    let sent = false;
    let settled = false;
    let bytes = 0;
    const chunks = [];
    const timer = setTimeout(() => finish(failure("BLENDER_TIMEOUT")), timeoutMs);

    function finish(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(mutation && sent && value.ok === false && !Object.hasOwn(value, "changed")
        ? { ...value, code: "BLENDER_EDIT_OUTCOME_UNKNOWN", message: "The Blender response was not verified. Inspect the scene before trying again.", changed: null }
        : value);
    }

    function onError() {
      finish(failure(connected ? "BLENDER_INVALID_RESPONSE" : "BLENDER_UNAVAILABLE"));
    }

    try {
      socket = connect(endpoint);
      socket.once("error", onError);
      socket.once("close", onError);
      socket.once("connect", () => {
        connected = true;
        sent = true;
        socket.write(request);
      });
      socket.on("data", chunk => {
        const terminator = chunk.indexOf(0);
        const framePart = terminator < 0 ? chunk : chunk.subarray(0, terminator);
        bytes += framePart.length;
        if (bytes > maxResponseBytes || (terminator >= 0 && terminator !== chunk.length - 1)) {
          finish(failure("BLENDER_INVALID_RESPONSE"));
          return;
        }
        if (framePart.length) chunks.push(framePart);
        if (terminator < 0) return;
        try {
          finish(parse(Buffer.concat(chunks, bytes)));
        } catch {
          finish(failure("BLENDER_INVALID_RESPONSE"));
        }
      });
    } catch {
      onError();
    }
  });
}

export function createBlenderSceneObjectReader(options) {
  const call = createBlenderLabClient(options);
  return () => call(sceneQuery, parseScene);
}

export const listBlenderSceneObjects = createBlenderSceneObjectReader();
