"""CPU checks for the Plateau replica streetscape (Streets, Furniture, Soul).

Run from games/nord-unreal:  python3 Scripts/test_plateau_replica.py
Builds the layers twice into temporary directories (the committed Data folder is not touched),
then checks determinism, manifest schema, runtime naming, curb heights, the 300 cm traffic band,
paint heights, OSM parity of stops/crossings/lamps/hydrants, budgets and the apply plan.
"""
import json
import math
from pathlib import Path
import re
import struct
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plateau_replica as replica  # noqa: E402
import apply_plateau_replica as apply_replica  # noqa: E402

HEX = re.compile(r'^#[0-9a-f]{6}$')


def files(directory):
    return {p.relative_to(directory).as_posix(): p.read_bytes() for p in sorted(Path(directory).rglob('*')) if p.is_file()}


def parse_obj(path):
    vs, faces = [], []
    for line in Path(path).read_text().splitlines():
        if line.startswith('v '):
            _, x, y, z = line.split()
            vs.append((float(x), -float(y), float(z)))
        elif line.startswith('f '):
            faces.append([vs[int(t.split('/')[0]) - 1] for t in line.split()[1:]])
    return vs, faces


def f32(v):
    return struct.unpack('f', struct.pack('f', v))[0]


def check_schema(manifest, directory):
    for key in ('layer', 'generator', 'frame', 'batches', 'materials', 'counts', 'source_sha256'):
        assert key in manifest, key
    assert manifest['frame'] == 'x east, y north, cm, z up'
    assert manifest['generator'] == 'Scripts/plateau_replica.py'
    names = set()
    for batch in manifest['batches']:
        for key in ('file', 'mesh', 'material', 'collision', 'triangles', 'bounds_cm', 'sha256'):
            assert key in batch, (key, batch)
        assert batch['mesh'] == 'SM_' + batch['file'][:-4] and batch['mesh'] not in names
        names.add(batch['mesh'])
        assert batch['collision'] in ('none', 'simple', 'complex')
        assert batch['material'] in manifest['materials']
        assert 0 < batch['triangles'] <= replica.MAX_TRIS, batch
        assert len(batch['bounds_cm']) == 6 and all(math.isfinite(v) for v in batch['bounds_cm'])
        assert replica.sha_bytes((directory / batch['file']).read_bytes()) == batch['sha256']
    for key, spec in manifest['materials'].items():
        assert HEX.match(spec['base_color_srgb']), key
        assert 0 <= spec['roughness'] <= 1 and 0 <= spec['metallic'] <= 1
    for rel, digest in manifest['source_sha256'].items():
        assert replica.sha_file(replica.ROOT / rel) == digest, rel


