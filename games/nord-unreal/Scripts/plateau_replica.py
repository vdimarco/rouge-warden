"""Plateau replica streetscape: measured streets, furniture placements and a lived-in layer.

Writes three layers under Data/Plateau/ReplicaGeometry/ (frame: x east, y north, z up, cm):

* Streets   - carriageways cut to curb lines measured from the mapped sidewalks, Québec paint,
              grey concrete sidewalks with an 18 cm curb (SM_Concrete_Collision_Replica_*),
              parterres with low iron fences, the street and park trees of the city's inventory with their
              sidewalk pits (guards and planting) and the few curb extensions the data or a corner calls for
              (street_trees.json), ruelle surfaces with a sunken aged-concrete gutter, bike-track bollards, and
              the on-street bike lanes, shared-street marks and bus-lane diamonds of the OSM cycleway tags
              (bike_paint.json), and the outline of every crosswalk and stop bar as painted (paint_marks.json).
* Furniture - placements.json only: lamps, hydrants, ARRÊT signs, white street-name signs,
              one-way and parking signs, BIXI docks, benches, bins and mail boxes. The meshes
              come from the MAP-PROPS layer (ReplicaGeometry/Props).
* Soul      - seeded wear and life (asphalt patches, sealed cracks, potholes, fallen leaf litter, weeds,
              rust streaks, original colour-block murals, ruelle wires) and the lane life read from the
              Plex yard records: pulley clotheslines from the gallery rails to yard poles, bins, flower
              boxes and bikes at the gates, the ruelles vertes (city open data: beds, plants, creeper,
              entry arches, planters, murals) and tags; placements.json for cones, chantier fences,
              utility poles, curb and gate bins, locked bikes, and late-October paper leaf bags at the
              curbs and pumpkins on the stoops; lane_life.json with the lane records.

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
import unicodedata
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_lafontaine import BOUNDS, ROOT, inside, tags, xy  # noqa: E402
import plateau_park_signs  # noqa: E402

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
           'Data/Plateau/Inventory/trees_pmr.json', 'Data/Plateau/Inventory/trees_vm.json',
           # the street lights and utility poles: the city's sign poles and their signs, clipped by --clip-sign-poles
           'Data/Plateau/Inventory/sign_poles.json',
           # the parking signs at the city's poles: its parking-sign inventory (plateau_park_signs.py --clip)
           'Data/Plateau/Inventory/park_signs.json', 'Scripts/plateau_park_signs.py',
           # the laundry atlas's cells (UV rect, size, pegs) the garments address (Scripts/plateau_textures.py)
           'Data/Plateau/ReplicaGeometry/Textures/textures.json',
           # the crowns the washing keeps out of and the leaf litter lies under: the tree meshes' crowns and leaf
           # retention, and the Plex yard trees
           'Data/Plateau/ReplicaGeometry/Trees/manifest.json', 'Data/Plateau/ReplicaGeometry/Plex/yard_trees.json')
# The leaf litter's ground (LitterGround): the park's lawn and the paths, ponds, courts and old roads over it; and the
# park build's own fallen leaves, which the park litter's height clears (LITTER_PARK).
LITTER_LAWN, LITTER_COVERS = ('Grass.obj',), ('Path.obj', 'Water.obj', 'Court.obj', 'Road.obj')
LITTER_INPUTS = tuple(f'Data/Plateau/BaseGeometry/{name}' for name in LITTER_LAWN + LITTER_COVERS) + tuple(
    sorted(path.relative_to(ROOT).as_posix() for path in (ROOT / 'Data/Plateau/ParkGeometry').glob('Autumn*.obj')))
SOURCES += LITTER_INPUTS
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
LOT_PAVE = 1500.          # and, behind the street-front yards, out to the first Plex lot line, fence, shed or wall
                          # this near (lanes are paved lot line to lot line)
WALL_SNAP = 30.           # a first Plex line this near the fence line is the fence line
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
    # Sealed cracks: dull, near-black bitumen. At roughness .35, then .62, the sky's highlight still turned them into
    # white paint strokes at a grazing view (the corner capture's "white hook"); at .88 they are as rough as the
    # asphalt round them, so only their colour shows. The pothole's broken base is as dull (it was .3, a wet glare).
    'crack_seal': ('Soul_crack_seal', '#0f1011', .88, 0., 'none', None),
    'pothole': ('Soul_pothole', '#1f1d1b', .88, 0., 'none', None),
    # Fallen leaves: the Leaf_Litter set (plateau_textures.leaf_litter), masked and two-sided on world metre UVs. The
    # set owns its colours (the material's tint is white); this colour is the set's mean, the flat fallback.
    'Leaf_Litter': ('Soul_Leaf_Litter', '#96733d', .7, 0., 'none', None),
    'weed': ('Soul_weed', '#4f6b2f', .95, 0., 'none', None),
    'rust': ('Soul_rust', '#7a3e1d', .9, 0., 'none', None),
    'wire': ('Soul_wire', '#121212', .5, .3, 'none', None),
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
    # The washing: garments on the Cloth_Laundry atlas (plateau_textures.laundry: sheets, towels, shirts, T-shirts,
    # jeans, a dress, a pillowcase and shorts, each in its own cell with its pegs and folds; masked, two-sided). The
    # set owns its colours (the material's tint is white); this colour is the set's mean.
    'Cloth_Laundry': ('Soul_Cloth_Laundry', '#bcb4ae', .9, 0., 'none', None),
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
    # Ornamental grass gone to straw: crossed cards of the fountain_grass set (a fountain of blades and buff plumes, V
    # clamped), at the set's mean colour so the tint is about 1.
    'Plant_Grass_Fountain': ('Soul_Plant_Grass_Fountain', '#947f53', .81, 0., 'none', None),
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
             'bench', 'mailbox', 'chair_patio', 'bbq', 'satellite_dish', 'potted_plant', 'bike_gallery',
             # late October (Props kind 'season'): kraft leaf bags at the curbs and pumpkins on the stoops, by form
             'leaf_bag', 'leaf_bag_mid', 'leaf_bag_low', 'pumpkin', 'pumpkin_carved')
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


def polygon_centroid(poly):
    """The area centroid of a simple polygon (its mean point when it has no area)."""
    a2 = cx = cy = 0.
    for p, q in zip(poly, poly[1:] + poly[:1]):
        w = p[0] * q[1] - q[0] * p[1]
        a2, cx, cy = a2 + w, cx + (p[0] + q[0]) * w, cy + (p[1] + q[1]) * w
    if abs(a2) < 1e-9:
        return sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    return cx / (3. * a2), cy / (3. * a2)


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


def paint_mark(marks, kind, s, a0, a1, lo, hi, **extra):
    """One painted mark's outline for Streets/paint_marks.json: the box from a0 to a1 along segment s and from lo to
    hi across it, which holds all of its paint."""
    if marks is not None:
        marks[kind].append(dict(extra, seg=s['i'], way=s['way'], outline=[
            [r2(v) for v in seg_point(s, a, lat)] for a, lat in ((a0, lo), (a1, lo), (a1, hi), (a0, hi))]))


def paint_crosswalk(layer, s, along, style, counts, band=300., marks=None, source='osm'):
    if style is None:
        return
    lo, hi = -s['curbR'] + 25, s['curbL'] - 25
    if hi - lo < 200:
        return
    if style == 'lines_white':
        for d in (along - band / 2, along + band / 2):
            layer.strip('paint_white', seg_point(s, d, lo), seg_point(s, d, hi), 20, Z_PAINT)
        counts['crosswalks_lines_white'] += 1
        paint_mark(marks, 'crosswalks', s, along - band / 2 - 10, along + band / 2 + 10, lo, hi, style=style,
                   source=source)
    else:
        key = 'paint_yellow' if style == 'continental_yellow' else 'paint_white'
        lateral = lo + 25
        while lateral <= hi - 25:
            layer.strip(key, seg_point(s, along - band / 2, lateral), seg_point(s, along + band / 2, lateral), 50, Z_PAINT)
            lateral += 100
        counts['crosswalks_' + style] += 1
        paint_mark(marks, 'crosswalks', s, along - band / 2, along + band / 2, lo, hi, style=style, source=source)


def build_streets(world):
    L = Layer('Streets', STREETS_MATERIALS)
    surfaces = Surfaces()
    world.surfaces = surfaces
    counts = {k: 0 for k in (
        'carriageway_quads', 'junction_polygons', 'sidewalk_pieces', 'concave_pieces', 'bowtie_pieces_dropped', 'sidewalk_metres', 'curb_ramps',
        'dropped_aprons', 'corner_pieces', 'yards', 'yard_square_metres', 'fence_metres', 'tree_pits',
        'stop_bars', 'stop_bars_signal', 'stop_bars_osm_stop', 'crosswalks_continental_white',
        'crosswalks_continental_yellow', 'crosswalks_lines_white', 'crosswalks_generated_at_stops',
        'centre_line_metres', 'lane_line_metres', 'parking_line_metres', 'parking_line_sides', 'bike_track_metres',
        'bollards', 'bike_pictograms', 'green_conflict_zones', 'manholes', 'storm_drains', 'ruelle_metres',
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
        'curb_extension_back_walls', 'apron_walls', 'tree_pits_slid', 'ruelle_gutter_metres', 'trees_reseated',
        'trees_reseated_pit', 'trees_reseated_parterre', 'trees_reseated_median', 'bike_lane_line_metres',
        'bike_lane_marks', 'sharrows', 'bus_diamonds', 'bike_paint_sides', 'bike_paint_too_narrow', 'track_buffers',
        'track_buffer_metres')}
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
    world.paint_marks = marks = {'crosswalks': [], 'stop_bars': []}

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
        paint_mark(marks, 'stop_bars', s, along - 20, along + 20, lo, hi, source=kind)
        bars.setdefault(s['i'], []).append(along)
        return travel

    bars = {}     # stop bars and generated crosswalks per segment: the bike paint stops short of them

    painted_crossings = set()
    for mark in stop_marks:
        s = world.segs[mark['seg']]
        bar(s, mark['along'], mark['forward'], 'osm_stop')
        toward = 1 if mark['forward'] else -1
        near = [c for c in world.crossings if c['seg'] == s['i'] and 0 < (c['along'] - mark['along']) * toward < 1500]
        if not near:
            cw = mark['along'] + toward * 280
            if 150 < cw < s['len'] - 150:
                paint_crosswalk(L, s, cw, 'lines_white', counts, marks=marks, source='stop')
                counts['crosswalks_generated_at_stops'] += 1
                bars.setdefault(s['i'], []).append(cw)
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
            paint_crosswalk(L, s, cw, 'continental_white', counts, marks=marks, source='signal')
            bars.setdefault(s['i'], []).append(cw)
            for side in (s['curbL'], -s['curbR']):
                ramp_points.append(seg_point(s, cw, side))
    done = []
    for c in world.crossings:
        key = (c['way'], c['seg'])
        if key in painted_crossings or any(si == c['seg'] and abs(al - c['along']) < 350 for si, al in done):
            continue
        painted_crossings.add(key)
        done.append((c['seg'], c['along']))
        paint_crosswalk(L, world.segs[c['seg']], c['along'], c['style'], counts, marks=marks, source='osm')

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
        bike = bike_paint_sides(s['tags'])
        # Lane lines between same-direction lanes, inside the parked cars and the bike lanes.
        if s['oneway'] and lanes >= 2 or not s['oneway'] and lanes >= 4:
            right = -s['curbR'] + bike_band(s, 'R', parking, bike)
            left = s['curbL'] - bike_band(s, 'L', parking, bike)
            groups = [(right, left, lanes)] if s['oneway'] else [(right, 0, lanes // 2), (0, left, lanes // 2)]
            for lo, hi, n in groups:
                for k in range(1, n):
                    off = lo + (hi - lo) * k / n
                    for x in _dashes(a0, a1, 300, 600):
                        if free(x[0]) and free(x[1]):
                            L.strip('paint_white', seg_point(s, x[0], off), seg_point(s, x[1], off), 10, Z_PAINT)
                            counts['lane_line_metres'] += (x[1] - x[0]) / 100
        for side, sign in (('L', 1), ('R', -1)):
            if bike.get(side) and bike[side][0] in ('lane', 'busway'):
                continue      # a bike lane's own inner line runs along the parked cars; a bus lane has none
            # A plain parking line only where OSM says the parking is marked (parking_marked), outside the cars.
            if parking[side] and parking_marked(s['tags'], side):
                off = sign * (drawn_curb(world, s, side) - PARKING_W)
                if abs(off) > 150:
                    L.strip('paint_white', seg_point(s, a0, off), seg_point(s, a1, off), 10, Z_PAINT)
                    counts['parking_line_metres'] += (a1 - a0) / 100
                    counts['parking_line_sides'] += 1
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

    paint_stops = {k: list(v) for k, v in cross_by_seg.items()}
    for k, v in bars.items():
        paint_stops.setdefault(k, []).extend(v)
    _bike_tracks(world, L, counts, paint_stops)
    _bike_lanes(world, L, counts, paint_stops)

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
    draw_sidewalk_pits(world, L, counts)
    _apron_walls(world, L, surfaces, counts)
    _legacy_dashes(world, L, counts)
    finish_street_trees(world, counts)
    for k in ('sidewalk_metres', 'yard_square_metres', 'fence_metres', 'centre_line_metres', 'lane_line_metres',
              'parking_line_metres', 'bike_track_metres', 'ruelle_metres', 'ruelle_square_metres',
              'ruelle_edge_metres', 'curb_extension_metres', 'yard_mouth_wedge_square_metres', 'passage_square_metres',
              'sidewalk_pit_metres_moved', 'ruelle_gutter_metres', 'bike_lane_line_metres', 'track_buffer_metres'):
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


# Parking beside a cycle track. Where a way side's OSM tags park it, or two of the city's on-street poles sign it
# for parking now (plateau_parking.SIGNED_POLES, as plateau_parking.ParkSigns matches them), the cars stand on the
# street side of the track's buffer. There the buffer is a 70 cm concrete separator, 11 cm high, with the bollards
# on it: its face is the curb the parked cars keep (plateau_parking finds it as it finds a sidewalk curb, an
# SM_Concrete_Collision top at Z_WALK). It is built only where a car against it keeps 300 cm from every traffic
# centre line, and, off the traffic graph, a 3 m lane to a row parked at the far curb. Sources: Vélo Québec's
# technical guide as the BAPE file DC2 quotes it (a 0.5 m separation where parking runs along a track,
# archives.bape.gouv.qc.ca/sections/mandats/boul_grande-allee_brossard_longueuil/documents/DC2.pdf) and the Ville de
# Montréal's 3 m tracks (ville.montreal.qc.ca/pls/portal/url/ITEM/AC8647C158AC702EE0430A930132702E).
TRACK_EDGE = 165.         # the drawn track's traffic-side edge line, from the track's centre line
TRACK_BOLLARDS = 45.      # the bollards stand this far past the edge line, toward the traffic
BUFFER_FACE = 245.        # the separator's face, from the track's centre line: 80 cm of buffer past the edge line,
BUFFER_BACK = 175.        # ...and its back, 4 cm short of the edge line's paint
PARK_TAGS = ('lane', 'street_side', 'on_street', 'half_on_kerb', 'yes', 'parallel', 'marked', 'on_kerb')
SIGN_REACH = 1500.        # plateau_parking.SIGN_REACH: a parking-sign pole this near a way serves its curb
SIGNED_POLES = 2          # plateau_parking.SIGNED_POLES
PARKED_W = 220.           # plateau_parking: a parked car over its mirrors...
PARKED_L = 466.
PARKED_GAP = 5.           # ...the least gap it keeps to its curb (CURB_GAP_MIN)...
PARKED_SWING = 3.3        # ...and the swing of its 0.8 degree yaw jitter
TRACK_LANE = 300.         # a street off the traffic graph keeps a 3 m lane between its parked rows
TRACK_BUS_ZONE = 1500.    # plateau_parking.BUS_ZONE: no car 15 m before a bus stop (5 m after it; here 15 m either way)
TRACK_BUS_REACH = 600.    # plateau_parking.BUS_REACH: a stop this near the separator's face serves its curb
SEPARATOR_MOUTH = {'alley': 315., 'default': 250.}   # plateau_parking.SERVICE_CLEAR: a lane or driveway mouth stays open
SEPARATOR_STEP = 25.      # the separator's cross-section is checked this often along it


def tagged_parking(t, side):
    """Whether a way's OSM tags park its side ('left' or 'right') in a parallel lane."""
    orientation = t.get(f'parking:{side}:orientation', t.get('parking:both:orientation', 'parallel'))
    for key in (f'parking:{side}', 'parking:both', f'parking:lane:{side}', 'parking:lane:both'):
        if key in t:
            return t[key] in PARK_TAGS and orientation == 'parallel'
    return False


def allow_poles(world):
    """How many of the city's on-street poles whose signs allow parking now stand by each way side: (way, +1 left
    or -1 right in the OSM sense) -> count. Each pole serves the nearest drive way within SIGN_REACH."""
    out = {}
    for pole in plateau_park_signs.load():
        if pole['off_street'] or not any(g['rule'] == 'allow' for g in pole['signs']):
            continue
        near = nearest_seg(world, pole['p'], SIGN_REACH)
        if near is None or near[0] >= SIGN_REACH:
            continue
        s = near[1]
        key = (s['way'], 1 if seg_local(s, pole['p'])[1] > 0 else -1)
        out[key] = out.get(key, 0) + 1
    return out


def bus_stops(world):
    """The bus stops plateau_parking keeps cars clear of: OSM's, and the city's STM sign poles more than 15 m from
    them."""
    if not hasattr(world, 'bus_stops'):
        stops = [world.nodes[n] for n, t in sorted(world.node_tags.items())
                 if t.get('highway') == 'bus_stop' and n in world.nodes and inside(world.latlon[n])]
        if SIGN_POLES.is_file():
            for pole in json.loads(SIGN_POLES.read_text())['poles']:
                if any(g.get('DESCRIPTION_CAT') == 'STM' for g in pole.get('signs', [])):
                    p = xy(float(pole['LATITUDE']), float(pole['LONGITUDE']))
                    if all(math.dist(p, q) > 1500 for q in stops):
                        stops.append(p)
        world.bus_stops = stops
    return world.bus_stops


def separator_spans(world, s, sign, lo, hi, lat, stops):
    """Where a separator may stand along a track: [lo, hi] less BIKE_CLEAR round each crosswalk and stop bar, and less
    every stretch where it would come within CLEAR of a traffic centre line or across a lane or driveway mouth."""
    if not hasattr(world, 'service_segments'):
        world.service_segments, world.service_grid = [], Grid(2000.)
        for w in world.ways:
            if w['tags'].get('highway') == 'service':
                clear = SEPARATOR_MOUTH.get(w['tags'].get('service'), SEPARATOR_MOUTH['default'])
                pts = [world.nodes[r] for r in w['refs'] if r in world.nodes]
                for a, b in zip(pts, pts[1:]):
                    world.service_grid.add(len(world.service_segments), bbox([a, b], 400.))
                    world.service_segments.append((a, b, clear))
    face, back = sign * (abs(lat) - BUFFER_FACE), sign * (abs(lat) - BUFFER_BACK)
    blocked = list(stops.get(s['i'], []))
    shut = []
    x = lo
    while x <= hi:
        cut = [seg_point(s, x, face), seg_point(s, x, back)]
        if world.traffic_distance(cut, 2000) < CLEAR + 1 or any(
                seg_seg_dist(cut[0], cut[1], a, b) < clear
                for a, b, clear in (world.service_segments[k] for k in world.service_grid.query(bbox(cut)))):
            shut.append(x)
        x += SEPARATOR_STEP
    spans = _free_spans(lo, hi, blocked, BIKE_CLEAR)
    for x in shut:
        spans = [part for a, b in spans for part in ((a, min(b, x - SEPARATOR_STEP)), (max(a, x + SEPARATOR_STEP), b))
                 if part[1] - part[0] > 1.]
    return spans


def track_buffer_fits(world, s, sign, lo, hi, face):
    """None when a car against a separator whose face lies `face` from the centre line fits, else why not: 'bus
    stop' when a stop's zone leaves no car space along it, 'traffic band' when a car comes within CLEAR of a traffic
    centre line, 'lane' when it leaves less than TRACK_LANE to a row parked at the far curb."""
    free = [(lo, hi)]
    for p in bus_stops(world):
        along, lat = seg_local(s, p)
        if lat * sign > 0 and abs(abs(lat) - face) <= TRACK_BUS_REACH:
            cut = (along - TRACK_BUS_ZONE - PARKED_L / 2, along + TRACK_BUS_ZONE + PARKED_L / 2)
            free = [part for a, b in free for part in ((a, min(b, cut[0])), (max(a, cut[1]), b)) if part[1] > part[0]]
    if all(b - a < PARKED_L + 60. for a, b in free):
        return 'bus stop'
    outer = face - PARKED_GAP - PARKED_W - PARKED_SWING
    for f in (.25, .5, .75):
        x = lo + (hi - lo) * f
        car = [seg_point(s, x - PARKED_L / 2, sign * outer), seg_point(s, x + PARKED_L / 2, sign * outer),
               seg_point(s, x + PARKED_L / 2, sign * (face - PARKED_GAP)),
               seg_point(s, x - PARKED_L / 2, sign * (face - PARKED_GAP))]
        if world.traffic_distance(car, 2000) < CLEAR + 1:
            return 'traffic band'
    far = s['curbR'] if sign > 0 else s['curbL']
    if outer + far - (PARKED_W + PARKED_GAP + PARKED_SWING) < TRACK_LANE + 1:
        return 'lane'
    return None


def _track_buffer(L, surfaces, s, sign, lo, hi, lat):
    """The concrete separator between a track and the cars parked beside it, from lo to hi along the segment."""
    face, back = sign * (abs(lat) - BUFFER_FACE), sign * (abs(lat) - BUFFER_BACK)
    poly = [seg_point(s, lo, face), seg_point(s, hi, face), seg_point(s, hi, back), seg_point(s, lo, back)]
    if area(poly) < 0:
        poly = poly[::-1]
    L.flat('sidewalk', poly, Z_WALK)
    for p, q in zip(poly, poly[1:] + poly[:1]):
        L.wall('sidewalk', p, q, 0., Z_WALK)
    surfaces.add(poly, Z_WALK, 'buffer')


def _bike_tracks(world, L, counts, stops):
    """On-street cycle tracks (Rachel, Brébeuf, Cherrier...): edge line, centre dashes, pictograms,
    green conflict zones at junction mouths and 1.16 m green flexible bollards (no collision). Where cars park
    beside the track (see TRACK_EDGE above), the bollards stand on a concrete separator, which stops BIKE_CLEAR
    short of each crosswalk and stop bar (stops: their positions along each segment) and leaves the lane and
    driveway mouths and the 300 cm traffic band open (separator_spans). world.track_sides records
    each way side a drawn track runs along: whether it parks, its separator pieces, or why it has none."""
    poles = allow_poles(world)
    world.track_sides = {}
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
            edge = lat - sign * TRACK_EDGE        # traffic-side edge of a 3 m track
            p0, p1 = seg_local(s, a)[0], seg_local(s, b)[0]
            lo, hi = sorted((p0, p1))
            lo, hi = max(lo, s['mouth_a'] + 300), min(hi, s['len'] - s['mouth_b'] - 300)
            side = 'left' if sign > 0 else 'right'
            row = world.track_sides.setdefault((s['way'], sign), {
                'way': s['way'], 'name': s['name'], 'side': 'L' if sign > 0 else 'R',
                'parking': 'tag' if tagged_parking(s['tags'], side) else
                'signs' if poles.get((s['way'], sign), 0) >= SIGNED_POLES else None,
                'allow_poles': poles.get((s['way'], sign), 0), 'track_m': 0., 'buffer_m': 0., 'pieces': [],
                'left_out': {}})
            buffered = []
            if hi - lo > 200:
                row['track_m'] += (hi - lo) / 100
                spans = [(lo, hi)] if row['parking'] is None else separator_spans(world, s, sign, lo, hi, lat, stops)
                if row['parking'] is not None and (hi - lo) - sum(x1 - x0 for x0, x1 in spans) > 1.:
                    row['left_out']['kept open'] = r2(row['left_out'].get('kept open', 0.) +
                                                      ((hi - lo) - sum(x1 - x0 for x0, x1 in spans)) / 100)
                for x0, x1 in spans:
                    why = 'no parking' if row['parking'] is None else 'short' if x1 - x0 < PARKED_L + 60. else \
                        track_buffer_fits(world, s, sign, x0, x1, abs(lat) - BUFFER_FACE)
                    if why is not None:
                        row['left_out'][why] = r2(row['left_out'].get(why, 0.) + (x1 - x0) / 100)
                        continue
                    buffered.append((x0, x1))
                    _track_buffer(L, world.surfaces, s, sign, x0, x1, lat)
                    row['buffer_m'] += (x1 - x0) / 100
                    face, back = lat - sign * BUFFER_FACE, lat - sign * BUFFER_BACK
                    row['pieces'].append({'face': [[r2(v) for v in seg_point(s, x, face)] for x in (x0, x1)],
                                          'back': [[r2(v) for v in seg_point(s, x, back)] for x in (x0, x1)]})
                    counts['track_buffer_metres'] += (x1 - x0) / 100
                    counts['track_buffers'] += 1
                L.strip('paint_white', seg_point(s, lo, edge), seg_point(s, hi, edge), 12, Z_PAINT)
                if t.get('oneway') != 'yes':
                    for x in _dashes(lo, hi, 300, 300):
                        L.strip('paint_yellow', seg_point(s, x[0], lat), seg_point(s, x[1], lat), 10, Z_PAINT)
                x = lo + 200
                while x < hi - 100:
                    c = seg_point(s, x, edge - sign * TRACK_BOLLARDS)
                    on = any(x0 + 10. <= x <= x1 - 10. for x0, x1 in buffered)
                    if not on and any(x0 - 10. < x < x1 + 10. for x0, x1 in buffered):
                        x += 400                  # a bollard at a separator's end would stand on its edge
                        continue
                    _bollard(L, c, Z_WALK if on else Z_ROAD)
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


# On-street cycling paint from the OSM cycleway tags of the drive ways. A bike lane (cycleway lane or opposite_lane,
# the contraflow "bande cyclable à contresens") runs between two white lines, by the parked cars or the gutter, with a
# diamond, a bike and an arrow repeated in it. A shared street (shared_lane, the City's "chaussée désignée") has a
# bike and two chevrons in the traffic lane. A bus lane shared with bikes (share_busway) has the reserved-lane white
# diamond in its curb lane. The first mark lies within 30 m after each junction, then one every BIKE_REPEAT. Sources:
# the Ville de Montréal bike presentation (diamonds, bikes and arrows between two white lines), the Réseau vélo
# métropolitain intersection guide (bike-and-chevron marks within the first 30 m after the intersection, repeated as
# needed), Vélo Québec's "Aménager pour les piétons et les cyclistes" (2020, 4.1.2, the bike-chevron marking) and
# quebec.ca "Marques sur la chaussée" (white bike, white diamond for reserved lanes; research-plateau.md 11.1).
BIKE_KINDS = {'lane': 'lane', 'opposite_lane': 'lane', 'shared_lane': 'shared', 'share_busway': 'busway',
              'opposite_share_busway': 'busway'}
PARKED_REACH = 260.       # a parked car's outer side lies this far from the drawn curb at most (plateau_parking:
                          # a 30 cm gap at the mirror, 220 cm over the mirrors, 6.5 cm of yaw jitter, and the curb
                          # top it measures a centimetre or two off the drawn line)
PAINT_CLEAR = 5.          # a line along the parked cars keeps this far outside them
BIKE_LINE_W = 12.         # a bike lane's two white lines
PARKING_W = PARKED_REACH + PAINT_CLEAR + BIKE_LINE_W / 2   # the parked cars' band along a curb with parking: a bike
                          # lane's inner line and a marked parking lane's line lie this far from the drawn curb
