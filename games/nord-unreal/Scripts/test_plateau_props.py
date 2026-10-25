"""Checks for the Blender-built Plateau street props (Data/Plateau/ReplicaGeometry/Props).

    python3 Scripts/test_plateau_props.py                    # validate manifest and OBJs on disk
    python3 Scripts/test_plateau_props.py --blender PYTHON   # also rebuild twice and compare bytes
    NORD_BLENDER_PYTHON=PYTHON python3 Scripts/test_plateau_props.py

PYTHON is an interpreter that can `import bpy` (Blender 5.1 module), or a `blender` binary.
The OBJs are git-ignored, so a fresh checkout needs one build (or --blender) first.
Stdlib only.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROPS = ROOT / 'Data/Plateau/ReplicaGeometry/Props'
GENERATOR = ROOT / 'Scripts/blender/plateau_props.py'
SHEET = ROOT / 'Preview/Replica/props_contact_sheet.png'
REQUIRED = {
    'lamp_cobra', 'lamp_park', 'hydrant', 'sign_stop', 'sign_street', 'sign_oneway', 'sign_parking',
    'bixi_dock', 'bixi_bike', 'bin_recycling', 'bin_compost', 'bin_garbage', 'cone', 'barrier_chantier',
    'utility_pole', 'laundry_line', 'bike_locked', 'ac_unit', 'flower_box', 'bench', 'mailbox',
    'police_lightbar', 'dog_small', 'dog_medium', 'dog_large', 'stroller', 'grocery_bag',
    'chair_patio', 'bbq', 'satellite_dish', 'potted_plant', 'bike_gallery',
    'leaf_bag', 'leaf_bag_mid', 'leaf_bag_low', 'pumpkin', 'pumpkin_carved'}
# Gallery life (the outdoor rooms of the back galleries): kind, (min, max) size in cm along Unreal X, Y and Z of
# the assembled prop, and whether it carries box colliders (things a player bumps into on a 1.2-1.8 m deck).
GALLERY = {'chair_patio': ((45, 70), (50, 70), (75, 95), True), 'bbq': ((45, 70), (100, 135), (100, 125), True),
           'satellite_dish': ((30, 60), (40, 60), (60, 100), False),
           'potted_plant': ((25, 50), (25, 50), (40, 90), False), 'bike_gallery': ((165, 195), (35, 65), (100, 125), True)}
TARGETS = {'lamp_cobra': 800, 'lamp_park': 800, 'hydrant': 500, 'dog_small': 1500, 'dog_medium': 1500,
           'dog_large': 1500, 'stroller': 1500, 'chair_patio': 700, 'bbq': 1600, 'satellite_dish': 1200,
           'potted_plant': 1500, 'bike_gallery': 2500, 'leaf_bag': 400, 'leaf_bag_mid': 400, 'leaf_bag_low': 400,
           'pumpkin': 450, 'pumpkin_carved': 700}
# Late-October dressing: (min, max) size in cm along Unreal X, Y and Z at scale 1. The 30 gallon kraft bag is 41 x 30 cm
# and 89 cm of paper; filled less, it folds over more and stands lower. The carving pumpkin is about 30 cm.
SEASON = {'leaf_bag': ((28, 35), (38, 44), (74, 86)), 'leaf_bag_mid': ((28, 35), (38, 44), (58, 70)),
          'leaf_bag_low': ((28, 35), (38, 44), (42, 56)), 'pumpkin': ((27, 33), (26, 33), (27, 33)),
          'pumpkin_carved': ((27, 33), (26, 33), (27, 33))}
DOG_PARTS = {'body', 'head', 'leg_fl', 'leg_fr', 'leg_rl', 'leg_rr', 'tail'}
VARIANT_PROPS = {'bin_recycling', 'bin_compost', 'bin_garbage', 'utility_pole', 'ac_unit', 'flower_box',
                 'bench', 'bike_locked', 'laundry_line', 'dog_small', 'dog_medium', 'dog_large', 'stroller',
                 'chair_patio', 'bbq', 'satellite_dish', 'potted_plant', 'bike_gallery', 'leaf_bag', 'leaf_bag_mid',
                 'leaf_bag_low', 'pumpkin', 'pumpkin_carved'}
# Parking-sign plates (pass-6 local review, item 3: every plate showed the R-PF face). The faces follow the city's
# drawings (Ville de Montréal, Catalogue des panneaux, signalisation écrite, 2015) and the Quebec standard (Règlement
# sur la signalisation routière, arts. 2, 5, 6, 29 and 30; Tome V P-150 and P-160): the families, their plate heights
# (300 x 450 mm, 300 x 600 mm for the permit zones and the disabled spaces), the crown's place and radii, the arrow axis.
PLATE_FAMILIES = {'no_stopping': 45, 'no_parking': 45, 'limited': 45, 'reserved': 45, 'permit': 60, 'disabled': 60}
PLATE_TOP, CROWN_Z, CROWN_IN = 222.5, 222.5 - 11.3, 7.6
ARROW_UP = 5.5
PLACEMENTS = ROOT / 'Data/Plateau/ReplicaGeometry/Furniture/placements.json'
PREVIEW = ROOT / 'Scripts/blender/plateau_replica_preview.py'


def read_obj(path):
    verts, tris, header = [], [], None
    for line in path.read_text().splitlines():
        tag, _, rest = line.partition(' ')
        if header is None:
            assert tag == 'o', (path, line)
            header = rest
        elif tag == 'v':
            verts.append(tuple(float(c) for c in rest.split()))
        elif tag == 'f':
            ids = [int(token.split('/')[0]) - 1 for token in rest.split()]
            assert len(ids) == 3 and all(0 <= i < len(verts) for i in ids), (path, line)
            tris.append(ids)
        else:
            assert tag in ('vt', 'vn'), (path, line)
    return header, verts, tris


def closed_volumes(verts, tris):
    """Signed volume of every closed connected component (shared vertex indices)."""
    parent = list(range(len(verts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for a, b, c in tris:
        for x, y in ((a, b), (b, c)):
            parent[find(x)] = find(y)
    groups = {}
    for tri in tris:
        groups.setdefault(find(tri[0]), []).append(tri)
    out = []
    for group in groups.values():
        edges = {}
        for a, b, c in group:
            for x, y in ((a, b), (b, c), (c, a)):
                edges[(x, y)] = edges.get((x, y), 0) + 1
        if any(edges.get((y, x), 0) != n for (x, y), n in edges.items()):
            continue
        total = 0.0
        for a, b, c in group:
            p, q, r = verts[a], verts[b], verts[c]
            total += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) +
                      p[2] * (q[0] * r[1] - q[1] * r[0])) / 6
        out.append(total)
    return out


def check(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    for key in ('layer', 'generator', 'frame', 'batches', 'materials', 'counts', 'source_sha256', 'props'):
        assert key in manifest, key
    assert manifest['layer'] == 'Props' and manifest['frame'] == 'x east, y north, cm, z up'
    assert manifest['generator'] == 'Scripts/blender/plateau_props.py'
    assert manifest['source_sha256'][manifest['generator']] == hashlib.sha256(GENERATOR.read_bytes()).hexdigest(), \
        'manifest is stale: rebuild with Scripts/blender/plateau_props.py'
    props = manifest['props']
    assert set(props) == REQUIRED, sorted(set(props) ^ REQUIRED)
    materials = manifest['materials']
    for key, mat in materials.items():
        assert key.replace('_', '').isalnum(), key
        assert len(mat['base_color_srgb']) == 7 and mat['base_color_srgb'].startswith('#'), key
        assert 0 <= mat['roughness'] <= 1 and 0 <= mat['metallic'] <= 1, key
    files = sorted(p.name for p in directory.glob('*.obj'))
    assert files == sorted(b['file'] for b in manifest['batches']), 'OBJ set differs from manifest'
    per_prop, volumes = {}, []
    for batch in manifest['batches']:
        path = directory / batch['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == batch['sha256'], batch['file']
        header, verts, tris = read_obj(path)
        assert header == batch['mesh'] and batch['mesh'].startswith('SM_Props_'), batch['file']
        assert batch['material'] in materials and all(v in materials for v in batch.get('variants', [])), batch
        assert batch['collision'] in ('none', 'simple', 'complex')
        assert batch['triangles'] == len(tris) and 0 < len(tris) < 65000, batch['file']
        ue = [(x, -y, z) for x, y, z in verts]
        bounds = [min(v[i] for v in ue) for i in range(3)] + [max(v[i] for v in ue) for i in range(3)]
        assert all(abs(a - b) < .02 for a, b in zip(bounds, batch['bounds_cm'])), (batch['file'], bounds)
        part = props[batch['prop']]['parts'][batch['part']]
        assert part['mesh'] == batch['mesh'] and part['material'] == batch['material']
        if not part.get('merged'):
            per_prop[batch['prop']] = per_prop.get(batch['prop'], 0) + len(tris)
        volumes += [(v, batch['file']) for v in closed_volumes(verts, tris)]
    inverted = sorted({f for v, f in volumes if v < -.01})
    assert not inverted, f'closed shells facing inward: {inverted}'
    assert len(volumes) > 300, len(volumes)
    for key, entry in props.items():
        assert per_prop[key] == entry['triangles'] == manifest['counts']['triangles_per_prop'][key], key
        assert entry['triangles'] <= entry['budget'], (key, entry['triangles'])
        if key in TARGETS:
            assert entry['triangles'] <= TARGETS[key], (key, entry['triangles'])
        b = entry['bounds_cm']
        assert abs(b[2]) < .05, (key, 'pivot must sit on the base', b)
        if entry['kind'] in ('street', 'works', 'park', 'ruelle', 'companion', 'gallery', 'season') and \
                key != 'laundry_line':
            assert b[0] <= 0 <= b[3] and b[1] <= 0 <= b[4], (key, 'pivot outside the footprint', b)
        assert b[5] - b[2] < 1100, key
    for key in ('dog_small', 'dog_medium', 'dog_large'):
        parts = props[key]['parts']
        assert DOG_PARTS <= set(parts), key
        for name in DOG_PARTS:
            assert len(parts[name]['attach_cm']) == 3, (key, name)
        for leg in ('leg_fl', 'leg_fr', 'leg_rl', 'leg_rr'):
            assert parts[leg]['joint']['axis_unreal'] == 'Y' and parts[leg]['attach_cm'][2] > 10, (key, leg)
        assert any(p.get('merged') for p in parts.values()), key
        assert parts['leg_fl']['attach_cm'][1] < 0 < parts['leg_fr']['attach_cm'][1], 'left legs on Unreal -Y'
    stroller = props['stroller']['parts']
    assert {'frame', 'seat', 'canopy', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'} <= set(stroller)
    for prop_key in VARIANT_PROPS:
        variants = {v for b in manifest['batches'] if b['prop'] == prop_key for v in b.get('variants', [])}
        assert len(variants) >= 2, (prop_key, 'needs at least two colour variants')
    slots = props['sign_street']['text_slots']
    assert set(slots) == {'blade_a', 'blade_b'} and all(len(s) == 2 for s in slots.values())
    for blade in slots.values():
        for face in blade:
            n, r = face['face_normal'], face['right']
            cross_z = n[0] * r[1] - n[1] * r[0]
            # Unreal is left-handed (yaw +90 turns X toward Y): a viewer looking along -normal has
            # right = (n.y, -n.x), so text laid along +right reads left to right.
            assert abs(sum(a * b for a, b in zip(n, r))) < 1e-6 and cross_z < 0, face
    assert len(props['bixi_dock']['slots']) == 6
    check_gallery(props)
    check_colliders(props)
    check_october(directory, manifest)
    stop = props['sign_stop']['parts']
    assert {'face_red', 'face_white'} <= set(stop)
    check_plate_faces(directory, manifest)
    return manifest


def check_gallery(props):
    """The gallery-life props: real sizes, colliders only on what a player bumps into, mount and lean anchors."""
    for key, (sx, sy, sz, collides) in GALLERY.items():
        entry = props[key]
        assert entry['kind'] == 'gallery', key
        b = entry['bounds_cm']
        for (lo, hi), size, axis in zip((sx, sy, sz), (b[3] - b[0], b[4] - b[1], b[5] - b[2]), 'XYZ'):
            assert lo <= size <= hi, (key, axis, round(size, 1), (lo, hi))
        assert bool(entry.get('colliders_cm')) == collides, (key, 'colliders')
        for box in entry.get('colliders_cm', []):
            lo = [c - s / 2 for c, s in zip(box['center'], box['size'])]
            hi = [c + s / 2 for c, s in zip(box['center'], box['size'])]
            assert all(l <= bl + 15 and h >= bh - 15 for l, h, bl, bh in zip(lo, hi, b[:3], b[3:])), (key, box, b)
    assert 40 <= props['chair_patio']['seat_cm'] <= 48
    clamp = props['satellite_dish']['anchors']['clamp_cm']
    aim = props['satellite_dish']['anchors']['aim_cm']
    assert len(clamp) == 3 and 0 <= clamp[2] <= 15, clamp
    elevation = math.degrees(math.atan2(aim[2], math.hypot(aim[0], aim[1])))
    assert aim[0] > 0 and abs(aim[1]) < 1e-6 and 15 <= elevation <= 40, (aim, elevation)
    # Offset-fed dish: the LNB hangs in front of the reflector and below its axis (the feed arm leaves the lower
    # rim), never above it.
    reflector = props['satellite_dish']['anchors']['reflector_cm']
    lnb = props['satellite_dish']['anchors']['lnb_cm']
    unit = [c / math.hypot(*aim) for c in aim]
    rel = [b - a for a, b in zip(reflector, lnb)]
    ahead = sum(r * u for r, u in zip(rel, unit))
    off_axis = [r - ahead * u for r, u in zip(rel, unit)]
    assert 25 <= ahead <= 45 and off_axis[2] < -5, ('LNB in front of and below the dish axis', ahead, off_axis)
    assert lnb[2] < reflector[2] + ahead * unit[2], lnb
    lean = props['bike_gallery']['anchors']['lean_contact_cm']
    assert lean[1] < -10 and 80 <= lean[2] <= 110, ('the bike leans toward Unreal -Y onto the guard', lean)
    assert props['bike_gallery']['bounds_cm'][1] < -30 < props['bike_gallery']['bounds_cm'][4] + 30
    # The geranium is a dome of separate leaves on petioles, with some yellowed ones and flowers above it.
    plant = props['potted_plant']['parts']
    assert {'pot', 'soil', 'leaves', 'leaves_dry', 'stems', 'flowers'} <= set(plant), sorted(plant)
    assert plant['leaves_dry']['material'] == 'PlantDry' and plant['leaves']['material'] == 'PlantGreen'


def _srgb(hexcol):
    return [int(hexcol[i:i + 2], 16) for i in (1, 3, 5)]


def _part_verts(directory, manifest, key, part):
    (batch,) = [b for b in manifest['batches'] if b['prop'] == key and b['part'] == part]
    return read_obj(directory / batch['file'])[1]


def check_october(directory, manifest):
    """Kraft leaf bags at three fill heights and pumpkins, one carved: real sizes, the forms a placement picks from,
    the print on both wide faces, and the carved face laid on the front of the shell."""
    props, materials = manifest['props'], manifest['materials']
    for key, sizes in SEASON.items():
        entry = props[key]
        assert entry['kind'] == 'season', key
        b = entry['bounds_cm']
        for (lo, hi), size, axis in zip(sizes, (b[3] - b[0], b[4] - b[1], b[5] - b[2]), 'XYZ'):
            assert lo <= size <= hi, (key, axis, round(size, 1), (lo, hi))
        assert entry['form_of'] == ('leaf_bag' if key.startswith('leaf_bag') else 'pumpkin'), key
    bags = ('leaf_bag', 'leaf_bag_mid', 'leaf_bag_low')
    forms = props['leaf_bag']['forms']
    assert [f['prop'] for f in forms] == list(bags) and abs(sum(f['share'] for f in forms) - 1) < 1e-9, forms
    tops = [props[k]['bounds_cm'][5] for k in bags]
    fills = [props[k]['fill_cm'] for k in bags]
    assert all(a - b >= 8 for a, b in zip(tops, tops[1:])) and fills == sorted(fills, reverse=True), (tops, fills)
    for key in bags:
        parts = props[key]['parts']
        assert {'body', 'print', 'leaves'} <= set(parts), sorted(parts)
        assert parts['body']['material'] == 'LeafBagKraft' and parts['leaves']['material'] == 'LeafOchre'
        r, g, bl = _srgb(materials[parts['print']['material']]['base_color_srgb'])
        assert g > r and g > bl, ('green print', parts['print']['material'])
        assert len(props[key]['colliders_cm']) == 1 and props[key]['fill_cm'] < props[key]['bounds_cm'][5] - 10, key
        # The print lies on the two wide walls (Unreal ±X), within 1 cm of the body's widest point.
        verts = _part_verts(directory, manifest, key, 'print')
        bounds = props[key]['bounds_cm']
        assert all(abs(x) >= 14 for x, _, _ in verts), (key, 'print off the wide faces')
        assert {x > 0 for x, _, _ in verts} == {True, False}, (key, 'print on one face only')
        assert all(abs(x) <= max(-bounds[0], bounds[3]) + 1 for x, _, _ in verts), (key, 'print floats off the wall')
    pumpkin = props['pumpkin']
    assert [f['prop'] for f in pumpkin['forms']] == ['pumpkin', 'pumpkin_carved'], pumpkin['forms']
    assert abs(sum(f['share'] for f in pumpkin['forms']) - 1) < 1e-9
    sizes = pumpkin['sizes']
    lo, hi = pumpkin['scale_range']
    assert lo <= sizes['pie'] < sizes['carving'] == 1 < sizes['large'] <= hi, (sizes, lo, hi)
    for key in ('pumpkin', 'pumpkin_carved'):
        assert not props[key].get('colliders_cm'), (key, 'a pumpkin on a step blocks nobody')
        assert {'body', 'stem'} <= set(props[key]['parts']), key
    assert 'face' not in props['pumpkin']['parts']
    face = props['pumpkin_carved']['parts']['face']
    assert sum(_srgb(materials[face['material']]['base_color_srgb'])) < 150, ('dark carved holes', face)
    # The face looks along +X and sits on the shell: a level ray from the axis through each face vertex meets the
    # shell between 0.05 and 1 cm before the vertex (not sunk into it, not floating off it).
    (batch,) = [b for b in manifest['batches'] if b['prop'] == 'pumpkin_carved' and b['part'] == 'body']
    _, body, tris = read_obj(directory / batch['file'])
    decal = _part_verts(directory, manifest, 'pumpkin_carved', 'face')
    front = [p for p in decal if p[2] < 20]
    assert front and all(p[0] > 4 and abs(p[1]) < 14 for p in front), 'the face is not on the +X side'
    for x, y, z in decal:
        r = math.hypot(x, y)
        hit = shell_hit(body, tris, (0., 0., z), (x / r, y / r, 0.))
        assert hit is not None and .05 <= r - hit <= 1., ('face off the shell', (x, y, z), r, hit)


def shell_hit(verts, tris, origin, direction):
    """Farthest distance along a ray at which it meets a triangle (Moller-Trumbore), or None."""
    best = None
    for tri in tris:
        a, b, c = (verts[i] for i in tri)
        e1 = [b[k] - a[k] for k in range(3)]
        e2 = [c[k] - a[k] for k in range(3)]
        d = direction
        p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]
        det = sum(e1[k] * p[k] for k in range(3))
        if abs(det) < 1e-12:
            continue
        s = [origin[k] - a[k] for k in range(3)]
        u = sum(s[k] * p[k] for k in range(3)) / det
        q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
        v = sum(d[k] * q[k] for k in range(3)) / det
        t = sum(e2[k] * q[k] for k in range(3)) / det
        if u >= -1e-9 and v >= -1e-9 and u + v <= 1 + 1e-9 and t > 0:
            best = t if best is None else max(best, t)
    return best


def _colour(manifest, part):
    return _srgb(manifest['materials'][manifest['props']['sign_parking']['parts'][part]['material']]['base_color_srgb'])


def _red(rgb):
    return rgb[0] > 150 and rgb[1] < 80 and rgb[2] < 80


def _green(rgb):
    return rgb[1] > 90 and rgb[0] < 60 and rgb[2] < 110


def check_plate_faces(directory, manifest):
    """The parking sign's plate faces: the red bar of the crown runs from the reader's top left to the bottom right, as
    on the city's plates; one face per family of the city clip, each with its own black part, its plate height, a red
    crown on every prohibition (art. 6) and none on the limited-parking P (P-150-7), a green crown on the disabled
    space (art. 5, P-150-5), a black octagon only under the no-stopping crowns (P-160), arrows on the plate's own axis
    pointing the way they say, and each assembled face within its triangle budget."""
    sign = manifest['props']['sign_parking']
    # The crown's bar. The OBJ holds Blender coordinates, where a reader facing the plate (+X) has +Y on the right, so
    # a bar from the top left to the bottom right has y growing as z falls.
    verts = _part_verts(directory, manifest, 'sign_parking', 'face_red')
    front = max(x for x, _, _ in verts)
    ring = [(y, z) for x, y, z in verts if x < front - .005]
    bar = [(y, z) for x, y, z in verts if x >= front - .005]
    cy, cz = sum(y for y, _ in ring) / len(ring), sum(z for _, z in ring) / len(ring)
    assert len(bar) == 4 and all(math.hypot(y - cy, z - cz) < max(math.hypot(a - cy, b - cz) for a, b in ring)
                                 for y, z in bar), ('the crown bar', bar)
    my, mz = sum(y for y, _ in bar) / 4, sum(z for _, z in bar) / 4
    slope = sum((y - my) * (z - mz) for y, z in bar)
    assert slope < 0, ('the crown bar runs from the bottom left to the top right; the city draws it from the top left '
                       'to the bottom right', bar)
    faces = sign.get('plate_faces')
    assert faces, 'sign_parking has one plate face (R-PF) for every sign: it needs plate_faces, one per sign family'
    parts, arrows = sign['parts'], sign['plate_arrows']
    assert {f['family'] for f in faces.values()} == set(PLATE_FAMILIES), sorted(f['family'] for f in faces.values())
    assert sign['plate_default'] in faces and abs(cz - CROWN_Z) < .01 and abs(cy) < .01, (cy, cz)
    bounds = {b['part']: b['bounds_cm'] for b in manifest['batches'] if b['prop'] == 'sign_parking'}
    blacks = []
    for name, face in faces.items():
        assert set(face['parts']) <= set(parts) and 'post' not in face['parts'], (name, face['parts'])
        (black,) = [p for p in face['parts'] if p.startswith('face_black')]
        blacks.append(black)
        height = PLATE_FAMILIES[face['family']]
        assert face['size_cm'] == [30., height] and face['plate'] == ('tall' if height == 60 else 'short'), (name, face)
        (plate,) = [p for p in face['parts'] if p.startswith('plate')]
        white = 'face_white' + ('_tall' if height == 60 else '')
        assert white in face['parts'] and _colour(manifest, white) > [230] * 3, (name, white)
        for part in (plate, white, black):
            b = bounds[part]
            assert abs(b[5] - PLATE_TOP) < .6 and abs(b[5] - b[2] - height) < 1.1, (name, part, b, height)
        reds = [p for p in face['parts'] if _red(_colour(manifest, p))]
        greens = [p for p in face['parts'] if _green(_colour(manifest, p))]
        assert ('face_red' in reds) == (face['family'] != 'limited'), (name, 'a red crown and bar on a prohibition')
        assert bool(greens) == (face['family'] == 'disabled'), (name, 'a green crown on the disabled space only')
        # Under the crown: the stop octagon (8 corners on one circle) on a no-stopping face, a P on the others.
        inside = {(round(y, 2), round(z, 2)) for _, y, z in _part_verts(directory, manifest, 'sign_parking', black)
                  if math.hypot(y, z - CROWN_Z) < CROWN_IN - .2}
        radii = {round(math.hypot(y, z - CROWN_Z), 1) for y, z in inside}
        octagon = len(inside) == 8 and len(radii) == 1
        assert octagon == (face['symbol'] == 'octagon') == (face['family'] == 'no_stopping'), (name, len(inside), radii)
        assert face['triangles'] <= sign['face_budget'], (name, face['triangles'])
    assert len(set(blacks)) == len(blacks), 'two faces share a black part'
    for direction, sizes in arrows.items():
        for size, part in sizes.items():
            verts = _part_verts(directory, manifest, 'sign_parking', part)
            axis = PLATE_TOP - (60 if size == 'tall' else 45) + ARROW_UP
            left = min(verts, key=lambda v: v[1])
            right = max(verts, key=lambda v: v[1])
            tips = {'left': [left], 'right': [right], 'both': [left, right]}[direction]
            for tip in tips:
                assert abs(tip[2] - axis) < .01, (part, 'a tip off the arrow axis', tip, axis)
            assert all(abs(v[2] - axis) > .5 for v in {'left': [right], 'right': [left], 'both': []}[direction]), part


def expected_family(code, text):
    """A sign's family from the city's codification (the catalogue's "Principes de base du code de panneaux": the
    first letter is the group, A no stopping, S no parking, P limited parking, R no parking except), checked against
    the description's own notation ("\\A" a barred A for no stopping, "\\P" a barred P, "P" a plain P)."""
    group = {'A': 'no_stopping', 'S': 'no_parking', 'P': 'limited', 'R': 'reserved', 'L': 'no_stopping'}[code[0]]
    mark = text.split(' ')[0].upper()
    assert {'no_stopping': ('\\A', '\\ARRÊT'), 'limited': ('P',)}.get(group, ('\\P',)).count(mark) == 1, \
        (code, text, 'the code group and the description disagree')
    if group == 'reserved' and 'S3R' in text:
        return 'permit'            # the residents' permit zones (SRRR), catalogue pages 1-5-3 to 1-5-7
    if group == 'reserved' and 'HANDICAP' in text.upper():
        return 'disabled'          # catalogue page 1-5-2, P-150-5
    return group


