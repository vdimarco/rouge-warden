"""Street-level Cycles previews of the Plateau replica layers, in the game frame.

Run with a Python that can `import bpy` (Blender 5.1), from games/nord-unreal:

    <blender-python> Scripts/blender/plateau_replica_preview.py --view mentana
    <blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --before
    <blender-python> Scripts/blender/plateau_replica_preview.py --list

Each view loads, inside a camera wedge, the committed Data/Plateau layers that are visible in the game
(background masses, OSM road, path, glass cards, ground, park, perimeter and context batches) and,
unless --before is given, the ReplicaGeometry layers: Streets, Plex, Soul, and the Furniture and Soul
placements instanced from the Props meshes in the colour variant the apply step picks from each row's seed,
with the street-name text the apply step adds. Collision_Only batches (the gallery guards' invisible walls)
are never drawn: the apply step hides them in game. A face is loaded when a corner lies inside the wedge or
an edge crosses it, so a long lane quad whose corners lie behind the camera and past the far distance stays.
The street and park trees of Streets/street_trees.json and the Plex yard trees stand on the species meshes of
Trees/manifest.json (each kind's young mesh for a young street tree), placed by the apply step's plan_trees.

Frame: every OBJ stores (x, -y, z) of a game-frame point (x east, y north, cm). Blender is
right-handed, so placing the file coordinates unchanged shows the world as Unreal's left-handed view
shows it: the player's view of the mirrored map (openspec/changes/nord-gta-level-up/notes-mirror.md).
Prop instances use the file coordinates of their meshes, position (x, -y, z) and yaw -yaw.

These are previews of generated geometry, not Unreal captures. Colours come from the layer manifests
and from the colours `upgrade_plateau.py` gives the existing materials; the four Poly Haven textures in
Data/Art are used the way the game materials use them, and every replica texture set in
ReplicaGeometry/Textures (and the Trees manifest's bark and leaf atlas) the way apply_plateau_replica.py uses
it, from the apply step's own material rows (material_row): the same keys, tint (white for a set that owns its
colour, the tar), tiling, macro variation (Brick_Buff_Even, the roofs and the crushed stone), metallic cap, the
DirectX normal map, roughness from R, the set's address modes (cards clamp V, the laundry and leaf atlases
clamp both axes), and for the masked sets (the cut-out cards, the creeper, cedar, fountain grass, pit flowers, the
wrought iron, the laundry, the tree leaves) the diffuse alpha clipped at the set's opacity_mask_clip, two-sided,
with the two-sided foliage transmission (base colour x .65). The street and park trees and the yard trees stand on
the species meshes of Trees/manifest.json with the apply step's transforms (apply_plateau_replica.plan_trees). The
old summer tree (tree_small_02, at plateau_rendering.tree_positions) appears only in --before images, or when
Streets/street_trees.json does not exist: the apply step clears QuebecVegetation's instances once it does.

    <blender-python> Scripts/blender/plateau_replica_preview.py --view ruelle_mentana --probe 640,360 990,60

--probe builds the view and, instead of rendering, casts a camera ray through each pixel (x,y from the
top left of the 1280 x 720 frame, or of --res) and prints what it hits: the batch, material, game-frame
point (cm), normal and whether the face is seen from behind. Rays pass through the clear texels of the
masked cards, as the clipped material does.
"""
import argparse
import json
import math
import os
import re
import sys
import time

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DATA = os.path.join(ROOT, 'Data', 'Plateau')
REPLICA = os.path.join(DATA, 'ReplicaGeometry')
ART = os.path.join(ROOT, 'Data', 'Art')
CACHE = os.path.join(ROOT, 'Saved', 'ReplicaPreview')
OUT = os.path.join(ROOT, 'Preview', 'Replica')
sys.path.insert(0, os.path.join(ROOT, 'Scripts'))
# The apply step's material rules, texture sets and yard-tree plan.
from apply_plateau_replica import (COLLISION_ONLY, FOLIAGE_SUBSURFACE, YOUNG, address_modes,  # noqa: E402
                                   load_street_trees, load_textures, load_tree_kinds, load_yard_trees, material_row,
                                   plan_trees, tree_slot)

# Labels hidden in the game: the OSM masses keep collision only, the old canopies are replaced by the
# mapped trees, and the replica apply step hides OSM Marking.
HIDDEN_BASE = {'Brick', 'Cream', 'Sage', 'Roof', 'Canopy', 'CanopyGold', 'CanopyRust', 'Wood', 'HiddenTrunks',
               'Grass'}  # plateau_ground.apply gives OSM Grass the GroundGeometry/ParkGrass mesh

# Linear colours of the existing materials (upgrade_plateau.py palette and textured tints).
PALETTE = {
    'Trim': (.66, .67, .61), 'Iron': (.025, .035, .033), 'Glass': (.035, .075, .10), 'Wood': (.22, .12, .065),
    'DoorTeal': (.035, .15, .15), 'DoorBurgundy': (.22, .045, .035), 'Roof': (.065, .075, .075),
    'Zinc': (.36, .39, .38), 'ConcreteDark': (.19, .21, .20), 'Glow': (.72, .57, .31), 'Leaf': (.12, .24, .075),
    'Soil': (.075, .055, .035), 'White': (.82, .82, .72), 'Yellow': (.75, .56, .12), 'Rubber': (.018, .021, .020),
    'Chrome': (.42, .45, .46), 'CarBlue': (.035, .12, .20), 'CarRed': (.31, .055, .045),
    'CarSilver': (.43, .46, .45), 'CarOlive': (.16, .20, .12), 'Tail': (.55, .015, .008),
    'SignGreen': (.035, .16, .12), 'SignBlue': (.025, .10, .22), 'SignRed': (.48, .025, .018),
    'CarGlass': (.025, .05, .065), 'InteriorDark': (.012, .018, .022), 'InteriorWarm': (.16, .105, .055),
    'CurtainIvory': (.48, .43, .33), 'CurtainSage': (.18, .24, .19), 'ConstructionOrange': (.75, .20, .015),
    # Park and landmark materials not in that palette: plausible values.
    'AutumnGold': (.50, .30, .04), 'AutumnRust': (.36, .09, .03), 'ParkEarth': (.20, .15, .09),
    'ParkWood': (.16, .09, .05), 'PondWater': (.02, .035, .03), 'Court': (.12, .20, .14), 'Water': (.02, .035, .03),
    'LeNeuvilleConcrete': (.45, .45, .43), 'LeNeuvilleGlass': (.04, .07, .09), 'LeNeuvilleMetal': (.30, .32, .33),
    'LeNeuvilleRail': (.05, .05, .05), 'SchoolFrame': (.30, .30, .28), 'SchoolGlass': (.04, .07, .09),
    'SchoolTrim': (.60, .55, .43), 'Marking': (.82, .82, .72),
}
TEXTURED = {  # name: (tint, texture, tiles per metre or 'world' metres)
    'BrickRed': ((1.05, .80, .66), 'brick_wall_001', 1.5), 'BrickBrown': ((.68, .63, .53), 'brick_wall_001', 1.5),
    'BrickOchre': ((1.25, 1.13, .83), 'brick_wall_001', 1.5), 'Limestone': ((1.04, 1.02, .94), 'concrete_pavement', 1),
    'Concrete': ((.90, .94, .91), 'concrete_pavement', 1), 'Asphalt': ((.82, .87, .89), 'asphalt_02', 'world2'),
    'Road': ((.82, .87, .89), 'asphalt_02', 'world2'), 'Gravel': ((.58, .55, .47), 'concrete_pavement', 'world4'),
    'YardGround': ((.58, .55, .47), 'concrete_pavement', 'world4'), 'Path': ((1, 1, 1), 'concrete_pavement', 'world4'),
    'ParkGrass': ((.42, .65, .29), 'grass_ground', 'world4'), 'Grass': ((.42, .65, .29), 'grass_ground', 'world4'),
    'BrickBackground': ((1., .9, .8), 'brick_wall_001', 2.25), 'CreamBackground': ((1.5, 1.45, 1.2), 'brick_wall_001', 2.25),
    'SageBackground': ((.65, .9, .75), 'brick_wall_001', 2.25), 'PerimeterStone': ((.83, .88, .83), 'concrete_pavement', 1),
}
# Mean linear colour of each texture, as apply_plateau_replica.TEXTURE_MEAN.
TEXTURE_MEAN = {'asphalt_02': (.1162, .1143, .1020), 'concrete_pavement': (.2170, .1790, .1372),
                'brick_wall_001': (.1402, .0776, .0516), 'grass_ground': (.1593, .1198, .0498)}
