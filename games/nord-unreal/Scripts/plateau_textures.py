"""Tileable surface textures for the Plateau replica (stdlib only, deterministic).

Run from games/nord-unreal:
  python3 Scripts/plateau_textures.py           # writes Data/Plateau/ReplicaGeometry/Textures/
  python3 Scripts/plateau_textures.py --check   # rebuilds in memory and compares with textures.json

Sixteen sets, three PNG maps each:
  T_Replica_<Set>_diff    sRGB base colour; the material multiplies it by target colour / mean_linear. The
                          cut-out sets (balusters, lattice, fence boards, creeper) are RGBA: A is the opacity
                          mask, and the colour under transparent texels is the surface colour, so filtering
                          never pulls a dark halo into the edge.
  T_Replica_<Set>_nor_dx  tangent-space normal, DirectX convention (green down), like the Poly Haven maps
  T_Replica_<Set>_rough   linear: R roughness (the channel the brick-style material reads), G height,
                          B cavity (1 in joints, gaps and holes)
Image row 0 is the top of the tile: the rows run down the wall, as the game shows a texture on an
upright face. Replica OBJ UVs are metres (u along the wall, v = z; u = x, v = y on the ground), so the
material tiling is 1 / tile_m. The three card sets (balusters, lattice, fence boards) tile only along u:
u is metres along the run and v runs 0..1 from the bottom to the top of the card, so their v tiling is 1
and `card_height_m` is the height the texture was drawn for.

- limestone: Montréal greystone (pierre grise) laid as rock-faced ashlar. 2.56 m tile, 8 courses
  drawn from 30-39 cm and scaled to fill the tile, 2 to 4 stones of 45-130 cm per course, joints of
  adjacent courses at least 15 cm apart, 1 cm mortar joints. Each stone has its own shade and lumps;
  the arris rises over about 3.5 cm.
- slate: the fausse-mansarde roof. 1 m x 2 m tile, 16 rows of 12.5 cm exposure, 20 cm slates laid
  half-bond, with a band of three fish-scale (half-round butt) rows. Each row covers the top of the
  row below, so a butt steps down by the slate thickness and shades the slate under it.
- membrane, ballast, tar: flat roofs. A white single-ply sheet with a lap seam, board joints showing
  through and ponding stains; white gravel ballast; black tar with gravel sunk into it.
- sheet_metal: corrugated galvanised steel with spangle, fasteners and rust runs.
- siding, parging: lap siding with 10 cm laps and staggered butt joints; parged concrete with trowel
  arcs and hairline cracks.
- balusters, lattice, fence_boards (cut-out cards) and creeper (cut-out Virginia creeper, tiling).
- lawn, pavers, soil, crushed_stone: yard ground.

Methods. Greystone and slate follow Larry Gritz's RenderMan shader stone.sl (staggered courses, per-stone
colour from the stone index, noise-perturbed joint edges, a groove profile for the relief). Gravel, tar
and crushed stone are splatted stones kept by the highest height at each texel, the way Substance
Designer's Tile Sampler / Shape Splatter stacks pebbles; spangle and tar cracks are Worley cellular noise
(F1 cells, F2 - F1 borders). Siding is the sawtooth band profile of Blender's Wave Texture (one wedge per
lap), with the lap shadow baked under each butt. The cut-out cards are drawn from signed distances, so
the alpha edge is anti-aliased about the 0.5 clip; the apply step turns on Unreal's alpha-coverage mips
(Castaño, "Computing Alpha Mipmaps"), so thin balusters do not thin out at a distance. The noise is
tileable value noise on an integer hash, and the normals come from the height field by central
differences. The textures are generated, not scanned.

The pixel bytes use only integer hashing and IEEE +, -, *, / and sqrt (sines and cosines come from a
fixed polynomial, not the C library), so they are the same on every platform. The compressed PNG bytes
also depend on the zlib build; textures.json therefore records `raw_sha256`, the hash of the
decompressed image stream, beside the file hash.
"""
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from math import floor, sqrt
import os
from pathlib import Path
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/Plateau/ReplicaGeometry/Textures'
INDEX = 'textures.json'
MASK = 0xFFFFFFFF
ROLES = ('diff', 'nor_dx', 'rough')
# Import settings per map, read by the apply step (Unreal TextureCompressionSettings names).
IMPORT = {'diff': {'srgb': True, 'compression': 'TC_DEFAULT', 'sampler': 'SAMPLERTYPE_COLOR'},
          'nor_dx': {'srgb': False, 'compression': 'TC_NORMALMAP', 'sampler': 'SAMPLERTYPE_NORMAL'},
          'rough': {'srgb': False, 'compression': 'TC_DEFAULT', 'sampler': 'SAMPLERTYPE_LINEAR_COLOR'}}
# How the apply step builds the material for each kind of surface (apply_plateau_replica.SURFACE_PARENTS
# names the parent): walls and roofs duplicate the brick graph, ground keeps the wet-street wrapper,
# cut-out cards and creeper get a masked, two-sided parent built in the apply step.
SURFACES = {
    'wall': {'blend_mode': 'opaque', 'two_sided': False, 'shading_model': 'default_lit'},
    'ground': {'blend_mode': 'opaque', 'two_sided': False, 'shading_model': 'default_lit'},
    'cutout': {'blend_mode': 'masked', 'two_sided': True, 'shading_model': 'default_lit', 'opacity_mask_clip': .5},
    'foliage': {'blend_mode': 'masked', 'two_sided': True, 'shading_model': 'two_sided_foliage',
                'opacity_mask_clip': .5},
}
# keys: the shared material keys (plateau_plex.py) that take the set; Stone and Slate are matched by the
# apply step's older name rule. tint_floor: the smallest per-channel tint the CPU test accepts; the
# neutral sets are made to be painted any colour, so a saturated paint may scale one channel far down.
SETS = {
    'limestone': {'name': 'Limestone', 'size_px': (1024, 1024), 'tile_m': (2.56, 2.56), 'seed': 1871,
                  'surface': 'wall', 'keys': ()},
    'slate': {'name': 'Slate', 'size_px': (512, 1024), 'tile_m': (1.0, 2.0), 'seed': 1895,
              'surface': 'wall', 'keys': ()},
    'membrane': {'name': 'Membrane', 'size_px': (512, 512), 'tile_m': (2.44, 2.44), 'seed': 2010,
                 'surface': 'ground', 'keys': ('Roof_Membrane',)},
    'ballast': {'name': 'Ballast', 'size_px': (512, 512), 'tile_m': (1.0, 1.0), 'seed': 1962,
                'surface': 'ground', 'keys': ('Roof_Gravel',)},
    'tar': {'name': 'TarGravel', 'size_px': (512, 512), 'tile_m': (1.0, 1.0), 'seed': 1931,
            'surface': 'ground', 'keys': ('Roof_Tar',), 'tint_floor': .1},
    'sheet_metal': {'name': 'SheetMetal', 'size_px': (512, 512), 'tile_m': (1.0, 1.0), 'seed': 1920,
                    'surface': 'wall', 'keys': ('Sheet_Metal',), 'metallic': .85, 'tint_floor': .02},
    'siding': {'name': 'Siding', 'size_px': (1024, 512), 'tile_m': (2.4, 1.2), 'seed': 1958,
               'surface': 'wall', 'keys': ('Siding_Lap_Cream', 'Siding_Lap_Grey'), 'tint_floor': .02},
    'parging': {'name': 'Parging', 'size_px': (512, 512), 'tile_m': (2.0, 2.0), 'seed': 1949,
                'surface': 'wall', 'keys': ('Parged',), 'tint_floor': .02},
    'balusters': {'name': 'Balusters', 'size_px': (512, 512), 'tile_m': (1.0, 1.0), 'card_height_m': 1.07,
                  'seed': 1912, 'surface': 'cutout', 'keys': ('Rail_Baluster',), 'tint_floor': .02},
    'lattice': {'name': 'Lattice', 'size_px': (512, 512), 'tile_m': (1.0, 1.0), 'card_height_m': 1.0,
                'seed': 1927, 'surface': 'cutout', 'keys': ('Rail_Lattice',), 'tint_floor': .02},
    'fence_boards': {'name': 'FenceBoards', 'size_px': (1024, 512), 'tile_m': (2.0, 1.0), 'card_height_m': 1.8,
                     'seed': 1974, 'surface': 'cutout', 'keys': ('Fence_Boards',), 'tint_floor': .02},
    'creeper': {'name': 'Creeper', 'size_px': (1024, 1024), 'tile_m': (2.0, 2.0), 'seed': 1883,
                'surface': 'foliage', 'keys': ('Leaf_Creeper',)},
    'lawn': {'name': 'Lawn', 'size_px': (512, 512), 'tile_m': (2.0, 2.0), 'seed': 1936,
             'surface': 'ground', 'keys': ('Yard_Grass',)},
    'pavers': {'name': 'Pavers', 'size_px': (512, 512), 'tile_m': (1.2, 1.2), 'seed': 1988,
               'surface': 'ground', 'keys': ('Yard_Pavers',), 'tint_floor': .02},
    'soil': {'name': 'Soil', 'size_px': (512, 512), 'tile_m': (2.0, 2.0), 'seed': 1905,
             'surface': 'ground', 'keys': ('Yard_Soil',)},
    'crushed_stone': {'name': 'CrushedStone', 'size_px': (512, 512), 'tile_m': (1.0, 1.0), 'seed': 1999,
                      'surface': 'ground', 'keys': ('Yard_Gravel',)},
}
CARDS = tuple(k for k, s in SETS.items() if 'card_height_m' in s)
ALPHA = tuple(k for k, s in SETS.items() if SURFACES[s['surface']]['blend_mode'] == 'masked')
# Limestone layout (cm).
COURSES = 8
COURSE_CM = (30., 39.)
MIN_JOINT_OFFSET_CM = 15.
STONE_CM = (45., 130.)
JOINT_HALF_CM = .5
ARRIS_CM = 3.5
# Slate layout (cm).
SLATE_ROWS = 16
SLATE_WIDTH_CM = 20.
SLATE_THICK_CM = .6
FISH_ROWS = (6, 7, 8)
# Membrane: 8 ft (2.44 m) sheets with a 10 cm lap and a 4 cm weld (a 1.5 in minimum weld, as the TPO
# guides ask), over 4 x 8 ft insulation boards whose joints show through.
SHEET_CM = 244.
LAP_CM = 10.
WELD_CM = 4.
BOARD_CM = (122., 244.)
# Corrugated galvanised sheet: 14 corrugations per metre (7.1 cm pitch), 1.27 cm deep; fasteners on every
# second crest at two purlins.
CORRUGATIONS = 14
CORRUGATION_DEPTH_CM = 1.27
PURLINS = (.22, .72)
# Lap siding: 12 courses of 10 cm (4 in) exposure in 1.2 m, 0.3 cm at the top of a lap and 1.2 cm at the
# butt, one butt joint per course with joints of neighbouring courses at least 40 cm apart.
LAP_ROWS = 12
LAP_THIN_CM, LAP_BUTT_CM = .3, 1.2
LAP_JOINT_GAP_CM = 40.
# Gallery guard (cm from the deck): 5 cm drain gap, 2x4 bottom rail, 2x2 balusters at 12.5 cm centres
# (8.7 cm clear, under the 10 cm a guard may leave), 2x4 top rail and a 2x2 cap.
GUARD_BANDS_CM = {'gap': (0., 5.), 'bottom_rail': (5., 13.9), 'balusters': (13.9, 94.3),
                  'top_rail': (94.3, 103.2), 'cap': (103.2, 107.)}
BALUSTERS_PER_M = 8
BALUSTER_CM = 3.8
# Lattice: 3.8 cm laths at +-45 degrees, 9 per metre along the run (4.1 cm openings), in a 5 cm frame.
LATTICE_PER_M = 9
LATH_CM = 3.8
LATTICE_FRAME_CM = 5.
# Board fence: 12 boards per 2 m, 14.6 cm boards with 2 cm gaps, two 2x4 rails behind them.
FENCE_BOARDS = 12
FENCE_BOARD_CM = 14.6
FENCE_RAILS_CM = ((22., 30.9), (149., 157.9))
# Herringbone (90 degrees) of 10 x 20 cm pavers: in a 4 x 4 unit cell, the k-th motif (k = 0..3) is a
# horizontal paver on cells (k, k) and (k + 1, k) and a vertical one on (k, k + 1) and (k, k + 2), mod 4.
PAVER_CM = 10.
PAVER_JOINT_CM = .15
PAVER_CHAMFER_CM = .7


# ------------------------------------------------------------------------------------------------
# Hashing and noise

