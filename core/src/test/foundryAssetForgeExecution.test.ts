import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FoundryAssetForge,
  FoundryAssetProviderRegistry,
  operationPolicyForAssetProvider,
  type FoundryAssetProvider,
  type FoundryAssetProviderDescriptor,
  type FoundryAssetRequest,
} from "../foundry/index.js";

const license = {
  name: "MIT",
  spdxId: "MIT",
  classification: "permissive" as const,
  reusePolicy: "direct" as const,
};

function descriptor(
  overrides: Partial<FoundryAssetProviderDescriptor> = {},
): FoundryAssetProviderDescriptor {
  return {
    id: "local",
    name: "Local",
    operations: ["generate"],
    kinds: ["pixel_sprite"],
    local: true,
    requiresNetwork: false,
    externalCost: false,
    supportsSeed: true,
    supportsReferences: false,
    outputLicense: license,
    commercialUseAllowed: true,
    ...overrides,
  };
}

const request: FoundryAssetRequest = {
  requestId: "req-1",
  assetId: "hero",
  kind: "pixel_sprite",
  operation: "generate",
  seed: 7,
};

describe("Foundry AssetForge execution", () => {
  it("executes a selected provider and creates provenance automatically", async () => {
    const registry = new FoundryAssetProviderRegistry();
    registry.register({
      descriptor: descriptor(),
      async execute(req) {
        return {
          providerId: "local",
          requestId: req.requestId,
          assetId: req.assetId,
          localPath: "assets/generated/hero.png",
          contentHash: "hash-1",
        };
      },
    });
    const forge = new FoundryAssetForge(registry);
    const result = await forge.execute(request, {
      routing: { requireLocal: true, requireCommercialUse: true },
      createdAt: "2026-09-24T20:00:00.000Z",
    });

    assert.equal(result.provider.id, "local");
    assert.equal(result.manifest.contentHash, "hash-1");
    assert.equal(result.manifest.sourceLicenseIds?.[0], "MIT");
  });

  it("requires an explicit budget before calling a paid provider", async () => {
    let called = false;
    const paid: FoundryAssetProvider = {
      descriptor: descriptor({
        id: "paid",
        name: "Paid",
        local: false,
        requiresNetwork: true,
        externalCost: true,
      }),
      async execute(req) {
        called = true;
        return {
          providerId: "paid",
          requestId: req.requestId,
          assetId: req.assetId,
          cost: { currency: "USD", amount: 1 },
        };
      },
    };
    const registry = new FoundryAssetProviderRegistry();
    registry.register(paid);
    const forge = new FoundryAssetForge(registry);

    await assert.rejects(
      () =>
        forge.execute(request, {
          routing: {
            allowNetwork: true,
            allowExternalCost: true,
          },
        }),
      /explicit cost budget/i,
    );
    assert.equal(called, false);
  });

  it("fails closed when a provider exceeds the allowed cost", async () => {
    const registry = new FoundryAssetProviderRegistry();
    registry.register({
      descriptor: descriptor({
        id: "paid",
        name: "Paid",
        local: false,
        requiresNetwork: true,
        externalCost: true,
      }),
      async execute(req, context) {
        assert.equal(context?.maxCost?.amount, 2);
        return {
          providerId: "paid",
          requestId: req.requestId,
          assetId: req.assetId,
          cost: { currency: "USD", amount: 3 },
        };
      },
    });
    const forge = new FoundryAssetForge(registry);

    await assert.rejects(
      () =>
        forge.execute(request, {
          routing: {
            allowNetwork: true,
            allowExternalCost: true,
            maxEstimatedCost: { currency: "USD", amount: 2 },
          },
        }),
      /exceeded/i,
    );
  });

  it("derives safety classes from provider behavior", () => {
    const policy = operationPolicyForAssetProvider(
      descriptor({
        id: "paid",
        local: false,
        requiresNetwork: true,
        externalCost: true,
      }),
      { maxEstimatedCost: { currency: "USD", amount: 5 } },
    );
    assert.deepEqual(policy.classes, [
      "mutating",
      "network",
      "external_cost",
    ]);
    assert.equal(policy.requiresApproval, true);
    assert.equal(policy.costBudget?.maxAmount, 5);
  });
});
