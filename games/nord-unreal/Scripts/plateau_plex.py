"""Plateau plex fronts and rears on the plain OSM footprints: layer ReplicaGeometry/Plex.

Stdlib only, deterministic. Every plain building (not one of the 100 route fronts, the
154 park-facing perimeter fronts, the tower or the school) gets a street-level Plateau
front: brick in the local palette, raised ground floor over a stone base with basement
vents, tall windows with stone sills and lintels, paired doors with transoms, wooden
balconies on each upper floor, curved or straight black iron stairs to the 2nd floor,
painted cornices with brackets, fausse-mansarde slate fronts and raised brick parapets
by construction era, and dépanneur ground floors at corners. The fronts are visual skins
4-16 cm in front of the existing collision masses; stair treads, stoops and balcony
decks form separate complex-collision batches.

The yard side (build(..., rear=True), class Rear): every exposed back wall gets an opaque skin 16 cm proud
of the mass (hiding the old OSM glass cards), the main rear wall gets doors and windows on every floor, a
gallery on each upper floor with posts to the yard (rails and a cap as geometry, balusters or lattice as masked
cut-out cards), and a straight wooden flight or a steel spiral from the yard to the top; yards close toward the
ruelle (or the rear lot line) with a board, slatted or picket fence and a gate, or stay open as a parking pad,
with seeded ground cover (lawn, pavers, soil beds, gravel), sheds, garages, hedges, cedars and Virginia creeper
cards, and yard trees from the city's 2019 canopy survey (Plex/yard_trees.json). Street, lane and long side
walls are brick with windows; lap siding stays on the back of the lot.

Roofs (author_roof): white membrane, white gravel or black tar over every lot, party parapets with a metal coping
that step with the neighbours, a brick skin on any party wall left above a lower neighbour, a hatch, a brick
chimney box and a few deck terraces. Background masses (background_masses): the park-perimeter row and the
skipped buildings get the same back-wall skin and windows wherever their old glass cards would show.

Walls and collision: blocks of 5 storeys or more built from 1945 on (BUILD_YEAR_OVERRIDES corrects roll years, e.g.
the OMHM's Habitations De Mentana, 1974) and the towers take a post-1945 apartment kit (modern_bays: 3 m bays,
balcony slabs with steel guards, patio doors, wall panels, a parapet over a lowered roof, a lift penthouse); lap siding
never rises above the 2nd storey or onto a block over 4; lots with no yard get lawn and parking (plan_open_ground).
Gallery guards, inner flights' open sides and stair-head balcony rails get invisible Collision_Only walls, and
clear_traffic_band takes every collision unit that comes within 300 cm of a traffic centreline out of collision.

Rules follow research-plateau.md §3-§6 and §9 (Plateau heritage sheets, Dec 2015) and the
CGA split idea of Müller et al. 2006 (mass -> facade -> floors -> bays). Storeys come from
OSM building:levels, then the municipal assessment roll joined by address, then the 2016
LOD2 height, then 3. Frame: x east, y north, cm, z up (the existing, mirrored, map frame).

    python3 Scripts/plateau_plex.py                 # write Data/Plateau/ReplicaGeometry/Plex
    python3 Scripts/plateau_plex.py --join-roll F   # rebuild assessment_roll_join.json from a
                                                    # CKAN datastore dump of the roll (JSON list)
    python3 Scripts/plateau_plex.py --clip-canopy Z # rebuild canopy_2019_clip.json from the Canopée 2019
                                                    # GeoJSON or its zip (Ville de Montréal, CC BY 4.0)
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
import plateau_landmarks
import plateau_school
import plateau_tower

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/Plateau/ReplicaGeometry/Plex'
ROLL_JOIN = OUT / 'assessment_roll_join.json'
GENERATOR = 'Scripts/plateau_plex.py'
LAYER = 'Plex'

TILE_CM = 4750            # base grid; widened in whole multiples only when the batch cap needs it
# Raised from 860: the walls-and-roofs pass adds 8 material keys (roofs, sheet metal, lap siding, parging, baluster
# cards), about 1,250 batches at the 142.5 m tile, so the tile widens to 190 m (884 batches) instead of 237.5 m; the
# yards pass adds 7 more keys (lattice, fence boards, creeper, four ground covers), 1,110 batches at 190 m. A batch is
# one Nanite static-mesh actor, which is cheap.
MAX_BATCHES = 1200
MAX_BATCH_TRIANGLES = 60000
# Raised from 2.5 million to 2.75 million: roofs (membrane skins, party parapets, chimneys, hatches), windowed long and
# street walls and the skins and windows on 252 background masses add about 210,000 triangles. Raised to 2.95 million:
# the yards pass (guard rails, caps and rim boards, fence posts and cap rails, spiral pans, stringers, rails and
# balusters, ground cover, creeper cards) adds about 270,000 triangles. Raised to 3.15 million (the agreed ceiling is
# 3.5 million): the walls-and-collision pass adds about 160,000, mostly the post-1945 kit's balcony slabs, guards,
# patio doors and panels on 6 blocks and 8 towers, the 3 m window grid on the background skins, and the invisible
# guard walls (two faces per guard run). Raised to 3.2 million: the rear-surfaces pass adds about 86,000, mostly the
# blind or curtain cards behind some 23,000 rear, background and post-1945 windows and patio doors, plus the gallery
# privacy screens, the roofs and roof props of the 252 background masses and the board gates' ledges and braces.
TRIANGLE_BUDGET = 3200000

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
    # Buff brick takes the shared key the apply step maps to its own even buff-brick set (no 'texture' field, so it
    # never falls back to the red brick photo tinted up to 8x, which read as a cream, olive and red speckle).
    'Brick_Buff_Even': {'base_color_srgb': '#CCB07F', 'roughness': .84, 'metallic': 0},
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
    # Shared keys of the walls-and-roofs pass; the apply step maps each to a textured material.
    'Roof_Membrane':   {'base_color_srgb': '#D6D7D3', 'roughness': .7, 'metallic': 0},     # white or light-grey membrane
    'Roof_Gravel':     {'base_color_srgb': '#C8C4BA', 'roughness': .95, 'metallic': 0},    # white gravel ballast
    # Tar and sheet metal follow the replica texture sets (Textures/textures.json): tar and gravel is grey pea gravel
    # sunk in black tar, about #4A4744 (the set owns its colour; #2C2B29 rendered flat black), and weathered galvanised
    # sheet is the set's mean grey at metallic .3 and roughness .59 (at metallic .6 and roughness .4 it read brown in
    # shade).
    'Roof_Tar':        {'base_color_srgb': '#4A4744', 'roughness': .66, 'metallic': 0},    # tar and grey pea gravel
    'Sheet_Metal':     {'base_color_srgb': '#9CA0A1', 'roughness': .59, 'metallic': .3},   # galvanised roof sheet
    'Siding_Lap_Cream': {'base_color_srgb': '#D8CDB0', 'roughness': .6, 'metallic': 0},    # clapboard with visible laps
    'Siding_Lap_Grey': {'base_color_srgb': '#8B8E8F', 'roughness': .6, 'metallic': 0},
    'Parged':          {'base_color_srgb': '#A09B92', 'roughness': .9, 'metallic': 0},     # parged concrete foundation
    'Rail_Baluster':   {'base_color_srgb': '#8A8170', 'roughness': .7, 'metallic': 0},     # cut-out card: wood balusters
    # Shared keys of the yards pass (the apply step maps each to a textured material); the colours sit near the
    # texture means in Textures/textures.json, so the tints stay near 1.
    'Rail_Lattice':    {'base_color_srgb': '#A39A88', 'roughness': .7, 'metallic': 0},     # cut-out card: diagonal lattice
    'Fence_Boards':    {'base_color_srgb': '#8C7A63', 'roughness': .8, 'metallic': 0},     # cut-out card: weathered boards
    'Leaf_Creeper':    {'base_color_srgb': '#8F3321', 'roughness': .58, 'metallic': 0},    # cut-out autumn Virginia creeper
    'Yard_Grass':      {'base_color_srgb': '#606A31', 'roughness': .9, 'metallic': 0},     # October lawn
    'Yard_Pavers':     {'base_color_srgb': '#89847B', 'roughness': .81, 'metallic': 0},    # concrete pavers (pavé uni)
    'Yard_Soil':       {'base_color_srgb': '#453526', 'roughness': .88, 'metallic': 0},    # garden-bed soil
    'Yard_Gravel':     {'base_color_srgb': '#827F7B', 'roughness': .88, 'metallic': 0},    # crushed-stone parking pad
    # Parking on lots with no yard: the street asphalt photo (the apply step duplicates M_Asphalt for an 'asphalt'
    # texture), a lighter, older grey than the carriageway's #3a3b40.
    'Asphalt_Lot':     {'base_color_srgb': '#4C4D50', 'roughness': .9, 'metallic': 0, 'texture': '/Game/Art/Textures/asphalt_02_diff'},
    # Shared key: geometry that collides but never renders (gallery guards, stair-opening edges, balcony rails). The
    # apply step spawns these batches on actors hidden in game that block pawns and ignore the camera and visibility.
    'Collision_Only':  {'base_color_srgb': '#FF00FF', 'roughness': 1., 'metallic': 0},
}
# complex-as-simple per batch, like the existing *_Collision batches. A Wood_Deck face inside the 300 cm traffic band
# goes to a 'Visual' batch with no collision instead (clear_traffic_band), and a Collision_Only face there is dropped.
COLLISION = {'Wood_Deck': 'complex', 'Collision_Only': 'complex'}
VISUAL = 'Visual'           # batch-name marker of the no-collision Wood_Deck batches
# Alpha-masked cut-out cards: u along the run in metres, v 0..1 from the bottom to the top of the card.
CARD_UV = ('Rail_Baluster', 'Rail_Lattice', 'Fence_Boards')
YARD_GROUND = ('Yard_Grass', 'Yard_Pavers', 'Yard_Soil', 'Yard_Gravel')
ROOFS = ('Roof_Membrane', 'Roof_Gravel', 'Roof_Tar')
BRICKS = ('Brick_Red', 'Brick_RedDark', 'Brick_Orange', 'Brick_Brown', 'Brick_BrownDark', 'Brick_Buff_Even')
PAINT = ('Iron', 'Wood_Green', 'Wood_Burgundy', 'Wood_Grey', 'Wood_Cream')
DOORS = ('Wood_Green', 'Wood_Burgundy', 'Iron', 'Wood_Green', 'Wood_Oak', 'Wood_Oak', 'Wood_Grey')
FRAMES = ('Trim', 'Trim', 'Trim', 'Iron', 'Wood_Green', 'Wood_Oak')
# Decade histogram of the matched roll (research §4) for lots without a roll year.
ERA_WEIGHTS = ((1885, 487), (1895, 46), (1905, 653), (1913, 421), (1925, 182), (1935, 48), (1950, 69), (1970, 130))
# Lots whose assessment-roll year is not the year of the building that stands there (the roll keeps the oldest unit
# year on the lot). Each entry gives the year, optionally the brick, and the source.
BUILD_YEAR_OVERRIDES = {
    # OSM way 356220851, 4110-4118 rue De Mentana and 4077-4105 rue Saint-André: the OMHM's Habitations De Mentana,
    # 158 social-housing units in two buildings with lifts. The roll's 1885 put a 19th-century front on it.
    '356220851': {'year': 1974, 'masonry': 'Brick_Red',
                  'source': "OMHM, Habitations De Mentana: in operation since 1974 (https://omhm.qc.ca/en/node/15296); "
                            'red brick, concrete balcony slabs with painted guards, patio doors and wall panels under '
                            'the windows (OMHM Infochantier De Mentana, October 2008, '
                            'https://www.omhm.qc.ca/sites/default/files/infochantier/DeMentanav210.08.pdf)'},
}
# Post-1945 apartment kit (blocks of 5 storeys or more built from 1945 on; the OMHM notice above lists the parts):
# window bays about every 3 m, a concrete balcony slab with a painted steel guard on every bay of every upper floor,
# patio doors, painted wall panels under the windows, concrete floor edges, a brick parapet with a metal coping that
# stands over a lowered roof, and a lift penthouse with roof vents instead of the plex chimney and hatch.
MODERN_YEAR, MODERN_STOREYS = 1945, 5
MODERN_BAY = 300.           # window bay; mid-century towers (La Rochelle, 1565 Rachel Est) and walk-ups alike
MODERN_PARAPET = 80.        # roof this far under the front's coping: a parapet you can see over the roof line
MODERN_RAISE = 15.          # ground floor near grade, one step up
BALCONY_D, SLAB_T = 130., 15.
MODERN_GUARD = 100.         # steel guard height over the slab
BALCONY_CLEAR = 300.        # a wall needs this much room in front of it for balconies
GUARD_PAINT = ('Iron', 'Iron', 'Wood_Grey', 'Trim', 'Wood_Green')
PANEL_PAINT = ('Wood_Cream', 'Wood_Grey', 'Wood_Green', 'Wood_Burgundy', 'Stone_Cast')
SIDING_STOREYS, SIDING_MAX_STOREYS = 2, 4   # lap siding never above the 2nd storey, never on a block over 4


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
        # Collision faces are grouped in units (a front stair with its head balcony, a porch with its steps, a
        # balcony, a lot's rear stack): clear_traffic_band takes a whole unit out of collision, never half a stair.
        self.unit = None
        self.unit_faces = {}
        self.visual = set()         # (material, index) of Wood_Deck faces kept visible with no collision

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
        group = self.groups.setdefault(material, [])
        group.append(points)
        self.count += len(points) - 2
        if self.unit is not None and material in COLLISION:
            self.unit_faces.setdefault(self.unit, []).append((material, len(group) - 1))

    def triangles(self):
        return self.count


def write_obj(path, name, faces, material=None):
    Path(path).write_text(obj_text(name, faces, material))


def obj_text(name, faces, material=None):
    """plateau_mesh.Mesh.write conventions (v x -y z, reversed fans), UVs in metres. A cut-out card material
    (CARD_UV, quads authored bottom edge first) takes v = 0 on its lower edge and 1 on its upper edge."""
    lines = ['o ' + name]
    index = 1
    card = material in CARD_UV
    for poly in faces:
        a, b = poly[0], poly[1]
        d = [b[i] - a[i] for i in range(3)]
        length = math.sqrt(sum(v * v for v in d)) or 1
        d = [v / length for v in d]
        horizontal = max(p[2] for p in poly) - min(p[2] for p in poly) < .1
        for x, y, z in poly:
            lines.append(f'v {x:.3f} {-y:.3f} {z:.3f}')
        if card and len(poly) == 4:
            # the face may be stored reversed: its lower edge is the pair of vertices with the lower mean height
            vs = (0., 0., 1., 1.) if poly[0][2] + poly[1][2] < poly[2][2] + poly[3][2] else (1., 1., 0., 0.)
            run = math.hypot(d[0], d[1]) or 1
            uvs = [((p[0] * d[0] + p[1] * d[1]) / run / 100, v) for p, v in zip(poly, vs)]
        else:
            uvs = [(p[0] / 100, p[1] / 100) if horizontal else (sum(p[i] * d[i] for i in range(3)) / 100, p[2] / 100)
                   for p in poly]
        for uv in uvs:
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


def cutout(mesh, mat, a, b, z0, z1):
    """One alpha-masked cut-out card (CARD_UV material, two-sided in the engine) from world point a to b, z0 to z1:
    a single face, authored bottom edge first, so obj_text maps u along the run and v 0..1 from bottom to top."""
    if math.dist(a, b) < 5 or z1 - z0 < 5:
        return 0
    assert mat in CARD_UV + ('Leaf_Creeper',), mat
    side = (b[1] - a[1], -(b[0] - a[0]), 0.)
    mesh.face(mat, [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], side)
    return 1


def collision_plane(mesh, a, b, z0, z1, zb0=None, zb1=None, half=1.5):
    """An invisible wall from world point a to b (Collision_Only: collides, never renders), as two faces back to back
    `half` either side of the line, so a capsule meets it from either side whatever the engine's face culling. Bottom
    z0 and top z1 at a; zb0 and zb1 give the bottom and top at b for a sloped run beside a flight (default level)."""
    length = math.dist(a[:2], b[:2])
    if length < 8:
        return 0
    zb0 = z0 if zb0 is None else zb0
    zb1 = z1 if zb1 is None else zb1
    if min(z1 - z0, zb1 - zb0) < 5:
        return 0
    n = ((b[1] - a[1]) / length, -(b[0] - a[0]) / length)
    for side in (1, -1):
        o = (n[0] * half * side, n[1] * half * side)
        mesh.face('Collision_Only', [(a[0] + o[0], a[1] + o[1], z0), (b[0] + o[0], b[1] + o[1], zb0),
                                     (b[0] + o[0], b[1] + o[1], zb1), (a[0] + o[0], a[1] + o[1], z1)],
                  (n[0] * side, n[1] * side, 0.))
    return 1


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


# --------------------------------------------------------------------------- canopy (yard trees)
# Ville de Montréal "Canopée" 2019: the ground projection of every tree crown over 3 m, as polygons in NAD83(CSRS)
# MTM zone 8 (EPSG:2950) metres. `--clip-canopy` reads the published GeoJSON (or its zip) once, keeps the polygons
# over the district bounds in the map frame and writes the small committed derivative CANOPY; the build only reads it.
CANOPY = OUT / 'canopy_2019_clip.json'
CANOPY_SOURCE = ('Ville de Montréal, données ouvertes, Canopée 2019 (CC BY 4.0), donneesquebec.ca vmtl-canopee, '
                 'resource 77e44cc1; source: photo aérienne (août 2019) et lidar (été 2018), © Communauté '
                 'métropolitaine de Montréal; producteur: Division de la géomatique, Ville de Montréal')
CANOPY_MARGIN = 1000.       # cm kept past the district bounds
CANOPY_SIMPLIFY = 40.       # cm Douglas-Peucker tolerance; the source traces a 0.75 m raster
_GRS80 = (6378137., 1 / 298.257222101)
_MTM8 = (-73.5, .9999, 304800., 0.)          # central meridian, scale, false easting, false northing


def _mtm8_inverse(easting, northing):
    """NAD83 MTM zone 8 metres -> (lat, lon) degrees: Snyder's transverse Mercator inverse (USGS PP 1395, p. 63)."""
    a, f = _GRS80
    lon0, k0, fe, fn = _MTM8
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    m = (northing - fn) / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + 151 * e1 ** 3 / 96 * math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * math.sin(8 * mu))
    s, c, t = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    c1, t1 = ep2 * c * c, t * t
    n1 = a / math.sqrt(1 - e2 * s * s)
    r1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5
    d = (easting - fe) / (n1 * k0)
    lat = phi1 - n1 * t / r1 * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
                                + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = math.radians(lon0) + (d - (1 + 2 * t1 + c1) * d ** 3 / 6
                                + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / c
    return math.degrees(lat), math.degrees(lon)


def _mtm8_forward(lat, lon):
    """(lat, lon) degrees -> NAD83 MTM zone 8 metres (Snyder, p. 61), for the source bounding box."""
    a, f = _GRS80
    lon0, k0, fe, fn = _MTM8
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi = math.radians(lat)
    s, c, t = math.sin(phi), math.cos(phi), math.tan(phi)
    n = a / math.sqrt(1 - e2 * s * s)
    tt, cc, aa = t * t, ep2 * c * c, math.radians(lon - lon0) * c
    m = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
             - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi) - 35 * e2 ** 3 / 3072 * math.sin(6 * phi))
    x = k0 * n * (aa + (1 - tt + cc) * aa ** 3 / 6 + (5 - 18 * tt + tt ** 2 + 72 * cc - 58 * ep2) * aa ** 5 / 120)
    y = k0 * (m + n * t * (aa ** 2 / 2 + (5 - tt + 9 * cc + 4 * cc ** 2) * aa ** 4 / 24
                           + (61 - 58 * tt + tt ** 2 + 600 * cc - 330 * ep2) * aa ** 6 / 720))
    return fe + x, fn + y


def _clip_ring(ring, box):
    """Sutherland-Hodgman: a closed ring (no repeated end point) clipped to the box (x0, y0, x1, y1)."""
    for axis, limit, keep_low in ((0, box[0], False), (0, box[2], True), (1, box[1], False), (1, box[3], True)):
        if not ring:
            break
        out = []
        for i, q in enumerate(ring):
            p = ring[i - 1]
            p_in = p[axis] <= limit if keep_low else p[axis] >= limit
            q_in = q[axis] <= limit if keep_low else q[axis] >= limit
            if q_in != p_in:
                t = (limit - p[axis]) / (q[axis] - p[axis])
                out.append(tuple(p[k] + (q[k] - p[k]) * t if k != axis else limit for k in range(2)))
            if q_in:
                out.append(q)
        ring = out
    return ring


def _simplify(points, tolerance):
    """Douglas-Peucker on an open polyline, keeping both ends."""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        best, index = -1., None
        for k in range(i + 1, j):
            d = _nearest(points[k], points[i], points[j])[0]
            if d > best:
                best, index = d, k
        if index is not None and best > tolerance:
            keep[index] = True
            stack += [(i, index), (index, j)]
    return [p for p, k in zip(points, keep) if k]


def clip_canopy(source):
    """The Canopée 2019 polygons over the district in the map frame (cm), simplified, for CANOPY. `source` is the
    published GeoJSON or the zip that holds it; the file is streamed one feature per line."""
    import io
    import zipfile
    from prepare_lafontaine import BOUNDS
    lo, hi = xy(BOUNDS[0], BOUNDS[1]), xy(BOUNDS[2], BOUNDS[3])
    box = (lo[0] - CANOPY_MARGIN, lo[1] - CANOPY_MARGIN, hi[0] + CANOPY_MARGIN, hi[1] + CANOPY_MARGIN)
    corners = [_mtm8_forward(lat, lon) for lat in (BOUNDS[0] - .0002, BOUNDS[2] + .0002)
               for lon in (BOUNDS[1] - .0003, BOUNDS[3] + .0003)]
    ex0, ex1 = min(c[0] for c in corners), max(c[0] for c in corners)
    ny0, ny1 = min(c[1] for c in corners), max(c[1] for c in corners)
    path = Path(source)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if path.suffix == '.zip':
        archive = zipfile.ZipFile(path)
        name = next(n for n in archive.namelist() if n.endswith('.geojson'))
        stream = io.TextIOWrapper(archive.open(name), encoding='utf-8')
    else:
        stream = path.open(encoding='utf-8')
    number = re.compile(r'-?\d+\.?\d*')
    polygons, features, read = [], 0, 0
    for line in stream:
        if not line.startswith('{ "type": "Feature"'):
            continue
        features += 1
        geometry = line[line.index('"geometry"'):]
        values = number.findall(geometry[:4000])
        if len(line) < 20000 and len(values) >= 2:
            # a short feature is a few hundred metres across at most: skip it unless it starts near the district
            e, n = float(values[0]), float(values[1])
            if not (ex0 - 2000 <= e <= ex1 + 2000 and ny0 - 2000 <= n <= ny1 + 2000):
                continue
        feature = json.loads(line.rstrip().rstrip(','))
        read += 1
        geometry = feature['geometry']
        parts = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        for part in parts:
            rings = []
            for ring in part:
                xs = [r[0] for r in ring]
                ys = [r[1] for r in ring]
                if max(xs) < ex0 or min(xs) > ex1 or max(ys) < ny0 or min(ys) > ny1:
                    continue
                pts = [xy(*_mtm8_inverse(e, n)) for e, n in ring]
                if len(pts) > 1 and pts[0] == pts[-1]:
                    pts = pts[:-1]
                pts = _clip_ring(pts, box)
                if len(pts) < 3 or abs(_area(pts)) < 1e4:
                    continue
                # simplify as two open halves so the ring keeps its start and its farthest point
                far = max(range(len(pts)), key=lambda k: math.dist(pts[0], pts[k]))
                pts = _simplify(pts[:far + 1], CANOPY_SIMPLIFY)[:-1] + _simplify(pts[far:] + [pts[0]], CANOPY_SIMPLIFY)[:-1]
                ring_cm = [(round(x), round(y)) for x, y in pts]
                ring_cm = [p for i, p in enumerate(ring_cm) if p != ring_cm[i - 1]]
                if len(ring_cm) >= 3 and abs(_area(ring_cm)) >= 1e4:
                    rings.append(ring_cm)
            if rings:
                polygons.append(rings)
    polygons.sort(key=lambda rings: (min(p[1] for p in rings[0]), min(p[0] for p in rings[0])))
    return {'source': CANOPY_SOURCE, 'license': 'CC BY 4.0', 'source_sha256': digest,
            'frame': 'x east, y north, cm (prepare_lafontaine.xy of the NAD83 MTM 8 coordinates)',
            'bounds_cm': [round(v) for v in box], 'simplify_cm': CANOPY_SIMPLIFY,
            'features_read': read, 'features_total': features,
            'note': 'Each polygon is a list of rings (outer ring first, then holes) as flat [x0, y0, x1, y1, ...] lists; '
                    'fill with the even-odd rule.',
            'polygons': [[[v for p in ring for v in p] for ring in rings] for rings in polygons]}


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