TINT_LIMIT = 8.  # apply_plateau_replica.TINT_LIMIT
TEXTURES = os.path.join(REPLICA, 'Textures')  # Scripts/plateau_textures.py: every replica texture set
GREEN_TINT, GOLD_TINT = (.85, 1.35, .75), (1.8, 1.2, .5)
TILE = re.compile(r'_X[MP]\d+_Y[MP]\d+(_P\d+)?$')


def srgb_to_linear(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


# ------------------------------------------------------------------------------------------------
# Views. Positions are game-frame cm (x east, y north); z is the walking surface under the camera.

def load_streets():
    path = os.path.join(CACHE, 'streets.json')
    if os.path.exists(path):
        return json.load(open(path))
    import xml.etree.ElementTree as ET
    sys.path.insert(0, os.path.join(ROOT, 'Scripts'))
    from prepare_lafontaine import xy, tags
    root = ET.parse(os.path.join(ROOT, 'Data', 'LaFontaine', 'osm.xml')).getroot()
    nodes = {n.get('id'): xy(float(n.get('lat')), float(n.get('lon'))) for n in root.findall('node')}
    out = {}
    for w in root.findall('way'):
        t = tags(w)
        if 'highway' not in t:
            continue
        pts = [[round(c, 1) for c in nodes[n.get('ref')]] for n in w.findall('nd')]
        if t.get('service') == 'alley':
            out.setdefault('__alley__' + w.get('id'), []).append(pts)
        elif t.get('name') and t['highway'] not in ('footway', 'cycleway', 'path', 'steps'):
            out.setdefault(t['name'], []).append(pts)
    os.makedirs(CACHE, exist_ok=True)
    json.dump(out, open(path, 'w'))
    return out


def along(pts, distance):
    """Point and unit direction at a distance (cm) along a polyline."""
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b)
        if distance <= seg or b is pts[-1]:
            t = min(1., distance / seg) if seg else 0.
            d = ((b[0] - a[0]) / seg, (b[1] - a[1]) / seg)
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), d
        distance -= seg


def project(pts, p):
    """Distance along a polyline of the point nearest to p."""
    best, acc = (1e18, 0.), 0.
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b) or 1.
        t = max(0., min(1., ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / seg ** 2))
        q = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        if math.dist(q, p) < best[0]:
            best = (math.dist(q, p), acc + t * seg)
        acc += seg
    return best[1]


def street_view(way, distance, offset, surface, look_ahead=6000., yaw_deg=0., pitch_target=300., reverse=False):
    """Camera on a line parallel to a street. offset > 0 is to the left of the way direction in the
    game frame (x east, y north); reverse looks against the way direction."""
    (px, py), (dx, dy) = along(way, distance)
    if reverse:
        dx, dy = -dx, -dy
        offset = -offset
    nx, ny = -dy, dx
    cam = (px + nx * offset, py + ny * offset, surface + 170.)
    a = math.radians(yaw_deg)
    fx, fy = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
    target = (cam[0] + fx * look_ahead, cam[1] + fy * look_ahead, pitch_target)
    return cam, target


def views():
    s = load_streets()
    v = {}
    mentana = [w for w in s['Rue de Mentana'] if -43000 < w[0][0] < -42000 and len(w) > 20][0]
    # 2 m further along than the last sets: the inventory puts a young elm in a sidewalk pit 1.4 m ahead of the old
    # spot, which filled the middle of the frame with its trunk; from here the nearest pit tree is 6 m ahead.
    v['mentana'] = dict(title='Rue de Mentana, plex street west of the park, from the shady sidewalk',
                        camera=street_view(mentana, 5400, -690, 18., look_ahead=6000, yaw_deg=13, pitch_target=430),
                        far=17000)
    fabre = [w for w in s['Rue Fabre'] if len(w) == 7][0]
    v['fabre'] = dict(title='Rue Fabre north of Rachel, with the chantier', far=17000,
                      camera=street_view(fabre, 4300, -640, 18., look_ahead=6000, yaw_deg=-5, pitch_target=430))
    rachel = [w for w in s['Rue Rachel Est'] if w[0][0] > -3000 and w[-1][0] < -16000 and w[-1][1] > 30000][0]
    rachel = rachel[::-1]  # south-west to north-east, (-16740, 31946) -> (-2105, 53497)
    v['rachel'] = dict(title='Rue Rachel at the park edge, cycle track and VC-BA-1 bollards', far=17000,
                       camera=street_view(rachel, 9200, -880, 18., look_ahead=6000, yaw_deg=7, pitch_target=330))
    papineau = [w for w in s['Avenue Papineau'] if w[0] == [3184.0, 61704.0] or (abs(w[0][0] - 3184) < 2 and abs(w[-1][0] - 19503) < 2)]
    pap = papineau[0] if papineau else max(s['Avenue Papineau'], key=len)
    v['papineau'] = dict(title='Avenue Papineau, facing the park', far=16000,
                         camera=street_view(pap, 7600, 1180, 18., look_ahead=6000, yaw_deg=-38, pitch_target=420))
    # The ARRÊT at Mentana / Napoléon (Furniture placement, yaw 57: it faces traffic heading 237°).
    jx, jy = -13764.6, -20233.5  # Mentana / Napoléon junction (OSM node)
    f = (math.cos(math.radians(57)), math.sin(math.radians(57)))
    r = (-f[1], f[0])  # from the Napoléon centreline toward the ARRÊT side, game frame
    v['corner'] = dict(title='Rue Napoléon at Rue de Mentana: ARRÊT, crosswalk, street-name signs', far=12000,
                       camera=((jx + 2900 * f[0] - 120 * r[0], jy + 2900 * f[1] - 120 * r[1], 177.),
                               (jx + 900 * f[0] + 700 * r[0], jy + 900 * f[1] + 700 * r[1], 210.)), fov=70)
    alley = s['__alley__21062511'][0]
    d = project(alley, (-18860., 37542.))
    v['ruelle'] = dict(title='Ruelle behind Rachel with laundry lines and wooden utility poles', far=9000,
                       sun=(228., 24.), exposure=.35,
                       camera=street_view(alley, d - 1500, 90, 6.8, look_ahead=6000, yaw_deg=-4, pitch_target=650))
    # The ruelle between Mentana and Saint-André (OSM way 204859680), where the Plex yard side is built:
    # galleries, straight and spiral stairs, fences with gates, sheds, and a pulley line with washing 13 m ahead on
    # the left, rising over the fences to its pole (test_plateau_replica.check_laundry_view). The lots within 15 m of
    # the old spot, 32 m back along the lane, had no line: yards too short for one, no gallery, or none drawn.
    lane = s['__alley__204859680'][0]
    v['ruelle_mentana'] = dict(title='Ruelle between Mentana and Saint-André: galleries, stairs, fences, laundry',
                               far=9000, exposure=.8,
                               camera=street_view(lane, 39500, 60, 6.8, look_ahead=6000, yaw_deg=0, pitch_target=650))
    # Mentana between Rachel and Duluth, seen from above the sunlit side, about 60 m up.
    (tx, ty), (dx, dy) = along(mentana, 12000)
    a = math.atan2(-0.838, -0.545) + math.radians(28)
    cx, cy = tx + 9500 * math.cos(a), ty + 9500 * math.sin(a)
    v['aerial'] = dict(title='High three-quarter view over two plex blocks on Mentana', far=26000,
                       camera=((cx, cy, 6000.), (tx, ty, 0.)), fov=62, circle=(tx, ty, 19000))
    fronts = plex_fronts()
    if GALLERY_LOT in fronts:
        v['gallery_closeup'] = dict(title='A yard behind Rue de Mentana: a three-storey gallery stack with chairs, '
                                          'plants and barbecues, laundry lines to the poles at the back fence',
                                    far=9000, exposure=.8, camera=gallery_camera(fronts[GALLERY_LOT]))
    if HLM_LOT in fronts:
        v['hlm_mentana'] = dict(title='Habitations De Mentana (OMHM, 1974) from the far sidewalk of Rue de Mentana',
                                far=17000, camera=hlm_camera(fronts[HLM_LOT]))
    return v


