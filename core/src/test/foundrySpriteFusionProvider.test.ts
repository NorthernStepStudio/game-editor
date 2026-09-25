import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildSpriteFusionRequestPayload,
  parseSpriteFusionSse,
  SPRITE_FUSION_CREDIT_CURRENCY,
  SPRITE_FUSION_PROVIDER_DESCRIPTOR,
  SPRITE_FUSION_REQUEST_CREDITS,
  SpriteFusionAssetProvider,
  type FoundryAssetRequest,
  type SpriteFusionFetch,
  type SpriteFusionHttpResponse,
} from "../foundry/index.js";

function textResponse(
  body: string,
  status = 200,
): SpriteFusionHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body;
    },
    async arrayBuffer() {
      return Buffer.from(body).buffer;
    },
  };
}

function binaryResponse(bytes: readonly number[]): SpriteFusionHttpResponse {
  const body = Uint8Array.from(bytes);
  return {
    ok: true,
    status: 200,
    async text() {
      return "";
    },
    async arrayBuffer() {
      return body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer;
    },
  };
}

function generateRequest(): FoundryAssetRequest {
  return {
    requestId: "foundry-request-1",
    assetId: "hero",
    kind: "pixel_sprite",
    operation: "generate",
    prompt: "A small clockwork fox carrying a brass lantern",
    dimensions: { width: 32, height: 32 },
  };
}

