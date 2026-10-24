"""Plateau replica streetscape: measured streets, furniture placements and a lived-in layer.

Writes three layers under Data/Plateau/ReplicaGeometry/ (frame: x east, y north, z up, cm):

* Streets   - carriageways cut to curb lines measured from the mapped sidewalks, Québec paint,
              grey concrete sidewalks with an 18 cm curb (SM_Concrete_Collision_Replica_*),
              parterres with low iron fences, the street and park trees of the city's inventory with their
              sidewalk pits (guards and planting) and the few curb extensions the data or a corner calls for
              (street_trees.json), ruelle surfaces with a sunken aged-concrete gutter, bike-track bollards.
* Furniture - placements.json only: lamps, hydrants, ARRÊT signs, white street-name signs,
              one-way and parking signs, BIXI docks, benches, bins and mail boxes. The meshes
              come from the MAP-PROPS layer (ReplicaGeometry/Props).
* Soul      - seeded wear and life (asphalt patches, sealed cracks, potholes, leaf drifts, weeds,
              rust streaks, original colour-block murals, ruelle wires) and the lane life read from the
              Plex yard records: pulley clotheslines from the gallery rails to yard poles, bins, flower
              boxes and bikes at the gates, the ruelles vertes (city open data: beds, plants, creeper,
              entry arches, planters, murals) and tags; placements.json for cones, chantier fences,
              utility poles, curb and gate bins and locked bikes; lane_life.json with the lane records.

Stdlib only and deterministic: every random choice comes from a SHA-256 seed of stable OSM ids.
Sources: Data/LaFontaine/osm.xml (© OpenStreetMap contributors, ODbL 1.0), the read-only
traffic graph in Data/LaFontaine/layout.json, the Plex layer's Plex/fronts.json and the Ville de
Montréal public tree inventory ("Arbres", CC BY 4.0), clipped by --clip-trees into Data/Plateau/Inventory/, the
Ville de Montréal "Ruelles vertes" open data (CC BY 4.0), clipped by --clip-ruelles into
Soul/ruelles_vertes_clip.json. Dimensions and colours follow the research brief
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
           'Scripts/prepare_lafontaine.py', 'Data/Plateau/BaseGeometry/Marking.obj',
           # the lane-life part of the Soul layer reads the Plex yard records and the city's ruelles vertes, the Plex
           # manifest (its Glass batches: the rear windows the AC units sit in) and the props' bounds and anchors
           'Data/Plateau/ReplicaGeometry/Plex/fronts.json', 'Data/Plateau/ReplicaGeometry/Soul/ruelles_vertes_clip.json',
           'Data/Plateau/ReplicaGeometry/Plex/manifest.json', 'Data/Plateau/ReplicaGeometry/Props/manifest.json',
           # the street and park trees: the city's public tree inventory, clipped by --clip-trees
           'Data/Plateau/Inventory/trees_pmr.json', 'Data/Plateau/Inventory/trees_vm.json')
LEGACY_MARKING = ROOT / 'Data/Plateau/BaseGeometry/Marking.obj'
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
CAP = {'primary': 1150., 'secondary': 900., 'tertiary': 900., 'residential': 625., 'unclassified': 625.,
       'living_street': 600.}   # residential 2 x 6.25 m = the spec's 12.5 m upper bound (Fabre, Garnier)
CAP_TWO_WAY_SECONDARY = 760.   # Rachel: about 14 m curb to curb including the 3 m cycle track
# Front yards (parterres) reach the building line, sampled along each 7.6 m lot (see _yards).
FRONT_MAX = 1500.         # a parterre reaches a building this far behind the sidewalk, no farther
OPEN_YARD = 250.          # with no building that close: a 2.5 m parterre (open lot, car park, square)
ALLEY_YARD = 600.         # ...but one reaches a ruelle's paving this near behind the sidewalk
YARD_STEP = 60.           # the building line is sampled this often along a lot
# Street and park trees come from the city's inventory (see "Street and park trees"): the curb stays where it was
# measured and a tree the inventory puts in a sidewalk pit stands in one, 65 to 80 cm behind the curb. Only a tree
# the carriageway still covers near a corner, or where the inventory or OSM shows a curb extension, gets one
# (curb_extensions); any other is listed for the host.
BUMP_REACH = 300.         # a trunk this far from the curb or less gets an extension; farther ones go to the host
PIT_L, PIT_D = 110., 100.  # tree pit along and across the curb
BUMP_MARGIN = 25.         # concrete between the pit and the extension's edge: the 15 cm curb band and 10 cm
BUMP_MIN = 90.            # shallowest extension
BUMP_TAPER = .8           # taper length per cm of depth (a chamfer: these sit in the parking lane), at most...
BUMP_TAPER_MAX = 90.
PARK_GAP = 540.           # clear curb between two extensions that still takes a parked car; closer ones merge
RAISED_MIN = 30.          # a raised part shallower than this is laid flush instead (a dropped apron)
VERGE_BACK = 40.          # an extension on a side with no sidewalk reaches this far behind the carriageway edge
CORNER_BACK = 30.         # one on a corner arc overlaps the corner sidewalk by this much
# Ruelles are paved from fence to fence (or wall to wall where nearer), in pieces of 20 m or less.
ALLEY_PAVE = 290.         # plateau_plex.FENCE_FROM_ALLEY: the yard fences stand this far from the centreline
WALL_PAVE = 600.          # past it, with no yard or fence between, the paving runs out to a wall this near
PAVE_PIECE = 2000.
PAVE_STEP = 100.          # the wall-to-wall reach is sampled every metre
TEXTURES_PATH = '/Game/Plateau/Replica/Textures/T_Replica_'   # a manifest texture naming a replica set picks it

STREETS_MATERIALS = {
    # key: (prefix, sRGB, roughness, metallic, collision, texture)
    'asphalt': ('Asphalt_Replica', '#3a3b40', .92, 0., 'none', '/Game/Art/Textures/asphalt_02_diff'),
    'alley': ('Asphalt_Replica_Alley', '#55565a', .95, 0., 'none', '/Game/Art/Textures/asphalt_02_diff'),
    'sidewalk': ('Concrete_Collision_Replica', '#b5b8b8', .85, 0., 'complex', None),
    'curb': ('Streets_curb', '#c8cac7', .8, 0., 'none', None),
    'joint': ('Streets_joint', '#7c7e7d', .9, 0., 'none', None),
    # The ruelle's sunken centre gutter: aged lane concrete (stains, joints, a damp silted channel) on its own UVs, u
    # along the gutter and v across it; the colour is the set's mean, darker than the sidewalk.
    'Concrete_Lane_Aged': ('Streets_Concrete_Lane_Aged', '#746c62', .83, 0., 'none', None),
    # Tree pits: a low wrought-iron guard (cut-out cards round the pit, no collision) and planted cards on the soil.
    # Both colours are their sets' means (the planting owns its colours).
    'Iron_Wrought': ('Streets_Iron_Wrought', '#251f1b', .49, 0., 'none', None),
    'Plant_Pit_Flowers': ('Streets_Plant_Pit_Flowers', '#846f58', .73, 0., 'none', None),
    'paint_white': ('Streets_paint_white', '#f2f2ee', .6, 0., 'none', None),
    'paint_yellow': ('Streets_paint_yellow', '#f2b705', .6, 0., 'none', None),
    'paint_green': ('Streets_paint_green', '#2e9e5a', .65, 0., 'none', None),
    # The live OSM Marking material M_LF_Marking (linear .85, .73, .39) for the re-authored route dashes.
    'legacy_marking': ('Streets_legacy_marking', '#eddea8', .6, 0., 'none', None),
    'cast_iron': ('Streets_cast_iron', '#2e2d2b', .55, .6, 'none', None),
    # Front lawns and beds on the shared rear-pass keys (textured lawn and soil, colours at the texture means, as
    # in Plex and Soul); they collide like the sidewalk. The grass spill, lawn in the traffic band, the ruelle
    # verge and the tree-pit soil take the same lawn and soil sets through their texture path, without collision.
    'Yard_Grass': ('Streets_Yard_Grass', '#606a31', .9, 0., 'complex', None),
    'Yard_Soil': ('Streets_Yard_Soil', '#453526', .88, 0., 'complex', None),
    'yard_path': ('Streets_yard_path', '#9e9c97', .85, 0., 'complex', None),
    'grass_edge': ('Streets_grass_edge', '#606a31', .9, 0., 'none', TEXTURES_PATH + 'Lawn_diff'),
    'soil': ('Streets_soil', '#3e2f24', .9, 0., 'none', TEXTURES_PATH + 'Soil_diff'),
    'Yard_Gravel': ('Streets_Yard_Gravel', '#827f7b', .88, 0., 'none', None),   # weedy crushed stone at fence feet
    'iron': ('Streets_iron', '#1c1c1c', .5, .7, 'none', None),
    'bollard_green': ('Streets_bollard_green', '#2f7d46', .5, .2, 'none', None),
}
SOUL_MATERIALS = {
    'patch_dark': ('Soul_patch_dark', '#2c2d31', .9, 0., 'none', None),
    'patch_light': ('Soul_patch_light', '#5e5f62', .95, 0., 'none', None),
    # Sealed cracks: dull, near-black bitumen. At roughness .35 the sky's highlight turned them into white paint
    # strokes at a grazing view (the corner capture's "white hook"); .62 keeps them a dark, dull line.
    'crack_seal': ('Soul_crack_seal', '#0f1011', .62, 0., 'none', None),
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
    # Lane life (see "Lane life" below). Pulley clotheslines from the galleries to a pole in the yard:
    'line_rope': ('Soul_line_rope', '#d6d3ca', .7, 0., 'none', None),
    'pulley': ('Soul_pulley', '#8f9295', .4, .8, 'none', None),
    'clothes_pole': ('Soul_clothes_pole', '#6d6253', .85, 0., 'none', None),
    'cloth_e': ('Soul_cloth_e', '#2e3b5e', .95, 0., 'none', None),
    'cloth_f': ('Soul_cloth_f', '#d68fa1', .95, 0., 'none', None),
    # Ruelles vertes: the shared textured keys of the rear pass (colours at the texture means, as in Plex), wooden
    # planters, bed edging (also the grey planters), an entry arch, and autumn perennials, grasses and shrubs. Each
    # sparse key costs up to four batches (the last batch tile splits at the origin), so the palette stays small.
    'Yard_Soil': ('Soul_Yard_Soil', '#453526', .88, 0., 'none', None),
    'Yard_Grass': ('Soul_Yard_Grass', '#606a31', .9, 0., 'none', None),
    'Leaf_Creeper': ('Soul_Leaf_Creeper', '#8f3321', .58, 0., 'none', None),
    'Rail_Lattice': ('Soul_Rail_Lattice', '#a39a88', .7, 0., 'none', None),
    'planter_wood': ('Soul_planter_wood', '#7a5b3d', .8, 0., 'none', None),
    'bed_edge': ('Soul_bed_edge', '#5f5142', .85, 0., 'none', None),
    'arch_wood': ('Soul_arch_wood', '#8a6a48', .75, 0., 'none', None),
    'arch_green': ('Soul_arch_green', '#3f5b3c', .7, 0., 'none', None),
    # Perennials and shrubs are crossed foliage cards on the creeper's cut-out leaf set (its texture path picks the
    # set and the masked two-sided foliage parent), tinted per key; each colour stays within the 8x tint limit of
    # the set's red mean.
    'plant_green': ('Soul_plant_green', '#4b6532', .6, 0., 'none', TEXTURES_PATH + 'Creeper_diff'),
    'plant_gold': ('Soul_plant_gold', '#a07d2e', .6, 0., 'none', TEXTURES_PATH + 'Creeper_diff'),
    'plant_rust': ('Soul_plant_rust', '#8f4a2b', .6, 0., 'none', TEXTURES_PATH + 'Creeper_diff'),
    'plant_purple': ('Soul_plant_purple', '#5c4860', .6, 0., 'none', TEXTURES_PATH + 'Creeper_diff'),
    'plant_red': ('Soul_plant_red', '#a3312b', .6, 0., 'none', TEXTURES_PATH + 'Creeper_diff'),
    'plant_straw': ('Soul_plant_straw', '#b9a26a', .95, 0., 'none', None),
    # Tags (spray paint) on lane fences, sheds and garage doors
    'tag_black': ('Soul_tag_black', '#151515', .6, 0., 'none', None),
    'tag_silver': ('Soul_tag_silver', '#b8bbbf', .45, .5, 'none', None),
    'tag_red': ('Soul_tag_red', '#b02a22', .6, 0., 'none', None),
    'tag_blue': ('Soul_tag_blue', '#2b4fa3', .6, 0., 'none', None),
    'tag_white': ('Soul_tag_white', '#ebeae6', .6, 0., 'none', None),
}
# Agreed MAP-PROPS keys; apply_plateau_replica.py instances ReplicaGeometry/Props meshes by these names.
PROP_KEYS = ('lamp_cobra', 'lamp_park', 'hydrant', 'sign_stop', 'sign_street', 'sign_oneway', 'sign_parking',
             'bixi_dock', 'bixi_bike', 'bin_recycling', 'bin_compost', 'bin_garbage', 'cone',
             'barrier_chantier', 'utility_pole', 'laundry_line', 'bike_locked', 'ac_unit', 'flower_box',
             'bench', 'mailbox', 'chair_patio', 'bbq', 'satellite_dish', 'potted_plant', 'bike_gallery')
PARKING_TEXTS = [('R-PF', '\\P 9h-23h EXCEPTÉ S3R'), ('AD-TT', '\\A EN TOUT TEMPS'),
                 ('SU-MA-A', '\\P 8h-9h MARDI 1 AVRIL AU 1 DÉC'), ('SD-TT', '\\P EN TOUT TEMPS'),
                 ('SU-ME-A', '\\P 9h-10h MERCREDI 1 AVRIL AU 1 DÉC'), ('R-PF', '\\P 9h-23h EXCEPTÉ S3R')]
M64 = (1 << 64) - 1
PROPS_MANIFEST = OUT / 'Props/manifest.json'


def props_info():
    """MAP-PROPS anchors (BIXI slots, pole wire anchors) when its manifest exists; agreed defaults otherwise."""
    defaults = {'bixi_slots': [(72., y, 180.) for y in (194., 114., 34., -46., -126., -206.)], 'bixi_length': 558.,
                'pole_wires': [(0., 108., 1002.), (0., 45., 1002.), (0., -45., 1002.), (0., -108., 1002.)],
                'pole_drop': (20., 0., 850.), 'bike_contact': (-10., -34.24),
                # MAP-PROPS bounds (x0, y0, z0, x1, y1, z1) of the props the lane life sets at the gates
                'bounds': {'bin_recycling': (-42.55, -32., 0., 38., 32., 104.5),
                           'bin_compost': (-22., -25.15, 0., 23.9, 25.17, 53.73),
                           'flower_box': (-11.8, -46., 0., 14.24, 46., 41.42),
                           'bike_locked': (-86.91, -42.9, 0., 86.91, 10.39, 108.1)},
                # MAP-PROPS anchors the gallery life hangs props by: the AC's and the flower box's wall planes (x),
                # the dish clamp's centre over the clamp plate (z)
                'anchors': {'ac_wall_x': -18., 'flower_wall_x': -11., 'dish_clamp_z': 6.}}
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
        defaults['colliders'] = {k: [(c['center'], c['size']) for c in v.get('colliders_cm', [])]
                                 for k, v in props.items()}
        defaults['bounds'] = {k: tuple(v['bounds_cm']) for k, v in props.items() if len(v.get('bounds_cm', ())) == 6}
        defaults['anchors'] = {'ac_wall_x': props['ac_unit']['anchors']['wall_plane_x_cm'],
                               'flower_wall_x': props['flower_box']['anchors']['wall_plane_x_cm'],
                               'dish_clamp_z': props['satellite_dish']['anchors']['clamp_cm'][2]}
    except (OSError, KeyError, ValueError, IndexError):
        pass
    return defaults


_PROPS_CACHE = {}


def collider_polys(prop, p, yaw):
    """World xy footprints of a prop's MAP-PROPS collision boxes (empty when it has none)."""
    if 'info' not in _PROPS_CACHE:
        _PROPS_CACHE['info'] = props_info()
    out = []
    for (cx, cy, _), (sx, sy, _) in _PROPS_CACHE['info'].get('colliders', {}).get(prop, []):
        out.append([local_to_world(p, yaw, (cx + dx * sx / 2, cy + dy * sy / 2))
                    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    return out


def collision_clear(world, prop, p, yaw):
    """A colliding prop keeps collision only if its point and every collider box clear the traffic band."""
    if world.traffic_distance(p) < CLEAR + 40:
        return False
    return all(world.traffic_distance(poly) >= CLEAR for poly in collider_polys(prop, p, yaw))


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

    def shuffle(self, items):
        """Fisher-Yates in place, from this generator's own draws."""
        for i in range(len(items) - 1, 0, -1):
            j = self.randint(0, i)
            items[i], items[j] = items[j], items[i]


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


def quad_triangles(points):
    """Split a simple CCW quad (2D or 3D points) into two triangles through its reflex vertex."""
    r = next((i for i in range(4) if _cross(points[i - 1], points[i], points[(i + 1) % 4]) < 0), 0)
    return [[points[r], points[(r + 1) % 4], points[(r + 2) % 4]], [points[r], points[(r + 2) % 4], points[(r + 3) % 4]]]


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

class UVFace(list):
    """A face that carries its own UVs (cut-out cards: u along the run in metres, v 0..1 up the card)."""
    uv = None


class Layer:
    def __init__(self, name, materials):
        self.name, self.materials, self.faces = name, materials, {k: [] for k in materials}

    def face(self, key, points):
        points = [tuple(float(v) for v in p) for p in points]
        assert key in self.materials, key
        assert len(points) >= 3 and all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in points)
        self.faces[key].append(points)

    def card(self, key, a, b, z0, z1, facing=None, u0=0.):
        """One vertical cut-out card from a to b, z0 to z1, with card UVs (u in metres along a->b from u0, v 0 at
        the bottom edge and 1 at the top), the convention of the shared Rail_Lattice and Fence_Boards keys. The
        masked materials are two-sided, so one face; `facing` (xy) only picks the winding."""
        length = math.dist(a[:2], b[:2])
        if length < 5 or z1 - z0 < 5:
            return 0
        points = [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)]
        uv = [(u0, 0.), (u0 + length / 100, 0.), (u0 + length / 100, 1.), (u0, 1.)]
        if facing is not None and (b[1] - a[1]) * facing[0] - (b[0] - a[0]) * facing[1] < 0:
            points, uv = [points[1], points[0], points[3], points[2]], [uv[1], uv[0], uv[3], uv[2]]
        face = UVFace(tuple(float(v) for v in p) for p in points)
        face.uv = uv
        assert key in self.materials, key
        self.faces[key].append(face)
        return 1

    def uvface(self, key, points, uv):
        """A face with its own UVs (one per point), for a surface whose texture runs along a line (the gutter)."""
        assert key in self.materials and len(uv) == len(points) >= 3, key
        face = UVFace(tuple(float(v) for v in p) for p in points)
        face.uv = [tuple(float(c) for c in t) for t in uv]
        self.faces[key].append(face)

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
        own = getattr(poly, 'uv', None)
        for k, (x, y, z) in enumerate(poly):
            verts.append(f'v {x:.3f} {-y:.3f} {z:.3f}')
            # UVs in metres: world xy on horizontal faces, (along first edge, z) on the others; cards carry their own.
            uv = own[k] if own else (x / 100, y / 100) if horizontal else \
                (sum((x, y, z)[i] * d[i] for i in range(3)) / 100, z / 100)
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
        'source_sha256': source_hashes(),
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
            'counts': counts, 'source_sha256': source_hashes(),
            'placements': rows}
    (directory / 'placements.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    return data


def source_hashes():
    """SHA-256 of every input; the optional Plex records and the ruelles vertes clip only when they are present."""
    return {p: sha_file(ROOT / p) for p in SOURCES if (ROOT / p).is_file()}


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
        self.lows = []             # the lowest point of each item's top: a ramp piece's foot, else its z
        self.kinds = {}            # kind -> (polygons, Grid(1000)) for has()

    def add(self, poly, z, kind, low=None):
        self.grid.add(len(self.items), bbox(poly))
        self.items.append((poly, z, kind))
        self.lows.append(z if low is None else low)
        polys, grid = self.kinds.setdefault(kind, ([], Grid(1000.)))
        grid.add(len(polys), bbox(poly))
        polys.append(poly)

    def at(self, p):
        best = (0., 'ground')
        for i in self.grid.query((p[0], p[1], p[0], p[1])):
            poly, z, kind = self.items[i]
            if point_in(p, poly) and z >= best[0]:
                best = (z, kind)
        return best

    def floor(self, p):
        """The height the ground under p keeps everywhere: the highest foot of the surfaces there (a ramp piece
        counts at its low end, where at() gives its top), 0 on bare ground."""
        best = 0.
        for i in self.grid.query((p[0], p[1], p[0], p[1])):
            if self.lows[i] > best and point_in(p, self.items[i][0]):
                best = self.lows[i]
        return best

    def has(self, p, kind):
        """Whether a surface of this kind lies under p, whatever covers it."""
        if kind not in self.kinds:
            return False
        polys, grid = self.kinds[kind]
        cell = grid.cells.get((math.floor(p[0] / grid.cell), math.floor(p[1] / grid.cell)), ())
        return any(point_in(p, polys[i]) for i in cell)


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
        'carriageway_quads', 'junction_polygons', 'sidewalk_pieces', 'concave_pieces', 'bowtie_pieces_dropped', 'sidewalk_metres', 'curb_ramps',
        'dropped_aprons', 'corner_pieces', 'yards', 'yard_square_metres', 'fence_metres', 'tree_pits',
        'stop_bars', 'stop_bars_signal', 'stop_bars_osm_stop', 'crosswalks_continental_white',
        'crosswalks_continental_yellow', 'crosswalks_lines_white', 'crosswalks_generated_at_stops',
        'centre_line_metres', 'lane_line_metres', 'parking_line_metres', 'bike_track_metres', 'bollards',
        'bike_pictograms', 'green_conflict_zones', 'manholes', 'storm_drains', 'ruelle_metres',
        'skipped_route_segments', 'stop_nodes_off_network', 'yard_slabs', 'yard_slabs_in_traffic_band',
        'ruelle_square_metres', 'ruelle_pieces', 'ruelle_edge_metres', 'ruelle_joint_wedges',
        'street_trees', 'street_trees_inventory', 'street_trees_osm', 'trees_on_carriageway',
        'sidewalk_pits', 'sidewalk_pits_moved', 'sidewalk_pit_metres_moved', 'trees_kept_in_place',
        'trees_on_sidewalk_without_pit', 'trees_dropped_in_buildings', 'curb_extensions', 'curb_extension_trees',
        'curb_extensions_merged', 'curb_extensions_flush', 'curb_extensions_part_flush', 'curb_extension_metres',
        'curb_extensions_on_verges', 'curb_extensions_on_corners', 'curb_extensions_saillie',
        'curb_extensions_median', 'curb_extensions_choker', 'curb_extensions_corner', 'trees_for_host',
        'yard_slabs_past_ruelle_mouths', 'sidewalk_risers', 'corner_risers',
        'yard_risers', 'yard_mouth_wedges', 'yard_mouth_wedge_square_metres', 'sidewalk_pieces_split',
        'passages', 'passage_square_metres', 'passage_lead_ins', 'pit_guard_cards', 'pit_flower_cards',
        'curb_extension_back_walls', 'apron_walls', 'tree_pits_slid', 'ruelle_gutter_metres')}
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
    ramp_grid = Grid(2000.)
    for i, p in enumerate(ramp_points):
        ramp_grid.add(i, bbox([p], 400))
    world.ramp_points = ramp_points
    world.sidewalk_strips = []
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
            strip['ramps'] = _strip_ramps(strip, ramp_grid, ramp_points)
            world.sidewalk_strips.append(strip)
    # The ruelles first (the parterres stop at their paving), then the street trees: sidewalk pits from the city's
    # inventory and the few curb extensions the data or a corner calls for (each strip's curb band gives way to
    # them), then the sidewalks, corners and yards.
    _ruelles(world, L, surfaces, counts)
    extensions = place_street_trees(world, L, counts)
    world.apron_outlines = []
    for strip in world.sidewalk_strips:
        _sidewalk_strip(world, L, surfaces, strip, counts)
    for row in world.corners:
        _corner(world, L, surfaces, row, counts)
    barriers = YardBarriers(world)
    for strip in world.sidewalk_strips:
        _yards(world, L, surfaces, strip, counts, barriers)
    stops = PaveStops(world, world.plex, alleys=True, yards=True)
    for strip in world.sidewalk_strips:
        _passages(world, L, surfaces, strip, counts, stops)
    _draw_extensions(world, L, surfaces, extensions, counts)
    _apron_walls(world, L, surfaces, counts)
    _legacy_dashes(world, L, counts)
    finish_street_trees(world, counts)
    for k in ('sidewalk_metres', 'yard_square_metres', 'fence_metres', 'centre_line_metres', 'lane_line_metres',
              'parking_line_metres', 'bike_track_metres', 'ruelle_metres', 'ruelle_square_metres',
              'ruelle_edge_metres', 'curb_extension_metres', 'yard_mouth_wedge_square_metres', 'passage_square_metres',
              'sidewalk_pit_metres_moved', 'ruelle_gutter_metres'):
        counts[k] = round(counts[k])
    counts['curb_measurement'] = world.curb_stats
    counts['osm_stop_nodes_inside'] = len(world.stop_nodes)
    counts['osm_crossings_on_replica'] = len({c['way'] for c in world.crossings})
    counts['signalised_approaches'] = len(world.signal_arms)
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


def _strip_ramps(strip, ramp_grid, ramp_points):
    """Crossing points along a strip's curb line (cm from its start): the ramp profile."""
    (ca, cb), length = strip['curb'], strip['len']
    stops = []
    for i in ramp_grid.query(bbox([ca, cb], 300)):
        p = ramp_points[i]
        d = seg_dist(p, ca, cb)
        if d < 260:
            t = ((p[0] - ca[0]) * (cb[0] - ca[0]) + (p[1] - ca[1]) * (cb[1] - ca[1])) / (length * length)
            if -.05 <= t <= 1.05:
                stops.append(t * length)
    return stops


SIDEWALK_SPLIT = 6        # parts of a 1.5 m sidewalk piece that a building corner cuts across