BIKE_LANE_W = 150.        # a painted bike lane, line centre to line centre
BIKE_GUTTER = 30.         # the lane's inner line off a curb with no parking, past the gutter pan
BIKE_END = 300.           # paint stops this far from a junction's mouth
BIKE_CLEAR = 330.         # and this far from a crosswalk's or stop bar's centre (as the centre lines do)
BIKE_FIRST = 1000.        # the first mark after a junction starts this far past its mouth...
BIKE_REPEAT = 5000.       # ...and the next ones follow this far apart
SHARROW_FROM_EDGE = 110.  # a shared-street mark's centre this far into the traffic lane from the parked cars or curb
BIKE_MARK_GAP = 120.      # between the diamond, the bike and the arrow of a lane mark
LANE_DIAMOND = (160., 50., 10.)   # length, width and stroke of a bike lane's diamond
BUS_DIAMOND = (300., 90., 15.)    # ...and of a reserved bus lane's
ARROW = (140., 45., 60., 12.)     # an arrow's length, head width, head length and shaft width
CHEVRON = (40., 90., 12., 25.)    # a chevron's depth, width, stroke and the gap between the two
BIKE_SYMBOL_LEN = 156.    # _bike_pictogram: wheels' foot to the bars, stretched twice, with the strokes


def bike_paint_sides(t):
    """The painted on-street cycling of a drive way per side (L, the OSM left, and R): (kind, travel) with kind lane,
    shared or busway (BIKE_KINDS) and travel 1 along the way or -1 against it, or None. A side's own tag wins over
    cycleway:both. A bare cycleway tag paints both sides of a two-way street, and on a one-way street the side right
    of the traffic, or its left for a contraflow (opposite_*) value. A one-way street's lane runs with the traffic
    unless it is a contraflow or its side's oneway says -1; on a two-way street the left side runs against the way."""
    oneway = t.get('oneway')
    motor = -1 if oneway == '-1' else 1
    one = oneway in ('yes', '1', 'true', '-1')
    plain = t.get('cycleway')
    out = {}
    for side, name in (('L', 'left'), ('R', 'right')):
        value = t.get('cycleway:' + name, t.get('cycleway:both'))
        if value is None and plain in BIKE_KINDS:
            right_of_traffic = 'R' if motor > 0 else 'L'
            if not one or (side == right_of_traffic) != plain.startswith('opposite'):
                value = plain
        if value not in BIKE_KINDS:
            out[side] = None
            continue
        way_dir = t.get(f'cycleway:{name}:oneway', t.get('cycleway:both:oneway', t.get('cycleway:oneway')))
        if way_dir == '-1':
            travel = -1
        elif way_dir in ('yes', '1', 'true'):
            travel = 1
        elif value.startswith('opposite'):
            travel = -motor
        elif one:
            travel = motor
        else:
            travel = 1 if side == 'R' else -1
        out[side] = (BIKE_KINDS[value], travel)
    return out


def _lanes(s):
    try:
        return max(1, int(float(s['tags'].get('lanes', '1').split(';')[0])))
    except ValueError:
        return 1


def bike_band(s, side, parking, bike):
    """How far in from a side's curb its parked cars and bike lane reach (cm): the lane-line and bus-lane layout
    starts there. A reserved bus lane runs along the curb, with no parked cars (plateau_parking.py reads it so)."""
    if bike.get(side) and bike[side][0] == 'busway':
        return 0.
    reach = PARKING_W if parking[side] else 0.
    if bike.get(side) and bike[side][0] == 'lane':
        reach = (reach if parking[side] else BIKE_GUTTER) + BIKE_LANE_W
    return reach


def parking_marked(t, side):
    """Whether OSM marks the parallel parking of a way's side (L the OSM left, or R) with paint: parking:<side>:markings
    or parking:both:markings is yes. In the district only Avenue Calixa-Lavallée, through the park, says so; the
    Plateau's other curbs have no parking line, and their cars stand on bare asphalt."""
    name = 'left' if side == 'L' else 'right'
    marked = any(t.get(k) == 'yes' for k in (f'parking:{name}:markings', 'parking:both:markings',
                                              f'parking:lane:{name}:markings', 'parking:lane:both:markings'))
    return marked and t.get(f'parking:{name}:orientation', t.get('parking:both:orientation', 'parallel')) == 'parallel'


def drawn_curb(world, s, side):
    """How far the drawn curb of a segment's side lies from its centre line, at its nearest (cm). The curb runs
    straight between its two end points, and a junction can set an end in from s['curb' + side]: where two ways of
    different widths meet in a near-straight line, the mitre meets their curbs half way. A line laid this far in from
    it, less its own offset, keeps at least that offset from the curb all along."""
    lats = [abs(seg_local(s, world.ends[(s['i'], end, side)][0])[1]) for end in ('a', 'b')
            if (s['i'], end, side) in world.ends]
    return min(lats + [s['curb' + side]])


def _free_spans(lo, hi, blocked, clear):
    """[lo, hi] less clear on either side of each blocked position."""
    spans = [(lo, hi)]
    for c in sorted(blocked):
        nxt = []
        for a, b in spans:
            if c + clear <= a or c - clear >= b:
                nxt.append((a, b))
                continue
            if c - clear - a > 1:
                nxt.append((a, c - clear))
            if b - c - clear > 1:
                nxt.append((c + clear, b))
        spans = nxt
    return spans


def _diamond(L, c, u, length, width, stroke, z):
    """A hollow white diamond (the reserved-lane mark) along u, as four mitred quads; returns a point on its paint."""
    n = (-u[1], u[0])
    a, b = length / 2, width / 2
    k = math.hypot(a, b)
    a2, b2 = a - stroke * k / b, b - stroke * k / a
    outer = [add(c, u, a), add(c, n, b), add(c, u, -a), add(c, n, -b)]
    inner = [add(c, u, a2), add(c, n, b2), add(c, u, -a2), add(c, n, -b2)]
    for i in range(4):
        j = (i + 1) % 4
        L.flat('paint_white', [outer[i], outer[j], inner[j], inner[i]], z)
    return add(c, u, (a + a2) / 2)


def _arrow(L, tail, u, z):
    """A straight white arrow from tail along u: a shaft and a triangular head."""
    length, head_w, head_l, shaft = ARROW
    n = (-u[1], u[0])
    base = add(tail, u, length - head_l)
    L.strip('paint_white', tail, add(base, u, 2.), shaft, z)
    L.flat('paint_white', [add(base, n, head_w / 2), add(base, n, -head_w / 2), add(tail, u, length)], z)


def _chevron(L, tip, u, z):
    """A white chevron pointing along u, its tip at tip."""
    depth, width, stroke, _ = CHEVRON
    n = (-u[1], u[0])
    for k in (1, -1):
        back = add(add(tip, u, -depth), n, k * width / 2)
        L.strip('paint_white', add(tip, u, stroke * .3), back, stroke, z)


def _bike_mark(L, kind, s, along, lat, travel):
    """One mark group from along (cm on the segment) in the travel direction; returns (length, mark record)."""
    u = s['u'] if travel > 0 else (-s['u'][0], -s['u'][1])
    start = seg_point(s, along, lat)
    z = Z_PAINT
    if kind == 'lane':
        d_len, d_w, d_stroke = LANE_DIAMOND
        _diamond(L, add(start, u, d_len / 2), u, d_len, d_w, d_stroke, z)
        bike = add(start, u, d_len + BIKE_MARK_GAP + BIKE_SYMBOL_LEN / 2)
        at = _bike_pictogram(L, bike, u, z)
        _arrow(L, add(bike, u, BIKE_SYMBOL_LEN / 2 + BIKE_MARK_GAP), u, z)
        length = d_len + 2 * BIKE_MARK_GAP + BIKE_SYMBOL_LEN + ARROW[0]
    elif kind == 'shared':
        bike = add(start, u, BIKE_SYMBOL_LEN / 2)
        at = _bike_pictogram(L, bike, u, z)
        depth, _, _, gap = CHEVRON
        tip = add(bike, u, BIKE_SYMBOL_LEN / 2 + 50 + depth)
        _chevron(L, tip, u, z)
        _chevron(L, add(tip, u, depth + gap), u, z)
        length = BIKE_SYMBOL_LEN + 50 + 2 * depth + gap
    else:
        d_len, d_w, d_stroke = BUS_DIAMOND
        at = _diamond(L, add(start, u, d_len / 2), u, d_len, d_w, d_stroke, z)
        length = d_len
    centre = add(start, u, length / 2)
    heading = math.degrees(math.atan2(u[1], u[0])) % 360.
    return length, {'centre': [r2(centre[0]), r2(centre[1])], 'heading_deg': r2(heading), 'at': [r2(at[0]), r2(at[1])]}


def _bike_lanes(world, L, counts, blocked):
    """Paint the on-street cycling of every drive way side its tags give (bike_paint_sides): lane lines and marks,
    shared-street marks and reserved bus lane diamonds. world.bike_paint keeps one record per way side."""
    degree = {node: len(arms) for node, arms in world.graph.items()}
    rows = []
    for way, run in world.drive_ways:
        sides = bike_paint_sides(way['tags'])
        if not any(sides.values()):
            continue
        for side in ('L', 'R'):
            if not sides[side]:
                continue
            kind, travel = sides[side]
            sign = 1 if side == 'L' else -1
            row = {'way': way['id'], 'name': way['tags'].get('name', ''), 'side': side,
                   'osm_side': 'left' if side == 'L' else 'right', 'kind': kind, 'travel': travel,
                   'segments': [], 'line_m': 0., 'marks': [], 'too_narrow': 0}
            chains, cur = [], []
            for s in run:
                if s['excluded'] or not s['quad'] or (cur and cur[-1]['b'] != s['a']):
                    if cur:
                        chains.append(cur)
                    cur = []
                if not s['excluded'] and s['quad']:
                    cur.append(s)
            if cur:
                chains.append(cur)
            for chain in chains:
                if travel < 0:
                    chain = chain[::-1]
                carry = None          # the next mark's place, cm past the current segment's entry end
                for s in chain:
                    entry, leave = ('a', 'b') if travel > 0 else ('b', 'a')
                    parking = _parking_sides(s)
                    bike = bike_paint_sides(s['tags'])
                    other = 'R' if side == 'L' else 'L'
                    curb = drawn_curb(world, s, side)        # the parked cars stand against the drawn curb
                    width = curb + drawn_curb(world, s, other)
                    if kind == 'lane':
                        inner = curb - (PARKING_W if parking[side] else BIKE_GUTTER)
                        outer = inner - BIKE_LANE_W
                        mark_lat = sign * (inner - BIKE_LANE_W / 2)
                        room = width - (curb - outer) - bike_band(s, other, parking, bike)
                    elif kind == 'shared':
                        mark_lat = sign * (curb - (PARKING_W if parking[side] else 0.) - SHARROW_FROM_EDGE)
                        # the traffic lane the mark lies in: between this side's parked cars and the other side's
                        room = width - (PARKING_W if parking[side] else 0.) - bike_band(s, other, parking, bike)
                    else:
                        lanes = _lanes(s) if s['oneway'] else max(1, _lanes(s) // 2)
                        near = curb - bike_band(s, side, parking, bike)
                        far = (-(width - curb - bike_band(s, other, parking, bike))) if s['oneway'] else 0.
                        lane_w = (near - far) / lanes
                        mark_lat = sign * (near - lane_w / 2)
                        room = lane_w
                    if room < 300.:
                        row['too_narrow'] += 1
                        carry = None
                        continue
                    junction_in, junction_out = degree.get(s[entry], 0) >= 3, degree.get(s[leave], 0) >= 3
                    m_in, m_out = s['mouth_' + entry], s['mouth_' + leave]
                    stops = blocked.get(s['i'], [])
                    # in travel coordinates: cm from the segment's entry end
                    to_along = (lambda x: x) if travel > 0 else (lambda x, n=s['len']: n - x)
                    stops_t = [to_along(c) for c in stops]
                    lo = m_in + (BIKE_END if junction_in else 0.)
                    hi = s['len'] - m_out - (BIKE_END if junction_out else 0.)
                    if kind == 'lane':
                        row['segments'].append([s['i'], r2(sign * inner), r2(sign * outer)])
                        for a, b in _free_spans(lo, hi, stops_t, BIKE_CLEAR):
                            if b - a < 50:
                                continue
                            for lat in (inner, outer):
                                L.strip('paint_white', seg_point(s, to_along(a), sign * lat),
                                        seg_point(s, to_along(b), sign * lat), BIKE_LINE_W, Z_PAINT)
                            row['line_m'] += 2 * (b - a) / 100
                    else:
                        row['segments'].append([s['i'], r2(mark_lat)])
                    # marks: after a junction the first one BIKE_FIRST past its mouth, else carried on
                    glen = {'lane': LANE_DIAMOND[0] + 2 * BIKE_MARK_GAP + BIKE_SYMBOL_LEN + ARROW[0],
                            'shared': BIKE_SYMBOL_LEN + 50 + 2 * CHEVRON[0] + CHEVRON[3],
                            'busway': BUS_DIAMOND[0]}[kind]
                    x = m_in + BIKE_FIRST if junction_in or carry is None else carry
                    lo_m = lo + (0. if junction_in else 50.)
                    hi_m = hi - (0. if junction_out else 50.)
                    while True:
                        x = max(x, lo_m)
                        if x + glen > hi_m:
                            break
                        if any(x - BIKE_CLEAR < c < x + glen + BIKE_CLEAR for c in stops_t):
                            x += 100.
                            continue
                        along = to_along(x)
                        _, mark = _bike_mark(L, kind, s, along, mark_lat, travel)
                        row['marks'].append(mark)
                        x += BIKE_REPEAT
                    carry = x - s['len']
            if not row['segments']:
                continue
            row['line_m'] = r2(row['line_m'])
            if kind == 'lane':
                counts['bike_lane_line_metres'] += row['line_m']
                counts['bike_lane_marks'] += len(row['marks'])
            else:
                counts['sharrows' if kind == 'shared' else 'bus_diamonds'] += len(row['marks'])
            counts['bike_paint_sides'] += 1
            counts['bike_paint_too_narrow'] += row['too_narrow']
            rows.append(row)
    world.bike_paint = rows


def _bollard(L, c, z=Z_ROAD):
    L.rod('bollard_green', (c[0], c[1], z), (c[0], c[1], z + 116), 6, 6, caps=False)
    L.cone('bollard_green', (c[0], c[1], z + 116), 6, 3, 6)
    L.rod('paint_white', (c[0], c[1], z + 92), (c[0], c[1], z + 104), 6.3, 6)


# The white bicycle, drawn upright for the rider who comes up to it: a side view with the wheels side by side across
# the lane and the top ahead, stretched twice along the travel to read at a low angle and narrowed to fit between a
# bike lane's lines (about 1.2 m wide). Points are (x right, y up) in cm before the stretch; BIKE_SYMBOL_LEN is its
# length along the travel.
BIKE_WHEEL = 26.
BIKE_FRAME = (((-38., -38.), (-4., -38.)), ((-4., -38.), (-16., -2.)), ((-38., -38.), (-16., -2.)),
              ((-16., -2.), (26., -2.)), ((-4., -38.), (26., -2.)), ((26., -2.), (38., -38.)),
              ((-16., -2.), (-18., 5.)), ((-27., 5.), (-9., 5.)), ((26., -2.), (28., 7.)), ((22., 9.), (36., 7.)))
BIKE_STRETCH, BIKE_NARROW = 2., .88
BIKE_STROKE = 10.


def _bike_pictogram(L, c, u, z):
    """White bicycle symbol centred on c, upright for a rider travelling along u; returns a point on its paint."""
    right = (u[1], -u[0])
    mid = (-38. - BIKE_WHEEL + 9.) / 2        # the symbol's middle height, between the wheels' foot and the bars

    def at(x, y):
        return add(add(c, u, (y - mid) * BIKE_STRETCH), right, x * BIKE_NARROW)

    for cx in (-38., 38.):
        ring = [at(cx + BIKE_WHEEL * math.cos(i * math.tau / 14), -38. + BIKE_WHEEL * math.sin(i * math.tau / 14))
                for i in range(14)]
        for p, q in zip(ring, ring[1:] + ring[:1]):
            L.strip('paint_white', p, q, BIKE_STROKE, z + .02)
    for a, b in BIKE_FRAME:
        L.strip('paint_white', at(*a), at(*b), BIKE_STROKE, z + .02)
    return at(11., -20.)                    # the middle of the down tube


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
    lane and side fences, sheds and the ground on lots with no yard), the sidewalks and the carriageways; with `lots`
    (the ruelle paving out to the lot lines), also the Plex rear buildings and the parks."""

    def __init__(self, world, plex, alleys=False, yards=False, lots=False):
        self.segs, self.kinds, self.grid = [], [], Grid(1000.)

        def line(points, closed=False, kind='plex'):
            points = [tuple(q[:2]) for q in points]
            for a, b in zip(points, points[1:] + (points[:1] if closed else [])):
                if math.dist(a, b) > .5:
                    self.grid.add(len(self.segs), bbox([a, b]))
                    self.segs.append((a, b))
                    self.kinds.append(kind)
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
        for fp, _, _ in (plex.footprints if plex and lots else []):
            ground(fp)
        # ...and a sample on a sidewalk or a carriageway (a ruelle's mouth) or in a park keeps the fence-line reach,
        # so the paving never runs along a sidewalk band or onto a park lawn
        self.zones, self.zone_grid = [], Grid(1000.)

        def zone(poly):
            line(poly, True, 'zone')
            self.zone_grid.add(len(self.zones), bbox(poly))
            self.zones.append(poly)
        self.fronts, self.front_grid = [], Grid(2000.)
        for strip in world.sidewalk_strips:
            zone([strip['curb'][0], strip['curb'][1], strip['outer'][1], strip['outer'][0]])
            self.front_grid.add(len(self.fronts), bbox(strip['outer'], FRONT_MAX))
            self.fronts.append(strip['outer'])
        for w in (world.ways if lots else []):
            if w['tags'].get('leisure') == 'park' and len(w['refs']) > 3 and w['refs'][0] == w['refs'][-1]:
                zone([world.nodes[r] for r in w['refs'][:-1] if r in world.nodes])
        for poly, _, kind in world.surfaces.items:
            if kind == 'road':
                zone(list(poly))
            elif kind == 'alley' and alleys or kind == 'yard' and yards:
                line(poly, True, kind)

    def inside(self, p):
        return any(point_in(p, self.zones[i]) for i in self.zone_grid.query((p[0], p[1], p[0], p[1])))

    def behind_front(self, p):
        """Whether p lies behind the street-front yards: no sidewalk's outer edge within FRONT_MAX (the parterres
        reach that far back to a building line, and the lane paving leaves them that band)."""
        return all(seg_dist(p, *self.fronts[i]) >= FRONT_MAX for i in self.front_grid.query((p[0], p[1], p[0], p[1])))

    def on_plex(self, p):
        """Whether p lies in a Plex yard, shed or ground cell."""
        return any(point_in(p, self.grounds[i]) for i in self.ground_grid.query((p[0], p[1], p[0], p[1])))

    def ray(self, origin, direction, limit):
        return self.first(origin, direction, limit)[0]

    def first(self, origin, direction, limit):
        """(distance, kind) of the first line a ray meets within limit: kind 'plex' (a Plex yard, fence, shed,
        ground or rear building), 'zone' (a sidewalk, carriageway or park edge) or a surface kind; (None, None)."""
        end = add(origin, direction, limit)
        best = (None, None)
        for i in self.grid.query(bbox([origin, end])):
            t = ray_seg(origin, direction, *self.segs[i])
            if t is not None and t <= limit and (best[0] is None or (t, self.kinds[i]) < best):
                best = (t, self.kinds[i])
        return best


def _alley_profile(world, pa, pb, stops=None):
    """Paving reach either side of a ruelle segment, sampled every metre: the yard fence line (ALLEY_PAVE) or the
    nearest wall, never inside the 430 cm lane strip; past the fence line, out to a wall within WALL_PAVE where no
    Plex yard, fence, shed or ground, sidewalk, carriageway or park lies before it (a building's side or rear wall on
    the lane, a garage); and behind the street-front yards (behind_front), out to the first Plex lot line, fence,
    shed, ground or wall within LOT_PAVE, so a lot set back from the lane (a car park, the open ground beside a
    block) is paved to its line, not left bare. Where the
    reach jumps between two samples (a wall begins or ends), two more samples bracket the jump to 1 cm. Returns the
    sample distances and reaches {1: left, -1: right} (left of pa->pb)."""
    u, length = unit(pa, pb)
    n = (-u[1], u[0])

    def back_lot(c, d, reach):
        """Whether paving from the fence line out to reach stays behind the street-front yards."""
        return all(stops.behind_front(add(c, d, x)) for x in (ALLEY_PAVE, (ALLEY_PAVE + reach) / 2, reach))

    def sample(t):
        c = add(pa, u, t)
        if world.in_building(c):
            return True, ALLEY_HALF, ALLEY_HALF
        out = []
        for k in (1, -1):
            d = (n[0] * k, n[1] * k)
            hit = world.building_ray(c, d, LOT_PAVE)
            if hit is not None and hit <= ALLEY_PAVE:
                out.append(max(ALLEY_HALF, hit))
            elif stops is not None and not stops.inside(c):
                stop, kind = stops.first(c, d, LOT_PAVE)
                if hit is not None and (stop is None or hit <= stop) and hit <= WALL_PAVE:
                    out.append(hit)                             # a wall first: paved to its foot
                elif hit is not None and (stop is None or hit <= stop) and back_lot(c, d, hit):
                    out.append(hit)
                elif kind == 'plex' and stop > ALLEY_PAVE + WALL_SNAP and (hit is None or stop < hit) and \
                        back_lot(c, d, stop):
                    out.append(stop)                            # a lot set back from the lane: to its line
                else:
                    out.append(ALLEY_PAVE)                      # the fence line
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
GUTTER_DEPTH = .5          # ...sunk in a shallow V below the asphalt either side. The old OSM road (BaseGeometry
                           # Road.obj, z 6.0) stays in the map under the ruelles, so the V's bottom (6.3) and the
                           # leaves in it keep 3 mm over it; the texture, not the depth, makes the gutter dark.


def gutter_z(lateral):
    """Height of the gutter's V at `lateral` cm from the ruelle's centre line (the asphalt's height at its edges)."""
    return Z_ALLEY - GUTTER_DEPTH * max(0., 1. - abs(lateral) / GUTTER_HALF)


def _gutter(L, pa, u, n, t0, t1):
    """One piece of the ruelle's centre gutter from t0 to t1 cm along pa + u t: two faces sloping GUTTER_DEPTH down to
    the centre line, on the aged lane concrete with their own UVs (u metres along the ruelle, v metres across it with the
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
    world.alley_pieces = []       # (paving polygon, its segment): the Soul's gutter leaves lie only under their own
    box = world.box
    world.plex = PlexYards.load(world)
    stops = PaveStops(world, world.plex, lots=True)
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
                    world.alley_pieces.append((poly, (pa, pb)))
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
                        world.alley_pieces.append((wedge, None))
                        counts['ruelle_joint_wedges'] += 1
        # free ends keep the old round cap of the lane strip, as a half disc past the end so the gutter shows
        for k, (pa, pb) in enumerate(segs):
            u, _ = unit(pa, pb)
            n = (-u[1], u[0])
            for cap, free, turn in ((pa, k == 0 or (k - 1) not in joints, 1.), (pb, k not in joints, -1.)):
                if free:
                    disc = [add(cap, (n[0] * math.cos(turn * math.pi * i / 6) - n[1] * math.sin(turn * math.pi * i / 6),
                                      n[0] * math.sin(turn * math.pi * i / 6) + n[1] * math.cos(turn * math.pi * i / 6)),
                                ALLEY_HALF) for i in range(7)]
                    L.flat('alley', disc, Z_ALLEY - .05)
                    world.alley_pieces.append((disc, None))   # over another ruelle's gutter, no leaves under it
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
# it follows the arc piece nearest the trunk. Any other trunk the carriageway covers is re-seated from the
# inventory's own side, place and distance, or left out and listed for the host (see CARDINAL below).
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
# species or genus takes a kind by crown size from the trunk (DHP). Spruces, pines, firs, cedars, hemlocks and yews
# take the conical conifer; larches take the same form with gold needles.
TREE_KINDS = ('norway_maple', 'silver_maple', 'honey_locust', 'linden', 'ash', 'small', 'elm', 'conifer', 'larch')
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
               'Cladrastis': 'small',
               'Picea': 'conifer', 'Pinus': 'conifer', 'Abies': 'conifer', 'Thuja': 'conifer', 'Tsuga': 'conifer',
               'Taxus': 'conifer', 'Juniperus': 'conifer', 'Pseudotsuga': 'conifer', 'Chamaecyparis': 'conifer',
               'Larix': 'larch', 'Metasequoia': 'larch', 'Taxodium': 'larch'}
# Late-October colour per tree, the "fall" of each street_trees.json row: the apply step and the preview tint each
# (kind, fall) group's leaves. A species row (a prefix of the Latin name) wins; else the kind's own (needles) or
# yellow, the common Plateau note (silver and Norway maples, ash, honey locust, linden, elm, hackberry, ginkgo).
# Red maples, sugar maples, Freeman maples, Amur and Tatarian maples and serviceberries turn scarlet to orange-red;
# red, pin and white oaks a russet to wine red. Sources: the Morton Arboretum tree pages (northern red oak
# "russet-red to bright red", white oak "wine-red"), University of Illinois Extension on oaks in fall (pin oak red),
# and the Jardin botanique de Montréal (Espace pour la vie) on trees and shrubs for fall colour. A kind with its own
# fall (KIND_FALL) keeps it, or wears one of its KIND_TINTS: dawn redwoods and bald cypresses stand on the larch and
# wear its gold. The Colorado blue spruce (Picea pungens, its glaucous cultivars and the inventory's misspelt "Picea
# punges") is the conifer's one tint: blue grey, as the Rachel spruce inv:5-263258 reads.
TREE_FALLS = ('yellow', 'red', 'russet', 'gold', 'evergreen', 'blue')
TREE_FALL = (('acer rubrum', 'red'), ('acer saccharum', 'red'), ('acer x freemanii', 'red'), ('acer ginnala', 'red'),
             ('acer tataricum', 'red'), ('amelanchier', 'red'), ('quercus rubra', 'russet'),
             ('quercus palustris', 'russet'), ('quercus alba', 'russet'), ('picea pungens', 'blue'),
             ('picea punges', 'blue'))
KIND_FALL = {'conifer': 'evergreen', 'larch': 'gold'}
KIND_TINTS = {'conifer': ('blue',), 'larch': ()}   # the other falls a kind of its own fall may wear
BROADLEAF_TINTS = ('red', 'russet')                # ...and those a broadleaf kind may wear besides its yellow
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


def tree_fall(species, kind):
    """The late-October colour of a tree (one of TREE_FALLS) from its Latin name and its kind (see TREE_FALL). A
    species row the kind cannot wear (KIND_TINTS, BROADLEAF_TINTS) gives the kind's own fall."""
    low = ' '.join((species or '').strip().lower().split())
    own = KIND_FALL.get(kind, 'yellow')
    for prefix, fall in TREE_FALL:
        if low == prefix or low.startswith(prefix + ' '):
            return fall if fall in KIND_TINTS.get(kind, BROADLEAF_TINTS) else own
    return own


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


# -- the city's sign poles ------------------------------------------------------------------------------------------
# The Ville de Montréal's sign-pole inventory (Poteaux de signalisation: one row per pole and its kind) and its sign
# inventory (Signalisation routière: one row per sign and the pole it hangs on), clipped to the district box by
# --clip-sign-poles into one file: every pole with the signs it carries now. A wooden pole ("Poteau en bois") is a
# utility pole, and on a street it carries a cobra-head light (research-plateau.md §12: residential and lane lighting
# is often on wooden utility poles). A steel pole ("Fût") is a street-light standard. OSM maps 42 cobra heads, none on
# Mentana, Fabre, Napoléon or Saint-André; the poles light the residential streets. The junction's street-name blades,
# its ARRÊT and its one-way signs hang on the city pole that carries them, where that pole is one the game draws.
SIGN_POLES = INVENTORY / 'sign_poles.json'
SIGN_POLE_SOURCE = {
    'poles': {'dataset': 'Ville de Montréal, Poteaux de signalisation',
              'url': 'https://donnees.montreal.ca/dataset/poteaux-signalisation',
              'resource': '091a3d3a-716c-44d7-b1c0-3144d6953f66'},
    'signs': {'dataset': 'Ville de Montréal, Signalisation routière (excluant le stationnement)',
              'url': 'https://donnees.montreal.ca/dataset/panneaux-de-signalisation',
              'resource': '1f610cd7-c85d-46d8-9c98-86e3f550ee4c'},
    'licence': 'CC BY 4.0', 'attribution': 'Source: Ville de Montréal, données ouvertes (CC BY 4.0)'}
SIGN_FIELDS = ('CODE_RPA', 'DESCRIPTION_RPA', 'TOPONYME_PAN', 'FLECHE_PAN', 'POSITION_POP', 'DESCRIPTION_CAT')
POLE_KINDS = {'4- Poteau en bois': 'wood', '3- Fût': 'steel'}   # the kinds the game draws (others: posts, signals)
POLE_STREET_REACH = 600.    # a city pole stands on a street: this near the curb of a drive segment, or nearer
POLE_LANE_KEEP = 400.       # and not in a ruelle (this near its centre line), where the seeded lane poles stand
CITY_LAMP_SAME = 600.       # an OSM lamp this near a city pole is the light that pole carries
CITY_POLE_SAME = 300.       # two city steel poles this near are one light
POLE_PIT_KEEP = 20.         # a pole keeps this far from a tree pit's soil (it slides along the curb past the pit)
POLE_TRUNK_KEEP = 60.       # and from a trunk outside a pit
SIGN_MOUNT_REACH = 600.     # an ARRÊT or one-way sign hangs on a city pole that carries one this near its post
NAME_MOUNT_REACH = 2000.    # street-name blades hang on a city pole naming a street of the junction this near it
MOUNT_OFF = 22.             # a hung sign's pivot stands this far off the pole's axis, so no plate cuts the pole
MOUNT_RAISE = {'sign_street': 100., 'sign_oneway': 55., 'sign_stop': 0., 'sign_parking': -50.}   # stacked: blades,
                                                        # one-way plate, ARRÊT, the parking plate under them
PARKING_SIGN_BEHIND = (35., 90.)   # a parking-sign post stands this far behind the curb (its pole's own place, clamped)


def clip_sign_poles(poles_path, signs_path):
    """Write Data/Plateau/Inventory/sign_poles.json from datastore extracts (JSON lists of records) of the city's
    sign-pole inventory and its sign inventory: every pole inside the district box (prepare_lafontaine.BOUNDS), sorted
    by pole id, all its fields but the datastore's row id and search ranking, and the signs it carries now
    (DESCRIPTION_REP 'Réel') with their code, text, street name, arrow, place on the pole and category."""
    raws = [Path(poles_path).read_bytes(), Path(signs_path).read_bytes()]
    hashes = {Path(path).name: hashlib.sha256(raw).hexdigest() for path, raw in zip((poles_path, signs_path), raws)}
    poles = {}
    for r in json.loads(raws[0]):
        lat, lon = _number(r.get('LATITUDE')), _number(r.get('LONGITUDE'))
        if lat is None or lon is None or not inside((lat, lon)):
            continue
        poles[str(r['POTEAU_ID_POT'])] = dict({k: v for k, v in r.items() if k != '_id' and not k.startswith('rank ')},
                                              signs=[])
    for r in json.loads(raws[1]):
        pole = poles.get(str(r.get('POTEAU_ID_POT')))
        if pole is not None and r.get('DESCRIPTION_REP') == 'Réel':
            pole['signs'].append({k: r.get(k) for k in SIGN_FIELDS})
    records = sorted(poles.values(), key=lambda r: int(r['POTEAU_ID_POT']))
    for r in records:
        r['signs'].sort(key=lambda g: (int(_number(g['POSITION_POP']) or 0), g['CODE_RPA'] or '', g['TOPONYME_PAN'] or ''))
    head = {'source': dict(SIGN_POLE_SOURCE, extract_sha256=hashes), 'box_lat_lon': list(BOUNDS),
            'frame': 'WGS84 latitude and longitude (LATITUDE, LONGITUDE)', 'count': len(records),
            'signs': sum(len(r['signs']) for r in records)}
    INVENTORY.mkdir(parents=True, exist_ok=True)
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "poles": [\n' + \
        ',\n'.join('  ' + json.dumps(r, ensure_ascii=False, sort_keys=True) for r in records) + '\n ]\n}\n'
    SIGN_POLES.write_text(text)
    return len(records), head['signs']