describe("Sprite Fusion AssetForge provider", () => {
  it("advertises only the supported documented operations", () => {
    assert.deepEqual(SPRITE_FUSION_PROVIDER_DESCRIPTOR.operations, [
      "generate",
      "edit",
      "style_reference",
      "direction_set",
      "animate",
    ]);
    assert.equal(SPRITE_FUSION_PROVIDER_DESCRIPTOR.externalCost, true);
    assert.equal(SPRITE_FUSION_PROVIDER_DESCRIPTOR.supportsSeed, false);
    assert.equal(SPRITE_FUSION_PROVIDER_DESCRIPTOR.commercialUseAllowed, true);
  });

  it("maps Foundry operations to documented Sprite Fusion payloads", async () => {
    const generate = await buildSpriteFusionRequestPayload(generateRequest());
    assert.deepEqual(generate, {
      operation: "generate",
      prompt: "A small clockwork fox carrying a brass lantern",
      size: 32,
    });

    const animate = await buildSpriteFusionRequestPayload(
      {
        requestId: "anim-1",
        assetId: "hero-run",
        kind: "sprite_sheet",
        operation: "animate",
        prompt: "Running in place, seamless loop",
        referenceAssets: ["hero-source"],
        animation: { frameCount: 8, colorCount: 24, loop: true },
      },
      async (assetId) => ({ asset_id: `remote-${assetId}` }),
    );
    assert.deepEqual(animate, {
      operation: "animate",
      prompt: "Running in place, seamless loop",
      inputs: [{ asset_id: "remote-hero-source" }],
      output_frames: 8,
      colors: 24,
    });
  });

  it("parses all SSE output events and ignores heartbeat blocks", () => {
    const events = parseSpriteFusionSse(
      [
        ': keep-alive',
        '',
        'data: {"type":"started","request_id":"req_sf"}',
        '',
        'data: {"type":"output","index":0,"asset":{"id":"a1"}}',
        '',
        'data: {"type":"output","index":1,"asset":{"id":"a2"}}',
        '',
        'data: {"type":"completed","status":"succeeded","output_count":2}',
        '',
      ].join("\n"),
    );
    assert.deepEqual(
      events.map((event) => event.type),
      ["started", "output", "output", "completed"],
    );
  });

  it("downloads every generated output and preserves batch provenance", async () => {
    const root = mkdtempSync(join(tmpdir(), "matterhorn-sprite-fusion-"));
    const calls: Array<{ url: string; body?: string | Uint8Array; authorization?: string }> = [];
    const sse = [
      'data: {"type":"started","request_id":"req_sf_1","operation":"generate","credits":{"reserved":15,"remaining":270}}',
      '',
      'data: {"type":"output","index":0,"asset":{"id":"asset_1","type":"image","assetUrl":"https://media.spritefusion.test/one.png","contentType":"image/png","width":32,"height":32}}',
      '',
      'data: {"type":"output","index":1,"asset":{"id":"asset_2","type":"image","assetUrl":"https://media.spritefusion.test/two.png","contentType":"image/png","width":32,"height":32}}',
      '',
      'data: {"type":"completed","status":"succeeded","output_count":2,"credits":{"remaining":270}}',
      '',
    ].join("\n");

    const fetchImpl: SpriteFusionFetch = async (url, init) => {
      calls.push({
        url,
        body: init?.body,
        authorization: init?.headers?.authorization,
      });
      if (url.endsWith("/generate")) return textResponse(sse);
      if (url.endsWith("/one.png")) return binaryResponse([1, 2, 3]);
      if (url.endsWith("/two.png")) return binaryResponse([4, 5, 6]);
      return textResponse("not found", 404);
    };

    try {
      const provider = new SpriteFusionAssetProvider({
        apiKey: "sf_live_test",
        baseUrl: "https://www.spritefusion.test/api/v1",
        fetchImpl,
      });
      const result = await provider.execute(generateRequest(), {
        outputRoot: root,
        maxCost: {
          currency: SPRITE_FUSION_CREDIT_CURRENCY,
          amount: SPRITE_FUSION_REQUEST_CREDITS,
        },
      });

      assert.equal(result.providerRequestId, "req_sf_1");
      assert.deepEqual(result.cost, {
        currency: SPRITE_FUSION_CREDIT_CURRENCY,
        amount: 15,
      });
      assert.equal(result.outputs.length, 2);
      assert.deepEqual(
        result.outputs.map((output) => output.providerAssetId),
        ["asset_1", "asset_2"],
      );
      assert.ok(result.outputs.every((output) => output.localPath));
      assert.ok(
        result.outputs.every(
          (output) => output.localPath && existsSync(output.localPath),
        ),
      );
      assert.deepEqual(
        [...readFileSync(result.outputs[0].localPath!)],
        [1, 2, 3],
      );
      assert.match(result.outputs[0].contentHash ?? "", /^[a-f0-9]{64}$/);
      assert.equal(calls[0].authorization, "Bearer sf_live_test");
      assert.equal(typeof calls[0].body, "string");
      assert.deepEqual(JSON.parse(calls[0].body as string), {
        operation: "generate",
        prompt: "A small clockwork fox carrying a brass lantern",
        size: 32,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to make a paid request when the credit budget is too low", async () => {
    const root = mkdtempSync(join(tmpdir(), "matterhorn-sprite-fusion-"));
    let called = false;
    const fetchImpl: SpriteFusionFetch = async () => {
      called = true;
      return textResponse("");
    };
    try {
      const provider = new SpriteFusionAssetProvider({
        apiKey: "sf_live_test",
        fetchImpl,
      });
      await assert.rejects(
        () =>
          provider.execute(generateRequest(), {
            outputRoot: root,
            maxCost: {
              currency: SPRITE_FUSION_CREDIT_CURRENCY,
              amount: 14,
            },
          }),
        /budget of at least 15/i,
      );
      assert.equal(called, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when an SSE stream is interrupted before completion", async () => {
    const root = mkdtempSync(join(tmpdir(), "matterhorn-sprite-fusion-"));
    const fetchImpl: SpriteFusionFetch = async () =>
      textResponse(
        [
          'data: {"type":"started","request_id":"req_sf_1","credits":{"reserved":15}}',
          '',
          'data: {"type":"output","index":0,"asset":{"id":"asset_1","assetUrl":"https://media.spritefusion.test/one.png"}}',
          '',
        ].join("\n"),
      );
    try {
      const provider = new SpriteFusionAssetProvider({
        apiKey: "sf_live_test",
        fetchImpl,
      });
      await assert.rejects(
        () =>
          provider.execute(generateRequest(), {
            outputRoot: root,
            maxCost: {
              currency: SPRITE_FUSION_CREDIT_CURRENCY,
              amount: 15,
            },
          }),
        /before a completed event/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