ROLL_CHECKED = (7, 12)      # roll storeys above 6 count only when the LOD2 roof agrees


def lod2_roofs(buildings, roll):
    """The LOD2 roof inside each footprint whose roll storeys are 7-12: the median height of the roof vertices of
    the municipal building that covers at least 60% of the footprint (all its rings together, so a building the
    survey split into several rings or merged into a group still counts). Returns ({id: check}, files read)."""
    wanted = [b for b in buildings if (roll.get(str(b['id'])) or [None, None])[1]
              and ROLL_CHECKED[0] <= roll[str(b['id'])][1] <= ROLL_CHECKED[1]]
    if not wanted:
        return {}, []
    manifest = json.loads((ROOT / 'Data/CityBuildings/manifest.json').read_text())
    grid = Grid(4000)
    for record in manifest['buildings']:
        for ring in record['footprints']:
            ring = [tuple(p[:2]) for p in ring]
            if len(ring) > 3 and ring[0] == ring[-1]:
                ring = ring[:-1]
            if len(ring) >= 3 and abs(_area(ring)) > 1e3:
                grid.add((record['id'], ring), [p[0] for p in ring], [p[1] for p in ring])
    result, read = {}, []
    for building in wanted:
        points = building['points']
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        samples = [(min(xs) + (max(xs) - min(xs)) * (i + .5) / 9, min(ys) + (max(ys) - min(ys)) * (j + .5) / 9)
                   for i in range(9) for j in range(9)]
        samples = [s for s in samples if _inside(s, points)]
        cover = {}
        for city_id, ring in grid.near((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                                        max(max(xs) - min(xs), max(ys) - min(ys))):
            cover.setdefault(city_id, set()).update(k for k, s in enumerate(samples) if _inside(s, ring))
        if not samples or not cover:
            continue
        city_id, covered = max(sorted(cover.items()), key=lambda item: len(item[1]))
        path = ROOT / 'Data/CityBuildings/Geometry' / f'{city_id}.obj'
        if len(covered) / len(samples) < .6 or not path.exists():
            continue
        heights = []
        for line in path.read_text().splitlines():
            if line.startswith('v '):
                x, y, z = (float(v) for v in line.split()[1:4])
                if z > 250 and min(xs) <= x <= max(xs) and min(ys) <= -y <= max(ys) and _inside((x, -y), points):
                    heights.append(z)
        if len(heights) < 4:
            continue
        heights.sort()
        result[str(building['id'])] = {'roof_cm': round(heights[len(heights) // 2], 1), 'city_id': city_id,
                                       'cover': round(len(covered) / len(samples), 3)}
        read.append(str(path.relative_to(ROOT)))
    return result, sorted(set(read))


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


def select_fronts(buildings, roads, skip_ids, roll=None, lod2=None, shops=(), roofs=None):
    """Street fronts of the plain buildings, with lot attributes chosen by rule and seed."""
    roll = roll or {}
    lod2 = lod2 or {}
    roofs = roofs or {}
    segments, sidewalks = _drive_segments(roads)
    road_grid, walk_grid, building_grid, shop_grid = Grid(), Grid(), Grid(), Grid(3000)
    for record in segments:
        road_grid.add(record, [record[0][0], record[1][0]], [record[0][1], record[1][1]])
    for record in sidewalks:
        walk_grid.add(record, [record[0][0], record[1][0]], [record[0][1], record[1][1]])
    local = []
    owners = {}
    for building in buildings:
        points = [tuple(p[:2]) for p in building['points']]
        if _area(points) < 0:
            points.reverse()
        local.append((building, points))
        building_grid.add((building, points), [p[0] for p in points], [p[1] for p in points])
        for a, b in zip(points, points[1:] + points[:1]):
            owners.setdefault(tuple(sorted((a, b))), []).append(str(building['id']))
    shared = {key for key, ids in owners.items() if len(ids) > 1}
    heights = {str(building['id']): building['height'] for building, _ in local}
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
                    or _nearest(s[0], primary['a'], primary['b'])[0] < 150], roofs.get(bid))
        # Rear of the lot (yard, ruelle and exposed side walls), kept out of _lot so the front draws are unchanged.
        obstacles = [points] + [other[1] for other in building_grid.near(cx, cy, 6000) if other[0] is not building]
        roads_near = [(c, d, road.get('tags', {}).get('service') == 'alley',
                       road.get('tags', {}).get('highway') in DRIVE and bool(road.get('name')))
                      for c, d, road, _ in road_grid.near(cx, cy, 6000)]
        lot['backs'] = _back_walls(points, [primary] + sides[:1], obstacles, shared, roads_near, primary['normal'])
        lot['obstacles'], lot['roads_near'] = obstacles, roads_near
        lot['party'] = _party_edges(points, bid, [primary] + sides[:1], lot['backs'], owners,
                                    [other for other in building_grid.near(cx, cy, 6000) if other[0] is not building],
                                    heights)
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


def _lot(building, points, primary, sides, roll, lod2, shops, roof_check=None):
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
    # Roll storeys over 6 are kept only where the municipal LOD2 roof agrees (within 1.5 storeys on the calibrated
    # (h - 4.9 m) / 3.26 m scale), e.g. the 9-storey block 356220851 on Mentana that had fallen back to 3.
    if roof_check and source != 'OSM building:levels' and roll and roll[1] \
            and ROLL_CHECKED[0] <= roll[1] <= ROLL_CHECKED[1] \
            and abs((roof_check['roof_cm'] - 490) / 326 - roll[1]) <= 1.5:
        storeys, source = roll[1], f"assessment roll, checked against the LOD2 roof ({roof_check['roof_cm'] / 100:.1f} m)"
    year, era_source = _era(rng, roll[0] if roll else None)
    override = BUILD_YEAR_OVERRIDES.get(bid)
    if override:                    # after the draw above, so every other lot's draws stay put
        year, era_source = override['year'], 'override: ' + override['source']
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
    if source.startswith('assessment roll, checked'):
        crown = 'flat'          # the 7-12 storey blocks the check admits are post-war apartments with a flat parapet
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
                   else 'Brick_Buff_Even' if roll_pick < .95 else 'Brick_Orange')
    elif year < 1940:
        masonry = ('Brick_Brown' if roll_pick < .3 else 'Brick_BrownDark' if roll_pick < .45 else 'Brick_Red' if roll_pick < .63
                   else 'Brick_Buff_Even' if roll_pick < .88 else 'Brick_Orange')
    else:
        masonry = rng.choice(('Brick_Buff_Even', 'Brick_Brown', 'Brick_Red', 'Brick_BrownDark'))
    if primary['street'] in ('Avenue du Parc-La Fontaine', 'Rue Sherbrooke Est') and rng.random() < .25:
        masonry = 'Stone'
    if override and override.get('masonry'):
        masonry = override['masonry']
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
    # a post-1945 block of 5 storeys or more takes the apartment kit (author_modern_front, Rear), its ground floor
    # near grade; set after every draw, so the lot's other draws stay put
    modern = storeys >= MODERN_STOREYS and year >= MODERN_YEAR
    if modern:
        raise_cm = MODERN_RAISE
    lot = {
        'modern': modern, 'year_override': override['source'] if override else None,
        'id': bid, 'points': points, 'height_cm': building['height'], 'storeys': storeys, 'storeys_source': source,
        'year': year, 'era_source': era_source, 'dwellings': dwellings, 'kind': kind, 'crown': crown,
        'masonry': masonry, 'paint': rng.choice(PAINT), 'door': rng.choice(DOORS), 'frame': rng.choice(FRAMES),
        'sash': 'double_hung' if rng.random() < .65 else 'casement_transom', 'stair': stair,
        'stair_left': rng.random() < .5, 'floor_height': floor_height, 'raise': raise_cm,
        'balconies': balconies, 'columns': columns, 'commercial': commercial,
        'shops': [s[1] for s in shops], 'corner': corner, 'arterial': arterial,
        'primary': primary, 'sides': sides, 'seed': rng.getrandbits(32),
        'bands': masonry != 'Stone' and 1890 <= year < 1916 and rng.random() < .35,
        'curtains': rng.random(), 'lod2': lod2, 'roll': roll, 'roof_check': roof_check,
    }
    if modern:
        _modern_paint(lot, bid)
    return lot


def _modern_paint(lot, bid):
    """Guard and wall-panel paint of a post-1945 block, from a seed of its own (front, rear and towers agree)."""
    mr = random.Random(_seed('plex-modern', bid))
    lot['guard_paint'], lot['panel_paint'] = mr.choice(GUARD_PAINT), mr.choice(PANEL_PAINT)


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

    def balcony(self, F, x0, x1, z, depth, rail_mat, open_side=None, brackets=True, posts_to=None, guard=False):
        """Cantilevered wood balcony, deck top at z; open_side 'l'/'r' leaves the stair arrival open. With `guard`
        (the stair-head balcony a player reaches), the rails get Collision_Only planes as high as the rail."""
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
        if guard:
            runs = [(front_a, front_b)] + ([(p(x0 + 3, D_FACE, 0), front_a)] if open_side != 'l' else []) \
                + ([(p(x1 - 3, D_FACE, 0), front_b)] if open_side != 'r' else [])
            for a, b in runs:
                self.count('rail_collision_runs', collision_plane(self.mesh, a, b, z, z + 86 + 4))

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
    if lot.get('modern'):
        return author_modern_front(mesh, lot, front, kit, primary, top_override)
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
                mesh.unit = ('front', lot['id'], tuple(front['a']), m, 'stair')
                kit.stair(F, x_top, climb, z2, yard, stair == 'curved', run_limit)
                mesh.unit = None
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
                mesh.unit = ('front', lot['id'], tuple(front['a']), m, 'porch')
                F.box('Wood_Deck', px0, px1, D_FACE - 2, pd, raise_cm - 10, raise_cm)
                F.box('Stone', px0 + 4, px1 - 4, D_FACE - 2, pd - 6, 0, raise_cm - 10, skip='kt')
                if steps_dir == 'out':
                    sx0, sx1 = (px0 + px1) / 2 - 55, (px0 + px1) / 2 + 55
                    # solid steps: each tread runs to the ground with its riser and closed sides (no slab gaps)
                    for k in range(steps - 1):
                        zt = raise_cm - rise * (k + 1)
                        z_next = raise_cm - rise * (k + 2) if k < steps - 2 else 0.
                        mat = 'Wood_Deck' if k < steps - 2 else 'Stone'
                        d0, d1 = pd + k * 26, pd + (k + 1) * 26
                        F.quad_z(mat, sx0, sx1, d0, d1, zt, 1)
                        F.quad_d(mat, sx0, sx1, z_next, zt, d1, 1)
                        F.quad_x(mat, sx0, d0, d1, 0, zt, -1)
                        F.quad_x(mat, sx1, d0, d1, 0, zt, 1)
                        kit.count('porch_steps')
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
                mesh.unit = None
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
                # the stair-head balcony is the stair's unit, and its rails collide (the arrival side stays open)
                mesh.unit = ('front', lot['id'], tuple(front['a']), m, 'stair')
                kit.balcony(F, hx0, hx1, z, depth, 'Iron' if rng.random() < .6 else lot['paint'],
                            open_side='l' if left else 'r', guard=True)
                mesh.unit = None
            elif lot['balconies'] and front['width'] >= 300:
                depth = D_FACE + (min(150., max(110., yard + 30)) if yard > 60 else 110.)
                partial = lot['year'] < 1890 and rng.random() < .4
                bx0, bx1 = (mx0 + 10, mx1 - 10)
                if partial and doors:
                    bx0, bx1 = max(mx0 + 10, doors[0][0] - 60), min(mx1 - 10, doors[-1][1] + 60)
                below = None
                if lot['columns'] and not stair_ok and depth <= yard + D_FACE - 10:
                    below = floor_z[level - 1] if level >= 2 else 0.
                mesh.unit = ('front', lot['id'], tuple(front['a']), m, 'balcony', level)
                kit.balcony(F, bx0, bx1, z, depth, 'Iron' if lot['year'] < 1912 or rng.random() < .5 else lot['paint'],
                            posts_to=below)
                mesh.unit = None
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
    # metal coping over the top of the front wall, lapping back over the roof; its ends step with the neighbours
    F.box('Sheet_Metal', 0, W, -18, D_FACE + 3, top, top + 4, skip='b')
    if top > lot['height_cm']:
        F.quad_d(wall, 0, W, lot['height_cm'], top, D_BACK, -1)
    record = {'a': [round(v, 2) for v in front['a']], 'b': [round(v, 2) for v in front['b']],
              'width_cm': round(W, 1), 'street': front['street'], 'yard_cm': front['yard'],
              'yard_source': front['yard_source'], 'top_cm': round(top, 1), 'modules': modules,
              'exterior_stairs': stairs_built, 'stairs': stair_records}
    return record, top


def blind(F, x0, x1, z0, z1, counts=None):
    """A blind or curtains behind the glass of an applied window or patio door (the pane x0..x1 by z0..z1 in frame F),
    so it does not read as a black hole: a roller blind pulled a quarter to three quarters down (55%), a pair of
    curtains drawn to the sides (30%), or a blind let down almost to the sill (15%), in white, cream or beige (a few
    curtains coloured). The glass is an opaque dark key, so the card stands just in front of it, under the meeting rail
    or sash (BLIND_D), as the street fronts' curtains do. Seeded by the window's own place, so it takes no draw from a
    lot's sequence. Returns the kind, or None for a pane too small."""
    if x1 - x0 < 20 or z1 - z0 < 30:
        return None
    c = F.p((x0 + x1) / 2, 0, 0)
    r = random.Random(_seed('plex-blind', round(c[0]), round(c[1]), round(z0)))
    roll, drop, share = r.random(), r.uniform(.25, .75), r.uniform(.22, .34)
    h = z1 - z0
    if roll < .55:
        kind = 'roller'
        F.quad_d(r.choice(BLINDS), x0, x1, z1 - drop * h, z1, BLIND_D)
    elif roll < .85:
        kind, mat, w = 'curtains', r.choice(CURTAINS), (x1 - x0) * share
        F.quad_d(mat, x0, x0 + w, z0, z1, BLIND_D)
        F.quad_d(mat, x1 - w, x1, z0, z1, BLIND_D)
    else:
        kind = 'lowered'
        F.quad_d(r.choice(BLINDS), x0, x1, z0 + .1 * h, z1, BLIND_D)
    if counts is not None:
        counts['blinds_' + kind] = counts.get('blinds_' + kind, 0) + 1
    return kind


def modern_bays(mesh, F, W, floors, zt, paints, counts, balconies=True, every=1, entrance=False):
    """The post-1945 apartment kit on one wall plane in frame F (x from 0 to W along the wall, the brick face at
    D_FACE): bays of about MODERN_BAY. On each upper floor a balcony bay (every `every`-th bay when `balconies`) has a
    patio door and a concrete slab with a painted steel guard (a cap rail over a panel, on three sides), with a
    window beside the door; the other bays a wide window. Every window has a painted wall panel under it, and each
    floor line a concrete edge. The ground floor takes windows, and with `entrance` a glazed entrance under a canopy
    in the middle bay. `floors` are the floor heights (ground first); a storey whose window head would pass zt - 10 is
    left out. paints = (frame, guard, panel). Returns (windows, doors, balconies)."""
    frame, guard, panel = paints
    n = max(1, round(W / MODERN_BAY))
    bw = W / n
    windows = doors = slabs = 0

    def window(xa, xb, z):
        nonlocal windows
        F.quad_d(frame, xa, xb, z + 90, z + 210, D_FACE + 1)
        F.quad_d('Glass', xa + 5, xb - 5, z + 95, z + 205, D_FACE + 2.5)
        blind(F, xa + 5, xb - 5, z + 95, z + 205, counts)
        F.quad_d(frame, (xa + xb) / 2 - 2, (xa + xb) / 2 + 2, z + 95, z + 205, D_FACE + 3.5)   # sliding sash
        F.quad_d(panel, xa, xb, z + 12, z + 86, D_FACE + 1)                                     # wall panel
        windows += 1

    def door(xa, xb, z, height=210, patio=True):
        nonlocal doors
        F.quad_d(frame, xa, xb, z, z + height, D_FACE + 1)
        F.quad_d('Glass', xa + 5, xb - 5, z + 3, z + height - 5, D_FACE + 2.5)
        if patio:
            blind(F, xa + 5, xb - 5, z + 3, z + height - 5, counts)
        F.quad_d(frame, (xa + xb) / 2 - 2.5, (xa + xb) / 2 + 2.5, z + 3, z + height - 5, D_FACE + 3.5)
        doors += patio

    def balcony(x0, x1, z):
        nonlocal slabs
        dg = D_FACE + BALCONY_D - 3
        F.box('Stone_Cast', x0, x1, D_FACE, D_FACE + BALCONY_D, z - SLAB_T, z, skip='k')
        gt = z + MODERN_GUARD
        F.box(guard, x0 + 1, x1 - 1, dg - 2.5, dg + 2.5, gt - 8, gt, skip='blr')         # front cap rail
        F.box(guard, x0 + 1, x1 - 1, dg - 1, dg + 1, z + 10, gt - 8, skip='tblr')         # front panel
        for x in (x0 + 3, x1 - 3):
            F.box(guard, x - 2.5, x + 2.5, D_FACE, dg - 2.5, gt - 8, gt, skip='bfk')     # side cap rails
            F.box(guard, x - 1, x + 1, D_FACE, dg - 1, z + 10, gt - 8, skip='tbfk')      # side panels
        slabs += 1

    for k, z in enumerate(floors[:-1]):
        if z + 215 > zt - 10:
            break
        if k:
            F.quad_d('Stone_Cast', 0, W, z - 20, z - 4, D_FACE + .5)                      # concrete floor edge
        for i in range(n):
            bx0 = i * bw
            if k == 0:
                if entrance and i == n // 2:
                    c = bx0 + bw / 2
                    hw = min(100., bw / 2 - 15)
                    door(c - hw, c + hw, z, 235, patio=False)
                    F.box('Stone_Cast', c - hw - 40, c + hw + 40, D_FACE, D_FACE + 160, z + 250, z + 266, skip='k')
                    F.box('Stone_Cast', c - hw - 20, c + hw + 20, D_FACE - 2, D_FACE + 110, 0, z, skip='kb')
                    counts['modern_entrances'] = counts.get('modern_entrances', 0) + 1
                else:
                    window(bx0 + .2 * bw, bx0 + .8 * bw, z)
            elif balconies and i % every == 0:
                door(bx0 + .1 * bw, bx0 + .56 * bw, z)
                window(bx0 + .66 * bw, bx0 + .9 * bw, z)
                balcony(bx0 + 4, bx0 + bw - 4, z)
            else:
                window(bx0 + .2 * bw, bx0 + .8 * bw, z)
    for key, value in (('modern_windows', windows), ('patio_doors', doors), ('modern_balconies', slabs),
                       ('wall_panels', windows)):
        counts[key] = counts.get(key, 0) + value
    return windows, doors, slabs


def author_modern_front(mesh, lot, front, kit, primary=True, top_override=None):
    """A street front of the post-1945 apartment kit (modern_bays): flat brick on a concrete base, a balcony with a
    patio door on every bay of every upper floor, a glazed entrance under a canopy on the main front, and a brick
    parapet with a metal coping MODERN_PARAPET over the roof. Same record as author_front."""
    F = Frame(mesh, front['a'], front['b'])
    W = front['width']
    wall = lot['masonry'] if lot['masonry'] != 'Stone' else 'Brick_Brown'
    floors = _floor_levels(lot)
    top = max(floors[-1] + 12 + 100, lot['height_cm'] + 15)
    if top_override:
        top = max(top, top_override)
    base = lot['raise'] + 10
    F.quad_d('Stone_Cast', 0, W, 0, base, D_FACE)
    F.quad_d(wall, 0, W, base, top, D_FACE)
    for x, side in ((0, -1), (W, 1)):
        F.quad_x(wall, x, D_BACK, D_FACE, 0, top, side)
    modern_bays(mesh, F, W, floors, top, ('Sheet_Metal', lot['guard_paint'], lot['panel_paint']), kit.counts,
                entrance=primary)
    F.box('Sheet_Metal', 0, W, -18, D_FACE + 3, top, top + 4, skip='b')
    if top > lot['height_cm']:
        F.quad_d(wall, 0, W, lot['height_cm'], top, D_BACK, -1)
    kit.count('modern_fronts')
    record = {'a': [round(v, 2) for v in front['a']], 'b': [round(v, 2) for v in front['b']],
              'width_cm': round(W, 1), 'street': front['street'], 'yard_cm': front['yard'],
              'yard_source': front['yard_source'], 'top_cm': round(top, 1), 'modules': 1,
              'exterior_stairs': 0, 'stairs': [], 'kit': 'post-1945 apartment'}
    return record, top


def _extension(mesh, lot, top, skin_edges, roof='Roof_Membrane'):
    """Close the band between the retained mass top and the taller plex front, and cap it with the roof."""
    points = lot['points']
    z0, z1 = lot['height_cm'], roof_level(lot, top)      # top - 10, or lower under a post-1945 parapet
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
        mesh.face(roof, [(p[0], p[1], z1) for p in triangle], (0, 0, 1))
    return 1


# ------------------------------------------------------------------------------------- roofs
# Plateau flat roofs seen from above (Ville de Montréal, "Rénover un toit plat ou à faible pente": on the Plateau a
# replaced flat roof is white, painted white or reflective (SRI >= 78) or white gravel ballast; a terrace or
# mechanical equipment is exempt): mostly white membrane, some white gravel, a few older black tar-and-gravel roofs.
# Party walls rise a little above the roofs as parapets with a metal coping, stepping where neighbours differ; each
# lot has a roof hatch and a brick chimney box, and a few have a deck terrace behind a rail, reached by a small
# metal stair bulkhead. Prop scatter on the roof follows the usual procedural-building approach (props sampled on
# the roof polygon with seeded positions, kept inside it), as in Houdini building generators.
PARAPET = 24.          # party-wall parapet over the roof, under its 4 cm coping, never above the front's top
BULKHEAD_SETBACK = 470. # a terrace's stair bulkhead stands about twice its height behind the front line
ROOF_SKIN = 2.         # roof skin over a retained mass top that the front does not rise 20 cm above
ROOF_MIX = ((.62, 'Roof_Membrane'), (.9, 'Roof_Gravel'), (1.01, 'Roof_Tar'))
TERRACE_SHARE = .09


def roof_level(lot, top):
    """Roof surface height: the extension cap (top - 10) or a skin just over the retained mass top. A post-1945 block
    keeps its roof MODERN_PARAPET under the front's coping, behind a parapet, where the mass allows it."""
    if lot.get('modern') and top - MODERN_PARAPET - lot['height_cm'] >= 10:
        return top - MODERN_PARAPET
    return top - 10 if top - 10 - lot['height_cm'] >= 10 else lot['height_cm'] + ROOF_SKIN


def _parapet(R, top, modern=False):
    """Top of a party parapet (under its 4 cm coping): PARAPET over the roof, or level with the front's coping on a
    post-1945 block."""
    return min(R + (MODERN_PARAPET - 4 if modern else PARAPET), top)


def _party_plan(lot, levels, tops, modern=()):
    """Per party edge: the neighbour's roof (a plex lot's roof level, else its mass top) and, where this lot stands
    30 cm or more above it, the height from which the party wall shows and gets a brick skin. `modern`: the ids of
    the post-1945 blocks, whose parapets stand higher."""
    R = levels[lot['id']]
    plans = []
    for edge in lot.get('party', ()):
        neighbour = edge['neighbour']
        plex = neighbour in levels
        below = levels[neighbour] if plex else edge['neighbour_height']
        neighbour_top = _parapet(below, tops[neighbour], neighbour in modern) + 4 if plex else below
        exposed = R - below >= 30
        plans.append(dict(edge, roof_below=below, neighbour_top=neighbour_top, skin=exposed))
    return plans