def check_row_faces(manifest):
    """Through the apply step's plan, as the dry run builds it: each parking sign of the Furniture layer shows exactly
    one plate face, the one its code's family calls for, with hours where its description gives them (no stopping and
    no parking), the arrow its row carries on that plate's axis and nothing else, and its post unless it hangs on a
    city pole. The preview takes its parts from the same rule."""
    sys.path.insert(0, str(ROOT / 'Scripts'))
    import apply_plateau_replica as A
    sign = manifest['props']['sign_parking']
    faces = sign.get('plate_faces')
    assert faces, 'sign_parking has one plate face (R-PF) for every sign: it needs plate_faces, one per sign family'
    part_of = {f"{A.ASSETS}/Props/{b['mesh']}": b['part'] for b in manifest['batches'] if b['prop'] == 'sign_parking'}
    shown = {}
    the_plan = A.plan(ROOT)
    for inst in the_plan['instances']:
        if inst['prop'] == 'sign_parking':
            for position, _, _ in inst['transforms']:
                shown.setdefault(tuple(position), set()).add(part_of[inst['mesh']])
    rows = [r for r in json.loads(PLACEMENTS.read_text())['placements'] if r['prop'] == 'sign_parking']
    assert len(rows) == len(shown) > 400, (len(rows), len(shown))
    tally, hours_pattern = {}, re.compile(r'\d{1,2} ?h')    # a time in the description: "8h-9h", "07h-09h30"
    for r in rows:
        got = shown[tuple(r['position'])]
        on = [name for name, face in faces.items() if set(face['parts']) <= got]
        blacks = [p for p in got if p.startswith('face_black')]
        assert len(blacks) == 1 and len(on) >= 1, (r['code'], r['text'], 'shows', len(blacks), 'faces', sorted(got))
        (face,) = [name for name in on if 'face_black_' + name in blacks]
        family = expected_family(r['code'], r['text'])
        assert faces[face]['family'] == family, (r['code'], r['text'], 'shows', face, 'not', family)
        if family in ('no_stopping', 'no_parking'):
            assert face.endswith('_hours') == bool(hours_pattern.search(r['text'])), (r['code'], r['text'], face)
        arrow = sign['plate_arrows'].get(r['arrow'], {}).get(faces[face]['plate'])
        extra = got - set(faces[face]['parts']) - {'post'}
        assert extra == ({arrow} if arrow else set()), (r['code'], r['arrow'], sorted(extra))
        assert ('post' in got) == ('post' not in r.get('without', ())), r
        tally[face] = tally.get(face, 0) + 1
    assert the_plan.get('plate_faces') == tally, (the_plan.get('plate_faces'), tally)
    # The Blender preview places the same parts: it takes row_without from the apply step.
    stubs = {'bpy': types.ModuleType('bpy'), 'mathutils': types.ModuleType('mathutils')}
    stubs['mathutils'].Matrix = stubs['mathutils'].Vector = object
    saved = {k: sys.modules.get(k) for k in stubs}
    sys.modules.update(stubs)
    try:
        spec = importlib.util.spec_from_file_location('_props_preview', PREVIEW)
        preview = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(preview)
    finally:
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v
    assert preview.row_without is A.row_without, 'the preview picks its own parts'
    source = PREVIEW.read_text()
    assert "r.get('without'" not in source and source.count('row_without(r, ') == 2, 'the preview ignores the plate faces'
    return tally


