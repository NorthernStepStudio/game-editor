import assert from "node:assert/strict";
import { test } from "node:test";
import {
  YUN_FIRST_ENVIRONMENT_SPEC,
  buildYunEnvironmentOperations,
  buildYunEnvironmentTaskSpec,
  findYunEnvironmentPlayAreaIntrusions,
  godotToBlenderPosition,
} from "../studio/adapters/blender/index.js";

test("Yun environment axis conversion maps Godot Y-up to Blender Z-up", () => {
  assert.deepEqual(godotToBlenderPosition([14.4, 2.5, 8.1]), [14.4, 8.1, 2.5]);
});

test("first Calle environment keeps solid props outside the authoritative play area", () => {
  assert.deepEqual(findYunEnvironmentPlayAreaIntrusions(YUN_FIRST_ENVIRONMENT_SPEC), []);
});

test("environment fixture compiles from bounded Blender operations", () => {
  const ops = buildYunEnvironmentOperations(YUN_FIRST_ENVIRONMENT_SPEC);
  assert.ok(ops.some((op) => op.op === "scene.new"));
  assert.ok(ops.some((op) => op.op === "render.multi_view"));
  assert.ok(ops.some((op) => op.op === "export.glb"));
  assert.ok(!ops.some((op) => op.op === "rig.create_armature"));
});

test("environment task requires durable art/evidence artifacts", () => {
  const spec = buildYunEnvironmentTaskSpec(
    YUN_FIRST_ENVIRONMENT_SPEC,
    ".matterhorn/blender-tests/yun-street-calle",
  );
  const names = new Set(spec.expectedArtifacts.map((a) => a.name));
  assert.ok(names.has("yun_street_block_calle_v1.blend"));
  assert.ok(names.has("yun_street_block_calle_v1.glb"));
  assert.ok(names.has("yun_street_block_calle_v1-front.png"));
  assert.ok(names.has("yun_street_block_calle_v1-three-quarter.png"));
});

test("environment fixture rejects a static prop intruding into Yun play area", () => {
  const bad = {
    ...YUN_FIRST_ENVIRONMENT_SPEC,
    props: [
      ...YUN_FIRST_ENVIRONMENT_SPEC.props,
      {
        id: "bad_center_bench",
        kind: "bench" as const,
        position: [14.4, 0, 8.1] as const,
        collision: "static" as const,
      },
    ],
  };
  assert.deepEqual(findYunEnvironmentPlayAreaIntrusions(bad), ["bad_center_bench"]);
  assert.throws(
    () => buildYunEnvironmentTaskSpec(bad, ".matterhorn/blender-tests/bad-env"),
    /intrude into Yun play area/,
  );
});
