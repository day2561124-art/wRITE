import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection, createServer } from "node:net";
import test from "node:test";
import { createBlenderEditor } from "../../server/src/mcp-blender-editor.mjs";

const decode = code => JSON.parse(Buffer.from(code.match(/b64decode\("([A-Za-z0-9+/=]+)"\)/u)[1], "base64").toString());
const send = (socket, result) => socket.end(JSON.stringify({ status: "ok", result, stdout: "private" }) + "\0");
const parameters = { scene: "Scene", scene_id: "27", operations: [
  { op: "collection", name: "Nexa" },
  { op: "mesh", name: "Slab", collection: "Nexa", vertices: [[0,0,0],[1,0,0],[0,1,0]], faces: [[0,1,2]] },
  { op: "material", name: "Slab", material_name: "木紋", color: [.4,.2,.1,1] },
] };
async function withServer(respond, run, { timeoutMs = 500 } = {}) {
  let requests = 0;
  const sockets = new Set();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", part => {
      data += part;
      if (!data.endsWith("\0")) return;
      requests++;
      const wire = JSON.parse(data.slice(0, -1));
      respond(socket, decode(wire.code), wire);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const editor = createBlenderEditor({ timeoutMs, connect: endpoint => {
      assert.deepEqual(endpoint, { host: "127.0.0.1", port: 9876 });
      return createConnection({ host: endpoint.host, port: server.address().port });
    } });
    await run(editor, () => requests);
  } finally {
    for (const s of sockets) s.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}

test("accepts known editor data over the local Blender Lab protocol without code interpolation", async () => {
  const args = structuredClone(parameters);
  args.operations[1].name = args.operations[2].name = '板"); #';
  await withServer((socket, input, wire) => {
    assert.deepEqual(input.operations, args.operations);
    assert.equal(input.scene, args.scene);
    assert.equal(input.scene_id, args.scene_id);
    assert.equal(wire.type, "execute");
    assert.equal(wire.strict_json, true);
    assert(!wire.code.includes(args.operations[1].name));
    send(socket, { ok: true, id: input.id, changed: true, scene: "Scene", scene_id: "27", applied: 3, objects: [args.operations[1].name], collections: ["Nexa"], ignored: "private" });
  }, async editor => {
    assert.deepEqual(await editor.edit(args), { ok: true, changed: true, scene: "Scene", scene_id: "27", applied: 3, objects: [args.operations[1].name], collections: ["Nexa"] });
  });
});

test("rejects arbitrary operations, unexpected fields, nonfinite numbers and invalid topology before connecting", async () => {
  let connects = 0;
  const editor = createBlenderEditor({ connect: () => { connects++; throw Error("unused"); } });
  for (const op of [
    { op: "python", name: "Cube", code: "arbitrary" },
    { op: "mesh", name: "Cube", vertices: [[0,0,0],[1,0,0],[0,1,0]], faces: [[0,1,3]] },
    { op: "mesh", name: "Cube", vertices: [[0,0,0],[1,0,0],[0,1,0]], faces: [[0,1,1]] },
    { op: "transform", name: "Cube", rotation: [0, 0, Infinity] },
    { op: "rename", name: "Cube", new_name: "Other", filepath: "unexpected" },
    { op: "camera", name: "Cube", lens: null },
    { op: "delete", name: "Cube" },
  ]) assert.equal((await editor.edit({ scene: "Scene", scene_id: "27", operations: [op] })).code, "BLENDER_INVALID_EDIT");
  assert.equal(connects, 0);
});

test("keeps verified rollback distinct from an uncertain transport failure and never retries automatically", async () => {
  await withServer((socket, input) => send(socket, {
    ok: false, id: input.id, changed: false, code: "BLENDER_EDIT_ROLLED_BACK", index: 2,
  }), async (editor, count) => {
    const r = await editor.edit(parameters);
    assert.equal(r.code, "BLENDER_EDIT_ROLLED_BACK");
    assert.equal(r.changed, false);
    assert.equal(r.failed_at, 2);
    assert.equal(count(), 1);
  });
  await withServer(socket => socket.end(JSON.stringify({ status: "error", traceback: "private, may have edited" }) + "\0"), async (editor, count) => {
    const r = await editor.edit(parameters);
    assert.equal(r.code, "BLENDER_EDIT_OUTCOME_UNKNOWN");
    assert.equal(r.changed, null);
    assert(!JSON.stringify(r).includes("private"));
    assert.equal(count(), 1);
  });
  await withServer(() => {}, async (editor, count) => {
    const inFlight = editor.edit(parameters);
    assert.equal((await editor.edit(parameters)).code, "BLENDER_EDIT_BUSY");
    assert.equal((await inFlight).code, "BLENDER_EDIT_OUTCOME_UNKNOWN");
    assert.equal(count(), 1);
  }, { timeoutMs: 120 });
});
