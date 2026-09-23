import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BlenderAdapter,
  findBlenderExecutable,
  validateBlenderTaskSpec,
  validateExpectedArtifacts,
} from "../studio/adapters/blender/index.js";
import { executeBlenderPythonAsync } from "../studio/adapters/blender/blenderProcess.js";
import { SpecialistError } from "../studio/adapters/types.js";
import type { NssStudioHandoff } from "../studio/types.js";

test("negative: unsupported Blender command rejected", () => {
  assert.throws(
    () =>
      validateBlenderTaskSpec({
        assetName: "n",
        workingDirectory: mkdtempSync(join(tmpdir(), "neg-unsup-")),
        operations: [{ op: "shader.inject" }],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    (e: unknown) => e instanceof SpecialistError && e.code === "UNSUPPORTED_CAPABILITY",
  );
});

test("negative: unsafe output path rejected", () => {
  assert.throws(
    () =>
      validateBlenderTaskSpec({
        assetName: "n",
        workingDirectory: mkdtempSync(join(tmpdir(), "neg-path-")),
        operations: [{ op: "file.save_blend", outputName: "..\\out.blend" }],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    (e: unknown) => e instanceof SpecialistError && e.code === "PERMISSION_DENIED",
  );
});

test("negative: missing blend and zero-byte glb and missing render", () => {
  const dir = mkdtempSync(join(tmpdir(), "neg-arts-"));
  try {
    writeFileSync(join(dir, "zero.glb"), "");
    assert.throws(
      () => validateExpectedArtifacts(dir, [{ kind: "blend", name: "a.blend", required: true }]),
      (e: unknown) => e instanceof SpecialistError && e.code === "VALIDATION_FAILED",
    );
    assert.throws(
      () => validateExpectedArtifacts(dir, [{ kind: "glb", name: "zero.glb", required: true, minBytes: 1 }]),
      (e: unknown) => e instanceof SpecialistError && e.code === "VALIDATION_FAILED",
    );
    assert.throws(
      () => validateExpectedArtifacts(dir, [{ kind: "png", name: "missing.png", required: true }]),
      (e: unknown) => e instanceof SpecialistError && e.code === "VALIDATION_FAILED",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("negative: Blender process crash/nonzero exit is failed not completed", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "neg-crash-"));
  try {
    const script = join(dir, "crash.py");
    writeFileSync(script, "raise SystemExit(7)\n", "utf8");
    const handle = executeBlenderPythonAsync({
      scriptPath: script,
      workingDir: dir,
      timeoutMs: 60_000,
    });
    const res = await handle.promise;
    assert.notEqual(res.exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("negative: Blender process timeout fails closed", async (t) => {
  if (!findBlenderExecutable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "neg-timeout-"));
  try {
    const script = join(dir, "sleep.py");
    writeFileSync(
      script,
      "import time\ntime.sleep(30)\n",
      "utf8",
    );
    const handle = executeBlenderPythonAsync({
      scriptPath: script,
      workingDir: dir,
      timeoutMs: 1500,
    });
    const res = await handle.promise;
    assert.equal(res.timedOut, true);
    assert.notEqual(res.exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("negative: malformed animation action rejected at spec validation", () => {
  assert.throws(
    () =>
      validateBlenderTaskSpec({
        assetName: "n",
        workingDirectory: mkdtempSync(join(tmpdir(), "neg-anim-")),
        operations: [
          {
            op: "animation.insert_keyframe",
            armature: "Armature",
            action: "idle",
            bone: "Spine",
            frame: "nope",
          },
        ],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    (e: unknown) => e instanceof SpecialistError && e.code === "INVALID_TASK",
  );
});

test("negative: adapter does not report completed for rejected task", async () => {
  const dir = mkdtempSync(join(tmpdir(), "neg-adapter-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: dir });
    const bad = join(dir, "bad.json");
    writeFileSync(
      bad,
      JSON.stringify({
        schemaVersion: "1.0.0",
        assetName: "bad",
        operations: [{ op: "mesh.create_primitive", name: "A", primitive: "torus" }],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    );
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h",
      taskId: "t-neg",
      from: "matterhorn",
      to: "blender-engine",
      goal: "bad",
      acceptanceCriteria: ["x"],
      inputArtifacts: [{ kind: "json", uri: bad, label: "blender-task.json" }],
    };
    await assert.rejects(() => adapter.submitTask(handoff));
    const status = await adapter.getTaskStatus("t-neg");
    assert.notEqual(status.phase, "completed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
