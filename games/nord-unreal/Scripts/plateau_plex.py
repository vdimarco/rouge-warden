"""Plateau plex fronts on the plain OSM footprints: layer ReplicaGeometry/Plex.

Stdlib only, deterministic. Every plain building (not one of the 100 route fronts, the
154 park-facing perimeter fronts, the tower or the school) gets a street-level Plateau
front: brick in the local palette, raised ground floor over a stone base with basement
vents, tall windows with stone sills and lintels, paired doors with transoms, wooden
balconies on each upper floor, curved or straight black iron stairs to the 2nd floor,
painted cornices with brackets, fausse-mansarde slate fronts and raised brick parapets
by construction era, and dépanneur ground floors at corners. The fronts are visual skins
4-16 cm in front of the existing collision masses; stair treads, stoops and balcony
decks form separate complex-collision batches.

Rules follow research-plateau.md §3-§6 and §9 (Plateau heritage sheets, Dec 2015) and the
CGA split idea of Müller et al. 2006 (mass -> facade -> floors -> bays). Storeys come from
OSM building:levels, then the municipal assessment roll joined by address, then the 2016
LOD2 height, then 3. Frame: x east, y north, cm, z up (the existing, mirrored, map frame).

    python3 Scripts/plateau_plex.py                 # write Data/Plateau/ReplicaGeometry/Plex
    python3 Scripts/plateau_plex.py --join-roll F   # rebuild assessment_roll_join.json from a
                                                    # CKAN datastore dump of the roll (JSON list)
"""
import hashlib
import json
import math
import random
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

from plateau_facades import _inside, _nearest, _outward_clearance, _wall_rectangles
from plateau_ground import triangulate
from prepare_lafontaine import xy, tags as osm_tags
from prepare_plateau import geography
import plateau_school
import plateau_tower

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/Plateau/ReplicaGeometry/Plex'
ROLL_JOIN = OUT / 'assessment_roll_join.json'
GENERATOR = 'Scripts/plateau_plex.py'
LAYER = 'Plex'

TILE_CM = 4750            # base grid; widened in whole multiples only when the batch cap needs it
MAX_BATCHES = 860
MAX_BATCH_TRIANGLES = 60000
TRIANGLE_BUDGET = 2500000

D_BACK = 4.0              # glass, door leaves and recess backs: 1 cm ahead of the 3 cm OSM glass cards
REVEAL = 12.0
D_FACE = D_BACK + REVEAL  # main masonry plane

DRIVE = ('residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street')
ARTERIAL_NAMES = ('Rue Rachel Est', 'Avenue Papineau', 'Rue Sherbrooke Est', 'Avenue Duluth Est',
                  'Rue Saint-Hubert', 'Avenue du Mont-Royal Est', 'Rue Saint-Denis', 'Rue Cherrier',
                  'Avenue De Lorimier', 'Rue Gauthier', 'Avenue Laurier Est')
SKIP_BUILDING = ('pavilion', 'shed', 'roof', 'garages', 'garage', 'construction', 'school',
                 'government', 'church', 'chapel', 'hospital', 'service', 'kiosk', 'hut', 'carport')
SHOP_AMENITY = ('restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'pharmacy', 'bank', 'ice_cream',
                'clinic', 'dentist', 'doctors', 'bicycle_rental_shop')

# research-plateau.md §9 palette (sRGB); roughness/metallic are art-direction values.
MATERIALS = {
    'Brick_Red':       {'base_color_srgb': '#953F2F', 'roughness': .86, 'metallic': 0, 'texture': '/Game/Art/Textures/brick_wall_001_diff'},
    'Brick_RedDark':   {'base_color_srgb': '#7A3226', 'roughness': .88, 'metallic': 0, 'texture': '/Game/Art/Textures/brick_wall_001_diff'},
    'Brick_Orange':    {'base_color_srgb': '#AE5E3B', 'roughness': .86, 'metallic': 0, 'texture': '/Game/Art/Textures/brick_wall_001_diff'},
    'Brick_Brown':     {'base_color_srgb': '#6B4232', 'roughness': .88, 'metallic': 0, 'texture': '/Game/Art/Textures/brick_wall_001_diff'},
    'Brick_BrownDark': {'base_color_srgb': '#553428', 'roughness': .9, 'metallic': 0, 'texture': '/Game/Art/Textures/brick_wall_001_diff'},
    'Brick_Buff':      {'base_color_srgb': '#CCB07F', 'roughness': .84, 'metallic': 0, 'texture': '/Game/Art/Textures/brick_wall_001_diff'},
    'Stone':           {'base_color_srgb': '#8F8C85', 'roughness': .82, 'metallic': 0, 'texture': '/Game/Art/Textures/concrete_pavement_diff'},
    'Stone_Cast':      {'base_color_srgb': '#BDB5A3', 'roughness': .8, 'metallic': 0},
    'Trim':            {'base_color_srgb': '#E8E6DF', 'roughness': .55, 'metallic': 0},
    'Iron':            {'base_color_srgb': '#1C1C1C', 'roughness': .45, 'metallic': .35},
    'Wood_Green':      {'base_color_srgb': '#2F4A3A', 'roughness': .6, 'metallic': 0},
    'Wood_Burgundy':   {'base_color_srgb': '#5E2328', 'roughness': .6, 'metallic': 0},
    'Wood_Grey':       {'base_color_srgb': '#6F7275', 'roughness': .6, 'metallic': 0},
    'Wood_Cream':      {'base_color_srgb': '#D8CDB0', 'roughness': .6, 'metallic': 0},
    'Wood_Oak':        {'base_color_srgb': '#7A5230', 'roughness': .5, 'metallic': 0},
    'Wood_Deck':       {'base_color_srgb': '#7F817C', 'roughness': .75, 'metallic': 0},
    'Glass':           {'base_color_srgb': '#1D2329', 'roughness': .08, 'metallic': .1},
    'Slate':           {'base_color_srgb': '#2F3236', 'roughness': .5, 'metallic': 0},
}
COLLISION = {'Wood_Deck': 'complex'}       # complex-as-simple per batch, like the existing *_Collision batches
BRICKS = ('Brick_Red', 'Brick_RedDark', 'Brick_Orange', 'Brick_Brown', 'Brick_BrownDark', 'Brick_Buff')
PAINT = ('Iron', 'Wood_Green', 'Wood_Burgundy', 'Wood_Grey', 'Wood_Cream')
DOORS = ('Wood_Green', 'Wood_Burgundy', 'Iron', 'Wood_Green', 'Wood_Oak', 'Wood_Oak', 'Wood_Grey')
FRAMES = ('Trim', 'Trim', 'Trim', 'Iron', 'Wood_Green', 'Wood_Oak')
# Decade histogram of the matched roll (research §4) for lots without a roll year.
ERA_WEIGHTS = ((1885, 487), (1895, 46), (1905, 653), (1913, 421), (1925, 182), (1935, 48), (1950, 69), (1970, 130))


def _seed(*parts):
    return int(hashlib.sha256('/'.join(str(p) for p in parts).encode()).hexdigest()[:16], 16)


def _area(points):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) / 2


# ---------------------------------------------------------------------------------- mesh
class PlexMesh:
    """Faces grouped by material key, oriented by an explicit outward direction."""

    def __init__(self):
        self.groups = {}
        self.count = 0

    def face(self, material, points, out):
        assert material in MATERIALS, material
        points = [tuple(float(v) for v in p) for p in points]
        assert len(points) >= 3 and all(math.isfinite(v) for p in points for v in p), points
        nx = ny = nz = 0.
        for (x0, y0, z0), (x1, y1, z1) in zip(points, points[1:] + points[:1]):
            nx += (y0 - y1) * (z0 + z1)
            ny += (z0 - z1) * (x0 + x1)
            nz += (x0 - x1) * (y0 + y1)
        if nx * out[0] + ny * out[1] + nz * out[2] < 0:
            points.reverse()
        if nx * nx + ny * ny + nz * nz < 1e-6:
            return
        self.groups.setdefault(material, []).append(points)
        self.count += len(points) - 2

    def triangles(self):
        return self.count


def write_obj(path, name, faces):
    Path(path).write_text(obj_text(name, faces))


def obj_text(name, faces):
    """plateau_mesh.Mesh.write conventions (v x -y z, reversed fans), UVs in metres."""
    lines = ['o ' + name]
    index = 1
    for poly in faces:
        a, b = poly[0], poly[1]
        d = [b[i] - a[i] for i in range(3)]
        length = math.sqrt(sum(v * v for v in d)) or 1
        d = [v / length for v in d]
        horizontal = max(p[2] for p in poly) - min(p[2] for p in poly) < .1
        for x, y, z in poly:
            lines.append(f'v {x:.3f} {-y:.3f} {z:.3f}')
        for p in poly:
            uv = (p[0] / 100, p[1] / 100) if horizontal else (sum(p[i] * d[i] for i in range(3)) / 100, p[2] / 100)
            lines.append(f'vt {uv[0]:.4f} {uv[1]:.4f}')
        for i in range(1, len(poly) - 1):
            lines.append(f'f {index + i + 1}/{index + i + 1} {index + i}/{index + i} {index}/{index}')
        index += len(poly)
    return '\n'.join(lines) + '\n'


class Frame:
    """Local front frame: x along the wall from a to b, d outward, z up."""

    def __init__(self, mesh, a, b):
        self.mesh = mesh
        self.a = a
        length = math.dist(a, b)
        self.u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        self.n = (self.u[1], -self.u[0])
        self.U = (self.u[0], self.u[1], 0.)
        self.N = (self.n[0], self.n[1], 0.)

    def p(self, x, d, z):
        return (self.a[0] + self.u[0] * x + self.n[0] * d, self.a[1] + self.u[1] * x + self.n[1] * d, z)

    def out(self, ox, od, oz):
        return (self.u[0] * ox + self.n[0] * od, self.u[1] * ox + self.n[1] * od, oz)

    def quad_d(self, mat, x0, x1, z0, z1, d, facing=1):
        """A rectangle in the plane d = const, facing outward (+1) or inward (-1)."""
        if x1 - x0 < .05 or z1 - z0 < .05:
            return
        p = self.p
        self.mesh.face(mat, [p(x0, d, z0), p(x1, d, z0), p(x1, d, z1), p(x0, d, z1)], self.out(0, facing, 0))

    def quad_x(self, mat, x, d0, d1, z0, z1, facing):
        if d1 - d0 < .05 or z1 - z0 < .05:
            return
        p = self.p
        self.mesh.face(mat, [p(x, d0, z0), p(x, d1, z0), p(x, d1, z1), p(x, d0, z1)], self.out(facing, 0, 0))

    def quad_z(self, mat, x0, x1, d0, d1, z, facing):
        if x1 - x0 < .05 or d1 - d0 < .05:
            return
        p = self.p
        self.mesh.face(mat, [p(x0, d0, z), p(x1, d0, z), p(x1, d1, z), p(x0, d1, z)], (0, 0, facing))

    def box(self, mat, x0, x1, d0, d1, z0, z1, skip=''):
        """Axis-aligned box in the frame; skip letters: f(ront) k(back) t(op) b(ottom) l r."""
        if 'f' not in skip: self.quad_d(mat, x0, x1, z0, z1, d1, 1)
        if 'k' not in skip: self.quad_d(mat, x0, x1, z0, z1, d0, -1)
        if 't' not in skip: self.quad_z(mat, x0, x1, d0, d1, z1, 1)
        if 'b' not in skip: self.quad_z(mat, x0, x1, d0, d1, z0, -1)
        if 'l' not in skip: self.quad_x(mat, x0, d0, d1, z0, z1, -1)
        if 'r' not in skip: self.quad_x(mat, x1, d0, d1, z0, z1, 1)


def beam(mesh, mat, a, b, w, h, ends=False, bottom=True):
    """Rectangular bar from a to b (world points on its centreline)."""
    t = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    horizontal = math.hypot(t[0], t[1])
    if horizontal < 1e-6:
        s = (1., 0., 0.)
    else:
        s = (-t[1] / horizontal, t[0] / horizontal, 0.)
    hw, hh = w / 2, h / 2
    def c(p, i, j):
        return (p[0] + s[0] * i * hw, p[1] + s[1] * i * hw, p[2] + j * hh)
    if horizontal < 1e-6:          # vertical post: offset the second axis horizontally instead of in z
        s2 = (0., 1., 0.)
        def c(p, i, j):
            return (p[0] + s[0] * i * hw + s2[0] * j * hh, p[1] + s2[1] * j * hh, p[2])
        mesh.face(mat, [c(a, -1, 1), c(a, 1, 1), c(b, 1, 1), c(b, -1, 1)], (0, 1, 0))
        mesh.face(mat, [c(a, -1, -1), c(a, 1, -1), c(b, 1, -1), c(b, -1, -1)], (0, -1, 0))
        mesh.face(mat, [c(a, 1, -1), c(a, 1, 1), c(b, 1, 1), c(b, 1, -1)], (1, 0, 0))
        mesh.face(mat, [c(a, -1, -1), c(a, -1, 1), c(b, -1, 1), c(b, -1, -1)], (-1, 0, 0))
        top = b if b[2] > a[2] else a
        mesh.face(mat, [c(top, -1, -1), c(top, 1, -1), c(top, 1, 1), c(top, -1, 1)], (0, 0, 1))
        return
    mesh.face(mat, [c(a, -1, 1), c(a, 1, 1), c(b, 1, 1), c(b, -1, 1)], (0, 0, 1))
    if bottom:
        mesh.face(mat, [c(a, -1, -1), c(a, 1, -1), c(b, 1, -1), c(b, -1, -1)], (0, 0, -1))
    mesh.face(mat, [c(a, 1, -1), c(a, 1, 1), c(b, 1, 1), c(b, 1, -1)], s)
    mesh.face(mat, [c(a, -1, -1), c(a, -1, 1), c(b, -1, 1), c(b, -1, -1)], (-s[0], -s[1], 0))
    if ends:
        mesh.face(mat, [c(a, -1, -1), c(a, 1, -1), c(a, 1, 1), c(a, -1, 1)], (-t[0], -t[1], -t[2]))
        mesh.face(mat, [c(b, -1, -1), c(b, 1, -1), c(b, 1, 1), c(b, -1, 1)], t)


def card(mesh, mat, base, top, side, half):
    """A two-sided vertical bar card between base and top points, `side` is its facing."""
    off = (-side[1] * half, side[0] * half)
    pts = [(base[0] - off[0], base[1] - off[1], base[2]), (base[0] + off[0], base[1] + off[1], base[2]),
           (top[0] + off[0], top[1] + off[1], top[2]), (top[0] - off[0], top[1] - off[1], top[2])]
    mesh.face(mat, pts, (side[0], side[1], 0))
    mesh.face(mat, pts, (-side[0], -side[1], 0))


# ------------------------------------------------------------------------------ geography
class Grid:
    def __init__(self, size=4000):
        self.size, self.cells = size, {}

    def add(self, item, xs, ys):
        for i in range(math.floor(min(xs) / self.size), math.floor(max(xs) / self.size) + 1):
            for j in range(math.floor(min(ys) / self.size), math.floor(max(ys) / self.size) + 1):
                self.cells.setdefault((i, j), []).append(item)

    def near(self, x, y, radius):
        seen, found = set(), []
        for i in range(math.floor((x - radius) / self.size), math.floor((x + radius) / self.size) + 1):
            for j in range(math.floor((y - radius) / self.size), math.floor((y + radius) / self.size) + 1):
                for item in self.cells.get((i, j), ()):
                    if id(item) not in seen:
                        seen.add(id(item))
                        found.append(item)
        return found


def _norm_street(name):
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    name = re.sub(r'\(.*?\)', ' ', name)
    name = re.sub(r'\b(rue|avenue|av|boulevard|boul|place|ruelle|de|du|des|la|le|l|d|est|ouest)\b', ' ', name)
    return re.sub(r'[^a-z0-9]+', ' ', name).strip()


def osm_points():
    """Address and shop/amenity nodes from the checked-in snapshot."""
    root = ET.parse(ROOT / 'Data/LaFontaine/osm.xml').getroot()
    addresses, shops = [], []
    for node in root.findall('node'):
        t = osm_tags(node)
        if not t:
            continue
        point = xy(float(node.get('lat')), float(node.get('lon')))
        if 'addr:housenumber' in t and 'addr:street' in t:
            addresses.append((point, t['addr:housenumber'], t['addr:street']))
        if 'shop' in t or t.get('amenity') in SHOP_AMENITY:
            shops.append((point, t.get('shop') or t.get('amenity'), t.get('name', '')))
    return addresses, shops


