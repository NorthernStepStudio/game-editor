import { strict as assert } from "node:assert";
import { test } from "node:test";
import { extractPythonScript, guardBlenderAgentScript } from "../foundry/assets/providers/blenderAgent/scriptGuard.js";

test("Blender Agent guard accepts ordinary modeling scripts", () => {
  const script = `import bpy
import bmesh
from mathutils import Vector
import math, random

def build():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
    crate = bpy.context.active_object
    crate.name = "Crate"
    mat = bpy.data.materials.new("Wood")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.5, 0.3, 0.1, 1)
    crate.data.materials.append(mat)

if __name__ == "__main__":
    build()
`;
  assert.deepEqual(guardBlenderAgentScript(script), { ok: true, problems: [] });
});

test("Blender Agent guard rejects file, process, network and introspection escapes", () => {
  const cases: Record<string, string> = {
    "import os": "import of 'os'",
    "import subprocess as sp": "import of 'subprocess'",
    "from pathlib import Path": "import from 'pathlib'",
    "data = open('C:/secrets.txt').read()": "builtin escape hatch",
    "eval('1+1')": "builtin escape hatch",
    "x = ().__class__.__bases__[0].__subclasses__()": "introspection",
    "bpy.ops.wm.save_as_mainfile(filepath='x.blend')": "reserved for the harness",
    "bpy.ops.export_scene.gltf(filepath='x.glb')": "reserved for the harness",
    "bpy.app.handlers.load_post.append(f)": "handlers",
    "bpy.data.texts.new('run')": "text blocks",
    "img.filepath = 'C:/x.png'": "file paths",
    "bpy.ops.object.join()": "do not join objects",
    "g = frame.f_globals": "frame/code introspection",
    "c = fn.f_back": "frame/code introspection",
    "f = lambda: 0\nf.__globals__": "introspection",
  };
  for (const [line, expected] of Object.entries(cases)) {
    const result = guardBlenderAgentScript(`import bpy\n${line}\n`);
    assert.equal(result.ok, false, line);
    assert.ok(result.problems.some((problem) => problem.includes(expected)), `${line} -> ${result.problems.join(" | ")}`);
  }
});

test("Blender Agent guard ignores comments but not code after strings or semicolons", () => {
  assert.equal(guardBlenderAgentScript("import bpy\n# import os would be bad\n").ok, true);
  assert.equal(guardBlenderAgentScript("import bpy\nname = 'a#b'; import os\n").ok, false);
  assert.equal(guardBlenderAgentScript("import bpy\nx = 1; from socket import socket\n").ok, false);
});

test("extractPythonScript unwraps fenced replies", () => {
  assert.equal(extractPythonScript("Here you go:\n```python\nimport bpy\nprint(1)\n```\nEnjoy"), "import bpy\nprint(1)\n");
  assert.equal(extractPythonScript("import bpy"), "import bpy\n");
});

test("Blender Agent carries on with the backup AI when the main one stops working", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { BlenderAgentAssetProvider } = await import("../foundry/assets/providers/blenderAgent/blenderAgentProvider.js");
  const calls = { main: 0, backup: 0 };
  const main = {
    id: "claude-code" as const,
    label: "Claude Code",
    async author(): Promise<string> {
      calls.main += 1;
      throw new Error("Claude's usage limit is reached for now.");
    },
  };
  const backup = {
    id: "ollama" as const,
    label: "Ollama",
    model: "qwen2.5-coder:14b",
    async author(): Promise<string> {
      calls.backup += 1;
      return "import bpy\nbpy.ops.mesh.primitive_cube_add(size=1)\n";
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "fallback-"));
  const progress: string[] = [];
  try {
    // A stand-in "Blender" that exits at once: the build fails at Blender, but only after the hand-off.
    const provider = new BlenderAgentAssetProvider({ author: main, fallbackAuthor: backup, blenderExecutable: process.execPath, maxAttempts: 2, blenderTimeoutMs: 20_000 });
    await assert.rejects(provider.execute(
      { requestId: "r", assetId: "crate", kind: "mesh_3d", operation: "generate", prompt: "a crate" },
      { outputRoot: dir, onProgress: (m) => progress.push(m) },
    ));
    assert.equal(calls.main, 1, "the main AI is not retried once it has stopped working");
    assert.equal(calls.backup, 2, "the backup AI writes every remaining attempt");
    assert.ok(progress.some((m) => /Claude Code is unavailable \(Claude's usage limit.*Continuing with Ollama \(qwen2\.5-coder:14b\)/.test(m)), progress.join("\n"));
    assert.ok(progress.some((m) => m.startsWith("Attempt 2/2: Ollama is writing")), progress.join("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
