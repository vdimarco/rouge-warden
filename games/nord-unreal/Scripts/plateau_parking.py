"""Curb parking slots for the Plateau replica: one row per legal curb space.

Stdlib only and deterministic: two runs write the same bytes. The preview draws the slots and the game fills
them at runtime (AQuebecParkedCars, Source/Quebec/QuebecParkedCars.cpp) from the generated header.

Inputs:
- the OSM snapshot and the traffic layout (Data/LaFontaine): the streets, their parking tags, the C++ traffic
  segments with RoadParkingSides and RoadParkingDirections (parking.json), hydrants, crossings, bus stops, lanes;
- the replica's Streets OBJs (git-ignored, from plateau_replica.py): the SM_Concrete_Collision tops at 17 to 25 cm
  are the curbs the C++ CurbParking finds, and the replica asphalt is the parking lane; and Streets/paint_marks.json,
  the crosswalks where the replica paints them (it moves a crossing up to 6 m out of the junction box);
- Streets/street_trees.json (curb extensions), Furniture and Soul placements with the Props footprints;
- the city's sign-pole inventory (STM bus stop signs) and its parking signs (Data/Plateau/Inventory/park_signs.json,
  read at the moment of plateau_park_signs.MOMENT: a side signed for parking takes cars, and a sign that bans them
  closes the curb its arrow covers);
- the side-job spots in Source/Quebec/QuebecJobRules.h (markers, doors, starts, drops and keep-clear points): no car
  stands on one;
- the drawn cycle tracks (OSM highway=cycleway): no car stands within TRACK_CLEAR of one. A side a track runs along
  parks where its tags or the city's signs allow it, against the concrete separator plateau_replica.py builds there
  (bike_paint.json, tracks).

Outputs: Data/Plateau/ReplicaGeometry/Streets/parked_cars.json and Source/Quebec/LaFontaineParking.h. The JSON's
counts.track_sides lists each side along a track that its tags or signs park: its cars, its separator metres, and
what kept cars off it.

Run from games/nord-unreal after plateau_replica.py:  python3 Scripts/plateau_parking.py
"""
import argparse
import glob
import hashlib
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_lafontaine import BOUNDS, DATA, ROAD_HIGHWAYS, ROOT, inside, road_width_cm, tags, xy  # noqa: E402
from prepare_car_parking import BIKE_AT_CURB, cycle_tracks, track_sides  # noqa: E402
import plateau_park_signs  # noqa: E402

GENERATOR = 'Scripts/plateau_parking.py'
REPLICA = ROOT / 'Data/Plateau/ReplicaGeometry'
STREETS = REPLICA / 'Streets'
OUT_JSON = STREETS / 'parked_cars.json'
OUT_HEADER = ROOT / 'Source/Quebec/LaFontaineParking.h'
SIGN_POLES = ROOT / 'Data/Plateau/Inventory/sign_poles.json'
BIKE_PAINT = STREETS / 'bike_paint.json'
PAINT_MARKS = STREETS / 'paint_marks.json'
JOB_RULES = ROOT / 'Source/Quebec/QuebecJobRules.h'
SOURCES = ('Data/LaFontaine/osm.xml', 'Data/LaFontaine/layout.json', 'Data/LaFontaine/parking.json',
           'Data/Plateau/ReplicaGeometry/Streets/manifest.json', 'Data/Plateau/ReplicaGeometry/Streets/street_trees.json',
           'Data/Plateau/ReplicaGeometry/Furniture/placements.json', 'Data/Plateau/ReplicaGeometry/Soul/placements.json',
           'Data/Plateau/ReplicaGeometry/Props/manifest.json', 'Data/Plateau/Inventory/sign_poles.json', GENERATOR,
           'Scripts/prepare_lafontaine.py', 'Data/Plateau/ReplicaGeometry/Streets/bike_paint.json',
           'Scripts/prepare_car_parking.py', 'Scripts/plateau_park_signs.py', 'Data/Plateau/Inventory/park_signs.json',
           'Source/Quebec/QuebecJobRules.h', 'Data/Plateau/ReplicaGeometry/Streets/paint_marks.json')
FRAME = 'x east, y north, cm, z up (the map frame; Unreal x and y alike)'

# The cars: the AQuebecCar fleet (Data/SeventiesCars). All three bodies are 466 cm long and 220 cm wide over the
# mirrors; the pivot stands 100.5 cm over the road once the car settles on its wheels.
CAR_LENGTH = 466.
CAR_HALF_W = 110.
PAINTS = 4                       # AQuebecCar::PaintStyle 0..3
BODIES = 3                       # AQuebecCar::BodyProfile 0..2 (fastback coupe, notchback sedan, long-roof wagon)
SPACES = (600., 625., 650.)      # centre to centre by length class: the coupe, the sedan and the wagon
BODY_SHARE = (.3, .4, .3)        # how often each body parks on the Plateau curbs
SPACE_JITTER = (-5., 35.)        # added to each space: people park a little loosely
CURB_GAP = (12., 30.)            # mirror to curb face
CURB_GAP_MIN = 5.                # ...or this little on a narrow street
YAW_JITTER = .8                  # degrees either way
VACANT = .03                     # a few free spaces: the curbs are parked solid in late October, not sealed
CAR_GAP = 40.                    # bumper to bumper, at least, where two curb runs meet
ROAD_Z = 7.                      # the replica asphalt top (plateau_replica.Z_ROAD)

# Curb finding, as QuebecGameplay.cpp CurbParking does it: march out from half the road width less a metre.
CURB_TOP = (17., 25.)            # the SM_Concrete_Collision top the runtime accepts
CURB_REACH = 1100.
CURB_STEP = 50.                  # curb samples along a run
CURB_SPREAD = 15.                # the curb under one car stays this straight
CURB_SPAN = 30.                  # and runs this far past both bumpers
RUN_TURN = 3.                    # a way splits into straight runs where it turns more than this (degrees)
RUN_SLACK = 15.                  # ...or where its nodes stray this far (cm) from the run's straight line
CANDIDATE_STEP = 20.

# Clearances (cm). Sources: Quebec Highway Safety Code art. 386 (5 m from an intersection or a crosswalk, as
# montreal.ca puts it), quebec.ca "Stopping a vehicle on a public road" (3 m from a fire hydrant, no stopping in a
# public transport zone or before a curb ramp). The bus zone length is a design value sized for a 12 m bus.
TRAFFIC_CLEAR = 300.             # no collision this near a C++ traffic centreline (the replica's 300 cm rule)
STREET_CLEAR = 200.              # nor this near any other street's centreline
OWN_LANE = 150.                  # a street off the traffic graph keeps a 3 m lane between its own parked cars
JUNCTION_CLEAR = 500.            # from the cross street's curb line, measured square to it
JUNCTION_REACH = 4000.           # junctions this near a car are checked
JUNCTION_LATERAL = 2500.         # ...when they lie this near its street's centre line
ARM_ANGLE = 25.                  # an arm this far off a car's own run is a cross street
CROSSING_CLEAR = 650.            # from a crosswalk's centre line: 5 m past its 1.5 m half width
PAINTED_CLEAR = 500.             # ...and from the paint itself, where the replica puts it (Streets/paint_marks.json)
LANE_BAND = 150.                 # a painted bike lane this far or more off the curb leaves the 2.3 m parking band
LANE_OVERHANG = 5.               # a mirror may reach this far over the lane's line
CROSSWALK_BAND = 315.            # a painted crosswalk in front of a corner: the replica sets it 1.65 m out, 3 m wide
PAINT_REACH = 2500.              # the replica paints a crossing this near a stop sign or traffic lights
HYDRANT_CLEAR = 300.
SERVICE_CLEAR = {'alley': 315., 'default': 250.}   # lane mouth or driveway centre line: half its width and 1 m
BUS_ZONE = (1500., 500.)         # before and after the stop, in the bus's direction of travel
BUS_REACH = 600.                 # a stop this near a curb serves it
TAXI_ZONE = 900.                 # a taxi stand keeps this much curb either side
EXTENSION_CLEAR = 50.
PROP_CLEAR = 30.
BOLLARD_CLEAR = 30.
ZONE_CLEAR = 50.                 # a chantier zone's fence
JOB_CLEAR = 150.                 # a side-job spot: its marker, door or start stays clear of every car
TRACK_CLEAR = 165.               # from a drawn cycle track's centre line: the replica paints its edge line here
LANE_CLEAR = 2 * OWN_LANE        # beside a track off the traffic graph, the lane across to the far curb or the cars
                                 # parked there (the track pulls the carriageway off the OSM centre line)