def join_roll(dump_path, buildings=None):
    """Join the assessment roll (CKAN dump, list of rows) to OSM buildings by address."""
    buildings = buildings or geography()[0]
    rows = json.loads(Path(dump_path).read_text())
    index = {}
    for row in rows:
        try:
            first = int(row['CIVIQUE_DEBUT'])
            last = int(row.get('CIVIQUE_FIN') or first)
        except (TypeError, ValueError):
            continue
        index.setdefault(_norm_street(row['NOM_RUE']), []).append((first, last, row))
    addresses, _ = osm_points()
    grid = Grid(3000)
    for record in addresses:
        grid.add(record, [record[0][0]], [record[0][1]])
    result = {}
    for building in buildings:
        t, points = building['tags'], building['points']
        found = [(t['addr:housenumber'], t['addr:street'])] if 'addr:housenumber' in t and 'addr:street' in t else []
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points)
        radius = max(math.dist((cx, cy), p) for p in points)
        found += [(n, s) for point, n, s in grid.near(cx, cy, radius) if _inside(point, points)]
        units = {}
        for number_text, street in found:
            for number in (int(v) for v in re.findall(r'\d+', number_text)):
                for first, last, row in index.get(_norm_street(street), ()):
                    if first <= number <= last + 1:
                        units[row['ID_UEV']] = row
        if not units:
            continue
        years = [int(r['ANNEE_CONSTRUCTION']) for r in units.values()
                 if (r.get('ANNEE_CONSTRUCTION') or '').isdigit() and 1700 < int(r['ANNEE_CONSTRUCTION']) < 2030]
        storeys = [int(r['ETAGE_HORS_SOL']) for r in units.values() if (r.get('ETAGE_HORS_SOL') or '').isdigit()]
        dwellings = [int(r['NOMBRE_LOGEMENT']) for r in units.values() if (r.get('NOMBRE_LOGEMENT') or '').isdigit()]
        result[str(building['id'])] = [min(years) if years else None, max(storeys) if storeys else None,
                                       sum(dwellings) if dwellings else None, len(units)]
    return {'source': 'Ville de Montréal, données ouvertes, Unités d\'évaluation foncière (CC BY 4.0), '
                      'resource 2b9dfc3d; joined to OpenStreetMap addr:* (ODbL 1.0)',
            'fields': ['year_built', 'storeys_above_ground', 'dwellings', 'units'],
            'buildings': dict(sorted(result.items()))}


def lod2_heights(buildings):
    """Municipal LOD2 2016 height per OSM id where footprints overlap with IoU >= 0.5."""
    manifest = json.loads((ROOT / 'Data/CityBuildings/manifest.json').read_text())
    grid = Grid(4000)
    polygons = []
    for record in manifest['buildings']:
        for ring in record['footprints']:
            ring = [tuple(p[:2]) for p in ring]
            if len(ring) > 3 and ring[0] == ring[-1]:
                ring = ring[:-1]
            if len(ring) >= 3 and abs(_area(ring)) > 1e3:
                item = (ring, record['height_cm'], record['id'], abs(_area(ring)))
                polygons.append(item)
                grid.add(item, [p[0] for p in ring], [p[1] for p in ring])
    heights = {}
    for building in buildings:
        points = building['points']
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        area = abs(_area(points))
        samples = [(min(xs) + (max(xs) - min(xs)) * (i + .5) / 9, min(ys) + (max(ys) - min(ys)) * (j + .5) / 9)
                   for i in range(9) for j in range(9)]
        samples = [s for s in samples if _inside(s, points)]
        if not samples:
            continue
        best = None
        for ring, height, city_id, ring_area in grid.near((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                                                           max(max(xs) - min(xs), max(ys) - min(ys))):
            covered = sum(_inside(s, ring) for s in samples) / len(samples)
            intersection = covered * area
            iou = intersection / max(1., area + ring_area - intersection)
            if iou >= .5 and (best is None or iou > best[0]):
                best = (iou, height, city_id)
        if best:
            heights[str(building['id'])] = {'height_cm': round(best[1], 1), 'city_id': best[2], 'iou': round(best[0], 3)}
    return heights


def excluded_ids():
    layout = json.loads((ROOT / 'Data/Plateau/layout.json').read_text())
    perimeter = json.loads((ROOT / 'Data/Plateau/PerimeterGeometry/perimeter.json').read_text())
    ids = {f['id'] for f in layout['facades']['fronts']} | {f['id'] for f in perimeter['fronts']}
    return ids | {plateau_tower.OSM_ID, plateau_school.OSM_ID}


def _drive_segments(roads):
    segments, sidewalks = [], []
    for road in roads:
        t = road.get('tags', {})
        for a, b in zip(road['points'], road['points'][1:]):
            length = math.dist(a, b)
            if length < 1:
                continue
            record = (a, b, road, ((b[0] - a[0]) / length, (b[1] - a[1]) / length))
            if t.get('highway') in DRIVE:
                segments.append(record)
            elif t.get('highway') == 'service':
                segments.append(record)
            elif t.get('footway') == 'sidewalk':
                sidewalks.append(record)
    return segments, sidewalks


def _street_runs(points, shared):
    """Consecutive exposed edges merged into straight runs (chord deviation <= 30 cm)."""
    n = len(points)
    edges = [(points[i], points[(i + 1) % n]) for i in range(n)]
    exposed = [tuple(sorted(edge)) not in shared and math.dist(*edge) > 1 for edge in edges]
    runs = []
    def turn(k):
        a = math.atan2(edges[k][1][1] - edges[k][0][1], edges[k][1][0] - edges[k][0][0])
        b = math.atan2(edges[k - 1][1][1] - edges[k - 1][0][1], edges[k - 1][1][0] - edges[k - 1][0][0])
        return abs((a - b + math.pi) % math.tau - math.pi)
    if all(exposed):
        start = max(range(n), key=lambda k: (turn(k), -k))
    else:
        start = next(k for k in range(n) if not exposed[k])
    order = [(start + k) % n for k in range(n)]
    current = []
    def flush():
        if current:
            runs.append([edges[k][0] for k in current] + [edges[current[-1]][1]])
    for k in order:
        if not exposed[k]:
            flush(); current = []
            continue
        if current:
            chain = [edges[c][0] for c in current] + [edges[k][0], edges[k][1]]
            a, b = chain[0], chain[-1]
            length = math.dist(a, b)
            ok = length > 1 and all(abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / length <= 30
                                    for p in chain[1:-1])
            if not ok:
                flush(); current = []
        current.append(k)
    flush()
    return runs


def select_fronts(buildings, roads, skip_ids, roll=None, lod2=None, shops=()):
    """Street fronts of the plain buildings, with lot attributes chosen by rule and seed."""
    roll = roll or {}
    lod2 = lod2 or {}
    segments, sidewalks = _drive_segments(roads)
    road_grid, walk_grid, building_grid, shop_grid = Grid(), Grid(), Grid(), Grid(3000)
    for record in segments:
        road_grid.add(record, [record[0][0], record[1][0]], [record[0][1], record[1][1]])
    for record in sidewalks:
        walk_grid.add(record, [record[0][0], record[1][0]], [record[0][1], record[1][1]])
    local = []
    shared = {}
    for building in buildings:
        points = [tuple(p[:2]) for p in building['points']]
        if _area(points) < 0:
            points.reverse()
        local.append((building, points))
        building_grid.add((building, points), [p[0] for p in points], [p[1] for p in points])
        for a, b in zip(points, points[1:] + points[:1]):
            key = tuple(sorted((a, b)))
            shared[key] = shared.get(key, 0) + 1
    shared = {key for key, count in shared.items() if count > 1}
    for record in shops:
        shop_grid.add(record, [record[0][0]], [record[0][1]])
    skipped = {}
    lots = []
    for building, points in local:
        bid = str(building['id'])
        if bid in skip_ids:
            continue
        t = building.get('tags', {})
        reason = None
        if t.get('building') in SKIP_BUILDING or t.get('amenity') in ('place_of_worship', 'school') or 'religion' in t:
            reason = 'institutional or outbuilding'
        elif building['height'] > 2400:
            reason = 'tower over 24 m'
        elif abs(_area(points)) < 2.5e5:
            reason = 'footprint under 25 m2'
        if reason:
            skipped[bid] = reason
            continue
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points)
        neighbours = [other for other in building_grid.near(cx, cy, 4500) if other[0] is not building]
        fronts = []
        for run in _street_runs(points, shared):
            a, b = run[0], run[-1]
            width = math.dist(a, b)
            if width < 300:
                continue
            u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
            normal = (u[1], -u[0])
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            samples = [(a[0] + (b[0] - a[0]) * f + normal[0] * 25, a[1] + (b[1] - a[1]) * f + normal[1] * 25)
                       for f in (.2, .5, .8)]
            if sum(any(_inside(s, other[1]) for other in neighbours) for s in samples) >= 2:
                continue
            adjacent = []
            for c, d, road, direction in road_grid.near(mid[0], mid[1], 3300):
                distance, q = _nearest(mid, c, d)
                facing = (q[0] - mid[0]) * normal[0] + (q[1] - mid[1]) * normal[1]
                if facing > distance * .75 and abs(u[0] * direction[0] + u[1] * direction[1]) > .8 and distance < 3200:
                    adjacent.append((distance, road))
            if not adjacent:
                continue
            road_distance, road = min(adjacent, key=lambda item: item[0])
            if road.get('tags', {}).get('highway') == 'service' or not road.get('name'):
                continue
            clearance = _outward_clearance(mid, normal, [points] + [other[1] for other in neighbours])
            # Measured front yard: facade to the parallel OSM sidewalk centreline, minus half a sidewalk.
            walk = []
            for c, d, way, direction in walk_grid.near(mid[0], mid[1], road_distance + 200):
                distance, q = _nearest(mid, c, d)
                facing = (q[0] - mid[0]) * normal[0] + (q[1] - mid[1]) * normal[1]
                if facing > distance * .8 and abs(u[0] * direction[0] + u[1] * direction[1]) > .85 and distance < road_distance:
                    walk.append(facing)
            if walk:
                yard, yard_source = min(walk) - 100, 'OSM sidewalk centreline - 1.0 m'
            else:
                yard, yard_source = road_distance - road['width'] / 2 - 230, 'road width estimate'
            yard = max(0., min(yard, clearance - 40, 900.))
            fronts.append({'a': a, 'b': b, 'width': width, 'normal': normal, 'street': road['name'],
                           'highway': road['tags'].get('highway'), 'road_distance': road_distance,
                           'yard': round(yard, 1), 'yard_source': yard_source, 'run_vertices': len(run)})
        if not fronts:
            skipped[bid] = 'no exposed edge facing a named street'
            continue
        street = t.get('addr:street')
        fronts.sort(key=lambda f: (f['street'] != street, f['road_distance'] + max(0, 460 - f['width']) * 3, -f['width']))
        primary = fronts[0]
        sides = [f for f in fronts[1:] if f['street'] != primary['street'] and f['width'] >= 300]
        lot = _lot(building, points, primary, sides[:1], roll.get(bid), lod2.get(bid),
                   [s for s in shop_grid.near(cx, cy, 2500) if _inside(s[0], points)
                    or _nearest(s[0], primary['a'], primary['b'])[0] < 150])
        # Rear of the lot (yard, ruelle and exposed side walls), kept out of _lot so the front draws are unchanged.
        obstacles = [points] + [other[1] for other in building_grid.near(cx, cy, 6000) if other[0] is not building]
        roads_near = [(c, d, road.get('tags', {}).get('service') == 'alley',
                       road.get('tags', {}).get('highway') in DRIVE and bool(road.get('name')))
                      for c, d, road, _ in road_grid.near(cx, cy, 6000)]
        lot['backs'] = _back_walls(points, [primary] + sides[:1], obstacles, shared, roads_near, primary['normal'])
        lot['obstacles'], lot['roads_near'] = obstacles, roads_near
        lots.append(lot)
    lots.sort(key=lambda lot: lot['id'])
    return lots, skipped


def _era(rng, year):
    if year is None:
        total = sum(w for _, w in ERA_WEIGHTS)
        pick = rng.random() * total
        for value, weight in ERA_WEIGHTS:
            pick -= weight
            if pick <= 0:
                return value, 'seeded from roll decade histogram'
        return ERA_WEIGHTS[-1][0], 'seeded from roll decade histogram'
    return year, 'assessment roll'


def _lot(building, points, primary, sides, roll, lod2, shops):
    bid = str(building['id'])
    t = building.get('tags', {})
    rng = random.Random(_seed('plex', bid))
    levels = t.get('building:levels', '')
    storeys, source = None, None
    try:
        value = int(float(re.findall(r'[\d.]+', levels)[0])) if re.findall(r'[\d.]+', levels) else None
    except ValueError:
        value = None
    if value and 1 <= value <= 8:
        storeys, source = value, 'OSM building:levels'
    elif roll and roll[1] and 2 <= roll[1] <= 6:
        storeys, source = roll[1], 'assessment roll'
    elif lod2:
        storeys, source = max(1, min(8, round((lod2['height_cm'] - 490) / 326))), 'municipal LOD2 (h - 4.9 m) / 3.26 m'
    else:
        storeys, source = 3, 'default 3 storeys'
    year, era_source = _era(rng, roll[0] if roll else None)
    dwellings = (roll[2] if roll and roll[2] else None)
    width = primary['width']
    apartments = t.get('building') == 'apartments' and (storeys >= 4 or width > 1300)
    if storeys >= 4 or apartments or (dwellings and dwellings >= 8 and width > 1200):
        kind = 'conciergerie'
    elif storeys == 1:
        kind = 'single'
    elif storeys == 2:
        kind = 'duplex'
    else:
        kind = 'triplex'
    arterial = primary['highway'] in ('primary', 'secondary', 'tertiary') or primary['street'] in ARTERIAL_NAMES
    corner = bool(sides)
    side_arterial = any(s['highway'] in ('primary', 'secondary', 'tertiary') or s['street'] in ARTERIAL_NAMES for s in sides)
    commercial = bool(shops) or (corner and (arterial or side_arterial) and rng.random() < .7) or (corner and rng.random() < .12)
    commercial = commercial and storeys >= 2 and kind != 'conciergerie' and width >= 450
    if year < 1890:
        crown = 'cornice_wood'
    elif year < 1906:
        crown = 'mansard' if rng.random() < .35 and storeys >= 2 else 'cornice_metal'
    elif year < 1916:
        crown = 'cornice_metal' if rng.random() < .7 else 'parapet'
    elif year < 1940:
        crown = 'parapet'
    else:
        crown = 'flat'
    if kind == 'conciergerie' and crown == 'mansard':
        crown = 'cornice_metal'
    # research §9 masonry mix by era
    roll_pick = rng.random()
    # Red clay dominates only the 1880s; pressed brick (1890s on) adds brown, buff and beige, and greystone
    # fronts are common on the plex streets. The previews read too red with the plain §9 split, so brown,
    # buff and stone take a few points from red within each era.
    if year < 1890:
        masonry = 'Stone' if roll_pick < .15 else rng.choice(('Brick_Red', 'Brick_RedDark', 'Brick_Brown', 'Brick_Orange'))
    elif year < 1916:
        masonry = ('Stone' if roll_pick < .32 else 'Brick_Red' if roll_pick < .52 else 'Brick_RedDark' if roll_pick < .58
                   else 'Brick_Brown' if roll_pick < .74 else 'Brick_BrownDark' if roll_pick < .8
                   else 'Brick_Buff' if roll_pick < .95 else 'Brick_Orange')
    elif year < 1940:
        masonry = ('Brick_Brown' if roll_pick < .3 else 'Brick_BrownDark' if roll_pick < .45 else 'Brick_Red' if roll_pick < .63
                   else 'Brick_Buff' if roll_pick < .88 else 'Brick_Orange')
    else:
        masonry = rng.choice(('Brick_Buff', 'Brick_Brown', 'Brick_Red', 'Brick_BrownDark'))
    if primary['street'] in ('Avenue du Parc-La Fontaine', 'Rue Sherbrooke Est') and rng.random() < .25:
        masonry = 'Stone'
    yard = primary['yard']
    stair = None
    # research §3/§6: exterior stairs belong to most 1890-1930 plexes; 1880s row houses more often have
    # balconies over grouped entrances; 1940s+ long exterior stairs were prohibited. 8% keep an interior stair.
    stair_odds = .92 if 1885 <= year < 1945 else .5 if 1880 <= year < 1885 else .25 if 1870 <= year < 1880 else 0
    if kind in ('duplex', 'triplex') and not commercial and yard >= 105 and width >= 480 and rng.random() < stair_odds:
        stair = 'curved' if yard < 300 else 'straight'
    floor_height = rng.choice((320, 325, 330))
    if commercial:
        raise_cm = 15
    elif yard < 70:
        raise_cm = 30
    elif yard < 200:
        raise_cm = max(30, min(90, 19 * math.floor((yard - 5 - 60) / 26)))
    else:
        raise_cm = rng.choice((75, 85, 90, 95, 105))
    # The retained mass sets the roofline the player already sees; when the data storeys leave
    # more than 1.5 m of it above the crown, add a storey rather than a blank false front.
    crown_h = {'cornice_wood': 36, 'cornice_metal': 36, 'parapet': 87, 'flat': 52, 'mansard': 32}[crown]
    expected = raise_cm + (floor_height + 40 if commercial else floor_height) + floor_height * (storeys - 1) + crown_h
    if building['height'] + 15 - expected > 150 and storeys < 8:
        storeys += 1
        source += ' +1 storey to cover the retained mass'
        if kind == 'duplex':
            kind = 'triplex'
        elif kind == 'single':
            kind = 'duplex'
    balconies = kind != 'single' and not (kind == 'conciergerie' and rng.random() < .4)
    columns = balconies and 1912 <= year < 1940 and rng.random() < .55 and yard >= 120
    return {
        'id': bid, 'points': points, 'height_cm': building['height'], 'storeys': storeys, 'storeys_source': source,
        'year': year, 'era_source': era_source, 'dwellings': dwellings, 'kind': kind, 'crown': crown,
        'masonry': masonry, 'paint': rng.choice(PAINT), 'door': rng.choice(DOORS), 'frame': rng.choice(FRAMES),
        'sash': 'double_hung' if rng.random() < .65 else 'casement_transom', 'stair': stair,
        'stair_left': rng.random() < .5, 'floor_height': floor_height, 'raise': raise_cm,
        'balconies': balconies, 'columns': columns, 'commercial': commercial,
        'shops': [s[1] for s in shops], 'corner': corner, 'arterial': arterial,
        'primary': primary, 'sides': sides, 'seed': rng.getrandbits(32),
        'bands': masonry != 'Stone' and 1890 <= year < 1916 and rng.random() < .35,
        'curtains': rng.random(), 'lod2': lod2, 'roll': roll,
    }