def load_sign_poles(path=None):
    """The committed sign-pole clip: one dict per pole inside the box with a kind the game draws (POLE_KINDS): id,
    kind ('wood' or 'steel'), p (xy), off_street (PAS_SUR_RUE), codes (the codes of its signs) and names (the
    street_key of each street-name sign's street). Empty when the clip is absent."""
    path = Path(path or SIGN_POLES)
    if not path.is_file():
        return []
    out = []
    for r in json.loads(path.read_text())['poles']:
        lat, lon = _number(r.get('LATITUDE')), _number(r.get('LONGITUDE'))
        kind = POLE_KINDS.get(r.get('DESCRIPTION_RTP'))
        if kind is None or lat is None or lon is None or not inside((lat, lon)):
            continue
        signs = r.get('signs', [])
        out.append({'id': str(r['POTEAU_ID_POT']), 'kind': kind, 'p': xy(lat, lon), 'off_street': r.get('PAS_SUR_RUE') == '1',
                    'codes': sorted({g['CODE_RPA'] for g in signs if g.get('CODE_RPA')}),
                    'names': sorted({street_key(g['TOPONYME_PAN']) for g in signs
                                     if g.get('CODE_RPA') == 'NR-U' and g.get('TOPONYME_PAN')})})
    return out


def names_street(key, name):
    """Whether a street-name sign's street (its street_key, 'mentana') names an OSM street ('Rue de Mentana')."""
    full = street_key(name)
    return bool(key) and (full == key or full.endswith(' ' + key) or f' {key} ' in f' {full} ')


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
                     'side': r.get('Rue_cote'), 'inv_type': r.get('INV_TYPE')})
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
                     'street': '', 'pave_cm': None, 'side': None, 'inv_type': None})
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