SLACK = .5                       # every clearance holds by this much more, so the rows' rounding cannot break it
ZONE_SLACK = 10.                 # ...and a stop zone by this much, for the car's own yaw jitter
SIGN_REACH = 1500.               # a parking-sign pole this near a street's centre line serves its curb
SIGNED_POLES = 2                 # a side with this many poles whose signs allow parking now takes cars
SIGN_SPAN_MAX = 20000.           # a sign's span stops at the next parking-sign pole or junction, and at this length
SIGN_NEXT = 50.                  # the next pole stands this far along, at least

PARK_YES = ('lane', 'street_side', 'on_street', 'half_on_kerb', 'yes', 'parallel', 'marked', 'on_kerb')
PARK_NO = ('no', 'no_parking', 'no_stopping', 'separate', 'fire_lane')
BUSWAY = ('share_busway', 'opposite_share_busway')
DRIVE = ('residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street')


# ---------------------------------------------------------------------------------------------------------------
# Small geometry

def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def unit(a, b):
    d = sub(b, a)
    length = math.hypot(*d)
    return (d[0] / length, d[1] / length), length


def seg_dist(p, a, b):
    d = sub(b, a)
    den = dot(d, d)
    t = 0. if den < 1e-9 else max(0., min(1., dot(sub(p, a), d) / den))
    return math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t)


def segments_cross(a, b, c, d):
    d1, d2 = cross(sub(b, a), sub(c, a)), cross(sub(b, a), sub(d, a))
    d3, d4 = cross(sub(d, c), sub(a, c)), cross(sub(d, c), sub(b, c))
    return d1 * d2 < 0 and d3 * d4 < 0


def crosses(a, b, c, d):
    """plateau_replica.segments_cross: a crossing way that ends on a street's centre line counts as crossing it."""
    d1, d2, d3, d4 = cross(sub(d, c), sub(a, c)), cross(sub(d, c), sub(b, c)), cross(sub(b, a), sub(c, a)), cross(sub(b, a), sub(d, a))
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def seg_seg_dist(a, b, c, d):
    if segments_cross(a, b, c, d):
        return 0.
    return min(seg_dist(a, c, d), seg_dist(b, c, d), seg_dist(c, a, b), seg_dist(d, a, b))


def in_poly(p, poly):
    inside_ = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < x1 + (p[1] - y1) * (x2 - x1) / (y2 - y1):
            inside_ = not inside_
    return inside_


def poly_seg_dist(poly, a, b):
    if in_poly(a, poly) or in_poly(b, poly):
        return 0.
    return min(seg_seg_dist(p, q, a, b) for p, q in zip(poly, poly[1:] + poly[:1]))


def poly_point_dist(poly, p):
    if in_poly(p, poly):
        return 0.
    return min(seg_dist(p, a, b) for a, b in zip(poly, poly[1:] + poly[:1]))


def poly_poly_dist(p1, p2):
    if any(in_poly(p, p2) for p in p1) or any(in_poly(p, p1) for p in p2):
        return 0.
    return min(seg_seg_dist(a, b, c, d) for a, b in zip(p1, p1[1:] + p1[:1]) for c, d in zip(p2, p2[1:] + p2[:1]))


def rect(c, yaw_deg, half_l, half_w):
    """The four corners of a box centred on c, its length along yaw."""
    yaw = math.radians(yaw_deg)
    u, n = (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw))
    return [(c[0] + u[0] * sx * half_l + n[0] * sy * half_w, c[1] + u[1] * sx * half_l + n[1] * sy * half_w)
            for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]


def footprint(slot):
    return rect((slot['x'], slot['y']), slot['yaw'], CAR_LENGTH / 2, CAR_HALF_W)


def bbox(points, pad=0.):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad


def in_tri(p, tri):
    (ax, ay), (bx, by), (cx, cy) = tri
    s1 = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)
    s2 = (cx - bx) * (p[1] - by) - (cy - by) * (p[0] - bx)
    s3 = (ax - cx) * (p[1] - cy) - (ay - cy) * (p[0] - cx)
    return (s1 >= 0 and s2 >= 0 and s3 >= 0) or (s1 <= 0 and s2 <= 0 and s3 <= 0)


class Grid:
    def __init__(self, cell):
        self.cell, self.cells = cell, {}

    def add(self, item, box):
        c = self.cell
        for gx in range(math.floor(box[0] / c), math.floor(box[2] / c) + 1):
            for gy in range(math.floor(box[1] / c), math.floor(box[3] / c) + 1):
                self.cells.setdefault((gx, gy), []).append(item)

    def query(self, box):
        c, seen, out = self.cell, set(), []
        for gx in range(math.floor(box[0] / c), math.floor(box[2] / c) + 1):
            for gy in range(math.floor(box[1] / c), math.floor(box[3] / c) + 1):
                for item in self.cells.get((gx, gy), ()):
                    if item not in seen:
                        seen.add(item)
                        out.append(item)
        return out


def seeded(*parts):
    """A deterministic number in [0, 1) for a key, the same on every machine and Python version."""
    digest = hashlib.sha256('|'.join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(digest[:8], 'big') / 2 ** 64


def sha_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# ---------------------------------------------------------------------------------------------------------------
# The replica's surfaces

class Surface:
    """Top faces of OBJ batches between two heights, as triangles in the map frame (the OBJs store -y)."""

    def __init__(self, pattern, zlo, zhi, cell=400.):
        self.tris, self.grid = [], Grid(cell)
        self.files = sorted(glob.glob(str(STREETS / pattern)))
        for name in self.files:
            verts = []
            for line in Path(name).read_text().splitlines():
                if line.startswith('v '):
                    x, y, z = map(float, line.split()[1:4])
                    verts.append((x, -y, z))
                elif line.startswith('f '):
                    pts = [verts[int(item.split('/')[0]) - 1] for item in line.split()[1:]]
                    if all(zlo <= p[2] <= zhi for p in pts):
                        for k in range(1, len(pts) - 1):
                            tri = [pts[0][:2], pts[k][:2], pts[k + 1][:2]]
                            if abs(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]))) > 1.:
                                self.grid.add(len(self.tris), bbox(tri))
                                self.tris.append(tri)

    def contains(self, p):
        return any(in_tri(p, self.tris[i]) for i in self.grid.query((p[0], p[1], p[0], p[1])))

    def ray(self, origin, direction, length):
        """The first distance along the ray that lies on a face, or None."""
        best = None
        step = self.grid.cell / 2
        k = 0
        while k * step <= length + step:
            if best is not None and best < k * step - self.grid.cell:
                break
            p = (origin[0] + direction[0] * k * step, origin[1] + direction[1] * k * step)
            for i in self.grid.query((p[0], p[1], p[0], p[1])):
                t = _tri_entry(origin, direction, self.tris[i], length)
                if t is not None and (best is None or t < best):
                    best = t
            k += 1
        return best


def _tri_entry(o, d, tri, length):
    if in_tri(o, tri):
        return 0.
    best = None
    for p, q in zip(tri, tri[1:] + tri[:1]):
        e = sub(q, p)
        den = cross(d, e)
        if abs(den) < 1e-9:
            continue
        w = sub(p, o)
        t, s = cross(w, e) / den, cross(w, d) / den
        if 0. <= s <= 1. and 0. <= t <= length and (best is None or t < best):
            best = t
    return best


def load_surfaces():
    curbs = Surface('Concrete_Collision_Replica_*.obj', *CURB_TOP)
    asphalt = Surface('Asphalt_Replica_X*.obj', 6.5, 7.5)
    if not curbs.files or not asphalt.files:
        raise SystemExit(f'No replica Streets OBJs under {STREETS.relative_to(ROOT)}: run Scripts/plateau_replica.py first '
                         '(the OBJs are git-ignored).')
    bollards = []
    for name in sorted(glob.glob(str(STREETS / 'Streets_bollard_green_*.obj'))):
        cells = set()
        for line in Path(name).read_text().splitlines():
            if line.startswith('v '):
                x, y, _ = map(float, line.split()[1:4])
                cells.add((round(x / 20.), round(-y / 20.)))
        bollards += [(gx * 20., gy * 20.) for gx, gy in sorted(cells)]
    return curbs, asphalt, bollards


# ---------------------------------------------------------------------------------------------------------------
# Streets and their parking sides

def bus_lane(t, side):
    """Whether a reserved bus lane runs at this side's curb at the moment the cars show
    (plateau_park_signs.MOMENT). A lane whose OSM conditional gives its hours (Papineau and Sherbrooke: weekday peaks
    only) is a parking lane outside them, as the city's signs on those curbs say (AV-DB, R-RA)."""
    cycle = t.get('cycleway:' + side, t.get('cycleway:both', t.get('cycleway', 'no')))
    if not (cycle in BUSWAY or t.get('busway:' + side) == 'lane' or t.get('busway:both') == 'lane'):
        return False
    oneway = t.get('oneway') in ('yes', '1', 'true', '-1')
    keys = ('lanes:psv:conditional',) if oneway else \
        ('lanes:psv:forward:conditional',) if side == 'right' else ('lanes:psv:backward:conditional',)
    conditions = [t[k] for k in keys if k in t]
    return not conditions or any(plateau_park_signs.condition_active(c) for c in conditions)


