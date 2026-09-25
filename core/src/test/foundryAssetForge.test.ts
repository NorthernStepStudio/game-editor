import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFoundryAssetManifest,
  FoundryAssetProviderRegistry,
  routeFoundryAssetProvider,
  validateFoundryAssetProviderDescriptor,
  validateFoundryAssetRequest,
  type FoundryAssetProvider,
  type FoundryAssetProviderDescriptor,
  type FoundryAssetRequest,
} from "../foundry/index.js";

const permissiveLicense = {
  name: "MIT",
  spdxId: "MIT",
  classification: "permissive" as const,
  reusePolicy: "direct" as const,
  noticeRequired: true,
};

function provider(
  overrides: Partial<FoundryAssetProviderDescriptor> = {},
): FoundryAssetProviderDescriptor {
  return {
    id: "local-pixel",
    name: "Local Pixel",
    operations: ["generate", "animate"],
    kinds: ["pixel_sprite", "sprite_sheet"],
    local: true,
    requiresNetwork: false,
    externalCost: false,
    supportsSeed: true,
    supportsReferences: true,
    outputLicense: permissiveLicense,
    commercialUseAllowed: true,
    priority: 1,
    ...overrides,
  };
}

function request(
  overrides: Partial<FoundryAssetRequest> = {},
): FoundryAssetRequest {
  return {
    requestId: "req-1",
    assetId: "hero",
    kind: "pixel_sprite",
    operation: "generate",
    prompt: "A readable farming hero",
    dimensions: { width: 32, height: 32 },
    seed: 42,
    ...overrides,
  };
}

describe("Foundry AssetForge foundation", () => {
  it("validates requests and provider descriptors", () => {
    assert.deepEqual(validateFoundryAssetRequest(request()), []);
    assert.deepEqual(validateFoundryAssetProviderDescriptor(provider()), []);
    assert.match(
      validateFoundryAssetProviderDescriptor(
        provider({ local: true, requiresNetwork: true }),
      ).join(" "),
      /local provider cannot require network/i,
    );
  });

  it("prefers local no-cost providers when capabilities are equivalent", () => {
    const route = routeFoundryAssetProvider(
      request(),
      [
        provider(),
        provider({
          id: "remote-paid",
          name: "Remote Paid",
          local: false,
          requiresNetwork: true,
          externalCost: true,
          priority: 1,
        }),
      ],
      {
        allowNetwork: true,
        allowExternalCost: true,
        requireCommercialUse: true,
      },
    );
    assert.equal(route.selected?.id, "local-pixel");
  });

  it("honors localFirst=false instead of retaining an unconditional local score bonus", () => {
    const providers = [
      provider(),
      provider({ id: "a-remote-free", name: "Remote Free", local: false, priority: 1 }),
    ];
    assert.equal(routeFoundryAssetProvider(request(), providers, { localFirst: true }).selected?.id, "local-pixel");
    assert.equal(routeFoundryAssetProvider(request(), providers, { localFirst: false }).selected?.id, "a-remote-free");
  });

  it("rejects providers that violate policy or capability requirements", () => {
    const route = routeFoundryAssetProvider(
      request({ referenceAssets: ["style-ref"] }),
      [
        provider({
          id: "remote-no-ref",
          local: false,
          requiresNetwork: true,
          supportsReferences: false,
        }),
      ],
      { allowNetwork: false },
    );
    assert.equal(route.selected, undefined);
    assert.equal(route.rejected.length, 1);
  });

  it("registers and selects a concrete provider deterministically", async () => {
    const registry = new FoundryAssetProviderRegistry();
    const implementation: FoundryAssetProvider = {
      descriptor: provider(),
      async execute(req) {
        return {
          outputs: [
            {
              providerId: "local-pixel",
              requestId: req.requestId,
              outputIndex: 0,
              localPath: "assets/generated/hero.png",
              contentHash: "abc123",
              width: 32,
              height: 32,
            },
          ],
        };
      },
    };
    registry.register(implementation);
    assert.equal(registry.select(request()).descriptor.id, "local-pixel");

    const generated = await implementation.execute(request());
    const manifest = createFoundryAssetManifest(
      request(),
      implementation.descriptor,
      generated.outputs[0],
      {
        assetId: "hero",
        createdAt: "2026-09-24T20:00:00.000Z",
      },
    );
    assert.equal(manifest.generationProvider, "local-pixel");
    assert.equal(manifest.localPath, "assets/generated/hero.png");
    assert.equal(manifest.seed, 42);
    assert.equal(manifest.requestId, "req-1");
    assert.equal(manifest.operation, "generate");
    assert.match(manifest.promptHash ?? "", /^[a-f0-9]{64}$/);
    assert.equal(manifest.sourceLicenseIds?.[0], "MIT");
  });

  it("fails closed when no provider can satisfy commercial-use policy", () => {
    const route = routeFoundryAssetProvider(
      request(),
      [
        provider({
          id: "noncommercial",
          commercialUseAllowed: false,
        }),
      ],
      { requireCommercialUse: true },
    );
    assert.equal(route.selected, undefined);
    assert.match(route.rejected[0].reason, /commercial-use/i);
  });
});
