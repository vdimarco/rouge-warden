"""CPU checks for the Plateau plex fronts (layer ReplicaGeometry/Plex).

    python3 Scripts/test_plateau_plex.py          # fixtures + full district (about 2 minutes)
    python3 Scripts/test_plateau_plex.py --quick  # fixtures only

Run without -I (imports sibling modules). Nothing is written to Data/.
"""
import hashlib
import json
import math
import struct
import sys
import tempfile
from pathlib import Path

import plateau_plex as P


def _row(count=4, width=760, depth=1600, y0=0., height=960., levels='3', start_id=1, street='Rue Fabre'):
    """A row of party-wall plex footprints whose fronts face south (toward -y)."""
    buildings = []
    for i in range(count):
        x = i * width
        buildings.append({'id': str(start_id + i), 'height': height, 'tags': {'building': 'residential', 'building:levels': levels, 'addr:street': street},
                          'points': [(x, y0), (x + width, y0), (x + width, y0 + depth), (x, y0 + depth)]})
    return buildings


def _roads(y_centre, yard, street='Rue Fabre'):
    """A one-way street and its sidewalk; yard = facade to sidewalk centreline minus 1 m."""
    return [{'id': 'r', 'name': street, 'width': 680, 'tags': {'highway': 'residential', 'name': street},
             'points': [(-3000, y_centre), (9000, y_centre)]},
            {'id': 's', 'name': '', 'width': 230, 'tags': {'highway': 'footway', 'footway': 'sidewalk'},
             'points': [(-3000, -(yard + 100)), (9000, -(yard + 100))]}]


def _fixture(yard=230, levels='3', count=4, width=760, roll=None, height=960.):
    buildings = _row(count, width, levels=levels, height=height)
    roads = _roads(-(yard + 100 + 350), yard)
    lots, skipped = P.select_fronts(buildings, roads, set(), roll or {}, {}, ())
    mesh, records, counts = P.build(lots)
    return buildings, lots, skipped, mesh, records, counts


def _local(lot, point):
    a, b = lot['primary']['a'], lot['primary']['b']
    length = math.dist(a, b)
    u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    n = (u[1], -u[0])
    return ((point[0] - a[0]) * u[0] + (point[1] - a[1]) * u[1], (point[0] - a[0]) * n[0] + (point[1] - a[1]) * n[1])


def _newell(face):
    nx = ny = nz = 0.
    for (x0, y0, z0), (x1, y1, z1) in zip(face, face[1:] + face[:1]):
        nx += (y0 - y1) * (z0 + z1)
        ny += (z0 - z1) * (x0 + x1)
        nz += (x0 - x1) * (y0 + y1)
    return nx, ny, nz


def test_selection_and_party_walls():
    buildings, lots, skipped, mesh, records, counts = _fixture()
    assert len(lots) == 4 and not skipped, (len(lots), skipped)
    for lot in lots:
        front = lot['primary']
        assert front['normal'] == (0.0, -1.0) or tuple(round(v, 6) for v in front['normal']) == (0.0, -1.0), front['normal']
        assert abs(front['yard'] - 230) < 1, front['yard']
        assert front['yard_source'].startswith('OSM sidewalk')
        assert lot['storeys'] == 3 and lot['storeys_source'] == 'OSM building:levels'
    # neighbours share party walls: consecutive fronts meet at the shared footprint node, no gap
    ends = sorted((tuple(l['primary']['a']), tuple(l['primary']['b'])) for l in lots)
    for (a0, b0), (a1, b1) in zip(ends, ends[1:]):
        assert math.dist(b0, a1) < 1e-6, (b0, a1)
    # the shared edges between neighbours never get a skin
    shared_x = {760., 1520., 2280.}
    for lot in lots:
        for edge in [lot['primary']] + lot['sides']:
            assert not (edge['a'][0] == edge['b'][0] and edge['a'][0] in shared_x)


def test_orientation_offsets_and_float32():
    buildings, lots, skipped, mesh, records, counts = _fixture()
    lot = lots[0]
    skins = 0
    for material, faces in mesh.groups.items():
        for face in faces:
            for p in face:
                for v in p:
                    assert math.isfinite(v) and abs(struct.unpack('f', struct.pack('f', v))[0] - v) < .01
            nx, ny, nz = _newell(face)
            assert nx * nx + ny * ny + nz * nz > 1e-6, 'degenerate face'
            if material == lot['masonry'] and all(abs(p[1] + P.D_FACE) < 1e-6 for p in face):
                assert ny < 0, 'the masonry face must look at the street'
                skins += 1
    assert skins > 0
    # every front vertex lies in front of the retained wall (d >= D_BACK) below the mass height,
    # except extension walls and roof caps above the mass
    for faces in mesh.groups.values():
        for face in faces:
            for p in face:
                if p[2] < 959 and -0.01 < p[0] < 3040.01 and p[1] > -1:
                    assert p[1] <= -P.D_BACK + 1e-6 or p[1] >= 1599, ('geometry inside the retained mass', p)


