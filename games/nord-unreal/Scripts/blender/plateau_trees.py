"""Plateau species trees: Weber & Penn branching, autumn leaf cards and a bark texture (stdlib Python).

Run from games/nord-unreal:
    python3 Scripts/blender/plateau_trees.py --no-render     # OBJs, textures and manifest (stdlib only, ~30 s)
    <blender-python> Scripts/blender/plateau_trees.py        # the same, then the Cycles contact sheet (~4 min)
    python3 Scripts/test_plateau_tree_kinds.py               # checks; --rebuild also builds twice and compares bytes

Writes Data/Plateau/ReplicaGeometry/Trees/: one OBJ per kind (norway_maple, silver_maple, honey_locust, linden,
ash, small) with two material groups (usemtl <kind>_bark and <kind>_leaves), the autumn leaf atlas and the bark
texture (three PNG maps each, in the Scripts/plateau_textures.py format) and manifest.json in the shared Trees
format {kinds: {kind: {obj, materials {bark, leaves}, height_cm, trunk_cm, ...}}, materials, texture_sets}. The
contact sheet goes to Preview/Replica/trees_contact_sheet.png.

Technique. The branching is the parametric model of Weber and Penn, "Creation and Rendering of Realistic Trees"
(SIGGRAPH 1995), the model Blender's Sapling add-on implements (Sapling is not bundled with the bpy 5.1 module,
so the recursion is written here): a trunk with a flared, tapered radius, optional clones (trunk splits into
leaders), and recursive child stems whose number, length (the ShapeRatio crown envelope), radius (RatioPower),
down angle (with the negative-variation rule that tilts low limbs down and high ones up), helical or opposite
rotation, curvature and AttractionUp follow the paper's formulas. Leaves are the last level, as in the paper,
but each leaf is a folded cluster card (a twig with 2-14 leaves) cut out of an alpha-masked atlas, the way
SpeedTree and game foliage use leaf cards; the card normals are bent toward the crown's ellipsoid normal and
kept from pointing fully down, after SpeedTree's leaf "puffiness" and normal-range settings, and every card's
front faces out of the crown. Crowns are pruned up: no limb starts below the clearance and no branch dips under
it, as the borough prunes street trees over sidewalks. Late October: most leaves have turned yellow to orange,
some red, the inner and lower ones stay greener longer, and many have fallen (leaf_retention keeps a share of
the cards; sparse cards show bare twigs). The atlas and the bark are painted with the plateau_textures.py
primitives (serrated leaflets from signed distances, Worley cells), so the textures are generated, not scanned.

Axes: centimetres, x east, y north, z up, pivot at the trunk base. The OBJ stores Blender/game-local (x, y, z)
unchanged (the Scripts/blender/plateau_props.py convention); Unreal's OBJ import flips Y, which a tree does not
mind. Manifest bounds are Unreal-local (x, -y, z). Leaf UVs address the atlas (0..1, v up, OBJ convention);
bark UVs are metres (u around the stem in whole bark tiles, v along it).
"""
import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / 'Scripts') not in sys.path:
    sys.path.insert(0, str(ROOT / 'Scripts'))
import plateau_textures as PT  # noqa: E402  (stdlib texture primitives: Canvas, leaflet, cells, PNG writer)

LAYER = 'Trees'
OUT = ROOT / 'Data/Plateau/ReplicaGeometry/Trees'
SHEET = ROOT / 'Preview/Replica/trees_contact_sheet.png'
GENERATOR = 'Scripts/blender/plateau_trees.py'
KINDS = ('norway_maple', 'silver_maple', 'honey_locust', 'linden', 'ash', 'small')
MATURE = KINDS[:-1]
ALIASES = {'maple': 'norway_maple', 'elm': 'linden'}
TRIANGLE_TARGET = {'mature': 30000, 'small': 15000}
UP = (0., 0., 1.)