def author_roof(mesh, lot, top, levels, skins, counts, tops, modern=()):
    """The roof of one lot: membrane, gravel or tar over the mass (or the extension cap), party parapets with a
    metal coping, a hatch, a brick chimney box and, on a few, a terrace with a rail. Returns (record, extended)."""
    rng = random.Random(_seed('plex-roof', lot['id']))
    pick, hatch_f, hatch_t = rng.random(), rng.random(), rng.uniform(.4, .65)
    chimney_left, chimney_t, chimney_h = rng.random() < .5, rng.uniform(.25, .5), rng.uniform(100., 160.)
    terrace_roll, terrace_w, terrace_t = rng.random(), rng.uniform(320., 480.), rng.uniform(300., 420.)
    roof = next(key for limit, key in ROOF_MIX if pick < limit)
    R = levels[lot['id']]
    P = _parapet(R, top, bool(lot.get('modern')))
    masonry = lot['masonry'] if lot['masonry'] != 'Stone' else 'Brick_Red'

    def count(key, n=1):
        counts[key] = counts.get(key, 0) + n
    party = _party_plan(lot, levels, tops, modern)
    extended = _extension(mesh, lot, top, skins + [(e['a'], e['b']) for e in party if e['skin']], roof)
    points = lot['points']
    if not extended:
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        for triangle in triangulate([list(points)], (min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1)):
            mesh.face(roof, [(p[0], p[1], R) for p in triangle], (0, 0, 1))
    count('roof_' + roof)
    # party parapets: membrane turned up the inner face, a metal coping, and a brick skin over the party wall where
    # it stands above a lower neighbour (that covers the old glass cards there); the copings step with the roofs
    party_records = []
    for edge in party:
        F = Frame(mesh, edge['a'], edge['b'])
        for x0, x1 in edge['spans']:
            F.quad_d(roof, x0, x1, R, P, -16, -1)
            if edge['skin']:
                z0 = edge['roof_below']
                F.quad_d(masonry, x0, x1, z0, P, D_FACE, 1)
                F.quad_x(masonry, x0, 0, D_FACE, z0, P, -1)
                F.quad_x(masonry, x1, 0, D_FACE, z0, P, 1)
                F.box('Sheet_Metal', x0, x1, -18, D_FACE + 2, P, P + 4, skip='b')
                count('party_skins')
            else:
                # the coping's face on the party line is hidden inside the neighbour's coping at the same height
                F.box('Sheet_Metal', x0, x1, -18, 0, P, P + 4, skip='b' + ('f' if abs(P + 4 - edge['neighbour_top']) < 1 else ''))
                step = max(R, edge['neighbour_top'])
                if P - step > 1:
                    F.quad_d(masonry, x0, x1, step, P, 0, 1)
            count('party_copings')
            party_records.append({'a': [round(v, 1) for v in F.p(x0, 0, 0)[:2]], 'b': [round(v, 1) for v in F.p(x1, 0, 0)[:2]],
                                  'neighbour': edge['neighbour'], 'top_cm': round(P + 4, 1),
                                  'skin_from_cm': round(edge['roof_below'], 1) if edge['skin'] else None})
    # props in the frame of the main front: x along it, t = depth into the lot
    front = lot['primary']
    Ff = Frame(mesh, front['a'], front['b'])
    W = front['width']
    a, u, n = front['a'], Ff.u, Ff.n
    depth = max(-((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]) for p in points)

    def fits(x0, x1, t0, t1, margin=30.):
        corners = [(x, t) for x in (x0 - margin, (x0 + x1) / 2, x1 + margin) for t in (t0 - margin, (t0 + t1) / 2, t1 + margin)]
        return all(_inside(Ff.p(x, -t, 0)[:2], points) for x, t in corners)
    placed = []

    def free(x0, x1, t0, t1):
        return all(x1 + 40 <= q[0] or x0 - 40 >= q[1] or t1 + 40 <= q[2] or t0 - 40 >= q[3] for q in placed)

    def box(mat, x0, x1, t0, t1, z0, z1, skip='b'):
        Ff.box(mat, x0, x1, -t1, -t0, z0, z1, skip)
    record = {'material': roof, 'z_cm': round(R, 1), 'party': party_records, 'chimney': False, 'hatch': False,
              'terrace': False}
    modern = bool(lot.get('modern'))
    # chimney box against a party side, a third of the way back, with a cast-stone cap (a post-1945 block has a lift
    # penthouse and roof vents instead, below)
    tc = chimney_t * depth
    for x, tc in [(x, t) for t in (tc, depth * .5, depth * .3) for x in ((70., W - 70.) if chimney_left else (W - 70., 70.)) + (W / 2,)]:
        if not modern and W >= 160 and fits(x - 30, x + 30, tc - 22, tc + 22, 25):
            box(masonry, x - 30, x + 30, tc - 22, tc + 22, R, R + chimney_h)
            box('Stone_Cast', x - 35, x + 35, tc - 27, tc + 27, R + chimney_h, R + chimney_h + 6)
            placed.append((x - 35, x + 35, tc - 27, tc + 27))
            record['chimney'] = True
            count('chimneys')
            break
    # terrace: a deck at the back of the roof behind a baluster rail, and the metal stair bulkhead that reaches it
    t1 = depth - 150
    t0 = t1 - terrace_t
    x0, x1 = 70., min(W - 70., 70. + terrace_w)
    if (terrace_roll < TERRACE_SHARE and lot['storeys'] <= 4 and W >= 520 and depth >= 1100
            and t0 - 230 >= BULKHEAD_SETBACK and fits(x0, x1, t0, t1) and fits(x0, x0 + 120, t0 - 230, t0)
            and free(x0, x1, t0 - 230, t1)):
        box('Wood_Oak', x0, x1, t0, t1, R, R + 14)
        zr = R + 14
        for (ax, at), (bx, bt) in (((x0 + 5, t1 - 5), (x1 - 5, t1 - 5)), ((x0 + 5, t0 + 5), (x0 + 5, t1 - 5)),
                                   ((x1 - 5, t0 + 5), (x1 - 5, t1 - 5)), ((x0 + 125, t0 + 5), (x1 - 5, t0 + 5))):
            pa, pb = Ff.p(ax, -at, zr), Ff.p(bx, -bt, zr)
            if math.dist(pa[:2], pb[:2]) < 20:
                continue
            # one face: the masked material is two-sided, and a second coplanar face would z-fight
            cutout(mesh, 'Rail_Baluster', pa, pb, zr, zr + GUARD_H)
        box('Sheet_Metal', x0, x0 + 120, t0 - 230, t0, R, R + 235)
        Ff.quad_d('Wood_Grey', x0 + 18, x0 + 102, R + 2, R + 205, -t0 - 1, -1)
        placed.append((x0, x1, t0 - 230, t1))
        record['terrace'] = True
        count('roof_terraces')
    elif not modern:
        # roof hatch: a galvanised curb and lid
        for xh, th in ((W * (.35 + .3 * hatch_f), hatch_t * depth), (W / 2, depth * .5), (W / 2, depth * .3),
                       (W / 2, depth * .7), (W * .3, depth * .5), (W * .7, depth * .5)):
            if W >= 200 and fits(xh - 40, xh + 40, th - 40, th + 40, 20) and free(xh - 40, xh + 40, th - 40, th + 40):
                box('Sheet_Metal', xh - 40, xh + 40, th - 40, th + 40, R, R + 45)
                record['hatch'] = True
                count('roof_hatches')
                break
    if modern:
        _modern_roof(lot, record, W, depth, R, masonry, box, fits, free, placed, count)
    return record, extended


def _modern_roof(lot, record, W, depth, R, masonry, box, fits, free, placed, count):
    """The roof of a post-1945 block: a brick lift penthouse (machine room and stair head) with a metal coping near
    the middle, two on a block over 30 m deep, and a few galvanised mushroom vents. Own seed, after the roof draws."""
    mr = random.Random(_seed('plex-modern-roof', lot['id']))
    pw, pd = min(600., W * .45), min(420., depth * .3)
    heights = [mr.uniform(280., 340.) for _ in range(2)]
    record['penthouses'] = 0
    for k, t in enumerate((depth * .5,) if depth < 3000 else (depth * .3, depth * .7)):
        for xc, tc in ((W / 2, t), (W / 2, t - depth * .1), (W / 2, t + depth * .1), (W * .35, t), (W * .65, t)):
            x0, x1, t0, t1 = xc - pw / 2, xc + pw / 2, tc - pd / 2, tc + pd / 2
            if pw >= 250 and pd >= 250 and fits(x0, x1, t0, t1) and free(x0, x1, t0, t1):
                ph = heights[k]
                box(masonry, x0, x1, t0, t1, R, R + ph)
                box('Sheet_Metal', x0 - 4, x1 + 4, t0 - 4, t1 + 4, R + ph, R + ph + 6)
                placed.append((x0 - 4, x1 + 4, t0 - 4, t1 + 4))
                record['penthouses'] += 1
                count('roof_penthouses')
                break
    vents = 0
    for _ in range(10):
        xv, tv = mr.uniform(80., W - 80.), mr.uniform(120., depth - 120.)
        if vents < 5 and W >= 240 and fits(xv - 22, xv + 22, tv - 22, tv + 22, 20) and free(xv - 22, xv + 22, tv - 22, tv + 22):
            box('Sheet_Metal', xv - 12, xv + 12, tv - 12, tv + 12, R, R + 55)
            box('Sheet_Metal', xv - 22, xv + 22, tv - 22, tv + 22, R + 55, R + 70)
            placed.append((xv - 22, xv + 22, tv - 22, tv + 22))
            vents += 1
    record['vents'] = vents
    count('roof_vents', vents)


# ----------------------------------------------------------------------------- rear of the lot
# Plateau rears (research §13, the Plateau and Villeray ruelles vertes guides, the heritage sheets): plain brick
# or painted siding with a door and a window or two per floor; a wooden gallery on every upper floor across most
# of the lot, on square posts from the yard; a steep straight wooden flight or a steel spiral between galleries;
# a yard closed toward the ruelle by a board or slatted chain-link fence with a gate; here and there a shed
# (hangar) or garage with its door on the lane, a cedar hedge, a small cedar or a creeper. Low-poly on purpose:
# guards and fences are cut-out cards between rails, open treads are their top faces (an iron underside on the
# spiral treads), one post per gallery corner from yard to top.
FENCE_FROM_ALLEY = 290.     # fence line from the ruelle centreline: the 430 cm lane strip plus a verge
TRAFFIC_CLEAR = 300.        # Streets layer rule: no collision within 300 cm of a drive or service centreline
GUARD_H = 107.              # guards over 1.89 m above grade are 1070 mm (MRC de Coaticook SARP gallery sheet)
HEAD_EXIT = 110.            # clear way from a gallery's end guard to the opening guard at a flight head: the 84 cm
                            # player capsule (QuebecGameplay.cpp, radius 42) plus room to turn
STAIR_W = 90.
REAR_RISE = 22.5            # steep rear flights (research §6: about 45-50 degrees, risers 20-23 cm)
GOING_MAX, GOING_MIN = 24., 20.
SPIRAL_R = 70.
SPIRAL_STEPS = 16           # treads per full turn; one turn per storey above the first gallery
REAR_WINDOW = 80.
REAR_HEAD = 215.            # door and window heads line up on the rear walls
# Gallery paint: wood colours only (grey deck paint, stained oak, green, burgundy, cream); steel galleries on blocks
# of five storeys or more are black iron. Eight entries, as before, so every lot's later draws stay put.
REAR_PAINT = ('Wood_Grey', 'Wood_Grey', 'Wood_Oak', 'Wood_Cream', 'Wood_Green', 'Wood_Oak', 'Wood_Burgundy', 'Wood_Grey')
REAR_DOORS = ('Trim', 'Trim', 'Wood_Oak', 'Wood_Grey', 'Wood_Green', 'Wood_Burgundy')
# Gallery guards as built on the Plateau: a 2x4 bottom rail, 2x2 balusters at 12.5 cm centres and a 2x4 top rail
# under a flat cap, 107 cm in all; the baluster card (Textures/balusters) draws the same rails where these stand.
DECK_T = 4.                 # deck boards over the joists (Wood_Deck, collision)
FASCIA_H, FASCIA_T = 10., 2.5   # painted rim board on the outer deck edge (the old deck edge was an 18 cm slab)
RAIL_LOW = (5., 13.9)       # bottom rail over a 5 cm drain gap
CAP_H, CAP_W = 12.7, 6.    # top rail and flat cap as one box, 94.3 to 107 cm
BALUSTER_SHARE = .7         # guards with baluster cards; the rest are solid boards between the rails
GROUND_DECK_SHARE = .4      # straight stacks whose ground-floor stoop is a low gallery on a lattice skirt
SKIRT_H = 100.              # the lattice card is drawn 1 m tall; a skirt keeps that and runs below grade
GATE_PAINT = ('Wood_Green', 'Wood_Burgundy', 'Iron', 'Wood_Cream', 'Wood_Grey', 'Wood_Green')
# Rear-surfaces pass. Solid guards are clapboard or aluminium lap siding with visible laps, not a flat painted board
# (on a sided lot, the lot's own siding); gate leaves are board cards on a painted ledge-and-brace frame; side-by-side
# galleries have a privacy screen at their shared posts; rear windows have white frames and a blind or curtains.
GUARD_CREAM = .45           # solid guards in cream lap siding; the rest grey
PARTITION_LATTICE = .6      # privacy screens of lattice (two 1 m cards, as drawn); the rest a 1.8 m board card
PARTITION_H = {'lattice': 200., 'boards': 180.}     # screen heights over the deck, under the 2x4 cap rail
PARTITION_GAP = 60.         # neighbouring lots' gallery ends this close (along the wall line) share a screen
GATE_LEDGES = (.2, .78)     # the gate's two painted ledges, as fractions of the leaf height, with a brace between
DOOR_CLEAR = 101.           # deck kept clear of props this far either side of a gallery door's centre (43 + 58)
HEAD_CLEAR = 100.           # and this far past a flight's head, so the 42 cm player capsule still turns round the
                            # end of the opening guard there and walks every way with the props floor filled
BLIND_D = D_FACE + 3.       # blinds and curtains: just over the glass (D_FACE + 2.5), under the meeting rail (+ 3.5)
BLINDS = ('Trim', 'Trim', 'Trim', 'Wood_Cream', 'Wood_Cream', 'Stone_Cast')     # white, cream and beige
CURTAINS = ('Trim', 'Wood_Cream', 'Wood_Cream', 'Stone_Cast', 'Wood_Burgundy', 'Wood_Green')
POST_SPACING = 244.         # 8 ft fence bays
OPEN_SHARE, LOW_SHARE = .24, .14    # lane edges left open as a parking pad, or closed by a low picket fence
PAD_W, PAD_D = 270., 480.   # a parking pad (crushed stone) off the ruelle, one small car deep
OPEN_YARD_D = 1100.         # a yard with open ground behind it ends here (the old code left it bare and unfenced)
# Lap siding (clapboard) on rear and side walls only, never on a street or lane wall. Five entries, as the old flat
# colours had, so the draw sequence of every lot is unchanged; the white and green ones became grey.
SIDING = ('Siding_Lap_Cream', 'Siding_Lap_Grey', 'Siding_Lap_Grey', 'Siding_Lap_Cream', 'Siding_Lap_Grey')
SIDING_SETBACK = 600.       # no siding on a wall that comes this close behind the front line
COMMON_BRICK = ('Brick_Red', 'Brick_Red', 'Brick_Brown')      # common brick; also keeps the 142.5 m batch tile
FENCE_WOOD = ('Wood_Oak', 'Wood_Oak', 'Wood_Grey', 'Wood_Grey', 'Wood_Green', 'Wood_Burgundy', 'Wood_Cream')
SHED_WALLS = ('Wood_Grey', 'Wood_Oak', 'Wood_Green', 'Wood_Cream', 'Iron', 'Wood_Burgundy')


LONG_WALL, LONG_CLEAR = 800., 120.    # a side wall this long with no neighbour this close is a windowed long wall
PIECE_MIN = 150.                      # shortest free stretch of a wall a neighbour partly covers that gets a skin


def _back_walls(points, fronts, obstacles, shared, roads, primary_normal):
    """Exposed walls that are not street fronts (CGA comp(f) after Müller et al. 2006): 'rear' (facing away from
    the front), 'lane' (on a ruelle), 'street' (an unnamed-front street side), 'long' (a side wall over 8 m with no
    neighbour within 1.2 m) and 'side' walls. Party walls and front runs are left out. A wall a neighbour mostly
    covers keeps its free stretches as 'piece' walls (the paper's occlusion test, per stretch), so the old glass
    cards on the open part are covered too. primary_normal None (a mass with no front) makes no wall a rear wall."""
    count = len(points)

    def front_edge(a, b):
        return any(_nearest(a, f['a'], f['b'])[0] < 35 and _nearest(b, f['a'], f['b'])[0] < 35 for f in fronts)

    def covered(p):
        return any(_inside(p, other) for other in obstacles[1:])

    candidates = []
    for i in range(count):
        a, b = points[i], points[(i + 1) % count]
        width = math.dist(a, b)
        if width < 100 or tuple(sorted((a, b))) in shared or front_edge(a, b):
            continue
        u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
        normal = (u[1], -u[0])
        samples = [(a[0] + (b[0] - a[0]) * f + normal[0] * 25, a[1] + (b[1] - a[1]) * f + normal[1] * 25)
                   for f in (.2, .5, .8)]
        if sum(covered(s) for s in samples) < 2:
            candidates.append((i, a, b, False))
            continue
        if width < PIECE_MIN:
            continue
        steps = max(2, math.ceil(width / 50) + 1)
        step = width / (steps - 1)
        free = [not covered((a[0] + u[0] * step * k + normal[0] * 25, a[1] + u[1] * step * k + normal[1] * 25))
                for k in range(steps)]
        start = None
        for k, ok in enumerate(free + [False]):
            if ok and start is None:
                start = k
            elif not ok and start is not None:
                x0 = 0. if start == 0 else (start - .5) * step
                x1 = width if k == steps else (k - .5) * step
                if x1 - x0 >= PIECE_MIN:
                    candidates.append((i, (a[0] + u[0] * x0, a[1] + u[1] * x0), (a[0] + u[0] * x1, a[1] + u[1] * x1), True))
                start = None
    walls = []
    for i, a, b, piece in candidates:
        width = math.dist(a, b)
        u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
        normal = (u[1], -u[0])
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
        dot = normal[0] * primary_normal[0] + normal[1] * primary_normal[1] if primary_normal else 0.
        if street is not None and (alley is None or street < alley):
            kind = 'street'
        elif alley is not None and alley - FENCE_FROM_ALLEY < 150:
            kind = 'lane'
        elif dot < -.7:
            kind = 'rear'
        elif width >= LONG_WALL and clear >= LONG_CLEAR:
            kind = 'long'
        else:
            kind = 'side'
        walls.append({'index': i, 'a': a, 'b': b, 'width': width, 'normal': normal, 'kind': kind,
                      'clear': round(clear, 1), 'alley': None if alley is None else round(alley, 1), 'piece': piece})
    # a skin ends flush with the next skin round a convex corner (no 16 cm notch, no return face); a piece stops
    # short of the corner, so it neither extends nor is extended to
    skinned = {w['index'] for w in walls if not w['piece']}
    for w in walls:
        i = w['index']
        for key, j in (('ext0', (i - 1) % count), ('ext1', (i + 1) % count)):
            if w['piece']:
                w[key] = False
                continue
            ja, jb = points[j], points[(j + 1) % count]
            e1, e2 = ((ja, jb), (w['a'], w['b'])) if key == 'ext0' else ((w['a'], w['b']), (ja, jb))
            cross = ((e1[1][0] - e1[0][0]) * (e2[1][1] - e2[0][1]) - (e1[1][1] - e1[0][1]) * (e2[1][0] - e2[0][0]))
            w[key] = (j in skinned or front_edge(ja, jb)) and cross > 0 and math.dist(ja, jb) >= 100
    return walls


def _party_edges(points, bid, fronts, backs, owners, neighbours, heights):
    """Party lines: edges shared with a neighbour, or with a neighbour within 25 cm of them, that are neither a front
    nor a fully skinned wall, with the neighbour's id and mass height. 'spans' are the stretches along the edge the
    neighbour covers (an edge a neighbour only partly covers keeps its free stretches as back-wall pieces). The
    roof pass caps the spans with a coping and skins any part left above a lower neighbour."""
    count = len(points)
    full = {w['index'] for w in backs if not w['piece']}
    edges = []
    for i in range(count):
        a, b = points[i], points[(i + 1) % count]
        width = math.dist(a, b)
        if width < 100 or i in full or any(_nearest(a, f['a'], f['b'])[0] < 35 and _nearest(b, f['a'], f['b'])[0] < 35
                                           for f in fronts):
            continue
        u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
        others = sorted(o for o in owners.get(tuple(sorted((a, b))), ()) if o != bid)
        shared = bool(others)
        if not others:
            for f in (.5, .2, .8):
                probe = (a[0] + (b[0] - a[0]) * f + u[1] * 25, a[1] + (b[1] - a[1]) * f - u[0] * 25)
                others = sorted(str(other[0]['id']) for other in neighbours if _inside(probe, other[1]))
                if others:
                    break
        if not others:
            continue
        pieces = sorted(tuple(sorted(((w['a'][0] - a[0]) * u[0] + (w['a'][1] - a[1]) * u[1],
                                      (w['b'][0] - a[0]) * u[0] + (w['b'][1] - a[1]) * u[1])))
                        for w in backs if w['index'] == i)
        spans = _subtract((0., width), pieces, 50.)
        if spans:
            edges.append({'index': i, 'a': a, 'b': b, 'neighbour': others[0], 'shared': shared,
                          'neighbour_height': heights.get(others[0], 0.), 'spans': spans})
    return edges


def _wall_span(wall, top):
    """Where a skin stands, for fronts.json and the glass-card audit: its wall line and its top."""
    return {'a': [round(v, 1) for v in wall['a']], 'b': [round(v, 1) for v in wall['b']], 'top_cm': round(top, 1)}


def _floor_levels(lot):
    """Floor heights of the front (author_front), so rear doors open at the same storeys."""
    FH, raise_cm = lot['floor_height'], lot['raise']
    ground = FH + 40 if lot['commercial'] else FH
    return [raise_cm] + [raise_cm + ground + FH * (k - 1) for k in range(1, lot['storeys'] + 1)]


def _rear_wall_top(lot, top):
    if top - 10 - lot['height_cm'] < 10:
        return lot['height_cm']
    return top if lot.get('modern') else top - 10      # a post-1945 parapet meets the front's coping


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


def _free_floor(base, reserved, minimum=40., min_area=2500.):
    """Axis-aligned rectangles (x0, x1, d0, d1) of `base` left after cutting out every `reserved` rectangle, keeping
    pieces at least `minimum` on each side and `min_area` cm² (a chair or a plant pot fits)."""
    rects = [base] if base[1] > base[0] and base[3] > base[2] else []
    for c0, c1, e0, e1 in reserved:
        out = []
        for x0, x1, d0, d1 in rects:
            if c1 <= x0 or c0 >= x1 or e1 <= d0 or e0 >= d1:
                out.append((x0, x1, d0, d1))
                continue
            if c0 > x0:
                out.append((x0, c0, d0, d1))
            if c1 < x1:
                out.append((c1, x1, d0, d1))
            m0, m1 = max(x0, c0), min(x1, c1)
            if e0 > d0:
                out.append((m0, m1, d0, e0))
            if e1 < d1:
                out.append((m0, m1, e1, d1))
        rects = out
    return [r for r in rects if r[1] - r[0] >= minimum and r[3] - r[2] >= minimum and (r[1] - r[0]) * (r[3] - r[2]) >= min_area]


class Occupancy:
    """World footprints of planned rear structures (galleries, stairs, sheds) for free-space checks."""

    def __init__(self):
        self.grid = Grid(1000)

    def add(self, polygon):
        self.grid.add(polygon, [p[0] for p in polygon], [p[1] for p in polygon])

    def hit(self, point):
        return any(_inside(point, polygon) for polygon in self.grid.near(point[0], point[1], 1))


GROUND_Z = {'Yard_Grass': 1.0, 'Yard_Soil': 1.4, 'Yard_Pavers': 1.8, 'Yard_Gravel': 2.0,   # cm over the floor
            'Asphalt_Lot': 1.6}
# Ground cover of a lot with no yard (no rear wall to hang a yard on: wings, lane buildings, the deep blocks): a lawn
# along each open wall and, where the strip is deep enough, asphalt parking with painted stalls at its far edge,
# where a car comes in from the ruelle or the court (the OMHM notice above lists a parking area at De Mentana).
OPEN_LAWN_D = 250.          # lawn band along the wall
OPEN_PARK_D = 500.          # stall depth; a strip 1 m deeper, with a ruelle or open ground at its edge, parks cars
STALL_W = 260.              # painted stall width
OPEN_CELL = 400.            # cells along the wall, so a neighbour's yard or a building cuts off only a short piece