# The two close views of the post-pass work: a gallery stack with lane life, and the OMHM block.
GALLERY_LOT = '356349231'  # Rue de Mentana, 4 storeys, two gallery modules, 23 gallery props and 6 laundry lines
HLM_LOT = '356220851'      # Habitations De Mentana (OSM way 356220851), the post-1945 apartment kit
FRONTS = {}


def plex_fronts():
    """Plex/fronts.json rows by lot id (the generator's own record of each lot's walls, decks and fence)."""
    if not FRONTS:
        path = os.path.join(REPLICA, 'Plex', 'fronts.json')
        if os.path.exists(path):
            FRONTS.update({f['id']: f for f in json.load(open(path))['fronts']})
    return FRONTS


def gallery_camera(front):
    """Eye height in the yard, 1.2 m in from the back fence and 3.5 m along it from the yard's middle, looking at
    the gallery stack 4.8 m up, 1.5 m out from the rear wall: the ground deck's chair and plants, the decks above
    behind their balusters, and the laundry lines running from the deck guards over the yard to the fence poles."""
    rear = front['rear']
    wall = max((w for w in rear['walls'] if w['kind'] == 'rear'), key=lambda w: w.get('galleries', 0))
    (ax, ay), (bx, by) = wall['a'], wall['b']
    n = math.hypot(bx - ax, by - ay)
    along = ((bx - ax) / n, (by - ay) / n)
    out = rear['decks'][0]['out']
    mx, my = (ax + bx) / 2, (ay + by) / 2
    depth = rear['fence']['distance_cm'] - 120.
    cam = (mx + out[0] * depth - along[0] * 350., my + out[1] * depth - along[1] * 350., 175.)
    target = (mx + out[0] * 150. + along[0] * 150., my + out[1] * 150. + along[1] * 150., 480.)
    return cam, target


def hlm_camera(front):
    """The far sidewalk of Mentana (the centreline runs 10.3 m out from the block's front, the far fronts 19.3 m), 16.6 m
    out and 16 m along the street, at eye height over the 18 cm sidewalk, looking at the front's middle 11 m up: the
    Mentana end wall, the entrance and one long wall of stacked balconies."""
    (ax, ay), (bx, by) = front['front']['a'], front['front']['b']
    n = math.hypot(bx - ax, by - ay)
    along = ((bx - ax) / n, (by - ay) / n)
    mx, my = (ax + bx) / 2, (ay + by) / 2
    # The street side: away from the block's other walls.
    walls = [p for w in front['rear']['walls'] for p in (w['a'], w['b'])]
    gx, gy = sum(p[0] for p in walls) / len(walls), sum(p[1] for p in walls) / len(walls)
    normal = (-along[1], along[0])
    if (gx - mx) * normal[0] + (gy - my) * normal[1] > 0:
        normal = (-normal[0], -normal[1])
    cam = (mx + normal[0] * 1660. + along[0] * 1600., my + normal[1] * 1660. + along[1] * 1600., 188.)
    target = (mx - normal[0] * 300., my - normal[1] * 300., 1100.)
    return cam, target


# ------------------------------------------------------------------------------------------------
# Loading

def _segment_distance(px, py, a, b):
    """Distance from (px, py) to the segment a-b (2D)."""
    ex, ey = b[0] - a[0], b[1] - a[1]
    n = ex * ex + ey * ey
    t = 0. if n == 0. else max(0., min(1., ((px - a[0]) * ex + (py - a[1]) * ey) / n))
    return math.hypot(a[0] + ex * t - px, a[1] + ey * t - py)


def _inside(px, py, pts):
    """Even-odd test: is (px, py) inside the polygon pts (2D)?"""
    inside = False
    for k in range(len(pts)):
        (x0, y0), (x1, y1) = pts[k - 1], pts[k]
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            inside = not inside
    return inside


class Region:
    """What a view loads, in the game frame (x east, y north): a disc of radius `near` around the camera plus a
    wedge (the field of view widened by 22 degrees a side) out to `far`; or, with `circle` (x, y, r), a disc."""

    def __init__(self, cam, target, fov, far, circle=None):
        self.cx, self.cy = cam[0], cam[1]
        d = (target[0] - cam[0], target[1] - cam[1])
        n = math.hypot(*d) or 1.
        self.dx, self.dy = d[0] / n, d[1] / n
        half = math.radians(min(89., fov / 2 + 22.))
        self.cos = math.cos(half)
        self.far, self.near = far, 4500.
        self.circle = circle
        # The wedge (under 90 degrees a side) is the meet of two half-planes through the camera, each bounded by an
        # edge ray of the wedge: (nx, ny) . (p - camera) >= 0 on the inner side.
        c, s = math.cos(half), math.sin(half)
        b1 = (self.dx * c - self.dy * s, self.dx * s + self.dy * c)
        b2 = (self.dx * c + self.dy * s, -self.dx * s + self.dy * c)
        self.normals = ((b1[1], -b1[0]), (-b2[1], b2[0]))

    def keep(self, x, y):
        if self.circle:
            return math.hypot(x - self.circle[0], y - self.circle[1]) < self.circle[2]
        ex, ey = x - self.cx, y - self.cy
        d = math.hypot(ex, ey)
        if d < self.near:
            return True
        return d < self.far and (ex * self.dx + ey * self.dy) > self.cos * d

    def crosses(self, pts):
        """Does the polygon pts [(x, y), ...] reach the region though none of its corners is kept? True when the
        polygon holds the camera (or the circle's centre), or an edge crosses the near disc, the circle, or the wedge
        inside the far distance: a 188 m lane quad with its corners behind the camera and past `far` is kept."""
        if self.circle:
            cx, cy, r = self.circle
        else:
            cx, cy, r = self.cx, self.cy, max(self.far, self.near)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        if math.hypot(min(max(cx, x0), x1) - cx, min(max(cy, y0), y1) - cy) >= r:
            return False
        if x0 <= cx <= x1 and y0 <= cy <= y1 and _inside(cx, cy, pts):
            return True
        edges = [(pts[k - 1], pts[k]) for k in range(len(pts))]
        if self.circle:
            return any(_segment_distance(cx, cy, a, b) < r for a, b in edges)
        if any(_segment_distance(cx, cy, a, b) < self.near for a, b in edges):
            return True
        for a, b in edges:
            # Clip the edge to the two half-planes of the wedge, then ask whether what is left comes within far.
            t0, t1 = 0., 1.
            for nx, ny in self.normals:
                fa = (a[0] - cx) * nx + (a[1] - cy) * ny
                fb = (b[0] - cx) * nx + (b[1] - cy) * ny
                if fa < 0. and fb < 0.:
                    t0 = 2.
                    break
                if fa < 0.:
                    t0 = max(t0, fa / (fa - fb))
                elif fb < 0.:
                    t1 = min(t1, fa / (fa - fb))
            if t0 > t1:
                continue
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            if _segment_distance(cx, cy, p0, p1) < self.far:
                return True
        return False

    def face(self, pts):
        """Does the polygon pts [(x, y), ...] reach the region (a corner kept, or crosses)?"""
        return any(self.keep(x, y) for x, y in pts) or self.crosses(pts)

    def box(self, b):
        """Could an OBJ with game-frame bounds b = [x0, y0, z0, x1, y1, z1] hold faces the region keeps?"""
        return self.face([(b[0], b[1]), (b[3], b[1]), (b[3], b[4]), (b[0], b[4])])


def read_obj(path, region, scale=.01, want_uv=True):
    """Faces of an OBJ that reach the region (None keeps all): a corner kept, an edge crossing the region, or the
    face holding the camera (Region.crosses), so long quads that span the view keep their faces."""
    vs, vts, faces = [], [], []
    with open(path, 'r') as fh:
        for line in fh:
            c = line[:2]
            if c == 'v ':
                p = line.split()
                vs.append((float(p[1]), float(p[2]), float(p[3])))
            elif c == 'vt' and want_uv:
                p = line.split()
                vts.append((float(p[1]), float(p[2])))
            elif c == 'f ':
                faces.append(line.split()[1:])
    keep = [True] * len(vs) if region is None else [region.keep(x, -y) for x, y, z in vs]
    remap, verts, polys, uvs = {}, [], [], []
    for f in faces:
        idx = []
        tex = []
        for token in f:
            parts = token.split('/')
            i = int(parts[0])
            idx.append(i - 1 if i > 0 else len(vs) + i)
            if want_uv and len(parts) > 1 and parts[1]:
                t = int(parts[1])
                tex.append(t - 1 if t > 0 else len(vts) + t)
        if not any(keep[i] for i in idx) and not region.crosses([(vs[i][0], -vs[i][1]) for i in idx]):
            continue
        poly = []
        for i in idx:
            j = remap.get(i)
            if j is None:
                j = remap[i] = len(verts)
                x, y, z = vs[i]
                verts.append((x * scale, y * scale, z * scale))
            poly.append(j)
        polys.append(poly)
        if want_uv:
            uvs.extend(vts[t] for t in tex) if len(tex) == len(idx) else uvs.extend([(0., 0.)] * len(idx))
    return verts, polys, uvs


