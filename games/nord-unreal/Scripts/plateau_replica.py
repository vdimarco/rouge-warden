"""Plateau replica streetscape: measured streets, furniture placements and a lived-in layer.

Writes three layers under Data/Plateau/ReplicaGeometry/ (frame: x east, y north, z up, cm):

* Streets   - carriageways cut to curb lines measured from the mapped sidewalks, Québec paint,
              grey concrete sidewalks with an 18 cm curb (SM_Concrete_Collision_Replica_*),
              parterres with low iron fences, tree pits, ruelle surfaces, bike-track bollards.
* Furniture - placements.json only: lamps, hydrants, ARRÊT signs, white street-name signs,
              one-way and parking signs, BIXI docks, benches, bins and mail boxes. The meshes
              come from the MAP-PROPS layer (ReplicaGeometry/Props).
* Soul      - seeded wear and life (asphalt patches, sealed cracks, potholes, leaf drifts, weeds,
              rust streaks, original colour-block murals, ruelle wires and laundry) plus
              placements.json for cones, chantier fences, utility poles, curb bins and locked bikes.

Stdlib only and deterministic: every random choice comes from a SHA-256 seed of stable OSM ids.
Sources: Data/LaFontaine/osm.xml (© OpenStreetMap contributors, ODbL 1.0) and the read-only
traffic graph in Data/LaFontaine/layout.json. Dimensions and colours follow the research brief
(Plateau heritage sheets, Québec "Marques sur la chaussée", Ville de Montréal sign inventory).
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_lafontaine import BOUNDS, ROOT, inside, tags, xy  # noqa: E402

OUT = ROOT / 'Data/Plateau/ReplicaGeometry'
OSM = ROOT / 'Data/LaFontaine/osm.xml'
TRAFFIC = ROOT / 'Data/LaFontaine/layout.json'
GENERATOR = 'Scripts/plateau_replica.py'
FRAME = 'x east, y north, cm, z up'
SOURCES = ('Data/LaFontaine/osm.xml', 'Data/LaFontaine/layout.json', GENERATOR,
           'Scripts/prepare_lafontaine.py')
# The existing Panet/Visitation walking route already has detailed streets (plateau_streets.py).
ROUTE = [(37400, -3280), (38405, -3924), (42703, -6819), (41685, -11320), (40636, -15933), (35500, -14300)]
ROUTE_CLEAR = 6400.

Z_ALLEY, Z_ROAD, Z_PATCH, Z_CRACK, Z_PAINT, Z_PAINT2 = 6.8, 7.0, 7.05, 7.08, 7.1, 7.2
Z_WALK, Z_DROP = 18.0, 9.0
CURB_MIN_TRAFFIC = 550.   # QuebecGameplay.cpp CurbParking needs the nearest curb >= 540 cm
CURB_MIN_OTHER = 400.
CLEAR = 300.              # no new collision within 300 cm of a traffic segment centreline
MAX_TRIS = 65000
DRIVE = ('residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street')
ARTERIAL = ('primary', 'secondary', 'tertiary')
SIDEWALK_W = {'primary': 320., 'secondary': 280., 'tertiary': 260., 'residential': 190.,
              'unclassified': 190., 'living_street': 180.}
# Fallback curb offsets (centreline to curb) when no sidewalk is mapped; research-plateau §10.
FALLBACK = {'primary': 1060., 'secondary': 840., 'tertiary': 720., 'residential': 520.,
            'unclassified': 520., 'living_street': 450.}
# Upper bound on a measured offset: a park promenade or a set-back verge is not roadway.
CAP = {'primary': 1150., 'secondary': 900., 'tertiary': 900., 'residential': 720., 'unclassified': 720.,
       'living_street': 600.}
CAP_TWO_WAY_SECONDARY = 760.   # Rachel: about 14 m curb to curb including the 3 m cycle track

STREETS_MATERIALS = {
    # key: (prefix, sRGB, roughness, metallic, collision, texture)
    'asphalt': ('Asphalt_Replica', '#3a3b40', .92, 0., 'none', '/Game/Art/Textures/asphalt_02_diff'),
    'alley': ('Asphalt_Replica_Alley', '#55565a', .95, 0., 'none', '/Game/Art/Textures/asphalt_02_diff'),
    'sidewalk': ('Concrete_Collision_Replica', '#b5b8b8', .85, 0., 'complex', None),
    'curb': ('Streets_curb', '#c8cac7', .8, 0., 'none', None),
    'joint': ('Streets_joint', '#7c7e7d', .9, 0., 'none', None),
    'alley_gutter': ('Streets_alley_gutter', '#8b8a86', .9, 0., 'none', None),
    'paint_white': ('Streets_paint_white', '#f2f2ee', .6, 0., 'none', None),
    'paint_yellow': ('Streets_paint_yellow', '#f2b705', .6, 0., 'none', None),
    'paint_green': ('Streets_paint_green', '#2e9e5a', .65, 0., 'none', None),
    'cast_iron': ('Streets_cast_iron', '#2e2d2b', .55, .6, 'none', None),
    'yard_grass': ('Streets_yard_grass', '#5e7a45', .95, 0., 'complex', None),
    'yard_soil': ('Streets_yard_soil', '#4e3b2b', .95, 0., 'complex', None),
    'yard_path': ('Streets_yard_path', '#9e9c97', .85, 0., 'complex', None),
    'grass_edge': ('Streets_grass_edge', '#6b8a4e', .95, 0., 'none', None),
    'soil': ('Streets_soil', '#3e2f24', .95, 0., 'none', None),
    'iron': ('Streets_iron', '#1c1c1c', .5, .7, 'none', None),
    'bollard_green': ('Streets_bollard_green', '#2f7d46', .5, .2, 'none', None),
}
SOUL_MATERIALS = {
    'patch_dark': ('Soul_patch_dark', '#2c2d31', .9, 0., 'none', None),
    'patch_light': ('Soul_patch_light', '#5e5f62', .95, 0., 'none', None),
    'crack_seal': ('Soul_crack_seal', '#151617', .35, 0., 'none', None),
    'pothole': ('Soul_pothole', '#1f1d1b', .3, 0., 'none', None),
    'leaf_gold': ('Soul_leaf_gold', '#c9932c', .9, 0., 'none', None),
    'leaf_rust': ('Soul_leaf_rust', '#9a4422', .9, 0., 'none', None),
    'leaf_brown': ('Soul_leaf_brown', '#6b4a2b', .9, 0., 'none', None),
    'weed': ('Soul_weed', '#4f6b2f', .95, 0., 'none', None),
    'rust': ('Soul_rust', '#7a3e1d', .9, 0., 'none', None),
    'wire': ('Soul_wire', '#121212', .5, .3, 'none', None),
    'cloth_a': ('Soul_cloth_a', '#e8e6df', .95, 0., 'none', None),
    'cloth_b': ('Soul_cloth_b', '#3d7a84', .95, 0., 'none', None),
    'cloth_c': ('Soul_cloth_c', '#c9a227', .95, 0., 'none', None),
    'cloth_d': ('Soul_cloth_d', '#a03a36', .95, 0., 'none', None),
    'chantier_dirt': ('Soul_chantier_dirt', '#6e5a43', .95, 0., 'none', None),
    'steel_plate': ('Soul_steel_plate', '#55595b', .45, .8, 'none', None),
    'mural_1': ('Soul_mural_1', '#e4572e', .85, 0., 'none', None),
    'mural_2': ('Soul_mural_2', '#f3a712', .85, 0., 'none', None),
    'mural_3': ('Soul_mural_3', '#29335c', .85, 0., 'none', None),
    'mural_4': ('Soul_mural_4', '#669bbc', .85, 0., 'none', None),
    'mural_5': ('Soul_mural_5', '#f0ece2', .85, 0., 'none', None),
    'mural_6': ('Soul_mural_6', '#2a9d8f', .85, 0., 'none', None),
}
# Agreed MAP-PROPS keys; apply_plateau_replica.py instances ReplicaGeometry/Props meshes by these names.
PROP_KEYS = ('lamp_cobra', 'lamp_park', 'hydrant', 'sign_stop', 'sign_street', 'sign_oneway', 'sign_parking',
             'bixi_dock', 'bixi_bike', 'bin_recycling', 'bin_compost', 'bin_garbage', 'cone',
             'barrier_chantier', 'utility_pole', 'laundry_line', 'bike_locked', 'ac_unit', 'flower_box',
             'bench', 'mailbox')
PARKING_TEXTS = [('R-PF', '\\P 9h-23h EXCEPTÉ S3R'), ('AD-TT', '\\A EN TOUT TEMPS'),
                 ('SU-MA-A', '\\P 8h-9h MARDI 1 AVRIL AU 1 DÉC'), ('SD-TT', '\\P EN TOUT TEMPS'),
                 ('SU-ME-A', '\\P 9h-10h MERCREDI 1 AVRIL AU 1 DÉC'), ('R-PF', '\\P 9h-23h EXCEPTÉ S3R')]
M64 = (1 << 64) - 1
PROPS_MANIFEST = OUT / 'Props/manifest.json'


def props_info():
    """MAP-PROPS anchors (BIXI slots, pole wire anchors) when its manifest exists; agreed defaults otherwise."""
    defaults = {'bixi_slots': [(72., y, 180.) for y in (194., 114., 34., -46., -126., -206.)], 'bixi_length': 558.,
                'pole_wires': [(0., 108., 1002.), (0., 45., 1002.), (0., -45., 1002.), (0., -108., 1002.)],
                'pole_drop': (20., 0., 850.), 'bike_contact': (-10., -34.24)}
    try:
        props = json.loads(PROPS_MANIFEST.read_text())['props']
        dock = props['bixi_dock']
        defaults['bixi_slots'] = [(sl['position_cm'][0], sl['position_cm'][1], sl['yaw_deg']) for sl in dock['slots']]
        defaults['bixi_length'] = dock['bounds_cm'][4] - dock['bounds_cm'][1]
        anchors = props['utility_pole']['anchors']['wire_attach_cm']
        defaults['pole_wires'] = [tuple(a) for a in anchors if a[2] > 950]
        drops = [tuple(a) for a in anchors if a[2] <= 950]
        defaults['pole_drop'] = drops[len(drops) // 2] if drops else defaults['pole_drop']
        defaults['bike_contact'] = tuple(props['bike_locked']['anchors']['lean_contact_cm'][:2])
    except (OSError, KeyError, ValueError, IndexError):
        pass
    return defaults


def local_to_world(p, yaw, local):
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    return (p[0] + local[0] * c - local[1] * s, p[1] + local[0] * s + local[1] * c)


# ---------------------------------------------------------------------------------------------
# Deterministic randomness and small geometry helpers

def seed(*parts):
    return int.from_bytes(hashlib.sha256(repr(parts).encode()).digest()[:8], 'big')


class Rng:
    """SplitMix64: identical sequences on every Python version and platform."""

    def __init__(self, *parts):
        self.state = seed(*parts)

    def next(self):
        self.state = (self.state + 0x9E3779B97F4A7C15) & M64
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & M64
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & M64
        return z ^ (z >> 31)

    def random(self):
        return (self.next() >> 11) / 9007199254740992.0

    def uniform(self, a, b):
        return a + (b - a) * self.random()

    def chance(self, p):
        return self.random() < p

    def choice(self, items):
        return items[min(len(items) - 1, int(self.random() * len(items)))]

    def randint(self, a, b):
        return a + min(b - a, int(self.random() * (b - a + 1)))


def area(poly):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1])) / 2


def point_in(p, poly):
    result = False
    for a, b in zip(poly, poly[1:] + poly[:1]):
        if (a[1] > p[1]) != (b[1] > p[1]):
            if p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
                result = not result
    return result


def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0., min(1., ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / max(1e-9, dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def segments_cross(a, b, c, d):
    d1, d2, d3, d4 = _cross(c, d, a), _cross(c, d, b), _cross(a, b, c), _cross(a, b, d)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def seg_seg_dist(a, b, c, d):
    if segments_cross(a, b, c, d):
        return 0.
    return min(seg_dist(a, c, d), seg_dist(b, c, d), seg_dist(c, a, b), seg_dist(d, a, b))


def poly_seg_dist(poly, a, b):
    if point_in(a, poly) or point_in(b, poly):
        return 0.
    return min(seg_seg_dist(p, q, a, b) for p, q in zip(poly, poly[1:] + poly[:1]))


def line_isect(p, d, q, e):
    """Return t, s with p + t d = q + s e, or None when parallel."""
    den = d[0] * e[1] - d[1] * e[0]
    if abs(den) < 1e-6:
        return None
    w = (q[0] - p[0], q[1] - p[1])
    return (w[0] * e[1] - w[1] * e[0]) / den, (w[0] * d[1] - w[1] * d[0]) / den


def ray_seg(origin, direction, a, b):
    """Distance along a unit ray to segment ab, or None."""
    e = (b[0] - a[0], b[1] - a[1])
    hit = line_isect(origin, direction, a, e)
    if hit is None:
        return None
    t, s = hit
    return t if t > 0 and -1e-6 <= s <= 1 + 1e-6 else None


def add(p, v, k=1.):
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(len(a)))


def convex(poly):
    if len(poly) < 3:
        return False
    signs = [_cross(poly[i - 2], poly[i - 1], poly[i]) for i in range(len(poly))]
    return all(s > -1e-6 for s in signs) and area(poly) > 1.


def dedupe(points, tolerance=.5):
    out = []
    for p in points:
        if not out or math.dist(p, out[-1]) > tolerance:
            out.append(p)
    while len(out) > 1 and math.dist(out[0], out[-1]) <= tolerance:
        out.pop()
    return out


class Grid:
    def __init__(self, cell=3000.):
        self.cell, self.cells = cell, {}

    def add(self, item, box):
        c = self.cell
        for i in range(math.floor(box[0] / c), math.floor(box[2] / c) + 1):
            for j in range(math.floor(box[1] / c), math.floor(box[3] / c) + 1):
                self.cells.setdefault((i, j), []).append(item)

    def query(self, box):
        c, seen = self.cell, []
        found = set()
        for i in range(math.floor(box[0] / c), math.floor(box[2] / c) + 1):
            for j in range(math.floor(box[1] / c), math.floor(box[3] / c) + 1):
                for item in self.cells.get((i, j), ()):
                    if item not in found:
                        found.add(item)
                        seen.append(item)
        return seen


def bbox(points, pad=0.):
    return (min(p[0] for p in points) - pad, min(p[1] for p in points) - pad,
            max(p[0] for p in points) + pad, max(p[1] for p in points) + pad)


# ---------------------------------------------------------------------------------------------
# Mesh collection, batching and OBJ writing (plateau_mesh.py conventions; UVs in metres)

class Layer:
    def __init__(self, name, materials):
        self.name, self.materials, self.faces = name, materials, {k: [] for k in materials}

    def face(self, key, points):
        points = [tuple(float(v) for v in p) for p in points]
        assert key in self.materials, key
        assert len(points) >= 3 and all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in points)
        self.faces[key].append(points)

    def flat(self, key, poly, z):
        poly = dedupe(poly)
        if len(poly) < 3 or abs(area(poly)) < 1.:
            return False
        if area(poly) < 0:
            poly = poly[::-1]
        self.face(key, [(p[0], p[1], z) for p in poly])
        return True

    def strip(self, key, a, b, width, z, z2=None):
        """A horizontal (or sloped along ab) strip centred on segment ab."""
        length = math.dist(a, b)
        if length < .5:
            return False
        n = (-(b[1] - a[1]) / length * width / 2, (b[0] - a[0]) / length * width / 2)
        z2 = z if z2 is None else z2
        self.face(key, [(a[0] - n[0], a[1] - n[1], z), (b[0] - n[0], b[1] - n[1], z2),
                        (b[0] + n[0], b[1] + n[1], z2), (a[0] + n[0], a[1] + n[1], z)])
        return True

    def wall(self, key, a, b, z0, z1, z0b=None, z1b=None):
        """Vertical quad facing right of a->b (outward when walking a polygon CCW)."""
        if math.dist(a, b) < .5:
            return
        z0b = z0 if z0b is None else z0b
        z1b = z1 if z1b is None else z1b
        if max(z1, z1b) - min(z0, z0b) < .05:
            return
        self.face(key, [(a[0], a[1], z0), (b[0], b[1], z0b), (b[0], b[1], z1b), (a[0], a[1], z1)])

    def box(self, key, center, size, yaw=0., bottom=True):
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        x, y, z = (v / 2 for v in size)
        p = [(center[0] + a * c - b * s, center[1] + a * s + b * c, center[2] + d)
             for a, b, d in [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
                             (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]]
        quads = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
        if bottom:
            quads.append((3, 2, 1, 0))
        for q in quads:
            self.face(key, [p[i] for i in q])

    def rod(self, key, a, b, radius, sides=4, caps=False):
        d = [b[i] - a[i] for i in range(3)]
        length = math.sqrt(sum(v * v for v in d))
        if length < .01:
            return
        d = [v / length for v in d]
        ref = (0, 0, 1) if abs(d[2]) < .9 else (0, 1, 0)
        u = (d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0])
        norm = math.sqrt(sum(v * v for v in u))
        u = [v / norm for v in u]
        v = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])
        rings = [[tuple(p[j] + radius * (u[j] * math.cos(i * math.tau / sides) + v[j] * math.sin(i * math.tau / sides))
                        for j in range(3)) for i in range(sides)] for p in (a, b)]
        if caps:
            self.face(key, rings[0][::-1])
            self.face(key, rings[1])
        for i in range(sides):
            k = (i + 1) % sides
            self.face(key, [rings[0][i], rings[0][k], rings[1][k], rings[1][i]])

    def cone(self, key, base, radius, height, sides=4, phase=0.):
        ring = [(base[0] + radius * math.cos(phase + i * math.tau / sides),
                 base[1] + radius * math.sin(phase + i * math.tau / sides), base[2]) for i in range(sides)]
        tip = (base[0], base[1], base[2] + height)
        for i in range(sides):
            self.face(key, [ring[i], ring[(i + 1) % sides], tip])

    def triangles(self, key=None):
        keys = [key] if key else self.faces
        return sum(len(f) - 2 for k in keys for f in self.faces[k])


def _coordinate(value):
    return ('M' if value < 0 else 'P') + f'{abs(value):03d}'


def batch_layer(layer):
    """Group faces per material into spatial tiles; tile size grows for sparse materials."""
    batches = []
    for key, faces in layer.faces.items():
        if not faces:
            continue
        prefix = layer.materials[key][0]
        centroids = [(sum(p[0] for p in f) / len(f), sum(p[1] for p in f) / len(f)) for f in faces]
        total = sum(len(f) - 2 for f in faces)
        for tile in (4750, 9500, 19000, 38000, 1000000):
            buckets = {}
            for face, (cx, cy) in zip(faces, centroids):
                buckets.setdefault((math.floor(cx / tile), math.floor(cy / tile)), []).append(face)
            if total / len(buckets) >= 6000 or tile == 1000000:
                break
        for (i, j), group in sorted(buckets.items()):
            chunks, current, count = [], [], 0
            for face in group:
                if count + len(face) - 2 > MAX_TRIS and current:
                    chunks.append(current)
                    current, count = [], 0
                current.append(face)
                count += len(face) - 2
            chunks.append(current)
            for index, chunk in enumerate(chunks):
                name = f'{prefix}_X{_coordinate(i)}_Y{_coordinate(j)}' + (f'_{index + 1}' if index else '')
                assert name.replace('_', '').isalnum(), name
                batches.append({'name': name, 'key': key, 'tile_cm': tile, 'faces': chunk})
    return batches


def obj_text(name, faces):
    lines, vts, fs, index = ['o ' + name], [], [], 1
    verts = []
    for poly in faces:
        a, b = poly[0], poly[1]
        d = [b[i] - a[i] for i in range(3)]
        length = math.sqrt(sum(v * v for v in d)) or 1.
        d = [v / length for v in d]
        horizontal = max(p[2] for p in poly) - min(p[2] for p in poly) < .1
        for x, y, z in poly:
            verts.append(f'v {x:.3f} {-y:.3f} {z:.3f}')
            # UVs in metres: world xy on horizontal faces, (along first edge, z) on the others.
            uv = (x / 100, y / 100) if horizontal else (sum((x, y, z)[i] * d[i] for i in range(3)) / 100, z / 100)
            vts.append(f'vt {uv[0]:.5f} {uv[1]:.5f}')
        # Unreal's OBJ import flips Y back; reversed winding keeps the authored outward normal.
        for i in range(1, len(poly) - 1):
            fs.append(f'f {index + i + 1}/{index + i + 1} {index + i}/{index + i} {index}/{index}')
        index += len(poly)
    return '\n'.join(lines + verts + vts + fs) + '\n'


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_layer(layer, directory, counts, extra=None):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for old in directory.glob('*.obj'):
        old.unlink()
    rows = []
    for batch in batch_layer(layer):
        text = obj_text(batch['name'], batch['faces']).encode()
        (directory / (batch['name'] + '.obj')).write_bytes(text)
        pts = [p for f in batch['faces'] for p in f]
        key = batch['key']
        rows.append({'file': batch['name'] + '.obj', 'mesh': 'SM_' + batch['name'], 'material': key,
                     'collision': layer.materials[key][4], 'triangles': sum(len(f) - 2 for f in batch['faces']),
                     'faces': len(batch['faces']), 'tile_cm': batch['tile_cm'],
                     'bounds_cm': [round(min(p[i] for p in pts), 2) for i in range(3)] +
                                  [round(max(p[i] for p in pts), 2) for i in range(3)],
                     'sha256': sha_bytes(text)})
    manifest = {
        'layer': layer.name, 'generator': GENERATOR, 'frame': FRAME,
        'batches': rows,
        'materials': {k: {'base_color_srgb': v[1], 'roughness': v[2], 'metallic': v[3],
                          **({'texture': v[5]} if v[5] else {}), 'batch_prefix': v[0], 'collision': v[4]}
                      for k, v in layer.materials.items() if layer.faces[k]},
        'counts': counts | {'batches': len(rows), 'triangles': sum(r['triangles'] for r in rows)},
        'source_sha256': {p: sha_file(ROOT / p) for p in SOURCES},
        'attribution': '© OpenStreetMap contributors, ODbL 1.0; authored street details and original murals',
    }
    if extra:
        manifest.update(extra)
    (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    return manifest


def write_placements(directory, layer, rows, counts):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    data = {'layer': layer, 'generator': GENERATOR, 'frame': FRAME,
            'note': 'Instances of ReplicaGeometry/Props meshes. position = base centre (cm), yaw in degrees '
                    'from +X toward +Y (props are modelled +X forward). collision false inside the 300 cm '
                    'traffic band or for knockable props.',
            'counts': counts, 'source_sha256': {p: sha_file(ROOT / p) for p in SOURCES},
            'placements': rows}
    (directory / 'placements.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    return data


def r2(v):
    return round(v, 2)


# ---------------------------------------------------------------------------------------------
# Source data

def load_sources():
    root = ET.parse(OSM).getroot()
    nodes, latlon, node_tags = {}, {}, {}
    for e in root.iter('node'):
        lat, lon = float(e.get('lat')), float(e.get('lon'))
        nodes[e.get('id')] = xy(lat, lon)
        latlon[e.get('id')] = (lat, lon)
        t = tags(e)
        if t:
            node_tags[e.get('id')] = t
    ways = [{'id': e.get('id'), 'refs': [n.get('ref') for n in e.findall('nd') if n.get('ref') in nodes],
             'tags': tags(e)} for e in root.iter('way')]
    traffic = json.loads(TRAFFIC.read_text())
    return nodes, latlon, node_tags, ways, traffic


def district_box():
    lo, hi = xy(BOUNDS[0], BOUNDS[1]), xy(BOUNDS[2], BOUNDS[3])
    return lo[0], lo[1], hi[0], hi[1]


def clip_param(a, b, box):
    low, high = 0., 1.
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in [(-dx, a[0] - box[0]), (dx, box[2] - a[0]), (-dy, a[1] - box[1]), (dy, box[3] - a[1])]:
        if abs(p) < 1e-9:
            if q < 0:
                return None
        elif p < 0:
            low = max(low, q / p)
        else:
            high = min(high, q / p)
        if low > high:
            return None
    return low, high


class World:
    """Everything the three layers share: segments, junction geometry and spatial indexes."""

    def __init__(self):
        self.nodes, self.latlon, self.node_tags, self.ways, traffic = load_sources()
        self.box = district_box()
        self.traffic = [(tuple(a[:2]), tuple(b[:2])) for road in traffic['roads'] for a, b in zip(road, road[1:])]
        self.traffic_grid = Grid(2000.)
        for i, (a, b) in enumerate(self.traffic):
            self.traffic_grid.add(i, bbox([a, b], CLEAR + 50))
        self.route_near = lambda p: min(seg_dist(p, a, b) for a, b in zip(ROUTE, ROUTE[1:])) < ROUTE_CLEAR
        self._buildings()
        self._sidewalk_ways()
        self._park()

    # -- inputs ------------------------------------------------------------------------------
    def _buildings(self):
        self.buildings, self.building_edges = [], []
        self.edge_grid, self.building_grid = Grid(2500.), Grid(2500.)
        box = self.box
        for w in self.ways:
            t = w['tags']
            if 'building' not in t or len(w['refs']) < 4 or w['refs'][0] != w['refs'][-1]:
                continue
            pts = [self.nodes[r] for r in w['refs'][:-1]]
            if not any(box[0] - 3000 <= p[0] <= box[2] + 3000 and box[1] - 3000 <= p[1] <= box[3] + 3000 for p in pts):
                continue
            if area(pts) < 0:
                pts.reverse()
            try:
                height = float(t.get('height', str(float(t.get('building:levels', 3)) * 320)).split()[0])
                height = height * 100 if 'height' in t else height
            except ValueError:
                height = 960.
            b = {'id': w['id'], 'points': pts, 'height': max(250., min(6000., height)), 'tags': t,
                 'inside': all(inside(self.latlon[r]) for r in w['refs'])}
            index = len(self.buildings)
            self.buildings.append(b)
            self.building_grid.add(index, bbox(pts))
            for a, c in zip(pts, pts[1:] + pts[:1]):
                if math.dist(a, c) > 1:
                    e = len(self.building_edges)
                    self.building_edges.append((a, c, index))
                    self.edge_grid.add(e, bbox([a, c]))

    def _sidewalk_ways(self):
        self.sidewalk_segments, self.sidewalk_grid = [], Grid(2500.)
        for w in self.ways:
            if w['tags'].get('footway') != 'sidewalk':
                continue
            pts = [self.nodes[r] for r in w['refs']]
            for a, b in zip(pts, pts[1:]):
                if math.dist(a, b) > 50:
                    i = len(self.sidewalk_segments)
                    self.sidewalk_segments.append((a, b))
                    self.sidewalk_grid.add(i, bbox([a, b]))

    def _park(self):
        way = next((w for w in self.ways if w['id'] == '4767368'), None)
        self.park = [self.nodes[r] for r in way['refs'][:-1]] if way else []
        self.park_box = bbox(self.park) if self.park else (0, 0, 0, 0)

    def in_park(self, p):
        b = self.park_box
        return bool(self.park) and b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3] and point_in(p, self.park)

    def in_building(self, p, margin=0.):
        for i in self.building_grid.query((p[0] - margin, p[1] - margin, p[0] + margin, p[1] + margin)):
            if point_in(p, self.buildings[i]['points']):
                return True
        if margin > 0:
            return any(seg_dist(p, self.building_edges[e][0], self.building_edges[e][1]) < margin
                       for e in self.edge_grid.query((p[0] - margin, p[1] - margin, p[0] + margin, p[1] + margin)))
        return False

    def traffic_distance(self, poly_or_point, limit=CLEAR + 50):
        """Minimum distance from a point or polygon to any traffic-graph segment (capped)."""
        pts = [poly_or_point] if isinstance(poly_or_point[0], (int, float)) else poly_or_point
        best = limit
        for i in self.traffic_grid.query(bbox(pts)):
            a, b = self.traffic[i]
            d = seg_dist(pts[0], a, b) if len(pts) == 1 else poly_seg_dist(pts, a, b)
            best = min(best, d)
        return best

    def building_ray(self, origin, direction, limit):
        end = add(origin, direction, limit)
        best = None
        for e in self.edge_grid.query(bbox([origin, end])):
            a, b, _ = self.building_edges[e]
            t = ray_seg(origin, direction, a, b)
            if t is not None and t <= limit and (best is None or t < best):
                best = t
        return best


# ---------------------------------------------------------------------------------------------
# Drive network, curb measurement and junction geometry

def _simplify(points, fixed, tolerance=40.):
    """Douglas-Peucker between fixed vertices (junctions, ends); OSM splits ways at every crossing node."""
    keep = {0, len(points) - 1} | {i for i in range(len(points)) if fixed[i]}

    def walk(i, j):
        if j - i < 2:
            return
        far, worst = None, tolerance
        for k in range(i + 1, j):
            d = seg_dist(points[k], points[i], points[j])
            if d > worst:
                far, worst = k, d
        if far is not None:
            keep.add(far)
            walk(i, far)
            walk(far, j)

    order = sorted(keep)
    for i, j in zip(order, order[1:]):
        walk(i, j)
    return sorted(keep)


def drive_network(world):
    box = world.box
    segs, graph = [], {}
    world.drive_ways = []
    runs = []
    for w in world.ways:
        t = w['tags']
        if t.get('highway') not in DRIVE or len(w['refs']) < 2:
            continue
        refs = w['refs']
        current = []
        for i, (ra, rb) in enumerate(zip(refs, refs[1:])):
            a, b = world.nodes[ra], world.nodes[rb]
            if math.dist(a, b) < 1:
                continue
            clip = clip_param(a, b, box)
            if clip is None or math.dist(a, b) * (clip[1] - clip[0]) < 50:
                if current:
                    runs.append((w, current))
                    current = []
                continue
            ida = ra if clip[0] <= 1e-9 else f'clip{w["id"]}_{i}a'
            idb = rb if clip[1] >= 1 - 1e-9 else f'clip{w["id"]}_{i}b'
            pa, pb = lerp(a, b, clip[0]), lerp(a, b, clip[1])
            if current and current[-1][0] == ida:
                current.append((idb, pb))
            else:
                if current:
                    runs.append((w, current))
                current = [(ida, pa), (idb, pb)]
            if clip[1] < 1 - 1e-9:
                runs.append((w, current))
                current = []
        if current:
            runs.append((w, current))
    degree = {}
    for w, run in runs:
        for k, (nid, _) in enumerate(run):
            degree[nid] = degree.get(nid, 0) + (1 if k in (0, len(run) - 1) else 2)
    simplified = []
    for w, run in runs:
        keep = _simplify([p for _, p in run], [degree[nid] >= 3 for nid, _ in run])
        simplified.append((w, [run[k] for k in keep]))
    for w, run in simplified:
        t = w['tags']
        refs = w['refs']
        traffic = all(inside(world.latlon[r]) for r in refs)
        segrun = []
        for (ida, pa), (idb, pb) in zip(run, run[1:]):
            length = math.dist(pa, pb)
            if length < 30:
                continue
            u = ((pb[0] - pa[0]) / length, (pb[1] - pa[1]) / length)
            seg = {'i': len(segs), 'way': w['id'], 'a': ida, 'b': idb, 'pa': pa, 'pb': pb, 'len': length, 'u': u,
                   'n': (-u[1], u[0]), 'tags': t, 'name': t.get('name', ''), 'hw': t.get('highway'),
                   'traffic': traffic, 'oneway': t.get('oneway') in ('yes', '1', 'true', '-1'),
                   'excluded': world.route_near(lerp(pa, pb, .5))}
            segs.append(seg)
            segrun.append(seg)
            graph.setdefault(ida, []).append((seg['i'], 'a'))
            graph.setdefault(idb, []).append((seg['i'], 'b'))
        if segrun:
            world.drive_ways.append((w, segrun))
    world.segs, world.graph = segs, graph
    world.seg_grid = Grid(3000.)
    for s in segs:
        world.seg_grid.add(s['i'], bbox([s['pa'], s['pb']], 1500))


def measure_curbs(world):
    """Curb offset per way side = median mapped sidewalk centreline offset - half sidewalk width."""
    stats = {'measured_sides': 0, 'fallback_sides': 0, 'median_sides': 0}
    for way, run in world.drive_ways:
        t = way['tags']
        hw = t.get('highway')
        samples = {'L': [], 'R': []}
        facade = {'L': [], 'R': []}
        for seg in run:
            count = max(1, int(seg['len'] // 600))
            for k in range(count):
                along = seg['len'] * (k + .5) / count
                p = add(seg['pa'], seg['u'], along)
                for side, sign in (('L', 1), ('R', -1)):
                    nrm = (seg['n'][0] * sign, seg['n'][1] * sign)
                    best = None
                    end = add(p, nrm, 2300)
                    for i in world.sidewalk_grid.query(bbox([p, end])):
                        a, b = world.sidewalk_segments[i]
                        d = ((b[0] - a[0]) * seg['u'][0] + (b[1] - a[1]) * seg['u'][1]) / math.dist(a, b)
                        if abs(d) < .94:
                            continue
                        hit = ray_seg(p, nrm, a, b)
                        if hit is not None and 220 <= hit <= 2300 and (best is None or hit < best):
                            best = hit
                    # Reject a sidewalk that lies beyond another carriageway (dual ways, side streets).
                    if best is not None:
                        for j in world.seg_grid.query(bbox([p, add(p, nrm, best)])):
                            other = world.segs[j]
                            if other['way'] == seg['way']:
                                continue
                            hit = ray_seg(p, nrm, other['pa'], other['pb'])
                            if hit is not None and hit < best:
                                best = None
                                break
                    if best is not None:
                        samples[side].append(best)
                    f = world.building_ray(p, nrm, 3500)
                    if f is not None and f > 250:
                        facade[side].append(f)
        width = SIDEWALK_W.get(hw, 190.)
        for side in ('L', 'R'):
            values = sorted(samples[side])
            if len(values) >= 2:
                centre = values[len(values) // 2]
                curb = centre - width / 2
                stats['measured_sides'] += 1
                source = 'osm_sidewalk'
            else:
                curb = FALLBACK.get(hw, 520.)
                if hw in ('residential', 'unclassified') and t.get('oneway') not in ('yes', '-1'):
                    curb = 600.
                if hw == 'secondary' and t.get('oneway') not in ('yes', '-1'):
                    curb = 700.
                stats['fallback_sides'] += 1
                source = 'class_fallback'
            fvals = sorted(facade[side])
            fac = fvals[len(fvals) // 2] if fvals else None
            cap = CAP.get(hw, 720.)
            if hw == 'secondary' and t.get('oneway') not in ('yes', '-1'):
                cap = CAP_TWO_WAY_SECONDARY
            for seg in run:
                lo = CURB_MIN_TRAFFIC if seg['traffic'] else CURB_MIN_OTHER
                c = max(lo, min(curb, cap))
                w = width
                if fac is not None and fac - c < w + 20:
                    w = max(150., fac - c - 20)
                seg['curb' + side] = c
                seg['w' + side] = w
                seg['facade' + side] = fac
                seg['curb_source' + side] = source
                if t.get('sidewalk') == 'no' or t.get('sidewalk:both') == 'no' or \
                        t.get('sidewalk:' + ('left' if side == 'L' else 'right')) == 'no':
                    seg['w' + side] = 0.
    world.curb_stats = stats


def _side_of_end(end, away_side):
    """Map an away-frame side ('left'/'right') at segment end to the segment side ('L'/'R')."""
    if end == 'a':
        return 'L' if away_side == 'left' else 'R'
    return 'R' if away_side == 'left' else 'L'


def build_junctions(world):
    """Curb and sidewalk-outer points for every segment end, plus junction pavement and corners."""
    world.ends, world.junctions, world.corners, world.box_t = {}, [], [], {}
    for node, arms in world.graph.items():
        p0 = world.nodes.get(node)
        info = []
        for si, end in arms:
            s = world.segs[si]
            u = s['u'] if end == 'a' else (-s['u'][0], -s['u'][1])
            n = (-u[1], u[0])
            left, right = _side_of_end(end, 'left'), _side_of_end(end, 'right')
            origin = s['pa'] if end == 'a' else s['pb']
            info.append({'seg': s, 'end': end, 'u': u, 'n': n, 'ang': math.atan2(u[1], u[0]),
                         'L': s['curb' + left], 'R': s['curb' + right], 'wL': s['w' + left], 'wR': s['w' + right],
                         'left': left, 'right': right, 'o': origin})
        origin = info[0]['o'] if p0 is None or node.startswith('clip') else p0
        info.sort(key=lambda a: a['ang'])
        count = len(info)
        if count == 1:
            a = info[0]
            for side, off, w, sign in (('left', a['L'], a['wL'], 1), ('right', a['R'], a['wR'], -1)):
                curb = add(origin, a['n'], sign * off)
                world.ends[(a['seg']['i'], a['end'], a[side])] = (curb, add(curb, a['n'], sign * max(w, 1.)), 0.)
            continue
        arterial = any(a['seg']['hw'] in ARTERIAL for a in info)
        polygon, corner_rows = [], []
        for k in range(count):
            a, b = info[k], info[(k + 1) % count]
            phi = (b['ang'] - a['ang']) % math.tau
            if count == 2 and k == 1:
                phi = math.tau - ((info[1]['ang'] - info[0]['ang']) % math.tau)
            deg = math.degrees(phi)
            la = (add(origin, a['n'], a['L']), a['u'])
            lb = (add(origin, b['n'], -b['R']), b['u'])
            oa = (add(origin, a['n'], a['L'] + max(a['wL'], 1.)), a['u'])
            ob = (add(origin, b['n'], -(b['R'] + max(b['wR'], 1.))), b['u'])
            row = {'node': node, 'a': a, 'b': b, 'deg': deg}
            box_t = world.box_t
            if deg < 168:
                hit = line_isect(la[0], la[1], lb[0], lb[1])
                ta, tb = hit if hit else (0., 0.)
                P = add(la[0], la[1], ta)
                rc = 520. if arterial else 360.
                rc = max(rc, max(a['wL'], b['wR']) + 60)
                half = phi / 2
                limit_a = .46 * a['seg']['len'] - ta
                limit_b = .46 * b['seg']['len'] - tb
                rc = min(rc, max(0., min(limit_a, limit_b)) * math.tan(half))
                if rc < 40 or ta < -50 or tb < -50:
                    # Too short or odd: fall back to a mitred corner.
                    Po = line_isect(oa[0], oa[1], ob[0], ob[1])
                    Q = add(oa[0], oa[1], Po[0]) if Po else lerp(oa[0], ob[0], .5)
                    world.ends[(a['seg']['i'], a['end'], a['left'])] = (P, Q, ta)
                    world.ends[(b['seg']['i'], b['end'], b['right'])] = (P, Q, tb)
                    polygon.append(P)
                    row.update(kind='mitre', P=P, Q=Q)
                else:
                    dt = rc / math.tan(half)
                    Ta, Tb = add(P, a['u'], dt), add(P, b['u'], dt)
                    bis = (a['u'][0] + b['u'][0], a['u'][1] + b['u'][1])
                    bl = math.hypot(*bis)
                    C = add(P, (bis[0] / bl, bis[1] / bl), rc / math.sin(half))
                    a0 = math.atan2(Ta[1] - C[1], Ta[0] - C[0])
                    a1 = math.atan2(Tb[1] - C[1], Tb[0] - C[0])
                    sweep = (a1 - a0 + math.pi) % math.tau - math.pi
                    steps = max(2, int(abs(math.degrees(sweep)) / 12))
                    arc = [(C[0] + rc * math.cos(a0 + sweep * i / steps), C[1] + rc * math.sin(a0 + sweep * i / steps))
                           for i in range(steps + 1)]
                    Ta2, Tb2 = add(Ta, a['n'], max(a['wL'], 1.)), add(Tb, b['n'], -max(b['wR'], 1.))
                    Po = line_isect(oa[0], oa[1], ob[0], ob[1])
                    Q = add(oa[0], oa[1], Po[0]) if Po else None
                    if Q is not None and math.dist(Q, P) < 2.5 * max(a['wL'], b['wR']) + 150:
                        # Sidewalk fills to the sharp property corner; the curb alone is rounded.
                        inner = []
                        for i in range(steps + 1):
                            f = i / steps
                            inner.append(lerp(Ta2, Q, f * 2) if f <= .5 else lerp(Q, Tb2, f * 2 - 1))
                    else:
                        Q = None
                        inner = []
                        for i in range(steps + 1):
                            f = i / steps
                            r = rc - (a['wL'] * (1 - f) + b['wR'] * f)
                            inner.append((C[0] + r * math.cos(a0 + sweep * f), C[1] + r * math.sin(a0 + sweep * f)))
                    world.ends[(a['seg']['i'], a['end'], a['left'])] = (Ta, inner[0], ta + dt, Q, 0.)
                    world.ends[(b['seg']['i'], b['end'], b['right'])] = (Tb, inner[-1], tb + dt, Q, .3)
                    for arm, tt in ((a, ta), (b, tb)):
                        key = (arm['seg']['i'], arm['end'])
                        box_t[key] = max(box_t.get(key, 0.), tt)
                    polygon.extend(arc)
                    row.update(kind='fillet', P=P, C=C, rc=rc, arc=arc, inner=inner, Q=Q)
            elif deg <= 192:
                hit = line_isect(la[0], la[1], lb[0], lb[1])
                P = add(la[0], la[1], hit[0]) if hit and abs(hit[0]) < 400 else lerp(la[0], lb[0], .5)
                ho = line_isect(oa[0], oa[1], ob[0], ob[1])
                Q = add(oa[0], oa[1], ho[0]) if ho and abs(ho[0]) < 500 else lerp(oa[0], ob[0], .5)
                ta = (P[0] - origin[0]) * a['u'][0] + (P[1] - origin[1]) * a['u'][1]
                tb = (P[0] - origin[0]) * b['u'][0] + (P[1] - origin[1]) * b['u'][1]
                world.ends[(a['seg']['i'], a['end'], a['left'])] = (P, Q, ta)
                world.ends[(b['seg']['i'], b['end'], b['right'])] = (P, Q, tb)
                polygon.append(P)
                row.update(kind='mitre', P=P, Q=Q)
            else:
                Ca, Cb = la[0], lb[0]
                a0 = math.atan2(a['n'][1], a['n'][0])
                sweep = (phi - math.pi)
                steps = max(2, int(math.degrees(sweep) / 12))
                arc, outer = [], []
                for i in range(steps + 1):
                    f = i / steps
                    r = a['L'] * (1 - f) + b['R'] * f
                    w = a['wL'] * (1 - f) + b['wR'] * f
                    ang = a0 + sweep * f
                    arc.append((origin[0] + r * math.cos(ang), origin[1] + r * math.sin(ang)))
                    outer.append((origin[0] + (r + w) * math.cos(ang), origin[1] + (r + w) * math.sin(ang)))
                world.ends[(a['seg']['i'], a['end'], a['left'])] = (Ca, outer[0], 0.)
                world.ends[(b['seg']['i'], b['end'], b['right'])] = (Cb, outer[-1], 0.)
                polygon.extend(arc)
                row.update(kind='bend', arc=arc, outer=outer)
            corner_rows.append(row)
        world.corners.extend(corner_rows)
        if any(r['kind'] != 'mitre' for r in corner_rows) or count >= 3:
            world.junctions.append({'node': node, 'origin': origin, 'polygon': dedupe(polygon),
                                    'arms': info, 'corners': corner_rows,
                                    'excluded': world.route_near(origin)})
    # Mouth distance per segment end: where the straight curb begins.
    for s in world.segs:
        for end in ('a', 'b'):
            vals = [world.ends[(s['i'], end, side)][2] for side in ('L', 'R') if (s['i'], end, side) in world.ends]
            s['mouth_' + end] = max([0.] + vals)
            s['box_' + end] = world.box_t.get((s['i'], end), 0.)


def seg_point(s, along, lateral):
    return (s['pa'][0] + s['u'][0] * along + s['n'][0] * lateral, s['pa'][1] + s['u'][1] * along + s['n'][1] * lateral)


def seg_local(s, p):
    d = (p[0] - s['pa'][0], p[1] - s['pa'][1])
    return d[0] * s['u'][0] + d[1] * s['u'][1], d[0] * s['n'][0] + d[1] * s['n'][1]


def carriageway_polygons(world):
    """Convex carriageway quads per segment plus star-shaped junction polygons (as triangles)."""
    world.pavement = []          # (polygon, seg index or None)
    for s in world.segs:
        ra, la = world.ends[(s['i'], 'a', 'R')][0], world.ends[(s['i'], 'a', 'L')][0]
        rb, lb = world.ends[(s['i'], 'b', 'R')][0], world.ends[(s['i'], 'b', 'L')][0]
        quad = dedupe([ra, rb, lb, la])
        if len(quad) >= 3 and area(quad) < 0:
            quad.reverse()
        s['quad'] = quad if len(quad) >= 3 and area(quad) > 1 else None
        if s['quad']:
            world.pavement.append((s['quad'], s['i']))
    for j in world.junctions:
        poly, o = j['polygon'], j['origin']
        tris = []
        for p, q in zip(poly, poly[1:] + poly[:1]):
            tri = [o, p, q]
            if area(tri) > 1:
                tris.append(tri)
        j['triangles'] = tris
        for tri in tris:
            world.pavement.append((tri, None))
    world.pavement_grid = Grid(2500.)
    for i, (poly, _) in enumerate(world.pavement):
        world.pavement_grid.add(i, bbox(poly))


def on_pavement(world, p, ignore=None):
    for i in world.pavement_grid.query((p[0], p[1], p[0], p[1])):
        poly, si = world.pavement[i]
        if si is not None and si == ignore:
            continue
        if point_in(p, poly):
            return True
    return False


# ---------------------------------------------------------------------------------------------
# Streets layer

class Surfaces:
    """Point -> ground height lookup for furniture placement."""

    def __init__(self):
        self.items, self.grid = [], Grid(2000.)

    def add(self, poly, z, kind):
        self.grid.add(len(self.items), bbox(poly))
        self.items.append((poly, z, kind))

    def at(self, p):
        best = (0., 'ground')
        for i in self.grid.query((p[0], p[1], p[0], p[1])):
            poly, z, kind = self.items[i]
            if point_in(p, poly) and z >= best[0]:
                best = (z, kind)
        return best


def crossing_records(world):
    """OSM crossing ways that cross a replica carriageway, with their Québec marking style."""
    signal_nodes = [world.nodes[n] for n, t in world.node_tags.items()
                    if t.get('highway') == 'traffic_signals' and n in world.nodes]
    stop_nodes = [(n, world.nodes[n]) for n, t in world.node_tags.items()
                  if t.get('highway') == 'stop' and n in world.nodes and inside(world.latlon[n])]
    world.signal_points = signal_nodes
    world.stop_nodes = stop_nodes
    sig_grid = Grid(3000.)
    for i, p in enumerate(signal_nodes):
        sig_grid.add(i, bbox([p]))
    world.signal_near = lambda p, r=3000: any(math.dist(p, signal_nodes[i]) < r
                                              for i in sig_grid.query(bbox([p], r)))
    records = []
    for w in world.ways:
        t = w['tags']
        if t.get('footway') != 'crossing' and t.get('highway') != 'crossing':
            continue
        pts = [world.nodes[r] for r in w['refs']]
        if len(pts) < 2:
            continue
        for a, b in zip(pts, pts[1:]):
            for si in world.seg_grid.query(bbox([a, b])):
                s = world.segs[si]
                if s['excluded'] or not segments_cross(a, b, s['pa'], s['pb']):
                    continue
                hit = line_isect(s['pa'], s['u'], a, (b[0] - a[0], b[1] - a[1]))
                if not hit:
                    continue
                along = hit[0]
                # Keep the 3 m band outside the junction box so arms' crosswalks never overlap.
                lo_a, hi_a = s['box_a'] + 165, s['len'] - s['box_b'] - 165
                if lo_a < hi_a:
                    if along < s['len'] / 2:
                        along = max(along, lo_a) if along < lo_a + 600 else along
                    else:
                        along = min(along, hi_a) if along > hi_a - 600 else along
                p = seg_point(s, along, 0)
                c, m = t.get('crossing', ''), t.get('crossing:markings', '')
                stop = any(math.dist(p, q) < 2500 for _, q in stop_nodes)
                signal = c == 'traffic_signals' or world.signal_near(p, 2500)
                if signal:
                    style = 'lines_white' if m == 'lines' else 'continental_white'
                elif c in ('uncontrolled', 'marked', 'zebra') or m in ('yes', 'zebra', 'lines'):
                    style = ('lines_white' if m == 'lines' else 'continental_white') if stop else 'continental_yellow'
                elif stop:
                    style = 'lines_white'
                else:
                    style = None
                records.append({'way': w['id'], 'seg': si, 'along': along, 'point': p, 'style': style,
                                'tags': {'crossing': c, 'crossing:markings': m}, 'stop': stop, 'signal': signal,
                                'ends': (a, b)})
    world.crossings = records


def paint_crosswalk(layer, s, along, style, counts, band=300.):
    if style is None:
        return
    lo, hi = -s['curbR'] + 25, s['curbL'] - 25
    if hi - lo < 200:
        return
    if style == 'lines_white':
        for d in (along - band / 2, along + band / 2):
            layer.strip('paint_white', seg_point(s, d, lo), seg_point(s, d, hi), 20, Z_PAINT)
        counts['crosswalks_lines_white'] += 1
    else:
        key = 'paint_yellow' if style == 'continental_yellow' else 'paint_white'
        lateral = lo + 25
        while lateral <= hi - 25:
            layer.strip(key, seg_point(s, along - band / 2, lateral), seg_point(s, along + band / 2, lateral), 50, Z_PAINT)
            lateral += 100
        counts['crosswalks_' + style] += 1


def build_streets(world):
    L = Layer('Streets', STREETS_MATERIALS)
    surfaces = Surfaces()
    world.surfaces = surfaces
    counts = {k: 0 for k in (
        'carriageway_quads', 'junction_polygons', 'sidewalk_pieces', 'sidewalk_metres', 'curb_ramps',
        'dropped_aprons', 'corner_pieces', 'yards', 'yard_square_metres', 'fence_metres', 'tree_pits',
        'stop_bars', 'stop_bars_signal', 'stop_bars_osm_stop', 'crosswalks_continental_white',
        'crosswalks_continental_yellow', 'crosswalks_lines_white', 'crosswalks_generated_at_stops',
        'centre_line_metres', 'lane_line_metres', 'parking_line_metres', 'bike_track_metres', 'bollards',
        'bike_pictograms', 'green_conflict_zones', 'manholes', 'storm_drains', 'ruelle_metres',
        'skipped_route_segments', 'stop_nodes_off_network')}
    # Carriageway asphalt.
    for s in world.segs:
        if s['excluded']:
            counts['skipped_route_segments'] += 1
            continue
        if s['quad']:
            L.flat('asphalt', s['quad'], Z_ROAD)
            surfaces.add(s['quad'], Z_ROAD, 'road')
            counts['carriageway_quads'] += 1
    for j in world.junctions:
        if j['excluded']:
            continue
        for tri in j['triangles']:
            L.flat('asphalt', tri, Z_ROAD)
            surfaces.add(tri, Z_ROAD, 'road')
        counts['junction_polygons'] += 1

    crossing_records(world)
    # Crossing points on curbs for ramps: crossing way ends + generated stop crosswalks (added below).
    ramp_points = [p for c in world.crossings for p in c['ends']]

    # Paint: stop bars at mapped stops (+ two-line crosswalk when none is mapped near it).
    stop_marks = []
    for nid, p in world.stop_nodes:
        best = None
        for si in world.seg_grid.query(bbox([p], 300)):
            s = world.segs[si]
            if s['excluded']:
                continue
            d = seg_dist(p, s['pa'], s['pb'])
            if d < 200 and (best is None or d < best[0]):
                best = (d, s)
        if best is None:
            counts['stop_nodes_off_network'] += 1
            continue
        s = best[1]
        along, _ = seg_local(s, p)
        forward = world.node_tags[nid].get('direction', 'forward') != 'backward'
        # Junction this stop serves = the end the approach runs toward.
        end = 'b' if forward else 'a'
        dist_to_end = s['len'] - along if forward else along
        mouth = s['mouth_' + end]
        bar = max(mouth + 420, min(dist_to_end, mouth + 900))
        bar_along = s['len'] - bar if forward else bar
        bar_along = max(20., min(s['len'] - 20, bar_along))
        stop_marks.append({'node': nid, 'seg': s['i'], 'along': bar_along, 'forward': forward, 'end': end})
    signal_arms = []
    for j in world.junctions:
        if j['excluded'] or len(j['arms']) < 3:
            continue
        if not world.signal_near(j['origin'], 2600):
            continue
        for arm in j['arms']:
            s = arm['seg']
            incoming = not s['oneway'] or (arm['end'] == 'b') == (s['tags'].get('oneway') != '-1')
            if incoming:
                signal_arms.append((s, arm['end']))
    world.stop_marks, world.signal_arms = stop_marks, signal_arms

    def bar(s, along, forward, kind):
        travel = s['u'] if forward else (-s['u'][0], -s['u'][1])
        if s['oneway']:
            lo, hi = -s['curbR'] + 20, s['curbL'] - 20
        elif forward:
            lo, hi = -s['curbR'] + 20, -12
        else:
            lo, hi = 12, s['curbL'] - 20
        if hi - lo < 150:
            return
        L.strip('paint_white', seg_point(s, along, lo), seg_point(s, along, hi), 40, Z_PAINT)
        counts['stop_bars'] += 1
        counts['stop_bars_' + kind] += 1
        return travel

    painted_crossings = set()
    for mark in stop_marks:
        s = world.segs[mark['seg']]
        bar(s, mark['along'], mark['forward'], 'osm_stop')
        toward = 1 if mark['forward'] else -1
        near = [c for c in world.crossings if c['seg'] == s['i'] and 0 < (c['along'] - mark['along']) * toward < 1500]
        if not near:
            cw = mark['along'] + toward * 280
            if 150 < cw < s['len'] - 150:
                paint_crosswalk(L, s, cw, 'lines_white', counts)
                counts['crosswalks_generated_at_stops'] += 1
                for side in (s['curbL'], -s['curbR']):
                    ramp_points.append(seg_point(s, cw, side))
        mark['crosswalk'] = bool(near) or True
    for s, end in signal_arms:
        forward = end == 'b'
        mouth = s['mouth_' + end]
        dist = mouth + 560
        if dist > s['len'] - 100:
            continue
        along = s['len'] - dist if forward else dist
        bar(s, along, forward, 'signal')
        toward = 1 if forward else -1
        near = [c for c in world.crossings if c['seg'] == s['i'] and 0 < (c['along'] - along) * toward < 1500]
        if not near:
            cw = along + toward * 260
            paint_crosswalk(L, s, cw, 'continental_white', counts)
            for side in (s['curbL'], -s['curbR']):
                ramp_points.append(seg_point(s, cw, side))
    done = []
    for c in world.crossings:
        key = (c['way'], c['seg'])
        if key in painted_crossings or any(si == c['seg'] and abs(al - c['along']) < 350 for si, al in done):
            continue
        painted_crossings.add(key)
        done.append((c['seg'], c['along']))
        paint_crosswalk(L, world.segs[c['seg']], c['along'], c['style'], counts)

    # Centre lines, lane lines, parking edge lines, manholes and drains on straight sections.
    cross_by_seg = {}
    for c in world.crossings:
        cross_by_seg.setdefault(c['seg'], []).append(c['along'])
    for mark in stop_marks:
        cross_by_seg.setdefault(mark['seg'], []).append(mark['along'])
    for s in world.segs:
        if s['excluded'] or not s['quad']:
            continue
        a0, a1 = s['mouth_a'] + 450, s['len'] - s['mouth_b'] - 450
        if a1 - a0 < 200:
            continue
        blocked = cross_by_seg.get(s['i'], [])

        def free(x):
            return all(abs(x - c) > 330 for c in blocked)

        lanes = 1
        try:
            lanes = int(float(s['tags'].get('lanes', '1').split(';')[0]))
        except ValueError:
            pass
        width = s['curbL'] + s['curbR']
        if not s['oneway'] and s['hw'] != 'living_street':
            for x in _dashes(a0, a1, 300 if lanes < 4 else 0, 600 if lanes < 4 else 0):
                if lanes >= 4:
                    for off in (-10, 10):
                        if free(x[0]) and free(x[1]):
                            L.strip('paint_yellow', seg_point(s, x[0], off), seg_point(s, x[1], off), 10, Z_PAINT)
                    counts['centre_line_metres'] += (x[1] - x[0]) / 100
                elif free(x[0]) and free(x[1]):
                    L.strip('paint_yellow', seg_point(s, x[0], 0), seg_point(s, x[1], 0), 11, Z_PAINT)
                    counts['centre_line_metres'] += (x[1] - x[0]) / 100
        parking = _parking_sides(s)
        # Lane lines between same-direction lanes.
        if s['oneway'] and lanes >= 2 or not s['oneway'] and lanes >= 4:
            right = -s['curbR'] + (230 if parking['R'] else 0)
            left = s['curbL'] - (230 if parking['L'] else 0)
            groups = [(right, left, lanes)] if s['oneway'] else [(right, 0, lanes // 2), (0, left, lanes // 2)]
            for lo, hi, n in groups:
                for k in range(1, n):
                    off = lo + (hi - lo) * k / n
                    for x in _dashes(a0, a1, 300, 600):
                        if free(x[0]) and free(x[1]):
                            L.strip('paint_white', seg_point(s, x[0], off), seg_point(s, x[1], off), 10, Z_PAINT)
                            counts['lane_line_metres'] += (x[1] - x[0]) / 100
        for side, sign in (('L', 1), ('R', -1)):
            if parking[side] and (s['hw'] in ARTERIAL or 'parking:' + ('left' if side == 'L' else 'right') in s['tags']
                                  or 'parking:both' in s['tags']):
                off = sign * (s['curb' + side] - 230)
                if abs(off) > 150:
                    L.strip('paint_white', seg_point(s, a0, off), seg_point(s, a1, off), 10, Z_PAINT)
                    counts['parking_line_metres'] += (a1 - a0) / 100
        rng = Rng('manhole', s['way'], s['i'])
        x = a0 + rng.uniform(300, 2500)
        while x < a1:
            off = rng.uniform(-min(250, s['curbR'] - 300), min(250, s['curbL'] - 300))
            _disc(L, 'cast_iron', seg_point(s, x, off), 34, Z_PAINT2 - .05, 12)
            counts['manholes'] += 1
            x += rng.uniform(3500, 7000)
        for end_along in (a0 - 150, a1 + 150):
            for side, sign in (('L', 1), ('R', -1)):
                if rng.chance(.75):
                    off = sign * (s['curb' + side] - 28)
                    c = seg_point(s, end_along, off)
                    L.box('cast_iron', (c[0], c[1], Z_ROAD + .06), (64, 40, .12),
                          math.degrees(math.atan2(s['u'][1], s['u'][0])), bottom=False)
                    for k in (-18, -6, 6, 18):
                        g = seg_point(s, end_along + k, off)
                        L.strip('joint', add(g, s['n'], -12), add(g, s['n'], 12), 3, Z_ROAD + .2)
                    counts['storm_drains'] += 1

    _bike_tracks(world, L, counts)

    # Sidewalks, curb bands, joints, ramps, aprons; corners; yards and fences; tree pits.
    trees = [world.nodes[n] for n, t in world.node_tags.items() if t.get('natural') == 'tree' and n in world.nodes]
    tree_grid = Grid(2000.)
    for i, p in enumerate(trees):
        tree_grid.add(i, bbox([p]))
    ramp_grid = Grid(2000.)
    for i, p in enumerate(ramp_points):
        ramp_grid.add(i, bbox([p], 400))
    world.ramp_points = ramp_points
    world.sidewalk_strips = []
    pit_trees = set()
    for s in world.segs:
        if s['excluded']:
            continue
        for side in ('L', 'R'):
            if s['w' + side] <= 0:
                continue
            ea, eb = world.ends[(s['i'], 'a', side)], world.ends[(s['i'], 'b', side)]
            if side == 'R':
                ea, eb = eb, ea
            ca, oa, cb, ob = ea[0], ea[1], eb[0], eb[1]
            length = math.dist(ca, cb)
            if length < 60:
                continue
            corner_q = (ea[3] if len(ea) > 3 else None, eb[3] if len(eb) > 3 else None)
            corner_z = (ea[4] if len(ea) > 4 else 0., eb[4] if len(eb) > 4 else 0.)
            strip = {'seg': s, 'side': side, 'curb': (ca, cb), 'outer': (oa, ob), 'len': length,
                     'corner_q': corner_q, 'corner_z': corner_z}
            world.sidewalk_strips.append(strip)
            _sidewalk_strip(world, L, surfaces, strip, ramp_grid, ramp_points, counts)
            _tree_pits(world, L, strip, trees, tree_grid, pit_trees, counts)
            _yards(world, L, surfaces, strip, counts)
    for row in world.corners:
        _corner(world, L, surfaces, row, counts)
    _ruelles(world, L, surfaces, counts)
    world.pit_trees = pit_trees
    for k in ('sidewalk_metres', 'yard_square_metres', 'fence_metres', 'centre_line_metres', 'lane_line_metres',
              'parking_line_metres', 'bike_track_metres', 'ruelle_metres'):
        counts[k] = round(counts[k])
    counts['curb_measurement'] = world.curb_stats
    counts['osm_stop_nodes_inside'] = len(world.stop_nodes)
    counts['osm_crossings_on_replica'] = len({c['way'] for c in world.crossings})
    counts['signalised_approaches'] = len(world.signal_arms)
    counts['osm_trees_in_pits'] = len(pit_trees)
    return L, counts


def _dashes(a0, a1, dash, gap):
    if dash <= 0:
        return [(a0, a1)]
    out, x = [], a0
    while x + dash <= a1:
        out.append((x, x + dash))
        x += dash + gap
    return out


def _parking_sides(s):
    t = s['tags']
    both = t.get('parking:both', t.get('parking:lane:both'))
    out = {}
    for side, name in (('L', 'left'), ('R', 'right')):
        v = t.get('parking:' + name, t.get('parking:lane:' + name, both))
        if v is None:
            v = 'lane' if s['hw'] in ('residential', 'unclassified') or (s['hw'] == 'secondary' and s['oneway']) else 'no'
        out[side] = v in ('lane', 'street_side', 'on_street', 'parallel', 'half_on_kerb')
    return out


def _disc(layer, key, c, r, z, sides=12):
    layer.flat(key, [(c[0] + r * math.cos(i * math.tau / sides), c[1] + r * math.sin(i * math.tau / sides))
                     for i in range(sides)], z)


def _bike_tracks(world, L, counts):
    """On-street cycle tracks (Rachel, Brébeuf, Cherrier...): edge line, centre dashes, pictograms,
    green conflict zones at junction mouths and 1.16 m green flexible bollards (no collision)."""
    for w in world.ways:
        t = w['tags']
        if t.get('highway') != 'cycleway':
            continue
        pts = [world.nodes[r] for r in w['refs']]
        for a, b in zip(pts, pts[1:]):
            length = math.dist(a, b)
            if length < 300:
                continue
            mid = lerp(a, b, .5)
            if world.route_near(mid) or not (world.box[0] < mid[0] < world.box[2] and world.box[1] < mid[1] < world.box[3]):
                continue
            u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
            host = None
            for si in world.seg_grid.query(bbox([mid], 200)):
                s = world.segs[si]
                if abs(u[0] * s['u'][0] + u[1] * s['u'][1]) < .95 or s['excluded']:
                    continue
                along, lat = seg_local(s, mid)
                if -100 < along < s['len'] + 100 and (-s['curbR'] + 50 < lat < s['curbL'] - 50):
                    host = (s, lat)
                    break
            if host is None:
                continue
            s, lat = host
            sign = 1 if lat > 0 else -1          # track lies on this side of the street centreline
            n = s['n']
            counts['bike_track_metres'] += length / 100
            edge = lat - sign * 165               # traffic-side edge of a 3 m track
            p0, p1 = seg_local(s, a)[0], seg_local(s, b)[0]
            lo, hi = sorted((p0, p1))
            lo, hi = max(lo, s['mouth_a'] + 300), min(hi, s['len'] - s['mouth_b'] - 300)
            if hi - lo > 200:
                L.strip('paint_white', seg_point(s, lo, edge), seg_point(s, hi, edge), 12, Z_PAINT)
                if t.get('oneway') != 'yes':
                    for x in _dashes(lo, hi, 300, 300):
                        L.strip('paint_yellow', seg_point(s, x[0], lat), seg_point(s, x[1], lat), 10, Z_PAINT)
                x = lo + 200
                while x < hi - 100:
                    c = seg_point(s, x, edge - sign * 45)
                    _bollard(L, c)
                    counts['bollards'] += 1
                    x += 400
                x = lo + 600
                while x < hi - 300:
                    _bike_pictogram(L, seg_point(s, x, lat + sign * 70), s['u'], Z_PAINT)
                    counts['bike_pictograms'] += 1
                    x += 4000
            for end, edge_along in (('a', s['mouth_a']), ('b', s['len'] - s['mouth_b'])):
                if lo - 400 < edge_along < hi + 400 and s['mouth_' + end] > 150:
                    span = (edge_along - s['mouth_' + end], edge_along) if end == 'a' else (edge_along, edge_along + s['mouth_' + end])
                    L.strip('paint_green', seg_point(s, span[0], lat), seg_point(s, span[1], lat), 290, Z_PAINT)
                    counts['green_conflict_zones'] += 1


def _bollard(L, c):
    L.rod('bollard_green', (c[0], c[1], Z_ROAD), (c[0], c[1], Z_ROAD + 116), 6, 6, caps=False)
    L.cone('bollard_green', (c[0], c[1], Z_ROAD + 116), 6, 3, 6)
    L.rod('paint_white', (c[0], c[1], Z_ROAD + 92), (c[0], c[1], Z_ROAD + 104), 6.3, 6)


def _bike_pictogram(L, c, u, z):
    """White bicycle symbol (two wheels and a frame) on a cycle track."""
    n = (-u[1], u[0])
    for k in (-55, 55):
        w = add(c, u, k)
        ring = [add(w, (u[0] * math.cos(i * math.tau / 12) + n[0] * math.sin(i * math.tau / 12),
                        u[1] * math.cos(i * math.tau / 12) + n[1] * math.sin(i * math.tau / 12)), 32) for i in range(12)]
        for p, q in zip(ring, ring[1:] + ring[:1]):
            L.strip('paint_white', p, q, 6, z + .02)
    L.strip('paint_white', add(c, u, -55), add(c, u, 10), 6, z + .02)
    L.strip('paint_white', add(c, u, 10), add(c, u, 55), 6, z + .02)


def _sidewalk_strip(world, L, surfaces, strip, ramp_grid, ramp_points, counts):
    (ca, cb), (oa, ob), length = strip['curb'], strip['outer'], strip['len']
    pieces = max(1, round(length / 150))
    # Crossing points along this curb line -> ramp profile.
    stops = []
    for i in ramp_grid.query(bbox([ca, cb], 300)):
        p = ramp_points[i]
        d = seg_dist(p, ca, cb)
        if d < 260:
            t = ((p[0] - ca[0]) * (cb[0] - ca[0]) + (p[1] - ca[1]) * (cb[1] - ca[1])) / (length * length)
            if -.05 <= t <= 1.05:
                stops.append(t * length)

    def zat(x):
        d = min([abs(x - c) for c in stops], default=1e9)
        if d <= 110:
            return Z_DROP
        if d < 280:
            return Z_DROP + (Z_WALK - Z_DROP) * (d - 110) / 170
        return Z_WALK

    strip['ramps'] = stops
    curb_n = None
    prev_walls = None
    for k in range(pieces):
        f0, f1 = k / pieces, (k + 1) / pieces
        c0, c1, o1, o0 = lerp(ca, cb, f0), lerp(ca, cb, f1), lerp(oa, ob, f1), lerp(oa, ob, f0)
        poly = [c0, c1, o1, o0]
        if area(poly) < 50:
            continue
        mid = lerp(lerp(c0, c1, .5), lerp(o0, o1, .5), .5)
        if on_pavement(world, mid, strip['seg']['i']) or world.in_building(mid):
            continue
        za, zb = zat(f0 * length), zat(f1 * length)
        clear = world.traffic_distance(poly) >= CLEAR
        if not clear:
            L.flat('curb', poly, Z_DROP)
            surfaces.add(poly, Z_DROP, 'apron')
            counts['dropped_aprons'] += 1
            continue
        L.face('sidewalk', [(c0[0], c0[1], za), (c1[0], c1[1], zb), (o1[0], o1[1], zb), (o0[0], o0[1], za)])
        # Curb face toward the road and the back wall; end walls only at strip ends.
        L.wall('sidewalk', c1, c0, 0., zb, 0., za)
        L.wall('sidewalk', o0, o1, 0., za, 0., zb)
        if k == 0:
            L.wall('sidewalk', c0, o0, 0., za)
        if k == pieces - 1:
            L.wall('sidewalk', o1, c1, 0., zb)
        surfaces.add(poly, max(za, zb), 'sidewalk')
        counts['sidewalk_pieces'] += 1
        counts['sidewalk_metres'] += math.dist(c0, c1) / 100
        if min(za, zb) < Z_WALK - .01 and max(za, zb) >= Z_WALK - .01:
            counts['curb_ramps'] += 1
        # Light curb top band (15 cm) and a saw-cut joint at the piece start.
        d = math.dist(c0, o0) or 1.
        band0, band1 = lerp(c0, o0, 15 / d), lerp(c1, o1, 15 / d)
        L.face('curb', [(c0[0], c0[1], za + .1), (c1[0], c1[1], zb + .1), (band1[0], band1[1], zb + .1),
                        (band0[0], band0[1], za + .1)])
        if k > 0 and za == Z_WALK:
            L.strip('joint', lerp(c0, o0, 16 / d), o0, 1.3, za + .12)


def _corner(world, L, surfaces, row, counts):
    """Sidewalk ring around a curb fillet or bend, plus the corner yard fan up to the property corner."""
    a, b = row['a'], row['b']
    if world.route_near(row['a']['o']) or a['wL'] <= 0 or b['wR'] <= 0:
        return
    if row['kind'] == 'fillet':
        outer_line, inner_line = row['arc'], row['inner']
    elif row['kind'] == 'bend':
        outer_line, inner_line = row['arc'], row['outer']
    else:
        return
    for p0, p1, q1, q0 in zip(outer_line, outer_line[1:], inner_line[1:], inner_line[:-1]):
        quad = [p0, p1, q1, q0]
        if abs(area(quad)) < 5 or world.in_building(lerp(p0, q1, .5)):
            continue
        if world.traffic_distance(quad) < CLEAR:
            for tri in ([p0, p1, q1], [p0, q1, q0]):
                L.flat('curb', tri, Z_DROP)
            counts['dropped_aprons'] += 1
            continue
        ccw = area(quad) > 0
        for tri in ([p0, p1, q1], [p0, q1, q0]):
            L.flat('sidewalk', tri, Z_WALK)
            surfaces.add(tri, Z_WALK, 'sidewalk')
        # Curb face along the arc (toward the road) and the back wall along the property line.
        if ccw:
            L.wall('sidewalk', p1, p0, 0., Z_WALK)
            L.wall('sidewalk', q0, q1, 0., Z_WALK)
        else:
            L.wall('sidewalk', p0, p1, 0., Z_WALK)
            L.wall('sidewalk', q1, q0, 0., Z_WALK)
        d0, d1 = math.dist(p0, q0) or 1., math.dist(p1, q1) or 1.
        for tri in ([p0, p1, lerp(p1, q1, 15 / d1)], [p0, lerp(p1, q1, 15 / d1), lerp(p0, q0, 15 / d0)]):
            L.flat('curb', tri, Z_WALK + .1)
        counts['corner_pieces'] += 1


def _tree_pits(world, L, strip, trees, tree_grid, pit_trees, counts):
    (ca, cb), (oa, ob), length = strip['curb'], strip['outer'], strip['len']
    u = ((cb[0] - ca[0]) / length, (cb[1] - ca[1]) / length)
    width = math.dist(ca, oa)
    if width < 160:
        return
    inward = ((oa[0] - ca[0]) / width, (oa[1] - ca[1]) / width)
    yaw = math.degrees(math.atan2(u[1], u[0]))
    for i in tree_grid.query(bbox([ca, cb, oa, ob])):
        p = trees[i]
        if i in pit_trees:
            continue
        rel = (p[0] - ca[0], p[1] - ca[1])
        along = rel[0] * u[0] + rel[1] * u[1]
        lat = rel[0] * inward[0] + rel[1] * inward[1]
        if not (60 < along < length - 60 and 20 < lat < width + 40):
            continue
        if any(abs(along - r) < 300 for r in strip.get('ramps', [])):
            continue
        pit_trees.add(i)
        lat = max(60., min(width - 55, lat))
        c = add(add(ca, u, along), inward, lat)
        size = (110, 100)
        q = lambda x, y: (c[0] + u[0] * x + inward[0] * y, c[1] + u[1] * x + inward[1] * y)
        L.flat('soil', [q(-size[0] / 2, -size[1] / 2), q(size[0] / 2, -size[1] / 2),
                        q(size[0] / 2, size[1] / 2), q(-size[0] / 2, size[1] / 2)], Z_WALK + .15)
        for x0, y0, x1, y1 in ((-55, -50, 55, -50), (55, -50, 55, 50), (55, 50, -55, 50), (-55, 50, -55, -50)):
            L.rod('iron', (*q(x0, y0), Z_WALK + 2), (*q(x1, y1), Z_WALK + 2), 1.6, 4)
        rng = Rng('pit', i)
        if rng.chance(.45):
            # Low hooped fence typical of Plateau tree pits.
            for x, y in ((-55, -50), (55, -50), (55, 50), (-55, 50)):
                L.rod('iron', (*q(x, y), Z_WALK), (*q(x, y), Z_WALK + 38), 1.4, 4)
            for x0, y0, x1, y1 in ((-55, -50, 55, -50), (55, -50, 55, 50), (55, 50, -55, 50), (-55, 50, -55, -50)):
                L.rod('iron', (*q(x0, y0), Z_WALK + 36), (*q(x1, y1), Z_WALK + 36), 1.2, 4)
        counts['tree_pits'] += 1
        strip.setdefault('pits', []).append((along, c, yaw))


def _yards(world, L, surfaces, strip, counts):
    """Parterres between the sidewalk and the façade line, one piece per ~7.6 m lot."""
    s = strip['seg']
    (ca, cb), (oa, ob), length = strip['curb'], strip['outer'], strip['len']
    w0 = math.dist(ca, oa) or 1.
    out = ((oa[0] - ca[0]) / w0, (oa[1] - ca[1]) / w0)
    # Yards reach the sharp property corner at fillet corners; the later arm sits 3 mm higher.
    qa, qb = strip['corner_q']
    if qa is not None and math.dist(qa, oa) < 600:
        oa = qa
    if qb is not None and math.dist(qb, ob) < 600:
        ob = qb
    olen = math.dist(oa, ob)
    if olen < 200:
        return
    plex = s['hw'] in ('residential', 'unclassified', 'living_street')
    fac = s['facade' + strip['side']]
    curb = s['curb' + strip['side']]
    max_depth = 900. if fac is None else max(0., min(900., fac - curb - w0 + 120))
    lots = max(1, round(olen / 760))
    strip['lots'] = []
    for k in range(lots):
        f0, f1 = k / lots, (k + 1) / lots
        p0, p1 = lerp(oa, ob, f0), lerp(oa, ob, f1)
        zoff = strip['corner_z'][0] if k == 0 else strip['corner_z'][1] if k == lots - 1 else 0.
        hits = []
        for f in (.08, .5, .92):
            hit = world.building_ray(lerp(p0, p1, f), out, 1500)
            hits.append(hit)
        found = [h for h in hits if h is not None]
        rng = Rng('yard', s['way'], s['i'], strip['side'], k)
        if found:
            depth = min(min(found) - 3, max_depth if max_depth > 60 else min(found) - 3)
        else:
            mid = lerp(p0, p1, .5)
            if world.in_park(add(mid, out, 150)):
                continue
            depth = min(250., max_depth) if max_depth > 0 else 250.
        if depth < 50:
            strip['lots'].append({'p0': p0, 'p1': p1, 'depth': 0, 'out': out})
            continue
        q0, q1 = add(p0, out, depth), add(p1, out, depth)
        poly = [p0, p1, q1, q0]
        if area(poly) < 0:
            poly = [p1, p0, q0, q1]
        centre = lerp(lerp(p0, p1, .5), lerp(q0, q1, .5), .5)
        if any(on_pavement(world, p) for p in (centre, lerp(p0, q0, .5), lerp(p1, q1, .5))) or world.in_building(centre):
            continue
        if world.traffic_distance(poly) < CLEAR or world.in_park(centre):
            continue
        lot_len = math.dist(p0, p1)
        walk = plex and depth >= 120 and lot_len > 420 and rng.chance(.8)
        walk_at = rng.uniform(.18, .82)
        kind = 'yard_grass' if rng.chance(.68) else 'yard_soil'
        pieces = []
        if walk:
            a = max(0., walk_at - 55 / lot_len)
            b = min(1., walk_at + 55 / lot_len)
            pieces = [(0., a, kind), (a, b, 'yard_path'), (b, 1., kind if rng.chance(.7) else 'yard_soil')]
        else:
            pieces = [(0., 1., kind)]
        for g0, g1, mat in pieces:
            if g1 - g0 < .02:
                continue
            e0, e1 = lerp(p0, p1, g0), lerp(p0, p1, g1)
            e2, e3 = add(e1, out, depth), add(e0, out, depth)
            pp = [e0, e1, e2, e3]
            if area(pp) < 0:
                pp = pp[::-1]
            L.flat(mat, pp, Z_WALK + zoff)
            for x, y in zip(pp, pp[1:] + pp[:1]):
                L.wall(mat, x, y, 0., Z_WALK + zoff)
            surfaces.add(pp, Z_WALK, 'yard')
            if mat == 'yard_grass':
                _soft_edge(L, e0, e1, out, Rng('edge', s['way'], s['i'], strip['side'], k, g0), zoff)
        counts['yards'] += 1
        counts['yard_square_metres'] += lot_len * depth / 10000
        lot = {'p0': p0, 'p1': p1, 'depth': depth, 'out': out, 'walk': walk_at if walk else None,
               'fence': False, 'kind': kind, 'plex': plex}
        if plex and depth >= 100 and rng.chance(.72):
            _fence(L, p0, p1, out, walk_at if walk else None, rng, counts)
            lot['fence'] = True
        strip['lots'].append(lot)


def _soft_edge(L, a, b, out, rng, zoff=0.):
    """Jittered grass spill over the sidewalk edge so the seam is not a ruler line."""
    length = math.dist(a, b)
    steps = max(2, int(length / 38))
    pts_in, pts_out = [], []
    for i in range(steps + 1):
        p = lerp(a, b, i / steps)
        pts_in.append(add(p, out, -rng.uniform(0., 9.)))
        pts_out.append(add(p, out, rng.uniform(6., 16.)))
    for p0, p1, q1, q0 in zip(pts_in, pts_in[1:], pts_out[1:], pts_out[:-1]):
        poly = [p0, p1, q1, q0]
        if area(poly) < 0:
            poly = poly[::-1]
        L.flat('grass_edge', poly, Z_WALK + .14 + zoff)


def _fence(L, p0, p1, out, walk, rng, counts):
    length = math.dist(p0, p1)
    u = ((p1[0] - p0[0]) / length, (p1[1] - p0[1]) / length)
    a, b = add(p0, out, 9), add(p1, out, 9)
    h = rng.choice((62., 72., 80.))
    spans = [(10., length - 10.)]
    if walk is not None:
        g0, g1 = walk * length - 62, walk * length + 62
        spans = [(10., g0), (g1, length - 10.)]
    for s0, s1 in spans:
        if s1 - s0 < 40:
            continue
        x0, x1 = add(a, u, s0), add(a, u, s1)
        for z in (12., h - 4):
            L.rod('iron', (*x0, Z_WALK + z), (*x1, Z_WALK + z), 1.3, 3)
        posts = max(1, int((s1 - s0) / 150))
        for i in range(posts + 1):
            p = lerp(x0, x1, i / posts)
            L.rod('iron', (*p, Z_WALK), (*p, Z_WALK + h + 4), 2.0, 4)
            L.cone('iron', (p[0], p[1], Z_WALK + h + 4), 2.6, 5, 4)
        pickets = int((s1 - s0) / 24)
        for i in range(1, pickets):
            p = add(x0, u, i * (s1 - s0) / pickets)
            L.rod('iron', (*p, Z_WALK + 10), (*p, Z_WALK + h - 2), .7, 3)
        counts['fence_metres'] += (s1 - s0) / 100


def _ruelles(world, L, surfaces, counts):
    world.alleys = []
    box = world.box
    for w in world.ways:
        t = w['tags']
        if t.get('highway') != 'service' or t.get('service') != 'alley':
            continue
        pts = [world.nodes[r] for r in w['refs']]
        segs = []
        for a, b in zip(pts, pts[1:]):
            clip = clip_param(a, b, box)
            if clip is None:
                continue
            pa, pb = lerp(a, b, clip[0]), lerp(a, b, clip[1])
            if math.dist(pa, pb) < 100 or world.route_near(lerp(pa, pb, .5)):
                continue
            segs.append((pa, pb))
            L.strip('alley', pa, pb, 430, Z_ALLEY)
            L.strip('alley_gutter', pa, pb, 36, Z_ALLEY + .1)
            for cap in (pa, pb):
                _disc(L, 'alley', cap, 215, Z_ALLEY - .05, 10)
            counts['ruelle_metres'] += math.dist(pa, pb) / 100
        if segs:
            world.alleys.append({'id': w['id'], 'segments': segs, 'traffic': all(inside(world.latlon[r]) for r in w['refs']),
                                 'name': t.get('name', '')})


# ---------------------------------------------------------------------------------------------
# Furniture placements

def nearest_seg(world, p, radius=2500):
    best = None
    for si in world.seg_grid.query(bbox([p], radius)):
        s = world.segs[si]
        d = seg_dist(p, s['pa'], s['pb'])
        if best is None or d < best[0]:
            best = (d, s)
    return best


def facing_road(world, p):
    best = nearest_seg(world, p)
    if best is None:
        return 0., None
    s = best[1]
    along, lat = seg_local(s, p)
    q = seg_point(s, max(0, min(s['len'], along)), 0)
    return math.degrees(math.atan2(q[1] - p[1], q[0] - p[0])), (s, along, lat)


def snap_to_sidewalk(world, p, extra=55.):
    """Move a point out of the carriageway / traffic band onto the nearest curb + extra."""
    yaw, loc = facing_road(world, p)
    if loc is None:
        return p, 0.
    s, along, lat = loc
    side = 'L' if lat >= 0 else 'R'
    target = (s['curb' + side] + extra) * (1 if lat >= 0 else -1)
    q = seg_point(s, max(0., min(s['len'], along)), target)
    return q, math.dist(p, q)


def placement(world, prop, p, yaw, collision, seed_parts, extra=None, z=None):
    ground, kind = world.surfaces.at(p) if z is None else (z, 'given')
    row = {'prop': prop, 'position': [r2(p[0]), r2(p[1]), r2(ground)], 'yaw': r2(yaw % 360), 'scale': 1.0,
           'variant_seed': seed(*seed_parts) % 1000000, 'collision': bool(collision), 'ground': kind}
    if extra:
        row.update(extra)
    return row


def street_name_parts(name):
    for generic in ('Avenue', 'Rue', 'Place', 'Boulevard', 'Ruelle', 'Chemin', 'Terrasse', 'Carré'):
        if name.startswith(generic + ' '):
            return generic, name[len(generic) + 1:]
    return '', name


def build_furniture(world):
    rows, counts = [], {}

    def put(prop, p, yaw, collides, parts, extra=None, z=None, allow_snap=True):
        moved = 0.
        if collides and allow_snap and (world.traffic_distance(p) < CLEAR or on_pavement(world, p)):
            p, moved = snap_to_sidewalk(world, p)
        clear = world.traffic_distance(p) >= CLEAR + 40
        row = placement(world, prop, p, yaw, collides and clear, parts, extra, z)
        if moved:
            row['snapped_cm'] = r2(moved)
        rows.append(row)
        counts[prop] = counts.get(prop, 0) + 1
        return row

    inside_nodes = [(n, t) for n, t in world.node_tags.items() if n in world.nodes and inside(world.latlon[n])]
    for n, t in inside_nodes:
        p = world.nodes[n]
        if world.route_near(p):
            continue
        if t.get('highway') == 'street_lamp':
            yaw, _ = facing_road(world, p)
            prop = 'lamp_park' if world.in_park(p) and not on_pavement(world, p) else 'lamp_cobra'
            put(prop, p, yaw, True, ('lamp', n), {'osm_node': n})
        elif t.get('emergency') == 'fire_hydrant':
            yaw, _ = facing_road(world, p)
            put('hydrant', p, yaw, True, ('hydrant', n), {'osm_node': n})
        elif t.get('amenity') == 'bicycle_rental':
            yaw, loc = facing_road(world, p)
            cap = 19
            try:
                cap = int(t.get('capacity', '19'))
            except ValueError:
                pass
            info = props_info()
            street = yaw + 90                     # along the street
            dock_yaw = street - 90                # MAP-PROPS: slots run along the dock's +Y
            modules = max(1, min(4, math.ceil(cap / len(info['bixi_slots']))))
            u = (math.cos(math.radians(street)), math.sin(math.radians(street)))
            rng = Rng('bixi', n)
            for m in range(modules):
                c = add(p, u, (m - (modules - 1) / 2) * (info['bixi_length'] + 10))
                dock = put('bixi_dock', c, dock_yaw, True, ('bixi', n, m),
                           {'osm_node': n, 'name': t.get('name', ''), 'module': m, 'capacity': cap}, allow_snap=False)
                for slot, (sx, sy, syaw) in enumerate(info['bixi_slots']):
                    if rng.chance(.6):
                        b = local_to_world(dock['position'], dock_yaw, (sx, sy))
                        put('bixi_bike', b, dock_yaw + syaw, False, ('bixi_bike', n, m, slot),
                            {'osm_node': n, 'module': m, 'slot': slot}, z=dock['position'][2], allow_snap=False)
        elif t.get('amenity') == 'bench' and not world.in_park(p):
            yaw, _ = facing_road(world, p)
            put('bench', p, yaw + 180, True, ('bench', n), {'osm_node': n})
        elif t.get('amenity') == 'post_box':
            yaw, _ = facing_road(world, p)
            put('mailbox', p, yaw, True, ('mailbox', n), {'osm_node': n})
        elif t.get('amenity') == 'waste_basket':
            yaw, _ = facing_road(world, p)
            put('bin_garbage', p, yaw, False, ('basket', n), {'osm_node': n, 'osm': 'amenity=waste_basket'})
        elif t.get('amenity') == 'recycling':
            yaw, _ = facing_road(world, p)
            put('bin_recycling', p, yaw, False, ('recycling', n), {'osm_node': n})

    # ARRÊT signs at the bar of every mapped stop, on the approach's right sidewalk.
    for mark in world.stop_marks:
        s = world.segs[mark['seg']]
        travel_sign = 1 if mark['forward'] else -1
        lat = -(s['curbR'] + 55) if mark['forward'] else (s['curbL'] + 55)
        p = seg_point(s, mark['along'] - travel_sign * 60, lat)
        yaw = math.degrees(math.atan2(-s['u'][1] * travel_sign, -s['u'][0] * travel_sign))
        put('sign_stop', p, yaw, True, ('stop', mark['node']), {'osm_node': mark['node'], 'text': 'ARRÊT',
                                                                  'code': 'RA-A'})

    # Street-name and one-way signs at junction corners.
    for j in world.junctions:
        if j['excluded']:
            continue
        names = []
        for arm in j['arms']:
            nm = arm['seg']['name']
            if nm and nm not in [x[0] for x in names]:
                names.append((nm, arm))
        fillets = [r for r in j['corners'] if r['kind'] == 'fillet']
        if len(names) >= 2 and fillets:
            rng = Rng('corner', j['node'])
            picks = [rng.choice(fillets)]
            if any(a['seg']['hw'] in ARTERIAL for _, a in names) and len(fillets) > 2:
                opposite = max(fillets, key=lambda r: math.dist(r['C'], picks[0]['C']))
                picks.append(opposite)
            for ci, corner in enumerate(picks):
                inner = corner['inner']
                mid_arc, mid_in = corner['arc'][len(corner['arc']) // 2], inner[len(inner) // 2]
                d = math.dist(mid_arc, mid_in) or 1.
                post = lerp(mid_arc, mid_in, min(.5, 45 / d))
                (name_a, arm_a), (name_b, _) = names[0], names[1]
                # MAP-PROPS sign_street: blade A runs along the prop's +Y, blade B along +X.
                yaw = math.degrees(math.atan2(arm_a['u'][1], arm_a['u'][0])) - 90
                text = {}
                for blade, nm in (('blade_a', name_a), ('blade_b', name_b)):
                    generic, specific = street_name_parts(nm)
                    text[blade] = {'generic': generic, 'specific': specific, 'full': nm}
                put('sign_street', post, yaw, True, ('street_sign', j['node'], ci),
                    {'text': text, 'junction_node': j['node'], 'code': 'NR-U'}, allow_snap=False)
                counts['street_name_corners'] = counts.get('street_name_corners', 0) + 1
        for arm in j['arms']:
            s = arm['seg']
            if not s['oneway'] or not s['name']:
                continue
            rows_here = [r for r in j['corners'] if r['kind'] == 'fillet' and (r['a'] is arm or r['b'] is arm)]
            if not rows_here:
                continue
            corner = rows_here[0]
            mid_arc, mid_in = corner['arc'][len(corner['arc']) // 2], corner['inner'][len(corner['inner']) // 2]
            d = math.dist(mid_arc, mid_in) or 1.
            post = lerp(mid_arc, mid_in, min(.6, 60 / d))
            travel = s['u'] if s['tags'].get('oneway') != '-1' else (-s['u'][0], -s['u'][1])
            heading = math.degrees(math.atan2(travel[1], travel[0]))
            # MAP-PROPS sign_oneway: the arrow points along the prop's +Y, so yaw = heading - 90.
            put('sign_oneway', post, heading - 90, True, ('oneway', j['node'], s['i']),
                {'traffic_heading': r2(heading % 360), 'code': 'RN-A', 'street': s['name']}, allow_snap=False)

    # Parking signs along residential and arterial curbs.
    for strip in world.sidewalk_strips:
        s = strip['seg']
        (ca, cb), length = strip['curb'], strip['len']
        if length < 1200 or s['hw'] == 'living_street':
            continue
        u = ((cb[0] - ca[0]) / length, (cb[1] - ca[1]) / length)
        inward = (strip['outer'][0][0] - ca[0], strip['outer'][0][1] - ca[1])
        il = math.hypot(*inward) or 1.
        inward = (inward[0] / il, inward[1] / il)
        rng = Rng('parking', s['way'], s['i'], strip['side'])
        x = rng.uniform(500, 1400)
        while x < length - 500:
            if all(abs(x - r) > 400 for r in strip.get('ramps', [])):
                p = add(add(ca, u, x), inward, 45)
                code, text = rng.choice(PARKING_TEXTS)
                yaw = math.degrees(math.atan2(u[1], u[0])) + (180 if rng.chance(.5) else 0)
                put('sign_parking', p, yaw, True, ('parking', s['i'], strip['side'], round(x)),
                    {'code': code, 'text': text, 'arrow': rng.choice(('both', 'left', 'right'))}, allow_snap=False)
            x += rng.uniform(2200, 3600)
    counts['total'] = len(rows)
    counts['osm_lamps_inside'] = sum(1 for _, t in inside_nodes if t.get('highway') == 'street_lamp')
    counts['osm_hydrants_inside'] = sum(1 for _, t in inside_nodes if t.get('emergency') == 'fire_hydrant')
    counts['osm_bixi_inside'] = sum(1 for _, t in inside_nodes if t.get('amenity') == 'bicycle_rental')
    counts['osm_stops_inside'] = len(world.stop_nodes)
    counts['collision_disabled_in_traffic_band'] = sum(1 for r in rows if not r['collision'] and
                                                       r['prop'] in ('lamp_cobra', 'lamp_park', 'hydrant', 'sign_stop',
                                                                     'sign_oneway', 'sign_parking', 'bixi_dock'))
    counts['snapped_out_of_carriageway'] = sum(1 for r in rows if 'snapped_cm' in r)
    return rows, counts


# ---------------------------------------------------------------------------------------------
# Soul layer: seeded wear and life

def build_soul(world):
    S = Layer('Soul', SOUL_MATERIALS)
    rows, counts = [], {k: 0 for k in ('asphalt_patches', 'trench_patches', 'crack_lines', 'potholes', 'gutter_leaf_drifts',
                                        'pit_leaf_covers', 'loose_leaves', 'weed_tufts', 'rust_streaks', 'murals',
                                        'chantier_zones', 'utility_poles', 'wire_spans', 'laundry_lines',
                                        'curb_bins', 'locked_bikes', 'flower_boxes', 'ac_units')}

    def put(prop, p, yaw, collides, parts, extra=None, z=None):
        clear = world.traffic_distance(p) >= CLEAR + 40
        row = placement(world, prop, p, yaw, collides and clear, parts, extra, z)
        rows.append(row)
        return row

    # Asphalt patches, trench repairs, sealed cracks and potholes per street segment.
    for s in world.segs:
        if s['excluded'] or not s['quad']:
            continue
        rng = Rng('soul-road', s['way'], s['i'])
        a0, a1 = s['mouth_a'] + 100, s['len'] - s['mouth_b'] - 100
        if a1 - a0 < 300:
            continue
        lo, hi = -s['curbR'] + 40, s['curbL'] - 40
        length = a1 - a0
        for _ in range(int(length / 1600 * rng.uniform(.4, 1.6))):
            x, lat = rng.uniform(a0, a1 - 200), rng.uniform(lo + 60, hi - 60)
            w, h = rng.uniform(70, 420), rng.uniform(60, 240)
            key = 'patch_dark' if rng.chance(.55) else 'patch_light'
            pts = [seg_point(s, x + dx, max(lo, min(hi, lat + dy))) for dx, dy in
                   ((0, -h / 2), (w, -h / 2 + rng.uniform(-15, 15)), (w + rng.uniform(-20, 20), h / 2), (0, h / 2))]
            S.flat(key, pts, Z_PATCH)
            counts['asphalt_patches'] += 1
        if rng.chance(.22):
            x = rng.uniform(a0, a1 - 80)
            side_lo, side_hi = (lo, 0) if rng.chance(.5) else (0, hi)
            S.flat('patch_dark', [seg_point(s, x, side_lo), seg_point(s, x + 70, side_lo),
                                  seg_point(s, x + 70, side_hi), seg_point(s, x, side_hi)], Z_PATCH + .01)
            counts['trench_patches'] += 1
        for _ in range(int(length / 900 * rng.uniform(.3, 1.4))):
            x, lat = rng.uniform(a0, a1), rng.uniform(lo, hi)
            heading = rng.uniform(0, math.tau)
            pts = [seg_point(s, x, lat)]
            for _k in range(rng.randint(4, 11)):
                heading += rng.uniform(-.7, .7)
                step = rng.uniform(25, 70)
                x += math.cos(heading) * step
                lat = max(lo, min(hi, lat + math.sin(heading) * step))
                if not a0 <= x <= a1:
                    break
                pts.append(seg_point(s, x, lat))
            for p, q in zip(pts, pts[1:]):
                S.strip('crack_seal', p, q, rng.uniform(2.5, 4.5), Z_CRACK)
            counts['crack_lines'] += len(pts) > 1
        if rng.chance(min(.6, length / 9000)):
            x = rng.uniform(a0 + 100, a1 - 100)
            side = rng.choice(('L', 'R'))
            lat = (s['curbL'] - rng.uniform(60, 260)) if side == 'L' else -(s['curbR'] - rng.uniform(60, 260))
            c = seg_point(s, x, lat)
            r = rng.uniform(22, 48)
            ring = [(c[0] + r * rng.uniform(.75, 1.2) * math.cos(i * math.tau / 10),
                     c[1] + r * rng.uniform(.75, 1.2) * math.sin(i * math.tau / 10)) for i in range(10)]
            S.flat('patch_light', [(c[0] + (p[0] - c[0]) * 1.35, c[1] + (p[1] - c[1]) * 1.35) for p in ring], Z_PATCH + .02)
            S.flat('pothole', ring, Z_CRACK + .01)
            counts['potholes'] += 1
        # Autumn leaf drifts along the curbs (gutter band).
        for side, sign in (('L', 1), ('R', -1)):
            if s['w' + side] <= 0:
                continue
            x = a0 + rng.uniform(0, 600)
            while x < a1 - 150:
                run = rng.uniform(150, 650)
                if rng.chance(.55):
                    key = rng.choice(('leaf_gold', 'leaf_rust', 'leaf_brown', 'leaf_gold'))
                    steps = max(2, int(run / 50))
                    inner, outer = [], []
                    for k in range(steps + 1):
                        xx = x + run * k / steps
                        width = math.sin(math.pi * k / steps) * rng.uniform(18, 46) + 4
                        inner.append(seg_point(s, xx, sign * (s['curb' + side] - 2)))
                        outer.append(seg_point(s, xx, sign * (s['curb' + side] - 2 - width)))
                    for p0, p1, q1, q0 in zip(inner, inner[1:], outer[1:], outer[:-1]):
                        S.flat(key, [p0, p1, q1, q0], Z_PAINT2 + .03)
                    counts['gutter_leaf_drifts'] += 1
                x += run + rng.uniform(200, 900)

    # Leaves in and around tree pits; weeds at curb joints.
    for strip in world.sidewalk_strips:
        s = strip['seg']
        for along, c, yaw in strip.get('pits', []):
            rng = Rng('pit-leaves', s['i'], round(along))
            if rng.chance(.7):
                key = rng.choice(('leaf_gold', 'leaf_rust', 'leaf_brown'))
                pts = [(c[0] + rng.uniform(30, 50) * math.cos(i * math.tau / 8 + .3),
                        c[1] + rng.uniform(30, 47) * math.sin(i * math.tau / 8 + .3)) for i in range(8)]
                S.flat(key, pts, Z_WALK + .3)
                counts['pit_leaf_covers'] += 1
            for _ in range(rng.randint(4, 14)):
                p = (c[0] + rng.uniform(-150, 150), c[1] + rng.uniform(-150, 150))
                if world.surfaces.at(p)[1] not in ('sidewalk', 'yard'):
                    continue
                _leaf(S, p, rng, Z_WALK + .35)
                counts['loose_leaves'] += 1
        (ca, cb), length = strip['curb'], strip['len']
        rng = Rng('curb-weeds', s['i'], strip['side'])
        x = rng.uniform(100, 900)
        while x < length - 100:
            p = lerp(ca, cb, x / length)
            if rng.chance(.5):
                _tuft(S, (p[0], p[1], Z_ROAD), rng, .7)
                counts['weed_tufts'] += 1
            x += rng.uniform(300, 1500)

    # Weeds at wall bases, rust streaks under stairs/balconies, murals on blank side walls.
    street_edges = _street_walls(world)
    for e in street_edges:
        a, b, bi, kind = e['a'], e['b'], e['building'], e['kind']
        rng = Rng('wall', world.buildings[bi]['id'], round(a[0]), round(a[1]))
        length = math.dist(a, b)
        u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        out = (u[1], -u[0])  # buildings are CCW, so the outward normal is to the right of a->b
        x = rng.uniform(40, 300)
        while x < length - 40:
            p = add(add(a, u, x), out, 9)
            g = world.surfaces.at(p)
            _tuft(S, (p[0], p[1], g[0]), rng, 1.)
            counts['weed_tufts'] += 1
            x += rng.uniform(150, 900)
        if kind == 'front' and length > 450 and rng.chance(.4):
            for _ in range(rng.randint(2, 4)):
                x = rng.uniform(60, length - 60)
                top = rng.uniform(330, 430)
                bottom = rng.uniform(40, 160)
                w = rng.uniform(6, 14)
                p = add(add(a, u, x), out, 6.5)
                S.face('rust', [(*add(p, u, -w / 2), top), (*add(p, u, w / 2), top),
                                (*add(p, u, w * .15), bottom), (*add(p, u, -w * .15), bottom)][::-1])
                counts['rust_streaks'] += 1
    murals = []
    side_walls = sorted((e for e in street_edges if e['kind'] == 'side' and math.dist(e['a'], e['b']) >= 900
                         and world.buildings[e['building']]['height'] >= 800),
                        key=lambda e: seed('mural', world.buildings[e['building']]['id'], round(e['a'][0])))
    for e in side_walls:
        mid = lerp(e['a'], e['b'], .5)
        if any(math.dist(mid, m) < 15000 for m in murals) or len(murals) >= 9:
            continue
        murals.append(mid)
        _mural(S, e, world.buildings[e['building']], Rng('mural-art', world.buildings[e['building']]['id']))
        counts['murals'] += 1

    # Chantier: one residential block gets a work zone in its parking lane.
    candidates = [s for s in world.segs if not s['excluded'] and s['quad'] and s['hw'] == 'residential'
                  and s['len'] - s['mouth_a'] - s['mouth_b'] > 4500 and s['name'] in
                  ('Rue Garnier', 'Rue Fabre', 'Rue de Mentana', 'Rue Saint-André', 'Rue Chambord', 'Rue Marquette')]
    if candidates:
        s = sorted(candidates, key=lambda c: seed('chantier', c['way'], c['i']))[0]
        x0 = s['mouth_a'] + (s['len'] - s['mouth_a'] - s['mouth_b']) * .35
        x1 = x0 + 1800
        side = 'R'
        inner = -(s['curbR'] - 240)
        curb = -(s['curbR'] - 10)
        S.flat('chantier_dirt', [seg_point(s, x0 + 150, curb), seg_point(s, x1 - 150, curb),
                                 seg_point(s, x1 - 150, inner + 30), seg_point(s, x0 + 150, inner + 30)], Z_PAINT2 + .05)
        plate = lerp(seg_point(s, x0 + 600, curb), seg_point(s, x0 + 900, inner), .5)
        S.box('steel_plate', (plate[0], plate[1], Z_ROAD + 1.4), (240, 150, 2.5),
              math.degrees(math.atan2(s['u'][1], s['u'][0])), bottom=False)
        yaw = math.degrees(math.atan2(s['u'][1], s['u'][0]))
        x = x0
        while x <= x1:
            put('barrier_chantier', seg_point(s, x, inner), yaw, False, ('chantier', s['i'], round(x)),
                {'zone': s['name']})
            x += 200
        for end, sign in ((x0, -1), (x1, 1)):
            put('barrier_chantier', seg_point(s, end, (inner + curb) / 2), yaw + 90, False, ('chantier-end', s['i'], end),
                {'zone': s['name']})
            for k in range(4):
                put('cone', seg_point(s, end + sign * (120 + 150 * k), inner + 40 * (k + 1)), 0, False,
                    ('cone', s['i'], end, k), {'zone': s['name']})
        counts['chantier_zones'] += 1
        counts['chantier_street'] = s['name']

    # Ruelles: wooden utility poles, sagging wires, laundry lines.
    for alley in world.alleys:
        rng = Rng('ruelle', alley['id'])
        poles = []
        for a, b in alley['segments']:
            length = math.dist(a, b)
            u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
            n = (-u[1], u[0])
            x = rng.uniform(300, 1800)
            while x < length - 200:
                side = 1 if (len(poles) % 2 == 0) else -1
                p = add(add(a, u, x), n, side * 255)
                if not world.in_building(p, 40) and not on_pavement(world, p):
                    row = put('utility_pole', p, math.degrees(math.atan2(u[1], u[0])), True, ('pole', alley['id'], round(x)),
                              {'ruelle': alley['id']})
                    poles.append((p, row['position'][2], u, n, side))
                    counts['utility_poles'] += 1
                x += rng.uniform(2600, 3600)
        info = props_info()
        for (p, z0, u, n, side), (q, z1, uq, _, _) in zip(poles, poles[1:]):
            if math.dist(p, q) > 4500:
                continue
            ya, yb = math.degrees(math.atan2(u[1], u[0])), math.degrees(math.atan2(uq[1], uq[0]))
            for k, (ax, ay, az) in enumerate(info['pole_wires']):
                a = local_to_world(p, ya, (ax, ay))
                b = local_to_world(q, yb, (ax, ay))
                _catenary(S, 'wire', (a[0], a[1], z0 + az), (b[0], b[1], z1 + az), 28 + 9 * k, 1.1)
            counts['wire_spans'] += 1
        for i, (p, z0, u, n, side) in enumerate(poles):
            if not rng.chance(.55):
                continue
            # Line from the pole to the rear gallery of the building across the ruelle.
            hit = world.building_ray(p, (-n[0] * side, -n[1] * side), 1600)
            if hit is None or hit < 400:
                continue
            wall = add(p, (-n[0] * side, -n[1] * side), hit - 30)
            drop = info['pole_drop']
            anchor = local_to_world(p, math.degrees(math.atan2(u[1], u[0])), drop[:2])
            h_wall = rng.uniform(450, 700)
            start, end = (anchor[0], anchor[1], z0 + drop[2]), (wall[0], wall[1], h_wall)
            pts = _catenary(S, 'wire', start, end, 35, .7, segments=8)
            for k in range(2, len(pts) - 2):
                if rng.chance(.75):
                    _cloth(S, pts[k], pts[k + 1], rng)
            counts['laundry_lines'] += 1

    # Curb bins, locked bikes, flower boxes and AC units hinted on lots.
    for strip in world.sidewalk_strips:
        s = strip['seg']
        (ca, cb), length = strip['curb'], strip['len']
        if length < 400:
            continue
        u = ((cb[0] - ca[0]) / length, (cb[1] - ca[1]) / length)
        inward = (strip['outer'][0][0] - ca[0], strip['outer'][0][1] - ca[1])
        il = math.hypot(*inward) or 1.
        inward = (inward[0] / il, inward[1] / il)
        yaw_street = math.degrees(math.atan2(-inward[1], -inward[0]))
        for k, lot in enumerate(strip.get('lots', [])):
            rng = Rng('lot-life', s['way'], s['i'], strip['side'], k)
            mid = lerp(lot['p0'], lot['p1'], rng.uniform(.25, .75))
            rel = (mid[0] - ca[0], mid[1] - ca[1])
            along = rel[0] * u[0] + rel[1] * u[1]
            if not 150 < along < length - 150 or any(abs(along - r) < 350 for r in strip.get('ramps', [])):
                continue
            if any(abs(along - pit[0]) < 120 for pit in strip.get('pits', [])):
                continue
            curb_pt = add(add(ca, u, along), inward, 38)
            if s['hw'] in ('residential', 'unclassified') and rng.chance(.42):
                kinds = ['bin_recycling'] + (['bin_compost'] if rng.chance(.55) else []) + \
                        (['bin_garbage'] if rng.chance(.25) else [])
                for i, kind in enumerate(kinds):
                    p = add(curb_pt, u, (i - (len(kinds) - 1) / 2) * 75)
                    put(kind, p, yaw_street + rng.uniform(-12, 12), False, ('curb-bin', s['i'], k, i))
                    counts['curb_bins'] += 1
            if lot.get('fence') and rng.chance(.09):
                contact = add(add(lot['p0'], lot['out'], 9), u, rng.uniform(80, max(90., math.dist(lot['p0'], lot['p1']) - 80)))
                out_v = lot['out']
                yaw = math.degrees(math.atan2(out_v[0], -out_v[1]))   # prop -Y (lean side) toward the fence
                cx, cy = props_info()['bike_contact']
                off = local_to_world((0., 0.), yaw, (cx, cy))
                p = (contact[0] - off[0], contact[1] - off[1])
                put('bike_locked', p, yaw, False, ('bike-fence', s['i'], k), {'locked_to': 'parterre_fence'})
                counts['locked_bikes'] += 1
            if lot.get('depth', 0) >= 80 and rng.chance(.12):
                p = add(add(lot['p0'], lot['out'], lot['depth'] - 30), u, rng.uniform(100, 300))
                put('flower_box', p, yaw_street, False, ('flower', s['i'], k))
                counts['flower_boxes'] += 1
    # Bikes locked to parking-sign posts are added by the caller from the Furniture rows.
    for k in counts:
        if isinstance(counts[k], float):
            counts[k] = round(counts[k])
    return S, rows, counts


def lock_bikes_to_signs(world, furniture_rows, soul_rows, counts):
    for row in furniture_rows:
        if row['prop'] != 'sign_parking':
            continue
        rng = Rng('bike-sign', row['variant_seed'])
        if not rng.chance(.16):
            continue
        yaw = row['yaw'] + 90
        cx, cy = props_info()['bike_contact']
        off = local_to_world((0., 0.), yaw, (cx, cy + 4))
        p = (row['position'][0] - off[0], row['position'][1] - off[1])
        soul_rows.append(placement(world, 'bike_locked', p, yaw, False, ('bike-sign', row['variant_seed']),
                                   {'locked_to': 'sign_parking'}, z=row['position'][2]))
        counts['locked_bikes'] += 1


def _leaf(S, p, rng, z):
    key = rng.choice(('leaf_gold', 'leaf_rust', 'leaf_brown'))
    a = rng.uniform(0, math.tau)
    l, w = rng.uniform(5, 9), rng.uniform(3, 6)
    c, s = math.cos(a), math.sin(a)
    S.flat(key, [(p[0] + c * l, p[1] + s * l), (p[0] - s * w, p[1] + c * w),
                 (p[0] - c * l, p[1] - s * l), (p[0] + s * w, p[1] - c * w)], z + rng.uniform(0, .05))


def _tuft(S, base, rng, scale):
    for _ in range(rng.randint(2, 4)):
        b = (base[0] + rng.uniform(-9, 9) * scale, base[1] + rng.uniform(-9, 9) * scale, base[2])
        S.cone('weed', b, rng.uniform(2.5, 5) * scale, rng.uniform(8, 26) * scale, 3, rng.uniform(0, math.tau))


def _catenary(S, key, a, b, sag, radius, segments=10):
    pts = []
    for i in range(segments + 1):
        t = i / segments
        pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                    a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)))
    for p, q in zip(pts, pts[1:]):
        S.rod(key, p, q, radius, 3)
    return pts


def _cloth(S, p, q, rng):
    key = rng.choice(('cloth_a', 'cloth_b', 'cloth_c', 'cloth_d', 'cloth_a'))
    w = math.dist(p[:2], q[:2])
    if w < 20:
        return
    h = rng.uniform(35, 75)
    a, b = lerp(p, q, .12), lerp(p, q, .88)
    front = [a, b, (b[0], b[1], b[2] - h), (a[0], a[1], a[2] - h * rng.uniform(.8, 1.))]
    S.face(key, front)
    S.face(key, front[::-1])


def _street_walls(world):
    """Building edges that face a drive street: fronts (parallel) and exposed side walls."""
    out = []
    shared = set()
    for e, (a, b, bi) in enumerate(world.building_edges):
        for f in world.edge_grid.query(bbox([a, b], 60)):
            if f == e:
                continue
            c, d, bj = world.building_edges[f]
            if bj == bi:
                continue
            if seg_dist(lerp(a, b, .5), c, d) < 60 and math.dist(a, b) > 1:
                shared.add(e)
                break
    for e, (a, b, bi) in enumerate(world.building_edges):
        if e in shared or not world.buildings[bi]['inside'] or math.dist(a, b) < 250:
            continue
        mid = lerp(a, b, .5)
        if world.route_near(mid):
            continue
        length = math.dist(a, b)
        u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        out_n = (u[1], -u[0])
        probe = add(mid, out_n, 60)
        if world.in_building(probe):
            continue
        best = nearest_seg(world, mid, 2600)
        if best is None or best[0] > 2400:
            continue
        s = best[1]
        dot = abs(u[0] * s['u'][0] + u[1] * s['u'][1])
        toward = (seg_point(s, max(0, min(s['len'], seg_local(s, mid)[0])), 0))
        facing = (toward[0] - mid[0]) * out_n[0] + (toward[1] - mid[1]) * out_n[1] > 0
        if dot > .85 and facing:
            out.append({'a': a, 'b': b, 'building': bi, 'kind': 'front'})
        elif dot < .35:
            out.append({'a': a, 'b': b, 'building': bi, 'kind': 'side'})
    return out


MURAL_PALETTES = [('mural_1', 'mural_2', 'mural_3', 'mural_5'), ('mural_4', 'mural_6', 'mural_5', 'mural_2'),
                  ('mural_3', 'mural_1', 'mural_6', 'mural_5'), ('mural_2', 'mural_4', 'mural_1', 'mural_3')]


def _mural(S, edge, building, rng):
    """An original colour-block composition: a split grid, a sun disc and a few triangles."""
    a, b = edge['a'], edge['b']
    length = math.dist(a, b)
    u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    out = (u[1], -u[0])
    x0, x1 = 60., length - 60.
    z0, z1 = 130., min(building['height'] - 90, 1050.)
    if z1 - z0 < 300:
        return
    palette = rng.choice(MURAL_PALETTES)
    off = 6.

    def P(x, z, lift=0.):
        p = add(add(a, u, x), out, off + lift)
        return (p[0], p[1], z)

    def rect(key, xa, xb, za, zb, lift=0.):
        S.face(key, [P(xb, za, lift), P(xa, za, lift), P(xa, zb, lift), P(xb, zb, lift)])

    cols = rng.randint(3, 5)
    xs = sorted([x0, x1] + [rng.uniform(x0 + 80, x1 - 80) for _ in range(cols - 1)])
    for xa, xb in zip(xs, xs[1:]):
        rows = rng.randint(1, 3)
        zs = sorted([z0, z1] + [rng.uniform(z0 + 80, z1 - 80) for _ in range(rows - 1)])
        for za, zb in zip(zs, zs[1:]):
            rect(rng.choice(palette), xa, xb, za, zb)
    cx, cz = rng.uniform(x0 + 150, x1 - 150), rng.uniform(z0 + 150, z1 - 120)
    r = min(rng.uniform(80, 200), (x1 - x0) / 3, (z1 - z0) / 3)
    ring = [P(cx + r * math.cos(-i * math.tau / 20), cz + r * math.sin(-i * math.tau / 20), .6) for i in range(20)]
    S.face(rng.choice(palette), ring)
    for _ in range(rng.randint(2, 4)):
        bx = rng.uniform(x0, x1 - 150)
        bw = rng.uniform(100, 300)
        bz = rng.uniform(z0, z0 + 200)
        S.face(rng.choice(palette), [P(min(x1, bx + bw), bz, .9), P(bx, bz, .9), P(bx + bw / 2, bz + rng.uniform(120, 300), .9)])


# ---------------------------------------------------------------------------------------------

def prepare(directory=None):
    directory = Path(directory or OUT)
    world = World()
    drive_network(world)
    measure_curbs(world)
    build_junctions(world)
    carriageway_polygons(world)
    streets, street_counts = build_streets(world)
    furniture_rows, furniture_counts = build_furniture(world)
    soul, soul_rows, soul_counts = build_soul(world)
    lock_bikes_to_signs(world, furniture_rows, soul_rows, soul_counts)
    soul_counts['placements'] = len(soul_rows)
    cameras = [
        {'name': 'ReplicaMentana', 'position': [-30500, 21800, 170], 'target': [-27000, 26500, 300]},
        {'name': 'ReplicaFabre', 'position': [-6000, 44000, 170], 'target': [-2600, 48800, 300]},
        {'name': 'ReplicaRachelPark', 'position': [-15500, 30500, 170], 'target': [-11000, 33500, 250]},
        {'name': 'ReplicaPapineau', 'position': [24500, 44000, 170], 'target': [27500, 49500, 300]},
        {'name': 'ReplicaSherbrooke', 'position': [36000, 6200, 170], 'target': [41000, 8800, 300]},
    ]
    results = {
        'Streets': write_layer(streets, directory / 'Streets', street_counts,
                               {'z_cm': {'alley': Z_ALLEY, 'asphalt': Z_ROAD, 'paint': Z_PAINT, 'sidewalk_top': Z_WALK,
                                         'dropped_curb': Z_DROP},
                                'runtime': {'asphalt_mesh_prefix': 'SM_Asphalt', 'curb_mesh_prefix': 'SM_Concrete_Collision',
                                            'curb_top_cm': Z_WALK, 'curb_min_from_traffic_centreline_cm': CURB_MIN_TRAFFIC,
                                            'traffic_clear_cm': CLEAR},
                                'cameras': cameras}),
        'Furniture': write_placements(directory / 'Furniture', 'Furniture', furniture_rows, furniture_counts),
        'Soul': write_layer(soul, directory / 'Soul', soul_counts),
    }
    write_placements(directory / 'Soul', 'Soul', soul_rows, soul_counts)
    # The Furniture layer also gets a manifest (no batches) so the apply step can treat layers uniformly.
    furn_manifest = {'layer': 'Furniture', 'generator': GENERATOR, 'frame': FRAME, 'batches': [], 'materials': {},
                     'placements': 'placements.json', 'counts': furniture_counts,
                     'source_sha256': {p: sha_file(ROOT / p) for p in SOURCES},
                     'placements_sha256': sha_file(directory / 'Furniture/placements.json'),
                     'props_manifest_sha256': sha_file(PROPS_MANIFEST) if PROPS_MANIFEST.is_file() else None}
    (directory / 'Furniture/manifest.json').write_text(json.dumps(furn_manifest, ensure_ascii=False, indent=1) + '\n')
    soul_manifest = json.loads((directory / 'Soul/manifest.json').read_text())
    soul_manifest['placements'] = 'placements.json'
    soul_manifest['placements_sha256'] = sha_file(directory / 'Soul/placements.json')
    (directory / 'Soul/manifest.json').write_text(json.dumps(soul_manifest, ensure_ascii=False, indent=1) + '\n')
    world.results = results
    return world, results


def summary(results):
    out = {}
    for name in ('Streets', 'Soul'):
        m = results[name]
        out[name] = {'batches': len(m['batches']), 'triangles': m['counts']['triangles'],
                     'max_batch_triangles': max(b['triangles'] for b in m['batches'])}
    out['Furniture'] = {'placements': len(results['Furniture']['placements'])}
    return out


if __name__ == '__main__':
    world, results = prepare()
    print(json.dumps(summary(results), indent=1))
    print(json.dumps(results['Streets']['counts'], indent=1, ensure_ascii=False))
    print(json.dumps(results['Furniture']['counts'], indent=1, ensure_ascii=False))
    print(json.dumps(json.loads((OUT / 'Soul/manifest.json').read_text())['counts'], indent=1, ensure_ascii=False))