def check_colliders(props):
    """Collider boxes are Unreal-local like bounds_cm: none sticks out of its prop by more than 10 cm, and the
    leaning bikes' boxes sit on the lean (-Y) side, covering the frame within 6 cm."""
    for key, entry in props.items():
        b = entry['bounds_cm']
        for box in entry.get('colliders_cm', []):
            lo = [c - s / 2 for c, s in zip(box['center'], box['size'])]
            hi = [c + s / 2 for c, s in zip(box['center'], box['size'])]
            over = max(max(bl - l, h - bh) for l, h, bl, bh in zip(lo, hi, b[:3], b[3:]))
            assert over <= 10, (key, 'collider outside the prop', box, b, round(over, 1))
    for key in ('bike_locked', 'bike_gallery'):
        b = props[key]['bounds_cm']
        (box,) = props[key]['colliders_cm']
        y0, y1 = box['center'][1] - box['size'][1] / 2, box['center'][1] + box['size'][1] / 2
        assert abs(y0 - b[1]) <= 6 and abs(y1 - b[4]) <= 6, (key, 'collider off the leaning frame', (y0, y1), b)


def blender_command(python):
    exe = Path(python).name.lower()
    if exe.startswith('blender'):
        return [python, '-b', '--factory-startup', '-P', str(GENERATOR), '--']
    return [python, str(GENERATOR)]