def mix32(x):
    """lowbias32 integer hash (Chris Wellons, hash-prospector)."""
    x &= MASK
    x ^= x >> 16
    x = (x * 0x7FEB352D) & MASK
    x ^= x >> 15
    x = (x * 0x846CA68B) & MASK
    return x ^ (x >> 16)


def unit(seed, *keys):
    """A float in [0, 1) from integer keys."""
    x = mix32((seed * 0x9E3779B1 + 0x6A09E667) & MASK)
    for k in keys:
        x = mix32(x ^ mix32((k * 0x85EBCA6B + 0x7F4A7C15) & MASK))
    return x / 4294967296.


class Rng:
    def __init__(self, seed):
        self.seed, self.n = seed, 0

    def next(self):
        self.n += 1
        return unit(self.seed, 0x5EED, self.n)


class Noise:
    """Tileable value noise: a cells_x x cells_y lattice of hashed values, smoothstep-interpolated."""

    def __init__(self, seed, width, height, cells_x, cells_y):
        self.lattice = [[unit(seed, i % cells_x, j % cells_y) for i in range(cells_x + 1)] for j in range(cells_y + 1)]
        self.cx, self.wx = self._axis(width, cells_x)
        self.cy, self.wy = self._axis(height, cells_y)

    @staticmethod
    def _axis(n, cells):
        index, weight = [], []
        for p in range(n):
            t = (p + .5) * cells / n
            c = int(t)
            f = t - c
            index.append(c)
            weight.append(f * f * (3. - 2. * f))
        return index, weight

    def row(self, y):
        j, b = self.cy[y], self.wy[y]
        a = 1. - b
        r = [p * a + q * b for p, q in zip(self.lattice[j], self.lattice[j + 1])]
        return [r[c] + (r[c + 1] - r[c]) * w for c, w in zip(self.cx, self.wx)]


class Fbm:
    """Sum of tileable value-noise octaves; values stay in [0, 1]."""

    def __init__(self, seed, width, height, cells, gains):
        total = sum(gains)
        self.octaves = [(Noise(seed + i, width, height, cx, cy), g / total) for i, ((cx, cy), g) in enumerate(zip(cells, gains))]

    def row(self, y):
        out = None
        for noise, gain in self.octaves:
            r = noise.row(y)
            out = [v * gain for v in r] if out is None else [o + v * gain for o, v in zip(out, r)]
        return out


def smooth(e0, e1, x):
    if x <= e0:
        return 0.
    if x >= e1:
        return 1.
    t = (x - e0) / (e1 - e0)
    return t * t * (3. - 2. * t)


def byte(v):
    return 0 if v <= 0. else 255 if v >= 255. else int(v + .5)


def cyclic_gap(a, b, period):
    d = abs(a - b) % period
    return min(d, period - d)


# ------------------------------------------------------------------------------------------------
# Limestone ashlar

def ashlar_layout(seed, width, height, px_cm):
    """Course tops/heights (px) and sorted joint positions per course (px), tileable both ways."""
    rng = Rng(seed)
    raw = [COURSE_CM[0] + (COURSE_CM[1] - COURSE_CM[0]) * rng.next() for _ in range(COURSES)]
    scale = height / sum(raw)
    heights = [int(v * scale) for v in raw]
    heights[-1] += height - sum(heights)
    tops = [sum(heights[:i]) for i in range(COURSES)]
    min_gap = MIN_JOINT_OFFSET_CM * px_cm
    lo, hi = STONE_CM[0] * px_cm, STONE_CM[1] * px_cm
    joints = []
    for course in range(COURSES):
        for _ in range(5000):
            pick = rng.next()
            n = 2 if pick < .12 else 3 if pick < .62 else 4
            weights = [.6 + .8 * rng.next() for _ in range(n)]
            start = rng.next() * width
            total = sum(weights)
            lengths = [width * w / total for w in weights]
            if not all(lo <= v <= hi for v in lengths):
                continue
            xs, acc = [], start
            for v in lengths:
                xs.append(acc % width)
                acc += v
            neighbours = []
            if course:
                neighbours.append(joints[course - 1])
            if course == COURSES - 1:
                neighbours.append(joints[0])
            if all(cyclic_gap(a, b, width) >= min_gap for other in neighbours for a in xs for b in other):
                joints.append(sorted(xs))
                break
        else:
            raise AssertionError(f'No staggered joint layout for course {course}')
    return {'tops': tops, 'heights': heights, 'joints': joints}


def course_columns(joints, width):
    """Per pixel column: stone index in the course and distance (px) to the nearest vertical joint."""
    n = len(joints)
    index, dist = [], []
    for x in range(width):
        xc = x + .5
        k = max((i for i in range(n) if joints[i] <= xc), default=n - 1)
        left = (xc - joints[k]) % width
        right = (joints[(k + 1) % n] - xc) % width
        index.append(k)
        dist.append(min(left, right))
    return index, dist


def limestone(spec):
    width, height = spec['size_px']
    px_cm = width / (spec['tile_m'][0] * 100)
    seed = spec['seed']
    layout = ashlar_layout(seed, width, height, px_cm)
    columns = [course_columns(j, width) for j in layout['joints']]
    stones = {}
    for c, joints in enumerate(layout['joints']):
        for k in range(len(joints)):
            tone = unit(seed, 11, c, k)
            hue = unit(seed, 12, c, k)
            shift = (3., 2., -2.) if hue < .3 else (-2., 0., 3.) if hue > .75 else (0., 0., 0.)
            stones[c, k] = {'bright': .9 + .18 * tone, 'shift': shift, 'rock': .65 + .35 * unit(seed, 13, c, k),
                            'rough': .83 + .07 * unit(seed, 14, c, k), 'chip': 1.5 + 2. * unit(seed, 15, c, k)}
    # Rock face: broad lumps (25, 13, 6 cm), grain (1.6, 0.8, 0.5 cm), bedding streaks, ragged joint edges.
    lumps = Fbm(seed + 100, width, height, ((10, 10), (20, 20), (40, 40)), (.5, .32, .18))
    fine = Fbm(seed + 200, width, height, ((160, 160), (320, 320)), (.6, .4))
    grain = Noise(seed + 250, width, height, 512, 512)
    ragged = Fbm(seed + 300, width, height, ((24, 24), (96, 96)), (.7, .3))
    bedding = Fbm(seed + 400, width, height, ((4, 48), (8, 128)), (.6, .4))
    jw, arris = JOINT_HALF_CM * px_cm, ARRIS_CM * px_cm
    base, mortar = (148., 147., 142.), (166., 163., 155.)
    course_of = []
    for c, (top, h) in enumerate(zip(layout['tops'], layout['heights'])):
        course_of += [(c, top, h)] * h
    # Roll the courses so the tile edge runs through a stone, not along a bed joint.
    shift = int(.4 * layout['heights'][-1])
    diff, heights, rough_rows, cavity_rows = [], [], [], []
    for y in range(height):
        yl = (y + height - shift) % height
        c, top, ch = course_of[yl]
        yc = yl + .5
        dy = min(yc - top, top + ch - yc)
        index, dist = columns[c]
        lump, fn, gr, rg, bd = lumps.row(y), fine.row(y), grain.row(y), ragged.row(y), bedding.row(y)
        row, hrow, rrow, crow = bytearray(width * 3), [0.] * width, [0.] * width, [0.] * width
        for x in range(width):
            s = stones[c, index[x]]
            # Ragged, chipped arrises: the joint edge wanders by up to the stone's chip depth.
            e = min(dist[x], dy) - s['chip'] * px_cm / 4 * (rg[x] - .5) * 2.
            m = 1. - smooth(jw - .8, jw + .8, e)
            lp, f = lump[x] - .5, fn[x] - .5
            p = smooth(jw, jw + arris * (1. + 1.2 * lp), e)
            hs = .25 + p * (.75 + s['rock'] * (2.8 * lp + .35 * f))
            hm = .05 * (f + .5)
            h = hs + (hm - hs) * m
            # Stone colour: per-stone shade and hue, rock-face lumps and cavities, grain, bedding, arris shade.
            k = s['bright'] * (1. + .26 * lp + .1 * f + .1 * (gr[x] - .5) + .1 * (bd[x] - .5)) * (.76 + .24 * p)
            if f < -.32:
                k *= .7 + (f + .5) * 1.6
            sc = [(base[i] + s['shift'][i]) * k for i in range(3)]
            km = (.94 + .12 * f) * (.7 + .3 * smooth(0., jw, e))
            mc = [mortar[i] * km for i in range(3)]
            o = 3 * x
            row[o], row[o + 1], row[o + 2] = (byte(sc[i] + (mc[i] - sc[i]) * m) for i in range(3))
            hrow[x] = h
            rrow[x] = s['rough'] + .08 * lp + (.95 - s['rough']) * m
            crow[x] = m
        diff.append(bytes(row))
        heights.append(hrow)
        rough_rows.append(rrow)
        cavity_rows.append(crow)
    return diff, heights, rough_rows, cavity_rows, px_cm, {'courses_cm': [round(h / px_cm, 2) for h in layout['heights']],
                                                           'stones_per_course': [len(j) for j in layout['joints']]}


# ------------------------------------------------------------------------------------------------
# Slate

def slate_layout(spec):
    width, height = spec['size_px']
    px_cm = width / (spec['tile_m'][0] * 100)
    per_row = round(spec['tile_m'][0] * 100 / SLATE_WIDTH_CM)
    assert abs(per_row * SLATE_WIDTH_CM - spec['tile_m'][0] * 100) < 1e-9 and height % SLATE_ROWS == 0
    exposure = height // SLATE_ROWS
    # The rows are rolled by half a course so the tile edge runs through slates, not along a butt line.
    # Joints sit a quarter slate off the side edges for the same reason.
    w = width / per_row
    return {'px_cm': px_cm, 'exposure': exposure, 'w': w, 'per_row': per_row, 'shift': exposure // 2,
            'offsets': [w / 4 + (w / 2 if r % 2 else 0.) for r in range(SLATE_ROWS)]}