def make_object(name, verts, polys, uvs, material, collection, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], polys)
    if uvs and len(uvs) == sum(len(p) for p in polys):
        layer = me.uv_layers.new(name='UVMap')
        flat = [c for uv in uvs for c in uv]
        layer.data.foreach_set('uv', flat)
    me.update()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(material)
    collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------------------------------------
# Materials

MATS = {}


def sock(sockets, name, kind='RGBA'):
    return [x for x in sockets if x.name == name and x.type == kind][0]


def image(name, folder=ART):
    key = 'IMG_' + name
    if key not in bpy.data.images:
        img = bpy.data.images.load(os.path.join(folder, name))
        img.name = key
        if 'nor' in name or 'rough' in name or 'alpha' in name or 'arm' in name:
            img.colorspace_settings.name = 'Non-Color'
    return bpy.data.images[key]


def material(name, color, rough=.8, metal=0., texture=None, tiling=1., tint_is_target=False, emission=None,
             emission_strength=0., transmission=0.):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if texture:
        tint = color
        if tint_is_target:
            mean = TEXTURE_MEAN[texture]
            tint = tuple(min(TINT_LIMIT, c / mm) for c, mm in zip(color, mean))
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = image(texture + '_diff.jpg')
        nor = nt.nodes.new('ShaderNodeTexImage')
        nor.image = image(texture + '_nor_dx.jpg')
        mapping = nt.nodes.new('ShaderNodeMapping')
        coord = nt.nodes.new('ShaderNodeTexCoord')
        if isinstance(tiling, str):  # world-space planar mapping, metres per tile
            metres = float(tiling[5:])
            nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
            mapping.inputs['Scale'].default_value = (1 / metres, 1 / metres, 1 / metres)
            tex.projection = nor.projection = 'BOX'
            tex.projection_blend = nor.projection_blend = .3
        else:
            nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
            mapping.inputs['Scale'].default_value = (tiling, tiling, 1)
        nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        nt.links.new(mapping.outputs['Vector'], nor.inputs['Vector'])
        mul = nt.nodes.new('ShaderNodeMix')
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        sock(mul.inputs, 'Factor', 'VALUE').default_value = 1.
        nt.links.new(tex.outputs['Color'], sock(mul.inputs, 'A'))
        sock(mul.inputs, 'B').default_value = (*tint, 1)
        nt.links.new(sock(mul.outputs, 'Result'), bsdf.inputs['Base Color'])
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = .6
        nt.links.new(nor.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    if transmission:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    MATS[name] = m
    return m


def existing_material(layer, base):
    """Material for an existing Data/Plateau OBJ, named by its batch prefix."""
    name = base.removesuffix('_Collision')
    if layer == 'BackgroundGeometry' and name in ('Brick', 'Cream', 'Sage'):
        name = name + 'Background'
    if layer == 'LandmarkVisualGeometry':
        name = name.replace('LandmarkContext_', '')
        if name in ('Sage', 'Cream', 'Brick'):
            name += 'Background'
    if name in TEXTURED:
        tint, tex, tiling = TEXTURED[name]
        return material('E_' + name, tint, .85, 0., tex, tiling)
    color = PALETTE.get(name, (.3, .3, .3))
    rough = .12 if 'Glass' in name else .25 if name in ('PondWater', 'Water') else .8
    metal = .55 if name in ('Chrome', 'Zinc') or name.startswith('Car') and name != 'CarGlass' else 0.
    emission = color if name in ('Glow', 'Tail', 'InteriorWarm') else None
    return material('E_' + name, color, rough, metal, emission=emission, emission_strength=.4 if emission else 0.)


TEXTURE_INDEX = {}
MASKED = {}  # material name -> (diff image, (u tiling, v tiling), clip): what --probe needs to see through cards


def texture_sets():
    """The apply step's texture sets (apply_plateau_replica.load_textures): textures.json and the Trees manifest's
    bark and leaf atlas, each entry with the folder its maps are in ('directory')."""
    if not TEXTURE_INDEX:
        TEXTURE_INDEX.update(load_textures(ROOT))
    return TEXTURE_INDEX


def macro_factor(nt, coord, macro):
    """The apply step's macro variation (apply_plateau_replica.add_macro) as a grey factor: lerp(1 - s, 1 + s,
    mask channel) at each macro tile (17.3 m on R, 5.3 m on G), multiplied together, on the raw metre UVs."""
    mask = image(os.path.basename(macro['texture']) + '.png', TEXTURES)
    mask.colorspace_settings.name = 'Non-Color'
    factor = None
    for tiling, strength, channel in zip(macro['tiling'], macro['strength'], macro['channels']):
        mapping = nt.nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (tiling[0], tiling[1], 1)
        nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
        sample = nt.nodes.new('ShaderNodeTexImage')
        sample.image = mask
        nt.links.new(mapping.outputs['Vector'], sample.inputs['Vector'])
        split = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(sample.outputs['Color'], split.inputs['Color'])
        lerp = nt.nodes.new('ShaderNodeMath')  # (1 - s) + 2 s x mask = lerp(1 - s, 1 + s, mask)
        lerp.operation = 'MULTIPLY_ADD'
        nt.links.new(split.outputs[{'R': 'Red', 'G': 'Green', 'B': 'Blue'}[channel]], lerp.inputs[0])
        lerp.inputs[1].default_value = 2. * strength
        lerp.inputs[2].default_value = 1. - strength
        if factor is None:
            factor = lerp.outputs['Value']
        else:
            both = nt.nodes.new('ShaderNodeMath')
            both.operation = 'MULTIPLY'
            nt.links.new(factor, both.inputs[0])
            nt.links.new(lerp.outputs['Value'], both.inputs[1])
            factor = both.outputs['Value']
    return factor


def address_vector(nt, vector, address, size_px):
    """The texture lookup for a set's address modes (apply_plateau_replica.address_modes), as (image extension, UV
    socket). Tiling sets wrap both axes (REPEAT on the tiled UVs). An atlas clamps both (EXTEND: the laundry and leaf
    cells never pull in the opposite edge). A card wraps U and clamps V (TA_WRAP, TA_CLAMP): Blender has one extension
    for both axes, so V is clamped to the centres of the first and last texel rows before a REPEAT lookup, which is
    what a clamped V samples, and the top of a fence, grass or flower card never blends in the bottom row's texels."""
    if address == ('TA_WRAP', 'TA_WRAP'):
        return 'REPEAT', vector
    if address == ('TA_CLAMP', 'TA_CLAMP'):
        return 'EXTEND', vector
    assert address == ('TA_WRAP', 'TA_CLAMP'), address
    half = .5 / size_px[1]
    split = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(vector, split.inputs['Vector'])
    clamp = nt.nodes.new('ShaderNodeClamp')
    clamp.inputs['Min'].default_value = half
    clamp.inputs['Max'].default_value = 1. - half
    nt.links.new(split.outputs['Y'], clamp.inputs['Value'])
    join = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(split.outputs['X'], join.inputs['X'])
    nt.links.new(clamp.outputs['Result'], join.inputs['Y'])
    nt.links.new(split.outputs['Z'], join.inputs['Z'])
    return 'REPEAT', join.outputs['Vector']


def replica_set_material(name, row):
    """A replica texture-set key as the apply step builds it (apply_plateau_replica.textured_graph), from its plan
    row (material_row): the maps of the set (Textures/, or Trees/ for the bark and leaf atlas), the row's UV tiling
    (1 / tile_m on metre UVs; 1 / tile_u by 1 on card UVs; 1 on the leaf atlas), base colour = diff x the row's tint
    (colour / mean_linear capped at TINT_LIMIT, white for a set that owns its colour) x the macro variation, normal
    from the DirectX-convention map, roughness from the R of the rough map and the row's metallic (the manifest's,
    capped at the set's). A masked set (the cut-out cards, the creeper, the tree leaves) keeps only the texels whose
    diffuse alpha reaches its opacity_mask_clip and shows both faces; a two-sided foliage set also transmits base
    colour x FOLIAGE_SUBSURFACE, as the foliage parent's SubsurfaceColor."""
    if name in MATS:
        return MATS[name]
    entry = texture_sets()[row['texture_set']]
    folder = os.path.join(REPLICA, entry.get('directory', 'Textures'))
    masked = row.get('blend_mode') == 'masked'
    foliage = row.get('shading_model') == 'two_sided_foliage'
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    out = [x for x in nt.nodes if x.type == 'OUTPUT_MATERIAL'][0]
    bsdf.inputs['Metallic'].default_value = float(row.get('metallic', 0.))
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (row['tiling'][0], row['tiling'][1], 1)
    nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
    address = address_modes(entry)
    extension, vector = address_vector(nt, mapping.outputs['Vector'], address, entry['size_px'])
    tex = {}
    for role in ('diff', 'nor_dx', 'rough'):
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = image(entry['maps'][role]['file'], folder)
        node.image.colorspace_settings.name = 'sRGB' if entry['maps'][role]['srgb'] else 'Non-Color'
        if role == 'diff' and entry.get('alpha'):
            # Colour and mask are independent channels: the colour under a hole is the surface's own, so
            # nothing is premultiplied or darkened at the clip edge (Textures/README.md).
            node.image.alpha_mode = 'CHANNEL_PACKED'
        node.extension = extension
        nt.links.new(vector, node.inputs['Vector'])
        tex[role] = node
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    sock(mul.inputs, 'Factor', 'VALUE').default_value = 1.
    nt.links.new(tex['diff'].outputs['Color'], sock(mul.inputs, 'A'))
    sock(mul.inputs, 'B').default_value = (*row['tint'], 1)
    base = sock(mul.outputs, 'Result')
    if row.get('macro'):
        vary = nt.nodes.new('ShaderNodeMix')
        vary.data_type = 'RGBA'
        vary.blend_type = 'MULTIPLY'
        sock(vary.inputs, 'Factor', 'VALUE').default_value = 1.
        nt.links.new(base, sock(vary.inputs, 'A'))
        nt.links.new(macro_factor(nt, coord, row['macro']), sock(vary.inputs, 'B'))
        base = sock(vary.outputs, 'Result')
    nt.links.new(base, bsdf.inputs['Base Color'])
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nmap.convention = 'DIRECTX'  # Blender 5.1: green points down, as Unreal reads these maps
    nmap.inputs['Strength'].default_value = 1.
    nt.links.new(tex['nor_dx'].outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    rough = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tex['rough'].outputs['Color'], rough.inputs['Color'])
    nt.links.new(rough.outputs['Red'], bsdf.inputs['Roughness'])
    shader = bsdf.outputs['BSDF']
    if foliage:
        transmit = nt.nodes.new('ShaderNodeMix')
        transmit.data_type = 'RGBA'
        transmit.blend_type = 'MULTIPLY'
        sock(transmit.inputs, 'Factor', 'VALUE').default_value = 1.
        nt.links.new(base, sock(transmit.inputs, 'A'))
        sock(transmit.inputs, 'B').default_value = (FOLIAGE_SUBSURFACE,) * 3 + (1,)
        translucent = nt.nodes.new('ShaderNodeBsdfTranslucent')
        nt.links.new(sock(transmit.outputs, 'Result'), translucent.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], translucent.inputs['Normal'])
        add = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(shader, add.inputs[0])
        nt.links.new(translucent.outputs['BSDF'], add.inputs[1])
        shader = add.outputs['Shader']
    if masked:
        clip = float(row.get('opacity_mask_clip') or .5)
        keep = nt.nodes.new('ShaderNodeMath')  # Unreal keeps a texel when its mask is at or over the clip
        keep.operation = 'GREATER_THAN'
        keep.inputs[1].default_value = clip - 1 / 1024
        nt.links.new(tex['diff'].outputs['Alpha'], keep.inputs[0])
        clear = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(keep.outputs['Value'], mix.inputs['Fac'])
        nt.links.new(clear.outputs['BSDF'], mix.inputs[1])
        nt.links.new(shader, mix.inputs[2])
        shader = mix.outputs['Shader']
        MASKED[name] = (tex['diff'].image, tuple(row['tiling']), clip, address)
    nt.links.new(shader, out.inputs['Surface'])
    MATS[name] = m
    return m


