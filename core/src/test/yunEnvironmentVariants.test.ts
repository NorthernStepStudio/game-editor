import assert from "node:assert/strict";
import { test } from "node:test";
import {
  YUN_ENVIRONMENT_MATERIAL_PALETTES,
  YUN_ENVIRONMENT_SPECS,
  YUN_MALECON_ENVIRONMENT_SPEC,
  YUN_NOCHE_ENVIRONMENT_SPEC,
  YUN_PARQUE_ENVIRONMENT_SPEC,
  buildYunEnvironmentOperations,
  resolveYunEnvironmentSpecFromGoal,
  validateYunEnvironmentSpec,
} from "../studio/adapters/blender/index.js";

test("Yun environment registry contains four unique validated themes", () => {
  assert.equal(YUN_ENVIRONMENT_SPECS.length, 4);
  assert.deepEqual(
    YUN_ENVIRONMENT_SPECS.map((spec) => spec.theme),
    ["calle", "malecon", "parque", "noche"],
  );
  assert.equal(new Set(YUN_ENVIRONMENT_SPECS.map((spec) => spec.assetId)).size, 4);
  for (const spec of YUN_ENVIRONMENT_SPECS) {
    assert.deepEqual(validateYunEnvironmentSpec(spec), [], spec.assetId);
    assert.equal(spec.includesGameplayCourtGeometry, false);
  }
});

test("Yun environment goals resolve only in Yun environment context", () => {
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun environment Malecón")?.theme, "malecon");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun map Parque")?.theme, "parque");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun street Noche")?.theme, "noche");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun environment Calle")?.theme, "calle");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Create a night lamp"), undefined);
});

test("environment themes produce distinct palettes and preview worlds", () => {
  assert.notDeepEqual(
    YUN_ENVIRONMENT_MATERIAL_PALETTES.malecon,
    YUN_ENVIRONMENT_MATERIAL_PALETTES.parque,
  );
  assert.notDeepEqual(
    YUN_ENVIRONMENT_MATERIAL_PALETTES.noche,
    YUN_ENVIRONMENT_MATERIAL_PALETTES.calle,
  );
});

test("Malecón, Parque, and Noche compile through the shared Blender fixture", () => {
  for (const spec of [
    YUN_MALECON_ENVIRONMENT_SPEC,
    YUN_PARQUE_ENVIRONMENT_SPEC,
    YUN_NOCHE_ENVIRONMENT_SPEC,
  ]) {
    const ops = buildYunEnvironmentOperations(spec);
    assert.ok(ops.some((op) => op.op === "world.set_background"));
    assert.equal(ops.filter((op) => op.op === "material.create").length, 10);
    assert.ok(ops.filter((op) => op.op === "mesh.create_primitive").length > 30);
    assert.ok(!ops.some((op) =>
      op.op === "mesh.create_primitive" &&
      /yun_ring|turn_ring|tube_|spine|court_marking/i.test(op.name)
    ));
  }
});