def slate(spec):
    width, height = spec['size_px']
    seed = spec['seed']
    L = slate_layout(spec)
    px_cm, E, w, per_row = L['px_cm'], L['exposure'], L['w'], L['per_row']
    rows = SLATE_ROWS
    radius = w / 2
    cells = {}
    for r in range(rows):
        for k in range(per_row):
            tone, hue = unit(seed, 21, r, k), unit(seed, 22, r, k)
            fish = r in FISH_ROWS
            if hue < (.35 if fish else .2):
                shift = (5., -2., 2.)      # purple slate
            elif hue > .85:
                shift = (-3., 3., -2.)     # green-grey slate
            else:
                shift = (0., 0., 0.)
            cells[r, k] = {'bright': .86 + .26 * tone, 'shift': shift, 'drop': 1.6 * (unit(seed, 23, r, k) - .5),
                           'tilt': .04 * (unit(seed, 24, r, k) - .5), 'gap': (.3 + .2 * unit(seed, 25, r, k)) * px_cm,
                           'rough': .46 + .08 * unit(seed, 26, r, k), 'fish': fish}
    offsets = L['offsets']
    ragged = Fbm(seed + 300, width, height, ((64, 128), (256, 512)), (.7, .3))
    cleft = Fbm(seed + 400, width, height, ((20, 160), (40, 320)), (.6, .4))
    mottle = Fbm(seed + 500, width, height, ((5, 10), (20, 40)), (.6, .4))
    base = (78., 82., 92.)
    thick = SLATE_THICK_CM

    def slate_at(r, x):
        """(row, column, local x) of the slate of row r (wrapped) over pixel column x."""
        r %= rows
        t = (x + .5 - offsets[r]) % width
        k = int(t // w) % per_row
        return r, k, t - k * w

    def butt(r, k, xl, rg):
        """Absolute y (px, unwrapped) of the bottom edge of slate (r, k) at local x."""
        cell = cells[r % rows, k]
        y = (r + 1) * E + cell['drop'] + cell['tilt'] * (xl - radius) + 1.2 * (rg - .5)
        if cell['fish']:
            dx = xl - radius
            y -= radius - sqrt(max(0., radius * radius - dx * dx))
        return y

    shift = L['shift']
    diff, heights, rough_rows, cavity_rows = [], [], [], []
    for y in range(height):
        yl = (y + height - shift) % height
        yc = yl + .5
        r0 = yl // E
        rg, cl, mt = ragged.row(y), cleft.row(y), mottle.row(y)
        row, hrow, rrow, crow = bytearray(width * 3), [0.] * width, [0.] * width, [0.] * width
        for x in range(width):
            # Upper rows lie on top: take the first row, from the one above, whose butt is below this pixel.
            owner = None
            for r in (r0 - 1, r0, r0 + 1):
                rr, k, xl = slate_at(r, x)
                if yc < butt(r, k, xl, rg[x]) or r == r0 + 1:
                    owner = (r, rr, k, xl)
                    break
            r, rr, k, xl = owner
            cell = cells[rr, k]
            # Distance below the covering butt (the slate one row up at this column): contact shadow.
            ra, ka, xa = slate_at(r - 1, x)
            below = yc - butt(r - 1, ka, xa, rg[x])
            to_butt = butt(r, k, xl, rg[x]) - yc
            side = min(xl, w - xl)
            g = 1. - smooth(cell['gap'] * .5 - .6, cell['gap'] * .5 + .6, side)
            # Each slate rises toward its butt by half a thickness; covered parts sink under the row above.
            lift = (yc - r * E) / E
            h = thick * (.5 + .5 * min(1., max(-1., lift))) + .04 * (cl[x] - .5)
            h -= .15 * (1. - smooth(0., 1.2 * px_cm, to_butt))   # dressed bevel on the butt
            h *= 1. - g
            shade = .62 + .38 * smooth(0., 1.6 * px_cm, below)
            k_ = cell['bright'] * (1. + .1 * (mt[x] - .5) + .06 * (cl[x] - .5)) * shade
            k_ *= 1. + .05 * (1. - smooth(0., .8 * px_cm, to_butt))
            k_ *= 1. - .62 * g
            o = 3 * x
            row[o], row[o + 1], row[o + 2] = (byte((base[i] + cell['shift'][i]) * k_) for i in range(3))
            hrow[x] = h
            rrow[x] = cell['rough'] + .06 * (cl[x] - .5) + (.82 - cell['rough']) * g
            crow[x] = max(g, 1. - smooth(0., .8 * px_cm, below))
        diff.append(bytes(row))
        heights.append(hrow)
        rough_rows.append(rrow)
        cavity_rows.append(crow)
    return diff, heights, rough_rows, cavity_rows, px_cm, {'rows': rows, 'exposure_cm': E / px_cm,
                                                           'slate_width_cm': w / px_cm, 'fish_scale_rows': list(FISH_ROWS)}



# ------------------------------------------------------------------------------------------------
# Helpers for the newer sets

TWO_PI = 6.283185307179586
SQRT2 = 1.4142135623730951


def sin_cos(turns):
    """(sin, cos) of an angle in turns from a fixed Taylor polynomial on +-1/8 turn (error < 1e-11).

    The C library's sin and cos may differ in the last bit between platforms; this does not.
    """
    t = turns - floor(turns)
    q = int(t * 4. + .5)
    x = (t - q * .25) * TWO_PI
    x2 = x * x
    s = x * (1. - x2 / 6. * (1. - x2 / 20. * (1. - x2 / 42. * (1. - x2 / 72. * (1. - x2 / 110.)))))
    c = 1. - x2 / 2. * (1. - x2 / 12. * (1. - x2 / 30. * (1. - x2 / 56. * (1. - x2 / 90. * (1. - x2 / 132.)))))
    q &= 3
    if q == 0:
        return s, c
    if q == 1:
        return c, -s
    if q == 2:
        return -s, -c
    return -c, s


def field(noise, height):
    """A Noise or Fbm as one flat, row-major list."""
    out = []
    for y in range(height):
        out += noise.row(y)
    return out


def noise1d(seed, n, cells):
    """Tileable 1D value noise of length n."""
    return Noise(seed, n, 1, cells, 1).row(0)


def pick(palette, x):
    """The entry of a (weight, value) palette that x in [0, 1) falls on."""
    acc = 0.
    for weight, value in palette:
        acc += weight
        if x < acc:
            return value
    return palette[-1][1]


def wrap_delta(a, b, period):
    """a - b wrapped into [-period/2, period/2)."""
    return (a - b + period * .5) % period - period * .5


class Canvas:
    """Flat per-texel buffers: colour (sRGB 0-255 floats), height (cm), roughness, cavity, optional alpha."""

    def __init__(self, width, height, colour, height_cm=0., rough=.8, alpha=None):
        n = width * height
        self.w, self.h = width, height
        self.r, self.g, self.b = [float(colour[0])] * n, [float(colour[1])] * n, [float(colour[2])] * n
        self.height = [float(height_cm)] * n
        self.rough = [float(rough)] * n
        self.cavity = [0.] * n
        self.alpha = None if alpha is None else [float(alpha)] * n

    def result(self, px_x, px_y, layout, wrap_y=True):
        w, h = self.w, self.h
        channels = 3 if self.alpha is None else 4
        diff, heights, rough, cavity = [], [], [], []
        for y in range(h):
            o = y * w
            row = bytearray(channels * w)
            row[0::channels] = bytes(byte(v) for v in self.r[o:o + w])
            row[1::channels] = bytes(byte(v) for v in self.g[o:o + w])
            row[2::channels] = bytes(byte(v) for v in self.b[o:o + w])
            if self.alpha is not None:
                row[3::channels] = bytes(byte(v * 255.) for v in self.alpha[o:o + w])
            diff.append(bytes(row))
            heights.append(self.height[o:o + w])
            rough.append(self.rough[o:o + w])
            cavity.append(self.cavity[o:o + w])
        return {'diff': diff, 'heights': heights, 'rough': rough, 'cavity': cavity, 'px': (px_x, px_y),
                'layout': layout, 'channels': channels, 'wrap_y': wrap_y}


def scatter(seed, width, height, cell_px, prob, layer=0):
    """Jittered-grid points (px): one per cell with probability prob. Tileable, because the cells wrap."""
    nx, ny = max(1, round(width / cell_px)), max(1, round(height / cell_px))
    cw, ch = width / nx, height / ny
    out = []
    for j in range(ny):
        for i in range(nx):
            if unit(seed, 1, layer, i, j) < prob:
                out.append((cw * (i + unit(seed, 2, layer, i, j)), ch * (j + unit(seed, 3, layer, i, j)), (layer, i, j)))
    return out


def splat_round(width, height, stones, hf, owner, prof):
    """Rounded stones, highest wins (Tile Sampler / Shape Splatter stacking with a max height blend).

    stones: (cx, cy, rx, ry, turns, base_cm, top_cm, a3, b3, a4), centre and radii in px. The outline is
    the ellipse r^2 = 1 with lumps a3 r^3 cos 3phi + b3 r^3 sin 3phi + a4 r^4 cos 4phi; the profile is a dome.
    """
    for index, (cx, cy, rx, ry, turns, base, top, a3, b3, a4) in enumerate(stones):
        s, c = sin_cos(turns)
        reach = max(rx, ry) * 1.3 + 1.
        irx, iry = 1. / rx, 1. / ry
        x0, x1 = floor(cx - reach), floor(cx + reach) + 1
        for py in range(floor(cy - reach), floor(cy + reach) + 1):
            dy = py + .5 - cy
            row = (py % height) * width
            for px in range(x0, x1):
                dx = px + .5 - cx
                u = (dx * c + dy * s) * irx
                v = (dy * c - dx * s) * iry
                uu, vv = u * u, v * v
                f = uu + vv
                if f >= 1.7:
                    continue
                f += a3 * u * (uu - 3. * vv) + b3 * v * (3. * uu - vv) + a4 * (f * f - 8. * uu * vv)
                if f >= 1.:
                    continue
                h = base + top * sqrt(1. - f)
                i = row + px % width
                if h > hf[i]:
                    hf[i], owner[i], prof[i] = h, index, 1. - f


def splat_angular(width, height, stones, hf, owner, prof):
    """Crushed-stone chips: convex intersections of half-planes with bevelled arrises and a tilted top.

    stones: (cx, cy, reach_px, planes [(nx, ny, d_px)], base_cm, top_cm, bevel_px, tilt_x, tilt_y), tilt in cm/px.
    """
    for index, (cx, cy, reach, planes, base, top, bevel, tx, ty) in enumerate(stones):
        ib = 1. / bevel
        x0, x1 = floor(cx - reach), floor(cx + reach) + 1
        for py in range(floor(cy - reach), floor(cy + reach) + 1):
            dy = py + .5 - cy
            row = (py % height) * width
            for px in range(x0, x1):
                dx = px + .5 - cx
                m = bevel
                for nx, ny, d in planes:
                    e = d - nx * dx - ny * dy
                    if e < m:
                        m = e
                        if m <= 0.:
                            break
                if m <= 0.:
                    continue
                p = m * ib
                h = base + top * p * (2. - p) + tx * dx + ty * dy
                i = row + px % width
                if h > hf[i]:
                    hf[i], owner[i], prof[i] = h, index, p


def cells(seed, width, height, cell_px, jitter=.85):
    """Worley cells on a wrapping jittered grid: per texel the nearest point's index and F2 - F1 (px)."""
    nx, ny = max(1, round(width / cell_px)), max(1, round(height / cell_px))
    cw, ch = width / nx, height / ny
    pts = [[(cw * (i + .5 + jitter * (unit(seed, 31, i, j) - .5)), ch * (j + .5 + jitter * (unit(seed, 32, i, j) - .5)))
            for i in range(nx)] for j in range(ny)]
    ids, border = [0] * (width * height), [0.] * (width * height)
    k = 0
    for y in range(height):
        yc = y + .5
        gj = int(yc / ch)
        near = []
        for gi in range(nx):
            cand = []
            for dj in (-1, 0, 1):
                j = gj + dj
                jj = j % ny
                oy = (j - jj) // ny * height
                for di in (-1, 0, 1):
                    i = gi + di
                    ii = i % nx
                    qx, qy = pts[jj][ii]
                    cand.append((qx + (i - ii) // nx * width, qy + oy - yc, jj * nx + ii))
            near.append(cand)
        for x in range(width):
            xc = x + .5
            d1 = d2 = 1e30
            best = 0
            for qx, qy, idx in near[int(xc / cw)]:
                ddx = qx - xc
                d = ddx * ddx + qy * qy
                if d < d1:
                    d1, d2, best = d, d1, idx
                elif d < d2:
                    d2 = d
            ids[k], border[k] = best, sqrt(d2) - sqrt(d1)
            k += 1
    return ids, border, nx * ny


def disc(cv, cx, cy, radius, colour, h, rough, cavity=0.):
    """A flat-topped disc (px), drawn over what is below where it stands higher; edges anti-aliased."""
    W, H = cv.w, cv.h
    for py in range(floor(cy - radius - 1), floor(cy + radius) + 2):
        dy = py + .5 - cy
        row = (py % H) * W
        for px in range(floor(cx - radius - 1), floor(cx + radius) + 2):
            dx = px + .5 - cx
            sd = radius - sqrt(dx * dx + dy * dy)
            if sd <= -.5:
                continue
            a = 1. if sd >= .5 else sd + .5
            i = row + px % W
            if cv.height[i] > h + .5:
                continue
            cv.r[i] += (colour[0] - cv.r[i]) * a
            cv.g[i] += (colour[1] - cv.g[i]) * a
            cv.b[i] += (colour[2] - cv.b[i]) * a
            cv.height[i] += (h - cv.height[i]) * a
            cv.rough[i] += (rough - cv.rough[i]) * a
            cv.cavity[i] += (cavity - cv.cavity[i]) * a
            if cv.alpha is not None and a > cv.alpha[i]:
                cv.alpha[i] = a


def leaflet(cv, bx, by, turns, length, width, z, colour, edge_colour, edge_amount, blotch, teeth, rough,
            shade=1., lift=.25, vein=(1.18, 1.12, 1.)):
    """An obovate, serrated leaflet or lobe from (bx, by) toward `turns` (px), painted over what is below.

    Half-width w(t) = width * t * sqrt(1 - t) / 0.385 along the midrib t in [0, 1] (widest at 2/3, a wedge
    base and an acute tip), less 10% at each of `teeth` saw teeth toward the tip. edge_colour is mixed in
    toward the margin (autumn colour creeping in from the edge); blotch is a flat noise field.
    """
    W, H = cv.w, cv.h
    s_, c_ = sin_cos(turns)
    dx, dy, nx, ny = c_, s_, -s_, c_
    corners = [(bx + dx * a + nx * b, by + dy * a + ny * b) for a in (0., length) for b in (-width, width)]
    inv_l = 1. / length
    R, G, B, HT, RO, CA, AL = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity, cv.alpha
    k_w = width * 2.598
    for py in range(floor(min(p[1] for p in corners)) - 1, floor(max(p[1] for p in corners)) + 2):
        qy = py + .5 - by
        lo, hi = -1e9, 1e9
        for coef, off, a, b in ((dx, qy * dy, -.5, length + .5), (nx, qy * ny, -width - 1., width + 1.)):
            if -1e-9 < coef < 1e-9:
                if not a <= off <= b:
                    lo, hi = 1., 0.
            else:
                u1, u2 = (a - off) / coef, (b - off) / coef
                if u1 > u2:
                    u1, u2 = u2, u1
                lo, hi = max(lo, u1), min(hi, u2)
        if lo > hi:
            continue
        row = (py % H) * W
        for px in range(floor(bx + lo - .5), floor(bx + hi - .5) + 2):
            qx = px + .5 - bx
            t = (qx * dx + qy * dy) * inv_l
            if t <= 0. or t >= 1.:
                continue
            s = qx * nx + qy * ny
            w = k_w * t * sqrt(1. - t)
            if teeth and t > .2:
                saw = t * teeth
                w *= 1. - .1 * (saw - floor(saw))
            a_s = s if s >= 0. else -s
            sd = w - a_s
            if sd <= -.5:
                continue
            a = 1. if sd >= .5 else sd + .5
            i = row + px % W
            rel = a_s / w if w > 1e-6 else 1.
            e = edge_amount * smooth(.45, 1., max(rel, t * t))
            k = shade * (1. + .28 * (blotch[i] - .5))
            m = 1. - smooth(0., 1.3, a_s)
            vr, vg, vb = 1. + (vein[0] - 1.) * m, 1. + (vein[1] - 1.) * m, 1. + (vein[2] - 1.) * m
            cr = (colour[0] + (edge_colour[0] - colour[0]) * e) * k * vr
            cg = (colour[1] + (edge_colour[1] - colour[1]) * e) * k * vg
            cb = (colour[2] + (edge_colour[2] - colour[2]) * e) * k * vb
            hgt = z + lift * (1. - rel * rel) - .05 * m
            R[i] += (cr - R[i]) * a
            G[i] += (cg - G[i]) * a
            B[i] += (cb - B[i]) * a
            HT[i] += (hgt - HT[i]) * a
            RO[i] += (rough - RO[i]) * a
            CA[i] -= CA[i] * a
            if AL is not None and a > AL[i]:
                AL[i] = a


def maple_leaf(cv, x, y, size, turns, z, colour, blotch, rough=.7):
    """A fallen maple-like leaf seen from above: five serrated lobes on a short stalk."""
    for offset, scale in ((-.29, .45), (.29, .45), (-.14, .85), (.14, .85), (0., 1.)):
        leaflet(cv, x, y, turns + offset, size * scale, size * scale * .26, z, colour, colour, 0., blotch, 5, rough,
                lift=.12)
    leaflet(cv, x, y, turns + .5, size * .45, max(.8, size * .025), z - .05, (110., 80., 50.), (110., 80., 50.), 0.,
            blotch, 0, rough, lift=.02)


def stroke(cv, x0, y0, turns, length, colour, top, rough, rise=.55):
    """A grass blade or straw seen from above: a 1 px line whose height rises toward its tip."""
    W, H = cv.w, cv.h
    s, c = sin_cos(turns)
    steps = int(length * 1.4) + 1
    for k in range(steps):
        t = k / steps
        i = (floor(y0 + s * length * t) % H) * W + floor(x0 + c * length * t) % W
        hb = top * (1. - rise + rise * t)
        if hb > cv.height[i]:
            k_ = .82 + .3 * t
            cv.r[i], cv.g[i], cv.b[i] = colour[0] * k_, colour[1] * k_, colour[2] * k_
            cv.height[i], cv.rough[i], cv.cavity[i] = hb, rough, 0.


def stones_colour(cv, owner, prof, palette_of, floor_colour, floor_rough, fine, dirt, stone_rough, ao=.28,
                  dirt_amount=.15, floor_cavity=1.):
    """Colour, roughness and cavity after a splat: stone colour x edge shade x grain, else the floor."""
    R, G, B, RO, CA = cv.r, cv.g, cv.b, cv.rough, cv.cavity
    for i, o in enumerate(owner):
        d = 1. - dirt_amount * smooth(.5, .8, dirt[i])
        n = 1. + .12 * (fine[i] - .5)
        if o < 0:
            col, k = floor_colour, d * n
            RO[i], CA[i] = floor_rough, floor_cavity
        else:
            p = prof[i]
            col = palette_of[o]
            k = (1. - ao + ao * sqrt(p)) * d * n
            q = 1. - p
            RO[i], CA[i] = stone_rough[o] + .05 * q, .6 * q * q
        R[i], G[i], B[i] = col[0] * k, col[1] * k, col[2] * k


# ------------------------------------------------------------------------------------------------
# Roofs

def membrane(spec):
    """White single-ply roof: one 8 ft sheet per tile, its welded lap seam, board joints, ponding stains."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    cv = Canvas(W, H, (224., 227., 225.), .15, .44)
    und = field(Fbm(seed + 1, W, H, ((3, 3), (6, 6), (12, 12)), (.55, .3, .15)), H)
    dust = field(Fbm(seed + 2, W, H, ((4, 4), (8, 8), (16, 16), (32, 32)), (.4, .3, .2, .1)), H)
    grit = field(Noise(seed + 3, W, H, 256, 256), H)
    fine = field(Noise(seed + 4, W, H, 128, 128), H)
    wave = noise1d(seed + 5, H, 24)
    rng = Rng(seed)
    seam = rng.next() * W
    lap, weld, taper, board = LAP_CM * px, WELD_CM * px, 2. * px, BOARD_CM[0] * px
    jx = [(seam + (40. + c * BOARD_CM[0]) * px) % W for c in range(2)]
    jy = [(30. + c * BOARD_CM[0]) * px % H for c in range(2)]
    pcx, pcy = rng.next() * W, rng.next() * H
    phx, phy, pr = (18. + 10. * rng.next()) * px, (25. + 12. * rng.next()) * px, 5. * px
    base, dirt, new = (224., 227., 225.), (128., 122., 112.), (236., 238., 236.)
    R, G, B, HT, RO, CA = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity
    for y in range(H):
        yc = y + .5
        edge = seam + (wave[y] - .5) * .6 * px
        dpy = wrap_delta(yc, pcy, H)
        for x in range(W):
            i = y * W + x
            xc = x + .5
            dx = (xc - edge) % W                       # on the top sheet, right of its welded edge
            dl = W - dx                                # on the sheet below, left of that edge
            col = 0 if (xc - jx[0]) % W < board else 1
            dj = min(abs(wrap_delta(xc, jx[0], W)), abs(wrap_delta(xc, jx[1], W)), abs(wrap_delta(yc, jy[col], H)))
            g = 1. - smooth(0., 1.8 * px, dj)
            u = und[i]
            h = .15 + .28 * (u - .5) - .07 * g
            rough = .44
            cav = .5 * g
            if dx < lap:
                h += .15 * (1. - smooth(lap - taper, lap, dx))
                if dx < weld:
                    rough = .36
            pond = 1. - smooth(.27, .37, u)
            tide = 1. - smooth(0., .012, abs(u - .37))
            d = .3 * smooth(.48, .85, dust[i]) + .2 * pond + .08 * tide + .15 * g
            # Patch: a newer rounded rectangle welded over the sheet.
            qx, qy = abs(wrap_delta(xc, pcx, W)) - phx + pr, abs(dpy) - phy + pr
            sd = sqrt(max(qx, 0.) ** 2 + max(qy, 0.) ** 2) + min(max(qx, qy), 0.) - pr
            if sd < 0.:
                h += .15
                d *= .35
                if sd > -.7 * px:
                    h += .05
                    rough = .3
            c = [base[k] + (dirt[k] - base[k]) * d for k in range(3)]
            if sd < 0.:
                c = [c[k] + (new[k] - c[k]) * .5 for k in range(3)]
            if dx < .6 * px:                           # bleed-out bead along the weld
                h += .05
                rough = .3
                c = [v * .97 for v in c]
            if dl < 1.2 * px:                          # dirt line against the step
                c = [v * .8 for v in c]
                cav = 1.
            k = 1. + .04 * (fine[i] - .5)
            if grit[i] > .9:
                k *= .86
                rough += .12
            R[i], G[i], B[i] = c[0] * k, c[1] * k, c[2] * k
            HT[i] = h
            RO[i] = rough + .25 * d
            CA[i] = max(cav, .3 * pond)
    return cv.result(px, px, {'sheet_cm': SHEET_CM, 'lap_cm': LAP_CM, 'weld_cm': WELD_CM, 'board_cm': list(BOARD_CM),
                              'seam_u': round(seam / W, 4)})


def gravel_stones(seed, W, H, px, layers, palette, round_stones=True):
    """Stone list for splat_round or splat_angular from (cell_cm, prob, r_cm range, base_cm, top ratio) layers."""
    stones, colours, roughs = [], [], []
    for layer, (cell_cm, prob, (r0, r1), base, top) in enumerate(layers):
        for cx, cy, key in scatter(seed, W, H, cell_cm * px, prob, layer):
            u = [unit(seed, 50 + n, *key) for n in range(10)]
            r = (r0 + (r1 - r0) * u[0]) * px
            if round_stones:
                stones.append((cx, cy, r, r * (.65 + .35 * u[1]), u[2], base + (u[3] - .5) * .2, r / px * (top + .2 * u[4]),
                               (u[5] - .5) * .16, (u[6] - .5) * .16, (u[7] - .5) * .12))
            else:
                n = 6 + int(u[1] * 3)
                planes = []
                for k in range(n):
                    s, c = sin_cos((k + .5 * (unit(seed, 70, k, *key) - .5)) / n)
                    planes.append((c, s, r * (.62 + .38 * unit(seed, 71, k, *key))))
                # Normals at most 1.25 x 60 degrees apart keep every corner within 1.26 r of the centre.
                stones.append((cx, cy, r * 1.3 + 1., planes, base + (u[3] - .5) * .2, r / px * (top + .2 * u[4]),
                               r * (.5 + .2 * u[5]), (u[6] - .5) * .4 / px, (u[7] - .5) * .4 / px))
            c = pick(palette, u[8])
            tone = .93 + .14 * u[9]
            colours.append((c[0] * tone, c[1] * tone, c[2] * tone))
            roughs.append(.76 + .1 * unit(seed, 72, *key))
    return stones, colours, roughs


def ballast(spec):
    """White gravel ballast: two layers of rounded white and grey stones, 1.6 to 3 cm, over dark grit."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    palette = ((.6, (234., 232., 226.)), (.2, (202., 201., 197.)), (.11, (222., 212., 192.)),
               (.06, (158., 158., 155.)), (.03, (178., 152., 122.)))
    layers = ((2.1, 1., (.85, 1.55), 0., .52), (2.6, .9, (.8, 1.45), .5, .48))
    stones, colours, roughs = gravel_stones(seed, W, H, px, layers, palette)
    cv = Canvas(W, H, (112., 109., 103.), 0., .95)
    fine = field(Noise(seed + 4, W, H, 256, 256), H)
    for i, v in enumerate(field(Noise(seed + 5, W, H, 64, 64), H)):
        cv.height[i] = .15 * v
    owner, prof = [-1] * (W * H), [0.] * (W * H)
    splat_round(W, H, stones, cv.height, owner, prof)
    dirt = field(Fbm(seed + 2, W, H, ((4, 4), (8, 8), (16, 16)), (.5, .3, .2)), H)
    stones_colour(cv, owner, prof, colours, (112., 109., 103.), .95, fine, dirt, roughs, ao=.4, dirt_amount=.1)
    cover = sum(1 for o in owner if o >= 0) / len(owner)
    return cv.result(px, px, {'stones': len(stones), 'stone_cm': [1.6, 3.0], 'stone_cover': round(cover, 4)})


def tar(spec):
    """Tar and gravel: black, slightly glossy tar with small mixed gravel sunk into it, dust and old cracks."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    palette = ((.35, (138., 138., 135.)), (.25, (205., 202., 194.)), (.2, (158., 134., 100.)), (.2, (72., 70., 68.)))
    layers = ((1.3, .85, (.35, .9), -.25, .9),)
    stones, colours, roughs = gravel_stones(seed, W, H, px, layers, palette)
    cv = Canvas(W, H, (22., 21., 20.), 0., .45)
    bumps = field(Fbm(seed + 5, W, H, ((16, 16), (64, 64)), (.6, .4)), H)
    for i, v in enumerate(bumps):
        cv.height[i] = .08 * (v - .5)
    owner, prof = [-1] * (W * H), [0.] * (W * H)
    splat_round(W, H, stones, cv.height, owner, prof)
    fine = field(Noise(seed + 4, W, H, 256, 256), H)
    dust = field(Fbm(seed + 2, W, H, ((3, 3), (6, 6), (12, 12), (24, 24)), (.4, .3, .2, .1)), H)
    stones_colour(cv, owner, prof, colours, (22., 21., 20.), .45, fine, dust, roughs, ao=.15, dirt_amount=0.,
                  floor_cavity=.6)
    _, crack, _ = cells(seed + 9, W, H, 18. * px, .9)
    R, G, B, RO, CA, HT = cv.r, cv.g, cv.b, cv.rough, cv.cavity, cv.height
    for i, o in enumerate(owner):
        dusty = smooth(.56, .76, dust[i])
        if o >= 0:
            p = prof[i]
            if p < .35:                                # tar film creeping up the stone
                f = .75 * (1. - p / .35)
                R[i] += (22. - R[i]) * f
                G[i] += (21. - G[i]) * f
                B[i] += (20. - B[i]) * f
                RO[i] += (.45 - RO[i]) * f
            continue
        RO[i] = .38 + .14 * fine[i] + .4 * dusty
        k = 1. + 1.6 * dusty
        R[i], G[i], B[i] = R[i] * k, G[i] * k, B[i] * k * .97
        if crack[i] < 1.:
            f = 1. - crack[i]
            R[i], G[i], B[i] = R[i] * (1. - .5 * f), G[i] * (1. - .5 * f), B[i] * (1. - .5 * f)
            CA[i], HT[i] = 1., HT[i] - .05 * f
    cover = sum(1 for o in owner if o >= 0) / len(owner)
    return cv.result(px, px, {'stones': len(stones), 'stone_cm': [.6, 1.6], 'stone_cover': round(cover, 4),
                              'crack_cell_cm': 18.})


def sheet_metal(spec):
    """Corrugated galvanised steel: spangle, a side lap, screws on every second crest, patina and rust runs.

    The corrugations run along v (down the slope when v runs up it): crests at u = k / 14 m.
    """
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    pitch = W / CORRUGATIONS
    amp = CORRUGATION_DEPTH_CM / 2.
    profile = [sin_cos((x + .5) / pitch)[1] for x in range(W)]
    ids, border, n_cells = cells(seed + 1, W, H, 1.4 * px, .9)
    spangle = [unit(seed, 80, n) for n in range(n_cells)]
    spangle_r = [unit(seed, 81, n) for n in range(n_cells)]
    patina = field(Fbm(seed + 2, W, H, ((3, 3), (6, 6), (12, 12)), (.5, .3, .2)), H)
    white = field(Fbm(seed + 3, W, H, ((24, 24), (48, 48)), (.6, .4)), H)
    fine = field(Noise(seed + 4, W, H, 256, 256), H)
    cv = Canvas(W, H, (176., 180., 182.), 0., .4)
    lap_edge = .25 * pitch
    R, G, B, HT, RO, CA = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity
    for y in range(H):
        for x in range(W):
            i = y * W + x
            c = profile[x]
            h = amp * c
            e = wrap_delta(x + .5, lap_edge, W)
            if -pitch < e < 0.:
                h += .12
            sp = spangle[ids[i]] - .5
            dull = smooth(.5, .78, patina[i])
            k = (1. + .16 * sp) * (1. - .14 * dull) * (.82 + .18 * (c + 1.) * .5) * (1. + .04 * (fine[i] - .5))
            k *= 1. - .1 * (1. - smooth(0., .8, border[i]))
            rough = .36 + .12 * (spangle_r[ids[i]] - .5) + .26 * dull
            col = (176., 180., 182.)
            wr = smooth(.74, .86, white[i])
            if wr > 0.:
                col = tuple(v + (214. - v) * .55 * wr for v in col)
                rough += .3 * wr
            cav = 0.
            if -1. < e < 1.:
                k *= .55
                cav = 1.
            R[i], G[i], B[i] = col[0] * k, col[1] * k, col[2] * k
            HT[i], RO[i], CA[i] = h, rough, cav
    screws = []
    rng = Rng(seed + 7)
    for row in PURLINS:
        for crest in range(0, CORRUGATIONS, 2):
            screws.append((crest * pitch, row * H, rng.next(), rng.next(), rng.next()))
    for sx, sy, run, length, width in screws:
        if run < .45:                                  # rust run under the screw, down the slope
            L = (6. + 22. * length) * px
            w0 = (.5 + .7 * width) * px
            for py in range(floor(sy), floor(sy + L) + 1):
                t = (py + .5 - sy) / L
                if t < 0. or t > 1.:
                    continue
                w = w0 * (1. - .4 * t)
                a0 = .6 * (1. - t) * (1. - t)
                row = (py % H) * W
                for qx in range(floor(sx - w - 1), floor(sx + w) + 2):
                    f = a0 * (1. - smooth(.4 * w, w, abs(qx + .5 - sx)))
                    if f <= 0.:
                        continue
                    i = row + qx % W
                    R[i] += (128. - R[i]) * f
                    G[i] += (72. - G[i]) * f
                    B[i] += (38. - B[i]) * f
                    RO[i] += (.85 - RO[i]) * f
        disc(cv, sx, sy, .8 * px, (28., 28., 30.), amp + .25, .7, .6)       # neoprene washer
        disc(cv, sx, sy, .5 * px, (150., 152., 150.), amp + .4, .45)        # hex head
    return cv.result(px, px, {'corrugations_per_m': CORRUGATIONS, 'depth_cm': CORRUGATION_DEPTH_CM,
                              'crests_along': 'v', 'purlins_v': list(PURLINS), 'screws': len(screws)})


# ------------------------------------------------------------------------------------------------
# Walls

def lap_joints(seed, rows, width_cm):
    """One butt joint per course (cm along u), at least LAP_JOINT_GAP_CM from the courses above and below."""
    rng = Rng(seed)
    xs = []
    for r in range(rows):
        for _ in range(5000):
            x = rng.next() * width_cm
            if (not xs or cyclic_gap(x, xs[-1], width_cm) >= LAP_JOINT_GAP_CM) and \
                    (r < rows - 1 or cyclic_gap(x, xs[0], width_cm) >= LAP_JOINT_GAP_CM):
                xs.append(x)
                break
        else:
            raise AssertionError(f'No staggered butt joint for course {r}')
    return xs


def siding(spec):
    """Lap siding in neutral off-white: a wedge per course (Wave Texture saw profile), lap shadows, butt joints."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    E = H / LAP_ROWS
    exposure_cm = E / px
    joints = [x * px for x in lap_joints(seed, LAP_ROWS, spec['tile_m'][0] * 100.)]
    tone = [.97 + .06 * unit(seed, 90, r) for r in range(LAP_ROWS)]
    grain = field(Noise(seed + 1, W, H, 32, 256), H)
    streaks = field(Noise(seed + 2, W, H, 96, 3), H)
    mottle = field(Fbm(seed + 3, W, H, ((4, 2), (8, 4), (16, 8)), (.5, .3, .2)), H)
    cv = Canvas(W, H, (236., 234., 229.), 0., .5)
    R, G, B, HT, RO, CA = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity
    nose = .35
    shift = E / 2.                                     # rolled half a lap: the tile edge runs through a board
    for y in range(H):
        yl = (y + .5 - shift) % H
        r = min(int(yl / E), LAP_ROWS - 1)
        t = (yl - r * E) / E
        b = (1. - t) * exposure_cm                     # cm above the butt
        h0 = LAP_THIN_CM + (LAP_BUTT_CM - LAP_THIN_CM) * t
        if b < nose:
            h0 -= .9 * (1. - b / nose) ** 2
        shadow = (.56 + .44 * smooth(0., .16, t)) * (.9 + .1 * t)
        rough0 = .5 + .12 * (1. - smooth(0., .16, t))
        xj = joints[r]
        for x in range(W):
            i = y * W + x
            g = grain[i] - .5
            k = tone[r] * shadow * (1. + .06 * g) * (1. + .07 * (mottle[i] - .5)) * (1. + .05 * (streaks[i] - .5))
            h = h0 + .02 * g
            cav = 1. - smooth(0., .16, t)
            rough = rough0 + .06 * (mottle[i] - .5)
            dj = abs(wrap_delta(x + .5, xj, W))
            if dj < 1.5:
                k *= .78
                h -= .15
                cav, rough = 1., .7
            R[i], G[i], B[i] = 236. * k, 234. * k, 229. * k
            HT[i], RO[i], CA[i] = h, rough, cav
    return cv.result(px, px, {'courses': LAP_ROWS, 'exposure_cm': round(exposure_cm, 3), 'roll_cm': round(shift / px, 3),
                              'lap_cm': [LAP_THIN_CM, LAP_BUTT_CM], 'butt_joints_cm': [round(x / px, 2) for x in joints]})


def parging(spec):
    """Parged concrete: sandy cement render with trowel arcs, repair patches, efflorescence, hairline cracks."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    base = (152., 150., 144.)
    sand = field(Noise(seed + 1, W, H, 256, 256), H)
    mottle = field(Fbm(seed + 2, W, H, ((4, 4), (8, 8), (16, 16)), (.5, .3, .2)), H)
    bloom = field(Fbm(seed + 3, W, H, ((5, 5), (10, 10), (20, 20)), (.5, .3, .2)), H)
    cv = Canvas(W, H, base, 0., .88)
    R, G, B, HT, RO, CA = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity
    shade = [0.] * (W * H)
    for i in range(W * H):
        HT[i] = .06 * (sand[i] - .5) + .1 * (mottle[i] - .5)
    rng = Rng(seed)
    strokes = 70
    for _ in range(strokes):
        cx, cy = rng.next() * W, rng.next() * H
        radius, half = (18. + 22. * rng.next()) * px, (4. + 3. * rng.next()) * px
        my, mx = sin_cos(rng.next())
        cos_half = sin_cos(.12 + .18 * rng.next())[1]
        tone, smooth_r = (rng.next() - .5) * .12, .74 + .08 * rng.next()
        outer, inner = radius + half, radius - half
        for py in range(floor(cy - outer), floor(cy + outer) + 1):
            dy = py + .5 - cy
            o2 = outer * outer - dy * dy
            if o2 <= 0.:
                continue
            xo = sqrt(o2)
            i2 = inner * inner - dy * dy
            xi = sqrt(i2) if i2 > 0. else 0.
            row = (py % H) * W
            for lo, hi in ((cx - xo, cx - xi), (cx + xi, cx + xo)):
                for qx in range(floor(lo), floor(hi) + 1):
                    dx = qx + .5 - cx
                    d = sqrt(dx * dx + dy * dy)
                    if d < 1e-6:
                        continue
                    dot = (dx * mx + dy * my) / d
                    if dot <= cos_half:
                        continue
                    q = (d - radius) / half
                    if q <= -1. or q >= 1.:
                        continue
                    fade = smooth(0., .25, (dot - cos_half) / (1. - cos_half)) * (1. - smooth(.8, 1., abs(q)))
                    i = row + qx % W
                    HT[i] += .05 * smooth(.6, .95, q) * fade - .02 * fade
                    RO[i] += (smooth_r - RO[i]) * .8 * fade
                    shade[i] += (tone - shade[i]) * fade
    patches = []
    for _ in range(3):
        patches.append((rng.next() * W, rng.next() * H, (10. + 12. * rng.next()) * px, (rng.next() - .5) * .14))
    edge = field(Fbm(seed + 4, W, H, ((16, 16), (32, 32)), (.6, .4)), H)
    for y in range(H):
        for x in range(W):
            i = y * W + x
            k = 1. + .14 * (sand[i] - .5) + .12 * (mottle[i] - .5) + shade[i]
            for pcx, pcy, pr, pt in patches:
                dx, dy = wrap_delta(x + .5, pcx, W), wrap_delta(y + .5, pcy, H)
                rr = sqrt(dx * dx + dy * dy) / pr - .3 * (edge[i] - .5)
                if rr < 1.:
                    k += pt
                    RO[i] = .8
                    if rr > .9:
                        HT[i] += .04
                        CA[i] = max(CA[i], .5)
            col = [base[n] * k for n in range(3)]
            f = .3 * smooth(.7, .84, bloom[i])
            if f > 0.:
                col = [col[n] + ((206., 204., 197.)[n] - col[n]) * f for n in range(3)]
                RO[i] += .05 * f
            R[i], G[i], B[i] = col
    cracks = 6
    for _ in range(cracks):
        x, y = rng.next() * W, rng.next() * H
        heading = rng.next()
        for _ in range(int(20 + 40 * rng.next())):
            heading += (rng.next() - .5) * .12
            s, c = sin_cos(heading)
            seg = 1.5 * px
            for n in range(int(seg * 2)):
                x += c * .5
                y += s * .5
                for ox, oy in ((0, 0), (1, 0)) if rng.next() < .3 else ((0, 0),):
                    i = (floor(y) + oy) % H * W + (floor(x) + ox) % W
                    R[i], G[i], B[i] = R[i] * .78, G[i] * .78, B[i] * .78
                    HT[i], CA[i], RO[i] = HT[i] - .12, 1., .95
    return cv.result(px, px, {'trowel_strokes': strokes, 'cracks': cracks, 'patches': len(patches)})


# ------------------------------------------------------------------------------------------------
# Cut-out cards: u metres along the run, v 0..1 from the bottom of the card to its top

def card_px(spec):
    W, H = spec['size_px']
    return W / (spec['tile_m'][0] * 100.), H / (spec['card_height_m'] * 100.)


def balusters(spec):
    """Gallery guard: 2x2 balusters at 12.5 cm between a 2x4 bottom rail and a 2x4 top rail under a 2x2 cap."""
    W, H = spec['size_px']
    seed = spec['seed']
    pxx, pxy = card_px(spec)
    bands = GUARD_BANDS_CM
    pitch = 100. / BALUSTERS_PER_M
    half = BALUSTER_CM / 2.
    vgrain = field(Noise(seed + 1, W, H, 128, 8), H)
    hgrain = field(Noise(seed + 2, W, H, 8, 128), H)
    wear = field(Fbm(seed + 3, W, H, ((16, 16), (32, 32), (64, 64)), (.5, .3, .2)), H)
    mottle = field(Fbm(seed + 4, W, H, ((4, 4), (8, 8)), (.6, .4)), H)
    tone = [.95 + .1 * unit(seed, 91, k) for k in range(BALUSTERS_PER_M)]
    paint, wood = (214., 210., 202.), (140., 112., 84.)
    cv = Canvas(W, H, paint, 0., .65, alpha=0.)
    R, G, B, HT, RO, CA, AL = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity, cv.alpha
    for y in range(H):
        z = (H - y - .5) / pxy
        band = next(name for name, (lo, hi) in bands.items() if z < hi or name == 'cap')
        lo, hi = bands[band]
        for x in range(W):
            i = y * W + x
            xcm = (x + .5) / pxx
            k_bal = min(int(xcm / pitch), BALUSTERS_PER_M - 1)
            dxb = abs(xcm - (k_bal + .5) * pitch)
            if band == 'gap':                       # below the bottom rail: open, edge anti-aliased
                d_cm, sd, horizontal = 0., (z - hi) * pxy, True
            elif band == 'bottom_rail':
                d_cm, sd, horizontal = min(z - lo, hi - z), (z - lo) * pxy, True
            elif band == 'balusters':
                d_cm, horizontal = half - dxb, False
                sd = max(d_cm * pxx, (lo - z) * pxy, (z - hi) * pxy)
            else:
                d_cm, sd, horizontal = min(z - lo, hi - z), 1e3, True
            a = 1. if sd >= .5 else 0. if sd <= -.5 else sd + .5
            dd = max(0., d_cm)
            h = min(2.4 if band == 'cap' else 1.9, .5 + 3.5 * dd) if a > 0. else 0.
            g = (hgrain[i] if horizontal else vgrain[i]) - .5
            k = (tone[k_bal] if band == 'balusters' and a > 0. else 1.) * (1. + .1 * g) * (1. + .08 * (mottle[i] - .5))
            col = paint
            worn = smooth(.6, .7, wear[i]) * (1. - smooth(.2, .6, dd))
            if worn > 0.:
                col = tuple(col[n] + (wood[n] - col[n]) * worn for n in range(3))
            if band == 'bottom_rail':
                k *= .9
            if band == 'top_rail' and z > hi - 1.5:
                k *= .7 + .3 * smooth(0., 1.5, hi - z)         # shade under the cap
            cav = 1. - a
            if band == 'balusters' and a > 0. and (z - lo < .3 or hi - z < .3):
                k, cav = k * .55, 1.
            if band == 'balusters' and a > 0. and (abs(z - lo - 1.6) < .25 or abs(hi - z - 1.6) < .25) and dxb < .25:
                k, cav = .35, .8                                # screw heads
            R[i], G[i], B[i] = col[0] * k, col[1] * k, col[2] * k
            HT[i], RO[i], CA[i], AL[i] = h + .03 * g, .65 + .15 * worn, cav, a
    return cv.result(pxx, pxy, {'card_height_cm': bands['cap'][1], 'bands_cm': {k: list(v) for k, v in bands.items()},
                                'balusters_per_m': BALUSTERS_PER_M, 'baluster_cm': BALUSTER_CM,
                                'clear_gap_cm': round(pitch - BALUSTER_CM, 2)}, wrap_y=False)


def lattice(spec):
    """Diagonal lattice: two layers of 3.8 cm laths at +-45 degrees, stapled at the crossings, in a 5 cm frame."""
    W, H = spec['size_px']
    seed = spec['seed']
    pxx, pxy = card_px(spec)
    top_cm = spec['card_height_m'] * 100.
    hs = 100. / LATTICE_PER_M                      # along the run between parallel laths
    half = LATH_CM / 2.
    fr = LATTICE_FRAME_CM
    grain = field(Noise(seed + 1, W, H, 128, 128), H)
    frame_grain = field(Noise(seed + 2, W, H, 8, 128), H)
    mottle = field(Fbm(seed + 3, W, H, ((4, 4), (8, 8)), (.6, .4)), H)
    tone_a = [.94 + .12 * unit(seed, 92, k) for k in range(2 * LATTICE_PER_M + 2)]
    tone_b = [.94 + .12 * unit(seed, 93, k) for k in range(2 * LATTICE_PER_M + 2)]
    paint = (205., 198., 186.)
    cv = Canvas(W, H, paint, 0., .7, alpha=0.)
    R, G, B, HT, RO, CA, AL = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity, cv.alpha
    for y in range(H):
        z = (H - y - .5) / pxy
        frame_d = max(fr - z, z - (top_cm - fr))   # > 0 inside a frame board
        for x in range(W):
            i = y * W + x
            xcm = (x + .5) / pxx
            m1 = (xcm + z) % hs
            d1 = min(m1, hs - m1) / SQRT2
            m2 = (xcm - z) % hs
            d2 = min(m2, hs - m2) / SQRT2
            sa, sb = (half - d1) * pxx, (half - d2) * pxx
            k = 1. + .08 * (grain[i] - .5) + .06 * (mottle[i] - .5)
            cav = 0.
            if frame_d > 0.:
                sd = 1e3
                k *= .97 + .06 * (frame_grain[i] - .5)
                h = 2.4
                if frame_d < .3:                    # shadow line where the frame board covers the laths
                    k, cav, h = k * .6, .8, 1.9
            elif sa > -.5:
                sd = sa
                h = .95 + min(.95, (half - d1) * 2.5)
                k *= tone_a[int((xcm + z) // hs) % len(tone_a)]
                if d1 < .35 and d2 < .35:
                    k, cav = k * .35, .6                # staple
            elif sb > -.5:
                sd = sb
                h = min(.95, (half - d2) * 2.5)
                k *= tone_b[int((xcm - z) // hs) % len(tone_b)] * (.62 + .38 * smooth(half, half + .9, d1))
            else:
                sd = max(sa, sb)
                h = 0.
                cav = 1.
            if -1. < frame_d <= 0.:
                sd = max(sd, frame_d * pxy)
            a = 1. if sd >= .5 else 0. if sd <= -.5 else sd + .5
            R[i], G[i], B[i] = paint[0] * k, paint[1] * k, paint[2] * k
            HT[i], RO[i], CA[i], AL[i] = h * (1. if a > 0. else 0.), .7, max(cav, 1. - a), a
    return cv.result(pxx, pxy, {'card_height_cm': top_cm, 'laths_per_m': LATTICE_PER_M, 'lath_cm': LATH_CM,
                                'opening_cm': round(hs / SQRT2 - LATH_CM, 2), 'frame_cm': fr}, wrap_y=False)


def fence_boards(spec):
    """Board fence: 12 weathered boards per 2 m with 1.2-3 cm gaps, knots and nails, two rails seen through gaps."""
    W, H = spec['size_px']
    seed = spec['seed']
    pxx, pxy = card_px(spec)
    top_cm = spec['card_height_m'] * 100.
    span = spec['tile_m'][0] * 100.
    pitch = span / FENCE_BOARDS
    boards = []
    for k in range(FENCE_BOARDS):
        u = [unit(seed, 94, k, n) for n in range(10)]
        knots = []
        for n in range(int(u[6] * 2.6)):
            knots.append(((unit(seed, 95, k, n) - .5) * 9., 30. + (top_cm - 50.) * unit(seed, 96, k, n),
                          .8 + .6 * unit(seed, 97, k, n), 1.2 + 1. * unit(seed, 98, k, n)))
        boards.append({'c': (k + .5) * pitch + (u[0] - .5) * .8, 'w': FENCE_BOARD_CM + (u[1] - .5),
                       'bottom': 2.5 + (u[2] - .5) * 2.4, 'top': top_cm - 2.4 * u[3], 'tilt': (u[4] - .5) * 1.2,
                       'tone': .9 + .2 * u[5], 'algae': u[7] < .35, 'knots': knots, 'rust': (u[8] < .4, u[9] < .4)})
    grain = field(Noise(seed + 1, W, H, 160, 6), H)
    fine = field(Noise(seed + 2, W, H, 256, 64), H)
    mottle = field(Fbm(seed + 3, W, H, ((4, 4), (8, 8), (16, 16)), (.5, .3, .2)), H)
    wood, rail_col = (168., 152., 132.), (118., 106., 92.)
    cv = Canvas(W, H, wood, 0., .8, alpha=0.)
    R, G, B, HT, RO, CA, AL = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity, cv.alpha
    nails = [(lo + hi) / 2. for lo, hi in FENCE_RAILS_CM]
    for y in range(H):
        z = (H - y - .5) / pxy
        rail = next(((lo, hi) for lo, hi in FENCE_RAILS_CM if lo - 1. < z < hi + 1.), None)
        rail_sd = min(z - rail[0], rail[1] - z) * pxy if rail else -1.
        rail_a = 1. if rail_sd >= .5 else 0. if rail_sd <= -.5 else rail_sd + .5
        rk = .62
        for x in range(W):
            i = y * W + x
            xcm = (x + .5) / pxx
            kb = int(xcm / pitch)
            best, bd = None, -1e9
            for kk in (kb - 1, kb, kb + 1):
                b = boards[kk % FENCE_BOARDS]
                dx = wrap_delta(xcm, b['c'], span)
                dh = b['w'] / 2. - abs(dx)
                ztop = b['top'] + b['tilt'] * dx / (b['w'] / 2.)
                dv = min(z - b['bottom'], ztop - z)
                sd = min(dh * pxx, dv * pxy)
                if sd > bd:
                    best, bd, bdx, bdh, bdv = b, sd, dx, dh, dv
            b = best
            if bd > -.5:
                rel = bdx / (b['w'] / 2.)
                g = grain[i] - .5
                h = min(1.6 - .25 * rel * rel, .4 + 3. * max(0., bdh)) + .06 * g
                k = b['tone'] * (1. + .22 * g) * (1. + .1 * (fine[i] - .5)) * (1. + .1 * (mottle[i] - .5))
                col = wood
                if z < 22.:                                     # splash and damp at the foot
                    k *= .78 + .22 * z / 22.
                    if b['algae']:
                        f = .35 * (1. - z / 22.)
                        col = tuple(col[n] + ((95., 108., 70.)[n] - col[n]) * f for n in range(3))
                if bdv < .6 and z > top_cm / 2.:
                    k *= .75                                    # end grain at the top
                rough, cav = .8, 0.
                for kx, kz, rx, rz in b['knots']:
                    q = ((bdx - kx) / rx) ** 2 + ((z - kz) / rz) ** 2
                    if q < 2.2:
                        if q < 1.:
                            col, k, rough = (86., 60., 40.), k * (.8 + .2 * q), .7
                            h -= .08
                        else:
                            k *= .85 + .15 * (q - 1.) / 1.2
                for n, nz in enumerate(nails):
                    for nx_ in (-4., 4.):
                        q = (bdx - nx_) ** 2 + (z - nz) ** 2
                        if q < .09:
                            col, k, cav = (60., 55., 50.), 1., .7
                        elif b['rust'][n] and abs(bdx - nx_) < .35 and nz - 5. < z < nz:
                            f = .4 * (z - nz + 5.) / 5.
                            col = tuple(col[m] + ((110., 70., 40.)[m] - col[m]) * f for m in range(3))
                a = 1. if bd >= .5 else bd + .5
                c = [col[n] * k for n in range(3)]
                if a < 1. and rail_a > 0.:                      # the rail shows behind the board's soft edge
                    c = [c[n] * a + rail_col[n] * rk * (1. - a) for n in range(3)]
                    h, a = h * a + .3 * (1. - a), max(a, rail_a)
                R[i], G[i], B[i] = c
                HT[i], RO[i], CA[i], AL[i] = h, rough, max(cav, 1. - a), a
            elif rail is not None:
                a = rail_a
                k = rk * (1. + .1 * (grain[i] - .5))
                R[i], G[i], B[i] = rail_col[0] * k, rail_col[1] * k, rail_col[2] * k
                HT[i], RO[i], CA[i], AL[i] = .3 * a, .85, .5 + .5 * (1. - a), a
            else:
                CA[i] = 1.
    return cv.result(pxx, pxy, {'card_height_cm': top_cm, 'boards': FENCE_BOARDS, 'board_cm': FENCE_BOARD_CM,
                                'pitch_cm': round(pitch, 3), 'rails_cm': [list(r) for r in FENCE_RAILS_CM]}, wrap_y=False)


# ------------------------------------------------------------------------------------------------
# Creeper

CREEPER_PALETTE = ((.3, (196., 34., 30.)), (.27, (150., 20., 38.)), (.14, (100., 22., 48.)),
                   (.12, (210., 82., 32.)), (.12, (66., 100., 40.)), (.05, (150., 148., 50.)))


def creeper(spec):
    """Virginia creeper (vigne vierge) in October: palmate leaves of five serrated leaflets over woody vines.

    Scarlet, crimson and wine leaves with some orange and a few still green ones reddening from the margin;
    lower leaves are shaded. Holes between the leaves show the wall (alpha 0).
    """
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    cv = Canvas(W, H, (120., 30., 34.), 0., .8, alpha=0.)
    for i in range(W * H):
        cv.cavity[i] = 1.
    blotch = field(Fbm(seed + 1, W, H, ((32, 32), (64, 64), (128, 128)), (.5, .3, .2)), H)
    rng = Rng(seed)
    vines = 7
    for _ in range(vines):
        x, y = rng.next() * W, rng.next() * H
        heading = .25 + (rng.next() - .5) * .5
        r = (.25 + .2 * rng.next()) * px
        for _ in range(45):
            heading += (rng.next() - .5) * .1
            s, c = sin_cos(heading)
            for _ in range(int(4. * px / .8)):
                x += c * .8
                y += s * .8
                disc(cv, x, y, r, (96., 72., 58.), .3, .82)
    leaves = []
    for cx, cy, key in scatter(seed + 3, W, H, 9. * px, 1.) + scatter(seed + 4, W, H, 9. * px, .85, 1):
        u = [unit(seed, 60 + n, *key) for n in range(9)]
        leaves.append((u[0], cx, cy, u))
    leaves.sort()
    for z, cx, cy, u in leaves:
        length = (6. + 5. * u[1]) * px
        main = .25 + (u[2] - .5) * .8
        colour = pick(CREEPER_PALETTE, u[3])
        tone = .9 + .2 * u[4]
        colour = tuple(c * tone for c in colour)
        green = colour[1] > colour[0]
        edge = (176., 40., 32.) if green else pick(CREEPER_PALETTE, u[5])
        amount = .55 * u[6] if green else .35 * u[6]
        shade = .66 + .34 * z
        s, c = sin_cos(main + .5)
        stalk = (3. + 3. * u[7]) * px                  # petiole, behind the leaflets
        steps = int(stalk / .7) + 1
        for n in range(steps):
            f = n / steps
            disc(cv, cx + c * stalk * f, cy + s * stalk * f, .6, (112. * shade, 30. * shade, 28. * shade),
                 z * 1.2 - .1, .7)
        for n, (offset, scale) in enumerate(((-.2, .62), (-.1, .86), (0., 1.), (.1, .86), (.2, .62))):
            turn = main + offset + (unit(seed, 66, n, int(u[8] * 1e6)) - .5) * .04
            leaflet(cv, cx, cy, turn, length * scale, length * scale * .21, z * 1.2, colour, edge, amount, blotch,
                    9, .52 + .1 * u[8], shade)
    cover = sum(1 for a in cv.alpha if a >= .5) / (W * H)
    return cv.result(px, px, {'leaves': len(leaves), 'leaflet_cm': [6., 11.], 'vines': vines,
                              'cover': round(cover, 4)})


# ------------------------------------------------------------------------------------------------
# Yard ground

LEAF_PALETTE = ((.3, (214., 168., 40.)), (.3, (208., 110., 32.)), (.22, (168., 42., 30.)), (.18, (122., 82., 46.)))


def lawn(spec):
    """An October lawn from above: blades over soil, thin patches, clover, fallen maple leaves."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    cv = Canvas(W, H, (78., 62., 45.), 0., .95)
    soil = field(Noise(seed + 1, W, H, 128, 128), H)
    for i, v in enumerate(soil):
        k = .85 + .3 * v
        cv.r[i], cv.g[i], cv.b[i] = 78. * k, 62. * k, 45. * k
        cv.cavity[i] = .8
    density = Fbm(seed + 2, W, H, ((6, 6), (12, 12), (24, 24)), (.5, .3, .2))
    dens = field(density, H)
    blades = ((.22, (58., 92., 36.)), (.24, (72., 108., 42.)), (.2, (88., 118., 48.)), (.14, (104., 126., 56.)),
              (.11, (136., 132., 70.)), (.09, (122., 104., 70.)))
    count = W * H // 3
    for n in range(count):
        x, y = unit(seed, 40, n) * W, unit(seed, 41, n) * H
        if unit(seed, 42, n) > .4 + .6 * smooth(.28, .5, dens[(int(y) % H) * W + int(x) % W]):
            continue
        stroke(cv, x, y, unit(seed, 43, n), (1.2 + 2.4 * unit(seed, 44, n)) * px, pick(blades, unit(seed, 45, n)),
               .3 + .6 * unit(seed, 46, n), .9)
    rng = Rng(seed)
    clover = 6
    for _ in range(clover):
        cx, cy, rad = rng.next() * W, rng.next() * H, (6. + 6. * rng.next()) * px
        for _ in range(30):
            s, c = sin_cos(rng.next())
            d = rad * sqrt(rng.next())
            x, y = cx + c * d, cy + s * d
            for leaf in range(3):
                ls, lc = sin_cos(leaf / 3. + rng.next() * .1)
                disc(cv, x + lc * .45 * px, y + ls * .45 * px, .45 * px, (70., 118., 50.), 1., .85)
    blotch = field(Noise(seed + 3, W, H, 128, 128), H)
    fallen = 34
    for _ in range(fallen):
        x, y = rng.next() * W, rng.next() * H
        colour = pick(LEAF_PALETTE, rng.next())
        maple_leaf(cv, x, y, (5. + 3. * rng.next()) * px, rng.next(), 1.3 + .2 * rng.next(), colour, blotch)
    return cv.result(px, px, {'blade_strokes': count, 'clover_patches': clover, 'fallen_leaves': fallen})


def herringbone():
    """{(i, j): (kind, dx, dy)} for a 4 x 4 unit cell: the paver kind and the cell's place within its paver."""
    cells_ = {}
    for k in range(4):
        cells_[k % 4, k % 4] = ('h', 0, 0)
        cells_[(k + 1) % 4, k % 4] = ('h', 1, 0)
        cells_[k % 4, (k + 1) % 4] = ('v', 0, 0)
        cells_[k % 4, (k + 2) % 4] = ('v', 0, 1)
    assert len(cells_) == 16, 'Herringbone motif does not tile the 4 x 4 cell'
    return cells_


def pavers(spec):
    """Concrete pavers (pavé uni), 10 x 20 cm in a 90-degree herringbone, chamfered, sand joints with some moss."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    unit_px = PAVER_CM * px
    n_units = round(spec['tile_m'][0] * 100. / PAVER_CM)
    assert n_units % 4 == 0 and abs(n_units * unit_px - W) < 1e-6
    motif = herringbone()
    palette = ((.45, (138., 136., 131.)), (.25, (156., 154., 148.)), (.15, (108., 107., 105.)), (.15, (150., 141., 126.)))
    speck = field(Noise(seed + 1, W, H, 256, 256), H)
    stain = field(Fbm(seed + 2, W, H, ((5, 5), (10, 10), (20, 20)), (.5, .3, .2)), H)
    moss = field(Fbm(seed + 3, W, H, ((8, 8), (16, 16), (64, 64)), (.4, .3, .3)), H)
    cv = Canvas(W, H, (156., 146., 124.), 0., .9)
    R, G, B, HT, RO, CA = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity
    colours = {}
    for y in range(H):
        uy = (y + .5) / unit_px
        j = int(uy)
        fy = uy - j
        for x in range(W):
            i = y * W + x
            ux = (x + .5) / unit_px
            ii = int(ux)
            fx = ux - ii
            kind, ox, oy = motif[ii % 4, j % 4]
            lx, ly = ox + fx, oy + fy
            wu, hu = (2, 1) if kind == 'h' else (1, 2)
            d = min(lx, wu - lx, ly, hu - ly) * PAVER_CM
            origin = ((ii - ox) % n_units, (j - oy) % n_units, kind)
            if origin not in colours:
                u = [unit(seed, 99, origin[0], origin[1], n) for n in range(2)]
                c = pick(palette, u[0])
                tone = .94 + .12 * u[1]
                colours[origin] = (c[0] * tone, c[1] * tone, c[2] * tone)
            if d < PAVER_JOINT_CM:
                col, h, rough, cav = (156., 146., 124.), .05 * speck[i], .95, 1.
                if moss[i] > .62:
                    col, rough = (76., 92., 44.), .9
            else:
                col = colours[origin]
                bevel = smooth(PAVER_JOINT_CM, PAVER_CHAMFER_CM, d)
                k = (.82 + .18 * bevel) * (1. - .18 * smooth(.62, .8, stain[i]))
                if speck[i] > .8:
                    k *= .85
                elif speck[i] < .2:
                    k *= 1.1
                col = (col[0] * k, col[1] * k * .99, col[2] * k * .97)
                h, rough, cav = 1. * bevel + .03 * (speck[i] - .5), .8, .4 * (1. - bevel)
            R[i], G[i], B[i] = col
            HT[i], RO[i], CA[i] = h, rough, cav
    return cv.result(px, px, {'pattern': 'herringbone 90 degrees', 'paver_cm': [PAVER_CM, 2 * PAVER_CM],
                              'joint_cm': 2 * PAVER_JOINT_CM, 'chamfer_cm': PAVER_CHAMFER_CM, 'pavers': len(colours)})


def soil(spec):
    """Garden-bed soil: crumbly clods, a few pebbles, straw and wood bits, damp patches, some fallen leaves."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    damp = field(Fbm(seed + 1, W, H, ((4, 4), (8, 8), (16, 16)), (.5, .3, .2)), H)
    fine = field(Noise(seed + 2, W, H, 256, 256), H)
    cv = Canvas(W, H, (74., 57., 42.), 0., .95)
    for i in range(W * H):
        cv.height[i] = .2 * (fine[i] - .5)
    clods_palette = ((.5, (82., 63., 46.)), (.3, (66., 50., 37.)), (.2, (98., 78., 58.)))
    stones, colours, roughs = gravel_stones(seed, W, H, px, ((2.4, .85, (.6, 1.8), 0., .45),), clods_palette)
    pebble_stones, pebble_colours, pebble_roughs = gravel_stones(
        seed + 11, W, H, px, ((9., .5, (.3, .7), .2, .7),), ((.6, (138., 132., 120.)), (.4, (160., 140., 110.))))
    stones += pebble_stones
    colours += pebble_colours
    roughs += pebble_roughs
    owner, prof = [-1] * (W * H), [0.] * (W * H)
    splat_round(W, H, stones, cv.height, owner, prof)
    stones_colour(cv, owner, prof, colours, (60., 46., 34.), .97, fine, damp, roughs, ao=.35, dirt_amount=0.,
                  floor_cavity=.8)
    for i in range(W * H):
        f = smooth(.5, .7, damp[i])
        if f > 0.:
            k = 1. - .2 * f
            cv.r[i], cv.g[i], cv.b[i] = cv.r[i] * k, cv.g[i] * k, cv.b[i] * k
            cv.rough[i] -= .2 * f
    rng = Rng(seed)
    straws = 450
    for _ in range(straws):
        colour = (150., 118., 78.) if rng.next() < .6 else (96., 70., 45.)
        stroke(cv, rng.next() * W, rng.next() * H, rng.next(), (1.5 + 3.5 * rng.next()) * px, colour,
               .6 + .3 * rng.next(), .85, .1)
    blotch = field(Noise(seed + 3, W, H, 128, 128), H)
    fallen = 9
    for _ in range(fallen):
        maple_leaf(cv, rng.next() * W, rng.next() * H, (5. + 3. * rng.next()) * px, rng.next(), 1.2,
                   pick(((.6, (122., 82., 46.)), (.4, (190., 110., 40.))), rng.next()), blotch)
    return cv.result(px, px, {'clods': len(stones) - len(pebble_stones), 'pebbles': len(pebble_stones),
                              'straws': straws, 'fallen_leaves': fallen})


def crushed_stone(spec):
    """Grey crushed limestone (3/4 in net): angular chips of 1.4 to 2.6 cm in two layers over dusty fines."""
    W, H = spec['size_px']
    seed = spec['seed']
    px = W / (spec['tile_m'][0] * 100.)
    palette = ((.35, (150., 150., 148.)), (.25, (126., 128., 130.)), (.2, (176., 174., 168.)),
               (.12, (104., 106., 110.)), (.08, (160., 150., 136.)))
    layers = ((1.9, 1., (.7, 1.3), 0., .5), (2.3, .8, (.7, 1.2), .3, .45))
    stones, colours, roughs = gravel_stones(seed, W, H, px, layers, palette, round_stones=False)
    cv = Canvas(W, H, (124., 118., 108.), 0., .95)
    fine = field(Noise(seed + 4, W, H, 256, 256), H)
    for i, v in enumerate(field(Noise(seed + 5, W, H, 64, 64), H)):
        cv.height[i] = .15 * v
    owner, prof = [-1] * (W * H), [0.] * (W * H)
    splat_angular(W, H, stones, cv.height, owner, prof)
    dirt = field(Fbm(seed + 2, W, H, ((4, 4), (8, 8), (16, 16)), (.5, .3, .2)), H)
    stones_colour(cv, owner, prof, colours, (124., 118., 108.), .95, fine, dirt, roughs, ao=.22, dirt_amount=.1)
    cover = sum(1 for o in owner if o >= 0) / len(owner)
    return cv.result(px, px, {'stones': len(stones), 'stone_cm': [1.4, 2.6], 'stone_cover': round(cover, 4)})


GENERATORS = {'membrane': membrane, 'ballast': ballast, 'tar': tar, 'sheet_metal': sheet_metal, 'siding': siding,
              'parging': parging, 'balusters': balusters, 'lattice': lattice, 'fence_boards': fence_boards,
              'creeper': creeper, 'lawn': lawn, 'pavers': pavers, 'soil': soil, 'crushed_stone': crushed_stone}


def generate(key):
    """The maps of one set before encoding: diff rows (bytes), height, roughness and cavity rows, px per cm."""
    spec = SETS[key]
    if key in ('limestone', 'slate'):
        diff, heights, rough, cavity, px_cm, layout = (limestone if key == 'limestone' else slate)(spec)
        return {'diff': diff, 'heights': heights, 'rough': rough, 'cavity': cavity, 'px': (px_cm, px_cm),
                'layout': layout, 'channels': 3, 'wrap_y': True}
    return GENERATORS[key](spec)


# ------------------------------------------------------------------------------------------------
# Maps and PNG

def normal_rows(heights, px_cm, px_cm_y=None, wrap_y=True):
    """DirectX tangent-space normals from a height field in cm: n = (-dh/dcol, -dh/drow, 1).

    px_cm is texels per cm along u (and v unless px_cm_y says otherwise: the cards stretch v over their
    height). Tiling sets wrap at every edge; cards wrap only along u and take one-sided steps at the top
    and bottom rows.
    """
    rows, width = len(heights), len(heights[0])
    k = px_cm / 2.   # central difference over 2 px, height in cm
    ky = k if px_cm_y is None else px_cm_y / 2.
    left = [(x - 1) % width for x in range(width)]
    right = [(x + 1) % width for x in range(width)]
    out = []
    for y in range(rows):
        if wrap_y:
            up, down = heights[(y - 1) % rows], heights[(y + 1) % rows]
        else:
            up, down = heights[max(y - 1, 0)], heights[min(y + 1, rows - 1)]
        mid = heights[y]
        row = bytearray(width * 3)
        for x in range(width):
            sx = (mid[right[x]] - mid[left[x]]) * k
            sy = (down[x] - up[x]) * ky
            inv = 1. / sqrt(sx * sx + sy * sy + 1.)
            o = 3 * x
            row[o] = byte((.5 - .5 * sx * inv) * 255.)
            row[o + 1] = byte((.5 - .5 * sy * inv) * 255.)
            row[o + 2] = byte((.5 + .5 * inv) * 255.)
        out.append(bytes(row))
    return out


def mask_rows(rough, heights, cavity):
    lo = min(min(r) for r in heights)
    hi = max(max(r) for r in heights)
    span = (hi - lo) or 1.
    out = []
    for rr, hr, cr in zip(rough, heights, cavity):
        row = bytearray(len(rr) * 3)
        for x, (a, b, c) in enumerate(zip(rr, hr, cr)):
            o = 3 * x
            row[o], row[o + 1], row[o + 2] = byte(a * 255.), byte((b - lo) / span * 255.), byte(c * 255.)
        out.append(bytes(row))
    return out


def raw_stream(rows):
    """PNG scanlines with filter type 0: the decompressed IDAT stream."""
    return b''.join(b'\x00' + r for r in rows)


def png(width, height, raw, channels=3):
    """An 8-bit RGB (3 channels) or RGBA (4) PNG from a raw filter-0 stream."""
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & MASK)
    colour_type = {3: 2, 4: 6}[channels]
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, colour_type, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def read_png_channels(data):
    """(width, height, channels, decompressed IDAT stream) of an 8-bit RGB or RGBA PNG written by png()."""
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'Not a PNG'
    pos, idat, size = 8, b'', None
    while pos < len(data):
        n, = struct.unpack('>I', data[pos:pos + 4])
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]
        crc, = struct.unpack('>I', data[pos + 8 + n:pos + 12 + n])
        assert zlib.crc32(kind + body) & MASK == crc, 'Bad PNG chunk CRC'
        if kind == b'IHDR':
            size = struct.unpack('>IIBBBBB', body)
            assert size[2] == 8 and size[3] in (2, 6) and size[4:] == (0, 0, 0), 'Expected 8-bit RGB or RGBA, no interlace'
        elif kind == b'IDAT':
            idat += body
        pos += 12 + n
    channels = 3 if size[3] == 2 else 4
    raw = zlib.decompress(idat)
    assert len(raw) == size[1] * (1 + channels * size[0]), 'Truncated image stream'
    return size[0], size[1], channels, raw