def determinism(python, reference):
    with tempfile.TemporaryDirectory() as tmp:
        outs = []
        for run in ('a', 'b'):
            out = Path(tmp) / run
            subprocess.run(blender_command(python) + ['--out', str(out), '--no-render'], check=True,
                           stdout=subprocess.DEVNULL)
            outs.append({p.name: p.read_bytes() for p in sorted(out.iterdir()) if p.is_file()})
            check(out)
        assert outs[0] == outs[1], sorted(k for k in outs[0] if outs[0][k] != outs[1].get(k))
        if reference is not None:
            fresh = json.loads(outs[0]['manifest.json'])
            old = {b['file']: b['sha256'] for b in reference['batches']}
            new = {b['file']: b['sha256'] for b in fresh['batches']}
            assert old == new, 'committed manifest hashes differ from a fresh build'
        return len(outs[0])


def check_sheet(manifest):
    """The contact sheet holds every prop: 200 x 250 px tiles, 8 per row, one tile per prop plus the eight detail
    tiles (dog parts, coat variants, lamp head, sign blades, parking faces, street corner, gallery deck, october
    curb)."""
    data = SHEET.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', SHEET
    size = int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')
    tiles = manifest['counts']['props'] + 8
    assert size == (1600, 250 * -(-tiles // 8)), (size, tiles)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--blender', default=os.environ.get('NORD_BLENDER_PYTHON'))
    args = parser.parse_args()
    reference = None
    if (PROPS / 'manifest.json').exists() and any(PROPS.glob('*.obj')):
        reference = check(PROPS)
        counts = reference['counts']
        print(f"on-disk props ok: {counts['props']} props, {counts['meshes']} meshes")
        if SHEET.is_file():
            check_sheet(reference)
            print('contact sheet ok:', SHEET.name)
        if PLACEMENTS.is_file():
            tally = check_row_faces(reference)
            print('parking plates ok:', ', '.join(f'{k} {v}' for k, v in sorted(tally.items())))
    else:
        print('no built OBJs on disk; pass --blender to build and check')
    if args.blender:
        files = determinism(args.blender, reference)
        print(f'determinism ok: two builds wrote {files} identical files')
    elif reference is None:
        sys.exit(1)
    print('Plateau props checks passed')


if __name__ == '__main__':
    main()