def _sidewalk_strip(world, L, surfaces, strip, counts):
    (ca, cb), (oa, ob), length = strip['curb'], strip['outer'], strip['len']
    pieces = max(1, round(length / 150))
    stops = strip['ramps']
    cuts = strip.get('bump_cuts', [])     # the curb band gives way to the curb extensions

    def zat(x):
        d = min([abs(x - c) for c in stops], default=1e9)
        if d <= 110:
            return Z_DROP
        if d < 280:
            return Z_DROP + (Z_WALK - Z_DROP) * (d - 110) / 170
        return Z_WALK

    strip['ramps'] = stops
    # 'raised' (a colliding slab at the curb height or on a ramp) or 'apron' per piece; a raised piece gets an end
    # wall wherever the next piece is not raised (an apron 9 cm down, a gap or the strip's end), so no step between
    # a slab and a dropped apron opens onto the ground underneath
    # A piece whose one end runs into a building and the other not (a building corner in the sidewalk band) is cut
    # into SIDEWALK_SPLIT parts, so the part outside the wall is laid instead of the whole piece being dropped.
    spans = []
    for k in range(pieces):
        f0, f1 = k / pieces, (k + 1) / pieces
        ends_in = [any(world.in_building(q) for q in (c, o, lerp(c, o, .5)))
                   for c, o in ((lerp(ca, cb, f0), lerp(oa, ob, f0)), (lerp(ca, cb, f1), lerp(oa, ob, f1)))]
        if ends_in[0] != ends_in[1]:
            spans += [(f0 + (f1 - f0) * j / SIDEWALK_SPLIT, f0 + (f1 - f0) * (j + 1) / SIDEWALK_SPLIT, j == 0)
                      for j in range(SIDEWALK_SPLIT)]
            counts['sidewalk_pieces_split'] += 1
        else:
            spans.append((f0, f1, True))
    pieces = len(spans)
    status, ends = [None] * pieces, {}
    for k, (f0, f1, joint) in enumerate(spans):
        c0, c1, o1, o0 = lerp(ca, cb, f0), lerp(ca, cb, f1), lerp(oa, ob, f1), lerp(oa, ob, f0)
        poly = [c0, c1, o1, o0]
        if segments_cross(c0, c1, o1, o0) or segments_cross(c1, o1, o0, c0):
            counts['bowtie_pieces_dropped'] += 1
            continue   # only bow-tie slivers, where opposite edges cross; simple concave pieces stay
        if area(poly) < 50:
            continue
        mid = lerp(lerp(c0, c1, .5), lerp(o0, o1, .5), .5)
        if world.in_building(mid) and not world.in_building(c0) and not world.in_building(c1):
            # a building stands in the sidewalk band (narrow streets): the piece runs from the curb to its wall
            reach = []
            for c, o in ((c0, o0), (c1, o1)):
                w = math.dist(c, o)
                hit = world.building_ray(c, ((o[0] - c[0]) / w, (o[1] - c[1]) / w), w) if w > 1 else None
                reach.append(lerp(c, o, max(0., min(1., ((hit if hit is not None else w) - 3.) / w))) if w > 1 else o)
            o0, o1 = reach
            poly = [c0, c1, o1, o0]
            if area(poly) < 50 or segments_cross(c0, c1, o1, o0) or segments_cross(c1, o1, o0, c0):
                continue
            mid = lerp(lerp(c0, c1, .5), lerp(o0, o1, .5), .5)
            counts['sidewalk_pieces_to_walls'] = counts.get('sidewalk_pieces_to_walls', 0) + 1
        concave = not convex(poly)
        if on_pavement(world, mid, strip['seg']['i']) or world.in_building(mid):
            continue
        za, zb = zat(f0 * length), zat(f1 * length)
        clear = world.traffic_distance(poly) >= CLEAR
        if not clear:
            for tri in (quad_triangles(poly if area(poly) > 0 else poly[::-1]) if concave else [poly]):
                L.flat('curb', tri, Z_DROP)
            surfaces.add(poly, Z_DROP, 'apron')
            world.apron_outlines.append(poly if area(poly) > 0 else poly[::-1])
            counts['dropped_aprons'] += 1
            status[k] = 'apron'
            continue
        top = [(c0[0], c0[1], za), (c1[0], c1[1], zb), (o1[0], o1[1], zb), (o0[0], o0[1], za)]
        ccw = area(poly) > 0
        top = top if ccw else top[::-1]
        # A simple concave piece is two triangles split at its reflex vertex; the walls are unchanged.
        for tri in (quad_triangles(top) if concave else [top]):
            L.face('sidewalk', tri)
        counts['concave_pieces'] += concave
        # Outward walls (Layer.wall faces the right of a->b): the curb face toward the road, the back
        # wall, and end walls only at strip ends. A CCW top walks c0->c1->o1->o0 with the inside on the left.
        if ccw:
            L.wall('sidewalk', c0, c1, 0., za, 0., zb)
            L.wall('sidewalk', o1, o0, 0., zb, 0., za)
            ends[k] = ((o0, c0, za), (c1, o1, zb))
        else:
            L.wall('sidewalk', c1, c0, 0., zb, 0., za)
            L.wall('sidewalk', o0, o1, 0., za, 0., zb)
            ends[k] = ((c0, o0, za), (o1, c1, zb))
        status[k] = 'raised'
        surfaces.add(poly, max(za, zb), 'sidewalk', min(za, zb))
        counts['sidewalk_pieces'] += 1
        counts['sidewalk_metres'] += math.dist(c0, c1) / 100
        if min(za, zb) < Z_WALK - .01 and max(za, zb) >= Z_WALK - .01:
            counts['curb_ramps'] += 1
        # Light curb top band (15 cm), except where a curb extension carries the curb out into the road, and a
        # saw-cut joint at the piece start.
        d = math.dist(c0, o0) or 1.
        d1 = math.dist(c1, o1) or 1.
        x0, x1 = f0 * length, f1 * length
        for g0, g1 in subtract((x0, x1), cuts):
            if g1 - g0 < 1.:
                continue
            t0, t1 = (g0 - x0) / (x1 - x0), (g1 - x0) / (x1 - x0)
            e0, e1 = lerp(c0, c1, t0), lerp(c0, c1, t1)
            b0, b1 = lerp(lerp(c0, o0, 15 / d), lerp(c1, o1, 15 / d1), t0), lerp(lerp(c0, o0, 15 / d), lerp(c1, o1, 15 / d1), t1)
            z0, z1 = za + (zb - za) * t0 + .1, za + (zb - za) * t1 + .1
            band = [(e0[0], e0[1], z0), (e1[0], e1[1], z1), (b1[0], b1[1], z1), (b0[0], b0[1], z0)]
            band = band if area([p[:2] for p in band]) > 0 else band[::-1]
            for tri in (quad_triangles(band) if not convex([p[:2] for p in band]) else [band]):
                L.face('curb', tri)
        if k > 0 and joint and za == Z_WALK:
            L.strip('joint', lerp(c0, o0, 16 / d), o0, 1.3, za + .12)
    for k, (start, end) in sorted(ends.items()):
        for (a, b, z), other in ((start, k - 1), (end, k + 1)):
            if other < 0 or other >= pieces or status[other] != 'raised':
                L.wall('sidewalk', a, b, 0., z)
                counts['sidewalk_risers'] += 0 <= other < pieces      # not the strip's own two ends


def _apron_walls(world, L, surfaces, counts):
    """A dropped apron's edge over lower ground (bare floor behind it where no parterre was laid, the gap at a
    ruelle mouth) gets a 9 cm wall once everything else is down, so no step opens onto the floor under it."""
    for poly in world.apron_outlines:
        for a, b in zip(poly, poly[1:] + poly[:1]):
            if math.dist(a, b) < 5.:
                continue
            u, _ = unit(a, b)
            c = add(lerp(a, b, .5), (u[1], -u[0]), 4.)          # right of a->b: outside a CCW outline
            if world.in_building(c) or surfaces.floor(c) >= Z_DROP - 1.:
                continue
            L.wall('curb', a, b, 0., Z_DROP)
            counts['apron_walls'] += 1


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
    quads = list(zip(outer_line, outer_line[1:], inner_line[1:], inner_line[:-1]))
    raised = [abs(area(q)) >= 5 and not world.in_building(lerp(q[0], q[2], .5)) and world.traffic_distance(list(q)) >= CLEAR
              for q in quads]
    for i, (p0, p1, q1, q0) in enumerate(quads):
        quad = [p0, p1, q1, q0]
        if abs(area(quad)) < 5 or world.in_building(lerp(p0, q1, .5)):
            continue
        if world.traffic_distance(quad) < CLEAR:
            for tri in ([p0, p1, q1], [p0, q1, q0]):
                L.flat('curb', tri, Z_DROP)
            surfaces.add(quad if area(quad) > 0 else quad[::-1], Z_DROP, 'apron')
            counts['dropped_aprons'] += 1
            continue
        ccw = area(quad) > 0
        # the ring's sides where it meets a dropped apron, a gap or the strip ends (a strip's end piece may sit on a
        # ramp), so no step opens onto the ground under the slab
        for (a, b), other in (((q0, p0), i - 1), ((p1, q1), i + 1)):
            if other < 0 or other >= len(quads) or not raised[other]:
                L.wall('sidewalk', a, b, 0., Z_WALK) if ccw else L.wall('sidewalk', b, a, 0., Z_WALK)
                counts['corner_risers'] += 0 <= other < len(quads)
        for tri in ([p0, p1, q1], [p0, q1, q0]):
            L.flat('sidewalk', tri, Z_WALK)
            surfaces.add(tri, Z_WALK, 'sidewalk')
        # Curb face along the arc (toward the road) and the back wall along the property line.
        if ccw:
            L.wall('sidewalk', p0, p1, 0., Z_WALK)
            L.wall('sidewalk', q1, q0, 0., Z_WALK)
        else:
            L.wall('sidewalk', p1, p0, 0., Z_WALK)
            L.wall('sidewalk', q0, q1, 0., Z_WALK)
        d0, d1 = math.dist(p0, q0) or 1., math.dist(p1, q1) or 1.
        for tri in ([p0, p1, lerp(p1, q1, 15 / d1)], [p0, lerp(p1, q1, 15 / d1), lerp(p0, q0, 15 / d0)]):
            L.flat('curb', tri, Z_WALK + .1)
        counts['corner_pieces'] += 1


def _straight(run, g1, row):
    """Whether a parterre run (g0, g1, mat, [near0, far0, near1, far1], joints) extended to g1 with the interval
    `row` keeps straight near and far edges through every joint (2 cm)."""
    g0, _, _, (n0, f0, _, _), joints = run
    if abs(run[3][2] - row[0]) > 2. or abs(run[3][3] - row[1]) > 2.:
        return False
    for g, n, f in joints + [(run[1], row[0], row[1])]:
        t = (g - g0) / (g1 - g0)
        if abs(n0 + (row[2] - n0) * t - n) > 2. or abs(f0 + (row[3] - f0) * t - f) > 2.:
            return False
    return True


class YardBarriers:
    """Lines a parterre stops at besides buildings: the carriageways, the ruelle paving, every sidewalk strip and
    corner ring (curb and back lines) and the park edge, for rays cast from a sidewalk's back line."""

    def __init__(self, world):
        self.segs, self.grid = [], Grid(1000.)

        def add_line(points, closed, kind):
            for a, b in zip(points, points[1:] + (points[:1] if closed else [])):
                if math.dist(a, b) > .5:
                    self.grid.add(len(self.segs), bbox([a, b]))
                    self.segs.append((a, b, kind))
        for poly, z, kind in world.surfaces.items:
            if kind in ('road', 'alley'):
                add_line(list(poly), True, kind)
        for strip in world.sidewalk_strips:
            add_line(list(strip['curb']), False, 'sidewalk')
            add_line(list(strip['outer']), False, 'sidewalk')
        for row in world.corners:
            if row['kind'] == 'fillet':
                add_line(list(row['inner']), False, 'sidewalk')
            elif row['kind'] == 'bend':
                add_line(list(row['outer']), False, 'sidewalk')
        if world.park:
            add_line(list(world.park), True, 'park')

    def ray(self, origin, direction, limit):
        return self.ray_kind(origin, direction, limit)[0]

    def ray_kind(self, origin, direction, limit):
        """(distance, kind) of the first line the ray meets within limit, else (None, None)."""
        end = add(origin, direction, limit)
        best = (None, None)
        for i in self.grid.query(bbox([origin, end])):
            a, b, kind = self.segs[i]
            t = ray_seg(origin, direction, a, b)
            if t is not None and t <= limit and (best[0] is None or t < best[0]):
                best = (t, kind)
        return best


def _yard_depths(world, barriers, q, out):
    """Parterre depth behind the sidewalk at q (out: away from the road) and what ends it: ('building', d) up to
    the building line within FRONT_MAX, ('barrier', d) at a street, ruelle, other sidewalk or the park,
    ('open', OPEN_YARD) with nothing near, or None where q is in the park."""
    start = add(q, out, 2.)
    if world.in_park(add(q, out, 20.)):
        return None
    if world.surfaces.has(start, 'alley') or world.surfaces.has(start, 'road'):
        # a ruelle mouth or a carriageway behind the sidewalk; past a ruelle met at a slant, the ground between
        # its paving and the next building is parterre too: (exit, end) along the ray
        x = 10.
        while x < FRONT_MAX and (world.surfaces.has(add(start, out, x), 'alley') or world.surfaces.has(add(start, out, x), 'road')):
            x += 10.
        if x >= FRONT_MAX or world.surfaces.has(add(start, out, x), 'road') or world.in_building(add(start, out, x)):
            return 'mouth', 0.
        lo, hi = x - 10., x
        for _ in range(6):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if world.surfaces.has(add(start, out, mid), 'alley') else (lo, mid)
        exit_ = add(start, out, hi)
        building = world.building_ray(exit_, out, FRONT_MAX - hi)
        other = barriers.ray(add(exit_, out, 1.), out, FRONT_MAX - hi)
        if building is None or (other is not None and other + 1. < building):
            return 'mouth', 0.
        return 'mouth', 0., (hi + 2., hi + 2. + building - 3.)
    if world.in_building(start):
        return 'building', 0.         # the sidewalk runs to the wall here
    building = world.building_ray(start, out, FRONT_MAX)
    other, kind = barriers.ray_kind(start, out, FRONT_MAX)
    if building is not None and (other is None or building <= other):
        return 'building', max(0., building + 2. - 3.)
    if other is not None and (building is not None or other < OPEN_YARD + 3 or kind == 'alley' and other < ALLEY_YARD):
        # a ruelle paved along a building's side wall counts as its side line: the parterre runs up to it
        return 'barrier', max(0., other + 2. - 3.)
    return 'open', OPEN_YARD


def _yards(world, L, surfaces, strip, counts, barriers):
    """Parterres between the sidewalk and the building line, one per ~7.6 m lot: a lawn or bed, often a walk to
    the stoop and a low iron fence. The building line is sampled every 60 cm, so a lot's parterre follows a
    stepped façade, a deep setback or a passage; it stops at a street, a ruelle's paving, another sidewalk or the
    park, and past a ruelle met at a slant it fills the ground up to the next wall. A slab in the 300 cm traffic
    band is laid without collision (textured lawn or soil; a walk as curb)."""
    s = strip['seg']
    (ca, cb), (oa, ob) = strip['curb'], strip['outer']
    # away from the road, square to the curb (a mitred strip end's outer point lies off the square)
    u, _ = unit(ca, cb)
    out = (-u[1], u[0]) if (oa[0] - ca[0]) * -u[1] + (oa[1] - ca[1]) * u[0] > 0 else (u[1], -u[0])
    back = (oa, (ob[0] - oa[0], ob[1] - oa[1]))    # the sidewalk's back line
    # Yards reach the sharp property corner at fillet corners; the later arm sits 3 mm higher.
    qa, qb = strip['corner_q']
    if qa is not None and math.dist(qa, oa) < 600:
        oa = qa
    if qb is not None and math.dist(qb, ob) < 600:
        ob = qb
    olen = math.dist(oa, ob)
    strip['lots'] = []
    if olen < 200:
        return
    plex = s['hw'] in ('residential', 'unclassified', 'living_street')
    lots = max(1, round(olen / 760))

    def near(q):
        """How far behind q the sidewalk's back line runs (the lot line toward a corner can cut into it)."""
        hit = line_isect(q, out, back[0], back[1])
        return max(0., hit[0]) if hit else 0.

    for k in range(lots):
        f0, f1 = k / lots, (k + 1) / lots
        p0, p1 = lerp(oa, ob, f0), lerp(oa, ob, f1)
        zoff = strip['corner_z'][0] if k == 0 else strip['corner_z'][1] if k == lots - 1 else 0.
        lot_len = math.dist(p0, p1)
        rng = Rng('yard', s['way'], s['i'], strip['side'], k)

        def sample(f):
            q = lerp(p0, p1, f)
            n = near(q)
            return n, _yard_depths(world, barriers, add(q, out, n), out)
        steps = max(2, math.ceil(lot_len / YARD_STEP))
        fs = [i / steps for i in range(steps + 1)]
        samples = [sample(f) for f in fs]

        def state(smp):
            """None off a ruelle mouth; on one, whether ground lies between its paving and the next wall."""
            return None if smp[1] is None or smp[1][0] != 'mouth' else len(smp[1]) > 2
        # beside a ruelle mouth, the parterre starts where the paving ends (found to 1 cm), not a sample later: a
        # sample either side of the edge, and the parterre's side there (f, toward the mouth +1 or -1) for the wedge
        # between its last ray and a paving edge met at a slant (_mouth_wedge)
        mouths = []
        i = 0
        while i < len(fs) - 1:
            sa, sb = state(samples[i]), state(samples[i + 1])
            if sa != sb and (fs[i + 1] - fs[i]) * lot_len > 2.:
                lo, hi = fs[i], fs[i + 1]
                for _ in range(8):
                    mid = (lo + hi) / 2
                    lo, hi = (mid, hi) if state(sample(mid)) == sa else (lo, mid)
                if sa is None or sb is None:
                    mouths.append((lo, 1) if sa is None else (hi, -1))
                new = [f for f in (lo, hi) if fs[i] < f < fs[i + 1]]
                fs[i + 1:i + 1] = new
                samples[i + 1:i + 1] = [sample(f) for f in new]
                i += len(new)            # go on from the sample on the far side of the edge
                continue
            i += 1
        # (near, far) offsets at the start and end of each interval: the deeper side wins (past a building corner
        # the rest lies under the building; beside an open lot the parterre reaches a building the rays only just
        # meet), but next to a street, a ruelle or another sidewalk the far edge runs straight from one sample to
        # the next, so it follows a line met at a slant instead of stepping over it or short of it
        spans = []
        for (na, a), (nb, b) in zip(samples, samples[1:]):
            if a is None or b is None:
                spans.append((na, na, nb, nb))
                continue
            (ka, da), (kb, db) = a[:2], b[:2]
            if ka in ('barrier', 'mouth') or kb in ('barrier', 'mouth'):
                spans.append((na, na + da, nb, nb + db))
            else:
                spans.append((na, na + max(da, db), nb, nb + max(da, db)))
        walk = plex and lot_len > 420 and rng.chance(.8)
        walk_at = rng.uniform(.18, .82)
        kind = 'Yard_Grass' if rng.chance(.68) else 'Yard_Soil'
        if walk:
            a = max(0., walk_at - 55 / lot_len)
            b = min(1., walk_at + 55 / lot_len)
            pieces = [(0., a, kind), (a, b, 'yard_path'), (b, 1., kind if rng.chance(.7) else 'Yard_Soil')]
        else:
            pieces = [(0., 1., kind)]
        # intervals between the sample and piece breakpoints, merged where material and offsets agree
        marks = sorted(set(fs) | {g for piece in pieces for g in piece[:2]})
        runs = []
        for g0, g1 in zip(marks, marks[1:]):
            if g1 - g0 < 1e-6:
                continue
            mid = (g0 + g1) / 2
            i = max(i for i in range(len(fs) - 1) if fs[i] <= mid)
            na, fa, nb, fb = spans[i]
            t0, t1 = (g0 - fs[i]) / (fs[i + 1] - fs[i]), (g1 - fs[i]) / (fs[i + 1] - fs[i])
            row = [na + (nb - na) * t0, fa + (fb - fa) * t0, na + (nb - na) * t1, fa + (fb - fa) * t1]
            mat = next(m for a, b, m in pieces if a <= mid <= b)
            if runs and runs[-1][2] == mat and runs[-1][1] == g0 and _straight(runs[-1], g1, row):
                runs[-1][1] = g1
                runs[-1][3] = [runs[-1][3][0], runs[-1][3][1], row[2], row[3]]
                runs[-1][4].append((g0, row[0], row[1]))
            else:
                runs.append([g0, g1, mat, row, []])
        laid, depths, front, inset, own = 0, [], [], False, []
        kept = [r for r in runs if min(r[3][1] - r[3][0], r[3][3] - r[3][2]) >= 3]
        for j, (g0, g1, mat, (n0, d0, n1, d1), _) in enumerate(kept):
            q0, q1 = lerp(p0, p1, g0), lerp(p0, p1, g1)
            e0, e1, e2, e3 = add(q0, out, n0), add(q1, out, n1), add(q1, out, d1), add(q0, out, d0)
            pp = [e0, e1, e2, e3]
            if abs(area(pp)) < 50:
                continue
            key = mat
            if world.traffic_distance(pp) < CLEAR:
                key = {'Yard_Grass': 'grass_edge', 'Yard_Soil': 'soil', 'yard_path': 'curb'}[mat]
                counts['yard_slabs_in_traffic_band'] += 1
            L.flat(key, pp, Z_WALK + zoff)
            # walls on the far edge, and on a side only where no parterre of the same depth carries on (the near
            # edge meets the sidewalk at the same height)
            ccw = area(pp) > 0
            prev = kept[j - 1] if j and abs(kept[j - 1][1] - g0) < 1e-9 else None
            nxt = kept[j + 1] if j + 1 < len(kept) and abs(kept[j + 1][0] - g1) < 1e-9 else None
            sides = [(e2, e3)]
            if nxt is None or abs(nxt[3][1] - d1) > 1. or abs(nxt[3][0] - n1) > 1.:
                sides.append((e1, e2))
            if prev is None or abs(prev[3][3] - d0) > 1. or abs(prev[3][2] - n0) > 1.:
                sides.append((e3, e0))
            if _lower_in_front(surfaces, e0, e1, out, Z_WALK + zoff):
                sides.append((e0, e1))          # a dropped apron, a ruelle mouth or bare ground in front
                counts['yard_risers'] += 1
            for x, y in sides:
                L.wall(key, x, y, 0., Z_WALK + zoff) if ccw else L.wall(key, y, x, 0., Z_WALK + zoff)
            surfaces.add(pp if ccw else pp[::-1], Z_WALK, 'yard')
            own.append(pp)
            if mat == 'Yard_Grass' and key == mat:
                _soft_edge(L, e0, e1, out, Rng('edge', s['way'], s['i'], strip['side'], k, round(g0, 4)), zoff,
                           surfaces)
            counts['yard_slabs'] += 1
            counts['yard_square_metres'] += abs(area(pp)) / 10000
            laid += 1
            depths.append(min(d0 - n0, d1 - n1))
            inset |= max(n0, n1) > 1.
            if front and abs(front[-1][1] - g0 * lot_len) < 1.:
                front[-1][1] = g1 * lot_len
            else:
                front.append([g0 * lot_len, g1 * lot_len])
        # past a ruelle met at a slant: the ground between its paving and the next wall
        for i in range(len(fs) - 1):
            (na, a), (nb, b) = samples[i], samples[i + 1]
            if a is None or b is None or len(a) < 3 or len(b) < 3:
                continue
            (xa, ea), (xb, eb) = a[2], b[2]
            q0, q1 = lerp(p0, p1, fs[i]), lerp(p0, p1, fs[i + 1])
            pp = [add(q0, out, na + xa), add(q1, out, nb + xb), add(q1, out, nb + eb), add(q0, out, na + ea)]
            if min(ea - xa, eb - xb) < 3 or abs(area(pp)) < 50:
                continue
            key = kind if world.traffic_distance(pp) >= CLEAR else {'Yard_Grass': 'grass_edge', 'Yard_Soil': 'soil'}[kind]
            counts['yard_slabs_in_traffic_band'] += key != kind
            L.flat(key, pp, Z_WALK + zoff)
            for x, y in zip(pp, pp[1:] + pp[:1]):
                L.wall(key, x, y, 0., Z_WALK + zoff)
            surfaces.add(pp, Z_WALK, 'yard')
            counts['yard_slabs_past_ruelle_mouths'] += 1
            counts['yard_square_metres'] += abs(area(pp)) / 10000
        # beside a ruelle mouth met at a slant: the wedge between the parterre's last ray and the paving
        lot_u, _ = unit(p0, p1)
        for f, sign in mouths:
            i = fs.index(f)
            n, res = samples[i]
            if res is None or res[0] == 'mouth':
                continue
            far = n + res[1]
            if 0 <= i - sign < len(fs) and samples[i - sign][1] is not None and samples[i - sign][1][0] != 'mouth':
                i -= sign                       # from the lot's last sample before the edge, past its own slabs
                far = max(far, samples[i][0] + samples[i][1][1])
                n = samples[i][0]
            if far - n < 3:
                continue
            mat = next(m for a, b, m in pieces if a <= fs[i] <= b)
            _mouth_wedge(world, L, surfaces, lerp(p0, p1, fs[i]), out, (lot_u[0] * sign, lot_u[1] * sign), n, far,
                         mat, zoff, counts, own)
        if not laid:
            strip['lots'].append({'p0': p0, 'p1': p1, 'depth': 0, 'out': out})
            continue
        counts['yards'] += 1
        depth = min(depths)
        lot = {'p0': p0, 'p1': p1, 'depth': depth, 'out': out, 'walk': walk_at if walk else None,
               'fence': False, 'kind': kind, 'plex': plex}
        if plex and depth >= 100 and not inset and rng.chance(.72):
            # along the parterre only: never across a ruelle mouth or a passage the parterre stops short of
            _fence(L, p0, p1, out, walk_at if walk else None, rng, counts, [(max(a, 10.), min(b, lot_len - 10.))
                                                                          for a, b in front])
            lot['fence'] = True
            lot['fence_spans'] = [[r2(a), r2(b)] for a, b in front]
        strip['lots'].append(lot)


MOUTH_REACH = 400.        # a parterre's wedge beside a ruelle mouth runs at most this far to the paving


def _lower_in_front(surfaces, a, b, out, z):
    """Whether the ground just in front of edge ab (against out) lies lower than z anywhere along it (a dropped
    apron, the foot of a ramp, a ruelle or bare floor)."""
    return any(surfaces.floor(add(lerp(a, b, f), out, -4.)) < z - 1. for f in (.1, .5, .9))


def _wedge_reach(world, p, side, own):
    """Bare ground from p along side, past the lot's own parterre (`own`: its slabs) up to a ruelle's paving, a
    carriageway, a sidewalk, another parterre, a wall or the park, as (x0, x1) to 1 cm; (0, 0) when nothing stops
    it within MOUTH_REACH."""
    def mine(x):
        c = add(p, side, x)
        return any(point_in(c, poly) for poly in own)

    def stop(x):
        c = add(p, side, x)
        return any(world.surfaces.has(c, kind) for kind in ('alley', 'road', 'sidewalk', 'apron', 'yard')) or \
            world.in_building(c) or world.in_park(c)

    def edge(lo, hi, test):
        for _ in range(7):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if not test(mid) else (lo, mid)
        return lo, hi
    x = 1.
    while x <= MOUTH_REACH and mine(x):
        x += 10.
    if x > MOUTH_REACH:
        return 0., 0.
    x0 = edge(x - 10., x, lambda v: not mine(v))[1] if x > 1. else 0.
    x = x0 + 2.
    while x <= MOUTH_REACH and not stop(x):
        x += 10.
    if x > MOUTH_REACH:
        return 0., 0.
    x1 = edge(max(x0, x - 10.), x, stop)[0] - .5
    return (x0, x1) if x1 - x0 >= 3. else (0., 0.)


def _mouth_wedge(world, L, surfaces, q, out, side, near, far, mat, zoff, counts, own):
    """The ground a parterre leaves bare beside a ruelle mouth met at a slant. From the ray along out at the lot's
    last sample before the mouth (q, near to far behind it), each row every 20 cm of depth runs out along `side`,
    past the lot's own slabs (`own`), to the paving (or a wall, street or other surface); the rows are laid in the
    parterre's material, merged where both ends run straight. Walls face the paving, the far end and a lower apron
    in front."""
    steps = max(1, math.ceil((far - near) / 20.))
    ts = [near + (far - near) * i / steps for i in range(steps + 1)]
    xs = [_wedge_reach(world, add(q, out, t), side, own) for t in ts]

    def straight(i, j):
        return all(abs(xs[m][e] - (xs[i][e] + (xs[j][e] - xs[i][e]) * (ts[m] - ts[i]) / (ts[j] - ts[i]))) <= 2.
                   for m in range(i + 1, j) for e in (0, 1))
    i, last = 0, len(ts) - 1
    while i < last:
        j = i + 1
        while j < last and straight(i, j + 1) and (xs[i][1] > xs[i][0]) == (xs[j + 1][1] > xs[j + 1][0]):
            j += 1
        if xs[i][1] > xs[i][0] or xs[j][1] > xs[j][0]:
            bi, bj = add(q, out, ts[i]), add(q, out, ts[j])
            pp = dedupe([add(bi, side, xs[i][0]), add(bj, side, xs[j][0]), add(bj, side, xs[j][1]),
                         add(bi, side, xs[i][1])])
            key = mat if len(pp) < 3 or world.traffic_distance(pp) >= CLEAR else \
                {'Yard_Grass': 'grass_edge', 'Yard_Soil': 'soil', 'yard_path': 'curb'}[mat]
            if len(pp) >= 3 and L.flat(key, pp, Z_WALK + zoff):
                ccw = area(pp) > 0
                a0, a1, b1, b0 = (add(bi, side, xs[i][0]), add(bj, side, xs[j][0]), add(bj, side, xs[j][1]),
                                  add(bi, side, xs[i][1]))
                edges = [(b1, b0)]                                          # toward the paving
                if j == last:
                    edges.append((a1, b1))
                if i == 0 and _lower_in_front(surfaces, b0, a0, out, Z_WALK + zoff):
                    edges.append((b0, a0))
                for a, b in edges:
                    L.wall(key, a, b, 0., Z_WALK + zoff) if ccw else L.wall(key, b, a, 0., Z_WALK + zoff)
                surfaces.add(pp if ccw else pp[::-1], Z_WALK, 'yard')
                counts['yard_mouth_wedges'] += 1
                counts['yard_mouth_wedge_square_metres'] += abs(area(pp)) / 10000
                counts['yard_square_metres'] += abs(area(pp)) / 10000
        i = j


PASSAGE_STEP = 50.        # side passages between buildings: the back line is sampled this often
PASSAGE_WIDE = 900.       # a gap between two buildings this wide or less is a passage (wider: a lot or a yard)
PASSAGE_DEEP = 150.       # its floor runs at least this much deeper than the façades either side
PASSAGE_LONG = 3000.      # and its walk at most this far behind the sidewalk
PASSAGE_ROW = 25.         # the walk is laid in rows across the passage this far apart


