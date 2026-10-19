"""CPU checks for the Plateau replica streetscape (Streets, Furniture, Soul).

Run from games/nord-unreal:  python3 Scripts/test_plateau_replica.py
Builds the layers twice into temporary directories (the committed Data folder is not touched),
then checks determinism, manifest schema, runtime naming, curb heights, the 300 cm traffic band,
paint heights, OSM parity of stops/crossings/lamps/hydrants, budgets and the apply plan, including the
greystone and slate textures (Scripts/plateau_textures.py) and their textured materials.
"""
import hashlib
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
import plateau_textures  # noqa: E402

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


def _tri_contains(t, p):
    d1, d2, d3 = (replica._cross(t[0], t[1], p), replica._cross(t[1], t[2], p), replica._cross(t[2], t[0], p))
    return (d1 >= 0 and d2 >= 0 and d3 >= 0) or (d1 <= 0 and d2 <= 0 and d3 <= 0)


class TriIndex:
    def __init__(self, tris, cell=250.):
        self.tris, self.grid = tris, replica.Grid(cell)
        for i, t in enumerate(tris):
            self.grid.add(i, replica.bbox(t))

    def contains(self, p):
        return any(_tri_contains(self.tris[i], p) for i in self.grid.query((p[0], p[1], p[0], p[1])))


def _normal(t):
    u = [t[1][j] - t[0][j] for j in range(3)]
    v = [t[2][j] - t[0][j] for j in range(3)]
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


def wall_orientation(directory, manifest):
    """Every vertical sidewalk face must point out of its slab, and curb faces toward the road."""
    road = []
    for batch in manifest['batches']:
        if batch['material'] == 'asphalt':
            road += [[p[:2] for p in t] for t in parse_obj(directory / batch['file'])[1]]
    road = TriIndex(road)
    totals = {'walls': 0, 'out_of_slab': 0, 'into_slab': 0, 'curb_toward_road': 0, 'curb_away_from_road': 0}
    for batch in manifest['batches']:
        if batch['material'] != 'sidewalk':
            continue
        tris = parse_obj(directory / batch['file'])[1]
        tops, walls = [], []
        for t in tris:
            (walls if abs(replica.area([p[:2] for p in t])) < .5 else tops).append(t)
        # Writer convention: reversed fan plus mirrored y; recover the authored sign from the up-facing tops.
        up = sum(1 for t in tops if _normal(t)[2] > 0)
        assert min(up, len(tops) - up) == 0, f'{min(up, len(tops) - up)} sidewalk tops face down'
        flip = 1 if up else -1
        top_index = TriIndex([[p[:2] for p in t] for t in tops])
        for t in walls:
            n = [flip * v for v in _normal(t)]
            length = math.hypot(n[0], n[1])
            if length < 1e-9:
                continue
            n = (n[0] / length, n[1] / length)
            c = (sum(p[0] for p in t) / 3, sum(p[1] for p in t) / 3)
            out_p, in_p = (c[0] + 4 * n[0], c[1] + 4 * n[1]), (c[0] - 4 * n[0], c[1] - 4 * n[1])
            totals['walls'] += 1
            inside_out, inside_in = top_index.contains(out_p), top_index.contains(in_p)
            totals['out_of_slab'] += inside_in and not inside_out
            totals['into_slab'] += inside_out and not inside_in
            if road.contains(out_p) and not inside_out:
                totals['curb_toward_road'] += 1
            elif road.contains(in_p) and not inside_in:
                totals['curb_away_from_road'] += 1
    return totals


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


