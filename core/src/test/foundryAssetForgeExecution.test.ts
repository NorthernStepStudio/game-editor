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
          outputs: [
            {
              providerId: "local",
              requestId: req.requestId,
              outputIndex: 0,
              localPath: "assets/generated/hero.png",
              contentHash: "hash-1",
            },
          ],
        };
      },
    });
    const forge = new FoundryAssetForge(registry);
    const result = await forge.execute(request, {
      routing: { requireLocal: true, requireCommercialUse: true },
      createdAt: "2026-09-24T20:00:00.000Z",
    });

    assert.equal(result.provider.id, "local");
    assert.equal(result.manifests[0].contentHash, "hash-1");
    assert.equal(result.manifests[0].sourceLicenseIds?.[0], "MIT");
  });

  it("preserves every output in a generation batch", async () => {
    const registry = new FoundryAssetProviderRegistry();
    registry.register({
      descriptor: descriptor(),
      async execute(req) {
        return {
          providerRequestId: "provider-req-1",
          outputs: [0, 1, 2].map((outputIndex) => ({
            providerId: "local",
            requestId: req.requestId,
            outputIndex,
            providerAssetId: `remote-${outputIndex}`,
          })),
        };
      },
    });
    const forge = new FoundryAssetForge(registry);
    const result = await forge.execute(request);

    assert.deepEqual(
      result.manifests.map((manifest) => manifest.assetId),
      ["hero-01", "hero-02", "hero-03"],
    );
    assert.deepEqual(
      result.manifests.map((manifest) => manifest.providerAssetId),
      ["remote-0", "remote-1", "remote-2"],
    );
    assert.ok(
      result.manifests.every(
        (manifest) => manifest.providerRequestId === "provider-req-1",
      ),
    );
  });

  it("publishes successful executions to the persistence hook", async () => {
    const registry = new FoundryAssetProviderRegistry();
    registry.register({
      descriptor: descriptor(),
      async execute(req) {
        return {
          outputs: [
            {
              providerId: "local",
              requestId: req.requestId,
              outputIndex: 0,
              contentHash: "persisted-hash",
            },
          ],
        };
      },
    });

    const seen: string[] = [];
    const forge = new FoundryAssetForge(registry, {
      onExecution(execution) {
        seen.push(execution.manifests[0].assetId);
      },
    });
    const result = await forge.execute(request);
    assert.equal(result.manifests[0].assetId, "hero");
    assert.deepEqual(seen, ["hero"]);
  });

  it("fails closed when successful output cannot be persisted", async () => {
    const registry = new FoundryAssetProviderRegistry();
    registry.register({
      descriptor: descriptor(),
      async execute(req) {
        return {
          outputs: [
            {
              providerId: "local",
              requestId: req.requestId,
              outputIndex: 0,
            },
          ],
        };
      },
    });

    const forge = new FoundryAssetForge(registry, {
      onExecution() {
        throw new Error("catalog unavailable");
      },
    });
    await assert.rejects(() => forge.execute(request), /catalog unavailable/i);
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
          outputs: [
            {
              providerId: "paid",
              requestId: req.requestId,
              outputIndex: 0,
            },
          ],
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

  it("fails closed when a provider exceeds the allowed batch cost", async () => {
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
          outputs: [
            {
              providerId: "paid",
              requestId: req.requestId,
              outputIndex: 0,
            },
          ],
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

  it("rejects duplicate output indexes instead of overwriting provenance", async () => {
    const registry = new FoundryAssetProviderRegistry();
    registry.register({
      descriptor: descriptor(),
      async execute(req) {
        return {
          outputs: [
            { providerId: "local", requestId: req.requestId, outputIndex: 0 },
            { providerId: "local", requestId: req.requestId, outputIndex: 0 },
          ],
        };
      },
    });
    const forge = new FoundryAssetForge(registry);
    await assert.rejects(() => forge.execute(request), /duplicate outputIndex/i);
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