def side_parking(t, side, traffic_bit, painted=None, track=False, signed=False):
    """Whether a way's side ('left' or 'right', OSM sense) takes parked cars, and why.

    A reserved bus lane at the curb in its hours wins. Then an explicit parking tag for the side, or for both sides. A
    way that tags only its other side has none on this one. Along a drawn cycle track (track:
    prepare_car_parking.track_sides) the side parks only where its tag parks it or the city's signs do; the cars
    then stand against the track's separator, and TRACK_CLEAR keeps them off the track. Then the replica's painted
    bike lane (Streets/bike_paint.json): 'band' when it runs outside a 2.3 m parking band, so cars park between it
    and the curb, 'curb' when it runs along the curb. Otherwise the C++ RoadParkingSides bit decides on a traffic
    segment, and the same rule (prepare_car_parking.py) on the other streets. Where the tags or the bit leave the
    side bare, the city's signs win when SIGNED_POLES poles on it allow parking now (signed)."""
    other = 'left' if side == 'right' else 'right'
    cycle = t.get('cycleway:' + side, t.get('cycleway:both', t.get('cycleway', 'no')))
    if bus_lane(t, side):
        return False, 'bus lane'
    signs = (True, 'beside a track, city signs' if track else 'city signs')
    orientation = t.get(f'parking:{side}:orientation', t.get('parking:both:orientation', 'parallel'))
    for key in (f'parking:{side}', 'parking:both', f'parking:lane:{side}', 'parking:lane:both'):
        if key in t:
            value = t[key]
            if value in ('perpendicular', 'diagonal') or orientation != 'parallel':
                return False, 'not parallel'
            if value in PARK_YES:
                return True, 'beside a track' if track else 'tag'
            return signs if signed and painted != 'curb' else (False, 'bike track' if track else 'tag no')
    if any(k in t for k in (f'parking:{other}', f'parking:lane:{other}')):
        return signs if signed and painted != 'curb' else (False, 'bike track' if track else 'other side only')
    if track:
        return signs if signed else (False, 'bike track')
    if painted == 'band':
        return True, 'beside a bike lane'
    if painted == 'curb':
        return False, 'bike lane'
    if traffic_bit is not None:
        if traffic_bit:
            return True, 'traffic'
        return (True, 'city signs') if signed else (False, 'traffic')
    if cycle in BIKE_AT_CURB:
        return False, 'bike lane'
    return True, 'default'


def osm_direction(t):
    return -1 if t.get('oneway') == '-1' else 1 if t.get('oneway') in ('yes', '1', 'true') else 0


def district_box():
    lo, hi = xy(BOUNDS[0], BOUNDS[1]), xy(BOUNDS[2], BOUNDS[3])
    return lo[0], lo[1], hi[0], hi[1]


def clip(a, b, box):
    low, high = 0., 1.
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - box[0]), (dx, box[2] - a[0]), (-dy, a[1] - box[1]), (dy, box[3] - a[1])):
        if abs(p) < 1e-9:
            if q < 0:
                return None
        elif p < 0:
            low = max(low, q / p)
        else:
            high = min(high, q / p)
        if low > high:
            return None
    return (a[0] + dx * low, a[1] + dy * low), (a[0] + dx * high, a[1] + dy * high)


class City:
    """The OSM snapshot, the C++ traffic segments and the features the clearances read."""

    def __init__(self):
        root = ET.parse(DATA / 'osm.xml').getroot()
        self.latlon, self.nodes, self.node_tags = {}, {}, {}
        for e in root.iter('node'):
            lat, lon = float(e.get('lat')), float(e.get('lon'))
            self.latlon[e.get('id')] = (lat, lon)
            self.nodes[e.get('id')] = xy(lat, lon)
            t = tags(e)
            if t:
                self.node_tags[e.get('id')] = t
        self.ways = [{'id': w.get('id'), 'refs': [n.get('ref') for n in w.findall('nd') if n.get('ref') in self.nodes],
                      'tags': tags(w)} for w in root.iter('way')]
        layout = json.loads((DATA / 'layout.json').read_text())
        parking = json.loads((DATA / 'parking.json').read_text())
        self.traffic = [(tuple(a[:2]), tuple(b[:2])) for road in layout['roads'] for a, b in zip(road, road[1:])]
        self.traffic_grid = Grid(2000.)
        for i, (a, b) in enumerate(self.traffic):
            self.traffic_grid.add(i, bbox([a, b], TRAFFIC_CLEAR + 300))
        self.sides, self.directions = parking['sides'], parking['directions']
        assert len(self.sides) == len(self.directions) == len(self.traffic), 'parking.json does not match layout.json'
        self.box = district_box()
        # The replica's painted bike lanes: the curb-side line's offset from the centre line, per way side.
        self.bike_lanes = {}
        if BIKE_PAINT.is_file():
            for row in json.loads(BIKE_PAINT.read_text())['ways']:
                if row['kind'] == 'lane' and row['segments']:
                    self.bike_lanes[(row['way'], row['side'])] = max(abs(seg[1]) for seg in row['segments'])
        self._streets(layout)
        self._junctions()
        self.tracks = cycle_tracks([(w['tags'], [self.nodes[r] for r in w['refs']]) for w in self.ways
                                    if w['tags'].get('highway') == 'cycleway'])
        self.track_grid = Grid(2000.)
        for k, (a, b) in enumerate(self.tracks):
            self.track_grid.add(k, bbox([a, b], TRACK_CLEAR + 300))
        # The replica's separators beside the tracks, per way side ((way, +1 left or -1 right) -> row).
        self.track_rows = {}
        if BIKE_PAINT.is_file():
            for row in json.loads(BIKE_PAINT.read_text()).get('tracks', ()):
                self.track_rows[(row['way'], 1 if row['side'] == 'L' else -1)] = row
        self.signs = ParkSigns(self)

    def track_sides(self, street, seg):
        """The sides (+1 left, -1 right) of a segment along which a drawn cycle track runs, for a way tagged
        cycleway=separate (prepare_car_parking.track_sides, the rule of the C++ RoadParkingSides)."""
        t = street['tags']
        if 'separate' not in {t.get('cycleway:right'), t.get('cycleway:left'), t.get('cycleway:both'), t.get('cycleway')}:
            return set()
        return {1 if name == 'left' else -1 for name in track_sides(seg['a'], seg['b'], self.tracks)}

    def _streets(self, layout):
        """Drive ways clipped to the replica box, with each segment's C++ traffic index where it has one. The
        traffic roads are the ways prepare_lafontaine.py keeps (wholly inside the box), in OSM order."""
        roads, first = [], 0
        self.streets, self.service = [], []
        for w in self.ways:
            t, refs = w['tags'], w['refs']
            if len(refs) < 2:
                continue
            hw = t.get('highway')
            pts = [self.nodes[r] for r in refs]
            traffic = hw in ROAD_HIGHWAYS and all(inside(self.latlon[r]) for r in refs)
            index = None
            if traffic:
                roads.append([list(p) for p in pts])
                index = first
                first += len(pts) - 1
            if hw == 'service' or (hw not in DRIVE and hw not in ('service',)):
                if hw == 'service':
                    self.service.append({'id': w['id'], 'tags': t, 'points': pts, 'traffic': index})
                continue
            segs = []
            for k, (a, b) in enumerate(zip(pts, pts[1:])):
                part = clip(a, b, self.box)
                if part is None or math.dist(*part) < 50.:
                    continue
                segs.append({'a': part[0], 'b': part[1], 'na': refs[k], 'nb': refs[k + 1],
                             'traffic': index + k if index is not None else None})
            if segs:
                self.streets.append({'id': w['id'], 'tags': t, 'name': t.get('name', ''), 'segs': segs,
                                     'width': road_width_cm(t), 'traffic': traffic, 'refs': refs})
        assert roads == layout['roads'], 'OSM road order differs from Data/LaFontaine/layout.json'
        self.street_grid = Grid(2000.)
        for si, s in enumerate(self.streets):
            for g in s['segs']:
                self.street_grid.add(si, bbox([g['a'], g['b']], STREET_CLEAR + 300))
        self.service_grid = Grid(2000.)
        for k, s in enumerate(self.service):
            self.service_grid.add(k, bbox(s['points'], 500))

    def _junctions(self):
        """Every node where streets meet, or where a street turns a corner. Each arm points away from the node.
        Lanes and driveways are not junctions: their mouths keep the driveway clearance instead."""
        arms = {}
        for item in self.streets:
            for g in item['segs']:
                for node, here, there in ((g['na'], g['a'], g['b']), (g['nb'], g['b'], g['a'])):
                    if math.dist(here, self.nodes[node]) < 1.:
                        arms.setdefault(node, []).append({'item': item, 'u': unit(here, there)[0]})
        self.junctions = []
        for node, items in sorted(arms.items()):
            if len(items) < 2:
                continue
            turn = any(abs(cross(a['u'], b['u'])) > math.sin(math.radians(ARM_ANGLE))
                       for i, a in enumerate(items) for b in items[i + 1:])
            if len(items) < 3 and not turn:
                continue
            self.junctions.append({'node': node, 'p': self.nodes[node], 'arms': items})
        self.junction_grid = Grid(3000.)
        for k, j in enumerate(self.junctions):
            self.junction_grid.add(k, bbox([j['p']], JUNCTION_REACH))