def test_stairs_by_setback():
    tight = _fixture(yard=60)
    assert tight[5].get('exterior_stairs', 0) == 0, 'lot-line plexes keep cantilevered balconies only'
    assert tight[5]['balconies'] > 0, 'cantilevered balconies over the public domain'
    curved = _fixture(yard=200, roll={str(i): [1905, 3, 3, 1] for i in range(1, 5)})
    straight = _fixture(yard=380, roll={str(i): [1905, 3, 3, 1] for i in range(1, 5)})
    assert curved[5].get('stair_curved', 0) >= 2, curved[5]
    assert straight[5].get('stair_straight', 0) >= 2 and straight[5].get('stair_curved', 0) == 0, straight[5]
    for _, lots, _, mesh, records, counts in (curved, straight):
        yard = lots[0]['primary']['yard']
        for record in records:
            for stair in record['front']['stairs']:
                assert stair['head'][2] > 300, 'stairs climb to the second floor'
        # nothing with collision leaves the measured front yard (the sidewalk starts at d = yard)
        for face in mesh.groups['Wood_Deck']:
            for p in face:
                assert -p[1] <= yard + .01, ('stair or deck on the sidewalk', p, yard)


def test_dimensions():
    _, lots, _, mesh, records, counts = _fixture(yard=230, roll={str(i): [1905, 3, 3, 1] for i in range(1, 5)})
    for lot, record in zip(lots, records):
        assert 320 <= lot['floor_height'] <= 330
        assert record['floor_height_cm'] == lot['floor_height']
        assert 15 <= lot['raise'] <= 105
    decks = mesh.groups['Wood_Deck']
    # balcony deck tops: horizontal, above the ground floor, at least 1.5 m along the wall
    depths = sorted({round(-min(p[1] for p in face) - P.D_FACE) for face in decks
                     if min(p[2] for p in face) > 300 and max(p[2] for p in face) - min(p[2] for p in face) < .01
                     and max(p[0] for p in face) - min(p[0] for p in face) >= 150})
    assert depths and all(105 <= d <= 152 for d in depths), depths
    tops = [max(p[2] for p in face) for face in mesh.groups.get('Iron', [])]
    assert tops, 'iron railings and stairs exist'
    stairs = [(r, s) for r in records for s in r['front']['stairs']]
    assert stairs and all(abs(s['head'][2] - (r['raise_cm'] + r['floor_height_cm'])) < 1 for r, s in stairs)


def test_storeys_and_mass_cover():
    # roll says two storeys under an untagged 9.6 m mass: one storey is added rather than a 2 m blank parapet
    buildings = _row(2, levels='')
    for b in buildings:
        b['tags'].pop('building:levels')
    roads = _roads(-680, 230)
    lots, _ = P.select_fronts(buildings, roads, set(), {'1': [1905, 2, 2, 1], '2': [1905, 3, 3, 1]}, {}, ())
    assert [l['storeys'] for l in lots] == [3, 3]
    assert lots[0]['storeys_source'].startswith('assessment roll +1')
    assert lots[1]['storeys_source'] == 'assessment roll'
    mesh, records, _ = P.build(lots)
    assert all(r['front']['top_cm'] >= 960 + 15 for r in records), 'the skin covers the retained mass wall'
    # LOD2 fallback uses the calibrated offset, not height / 3.25
    lots, _ = P.select_fronts(buildings, roads, set(), {}, {'1': {'height_cm': 1468, 'city_id': 'x', 'iou': .9}}, ())
    assert lots[0]['storeys'] == 3 and lots[0]['storeys_source'].startswith('municipal LOD2')


def test_wide_footprint_gets_lot_modules():
    _, lots, _, mesh, records, counts = _fixture(count=1, width=1530, yard=380, roll={'1': [1905, 3, 6, 1]})
    assert records[0]['front']['modules'] == 2
    assert records[0]['front']['exterior_stairs'] == 2, 'each 7.6 m module has its own stair'


def test_obj_writer_and_batches():
    _, lots, _, mesh, records, counts = _fixture(yard=230)
    groups, tile = P.batches(mesh)
    assert tile == P.TILE_CM
    assert sum(len(f) - 2 for _, faces in groups.values() for f in faces) == mesh.triangles()
    for name, (material, faces) in groups.items():
        assert name.replace('_', '').isalnum() and name.startswith(material.replace('_', ''))
    with tempfile.TemporaryDirectory() as directory:
        name = sorted(groups)[0]
        path = Path(directory) / 'x.obj'
        P.write_obj(path, 'SM_Plex_' + name, groups[name][1])
        text = path.read_text()
        first = groups[name][1][0]
        v = [line for line in text.splitlines() if line.startswith('v ')][0].split()
        assert (float(v[1]), float(v[2]), float(v[3])) == tuple(round(c, 3) for c in (first[0][0], -first[0][1], first[0][2]))
        assert text.count('\nf ') == sum(len(f) - 2 for f in groups[name][1])
        f = [line for line in text.splitlines() if line.startswith('f ')][0].split()
        assert f[1].startswith('3/') and f[3].startswith('1/'), 'reversed fan, as plateau_mesh writes'


