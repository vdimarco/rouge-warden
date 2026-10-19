"""Street-level Cycles previews of the Plateau replica layers, in the game frame.

Run with a Python that can `import bpy` (Blender 5.1), from games/nord-unreal:

    <blender-python> Scripts/blender/plateau_replica_preview.py --view mentana
    <blender-python> Scripts/blender/plateau_replica_preview.py --view fabre --before
    <blender-python> Scripts/blender/plateau_replica_preview.py --list

Each view loads, inside a camera wedge, the committed Data/Plateau layers that are visible in the game
(background masses, OSM road, path, glass cards, ground, park, perimeter and context batches) and,
unless --before is given, the ReplicaGeometry layers: Streets, Plex, Soul, and the Furniture and Soul
placements instanced from the Props meshes, with the street-name text the apply step adds.

Frame: every OBJ stores (x, -y, z) of a game-frame point (x east, y north, cm). Blender is
right-handed, so placing the file coordinates unchanged shows the world as Unreal's left-handed view
shows it: the player's view of the mirrored map (openspec/changes/nord-gta-level-up/notes-mirror.md).
Prop instances use the file coordinates of their meshes, position (x, -y, z) and yaw -yaw.

These are previews of generated geometry, not Unreal captures. Colours come from the layer manifests
and from the colours `upgrade_plateau.py` gives the existing materials; the four Poly Haven textures in
Data/Art are used the way the game materials use them.
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
    v['mentana'] = dict(title='Rue de Mentana, plex street west of the park, from the shady sidewalk',
                        camera=street_view(mentana, 5200, -690, 18., look_ahead=6000, yaw_deg=13, pitch_target=430),
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
    # Mentana between Rachel and Duluth, seen from above the sunlit side, about 60 m up.
    (tx, ty), (dx, dy) = along(mentana, 12000)
    a = math.atan2(-0.838, -0.545) + math.radians(28)
    cx, cy = tx + 9500 * math.cos(a), ty + 9500 * math.sin(a)
    v['aerial'] = dict(title='High three-quarter view over two plex blocks on Mentana', far=26000,
                       camera=((cx, cy, 6000.), (tx, ty, 0.)), fov=62, circle=(tx, ty, 19000))
    return v


# ------------------------------------------------------------------------------------------------
# Loading

class Region:
    def __init__(self, cam, target, fov, far, circle=None):
        self.cx, self.cy = cam[0], cam[1]
        d = (target[0] - cam[0], target[1] - cam[1])
        n = math.hypot(*d) or 1.
        self.dx, self.dy = d[0] / n, d[1] / n
        self.cos = math.cos(math.radians(min(89., fov / 2 + 22.)))
        self.far, self.near = far, 4500.
        self.circle = circle

    def keep(self, x, y):
        if self.circle:
            return math.hypot(x - self.circle[0], y - self.circle[1]) < self.circle[2]
        ex, ey = x - self.cx, y - self.cy
        d = math.hypot(ex, ey)
        if d < self.near:
            return True
        return d < self.far and (ex * self.dx + ey * self.dy) > self.cos * d

    def box(self, b):
        """Could an OBJ with game-frame bounds b = [x0, y0, z0, x1, y1, z1] hold kept vertices?"""
        if self.circle:
            cx, cy, r = self.circle
            qx, qy = min(max(cx, b[0]), b[3]), min(max(cy, b[1]), b[4])
            return math.hypot(qx - cx, qy - cy) < r
        qx, qy = min(max(self.cx, b[0]), b[3]), min(max(self.cy, b[1]), b[4])
        if math.hypot(qx - self.cx, qy - self.cy) > self.far:
            return False
        corners = [(b[0], b[1]), (b[3], b[1]), (b[0], b[4]), (b[3], b[4]), (qx, qy)]
        if any(self.keep(x, y) for x, y in corners):
            return True
        # A box straddling the wedge: test points along the view ray.
        for k in range(1, 40):
            t = self.far * k / 40
            x, y = self.cx + self.dx * t, self.cy + self.dy * t
            if b[0] <= x <= b[3] and b[1] <= y <= b[4]:
                return True
        return False


def read_obj(path, region, scale=.01, want_uv=True):
    """Faces of an OBJ with at least one vertex kept by the region (None keeps all)."""
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
        if not any(keep[i] for i in idx):
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


def image(name):
    key = 'IMG_' + name
    if key not in bpy.data.images:
        img = bpy.data.images.load(os.path.join(ART, name))
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


def replica_material(layer, key, spec):
    color = srgb_to_linear(spec['base_color_srgb'])
    texture = spec.get('texture') or ''
    tex = None
    tiling = 1.
    # As apply_plateau_replica.base_material: only asphalt and brick keep a textured parent.
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
    changed = False
    for dirpath, _, names in os.walk(DATA):
        if '/ReplicaGeometry/Props' in dirpath:
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
    if '__trees__' not in idx:
        sys.path.insert(0, os.path.join(ROOT, 'Scripts'))
        from plateau_rendering import tree_positions
        idx['__trees__'] = [list(t) for t in tree_positions()]
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


def load_replica(region, col, layers=('Streets', 'Plex', 'Soul'), dirs=None):
    count = 0
    for layer in layers:
        folder = (dirs or {}).get(layer) or os.path.join(REPLICA, layer)
        man = json.load(open(os.path.join(folder, 'manifest.json')))
        for batch in man['batches']:
            b = batch['bounds_cm']
            if not region.box(b):
                continue
            verts, polys, uvs = read_obj(os.path.join(folder, batch['file']), region)
            if polys:
                mat = replica_material(layer, batch['material'], man['materials'][batch['material']])
                make_object(f'{layer}_{batch["file"][:-4]}', verts, polys, uvs, mat, col)
                count += len(polys)
    return count


def prop_collections(keys):
    man = json.load(open(os.path.join(REPLICA, 'Props', 'manifest.json')))
    out = {}
    for batch in man['batches']:
        key = batch.get('prop')
        if key not in keys or 'merged' in batch.get('part', ''):
            continue
        if key not in out:
            c = bpy.data.collections.new('P_' + key)
            out[key] = c
        verts, polys, uvs = read_obj(os.path.join(REPLICA, 'Props', batch['file']), None, want_uv=False)
        mat = replica_material('Props', batch['material'], man['materials'][batch['material']])
        ob = make_object('P_' + batch['file'][:-4], verts, polys, [], mat, out[key])
    return out, man


def place_props(rows, region, col):
    rows = [r for r in rows if region.keep(r['position'][0], r['position'][1])]
    keys = sorted({r['prop'] for r in rows})
    colls, man = prop_collections(keys)
    for i, r in enumerate(rows):
        c = colls.get(r['prop'])
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


def tree_template():
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


def place_trees(trees, region, col):
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


def render(name, spec, before=False, samples=40, threads=3, res=(1280, 720), out=None):
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
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
    trees = place_trees(idx['__trees__'], region, col)
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
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
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
    print(f'PREVIEW {name} before={before} loaded {tris} faces, {trees} trees, {len(placed)} props, {texts} texts '
          f'in {t1 - t0:.0f}s', flush=True)
    bpy.ops.render.render(write_still=True)
    print(f'PREVIEW {name} rendered {out} in {time.time() - t1:.0f}s', flush=True)
    return out


def ruelle_camera(spec):
    s = load_streets()
    pts = s['__alley__' + spec['alley']][0]
    return pts


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
        render(name, spec, a.before, a.samples, a.threads, res, a.out)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