class ParkSigns:
    """The city's parking-sign poles by the replica streets (plateau_park_signs), each on the nearest street
    segment within SIGN_REACH and on its side: how many poles on each way side allow parking now (signed), and the
    stretches of curb the bans cover (spans). A ban covers the curb from its pole the way its arrow points, or both
    ways without an arrow, up to the next parking-sign pole on the same curb or the next junction. Where a ban
    without an arrow meets a pole whose arrowed sign allows parking back toward it, the arrow wins: that stretch
    is the arrowed sign's zone, and the ban keeps only the spot at its own pole."""

    def __init__(self, city):
        self.poles, self.signed, self.spans = [], {}, []
        for pole in plateau_park_signs.load():
            if pole['off_street']:
                continue
            best = None
            for si in city.street_grid.query(bbox([pole['p']], SIGN_REACH)):
                street = city.streets[si]
                for g in street['segs']:
                    d = seg_dist(pole['p'], g['a'], g['b'])
                    if d < SIGN_REACH and (best is None or d < best[0]):
                        best = (d, street, g)
            if best is None:
                continue
            _, street, g = best
            u = unit(g['a'], g['b'])[0]
            side = 1 if cross(u, sub(pole['p'], g['a'])) > 0 else -1
            foot = (g['a'][0] + u[0] * dot(sub(pole['p'], g['a']), u), g['a'][1] + u[1] * dot(sub(pole['p'], g['a']), u))
            self.poles.append({'id': pole['id'], 'p': pole['p'], 'foot': foot, 'u': u, 'side': side,
                               'n': (-u[1] * side, u[0] * side), 'street': street, 'name': street['name'] or street['id'],
                               'way': street['id'], 'signs': pole['signs']})
        for pole in self.poles:
            if any(g['rule'] == 'allow' for g in pole['signs']):
                key = (pole['way'], pole['side'])
                self.signed[key] = self.signed.get(key, 0) + 1
        seen = set()
        for pole in self.poles:
            for g in pole['signs']:
                if g['rule'] != 'ban':
                    continue
                arrowed = plateau_park_signs.arrow_directions(g['arrow'], pole['side'])
                for k in arrowed or (1, -1):
                    if (pole['id'], k) in seen:
                        continue
                    seen.add((pole['id'], k))
                    d = (pole['u'][0] * k, pole['u'][1] * k)
                    length, after = self.reach(city, pole, d)
                    if not arrowed and after is not None and self.allows_toward(after, pole):
                        length = 0.
                    self.spans.append({'pole': pole['id'], 'code': g['code'], 'arrow': g['arrow'], 'origin': pole['foot'],
                                       'd': d, 'n': pole['n'], 'name': pole['name'], 'way': pole['way'],
                                       'side': pole['side'], 'length': length})
        self.span_grid = Grid(2000.)
        for k, span in enumerate(self.spans):
            o, d, length = span['origin'], span['d'], span['length']
            self.span_grid.add(k, bbox([o, (o[0] + d[0] * length, o[1] + d[1] * length)], SIGN_REACH + CAR_LENGTH))

    def reach(self, city, pole, d):
        """How far along d from the pole its sign covers the curb: to the next parking-sign pole on the same street
        and curb, or to the next junction on the street, at most SIGN_SPAN_MAX. Also the next pole, when the span
        ends there."""
        best, after = SIGN_SPAN_MAX, None
        for other in self.poles:
            if other is pole or other['name'] != pole['name']:
                continue
            rel = sub(other['p'], pole['foot'])
            lateral = dot(rel, pole['n'])
            along = dot(rel, d)
            if 0. < lateral < SIGN_REACH and SIGN_NEXT < along < best:
                best, after = along, other
        for j in city.junctions:
            rel = sub(j['p'], pole['foot'])
            along = dot(rel, d)
            if 0. < along < best and abs(cross(d, rel)) < SIGN_REACH and \
                    any(arm['item']['name'] == pole['street']['name'] or arm['item'] is pole['street'] for arm in j['arms']):
                best, after = along, None
        return best, after

    @staticmethod
    def allows_toward(pole, target):
        """Whether one of the pole's arrowed signs allows parking now toward the target pole."""
        for g in pole['signs']:
            dirs = plateau_park_signs.arrow_directions(g['arrow'], pole['side'])
            if g['rule'] == 'allow' and dirs and \
                    any(dot(sub(target['p'], pole['p']), (pole['u'][0] * k, pole['u'][1] * k)) > 0. for k in dirs):
                return True
        return False

    def ban_at(self, street, centre):
        """The span of a ban that covers a car centred here on this street, or None."""
        name = street['name'] or street['id']
        for k in self.span_grid.query(bbox([centre])):
            span = self.spans[k]
            if span['name'] != name:
                continue
            rel = sub(centre, span['origin'])
            lateral, along = dot(rel, span['n']), dot(rel, span['d'])
            if 0. < lateral < SIGN_REACH and along + CAR_LENGTH / 2 > 0. and along - CAR_LENGTH / 2 < span['length']:
                return span
        return None


# ---------------------------------------------------------------------------------------------------------------
# Features that close a stretch of curb

