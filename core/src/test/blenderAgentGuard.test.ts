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
