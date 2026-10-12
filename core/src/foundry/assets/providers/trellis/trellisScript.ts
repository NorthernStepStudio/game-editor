/**
 * Blender (Python + numpy) steps around the TRELLIS image-to-3D run, so no extra Python packages are needed.
 *
 * mode "prepare": crop the picture (fractions of its size), cut the character out of a plain backdrop and centre
 *   it on a square transparent canvas. A picture that is already transparent keeps its own alpha.
 * mode "finish": make the model game-ready: one mesh named "Body", centred, feet on the ground, scaled to the game
 *   height and lightened to a polygon budget; then render a front preview.
 *
 * Usage: blender --background --factory-startup --python <this.py> -- <config.json>
 * The result is written to config["report"] as JSON: {"ok": bool, "stage": str, "error"?: str, ...}.
 */
export const TRELLIS_BLENDER_SCRIPT = String.raw`
import json
import math
import sys
import traceback

import bpy
import numpy as np
from mathutils import Matrix, Vector

CFG = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8"))
REPORT = {"ok": False, "stage": "start"}


def finish(ok):
    REPORT["ok"] = ok
    with open(CFG["report"], "w", encoding="utf-8") as f:
        json.dump(REPORT, f, indent=2)
    sys.exit(0 if ok else 1)


def dilate(mask, steps, within=None):
    """Grow a mask one pixel at a time (4-neighbours); with "within", it never leaves that area, not even briefly."""
    for _ in range(steps):
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        mask = grown if within is None else grown & within
    return mask


def prepare():
    REPORT["stage"] = "read"
    img = bpy.data.images.load(CFG["image"])
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgba = px.reshape(h, w, 4)[::-1]  # top row first
    crop = CFG.get("crop") or [0, 0, 1, 1]
    x0, y0 = int(round(crop[0] * w)), int(round(crop[1] * h))
    x1, y1 = max(x0 + 8, int(round(crop[2] * w))), max(y0 + 8, int(round(crop[3] * h)))
    rgba = rgba[y0:y1, x0:x1].copy()
    h, w = rgba.shape[:2]
    alpha = rgba[:, :, 3]
    edge = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    REPORT["stage"] = "cutout"
    if (edge < 0.5).mean() > 0.5:
        REPORT["cutout"] = "kept the picture's own transparency"
        keep = alpha > 0.5
    else:
        rgb = rgba[:, :, :3] * 255.0
        border = np.concatenate([rgb[:2].reshape(-1, 3), rgb[-2:].reshape(-1, 3), rgb[:, :2].reshape(-1, 3), rgb[:, -2:].reshape(-1, 3)])
        palette = np.unique((border // 12).astype(np.int32), axis=0) * 12 + 6
        if len(palette) > 96:
            palette = palette[np.random.default_rng(0).choice(len(palette), 96, replace=False)]
        tol = float(CFG.get("tolerance", 38))
        near = np.full((h, w), 1e9, dtype=np.float32)
        for p in palette:
            near = np.minimum(near, np.abs(rgb - p).sum(axis=2))
        candidate = near < tol
        # A tinted backdrop (e.g. blue-grey) only matches pixels with the same tint, so dark clothing stays.
        tint = float(np.median(border[:, 2] - border[:, 0]))
        if abs(tint) >= 6:
            candidate &= (rgb[:, :, 2] - rgb[:, :, 0]) * math.copysign(1, tint) >= 6
        seen = np.zeros((h, w), dtype=bool)
        seen[0], seen[-1], seen[:, 0], seen[:, -1] = candidate[0], candidate[-1], candidate[:, 0], candidate[:, -1]
        while True:
            grown = dilate(seen, 16, candidate)
            if np.array_equal(grown, seen):
                break
            seen = grown
        keep = ~seen
        keep = ~dilate(~dilate(keep, 1), 2)  # close pinholes, then trim the backdrop fringe
        REPORT["cutout"] = "removed a plain backdrop (%d colours)" % len(palette)
    # Labels and stray specks (e.g. a "FRONT" caption) are dropped: keep only pieces of a real size.
    pieces, rest = [], keep.copy()
    while rest.any() and len(pieces) < 300:
        seed = np.zeros_like(rest)
        seed.flat[int(np.argmax(rest))] = True
        while True:
            grown = dilate(seed, 16, rest)
            if np.array_equal(grown, seed):
                break
            seed = grown
        pieces.append(seed)
        rest &= ~seed
    if pieces:
        main = max(pieces, key=lambda p: int(p.sum()))
        biggest = int(main.sum())

        def wanted(piece):
            # a loose piece cut by the box edge belongs to something next to the character (a neighbour, a label)
            on_edge = piece[0].any() or piece[-1].any() or piece[:, 0].any() or piece[:, -1].any()
            return piece is main or (piece.sum() >= biggest * 0.02 and not on_edge)

        kept = [p for p in pieces if wanted(p)]
        keep = np.zeros_like(keep)
        for piece in kept:
            keep |= piece
        REPORT["pieces"] = [len(pieces), len(kept)]
    if keep.sum() < 64:
        raise RuntimeError("Nothing was left after removing the background. Crop closer to the character.")
    ys, xs = np.nonzero(keep)
    rgba[:, :, 3] = keep.astype(np.float32)
    cut = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    side = int(max(cut.shape[:2]) * 1.1)
    canvas = np.zeros((side, side, 4), dtype=np.float32)
    oy, ox = (side - cut.shape[0]) // 2, (side - cut.shape[1]) // 2
    canvas[oy:oy + cut.shape[0], ox:ox + cut.shape[1]] = cut
    out = bpy.data.images.new("Cutout", side, side, alpha=True)
    out.pixels.foreach_set(canvas[::-1].ravel())
    size = int(CFG.get("size", 1024))
    out.scale(size, size)
    out.filepath_raw = CFG["output"]
    out.file_format = "PNG"
    out.save()
    REPORT["output"] = CFG["output"]
    REPORT["subject"] = [int(cut.shape[1]), int(cut.shape[0])]


def finish_model():
    REPORT["stage"] = "import"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CFG["model"])
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("The 3D result has no mesh.")
    bpy.context.view_layer.update()
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
    for o in [o for o in scene.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    for o in meshes:
        o.data.transform(o.matrix_world)
        o.matrix_world.identity()
    REPORT["stage"] = "lighten"
    faces = sum(len(o.data.polygons) for o in meshes)
    budget = int(CFG.get("maxFaces", 40000))
    if faces > budget:
        for o in meshes:
            mod = o.modifiers.new("Lighten", "DECIMATE")
            mod.ratio = budget / faces
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
    REPORT["stage"] = "fit"
    pts = [v.co for o in meshes for v in o.data.vertices]
    lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
    s = float(CFG.get("height", 0.72)) / max(hi.z - lo.z, 1e-6)
    fit = Matrix.Diagonal((s, s, s, 1.0)) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
    for i, o in enumerate(meshes):
        o.data.transform(fit)
        o.name = o.data.name = "Body" if i == 0 else "Body.%03d" % i
        for poly in o.data.polygons:
            poly.use_smooth = True
    pts = [v.co for o in meshes for v in o.data.vertices]
    lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
    REPORT["faces"] = [faces, sum(len(o.data.polygons) for o in meshes)]
    REPORT["size"] = [round(c, 4) for c in (hi - lo)]
    REPORT["stage"] = "export"
    for o in meshes:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=CFG["output"], export_format="GLB", use_selection=True)
    REPORT["output"] = CFG["output"]
    REPORT["stage"] = "preview"
    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = 640
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.45, 0.5, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.2
    scene.world = world
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 2.5
    sun.rotation_euler = (math.radians(50), math.radians(8), math.radians(-25))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(hi.x - lo.x, hi.z - lo.z, hi.y - lo.y) * 1.12
    focus = (lo + hi) / 2
    previews = []
    for label, az, el in (("front", 0, 6), ("three_quarter", 35, 15), ("back", 180, 6)):
        a, e = math.radians(az), math.radians(el)
        cam.location = focus + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 10
        cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = CFG["previewBase"] + "-" + label + ".png"
        bpy.ops.render.render(write_still=True)
        previews.append(scene.render.filepath)
    REPORT["previews"] = previews


try:
    if CFG["mode"] == "prepare":
        prepare()
    elif CFG["mode"] == "finish":
        finish_model()
    else:
        raise RuntimeError("Unknown mode " + str(CFG["mode"]))
    REPORT["stage"] = "done"
    finish(True)
except SystemExit:
    raise
except Exception as error:
    REPORT["error"] = str(error)
    REPORT["trace"] = traceback.format_exc()[-2000:]
    finish(False)
`;