def test_determinism_fixture():
    texts = []
    for _ in range(2):
        _, lots, _, mesh, records, _ = _fixture(yard=200, roll={str(i): [1898, 3, 3, 1] for i in range(1, 5)})
        groups, _ = P.batches(mesh)
        texts.append({k: hashlib.sha256(P.obj_text(k, v[1]).encode()).hexdigest() for k, v in groups.items()})
        texts.append(json.dumps(records, sort_keys=True))
    assert texts[0] == texts[2] and texts[1] == texts[3]


def test_district():
    manifest_path = P.OUT / 'manifest.json'
    committed = json.loads(manifest_path.read_text())
    manifest, stats, fronts, groups = P.prepare(write=False)
    # byte-identical regeneration of every git-ignored OBJ recorded in the committed manifest
    assert manifest['geometry_sha256'] == committed['geometry_sha256'], 'regenerated OBJ bytes differ from the manifest'
    assert manifest['batches'] == committed['batches']
    # schema of the shared output contract
    assert manifest['layer'] == 'Plex' and manifest['generator'] == 'Scripts/plateau_plex.py'
    assert manifest['frame'] == 'x east, y north, cm, z up'
    for batch in manifest['batches']:
        assert set(batch) == {'file', 'mesh', 'material', 'collision', 'triangles', 'bounds_cm', 'sha256'}
        assert batch['sha256'] == manifest['geometry_sha256'][batch['file']]
        assert batch['mesh'] == 'SM_Plex_' + batch['file'][:-4] and batch['material'] in manifest['materials']
        assert batch['collision'] == ('complex' if batch['material'] == 'Wood_Deck' else 'none')
        assert 0 < batch['triangles'] <= 65000 and len(batch['bounds_cm']) == 6
        span = max(batch['bounds_cm'][3] - batch['bounds_cm'][0], batch['bounds_cm'][4] - batch['bounds_cm'][1])
        assert span <= manifest['batching']['tile_cm'] + 3000, (batch['file'], span)
    for key, material in manifest['materials'].items():
        assert material['base_color_srgb'].startswith('#') and len(material['base_color_srgb']) == 7
    # budgets
    total = manifest['counts']['triangles']
    assert total == sum(b['triangles'] for b in manifest['batches']) <= P.TRIANGLE_BUDGET, total
    assert len(manifest['batches']) <= P.MAX_BATCHES
    assert 1200 <= stats['triangles_per_front']['median'] <= 2000, stats['triangles_per_front']
    # coverage: the classic plex streets have fronts now
    for street in ('Rue de Mentana', 'Rue Saint-André', 'Rue Cartier', 'Rue Saint-Christophe', 'Rue Dorion',
                   'Rue Fabre', 'Rue Garnier'):
        assert stats['streets_covered'].get(street, 0) >= 50, (street, stats['streets_covered'].get(street))
    assert stats['fronts'] >= 1250 and stats['fronts'] + stats['skipped_buildings'] == 1407
    # research §17 typology check: >= 70% of 1890-1930 residential fronts on the plex streets have stairs
    streets = ('Rue de Mentana', 'Rue Fabre', 'Rue Garnier', 'Rue Marquette', 'Rue de Brébeuf', 'Rue Saint-André',
               'Rue De Lanaudière')
    sample = [f for f in fronts['fronts'] if f['street'] in streets and not f['commercial']
              and f['kind'] != 'conciergerie' and 1890 <= f['year'] < 1930]
    share = sum(bool(f['stair']) for f in sample) / len(sample)
    assert share >= .7, share
    # stair shape follows the measured setback; mansards are slate
    for f in fronts['fronts']:
        if f['stair'] == 'straight':
            assert f['front']['yard_cm'] >= 105
        if f['stair']:
            assert f['front']['yard_cm'] >= 105
    assert manifest['counts']['mansards'] > 50 and 'Slate' in manifest['materials']
    excluded = P.excluded_ids()
    assert not excluded & {f['id'] for f in fronts['fronts']}, 'route and perimeter fronts stay untouched'
    assert stats['storeys_histogram'].get('3', 0) > stats['storeys_histogram'].get('2', 0) > 0
    print('district', json.dumps({'fronts': stats['fronts'], 'triangles': total, 'batches': len(manifest['batches']),
                                  'tile_cm': manifest['batching']['tile_cm'], 'stair_share_1890_1930': round(share, 3)}))


if __name__ == '__main__':
    tests = [test_selection_and_party_walls, test_orientation_offsets_and_float32, test_stairs_by_setback,
             test_dimensions, test_storeys_and_mass_cover, test_wide_footprint_gets_lot_modules,
             test_obj_writer_and_batches, test_determinism_fixture]
    if '--quick' not in sys.argv:
        tests.append(test_district)
    for test in tests:
        test()
        print('ok', test.__name__)
    print('Plateau plex checks passed')