def read_png(data):
    """(width, height, decompressed IDAT stream) of an 8-bit RGB or RGBA PNG written by png()."""
    width, height, _, raw = read_png_channels(data)
    return width, height, raw


SRGB_TO_LINEAR = [(v / 255 / 12.92) if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4 for v in range(256)]


def linear_mean(rows, channels=3):
    """Mean linear colour; for RGBA rows, over the opaque texels (alpha >= 128) only."""
    sums = [0., 0., 0.]
    n = 0
    for row in rows:
        if channels == 3:
            for i in range(3):
                sums[i] += sum(SRGB_TO_LINEAR[v] for v in row[i::3])
            n += len(row) // 3
        else:
            alpha = row[3::4]
            for i in range(3):
                sums[i] += sum(SRGB_TO_LINEAR[v] for v, a in zip(row[i::4], alpha) if a >= 128)
            n += sum(1 for a in alpha if a >= 128)
    return [round(s / n, 4) for s in sums]


def channel_mean(rows, channel, alpha=None):
    """Mean of one channel of 3-channel rows (0..1); with alpha rows, over the opaque texels only."""
    if alpha is None:
        return sum(sum(r[channel::3]) for r in rows) / (255. * sum(len(r) // 3 for r in rows))
    total = n = 0
    for r, a in zip(rows, alpha):
        for v, m in zip(r[channel::3], a):
            if m >= 128:
                total += v
                n += 1
    return total / (255. * n)


def to_srgb_hex(linear):
    out = []
    for v in linear:
        s = v * 12.92 if v <= .0031308 else 1.055 * v ** (1 / 2.4) - .055
        out.append(min(255, max(0, int(s * 255. + .5))))
    return '#' + ''.join(f'{v:02X}' for v in out)


def file_name(key, role):
    return f'T_Replica_{SETS[key]["name"]}_{role}.png'


def build(key):
    """{file name: png bytes} and the index entry for one set."""
    spec = SETS[key]
    width, height = spec['size_px']
    g = generate(key)
    channels = g['channels']
    px_x, px_y = g['px']
    maps = {'diff': g['diff'], 'nor_dx': normal_rows(g['heights'], px_x, px_y, g['wrap_y']),
            'rough': mask_rows(g['rough'], g['heights'], g['cavity'])}
    alpha = [r[3::4] for r in g['diff']] if channels == 4 else None
    card = 'card_height_m' in spec
    mean = linear_mean(g['diff'], channels)
    entry = {'size_px': [width, height], 'tile_m': list(spec['tile_m']),
             'tiling': [round(1 / spec['tile_m'][0], 6), round(1 / spec['tile_m'][1], 6)],
             'mean_linear': mean, 'roughness_mean': round(channel_mean(maps['rough'], 0, alpha), 4),
             'layout': g['layout'], 'maps': {}, 'surface': spec['surface'], 'material': dict(SURFACES[spec['surface']]),
             'keys': list(spec['keys']), 'uv': 'card' if card else 'metres', 'alpha': channels == 4,
             'base_color_srgb': to_srgb_hex(mean)}
    if card:
        entry['card_height_m'] = spec['card_height_m']
    if alpha is not None:
        entry['coverage'] = round(sum(sum(1 for v in a if v >= 128) for a in alpha) / (width * height), 4)
    if 'metallic' in spec:
        entry['metallic'] = spec['metallic']
    files = {}
    for role in ROLES:
        raw = raw_stream(maps[role])
        data = png(width, height, raw, channels if role == 'diff' else 3)
        name = file_name(key, role)
        files[name] = data
        entry['maps'][role] = {'file': name, **IMPORT[role], 'sha256': hashlib.sha256(data).hexdigest(),
                               'raw_sha256': hashlib.sha256(raw).hexdigest()}
        if role == 'diff' and channels == 4:
            entry['maps'][role]['alpha'] = True
    return files, entry


def build_all(keys=None, jobs=None):
    """{key: build(key)} in SETS order. Sets build in worker processes when there are several cores; the output
    does not depend on it, because every set is a pure function of its spec."""
    keys = list(SETS) if keys is None else list(keys)
    jobs = min(len(keys), os.cpu_count() or 1) if jobs is None else jobs
    if jobs > 1:
        order = sorted(keys, key=lambda k: -SETS[k]['size_px'][0] * SETS[k]['size_px'][1])
        try:
            with ProcessPoolExecutor(max_workers=jobs) as pool:
                done = dict(zip(order, pool.map(build, order)))
            return {k: done[k] for k in keys}
        except (OSError, RuntimeError, NotImplementedError, ImportError):
            pass   # no worker processes here (sandbox, embedded interpreter): build in this one
    return {k: build(k) for k in keys}


def prepare(out=OUT, jobs=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    index = {'generator': 'Scripts/plateau_textures.py',
             'uv': 'OBJ UVs in metres (u along the face, v = z); material tiling = 1 / tile_m',
             'cards': 'uv "card": u metres along the run, v 0..1 from the bottom to the top of the card',
             'rows': 'image row 0 is the top of the tile', 'sets': {}}
    for key, (files, entry) in build_all(jobs=jobs).items():
        for name, data in files.items():
            (out / name).write_bytes(data)
        index['sets'][key] = entry
    (out / INDEX).write_text(json.dumps(index, indent=1, sort_keys=True) + '\n')
    return index


def check(out=OUT):
    """The committed index and PNGs match a fresh build (pixel streams; file bytes may differ by zlib build)."""
    index = json.loads((Path(out) / INDEX).read_text())
    for key, (_, entry) in build_all().items():
        assert key in index['sets'], f'{key}: missing from {INDEX}; rerun plateau_textures.py'
        stored = index['sets'][key]
        for role in ROLES:
            a, b = entry['maps'][role], stored['maps'][role]
            assert a['raw_sha256'] == b['raw_sha256'], f'{key} {role}: generator output changed; rerun plateau_textures.py'
            _, _, raw = read_png((Path(out) / b['file']).read_bytes())
            assert hashlib.sha256(raw).hexdigest() == b['raw_sha256'], f'{b["file"]} is stale'
        assert entry['mean_linear'] == stored['mean_linear'], key
    return index


def main():
    if '--check' in sys.argv:
        check()
        print('Plateau textures match textures.json')
        return
    index = prepare()
    print(json.dumps({k: {'mean_linear': v['mean_linear'], 'roughness_mean': v['roughness_mean'],
                          'base_color_srgb': v['base_color_srgb'], **({'coverage': v['coverage']} if 'coverage' in v else {}),
                          'maps': {r: m['sha256'][:12] for r, m in v['maps'].items()}} for k, v in index['sets'].items()},
                     indent=1))


if __name__ == '__main__':
    main()