# -------------------------------------------------------------------------------- authoring
class Kit:
    def __init__(self, mesh, lot):
        self.mesh, self.lot = mesh, lot
        self.rng = random.Random(lot['seed'])
        self.counts = {}

    def count(self, key, n=1):
        self.counts[key] = self.counts.get(key, 0) + n

    def window(self, F, x0, x1, z0, z1, wall, lintel='stone', frame=None, curtain=None, off=0.):
        """Recessed window; `off` moves the whole opening forward (dormer faces)."""
        lot = self.lot
        frame = frame or lot['frame']
        D_BACK, D_FACE = globals()['D_BACK'] + off, globals()['D_FACE'] + off
        F.quad_d('Glass', x0, x1, z0, z1, D_BACK + .5)
        if curtain is None:
            curtain = self.rng.random()
        if curtain < .22:
            F.quad_d('Trim', x0 + 6, x1 - 6, z0 + (z1 - z0) * .45, z1 - 6, D_BACK + 1.2)
        elif curtain < .36:
            F.quad_d('Trim', x0 + 6, x0 + (x1 - x0) * .32, z0 + 6, z1 - 6, D_BACK + 1.2)
            F.quad_d('Trim', x1 - (x1 - x0) * .32, x1 - 6, z0 + 6, z1 - 6, D_BACK + 1.2)
        F.quad_x(wall, x0, D_BACK, D_FACE, z0, z1, 1)
        F.quad_x(wall, x1, D_BACK, D_FACE, z0, z1, -1)
        F.quad_z(wall, x0, x1, D_BACK, D_FACE, z1, -1)
        F.quad_z('Stone' if wall != 'Stone' else wall, x0, x1, D_BACK, D_FACE, z0, 1)
        fw, df = 6.5, D_BACK + 3.5
        F.quad_d(frame, x0, x0 + fw, z0, z1, df)
        F.quad_d(frame, x1 - fw, x1, z0, z1, df)
        F.quad_d(frame, x0 + fw, x1 - fw, z1 - fw, z1, df)
        F.quad_d(frame, x0 + fw, x1 - fw, z0, z0 + fw, df)
        if lot['sash'] == 'double_hung':
            zm = (z0 + z1) / 2
            F.quad_d(frame, x0 + fw, x1 - fw, zm - 3, zm + 3, df + .1)
        else:
            zm = z1 - (z1 - z0) / 3
            F.quad_d(frame, x0 + fw, x1 - fw, zm - 3, zm + 3, df + .1)
            F.quad_d(frame, (x0 + x1) / 2 - 2.5, (x0 + x1) / 2 + 2.5, z0 + fw, zm - 3, df + .1)
        F.box('Stone' if wall != 'Stone' else 'Stone_Cast', x0 - 9, x1 + 9, D_FACE - 1, D_FACE + 6, z0 - 13, z0, skip='k')
        if lintel == 'stone' and wall != 'Stone':
            F.box('Stone', x0 - 11, x1 + 11, D_FACE - 1, D_FACE + 3, z1, z1 + 23, skip='kb')
        elif lintel == 'cast':
            F.box('Stone_Cast', x0 - 10, x1 + 10, D_FACE - 1, D_FACE + 3, z1, z1 + 22, skip='kb')
            F.box('Stone_Cast', (x0 + x1) / 2 - 9, (x0 + x1) / 2 + 9, D_FACE + 3, D_FACE + 5, z1 + 2, z1 + 24, skip='kb')
        elif lintel == 'wood':
            F.box(lot['paint'], x0 - 10, x1 + 10, D_FACE - 1, D_FACE + 4, z1, z1 + 22, skip='k')
        self.count('windows')

    def door(self, F, x0, x1, z0, z1, wall, glazed=False, transom=38, lintel='stone'):
        lot = self.lot
        leaf_top = z1 - transom - 6
        F.quad_d(lot['door'], x0, x1, z0, leaf_top, D_BACK + 1)
        glass_bottom = z0 + (40 if glazed else 105)
        F.quad_d('Glass', x0 + 12, x1 - 12, glass_bottom, leaf_top - 12, D_BACK + 1.6)
        if glazed and self.rng.random() < .4:
            F.quad_d('Trim', x0 + 14, x1 - 14, glass_bottom + 2, leaf_top - 14, D_BACK + 1.4)
        F.quad_d('Glass', x0, x1, leaf_top + 6, z1, D_BACK + .5)
        F.quad_d(lot['door'], x0, x1, leaf_top, leaf_top + 6, D_BACK + 3.6)
        F.quad_x(wall, x0, D_BACK, D_FACE, z0, z1, 1)
        F.quad_x(wall, x1, D_BACK, D_FACE, z0, z1, -1)
        F.quad_z(wall, x0, x1, D_BACK, D_FACE, z1, -1)
        F.quad_z('Stone', x0, x1, D_BACK, D_FACE, z0, 1)
        fw, df = 6.5, D_BACK + 3.5
        F.quad_d(lot['frame'], x0, x0 + fw, z0, z1, df)
        F.quad_d(lot['frame'], x1 - fw, x1, z0, z1, df)
        F.quad_d(lot['frame'], x0 + fw, x1 - fw, z1 - fw, z1, df)
        if lintel == 'stone' and wall != 'Stone':
            F.box('Stone', x0 - 11, x1 + 11, D_FACE - 1, D_FACE + 3, z1, z1 + 23, skip='kb')
        elif lintel == 'cast':
            F.box('Stone_Cast', x0 - 10, x1 + 10, D_FACE - 1, D_FACE + 3, z1, z1 + 22, skip='kb')
        elif lintel == 'wood':
            F.box(lot['paint'], x0 - 10, x1 + 10, D_FACE - 1, D_FACE + 4, z1, z1 + 22, skip='k')
        self.count('doors')

    def rail(self, a, b, z, height, mat, spacing=22, posts=True):
        """Railing along world points a->b (z = deck top)."""
        mesh = self.mesh
        length = math.dist(a[:2], b[:2])
        if length < 10:
            return
        t = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        side = (t[1], -t[0])
        beam(mesh, mat, (a[0], a[1], z + height), (b[0], b[1], z + height), 6, 5)
        beam(mesh, mat, (a[0], a[1], z + 9), (b[0], b[1], z + 9), 4, 4)
        n = max(1, round(length / spacing))
        for i in range(1, n):
            f = i / n
            x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
            card(mesh, mat, (x, y, z + 11), (x, y, z + height - 2.5), side, 1.2)
        if posts:
            for p in (a, b):
                beam(mesh, mat, (p[0], p[1], z), (p[0], p[1], z + height + 4), 7, 7)

    def balcony(self, F, x0, x1, z, depth, rail_mat, open_side=None, brackets=True, posts_to=None):
        """Cantilevered wood balcony, deck top at z; open_side 'l'/'r' leaves the stair arrival open."""
        self.count('balconies')
        F.box('Wood_Deck', x0, x1, D_FACE - 2, depth, z - 9, z)
        F.box(self.lot['paint'], x0 - 1, x1 + 1, depth, depth + 4, z - 24, z + 1, skip='k')
        if brackets and posts_to is None:
            for x in (x0 + 12, (x0 + x1) / 2, x1 - 12):
                F.box(self.lot['paint'], x - 5, x + 5, D_FACE, depth - 8, z - 30, z - 9, skip='kt')
                F.box(self.lot['paint'], x - 5, x + 5, D_FACE, D_FACE + 9, z - 62, z - 30, skip='kt')
        if posts_to is not None:
            for x in (x0 + 8, x1 - 8):
                F.box(self.lot['paint'], x - 6, x + 6, depth - 14, depth - 2, posts_to, z - 9, skip='tb')
        p = F.p
        front_a, front_b = p(x0 + 3, depth - 3, 0), p(x1 - 3, depth - 3, 0)
        self.rail(front_a, front_b, z, 86, rail_mat)
        if open_side != 'l':
            self.rail(p(x0 + 3, D_FACE, 0), front_a, z, 86, rail_mat, posts=False)
        if open_side != 'r':
            self.rail(p(x1 - 3, D_FACE, 0), front_b, z, 86, rail_mat, posts=False)

    def stair(self, F, x_top, climb, z_top, yard, curved, run_limit):
        """Iron stair with grey wood treads from the parterre to a deck at z_top.

        climb = +1 when the stair rises toward +x; run_limit is the room along the wall below the
        head. The whole stair stays inside the measured front yard. Returns (ok, x_bottom_extent).
        """
        rise_count = max(14, math.ceil(z_top / 21.5))
        rise = z_top / rise_count
        width = max(80., min(100., yard - 5 - (D_FACE + 4)))
        half = width / 2
        d_mid = D_FACE + 4 + half
        radius, theta = 0., 0.
        if curved:
            available = yard - 5 - half - d_mid
            if available >= 35:
                radius, theta = min(available, 120.), math.pi / 2
            elif available >= 15:
                radius = 35.
                theta = math.acos(max(-1., min(1., 1 - available / radius)))
        def fit(radius, theta):
            return (run_limit - 4 - (radius + half) * math.sin(theta) + radius * theta) / (rise_count - 1)
        going = min(23., fit(radius, theta))
        if going < 17.5 and theta > 0:
            radius, theta = 0., 0.
            going = min(23., fit(0., 0.))
        if going < 17.5:
            return False, None
        length = (rise_count - 1) * going
        straight = length - radius * theta
        if straight < 40:
            return False, None
        def path(s):
            """Centreline at arc length s from the head (s=0) downhill; returns x, d, heading."""
            if s <= straight:
                return x_top - climb * s, d_mid, (-climb, 0.)
            phi = (s - straight) / radius
            cx, cd = x_top - climb * straight, d_mid + radius
            x = cx - climb * radius * math.sin(phi)
            d = cd - radius * math.cos(phi)
            return x, d, (-climb * math.cos(phi), math.sin(phi))
        extent = path(length)[0] - climb * (half * math.sin(theta) + 4)
        def edge(s, side):
            x, d, h = path(s)
            nx, nd = -h[1], h[0]
            return x + nx * side * half, d + nd * side * half
        # treads: tread i (0 = bottom) between s_hi = length - i*going and s_lo = s_hi - going
        mesh = self.mesh
        for i in range(rise_count - 1):
            s_hi = length - i * going
            s_lo = max(0., s_hi - going - 2)
            z = (i + 1) * rise
            mat = 'Stone' if i == 0 else 'Wood_Deck'
            corners = []
            for s in (s_hi, s_lo):
                for side in (-1, 1):
                    corners.append(edge(s, side))
            pts_top = [F.p(corners[0][0], corners[0][1], z), F.p(corners[1][0], corners[1][1], z),
                       F.p(corners[3][0], corners[3][1], z), F.p(corners[2][0], corners[2][1], z)]
            low = z - (rise if i == 0 else 5)
            pts_low = [(q[0], q[1], low) for q in pts_top]
            mesh.face(mat, pts_top, (0, 0, 1))
            mesh.face(mat, pts_low, (0, 0, -1))
            x, d, h = path(s_hi)
            hw = F.out(h[0], h[1], 0)
            mesh.face(mat, [pts_top[0], pts_top[1], pts_low[1], pts_low[0]], hw)
            for k0, k1 in ((1, 2), (3, 0)):
                mx, my = (pts_top[k0][0] + pts_top[k1][0]) / 2, (pts_top[k0][1] + pts_top[k1][1]) / 2
                cx, cy = sum(q[0] for q in pts_top) / 4, sum(q[1] for q in pts_top) / 4
                mesh.face(mat, [pts_top[k0], pts_top[k1], pts_low[k1], pts_low[k0]], (mx - cx, my - cy, 0))
        # stringers, handrails and pickets
        segments = [0., straight] if theta == 0 else [0., straight] + [straight + radius * theta * k / 6 for k in range(1, 7)]
        segments = sorted(set(min(length, s) for s in segments))
        def zline(s):
            return (length - s) / going * rise + rise * .6
        for side in (-1, 1):
            for s0, s1 in zip(segments, segments[1:]):
                e0, e1 = edge(s0, side), edge(s1, side)
                a = F.p(e0[0], e0[1], zline(s0) + rise * .5)
                b = F.p(e1[0], e1[1], zline(s1) + rise * .5)
                beam(mesh, 'Iron', (a[0], a[1], a[2] - 12), (b[0], b[1], b[2] - 12), 4, 24, bottom=True)
                beam(mesh, 'Iron', (a[0], a[1], a[2] + 86), (b[0], b[1], b[2] + 86), 5, 5)
            for i in range(0, rise_count - 1, 2):
                s = length - i * going - going / 2
                e = edge(s, side)
                base = F.p(e[0], e[1], (i + 1) * rise)
                x, d, h = path(s)
                card(mesh, 'Iron', base, (base[0], base[1], zline(s) + rise * .5 + 84), F.out(-h[1] * side, h[0] * side, 0)[:2], 1.3)
            e = edge(length, side)
            base = F.p(e[0], e[1], 0)
            beam(mesh, 'Iron', base, (base[0], base[1], rise + 100), 7, 7)
        if theta > 0:
            x, d, _ = path(straight + radius * theta * .5)
            post = F.p(x, d, 0)
            beam(mesh, 'Iron', post, (post[0], post[1], zline(straight + radius * theta * .5) - 10), 6, 6)
        self.count('exterior_stairs')
        self.count('stair_' + ('curved' if theta > 0 else 'straight'))
        return True, extent


def _layout_bays(width, door_count):
    """Window bay centres for a module, CGA-style split with a floating pier."""
    bays = 2 if width < 520 else 3 if width < 900 else max(3, round(width / 255))
    return [(i + .5) * width / bays for i in range(bays)]


