import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  comfyViewUrl,
  ComfyUIAssetProvider,
  extractComfyUIImages,
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

describe("ComfyUI Local AssetForge provider", () => {
  it("defaults to conservative output licensing", () => {
    const provider = new ComfyUIAssetProvider({
      workflows: {
        generate: () => ({ "1": { class_type: "SaveImage", inputs: {} } }),
      },
      kinds: ["concept_art"],
    });
    assert.equal(provider.descriptor.local, true);
    assert.equal(provider.descriptor.externalCost, false);
    assert.equal(provider.descriptor.outputLicense.reusePolicy, "review-required");
    assert.equal(provider.descriptor.commercialUseAllowed, false);
  });

  it("rejects non-loopback endpoints", () => {
    assert.throws(
      () =>
        new ComfyUIAssetProvider({
          baseUrl: "https://example.com",
          workflows: { generate: () => ({}) },
          kinds: ["concept_art"],
        }),
      /loopback/i,
    );
  });

  it("extracts deterministic image references from history", () => {
    const images = extractComfyUIImages(
      {
        "prompt-1": {
          outputs: {
            "9": {
              images: [
                {
                  filename: "b.png",
                  subfolder: "foundry",
                  type: "output",
                },
              ],
            },
            "2": {
              images: [
                {
                  filename: "a.png",
                  subfolder: "",
                  type: "output",
                },
              ],
            },
          },
        },
      },
      "prompt-1",
    );
    assert.deepEqual(
      images.map((image) => image.filename),
      ["a.png", "b.png"],
    );
  });

  it("queues a workflow, reads history, and copies every image locally", async () => {
    const root = mkdtempSync(join(tmpdir(), "matterhorn-comfyui-"));
    const calls: Array<{ url: string; body?: string | Uint8Array }> = [];
    const fetchImpl: SpriteFusionFetch = async (url, init) => {
      calls.push({ url, body: init?.body });
      if (url.endsWith("/prompt")) {
        return textResponse('{"prompt_id":"prompt-1","number":1}');
      }
      if (url.endsWith("/history/prompt-1")) {
        return textResponse(
          JSON.stringify({
            "prompt-1": {
              outputs: {
                "10": {
                  images: [
                    {
                      filename: "first.png",
                      subfolder: "foundry",
                      type: "output",
                    },
                    {
                      filename: "second.webp",
                      subfolder: "foundry",
                      type: "output",
                    },
                  ],
                },
              },
            },
          }),
        );
      }
      if (url.includes("filename=first.png")) return binaryResponse([1, 2]);
      if (url.includes("filename=second.webp")) return binaryResponse([3, 4]);
      return textResponse("not found", 404);
    };

    try {
      const provider = new ComfyUIAssetProvider({
        fetchImpl,
        workflows: {
          generate: (request) => ({
            "1": {
              class_type: "FoundryPrompt",
              inputs: { text: request.prompt ?? "" },
            },
          }),
        },
        kinds: ["concept_art"],
        outputLicense: {
          name: "Project-approved local model license",
          classification: "permissive",
          reusePolicy: "direct",
        },
        commercialUseAllowed: true,
      });

      const result = await provider.execute(
        {
          requestId: "req-1",
          assetId: "forest",
          kind: "concept_art",
          operation: "generate",
          prompt: "A moonlit forest",
        },
        { outputRoot: root },
      );

      assert.equal(result.providerRequestId, "prompt-1");
      assert.equal(result.outputs.length, 2);
      assert.ok(result.outputs.every((output) => output.localPath));
      assert.ok(
        result.outputs.every(
          (output) => output.localPath && existsSync(output.localPath),
        ),
      );
      assert.deepEqual([...readFileSync(result.outputs[0].localPath!)], [1, 2]);
      assert.deepEqual([...readFileSync(result.outputs[1].localPath!)], [3, 4]);
      assert.match(
        String(result.metadata?.workflowHash ?? ""),
        /^[a-f0-9]{64}$/,
      );

      const queuedBody = JSON.parse(
        calls.find((call) => call.url.endsWith("/prompt"))?.body ?? "{}",
      );
      assert.equal(
        queuedBody.prompt["1"].inputs.text,
        "A moonlit forest",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("constructs encoded view URLs safely", () => {
    const url = comfyViewUrl("http://127.0.0.1:8188", {
      filename: "hello world.png",
      subfolder: "a/b",
      type: "output",
    });
    assert.match(url, /^http:\/\/127\.0\.0\.1:8188\/view\?/);
    assert.ok(url.includes("filename=hello+world.png"));
    assert.ok(url.includes("subfolder=a%2Fb"));
  });
});