def _passages(world, L, surfaces, strip, counts, stops):
    """Concrete walks in the side passages between neighbouring buildings (the gap between two plexes that leads to
    the yards): where the building line steps back more than PASSAGE_DEEP for no more than PASSAGE_WIDE between two
    façades, a walk runs from the end of the parterre to where the passage opens out (its side walls end), a
    building, a Plex yard, fence or ground, a ruelle, a sidewalk or a street, at most PASSAGE_LONG behind the
    sidewalk. The parterres stop at the building line; the walk carries on, so no bare floor shows between the
    houses from the street."""
    (ca, cb), (oa, ob) = strip['curb'], strip['outer']
    u, olen = unit(oa, ob)
    out = (-u[1], u[0]) if (oa[0] - ca[0]) * -u[1] + (oa[1] - ca[1]) * u[0] > 0 else (u[1], -u[0])
    steps = int(olen // PASSAGE_STEP)
    if steps < 3:
        return
    xs = [olen * i / steps for i in range(steps + 1)]
    deep = []                            # distance to the building behind each sample (0 at a wall, inf with none)
    for x in xs:
        q = add(oa, u, x)
        if world.in_park(add(q, out, 20.)):
            deep.append(None)
        elif world.in_building(add(q, out, 3.)):
            deep.append(0.)
        else:
            b = world.building_ray(add(q, out, 2.), out, PASSAGE_LONG)
            deep.append(math.inf if b is None else b + 2.)
    i = 1
    while i < len(xs) - 1:
        left = deep[i - 1]
        if left is None or deep[i] is None or left == math.inf or deep[i] < left + PASSAGE_DEEP:
            i += 1
            continue
        # the passage ends at the first sample PASSAGE_DEEP shallower than all of it (the next façade), if one
        # comes within PASSAGE_WIDE of the last façade
        lowest, k, right = deep[i], i + 1, None
        while k < len(xs) and deep[k] is not None and xs[k] - xs[i - 1] <= PASSAGE_WIDE + PASSAGE_STEP:
            if deep[k] < math.inf and deep[k] + PASSAGE_DEEP <= lowest:
                right = deep[k]
                break
            lowest = min(lowest, deep[k])
            k += 1
        if right is None:
            i += 1
            continue
        _passage_walk(world, L, surfaces, strip, counts, stops, oa, u, out, xs, i, k - 1, left, right)
        i = k


def _passage_walk(world, L, surfaces, strip, counts, stops, oa, u, out, xs, i, j, left, right):
    """One passage (samples i..j between façades `left` and `right` deep at samples i-1 and j+1), laid row by row
    every PASSAGE_ROW of depth: each row runs across from a seed (the passage's middle, which follows a slanted
    passage) to the walls, a parterre or a Plex yard on either side, from the parterre's end until the passage
    opens out (a side reaches nothing within PASSAGE_WIDE), meets a building, a Plex yard, a ruelle or a street, or
    runs PASSAGE_LONG behind the sidewalk."""
    at = lambda x, y: add(add(oa, u, x), out, y)                     # noqa: E731
    back = (-u[0], -u[1])

    def blocked(p):
        return world.in_building(p) or stops.on_plex(p) or \
            any(surfaces.has(p, k) for k in ('alley', 'road', 'sidewalk', 'apron', 'yard'))

    def reach(p, d):
        hits = [h for h in (world.building_ray(p, d, PASSAGE_WIDE), stops.ray(p, d, PASSAGE_WIDE)) if h is not None]
        return min(hits) if hits else None
    # from the sidewalk's back line, past the parterre (which may stop short of the façade line: an open 2.5 m
    # parterre where the building behind the passage stands more than FRONT_MAX back)
    x, y = (xs[i] + xs[j]) / 2, 5.
    while y < max(left, right) + FRONT_MAX and blocked(at(x, y)):
        y += PASSAGE_ROW
    rows = []
    while y < PASSAGE_LONG:
        p = at(x, y)
        if blocked(p):
            break
        lo, hi = reach(p, back), reach(p, u)
        if lo is None or hi is None or lo + hi > PASSAGE_WIDE + PASSAGE_STEP:
            break                                                    # the passage opens out
        rows.append((y, x - lo, x + hi))
        x = x + (hi - lo) / 2
        nxt = stops.ray(at(x, y), out, PASSAGE_ROW)
        if nxt is not None:                                          # a Plex yard, a ruelle or a street ahead
            if nxt > 1.:
                rows.append((y + nxt - .5, rows[-1][1], rows[-1][2]))
            break
        y += PASSAGE_ROW
    if len(rows) < 2:
        return
    laid = 0
    # The lead-in: the first row starts where the seed column clears the parterres, which may be past what stops
    # the walk at the row's own ends (the parterre's far edge, a parterre walk reaching deeper, a façade corner), so
    # a quad from that edge, found to 1 cm at both ends of the first row, closes the gap where bare floor showed;
    # searched back all the way first, then a 50 cm window, and laid only where it overlaps nothing. A side or the
    # near edge above lower ground gets a wall.
    y0, l0, r0 = rows[0]

    def near_edge(xc, reach):
        """Depth of what stops the walk at xc, searched back from the first row in 10 cm steps up to reach."""
        if blocked(at(xc, y0)):
            return y0
        y = y0
        while y0 - y < reach and y > 5. and not blocked(at(xc, y - 10.)):
            y -= 10.
        if y0 - y >= reach or y <= 5.:
            return y0
        lo, hi = y - 10., y
        for _ in range(8):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if blocked(at(xc, mid)) else (lo, mid)
        return hi + .5

    def clear(quad):
        """No sample inside the quad lies on a parterre, a Plex yard or a building (the lead-in would overlap)."""
        return not any(blocked(lerp(lerp(quad[0], quad[3], g), lerp(quad[1], quad[2], g), f))
                       for f in (.15, .5, .85) for g in (.15, .5, .85))
    for reach in (y0, 2 * PASSAGE_ROW):
        yl, yr = near_edge(l0 + 3., reach), near_edge(r0 - 3., reach)
        lead = [at(l0, yl), at(r0, yr), at(r0, y0), at(l0, y0)]
        if clear(lead):
            break
    lead_laid = False
    if max(y0 - yl, y0 - yr) > 1. and len(dedupe(lead)) >= 3 and clear(lead):
        key = 'yard_path' if world.traffic_distance(lead) >= CLEAR else 'curb'
        if L.flat(key, lead, Z_WALK):
            lead_laid = True
            ccw = area(lead) > 0
            for a, b, d in ((lead[0], lead[1], (-out[0], -out[1])), (lead[1], lead[2], u), (lead[3], lead[0], back)):
                c = add(lerp(a, b, .5), d, 1.5)       # close in: the parterre's far edge may run a few cm off it
                if math.dist(a, b) > 1. and not world.in_building(c) and surfaces.floor(c) < Z_WALK - 1.:
                    L.wall(key, a, b, 0., Z_WALK) if ccw else L.wall(key, b, a, 0., Z_WALK)
            surfaces.add(dedupe(lead) if ccw else dedupe(lead)[::-1], Z_WALK, 'yard')
            counts['passage_square_metres'] += abs(area(lead)) / 10000
            counts['passage_lead_ins'] += 1
    k, last = 0, len(rows) - 1

    def straight(a, b):
        return all(abs(rows[m][e] - (rows[a][e] + (rows[b][e] - rows[a][e]) * (rows[m][0] - rows[a][0]) /
                                    (rows[b][0] - rows[a][0]))) <= 3. for m in range(a + 1, b) for e in (1, 2))
    while k < last:
        m = k + 1
        while m < last and straight(k, m + 1):
            m += 1
        (y0, l0, r0), (y1, l1, r1) = rows[k], rows[m]
        pp = [at(l0, y0), at(r0, y0), at(r1, y1), at(l1, y1)]
        key = 'yard_path' if world.traffic_distance(pp) >= CLEAR else 'curb'
        if L.flat(key, pp, Z_WALK):
            ccw = area(pp) > 0
            edges = [(pp[2], pp[3])] if m == last else []            # the far end, toward the yard
            if k == 0 and not lead_laid and any(
                    surfaces.floor(add(lerp(pp[0], pp[1], f), out, -1.5)) < Z_WALK - 1. and
                    not world.in_building(add(lerp(pp[0], pp[1], f), out, -1.5)) for f in (.1, .5, .9)):
                edges.append((pp[0], pp[1]))                         # the near end over a sliver of bare floor
            for a, b in ((pp[1], pp[2]), (pp[3], pp[0])):            # a side on a fence or Plex ground
                mid = lerp(a, b, .5)
                c = add(mid, (u[0] if a is pp[1] else -u[0], u[1] if a is pp[1] else -u[1]), 4.)
                if not world.in_building(c) and not surfaces.has(c, 'yard'):
                    edges.append((a, b))
            for a, b in edges:
                L.wall(key, a, b, 0., Z_WALK) if ccw else L.wall(key, b, a, 0., Z_WALK)
            surfaces.add(pp if ccw else pp[::-1], Z_WALK, 'yard')
            counts['passage_square_metres'] += abs(area(pp)) / 10000
            laid += 1
        k = m
    counts['passages'] += laid > 0


def _soft_edge(L, a, b, out, rng, zoff=0., surfaces=None):
    """Jittered grass spill over the sidewalk edge so the seam is not a ruler line; a tuft spills only over a
    sidewalk top at the parterre's height, never over a dropped apron, a ramp or bare floor, where it would
    float."""
    length = math.dist(a, b)
    steps = max(2, int(length / 38))
    pts_in, pts_out, base = [], [], []
    for i in range(steps + 1):
        p = lerp(a, b, i / steps)
        base.append(p)
        pts_in.append(add(p, out, -rng.uniform(0., 9.)))
        pts_out.append(add(p, out, rng.uniform(6., 16.)))
    for i, (p0, p1, q1, q0) in enumerate(zip(pts_in, pts_in[1:], pts_out[1:], pts_out[:-1])):
        if surfaces is not None and any(surfaces.floor(add(q, out, -5.)) < Z_WALK + zoff - 1. for q in
                                        (base[i], lerp(base[i], base[i + 1], .5), base[i + 1])):
            continue
        poly = [p0, p1, q1, q0]
        if area(poly) < 0:
            poly = poly[::-1]
        L.flat('grass_edge', poly, Z_WALK + .14 + zoff)


def _fence(L, p0, p1, out, walk, rng, counts, runs=None):
    """A low iron fence 9 cm behind the sidewalk along runs (cm from p0; the whole lot by default), open at the
    walk."""
    length = math.dist(p0, p1)
    u = ((p1[0] - p0[0]) / length, (p1[1] - p0[1]) / length)
    a, b = add(p0, out, 9), add(p1, out, 9)
    h = rng.choice((62., 72., 80.))
    spans = runs if runs is not None else [(10., length - 10.)]
    if walk is not None:
        g0, g1 = walk * length - 62, walk * length + 62
        spans = [piece for span in spans for piece in subtract(span, [(g0, g1)])]
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


def legacy_marking_faces():
    """The 452 centre dashes of the live 'OSM Marking' actor, in the map frame."""
    vs, faces = [], []
    for line in LEGACY_MARKING.read_text().splitlines():
        if line.startswith('v '):
            _, x, y, z = line.split()
            vs.append((float(x), -float(y), float(z)))
        elif line.startswith('f '):
            faces.append([vs[int(t.split('/')[0]) - 1] for t in line.split()[1:]])
    return faces


def _legacy_dashes(world, L, counts):
    """apply_plateau_replica.py hides 'OSM Marking' because its dashes would poke through the new asphalt.
    Re-author, unchanged, the dashes that no replica carriageway covers (the skipped Panet/Visitation
    route roads), so nothing loses its centre line."""
    kept = 0
    for face in legacy_marking_faces():
        c = (sum(p[0] for p in face) / len(face), sum(p[1] for p in face) / len(face))
        if world.surfaces.has(c, 'road'):
            continue
        if L.flat('legacy_marking', [p[:2] for p in face], face[0][2]):
            kept += 1
    counts['legacy_route_dashes'] = kept


class PaveStops:
    """Lines a ruelle's paving stops at on its way out to a wall past the fence line: the Plex yards (their rect,
    lane and side fences, sheds and the ground on lots with no yard), the sidewalks and the carriageways."""

    def __init__(self, world, plex, alleys=False, yards=False):
        self.segs, self.grid = [], Grid(1000.)

        def line(points, closed=False):
            points = [tuple(q[:2]) for q in points]
            for a, b in zip(points, points[1:] + (points[:1] if closed else [])):
                if math.dist(a, b) > .5:
                    self.grid.add(len(self.segs), bbox([a, b]))
                    self.segs.append((a, b))
        self.grounds, self.ground_grid = [], Grid(1000.)

        def ground(poly):
            poly = [tuple(q[:2]) for q in poly]
            line(poly, True)
            self.ground_grid.add(len(self.grounds), bbox(poly))
            self.grounds.append(poly)
        for lot in (plex.lots if plex else []):
            rear = lot['rear']
            yard, fence = rear.get('yard') or {}, rear.get('fence') or {}
            if yard.get('rect'):
                ground(yard['rect'])
            if fence.get('line'):
                line(fence['line'])
            for side in rear.get('side_fences') or []:
                line(side)
            for cell in (rear.get('open_ground') or {}).get('cells') or []:
                ground(cell[1:])
            if lot['shed_poly']:
                ground(lot['shed_poly'])
        # ...and a sample on a sidewalk or a carriageway (a ruelle's mouth) keeps the fence-line reach, so the
        # paving never runs along a sidewalk band
        self.zones, self.zone_grid = [], Grid(1000.)

        def zone(poly):
            line(poly, True)
            self.zone_grid.add(len(self.zones), bbox(poly))
            self.zones.append(poly)
        for strip in world.sidewalk_strips:
            zone([strip['curb'][0], strip['curb'][1], strip['outer'][1], strip['outer'][0]])
        for poly, _, kind in world.surfaces.items:
            if kind == 'road':
                zone(list(poly))
            elif kind == 'alley' and alleys or kind == 'yard' and yards:
                line(poly, True)

    def inside(self, p):
        return any(point_in(p, self.zones[i]) for i in self.zone_grid.query((p[0], p[1], p[0], p[1])))

    def on_plex(self, p):
        """Whether p lies in a Plex yard, shed or ground cell."""
        return any(point_in(p, self.grounds[i]) for i in self.ground_grid.query((p[0], p[1], p[0], p[1])))

    def ray(self, origin, direction, limit):
        end = add(origin, direction, limit)
        best = None
        for i in self.grid.query(bbox([origin, end])):
            t = ray_seg(origin, direction, *self.segs[i])
            if t is not None and t <= limit and (best is None or t < best):
                best = t
        return best


def _alley_profile(world, pa, pb, stops=None):
    """Paving reach either side of a ruelle segment, sampled every metre: the yard fence line (ALLEY_PAVE) or the
    nearest wall, never inside the 430 cm lane strip; past the fence line, out to a wall within WALL_PAVE where no
    Plex yard, fence, shed or ground, sidewalk or carriageway lies before it (a building's side or rear wall on the
    lane, a garage). Where the reach jumps between two samples (a wall begins or ends), two more samples bracket
    the jump to 1 cm. Returns the sample distances and reaches {1: left, -1: right} (left of pa->pb)."""
    u, length = unit(pa, pb)
    n = (-u[1], u[0])

    def sample(t):
        c = add(pa, u, t)
        if world.in_building(c):
            return True, ALLEY_HALF, ALLEY_HALF
        out = []
        for k in (1, -1):
            d = (n[0] * k, n[1] * k)
            hit = world.building_ray(c, d, WALL_PAVE)
            if hit is not None and hit <= ALLEY_PAVE:
                out.append(max(ALLEY_HALF, hit))
            elif hit is not None and stops is not None and not stops.inside(c):
                stop = stops.ray(c, d, WALL_PAVE)
                out.append(hit if stop is None or stop > hit else ALLEY_PAVE)
            else:
                out.append(ALLEY_PAVE)
        return False, out[0], out[1]
    steps = max(1, math.ceil(length / PAVE_STEP))
    rows = [(length * i / steps, sample(length * i / steps)) for i in range(steps + 1)]
    fine = [rows[0]]
    for (ta, a), (tb, b) in zip(rows, rows[1:]):
        for side in (1, 2):
            if abs(a[side] - b[side]) > 20. and not a[0] and not b[0]:
                lo, hi = ta, tb
                for _ in range(7):
                    mid = (lo + hi) / 2
                    m = sample(mid)
                    lo, hi = (mid, hi) if abs(m[side] - a[side]) < abs(m[side] - b[side]) else (lo, mid)
                for tt in (lo, hi):
                    if ta < tt < tb and all(abs(tt - f[0]) > .1 for f in fine):
                        fine.append((tt, sample(tt)))
        fine.append((tb, b))
    fine.sort(key=lambda r: r[0])
    ts = [r[0] for r in fine]
    under = [r[1][0] for r in fine]
    reach = {1: [r[1][1] for r in fine], -1: [r[1][2] for r in fine]}
    # at a building corner between two samples the wider reach holds over the interval (the rest runs under the
    # building), so no bare wedge opens where a wall ends; a reach past the fence line spreads no farther than it
    for k in (1, -1):
        r = reach[k]
        reach[k] = [r[i] if under[i] else max(r[i], min(ALLEY_PAVE, max(r[max(0, i - 1):i + 2]))) for i in range(len(r))]
    return {'t': ts, 1: reach[1], -1: reach[-1]}


GUTTER_HALF = 18.          # the ruelle's centre gutter: 36 cm of aged concrete...
GUTTER_DEPTH = 1.5         # ...sunk in a shallow V below the asphalt either side


def gutter_z(lateral):
    """Height of the gutter's V at `lateral` cm from the ruelle's centre line (the asphalt's height at its edges)."""
    return Z_ALLEY - GUTTER_DEPTH * max(0., 1. - abs(lateral) / GUTTER_HALF)


def _gutter(L, pa, u, n, t0, t1):
    """One piece of the ruelle's centre gutter from t0 to t1 cm along pa + u t: two faces sloping 1.5 cm down to the
    centre line, on the aged lane concrete with their own UVs (u metres along the ruelle, v metres across it with the
    centre line at v = 0.5, where the texture's damp channel runs)."""
    for lo, hi in ((-GUTTER_HALF, 0.), (0., GUTTER_HALF)):
        pts, uv = [], []
        for t, lat in ((t0, lo), (t1, lo), (t1, hi), (t0, hi)):
            p = add(add(pa, u, t), n, lat)
            pts.append((p[0], p[1], gutter_z(lat)))
            uv.append((t / 100., (lat + 50.) / 100.))
        L.uvface('Concrete_Lane_Aged', pts, uv)


def _pave_runs(profile):
    """Sample index runs (i, j) along which both reaches vary linearly (within 1.5 cm), each 20 m or shorter."""
    ts, runs, i = profile['t'], [], 0
    last = len(ts) - 1

    def linear(i, j):
        for k in (1, -1):
            r = profile[k]
            for m in range(i + 1, j):
                f = (ts[m] - ts[i]) / (ts[j] - ts[i])
                if abs(r[m] - (r[i] + (r[j] - r[i]) * f)) > 1.5:
                    return False
        return True
    while i < last:
        j = i + 1
        while j < last and ts[j + 1] - ts[i] <= PAVE_PIECE and linear(i, j + 1):
            j += 1
        runs.append((i, j))
        i = j
    return runs


def _ruelles(world, L, surfaces, counts):
    """Ruelles paved from fence to fence: asphalt from the centreline out to the yard fence line (290 cm, where
    plateau_plex stands the lane fences) or to a wall where one stands nearer, sampled every metre and laid in
    pieces of 20 m or less, with a concrete centre gutter, wedges on the outside of the bends and, at the fence
    foot, a thin weedy edge of crushed stone or grass (mostly grass on the ruelles vertes)."""
    world.alleys = []
    box = world.box
    world.plex = PlexYards.load(world)
    stops = PaveStops(world, world.plex)
    for w in world.ways:
        t = w['tags']
        if t.get('highway') != 'service' or t.get('service') != 'alley':
            continue
        pts = [world.nodes[r] for r in w['refs']]
        segs, profiles = [], []
        for a, b in zip(pts, pts[1:]):
            clip = clip_param(a, b, box)
            if clip is None:
                continue
            pa, pb = lerp(a, b, clip[0]), lerp(a, b, clip[1])
            if math.dist(pa, pb) < 100 or world.route_near(lerp(pa, pb, .5)):
                continue
            segs.append((pa, pb))
            profiles.append(_alley_profile(world, pa, pb, stops))
        if not segs:
            continue
        joints = set()
        for k, ((pa, pb), profile) in enumerate(zip(segs, profiles)):
            u, length = unit(pa, pb)
            n = (-u[1], u[0])
            ts = profile['t']
            for i, j in _pave_runs(profile):
                poly = [add(add(pa, u, ts[i]), n, -profile[-1][i]), add(add(pa, u, ts[j]), n, -profile[-1][j]),
                        add(add(pa, u, ts[j]), n, profile[1][j]), add(add(pa, u, ts[i]), n, profile[1][i])]
                # the asphalt stops at the gutter's edges either side (the gutter is sunk between them)
                halves = ([poly[0], poly[1], add(add(pa, u, ts[j]), n, -GUTTER_HALF), add(add(pa, u, ts[i]), n, -GUTTER_HALF)],
                          [add(add(pa, u, ts[i]), n, GUTTER_HALF), add(add(pa, u, ts[j]), n, GUTTER_HALF), poly[2], poly[3]])
                if all(L.flat('alley', half, Z_ALLEY) for half in halves):
                    surfaces.add(poly, Z_ALLEY, 'alley')
                    counts['ruelle_pieces'] += 1
                    counts['ruelle_square_metres'] += abs(area(poly)) / 10000
            pieces = max(1, math.ceil(length / PAVE_PIECE))
            for g in range(pieces):
                _gutter(L, pa, u, n, length * g / pieces, length * (g + 1) / pieces)
            for end, t_end in ((pa, 0.), (pb, length)):
                # close the V's open end under the paving (a wall facing out of the segment)
                out = -1. if t_end == 0. else 1.
                a, b = add(end, n, -GUTTER_HALF * out), add(end, n, GUTTER_HALF * out)
                L.face('Concrete_Lane_Aged', [(a[0], a[1], Z_ALLEY), (end[0], end[1], Z_ALLEY - GUTTER_DEPTH),
                                              (b[0], b[1], Z_ALLEY)])
            counts['ruelle_metres'] += length / 100
            counts['ruelle_gutter_metres'] += length / 100
            # the next segment of the way: an outer wedge where the two pavings part
            if k + 1 < len(segs) and math.dist(pb, segs[k + 1][0]) < 1.:
                joints.add(k)
                v, _ = unit(*segs[k + 1])
                turn = math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
                if abs(turn) > math.radians(2):
                    side = -1 if turn > 0 else 1          # turning left opens the right side
                    radius = min(profile[side][-1], profiles[k + 1][side][0])
                    a0 = math.atan2(n[1] * side, n[0] * side)
                    sweep = turn
                    steps = max(1, math.ceil(abs(math.degrees(sweep)) / 15))
                    wedge = [pb] + [add(pb, (math.cos(a0 + sweep * s / steps), math.sin(a0 + sweep * s / steps)), radius)
                                    for s in range(steps + 1)]
                    if L.flat('alley', wedge, Z_ALLEY - .05):
                        surfaces.add(wedge, Z_ALLEY, 'alley')
                        counts['ruelle_joint_wedges'] += 1
        # free ends keep the old round cap of the lane strip, as a half disc past the end so the gutter shows
        for k, (pa, pb) in enumerate(segs):
            u, _ = unit(pa, pb)
            n = (-u[1], u[0])
            for cap, free, turn in ((pa, k == 0 or (k - 1) not in joints, 1.), (pb, k not in joints, -1.)):
                if free:
                    L.flat('alley', [add(cap, (n[0] * math.cos(turn * math.pi * i / 6) - n[1] * math.sin(turn * math.pi * i / 6),
                                               n[0] * math.sin(turn * math.pi * i / 6) + n[1] * math.cos(turn * math.pi * i / 6)),
                                         ALLEY_HALF) for i in range(7)], Z_ALLEY - .05)
        world.alleys.append({'id': w['id'], 'segments': segs, 'traffic': all(inside(world.latlon[r]) for r in w['refs']),
                             'name': t.get('name', ''), 'reach': profiles})
    # The weedy edge at the fence foot (not where a wall stands nearer, never over a carriageway).
    green = green_alleys(world, load_ruelles_vertes())[0]
    world.alley_edges = []
    lanes, lane_grid = [], Grid(2000.)
    for alley in world.alleys:
        for k, (pa, pb) in enumerate(alley['segments']):
            lane_grid.add(len(lanes), bbox([pa, pb], ALLEY_PAVE))
            lanes.append((alley['id'], k, pa, pb))

    def crossing_lane(q, alley_id, k):
        """Inside another ruelle's lane strip (a crossing or a T), where no fence stands."""
        return any(seg_dist(q, a, b) < ALLEY_HALF + 20 for i in lane_grid.query(bbox([q]))
                   for other, j, a, b in (lanes[i],) if other != alley_id or abs(j - k) > 1)
    for alley in world.alleys:
        for k, ((pa, pb), profile) in enumerate(zip(alley['segments'], alley['reach'])):
            u, _ = unit(pa, pb)
            n = (-u[1], u[0])
            ts = profile['t']
            for side in (1, -1):
                rng = Rng('ruelle-edge', alley['id'], round(pa[0]), round(pa[1]), side)
                widths = [rng.uniform(12., 32.) for _ in ts]
                foot = [add(add(pa, u, ts[i]), n, side * (ALLEY_PAVE - 20)) for i in range(len(ts))]
                ok = [abs(profile[side][i] - ALLEY_PAVE) < 1 and not surfaces.has(foot[i], 'road') and
                      not crossing_lane(foot[i], alley['id'], k) for i in range(len(ts))]
                runs, cur = [], []
                for i in range(len(ts)):
                    if not ok[i]:
                        if len(cur) > 1:
                            runs.append(cur)
                        cur = []
                        continue
                    if cur and ts[i] - ts[cur[0]] > PAVE_PIECE:
                        runs.append(cur)
                        cur = [cur[-1]]
                    cur.append(i)
                if len(cur) > 1:
                    runs.append(cur)
                for run in runs:
                    key = 'grass_edge' if rng.chance(.75 if alley['id'] in green else .3) else 'Yard_Gravel'
                    for i, j in zip(run, run[1:]):
                        quad = [add(add(pa, u, ts[i]), n, side * (ALLEY_PAVE - 1)),
                                add(add(pa, u, ts[j]), n, side * (ALLEY_PAVE - 1)),
                                add(add(pa, u, ts[j]), n, side * (ALLEY_PAVE - widths[j])),
                                add(add(pa, u, ts[i]), n, side * (ALLEY_PAVE - widths[i]))]
                        if L.flat(key, quad, Z_ALLEY + .25):
                            counts['ruelle_edge_metres'] += (ts[j] - ts[i]) / 100
                    world.alley_edges.append({'alley': alley['id'], 'a': pa, 'b': pb, 'side': side,
                                              't0': ts[run[0]], 't1': ts[run[-1]], 'key': key})


def alley_paving_z(world, p):
    """Ground height at p on a ruelle's paving, else None."""
    return Z_ALLEY if world.surfaces.has(p, 'alley') else None


# ---------------------------------------------------------------------------------------------
# Street and park trees from the city's inventory, their sidewalk pits, and the few curb extensions
#
# Every street and park tree the game shows comes from the Ville de Montréal's public tree inventory (CC BY 4.0,
# clipped to the district by --clip-trees into Data/Plateau/Inventory/): its position, species and trunk diameter
# (DHP, at breast height). The OSM tree nodes were imported from the same inventory, so an OSM tree within 3 m of
# an inventory tree is the same tree; the rest are kept as OSM trees of unknown species. Street_trees.json lists them
# all, one row each (the contract the apply step and the tree meshes read).
#
# The curb stays where it was measured (pushed out to 550 cm on traffic streets for the runtime's curb parking), so a
# tree the inventory puts in a sidewalk pit (Trottoir) is moved to one: the pit's centre 65 to 80 cm behind the curb
# (the inventory's distance to the pavement where it says less), at the trunk's place along the curb, slid clear of
# crossing ramps, street furniture and the next pit. A tree in a grass verge or at the back of the sidewalk moves to
# a pit only if the replica's sidewalk or carriageway covers it; park, lawn and median trees stay where they are.
# Each pit gets a low wrought-iron guard (cut-out cards, no collision) and cards of residents' autumn planting on the
# soil, seeded per pit.
#
# Curb extensions (saillies) stay only where real ones are: round a tree the inventory lists in a planted saillie
# (Saillie Aménagée) or on a median (Terre-plein: a raised lawn round the trunk where the replica's carriageway, pushed
# out for curb parking, covers the median), within 10 m of an OSM traffic_calming=choker, or within 15 m of a corner,
# for a tree the carriageway still covers there. Each is a trapezoid from the curb, the tree pit (110 x 100 cm) and 25 cm of
# concrete in front, with short chamfered tapers, an 18 cm curb face and the light curb band. Extensions whose clear
# curb between them would not take a parked car (5.4 m) merge into one. Any part in the 300 cm traffic band is laid
# flush at the dropped-curb height without collision, as the sidewalk's own dropped aprons are, and so is an
# extension across a crossing ramp. On a side with no sidewalk the extension is a raised lawn verge; on a corner arc
# it follows the arc piece nearest the trunk. Any other trunk the carriageway covers is listed for the host.
# Adapted from the City of Minneapolis Street Design Guide, "Curb extensions" (tapers of 3:1 to 5:1 where they guide
# traffic, so these short ones only chamfer), and the Ville de Montréal's "Saillies de trottoir" (planted saillies,
# mostly at corners).

INVENTORY = ROOT / 'Data/Plateau/Inventory'
TREE_FILES = ('trees_pmr.json', 'trees_vm.json')
TREE_SOURCE = {'dataset': 'Ville de Montréal, Arbres publics sur le territoire de la Ville (inventaire des arbres)',
               'url': 'https://donnees.montreal.ca/dataset/arbres',
               'resource': '64e28fe6-ef37-437a-972d-d1d3f1f7d891', 'licence': 'CC BY 4.0',
               'attribution': 'Source: Ville de Montréal, données ouvertes (CC BY 4.0)'}
TREE_BOROUGHS = {'trees_pmr.json': 'Le Plateau-Mont-Royal', 'trees_vm.json': 'Ville-Marie'}
OSM_TREE_SAME = 300.      # an OSM tree this near an inventory tree is that tree (the OSM nodes came from the inventory)
PIT_BACK = (65., 80.)     # a sidewalk pit's centre stands this far behind the curb
PIT_GAP = 30.             # concrete between two pits along the curb
PIT_EDGE = 25.            # ...and between a pit and the end of its sidewalk strip
RAMP_KEEP = 335.          # a pit's centre stays this far from a crossing ramp's (its 280 cm slope and half a pit)
PIT_SLIDE_MAX = 450.      # a pit slides at most this far along the curb from the trunk's place
PIT_REACH = 600.          # a tree this far from a sidewalk's curb or outer edge may move to a pit on it
CORNER_REACH = 1500.      # an extension at a corner: its tree within 15 m of a junction's curb corner
CHOKER_REACH = 1000.      # ...or within 10 m of an OSM traffic_calming=choker
DATA_REACH = 340.         # a trunk the inventory puts in a saillie or on a median gets one this far from the curb
EXTENSION_REASONS = ('inventory saillie', 'inventory median', 'osm choker', 'corner')
SIDEWALK_PITS = ('TRottoir',)
VERGES = ('Banquette Gazonnée', 'Banquette aSphaltée', 'Banquette Aménagée')
BACK_OF_WALK = ('Fond de Trottoir',)
SAILLIES = ('Saillie Aménagée',)
# OSM street furniture a pit keeps clear of (cm between the node and the pit's edge; a BIXI dock is about 6 m long)
PIT_CLEAR_OF = {('highway', 'street_lamp'): 60., ('emergency', 'fire_hydrant'): 80., ('amenity', 'bench'): 90.,
                ('amenity', 'post_box'): 60., ('amenity', 'waste_basket'): 50., ('amenity', 'recycling'): 60.,
                ('amenity', 'bicycle_rental'): 450., ('highway', 'stop'): 40.}
# Species to the Trees manifest kinds. A species row (a prefix of the Latin name) wins over its genus; an unknown
# species or genus, and the conifers (no conifer kind yet), take a kind by crown size from the trunk (DHP).
TREE_KINDS = ('norway_maple', 'silver_maple', 'honey_locust', 'linden', 'ash', 'small', 'elm')
TREE_SPECIES = (('acer saccharinum', 'silver_maple'), ('acer x freemanii', 'silver_maple'), ('acer ginnala', 'small'),
                ('acer tataricum', 'small'), ('acer palmatum', 'small'), ('acer spicatum', 'small'),
                ('acer campestre', 'small'), ('acer miyabei', 'small'), ('acer negundo', 'small'))
TREE_GENERA = {'Acer': 'norway_maple', 'Platanus': 'norway_maple', 'Populus': 'silver_maple',
               'Ulmus': 'elm', 'Celtis': 'elm', 'Zelkova': 'elm', 'Salix': 'elm',
               'Fraxinus': 'ash', 'Phellodendron': 'ash', 'Carya': 'ash', 'Juglans': 'ash', 'Pterocarya': 'ash',
               'Gleditsia': 'honey_locust', 'Gymnocladus': 'honey_locust', 'Robinia': 'honey_locust',
               'Tilia': 'linden', 'Quercus': 'linden', 'Aesculus': 'linden', 'Catalpa': 'linden', 'Ginkgo': 'linden',
               'Fagus': 'linden', 'Liriodendron': 'linden',
               'Betula': 'small', 'Carpinus': 'small', 'Ostrya': 'small', 'Corylus': 'small', 'Alnus': 'small',
               'Malus': 'small', 'Prunus': 'small', 'Pyrus': 'small', 'Amelanchier': 'small', 'Syringa': 'small',
               'Crataegus': 'small', 'Cercis': 'small', 'Cornus': 'small', 'Magnolia': 'small', 'Sorbus': 'small',
               'Morus': 'small', 'Cercidiphyllum': 'small', 'Rhamnus': 'small', 'Maackia': 'small',
               'Cladrastis': 'small'}
CONIFERS = ('Pinus', 'Picea', 'Larix', 'Thuja', 'Taxus', 'Tsuga', 'Abies', 'Juniperus', 'Pseudotsuga',
            'Metasequoia', 'Taxodium', 'Chamaecyparis')
# Height from trunk diameter (DHP, cm -> cm), research-plateau.md §10.4 for silver and Norway maple: 10 cm about 6 m,
# 30 cm 13 m, 60 cm 20 m, 100 cm and over 24 to 28 m. The small kinds stay at 70% of it, under 11 m.
DBH_HEIGHT = ((0., 250.), (10., 600.), (30., 1300.), (60., 2000.), (100., 2500.), (230., 2800.))
OSM_DBH_DEFAULT = 25.     # an OSM tree with no inventory tree within 30 m


def tree_kind(species, dbh):
    """The Trees manifest kind of a species (the inventory's Latin name), else by crown size from the trunk."""
    name = (species or '').strip()
    low = name.lower()
    for prefix, kind in TREE_SPECIES:
        if low.startswith(prefix):
            return kind
    genus = name.split(' ')[0] if name else ''
    if genus in TREE_GENERA:
        return TREE_GENERA[genus]
    d = dbh if dbh is not None else OSM_DBH_DEFAULT
    return 'silver_maple' if d >= 45. else 'norway_maple' if d >= 20. else 'small'


def tree_height(kind, dbh):
    """Height (cm) from the trunk diameter (cm), interpolated in DBH_HEIGHT."""
    d = max(0., dbh)
    h = DBH_HEIGHT[-1][1]
    for (d0, h0), (d1, h1) in zip(DBH_HEIGHT, DBH_HEIGHT[1:]):
        if d <= d1:
            h = h0 + (h1 - h0) * (d - d0) / (d1 - d0)
            break
    return min(1100., .7 * h) if kind == 'small' else h


def _number(value):
    try:
        v = float(str(value).replace(',', '.'))
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


def load_tree_inventory():
    """The committed inventory clip: (file, record) for every record, in file order (sorted by the inventory's
    borough and location number when clipped)."""
    out = []
    for name in TREE_FILES:
        path = INVENTORY / name
        if path.is_file():
            out += [(name, r) for r in json.loads(path.read_text())['trees']]
    return out


def clip_trees(*paths):
    """Write Data/Plateau/Inventory/trees_pmr.json and trees_vm.json from datastore extracts of the city's tree
    inventory: the records inside the district box (prepare_lafontaine.BOUNDS), one file per borough, sorted by
    borough and location number (EMP_NO), all fields but the search ranking, one record per line."""
    rows = {name: [] for name in TREE_FILES}
    by_borough = {v: k for k, v in TREE_BOROUGHS.items()}
    hashes = {}
    for path in paths:
        raw = Path(path).read_bytes()
        hashes[Path(path).name] = hashlib.sha256(raw).hexdigest()
        for r in json.loads(raw):
            lat, lon = _number(r.get('Latitude')), _number(r.get('Longitude'))
            if lat is None or lon is None or not inside((lat, lon)) or r.get('ARROND_NOM') not in by_borough:
                continue
            rows[by_borough[r['ARROND_NOM']]].append({k: v for k, v in r.items() if not k.startswith('rank ')})
    INVENTORY.mkdir(parents=True, exist_ok=True)
    docs = {}
    for name, records in rows.items():
        records.sort(key=lambda r: (int(r['ARROND']), int(r['EMP_NO']), r['_id']))
        head = {'source': dict(TREE_SOURCE, borough=TREE_BOROUGHS[name], extract_sha256=hashes),
                'box_lat_lon': list(BOUNDS), 'frame': 'WGS84 latitude and longitude (Latitude, Longitude); '
                'Coord_X and Coord_Y in the city\'s MTM zone 8', 'count': len(records)}
        text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "trees": [\n' + \
            ',\n'.join('  ' + json.dumps(r, ensure_ascii=False, sort_keys=True) for r in records) + '\n ]\n}\n'
        (INVENTORY / name).write_text(text)
        docs[name] = len(records)
    return docs


