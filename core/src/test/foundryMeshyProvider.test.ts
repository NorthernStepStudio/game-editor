import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  MESHY_CREDIT_CURRENCY,
  MESHY_PROVIDER_DESCRIPTOR,
  MeshyImageTo3DProvider,
  type FoundryAssetRequest,
  type SpriteFusionFetch,
  type SpriteFusionHttpResponse,
} from "../foundry/index.js";

const KEY = "test-meshy-key";
const PNG = Buffer.from("89504e470d0a1a0a0000", "hex");
const GLB = Buffer.concat([Buffer.from("glTF", "latin1"), Buffer.alloc(16)]);

function respond(body: string | Buffer, status = 200): SpriteFusionHttpResponse {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return bytes.toString("utf8");
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function request(views: readonly string[]): FoundryAssetRequest {
  return { requestId: "r1", assetId: "yun_urban", kind: "mesh_3d", operation: "image_to_3d", referenceAssets: views };
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "meshy-"));
  const images: Record<string, string> = {};
  for (const view of ["front", "left", "back", "three_quarter"]) {
    images[view] = join(dir, `${view}.png`);
    writeFileSync(images[view], PNG);
  }
  return { dir, images };
}

describe("Meshy image-to-3D provider", () => {
  it("is a paid, online provider for image_to_3d meshes", () => {
    assert.equal(MESHY_PROVIDER_DESCRIPTOR.externalCost, true);
    assert.equal(MESHY_PROVIDER_DESCRIPTOR.requiresNetwork, true);
    assert.deepEqual(MESHY_PROVIDER_DESCRIPTOR.operations, ["image_to_3d"]);
  });

  it("sends the views front-first, polls, and saves the GLB, preview and real credit cost", async () => {
    const { dir, images } = fixture();
    const calls: { url: string; auth?: string; body?: Record<string, unknown> }[] = [];
    let polls = 0;
    const fetchImpl: SpriteFusionFetch = async (url, init) => {
      calls.push({ url, auth: init?.headers?.authorization, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}) });
      if (url.endsWith("/openapi/v1/multi-image-to-3d")) return respond(JSON.stringify({ result: "task-1" }));
      if (url.endsWith("/multi-image-to-3d/task-1")) {
        polls += 1;
        return respond(JSON.stringify(polls < 2
          ? { status: "IN_PROGRESS", progress: 40 }
          : { status: "SUCCEEDED", progress: 100, consumed_credits: 30, model_urls: { glb: "https://assets.example/m.glb" }, thumbnail_url: "https://assets.example/t.png" }));
      }
      if (url === "https://assets.example/m.glb") return respond(GLB);
      if (url === "https://assets.example/t.png") return respond(PNG);
      return respond("not found", 404);
    };
    try {
      const provider = new MeshyImageTo3DProvider({ apiKey: KEY, fetchImpl, pollIntervalMs: 0, resolveImagePath: (id) => images[id] });
      const progress: string[] = [];
      const result = await provider.execute(request(["front", "left", "back", "three_quarter"]), {
        outputRoot: dir,
        maxCost: { currency: MESHY_CREDIT_CURRENCY, amount: 40 },
        onProgress: (m) => progress.push(m),
      });
      const create = calls[0];
      assert.equal(create.auth, `Bearer ${KEY}`);
      const urls = create.body?.image_urls as string[];
      assert.equal(urls.length, 4);
      assert.match(urls[0], /^data:image\/png;base64,/);
      assert.equal(create.body?.pose_mode, "a-pose");
      assert.equal(create.body?.should_texture, true);
      // The key goes to the API only, never to the download links.
      for (const call of calls.filter((c) => c.url.startsWith("https://assets.example"))) assert.equal(call.auth, undefined);
      const output = result.outputs[0];
      assert.ok(output.localPath && existsSync(output.localPath));
      assert.equal(readFileSync(output.localPath).subarray(0, 4).toString("latin1"), "glTF");
      assert.ok(output.previewPath?.endsWith("-preview.png"));
      assert.deepEqual(result.cost, { currency: MESHY_CREDIT_CURRENCY, amount: 30 });
      assert.ok(progress.some((m) => m.includes("40%")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to start without an approved credit budget", async () => {
    const { dir, images } = fixture();
    let called = false;
    try {
      const provider = new MeshyImageTo3DProvider({ apiKey: KEY, fetchImpl: async () => { called = true; return respond("{}"); }, resolveImagePath: (id) => images[id] });
      await assert.rejects(provider.execute(request(["front"]), { outputRoot: dir }), /approved budget/);
      await assert.rejects(provider.execute(request(["front"]), { outputRoot: dir, maxCost: { currency: MESHY_CREDIT_CURRENCY, amount: 5 } }), /approved budget/);
      assert.equal(called, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("explains failures without ever echoing the key", async () => {
    const { dir, images } = fixture();
    try {
      const provider = new MeshyImageTo3DProvider({
        apiKey: KEY,
        fetchImpl: async () => respond(`{"message":"bad key ${KEY}"}`, 401),
        resolveImagePath: (id) => images[id],
      });
      await assert.rejects(
        provider.execute(request(["front"]), { outputRoot: dir, maxCost: { currency: MESHY_CREDIT_CURRENCY, amount: 30 } }),
        (error: Error) => /MESHY_API_KEY/.test(error.message) && !error.message.includes(KEY),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a failed Meshy task as refunded", async () => {
    const { dir, images } = fixture();
    const fetchImpl: SpriteFusionFetch = async (url) => url.endsWith("/multi-image-to-3d")
      ? respond(JSON.stringify({ result: "task-2" }))
      : respond(JSON.stringify({ status: "FAILED", task_error: { message: "image unclear" } }));
    try {
      const provider = new MeshyImageTo3DProvider({ apiKey: KEY, fetchImpl, pollIntervalMs: 0, resolveImagePath: (id) => images[id] });
      await assert.rejects(
        provider.execute(request(["front"]), { outputRoot: dir, maxCost: { currency: MESHY_CREDIT_CURRENCY, amount: 30 } }),
        /image unclear.*refunded/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