def replica_material(layer, key, spec):
    color = srgb_to_linear(spec['base_color_srgb'])
    # The apply step's own plan row decides which keys take a replica texture set (Stone, Slate, the shared keys,
    # Brick_Buff_Even, the tree bark and leaves) and with what tint, macro variation and metallic.
    row = material_row(layer, key, spec, texture_sets(), set())
    if row.get('texture_set'):
        return replica_set_material(f'R_{layer}_{key}', row)
    texture = spec.get('texture') or ''
    tex = None
    tiling = 1.
    # As apply_plateau_replica.base_material: asphalt and brick keep their Poly Haven parent texture.
    if 'asphalt' in texture:
        tex, tiling = 'asphalt_02', 'world2'
    elif 'brick' in texture:
        tex, tiling = 'brick_wall_001', 1.5
    emission = srgb_to_linear(spec['emissive_srgb']) if spec.get('emissive_srgb') else None
    # Unreal emissive strength against a daylight exposure is faint; keep the lenses visible, not blown out.
    strength = spec.get('emissive_strength', 0.) * .08 if emission else 0.
    return material(f'R_{layer}_{key}', color, spec.get('roughness', .8), spec.get('metallic', 0.), tex, tiling,
                    tint_is_target=bool(tex), emission=emission, emission_strength=strength)


# ------------------------------------------------------------------------------------------------
# Scene

def index():
    path = os.path.join(CACHE, 'index.json')
    idx = json.load(open(path)) if os.path.exists(path) else {}
    # Forget OBJs a generator has since removed, so no view tries to read one.
    gone = [rel for rel in idx if not rel.startswith('__') and not os.path.exists(os.path.join(ROOT, rel))]
    for rel in gone:
        del idx[rel]
    changed = bool(gone)
    for dirpath, _, names in os.walk(DATA):
        if '/ReplicaGeometry/Props' in dirpath or '/ReplicaGeometry/Trees' in dirpath:
            continue
        for n in names:
            if not n.endswith('.obj'):
                continue
            f = os.path.join(dirpath, n)
            rel = os.path.relpath(f, ROOT)
            st = os.stat(f)
            row = idx.get(rel)
            if row and row['mtime'] == st.st_mtime and row['size'] == st.st_size:
                continue
            b = [1e18, 1e18, 1e18, -1e18, -1e18, -1e18]
            with open(f, 'rb') as fh:
                for line in fh:
                    if line[:2] == b'v ':
                        p = line.split()
                        x, y, z = float(p[1]), -float(p[2]), float(p[3])
                        b = [min(b[0], x), min(b[1], y), min(b[2], z), max(b[3], x), max(b[4], y), max(b[5], z)]
            idx[rel] = {'mtime': st.st_mtime, 'size': st.st_size, 'b': b}
            changed = True
    # Tree positions are never cached here: an earlier index kept the 4,571 OSM positions after Streets moved the
    # trees into the inventory's sidewalk pits, so the old summer trees stood where no tree is any more.
    if idx.pop('__trees__', None) is not None:
        changed = True
    if changed:
        os.makedirs(CACHE, exist_ok=True)
        json.dump(idx, open(path, 'w'))
    return idx


def load_existing(idx, region, col, before):
    count = 0
    for rel, row in sorted(idx.items()):
        if rel.startswith('__') or '/ReplicaGeometry/' in rel:
            continue
        parts = rel.split('/')
        layer = parts[2]
        base = TILE.sub('', os.path.basename(rel)[:-4])
        if layer == 'BaseGeometry' and (base in HIDDEN_BASE or (base == 'Marking' and not before)):
            continue
        if layer == 'EastDetails':
            layer = 'EastDetails'
        if not region.box(row['b']):
            continue
        verts, polys, uvs = read_obj(os.path.join(ROOT, rel), region)
        if polys:
            make_object(f'{layer}_{os.path.basename(rel)[:-4]}', verts, polys, uvs, existing_material(layer, base), col)
            count += len(polys)
    return count


def drawn(batch):
    """Is a layer batch visible in game? Collision_Only batches (the gallery guards' invisible walls) are spawned
    hidden in game by the apply step, so the preview never draws them."""
    return batch['material'] != COLLISION_ONLY