def mapped_trees(world):
    """The OSM natural=tree nodes inside the district, in file order, as (node id, xy): the trees the saved map
    instanced before the inventory (plateau_rendering.tree_positions)."""
    return [(n, world.nodes[n]) for n, t in world.node_tags.items()
            if t.get('natural') == 'tree' and n in world.nodes and inside(world.latlon[n])]


def street_tree_rows(world):
    """Every street and park tree, unplaced: the inventory's (in clip order), then the OSM trees with no inventory
    tree within OSM_TREE_SAME. Each row: id, p (xy), source, species, species_fr, dbh_cm, dbh_from, placement (the
    inventory's Emplacement, or 'osm'), street."""
    rows, grid = [], Grid(1000.)
    for name, r in load_tree_inventory():
        lat, lon = _number(r['Latitude']), _number(r['Longitude'])
        if lat is None or lon is None or not inside((lat, lon)):
            continue
        p = xy(lat, lon)
        dbh = _number(r.get('DHP'))
        grid.add(len(rows), bbox([p]))
        rows.append({'id': f"inv:{r['ARROND']}-{r['EMP_NO']}", 'p': p, 'source': 'inventory',
                     'species': r.get('Essence_latin') or 'unknown', 'species_fr': r.get('Essence_fr'),
                     'dbh_cm': dbh if dbh is not None else OSM_DBH_DEFAULT,
                     'dbh_from': 'inventory' if dbh is not None else 'default',
                     'placement': r.get('Emplacement') or '', 'street': r.get('Rue') or r.get('NOM_PARC') or '',
                     'pave_cm': None if _number(r.get('Distance_pave')) is None else 100. * _number(r['Distance_pave']),
                     'inv_type': r.get('INV_TYPE')})
    inventory = len(rows)
    for node, p in mapped_trees(world):
        near = [rows[i] for i in grid.query(bbox([p], OSM_TREE_SAME))]
        if any(math.dist(p, t['p']) < OSM_TREE_SAME for t in near):
            continue
        around = sorted(t['dbh_cm'] for t in (rows[i] for i in grid.query(bbox([p], 3000.)))
                        if t['dbh_from'] == 'inventory' and math.dist(p, t['p']) < 3000.)
        dbh = around[len(around) // 2] if around else OSM_DBH_DEFAULT
        rows.append({'id': f'osm:{node}', 'p': p, 'source': 'osm', 'species': 'unknown', 'species_fr': None,
                     'dbh_cm': dbh, 'dbh_from': 'neighbours' if around else 'default', 'placement': 'osm',
                     'street': '', 'pave_cm': None, 'inv_type': None})
    world.tree_inventory_rows = inventory
    return rows


def curb_edges(world):
    """Curb lines with their road side n: each sidewalk strip's curb, each piece of a corner fillet or bend arc,
    and the carriageway edge of a side with no sidewalk (a verge). back: how far an extension reaches behind it."""
    edges = []
    for strip in world.sidewalk_strips:
        (ca, cb), (oa, _) = strip['curb'], strip['outer']
        u, length = unit(ca, cb)
        n = (-u[1], u[0])
        if (oa[0] - ca[0]) * n[0] + (oa[1] - ca[1]) * n[1] > 0:
            n = (-n[0], -n[1])
        edges.append({'kind': 'strip', 'a': ca, 'u': u, 'n': n, 'len': length, 'back': 0., 'strip': strip})
    for row in world.corners:
        if row['kind'] not in ('fillet', 'bend') or world.route_near(row['a']['o']) or row['a']['wL'] <= 0 or \
                row['b']['wR'] <= 0:
            continue
        centre = row['C'] if row['kind'] == 'fillet' else row['a']['o']
        for p, q in zip(row['arc'], row['arc'][1:]):
            if math.dist(p, q) < 1:
                continue
            u, length = unit(p, q)
            n = (-u[1], u[0])
            m = lerp(p, q, .5)
            away = (m[0] - centre[0]) * n[0] + (m[1] - centre[1]) * n[1] > 0
            if (row['kind'] == 'fillet') != away:          # a fillet's road lies outside its circle
                n = (-n[0], -n[1])
            edges.append({'kind': 'corner', 'a': p, 'u': u, 'n': n, 'len': length, 'back': CORNER_BACK})
    for s in world.segs:
        if s['excluded'] or not s['quad']:
            continue
        for side in ('L', 'R'):
            if s['w' + side] > 0:
                continue
            ea, eb = world.ends[(s['i'], 'a', side)][0], world.ends[(s['i'], 'b', side)][0]
            if math.dist(ea, eb) < 60:
                continue
            u, length = unit(ea, eb)
            n = (-s['n'][0], -s['n'][1]) if side == 'L' else s['n']
            edges.append({'kind': 'verge', 'a': ea, 'u': u, 'n': n, 'len': length, 'back': VERGE_BACK, 'seg': s})
    return edges


def corner_points(world):
    """The curb corners of every junction of three or more arms: each fillet's or bend's arc midpoint, or a mitre's
    curb point. Extensions not listed by the data stand within CORNER_REACH of one."""
    pts = []
    for j in world.junctions:
        if j['excluded'] or len(j['arms']) < 3:
            continue
        for row in j['corners']:
            if row.get('arc'):
                pts.append(row['arc'][len(row['arc']) // 2])
            elif row.get('P') is not None:
                pts.append(row['P'])
    return pts


def _strip_frames(world):
    """Per sidewalk strip: its curb start, direction, the inward normal (toward its outer line), length, widths at
    both ends and polygon."""
    frames = []
    for strip in world.sidewalk_strips:
        (ca, cb), (oa, ob) = strip['curb'], strip['outer']
        u, length = unit(ca, cb)
        n = (-u[1], u[0])
        if (oa[0] - ca[0]) * n[0] + (oa[1] - ca[1]) * n[1] < 0:
            n = (-n[0], -n[1])
        wa = (oa[0] - ca[0]) * n[0] + (oa[1] - ca[1]) * n[1]
        wb = (ob[0] - cb[0]) * n[0] + (ob[1] - cb[1]) * n[1]
        frames.append({'strip': strip, 'a': ca, 'u': u, 'n': n, 'len': length, 'wa': wa, 'wb': wb,
                       'poly': [ca, cb, ob, oa], 'claims': []})
    return frames


def _frame_at(frame, s, d):
    return (frame['a'][0] + frame['u'][0] * s + frame['n'][0] * d, frame['a'][1] + frame['u'][1] * s + frame['n'][1] * d)


def _pit_rect(frame, s, d, hl=PIT_L / 2, hd=PIT_D / 2):
    return [_frame_at(frame, s + x, d + y) for x, y in ((-hl, -hd), (hl, -hd), (hl, hd), (-hl, hd))]


def _fit_pit(world, frame, s0, d, obstacles):
    """The along-curb place nearest s0 (10 cm steps, up to PIT_SLIDE_MAX) where a pit centred d behind the curb lies
    on its strip, off every other carriageway and building, clear of the crossing ramps, the OSM street furniture and
    the strip's other pits; None if there is none."""
    length = frame['len']
    ramps = frame['strip'].get('ramps', [])
    seg = frame['strip']['seg']['i']
    steps = int(PIT_SLIDE_MAX // 10)
    for k in sorted(range(-steps, steps + 1), key=lambda v: (abs(v), v)):
        s = s0 + 10. * k
        if s - PIT_L / 2 < PIT_EDGE or s + PIT_L / 2 > length - PIT_EDGE:
            continue
        if any(abs(s - r) < RAMP_KEEP for r in ramps) or any(abs(s - c) < PIT_L + PIT_GAP for c in frame['claims']):
            continue
        width = frame['wa'] + (frame['wb'] - frame['wa']) * s / length
        if d + PIT_D / 2 > width - 5.:
            continue
        rect = _pit_rect(frame, s, d)
        if not all(point_in(c, frame['poly']) and not on_pavement(world, c, seg) and not world.in_building(c)
                   for c in rect + [_frame_at(frame, s, d)]):
            continue
        if not all(_raised_piece(world, frame, k) for k in _pieces_under(frame, s - PIT_L / 2, s + PIT_L / 2)):
            continue
        if any(poly_point_dist(rect, q) < r or point_in(q, rect) for q, r in obstacles.near(rect)):
            continue
        return s
    return None


def _pieces_under(frame, x0, x1):
    """Indices of the strip's 1.5 m sidewalk pieces (as _sidewalk_strip cuts them) that [x0, x1] along it touches."""
    pieces = max(1, round(frame['len'] / 150))
    size = frame['len'] / pieces
    return range(max(0, int(x0 // size)), min(pieces, int(x1 // size) + 1))


def _raised_piece(world, frame, k):
    """Whether _sidewalk_strip lays piece k of the strip raised at the curb height: clear of the traffic band (else a
    dropped apron), its middle on no other carriageway and in no building. A pit stands only on raised pieces."""
    strip = frame['strip']
    (ca, cb), (oa, ob) = strip['curb'], strip['outer']
    pieces = max(1, round(frame['len'] / 150))
    f0, f1 = k / pieces, (k + 1) / pieces
    poly = [lerp(ca, cb, f0), lerp(ca, cb, f1), lerp(oa, ob, f1), lerp(oa, ob, f0)]
    mid = lerp(lerp(poly[0], poly[1], .5), lerp(poly[3], poly[2], .5), .5)
    return world.traffic_distance(poly) >= CLEAR and not on_pavement(world, mid, strip['seg']['i']) and \
        not world.in_building(mid) and not any(world.in_building(q) for q in poly[:2])


class _Obstacles:
    """OSM street furniture nodes a pit keeps clear of."""

    def __init__(self, world):
        self.items, self.grid = [], Grid(1000.)
        for n, t in world.node_tags.items():
            if n not in world.nodes:
                continue
            for (k, v), r in PIT_CLEAR_OF.items():
                if t.get(k) == v:
                    self.grid.add(len(self.items), bbox([world.nodes[n]], r))
                    self.items.append((world.nodes[n], r))
                    break

    def near(self, poly):
        return [self.items[i] for i in self.grid.query(bbox(poly, 10.))]


def place_street_trees(world, L, counts):
    """Place every street and park tree (see above): sidewalk pits drawn here with their guards and planting, the
    rows kept for street_trees.json, and the curb extensions planned for _draw_extensions."""
    rows = street_tree_rows(world)
    frames = _strip_frames(world)
    grid = Grid(1500.)
    for i, f in enumerate(frames):
        grid.add(i, bbox(f['poly'], PIT_REACH))
    obstacles = _Obstacles(world)
    corners = corner_points(world)
    corner_grid = Grid(2000.)
    for i, c in enumerate(corners):
        corner_grid.add(i, bbox([c], CORNER_REACH))
    chokers = [world.nodes[n] for n, t in world.node_tags.items()
               if t.get('traffic_calming') == 'choker' and n in world.nodes]
    world.tree_corners, world.tree_chokers = corners, chokers

    def near_corner(p):
        return any(math.dist(p, corners[i]) <= CORNER_REACH for i in corner_grid.query(bbox([p])))

    def near_choker(p):
        return any(math.dist(p, c) <= CHOKER_REACH for c in chokers)

    kept, dropped, wanted = [], [], []
    for t in rows:
        p = t['p']
        t.update(pit=False, extension=None, moved_cm=0., at=p)
        if world.in_building(p):
            t['why'] = 'inside a building footprint'
            dropped.append(t)
            counts['trees_dropped_in_buildings'] += 1
            continue
        kept.append(t)
        # Only the carriageways and ruelles are down yet: a trunk over carriageway asphalt may still end up on a
        # median lawn or a sidewalk laid later, which finish_street_trees checks.
        on_road = world.surfaces.has(p, 'road')
        t['on_road'] = on_road
        best = None
        for i in grid.query(bbox([p])):
            f = frames[i]
            rel = (p[0] - f['a'][0], p[1] - f['a'][1])
            s, d = rel[0] * f['u'][0] + rel[1] * f['u'][1], rel[0] * f['n'][0] + rel[1] * f['n'][1]
            if not -50. <= s <= f['len'] + 50.:
                continue
            width = f['wa'] + (f['wb'] - f['wa']) * max(0., min(1., s / f['len']))
            gap = -d if d < 0 else d - width if d > width else 0.
            if gap <= PIT_REACH and (best is None or (gap, abs(d)) < best[0]):
                best = ((gap, abs(d)), i, s, d, width)
        on_walk = best is not None and best[0][0] == 0.
        kind = t['placement']
        lat = None
        median = kind.startswith('Terre-plein')
        if best is not None and not (kind in SAILLIES and on_road) and not median:
            _, i, s, d, width = best
            back = min(PIT_BACK[1], max(PIT_BACK[0], t['pave_cm'] if t['pave_cm'] is not None else
                                        PIT_BACK[0] + (PIT_BACK[1] - PIT_BACK[0]) * Rng('pit-back', t['id']).random()))
            if kind in SIDEWALK_PITS:
                lat = back
            elif kind in BACK_OF_WALK:
                lat = max(PIT_BACK[0], width - PIT_D / 2 - 15.)
            elif on_road:
                lat = back
            elif on_walk:
                lat = max(PIT_BACK[0], min(width - PIT_D / 2 - 5., d))
        if lat is not None:
            wanted.append((best[1], best[2], lat, t))
        elif on_road:
            t['extension_wanted'] = True
    # Pits, strip by strip along the curb (the order fixes which tree slides when two want one place).
    wanted.sort(key=lambda w: (w[0], w[1], w[3]['id']))
    pits = []
    for i, s0, lat, t in wanted:
        f = frames[i]
        s = _fit_pit(world, f, max(PIT_L / 2 + PIT_EDGE, min(f['len'] - PIT_L / 2 - PIT_EDGE, s0)), lat, obstacles)
        if s is None:
            if t['on_road']:
                t['extension_wanted'] = True
            elif point_in(t['p'], f['poly']):
                t['no_pit'] = True
                counts['trees_on_sidewalk_without_pit'] += 1
            continue
        f['claims'].append(s)
        c = _frame_at(f, s, lat)
        t.update(pit=True, at=c, moved_cm=math.dist(c, t['p']), pit_yaw=math.degrees(math.atan2(f['u'][1], f['u'][0])),
                 pit_z=Z_WALK + .15, curb_cm=lat, strip=f['strip'])
        pits.append((f, s, lat, t))
    for f, s, lat, t in pits:
        q = lambda x, y, f=f, s=s, lat=lat: _frame_at(f, s + x, lat + y)      # noqa: E731
        _pit(L, q, Z_WALK, Rng('pit', t['id']), counts)
        f['strip'].setdefault('pits', []).append((s, t['at'], t['pit_yaw']))
        counts['sidewalk_pits'] += 1
        counts['tree_pits'] += 1
        if t['moved_cm'] > 1.:
            counts['sidewalk_pits_moved'] += 1
            counts['sidewalk_pit_metres_moved'] += t['moved_cm'] / 100.
    for f in frames:
        if f['strip'].get('pits'):
            f['strip']['pits'].sort(key=lambda r: r[0])
    # Curb extensions: only where the data shows one or at a corner; every other covered trunk goes to the host.
    ext_trees = []
    for t in kept:
        if t['pit'] or not t['on_road']:
            continue
        reason = None
        if t.get('extension_wanted'):
            reason = 'inventory saillie' if t['placement'] in SAILLIES else \
                'inventory median' if t['placement'].startswith('Terre-plein') else \
                'osm choker' if near_choker(t['p']) else 'corner' if near_corner(t['p']) else None
        if reason is None:
            # resolved in finish_street_trees: on a sidewalk or lawn laid later, or for the host
            t['host'] = 'on the carriageway mid-block: no extension in the data there, and not at a corner'
            continue
        t['extension_reason'] = reason
        ext_trees.append(t)
    world.street_tree_list, world.street_tree_dropped = kept, dropped
    counts['street_trees'] = len(kept)
    counts['street_trees_inventory'] = sum(1 for t in kept if t['source'] == 'inventory')
    counts['street_trees_osm'] = sum(1 for t in kept if t['source'] == 'osm')
    return curb_extensions(world, counts, ext_trees)


def _pit(L, q, z, rng, counts):
    """A tree pit's soil (110 x 100 cm, q(along, across) from its centre), its low wrought-iron guard and the
    residents' planting, seeded per pit: a guard on all four sides (most), open on the curb side, or a low edging
    on four sides; one to four planted cards on the soil round the trunk, each showing its own stretch of the
    planting card's 1 m run, of its own height."""
    hx, hy = PIT_L / 2, PIT_D / 2
    L.flat('soil', [q(-hx, -hy), q(hx, -hy), q(hx, hy), q(-hx, hy)], z + .15)
    style = rng.random()
    height = (14. + 6. * rng.random()) if style < .12 else (34. + 10. * rng.random())
    sides = (((-hx, -hy), (hx, -hy)), ((hx, -hy), (hx, hy)), ((hx, hy), (-hx, hy)), ((-hx, hy), (-hx, -hy)))
    if .12 <= style < .3:
        sides = sides[1:]                                   # open toward the curb (the -y side)
    inset = 2.
    u0 = rng.uniform(0., .5)
    for (x0, y0), (x1, y1) in sides:
        a = q(x0 + (inset if x0 < 0 else -inset), y0 + (inset if y0 < 0 else -inset))
        b = q(x1 + (inset if x1 < 0 else -inset), y1 + (inset if y1 < 0 else -inset))
        counts['pit_guard_cards'] += L.card('Iron_Wrought', a, b, z + .15, z + .15 + height, u0=u0)
        u0 += math.dist(a, b) / 100.
    layout = rng.random()
    if layout < .35:            # a bed along each long side of the trunk
        cards = [((-hx + 10., -24.), (hx - 10., -24.)), ((hx - 10., 24.), (-hx + 10., 24.))]
    elif layout < .6:           # a ring of four short beds round the trunk
        cards = [((-38., -26.), (38., -26.)), ((38., 26.), (-38., 26.)), ((-36., -20.), (-36., 20.)),
                 ((36., 20.), (36., -20.))]
    elif layout < .85:          # one long bed behind the trunk and a short one in front
        cards = [((-hx + 8., 26.), (hx - 8., 26.)), ((-30., -27.), (30., -27.))]
    else:                       # a single clump beside the trunk
        cards = [((12., -30.), (46., -6.))]
    for a, b in cards:
        top = z + .15 + rng.uniform(26., 46.)
        counts['pit_flower_cards'] += L.card('Plant_Pit_Flowers', q(*a), q(*b), z + .15, top, u0=rng.random())


def _envelope(group, A):
    """Breakpoints (x, depth) of an extension's front: each tree's flat top over its pit and tapers, bridged to the
    next tree where they merged."""
    xs = set()
    traps = [(t['s'], t['D'], t['taper']) for t in group]
    bridges = []
    for (s0, d0, _), (s1, d1, _) in zip(traps, traps[1:]):
        if s1 - A > s0 + A:
            bridges.append((s0 + A, d0, s1 - A, d1))
    for s, d, tau in traps:
        xs |= {s - A - tau, s - A, s + A, s + A + tau}
    for x0, _, x1, _ in bridges:
        xs |= {x0, x1}

    def f(x):
        best = 0.
        for s, d, tau in traps:
            off = abs(x - s)
            if off <= A:
                best = max(best, d)
            elif off < A + tau:
                best = max(best, d * (A + tau - off) / tau)
        for x0, d0, x1, d1 in bridges:
            if x0 <= x <= x1:
                best = max(best, d0 + (d1 - d0) * (x - x0) / (x1 - x0))
        return best
    return sorted(xs), f


def curb_extensions(world, counts, trees):
    """Plan the curb extensions (see above) round `trees` (place_street_trees' rows the carriageway covers where the
    data shows an extension or near a corner) and the host list; marks each strip's curb band cuts."""
    edges = curb_edges(world)
    grid = Grid(1500.)
    for i, e in enumerate(edges):
        grid.add(i, bbox([e['a'], add(e['a'], e['u'], e['len'])], BUMP_REACH + 100))
    A = PIT_L / 2 + BUMP_MARGIN
    host, by_edge = [], {}
    for t in trees:
        p = t['p']
        best = None
        for i in grid.query(bbox([p])):
            e = edges[i]
            rel = (p[0] - e['a'][0], p[1] - e['a'][1])
            s, d = rel[0] * e['u'][0] + rel[1] * e['u'][1], rel[0] * e['n'][0] + rel[1] * e['n'][1]
            if -40 <= s <= e['len'] + 40 and d >= -5 and (best is None or d < best[0]):
                best = (d, i, s)
        reach = DATA_REACH if t['extension_reason'].startswith('inventory') else BUMP_REACH
        if best is None or best[0] > reach:
            t['host'] = f'more than {reach / 100:g} m from the curb' if best else 'no curb edge faces it'
            t['from_curb_cm'] = r2(best[0]) if best else None
            continue
        d, i, s = best
        D = max(BUMP_MIN, d + PIT_D / 2 + BUMP_MARGIN)
        near = nearest_seg(world, p)
        by_edge.setdefault(i, []).append({'node': t['id'], 'p': p, 's': s, 'd': max(0., d), 'D': D, 'tree': t,
                                          'taper': min(BUMP_TAPER_MAX, BUMP_TAPER * D),
                                          'street': near[1]['name'] if near else t['street']})
    extensions = []
    for i in sorted(by_edge):
        e = edges[i]
        rows = sorted(by_edge[i], key=lambda t: (t['s'], t['node']))
        groups = [[rows[0]]]
        for t in rows[1:]:
            end = max(g['s'] + A + g['taper'] for g in groups[-1])
            if t['s'] - A - t['taper'] - end < PARK_GAP:
                groups[-1].append(t)
            else:
                groups.append([t])
        for group in groups:
            xs, f = _envelope(group, A)
            lo, hi = xs[0], xs[-1]
            if e['kind'] != 'corner':
                lo, hi = max(0., lo), min(e['len'], hi)
            xs = sorted({x for x in xs if lo <= x <= hi} | {lo, hi})
            front = [(x, f(x)) for x in xs]
            deepest = max(dd for _, dd in front)
            reasons = [t['tree']['extension_reason'] for t in group]
            reason = next(r for r in EXTENSION_REASONS if r in reasons)
            ext = {'edge': e, 'trees': group, 'x': (lo, hi), 'front': front, 'deepest': deepest, 'reason': None,
                   'why': reason}
            ramps = e['strip']['ramps'] if e['kind'] == 'strip' else []
            if any(lo - 150 < r < hi + 150 for r in ramps):
                raised, ext['reason'] = 0., 'crossing ramp'
            else:
                raised = _raised_depth(world, e, front, deepest)
                if raised < deepest:
                    ext['reason'] = 'traffic band'
            # no pit straddles the step between the raised part and the flush part
            changed = True
            while changed and raised > 0:
                changed = False
                for t in group:
                    if t['d'] - PIT_D / 2 - 15 < raised < t['d'] + PIT_D / 2 + 15:
                        raised, changed = t['d'] - PIT_D / 2 - 15, True
            if raised < RAISED_MIN:
                raised = 0.
            ext['raised'] = raised
            extensions.append(ext)
            counts['curb_extensions_' + reason.split(' ')[-1]] += 1
            for t in group:
                t['tree']['extension'] = len(extensions) - 1
            if e['kind'] == 'strip' and raised > 0:
                e['strip'].setdefault('bump_cuts', []).append((lo, hi))
    return extensions


def finish_street_trees(world, counts):
    """The street_trees.json rows, once every surface is down: each tree's final place, its ground height and the
    host list."""
    rows, host = [], []
    for t in world.street_tree_list:
        x, y = t['at']
        z = t.get('pit_z')
        if z is None:
            z, top = world.surfaces.at(t['at'])
            if t.get('host') and top != 'road' and z >= Z_DROP - .5:
                t['host'] = None                    # it stands on a median lawn or a sidewalk after all
        if t['on_road'] and (t.get('host') or t.get('extension') is not None):
            counts['trees_on_carriageway'] += 1
        if not t['pit'] and not t.get('host') and t.get('extension') is None and not t.get('no_pit'):
            counts['trees_kept_in_place'] += 1
        kind = tree_kind(t['species'] if t['source'] == 'inventory' else None, t['dbh_cm'])
        genus = (t['species'] or '').split(' ')[0]
        row = {'id': t['id'], 'x_cm': r2(x), 'y_cm': r2(y), 'z_cm': r2(z), 'species': t['species'],
               'species_fr': t['species_fr'], 'kind': kind, 'dbh_cm': t['dbh_cm'],
               'height_cm': round(tree_height(kind, t['dbh_cm'] if t['dbh_cm'] is not None else OSM_DBH_DEFAULT)),
               'height_from': 'dbh' if t['dbh_from'] == 'inventory' else 'dbh_' + t['dbh_from'],
               'source': t['source'], 'placement': t['placement'], 'street': t['street'], 'pit': bool(t['pit']),
               'yaw_deg': seed('tree-yaw', t['id']) % 360}
        if t['dbh_from'] != 'inventory':
            row['dbh_from'] = t['dbh_from']
        if genus in CONIFERS:
            row['conifer'] = True
        if t['pit']:
            row['pit_yaw_deg'] = r2(t['pit_yaw'] % 360)
            if t.get('curb_cm') is not None:
                row['pit_from_curb_cm'] = r2(t['curb_cm'])
        if t['moved_cm'] > 1.:
            row['moved_cm'] = r2(t['moved_cm'])
            row['mapped_xy_cm'] = [r2(t['p'][0]), r2(t['p'][1])]
        if t.get('extension') is not None:
            row['extension'] = t['extension']
        if t.get('host'):
            host.append({'id': t['id'], 'position': [r2(t['p'][0]), r2(t['p'][1])], 'street': t['street'],
                         'placement': t['placement'], 'from_curb_cm': t.get('from_curb_cm'),
                         'traffic_centreline_cm': r2(world.traffic_distance(t['p'], 2000)), 'reason': t['host']})
        rows.append(row)
    world.street_tree_rows, world.tree_host = rows, host
    counts['trees_for_host'] = len(host)


def _local(e, x, n):
    return (e['a'][0] + e['u'][0] * x + e['n'][0] * n, e['a'][1] + e['u'][1] * x + e['n'][1] * n)


def _raised_depth(world, e, front, deepest):
    """How deep the raised (colliding) part of an extension may reach and stay out of the traffic band."""
    def clear(h):
        for (x0, d0), (x1, d1) in zip(*(lambda f: (f, f[1:]))(_with_crossings(front, h))):
            if x1 - x0 < .5:
                continue
            poly = [_local(e, x0, -e['back']), _local(e, x1, -e['back']), _local(e, x1, min(d1, h)),
                    _local(e, x0, min(d0, h))]
            if world.traffic_distance(dedupe(poly)) < CLEAR:
                return False
        return True
    if clear(deepest):
        return deepest
    lo, hi = 0., deepest
    if not clear(lo):
        return 0.
    for _ in range(14):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if clear(mid) else (lo, mid)
    return lo


def _with_crossings(front, level):
    """The front polyline with a vertex wherever it crosses depth `level`."""
    out = [front[0]]
    for (x0, d0), (x1, d1) in zip(front, front[1:]):
        if (d0 - level) * (d1 - level) < 0:
            x = x0 + (x1 - x0) * (level - d0) / (d1 - d0)
            out.append((x, level))
        out.append((x1, d1))
    return out


PIT_SLIDE = 35.            # a pit slides at most this far along the curb from its trunk (which stays 20 cm inside it)


def _pit_slide(e, ext, t, back, z, surfaces):
    """How far along the curb a tree's pit slides to stay on its extension: one cut short at the strip's end (a
    trunk by the corner) leaves no room on one side, and the pit would hang over the carriageway. The smallest
    shift, in 5 cm steps up to PIT_SLIDE, whose pit lies within the extension's length and under its front, with
    the part behind the curb on the extension's back or on ground at its height; else 0 (a trunk at or past the
    strip's end, see the README's Limits)."""
    lo, hi = ext['x']
    front = ext['front']

    def depth(x):
        for (x0, d0), (x1, d1) in zip(front, front[1:]):
            if x0 <= x <= x1 and x1 > x0:
                return d0 + (d1 - d0) * (x - x0) / (x1 - x0)
        return -1e9

    def fits(sx):
        x0, x1 = sx - PIT_L / 2, sx + PIT_L / 2
        if x0 < lo - .01 or x1 > hi + .01:
            return False
        n0, n1 = t['d'] - PIT_D / 2, t['d'] + PIT_D / 2
        if any(depth(x) < n1 - .5 for x in (x0 + .01, sx, x1 - .01)):
            return False
        return n0 >= -back - .01 or all(surfaces.floor(_local(e, x, n0)) >= z - 1. for x in (x0, sx, x1))
    for shift in sorted({k * 5. * sign for k in range(int(PIT_SLIDE // 5) + 1) for sign in (1, -1)},
                        key=lambda v: (abs(v), v)):
        if fits(t['s'] + shift):
            return shift
    return 0.


def _draw_extensions(world, L, surfaces, extensions, counts):
    """The curb extensions planned by curb_extensions, their tree pits, and the Streets/street_trees.json rows."""
    rows = []
    world.extension_pits = []
    A = PIT_L / 2 + BUMP_MARGIN
    for ext in extensions:
        e, raised, back = ext['edge'], ext['raised'], ext['edge']['back']
        if e['kind'] == 'verge':
            # a verge reaches far enough behind the carriageway edge to hold the pit of a trunk right at it
            back = max(back, PIT_D / 2 + 10. - min(t['d'] for t in ext['trees']))
        top_key = 'Yard_Grass' if e['kind'] == 'verge' else 'sidewalk'
        front = ext['front']
        lo, hi = ext['x']
        if raised > 0:
            pts = [(x, min(d, raised)) for x, d in _with_crossings(front, raised)]
            for (x0, t0), (x1, t1) in zip(pts, pts[1:]):
                if x1 - x0 < .5:
                    continue
                poly = [_local(e, x0, -back), _local(e, x1, -back), _local(e, x1, t1), _local(e, x0, t0)]
                if L.flat(top_key, poly, Z_WALK):
                    surfaces.add(dedupe(poly), Z_WALK, 'yard' if e['kind'] == 'verge' else 'sidewalk')

            def top(x):
                for (x0, t0), (x1, t1) in zip(pts, pts[1:]):
                    if x0 <= x <= x1 and x1 > x0:
                        return t0 + (t1 - t0) * (x - x0) / (x1 - x0)
                return None

            def inside_raised(x, n):
                t = top(x)
                return t is not None and lo - 1e-6 <= x <= hi + 1e-6 and -back - 1e-6 <= n <= t
            outline = [(lo, 0.)] + pts + [(hi, 0.)]
            if e['kind'] == 'verge':
                outline = [(lo, -back)] + pts + [(hi, -back), (lo, -back)]
            for (x0, n0), (x1, n1) in zip(outline, outline[1:]):
                length = math.hypot(x1 - x0, n1 - n0)
                if length < 1.:
                    continue
                cand = ((n1 - n0) / length, -(x1 - x0) / length)        # a normal of the edge, local frame
                mx, mn = (x0 + x1) / 2, (n0 + n1) / 2
                outward = cand if not inside_raised(mx + 2 * cand[0], mn + 2 * cand[1]) else (-cand[0], -cand[1])
                P, Q = _local(e, x0, n0), _local(e, x1, n1)
                ow = (e['u'][0] * outward[0] + e['n'][0] * outward[1], e['u'][1] * outward[0] + e['n'][1] * outward[1])
                if (Q[1] - P[1]) * ow[0] - (Q[0] - P[0]) * ow[1] < 0:
                    P, Q = Q, P
                L.wall(top_key, P, Q, 0., Z_WALK)
                if n0 == n1 == -back and e['kind'] == 'verge':
                    continue                                       # no curb band along a verge's back
                band = [(x0, n0), (x1, n1), (x1 - 15 * outward[0], n1 - 15 * outward[1]),
                        (x0 - 15 * outward[0], n0 - 15 * outward[1])]
                L.flat('curb', [_local(e, x, n) for x, n in band], Z_WALK + .1)
            # the part behind the curb line (back cm over the sidewalk, or past a corner arc that curves away from
            # the extension's frame) gets a wall on a side or along its back wherever the ground there lies lower,
            # so no step opens onto the floor under the slab
            if e['kind'] != 'verge':
                behind = [((lo, -back), (lo, 0.)), ((hi, 0.), (hi, -back))] + \
                         [((x1, -back), (x0, -back)) for (x0, _), (x1, _) in zip(pts, pts[1:]) if x1 - x0 >= .5]
                for (x0, n0), (x1, n1) in behind:
                    length = math.hypot(x1 - x0, n1 - n0)
                    if length < 1.:
                        continue
                    cand = ((n1 - n0) / length, -(x1 - x0) / length)
                    mx, mn = (x0 + x1) / 2, (n0 + n1) / 2
                    outward = cand if not inside_raised(mx + 2 * cand[0], mn + 2 * cand[1]) else (-cand[0], -cand[1])
                    P, Q = _local(e, x0, n0), _local(e, x1, n1)
                    ow = (e['u'][0] * outward[0] + e['n'][0] * outward[1], e['u'][1] * outward[0] + e['n'][1] * outward[1])
                    c = add(lerp(P, Q, .5), ow, 4.)
                    if world.in_building(c) or surfaces.floor(c) >= Z_WALK - 1.:
                        continue
                    if (Q[1] - P[1]) * ow[0] - (Q[0] - P[0]) * ow[1] < 0:
                        P, Q = Q, P
                    L.wall(top_key, P, Q, 0., Z_WALK)
                    counts['curb_extension_back_walls'] += 1
        # the flush part: in the traffic band, across a ramp, or the whole extension
        level = raised if raised > 0 else -back
        flush = [(x, d) for x, d in _with_crossings(front, level)]
        for (x0, d0), (x1, d1) in zip(flush, flush[1:]):
            if x1 - x0 < .5 or max(d0, d1) <= level + .5 or min(d0, d1) < level - .5:
                continue
            poly = [_local(e, x0, level), _local(e, x1, level), _local(e, x1, d1), _local(e, x0, d0)]
            if L.flat('curb', poly, Z_DROP):
                surfaces.add(dedupe(poly), Z_DROP, 'apron')
        yaw = math.degrees(math.atan2(e['u'][1], e['u'][0]))
        for t in ext['trees']:
            z = Z_WALK if t['d'] + PIT_D / 2 + 15 <= raised else Z_DROP
            shift = _pit_slide(e, ext, t, back, z, surfaces)
            sx = t['s'] + shift
            counts['tree_pits_slid'] += shift != 0
            q = lambda x, y: _local(e, sx + x, t['d'] + y)            # noqa: E731
            _pit(L, q, z, Rng('pit', t['node']), counts)
            t['tree'].update(pit=True, pit_z=z + .15, pit_yaw=yaw)
            world.extension_pits.append((t['node'], t['p'], yaw, z))
            counts['tree_pits'] += 1
            counts['curb_extension_trees'] += 1
        counts['curb_extensions'] += 1
        counts['curb_extensions_merged'] += len(ext['trees']) > 1
        counts['curb_extensions_flush'] += raised == 0
        counts['curb_extensions_part_flush'] += 0 < raised < ext['deepest']
        counts['curb_extension_metres'] += (hi - lo) / 100
        counts['curb_extensions_on_verges'] += e['kind'] == 'verge'
        counts['curb_extensions_on_corners'] += e['kind'] == 'corner'
        rows.append({'trees': [t['node'] for t in ext['trees']], 'edge': e['kind'], 'reason': ext['why'],
                     'street': ext['trees'][0]['street'],
                     'curb': [[r2(v) for v in _local(e, lo, 0.)], [r2(v) for v in _local(e, hi, 0.)]],
                     'road_normal': [round(e['n'][0], 4), round(e['n'][1], 4)],
                     'from_curb_cm': [r2(t['d']) for t in ext['trees']], 'depth_cm': r2(ext['deepest']),
                     'raised_cm': r2(raised), 'flush_reason': ext['reason'] if raised < ext['deepest'] else None,
                     'pits': [[r2(t['p'][0]), r2(t['p'][1]), r2(Z_WALK if t['d'] + PIT_D / 2 + 15 <= raised else Z_DROP)]
                              for t in ext['trees']]})
    world.extension_rows = rows


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
        clear = collides and collision_clear(world, prop, p, yaw)
        row = placement(world, prop, p, yaw, clear, parts, extra, z)
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
            # clear of the crossing ramps and of the tree pits (a pit runs 15 to 130 cm behind the curb)
            if all(abs(x - r) > 400 for r in strip.get('ramps', [])) and \
                    all(abs(x - pit[0]) > PIT_L / 2 + 25. for pit in strip.get('pits', [])):
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
        clear = collides and collision_clear(world, prop, p, yaw)
        row = placement(world, prop, p, yaw, clear, parts, extra, z)
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

    # Leaves drifted along the ruelles' sunken centre gutters.
    _gutter_drifts(world, S, counts)

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
                ground = world.surfaces.at(p)
                if ground[1] not in ('sidewalk', 'yard'):
                    continue
                _leaf(S, p, rng, ground[0] + .35)
                counts['loose_leaves'] += 1
        (ca, cb), length = strip['curb'], strip['len']
        rng = Rng('curb-weeds', s['i'], strip['side'])
        cuts = strip.get('bump_cuts', [])
        x = rng.uniform(100, 900)
        while x < length - 100:
            p = lerp(ca, cb, x / length)
            if rng.chance(.5) and not any(a <= x <= b for a, b in cuts):
                _tuft(S, (p[0], p[1], Z_ROAD), rng, .7)
                counts['weed_tufts'] += 1
            x += rng.uniform(300, 1500)
    # Leaves on and round the pits of the curb extensions (at the pit's own height, raised or flush).
    for node, c, yaw, z in getattr(world, 'extension_pits', []):
        rng = Rng('extension-leaves', node)
        if rng.chance(.7):
            key = rng.choice(('leaf_gold', 'leaf_rust', 'leaf_brown'))
            S.flat(key, [(c[0] + rng.uniform(30, 50) * math.cos(i * math.tau / 8 + .3),
                          c[1] + rng.uniform(30, 47) * math.sin(i * math.tau / 8 + .3)) for i in range(8)], z + .3)
            counts['pit_leaf_covers'] += 1
    # Weeds at the ruelle fence feet, along the weedy edge.
    for edge in getattr(world, 'alley_edges', []):
        u, _ = unit(edge['a'], edge['b'])
        n = (-u[1], u[0])
        rng = Rng('ruelle-weeds', edge['alley'], round(edge['a'][0]), round(edge['a'][1]), edge['side'], round(edge['t0']))
        x = edge['t0'] + rng.uniform(50, 400)
        while x < edge['t1'] - 30:
            p = add(add(edge['a'], u, x), n, edge['side'] * (ALLEY_PAVE - rng.uniform(6, 16)))
            _tuft(S, (p[0], p[1], Z_ALLEY + .25), rng, rng.uniform(.8, 1.3))
            counts['weed_tufts'] += 1
            counts['ruelle_fence_weeds'] = counts.get('ruelle_fence_weeds', 0) + 1
            x += rng.uniform(250, 900)

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
    plex = world.plex if getattr(world, 'plex', None) is not None else PlexYards.load(world)
    lane = {'murals': []}
    for e in side_walls:
        mid = lerp(e['a'], e['b'], .5)
        if any(math.dist(mid, m) < 15000 for m in murals) or len(murals) >= 9:
            continue
        # Only a blank wall: a Plex skin with windows (or a detailed front) on it rules the wall out, and a blank
        # Plex skin (16 cm proud of the mass) carries the mural on its face instead of hiding it.
        spot = plex.mural_spot(e['a'], e['b']) if plex else (e['a'], e['b'], 6., None)
        if spot is None or math.dist(spot[0], spot[1]) < 900:
            continue
        murals.append(mid)
        building = world.buildings[e['building']]
        top = min(building['height'], spot[3] or building['height'])
        if _mural(S, {'a': spot[0], 'b': spot[1]}, {'height': top}, Rng('mural-art', building['id']), off=spot[2]):
            counts['murals'] += 1
            lane['murals'].append({'kind': 'street', 'building': building['id'], 'a': [r2(v) for v in spot[0]],
                                   'b': [r2(v) for v in spot[1]], 'offset_cm': spot[2], 'top_cm': r2(top)})

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

    # Ruelles: wooden utility poles and sagging wires.
    world.utility_poles = []
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
        # Laundry no longer hangs from the utility poles: Montréal forbids lines on Hydro and city poles and over
        # the ruelle. The lane life below runs them from the gallery rails to a clothesline pole in the yard.
        world.utility_poles += [p for p, *_ in poles]

    # Lane life: laundry from the galleries, gate props, ruelles vertes and tags (Plex yard records).
    build_lane_life(world, S, put, counts, lane, plex)
    world.lane_life = lane

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


def _gutter_drifts(world, S, counts):
    """Autumn leaves drifted into the ruelles' centre gutters, as the curb drifts: runs of 1 to 4.5 m along under
    half of each segment, up to 32 cm across, lying in the gutter's V 4 mm over it."""
    counts.setdefault('ruelle_gutter_leaf_drifts', 0)
    for alley in getattr(world, 'alleys', []):
        for pa, pb in alley['segments']:
            u, length = unit(pa, pb)
            n = (-u[1], u[0])
            rng = Rng('gutter-leaves', alley['id'], round(pa[0]), round(pa[1]))
            x = rng.uniform(0., 500.)
            while x < length - 120.:
                run = min(rng.uniform(100., 450.), length - 20. - x)
                if run > 60. and rng.chance(.45):
                    key = rng.choice(('leaf_gold', 'leaf_rust', 'leaf_brown', 'leaf_brown'))
                    steps = max(2, int(run / 75.))
                    widths = [math.sin(math.pi * k / steps) * rng.uniform(7., GUTTER_HALF - 2.) + 2. for k in range(steps + 1)]

                    def at(t, lat):
                        p = add(add(pa, u, t), n, lat)
                        return (p[0], p[1], gutter_z(lat) + .4)
                    for k in range(steps):
                        t0, t1 = x + run * k / steps, x + run * (k + 1) / steps
                        w0, w1 = widths[k], widths[k + 1]
                        S.face(key, [at(t0, 0.), at(t1, 0.), at(t1, w1), at(t0, w0)])
                        S.face(key, [at(t0, -w0), at(t1, -w1), at(t1, 0.), at(t0, 0.)])
                    counts['ruelle_gutter_leaf_drifts'] += 1
                x += run + rng.uniform(150., 700.)


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


def newell(points):
    """Right-hand (Newell) normal of a planar polygon, unnormalised."""
    n = [0., 0., 0.]
    for p, q in zip(points, points[1:] + points[:1]):
        n[0] += (p[1] - q[1]) * (p[2] + q[2])
        n[1] += (p[2] - q[2]) * (p[0] + q[0])
        n[2] += (p[0] - q[0]) * (p[1] + q[1])
    return n


def oriented(points, facing):
    """The polygon wound so that its right-hand normal (the writer's outward side) points along `facing`."""
    points = list(points)
    n = newell(points)
    return points if n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] >= 0 else points[::-1]


def _mural(S, edge, building, rng, off=6., z0=130., margin=60., min_h=300., min_w=400.):
    """An original colour-block composition: a split grid, a sun disc and a few triangles, `off` cm out from the
    wall line a->b (the right of a->b is outside), from z0 to 90 cm under the wall top. Every face faces out: with
    one-sided materials a mural wound the other way is culled from the street (the first version was). The disc
    and triangles stand .25 and .4 cm over the blocks, so on a Plex skin (off 16.9) the whole mural stays under
    the Plex creeper cards at 17.5. A fence takes a smaller margin and height."""
    a, b = edge['a'], edge['b']
    length = math.dist(a, b)
    u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    out = (u[1], -u[0])
    facing = (out[0], out[1], 0.)
    x0, x1 = margin, length - margin
    z1 = min(building['height'] - 90, 1050.)
    if z1 - z0 < min_h or x1 - x0 < min_w:
        return False
    palette = rng.choice(MURAL_PALETTES)

    def P(x, z, lift=0.):
        p = add(add(a, u, x), out, off + lift)
        return (p[0], p[1], z)

    def rect(key, xa, xb, za, zb, lift=0.):
        S.face(key, oriented([P(xb, za, lift), P(xa, za, lift), P(xa, zb, lift), P(xb, zb, lift)], facing))

    cols = rng.randint(3, 5)
    xs = sorted([x0, x1] + [rng.uniform(x0 + 80, x1 - 80) for _ in range(cols - 1)])
    for xa, xb in zip(xs, xs[1:]):
        rows = rng.randint(1, 3)
        zs = sorted([z0, z1] + [rng.uniform(z0 + 80, z1 - 80) for _ in range(rows - 1)])
        for za, zb in zip(zs, zs[1:]):
            rect(rng.choice(palette), xa, xb, za, zb)
    cx, cz = rng.uniform(x0 + 150, x1 - 150), rng.uniform(z0 + 150, z1 - 120)
    r = min(rng.uniform(80, 200), (x1 - x0) / 3, (z1 - z0) / 3)
    cx, cz = min(max(cx, x0 + r), x1 - r), min(max(cz, z0 + r), z1 - r)      # the disc stays on the wall
    ring = [P(cx + r * math.cos(-i * math.tau / 20), cz + r * math.sin(-i * math.tau / 20), .25) for i in range(20)]
    S.face(rng.choice(palette), oriented(ring, facing))
    for _ in range(rng.randint(2, 4)):
        bx = rng.uniform(x0, x1 - 150)
        bw = rng.uniform(100, 300)
        bz = min(rng.uniform(z0, z0 + 200), z1 - 30)
        tri = [P(min(x1, bx + bw), bz, .4), P(bx, bz, .4), P(bx + bw / 2, min(z1, bz + rng.uniform(120, 300)), .4)]
        S.face(rng.choice(palette), oriented(tri, facing))
    return True


# ---------------------------------------------------------------------------------------------
# Lane life: laundry from the galleries, life at the gates, ruelles vertes and tags
#
# Reads the Plex layer's yard records (Plex/fronts.json: gallery footprints, deck heights and guard runs, fences,
# gates, sheds, pads and yard trees) and the city's ruelles vertes (Soul/ruelles_vertes_clip.json, written by
# --clip-ruelles from the open data). Without fronts.json the lane life is skipped; without the clip a seeded share
# of the ruelles is green.

PLEX_FRONTS = OUT / 'Plex/fronts.json'
PLEX_MANIFEST = OUT / 'Plex/manifest.json'
RUELLES_VERTES = OUT / 'Soul/ruelles_vertes_clip.json'
RUELLES_VERTES_SOURCE = {
    'title': 'Ruelles vertes', 'publisher': 'Ville de Montréal', 'licence': 'CC BY 4.0',
    'dataset': 'https://donnees.montreal.ca/dataset/ruelles-vertes',
    'mirror': 'https://www.donneesquebec.ca/recherche/dataset/vmtl-ruelles-vertes',
    'resource': 'https://donnees.montreal.ca/dataset/ab3ce7bb-09a7-49d7-8f76-461ed4c39937/resource/'
                '15883136-0180-4061-9860-d7ce3d46c73c/download/ruelles-vertes.geojson'}
PLEX_D_FACE = 16.               # plateau_plex.D_FACE: back-wall skins stand 16 cm proud of the retained mass
PLEX_YARD_D0 = PLEX_D_FACE + 2  # a yard 'rect' starts 2 cm off the skin face (plateau_plex._author_yard)
PLEX_GROUND_Z = {'Yard_Grass': 1.0, 'Yard_Soil': 1.4, 'Yard_Pavers': 1.8, 'Yard_Gravel': 2.0}   # plateau_plex.GROUND_Z
PLEX_POSTS = {'boards': (244., 4.5), 'slats': (300., 3.), 'low': (180., 3.)}   # fence post spacing and half width
ALLEY_HALF = 215.               # half the 430 cm ruelle strip (_ruelles)
GATE_KEEP = 62.                 # gate leaf (46), its post (5) and a hand: no prop stands closer to the gate axis...
GATE_SWING = 100.               # ... within this depth either side of the fence, so the leaf swings free
LAUNDRY_SHARE = .6              # gallery modules with a clothesline pole (half as many on the steel blocks)
LAUNDRY_DECK = .75              # decks of such a module with their own line
LINE_ABOVE_DECK = 100.          # the pulley clamps to the guard's cap rail (94.3-107 cm over the deck)
POLE_TOP = 35.                  # the pole stands this far over its highest pulley
LINE_WALL = 60.                 # a line keeps this far from every wall along its run
LINE_TOP = 1150.                # no line from a gallery higher than this (the steel fire-escape decks of tall blocks)
# The pole stands at the back of the yard, just inside the lane fence, and is taller than the gallery it serves:
# each line rises from its pulley on the rail to the pole, so the lines and the washing on them show over the fences
# from the ruelle (the old poles stood up to 1.8 m in from the fence and the lines fell toward them).
POLE_FENCE = (22., 40., 70.)    # first tries: this far in from the fence line (the 11 cm pole clears the 9 cm posts)
POLE_FALLBACK = (110., 180.)    # then deeper in the yard, where a shed, pad, gate or tree holds the fence line
LINE_RISE = (35., 130.)         # the line's end on the pole stands this much over its pulley on the rail
LINE_MIN_END = 330.             # and never lower than this (washing hangs up to 1.1 m under it, over a 1.95 m fence)
LINE_END_TOP = 1200.            # nor higher than this, so no pole stands over 12.35 m
LINE_SKEW = 1.                  # a line runs at most 45 degrees off square to the gallery (round a shed, past a gate)
LINE_MIN_SPAN = 250.            # pulley to pulley (the pole's pulley hangs 9 cm off the pole)
GATE_PROPS = (('bin_recycling', .55), ('bin_compost', .4), ('flower_box', .22), ('bike_locked', .15))
GREEN_SHARE = .3                # share of ruelles marked green, seeded, when the open-data clip is missing
TAG_FENCE, TAG_SHED, TAG_GARAGE = .16, .25, .7   # lane fences, shed and garage doors with a tag (halved on a
                                                 # ruelle verte; garage doors on a lane are few and much tagged)
Z_BED = 9.                      # soil top of a ruelle-verte bed over the verge, behind a 12 cm timber edge
CLOTHS = ('cloth_a', 'cloth_b', 'cloth_c', 'cloth_d', 'cloth_e', 'cloth_f')
TAG_COLOURS = ('tag_black', 'tag_black', 'tag_silver', 'tag_red', 'tag_blue', 'tag_white')


def unit(a, b):
    length = math.dist(a[:2], b[:2])
    return ((b[0] - a[0]) / length, (b[1] - a[1]) / length), length


def subtract(span, cuts, margin=0.):
    """Pieces of the interval span left after removing the cut intervals (each widened by margin)."""
    pieces = [span]
    for c0, c1 in sorted(cuts):
        c0, c1 = c0 - margin, c1 + margin
        out = []
        for a, b in pieces:
            if c1 <= a or c0 >= b:
                out.append((a, b))
                continue
            if c0 > a:
                out.append((a, c0))
            if c1 < b:
                out.append((c1, b))
        pieces = out
    return pieces


def poly_point_dist(poly, p):
    return poly_seg_dist(poly, p, p)


class Frame2:
    """A local frame in the plane: x along u from o, d along n (n need not be the right of u)."""

    def __init__(self, o, u, n, width=0., depth=0.):
        self.o, self.u, self.n, self.W, self.D = tuple(o[:2]), u, n, width, depth

    @classmethod
    def from_rect(cls, rect):
        """A Plex yard's wall frame from its 'rect': x along the rear wall from the lot line lx0, d out from the
        skin (d 0 lies 2 cm off the skin face, the fence line at d = D)."""
        u, width = unit(rect[0], rect[1])
        n = (u[1], -u[0])               # plateau_plex.Frame: d is the right of the wall's a->b (the rect is rounded)
        depth = (rect[3][0] - rect[0][0]) * n[0] + (rect[3][1] - rect[0][1]) * n[1]
        assert depth > 0, rect
        return cls(rect[0], u, n, width, depth)

    @classmethod
    def from_wall(cls, a, b):
        """A wall line a->b with d outward (the right of a->b, as Plex skins and CCW footprints have it)."""
        u, width = unit(a, b)
        return cls(a, u, (u[1], -u[0]), width)

    def local(self, p):
        dx, dy = p[0] - self.o[0], p[1] - self.o[1]
        return dx * self.u[0] + dy * self.u[1], dx * self.n[0] + dy * self.n[1]

    def world(self, x, d):
        return (self.o[0] + self.u[0] * x + self.n[0] * d, self.o[1] + self.u[1] * x + self.n[1] * d)

    def poly(self, x0, x1, d0, d1):
        return [self.world(x0, d0), self.world(x1, d0), self.world(x1, d1), self.world(x0, d1)]

    def yaw(self):
        return math.degrees(math.atan2(self.u[1], self.u[0]))


class PlexYards:
    """The Plex layer's yard records (Plex/fronts.json), indexed for the lane life."""

    @classmethod
    def load(cls, world, path=None):
        try:
            data = json.loads(Path(path or PLEX_FRONTS).read_text())
        except (OSError, ValueError):
            return None
        return cls(data, world)

    def __init__(self, data, world):
        self.world, self.lots = world, []
        self.walls, self.wall_grid = [], Grid(2500.)
        self.footprints, self.fp_grid = [], Grid(2500.)
        self.keepout, self.keep_grid = [], Grid(2500.)

        def wall(a, b, openings, kind, top, owner, skin):
            if math.dist(a, b) >= 50:
                self.wall_grid.add(len(self.walls), bbox([a, b], 60))
                self.walls.append({'a': tuple(a), 'b': tuple(b), 'openings': openings, 'kind': kind, 'top': top,
                                   'owner': owner, 'skin': skin})

        def keep(poly, kind, owner):
            self.keep_grid.add(len(self.keepout), bbox(poly))
            self.keepout.append((poly, kind, owner))

        for f in data.get('fronts', []):
            rear = f.get('rear') or {}
            lot = {'id': str(f['id']), 'storeys': f.get('storeys', 3), 'rear': rear, 'frame': None,
                   'shed_poly': None, 'lane_busy': []}
            for front in [f.get('front')] + list(f.get('sides') or []):
                if front and front.get('a'):
                    wall(front['a'], front['b'], 1, 'front', front.get('top_cm', 0.), lot['id'], False)
            for w in rear.get('walls') or []:
                wall(w['a'], w['b'], w.get('windows', 0) + w.get('doors', 0), w['kind'], w.get('top_cm', 0.),
                     lot['id'], True)
            for k, fp in enumerate(rear.get('footprints') or []):
                self.fp_grid.add(len(self.footprints), bbox(fp))
                self.footprints.append(([tuple(p) for p in fp], lot['id'], k))
            yard = rear.get('yard')
            if yard and yard.get('rect'):
                F = lot['frame'] = Frame2.from_rect(yard['rect'])
                fence = rear.get('fence')
                if fence and fence.get('gate_at') is not None:
                    g = fence['gate_at']
                    keep(F.poly(g - GATE_KEEP, g + GATE_KEEP, F.D - GATE_SWING, F.D + GATE_SWING), 'gate', lot['id'])
                if yard.get('pad'):
                    xs, ds = zip(*(F.local(p) for p in yard['pad']))
                    keep(F.poly(min(xs) - 20, max(xs) + 20, min(ds), F.D + 300), 'pad', lot['id'])   # and its apron
                if yard.get('shed') and rear.get('shed'):
                    sx0, sx1, sd0, sd1 = yard['shed']
                    d1 = sd1 - PLEX_YARD_D0
                    lot['shed_poly'] = F.poly(sx0, sx1, sd0 - PLEX_YARD_D0, d1)
                    garage = rear['shed'] == 'garage'
                    dw = 120. if garage and sx1 - sx0 >= 250 else 45.
                    xc = (sx0 + sx1) / 2
                    lot['door'] = (xc - dw, xc + dw, d1, 215. if garage else 195., garage)
                    keep(F.poly(xc - dw - 20, xc + dw + 20, d1, d1 + (320. if garage else 120.)), 'door', lot['id'])
            self.lots.append(lot)
        for m in data.get('background', []):
            for w in m.get('walls') or []:
                wall(w['a'], w['b'], w.get('windows', 0) + w.get('doors', 0), w['kind'], w.get('top_cm', 0.),
                     str(m['id']), True)

    def footprint_hit(self, p, margin=0., exclude=None):
        for i in self.fp_grid.query(bbox([p], margin)):
            poly, owner, k = self.footprints[i]
            if (owner, k) != exclude and (point_in(p, poly) or margin and poly_point_dist(poly, p) < margin):
                return True
        return False

    def keepout_hit(self, poly, margin=0.):
        for i in self.keep_grid.query(bbox(poly, margin)):
            other = self.keepout[i][0]
            if any(point_in(p, other) for p in poly) or any(point_in(p, poly) for p in other) or \
                    min(poly_seg_dist(other, a, b) for a, b in zip(poly, poly[1:] + poly[:1])) < margin:
                return True
        return False

    def mural_spot(self, a, b):
        """A blank stretch of the wall line a->b for a mural, as (a, b, offset, top): None when a detailed front or
        a skin with windows or doors stands on it; the blank Plex skin's own span, painted on its face 16 cm out,
        when one covers it; else the bare wall, 6 cm out, as before."""
        u, length = unit(a, b)
        hits = []
        for i in self.wall_grid.query(bbox([a, b], 60)):
            w = self.walls[i]
            if max(abs((p[0] - a[0]) * u[1] - (p[1] - a[1]) * u[0]) for p in (w['a'], w['b'])) > 40:
                continue
            t = sorted((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1] for p in (w['a'], w['b']))
            if t[1] < 50 or t[0] > length - 50:
                continue
            hits.append((w, max(0., t[0]), min(length, t[1])))
        if not hits:
            return a, b, 6., None
        if any(w['openings'] or not w['skin'] for w, _, _ in hits):
            return None
        w, t0, t1 = max(hits, key=lambda h: (h[2] - h[1], -h[1]))
        return add(a, u, t0), add(a, u, t1), PLEX_D_FACE + .9, w['top']


class AlleyIndex:
    def __init__(self, world):
        self.segs, self.grid = [], Grid(2000.)
        for alley in getattr(world, 'alleys', []):
            for a, b in alley['segments']:
                self.grid.add(len(self.segs), bbox([a, b], 50))
                self.segs.append((alley['id'], a, b))

    def nearest(self, p, radius=700.):
        best = None
        for i in self.grid.query(bbox([p], radius)):
            alley, a, b = self.segs[i]
            d = seg_dist(p, a, b)
            if d <= radius and (best is None or d < best[0]):
                best = (d, alley, a, b)
        return best


def _yard_z(lot, x, d):
    """Ground-cover height of a Plex yard under a point in its frame (cells are x from lx0, wall-frame depth)."""
    for mat, xa, xb, da, db in (lot['rear'].get('yard') or {}).get('cells', ()):
        if xa <= x <= xb and da <= d + PLEX_YARD_D0 <= db:
            return PLEX_GROUND_Z.get(mat, 0.)
    return 0.


# -- laundry ------------------------------------------------------------------------------------

def lane_laundry(world, plex, S, lane, counts):
    """Pulley clotheslines (cordes à linge) as Montréal hangs them: each from a pulley on a gallery's top rail at
    the end of the module away from its stair, out over the lot's own yard to a clothesline pole near the back
    fence, one pulley per floor on the pole. Never to a utility pole and never over the ruelle (city rules)."""
    poles, lines = [], []
    for lot in plex.lots:
        rear, F = lot['rear'], lot['frame']
        decks, fps = rear.get('decks') or [], rear.get('footprints') or []
        if not decks or not fps or F is None:
            continue
        yard, fence = rear['yard'], rear.get('fence') or {}
        trees = [(t['x'], t['y']) for t in yard.get('trees') or []]
        for k, fp in enumerate(fps):
            rng = Rng('laundry', lot['id'], k)
            if not rng.chance(LAUNDRY_SHARE if lot['storeys'] < 5 else LAUNDRY_SHARE / 2):
                continue
            loc = [F.local(p) for p in fp]
            x0, x1 = min(x for x, _ in loc), max(x for x, _ in loc)
            extent = max(d for _, d in loc)
            mdecks = sorted((dk for dk in decks
                             if x0 - 1 <= F.local((sum(p[0] for p in dk['quad']) / 4, sum(p[1] for p in dk['quad']) / 4))[0] <= x1 + 1),
                            key=lambda dk: dk['z'])
            if not mdecks:
                continue
            dF = max(F.local(p)[1] for p in mdecks[0]['quad'])
            ends = [F.local(fl[key]) for fl in rear.get('flights') or [] for key in ('head', 'foot') if fl.get(key)]
            ends = [e for e in ends if x0 - 40 <= e[0] <= x1 + 40 and e[1] <= extent + 40]
            stair_x = sum(e[0] for e in ends) / len(ends) if ends else x1
            inward = 1 if stair_x > (x0 + x1) / 2 else -1       # from the free end toward the module's middle
            ad = dF + 1.

            def pole_ok(ax, px, pd):
                if not 40 <= px <= F.W - 40 or pd - ad < LINE_MIN_SPAN + 9 or abs(px - ax) > LINE_SKEW * (pd - ad):
                    return False
                if fence.get('gate_at') is not None and abs(px - fence['gate_at']) < 90:
                    return False
                p = F.world(px, pd)
                if world.in_building(p, 40) or world.traffic_distance(p) < CLEAR or plex.footprint_hit(p, 40):
                    return False
                if any(poly and poly_point_dist(poly, p) < 30 for poly in (lot['shed_poly'], yard.get('pad'))):
                    return False
                if not all(math.dist(p, t) >= 120 for t in trees) or any(math.dist(p, q['xy']) < 60 for q in poles):
                    return False
                if any(math.dist(p, q) < 100 for q in world.utility_poles):     # never mistaken for one on a Hydro pole
                    return False
                # the line runs out over the yard, clear of every wall (never back to the mass behind the gallery,
                # never along a wing or a yard building), over no other gallery or stair and not over the shed, whose
                # roof the washing would brush
                A = F.world(ax, ad)
                span = math.dist(A, p)
                shed = lot['shed_poly']
                if shed and (point_in(A, shed) or any(segments_cross(A, p, a, b) for a, b in zip(shed, shed[1:] + shed[:1]))):
                    return False
                return wall_clearance(world, A, p) >= LINE_WALL and not any(
                    plex.footprint_hit(q, 0., (lot['id'], k)) for q in (lerp(A, p, s / span) for s in range(0, int(span) + 1, 50)))
            # the pulley on the rail near the gallery's free end (or a little in from it), the pole at the back fence
            # about in line with it, then further along the yard (only toward the module's middle, never over the
            # neighbouring module's stair); only where the fence line has no room, deeper in the yard
            first = rng.uniform(0., 160.)
            pick = next(((ax, ax + inward * dx, F.D - dd) for depths in (POLE_FENCE, POLE_FALLBACK)
                         for off in (25., 70., 115.) for ax in (x0 + off if inward > 0 else x1 - off,)
                         for dd in depths for dx in (first, 0., 80., 160., 240., 320., 400.)
                         if pole_ok(ax, ax + inward * dx, F.D - dd)), None)
            if pick is None:
                counts['laundry_modules_without_room'] += 1
                continue
            ax = pick[0]
            P = F.world(pick[1], pick[2])
            mine = []
            for dk in mdecks:
                if not rng.chance(LAUNDRY_DECK) or dk['z'] + LINE_ABOVE_DECK > LINE_TOP:
                    continue
                guard = next((i for i, g in enumerate(rear.get('guards') or [])
                              if abs(g['z0'] - dk['z']) < 1 and _guard_covers(F, g, ax, dF)), None)
                if guard is None:
                    continue
                A = F.world(ax, ad)
                span = math.dist(A, P)
                za = dk['z'] + LINE_ABOVE_DECK
                mine.append({'deck_z': dk['z'], 'guard': guard, 'A': (A[0], A[1], za),
                             'zb': min(LINE_END_TOP, max(LINE_MIN_END, za + rng.uniform(*LINE_RISE))), 'span': span})
            if not mine:
                continue
            height = max(m['zb'] for m in mine) + POLE_TOP
            pole_mat = rng.choice(('clothes_pole', 'clothes_pole', 'pulley'))          # wood, or a galvanised pipe
            S.box(pole_mat, (P[0], P[1], height / 2), (11, 11, height), F.yaw(), bottom=False)
            if len(mine) > 1 or rng.chance(.5):
                S.box(pole_mat, (P[0], P[1], height - 18), (64, 7, 7), F.yaw())
            index = len(poles)
            poles.append({'lot': lot['id'], 'module': k, 'xy': P, 'position': [r2(P[0]), r2(P[1])],
                          'height_cm': r2(height), 'material': pole_mat, 'lines': len(mine),
                          'from_fence_cm': r2(F.D - pick[2])})
            for m in mine:
                toward, _ = unit(P, m['A'])
                B = (P[0] + toward[0] * 9, P[1] + toward[1] * 9, m['zb'])
                start = max(60., extent - ad + 50.)
                garments, sag = _laundry_line(S, m['A'], B, rng, start, 60.)
                lines.append({'lot': lot['id'], 'module': k, 'deck_z': r2(m['deck_z']), 'guard': m['guard'],
                              'anchor': [r2(v) for v in m['A']], 'end': [r2(v) for v in B], 'pole': index,
                              'span_cm': r2(math.dist(m['A'][:2], B[:2])), 'sag_cm': r2(sag), 'garments': garments})
                counts['laundry_lines'] += 1
                counts['garments'] += garments
    counts['laundry_poles'] = len(poles)
    lane['laundry'] = {'poles': [{k: v for k, v in q.items() if k != 'xy'} for q in poles], 'lines': lines}
    return [q['xy'] for q in poles]


def wall_clearance(world, a, b, limit=300.):
    """Exact distance from the segment a-b to the nearest building wall (0 when it crosses one or lies inside)."""
    if world.in_building(a) or world.in_building(b):
        return 0.
    best = limit
    for e in world.edge_grid.query(bbox([a, b], limit)):
        c, d, _ = world.building_edges[e]
        best = min(best, seg_seg_dist(a, b, c, d))
    return best


def _guard_covers(F, g, x, d):
    """A guard run parallel to the frame's x, on the deck's outer edge (d), spanning x."""
    (xa, da), (xb, db) = F.local(g['a']), F.local(g['b'])
    return abs(da - db) < 2 and d - 8 <= da <= d + 1 and min(xa, xb) - 1 <= x <= max(xa, xb) + 1


def _laundry_line(S, A, B, rng, start, stop):
    """The pulley loop from A to B (two strands 8 cm apart, the lower one sagging more), pulleys at both ends and,
    on most lines, garments pegged on the lower strand between `start` and `stop` cm from the ends. Returns the
    garment count and the lower strand's sag (cm at mid-span)."""
    span = math.dist(A[:2], B[:2])
    sag = span * rng.uniform(.018, .03)
    yaw = math.degrees(math.atan2(B[1] - A[1], B[0] - A[0]))
    for p in (A, B):
        S.box('pulley', (p[0], p[1], p[2]), (7, 4, 12), yaw)
    _catenary(S, 'line_rope', (A[0], A[1], A[2] + 4), (B[0], B[1], B[2] + 4), sag * .75, .45, segments=6)
    _catenary(S, 'line_rope', (A[0], A[1], A[2] - 4), (B[0], B[1], B[2] - 4), sag, .45, segments=6)

    def at(s):
        t = max(0., min(1., s / span))
        return (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] - 4 + (B[2] - A[2]) * t - sag * 4 * t * (1 - t))
    if not rng.chance(.65):        # late October: a third of the lines hang empty
        return 0, sag
    s, count = start, 0
    while True:
        kind = rng.choice(('sheet', 'towel', 'towel', 'shirt', 'shirt', 'pants', 'socks'))
        width = {'sheet': rng.uniform(110, 170), 'towel': rng.uniform(45, 70), 'shirt': rng.uniform(55, 70),
                 'pants': rng.uniform(36, 44), 'socks': 40.}[kind]
        if s + width > span - stop:
            break
        _garment(S, at, s, width, kind, rng)
        count += 1
        s += width + rng.uniform(8., 35.)
    return count, sag


def _garment(S, at, s0, width, kind, rng):
    """A garment hung from the line between s0 and s0 + width (cm along it), double-faced, its top edge following
    the sagging strand: a sheet or towel, a shirt (shoulders and sleeves, then the body), trousers (waistband and
    two legs) or a pair of socks."""
    colour = rng.choice(CLOTHS) if kind != 'sheet' else rng.choice(('cloth_a', 'cloth_a', 'cloth_f', 'cloth_c', 'cloth_b'))
    if kind in ('sheet', 'towel'):
        h = rng.uniform(70, 110) if kind == 'sheet' else rng.uniform(40, 65)
        parts = [(0., width, 0., h)]
    elif kind == 'shirt':
        h = rng.uniform(60, 75)
        parts = [(0., width, 0., 22.), (width * .18, width * .82, 22., h)]
    elif kind == 'pants':
        h = rng.uniform(85, 100)
        parts = [(0., width, 0., 10.), (0., width * .46, 10., h), (width * .54, width, 10., h)]
    else:
        parts = [(4., 13., 0., 28.), (27., 36., 0., 28.)]
    for a, b, za, zb in parts:
        pa, pb = at(s0 + a), at(s0 + b)
        quad = [(pa[0], pa[1], pa[2] - za), (pb[0], pb[1], pb[2] - za), (pb[0], pb[1], pb[2] - zb),
                (pa[0], pa[1], pa[2] - zb)]
        S.face(colour, quad)
        S.face(colour, quad[::-1])


# -- life on the galleries ----------------------------------------------------------------------
# A Plateau gallery is an outdoor room: patio chairs against the wall, geraniums in pots, a barbecue and a bike against
# the guard, the blue and brown bins, a window air conditioner, planters hung on the rail and, now and then, a dish
# clamped to a guard. The floor props stand only on the props floor Plex records per deck (decks[].free: clear of the
# stair openings, the flight heads, the door and the way between them; Plex walks its player capsule over every deck
# with that floor filled), so none blocks a stair or a door. The layout follows Germer and Schwarz's furniture agents
# (each kind seeks its parent surface, the wall, the guard, a window or the rail, and keeps its clearance).

GALLERY_LIVED = .82             # decks with any life on them (the rest stand bare)
GALLERY_EDGE = 2.               # a floor prop keeps this far inside its free quad
GALLERY_GAP = 6.                # and this far from the next prop on the deck
CAP_FACE = 3.                   # plateau_plex CAP_W / 2: the cap rail's faces stand this far either side of the guard line
WINDOW_GLASS_D = 2.5            # plateau_plex._window: glass at D_FACE + 2.5, the deck's wall line being D_FACE
WINDOW_SILL = 80.               # ... over an opening that starts 80 cm over the floor (glass from 86 to 209 cm)
STAIR_CLEAR = {'straight': 60., 'spiral': 85.}   # hung props keep this far from a flight's centre line (90 cm stairs,
                                                 # 70 cm spirals, and a hand)
HUNG_LINE = 50.                 # and a rail prop this far from a laundry pulley on the same rail
RAIL_BOX_DROP = 25.             # a planter on the rail hangs with its rim (22.8 cm over its base) just under the rail top
# Dish aims from the Plateau (45.52 N, 73.58 W): Bell at 91.1 W (most dishes) and Shaw Direct at 107.3 W, azimuth
# and elevation in degrees (satsig.net pointing formula), with the share of dishes on each.
DISH_AIM = ((203.9, 34.8, .75), (223.1, 28.0, .25))
DISH_SHARE = .06                # lived decks with a dish tried on a guard (OMHM asks tenants to take them off)
DISH_FACING = .34               # the guard's outer side within 70 degrees of the aim
DISH_SKY = 3000.                # and the line to the satellite clear of buildings, galleries and trees this far
GALLERY_COLLIDE = ('chair_patio', 'bbq', 'bin_recycling', 'bin_compost')   # the bike, pots and hung props are knocked


def deck_frame(deck):
    """The frame of a Plex deck record: x along its wall line (quad[0] -> quad[1]), d out toward the yard along its
    `out`, d 0 on the wall line (D_FACE); D is the outer guard line (`edge`)."""
    q = deck['quad']
    u, width = unit(q[0], q[1])
    n = (-u[1], u[0])                   # exactly square to the wall line, on the side `out` (rounded) points to
    if n[0] * deck['out'][0] + n[1] * deck['out'][1] < 0:
        n = (u[1], -u[0])
    F = Frame2(q[0], u, n, width)
    F.D = F.local(deck['edge'][0])[1]
    return F


def deck_rects(F, deck):
    """The deck's free quads (its props floor) as rectangles (x0, x1, d0, d1) in its frame."""
    out = []
    for quad in deck.get('free') or ():
        loc = [F.local(p) for p in quad]
        out.append((min(x for x, _ in loc), max(x for x, _ in loc), min(d for _, d in loc), max(d for _, d in loc)))
    return out


def prop_extent(F, prop, yaw):
    """A prop's bounds about its pivot in a deck frame: (x0, x1, d0, d1)."""
    loc = [F.local(q) for q in _prop_poly(prop, F.o, yaw)]
    return min(x for x, _ in loc), max(x for x, _ in loc), min(d for _, d in loc), max(d for _, d in loc)


def facing_yaw(F, a, b):
    """Yaw that points a prop's +X along a * u + b * n of the frame."""
    return math.degrees(math.atan2(F.u[1] * a + F.n[1] * b, F.u[0] * a + F.n[0] * b))


class PlexGlass:
    """Rear windows over the gallery decks, read from the Plex layer's Glass batches (the generated quads, so the AC
    units sit in windows that are drawn): triangles indexed by their box in map coordinates (the OBJ stores x, -y)."""

    def __init__(self, path=None):
        self.tris, self.grid = [], Grid(1000.)
        path = Path(path or PLEX_MANIFEST)
        try:
            manifest = json.loads(path.read_text())
        except (OSError, ValueError):
            return
        for batch in manifest.get('batches', []):
            if batch.get('material') != 'Glass':
                continue
            vs = []
            for line in (path.parent / batch['file']).read_text().splitlines():
                if line.startswith('v '):
                    x, y, z = (float(v) for v in line.split()[1:4])
                    vs.append((x, -y, z))
                elif line.startswith('f '):
                    tri = [vs[int(t.split('/')[0]) - 1] for t in line.split()[1:]]
                    self.grid.add(len(self.tris), bbox([p[:2] for p in tri]))
                    self.tris.append(tri)

    def windows(self, F, z, x0, x1):
        """Windows on the deck's wall line between x0 and x1 whose opening starts WINDOW_SILL over the deck top z:
        [(x centre, glass width)], merged from the glass triangles; door lights (at D_FACE + 3.5) are left out."""
        spans = []
        for i in self.grid.query(bbox([F.world(x0, 0.), F.world(x1, 0.)], 10.)):
            tri = self.tris[i]
            loc = [F.local(p) for p in tri]
            zs = [p[2] - z for p in tri]
            if not all(abs(d - WINDOW_GLASS_D) < .4 for _, d in loc):
                continue
            if not (WINDOW_SILL + 3 <= min(zs) <= WINDOW_SILL + 9 and 200 <= max(zs) <= 215):
                continue
            xs = [x for x, _ in loc]
            if min(xs) >= x0 - 1 and max(xs) <= x1 + 1:
                spans.append((min(xs), max(xs)))
        merged = []
        for a, b in sorted(spans):
            if merged and a <= merged[-1][1] + .5:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        return [((a + b) / 2, b - a) for a, b in merged if b - a >= 40]


def _sky_clear(world, plex, p, z, azimuth, elevation, tops, trees):
    """The line from a dish at p (height z) toward the satellite: clear of OSM buildings, Plex gallery stacks (as
    tall as their top deck plus its roof) and yard-tree crowns for DISH_SKY cm."""
    aim = (math.sin(math.radians(azimuth)), math.cos(math.radians(azimuth)))
    rise = math.tan(math.radians(elevation))
    for step in range(1, int(DISH_SKY / 50) + 1):
        t = 50. * step
        q = add(p, aim, t)
        h = z + t * rise
        for i in world.building_grid.query((q[0], q[1], q[0], q[1])):
            b = world.buildings[i]
            if b['height'] > h and point_in(q, b['points']):
                return False
        for i in plex.fp_grid.query((q[0], q[1], q[0], q[1])):
            poly, owner, _ = plex.footprints[i]
            if tops.get(owner, 0.) > h and point_in(q, poly):
                return False
        for tx, ty, r, z0, z1 in trees:
            if z0 <= h <= z1 and math.dist(q, (tx, ty)) < r:
                return False
    return True


def lane_galleries(world, plex, put, lane, counts, glass, laundry):
    """Gallery life on every deck of the Plex rear stacks (decks[] and ground_decks[]) with a props floor."""
    rows = []
    anchors = {}
    for line in laundry:
        anchors.setdefault(line['lot'], []).append(line['anchor'])
    tops = {}
    for lot in plex.lots:
        zs = [dk['z'] for dk in (lot['rear'].get('decks') or []) + (lot['rear'].get('ground_decks') or [])]
        if zs:
            tops[lot['id']] = max(zs) + 300.          # the top gallery and its roof
    trees = []
    for lot in plex.lots:
        for t in ((lot['rear'].get('yard') or {}).get('trees') or []):
            h = t.get('height_m', 10.) * 100
            trees.append((t['x'], t['y'], t.get('crown_m', 8.) * 50, t.get('z', 0.) + .3 * h, t.get('z', 0.) + h))
    tree_grid = Grid(2500.)
    for i, t in enumerate(trees):
        tree_grid.add(i, bbox([t[:2]], t[2]))
    for lot in plex.lots:
        if lot['storeys'] >= 5:          # the steel fire escapes of tall blocks stay clear
            continue
        rear = lot['rear']
        flights = [(fl.get('kind', 'straight'), fl.get('foot'), fl.get('head')) for fl in rear.get('flights') or []]
        for kind in ('ground_decks', 'decks'):
            for i, deck in enumerate(rear.get(kind) or []):
                if not deck.get('free'):
                    continue
                counts['gallery_decks'] += 1
                rng = Rng('gallery', lot['id'], kind, i)
                if not rng.chance(GALLERY_LIVED):
                    continue
                counts['gallery_decks_lived'] += 1
                placed = _gallery_deck(world, plex, put, lot, kind, i, deck, rng, flights, glass,
                                       [a for a in anchors.get(lot['id'], ()) if abs(a[2] - deck['z'] - LINE_ABOVE_DECK) < 1],
                                       tops, [trees[j] for j in tree_grid.query(bbox([deck['edge'][0]], DISH_SKY))],
                                       counts)
                for row in placed:
                    counts['gallery_' + row['prop']] += 1
                    counts['gallery_props'] += 1
                rows += placed
    lane['galleries'] = rows


def _gallery_deck(world, plex, put, lot, kind, index, deck, rng, flights, glass, anchors, tops, trees, counts):
    """The props of one deck (frame from deck_frame): floor props on the free quads, an AC unit in a window over the
    deck, planters hung on the outer guard, a dish on a guard; rows for lane_life.json."""
    F = deck_frame(deck)
    z = deck['z']
    rects = deck_rects(F, deck)
    taken = []                                  # (x0, x1, d0, d1) of the floor and window props on this deck
    hung = []                                   # world points of the rail and guard props
    rows = []
    low = z < 500.                              # the ground gallery and the first floor: the bikes and barbecues

    def free_of(r):
        return not any(r[0] < t[1] + GALLERY_GAP and t[0] < r[1] + GALLERY_GAP and
                       r[2] < t[3] + GALLERY_GAP and t[2] < r[3] + GALLERY_GAP for t in taken)

    def record(prop, x, d, yaw, z_base, place, extra=None):
        p = F.world(x, d)
        poly = _prop_poly(prop, p, yaw)
        row = put(prop, p, yaw, prop in GALLERY_COLLIDE, ('gallery', lot['id'], kind, index, prop, round(x)),
                  {'gallery_of': lot['id'], 'place': place, **(extra or {})}, z=z_base)
        rows.append({'lot': lot['id'], 'deck': [kind, index], 'deck_z': r2(z), 'prop': prop, 'place': place,
                     'position': [r2(p[0]), r2(p[1]), r2(z_base)], 'yaw': r2(yaw % 360),
                     'collision': row['collision'], 'footprint': [[r2(v) for v in q] for q in poly], **(extra or {})})
        return p

    # this deck's own guard runs: along or across it, overlapping its quad (which stops short of a spiral stair the
    # gallery's guards run round); a lot's other modules have runs at the same height further along the wall
    guards = []
    for g in lot['rear'].get('guards') or []:
        (xa, da), (xb, db) = F.local(g['a']), F.local(g['b'])
        if abs(g['z0'] - z) < 1 and max(xa, xb) >= -10 and min(xa, xb) <= F.W + 10 and \
                -10 <= min(da, db) and max(da, db) <= F.D + 10:
            guards.append(g)
    outer = [(min(xa, xb), max(xa, xb), g) for g in guards
             for (xa, da), (xb, db) in [(F.local(g['a']), F.local(g['b']))] if abs(da - F.D) < 2 and abs(db - F.D) < 2]

    def floor(prop, band, yaw, lean=None):
        """The first spot along a band of a free rect (seeded end first) that holds the prop; band 'wall' sets its
        back 2 cm inside the rect's wall side, 'guard' its back inside the guard side; a leaning prop (lean = how far
        its pivot stands in from the cap rail's inner face) rests on the cap instead, where an outer guard runs."""
        ex = prop_extent(F, prop, yaw)
        order = list(range(len(rects)))
        rng.shuffle(order)
        for k in order:
            x0, x1, d0, d1 = rects[k]
            if lean is not None:
                d = F.D - CAP_FACE - .5 - lean          # the top of the lean (handlebar, saddle) on the cap's face
                if d + ex[2] < d0 + GALLERY_EDGE - .01 or d > d1 - GALLERY_EDGE:
                    continue
            elif band == 'wall':
                d = d0 + GALLERY_EDGE - ex[2]
            else:
                d = d1 - GALLERY_EDGE - ex[3]
            if lean is None and d + ex[3] > d1 - GALLERY_EDGE + .01 or d + ex[2] < d0 + GALLERY_EDGE - .01:
                continue
            lo, hi = x0 + GALLERY_EDGE - ex[0], x1 - GALLERY_EDGE - ex[1]
            if hi < lo:
                continue
            steps = int((hi - lo) / 5.)
            xs = [lo + 5. * s for s in range(steps + 1)] + [hi]
            if rng.chance(.5):
                xs.reverse()
            for x in xs:
                r = (x + ex[0], x + ex[1], d + ex[2], d + ex[3])
                if lean is not None and not any(a - 1 <= r[0] and r[1] <= b + 1 for a, b, _ in outer):
                    continue
                if free_of(r):
                    taken.append(r)
                    return x, d
        return None

    out_yaw, in_yaw = facing_yaw(F, 0., 1.), facing_yaw(F, 0., -1.)
    if rng.chance(.3 if low else .18):
        spot = floor('bbq', 'guard', in_yaw)            # the knobs toward the house, the cook on the deck
        if spot:
            record('bbq', *spot, in_yaw, z, 'floor')
    if rng.chance(.2 if low else .06):
        yaw = math.degrees(math.atan2(F.n[0], -F.n[1]))      # its left (-Y), the lean side, toward the guard (+n)
        spot = floor('bike_gallery', 'guard', yaw, lean=prop_extent(F, 'bike_gallery', yaw)[3])
        if spot:
            record('bike_gallery', *spot, yaw, z, 'floor')
    if rng.chance(.55):
        n = 2 if rng.chance(.55) else 1
        for _ in range(n):
            yaw = out_yaw + rng.uniform(-14., 14.)      # the chairs face the yard, set down a little askew
            spot = floor('chair_patio', 'wall' if rng.chance(.75) else 'guard', yaw)
            if spot:
                record('chair_patio', *spot, yaw, z, 'floor')
    for prop, share in (('bin_recycling', .3), ('bin_compost', .22)):
        if rng.chance(share):
            band = 'wall' if rng.chance(.6) else 'guard'
            yaw = out_yaw if band == 'wall' else in_yaw          # handle and wheels to the wall or the guard
            spot = floor(prop, band, yaw)
            if spot:
                record(prop, *spot, yaw, z, 'floor')
    for _ in range(rng.choice((0, 1, 1, 2, 2, 3))):
        yaw = rng.uniform(0., 360.)
        spot = floor('potted_plant', 'guard' if rng.chance(.6) else 'wall', yaw)
        if spot:
            record('potted_plant', *spot, yaw, z, 'floor')
    # a window air conditioner in a rear window over the deck, wall plane on the glass, sitting on the sill
    if glass is not None and rects:
        ex = prop_extent(F, 'ac_unit', out_yaw)
        d = WINDOW_GLASS_D + .5 - props_cached()['anchors']['ac_wall_x']
        for xc, _ in glass.windows(F, z, min(r[0] for r in rects) - 60, max(r[1] for r in rects) + 60):
            if not rng.chance(.22):
                continue
            r = (xc + ex[0], xc + ex[1], max(d + ex[2], min(rr[2] for rr in rects)), d + ex[3])
            if not any(rr[0] + GALLERY_EDGE <= r[0] and r[1] <= rr[1] - GALLERY_EDGE and rr[2] <= WINDOW_GLASS_D + 1 and
                       r[3] <= rr[3] - GALLERY_EDGE for rr in rects) or not free_of(r):
                continue
            taken.append(r)
            record('ac_unit', xc, d, out_yaw, z + WINDOW_SILL, 'window')

    def clear_of_stairs(poly):
        for kind_, foot, head in flights:
            pts = [q[:2] for q in (foot, head) if q]
            if not pts:
                continue
            reach = STAIR_CLEAR.get(kind_, 85.)
            a, b = pts[0], pts[-1]
            if min(seg_dist(q, a, b) for q in poly) < reach or poly_seg_dist(poly, a, b) < reach:
                return False
        return not any(world.in_building(q) for q in poly) and not any(
            plex.footprint_hit(q, 0.) and not _own_footprint(plex, lot['id'], q) for q in poly)

    # planters hung on the outside of the outer guard, their tops at the rail
    if rng.chance(.16):
        ex = prop_extent(F, 'flower_box', out_yaw)
        d = F.D + CAP_FACE + .5 - props_cached()['anchors']['flower_wall_x']
        for _ in range(1 if rng.chance(.6) else 2):
            spots = []
            for xa, xb, _g in outer:
                lo, hi = xa + 12 - ex[0], xb - 12 - ex[1]
                spots += [lo + (hi - lo) * s / 8 for s in range(9)] if hi >= lo else []
            rng.shuffle(spots)
            for x in spots:
                p = F.world(x, d)
                poly = _prop_poly('flower_box', p, out_yaw)
                if any(math.dist(p, q[:2]) < HUNG_LINE + 46 for q in anchors) or \
                        any(math.dist(p, q) < 100 for q in hung) or not clear_of_stairs(poly):
                    continue
                hung.append(p)
                g = next(g for xa, xb, g in outer if xa - 1 <= x <= xb + 1)
                record('flower_box', x, d, out_yaw, g['z1'] - RAIL_BOX_DROP, 'rail')
                break
    # a satellite dish clamped to the cap of a guard that faces the satellite, with a clear line to it
    if rng.chance(DISH_SHARE):
        r, azimuth, elevation = rng.random(), DISH_AIM[-1][0], DISH_AIM[-1][1]
        for az, el, share in DISH_AIM:
            if r < share:
                azimuth, elevation = az, el
                break
            r -= share
        azimuth += rng.uniform(-3., 3.)
        aim = (math.sin(math.radians(azimuth)), math.cos(math.radians(azimuth)))
        yaw = math.degrees(math.atan2(aim[1], aim[0]))
        centre = F.world(F.W / 2, F.D / 2)
        clamp = props_cached()['anchors']['dish_clamp_z']
        options = []
        for g in guards:
            u, length = unit(g['a'], g['b'])
            if length < 60:
                continue
            n = (u[1], -u[0])
            if (centre[0] - g['a'][0]) * n[0] + (centre[1] - g['a'][1]) * n[1] > 0:
                n = (-n[0], -n[1])
            if n[0] * aim[0] + n[1] * aim[1] < DISH_FACING:
                continue
            for s in (.15, .5, .85):
                options.append((g, add(g['a'], u, 25 + (length - 50) * s)))
        rng.shuffle(options)
        for g, p in options:
            poly = _prop_poly('satellite_dish', p, yaw)
            if any(math.dist(p, q[:2]) < HUNG_LINE for q in anchors) or any(math.dist(p, q) < 60 for q in hung) or \
                    not clear_of_stairs(poly):
                continue
            if not _sky_clear(world, plex, p, g['z1'] + 55., azimuth, elevation, tops, trees):
                counts['gallery_dishes_without_sky'] += 1
                continue
            hung.append(p)
            record('satellite_dish', *F.local(p), yaw, g['z1'] - clamp, 'guard',
                   {'aim_azimuth': r2(azimuth), 'aim_elevation': r2(elevation)})
            break
    return rows


def _own_footprint(plex, owner, q):
    return any(o == owner and point_in(q, poly) for poly, o, _ in
               (plex.footprints[i] for i in plex.fp_grid.query((q[0], q[1], q[0], q[1]))))


# -- life at the gates --------------------------------------------------------------------------

def props_cached():
    if 'info' not in _PROPS_CACHE:
        _PROPS_CACHE['info'] = props_info()
    return _PROPS_CACHE['info']


def _prop_poly(prop, p, yaw, pad=0.):
    b = props_cached()['bounds'][prop]
    return [local_to_world(p, yaw, (x, y)) for x, y in ((b[0] - pad, b[1] - pad), (b[3] + pad, b[1] - pad),
                                                          (b[3] + pad, b[4] + pad), (b[0] - pad, b[4] + pad))]


def lane_gates(world, plex, put, lane, counts, laundry_poles):
    """Blue recycling and brown organics bins, a flower box hung on the fence and a locked bike beside the yard
    gates, seeded per lot: on the lane side where the ruelle carries no traffic, else just inside the gate, always
    clear of the 300 cm traffic band and of the gate leaf's swing, of neighbours' gates, pads and doors."""
    alleys = AlleyIndex(world)
    info = props_cached()
    taken, taken_grid = [], Grid(1000.)
    obstacles = list(world.utility_poles) + list(laundry_poles)
    rows = []
    for lot in plex.lots:
        rear, F = lot['rear'], lot['frame']
        fence = rear.get('fence')
        if F is None or not fence or fence.get('gate_at') is None:
            continue
        rng = Rng('gate-life', lot['id'])
        kinds = [k for k, share in GATE_PROPS if rng.chance(share)]
        g = fence['gate_at']
        first = 1 if rng.chance(.5) else -1
        cursor = {1: g + GATE_KEEP + 8, -1: g - GATE_KEEP - 8}
        for kind in kinds:
            b = info['bounds'][kind]
            along, depth = (b[3] - b[0], b[4] - b[1]) if kind == 'bike_locked' else (b[4] - b[1], b[3] - b[0])
            placed = None
            for s in (first, -first):
                c = cursor[s] + s * along / 2
                if kind == 'flower_box':
                    # hung between two posts: the first bay beyond the cursor that holds it
                    c = next((min(max(c, a + along / 2 + 2), b - along / 2 - 2) for a, b in
                              sorted(_fence_bays(fence), key=lambda bay: s * bay[0]) if b - a >= along + 4
                              and s * (min(max(c, a + along / 2 + 2), b - along / 2 - 2) - cursor[s]) >= along / 2),
                             None)
                    if c is None:
                        continue
                if not 25 + along / 2 <= c <= F.W - 25 - along / 2:
                    continue
                shed = fence.get('shed_at')
                if shed and shed[0] - 20 - along / 2 < c < shed[1] + 20 + along / 2:
                    continue
                for where in ('lane', 'yard'):
                    spot = _gate_spot(world, plex, alleys, lot, kind, c, where, fence, obstacles)
                    if spot is None:
                        continue
                    p, yaw, z, poly = spot
                    if any(poly_seg_dist(taken[i], *e) < 6 for i in taken_grid.query(bbox(poly, 10))
                           for e in zip(poly, poly[1:] + poly[:1])):
                        continue
                    placed = (s, c, where, p, yaw, z, poly)
                    break
                if placed:
                    break
            if not placed:
                counts['gate_props_without_room'] += 1
                continue
            s, c, where, p, yaw, z, poly = placed
            cursor[s] = c + s * (along / 2 + 8)
            taken_grid.add(len(taken), bbox(poly))
            taken.append(poly)
            if where == 'lane':
                lot['lane_busy'].append((c - along / 2 - 10, c + along / 2 + 10))
            put(kind, p, yaw, False, ('gate', lot['id'], kind), {'gate_of': lot['id'], 'side': where}, z=z)
            counts['gate_' + kind] += 1
            counts['gate_props_' + where + '_side'] += 1
            rows.append({'lot': lot['id'], 'prop': kind, 'side': where, 'along_cm': r2(c), 'gate_at_cm': r2(g),
                         'position': [r2(p[0]), r2(p[1]), r2(z)], 'yaw': r2(yaw % 360),
                         'footprint': [[r2(v) for v in q] for q in poly]})
    lane['gates'] = rows


def _gate_spot(world, plex, alleys, lot, kind, c, where, fence, obstacles):
    """Position, yaw, z and footprint of a gate prop centred c cm along the fence, on the lane or the yard side;
    None when it would stand in the traffic band, in a building, a keep-out or (in the yard) on a structure."""
    F = lot['frame']
    rear = lot['rear']
    v = F.n if where == 'lane' else (-F.n[0], -F.n[1])
    face = F.world(c, F.D)
    b = props_cached()['bounds'][kind]
    # clear of the fence posts (4.5 cm half width) and caps: bins 6 cm off the boards, the bike leans on them at
    # 5 cm, the flower box hangs between two posts with its wall plane 4 cm out
    if kind == 'bike_locked':
        yaw = math.degrees(math.atan2(-v[0], v[1]))                 # the lean side (-Y) toward the fence
        contact = add(face, v, 5.)
        off = local_to_world((0., 0.), yaw, props_cached()['bike_contact'])
        p = (contact[0] - off[0], contact[1] - off[1])
    else:
        yaw = math.degrees(math.atan2(v[1], v[0]))                  # the front (+X) away from the fence
        back = -11. if kind == 'flower_box' else b[0]               # flower box: anchors.wall_plane_x_cm
        p = add(face, v, (4. if kind == 'flower_box' else 6.) - back)
    poly = _prop_poly(kind, p, yaw)
    if where == 'yard' and kind.startswith('bin_'):
        # the fence stands 2.9 m from a ruelle's centreline: step a bin in the yard back out of the 300 cm band
        gap = CLEAR + 2 - world.traffic_distance(poly)
        if 0 < gap <= 40:
            p = add(p, v, gap)
            poly = _prop_poly(kind, p, yaw)
    if world.traffic_distance(poly) < CLEAR or any(world.in_building(q) for q in poly + [p]):
        return None
    if plex.keepout_hit(poly, 4.) or any(poly_point_dist(poly, q) < 45 for q in obstacles if math.dist(q, p) < 300):
        return None
    if where == 'yard':
        for q in poly:
            x, d = F.local(q)
            if not (70 <= x <= F.W - 70 and 0 <= d <= F.D - 1):
                return None
        if plex.footprint_hit(p, 60):
            return None
        edges = list(zip(poly, poly[1:] + poly[:1]))
        for other in (lot['shed_poly'], (rear.get('yard') or {}).get('pad')):
            if other and (any(point_in(q, other) for q in poly) or any(point_in(q, poly) for q in other)
                          or min(poly_seg_dist(other, a, b) for a, b in edges) < 10):
                return None
        if any(math.dist(p, (t['x'], t['y'])) < 70 for t in (rear.get('yard') or {}).get('trees') or []):
            return None
        # plateau_plex plan_yard may stand a small cedar (radius 75) halfway between the galleries and the fence,
        # within 15% of the lot width of its middle, in yards with 3 m or more there; its record is not written,
        # so keep clear of everywhere it can be
        extent = max((F.local(q)[1] for fp in rear.get('footprints') or [] for q in fp), default=100. - 2.)
        near_edge = min(F.local(q)[1] for q in poly)
        if F.D - extent >= 300 and (extent + F.D) / 2 + 75 > near_edge and \
                abs(c - F.W / 2) < .15 * F.W + 75 + max(b[4] - b[1], b[3] - b[0]) / 2:
            return None
        z = _yard_z(lot, *F.local(p))
    else:
        z = Z_ALLEY if world.surfaces.has(p, 'alley') else 0.
    if kind == 'flower_box':
        z = max(30., fence['height_cm'] - 58.) + (0. if where == 'lane' else _yard_z(lot, *F.local(p)))
    return p, yaw, z, poly


# -- ruelles vertes -----------------------------------------------------------------------------

def load_ruelles_vertes(path=None):
    try:
        return json.loads(Path(path or RUELLES_VERTES).read_text())
    except (OSError, ValueError):
        return None


def green_alleys(world, clip):
    """{alley way id: record} for the ruelles that are ruelles vertes: OSM ruelles whose samples (every 2 m) lie
    in or within 2.5 m of the city's polygons of one RUELLE_ID, for at least a quarter of the way (3 samples or
    more). Without the clip, a seeded share of the ruelles."""
    if clip is None:
        return {a['id']: {'ruelles': [], 'polygons': []} for a in world.alleys
                if Rng('green-lane', a['id']).chance(GREEN_SHARE)}, 'seeded share (no open-data clip)'
    rows = clip['polygons']
    grid = Grid(2500.)
    for i, row in enumerate(rows):
        grid.add(i, bbox(row['ring'], 250))
    out = {}
    for alley in world.alleys:
        samples = []
        for a, b in alley['segments']:
            n = max(1, int(math.dist(a, b) / 200))
            samples += [lerp(a, b, i / n) for i in range(n + 1)]
        hits = {}
        for q in samples:
            ids = set()
            for i in grid.query(bbox([q])):
                ring = rows[i]['ring']
                if point_in(q, ring) or poly_point_dist(ring, q) < 250:
                    ids.add(rows[i]['ruelle_id'])
            for rid in ids:
                hits[rid] = hits.get(rid, 0) + 1
        rids = sorted(r for r, c in hits.items() if c >= max(3, .25 * len(samples)))
        if rids:
            out[alley['id']] = {'ruelles': rids, 'polygons': [r for r in rows if r['ruelle_id'] in rids]}
    return out, 'Ville de Montréal open data'


def lane_green(world, plex, S, lane, counts):
    """The ruelles vertes: planted beds with a timber edge along the lane fences and lane walls, autumn perennials,
    grasses and shrubs in them, Virginia creeper on the fences and walls behind, an entry arch (pergola) with
    lattice sides and creeper and two planters at each street entry, grass where the city maps a closed,
    vegetated stretch off the traffic graph, and one mural per ruelle on a blank wall that faces it."""
    clip = load_ruelles_vertes()
    green, source = green_alleys(world, clip)
    alleys = AlleyIndex(world)
    by_id = {a['id']: a for a in world.alleys}
    beds = []
    lane['ruelles_vertes'] = {'source': source, 'clip': clip['source'] if clip else None,
                              'alleys': [{'osm_way': k, 'name': by_id[k]['name'], 'ruelles': v['ruelles'],
                                          'traffic': by_id[k]['traffic']} for k, v in sorted(green.items())],
                              'beds': beds, 'arches': [], 'planters': [], 'grass': [], 'murals': []}
    counts['ruelles_vertes_osm_ways'] = len(green)
    counts['ruelles_vertes_ids'] = len({r for v in green.values() for r in v['ruelles']})
    # the murals first, so the beds leave a painted fence clear and no creeper climbs a painted wall
    mural_walls = _green_murals(world, plex, S, lane, counts, green, by_id, alleys)

    def bed(F, x0, x1, d0, d1, rng, host, creeper_d, creeper_h):
        if x1 - x0 < 60 or d1 - d0 < 25:
            return
        S.flat('Yard_Soil', F.poly(x0, x1, d0, d1), Z_BED)
        c = F.world((x0 + x1) / 2, d1 + 2)
        S.box('bed_edge', (c[0], c[1], 6.), (x1 - x0, 4, 12), F.yaw(), bottom=False)
        x = x0 + rng.uniform(10, 35)
        while x < x1 - 10:
            _plant(S, F.world(x, rng.uniform(d0 + 8, max(d0 + 9, d1 - 8))), Z_BED, rng, counts)
            x += rng.uniform(45, 95)
        if x1 - x0 >= 150 and rng.chance(.45) and creeper_h > 0:
            w = min(x1 - x0 - 20, rng.uniform(120, 300))
            c0 = x0 + 10 + (x1 - x0 - 20 - w) * rng.random()
            counts['green_creeper_strips'] += _creeper(S, F, c0, c0 + w, creeper_d, creeper_h, rng)
        beds.append({'host': host, 'a': [r2(v) for v in F.world(x0, d0)], 'b': [r2(v) for v in F.world(x1, d0)],
                     'width_cm': r2(d1 - d0)})
        counts['green_bed_metres'] += (x1 - x0) / 100

    # beds along the lane fences of the lots that back onto a ruelle verte (not at the gates, sheds or gate props)
    for lot in plex.lots:
        fence, F = lot['rear'].get('fence'), lot['frame']
        if not fence or not fence.get('lane') or F is None:
            continue
        near = alleys.nearest(F.world(F.W / 2, F.D), 700)
        if near is None or near[1] not in green:
            continue
        rng = Rng('green-bed', lot['id'])
        cuts = list(lot['lane_busy'])
        if fence.get('gate_at') is not None:
            cuts.append((fence['gate_at'] - 75, fence['gate_at'] + 75))
        if fence.get('shed_at'):
            cuts.append((fence['shed_at'][0] - 10, fence['shed_at'][1] + 10))
        for r0, r1 in fence['runs']:
            for p0, p1 in subtract((r0, r1), cuts):
                reach = min(seg_dist(F.world(x, F.D), near[2], near[3]) for x in (p0, p1)) - ALLEY_HALF - 10
                width = min(rng.uniform(40, 65), reach - 3)
                bed(F, p0, p1, F.D + 3, F.D + 3 + width, rng, 'fence', F.D + 9, fence['height_cm'] + 15)
    # beds at the foot of the walls that stand on a ruelle verte
    for w in plex.walls:
        if not w['skin'] or w['kind'] == 'front' or w['kind'] == 'rear' and w['openings']:
            continue
        F = Frame2.from_wall(w['a'], w['b'])
        if F.W < 150:
            continue
        mid = F.world(F.W / 2, PLEX_D_FACE)
        near = alleys.nearest(mid, 340)            # a wall on the lane edge, with no yard fence in front of it
        if near is None or near[1] not in green:
            continue
        au, _ = unit(near[2], near[3])
        foot = add(near[2], au, (mid[0] - near[2][0]) * au[0] + (mid[1] - near[2][1]) * au[1])
        if abs(F.u[0] * au[0] + F.u[1] * au[1]) < .95 or (foot[0] - mid[0]) * F.n[0] + (foot[1] - mid[1]) * F.n[1] < 0:
            continue
        rng = Rng('green-wall', w['owner'], round(w['a'][0]), round(w['a'][1]))
        reach = min(seg_dist(F.world(x, PLEX_D_FACE), near[2], near[3]) for x in (0., F.W)) - ALLEY_HALF - 10
        width = min(rng.uniform(35, 60), reach - 3)
        creeper_h = 0. if (w['a'], w['b']) in mural_walls else min(w['top'] - 40, rng.uniform(280, 520))
        bed(F, 20., F.W - 20., PLEX_D_FACE + 1, PLEX_D_FACE + 1 + width, rng, 'wall', PLEX_D_FACE + 2.5, creeper_h)
    _green_entries(world, plex, S, lane, counts, green, alleys)
    _green_grass(world, S, lane, counts, green, by_id)
    counts['green_bed_metres'] = round(counts['green_bed_metres'])
    return green


def _plant(S, p, z, rng, counts):
    """One clump in a bed or planter, in October: a perennial (green, gold, rust or aster purple), an ornamental
    grass gone to straw, a shrub (a burning bush gone scarlet, or a green one) or a low ground cover. Perennials,
    shrubs and covers are crossed vertical foliage cards on the creeper's cut-out leaf set, the crossed-quad clumps
    of real-time vegetation (Pelzer, "Rendering Countless Blades of Waving Grass", GPU Gems ch. 7), so they read as
    leaves from every side instead of faceted mounds; a cover adds a flat leaf card on the soil."""
    kind = rng.choice(('perennial', 'perennial', 'perennial', 'grass', 'shrub', 'cover'))
    if kind == 'perennial':
        _cards(S, rng.choice(('plant_green', 'plant_green', 'plant_gold', 'plant_rust', 'plant_purple')), p, z,
               rng.uniform(15, 26), rng.uniform(25, 48), 2, rng)
    elif kind == 'grass':
        key = 'plant_straw'
        for _ in range(4):
            S.cone(key, (p[0] + rng.uniform(-9, 9), p[1] + rng.uniform(-9, 9), z), rng.uniform(3, 5), rng.uniform(45, 85),
                   3, rng.uniform(0, math.tau))
    elif kind == 'shrub':
        _cards(S, 'plant_red' if rng.chance(.6) else 'plant_green', p, z, rng.uniform(26, 36), rng.uniform(55, 85), 3, rng)
    else:
        key = rng.choice(('plant_green', 'plant_rust'))
        r = rng.uniform(25, 40)
        _cards(S, key, p, z, r, rng.uniform(10, 16), 2, rng)
        phase = rng.uniform(0, math.tau)
        S.face(key, [(p[0] + r * rng.uniform(.75, 1.) * math.cos(phase + i * math.tau / 6),
                      p[1] + r * rng.uniform(.75, 1.) * math.sin(phase + i * math.tau / 6), z + 2.5) for i in range(6)])
    counts['green_plants'] += 1


PLANT_CARD = ((-.35, 0.), (.35, 0.), (.5, .55), (.25, 1.), (-.25, 1.), (-.5, .55))   # a clump's ragged outline


def _cards(S, key, p, z, r, h, count, rng):
    """`count` vertical foliage cards crossed at the clump's centre (2 make an X, 3 a star), each the ragged
    hexagon PLANT_CARD about 2r wide and h tall (each card sized on its own); the masked material is two-sided, so
    one face. The bottom edge comes first, so the writer maps u along the card and v = z (the set's 2 m tile)."""
    phase = rng.uniform(0, math.pi)
    for k in range(count):
        a = phase + k * math.pi / count
        c, s = math.cos(a), math.sin(a)
        w, hh = 2 * r * rng.uniform(.85, 1.1), h * rng.uniform(.85, 1.05)
        S.face(key, [(p[0] + c * w * x, p[1] + s * w * x, z + hh * y) for x, y in PLANT_CARD])


def _creeper(S, F, x0, x1, d, height, rng):
    """Virginia creeper in frame F's plane d, facing +d: Leaf_Creeper cards of a ragged outline (convex pentagons
    with peaked tops, taller mid-patch, a few gaps and runners), the foliage-card method the Plex creeper uses.
    The bottom edge comes first, so the writer maps u along the face and v = z (the 2 m world tile)."""
    strips, x = 0, x0
    facing = (F.n[0], F.n[1], 0.)
    while x < x1 - 15:
        w = min(x1 - x, rng.uniform(35., 90.))
        if strips and rng.chance(.18):
            x += rng.uniform(8., 25.)
            continue
        runner = rng.chance(.15)
        if runner:
            w = min(w, rng.uniform(15., 28.))
        t = (x + w / 2 - x0) / max(1., x1 - x0)
        envelope = height * (.5 + .5 * (1 - (2 * t - 1) ** 2)) * (1.3 if runner else rng.uniform(.75, 1.))
        hl, hr = envelope * rng.uniform(.7, 1.), envelope * rng.uniform(.7, 1.)
        hm = min(height * 1.3, max(hl, hr) + rng.uniform(2., 12.))
        hl, hr = min(hl, hm - 2), min(hr, hm - 2)
        if hm > 20 and min(hl, hr) > 10:
            a, b, m = F.world(x, d), F.world(x + w, d), F.world(x + w / 2, d)
            pts = [(a[0], a[1], 0.), (b[0], b[1], 0.), (b[0], b[1], hr), (m[0], m[1], hm), (a[0], a[1], hl)]
            if newell(pts)[0] * facing[0] + newell(pts)[1] * facing[1] < 0:
                pts = [(b[0], b[1], 0.), (a[0], a[1], 0.), (a[0], a[1], hl), (m[0], m[1], hm), (b[0], b[1], hr)]
            S.face('Leaf_Creeper', pts)
            strips += 1
        x += w
    return strips


def _green_entries(world, plex, S, lane, counts, green, alleys):
    """An entry arch at each street end of a ruelle verte, set back past the sidewalk where both posts clear the
    buildings: two pairs of posts, lattice sides with creeper, two cross beams and rafters, 4 m clear; and two
    planters flanking the entry inside it."""
    done = set()
    for alley in world.alleys:
        if alley['id'] not in green:
            continue
        rid = green[alley['id']]['ruelles'][0] if green[alley['id']]['ruelles'] else alley['id']
        chain = [alley['segments'][0][0]]
        for a, b in alley['segments']:
            if math.dist(a, chain[-1]) > 5:
                break
            chain.append(b)
        for line in (chain, chain[::-1]):
            if len([k for k in done if k[0] == rid]) >= 2:
                break
            end = line[0]
            near = nearest_seg(world, end, 1500)
            if near is None or near[0] > 1200:
                continue
            spot = None
            for p, u in _walk(line, 50., 2600.):
                n = (-u[1], u[0])
                best = nearest_seg(world, p, 3000)
                if best is not None:
                    s = best[1]
                    lat = seg_local(s, p)[1]
                    need = s['curb' + ('L' if lat >= 0 else 'R')] + SIDEWALK_W.get(s['hw'], 190.) + 120
                    if abs(lat) < need and best[0] < need:
                        continue
                if on_pavement(world, p):
                    continue
                free = [world.building_ray(p, (n[0] * k, n[1] * k), 700) or 700. for k in (1, -1)]
                half = [min(255., f - 25.) for f in free]
                if min(half) < ALLEY_HALF + 13:
                    continue
                posts = [add(add(p, n, h * k), u, f) for h, k in ((half[0], 1), (half[1], -1)) for f in (-25, 25)]
                if any(world.in_building(q, 15) or plex.footprint_hit(q, 20) for q in posts):
                    continue
                if any(math.dist(q, pole) < 60 for q in posts for pole in world.utility_poles):
                    continue
                spot = (p, half, u, n)
                break
            if spot is None:
                counts['green_entries_without_room'] += 1
                continue
            done.add((rid, alley['id'], round(end[0])))
            rng = Rng('green-arch', alley['id'], round(end[0]), round(end[1]))
            u, n = spot[2], spot[3]
            _arch(S, spot[0], u, n, spot[1], rng, counts)
            lane['ruelles_vertes']['arches'].append({'osm_way': alley['id'], 'ruelle': rid,
                                                     'position': [r2(v) for v in spot[0]], 'axis': [r2(v) for v in u],
                                                     'half_cm': [r2(v) for v in spot[1]],
                                                     'width_cm': r2(sum(spot[1])), 'clear_cm': 380.})
            counts['green_arches'] += 1
            for k, h in ((1, spot[1][0]), (-1, spot[1][1])):
                c = add(add(spot[0], u, 110), n, k * (h - 28))
                _planter(S, c, u, rng, counts)
                lane['ruelles_vertes']['planters'].append([r2(c[0]), r2(c[1])])


def _walk(line, step, limit):
    """Points every `step` cm along a polyline from its first point, up to `limit`, with the local direction."""
    t = 0.
    for a, b in zip(line, line[1:]):
        u, length = unit(a, b)
        s = 0.
        while s <= length and t <= limit:
            yield add(a, u, s), u
            s += step
            t += step
        if t > limit:
            return


def _arch(S, p, u, n, half, rng, counts, height=400.):
    """A wooden pergola over the lane entry: posts 10 cm square in pairs 50 cm apart on each side, three 1 m
    Rail_Lattice cards between each pair (card UVs, so the diamonds keep their drawn size), creeper climbing the
    lattice, two 8 x 20 cm beams across the lane and 5 x 5 cm rafters on top."""
    mat = rng.choice(('arch_wood', 'arch_green', 'arch_wood'))
    yaw = math.degrees(math.atan2(u[1], u[0]))
    for k, h in ((1, half[0]), (-1, half[1])):
        side = add(p, n, k * h)
        for f in (-25, 25):
            c = add(side, u, f)
            S.box(mat, (c[0], c[1], height / 2), (10, 10, height), yaw, bottom=False)
        a, b = add(side, u, -20), add(side, u, 20)
        for z0 in (30., 130., 230.):
            S.card('Rail_Lattice', a, b, z0, z0 + 100, (-n[0] * k, -n[1] * k))
        frame = Frame2(add(side, u, -20), u, (-n[0] * k, -n[1] * k), 40.)
        counts['green_creeper_strips'] += _creeper(S, frame, 0., 40., 1.5, rng.uniform(200, 330), rng)
    left, right = add(p, n, half[0] + 30), add(p, n, -half[1] - 30)
    for f in (-25, 25):
        c = lerp(add(left, u, f), add(right, u, f), .5)
        S.box(mat, (c[0], c[1], height - 10), (8, half[0] + half[1] + 60, 20), yaw)
    span = half[0] + half[1] + 50
    count = max(3, int(span // 60))
    for i in range(count + 1):
        c = add(add(p, n, -half[1] - 25 + span * i / count), u, 0.)
        S.box(mat, (c[0], c[1], height + 2.5), (100, 5, 5), yaw)


def _planter(S, c, u, rng, counts):
    """A wooden planter box (bac de plantation) 110 x 45 x 45 cm with soil and three or four clumps."""
    mat = rng.choice(('planter_wood', 'bed_edge'))
    yaw = math.degrees(math.atan2(u[1], u[0]))
    S.box(mat, (c[0], c[1], 22.5), (110, 45, 45), yaw, bottom=False)
    F = Frame2(add(c, u, -50), u, (-u[1], u[0]), 100.)
    S.flat('Yard_Soil', F.poly(0., 100., -18., 18.), 42.)
    for i in range(rng.randint(3, 4)):
        _plant(S, F.world(15 + 70 * i / 3 + rng.uniform(-5, 5), rng.uniform(-8, 8)), 42., rng, counts)
    counts['green_planters'] += 1


def _green_grass(world, S, lane, counts, green, by_id):
    """Grass on the closed, vegetated stretches the city maps (CIRCULATION Fermée, TYPE_RECOUVREMENT Végétalisée
    or Gazonnée) where the ruelle is off the traffic graph: two Yard_Grass bands either side of a 1.4 m path."""
    for alley_id, record in sorted(green.items()):
        rings = [r['ring'] for r in record['polygons']
                 if r.get('circulation') == 'Fermée' and r.get('recouvrement') in ('Végétalisée', 'Gazonnée')]
        if not rings:
            continue
        for (a, b), profile in zip(by_id[alley_id]['segments'], by_id[alley_id]['reach']):
            u, length = unit(a, b)
            n = (-u[1], u[0])
            steps = max(1, int(length / 100))
            marks = []
            for i in range(steps + 1):
                q = lerp(a, b, i / steps)
                marks.append(any(point_in(q, r) for r in rings) and world.traffic_distance(q) >= CLEAR)
            i = 0
            while i < len(marks):
                if not marks[i]:
                    i += 1
                    continue
                j = i
                while j + 1 < len(marks) and marks[j + 1]:
                    j += 1
                t0, t1 = i / steps * length, j / steps * length
                if t1 - t0 >= 200:
                    for k in (1, -1):
                        # out to the paving's edge (the fence or a wall), as the open data's grass is
                        reach = min(r for t, r in zip(profile['t'], profile[k]) if t0 - 100 <= t <= t1 + 100) - 8
                        S.flat('Yard_Grass', [add(add(a, u, t0), n, k * 70), add(add(a, u, t1), n, k * 70),
                                              add(add(a, u, t1), n, k * reach),
                                              add(add(a, u, t0), n, k * reach)], Z_ALLEY + .6)
                    lane['ruelles_vertes']['grass'].append({'osm_way': alley_id, 'from': [r2(v) for v in add(a, u, t0)],
                                                            'to': [r2(v) for v in add(a, u, t1)]})
                    counts['green_grass_metres'] += (t1 - t0) / 100
                i = j + 1
    counts['green_grass_metres'] = round(counts['green_grass_metres'])


def _green_murals(world, plex, S, lane, counts, green, by_id, alleys):
    """One mural per ruelle verte: on the longest blank skin (no windows or doors, 5.2 m or more) that faces one of
    its ruelles across at most 15 m, the nearest first, from 2.2 m up where a yard fence may stand in front; where
    no such wall faces it, on the longest stretch of a lane board fence clear of gates, sheds and gate props (the
    ruelles vertes paint their fences and garage doors too). Returns the walls painted."""
    used = [(m['a'], m['b']) for m in lane.get('murals', [])]
    painted = set()
    groups = {}
    for alley_id, record in green.items():
        for rid in record['ruelles'] or [alley_id]:
            groups.setdefault(rid, []).append(alley_id)
    for rid in sorted(groups):
        segs = [(a, b) for alley_id in groups[rid] for a, b in by_id[alley_id]['segments']]
        best = None
        for w in plex.walls:
            if not w['skin'] or w['openings'] or w['kind'] == 'front' or math.dist(w['a'], w['b']) < 520 or w['top'] < 500:
                continue
            F = Frame2.from_wall(w['a'], w['b'])
            mid = F.world(F.W / 2, PLEX_D_FACE)
            if any(math.dist(mid, lerp(a, b, .5)) < 100 for a, b in used):
                continue
            for a, b in segs:
                d = seg_dist(mid, a, b)
                if not ALLEY_HALF <= d <= 1500:
                    continue
                au, _ = unit(a, b)
                foot = add(a, au, (mid[0] - a[0]) * au[0] + (mid[1] - a[1]) * au[1])
                if abs(F.u[0] * au[0] + F.u[1] * au[1]) < .95 or \
                        ((foot[0] - mid[0]) * F.n[0] + (foot[1] - mid[1]) * F.n[1]) / max(d, 1.) < .7:
                    continue
                key = (d > 600, -F.W, d)
                if best is None or key < best[0]:
                    best = (key, w, d)
                break
        rng = Rng('mural-green', rid)
        if best is not None:
            _, w, d = best
            z0 = 220. if d > 300 else 130.
            if _mural(S, {'a': w['a'], 'b': w['b']}, {'height': w['top']}, rng, off=PLEX_D_FACE + .9, z0=z0,
                      min_h=200.):
                used.append((w['a'], w['b']))
                painted.add((w['a'], w['b']))
                counts['murals'] += 1
                counts['green_murals'] += 1
                lane['ruelles_vertes']['murals'].append({'ruelle': rid, 'host': 'wall', 'owner': w['owner'],
                                                         'kind': w['kind'], 'a': [r2(v) for v in w['a']],
                                                         'b': [r2(v) for v in w['b']], 'distance_cm': r2(d),
                                                         'offset_cm': PLEX_D_FACE + .9, 'z0_cm': z0})
                continue
        fences = []
        for lot in plex.lots:
            fence, F = lot['rear'].get('fence'), lot['frame']
            if F is None or not fence or not fence.get('lane') or fence['kind'] not in ('boards', 'slats'):
                continue
            near = alleys.nearest(F.world(F.W / 2, F.D), 700)
            if near is None or near[1] not in groups[rid]:
                continue
            cuts = list(lot['lane_busy']) + ([(fence['gate_at'] - 75, fence['gate_at'] + 75)]
                                              if fence.get('gate_at') is not None else [])
            if fence.get('shed_at'):
                cuts.append((fence['shed_at'][0] - 10, fence['shed_at'][1] + 10))
            for r0, r1 in fence['runs']:
                for p0, p1 in subtract((r0, r1), cuts):
                    if p1 - p0 >= 320:
                        fences.append((-(p1 - p0), len(fences), lot, p0, p1))
        if fences:
            _, _, lot, p0, p1 = min(fences, key=lambda f: f[:2])
            F, h = lot['frame'], lot['rear']['fence']['height_cm']
            a, b = F.world(p0, F.D), F.world(p1, F.D)
            if _mural(S, {'a': a, 'b': b}, {'height': h + 82.}, rng, off=1.2, z0=15., margin=15., min_h=120.,
                      min_w=250.):
                lot['lane_busy'].append((p0, p1))
                counts['murals'] += 1
                counts['green_murals'] += 1
                lane['ruelles_vertes']['murals'].append({'ruelle': rid, 'host': 'fence', 'owner': lot['id'],
                                                         'kind': lot['rear']['fence']['kind'],
                                                         'a': [r2(v) for v in a], 'b': [r2(v) for v in b],
                                                         'offset_cm': 1.2, 'z0_cm': 15.})
                continue
        lane['ruelles_vertes']['murals'].append({'ruelle': rid, 'host': None, 'note': 'no blank wall or fence faces it'})
    return painted


# -- tags ---------------------------------------------------------------------------------------

# Letter skeletons for the tag generator, in a unit cell (x right, y up): a stem with a bowl, an arch, a double
# arch, a zigzag, a loop with a tail, a hook, a peak with a bar, a kicked stem and a bar with a descender.
GLYPHS = (((0, 1), (0, 0), (.2, .1), (1, .35), (.85, .6), (.1, .5)),
          ((0, 0), (0, .65), (.35, .8), (.65, .65), (.7, 0)),
          ((0, 0), (0, .7), (.3, .8), (.5, .6), (.5, 0), (.5, .6), (.75, .8), (1, .6), (1, 0)),
          ((0, 1), (1, 1), (0, 0), (1, 0)),
          ((.9, .6), (.5, .8), (.05, .55), (.1, .1), (.55, 0), (.95, .25), (.9, .6), (.75, .2)),
          ((.8, 1.05), (.3, .95), (.15, .4), (.35, 0), (.8, .1)),
          ((0, 0), (.5, 1), (1, 0), (.25, .45), (.8, .45)),
          ((0, 1), (0, 0), (.7, .5), (0, .55), (.9, 0)),
          ((0, .8), (1, .8), (.5, .8), (.5, -.25), (.2, -.15)))


def tag_strokes(rng):
    """A tag as strokes of points, after the Graffiti Markup Language's model (a tag is a list of strokes, each a
    list of points; the strokes have no width until drawn): three to six slanted letters from GLYPHS with a
    jittered hand, run together now and then, often an underline swoosh, smoothed by one Chaikin pass."""
    strokes, x = [], 0.
    for i in range(rng.randint(3, 6)):
        w, h = rng.uniform(.45, .8), rng.uniform(.75, 1.05) * (1.25 if i == 0 else 1.)
        pts = [(x + px * w + rng.uniform(-.05, .05), py * h + rng.uniform(-.05, .05)) for px, py in rng.choice(GLYPHS)]
        if strokes and rng.chance(.5):
            strokes[-1].extend(pts)
        else:
            strokes.append(pts)
        x += w + rng.uniform(.06, .22)
    if rng.chance(.65):
        strokes.append([(-.15, -.12), (x * .45, -.3 + rng.uniform(-.05, .05)), (x + .1, -.12), (x + .25, .12)])
    slant = rng.uniform(.12, .4)
    out = []
    for s in strokes:
        s = [(px + slant * py, py) for px, py in s]
        smooth = [s[0]]
        for p, q in zip(s, s[1:]):
            smooth += [lerp(p, q, .25), lerp(p, q, .75)]
        out.append(smooth + [s[-1]])
    return out


def _tag(S, F, x0, x1, z0, z1, d, rng):
    """Draw a tag (or, now and then, a two- or three-letter throw-up: bubble letters filled silver or white with a
    black outline) in frame F's plane d, facing +d, inside x0..x1 by z0..z1. Original strokes, no real tag."""
    facing = (F.n[0], F.n[1], 0.)
    tris = 0
    if z1 - z0 >= 70 and rng.chance(.25):
        letters = rng.randint(2, 3)
        # a letter reaches 1.12 x 1.12 x 1.1 = 1.38 r across and 1.26 r (+ .1 r of jitter) up and down
        r = min((z1 - z0) / 2.75, (x1 - x0) / (2.8 + 1.55 * (letters - 1)))
        fill = rng.choice(('tag_silver', 'tag_silver', 'tag_white'))
        for i in range(letters):
            cx, cz = x0 + r * 1.4 + i * r * 1.55, (z0 + z1) / 2 + rng.uniform(-.1, .1) * r
            radii = [r * rng.uniform(.82, 1.12) for _ in range(10)]
            for key, scale, lift in (('tag_black', 1.12, 0.), (fill, 1., .3)):
                ring = []
                for k in range(10):
                    a = k * math.tau / 10
                    q = F.world(cx + math.cos(a) * radii[k] * scale * 1.1, d + lift)
                    ring.append((q[0], q[1], cz + math.sin(a) * radii[k] * scale))
                S.face(key, oriented(ring, facing))
                tris += 8
        return tris, 'throw-up'
    strokes = tag_strokes(rng)
    xs = [p[0] for s in strokes for p in s]
    ys = [p[1] for s in strokes for p in s]
    scale = min((x1 - x0) / max(.1, max(xs) - min(xs)), (z1 - z0) / max(.1, max(ys) - min(ys))) * rng.uniform(.75, .95)
    ox = x0 + ((x1 - x0) - (max(xs) - min(xs)) * scale) * rng.random() - min(xs) * scale
    oz = z0 + ((z1 - z0) - (max(ys) - min(ys)) * scale) * rng.random() - min(ys) * scale
    width = max(2.5, scale * rng.uniform(.07, .11))           # a fat marker or a spray line, readable from the lane
    key = rng.choice(TAG_COLOURS)
    for s in strokes:
        pts = [(ox + px * scale, oz + py * scale) for px, py in s]
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            length = math.hypot(bx - ax, bz - az)
            if length < .8:
                continue
            px, pz = -(bz - az) / length * width / 2, (bx - ax) / length * width / 2
            corners = []
            for qx, qz in ((ax - px, az - pz), (bx - px, bz - pz), (bx + px, bz + pz), (ax + px, az + pz)):
                q = F.world(qx, d)
                corners.append((q[0], q[1], qz))
            S.face(key, oriented(corners, facing))
            tris += 2
    return tris, 'tag'


def _fence_bays(fence):
    """Bays between the posts of a fence's runs (x from the lot line), as plateau_plex._fence_run spaces them."""
    spacing, half = PLEX_POSTS.get(fence['kind'], (244., 4.5))
    bays = []
    for r0, r1 in fence['runs']:
        length = r1 - r0
        count = max(1, math.ceil(length / spacing))
        posts = [r0 + min(max(length * i / count, half), length - half) for i in range(count + 1)]
        bays += [(p + half, q - half) for p, q in zip(posts, posts[1:])]
    return bays


def lane_tags(world, plex, S, lane, counts, green):
    """Tags on the lane face of some lane fences (between two posts, clear of the gate and of the gate props) and
    on some shed and garage doors that open on a ruelle; on the ruelles vertes only on doors, half as often."""
    alleys = AlleyIndex(world)
    rows = []
    for lot in plex.lots:
        rear, F = lot['rear'], lot['frame']
        fence = rear.get('fence')
        if F is None or not fence or not fence.get('lane'):
            continue
        near = alleys.nearest(F.world(F.W / 2, F.D), 700)
        on_green = near is not None and near[1] in green
        rng = Rng('tag-fence', lot['id'])
        if not on_green and fence['kind'] in PLEX_POSTS and rng.chance(TAG_FENCE):
            g = fence.get('gate_at')
            busy = list(lot['lane_busy']) + ([(g - 160, g + 160)] if g is not None else []) + \
                ([tuple(fence['shed_at'])] if fence.get('shed_at') else [])
            bays = [(a, b) for a, b in _fence_bays(fence) if b - a >= 110 and not any(a < y and b > x for x, y in busy)]
            if bays:
                a, b = rng.choice(bays)
                top = min(fence['height_cm'] - 15, 155.)
                tris, kind = _tag(S, F, a + 6, b - 6, 32., top, F.D + 1.2, rng)
                rows.append({'lot': lot['id'], 'on': 'fence', 'kind': kind, 'x_cm': [r2(a + 6), r2(b - 6)],
                             'plane': [[r2(v) for v in F.world(a, F.D + 1.2)], [r2(v) for v in F.world(b, F.D + 1.2)]],
                             'facing': [r2(F.n[0]), r2(F.n[1])]})
                counts['tags_fences'] += 1
        door = lot.get('door')
        if door and (rear.get('yard') or {}).get('shed'):
            rng = Rng('tag-door', lot['id'])
            share = (TAG_GARAGE if door[4] else TAG_SHED) * (.5 if on_green else 1.)
            if rng.chance(share):
                x0, x1, d1, h, garage = door
                tris, kind = _tag(S, F, x0 + 6, x1 - 6, 28., h - 18, d1 + 1.6, rng)
                rows.append({'lot': lot['id'], 'on': 'garage door' if garage else 'shed door', 'kind': kind,
                             'x_cm': [r2(x0 + 6), r2(x1 - 6)],
                             'plane': [[r2(v) for v in F.world(x0, d1 + 1.6)], [r2(v) for v in F.world(x1, d1 + 1.6)]],
                             'facing': [r2(F.n[0]), r2(F.n[1])]})
                counts['tags_doors'] += 1
    lane['tags'] = rows


GALLERY_PROPS = ('chair_patio', 'bbq', 'bike_gallery', 'bin_recycling', 'bin_compost', 'potted_plant', 'ac_unit',
                 'flower_box', 'satellite_dish')
LANE_COUNTS = ('laundry_lines', 'laundry_poles', 'garments', 'laundry_modules_without_room', 'gallery_decks',
               'gallery_decks_lived', 'gallery_props', *('gallery_' + k for k in GALLERY_PROPS),
               'gallery_dishes_without_sky', 'gate_bin_recycling',
               'gate_bin_compost', 'gate_flower_box', 'gate_bike_locked', 'gate_props_lane_side', 'gate_props_yard_side',
               'gate_props_without_room', 'ruelles_vertes_osm_ways', 'ruelles_vertes_ids', 'green_bed_metres',
               'green_plants', 'green_creeper_strips', 'green_arches', 'green_entries_without_room', 'green_planters',
               'green_grass_metres', 'green_murals', 'murals', 'tags_fences', 'tags_doors')


def build_lane_life(world, S, put, counts, lane, plex):
    """Laundry, gallery life, gate props, ruelles vertes and tags, in that order (each later step keeps clear of the
    earlier)."""
    for key in LANE_COUNTS:
        counts.setdefault(key, 0)
    if plex is None:
        lane['note'] = 'Plex/fronts.json missing: no laundry, gallery life, gate props, ruelles vertes or tags'
        return
    poles = lane_laundry(world, plex, S, lane, counts)
    if all(k in props_cached()['bounds'] for k in GALLERY_PROPS):
        lane_galleries(world, plex, put, lane, counts, PlexGlass(), lane['laundry']['lines'])
    lane_gates(world, plex, put, lane, counts, poles)
    green = lane_green(world, plex, S, lane, counts)
    lane_tags(world, plex, S, lane, counts, green)


def clip_ruelles(path, out=None):
    """Write Soul/ruelles_vertes_clip.json from the city's ruelles-vertes.geojson (CRS84): the polygons within
    20 m of the district, in the map frame (cm, 1 mm), with their attributes, the source and the file's hash."""
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    box = district_box()
    pad = 2000.
    rows, borough = [], set()
    for f in data['features']:
        props, geom = f['properties'], f['geometry']
        if props.get('CODE_ARR') == 'PMR':
            borough.add(props.get('RUELLE_ID'))
        polygons = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        for rings in polygons:
            ring = [xy(lat, lon) for lon, lat in rings[0][:-1]]
            b = bbox(ring)
            if b[2] < box[0] - pad or b[0] > box[2] + pad or b[3] < box[1] - pad or b[1] > box[3] + pad:
                continue
            if area(ring) < 0:
                ring.reverse()
            rows.append({'ruelle_id': props.get('RUELLE_ID'), 'id_trc': props.get('ID_TRC'),
                         'borough': props.get('CODE_ARR'), 'forme': props.get('FORME'),
                         'circulation': props.get('CIRCULATION'), 'amenagement': props.get('TYPE_AMENAGEMENT'),
                         'recouvrement': props.get('TYPE_RECOUVREMENT'), 'amenage': props.get('DATE_AMENAGEMENT'),
                         'ring': [[round(p[0], 1), round(p[1], 1)] for p in ring]})
    rows.sort(key=lambda r: (r['ruelle_id'] or '', r['id_trc'] or 0, r['ring'][0]))
    doc = {'source': dict(RUELLES_VERTES_SOURCE, sha256=hashlib.sha256(raw).hexdigest(), features=len(data['features']),
                          borough_ruelles=len(borough), note='Plateau-Mont-Royal (CODE_ARR PMR) RUELLE_IDs in the file'),
           'frame': FRAME + ' (prepare_lafontaine.xy of the CRS84 rings)', 'pad_cm': pad,
           'ruelles': len({r['ruelle_id'] for r in rows}), 'polygons': rows}
    target = Path(out or RUELLES_VERTES)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    return doc


# ---------------------------------------------------------------------------------------------

def write_street_trees(world, path, counts):
    """Streets/street_trees.json: the rules, the sources, the counts, the curb extensions, the host list and one
    line per tree (inventory trees first, then the OSM trees the inventory lacks)."""
    keys = ('street_trees', 'street_trees_inventory', 'street_trees_osm', 'sidewalk_pits', 'sidewalk_pits_moved',
            'sidewalk_pit_metres_moved', 'trees_kept_in_place', 'trees_on_sidewalk_without_pit',
            'trees_dropped_in_buildings', 'trees_on_carriageway', 'curb_extensions', 'curb_extension_trees',
            'curb_extensions_saillie', 'curb_extensions_median', 'curb_extensions_choker', 'curb_extensions_corner',
            'curb_extensions_merged',
            'curb_extensions_flush', 'curb_extensions_part_flush', 'curb_extensions_on_verges',
            'curb_extensions_on_corners', 'trees_for_host', 'tree_pits', 'pit_guard_cards', 'pit_flower_cards')
    kinds = {}
    for row in world.street_tree_rows:
        kinds[row['kind']] = kinds.get(row['kind'], 0) + 1
    head = {'layer': 'Streets', 'generator': GENERATOR, 'frame': FRAME + ' (the map frame; Unreal x and y alike)',
            'note': 'Every street and park tree the game shows, one row per tree: id (inv:<borough>-<EMP_NO> from '
                    'the city inventory, osm:<node> for an OSM tree the inventory lacks), x_cm, y_cm, z_cm (ground '
                    'under the trunk: the pit soil, a sidewalk, lawn or bare ground), species (the inventory\'s '
                    'Latin name, or unknown), kind (a Trees manifest kind, from TREE_SPECIES and TREE_GENERA in '
                    'plateau_replica.py, else by crown size), dbh_cm (trunk diameter at breast height; dbh_from '
                    'says when it is estimated), height_cm (from the trunk, research-plateau.md 10.4), source '
                    '(inventory or osm), placement (the inventory\'s Emplacement), pit (in a sidewalk or extension '
                    'pit), yaw_deg (seeded); moved_cm and mapped_xy_cm when the tree moved into a sidewalk pit, '
                    'extension (index into extensions), conifer (no conifer kind yet).',
            'sources': {'inventory': dict(TREE_SOURCE, files=['Data/Plateau/Inventory/' + n for n in TREE_FILES]),
                        'osm': '\u00a9 OpenStreetMap contributors, ODbL 1.0 (natural=tree nodes the inventory lacks)'},
            'rules_cm': {'pit': [PIT_L, PIT_D], 'pit_from_curb': list(PIT_BACK), 'pit_gap': PIT_GAP,
                         'ramp_keep': RAMP_KEEP, 'pit_slide_max': PIT_SLIDE_MAX, 'osm_same_tree': OSM_TREE_SAME,
                         'extension_corner_reach': CORNER_REACH, 'extension_choker_reach': CHOKER_REACH,
                         'extension_reach': BUMP_REACH, 'margin': BUMP_MARGIN, 'park_gap': PARK_GAP,
                         'traffic_clear': CLEAR, 'raised_top': Z_WALK, 'flush_top': Z_DROP},
            'kinds': dict(sorted(kinds.items())),
            'counts': {k: counts[k] for k in keys},
            'extensions': world.extension_rows, 'host_review': world.tree_host,
            'dropped': [{'id': t['id'], 'position': [r2(t['p'][0]), r2(t['p'][1])], 'reason': t['why']}
                        for t in world.street_tree_dropped]}
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "trees": [\n' + \
        ',\n'.join('  ' + json.dumps(row, ensure_ascii=False) for row in world.street_tree_rows) + '\n ]\n}\n'
    Path(path).write_text(text)


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
    # Every street and park tree the game shows, one row each (the contract the apply step's tree actors read), the
    # curb extensions and the trunks left for the host.
    write_street_trees(world, directory / 'Streets/street_trees.json', street_counts)
    streets_manifest = json.loads((directory / 'Streets/manifest.json').read_text())
    streets_manifest['street_trees'] = 'street_trees.json'
    streets_manifest['street_trees_sha256'] = sha_file(directory / 'Streets/street_trees.json')
    (directory / 'Streets/manifest.json').write_text(json.dumps(streets_manifest, ensure_ascii=False, indent=1) + '\n')
    results['Streets'] = streets_manifest
    # The Furniture layer also gets a manifest (no batches) so the apply step can treat layers uniformly.
    furn_manifest = {'layer': 'Furniture', 'generator': GENERATOR, 'frame': FRAME, 'batches': [], 'materials': {},
                     'placements': 'placements.json', 'counts': furniture_counts,
                     'source_sha256': source_hashes(),
                     'placements_sha256': sha_file(directory / 'Furniture/placements.json'),
                     'props_manifest_sha256': sha_file(PROPS_MANIFEST) if PROPS_MANIFEST.is_file() else None}
    (directory / 'Furniture/manifest.json').write_text(json.dumps(furn_manifest, ensure_ascii=False, indent=1) + '\n')
    soul_manifest = json.loads((directory / 'Soul/manifest.json').read_text())
    soul_manifest['placements'] = 'placements.json'
    soul_manifest['placements_sha256'] = sha_file(directory / 'Soul/placements.json')
    lane = dict(getattr(world, 'lane_life', {}))
    lane_doc = {'layer': 'Soul', 'generator': GENERATOR, 'frame': FRAME,
                'note': 'Lane life records: laundry poles and lines (anchored on Plex gallery guards), gate props, '
                        'ruelles vertes (beds, arches, planters, grass, murals), street murals and tags. Positions in '
                        'cm; the meshes are in the Soul batches, the gate props in placements.json.',
                'counts': {k: soul_counts.get(k, 0) for k in LANE_COUNTS}, **lane}
    (directory / 'Soul/lane_life.json').write_text(json.dumps(lane_doc, ensure_ascii=False, indent=1) + '\n')
    soul_manifest['lane_life'] = 'lane_life.json'
    soul_manifest['lane_life_sha256'] = sha_file(directory / 'Soul/lane_life.json')
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
    if len(sys.argv) >= 3 and sys.argv[1] == '--clip-trees':
        done = clip_trees(*sys.argv[2:])
        print(', '.join(f'Data/Plateau/Inventory/{name}: {n} trees' for name, n in done.items()))
        sys.exit(0)
    if len(sys.argv) == 3 and sys.argv[1] == '--clip-ruelles':
        doc = clip_ruelles(sys.argv[2])
        print(f"{RUELLES_VERTES.relative_to(ROOT)}: {len(doc['polygons'])} polygons of {doc['ruelles']} ruelles vertes "
              f"({doc['source']['borough_ruelles']} in the borough file)")
        sys.exit(0)
    world, results = prepare()
    print(json.dumps(summary(results), indent=1))
    print(json.dumps(results['Streets']['counts'], indent=1, ensure_ascii=False))
    print(json.dumps(results['Furniture']['counts'], indent=1, ensure_ascii=False))
    print(json.dumps(json.loads((OUT / 'Soul/manifest.json').read_text())['counts'], indent=1, ensure_ascii=False))
