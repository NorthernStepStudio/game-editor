"""Yun building kit v1 — studio-original Dominican street buildings, scripted in Blender (see DESIGN-BRIEF.md).

Every design is built through the Visible Creation Mode stages:
  1 v01-blockout   massing only (one clay colour)
  2 v02-structure  doors, windows, roofs, balconies, porches, stairs (clay colours)
  3 v03-details    grilles, rebar, water tanks, utilities, signs, shop props (clay colours)
  4 v04-materials  full detail in a map colourway: calle | malecon | parque | noche

Usage: blender --background --factory-startup --python build_kit.py -- <design|all> <stage 1-4> <colourway> <out_dir>
Writes <out_dir>/<design>/<stage-name>[-<colourway>]/ with hero.png, front.png, <design>.blend and (stage 4)
<design>-<colourway>.glb. Authored in metres, scaled by the locked Yun building scale 0.55, ground at z = 0,
front facing -Y, simple <design>-colonly collision box.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

SCALE = 0.55
STAGES = {1: "v01-blockout", 2: "v02-structure", 3: "v03-details", 4: "v04-materials"}


def srgb(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


PALETTES = {
    "calle": {
        "walls": [(0.95, 0.62, 0.25), (0.92, 0.45, 0.38), (0.93, 0.58, 0.65), (0.62, 0.80, 0.36), (0.95, 0.88, 0.70), (0.45, 0.70, 0.90)],
        "trim": (0.96, 0.94, 0.88), "roof": (0.78, 0.74, 0.68), "door": (0.15, 0.35, 0.55), "wood": (0.55, 0.33, 0.18),
        "accents": [(0.85, 0.15, 0.15), (0.10, 0.45, 0.75), (0.95, 0.75, 0.10), (0.10, 0.55, 0.30)],
    },
    "malecon": {
        "walls": [(0.96, 0.96, 0.94), (0.45, 0.82, 0.82), (0.62, 0.88, 0.74), (0.92, 0.84, 0.66), (0.66, 0.82, 0.95), (0.96, 0.70, 0.62)],
        "trim": (0.98, 0.98, 0.96), "roof": (0.86, 0.84, 0.80), "door": (0.10, 0.45, 0.60), "wood": (0.62, 0.45, 0.30),
        "accents": [(0.10, 0.55, 0.70), (0.95, 0.45, 0.30), (0.20, 0.30, 0.60), (0.95, 0.80, 0.30)],
    },
    "parque": {
        "walls": [(0.62, 0.72, 0.52), (0.85, 0.65, 0.30), (0.78, 0.42, 0.30), (0.52, 0.58, 0.32), (0.92, 0.86, 0.70), (0.85, 0.62, 0.58)],
        "trim": (0.92, 0.90, 0.82), "roof": (0.70, 0.66, 0.58), "door": (0.35, 0.25, 0.15), "wood": (0.45, 0.30, 0.18),
        "accents": [(0.70, 0.20, 0.15), (0.20, 0.45, 0.25), (0.85, 0.60, 0.15), (0.25, 0.35, 0.55)],
    },
}
PALETTES["noche"] = dict(PALETTES["calle"])
FIXED = {"metal": (0.05, 0.06, 0.07), "glass": (0.06, 0.14, 0.18), "zinc": (0.62, 0.64, 0.66), "tank": (0.08, 0.10, 0.16),
         "concrete": (0.70, 0.68, 0.64), "dark": (0.03, 0.03, 0.035), "white": (0.95, 0.95, 0.93), "rubber": (0.07, 0.07, 0.07)}
CLAY = {"wall": 0.66, "trim": 0.82, "roof": 0.58, "door": 0.38, "wood": 0.48, "metal": 0.16, "glass": 0.12, "zinc": 0.72,
        "tank": 0.22, "concrete": 0.60, "dark": 0.08, "white": 0.9, "rubber": 0.12, "wall2": 0.56, "accent": 0.45, "accent2": 0.52,
        "lit": 0.12, "green": 0.4}


class Kit:
    def __init__(self, design_index, stage, colour):
        self.stage = stage
        self.cw = colour
        self.geo = {}  # role -> (verts, faces)
        self.idx = design_index
        self.body = {}
        self.collision = []

    # ---------------------------------------------------------------- geometry
    def _add(self, role, verts, faces):
        if self.stage == 1:
            role = "wall"
        vs, fs = self.geo.setdefault(role, ([], []))
        o = len(vs)
        vs.extend(verts)
        fs.extend([tuple(i + o for i in f) for f in faces])

    def box(self, role, x0, x1, y0, y1, z0, z1, rot=None):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        v = [Vector((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        if rot is not None:
            centre = Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
            v = [rot @ (p - centre) + centre for p in v]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        self._add(role, v, faces)

    def cyl(self, role, x, y, z0, z1, r, n=12, axis="z"):
        ring0, ring1 = [], []
        for i in range(n):
            a = 2 * math.pi * i / n
            if axis == "z":
                ring0.append(Vector((x + r * math.cos(a), y + r * math.sin(a), z0)))
                ring1.append(Vector((x + r * math.cos(a), y + r * math.sin(a), z1)))
            else:  # along x: z0..z1 are x extents, (x, y) is (y, z)
                ring0.append(Vector((z0, x + r * math.cos(a), y + r * math.sin(a))))
                ring1.append(Vector((z1, x + r * math.cos(a), y + r * math.sin(a))))
        faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        self._add(role, ring0 + ring1, faces)

    def prism(self, role, x0, x1, y0, y1, z0, rise, ridge="y"):
        """Gable volume: a triangle across x (ridge along y) or across y (ridge along x)."""
        if ridge == "y":
            xm = (x0 + x1) / 2
            v = [Vector((x0, y0, z0)), Vector((x1, y0, z0)), Vector((xm, y0, z0 + rise)),
                 Vector((x0, y1, z0)), Vector((x1, y1, z0)), Vector((xm, y1, z0 + rise))]
        else:
            ym = (y0 + y1) / 2
            v = [Vector((x0, y0, z0)), Vector((x0, y1, z0)), Vector((x0, ym, z0 + rise)),
                 Vector((x1, y0, z0)), Vector((x1, y1, z0)), Vector((x1, ym, z0 + rise))]
        self._add(role, v, [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)])

    # ---------------------------------------------------------------- facades
    def set_body(self, x0, x1, y0, y1, h):
        self.body = {"LX": x0, "RX": x1, "FY": y0, "BY": y1, "H": h}

    def fbox(self, role, face, u0, u1, z0, z1, o0, o1):
        b = self.body
        if face == "front":
            self.box(role, u0, u1, b["FY"] - o1, b["FY"] - o0, z0, z1)
        elif face == "back":
            self.box(role, u0, u1, b["BY"] + o0, b["BY"] + o1, z0, z1)
        elif face == "right":
            self.box(role, b["RX"] + o0, b["RX"] + o1, u0, u1, z0, z1)
        elif face == "left":
            self.box(role, b["LX"] - o1, b["LX"] - o0, u0, u1, z0, z1)

    def walls(self, x0, x1, y0, y1, h, z0=0.0, role="wall"):
        self.box(role, x0, x1, y0, y1, z0, z0 + h)
        self.collision.append((x0, x1, y0, y1, z0, z0 + h))

    def band(self, z, h=0.2, out=0.07, role="trim"):
        if self.stage < 2:
            return
        b = self.body
        self.box(role, b["LX"] - out, b["RX"] + out, b["FY"] - out, b["BY"] + out, z, z + h)

    def base(self, h=0.5, role="wall2"):
        if self.stage < 2:
            return
        b = self.body
        self.box(role, b["LX"] - 0.03, b["RX"] + 0.03, b["FY"] - 0.03, b["BY"] + 0.03, 0, h)

    def window(self, face, u, z, w=1.0, h=1.2, lit=None, kind="glass"):
        if self.stage < 2:
            return
        self.fbox("trim", face, u - w / 2 - 0.09, u + w / 2 + 0.09, z - 0.09, z + h + 0.09, 0, 0.04)
        glass = "lit" if (self.cw == "noche" and self.stage >= 4 and (lit if lit is not None else (int(u * 10 + z) % 3 != 0))) else "glass"
        if kind == "shutter":
            self.fbox("wood", face, u - w / 2, u + w / 2, z, z + h, 0.04, 0.06)
        else:
            self.fbox(glass, face, u - w / 2, u + w / 2, z, z + h, 0.04, 0.05)
        self.fbox("trim", face, u - w / 2 - 0.14, u + w / 2 + 0.14, z - 0.16, z - 0.07, 0, 0.13)
        if self.stage < 3:
            return
        if kind == "shutter":
            n = max(3, int(h / 0.12))
            for i in range(n):
                zz = z + (i + 0.5) * h / n
                self.fbox("wood", face, u - w / 2 + 0.04, u + w / 2 - 0.04, zz - 0.02, zz + 0.02, 0.06, 0.09)
            self.fbox("dark", face, u - 0.01, u + 0.01, z, z + h, 0.06, 0.1)
            return
        n = max(3, int(w / 0.13))
        for i in range(n + 1):
            uu = u - w / 2 + i * w / n
            self.fbox("metal", face, uu - 0.014, uu + 0.014, z, z + h, 0.07, 0.1)
        for zz in (z + 0.02, z + h / 2, z + h - 0.02):
            self.fbox("metal", face, u - w / 2, u + w / 2, zz - 0.015, zz + 0.015, 0.07, 0.1)

    def door(self, face, u, w=1.0, h=2.2, kind="door", z=0.0):
        if self.stage < 2:
            return
        self.fbox("trim", face, u - w / 2 - 0.1, u + w / 2 + 0.1, z, z + h + 0.1, 0, 0.04)
        role = {"door": "door", "glass": "glass", "shutter": "metal", "gate": "dark", "open": "dark"}[kind]
        self.fbox(role, face, u - w / 2, u + w / 2, z, z + h, 0.04, 0.05)
        if self.stage < 3:
            return
        if kind == "shutter":
            for i in range(int(h / 0.12)):
                zz = z + 0.06 + i * 0.12
                self.fbox("zinc", face, u - w / 2, u + w / 2, zz, zz + 0.05, 0.05, 0.07)
            self.fbox("metal", face, u - w / 2 - 0.05, u + w / 2 + 0.05, z + h - 0.25, z + h, 0.05, 0.14)
        elif kind == "gate":
            for i in range(int(w / 0.12) + 1):
                uu = u - w / 2 + i * w / int(w / 0.12)
                self.fbox("metal", face, uu - 0.015, uu + 0.015, z, z + h, 0.05, 0.08)
            for zz in (z + 0.1, z + h / 2, z + h - 0.1):
                self.fbox("metal", face, u - w / 2, u + w / 2, zz - 0.02, zz + 0.02, 0.05, 0.08)
        elif kind == "door":
            self.fbox("metal", face, u + w / 2 - 0.15, u + w / 2 - 0.1, z + 1.0, z + 1.1, 0.05, 0.1)
            self.fbox("trim", face, u - w / 2 + 0.12, u + w / 2 - 0.12, z + 1.3, z + h - 0.15, 0.05, 0.06)
        elif kind == "glass":
            self.fbox("trim", face, u - 0.03, u + 0.03, z, z + h, 0.05, 0.08)
        if z == 0.0:
            self.fbox("concrete", face, u - w / 2 - 0.25, u + w / 2 + 0.25, 0, 0.12, 0, 0.45)

    def railing(self, face, u0, u1, z, out, h=0.95):
        if self.stage < 3:
            return
        n = max(2, int((u1 - u0) / 0.14))
        for i in range(n + 1):
            uu = u0 + i * (u1 - u0) / n
            self.fbox("metal", face, uu - 0.018, uu + 0.018, z, z + h, out - 0.04, out)
        self.fbox("metal", face, u0, u1, z + h - 0.04, z + h, out - 0.05, out + 0.01)
        self.fbox("metal", face, u0, u1, z + 0.12, z + 0.15, out - 0.04, out)

    def balcony(self, face, u0, u1, z, depth=1.1):
        if self.stage < 2:
            return
        self.fbox("trim", face, u0, u1, z - 0.18, z, 0, depth)
        if self.stage >= 3:
            self.railing(face, u0, u1, z, depth)
            n = max(2, int(depth / 0.14))
            for uu in (u0, u1):
                for i in range(n + 1):
                    o = i * depth / n
                    self.fbox("metal", face, uu - 0.018, uu + 0.018, z, z + 0.95, o - 0.018, o + 0.018)
                self.fbox("metal", face, uu - 0.025, uu + 0.025, z + 0.91, z + 0.95, 0, depth)

    def awning(self, face, u0, u1, z, depth=0.9, role="trim"):
        if self.stage < 2:
            return
        self.fbox(role, face, u0, u1, z, z + 0.12, 0, depth)
        if self.stage >= 3:
            for uu in (u0 + 0.1, u1 - 0.1):
                self.fbox("metal", face, uu - 0.02, uu + 0.02, z - 0.5, z, 0, 0.04)

    def sign(self, face, u0, u1, z, h=0.55, role="accent", lit=False):
        if self.stage < 2:
            return
        r = "litsign" if (lit and self.cw == "noche" and self.stage >= 4) else role
        self.fbox(r, face, u0, u1, z, z + h, 0, 0.1)
        if self.stage >= 3:
            self.fbox("white", face, u0 + 0.25, u1 - 0.25, z + h * 0.35, z + h * 0.65, 0.1, 0.12)
            self.fbox("accent2", face, u0, u1, z - 0.05, z, 0, 0.12)

    # ---------------------------------------------------------------- roofs
    def flat_roof(self, rebar=True, tank=True, tank_at=(0.3, 0.4), dish=False):
        b = self.body
        h = b["H"]
        if self.stage < 2:
            return
        self.box("roof", b["LX"], b["RX"], b["FY"], b["BY"], h, h + 0.12)
        t = 0.15
        for (x0, x1, y0, y1) in ((b["LX"], b["RX"], b["FY"], b["FY"] + t), (b["LX"], b["RX"], b["BY"] - t, b["BY"]),
                                 (b["LX"], b["LX"] + t, b["FY"], b["BY"]), (b["RX"] - t, b["RX"], b["FY"], b["BY"])):
            self.box("wall", x0, x1, y0, y1, h, h + 0.55)
            self.box("trim", x0 - 0.04, x1 + 0.04, y0 - 0.04, y1 + 0.04, h + 0.55, h + 0.63)
        if self.stage < 3:
            return
        if rebar:
            for (x, y) in ((b["LX"] + 0.2, b["FY"] + 0.2), (b["RX"] - 0.2, b["FY"] + 0.2), (b["LX"] + 0.2, b["BY"] - 0.2), (b["RX"] - 0.2, b["BY"] - 0.2)):
                self.box("concrete", x - 0.14, x + 0.14, y - 0.14, y + 0.14, h, h + 0.3)
                for dx, dy in ((-0.06, -0.06), (0.06, -0.06), (-0.06, 0.06), (0.06, 0.06)):
                    self.cyl("rust", x + dx, y + dy, h + 0.3, h + 1.1, 0.012, n=6)
        if tank:
            tx = b["LX"] + (b["RX"] - b["LX"]) * tank_at[0]
            ty = b["FY"] + (b["BY"] - b["FY"]) * (1 - tank_at[1])
            for dx, dy in ((-0.35, -0.35), (0.35, -0.35), (-0.35, 0.35), (0.35, 0.35)):
                self.box("metal", tx + dx - 0.03, tx + dx + 0.03, ty + dy - 0.03, ty + dy + 0.03, h + 0.12, h + 0.8)
            self.box("metal", tx - 0.45, tx + 0.45, ty - 0.45, ty + 0.45, h + 0.8, h + 0.86)
            self.cyl("tank", tx, ty, h + 0.86, h + 2.0, 0.55, n=16)
            self.cyl("tank", tx, ty, h + 2.0, h + 2.08, 0.3, n=12)
        if dish:
            dx, dy = b["RX"] - 0.8, b["FY"] + 0.8
            self.cyl("metal", dx, dy, h + 0.12, h + 0.9, 0.025, n=6)
            self.cyl("white", dx, dy - 0.1, h + 0.75, h + 1.25, 0.32, n=14)

    def shed_roof(self, rise=0.7, over=0.45, role="zinc"):
        b = self.body
        h = b["H"]
        if self.stage < 2:
            return
        depth = b["BY"] - b["FY"] + 2 * over
        ang = math.atan2(rise, depth)
        rot = Matrix.Rotation(-ang, 4, "X").to_3x3()
        cy = (b["FY"] + b["BY"]) / 2
        self.box(role, b["LX"] - over, b["RX"] + over, cy - depth / 2 / math.cos(ang), cy + depth / 2 / math.cos(ang), h + rise / 2, h + rise / 2 + 0.06, rot)
        # wall infill under the sloped roof (back higher than front)
        for x0, x1 in ((b["LX"], b["LX"] + 0.15), (b["RX"] - 0.15, b["RX"])):
            # the roof plate slopes down toward the back: the side walls follow it (high at the front)
            v = [Vector((x0, b["FY"], h)), Vector((x0, b["BY"], h)), Vector((x0, b["BY"], h + rise * 0.1)), Vector((x0, b["FY"], h + rise * 0.9)),
                 Vector((x1, b["FY"], h)), Vector((x1, b["BY"], h)), Vector((x1, b["BY"], h + rise * 0.1)), Vector((x1, b["FY"], h + rise * 0.9))]
            self._add("wall", v, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
        if self.stage >= 3:
            n = int((b["RX"] - b["LX"] + 2 * over) / 0.18)
            for i in range(n + 1):
                x = b["LX"] - over + i * (b["RX"] - b["LX"] + 2 * over) / n
                self.box("zinc2", x - 0.025, x + 0.025, cy - depth / 2 / math.cos(ang), cy + depth / 2 / math.cos(ang), h + rise / 2 + 0.05, h + rise / 2 + 0.09, rot)

    def gable_roof(self, rise=1.8, over=0.4, role="roof", trim=True, wall_role="wall"):
        b = self.body
        h = b["H"]
        if self.stage < 2:
            self.prism(wall_role, b["LX"], b["RX"], b["FY"], b["BY"], h, rise, ridge="y")
            return
        self.prism(wall_role, b["LX"], b["RX"], b["FY"], b["BY"], h, rise, ridge="y")
        half = (b["RX"] - b["LX"]) / 2 + over
        ang = math.atan2(rise, (b["RX"] - b["LX"]) / 2)
        plen = half / math.cos(ang)
        xm = (b["LX"] + b["RX"]) / 2
        for side in (-1, 1):
            rot = Matrix.Rotation(side * ang, 4, "Y").to_3x3()
            cx = xm + side * (half / 2 - over / 2)
            cz = h + rise / 2 - over * math.tan(ang) / 2 + 0.06
            self.box(role, cx - plen / 2, cx + plen / 2, b["FY"] - over, b["BY"] + over, cz, cz + 0.08, rot)
        if trim and self.stage >= 3:
            # gingerbread fretwork: small hanging teeth along the front gable edges
            for i in range(14):
                t = (i + 0.5) / 14
                for side in (-1, 1):
                    x = xm + side * t * (b["RX"] - b["LX"]) / 2
                    z = h + rise * (1 - t) - 0.05
                    self.box("trim", x - 0.05, x + 0.05, b["FY"] - over + 0.02, b["FY"] - over + 0.06, z - 0.25, z)

    # ---------------------------------------------------------------- utilities and props
    def utilities(self, face="front", u=None, ac=True):
        if self.stage < 3:
            return
        b = self.body
        u = (b["LX"] + 0.4) if u is None else u
        self.fbox("white", face, u - 0.15, u + 0.15, 1.3, 1.75, 0, 0.12)
        self.fbox("dark", face, u - 0.08, u + 0.08, 1.45, 1.62, 0.12, 0.13)
        self.fbox("metal", face, u - 0.025, u + 0.025, 1.75, b["H"] + 0.3, 0.02, 0.06)
        self.fbox("concrete", face, b["RX"] - 0.25 if face == "front" else u + 1, (b["RX"] - 0.17) if face == "front" else u + 1.08, 0, b["H"], 0, 0.08)
        if ac:
            # on a side wall toward the back, where no door or window sits
            side = "left" if face in ("front", "back") else "front"
            ua = (b["BY"] - 1.4) if side == "left" else (b["LX"] + 0.9)
            za = min(b["H"] - 0.8, 2.2)
            self.fbox("white", side, ua - 0.35, ua + 0.35, za, za + 0.45, 0, 0.5)
            for i in range(5):
                uu = ua - 0.3 + i * 0.13
                self.fbox("dark", side, uu, uu + 0.05, za + 0.05, za + 0.4, 0.5, 0.51)

    def crates(self, x, y, n=3, role="accent"):
        if self.stage < 3:
            return
        for i in range(n):
            self.box(role if i % 2 == 0 else "accent2", x - 0.25, x + 0.25, y - 0.18, y + 0.18, i * 0.3, i * 0.3 + 0.28)

    def cooler(self, x, y):
        if self.stage < 3:
            return
        self.box("accent", x - 0.4, x + 0.4, y - 0.3, y + 0.3, 0, 0.9)
        self.box("glass", x - 0.32, x + 0.32, y - 0.31, y - 0.29, 0.15, 0.8)

    # ---------------------------------------------------------------- build
    def colour_of(self, role):
        if self.stage < 4:
            g = CLAY.get(role, 0.6)
            if role == "rust":
                g = 0.3
            if role in ("zinc2",):
                g = 0.6
            return (g, g, g)
        p = PALETTES[self.cw]
        walls = p["walls"]
        table = {
            "wall": walls[self.idx % len(walls)], "wall2": walls[(self.idx + 2) % len(walls)], "trim": p["trim"], "roof": p["roof"],
            "door": p["door"], "wood": p["wood"], "accent": p["accents"][self.idx % 4], "accent2": p["accents"][(self.idx + 1) % 4],
            "zinc2": (0.52, 0.54, 0.56), "rust": (0.42, 0.22, 0.12), "lit": (1.0, 0.78, 0.42), "litsign": p["accents"][self.idx % 4],
            "green": (0.10, 0.65, 0.30),
        }
        return table.get(role, FIXED.get(role, (0.6, 0.6, 0.6)))

    def finish(self, name):
        objs = []
        for role, (vs, fs) in self.geo.items():
            me = bpy.data.meshes.new(f"{name}_{role}")
            me.from_pydata([tuple(v) for v in vs], [], fs)
            me.update()
            mat = bpy.data.materials.get(f"MAT_{role}") or bpy.data.materials.new(f"MAT_{role}")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes["Principled BSDF"]
            c = self.colour_of(role)
            bsdf.inputs["Base Color"].default_value = (*srgb(c), 1)
            bsdf.inputs["Roughness"].default_value = 0.85 if role not in ("glass", "lit", "metal", "tank") else 0.35
            bsdf.inputs["Metallic"].default_value = 0.6 if role in ("metal", "zinc", "zinc2") and self.stage >= 4 else 0.0
            if role in ("lit", "litsign", "litgreen") and self.stage >= 4:
                bsdf.inputs["Emission Color"].default_value = (*srgb(c), 1)
                bsdf.inputs["Emission Strength"].default_value = 2.5
            me.materials.append(mat)
            o = bpy.data.objects.new(f"{name}_{role}", me)
            bpy.context.scene.collection.objects.link(o)
            objs.append(o)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        body = bpy.context.view_layer.objects.active
        body.name = body.data.name = name
        body.data.transform(Matrix.Scale(SCALE, 4))
        for p in body.data.polygons:
            p.use_smooth = False
        # collision: one box around the main volumes
        if self.collision:
            x0 = min(c[0] for c in self.collision); x1 = max(c[1] for c in self.collision)
            y0 = min(c[2] for c in self.collision); y1 = max(c[3] for c in self.collision)
            z1 = max(c[5] for c in self.collision)
            me = bpy.data.meshes.new(f"{name}-colonly")
            s = SCALE
            v = [(x * s, y * s, z * s) for z in (0, z1) for y in (y0, y1) for x in (x0, x1)]
            me.from_pydata(v, [], [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)])
            col = bpy.data.objects.new(f"{name}-colonly", me)
            bpy.context.scene.collection.objects.link(col)
            col.hide_render = True
        return body


# ==================================================================== designs
def casa_galeria(k):
    w, d, h, porch = 6.4, 8.6, 3.2, 2.0
    k.set_body(-w / 2, w / 2, -d / 2 + porch, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2 + porch, d / 2, h)
    k.base(); k.band(h - 0.25, 0.25)
    k.door("front", 0.0); k.window("front", -1.9, 1.0, 1.1, 1.2); k.window("front", 1.9, 1.0, 1.1, 1.2)
    k.window("left", 0.5, 1.0, 1.0, 1.2); k.window("right", 0.5, 1.0, 1.0, 1.2)
    if k.stage >= 2:
        k.box("concrete", -w / 2, w / 2, -d / 2, -d / 2 + porch, 0, 0.18)
        k.box("roof", -w / 2 - 0.1, w / 2 + 0.1, -d / 2 - 0.1, -d / 2 + porch, h - 0.05, h + 0.15)
        for x in (-w / 2 + 0.2, -0.9, 0.9, w / 2 - 0.2):
            k.box("trim", x - 0.14, x + 0.14, -d / 2 + 0.06, -d / 2 + 0.34, 0.18, h - 0.05)
    else:
        k.box("wall", -w / 2, w / 2, -d / 2, -d / 2 + porch, h - 0.1, h + 0.1)
    if k.stage >= 3:
        for x0, x1 in ((-w / 2 + 0.34, -1.04), (1.04, w / 2 - 0.34)):
            k.box("wall2", x0, x1, -d / 2 + 0.12, -d / 2 + 0.28, 0.18, 0.75)
    k.flat_roof(tank_at=(0.75, 0.3))
    k.utilities("front", u=-w / 2 + 0.5, ac=False)


def casa_zinc(k):
    w, d, h = 6.0, 7.6, 2.9
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.45)
    k.door("front", -1.2, 0.95, 2.1)
    k.window("front", 1.2, 0.9, 1.1, 1.2, kind="shutter")
    k.window("left", 0.0, 0.9, 1.0, 1.1, kind="shutter")
    k.window("right", 0.8, 0.9, 1.0, 1.1, kind="shutter")
    k.shed_roof(rise=0.8, over=0.45)
    if k.stage >= 3:
        k.box("wood", -w / 2 - 0.45, w / 2 + 0.45, -d / 2 - 0.5, -d / 2 - 0.42, h - 0.05, h + 0.12)
    k.utilities("front", u=w / 2 - 0.6, ac=False)


def casa_balcon(k):
    w, d, h = 6.8, 9.0, 6.0
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(); k.band(2.9); k.band(h - 0.22, 0.22)
    k.door("front", -2.0, 1.0, 2.2, kind="gate"); k.door("front", 0.6, 2.2, 2.3, kind="shutter")
    k.window("front", 2.6, 1.0, 0.9, 1.2)
    k.balcony("front", -w / 2 + 0.2, w / 2 - 0.2, 3.1, 1.2)
    k.door("front", -1.4, 1.0, 2.2, z=3.1); k.window("front", 0.6, 4.0, 1.2, 1.2); k.window("front", 2.3, 4.0, 1.0, 1.2)
    k.window("right", 0.0, 1.0, 1.0, 1.2); k.window("right", 0.0, 4.0, 1.0, 1.2)
    k.window("left", 2.0, 4.0, 1.0, 1.2)
    k.flat_roof(tank_at=(0.25, 0.5), dish=True)
    k.utilities("front", u=-w / 2 + 0.45, ac=True)


def casa_escalera(k):
    w, d, h = 6.4, 9.4, 6.0
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(); k.band(2.9); k.band(h - 0.22, 0.22)
    k.door("front", -1.4, 1.0, 2.2); k.window("front", 1.3, 1.0, 1.4, 1.2)
    k.window("front", -1.4, 4.0, 1.0, 1.2); k.window("front", 1.3, 4.0, 1.4, 1.2)
    k.window("left", 1.0, 1.0, 1.0, 1.2); k.window("left", 1.0, 4.0, 1.0, 1.2)
    # exterior stair up the right side, front to back
    if k.stage >= 2:
        n = 16
        run = 6.0
        for i in range(n):
            y0 = -d / 2 + 0.8 + i * run / n
            k.box("concrete", w / 2, w / 2 + 1.0, y0, y0 + run / n + 0.02, 0, (i + 1) * 3.0 / n)
        k.box("concrete", w / 2, w / 2 + 1.0, -d / 2 + 0.8 + run, d / 2 - 0.3, 2.9, 3.05)
        k.door("right", d / 2 - 1.2, 0.95, 2.2, z=3.05)
    if k.stage >= 3:
        for i in range(17):
            t = i / 16
            y = -d / 2 + 0.8 + t * 6.0
            k.box("metal", w / 2 + 0.95, w / 2 + 0.99, y - 0.015, y + 0.015, t * 3.0, t * 3.0 + 0.95)
        for i in range(30):
            t = (i + 0.5) / 30
            y = -d / 2 + 0.8 + t * 6.0
            k.box("metal", w / 2 + 0.94, w / 2 + 1.0, y - 0.11, y + 0.11, t * 3.0 + 0.92, t * 3.0 + 0.97)
    k.flat_roof(tank_at=(0.3, 0.6))
    k.utilities("front", u=-w / 2 + 0.45, ac=True)


def casa_victoriana(k):
    w, d, h, porch = 7.0, 8.4, 3.4, 2.0
    k.set_body(-w / 2, w / 2, -d / 2 + porch, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2 + porch, d / 2, h)
    if k.stage >= 2:
        # vertical wood siding look: thin trim boards on the front
        k.box("concrete", -w / 2 - 0.2, w / 2 + 0.2, -d / 2, d / 2, 0, 0.45)
    k.door("front", 0.0, 1.1, 2.3); k.window("front", -2.0, 0.9, 1.0, 1.6, kind="shutter"); k.window("front", 2.0, 0.9, 1.0, 1.6, kind="shutter")
    k.window("left", 1.0, 0.9, 1.0, 1.5, kind="shutter"); k.window("right", 1.0, 0.9, 1.0, 1.5, kind="shutter")
    if k.stage >= 3:
        for x in [-w / 2 + 0.2 + i * 0.32 for i in range(int(w / 0.32))]:
            k.box("trim", x - 0.02, x + 0.02, -d / 2 + porch - 0.03, -d / 2 + porch, 0.45, h)
    # porch: deck, slim posts, roof, fretwork
    if k.stage >= 2:
        k.box("wood", -w / 2, w / 2, -d / 2, -d / 2 + porch, 0, 0.5)
        k.box("roof", -w / 2 - 0.15, w / 2 + 0.15, -d / 2 - 0.2, -d / 2 + porch, h - 0.1, h + 0.05)
        for x in (-w / 2 + 0.15, -1.2, 1.2, w / 2 - 0.15):
            k.box("trim", x - 0.08, x + 0.08, -d / 2 + 0.08, -d / 2 + 0.24, 0.5, h - 0.1)
    if k.stage >= 3:
        for x0, x1 in ((-w / 2 + 0.25, -1.3), (1.3, w / 2 - 0.25)):
            n = int((x1 - x0) / 0.12)
            for i in range(n + 1):
                x = x0 + i * (x1 - x0) / n
                k.box("trim", x - 0.015, x + 0.015, -d / 2 + 0.12, -d / 2 + 0.16, 0.5, 1.2)
            k.box("trim", x0, x1, -d / 2 + 0.1, -d / 2 + 0.18, 1.2, 1.26)
        for i in range(22):
            x = -w / 2 + (i + 0.5) * w / 22
            k.box("trim", x - 0.06, x + 0.06, -d / 2 - 0.18, -d / 2 - 0.12, h - 0.42, h - 0.1)
        for i in range(3):
            k.box("wood", -0.7, 0.7, -d / 2 - 0.3 * (i + 1), -d / 2 - 0.3 * i, 0, 0.5 - 0.16 * (i + 1) + 0.16)
    k.gable_roof(rise=2.0, over=0.4)


def casa_esquina(k):
    w, d, h = 6.6, 8.6, 3.6
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(); k.band(h - 0.25, 0.25)
    k.door("front", 1.4, 1.0, 2.2); k.window("front", -1.0, 1.0, 1.6, 1.3)
    k.door("left", -1.0, 2.4, 2.4, kind="shutter"); k.window("left", 1.8, 1.0, 1.0, 1.2)
    k.awning("left", -2.4, 0.4, 2.55, 1.0, role="accent")
    k.sign("left", -2.4, 0.4, 2.75, 0.5, lit=True)
    k.flat_roof(tank_at=(0.7, 0.3))
    k.utilities("front", u=w / 2 - 0.6, ac=False)


def colmado(k):
    w, d, h = 7.0, 8.0, 3.8
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.4)
    k.door("front", -1.6, 2.4, 2.5, kind="open"); k.door("front", 1.6, 2.4, 2.5, kind="shutter")
    k.sign("front", -w / 2 + 0.1, w / 2 - 0.1, 2.75, 0.7, lit=True)
    k.sign("left", -d / 2 + 0.3, 1.5, 2.75, 0.7, lit=True)
    k.window("left", 2.4, 1.0, 1.0, 1.1)
    k.awning("front", -w / 2, w / 2, 2.6, 1.3, role="accent2")
    if k.stage >= 3:
        k.box("trim", -2.8, -0.4, -d / 2 - 0.02, -d / 2 + 0.4, 0, 1.0)  # counter inside the open bay
        k.box("lit" if (k.cw == "noche" and k.stage >= 4) else "dark", -2.8, -0.4, -d / 2 + 0.3, -d / 2 + 0.35, 1.0, 2.4)
        k.crates(-3.2, -d / 2 - 0.5, 4); k.crates(-2.6, -d / 2 - 0.5, 3); k.cooler(2.9, -d / 2 - 0.6)
        for x in (0.2, 0.9):
            k.box("white", x - 0.25, x + 0.25, -d / 2 - 0.9, -d / 2 - 0.4, 0, 0.45)
            k.box("white", x - 0.25, x + 0.25, -d / 2 - 0.45, -d / 2 - 0.4, 0.45, 0.95)
    k.flat_roof(rebar=True, tank_at=(0.3, 0.3))
    k.utilities("left", u=1.2, ac=True)


def barberia(k):
    w, d, h = 5.6, 7.6, 3.5
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.4)
    k.door("front", 1.6, 1.0, 2.3, kind="glass")
    k.window("front", -0.9, 0.5, 2.8, 1.9, lit=True)
    k.sign("front", -w / 2 + 0.1, w / 2 - 0.1, 2.75, 0.55, lit=True)
    if k.stage >= 3:
        x = w / 2 - 0.2
        for i in range(10):
            k.cyl(["accent", "white", "accent2"][i % 3], x, -d / 2 - 0.25, 1.0 + i * 0.12, 1.12 + i * 0.12, 0.09, n=10)
        k.cyl("white", x, -d / 2 - 0.25, 2.2, 2.32, 0.11, n=10)
        k.box("metal", x - 0.03, x + 0.03, -d / 2 - 0.2, -d / 2, 1.5, 1.56)
    k.flat_roof(rebar=False, tank_at=(0.5, 0.4))
    k.utilities("front", u=-w / 2 + 0.4, ac=True)


def taller(k):
    w, d, h = 7.2, 9.0, 4.2
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.4)
    k.door("front", -0.6, 4.4, 3.2, kind="open")
    k.window("front", 2.9, 1.2, 0.8, 1.0)
    k.sign("front", -w / 2 + 0.1, w / 2 - 0.1, 3.35, 0.6, lit=True)
    if k.stage >= 3:
        k.box("metal", -2.8, 1.6, -d / 2 - 0.1, -d / 2 + 0.05, 2.9, 3.3)  # rolled-up shutter drum
        for i in range(4):
            k.cyl("rubber", 2.6, -d / 2 - 0.6, i * 0.22, i * 0.22 + 0.2, 0.35, n=14)
        k.cyl("accent", -3.0, -d / 2 - 0.5, 0, 0.9, 0.3, n=14)
        k.box("dark", -2.6, 1.4, -d / 2 + 0.3, -d / 2 + 0.6, 0, 0.02)
    k.flat_roof(rebar=True, tank=False)
    k.utilities("front", u=w / 2 - 0.35, ac=False)


def farmacia(k):
    w, d, h = 5.8, 7.6, 3.7
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.4)
    k.door("front", 0.0, 1.3, 2.3, kind="glass")
    k.window("front", -1.9, 0.7, 1.4, 1.6, lit=True); k.window("front", 1.9, 0.7, 1.4, 1.6, lit=True)
    k.sign("front", -w / 2 + 0.1, w / 2 - 0.1, 2.85, 0.6, role="white", lit=False)
    if k.stage >= 3:
        x, y = w / 2 + 0.05, -d / 2 + 0.6
        k.box("metal", x, x + 0.6, y - 0.03, y + 0.03, 2.95, 3.0)
        cross = "litgreen" if (k.cw == "noche" and k.stage >= 4) else "green"
        k.box(cross, x + 0.4, x + 0.5, y - 0.35, y + 0.35, 2.75, 2.85)
        k.box(cross, x + 0.4, x + 0.5, y - 0.12, y + 0.12, 2.48, 3.12)
    k.flat_roof(rebar=False, tank_at=(0.4, 0.4))
    k.utilities("front", u=-w / 2 + 0.35, ac=True)


def tienda_2p(k):
    w, d, h = 6.2, 9.0, 6.2
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.4); k.band(3.2); k.band(h - 0.22, 0.22)
    k.door("front", -0.9, 3.0, 2.5, kind="shutter"); k.door("front", 2.1, 0.95, 2.3, kind="gate")
    k.sign("front", -w / 2 + 0.1, w / 2 - 0.1, 2.6, 0.5, lit=True)
    k.balcony("front", -2.4, 1.4, 3.4, 1.0)
    k.door("front", -0.5, 1.0, 2.2, z=3.4); k.window("front", 2.2, 4.2, 1.0, 1.2)
    k.window("right", 1.0, 4.2, 1.0, 1.2); k.window("left", -1.0, 4.2, 1.0, 1.2)
    k.flat_roof(tank_at=(0.7, 0.5))
    k.utilities("front", u=w / 2 - 0.35, ac=True)


def apartamentos(k):
    w, d, h = 7.2, 10.0, 9.0
    k.set_body(-w / 2, w / 2, -d / 2, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2, d / 2, h)
    k.base(0.5)
    for fl in (2.95, 5.95):
        k.band(fl, 0.18)
    k.band(h - 0.22, 0.22)
    k.door("front", 0.0, 1.2, 2.3, kind="gate")
    k.window("front", -2.4, 1.0, 1.2, 1.2); k.window("front", 2.4, 1.0, 1.2, 1.2)
    for z in (3.1, 6.1):
        for u0, u1 in ((-w / 2 + 0.2, -0.4), (0.4, w / 2 - 0.2)):
            k.balcony("front", u0, u1, z, 1.0)
            k.door("front", (u0 + u1) / 2 - 0.6, 0.9, 2.1, z=z)
            k.window("front", (u0 + u1) / 2 + 0.75, z + 0.9, 0.9, 1.1)
        for u in (-2.5, 0.0, 2.5):
            k.window("right", u, z + 0.9, 1.0, 1.1)
            k.window("left", u, z + 0.9, 1.0, 1.1)
    k.flat_roof(tank_at=(0.25, 0.5), dish=True)
    if k.stage >= 3:
        b = k.body
        tx, ty = b["RX"] - 1.6, b["FY"] + 3.0
        k.cyl("tank", tx, ty, h + 0.86, h + 2.0, 0.55, n=16)
        for dx, dy in ((-0.35, -0.35), (0.35, -0.35), (-0.35, 0.35), (0.35, 0.35)):
            k.box("metal", tx + dx - 0.03, tx + dx + 0.03, ty + dy - 0.03, ty + dy + 0.03, h + 0.12, h + 0.86)
    k.utilities("front", u=-w / 2 + 0.45, ac=True)


def iglesia(k):
    w, d, h = 7.0, 11.0, 5.0
    tw = 2.4
    k.set_body(-w / 2, w / 2, -d / 2 + 1.0, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2 + 1.0, d / 2, h, role="white")
    k.gable_roof(rise=2.2, over=0.3, trim=False, wall_role="white")
    # bell tower in front of the nave
    th = 9.0
    k.walls(-tw / 2, tw / 2, -d / 2, -d / 2 + 1.6, th, role="white")
    if k.stage >= 2:
        k.box("trim", -tw / 2 - 0.1, tw / 2 + 0.1, -d / 2 - 0.1, -d / 2 + 1.7, th, th + 0.2)
        v = [Vector((-tw / 2 - 0.1, -d / 2 - 0.1, th + 0.2)), Vector((tw / 2 + 0.1, -d / 2 - 0.1, th + 0.2)),
             Vector((tw / 2 + 0.1, -d / 2 + 1.7, th + 0.2)), Vector((-tw / 2 - 0.1, -d / 2 + 1.7, th + 0.2)), Vector((0, -d / 2 + 0.8, th + 1.8))]
        k._add("roof", v, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)])
        k.box("dark", -0.7, 0.7, -d / 2 - 0.02, -d / 2 + 0.02, th - 2.6, th - 1.0)  # belfry opening
        k.box("glass", -0.6, 0.6, -d / 2 - 0.03, -d / 2 + 0.02, 0.25, 2.8)
        k.box("door", -0.55, 0.55, -d / 2 - 0.05, -d / 2 + 0.02, 0.25, 2.7)
        k.box("concrete", -1.4, 1.4, -d / 2 - 0.9, -d / 2, 0, 0.25)
        for y in (-1.0, 1.0, 3.0):
            for side in (-1, 1):
                k.box("glass", side * w / 2 - 0.05, side * w / 2 + 0.05, y - 0.35, y + 0.35, 1.6, 3.6)
                k.box("trim", side * w / 2 - 0.08, side * w / 2 + 0.08, y - 0.45, y + 0.45, 3.6, 3.75)
    if k.stage >= 3:
        k.cyl("metal", 0, -d / 2 + 0.8, th - 2.4, th - 1.7, 0.35, n=14)  # bell
        k.box("white", -0.05, 0.05, -d / 2 + 0.75, -d / 2 + 0.85, th + 1.8, th + 2.8)
        k.box("white", -0.35, 0.35, -d / 2 + 0.75, -d / 2 + 0.85, th + 2.3, th + 2.4)
        k.box("trim", -tw / 2 - 0.05, tw / 2 + 0.05, -d / 2 - 0.05, -d / 2 + 1.65, 3.6, 3.75)


def escuela(k):
    w, d, h, walk = 7.4, 9.0, 3.6, 1.8
    k.set_body(-w / 2, w / 2, -d / 2 + walk, d / 2, h)
    k.walls(-w / 2, w / 2, -d / 2 + walk, d / 2, h)
    k.base(1.0); k.band(h - 0.25, 0.25)
    k.door("front", 0.0, 1.2, 2.3)
    for u in (-2.6, -1.4, 1.4, 2.6):
        k.window("front", u, 1.2, 0.9, 1.4, kind="shutter")
    k.window("left", 1.0, 1.2, 1.2, 1.4, kind="shutter"); k.window("right", 1.0, 1.2, 1.2, 1.4, kind="shutter")
    if k.stage >= 2:
        k.box("roof", -w / 2 - 0.1, w / 2 + 0.1, -d / 2 - 0.1, -d / 2 + walk, h - 0.05, h + 0.12)
        k.box("concrete", -w / 2, w / 2, -d / 2, -d / 2 + walk, 0, 0.15)
        for x in (-w / 2 + 0.2, -1.2, 1.2, w / 2 - 0.2):
            k.box("trim", x - 0.13, x + 0.13, -d / 2 + 0.05, -d / 2 + 0.31, 0.15, h - 0.05)
    if k.stage >= 3:
        x, y = -w / 2 - 0.6, -d / 2 + 0.2
        k.cyl("white", x, y, 0, 6.0, 0.04, n=8)
        for (z0, z1, y0, y1, role) in ((5.0, 5.35, 0.0, 0.45, "flagblue"), (5.0, 5.35, 0.55, 1.0, "flagred"),
                                       (5.45, 5.8, 0.0, 0.45, "flagred"), (5.45, 5.8, 0.55, 1.0, "flagblue")):
            k.box(role, x - 0.01, x + 0.01, y + y0 + 0.05, y + y1 + 0.05, z0, z1)
        k.box("white", x - 0.012, x + 0.012, y + 0.05, y + 1.05, 5.35, 5.45)
        k.box("white", x - 0.012, x + 0.012, y + 0.5, y + 0.6, 5.0, 5.8)
    k.flat_roof(rebar=False, tank_at=(0.8, 0.5))


def fondo(k):
    units = [(-4.2, -1.4, 4.4), (-1.4, 1.4, 7.0), (1.4, 4.2, 5.2)]
    d = 6.0
    for i, (x0, x1, h) in enumerate(units):
        role = "wall" if i != 1 else "wall2"
        k.walls(x0, x1, -d / 2, d / 2, h, role=role)
        if k.stage >= 2:
            k.box("roof", x0 - 0.05, x1 + 0.05, -d / 2 - 0.05, d / 2 + 0.05, h, h + 0.25)
            for fl in range(int(h // 2.6)):
                for u in (x0 + 0.7, x1 - 0.7):
                    z = 0.9 + fl * 2.6
                    lit = "lit" if (k.cw == "noche" and k.stage >= 4 and (fl + i + int(u)) % 2 == 0) else "glass"
                    k.box(lit, u - 0.4, u + 0.4, -d / 2 - 0.03, -d / 2, z, z + 1.0)
        if k.stage >= 3 and i == 1:
            k.cyl("tank", (x0 + x1) / 2, 0.0, h + 0.25, h + 1.3, 0.5, n=12)


DESIGNS = [("casa-galeria", casa_galeria), ("casa-zinc", casa_zinc), ("casa-balcon", casa_balcon), ("casa-escalera", casa_escalera),
           ("casa-victoriana", casa_victoriana), ("casa-esquina", casa_esquina), ("colmado", colmado), ("barberia", barberia),
           ("taller", taller), ("farmacia", farmacia), ("tienda-2p", tienda_2p), ("apartamentos", apartamentos),
           ("iglesia", iglesia), ("escuela", escuela), ("fondo", fondo)]
EXTRA = {"flagblue": (0.0, 0.18, 0.55), "flagred": (0.80, 0.08, 0.12), "litgreen": (0.15, 0.95, 0.40)}


# ==================================================================== render
def render(body, out_dir: Path, stage, colour):
    scene = bpy.context.scene
    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
    scene.render.resolution_x, scene.render.resolution_y = 900, 900
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    night = colour == "noche" and stage >= 4
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.06, 0.07, 0.12, 1) if night else (0.42, 0.45, 0.5, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6 if night else 1.0
    scene.world = world
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 0.6 if night else 3.0
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    scene.collection.objects.link(sun)
    ground = bpy.data.meshes.new("Ground")
    ground.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)])
    g = bpy.data.objects.new("Ground", ground)
    gm = bpy.data.materials.new("Ground")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.2, 0.22, 1) if not night else (0.04, 0.04, 0.06, 1)
    ground.materials.append(gm)
    scene.collection.objects.link(g)
    pts = [body.matrix_world @ v.co for v in body.data.vertices]
    lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = "ORTHO"
    focus = (lo + hi) / 2
    for label, az, el in (("hero", -35, 22), ("front", 0, 8)):
        a, e = math.radians(az), math.radians(el)
        cam.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) * 1.35
        cam.location = focus + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 30
        cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_end = 200
        scene.render.filepath = str(out_dir / f"{label}.png")
        bpy.ops.render.render(write_still=True)


def build(name, fn, idx, stage, colour, out: Path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    k = Kit(idx, stage, colour)
    fn(k)
    base_colour = k.colour_of

    def colour_with_extra(role, _base=base_colour):
        if stage >= 4 and role in EXTRA:
            return EXTRA[role]
        return _base(role)

    k.colour_of = colour_with_extra
    body = k.finish(name.replace("-", "_"))
    folder = out / name / (STAGES[stage] + (f"-{colour}" if stage >= 4 else ""))
    folder.mkdir(parents=True, exist_ok=True)
    render(body, folder, stage, colour)
    bpy.ops.wm.save_as_mainfile(filepath=str(folder / f"{name}.blend"))
    if stage >= 4:
        bpy.ops.object.select_all(action="DESELECT")
        for o in bpy.context.scene.objects:
            if o.type == "MESH" and o.name not in ("Ground",):
                o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(folder / f"{name}-{colour}.glb"), export_format="GLB", use_selection=True)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    pts = [v.co for v in body.data.vertices]
    lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
    info = {"design": name, "stage": STAGES[stage], "colourway": colour if stage >= 4 else None, "triangles": tris,
            "materials": len(body.data.materials), "size_game_units": [round(c, 3) for c in (hi - lo)]}
    (folder / "info.json").write_text(json.dumps(info, indent=1))
    print("BUILT", json.dumps(info))


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:]
    which, stage, colour, out = args[0], int(args[1]), args[2], Path(args[3])
    for i, (name, fn) in enumerate(DESIGNS):
        if which in ("all", name):
            build(name, fn, i, stage, colour, out)