def check_textures(the_plan):
    """Greystone and slate: textured duplicates of the brick parent, with the plan listing each PNG and its hashes."""
    A = apply_replica
    assert A.texture_set('Stone', {}) == 'limestone' and A.texture_set('Slate', {}) == 'slate'
    assert A.texture_set('Stone_Cast', {}) is None and A.texture_set('Trim', {}) is None
    assert A.texture_set('limestone_rear', {}) == 'limestone' and A.texture_set('roof_slate', {}) == 'slate'
    assert A.texture_set('Wall', {'texture': A.TEXTURE_ASSETS + '/T_Replica_Slate_diff'}) == 'slate'
    folder = replica.OUT / A.TEXTURES
    index = json.loads((folder / A.TEXTURE_INDEX).read_text())
    textures = {t['asset']: t for t in the_plan['textures']}
    assert len(textures) == len(the_plan['textures']) == the_plan['counts']['textures']
    for t in the_plan['textures']:
        entry = index['sets'][t['set']]
        stored = entry['maps'][t['role']]
        path = replica.OUT / t['file']
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == t['sha256'], t['file']
        width, height, raw = plateau_textures.read_png(data)
        assert hashlib.sha256(raw).hexdigest() == t['raw_sha256'] == stored['raw_sha256'], t['file']
        assert [width, height] == t['size_px'] == entry['size_px'] and width >= 512 and height >= 512
        assert t['asset'] == f'{A.TEXTURE_ASSETS}/{path.stem}' and t['asset'].startswith(A.ASSETS + '/')
        assert (t['srgb'], t['compression'], t['sampler']) == (stored['srgb'], stored['compression'], stored['sampler'])
        assert t['srgb'] == (t['role'] == 'diff') and (t['compression'] == 'TC_NORMALMAP') == (t['role'] == 'nor_dx')
    textured = [m for m in the_plan['materials'] if m.get('texture_set')]
    assert len(textured) == the_plan['counts']['textured_replica_materials']
    specs = {layer: json.loads((replica.OUT / layer / 'manifest.json').read_text()).get('materials', {})
             for layer in {m['layer'] for m in the_plan['materials']}}
    for m in the_plan['materials']:
        spec = specs[m['layer']][m['key']]
        assert bool(m.get('texture_set')) == bool(A.texture_set(m['key'], spec) and not spec.get('emissive_srgb')
                                                   and 'brick' not in (spec.get('texture') or '')
                                                   and 'asphalt' not in (spec.get('texture') or '')), m['asset']
    for m in textured:
        entry = index['sets'][m['texture_set']]
        assert m['duplicate_of'] == A.TEXTURED_PARENT and m['texture_mean'] == 'replica_' + m['texture_set']
        assert sorted(m['textures']) == sorted(A.TEXTURE_ROLES) and all(a in textures for a in m['textures'].values())
        assert all(textures[a]['set'] == m['texture_set'] and textures[a]['role'] == r for r, a in m['textures'].items())
        assert m['mean_linear'] == entry['mean_linear'] and m['tiling'] == entry['tiling']
        assert all(abs(t * s - 1) < 1e-6 for t, s in zip(m['tiling'], entry['tile_m'])), m['asset']
    used = {t['set'] for t in the_plan['textures']}
    assert used == {m['texture_set'] for m in textured}
    plex = replica.OUT / 'Plex/manifest.json'
    if plex.is_file():
        keys = {m['key']: m for m in the_plan['materials'] if m['layer'] == 'Plex'}
        assert keys['Stone'].get('texture_set') == 'limestone' and keys['Slate'].get('texture_set') == 'slate'
        assert not keys.get('Stone_Cast', {}).get('texture_set')
        stone_meshes = [mesh for mesh in the_plan['meshes'] if mesh['material'] == keys['Stone']['asset']]
        slate_meshes = [mesh for mesh in the_plan['meshes'] if mesh['material'] == keys['Slate']['asset']]
        assert stone_meshes and slate_meshes, 'No Plex batch uses the textured stone or slate material'
    return {'textures': {t['asset'].rsplit('/', 1)[1]: {'size_px': t['size_px'], 'sha256': t['sha256'][:16],
                                                        'raw_sha256': t['raw_sha256'][:16]} for t in the_plan['textures']},
            'materials': {m['asset'].rsplit('/', 1)[1]: {'set': m['texture_set'], 'tiling': m['tiling'],
                                                         'duplicate_of': m['duplicate_of'].rsplit('/', 1)[1]}
                          for m in textured}}


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
        walls = wall_orientation(out / 'Streets', streets)
        assert walls['out_of_slab'] >= .9 * walls['walls'], walls
        assert walls['into_slab'] <= .02 * walls['walls'], walls
        assert walls['curb_toward_road'] >= .97 * (walls['curb_toward_road'] + walls['curb_away_from_road']), walls
        report['walls'] = walls
        # Route dashes: apply hides OSM Marking, so the dashes no replica asphalt covers are re-authored.
        uncovered = [f for f in replica.legacy_marking_faces()
                     if world.surfaces.at((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4))[1] != 'road']
        assert 0 < len(uncovered) < 120 and streets['counts']['legacy_route_dashes'] == len(uncovered), \
            (len(uncovered), streets['counts'].get('legacy_route_dashes'))
        report['legacy_route_dashes'] = len(uncovered)
        # They keep the live M_LF_Marking pale yellow (linear .85, .73, .39), not the new white paint.
        legacy = [b for b in streets['batches'] if b['material'] == 'legacy_marking']
        assert legacy and sum(b['triangles'] for b in legacy) == 2 * len(uncovered), legacy
        assert streets['materials']['legacy_marking']['base_color_srgb'] == '#eddea8'
        # Simple concave sidewalk pieces stay (as two triangles); only bow-tie slivers are dropped.
        assert streets['counts']['concave_pieces'] >= 1 and streets['counts']['bowtie_pieces_dropped'] < 40
        quad = [(0, 0), (100, 0), (40, 30), (0, 100)]          # reflex vertex at index 2
        tris = replica.quad_triangles(quad)
        assert all(replica.area(t) > 0 for t in tris) and abs(sum(replica.area(t) for t in tris) - replica.area(quad)) < 1e-6
        # Furniture and soul instances that keep collision are clear of the band too.
        for row in furniture['placements'] + soul_rows['placements']:
            assert row['prop'] in replica.PROP_KEYS, row['prop']
            assert all(math.isfinite(v) for v in row['position']) and 0 <= row['yaw'] < 360
            if row['collision']:
                assert world.traffic_distance(row['position'][:2], 2000) >= replica.CLEAR, row
                # Collider boxes (MAP-PROPS colliders_cm), not just the base point, clear the band.
                for poly in replica.collider_polys(row['prop'], row['position'][:2], row['yaw']):
                    assert world.traffic_distance(poly, 2000) >= replica.CLEAR, (row['prop'], row['position'])

        # Widths: curb-to-curb by street (medians over replica segments).
        widths = {}
        for s in world.segs:
            if not s['excluded'] and s['quad']:
                widths.setdefault(s['name'], []).append(s['curbL'] + s['curbR'])
        median = {k: sorted(v)[len(v) // 2] / 100 for k, v in widths.items() if k}
        for name, lo, hi in (('Rue Rachel Est', 12.5, 16.5), ('Avenue Papineau', 15.5, 19.5),
                             ('Rue Sherbrooke Est', 19.5, 23.5), ('Rue de Mentana', 10, 12.5),
                             ('Rue Fabre', 10, 12.5), ('Rue Garnier', 10, 12.5)):  # spec: plex streets 10-12.5 m
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
                assert math.dist(want, bike["position"][:2]) < .1, bike
            assert bikes and len({b['osm_node'] for b in bikes}) >= len({d['osm_node'] for d in docks}) - 2
        mats = {m['asset']: m for m in the_plan['materials']}
        meshes = {m['asset']: m for m in the_plan['meshes']}
        for inst in the_plan['instances']:
            assert inst['material'] in mats, inst['label']
            if inst['collision']:
                assert meshes[inst['mesh']]['colliders'], inst['label'] + ' collides without simple collision'
        labels_i = [i['label'] for i in the_plan['instances']]
        assert len(labels_i) == len(set(labels_i))
        if props:
            colliding = {r['prop'] for r in furniture_rows + soul_rows['placements'] if r['collision']}
            assert colliding <= {k for k, v in props['props'].items() if v.get('colliders_cm')}, colliding
            assert any(i['collision'] for i in the_plan['instances'])
            assert the_plan['counts']['variant_materials_used'] > len({i['prop'] for i in the_plan['instances']})
        for m in the_plan['materials']:
            if m['key'] in ('asphalt', 'alley') and m['layer'] == 'Streets':
                assert m['duplicate_of'].endswith('/M_Asphalt') and m['texture_mean'] == 'asphalt_02'
            if m['texture_mean']:
                need = max(c / t for c, t in zip(apply_replica.linear(m['base_color_srgb']), m['mean_linear']))
                assert need <= apply_replica.TINT_LIMIT, (m['asset'], need)
        report['textures'] = check_textures(the_plan)
        ini = (replica.ROOT / 'Config/DefaultGame.ini').read_text()
        assert '+DirectoriesToAlwaysCook=(Path="/Game/Plateau/Replica/Props")' in ini, 'Props folder is not always cooked'
        header = (replica.ROOT / 'Source/Quebec/QuebecReplicaInstances.h').read_text()
        source = (replica.ROOT / 'Source/Quebec/QuebecReplicaInstances.cpp').read_text()
        assert apply_replica.INSTANCES_CLASS == '/Script/Quebec.QuebecReplicaInstances'
        assert 'class QUEBEC_API AQuebecReplicaInstances : public AActor' in header
        assert 'SetMobility(EComponentMobility::Static)' in source and 'RootComponent = Instances' in source
        report['apply_plan'] = the_plan['counts']
    print(json.dumps(report, indent=1, ensure_ascii=False))
    print('Plateau replica checks passed')


if __name__ == '__main__':
    main()