def _fit_pit(world, frame, s0, d, obstacles, laid=False, slide=PIT_SLIDE_MAX):
    """The along-curb place nearest s0 (10 cm steps, up to `slide`) where a pit centred d behind the curb lies on its
    strip, off every other carriageway and building, on raised sidewalk pieces, clear of the crossing ramps, the OSM
    street furniture and the strip's other pits; None if there is none. With `laid`, the sidewalk is down and the
    pit's corners must stand on it at the curb height."""
    length = frame['len']
    ramps = frame['strip'].get('ramps', [])
    seg = frame['strip']['seg']['i']
    steps = int(slide // 10)
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
        if laid and not all(world.surfaces.floor(c) >= Z_WALK - .01 and world.surfaces.has(c, 'sidewalk')
                            for c in _pit_rect(frame, s, d, PIT_L / 2 + 2., PIT_D / 2 + 2.)):
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


# Trees the inventory puts where the replica has carriageway or parking asphalt (the curb pushed out for curb
# parking, or a position a few metres off) are re-seated from the inventory's own fields: the side of the street
# (Rue_cote: N, S, E or O on Montréal's street grid, which is turned about 34 degrees from true north, so the side
# is the curb whose outward normal leans to that compass point), the place (Emplacement) and the distance from the
# pavement edge (Distance_pave). A sidewalk tree goes to a pit 65 to 80 cm behind the curb of its own side, sliding
# up to RESEAT_SLIDE along it; a parterre tree to the lawn Distance_pave behind the curb of its side (behind the
# sidewalk); a median tree (Terre-plein) onto a curb extension of the mapped median of its street, or onto that
# median's ground. A tree with no such seat is dropped and listed for the host (host_review). So no trunk stands on
# carriageway or parking asphalt outside a curb extension.
CARDINAL = {'N': (0., 1.), 'S': (0., -1.), 'E': (1., 0.), 'O': (-1., 0.)}
SIDE_DOT = .1             # a curb side is the compass side when its outward normal leans at least this far to it
RESEAT_SLIDE = 1200.      # a re-seated sidewalk tree's pit slides at most this far along its own curb
RESEAT_REACH = 2000.      # ...on a sidewalk of its own street and side this near the trunk
PARTERRES = ('PaRterre', 'Parterre Gazonné', 'Parterre aSphalté', 'Parterre aMénagé', 'Parterre avec Pavé uni')
PARTERRE_BACK = 50.       # a re-seated parterre trunk stands at least this far behind its sidewalk
PARTERRE_DEFAULT = 150.   # ...or this far, when the inventory gives no distance from the pavement
PARTERRE_WALL = 60.       # ...and this far from any building
MEDIAN_REACH = 1000.      # a median tree moves at most this far to the middle of its street's mapped median
MEDIAN_GROUND = 120.      # a median holds a trunk on its own ground when it is this wide between the curbs
MEDIAN_PARALLEL = .97     # a median's two carriageways run within about 14 degrees of each other
MEDIAN_SPAN = 3000.       # ...with their centre lines at most 30 m apart


def street_key(name):
    """A street name for matching: no accents, case or extra spaces (the inventory's 'Rue de Champlain' is OSM's
    'Rue De Champlain')."""
    text = unicodedata.normalize('NFKD', name or '')
    return ' '.join(''.join(c for c in text if not unicodedata.combining(c)).casefold().split())


def side_faces(normal, card):
    """Whether a curb whose outward normal is `normal` can be the inventory's compass side `card`: it leans to it,
    or the street runs toward the compass point and either side might be meant."""
    return normal[0] * card[0] + normal[1] * card[1] > -SIDE_DOT


def _pit_back(t, width):
    """How far behind the curb a tree's pit centre stands: the inventory's distance from the pavement within
    PIT_BACK (seeded in it when the inventory gives none), at the back of the walk for a Fond de Trottoir tree."""
    if t['placement'] in BACK_OF_WALK:
        return max(PIT_BACK[0], width - PIT_D / 2 - 15.)
    return min(PIT_BACK[1], max(PIT_BACK[0], t['pave_cm'] if t['pave_cm'] is not None else
                                PIT_BACK[0] + (PIT_BACK[1] - PIT_BACK[0]) * Rng('pit-back', t['id']).random()))


def _strip_place(frame, p):
    """(along, across, width there, gap) of p in a strip frame; gap is how far p lies off the strip across it."""
    rel = (p[0] - frame['a'][0], p[1] - frame['a'][1])
    s, d = rel[0] * frame['u'][0] + rel[1] * frame['u'][1], rel[0] * frame['n'][0] + rel[1] * frame['n'][1]
    width = frame['wa'] + (frame['wb'] - frame['wa']) * max(0., min(1., s / frame['len']))
    return s, d, width, (-d if d < 0 else d - width if d > width else 0.)


def reseat_pit(world, frames, grid, t, obstacles):
    """A pit for a tree off the carriageway: on a sidewalk of its own street on its inventory side within
    RESEAT_REACH, the nearest strip first, sliding up to RESEAT_SLIDE along the curb. (frame index, along, across)
    or None."""
    key, p = street_key(t['street']), t['p']
    found = []
    for i in grid.query(bbox([p], RESEAT_REACH)):
        f = frames[i]
        if street_key(f['strip']['seg']['name']) != key or not side_faces(f['n'], t['card']):
            continue
        gap = 0. if point_in(p, f['poly']) else poly_point_dist(f['poly'], p)
        if gap <= RESEAT_REACH:
            found.append((gap, i))
    for _, i in sorted(found):
        f = frames[i]
        s0, _, width, _ = _strip_place(f, p)
        lat = _pit_back(t, width)
        s = _fit_pit(world, f, max(PIT_L / 2 + PIT_EDGE, min(f['len'] - PIT_L / 2 - PIT_EDGE, s0)), lat, obstacles,
                     slide=RESEAT_SLIDE)
        if s is not None:
            return i, s, lat
    return None


def curb_sides(world, p, street, card):
    """The curbs of a street on the inventory's compass side at p's place along it: (segment, sign of the side
    (1 left, -1 right), along, curb offset, sidewalk width), the outermost first (on a street of two carriageways,
    the outer side of the far one), then the nearest."""
    key = street_key(street)
    out = []
    for i in world.seg_grid.query(bbox([p], RESEAT_REACH)):
        s = world.segs[i]
        if s['excluded'] or not s['quad'] or street_key(s['name']) != key:
            continue
        along, lat = seg_local(s, p)
        if not -100. <= along <= s['len'] + 100. or abs(lat) > RESEAT_REACH:
            continue
        along = min(s['len'], max(0., along))
        for side, sign in (('L', 1.), ('R', -1.)):
            o = (s['n'][0] * sign, s['n'][1] * sign)
            if o[0] * card[0] + o[1] * card[1] < SIDE_DOT and not (side_faces(o, card) and lat * sign > 0):
                continue                      # the other side, or an unclear side the trunk is not on
            c = seg_point(s, along, sign * s['curb' + side])
            out.append((-(c[0] * card[0] + c[1] * card[1]), abs(lat - sign * s['curb' + side]), s['i'], sign, along,
                        s['curb' + side], s['w' + side]))
    out.sort()
    return [(world.segs[i], sign, along, curb, width) for _, _, i, sign, along, curb, width in out]


def parterre_spot(world, frames, grid, t):
    """The lawn place of a parterre tree off the carriageway: Distance_pave behind the outermost curb of its street
    on its inventory side, at least PARTERRE_BACK behind the sidewalk, on open ground (no carriageway, ruelle,
    sidewalk or building within PARTERRE_WALL) clear of the traffic band; None if there is none."""
    sides = curb_sides(world, t['p'], t['street'], t['card'])
    if not sides:
        return None
    s, sign, along, curb, width = sides[0]
    back = width + PARTERRE_DEFAULT if t['pave_cm'] is None else max(t['pave_cm'], width + PARTERRE_BACK)
    q = seg_point(s, along, sign * (curb + back))
    if world.in_building(q, PARTERRE_WALL) or world.surfaces.has(q, 'road') or world.surfaces.has(q, 'alley') or \
            on_pavement(world, q) or world.traffic_distance(q) < CLEAR or \
            any(point_in(q, frames[i]['poly']) for i in grid.query(bbox([q]))):
        return None
    return q


def mapped_median(world, p, street, reach=MEDIAN_REACH):
    """The mapped median of a street nearest p: two near-parallel carriageways of that name (OSM ways), their
    facing sides without sidewalks, centre lines at most MEDIAN_SPAN apart. {'at': the middle of the ground between
    their curbs at p's place, 'width': that ground's width (under 0 where the carriageways, pushed out for curb
    parking, overlap it), 'segs'}; None when there is none within reach of p."""
    key = street_key(street)
    same = [world.segs[i] for i in world.seg_grid.query(bbox([p], reach + MEDIAN_SPAN))]
    same = sorted((s for s in same if not s['excluded'] and s['quad'] and street_key(s['name']) == key),
                  key=lambda s: s['i'])
    best = None
    for a in same:
        ta, _ = seg_local(a, p)
        if not 0. <= ta <= a['len']:
            continue
        for b in same:
            if b is a or abs(a['u'][0] * b['u'][0] + a['u'][1] * b['u'][1]) < MEDIAN_PARALLEL:
                continue
            tb, _ = seg_local(b, p)
            if not 0. <= tb <= b['len']:
                continue
            _, off = seg_local(a, seg_point(b, tb, 0.))
            if not 0. < abs(off) <= MEDIAN_SPAN:
                continue
            sa = 1. if off > 0 else -1.
            side_a = 'L' if sa > 0 else 'R'
            side_b = 'L' if -sa * (b['n'][0] * a['n'][0] + b['n'][1] * a['n'][1]) > 0 else 'R'
            if a['w' + side_a] > 0 or b['w' + side_b] > 0:
                continue                      # a sidewalk between them: two streets, not one with a median
            lo, hi = a['curb' + side_a], abs(off) - b['curb' + side_b]
            centre = seg_point(a, ta, sa * (lo + hi) / 2)
            d = math.dist(p, centre)
            if d <= reach and (best is None or (d, a['i'], b['i']) < best[0]):
                best = ((d, a['i'], b['i']), {'at': centre, 'width': hi - lo, 'segs': (a['i'], b['i'])})
    return best[1] if best else None


def median_ground(world, m):
    """Whether a mapped median holds a trunk at its middle: wide enough, off every carriageway and building, clear
    of the traffic band."""
    q = m['at']
    return m['width'] >= MEDIAN_GROUND and not world.surfaces.has(q, 'road') and not on_pavement(world, q) and \
        not world.in_building(q, PARTERRE_WALL) and world.traffic_distance(q) >= CLEAR


def _reseat(t, q, how, counts):
    t.update(at=q, moved_cm=math.dist(q, t['p']), reseated=how)
    counts['trees_reseated'] += 1
    counts['trees_reseated_' + how.split(' ')[-1]] += 1


def place_street_trees(world, L, counts):
    """Place every street and park tree (see above): sidewalk pits drawn here with their guards and planting, the
    rows kept for street_trees.json, and the curb extensions planned for _draw_extensions. Trees the carriageway
    covers are re-seated from the inventory's side, place and distance first (see reseat_pit, parterre_spot and
    mapped_median)."""
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
        kind = t['placement']
        median = kind.startswith('Terre-plein')
        # a trunk on the carriageway with the inventory's side of the street is re-seated on that side
        t['card'] = CARDINAL.get(t['side']) if on_road and not median and kind not in SAILLIES else None
        if t['card'] and kind in PARTERRES:
            q = parterre_spot(world, frames, grid, t)
            if q is not None:
                _reseat(t, q, 'parterre', counts)
                continue
        best = None
        key = street_key(t['street'])
        for i in grid.query(bbox([p])):
            f = frames[i]
            if t['card'] and not side_faces(f['n'], t['card']):
                continue
            s, d, width, gap = _strip_place(f, p)
            if not -50. <= s <= f['len'] + 50.:
                continue
            other = t['card'] is not None and street_key(f['strip']['seg']['name']) != key
            if gap <= PIT_REACH and (best is None or (other, gap, abs(d)) < best[0]):
                best = ((other, gap, abs(d)), i, s, d, width)
        on_walk = best is not None and best[0][1] == 0.
        lat = None
        if best is not None and not (kind in SAILLIES and on_road) and not median:
            _, i, s, d, width = best
            if kind in SIDEWALK_PITS or kind in BACK_OF_WALK or on_road:
                lat = _pit_back(t, width)
            elif on_walk:
                lat = max(PIT_BACK[0], min(width - PIT_D / 2 - 5., d))
        if lat is not None:
            wanted.append((best[1], best[2], lat, t))
        elif t['card']:
            wanted.append((None, 0., None, t))           # no strip of its side within reach: re-seat it below
        elif on_road:
            t['extension_wanted'] = True
    # Pits, strip by strip along the curb (the order fixes which tree slides when two want one place); the trunks
    # re-seated from the carriageway after them, so they take what room is left on their own curb.
    wanted.sort(key=lambda w: (w[0] is None, -1 if w[0] is None else w[0], w[1], w[3]['id']))
    pits, retry = [], []
    for i, s0, lat, t in wanted:
        s = None
        if i is not None:
            f = frames[i]
            s = _fit_pit(world, f, max(PIT_L / 2 + PIT_EDGE, min(f['len'] - PIT_L / 2 - PIT_EDGE, s0)), lat,
                         obstacles)
        if s is None and t['card']:
            retry.append(t)
            continue
        if s is None:
            if t['on_road']:
                t['extension_wanted'] = True
            elif point_in(t['p'], f['poly']):
                t['no_pit'] = True
                counts['trees_on_sidewalk_without_pit'] += 1
            continue
        pits.append(_claim_pit(f, s, lat, t))
    for t in sorted(retry, key=lambda t: t['id']):
        hit = reseat_pit(world, frames, grid, t, obstacles)
        if hit is None:
            t['extension_wanted'] = True
            continue
        i, s, lat = hit
        pits.append(_claim_pit(frames[i], s, lat, t))
        counts['trees_reseated'] += 1
        counts['trees_reseated_pit'] += 1
        t['reseated'] = 'sidewalk pit'
    world.sidewalk_pit_plan, world.pit_obstacles = pits, obstacles
    # Curb extensions: only where the data shows one or at a corner (a median one on a mapped median); every other
    # covered trunk is dropped and listed for the host.
    ext_trees = []
    for t in kept:
        if t['pit'] or not t['on_road'] or t.get('reseated'):
            continue
        reason = None
        if t.get('extension_wanted'):
            reason = 'inventory saillie' if t['placement'] in SAILLIES else \
                'inventory median' if t['placement'].startswith('Terre-plein') else \
                'osm choker' if near_choker(t['p']) else 'corner' if near_corner(t['p']) else None
        if reason == 'inventory median':
            t['median'] = mapped_median(world, t['p'], t['street'])
            if t['median'] is None:
                t['host'] = 'a median tree on the carriageway, and its street has no mapped median within ' \
                            f'{MEDIAN_REACH / 100:g} m'
                continue
        if reason is None:
            # resolved in finish_street_trees: on a sidewalk or lawn laid later, or dropped for the host
            t['host'] = 'on the carriageway mid-block: no room on its side, no extension in the data, not at a corner'
            continue
        t['extension_reason'] = reason
        ext_trees.append(t)
    world.street_tree_list, world.street_tree_dropped = kept, dropped
    extensions = curb_extensions(world, counts, ext_trees)
    # a median tree too far from the curbs for an extension stands on its median's own ground, if it has some
    for t in ext_trees:
        if t.get('host') and t.get('median') and median_ground(world, t['median']):
            t['host'] = None
            _reseat(t, t['median']['at'], 'median', counts)
    return extensions


def _claim_pit(f, s, lat, t):
    """Book a planned sidewalk pit on its strip and move the tree's trunk into it."""
    f['claims'].append(s)
    c = _frame_at(f, s, lat)
    t.update(pit=True, at=c, moved_cm=math.dist(c, t['p']), pit_yaw=math.degrees(math.atan2(f['u'][1], f['u'][0])),
             pit_z=Z_WALK + .15, curb_cm=lat, strip=f['strip'])
    return [f, s, lat, t]


def draw_sidewalk_pits(world, L, counts):
    """Lay the planned sidewalk pits once the sidewalks are down: a pit whose corners do not all stand on the raised
    sidewalk (the last piece before a junction dropped as a sliver, a corner ring's apron) slides along the curb to the
    nearest place where they do; a tree with none stands on the sidewalk without a pit."""
    for plan in world.sidewalk_pit_plan:
        f, s, lat, t = plan
        f['claims'].remove(s)
        s2 = _fit_pit(world, f, s, lat, world.pit_obstacles, laid=True)
        if s2 is None:
            t.update(pit=False, no_pit=True, pit_z=None)
            counts['trees_on_sidewalk_without_pit'] += 1
            f['claims'].append(s)
            continue
        f['claims'].append(s2)
        if s2 != s:
            counts['tree_pits_slid'] += 1
            t['at'] = _frame_at(f, s2, lat)
            t['moved_cm'] = math.dist(t['at'], t['p'])
        plan[1] = s2
        q = lambda x, y, f=f, s=s2, lat=lat: _frame_at(f, s + x, lat + y)      # noqa: E731
        _pit(L, q, Z_WALK, Rng('pit', t['id']), counts)
        f['strip'].setdefault('pits', []).append((s2, t['at'], t['pit_yaw']))
        counts['sidewalk_pits'] += 1
        counts['tree_pits'] += 1
        if t['moved_cm'] > 1.:
            counts['sidewalk_pits_moved'] += 1
            counts['sidewalk_pit_metres_moved'] += t['moved_cm'] / 100.
    for strip in world.sidewalk_strips:
        if strip.get('pits'):
            strip['pits'].sort(key=lambda r: r[0])


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
    """The street_trees.json rows, once every surface is down: each tree's final place, its ground height and its
    late-October colour. A trunk still on carriageway or parking asphalt outside a curb extension is dropped and
    listed for the host (host_review), with its reason."""
    rows, host = [], []
    for t in world.street_tree_list:
        x, y = t['at']
        z = t.get('pit_z')
        if z is None:
            z, top = world.surfaces.at(t['at'])
            if t.get('host') and top != 'road' and z >= Z_DROP - .5:
                t['host'] = None                    # it stands on a median lawn or a sidewalk after all
        if t.get('host'):
            host.append({'id': t['id'], 'position': [r2(t['p'][0]), r2(t['p'][1])], 'street': t['street'],
                         'side': t.get('side'), 'placement': t['placement'], 'from_curb_cm': t.get('from_curb_cm'),
                         'traffic_centreline_cm': r2(world.traffic_distance(t['p'], 2000)), 'reason': t['host']})
            continue
        if t['on_road'] and (t.get('extension') is not None or t.get('reseated')):
            counts['trees_on_carriageway'] += 1
        if not t['pit'] and not t.get('reseated') and t.get('extension') is None and not t.get('no_pit'):
            counts['trees_kept_in_place'] += 1
        kind = tree_kind(t['species'] if t['source'] == 'inventory' else None, t['dbh_cm'])
        row = {'id': t['id'], 'x_cm': r2(x), 'y_cm': r2(y), 'z_cm': r2(z), 'species': t['species'],
               'species_fr': t['species_fr'], 'kind': kind,
               'fall': tree_fall(t['species'] if t['source'] == 'inventory' else None, kind), 'dbh_cm': t['dbh_cm'],
               'height_cm': round(tree_height(kind, t['dbh_cm'] if t['dbh_cm'] is not None else OSM_DBH_DEFAULT)),
               'height_from': 'dbh' if t['dbh_from'] == 'inventory' else 'dbh_' + t['dbh_from'],
               'source': t['source'], 'placement': t['placement'], 'street': t['street'], 'pit': bool(t['pit']),
               'yaw_deg': seed('tree-yaw', t['id']) % 360}
        if t['dbh_from'] != 'inventory':
            row['dbh_from'] = t['dbh_from']
        if t['pit']:
            row['pit_yaw_deg'] = r2(t['pit_yaw'] % 360)
            if t.get('curb_cm') is not None:
                row['pit_from_curb_cm'] = r2(t['curb_cm'])
        if t['moved_cm'] > 1.:
            row['moved_cm'] = r2(t['moved_cm'])
            row['mapped_xy_cm'] = [r2(t['p'][0]), r2(t['p'][1])]
        if t.get('reseated'):
            row['reseated'] = t['reseated']
        if t.get('extension') is not None:
            row['extension'] = t['extension']
        rows.append(row)
    world.street_tree_rows, world.tree_host = rows, host
    counts['trees_for_host'] = len(host)
    counts['street_trees'] = len(rows)
    counts['street_trees_inventory'] = sum(1 for r in rows if r['source'] == 'inventory')
    counts['street_trees_osm'] = sum(1 for r in rows if r['source'] == 'osm')


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


def _clear_of_trees(world, p):
    """A city pole clear of the street trees: out of a tree pit's soil (it slides along the pit's curb past its nearer
    end, POLE_PIT_KEEP clear) and POLE_TRUNK_KEEP from a trunk outside a pit. Returns the point and how far it moved."""
    q = p
    for t in getattr(world, 'street_tree_rows', ()):
        c = (t['x_cm'], t['y_cm'])
        if abs(c[0] - q[0]) > 200 or abs(c[1] - q[1]) > 200:
            continue
        if t.get('pit') and t.get('pit_yaw_deg') is not None:
            u = (math.cos(math.radians(t['pit_yaw_deg'])), math.sin(math.radians(t['pit_yaw_deg'])))
            along = (q[0] - c[0]) * u[0] + (q[1] - c[1]) * u[1]
            across = -(q[0] - c[0]) * u[1] + (q[1] - c[1]) * u[0]
            if abs(along) < PIT_L / 2 + POLE_PIT_KEEP and abs(across) < PIT_D / 2 + POLE_PIT_KEEP:
                q = add(q, u, (1. if along >= 0 else -1.) * (PIT_L / 2 + POLE_PIT_KEEP + 1.) - along)
        elif math.dist(q, c) < POLE_TRUNK_KEEP:
            d = math.dist(q, c)
            q = add(c, ((q[0] - c[0]) / d, (q[1] - c[1]) / d) if d > .01 else (1., 0.), POLE_TRUNK_KEEP + 1.)
    return q, math.dist(p, q)


def city_poles(world, put, counts, lamps):
    """The city's wooden and steel sign poles on the streets (Data/Plateau/Inventory/sign_poles.json, POLE_KINDS): a
    wooden pole is a utility pole whose crossarm runs across the street, with a cobra head over the street unless an
    OSM lamp already stands there; a steel pole is a cobra-head street light unless an OSM lamp or another steel pole
    is that light. Left out: poles off the street (PAS_SUR_RUE, more than POLE_STREET_REACH behind a curb, inside a
    building or the park's lawn), in a ruelle, or on the Panet/Visitation route. Each pole keeps clear of the tree
    pits and trunks; the generic put() snaps it out of the carriageway and drops its collision in the traffic band.
    Returns the placed poles for the signs to hang on: id, kind, p, z, codes, names."""
    grid = Grid(1000.)
    for i, q in enumerate(lamps):
        grid.add(i, bbox([q]))
    near_lamp = lambda q: any(math.dist(q, lamps[i]) < CITY_LAMP_SAME for i in grid.query(bbox([q], CITY_LAMP_SAME)))  # noqa: E731
    alleys = AlleyIndex(world)
    placed, skipped = [], {}
    for pole in load_sign_poles():
        p, kind = pole['p'], pole['kind']
        near = nearest_seg(world, p)
        why = ('off street' if pole['off_street'] else 'route' if world.route_near(p) else
               'in a building' if world.in_building(p) else
               'far from a street' if near is None or near[0] > max(near[1]['curbL'], near[1]['curbR']) + POLE_STREET_REACH
               else 'in a ruelle' if alleys.nearest(p, POLE_LANE_KEEP) else
               'park' if world.in_park(p) and not on_pavement(world, p) and not world.surfaces.at(p)[1] == 'sidewalk'
               else 'osm lamp' if kind == 'steel' and near_lamp(p) else
               'twin' if kind == 'steel' and any(q['kind'] == 'steel' and math.dist(p, q['p']) < CITY_POLE_SAME
                                                 for q in placed) else None)
        if why:
            skipped[why] = skipped.get(why, 0) + 1
            continue
        extra = {'city_pole': pole['id'], 'pole_kind': kind}
        if world.traffic_distance(p) < CLEAR or on_pavement(world, p):
            # the pole stands on the carriageway as the replica cuts it: onto the sidewalk, as put() moves a lamp
            p, snapped = snap_to_sidewalk(world, p)
            extra['snapped_cm'] = r2(snapped)
        p, moved = _clear_of_trees(world, p)
        if moved > .5:
            extra['cleared_trees_cm'] = r2(moved)
        if on_pavement(world, p) or world.in_building(p):
            skipped['on the carriageway'] = skipped.get('on the carriageway', 0) + 1
            continue
        yaw, _ = facing_road(world, p)
        if kind == 'wood':
            # MAP-PROPS utility_pole: the crossarm runs along its +Y, here across the street toward the road
            row = put('utility_pole', p, yaw - 90., True, ('city-pole', pole['id']), extra, allow_snap=False)
            if not near_lamp(row['position'][:2]):
                put('lamp_cobra', row['position'][:2], yaw, False, ('city-pole-lamp', pole['id']),
                    {'city_pole': pole['id'], 'mount': 'utility_pole', 'without': ['pole']}, z=row['position'][2],
                    allow_snap=False)
                counts['city_lamps_on_wood'] = counts.get('city_lamps_on_wood', 0) + 1
            counts['city_wood_poles'] = counts.get('city_wood_poles', 0) + 1
        else:
            row = put('lamp_cobra', p, yaw, True, ('city-lamp', pole['id']), extra, allow_snap=False)
            counts['city_steel_lamps'] = counts.get('city_steel_lamps', 0) + 1
        placed.append({'id': pole['id'], 'kind': kind, 'p': tuple(row['position'][:2]), 'z': row['position'][2],
                       'codes': set(pole['codes']), 'names': pole['names'], 'signs': []})
    for why, n in sorted(skipped.items()):
        counts['city_poles_left_out_' + why.replace(' ', '_')] = n
    return placed


def hang_on_pole(prop, pole, yaw, toward=None):
    """Where a sign hangs on a city pole: its pivot MOUNT_OFF off the pole's axis, in front of the pole (local +X) for
    a plate facing traffic, or for the street-name blades on the diagonal (local +-X, +-Y) nearest `toward` (the
    junction), so neither blade cuts the pole; MOUNT_RAISE stacks the blades over the one-way plate over the ARRÊT."""
    if prop == 'sign_street':
        best = None
        for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
            q = local_to_world(pole['p'], yaw, (sx * MOUNT_OFF, sy * MOUNT_OFF))
            d = math.dist(q, toward) if toward else 0.
            if best is None or d < best[0]:
                best = (d, q)
        q = best[1]
    else:
        q = local_to_world(pole['p'], yaw, (MOUNT_OFF, 0.))
    return q, pole['z'] + MOUNT_RAISE[prop]


def pole_for(poles, prop, code, p, reach, names=()):
    """The nearest placed city pole within reach of p that carries a sign of this code (and, for the street names,
    names one of the streets), and does not yet carry one of this prop."""
    best = None
    for pole in poles:
        if code not in pole['codes'] or prop in pole['signs']:
            continue
        if names and not any(names_street(k, n) for k in pole['names'] for n in names):
            continue
        d = math.dist(p, pole['p'])
        if d <= reach and (best is None or d < best[0]):
            best = (d, pole)
    return best[1] if best else None


def parking_signs(world, put, hang, poles, counts):
    """A parking sign at each of the city's poles that carries one (Data/Plateau/Inventory/park_signs.json), where a
    pole of the city stands on a street the replica draws. On a wooden or steel pole the game draws (city_poles) the
    plate hangs under the junction signs, with no post; otherwise it stands on its own post, POLE_KINDS aside, at its
    pole's place, PARKING_SIGN_BEHIND the curb and clear of the tree pits. The plate stands across the sidewalk and
    faces the drivers coming along its curb, as the city's do. The row carries the pole's signs (code, text and
    arrow, top first); the plate it shows is the first. Poles left out: off the street (PAS_SUR_RUE), on the walking
    route, in a building or a ruelle, far from a street, on the park's lawn."""
    drawn = {pole['id']: pole for pole in poles}
    alleys = AlleyIndex(world)
    skipped = {}
    for pole in plateau_park_signs.load():
        p = pole['p']
        near = nearest_seg(world, p)
        why = ('off street' if pole['off_street'] else 'route' if world.route_near(p) else
               'in a building' if world.in_building(p) else
               'far from a street' if near is None or near[0] > max(near[1]['curbL'], near[1]['curbR']) + POLE_STREET_REACH
               else 'in a ruelle' if alleys.nearest(p, POLE_LANE_KEEP) else
               'park' if world.in_park(p) and not on_pavement(world, p) and not world.surfaces.at(p)[1] == 'sidewalk'
               else None)
        if why:
            skipped[why] = skipped.get(why, 0) + 1
            continue
        s = near[1]
        along, lat = seg_local(s, p)
        side = 1 if lat >= 0 else -1
        travel = s['u'] if s['tags'].get('oneway') in ('yes', '1', 'true') else \
            (-s['u'][0], -s['u'][1]) if s['tags'].get('oneway') == '-1' or side > 0 else s['u']
        yaw = math.degrees(math.atan2(-travel[1], -travel[0]))
        signs = pole['signs']
        top = signs[0]
        extra = {'city_pole': pole['id'], 'code': top['code'], 'text': top['text'],
                 'arrow': plateau_park_signs.ARROWS.get(top['arrow'], 'none'),
                 'signs': [[g['code'], plateau_park_signs.ARROWS.get(g['arrow'], 'none')] for g in signs]}
        if pole['id'] in drawn and 'sign_parking' not in drawn[pole['id']]['signs']:
            hang('sign_parking', drawn[pole['id']], yaw, ('parking', pole['id']), extra)
            counts['parking_signs_on_city_poles'] = counts.get('parking_signs_on_city_poles', 0) + 1
            continue
        curb = s['curbL'] if side > 0 else s['curbR']
        behind = max(PARKING_SIGN_BEHIND[0], min(PARKING_SIGN_BEHIND[1], abs(lat) - curb))
        q = seg_point(s, max(0., min(s['len'], along)), side * (curb + behind))
        q, moved = _clear_of_trees(world, q)
        if moved > .5:
            extra['cleared_trees_cm'] = r2(moved)
        if on_pavement(world, q) or world.in_building(q):
            skipped['on the carriageway'] = skipped.get('on the carriageway', 0) + 1
            continue
        extra['moved_cm'] = r2(math.dist(p, q))
        put('sign_parking', q, yaw, True, ('parking', pole['id']), extra, allow_snap=False)
    for why, n in sorted(skipped.items()):
        counts['parking_poles_left_out_' + why.replace(' ', '_')] = n


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

    # The city's wooden and steel poles: utility poles with cobra heads, and steel street lights.
    lamps = [world.nodes[n] for n, t in inside_nodes if t.get('highway') == 'street_lamp']
    poles = city_poles(world, put, counts, lamps)

    def hang(prop, pole, yaw, seed_parts, extra, toward=None):
        q, z = hang_on_pole(prop, pole, yaw, toward)
        pole['signs'].append(prop)
        counts['signs_on_city_poles'] = counts.get('signs_on_city_poles', 0) + 1
        return put(prop, q, yaw, False, seed_parts, dict(extra, mount='city_pole', city_pole=pole['id'],
                                                           without=['post']), z=z, allow_snap=False)

    # ARRÊT signs at the bar of every mapped stop, on the approach's right sidewalk, or on the city pole there that
    # carries the junction's ARRÊT.
    for mark in world.stop_marks:
        s = world.segs[mark['seg']]
        travel_sign = 1 if mark['forward'] else -1
        lat = -(s['curbR'] + 55) if mark['forward'] else (s['curbL'] + 55)
        p = seg_point(s, mark['along'] - travel_sign * 60, lat)
        yaw = math.degrees(math.atan2(-s['u'][1] * travel_sign, -s['u'][0] * travel_sign))
        extra = {'osm_node': mark['node'], 'text': 'ARRÊT', 'code': 'RA-A'}
        pole = pole_for(poles, 'sign_stop', 'RA-A', p, SIGN_MOUNT_REACH)
        if pole and seg_local(s, pole['p'])[1] * lat > 0:
            hang('sign_stop', pole, yaw, ('stop', mark['node']), extra)
        else:
            put('sign_stop', p, yaw, True, ('stop', mark['node']), extra)

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
        centre = world.nodes.get(j['node'])
        pole = pole_for(poles, 'sign_street', 'NR-U', centre, NAME_MOUNT_REACH, [nm for nm, _ in names[:2]]) \
            if len(names) >= 2 and centre else None
        if pole:
            # the blades hang where the city hangs them: on the junction's wooden or steel pole that names its streets
            (name_a, arm_a), (name_b, _) = names[0], names[1]
            yaw = math.degrees(math.atan2(arm_a['u'][1], arm_a['u'][0])) - 90
            text = {}
            for blade, nm in (('blade_a', name_a), ('blade_b', name_b)):
                generic, specific = street_name_parts(nm)
                text[blade] = {'generic': generic, 'specific': specific, 'full': nm}
            hang('sign_street', pole, yaw, ('street_sign', j['node'], 0),
                 {'text': text, 'junction_node': j['node'], 'code': 'NR-U'}, toward=centre)
            counts['street_name_corners'] = counts.get('street_name_corners', 0) + 1
        elif len(names) >= 2 and fillets:
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
            extra = {'traffic_heading': r2(heading % 360), 'code': 'RN-A', 'street': s['name']}
            pole = pole_for(poles, 'sign_oneway', 'RN-A', post, SIGN_MOUNT_REACH)
            if pole:
                hang('sign_oneway', pole, heading - 90, ('oneway', j['node'], s['i']), extra)
            else:
                put('sign_oneway', post, heading - 90, True, ('oneway', j['node'], s['i']), extra, allow_snap=False)

    # Parking signs at the city's poles (plateau_park_signs: the city's parking-sign inventory).
    parking_signs(world, put, hang, poles, counts)
    counts['total'] = len(rows)
    counts['osm_lamps_inside'] = sum(1 for _, t in inside_nodes if t.get('highway') == 'street_lamp')
    counts['osm_hydrants_inside'] = sum(1 for _, t in inside_nodes if t.get('emergency') == 'fire_hydrant')
    counts['osm_bixi_inside'] = sum(1 for _, t in inside_nodes if t.get('amenity') == 'bicycle_rental')
    counts['osm_stops_inside'] = len(world.stop_nodes)
    counts['collision_disabled_in_traffic_band'] = sum(1 for r in rows if not r['collision'] and 'mount' not in r and
                                                       r['prop'] in ('lamp_cobra', 'lamp_park', 'hydrant', 'sign_stop',
                                                                     'sign_oneway', 'sign_parking', 'bixi_dock',
                                                                     'utility_pole'))
    counts['snapped_out_of_carriageway'] = sum(1 for r in rows if 'snapped_cm' in r)
    return rows, counts


# ---------------------------------------------------------------------------------------------
# Soul layer: seeded wear and life

def build_soul(world):
    S = Layer('Soul', SOUL_MATERIALS)
    rows, counts = [], {k: 0 for k in ('asphalt_patches', 'trench_patches', 'crack_lines', 'potholes', 'gutter_leaf_drifts',
                                        'litter_patches', 'litter_trees_without_ground', 'litter_triangles',
                                        'weed_tufts', 'rust_streaks', 'murals',
                                        'chantier_zones', 'utility_poles', 'wire_spans', 'laundry_lines',
                                        'curb_bins', 'locked_bikes', 'flower_boxes', 'ac_units', 'leaf_bags',
                                        'leaf_bag_rows', 'pumpkins', 'pumpkin_stoops')}

    def put(prop, p, yaw, collides, parts, extra=None, z=None):
        clear = collides and collision_clear(world, prop, p, yaw)
        row = placement(world, prop, p, yaw, clear, parts, extra, z)
        rows.append(row)
        return row
    # The crowns the game draws (the Plex yard trees, the street and park trees): the washing keeps out of them and
    # the leaf litter lies under them.
    world.crowns = crowns = tree_crowns(world)
    ground = LitterGround(world)
    curb_litter = 0.

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
        # Leaves drifted against the curbs (the gutter band), more often and wider under the crowns.
        for side, sign in (('L', 1), ('R', -1)):
            if s['w' + side] <= 0:
                continue
            x = a0 + rng.uniform(0, 600)
            while x < a1 - 150:
                run = rng.uniform(150, 650)
                fall = leaves_over(crowns, seg_point(s, x + run / 2, sign * s['curb' + side]))
                if rng.chance(CURB_DRIFT[0] + CURB_DRIFT[1] * fall):
                    drawn, tris = _curb_drift(world, S, s, side, sign, x, run, rng.uniform(18, 46) * (1. + fall), rng)
                    curb_litter += drawn / 1e4
                    counts['litter_triangles'] += tris
                    counts['gutter_leaf_drifts'] += tris > 0
                x += run + rng.uniform(200, 900) * (1. - .5 * fall)

    # Leaves drifted along the ruelles' sunken centre gutters, and fallen under every street and park crown.
    ruelle_litter = _gutter_drifts(world, S, counts, crowns)
    foot_litter = _lane_drifts(world, S, ground, crowns, counts)
    world.lane_patches = []
    litter_kinds, lane_litter_record = tree_litter(world, S, crowns, ground, counts)
    ruelle_litter += _gutter_beside_patches(world, S, counts, world.lane_patches)
    world.leaf_litter = {
        'key': 'Leaf_Litter', 'uv': 'world metres (u = x / 100, v = y / 100)',
        'lift_cm': {'park_lawn': LITTER_PARK, 'streets': LITTER_WALK, 'ruelle_gutter': LITTER_LIFT,
                    'ruelle_paving': LITTER_LANE},
        'road_z_cm': Z_LITTER_ROAD, 'cover': f'min({LITTER_COVER}, {LITTER_GAIN} x (1 - leaf_retention)) of the crown',
        'outline_cm': {'park': LITTER_EDGE, 'fine': LITTER_EDGE_FINE, 'open_side_max': LITTER_SIDE,
                       'split': LITTER_SPLIT, 'teeth': list(LITTER_TEETH), 'along_ground_edge': LITTER_HUG,
                       'cut': LITTER_CUT, 'ray_step': LITTER_RAY_STEP}, 'fringe': {
            'clumps': list(LITTER_FRINGE[:2]), 'per_outline_cm': LITTER_FRINGE[2], 'points': LITTER_FRINGE_RING,
            'radius_cm': list(LITTER_FRINGE_SIZE), 'beyond_edge': LITTER_FRINGE_OUT,
            'drawn_as': 'quad, or a five-point fan where a street clump lies apart from every patch',
            'street_gap_max_cm': LITTER_FRINGE_GAP, 'street_points_apart': LITTER_CLUMP_RING},
        'park_near_street': {'within_cm': LITTER_PARK_NEAR, 'clumps': list(LITTER_PARK_FRINGE[:2]),
                             'per_outline_cm': LITTER_PARK_FRINGE[2], 'radius_cm': list(LITTER_PARK_CLUMP)},
        'ruelle_foot_drifts': {'drifts': counts.get('ruelle_foot_leaf_drifts', 0), 'stretch_cm': list(LANE_DRIFT),
                               'gap_cm': list(LANE_DRIFT_GAP), 'width_cm': list(LANE_DRIFT_W),
                               'chance': f'{CURB_DRIFT[0]} + {CURB_DRIFT[1]} x leaves overhead'},
        'kinds': litter_kinds, 'yard_trees_over_ruelles': lane_litter_record,
        'curb_drifts_m2': round(curb_litter, 1), 'ruelle_drifts_m2': round(ruelle_litter, 1),
        'ruelle_foot_drifts_m2': round(foot_litter, 1)}

    # Weeds at curb joints.
    for strip in world.sidewalk_strips:
        s = strip['seg']
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

    # Curb bins, locked bikes, flower boxes and AC units hinted on lots; in late October, paper leaf bags beside some
    # bin rows and pumpkins on some stoops.
    october = october_props()
    stoop_pumpkins(world, put, counts, october, plex)
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
                leaf_bags(world, put, counts, october, strip, (s['i'], k), curb_pt, along, u, inward, yaw_street,
                          (len(kinds) - 1) / 2 * 75)
            if lot.get('fence') and rng.chance(.09):
                contact = add(add(lot['p0'], lot['out'], 9), u, rng.uniform(80, max(90., math.dist(lot['p0'], lot['p1']) - 80)))
                out_v = lot['out']
                yaw = math.degrees(math.atan2(out_v[0], -out_v[1]))   # prop -Y (lean side) toward the fence
                cx, cy = props_info()['bike_contact']
                off = local_to_world((0., 0.), yaw, (cx, cy))
                p = (contact[0] - off[0], contact[1] - off[1])
                if bike_on_ground(world, p, yaw, world.surfaces.at(p)[0]):
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


# -- late October: paper leaf bags at the curbs and pumpkins on the stoops -------------------------------
# Montréal collects leaves in compostable paper bags (plastic bags are refused in the green-waste collection), set out
# at the curb beside the bins; pumpkins sit on the stoops in the last week of October (an art-direction choice: no data
# source places them). The props are the Props layer's 'season' kind (Scripts/blender/plateau_props.py): three bag
# forms by fill and an uncarved and a carved pumpkin, picked by the manifest's form shares; a pumpkin's size is its
# placement scale (pie, carving or large). The stoops are the Plex fronts' ground-floor landings, read from the Plex
# layer's Wood_Deck geometry: the level top at the front's raise in front of its wall.
LEAF_BAG_ROW = (.15, .5)        # a curb bin row's chance of leaf bags beside it: this, plus this times the leaves overhead
LEAF_BAGS = (1, 3)              # bags in such a row, on one side of it,
LEAF_BAG_GAP = (60., 46.)       # the first this far past the last bin's centre, then this far apart (cm)
LEAF_BAG_KEEP = 60.             # no bag this near a Furniture prop (a hydrant, a sign post, a lamp),
LEAF_BAG_KEEP_SIGN = 160.       # nor this near a parking sign post, where a bike may be locked (lock_bikes_to_signs)
PUMPKIN_STOOP = .16             # a stoop landing's chance of pumpkins in late October
PUMPKIN_SIZES = (('pie', .35), ('carving', .45), ('large', .2))   # by the Props manifest's sizes
PUMPKIN_EDGE = 12.              # a pumpkin keeps this far (cm) inside the landing's edge (its rail and posts)
PUMPKIN_STAIR = 40.             # a landing whose span along the wall comes this near an exterior stair's is left bare,
PUMPKIN_ROAD = 250.             # as is one this near a carriageway (a stoop at the street's edge, by the parked cars)
PLEX_DECKS = ('WoodDeck', 'WoodDeckVisual')   # the Plex batches whose Wood_Deck tops hold the stoop landings


def october_props():
    """The season props' forms, shares, sizes and scale ranges from the Props manifest (agreed defaults without it)."""
    out = {'leaf_bag': [('leaf_bag', .45), ('leaf_bag_mid', .35), ('leaf_bag_low', .2)],
           'pumpkin': [('pumpkin', .7), ('pumpkin_carved', .3)], 'sizes': {'pie': .6, 'carving': 1., 'large': 1.4},
           'bag_scale': (.97, 1.03), 'pumpkin_scale': (.55, 1.45), 'pumpkin_radius': 15.4, 'bag_half': (16.6, 20.8)}
    try:
        props = json.loads(PROPS_MANIFEST.read_text())['props']
        out['leaf_bag'] = [(f['prop'], f['share']) for f in props['leaf_bag']['forms']]
        out['pumpkin'] = [(f['prop'], f['share']) for f in props['pumpkin']['forms']]
        out['sizes'] = dict(props['pumpkin']['sizes'])
        out['bag_scale'] = tuple(props['leaf_bag']['scale_range'])
        out['pumpkin_scale'] = tuple(props['pumpkin']['scale_range'])
        out['pumpkin_radius'] = max(abs(v) for key in ('pumpkin', 'pumpkin_carved')
                                    for v in props[key]['bounds_cm'][:2] + props[key]['bounds_cm'][3:5])
        bounds = [props[key]['bounds_cm'] for key, _ in out['leaf_bag']]     # x across the bag, y along its wide faces
        out['bag_half'] = (max(max(-b[0], b[3]) for b in bounds), max(max(-b[1], b[4]) for b in bounds))
    except (OSError, KeyError, ValueError, TypeError):
        pass
    return out


def _pick(rng, options):
    x, total = rng.random(), 0.
    for key, share in options:
        total += share
        if x < total:
            return key
    return options[-1][0]


def leaf_bags(world, put, counts, october, strip, key, curb_pt, along, u, inward, yaw, half_row):
    """Paper leaf bags beside a curb bin row (LEAF_BAG_ROW): one to three on one side of it along the curb, a wide face
    toward the street, each on the level sidewalk clear of the strip's ends, its ramps and tree pits and the Furniture
    props, picked by the forms' shares."""
    rng = Rng('leaf-bags', strip['seg']['way'], strip['seg']['i'], strip['side'], *key)
    if not rng.chance(LEAF_BAG_ROW[0] + LEAF_BAG_ROW[1] * leaves_over(world.crowns, curb_pt)):
        return
    sign = 1. if rng.chance(.5) else -1.
    furniture = getattr(world, 'furniture_grid', None)
    laid = 0
    x, y = october['bag_half']
    for j in range(rng.randint(*LEAF_BAGS)):
        off = sign * (half_row + LEAF_BAG_GAP[0] + j * LEAF_BAG_GAP[1])
        p = add(curb_pt, u, off)
        turn, scale = yaw + rng.uniform(-15., 15.), round(rng.uniform(*october['bag_scale']), 3)
        if not 120. < along + off < strip['len'] - 120. or \
                any(abs(along + off - r) < 250. for r in strip.get('ramps', [])) or \
                any(abs(along + off - pit[0]) < 90. for pit in strip.get('pits', [])) or \
                not all(world.surfaces.at(local_to_world(p, turn, (sx * (x * scale + 3.), sy * (y * scale + 3.)))) ==
                        (Z_WALK, 'sidewalk') for sx in (-1., 0., 1.) for sy in (-1., 0., 1.)) or \
                (furniture and any(math.dist(p, q) < keep for q, keep in furniture(p))):
            break
        row = put(_pick(rng, october['leaf_bag']), p, turn, False, ('leaf-bag', strip['seg']['i'], *key, j),
                  {'season': 'october', 'at': 'curb'})
        row['scale'] = scale
        counts['leaf_bags'] += 1
        laid += 1
    counts['leaf_bag_rows'] += laid > 0


def plex_stoops(world, plex_dir=None):
    """The Plex fronts' ground-floor stoop landings: for each front raised 30 cm or more over a parterre of 60 cm or
    more (plateau_plex.author_front builds a porch there), the level Wood_Deck tops at the front's raise in front of
    its wall, merged into rectangles in the front's frame (x along the wall, d out from it). Returns (front id, frame,
    x0, x1, d0, d1, z) rows; none without the Plex layer."""
    plex_dir = Path(plex_dir or OUT / 'Plex')
    try:
        fronts = json.loads((plex_dir / 'fronts.json').read_text())['fronts']
        batches = json.loads((plex_dir / 'manifest.json').read_text())['batches']
    except (OSError, KeyError, ValueError):
        return []
    tris, grid = [], Grid(1000.)
    for batch in batches:
        if batch['material'] != 'Wood_Deck' or batch['file'].split('_')[0] not in PLEX_DECKS:
            continue
        vs = []
        for line in (plex_dir / batch['file']).read_text().splitlines():
            if line.startswith('v '):
                _, x, y, z = line.split()
                vs.append((float(x), -float(y), float(z)))     # the OBJ stores -y
            elif line.startswith('f '):
                t = [vs[int(q.split('/')[0]) - 1] for q in line.split()[1:]]
                if 25. <= t[0][2] <= 120. and all(abs(q[2] - t[0][2]) < .01 for q in t):
                    grid.add(len(tris), bbox(t))
                    tris.append(t)
    out = []
    for f in sorted(fronts, key=lambda f: str(f['id'])):
        front, raise_ = f.get('front') or {}, f.get('raise_cm', 0)
        if not front.get('a') or raise_ < 30 or front.get('yard_cm', 0.) < 60:
            continue
        F = Frame2.from_wall(front['a'], front['b'])
        width, yard = front['width_cm'], front['yard_cm']
        stairs = []
        for st in front.get('stairs') or []:
            xs = [F.local(st[k])[0] for k in ('head', 'bottom')]
            stairs.append((min(xs) - PUMPKIN_STAIR, max(xs) + PUMPKIN_STAIR))
        rects = []
        for i in grid.query(bbox([front['a'], front['b']], yard + 10.)):
            t = tris[i]
            if abs(t[0][2] - raise_) > .01:
                continue
            loc = [F.local(q) for q in t]
            x0, x1 = min(x for x, _ in loc), max(x for x, _ in loc)
            d0, d1 = min(d for _, d in loc), max(d for _, d in loc)
            if x0 < -1. or x1 > width + 1. or d0 < PLEX_D_FACE - 4. or d1 > yard + 5.:
                continue
            for r in rects:             # the two triangles of one box top share an edge: merge touching ones
                if x0 <= r[1] + 1. and r[0] <= x1 + 1. and d0 <= r[3] + 1. and r[2] <= d1 + 1.:
                    r[:] = [min(r[0], x0), max(r[1], x1), min(r[2], d0), max(r[3], d1)]
                    break
            else:
                rects.append([x0, x1, d0, d1])
        for x0, x1, d0, d1 in sorted(rects):
            if not any(x0 < b and a < x1 for a, b in stairs):
                out.append((str(f['id']), F, x0, x1, d0, d1, float(raise_)))
    return out


def stoop_pumpkins(world, put, counts, october, plex):
    """Pumpkins on some stoop landings (PUMPKIN_STOOP) away from the carriageway (PUMPKIN_ROAD): one or two, at the
    landing's outer corners flanking its steps, PUMPKIN_EDGE inside its edge, each sized by the manifest's pie, carving or
    large scale where the landing has room (the largest that fits), a carved one with its face toward the sidewalk."""
    if plex is None:
        return
    roads, grid = world.surfaces.kinds.get('road', ([], Grid()))

    def near_road(p):
        return any(point_in(p, roads[i]) or min(seg_dist(p, a, b) for a, b in zip(roads[i], roads[i][1:] + roads[i][:1]))
                   < PUMPKIN_ROAD for i in grid.query(bbox([p], PUMPKIN_ROAD)))
    for lot, F, x0, x1, d0, d1, z in plex_stoops(world):
        rng = Rng('pumpkins', lot, round(x0), round(d1))
        if not rng.chance(PUMPKIN_STOOP) or any(near_road(F.world(x, d1)) for x in (x0, (x0 + x1) / 2, x1)):
            continue
        corners = [-1., 1.]
        if rng.chance(.5):
            corners = corners[::-1]
        placed = 0
        for corner in corners[:rng.randint(1, 2)]:
            size = _pick(rng, PUMPKIN_SIZES)
            scale = october['sizes'][size] * rng.uniform(.96, 1.04)
            for fit in (size, 'carving', 'pie'):
                scale = min(scale, october['sizes'][fit] * 1.04)
                r = october['pumpkin_radius'] * scale
                if 2. * (r + PUMPKIN_EDGE) <= min(d1 - d0, (x1 - x0) / 2.):
                    break
            else:
                continue
            scale = max(october['pumpkin_scale'][0], min(october['pumpkin_scale'][1], scale))
            x = x0 + PUMPKIN_EDGE + r if corner < 0 else x1 - PUMPKIN_EDGE - r
            p = F.world(x, d1 - PUMPKIN_EDGE - r)
            prop = _pick(rng, october['pumpkin'])
            # the carved face (+X) toward the sidewalk, out from the wall
            yaw = math.degrees(math.atan2(F.n[1], F.n[0])) + rng.uniform(-25., 25.) if prop == 'pumpkin_carved' \
                else rng.uniform(0., 360.)
            row = put(prop, p, yaw, False, ('pumpkin', lot, round(x0), corner), {'season': 'october', 'at': 'stoop',
                                                                                 'lot': lot}, z=z)
            row['scale'] = round(scale, 3)
            counts['pumpkins'] += 1
            placed += 1
        counts['pumpkin_stoops'] += placed > 0


BIKE_TYRE = 85.     # the bike_locked tyre contacts stand this far either side of its pivot, along its +X
BIKE_ON_SIGN = .3   # the share of the free-standing parking-sign posts with a bike locked to them


def in_tree_pit(world, p, pad=0.):
    """Whether p lies in a street tree's sidewalk pit (or within pad of it)."""
    for t in getattr(world, 'street_tree_rows', ()):
        c = (t['x_cm'], t['y_cm'])
        if not t.get('pit') or t.get('pit_yaw_deg') is None or abs(c[0] - p[0]) > 200 or abs(c[1] - p[1]) > 200:
            continue
        u = (math.cos(math.radians(t['pit_yaw_deg'])), math.sin(math.radians(t['pit_yaw_deg'])))
        along = (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]
        across = -(p[0] - c[0]) * u[1] + (p[1] - c[1]) * u[0]
        if abs(along) < PIT_L / 2 + pad and abs(across) < PIT_D / 2 + pad:
            return True
    return False


def bike_on_ground(world, p, yaw, z):
    """Whether a locked bike's two tyre contacts and its middle lie on level ground at z (no curb drop, no ramp,
    no road), out of the tree pits."""
    for k in (-1., 0., 1.):
        q = local_to_world(p, yaw, (k * BIKE_TYRE, 0.))
        ground, kind = world.surfaces.at(q)
        if abs(ground - z) > .5 or kind in ('road', 'apron', 'ground') or in_tree_pit(world, q, 5.):
            return False
    return True


def lock_bikes_to_signs(world, furniture_rows, soul_rows, counts):
    """Bikes locked to the parking-sign posts. A bike stands along the curb, as people lock them to Plateau sign
    posts, leaning on the post from the building side (the prop leans toward its -Y), so both wheels stay on the
    sidewalk; a bike whose wheels would leave the level sidewalk (a ramp, a tree pit, the curb) is left out."""
    for row in furniture_rows:
        if row['prop'] != 'sign_parking' or 'mount' in row:
            continue
        rng = Rng('bike-sign', row['variant_seed'])
        if not rng.chance(BIKE_ON_SIGN):
            continue
        post = tuple(row['position'][:2])
        road, _ = facing_road(world, post)
        inward = (-math.cos(math.radians(road)), -math.sin(math.radians(road)))
        yaw = row['yaw']
        # The prop's +Y (the side away from its lean) points to the buildings.
        if -math.sin(math.radians(yaw)) * inward[0] + math.cos(math.radians(yaw)) * inward[1] < 0:
            yaw += 180.
        cx, cy = props_info()['bike_contact']
        off = local_to_world((0., 0.), yaw, (cx, cy + 4))
        p = (post[0] - off[0], post[1] - off[1])
        if not bike_on_ground(world, p, yaw, row['position'][2]):
            counts['locked_bikes_off_level_ground'] = counts.get('locked_bikes_off_level_ground', 0) + 1
            continue
        soul_rows.append(placement(world, 'bike_locked', p, yaw, False, ('bike-sign', row['variant_seed']),
                                   {'locked_to': 'sign_parking'}, z=row['position'][2]))
        counts['locked_bikes'] += 1


# -- leaf litter ----------------------------------------------------------------------------------
# Late October: the leaves are coming down. The litter is the Leaf_Litter set (plateau_textures.leaf_litter: the tree
# atlas's own leaf shapes stamped in drifts, masked and two-sided), laid as ragged patches: one under every street and
# park crown, drifts along the curbs and drifts in the ruelles' centre gutters. A patch is a fan round its centre. Its
# outline wanders (two waves and a seeded jitter), and each ray is cut back to the flat ground the patch starts on, so
# no patch hangs over a curb, a ramp or a path. Every patch carries world metre UVs (u = x, v = y, the set's 2 m tile),
# so two patches that overlap show the same leaves and no seam: the idea of Unreal's WorldAlignedTexture function (Epic,
# "Texturing Material Functions"), baked into the UVs. The share of a crown's ground the leaves cover follows
# how much of the crown has fallen: the kind's 1 - leaf_retention (Trees/manifest.json) times LITTER_GAIN, at most
# LITTER_COVER. The curb drifts thicken where crowns stand over the curb. The technique: Adam Sharp, "Making a Fallen
# Leaves Material in Substance 3D Designer" (80.lv, 2022), a splatter of leaf shapes, here on the tree atlas's leaves.
# Sixth pass. A ray is probed at least every LITTER_RAY_STEP and its cut back to the ground then halved to within
# LITTER_CUT: the linear search refined by a binary search of relief mapping (Policarpo, Oliveira and Comba, "Real-Time
# Relief Mapping on Arbitrary Polygonal Surfaces", I3D 2005; GPU Gems 3, chapter 18), so an outline that meets a curb or
# a lawn's edge follows it and a ruelle's gutter is not stepped over. Then every side across open ground longer than
# LITTER_SIDE is split into pieces about LITTER_SPLIT long whose new points stand by turns out and in (LITTER_TEETH), so
# a pulled-in point no longer leaves one long straight side: the Resample step of Houdini's curve tools ("Maximum
# Segment Length", SideFX docs) with the serration carried on. A side that runs along a change in the ground stays
# straight, and the points along it are dropped. The clumps of a fringe are quads (two triangles), or five-point rings
# where a street patch's clump lies apart from every patch, all within 30 cm of their own (Forest Pack's falloff from an area's
# edge, iToo Software, capped). Under a yard crown over a ruelle, patches are laid along each half-lane until they cover
# its kind's share of the paving, and leaves bank against the fences and walls by the curb drifts' rule; Guerrilla drives Horizon Zero Dawn's placement density from
# distance maps to roads and objects (van Muijden, "GPU-Based Procedural Placement in Horizon Zero Dawn", GDC 2017), the
# same idea of more litter at an edge. A park patch near a street is fine with a fringe; farther in, a coarser ring pays
# for it (a budget rule, no outside technique).
LITTER_LIFT = .4                # cm over the ground under it (over the 3 mm a coplanar layer needs); over the Streets
LITTER_WALK = .75               # sidewalks and lawns, over their dressing too (joints at 1.2 mm, pit soil at 1.5 mm,
                                # the lawn edges at 1.4 mm and the corner lots' lawns 3 mm up, their edges at 4.4 mm)
LITTER_PARK = 1.                # over the park lawn, over plateau_park's own fallen leaves too (2.30 to 2.38 cm, their
                                # ribs 3.5 mm higher, on the 2 cm lawn): the litter clears the highest rib by 2.7 mm,
                                # more than the 2.5 mm a gutter keeps over the old road (0.7 mm before the sixth pass)
Z_LITTER_ROAD = Z_PAINT2 + .3   # a curb drift lies over the asphalt, its paint and the Soul patches
LITTER_GAIN = 1.6               # cover of a crown's ground per share of its leaves down...
LITTER_COVER = .9               # ... up to this
LITTER_EDGE = 240.              # cm of outline per vertex round a patch on the park lawn far from the streets,
LITTER_RING = (6, 10)           # within these counts, serrated as a fine patch is
LITTER_EDGE_FINE = 60.          # and round a patch on a sidewalk, lawn, parterre or ruelle, seen from close by,
LITTER_RING_FINE = (10, 20)     # within these counts,
LITTER_SERRATE = (.06, .24)     # its points by turns this far out and in (shares of the radius): a serrated edge,
LITTER_SERRATE_CM = 40.         # at most this far (cm), so a big patch keeps its wobble rather than long teeth; its
                                # jitter (LITTER_WOBBLE) stays under a third of this
LITTER_CUT = 5.                 # a ray's cut back to its ground is found to within this (cm), probing it at least
LITTER_RAY_STEP = 30.           # this often (cm), so a ruelle's gutter or a lawn strip is not stepped over
LITTER_THIN = 30.               # a patch whose area over its length is less than this (cm) is a sliver: left out,
LITTER_CLEAR = 25.              # as is one whose centre has not its own ground this far round it (at a ground's edge)
LITTER_SIDE = 120.              # a fine patch's side across open ground longer than this (cm) is split
LITTER_SPLIT = 90.              # into pieces about this long,
LITTER_TEETH = (6., 22.)        # the new points by turns this far out and in (cm)
LITTER_HUG = 12.                # a side within this (cm) of a change in its ground all along stays straight
LITTER_RUN = 300.               # a fine patch's outline that runs this far (cm) in a line of short sides,
LITTER_RUN_TURN = 10.           # turning less than this (degrees) along it, with no change in its ground within
LITTER_RUN_NEAR = 20.           # this (cm) beyond it, is broken by midpoint displacement: its points by turns
LITTER_RUN_SHIFT = (20., 40.)   # this far out and in (cm). A run along a curb, a lawn's edge, a wall or the gutter stays
LITTER_RUN_KEEP = .6            # a point moved in keeps this share of its radius at least
LITTER_RUN_MARGIN = 20.         # runs are broken from this much shorter than LITTER_RUN (the OBJs round to 0.01 cm)
LITTER_CHORD = 180.             # an outline whose points all stay within LITTER_CHORD_DEV (cm) of the straight line
LITTER_CHORD_DEV = 18.          # between two of them this far apart reads as one straight cut, however its short
                                # sides turn; where that line runs this far over open ground, it is broken as a run is
                                # (the test asks for none of 200 cm within 15 cm)
LITTER_SPOKE = .7               # a side of the raw outline whose direction lies this close to its ray's (|cos|)
LITTER_SPOKE_DEPTH = 5          # runs out from the centre: rays are added in it, halving the angle up to this often
LITTER_SPOKE_MIN = 50.          # a side that runs out from the centre may be this long (cm): a tooth, not a cut
LITTER_OPEN_SIDE = 140.         # a side over this (cm) across open ground is a flaw (the test asks for none over 150)
LITTER_SHRINK = (.8, .64, .5)   # a patch with flaws is laid again round the middle of what it covers, then smaller
LITTER_SMALL = 5000.            # a patch or clump under this (cm2) whose ground ends within LITTER_SMALL_PROBE (cm)
LITTER_SMALL_PROBE = (8., 10.)  # beyond a point of its outline, along its ray, is left out: a scrap the edge of its
                                # ground cuts (a ramp, a curb, a lawn's edge) reads as a cut-out shape
LITTER_FRINGE = (2, 4, 500.)    # around such a patch, small clumps: at least, at most, one per this much outline (cm)
LITTER_FRINGE_RING = 4          # each a ring of this many points (a clump of a few leaves),
LITTER_FRINGE_SIZE = (22., 40.) # this big (radius, cm) out toward the drip line and at the patch's edge,
LITTER_FRINGE_OUT = .55         # lying up to this share of the patch's radius beyond its edge, fewer further out;
                                # each clump is a quad (two triangles)
LITTER_FRINGE_GAP = 30.         # a street patch's clumps lie within this (cm) of it, and one apart from it has
LITTER_CLUMP_RING = 5           # this many points round: alone on open ground, a four-point clump reads as a small
                                # rug, a diamond; one hidden under a patch is left out. Drawn as a fan from a corner
                                # that sees the others (three triangles), else from its centre (five): six points
                                # would take the litter over its 110,000 triangles
LITTER_PARK_NEAR = 2000.        # a park patch this near a street (its sidewalk or carriageway) is fine, as a
LITTER_PARK_FRINGE = (1, 2, 1200.)   # street's is, with clumps round it: one per this much outline,
LITTER_PARK_CLUMP = (30., 60.)  # bigger ones, on the lawn only
LITTER_LANE = .65               # lift over a ruelle's paving (Z_ALLEY; its wedges are drawn 0.5 mm lower): 7.45 cm,
                                # clear of the gutter drifts' heights and the curb drifts' 7.5 cm
LITTER_COVERED = .6             # a main patch whose centre lies this far into a patch as big already drawn on the
                                # same ground is left out (a grove's patches overlap into one carpet anyway)
LITTER_WOBBLE = (.2, .12, .14)  # the outline's two waves and its jitter, as shares of the radius
LITTER_PROBES = (.3, .55, .8, 1.)   # each ray is tried at these shares of its length, out from the centre,
LITTER_PROBE = 90.              # then each triangle of the fan on points this far apart (cm)
CURB_DRIFT = (.4, 1.)           # a curb stretch's chance of a drift: this, plus this times the leaves overhead
RUELLE_DRIFT = (.4, 1.2)        # a ruelle gutter stretch's chance of a drift: this, plus this times the leaves overhead
RUELLE_UNDER = .04              # ... and always a drift where this much leaf fall reaches the gutter (a crown over it)
LANE_DRIFT = (150., 500.)       # leaves banked at a ruelle's fence or wall foot: stretches this long (cm),
LANE_DRIFT_GAP = (60., 300.)    # this far apart (closer under the crowns), each drawn by the CURB_DRIFT rule,
LANE_DRIFT_W = (16., 34.)       # reaching this far out over the paving (cm), wider under the crowns, 3 cm off the
LANE_DRIFT_STEP = 25.           # nearest point of the paving's edge where the edge steps by less than this (cm)
BASE_GROUND = ROOT / 'Data/Plateau/BaseGeometry'


class LitterGround:
    """The flat ground fallen leaves can lie on, at a point: a level Streets sidewalk, lawn or dropped curb (never a
    ramp or the roadway), a ruelle's paving outside its sunken gutter, or the park's lawn (BaseGeometry/Grass.obj)
    where no path, pond, court or old road lies over it and no building stands. at(p) gives the height the leaves lie
    at there (LITTER_WALK over a Streets surface, LITTER_LANE over a ruelle's paving, LITTER_PARK over the lawn), or
    None."""
    LAWN, COVERS = LITTER_LAWN, LITTER_COVERS     # BaseGeometry: the park's lawn and what lies over it

    def __init__(self, world, base=None):
        self.world, self.memo = world, {}
        self.alleys = AlleyIndex(world)         # the ruelles' centre lines: no leaves lie over the sunken gutter
        self.fine = Grid(250.)                  # the Streets surfaces again, on a finer grid for point lookups
        for i, (poly, _, _) in enumerate(getattr(getattr(world, 'surfaces', None), 'items', ())):
            self.fine.add(i, bbox(poly))
        base = Path(base or BASE_GROUND)
        self.lawn, self.covers = self._polys(base, self.LAWN), self._polys(base, self.COVERS)

    @staticmethod
    def _polys(base, names):
        polys, grid = [], Grid(1000.)
        for name in names:
            path = base / name
            if not path.is_file():
                continue
            vs = []
            for line in path.read_text().splitlines():
                if line.startswith('v '):
                    _, x, y, z = line.split()
                    vs.append((float(x), -float(y), float(z)))     # the OBJ stores -y
                elif line.startswith('f '):
                    face = [vs[int(t.split('/')[0]) - 1] for t in line.split()[1:]]
                    grid.add(len(polys), bbox(face))
                    polys.append(([q[:2] for q in face], max(q[2] for q in face)))
        return polys, grid

    @staticmethod
    def _cell(grid, p):
        """The items of the grid cell holding p (a point lies in one cell, so no item repeats)."""
        return grid.cells.get((math.floor(p[0] / grid.cell), math.floor(p[1] / grid.cell)), ())

    @staticmethod
    def _top(index, p):
        polys, grid = index
        best = None
        for i in LitterGround._cell(grid, p):
            poly, z = polys[i]
            if (best is None or z > best) and point_in(p, poly):
                best = z
        return best

    def at(self, p):
        return self.lookup(p)[0]

    def street_distance(self, p, reach):
        """How far p lies from the nearest street (a Streets sidewalk or carriageway) within `reach`, else None."""
        best = None
        for kind in ('sidewalk', 'road'):
            polys, grid = self.world.surfaces.kinds.get(kind, ([], Grid()))
            for i in grid.query(bbox([p], reach)):
                poly = polys[i]
                d = 0. if point_in(p, poly) else min(seg_dist(p, a, b) for a, b in zip(poly, poly[1:] + poly[:1]))
                if d <= reach and (best is None or d < best):
                    best = d
        return best

    def on_streets(self, p):
        """Whether the ground at p is a Streets sidewalk, lawn, dropped curb or ruelle paving (not the park's lawn)."""
        return self.lookup(p)[1]

    def lookup(self, p):
        key = (round(p[0], 1), round(p[1], 1))
        if key not in self.memo:
            self.memo[key] = self._at(p)
        return self.memo[key]

    def _at(self, p):
        surfaces = self.world.surfaces
        z, kind, low = 0., 'ground', 0.          # Surfaces.at and Surfaces.floor in one pass over p's cell
        for i in self._cell(self.fine, p):
            poly, zi, ki = surfaces.items[i]
            if point_in(p, poly):
                if zi >= z:
                    z, kind = zi, ki
                low = max(low, surfaces.lows[i])
        if kind in ('sidewalk', 'yard', 'apron'):
            return (z + LITTER_WALK if abs(low - z) < .05 else None), True
        if kind == 'alley':
            # a ruelle's paving out to the fences, never the sunken gutter (its own drifts lie there)
            near = self.alleys.nearest(p, GUTTER_HALF + 3.)
            return (z + LITTER_LANE if abs(low - z) < .05 and near is None else None), True
        if kind != 'ground' or self.world.in_building(p) or self._top(self.covers, p) is not None:
            return None, False
        lawn = self._top(self.lawn, p)
        return (None if lawn is None else lawn + LITTER_PARK), False


def _litter_face(S, pts, z=None):
    """One Leaf_Litter fan, pts[0] its centre (or a point every other point sees), wound up, on world metre UVs."""
    pts = [(p[0], p[1], z if z is not None else p[2]) for p in pts]
    if area([p[:2] for p in pts]) < 0:
        pts = [pts[0]] + pts[1:][::-1]
    S.uvface('Leaf_Litter', pts, [(p[0] / 100., p[1] / 100.) for p in pts])
    return len(pts) - 2


def _quad_order(pts):
    """A four-point ring started at a corner whose diagonal lies inside it, so its fan from that corner is the quad."""
    a, b, c, d = (q[:2] for q in pts)
    side = lambda p, q, r: (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])   # noqa: E731
    return list(pts[1:]) + list(pts[:1]) if side(a, c, b) * side(a, c, d) >= 0 else list(pts)


