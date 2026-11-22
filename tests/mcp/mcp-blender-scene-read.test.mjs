import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection, createServer } from "node:net";
import test from "node:test";
import { createBlenderSceneObjectReader } from "../../server/src/mcp-blender-scene-read.mjs";

const fixture = [
  { name: "Cube", type: "MESH" },
  { name: "Camera", type: "CAMERA" },
  { name: "Light", type: "LIGHT" },
];
const frame = result => JSON.stringify({ status: "ok", result, stdout: "not for MCP", stderr: "" }) + "\0";
const scene = objects => frame({ object_count: objects.length, objects });

async function withServer(reply, run) {
  let received = null;
  const server = createServer(socket => {
    socket.on("error", () => {});
    let pending = "";
    socket.setEncoding("utf8");
    socket.on("data", data => {
      pending += data;
      if (!pending.includes("\0")) return;
      received = pending;
      socket.pause();
      reply(socket);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run({
      connect: endpoint => {
        assert.deepEqual(endpoint, { host: "127.0.0.1", port: 9876 });
        return createConnection({ host: endpoint.host, port: server.address().port });
      },
      request: () => received,
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("queries only the active scene and accepts a fragmented Blender Lab response", async () => {
  const expected = [...fixture, { name: "測試", type: "EMPTY" }];
  const reply = Buffer.from(scene(expected.map(item => ({ ...item, ignored: "/private/path" }))));
  const split = reply.indexOf(Buffer.from("測")) + 1;
  await withServer(socket => {
    socket.write(reply.subarray(0, split));
    setImmediate(() => socket.end(reply.subarray(split)));
  }, async ({ connect, request }) => {
    const read = createBlenderSceneObjectReader({ connect });
    assert.deepEqual(await read(), { ok: true, object_count: 4, objects: expected, truncated: false });
    assert(request().endsWith("\0"));
    const actual = JSON.parse(request().slice(0, -1));
    assert.deepEqual(actual, {
      type: "execute",
      strict_json: true,
      code: [
        "import bpy",
        "from itertools import islice",
        "objects = bpy.context.scene.objects",
        'result = {"object_count": len(objects), "objects": [{"name": obj.name, "type": obj.type} for obj in islice(objects, 256)]}',
      ].join("\n"),
    });
  });
});

test("distinguishes empty and truncated scenes", async () => {
  const objects = Array.from({ length: 256 }, (_, i) => ({ name: `Object ${i}`, type: "MESH" }));
  for (const [result, truncated] of [
    [{ object_count: 0, objects: [] }, false],
    [{ object_count: 500, objects }, true],
  ]) {
    await withServer(socket => socket.end(frame(result)), async ({ connect }) => {
      assert.deepEqual(await createBlenderSceneObjectReader({ connect })(), { ok: true, ...result, truncated });
    });
  }
});

test("contains malformed, oversized, unterminated, and private error responses", async () => {
  const cases = [
    ["invalid json\0", "BLENDER_INVALID_RESPONSE"],
    [" ".repeat(128 * 1024 + 1), "BLENDER_INVALID_RESPONSE"],
    [scene(fixture).slice(0, -1), "BLENDER_INVALID_RESPONSE"],
    [scene(fixture) + "extra", "BLENDER_INVALID_RESPONSE"],
    [Buffer.from([0xff, 0]), "BLENDER_INVALID_RESPONSE"],
    [frame({ object_count: 7, objects: fixture }), "BLENDER_INVALID_RESPONSE"],
    [scene([{ name: "Blender object", type: "invalid type" }]), "BLENDER_INVALID_RESPONSE"],
    [JSON.stringify({ status: "error", error: "/private/path" }) + "\0", "BLENDER_QUERY_FAILED"],
  ];
  for (const [reply, code] of cases) {
    await withServer(socket => socket.end(reply), async ({ connect }) => {
      const result = await createBlenderSceneObjectReader({ connect })();
      assert.equal(result.ok, false);
      assert.equal(result.code, code);
      assert.doesNotMatch(JSON.stringify(result), /private\/path/);
    });
  }
});

test("returns an actionable unavailable or timeout error", async () => {
  const unavailable = createBlenderSceneObjectReader({ connect: () => { throw new Error("internal socket error"); } });
  assert.equal((await unavailable()).code, "BLENDER_UNAVAILABLE");
  await withServer(() => {}, async ({ connect }) => {
    const result = await createBlenderSceneObjectReader({ connect, timeoutMs: 150 })();
    assert.equal(result.code, "BLENDER_TIMEOUT");
  });
});
