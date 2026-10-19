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
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROPS = ROOT / 'Data/Plateau/ReplicaGeometry/Props'
GENERATOR = ROOT / 'Scripts/blender/plateau_props.py'
REQUIRED = {
    'lamp_cobra', 'lamp_park', 'hydrant', 'sign_stop', 'sign_street', 'sign_oneway', 'sign_parking',
    'bixi_dock', 'bixi_bike', 'bin_recycling', 'bin_compost', 'bin_garbage', 'cone', 'barrier_chantier',
    'utility_pole', 'laundry_line', 'bike_locked', 'ac_unit', 'flower_box', 'bench', 'mailbox',
    'police_lightbar', 'dog_small', 'dog_medium', 'dog_large', 'stroller', 'grocery_bag'}
TARGETS = {'lamp_cobra': 800, 'lamp_park': 800, 'hydrant': 500, 'dog_small': 1500, 'dog_medium': 1500,
           'dog_large': 1500, 'stroller': 1500}
DOG_PARTS = {'body', 'head', 'leg_fl', 'leg_fr', 'leg_rl', 'leg_rr', 'tail'}
VARIANT_PROPS = {'bin_recycling', 'bin_compost', 'bin_garbage', 'utility_pole', 'ac_unit', 'flower_box',
                 'bench', 'bike_locked', 'laundry_line', 'dog_small', 'dog_medium', 'dog_large', 'stroller'}


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
        if entry['kind'] in ('street', 'works', 'park', 'ruelle', 'companion') and key != 'laundry_line':
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
    stop = props['sign_stop']['parts']
    assert {'face_red', 'face_white'} <= set(stop)
    return manifest


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--blender', default=os.environ.get('NORD_BLENDER_PYTHON'))
    args = parser.parse_args()
    reference = None
    if (PROPS / 'manifest.json').exists() and any(PROPS.glob('*.obj')):
        reference = check(PROPS)
        counts = reference['counts']
        print(f"on-disk props ok: {counts['props']} props, {counts['meshes']} meshes")
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
