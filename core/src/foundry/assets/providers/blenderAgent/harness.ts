/**
 * Matterhorn-owned Blender harness. It runs the guarded model script with a
 * restricted builtins table and import allowlist, validates the resulting
 * scene, then performs every file operation itself: .blend source, GLB
 * export, turnaround renders, directional sprite sheets and pixel sprites.
 *
 * Invoked as: blender --background --factory-startup --disable-autoexec
 *   --python-exit-code 1 --python harness.py -- job.json
 */
export const BLENDER_AGENT_HARNESS = String.raw`
import bpy, sys, json, math, traceback, builtins
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
with open(argv[0], "r", encoding="utf-8") as handle:
    CFG = json.load(handle)

OUT = CFG["outputDir"]
REPORT = {"ok": False, "stage": "start", "files": {}, "renders": {}}

def write_report():
    with open(CFG["reportPath"], "w", encoding="utf-8") as handle:
        json.dump(REPORT, handle, indent=2)

def fail(stage, message):
    REPORT["ok"] = False
    REPORT["stage"] = stage
    REPORT["error"] = message[-4000:]
    write_report()
    sys.exit(1)

def path(name):
    return OUT.rstrip("/\\") + "/" + name

# ---------------------------------------------------------------- run script
bpy.ops.wm.read_factory_settings(use_empty=True)
REPORT["stage"] = "script"
with open(CFG["scriptPath"], "r", encoding="utf-8") as handle:
    SOURCE = handle.read()

ALLOWED = set(CFG["allowedModules"])
_real_import = builtins.__import__

def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level != 0 or name.split(".")[0] not in ALLOWED:
        raise ImportError("Import of '%s' is not allowed in asset scripts." % name)
    return _real_import(name, globals, locals, fromlist, level)

SAFE = [
    "abs", "all", "any", "bool", "chr", "classmethod", "complex", "dict", "divmod",
    "enumerate", "filter", "float", "format", "frozenset", "hasattr", "hash", "int",
    "isinstance", "issubclass", "iter", "len", "list", "map", "max", "min", "next",
    "object", "ord", "pow", "print", "property", "range", "repr", "reversed", "round",
    "set", "slice", "sorted", "staticmethod", "str", "sum", "super", "tuple", "zip",
    "Exception", "ValueError", "TypeError", "KeyError", "IndexError", "RuntimeError",
    "ZeroDivisionError", "StopIteration", "AttributeError", "ArithmeticError", "LookupError",
]
SAFE_BUILTINS = {name: getattr(builtins, name) for name in SAFE}
SAFE_BUILTINS["__import__"] = _guarded_import
SAFE_BUILTINS["__build_class__"] = builtins.__build_class__
SCRIPT_GLOBALS = {"__builtins__": SAFE_BUILTINS, "__name__": "__main__"}

try:
    exec(compile(SOURCE, "asset_script.py", "exec"), SCRIPT_GLOBALS)
except SystemExit:
    fail("script", "Asset scripts may not exit Blender.")
except Exception:
    fail("script", traceback.format_exc(limit=8))

# ------------------------------------------------------------ validate scene
REPORT["stage"] = "validate"
scene = bpy.context.scene
for obj in list(scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

meshes = [o for o in scene.objects if o.type == "MESH" and o.visible_get()]
if not meshes:
    fail("validate", "The script created no visible mesh objects.")

depsgraph = bpy.context.evaluated_depsgraph_get()
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
verts = 0
tris = 0
materials = set()
for obj in meshes:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    verts += len(mesh.vertices)
    mesh.calc_loop_triangles()
    tris += len(mesh.loop_triangles)
    for corner in evaluated.bound_box:
        world = evaluated.matrix_world @ Vector(corner)
        lo = Vector((min(lo.x, world.x), min(lo.y, world.y), min(lo.z, world.z)))
        hi = Vector((max(hi.x, world.x), max(hi.y, world.y), max(hi.z, world.z)))
    for slot in obj.material_slots:
        if slot.material:
            materials.add(slot.material.name)
    evaluated.to_mesh_clear()

# Normalize placement: centered on X/Y, resting on Z=0, so every asset drops into an engine predictably.
offset = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
if offset.length > 1e-6:
    for obj in scene.objects:
        if obj.parent is None:
            obj.location = obj.location + offset
    bpy.context.view_layer.update()
    lo = lo + offset
    hi = hi + offset
REPORT["normalizedOffset"] = [round(v, 4) for v in offset]

size = hi - lo
if tris == 0:
    fail("validate", "The mesh objects contain no faces.")
if max(size) <= 1e-5 or max(size) > 10000:
    fail("validate", "Scene size is implausible: %.4f x %.4f x %.4f m." % tuple(size))

# Connectivity: every mesh island must touch or overlap another, or the asset has floating parts.
if CFG.get("requireConnected", True):
    import bmesh
    islands = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.verts.ensure_lookup_table()
        seen = set()
        for start in bm.verts:
            if start.index in seen or len(islands) > 2000:
                continue
            stack = [start]
            seen.add(start.index)
            ilo = Vector((1e9, 1e9, 1e9))
            ihi = Vector((-1e9, -1e9, -1e9))
            while stack:
                v = stack.pop()
                w = evaluated.matrix_world @ v.co
                ilo = Vector((min(ilo.x, w.x), min(ilo.y, w.y), min(ilo.z, w.z)))
                ihi = Vector((max(ihi.x, w.x), max(ihi.y, w.y), max(ihi.z, w.z)))
                for edge in v.link_edges:
                    other = edge.other_vert(v)
                    if other.index not in seen:
                        seen.add(other.index)
                        stack.append(other)
            islands.append((obj.name, ilo, ihi))
        bm.free()
        evaluated.to_mesh_clear()

    tol = max((hi - lo).length * 0.01, 0.002)
    parent = list(range(len(islands)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def gap(a, b):
        dx = max(a[1].x - b[2].x, b[1].x - a[2].x, 0.0)
        dy = max(a[1].y - b[2].y, b[1].y - a[2].y, 0.0)
        dz = max(a[1].z - b[2].z, b[1].z - a[2].z, 0.0)
        return math.sqrt(dx * dx + dy * dy + dz * dz)
    for i in range(len(islands)):
        for j in range(i + 1, len(islands)):
            if gap(islands[i], islands[j]) <= tol:
                parent[find(i)] = find(j)
    groups = {}
    for i in range(len(islands)):
        groups.setdefault(find(i), []).append(i)
    if len(groups) > 1:
        ordered = sorted(groups.values(), key=len, reverse=True)
        main = ordered[0]
        details = []
        for group in ordered[1:6]:
            nearest = min(gap(islands[a], islands[b]) for a in group for b in main)
            names = sorted(set(islands[k][0] for k in group))
            details.append("%s floats %.3f m away from the main body" % ("/".join(names[:3]), nearest))
        fail("validate", "The asset has %d disconnected groups of parts: %s. Move or extend parts so every piece touches or overlaps the rest." % (len(groups), "; ".join(details)))

REPORT["stats"] = {
    "objects": len(meshes),
    "vertices": verts,
    "triangles": tris,
    "materials": sorted(materials),
    "dimensions": [round(v, 4) for v in size],
    "min": [round(v, 4) for v in lo],
    "max": [round(v, 4) for v in hi],
}
if tris > CFG.get("maxTriangles", 500000):
    fail("validate", "Triangle count %d exceeds the limit of %d." % (tris, CFG.get("maxTriangles", 500000)))

# ---------------------------------------------------------------- save files
REPORT["stage"] = "export"
blend_path = path(CFG["baseName"] + ".blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path, copy=True, compress=True)
REPORT["files"]["blend"] = blend_path

glb_path = path(CFG["baseName"] + ".glb")
try:
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", export_apply=True)
except TypeError:
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB")
REPORT["files"]["glb"] = glb_path

# ------------------------------------------------------------- render setup
REPORT["stage"] = "render"
center = (lo + hi) / 2
radius = max((hi - lo).length / 2, 0.05)

engines = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
eevee = next((e for e in engines if "EEVEE" in e), None)
scene.render.engine = eevee or "BLENDER_WORKBENCH"
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
try:
    scene.view_settings.view_transform = "Standard"
except Exception:
    pass

world = bpy.data.worlds.new("MatterhornPreviewWorld")
world.use_nodes = True
background = world.node_tree.nodes.get("Background")
if background:
    background.inputs[0].default_value = (0.42, 0.45, 0.5, 1.0)
    background.inputs[1].default_value = 0.6
scene.world = world

def add_light(name, kind, energy, location, size_value):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    if kind == "AREA":
        data.size = size_value
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    direction = center - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj

scale = radius * 4
add_light("Key", "AREA", 900 * scale * scale / 16, center + Vector((-1.2, -1.6, 1.8)) * scale, scale)
add_light("Fill", "AREA", 300 * scale * scale / 16, center + Vector((1.6, -1.0, 0.8)) * scale, scale)
add_light("Rim", "AREA", 500 * scale * scale / 16, center + Vector((0.4, 1.8, 1.4)) * scale, scale)

cam_data = bpy.data.cameras.new("PreviewCamera")
camera = bpy.data.objects.new("PreviewCamera", cam_data)
scene.collection.objects.link(camera)
scene.camera = camera

def place_camera(azimuth_deg, elevation_deg, orthographic):
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    if orthographic:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = radius * 2.25
        distance = radius * 6
    else:
        cam_data.type = "PERSP"
        cam_data.lens = 50
        fov = cam_data.angle
        distance = radius / math.sin(fov / 2) * 1.08
    cam_data.clip_start = max(distance - radius * 3, 0.001)
    cam_data.clip_end = distance + radius * 3
    camera.location = center + direction * distance
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()

def render_to(filepath, width, height, pixel_art=False):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.filter_size = 0.0 if pixel_art else 1.5
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 1 if pixel_art else 32
    scene.render.filepath = filepath
    bpy.ops.render.render(write_still=True)
    return filepath

def compose_sheet(paths, columns, width, height, destination):
    rows = int(math.ceil(len(paths) / float(columns)))
    sheet_w = columns * width
    buffer = [0.0] * (sheet_w * rows * height * 4)
    for index, source in enumerate(paths):
        image = bpy.data.images.load(source)
        pixels = list(image.pixels)
        cx = index % columns
        cy = rows - 1 - index // columns
        for y in range(height):
            row = pixels[y * width * 4:(y + 1) * width * 4]
            start = ((cy * height + y) * sheet_w + cx * width) * 4
            buffer[start:start + width * 4] = row
        bpy.data.images.remove(image)
    sheet = bpy.data.images.new("SpriteSheet", sheet_w, rows * height, alpha=True)
    sheet.pixels = buffer
    sheet.filepath_raw = destination
    sheet.file_format = "PNG"
    sheet.save()
    return destination

try:
    views = [("front", 0, 8), ("three_quarter", 35, 22), ("side", 90, 8), ("back", 180, 8)]
    for label, az, el in views:
        place_camera(az, el, False)
        REPORT["renders"][label] = render_to(path("render_%s.png" % label), 768, 768)

    mode = CFG.get("mode", "model")
    frame = int(CFG.get("frameSize", 128))
    if mode == "sprite_sheet":
        directions = int(CFG.get("directions", 8))
        frames = []
        for i in range(directions):
            place_camera(i * 360.0 / directions, 30, True)
            frames.append(render_to(path("dir_%02d.png" % i), frame, frame))
        REPORT["files"]["sheet"] = compose_sheet(frames, directions, frame, frame, path(CFG["baseName"] + "_sheet.png"))
        REPORT["files"]["frames"] = frames
    elif mode == "pixel_sprite":
        place_camera(35, 30, True)
        REPORT["files"]["sprite"] = render_to(path(CFG["baseName"] + "_pixel.png"), frame, frame, pixel_art=True)
except Exception:
    fail("render", traceback.format_exc(limit=6))

REPORT["ok"] = True
REPORT["stage"] = "done"
REPORT["engine"] = scene.render.engine
REPORT["blenderVersion"] = bpy.app.version_string
write_report()
`;
