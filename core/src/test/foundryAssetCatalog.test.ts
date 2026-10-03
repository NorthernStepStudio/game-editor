import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FoundryAssetCatalog,
  type FoundryAssetManifest,
} from "../foundry/index.js";

function manifest(
  assetId: string,
  overrides: Partial<FoundryAssetManifest> = {},
): FoundryAssetManifest {
  return {
    assetId,
    type: "pixel_sprite",
    sourceIds: ["provider:test"],
    createdAt: "2026-09-24T20:00:00.000Z",
    ...overrides,
  };
}

describe("Foundry asset catalog", () => {
  it("registers executions atomically and resolves provenance", () => {
    const catalog = new FoundryAssetCatalog();
    catalog.registerMany([
      manifest("hero", {
        generationProvider: "sprite-fusion",
        providerRequestId: "req-remote",
        providerAssetId: "asset-remote",
        localPath: "assets/hero.png",
        contentHash: "hash",
      }),
      manifest("tree"),
    ]);

    assert.equal(catalog.list().length, 2);
    assert.deepEqual(catalog.resolve("hero"), {
      assetId: "hero",
      generationProvider: "sprite-fusion",
      providerAssetId: "asset-remote",
      providerRequestId: "req-remote",
      localPath: "assets/hero.png",
      contentHash: "hash",
    });
  });

  it("rejects duplicate ids without partially mutating the catalog", () => {
    const catalog = new FoundryAssetCatalog();
    assert.throws(
      () =>
        catalog.registerMany([
          manifest("hero"),
          manifest("hero", { type: "sprite_sheet" }),
        ]),
      /duplicate assetId/i,
    );
    assert.equal(catalog.list().length, 0);
  });

  it("returns root-to-leaf lineage for edits and animations", () => {
    const catalog = new FoundryAssetCatalog();
    catalog.registerMany([
      manifest("hero-base"),
      manifest("hero-run-pose", { parentAsset: "hero-base" }),
      manifest("hero-run", { parentAsset: "hero-run-pose" }),
    ]);

    assert.deepEqual(
      catalog.lineage("hero-run").map((item) => item.assetId),
      ["hero-base", "hero-run-pose", "hero-run"],
    );
  });

  it("fails closed on missing parents", () => {
    const catalog = new FoundryAssetCatalog();
    catalog.register(manifest("hero-run", { parentAsset: "missing" }));
    assert.throws(() => catalog.lineage("hero-run"), /missing parent/i);
  });

  it("detects lineage cycles", () => {
    const catalog = new FoundryAssetCatalog();
    catalog.registerMany([
      manifest("a", { parentAsset: "b" }),
      manifest("b", { parentAsset: "a" }),
    ]);
    assert.throws(() => catalog.lineage("a"), /cycle/i);
  });
});
