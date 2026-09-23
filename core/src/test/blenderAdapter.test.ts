import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BlenderAdapter,
  findBlenderExecutable,
  validateBlenderTaskSpec,
  validateExpectedArtifacts,
  buildCrateTaskSpec,
} from "../studio/adapters/blender/index.js";
import { SpecialistError } from "../studio/adapters/types.js";
import type { NssStudioHandoff } from "../studio/types.js";

function liveBlenderAvailable(): boolean {
  return Boolean(findBlenderExecutable());
}

test("BlenderAdapter health reports available blender-engine and executable path", async () => {
  const adapter = new BlenderAdapter();
  const health = await adapter.health();
  assert.equal(health.specialistId, "blender-engine");
  const bin = findBlenderExecutable();
  if (bin) {
    assert.equal(health.available, true);
    assert.ok(health.version);
    assert.ok(health.detail?.includes("path="));
  } else {
    assert.equal(health.available, false);
  }
});

test("BlenderAdapter getCapabilities returns only implemented capabilities including rig/animation", async () => {
  const adapter = new BlenderAdapter();
  const caps = await adapter.getCapabilities();
  assert.equal(caps.specialistId, "blender-engine");
  assert.ok(caps.capabilities.includes("blender.mesh.create"));
  assert.ok(caps.capabilities.includes("blender.render.preview"));
  assert.ok(caps.capabilities.includes("blender.export.glb"));
  assert.ok(caps.capabilities.includes("blender.rig.create"));
  assert.ok(caps.capabilities.includes("blender.animation.create"));
  assert.ok(caps.capabilities.includes("blender.export.character_glb"));
});

test("BlenderAdapter rejects tasks assigned to non-blender specialists", async () => {
  const adapter = new BlenderAdapter();
  const invalidHandoff: NssStudioHandoff = {
    protocol: "nss.studio-handoff.v1",
    id: "h-wrong",
    taskId: "t-wrong",
    from: "matterhorn",
    to: "flyrail",
    goal: "Generate crate asset",
    acceptanceCriteria: ["Asset generated"],
    inputArtifacts: [],
  };

  await assert.rejects(
    () => adapter.submitTask(invalidHandoff),
    (err: unknown) => err instanceof SpecialistError && err.code === "INVALID_TASK",
  );
});