def _litter_quad(S, pts, z):
    """A clump of leaves: a four-point ring as one quad (two triangles), split along the diagonal inside it."""
    return _litter_face(S, _quad_order(pts), z)


def litter_patch(ground, c, radius, rng, z0=None, ring_size=None, fine=False, side=LITTER_SIDE):
    """A ragged patch of fallen leaves round c on the flat ground there: the outline, a ring of points round c whose
    radius wanders, each cut back along its ray to where c's ground ends (the last probe on it, then halved to within
    LITTER_CUT), then pulled in where a triangle of the fan would leave that ground (closed up round c where pulling in
    does not help). A fine patch (on a sidewalk, lawn, parterre or ruelle, seen from close by) has a point every
    LITTER_EDGE_FINE cm, by turns out and in (LITTER_SERRATE), so its edge is serrated rather than a few long straight
    sides; after the cut, each of its sides across open ground longer than LITTER_SIDE is split into pieces about
    LITTER_SPLIT long, the new points by turns out and in (LITTER_TEETH), while a side that runs along a change in the
    ground (a curb, a lawn's edge, a fence foot) stays straight. Returns (centre, ring, the leaves' height), or None
    where c has no such ground or stands at its very edge. A coarse patch (the park's carpet) is serrated too, with a
    point every LITTER_EDGE cm."""
    z0 = ground.at(c) if z0 is None else z0
    if z0 is None:
        return None
    same = lambda p: (lambda z: z is not None and abs(z - z0) < .05)(ground.at(p))   # noqa: E731
    if not ring_size and not all(same(add(c, (math.cos(k * math.tau / 8), math.sin(k * math.tau / 8)), LITTER_CLEAR))
                                 for k in range(8)):
        return None                 # a centre at the edge of its ground: half a fan, its outline through the centre
    edge, (lo, hi) = (LITTER_EDGE_FINE, LITTER_RING_FINE) if fine else (LITTER_EDGE, LITTER_RING)
    n = ring_size or max(lo, min(hi, round(math.tau * radius / edge)))
    a1, a2, jitter = LITTER_WOBBLE
    p1, p2, turn = rng.uniform(0., math.tau), rng.uniform(0., math.tau), rng.uniform(0., math.tau)

    def reach(th, r):
        """How far from c along the ray at angle th the ground stays c's own, up to r: probed at LITTER_PROBES of r
        and at least every LITTER_RAY_STEP, then halved between the last probe on it and the first off it."""
        d = (math.cos(th), math.sin(th))
        steps = sorted(set(LITTER_PROBES) | {k * LITTER_RAY_STEP / r for k in range(1, math.ceil(r / LITTER_RAY_STEP))})
        good = 0.
        for f in steps:
            if not same(add(c, d, r * f)):
                low, high = good * r, f * r
                while high - low > LITTER_CUT:
                    mid = (low + high) / 2
                    low, high = (mid, high) if same(add(c, d, mid)) else (low, mid)
                return max(0., low - 1.)    # a centimetre inside the last point found on the ground
            good = f
        return r
    ring = []                       # [angle, radius kept] round c, the angle rising
    for i in range(n):
        th = turn + math.tau * (i + rng.uniform(-.25, .25)) / n
        r = radius * (1. + a1 * math.sin(2. * th + p1) + a2 * math.sin(3. * th + p2))
        if ring_size:
            r += radius * rng.uniform(-jitter, jitter)
        else:                       # by turns out and in, past the jitter, so the edge reads serrated
            r += min(radius * jitter, LITTER_SERRATE_CM / 3) * rng.uniform(-1., 1.)
            r += (1. if i % 2 else -1.) * min(r * rng.uniform(*LITTER_SERRATE), LITTER_SERRATE_CM * rng.uniform(.5, 1.))
        ring.append([th, reach(th, r)])
    point = lambda e: add(c, (math.cos(e[0]), math.sin(e[0])), max(e[1], 4.))   # noqa: E731
    if fine and not ring_size:
        wave = lambda th: radius * (1. + a1 * math.sin(2. * th + p1) + a2 * math.sin(3. * th + p2))  # noqa: E731
        ring = _litter_follow_edges(ring, point, lambda th: reach(th, wave(th)))

    wedges = {}

    def wedge_ok(e, f):
        """The fan's triangle between ring points e and f lies on the same ground: tried on a grid of points no more
        than LITTER_PROBE apart over it (a driveway's dropped curb or a ramp is wider), its centroid and its corners.
        Kept by the two points' places, since the steps below ask again about triangles they did not change."""
        key = (e[0], max(e[1], 4.), f[0], max(f[1], 4.))
        if key not in wedges:
            a, b = point(e), point(f)
            across = max(1, math.ceil(math.dist(a, b) / LITTER_PROBE))
            out = max(1, math.ceil(max(math.dist(c, a), math.dist(c, b)) / LITTER_PROBE))
            mids = [(a[0] + (b[0] - a[0]) * (j / across), a[1] + (b[1] - a[1]) * (j / across))    # lerp(a, b, ...)
                    for j in range(across + 1)]
            points = [(c[0] + (m[0] - c[0]) * (k / out), c[1] + (m[1] - c[1]) * (k / out))    # lerp(c, m, k / out)
                      for m in mids for k in range(1, out + 1)]
            wedges[key] = all(same(q) for q in points + [((c[0] + a[0] + b[0]) / 3, (c[1] + a[1] + b[1]) / 3)])
        return wedges[key]

    def settle(ring):
        """A triangle of the fan that leaves the ground pulls both its outer points in; what still leaves it closes
        up round the centre."""
        n, good = len(ring), set()
        for _ in range(4):
            bad = [i for i in range(n) if i not in good and not wedge_ok(ring[i], ring[(i + 1) % n])]
            good.update(i for i in range(n) if i not in bad)
            for i in bad:
                ring[i][1] *= .6
                ring[(i + 1) % n][1] *= .6
                good.difference_update(((i - 1) % n, (i + 1) % n))
            if not bad:
                break
        for i in range(n):
            if not wedge_ok(ring[i], ring[(i + 1) % n]):
                ring[i][1] = ring[(i + 1) % n][1] = 0.
        return all(wedge_ok(ring[i], ring[(i + 1) % n]) for i in range(n))
    if not settle(ring) or sum(1 for _, r in ring if r >= min(20., .5 * radius)) < 3:
        return None                 # a centre at the very edge of its ground
    if fine and not ring_size:
        def hugs(a, b):
            """Whether the side a-b runs along a change in the ground: every 20 cm along it, a probe out of the patch
            within LITTER_HUG lies off c's ground."""
            length = math.dist(a, b)
            if length < 1.:
                return True
            n = (-(b[1] - a[1]) / length, (b[0] - a[0]) / length)
            m = lerp(a, b, .5)
            if (m[0] - c[0]) * n[0] + (m[1] - c[1]) * n[1] < 0:
                n = (-n[0], -n[1])          # out of the patch
            steps = math.ceil(length / 20.)
            return all(not all(same(add(lerp(a, b, k / steps), n, d)) for d in (4., 8., LITTER_HUG))
                       for k in range(steps + 1))
        for _ in range(3):          # until no side across open ground is longer than LITTER_SIDE (or `side`)
            ring = _litter_respace(c, ring, rng, point, same, wedge_ok, hugs, side, side * LITTER_SPLIT / LITTER_SIDE)
            ring = _litter_straighten(c, ring, point, wedge_ok, hugs)
            if not settle(ring):    # a new triangle the probes of the old ones missed a crack in
                return None
            pts = [point(e) for e in ring]
            if all(math.dist(a, b) <= side or hugs(a, b) for a, b in zip(pts, pts[1:] + pts[:1])):
                break
        else:
            return None             # a side a closed-up triangle left open: try the tree's next spot

        def near_edge(a, b):
            """Whether the run a-b follows a change in the ground: every 20 cm along it, a probe out of the patch
            within LITTER_RUN_NEAR lies off c's ground."""
            length = math.dist(a, b)
            if length < 1.:
                return True
            n = (-(b[1] - a[1]) / length, (b[0] - a[0]) / length)
            m = lerp(a, b, .5)
            if (m[0] - c[0]) * n[0] + (m[1] - c[1]) * n[1] < 0:
                n = (-n[0], -n[1])
            steps = math.ceil(length / 20.)
            return all(not all(same(add(lerp(a, b, k / steps), n, d)) for d in (5., 10., 15., LITTER_RUN_NEAR))
                       for k in range(steps + 1))
        for _ in range(2):          # again where settling pulled points in
            ring = _litter_break_runs(c, ring, rng, point, same, wedge_ok, near_edge, side)
            before = [e[1] for e in ring]
            if not settle(ring):
                return None
            if before == [e[1] for e in ring]:
                break
    pts = [point(e) for e in ring]
    if not ring_size and abs(area(pts)) < LITTER_THIN * 2. * max(math.dist(c, q) for q in pts):
        return None                 # a sliver along the edge of its ground
    if abs(area(pts)) < LITTER_SMALL:
        # a scrap the edge of its ground cuts: probed along the rays from its centre (a clump's, the mean of its
        # corners, as the fan is read back) through its points and the middles of its sides
        o = (sum(q[0] for q in pts) / 4, sum(q[1] for q in pts) / 4) if len(pts) == 4 else c
        for q in pts + [lerp(a, b, .5) for a, b in zip(pts, pts[1:] + pts[:1])]:
            d = math.dist(o, q) or 1.
            if not all(same(add(q, ((q[0] - o[0]) / d, (q[1] - o[1]) / d), step)) for step in LITTER_SMALL_PROBE):
                return None
    if len(pts) == 4:               # a clump, drawn as a quad: its two triangles' centres on the ground too
        a, b, q, d = _quad_order(pts)
        if not all(same(((t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3))
                   for t in ((a, b, q), (a, q, d))):
            return None
    return c, pts, z0


def litter_spoke(e, f, point):
    """Whether the side between ring points e and f (f after e) runs out from the centre: longer than LITTER_SPOKE_MIN
    and closer to the ray through its middle angle than LITTER_SPOKE (|cos|)."""
    a, b = point(e), point(f)
    length = math.dist(a, b)
    th = e[0] + ((f[0] - e[0]) % math.tau) / 2.
    return length > LITTER_SPOKE_MIN and \
        abs((b[0] - a[0]) * math.cos(th) + (b[1] - a[1]) * math.sin(th)) > LITTER_SPOKE * length


def _litter_follow_edges(ring, point, ray):
    """A side of the raw outline that runs out from the centre, where an edge of the ground (a curb, a lawn's edge)
    passes the fan at a grazing angle and cuts one ray short beside one that it does not, is a straight spoke: the
    later steps move points along their rays, which runs along such a side and cannot serrate it. Rays are added in
    it (ray(angle) gives the reach), halving the angle up to LITTER_SPOKE_DEPTH times while the side is longer than
    LITTER_SIDE, so the outline follows the edge that cut the short ray and then the patch's own wavy rim."""
    def fill(e, f, depth):
        a, b = point(e), point(f)
        length = math.dist(a, b)
        if depth >= LITTER_SPOKE_DEPTH or length <= LITTER_SIDE:
            return []
        th = (e[0] + f[0]) / 2.
        if abs((b[0] - a[0]) * math.cos(th) + (b[1] - a[1]) * math.sin(th)) / length < LITTER_SPOKE:
            return []
        g = [th, ray(th)]
        return fill(e, g, depth + 1) + [g] + fill(g, f, depth + 1)
    out = []
    for i, e in enumerate(ring):
        f = ring[(i + 1) % len(ring)]
        out.append(e)
        out += fill(e, [f[0] + (math.tau if i == len(ring) - 1 else 0.), f[1]], 0)
    return out


def litter_runs(pts, open_side=None, length=LITTER_RUN):
    """The straight runs of an outline of short sides over open ground: (i, j) where sides i to j (side k joins point k
    to k + 1) are all open (open_side(k), default all) and keep side i's heading within LITTER_RUN_TURN, spanning
    `length` (LITTER_RUN) or more."""
    n = len(pts)
    heading = [math.atan2(pts[(i + 1) % n][1] - pts[i][1], pts[(i + 1) % n][0] - pts[i][0]) for i in range(n)]
    is_open = [open_side(i) if open_side else True for i in range(n)]
    limit, out, done = math.radians(LITTER_RUN_TURN), [], set()
    for i in range(n):
        if i in done or not is_open[i]:
            continue
        j = i
        while j - i < n - 1 and is_open[(j + 1) % n] and \
                abs((heading[(j + 1) % n] - heading[i] + math.pi) % math.tau - math.pi) <= limit:
            j += 1
        if math.dist(pts[i], pts[(j + 1) % n]) >= length:
            out.append((i, j))
            done.update(k % n for k in range(i, j + 1))
    return out


def litter_chords(pts, length=LITTER_CHORD, dev=LITTER_CHORD_DEV, every=False):
    """The straight chains of a closed outline: (i, j) where the points i to j + 1 (sides i to j) all lie within dev
    of the line from point i to point j + 1, between its ends, and the ends lie `length` or more apart. Each chain is
    grown from its first point until a point leaves the line, and the longest is kept (every one, with every)."""
    n, out = len(pts), []
    for i in range(n):
        best = None
        for k in range(1, n):
            a, b = pts[i], pts[(i + k) % n]
            span = math.dist(a, b)
            if span < 1.:
                break
            u = ((b[0] - a[0]) / span, (b[1] - a[1]) / span)
            if any(abs((q[0] - a[0]) * u[1] - (q[1] - a[1]) * u[0]) > dev or
                   not -dev <= (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1] <= span + dev
                   for q in (pts[(i + m) % n] for m in range(1, k))):
                break
            if span >= length:
                best = k
                if every:
                    out.append((i, i + k - 1))
        if best and not every:
            out.append((i, i + best - 1))
    return out


def litter_open_run(a, b, same):
    """The longest stretch of the line a-b (cm, probed every 20 cm) with no change in the ground (same(p) false)
    within LITTER_RUN_NEAR either side of it: 0 for one such probe, -1 for none."""
    length = math.dist(a, b)
    if length < 1.:
        return -1.
    n = (-(b[1] - a[1]) / length, (b[0] - a[0]) / length)
    steps = math.ceil(length / 20.)
    best = run = 0
    for k in range(steps + 1):
        p = lerp(a, b, k / steps)
        run = run + 1 if all(same(add(p, n, s * d)) for d in (5., 10., 15., LITTER_RUN_NEAR) for s in (1., -1.)) else 0
        best = max(best, run)
    return (best - 1) * length / steps if best else -1.


def litter_points_out(a, b, c):
    """Whether the line a-b lies closer to the ray from c through its middle than LITTER_SPOKE (|cos|)."""
    m = lerp(a, b, .5)
    length, reach = math.dist(a, b), math.dist(c, m)
    return length > 1. and reach > 1. and \
        abs((b[0] - a[0]) * (m[0] - c[0]) + (b[1] - a[1]) * (m[1] - c[1])) > LITTER_SPOKE * length * reach


def litter_flawed(ground, c, pts, z0, open_side=LITTER_OPEN_SIDE):
    """Whether a fine patch's outline leaves a straight cut over open ground: a side over open_side that leaves
    a change in the ground (none within LITTER_RUN_NEAR either side) anywhere along it, a run of short sides that keep
    their heading (litter_runs), or a straight run (litter_chords) over LITTER_CHORD of it. A run that points out from
    the centre c (litter_points_out) is the shadow of something near c the fan cannot see past; no move along the rays
    can serrate it."""
    same = lambda p: (lambda z: z is not None and abs(z - z0) < .05)(ground.at(p))   # noqa: E731
    n = len(pts)
    if any(math.dist(a, b) > open_side and litter_open_run(a, b, same) >= 0.
           for a, b in zip(pts, pts[1:] + pts[:1])):
        return True
    if litter_runs(pts, None, LITTER_RUN - LITTER_RUN_MARGIN) and litter_runs(
            pts, lambda k: litter_open_run(pts[k], pts[(k + 1) % n], same) >= 0., LITTER_RUN - LITTER_RUN_MARGIN):
        return True
    return any(litter_open_run(pts[i], pts[(j + 1) % n], same) >= LITTER_CHORD
               for i, j in litter_chords(pts, every=True))


def _litter_break_runs(c, ring, rng, point, same, wedge_ok, near_edge, side=LITTER_SIDE):
    """Midpoint displacement for the straight runs of a fine patch's outline (Fournier, Fussell and Carpenter,
    "Computer Rendering of Stochastic Models", CACM 1982): the points inside a run of short sides over open ground
    move along their rays by turns out and in by LITTER_RUN_SHIFT, so the run breaks into teeth too big to read as one
    straight edge. A point goes out only where the ground carries on and its two triangles stay on it; otherwise it
    goes in, which keeps its triangles inside the old ones, never below LITTER_RUN_KEEP of its radius. A side along a
    change in the ground (near_edge) is not part of a run, a point at the end of a side over LITTER_SIDE (or `side`,
    one that follows such a change) stays put, and no move makes a side longer than that. A chain of points that all
    stay within LITTER_CHORD_DEV of one straight line over LITTER_CHORD of open ground (litter_chords) is a run too,
    whatever its sides' headings. A run that still stands then gets a displaced midpoint in each of its sides, as the
    method subdivides a segment."""
    def fits(*chain):
        return all(math.dist(point(a), point(b)) <= side for a, b in zip(chain, chain[1:]))

    def displace(e, before, after, outward, shift):
        """Move e along its ray: out when outward and the ground allows it, else in. Returns whether it moved."""
        d = (math.cos(e[0]), math.sin(e[0]))
        old = e[1]
        if outward and same(add(c, d, old + shift / 2)) and same(add(c, d, old + shift + 2.)):
            e[1] = old + shift
            if fits(before, e, after) and wedge_ok(before, e) and wedge_ok(e, after):
                return True
        e[1] = max(old * LITTER_RUN_KEEP, old - shift)
        if fits(before, e, after):
            return True
        e[1] = old
        return False
    for attempt in range(6):
        pts = [point(e) for e in ring]
        n = len(ring)
        runs = litter_runs(pts, lambda i: not near_edge(pts[i], pts[(i + 1) % n]), LITTER_RUN - LITTER_RUN_MARGIN)
        # a straight run that points out from the centre is left to tree_litter: moves along the rays run along it
        runs += [(i, j) for i, j in litter_chords(pts) if (i, j) not in runs and
                 not litter_points_out(pts[i], pts[(j + 1) % n], c) and
                 litter_open_run(pts[i], pts[(j + 1) % n], same) >= LITTER_CHORD]
        if not runs or attempt == 5:
            break
        if attempt < 3:
            moved = set()
            for i, j in runs:
                out_first = rng.random() < .5
                for m, k in enumerate(range(i + 1, j + 1)):
                    k %= n
                    before, after = ring[(k - 1) % n], ring[(k + 1) % n]
                    shift = rng.uniform(*LITTER_RUN_SHIFT)
                    if k not in moved and fits(before, ring[k], after):
                        moved.add(k)
                        displace(ring[k], before, after, (m % 2 == 0) == out_first, shift)
            continue
        # The runs left: a displaced midpoint in each of their sides, inserted from the last side back. A side that
        # runs out from the centre gets none: its midpoint would move along it.
        sides = sorted({k % n for i, j in runs for k in range(i, j + 1)}, reverse=True)
        out_first = rng.random() < .5
        for m, k in enumerate(sides):
            e, f = ring[k], ring[(k + 1) % n]
            a, b = point(e), point(f)
            q = lerp(a, b, .5)
            if math.dist(a, b) < 1. or abs((b[0] - a[0]) * (q[0] - c[0]) + (b[1] - a[1]) * (q[1] - c[1])) > \
                    LITTER_SPOKE * math.dist(a, b) * max(1., math.dist(c, q)):
                continue
            th = e[0] + (math.atan2(q[1] - c[1], q[0] - c[0]) - e[0] + math.pi) % math.tau - math.pi
            mid = [th, math.dist(c, q)]
            if litter_spoke(e, mid, point) or litter_spoke(mid, f, point):
                continue            # a side that passes near the centre: its halves would run out from it
            displace(mid, e, f, (m % 2 == 0) == out_first, rng.uniform(*LITTER_RUN_SHIFT))
            ring.insert(k + 1, mid)
    return ring


def _litter_straighten(c, ring, point, wedge_ok, hugs):
    """Leave out a ring point that lies within LITTER_CUT of the side joining its neighbours where that side runs
    along a change in the ground: a straight side along a curb, a lawn's edge or a fence foot needs only its ends."""
    i = 0
    while i < len(ring) and len(ring) > 6:
        e, f, g = ring[i - 1], ring[i], ring[(i + 1) % len(ring)]
        a, q, b = point(e), point(f), point(g)
        turn = (g[0] - e[0]) % math.tau
        if 0. < turn < math.pi and seg_dist(q, a, b) <= LITTER_CUT + 1. and hugs(a, b) and wedge_ok(e, g):
            del ring[i]
            i = max(0, i - 1)
        else:
            i += 1
    return ring


def _litter_respace(c, ring, rng, point, same, wedge_ok, hugs, side=LITTER_SIDE, split=LITTER_SPLIT):
    """A fine patch's outline after its cut back to the ground: every side across open ground longer than `side`
    (LITTER_SIDE) split into pieces about `split` (LITTER_SPLIT) long. Each new point lies on the side's ray from c and stands by turns out
    and in by LITTER_TEETH; one out that would leave the ground, or whose triangles would, goes back onto the side,
    which lies in a triangle already on the ground. A side whose every point lies within LITTER_HUG of a change in
    the ground (a curb, a lawn's edge, a fence foot) stays straight."""
    out = []
    for i, e in enumerate(ring):
        f = ring[(i + 1) % len(ring)]
        out.append(e)
        a, b = point(e), point(f)
        length = math.dist(a, b)
        if length <= side or hugs(a, b):
            continue
        pieces = math.ceil(length / split)
        flip = rng.random() < .5
        new = []
        for k in range(1, pieces):
            q = lerp(a, b, k / pieces)
            th = e[0] + (math.atan2(q[1] - c[1], q[0] - c[0]) - e[0] + math.pi) % math.tau - math.pi
            on = math.dist(c, q)
            tooth = rng.uniform(*LITTER_TEETH)
            d = (math.cos(th), math.sin(th))
            if (k % 2 == 1) != flip:        # out, where the ground carries on past the side
                r = on + tooth if same(add(q, d, tooth / 2)) and same(add(q, d, tooth + 1.)) else on
            else:
                r = max(4., on - tooth)
            new.append([th, r, on])
        for _ in range(2):          # out points whose triangles leave the ground go back onto the side
            chain = [e] + new + [f]
            moved = False
            for k in range(len(chain) - 1):
                if not wedge_ok(chain[k], chain[k + 1]):
                    for g in (chain[k], chain[k + 1]):
                        if len(g) == 3 and g[1] > g[2]:
                            g[1], moved = g[2], True
            if not moved:
                break
        out += [[th, r] for th, r, _ in new]
    return out


def ring_gap(a, b):
    """The gap (cm) between two outlines: 0 where they overlap, else the nearest distance between their sides."""
    if any(point_in(p, b) for p in a) or any(point_in(p, a) for p in b):
        return 0.
    return min(seg_seg_dist(p, q, r, s) for p, q in zip(a, a[1:] + a[:1]) for r, s in zip(b, b[1:] + b[:1]))


def _fan_corner(ring, on_ground):
    """The ring started at a corner that sees every other corner (each triangle of a fan from it turns the ring's
    way), so the fan from there covers it in two triangles fewer than one from its centre; None when no corner does.
    The centre fan's triangles were probed on the ground (litter_patch), these were not: each one's middle and the
    middle of each new side from the corner must lie on it too (on_ground)."""
    sign = 1. if area(ring) > 0 else -1.
    for i in range(len(ring)):
        pts = list(ring[i:]) + list(ring[:i])
        if all(sign * _cross(pts[0], pts[j], pts[j + 1]) > 1. for j in range(1, len(pts) - 1)) and \
                all(on_ground(((pts[0][0] + pts[j][0] + pts[j + 1][0]) / 3, (pts[0][1] + pts[j][1] + pts[j + 1][1]) / 3))
                    for j in range(1, len(pts) - 1)) and \
                all(on_ground(lerp(pts[0], pts[j], .5)) for j in range(2, len(pts) - 1)):
            return pts
    return None


def litter_fringe(ground, c, ring, rng, z0=None, spec=LITTER_FRINGE, sizes=LITTER_FRINGE_SIZE, gap=None):
    """Small clumps of leaves just outside a fine patch's edge (LITTER_FRINGE): one per LITTER_FRINGE[2] cm of outline,
    each LITTER_FRINGE_RING points round, at a seeded point of the outline, out to LITTER_FRINGE_OUT of the patch's
    radius beyond it, fewer and smaller the further out (a power law on the distance, the size shrinking from
    LITTER_FRINGE_SIZE[1] to [0]), on whatever flat ground is there (only the patch's own with z0). The leaves thin out
    clump by clump toward the drip line instead of stopping at one edge. With a gap (cm), the spread out from the edge
    is scaled down so the clumps keep within it of the patch, one that still lies further out or wholly under the
    patch is left out, and each clump comes with its size as a fourth item (tree_litter lays them last)."""
    mean = sum(math.dist(c, q) for q in ring) / len(ring)
    outline = sum(math.dist(a, b) for a, b in zip(ring, ring[1:] + ring[:1]))
    lo, hi, every = spec
    out = []
    for _ in range(max(lo, min(hi, round(outline / every)))):
        e = ring[rng.randint(0, len(ring) - 1)]
        d = math.dist(c, e) or 1.
        u = ((e[0] - c[0]) / d, (e[1] - c[1]) / d)
        t = rng.random() ** 2. * LITTER_FRINGE_OUT
        size = (sizes[1] + (sizes[0] - sizes[1]) * t / LITTER_FRINGE_OUT) * rng.uniform(.85, 1.05)
        out_cm = t * mean if gap is None else t * min(1., gap / (LITTER_FRINGE_OUT * mean)) * mean
        clump = litter_patch(ground, add(e, u, out_cm + .6 * size), size, rng, z0, LITTER_FRINGE_RING)
        if clump and gap is not None:
            if ring_gap(clump[1], ring) > gap or all(point_in(q, ring) for q in clump[1]):
                clump = None
            else:
                clump += (size,)
        out += [clump] if clump else []
    return out


def tree_litter(world, S, crowns, ground, counts):
    """Fallen leaves under every street and park crown: a patch whose area is the crown's ground (radius R) times the
    share of the leaves down, round the trunk, or round a seeded spot under the crown when the trunk stands on no flat
    ground (a pond edge, a path). Under a tree on a street's sidewalk or lawn, seen from close by, the patch is fine
    (litter_patch) and a fringe of small clumps lies outside it (litter_fringe), on whatever flat ground is there (the
    park lawn beside a sidewalk, a parterre), so the litter thins out rather than ending at one edge. In a grove, a
    main patch that would lie inside one already drawn is left out. The Plex yard trees stand on the Plex yards, which
    keep their own ground; where one's crown reaches over a ruelle, its leaves lie on the ruelle's paving under it
    (lane_litter). Returns the per-kind record: trees, fallen share, cover, patches, trees covered by a neighbour's
    patch, trees with no flat ground, crown, target and drawn area; and the ruelles' record."""
    kinds, drawn, grid = {}, [], Grid(1500.)
    world.lane_patches = getattr(world, 'lane_patches', [])

    def covered(c, r, z0):
        return any(dz == z0 and dr >= .8 * r and math.dist(c, dc) <= LITTER_COVERED * dr
                   for dc, dr, dz in (drawn[i] for i in grid.query((c[0], c[1], c[0], c[1]))))

    lane_z = Z_ALLEY + LITTER_LANE

    def note(c, ring, z0):
        if abs(z0 - lane_z) < .01 and len(ring) > LITTER_FRINGE_RING:
            world.lane_patches.append((c, ring, z0))      # the gutter beside it gets leaves too
        grid.add(len(drawn), bbox([c], max(math.dist(c, q) for q in ring)))
        drawn.append((c, sum(math.dist(c, q) for q in ring) / len(ring), z0))

    def draw(c, ring, z0, rec, corner=None):
        """A patch or clump's faces: a four-point clump as a quad, a ring drawn from a corner that sees the others
        (corner, the ring started there) as a fan from it, any other as a fan from its centre."""
        counts['litter_triangles'] += _litter_quad(S, ring, z0) if len(ring) == LITTER_FRINGE_RING else \
            _litter_face(S, corner, z0) if corner else _litter_face(S, [c] + ring + [ring[0]], z0)
        rec['drawn_m2'] += abs(area(ring)) / 1e4
        rec['patches'] += 1
        counts['litter_patches'] += 1

    def lay(patches, rec):
        for c, ring, z0 in patches:
            note(c, ring, z0)
            draw(c, ring, z0, rec)
    # A street patch's clumps are drawn after every street patch is laid: one hidden under any patch is left out, and
    # one apart from all of them is laid again with LITTER_CLUMP_RING points (its own seed, so the other clumps keep
    # theirs), so no four-point clump lies alone on open ground and reads as a diamond.
    street_rings, street_grid, fringe = [], Grid(1000.), []
    lanes = {'trees': 0, 'patches': 0, 'drawn_m2': 0.}
    lane_rings, lane_grid = [], Grid(500.)

    def on_lane_litter(p):
        return any(point_in(p, lane_rings[i]) for i in lane_grid.query((p[0], p[1], p[0], p[1])))
    for x, y, z, radius, base, top, fallen, kind, source in crowns.items:
        cover = min(LITTER_COVER, LITTER_GAIN * fallen)
        if source == 'yard':
            patches = lane_litter(world, ground, (x, y), radius, cover, on_lane_litter)
            lanes['trees'] += bool(patches)
            lay(patches, lanes)
            for _, ring, _ in patches:
                lane_grid.add(len(lane_rings), bbox(ring))
                lane_rings.append(ring)
            continue
        rec = kinds.setdefault(kind, {'trees': 0, 'fallen': round(fallen, 3), 'cover': 0., 'patches': 0,
                                      'trees_covered': 0, 'trees_without_ground': 0, 'crown_m2': 0., 'target_m2': 0.,
                                      'drawn_m2': 0.})
        rec['trees'] += 1
        rec['cover'] = round(cover, 3)
        rec['crown_m2'] += math.pi * radius ** 2 / 1e4
        target = cover * math.pi * radius ** 2
        rec['target_m2'] += target / 1e4
        if target < 100.:
            continue
        rng = Rng('litter', source)          # a street tree's source is its street_trees.json id
        spots = [(x, y)] + [add((x, y), (math.cos(a), math.sin(a)), radius * .4)
                            for a in (rng.uniform(0., math.tau) + k * math.tau / 5 for k in range(5))]
        patch, skip, fine = None, False, False
        for c in spots:
            z0 = ground.at(c)
            if z0 is None:
                continue
            fine = ground.on_streets(c)
            # in the park, one patch, the grove's carpet: fine with a fringe near a street, coarse farther in
            near = not fine and ground.street_distance(c, LITTER_PARK_NEAR) is not None
            main = math.sqrt(target / math.pi)
            skip = covered(c, main, z0)
            # a trunk on a ruelle's paving drops its leaves there as a yard tree's do (lane_litter)
            side, open_side = (LANE_SIDE, LANE_OPEN_SIDE) if abs(z0 - lane_z) < .01 else (LITTER_SIDE, LITTER_OPEN_SIDE)
            patch = None if skip else litter_patch(ground, c, main, rng, z0, fine=fine or near, side=side)
            if patch and (fine or near):
                patch = _litter_unflawed(ground, patch, main, rng, side, open_side)
            if patch or skip:
                break
        if patch is None and not skip:
            rec['trees_without_ground'] += 1
            counts['litter_trees_without_ground'] += 1
            continue
        rec['trees_covered'] += skip
        patches = [patch] if patch else []
        if patch and near and not fine:     # the park's carpet thins out clump by clump onto the lawn too
            patches += litter_fringe(ground, patch[0], patch[1], rng, patch[2], LITTER_PARK_FRINGE, LITTER_PARK_CLUMP)
        lay(patches, rec)
        if patch and fine:
            street_grid.add(len(street_rings), bbox(patch[1]))
            street_rings.append(patch[1])
            for clump in litter_fringe(ground, patch[0], patch[1], rng, gap=LITTER_FRINGE_GAP):
                note(*clump[:3])
                fringe.append((rec, clump, patch[1]))
    for rec, (c, ring, z0, size), own in fringe:
        near = [street_rings[k] for k in street_grid.query(bbox(ring))]
        if any(all(point_in(q, other) for q in ring) for other in near):
            continue                        # hidden under a patch
        corner = None
        if all(ring_gap(ring, other) > 0. for other in near):
            clump = litter_patch(ground, c, size, Rng('litter_clump', round(c[0]), round(c[1])), None, LITTER_CLUMP_RING)
            if not clump or ring_gap(clump[1], own) > LITTER_FRINGE_GAP:
                continue
            c, ring, z0 = clump
            floor = ground.at(c)
            corner = _fan_corner(ring, lambda q: (lambda z: z is not None and abs(z - floor) < .05)(ground.at(q)))
        draw(c, ring, z0, rec, corner)
    for rec in list(kinds.values()) + [lanes]:
        for key in ('crown_m2', 'target_m2', 'drawn_m2'):
            if key in rec:
                rec[key] = round(rec[key], 1)
    counts['litter_lane_trees'] = lanes['trees']
    return dict(sorted(kinds.items())), lanes


def _litter_unflawed(ground, patch, radius, rng, side=LITTER_SIDE, open_side=LITTER_OPEN_SIDE):
    """A fine patch whose outline has a straight cut over open ground (litter_flawed) is laid again: round the middle
    of what it covers, where it wraps round what cut it rather than seeing past it from the trunk, then smaller
    (LITTER_SHRINK), until one has none. Failing that, the patch is left out (None), and its fringe with it."""
    best = patch
    for scale in (1.,) + LITTER_SHRINK:
        if best and not litter_flawed(ground, *best, open_side):
            return best
        centre = polygon_centroid(patch[1])
        best = litter_patch(ground, centre, radius * scale, rng, patch[2], fine=True, side=side)
    return best if best and not litter_flawed(ground, *best, open_side) else None


LANE_SAMPLES = 120              # points of a yard crown's disc tried for the ruelle paving under it
LANE_PATCH = (100., 260.)       # a lane patch's radius (cm): the gutter and the fence cut it to a band along the lane,
LANE_MID = (GUTTER_HALF + 70., 160.)   # their sides straight and cheap; its centre this far from the centre line
LANE_TRIES = 16                 # patches tried per half-lane under a crown
LANE_SIDE = 80.                 # a lane patch's side across the open paving is split from this long (cm): seen
                                # down the lane from a low eye, a street patch's 1.2 m reads as a cut across it
LANE_OPEN_SIDE = 90.            # and a lane patch with one over this left after its steps is not laid (test: 100)


def lane_litter(world, ground, trunk, radius, cover, covered=None):
    """The leaves a Plex yard tree drops on a ruelle: where its crown reaches over the lane's paving, fine patches on
    each half of the lane it covers (the sunken gutter between them keeps its own drifts), laid one after another along
    the half-lane until they cover the paving under the crown times the cover of its kind (sampled on LANE_SAMPLES
    points of the crown's disc). Each next patch is centred on the half-lane's middle beside the uncovered paving
    nearest the trunk, so the leaves lie thickest on the tree's side and thin out along the lane. Paving another
    crown's leaves already cover (`covered`) counts toward the cover. A fringe of clumps lies outside the run (the
    clumps that would fall inside one of its patches are left out). Returns the patches."""
    hit = ground.alleys.nearest(trunk, radius + ALLEY_HALF + 100.)
    if hit is None or hit[0] - ALLEY_HALF - 100. > radius:
        return []
    rng = Rng('litter-lane', round(trunk[0]), round(trunk[1]))
    lane_z = Z_ALLEY + LITTER_LANE
    halves = {}
    for k in range(LANE_SAMPLES):
        # a sunflower spread over the crown's disc: even cover with no seeded draws
        r = radius * math.sqrt((k + .5) / LANE_SAMPLES)
        th = k * 2.39996323
        q = (trunk[0] + r * math.cos(th), trunk[1] + r * math.sin(th))
        z = ground.at(q)
        own = ground.alleys.nearest(q, ALLEY_HALF + LOT_PAVE)
        if z is None or abs(z - lane_z) > .05 or own is None:
            continue
        _, alley, a, b = own          # the half of its own ruelle stretch the sample lies on
        u, _ = unit(a, b)
        side = 1 if (q[0] - a[0]) * -u[1] + (q[1] - a[1]) * u[0] >= 0 else -1
        halves.setdefault((alley, a, b, side), []).append(q)
    out = []
    cell = math.pi * radius ** 2 / LANE_SAMPLES
    for (_, a, b, side), points in sorted(halves.items()):
        u, _ = unit(a, b)
        n = (-u[1], u[0])
        want = cover * len(points)
        if want * cell < 2500.:
            continue
        laid, tried = [], set()
        inside = {j for j, p in enumerate(points) if covered and covered(p)}
        for _ in range(LANE_TRIES):
            left = [k for k in range(len(points)) if k not in inside and k not in tried]
            if len(inside) >= want or not left:
                break
            k = min(left, key=lambda k: (math.dist(points[k], trunk), k))
            tried.add(k)
            q = points[k]
            along = (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1]
            lat = abs((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1])
            r = max(LANE_PATCH[0], min(LANE_PATCH[1], math.sqrt((want - len(inside)) * cell / math.pi)))
            patch = None
            # the half-lane's middle beside q, else nearer the gutter or q itself where the paving is narrow
            for off in (max(LANE_MID[0], min(lat, LANE_MID[1])), LANE_MID[0], lat):
                centre = add(add(a, u, along), n, side * off)
                z = ground.at(centre)
                if z is not None and abs(z - lane_z) < .05:
                    patch = litter_patch(ground, centre, r, rng, z, fine=True, side=LANE_SIDE)
                    patch = patch if patch and not litter_flawed(ground, *patch, LANE_OPEN_SIDE) else None
                if patch:
                    break
            if patch is None:
                continue
            laid.append(patch)
            inside |= {j for j, p in enumerate(points) if point_in(p, patch[1])}
        out += laid
        for patch in laid:
            out += [clump for clump in litter_fringe(ground, patch[0], patch[1], rng)
                    if not any(point_in(clump[0], other[1]) for other in laid)]
    return out


def leaves_over(crowns, p):
    """How much leaf fall reaches p: the fallen shares of the crowns over it, each weighted by how near p stands to
    its trunk (1 at the trunk, 0 at the drip line), at most 1."""
    total = 0.
    for x, y, z, radius, base, top, fallen, _, _ in crowns.near(p):
        d = math.dist(p[:2], (x, y))
        if d < radius:
            total += fallen * (1. - d / radius)
    return min(1., total)


def _curb_drift(world, S, s, side, sign, x, run, width, rng):
    """Leaves drifted against a curb: a fan from the middle of its foot, the curb side straight 1 cm off the curb face,
    the street side a ragged bulge up to `width` cm out, at Z_LITTER_ROAD. Only on the replica asphalt (not where a
    curb extension, a dropped curb or the end of the drawn street takes its place). Returns its area (cm2) and
    triangles, both 0 when it is not drawn."""
    curb = s['curb' + side] - 1.
    k = max(3, int(run / 70.))
    out = []
    for i in range(k, -1, -1):
        f = i / k
        w = 3. + width * math.sin(math.pi * f) ** .6 * (rng.uniform(.7, 1.2) if 0 < i < k else .2)
        out.append(seg_point(s, x + run * f + (rng.uniform(-10., 10.) if 0 < i < k else 0.), sign * (curb - w)))
    pts = [seg_point(s, x + run / 2, sign * curb), seg_point(s, x + run, sign * curb)] + out + \
        [seg_point(s, x, sign * curb)]
    if not all(world.surfaces.at(q) == (Z_ROAD, 'road') for q in pts + [lerp(a, b, .5) for a, b in zip(pts, pts[1:])]) \
            or not all(world.surfaces.at(seg_point(s, x + run * f, sign * (curb + 10.)))[1] in ('sidewalk', 'apron')
                       for f in (0., .25, .5, .75, 1.)):
        return 0., 0                # off the asphalt, or with no curb to drift against
    tris = _litter_face(S, pts, Z_LITTER_ROAD)
    return abs(area(pts)), tris


GUTTER_BESIDE = 12.     # a lane patch whose outline comes this near (cm) the gutter's edge lies along the gutter
GUTTER_BESIDE_SHARE = .5    # ... and a gutter drift runs beside at least this share of that stretch,
GUTTER_BESIDE_PIECE = 100.  # its ragged edge in pieces this long (a curb drift's are 60 cm; these pay for themselves)


def _alley_pieces_index(world):
    pieces, grid = getattr(world, 'alley_pieces', []), Grid(2000.)
    for i, (poly, _) in enumerate(pieces):
        grid.add(i, bbox(poly))

    def own(p, seg):
        return world.surfaces.at(p)[1] == 'alley' and all(
            pieces[i][1] == seg for i in grid.query((p[0], p[1], p[0], p[1])) if point_in(p, pieces[i][0]))
    return own


def gutter_paved(own, pa, pb, x, run, steps):
    """Whether the ruelle's own paving lies on its gutter from x to x + run along the stretch pa-pb (not a mouth under
    a street's asphalt or a sidewalk, a building, or another ruelle's paving), tried at 2 * steps + 1 points along
    it, on the gutter's centre line and both edges."""
    u, _ = unit(pa, pb)
    n = (-u[1], u[0])
    return all(own(add(add(pa, u, x + run * k / (2 * steps)), n, lat), (pa, pb))
               for k in range(2 * steps + 1) for lat in (-GUTTER_HALF, 0., GUTTER_HALF))


def _gutter_drift(S, own, pa, pb, x, run, rng, piece=60.):
    """One drift of leaves in a ruelle's gutter from x to x + run along the stretch pa-pb: up to 32 cm across with a
    ragged edge in pieces about `piece` long, in the gutter's V LITTER_LIFT over it, only where the ruelle's own paving
    lies on top. Returns its triangles and area (cm2), both 0 where it is not drawn."""
    u, _ = unit(pa, pb)
    n = (-u[1], u[0])
    steps = max(2, int(run / piece))
    peak = rng.uniform(7., GUTTER_HALF - 2.)
    sides = [[max(2., math.sin(math.pi * k / steps) * peak * rng.uniform(.6, 1.15) + 2.)
              for k in range(steps + 1)] for _ in (0, 1)]
    sides[0][0] = sides[0][-1] = sides[1][0] = sides[1][-1] = 2.

    def at(t, lat):
        p = add(add(pa, u, t), n, lat)
        return (p[0], p[1], gutter_z(lat) + LITTER_LIFT)
    paved = gutter_paved(own, pa, pb, x, run, steps)
    quads = [[at(t0, 0.), at(t1, 0.), at(t1, sgn * w[k + 1]), at(t0, sgn * w[k])]
             for k in range(steps) for t0, t1 in [(x + run * k / steps, x + run * (k + 1) / steps)]
             for sgn, w in ((1., sides[0]), (-1., sides[1]))]
    if not paved or not all(own(q[:2], (pa, pb)) for quad in quads for q in quad):
        return 0, 0.                # a joint's wedge over the gutter between the probes hides a corner
    tris, drawn = 0, 0.
    for quad in quads:
        tris += _litter_face(S, quad)
        drawn += abs(area([q[:2] for q in quad]))
    return tris, drawn


def _gutter_drifts(world, S, counts, crowns):
    """Fallen leaves drifted into the ruelles' centre gutters: runs of 1 to 4.5 m along a third of each stretch, more
    under the yard trees' crowns, up to 32 cm across with a ragged edge, lying in the gutter's V LITTER_LIFT over it, only where the ruelle's own
    paving lies on top (not at a mouth under a street's asphalt or a sidewalk, under a building, or where another
    ruelle's paving, or the next stretch's at a bend, crosses it). The drawn stretches are kept (world.gutter_spans)
    for the drifts beside the lane patches (_gutter_beside_patches)."""
    counts.setdefault('ruelle_gutter_leaf_drifts', 0)
    drawn = 0.
    own = _alley_pieces_index(world)
    world.gutter_spans = {}
    for alley in getattr(world, 'alleys', []):
        for pa, pb in alley['segments']:
            u, length = unit(pa, pb)
            rng = Rng('gutter-leaves', alley['id'], round(pa[0]), round(pa[1]))
            x = rng.uniform(0., 500.)
            while x < length - 120.:
                run = min(rng.uniform(100., 450.), length - 20. - x)
                fall = leaves_over(crowns, add(pa, u, x + run / 2))
                if run > 60. and (rng.chance(RUELLE_DRIFT[0] + RUELLE_DRIFT[1] * fall) or fall >= RUELLE_UNDER):
                    tris, area_ = _gutter_drift(S, own, pa, pb, x, run, rng)
                    counts['litter_triangles'] += tris
                    drawn += area_
                    counts['ruelle_gutter_leaf_drifts'] += tris > 0
                    if tris:
                        world.gutter_spans.setdefault((pa, pb), []).append((x, x + run))
                x += run + rng.uniform(150., 700.)
    return drawn / 1e4


def _gutter_beside_patches(world, S, counts, patches):
    """Where a lane patch's leaves stop at the ruelle's gutter, the gutter carries leaves too: the gutter is the lane's
    low line, where the leaves collect. Each lane patch whose outline comes within GUTTER_BESIDE of the gutter's edge
    over 60 cm or more gets a drift in the gutter beside that stretch, unless drifts already run beside
    GUTTER_BESIDE_SHARE of it. Returns the area drawn (m2)."""
    counts.setdefault('ruelle_gutter_drifts_beside_patches', 0)
    own = _alley_pieces_index(world)
    spans = getattr(world, 'gutter_spans', {})
    index = AlleyIndex(world)
    drawn = 0.
    for c, ring, _ in patches:
        hit = index.nearest(c, ALLEY_HALF + 100.)
        if hit is None:
            continue
        _, alley, pa, pb = hit
        u, length = unit(pa, pb)
        n = (-u[1], u[0])
        near = [(q[0] - pa[0]) * u[0] + (q[1] - pa[1]) * u[1] for q in ring
                if abs((q[0] - pa[0]) * n[0] + (q[1] - pa[1]) * n[1]) <= GUTTER_HALF + GUTTER_BESIDE]
        if len(near) < 2 or max(near) - min(near) < 60.:
            continue
        t0, t1 = max(20., min(near) - 20.), min(length - 20., max(near) + 20.)
        if t1 - t0 < 60.:
            continue
        covered = sum(max(0., min(t1, b) - max(t0, a)) for a, b in spans.get((pa, pb), ()))
        if covered >= GUTTER_BESIDE_SHARE * (t1 - t0):
            continue
        rng = Rng('gutter-beside', alley, round(pa[0]), round(pa[1]), round(t0))
        tris, area_ = _gutter_drift(S, own, pa, pb, t0, t1 - t0, rng, GUTTER_BESIDE_PIECE)
        if tris:
            counts['litter_triangles'] += tris
            counts['ruelle_gutter_drifts_beside_patches'] += 1
            spans.setdefault((pa, pb), []).append((t0, t1))
            drawn += area_
    return drawn / 1e4


def _lane_drifts(world, S, ground, crowns, counts):
    """Leaves banked against the ruelles' fences and walls: along each side of a ruelle's paving, stretches of
    LANE_DRIFT with a gap of LANE_DRIFT_GAP after each (shorter under the crowns), each drawn by the curb drifts' rule
    (CURB_DRIFT: a chance of 0.4 plus the leaves overhead). A drift is a fan from the middle of its foot, its straight
    side 3 cm in from the paving's edge (the fence line or a wall), its ragged bulge LANE_DRIFT_W out over the lane,
    wider under the crowns, LITTER_LANE over the paving. Only along the longest part of the stretch where the paving
    ends just beyond the foot (no gate, mouth or crossing ruelle), the edge steps by less than LANE_DRIFT_STEP, and
    every point of the drift lies on that ruelle's paving (no gutter). Returns the area (m2)."""
    lane_z = Z_ALLEY + LITTER_LANE
    on_lane = lambda q: (lambda z: z is not None and abs(z - lane_z) < .05)(ground.at(q))   # noqa: E731
    counts.setdefault('ruelle_foot_leaf_drifts', 0)
    drawn = 0.
    for alley in getattr(world, 'alleys', []):
        for (pa, pb), profile in zip(alley['segments'], alley['reach']):
            u, length = unit(pa, pb)
            n = (-u[1], u[0])
            ts = profile['t']
            for side in (1, -1):
                edge = profile[side]

                def foot(t):
                    """The paving's reach at t along the stretch (its sampled profile, linear between samples)."""
                    i = max(0, min(len(ts) - 2, next((j for j in range(len(ts) - 1) if ts[j + 1] >= t), len(ts) - 2)))
                    f = 0. if ts[i + 1] == ts[i] else max(0., min(1., (t - ts[i]) / (ts[i + 1] - ts[i])))
                    return edge[i] + (edge[i + 1] - edge[i]) * f
                rng = Rng('lane-drift', alley['id'], round(pa[0]), round(pa[1]), side)
                x = rng.uniform(0., 300.)
                while x < length - 150.:
                    run = min(rng.uniform(*LANE_DRIFT), length - 50. - x)
                    mid = add(add(pa, u, x + run / 2), n, side * (foot(x + run / 2) - 10.))
                    fall = leaves_over(crowns, mid)
                    reach = [foot(x + run * f) for f in (0., .25, .5, .75, 1.)]
                    line = min(reach) - 3.
                    # the longest part of the stretch whose foot runs along the fence or wall: every 20 cm the paving
                    # ends within LITTER_HUG beyond it (not at a gate, a mouth or a crossing ruelle)
                    steps = math.ceil(run / 20.)
                    hug = [not all(on_lane(add(add(pa, u, x + run * j / steps), n, side * (line + d)))
                                   for d in (4., 8., LITTER_HUG)) for j in range(steps + 1)]
                    j0 = j1 = best = 0
                    for j in range(steps + 1):
                        k = j
                        while k <= steps and hug[k]:
                            k += 1
                        if k - j > best:
                            j0, j1, best = j, k - 1, k - j
                    t0, t1 = x + run * j0 / steps, x + run * j1 / steps
                    if t1 - t0 >= 120. and max(reach) - min(reach) < LANE_DRIFT_STEP and \
                            rng.chance(CURB_DRIFT[0] + CURB_DRIFT[1] * fall):
                        width = rng.uniform(*LANE_DRIFT_W) * (1. + fall)
                        k = max(2, math.ceil((t1 - t0) / LITTER_SIDE))
                        out = []
                        for i in range(k, -1, -1):
                            f = i / k
                            w = 3. + width * math.sin(math.pi * f) ** .6 * (rng.uniform(.7, 1.2) if 0 < i < k else .2)
                            t = t0 + (t1 - t0) * f + (rng.uniform(-10., 10.) if 0 < i < k else 0.)
                            out.append(add(add(pa, u, t), n, side * (line - w)))
                        at = lambda t: add(add(pa, u, t), n, side * line)   # noqa: E731
                        pts = [at((t0 + t1) / 2), at(t1)] + out + [at(t0)]
                        if all(on_lane(q) for q in pts + [lerp(a, b, .5) for a, b in zip(pts, pts[1:])] +
                               [lerp(pts[0], q, .5) for q in out] +
                               [((pts[0][0] + a[0] + b[0]) / 3, (pts[0][1] + a[1] + b[1]) / 3)
                                for a, b in zip(pts[1:], pts[2:])]):
                            counts['litter_triangles'] += _litter_face(S, pts, lane_z)
                            counts['ruelle_foot_leaf_drifts'] += 1
                            drawn += abs(area(pts))
                    x += run + rng.uniform(*LANE_DRIFT_GAP) * (1. - .5 * fall)
    return drawn / 1e4


def _tuft(S, base, rng, scale):
    for _ in range(rng.randint(2, 4)):
        b = (base[0] + rng.uniform(-9, 9) * scale, base[1] + rng.uniform(-9, 9) * scale, base[2])
        S.cone('weed', b, rng.uniform(2.5, 5) * scale, rng.uniform(8, 26) * scale, 3, rng.uniform(0, math.tau))


class Catenary:
    """A rope or wire hanging from a to b (x, y, z in cm) as a true catenary in the vertical plane through them: with s
    the horizontal distance from a, z(s) = a_z + c (cosh((s - m) / c) - cosh(m / c)), c the catenary's parameter and m
    its vertex (outside 0..span when the rope rises all the way). It is set by its mid-span sag under the chord, the
    fixed-sag mode of set dressing (80.lv, "Fully Procedural Catenary Curves Generator in Maya", which approximates the
    curve by a parabola; this solves the catenary itself). The sag falls as c grows, so c is found by bisection; the
    vertex follows from the height difference, v = 2c sinh((span / 2 - m) / c) sinh(span / 2c), and the length from
    L^2 - v^2 = 4c^2 sinh^2(span / 2c) (Wikipedia, "Catenary", Determining parameters)."""

    def __init__(self, a, b, sag):
        self.a, self.b = tuple(float(v) for v in a), tuple(float(v) for v in b)
        self.span = math.dist(self.a[:2], self.b[:2])
        self.v = self.b[2] - self.a[2]
        assert self.span > 1. and sag > 0., (a, b, sag)
        lo, hi = math.log(self.span / 60.), math.log(self.span * 1e5)
        for _ in range(100):
            mid = (lo + hi) / 2
            if self._sag(math.exp(mid)) > sag:
                lo = mid
            else:
                hi = mid
        self.c = math.exp((lo + hi) / 2)
        self.m = self._vertex(self.c)
        self.sag = self._sag(self.c)
        self.length = math.sqrt(self.v ** 2 + (2 * self.c * math.sinh(self.span / 2 / self.c)) ** 2)

    def _vertex(self, c):
        return self.span / 2 - c * math.asinh(self.v / (2 * c * math.sinh(self.span / 2 / c)))

    def _z(self, s, c, m):
        return self.a[2] + c * (math.cosh((s - m) / c) - math.cosh(m / c))

    def _sag(self, c):
        return self.a[2] + self.v / 2 - self._z(self.span / 2, c, self._vertex(c))

    def at(self, s):
        """The point s cm along the span (measured horizontally from a)."""
        t = s / self.span
        return (self.a[0] + (self.b[0] - self.a[0]) * t, self.a[1] + (self.b[1] - self.a[1]) * t,
                self._z(s, self.c, self.m))

    def points(self, segments):
        return [self.at(self.span * i / segments) for i in range(segments + 1)]

    def record(self, segments):
        return {'from': [r2(v) for v in self.a], 'to': [r2(v) for v in self.b], 'catenary_cm': round(self.c, 3),
                'vertex_cm': round(self.m, 3), 'length_cm': r2(self.length), 'segments': segments}


def _catenary(S, key, a, b, sag, radius, segments=10):
    """A rope or wire as rods along the catenary from a to b with mid-span sag `sag`: the curve and its points."""
    rope = Catenary(a, b, sag)
    pts = rope.points(segments)
    for p, q in zip(pts, pts[1:]):
        S.rod(key, p, q, radius, 3)
    return rope, pts


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
PLEX_GENERATOR = 'Scripts/plateau_plex.py'
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
PLEX_POSTS = {'boards': (244., 4.5), 'lattice': (244., 4.5), 'slats': (300., 3.), 'chain': (300., 3.),
              'low': (180., 3.)}   # fence post spacing and half width (plateau_plex.FENCE_POSTS)
# Paint on a lane fence (tags, fence murals) goes only on a solid face: the board card of a board fence or of a
# lattice-topped one (under its lattice band and mid rail, plateau_plex.LATTICE_TOP + 4 cm), or the 3 cm panel of a
# slatted chain-link fence; never on a low picket fence (the strokes would bridge the gaps between pickets) or on
# chain-link. The value is the paint's plane off the fence line, in front of the card (1.2) or of the panel's face.
PAINT_FACE = {'boards': 1.2, 'lattice': 1.2, 'slats': 2.2}
PLEX_LATTICE_BAND = 45. + 4.


def board_top(fence):
    """Top of a lane fence's solid face (cm): the fence height, or the boards under a lattice band."""
    return fence['height_cm'] - (PLEX_LATTICE_BAND if fence['kind'] == 'lattice' else 0.)
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
TAG_FENCE, TAG_SHED, TAG_GARAGE = .22, .25, .7   # lane fences, shed and garage doors with a tag (halved on a
                                                 # ruelle verte; garage doors on a lane are few and much tagged).
# Only solid fence faces take paint now (PAINT_FACE), about 70% of the lane fences the picket fences were counted in,
# so the fence share rose from .16 to keep about as many tags along a lane.
Z_BED = 9.                      # soil top of a ruelle-verte bed over the verge, behind a 12 cm timber edge
# The washing. The local review found the sheets hanging as stiff white boards and no line in a lane view. Each strand
# of the pulley loop now hangs as a true catenary (Catenary), and the garments are laid along the lower strand by their
# own widths with a seeded gap, the way J. Fuchs's procedural clothesline HDA for Unreal spaces its items by each one's
# width (her rope is a Vellum simulation; the closed-form curve keeps this build stdlib-only and deterministic). A
# garment is a strip of quads on its Cloth_Laundry atlas cell (plateau_textures.laundry: the cell's UV rect, its size
# and the garment's in cm, its pegs): the top edge on the rope at the garment's edges, at each peg and between pegs, so
# it follows the rope's sag; the columns hang plumb to the hem, where they stand alternately in front of and behind the
# rope's plane: the folds that fan down from the pegs and open toward the hem (Weil, "The Synthesis of Cloth Objects",
# SIGGRAPH 1986), over the folds drawn in the cell.
LAUNDRY_WEIGHTS = (('sheet_white', 3), ('sheet_floral', 2), ('towel_stripes', 3), ('towel_red', 2),
                   ('towel_yellow', 2), ('shirt_blue', 2), ('shirt_white', 2), ('shirt_plaid', 2), ('tshirt_yellow', 1),
                   ('tshirt_grey', 2), ('jeans', 3), ('dress_green', 1), ('pillowcase', 2), ('shorts_khaki', 1))
FOLD_CM = {'sheet': 4.5, 'towel': 2.5, 'pillowcase': 2., 'shirt': 2.5, 'tshirt': 2.5, 'jeans': 1.5, 'dress': 3.5,
           'shorts': 1.5}       # a fold's offset at the hem, either side of the rope's plane (x .7 to 1.3 per garment)
ROPE_SEGMENTS = (6, 8)          # rods of the upper (return) strand and of the lower one, the garments' rope
PEG_UP = .8                     # a garment's card reaches this far over the rope (the peg tops, in the cell's pad)
HEM_FREE = 2.                   # and this far under its hem
HEM_GROUND = 45.                # a hem stays this high over the yard...
HEM_FENCE = (100., 10.)         # ... and, within 1 m of the back fence, 10 cm over the fence top
GARMENT_GAP = (8., 35.)         # bare rope between two garments
LINE_SAG = (.018, .03)          # the lower strand's mid-span sag, a share of the span
LINE_LOADED = .65               # lines with washing on them (late October: a third hang empty)
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


# -- tree crowns ----------------------------------------------------------------------------------
# The crowns the game draws, for the washing and the leaf litter. The apply step stands each Plex yard tree on its
# species mesh scaled to the row's height, and each street and park tree on its kind's mature or young mesh with the
# height and spread of street_tree_scale. The same scaling is mirrored here, so the Soul build needs no apply step;
# test_plateau_replica checks that the two agree on every row. A crown is a cylinder round the trunk: its radius is
# half the mesh's crown width, from its crown base up to the tree's top (Trees/manifest.json, at the instance's scale).
TREES_MANIFEST = OUT / 'Trees/manifest.json'
YARD_TREES = OUT / 'Plex/yard_trees.json'
YARD_TREE_MESH_CM = 455.        # apply_plateau_replica.TREE_MESH_HEIGHT_CM: a yard row's scale is on this height
YARD_TREE_ALIASES = {'maple': 'norway_maple'}   # apply_plateau_replica.TREE_ALIASES (Plex's old yard kind)
TREE_SCALE, YOUNG_SCALE = (.55, 1.65), (.6, 1.6)      # apply_plateau_replica: the mature and young height scales,
YOUNG_BELOW, CROWN_SPREAD = .55, (.8, 1.25)           # the young-mesh threshold and the crown spread limits
CROWN_KEEP = .7                 # washing keeps out of this share of a crown's radius, from its crown base up,
TRUNK_KEEP = 150.               # and this far from every trunk (the local review: lines strung through the crowns)


def tree_kinds(path=None):
    """The Trees manifest's kinds (Scripts/blender/plateau_trees.py): crown width and base, height, trunk and leaf
    retention per kind and its young mesh."""
    path = Path(path or TREES_MANIFEST)
    try:
        return json.loads(path.read_text())['kinds']
    except (OSError, KeyError, ValueError) as error:
        raise AssertionError(f'No tree kinds in {path}; run Scripts/blender/plateau_trees.py --no-render') from error


def street_tree_mesh(row, kind):
    """(mesh, horizontal scale, vertical scale) of a street_trees.json row on its kind's meshes, as
    apply_plateau_replica.street_tree_scale stands it: the young mesh under YOUNG_BELOW of the mature height, the
    height scale within the mesh's limits, the crown spread from the trunk."""
    young = kind.get('young')
    height = row['height_cm'] if row.get('height_cm') is not None else \
        kind['height_cm'] * row['dbh_cm'] / kind['trunk_cm']
    mesh, limits = kind, TREE_SCALE
    if young and height < YOUNG_BELOW * kind['height_cm']:
        mesh, limits = young, YOUNG_SCALE
    sz = min(limits[1], max(limits[0], height / mesh['height_cm']))
    spread = math.sqrt((row['dbh_cm'] / mesh['trunk_cm']) / sz)
    return mesh, round(sz * min(CROWN_SPREAD[1], max(CROWN_SPREAD[0], spread)), 4), round(sz, 4)


def load_yard_tree_rows(path=None):
    """Plex/yard_trees.json rows ({x, y, z, yaw, scale, kind}), or none when plateau_plex.py has not written it."""
    try:
        doc = json.loads(Path(path or YARD_TREES).read_text())
    except (OSError, ValueError):
        return []
    return doc.get('trees', []) if isinstance(doc, dict) else doc


class Crowns:
    """Tree crowns as upright cylinders round their trunks, indexed in the plane: (x, y, z, radius, base, top,
    fallen share, kind, source), source 'yard' for a Plex yard tree, else the street tree's id. The crown base and
    top are over the ground under the trunk (z)."""

    def __init__(self):
        self.items, self.grid = [], Grid(2000.)

    def add(self, x, y, z, radius, base, top, fallen=0., kind='', source=''):
        self.grid.add(len(self.items), bbox([(x, y)], max(radius, TRUNK_KEEP)))
        self.items.append((x, y, z, radius, base, top, fallen, kind, source))

    def near(self, p, pad=0.):
        return [self.items[i] for i in self.grid.query(bbox([p], pad))]

    def clash(self, p, z_lo, z_hi):
        """The first crown whose inner part (CROWN_KEEP of its radius, from its base up) the upright band z_lo..z_hi
        over p enters, or whose trunk stands within TRUNK_KEEP of p; None when clear."""
        for t in self.near(p):
            x, y, z, radius, base, top = t[:6]
            d = math.dist(p[:2], (x, y))
            if d < TRUNK_KEEP and z_lo < z + top:
                return t
            if d < CROWN_KEEP * radius and z_hi > z + base and z_lo < z + top:
                return t
        return None


def tree_crowns(world, kinds=None, yard_rows=None):
    """Every crown the game draws: the Plex yard trees (Plex/yard_trees.json) and the street and park trees
    (world.street_tree_rows), each on its species mesh at the apply step's scale."""
    kinds = tree_kinds() if kinds is None else kinds
    crowns = Crowns()
    for row in load_yard_tree_rows() if yard_rows is None else yard_rows:
        kind = YARD_TREE_ALIASES.get(row['kind'], row['kind'])
        mesh = kinds[kind]
        height = float(row.get('height_cm', row['scale'] * YARD_TREE_MESH_CM))
        s = height / mesh['height_cm']
        crowns.add(row['x'], row['y'], row.get('z', 0.), mesh['crown_width_cm'] / 2 * s, mesh['crown_base_cm'] * s,
                   height, 1. - mesh['leaf_retention'], kind, 'yard')
    for row in getattr(world, 'street_tree_rows', []):
        mesh, sxy, sz = street_tree_mesh(row, kinds[row['kind']])
        crowns.add(row['x_cm'], row['y_cm'], row['z_cm'], mesh['crown_width_cm'] / 2 * sxy, mesh['crown_base_cm'] * sz,
                   mesh['height_cm'] * sz, 1. - mesh['leaf_retention'], row['kind'], row['id'])
    return crowns


def line_clear(crowns, a, b, sag, drop, step=40.):
    """Whether a laundry line from a to b (x, y, z: the pulleys) stands clear of the crowns and trunks: its two strands
    (4 cm over and under the pulleys, the lower sagging up to `sag` at mid-span) and the washing on it, up to `drop`
    under the lower strand, sampled every `step` cm along it."""
    span = math.dist(a[:2], b[:2])
    n = max(2, math.ceil(span / step))
    for i in range(n + 1):
        t = i / n
        p = lerp(a[:2], b[:2], t)
        z = a[2] + (b[2] - a[2]) * t
        if crowns.clash(p, z - 4. - 4. * sag * t * (1. - t) - drop, z + 4.):
            return False
    return True


# -- laundry ------------------------------------------------------------------------------------

def lane_laundry(world, plex, S, lane, counts, crowns=None):
    """Pulley clotheslines (cordes à linge) as Montréal hangs them: each from a pulley on a gallery's top rail at
    the end of the module away from its stair, out over the lot's own yard to a clothesline pole near the back
    fence, one pulley per floor on the pole. Never to a utility pole and never over the ruelle (city rules), and
    never through a tree: a line and the washing it can carry keep out of every crown and away from every trunk
    (line_clear), so a spot whose line would pass through a tree gives way to the module's next spot. Where every
    spot clashes, the pole serves only the floors whose lines are clear, or the module hangs no washing at all.
    Without `crowns` (the lane fixtures), the lots' own yard-tree records stand in for the Trees meshes."""
    if crowns is None:
        crowns = Crowns()
        for lot in plex.lots:
            for t in ((lot['rear'].get('yard') or {}).get('trees') or []):
                h = t.get('height_m', 10.) * 100
                crowns.add(t['x'], t['y'], t.get('z', 0.), t.get('crown_m', 8.) * 50, .25 * h, h)
    drop = max(min(c['size_cm'][1] - .5, c['garment_cm'][1] + HEM_FREE) for c in laundry_cells().values())
    counts.setdefault('laundry_modules_under_trees', 0)
    counts.setdefault('laundry_lines_left_in_trees', 0)
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
            # neighbouring module's stair); only where the fence line has no room, deeper in the yard. The floors
            # with a line and each line's rise are drawn first, so trying a spot draws nothing.
            first = rng.uniform(0., 160.)
            wanted = [(dk, rng.uniform(*LINE_RISE)) for dk in mdecks
                      if rng.chance(LAUNDRY_DECK) and dk['z'] + LINE_ABOVE_DECK <= LINE_TOP]

            def lines_at(ax, P):
                out = []
                for dk, rise in wanted:
                    guard = next((i for i, g in enumerate(rear.get('guards') or [])
                                  if abs(g['z0'] - dk['z']) < 1 and _guard_covers(F, g, ax, dF)), None)
                    if guard is None:
                        continue
                    A = F.world(ax, ad)
                    za = dk['z'] + LINE_ABOVE_DECK
                    zb = min(LINE_END_TOP, max(LINE_MIN_END, za + rise))
                    toward, span = unit(P, A)
                    end = (P[0] + toward[0] * 9, P[1] + toward[1] * 9, zb)
                    out.append({'deck_z': dk['z'], 'guard': guard, 'A': (A[0], A[1], za), 'zb': zb, 'span': span,
                                'clear': line_clear(crowns, (A[0], A[1], za), end, LINE_SAG[1] * span, drop)})
                return out
            spots = ((ax, ax + inward * dx, F.D - dd) for depths in (POLE_FENCE, POLE_FALLBACK)
                     for off in (25., 70., 115.) for ax in (x0 + off if inward > 0 else x1 - off,)
                     for dd in depths for dx in (first, 0., 80., 160., 240., 320., 400.))
            pick, room = None, False
            for ax, px, pd in spots:
                if not pole_ok(ax, px, pd):
                    continue
                room = True
                P = F.world(px, pd)
                found = lines_at(ax, P)
                clear = [m for m in found if m['clear']]
                if found and len(clear) == len(found):
                    pick = (ax, P, pd, clear, 0)
                    break
                if clear and (pick is None or len(clear) > len(pick[3])):
                    pick = (ax, P, pd, clear, len(found) - len(clear))   # so far the best: its clear floors only
            if pick is None:
                counts['laundry_modules_under_trees' if room else 'laundry_modules_without_room'] += 1
                continue
            ax, P, pd, mine, dropped = pick
            counts['laundry_lines_left_in_trees'] += dropped
            height = max(m['zb'] for m in mine) + POLE_TOP
            pole_mat = rng.choice(('clothes_pole', 'clothes_pole', 'pulley'))          # wood, or a galvanised pipe
            S.box(pole_mat, (P[0], P[1], height / 2), (11, 11, height), F.yaw(), bottom=False)
            if len(mine) > 1 or rng.chance(.5):
                S.box(pole_mat, (P[0], P[1], height - 18), (64, 7, 7), F.yaw())
            index = len(poles)
            poles.append({'lot': lot['id'], 'module': k, 'xy': P, 'position': [r2(P[0]), r2(P[1])],
                          'height_cm': r2(height), 'material': pole_mat, 'lines': len(mine),
                          'from_fence_cm': r2(F.D - pd)})
            fence_top = float(fence.get('height_cm') or 0.)

            def hem_floor(p, F=F, fence_top=fence_top):
                near = F.D - F.local(p)[1] < HEM_FENCE[0]
                return max(HEM_GROUND, fence_top + HEM_FENCE[1]) if near else HEM_GROUND
            for m in mine:
                toward, _ = unit(P, m['A'])
                B = (P[0] + toward[0] * 9, P[1] + toward[1] * 9, m['zb'])
                start = max(60., extent - ad + 50.)
                washing, rope = _laundry_line(S, m['A'], B, rng, start, 60., hem_floor)
                lines.append({'lot': lot['id'], 'module': k, 'deck_z': r2(m['deck_z']), 'guard': m['guard'],
                              'anchor': [r2(v) for v in m['A']], 'end': [r2(v) for v in B], 'pole': index,
                              'span_cm': r2(math.dist(m['A'][:2], B[:2])), 'sag_cm': r2(rope.sag),
                              'rope': rope.record(ROPE_SEGMENTS[1]), 'garments': len(washing), 'washing': washing})
                counts['laundry_lines'] += 1
                counts['garments'] += len(washing)
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


def laundry_cells():
    """The laundry atlas's cells from Textures/textures.json (plateau_textures.laundry): name -> kind, UV rect (OBJ
    convention, v up: u0, v0, u1, v1), cell and garment size in cm and the pegs' x in cm from the cell's left edge."""
    if 'cells' not in _LAUNDRY:
        try:
            cells = json.loads(TEXTURE_INDEX.read_text())['sets']['laundry']['layout']['cells']
        except (OSError, KeyError, ValueError) as error:
            raise AssertionError('No laundry atlas cells in Textures/textures.json; run python3 Scripts/plateau_textures.py') \
                from error
        assert all(name in cells for name, _ in LAUNDRY_WEIGHTS), sorted(cells)
        _LAUNDRY['cells'] = cells
    return _LAUNDRY['cells']


TEXTURE_INDEX = OUT / 'Textures/textures.json'
_LAUNDRY = {}


def rope_z(pts, span, s):
    """Height of a rope drawn as the polyline pts (equal horizontal steps over the span) s cm along it."""
    n = len(pts) - 1
    i = min(n - 1, max(0, int(s / span * n)))
    t = min(1., max(0., s / span * n - i))
    return pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t


def _laundry_line(S, A, B, rng, start, stop, hem_floor):
    """The pulley loop from A to B: two strands 8 cm apart, each a catenary, the lower one sagging more, with pulleys
    at both ends; on most lines, garments pegged on the lower strand between `start` and `stop` cm from the ends,
    their hems over hem_floor(xy). Returns the garment records and the lower strand (a Catenary)."""
    span = math.dist(A[:2], B[:2])
    sag = span * rng.uniform(*LINE_SAG)
    yaw = math.degrees(math.atan2(B[1] - A[1], B[0] - A[0]))
    for p in (A, B):
        S.box('pulley', (p[0], p[1], p[2]), (7, 4, 12), yaw)
    _catenary(S, 'line_rope', (A[0], A[1], A[2] + 4), (B[0], B[1], B[2] + 4), sag * .75, .45, ROPE_SEGMENTS[0])
    rope, pts = _catenary(S, 'line_rope', (A[0], A[1], A[2] - 4), (B[0], B[1], B[2] - 4), sag, .45,
                          ROPE_SEGMENTS[1])
    washing = []
    if not rng.chance(LINE_LOADED):
        return washing, rope
    cells = laundry_cells()
    names = [name for name, w in LAUNDRY_WEIGHTS for _ in range(w)]
    s = start
    while True:
        name = rng.choice(names)
        width = cells[name]['garment_cm'][0]
        if s + width > span - stop:
            break
        row = _garment(S, rope, pts, s, name, cells[name], rng, hem_floor)
        if row:
            washing.append(row)
            s += width + rng.uniform(*GARMENT_GAP)
        else:
            s += 25.                # too low here (near a low gallery rail, or over the fence): bare rope
    return washing, rope


def _garment(S, rope, pts, s0, name, cell, rng, hem_floor):
    """A garment pegged on the lower strand from s0 cm along the span: a strip of Cloth_Laundry quads on its atlas cell,
    one column at each edge, each peg and midway between pegs, the top of each on the drawn rope (so the garment's top
    follows the rope's sag) and its hem plumb under it, a fold's offset in front of the rope's plane at the pegs and
    behind it between them and at the edges, the whole hem swung a little by the wind. Returns its record, or None
    (nothing drawn) where a hem would fall under hem_floor."""
    kind = cell['kind']
    gw, _ = cell['garment_cm']
    (cw, ch), (u0, v0, u1, v1) = cell['size_cm'], cell['uv']
    half = gw / 2 + 1.
    pins = [p - cw / 2 for p in cell['pins_cm']]
    cols = [(-half, 'edge'), (half, 'edge')] + [(x, 'peg') for x in pins] + \
        [((a + b) / 2, 'mid') for a, b in zip(pins, pins[1:])]
    cols.sort()
    merged = []
    for x, role in cols:
        if merged and x - merged[-1][0] < 3.:      # a peg within 3 cm of an edge: keep the edge, the card's extent
            if role == 'edge':
                merged[-1] = (x, role)
            continue
        merged.append((x, role))
    drop = min(ch - .5, cell['garment_cm'][1] + HEM_FREE)
    vt = v1 + PEG_UP / ch * (v1 - v0)
    vh = v1 - drop / ch * (v1 - v0)
    d = ((rope.b[0] - rope.a[0]) / rope.span, (rope.b[1] - rope.a[1]) / rope.span)
    n = (-d[1], d[0])
    fold = FOLD_CM[kind] * rng.uniform(.7, 1.3)
    lean = rng.uniform(-2.5, 2.5)
    swing = {'peg': 1., 'mid': -1., 'edge': -.6}
    tops, hems, us = [], [], []
    for x, role in merged:
        s = s0 + gw / 2 + x
        z = rope_z(pts, rope.span, s)
        p = (rope.a[0] + d[0] * s, rope.a[1] + d[1] * s)
        off = fold * swing[role] + lean
        hem = (p[0] + n[0] * off, p[1] + n[1] * off, z - drop)
        if hem[2] < hem_floor(hem[:2]):
            return None
        tops.append((p[0], p[1], z + PEG_UP))
        hems.append(hem)
        us.append((u0 + u1) / 2 + x / cw * (u1 - u0))
    for k in range(len(merged) - 1):
        S.uvface('Cloth_Laundry', [tops[k], tops[k + 1], hems[k + 1], hems[k]],
                 [(us[k], vt), (us[k + 1], vt), (us[k + 1], vh), (us[k], vh)])
    return {'cell': name, 'from_cm': r2(s0), 'width_cm': r2(gw), 'drop_cm': r2(drop), 'quads': len(merged) - 1}


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
    units sit in windows that are drawn): triangles indexed by their box in map coordinates (the OBJ stores x, -y).
    The Plex OBJs are git-ignored: a manifest whose Glass OBJ is missing (a fresh checkout) stops the build with an
    error that names the Plex generator."""

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
            obj = path.parent / batch['file']
            if not obj.is_file():
                raise FileNotFoundError(f'Missing {obj}, a Glass batch of {path}: the Plex OBJs are git-ignored, so '
                                        f'run python3 {PLEX_GENERATOR} before {GENERATOR}')
            vs = []
            for line in obj.read_text().splitlines():
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
    leaves from every side instead of faceted mounds; a cover adds a flat leaf card on the soil. The grass is crossed
    cards of its own fountain-grass set (_fountain_grass)."""
    kind = rng.choice(('perennial', 'perennial', 'perennial', 'grass', 'shrub', 'cover'))
    if kind == 'perennial':
        _cards(S, rng.choice(('plant_green', 'plant_green', 'plant_gold', 'plant_rust', 'plant_purple')), p, z,
               rng.uniform(15, 26), rng.uniform(25, 48), 2, rng)
    elif kind == 'grass':
        _fountain_grass(S, p, z, rng)
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
GRASS_CARDS = 3                 # crossed fountain-grass cards per clump, 60 degrees apart
GRASS_H = (55., 95.)            # a fountain grass (Pennisetum) in October, plumes included