def load_replica(region, col, layers=('Streets', 'Plex', 'Soul'), dirs=None):
    count = 0
    for layer in layers:
        folder = (dirs or {}).get(layer) or os.path.join(REPLICA, layer)
        man = json.load(open(os.path.join(folder, 'manifest.json')))
        for batch in man['batches']:
            b = batch['bounds_cm']
            if not drawn(batch) or not region.box(b):
                continue
            verts, polys, uvs = read_obj(os.path.join(folder, batch['file']), region)
            if polys:
                mat = replica_material(layer, batch['material'], man['materials'][batch['material']])
                make_object(f'{layer}_{batch["file"][:-4]}', verts, polys, uvs, mat, col)
                count += len(polys)
    return count


def prop_variants(parts, seed):
    """The material of each part for a placement's variant_seed, as the apply step picks it (plan: options =
    [material] + variants, options[seed % len(options)])."""
    out = []
    for batch in parts:
        options = [batch['material']] + list(batch.get('variants', []))
        out.append(options[seed % len(options)])
    return tuple(out)


def prop_collections(rows):
    """One collection per prop and colour variant the rows use: the prop's parts (not the merged dog meshes), each in
    the variant material its rows' seeds pick. Returns ({(prop, variants): collection}, the Props manifest)."""
    man = json.load(open(os.path.join(REPLICA, 'Props', 'manifest.json')))
    parts = {}
    for batch in man['batches']:
        if batch.get('prop') and 'merged' not in batch.get('part', ''):
            parts.setdefault(batch['prop'], []).append(batch)
    meshes, out = {}, {}
    for r in rows:
        key = r['prop']
        if key not in parts:
            continue
        variants = prop_variants(parts[key], r.get('variant_seed', 0))
        if (key, variants) in out:
            continue
        c = out[key, variants] = bpy.data.collections.new(f'P_{key}_{len(out)}')
        for batch, variant in zip(parts[key], variants):
            if batch['file'] not in meshes:
                meshes[batch['file']] = read_obj(os.path.join(REPLICA, 'Props', batch['file']), None, want_uv=False)
            verts, polys, _ = meshes[batch['file']]
            mat = replica_material('Props', variant, man['materials'][variant])
            make_object(f'P_{batch["file"][:-4]}_{variant}', verts, polys, [], mat, c)
    return out, man


def place_props(rows, region, col):
    rows = [r for r in rows if region.keep(r['position'][0], r['position'][1])]
    colls, man = prop_collections(rows)
    parts = {}
    for batch in man['batches']:
        if batch.get('prop') and 'merged' not in batch.get('part', ''):
            parts.setdefault(batch['prop'], []).append(batch)
    for i, r in enumerate(rows):
        c = colls.get((r['prop'], prop_variants(parts.get(r['prop'], []), r.get('variant_seed', 0))))
        if not c:
            continue
        e = bpy.data.objects.new(f'I_{r["prop"]}_{i}', None)
        e.instance_type = 'COLLECTION'
        e.instance_collection = c
        x, y, z = r['position']
        e.location = (x / 100, -y / 100, z / 100)
        e.rotation_euler = (0, 0, -math.radians(r['yaw']))
        s = r.get('scale', 1.)
        e.scale = (s, s, s)
        col.objects.link(e)
    return rows, man


def street_name_text(rows, man, col):
    """The apply step's TextRender rows, as flat Blender text in the same slots."""
    slots = man['props']['sign_street']['text_slots']
    black = material('TextBlack', srgb_to_linear('#111111'), .6)
    n = 0
    for r in rows:
        if r['prop'] != 'sign_street':
            continue
        yaw = -math.radians(r['yaw'])
        rot = Matrix.Rotation(yaw, 4, 'Z')
        base = Matrix.Translation((r['position'][0] / 100, -r['position'][1] / 100, r['position'][2] / 100)) @ rot
        for blade in ('blade_a', 'blade_b'):
            names = r['text'].get(blade)
            if not names:
                continue
            for slot in slots[blade]:
                nrm = Vector((slot['face_normal'][0], -slot['face_normal'][1], slot['face_normal'][2]))
                right = Vector((slot['right'][0], -slot['right'][1], slot['right'][2]))
                up = Vector(slot['up'])
                for part, size in (('generic', 4.2), ('specific', 9.)):
                    text = names.get(part)
                    if not text:
                        continue
                    if part == 'specific':
                        size = min(size, slot[part]['size_cm'][0] / max(1, .62 * len(text)))
                    cx, cy, cz = slot[part]['center_cm']
                    centre = Vector((cx, -cy, cz)) + nrm * .3
                    curve = bpy.data.curves.new(f'T{n}', 'FONT')
                    curve.body = text
                    curve.align_x, curve.align_y = 'CENTER', 'CENTER'
                    curve.size = size / 100
                    ob = bpy.data.objects.new(f'T{n}', curve)
                    ob.data.materials.append(black)
                    m = Matrix((right, up, nrm)).transposed().to_4x4()
                    m.translation = centre / 100
                    ob.matrix_world = base @ m
                    col.objects.link(ob)
                    n += 1
    return n


TREE = {}


def tree_template():
    """The old summer tree (Poly Haven tree_small_02, 4.55 m tall) with the game's leaf material, loaded once per
    scene: what QuebecVegetation draws before the apply step (--before), or when no street_trees.json exists."""
    if 'coll' not in TREE:
        TREE['coll'], TREE['height'] = load_tree_template()
    return TREE['coll'], TREE['height']


def load_tree_template():
    path = os.path.join(CACHE, 'tree.blend')
    if not os.path.exists(path):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ART, 'tree_small_02', 'tree_small_02.gltf'))
        obs = [o for o in bpy.data.objects if o not in before]
        bpy.data.libraries.write(path, set(obs) | {o.data for o in obs if o.data}, fake_user=True)
        for o in obs:
            bpy.data.objects.remove(o)
    with bpy.data.libraries.load(path) as (src, dst):
        dst.objects = list(src.objects)
    obs = [o for o in dst.objects if o and o.type == 'MESH']
    coll = bpy.data.collections.new('TreeTemplate')
    for o in obs:
        coll.objects.link(o)
    height = max(o.dimensions.z for o in obs)
    # The game's leaf material: desaturate 35 %, per-instance lerp green to gold, lift, cutout at 1/3.
    for o in obs:
        for slot in o.material_slots:
            m = slot.material
            if not m or 'leaves' not in m.name:
                continue
            nt = m.node_tree
            for node in list(nt.nodes):
                if node.type not in ('OUTPUT_MATERIAL',):
                    nt.nodes.remove(node)
            out = [x for x in nt.nodes if x.type == 'OUTPUT_MATERIAL'][0]
            bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
            uv = nt.nodes.new('ShaderNodeUVMap')
            diff = nt.nodes.new('ShaderNodeTexImage')
            diff.image = bpy.data.images.load(os.path.join(ART, 'tree_small_02', 'textures', 'tree_small_02_leaves_diff_1k.jpg'))
            alpha = nt.nodes.new('ShaderNodeTexImage')
            alpha.image = bpy.data.images.load(os.path.join(ART, 'tree_small_02', 'textures', 'tree_small_02_leaves_alpha_1k.jpg'))
            alpha.image.colorspace_settings.name = 'Non-Color'
            for t in (diff, alpha):
                nt.links.new(uv.outputs['UV'], t.inputs['Vector'])
            hsv = nt.nodes.new('ShaderNodeHueSaturation')
            hsv.inputs['Saturation'].default_value = .65
            nt.links.new(diff.outputs['Color'], hsv.inputs['Color'])
            info = nt.nodes.new('ShaderNodeObjectInfo')
            lerp = nt.nodes.new('ShaderNodeMix')
            lerp.data_type = 'RGBA'
            sock(lerp.inputs, 'A').default_value = (*GREEN_TINT, 1)
            sock(lerp.inputs, 'B').default_value = (*GOLD_TINT, 1)
            nt.links.new(info.outputs['Random'], sock(lerp.inputs, 'Factor', 'VALUE'))
            mul = nt.nodes.new('ShaderNodeMix')
            mul.data_type = 'RGBA'
            mul.blend_type = 'MULTIPLY'
            sock(mul.inputs, 'Factor', 'VALUE').default_value = 1.
            nt.links.new(hsv.outputs['Color'], sock(mul.inputs, 'A'))
            nt.links.new(sock(lerp.outputs, 'Result'), sock(mul.inputs, 'B'))
            add = nt.nodes.new('ShaderNodeMix')
            add.data_type = 'RGBA'
            add.blend_type = 'ADD'
            sock(add.inputs, 'Factor', 'VALUE').default_value = 1.
            nt.links.new(sock(mul.outputs, 'Result'), sock(add.inputs, 'A'))
            sock(add.inputs, 'B').default_value = (.025, .035, .008, 1)
            nt.links.new(sock(add.outputs, 'Result'), bsdf.inputs['Base Color'])
            gt = nt.nodes.new('ShaderNodeMath')
            gt.operation = 'GREATER_THAN'
            gt.inputs[1].default_value = 1 / 3
            nt.links.new(alpha.outputs['Color'], gt.inputs[0])
            nt.links.new(gt.outputs['Value'], bsdf.inputs['Alpha'])
            bsdf.inputs['Roughness'].default_value = .6
            bsdf.inputs['Transmission Weight'].default_value = 0.
            bsdf.subsurface_method = 'RANDOM_WALK'
            nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return coll, height