test("validateBlenderTaskSpec rejects unknown commands and unsafe paths", () => {
  assert.throws(
    () =>
      validateBlenderTaskSpec({
        assetName: "x",
        workingDirectory: join(tmpdir(), "blender-spec-ok"),
        operations: [{ op: "mesh.hack_the_planet" }],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    (err: unknown) => err instanceof SpecialistError && err.code === "UNSUPPORTED_CAPABILITY",
  );

  assert.throws(
    () =>
      validateBlenderTaskSpec({
        assetName: "x",
        workingDirectory: join(tmpdir(), "blender-spec-ok"),
        operations: [{ op: "export.glb", outputName: "../escape.glb" }],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    (err: unknown) => err instanceof SpecialistError && err.code === "PERMISSION_DENIED",
  );

  assert.throws(
    () =>
      validateBlenderTaskSpec({
        assetName: "x",
        workingDirectory: join(tmpdir(), "blender-spec-ok"),
        operations: [{ op: "mesh.create_primitive", name: "A", primitive: "cube", size: Number.NaN }],
        expectedArtifacts: [],
        acceptanceCriteria: ["x"],
      }),
    (err: unknown) => err instanceof SpecialistError && err.code === "INVALID_TASK",
  );
});

test("validateExpectedArtifacts rejects zero-byte GLB and path escape", () => {
  const dir = mkdtempSync(join(tmpdir(), "matterhorn-artifact-"));
  try {
    const glb = join(dir, "empty.glb");
    writeFileSync(glb, "");
    assert.throws(
      () =>
        validateExpectedArtifacts(dir, [{ kind: "glb", name: "empty.glb", required: true, minBytes: 1 }]),
      (err: unknown) => err instanceof SpecialistError && err.code === "VALIDATION_FAILED",
    );
    assert.throws(
      () => validateExpectedArtifacts(dir, [{ kind: "glb", name: "missing.glb", required: true }]),
      (err: unknown) => err instanceof SpecialistError && err.code === "VALIDATION_FAILED",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("BlenderAdapter creates crate via structured ops, renders preview, exports GLB", async (t) => {
  if (!liveBlenderAvailable()) {
    t.diagnostic("SKIPPED — environment unavailable (Blender binary not found)");
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-blender-test-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: tempDir });
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-crate-1",
      taskId: "t-crate-1",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Generate stylized game crate asset",
      acceptanceCriteria: ["crate.blend created", "preview PNG rendered", "crate.glb exported"],
      inputArtifacts: [],
    };

    const handle = await adapter.submitTask(handoff);
    assert.equal(handle.accepted, true);

    const statusRunning = await adapter.getTaskStatus("t-crate-1");
    assert.ok(statusRunning.phase === "running" || statusRunning.phase === "accepted" || statusRunning.phase === "completed");

    const result = await adapter.getResult("t-crate-1");
    assert.equal(result.specialistId, "blender-engine");
    assert.equal(result.status, "completed");
    assert.ok(result.artifacts && result.artifacts.length >= 4);

    const glbRef = result.artifacts.find((a) => a.kind === "glb");
    const pngRef = result.artifacts.find((a) => a.kind === "preview");
    const blendRef = result.artifacts.find((a) => a.kind === "blend");
    const reportRef = result.artifacts.find((a) => a.label === "blender-report.json" || a.kind === "report");

    assert.ok(glbRef && existsSync(glbRef.uri));
    assert.ok(pngRef && existsSync(pngRef.uri));
    assert.ok(blendRef && existsSync(blendRef.uri));
    assert.ok(reportRef && existsSync(reportRef.uri));

    const taskManifest = join(tempDir, "t-crate-1", "blender-task.json");
    const resultManifest = join(tempDir, "t-crate-1", "blender-result.json");
    assert.ok(existsSync(taskManifest));
    assert.ok(existsSync(resultManifest));

    const reportData = JSON.parse(readFileSync(join(tempDir, "t-crate-1", "blender-report.json"), "utf8"));
    assert.equal(reportData.success, true);
    assert.ok(reportData.executionId);
    assert.ok(result.evidence && result.evidence.length >= 1);

    // Fixture still builds from primitives
    const fixture = buildCrateTaskSpec(join(tempDir, "unused"));
    assert.ok(fixture.operations.some((op) => op.op === "mesh.create_primitive"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("BlenderAdapter rejects unsupported operation in submitted task spec", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "matterhorn-blender-neg-"));
  try {
    const adapter = new BlenderAdapter({ baseWorkDir: tempDir });
    const badSpecPath = join(tempDir, "bad-task.json");
    writeFileSync(
      badSpecPath,
      JSON.stringify({
        schemaVersion: "1.0.0",
        assetName: "bad",
        operations: [{ op: "python.eval", code: "print(1)" }],
        expectedArtifacts: [],
        acceptanceCriteria: ["no"],
      }),
      "utf8",
    );
    const handoff: NssStudioHandoff = {
      protocol: "nss.studio-handoff.v1",
      id: "h-bad",
      taskId: "t-bad",
      from: "matterhorn",
      to: "blender-engine",
      goal: "Run arbitrary python",
      acceptanceCriteria: ["no"],
      inputArtifacts: [{ kind: "json", uri: badSpecPath, label: "blender-task.json" }],
    };
    await assert.rejects(
      () => adapter.submitTask(handoff),
      (err: unknown) => err instanceof SpecialistError && err.code === "UNSUPPORTED_CAPABILITY",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
