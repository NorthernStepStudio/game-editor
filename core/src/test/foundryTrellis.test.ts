import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  findTrellisTool,
  parseTrellisSettings,
  TrellisImageTo3DProvider,
  trellisStep,
} from "../foundry/assets/providers/trellis/trellisProvider.js";
import { TRELLIS_BLENDER_SCRIPT } from "../foundry/assets/providers/trellis/trellisScript.js";

test("TRELLIS runs on this PC for free and only builds from a picture", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trellis-"));
  try {
    const picture = join(dir, "front.png");
    writeFileSync(picture, "png");
    const provider = new TrellisImageTo3DProvider({
      tool: { cli: "trellis-cli", models: dir },
      resolveImagePath: (id) => (id === "front" ? picture : id === "model" ? join(dir, "model.glb") : undefined),
      runTrellis: async () => { throw new Error("must not run"); },
    });
    assert.equal(provider.descriptor.local, true);
    assert.equal(provider.descriptor.requiresNetwork, false);
    assert.equal(provider.descriptor.externalCost, false);
    assert.deepEqual(provider.descriptor.operations, ["image_to_3d"]);
    const base = { requestId: "r", assetId: "x", kind: "mesh_3d" as const, operation: "image_to_3d" as const };
    await assert.rejects(provider.execute(base), /output folder/);
    await assert.rejects(provider.execute(base, { outputRoot: dir }), /Choose the picture/);
    await assert.rejects(provider.execute({ ...base, referenceAssets: ["model"] }, { outputRoot: dir }), /not a PNG/);
    await assert.rejects(provider.execute({ ...base, referenceAssets: ["front"], parameters: { crop: [0, 0, 2, 1] } }, { outputRoot: dir }), /crop must be/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("TRELLIS settings: crop as fractions, standard quality and the mini characters' height by default", () => {
  assert.deepEqual(parseTrellisSettings(undefined), { quality: "standard", height: 0.72, maxFaces: 40_000 });
  assert.deepEqual(parseTrellisSettings({ crop: [0.1, 0.2, 0.5, 0.9], quality: "high", height: 1.8, maxFaces: 12_000 }),
    { crop: [0.1, 0.2, 0.5, 0.9], quality: "high", height: 1.8, maxFaces: 12_000 });
  assert.deepEqual(parseTrellisSettings({ quality: "ultra", height: -1, maxFaces: 5 }), { quality: "standard", height: 0.72, maxFaces: 40_000 });
  assert.throws(() => parseTrellisSettings({ crop: [0.5, 0.5, 0.505, 0.9] }), /too small/);
  assert.throws(() => parseTrellisSettings({ crop: "all" }), /crop must be/);
});

test("TRELLIS progress lines become steps 1 to 7", () => {
  assert.equal(trellisStep("[2/6] DINOv3 conditioning"), 2);
  assert.equal(trellisStep("  [5/7] FlexiDualGrid shape decode -> mesh @res512"), 5);
  assert.equal(trellisStep("[trellis:dbg] shape_decode done in 7.2 ms"), undefined);
  assert.equal(trellisStep("[9/7] nope"), undefined);
});

test("TRELLIS is found only when the program and its models are installed", () => {
  const dir = mkdtempSync(join(tmpdir(), "trellis-tool-"));
  try {
    assert.equal(findTrellisTool(dir), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Blender steps cut out the background, drop stray specks and fit the model to the game", () => {
  assert.match(TRELLIS_BLENDER_SCRIPT, /def prepare\(\):/);
  assert.match(TRELLIS_BLENDER_SCRIPT, /kept the picture's own transparency/);
  assert.match(TRELLIS_BLENDER_SCRIPT, /keep only pieces of a real size/);
  assert.match(TRELLIS_BLENDER_SCRIPT, /o\.name = o\.data\.name = "Body"/);
  assert.match(TRELLIS_BLENDER_SCRIPT, /DECIMATE/);
});

test("a sheet's other views are boxes too, and repainting needs a model and at least one of them", async () => {
  assert.deepEqual(parseTrellisSettings({ crop: [0, 0.1, 0.2, 0.5], views: { back: [0.4, 0.1, 0.6, 0.5] } }).views, { back: [0.4, 0.1, 0.6, 0.5] });
  assert.throws(() => parseTrellisSettings({ views: { top: [0, 0, 0.5, 0.5] } }), /Unknown view/);
  assert.throws(() => parseTrellisSettings({ views: { back: [0, 0, 0.01, 0.5] } }), /back view is too small/);
  const dir = mkdtempSync(join(tmpdir(), "trellis-paint-"));
  try {
    const sheet = join(dir, "sheet.png");
    const model = join(dir, "model.glb");
    writeFileSync(sheet, "png");
    writeFileSync(model, "glb");
    const provider = new TrellisImageTo3DProvider({
      tool: { cli: "trellis-cli", models: dir },
      resolveImagePath: (id) => (id === "sheet" ? sheet : undefined),
      resolveModelFile: (id) => (id === "model" ? model : undefined),
      runTrellis: async () => { throw new Error("repainting must not rebuild"); },
    });
    const base = { requestId: "r", assetId: "x", kind: "mesh_3d" as const, operation: "image_to_3d" as const, parentAsset: "model" };
    await assert.rejects(provider.execute(base, { outputRoot: dir }), /character sheet to paint from/);
    await assert.rejects(provider.execute({ ...base, referenceAssets: ["sheet"] }, { outputRoot: dir }), /back, right or left/);
    await assert.rejects(provider.execute({ ...base, parentAsset: "gone", referenceAssets: ["sheet"], parameters: { views: { back: [0.4, 0.1, 0.6, 0.5] } } }, { outputRoot: dir }), /no \.glb model/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("painting keeps the model's own front and paints only what clearly faces the back and side views", () => {
  assert.match(TRELLIS_BLENDER_SCRIPT, /def paint_from_views\(\):/);
  // the front view only teaches colours; it never projects onto the model
  assert.match(TRELLIS_BLENDER_SCRIPT, /if name == "front":[\s\S]*?match_x\.append[\s\S]*?weight = np\.zeros\(len\(TX\)\)/);
  // a depth test, so an arm never paints the body behind it
  assert.match(TRELLIS_BLENDER_SCRIPT, /POS @ d <= depth\[iyc, dx\]/);
  // colour groups whose matches disagree (eyes mixed with dark hair) are left alone
  assert.match(TRELLIS_BLENDER_SCRIPT, /spread > 0\.12/);
});