def old_tree_positions():
    """Where QuebecVegetation puts the old summer tree before the apply step: plateau_rendering.tree_positions(), read
    fresh each time (the street_trees.json rows), never from a cache."""
    from plateau_rendering import tree_positions
    return tree_positions()


def place_trees(trees, region, col):
    """The old summer tree at (x, y, seed) points, scaled and turned by seed as plateau_rendering does."""
    coll, height = tree_template()
    n = 0
    for x, y, seed in trees:
        if not region.keep(x, y):
            continue
        e = bpy.data.objects.new(f'Tree_{seed}', None)
        e.instance_type = 'COLLECTION'
        e.instance_collection = coll
        s = (650 + seed % 500) / (height * 100)
        e.location = (x / 100, -y / 100, 0)
        e.rotation_euler = (0, 0, -math.radians(seed % 360))
        e.scale = (s, s, s)
        col.objects.link(e)
        n += 1
    return n


def read_obj_groups(path, scale=.01):
    """An OBJ split by usemtl: {name: (verts, polys, uvs, loop normals)}, in file coordinates, scaled to metres."""
    vs, vts, vns, groups, current = [], [], [], {}, None
    with open(path, 'r') as fh:
        for line in fh:
            tag = line[:2]
            if tag == 'v ':
                p = line.split()
                vs.append((float(p[1]) * scale, float(p[2]) * scale, float(p[3]) * scale))
            elif tag == 'vt':
                p = line.split()
                vts.append((float(p[1]), float(p[2])))
            elif tag == 'vn':
                p = line.split()
                vns.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('usemtl '):
                current = line.split()[1]
            elif tag == 'f ':
                groups.setdefault(current, []).append([[int(x) if x else 0 for x in (t.split('/') + ['', ''])[:3]]
                                                       for t in line.split()[1:]])
    out = {}
    for name, faces in groups.items():
        remap, verts, polys, uvs, normals = {}, [], [], [], []
        for f in faces:
            poly = []
            for v, t, n in f:
                i = v - 1 if v > 0 else len(vs) + v
                if i not in remap:
                    remap[i] = len(verts)
                    verts.append(vs[i])
                poly.append(remap[i])
                uvs.append(vts[t - 1] if t else (0., 0.))
                normals.append(vns[n - 1] if n else None)
            polys.append(poly)
        out[name] = (verts, polys, uvs, normals if all(normals) else None)
    return out


SPECIES = {}


def species_collection(species, kind, variant=None):
    """A species mesh of Trees/manifest.json (Scripts/blender/plateau_trees.py) as the apply step imports it: the
    kind's mature mesh, or its young street tree with variant 'young' (kind['young']['obj'], wearing the kind's
    materials). One object per usemtl slot, the slot named bark or leaves (apply_plateau_replica.tree_slot) taking that
    kind's material through the apply step's own material row (the textured bark; the masked, two-sided foliage leaf
    atlas), and the OBJ's normals kept, so the leaf cards keep the normals the generator bent to the crown (SpeedTree's
    leaf puffiness). File coordinates, as the props: the instance takes position (x, -y, z) and yaw -yaw."""
    name = species + (f'_{variant}' if variant else '')
    if name in SPECIES:
        return SPECIES[name]
    coll = bpy.data.collections.new('Tree_' + name)
    path = os.path.join(REPLICA, (kind[variant] if variant else kind)['obj'])
    for group, (verts, polys, uvs, normals) in sorted(read_obj_groups(path).items()):
        slot = tree_slot(group)
        ref = kind['materials'][slot]
        mat = replica_material('Trees', ref['key'], ref['spec'])
        ob = make_object(f'T_{name}_{slot}', verts, polys, uvs, mat, coll, smooth=True)
        if normals:
            ob.data.normals_split_custom_set(normals)
    SPECIES[name] = coll
    return coll


def place_yard_trees(region, col):
    """The Plex yard trees as the apply step instances them (plan_trees). With Trees/manifest.json: one group per
    species (the old maple rows on norway_maple, elm on the elm vase), each tree on its species mesh, scaled uniformly
    to the row's height. Without it: one group per kind on the old tree's mesh with scale (scale x crown, scale x
    crown, scale). Positions and yaw go into the file frame as (x, -y, z), -yaw."""
    rows = load_yard_trees(ROOT)
    if not rows:
        return 0
    kinds = load_tree_kinds(ROOT)
    return place_tree_groups(plan_trees(rows, kinds), kinds, region, col, 'YardTree')


def place_street_trees(region, col):
    """Every street and park tree of Streets/street_trees.json as the apply step instances it (plan_trees, group
    'street'): each row on its kind's species mesh, or the kind's young mesh under YOUNG_BELOW of the mature height,
    at the ground under its trunk (the pit soil, sidewalk or lawn), its yaw, and the height and trunk spread scale of
    apply_plateau_replica.street_tree_scale. Returns the number placed, or None when the file does not exist (the game
    then still draws the old summer tree)."""
    rows = load_street_trees(ROOT)
    if rows is None:
        return None
    kinds = load_tree_kinds(ROOT)
    assert kinds, 'Streets/street_trees.json needs Trees/manifest.json: run Scripts/blender/plateau_trees.py --no-render'
    return place_tree_groups(plan_trees(rows, kinds), kinds, region, col, 'StreetTree')


def place_tree_groups(groups, kinds, region, col, prefix):
    """Instance each planned tree group's transforms inside the region, on its species (and variant) mesh; a mesh is
    read only when one of its trees is in the region."""
    n = 0
    for group in groups:
        variant = group.get('variant')
        kept = [t for t in group['transforms'] if region.keep(t[0][0], t[0][1])]
        if not kept:
            continue
        coll = species_collection(group['kind'], kinds[group['kind']], variant) if kinds else tree_template()[0]
        name = group['kind'] + (f'_{variant}' if variant else '')
        for (x, y, z), yaw, scale in kept:
            e = bpy.data.objects.new(f'{prefix}_{name}_{n}', None)
            e.instance_type = 'COLLECTION'
            e.instance_collection = coll
            e.location = (x / 100, -y / 100, z / 100)
            e.rotation_euler = (0, 0, -math.radians(yaw))
            e.scale = scale
            col.objects.link(e)
            n += 1
    return n


def place_all_trees(region, col, before=False):
    """(species street trees, old summer trees, yard trees) placed in the region. After the apply step the street and
    park trees stand on their species meshes and QuebecVegetation holds no old tree; before it (--before), or with no
    street_trees.json, the old summer tree stands at the current tree positions, and there are no yard trees."""
    street = None if before else place_street_trees(region, col)
    old = place_trees(old_tree_positions(), region, col) if street is None else 0
    yard = 0 if before else place_yard_trees(region, col)
    return street, old, yard


def setup_world(scene, sun_azimuth=215., sun_elevation=31.):
    world = bpy.data.worlds.new('Sky')
    scene.world = world
    nt = world.node_tree
    bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'HOSEK_WILKIE'
    sky.turbidity = 3.2
    sky.ground_albedo = .25
    az, el = math.radians(sun_azimuth), math.radians(sun_elevation)
    # Real (east, north, up) -> game frame (x, y, z) -> Blender (x, -y, z).
    to_sun = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    sky.sun_direction = to_sun
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.4
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 4.2
    sun.data.color = (1., .80, .60)
    sun.data.angle = math.radians(.6)
    sun.rotation_euler = (-to_sun).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(sun)


