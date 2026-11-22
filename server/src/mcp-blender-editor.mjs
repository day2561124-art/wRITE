import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createBlenderLabClient } from "./mcp-blender-scene-read.mjs";

const editorPath = new URL("./mcp-blender-editor.py", import.meta.url);
const rawLimit = 96 * 1024;
const maxOps = 24;
const isRecord = x => x !== null && typeof x === "object" && !Array.isArray(x);
const shape = (x, required, optional = []) => isRecord(x) &&
  required.every(k => Object.hasOwn(x, k)) && Object.keys(x).every(k => [...required, ...optional].includes(k));
const name = x => typeof x === "string" && x.trim() !== "" && Buffer.byteLength(x, "utf8") <= 63 &&
  !/[\x00-\x1f\x7f\ud800-\udfff]/u.test(x);
const sceneIdentity = x => typeof x === "string" && /^[1-9][0-9]{0,19}$/u.test(x);
const bounded = (x, min, max) => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const vector = (x, n, min, max) => Array.isArray(x) && x.length === n && x.every(v => bounded(v, min, max));
const transforms = ["location", "rotation", "scale"];
const transform = x => (!Object.hasOwn(x, "location") || vector(x.location, 3, -100000, 100000))
  && (!Object.hasOwn(x, "rotation") || vector(x.rotation, 3, -36000, 36000))
  && (!Object.hasOwn(x, "scale") || vector(x.scale, 3, 0.0001, 10000));
const rgba = x => vector(x, 4, 0, 1);
const has = (x, key) => Object.hasOwn(x, key);

function validGeometry(op) {
  if (!Array.isArray(op.vertices) || op.vertices.length < 1 || op.vertices.length > 2048 ||
      !op.vertices.every(v => vector(v, 3, -100000, 100000)) ||
      !Array.isArray(op.faces) || op.faces.length > 4096 ||
      (has(op, "edges") && (!Array.isArray(op.edges) || op.edges.length > 4096))) return false;
  const validIndex = i => Number.isInteger(i) && i >= 0 && i < op.vertices.length;
  const edges = op.edges ?? [];
  return edges.every(e => Array.isArray(e) && e.length === 2 && e.every(validIndex) && e[0] !== e[1]) &&
    op.faces.every(f => Array.isArray(f) && f.length >= 3 && f.length <= 64 &&
      f.every(validIndex) && new Set(f).size === f.length);
}

function validOperation(op) {
  if (!isRecord(op) || typeof op.op !== "string" || !name(op.name)) return false;
  const base = ["op", "name"];
  switch (op.op) {
    case "collection": return shape(op, base);
    case "primitive":
      return shape(op, [...base, "kind"], ["collection", ...transforms]) &&
        ["CUBE", "PLANE", "UV_SPHERE", "ICO_SPHERE", "CYLINDER", "CONE", "TORUS"].includes(op.kind) &&
        (!has(op, "collection") || name(op.collection)) && transform(op);
    case "mesh":
      return shape(op, [...base, "vertices", "faces"], ["edges", "collection", ...transforms]) &&
        (!has(op, "collection") || name(op.collection)) && transform(op) && validGeometry(op);
    case "light":
      return shape(op, [...base, "kind", "power"], ["color", "size", "collection", ...transforms]) &&
        ["POINT", "AREA", "SUN", "SPOT"].includes(op.kind) && bounded(op.power, 0, 1000000) &&
        (!has(op, "color") || vector(op.color, 3, 0, 1)) && (!has(op, "size") || bounded(op.size, 0.001, 10000)) &&
        (!has(op, "collection") || name(op.collection)) && transform(op);
    case "camera":
      return shape(op, base, ["lens", "collection", ...transforms]) &&
        (!has(op, "lens") || bounded(op.lens, 1, 3000)) &&
        (!has(op, "collection") || name(op.collection)) && transform(op);
    case "set_light":
      return shape(op, base, ["power", "color", "size"]) && ["power", "color", "size"].some(k => has(op, k)) &&
        (!has(op, "power") || bounded(op.power, 0, 1000000)) &&
        (!has(op, "color") || vector(op.color, 3, 0, 1)) && (!has(op, "size") || bounded(op.size, 0.001, 10000));
    case "set_camera":
      return shape(op, [...base, "lens"]) && bounded(op.lens, 1, 3000);
    case "assign_material":
      return shape(op, [...base, "material_name"]) && name(op.material_name);
    case "transform":
      return shape(op, base, transforms) && transforms.some(k => has(op, k)) && transform(op);
    case "rename": return shape(op, [...base, "new_name"]) && name(op.new_name);
    case "visibility":
      return shape(op, [...base, "hidden"]) && typeof op.hidden === "boolean";
    case "material":
      return shape(op, [...base, "material_name", "color"], ["roughness", "metallic"]) &&
        name(op.material_name) && rgba(op.color) && ["metallic", "roughness"].every(k => !has(op, k) || bounded(op[k], 0, 1));
    case "bevel":
      return shape(op, [...base, "width", "segments"], ["modifier_name"]) && bounded(op.width, 0, 1000) &&
        Number.isInteger(op.segments) && bounded(op.segments, 1, 12) && (!has(op, "modifier_name") || name(op.modifier_name));
    case "vertices":
      return shape(op, [...base, "updates"]) && Array.isArray(op.updates) && op.updates.length > 0 &&
        op.updates.length <= 2048 && op.updates.every(u => shape(u, ["index", "co"]) &&
          Number.isInteger(u.index) && bounded(u.index, 0, 10000000) && vector(u.co, 3, -100000, 100000)) &&
        new Set(op.updates.map(u => u.index)).size === op.updates.length;
    case "active_camera": return shape(op, base);
    default: return false;
  }
}