# ------------------------------------------------------------------------------------------------ species
# Weber & Penn parameters per kind, in the paper's names where one exists (levels[n] is level n + 1: limbs,
# then branchlets that carry the leaf cards). Heights, trunk diameters at 1.3 m (DBH) and pruning follow mature
# Plateau street and yard trees: 12-18 m, trunks 25-60 cm, crowns raised to about 3 m; the small kind is a
# yard tree (Amur maple or serviceberry type). Leaf colour cells and retention are for late October.
SPECIES = {
    'norway_maple': {
        'name': 'Norway maple (Acer platanoides)', 'seed': 4101, 'height_cm': 1450., 'dbh_cm': 48., 'prune_cm': 300.,
        'shape': 1, 'flare': .55, 'ratio_power': 1.25, 'lean_deg': 2.5,
        'trunk': {'split_cm': 470., 'leaders': 3, 'split_angle': 27., 'split_angle_v': 7., 'curve_v': 6.,
                  'leader_res': 6, 'leader_attraction': .3, 'leader_curve_v': 14., 'sides': 14},
        'levels': [
            {'length': .5, 'length_v': .08, 'branches': 24, 'down': 64., 'down_v': -26., 'rotate': 140., 'rotate_v': 35.,
             'curve_res': 6, 'curve': -6., 'curve_back': 0., 'curve_v': 30., 'attraction': .45, 'sides': 7},
            {'length': .46, 'length_v': .1, 'branches': 13, 'down': 48., 'down_v': 14., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 40., 'attraction': .12, 'sides': 4},
        ],
        'leaves': {'cards': 9, 'retention': .76, 'card_cm': 62., 'down': 52., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 32.,
                   'cells': {'nm_yellow': .38, 'nm_mixed': .3, 'nm_green': .16, 'nm_sparse': .16}},
        'bark': {'colour': '#5E564D', 'note': 'grey-brown, shallow interlacing ridges'},
    },
    'silver_maple': {
        'name': 'Silver maple (Acer saccharinum)', 'seed': 4202, 'height_cm': 1700., 'dbh_cm': 58., 'prune_cm': 330.,
        'shape': 7, 'flare': .6, 'ratio_power': 1.2, 'lean_deg': 3.,
        'trunk': {'split_cm': 270., 'leaders': 3, 'split_angle': 29., 'split_angle_v': 6., 'curve_v': 5.,
                  'leader_res': 7, 'leader_attraction': .22, 'leader_curve_v': 12., 'sides': 14},
        'levels': [
            {'length': .42, 'length_v': .08, 'branches': 27, 'down': 50., 'down_v': -18., 'rotate': 140., 'rotate_v': 40.,
             'curve_res': 6, 'curve': 12., 'curve_back': 0., 'curve_v': 28., 'attraction': .2, 'sides': 7},
            {'length': .5, 'length_v': .1, 'branches': 12, 'down': 56., 'down_v': 15., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 14., 'curve_back': 0., 'curve_v': 30., 'attraction': -.35, 'sides': 4},
        ],
        'leaves': {'cards': 8, 'retention': .56, 'card_cm': 62., 'down': 60., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 35., 'cells': {'sm_yellow': .44, 'sm_orange': .26, 'sm_sparse': .3}},
        'bark': {'colour': '#8A857C', 'note': 'light grey, long loose plates on old trunks'},
    },
    'honey_locust': {
        'name': 'Thornless honey locust (Gleditsia triacanthos var. inermis)', 'seed': 4303, 'height_cm': 1350.,
        'dbh_cm': 40., 'prune_cm': 320., 'shape': 2, 'flare': .45, 'ratio_power': 1.3, 'lean_deg': 3.5,
        'trunk': {'split_cm': 390., 'leaders': 2, 'split_angle': 31., 'split_angle_v': 6., 'curve_v': 8.,
                  'leader_res': 6, 'leader_attraction': .2, 'leader_curve_v': 16., 'sides': 13},
        'levels': [
            {'length': .56, 'length_v': .08, 'branches': 18, 'down': 66., 'down_v': -20., 'rotate': 140., 'rotate_v': 40.,
             'curve_res': 6, 'curve': -10., 'curve_back': 0., 'curve_v': 34., 'attraction': .3, 'sides': 7},
            {'length': .46, 'length_v': .1, 'branches': 11, 'down': 50., 'down_v': 15., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 40., 'attraction': .05, 'sides': 4},
        ],
        'leaves': {'cards': 7, 'retention': .4, 'card_cm': 70., 'down': 50., 'down_v': 25., 'rotate': 137.5,
                   'rotate_v': 15., 'twist_v': 40., 'cells': {'hl_gold': .55, 'hl_sparse': .45}},
        'bark': {'colour': '#4D433B', 'note': 'dark grey-brown, scaly plates'},
    },
    'linden': {
        'name': 'Linden (Tilia cordata / T. americana)', 'seed': 4404, 'height_cm': 1400., 'dbh_cm': 42.,
        'prune_cm': 300., 'shape': 0, 'flare': .45, 'ratio_power': 1.3, 'lean_deg': 1.5,
        'trunk': {'split_cm': None, 'leaders': 1, 'curve_v': 4., 'sides': 13},
        'levels': [
            {'length': .38, 'length_v': .06, 'branches': 34, 'down': 74., 'down_v': -22., 'rotate': 140., 'rotate_v': 20.,
             'curve_res': 6, 'curve': -10., 'curve_back': 0., 'curve_v': 20., 'attraction': .42, 'sides': 7},
            {'length': .46, 'length_v': .1, 'branches': 12, 'down': 50., 'down_v': 12., 'rotate': 140., 'rotate_v': 25.,
             'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 30., 'attraction': .18, 'sides': 4},
        ],
        'leaves': {'cards': 9, 'retention': .64, 'card_cm': 50., 'down': 52., 'down_v': 20., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 30., 'cells': {'li_yellow': .56, 'li_mixed': .44}},
        'bark': {'colour': '#6A6157', 'note': 'grey-brown, narrow vertical ridges'},
    },
    'ash': {
        'name': 'Green ash (Fraxinus pennsylvanica)', 'seed': 4505, 'height_cm': 1550., 'dbh_cm': 44.,
        'prune_cm': 310., 'shape': 1, 'flare': .45, 'ratio_power': 1.25, 'lean_deg': 2.,
        'trunk': {'split_cm': 560., 'leaders': 2, 'split_angle': 22., 'split_angle_v': 5., 'curve_v': 5.,
                  'leader_res': 6, 'leader_attraction': .3, 'leader_curve_v': 12., 'sides': 13},
        'levels': [
            {'length': .45, 'length_v': .07, 'branches': 22, 'opposite': True, 'down': 56., 'down_v': -20.,
             'rotate': 90., 'rotate_v': 15., 'curve_res': 6, 'curve': -6., 'curve_back': 0., 'curve_v': 22.,
             'attraction': .5, 'sides': 7},
            {'length': .42, 'length_v': .1, 'branches': 10, 'opposite': True, 'down': 46., 'down_v': 10.,
             'rotate': 90., 'rotate_v': 15., 'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 25.,
             'attraction': .3, 'sides': 4},
        ],
        'leaves': {'cards': 7, 'retention': .46, 'card_cm': 75., 'down': 48., 'down_v': 20., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 30., 'cells': {'as_yellow': .45, 'as_maroon': .2, 'as_sparse': .35}},
        'bark': {'colour': '#77726A', 'note': 'grey, interlacing diamond ridges'},
    },
    'small': {
        'name': 'Small yard tree (Amur maple / serviceberry type)', 'seed': 4606, 'height_cm': 650., 'dbh_cm': 17.,
        'prune_cm': 160., 'shape': 1, 'flare': .35, 'ratio_power': 1.25, 'lean_deg': 3.,
        'trunk': {'split_cm': 115., 'leaders': 3, 'split_angle': 30., 'split_angle_v': 8., 'curve_v': 6.,
                  'leader_res': 5, 'leader_attraction': .2, 'leader_curve_v': 16., 'sides': 10},
        'levels': [
            {'length': .5, 'length_v': .08, 'branches': 20, 'down': 56., 'down_v': -20., 'rotate': 140., 'rotate_v': 35.,
             'curve_res': 5, 'curve': -6., 'curve_back': 0., 'curve_v': 30., 'attraction': .35, 'sides': 6},
            {'length': .46, 'length_v': .1, 'branches': 9, 'down': 46., 'down_v': 15., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 3, 'curve': 0., 'curve_back': 0., 'curve_v': 35., 'attraction': .12, 'sides': 4},
        ],
        'leaves': {'cards': 8, 'retention': .66, 'card_cm': 44., 'down': 52., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 32., 'cells': {'sx_red': .5, 'sx_orange': .5}},
        'bark': {'colour': '#6E655B', 'note': 'smooth grey-brown'},
    },
}

LEAF_KEY = 'Tree_Leaves_Autumn'
PUFFINESS = .55          # card normal -> crown ellipsoid normal blend (SpeedTree's leaf "puffiness")
MIN_NORMAL_Z = -.3       # no card normal points further down than this (SpeedTree's normal range)
FOLD = .14               # card centre line raised by this share of the card width: a shallow V
MIN_RADIUS_CM = .45

# ------------------------------------------------------------------------------------------------ vectors


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def length(a):
    return math.sqrt(dot(a, a))


def norm(a):
    n = length(a)
    return (a[0] / n, a[1] / n, a[2] / n) if n > 1e-12 else (0., 0., 1.)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def rotate(v, k, angle):
    """Rodrigues: v rotated by angle (radians) about the unit axis k (right-handed)."""
    c, s = math.cos(angle), math.sin(angle)
    kv = cross(k, v)
    kd = dot(k, v) * (1. - c)
    return (v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd)


def rotate_frame(frame, k, angle):
    return tuple(rotate(v, k, angle) for v in frame)


def bend_toward_up(frame, angle):
    """Rotate a frame so its z turns toward world up by angle (radians; negative droops)."""
    z = frame[2]
    axis = cross(z, UP)
    if length(axis) < 1e-9:
        return frame
    return rotate_frame(frame, norm(axis), angle)


# ------------------------------------------------------------------------------------------------ Weber & Penn


def shape_ratio(shape, ratio):
    """Weber & Penn's ShapeRatio(shape, ratio) for the predefined crown shapes 0-7 (Table 1 of the paper)."""
    ratio = min(1., max(0., ratio))
    if shape == 0:      # conical
        return .2 + .8 * ratio
    if shape == 1:      # spherical
        return .2 + .8 * math.sin(math.pi * ratio)
    if shape == 2:      # hemispherical
        return .2 + .8 * math.sin(.5 * math.pi * ratio)
    if shape == 3:      # cylindrical
        return 1.
    if shape == 4:      # tapered cylindrical
        return .5 + .5 * ratio
    if shape == 5:      # flame
        return ratio / .7 if ratio <= .7 else (1. - ratio) / .3
    if shape == 6:      # inverse conical
        return 1. - .8 * ratio
    if shape == 7:      # tend flame
        return .5 + .5 * ratio / .7 if ratio <= .7 else .5 + .5 * (1. - ratio) / .3
    raise ValueError(shape)


def flare_factor(flare, t):
    """Weber & Penn trunk flare: flareZ = Flare * (100^y - 1) / 100 + 1 with y = 1 - 8 Z, clamped at 0."""
    y = max(0., 1. - 8. * t)
    return flare * (100. ** y - 1.) / 100. + 1.


class Stem:
    """A stem polyline: points[0..res], the frame each segment advanced along, and its radius rule."""

    def __init__(self, level, points, frames, radius_at, parent=None, offset=0., index=0):
        self.level, self.points, self.frames, self._radius = level, points, frames, radius_at
        self.parent, self.offset, self.index = parent, offset, index
        self.seg = [length(sub(b, a)) for a, b in zip(points, points[1:])]
        self.cum = [0.]
        for s in self.seg:
            self.cum.append(self.cum[-1] + s)
        self.length = self.cum[-1]
        self.radius0 = radius_at(0.)
        self.children = 0
        self.t = 0.

    def radius(self, t):
        return self._radius(min(1., max(0., t)))

    def at(self, t):
        """(point, segment frame, radius) at the fraction t of the stem's length."""
        d = min(1., max(0., t)) * self.length
        for i in range(len(self.seg)):
            if d <= self.cum[i + 1] or i == len(self.seg) - 1:
                f = 0. if self.seg[i] < 1e-9 else (d - self.cum[i]) / self.seg[i]
                return lerp(self.points[i], self.points[i + 1], min(1., max(0., f))), self.frames[i], self.radius(t)
        raise AssertionError

    def ring_frame(self, i):
        """The frame of ring i: z mitred between the neighbouring segments, x kept from the segment frame."""
        n = len(self.frames)
        a, b = self.frames[max(0, i - 1)], self.frames[min(n - 1, i)]
        z = norm(add(a[2], b[2]))
        x = norm(sub(b[0], mul(z, dot(b[0], z))))
        return x, cross(z, x), z


def grow(level, origin, frame, length_cm, radius_at, p, rng, floor_z, fractions=None):
    """One Weber & Penn stem: per segment the nCurve / nCurveBack / nCurveV rotation about the stem's x axis,
    then AttractionUp (curve_up = AttractionUp * declination / nCurveRes), then the pruning floor."""
    res = len(fractions) if fractions else p['curve_res']
    fractions = fractions or [1. / res] * res
    pts, frames = [origin], []
    f = frame
    curve, back, var = p.get('curve', 0.), p.get('curve_back', 0.), p.get('curve_v', 0.)
    attraction = p.get('attraction', 0.)
    for i in range(res):
        if back == 0.:
            angle = curve / res
        else:
            angle = (curve if i < res / 2. else back) / (res / 2.)
        angle += (rng.random() * 2. - 1.) * var / res
        f = rotate_frame(f, f[0], math.radians(angle))
        if attraction:
            declination = math.acos(min(1., max(-1., f[2][2])))
            bend = attraction * declination / res
            f = bend_toward_up(f, max(-math.pi + declination, min(declination, bend)))
        seg = length_cm * fractions[i]
        here = pts[-1]
        if floor_z is not None and seg > 1e-6:
            need = (floor_z - here[2]) / seg
            if f[2][2] < need <= 1.:
                f = bend_toward_up(f, math.acos(max(-1., f[2][2])) - math.acos(need))
        frames.append(f)
        pts.append(add(here, mul(f[2], seg)))
    return pts, frames


def child_frame(parent_frame, spin, down):
    """Rotate about the parent's z by spin, then tilt the z away from the parent's z by down (degrees)."""
    f = rotate_frame(parent_frame, parent_frame[2], math.radians(spin))
    return rotate_frame(f, f[0], math.radians(down))


def generate(kind):
    """The stems and leaf cards of one kind, deterministic from its seed."""
    P = SPECIES[kind]
    rng = random.Random(P['seed'])
    H, prune, T = P['height_cm'], P['prune_cm'], P['trunk']
    clearance = prune - 15.
    t130 = 130. / H
    r_base = P['dbh_cm'] / 2. / ((1. - t130) * flare_factor(P['flare'], t130))

    def trunk_radius(t_abs):
        return r_base * (1. - t_abs) * flare_factor(P['flare'], t_abs)

    lean_axis = rotate((1., 0., 0.), UP, rng.random() * math.tau)
    frame0 = rotate_frame(((1., 0., 0.), (0., 1., 0.), (0., 0., 1.)), lean_axis, math.radians(P['lean_deg']))
    stems = []
    split = T.get('split_cm')
    trunk_len = split if split else H
    # Rings at the flare, at the 1.3 m breast height (the DBH the manifest records) and evenly above.
    marks = [0., 20., 50., 90., 130., 180.]
    marks = [m for m in marks if m < trunk_len - 30.]
    rest = max(1, round((trunk_len - marks[-1]) / 110.))
    marks += [marks[-1] + (trunk_len - marks[-1]) * (i + 1) / rest for i in range(rest)]
    fractions = [(b - a) / trunk_len for a, b in zip(marks, marks[1:])]
    trunk_p = {'curve': 0., 'curve_v': T.get('curve_v', 0.), 'attraction': .0}
    pts, frames = grow(0, (0., 0., 0.), frame0, trunk_len, None, trunk_p, rng, None, fractions)
    # The trunk radius follows the absolute height fraction so that leaders continue its taper.
    trunk = Stem(0, pts, frames, lambda t, L=trunk_len: trunk_radius(t * L / H), offset=0.)
    stems.append(trunk)
    level0 = [trunk]
    if split:
        top, top_frame = pts[-1], frames[-1]
        n = T['leaders']
        r_split = trunk_radius(split / H)
        leader_p = {'curve': 0., 'curve_v': T.get('leader_curve_v', 10.), 'attraction': T.get('leader_attraction', .2),
                    'curve_res': T.get('leader_res', 6)}
        phase = rng.random() * 360.
        for i in range(n):
            angle = T['split_angle'] + (rng.random() * 2. - 1.) * T['split_angle_v']
            f = child_frame(top_frame, phase + i * 360. / n + (rng.random() - .5) * 30., angle)
            remain = (H - split) / math.cos(math.radians(angle * .6))
            r0 = r_split * n ** -.38
            lpts, lframes = grow(0, top, f, remain, None, leader_p, rng, None)
            stems.append(Stem(0, lpts, lframes, lambda t, r0=r0: r0 * (1. - t) + .3, offset=split, index=i + 1))
            level0.append(stems[-1])
    L0 = H
    levels = P['levels']
    # ---- level 1: limbs from the trunk and leaders above the pruned height (paper: 1Branches over the trunk)
    p1 = levels[0]
    spans = []
    for s in level0:
        start_abs = max(prune + 20., s.offset)
        a = (start_abs - s.offset) / s.length if s.length else 1.
        if s is trunk and split:
            a = min(1., (prune + 20.) / s.length)
        spans.append((s, min(1., max(0., a)), .97 if s is not trunk or not split else 1.))
    usable = [(s, a, b) for s, a, b in spans if b - a > .02]
    total = sum((b - a) * s.length for s, a, b in usable)
    limbs = []
    for s, a, b in usable:
        n = max(1, round(p1['branches'] * (b - a) * s.length / total))
        limbs += spawn(s, n, a, b, 1, p1, P, rng, L0, prune, clearance)
    stems += limbs
    # ---- level 2: branchlets (stems = 2Branches * (0.2 + 0.8 * (length_child / length_parent) / length_max))
    p2 = levels[1]
    twigs = []
    for s in limbs:
        lmax = p1['length'] + p1['length_v']
        ref = H if s.parent.level == 0 else s.parent.length
        n = max(1, round(p2['branches'] * (.2 + .8 * (s.length / ref) / lmax)))
        twigs += spawn(s, n, .25, .98, 2, p2, P, rng, L0, prune, clearance)
    stems += twigs
    cards = leaf_cards(kind, twigs, rng, clearance)
    return stems, cards


def spawn(parent, n, a, b, level, p, P, rng, L0, prune, clearance):
    """n children of a stem between the fractions a and b of its length (Weber & Penn child rules)."""
    out = []
    spin = rng.random() * 360.
    opposite = p.get('opposite', False)
    slots = []
    if opposite:
        pairs = max(1, (n + 1) // 2)
        for k in range(pairs):
            t = a + (b - a) * (k + .5 + (rng.random() - .5) * .5) / pairs
            spin += p['rotate'] + (rng.random() * 2. - 1.) * p['rotate_v']
            slots += [(t, spin), (t, spin + 180. + (rng.random() - .5) * 20.)]
        slots = slots[:max(n, 1)]
    else:
        for k in range(n):
            t = a + (b - a) * (k + .5 + (rng.random() - .5) * .7) / n
            spin += p['rotate'] + (rng.random() * 2. - 1.) * p['rotate_v']
            slots.append((t, spin))
    for t, angle in slots:
        t = min(b, max(a, t))
        point, frame, r_here = parent.at(t)
        offset_abs = parent.offset + t * parent.length          # metres of stem below this child (paper: offset)
        if level == 1:
            ratio = (L0 - offset_abs) / (L0 - prune)
            lmax = p['length'] + (rng.random() * 2. - 1.) * p['length_v']
            child_len = L0 * lmax * shape_ratio(P['shape'], ratio)
            parent_len = L0
        else:
            lmax = p['length'] + (rng.random() * 2. - 1.) * p['length_v']
            child_len = lmax * (parent.length - .6 * t * parent.length)
            parent_len = parent.length
        if child_len < 8.:
            continue
        if p['down_v'] >= 0.:
            down = p['down'] + (rng.random() * 2. - 1.) * p['down_v']
        else:
            base = prune if level == 1 else 0.
            span = (parent_len - base) if level == 1 else parent_len
            r = (parent_len - (offset_abs if level == 1 else t * parent.length)) / span if span > 0 else 0.
            down = p['down'] + p['down_v'] * (1. - 2. * shape_ratio(0, r)) + (rng.random() - .5) * 8.
        f = child_frame(frame, angle, down)
        r0 = parent.radius0 * (child_len / parent_len) ** P['ratio_power']
        r0 = max(MIN_RADIUS_CM, min(r0, .82 * r_here))
        # Start on the parent's axis, so the child grows out of the parent's surface.
        pts, frames = grow(level, point, f, child_len, None, p, rng, clearance)
        child = Stem(level, pts, frames, lambda tt, r0=r0: max(.12, r0 * (1. - tt)), parent=parent, offset=0.,
                     index=len(out))
        child.t = t                       # where it grows out of its parent (fraction of the parent's length)
        out.append(child)
        parent.children += 1
    return out


def leaf_cards(kind, twigs, rng, clearance):
    """Leaf cards along the last level (paper: leaves_per_branch = Leaves * ShapeRatio(4, offset / length_parent)),
    each kept with the kind's late-October retention."""
    L = SPECIES[kind]['leaves']
    cards = []
    for s in twigs:
        # Where the twig sits along its limb (0 at the limb base, 1 at its tip): outer twigs carry more cards.
        n = round(L['cards'] * shape_ratio(4, s.t))
        phi = rng.random() * 360.
        for j in range(n):
            keep = rng.random() < L['retention']
            t = .3 + .7 * (j + .3 + .5 * rng.random()) / max(1, n)
            phi += L['rotate'] + (rng.random() * 2. - 1.) * L['rotate_v']
            down = L['down'] + (rng.random() * 2. - 1.) * L['down_v']
            twist = (rng.random() * 2. - 1.) * L['twist_v']
            size = L['card_cm'] * (.85 + .3 * rng.random())
            pick = rng.random()
            if not keep:
                continue
            point, frame, r = s.at(t)
            d = child_frame(frame, phi, down)[2]
            base = add(point, mul(d, r * .8))
            if base[2] < clearance + 10.:
                continue
            cards.append({'base': base, 'dir': d, 'twist': twist, 'size': size, 'pick': pick})
    return cards


# ------------------------------------------------------------------------------------------------ atlas cells
# The leaf atlas: 4 x 4 cells of 256 px, each a twig with leaves seen face-on, base at the bottom centre. Colours
# are sRGB; 'stage' is how far the cell's leaves have turned (green 0 .. fully turned 1): the inner and lower
# cards of a crown take the greener cells more often, the outer and upper ones the turned cells.
ATLAS = {'name': 'TreeLeaves', 'key': 'tree_leaves', 'size_px': (1024, 1024), 'grid': 4, 'seed': 2611, 'pad_px': 10}
BARK = {'name': 'TreeBark', 'key': 'tree_bark', 'size_px': (512, 1024), 'tile_m': (1.0, 2.0), 'seed': 2612}
YELLOW = (226., 184., 46.)
GOLD = (232., 176., 34.)
ORANGE = (214., 116., 30.)
RED = (176., 46., 30.)
MAROON = (118., 44., 58.)
GREEN = (98., 124., 46.)
LIME = (166., 160., 48.)
PALE = (222., 202., 104.)
BROWN = (142., 98., 52.)
CELLS = {
    # name: (leaf form, leaves, palette [(weight, colour, edge colour, edge amount)], sparse twig, stage)
    'nm_yellow': ('norway', 9, [(.6, YELLOW, ORANGE, .2), (.25, GOLD, BROWN, .25), (.15, LIME, YELLOW, .4)], False, .9),
    'nm_mixed': ('norway', 9, [(.4, YELLOW, YELLOW, 0.), (.35, LIME, YELLOW, .45), (.25, GREEN, YELLOW, .5)], False, .5),
    'nm_green': ('norway', 8, [(.6, GREEN, LIME, .35), (.4, LIME, YELLOW, .4)], False, .15),
    'nm_sparse': ('norway', 3, [(.7, YELLOW, BROWN, .3), (.3, ORANGE, BROWN, .3)], True, 1.),
    'sm_yellow': ('silver', 9, [(.55, PALE, YELLOW, .3), (.3, YELLOW, ORANGE, .3), (.15, LIME, PALE, .3)], False, .8),
    'sm_orange': ('silver', 8, [(.45, ORANGE, RED, .35), (.3, YELLOW, ORANGE, .4), (.25, RED, MAROON, .2)], False, 1.),
    'li_yellow': ('linden', 10, [(.6, YELLOW, BROWN, .2), (.25, PALE, YELLOW, .2), (.15, LIME, YELLOW, .3)], False, .85),
    'li_mixed': ('linden', 9, [(.4, LIME, YELLOW, .4), (.3, YELLOW, BROWN, .3), (.15, GREEN, LIME, .3),
                               (.15, BROWN, BROWN, 0.)], False, .4),
    'as_yellow': ('ash', 3, [(.7, YELLOW, GOLD, .2), (.3, LIME, YELLOW, .4)], False, .8),
    'as_maroon': ('ash', 3, [(.55, MAROON, RED, .3), (.45, YELLOW, MAROON, .4)], False, 1.),
    'as_sparse': ('ash', 1, [(1., YELLOW, BROWN, .3)], True, 1.),
    'hl_gold': ('locust', 3, [(.75, GOLD, YELLOW, .1), (.25, YELLOW, LIME, .2)], False, .9),
    'hl_sparse': ('locust', 1, [(.7, GOLD, BROWN, .2), (.3, LIME, GOLD, .3)], True, .8),
    'sx_red': ('amur', 10, [(.55, RED, MAROON, .3), (.3, ORANGE, RED, .4), (.15, MAROON, RED, .2)], False, 1.),
    'sx_orange': ('amur', 10, [(.5, ORANGE, RED, .4), (.3, YELLOW, ORANGE, .5), (.2, GREEN, ORANGE, .5)], False, .6),
    'sm_sparse': ('silver', 3, [(.6, PALE, BROWN, .3), (.4, YELLOW, ORANGE, .3)], True, 1.),
}
CELL_ORDER = list(CELLS)
# Leaf forms: lobes (turn offset, length share, half-width share, teeth) drawn with plateau_textures.leaflet, and
# the leaf length as a share of the cell.
FORMS = {
    'norway': {'size': .2, 'lobes': [(-.24, .42, .27, 3), (.24, .42, .27, 3), (-.12, .8, .3, 3), (.12, .8, .3, 3),
                                     (0., .95, .3, 3)], 'petiole': .55, 'opposite': True},
    'silver': {'size': .2, 'lobes': [(-.23, .45, .16, 6), (.23, .45, .16, 6), (-.11, .85, .18, 7), (.11, .85, .18, 7),
                                     (0., 1., .17, 8)], 'petiole': .6, 'opposite': True},
    'amur': {'size': .19, 'lobes': [(-.1, .52, .2, 6), (.1, .52, .2, 6), (0., 1., .2, 9)], 'petiole': .35,
             'opposite': True},
    'linden': {'size': .19, 'cordate': True, 'petiole': .35, 'opposite': False},
    'ash': {'size': .5, 'pinnate': 3, 'petiole': .12, 'opposite': True},
    'locust': {'size': .46, 'bipinnate': 5, 'petiole': .08, 'opposite': False},
}


def cell_rect(index, grid=ATLAS['grid'], size=ATLAS['size_px'][0]):
    """Pixel rectangle (x0, y0, x1, y1) of a cell, row 0 at the top of the image."""
    c = size // grid
    row, col = divmod(index, grid)
    return col * c, row * c, (col + 1) * c, (row + 1) * c


def cell_uv(index, grid=ATLAS['grid'], size=ATLAS['size_px'][0], pad=ATLAS['pad_px']):
    """OBJ UV rectangle (u0, v0, u1, v1) inside the padding, v up (v0 is the cell's bottom edge, the twig base)."""
    x0, y0, x1, y1 = cell_rect(index, grid, size)
    return ((x0 + pad) / size, 1. - (y1 - pad) / size, (x1 - pad) / size, 1. - (y0 + pad) / size)


def _pick(palette, x):
    acc = 0.
    for entry in palette:
        acc += entry[0]
        if x < acc:
            return entry
    return palette[-1]


def _petiole(cv, x0, y0, x1, y1, radius, colour, z):
    steps = int(math.hypot(x1 - x0, y1 - y0) / .7) + 1
    for k in range(steps + 1):
        f = k / steps
        PT.disc(cv, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, radius, colour, z, .7)


def _turn(dx, dy):
    """plateau_textures turns of the image direction (dx, dy) (x right, y down)."""
    return (math.atan2(dy, dx) / math.tau) % 1.


def _leaf(cv, form, x, y, size, turn, colour, edge, amount, blotch, shade, z, u):
    F = FORMS[form]
    if 'lobes' in F:
        for offset, scale, width, teeth in F['lobes']:
            PT.leaflet(cv, x, y, turn + offset + (u - .5) * .02, size * scale, size * scale * width, z, colour, edge,
                       amount, blotch, teeth, .6, shade)
    elif F.get('cordate'):
        s, c = PT.sin_cos(turn)
        tip = (x + c * size, y + s * size)
        for side in (-1., 1.):
            PT.leaflet(cv, tip[0], tip[1], turn + .5 + side * .035, size * 1.04, size * .42, z, colour, edge, amount,
                       blotch, 14, .6, shade)
    elif F.get('pinnate'):
        s, c = PT.sin_cos(turn)
        rach = size
        _petiole(cv, x, y, x + c * rach, y + s * rach, .9, tuple(v * .75 for v in colour), z - .1)
        leaflet = size * .34
        PT.leaflet(cv, x + c * rach * .98, y + s * rach * .98, turn, leaflet, leaflet * .22, z, colour, edge, amount,
                   blotch, 8, .6, shade)
        for k in range(F['pinnate']):
            f = .32 + .22 * k
            for side in (-1., 1.):
                PT.leaflet(cv, x + c * rach * f, y + s * rach * f, turn + side * .16, leaflet * (.82 + .06 * k),
                           leaflet * .2, z, colour, edge, amount, blotch, 8, .6, shade)
    elif F.get('bipinnate'):
        s, c = PT.sin_cos(turn)
        rach = size
        _petiole(cv, x, y, x + c * rach, y + s * rach, .7, tuple(v * .7 for v in colour), z - .1)
        for k in range(F['bipinnate']):
            f = .2 + .17 * k
            px, py = x + c * rach * f, y + s * rach * f
            for side in (-1., 1.):
                pt = turn + side * .19
                ps, pc = PT.sin_cos(pt)
                pin = rach * (.36 - .03 * k)
                _petiole(cv, px, py, px + pc * pin, py + ps * pin, .45, tuple(v * .7 for v in colour), z - .1)
                n = 7
                for m in range(n):
                    g = .18 + .8 * m / n
                    for side2 in (-1., 1.):
                        PT.leaflet(cv, px + pc * pin * g, py + ps * pin * g, pt + side2 * .21, size * .09,
                                   size * .09 * .38, z, colour, edge, amount, blotch, 0, .6, shade, lift=.08)


CELL_MARGIN = 64        # each cell is painted on its own canvas this much larger on every side, then cropped


def paint_cell(cv, index, blotch):
    """One cluster on a cell canvas: a twig from the bottom centre with leaves (opposite pairs or alternate)."""
    name = CELL_ORDER[index]
    form, count, palette, sparse, _ = CELLS[name]
    F = FORMS[form]
    S = ATLAS['size_px'][0] // ATLAS['grid']
    x0 = y0 = CELL_MARGIN
    x1 = y1 = CELL_MARGIN + S
    pad = ATLAS['pad_px']
    rng = random.Random(ATLAS['seed'] * 100 + index)
    twig_colour = (92., 70., 52.)
    bx, by = x0 + S * .5, y1 - pad - 2
    top_x = x0 + S * (.5 + (rng.random() - .5) * .16)
    top_y = y0 + pad + S * (.42 if F['size'] > .4 else .3)
    nodes = []
    # The twig: a gently bowed line, thinning toward the tip; sparse cards fork once or twice.
    segs = 24
    pts = []
    bow = (rng.random() - .5) * S * .12
    for k in range(segs + 1):
        f = k / segs
        pts.append((bx + (top_x - bx) * f + math.sin(math.pi * f) * bow, by + (top_y - by) * f))
    for k in range(segs):
        r = 2.6 - 1.6 * k / segs
        _petiole(cv, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], r, twig_colour, .2)
    forks = []
    if sparse:
        for k, side in ((9, -1.), (15, 1.)):
            fx, fy = pts[k]
            ex, ey = fx + side * S * .2, fy - S * .16
            _petiole(cv, fx, fy, ex, ey, 1.3, twig_colour, .2)
            forks.append((fx, fy, ex, ey))
    size = S * F['size']
    if F.get('pinnate') or F.get('bipinnate'):
        positions = [(k, side) for k, side in ((segs, 0.), (int(segs * .62), -1.), (int(segs * .62), 1.))][:count]
    elif F['opposite']:
        positions = [(segs, 0.)]
        k = segs - 4
        while len(positions) < count and k > 4:
            positions += [(k, -1.), (k, 1.)]
            k -= 5
        positions = positions[:count]
    else:
        positions = [(segs, 0.)]
        k, side = segs - 3, -1.
        while len(positions) < count and k > 3:
            positions.append((k, side))
            side, k = -side, k - 3
    leaves = []
    for k, side in positions:
        px, py = pts[min(k, segs)]
        if sparse and forks and side:
            fx, fy, ex, ey = forks[0 if side < 0 else -1]
            px, py = ex, ey
        tx, ty = pts[min(segs, k + 1)][0] - pts[max(0, k - 1)][0], pts[min(segs, k + 1)][1] - pts[max(0, k - 1)][1]
        base_turn = _turn(tx, ty)
        turn = base_turn + side * (.12 + .08 * rng.random()) + (rng.random() - .5) * .04
        leaves.append((rng.random(), px, py, turn, rng.random(), rng.random(), rng.random()))
    leaves.sort(key=lambda r: (r[0], r[1]))
    for z, px, py, turn, u1, u2, u3 in leaves:
        entry = _pick(palette, u1)
        _, colour, edge, amount = entry
        tone = .9 + .2 * u2
        colour = tuple(min(255., c * tone) for c in colour)
        s, c = PT.sin_cos(turn)
        stalk = size * F['petiole']
        lx, ly = px + c * stalk, py + s * stalk
        lsize = size * (.82 + .3 * u3)
        # Keep the leaf inside the cell padding.
        reach = lsize * (1.15 if 'lobes' in FORMS[form] else 1.)
        lx = min(x1 - pad - reach * .55, max(x0 + pad + reach * .55, lx))
        ly = min(y1 - pad - reach * .5, max(y0 + pad + reach * .9, ly))
        _petiole(cv, px, py, lx, ly, .8, tuple(v * .7 for v in colour), .3 + z)
        shade = .78 + .22 * z
        _leaf(cv, form, lx, ly, lsize, turn, colour, edge, amount * (.6 + .8 * u2), blotch, shade, 1. + z, u3)


def atlas_maps():
    """The leaf atlas canvas result (diff RGBA rows, heights, roughness, cavity) and per-cell statistics."""
    W, H = ATLAS['size_px']
    S = W // ATLAS['grid']
    C = S + 2 * CELL_MARGIN
    pad = ATLAS['pad_px']
    cv = PT.Canvas(W, H, (196., 146., 60.), 0., .7, alpha=0.)
    blotch = PT.field(PT.Fbm(ATLAS['seed'] + 1, C, C, ((12, 12), (24, 24), (48, 48)), (.5, .3, .2)), C)
    for index in range(len(CELL_ORDER)):
        cell = PT.Canvas(C, C, (196., 146., 60.), 0., .7, alpha=0.)
        paint_cell(cell, index, blotch)
        x0, y0, _, _ = cell_rect(index)
        for y in range(S):
            src = (y + CELL_MARGIN) * C + CELL_MARGIN
            dst = (y0 + y) * W + x0
            fy = min(y, S - 1 - y)
            for x in range(S):
                fade = PT.smooth(1., pad - 2., min(fy, x, S - 1 - x))
                i, j = dst + x, src + x
                cv.r[i], cv.g[i], cv.b[i] = cell.r[j], cell.g[j], cell.b[j]
                cv.height[i], cv.rough[i], cv.cavity[i] = cell.height[j], cell.rough[j], cell.cavity[j]
                cv.alpha[i] = cell.alpha[j] * fade
    # Edge padding: transparent texels take their cell's mean leaf colour, so mips and bilinear filtering never
    # pull a halo of another colour into the cut-out edge.
    stats = {}
    for index, name in enumerate(CELL_ORDER):
        x0, y0, x1, y1 = cell_rect(index)
        sr = sg = sb = n = 0.
        for y in range(y0, y1):
            o = y * W
            for x in range(x0, x1):
                i = o + x
                if cv.alpha[i] >= .5:
                    sr, sg, sb, n = sr + cv.r[i], sg + cv.g[i], sb + cv.b[i], n + 1
        mean = (sr / n, sg / n, sb / n)
        for y in range(y0, y1):
            o = y * W
            for x in range(x0, x1):
                i = o + x
                if cv.alpha[i] < .02:
                    cv.r[i], cv.g[i], cv.b[i] = mean
                    cv.height[i] = 0.
        stats[name] = {'cover': round(n / ((x1 - x0) * (y1 - y0)), 4), 'mean_srgb': [round(v, 1) for v in mean]}
    px = W / ATLAS['grid'] / 60.    # nominal: a 60 cm card over a 256 px cell
    return cv.result(px, px, {'cells': CELL_ORDER, 'grid': ATLAS['grid'], 'pad_px': ATLAS['pad_px'],
                              'cell_stats': stats}, wrap_y=False)


def bark_maps():
    """Bark: vertically stretched Worley plates (F2 - F1 furrows), fibrous striations and lichen patches."""
    W, H = BARK['size_px']
    seed = BARK['seed']
    px = W / (BARK['tile_m'][0] * 100.)
    stretch = 4
    ids, border, _ = PT.cells(seed, W, H // stretch, 9. * px, .9)
    fine = PT.noise1d(seed + 5, W, 96)
    fbm = PT.field(PT.Fbm(seed + 7, W, H, ((8, 16), (16, 32), (64, 128)), (.5, .3, .2)), H)
    lichen = PT.field(PT.Fbm(seed + 9, W, H, ((4, 8), (8, 16)), (.6, .4)), H)
    cv = PT.Canvas(W, H, (110., 100., 90.), 0., .85)
    h2 = H // stretch
    for y in range(H):
        t = (y + .5) / stretch - .5
        j0 = math.floor(t)
        f = t - j0
        r0, r1 = (j0 % h2) * W, ((j0 + 1) % h2) * W
        for x in range(W):
            i = y * W + x
            b = border[r0 + x] * (1. - f) + border[r1 + x] * f
            cell = ids[r0 + x] if f < .5 else ids[r1 + x]
            tone = .86 + .28 * PT.unit(seed, 77, cell)
            plate = PT.smooth(0., 7., b)
            stri = fine[x]
            hgt = 1.4 * plate + .35 * stri * plate + .3 * fbm[i]
            k = tone * (.9 + .2 * fbm[i]) * (.92 + .16 * stri)
            cr, cg, cb = 128. * k, 118. * k, 106. * k
            furrow = (52., 45., 40.)
            cr, cg, cb = furrow[0] + (cr - furrow[0]) * plate, furrow[1] + (cg - furrow[1]) * plate, \
                furrow[2] + (cb - furrow[2]) * plate
            moss = PT.smooth(.62, .74, lichen[i]) * plate * .55
            cr, cg, cb = cr + (126. - cr) * moss, cg + (134. - cg) * moss, cb + (108. - cb) * moss
            cv.r[i], cv.g[i], cv.b[i] = cr, cg, cb
            cv.height[i] = hgt
            cv.rough[i] = .97 - .12 * plate
            cv.cavity[i] = 1. - PT.smooth(0., 4., b)
    return cv.result(px, px, {'plates_cm': [9., 36.], 'stretch': stretch, 'furrow': 'Worley F2 - F1 < 1.4 cm'})


def texture_set(spec, g, surface, uv, tile_m, keys):
    """{file: png bytes} and an index entry in the textures.json set format (plateau_textures.build)."""
    width, height = spec['size_px']
    channels = g['channels']
    px_x, px_y = g['px']
    maps = {'diff': g['diff'], 'nor_dx': PT.normal_rows(g['heights'], px_x, px_y, g['wrap_y']),
            'rough': PT.mask_rows(g['rough'], g['heights'], g['cavity'])}
    alpha = [r[3::4] for r in g['diff']] if channels == 4 else None
    mean = PT.linear_mean(g['diff'], channels)
    entry = {'name': spec['name'], 'size_px': [width, height], 'tile_m': list(tile_m),
             'tiling': [round(1 / tile_m[0], 6), round(1 / tile_m[1], 6)], 'mean_linear': mean,
             'roughness_mean': round(PT.channel_mean(maps['rough'], 0, alpha), 4), 'layout': g['layout'], 'maps': {},
             'surface': surface, 'material': dict(PT.SURFACES[surface]), 'keys': list(keys), 'uv': uv,
             'alpha': channels == 4, 'base_color_srgb': PT.to_srgb_hex(mean)}
    if alpha is not None:
        entry['coverage'] = round(sum(sum(1 for v in a if v >= 128) for a in alpha) / (width * height), 4)
    files = {}
    for role in PT.ROLES:
        raw = PT.raw_stream(maps[role])
        data = PT.png(width, height, raw, channels if role == 'diff' else 3)
        name = f'T_Replica_{spec["name"]}_{role}.png'
        files[name] = data
        entry['maps'][role] = {'file': name, **PT.IMPORT[role], 'sha256': hashlib.sha256(data).hexdigest(),
                               'raw_sha256': hashlib.sha256(raw).hexdigest()}
        if role == 'diff' and channels == 4:
            entry['maps'][role]['alpha'] = True
    return files, entry


def build_textures():
    bark_keys = [bark_key(k) for k in KINDS]
    leaf_files, leaf_entry = texture_set(ATLAS, atlas_maps(), 'foliage', 'atlas', (1., 1.), [LEAF_KEY])
    leaf_entry['uv_note'] = 'OBJ UVs address the atlas directly (0..1, v up); tiling 1'
    bark_files, bark_entry = texture_set(BARK, bark_maps(), 'wall', 'metres', BARK['tile_m'], bark_keys)
    bark_entry['uv_note'] = 'u metres around the stem in whole tiles, v metres along it'
    return {**leaf_files, **bark_files}, {ATLAS['key']: leaf_entry, BARK['key']: bark_entry}


def bark_key(kind):
    return 'Bark_' + ''.join(w.capitalize() for w in kind.split('_'))


# ------------------------------------------------------------------------------------------------ mesh


class Mesh:
    def __init__(self):
        self.v, self.vt, self.vn = [], [], []
        self.faces = {'bark': [], 'leaves': []}

    def vert(self, p):
        self.v.append(p)
        return len(self.v) - 1

    def uv(self, u, v):
        self.vt.append((u, v))
        return len(self.vt) - 1

    def normal(self, n):
        self.vn.append(n)
        return len(self.vn) - 1


def sides_for(stem, P):
    if stem.level == 0:
        return P['trunk']['sides']
    s = P['levels'][stem.level - 1]['sides']
    if stem.radius0 < 1.:
        return min(s, 3)
    if stem.radius0 < 2.5:
        return min(s, 4)
    return s


def add_stem(mesh, stem, sides, tile_u, v_offset):
    """A tube along the stem: one ring per point, closed by a tip vertex; metre UVs in whole bark tiles."""
    n = len(stem.points)
    circ_m = math.tau * stem.radius0 / 100.
    reps = max(1, round(circ_m / tile_u))
    rings, uvs, normals = [], [], []
    for i in range(n):
        x, y, z = stem.ring_frame(i)
        r = stem.radius(stem.cum[i] / stem.length if stem.length else 0.)
        ring, nring = [], []
        for k in range(sides):
            a = math.tau * k / sides
            d = add(mul(x, math.cos(a)), mul(y, math.sin(a)))
            ring.append(mesh.vert(add(stem.points[i], mul(d, r))))
            nring.append(mesh.normal(d))
        v = v_offset + stem.cum[i] / 100.
        uvs.append([mesh.uv(reps * tile_u * k / sides, v) for k in range(sides + 1)])
        rings.append(ring)
        normals.append(nring)
    faces = mesh.faces['bark']
    for i in range(len(rings) - 1):
        A, B, NA, NB, UA, UB = rings[i], rings[i + 1], normals[i], normals[i + 1], uvs[i], uvs[i + 1]
        for k in range(sides):
            k2 = (k + 1) % sides
            a, b, c, d = (A[k], UA[k], NA[k]), (A[k2], UA[k + 1], NA[k2]), (B[k2], UB[k + 1], NB[k2]), (B[k], UB[k], NB[k])
            faces.append((a, b, c))
            faces.append((a, c, d))
    # Tip: a short cone beyond the last ring (a full-width cap where the trunk splits into leaders).
    tz = stem.frames[-1][2]
    r_end = stem.radius(1.)
    tip = mesh.vert(add(stem.points[-1], mul(tz, max(.3, r_end * .7))))
    tn = mesh.normal(tz)
    tuv = mesh.uv(reps * tile_u * .5, v_offset + (stem.length + max(.3, r_end * .7)) / 100.)
    A, NA, UA = rings[-1], normals[-1], uvs[-1]
    for k in range(sides):
        k2 = (k + 1) % sides
        faces.append(((A[k], UA[k], NA[k]), (A[k2], UA[k + 1], NA[k2]), (tip, tuv, tn)))


def crown_ellipsoid(cards):
    xs = [c['base'][0] for c in cards]
    ys = [c['base'][1] for c in cards]
    zs = [c['base'][2] for c in cards]
    centre = ((min(xs) + max(xs)) / 2., (min(ys) + max(ys)) / 2., (min(zs) + max(zs)) / 2.)
    radii = (max(50., (max(xs) - min(xs)) / 2.), max(50., (max(ys) - min(ys)) / 2.), max(50., (max(zs) - min(zs)) / 2.))
    return centre, radii


def ellipsoid_normal(p, centre, radii):
    q = sub(p, centre)
    return norm((q[0] / radii[0] ** 2, q[1] / radii[1] ** 2, q[2] / radii[2] ** 2))


def choose_cell(kind, card, centre, radii):
    """A weighted cell pick: exposed (outer, upper) cards favour turned cells, sheltered ones greener cells."""
    weights = SPECIES[kind]['leaves']['cells']
    q = sub(card['base'], centre)
    e = math.sqrt((q[0] / radii[0]) ** 2 + (q[1] / radii[1]) ** 2 + (q[2] / radii[2]) ** 2)
    exposure = min(1., max(0., .55 * min(1., e) + .45 * (q[2] / radii[2] * .5 + .5)))
    table = []
    for name, w in weights.items():
        stage = CELLS[name][4]
        table.append((name, w * ((.5 + exposure) if stage >= .5 else (1.5 - exposure))))
    total = sum(w for _, w in table)
    x, acc = card['pick'] * total, 0.
    for name, w in table:
        acc += w
        if x < acc:
            return name
    return table[-1][0]


def add_card(mesh, card, cell_index, centre, radii):
    """A folded cluster card: 2 rows x 3 columns, 4 triangles, the front facing out of the crown."""
    d, size, b = card['dir'], card['size'], card['base']
    n0 = sub(UP, mul(d, dot(UP, d)))
    if length(n0) < 1e-3:
        n0 = cross(d, (1., 0., 0.))
    n0 = rotate(norm(n0), d, math.radians(card['twist']))
    radial = ellipsoid_normal(add(b, mul(d, size * .5)), centre, radii)
    if dot(n0, radial) < 0.:
        n0 = mul(n0, -1.)
    w = norm(cross(d, n0))
    half = size * .5
    fold = mul(n0, size * FOLD)
    pts = [add(b, mul(w, -half * .8)), add(b, mul(fold, .3)), add(b, mul(w, half * .8)),
           add(add(b, mul(d, size)), mul(w, -half)), add(add(b, mul(d, size)), fold), add(add(b, mul(d, size)), mul(w, half))]
    u0, v0, u1, v1 = cell_uv(cell_index)
    um = (u0 + u1) * .5
    du = (u1 - u0) * .5
    uvs = [(um - du * .8, v0), (um, v0), (um + du * .8, v0), (u0, v1), (um, v1), (u1, v1)]
    ids = []
    for p, (u, v) in zip(pts, uvs):
        nrm = norm(lerp(n0, ellipsoid_normal(p, centre, radii), PUFFINESS))
        if nrm[2] < MIN_NORMAL_Z:
            nrm = norm((nrm[0], nrm[1], MIN_NORMAL_Z))
        ids.append((mesh.vert(p), mesh.uv(u, v), mesh.normal(nrm)))
    f = mesh.faces['leaves']
    # (b0, b1, t1, t0) runs counter-clockwise about +n0: (b1 - b0) is +w, (t0 - b0) is +d and w x d = n0.
    for a, bb, c, dd in ((0, 1, 4, 3), (1, 2, 5, 4)):
        f.append((ids[a], ids[bb], ids[c]))
        f.append((ids[a], ids[c], ids[dd]))
    return n0


def build_kind(kind):
    """Mesh and statistics of one kind."""
    P = SPECIES[kind]
    stems, cards = generate(kind)
    mesh = Mesh()
    rng = random.Random(P['seed'] + 99)
    for stem in stems:
        add_stem(mesh, stem, sides_for(stem, P), BARK['tile_m'][0], round(rng.random() * 2., 3))
    centre, radii = crown_ellipsoid(cards)
    usage = {}
    outward = 0
    for card in cards:
        name = choose_cell(kind, card, centre, radii)
        usage[name] = usage.get(name, 0) + 1
        n0 = add_card(mesh, card, CELL_ORDER.index(name), centre, radii)
        outward += dot(n0, ellipsoid_normal(card['base'], centre, radii)) >= 0.
    bark_v = {i for face in mesh.faces['bark'] for i, _, _ in face}
    leaf_v = {i for face in mesh.faces['leaves'] for i, _, _ in face}
    zs = [mesh.v[i][2] for i in leaf_v]
    limbs = [s for s in stems if s.level == 1]
    stats = {'stems': [sum(1 for s in stems if s.level == lv) for lv in range(3)], 'cards': len(cards),
             'cell_usage': dict(sorted(usage.items())), 'outward_cards': outward,
             'crown_base_cm': round(min(zs), 1), 'clear_trunk_cm': round(min(s.points[0][2] for s in limbs), 1),
             'crown_centre_cm': [round(c, 1) for c in centre], 'crown_radii_cm': [round(r, 1) for r in radii],
             'bark_vertices': len(bark_v), 'leaf_vertices': len(leaf_v)}
    return mesh, stems, stats


def _fmt(x, digits):
    s = f'{x:.{digits}f}'
    return '0.' + '0' * digits if s.lstrip('-').strip('0.') == '' else s


def write_obj(path, kind, mesh):
    """Triangles per material group; v, vt and vn deduplicated by their printed form, so the file is stable."""
    lines = [f'# {GENERATOR}: {SPECIES[kind]["name"]}', f'o SM_Tree_{kind}']
    vmap, vtmap, vnmap = {}, {}, {}
    vl, vtl, vnl = [], [], []

    def ref(table, out, key):
        if key not in table:
            table[key] = len(out) + 1
            out.append(key)
        return table[key]
    body = []
    counts = {}
    for slot in ('bark', 'leaves'):
        body.append(f'usemtl {kind}_{slot}')
        counts[slot] = len(mesh.faces[slot])
        for face in mesh.faces[slot]:
            refs = []
            for vi, ti, ni in face:
                p, t, n = mesh.v[vi], mesh.vt[ti], mesh.vn[ni]
                a = ref(vmap, vl, f'v {_fmt(p[0], 2)} {_fmt(p[1], 2)} {_fmt(p[2], 2)}')
                b = ref(vtmap, vtl, f'vt {_fmt(t[0], 4)} {_fmt(t[1], 4)}')
                c = ref(vnmap, vnl, f'vn {_fmt(n[0], 4)} {_fmt(n[1], 4)} {_fmt(n[2], 4)}')
                refs.append(f'{a}/{b}/{c}')
            body.append('f ' + ' '.join(refs))
    data = '\n'.join(lines + vl + vtl + vnl + body) + '\n'
    path.write_bytes(data.encode())
    verts = [tuple(float(c) for c in s.split()[1:]) for s in vl]
    return hashlib.sha256(data.encode()).hexdigest(), counts, verts


def trunk_dbh(stems):
    """Diameter of the trunk mesh at 1.3 m, from its ring radius (the trunk has a ring at 130 cm)."""
    trunk = stems[0]
    i = min(range(len(trunk.points)), key=lambda k: abs(trunk.points[k][2] - 130.))
    return 2. * trunk.radius(trunk.cum[i] / trunk.length)


def build(out_dir, textures=True):
    """Write every kind's OBJ, the textures and the manifest; return the manifest."""
    out_dir.mkdir(parents=True, exist_ok=True)
    tex_files, sets = build_textures() if textures else ({}, {})
    for name, data in sorted(tex_files.items()):
        (out_dir / name).write_bytes(data)
    leaf_entry = sets.get(ATLAS['key'])
    materials = {}
    kinds = {}
    for kind in KINDS:
        P = SPECIES[kind]
        mesh, stems, stats = build_kind(kind)
        file_name = f'Tree_{kind}.obj'
        digest, counts, verts = write_obj(out_dir / file_name, kind, mesh)
        height = max(v[2] for v in verts)
        xs, ys = [v[0] for v in verts], [v[1] for v in verts]
        bounds = [round(min(xs), 1), round(-max(ys), 1), round(min(v[2] for v in verts), 1), round(max(xs), 1),
                  round(-min(ys), 1), round(height, 1)]
        bk = bark_key(kind)
        materials[bk] = {'base_color_srgb': P['bark']['colour'], 'roughness': .92, 'metallic': 0.,
                         'texture': f'{LAYER}/T_Replica_{BARK["name"]}_diff.png', 'note': P['bark']['note']}
        tris = {'bark': counts['bark'], 'leaves': counts['leaves'], 'total': counts['bark'] + counts['leaves']}
        kinds[kind] = {
            'name': P['name'], 'obj': file_name, 'sha256': digest,
            'materials': {'bark': bk, 'leaves': LEAF_KEY},
            'slots': {'bark': f'{kind}_bark', 'leaves': f'{kind}_leaves'},
            'height_cm': round(height, 1), 'trunk_cm': round(trunk_dbh(stems), 1),
            'crown_width_cm': round(max(bounds[3] - bounds[0], bounds[4] - bounds[1]), 1),
            'crown_base_cm': stats['crown_base_cm'], 'clear_trunk_cm': stats['clear_trunk_cm'],
            'prune_cm': P['prune_cm'], 'leaf_retention': P['leaves']['retention'], 'triangles': tris,
            'triangle_target': TRIANGLE_TARGET['small' if kind == 'small' else 'mature'],
            'bounds_cm': bounds, 'seed': P['seed'], 'stems_per_level': stats['stems'], 'cards': stats['cards'],
            'outward_cards': stats['outward_cards'], 'cell_usage': stats['cell_usage'],
            'crown_centre_cm': stats['crown_centre_cm'], 'crown_radii_cm': stats['crown_radii_cm'],
            'weber_penn': {k: P[k] for k in ('shape', 'flare', 'ratio_power')} | {'trunk': P['trunk'],
                                                                                  'levels': P['levels'],
                                                                                  'leaves': P['leaves']},
        }
    leaves_spec = {'base_color_srgb': leaf_entry['base_color_srgb'] if leaf_entry else '#C8902E', 'roughness': .6,
                   'metallic': 0., 'texture': f'{LAYER}/T_Replica_{ATLAS["name"]}_diff.png', 'foliage': True,
                   'note': 'one autumn atlas for every kind; masked (clip .5), two-sided foliage'}
    materials[LEAF_KEY] = leaves_spec
    manifest = {
        'layer': LAYER, 'generator': GENERATOR,
        'frame': 'tree-local: x east, y north, z up, cm; pivot at the trunk base. OBJ stores (x, y, z) as authored '
                 '(the plateau_props.py convention); bounds_cm are Unreal-local (x, -y, z)',
        'unreal_destination': '/Game/Plateau/Replica/Trees',
        'technique': {
            'branching': 'Weber & Penn, "Creation and Rendering of Realistic Trees", SIGGRAPH 1995 (the model of '
                         'Blender\'s Sapling add-on; recursion written here because Sapling is not bundled)',
            'leaves': 'alpha-masked leaf cluster cards from an atlas (SpeedTree-style leaf cards), normals bent to '
                      'the crown ellipsoid (SpeedTree leaf puffiness) and clamped from pointing down',
            'textures': 'Scripts/plateau_textures.py primitives: signed-distance serrated leaflets, Worley bark plates',
        },
        'aliases': ALIASES,
        'materials': materials,
        'texture_sets': sets,
        'atlas_cells': {name: {'index': i, 'uv': [round(c, 6) for c in cell_uv(i)], 'form': CELLS[name][0],
                               'stage': CELLS[name][4], 'sparse': CELLS[name][3]} for i, name in enumerate(CELL_ORDER)},
        'kinds': kinds,
        'counts': {'kinds': len(kinds), 'triangles': {k: v['triangles']['total'] for k, v in kinds.items()},
                   'textures': len(tex_files)},
        'source_sha256': {GENERATOR: hashlib.sha256((ROOT / GENERATOR).read_bytes()).hexdigest(),
                          'Scripts/plateau_textures.py': hashlib.sha256((ROOT / 'Scripts/plateau_textures.py')
                                                                        .read_bytes()).hexdigest()},
    }
    text = json.dumps(manifest, indent=1, ensure_ascii=False) + '\n'
    (out_dir / 'manifest.json').write_text(text)
    return manifest


# ------------------------------------------------------------------------------------------------ contact sheet


def read_obj(path):
    """(positions, uvs, normals, {slot: [((vi, ti, ni) x 3)]}) of an OBJ written by write_obj."""
    v, vt, vn, faces, slot = [], [], [], {}, None
    for line in path.read_text().splitlines():
        tag, _, rest = line.partition(' ')
        if tag == 'v':
            v.append(tuple(float(c) for c in rest.split()))
        elif tag == 'vt':
            vt.append(tuple(float(c) for c in rest.split()))
        elif tag == 'vn':
            vn.append(tuple(float(c) for c in rest.split()))
        elif tag == 'usemtl':
            slot = 'leaves' if rest.endswith('_leaves') else 'bark'
            faces.setdefault(slot, [])
        elif tag == 'f':
            faces[slot].append(tuple(tuple(int(i) - 1 for i in tok.split('/')) for tok in rest.split()))
    return v, vt, vn, faces


def render_sheet(out_dir, manifest, sheet_path):  # pragma: no cover - needs bpy
    import bpy
    from mathutils import Euler, Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.cycles.transparent_max_bounces = 32
    scene.cycles.max_bounces = 6
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (.5, .6, .75, 1)
    bg.inputs['Strength'].default_value = .8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.4
    sun.data.angle = math.radians(3)
    sun.rotation_euler = Euler((math.radians(62), 0, math.radians(-40)), 'XYZ')   # a low October sun
    scene.collection.objects.link(sun)
    ground = bpy.data.meshes.new('ground')
    ground.from_pydata([(-200, -200, 0), (200, -200, 0), (200, 200, 0), (-200, 200, 0)], [], [(0, 1, 2, 3)])
    gmat = bpy.data.materials.new('ground')
    gmat.use_nodes = True
    gmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.3, .3, .29, 1)
    ground.materials.append(gmat)
    scene.collection.objects.link(bpy.data.objects.new('ground', ground))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam

    def image(name):
        img = bpy.data.images.load(str(out_dir / name))
        return img

    def srgb_lin(c):
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

    sets = manifest['texture_sets']
    leaf_set, bark_set = sets[ATLAS['key']], sets[BARK['key']]

    def normal_dx(nt, tex):
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
        inv = nt.nodes.new('ShaderNodeMath')
        inv.operation = 'SUBTRACT'
        inv.inputs[0].default_value = 1.
        nt.links.new(sep.outputs[1], inv.inputs[1])
        comb = nt.nodes.new('ShaderNodeCombineColor')
        nt.links.new(sep.outputs[0], comb.inputs[0])
        nt.links.new(inv.outputs[0], comb.inputs[1])
        nt.links.new(sep.outputs[2], comb.inputs[2])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(comb.outputs['Color'], nm.inputs['Color'])
        return nm

    def bark_material(key):
        spec = manifest['materials'][key]
        mat = bpy.data.materials.new(key)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes['Principled BSDF']
        coords = nt.nodes.new('ShaderNodeMapping')
        uvn = nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(uvn.outputs['UV'], coords.inputs['Vector'])
        coords.inputs['Scale'].default_value = (bark_set['tiling'][0], bark_set['tiling'][1], 1)
        texs = {}
        for role in PT.ROLES:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(bark_set['maps'][role]['file'])
            if role != 'diff':
                t.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(coords.outputs['Vector'], t.inputs['Vector'])
            texs[role] = t
        hexcol = spec['base_color_srgb']
        target = [srgb_lin(int(hexcol[i:i + 2], 16) / 255) for i in (1, 3, 5)]
        tint = [min(8., c / m) for c, m in zip(target, bark_set['mean_linear'])]
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.
        nt.links.new(texs['diff'].outputs['Color'], mix.inputs['A'])
        mix.inputs['B'].default_value = (*tint, 1)
        nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(texs['rough'].outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs[0], bsdf.inputs['Roughness'])
        nt.links.new(normal_dx(nt, texs['nor_dx']).outputs['Normal'], bsdf.inputs['Normal'])
        return mat

    def leaf_material():
        mat = bpy.data.materials.new(LEAF_KEY)
        mat.use_nodes = True
        nt = mat.node_tree
        out = nt.nodes['Material Output']
        bsdf = nt.nodes['Principled BSDF']
        texs = {}
        for role in PT.ROLES:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(leaf_set['maps'][role]['file'])
            t.interpolation = 'Linear'
            if role == 'diff':
                t.image.alpha_mode = 'CHANNEL_PACKED'
            else:
                t.image.colorspace_settings.name = 'Non-Color'
            texs[role] = t
        nt.links.new(texs['diff'].outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = .6
        nt.links.new(normal_dx(nt, texs['nor_dx']).outputs['Normal'], bsdf.inputs['Normal'])
        trans = nt.nodes.new('ShaderNodeBsdfTranslucent')
        dim = nt.nodes.new('ShaderNodeMix')
        dim.data_type = 'RGBA'
        dim.blend_type = 'MULTIPLY'
        dim.inputs['Factor'].default_value = 1.
        nt.links.new(texs['diff'].outputs['Color'], dim.inputs['A'])
        dim.inputs['B'].default_value = (.65, .65, .65, 1)
        nt.links.new(dim.outputs['Result'], trans.inputs['Color'])
        foliage = nt.nodes.new('ShaderNodeMixShader')
        foliage.inputs['Fac'].default_value = .3
        nt.links.new(bsdf.outputs['BSDF'], foliage.inputs[1])
        nt.links.new(trans.outputs['BSDF'], foliage.inputs[2])
        clip = nt.nodes.new('ShaderNodeMath')
        clip.operation = 'GREATER_THAN'
        clip.inputs[1].default_value = .5
        nt.links.new(texs['diff'].outputs['Alpha'], clip.inputs[0])
        cut = nt.nodes.new('ShaderNodeMixShader')
        hole = nt.nodes.new('ShaderNodeBsdfTransparent')
        nt.links.new(clip.outputs[0], cut.inputs['Fac'])
        nt.links.new(hole.outputs['BSDF'], cut.inputs[1])
        nt.links.new(foliage.outputs['Shader'], cut.inputs[2])
        nt.links.new(cut.outputs['Shader'], out.inputs['Surface'])
        return mat

    leaf_mat = leaf_material()
    bark_mats = {k: bark_material(manifest['kinds'][k]['materials']['bark']) for k in KINDS}
    data = {k: read_obj(out_dir / manifest['kinds'][k]['obj']) for k in KINDS}

    def tree_object(kind, coll, loc=(0, 0, 0), yaw=0.):
        v, vt, vn, faces = data[kind]
        objs = []
        for slot in ('bark', 'leaves'):
            tris = faces[slot]
            mesh = bpy.data.meshes.new(f'{kind}_{slot}')
            mesh.from_pydata([(x / 100, y / 100, z / 100) for x, y, z in v], [], [tuple(c[0] for c in f) for f in tris])
            uv = mesh.uv_layers.new(name='UVMap')
            loops = [vt[c[1]] for f in tris for c in f]
            uv.data.foreach_set('uv', [x for p in loops for x in p])
            mesh.normals_split_custom_set([vn[c[2]] for f in tris for c in f])
            mesh.materials.append(leaf_mat if slot == 'leaves' else bark_mats[kind])
            obj = bpy.data.objects.new(f'{kind}_{slot}', mesh)
            obj.location = loc
            obj.rotation_euler = (0, 0, math.radians(yaw))
            coll.objects.link(obj)
            objs.append(obj)
        return objs

    def label(text):
        curve = bpy.data.curves.new('label', 'FONT')
        curve.body = text
        curve.align_x = 'CENTER'
        curve.size = .036
        obj = bpy.data.objects.new('label', curve)
        m = bpy.data.materials.new('label')
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0, 0, 0, 1)
        obj.data.materials.append(m)
        scene.collection.objects.link(obj)
        obj.parent = cam
        obj.location = (0, -.33, -1.0)
        obj.visible_shadow = False
        return obj

    def aim(target, distance, azimuth, elevation):
        az, el = math.radians(azimuth), math.radians(elevation)
        back = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        cam.location = Vector(target) + back * distance
        cam.rotation_euler = (-back).to_track_quat('-Z', 'Y').to_euler()

    import numpy as np
    tw, th, cols, rows = 400, 500, 4, 2
    scene.render.resolution_x, scene.render.resolution_y = tw, th
    scene.render.resolution_percentage = 100
    tiles = []
    for kind in KINDS:
        k = manifest['kinds'][kind]
        text = (f'{kind}  {k["height_cm"] / 100:.1f} m, trunk {k["trunk_cm"]:.0f} cm, '
                f'{k["triangles"]["total"]:,} tris')
        tiles.append((text, [(kind, (0, 0, 0), 0.)], k['height_cm'] / 100))
    row = [('norway_maple', -9.), ('linden', -1.5), ('ash', 6.)]
    tiles.append(('street row, 3 m clearance and a 1.75 m figure', [(k, (x, 0, 0), 30. * i) for i, (k, x) in
                                                                     enumerate(row)], 'row'))
    tiles.append(('leaf atlas (4 x 4 cells) and bark', [], 'atlas'))
    sheet = np.full((th * rows, tw * cols, 4), .3, dtype=np.float32)
    import tempfile
    tmp = Path(tempfile.mkdtemp(prefix='plateau_trees_'))
    for idx, (text, items, view) in enumerate(tiles):
        coll = bpy.data.collections.new(f'tile{idx}')
        scene.collection.children.link(coll)
        for name, loc, yaw in items:
            tree_object(name, coll, loc, yaw)
        if view == 'row':
            fig = bpy.data.meshes.new('figure')
            fig.from_pydata([(x, y, z) for z in (0, 1.75) for x, y in ((-.22, -.12), (.22, -.12), (.22, .12), (-.22, .12))],
                            [], [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
            fm = bpy.data.materials.new('figure')
            fm.use_nodes = True
            fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.05, .12, .4, 1)
            fig.materials.append(fm)
            fo = bpy.data.objects.new('figure', fig)
            fo.location = (2.2, -3., 0)
            coll.objects.link(fo)
            bar = bpy.data.meshes.new('clearance')
            bar.from_pydata([(-14, -3.5, 2.98), (12, -3.5, 2.98), (12, -3.5, 3.02), (-14, -3.5, 3.02)], [], [(0, 1, 2, 3)])
            bm = bpy.data.materials.new('clearance')
            bm.use_nodes = True
            bm.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1, .1, .1, 1)
            bm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2.
            bar.materials.append(bm)
            coll.objects.link(bpy.data.objects.new('clearance', bar))
            aim((-1.5, 0, 5.5), 34., -90., 6.)
        elif view == 'atlas':
            plane = bpy.data.meshes.new('atlas')
            plane.from_pydata([(-3, 0, .3), (3, 0, .3), (3, 0, 6.3), (-3, 0, 6.3)], [], [(0, 1, 2, 3)])
            uv = plane.uv_layers.new(name='UVMap')
            uv.data.foreach_set('uv', [0, 0, 1, 0, 1, 1, 0, 1])
            plane.materials.append(leaf_mat)
            coll.objects.link(bpy.data.objects.new('atlas', plane))
            strip = bpy.data.meshes.new('bark')
            strip.from_pydata([(-3, 0, -3.6), (3, 0, -3.6), (3, 0, -.4), (-3, 0, -.4)], [], [(0, 1, 2, 3)])
            uv = strip.uv_layers.new(name='UVMap')
            uv.data.foreach_set('uv', [0, 0, 6, 0, 6, 3.2, 0, 3.2])
            strip.materials.append(bark_mats['norway_maple'])
            so = bpy.data.objects.new('bark', strip)
            so.location = (0, 0, 4.)
            so.scale = (1, 1, 1)
            coll.objects.link(so)
            aim((0, 0, 3.2), 16.5, -90., 0.)
        else:
            k = manifest['kinds'][items[0][0]]
            aim((0, 0, k['height_cm'] / 200 + .4), k['height_cm'] / 100 * 1.85, -60., 8.)
        lab = label(text)
        for other in bpy.data.collections:
            other.hide_render = other is not coll
        scene.render.filepath = str(tmp / f'tile{idx:02d}.png')
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(scene.render.filepath)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(th, tw, 4)
        r, c = divmod(idx, cols)
        sheet[(rows - 1 - r) * th:(rows - r) * th, c * tw:(c + 1) * tw] = px
        bpy.data.images.remove(img)
        bpy.data.objects.remove(lab)
        coll.hide_render = True
    sheet[..., 3] = 1.
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
    parser.add_argument('--render-only', action='store_true', help='render the sheet from the files on disk')
    args = parser.parse_args(argv)
    out = Path(args.out)
    if args.render_only:
        manifest = json.loads((out / 'manifest.json').read_text())
    else:
        manifest = build(out)
        for kind, k in manifest['kinds'].items():
            t = k['triangles']
            print(f'{kind:13s} {k["height_cm"] / 100:5.1f} m  trunk {k["trunk_cm"]:5.1f} cm  crown base '
                  f'{k["crown_base_cm"]:5.0f} cm  {t["bark"]:6d} bark + {t["leaves"]:5d} leaf = {t["total"]:6d} tris '
                  f'({k["cards"]} cards)')
        print('->', out)
    if not args.no_render:
        render_sheet(out, manifest, Path(args.sheet))
        print('contact sheet ->', args.sheet)
    over = [k for k, v in manifest['kinds'].items() if v['triangles']['total'] > v['triangle_target']]
    return 1 if over else 0


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