def main():
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        world, results = replica.prepare(a)
        replica.prepare(b)
        fa, fb = files(a), files(b)
        assert fa.keys() == fb.keys() and all(fa[k] == fb[k] for k in fa), \
            'Non-deterministic output: ' + str([k for k in fa if fa.get(k) != fb.get(k)][:5])
        out = Path(a)
        report = {'determinism': f'{len(fa)} files byte-identical across two builds'}

        streets = json.loads((out / 'Streets/manifest.json').read_text())
        soul = json.loads((out / 'Soul/manifest.json').read_text())
        furniture = json.loads((out / 'Furniture/placements.json').read_text())
        furniture_rows = furniture['placements']
        soul_rows = json.loads((out / 'Soul/placements.json').read_text())
        check_schema(streets, out / 'Streets')
        check_schema(soul, out / 'Soul')
        assert json.loads((out / 'Furniture/manifest.json').read_text())['layer'] == 'Furniture'

        # Runtime naming couplings (QuebecGameplay.cpp: SM_Asphalt*, SM_Concrete_Collision*).
        for batch in streets['batches']:
            if batch['material'] in ('asphalt', 'alley'):
                assert batch['mesh'].startswith('SM_Asphalt'), batch['mesh']
                assert batch['collision'] == 'none'
            if batch['material'] == 'sidewalk':
                assert batch['mesh'].startswith('SM_Concrete_Collision') and batch['collision'] == 'complex'
            if batch['collision'] != 'none':
                assert batch['material'] in ('sidewalk', 'yard_grass', 'yard_soil', 'yard_path'), batch
        assert all(b['collision'] == 'none' for b in soul['batches'])

        # Geometry: float32-safe faces, curb tops, paint heights, traffic clearance.
        curb_top_area = curb_other_area = 0.
        asphalt_z, paint_z = set(), set()
        degenerate = 0
        collision_faces = []
        for layer, manifest in (('Streets', streets), ('Soul', soul)):
            for batch in manifest['batches']:
                _, faces = parse_obj(out / layer / batch['file'])
                assert len(faces) == batch['triangles']  # OBJ faces are written as triangle fans
                pts = [p for f in faces for p in f]
                for i in range(3):
                    assert abs(min(p[i] for p in pts) - batch['bounds_cm'][i]) < .02
                    assert abs(max(p[i] for p in pts) - batch['bounds_cm'][3 + i]) < .02
                for face in faces:
                    q = [tuple(f32(v) for v in p) for p in face]
                    for k in range(1, len(q) - 1):
                        u = [q[k][j] - q[0][j] for j in range(3)]
                        v = [q[k + 1][j] - q[0][j] for j in range(3)]
                        cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
                        if math.sqrt(sum(c * c for c in cross)) < 1e-4:
                            degenerate += 1
                    zs = [p[2] for p in face]
                    flat = max(zs) - min(zs) < .01
                    if batch['material'] == 'sidewalk' and min(zs) > 1:
                        a2 = abs(replica.area([p[:2] for p in face]))
                        if all(abs(z - replica.Z_WALK) < .01 for z in zs):
                            curb_top_area += a2
                        else:
                            curb_other_area += a2
                            assert replica.Z_DROP - .01 <= min(zs) and max(zs) <= replica.Z_WALK + .01
                    if batch['material'] == 'asphalt':
                        assert flat
                        asphalt_z.add(round(zs[0], 3))
                    if batch['material'].startswith('paint') and flat and min(zs) < 8:
                        paint_z.add(round(zs[0], 3))
                    if batch['collision'] != 'none':
                        collision_faces.append(face)
                assert max(p[2] for p in pts) <= (replica.Z_WALK + .31 if batch['collision'] != 'none' else 1300), batch
        assert degenerate == 0, f'{degenerate} triangles collapse in float32'
        assert asphalt_z == {replica.Z_ROAD}, asphalt_z
        assert min(paint_z) >= replica.Z_ROAD + .1 - 1e-6 and max(paint_z) <= replica.Z_ROAD + .25, paint_z
        assert 17 <= replica.Z_WALK <= 25
        share = curb_top_area / (curb_top_area + curb_other_area)
        assert share > .95, f'Only {share:.3f} of the sidewalk top sits at the 18 cm curb height'
        report['curb'] = {'top_cm': replica.Z_WALK, 'share_of_sidewalk_top_at_18cm': round(share, 4)}

        # No collision within 300 cm of any traffic segment; traffic curbs >= 540 cm.
        worst = math.inf
        for face in collision_faces:
            worst = min(worst, world.traffic_distance([p[:2] for p in face], 2000))
        assert worst >= replica.CLEAR - .01, f'Collision {worst:.1f} cm from a traffic centreline'
        for s in world.segs:
            if s['traffic'] and not s['excluded']:
                assert s['curbL'] >= 540 and s['curbR'] >= 540, (s['name'], s['curbL'], s['curbR'])
        report['clearance'] = {'min_collision_to_traffic_cm': round(worst, 1), 'collision_faces': len(collision_faces)}
        # Furniture and soul instances that keep collision are clear of the band too.
        for row in furniture['placements'] + soul_rows['placements']:
            assert row['prop'] in replica.PROP_KEYS, row['prop']
            assert all(math.isfinite(v) for v in row['position']) and 0 <= row['yaw'] < 360
            if row['collision']:
                assert world.traffic_distance(row['position'][:2], 2000) >= replica.CLEAR, row

        # Widths: curb-to-curb by street (medians over replica segments).
        widths = {}
        for s in world.segs:
            if not s['excluded'] and s['quad']:
                widths.setdefault(s['name'], []).append(s['curbL'] + s['curbR'])
        median = {k: sorted(v)[len(v) // 2] / 100 for k, v in widths.items() if k}
        for name, lo, hi in (('Rue Rachel Est', 12.5, 16.5), ('Avenue Papineau', 15.5, 19.5),
                             ('Rue Sherbrooke Est', 19.5, 23.5), ('Rue de Mentana', 10.5, 12.5),
                             ('Rue Fabre', 11, 14), ('Rue Garnier', 11, 14)):
            assert lo <= median[name] <= hi, (name, median[name])
        report['curb_to_curb_m'] = {k: round(median[k], 2) for k in ('Rue Rachel Est', 'Avenue Papineau',
                                                                       'Rue Sherbrooke Est', 'Rue de Mentana',
                                                                       'Rue Fabre', 'Rue Garnier',
                                                                       'Avenue du Parc-La Fontaine')}

        # OSM parity: stops, crossings, lamps, hydrants, BIXI, street names.
        sc, fc = streets['counts'], furniture['counts']
        on_network = sc['osm_stop_nodes_inside'] - sc['stop_nodes_off_network']
        assert sc['stop_bars_osm_stop'] == on_network and fc['sign_stop'] == on_network, (sc, fc)
        styled = {(c['way'], c['seg']) for c in world.crossings if c['style']}
        painted = sum(v for k, v in sc.items() if k.startswith('crosswalks_') and k != 'crosswalks_generated_at_stops')
        assert painted >= .85 * len({w for w, _ in styled}), (painted, len(styled))
        assert sc['crosswalks_continental_yellow'] > 0 and sc['crosswalks_lines_white'] > 0
        lamps = sum(1 for r in furniture['placements'] if r['prop'] in ('lamp_cobra', 'lamp_park'))
        excluded = sum(1 for n, t in world.node_tags.items() if t.get('highway') == 'street_lamp' and n in world.nodes
                       and replica.inside(world.latlon[n]) and world.route_near(world.nodes[n]))
        assert lamps == fc['osm_lamps_inside'] - excluded, (lamps, fc['osm_lamps_inside'], excluded)
        hydrant_excl = sum(1 for n, t in world.node_tags.items() if t.get('emergency') == 'fire_hydrant' and
                           n in world.nodes and replica.inside(world.latlon[n]) and world.route_near(world.nodes[n]))
        assert fc['hydrant'] == fc['osm_hydrants_inside'] - hydrant_excl
        docks = {r['osm_node'] for r in furniture['placements'] if r['prop'] == 'bixi_dock'}
        assert len(docks) >= fc['osm_bixi_inside'] - 2
        names = {w['tags'].get('name') for w in world.ways if w['tags'].get('highway') in replica.DRIVE}
        signs = [r for r in furniture['placements'] if r['prop'] == 'sign_street']
        blades = [r['text'][k] for r in signs for k in ('blade_a', 'blade_b')]
        assert len(signs) >= 40 and all(b['full'] in names for b in blades)
        assert all(b['generic'] in ('Rue', 'Avenue', 'Place', 'Boulevard', '') for b in blades)
        assert all(r['text']['blade_a']['full'] != r['text']['blade_b']['full'] for r in signs)
        assert sc['bollards'] > 100 and sc['bike_track_metres'] > 500, 'Rachel cycle track missing'
        assert sc['tree_pits'] > 200 and sc['yards'] > 1000 and sc['fence_metres'] > 2000

        # Soul: every requested ingredient exists, and neighbouring blocks differ.
        so = soul['counts']
        for key in ('asphalt_patches', 'crack_lines', 'potholes', 'gutter_leaf_drifts', 'weed_tufts', 'rust_streaks',
                    'murals', 'chantier_zones', 'utility_poles', 'wire_spans', 'laundry_lines', 'curb_bins',
                    'locked_bikes'):
            assert so[key] > 0, key
        bins = {}
        for row in soul_rows['placements']:
            if row['prop'].startswith('bin_'):
                cell = (math.floor(row['position'][0] / 10000), math.floor(row['position'][1] / 10000))
                bins.setdefault(cell, []).append(round(row['position'][0] % 10000 / 100))
        patterns = [tuple(sorted(v)) for v in bins.values() if len(v) > 3]
        assert len(set(patterns)) == len(patterns), 'Two blocks repeat the same bin arrangement'

        # Budgets.
        assert streets['counts']['triangles'] < 900000 and soul['counts']['triangles'] < 300000
        assert len(streets['batches']) <= 250 and len(soul['batches']) <= 200
        report['budget'] = {'streets_batches': len(streets['batches']), 'streets_triangles': streets['counts']['triangles'],
                            'soul_batches': len(soul['batches']), 'soul_triangles': soul['counts']['triangles'],
                            'furniture_placements': len(furniture['placements']),
                            'soul_placements': len(soul_rows['placements'])}

    # Apply plan against the committed data (when generated): labels, materials and instances.
    if (replica.OUT / 'Streets/manifest.json').is_file():
        the_plan = apply_replica.plan(replica.ROOT)
        labels = [a['label'] for a in the_plan['actors']]
        assert len(labels) == len(set(labels)) and all(l.startswith(apply_replica.PREFIX) for l in labels)
        assert all(m['asset'].startswith(apply_replica.MATERIALS + '/M_Replica_') for m in the_plan['materials'])
        assert all(m['duplicate_of'].startswith('/Game/Plateau/Materials/M_') for m in the_plan['materials'])
        props = json.loads((replica.OUT / 'Props/manifest.json').read_text()) if (replica.OUT / 'Props/manifest.json').is_file() else None
        if props:
            glowing = {k for k, v in props['materials'].items() if v.get('emissive_srgb')}
            planned = {m['key'] for m in the_plan['materials'] if m['layer'] == 'Props' and m['emissive_srgb']}
            assert planned == glowing and all(m['duplicate_of'].endswith('/M_Glow') for m in the_plan['materials']
                                              if m['emissive_srgb']), (planned, glowing)
            slots = props['props']['bixi_dock']['slots']
            docks = [r for r in furniture_rows if r['prop'] == 'bixi_dock']
            bikes = [r for r in furniture_rows if r['prop'] == 'bixi_bike']
            for bike in bikes:
                dock = next(d for d in docks if d['osm_node'] == bike['osm_node'] and d['module'] == bike['module'])
                sx, sy, _ = slots[bike['slot']]['position_cm'][0], slots[bike['slot']]['position_cm'][1], 0
                want = replica.local_to_world(dock['position'][:2], dock['yaw'], (sx, sy))
                assert math.dist(want, bike['position'][:2]) < .05, bike
            assert bikes and len({b['osm_node'] for b in bikes}) >= len({d['osm_node'] for d in docks}) - 2
        report['apply_plan'] = the_plan['counts']
    print(json.dumps(report, indent=1, ensure_ascii=False))
    print('Plateau replica checks passed')


if __name__ == '__main__':
    main()
