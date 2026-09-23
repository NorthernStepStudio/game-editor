import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BlenderAdapter, findBlenderExecutable } from "../studio/adapters/blender/index.js";
import { SpecialistError } from "../studio/adapters/types.js";
import type { NssStudioHandoff } from "../studio/types.js";

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

test("BlenderAdapter getCapabilities returns structured 3D, render, and export capabilities", async () => {
  const adapter = new BlenderAdapter();
  const caps = await adapter.getCapabilities();
  assert.equal(caps.specialistId, "blender-engine");
  assert.ok(caps.capabilities.includes("blender.mesh.create"));
  assert.ok(caps.capabilities.includes("blender.render.preview"));
  assert.ok(caps.capabilities.includes("blender.export.glb"));
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

test("BlenderAdapter creates crate, renders preview, exports GLB and returns structured evidence", async () => {
  const bin = findBlenderExecutable();
  if (!bin) return; // Skip live test if blender binary is absent

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

    const status = await adapter.getTaskStatus("t-crate-1");
    assert.equal(status.phase, "completed");

    const result = await adapter.getResult("t-crate-1");
    assert.equal(result.specialistId, "blender-engine");
    assert.equal(result.status, "completed");
    assert.ok(result.artifacts && result.artifacts.length >= 4);

    const glbRef = result.artifacts.find((a) => a.kind === "glb");
    const pngRef = result.artifacts.find((a) => a.kind === "preview");
    const blendRef = result.artifacts.find((a) => a.kind === "blend");
    const reportRef = result.artifacts.find((a) => a.kind === "report");

    assert.ok(glbRef && existsSync(glbRef.uri));
    assert.ok(pngRef && existsSync(pngRef.uri));
    assert.ok(blendRef && existsSync(blendRef.uri));
    assert.ok(reportRef && existsSync(reportRef.uri));

    const reportData = JSON.parse(readFileSync(reportRef.uri, "utf8"));
    assert.equal(reportData.success, true);
    assert.equal(reportData.meshObjectsCount, 2);
    assert.ok(result.evidence && result.evidence.length >= 3);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