class Features:
    def __init__(self, city, curbs):
        self.city, self.curbs = city, curbs
        furniture = json.loads((REPLICA / 'Furniture/placements.json').read_text())['placements']
        soul = json.loads((REPLICA / 'Soul/placements.json').read_text())['placements']
        props = json.loads((REPLICA / 'Props/manifest.json').read_text())['props']
        self.hydrants = [tuple(r['position'][:2]) for r in furniture if r['prop'] == 'hydrant']
        self.hydrant_grid = Grid(1000.)
        for k, p in enumerate(self.hydrants):
            self.hydrant_grid.add(k, bbox([p], HYDRANT_CLEAR))
        # The side jobs' markers, doors and starts: their goal discs and columns stand on the ground there.
        self.jobs, self.job_grid = job_spots(), Grid(1000.)
        for k, (_, p) in enumerate(self.jobs):
            self.job_grid.add(k, bbox([p], JOB_CLEAR))
        # Every placed prop keeps its footprint: BIXI docks and bikes in the parking lane, bins and signs at the curb.
        # Their colliders stand on the ground; a lamp's arm or a pole's crossarm over the lane does not count.
        self.props, self.prop_grid = [], Grid(1000.)
        for r in furniture + soul:
            info = props.get(r['prop'], {})
            boxes = info.get('colliders_cm')
            if not boxes and info.get('bounds_cm'):
                b = info['bounds_cm']
                boxes = [{'center': [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, 0.], 'size': [b[3] - b[0], b[4] - b[1], 0.]}]
            s = r.get('scale', 1.)
            yaw = math.radians(r['yaw'])
            for box in boxes or ():
                c = (box['center'][0] * s, box['center'][1] * s)
                centre = (r['position'][0] + c[0] * math.cos(yaw) - c[1] * math.sin(yaw),
                          r['position'][1] + c[0] * math.sin(yaw) + c[1] * math.cos(yaw))
                poly = rect(centre, r['yaw'], box['size'][0] * s / 2, box['size'][1] * s / 2)
                # A prop on the sidewalk or in a yard only must not stand where a car would; one on the road keeps
                # PROP_CLEAR (a car's mirrors pass over a bin at the curb, not over a BIXI dock in the lane).
                clear = 0. if r.get('ground') in ('sidewalk', 'yard', 'alley') else PROP_CLEAR
                self.prop_grid.add(len(self.props), bbox(poly, clear))
                self.props.append({'prop': r['prop'], 'poly': poly, 'clear': clear})
        # A chantier is fenced: its barriers and cones close the curb between them.
        zones = {}
        for r in soul:
            if r.get('zone') and r['prop'] in ('barrier_chantier', 'cone'):
                zones.setdefault(r['zone'], []).append(tuple(r['position'][:2]))
        self.zones = [hull(points) for _, points in sorted(zones.items())]
        trees = json.loads((STREETS / 'street_trees.json').read_text())
        self.extensions = []
        for e in trees['extensions']:
            (c0, c1), n = [tuple(p) for p in e['curb']], tuple(e['road_normal'])
            u, length = unit(c0, c1)
            reach = e['depth_cm']
            a0, a1 = (c0[0] - u[0] * 90, c0[1] - u[1] * 90), (c1[0] + u[0] * 90, c1[1] + u[1] * 90)
            self.extensions.append([a0, a1, (a1[0] + n[0] * reach, a1[1] + n[1] * reach),
                                    (a0[0] + n[0] * reach, a0[1] + n[1] * reach)])
        self.extension_grid = Grid(2000.)
        for k, poly in enumerate(self.extensions):
            self.extension_grid.add(k, bbox(poly, EXTENSION_CLEAR))
        self._crossings()
        self._stops()

    def _crossings(self):
        """The crosswalks the replica paints: OSM crossing ways across a street, painted when they are signalled,
        marked or uncontrolled, or within 25 m of a stop sign (plateau_replica.crossing_records). An unmarked
        crossing has no paint and keeps only the intersection rule. Each junction notes the streets that get a
        painted crosswalk at it, from those ways, a stop sign or traffic lights within 25 m."""
        city = self.city
        signals = [city.nodes[n] for n, t in sorted(city.node_tags.items()) if t.get('highway') == 'traffic_signals']
        self.stop_nodes = {n for n, t in city.node_tags.items() if t.get('highway') == 'stop'}
        stops = [city.nodes[n] for n in sorted(self.stop_nodes)]
        lines = []
        for w in city.ways:
            t = w['tags']
            if t.get('footway') != 'crossing' and t.get('highway') != 'crossing':
                continue
            c, m = t.get('crossing', ''), t.get('crossing:markings', '')
            pts = [city.nodes[r] for r in w['refs']]
            for a, b in zip(pts, pts[1:]):
                crossed = [si for si in city.street_grid.query(bbox([a, b]))
                           if any(crosses(a, b, g['a'], g['b']) for g in city.streets[si]['segs'])]
                if not crossed:
                    continue
                mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                painted = c in ('traffic_signals', 'uncontrolled', 'marked', 'zebra') or \
                    m in ('yes', 'zebra', 'lines') or any(math.dist(mid, q) < PAINT_REACH for q in signals + stops)
                if painted:
                    lines.append({'a': a, 'b': b, 'streets': {city.streets[si]['id'] for si in crossed}})
        self.crossings, self.crossing_grid = [(r['a'], r['b']) for r in lines], Grid(2000.)
        for k, (a, b) in enumerate(self.crossings):
            self.crossing_grid.add(k, bbox([a, b], CROSSING_CLEAR))
        # The replica keeps a crosswalk's 3 m band out of the junction box, so its paint can lie up to 6 m from the
        # OSM way; and it paints a crosswalk at a stop or at traffic lights where none is mapped.
        if not PAINT_MARKS.is_file():
            raise SystemExit(f'No {PAINT_MARKS.relative_to(ROOT)}: run Scripts/plateau_replica.py first.')
        marks = json.loads(PAINT_MARKS.read_text())
        self.painted = [[tuple(p) for p in row['outline']] for row in marks['crosswalks']]
        self.painted_grid = Grid(2000.)
        for k, poly in enumerate(self.painted):
            self.painted_grid.add(k, bbox(poly, PAINTED_CLEAR))
        for j in city.junctions:
            painted = set()
            near_signal = any(math.dist(j['p'], q) < PAINT_REACH for q in signals)
            for arm in j['arms']:
                way = arm['item']['id']
                if near_signal or any(way in r['streets'] and min(math.dist(j['p'], r['a']), math.dist(j['p'], r['b']),
                                                                  seg_dist(j['p'], r['a'], r['b'])) < PAINT_REACH
                                      for r in lines) or \
                        any(n in self.stop_nodes and math.dist(city.nodes[n], j['p']) < PAINT_REACH
                            for n in arm['item']['refs']):
                    painted.add(way)
            j['painted'] = painted

    def _stops(self):
        """Bus stops (OSM and the city's STM signs, merged within 15 m) and taxi stands."""
        city = self.city
        stops = [city.nodes[n] for n, t in sorted(city.node_tags.items())
                 if t.get('highway') == 'bus_stop' and inside(city.latlon[n])]
        poles = json.loads(SIGN_POLES.read_text())['poles']
        for pole in poles:
            if any(s.get('DESCRIPTION_CAT') == 'STM' for s in pole.get('signs', [])):
                p = xy(float(pole['LATITUDE']), float(pole['LONGITUDE']))
                if all(math.dist(p, q) > 1500 for q in stops):
                    stops.append(p)
        self.bus_stops = stops
        self.taxis = [city.nodes[n] for n, t in sorted(city.node_tags.items())
                      if t.get('amenity') == 'taxi' and inside(city.latlon[n])]


def job_spots(path=JOB_RULES):
    """Every FJobSpot in QuebecJobRules.h, as (name, (x, y)): the job markers, the café and the delivery doors, the
    thief's start, the goons' arena and spawns, the police garage, the poster boards, the fare's drop and the
    keep-clear points. The header uses the game frame, x east and y north in cm, as the slots do."""
    text = Path(path).read_text()
    number = r'(-?\d+(?:\.\d*)?)'
    out = []
    for match in re.finditer(r'FJobSpot\s+(\w+)\s*(\[\w*\])?\s*=\s*\{(.*?)\};', text, re.S):
        name, table, body = match.groups()
        rows = re.findall(r'\{\s*' + number + r'\s*,\s*' + number + r'\s*,\s*' + number + r'\s*\}', body) if table else \
            [re.fullmatch(r'\s*' + number + r'\s*,\s*' + number + r'\s*,\s*' + number + r'\s*', body).groups()]
        out += [(f'{name}[{k}]' if table else name, (float(x), float(y))) for k, (x, y, _) in enumerate(rows)]
    assert len(out) >= 40, f'{path}: expected the side-job spots, found {len(out)}'
    return out


def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and cross(sub(out[-1], out[-2]), sub(p, out[-2])) <= 0:
                out.pop()
            out.append(p)
        return out
    lower, upper = half(pts), half(pts[::-1])
    return lower[:-1] + upper[:-1]


# ---------------------------------------------------------------------------------------------------------------
# Slots

class Run:
    """A straight stretch of a street's centre line, with the parking side and the cars' facing."""

    def __init__(self, street, a, b, side, direction, segs):
        self.street, self.a, self.b, self.side = street, a, b, side
        self.u, self.len = unit(a, b)
        self.n = (-self.u[1] * side, self.u[0] * side)          # toward this side's curb
        self.direction, self.segs = direction, segs
        facing = direction if direction else side
        self.yaw = math.degrees(math.atan2(self.u[1] * facing, self.u[0] * facing))

    def point(self, along, lateral):
        return (self.a[0] + self.u[0] * along + self.n[0] * lateral, self.a[1] + self.u[1] * along + self.n[1] * lateral)


def runs_for(city, curbs):
    """Straight runs per street side where the side takes parked cars. A run breaks where the way turns, or where
    the side rule or the direction changes between segments."""
    out, reasons = [], {}
    for s in city.streets:
        t = s['tags']
        for side, name, bit in ((1, 'left', 2), (-1, 'right', 1)):
            groups = []
            lane = city.bike_lanes.get((s['id'], 'L' if side > 0 else 'R'))
            for g in s['segs']:
                k = g['traffic']
                painted = painted_lane(s, g, side, lane, curbs) if lane is not None else None
                track = side in city.track_sides(s, g)
                ok, why = side_parking(t, name, (city.sides[k] & bit) if k is not None else None, painted, track,
                                       city.signs.signed.get((s['id'], side), 0) >= SIGNED_POLES)
                reasons[why] = reasons.get(why, 0) + 1
                direction = city.directions[k] if k is not None else osm_direction(t)
                u = unit(g['a'], g['b'])[0]
                band = lane if painted == 'band' else None
                if not ok:
                    groups.append(None)
                    continue
                last = groups[-1] if groups else None
                if last is not None and last['direction'] == direction and last['lane'] == band and \
                        last['track'] == track and math.dist(last['b'], g['a']) < 1. and \
                        dot(last['u'], u) > math.cos(math.radians(RUN_TURN)) and \
                        straight(last['a'], [h['b'] for h in last['segs']] + [g['b']]):
                    last['b'] = g['b']
                    last['segs'].append(g)
                else:
                    groups.append({'a': g['a'], 'b': g['b'], 'u': u, 'direction': direction, 'segs': [g], 'lane': band,
                                   'track': track})
            for grp in groups:
                if grp and math.dist(grp['a'], grp['b']) >= CAR_LENGTH + 2 * CURB_SPAN:
                    run = Run(s, grp['a'], grp['b'], side, grp['direction'], grp['segs'])
                    run.lane, run.track = grp['lane'], grp['track']
                    out.append(run)
    return out, reasons