def author_front(mesh, lot, front, kit, primary=True, top_override=None):
    """Author one street front; returns its record (heights, features, bounds)."""
    F = Frame(mesh, front['a'], front['b'])
    W = front['width']
    rng = kit.rng
    storeys, FH, raise_cm = lot['storeys'], lot['floor_height'], lot['raise']
    wall = lot['masonry']
    commercial = lot['commercial'] and primary
    ground_height = FH + 40 if lot['commercial'] else FH
    floor_z = [0.] + [raise_cm + ground_height + FH * (k - 1) for k in range(1, storeys + 1)]
    floor_z[0] = raise_cm
    wall_top = floor_z[-1] + 12 if storeys > 0 else raise_cm + FH
    crown = lot['crown']
    mansard = crown == 'mansard' and storeys >= 2
    mansard_base = floor_z[storeys - 1] - 12 if mansard else None
    # crown heights
    if crown in ('cornice_wood', 'cornice_metal'):
        top = wall_top + 24
    elif crown == 'parapet':
        top = wall_top + 75
    elif crown == 'flat':
        top = wall_top + 40
    else:
        top = wall_top + 20
    min_top = lot['height_cm'] + 15
    extra = max(0., min_top - top)
    if top_override:
        top = max(top, top_override)
        extra = max(extra, top_override - top)
    top += extra
    lintel = 'wood' if lot['year'] < 1890 and wall != 'Stone' else 'cast' if lot['year'] >= 1912 else 'stone'
    apertures = []
    # modules: one plex composition per 7.63 m lot module in wide footprints
    modules = max(1, round(W / 763)) if W >= 1150 and primary else 1
    mw = W / modules
    stairs_built = 0
    stair_records = []
    for m in range(modules):
        curved_before = kit.counts.get('stair_curved', 0)
        mx0, mx1 = m * mw, (m + 1) * mw
        left = lot['stair_left'] ^ (m % 2 == 1)
        stair = lot['stair'] if primary and not commercial else None
        if stair and mw < 480:
            stair = None
        centres = [mx0 + c for c in _layout_bays(mw, 1)]
        head_w = 0.
        stair_ok = False
        x_top = None
        yard = front['yard']
        if stair and storeys >= 2:
            head_w = (215 if mw >= 600 else 190) if lot['kind'] == 'triplex' else (175 if mw >= 600 else 160)
            climb = 1 if left else -1
            x_top = mx1 - head_w if left else mx0 + head_w
            run_limit = (x_top - mx0 - 8) if left else (mx1 - 8 - x_top)
            z2 = floor_z[1]
            # trial on a throwaway mesh so a stair that does not fit leaves no faces behind
            trial = PlexMesh()
            ok, extent = Kit(trial, lot).stair(Frame(trial, front['a'], front['b']), x_top, climb, z2, yard,
                                               stair == 'curved', run_limit)
            if ok and (extent >= mx0 + 7 if left else extent <= mx1 - 7):
                kit.stair(F, x_top, climb, z2, yard, stair == 'curved', run_limit)
                stair_ok = True
                stairs_built += 1
                stair_records.append({'head': [round(v, 1) for v in F.p(x_top, D_FACE + 54, z2)],
                                      'bottom': [round(v, 1) for v in F.p(extent, min(yard - 10, D_FACE + 120), 0)],
                                      'shape': 'curved' if stair == 'curved' and kit.counts.get('stair_curved', 0) > curved_before else 'straight'})
        # ground floor composition
        doors_ground = []
        if not commercial and not primary:
            for c in centres:
                ww = min(96, mw / len(centres) * .5)
                z0, z1 = raise_cm + 78, raise_cm + 78 + min(205, ground_height - 120)
                kit.window(F, c - ww / 2, c + ww / 2, z0, z1, wall, lintel)
                apertures.append((c - ww / 2, c + ww / 2, z0, z1))
        elif not commercial:
            if stair_ok:
                door_x = (x_top + (mx1 if left else mx0)) / 2
                doors_ground = [(door_x - 42, door_x + 42)]
            else:
                door_x = centres[-1] if left else centres[0]
                doors_ground = [(door_x - 82, door_x - 4), (door_x + 4, door_x + 82)] if storeys >= 2 else [(door_x - 44, door_x + 44)]
            door_band = (min(d[0] for d in doors_ground) - 30, max(d[1] for d in doors_ground) + 30)
            for x0, x1 in doors_ground:
                z0 = raise_cm
                kit.door(F, x0, x1, z0, z0 + 258, wall, lintel=lintel)
                apertures.append((x0, x1, z0, z0 + 258))
            if len(doors_ground) == 2:
                F.box(lot['frame'], doors_ground[0][1], doors_ground[1][0], D_BACK + 1, D_BACK + 6, raise_cm, raise_cm + 258, skip='k')
            for c in centres:
                if door_band[0] - 45 < c < door_band[1] + 45:
                    continue
                ww = min(96, mw / len(centres) * .5)
                z0, z1 = raise_cm + 78, raise_cm + 78 + min(205, FH - 120)
                kit.window(F, c - ww / 2, c + ww / 2, z0, z1, wall, lintel)
                apertures.append((c - ww / 2, c + ww / 2, z0, z1))
                if raise_cm >= 55:
                    bz0, bz1 = 14, min(raise_cm - 14, 50)
                    if bz1 - bz0 > 14:
                        F.quad_d('Glass', c - ww / 2, c + ww / 2, bz0, bz1, D_BACK + .5)
                        F.quad_x('Stone', c - ww / 2, D_BACK, D_FACE, bz0, bz1, 1)
                        F.quad_x('Stone', c + ww / 2, D_BACK, D_FACE, bz0, bz1, -1)
                        F.quad_z('Stone', c - ww / 2, c + ww / 2, D_BACK, D_FACE, bz1, -1)
                        F.quad_z('Stone', c - ww / 2, c + ww / 2, D_BACK, D_FACE, bz0, 1)
                        for k in (1, 2, 3):
                            xb = c - ww / 2 + ww * k / 4
                            F.quad_d('Iron', xb - 1.2, xb + 1.2, bz0, bz1, D_BACK + 6)
                        apertures.append((c - ww / 2, c + ww / 2, bz0, bz1))
                        kit.count('basement_vents')
            # porch at the ground door with steps down to the parterre
            if raise_cm >= 30 and yard >= 60:
                px0, px1 = (door_band[0] - 10, door_band[1] + 10)
                px0, px1 = max(mx0 + 10, px0), min(mx1 - 10, px1)
                steps = max(1, round(raise_cm / 19))
                rise = raise_cm / steps
                pd = min(130., max(60., yard - steps * 26 - 8))
                if pd + steps * 26 > yard - 5:
                    pd = max(D_FACE + 30, yard - 5)
                    steps_dir = 'none'
                else:
                    steps_dir = 'out'
                F.box('Wood_Deck', px0, px1, D_FACE - 2, pd, raise_cm - 10, raise_cm)
                F.box('Stone', px0 + 4, px1 - 4, D_FACE - 2, pd - 6, 0, raise_cm - 10, skip='kt')
                if steps_dir == 'out':
                    sx0, sx1 = (px0 + px1) / 2 - 55, (px0 + px1) / 2 + 55
                    for k in range(steps - 1):
                        zt = raise_cm - rise * (k + 1)
                        F.box('Wood_Deck' if k < steps - 2 else 'Stone', sx0, sx1, pd + k * 26, pd + (k + 1) * 26 + 2, zt - 5 if k < steps - 2 else 0, zt, skip='k')
                    if steps > 2:
                        for x in (sx0 + 3, sx1 - 3):
                            a = F.p(x, pd, raise_cm + 86)
                            b = F.p(x, pd + (steps - 1) * 26, rise + 86)
                            beam(mesh, 'Iron', a, b, 4, 4)
                            beam(mesh, 'Iron', F.p(x, pd + (steps - 1) * 26, 0), b, 4, 4)
                if not stair_ok and raise_cm >= 55:
                    kit.rail(F.p(px0 + 3, pd - 3, 0), F.p(sx0 if steps_dir == 'out' else px1 - 3, pd - 3, 0), raise_cm, 80, 'Iron', posts=True)
                    if steps_dir == 'out':
                        kit.rail(F.p(sx1, pd - 3, 0), F.p(px1 - 3, pd - 3, 0), raise_cm, 80, 'Iron', posts=True)
                kit.count('porches')
            elif raise_cm < 40:
                for x0, x1 in doors_ground:
                    F.box('Stone', x0 - 6, x1 + 6, D_FACE - 2, D_FACE + 28, 0, raise_cm, skip='k')
        # upper floors
        for level in range(1, storeys):
            z = floor_z[level]
            in_mansard = mansard and level == storeys - 1
            is_head = stair_ok and level == 1
            doors = []
            if is_head:
                hx0, hx1 = (x_top, mx1) if left else (mx0, x_top)
                hc = (hx0 + hx1) / 2
                if lot['kind'] == 'triplex':
                    doors = [(hc - 82, hc - 6), (hc + 6, hc + 82)]
                else:
                    doors = [(hc - 40, hc + 40)]
            elif lot['balconies'] and not in_mansard:
                dc = centres[-1] if left else centres[0]
                doors = [(dc - 44, dc + 44)]
            door_band = (min(d[0] for d in doors) - 30, max(d[1] for d in doors) + 30) if doors else (-1e9, -1e9)
            for x0, x1 in doors:
                kit.door(F, x0, x1, z, z + 250, wall, glazed=not is_head, transom=34, lintel=lintel)
                apertures.append((x0, x1, z, z + 250))
            if len(doors) == 2:
                F.box(lot['frame'], doors[0][1], doors[1][0], D_BACK + 1, D_BACK + 6, z, z + 250, skip='k')
            for c in centres:
                if door_band[0] - 45 < c < door_band[1] + 45:
                    continue
                ww = min(96, mw / len(centres) * .5)
                z0, z1 = z + 75, z + 75 + min(200, FH - 118)
                if in_mansard:
                    continue
                kit.window(F, c - ww / 2, c + ww / 2, z0, z1, wall, lintel)
                apertures.append((c - ww / 2, c + ww / 2, z0, z1))
            # balconies
            if in_mansard:
                continue
            if is_head:
                hx0, hx1 = (x_top, mx1 - 10) if left else (mx0 + 10, x_top)
                depth = D_FACE + max(118., 120. + rng.choice((0, 10, 20)))
                kit.balcony(F, hx0, hx1, z, depth, 'Iron' if rng.random() < .6 else lot['paint'],
                            open_side='l' if left else 'r')
            elif lot['balconies'] and front['width'] >= 300:
                depth = D_FACE + (min(150., max(110., yard + 30)) if yard > 60 else 110.)
                partial = lot['year'] < 1890 and rng.random() < .4
                bx0, bx1 = (mx0 + 10, mx1 - 10)
                if partial and doors:
                    bx0, bx1 = max(mx0 + 10, doors[0][0] - 60), min(mx1 - 10, doors[-1][1] + 60)
                below = None
                if lot['columns'] and not stair_ok and depth <= yard + D_FACE - 10:
                    below = floor_z[level - 1] if level >= 2 else 0.
                kit.balcony(F, bx0, bx1, z, depth, 'Iron' if lot['year'] < 1912 or rng.random() < .5 else lot['paint'],
                            posts_to=below)
    # commercial ground floor (dépanneur style)
    if commercial:
        sign = rng.choice(('Wood_Green', 'Wood_Burgundy', 'Wood_Cream', 'Iron'))
        corner_left = lot['stair_left']
        gz0, gz1 = 15, 15 + ground_height - 70
        piers = [0, W]
        door_w = 95
        dx0 = 30 if corner_left else W - 30 - door_w
        kit.door(F, dx0, dx0 + door_w, 15, gz1 - 10, wall, glazed=True, transom=45)
        apertures.append((dx0, dx0 + door_w, 15, gz1 - 10))
        shop_x0, shop_x1 = (dx0 + door_w + 30, W - 25) if corner_left else (25, dx0 - 30)
        panes = max(1, round((shop_x1 - shop_x0) / 170))
        pw = (shop_x1 - shop_x0) / panes
        for k in range(panes):
            x0, x1 = shop_x0 + k * pw + 6, shop_x0 + (k + 1) * pw - 6
            F.quad_d('Glass', x0, x1, 62, gz1, D_BACK + .5)
            F.quad_x(wall, x0, D_BACK, D_FACE, 62, gz1, 1)
            F.quad_x(wall, x1, D_BACK, D_FACE, 62, gz1, -1)
            F.quad_z(wall, x0, x1, D_BACK, D_FACE, gz1, -1)
            F.box(sign, x0, x1, D_BACK, D_FACE + 2, 15, 62, skip='k')
            F.quad_d('Trim', x0, x1, gz1 - 40, gz1 - 35, D_BACK + 3)
            apertures.append((x0, x1, 15, gz1))
            if rng.random() < .5:
                F.quad_d('Trim', x0 + 10, x1 - 10, 70, 120, D_BACK + 1.2)
        F.box(sign, 10, W - 10, D_FACE, D_FACE + 7, gz1 + 8, gz1 + 62)
        F.quad_d('Trim' if sign != 'Wood_Cream' else 'Iron', W * .18, W * .82, gz1 + 22, gz1 + 48, D_FACE + 7.4)
        if rng.random() < .6:
            awning = rng.choice(('Wood_Burgundy', 'Wood_Green', 'Wood_Cream'))
            p = F.p
            a0, a1 = shop_x0, shop_x1
            canvas = [p(a0, D_FACE + 4, gz1 + 4), p(a1, D_FACE + 4, gz1 + 4), p(a1, D_FACE + 120, gz1 - 50), p(a0, D_FACE + 120, gz1 - 50)]
            mesh.face(awning, canvas, F.out(0, .4, 1))
            mesh.face(awning, canvas, F.out(0, -.4, -1))
            F.box(awning, a0, a1, D_FACE + 118, D_FACE + 121, gz1 - 72, gz1 - 50, skip='')
            kit.count('awnings')
        # blade sign projecting at the corner end
        bx = 12 if corner_left else W - 12
        F.box(sign, bx - 3, bx + 3, D_FACE, D_FACE + 85, gz1 + 70, gz1 + 140)
        kit.count('storefronts')
    # string courses
    if lot['bands']:
        for level in range(1, storeys):
            z = floor_z[level] + 62
            F.box('Stone', 0, W, D_FACE - 1, D_FACE + 4, z, z + 14, skip='k')
    # crown
    paint = lot['paint']
    if mansard:
        zb = mansard_base
        zt = wall_top + 10
        db, dt = D_FACE + 46, D_BACK + 4
        F.box(paint, -2, W + 2, D_FACE - 1, D_FACE + 50, zb - 4, zb + 16, skip='k')
        for x in [12 + k * (W - 24) / max(1, round(W / 95)) for k in range(round(W / 95) + 1)]:
            F.box(paint, x - 6, x + 6, D_FACE, D_FACE + 34, zb - 40, zb - 4, skip='kt')
        p = F.p
        dormers = [c for c in [(i + .5) * W / max(2, round(W / 255)) for i in range(max(2, round(W / 255)))]]
        z_dorm0, z_dorm1 = zb + 16 + 50, min(zt - 30, zb + 16 + 50 + 175)
        slope = (db - dt) / (zt - (zb + 16))
        def d_at(z):
            return db - (z - zb - 16) * slope
        # slate field split around dormers
        xs = [0.]
        for c in dormers:
            xs += [c - 58, c + 58]
        xs.append(W)
        for i in range(0, len(xs), 2):
            x0, x1 = xs[i], xs[i + 1]
            if x1 - x0 > 1:
                mesh.face('Slate', [p(x0, db, zb + 16), p(x1, db, zb + 16), p(x1, dt, zt), p(x0, dt, zt)], F.out(0, 1, slope))
        for c in dormers:
            x0, x1 = c - 58, c + 58
            dz = z_dorm1 + 22
            mesh.face('Slate', [p(x0, db, zb + 16), p(x1, db, zb + 16), p(x1, d_at(z_dorm0 - 8), z_dorm0 - 8), p(x0, d_at(z_dorm0 - 8), z_dorm0 - 8)], F.out(0, 1, slope))
            mesh.face('Slate', [p(x0, d_at(dz + 20), dz + 20), p(x1, d_at(dz + 20), dz + 20), p(x1, dt, zt), p(x0, dt, zt)], F.out(0, 1, slope))
            dd = d_at(z_dorm0 - 8)
            for fx0, fx1, fz0, fz1 in _wall_rectangles(x1 - x0, dz - z_dorm0 + 8, [(18, 98, 8, z_dorm1 - z_dorm0 + 8)]):
                F.quad_d(paint, x0 + fx0, x0 + fx1, z_dorm0 - 8 + fz0, z_dorm0 - 8 + fz1, dd)
            for side, x in ((-1, x0), (1, x1)):
                mesh.face(paint, [p(x, dd, z_dorm0 - 8), p(x, dd, dz), p(x, d_at(dz + 20), dz + 20), p(x, d_at(z_dorm0 - 8), z_dorm0 - 8)], F.out(side, 0, 0))
            mesh.face('Slate', [p(x0 - 6, dd + 8, dz), p(x1 + 6, dd + 8, dz), p(x1 + 6, d_at(dz + 20) - 4, dz + 22), p(x0 - 6, d_at(dz + 20) - 4, dz + 22)], (0, 0, 1))
            kit.window(F, c - 40, c + 40, z_dorm0, z_dorm1, paint, lintel='none', frame='Trim', off=dd - D_FACE)
            kit.count('dormers')
        for x, side in ((0, -1), (W, 1)):
            mesh.face(wall if wall != 'Stone' else 'Stone', [p(x, D_BACK, zb + 16), p(x, db, zb + 16), p(x, dt, zt), p(x, D_BACK, zt)], F.out(side, 0, 0))
        F.box(paint, -2, W + 2, dt - 4, dt + 22, zt, zt + 14, skip='k')
        top = max(top, zt + 14)
        apertures.append((0, W, zb, top + 1))
        kit.count('mansards')
    elif crown in ('cornice_wood', 'cornice_metal'):
        zc = wall_top
        F.box(paint, -1, W + 1, D_FACE - 1, D_FACE + 4, zc - 60, zc, skip='kt')
        F.box(paint, -3, W + 3, D_FACE - 1, D_FACE + 48, zc, zc + 20, skip='k')
        F.box(paint, -1, W + 1, D_FACE + 4, D_FACE + 30, zc - 8, zc, skip='kt')
        spacing = 75 if crown == 'cornice_metal' else 95
        count = max(2, round((W - 30) / spacing))
        for k in range(count + 1):
            x = 15 + k * (W - 30) / count
            big = k in (0, count)
            hw = 11 if big else 6
            F.box(paint, x - hw, x + hw, D_FACE + 4, D_FACE + (40 if big else 32), zc - (78 if big else 50), zc - 8, skip='kt')
            if crown == 'cornice_metal' and k < count:
                xm = x + (W - 30) / count / 2
                F.quad_d(paint, xm - (W - 30) / count * .3, xm + (W - 30) / count * .3, zc - 48, zc - 16, D_FACE + 6)
        if crown == 'cornice_metal' and rng.random() < .5:
            p = F.p
            mesh.face(paint, [p(W / 2 - 70, D_FACE + 30, zc + 20), p(W / 2 + 70, D_FACE + 30, zc + 20), p(W / 2, D_FACE + 30, zc + 56)], F.out(0, 1, 0))
            mesh.face(paint, [p(W / 2 - 70, D_FACE + 30, zc + 20), p(W / 2, D_FACE + 30, zc + 56), p(W / 2, D_BACK + 2, zc + 56), p(W / 2 - 70, D_BACK + 2, zc + 20)], F.out(-.5, 0, 1))
            mesh.face(paint, [p(W / 2 + 70, D_FACE + 30, zc + 20), p(W / 2, D_FACE + 30, zc + 56), p(W / 2, D_BACK + 2, zc + 56), p(W / 2 + 70, D_BACK + 2, zc + 20)], F.out(.5, 0, 1))
            top = max(top, zc + 56)
            kit.count('pediments')
        apertures.append((0, W, zc - 60, top + 1))
        if top > zc + 20:
            F.quad_d(wall, 0, W, zc + 20, top, D_FACE - 2)
            F.box('Iron', -2, W + 2, D_FACE - 4, D_FACE + 6, top, top + 5, skip='k')
        kit.count('cornices')
    elif crown == 'parapet':
        zc = wall_top
        F.box('Iron', -1, W + 1, D_FACE - 1, D_FACE + 6, zc - 8, zc, skip='k')
        peak_w = min(W * .42, 360)
        F.box('Stone_Cast', -1, W + 1, D_FACE - 2, D_FACE + 5, top - 12, top, skip='k')
        F.box(wall, W / 2 - peak_w / 2, W / 2 + peak_w / 2, D_FACE - 2, D_FACE, top, top + 48, skip='kb')
        F.box('Stone_Cast', W / 2 - peak_w / 2 - 4, W / 2 + peak_w / 2 + 4, D_FACE - 2, D_FACE + 5, top + 48, top + 60, skip='k')
        F.box('Stone_Cast', W / 2 - 30, W / 2 + 30, D_FACE, D_FACE + 4, top - 50, top + 30, skip='k')
        for x in (6, W - 6):
            F.box('Stone_Cast', x - 18, x + 18, D_FACE, D_FACE + 4, top - 30, top - 12, skip='k')
        F.quad_d(wall, W / 2 - peak_w / 2, W / 2 + peak_w / 2, top, top + 48, D_BACK, -1)
        apertures.append((0, W, top - 12, top + 1))
        top_peak = top + 60
        kit.count('parapets')
        kit.count('medallions')
    else:
        F.box('Wood_Grey', -1, W + 1, D_FACE - 2, D_FACE + 4, top - 8, top, skip='k')
        apertures.append((0, W, top - 8, top + 1))
        kit.count('flat_parapets')
    # masonry skin around every opening, stone base below the ground floor
    base_top = raise_cm + (10 if not commercial else 0)
    for x0, x1, z0, z1 in _wall_rectangles(W, top, apertures):
        if commercial and z0 < 15 + ground_height - 70:
            F.quad_d(wall, x0, x1, z0, z1, D_FACE)
            continue
        if z0 < base_top:
            F.quad_d('Stone', x0, x1, z0, min(z1, base_top), D_FACE)
        if z1 > base_top:
            F.quad_d(wall, x0, x1, max(z0, base_top), z1, D_FACE)
    # ends and the back of any false front above the retained mass
    for x, side in ((0, -1), (W, 1)):
        F.quad_x(wall, x, D_BACK, D_FACE, 0, top, side)
    F.quad_z('Iron', 0, W, D_BACK, D_FACE, top, 1)
    if top > lot['height_cm']:
        F.quad_d(wall, 0, W, lot['height_cm'], top, D_BACK, -1)
    record = {'a': [round(v, 2) for v in front['a']], 'b': [round(v, 2) for v in front['b']],
              'width_cm': round(W, 1), 'street': front['street'], 'yard_cm': front['yard'],
              'yard_source': front['yard_source'], 'top_cm': round(top, 1), 'modules': modules,
              'exterior_stairs': stairs_built, 'stairs': stair_records}
    return record, top


