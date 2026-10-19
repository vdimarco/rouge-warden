"""Plateau street props and living-street companions, modelled procedurally in Blender.

Run with the Blender Python module (bpy 5.1) or inside Blender:
    <venv>/bin/python Scripts/blender/plateau_props.py [--out DIR] [--sheet PNG] [--no-render] [--only key,key]
    blender -b --factory-startup -P Scripts/blender/plateau_props.py -- [same options]

Writes one OBJ per prop part (one material each) and manifest.json to
Data/Plateau/ReplicaGeometry/Props/, and a Cycles contact sheet to
Preview/Replica/props_contact_sheet.png. Geometry is built from code (no random state
without a fixed seed, no timestamps), so two runs write byte-identical OBJs and manifest.

Axes: geometry is authored in Blender's right-handed axes, centimetres, +X forward, +Y left,
+Z up, pivot at the base centre. The OBJ stores those coordinates unchanged. That is the
file convention of Scripts/plateau_mesh.py (file = (x, -y, z) of the game-frame point,
counter-clockwise outward in file space), so after Unreal's OBJ import (which flips Y) each
prop looks exactly as authored here, text reads left to right, and its Unreal-local frame
is (x_file, -y_file, z_file). Manifest positions, anchors and bounds use that Unreal-local
frame (X forward, Y right, Z up), which is also the game frame of the map scripts: an
actor at game position (x, y) with yaw atan2(dy, dx) faces the game direction (dx, dy).
"""
import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

import bpy  # noqa: E402  (bpy first: it registers bmesh and mathutils)
import bmesh
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
LAYER = 'Props'
OUT = ROOT / 'Data/Plateau/ReplicaGeometry/Props'
SHEET = ROOT / 'Preview/Replica/props_contact_sheet.png'
GENERATOR = 'Scripts/blender/plateau_props.py'

# sRGB hex, roughness, metallic, emissive strength (0 = none). Values follow
# research-plateau.md §9 where a reference exists; the others are art-direction estimates.
MATERIALS = {
    'PoleGalv': ('#8C9092', .45, .7, 0), 'PoleGrey': ('#6F7275', .5, .5, 0),
    'IronBlack': ('#1E2424', .5, .6, 0), 'SteelDark': ('#2B2D30', .45, .7, 0),
    'Chrome': ('#C8CCCF', .25, 1.0, 0), 'Rubber': ('#151515', .85, 0, 0),
    'PlasticBlack': ('#1C1C1C', .6, 0, 0),
    'LampHousing': ('#6F7275', .45, .6, 0), 'LampLens3000K': ('#FFB46B', .3, 0, 6),
    'GlobeWhite': ('#EDEDE6', .2, 0, 3),
    'HydrantRed': ('#BB1815', .45, .1, 0), 'HydrantIron': ('#2B2B2B', .6, .3, 0),
    'SignRed': ('#C8102E', .4, 0, 0), 'SignWhite': ('#F4F4F0', .4, 0, 0),
    'SignBlack': ('#111111', .5, 0, 0), 'SignRosette': ('#D52B1E', .4, 0, 0),
    'SignGreen': ('#007A3D', .4, 0, 0), 'SignBack': ('#A9ADB0', .4, .8, 0),
    'BixiDock': ('#8C9095', .45, .5, 0), 'BixiDark': ('#2A2D31', .5, .3, 0),
    'BixiRed': ('#D52B1E', .4, 0, 0), 'BixiFrame': ('#A9ADB0', .4, .6, 0),
    'BixiScreen': ('#9FD3E6', .2, 0, 1.5), 'SolarPanel': ('#1B2A44', .2, .3, 0),
    'BinBlue': ('#1F5FAE', .55, 0, 0), 'BinBlueDark': ('#1A4A86', .55, 0, 0),
    'BinBlueLight': ('#2F78C4', .55, 0, 0),
    'BinBrown': ('#5E4130', .55, 0, 0), 'BinBrownDark': ('#45301F', .55, 0, 0),
    'BinBrownOlive': ('#5A4A2C', .55, 0, 0), 'LabelWhite': ('#F2F2EE', .5, 0, 0),
    'BagBlack': ('#121314', .3, 0, 0), 'BagGreen': ('#1F3324', .3, 0, 0),
    'BagGrey': ('#3A3D40', .3, 0, 0),
    'ConeOrange': ('#F26A1B', .5, 0, 0), 'ConeFaded': ('#E0743A', .6, 0, 0),
    'ReflectWhite': ('#F2F2EE', .35, 0, 0),
    'BarrierOrange': ('#F07A1A', .5, 0, 0), 'AmberLamp': ('#FFB000', .3, 0, 4),
    'WoodPole': ('#6B5A47', .9, 0, 0), 'WoodPoleGrey': ('#7A7268', .9, 0, 0),
    'WoodPoleDark': ('#4F4235', .9, 0, 0),
    'Insulator': ('#5E8C7A', .15, 0, 0), 'InsulatorWhite': ('#D8D6CF', .3, 0, 0),
    'LaundryRope': ('#D9D2C3', .9, 0, 0),
    'ClothWhite': ('#E8E6DF', .8, 0, 0), 'ClothBlue': ('#2F5D8C', .8, 0, 0),
    'ClothOchre': ('#C9A227', .8, 0, 0), 'ClothRed': ('#A0403A', .8, 0, 0),
    'ClothGreen': ('#4E7A5A', .8, 0, 0), 'ClothPink': ('#D88FA0', .8, 0, 0),
    'ClothDenim': ('#3A4F6E', .85, 0, 0), 'ClothGrey': ('#8C8A86', .85, 0, 0),
    'AcBody': ('#E3E0D6', .5, .1, 0), 'AcBeige': ('#D6CBB2', .5, .1, 0),
    'AcGrey': ('#B9BCBC', .5, .2, 0), 'AcGrille': ('#55585A', .6, .3, 0),
    'BoxWood': ('#7A5230', .8, 0, 0), 'BoxGreen': ('#2E4D3E', .7, 0, 0),
    'BoxWhite': ('#E8E6DF', .7, 0, 0), 'Soil': ('#3B2A1E', 1.0, 0, 0),
    'Leaf': ('#4E7A3A', .7, 0, 0), 'FlowerRed': ('#D8344A', .6, 0, 0),
    'FlowerPink': ('#E87BA8', .6, 0, 0), 'FlowerWhite': ('#F4F1E8', .6, 0, 0),
    'BenchIron': ('#2A2622', .5, .5, 0), 'BenchWood': ('#5A3E2B', .8, 0, 0),
    'BenchWoodLight': ('#8A6440', .8, 0, 0), 'BenchGreen': ('#2F4A3A', .7, 0, 0),
    'MailRed': ('#DA291C', .4, .1, 0), 'MailBlack': ('#1E1F1F', .5, .3, 0),
    'LightbarRed': ('#E0161E', .2, 0, 5), 'LightbarBlue': ('#1E4FE0', .2, 0, 5),
    'LightbarClear': ('#E8ECEF', .15, 0, 0),
    'BikeRed': ('#A23B2E', .4, .3, 0), 'BikeTeal': ('#3D7A84', .4, .3, 0),
    'BikeBlack': ('#1E1F1F', .4, .3, 0), 'BikeCream': ('#D8CDB0', .4, .2, 0),
    'LockYellow': ('#E8B70E', .4, .2, 0),
    'DogCoatTan': ('#B98A55', .9, 0, 0), 'DogCoatBlack': ('#22201E', .85, 0, 0),
    'DogCoatWhite': ('#E9E2D3', .9, 0, 0), 'DogCoatBrown': ('#6B4430', .9, 0, 0),
    'DogCoatGolden': ('#D2A35E', .9, 0, 0), 'DogCoatGrey': ('#8C8A86', .9, 0, 0),
    'DogCoatChocolate': ('#4A2F22', .9, 0, 0), 'DogDark': ('#121110', .3, 0, 0),
    'CollarRed': ('#C8102E', .5, 0, 0), 'CollarBlue': ('#1F5FAE', .5, 0, 0),
    'CollarGreen': ('#2F7D46', .5, 0, 0),
    'StrollerFrame': ('#2B2D30', .4, .6, 0), 'StrollerSilver': ('#A9ADB0', .35, .8, 0),
    'FabricNavy': ('#1F3A5F', .9, 0, 0), 'FabricGrey': ('#6F7275', .9, 0, 0),
    'FabricOlive': ('#56624A', .9, 0, 0), 'FabricCharcoal': ('#2B2B2B', .9, 0, 0),
    'FabricBurgundy': ('#6A1E2A', .9, 0, 0), 'FabricSand': ('#C4A27A', .9, 0, 0),
    'Kraft': ('#B08A5A', .9, 0, 0), 'KraftDark': ('#5A4632', 1.0, 0, 0),
    'Bread': ('#C88B45', .8, 0, 0), 'LeekWhite': ('#E5E3C9', .7, 0, 0),
}

# Colour variant groups: a part authored with the first key may be swapped for the others.
VARIANTS = [
    ['BinBlue', 'BinBlueDark', 'BinBlueLight'], ['BinBrown', 'BinBrownDark', 'BinBrownOlive'],
    ['BagBlack', 'BagGreen', 'BagGrey'], ['ConeOrange', 'ConeFaded'],
    ['WoodPole', 'WoodPoleGrey', 'WoodPoleDark'], ['Insulator', 'InsulatorWhite'],
    ['AcBody', 'AcBeige', 'AcGrey'], ['BoxWood', 'BoxGreen', 'BoxWhite'],
    ['FlowerRed', 'FlowerPink', 'FlowerWhite'], ['BenchWood', 'BenchWoodLight', 'BenchGreen'],
    ['BikeRed', 'BikeTeal', 'BikeBlack', 'BikeCream'],
    ['ClothWhite', 'ClothGrey', 'ClothPink'], ['ClothBlue', 'ClothDenim', 'ClothGreen'],
    ['ClothOchre', 'ClothRed', 'ClothPink'], ['ClothRed', 'ClothOchre', 'ClothGreen'],
    ['DogCoatTan', 'DogCoatWhite', 'DogCoatBlack'], ['DogCoatBrown', 'DogCoatBlack', 'DogCoatGrey'],
    ['DogCoatGolden', 'DogCoatBlack', 'DogCoatChocolate'],
    ['CollarRed', 'CollarBlue', 'CollarGreen'], ['StrollerFrame', 'StrollerSilver'],
    ['FabricNavy', 'FabricGrey', 'FabricOlive'], ['FabricCharcoal', 'FabricBurgundy', 'FabricSand'],
    ['PoleGalv', 'PoleGrey'],
]
VARIANT_OF = {group[0]: group[1:] for group in VARIANTS}


def T(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """Translation @ XYZ-Euler rotation (degrees) @ scale."""
    if not isinstance(scale, (tuple, list)):
        scale = (scale, scale, scale)
    r = Euler(tuple(math.radians(a) for a in rot), 'XYZ').to_matrix().to_4x4()
    return Matrix.Translation(Vector(loc)) @ r @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))


def _newell(points):
    n = Vector((0, 0, 0))
    for a, b in zip(points, points[1:] + points[:1]):
        n.x += (a[1] - b[1]) * (a[2] + b[2])
        n.y += (a[2] - b[2]) * (a[0] + b[0])
        n.z += (a[0] - b[0]) * (a[1] + b[1])
    return n


def _orient_convex(verts, faces, centre=(0, 0, 0)):
    out, c = [], Vector(centre)
    for f in faces:
        pts = [Vector(verts[i]) for i in f]
        mid = sum(pts, Vector()) / len(pts)
        out.append(tuple(f) if _newell(pts).dot(mid - c) >= 0 else tuple(f[::-1]))
    return out


def outward(geo):
    """Flip a closed primitive whose faces point inward (negative signed volume)."""
    verts, faces, smooth = geo
    vol = 0.0
    for f in faces:
        a = Vector(verts[f[0]])
        for i in range(1, len(f) - 1):
            vol += a.dot(Vector(verts[f[i]]).cross(Vector(verts[f[i + 1]])))
    return (verts, [tuple(f[::-1]) for f in faces] if vol < 0 else faces, smooth)


def _area2(outline):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(outline, outline[1:] + outline[:1]))


# ---------------------------------------------------------------- primitives (local space)

