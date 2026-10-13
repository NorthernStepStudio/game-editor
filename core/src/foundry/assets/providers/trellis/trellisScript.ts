/**
 * Blender (Python + numpy) steps around the TRELLIS image-to-3D run, so no extra Python packages are needed.
 *
 * mode "prepare": crop the picture (fractions of its size), cut the character out of a plain backdrop and centre
 *   it on a square transparent canvas. A picture that is already transparent keeps its own alpha.
 * mode "paint": paint the back and sides from the sheet's views. mode "carve": fix the guessed depth from its side view.
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


PICTURES = {}


def load_crop(path, crop):
    """The picture's pixels (top row first, 0-1 floats) inside crop = [x0, y0, x1, y1] fractions."""
    if path not in PICTURES:
        img = bpy.data.images.load(path)
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        PICTURES[path] = px.reshape(h, w, 4)[::-1]
    full = PICTURES[path]
    h, w = full.shape[:2]
    crop = crop or [0, 0, 1, 1]
    x0, y0 = int(round(crop[0] * w)), int(round(crop[1] * h))
    x1, y1 = max(x0 + 8, int(round(crop[2] * w))), max(y0 + 8, int(round(crop[3] * h)))
    return full[y0:y1, x0:x1].copy()


def cut_out(rgba):
    """Which pixels are the character: a plain backdrop is flood-filled away from the borders."""
    h, w = rgba.shape[:2]
    alpha = rgba[:, :, 3]
    edge = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    if (edge < 0.5).mean() > 0.5:
        REPORT["cutout"] = "kept the picture's own transparency"
        keep = alpha > 0.5
    else:
        rgb = rgba[:, :, :3] * 255.0
        border = np.concatenate([rgb[:2].reshape(-1, 3), rgb[-2:].reshape(-1, 3), rgb[:, :2].reshape(-1, 3), rgb[:, -2:].reshape(-1, 3)])
        # the backdrop is what most of the border shows; colours of something the box cuts through (a neighbour,
        # the next view on a sheet) are only a small share of it, so they never count as backdrop
        bins, counts = np.unique((border // 12).astype(np.int32), axis=0, return_counts=True)
        order = np.argsort(-counts)
        share = np.cumsum(counts[order]) / counts.sum()
        palette = bins[order[:int(np.searchsorted(share, 0.9)) + 1]][:96] * 12 + 6
        tol = float(CFG.get("tolerance", 38))
        near = np.full((h, w), 1e9, dtype=np.float32)
        for p in palette:
            near = np.minimum(near, np.abs(rgb - p).sum(axis=2))
        candidate = near < tol
        # the backdrop is smooth: the fill never crosses a visible edge, so dark hair or clothes that happen to be
        # close to the backdrop colour (navy hair on a navy-grey backdrop) stay when an outline separates them
        edge_limit = float(CFG.get("edge", 12))
        if edge_limit > 0:
            step = np.zeros((h, w), dtype=np.float32)
            step[1:, :] = np.maximum(step[1:, :], np.abs(rgb[1:] - rgb[:-1]).sum(axis=2))
            step[:-1, :] = np.maximum(step[:-1, :], np.abs(rgb[1:] - rgb[:-1]).sum(axis=2))
            step[:, 1:] = np.maximum(step[:, 1:], np.abs(rgb[:, 1:] - rgb[:, :-1]).sum(axis=2))
            step[:, :-1] = np.maximum(step[:, :-1], np.abs(rgb[:, 1:] - rgb[:, :-1]).sum(axis=2))
            candidate &= step < edge_limit
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
        # a floor or horizon line behind the feet: in the lower part of the figure, a strip only a few pixels tall
        # but much wider than tall (shoes and legs are far taller, so they stay)
        up = np.zeros((h, w), dtype=np.int32)
        down = np.zeros((h, w), dtype=np.int32)
        for r in range(h):
            up[r] = (up[r - 1] + 1) * keep[r] if r else keep[r]
        for r in range(h - 1, -1, -1):
            down[r] = (down[r + 1] + 1) * keep[r] if r < h - 1 else keep[r]
        rows = np.nonzero(keep.any(axis=1))[0]
        strip = keep & (up + down - 1 < max(4, h // 28))
        if len(rows):
            strip[:int(rows[0] + (rows[-1] - rows[0]) * 0.7)] = False
        lines = 0
        rest = strip.copy()
        while rest.any() and lines < 200:
            seed = np.zeros_like(rest)
            seed.flat[int(np.argmax(rest))] = True
            while True:
                grown = dilate(seed, 16, rest)
                if np.array_equal(grown, seed):
                    break
                seed = grown
            rest &= ~seed
            ys, xs = np.nonzero(seed)
            if xs.max() - xs.min() + 1 >= max(3 * (ys.max() - ys.min() + 1), w * 0.06):
                keep &= ~seed
            lines += 1
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
    return keep


def prepare():
    REPORT["stage"] = "read"
    rgba = load_crop(CFG["image"], CFG.get("crop"))
    REPORT["stage"] = "cutout"
    keep = cut_out(rgba)
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
    # a floor or shadow in the picture can come out as a thin plate at the feet: remove ground-level faces that are
    # not under the shoes (the shoes are what stands just above the ground), then fit again
    import bmesh
    from mathutils.kdtree import KDTree
    tall = hi.z - lo.z
    ground = lo.z + 0.015 * tall
    feet = [v.co for o in meshes for v in o.data.vertices if ground < v.co.z < lo.z + 0.08 * tall]
    removed = 0
    if feet:
        tree = KDTree(len(feet))
        for i, co in enumerate(feet):
            tree.insert(Vector((co.x, co.y, 0.0)), i)
        tree.balance()
        for o in meshes:
            bm = bmesh.new()
            bm.from_mesh(o.data)
            plate = [f for f in bm.faces if all(v.co.z < ground for v in f.verts)
                     and tree.find(Vector((f.calc_center_median().x, f.calc_center_median().y, 0.0)))[2] > 0.015 * tall]
            removed += len(plate)
            bmesh.ops.delete(bm, geom=plate, context="FACES")
            loose = [v for v in bm.verts if not v.link_faces]
            bmesh.ops.delete(bm, geom=loose, context="VERTS")
            bm.to_mesh(o.data)
            bm.free()
    REPORT["groundFacesRemoved"] = removed
    if removed:
        pts = [v.co for o in meshes for v in o.data.vertices]
        lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
        s = float(CFG.get("height", 0.72)) / max(hi.z - lo.z, 1e-6)
        refit = Matrix.Diagonal((s, s, s, 1.0)) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
        for o in meshes:
            o.data.transform(refit)
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


def paint_from_views():
    """Repaint a one-piece model's colours from a character sheet's views (front, right, back, left): every texel
    takes the colour of the views that face it, where that view can actually see it (a depth test, so an arm does
    not paint the body behind it). Texels no view sees (top of the head, soles) keep their colour."""
    from mathutils import Vector as V3
    from mathutils.bvhtree import BVHTree
    REPORT["stage"] = "import"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CFG["model"])
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    mesh = obj.data
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mat = obj.active_material
    tex = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and any(
        l.to_socket.name == "Base Color" for o in n.outputs for l in o.links))
    img = tex.image
    TW, TH = img.size
    texture = np.empty(TW * TH * 4, dtype=np.float32)
    img.pixels.foreach_get(texture)
    texture = texture.reshape(TH, TW, 4)
    verts = np.array([v.co[:] for v in mesh.vertices], dtype=np.float64)
    tris = np.array([p.vertices[:] for p in mesh.polygons], dtype=np.int64)
    loops = np.array([p.loop_indices[:] for p in mesh.polygons], dtype=np.int64)
    uvs = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers.active.data.foreach_get("uv", uvs)
    uvs = uvs.reshape(-1, 2)
    # image-to-3D surfaces are bumpy: use normals smoothed over the neighbourhood, so which view paints a spot
    # changes gradually across the body instead of flickering from triangle to triangle
    vnorm = np.array([v.normal[:] for v in mesh.vertices], dtype=np.float64)
    edges = np.array([e.vertices[:] for e in mesh.edges], dtype=np.int64)
    for _ in range(int(CFG.get("smooth", 12))):
        summed = vnorm.copy()
        np.add.at(summed, edges[:, 0], vnorm[edges[:, 1]])
        np.add.at(summed, edges[:, 1], vnorm[edges[:, 0]])
        vnorm = summed / np.maximum(np.linalg.norm(summed, axis=1, keepdims=True), 1e-9)
    tree = BVHTree.FromPolygons([V3(v) for v in verts], tris.tolist())
    lo, hi = verts.min(axis=0), verts.max(axis=0)
    height = hi[2] - lo[2]

    # ---- every texel of every triangle: where it is on the model and which way it faces
    REPORT["stage"] = "texels"
    tx_all, ty_all, pos_all, nrm_all = [], [], [], []
    for t in range(len(tris)):
        uv = uvs[loops[t]] * (TW, TH)
        x0, y0 = np.floor(uv.min(axis=0)).astype(int)
        x1, y1 = np.ceil(uv.max(axis=0)).astype(int)
        xs, ys = np.meshgrid(np.arange(max(0, x0), min(TW, x1 + 1)), np.arange(max(0, y0), min(TH, y1 + 1)))
        if not xs.size:
            continue
        px_, py_ = xs.ravel() + 0.5, ys.ravel() + 0.5
        a, b, c = uv
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12:
            continue
        wx, wy = px_ - a[0], py_ - a[1]
        l1 = (wx * v1[1] - v1[0] * wy) / den
        l2 = (v0[0] * wy - wx * v0[1]) / den
        l0 = 1 - l1 - l2
        inside = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not inside.any():
            continue
        p3 = verts[tris[t]]
        pos = l0[inside, None] * p3[0] + l1[inside, None] * p3[1] + l2[inside, None] * p3[2]
        tx_all.append(xs.ravel()[inside])
        ty_all.append(ys.ravel()[inside])
        pos_all.append(pos)
        n3 = vnorm[tris[t]]
        nrm_all.append(l0[inside, None] * n3[0] + l1[inside, None] * n3[1] + l2[inside, None] * n3[2])
    TX, TY = np.concatenate(tx_all), np.concatenate(ty_all)
    POS, NRM = np.concatenate(pos_all), np.concatenate(nrm_all)
    NRM /= np.maximum(np.linalg.norm(NRM, axis=1, keepdims=True), 1e-9)
    REPORT["texels"] = int(len(TX))

    # ---- each view: cut it out, line it up with the model by height, test visibility with a depth map
    Z = np.array([0.0, 0.0, 1.0])
    cameras = {
        "front": [(np.array([0.0, 1.0, 0.0]), np.array([1.0, 0.0, 0.0]))],
        "back": [(np.array([0.0, -1.0, 0.0]), np.array([-1.0, 0.0, 0.0]))],
        # the sheet's "right" view shows the character's right side (-x); the mirror is tried too, and the
        # silhouette that fits best wins, so a sheet with the views swapped still works
        "right": [(np.array([1.0, 0.0, 0.0]), np.array([0.0, -1.0, 0.0])), (np.array([-1.0, 0.0, 0.0]), np.array([0.0, 1.0, 0.0]))],
        "left": [(np.array([-1.0, 0.0, 0.0]), np.array([0.0, 1.0, 0.0])), (np.array([1.0, 0.0, 0.0]), np.array([0.0, -1.0, 0.0]))],
    }
    acc = np.zeros((len(TX), 3), dtype=np.float64)
    match_x, match_y = [], []
    wsum = np.zeros(len(TX), dtype=np.float64)
    REPORT["views"] = {}
    for name, box in (CFG.get("views") or {}).items():
        if name not in cameras or not box:
            continue
        REPORT["stage"] = "view " + name
        rgba = load_crop(CFG["sheet"], box)
        keep = cut_out(rgba)
        ys, xs = np.nonzero(keep)
        by0, by1, bx0, bx1 = ys.min(), ys.max(), xs.min(), xs.max()
        scale = height / (by1 - by0 + 1)  # metres per pixel
        hh, ww = keep.shape
        best = None
        for d, u in cameras[name]:
            hcoord = verts @ u
            hc = (hcoord.min() + hcoord.max()) / 2
            cx = (bx0 + bx1 + 1) / 2
            depth = np.full((hh, ww), np.inf)
            for iy in range(hh):
                z = hi[2] - (iy + 0.5 - by0) * scale
                if z < lo[2] - scale or z > hi[2] + scale:
                    continue
                for ix in range(ww):
                    hpos = hc + (ix + 0.5 - cx) * scale
                    origin = u * hpos + Z * z - d * (height * 4)
                    hit = tree.ray_cast(V3(origin), V3(d), height * 8)
                    if hit[0] is not None:
                        depth[iy, ix] = float(np.dot(hit[0], d))
            sil = np.isfinite(depth)
            # the guessed shape and the drawing rarely line up exactly: slide the drawing sideways to fit best,
            # judged on the body below the head (hair and ponytails are where guesses differ most)
            body = slice(int(by0 + (by1 - by0) * 0.45), by1 + 1)
            for shift in range(-int(ww * 0.08), int(ww * 0.08) + 1):
                moved = np.roll(keep, -shift, axis=1)[body]
                iou = float((sil[body] & moved).sum()) / max(1, float((sil[body] | moved).sum()))
                if best is None or iou > best[0]:
                    best = (iou, d, u, hc, cx + shift, depth, scale, shift)
        iou, d, u, hc, cx, depth, scale, shift = best
        # sample only well inside the outline, so the sheet's dark rim and backdrop never paint the model
        inner = keep.copy()
        for _ in range(2):
            inner[1:-1, 1:-1] &= inner[:-2, 1:-1] & inner[2:, 1:-1] & inner[1:-1, :-2] & inner[1:-1, 2:]
        ix = np.floor((POS @ u - hc) / scale + cx).astype(int)  # column in the drawing
        iy = np.floor((hi[2] - POS[:, 2]) / scale + by0).astype(int)
        ok = (ix >= 0) & (ix < ww) & (iy >= 0) & (iy < hh)
        ixc, iyc = np.clip(ix, 0, ww - 1), np.clip(iy, 0, hh - 1)
        dx = np.clip(ix - shift, 0, ww - 1)  # column in the depth map, made before the slide
        seen = ok & inner[iyc, ixc] & (POS @ d <= depth[iyc, dx] + 0.012 * height)
        facing = np.clip(-(NRM @ d), 0, 1)
        if name == "front":
            # the model's own front was made from this very view and is never painted over; only when asked
            # (matchColours) does it teach the colours, to shift the rest of the model toward the drawing
            if not CFG.get("matchColours"):
                continue
            pick = seen & (facing > 0.7)
            match_x.append(texture[TY[pick], TX[pick], :3])
            match_y.append(rgba[iyc[pick], ixc[pick], :3])
            weight = np.zeros(len(TX))
        else:
            # back and sides: only what clearly faces the view, fading in so there is no hard seam
            weight = np.where(seen, np.clip((facing - 0.35) / 0.45, 0, 1) ** 2, 0.0)
            acc += weight[:, None] * rgba[iyc, ixc, :3]
            wsum += weight
        REPORT["views"][name] = {"fit": round(iou, 3), "shift": int(shift), "camera": [round(c, 1) for c in d], "painted": int((weight > 0.05).sum())}

    # ---- colours: group the model's front colours (hair, skin, clothes, eyes...) and shift each group by the
    # typical difference to the drawing, so e.g. hair that came out near-black turns the drawing's brown while black
    # eyes stay black. Medians keep the few mismatched spots (an outline, a strand) from pulling a group off.
    REPORT["stage"] = "colours"
    if match_x and sum(len(x) for x in match_x) > 500:
        X, Y = np.concatenate(match_x).astype(np.float64), np.concatenate(match_y).astype(np.float64)
        rng = np.random.default_rng(0)
        k = min(10, len(X) // 100)
        centres = X[rng.choice(len(X), k, replace=False)]
        for _ in range(15):
            label = np.argmin(((X[:, None, :] - centres[None]) ** 2).sum(axis=2), axis=1)
            centres = np.array([X[label == i].mean(axis=0) if (label == i).any() else centres[i] for i in range(k)])
        def group_shift(i):
            diff = Y[label == i] - X[label == i]
            if len(diff) <= 20:
                return np.zeros(3)
            middle = np.median(diff, axis=0)
            spread = np.median(np.abs(diff - middle), axis=0).max()
            # a group whose spots disagree in the drawing (e.g. eyes mixed with dark hair) is left alone
            return np.zeros(3) if spread > 0.12 else np.clip(middle, -0.3, 0.3)

        shifts = np.array([group_shift(i) for i in range(k)])
        flat = texture[:, :, :3].reshape(-1, 3).astype(np.float64)
        d2 = np.maximum((flat ** 2).sum(axis=1)[:, None] - 2 * flat @ centres.T + (centres ** 2).sum(axis=1)[None], 0)
        soft = np.exp(-(d2 - d2.min(axis=1, keepdims=True)) / (2 * 0.06 ** 2))
        soft /= soft.sum(axis=1, keepdims=True)
        texture[:, :, :3] = np.clip(flat + soft @ shifts, 0, 1).reshape(TH, TW, 3)
        REPORT["colourGroups"] = [{"colour": [round(c, 2) for c in centres[i]], "shift": [round(c, 2) for c in shifts[i]]} for i in range(k)]

    # ---- blend: texels the views see well take their colours; the rest keep theirs
    REPORT["stage"] = "blend"
    alpha = np.clip(wsum / 0.5, 0, 1)
    colour = acc / np.maximum(wsum, 1e-9)[:, None]
    old = texture[TY, TX, :3]
    texture[TY, TX, :3] = old * (1 - alpha[:, None]) + colour * alpha[:, None]
    img.pixels.foreach_set(texture.ravel())
    img.update()
    img.pack()
    REPORT["stage"] = "export"
    obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=CFG["output"], export_format="GLB", use_selection=True)
    REPORT["output"] = CFG["output"]
    REPORT["coverage"] = round(float((alpha > 0.5).mean()), 3)


def carve_to_side(obj, side_keep, margin=0.025):
    """Fix what an image-to-3D model guessed in depth (front-to-back), using the sheet's side view (side_keep: the
    character's mask in that view, top row first). The model's side silhouette is lined up with the sheet's (scaled by
    height, mirrored and slid to fit best; the head on its own). Then: far-out guessed parts (tails, a second cap brim)
    and surfaces stretched behind the legs (jacket hems pulled to the heels) are removed; slight overhangs behind the body
    are folded in; shoes are shortened to the sheet's shoe length; and the body's depth at each height is compressed
    toward its front to the sheet's depth. The front itself, which came from the picture, is never moved."""
    import bmesh
    from mathutils import Vector as V3
    from mathutils.bvhtree import BVHTree
    report = {}
    me = obj.data
    verts = [v.co.copy() for v in me.vertices]
    lo, hi = V3(map(min, *verts)), V3(map(max, *verts))
    height = hi.z - lo.z
    RES = 300
    step = height / RES
    tree = BVHTree.FromPolygons(verts, [p.vertices[:] for p in me.polygons])
    ny = int((hi.y - lo.y) / step) + 1
    model = np.zeros((RES, ny), dtype=bool)
    for r in range(RES):
        z = hi.z - (r + 0.5) * step
        for c in range(ny):
            model[r, c] = tree.ray_cast(V3((lo.x - 1, lo.y + (c + 0.5) * step, z)), V3((1, 0, 0)), 10)[0] is not None
    ys, xs = np.nonzero(side_keep)
    alpha = side_keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    scale = alpha.shape[0] / RES
    cols = max(1, int(round(alpha.shape[1] / scale)))
    ri = np.minimum((np.arange(RES) * scale).astype(int), alpha.shape[0] - 1)
    ci = np.minimum((np.arange(cols) * scale).astype(int), alpha.shape[1] - 1)
    sheet = alpha[ri][:, ci]

    def fit(rows, mirrors, shifts):
        best = None
        m = model[rows]
        for mirrored in mirrors:
            sh = (sheet[:, ::-1] if mirrored else sheet)[rows]
            for shift in shifts:
                lo_c, hi_c = max(0, shift), min(ny, cols + shift)
                if hi_c <= lo_c:
                    continue
                inter = (m[:, lo_c:hi_c] & sh[:, lo_c - shift:hi_c - shift]).sum()
                iou = inter / max(m.sum() + sh.sum() - inter, 1)
                if best is None or iou > best[0]:
                    best = (iou, mirrored, shift)
        return best

    def outline(mirrored, shift):
        s = sheet[:, ::-1] if mirrored else sheet
        allowed = np.zeros((RES, ny), dtype=bool)
        lo_c, hi_c = max(0, shift), min(ny, cols + shift)
        allowed[:, lo_c:hi_c] = s[:, lo_c - shift:hi_c - shift]
        for _ in range(max(1, int(round(margin * RES)))):
            g = allowed.copy()
            g[1:] |= allowed[:-1]; g[:-1] |= allowed[1:]; g[:, 1:] |= allowed[:, :-1]; g[:, :-1] |= allowed[:, 1:]
            allowed = g
        return allowed

    pad = max(ny, cols)
    body = fit(np.ones(RES, dtype=bool), (False, True), range(-pad, pad + 1))
    report.update(fit=round(float(body[0]), 3), mirrored=bool(body[1]), shift=int(body[2]))
    allowed = outline(body[1], body[2])
    head_rows = np.arange(RES) * step < 0.4 * height
    head = fit(head_rows, (body[1],), range(body[2] - int(0.08 * RES), body[2] + int(0.08 * RES) + 1))
    head_allowed = outline(body[1], head[2])
    report["headFit"] = round(float(head[0]), 3)
    report["outsideBefore"] = round(float((model & ~allowed).sum() / max(model.sum(), 1)), 4)

    mid_y = (lo.y + hi.y) / 2
    head_z = lo.z + 0.6 * height
    inset = 0.01 * height
    FAR = 0.04 * height
    LEG_LO, LEG_HI = lo.z + 0.05 * height, lo.z + 0.36 * height
    row_max = np.array([np.nonzero(allowed[r])[0].max() if allowed[r].any() else -1 for r in range(RES)])
    head_max = np.array([np.nonzero(head_allowed[r])[0].max() if head_allowed[r].any() else -1 for r in range(RES)])
    moved, far = 0, set()
    for v in me.vertices:
        co = v.co
        r = min(RES - 1, max(0, int((hi.z - co.z) / step)))
        if co.z > head_z:
            if head_max[r] >= 0 and co.y > mid_y and co.y > lo.y + (head_max[r] + 1) * step + FAR:
                far.add(v.index)
            continue
        if row_max[r] < 0:
            continue
        back_limit = lo.y + (row_max[r] + 1) * step
        if co.y > mid_y and co.y > back_limit:
            if co.y > back_limit + FAR or LEG_LO < co.z < LEG_HI:
                far.add(v.index)
            co.y = max(mid_y, back_limit - inset)
            moved += 1
    report["verticesMoved"] = moved
    bm = bmesh.new()
    bm.from_mesh(me)
    doomed = [f for f in bm.faces if all(v.index in far for v in f.verts)]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    report["facesRemoved"] = len(doomed)

    SHOE_Z = lo.z + 0.11 * height
    rows_of = lambda z: min(RES - 1, max(0, int((hi.z - z) / step)))
    sheet_s = sheet[:, ::-1] if body[1] else sheet
    shoe = []
    for r in range(rows_of(SHOE_Z), RES):
        m_cols, s_cols = np.nonzero(model[r])[0], np.nonzero(sheet_s[r])[0]
        if len(m_cols) > 2 and len(s_cols) > 2:
            shoe.append(((s_cols.max() - s_cols.min() + 1) * (1 + margin) / (m_cols.max() - m_cols.min() + 1),
                         lo.y + (m_cols.min() + m_cols.max() + 1) / 2 * step))
    if shoe:
        ks = sorted(min(1.0, k) for k, _ in shoe)
        k_shoe = max(0.6, ks[len(ks) // 2])
        centre = float(np.median([c for _, c in shoe]))
        for v in me.vertices:
            if v.co.z < SHOE_Z + 0.04 * height:
                t = min(1.0, max(0.0, (SHOE_Z + 0.04 * height - v.co.z) / (0.04 * height)))
                v.co.y = centre + (v.co.y - centre) * (1.0 - (1.0 - k_shoe) * t)
        report["shoeScale"] = round(float(k_shoe), 3)

    BODY_LO, BODY_HI = SHOE_Z + 0.04 * height, lo.z + 0.6 * height
    ratio = np.full(RES, np.nan)
    front = np.full(RES, np.nan)
    for r in range(RES):
        m_cols, s_cols = np.nonzero(model[r])[0], np.nonzero(sheet_s[r])[0]
        if len(m_cols) > 2 and len(s_cols) > 2:
            ratio[r] = (s_cols.max() - s_cols.min() + 1) * (1 + margin) / (m_cols.max() - m_cols.min() + 1)
            front[r] = lo.y + m_cols.min() * step
    valid = ~np.isnan(ratio)
    if valid.sum() > 10:
        idx = np.arange(RES)
        ratio = np.interp(idx, idx[valid], ratio[valid])
        front = np.interp(idx, idx[valid], front[valid])
        win = max(3, int(0.03 * RES))
        box = np.ones(2 * win + 1) / (2 * win + 1)
        k_row = np.array([np.median(ratio[max(0, r - win):r + win + 1]) for r in range(RES)])
        k_row = np.clip(np.convolve(np.pad(k_row, win, mode="edge"), box, mode="valid"), 0.6, 1.0)
        f_row = np.convolve(np.pad(front, win, mode="edge"), box, mode="valid")
        fade = 0.04 * height
        for v in me.vertices:
            z = v.co.z
            if z < BODY_LO - fade or z > BODY_HI + fade:
                continue
            w = min(1.0, (z - (BODY_LO - fade)) / fade, ((BODY_HI + fade) - z) / fade)
            r = rows_of(z)
            if v.co.y > f_row[r]:
                v.co.y = f_row[r] + (v.co.y - f_row[r]) * (1.0 - (1.0 - k_row[r]) * max(0.0, w))
        report["depthScale"] = [round(float(k_row[rows_of(BODY_HI)]), 2), round(float(np.median(k_row[rows_of(BODY_HI):rows_of(BODY_LO)])), 2), round(float(k_row[rows_of(BODY_LO)]), 2)]
    me.update()
    return report


def carve_from_sheet():
    """Mode "carve": fix the model's guessed depth using the sheet's side view (config: model, sheet, side, output)."""
    REPORT["stage"] = "import"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CFG["model"])
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    REPORT["stage"] = "side view"
    keep = cut_out(load_crop(CFG["sheet"], CFG["side"]))
    REPORT["stage"] = "carve"
    REPORT["carve"] = carve_to_side(obj, keep, float(CFG.get("margin", 0.025)))
    REPORT["stage"] = "export"
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=CFG["output"], export_format="GLB", use_selection=True)
    REPORT["output"] = CFG["output"]


try:
    if CFG["mode"] == "prepare":
        prepare()
    elif CFG["mode"] == "finish":
        finish_model()
    elif CFG["mode"] == "paint":
        paint_from_views()
    elif CFG["mode"] == "carve":
        carve_from_sheet()
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