def _extension(mesh, lot, top, skin_edges):
    """Close the band between the retained mass top and the taller plex front."""
    points = lot['points']
    z0, z1 = lot['height_cm'], top - 10
    if z1 - z0 < 10:
        return 0
    n = len(points)
    for i in range(n):
        a, b = points[i], points[(i + 1) % n]
        if math.dist(a, b) < 1:
            continue
        if any(_nearest(a, e[0], e[1])[0] < 35 and _nearest(b, e[0], e[1])[0] < 35 for e in skin_edges):
            continue
        u = ((b[0] - a[0]) / math.dist(a, b), (b[1] - a[1]) / math.dist(a, b))
        mesh.face(lot['masonry'] if lot['masonry'] != 'Stone' else 'Brick_Red',
                  [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], (u[1], -u[0], 0))
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    for triangle in triangulate([list(points)], (min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1)):
        mesh.face('Slate', [(p[0], p[1], z1) for p in triangle], (0, 0, 1))
    return 1


# ----------------------------------------------------------------------------- rear of the lot
# Plateau rears (research §13, the Plateau and Villeray ruelles vertes guides, the heritage sheets): plain brick
# or painted siding with a door and a window or two per floor; a wooden gallery on every upper floor across most
# of the lot, on square posts from the yard; a steep straight wooden flight or a steel spiral between galleries;
# a yard closed toward the ruelle by a board or slatted chain-link fence with a gate; here and there a shed
# (hangar) or garage with its door on the lane, a cedar hedge, a small cedar or a creeper. Low-poly on purpose:
# solid board guards, open treads drawn as their top faces, one post per gallery corner from yard to top.
FENCE_FROM_ALLEY = 290.     # fence line from the ruelle centreline: the 430 cm lane strip plus a verge
TRAFFIC_CLEAR = 300.        # Streets layer rule: no collision within 300 cm of a drive or service centreline
GUARD_H = 107.              # guards over 1.89 m above grade are 1070 mm (MRC de Coaticook SARP gallery sheet)
STAIR_W = 90.
REAR_RISE = 22.5            # steep rear flights (research §6: about 45-50 degrees, risers 20-23 cm)
GOING_MAX, GOING_MIN = 24., 20.
SPIRAL_R = 70.
SPIRAL_STEPS = 16           # treads per full turn; one turn per storey above the first gallery
REAR_WINDOW = 80.
REAR_HEAD = 215.            # door and window heads line up on the rear walls
REAR_PAINT = ('Wood_Grey', 'Wood_Grey', 'Trim', 'Wood_Cream', 'Wood_Green', 'Wood_Oak', 'Iron', 'Wood_Burgundy')
REAR_DOORS = ('Trim', 'Trim', 'Wood_Oak', 'Wood_Grey', 'Wood_Green', 'Wood_Burgundy')
SIDING = ('Wood_Cream', 'Wood_Grey', 'Trim', 'Wood_Cream', 'Wood_Green')
COMMON_BRICK = ('Brick_Red', 'Brick_Red', 'Brick_RedDark', 'Brick_Brown', 'Brick_Orange')
FENCE_WOOD = ('Wood_Oak', 'Wood_Oak', 'Wood_Grey', 'Wood_Grey', 'Wood_Green', 'Wood_Burgundy', 'Wood_Cream')
SHED_WALLS = ('Wood_Grey', 'Wood_Oak', 'Wood_Green', 'Wood_Cream', 'Iron', 'Wood_Burgundy')


def _back_walls(points, fronts, obstacles, shared, roads, primary_normal):
    """Exposed walls that are not street fronts (CGA comp(f) after Müller et al. 2006): 'rear' (facing away from
    the front), 'lane' (on a ruelle), 'street' (an unnamed-front street side) and 'side' walls. Party walls,
    walls covered by a neighbour and front runs are left out."""
    count = len(points)

    def front_edge(a, b):
        return any(_nearest(a, f['a'], f['b'])[0] < 35 and _nearest(b, f['a'], f['b'])[0] < 35 for f in fronts)

    walls = []
    for i in range(count):
        a, b = points[i], points[(i + 1) % count]
        width = math.dist(a, b)
        if width < 100 or tuple(sorted((a, b))) in shared or front_edge(a, b):
            continue
        u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
        normal = (u[1], -u[0])
        samples = [(a[0] + (b[0] - a[0]) * f + normal[0] * 25, a[1] + (b[1] - a[1]) * f + normal[1] * 25)
                   for f in (.2, .5, .8)]
        if sum(any(_inside(s, other) for other in obstacles[1:]) for s in samples) >= 2:
            continue
        rays = [(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f) for f in (.12, .5, .88)]
        clear = min(_outward_clearance(p, normal, obstacles) for p in rays)
        mid = rays[1]
        alley = street = None
        for c, d, is_alley, named in roads:
            length = math.dist(c, d)
            if length < 1:
                continue
            distance, q = _nearest(mid, c, d)
            facing = (q[0] - mid[0]) * normal[0] + (q[1] - mid[1]) * normal[1]
            if facing <= distance * .8:
                continue
            parallel = abs(u[0] * (d[0] - c[0]) + u[1] * (d[1] - c[1])) / length > .8
            if is_alley and parallel and facing < min(3500., clear + 250):
                alley = facing if alley is None else min(alley, facing)
            elif named and parallel and facing < min(2500., clear + 500):
                street = facing if street is None else min(street, facing)
        dot = normal[0] * primary_normal[0] + normal[1] * primary_normal[1]
        if street is not None and (alley is None or street < alley):
            kind = 'street'
        elif alley is not None and alley - FENCE_FROM_ALLEY < 150:
            kind = 'lane'
        elif dot < -.7:
            kind = 'rear'
        else:
            kind = 'side'
        walls.append({'index': i, 'a': a, 'b': b, 'width': width, 'normal': normal, 'kind': kind,
                      'clear': round(clear, 1), 'alley': None if alley is None else round(alley, 1)})
    # a skin ends flush with the next skin round a convex corner (no 16 cm notch, no return face)
    skinned = {w['index'] for w in walls}
    for w in walls:
        i = w['index']
        for key, j in (('ext0', (i - 1) % count), ('ext1', (i + 1) % count)):
            ja, jb = points[j], points[(j + 1) % count]
            e1, e2 = ((ja, jb), (w['a'], w['b'])) if key == 'ext0' else ((w['a'], w['b']), (ja, jb))
            cross = ((e1[1][0] - e1[0][0]) * (e2[1][1] - e2[0][1]) - (e1[1][1] - e1[0][1]) * (e2[1][0] - e2[0][0]))
            w[key] = (j in skinned or front_edge(ja, jb)) and cross > 0 and math.dist(ja, jb) >= 100
    return walls


def _floor_levels(lot):
    """Floor heights of the front (author_front), so rear doors open at the same storeys."""
    FH, raise_cm = lot['floor_height'], lot['raise']
    ground = FH + 40 if lot['commercial'] else FH
    return [raise_cm] + [raise_cm + ground + FH * (k - 1) for k in range(1, lot['storeys'] + 1)]


def _rear_wall_top(lot, top):
    return top - 10 if top - 10 - lot['height_cm'] >= 10 else lot['height_cm']


def _subtract(interval, cuts, minimum=20.):
    """interval minus the cut intervals, keeping pieces of at least `minimum`."""
    pieces = [interval]
    for c0, c1 in cuts:
        out = []
        for p0, p1 in pieces:
            if c1 <= p0 or c0 >= p1:
                out.append((p0, p1))
                continue
            if c0 > p0:
                out.append((p0, c0))
            if c1 < p1:
                out.append((c1, p1))
        pieces = out
    return [(p0, p1) for p0, p1 in pieces if p1 - p0 >= minimum]


class Occupancy:
    """World footprints of planned rear structures (galleries, stairs, sheds) for free-space checks."""

    def __init__(self):
        self.grid = Grid(1000)

    def add(self, polygon):
        self.grid.add(polygon, [p[0] for p in polygon], [p[1] for p in polygon])

    def hit(self, point):
        return any(_inside(point, polygon) for polygon in self.grid.near(point[0], point[1], 1))


def fence_panel(mesh, mat, a, b, height, thick=3., base=0.):
    """A board fence or gate panel from world point a to b: both faces and the top."""
    if math.dist(a, b) < 20:
        return 0
    F = Frame(mesh, a, b)
    F.box(mat, 0, math.dist(a, b), -thick / 2, thick / 2, base, height, skip='tblr')
    return 1