def _fountain_grass(S, p, z, rng):
    """An ornamental grass gone to straw (the local review's "straw cone"): GRASS_CARDS crossed Plant_Grass_Fountain
    cards round the clump's centre, each showing the fountain_grass set's whole clump (a fountain of arching blades
    and buff plumes rising from a narrow base, u 0..1 across the card, mirrored on some, v 0..1 up it), about as wide
    as tall, each card turned and sized a little on its own: the crossed-card clump of real-time vegetation (Pelzer,
    "Rendering Countless Blades of Waving Grass", GPU Gems ch. 7; K. Quinn's plant cards for God of War Ragnarok)."""
    h = rng.uniform(*GRASS_H)
    phase = rng.uniform(0., math.pi)
    for k in range(GRASS_CARDS):
        a = phase + k * math.pi / GRASS_CARDS + rng.uniform(-.12, .12)
        c, s = math.cos(a), math.sin(a)
        w, hh = h * rng.uniform(.45, .6), h * rng.uniform(.9, 1.05)
        ua, ub = (1., 0.) if rng.chance(.5) else (0., 1.)
        S.uvface('Plant_Grass_Fountain', [(p[0] - c * w, p[1] - s * w, z), (p[0] + c * w, p[1] + s * w, z),
                                          (p[0] + c * w, p[1] + s * w, z + hh), (p[0] - c * w, p[1] - s * w, z + hh)],
                 [(ua, 0.), (ub, 0.), (ub, 1.), (ua, 1.)])


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
            if F is None or not fence or not fence.get('lane') or fence['kind'] not in PAINT_FACE or \
                    board_top(fence) - 8. - 15. < 120.:         # _mural's fence face: 15 cm up, 8 under the top
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
            F, fence = lot['frame'], lot['rear']['fence']
            a, b = F.world(p0, F.D), F.world(p1, F.D)
            off = PAINT_FACE[fence['kind']]
            if _mural(S, {'a': a, 'b': b}, {'height': board_top(fence) + 82.}, rng, off=off, z0=15., margin=15.,
                      min_h=120., min_w=250.):
                lot['lane_busy'].append((p0, p1))
                counts['murals'] += 1
                counts['green_murals'] += 1
                lane['ruelles_vertes']['murals'].append({'ruelle': rid, 'host': 'fence', 'owner': lot['id'],
                                                         'kind': lot['rear']['fence']['kind'],
                                                         'a': [r2(v) for v in a], 'b': [r2(v) for v in b],
                                                         'offset_cm': off, 'z0_cm': 15.})
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
        if not on_green and fence['kind'] in PAINT_FACE and rng.chance(TAG_FENCE):
            g = fence.get('gate_at')
            busy = list(lot['lane_busy']) + ([(g - 160, g + 160)] if g is not None else []) + \
                ([tuple(fence['shed_at'])] if fence.get('shed_at') else [])
            bays = [(a, b) for a, b in _fence_bays(fence) if b - a >= 110 and not any(a < y and b > x for x, y in busy)]
            if bays:
                a, b = rng.choice(bays)
                top, off = min(board_top(fence) - 15, 155.), PAINT_FACE[fence['kind']]
                tris, kind = _tag(S, F, a + 6, b - 6, 32., top, F.D + off, rng)
                rows.append({'lot': lot['id'], 'on': 'fence', 'kind': kind, 'fence': fence['kind'], 'face_cm': off,
                             'top_cm': r2(top), 'x_cm': [r2(a + 6), r2(b - 6)],
                             'plane': [[r2(v) for v in F.world(a, F.D + off)], [r2(v) for v in F.world(b, F.D + off)]],
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
LANE_COUNTS = ('laundry_lines', 'laundry_poles', 'garments', 'laundry_modules_without_room',
               'laundry_modules_under_trees', 'laundry_lines_left_in_trees', 'gallery_decks',
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
    poles = lane_laundry(world, plex, S, lane, counts, getattr(world, 'crowns', None))
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
            'curb_extensions_on_corners', 'trees_reseated', 'trees_reseated_pit', 'trees_reseated_parterre',
            'trees_reseated_median', 'trees_for_host', 'tree_pits', 'pit_guard_cards', 'pit_flower_cards')
    kinds, falls = {}, {}
    for row in world.street_tree_rows:
        kinds[row['kind']] = kinds.get(row['kind'], 0) + 1
        group = row['kind'] + ' ' + row['fall']
        falls[group] = falls.get(group, 0) + 1
    head = {'layer': 'Streets', 'generator': GENERATOR, 'frame': FRAME + ' (the map frame; Unreal x and y alike)',
            'note': 'Every street and park tree the game shows, one row per tree: id (inv:<borough>-<EMP_NO> from '
                    'the city inventory, osm:<node> for an OSM tree the inventory lacks), x_cm, y_cm, z_cm (ground '
                    'under the trunk: the pit soil, a sidewalk, lawn or bare ground), species (the inventory\'s '
                    'Latin name, or unknown), kind (a Trees manifest kind, from TREE_SPECIES and TREE_GENERA in '
                    'plateau_replica.py, else by crown size), fall (its late-October colour: yellow, red, russet, '
                    'gold or evergreen, from TREE_FALL), dbh_cm (trunk diameter at breast height; dbh_from says when '
                    'it is estimated), height_cm (from the trunk, research-plateau.md 10.4), source (inventory or '
                    'osm), placement (the inventory\'s Emplacement), pit (in a sidewalk or extension pit), yaw_deg '
                    '(seeded); moved_cm and mapped_xy_cm when the tree moved (into a sidewalk pit, or off the '
                    'carriageway), reseated (sidewalk pit, parterre or median: moved off the carriageway from the '
                    'inventory\'s side, place and distance), extension (index into extensions). host_review lists the '
                    'trees left out because they stand on carriageway asphalt with no seat on their side of the '
                    'street; dropped lists those inside a building.',
            'sources': {'inventory': dict(TREE_SOURCE, files=['Data/Plateau/Inventory/' + n for n in TREE_FILES]),
                        'osm': '\u00a9 OpenStreetMap contributors, ODbL 1.0 (natural=tree nodes the inventory lacks)'},
            'rules_cm': {'pit': [PIT_L, PIT_D], 'pit_from_curb': list(PIT_BACK), 'pit_gap': PIT_GAP,
                         'ramp_keep': RAMP_KEEP, 'pit_slide_max': PIT_SLIDE_MAX, 'osm_same_tree': OSM_TREE_SAME,
                         'extension_corner_reach': CORNER_REACH, 'extension_choker_reach': CHOKER_REACH,
                         'extension_reach': BUMP_REACH, 'margin': BUMP_MARGIN, 'park_gap': PARK_GAP,
                         'traffic_clear': CLEAR, 'raised_top': Z_WALK, 'flush_top': Z_DROP,
                         'reseat_slide': RESEAT_SLIDE, 'reseat_reach': RESEAT_REACH, 'parterre_back': PARTERRE_BACK,
                         'median_reach': MEDIAN_REACH, 'median_ground': MEDIAN_GROUND},
            'kinds': dict(sorted(kinds.items())), 'falls': dict(sorted(falls.items())),
            'counts': {k: counts[k] for k in keys},
            'extensions': world.extension_rows, 'host_review': world.tree_host,
            'dropped': [{'id': t['id'], 'position': [r2(t['p'][0]), r2(t['p'][1])], 'reason': t['why']}
                        for t in world.street_tree_dropped]}
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "trees": [\n' + \
        ',\n'.join('  ' + json.dumps(row, ensure_ascii=False) for row in world.street_tree_rows) + '\n ]\n}\n'
    Path(path).write_text(text)


def write_bike_paint(world, path, counts):
    """Streets/bike_paint.json: one row per drive way side whose OSM cycleway tags paint it (bike_paint_sides), and
    one per way side a drawn cycle track runs along (tracks)."""
    keys = ('bike_paint_sides', 'bike_lane_line_metres', 'bike_lane_marks', 'sharrows', 'bus_diamonds',
            'bike_paint_too_narrow', 'track_buffers', 'track_buffer_metres')
    head = {'layer': 'Streets', 'generator': GENERATOR, 'frame': FRAME + ' (the map frame; Unreal x and y alike)',
            'note': 'On-street cycling paint, one row per way side: way (OSM id), name, side (L the OSM left, R the '
                    'right), kind (lane: cycleway lane or opposite_lane, two white lines with a diamond, a bike and an '
                    'arrow; shared: shared_lane, a bike and two chevrons; busway: share_busway, the reserved-lane '
                    'diamond), travel (1 along the way, -1 against it), segments ([segment, inner line, outer line] '
                    'for a lane, [segment, mark] otherwise: signed cm from the segment centreline, left positive), '
                    'line_m (painted line metres), marks (centre, heading_deg of travel, at: a point on its paint) '
                    'and too_narrow (segments left bare for want of a 3 m traffic lane). The parked cars keep the '
                    'curb: a lane with parking lies between the cars and the traffic. tracks: one row per way side '
                    'a drawn cycle track runs along in the carriageway: parking (tag: OSM parks the side; signs: two '
                    'or more of the city\'s on-street poles allow parking now; null: neither), allow_poles, track_m '
                    '(painted track metres), buffer_m and pieces (the concrete separator the cars park against: its '
                    'face toward the cars and its back toward the track, each from one end to the other) and left_out '
                    '(metres without a separator, by reason: no parking; kept open, round a crosswalk, a stop bar or '
                    'a lane or driveway mouth, or in the 300 cm traffic band; short between two such openings; '
                    'bus stop where its zone leaves no car space, traffic band where a car against it would come '
                    'within 300 cm of a traffic centre line, lane where it would leave less than a 3 m lane).',
            'rules_cm': {'parking_band': PARKING_W, 'lane_width': BIKE_LANE_W, 'gutter': BIKE_GUTTER,
                         'line_width': BIKE_LINE_W, 'junction_clear': BIKE_END, 'crossing_clear': BIKE_CLEAR,
                         'first_after_mouth': BIKE_FIRST, 'repeat': BIKE_REPEAT, 'sharrow_from_edge': SHARROW_FROM_EDGE,
                         'track_edge': TRACK_EDGE, 'buffer_face': BUFFER_FACE, 'buffer_back': BUFFER_BACK,
                         'buffer_top': Z_WALK},
            'counts': {k: counts[k] for k in keys}}
    tracks = []
    for key in sorted(world.track_sides, key=lambda k: (int(k[0]), k[1])):
        row = dict(world.track_sides[key])
        if not row['track_m']:
            continue                          # a short piece with no paint: no track drawn there
        row['track_m'], row['buffer_m'] = r2(row['track_m']), r2(row['buffer_m'])
        row['left_out'] = dict(sorted(row['left_out'].items()))
        tracks.append(row)
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "ways": [\n' + \
        ',\n'.join('  ' + json.dumps(row, ensure_ascii=False) for row in world.bike_paint) + '\n ],\n "tracks": [\n' + \
        ',\n'.join('  ' + json.dumps(row, ensure_ascii=False) for row in tracks) + '\n ]\n}\n'
    Path(path).write_text(text)


