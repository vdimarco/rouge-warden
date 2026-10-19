"""Tileable greystone ashlar and slate textures for the Plateau replica (stdlib only, deterministic).

Run from games/nord-unreal:
  python3 Scripts/plateau_textures.py           # writes Data/Plateau/ReplicaGeometry/Textures/
  python3 Scripts/plateau_textures.py --check   # rebuilds in memory and compares with textures.json

Two sets, three PNG maps each, every map tiling in both directions:
  T_Replica_<Set>_diff    sRGB base colour; the material multiplies it by target colour / mean_linear
  T_Replica_<Set>_nor_dx  tangent-space normal, DirectX convention (green down), like the Poly Haven maps
  T_Replica_<Set>_rough   linear: R roughness (the channel the brick-style material reads), G height,
                          B cavity (1 in joints and gaps)
Image row 0 is the top of the tile: the rows run down the wall, as the game shows a texture on an
upright face. Replica OBJ UVs are metres (u along the wall, v = z), so the material tiling is
1 / tile_m. Courses and rows are rolled so the tile edges run through stones and slates rather than
along a joint.

- limestone: Montréal greystone (pierre grise) laid as rock-faced ashlar. 2.56 m tile, 8 courses
  drawn from 30-39 cm and scaled to fill the tile, 2 to 4 stones of 45-130 cm per course, joints of
  adjacent courses at least 15 cm apart, 1 cm mortar joints. Each stone has its own shade and lumps;
  the arris rises over about 3.5 cm.
- slate: the fausse-mansarde roof. 1 m x 2 m tile, 16 rows of 12.5 cm exposure, 20 cm slates laid
  half-bond, with a band of three fish-scale (half-round butt) rows. Each row covers the top of the
  row below, so a butt steps down by the slate thickness and shades the slate under it.

Method: the tiled-stone recipe of Larry Gritz's RenderMan shader stone.sl (staggered courses, per-stone
colour from the stone index, noise-perturbed joint edges, a groove profile for the relief), with
tileable value noise on an integer hash, and normals from the height field by central differences.
The pixel bytes use only integer hashing and IEEE +, -, *, / and sqrt, so they are the same on every
platform. The compressed PNG bytes also depend on the zlib build; textures.json therefore records
`raw_sha256`, the hash of the decompressed image stream, beside the file hash.
"""
import hashlib
import json
from math import sqrt
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
SETS = {
    'limestone': {'name': 'Limestone', 'size_px': (1024, 1024), 'tile_m': (2.56, 2.56), 'seed': 1871},
    'slate': {'name': 'Slate', 'size_px': (512, 1024), 'tile_m': (1.0, 2.0), 'seed': 1895},
}
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
# Maps and PNG

def normal_rows(heights, px_cm):
    """DirectX tangent-space normals from a tileable height field in cm: n = (-dh/dcol, -dh/drow, 1)."""
    rows, width = len(heights), len(heights[0])
    k = px_cm / 2.   # central difference over 2 px, height in cm
    left = [(x - 1) % width for x in range(width)]
    right = [(x + 1) % width for x in range(width)]
    out = []
    for y in range(rows):
        up, mid, down = heights[(y - 1) % rows], heights[y], heights[(y + 1) % rows]
        row = bytearray(width * 3)
        for x in range(width):
            sx = (mid[right[x]] - mid[left[x]]) * k
            sy = (down[x] - up[x]) * k
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


def png(width, height, raw):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & MASK)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def read_png(data):
    """(width, height, decompressed IDAT stream) of an 8-bit RGB PNG written by png()."""
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'Not a PNG'
    pos, idat, size = 8, b'', None
    while pos < len(data):
        n, = struct.unpack('>I', data[pos:pos + 4])
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]
        crc, = struct.unpack('>I', data[pos + 8 + n:pos + 12 + n])
        assert zlib.crc32(kind + body) & MASK == crc, 'Bad PNG chunk CRC'
        if kind == b'IHDR':
            size = struct.unpack('>IIBBBBB', body)
            assert size[2:] == (8, 2, 0, 0, 0), 'Expected 8-bit RGB, no interlace'
        elif kind == b'IDAT':
            idat += body
        pos += 12 + n
    raw = zlib.decompress(idat)
    assert len(raw) == size[1] * (1 + 3 * size[0]), 'Truncated image stream'
    return size[0], size[1], raw


SRGB_TO_LINEAR = [(v / 255 / 12.92) if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4 for v in range(256)]


def linear_mean(rows):
    sums = [0., 0., 0.]
    n = 0
    for row in rows:
        for i in range(3):
            sums[i] += sum(SRGB_TO_LINEAR[v] for v in row[i::3])
        n += len(row) // 3
    return [round(s / n, 4) for s in sums]


def channel_mean(rows, channel):
    return sum(sum(r[channel::3]) for r in rows) / (255. * sum(len(r) // 3 for r in rows))


def file_name(key, role):
    return f'T_Replica_{SETS[key]["name"]}_{role}.png'


def build(key):
    """{role: (raw stream, png bytes)} and the index entry for one set."""
    spec = SETS[key]
    width, height = spec['size_px']
    diff, heights, rough, cavity, px_cm, layout = (limestone if key == 'limestone' else slate)(spec)
    maps = {'diff': diff, 'nor_dx': normal_rows(heights, px_cm), 'rough': mask_rows(rough, heights, cavity)}
    files, entry = {}, {'size_px': [width, height], 'tile_m': list(spec['tile_m']),
                        'tiling': [round(1 / spec['tile_m'][0], 6), round(1 / spec['tile_m'][1], 6)],
                        'mean_linear': linear_mean(diff),
                        'roughness_mean': round(channel_mean(maps['rough'], 0), 4), 'layout': layout, 'maps': {}}
    for role in ROLES:
        raw = raw_stream(maps[role])
        data = png(width, height, raw)
        name = file_name(key, role)
        files[name] = data
        entry['maps'][role] = {'file': name, **IMPORT[role], 'sha256': hashlib.sha256(data).hexdigest(),
                               'raw_sha256': hashlib.sha256(raw).hexdigest()}
    return files, entry


def prepare(out=OUT):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    index = {'generator': 'Scripts/plateau_textures.py',
             'uv': 'OBJ UVs in metres (u along the face, v = z); material tiling = 1 / tile_m',
             'rows': 'image row 0 is the top of the tile', 'sets': {}}
    for key in SETS:
        files, entry = build(key)
        for name, data in files.items():
            (out / name).write_bytes(data)
        index['sets'][key] = entry
    (out / INDEX).write_text(json.dumps(index, indent=1, sort_keys=True) + '\n')
    return index


def check(out=OUT):
    """The committed index and PNGs match a fresh build (pixel streams; file bytes may differ by zlib build)."""
    index = json.loads((Path(out) / INDEX).read_text())
    for key in SETS:
        _, entry = build(key)
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
                          'maps': {r: m['sha256'][:12] for r, m in v['maps'].items()}} for k, v in index['sets'].items()},
                     indent=1))


if __name__ == '__main__':
    main()