def creeper(mesh, F, x0, x1, d, height, rng, top):
    """Virginia creeper (vigne vierge) on a wall or fence in frame F, from x0 to x1 in the plane d: Leaf_Creeper
    cards with a broken outline. The patch is split into strips of seeded width, each a convex pentagon with a
    slanted, peaked top, taller toward the middle of the patch, so the skyline is ragged; a few strips are left out
    as gaps and a few narrow runners climb past the rest. Nothing rises over `top`. World UVs (the 2 m tile)."""
    strips, x = 0, x0
    while x < x1 - 15:
        w = min(x1 - x, rng.uniform(35., 90.))
        if strips and rng.random() < .18:
            x += rng.uniform(8., 25.)
            continue
        runner = rng.random() < .15
        if runner:
            w = min(w, rng.uniform(15., 28.))
        t = (x + w / 2 - x0) / max(1., x1 - x0)
        envelope = height * (.5 + .5 * (1 - (2 * t - 1) ** 2)) * (1.3 if runner else rng.uniform(.75, 1.))
        hl, hr = (envelope * rng.uniform(.7, 1.) for _ in range(2))
        hm = min(top, max(hl, hr) + rng.uniform(2., 12.))
        hl, hr = min(hl, hm - 2), min(hr, hm - 2)
        if hm > 20 and min(hl, hr) > 10:
            p = F.p
            mesh.face('Leaf_Creeper', [p(x, d, 0), p(x + w, d, 0), p(x + w, d, hr), p(x + w / 2, d, hm), p(x, d, hl)],
                      F.out(0, 1, 0))
            strips += 1
        x += w
    return strips


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
        rng.choice(('Iron', 'Slate', 'Wood_Grey'))       # was the gallery roof colour; kept so later draws stay put
        self.roof_mat = 'Sheet_Metal'                     # gallery roofs are galvanised sheet, never slate
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
        # draws of the yards pass come from their own seed, so every earlier draw above stays put
        yr = random.Random(_seed('plex-yard', lot['id']))
        self.infill = 'boards' if yr.random() >= BALUSTER_SHARE else 'balusters'
        self.ground_roll, self.edge_roll, self.mix_roll = yr.random(), yr.random(), yr.random()
        self.beds = (yr.choice((0., 0., 60., 75., 90.)), yr.choice((0., 60., 75., 90.)), yr.choice((0., 0., 70., 90.)))
        self.patio_d = yr.uniform(200., 380.)
        self.pad_first = yr.random() < .5
        self.gate_alt = yr.choice(GATE_PAINT)
        self.vine_seed = yr.getrandbits(32)
        # draws of the rear-surfaces pass, from a seed of their own, so every draw above stays put: the lap siding of the
        # solid guards (the lot's own siding where its walls are sided) and the partition kind between side-by-side
        # galleries (a lattice screen or a board screen)
        sr = random.Random(_seed('plex-rear-surfaces', lot['id']))
        self.guard_siding = 'Siding_Lap_Cream' if sr.random() < GUARD_CREAM else 'Siding_Lap_Grey'
        self.partition = 'lattice' if sr.random() < PARTITION_LATTICE else 'boards'
        # rear windows and doors are white PVC or aluminium (the old draw is kept above so later draws stay put)
        self.frame = 'Trim'
        self.partitions = []        # (x, kind, neighbour id or None) at the stack wall's shared posts (plan_partitions)
        if lot['storeys'] >= 5:
            self.paint, self.roofed = 'Iron', False     # apartment blocks: steel fire-escape galleries
            self.infill = 'iron'
        # gates are painted and stand out from the fence: never natural wood, never the fence posts' own colour
        if self.gate_paint not in GATE_PAINT or self.gate_paint == self.fence_paint:
            self.gate_paint = next(p for p in (self.gate_alt,) + GATE_PAINT if p != self.fence_paint)
        # walls the street or the ruelle sees are brick: the front's own brick on a street wall, else common brick
        self.brick = brick
        self.street_brick = lot['masonry'] if lot['masonry'] in BRICKS else brick
        if lot.get('skin_wall'):                        # a background mass with a set finish (towers, pavilions)
            self.wall = self.brick = self.street_brick = lot['skin_wall']
            self.siding = False
            self.sill = 'Stone_Cast'
        # lap siding never on a block over four storeys (after every draw above, so they stay put); on the others it
        # stops at the top of the second storey, with the lot's brick above it (_skin_faces)
        self.modern = bool(lot.get('modern'))
        if self.siding and (lot['storeys'] > SIDING_MAX_STOREYS or self.modern):
            self.siding, self.wall, self.sill = False, brick, 'Stone_Cast'
        self.siding_top = self.floor_z[SIDING_STOREYS] if lot['storeys'] > SIDING_STOREYS else math.inf
        if self.modern:
            if lot['masonry'] == 'Stone':
                self.brick = self.street_brick = 'Brick_Brown'
            if not lot.get('skin_wall'):
                self.wall = self.street_brick = self.brick = lot['masonry'] if lot['masonry'] in BRICKS else self.brick
        if self.siding and self.wall in SIDING:
            self.guard_siding = self.wall               # a sided lot boards its solid guards in its own siding
        # the roof under a parapet: the skins rise over it with an inner face and a metal coping
        self.parapet_from = lot.get('parapet_from')
        self.background = bool(lot.get('background'))
        self.counts = {}
        self.stack = None
        self.yard_plan = None
        self.yard_reason = None
        self.reason = None
        backs = lot.get('backs', [])
        rears = sorted((w for w in backs if w['kind'] == 'rear' and w['width'] >= 300),
                       key=lambda w: (-w['width'], w['index']))
        self.main = rears[0] if rears else None
        if self.main is None and lot['storeys'] <= 4:
            # no rear wall: the galleries go on the windowed long wall with the most yard in front of it
            longs = sorted((w for w in backs if w['kind'] == 'long' and not w['piece']),
                           key=lambda w: (-w['clear'], -w['width'], w['index']))
            self.main = longs[0] if longs else None
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

    def blocked(self, point, near, occupancy, roads=None):
        """Inside a building or a planned structure; with `roads`, also too close to a drive, service or lane
        centreline ((segment, clearance) pairs), so fences and sheds never stand on a driveway or a street."""
        if any(_inside(point, poly) for poly in near) or occupancy.hit(point):
            return True
        return bool(roads) and any(_nearest(point, c, d)[0] < clearance for (c, d), clearance in roads)

    def yard_roads(self, points, margin=400.):
        """Road centrelines near `points` with the clearance a fence or shed keeps from them."""
        bx0, by0 = min(p[0] for p in points) - margin, min(p[1] for p in points) - margin
        bx1, by1 = max(p[0] for p in points) + margin, max(p[1] for p in points) + margin
        # a ruelle: its 430 cm strip plus a verge; a named street: past its curb (>= 550 cm) and sidewalk;
        # a driveway or parking aisle: its own width
        return [((c, d), FENCE_FROM_ALLEY - 10 if alley else 650. if named else 250.)
                for c, d, alley, named in self.lot.get('roads_near', ())
                if min(c[0], d[0]) <= bx1 + 400 and max(c[0], d[0]) >= bx0 - 400
                and min(c[1], d[1]) <= by1 + 400 and max(c[1], d[1]) >= by0 - 400]

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
        """No building or planned structure on a sample grid of the rectangle. roads=True (collision): every road
        centreline at least 300 cm away; roads=False (fences, sheds, plants): the yard road rule only."""
        corners = [F.p(x, d, 0)[:2] for x in (x0, x1) for d in (d0, d1)]
        bx0, by0 = min(p[0] for p in corners), min(p[1] for p in corners)
        bx1, by1 = max(p[0] for p in corners), max(p[1] for p in corners)
        near = self.near(corners)
        yard_roads = None if roads else self.yard_roads(corners)
        nx, nd = max(2, math.ceil((x1 - x0) / 45) + 1), max(2, math.ceil((d1 - d0) / 45) + 1)
        for i in range(nx):
            for j in range(nd):
                if self.blocked(F.p(x0 + (x1 - x0) * i / (nx - 1), d0 + (d1 - d0) * j / (nd - 1), 0)[:2], near,
                                occupancy, yard_roads):
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
        if self.modern:
            self.reason = 'post-1945 apartment block: a balcony on every bay, no rear galleries'
            return
        if wall is None:
            longs = any(w['kind'] == 'long' for w in self.lot.get('backs', ()))
            self.reason = ('no rear wall of 3 m or more; long walls carry galleries up to 4 storeys only' if longs
                           else 'no rear wall of 3 m or more and no long wall')
            return
        levels = [k for k in range(1, self.lot['storeys']) if self.floor_z[k] + REAR_HEAD <= self.zt - 10]
        if not levels:
            self.reason = 'no upper floor below the wall top'
            return
        yard, lane = self.yard(wall)
        W = wall['width']
        modules = max(1, round(W / 763)) if W >= 1150 else 1
        mw = W / modules
        offset = 0.
        if wall['kind'] == 'long':
            # a long side wall carries one stack, at its end farthest from the front (the back units' galleries)
            modules, mw = 1, min(W, 763.)
            front = self.lot['primary']
            depth = [-((p[0] - front['a'][0]) * front['normal'][0] + (p[1] - front['a'][1]) * front['normal'][1])
                     for p in (wall['a'], wall['b'])]
            offset = W - mw if depth[1] > depth[0] else 0.
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
            mx0, mx1 = offset + m * mw, offset + (m + 1) * mw
            gx0, gx1 = mx0 + 6, mx1 - 6
            if not self.free(F, gx0, gx1, D_FACE, plan['extent'], occupancy):
                self.reason = 'a building, structure or traffic lane behind the wall'
                return
            module = {'mx0': mx0, 'mx1': mx1, 'gx0': gx0, 'gx1': gx1, 'first': m == 0}
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
        # a low ground-floor gallery on a lattice skirt instead of the concrete stoop, with steps down to the yard at
        # the module's far end from the stair, inside the footprint band the first flight uses
        plan['ground'] = None
        raise_cm = self.lot['raise']
        if plan['kind'] == 'straight' and self.ground_roll < GROUND_DECK_SHARE and raise_cm >= 50 and not self.background:
            risers = math.ceil(raise_cm / 20.)
            going = min(25., (STAIR_W - 2) / max(1, risers - 1))
            run1 = (plan['n1'] - 1) * plan['going1']
            if all(m['gx0'] + 20 + 100 + 15 <= m['xh'] - run1 - plan['going1'] * .6 for m in plan['modules']):
                plan['ground'] = {'risers': risers, 'going': going, 'z': raise_cm}
        for polygon in footprints:
            occupancy.add(polygon)
        plan['footprints'] = footprints
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
            self.yard_reason = 'no rear wall of 2 m or more with 2.5 m in front of it'
            return
        extent = self.stack['extent'] if self.stack else D_FACE + 100
        if wall['alley'] is not None:
            fd, gate = wall['alley'] - FENCE_FROM_ALLEY, True
        elif wall['clear'] < 1990:
            fd, gate = wall['clear'] / 2, False
        else:
            # open ground behind (a court, a car park or an unmapped lane): the yard ends at a usual lot depth
            fd, gate = min(wall['clear'] / 2, OPEN_YARD_D), False
        F = Frame(None, wall['a'], wall['b'])
        a = wall['a']
        u, n = F.u, F.n
        local = [((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1], (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1])
                 for p in self.lot['points']]
        lx0, lx1 = min(x for x, _ in local), max(x for x, _ in local)
        if lx1 - lx0 < 250:
            self.yard_reason = 'lot under 2.5 m wide'
            return
        if gate and fd >= extent + 40:
            # a ruelle at a slant to the wall: measure it along the normal at both lot ends as well
            lanes = [[c, d] for c, d, alley, _ in self.lot.get('roads_near', ()) if alley]
            rays = [_outward_clearance(F.p(x, 0, 0)[:2], n, lanes) for x in (lx0 + 30, lx1 - 30)]
            fd = min([fd] + [r - FENCE_FROM_ALLEY for r in rays if r < 1999])
        if fd < extent + 40:
            if fd < D_FACE + 100:
                self.yard_reason = 'yard under 1 m deep'
                return
            # too shallow for a fence clear of the galleries, but the ground under them still shows
            plan = {'wall': wall, 'fd': fd, 'lx': (lx0, lx1), 'runs': [], 'gate': None, 'shed': None, 'lane': gate,
                    'extent': extent, 'hedge': None, 'cedar': None, 'edge': 'none', 'pad': None}
            plan['ground'], plan['mix'] = self._plan_ground(F, plan)
            self.yard_plan = plan
            return
        # free samples along the fence line (buildings, galleries and sheds already placed, roads)
        step = 40.
        count = max(2, math.ceil((lx1 - lx0) / step) + 1)
        xs = [lx0 + (lx1 - lx0) * i / (count - 1) for i in range(count)]
        ends = [F.p(lx0, fd, 0), F.p(lx1, fd, 0)]
        near, roads = self.near(ends, 5), self.yard_roads(ends)
        free = [not self.blocked(F.p(x, fd, 0)[:2], near, occupancy, roads) for x in xs]
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
            self.yard_reason = 'the fence line is blocked (buildings, structures or a drive)'
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
                gc = min(max(want, r0 + 50), r1 - 50)
                if gc - 50 - r0 < 45:          # no sliver of fence beside the gate
                    gc = r0 + 50
                elif r1 - gc - 50 < 45:
                    gc = r1 - 50
                key = (abs(gc - want), gc)
                if best is None or key < best[0]:
                    best = (key, gc)
            if best:
                plan['gate'] = best[1]
        # the lane edge: most yards close it with the fence and gate; a seeded share stay open as a parking pad off
        # the ruelle (no fence across the lot), and some close it with a low picket fence, so the lane edge breaks up
        plan['edge'], plan['pad'] = 'fence', None
        if gate and self.edge_roll < OPEN_SHARE:
            pad = self._plan_pad(F, fd, lx0, lx1, extent, occupancy)
            if pad:
                plan['edge'], plan['pad'], plan['gate'] = 'open', pad, None
                (px0, px1), (pd0, pd1) = pad
                occupancy.add([F.p(x, d, 0)[:2] for x, d in ((px0, pd0), (px1, pd0), (px1, pd1), (px0, pd1))])
            else:
                plan['edge'] = 'low'
        elif gate and self.edge_roll < OPEN_SHARE + LOW_SHARE:
            plan['edge'] = 'low'
        # shed (hangar) or garage against the fence, door on the lane, at the end away from the gate
        room = fd - extent - 40
        gc = plan['gate'] if plan['gate'] is not None else (lx0 + lx1) / 2
        far_right = gc < (lx0 + lx1) / 2
        if plan['edge'] == 'open':
            kind = None
        elif plan['lane'] and self.garage_roll < .1 and room >= 600 and lx1 - lx0 >= 480:
            kind, sw, sd = 'garage', 300., 560.
        elif self.shed_roll < .3 and room >= 200:
            kind, sw, sd = 'shed', self.shed_w, min(self.shed_d, room)
        else:
            kind = None
        if kind:
            sw = min(sw, lx1 - lx0 - 170)
            if sw >= 180:
                sx0, sx1 = (lx1 - 3 - sw, lx1 - 3) if far_right else (lx0 + 3, lx0 + 3 + sw)   # against the side fence
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
        plan['ground'], plan['mix'] = self._plan_ground(F, plan)
        self.yard_plan = plan

    def _plan_pad(self, F, fd, lx0, lx1, extent, occupancy):
        """A parking pad off the ruelle at one end of the lot, clear of the galleries, stairs and buildings."""
        if fd - PAD_D < extent + 30 or lx1 - lx0 < PAD_W + 60:
            return None
        ends = [(lx1 - 30 - PAD_W, lx1 - 30), (lx0 + 30, lx0 + 30 + PAD_W)]
        for px0, px1 in (ends if self.pad_first else ends[::-1]):
            if self.free(F, px0, px1, fd - PAD_D, fd - 5, occupancy, roads=False):
                return (px0, px1), (fd - PAD_D, fd)
        return None

    def _plan_ground(self, F, plan):
        """Ground cover of the yard as flat patches that never overlap: the cells of one grid in the wall frame, from
        the skin face to the fence line and between the lateral lot lines, each with one material by a seeded mix:
        a lawn with a paver patio by the house, a deep patio, a yard paved or gravelled throughout, or a lawn with a
        vegetable garden at the back; soil beds along the side fences and the back fence; the crushed-stone parking
        pad on an open lot. Cells inside a building are split and dropped; the shed's cell is left out."""
        lx0, lx1 = plan['lx']
        fd = plan['fd']
        d0 = D_FACE + 2
        depth = fd - d0
        if depth < 100:
            return [], None
        r = self.mix_roll
        mix = 'lawn' if r < .36 else 'patio' if r < .58 else 'paved' if r < .72 else 'gravel' if r < .82 else 'garden'
        bl, br, bf = self.beds
        if lx1 - lx0 < bl + br + 150:
            bl = br = 0.
        patio = {'lawn': min(self.patio_d, depth * .45), 'patio': min(self.patio_d + 160., depth * .7),
                 'garden': min(self.patio_d * .6, depth * .3)}.get(mix, 0.)
        if mix == 'garden':
            bf = max(bf, depth * .35)
        if depth - patio - bf < 80:
            bf = 0.
        centre = {'paved': 'Yard_Pavers', 'gravel': 'Yard_Gravel'}.get(mix, 'Yard_Grass')
        xs = {lx0, lx0 + bl, lx1 - br, lx1}
        ds = {d0, d0 + patio, fd - bf, fd}
        pad, shed = plan.get('pad'), plan.get('shed')
        for box in [b for b in (pad, shed and (shed['x'], shed['d'])) if b]:
            xs |= {min(max(v, lx0), lx1) for v in box[0]}
            ds |= {min(max(v, d0), fd) for v in box[1]}
        xs, ds = sorted(xs), sorted(ds)

        def inside(box, x, d):
            return box and box[0][0] <= x <= box[0][1] and box[1][0] <= d <= box[1][1]
        rows = []
        for da, db in zip(ds, ds[1:]):
            if db - da < 20:
                continue
            row = []
            for xa, xb in zip(xs, xs[1:]):
                if xb - xa < 20:
                    continue
                xc, dc = (xa + xb) / 2, (da + db) / 2
                if shed and inside((shed['x'], shed['d']), xc, dc):
                    mat = None
                elif inside(pad, xc, dc):
                    mat = 'Yard_Gravel'
                elif dc < d0 + patio:
                    mat = 'Yard_Pavers'
                elif xc < lx0 + bl or xc > lx1 - br or dc > fd - bf:
                    mat = 'Yard_Soil'
                else:
                    mat = centre
                if row and row[-1][0] == mat and abs(row[-1][2] - xa) < .01:
                    row[-1] = (mat, row[-1][1], xb)
                else:
                    row.append((mat, xa, xb))
            rows += [(mat, xa, xb, da, db) for mat, xa, xb in row if mat]
        cells = []
        near = self.near([F.p(x, d, 0)[:2] for x in (lx0, lx1) for d in (d0, fd)])

        def keep(mat, xa, xb, da, db, depth_left):
            nx, nd = max(2, math.ceil((xb - xa) / 60) + 1), max(2, math.ceil((db - da) / 60) + 1)
            hits = sum(any(_inside(F.p(xa + (xb - xa) * i / (nx - 1), da + (db - da) * j / (nd - 1), 0)[:2], poly)
                           for poly in near) for i in range(nx) for j in range(nd))
            if not hits:
                cells.append((mat, xa, xb, da, db))
            elif hits < nx * nd and depth_left and min(xb - xa, db - da) >= 60:
                xm, dm = (xa + xb) / 2, (da + db) / 2
                for x0, x1, e0, e1 in ((xa, xm, da, dm), (xm, xb, da, dm), (xa, xm, dm, db), (xm, xb, dm, db)):
                    keep(mat, x0, x1, e0, e1, depth_left - 1)
        for cell in rows:
            keep(*cell, 3)
        return cells, mix

    # ------------------------------------------------------------------ authoring
    def author(self, mesh):
        record = {'walls': [], 'wall_top_cm': round(self.zt, 1), 'galleries': 0, 'stair': None, 'flights': [],
                  'decks': [], 'guards': [], 'partitions': [], 'fence': None, 'shed': None, 'yard': None,
                  'reason': self.reason,
                  'yard_reason': None if self.yard_plan else self.yard_reason}
        for wall in self.lot.get('backs', []):
            if self.stack and wall is self.stack['wall']:
                self._author_stack_wall(mesh, wall, record)
            else:
                self._author_skin(mesh, wall, record)
        if self.yard_plan:
            self._author_yard(mesh, record)
        return record

    def wall_mat(self, wall):
        """Street walls in the front's brick, lane and long walls in common brick, the rest brick or lap siding.
        Siding stays on the back of the lot: a side wall that comes within 6 m of the front line is brick, since the
        street sees it past the corner."""
        if wall['kind'] == 'street':
            return self.street_brick
        if wall['kind'] in ('lane', 'long'):
            return self.brick
        front = self.lot.get('primary')
        if self.siding and front:
            a, n = front['a'], front['normal']
            if min(-((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]) for p in (wall['a'], wall['b'])) < SIDING_SETBACK:
                return self.street_brick
        return self.wall

    def base_of(self, wall):
        """The foundation band: the front's greystone on a street wall, parged concrete everywhere else."""
        if wall['kind'] == 'street':
            return self.lot['raise'], 'Stone'
        return max(30., min(90., self.lot['raise'])), 'Parged'

    def _skin_faces(self, F, wall, base, mat, base_mat):
        """One opaque plane 16 cm proud of the retained wall (hiding its old glass cards), a foundation band,
        sheet-metal flashing on top, and returns at free ends. Lap siding stops at the top of the second storey,
        with the lot's brick above. Over a parapet roof the skin shows an inner face down to the roof and wears a
        metal coping instead of the flat flashing. Returns the material above the siding, or None."""
        W, zt = wall['width'], self.zt
        x_start = -D_FACE if wall['ext0'] else 0.
        x_end = W + D_FACE if wall['ext1'] else W
        upper = None
        split = zt
        if mat in SIDING and self.siding_top < zt - 20:
            upper, split = self.brick if self.brick not in SIDING else 'Brick_Red', self.siding_top
        if base > 0:
            F.quad_d(base_mat, x_start, x_end, 0, base, D_FACE)
        F.quad_d(mat, x_start, x_end, base, split, D_FACE)
        if upper:
            F.quad_d(upper, x_start, x_end, split, zt, D_FACE)
        if self.parapet_from is not None and zt - self.parapet_from >= 20:
            F.quad_d(upper or mat, x_start, x_end, self.parapet_from, zt, 0, -1)
            F.box('Sheet_Metal', x_start, x_end, -3, D_FACE + 3, zt, zt + 4, skip='b')
        else:
            F.quad_z('Sheet_Metal', x_start, x_end, 0, D_FACE, zt, 1)
        for x, ext, side in ((0, wall['ext0'], -1), (W, wall['ext1'], 1)):
            if not ext:
                F.quad_x(mat, x, 0, D_FACE, 0, split, side)
                if upper:
                    F.quad_x(upper, x, 0, D_FACE, split, zt, side)
        return upper

    def _window(self, F, x0, x1, z0, z1, rail=True, sill=None, lintel=None):
        """Applied window: frame field (white, Trim), glass with a blind or curtains behind it, meeting rail and a proud
        sill (the wall is not cut). A street wall window takes the front's deeper stone sill and its lintel (stone,
        cast stone or painted wood)."""
        F.quad_d(self.frame, x0, x1, z0, z1, D_FACE + 1)
        F.quad_d('Glass', x0 + 6, x1 - 6, z0 + 6, z1 - 6, D_FACE + 2.5)
        blind(F, x0 + 6, x1 - 6, z0 + 6, z1 - 6, self.counts)
        if rail:
            zm = (z0 + z1) / 2
            F.quad_d(self.frame, x0 + 6, x1 - 6, zm - 2.5, zm + 2.5, D_FACE + 3.5)
        if sill:
            F.box(sill, x0 - 9, x1 + 9, D_FACE - 1, D_FACE + 6, z0 - 13, z0, skip='kb')
        else:
            F.box(self.sill, x0 - 5, x1 + 5, D_FACE - 1, D_FACE + 5, z0 - 5, z0, skip='kblr')
        if lintel:
            F.box(lintel, x0 - 10, x1 + 10, D_FACE - 1, D_FACE + 3, z1, z1 + 22, skip='kb')
        self.count('windows')

    def _door(self, F, x0, x1, z0, z1):
        """Applied half-glazed back door with its frame and a sill."""
        F.quad_d(self.frame, x0, x1, z0, z1, D_FACE + 1)
        F.quad_d(self.door, x0 + 6, x1 - 6, z0, z1 - 6, D_FACE + 2.5)
        F.quad_d('Glass', x0 + 16, x1 - 16, z0 + 110, z1 - 22, D_FACE + 3.5)
        F.quad_z('Stone_Cast' if not self.siding else 'Trim', x0 - 4, x1 + 4, D_FACE - 1, D_FACE + 5, z0 + 1, 1)
        self.count('doors')

    def _street_lintel(self):
        lot = self.lot
        if lot['year'] < 1890 and lot['masonry'] != 'Stone':
            return lot['paint']
        return 'Stone_Cast' if lot['year'] >= 1912 else 'Stone'

    def _cornice_return(self, F, wall):
        """The front's crown returns one bay (4.5 m) along a street wall from the front corner: the cornice with
        its frieze and an end bracket, or the parapet's cast-stone band (heritage sheet 'Les couronnements')."""
        lot = self.lot
        crown = lot['crown']
        if crown not in ('cornice_wood', 'cornice_metal', 'parapet'):
            return
        fronts = [lot['primary']] + list(lot.get('sides', ()))

        def touches(p):
            return any(min(math.dist(p, f['a']), math.dist(p, f['b'])) < 60 for f in fronts)
        W = wall['width']
        run = min(W, 450.)
        reach = D_FACE + (48 if crown != 'parapet' else 5)   # meet the front crown's projection at the corner
        spans = ([(-reach, run, 'l', run)] if touches(wall['a']) else []) + \
                ([(W - run, W + reach, 'r', W - run)] if touches(wall['b']) else [])
        zc = self.floor_z[-1] + 12
        paint = lot['paint']
        for x0, x1, corner, x_end in spans:
            if crown == 'parapet':
                F.box('Stone_Cast', x0, x1, D_FACE - 2, D_FACE + 5, self.zt - 12, self.zt + 2, skip='k' + corner)
            else:
                F.box(paint, x0, x1, D_FACE - 1, D_FACE + 48, zc, zc + 20, skip='k' + corner)
                F.box(paint, x0, x1, D_FACE - 1, D_FACE + 4, zc - 60, zc, skip='kt' + corner)
                F.box(paint, x_end - 11, x_end + 11, D_FACE + 4, D_FACE + 40, zc - 78, zc - 8, skip='kt')
            self.count('cornice_returns')

    def _author_skin(self, mesh, wall, record):
        """Rear, lane, street and long walls get windows (one per floor on a secondary rear wall, else one per
        4.5 m bay and floor); side walls a plain skin. A background mass windows every wall with room in front."""
        F = Frame(mesh, wall['a'], wall['b'])
        W = wall['width']
        kind = wall['kind']
        windows = doors = balconies = 0
        if self.background:
            # a denser grid than the old 4.5 m bay, which left the background walls reading as blank boxes
            windowed, bays = W >= 250 and wall['clear'] >= LONG_CLEAR, max(1, round(W / BACKGROUND_BAY))
        else:
            windowed = kind in ('lane', 'street', 'long') and W >= 250 or kind == 'rear' and W >= 300
            bays = 1 if kind == 'rear' else max(1, int(W // 450))
        street = kind == 'street' and not self.background
        FH = self.lot['floor_height']
        if self.modern:
            # the post-1945 kit: bays about every 3 m on every wall with room in front of it, and a balcony on every
            # bay (every second bay on the towers) where the wall is long and open enough
            if W >= 250 and wall['clear'] >= LONG_CLEAR:
                balc = W >= 450 and wall['clear'] >= BALCONY_CLEAR and not wall['piece']
                windows, doors, balconies = modern_bays(
                    mesh, F, W, self.floor_z, self.zt, ('Sheet_Metal', self.lot['guard_paint'], self.lot['panel_paint']),
                    self.counts, balconies=balc, every=2 if self.background else 1)
            windowed, street = False, False
        if windowed:
            for k in range(self.lot['storeys']):
                z = self.floor_z[k]
                if street:
                    z0, z1, ww = z + 75, z + 75 + min(200, FH - 118), 96.
                else:
                    z0, z1, ww = z + 80, z + REAR_HEAD, REAR_WINDOW
                if z1 + (22 if street else 0) > self.zt - 10:
                    break
                for i in range(bays):
                    c = (i + .5) * W / bays
                    if street:
                        self._window(F, c - ww / 2, c + ww / 2, z0, z1, rail=self.lot['sash'] == 'double_hung',
                                     sill='Stone' if self.street_brick != 'Stone' else 'Stone_Cast',
                                     lintel=self._street_lintel())
                    else:
                        self._window(F, c - ww / 2, c + ww / 2, z0, z1, rail=False)
                    windows += 1
        base, base_mat = self.base_of(wall)
        mat = self.wall_mat(wall)
        upper = self._skin_faces(F, wall, base, mat, base_mat)
        if street:
            self._cornice_return(F, wall)
        self.count('skins_' + kind)
        if kind == 'side' and W >= 300:
            # Virginia creeper (vigne vierge) on some blank yard walls: autumn red, or green ivy
            wr = random.Random(_seed('plex-rear-wall', self.lot['id'], wall['index']))
            if wr.random() < .2:
                w = min(W - 40, wr.uniform(180, 420))
                x0 = 20 + (W - 40 - w) * wr.random()
                h = min(self.zt - 40, wr.uniform(280, 720))
                wr.choice(('Wood_Burgundy', 'Wood_Burgundy', 'Wood_Green'))     # was the flat colour; keeps the draws
                strips = creeper(mesh, F, x0, x0 + w, D_FACE + 1.5, h, wr, self.zt - 30)
                self.count('creepers')
                self.count('creeper_strips', strips)
        record['walls'].append({'kind': kind, 'width_cm': round(W, 1), 'windows': windows, 'doors': doors,
                                'galleries': 0, 'balconies': balconies, 'material': mat, 'base': base_mat,
                                **self._siding_record(upper), **_wall_span(wall, self.zt)})

    def _siding_record(self, upper):
        """Where lap siding stops and what stands over it (only on a wall that has both)."""
        return {'upper': upper, 'siding_top_cm': round(self.siding_top, 1)} if upper else {}

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
            if not st.get('ground'):
                self._stoop(F, c, mx0, mx1, xd)
            mesh.unit = ('rear', self.lot['id'])       # the stack goes out of collision as one, never in part
            self._gallery_module(mesh, F, module, record)
            mesh.unit = None
        # privacy screens where galleries meet side by side: at the posts the modules share, and at a lot end that
        # meets a neighbour's gallery (plan_partitions); the steel fire escapes of tall blocks have none
        if self.infill != 'iron':
            for p in self.partitions:
                for z in p['zs']:
                    self._partition(mesh, F, p['x'], p['d1'], z, p['kind'], p['neighbour'], record)
        if wall['kind'] == 'long':
            # the rest of a long wall keeps its window per 4.5 m bay and floor
            used0, used1 = min(m['mx0'] for m in st['modules']), max(m['mx1'] for m in st['modules'])
            for s0, s1 in ((0., used0), (used1, W)):
                if s1 - s0 < 250:
                    continue
                bays = max(1, int((s1 - s0) // 450))
                for k in range(self.lot['storeys']):
                    z = self.floor_z[k]
                    if z + REAR_HEAD > self.zt - 10:
                        break
                    for i in range(bays):
                        cx = s0 + (i + .5) * (s1 - s0) / bays
                        self._window(F, cx - REAR_WINDOW / 2, cx + REAR_WINDOW / 2, z + 80, z + REAR_HEAD, rail=False)
                        windows += 1
        base, base_mat = self.base_of(wall)
        mat = self.wall_mat(wall)
        upper = self._skin_faces(F, wall, base, mat, base_mat)
        self.count('facades')
        record['stair'] = st['kind']
        record['footprints'] = [[[round(v, 1) for v in p] for p in polygon] for polygon in st['footprints']]
        record['walls'].append({'kind': wall['kind'], 'width_cm': round(W, 1), 'windows': windows, 'doors': doors,
                                'galleries': len(levels) * len(st['modules']), 'modules': len(st['modules']),
                                'material': mat, 'base': base_mat, **self._siding_record(upper),
                                **_wall_span(wall, self.zt)})

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
        box('Stone_Cast', xd - 55, xd + 55, D_FACE - 2, D_FACE + 85, 0, raise_cm, 'kb')
        steps = max(0, round(raise_cm / 20) - 1)
        rise = raise_cm / (steps + 1)
        for j in range(1, steps + 1):
            x1 = xd - 55 - (j - 1) * 27
            if x1 - 27 < mx0 + 8:
                break
            box('Stone_Cast', x1 - 27, x1, D_FACE - 2, D_FACE + 85, 0, raise_cm - j * rise, 'kbr')
        self.count('stoops')

    def _guard(self, mesh, pa, pb, z, out, top=GUARD_H, infill=None):
        """One straight guard run between world points pa and pb, standing on a deck top z: a 2x4 bottom rail over
        a drain gap, the top rail and its flat cap as one box, and the lot's infill between them: a baluster card
        (the masked material is two-sided, so one face), a solid guard of lap siding (self.guard_siding: the laps
        show, where the old flat Wood_Grey board read as concrete), or iron pickets facing `out` on the steel
        galleries. A guard cut lower than GUARD_H is solid, since the card draws its rails for 107 cm."""
        length = math.dist(pa[:2], pb[:2])
        if length < 8 or top < RAIL_LOW[1] + CAP_H + 5:
            return 0
        G = Frame(mesh, pa[:2], pb[:2])
        kind = infill or self.infill
        if kind == 'balusters' and top < GUARD_H - 1:
            kind = 'boards'
        paint = self.paint
        # no hidden faces: the bottom rail shows its two sides, the cap rail its sides and top
        G.box(paint, 0, length, -1.9, 1.9, z + RAIL_LOW[0], z + RAIL_LOW[1], 'tblr')
        G.box(paint, 0, length, -CAP_W / 2, CAP_W / 2, z + top - CAP_H, z + top, 'blr')
        # the guard collides (Collision_Only: hidden in game), as high as it stands, so a player cannot walk off the
        # gallery or into a stair opening; a jump still clears it, as it would a real 107 cm guard
        self.count('guard_collision_runs', collision_plane(mesh, pa, pb, z, z + top))
        if kind == 'balusters':
            cutout(mesh, 'Rail_Baluster', pa[:2], pb[:2], z, z + top)
        elif kind == 'iron':
            facing = 1 if G.n[0] * out[0] + G.n[1] * out[1] >= 0 else -1
            count = max(1, round(length / 20.))
            for k in range(1, count):
                x = length * k / count
                G.quad_d('Iron', x - .9, x + .9, z + RAIL_LOW[1], z + top - CAP_H, 1.0 * facing, facing)
        else:
            # a solid guard is lap siding (clapboard or aluminium) between the rails, laps showing, both faces
            G.box(self.guard_siding, 0, length, -1., 1., z + RAIL_LOW[1], z + top - CAP_H, 'tblr')
        self.count('guard_' + kind)
        return 1

    def _free_record(self, P, free, z, edge, out):
        """The props floor of one deck for fronts.json: `free`, quads in map coordinates (cm) at the deck top `z`,
        `free_m2`, the outer guard line `edge` (for a dish or a flower box on the guard) and `out`, the unit vector
        from the wall toward the yard."""
        quads = [[[round(v, 1) for v in P(x, d, z)[:2]] for x, d in ((x0, d0), (x1, d0), (x1, d1), (x0, d1))]
                 for x0, x1, d0, d1 in free]
        area = sum((x1 - x0) * (d1 - d0) for x0, x1, d0, d1 in free) / 1e4
        if free:
            self.count('decks_with_free_floor')
        return {'free': quads, 'free_m2': round(area, 2),
                'edge': [[round(v, 1) for v in p[:2]] for p in edge], 'out': [round(out[0], 4), round(out[1], 4)]}

    def _partition(self, mesh, F, x, d1, z, kind, neighbour, record):
        """A privacy screen across the gallery at a shared post (frame F of the stack wall, at x, from the wall face
        to d1, standing on the deck top z): two 1 m lattice cards, as drawn, or one 1.8 m board card, as drawn, under a
        2x4 cap rail, with a 2x4 stile at the guard end, in the gallery paint. No collision (the end guards collide)."""
        a, b = F.p(x, D_FACE, 0)[:2], F.p(x, d1, 0)[:2]
        H = PARTITION_H[kind]
        if kind == 'lattice':
            cutout(mesh, 'Rail_Lattice', a, b, z, z + SKIRT_H)
            cutout(mesh, 'Rail_Lattice', a, b, z + SKIRT_H, z + H)
        else:
            cutout(mesh, 'Fence_Boards', a, b, z, z + H)
        G = Frame(mesh, a, b)
        L = math.dist(a, b)
        G.box(self.paint, 0, L, -1.9, 1.9, z + H, z + H + 3.8, 'bl')
        G.box(self.paint, L - 8.9, L, -1.9, 1.9, z, z + H, 'tbl')
        record.setdefault('partitions', []).append({
            'a': [round(v, 1) for v in a], 'b': [round(v, 1) for v in b], 'z0': round(z, 1), 'z1': round(z + H, 1),
            'kind': kind, 'neighbour': neighbour})
        self.count('partitions')
        self.count('partitions_' + kind)
        if neighbour:
            self.count('partitions_between_lots')

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

        out_d, out_x0, out_x1 = F.out(0, 1, 0), F.out(-c, 0, 0), F.out(c, 0, 0)

        def guard(x0, d0, x1, d1, z, out, top=GUARD_H):
            if self._guard(mesh, P(x0, d0, 0), P(x1, d1, 0), z, out, top):
                record['guards'].append({'a': [round(v, 1) for v in P(x0, d0, 0)[:2]],
                                         'b': [round(v, 1) for v in P(x1, d1, 0)[:2]],
                                         'z0': round(z, 1), 'z1': round(z + top, 1)})

        def fascia(x0, x1, d, z):
            box(paint, x0, x1, d - FASCIA_T, d, z - FASCIA_H, z, 'klrb')

        paint = self.paint
        levels = st['levels']
        zs = [self.floor_z[k] for k in levels]
        gd = st['gd']
        dF = D_FACE + gd
        straight = st['kind'] == 'straight'
        bi = dF - 12 - STAIR_W
        corner = CAP_W / 2              # an end run stops where the outer run's cap begins
        if straight:
            xh = module['xh']
            n1, going1 = st['n1'], st['going1']
            n2, going2 = st['n2'], st['going2']
            run2 = (n2 - 1) * going2
            xo0, xo1 = xh - run2 - 2, xh - .3 * run2
        else:
            xs, ds = module['xs'], D_FACE + gd / 2
        deck_end = module['deck_end']
        record.setdefault('guards', [])
        # decks (thin boards, a painted rim board on the outer edge) and guards
        for i, z in enumerate(zs):
            if straight and i > 0:
                box('Wood_Deck', gx0, gx1, D_FACE - 2, bi, z - DECK_T, z, 'k')
                if xo0 - gx0 >= 20:
                    box('Wood_Deck', gx0, xo0, bi, dF - FASCIA_T, z - DECK_T, z, 'k')
                box('Wood_Deck', xo1, gx1, bi, dF - FASCIA_T, z - DECK_T, z, 'k')
                # the rim board runs on across the stair opening, so the flight's soffit never shows through the edge
                fascia(gx0, gx1, dF, z)
                # guard round the opening: along its inner side, and across its high end, where the flight from this
                # deck to the next passes overhead: that end is cut down to clear the flight's underside. The inner
                # guard starts HEAD_EXIT from the end guard, so a short landing still lets a player step off the top
                # of the flight toward the door (the opening edge left open there drops at most about 1 m)
                inner0 = max(gx0, xo0) if xo0 - gx0 >= HEAD_EXIT else gx0 + HEAD_EXIT
                guard(inner0, bi - 2, xo1 + 2 + corner, bi - 2, z, F.out(0, -1, 0))
                top = GUARD_H
                if i < len(zs) - 1:
                    rise2 = (zs[i + 1] - z) / n2
                    soffit = z - 5 + (xh - xo1 - 2) / run2 * (zs[i + 1] - rise2 - z)
                    top = min(GUARD_H, soffit - z - 3)
                guard(xo1 + 2, bi - 2 + corner, xo1 + 2, dF - 3 - corner, z, out_x1, top)
            else:
                box('Wood_Deck', gx0, deck_end, D_FACE - 2, dF - FASCIA_T, z - DECK_T, z, 'k')
                fascia(gx0, xh if straight else deck_end, dF, z)
            corners = [P(gx0, D_FACE, z), P(deck_end, D_FACE, z), P(deck_end, dF, z), P(gx0, dF, z)]
            door = P(module['xd'], D_FACE + 45, z)       # where a player stands in front of the gallery door
            # the floor left for props (chairs, a barbecue, plants, a bike): the deck inside its guards and posts, less
            # the stair opening, the flights, the landing at each flight head and foot, the door and the way between
            if straight:
                reserved = [(module['xd'] - DOOR_CLEAR, gx1 + 10, -1e9, 1e9)]    # door, landing, next flight's foot
                if i == 0 and len(zs) > 1:
                    reserved.append((xh - run2 - 10, xh + 10, bi - 10, 1e9))     # under the flight to the next deck
                if i > 0:
                    head_x = xh - run2 - going2 / 2
                    reserved += [(xo0 - 2, xo1 + 2, bi - 2, 1e9),                # the opening the flight comes up
                                 (head_x - HEAD_CLEAR, xo0, -1e9, 1e9),          # the landing at its head
                                 (head_x - HEAD_CLEAR, module['xd'], -1e9, bi + 10)]   # the way to the door
            else:
                reserved = [(module['xd'] - DOOR_CLEAR, gx1 + 10, -1e9, 1e9)]    # door, spiral exit, spiral
            free = _free_floor((gx0 + 8, deck_end - 8, D_FACE + 3, dF - 12), reserved)
            edge = (P(gx0, dF - 3, z), P(deck_end, dF - 3, z))
            record['decks'].append({'z': round(z, 1), 'quad': [[round(p[0], 1), round(p[1], 1)] for p in corners],
                                    'door': [round(door[0], 1), round(door[1], 1)],
                                    **self._free_record(P, free, z, edge, out_d)})
            # the outer guard, open where the first flight lands
            gaps = [(xh - 2, gx1 + 1)] if straight and i == 0 else []
            for a0, a1 in _subtract((gx0, gx1), gaps):
                guard(a0, dF - 3, a1, dF - 3, z, out_d)
            guard(gx0 + 2, D_FACE, gx0 + 2, dF - 3 - corner, z, out_x0)
            guard(gx1 - 2, D_FACE, gx1 - 2, (dF + 2 + STAIR_W) if straight and i == 0 else dF - 3 - corner, z, out_x1)
            record['galleries'] += 1
            self.count('galleries')
        # posts from the yard; a module shares the post of its neighbour at the party line
        roof = st['roof']
        post_top = roof - 10 if roof else zs[-1] + GUARD_H
        for x in ([mx0 + 12] if module['first'] else []) + [mx1 - 12]:
            F.box(paint, x - 5, x + 5, dF - 11, dF - 1, 0, post_top, 'b')
            self.count('posts')
        if roof:
            F.box(self.roof_mat, mx0 + 2, mx1 - 2, D_FACE - 2, dF + 12, roof - 10, roof, 'k')
            self.count('gallery_roofs')
        if straight:
            if st.get('ground'):
                self._ground_deck(mesh, box, P, guard, module, dF, record)
            self._straight(mesh, F, box, P, guard, xh, zs, dF, bi, n1, going1, n2, going2, record)
        else:
            self._spiral(mesh, F, P, c, xs, ds, zs, record)

    def _ground_deck(self, mesh, box, P, guard, module, dF, record):
        """The ground-floor gallery: a low deck across the module at the raised ground floor, its underside closed
        by a lattice skirt (one Rail_Lattice card per side, kept 1 m tall as drawn, its foot below grade), solid
        steps down to the yard at the end away from the stair, and a guard where the deck stands 60 cm or more."""
        g = self.stack['ground']
        z, risers, going = g['z'], g['risers'], g['going']
        gx0, gx1 = module['gx0'], module['gx1']
        paint = self.paint
        box('Wood_Deck', gx0, gx1, D_FACE - 2, dF - FASCIA_T, z - DECK_T, z, 'k')
        box(paint, gx0, gx1, dF - FASCIA_T, dF, z - FASCIA_H, z, 'klrb')
        sx0, sx1 = gx0 + 20, gx0 + 120
        top = z - FASCIA_H
        skirts = 0
        for a0, a1 in _subtract((gx0, gx1), [(sx0, sx1)]):
            skirts += cutout(mesh, 'Rail_Lattice', P(a0, dF - 1.25, 0), P(a1, dF - 1.25, 0), top - SKIRT_H, top)
        for x in (gx0 + 1.25, gx1 - 1.25):
            skirts += cutout(mesh, 'Rail_Lattice', P(x, D_FACE, 0), P(x, dF - FASCIA_T, 0), top - SKIRT_H, top)
        rise = z / risers
        for j in range(1, risers):
            d0 = dF + (risers - 1 - j) * going
            box('Wood_Deck', sx0, sx1, d0, d0 + going, j * rise - rise, j * rise, 'kblr')    # tread and riser
            box(paint, sx0, sx1, d0, d0 + going, 0, j * rise, 'tbfk')                       # closed sides
        box('Wood_Deck', sx0, sx1, dF, dF + .5, (risers - 1) * rise, z - FASCIA_H, 'kblrt')   # last riser, to the rim
        if z >= 60:
            for a0, a1 in _subtract((gx0, gx1), [(sx0 - 2, sx1 + 2)]):
                guard(a0, dF - 3, a1, dF - 3, z, (0., 0., 0.))
            guard(gx0 + 2, D_FACE, gx0 + 2, dF - 3 - CAP_W / 2, z, (0., 0., 0.))
            guard(gx1 - 2, D_FACE, gx1 - 2, dF - 3 - CAP_W / 2, z, (0., 0., 0.))
        corners = [P(gx0, D_FACE, z), P(gx1, D_FACE, z), P(gx1, dF, z), P(gx0, dF, z)]
        sc = (sx0 + sx1) / 2
        xd = module['xd']
        # props floor: the outer band between the steps' landing and the door, the inner band kept as the way between
        free = _free_floor((gx0 + 8, gx1 - 8, D_FACE + 3, dF - 12),
                           [(gx0 - 10, sx1 + HEAD_CLEAR, -1e9, 1e9), (xd - DOOR_CLEAR, xd + DOOR_CLEAR, -1e9, 1e9),
                            (sx1, xd, -1e9, D_FACE + 100)])
        edge = (P(gx0, dF - 3, z), P(gx1, dF - 3, z))
        record.setdefault('ground_decks', []).append({
            'z': round(z, 1), 'quad': [[round(p[0], 1), round(p[1], 1)] for p in corners], 'steps': risers - 1,
            'foot': [round(v, 1) for v in P(sc, dF + (risers - 1.5) * going, rise)],
            'head': [round(v, 1) for v in P(sc, (D_FACE + dF) / 2, z)], 'guard': z >= 60, 'skirts': skirts,
            'door': [round(v, 1) for v in P(xd, D_FACE + 45, z)[:2]],
            **self._free_record(P, free, z, edge, ((edge[0][0] - corners[0][0]) / (dF - 3 - D_FACE),
                                                   (edge[0][1] - corners[0][1]) / (dF - 3 - D_FACE)))})
        self.count('ground_galleries')
        self.count('lattice_skirts', skirts)

    def _straight(self, mesh, F, box, P, guard, xh, zs, dF, bi, n1, going1, n2, going2, record):
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
        box('Wood_Deck', xh, xh + STAIR_W, dF - FASCIA_T, e1 - FASCIA_T, z1 - DECK_T, z1, 'k')
        box(paint, xh, xh + STAIR_W, e1 - FASCIA_T, e1, z1 - FASCIA_H, z1, 'klrb')
        for d in (e0 + 2.5, e1 - 2.5):
            beam(mesh, paint, P(xh - run1 - going1 * .6, d, 4), P(xh, d, z1 - 22), 5, 24, bottom=False)
        self._soffit(mesh, P, xh - run1, xh, e0 + 3, e1 - 3, 0., z1 - rise1 - 5)
        beam(mesh, paint, P(xh - run1, e1 - 3, rise1 + 88), P(xh, e1 - 3, z1 + 88), 5, 6, bottom=False)
        guard(xh, e1 - 3, xh + STAIR_W + 1, e1 - 3, z1, F.out(0, 1, 0))
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
            self._soffit(mesh, P, xh - run2, xh, s0 + 3, s1 - 3, zb - rise2 - 5, za - 5)
            beam(mesh, paint, P(xh, s0 + 4, za + rise2 + 88), P(xh - run2, s0 + 4, zb + 88), 5, 6, bottom=False)
            # the flight's open outer side rises over the deck's outer guard toward the gallery edge: an invisible
            # sloped guard on that guard's line carries it up to the next deck's guard (it starts where the first
            # deck's guard stops for the landing, so the landing stays open)
            self.count('flight_collision_runs', collision_plane(
                mesh, P(xh - 2, dF - 3, 0), P(xh - run2, dF - 3, 0), za, za + GUARD_H + rise2,
                zb - rise2 - 5, zb - 5 + GUARD_H))
            record['flights'].append({'kind': 'straight', 'z0': round(za, 1), 'z1': round(zb, 1), 'treads': n2 - 1,
                                      'foot': [round(v, 1) for v in P(xh - going2 / 2, (s0 + s1) / 2, za + rise2)],
                                      'head': [round(v, 1) for v in P(xh - run2 - going2 / 2, (s0 + s1) / 2, zb)]})
            self.count('flights')
        self.count('stairs_straight')

    def _soffit(self, mesh, P, x0, x1, d0, d1, z0, z1):
        """One downward face under a flight's treads, so the stair still reads from the yard below
        (open treads are drawn as their top faces only), 5 cm under the tread backs. z0 at x0, z1 at x1."""
        pts = [P(x0, d0, z0), P(x1, d0, z1), P(x1, d1, z1), P(x0, d1, z0)]
        mesh.face('Wood_Grey', pts, (0, 0, -1))

    def _spiral(self, mesh, F, P, sx, xs, ds, zs, record):
        """Steel spiral in the end bay of the gallery: a full turn per storey, stepping off onto each deck. Each
        wooden tread top has a steel pan under it; a helical outer stringer, a helical rail and a baluster on every
        second tread follow the treads, and both rail and balusters stay open at each deck exit.
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
        exits = [exit_angle + 2 * math.pi * k for k in range(len(zs))]
        for phi, z in treads:
            a0, a1 = phi - delta / 2 - .02, phi + delta / 2 + .02
            ring = ((r0, a0), (R, a0), (R, a1), (r0, a1))
            mesh.face('Wood_Deck', [P(xs + r * math.cos(a), ds + r * math.sin(a), z) for r, a in ring], (0, 0, 1))
            mesh.face('Iron', [P(xs + r * math.cos(a), ds + r * math.sin(a), z - 4) for r, a in ring], (0, 0, -1))
        self.count('spiral_treads', len(treads))
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

        def at(r, phi, z):
            return P(xs + r * math.cos(phi), ds + r * math.sin(phi), z)

        def radial(phi):
            return F.out(sx * math.cos(phi), math.sin(phi), 0)
        # helix vertices every second tread
        verts = [first + 2 * delta * k for k in range(int((last - first) / (2 * delta)) + 1)]
        if last - verts[-1] > .05:
            verts.append(last)
        for p0, p1 in zip(verts, verts[1:]):
            # the outer stringer: a steel band under the tread ends, facing out (the treads hide its inner face)
            b0, b1 = max(0., z_at(p0) - 26), max(0., z_at(p1) - 26)
            t0, t1 = max(b0 + 5, z_at(p0) - 3), max(b1 + 5, z_at(p1) - 3)
            mid = radial((p0 + p1) / 2)
            mesh.face('Iron', [at(R + 1, p0, b0), at(R + 1, p1, b1), at(R + 1, p1, t1), at(R + 1, p0, t0)], mid)
            # the helical rail, a flat bar seen from both sides, open where it passes a deck exit
            if not any(p0 - .75 * delta < e < p1 + .75 * delta for e in exits):
                h0, h1 = z_at(p0) + 86, z_at(p1) + 86
                bar = [at(R - 4, p0, h0), at(R - 4, p1, h1), at(R - 4, p1, h1 + 5), at(R - 4, p0, h0 + 5)]
                mesh.face('Iron', bar, mid)
                mesh.face('Iron', list(bar), (-mid[0], -mid[1], 0.))
        balusters = 0
        for index, (phi, z) in enumerate(treads):
            if index % 2 or any(abs(phi - e) < 1.2 * delta for e in exits):
                continue
            base = at(R - 4, phi, z)
            card(mesh, 'Iron', base, (base[0], base[1], z + 90), radial(phi)[:2], 1.2)
            balusters += 1
        self.count('spiral_balusters', balusters)
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
        edge = plan['edge']
        kind = 'low' if edge == 'low' else self.fence_kind
        h = GUARD_H if edge == 'low' else self.fence_h
        g = plan['gate']
        shed = plan['shed']
        cuts = []
        if g is not None:
            cuts.append((g - 50, g + 50))
        if shed:
            cuts.append(shed['x'])
        runs = []
        if edge != 'open':
            for r0, r1 in plan['runs']:
                runs += _subtract((r0, r1), cuts, 40)
        posts = 0
        for x0, x1 in runs:
            # the gate posts and the shed corner stand in for the run's end posts beside them
            ends = [x for x in ([g - 50, g + 50] if g is not None else []) + (list(shed['x']) if shed else [])]
            posts += self._fence_run(mesh, F.p(x0, fd, 0)[:2], F.p(x1, fd, 0)[:2], kind, h,
                                     skip=(any(abs(x0 - e) < 1 for e in ends), any(abs(x1 - e) < 1 for e in ends)))
            self.count('fence_runs')
        covered = sum(x1 - x0 for x0, x1 in runs)
        if g is not None:
            posts += self._gate(mesh, F, g, fd, kind, h)
            self.count('gates')
            covered += 100
        if shed:
            self._shed(mesh, F, shed)
            covered += shed['x'][1] - shed['x'][0] + 3      # the side fence closes the 3 cm beside it
        # creeper on the lane side of the longest run, clear of the posts, draping over the top
        if runs and self.vine_roll < .35:
            x0, x1 = max(runs, key=lambda r: (r[1] - r[0], r[0]))
            if x1 - x0 >= 160:
                w = min(x1 - x0 - 20, 140 + self.vine_f * 140)
                v0 = x0 + 10 + (x1 - x0 - 20 - w) * self.vine_f
                strips = creeper(mesh, F, v0, v0 + w, fd + 6, h + 18, random.Random(self.vine_seed), h + 40)
                self.count('creepers')
                self.count('creeper_strips', strips)
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
        # ground cover: flat patches that never overlap, a little above the floor (beds and paving a touch higher)
        areas = {}
        for mat, xa, xb, da, db in plan['ground']:
            F.quad_z(mat, xa, xb, da, db, GROUND_Z[mat], 1)
            areas[mat] = areas.get(mat, 0.) + (xb - xa) * (db - da) / 1e4
            self.count('ground_patches')
        span = lx1 - lx0
        pad = plan['pad']
        record['yard'] = {
            'mix': plan['mix'], 'edge': edge, 'patches': len(plan['ground']),
            'area_m2': {mat: round(v, 2) for mat, v in sorted(areas.items())},
            'cells': [[mat, round(xa - lx0, 1), round(xb - lx0, 1), round(da, 1), round(db, 1)]
                      for mat, xa, xb, da, db in plan['ground']],
            'rect': [[round(v, 1) for v in F.p(x, d, 0)[:2]] for x, d in ((lx0, D_FACE + 2), (lx1, D_FACE + 2), (lx1, fd), (lx0, fd))],
            'pad': None if not pad else [[round(v, 1) for v in F.p(x, d, 0)[:2]]
                                         for x, d in ((pad[0][0], pad[1][0]), (pad[0][1], pad[1][0]), (pad[0][1], pad[1][1]), (pad[0][0], pad[1][1]))],
            'shed': None if not shed else [round(shed['x'][0] - lx0, 1), round(shed['x'][1] - lx0, 1),
                                           round(shed['d'][0], 1), round(shed['d'][1], 1)]}
        if edge == 'open':
            self.count('open_lane_edges')
        elif edge == 'low':
            self.count('low_fences')
        if pad:
            self.count('parking_pads')
        record['fence'] = None if edge in ('open', 'none') else {
            'kind': kind, 'edge': edge, 'lane': plan['lane'], 'gate': g is not None,
            'height_cm': h, 'distance_cm': round(fd, 1), 'lot_width_cm': round(span, 1),
            'covered_cm': round(min(covered, span), 1), 'posts': posts,
            'line': [[round(v, 1) for v in F.p(lx0, fd, 0)[:2]], [round(v, 1) for v in F.p(lx1, fd, 0)[:2]]],
            'runs': [[round(x0 - lx0, 1), round(x1 - lx0, 1)] for x0, x1 in runs],
            'gate_at': None if g is None else round(g - lx0, 1), 'gate_paint': None if g is None else self.gate_paint,
            'post_paint': self.fence_paint if kind != 'slats' else 'Sheet_Metal',
            'shed_at': None if not shed else [round(shed['x'][0] - lx0, 1), round(shed['x'][1] - lx0, 1)]}
        if shed:
            record['shed'] = shed['kind']

    def plan_open_ground(self, occupancy, taken):
        """Ground cover for a lot with no yard: on every open back wall (not a street wall) a lawn band and, where a
        ruelle or open ground lets a car in and the strip is OPEN_PARK_D + 1 m deep with 5 m along the wall, asphalt
        parking out to the strip's far edge (the ruelle verge, or a usual lot depth). Cells of at most OPEN_CELL
        along the wall; one that meets a building, a structure, another lot's yard or ground, or a road's clearance
        is split and the blocked parts dropped (the yard's own CGA split). `taken` is a Grid of placed polygons."""
        self.open_plan = []
        for wall in self.lot.get('backs', ()):
            W = wall['width']
            if wall['kind'] == 'street' or W < 200 or wall['clear'] < 150:
                continue
            if wall['alley'] is not None:
                fd = wall['alley'] - FENCE_FROM_ALLEY
            elif wall['clear'] < 1990:
                fd = wall['clear'] / 2
            else:
                fd = min(wall['clear'] / 2, OPEN_YARD_D)
            d0 = D_FACE + 2
            if fd - d0 < 100:
                continue
            F = Frame(None, wall['a'], wall['b'])
            # parking only where a car gets in: a ruelle or open ground at the strip's far edge
            access = wall['alley'] is not None or wall['clear'] >= 1990
            park = access and fd - d0 >= OPEN_PARK_D + 100 and W >= 500
            lawn = min(OPEN_LAWN_D, fd - d0 - OPEN_PARK_D) if park else fd - d0
            bands = [('Yard_Grass', d0, d0 + lawn), ('Asphalt_Lot', d0 + lawn, fd)] if park else [('Yard_Grass', d0, fd)]
            corners = [F.p(x, d, 0)[:2] for x in (0, W) for d in (d0, fd)]
            near, roads = self.near(corners, 5), self.yard_roads(corners)
            pieces = max(1, math.ceil(W / OPEN_CELL))
            cells = []

            def blocked(x, d):
                q = F.p(x, d, 0)[:2]
                return self.blocked(q, near, occupancy, roads) or any(_inside(q, poly) for poly in taken.near(q[0], q[1], 1))

            def keep(mat, xa, xb, da, db, depth):
                nx, nd = max(2, math.ceil((xb - xa) / 60) + 1), max(2, math.ceil((db - da) / 60) + 1)
                hits = sum(blocked(xa + (xb - xa) * i / (nx - 1), da + (db - da) * j / (nd - 1))
                           for i in range(nx) for j in range(nd))
                if not hits:
                    cells.append((mat, xa, xb, da, db))
                elif hits < nx * nd and depth and min(xb - xa, db - da) >= 60:
                    xm, dm = (xa + xb) / 2, (da + db) / 2
                    for x0, x1, e0, e1 in ((xa, xm, da, dm), (xm, xb, da, dm), (xa, xm, dm, db), (xm, xb, dm, db)):
                        keep(mat, x0, x1, e0, e1, depth - 1)
            for mat, da, db in bands:
                for k in range(pieces):
                    keep(mat, W * k / pieces, W * (k + 1) / pieces, da, db, 3)
            for mat, xa, xb, da, db in cells:
                poly = [F.p(x, d, 0)[:2] for x, d in ((xa, da), (xb, da), (xb, db), (xa, db))]
                taken.add(poly, [q[0] for q in poly], [q[1] for q in poly])
            if cells:
                self.open_plan.append({'wall': wall, 'fd': fd, 'park': park, 'cells': cells})

    def author_open_ground(self, mesh, record):
        """Lay the planned open ground: flat patches (lawn under the parking's z) and white stall lines across the
        asphalt's last OPEN_PARK_D, every STALL_W along the wall."""
        areas, stalls, out = {}, 0, []
        for plan in self.open_plan:
            wall, fd = plan['wall'], plan['fd']
            F = Frame(mesh, wall['a'], wall['b'])
            for mat, xa, xb, da, db in plan['cells']:
                F.quad_z(mat, xa, xb, da, db, GROUND_Z[mat], 1)
                areas[mat] = areas.get(mat, 0.) + (xb - xa) * (db - da) / 1e4
                out.append([mat] + [[round(v, 1) for v in F.p(x, d, 0)[:2]] for x, d in ((xa, da), (xb, da), (xb, db), (xa, db))])
                self.count('open_ground_patches')
                if mat != 'Asphalt_Lot':
                    continue
                l0, l1 = max(da, fd - OPEN_PARK_D - 20), min(db, fd - 20)
                if l1 - l0 < 100:
                    continue
                for k in range(1, int(wall['width'] // STALL_W) + 1):
                    x = k * STALL_W
                    if xa + 5 <= x - 5 and x + 5 <= xb - 5:
                        F.quad_z('Trim', x - 5, x + 5, l0, l1, GROUND_Z[mat] + .3, 1)
                        stalls += 1
        if out:
            record['open_ground'] = {'cells': out, 'area_m2': {m: round(v, 2) for m, v in sorted(areas.items())},
                                     'stall_lines': stalls}
            self.count('open_ground_lots')
            self.count('parking_stall_lines', stalls)

    def _fence_run(self, mesh, a, b, kind, height, skip=(False, False)):
        """One straight fence run from world point a to b; returns its post count. Board fences: the weathered
        boards as one Fence_Boards card (the masked material is two-sided), 4x4 posts at most 8 ft apart and a flat
        2x6 cap rail. Slatted chain-link: the slat panel between galvanised posts under a galvanised top rail.
        Low picket fence: the gallery guard's rails and baluster card, 107 cm, on 4x4 posts 1.8 m apart."""
        length = math.dist(a, b)
        if length < 20:
            return 0
        G = Frame(mesh, a, b)
        wood = self.fence_paint
        # the posts stop under the cap or top rail, which covers their tops (no hidden faces)
        if kind == 'boards':
            cutout(mesh, 'Fence_Boards', a, b, 0, height)
            G.box(wood, 0, length, -4.5, 4.5, height, height + 3.8, 'blr')
            spacing, half, post_h, post_mat = POST_SPACING, 4.5, height, wood
        elif kind == 'slats':
            G.box(self.fence_paint, 0, length, -1.5, 1.5, 0, height, 'tblr')
            G.box('Sheet_Metal', 0, length, -3., 3., height, height + 4, 'blr')
            spacing, half, post_h, post_mat = 300., 3., height, 'Sheet_Metal'
        else:
            G.box(wood, 0, length, -1.9, 1.9, RAIL_LOW[0], RAIL_LOW[1], 'tblr')
            G.box(wood, 0, length, -CAP_W / 2, CAP_W / 2, height - CAP_H, height, 'blr')
            cutout(mesh, 'Rail_Baluster', a, b, 0, height)
            spacing, half, post_h, post_mat = 180., CAP_W / 2, height - CAP_H, wood
        bays = max(1, math.ceil(length / spacing))
        posts = 0
        for i in range(bays + 1):
            if (i == 0 and skip[0]) or (i == bays and skip[1]):
                continue
            x = min(max(length * i / bays, half), length - half)
            G.box(post_mat, x - half, x + half, -half, half, 0, post_h, 'tb')
            posts += 1
        self.count('fence_posts', posts)
        return posts

    def _gate(self, mesh, F, g, fd, kind, h):
        """A board gate hung between two taller gate posts: the leaf is one Fence_Boards cut-out card (the picket
        card on a low fence), with its two ledges and the brace between them on the yard side in the gate's own paint
        (never the fence's colour), the way a ledged-and-braced board gate is built. The old leaf was one flat painted
        panel. Returns the post count."""
        top = h - 6 if kind != 'low' else h - 5
        leaf = 'Rail_Baluster' if kind == 'low' else 'Fence_Boards'
        cutout(mesh, leaf, F.p(g - 46, fd, 0)[:2], F.p(g + 46, fd, 0)[:2], 4, top)
        zl = [4 + (top - 4) * f for f in GATE_LEDGES]
        for z in zl:
            F.box(self.gate_paint, g - 44, g + 44, fd - 4.8, fd - 1, z - 6, z + 6, 'flr')
        # the brace climbs from the bottom ledge at the hinge side to the top ledge at the latch side
        beam(mesh, self.gate_paint, F.p(g - 38, fd - 2.9, zl[0] + 6), F.p(g + 38, fd - 2.9, zl[1] - 6), 3.8, 9,
             bottom=False)
        self.count('gate_leaf_cards')
        post = self.fence_paint if kind != 'slats' else 'Sheet_Metal'
        for x in (g - 50, g + 50):
            F.box(post, x - 5, x + 5, fd - 5, fd + 5, 0, h + 8, 'b')
        return 2

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
        mesh.face('Sheet_Metal',
                  [p(x0, d0, hy), p(x1, d0, hy), p(x1, d1, hl), p(x0, d1, hl)], (0, 0, 1))
        xc = (x0 + x1) / 2
        dw = 120 if garage and x1 - x0 >= 250 else 45
        if garage:
            F.quad_d('Trim' if self.shed_door == 'Trim' else 'Wood_Grey', xc - dw, xc + dw, 0, 215, d1 + .8)
        else:
            F.quad_d(self.shed_door, xc - dw, xc + dw, 0, 195, d1 + .8)
        self.count('garages' if garage else 'sheds')


# ------------------------------------------------------------------------------------------ yard trees
# Yard trees come from the city's canopy survey (Canopée 2019, CANOPY): the canopy is rasterised on a 1 m grid and
# each crown is taken as a disc around a local maximum of its distance to the canopy edge, largest first (the
# distance-transform split of merged crowns used in crown delineation); a trunk stands only in a plex yard, clear of
# the house, the galleries, stairs, decks, sheds, pads and fences, the 300 cm traffic clearance and the mapped trees.
YARD_TREES = OUT / 'yard_trees.json'
TREE_MESH_H = 455.          # the shared tree mesh (tree_small_02) is about 4.55 m tall at scale 1 (apply step)
TREE_SCALE_MAX = 4.         # the apply checks accept scale 0.3 to 4 (18.2 m)
TREE_CELL = 100.            # canopy raster cell, cm
TREE_MIN_R = 2.             # crown radius in m; the survey keeps crowns over 3 m high, so smaller blobs are shrubs
TREE_CLEAR = {'wall': 200., 'structure': 90., 'fence': 60., 'mapped': 400., 'traffic': TRAFFIC_CLEAR}
TREE_PER_LOT = 3


def _fill_polygons(polygons, origin, nx, ny, cell):
    """Even-odd scanline fill of polygons (lists of rings of (x, y)) at the cell centres of an nx x ny grid."""
    grid = bytearray(nx * ny)
    ox, oy = origin
    for rings in polygons:
        ys = [p[1] for ring in rings for p in ring]
        j0 = max(0, math.ceil((min(ys) - oy) / cell - .5))
        j1 = min(ny - 1, math.floor((max(ys) - oy) / cell - .5))
        if j0 > j1:
            continue
        edges = [(a, b) for ring in rings for a, b in zip(ring, ring[1:] + ring[:1]) if a[1] != b[1]]
        for j in range(j0, j1 + 1):
            y = oy + (j + .5) * cell
            xs = sorted(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]) for a, b in edges
                        if (a[1] > y) != (b[1] > y))
            row = j * nx
            for k in range(0, len(xs) - 1, 2):
                i0 = max(0, math.ceil((xs[k] - ox) / cell - .5))
                i1 = min(nx - 1, math.floor((xs[k + 1] - ox) / cell - .5))
                for i in range(i0, i1 + 1):
                    grid[row + i] = 1
    return grid


def _chamfer(grid, nx, ny):
    """Two-pass 3-4 chamfer distance of every set cell to the nearest unset cell, in thirds of a cell."""
    big = 1 << 30
    d = [big if v else 0 for v in grid]
    for j in range(ny):
        row = j * nx
        for i in range(nx):
            k = row + i
            if d[k]:
                best = d[k]
                if i:
                    best = min(best, d[k - 1] + 3)
                if j:
                    best = min(best, d[k - nx] + 3)
                    if i:
                        best = min(best, d[k - nx - 1] + 4)
                    if i < nx - 1:
                        best = min(best, d[k - nx + 1] + 4)
                elif not i:
                    best = min(best, 3)
                d[k] = best
    for j in range(ny - 1, -1, -1):
        row = j * nx
        for i in range(nx - 1, -1, -1):
            k = row + i
            if d[k]:
                best = d[k]
                if i < nx - 1:
                    best = min(best, d[k + 1] + 3)
                if j < ny - 1:
                    best = min(best, d[k + nx] + 3)
                    if i < nx - 1:
                        best = min(best, d[k + nx + 1] + 4)
                    if i:
                        best = min(best, d[k + nx - 1] + 4)
                d[k] = best
    return d


TREE_CROWN_R = 182.         # cm: half the crown width of the shared mesh at scale 1 (3 to 4.3 m across)
TREE_CROWN = {'maple': 1.15, 'ash': .9, 'elm': 1.05, 'small': 1.}   # the apply step's crown widening per kind


def tree_shape(r_m, p, storeys, roof_cm):
    """Height (m), kind, crown (m) and yaw of a yard tree whose canopy crown has radius r_m at p. A crown under 6 m
    across is a small tree; the others are maple (55%), ash (30%) or elm (15%) by a seeded draw, after Montréal's
    tree inventories (maples and ash lead, elm is rare), 12.5 to 18 m tall from the crown, and 1.5 m over the roof
    of a lot of three storeys or fewer."""
    crown = min(16., 2 * r_m)
    rng = random.Random(_seed('plex-yard-tree', round(p[0]), round(p[1])))
    pick, yaw = rng.random(), rng.uniform(0., 360.)
    if crown < 6.:
        return 5.5 + .5 * crown, 'small', crown, yaw
    height = min(18., max(12.5, 7. + .75 * crown))
    if storeys <= 3:
        height = min(TREE_SCALE_MAX * TREE_MESH_H / 100, max(height, (roof_cm + 150.) / 100))
    return height, ('maple' if pick < .55 else 'ash' if pick < .85 else 'elm'), crown, yaw


def plan_yard_trees(rears, records, occupancy, canopy, traffic=(), mapped=()):
    """Trees for the plex yards from the canopy polygons. Returns {lot id: [tree rows]}; each row has the apply
    step's fields (x, y, z, yaw, scale, kind) plus the crown and height it was given (tree_shape)."""
    yards = [(rear, records[rear.lot['id']]) for rear in rears if rear.yard_plan and records[rear.lot['id']]['yard']]
    if not canopy or not canopy.get('polygons') or not yards:
        return {}
    polys = [[[(ring[i], ring[i + 1]) for i in range(0, len(ring), 2)] for ring in rings] for rings in canopy['polygons']]
    rects = [[tuple(p) for p in record['yard']['rect']] for _, record in yards]
    margin = 2000.
    x0 = math.floor((min(p[0] for r in rects for p in r) - margin) / TREE_CELL) * TREE_CELL
    y0 = math.floor((min(p[1] for r in rects for p in r) - margin) / TREE_CELL) * TREE_CELL
    nx = math.ceil((max(p[0] for r in rects for p in r) + margin - x0) / TREE_CELL)
    ny = math.ceil((max(p[1] for r in rects for p in r) + margin - y0) / TREE_CELL)
    polys = [rings for rings in polys
             if max(p[0] for p in rings[0]) >= x0 and min(p[0] for p in rings[0]) <= x0 + nx * TREE_CELL
             and max(p[1] for p in rings[0]) >= y0 and min(p[1] for p in rings[0]) <= y0 + ny * TREE_CELL]
    grid = _fill_polygons(polys, (x0, y0), nx, ny, TREE_CELL)
    dist = _chamfer(grid, nx, ny)
    need = math.ceil(3 * TREE_MIN_R * 100 / TREE_CELL)
    candidates = []
    for index, ((rear, record), rect) in enumerate(zip(yards, rects)):
        i0 = max(0, math.floor((min(p[0] for p in rect) - x0) / TREE_CELL))
        i1 = min(nx - 1, math.ceil((max(p[0] for p in rect) - x0) / TREE_CELL))
        j0 = max(0, math.floor((min(p[1] for p in rect) - y0) / TREE_CELL))
        j1 = min(ny - 1, math.ceil((max(p[1] for p in rect) - y0) / TREE_CELL))
        for j in range(j0, j1 + 1):
            for i in range(i0, i1 + 1):
                value = dist[j * nx + i]
                if value >= need and _inside((x0 + (i + .5) * TREE_CELL, y0 + (j + .5) * TREE_CELL), rect):
                    candidates.append((-value, j, i, index))
    candidates.sort()
    traffic_grid, mapped_grid = Grid(2000), Grid(2000)
    for a, b in traffic:
        traffic_grid.add((a, b), [a[0], b[0]], [a[1], b[1]])
    for point in mapped:
        mapped_grid.add(point, [point[0]], [point[1]])
    placed, accepted = {}, Grid(2000)
    ring = [(math.cos(k * math.pi / 4), math.sin(k * math.pi / 4)) for k in range(8)]
    for value, j, i, index in candidates:
        rear, record = yards[index]
        lot_id = rear.lot['id']
        if len(placed.get(lot_id, ())) >= TREE_PER_LOT:
            continue
        r_m = -value / 3 * TREE_CELL / 100
        p = (x0 + (i + .5) * TREE_CELL, y0 + (j + .5) * TREE_CELL)
        # the shared mesh draws a crown about 0.4 x its height across, wider than the survey's crown for the tall
        # trees: neighbours keep their drawn crowns from merging, and the trunk keeps far enough from the house and
        # the galleries that the crown leans on them rather than through them
        height, kind, crown, yaw = tree_shape(r_m, p, rear.lot['storeys'], record['wall_top_cm'])
        reach = TREE_CROWN_R * height * 100 / TREE_MESH_H * max(TREE_CROWN.values())   # not by kind: no species bias
        if any(math.dist(p, (t['x'], t['y'])) < max(300., .55 * (reach + t['reach'])) for t in accepted.near(p[0], p[1], 1800)):
            continue
        wall_clear = max(TREE_CLEAR['wall'], .4 * reach)
        near = rear.near([p], wall_clear)
        if any(_inside(p, poly) or min(_nearest(p, a, b)[0] for a, b in zip(poly, poly[1:] + poly[:1])) < wall_clear
               for poly in near):
            continue
        s = max(TREE_CLEAR['structure'], .3 * reach)
        if occupancy.hit(p) or any(occupancy.hit((p[0] + c * s, p[1] + d * s)) for c, d in ring):
            continue
        fences = [tuple(map(tuple, seg)) for seg in record.get('side_fences', [])]
        fence = record['fence']
        if fence:
            (fx0, fy0), (fx1, fy1) = fence['line']
            fences.append(((fx0, fy0), (fx1, fy1)))
        if any(_nearest(p, a, b)[0] < TREE_CLEAR['fence'] for a, b in fences):
            continue
        roads = [(c, d) for c, d, _, _ in rear.lot.get('roads_near', ())] + traffic_grid.near(p[0], p[1], 600)
        if any(_nearest(p, c, d)[0] < TREE_CLEAR['traffic'] for c, d in roads):
            continue
        if any(math.dist(p, q[:2]) < TREE_CLEAR['mapped'] for q in mapped_grid.near(p[0], p[1], 500)):
            continue
        scale = min(TREE_SCALE_MAX, round(height * 100 / TREE_MESH_H, 3))
        row = {'x': round(p[0], 1), 'y': round(p[1], 1), 'z': 0., 'yaw': round(yaw, 1), 'scale': scale,
               'kind': kind, 'crown_m': round(crown, 1), 'height_m': round(scale * TREE_MESH_H / 100, 2)}
        placed.setdefault(lot_id, []).append(row)
        accepted.add(dict(row, reach=reach), [p[0]], [p[1]])
    return placed


def plan_partitions(rears):
    """Privacy screens between side-by-side galleries (the Plateau's back galleries are outdoor rooms, screened from
    the neighbours by lattice or boards): one at every post two modules of a lot share, and one where a neighbouring
    lot's gallery ends within PARTITION_GAP of this lot's along the same wall line, halfway between the two ends. A
    screen between lots is drawn once: by the lot with the lower id at its own deck levels, and by the other only at
    its levels with no deck of the first within 60 cm. Sets each Rear's `partitions`."""
    ends = []
    for rear in rears:
        st = rear.stack
        if not st or rear.infill == 'iron':
            continue
        wall = st['wall']
        F = Frame(None, wall['a'], wall['b'])
        dF = D_FACE + st['gd']
        zs = [rear.floor_z[k] for k in st['levels']]
        modules = st['modules']
        for module in modules[:-1]:
            rear.partitions.append({'x': module['mx1'], 'd1': dF - 3, 'zs': zs, 'kind': rear.partition,
                                    'neighbour': None})
        for x, sign in ((modules[0]['gx0'], -1), (modules[-1]['gx1'], 1)):
            ends.append({'rear': rear, 'x': x, 'sign': sign, 'mid': F.p(x, (D_FACE + dF) / 2, 0)[:2], 'u': F.u,
                         'zs': zs, 'dF': dF})
    grid = Grid(1000)
    for end in ends:
        grid.add(end, [end['mid'][0]], [end['mid'][1]])
    for end in ends:
        rear = end['rear']
        found = []
        for other in grid.near(end['mid'][0], end['mid'][1], PARTITION_GAP + 40):
            if other['rear'] is rear or abs(end['u'][0] * other['u'][0] + end['u'][1] * other['u'][1]) < .95:
                continue
            v = (other['mid'][0] - end['mid'][0], other['mid'][1] - end['mid'][1])
            along = (v[0] * end['u'][0] + v[1] * end['u'][1]) * end['sign']
            back = -(v[0] * other['u'][0] + v[1] * other['u'][1]) * other['sign']
            across = abs(v[1] * end['u'][0] - v[0] * end['u'][1])
            if 0 <= along <= PARTITION_GAP and back >= 0 and across <= 40:
                found.append((math.hypot(*v), other['rear'].lot['id'], along, other))
        if not found:
            continue
        _, nid, along, other = min(found, key=lambda f: f[:2])
        zs = end['zs'] if rear.lot['id'] < nid else [z for z in end['zs'] if all(abs(z - w) >= 60 for w in other['zs'])]
        if zs:
            rear.partitions.append({'x': end['x'] + end['sign'] * along / 2, 'd1': min(end['dF'], other['dF']) - 3,
                                    'zs': zs, 'kind': rear.partition, 'neighbour': nid})


def build_rears(mesh, lots, tops, canopy=None, traffic=(), mapped=()):
    """Plan every lot's galleries first (so yards see their neighbours' structures), then fences, then author."""
    rears = [Rear(lot, tops[lot['id']]) for lot in lots]
    mesh.rear_start = {material: len(faces) for material, faces in mesh.groups.items()}   # rear faces follow
    occupancy = Occupancy()
    for rear in rears:
        rear.plan_stack(occupancy)
    plan_partitions(rears)
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
    # lots with no yard: lawn and parking on their open walls, clear of every yard and of each other
    taken = Grid(2000)
    for record in records.values():
        rect = (record.get('yard') or {}).get('rect')
        if rect:
            poly = [tuple(q) for q in rect]
            taken.add(poly, [q[0] for q in poly], [q[1] for q in poly])
    for rear in rears:
        if rear.yard_plan is None and not rear.background:
            before = mesh.triangles()
            rear.plan_open_ground(occupancy, taken)
            rear.author_open_ground(mesh, records[rear.lot['id']])
            records[rear.lot['id']]['triangles'] += mesh.triangles() - before
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
        near, roads = rear.near([a, b], 5), rear.yard_roads([a, b])
        pts = [(a[0] + (b[0] - a[0]) * i / (steps - 1), a[1] + (b[1] - a[1]) * i / (steps - 1)) for i in range(steps)]
        ok = [not rear.blocked(p, near, occupancy, roads) for p in pts]
        start = None
        for i, flag in enumerate(ok + [False]):
            if flag and start is None:
                start = i
            elif not flag and start is not None:
                before = mesh.triangles()
                if i - 1 > start and math.dist(pts[start], pts[i - 1]) >= 20:
                    rear._fence_run(mesh, pts[start], pts[i - 1], rear.fence_kind, fence['height'])
                    side_count += 1
                    records[fence['lot']]['triangles'] += mesh.triangles() - before
                    records[fence['lot']].setdefault('side_fences', []).append(
                        [[round(v, 1) for v in pts[start]], [round(v, 1) for v in pts[i - 1]]])
                start = None
    # yard trees from the canopy survey, after every structure and fence is in place
    trees = plan_yard_trees(rears, records, occupancy, canopy, traffic, mapped)
    for lot_id, rows in trees.items():
        records[lot_id]['yard']['trees'] = rows
    for record in records.values():
        if record['yard'] is not None:
            record['yard'].setdefault('trees', [])
    for rows in trees.values():
        for row in rows:
            counts['yard_trees_' + row['kind']] = counts.get('yard_trees_' + row['kind'], 0) + 1
    counts['yard_trees'] = sum(len(rows) for rows in trees.values())
    for rear in rears:
        for key, value in rear.counts.items():
            counts[key] = counts.get(key, 0) + value
    counts['side_fence_runs'] = side_count
    counts['lots_with_rear_walls'] = sum(1 for r in records.values() if any(w['kind'] == 'rear' for w in r['walls']))
    counts['lots_with_galleries'] = sum(1 for r in records.values() if r['galleries'])
    counts['triangles'] = mesh.triangles() - total_before
    return records, counts


# ----------------------------------------------------------------------- background backs
# The masses this layer gives no front (the park-perimeter row, the skipped buildings) still carry the old 'OSM
# Glass' cards on their backs: 130 x 160 cm quads 3 cm in front of every wall of 2.5 m or more of every mass
# (Data/Plateau/BaseGeometry/Glass.obj). Every such mass with a card that no detailed front covers and no taller
# neighbour hides gets the same back-wall skin and applied windows as a plex lot, so no card floats on a blank wall.
GLASS = 'Data/Plateau/BaseGeometry/Glass.obj'
GLASS_REMOVED = (plateau_tower.OSM_ID, plateau_school.OSM_ID)   # plateau_landmark_visuals drops their cards
GLASS_ENCLOSED = (plateau_landmarks.STAGE_ID,)                    # inside the Théâtre de Verdure envelope
DETAIL_MASONRY = {'BrickRed': 'Brick_Red', 'BrickBrown': 'Brick_Brown', 'BrickOchre': 'Brick_Buff_Even', 'Limestone': 'Stone'}
# Mid-century towers are buff or brown brick (the red ones read as a flat orange-red box); four entries, one draw,
# as before, so every tower's later draws stay put.
TOWER_BRICK = ('Brick_Brown', 'Brick_Buff_Even', 'Brick_Buff_Even', 'Brick_BrownDark')
BACKGROUND_BAY = 300.      # window bay on the background skins (was 450: the walls read as blank boxes)
TOWER_PARAPET = 60.        # a tower's skin rises this far over its mass roof as a parapet with a metal coping
PARK_STRUCTURES = ('pavilion', 'kiosk', 'hut')


def glass_cards(path=None):
    """The old glass cards as (centre xy, bottom z, top z) in the map frame (the OBJ stores -y)."""
    vertices, faces = [], 0
    for line in Path(path or ROOT / GLASS).read_text().splitlines():
        if line.startswith('v '):
            x, y, z = line.split()[1:4]
            vertices.append((float(x), -float(y), float(z)))
        elif line.startswith('f '):
            faces += 1
    assert len(vertices) == 4 * faces, 'one quad per card'
    cards = []
    for i in range(0, len(vertices), 4):
        q = vertices[i:i + 4]
        cards.append(((sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4), min(p[2] for p in q), max(p[2] for p in q)))
    return cards


def card_walls(cards, buildings):
    """The wall each card stands on: (building id, edge index, outward normal), from its 3 cm offset, the way
    plateau_landmark_visuals matches them; None for a card on no mapped wall."""
    grid = Grid(2000)
    for building in buildings:
        points = building['points']
        for i in range(len(points)):
            a, b = points[i], points[(i + 1) % len(points)]
            grid.add((str(building['id']), i, a, b), [a[0], b[0]], [a[1], b[1]])
    owners = []
    for centre, _, _ in cards:
        found = None
        for bid, i, a, b in grid.near(centre[0], centre[1], 50):
            length = math.dist(a, b)
            if length < 1:
                continue
            n = ((b[1] - a[1]) / length, -(b[0] - a[0]) / length)
            if abs((centre[0] - a[0]) * n[0] + (centre[1] - a[1]) * n[1] - 3) < .1 and _nearest(centre, a, b)[0] < 3.1:
                found = (bid, i, n)
                break
        owners.append(found)
    return owners


def detail_fronts():
    """Wall runs the existing detailed layers already dress: the Panet/Visitation route fronts with their corner
    returns (layout.json) and the park-perimeter fronts (perimeter.json)."""
    layout = json.loads((ROOT / 'Data/Plateau/layout.json').read_text())
    perimeter = json.loads((ROOT / 'Data/Plateau/PerimeterGeometry/perimeter.json').read_text())
    fronts = {}
    for record in layout['facades']['fronts'] + perimeter['fronts']:
        for item in [record] + list(record.get('corner_returns', ())):
            fronts.setdefault(str(item['id']), []).append(
                {'a': tuple(item['a']), 'b': tuple(item['b']), 'normal': tuple(item['normal']),
                 'levels': item.get('levels'), 'masonry': item.get('masonry') or item.get('style'),
                 'source': 'perimeter' if record.get('perimeter') else 'route'})
    return fronts


def _front_top(centre, n, own, grid, tops):
    """The visible top of a neighbour standing within 25 cm of the card's wall (the slot a skin needs: the back-wall
    rule samples 25 cm out too), or None."""
    probe = (centre[0] + n[0] * 22, centre[1] + n[1] * 22)
    found = [tops.get(str(b['id']), b['height']) for b in grid.near(probe[0], probe[1], 1)
             if str(b['id']) != own and _inside(probe, b['points'])]
    return max(found) if found else None


def _card_hidden(centre, n, top, own, grid, tops):
    """A taller neighbour (by its visible top) stands right in front of the card."""
    found = _front_top(centre, n, own, grid, tops)
    return found is not None and found >= top - 20


def _on_segment(centre, n, segment, slack=35.):
    a, b = segment[0], segment[1]
    length = math.dist(a, b)
    if length < 1:
        return False
    u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    along = (centre[0] - a[0]) * u[0] + (centre[1] - a[1]) * u[1]
    return abs(u[0] * n[0] + u[1] * n[1]) < .3 and -10 <= along <= length + 10 and _nearest(centre, a, b)[0] <= slack


def background_masses(buildings, roads, lot_ids, skipped, cards, owners):
    """Pseudo-lots for every mass outside this layer with a glass card that shows: no detailed front over it, no
    taller neighbour in front of it. Each gets the yard-side skin of a plex lot (Rear), with no gallery or yard."""
    fronts = detail_fronts()
    grid = Grid(3000)
    for building in buildings:
        grid.add(building, [p[0] for p in building['points']], [p[1] for p in building['points']])
    showing, card_top = {}, {}
    for (centre, _, top), owner in zip(cards, owners):
        if owner is None or owner[0] in lot_ids or owner[0] in GLASS_REMOVED or owner[0] in GLASS_ENCLOSED:
            continue
        bid, _, n = owner
        card_top[bid] = max(card_top.get(bid, 0.), top)
        if _card_hidden(centre, n, top, bid, grid, {}) or any(_on_segment(centre, n, (f['a'], f['b'])) for f in fronts.get(bid, ())):
            continue
        showing[bid] = showing.get(bid, 0) + 1
    segments, _ = _drive_segments(roads)
    road_grid = Grid()
    for record in segments:
        road_grid.add(record, [record[0][0], record[1][0]], [record[0][1], record[1][1]])
    local, owners_by_edge = [], {}
    for building in buildings:
        points = [tuple(p[:2]) for p in building['points']]
        local.append((building, points))
        for a, b in zip(points, points[1:] + points[:1]):
            owners_by_edge.setdefault(tuple(sorted((a, b))), []).append(str(building['id']))
    shared = {key for key, ids in owners_by_edge.items() if len(ids) > 1}
    heights = {str(b['id']): b['height'] for b in buildings}
    local_grid = Grid(3000)
    for item in local:
        local_grid.add(item, [p[0] for p in item[1]], [p[1] for p in item[1]])
    masses = []
    for building, points in local:
        bid = str(building['id'])
        if bid not in showing:
            continue
        t = building.get('tags', {})
        cx, cy = sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)
        near = [other for other in local_grid.near(cx, cy, 6000) if other[0] is not building]
        obstacles = [points] + [other[1] for other in near]
        roads_near = [(c, d, road.get('tags', {}).get('service') == 'alley',
                       road.get('tags', {}).get('highway') in DRIVE and bool(road.get('name')))
                      for c, d, road, _ in road_grid.near(cx, cy, 6000)]
        own_fronts = fronts.get(bid, [])
        levels = next((f['levels'] for f in own_fronts if f['levels']), None)
        try:
            levels = levels or int(float(re.findall(r'[\d.]+', t.get('building:levels', ''))[0]))
        except (IndexError, ValueError):
            levels = None
        height = building['height']
        storeys = max(1, min(30, levels or round(height / 320)))
        raise_cm = 60 if height <= 2400 else 30
        masonry = DETAIL_MASONRY.get(next((f['masonry'] for f in own_fronts if f['masonry']), ''), 'Brick_Red')
        kind = ('perimeter' if any(f['source'] == 'perimeter' for f in own_fronts) else 'route' if own_fronts
                else 'skipped: ' + skipped.get(bid, 'outside the plex layer'))
        rng = random.Random(_seed('plex-background', bid))
        skin_wall = None
        if height > 2400:
            skin_wall = rng.choice(TOWER_BRICK)
        elif t.get('building') in PARK_STRUCTURES or t.get('building') in ('government', 'school') or t.get('amenity') == 'school':
            skin_wall = 'Stone_Cast' if t.get('building') in PARK_STRUCTURES + ('government',) else 'Brick_Red'
        backs = _back_walls(points, own_fronts, obstacles, shared, roads_near,
                            own_fronts[0]['normal'] if own_fronts else None)
        # the card generator's top row can stand up to 10 cm over a low mass's roof: the skin rises over it. A tower
        # (over 24 m, all mid-century apartment blocks here) takes the post-1945 kit, with balconies on every second
        # bay and a parapet TOWER_PARAPET over its roof.
        tower = height > 2400
        mass = {'id': bid, 'points': points, 'height_cm': height, 'storeys': storeys, 'raise': raise_cm,
                'wall_top': max(height, card_top.get(bid, 0.) + 2) + (TOWER_PARAPET if tower else 0.),
                'floor_height': max(270., min(340., (height - raise_cm - 40) / storeys)), 'commercial': False,
                'masonry': masonry, 'skin_wall': skin_wall, 'background': True, 'kind': kind, 'cards': showing[bid],
                'backs': backs, 'obstacles': obstacles, 'roads_near': roads_near, 'year': 1965 if tower else 1900,
                'paint': 'Wood_Grey', 'crown': 'flat', 'sash': 'double_hung', 'primary': None, 'sides': [],
                'modern': tower, 'parapet_from': height if tower else None}
        if tower:
            _modern_paint(mass, bid)
        mass['party'] = _party_edges(points, bid, own_fronts, backs, owners_by_edge, near, heights)
        masses.append(mass)
    return masses


BACKGROUND_ROOF_MIX = ((.58, 'Roof_Membrane'), (.93, 'Roof_Gravel'), (1.01, 'Roof_Tar'))


def author_background_roof(mesh, mass, counts):
    """The roof of a background mass (the park-perimeter row and the skipped buildings), which the old map left as its
    dark grey mass top: white membrane or white gravel ballast, a few tar and gravel (the borough's white-roof rule, as
    on the plex lots), as a skin ROOF_SKIN over the mass top; a brick chimney and a galvanised hatch on a mass of four
    storeys or fewer, the post-1945 kit's lift penthouse and vents on a tower, and nothing on a cast-stone park
    pavilion or government building. The props stand in the frame of the mass's longest edge. Own seed. Returns the
    roof record."""
    rng = random.Random(_seed('plex-background-roof', mass['id']))
    pick, chimney_t, chimney_h, hatch_f = rng.random(), rng.uniform(.25, .5), rng.uniform(100., 160.), rng.random()
    roof = next(key for limit, key in BACKGROUND_ROOF_MIX if pick < limit)
    points = mass['points']
    R = mass['height_cm'] + ROOF_SKIN
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    for triangle in triangulate([list(points)], (min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1)):
        mesh.face(roof, [(p[0], p[1], R) for p in triangle], (0, 0, 1))

    def count(key, n=1):
        counts[key] = counts.get(key, 0) + n
    count('roof_' + roof)
    record = {'material': roof, 'z_cm': round(R, 1), 'chimney': False, 'hatch': False}
    n = len(points)
    i = max(range(n), key=lambda k: (math.dist(points[k], points[(k + 1) % n]), -k))
    a, b = points[i], points[(i + 1) % n]
    if _area(points) < 0:
        a, b = b, a                     # the frame's n points out of the mass
    Ff = Frame(mesh, a, b)
    W = math.dist(a, b)
    depth = max(-((p[0] - a[0]) * Ff.n[0] + (p[1] - a[1]) * Ff.n[1]) for p in points)

    def fits(x0, x1, t0, t1, margin=30.):
        corners = [(x, t) for x in (x0 - margin, (x0 + x1) / 2, x1 + margin) for t in (t0 - margin, (t0 + t1) / 2, t1 + margin)]
        return all(_inside(Ff.p(x, -t, 0)[:2], points) for x, t in corners)
    placed = []

    def free(x0, x1, t0, t1):
        return all(x1 + 40 <= q[0] or x0 - 40 >= q[1] or t1 + 40 <= q[2] or t0 - 40 >= q[3] for q in placed)

    def box(mat, x0, x1, t0, t1, z0, z1, skip='b'):
        Ff.box(mat, x0, x1, -t1, -t0, z0, z1, skip)
    masonry = mass['masonry'] if mass['masonry'] in BRICKS else 'Brick_Red'
    if mass.get('modern'):
        _modern_roof(mass, record, W, depth, R, mass.get('skin_wall') or masonry, box, fits, free, placed, count)
    elif mass.get('skin_wall') != 'Stone_Cast' and mass['storeys'] <= 4:
        for x, t in [(x, t) for t in (chimney_t * depth, depth * .5) for x in (70., W - 70., W / 2)]:
            if W >= 160 and fits(x - 30, x + 30, t - 22, t + 22, 25):
                box(masonry, x - 30, x + 30, t - 22, t + 22, R, R + chimney_h)
                box('Stone_Cast', x - 35, x + 35, t - 27, t + 27, R + chimney_h, R + chimney_h + 6)
                placed.append((x - 35, x + 35, t - 27, t + 27))
                record['chimney'] = True
                count('chimneys')
                break
        for xh, th in ((W * (.35 + .3 * hatch_f), depth * .55), (W / 2, depth * .5), (W * .3, depth * .4)):
            if W >= 200 and fits(xh - 40, xh + 40, th - 40, th + 40, 20) and free(xh - 40, xh + 40, th - 40, th + 40):
                box('Sheet_Metal', xh - 40, xh + 40, th - 40, th + 40, R, R + 45)
                record['hatch'] = True
                count('roof_hatches')
                break
    return record


def build_background(mesh, masses, levels):
    """Skin and window the backs of the background masses, roof them (author_background_roof), and skin any part of a
    party wall left above a lower neighbour (a plex neighbour counts with its parapet coping)."""
    mesh.background_start = {material: len(faces) for material, faces in mesh.groups.items()}
    records, counts = [], {}
    for mass in masses:
        before = mesh.triangles()
        rear = Rear(mass, mass['height_cm'])
        rear.zt = mass['wall_top']
        record = rear.author(mesh)
        roof = author_background_roof(mesh, mass, rear.counts)
        party = []
        for edge in mass['party']:
            neighbour = edge['neighbour']
            below = levels[neighbour] if neighbour in levels else edge['neighbour_height']
            if rear.zt - below < 30:
                continue
            F = Frame(mesh, edge['a'], edge['b'])
            for x0, x1 in edge['spans']:
                F.quad_d(rear.brick, x0, x1, below, rear.zt, D_FACE, 1)
                F.quad_x(rear.brick, x0, 0, D_FACE, below, rear.zt, -1)
                F.quad_x(rear.brick, x1, 0, D_FACE, below, rear.zt, 1)
                F.quad_z('Sheet_Metal', x0, x1, 0, D_FACE, rear.zt, 1)
                party.append({'a': [round(v, 1) for v in F.p(x0, 0, 0)[:2]], 'b': [round(v, 1) for v in F.p(x1, 0, 0)[:2]],
                              'neighbour': neighbour, 'skin_from_cm': round(below, 1), 'top_cm': round(rear.zt, 1)})
                rear.count('party_skins')
        for key, value in rear.counts.items():
            counts[key] = counts.get(key, 0) + value
        records.append({'id': mass['id'], 'kind': mass['kind'], 'storeys': mass['storeys'],
                        'mass_height_cm': round(mass['height_cm'], 1), 'cards_showing': mass['cards'],
                        'walls': record['walls'], 'party': party, 'roof': roof, 'triangles': mesh.triangles() - before,
                        **({'kit': 'post-1945 apartment', 'brick': rear.brick} if mass.get('modern') else {})})
    counts['masses'] = len(records)
    counts['triangles'] = sum(r['triangles'] for r in records)
    return records, counts


def glass_audit(cards, owners, buildings, records, background, levels):
    """Where every old glass card ends up: hidden by a taller neighbour, dropped or enclosed by a landmark, behind a
    detailed route or perimeter front, behind a plex front, back-wall, party or background skin, or floating."""
    grid = Grid(3000)
    for building in buildings:
        grid.add(building, [p[0] for p in building['points']], [p[1] for p in building['points']])
    heights = {str(b['id']): b['height'] for b in buildings}
    tops = {key: max(value, heights.get(key, 0.)) for key, value in levels.items()}
    segments = {}
    for bid, items in detail_fronts().items():
        segments.setdefault(bid, []).extend((f['a'], f['b'], -1e9, 1e9, 'detail') for f in items)
    for record in records:
        own = segments.setdefault(record['id'], [])
        for front in [record['front']] + record['sides']:
            own.append((tuple(front['a']), tuple(front['b']), -1e9, front['top_cm'], 'plex_front'))
        for wall in record.get('rear', {}).get('walls', ()):
            own.append((tuple(wall['a']), tuple(wall['b']), -1e9, wall['top_cm'], 'skin'))
        for edge in record['roof']['party']:
            if edge['skin_from_cm'] is not None:
                own.append((tuple(edge['a']), tuple(edge['b']), edge['skin_from_cm'], edge['top_cm'], 'skin'))
    for record in background:
        own = segments.setdefault(record['id'], [])
        for wall in record['walls']:
            own.append((tuple(wall['a']), tuple(wall['b']), -1e9, wall['top_cm'], 'skin'))
        for edge in record['party']:
            own.append((tuple(edge['a']), tuple(edge['b']), edge['skin_from_cm'], edge['top_cm'], 'skin'))
    result, floating = {}, []
    for (centre, z0, z1), owner in zip(cards, owners):
        if owner is None:
            status = 'unmatched'
        elif owner[0] in GLASS_REMOVED:
            status = 'landmark_removed'
        elif owner[0] in GLASS_ENCLOSED:
            status = 'landmark_enclosed'
        elif _card_hidden(centre, owner[2], z1, owner[0], grid, tops):
            status = 'hidden'
        else:
            low = max(z0, _front_top(centre, owner[2], owner[0], grid, tops) or z0)
            status = next((kind for a, b, s0, s1, kind in segments.get(owner[0], ())
                           if s0 - 1 <= low and z1 <= s1 + 1 and _on_segment(centre, owner[2], (a, b))), 'floating')
        result[status] = result.get(status, 0) + 1
        if status == 'floating':
            floating.append(owner[0])
    return dict(sorted(result.items())), sorted(set(floating))


def build(lots, rear=False, canopy=None, traffic=(), mapped=()):
    """Fronts and roofs (and with rear=True the yard side of every lot). The default keeps the front-only fixtures.
    The roofs follow all the fronts, since each party parapet needs its neighbour's roof height. `canopy` (the
    CANOPY polygons), `traffic` (traffic segments) and `mapped` (mapped tree points) feed the yard trees."""
    mesh = PlexMesh()
    records, counts = [], {}
    tops, lot_skins = {}, {}
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
        lot_skins[lot['id']] = skins
        for key, value in kit.counts.items():
            counts[key] = counts.get(key, 0) + value
        records.append({
            'id': lot['id'], 'street': lot['primary']['street'], 'kind': lot['kind'], 'storeys': lot['storeys'],
            'storeys_source': lot['storeys_source'], 'year': lot['year'], 'era_source': lot['era_source'],
            'crown': lot['crown'], 'masonry': lot['masonry'], 'paint': lot['paint'], 'door': lot['door'],
            'frame': lot['frame'], 'stair': lot['stair'] if record['exterior_stairs'] else None,
            'commercial': lot['commercial'], 'corner': lot['corner'], 'raise_cm': lot['raise'],
            'floor_height_cm': lot['floor_height'], 'mass_height_cm': round(lot['height_cm'], 1),
            'front': record, 'sides': side_records, 'triangles': mesh.triangles() - before,
        })
        if lot.get('roof_check'):
            records[-1]['lod2_roof'] = lot['roof_check']
        if lot.get('year_override'):
            records[-1]['year_override'] = lot['year_override']
        if lot.get('modern'):
            records[-1]['kit'] = 'post-1945 apartment'
        tops[lot['id']] = top
    levels = {lot['id']: roof_level(lot, tops[lot['id']]) for lot in lots}
    modern = {lot['id'] for lot in lots if lot.get('modern')}
    for lot in lots:
        # a post-1945 block's back walls rise past its lowered roof as a parapet (Rear._skin_faces)
        zt = _rear_wall_top(lot, tops[lot['id']])
        lot['parapet_from'] = levels[lot['id']] if lot['id'] in modern and zt - levels[lot['id']] >= 20 else None
    for lot, record in zip(lots, records):
        before = mesh.triangles()
        record['roof'], extended = author_roof(mesh, lot, tops[lot['id']], levels, lot_skins[lot['id']], counts, tops,
                                               modern)
        record['top_extension'] = bool(extended)
        record['roof']['triangles'] = mesh.triangles() - before
        record['triangles'] += mesh.triangles() - before
    if rear:
        rear_records, rear_counts = build_rears(mesh, lots, tops, canopy, traffic, mapped)
        for record in records:
            record['rear'] = rear_records[record['id']]
        for key, value in rear_counts.items():
            counts['rear_' + key] = value
    # no collision within 300 cm of a traffic centreline (the background masses that follow add none)
    counts.update(clear_traffic_band(mesh, traffic))
    return mesh, records, counts


# ---------------------------------------------------------------------------------- batching
def batches(mesh, tile=TILE_CM, max_batches=MAX_BATCHES, cap=MAX_BATCH_TRIANGLES):
    """Group faces by material and grid tile; widen the tile in whole 47.5 m steps only when
    the batch cap needs it, then split any batch over `cap` triangles on the base grid."""
    source = []
    visual = getattr(mesh, 'visual', set())
    for material in sorted(mesh.groups):
        for index, face in enumerate(mesh.groups[material]):
            cx = sum(p[0] for p in face) / len(face)
            cy = sum(p[1] for p in face) / len(face)
            source.append((material, (material, index) in visual, face, cx, cy))
    for factor in range(1, 9):
        size = tile * factor
        buckets = {}
        for material, seen, face, cx, cy in source:
            buckets.setdefault((material, seen, math.floor(cx / size), math.floor(cy / size)), []).append((face, cx, cy))
        if len(buckets) <= max_batches:
            break
    output = {}
    def name(material, seen, i, j, suffix=''):
        c = lambda v: ('M' if v < 0 else 'P') + f'{abs(v):03d}'
        return f'{material.replace("_", "")}{VISUAL if seen else ""}_X{c(i)}_Y{c(j)}{suffix}'
    for (material, seen, i, j), faces in sorted(buckets.items()):
        triangles = sum(len(f) - 2 for f, _, _ in faces)
        if triangles <= cap:
            output[name(material, seen, i, j)] = (material, [f for f, _, _ in faces])
            continue
        parts = {}
        for f, cx, cy in faces:
            parts.setdefault((math.floor(cx / tile), math.floor(cy / tile)), []).append(f)
        for (si, sj), part in sorted(parts.items()):
            output[name(material, seen, i, j, f'_S{si - i * factor:01d}{sj - j * factor:01d}')] = (material, part)
    return output, size


def batch_collision(name, material):
    """The manifest collision of a batch: 'none' for the Visual Wood_Deck batches (faces in the traffic band)."""
    if name.split('_')[0] == material.replace('_', '') + VISUAL:
        return 'none'
    return COLLISION.get(material, 'none')


def _poly_seg(poly, a, b):
    """Distance between a polygon's xy outline and the segment ab: 0 when they touch or the segment is inside (the
    replica's poly_seg_dist, so the band test here and the replica test measure alike)."""
    if _inside(a, poly) or _inside(b, poly):
        return 0.
    best = math.inf
    for p, q in zip(poly, poly[1:] + poly[:1]):
        d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
        d3 = (q[0] - p[0]) * (a[1] - p[1]) - (q[1] - p[1]) * (a[0] - p[0])
        d4 = (q[0] - p[0]) * (b[1] - p[1]) - (q[1] - p[1]) * (b[0] - p[0])
        if (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0):
            return 0.
        best = min(best, _nearest(p, a, b)[0], _nearest(q, a, b)[0], _nearest(a, p, q)[0], _nearest(b, p, q)[0])
    return best


def clear_traffic_band(mesh, traffic, clear=TRAFFIC_CLEAR):
    """No collision within `clear` of a traffic centreline (the Streets layer rule and the spec): every collision face
    whose outline comes nearer takes its whole unit out of collision. Wood_Deck faces of such a unit stay visible in
    Visual batches with no collision; Collision_Only faces there are dropped (they draw nothing). Returns counts."""
    mesh.visual = set()
    if not traffic:
        return {}
    grid = Grid(2000)
    for a, b in traffic:
        grid.add((a, b), [a[0], b[0]], [a[1], b[1]])
    face_unit = {f: unit for unit, faces in mesh.unit_faces.items() for f in faces}
    units, loose = set(), set()
    for material in sorted(COLLISION):
        for index, face in enumerate(mesh.groups.get(material, ())):
            xs, ys = [p[0] for p in face], [p[1] for p in face]
            x0, y0, x1, y1 = min(xs) - clear, min(ys) - clear, max(xs) + clear, max(ys) + clear
            near = [(a, b) for a, b in grid.near((x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2)
                    if min(a[0], b[0]) <= x1 and max(a[0], b[0]) >= x0 and min(a[1], b[1]) <= y1 and max(a[1], b[1]) >= y0]
            if not near:
                continue
            poly = [p[:2] for p in face]
            if min(_poly_seg(poly, a, b) for a, b in near) < clear:
                unit = face_unit.get((material, index))
                if unit is None:
                    loose.add((material, index))
                else:
                    units.add(unit)
    flagged = loose | {f for unit in units for f in mesh.unit_faces[unit]}
    mesh.visual = {f for f in flagged if f[0] != 'Collision_Only'}
    dropped = sorted(i for m, i in flagged if m == 'Collision_Only')
    if dropped:
        faces = mesh.groups['Collision_Only']
        gone = set(dropped)
        mesh.groups['Collision_Only'] = [f for i, f in enumerate(faces) if i not in gone]
        mesh.count -= sum(len(faces[i]) - 2 for i in dropped)
        for marker in ('rear_start', 'background_start'):
            start = getattr(mesh, marker, None)
            if start and 'Collision_Only' in start:
                start['Collision_Only'] -= sum(1 for i in dropped if i < start['Collision_Only'])
    return {'traffic_band_units': len(units), 'traffic_band_loose_faces': len(loose),
            'traffic_band_visual_faces': len(mesh.visual), 'traffic_band_dropped_collision_faces': len(dropped),
            'traffic_band_lots': len({unit[1] for unit in units})}


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
    result = {
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
    if records and 'roof' in records[0]:
        roofs = [r['roof'] for r in records]
        result['roofs'] = {'materials': dict(sorted(Counter(roof['material'] for roof in roofs).items())),
                           'chimneys': sum(roof['chimney'] for roof in roofs), 'hatches': sum(roof['hatch'] for roof in roofs),
                           'terraces': sum(roof['terrace'] for roof in roofs),
                           'party_copings': sum(len(roof['party']) for roof in roofs),
                           'party_skins': sum(1 for roof in roofs for edge in roof['party'] if edge['skin_from_cm'] is not None),
                           'triangles': sum(roof['triangles'] for roof in roofs)}
    if records and 'rear' in records[0]:
        result['rear'] = _rear_summary([r['rear'] for r in records])
    return result


def _rear_summary(rears):
    from collections import Counter
    fences = [r['fence'] for r in rears if r['fence']]
    with_galleries = [r for r in rears if r['galleries']]
    return {
        'back_walls': dict(sorted(Counter(w['kind'] for r in rears for w in r['walls']).items())),
        'lots_with_galleries': len(with_galleries),
        'galleries': sum(r['galleries'] for r in rears),
        'stairs': dict(sorted(Counter(r['stair'] for r in with_galleries for w in r['walls'] if w['galleries']
                                      for _ in range(w['modules'])).items())),
        'flights': sum(len(r['flights']) for r in rears),
        'no_gallery_reasons': dict(sorted(Counter(r['reason'] for r in rears if not r['galleries'] and r['reason']).items())),
        'fences': {'lane': sum(f['lane'] for f in fences), 'rear_lot_line': sum(not f['lane'] for f in fences),
                   'gates': sum(f['gate'] for f in fences), 'kinds': dict(sorted(Counter(f['kind'] for f in fences).items()))},
        'outbuildings': dict(sorted(Counter(r['shed'] for r in rears if r['shed']).items())),
        'yards': _yard_summary(rears),
        'triangles': sum(r['triangles'] for r in rears),
    }


def _yard_summary(rears):
    from collections import Counter
    yards = [r['yard'] for r in rears if r.get('yard')]
    trees = [t for y in yards for t in y.get('trees', ())]
    heights = sorted(t['height_m'] for t in trees)
    areas = {}
    for y in yards:
        for mat, value in y['area_m2'].items():
            areas[mat] = areas.get(mat, 0.) + value
    return {'lots': len(yards), 'mixes': dict(sorted(Counter(y['mix'] for y in yards).items())),
            'lane_edges': dict(sorted(Counter(y['edge'] for y in yards).items())),
            'parking_pads': sum(1 for y in yards if y['pad']),
            'area_m2': {mat: round(v, 1) for mat, v in sorted(areas.items())},
            'ground_decks': sum(len(r.get('ground_decks', ())) for r in rears),
            'trees': dict(sorted(Counter(t['kind'] for t in trees).items())),
            'tree_height_m': {'min': heights[0], 'median': heights[len(heights) // 2], 'max': heights[-1]} if heights else None}


def prepare(directory=OUT, write=True, keep=None):
    """Build the layer; `keep` (a dict) receives the mesh and lots for the tests."""
    buildings, roads = geography()
    roll_data = json.loads(ROLL_JOIN.read_text()) if ROLL_JOIN.exists() else {'buildings': {}}
    _, shops = osm_points()
    skip = excluded_ids()
    plain = [b for b in buildings if str(b['id']) not in skip]
    lod2 = lod2_heights(plain)
    roofs, lod2_read = lod2_roofs(plain, roll_data['buildings'])
    lots, skipped = select_fronts(buildings, roads, skip, roll_data['buildings'], lod2, shops, roofs)
    canopy = json.loads(CANOPY.read_text()) if CANOPY.exists() else None
    layout = json.loads((ROOT / 'Data/LaFontaine/layout.json').read_text())
    traffic = [(tuple(a[:2]), tuple(b[:2])) for road in layout['roads'] for a, b in zip(road, road[1:])]
    from plateau_rendering import tree_positions
    mesh, records, counts = build(lots, rear=True, canopy=canopy, traffic=traffic, mapped=tree_positions())
    cards = glass_cards()
    owners = card_walls(cards, buildings)
    lot_ids = {lot['id'] for lot in lots}
    masses = background_masses(buildings, roads, lot_ids, skipped, cards, owners)
    levels = {record['id']: record['roof']['z_cm'] for record in records}
    background, background_counts = build_background(mesh, masses, levels)
    for key, value in background_counts.items():
        counts['background_' + key] = value
    audit, floating = glass_audit(cards, owners, buildings, records, background, levels)
    if keep is not None:
        keep.update(mesh=mesh, lots=lots, masses=masses, audit=audit, floating=floating)
    groups, tile = batches(mesh)
    directory = Path(directory)
    manifest_batches = []
    for key in sorted(groups):
        material, faces = groups[key]
        manifest_batches.append({'file': key + '.obj', 'mesh': f'SM_{LAYER}_{key}', 'material': material,
                                 'collision': batch_collision(key, material),
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
        data = obj_text(f'SM_{LAYER}_{key}', groups[key][1], groups[key][0]).encode()
        hashes[key + '.obj'] = batch['sha256'] = hashlib.sha256(data).hexdigest()
        if write:
            (directory / (key + '.obj')).write_bytes(data)
    sources = ['Data/LaFontaine/osm.xml', 'Data/CityBuildings/manifest.json', 'Data/Plateau/layout.json',
               'Data/Plateau/PerimeterGeometry/perimeter.json', GLASS, GENERATOR] + lod2_read
    if ROLL_JOIN.exists():
        sources.append(str(ROLL_JOIN.relative_to(ROOT)))
    sources.append('Data/LaFontaine/layout.json')
    if CANOPY.exists():
        sources.append(str(CANOPY.relative_to(ROOT)))
    trees = yard_trees_document(records)
    tree_bytes = (json.dumps(trees, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    if keep is not None:
        keep.update(yard_trees=trees, yard_tree_bytes=tree_bytes)
    stats = summary(records, skipped, lots)
    from collections import Counter
    stats['background'] = {'masses': len(background),
                           'kinds': dict(sorted(Counter(r['kind'] for r in background).items())),
                           'walls': dict(sorted(Counter(w['kind'] for r in background for w in r['walls']).items())),
                           'windows': sum(w['windows'] for r in background for w in r['walls']),
                           'party_skins': sum(len(r['party']) for r in background),
                           'roofs': {'materials': dict(sorted(Counter(r['roof']['material'] for r in background).items())),
                                     'chimneys': sum(r['roof']['chimney'] for r in background),
                                     'hatches': sum(r['roof']['hatch'] for r in background),
                                     'penthouses': sum(r['roof'].get('penthouses', 0) for r in background)},
                           'triangles': sum(r['triangles'] for r in background)}
    stats['glass_cards'] = {'status': audit, 'floating_on': floating}
    stats['walls_pass'] = {
        'year_overrides': {r['id']: r['year'] for r in records if r.get('year_override')},
        'post_1945_kit': {'lots': sorted(r['id'] for r in records if r.get('kit')),
                          'towers': sorted(r['id'] for r in background if r.get('kit')),
                          'balconies': sum(counts.get(k, 0) for k in ('modern_balconies', 'side_modern_balconies',
                                                                      'rear_modern_balconies', 'background_modern_balconies'))},
        'open_ground': {'lots': sum(1 for r in records if r['rear'].get('open_ground')),
                        'area_m2': {m: round(sum(r['rear']['open_ground']['area_m2'].get(m, 0.) for r in records
                                                 if r['rear'].get('open_ground')), 1) for m in ('Yard_Grass', 'Asphalt_Lot')},
                        'stall_lines': counts.get('rear_parking_stall_lines', 0)},
        'collision': {'guard_runs': counts.get('rear_guard_collision_runs', 0),
                      'flight_runs': counts.get('rear_flight_collision_runs', 0),
                      'balcony_rail_runs': counts.get('rail_collision_runs', 0),
                      'traffic_band_units': counts.get('traffic_band_units', 0),
                      'traffic_band_lots': counts.get('traffic_band_lots', 0),
                      'traffic_band_visual_faces': counts.get('traffic_band_visual_faces', 0)}}
    manifest = {
        'layer': LAYER, 'generator': GENERATOR, 'frame': 'x east, y north, cm, z up',
        'batches': manifest_batches,
        'materials': {key: MATERIALS[key] for key in sorted({b['material'] for b in manifest_batches})},
        'counts': dict(sorted({**counts, 'fronts': len(records), 'corner_side_fronts': stats['corner_side_fronts'],
                               'batches': len(manifest_batches), 'triangles': total,
                               'top_extensions': sum(r['top_extension'] for r in records),
                               **{'glass_cards_' + key: value for key, value in audit.items()}}.items())),
        'batching': {'base_tile_cm': TILE_CM, 'tile_cm': tile, 'max_batches': MAX_BATCHES,
                     'max_batch_triangles': MAX_BATCH_TRIANGLES},
        'offsets_cm': {'glass_and_recess_back': D_BACK, 'masonry_face': D_FACE, 'osm_glass_cards': 3.0},
        'collision_note': "'complex' = use complex collision as simple on that batch (stair treads, stoops, "
                          'balcony decks, rear gallery decks and rear stair treads), as the existing *_Collision batches '
                          "do; skins, fences, sheds and plants are NoCollision. Collision_Only batches collide but never "
                          'render (gallery guards, stair-opening edges, balcony rails): the apply step spawns them '
                          'hidden in game, blocking pawns and ignoring the camera and visibility. No collision face '
                          'comes within 300 cm of a traffic centreline: a unit (a front stair with its head balcony, a '
                          "porch, a balcony, a rear stack) that would goes to the 'WoodDeckVisual' batches, which have "
                          'none.',
        'source_sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in sources},
        'geometry_sha256': hashes,
        'yard_trees': {'file': YARD_TREES.name, 'count': len(trees['trees']), 'sha256': hashlib.sha256(tree_bytes).hexdigest(),
                       'kinds': dict(sorted(Counter(t['kind'] for t in trees['trees']).items())),
                       'source': trees['source']},
        'attribution': ['© OpenStreetMap contributors, ODbL 1.0',
                        'Ville de Montréal, données ouvertes (CC BY 4.0): Bâtiments 3D 2016 LOD2 heights; '
                        "Unités d'évaluation foncière (year built, storeys) joined by address; Canopée 2019 "
                        '(yard trees; photo aérienne et lidar © Communauté métropolitaine de Montréal)'],
        'limits': 'Footprints, street edges, storeys and construction years are data-driven where available. '
                  'Brick colours, trim colours, door and window rhythm, stair shape and cornice details are '
                  'rule-and-seed estimates after the Plateau heritage sheets, not surveys of individual buildings. '
                  'Rear galleries, stairs, fences, gates, sheds, plants and the yard ground cover are rule-and-seed '
                  'estimates too; lot lines are not mapped, so the rear lot line is taken at the ruelle or halfway to '
                  'the next building. Yard trees stand where the 2019 canopy survey shows crowns; their species and '
                  'heights are estimates from crown size.',
    }
    lots_out = {'layer': LAYER, 'fronts': records, 'skipped': dict(sorted(skipped.items())), 'background': background,
                'glass_cards': {'status': audit, 'floating_on': floating}}
    if write:
        (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
        (directory / 'summary.json').write_text(json.dumps(stats, ensure_ascii=False, indent=1) + '\n')
        (directory / 'fronts.json').write_text(json.dumps(lots_out, ensure_ascii=False, separators=(',', ':')) + '\n')
        (directory / YARD_TREES.name).write_bytes(tree_bytes)
    return manifest, stats, lots_out, groups


def yard_trees_document(records):
    """Plex/yard_trees.json: the apply step's rows {x, y, z, yaw, scale, kind} (replica frame, cm, degrees; scale on
    the shared tree mesh), with the source and method."""
    rows = [{key: t[key] for key in ('x', 'y', 'z', 'yaw', 'scale', 'kind')}
            for record in records for t in ((record.get('rear') or {}).get('yard') or {}).get('trees', ())]
    rows.sort(key=lambda t: (t['y'], t['x']))
    return {'source': CANOPY_SOURCE if CANOPY.exists() else 'none: no canopy clip, no yard trees',
            'generator': GENERATOR,
            'method': 'Crown centres at the distance-transform maxima of the 2019 canopy on a 1 m grid, largest first, '
                      'in plex yards only, trunks clear of buildings (2 m), galleries, stairs, decks, sheds, pads, '
                      'hedges and cedars (0.9 m), fences (0.6 m), the 3 m traffic clearance and mapped trees (4 m). '
                      'Crowns under 6 m are small trees; others are maple (55%), ash (30%) or elm (15%) by a seeded '
                      'draw, 12.5 to 18 m tall. scale = height / 4.55 m on tree_small_02.',
            'frame': 'x east, y north, cm, z up (the replica frame)',
            'trees': rows}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--join-roll':
        data = join_roll(sys.argv[2])
        OUT.mkdir(parents=True, exist_ok=True)
        ROLL_JOIN.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        print(len(data['buildings']), 'buildings joined ->', ROLL_JOIN.relative_to(ROOT))
    elif len(sys.argv) == 3 and sys.argv[1] == '--clip-canopy':
        data = clip_canopy(sys.argv[2])
        OUT.mkdir(parents=True, exist_ok=True)
        CANOPY.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        print(len(data['polygons']), 'canopy polygons ->', CANOPY.relative_to(ROOT))
    else:
        manifest, stats, _, _ = prepare()
        print(json.dumps({'counts': manifest['counts'], 'batching': manifest['batching'], 'summary': stats},
                         ensure_ascii=False, indent=1))