def write_paint_marks(world, path):
    """Streets/paint_marks.json: the outline of every crosswalk and stop bar the Streets layer paints, where it
    paints it. A crossing that OSM maps near a junction is painted up to 6 m further out (crossing_records), so the
    parking step reads its clearances from here rather than from the OSM way."""
    head = {'layer': 'Streets', 'generator': GENERATOR, 'frame': FRAME + ' (the map frame; Unreal x and y alike)',
            'note': 'One row per painted mark: seg (the replica segment), way (its OSM way), outline (four corners, '
                    'cm: a box along the segment that holds all of the mark\'s paint). crosswalks: style '
                    '(continental_white or continental_yellow blocks, lines_white two lines) and source (osm: a '
                    'mapped crossing way; stop: drawn at a mapped stop with none mapped; signal: drawn at traffic '
                    'lights with none mapped). stop_bars: source (osm_stop or signal).',
            'counts': {k: len(v) for k, v in world.paint_marks.items()}}
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n' + ',\n'.join(
        f' "{key}": [\n' + ',\n'.join('  ' + json.dumps(row, ensure_ascii=False, sort_keys=True) for row in rows) + '\n ]'
        for key, rows in world.paint_marks.items()) + '\n}\n'
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
    # the Soul's curb leaf bags keep clear of the Furniture props
    grid = Grid(500.)
    for i, row in enumerate(furniture_rows):
        grid.add(i, bbox([row['position'][:2]]))
    world.furniture_grid = lambda p: [
        (furniture_rows[i]['position'][:2], LEAF_BAG_KEEP_SIGN if furniture_rows[i]['prop'] == 'sign_parking' else
         LEAF_BAG_KEEP) for i in grid.query(bbox([p], LEAF_BAG_KEEP_SIGN))]
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
        'Soul': write_layer(soul, directory / 'Soul', soul_counts, {'leaf_litter': getattr(world, 'leaf_litter', None)}),
    }
    write_placements(directory / 'Soul', 'Soul', soul_rows, soul_counts)
    # Every street and park tree the game shows, one row each (the contract the apply step's tree actors read), the
    # curb extensions and the trunks left for the host.
    write_street_trees(world, directory / 'Streets/street_trees.json', street_counts)
    write_bike_paint(world, directory / 'Streets/bike_paint.json', street_counts)
    write_paint_marks(world, directory / 'Streets/paint_marks.json')
    streets_manifest = json.loads((directory / 'Streets/manifest.json').read_text())
    streets_manifest['street_trees'] = 'street_trees.json'
    streets_manifest['street_trees_sha256'] = sha_file(directory / 'Streets/street_trees.json')
    streets_manifest['bike_paint'] = 'bike_paint.json'
    streets_manifest['bike_paint_sha256'] = sha_file(directory / 'Streets/bike_paint.json')
    streets_manifest['paint_marks'] = 'paint_marks.json'
    streets_manifest['paint_marks_sha256'] = sha_file(directory / 'Streets/paint_marks.json')
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
    if len(sys.argv) == 4 and sys.argv[1] == '--clip-sign-poles':
        poles, signs = clip_sign_poles(sys.argv[2], sys.argv[3])
        print(f'{SIGN_POLES.relative_to(ROOT)}: {poles} poles carrying {signs} signs')
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
