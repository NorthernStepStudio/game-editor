import assert from "node:assert/strict";
import { test } from "node:test";
import {
  YUN_COURT_CONTRACT,
  YUN_COURT_WORLD_METRICS,
  YUN_FIRST_ENVIRONMENT_SPEC,
  validateYunEnvironmentSpec,
} from "../studio/adapters/blender/index.js";

test("Yun environment contract preserves production court geometry", () => {
  assert.equal(YUN_COURT_CONTRACT.planarToWorld, 0.025);
  assert.equal(YUN_COURT_WORLD_METRICS.playableWidth, 20.8);
  assert.equal(YUN_COURT_WORLD_METRICS.headToTurnLength, 12.25);
  assert.deepEqual(YUN_COURT_CONTRACT.tubeY, [190, 320, 450]);
  assert.equal(YUN_FIRST_ENVIRONMENT_SPEC.includesGameplayCourtGeometry, false);
  assert.deepEqual(validateYunEnvironmentSpec(YUN_FIRST_ENVIRONMENT_SPEC), []);
});

test("Yun environment contract rejects replacing gameplay court geometry", () => {
  const invalid = {
    ...YUN_FIRST_ENVIRONMENT_SPEC,
    includesGameplayCourtGeometry: true,
  } as unknown as typeof YUN_FIRST_ENVIRONMENT_SPEC;
  assert.match(
    validateYunEnvironmentSpec(invalid).join("; "),
    /must not replace authoritative YunCourt gameplay geometry/,
  );
});

test("Yun environment contract rejects duplicate props", () => {
  const duplicate = {
    ...YUN_FIRST_ENVIRONMENT_SPEC,
    props: [
      ...YUN_FIRST_ENVIRONMENT_SPEC.props,
      YUN_FIRST_ENVIRONMENT_SPEC.props[0]!,
    ],
  };
  assert.match(validateYunEnvironmentSpec(duplicate).join("; "), /duplicate prop id/);
});