class Rear:
    """Plan and author the yard side of one lot. It has its own seed, so the front draws stay as they were."""

    def __init__(self, lot, top):
        self.lot = lot
        rng = random.Random(_seed('plex-rear', lot['id']))
        self.zt = _rear_wall_top(lot, top)
        self.floor_z = _floor_levels(lot)
        # every draw up front, in a fixed order, so a planning branch never shifts later choices
        brick = lot['masonry'] if lot['masonry'] != 'Stone' and rng.random() < .5 else rng.choice(COMMON_BRICK)
        self.siding = rng.random() < .25
        self.wall = rng.choice(SIDING) if self.siding else brick
        self.paint = rng.choice(REAR_PAINT)
        self.door = rng.choice(REAR_DOORS)
        self.frame = 'Trim' if rng.random() < .7 else rng.choice(('Iron', 'Wood_Oak', 'Wood_Green'))
        self.sill = 'Trim' if self.siding else rng.choice(('Stone_Cast', 'Stone_Cast', 'Stone'))
        self.prefer_spiral = rng.random() < .3
        self.depth = rng.choice((150., 165., 180., 195.))
        self.climb = 1 if rng.random() < .5 else -1
        self.roofed = rng.random() < .45
        self.roof_mat = rng.choice(('Iron', 'Slate', 'Wood_Grey'))
        self.two_windows = rng.random() < .6
        self.fence_kind = 'slats' if rng.random() < .3 else 'boards'
        self.fence_paint = rng.choice(('Wood_Green', 'Wood_Grey')) if self.fence_kind == 'slats' else rng.choice(FENCE_WOOD)
        self.gate_paint = rng.choice(FENCE_WOOD)
        self.fence_h = 150. if self.fence_kind == 'slats' else rng.choice((165., 180., 180., 195.))
        self.shed_roll, self.garage_roll = rng.random(), rng.random()
        self.shed_w, self.shed_d = rng.uniform(220, 320), rng.uniform(190, 260)
        self.shed_mat, self.shed_door = rng.choice(SHED_WALLS), rng.choice(('Wood_Grey', 'Wood_Oak', 'Trim', 'Wood_Green'))
        self.hedge_roll, self.tree_roll, self.vine_roll = rng.random(), rng.random(), rng.random()
        self.vine_mat = rng.choice(('Wood_Burgundy', 'Wood_Burgundy', 'Wood_Green'))   # autumn Virginia creeper, ivy
        self.tree_h, self.vine_f = rng.uniform(280, 420), rng.random()
        self.counts = {}
        self.stack = None
        self.yard_plan = None
        self.reason = None
        backs = lot.get('backs', [])
        rears = sorted((w for w in backs if w['kind'] == 'rear' and w['width'] >= 300),
                       key=lambda w: (-w['width'], w['index']))
        self.main = rears[0] if rears else None
        bounds = []
        for polygon in lot.get('obstacles', []):
            xs, ys = [p[0] for p in polygon], [p[1] for p in polygon]
            bounds.append((polygon, min(xs), min(ys), max(xs), max(ys)))
        self.obstacle_bounds = bounds

    def count(self, key, n=1):
        self.counts[key] = self.counts.get(key, 0) + n

    def near(self, points, margin=0.):
        """Obstacle polygons whose bounds overlap the bounds of `points`."""
        bx0, by0 = min(p[0] for p in points) - margin, min(p[1] for p in points) - margin
        bx1, by1 = max(p[0] for p in points) + margin, max(p[1] for p in points) + margin
        return [poly for poly, a0, b0, a1, b1 in self.obstacle_bounds if a0 <= bx1 and a1 >= bx0 and b0 <= by1 and b1 >= by0]

    def blocked(self, point, near, occupancy):
        return any(_inside(point, poly) for poly in near) or occupancy.hit(point)

    # ------------------------------------------------------------------ planning
    def yard(self, wall):
        """Usable depth in front of a wall for collision structures, and whether a ruelle closes it."""
        clear = wall['clear']
        if wall['alley'] is not None:
            return min(clear - 20, wall['alley'] - TRAFFIC_CLEAR - 35), True
        if clear < 1990:
            return clear / 2 - 30, False        # back-to-back yards: stay on this side of the rear lot line
        return clear - 20, False

    def free(self, F, x0, x1, d0, d1, occupancy, roads=True):
        """No building or planned structure on a sample grid of the rectangle; roads at least 300 cm away."""
        corners = [F.p(x, d, 0)[:2] for x in (x0, x1) for d in (d0, d1)]
        bx0, by0 = min(p[0] for p in corners), min(p[1] for p in corners)
        bx1, by1 = max(p[0] for p in corners), max(p[1] for p in corners)
        near = self.near(corners)
        nx, nd = max(2, math.ceil((x1 - x0) / 45) + 1), max(2, math.ceil((d1 - d0) / 45) + 1)
        for i in range(nx):
            for j in range(nd):
                if self.blocked(F.p(x0 + (x1 - x0) * i / (nx - 1), d0 + (d1 - d0) * j / (nd - 1), 0)[:2], near, occupancy):
                    return False
        if roads:
            reach = TRAFFIC_CLEAR + 60
            segs = [(c, d) for c, d, _, _ in self.lot.get('roads_near', ())
                    if min(c[0], d[0]) - reach <= bx1 and max(c[0], d[0]) + reach >= bx0
                    and min(c[1], d[1]) - reach <= by1 and max(c[1], d[1]) + reach >= by0]
            if segs:
                # perimeter samples 40 cm apart: a sampled 320 cm guarantees the true 300 cm
                ring = []
                for (xa, da), (xb, db) in (((x0, d0), (x1, d0)), ((x1, d0), (x1, d1)), ((x1, d1), (x0, d1)), ((x0, d1), (x0, d0))):
                    steps = max(1, math.ceil(max(abs(xb - xa), abs(db - da)) / 40))
                    ring += [F.p(xa + (xb - xa) * s / steps, da + (db - da) * s / steps, 0)[:2] for s in range(steps)]
                if min(_nearest(p, c, d)[0] for p in ring for c, d in segs) < TRAFFIC_CLEAR + 20:
                    return False
        return True

    def _fit(self, kind, levels, yard, mw):
        z1 = self.floor_z[levels[0]]
        FH = self.lot['floor_height']
        room = mw - 12 - 12 - STAIR_W               # gallery length minus the landing or spiral end
        if kind == 'straight':
            need = 185. if len(levels) > 1 else 140.
            gd = min(max(self.depth, need), yard - D_FACE - 2 - STAIR_W)
            if gd < need:
                return None
            n1 = math.ceil(z1 / REAR_RISE)
            n2 = math.ceil(FH / REAR_RISE)
            going1 = min(GOING_MAX, room / (n1 - 1))
            going2 = min(GOING_MAX, room / (n2 - 1))
            if going1 < GOING_MIN or (len(levels) > 1 and going2 < GOING_MIN):
                return None
            return {'kind': kind, 'gd': gd, 'n1': n1, 'going1': going1, 'n2': n2, 'going2': going2,
                    'extent': D_FACE + gd + 2 + STAIR_W}
        # steel spiral at the end of the gallery, inside its depth: the shallow-yard answer
        need = 2 * SPIRAL_R + 12
        gd = min(max(self.depth, need), yard - D_FACE)
        if gd < need or mw - 12 - (2 * SPIRAL_R + 10) < 120:      # a door's width of deck beside the spiral
            return None
        return {'kind': kind, 'gd': gd, 'extent': D_FACE + gd}

    def plan_stack(self, occupancy):
        """Galleries on every upper floor of the main rear wall, with a stair from the yard to the top."""
        wall = self.main
        if wall is None:
            self.reason = 'no rear wall of 3 m or more'
            return
        levels = [k for k in range(1, self.lot['storeys']) if self.floor_z[k] + REAR_HEAD <= self.zt - 10]
        if not levels:
            self.reason = 'no upper floor below the wall top'
            return
        yard, lane = self.yard(wall)
        W = wall['width']
        modules = max(1, round(W / 763)) if W >= 1150 else 1
        mw = W / modules
        plan = None
        for kind in (('spiral', 'straight') if self.prefer_spiral else ('straight', 'spiral')):
            plan = self._fit(kind, levels, yard, mw)
            if plan:
                break
        if plan is None:
            self.reason = 'yard too shallow or lot too narrow for a gallery and stair'
            return
        F = Frame(None, wall['a'], wall['b'])
        plan.update({'levels': levels, 'modules': [], 'wall': wall, 'climb': self.climb, 'lane': lane})
        footprints = []
        for m in range(modules):
            mx0, mx1 = m * mw, (m + 1) * mw
            gx0, gx1 = mx0 + 6, mx1 - 6
            if not self.free(F, gx0, gx1, D_FACE, plan['extent'], occupancy):
                self.reason = 'a building, structure or traffic lane behind the wall'
                return
            module = {'mx0': mx0, 'mx1': mx1, 'gx0': gx0, 'gx1': gx1}
            if plan['kind'] == 'straight':
                module['xh'] = gx1 - 6 - STAIR_W
                module['deck_end'] = gx1
                module['xd'] = module['xh'] - 40
            else:
                module['xs'] = gx1 - 6 - SPIRAL_R
                module['deck_end'] = module['xs'] - SPIRAL_R - 4
                module['xd'] = module['deck_end'] - 60
            plan['modules'].append(module)
            footprints.append([F.p(x, d, 0)[:2] for x, d in ((gx0, 0), (gx1, 0), (gx1, plan['extent']), (gx0, plan['extent']))])
        top_z = self.floor_z[levels[-1]]
        roof = min(self.zt - 5, top_z + 265)
        plan['roof'] = roof if self.roofed and roof - 10 >= top_z + 215 else None
        for polygon in footprints:
            occupancy.add(polygon)
        self.stack = plan

    def fence_wall(self):
        if self.stack:
            return self.stack['wall']
        rears = sorted((w for w in self.lot.get('backs', []) if w['kind'] == 'rear' and w['width'] >= 200 and w['clear'] >= 250),
                       key=lambda w: (-w['width'], w['index']))
        return rears[0] if rears else None

    def plan_yard(self, occupancy, side_fences):
        """Fence toward the ruelle (or the rear lot line) with a gate, side fences, a shed or garage, plants."""
        wall = self.fence_wall()
        if wall is None:
            return
        extent = self.stack['extent'] if self.stack else D_FACE + 100
        if wall['alley'] is not None:
            fd, gate = wall['alley'] - FENCE_FROM_ALLEY, True
        elif wall['clear'] < 1990:
            fd, gate = wall['clear'] / 2, False
        else:
            return
        if fd < extent + 40:
            return
        F = Frame(None, wall['a'], wall['b'])
        a = wall['a']
        u, n = F.u, F.n
        local = [((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1], (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1])
                 for p in self.lot['points']]
        lx0, lx1 = min(x for x, _ in local), max(x for x, _ in local)
        if lx1 - lx0 < 250:
            return
        # free samples along the fence line (buildings, galleries and sheds already placed)
        step = 40.
        count = max(2, math.ceil((lx1 - lx0) / step) + 1)
        xs = [lx0 + (lx1 - lx0) * i / (count - 1) for i in range(count)]
        near = self.near([F.p(lx0, fd, 0), F.p(lx1, fd, 0)], 5)
        free = [not self.blocked(F.p(x, fd, 0)[:2], near, occupancy) for x in xs]
        runs, start = [], None
        for i, ok in enumerate(free + [False]):
            if ok and start is None:
                start = i
            elif not ok and start is not None:
                x0 = lx0 if start == 0 else xs[start] - step / 2
                x1 = lx1 if i == count else xs[i - 1] + step / 2
                if x1 - x0 >= 60:
                    runs.append((max(lx0, x0), min(lx1, x1)))
                start = None
        if not runs:
            return
        plan = {'wall': wall, 'fd': fd, 'lx': (lx0, lx1), 'runs': runs, 'gate': None, 'shed': None,
                'lane': wall['alley'] is not None, 'extent': extent, 'hedge': None, 'cedar': None}
        # gate near the stair foot, inside a free run
        if gate:
            if self.stack:
                module = self.stack['modules'][0]
                X = (lambda x: x) if self.stack['climb'] > 0 else (lambda x: module['mx0'] + module['mx1'] - x)
                want = X(module['xh'] - (self.stack['n1'] - 1) * self.stack['going1']) if self.stack['kind'] == 'straight' else X(module['xs'])
            else:
                want = (lx0 + lx1) / 2
            best = None
            for r0, r1 in runs:
                if r1 - r0 < 130:
                    continue
                gc = min(max(want, r0 + 60), r1 - 60)
                key = (abs(gc - want), gc)
                if best is None or key < best[0]:
                    best = (key, gc)
            if best:
                plan['gate'] = best[1]
        # shed (hangar) or garage against the fence, door on the lane, at the end away from the gate
        room = fd - extent - 40
        gc = plan['gate'] if plan['gate'] is not None else (lx0 + lx1) / 2
        far_right = gc < (lx0 + lx1) / 2
        if plan['lane'] and self.garage_roll < .1 and room >= 600 and lx1 - lx0 >= 480:
            kind, sw, sd = 'garage', 300., 560.
        elif self.shed_roll < .3 and room >= 200:
            kind, sw, sd = 'shed', self.shed_w, min(self.shed_d, room)
        else:
            kind = None
        if kind:
            sw = min(sw, lx1 - lx0 - 170)
            if sw >= 180:
                sx0, sx1 = (lx1 - 12 - sw, lx1 - 12) if far_right else (lx0 + 12, lx0 + 12 + sw)
                if self.free(F, sx0, sx1, fd - sd, fd - 3, occupancy, roads=False):
                    plan['shed'] = {'kind': kind, 'x': (sx0, sx1), 'd': (fd - sd, fd)}
                    occupancy.add([F.p(x, d, 0)[:2] for x, d in ((sx0, fd - sd), (sx1, fd - sd), (sx1, fd), (sx0, fd))])
        # cedar hedge along the side away from the shed, a small cedar in the larger yards
        shed_left = plan['shed'] is not None and plan['shed']['x'][0] < (lx0 + lx1) / 2
        if self.hedge_roll < .15 and fd - extent - 60 >= 200:
            hx = (lx1 - 66, lx1 - 6) if shed_left else (lx0 + 6, lx0 + 66)
            if self.free(F, hx[0], hx[1], extent + 20, fd - 20, occupancy, roads=False):
                plan['hedge'] = (hx, (extent + 20, fd - 20), 150 + 50 * self.vine_f)
                occupancy.add([F.p(x, d, 0)[:2] for x, d in ((hx[0], extent + 20), (hx[1], extent + 20), (hx[1], fd - 20), (hx[0], fd - 20))])
        if self.tree_roll < .15 and fd - extent >= 300 and lx1 - lx0 >= 400:
            tx = (lx0 + lx1) / 2 + (self.vine_f - .5) * (lx1 - lx0) * .3
            td = (extent + fd) / 2
            if self.free(F, tx - 75, tx + 75, td - 75, td + 75, occupancy, roads=False):
                plan['cedar'] = (tx, td)
                occupancy.add([F.p(x, d, 0)[:2] for x, d in ((tx - 75, td - 75), (tx + 75, td - 75), (tx + 75, td + 75), (tx - 75, td + 75))])
        # side fences on the lateral lot lines, from the house to the fence line (deduplicated across lots)
        for side, lx in ((0, lx0), (1, lx1)):
            ds = [d for x, d in local if abs(x - lx) < 40]
            d0 = max(0., max(ds) if ds else 0.) + D_FACE + 2
            if fd - d0 >= 150:
                side_fences.append({'lot': self.lot['id'], 'side': side, 'a': F.p(lx, d0, 0)[:2], 'b': F.p(lx, fd, 0)[:2],
                                    'height': self.fence_h, 'paint': self.fence_paint, 'rear': self})
        self.yard_plan = plan

    # ------------------------------------------------------------------ authoring
    def author(self, mesh):
        record = {'walls': [], 'galleries': 0, 'stair': None, 'flights': [], 'decks': [], 'fence': None,
                  'shed': None, 'reason': self.reason}
        for wall in self.lot.get('backs', []):
            if self.stack and wall is self.stack['wall']:
                self._author_stack_wall(mesh, wall, record)
            else:
                self._author_skin(mesh, wall, record)
        if self.yard_plan:
            self._author_yard(mesh, record)
        return record

    def _skin_faces(self, F, wall, base):
        """One opaque plane 16 cm proud of the retained wall (hiding its old glass cards), a concrete base,
        flashing on top, and returns at free ends."""
        W, zt = wall['width'], self.zt
        x_start = -D_FACE if wall['ext0'] else 0.
        x_end = W + D_FACE if wall['ext1'] else W
        if base > 0:
            F.quad_d('Stone', x_start, x_end, 0, base, D_FACE)
        F.quad_d(self.wall, x_start, x_end, base, zt, D_FACE)
        F.quad_z('Iron', x_start, x_end, 0, D_FACE, zt, 1)
        if not wall['ext0']:
            F.quad_x(self.wall, 0, 0, D_FACE, 0, zt, -1)
        if not wall['ext1']:
            F.quad_x(self.wall, W, 0, D_FACE, 0, zt, 1)

    def _window(self, F, x0, x1, z0, z1, rail=True):
        """Applied rear window: frame field, glass, meeting rail and a proud sill (the wall is not cut)."""
        F.quad_d(self.frame, x0, x1, z0, z1, D_FACE + 1)
        F.quad_d('Glass', x0 + 6, x1 - 6, z0 + 6, z1 - 6, D_FACE + 2.5)
        if rail:
            zm = (z0 + z1) / 2
            F.quad_d(self.frame, x0 + 6, x1 - 6, zm - 2.5, zm + 2.5, D_FACE + 3.5)
        F.box(self.sill, x0 - 5, x1 + 5, D_FACE - 1, D_FACE + 5, z0 - 5, z0, skip='kblr')
        self.count('windows')

    def _door(self, F, x0, x1, z0, z1):
        """Applied half-glazed back door with its frame and a sill."""
        F.quad_d(self.frame, x0, x1, z0, z1, D_FACE + 1)
        F.quad_d(self.door, x0 + 6, x1 - 6, z0, z1 - 6, D_FACE + 2.5)
        F.quad_d('Glass', x0 + 16, x1 - 16, z0 + 110, z1 - 22, D_FACE + 3.5)
        F.quad_z('Stone' if not self.siding else 'Trim', x0 - 4, x1 + 4, D_FACE - 1, D_FACE + 5, z0 + 1, 1)
        self.count('doors')

    def _author_skin(self, mesh, wall, record):
        """Rear, lane and street walls get a window per bay and floor; side walls a plain skin."""
        F = Frame(mesh, wall['a'], wall['b'])
        W = wall['width']
        windows = 0
        if wall['kind'] in ('lane', 'street') and W >= 250 or wall['kind'] == 'rear' and W >= 300:
            bays = max(1, min(3, int(W // 450))) if wall['kind'] != 'rear' else 1
            for k in range(self.lot['storeys']):
                z = self.floor_z[k]
                if z + REAR_HEAD > self.zt - 10:
                    break
                for i in range(bays):
                    c = (i + .5) * W / bays
                    self._window(F, c - REAR_WINDOW / 2, c + REAR_WINDOW / 2, z + 80, z + REAR_HEAD, rail=False)
                    windows += 1
        self._skin_faces(F, wall, self.lot['raise'] if wall['kind'] in ('lane', 'street') else 0.)
        self.count('skins_' + wall['kind'])
        record['walls'].append({'kind': wall['kind'], 'width_cm': round(W, 1), 'windows': windows, 'doors': 0,
                                'galleries': 0})

    def _author_stack_wall(self, mesh, wall, record):
        """The rear façade: per module a door column and one or two windows on each floor, galleries, stair."""
        st = self.stack
        F = Frame(mesh, wall['a'], wall['b'])
        W = wall['width']
        levels, c = st['levels'], st['climb']
        floors = [0] + levels
        windows = doors = 0
        for module in st['modules']:
            mx0, mx1 = module['mx0'], module['mx1']
            X = (lambda x: x) if c > 0 else (lambda x, s=mx0 + mx1: s - x)
            xd = module['xd']
            room0, room1 = mx0 + 30, xd - 43 - 30
            n = 2 if self.two_windows and mx1 - mx0 >= 640 else 1
            while n > 0 and room1 - room0 < n * REAR_WINDOW + (n - 1) * 40:
                n -= 1
            centres = [room0 + (i + .5) * (room1 - room0) / n for i in range(n)]
            for k in floors:
                z = self.floor_z[k]
                d0, d1 = sorted((X(xd - 43), X(xd + 43)))
                self._door(F, d0, d1, z, z + REAR_HEAD)
                doors += 1
                for cx in centres:
                    w0, w1 = sorted((X(cx - REAR_WINDOW / 2), X(cx + REAR_WINDOW / 2)))
                    self._window(F, w0, w1, z + 80, z + REAR_HEAD)
                    windows += 1
            self._stoop(F, c, mx0, mx1, xd)
            self._gallery_module(mesh, F, module, record)
        self._skin_faces(F, wall, self.lot['raise'])
        self.count('facades')
        record['stair'] = st['kind']
        record['walls'].append({'kind': 'rear', 'width_cm': round(W, 1), 'windows': windows, 'doors': doors,
                                'galleries': len(levels) * len(st['modules']), 'modules': len(st['modules'])})

    def _stoop(self, F, c, mx0, mx1, xd):
        """Concrete stoop and side steps at the ground-floor back door (module coordinates, mirrored when c < 0)."""
        raise_cm = self.lot['raise']
        if raise_cm < 25:
            return

        def box(mat, x0, x1, d0, d1, z0, z1, skip):
            if c < 0:
                skip = skip.translate(str.maketrans('lr', 'rl'))
                x0, x1 = mx0 + mx1 - x1, mx0 + mx1 - x0
            F.box(mat, x0, x1, d0, d1, z0, z1, skip)
        box('Stone', xd - 55, xd + 55, D_FACE - 2, D_FACE + 85, 0, raise_cm, 'kb')
        steps = max(0, round(raise_cm / 20) - 1)
        rise = raise_cm / (steps + 1)
        for j in range(1, steps + 1):
            x1 = xd - 55 - (j - 1) * 27
            if x1 - 27 < mx0 + 8:
                break
            box('Stone', x1 - 27, x1, D_FACE - 2, D_FACE + 85, 0, raise_cm - j * rise, 'kbr')
        self.count('stoops')

    def _gallery_module(self, mesh, F, module, record):
        st = self.stack
        c = st['climb']
        mx0, mx1, gx0, gx1 = module['mx0'], module['mx1'], module['gx0'], module['gx1']
        X = (lambda x: x) if c > 0 else (lambda x, s=mx0 + mx1: s - x)

        def span(x0, x1):
            a, b = X(x0), X(x1)
            return (a, b) if a <= b else (b, a)

        def box(mat, x0, x1, d0, d1, z0, z1, skip=''):
            if c < 0:
                skip = skip.translate(str.maketrans('lr', 'rl'))
            F.box(mat, *span(x0, x1), d0, d1, z0, z1, skip)

        def P(x, d, z):
            return F.p(X(x), d, z)

        paint = self.paint
        levels = st['levels']
        zs = [self.floor_z[k] for k in levels]
        gd = st['gd']
        dF = D_FACE + gd
        straight = st['kind'] == 'straight'
        bi = dF - 12 - STAIR_W
        if straight:
            xh = module['xh']
            n1, going1 = st['n1'], st['going1']
            n2, going2 = st['n2'], st['going2']
            run2 = (n2 - 1) * going2
            xo0, xo1 = xh - run2 - 2, xh - .3 * run2
        else:
            xs, ds = module['xs'], D_FACE + gd / 2
        deck_end = module['deck_end']
        # decks and guards
        for i, z in enumerate(zs):
            if straight and i > 0:
                box('Wood_Deck', gx0, gx1, D_FACE - 2, bi, z - 18, z, 'k')
                if xo0 - gx0 >= 20:
                    box('Wood_Deck', gx0, xo0, bi, dF, z - 18, z, 'k')
                box('Wood_Deck', xo1, gx1, bi, dF, z - 18, z, 'k')
                box(paint, max(gx0, xo0), xo1, bi - 4, bi, z + 12, z + GUARD_H, 'tblr')
                box(paint, xo1, xo1 + 4, bi, dF - 5, z + 12, z + GUARD_H, 'tfkb')
            else:
                box('Wood_Deck', gx0, deck_end, D_FACE - 2, dF, z - 18, z, 'k')
            corners = [P(gx0, D_FACE, z), P(deck_end, D_FACE, z), P(deck_end, dF, z), P(gx0, dF, z)]
            record['decks'].append({'z': round(z, 1), 'quad': [[round(p[0], 1), round(p[1], 1)] for p in corners]})
            gaps = [(xh - 2, gx1 + 1)] if straight and i == 0 else []
            for a0, a1 in _subtract((gx0, gx1), gaps):
                box(paint, a0, a1, dF - 5, dF - 1, z + 12, z + GUARD_H, 'tblr')
            box(paint, gx0, gx0 + 4, D_FACE, dF - 1, z + 12, z + GUARD_H, 'tfkb')
            box(paint, gx1 - 4, gx1, D_FACE, dF + 2 + STAIR_W if straight and i == 0 else dF - 1,
                z + 12, z + GUARD_H, 'tfkb')
            record['galleries'] += 1
            self.count('galleries')
        # posts from the yard; a module shares the post of its neighbour at the party line
        roof = st['roof']
        post_top = roof - 10 if roof else zs[-1] + GUARD_H
        for x in ([mx0 + 12] if mx0 < 1 else []) + [mx1 - 12]:
            F.box(paint, x - 5, x + 5, dF - 11, dF - 1, 0, post_top, 'b')
            self.count('posts')
        if roof:
            F.box(self.roof_mat, mx0 + 2, mx1 - 2, D_FACE - 2, dF + 12, roof - 10, roof, 'k')
            self.count('gallery_roofs')
        if straight:
            self._straight(mesh, F, box, P, xh, zs, dF, bi, n1, going1, n2, going2, record)
        else:
            self._spiral(mesh, F, P, c, xs, ds, zs, record)

    def _straight(self, mesh, F, box, P, xh, zs, dF, bi, n1, going1, n2, going2, record):
        paint = self.paint
        # flight 1: from the yard to the first gallery, outside the deck edge, landing at the deck end
        z1 = zs[0]
        rise1 = z1 / n1
        run1 = (n1 - 1) * going1
        e0, e1 = dF + 2, dF + 2 + STAIR_W
        for t in range(1, n1):
            xa = xh - (n1 - t) * going1 - 1.5
            xb = min(xh, xh - (n1 - 1 - t) * going1 + 1.5)
            box('Wood_Deck', xa, xb, e0 + 3, e1 - 3, t * rise1, t * rise1, 'kfblr')     # open tread: top face only
        box('Wood_Deck', xh, xh + STAIR_W, dF - 2, e1, z1 - 18, z1, 'k')
        for d in (e0 + 2.5, e1 - 2.5):
            beam(mesh, paint, P(xh - run1 - going1 * .6, d, 4), P(xh, d, z1 - 22), 5, 24, bottom=False)
        beam(mesh, paint, P(xh - run1, e1 - 3, rise1 + 88), P(xh, e1 - 3, z1 + 88), 5, 6, bottom=False)
        box(paint, xh, xh + STAIR_W, e1 - 4, e1, z1 + 12, z1 + GUARD_H, 'tblr')
        lx = xh + STAIR_W - 5
        box(paint, lx - 5, lx + 5, e1 - 10, e1, 0, z1 + GUARD_H, 'b')
        record['flights'].append({'kind': 'straight', 'z0': 0, 'z1': round(z1, 1), 'treads': n1 - 1,
                                  'foot': [round(v, 1) for v in P(xh - run1 + going1 / 2, (e0 + e1) / 2, rise1)],
                                  'head': [round(v, 1) for v in P(xh + STAIR_W / 2, (e0 + e1) / 2, z1)]})
        self.count('flights')
        # flights 2..: inside the deck front band, stacked in one plan, each through an opening in the deck above
        s0, s1 = bi, dF - 12
        run2 = (n2 - 1) * going2
        for za, zb in zip(zs, zs[1:]):
            rise2 = (zb - za) / n2
            for t in range(1, n2):
                xb = min(xh, xh - (t - 1) * going2 + 1.5)
                xa = xh - t * going2 - 1.5
                box('Wood_Deck', xa, xb, s0 + 3, s1 - 3, za + t * rise2, za + t * rise2, 'kfblr')
            for d in (s0 + 2.5, s1 - 2.5):
                beam(mesh, paint, P(xh + going2 * .5, d, za + 2), P(xh - run2, d, zb - 22), 5, 24, bottom=False)
            beam(mesh, paint, P(xh, s0 + 4, za + rise2 + 88), P(xh - run2, s0 + 4, zb + 88), 5, 6, bottom=False)
            record['flights'].append({'kind': 'straight', 'z0': round(za, 1), 'z1': round(zb, 1), 'treads': n2 - 1,
                                      'foot': [round(v, 1) for v in P(xh - going2 / 2, (s0 + s1) / 2, za + rise2)],
                                      'head': [round(v, 1) for v in P(xh - run2 - going2 / 2, (s0 + s1) / 2, zb)]})
            self.count('flights')
        self.count('stairs_straight')

    def _spiral(self, mesh, F, P, sx, xs, ds, zs, record):
        """Steel spiral in the end bay of the gallery: a full turn per storey, stepping off onto each deck.
        sx is -1 in a mirrored module (P mirrors points; facing vectors are mirrored here)."""
        exit_angle = math.pi              # toward the deck end
        delta = 2 * math.pi / SPIRAL_STEPS
        r0, R = 8., SPIRAL_R
        treads = []                       # (unwrapped angle, top z) bottom up; every deck level ends at exit_angle
        z_prev = 0.
        for k, z in enumerate(zs):
            n = math.ceil(z / 21.) if k == 0 else SPIRAL_STEPS
            rise = (z - z_prev) / n
            base_angle = exit_angle + 2 * math.pi * k
            treads += [(base_angle - (n - i) * delta, z_prev + i * rise) for i in range(1, n + 1)]
            z_prev = z
        for phi, z in treads:
            a0, a1 = phi - delta / 2 - .02, phi + delta / 2 + .02
            pts = [P(xs + r * math.cos(a), ds + r * math.sin(a), z) for r, a in ((r0, a0), (R, a0), (R, a1), (r0, a1))]
            mesh.face('Wood_Deck', pts, (0, 0, 1))
        top = zs[-1]
        centre = P(xs, ds, 0)
        cx = (centre[0] - F.a[0]) * F.u[0] + (centre[1] - F.a[1]) * F.u[1]
        F.box('Iron', cx - 5, cx + 5, ds - 5, ds + 5, 0, top + 100, 'b')
        first, last = treads[0][0] - delta, treads[-1][0]
        rise0 = treads[0][1]

        def z_at(phi):
            if phi <= treads[0][0]:
                return max(0., rise0 * (phi - first) / delta)
            for (p0, h0), (p1, h1) in zip(treads, treads[1:]):
                if p0 <= phi <= p1:
                    return h0 + (h1 - h0) * (phi - p0) / (p1 - p0)
            return treads[-1][1]
        third = 2 * math.pi / 3
        m = math.floor((first - exit_angle - third / 2) / third) + 1
        verts = [first]
        while exit_angle + third / 2 + m * third < last:
            verts.append(exit_angle + third / 2 + m * third)
            m += 1
        verts.append(last)

        def rail_point(phi, lift):
            return P(xs + (R - 4) * math.cos(phi), ds + (R - 4) * math.sin(phi), z_at(phi) + lift)
        for p0, p1 in zip(verts, verts[1:]):
            # the rail stays open where it passes the exit direction at a deck, so the deck can be reached
            k = math.floor((p1 + 1e-6 - exit_angle) / (2 * math.pi))
            crossing = exit_angle + k * 2 * math.pi
            if p0 < crossing <= p1 + 1e-6 and any(abs(z_at(crossing) - z) < 30 for z in zs):
                continue
            beam(mesh, 'Iron', rail_point(p0, 90), rail_point(p1, 90), 4, 4, bottom=False)
        for phi in verts[1:-1]:
            base = rail_point(phi, 0)
            card(mesh, 'Iron', base, (base[0], base[1], base[2] + 90), F.out(sx * math.cos(phi), math.sin(phi), 0)[:2], 1.2)
        start = 0.
        for z in zs:
            head = P(xs + (r0 + R) / 2 * math.cos(exit_angle), ds + (r0 + R) / 2 * math.sin(exit_angle), z)
            record['flights'].append({'kind': 'spiral', 'z0': round(start, 1), 'z1': round(z, 1), 'foot': None,
                                      'head': [round(v, 1) for v in head]})
            start = z
            self.count('flights')
        phi0 = treads[0][0]
        foot = P(xs + (r0 + R) / 2 * math.cos(phi0), ds + (r0 + R) / 2 * math.sin(phi0), treads[0][1])
        record['flights'][-len(zs)]['foot'] = [round(v, 1) for v in foot]
        self.count('stairs_spiral')

    def _author_yard(self, mesh, record):
        plan = self.yard_plan
        wall = plan['wall']
        F = Frame(mesh, wall['a'], wall['b'])
        fd, (lx0, lx1) = plan['fd'], plan['lx']
        cuts = []
        if plan['gate'] is not None:
            cuts.append((plan['gate'] - 50, plan['gate'] + 50))
        if plan['shed']:
            cuts.append(plan['shed']['x'])
        h = self.fence_h
        runs = []
        for r0, r1 in plan['runs']:
            runs += _subtract((r0, r1), cuts, 40)
        for x0, x1 in runs:
            F.box(self.fence_paint, x0, x1, fd - 1.5, fd + 1.5, 0, h, 'tblr')
            if self.fence_kind == 'slats':
                F.box('Wood_Grey', x0, x1, fd - 2.5, fd + 2.5, h, h + 4, 'blr')
            self.count('fence_runs')
        covered = sum(x1 - x0 for x0, x1 in runs)
        if plan['gate'] is not None:
            g = plan['gate']
            F.box(self.gate_paint, g - 47, g + 47, fd - 1.5, fd + 1.5, 4, h - 6, 'tblr')
            F.box(self.fence_paint if self.fence_kind == 'boards' else 'Wood_Grey', g - 55, g - 47, fd - 4, fd + 4, 0, h + 8, 'b')
            self.count('gates')
            covered += 100
        shed = plan['shed']
        if shed:
            self._shed(mesh, F, shed)
            covered += shed['x'][1] - shed['x'][0]
        # creeper on the lane side of the longest run
        if runs and self.vine_roll < .35:
            x0, x1 = max(runs, key=lambda r: (r[1] - r[0], r[0]))
            if x1 - x0 >= 160:
                w = min(x1 - x0 - 20, 140 + self.vine_f * 140)
                v0 = x0 + 10 + (x1 - x0 - 20 - w) * self.vine_f
                v1 = v0 + w
                p = F.p
                d = fd + 2.5
                blob = [p(v0 + 15, d, 15), p(v1 - 10, d, 10), p(v1 + 8, d, h * .55), p(v1 - 25, d, h + 22),
                        p(v0 + 35, d, h + 30), p(v0 - 8, d, h * .5)]
                mesh.face(self.vine_mat, blob, F.out(0, 1, 0))
                self.count('creepers')
        if plan['hedge']:
            (hx0, hx1), (hd0, hd1), hh = plan['hedge']
            F.box('Wood_Green', hx0, hx1, hd0, hd1, 0, hh, 'b')
            self.count('hedges')
        if plan['cedar']:
            tx, td = plan['cedar']
            base = F.p(tx, td, 0)
            apex = (base[0], base[1], self.tree_h)
            ring = [F.p(tx + 75 * math.cos(k * math.pi / 3), td + 75 * math.sin(k * math.pi / 3), 40) for k in range(6)]
            for k in range(6):
                q0, q1 = ring[k], ring[(k + 1) % 6]
                mesh.face('Wood_Green', [q0, q1, apex], ((q0[0] + q1[0]) / 2 - base[0], (q0[1] + q1[1]) / 2 - base[1], 40))
            self.count('cedars')
        span = lx1 - lx0
        record['fence'] = {'kind': self.fence_kind, 'lane': plan['lane'], 'gate': plan['gate'] is not None,
                           'height_cm': h, 'distance_cm': round(fd, 1), 'lot_width_cm': round(span, 1),
                           'covered_cm': round(min(covered, span), 1),
                           'line': [[round(v, 1) for v in F.p(lx0, fd, 0)[:2]], [round(v, 1) for v in F.p(lx1, fd, 0)[:2]]]}
        if shed:
            record['shed'] = shed['kind']

    def _shed(self, mesh, F, shed):
        (x0, x1), (d0, d1) = shed['x'], shed['d']
        garage = shed['kind'] == 'garage'
        hl, hy = (265., 245.) if garage else (250., 215.)
        mat = (self.wall if not self.siding else 'Wood_Grey') if garage else self.shed_mat
        p = F.p
        mesh.face(mat, [p(x0, d1, 0), p(x1, d1, 0), p(x1, d1, hl), p(x0, d1, hl)], F.out(0, 1, 0))
        mesh.face(mat, [p(x0, d0, 0), p(x1, d0, 0), p(x1, d0, hy), p(x0, d0, hy)], F.out(0, -1, 0))
        mesh.face(mat, [p(x0, d0, 0), p(x0, d1, 0), p(x0, d1, hl), p(x0, d0, hy)], F.out(-1, 0, 0))
        mesh.face(mat, [p(x1, d0, 0), p(x1, d1, 0), p(x1, d1, hl), p(x1, d0, hy)], F.out(1, 0, 0))
        mesh.face('Slate' if garage else 'Iron' if self.shed_mat != 'Iron' else 'Slate',
                  [p(x0, d0, hy), p(x1, d0, hy), p(x1, d1, hl), p(x0, d1, hl)], (0, 0, 1))
        xc = (x0 + x1) / 2
        dw = 120 if garage and x1 - x0 >= 250 else 45
        if garage:
            F.quad_d('Trim' if self.shed_door == 'Trim' else 'Wood_Grey', xc - dw, xc + dw, 0, 215, d1 + .8)
        else:
            F.quad_d(self.shed_door, xc - dw, xc + dw, 0, 195, d1 + .8)
        self.count('garages' if garage else 'sheds')


def build_rears(mesh, lots, tops):
    """Plan every lot's galleries first (so yards see their neighbours' structures), then fences, then author."""
    rears = [Rear(lot, tops[lot['id']]) for lot in lots]
    occupancy = Occupancy()
    for rear in rears:
        rear.plan_stack(occupancy)
    side_fences = []
    for rear in rears:
        rear.plan_yard(occupancy, side_fences)
    records, counts = {}, {}
    total_before = mesh.triangles()
    for rear in rears:
        before = mesh.triangles()
        record = rear.author(mesh)
        record['triangles'] = mesh.triangles() - before
        records[rear.lot['id']] = record
    # side fences: one per party line (the longer of two neighbours' candidates), cut around buildings and structures
    side_fences.sort(key=lambda f: (-math.dist(f['a'], f['b']), f['lot'], f['side']))
    kept = []
    for fence in side_fences:
        u = ((fence['b'][0] - fence['a'][0]) / math.dist(fence['a'], fence['b']),
             (fence['b'][1] - fence['a'][1]) / math.dist(fence['a'], fence['b']))
        duplicate = False
        for other in kept:
            v = other['u']
            if abs(u[0] * v[0] + u[1] * v[1]) > .95 and (_nearest(fence['a'], other['a'], other['b'])[0] < 60
                                                         and _nearest(fence['b'], other['a'], other['b'])[0] < 60
                                                         or math.dist(fence['a'], other['a']) < 100):
                duplicate = True
                break
        if not duplicate:
            fence['u'] = u
            kept.append(fence)
    side_count = 0
    for fence in sorted(kept, key=lambda f: (f['lot'], f['side'])):
        rear = fence['rear']
        a, b = fence['a'], fence['b']
        length = math.dist(a, b)
        steps = max(2, math.ceil(length / 40) + 1)
        near = rear.near([a, b], 5)
        pts = [(a[0] + (b[0] - a[0]) * i / (steps - 1), a[1] + (b[1] - a[1]) * i / (steps - 1)) for i in range(steps)]
        ok = [not rear.blocked(p, near, occupancy) for p in pts]
        start = None
        for i, flag in enumerate(ok + [False]):
            if flag and start is None:
                start = i
            elif not flag and start is not None:
                if i - 1 > start:
                    fence_panel(mesh, fence['paint'], pts[start], pts[i - 1], fence['height'])
                    side_count += 1
                start = None
        records[fence['lot']].setdefault('side_fences', 0)
        records[fence['lot']]['side_fences'] += 1
    for rear in rears:
        for key, value in rear.counts.items():
            counts[key] = counts.get(key, 0) + value
    counts['side_fence_runs'] = side_count
    counts['lots_with_rear_walls'] = sum(1 for r in records.values() if any(w['kind'] == 'rear' for w in r['walls']))
    counts['lots_with_galleries'] = sum(1 for r in records.values() if r['galleries'])
    counts['triangles'] = mesh.triangles() - total_before
    return records, counts


def build(lots, rear=False):
    """Fronts (and with rear=True the yard side of every lot). The default keeps the front-only fixtures."""
    mesh = PlexMesh()
    records, counts = [], {}
    tops = {}
    for lot in lots:
        kit = Kit(mesh, lot)
        before = mesh.triangles()
        record, top = author_front(mesh, lot, lot['primary'], kit, primary=True)
        skins = [(tuple(lot['primary']['a']), tuple(lot['primary']['b']))]
        if rear:
            # back walls get their own skin up to the extension top, so the extension band skips them
            skins += [(w['a'], w['b']) for w in lot.get('backs', ())]
        side_records = []
        for side in lot['sides']:
            side_lot = dict(lot, balconies=False, stair=None)
            side_kit = Kit(mesh, side_lot)
            side_kit.rng = random.Random(lot['seed'] + 99)
            srecord, stop = author_front(mesh, side_lot, side,
                                         side_kit, primary=False, top_override=None)
            side_records.append(srecord)
            skins.append((tuple(side['a']), tuple(side['b'])))
            top = max(top, stop)
            for key, value in side_kit.counts.items():
                counts['side_' + key] = counts.get('side_' + key, 0) + value
        extended = _extension(mesh, lot, top, skins)
        for key, value in kit.counts.items():
            counts[key] = counts.get(key, 0) + value
        records.append({
            'id': lot['id'], 'street': lot['primary']['street'], 'kind': lot['kind'], 'storeys': lot['storeys'],
            'storeys_source': lot['storeys_source'], 'year': lot['year'], 'era_source': lot['era_source'],
            'crown': lot['crown'], 'masonry': lot['masonry'], 'paint': lot['paint'], 'door': lot['door'],
            'frame': lot['frame'], 'stair': lot['stair'] if record['exterior_stairs'] else None,
            'commercial': lot['commercial'], 'corner': lot['corner'], 'raise_cm': lot['raise'],
            'floor_height_cm': lot['floor_height'], 'mass_height_cm': round(lot['height_cm'], 1),
            'front': record, 'sides': side_records, 'top_extension': bool(extended),
            'triangles': mesh.triangles() - before,
        })
        tops[lot['id']] = top
    if rear:
        rear_records, rear_counts = build_rears(mesh, lots, tops)
        for record in records:
            record['rear'] = rear_records[record['id']]
        for key, value in rear_counts.items():
            counts['rear_' + key] = value
    return mesh, records, counts


# ---------------------------------------------------------------------------------- batching
def batches(mesh, tile=TILE_CM, max_batches=MAX_BATCHES, cap=MAX_BATCH_TRIANGLES):
    """Group faces by material and grid tile; widen the tile in whole 47.5 m steps only when
    the batch cap needs it, then split any batch over `cap` triangles on the base grid."""
    source = []
    for material in sorted(mesh.groups):
        for face in mesh.groups[material]:
            cx = sum(p[0] for p in face) / len(face)
            cy = sum(p[1] for p in face) / len(face)
            source.append((material, face, cx, cy))
    for factor in range(1, 9):
        size = tile * factor
        buckets = {}
        for material, face, cx, cy in source:
            buckets.setdefault((material, math.floor(cx / size), math.floor(cy / size)), []).append((face, cx, cy))
        if len(buckets) <= max_batches:
            break
    output = {}
    def name(material, i, j, suffix=''):
        c = lambda v: ('M' if v < 0 else 'P') + f'{abs(v):03d}'
        return f'{material.replace("_", "")}_X{c(i)}_Y{c(j)}{suffix}'
    for (material, i, j), faces in sorted(buckets.items()):
        triangles = sum(len(f) - 2 for f, _, _ in faces)
        if triangles <= cap:
            output[name(material, i, j)] = (material, [f for f, _, _ in faces])
            continue
        parts = {}
        for f, cx, cy in faces:
            parts.setdefault((math.floor(cx / tile), math.floor(cy / tile)), []).append(f)
        for (si, sj), part in sorted(parts.items()):
            output[name(material, i, j, f'_S{si - i * factor:01d}{sj - j * factor:01d}')] = (material, part)
    return output, size


def _bounds(faces):
    return [round(min(p[i] for f in faces for p in f), 3) for i in range(3)] + \
           [round(max(p[i] for f in faces for p in f), 3) for i in range(3)]


def summary(records, skipped, lots):
    from collections import Counter
    kinds = Counter(r['kind'] for r in records)
    stairs = Counter(r['stair'] or 'none' for r in records)
    crowns = Counter(r['crown'] for r in records)
    storeys = Counter(str(r['storeys']) for r in records)
    sources = Counter(r['storeys_source'] for r in records)
    streets = Counter(r['street'] for r in records)
    masonry = Counter(r['masonry'] for r in records)
    return {
        'fronts': len(records),
        'corner_side_fronts': sum(len(r['sides']) for r in records),
        'types': dict(sorted(kinds.items())),
        'stairs': dict(sorted(stairs.items())),
        'crowns': dict(sorted(crowns.items())),
        'masonry': dict(sorted(masonry.items())),
        'commercial_ground_floors': sum(r['commercial'] for r in records),
        'storeys_histogram': dict(sorted(storeys.items())),
        'storeys_sources': dict(sorted(sources.items())),
        'era_sources': dict(sorted(Counter(r['era_source'] for r in records).items())),
        'streets_covered': dict(sorted(streets.items(), key=lambda kv: (-kv[1], kv[0]))),
        'skipped_buildings': len(skipped),
        'skipped_reasons': dict(sorted(Counter(skipped.values()).items())),
        'triangles_per_front': {'median': sorted(r['triangles'] for r in records)[len(records) // 2] if records else 0,
                                'max': max((r['triangles'] for r in records), default=0)},
    }


def prepare(directory=OUT, write=True):
    buildings, roads = geography()
    roll_data = json.loads(ROLL_JOIN.read_text()) if ROLL_JOIN.exists() else {'buildings': {}}
    _, shops = osm_points()
    skip = excluded_ids()
    plain = [b for b in buildings if str(b['id']) not in skip]
    lod2 = lod2_heights(plain)
    lots, skipped = select_fronts(buildings, roads, skip, roll_data['buildings'], lod2, shops)
    mesh, records, counts = build(lots, rear=True)
    groups, tile = batches(mesh)
    directory = Path(directory)
    manifest_batches = []
    for key in sorted(groups):
        material, faces = groups[key]
        manifest_batches.append({'file': key + '.obj', 'mesh': f'SM_{LAYER}_{key}', 'material': material,
                                 'collision': COLLISION.get(material, 'none'),
                                 'triangles': sum(len(f) - 2 for f in faces), 'bounds_cm': _bounds(faces)})
    total = sum(b['triangles'] for b in manifest_batches)
    assert total == mesh.triangles()
    assert total <= TRIANGLE_BUDGET, total
    assert all(b['triangles'] <= 65000 for b in manifest_batches)
    hashes = {}
    if write:
        directory.mkdir(parents=True, exist_ok=True)
        for old in directory.glob('*.obj'):
            old.unlink()
    for key, batch in zip(sorted(groups), manifest_batches):
        data = obj_text(f'SM_{LAYER}_{key}', groups[key][1]).encode()
        hashes[key + '.obj'] = batch['sha256'] = hashlib.sha256(data).hexdigest()
        if write:
            (directory / (key + '.obj')).write_bytes(data)
    sources = ['Data/LaFontaine/osm.xml', 'Data/CityBuildings/manifest.json', 'Data/Plateau/layout.json',
               'Data/Plateau/PerimeterGeometry/perimeter.json', GENERATOR]
    if ROLL_JOIN.exists():
        sources.append(str(ROLL_JOIN.relative_to(ROOT)))
    stats = summary(records, skipped, lots)
    manifest = {
        'layer': LAYER, 'generator': GENERATOR, 'frame': 'x east, y north, cm, z up',
        'batches': manifest_batches,
        'materials': {key: MATERIALS[key] for key in sorted({b['material'] for b in manifest_batches})},
        'counts': dict(sorted({**counts, 'fronts': len(records), 'corner_side_fronts': stats['corner_side_fronts'],
                               'batches': len(manifest_batches), 'triangles': total,
                               'top_extensions': sum(r['top_extension'] for r in records)}.items())),
        'batching': {'base_tile_cm': TILE_CM, 'tile_cm': tile, 'max_batches': MAX_BATCHES,
                     'max_batch_triangles': MAX_BATCH_TRIANGLES},
        'offsets_cm': {'glass_and_recess_back': D_BACK, 'masonry_face': D_FACE, 'osm_glass_cards': 3.0},
        'collision_note': "'complex' = use complex collision as simple on that batch (stair treads, stoops, "
                          'balcony decks), as the existing *_Collision batches do; skins are NoCollision.',
        'source_sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in sources},
        'geometry_sha256': hashes,
        'attribution': ['© OpenStreetMap contributors, ODbL 1.0',
                        'Ville de Montréal, données ouvertes (CC BY 4.0): Bâtiments 3D 2016 LOD2 heights; '
                        "Unités d'évaluation foncière (year built, storeys) joined by address"],
        'limits': 'Footprints, street edges, storeys and construction years are data-driven where available. '
                  'Brick colours, trim colours, door and window rhythm, stair shape and cornice details are '
                  'rule-and-seed estimates after the Plateau heritage sheets, not surveys of individual buildings.',
    }
    lots_out = {'layer': LAYER, 'fronts': records, 'skipped': dict(sorted(skipped.items()))}
    if write:
        (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
        (directory / 'summary.json').write_text(json.dumps(stats, ensure_ascii=False, indent=1) + '\n')
        (directory / 'fronts.json').write_text(json.dumps(lots_out, ensure_ascii=False, separators=(',', ':')) + '\n')
    return manifest, stats, lots_out, groups


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--join-roll':
        data = join_roll(sys.argv[2])
        OUT.mkdir(parents=True, exist_ok=True)
        ROLL_JOIN.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        print(len(data['buildings']), 'buildings joined ->', ROLL_JOIN.relative_to(ROOT))
    else:
        manifest, stats, _, _ = prepare()
        print(json.dumps({'counts': manifest['counts'], 'batching': manifest['batching'], 'summary': stats},
                         ensure_ascii=False, indent=1))
