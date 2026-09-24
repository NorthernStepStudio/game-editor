import assert from "node:assert/strict";
import { test } from "node:test";
import {
  YUN_ENVIRONMENT_SPECS,
  resolveYunEnvironmentSpecFromGoal,
  validateYunEnvironmentSpec,
} from "../studio/adapters/blender/index.js";

test("complete Yun environment set has four unique, validated map assets", () => {
  assert.equal(YUN_ENVIRONMENT_SPECS.length, 4);
  assert.deepEqual(YUN_ENVIRONMENT_SPECS.map((spec) => spec.theme), ["calle", "malecon", "parque", "noche"]);
  assert.equal(new Set(YUN_ENVIRONMENT_SPECS.map((spec) => spec.assetId)).size, 4);
  for (const spec of YUN_ENVIRONMENT_SPECS) {
    assert.deepEqual(validateYunEnvironmentSpec(spec), [], spec.assetId);
    assert.equal(spec.includesGameplayCourtGeometry, false, `${spec.assetId} must leave court geometry to YunCourt`);
    assert.equal(new Set(spec.props.map((prop) => prop.id)).size, spec.props.length, `${spec.assetId} prop IDs are unique`);
  }
});

test("Yun environment requests route to their registered asset while ordinary night props do not", () => {
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun environment Calle")?.assetId, "yun_street_block_calle_v1");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun environment Malecón")?.assetId, "yun_street_block_malecon_v1");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun environment Parque")?.assetId, "yun_street_block_parque_v1");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Generate Yun environment Noche")?.assetId, "yun_street_block_noche_v1");
  assert.equal(resolveYunEnvironmentSpecFromGoal("Create a night lamp"), undefined);
});