def box_geo(size, bevel=0.0):
    a, b, c = (s / 2 for s in size)
    if bevel <= 0:
        v = [(x * a, y * b, z * c) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        return v, _orient_convex(v, faces), False
    r = min(bevel, a * .49, b * .49, c * .49)
    half = (a, b, c)
    signs = [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    v, vid = [], {}
    for s in signs:
        for k in range(3):
            p = [s[0] * (a - r), s[1] * (b - r), s[2] * (c - r)]
            p[k] = s[k] * half[k]
            vid[(s, k)] = len(v)
            v.append(tuple(p))
    faces = []
    for k in range(3):
        o = [i for i in range(3) if i != k]
        for sk in (-1, 1):
            pts = [vid[(s, k)] for s in signs if s[k] == sk]
            pts.sort(key=lambda i: math.atan2(v[i][o[1]], v[i][o[0]]))
            faces.append(tuple(pts))
    for j in range(3):
        k, m = [i for i in range(3) if i != j]
        for sk in (-1, 1):
            for sm in (-1, 1):
                def corner(sj):
                    s = [0, 0, 0]
                    s[j], s[k], s[m] = sj, sk, sm
                    return tuple(s)
                faces.append((vid[(corner(-1), k)], vid[(corner(-1), m)], vid[(corner(1), m)], vid[(corner(1), k)]))
    for s in signs:
        faces.append((vid[(s, 0)], vid[(s, 1)], vid[(s, 2)]))
    return v, _orient_convex(v, faces), False


def lathe_geo(profile, sides, phase=0.0, rfunc=None, cap0=True, cap1=True, hard=40.0, smooth=True):
    """Revolve (r, z) points (bottom to top along the outer surface) about local Z."""
    n = len(profile)
    v, faces, sm = [], [], []

    def ring(r, z):
        if r < 1e-6:
            v.append((0.0, 0.0, z))
            return [len(v) - 1] * sides
        ids = []
        for i in range(sides):
            t = phase + i * math.tau / sides
            rr = r * (rfunc(i) if rfunc else 1.0)
            ids.append(len(v))
            v.append((rr * math.cos(t), rr * math.sin(t), z))
        return ids

    def turn(i):
        d1 = (profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1])
        d2 = (profile[i + 1][0] - profile[i][0], profile[i + 1][1] - profile[i][1])
        l1, l2 = math.hypot(*d1), math.hypot(*d2)
        if l1 < 1e-9 or l2 < 1e-9:
            return 180
        return math.degrees(math.acos(max(-1, min(1, (d1[0] * d2[0] + d1[1] * d2[1]) / (l1 * l2)))))

    rin, rout = [], []
    for i, (r, z) in enumerate(profile):
        a = ring(r, z)
        rin.append(a)
        rout.append(ring(r, z) if (0 < i < n - 1 and r > 1e-6 and turn(i) > hard) else a)
    for i in range(n - 1):
        A, B = rout[i], rin[i + 1]
        for k in range(sides):
            k2 = (k + 1) % sides
            f = []
            for q in (A[k], A[k2], B[k2], B[k]):
                if not f or f[-1] != q:
                    f.append(q)
            if len(f) > 1 and f[0] == f[-1]:
                f.pop()
            if len(f) >= 3:
                faces.append(tuple(f))
                sm.append(smooth)
    if cap0 and profile[0][0] > 1e-6:
        faces.append(tuple(rin[0][::-1]))
        sm.append(False)
    if cap1 and profile[-1][0] > 1e-6:
        faces.append(tuple(rout[-1]))
        sm.append(False)
    return v, faces, sm


def tube_geo(path, radius, sides=6, caps=True, smooth=True, closed=False, phase=0.0):
    pts = [Vector(p) for p in path]
    n = len(pts)
    radii = list(radius) if isinstance(radius, (list, tuple)) else [radius] * n
    tangents = []
    for i in range(n):
        if closed:
            d = (pts[(i + 1) % n] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        elif i == 0:
            d = pts[1] - pts[0]
        elif i == n - 1:
            d = pts[-1] - pts[-2]
        else:
            d = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        tangents.append(d.normalized())
    t0 = tangents[0]
    ref = Vector((0, 0, 1)) if abs(t0.z) < .9 else Vector((1, 0, 0))
    normal = t0.cross(ref).normalized()
    v, faces, sm, rings = [], [], [], []
    for i in range(n):
        t = tangents[i]
        normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        ids = []
        for k in range(sides):
            a = phase + k * math.tau / sides
            p = pts[i] + radii[i] * (math.cos(a) * normal + math.sin(a) * binormal)
            ids.append(len(v))
            v.append(tuple(p))
        rings.append(ids)
    segs = n if closed else n - 1
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append((A[k], A[k2], B[k2], B[k]))
            sm.append(smooth)
    if caps and not closed:
        faces.append(tuple(rings[0][::-1]))
        sm.append(False)
        faces.append(tuple(rings[-1]))
        sm.append(False)
    return v, faces, sm


def prism_geo(outline, depth, front=True, back=True, sides=True):
    """Extrude an XY outline along Z from -depth/2 to +depth/2 (front cap faces +Z)."""
    if _area2(outline) < 0:
        outline = outline[::-1]
    n, h = len(outline), depth / 2
    v = [(x, y, -h) for x, y in outline] + [(x, y, h) for x, y in outline]
    faces, sm = [], []
    if back:
        faces.append(tuple(range(n))[::-1])
        sm.append(False)
    if front:
        faces.append(tuple(range(n, 2 * n)))
        sm.append(False)
    if sides:
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
            sm.append(False)
    return v, faces, sm


def ellipsoid_profile(rz, rings=7):
    return [(math.sin(math.pi * i / rings), -math.cos(math.pi * i / rings) * rz) for i in range(rings + 1)]


def text_geo(body, size, fit_width=None, fit_height=None, bold=0.0):
    """Flat filled glyphs from Blender's built-in font, in XY reading +X, facing +Z, centred."""
    curve = bpy.data.curves.new('glyphs', 'FONT')
    curve.body = body
    curve.size = size
    curve.resolution_u = 2
    curve.offset = bold
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.fill_mode = 'BOTH'
    obj = bpy.data.objects.new('glyphs', curve)
    bpy.context.scene.collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    v = [tuple(p.co) for p in mesh.vertices]
    faces = [tuple(p.vertices) for p in mesh.polygons]
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    bpy.data.meshes.remove(mesh)
    xs, ys = [p[0] for p in v], [p[1] for p in v]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = 1.0
    if fit_width:
        s = fit_width / w
    if fit_height:
        s = min(s, fit_height / h) if fit_width else fit_height / h
    v = [((x - cx) * s, (y - cy) * s, 0.0) for x, y, _ in v]
    faces = [f if _newell([v[i] for i in f]).z >= 0 else f[::-1] for f in faces]
    return v, faces, False


# ------------------------------------------------------------------- parts and props

class Part:
    def __init__(self):
        self.v, self.f, self.s = [], [], []

    def add(self, geo, M=None):
        verts, faces, smooth = geo
        o = len(self.v)
        for p in verts:
            q = M @ Vector(p) if M is not None else Vector(p)
            self.v.append((q.x, q.y, q.z))
        flags = smooth if isinstance(smooth, list) else [smooth] * len(faces)
        flip = M is not None and M.to_3x3().determinant() < 0
        for face, s in zip(faces, flags):
            face = tuple(i + o for i in face)
            self.f.append(face[::-1] if flip else face)
            self.s.append(s)
        return self

    def merged(self, other, M=None):
        self.add((other.v, other.f, other.s), M)
        return self


AXIS_X = (0, 90, 0)      # local Z -> +X
AXIS_Y = (-90, 0, 0)     # local Z -> +Y
FACE_PX = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # glyph +X->+Y, +Z->+X
FACE_NX = Matrix(((0, 0, -1, 0), (-1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # reads -Y, faces -X
FACE_PY = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # reads -X, faces +Y
FACE_NY = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # reads +X, faces -Y


class Prop:
    def __init__(self, key, kind, description, pivot):
        self.key, self.kind, self.description, self.pivot = key, kind, description, pivot
        self.parts = {}
        self.anchors = {}
        self.colliders = []
        self.extra = {}

    def part(self, name, material, collision='none'):
        assert name.replace('_', '').isalnum() and material in MATERIALS, (name, material)
        if name not in self.parts:
            self.parts[name] = {'geo': Part(), 'material': material, 'collision': collision,
                                'attach': None, 'joint': None}
        assert self.parts[name]['material'] == material, (self.key, name)
        return self.parts[name]['geo']

    def _p(self, mat, part):
        name = part or mat[0].lower() + mat[1:]
        if name in self.parts and self.parts[name]['material'] != mat:
            name = f'{name}_{mat[0].lower()}{mat[1:]}'
        return self.part(name, mat)

    def box(self, mat, centre, size, rot=(0, 0, 0), bevel=0.0, part=None):
        self._p(mat, part).add(box_geo(size, bevel), T(centre, rot))

    def lathe(self, mat, profile, sides, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), part=None, **kw):
        self._p(mat, part).add(lathe_geo(profile, sides, **kw), T(loc, rot, scale))

    def tube(self, mat, path, radius, sides=6, part=None, **kw):
        self._p(mat, part).add(tube_geo(path, radius, sides, **kw))

    def ellipsoid(self, mat, centre, radii, seg=10, rings=7, rot=(0, 0, 0), part=None):
        rx, ry, rz = radii
        self.lathe(mat, ellipsoid_profile(rz, rings), seg, centre, rot, (rx, ry, 1), part=part)

    def prism(self, mat, outline, depth, M, part=None, **kw):
        self._p(mat, part).add(prism_geo(outline, depth, **kw), M)

    def text(self, mat, body, size, M, part=None, **kw):
        self._p(mat, part).add(text_geo(body, size, **kw), M)


def circle(r, n, phase=0.0, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(phase + i * math.tau / n), cy + r * math.sin(phase + i * math.tau / n)) for i in range(n)]


def ring_band(P, mat, r0, r1, n, M, part=None, phase=0.0):
    """Flat annulus in local XY facing +Z (quads), placed by M."""
    a, b = circle(r0, n, phase), circle(r1, n, phase)
    v = [(x, y, 0) for x, y in a] + [(x, y, 0) for x, y in b]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    P._p(mat, part).add((v, faces, False), M)


def poly_band(P, mat, outer, inner, M, part=None):
    n = len(outer)
    v = [(x, y, 0) for x, y in outer] + [(x, y, 0) for x, y in inner]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    if _area2(outer) < 0:
        faces = [f[::-1] for f in faces]
    P._p(mat, part).add((v, faces, False), M)


def flat(P, mat, outline, M, part=None):
    if _area2(outline) < 0:
        outline = outline[::-1]
    v = [(x, y, 0) for x, y in outline]
    P._p(mat, part).add((v, [tuple(range(len(v)))], False), M)


def arc(cx, cz, r, a0, a1, n, y=0.0):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), y,
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def octagon(across):
    r = across / 2 / math.cos(math.pi / 8)
    return circle(r, 8, math.pi / 8)


# ------------------------------------------------------------------------------ props

def lamp_cobra():
    P = Prop('lamp_cobra', 'street', 'Montréal residential cobra-head street light: galvanised tapered '
             'pole, davit arm over the roadway (+X), flat-lens 3000 K LED head, mounting height about 8.1 m.',
             'pole base centre; arm and head reach +X (toward the road)')
    pole = [(13, 0), (13, 32), (10.5, 36), (9, 60), (6.2, 790), (5.5, 800), (0, 803)]
    P.lathe('PoleGalv', pole, 10, part='pole')
    P.lathe('PoleGalv', [(16, 0), (16, 3), (13.5, 5)], 10, cap0=False, cap1=True, part='pole')
    P.tube('PoleGalv', [(0, 0, 770), (35, 0, 792), (90, 0, 806), (175, 0, 808)], 4.2, 8, part='pole')
    P.tube('PoleGalv', [(0, 0, 725), (30, 0, 760), (62, 0, 798)], 2.4, 6, part='pole')
    head = [(0, 0), (6, 2), (11, 12), (13, 30), (12.5, 48), (9.5, 62), (5, 70), (0, 72)]
    P.lathe('LampHousing', head, 10, (168, 0, 808), (0, 90, 0), (.62, 1.0, 1), part='head')
    P.box('LampHousing', (172, 0, 808), (14, 10, 10), bevel=2, part='head')
    ellipse = [(31 * math.cos(i * math.tau / 16) + 205, 10.5 * math.sin(i * math.tau / 16)) for i in range(16)]
    P.prism('LampLens3000K', ellipse, 2.0, T((0, 0, 799.8)), part='lens', back=True, front=False)
    P.anchors['light_cm'] = [205, 0, 795]
    P.extra['light'] = {'colour_temperature_k': 3000, 'colour_srgb': '#FFB46B', 'cone_deg': 120}
    P.colliders.append({'center': [0, 0, 400], 'size': [26, 26, 800]})
    return P


def lamp_park():
    P = Prop('lamp_park', 'park', 'Parc La Fontaine path lamp: black cast base, fluted shaft, '
             'collar and a white globe, about 4.1 m.', 'post base centre')
    base = [(17, 0), (17, 6), (14.5, 9), (14.5, 28), (12, 33), (11, 52), (8.5, 62), (9.5, 66), (7.2, 70)]
    P.lathe('IronBlack', base, 12, part='post')
    P.lathe('IronBlack', [(7.2, 70), (6.2, 330)], 16, rfunc=lambda i: 1.0 if i % 2 == 0 else .86,
            cap0=False, cap1=False, smooth=False, part='post')
    cap = [(7.2, 330), (9, 334), (9, 340), (6.5, 344), (6, 352), (10.5, 360), (11.5, 366), (6, 368)]
    P.lathe('IronBlack', cap, 12, part='post')
    P.lathe('GlobeWhite', ellipsoid_profile(23, 8), 12, (0, 0, 389), scale=(22, 22, 1), part='globe')
    P.lathe('IronBlack', [(3.5, 410), (2.5, 416), (0, 422)], 8, part='post')
    P.anchors['light_cm'] = [0, 0, 389]
    P.extra['light'] = {'colour_temperature_k': 3000, 'colour_srgb': '#FFB46B', 'omni': True}
    P.colliders.append({'center': [0, 0, 205], 'size': [30, 30, 410]})
    return P


def hydrant():
    P = Prop('hydrant', 'street', 'Montréal fire hydrant (borne-fontaine): red octagonal barrel and '
             'bonnet, pentagon operating nut, two hose outlets and a front pumper outlet, with the red '
             'perforated marker post (separate part).', 'barrel base centre; pumper outlet faces +X')
    body = [(13.5, 0), (13.5, 4), (10.5, 6), (10.5, 34), (12.5, 38), (13, 54), (16.5, 56), (16.5, 61),
            (13, 63), (11.5, 69), (6, 72), (0, 72.5)]
    P.lathe('HydrantRed', body, 8, phase=math.pi / 8, part='body')
    P.lathe('HydrantIron', [(15, 0), (15, 2.5), (13.6, 3.5)], 8, phase=math.pi / 8, cap0=False, part='flange')
    P.lathe('HydrantRed', [(3.4, 72), (3.4, 78), (0, 78.5)], 5, part='body', cap0=False)
    for side in (-1, 1):
        P.lathe('HydrantRed', [(4.5, 0), (4.5, 8), (5.6, 8), (5.6, 12), (0, 12.5)], 8, (0, side * 10, 48),
                (-90 * side, 0, 0), part='body')
        P.lathe('HydrantRed', [(2.2, 12), (2.2, 14.5), (0, 15)], 5, (0, side * 10, 48), (-90 * side, 0, 0),
                part='body', cap0=False)
    P.lathe('HydrantRed', [(6.5, 0), (6.5, 7), (8, 7), (8, 12), (0, 12.6)], 10, (9, 0, 45), AXIS_X, part='body')
    P.lathe('HydrantRed', [(2.6, 12), (2.6, 15), (0, 15.5)], 5, (9, 0, 45), AXIS_X, part='body', cap0=False)
    P.box('HydrantRed', (-16, -24, 75), (5, 5, 150), part='marker')
    P.box('LabelWhite', (-13.4, -24, 120), (.3, 3.8, 14), part='marker_number')
    P.colliders.append({'center': [0, 0, 39], 'size': [36, 36, 78]})
    P.colliders.append({'center': [-16, 24, 75], 'size': [5, 5, 150]})
    P.extra['clear_radius_cm'] = 150
    P.extra['optional_parts'] = ['marker', 'marker_number']
    return P


def _post(P, height, mat='PoleGalv', part='post', size=6.0):
    P.box(mat, (0, 0, height / 2), (size, size, height), part=part)
    P.box(mat, (0, 0, height + .4), (size + .6, size + .6, .8), part=part)


def sign_stop():
    P = Prop('sign_stop', 'street', 'Québec ARRÊT stop sign: 75 cm red octagon with white border and '
             'white ARRÊT lettering on a galvanised square post; the face looks along +X.',
             'post base centre; sign face normal +X (toward approaching traffic)')
    _post(P, 250)
    z = 210
    oc = octagon(75)
    P.prism('SignBack', oc, .4, T((3.3, 0, z)) @ FACE_PX, part='back', front=False)
    inner = octagon(68)
    poly_band(P, 'SignWhite', oc, inner, T((3.55, 0, z)) @ FACE_PX, part='face_white')
    flat(P, 'SignRed', inner, T((3.55, 0, z)) @ FACE_PX, part='face_red')
    P.text('SignWhite', 'ARRÊT', 20, T((3.75, 0, z - .5)) @ FACE_PX, part='face_white',
           fit_width=52, bold=.55)
    for dz in (-22, 22):
        P.box('SignBack', (3.0, 0, z + dz), (1.2, 5, 3), part='back')
    P.colliders.append({'center': [0, 0, 125], 'size': [8, 8, 250]})
    P.extra['face_size_cm'] = 75
    return P


def rosette_outline(r, n=28):
    """Generic four-lobed red rosette placeholder (not the City logo artwork)."""
    pts = []
    for i in range(n):
        t = i * math.tau / n
        rr = r * (.42 + .58 * abs(math.cos(2 * t)) ** .7)
        pts.append((rr * math.cos(t + math.pi / 4), rr * math.sin(t + math.pi / 4)))
    return pts


def _blade(P, name, centre, along, length=100.0, height=24.0, thick=.5, text=None):
    """Two-faced white street-name blade. along='Y' faces ±X; along='X' faces ±Y."""
    x, y, z = centre
    if along == 'Y':
        P.box('SignWhite', centre, (thick, length, height), bevel=.2, part=name)
        faces = [(FACE_PX, (x + thick / 2 + .08, y, z), (0, 1, 0), (1, 0, 0)),
                 (FACE_NX, (x - thick / 2 - .08, y, z), (0, -1, 0), (-1, 0, 0))]
    else:
        P.box('SignWhite', centre, (length, thick, height), bevel=.2, part=name)
        faces = [(FACE_PY, (x, y + thick / 2 + .08, z), (-1, 0, 0), (0, 1, 0)),
                 (FACE_NY, (x, y - thick / 2 - .08, z), (1, 0, 0), (0, -1, 0))]
    slots = []
    L, H = length / 2, height / 2
    outer = [(-L + 1, -H + 1), (L - 1, -H + 1), (L - 1, H - 1), (-L + 1, H - 1)]
    inner = [(-L + 2.2, -H + 2.2), (L - 2.2, -H + 2.2), (L - 2.2, H - 2.2), (-L + 2.2, H - 2.2)]
    for basis, origin, right, normal in faces:
        M = T(origin) @ basis
        poly_band(P, 'SignBlack', outer, inner, M, part=name + '_border')
        flat(P, 'SignRosette', rosette_outline(7.5), M @ T((L - 10.5, 0, 0)), part=name + '_rosette')
        o, r, nrm = Vector(origin), Vector(right), Vector(normal)
        generic = o + r * (-L + 4 + 9) + Vector((0, 0, 5.8))
        specific = o + r * (-L + 4 + (length - 22) / 2) + Vector((0, 0, -2.4))
        slots.append({'face_normal': _ue(nrm), 'right': _ue(r), 'up': [0, 0, 1],
                      'generic': {'center_cm': _ue(generic), 'size_cm': [18, 5.5], 'example': 'Rue'},
                      'specific': {'center_cm': _ue(specific), 'size_cm': [length - 22, 11],
                                   'example': 'de Mentana'}})
        if text:
            P.text('SignBlack', text[0], 5, M @ T((-L + 4 + 9, 5.8, .05)), part='demo_text', fit_height=4.2)
            P.text('SignBlack', text[1], 10, M @ T((-L + 4 + (length - 22) / 2, -2.4, .05)),
                   part='demo_text', fit_height=9, fit_width=length - 24)
    return slots


def _ue(v):
    """Blender-local vector/point -> Unreal-local list (X forward, Y right, Z up)."""
    return [round(v[0], 2), round(-v[1], 2) + 0.0, round(v[2], 2)]


def sign_street(demo=False):
    P = Prop('sign_street', 'street', 'Montréal street-name sign: white two-faced blades with a thin '
             'black border and a red rosette placeholder at the right end of each face, on a galvanised '
             'post. Blade A (along Y, read from ±X) sits above blade B (along X, read from ±Y). The '
             'text area is left blank; the apply step adds black text per corner (see text_slots).',
             'post base centre; blade A faces ±X, blade B faces ±Y')
    _post(P, 244, size=6.5)
    P.box('PoleGalv', (0, 0, 246), (10, 10, 2.4), part='post')
    P.box('PoleGalv', (0, 0, 273.5), (4, 4, 5), part='post')
    slots_b = _blade(P, 'blade_b', (0, 0, 259.2), 'X', text=('Avenue', 'Duluth Est') if demo else None)
    slots_a = _blade(P, 'blade_a', (0, 0, 288), 'Y', text=('Rue', 'de Mentana') if demo else None)
    P.extra['text_slots'] = {'blade_a': slots_a, 'blade_b': slots_b}
    P.extra['text_style'] = {'colour_srgb': '#111111', 'font': 'sans-serif bold (Clearview-like)',
                             'generic_cap_height_cm': 4.2, 'specific_cap_height_cm': 9.0,
                             'rule': 'small generic (Rue, Avenue) above a large specific name; '
                                     'keep Est/Ouest; shrink the specific to fit its width'}
    P.colliders.append({'center': [0, 0, 122], 'size': [8, 8, 244]})
    return P


def sign_oneway():
    P = Prop('sign_oneway', 'street', 'Québec one-way sign: black two-faced plate with a white arrow '
             'and a thin white border, on a galvanised post. The arrow points along Unreal local +Y.',
             'post base centre; plate faces ±X; arrow toward Unreal +Y (yaw = traffic heading - 90°)')
    _post(P, 240)
    z = 225
    P.box('SignBack', (3.6, 0, z), (.5, 90, 30), part='plate')
    arrow = [(-36, -3.2), (18, -3.2), (18, -9), (36, 0), (18, 9), (18, 3.2), (-36, 3.2)]
    rect_o = [(-44, -14), (44, -14), (44, 14), (-44, 14)]
    rect_i = [(-42.5, -12.5), (42.5, -12.5), (42.5, 12.5), (-42.5, 12.5)]
    for basis, x, flipx in ((FACE_PX, 3.93, -1), (FACE_NX, 3.27, 1)):
        M = T((x, 0, z)) @ basis
        flat(P, 'SignBlack', rect_i, M, part='face_black')
        poly_band(P, 'SignWhite', rect_o, rect_i, M, part='face_white')
        pts = [(flipx * ax, ay) for ax, ay in arrow]
        P.prism('SignWhite', pts, .1, M @ T((0, 0, .1)), part='face_white', back=False, sides=False)
    for dz in (-10, 10):
        P.box('SignBack', (3.0, 0, z + dz), (1.2, 5, 3), part='plate')
    P.colliders.append({'center': [0, 0, 120], 'size': [8, 8, 240]})
    P.anchors['arrow_direction_unreal'] = [0, 1, 0]
    return P


def sign_parking():
    P = Prop('sign_parking', 'street', 'Montréal parking sign (R-PF): white plate, red circle and slash '
             'over a black P, "9h-23h / EXCEPTÉ S3R" and a direction arrow, on a galvanised post.',
             'post base centre; plate faces +X')
    _post(P, 235)
    z = 200
    P.box('SignBack', (3.6, 0, z), (.4, 30, 45), part='plate')
    M = T((3.84, 0, z)) @ FACE_PX
    flat(P, 'SignWhite', [(-15, -22.5), (15, -22.5), (15, 22.5), (-15, 22.5)], M, part='face_white')
    Mf = M @ T((0, 0, .08))
    P.text('SignBlack', 'P', 14, Mf @ T((0, 11, .02)), part='face_black', fit_height=11, bold=.3)
    ring_band(P, 'SignRed', 6.3, 7.6, 20, Mf @ T((0, 11, .05)), part='face_red')
    P.prism('SignRed', [(-6.9, -.75), (6.9, -.75), (6.9, .75), (-6.9, .75)], .02,
            Mf @ T((0, 11, .07), (0, 0, 45)), part='face_red', back=False, sides=False)
    P.text('SignBlack', '9h-23h', 5, Mf @ T((0, -.5, 0)), part='face_black', fit_width=21)
    P.text('SignBlack', 'EXCEPTÉ S3R', 4, Mf @ T((0, -7.5, 0)), part='face_black', fit_width=24)
    arrow = [(-10, -1), (6, -1), (6, -3.4), (11, 0), (6, 3.4), (6, 1), (-10, 1)]
    flat(P, 'SignBlack', [(-a, b) for a, b in arrow], Mf @ T((0, -16, 0)), part='face_black')
    for dz in (-15, 15):
        P.box('SignBack', (3.0, 0, z + dz), (1.2, 5, 3), part='plate')
    P.colliders.append({'center': [0, 0, 118], 'size': [8, 8, 235]})
    P.extra['text'] = '\\P 9h-23h EXCEPTE S3R (dataset code R-PF, the commonest Plateau parking sign)'
    return P


def _wheel(P, mat_tyre, mat_hub, centre, radius, width, part_tyre, part_hub, spokes=8, segs=16, sides=5,
           spoke_mat=None):
    cx, cy, cz = centre
    ring = [(cx + (radius - width / 2) * math.cos(i * math.tau / segs), cy,
             cz + (radius - width / 2) * math.sin(i * math.tau / segs)) for i in range(segs)]
    P.tube(mat_tyre, ring, width / 2, sides, part=part_tyre, closed=True)
    P.lathe(mat_hub, [(2.5, -3), (2.5, 3)], 6, centre, AXIS_Y, part=part_hub)
    rim = radius - width
    if spokes:
        for i in range(spokes):
            a = i * math.tau / spokes
            for side in (-1, 1):
                P.tube(spoke_mat or mat_hub, [(cx, cy + side * 2.5, cz),
                                              (cx + rim * math.cos(a + side * .12), cy + side * .4,
                                               cz + rim * math.sin(a + side * .12))], .35, 3, part=part_hub,
                       caps=False)
        rim_ring = [(cx + rim * math.cos(i * math.tau / segs), cy, cz + rim * math.sin(i * math.tau / segs))
                    for i in range(segs)]
        P.tube(spoke_mat or mat_hub, rim_ring, .9, 4, part=part_hub, closed=True)


def _fender(P, mat, cx, cz, r, a0, a1, width, part, segs=8):
    pts = arc(cx, cz, r, a0, a1, segs)
    v, faces = [], []
    for x, _, z in pts:
        for y in (-width / 2, width / 2):
            for rr in (0, 1.2):
                d = Vector((x - cx, 0, z - cz)).normalized()
                v.append((x + d.x * rr, y, z + d.z * rr))
    for i in range(segs):
        a, b = 4 * i, 4 * (i + 1)
        # inner, outer, left, right faces of the curved channel
        faces += [(a + 0, b + 0, b + 2, a + 2), (a + 1, a + 3, b + 3, b + 1),
                  (a + 0, a + 1, b + 1, b + 0), (a + 2, b + 2, b + 3, a + 3)]
    geo = (v, faces, False)
    part_geo = P.part(part, mat)
    o = len(part_geo.v)
    part_geo.add(geo)
    # fix winding of the curved channel by facing every quad away from the wheel axle
    for idx in range(len(part_geo.f) - len(faces), len(part_geo.f)):
        f = part_geo.f[idx]
        pts3 = [Vector(part_geo.v[i]) for i in f]
        mid = sum(pts3, Vector()) / len(pts3)
        n = _newell(pts3)
        radial = Vector((mid.x - cx, 0, mid.z - cz))
        side = Vector((0, mid.y, 0))
        ref = radial if abs(n.normalized().y) < .7 else side
        inner = idx - (len(part_geo.f) - len(faces))
        if inner % 4 == 0:
            ref = -radial
        if n.dot(ref) < 0:
            part_geo.f[idx] = f[::-1]
    return o


def bixi_bike():
    P = Prop('bixi_bike', 'street', 'BIXI city bike: silver-grey step-through aluminium frame, front '
             'rack with a red BIXI panel, full fenders, chain guard and black tyres.',
             'midpoint between the tyre contact points; front wheel toward +X')
    R = 33
    for x in (-56, 56):
        _wheel(P, 'Rubber', 'BixiFrame', (x, 0, R), R, 4.6, 'tyres', 'frame', spokes=8, segs=16, sides=5)
    head, bb, seat = Vector((40, 0, 88)), Vector((-2, 0, 30)), Vector((-28, 0, 86))
    P.tube('BixiFrame', [tuple(head), (30, 0, 66), (14, 0, 40), tuple(bb)], [4.2, 4.2, 4.0, 3.8], 8, part='frame')
    P.tube('BixiFrame', [tuple(bb), (-14, 0, 58), tuple(seat)], 2.6, 6, part='frame')
    for side in (-1, 1):
        P.tube('BixiFrame', [tuple(bb), (-56, side * 6, R)], 1.5, 5, part='frame')
        P.tube('BixiFrame', [(-56, side * 6, R), (-22, side * 3, 72)], 1.3, 5, part='frame')
        P.tube('BixiFrame', [(42, side * 5, 82), (56, side * 5, R)], 1.8, 6, part='frame')
    P.tube('BixiFrame', [tuple(head), (40, 0, 100), (36, 0, 108)], 2.4, 6, part='frame')
    P.tube('Rubber', [(33, -27, 108), (36, -18, 109), (36, 18, 109), (33, 27, 108)], 1.6, 6, part='tyres')
    P.tube('BixiFrame', [(36, 0, 108), (36, 0, 109)], 2.6, 6, part='frame')
    P.box('Rubber', (-30, 0, 93), (24, 15, 6), bevel=2.5, part='tyres')
    P.tube('BixiFrame', [(-28, 0, 86), (-29, 0, 91)], 1.6, 6, part='frame')
    _fender(P, 'BixiFrame', 56, R, R + 2.5, 20, 160, 7, 'frame')
    _fender(P, 'BixiFrame', -56, R, R + 2.5, 30, 175, 7, 'frame')
    P.box('BixiFrame', (60, 0, 92), (32, 30, 2.5), bevel=.8, part='frame')
    for y in (-14, 14):
        P.tube('BixiFrame', [(46, y, 92), (52, y * .4, 52)], 1.1, 4, part='frame')
    P.box('BixiRed', (76.5, 0, 98), (1.5, 30, 11), bevel=.5, part='brand_red')
    P.box('BixiRed', (-56, 0, R + R + 3.8), (14, 7.6, .8), part='brand_red')
    P.box('BixiDark', (-30, 6, 38), (46, 2, 12), bevel=1, part='chain_guard')
    P.box('BixiDark', (-2, 9, 30), (5, 3, 16), part='chain_guard')
    P.colliders.append({'center': [0, 0, 55], 'size': [180, 30, 110]})
    return P


def bixi_dock():
    P = Prop('bixi_dock', 'street', 'BIXI station segment: low grey platform with six docking posts, '
             'a tall pay terminal with a dark station-name header, screen and red mark, and a black '
             'solar pole with two panels. Bikes dock nose-first against the posts (see slots).',
             'platform centre on the ground; slots in a row along Y; bikes extend toward +X')
    spacing, n = 80, 6
    length = spacing * n + 40
    P.box('BixiDock', (0, 0, 4), (70, length, 8), bevel=1.5, part='platform')
    P.box('BixiDark', (0, 0, 8.4), (60, length - 10, .8), part='platform_strip')
    slots = []
    for i in range(n):
        y = -length / 2 + 40 + spacing * (i + .5)
        P.box('BixiDock', (-20, y, 50), (22, 15, 86), (0, -6, 0), bevel=3.5, part='posts')
        P.box('BixiDark', (-11, y, 84), (8, 13, 16), (0, -6, 0), bevel=1.8, part='locks')
        P.box('BixiRed', (-6.9, y, 88), (.6, 5, 2.4), part='lights')
        slots.append({'position_cm': _ue((72, y - 14, 0)), 'yaw_deg': 180.0, 'occupied_default': i % 3 != 2})
    ty = length / 2 - 20
    P.box('BixiDock', (-10, ty, 112), (34, 62, 210), bevel=3, part='terminal')
    P.box('BixiDark', (-10, ty, 205), (36, 64, 26), bevel=2, part='terminal_header')
    P.box('BixiScreen', (7.4, ty - 12, 138), (.6, 24, 18), part='screen')
    P.box('BixiDark', (7.2, ty - 12, 112), (.8, 24, 28), part='terminal_header')
    P.box('BixiRed', (7.6, ty + 18, 205), (.6, 14, 14), part='lights')
    P.box('BixiRed', (-10, ty + 32.4, 205), (14, .6, 14), part='lights')
    P.tube('IronBlack', [(-24, ty, 210), (-24, ty, 345)], 4, 8, part='solar_pole')
    for dy in (-30, 30):
        P.box('SolarPanel', (-24, ty + dy, 350), (52, 55, 3), (0, 22, 0), bevel=.5, part='solar_panels')
    P.tube('IronBlack', [(-24, ty - 52, 345), (-24, ty + 52, 345)], 2, 6, part='solar_pole')
    P.extra['slots'] = slots
    P.extra['slot_mesh'] = 'bixi_bike'
    P.colliders.append({'center': [0, 0, 45], 'size': [70, length, 90]})
    P.colliders.append({'center': [-10, -ty, 112], 'size': [36, 64, 224]})
    return P


def _loft_rounded_rect(P, mat, rings, part, cx=0.0):
    """rings: (z, half_x, half_y, bevel); octagonal (chamfered rectangle) loft, capped."""
    v, faces = [], []
    for z, hx, hy, b in rings:
        pts = [(hx - b, -hy), (hx, -hy + b), (hx, hy - b), (hx - b, hy), (-hx + b, hy), (-hx, hy - b),
               (-hx, -hy + b), (-hx + b, -hy)]
        for x, y in pts:
            v.append((cx + x, y, z))
    for r in range(len(rings) - 1):
        for i in range(8):
            j = (i + 1) % 8
            faces.append((8 * r + i, 8 * r + j, 8 * (r + 1) + j, 8 * (r + 1) + i))
    faces.append(tuple(range(8))[::-1])
    k = 8 * (len(rings) - 1)
    faces.append(tuple(range(k, k + 8)))
    P.part(part, mat).add((v, faces, False))


def _recycle_arrows(P, M, part):
    for i in range(3):
        a = math.radians(90 + i * 120)
        pts = []
        for t in range(5):
            ang = a + math.radians(-40 + t * 18)
            pts.append((6 * math.cos(ang), 6 * math.sin(ang)))
        for p, q in zip(pts, pts[1:]):
            d = (q[0] - p[0], q[1] - p[1])
            ln = math.hypot(*d)
            nx, ny = -d[1] / ln * .9, d[0] / ln * .9
            flat(P, 'LabelWhite', [(p[0] - nx, p[1] - ny), (q[0] - nx, q[1] - ny), (q[0] + nx, q[1] + ny),
                                   (p[0] + nx, p[1] + ny)], M, part=part)
        tip = pts[-1]
        ang = a + math.radians(-40 + 4 * 18)
        tx, ty = -math.sin(ang), math.cos(ang)
        nx, ny = math.cos(ang), math.sin(ang)
        flat(P, 'LabelWhite', [(tip[0] + nx * 2.4, tip[1] + ny * 2.4), (tip[0] + tx * 3.2, tip[1] + ty * 3.2),
                               (tip[0] - nx * 2.4, tip[1] - ny * 2.4)], M, part=part)


def bin_recycling():
    P = Prop('bin_recycling', 'street', 'Montréal blue recycling wheelie bin (bac roulant bleu, 240 L): '
             'tapered body, hinged lid with front lip, rear wheels and handle, white recycling arrows.',
             'base centre; front with the arrows faces +X; wheels and handle at -X')
    _loft_rounded_rect(P, 'BinBlue', [(3, 26, 24, 3), (20, 27.5, 25.5, 3), (96, 34, 29, 4), (99, 35, 30, 4)],
                       'body')
    P.box('BinBlue', (1, 0, 102), (74, 64, 5), bevel=1.5, part='body')
    P.box('BinBlue', (36, 0, 99), (3, 50, 6), bevel=1, part='body')
    P.tube('PlasticBlack', [(-38, -22, 98), (-41, -22, 101), (-41, 22, 101), (-38, 22, 98)], 1.8, 6, part='handle')
    for y in (-27, 27):
        P.lathe('Rubber', [(10, -3.5), (10, 3.5)], 12, (-30, y, 10), AXIS_Y, part='wheels')
    P.tube('SteelDark', [(-30, -31, 10), (-30, 31, 10)], 1.2, 6, part='axle')
    _recycle_arrows(P, T((31.4, 0, 66), (0, -4.6, 0)) @ FACE_PX, 'label')
    P.colliders.append({'center': [0, 0, 52], 'size': [74, 64, 104]})
    return P


def bin_compost():
    P = Prop('bin_compost', 'street', 'Montréal brown organics bin (bac brun, 45 L): tapered body, lid with '
             'the locking carry handle across it and a front latch.', 'base centre; latch faces +X')
    _loft_rounded_rect(P, 'BinBrown', [(0, 17, 17, 3), (44, 21, 21, 3.5), (46, 21.5, 21.5, 3.5)], 'body')
    P.box('BinBrown', (.5, 0, 48), (45, 45, 4), bevel=1.2, part='body')
    P.box('BinBrown', (22.4, 0, 43), (3, 12, 9), bevel=1, part='body')
    P.tube('BinBrown', [(0, -23, 36), (2, -24, 51), (4, -18, 52.5), (4, 18, 52.5), (2, 24, 51), (0, 23, 36)],
           1.4, 6, part='body')
    for y in (-23, 23):
        P.lathe('BinBrown', [(3, -1.2), (3, 1.2)], 8, (0, y, 36), AXIS_Y, part='body')
    P.box('LabelWhite', (20.2, 0, 26), (.3, 14, 9), (0, -5, 0), part='label')
    P.colliders.append({'center': [0, 0, 26], 'size': [46, 46, 52]})
    return P


def bin_garbage():
    P = Prop('bin_garbage', 'street', 'Curbside pile of three tied black garbage bags.', 'pile base centre')
    rng = random.Random(4411)
    for cx, cy, h, r, tilt in ((-8, -16, 62, 23, 8), (10, 14, 54, 21, -10), (24, -14, 40, 19, 25)):
        bumps = [1 + rng.uniform(-.09, .09) for _ in range(10)]
        prof = [(0, 0), (r * .75, 1.5), (r * .98, h * .18), (r, h * .45), (r * .9, h * .7), (r * .55, h * .86),
                (r * .18, h * .93), (r * .12, h * .97)]
        geo = lathe_geo(prof, 10, rfunc=lambda i: bumps[i], cap1=True)
        P.part('bags', 'BagBlack').add(geo, T((cx, cy, 0), (tilt * .3, tilt, rng.uniform(0, 360)), (1, .88, 1)))
        top = T((cx, cy, 0), (tilt * .3, tilt, 0)) @ Vector((0, 0, h * .97))
        for dy in (-1, 1):
            P.part('bags', 'BagBlack').add(lathe_geo([(2.2, 0), (1.2, 7), (0, 9)], 5),
                                           T(tuple(top), (dy * 35 + tilt, 0, 0)))
    P.colliders.append({'center': [8, 0, 30], 'size': [80, 80, 60]})
    return P


def cone():
    P = Prop('cone', 'works', 'Montréal orange traffic cone, 71 cm, with two white reflective bands and '
             'a black square base.', 'base centre')
    P.box('PlasticBlack', (0, 0, 1.6), (38, 38, 3.2), bevel=3, part='base')
    radius = lambda z: 14.5 - (z - 3) * (11.5 / 68)
    bands = [(3, 30, 'ConeOrange'), (30, 41, 'ReflectWhite'), (41, 47, 'ConeOrange'), (47, 55, 'ReflectWhite'),
             (55, 71, 'ConeOrange')]
    for z0, z1, mat in bands:
        P.lathe(mat, [(radius(z0), z0), (radius(z1), z1)], 16, cap0=False, cap1=z1 == 71,
                part='body' if mat == 'ConeOrange' else 'bands')
    P.lathe('ConeOrange', [(15.5, 3), (15.5, 4.5), (14.4, 5)], 16, cap0=False, cap1=False, part='body')
    P.colliders.append({'center': [0, 0, 36], 'size': [38, 38, 72]})
    P.extra['knockable'] = True
    return P


def barrier_chantier():
    P = Prop('barrier_chantier', 'works', 'Chantier barrier panel: 2 m orange frame on black rubber feet '
             'with orange-and-white diagonal striped boards and an amber flasher.',
             'base centre; boards span Y; faces ±X')
    for y in (-95, 95):
        P.box('PlasticBlack', (0, y, 5), (70, 14, 10), bevel=2, part='feet')
        P.box('BarrierOrange', (0, y, 58), (6, 6, 100), bevel=1, part='frame')
    for zc, h in ((92, 22), (55, 16)):
        P.box('BarrierOrange', (0, 0, zc), (2.6, 192, h + 3), part='frame')
        n = 12
        w = 192 / n
        for i in range(n):
            mat = 'BarrierOrange' if i % 2 == 0 else 'ReflectWhite'
            y0 = -96 + i * w
            sh = h * .55
            outline = [(y0 - sh / 2, -h / 2), (y0 + w - sh / 2, -h / 2), (y0 + w + sh / 2, h / 2),
                       (y0 + sh / 2, h / 2)]
            outline = [(max(-96, min(96, a)), b) for a, b in outline]
            for x, basis in ((1.4, FACE_PX), (-1.4, FACE_NX)):
                M = T((x, 0, zc)) @ basis
                pts = outline if x > 0 else [(-a, b) for a, b in outline]
                flat(P, mat, pts, M,
                     part='stripes_orange' if mat == 'BarrierOrange' else 'stripes_white')
    P.box('PlasticBlack', (0, 95, 112), (6, 8, 6), part='feet')
    P.lathe('AmberLamp', [(6, 0), (6, 3), (5, 5), (0, 5.5)], 10, (0, 95, 115), part='flasher')
    P.colliders.append({'center': [0, 0, 55], 'size': [70, 204, 110]})
    P.extra['knockable'] = True
    return P


def utility_pole():
    P = Prop('utility_pole', 'ruelle', 'Wooden ruelle utility pole, 10.5 m, with a crossarm, braces, four '
             'green glass pin insulators, a secondary rack with spool insulators and an ID tag.',
             'pole base centre; crossarm along Y')
    P.lathe('WoodPole', [(15.5, 0), (14, 300), (11, 1040), (10, 1050), (0, 1053)], 10, part='pole')
    P.box('WoodPole', (0, 0, 980), (10, 240, 11), part='pole')
    for side in (-1, 1):
        P.tube('SteelDark', [(4, side * 6, 920), (4, side * 70, 975)], .8, 4, part='hardware')
        P.tube('SteelDark', [(-4, side * 6, 920), (-4, side * 70, 975)], .8, 4, part='hardware')
    wires = []
    for y in (-108, -45, 45, 108):
        P.lathe('SteelDark', [(1, 0), (1, 6)], 5, (0, y, 985.5), part='hardware')
        P.lathe('Insulator', [(3.4, 0), (5.6, 3), (5.6, 6), (3.6, 9), (2.2, 12), (0, 12.5)], 8, (0, y, 991),
                part='insulators')
        wires.append(_ue((0, y, 1002)))
    P.box('SteelDark', (12.5, 0, 850), (3, 6, 70), part='hardware')
    for z in (825, 850, 875):
        P.lathe('InsulatorWhite', [(3.5, -3), (4.5, -2), (3, 0), (4.5, 2), (3.5, 3)], 8, (17, 0, z), AXIS_Y,
                part='spools')
        wires.append(_ue((20, 0, z)))
    P.box('LabelWhite', (14.3, 0, 190), (.4, 9, 12), part='tag')
    P.anchors['wire_attach_cm'] = wires
    P.extra['wire_note'] = 'sag wires 2-4 % of the span between neighbouring poles; galleries at 6-8 m'
    P.colliders.append({'center': [0, 0, 520], 'size': [30, 30, 1040]})
    return P


def _garment(P, mat, kind, x, top, phase, part):
    if kind == 'shirt':
        o = [(-10, 0), (10, 0), (15, -5), (29, -16), (22, -26), (14, -21), (14, -50), (-14, -50), (-14, -21),
             (-22, -26), (-29, -16), (-15, -5)]
    elif kind == 'pants':
        o = [(-17, 0), (17, 0), (18, -78), (6, -78), (0, -26), (-6, -78), (-18, -78)]
    elif kind == 'towel':
        o = [(-24, 0), (24, 0), (24, -62), (-24, -62)]
    elif kind == 'sheet':
        o = [(-48, 0), (48, 0), (48, -96), (-48, -96)]
    else:
        o = [(-5, 0), (5, 0), (5, -18), (12, -24), (9, -28), (-5, -22)]
    P.prism(mat, o, .4, T((x, 0, top), (90 + math.sin(phase) * 4, 0, 0)), part=part)


def laundry_line():
    P = Prop('laundry_line', 'ruelle', 'Montréal pulley clothesline (corde à linge): two pulleys, a looped '
             'line 6 m long with gentle sag and garments pinned on the lower line (flat cards).',
             'bounding-box base centre; the line runs along X; anchors give the pulley axles')
    span, z0 = 600, 150
    for x in (-span / 2, span / 2):
        P.lathe('Chrome', [(6, -1.5), (6, 1.5)], 12, (x, 0, z0), AXIS_Y, part='pulleys')
        P.box('SteelDark', (x + (6 if x > 0 else -6), 0, z0), (14, 3, 3), part='pulleys')
    upper = [(-span / 2 + span * i / 12, 0, z0 + 6 - 8 * math.sin(math.pi * i / 12)) for i in range(13)]
    lower = [(-span / 2 + span * i / 12, 0, z0 - 6 - 22 * math.sin(math.pi * i / 12)) for i in range(13)]
    P.tube('LaundryRope', upper, .35, 4, part='rope')
    P.tube('LaundryRope', lower, .35, 4, part='rope')
    hang = [('sheet', -190, 'ClothWhite', 'cloth_a'), ('shirt', -95, 'ClothBlue', 'cloth_b'),
            ('pants', -35, 'ClothBlue', 'cloth_b'), ('towel', 30, 'ClothOchre', 'cloth_c'),
            ('shirt', 95, 'ClothRed', 'cloth_d'), ('sock', 140, 'ClothWhite', 'cloth_a'),
            ('sock', 158, 'ClothRed', 'cloth_d'), ('towel', 215, 'ClothWhite', 'cloth_a')]
    for i, (kind, x, mat, part) in enumerate(hang):
        top = z0 - 6 - 22 * math.sin(math.pi * (x + span / 2) / span)
        _garment(P, mat, kind, x, top, i * 1.7, part)
        for dx in (-6, 6):
            P.box('LaundryRope', (x + dx, 0, top + .5), (1.4, 1.8, 4), part='rope')
    P.anchors['line_start_cm'] = _ue((-span / 2, 0, z0))
    P.anchors['line_end_cm'] = _ue((span / 2, 0, z0))
    P.extra['span_cm'] = span
    P.extra['scale_note'] = 'scale X by span/600 between 0.7 and 1.4; place anchors on a gallery post and a pole'
    return P


def _bicycle(P, frame_mat, part_frame='frame', lean=0.0):
    R = 33
    M = T((0, 0, 0), (lean, 0, 0))
    tmp = Prop('tmp', '', '', '')
    for x in (-54, 54):
        _wheel(tmp, 'Rubber', 'Chrome', (x, 0, R), R, 3.6, 'tyres', 'spokes', spokes=8, segs=16, sides=5)
    head, bb, seat, rear = (36, 0, 92), (-2, 0, 30), (-22, 0, 88), (-54, 0, R)
    tmp.tube(frame_mat, [head, (14, 0, 56), bb], 2.3, 6, part=part_frame)
    tmp.tube(frame_mat, [bb, seat], 2.3, 6, part=part_frame)
    tmp.tube(frame_mat, [seat, (36, 0, 88)], 2.1, 6, part=part_frame)
    for side in (-1, 1):
        tmp.tube(frame_mat, [bb, (-54, side * 5, R)], 1.3, 5, part=part_frame)
        tmp.tube(frame_mat, [(-54, side * 5, R), (-21, side * 2, 84)], 1.2, 5, part=part_frame)
        tmp.tube('Chrome', [(37, side * 4, 88), (54, side * 4, R)], 1.4, 5, part='spokes')
    tmp.tube('Chrome', [head, (37, 0, 104)], 1.8, 6, part='spokes')
    tmp.tube('Chrome', [(32, -26, 104), (38, -20, 105), (38, 20, 105), (32, 26, 104)], 1.4, 6, part='spokes')
    tmp.box('Rubber', (-24, 0, 95), (24, 13, 5.5), bevel=2.2, part='tyres')
    tmp.tube('Chrome', [(-22, 0, 88), (-23, 0, 93)], 1.3, 6, part='spokes')
    tmp.lathe('Chrome', [(7, -1), (7, 1)], 10, bb, AXIS_Y, part='spokes')
    for name, data in tmp.parts.items():
        P.part(name, data['material']).merged(data['geo'], M)


def bike_locked():
    P = Prop('bike_locked', 'street', 'City bike leaning 9° toward Unreal -Y (its left) against a post or '
             'railing, with a yellow U-lock through the frame and rear wheel.',
             'midpoint between the tyre contact points; front wheel +X; lean contact toward Unreal -Y')
    _bicycle(P, 'BikeRed', lean=-9)
    M = T((0, 0, 0), (-9, 0, 0))
    lock = [(-40, -3, 50), (-40, -3, 62), (-36, 0, 66), (-32, 3, 62), (-32, 3, 50)]
    P.part('lock', 'LockYellow').add(tube_geo(lock, 1.1, 6), M)
    P.part('lock', 'LockYellow').add(box_geo((14, 4, 4), 1), M @ T((-36, 0, 50)))
    P.anchors['lean_contact_cm'] = _ue(M @ Vector((-10, 22, 80)))
    P.colliders.append({'center': [0, 8, 55], 'size': [180, 34, 110]})
    return P


def ac_unit():
    P = Prop('ac_unit', 'facade', 'Window air conditioner: beige-white case, dark front grille with '
             'louvres, top vents, pleated side panels and two steel support brackets.',
             'bounding-box base centre; grille faces +X; the window plane is at anchors.wall_plane_x_cm')
    P.box('AcBody', (5, 0, 22), (50, 62, 36), bevel=2.5, part='case')
    P.box('AcGrille', (30.3, 0, 22), (.8, 54, 28), part='grille')
    for i in range(7):
        P.box('AcBody', (31, 0, 10.5 + i * 3.8), (1.5, 54, .8), part='case')
    for i in range(6):
        P.box('AcGrille', (-2 + i * 6, 0, 40.2), (3, 48, .6), part='grille')
    for side in (-1, 1):
        pleat = []
        for k in range(7):
            pleat.append((-22 + (k % 2) * 2.2, side * (31 + k * 2.2), 22))
        P.tube('AcBody', [(-21, side * 32, 4), (-21, side * 32, 40)], 1.2, 4, part='case')
        for k in range(6):
            y0 = side * (31.5 + k * 2.4)
            P.box('AcBody', (-20 + (k % 2) * 1.2, y0 + side * 1.2, 22), (1, 2.6, 34), (0, 0, side * (25 if k % 2 else -25)),
                  part='case')
    for y in (-22, 22):
        P.tube('SteelDark', [(-20, y, 0.8), (28, y, 0.8)], .8, 4, part='brackets')
        P.tube('SteelDark', [(-20, y, -28 + 29), (24, y, 4)], .7, 4, part='brackets')
    P.anchors['wall_plane_x_cm'] = -18
    P.extra['mount_note'] = 'sits on the sill of an upper window; x < wall_plane is inside the window'
    return P


def flower_box():
    P = Prop('flower_box', 'facade', 'Window flower box: painted wooden planter with soil, leaves and '
             'geranium-like flowers, on two iron brackets.', 'bounding-box base centre; front +X; '
             'back against the wall at anchors.wall_plane_x_cm')
    P.box('BoxWood', (0, 0, 13), (22, 90, 18), bevel=1.2, part='box')
    P.box('BoxWood', (11.6, 0, 20), (1.6, 92, 3), bevel=.4, part='box')
    P.box('Soil', (0, 0, 21.6), (18, 86, .8), part='soil')
    for y in (-30, 30):
        P.tube('IronBlack', [(-11, y, 0), (8, y, 4), (8, y, 5)], .8, 4, part='brackets')
        P.tube('IronBlack', [(-11, y, 0), (-11, y, 12)], .8, 4, part='brackets')
    rng = random.Random(77)
    for i in range(9):
        y = -38 + i * 9.5 + rng.uniform(-2, 2)
        x = rng.uniform(-5, 5)
        h = rng.uniform(9, 15)
        P.ellipsoid('Leaf', (x, y, 22 + h * .45), (7, 6, h * .5), 7, 5, (0, 0, rng.uniform(0, 90)), part='leaves')
        for k in range(2):
            fy = y + rng.uniform(-4, 4)
            fx = x + rng.uniform(-3, 4)
            P.ellipsoid('FlowerRed', (fx, fy, 22 + h + rng.uniform(-1, 2)), (3.2, 3.2, 2.4), 6, 4,
                        part='flowers')
    for k in range(5):
        y = -40 + k * 20
        P.tube('Leaf', [(10, y, 21), (13.5, y + 2, 15), (13, y + 4, 8)], .9, 4, part='leaves')
    P.anchors['wall_plane_x_cm'] = -11
    return P


def bench():
    P = Prop('bench', 'park', 'Montréal park bench: dark cast-iron ends with armrests and wooden seat '
             'and back slats, 1.8 m.', 'base centre; seat faces +X')
    for y in (-80, 80):
        P.tube('BenchIron', [(24, y, 0), (24, y, 44)], 2.2, 4, part='ends', phase=math.pi / 4)
        P.tube('BenchIron', [(-22, y, 0), (-21, y, 42), (-25, y, 62), (-30, y, 88)], 2.2, 4, part='ends',
               phase=math.pi / 4)
        P.tube('BenchIron', [(26, y, 43), (-23, y, 43)], 2, 4, part='ends', phase=math.pi / 4)
        P.tube('BenchIron', [(24, y, 44), (25, y, 61), (19, y, 66), (-20, y, 64), (-26, y, 69)], 1.8, 4,
               part='ends', phase=math.pi / 4)
        P.lathe('BenchIron', [(3.6, -1.5), (3.6, 1.5)], 8, (26, y, 62), AXIS_Y, part='ends')
        for x in (24, -22):
            P.box('BenchIron', (x, y, 1), (9, 7, 2), part='ends')
    for i, x in enumerate((20, 9, -2, -13)):
        P.box('BenchWood', (x, 0, 46.5 + i * .4), (9.5, 184, 3.6), bevel=.8, part='slats')
    for i, (x, z) in enumerate(((-23.2, 58), (-25.6, 70), (-28.2, 82))):
        P.box('BenchWood', (x, 0, z), (3.6, 184, 9), (0, -14, 0), bevel=.8, part='slats')
    P.colliders.append({'center': [0, 0, 24], 'size': [56, 176, 48]})
    P.colliders.append({'center': [-26, 0, 66], 'size': [10, 176, 44]})
    return P


def mailbox():
    P = Prop('mailbox', 'street', 'Generic red street letter box (Canada Post style, no logo): '
             'rounded top, front slot with a pull flap, white collection-times plate, black plinth.',
             'base centre; slot faces +X')
    P.box('MailBlack', (0, 0, 4), (48, 56, 8), bevel=1, part='plinth')
    P.box('MailRed', (0, 0, 55), (44, 52, 94), bevel=1.5, part='body')
    top = [(22 * math.cos(math.radians(a)), 102 + 13 * math.sin(math.radians(a))) for a in range(0, 181, 20)]
    P.prism('MailRed', top, 52, T((0, 0, 0), (90, 0, 0)), part='body')
    P.box('MailBlack', (22.3, 0, 92), (1, 34, 5), part='plinth')
    P.box('MailRed', (23.4, 0, 96.5), (2, 38, 9), (0, 18, 0), bevel=.6, part='body')
    P.tube('Chrome', [(25, -8, 93), (26.5, -8, 93), (26.5, 8, 93), (25, 8, 93)], .6, 5, part='handle')
    P.box('LabelWhite', (22.2, 0, 70), (.4, 22, 13), part='plate')
    P.box('MailBlack', (22.3, 0, 30), (.8, 30, 2), part='plinth')
    P.colliders.append({'center': [0, 0, 58], 'size': [48, 56, 116]})
    return P


def police_lightbar():
    P = Prop('police_lightbar', 'vehicle', 'Generic police light bar: black base, red lenses on the '
             'driver side (Unreal -Y, the car\'s left), blue on the right, clear centre module, roof feet.',
             'base centre on the roof; long axis Y; front +X')
    P.box('PlasticBlack', (0, 0, 6), (26, 124, 4), bevel=1.2, part='base')
    for y in (-50, 50):
        P.box('PlasticBlack', (0, y, 2), (16, 6, 4), part='base')
    mods = [(45, 'LightbarRed'), (22.5, 'LightbarRed'), (0, 'LightbarClear'), (-22.5, 'LightbarBlue'),
            (-45, 'LightbarBlue')]
    for y, mat in mods:
        P.box(mat, (0, y, 11.5), (24, 21.5 if y else 21.5, 7), bevel=2.6,
              part={'LightbarRed': 'lens_red', 'LightbarBlue': 'lens_blue', 'LightbarClear': 'lens_clear'}[mat])
    P.box('Chrome', (0, 61.5, 9), (22, 1.2, 8), bevel=.4, part='end_caps')
    P.box('Chrome', (0, -61.5, 9), (22, 1.2, 8), bevel=.4, part='end_caps')
    P.anchors['light_red_cm'] = [_ue((0, y, 12)) for y in (45, 22.5)]
    P.anchors['light_blue_cm'] = [_ue((0, y, 12)) for y in (-22.5, -45)]
    return P


# ----------------------------------------------------------------------- companions

DOGS = {
    'dog_small': dict(L=42, H=30, rc=9.5, rw=8, hs=8.5, snout=6.5, ears='perky', tail='curl',
                      coat='DogCoatTan', leg=2.6, desc='small terrier'),
    'dog_medium': dict(L=60, H=46, rc=14, rw=12, hs=11, snout=9.5, ears='floppy', tail='long',
                       coat='DogCoatBrown', leg=3.6, desc='medium beagle/collie type'),
    'dog_large': dict(L=80, H=60, rc=18.5, rw=15.5, hs=13.5, snout=13, ears='floppy', tail='long',
                      coat='DogCoatGolden', leg=4.8, desc='large retriever type'),
}


def dog(key):
    d = DOGS[key]
    L, H, rc, rw, hs = d['L'], d['H'], d['rc'], d['rw'], d['hs']
    coat = d['coat']
    P = Prop(key, 'companion', f"Leashed dog, {d['desc']}: articulated parts (body, head, four legs, "
             'tail) with joint pivots for procedural trot, plus merged meshes for static use.',
             'ground under the body centre; nose toward +X')
    zb = H - rc * .95
    joints = {
        'neck': Vector((L * .36, 0, zb + rc * .55)),
        'leg_fl': Vector((L * .30, rw * .48, zb - rc * .35)),
        'leg_fr': Vector((L * .30, -rw * .48, zb - rc * .35)),
        'leg_rl': Vector((-L * .30, rw * .5, zb - rc * .25)),
        'leg_rr': Vector((-L * .30, -rw * .5, zb - rc * .25)),
        'tail': Vector((-L * .47, 0, zb + rc * .45)),
    }
    root = {}

    def part(name, mat):
        if name not in root:
            root[name] = (Prop('tmp', '', '', ''), mat)
        return root[name][0]

    body_prof = [(0, -L * .5), (rc * .55, -L * .47), (rc * .85, -L * .36), (rc * .86, -L * .15),
                 (rc * .9, L * .05), (rc, L * .22), (rc * .9, L * .36), (rc * .55, L * .46), (0, L * .5)]
    b = part('body', coat)
    b.lathe(coat, body_prof, 10, (0, 0, zb), (0, 90, 0), (1.0, rw / rc, 1), part='g')
    neck = joints['neck']
    b.tube(coat, [(L * .3, 0, zb + rc * .15), tuple(neck + Vector((-1, 0, -rc * .1))),
                  tuple(neck + Vector((hs * .25, 0, hs * .35)))], [rc * .62, rc * .55, rc * .5], 8, part='g')
    c = part('collar', 'CollarRed')
    cpts = [tuple(neck + Vector((-rc * .03 + rc * .58 * math.sin(a) * .25, rc * .58 * math.cos(a),
                                 rc * .58 * math.sin(a))) + Vector((0, 0, 0))) for a in
            [i * math.tau / 12 for i in range(12)]]
    c.tube('CollarRed', cpts, rc * .09, 4, part='g', closed=True)
    c.ellipsoid('CollarRed', tuple(neck + Vector((rc * .1, 0, -rc * .62))), (1.2, 1.2, 1.6), 6, 4, part='g')
    h = part('head', coat)
    hc = neck + Vector((hs * .35, 0, hs * .55))
    h.ellipsoid(coat, tuple(hc), (hs, hs * .85, hs * .88), 10, 7, part='g')
    sn = d['snout']
    h.lathe(coat, [(0, 0), (hs * .5, .5), (hs * .45, sn * .6), (hs * .32, sn), (0, sn + .5)], 8,
            tuple(hc + Vector((hs * .55, 0, -hs * .3))), (0, 98, 0), (1, .85, 1), part='g')
    dk = part('head_dark', 'DogDark')
    tip = hc + Vector((hs * .55 + sn, 0, -hs * .3 - sn * .12))
    dk.ellipsoid('DogDark', tuple(tip + Vector((.3, 0, .6))), (hs * .17, hs * .22, hs * .15), 6, 4, part='g')
    for s in (-1, 1):
        dk.ellipsoid('DogDark', tuple(hc + Vector((hs * .78, s * hs * .4, hs * .22))), (hs * .1, hs * .12, hs * .14),
                     6, 4, part='g')
        if d['ears'] == 'perky':
            ear = [(-hs * .3, 0), (hs * .3, 0), (0, hs * .75)]
            h.prism(coat, ear, hs * .12, T(tuple(hc + Vector((-hs * .1, s * hs * .5, hs * .6))), (90 - s * 18, 0, 0)),
                    part='g')
        else:
            h.ellipsoid(coat, tuple(hc + Vector((-hs * .15, s * hs * .82, -hs * .2))), (hs * .38, hs * .12, hs * .62),
                        7, 5, (s * 12, 10, 0), part='g')
    for name in ('leg_fl', 'leg_fr', 'leg_rl', 'leg_rr'):
        j = joints[name]
        J = j.z
        lr = d['leg']
        lg = part(name, coat)
        if name.startswith('leg_f'):
            path = [(0, 0, rc * .25), (J * .04, 0, -J * .5), (J * .02, 0, -J * .88), (J * .06, 0, -J + lr * .9)]
            radii = [lr * 1.6, lr * 1.15, lr * .95, lr * .9]
        else:
            path = [(0, 0, rc * .3), (J * .16, 0, -J * .38), (-J * .1, 0, -J * .72), (-J * .02, 0, -J + lr * .9)]
            radii = [lr * 2.0, lr * 1.35, lr * .95, lr * .9]
        lg.tube(coat, [tuple(Vector(p) + j) for p in path], radii, 7, part='g')
        lg.ellipsoid(coat, tuple(j + Vector((J * .06 + lr * .5, 0, -J + lr * .55))), (lr * 1.5, lr * 1.15, lr * .7),
                     7, 4, part='g')
    t = part('tail', coat)
    tj = joints['tail']
    if d['tail'] == 'curl':
        path = [(0, 0, 0), (-L * .05, 0, L * .08), (-L * .06, 0, L * .18), (-L * .01, 0, L * .25)]
        radii = [rc * .2, rc * .17, rc * .13, rc * .05]
    else:
        path = [(0, 0, 0), (-L * .1, 0, L * .05), (-L * .2, 0, L * .13), (-L * .28, 0, L * .24),
                (-L * .32, 0, L * .3)]
        radii = [rc * .2, rc * .17, rc * .14, rc * .1, rc * .04]
    t.tube(coat, [tuple(Vector(p) + tj) for p in path], radii, 6, part='g')
    # articulated parts: pivot at the joint
    attach = {'body': Vector(), 'collar': Vector(), 'head': joints['neck'], 'head_dark': joints['neck'],
              'leg_fl': joints['leg_fl'], 'leg_fr': joints['leg_fr'], 'leg_rl': joints['leg_rl'],
              'leg_rr': joints['leg_rr'], 'tail': joints['tail']}
    swing = {'leg_fl': ('Y', 28, 0.0), 'leg_rr': ('Y', 28, 0.0), 'leg_fr': ('Y', 28, .5), 'leg_rl': ('Y', 28, .5),
             'tail': ('Z', 25, 0.0), 'head': ('Y', 12, 0.0)}
    for name, (tmp, mat) in root.items():
        geo = tmp.parts['g']['geo']
        a = attach[name]
        P.part(name, mat).merged(geo, Matrix.Translation(-a))
        P.parts[name]['attach'] = _ue(a)
        if name in swing:
            axis, amp, phase = swing[name]
            P.parts[name]['joint'] = {'axis_unreal': axis, 'amplitude_deg': amp, 'phase_cycles': phase}
        mm = {'DogDark': 'merged_dark', 'CollarRed': 'merged_collar'}.get(mat, 'merged_coat')
        P.part(mm, mat).merged(geo)
        P.parts[mm]['merged'] = True
    P.extra['leash_collar_cm'] = _ue(joints['neck'] + Vector((rc * .1, 0, -rc * .62)))
    P.extra['trot'] = 'swing legs about Unreal Y with diagonal pairs in phase (fl+rr, fr+rl); ' \
                      'stride period about 0.45 s at walking pace'
    P.extra['dimensions'] = {'withers_cm': H, 'body_length_cm': L}
    return P


def stroller():
    P = Prop('stroller', 'companion', 'City stroller: dark aluminium frame with handlebar, fabric seat '
             'and basket, folding canopy and four wheels (separate parts with axle pivots).',
             'ground under the frame centre; pushed toward +X; handlebar at -X')
    root = {}

    def part(name, mat):
        if name not in root:
            root[name] = (Prop('tmp', '', '', ''), mat)
        return root[name][0]

    f = part('frame', 'StrollerFrame')
    for s in (-1, 1):
        y = s * 24
        f.tube('StrollerFrame', [(-44, y, 104), (-36, y, 80), (-30, s * 26, 14)], 1.5, 6, part='g')
        f.tube('StrollerFrame', [(-37, y, 82), (-4, y, 46), (30, s * 21, 12)], 1.5, 6, part='g')
        f.tube('StrollerFrame', [(-30, s * 26, 14), (-6, y, 44)], 1.2, 6, part='g')
        f.tube('StrollerFrame', [(-8, y, 46), (22, y, 46), (28, y, 34)], 1.0, 6, part='g')
    f.tube('StrollerFrame', [(-44, -24, 104), (-46, -18, 106), (-46, 18, 106), (-44, 24, 104)],
           1.9, 6, part='g')
    f.tube('StrollerFrame', [(-30, -27, 14), (-30, 27, 14)], 1.0, 6, part='g')
    f.box('StrollerFrame', (-4, 0, 26), (34, 40, 12), bevel=2, part='g')
    f.tube('StrollerFrame', [(28, -21, 34), (28, 21, 34)], 1.0, 6, part='g')
    s = part('seat', 'FabricNavy')
    s.box('FabricNavy', (4, 0, 50), (32, 38, 6), bevel=2.5, part='g')
    s.box('FabricNavy', (-16, 0, 66), (6, 38, 36), (0, -24, 0), bevel=2.5, part='g')
    s.box('FabricNavy', (22, 0, 40), (6, 34, 18), (0, 20, 0), bevel=2, part='g')
    for side in (-1, 1):
        s.box('FabricNavy', (2, side * 19.5, 56), (34, 2, 14), bevel=.8, part='g')
    c = part('canopy', 'FabricCharcoal')
    cx, cz, R, w, n = -14, 76, 22, 21, 7
    hood = lambda a, rr: (cx - rr * math.cos(a) * .6 + rr * .2, cz + rr * math.sin(a))
    cv, cf = [], []
    for i in range(n + 1):
        a = math.radians(-30 + 150 * i / n)
        for y in (-w, w):
            for rr in (R, R - 1.2):
                x, z = hood(a, rr)
                cv.append((x, y, z))
    for i in range(n):
        a0, a1 = 4 * i, 4 * (i + 1)
        cf += [(a0, a1, a1 + 2, a0 + 2), (a0 + 1, a0 + 3, a1 + 3, a1 + 1), (a0, a0 + 1, a1 + 1, a1),
               (a0 + 2, a1 + 2, a1 + 3, a0 + 3)]
    cf += [(0, 2, 3, 1), (4 * n, 4 * n + 1, 4 * n + 3, 4 * n + 2)]
    c.part('g', 'FabricCharcoal').add(outward((cv, cf, True)))
    sector = [(cx + R * .2, cz)] + [hood(math.radians(-30 + 150 * i / n), R - .6) for i in range(n + 1)]
    for side in (-1, 1):
        c.prism('FabricCharcoal', sector, 1.0, T((0, side * (w - .5), 0), (90, 0, 0)), part='g')
    wheels = {'wheel_fl': ((30, 21, 9.5), 9.5, 3.4), 'wheel_fr': ((30, -21, 9.5), 9.5, 3.4),
              'wheel_rl': ((-30, 27.5, 14), 14, 3.8), 'wheel_rr': ((-30, -27.5, 14), 14, 3.8)}
    attach = {'frame': Vector(), 'seat': Vector(), 'canopy': Vector()}
    for name, (ctr, r, wdt) in wheels.items():
        wp = part(name, 'Rubber')
        _wheel(wp, 'Rubber', 'Rubber', ctr, r, wdt, 'g', 'g', spokes=0, segs=12, sides=5)
        wp.lathe('Rubber', [(r * .55, -wdt * .4), (r * .55, wdt * .4)], 8, ctr, AXIS_Y, part='g')
        attach[name] = Vector(ctr)
    for name, (tmp, mat) in root.items():
        geo = tmp.parts['g']['geo']
        a = attach[name]
        P.part(name, mat).merged(geo, Matrix.Translation(-a))
        P.parts[name]['attach'] = _ue(a)
        if name.startswith('wheel'):
            P.parts[name]['joint'] = {'axis_unreal': 'Y', 'spin': True, 'radius_cm': wheels[name][1]}
        mm = {'StrollerFrame': 'merged_frame', 'FabricNavy': 'merged_seat', 'FabricCharcoal': 'merged_canopy',
              'Rubber': 'merged_wheels'}[mat]
        P.part(mm, mat).merged(geo)
        P.parts[mm]['merged'] = True
    P.anchors['hand_grip_cm'] = _ue((-46, 0, 106))
    P.colliders.append({'center': [0, 0, 55], 'size': [96, 58, 110]})
    return P


def grocery_bag():
    P = Prop('grocery_bag', 'companion', 'Kraft paper grocery bag with twisted handles, a baguette and '
             'leeks sticking out.', 'base centre; carried by anchors.hand_grip_cm')
    w, d, h = 30, 18, 36
    bag = Part()
    v = [(-d / 2, -w / 2, 0), (d / 2, -w / 2, 0), (d / 2, w / 2, 0), (-d / 2, w / 2, 0)]
    v += [(x * 1.02, y * 1.02, h) for x, y, _ in v]
    t = .5
    v += [(x - math.copysign(t, x), y - math.copysign(t, y), h) for x, y, _ in v[:4]]
    v += [(x - math.copysign(t, x), y - math.copysign(t, y), h - 9) for x, y, _ in v[:4]]
    faces = [(3, 2, 1, 0)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append((i, j, 4 + j, 4 + i))
        faces.append((4 + i, 4 + j, 8 + j, 8 + i))
        faces.append((12 + i, 12 + j, 8 + j, 8 + i))
    faces.append((12, 13, 14, 15))
    bag.add((v, faces, False))
    P.part('bag', 'Kraft').merged(bag)
    P.box('KraftDark', (0, 0, h - 8.6), (d - 1.2, w - 1.2, .4), part='bag_inner')
    for y in (-8, 8):
        P.tube('Kraft', [(-d / 2 + .4, y - 4, h - 2), (-d / 2 + .4, y - 3, h + 7), (-d / 2 + .4, y + 3, h + 7),
                         (-d / 2 + .4, y + 4, h - 2)], .6, 4, part='bag')
        P.tube('Kraft', [(d / 2 - .4, y - 4, h - 2), (d / 2 - .4, y - 3, h + 7), (d / 2 - .4, y + 3, h + 7),
                         (d / 2 - .4, y + 4, h - 2)], .6, 4, part='bag')
    P.lathe('Bread', [(0, 0), (2.4, 1.5), (3.2, 6), (3.2, 50), (2.4, 54.5), (0, 56)], 8, (-3, 6, 8),
            (16, -12, 0), part='bread')
    for k, (y, tilt) in enumerate(((-7, -8), (-3, 6))):
        base = Vector((2 + k, y, 12))
        top = base + Vector((tilt * .4, tilt * .5, 34))
        P.tube('LeekWhite', [tuple(base), tuple(base.lerp(top, .55))], 1.8, 6, part='leeks')
        P.tube('Leaf', [tuple(base.lerp(top, .55)), tuple(top), tuple(top + Vector((4, tilt * .2, 6)))],
               [1.8, 1.2, .3], 6, part='leaves')
    P.anchors['hand_grip_cm'] = _ue((0, 0, h + 7))
    return P


BUILDERS = [lamp_cobra, lamp_park, hydrant, sign_stop, sign_street, sign_oneway, sign_parking, bixi_dock,
            bixi_bike, bin_recycling, bin_compost, bin_garbage, cone, barrier_chantier, utility_pole,
            laundry_line, bike_locked, ac_unit, flower_box, bench, mailbox, police_lightbar,
            lambda: dog('dog_small'), lambda: dog('dog_medium'), lambda: dog('dog_large'), stroller,
            grocery_bag]
BUDGETS = {'lamp_cobra': 800, 'lamp_park': 800, 'hydrant': 500, 'dog_small': 1500, 'dog_medium': 1500,
           'dog_large': 1500, 'stroller': 1500}
DEFAULT_BUDGET = 2500


# --------------------------------------------------------------------------- export

def finalize(part):
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in part.v]
    for face, smooth in zip(part.f, part.s):
        if len(set(face)) < 3:
            continue
        try:
            f = bm.faces.new([verts[i] for i in face])
        except ValueError:
            continue
        f.smooth = smooth
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='FIXED', ngon_method='BEAUTY')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.verts.index_update()
    out_v = [tuple(v.co) for v in bm.verts]
    tris, flags = [], []
    for f in bm.faces:
        ids = tuple(v.index for v in f.verts)
        a, b, c = (Vector(out_v[i]) for i in ids)
        if (b - a).cross(c - a).length < 1e-6:
            continue
        tris.append(ids)
        flags.append(f.smooth)
    bm.free()
    return out_v, tris, flags


def corner_normals(verts, tris, flags):
    fn = []
    acc = [Vector((0, 0, 0)) for _ in verts]
    for (a, b, c), smooth in zip(tris, flags):
        n = (Vector(verts[b]) - Vector(verts[a])).cross(Vector(verts[c]) - Vector(verts[a]))
        fn.append(n.normalized())
        if smooth:
            for i in (a, b, c):
                acc[i] += n
    out = []
    for (tri, smooth, n) in zip(tris, flags, fn):
        corners = []
        for i in tri:
            m = acc[i].normalized() if smooth and acc[i].length > 1e-9 else n
            if m.dot(n) < .5:
                m = n
            corners.append(m)
        out.append(corners)
    return fn, out


def _fmt(x, digits):
    s = f'{x:.{digits}f}'
    return '0.' + '0' * digits if s.lstrip('-').strip('0.') == '' else s


def write_obj(path, mesh_name, verts, tris, flags):
    fn, cn = corner_normals(verts, tris, flags)
    lines = [f'o {mesh_name}']
    lines += [f'v {_fmt(x, 3)} {_fmt(y, 3)} {_fmt(z, 3)}' for x, y, z in verts]
    vt_index, vn_index, vt_lines, vn_lines, f_lines = {}, {}, [], [], []
    for tri, n, corners in zip(tris, fn, cn):
        ax = max(range(3), key=lambda k: abs(n[k]))
        refs = []
        for i, m in zip(tri, corners):
            x, y, z = verts[i]
            uv = (x / 100, y / 100) if ax == 2 else (y / 100, z / 100) if ax == 0 else (x / 100, z / 100)
            key_t = f'vt {_fmt(uv[0], 4)} {_fmt(uv[1], 4)}'
            key_n = f'vn {_fmt(m.x, 4)} {_fmt(m.y, 4)} {_fmt(m.z, 4)}'
            if key_t not in vt_index:
                vt_index[key_t] = len(vt_lines) + 1
                vt_lines.append(key_t)
            if key_n not in vn_index:
                vn_index[key_n] = len(vn_lines) + 1
                vn_lines.append(key_n)
            refs.append(f'{i + 1}/{vt_index[key_t]}/{vn_index[key_n]}')
        f_lines.append('f ' + ' '.join(refs))
    data = '\n'.join(lines + vt_lines + vn_lines + f_lines) + '\n'
    path.write_text(data)
    return hashlib.sha256(data.encode()).hexdigest()


def bounds_ue(verts):
    xs = [v[0] for v in verts]
    ys = [-v[1] for v in verts]
    zs = [v[2] for v in verts]
    return [round(min(xs), 2), round(min(ys), 2), round(min(zs), 2), round(max(xs), 2), round(max(ys), 2),
            round(max(zs), 2)]


def material_entry(key):
    hexcol, rough, metal, emissive = MATERIALS[key]
    entry = {'base_color_srgb': hexcol.lower(), 'roughness': rough, 'metallic': metal}
    if emissive:
        entry['emissive_srgb'] = hexcol.lower()
        entry['emissive_strength'] = emissive
    return entry


def build(only=None):
    props = []
    for builder in BUILDERS:
        prop = builder()
        if only and prop.key not in only:
            continue
        props.append(prop)
    return props


def export(props, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob('*.obj'):
        old.unlink()
    batches, entries, used, finals, tri_counts = [], {}, set(), {}, {}
    for prop in props:
        meshes, parts_out, prop_tris, merged_tris = [], {}, 0, 0
        for name, data in prop.parts.items():
            verts, tris, flags = finalize(data['geo'])
            mesh_name = f'SM_{LAYER}_{prop.key}_{name}'
            file_name = f'{prop.key}_{name}.obj'
            digest = write_obj(out_dir / file_name, mesh_name, verts, tris, flags)
            finals[(prop.key, name)] = (verts, tris, flags, data['material'])
            used.add(data['material'])
            used.update(VARIANT_OF.get(data['material'], []))
            batch = {'file': file_name, 'mesh': mesh_name, 'material': data['material'],
                     'collision': data['collision'], 'triangles': len(tris), 'bounds_cm': bounds_ue(verts),
                     'prop': prop.key, 'part': name, 'sha256': digest}
            if VARIANT_OF.get(data['material']):
                batch['variants'] = VARIANT_OF[data['material']]
            batches.append(batch)
            meshes.append(mesh_name)
            record = {'mesh': mesh_name, 'material': data['material']}
            if data['attach'] is not None:
                record['attach_cm'] = data['attach']
            if data['joint']:
                record['joint'] = data['joint']
            if data.get('merged'):
                merged_tris += len(tris)
                record['merged'] = True
            else:
                prop_tris += len(tris)
            parts_out[name] = record
        if merged_tris:
            assert merged_tris == prop_tris, (prop.key, merged_tris, prop_tris)
        tri_counts[prop.key] = prop_tris
        all_v = [v for (k, _), f in finals.items() if k == prop.key for v in f[0]]
        entry = {'kind': prop.kind, 'description': prop.description, 'pivot': prop.pivot,
                 'triangles': prop_tris, 'budget': BUDGETS.get(prop.key, DEFAULT_BUDGET),
                 'bounds_cm': bounds_ue(all_v), 'parts': parts_out}
        if prop.anchors:
            entry['anchors'] = prop.anchors
        if prop.colliders:
            entry['colliders_cm'] = prop.colliders
        entry.update(prop.extra)
        entries[prop.key] = entry
    materials = {k: material_entry(k) for k in MATERIALS if k in used}
    return batches, entries, materials, finals, tri_counts


def source_hashes():
    return {GENERATOR: hashlib.sha256((ROOT / GENERATOR).read_bytes()).hexdigest()}


def write_manifest(out_dir, batches, entries, materials):
    manifest = {
        'layer': LAYER, 'generator': GENERATOR, 'frame': 'x east, y north, cm, z up',
        'local_frame': 'prop-local, Unreal axes: X forward, Y right, Z up, cm; pivot at the base centre. '
                       'OBJ files store (x, -y, z) of these coordinates with counter-clockwise outward '
                       'winding, the Scripts/plateau_mesh.py file convention, so Unreal\'s OBJ import '
                       'restores them. Yaw = atan2(dy, dx) of the game-frame facing direction.',
        'blender': bpy.app.version_string,
        'unreal_destination': '/Game/Plateau/Replica/Props',
        'batches': batches, 'materials': materials, 'props': entries,
        'counts': {'props': len(entries), 'meshes': len(batches),
                   'triangles_per_prop': {k: v['triangles'] for k, v in entries.items()},
                   'triangles_all_meshes': sum(b['triangles'] for b in batches)},
        'source_sha256': source_hashes(),
    }
    text = json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=False) + '\n'
    (out_dir / 'manifest.json').write_text(text)
    return manifest


# --------------------------------------------------------------------------- render

def srgb_to_linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def make_material(key, override=None):
    name = 'M_' + (override or key)
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    hexcol, rough, metal, emissive = MATERIALS[override or key]
    rgb = [srgb_to_linear(int(hexcol[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emissive:
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1)
        bsdf.inputs['Emission Strength'].default_value = emissive * .35
    return mat


def make_object(name, verts, tris, flags, material, collection, M=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x / 100, y / 100, z / 100) for x, y, z in verts], [], tris)
    mesh.polygons.foreach_set('use_smooth', flags)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    if M is not None:
        obj.matrix_world = M
    collection.objects.link(obj)
    return obj


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    except TypeError:
        pass
    scene.cycles.max_bounces = 4
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (.42, .45, .5, 1)
    bg.inputs['Strength'].default_value = .9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2
    sun.data.angle = math.radians(14)
    sun.rotation_euler = Euler((math.radians(48), math.radians(8), math.radians(-35)), 'XYZ')
    scene.collection.objects.link(sun)
    ground = bpy.data.meshes.new('ground')
    ground.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [(0, 1, 2, 3)])
    gmat = bpy.data.materials.new('ground')
    gmat.use_nodes = True
    gb = gmat.node_tree.nodes.get('Principled BSDF')
    gb.inputs['Base Color'].default_value = (.32, .32, .32, 1)
    gb.inputs['Roughness'].default_value = .9
    ground.materials.append(gmat)
    gobj = bpy.data.objects.new('ground', ground)
    scene.collection.objects.link(gobj)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 60
    cam.data.clip_start = .05
    scene.collection.objects.link(cam)
    scene.camera = cam
    label_mat = bpy.data.materials.new('label')
    label_mat.use_nodes = True
    lb = label_mat.node_tree.nodes.get('Principled BSDF')
    lb.inputs['Base Color'].default_value = (0, 0, 0, 1)
    lb.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    lb.inputs['Emission Strength'].default_value = 0
    return scene, cam, label_mat


def frame_camera(cam, lo, hi, azimuth=-38.0, elevation=16.0, aspect=200 / 250, margin=1.1):
    """Aim along (azimuth, elevation) and back off until the box fits, leaving room for the label."""
    lo, hi = Vector(lo), Vector(hi)
    centre = (lo + hi) / 2
    az, el = math.radians(azimuth), math.radians(elevation)
    back = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
    rot = (-back).to_track_quat('-Z', 'Y')
    R = rot.to_matrix()
    right, up, fwd = R.col[0], R.col[1], -R.col[2]
    tan_v = 18 / cam.data.lens
    tan_h = tan_v * aspect
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    xs = [(c - centre).dot(right) for c in corners]
    ys = [(c - centre).dot(up) for c in corners]
    centre = centre + right * (max(xs) + min(xs)) / 2 + up * (max(ys) + min(ys)) / 2
    dist = 0.0
    for c in corners:
        rel = c - centre
        depth_off = rel.dot(fwd)
        dist = max(dist, abs(rel.dot(right)) * margin / tan_h - depth_off,
                   abs(rel.dot(up)) * margin / (tan_v * .82) - depth_off)
    centre = centre - up * tan_v * dist * .1
    cam.location = centre - fwd * dist
    cam.rotation_euler = rot.to_euler()
    return dist


def add_label(scene, cam, text, mat):
    curve = bpy.data.curves.new('label', 'FONT')
    curve.body = text
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    tan_v = 18 / cam.data.lens
    curve.size = tan_v * .085
    obj = bpy.data.objects.new('label', curve)
    obj.data.materials.append(mat)
    scene.collection.objects.link(obj)
    obj.parent = cam
    obj.location = (0, -tan_v * .9, -1.0)
    obj.visible_shadow = False
    return obj


DETAIL_TILES = [
    ('lamp_cobra head', 'lamp_cobra', ((120, -30, 760), (260, 30, 830)), -50, 10),
    ('sign_street blades', 'sign_street', ((-55, -55, 250), (55, 55, 305)), -45, 8),
]


def render_sheet(props, finals, sheet_path, tmp_dir):
    import numpy as np
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene, cam, label_mat = setup_scene()
    tw, th, cols, rows = 200, 250, 8, 4
    scene.render.resolution_x, scene.render.resolution_y = tw, th
    scene.render.resolution_percentage = 100
    demo = sign_street(demo=True)
    demo_finals = {('sign_street', n): finalize(d['geo']) + (d['material'],) for n, d in demo.parts.items()}
    by_key = {p.key: p for p in props}

    def placements(key, M=None, variant=None, explode=False):
        parts = [(n, f) for (k, n), f in finals.items() if k == key]
        if key == 'sign_street':
            parts = [(n, f) for (k, n), f in demo_finals.items()]
        has_merged = any(n.startswith('merged') for n, _ in parts)
        out = []
        for name, data in parts:
            merged = name.startswith('merged')
            if (explode and merged) or (not explode and has_merged and not merged):
                continue
            Mo = M
            if explode:
                att = by_key[key].parts[name]['attach'] or [0, 0, 0]
                a = Vector((att[0], -att[1], att[2]))
                push = Vector((a.x * .35, a.y * 1.4, max(0.0, a.z) * .25 + (6 if name.startswith('leg') else 0)))
                Mo = Matrix.Translation((a + push) / 100)
            out.append((f'{key}_{name}', data, variant, Mo))
        return out

    tiles = []
    for prop in props:
        items = placements(prop.key)
        if prop.key == 'bixi_dock' and 'bixi_bike' in by_key:
            for slot in prop.extra['slots']:
                if slot['occupied_default']:
                    x, y, _ = slot['position_cm']
                    items += placements('bixi_bike', T((x / 100, -y / 100, 0), (0, 0, slot['yaw_deg'])))
        tiles.append((prop.key, items, None))
    if 'dog_medium' in by_key:
        tiles.append(('dog_medium parts', placements('dog_medium', explode=True), None))
    if all(k in by_key for k in ('dog_small', 'dog_medium', 'dog_large')):
        items = []
        for i, key in enumerate(('dog_small', 'dog_medium', 'dog_large')):
            items += placements(key, T((0, (-80 + i * 85) / 100, 0)), 1 + i % 2)
        tiles.append(('coat variants', items, None))
    for label, key, box, az, el in DETAIL_TILES:
        if key in by_key:
            tiles.append((label, placements(key), (box, az, el)))
    corner = [('sign_stop', (0, 40), 90), ('sign_street', (-20, 0), 0), ('hydrant', (10, -110), 90),
              ('bin_recycling', (-60, -230), 0), ('bin_compost', (-60, -300), 0), ('bin_garbage', (-50, -380), 0),
              ('cone', (170, -170), 0), ('cone', (200, -260), 30), ('mailbox', (-40, 180), 0),
              ('lamp_cobra', (-10, 330), 0), ('bike_locked', (-25, 120), 90), ('dog_medium', (90, 20), -70)]
    if all(k in by_key for k, _, _ in corner):
        items = []
        for key, (x, y), yaw in corner:
            items += placements(key, T((x / 100, y / 100, 0), (0, 0, yaw)))
        tiles.append(('street corner', items, (((-120, -420, 0), (230, 120, 260)), -62, 9)))
    tiles = tiles[:cols * rows]
    sheet = np.full((th * rows, tw * cols, 4), .3, dtype=np.float32)
    for idx, (label, items, view) in enumerate(tiles):
        coll = bpy.data.collections.new(f'tile{idx}')
        scene.collection.children.link(coll)
        lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
        for name, (verts, tris, flags, mat), variant, M in items:
            override = None
            if variant and VARIANT_OF.get(mat):
                override = VARIANT_OF[mat][(variant - 1) % len(VARIANT_OF[mat])]
            obj = make_object(name, verts, tris, flags, make_material(mat, override), coll, M)
            bpy.context.view_layer.update()
            for corner in obj.bound_box:
                w = obj.matrix_world @ Vector(corner)
                lo = Vector([min(lo[i], w[i]) for i in range(3)])
                hi = Vector([max(hi[i], w[i]) for i in range(3)])
        az, el = -38, 14
        key = label.split()[0]
        if key in ('police_lightbar', 'laundry_line', 'barrier_chantier', 'bench', 'bixi_dock', 'sign_oneway'):
            az = -30
        if view:
            (blo, bhi), az, el = view
            lo, hi = Vector(blo) / 100, Vector(bhi) / 100
        frame_camera(cam, lo, hi, az, el)
        lab = add_label(scene, cam, label, label_mat)
        for other in bpy.data.collections:
            other.hide_render = other is not coll
        scene.render.filepath = str(tmp_dir / f'tile{idx:02d}.png')
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(scene.render.filepath)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(th, tw, 4)
        r, c = divmod(idx, cols)
        sheet[(rows - 1 - r) * th:(rows - r) * th, c * tw:(c + 1) * tw] = px
        bpy.data.images.remove(img)
        bpy.data.objects.remove(lab)
        coll.hide_render = True
    sheet[..., 3] = 1.0
    out = bpy.data.images.new('sheet', tw * cols, th * rows, alpha=False)
    out.pixels[:] = sheet.ravel()
    sheet_path.parent.mkdir(parents=True, exist_ok=True)
    out.filepath_raw = str(sheet_path)
    out.file_format = 'PNG'
    out.save()


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=str(OUT))
    parser.add_argument('--sheet', default=str(SHEET))
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--only', default='')
    args = parser.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    only = set(filter(None, args.only.split(',')))
    props = build(only)
    out = Path(args.out)
    batches, entries, materials, finals, tri_counts = export(props, out)
    write_manifest(out, batches, entries, materials)
    for key, count in tri_counts.items():
        budget = BUDGETS.get(key, DEFAULT_BUDGET)
        print(f'{key:18s} {count:6d} tris  (budget {budget}){"  OVER" if count > budget else ""}')
    print(f'{len(batches)} meshes, {sum(b["triangles"] for b in batches)} triangles in all meshes -> {out}')
    if not args.no_render:
        tmp = Path(args.out) / '.tiles'
        tmp.mkdir(exist_ok=True)
        render_sheet(props, finals, Path(args.sheet), tmp)
        for f in tmp.glob('*.png'):
            f.unlink()
        tmp.rmdir()
        print('contact sheet ->', args.sheet)
    over = [k for k, c in tri_counts.items() if c > BUDGETS.get(k, DEFAULT_BUDGET)]
    return 1 if over else 0


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