def painted_lane(street, seg, side, lane, curbs):
    """'band' when the side's painted bike lane leaves a parking band at the curb, 'curb' when it runs along it."""
    u, length = unit(seg['a'], seg['b'])
    n = (-u[1] * side, u[0] * side)
    start = max(0., street['width'] / 2 - 100.)
    mid = (seg['a'][0] + u[0] * length / 2 + n[0] * start, seg['a'][1] + u[1] * length / 2 + n[1] * start)
    t = curbs.ray(mid, n, CURB_REACH)
    return 'band' if t is not None and start + t - lane >= LANE_BAND else 'curb'


def straight(a, points):
    """Whether every point lies within RUN_SLACK of the line from a to the last point."""
    u, length = unit(a, points[-1])
    return length > 0 and all(abs(cross(u, sub(p, a))) <= RUN_SLACK for p in points)


def curb_profile(run, curbs):
    """Curb offsets from the run's centre line every CURB_STEP, or None where no raised curb is in reach."""
    start = max(0., run.street['width'] / 2 - 100.)
    out = []
    count = int(run.len // CURB_STEP) + 1
    for k in range(count):
        along = min(run.len, k * CURB_STEP)
        o = run.point(along, start)
        t = curbs.ray(o, run.n, CURB_REACH)
        out.append(None if t is None else start + t)
    return out


def curb_under(profile, along):
    """The nearest curb offset under a car centred at along, or None when the curb is missing or bends there."""
    lo = math.floor((along - CAR_LENGTH / 2 - CURB_SPAN) / CURB_STEP)
    hi = math.ceil((along + CAR_LENGTH / 2 + CURB_SPAN) / CURB_STEP)
    if lo < 0 or hi >= len(profile):
        return None
    values = profile[lo:hi + 1]
    if any(v is None for v in values) or max(values) - min(values) > CURB_SPREAD:
        return None
    return min(values)


class Checker:
    def __init__(self, city, features, asphalt, bollards):
        self.city, self.f, self.asphalt = city, features, asphalt
        self.bollards, self.bollard_grid = bollards, Grid(1000.)
        for k, p in enumerate(bollards):
            self.bollard_grid.add(k, bbox([p], BOLLARD_CLEAR))
        self.arm_curbs = {}

    def arm_curb(self, junction, arm, sign):
        """The cross street's curb offset on the side facing a car: the median of three samples 8 to 16 m out."""
        key = (junction['node'], id(arm), sign)
        if key not in self.arm_curbs:
            u = arm['u']
            n = (-u[1] * sign, u[0] * sign)
            width = arm['item']['width']
            start = max(0., width / 2 - 100.)
            values = []
            for d in (800., 1200., 1600.):
                o = (junction['p'][0] + u[0] * d + n[0] * start, junction['p'][1] + u[1] * d + n[1] * start)
                t = self.f.curbs.ray(o, n, CURB_REACH)
                if t is not None:
                    values.append(start + t)
            self.arm_curbs[key] = sorted(values)[len(values) // 2] if values else width / 2
        return self.arm_curbs[key]

    def why_not(self, run, centre, yaw, poly):
        """The first rule a car footprint breaks, or None."""
        city, f = self.city, self.f
        box = bbox(poly)
        for p in [centre] + [(c[0] * .9 + centre[0] * .1, c[1] * .9 + centre[1] * .1) for c in poly]:
            if not self.asphalt.contains(p):
                return 'asphalt'
        for i in city.traffic_grid.query(box):
            if poly_seg_dist(poly, *city.traffic[i]) < TRAFFIC_CLEAR + SLACK:
                return 'traffic'
        for si in city.street_grid.query(box):
            clear = self.street_clear(run, city.streets[si])
            if clear is None:
                continue
            for g in city.streets[si]['segs']:
                if poly_seg_dist(poly, g['a'], g['b']) < clear + SLACK:
                    return 'street'
        if self.lane_short(run, centre, poly) > 0.:
            return 'lane'
        for k in city.track_grid.query(box):
            if poly_seg_dist(poly, *city.tracks[k]) < TRACK_CLEAR + SLACK:
                return 'track'
        for k in f.hydrant_grid.query(box):
            if poly_point_dist(poly, f.hydrants[k]) < HYDRANT_CLEAR + SLACK:
                return 'hydrant'
        for k in f.job_grid.query(box):
            if poly_point_dist(poly, f.jobs[k][1]) < JOB_CLEAR + SLACK:
                return 'job spot'
        for k in f.crossing_grid.query(box):
            if poly_seg_dist(poly, *f.crossings[k]) < CROSSING_CLEAR + SLACK:
                return 'crossing'
        for k in f.painted_grid.query(box):
            if poly_poly_dist(poly, f.painted[k]) < PAINTED_CLEAR + SLACK:
                return 'crossing'
        for k in city.service_grid.query(box):
            item = city.service[k]
            clear = SERVICE_CLEAR.get(item['tags'].get('service'), SERVICE_CLEAR['default']) + SLACK
            for a, b in zip(item['points'], item['points'][1:]):
                if poly_seg_dist(poly, a, b) < clear:
                    return 'lane mouth' if item['tags'].get('service') == 'alley' else 'driveway'
        if self.junction_breach(run, centre, poly):
            return 'junction'
        for k in f.extension_grid.query(box):
            if poly_poly_dist(poly, f.extensions[k]) < EXTENSION_CLEAR + SLACK:
                return 'extension'
        for k in f.prop_grid.query(box):
            prop = f.props[k]
            if poly_poly_dist(poly, prop['poly']) < prop['clear'] + SLACK:
                return 'prop'
        for k in self.bollard_grid.query(box):
            if poly_point_dist(poly, self.bollards[k]) < BOLLARD_CLEAR + SLACK:
                return 'bollard'
        for zone in f.zones:
            if len(zone) >= 3 and poly_poly_dist(poly, zone) < ZONE_CLEAR + SLACK:
                return 'chantier'
        if self.in_stop_zone(run, centre, f.bus_stops, BUS_ZONE):
            return 'bus stop'
        if city.signs.ban_at(run.street, centre):
            return 'sign'
        if self.in_stop_zone(run, centre, f.taxis, (TAXI_ZONE, TAXI_ZONE)):
            return 'taxi stand'
        return None

    def centre_line_shortfall(self, run, poly, centre):
        """How far (cm) a footprint lies inside the clearance of a traffic or street centre line, or short of the
        lane beside a track; 0 when clear."""
        city, box = self.city, bbox(poly)
        short = self.lane_short(run, centre, poly)
        for i in city.traffic_grid.query(box):
            short = max(short, TRAFFIC_CLEAR + SLACK - poly_seg_dist(poly, *city.traffic[i]))
        for si in city.street_grid.query(box):
            clear = self.street_clear(run, city.streets[si])
            if clear is None:
                continue
            for g in city.streets[si]['segs']:
                short = max(short, clear + SLACK - poly_seg_dist(poly, g['a'], g['b']))
        return short

    @staticmethod
    def street_clear(run, street):
        """STREET_CLEAR from another street's centre line. A street off the traffic graph keeps only a 3 m lane
        (OWN_LANE each side of its centre line) from its own: Cartier and Rivard are about 8 m between the curbs and
        the city signs both of them for parking. Beside a track the lane is measured across instead (lane_short),
        so its own centre line gives None."""
        own = street is run.street or (street['name'] and street['name'] == run.street['name'] and
                                       abs(dot(unit(street['segs'][0]['a'], street['segs'][-1]['b'])[0], run.u)) > .9)
        if own and not run.street['traffic']:
            return None if run.track else OWN_LANE
        return STREET_CLEAR

    def lane_short(self, run, centre, poly):
        """Beside a track on a street off the traffic graph: how far (cm) the lane across the street, from the car's
        outer side to the far curb or to the nearest car parked across, falls short of LANE_CLEAR; 0 elsewhere. The
        track lies inside the curbs, so the carriageway's middle is off the OSM centre line."""
        if not run.track or run.street['traffic']:
            return 0.
        n = run.n
        outer = min(dot(sub(c, run.a), n) for c in poly)
        along = dot(sub(centre, run.a), run.u)
        start = max(0., run.street['width'] / 2 - 100.)
        t = self.f.curbs.ray(run.point(along, -start), (-n[0], -n[1]), CURB_REACH)
        across = -(start + (CURB_REACH if t is None else t))
        for other, way, name in self.placed.query(bbox(poly, LANE_CLEAR + 2 * CAR_HALF_W)):
            if way != run.street['id'] and (not name or name != run.street['name']):
                continue
            mid = (sum(p[0] for p in other) / 4, sum(p[1] for p in other) / 4)
            if abs(dot(sub(mid, centre), run.u)) > CAR_LENGTH:
                continue
            inner = max(dot(sub(p, run.a), n) for p in other)
            if inner < outer:
                across = max(across, inner)
        return max(0., LANE_CLEAR + SLACK - (outer - across))

    def junction_breach(self, run, centre, poly):
        """A car within JUNCTION_CLEAR of a cross street's curb line, measured square to that street, at a junction
        on or beside its own street. The cross street's line runs on across a T, so the far curb keeps its mouth."""
        for k in self.city.junction_grid.query(bbox([centre])):
            j = self.city.junctions[k]
            if math.dist(j['p'], centre) > JUNCTION_REACH or abs(dot(sub(j['p'], run.a), run.n)) > JUNCTION_LATERAL:
                continue
            for arm in j['arms']:
                if abs(cross(arm['u'], run.u)) < math.sin(math.radians(ARM_ANGLE)):
                    continue
                sign = 1 if cross(arm['u'], sub(centre, j['p'])) > 0 else -1
                band = CROSSWALK_BAND if run.street['id'] in j.get('painted', ()) else 0.
                limit = self.arm_curb(j, arm, sign) + JUNCTION_CLEAR + band + SLACK
                if min(abs(cross(arm['u'], sub(c, j['p']))) for c in poly) < limit:
                    return True
        return False

    def in_stop_zone(self, run, centre, stops, zone):
        """A stop beside this curb closes zone[0] before it and zone[1] after it in the direction of travel. The
        game's traffic keeps to the curb a parked car faces along (the C++ facing): its run direction on a one-way
        street, else +u on the left (OSM sense) side and -u on the right."""
        along = dot(sub(centre, run.a), run.u)
        travel = run.direction if run.direction else run.side
        for p in stops:
            rel = sub(p, run.a)
            lateral = dot(rel, run.n)
            stop_along = dot(rel, run.u)
            if lateral < 0 or abs(stop_along - along) > zone[0] + zone[1] + CAR_LENGTH:
                continue
            if abs(lateral - self.run_curb.get(id(run), lateral)) > BUS_REACH:
                continue
            lo, hi = (stop_along - zone[0], stop_along + zone[1]) if travel > 0 else (stop_along - zone[1], stop_along + zone[0])
            lo, hi = lo - ZONE_SLACK, hi + ZONE_SLACK
            if along + CAR_LENGTH / 2 > lo and along - CAR_LENGTH / 2 < hi:
                return True
        return False


def place(city, features, curbs, asphalt, bollards):
    """Packs each run's legal curb with cars, front to back, and returns the slots and the counts."""
    runs, reasons = runs_for(city, curbs)
    checker = Checker(city, features, asphalt, bollards)
    checker.run_curb, checker.log = {}, {}
    slots, blocked, placed = [], {}, Grid(1000.)
    checker.placed, checker.track_cars = placed, {}
    stats = {'runs': len(runs), 'side_reasons': dict(sorted(reasons.items())), 'curb_metres': 0, 'vacant': 0}
    # The runs beside a track go last: their lane is measured to the cars already parked across the street.
    for run in sorted(runs, key=lambda r: (r.track, r.street['name'], r.street['id'], r.side, r.a)):
        profile = curb_profile(run, curbs)
        found = [v for v in profile if v is not None]
        if not found:
            continue
        checker.run_curb[id(run)] = sorted(found)[len(found) // 2]
        stats['curb_metres'] += len(found) * CURB_STEP / 100
        along, ordinal = CAR_LENGTH / 2 + CURB_SPAN, 0
        log = checker.log.setdefault(id(run), [])
        while along <= run.len - CAR_LENGTH / 2 - CURB_SPAN:
            curb = curb_under(profile, along)
            if curb is None:
                blocked['curb'] = blocked.get('curb', 0) + 1
                log.append((along, 'curb'))
                along += CANDIDATE_STEP
                continue
            key = (run.street['id'], run.side, round(run.a[0]), round(run.a[1]), ordinal)
            # A narrow street pulls its cars in to the curb, so they keep clear of its centre lines.
            swing = CAR_LENGTH / 2 * math.sin(math.radians(YAW_JITTER))
            gap = CURB_GAP[0] + (CURB_GAP[1] - CURB_GAP[0]) * seeded('gap', *key)
            if run.lane is not None:
                # Beside a painted bike lane the car keeps inside the parking band.
                gap = max(CURB_GAP_MIN, min(gap, curb - run.lane - 2 * CAR_HALF_W - swing + LANE_OVERHANG))
            yaw = run.yaw + (seeded('yaw', *key) * 2 - 1) * YAW_JITTER
            for _ in range(3):
                centre = run.point(along, curb - CAR_HALF_W - gap - swing)
                poly = rect(centre, yaw, CAR_LENGTH / 2, CAR_HALF_W)
                short = checker.centre_line_shortfall(run, poly, centre)
                if short <= 0. or gap - short - .5 < CURB_GAP_MIN:
                    break
                gap -= short + .5
            why = checker.why_not(run, centre, yaw, poly) or \
                ('car' if any(poly_poly_dist(poly, other[0]) < CAR_GAP + SLACK
                              for other in placed.query(bbox(poly, CAR_GAP))) else None)
            if why:
                blocked[why] = blocked.get(why, 0) + 1
                log.append((along, why))
                along += CANDIDATE_STEP
                continue
            pick = seeded('body', *key)
            body = 0 if pick < BODY_SHARE[0] else 1 if pick < BODY_SHARE[0] + BODY_SHARE[1] else 2
            paint = min(PAINTS - 1, int(seeded('paint', *key) * PAINTS))
            space = SPACES[body] + SPACE_JITTER[0] + (SPACE_JITTER[1] - SPACE_JITTER[0]) * seeded('space', *key)
            placed.add((tuple(poly), run.street['id'], run.street['name']), bbox(poly))
            log.append((along, 'car'))
            if seeded('vacant', *key) < VACANT:
                stats['vacant'] += 1
            else:
                traffic = next((g['traffic'] for g in run.segs
                                if g['traffic'] is not None and seg_dist(centre, g['a'], g['b']) < 2000.), None)
                if run.track:
                    side_key = (run.street['id'], run.side)
                    checker.track_cars[side_key] = checker.track_cars.get(side_key, 0) + 1
                slots.append({'x': round(centre[0], 1), 'y': round(centre[1], 1), 'z': ROAD_Z,
                              'yaw': round(yaw % 360., 2), 'length': body, 'paint': paint, 'body': body,
                              'street': run.street['name'], 'way': run.street['id'],
                              'side': 'L' if run.side > 0 else 'R', 'traffic_segment': -1 if traffic is None else traffic,
                              'curb_cm': round(curb - dot(sub(centre, run.a), run.n) - CAR_HALF_W, 1)})
            ordinal += 1
            along += space
    stats['blocked_candidates'] = dict(sorted(blocked.items()))
    stats['signs'] = sign_report(city, runs, checker, slots)
    stats['track_sides'] = track_report(city, runs, checker)
    return slots, stats


def track_report(city, runs, checker):
    """Every way side a drawn track runs along whose tags or signs park it: its cars, the metres of the replica's
    separator beside the track (bike_paint.json, tracks), the replica's reasons for none (left_out), and the rules
    its candidates broke ('no curb' where the replica draws no raised curb along it)."""
    rows = {}
    for run in runs:
        if not run.track:
            continue
        key = (run.street['id'], run.side)
        replica = city.track_rows.get(key, {})
        row = rows.setdefault(key, {'way': run.street['id'], 'name': run.street['name'], 'side': 'L' if run.side > 0 else 'R',
                                    'allow_poles': city.signs.signed.get(key, 0), 'cars': checker.track_cars.get(key, 0),
                                    'separator_m': replica.get('buffer_m', 0.), 'left_out': replica.get('left_out', {}),
                                    'blocked': {}})
        log = checker.log.get(id(run))
        for _, why in log or [(0., 'no curb')]:
            if why != 'car':
                row['blocked'][why] = row['blocked'].get(why, 0) + 1
    out = []
    for key in sorted(rows, key=lambda k: (rows[k]['name'], int(k[0]), k[1])):
        row = rows[key]
        row['blocked'] = dict(sorted(row['blocked'].items(), key=lambda kv: (-kv[1], kv[0])))
        out.append(row)
    return out


SIGN_NEAR = 1500.        # a pole whose signs allow parking has a car this near on its curb, or a reason


def sign_report(city, runs, checker, slots):
    """The city's parking signs against the slots. Every pole whose signs allow parking now either has a car
    within SIGN_NEAR on its curb, or the reason the curb by it holds none: the side rule, or the rule most of the
    candidates within SIGN_NEAR along its run broke ('car' when the spacing of the cars beside it left no room)."""
    signs = city.signs
    grid = Grid(2000.)
    for k, slot in enumerate(slots):
        grid.add(k, bbox([(slot['x'], slot['y'])]))
    missing = []
    for pole in signs.poles:
        if not any(g['rule'] == 'allow' for g in pole['signs']):
            continue
        near = [slots[k] for k in grid.query(bbox([pole['p']], SIGN_NEAR))
                if (slots[k]['street'] or slots[k]['way']) == pole['name'] and
                math.dist((slots[k]['x'], slots[k]['y']), pole['p']) <= SIGN_NEAR and
                dot(sub((slots[k]['x'], slots[k]['y']), pole['foot']), pole['n']) > 0.]
        if near:
            continue
        reason = None
        for run in runs:
            if run.street['id'] != pole['way'] or run.side != pole['side']:
                continue
            along = dot(sub(pole['foot'], run.a), run.u)
            if not -SIGN_NEAR <= along <= run.len + SIGN_NEAR:
                continue
            tally = {}
            for at, why in checker.log.get(id(run), ()):
                if abs(at - along) <= SIGN_NEAR:
                    tally[why] = tally.get(why, 0) + 1
            reason = max(sorted(tally), key=lambda k: tally[k]) if tally else 'run end'
            break
        if reason is None:
            g = min(pole['street']['segs'], key=lambda q: seg_dist(pole['p'], q['a'], q['b']))
            k = g['traffic']
            lane = city.bike_lanes.get((pole['way'], 'L' if pole['side'] > 0 else 'R'))
            ok, why = side_parking(pole['street']['tags'], 'left' if pole['side'] > 0 else 'right',
                                   (city.sides[k] & (2 if pole['side'] > 0 else 1)) if k is not None else None,
                                   painted_lane(pole['street'], g, pole['side'], lane, checker.f.curbs) if lane is not None else None,
                                   pole['side'] in city.track_sides(pole['street'], g),
                                   signs.signed.get((pole['way'], pole['side']), 0) >= SIGNED_POLES)
            reason = 'side: ' + why if not ok else 'short run'
        missing.append({'pole': pole['id'], 'way': pole['way'], 'side': 'L' if pole['side'] > 0 else 'R',
                        'codes': sorted({g['code'] for g in pole['signs'] if g['rule'] == 'allow'}), 'reason': reason})
    missing.sort(key=lambda r: int(r['pole']))
    by_reason = {}
    for row in missing:
        by_reason[row['reason']] = by_reason.get(row['reason'], 0) + 1
    return {'poles': len(signs.poles), 'allow_poles': sum(1 for q in signs.poles if any(g['rule'] == 'allow' for g in q['signs'])),
            'ban_spans': len(signs.spans), 'signed_sides': sum(1 for v in signs.signed.values() if v >= SIGNED_POLES),
            'allow_poles_without_car': dict(sorted(by_reason.items())), 'without_car': missing}


def counts_by_street(slots):
    out = {}
    for s in slots:
        row = out.setdefault(s['street'] or '(unnamed)', {'L': 0, 'R': 0})
        row[s['side']] += 1
    return dict(sorted(out.items()))


# ---------------------------------------------------------------------------------------------------------------
# Writers

def header_text(slots):
    lines = ['// Generated by Scripts/plateau_parking.py from Data/Plateau/ReplicaGeometry/Streets/parked_cars.json.',
             '// Do not edit. One row per legal curb space: x, y, z of the road (cm, map frame), the car yaw (degrees),',
             '// the length class, PaintStyle and BodyProfile. Sources: OpenStreetMap contributors (ODbL 1.0) and',
             '// Ville de Montreal open data (CC BY 4.0).',
             '#pragma once',
             '',
             'namespace LaFontaineParking',
             '{',
             'struct FSlot { float X; float Y; float Z; float Yaw; unsigned char Length; unsigned char Paint; unsigned char Body; };',
             f'constexpr int SlotCount = {len(slots)};',
             'const FSlot Slots[SlotCount] = {']
    rows = [f'{{{s["x"]:.1f}f,{s["y"]:.1f}f,{s["z"]:.1f}f,{s["yaw"]:.2f}f,{s["length"]},{s["paint"]},{s["body"]}}}'
            for s in slots]
    lines.append(',\n'.join(rows))
    lines += ['};', '}', '']
    return '\n'.join(lines)


def build(json_path=OUT_JSON, header_path=OUT_HEADER):
    curbs, asphalt, bollards = load_surfaces()
    city = City()
    features = Features(city, curbs)
    slots, stats = place(city, features, curbs, asphalt, bollards)
    stats['curb_metres'] = round(stats['curb_metres'])
    for i, s in enumerate(slots):
        s['id'] = i
    doc = {
        'layer': 'Streets', 'generator': GENERATOR, 'frame': FRAME,
        'note': 'One row per legal curb space on the replica streets. x, y: the car centre (cm); z: the road top; yaw: '
                'the car heading (degrees, the C++ curb-parking facing: a one-way street faces its traffic, a two-way '
                'street faces +direction on its left (OSM sense) side); length: the length class (0 coupe 600 cm, 1 '
                'sedan 625 cm, 2 wagon 650 cm centre to centre); paint: AQuebecCar PaintStyle 0..3; body: BodyProfile '
                '0..2, the Car70Body mesh (all 466 cm long, 220 cm over the mirrors); street, way, side (L or R, OSM '
                'sense); traffic_segment: the C++ LaFontaine::RoadSegments index or -1; curb_cm: mirror to curb. The '
                'game puts the pivot 100.5 cm over the road. The preview draws these; the game fills them at runtime.',
        'sources': {'osm': '© OpenStreetMap contributors, ODbL 1.0',
                    'city': 'Ville de Montréal, données ouvertes (CC BY 4.0): sign poles (STM bus stops), trees',
                    'law': 'Code de la sécurité routière art. 386 (5 m from an intersection or a '
                           'crosswalk, montreal.ca); quebec.ca, Stopping a vehicle on a public road (3 m from a hydrant, '
                           'no stopping in a public transport zone)'},
        'rules_cm': {'car_length': CAR_LENGTH, 'car_width': CAR_HALF_W * 2, 'spaces': list(SPACES),
                     'space_jitter': list(SPACE_JITTER), 'curb_gap': list(CURB_GAP), 'curb_top': list(CURB_TOP),
                     'curb_spread': CURB_SPREAD, 'traffic_clear': TRAFFIC_CLEAR, 'street_clear': STREET_CLEAR,
                     'junction_clear': JUNCTION_CLEAR, 'crossing_clear': CROSSING_CLEAR,
                     'painted_crosswalk_clear': PAINTED_CLEAR, 'hydrant_clear': HYDRANT_CLEAR,
                     'service_clear': SERVICE_CLEAR, 'bus_zone': list(BUS_ZONE), 'taxi_zone': TAXI_ZONE,
                     'extension_clear': EXTENSION_CLEAR, 'prop_clear': PROP_CLEAR, 'bollard_clear': BOLLARD_CLEAR,
                     'chantier_clear': ZONE_CLEAR, 'vacant_share': VACANT, 'yaw_jitter_deg': YAW_JITTER},
        'counts': {'slots': len(slots), **stats, 'by_street': counts_by_street(slots),
                   'by_body': [sum(1 for s in slots if s['body'] == b) for b in range(BODIES)],
                   'by_paint': [sum(1 for s in slots if s['paint'] == p) for p in range(PAINTS)],
                   'bus_stops': len(features.bus_stops), 'hydrants': len(features.hydrants),
                   'crossings': len(features.crossings), 'junctions': len(city.junctions),
                   'extensions': len(features.extensions), 'bollards': len(bollards)},
        'source_sha256': {p: sha_file(ROOT / p) for p in SOURCES if (ROOT / p).is_file()},
    }
    text = json.dumps(doc, ensure_ascii=False, indent=1)[:-2] + ',\n "slots": [\n' + \
        ',\n'.join('  ' + json.dumps(s, ensure_ascii=False) for s in slots) + '\n ]\n}\n'
    Path(json_path).parent.mkdir(parents=True, exist_ok=True)
    Path(json_path).write_text(text)
    Path(header_path).parent.mkdir(parents=True, exist_ok=True)
    Path(header_path).write_text(header_text(slots))
    return doc, slots


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--json', default=str(OUT_JSON))
    parser.add_argument('--header', default=str(OUT_HEADER))
    args = parser.parse_args()
    doc, slots = build(args.json, args.header)
    counts = doc['counts']
    print(json.dumps({k: counts[k] for k in ('slots', 'vacant', 'curb_metres', 'blocked_candidates', 'by_body', 'by_paint')}))
    print(json.dumps(counts['by_street'], ensure_ascii=False))


if __name__ == '__main__':
    main()