def build(name, spec, before=False, res=(1280, 720)):
    """The view's scene: loaded geometry, trees, props, camera and sky. Returns (scene, a summary line)."""
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    MASKED.clear()
    TREE.clear()
    SPECIES.clear()
    scene = bpy.context.scene
    scene.unit_settings.scale_length = 1.
    cam_pos, target = spec['camera']
    fov = spec.get('fov', 85.)
    region = Region(cam_pos, target, fov, spec.get('far', 15000.), spec.get('circle'))
    col = bpy.data.collections.new('World')
    scene.collection.children.link(col)
    idx = index()
    tris = load_existing(idx, region, col, before)
    if not before:
        tris += load_replica(region, col, dirs={'Plex': spec.get('plex_dir')})
    # District ground (z 0) under everything.
    g = 60000
    make_object('DistrictGround', [(-g / 100, -g / 100, -.002), (g / 100, -g / 100, -.002), (g / 100, g / 100, -.002),
                                   (-g / 100, g / 100, -.002)], [[0, 1, 2, 3]], [], existing_material('Ground', 'Gravel'), col)
    street, trees, yard_trees = place_all_trees(region, col, before)
    texts = 0
    placed = []
    if not before:
        rows = json.load(open(os.path.join(REPLICA, 'Furniture', 'placements.json')))['placements']
        rows += json.load(open(os.path.join(REPLICA, 'Soul', 'placements.json')))['placements']
        placed, man = place_props(rows, region, col)
        texts = street_name_text(placed, man, col)
    cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    scene.collection.objects.link(cam)
    cam.location = (cam_pos[0] / 100, -cam_pos[1] / 100, cam_pos[2] / 100)
    look = Vector((target[0] / 100, -target[1] / 100, target[2] / 100)) - cam.location
    cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
    cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.angle = math.radians(fov)
    cam.data.clip_start, cam.data.clip_end = .05, 2000.
    scene.camera = cam
    setup_world(scene, *spec.get('sun', (215., 31.)))
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    summary = (f'PREVIEW {name} before={before} loaded {tris} faces, {street or 0} species street trees, {trees} old '
               f'summer trees, {yard_trees} yard trees, {len(placed)} props, {texts} texts in {time.time() - t0:.0f}s')
    return scene, summary


def render(name, spec, before=False, samples=40, threads=3, res=(1280, 720), out=None):
    scene, summary = build(name, spec, before, res)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .05
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 1
    scene.cycles.transmission_bounces = 1
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = threads
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = spec.get('exposure', .5)
    try:
        scene.view_settings.look = 'AgX - Base Contrast'
    except TypeError:
        pass
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 88
    out = out or os.path.join(OUT, f'{name}{"_before" if before else ""}.jpg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scene.render.filepath = out
    t1 = time.time()
    print(summary, flush=True)
    bpy.ops.render.render(write_still=True)
    print(f'PREVIEW {name} rendered {out} in {time.time() - t1:.0f}s', flush=True)
    return out


# ------------------------------------------------------------------------------------------------
# Probe: what a pixel shows

PIXELS = {}


def pixel_alpha(img, u, v, address=('TA_WRAP', 'TA_WRAP')):
    """Diffuse alpha of a cut-out map at UV (u, v), wrapped or clamped per axis as the set addresses it; Blender stores
    image rows bottom up, as UV v runs."""
    import numpy as np
    key = img.name
    if key not in PIXELS:
        w, h = img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        PIXELS[key] = buf.reshape(h, w, 4)
    a = PIXELS[key]
    h, w = a.shape[:2]
    u = min(max(u, 0.), 1. - 1e-9) if address[0] == 'TA_CLAMP' else u % 1.
    v = min(max(v, 0.), 1. - 1e-9) if address[1] == 'TA_CLAMP' else v % 1.
    return float(a[int(v * h) % h, int(u * w) % w, 3])


def face_uv(ob, index, local):
    """UV at a local point on polygon `index` of a mesh object, from the triangle fan that contains it."""
    from mathutils.geometry import barycentric_transform, intersect_point_tri
    me = ob.data
    poly = me.polygons[index]
    layer = me.uv_layers.active
    if layer is None:
        return None
    loops = list(poly.loop_indices)
    co = [me.vertices[me.loops[i].vertex_index].co for i in loops]
    uv = [Vector((*layer.data[i].uv, 0.)) for i in loops]
    best = None
    for k in range(1, len(loops) - 1):
        tri = (co[0], co[k], co[k + 1])
        p = intersect_point_tri(local, *tri)
        if p is not None or best is None:
            best = barycentric_transform(local, *tri, uv[0], uv[k], uv[k + 1])
            if p is not None:
                break
    return best


def probe(scene, pixels):
    """Cast a camera ray through each pixel and print the first face it shows, passing through clear card texels."""
    deps = bpy.context.evaluated_depsgraph_get()
    cam = scene.camera
    w, h = scene.render.resolution_x, scene.render.resolution_y
    tr, br, bl, tl = [cam.matrix_world @ c for c in cam.data.view_frame(scene=scene)]
    origin0 = cam.matrix_world.translation
    rows = []
    for px, py in pixels:
        fx, fy = (px + .5) / w, (py + .5) / h
        top = tl.lerp(tr, fx)
        bottom = bl.lerp(br, fx)
        direction = (top.lerp(bottom, fy) - origin0).normalized()
        origin, travelled, passes = origin0.copy(), 0., 0
        row = {'pixel': (px, py), 'hit': None}
        while passes < 16:
            ok, loc, nrm, index, ob, mat = scene.ray_cast(deps, origin, direction)
            if not ok:
                break
            travelled += (loc - origin).length
            material = ob.material_slots[0].material.name if ob.material_slots and ob.material_slots[0].material else ''
            cut = MASKED.get(material)
            if cut and ob.type == 'MESH':
                uv = face_uv(ob, index, mat.inverted() @ loc)
                if uv is not None and pixel_alpha(cut[0], uv.x * cut[1][0], uv.y * cut[1][1], cut[3]) < cut[2]:
                    origin, passes = loc + direction * .002, passes + 1
                    continue
            row['hit'] = {'object': ob.name, 'material': material, 'distance_m': round(travelled, 2),
                          'game_cm': [round(loc.x * 100, 1), round(-loc.y * 100, 1), round(loc.z * 100, 1)],
                          'normal_game': [round(nrm.x, 3), round(-nrm.y, 3), round(nrm.z, 3)],
                          'seen_from_behind': nrm.dot(direction) > 0, 'card_passes': passes}
            break
        rows.append(row)
        print('PROBE', json.dumps(row), flush=True)
    return rows


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('--view', action='append')
    ap.add_argument('--before', action='store_true')
    ap.add_argument('--samples', type=int, default=40)
    ap.add_argument('--threads', type=int, default=3)
    ap.add_argument('--res', default='1280x720')
    ap.add_argument('--out')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--camera', help='override: x,y,z,tx,ty,tz in game-frame cm')
    ap.add_argument('--fov', type=float)
    ap.add_argument('--sun', help='azimuth,elevation in degrees (real compass)')
    ap.add_argument('--exposure', type=float)
    ap.add_argument('--plex-dir', help='render a Plex build from another folder (before/after checks)')
    ap.add_argument('--probe', nargs='+', metavar='X,Y',
                    help='print what these pixels show (ray casts from the camera) instead of rendering')
    a = ap.parse_args(argv)
    v = views()
    if a.list:
        for k, spec in v.items():
            print(k, spec['title'], spec.get('camera'))
        return
    res = tuple(int(x) for x in a.res.split('x'))
    for name in a.view or []:
        spec = dict(v[name])
        if a.camera:
            c = [float(x) for x in a.camera.split(',')]
            spec['camera'] = (tuple(c[:3]), tuple(c[3:]))
            spec.pop('circle', None)
        if a.fov:
            spec['fov'] = a.fov
        if a.sun:
            spec['sun'] = tuple(float(x) for x in a.sun.split(','))
        if a.exposure is not None:
            spec['exposure'] = a.exposure
        if a.plex_dir:
            spec['plex_dir'] = a.plex_dir
        if a.probe:
            scene, summary = build(name, spec, a.before, res)
            print(summary, flush=True)
            probe(scene, [tuple(int(float(c)) for c in p.split(',')) for p in a.probe])
            continue
        render(name, spec, a.before, a.samples, a.threads, res, a.out)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