function requestCode(data, editorPython) {
  const encoded = Buffer.from(JSON.stringify(data), "utf8").toString("base64");
  return `import base64, json\nrequest = json.loads(base64.b64decode("${encoded}"))\n${editorPython}`;
}

const invalid = message => ({ ok: false, changed: false, code: "BLENDER_INVALID_EDIT", message });
const statuses = new Set(["BLENDER_SCENE_MISMATCH", "BLENDER_EDIT_MODE", "BLENDER_EDIT_REJECTED", "BLENDER_EDIT_ROLLED_BACK", "BLENDER_EDIT_ROLLBACK_FAILED"]);
const boundedNames = x => Array.isArray(x) && x.length <= maxOps && x.every(name);

function response(frame, kind, id, count, requestedScene, requestedSceneId) {
  const d = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(frame));
  if (d?.status !== "ok" || !isRecord(d.result) || d.result.id !== id)
    return { ok: false, code: "BLENDER_INVALID_RESPONSE", message: "Blender did not return a verified editor receipt." };
  const p = d.result;
  if (p.ok === false && statuses.has(p.code) && (p.changed === false || p.changed === null) &&
      (p.index === null || (Number.isInteger(p.index) && p.index >= 0 && p.index < count)))
    return { ok: false, code: p.code, changed: p.changed, failed_at: p.index, message: ({
      BLENDER_SCENE_MISMATCH: "The active scene changed. Inspect it before editing.",
      BLENDER_EDIT_MODE: "Switch Blender to Object Mode before editing through Nexa.",
      BLENDER_EDIT_REJECTED: "The operation is not applicable to the named object or data. Inspect the scene before retrying.",
      BLENDER_EDIT_ROLLED_BACK: "The batch stopped and Blender rolled back its changes. Inspect the failed step.",
      BLENDER_EDIT_ROLLBACK_FAILED: "Rollback could not be verified. Inspect Blender before any further edits.",
    })[p.code] };
  if (p.ok !== true || !name(p.scene) || !sceneIdentity(p.scene_id)) throw new Error("Invalid editor receipt");
  if (kind === "edit") {
    if (p.scene !== requestedScene || p.scene_id !== requestedSceneId || p.changed !== true || p.applied !== count || !boundedNames(p.objects) || !boundedNames(p.collections))
      throw new Error("Invalid edit receipt");
    return { ok: true, changed: true, scene: p.scene, scene_id: p.scene_id, applied: p.applied, objects: p.objects, collections: p.collections };
  }
  if (!Number.isSafeInteger(p.object_count) || p.object_count < 0 ||
      !Array.isArray(p.objects) || p.objects.length !== Math.min(p.object_count, 80) ||
      !p.objects.every(x => isRecord(x) && name(x.name) && typeof x.type === "string" &&
        /^[A-Z_]{1,32}$/u.test(x.type) && typeof x.selected === "boolean")) throw new Error("Invalid inspection receipt");
  if (p.detail !== null && (!isRecord(p.detail) || !name(p.detail.name) ||
      !Array.isArray(p.detail.materials) || p.detail.materials.length > 16 ||
      !Array.isArray(p.detail.modifiers) || p.detail.modifiers.length > 16 ||
      !Array.isArray(p.detail.vertices) || p.detail.vertices.length > 128)) throw new Error("Invalid object details");
  return { ok: true, scene: p.scene, scene_id: p.scene_id, camera: p.camera, object_count: p.object_count, objects: p.objects,
    truncated: p.objects.length < p.object_count, detail: p.detail };
}

export function createBlenderEditor({ connect, timeoutMs = 8500 } = {}) {
  const lab = createBlenderLabClient({ connect, timeoutMs });
  let active = false;
  let editorPython;
  async function request(kind, args, count) {
    try {
      editorPython ??= await readFile(editorPath, "utf8");
    } catch {
      return { ok: false, changed: false, code: "BLENDER_COMPONENT_UNAVAILABLE",
        message: "The local Blender editor script could not load." };
    }
    const id = randomUUID();
    return lab(requestCode({ id, mode: kind, ...args }, editorPython),
      frame => response(frame, kind, id, count, args.scene, args.scene_id), { mutation: kind === "edit" });
  }
  return {
    inspect({ object }) {
      if (object != null && !name(object)) return invalid("Provide the exact Blender object name.");
      return request("inspect", { object: object ?? null }, 0);
    },
    async edit({ scene, scene_id, operations }) {
      if (!name(scene) || !sceneIdentity(scene_id) || !Array.isArray(operations) || operations.length < 1 || operations.length > maxOps)
        return invalid("Provide the exact scene name and scene_id from inspection, plus 1 to 24 operations.");
      for (const [index, op] of operations.entries()) if (!validOperation(op))
        return { ...invalid("Check the operation name, fields, geometry, and numeric ranges."), failed_at: index };
      if (Buffer.byteLength(JSON.stringify(operations), "utf8") > rawLimit) return invalid("Split the geometry into smaller batches.");
      if (active) return { ok: false, changed: false, code: "BLENDER_EDIT_BUSY", message: "An edit is still in flight. Inspect the scene after it finishes." };
      active = true;
      try { return await request("edit", { scene, scene_id, operations }, operations.length); }
      finally { active = false; }
    },
  };
}

export const blenderEditor = createBlenderEditor();
