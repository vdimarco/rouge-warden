"""CPU checks for the Plateau plex fronts (layer ReplicaGeometry/Plex).

    python3 Scripts/test_plateau_plex.py          # fixtures + full district (about 4 minutes)
    python3 Scripts/test_plateau_plex.py --quick  # fixtures only

Run without -I (imports sibling modules). Nothing is written to Data/.
"""
import hashlib
import json
import math
import re
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
        texts.append({k: hashlib.sha256(P.obj_text(k, v[1], v[0]).encode()).hexdigest() for k, v in groups.items()})
        texts.append(json.dumps(records, sort_keys=True))
    assert texts[0] == texts[2] and texts[1] == texts[3]


# ------------------------------------------------------------------------------------------ rear of the lot
def _alley(y, x0=-3000, x1=9000):
    return {'id': 'al', 'name': '', 'width': 430, 'tags': {'highway': 'service', 'service': 'alley'},
            'points': [(x0, y), (x1, y)]}


def _rear_fixture(alley_from_wall=None, opposite_at=None, count=4, width=760, levels='3', year=1905):
    """A row facing south (front at y = 0, rear wall at y = 1600) with a ruelle or a back-to-back row behind."""
    buildings = _row(count, width, levels=levels)
    roads = _roads(-(230 + 100 + 350), 230)
    if alley_from_wall is not None:
        roads.append(_alley(1600 + alley_from_wall))
    if opposite_at is not None:
        buildings += [{'id': str(100 + i), 'height': 960., 'tags': {'building': 'residential'},
                       'points': [(i * width, 1600 + opposite_at), ((i + 1) * width, 1600 + opposite_at),
                                  ((i + 1) * width, 3200 + opposite_at), (i * width, 3200 + opposite_at)]}
                      for i in range(count)]
    lots, _ = P.select_fronts(buildings, roads, {b['id'] for b in buildings if int(b['id']) >= 100},
                              {str(i): [year, 3, 3, 1] for i in range(1, count + 1)}, {}, ())
    mesh, records, counts = P.build(lots, rear=True)
    return buildings, roads, lots, mesh, records, counts


def _seg_dist(p, a, b):
    return P._nearest(p, a, b)[0]


def _poly_seg(poly, a, b):
    """Distance between a polygon (xy) and a segment."""
    if P._inside(a, poly) or P._inside(b, poly):
        return 0.
    best = min(_seg_dist(p, a, b) for p in poly)
    for p, q in zip(poly, poly[1:] + poly[:1]):
        best = min(best, _seg_dist(a, p, q), _seg_dist(b, p, q))
        d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
        d3 = (q[0] - p[0]) * (a[1] - p[1]) - (q[1] - p[1]) * (a[0] - p[0])
        d4 = (q[0] - p[0]) * (b[1] - p[1]) - (q[1] - p[1]) * (b[0] - p[0])
        if d1 * d2 < 0 and d3 * d4 < 0:
            return 0.
    return best


def _rear_faces(mesh):
    start = getattr(mesh, 'rear_start', {})
    return {m: faces[start.get(m, 0):] for m, faces in mesh.groups.items()}


def _check_reachable(rear, tol=60.):
    """Every deck is reached by a flight from the yard or the deck below; heads and feet touch their decks."""
    decks = sorted(rear['decks'], key=lambda d: d['z'])
    levels = sorted({d['z'] for d in decks})
    flights = rear['flights']
    reached = {0.}
    for flight in sorted(flights, key=lambda f: f['z0']):
        assert flight['z0'] in reached, ('flight starts on an unreached level', flight, reached)
        reached.add(flight['z1'])
        head = flight['head']
        assert abs(head[2] - flight['z1']) < 1, flight
        near = [d for d in decks if abs(d['z'] - flight['z1']) < 1]
        assert near and min(_poly_dist(head[:2], d['quad']) for d in near) <= tol, ('head off its deck', flight)
        if flight['foot'] is not None and flight['z0'] > 0:
            below = [d for d in decks if abs(d['z'] - flight['z0']) < 1]
            assert below and min(_poly_dist(flight['foot'][:2], d['quad']) for d in below) <= tol, ('foot off its deck', flight)
    assert all(z in reached for z in levels), ('deck without a stair', levels, reached)


def _poly_dist(p, poly):
    if P._inside(tuple(p), [tuple(q) for q in poly]):
        return 0.
    return min(_seg_dist(tuple(p), tuple(a), tuple(b)) for a, b in zip(poly, poly[1:] + poly[:1]))


def test_rear_fixture_galleries_and_fence():
    buildings, roads, lots, mesh, records, counts = _rear_fixture(alley_from_wall=1100)
    alley = roads[-1]['points']
    for lot, record in zip(lots, records):
        rear = record['rear']
        kinds = [w['kind'] for w in lot['backs']]
        assert 'rear' in kinds, kinds
        assert [w['kind'] for w in rear['walls']] == kinds, 'every back wall gets a skin or a façade'
        main = [w for w in rear['walls'] if w['galleries']]
        assert len(main) == 1 and main[0]['doors'] == 3, rear['walls']
        # 3 storeys: a gallery on the 2nd and 3rd floors, each reached from the yard
        assert rear['galleries'] == 2 and len(rear['decks']) == 2, rear
        assert rear['stair'] in ('straight', 'spiral')
        _check_reachable(rear)
        floors = P._floor_levels(lot)
        assert sorted(d['z'] for d in rear['decks']) == [round(floors[1], 1), round(floors[2], 1)]
        # the yard is closed toward the ruelle: fence runs, the gate and a shed front cover the lot width
        fence = rear['fence']
        assert fence and fence['lane'] and fence['gate'], fence
        assert fence['covered_cm'] >= fence['lot_width_cm'] - 1, fence
        assert abs(fence['distance_cm'] - (1100 - P.FENCE_FROM_ALLEY)) < 1
        for p in fence['line']:
            assert min(_seg_dist(tuple(p), a, b) for a, b in zip(alley, alley[1:])) >= 280, p
    # rear collision (decks, landings, treads) keeps 300 cm from the ruelle centreline and stays out of the masses
    rear = _rear_faces(mesh)
    assert rear.get('Wood_Deck'), 'rear decks and treads exist'
    for face in rear['Wood_Deck']:
        poly = [p[:2] for p in face]
        assert min(_poly_seg(poly, a, b) for a, b in zip(alley, alley[1:])) >= P.TRAFFIC_CLEAR - .01
    for faces in rear.values():
        for face in faces:
            for p in face:
                assert not (.5 < p[0] < 3039.5 and .5 < p[1] < 1599.5 and p[2] < 950), ('rear geometry inside a mass', p)
    assert counts['rear_galleries'] == 8 and counts['rear_gates'] == 4


def test_rear_spiral_in_a_shallow_yard():
    # ruelle 5.3 m behind the wall: no room for a flight beside the galleries, so a spiral in the end bay
    _, roads, lots, mesh, records, counts = _rear_fixture(alley_from_wall=530)
    alley = roads[-1]['points']
    for record in records:
        rear = record['rear']
        assert rear['stair'] == 'spiral' and rear['galleries'] == 2, rear
        _check_reachable(rear)
        assert rear['fence'] and rear['fence']['covered_cm'] >= rear['fence']['lot_width_cm'] - 1
    for face in _rear_faces(mesh)['Wood_Deck']:
        poly = [p[:2] for p in face]
        assert min(_poly_seg(poly, a, b) for a, b in zip(alley, alley[1:])) >= P.TRAFFIC_CLEAR - .01
    assert counts.get('rear_stairs_spiral') == 4


def test_rear_back_to_back_and_duplex():
    # no ruelle: a row of yards back to back; the fence sits on the mid line, with no gate
    _, _, lots, mesh, records, counts = _rear_fixture(opposite_at=1400, levels='2', year=1912)
    for lot, record in zip(lots, records):
        rear = record['rear']
        assert lot['storeys'] in (2, 3)
        assert rear['galleries'] == lot['storeys'] - 1, (lot['storeys'], rear['galleries'])
        _check_reachable(rear)
        fence = rear['fence']
        assert fence and not fence['lane'] and not fence['gate'] and abs(fence['distance_cm'] - 700) < 1, fence
        for footprint in rear['footprints']:
            assert max(p[1] for p in footprint) <= 1600 + 700 - 30, 'structures stay on this side of the lot line'


def test_rear_leaves_the_front_alone():
    buildings, roads, lots, mesh, records, counts = _rear_fixture(alley_from_wall=1100)
    mesh0, records0, _ = P.build(lots)
    assert [r['front'] for r in records] == [r['front'] for r in records0]
    assert [r['sides'] for r in records] == [r['sides'] for r in records0]
    # front faces come first and are unchanged, apart from the extension band the rear skins replace
    for material, faces in mesh0.groups.items():
        if material not in ('Slate',) and not material.startswith('Brick'):
            assert mesh.groups[material][:len(faces)] == faces, material


def test_rear_determinism():
    texts = []
    for _ in range(2):
        _, _, lots, mesh, records, _ = _rear_fixture(alley_from_wall=900)
        groups, _ = P.batches(mesh)
        texts.append({k: hashlib.sha256(P.obj_text(k, v[1], v[0]).encode()).hexdigest() for k, v in groups.items()})
        texts.append(json.dumps([r['rear'] for r in records], sort_keys=True))
    assert texts[0] == texts[2] and texts[1] == texts[3]


# --------------------------------------------------------------------------------- walls and roofs
def _rows(heights, levels, width=760, depth=1600, start_id=1, street='Rue Fabre', x0=0., tags=None):
    """Party-wall footprints facing south, one height per lot."""
    return [{'id': str(start_id + i), 'height': h, 'tags': dict(tags or {'building': 'residential'}, **{'building:levels': lv, 'addr:street': street}),
             'points': [(x0 + i * width, 0.), (x0 + (i + 1) * width, 0.), (x0 + (i + 1) * width, depth), (x0 + i * width, depth)]}
            for i, (h, lv) in enumerate(zip(heights, levels))]


def _area_xy(face):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(face, face[1:] + face[:1]))) / 2


def _horizontal(face, z=None):
    zs = [p[2] for p in face]
    return max(zs) - min(zs) < .01 and (z is None or abs(zs[0] - z) < .01)


def test_roofs_and_party_parapets():
    # four plexes, the third a storey taller: membrane, gravel or tar over every lot, party parapets that step,
    # a brick skin on the party wall where the tall lot stands over its neighbours, a chimney and a hatch per lot
    buildings = _rows([960., 960., 1280., 960.], ['3', '3', '4', '3'])
    roads = _roads(-(230 + 100 + 350), 230) + [_alley(1600 + 1100)]
    lots, _ = P.select_fronts(buildings, roads, set(), {str(i): [1905, None, 3, 1] for i in range(1, 5)}, {}, ())
    mesh, records, counts = P.build(lots, rear=True)
    tall = records[2]
    levels = {r['id']: r['roof']['z_cm'] for r in records}
    for lot, record in zip(lots, records):
        roof = record['roof']
        assert roof['material'] in P.ROOFS, roof
        assert abs(roof['z_cm'] - P.roof_level(lot, max([record['front']['top_cm']] + [s['top_cm'] for s in record['sides']]))) < .2
        # the roof covers the whole footprint at its level (cap or skin), in the lot's roof material
        area = sum(_area_xy(f) for f in mesh.groups[roof['material']] if _horizontal(f, roof['z_cm'])
                   and all(lot['points'][0][0] - .1 <= p[0] <= lot['points'][1][0] + .1 for p in f))
        assert abs(area - 760 * 1600) < 760 * 1600 * .01, (record['id'], area)
        assert roof['chimney'] and (roof['hatch'] or roof['terrace']), roof
        # party lines: one per neighbour, capped no higher than the front's own top
        assert len(roof['party']) == (1 if record['id'] in ('1', '4') else 2), roof['party']
        for edge in roof['party']:
            assert edge['top_cm'] <= record['front']['top_cm'] + 4.01, (edge, record['front']['top_cm'])
    # the tall lot skins its party walls above both neighbours' roofs; they skin nothing toward it
    assert all(e['skin_from_cm'] is not None and abs(e['skin_from_cm'] - levels[e['neighbour']]) < .2 for e in tall['roof']['party'])
    assert all(e['skin_from_cm'] is None for r in records if r is not tall for e in r['roof']['party'])
    # copings step: the tall lot's coping stands above its neighbours'
    assert min(e['top_cm'] for e in tall['roof']['party']) > max(e['top_cm'] for r in (records[1], records[3]) for e in r['roof']['party']) + 100
    coping_tops = {round(max(p[2] for p in f), 1) for f in mesh.groups['Sheet_Metal'] if _horizontal(f)}
    for record in records:
        for edge in record['roof']['party']:
            assert round(edge['top_cm'], 1) in coping_tops, edge
    # flat roofs are never slate: only sloped mansard faces use Slate, and gallery, shed and garage roofs are metal
    assert not any(_horizontal(f) for f in mesh.groups.get('Slate', []))
    assert not _rear_faces(mesh).get('Slate')
    assert counts['chimneys'] == 4 and counts['party_copings'] == 6 and counts['party_skins'] == 2, counts


def test_roof_terrace_and_mix():
    # deep lots: a seeded few get a deck terrace behind a baluster rail with a stair bulkhead well back from the front
    buildings = _rows([960.] * 40, ['3'] * 40, width=760, depth=1800)
    roads = _roads(-(230 + 100 + 350), 230)
    roads[0]['points'] = [(-3000, roads[0]['points'][0][1]), (40000, roads[0]['points'][0][1])]
    roads[1]['points'] = [(-3000, roads[1]['points'][0][1]), (40000, roads[1]['points'][0][1])]
    lots, _ = P.select_fronts(buildings, roads, set(), {}, {}, ())
    mesh, records, counts = P.build(lots)
    roofs = [r['roof'] for r in records]
    mix = {key: sum(r['material'] == key for r in roofs) for key in P.ROOFS}
    assert mix['Roof_Membrane'] > mix['Roof_Gravel'] > 0, mix
    assert counts.get('roof_terraces', 0) >= 1 and sum(r['terrace'] for r in roofs) == counts['roof_terraces']
    assert all(r['hatch'] != r['terrace'] for r in roofs if r['hatch'] or r['terrace'])
    cards = mesh.groups['Rail_Baluster']
    assert cards and all(len(f) == 4 and abs(max(p[2] for p in f) - min(p[2] for p in f) - P.GUARD_H) < .01 for f in cards)
    # the bulkhead (the tallest Sheet_Metal box on a terrace roof) stands at least BULKHEAD_SETBACK behind the front
    for lot, record in zip(lots, records):
        if record['roof']['terrace']:
            z = record['roof']['z_cm'] + 235
            tops = [f for f in mesh.groups['Sheet_Metal'] if _horizontal(f, z)
                    and lot['points'][0][0] <= min(p[0] for p in f) and max(p[0] for p in f) <= lot['points'][1][0]]
            assert tops and min(min(p[1] for p in f) for f in tops) >= P.BULKHEAD_SETBACK - .1, record['id']


def test_card_uvs():
    # cut-out cards map v from 0 at the lower edge to 1 at the upper edge, whichever way the face is stored
    face = [(0., 0., 100.), (250., 0., 100.), (250., 0., 207.), (0., 0., 207.)]
    for poly in (face, face[::-1]):
        text = P.obj_text('x', [poly], 'Rail_Baluster')
        vts = [tuple(map(float, line.split()[1:])) for line in text.splitlines() if line.startswith('vt ')]
        for p, (u, v) in zip(poly, vts):
            assert v == (0. if p[2] < 150 else 1.), (p, v)
        assert abs(abs(vts[1][0] - vts[0][0]) - 2.5) < 1e-6, 'u runs along the card in metres'
    text = P.obj_text('x', [face], 'Siding_Lap_Grey')
    assert [tuple(map(float, line.split()[1:]))[1] for line in text.splitlines() if line.startswith('vt ')] == [1., 1., 2.07, 2.07]


def test_rear_wall_materials_and_long_walls():
    # an end-of-row plex has a 16 m exposed side wall: a windowed long wall in brick, one window per 4.5 m bay and floor
    _, roads, lots, mesh, records, counts = _rear_fixture(alley_from_wall=1100)
    for lot, record in zip(lots, records):
        floors = P._floor_levels(lot)
        for wall in record['rear']['walls']:
            assert wall['material'] not in ('Trim', 'Wood_Cream', 'Wood_Grey', 'Wood_Green'), wall
            assert wall['material'] in P.BRICKS + P.SIDING, wall
            if wall['kind'] in ('street', 'lane', 'long'):
                assert wall['material'] in P.BRICKS, wall
            assert wall['base'] in ('Parged', 'Stone_Cast') or wall['kind'] == 'street' and wall['base'] == 'Stone', wall
            if wall['kind'] == 'long':
                rows = sum(1 for k in range(lot['storeys']) if floors[k] + P.REAR_HEAD <= wall['top_cm'] - 10)
                assert wall['windows'] == rows * int(wall['width_cm'] // 450) and rows == 3, wall
    assert counts['rear_skins_long'] == 2, counts
    # the rock-faced greystone no longer bases rear or lane skins, and the rear stoops are cast concrete
    for face in _rear_faces(mesh).get('Stone', []):
        assert max(p[2] for p in face) - min(p[2] for p in face) < 30 or min(p[2] for p in face) > 50, face


def test_street_wall_brick_lintels_and_cornice_return():
    # a street wall touching the front corner: front brick, stone sills and lintels, the cornice returning one bay
    _, _, lots, mesh, records, _ = _rear_fixture(alley_from_wall=1100, year=1898)
    lot = dict(lots[0], crown='cornice_metal', masonry='Brick_Buff_Even', year=1898)
    rear = P.Rear(lot, records[0]['front']['top_cm'])
    a = lot['primary']['b']                         # the front's corner, the wall runs back from it
    wall = {'index': 99, 'a': a, 'b': (a[0], a[1] + 1500.), 'width': 1500., 'normal': (1., 0.), 'kind': 'street',
            'clear': 2000., 'alley': None, 'ext0': False, 'ext1': False, 'piece': False}
    m = P.PlexMesh()
    record = {'walls': []}
    rear._author_skin(m, wall, record)
    w = record['walls'][0]
    assert w['material'] == 'Brick_Buff_Even' and w['base'] == 'Stone' and w['windows'] == 3 * 3, w
    assert rear.counts['cornice_returns'] == 1
    zc = P._floor_levels(lot)[-1] + 12
    tops = [f for f in m.groups[lot['paint']] if _horizontal(f, zc + 20)]
    assert tops and max(max(p[1] for p in f) for f in tops) - a[1] == 450. and min(min(p[1] for p in f) for f in tops) < a[1] - P.D_FACE
    heads = {round(z + 75 + min(200, lot['floor_height'] - 118) + 22, 1) for z in P._floor_levels(lot)[:3]}
    lintels = [f for f in m.groups['Stone'] if _horizontal(f) and round(f[0][2], 1) in heads]
    sills = [f for f in m.groups['Stone'] if _horizontal(f) and round(f[0][2], 1) in {round(z + 75, 1) for z in P._floor_levels(lot)[:3]}]
    assert len(lintels) == 9 and len(sills) == 9, (len(lintels), len(sills))


def test_lod2_storeys_check():
    # roll storeys over 6 count only where the LOD2 roof agrees: the Mentana block 356220851 is 9 storeys, not 3
    buildings = _row(1, 1407, depth=4900, levels='')
    buildings[0]['tags'] = {'building': 'apartments'}
    roads = _roads(-(367 + 100 + 350), 367)
    roll = {'1': [1885, 9, 156, 2]}
    lots, _ = P.select_fronts(buildings, roads, set(), roll, {}, (), {'1': {'roof_cm': 3219.8, 'city_id': 'G', 'cover': .97}})
    assert lots[0]['storeys'] == 9 and lots[0]['storeys_source'].startswith('assessment roll, checked'), lots[0]['storeys_source']
    assert lots[0]['crown'] == 'flat' and lots[0]['kind'] == 'conciergerie'
    lots, _ = P.select_fronts(buildings, roads, set(), roll, {}, (), {'1': {'roof_cm': 1100., 'city_id': 'G', 'cover': .9}})
    assert lots[0]['storeys'] == 3 and lots[0]['storeys_source'] == 'default 3 storeys'
    lots, _ = P.select_fronts(buildings, roads, set(), roll, {}, ())
    assert lots[0]['storeys'] == 3


def test_galleries_on_a_long_wall():
    # a deep lot with its back on a party wall and a 15 m side yard: the galleries go on the windowed long wall
    lot_b = {'id': '1', 'height': 960., 'tags': {'building': 'residential', 'building:levels': '3', 'addr:street': 'Rue Fabre'},
             'points': [(0., 0.), (760., 0.), (760., 2400.), (0., 2400.)]}
    behind = {'id': '200', 'height': 960., 'tags': {'building': 'residential'},
              'points': [(-200., 2400.), (2500., 2400.), (2500., 3600.), (-200., 3600.)]}
    west = {'id': '201', 'height': 960., 'tags': {'building': 'residential'},
            'points': [(-760., 0.), (0., 0.), (0., 2400.), (-760., 2400.)]}
    east = {'id': '202', 'height': 960., 'tags': {'building': 'residential'},
            'points': [(2260., 0.), (3000., 0.), (3000., 2400.), (2260., 2400.)]}
    buildings = [lot_b, behind, west, east]
    lots, _ = P.select_fronts(buildings, _roads(-(230 + 100 + 350), 230), {'200', '201', '202'}, {'1': [1905, 3, 3, 1]}, {}, ())
    assert [w['kind'] for w in lots[0]['backs']] == ['long'], lots[0]['backs']
    mesh, records, counts = P.build(lots, rear=True)
    rear = records[0]['rear']
    main = [w for w in rear['walls'] if w['galleries']]
    assert len(main) == 1 and main[0]['kind'] == 'long' and rear['galleries'] == 2 and main[0]['doors'] == 3, rear['walls']
    _check_reachable(rear)
    assert len(rear['footprints']) == 1 and main[0]['modules'] == 1
    for footprint in rear['footprints']:
        assert all(760 <= p[0] <= 760 + 750 for p in footprint), 'galleries stand in the side yard, short of the mid line'
        assert all(p[1] >= 2400 - 763 - .1 for p in footprint), 'one stack, at the back end of the long wall'
    # the rest of the long wall keeps its windows: 3 floors x 3 bays on the 16.4 m ahead of the stack
    assert main[0]['windows'] == 3 * int((2400 - 763) // 450) + 3 * (2 if P.Rear(lots[0], 1e9).two_windows else 1), main[0]


def test_front_steps_reach_the_ground():
    # porch steps are solid: each tread has a riser and two closed sides down to the ground (no floating slabs)
    _, lots, _, mesh, records, counts = _fixture(yard=380, levels='1')
    assert counts['porch_steps'] >= 4, counts
    lot = lots[0]
    treads = [f for m in ('Wood_Deck', 'Stone') for f in mesh.groups.get(m, [])
              if _horizontal(f) and 0 < f[0][2] < lot['raise'] - 5 and max(p[1] for p in f) < -(P.D_FACE + 40)]
    assert treads
    for tread in treads:
        z = tread[0][2]
        x0, x1 = min(p[0] for p in tread), max(p[0] for p in tread)
        sides = [f for m in ('Wood_Deck', 'Stone') for f in mesh.groups.get(m, [])
                 if max(p[0] for p in f) - min(p[0] for p in f) < .01 and min(p[0] for p in f) in (x0, x1)
                 and min(p[2] for p in f) == 0 and abs(max(p[2] for p in f) - z) < .01]
        assert len(sides) >= 2, ('a step floats', tread)
    downward = [f for f in mesh.groups['Wood_Deck'] if _horizontal(f) and 0 < f[0][2] < lot['raise'] - 15
                and max(p[1] for p in f) < -(P.D_FACE + 40) and _newell(f)[2] < 0]
    assert not downward, 'no slab undersides under the porch steps'


def _glass_fixture():
    """An isolated 3-storey mass outside the layer (id 900) with the old card grid on its walls, and a taller
    neighbour flush against its west wall."""
    mass = {'id': '900', 'height': 960., 'tags': {'building': 'yes'},
            'points': [(8000., 5000.), (9000., 5000.), (9000., 6600.), (8000., 6600.)]}
    tall = {'id': '901', 'height': 1600., 'tags': {'building': 'yes'},
            'points': [(7000., 5000.), (8000., 5000.), (8000., 6600.), (7000., 6600.)]}
    cards = []
    pts = mass['points']
    for a, b in zip(pts, pts[1:] + pts[:1]):
        length = math.dist(a, b)
        n = ((b[1] - a[1]) / length, -(b[0] - a[0]) / length)
        for z in range(180, int(mass['height']) - 140, 310):
            for d in range(100, int(length) - 180, 300):
                c = (a[0] + (b[0] - a[0]) * (d + 65) / length + n[0] * 3, a[1] + (b[1] - a[1]) * (d + 65) / length + n[1] * 3)
                cards.append((c, float(z), float(z + 160)))
    return [mass, tall], cards


def test_background_mass_skins_its_glass_cards():
    buildings, cards = _glass_fixture()
    owners = P.card_walls(cards, buildings)
    assert all(o is not None and o[0] == '900' for o in owners)
    masses = P.background_masses(buildings, [], set(), {'900': 'no exposed edge facing a named street'}, cards, owners)
    assert [m['id'] for m in masses] == ['900'], 'the tall neighbour has no cards; the mass with cards is skinned'
    mesh = P.PlexMesh()
    records, counts = P.build_background(mesh, masses, {})
    walls = records[0]['walls']
    assert sorted(w['kind'] for w in walls) == ['long'] * 3, walls     # the west wall stands against the tall one
    assert all(w['windows'] > 0 for w in walls) and counts['windows'] == sum(w['windows'] for w in walls)
    audit, floating = P.glass_audit(cards, owners, buildings, [], records, {})
    assert not floating and set(audit) == {'hidden', 'skin'} and audit['hidden'] == 3 * 5, audit


# ---------------------------------------------------------------------------------------------------- yards pass
def _yard_row(count=30, alley_from_wall=1800., levels='3', year=1905, canopy=None):
    """A long row facing south (front at y = 0, rear wall at y = 1600) with a ruelle behind deep yards."""
    buildings = _row(count, 760, levels=levels)
    roads = _roads(-(230 + 100 + 350), 230)
    for road in roads:
        road['points'] = [(-3000, road['points'][0][1]), (count * 760 + 3000, road['points'][0][1])]
    roads.append(_alley(1600 + alley_from_wall, -3000, count * 760 + 3000))
    lots, _ = P.select_fronts(buildings, roads, set(), {str(i): [year, int(levels), 3, 1] for i in range(1, count + 1)}, {}, ())
    mesh, records, counts = P.build(lots, rear=True, canopy=canopy)
    return buildings, roads, lots, mesh, records, counts


def _vertical(face):
    return max(p[2] for p in face) - min(p[2] for p in face) > .01 and abs(_newell(face)[2]) < 1e-6 * max(1., abs(_newell(face)[0]) + abs(_newell(face)[1]))


def _seg_seg(a, b, c, d):
    """Distance between two segments in the plane."""
    return _poly_seg([a, b], c, d) if math.dist(a, b) > 1e-6 else _seg_dist(a, c, d)


def test_gallery_guards_rails_cards_and_fascia():
    # guards: a 2x4 bottom rail and a capped top rail as geometry, a single baluster card on about 70% of lots and
    # solid boards on the rest, in wood paint, never Trim white; deck edges are a thin painted rim board
    _, _, lots, mesh, records, counts = _yard_row(40)
    rear = _rear_faces(mesh)
    rears = [P.Rear(lot, r['front']['top_cm']) for lot, r in zip(lots, records)]
    assert all(r.paint in P.REAR_PAINT and r.paint != 'Trim' for r in rears) and 'Trim' not in P.REAR_PAINT
    share = sum(r.infill == 'balusters' for r in rears) / len(rears)
    assert .55 <= share <= .85 and {r.infill for r in rears} == {'balusters', 'boards'}, share
    cards = rear['Rail_Baluster']
    low = [r['rear']['fence'] for r in records if r['rear']['fence'] and r['rear']['fence']['edge'] == 'low']
    low_runs = sum(len(f['runs']) for f in low) + sum(f['gate'] for f in low)      # a low fence's gate is a picket card
    assert len(cards) == counts['rear_guard_balusters'] + low_runs, (len(cards), counts['rear_guard_balusters'], low_runs)
    keys = [tuple(sorted(tuple(round(v, 2) for v in p) for p in f)) for f in cards]
    assert len(keys) == len(set(keys)), 'a card is drawn once (the masked material is two-sided)'
    for lot, record, r in zip(lots, records, rears):
        guards = record['rear']['guards']
        assert guards, record['id']
        paint = rear[r.paint]
        for g in guards:
            z1 = g['z1']
            # the cap's top face runs along the guard at its top, and the bottom rail stands 5 cm over the deck
            caps = [f for f in paint if _horizontal(f, z1)
                    and _seg_dist((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), tuple(g['a']), tuple(g['b'])) < 1]
            rails = [f for f in paint if _vertical(f) and abs(min(p[2] for p in f) - g['z0'] - P.RAIL_LOW[0]) < .01
                     and abs(max(p[2] for p in f) - g['z0'] - P.RAIL_LOW[1]) < .01
                     and _seg_dist((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), tuple(g['a']), tuple(g['b'])) < 3]
            assert caps and len(rails) >= 2, (record['id'], g)
            full = abs(z1 - g['z0'] - P.GUARD_H) < .01
            infill = [f for f in cards if _seg_dist((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), tuple(g['a']), tuple(g['b'])) < .5
                      and abs(min(p[2] for p in f) - g['z0']) < .01]
            if r.infill == 'balusters' and full:
                assert len(infill) == 1 and abs(max(p[2] for p in infill[0]) - z1) < .01, (record['id'], g)
            else:
                assert not infill, (record['id'], g)
    # the deck edges: thin boards (4 cm) with a 10 cm painted rim board, no 18 cm slab edge any more
    levels = {round(d['z'], 1) for r in records for d in r['rear']['decks']}
    edges = [f for f in rear['Wood_Deck'] if _vertical(f) and round(max(p[2] for p in f), 1) in levels]
    assert edges and all(max(p[2] for p in f) - min(p[2] for p in f) <= P.DECK_T + .01 for f in edges)
    rims = [f for m in P.REAR_PAINT for f in rear.get(m, []) if _vertical(f)
            and abs(max(p[2] for p in f) - min(p[2] for p in f) - P.FASCIA_H) < .01]
    assert len(rims) >= counts['rear_galleries'], (len(rims), counts['rear_galleries'])


def test_guards_cut_where_flights_pass():
    # four storeys, straight stacks: the guard across the high end of each deck opening is cut down where the next
    # flight passes over it, and no guard (rails, card or boards) stands across any flight's treads
    _, _, lots, mesh, records, counts = _yard_row(12, levels='4', alley_from_wall=2000.)
    rear = _rear_faces(mesh)
    straight = [r for r in records if r['rear']['stair'] == 'straight']
    assert straight and all(len(r['rear']['decks']) == 3 for r in straight)
    cut = 0
    for record in straight:
        guards = record['rear']['guards']
        cut += sum(1 for g in guards if g['z1'] - g['z0'] < P.GUARD_H - 1)
        decks = {d['z'] for d in record['rear']['decks']}
        treads = [f for f in rear['Wood_Deck'] if _horizontal(f) and round(f[0][2], 1) not in decks
                  and _area_xy(f) < 90 * 30 and any(_poly_dist((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), fp) < 1
                                                    for fp in record['rear']['footprints'])]
        assert treads, record['id']
        for g in guards:
            for tread in treads:
                z = tread[0][2]
                if g['z0'] + 1 < z < g['z1'] - .5:
                    poly = [p[:2] for p in tread]
                    assert _poly_seg(poly, tuple(g['a']), tuple(g['b'])) > 1, ('a guard across a flight', record['id'], g, z)
    assert cut >= len(straight), cut


def test_ground_galleries_on_lattice_skirts():
    # some straight stacks swap the concrete stoop for a low ground-floor gallery: thin deck, rim board, a lattice
    # skirt kept 1 m tall (its foot below grade), solid steps down to the yard and a guard from 60 cm up
    _, _, lots, mesh, records, counts = _yard_row(40)
    rear = _rear_faces(mesh)
    with_deck = [r for r in records if r['rear'].get('ground_decks')]
    assert 3 <= len(with_deck) <= 30 and counts['rear_ground_galleries'] == sum(len(r['rear']['ground_decks']) for r in with_deck)
    lattice = rear['Rail_Lattice']
    # the other lattice cards are the gallery privacy screens, two 1 m cards each, and the bands of lattice-topped fences
    assert len(lattice) == counts['rear_lattice_skirts'] + 2 * counts.get('rear_partitions_lattice', 0) \
        + counts.get('rear_lattice_tops', 0)
    for record in with_deck:
        assert record['rear']['stair'] == 'straight' and len(record['rear']['decks']) == 2
        for g in record['rear']['ground_decks']:
            lot = next(l for l in lots if l['id'] == record['id'])
            assert abs(g['z'] - lot['raise']) < .1 and g['steps'] == math.ceil(lot['raise'] / 20.) - 1
            skirts = [f for f in lattice if abs(max(p[2] for p in f) - (g['z'] - P.FASCIA_H)) < .01
                      and _poly_dist((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), g['quad']) < 5]
            assert len(skirts) == g['skirts'] >= 3, (record['id'], len(skirts))
            for f in skirts:
                assert abs(max(p[2] for p in f) - min(p[2] for p in f) - P.SKIRT_H) < .01, 'drawn 1 m tall'
            # the steps reach the yard inside the footprint, and the guard follows the deck height
            assert any(_poly_dist(g['foot'][:2], fp) < 30 for fp in record['rear']['footprints'])
            low = [x for x in record['rear']['guards'] if abs(x['z0'] - g['z']) < .1]
            assert bool(low) == g['guard'] == (g['z'] >= 60), (record['id'], g)
    # no concrete stoop where the ground gallery stands (one stoop per module otherwise; every raise here is >= 25)
    modules = [(w['modules'], bool(r['rear'].get('ground_decks'))) for r in records for w in r['rear']['walls'] if w['galleries']]
    assert counts['rear_stoops'] == sum(m for m, ground in modules if not ground), counts['rear_stoops']


def test_spiral_treads_stringer_rail_balusters():
    # each wooden tread top has an iron pan under it; a helical outer stringer and rail; a baluster on every
    # second tread, none at the deck exits
    _, roads, lots, mesh, records, counts = _rear_fixture(alley_from_wall=530)
    rear = _rear_faces(mesh)
    treads = counts['rear_spiral_treads']
    tops = [f for f in rear['Wood_Deck'] if _horizontal(f) and _newell(f)[2] > 0 and _area_xy(f) < 1200]
    pans = [f for f in rear['Iron'] if _horizontal(f) and _newell(f)[2] < 0 and _area_xy(f) < 1200]
    assert treads > 100 and len(tops) == treads and len(pans) == treads, (treads, len(tops), len(pans))
    top_keys = {tuple(sorted((round(p[0], 1), round(p[1], 1), round(p[2] - 4, 1)) for p in f)) for f in tops}
    assert all(tuple(sorted((round(p[0], 1), round(p[1], 1), round(p[2], 1)) for p in f)) in top_keys for f in pans), 'pans sit 4 cm under the treads'
    assert treads // 2 - 4 * len(records) * 3 <= counts['rear_spiral_balusters'] <= treads // 2 + len(records), counts
    assert all(any(f['kind'] == 'spiral' for f in r['rear']['flights']) for r in records)
    # the stringer climbs: its faces stand at the spiral's outer radius and rise with the treads
    stringer = [f for f in rear['Iron'] if _vertical(f) and 20 <= max(p[2] for p in f) - min(p[2] for p in f) <= 60
                and len(f) == 4]
    assert len(stringer) >= treads // 2 - 2 * len(records), len(stringer)


def test_fences_posts_cards_gates_and_open_lanes():
    # board fences: one board card per run (weathered, or painted on its own tinted key), 4x4 posts at most 8 ft apart,
    # a flat cap rail; lattice-topped boards with the lattice band over a mid rail; chain-link as stacked mesh cards on
    # galvanised posts; gates painted in a colour of their own; a seeded share of lane edges left open as a gravel
    # parking pad or closed by a low fence
    _, roads, lots, mesh, records, counts = _yard_row(40)
    rear = _rear_faces(mesh)
    alley = roads[-1]['points']
    edges, kinds, keys = {}, {}, set()

    def near_run(faces, a, b):
        return [f for f in faces if _seg_dist((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), a, b) < .5]
    for record in records:
        yard = record['rear']['yard']
        assert yard, record['id']
        edges[yard['edge']] = edges.get(yard['edge'], 0) + 1
        fence = record['rear']['fence']
        if yard['edge'] == 'open':
            assert fence is None and yard['pad'], record['id']
            pad = [tuple(p) for p in yard['pad']]
            assert min(_seg_dist(p, *alley) for p in pad) >= P.FENCE_FROM_ALLEY - 1
            for fp in record['rear'].get('footprints', []):
                assert all(not P._inside(tuple(p), pad) for p in fp) and all(not P._inside(p, [tuple(q) for q in fp]) for p in pad)
            assert yard['area_m2'].get('Yard_Gravel', 0) >= P.PAD_W * P.PAD_D / 1e4 - .01
            continue
        assert fence and fence['edge'] == yard['edge']
        kinds[fence['kind']] = kinds.get(fence['kind'], 0) + 1
        if fence['gate']:
            assert fence['gate_paint'] in P.GATE_PAINT and fence['gate_paint'] != fence['post_paint'], fence
        (x0, y0), (x1, y1) = fence['line']
        for r0, r1 in fence['runs']:
            t0, t1 = r0 / fence['lot_width_cm'], r1 / fence['lot_width_cm']
            a, b = (x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0), (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1)
            if fence['kind'] in ('boards', 'lattice'):
                assert fence['boards'] in P.BOARD_KEYS, fence
                keys.add(fence['boards'])
                top = fence['height_cm'] - (P.LATTICE_TOP + 4 if fence['kind'] == 'lattice' else 0)
                run = near_run(rear[fence['boards']], a, b)
                assert len(run) == 1 and abs(max(p[2] for p in run[0]) - top) < .01, (record['id'], len(run))
                if fence['boards'] != 'Fence_Boards':
                    assert fence['post_paint'] == dict(P.FENCE_PAINTED)[fence['boards']], fence
            if fence['kind'] == 'lattice':
                band = [f for f in near_run(rear['Rail_Lattice'], a, b) if min(p[2] for p in f) > 100]
                assert len(band) == 1 and abs(max(p[2] for p in band[0]) - fence['height_cm']) < .01, record['id']
            if fence['kind'] == 'chain':
                cards = sorted(near_run(rear['Chain_Link'], a, b), key=lambda f: min(p[2] for p in f))
                assert len(cards) == round(fence['height_cm'] / P.CHAIN_CARD) and min(p[2] for p in cards[0]) == 0
                assert abs(max(p[2] for p in cards[-1]) - fence['height_cm']) < .01 and fence['post_paint'] == 'Sheet_Metal'
            if fence['kind'] == 'low':
                assert fence['height_cm'] == P.GUARD_H
                run = [f for f in near_run(rear['Rail_Baluster'], a, b) if min(p[2] for p in f) < .01]
                assert len(run) == 1, record['id']
        span = sum(r1 - r0 for r0, r1 in fence['runs'])
        assert fence['posts'] >= span / P.FENCE_POSTS[fence['kind']][0], (fence['posts'], span)
    assert edges.get('open', 0) >= 2 and edges.get('low', 0) >= 2 and edges.get('fence', 0) >= 20, edges
    # the lane mixes its fences: weathered and painted boards, lattice tops, chain-link and slats along one ruelle
    assert len(set(kinds) - {'low'}) >= 3 and len(keys) >= 3, (kinds, keys)
    # board cards map v 0..1 bottom to top, u along the run in metres; chain-link draws the lattice at chain-link scale
    text = P.obj_text('x', rear['Fence_Boards'][:1], 'Fence_Boards')
    assert sorted({float(l.split()[2]) for l in text.splitlines() if l.startswith('vt ')}) == [0., 1.]
    for key in ('Chain_Link',) + P.BOARD_KEYS:
        assert key in P.CARD_UV and (key == 'Fence_Boards' or 'T_Replica_' in P.MATERIALS[key]['texture']), key
    if rear.get('Chain_Link'):
        face = rear['Chain_Link'][0]
        us = [float(l.split()[1]) for l in P.obj_text('x', [face], 'Chain_Link').splitlines() if l.startswith('vt ')]
        assert abs((max(us) - min(us)) - math.dist(face[0][:2], face[1][:2]) / P.CHAIN_CARD) < 1e-3
    # side fences are board, slat, chain-link or picket fences too (no solid panel of one paint colour left)
    assert counts['rear_side_fence_runs'] > 0 and counts['rear_fence_posts'] > counts['rear_fence_runs'] * 2


def test_lane_fences_vary_lot_by_lot():
    # the fourth pass's local review: both sides of a ruelle read as one continuous 1.8 m brown board fence. Over the
    # lane lots of a long row, no kind and no colour takes more than about a third, neighbours often differ, and the
    # lane gets more garages and sheds on its fence line than the old 10% and 30% draws gave (6 garages district-wide)
    _, roads, lots, mesh, records, counts = _yard_row(60)
    looks = []
    for record in records:
        fence = record['rear']['fence']
        if fence and fence['lane']:
            looks.append((fence['kind'], fence.get('boards', 'Fence_Boards'), fence['post_paint']))
        else:
            looks.append(('open' if (record['rear']['yard'] or {}).get('edge') == 'open' else 'none', None, None))
    fenced = [l for l in looks if l[0] not in ('open', 'none')]
    share = max(fenced.count(l) for l in fenced) / len(fenced)
    assert share <= .35, (share, sorted(set(fenced)))
    natural = sum(1 for l in fenced if l[0] == 'boards' and l[1] == 'Fence_Boards')
    assert natural <= .4 * len(fenced), natural
    assert len({l[0] for l in fenced}) >= 4 and len({l[1] for l in fenced if l[1]}) >= 3, sorted(set(fenced))
    differ = sum(1 for p, q in zip(looks, looks[1:]) if p != q)
    assert differ >= .6 * (len(looks) - 1), differ
    sheds = counts.get('rear_sheds', 0) + counts.get('rear_garages', 0)
    assert counts.get('rear_garages', 0) >= 6 and sheds >= 15, (counts.get('rear_garages'), counts.get('rear_sheds'))
    for record in records:
        if record['rear']['shed']:
            yard = record['rear']['yard']
            sx0, sx1, sd0, sd1 = yard['shed']
            assert abs(sd1 - max(c[4] for c in yard['cells'])) < 1.01, 'the shed or garage front stands on the fence line'


def test_yard_ground_cover():
    # per-lot ground cover: flat patches that never overlap, inside the yard and out of the buildings; lawns, paver
    # patios, soil beds along the fences and walls, gravel parking pads, by a seeded mix
    buildings, _, lots, mesh, records, counts = _yard_row(40)
    rear = _rear_faces(mesh)
    mixes, mats = set(), set()
    for lot, record in zip(lots, records):
        yard = record['rear']['yard']
        mixes.add(yard['mix'])
        cells = yard['cells']
        assert cells, record['id']
        rect = [tuple(p) for p in yard['rect']]
        fd = max(c[4] for c in cells)
        width = math.dist(rect[0], rect[1])
        for mat, x0, x1, d0, d1 in cells:
            mats.add(mat)
            assert mat in P.YARD_GROUND and -.01 <= x0 < x1 <= width + .01 and P.D_FACE + 2 - .01 <= d0 < d1, (mat, x0, x1, d0, d1)
        for i, a in enumerate(cells):
            for b in cells[i + 1:]:
                overlap = (min(a[2], b[2]) - max(a[1], b[1])) * (min(a[4], b[4]) - max(a[3], b[3]))
                assert not (min(a[2], b[2]) > max(a[1], b[1]) + .01 and min(a[4], b[4]) > max(a[3], b[3]) + .01), (a, b, overlap)
        area = sum((c[2] - c[1]) * (c[4] - c[3]) for c in cells)
        shed = yard['shed']
        missing = width * (fd - P.D_FACE - 2) - area - ((shed[1] - shed[0]) * (shed[3] - shed[2]) if shed else 0)
        assert missing < width * 60, (record['id'], missing)
        beds = P.Rear(lot, record['front']['top_cm']).beds
        if beds[0] or beds[1]:
            assert any(m == 'Yard_Soil' and (x0 < 1 or x1 > width - 1) for m, x0, x1, _, _ in cells), record['id']
    assert mixes == {'lawn', 'patio', 'paved', 'gravel', 'garden'} and mats == set(P.YARD_GROUND), (mixes, mats)
    # the patches are flat, face up, and stand a little over the floor; none inside a mass
    for mat in P.YARD_GROUND:
        for face in rear[mat]:
            assert _horizontal(face, P.GROUND_Z[mat]) and _newell(face)[2] > 0
            c = (sum(p[0] for p in face) / 4, sum(p[1] for p in face) / 4)
            assert not any(P._inside(c, b['points']) for b in buildings), c


def test_creepers_are_cutout_cards():
    # creepers on fences and blank walls are Leaf_Creeper cards with a broken outline: convex strips of differing
    # heights with gaps between some, never a flat-colour blob
    _, _, lots, mesh, records, counts = _yard_row(60)
    rear = _rear_faces(mesh)
    strips = rear['Leaf_Creeper']
    assert counts['rear_creepers'] >= 3 and len(strips) == counts['rear_creeper_strips'] >= 3 * counts['rear_creepers']
    assert not any(len(f) == 6 for m in ('Wood_Burgundy', 'Wood_Green') for f in rear.get(m, []) if _vertical(f))
    for face in strips:
        assert len(face) == 5 and _vertical(face) and min(p[2] for p in face) == 0
        tops = sorted(p[2] for p in face)[2:]
        assert tops[-1] > tops[0], 'a peaked, slanted top'
    heights = {round(max(p[2] for p in f), -1) for f in strips}
    assert len(heights) >= 5, heights
    text = P.obj_text('x', strips[:1], 'Leaf_Creeper')
    assert max(float(l.split()[2]) for l in text.splitlines() if l.startswith('vt ')) > 1.0, 'world UVs (v = z in metres)'


def _disc(cx, cy, r, n=24):
    return [[v for k in range(n) for v in (round(cx + r * math.cos(2 * math.pi * k / n)), round(cy + r * math.sin(2 * math.pi * k / n)))]]


def test_yard_trees_from_the_canopy():
    # trees stand where the canopy shows crowns, in yards only, clear of the house, galleries, stairs, fences, pads
    # and the 300 cm traffic clearance; a big crown makes a maple, elm or ash over the roof, a small one a small tree
    count = 24
    canopy = {'polygons': [_disc(760 * k + 380, 1600 + 1150, 650) for k in range(0, count, 3)]
              + [_disc(760 * k + 380, 1600 + 1100, 260) for k in range(1, count, 3)]
              + [_disc(760 * 2 + 380, 1600 + 1800, 500), _disc(4000, -700, 500)]}
    buildings, roads, lots, mesh, records, counts = _yard_row(count, canopy=canopy)
    alley = roads[-1]['points']
    trees = [(r, t) for r in records for t in r['rear']['yard']['trees']]
    assert counts['rear_yard_trees'] == len(trees) >= count // 3, counts.get('rear_yard_trees')
    kinds = {t['kind'] for _, t in trees}
    assert 'small' in kinds and kinds - {'small'}, kinds
    for record, t in trees:
        p = (t['x'], t['y'])
        rect = [tuple(q) for q in record['rear']['yard']['rect']]
        assert P._inside(p, rect), t
        assert set(t) == {'x', 'y', 'z', 'yaw', 'scale', 'kind', 'crown_m', 'height_m'} and t['z'] == 0
        assert .3 <= t['scale'] <= P.TREE_SCALE_MAX and abs(t['scale'] * P.TREE_MESH_H / 100 - t['height_m']) < .01
        assert min(_seg_dist(p, a, b) for a, b in zip(alley, alley[1:])) >= P.TRAFFIC_CLEAR, t
        assert min(_poly_dist(p, [tuple(q) for q in b['points']]) for b in buildings) >= P.TREE_CLEAR['wall'] - .01
        for fp in record['rear'].get('footprints', []):
            assert _poly_dist(p, fp) >= P.TREE_CLEAR['structure'] - 1, t
        if record['rear']['yard']['pad']:
            assert _poly_dist(p, record['rear']['yard']['pad']) >= P.TREE_CLEAR['structure'] - 1
        fence = record['rear']['fence']
        if fence:
            assert _seg_dist(p, *map(tuple, fence['line'])) >= P.TREE_CLEAR['fence']
        if t['kind'] == 'small':
            assert t['crown_m'] < 6 and t['height_m'] < 9
        else:
            assert t['crown_m'] >= 6 and t['height_m'] >= max(12.5, record['rear']['wall_top_cm'] / 100 + 1.5) - .01, t
    # no tree from the crown over the lane or the one in the street's front yards
    assert all(t['y'] < 1600 + 1800 - 300 and t['y'] > 1600 for _, t in trees)
    doc = P.yard_trees_document(records)
    assert all(set(row) == {'x', 'y', 'z', 'yaw', 'scale', 'kind'} for row in doc['trees']) and len(doc['trees']) == len(trees)
    again = _yard_row(count, canopy=canopy)[4]
    assert P.yard_trees_document(again) == doc, 'deterministic'
    # no canopy, no trees
    assert _yard_row(6)[5]['rear_yard_trees'] == 0


def test_canopy_raster_and_projection():
    # the even-odd fill keeps holes; the chamfer distance grows into a crown; MTM 8 round-trips; the clip keeps
    # only polygons over the district, in the map frame
    square = [[(0, 0), (1000, 0), (1000, 1000), (0, 1000)], [(400, 400), (600, 400), (600, 600), (400, 600)]]
    grid = P._fill_polygons([square], (0, 0), 10, 10, 100)
    assert sum(grid) == 100 - 4 and grid[4 * 10 + 4] == 0 and grid[0] == 1
    disc = [[(500 + 450 * math.cos(k / 20 * 2 * math.pi), 500 + 450 * math.sin(k / 20 * 2 * math.pi)) for k in range(20)]]
    grid = P._fill_polygons([disc], (0, 0), 10, 10, 100)
    dist = P._chamfer(grid, 10, 10)
    assert max(dist) == dist[4 * 10 + 4] or max(dist) == dist[5 * 10 + 5]
    assert 9 <= max(dist) <= 15 and min(d for d, g in zip(dist, grid) if g) == 3
    for lat, lon in ((45.5208, -73.5755), (45.5312, -73.5628)):
        e, n = P._mtm8_forward(lat, lon)
        la, lo = P._mtm8_inverse(e, n)
        assert abs(la - lat) < 1e-7 and abs(lo - lon) < 1e-7
    e, n = P._mtm8_forward(45.525, -73.5699)
    assert abs(e - 299339.7) < 1 and abs(n - 5042789.3) < 1, (e, n)
    near = [[[e + dx, n + dy] for dx, dy in ((0, 0), (12, 0), (12, 9), (0, 9), (0, 0))]]
    far = [[[e + 9000 + dx, n + dy] for dx, dy in ((0, 0), (12, 0), (12, 9), (0, 9), (0, 0))]]
    lines = ['{', '"type": "FeatureCollection",', '"features": [']
    for poly in (near, far):
        lines.append(json.dumps({'type': 'Feature', 'properties': {}, 'geometry': {'type': 'Polygon', 'coordinates': poly}}) + ',')
    lines.append(']', )
    lines.append('}')
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'c.geojson'
        path.write_text('\n'.join(lines).replace('{"type": "Feature"', '{ "type": "Feature"'))
        clip = P.clip_canopy(path)
    assert len(clip['polygons']) == 1 and clip['license'] == 'CC BY 4.0' and 'Canopée 2019' in clip['source']
    ring = clip['polygons'][0][0]
    xs, ys = ring[0::2], ring[1::2]
    assert abs(min(xs)) < 5 and abs(min(ys)) < 5 and 1150 < max(xs) < 1250 and 850 < max(ys) < 950, (xs, ys)


# ------------------------------------------------------------------------------------------ walls and collision pass
CAPSULE_R = 42.             # the player capsule (QuebecGameplay.cpp: InitCapsuleSize(42, 96))


def _collision_faces(mesh):
    """Faces that keep collision: Wood_Deck outside the Visual set, and every Collision_Only face."""
    out = []
    for material in P.COLLISION:
        for i, face in enumerate(mesh.groups.get(material, [])):
            if (material, i) not in mesh.visual:
                out.append((material, face))
    return out


def _guard_planes(mesh):
    """Collision_Only faces as (midpoint xy, z0, z1, half length) for matching against guard records."""
    out = []
    for face in mesh.groups.get('Collision_Only', []):
        xs, ys = [p[0] for p in face], [p[1] for p in face]
        out.append(((sum(xs) / 4, sum(ys) / 4), min(p[2] for p in face), max(p[2] for p in face),
                    math.dist(face[0][:2], face[1][:2]) / 2))
    return out


def _deck_reachability(rear, step=10., props=False):
    """On every gallery deck a capsule of CAPSULE_R, kept that far from the mass wall and from every guard of that
    deck (guards collide now), walks from the head of the flight arriving there to the gallery door, and from the
    door to the foot of the flight leaving it. Walkable: the deck quad, and 1 m round each head and foot (landings,
    spiral bays, flight ends); each flight end counts on the nearest deck of its level (one per module). With `props`,
    the deck's whole props floor (`free`) is taken as filled, so the props the lane life puts there can never block
    the way. Returns the failures as (z, what)."""
    failures = []

    def owner(point, z):
        """The deck (one per module and level) a flight end belongs to: the nearest at its level."""
        level = [d for d in rear['decks'] if abs(d['z'] - z) < 1]
        return min(level, key=lambda d: _poly_dist(point[:2], d['quad'])) if level else None
    for deck in rear['decks']:
        z = deck['z']
        q = [tuple(p) for p in deck['quad']]
        length = math.dist(q[0], q[1])
        u = ((q[1][0] - q[0][0]) / length, (q[1][1] - q[0][1]) / length)
        depth = math.dist(q[0], q[3])
        n = ((q[3][0] - q[0][0]) / depth, (q[3][1] - q[0][1]) / depth)
        o = (q[0][0] - n[0] * P.D_FACE, q[0][1] - n[1] * P.D_FACE)          # the mass wall line, d = 0

        def local(p):
            return ((p[0] - o[0]) * u[0] + (p[1] - o[1]) * u[1], (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1])
        # a flight's head point lies a half tread past its top tread, which on the narrowest straight stacks is just
        # past the gallery's end: the capsule meets it at the gallery end
        heads = [(min(max(h[0], 0.), length), h[1]) for h in
                 (local(f['head']) for f in rear['flights'] if abs(f['z1'] - z) < 1 and owner(f['head'], z) is deck)]
        feet = [local(f['foot']) for f in rear['flights'] if f['foot'] and abs(f['z0'] - z) < 1
                and owner(f['foot'], z) is deck]
        door = local(deck['door'])
        guards = [(local(g['a']), local(g['b'])) for g in rear['guards'] if abs(g['z0'] - z) < 1]
        filled = [[local(p) for p in q] for q in deck.get('free', ())] if props else []
        filled = [(q, min(p[0] for p in q), max(p[0] for p in q), min(p[1] for p in q), max(p[1] for p in q))
                  for q in filled]
        x0 = min([0.] + [p[0] for p in heads + feet]) - 110
        x1 = max([length] + [p[0] for p in heads + feet]) + 110
        d1 = max([P.D_FACE + depth] + [p[1] for p in heads + feet]) + 110
        nx, nd = int((x1 - x0) / step) + 1, int(d1 / step) + 1

        def free(i, j):
            x, d = x0 + i * step, j * step
            inside = 0 <= x <= length and P.D_FACE <= d <= P.D_FACE + depth
            if not inside and not any(math.dist((x, d), p) <= 100 for p in heads + feet):
                return False
            if d < CAPSULE_R:
                return False
            for a, b in guards:
                if min(a[0], b[0]) - CAPSULE_R <= x <= max(a[0], b[0]) + CAPSULE_R and \
                        min(a[1], b[1]) - CAPSULE_R <= d <= max(a[1], b[1]) + CAPSULE_R and \
                        _seg_dist((x, d), a, b) < CAPSULE_R - 1:
                    return False
            for q, qx0, qx1, qd0, qd1 in filled:
                if qx0 - CAPSULE_R < x < qx1 + CAPSULE_R and qd0 - CAPSULE_R < d < qd1 + CAPSULE_R and \
                        _poly_dist((x, d), q) < CAPSULE_R - 1:
                    return False
            return True
        cells = {(i, j) for i in range(nx) for j in range(nd) if free(i, j)}

        def nearest(p, reach):
            best = min(cells, key=lambda c: (math.dist((x0 + c[0] * step, c[1] * step), p), c), default=None)
            return best if best and math.dist((x0 + best[0] * step, best[1] * step), p) <= reach else None
        start = nearest(door, 15.)
        if start is None:
            failures.append((z, 'no room in front of the door'))
            continue
        seen, todo = {start}, [start]
        while todo:
            i, j = todo.pop()
            for c in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if c in cells and c not in seen:
                    seen.add(c)
                    todo.append(c)
        for what, points in (('head', heads), ('foot', feet)):
            for p in points:
                # a capsule's reach: at a short landing the top tread lies within a radius of the end guard
                cell = nearest(p, CAPSULE_R + 5)
                if cell is None or cell not in seen:
                    failures.append((z, what))
    return failures


def test_traffic_band_takes_whole_units_out_of_collision():
    # a traffic centreline through the front yards: the porch steps and each straight stair, with the stair-head
    # balcony it reaches, come within 300 cm, so those units go to no-collision Visual batches whole; the upper
    # balconies farther from the traffic keep collision; nothing that collides stays inside the band
    buildings = _row(4, 760, levels='3')
    roads = _roads(-(380 + 100 + 350), 380)
    lots, _ = P.select_fronts(buildings, roads, set(), {str(i): [1905, 3, 3, 1] for i in range(1, 5)}, {}, ())
    traffic = [((-3000., -420.), (9000., -420.))]
    mesh, records, counts = P.build(lots, rear=True, traffic=traffic)
    assert counts['traffic_band_units'] >= 8 and counts['traffic_band_visual_faces'] > 0, counts
    for material, face in _collision_faces(mesh):
        assert min(P._poly_seg([p[:2] for p in face], a, b) for a, b in traffic) >= P.TRAFFIC_CLEAR - .01, (material, face)
    kinds = {}
    for unit, faces in mesh.unit_faces.items():
        decks = {f in mesh.visual for f in faces if f[0] == 'Wood_Deck'}
        assert len(decks) <= 1, ('half a unit out of collision', unit)
        kinds.setdefault(unit[-1] if unit[0] == 'front' and unit[-1] in ('stair', 'porch') else 'other', set()).update(decks)
        if unit[0] == 'front' and unit[-1] == 'stair' and decks == {True}:
            # the head balcony and its rail collision went with the stair
            assert any(mesh.groups['Wood_Deck'][i][0][2] > 300 for m, i in faces if m == 'Wood_Deck')
    assert kinds['stair'] == {True} and kinds['porch'] == {True}, kinds
    assert False in kinds['other'], 'the upper balconies and the rear keep their collision'
    # batching: the visual faces sit in WoodDeckVisual batches that report no collision
    groups, _ = P.batches(mesh)
    visual = [k for k in groups if k.startswith('WoodDeck' + P.VISUAL)]
    assert visual and all(P.batch_collision(k, groups[k][0]) == 'none' for k in visual)
    assert sum(len(groups[k][1]) for k in visual) == len(mesh.visual)
    assert all(P.batch_collision(k, m) == 'complex' for k, (m, _) in groups.items() if m in P.COLLISION and k not in visual)
    # with no traffic nothing moves
    mesh2, _, counts2 = P.build(lots, rear=True)
    assert not mesh2.visual and 'traffic_band_units' not in counts2


def test_gallery_guards_collide_and_exits_stay_open():
    # every guard run (outer edges, ends, landings, opening edges, ground galleries) has an invisible Collision_Only
    # wall as high as the guard; each inner flight's open side has a sloped one; and on narrow lots, where the top
    # landing is short, the opening guard stops short, so a player still gets from every flight head to the door
    for width, count, levels in ((760, 40, '3'), (470, 24, '3'), (520, 16, '4')):
        buildings = _row(count, width, levels=levels)
        roads = _roads(-(230 + 100 + 350), 230)
        for road in roads:
            road['points'] = [(-3000, road['points'][0][1]), (count * width + 3000, road['points'][0][1])]
        roads.append(_alley(1600 + 2000., -3000, count * width + 3000))
        lots, _ = P.select_fronts(buildings, roads, set(), {str(i): [1905, int(levels), 3, 1] for i in range(1, count + 1)}, {}, ())
        mesh, records, counts = P.build(lots, rear=True)
        planes = _guard_planes(mesh)
        grid = P.Grid(500)
        for plane in planes:
            grid.add(plane, [plane[0][0]], [plane[0][1]])
        guards = [g for r in records for g in r['rear']['guards']]
        assert guards and counts['rear_guard_collision_runs'] == len(guards), (counts.get('rear_guard_collision_runs'), len(guards))
        for g in guards:
            mid = ((g['a'][0] + g['b'][0]) / 2, (g['a'][1] + g['b'][1]) / 2)
            match = [pl for pl in grid.near(mid[0], mid[1], 10) if math.dist(pl[0], mid) < 2
                     and abs(pl[1] - g['z0']) < .06 and abs(pl[2] - g['z1']) < .06]
            assert len(match) == 2, ('a guard without its two collision faces', g, len(match))
        straight = [r for r in records if r['rear']['stair'] == 'straight']
        inner = sum(1 for r in straight for f in r['rear']['flights'] if f['kind'] == 'straight' and f['z0'] > 0)
        assert counts.get('rear_flight_collision_runs', 0) == inner, (counts.get('rear_flight_collision_runs'), inner)
        failures = [(r['id'], f) for r in records if r['rear']['galleries'] for f in _deck_reachability(r['rear'])]
        assert not failures, failures[:10]
        if width == 470:
            assert straight, 'the narrow lots must exercise the short top landing'
    # front stair-head balconies: their rails collide on the closed sides
    _, lots, _, mesh, records, counts = _fixture(yard=380, roll={str(i): [1905, 3, 3, 1] for i in range(1, 5)})
    assert counts.get('rail_collision_runs', 0) == 2 * counts['stair_straight'], counts


def _mentana_block(storeys='', year=1885, bid='356220851', alley=True):
    """The deep Mentana block (14 x 49 m, apartments, the roll's 9 storeys checked against its 32 m LOD2 roof), its
    back on a neighbour, a ruelle 10 m off its east long wall and open ground to the west."""
    block = {'id': bid, 'height': 960., 'tags': {'building': 'apartments'},
             'points': [(0., 0.), (1407., 0.), (1407., 4900.), (0., 4900.)]}
    behind = {'id': '900', 'height': 960., 'tags': {'building': 'residential'},
              'points': [(-300., 4900.), (1700., 4900.), (1700., 6400.), (-300., 6400.)]}
    roads = _roads(-(367 + 100 + 350), 367, street='Rue de Mentana')
    if alley:
        roads.append({'id': 'al', 'name': '', 'width': 430, 'tags': {'highway': 'service', 'service': 'alley'},
                      'points': [(1407. + 1015., -200.), (1407. + 1015., 4800.)]})
    roll = {bid: [year, 9, 158, 2]}
    lots, _ = P.select_fronts([block, behind], roads, {'900'}, roll, {}, (),
                              {bid: {'roof_cm': 3219.8, 'city_id': 'G', 'cover': .97}})
    mesh, records, counts = P.build(lots, rear=True)
    return [block, behind], roads, lots, mesh, records, counts


def test_build_year_override_and_post1945_kit():
    # OSM way 356220851 is the OMHM's Habitations De Mentana (in operation since 1974), not an 1885 building: the
    # override table gives it 1974 and red brick, so it takes the post-1945 kit (its own form on top of it is
    # test_mentana_slab_form). The kit itself, on a block whose roll gives 1974: a balcony slab with a steel guard and
    # a patio door on every bay of every upper floor, wall panels under the windows, a parapet over a lowered roof with
    # a metal coping, a lift penthouse and roof vents, and no siding anywhere
    assert P.BUILD_YEAR_OVERRIDES['356220851']['year'] == 1974 and 'omhm.qc.ca' in P.BUILD_YEAR_OVERRIDES['356220851']['source']
    _, _, lots, _, records, _ = _mentana_block()
    assert lots[0]['year'] == 1974 and lots[0]['era_source'].startswith('override: OMHM') and lots[0]['masonry'] == 'Brick_Red'
    assert lots[0]['modern'] and lots[0]['storeys'] == 9 and records[0]['kit'] == 'post-1945 apartment' and records[0]['year_override']
    buildings, roads, lots, mesh, records, counts = _mentana_block(bid='1', year=1974)
    lot, record = lots[0], records[0]
    assert lot['year'] == 1974 and lot['era_source'] == 'assessment roll' and 'form' not in lot
    assert lot['modern'] and lot['storeys'] == 9 and record['kit'] == 'post-1945 apartment' and not record.get('form')
    bays = max(1, round(lot['primary']['width'] / P.MODERN_BAY))
    sides = sum(max(1, round(s['width'] / P.MODERN_BAY)) for s in lot['sides'])
    assert counts['modern_fronts'] == 1 and counts['modern_balconies'] == bays * 8, (counts['modern_balconies'], bays)
    assert counts['patio_doors'] == counts['modern_balconies'] and counts['wall_panels'] == counts['modern_windows'] > 0
    assert counts.get('side_modern_balconies', 0) == sides * 8 and counts['modern_entrances'] == 1
    # the long walls carry balconies too, the rear gets no wooden galleries, and nothing is lap siding
    walls = record['rear']['walls']
    longs = [w for w in walls if w['kind'] == 'long']
    assert len(longs) == 2 and all(w['balconies'] == round(w['width_cm'] / P.MODERN_BAY) * 8 for w in longs), longs
    assert record['rear']['galleries'] == 0 and record['rear']['reason'].startswith('post-1945')
    assert all(w['material'] == lot['masonry'] for w in walls) and not any(mesh.groups.get(k) for k in P.SIDING)
    # slabs: 15 cm concrete, 1.3 m deep, one per balcony; the parapet stands 80 cm over the roof under a coping
    slabs = [f for f in mesh.groups['Stone_Cast'] if _horizontal(f) and _newell(f)[2] < 0 and _area_xy(f) > P.BALCONY_D * 200]
    assert len(slabs) >= counts['modern_balconies'] + counts['rear_modern_balconies'], len(slabs)
    top = record['front']['top_cm']
    assert abs(record['roof']['z_cm'] - (top - P.MODERN_PARAPET)) < .01
    assert all(abs(w['top_cm'] - top) < .01 for w in walls)
    copings = [f for f in mesh.groups['Sheet_Metal'] if _horizontal(f, top + 4)]
    assert len(copings) >= 1 + len(walls), len(copings)
    roof = record['roof']
    assert roof['penthouses'] == 2 and 1 <= roof['vents'] <= 5 and not roof['chimney'] and not roof['hatch'], roof
    # the same block on its roll year alone stays an old flat-parapet conciergerie, with no kit
    _, _, lots2, _, records2, counts2 = _mentana_block(bid='1')
    assert lots2[0]['year'] == 1885 and not lots2[0]['modern'] and 'kit' not in records2[0] and not counts2.get('modern_fronts')


def test_mentana_slab_form():
    # the fourth pass's local review: the Habitations De Mentana had continuous balcony bands with solid guards on both
    # faces and round the corner, and a flush ground floor. The OMHM's April 2009 photo shows balconies about one bay
    # wide in vertical stacks with teal-green open metal railings, red brick bays between grey exposed-concrete piers,
    # a plain grey concrete end wall with no balconies, and a ground floor set back behind concrete columns
    form = P.BUILDING_FORMS['356220851']
    assert form['form'] == 'omhm_slab' and '0845-OMHM-Infochartier-Habitation_De_Mentana' in form['source']
    buildings, roads, lots, mesh, records, counts = _mentana_block()
    lot, record = lots[0], records[0]
    assert lot['form'] == record['form'] == 'omhm_slab' and record['form_source'] == form['source']
    # the end wall: plain exposed concrete with panel joints, an entrance, no balcony and no window above the ground
    assert record['front']['material'] == 'Concrete_Exposed' and counts['slab_end_walls'] == 1
    assert not counts.get('modern_balconies') and not counts.get('modern_windows') and counts['slab_joints'] >= 6
    # no railing or balcony slab stands on the end walls: every one hangs on a long face
    for f in mesh.groups['Rail_Baluster_Teal']:
        x = _local(lot, _centre(f))[0]
        assert x < -P.D_FACE or x > lot['primary']['width'] + P.D_FACE, x
    # the long faces: brick between piers, one balcony stack per structural bay on every upper floor
    longs = [w for w in record['rear']['walls'] if w['kind'] == 'long']
    floors = P._floor_levels(lot)
    upper = sum(1 for z in floors[1:-1] if z + 215 <= record['rear']['wall_top_cm'] - 10)
    assert len(longs) == 2 and upper == 8
    for w in longs:
        n = round(w['width_cm'] / P.SLAB_BAY)
        assert w['material'] == 'Brick_Red' and w['balconies'] == n * upper, (w, n)
    assert counts['rear_slab_piers'] == counts['rear_slab_columns'] == sum(round(w['width_cm'] / P.SLAB_BAY) + 1 for w in longs)
    # every other wall (the heads' sides, the jogs) is exposed concrete with no balcony
    others = [w for w in record['rear']['walls'] if w['kind'] != 'long']
    assert all(w['material'] == 'Concrete_Exposed' and not w['balconies'] for w in others)
    slabs = [f for f in mesh.groups['Stone_Cast'] if _horizontal(f) and _newell(f)[2] < 0
             and P.BALCONY_D * 150 < _area_xy(f) < P.BALCONY_D * 400]
    assert len(slabs) == counts['rear_slab_balconies'] == 2 * 8 * upper, len(slabs)
    # stacks: on each long face the slabs line up in n columns, each about half a bay wide, never across a pier
    for w in longs:
        a, b = w['a'], w['b']
        u = ((b[0] - a[0]) / w['width_cm'], (b[1] - a[1]) / w['width_cm'])
        mine = [f for f in slabs if _seg_dist(_centre(f), a, b) < 400]
        columns = {}
        for f in mine:
            xs = [(p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1] for p in f]
            columns.setdefault(round(min(xs)), []).append(max(xs) - min(xs))
        n = round(w['width_cm'] / P.SLAB_BAY)
        assert len(columns) == n and all(len(v) == upper for v in columns.values()), sorted(columns)
        assert all(P.SLAB_BAY * .35 < width < P.SLAB_BAY * .55 for v in columns.values() for width in v)
    # the railings are open: a teal cut-out card on three sides of each balcony, under a teal cap rail
    cards = mesh.groups['Rail_Baluster_Teal']
    assert len(cards) == 3 * counts['rear_slab_balconies'] and 'Rail_Baluster_Teal' in P.CARD_UV
    assert all(abs(max(p[2] for p in f) - min(p[2] for p in f) - (P.SLAB_RAIL - 4)) < .01 for f in cards)
    assert P.MATERIALS['Rail_Baluster_Teal']['texture'].endswith('T_Replica_Balusters_diff') and mesh.groups['Paint_Teal']
    teal = P.MATERIALS['Paint_Teal']['base_color_srgb']
    r, g, bl = (int(teal[i:i + 2], 16) for i in (1, 3, 5))
    assert g > r + 30 and bl > r + 30 and abs(g - bl) < 20, 'teal green'
    # the ground floor is set back: the upper floors stand SLAB_COLONNADE out over it on a column per pier, the
    # ground-floor windows stay on the skin plane, and every column has a Collision_Only box of its own
    dF = P.D_FACE + P.SLAB_COLONNADE
    for w in longs:
        a, b = tuple(w['a']), tuple(w['b'])
        brick = [f for f in mesh.groups['Brick_Red'] if _vertical(f) and _seg_dist(_centre(f), a, b) < dF + 5
                 and abs(min(_seg_dist(p[:2], a, b) for p in f) - dF) < .5 and max(p[2] for p in f) > 2000]
        assert brick and all(min(p[2] for p in f) >= floors[1] - 40 for f in brick), 'overhang starts at the first floor'
    columns = [f for f in mesh.groups['Concrete_Exposed'] if _vertical(f) and min(p[2] for p in f) == 0
               and max(p[2] for p in f) == floors[1] - 35]
    assert len(columns) == 4 * counts['rear_slab_columns'], len(columns)
    boxes = [u for u in mesh.unit_faces if u[0] == 'slab']
    assert len(boxes) == counts['rear_slab_columns'] and all(len(mesh.unit_faces[u]) == 4 for u in boxes)
    # still the kit's roof and rules: penthouses, no galleries, no siding
    assert record['roof']['penthouses'] == 2 and record['rear']['galleries'] == 0
    assert not any(mesh.groups.get(k) for k in P.SIDING)


def _back_street_row(blocked):
    """Eight plexes facing Rue Fabre, their yards open to a second named street 38 m behind the rear walls (too far to
    be a front of theirs), or (with `blocked`) a row of buildings standing between."""
    buildings = _row(8, 760, levels='3')
    roads = _roads(-(230 + 100 + 350), 230)
    roads.append({'id': 'back', 'name': 'Rue Marie-Anne Est', 'width': 680,
                  'tags': {'highway': 'residential', 'name': 'Rue Marie-Anne Est'},
                  'points': [(-3000, 1600 + 3800), (9000, 1600 + 3800)]})
    if blocked:
        buildings.append({'id': '90', 'height': 960., 'tags': {'building': 'residential'},
                          'points': [(-1500, 2600), (7600, 2600), (7600, 3600), (-1500, 3600)]})
    lots, _ = P.select_fronts(buildings, roads, {'90'}, {str(i): [1905, 3, 3, 1] for i in range(1, 9)}, {}, ())
    mesh, records, counts = P.build(lots, rear=True)
    return lots, records, counts


def test_walls_a_street_sees_are_brick():
    # the fourth pass's local review: a grey siding wall under a red brick storey faced Rachel, more than 6 m behind
    # its own front line, so the old rule allowed it. Any wall a named street sees along a clear line is brick now;
    # the same wall with a building between it and the street keeps its lap siding
    lots, records, counts = _back_street_row(False)
    hidden_lots, hidden, _ = _back_street_row(True)
    sided = [i for i, lot in enumerate(lots) if P.Rear(lot, records[i]['front']['top_cm']).siding]
    assert sided, 'some lots in the row draw lap siding'
    for i in sided:
        rear = [w for w in records[i]['rear']['walls'] if w['kind'] == 'rear']
        assert rear and all(w['material'] in P.BRICKS and 3700 < w['street_seen_cm'] < P.SIGHT_RANGE for w in rear), rear
        kept = [w for w in hidden[i]['rear']['walls'] if w['kind'] == 'rear']
        assert kept and all(w['material'] in P.SIDING and 'street_seen_cm' not in w for w in kept), kept
    assert counts['rear_walls_street_seen'] >= len(sided)
    # the sight test on its own: a wall square to a street 20 m off sees it; a wall facing away or behind a block does
    # not; a glancing view past a corner counts (the Rachel wall stood between two fronts)
    wall = {'a': (0., 0.), 'b': (400., 0.), 'width': 400., 'normal': (0., -1.)}
    street = [((-5000., -2000.), (5000., -2000.))]
    assert abs(P.street_sight(wall, [], street) - (2000 - 25)) < 1
    assert P.street_sight(dict(wall, normal=(0., 1.)), [], street) is None
    block = [(-9000., -1200.), (9000., -1200.), (9000., -900.), (-9000., -900.)]
    assert P.street_sight(wall, [(block, -9000., -1200., 9000., -900.)], street) is None
    gap = [(-9000., -1200.), (-100., -1200.), (-100., -900.), (-9000., -900.)]
    assert P.street_sight(wall, [(gap, -9000., -1200., -100., -900.)], street) is not None, 'seen through a gap'
    side = {'a': (0., 0.), 'b': (0., 1500.), 'width': 1500., 'normal': (1., 0.)}
    assert P.street_sight(side, [], street) is not None and P.street_sight(side, [], street, limit=1500.) is None


def test_cedars_are_crossed_cards():
    # the fourth pass's local review: cedars were dark six-sided cones and hedges dark boxes. A cedar is three crossed
    # Leaf_Cedar cards at 60 degrees, each one tile of the cedar set's drawing (one column per 1 m on a 3 m card), its
    # drawn tip at the cedar's height; a hedge is a row of those columns on cards along both faces, across its ends and
    # across it, over a dark core well under the tips. No cone face is left
    _, _, lots, mesh, records, counts = _yard_row(60)
    rear = _rear_faces(mesh)
    assert counts['rear_cedars'] >= 3 and counts['rear_hedges'] >= 3, (counts.get('rear_cedars'), counts.get('rear_hedges'))
    assert not any(len(f) == 3 for f in rear.get('Wood_Green', [])), 'no cone left'
    cards = rear['Leaf_Cedar']
    assert len(cards) == counts['rear_cedar_cards'] and all(len(f) == 4 and _vertical(f) for f in cards)
    assert 'Leaf_Cedar' in P.CARD_UV and 'texture' not in P.MATERIALS['Leaf_Cedar'], 'a shared key with its own set'
    # one cedar on its own: three cards 60 degrees apart, centred on the trunk, each as wide as a third of its height
    # (the drawing's 1 m by 3 m tile) and as tall as puts the drawn tip at the cedar's height; u 0..1 across the card
    m = P.PlexMesh()
    assert P.cedar(m, (100., 50.), 380., .3) == 3
    faces = m.groups['Leaf_Cedar']
    h = 380. / P.CEDAR_CARD[2]
    angles = sorted(round(math.degrees(math.atan2(f[1][1] - f[0][1], f[1][0] - f[0][0])) % 180) for f in faces)
    assert all(abs((b - a) - 60) <= 1 for a, b in zip(angles, angles[1:])), angles
    for f in faces:
        assert abs(max(p[2] for p in f) - h) < .01 and min(p[2] for p in f) == 0
        assert abs(math.dist(f[0][:2], f[1][:2]) - h / 3) < .01 and math.dist(_centre(f), (100., 50.)) < .01
        text = P.obj_text('x', [f], 'Leaf_Cedar')
        uv = [tuple(map(float, l.split()[1:])) for l in text.splitlines() if l.startswith('vt ')]
        assert sorted(round(u, 4) for u, _ in uv) == [0., 0., 1., 1.] and sorted(v for _, v in uv) == [0., 0., 1., 1.]
    # the widest cedar the yard plan draws stays inside the 75 cm it keeps round the trunk
    assert P.cedar_half_width(420.) <= 75.
    # a hedge: the columns repeat along the long cards at the drawing's aspect (u = length x 3 / card height)
    m2 = P.PlexMesh()
    F = P.Frame(m2, (0., 0.), (100., 0.))
    assert P.hedge(m2, F, 0., 60., 200., 800., 180.) >= 5
    long_cards = [f for f in m2.groups['Leaf_Cedar'] if math.dist(f[0][:2], f[1][:2]) > 500]
    assert len(long_cards) == 2
    us = [float(l.split()[1]) for l in P.obj_text('x', long_cards[:1], 'Leaf_Cedar').splitlines() if l.startswith('vt ')]
    assert abs((max(us) - min(us)) - 600 * 3 / (180. / P.CEDAR_CARD[2])) < 1e-3
    core = [f for f in m2.groups['Wood_Green'] if _horizontal(f)]
    assert core and all(p[2] <= 180. * .6 + .01 for f in core for p in f)


def test_lap_siding_stays_low():
    # lap siding never above the second storey (brick above it, recorded on the wall), and never on a block of
    # five storeys or more
    _, _, lots, mesh, records, counts = _yard_row(40, levels='3')
    rear = _rear_faces(mesh)
    sided = [(lot, r) for lot, r in zip(lots, records) if P.Rear(lot, r['front']['top_cm']).siding]
    assert sided and any(w.get('upper') for _, r in sided for w in r['rear']['walls'])
    tops = {}
    for lot, record in sided:
        for w in record['rear']['walls']:
            if w['material'] in P.SIDING:
                assert w['upper'] in P.BRICKS and abs(w['siding_top_cm'] - P._floor_levels(lot)[2]) < .1, w
                tops[record['id']] = w['siding_top_cm']
    # wall siding stops at the third floor; the only siding above it is the infill of solid gallery guards, between
    # a guard's bottom rail and its cap (test_rear_surfaces covers those)
    infill = P.GUARD_H - P.RAIL_LOW[1] - P.CAP_H
    guards = [g for r in records for g in r['rear']['guards']]
    for key in P.SIDING:
        for face in rear.get(key, []):
            z0, z1 = min(p[2] for p in face), max(p[2] for p in face)
            if z1 - z0 <= infill + .01 and any(abs(z0 - g['z0'] - P.RAIL_LOW[1]) < .01 for g in guards):
                continue
            assert z1 <= max(tops.values()) + .01, face
    _, _, lots5, mesh5, records5, _ = _yard_row(20, levels='5')
    assert any(P.Rear(lot, r['front']['top_cm']).siding is False for lot, r in zip(lots5, records5))
    assert not any(mesh5.groups.get(k) for k in P.SIDING), 'no siding on a block over four storeys'


def test_open_ground_for_yardless_lots():
    # a lot with no yard (the Mentana block: its back on a neighbour) gets ground cover on its open walls: a lawn along
    # each, and asphalt parking with painted stalls where the ruelle lets cars in; never on a building, the ruelle's
    # clearance, another patch or a yard
    buildings, roads, lots, mesh, records, counts = _mentana_block()
    rear = records[0]['rear']
    assert rear['yard'] is None and rear['open_ground'], rear.get('yard_reason')
    ground = rear['open_ground']
    assert ground['area_m2'].get('Yard_Grass', 0) > 50 and ground['area_m2'].get('Asphalt_Lot', 0) > 50, ground['area_m2']
    assert ground['stall_lines'] >= 10 and counts['rear_parking_stall_lines'] == ground['stall_lines']
    alley = roads[-1]['points']
    cells = [[tuple(p) for p in c[1:]] for c in ground['cells']]
    for cell in cells:
        centre = (sum(p[0] for p in cell) / 4, sum(p[1] for p in cell) / 4)
        for b in buildings:
            assert not any(P._inside(p, b['points']) for p in cell + [centre]), cell
        assert min(_seg_dist(p, *alley) for p in cell) >= P.FENCE_FROM_ALLEY - .5, cell
    for i, a in enumerate(cells):
        for b in cells[i + 1:]:
            ca = (sum(p[0] for p in a) / 4, sum(p[1] for p in a) / 4)
            assert not P._inside(ca, b), ('patches overlap', a, b)
    asphalt = mesh.groups['Asphalt_Lot']
    assert asphalt and all(_horizontal(f, P.GROUND_Z['Asphalt_Lot']) and _newell(f)[2] > 0 for f in asphalt)
    lines = [f for f in mesh.groups['Trim'] if _horizontal(f, P.GROUND_Z['Asphalt_Lot'] + .3)]
    assert len(lines) == ground['stall_lines']
    # with no ruelle the strip toward the neighbour stays lawn; open ground to the west still parks cars
    _, _, _, _, records2, _ = _mentana_block(alley=False)
    assert records2[0]['rear']['open_ground']['area_m2'].get('Yard_Grass', 0) > 0


def test_towers_buff_or_brown_with_three_metre_bays():
    # towers (over 24 m) are buff or brown brick, never red, with the post-1945 kit: a window bay about every 3 m on
    # every floor, a balcony on every second bay, and a parapet over the mass roof; the other background skins get
    # a window per 3 m bay instead of 4.5 m
    assert set(P.TOWER_BRICK) <= {'Brick_Brown', 'Brick_BrownDark', 'Brick_Buff_Even'}
    buildings, cards = _glass_fixture()
    tower = dict(buildings[0], id='950', height=3200.)
    tower_cards = []
    pts = tower['points']
    for a, b in zip(pts, pts[1:] + pts[:1]):
        length = math.dist(a, b)
        n = ((b[1] - a[1]) / length, -(b[0] - a[0]) / length)
        for z in range(180, 3000, 320):
            for d in range(100, int(length) - 180, 300):
                c = (a[0] + (b[0] - a[0]) * (d + 65) / length + n[0] * 3, a[1] + (b[1] - a[1]) * (d + 65) / length + n[1] * 3)
                tower_cards.append((c, float(z), float(z + 160)))
    owners = P.card_walls(tower_cards, [tower])
    masses = P.background_masses([tower], [], set(), {'950': 'tower over 24 m'}, tower_cards, owners)
    mass = masses[0]
    assert mass['modern'] and mass['skin_wall'] in P.TOWER_BRICK and mass['parapet_from'] == 3200.
    mesh = P.PlexMesh()
    records, counts = P.build_background(mesh, masses, {})
    record = records[0]
    assert record['kit'] == 'post-1945 apartment' and record['brick'] in P.TOWER_BRICK
    floors = sum(1 for z in P._floor_levels(mass)[:-1] if z + 215 <= mass['wall_top'] - 10)
    for w in record['walls']:
        bays = max(1, round(w['width_cm'] / P.MODERN_BAY))
        assert w['material'] == record['brick'] and w['windows'] == bays * floors, (w, bays, floors)
        assert w['balconies'] == w['doors'] == (bays + 1) // 2 * (floors - 1), w
        assert abs(w['top_cm'] - (3200. + P.TOWER_PARAPET)) < .01
    assert not P.glass_audit(tower_cards, owners, [tower], [], records, {})[1], 'no card floats'
    # an ordinary background mass: one window per 3 m bay and floor
    owners = P.card_walls(cards, buildings)
    masses = P.background_masses(buildings, [], set(), {'900': 'no exposed edge facing a named street'}, cards, owners)
    records, _ = P.build_background(P.PlexMesh(), masses, {})
    floors = sum(1 for z in P._floor_levels(masses[0])[:-1] if z + P.REAR_HEAD <= masses[0]['wall_top'] - 10)
    for w in records[0]['walls']:
        assert w['windows'] == max(1, round(w['width_cm'] / P.BACKGROUND_BAY)) * floors, w


# --------------------------------------------------------------------------------------------- rear-surfaces pass
def _centre(face):
    return (sum(p[0] for p in face) / len(face), sum(p[1] for p in face) / len(face))


def _unit(v):
    length = math.sqrt(sum(c * c for c in v)) or 1.
    return tuple(c / length for c in v)


def _row_with_alley(count, width, levels='3', alley_from_wall=1800., year=1905):
    buildings = _row(count, width, levels=levels)
    roads = _roads(-(230 + 100 + 350), 230)
    for road in roads:
        road['points'] = [(-3000, road['points'][0][1]), (count * width + 3000, road['points'][0][1])]
    roads.append(_alley(1600 + alley_from_wall, -3000, count * width + 3000))
    lots, _ = P.select_fronts(buildings, roads, set(), {str(i): [year, int(levels), 3, 1] for i in range(1, count + 1)}, {}, ())
    mesh, records, counts = P.build(lots, rear=True)
    return buildings, roads, lots, mesh, records, counts


def _shrink(face, by=1.):
    c = _centre(face)
    return [(p[0] + (c[0] - p[0]) * by / max(1e-6, math.dist(p[:2], c)), p[1] + (c[1] - p[1]) * by / max(1e-6, math.dist(p[:2], c)))
            for p in face]


def _overlap(quad, face):
    """A face (shrunk 1 cm) overlaps the convex quad in plan."""
    pts = _shrink(face)
    return any(P._inside(p, quad) for p in pts) or any(_poly_seg(quad, a, b) == 0. for a, b in zip(pts, pts[1:] + pts[:1]))


def test_rear_surfaces_siding_gates_and_windows():
    # local critic 7: solid gallery guards are lap siding with visible laps (cream or grey; a sided lot's own siding),
    # never a flat painted board; a gate leaf is a board card (a picket card on a low fence) on a painted ledge-and-
    # brace frame, never one flat panel; rear window frames are white Trim, with a blind or curtains in front of the
    # dark glass on every window
    _, _, lots, mesh, records, counts = _yard_row(40)
    rear = _rear_faces(mesh)
    rears = [P.Rear(lot, r['front']['top_cm']) for lot, r in zip(lots, records)]
    assert {r.guard_siding for r in rears} == set(P.SIDING) and all(r.frame == 'Trim' for r in rears)
    assert all(r.guard_siding == r.wall for r in rears if r.siding and r.wall in P.SIDING)
    solid = 0
    for record, r in zip(records, rears):
        for g in record['rear']['guards']:
            z0, z1 = g['z0'] + P.RAIL_LOW[1], g['z1'] - P.CAP_H
            a, b = tuple(g['a']), tuple(g['b'])

            def infill(keys):
                return [f for k in keys for f in rear.get(k, []) if _vertical(f) and abs(min(p[2] for p in f) - z0) < .01
                        and abs(max(p[2] for p in f) - z1) < .01 and _seg_dist(_centre(f), a, b) < 1.5]
            if r.infill == 'boards' or g['z1'] - g['z0'] < P.GUARD_H - 1:
                assert len(infill([r.guard_siding])) == 2, (record['id'], g)      # both faces of the siding board
                assert not infill(P.REAR_PAINT), ('a flat painted guard board', record['id'], g)
                solid += 1
            else:
                assert not infill(P.SIDING + P.REAR_PAINT), (record['id'], g)
    assert solid >= 40 and counts['rear_guard_boards'] > 0, solid
    # siding laps run level: on a guard face u runs along the guard and v = z in metres
    text = P.obj_text('x', rear['Siding_Lap_Grey'][:1], 'Siding_Lap_Grey')
    vts = [tuple(map(float, l.split()[1:])) for l in text.splitlines() if l.startswith('vt ')]
    zs = [p[2] for p in rear['Siding_Lap_Grey'][0]]
    assert sorted(round(v, 3) for _, v in vts) == sorted(round(z / 100, 3) for z in zs)
    # gates: one leaf card 92 cm wide from 4 cm up, two painted ledges and a brace, no flat panel of the gate paint
    gates = 0
    for record in records:
        fence = record['rear']['fence']
        if not fence or not fence['gate']:
            continue
        (x0, y0), (x1, y1) = fence['line']
        t = fence['gate_at'] / fence['lot_width_cm']
        g = (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        if fence['kind'] == 'chain':
            # a chain-link gate: mesh cards 92 cm wide from 4 cm up to the frame top, in a galvanised frame
            leaves = sorted((f for f in rear['Chain_Link'] if math.dist(_centre(f), g) < 1), key=lambda f: min(p[2] for p in f))
            assert len(leaves) == max(1, round((fence['height_cm'] - 10) / P.CHAIN_CARD)), (record['id'], len(leaves))
            assert abs(min(p[2] for p in leaves[0]) - 4) < .01 and abs(math.dist(leaves[0][0][:2], leaves[0][1][:2]) - 92) < .1
            gates += 1
            continue
        key = 'Rail_Baluster' if fence['kind'] == 'low' else fence['boards'] or 'Fence_Boards'
        leaf = [f for f in rear[key] if math.dist(_centre(f), g) < 1 and abs(min(p[2] for p in f) - 4) < .01]
        assert len(leaf) == 1 and abs(math.dist(leaf[0][0][:2], leaf[0][1][:2]) - 92) < .1, (record['id'], len(leaf))
        top = max(p[2] for p in leaf[0])
        paint = [f for f in rear[fence['gate_paint']] if math.dist(_centre(f), g) < 50]
        assert not [f for f in paint if _vertical(f) and _area_xy([(p[0], p[2], 0) for p in f]) > .3 * 92 * (top - 4)
                    and math.dist(f[0][:2], f[1][:2]) > 60], ('a flat painted gate panel', record['id'])
        ledges = [f for f in paint if _vertical(f) and abs(max(p[2] for p in f) - min(p[2] for p in f) - 12) < .01]
        assert len(ledges) >= 2, (record['id'], len(ledges))
        gates += 1
    assert gates == counts['rear_gates'] == counts['rear_gate_leaf_cards'] >= 10, gates
    # windows: a blind or curtains in front of the glass of every rear window (rollers, curtains and blinds let down),
    # just over the glass plane, inside the pane
    kinds = {k: counts.get('rear_blinds_' + k, 0) for k in ('roller', 'curtains', 'lowered')}
    assert sum(kinds.values()) == counts['rear_windows'] and all(kinds.values()), (kinds, counts['rear_windows'])
    assert .4 <= kinds['roller'] / counts['rear_windows'] <= .7, kinds
    cards = P.Grid(300)
    for key in set(P.BLINDS + P.CURTAINS):
        for f in rear.get(key, []):
            if _vertical(f):
                c = _centre(f)
                cards.add((f, c), [c[0]], [c[1]])
    panes = [f for f in rear['Glass'] if _vertical(f) and math.dist(f[0][:2], f[1][:2]) >= 60
             and max(p[2] for p in f) - min(p[2] for p in f) >= 100]
    assert len(panes) >= counts['rear_windows'] - counts['rear_doors'], len(panes)
    for pane in panes:
        n = _unit(_newell(pane))
        c = (*_centre(pane), sum(p[2] for p in pane) / 4)
        z0, z1 = min(p[2] for p in pane), max(p[2] for p in pane)
        width = math.dist(pane[0][:2], pane[1][:2]) if abs(pane[0][2] - pane[1][2]) < .01 else math.dist(pane[1][:2], pane[2][:2])
        hit = 0
        for f, fc in cards.near(c[0], c[1], 100):
            m = _unit(_newell(f))
            off = (fc[0] - c[0]) * n[0] + (fc[1] - c[1]) * n[1]
            lateral = math.hypot(fc[0] - c[0] - off * n[0], fc[1] - c[1] - off * n[1])
            if m[0] * n[0] + m[1] * n[1] > .99 and abs(off - .5) < .02 and lateral <= width / 2 + .01 \
                    and z0 - .01 <= min(p[2] for p in f) and max(p[2] for p in f) <= z1 + .01:
                hit += 1
        assert hit >= 1, ('a rear window with bare dark glass', pane)


def test_gallery_partitions_and_props_floor():
    # local critic 6: side-by-side galleries get a privacy screen at each shared post, of lattice (two 1 m cards, as
    # drawn) or boards (one 1.8 m card), between the modules of a wide lot and between neighbouring lots, one screen
    # per shared end and level; every deck records its quad and the floor left for props, inside the deck, off the
    # flights and the stair opening, clear of the door, and a capsule still walks every way with that floor filled
    kinds = set()
    for width, count in ((760, 12), (1526, 6), (470, 10)):
        _, _, lots, mesh, records, counts = _row_with_alley(count, width)
        rear = _rear_faces(mesh)
        by_id = {r['id']: r for r in records}
        pairs = {}
        for record in records:
            rr = record['rear']
            if not rr['galleries']:
                assert not rr['partitions']
                continue
            modules = [w for w in rr['walls'] if w['galleries']][0]['modules']
            levels = sorted({d['z'] for d in rr['decks']})
            inner = [p for p in rr['partitions'] if p['neighbour'] is None]
            assert len(inner) == (modules - 1) * len(levels), (record['id'], len(inner), modules)
            for p in rr['partitions']:
                kinds.add(p['kind'])
                assert p['z0'] in levels and abs(p['z1'] - p['z0'] - P.PARTITION_H[p['kind']]) < .01
                if p['neighbour']:
                    pairs.setdefault(tuple(sorted((record['id'], p['neighbour']))), []).append((record['id'], p))
                # the screen runs from the wall face across the gallery, on a shared post line
                a, b = tuple(p['a']), tuple(p['b'])
                assert abs(a[1] - (1600 + P.D_FACE)) < .1 and abs(a[0] - b[0]) < .1 and b[1] > a[1] + 100
                assert abs(a[0] / (width if p['neighbour'] else width / modules) - round(a[0] / (width if p['neighbour'] else width / modules))) < .01
                key = 'Rail_Lattice' if p['kind'] == 'lattice' else 'Fence_Boards'
                cards = sorted(min(q[2] for q in f) for f in rear[key] if _seg_dist(_centre(f), a, b) < .5
                               and p['z0'] - .01 <= min(q[2] for q in f) and max(q[2] for q in f) <= p['z1'] + .01)
                assert cards == ([p['z0'], p['z0'] + P.SKIRT_H] if p['kind'] == 'lattice' else [p['z0']]), (record['id'], p, cards)
        # every pair of neighbours with galleries meets at one screen per level, drawn by one of the two
        neighbours = [(str(i), str(i + 1)) for i in range(1, count) if by_id[str(i)]['rear']['galleries'] and by_id[str(i + 1)]['rear']['galleries']]
        assert sorted(pairs) == sorted(tuple(sorted(n)) for n in neighbours), (sorted(pairs), neighbours)
        for pair, items in pairs.items():
            drawers = {i for i, _ in items}
            owner = min(pair)
            assert drawers == {owner}, (pair, drawers)
            assert sorted(p['z0'] for _, p in items) == sorted({d['z'] for d in by_id[owner]['rear']['decks']})
        assert counts.get('rear_partitions', 0) == sum(len(r['rear']['partitions']) for r in records)
        # the props floor
        decks = 0
        for record in records:
            rr = record['rear']
            treads = [f for f in rear['Wood_Deck'] if _horizontal(f) and _area_xy(f) < 90 * 30
                      and any(_poly_dist(_centre(f), fp) < 1 for fp in rr.get('footprints', []))]
            for deck in rr['decks'] + rr.get('ground_decks', []):
                quad = [tuple(q) for q in deck['quad']]
                area = 0.
                for free in deck['free']:
                    free = [tuple(q) for q in free]
                    assert all(_poly_dist(q, quad) < .2 for q in free), (record['id'], free)
                    assert _area_xy([(q[0], q[1], 0) for q in free]) >= 2500 - 1
                    assert _poly_dist(tuple(deck['door']), free) >= CAPSULE_R + 10, (record['id'], 'props at the door')
                    # no tread of a flight over it lower than head height (a flight higher up may pass overhead)
                    assert not any(_overlap(free, t) for t in treads if deck['z'] - 1 < t[0][2] < deck['z'] + 210), \
                        (record['id'], 'props on a flight')
                    area += _area_xy([(q[0], q[1], 0) for q in free])
                assert abs(area / 1e4 - deck['free_m2']) < .011, (area, deck['free_m2'])
                assert abs(math.hypot(*deck['out']) - 1) < 1e-3 and len(deck['edge']) == 2
                decks += deck['free_m2'] >= 1
        n_decks = sum(len(r['rear']['decks']) for r in records)
        if width >= 760:
            assert decks >= .8 * n_decks, (decks, n_decks)
        failures = [(r['id'], f) for r in records if r['rear']['galleries'] for f in _deck_reachability(r['rear'], props=True)]
        assert not failures, failures[:10]
    assert kinds == {'lattice', 'boards'}, kinds


def test_background_roofs_and_roof_colours():
    # local critic 9: every background mass (the park-perimeter row, the skipped buildings) gets a roof, mostly white
    # membrane or white gravel, a skin over the mass top covering its footprint, with a chimney and a hatch on a low
    # mass, the post-1945 kit's penthouse and vents on a tower, nothing on a park pavilion; tar and sheet metal take
    # the texture sets' colours (tar and grey gravel, light weathered galvanised sheet)
    buildings, cards = _glass_fixture()
    owners = P.card_walls(cards, buildings)
    masses = P.background_masses(buildings, [], set(), {'900': 'no exposed edge facing a named street'}, cards, owners)
    mesh = P.PlexMesh()
    records, counts = P.build_background(mesh, masses, {})
    roof, mass = records[0]['roof'], masses[0]
    assert roof['material'] in P.ROOFS and abs(roof['z_cm'] - (mass['height_cm'] + P.ROOF_SKIN)) < .01
    faces = [f for f in mesh.groups[roof['material']] if _horizontal(f, roof['z_cm']) and _newell(f)[2] > 0]
    assert abs(sum(_area_xy(f) for f in faces) - abs(P._area(mass['points']))) < 1, 'the roof covers the footprint'
    assert roof['chimney'] and roof['hatch'] and counts['roof_' + roof['material']] == 1
    for f in mesh.groups['Sheet_Metal']:
        if _horizontal(f, roof['z_cm'] + 45):
            assert all(P._inside(p[:2], mass['points']) for p in f), 'the hatch stands on the roof'
    # a tower: penthouse and vents, no chimney or hatch; a pavilion: a bare roof
    tower = dict(mass, id='950', height_cm=3200., storeys=10, modern=True, skin_wall='Brick_Buff_Even')
    pavilion = dict(mass, id='951', storeys=1, height_cm=450., skin_wall='Stone_Cast', modern=False)
    troof = P.author_background_roof(P.PlexMesh(), tower, {})
    proof = P.author_background_roof(P.PlexMesh(), pavilion, {})
    assert troof['penthouses'] >= 1 and troof['vents'] >= 1 and not troof['chimney'] and not troof['hatch'], troof
    assert not proof['chimney'] and not proof['hatch'] and 'penthouses' not in proof
    # the mix over many masses: mostly white, a few tar
    mix = {}
    for i in range(400):
        m = dict(mass, id=str(10000 + i))
        key = P.author_background_roof(P.PlexMesh(), m, {})['material']
        mix[key] = mix.get(key, 0) + 1
    assert mix['Roof_Membrane'] + mix['Roof_Gravel'] >= .85 * 400 and 10 <= mix.get('Roof_Tar', 0) <= .12 * 400, mix
    # tar and sheet metal follow the replica texture sets (Textures/textures.json)
    sets = json.loads((P.ROOT / 'Data/Plateau/ReplicaGeometry/Textures/textures.json').read_text())['sets']
    tar, sheet = P.MATERIALS['Roof_Tar'], P.MATERIALS['Sheet_Metal']
    rgb = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    assert max(abs(x - y) for x, y in zip(rgb(tar['base_color_srgb']), rgb(sets['tar']['base_color_srgb']))) <= 4, tar
    assert max(abs(x - y) for x, y in zip(rgb(sheet['base_color_srgb']), rgb(sets['sheet_metal']['base_color_srgb']))) <= 4
    assert sheet['metallic'] <= sets['sheet_metal']['metallic'] and abs(sheet['roughness'] - sets['sheet_metal']['roughness_mean']) < .05
    assert abs(tar['roughness'] - sets['tar']['roughness_mean']) < .05


SPEC = ('openspec/changes/nord-gta-level-up/specs/nord-plateau-streetscape/spec.md',
        'openspec/specs/nord-plateau-streetscape/spec.md')   # the change's spec, then the canonical one once archived


def test_spec_budget_covers_the_code_caps():
    """The spec's Frame budget scenario promises the host a Plex budget: its triangle and batch numbers must be at
    least the generator's caps (TRIANGLE_BUDGET, MAX_BATCHES), and both must sit under the agreed ceiling the spec
    names (3.5 million triangles, 1,400 batches)."""
    repo = P.ROOT.parents[1]
    path = next((repo / rel for rel in SPEC if (repo / rel).is_file()), None)
    assert path is not None, SPEC
    scenario = path.read_text().split('#### Scenario: Frame budget', 1)[1].split('\n#', 1)[0]
    budget = re.search(r'plex layer\b.*?([\d.]+) million triangles in at most ([\d,]+) batches', scenario, re.S)
    assert budget, scenario
    triangles, batches = float(budget.group(1)) * 1e6, int(budget.group(2).replace(',', ''))
    assert triangles >= P.TRIANGLE_BUDGET, (path, triangles, P.TRIANGLE_BUDGET)
    assert batches >= P.MAX_BATCHES, (path, batches, P.MAX_BATCHES)
    ceiling = re.search(r'ceiling of ([\d.]+) million triangles and ([\d,]+) batches', scenario)
    assert ceiling, scenario
    top_triangles, top_batches = float(ceiling.group(1)) * 1e6, int(ceiling.group(2).replace(',', ''))
    assert (top_triangles, top_batches) == (3.5e6, 1400), (top_triangles, top_batches)
    assert P.TRIANGLE_BUDGET <= triangles <= top_triangles and P.MAX_BATCHES <= batches <= top_batches


def _check_rear_surfaces_district(manifest, stats, fronts, keep):
    """The rear-surfaces pass over the district: siding guards, board gates, blinds behind every rear and background
    window, gallery screens, the props floor on every deck, and a roof on every background mass."""
    counts = manifest['counts']
    records = fronts['fronts']
    background = fronts['background']
    # roofs on the background masses: every one, mostly white, a chimney and hatch on most low ones
    assert all(r.get('roof') and r['roof']['material'] in P.ROOFS for r in background)
    mix = stats['background']['roofs']['materials']
    assert mix.get('Roof_Membrane', 0) + mix.get('Roof_Gravel', 0) >= .8 * len(background) and mix.get('Roof_Tar', 0) <= .15 * len(background), mix
    low = [r for r in background if r['storeys'] <= 4 and not r.get('kit')]
    assert stats['background']['roofs']['chimneys'] >= .6 * len(low) and stats['background']['roofs']['hatches'] >= .6 * len(low)
    assert all(r['roof']['penthouses'] >= 1 for r in background if r.get('kit')), 'every tower has its lift penthouse'
    # blinds: every rear and background window, and every patio door of the post-1945 kit
    for prefix in ('rear_', 'background_'):
        blinds = sum(counts.get(prefix + 'blinds_' + k, 0) for k in ('roller', 'curtains', 'lowered'))
        want = counts.get(prefix + 'windows', 0) + counts.get(prefix + 'modern_windows', 0) + counts.get(prefix + 'patio_doors', 0)
        assert blinds == want, (prefix, blinds, want)
    # guards and gates
    assert counts['rear_guard_boards'] > 1000 and counts['rear_gate_leaf_cards'] == counts['rear_gates']
    # screens between side-by-side galleries, within lots and between them
    assert counts['rear_partitions'] >= 400 and counts['rear_partitions_between_lots'] >= 250, counts['rear_partitions']
    assert counts['rear_partitions_lattice'] > counts['rear_partitions_boards'] > 0
    # the props floor on every deck (the reachability with it filled runs in _check_collision_district)
    decks = [d for r in records for d in r['rear']['decks']]
    assert all('free' in d and 'free_m2' in d and 'edge' in d and 'out' in d for d in decks)
    floor = sum(d['free_m2'] for d in decks)
    assert sum(1 for d in decks if d['free_m2'] >= 1) >= .7 * len(decks) and floor >= 3 * len(decks), (floor, len(decks))
    return {'background_roofs': mix, 'partitions': counts['rear_partitions'],
            'partitions_between_lots': counts['rear_partitions_between_lots'], 'decks': len(decks),
            'props_floor_m2': round(floor, 1), 'guard_siding_runs': counts['rear_guard_boards'],
            'blinds': {prefix: sum(counts.get(prefix + 'blinds_' + k, 0) for k in ('roller', 'curtains', 'lowered'))
                       for prefix in ('rear_', 'background_')}}


def _check_collision_district(manifest, fronts, groups, keep):
    """Every Plex batch that collides, read back from its OBJ text (y negated), keeps 300 cm from every traffic
    centreline, measured with the replica test's own World().traffic_distance; and every guard collides."""
    import plateau_replica
    world = plateau_replica.World()
    worst, faces = math.inf, 0
    for batch in manifest['batches']:
        if batch['collision'] == 'none':
            continue
        key = batch['file'][:-4]
        material, polys = groups[key]
        vs = []
        for line in P.obj_text(batch['mesh'], polys, material).splitlines():
            if line.startswith('v '):
                x, y, z = (float(v) for v in line.split()[1:4])
                vs.append((x, -y, z))
            elif line.startswith('f '):
                face = [vs[int(t.split('/')[0]) - 1] for t in line.split()[1:]]
                worst = min(worst, world.traffic_distance([p[:2] for p in face], 2000))
                faces += 1
    assert worst >= plateau_replica.CLEAR - .01, f'Plex collision {worst:.1f} cm from a traffic centreline'
    counts = manifest['counts']
    guards = sum(len(r['rear']['guards']) for r in fronts['fronts'])
    assert counts['rear_guard_collision_runs'] == guards and 'Collision_Only' in manifest['materials']
    assert all(b['collision'] == 'complex' for b in manifest['batches'] if b['material'] == 'Collision_Only')
    # the walk keeps every deck's props floor as filled (the lane life's chairs, barbecues and plants stand there)
    failures = [(r['id'], f) for r in fronts['fronts'] if r['rear']['galleries']
                for f in _deck_reachability(r['rear'], 12., props=True)]
    assert not failures, failures[:10]
    return {'collision_triangles_checked': faces, 'min_collision_to_traffic_cm': round(worst, 1),
            'traffic_band_units': counts.get('traffic_band_units', 0), 'guard_collision_runs': guards}


def _check_kit_district(manifest, stats, fronts, keep):
    """The walls pass over the district: the Mentana override, the post-1945 kit, siding kept low, ground cover on
    the yardless lots, the towers' brick and windows, and buff brick on its even key."""
    counts = manifest['counts']
    records = fronts['fronts']
    block = next(r for r in records if r['id'] == '356220851')
    assert block['year'] == 1974 and block['era_source'].startswith('override: OMHM') and block['masonry'] == 'Brick_Red'
    assert block['kit'] == 'post-1945 apartment' and block['roof']['penthouses'] >= 1 and not block['roof']['chimney']
    assert block['rear']['open_ground'] and not any(w['material'] in P.SIDING for w in block['rear']['walls'])
    modern = [r for r in records if r.get('kit')]
    assert all(r['storeys'] >= P.MODERN_STOREYS and r['year'] >= P.MODERN_YEAR for r in modern)
    assert len(modern) == sum(1 for lot in keep['lots'] if lot['storeys'] >= 5 and lot['year'] >= 1945) >= 5
    assert counts['modern_fronts'] == len(modern) and counts['modern_balconies'] > 0 and counts['rear_modern_balconies'] > 0
    # siding: never on a block over four storeys, never above the second storey
    for record in records + fronts['background']:
        walls = record['rear']['walls'] if 'rear' in record else record['walls']
        storeys = record['storeys']
        for w in walls:
            if w['material'] in P.SIDING:
                assert storeys <= P.SIDING_MAX_STOREYS and 'kit' not in record, (record['id'], w)
                if storeys > P.SIDING_STOREYS:
                    assert w['upper'] in P.BRICKS and w['siding_top_cm'] < w['top_cm'], (record['id'], w)
    # ground cover on the lots with no yard: lawn everywhere, parking where a ruelle or open ground lets cars in
    yardless = [r for r in records if not r['rear']['yard'] and r['rear'].get('yard_reason')]
    covered = [r for r in yardless if r['rear'].get('open_ground')]
    assert len(covered) >= .5 * len(yardless) and counts['rear_open_ground_lots'] == len(covered), (len(covered), len(yardless))
    assert sum(r['rear']['open_ground']['area_m2'].get('Asphalt_Lot', 0) for r in covered) > 100
    assert counts['rear_parking_stall_lines'] > 0 and 'Asphalt_Lot' in manifest['materials']
    # towers: buff or brown, the kit with balconies, windows about every 3 m; buff brick is the even key everywhere
    towers = [m for m in fronts['background'] if m.get('kit')]
    assert len(towers) == 8 and all(m['brick'] in P.TOWER_BRICK for m in towers), [m.get('brick') for m in towers]
    assert all(sum(w['balconies'] for w in m['walls']) > 0 for m in towers)
    assert 'Brick_Buff' not in manifest['materials'] and 'Brick_Buff_Even' in manifest['materials']
    assert 'texture' not in manifest['materials']['Brick_Buff_Even']
    assert counts['background_windows'] >= 1.1 * 6137, counts['background_windows']
    return {'modern_lots': len(modern), 'yardless_lots_with_ground': len(covered), 'towers': len(towers),
            'background_windows': counts['background_windows'],
            'balconies': counts['modern_balconies'] + counts.get('side_modern_balconies', 0)
            + counts['rear_modern_balconies'] + counts.get('background_modern_balconies', 0)}


def _check_yards_district(manifest, stats, fronts, keep):
    """The yards pass over the whole district: ground cover, lane edges, guards, spirals, creepers and yard trees."""
    counts = manifest['counts']
    records = fronts['fronts']
    yards = stats['rear']['yards']
    for key in ('Rail_Lattice', 'Fence_Boards', 'Leaf_Creeper') + P.YARD_GROUND:
        assert key in manifest['materials'], key
    assert yards['lots'] >= 900 and all(yards['area_m2'][m] > 1000 for m in P.YARD_GROUND), yards
    assert set(yards['mixes']) == {'lawn', 'patio', 'paved', 'gravel', 'garden'}
    lane = sum(1 for r in records if r['rear']['yard'] and r['rear']['yard']['edge'] in ('fence', 'low', 'open')
               and (r['rear']['fence'] or {}).get('lane', True))
    assert yards['lane_edges'].get('open', 0) >= .05 * lane and yards['lane_edges'].get('low', 0) >= .1 * lane, (yards, lane)
    share = counts['rear_guard_balusters'] / (counts['rear_guard_balusters'] + counts['rear_guard_boards'])
    assert .6 <= share <= .8, share
    assert counts['rear_ground_galleries'] >= 30 and counts['rear_lattice_skirts'] >= 3 * counts['rear_ground_galleries']
    assert abs(counts['rear_spiral_balusters'] - counts['rear_spiral_treads'] / 2) <= 3 * counts['rear_stairs_spiral'] + 50
    assert counts['rear_creeper_strips'] >= 3 * counts['rear_creepers'] and counts['background_creepers'] > 0
    # yard trees: the committed file is this build's, every row is valid for the apply step, every tree stands in a
    # plex yard, clear of traffic, galleries and fences, and the mature ones top the 3-storey roofs
    committed = (P.YARD_TREES).read_bytes()
    assert committed == keep['yard_tree_bytes'], 'Plex/yard_trees.json differs from a fresh build'
    doc = keep['yard_trees']
    assert manifest['yard_trees']['count'] == len(doc['trees']) >= 300 and 'Canopée 2019' in doc['source']
    assert set(manifest['yard_trees']['kinds']) == {'maple', 'elm', 'ash', 'small'}
    assert P.CANOPY.is_file() and 'CC BY 4.0' in json.loads(P.CANOPY.read_text())['license']
    assert str(P.CANOPY.relative_to(P.ROOT)) in manifest['source_sha256']
    # the yard trees keep clear of the street and park trees (plateau_rendering.tree_positions reads the Streets
    # layer's street_trees.json), so the manifest hashes that file and a moved street tree shows this layer as stale
    assert 'Data/Plateau/ReplicaGeometry/Streets/street_trees.json' in manifest['source_sha256']
    layout = json.loads((P.ROOT / 'Data/LaFontaine/layout.json').read_text())
    traffic = P.Grid(2000)
    for road in layout['roads']:
        for a, b in zip(road, road[1:]):
            traffic.add((tuple(a[:2]), tuple(b[:2])), [a[0], b[0]], [a[1], b[1]])
    rows = [(r, t) for r in records for t in ((r['rear']['yard'] or {}).get('trees', ()))]
    assert len(rows) == len(doc['trees'])
    mature = 0
    for record, t in rows:
        p = (t['x'], t['y'])
        assert t['kind'] in ('maple', 'ash', 'elm', 'small') and .3 <= t['scale'] <= 4. and t['z'] == 0
        assert P._inside(p, [tuple(q) for q in record['rear']['yard']['rect']]), record['id']
        assert all(_seg_dist(p, a, b) >= P.TRAFFIC_CLEAR for a, b in traffic.near(p[0], p[1], 500)), record['id']
        for fp in record['rear'].get('footprints', []):
            assert _poly_dist(p, fp) >= P.TREE_CLEAR['structure'] - 1, record['id']
        if t['kind'] != 'small':
            mature += 1
            if record['storeys'] <= 3:
                assert t['height_m'] >= record['rear']['wall_top_cm'] / 100 + 1.5 - .01, (record['id'], t)
    assert mature >= 200, mature
    # the fourth pass's lane fences: no single look (kind and board colour) takes more than a third of the lane fences,
    # every kind and painted colour is used, and the lanes have garages and sheds on their fence lines
    lane_fences = [r['rear']['fence'] for r in records if r['rear']['fence'] and r['rear']['fence']['lane']]
    looks = {}
    for fence in lane_fences:
        key = (fence['kind'], fence.get('boards'))
        looks[key] = looks.get(key, 0) + 1
    assert max(looks.values()) <= len(lane_fences) / 3, looks
    assert {k for k, _ in looks} == {'boards', 'lattice', 'chain', 'slats', 'low'}, looks
    assert {b for _, b in looks if b} == set(P.BOARD_KEYS), looks
    for key in ('Leaf_Cedar', 'Chain_Link') + P.BOARD_KEYS:
        assert key in manifest['materials'], key
    assert counts['rear_garages'] >= 20 and counts['rear_sheds'] >= 130, (counts['rear_garages'], counts['rear_sheds'])
    assert counts['rear_cedar_cards'] >= 3 * counts['rear_cedars'] + 4 * counts['rear_hedges'], counts['rear_cedar_cards']
    assert not any(len(f) == 3 for f in _rear_faces(keep['mesh']).get('Wood_Green', [])), 'cedars are cards, no cone left'
    return {'yards': yards, 'guard_baluster_share': round(share, 3), 'yard_trees': len(rows),
            'lane_fence_looks': {f'{k}/{b}': v for (k, b), v in sorted(looks.items(), key=lambda kv: str(kv[0]))},
            'garages': counts['rear_garages'], 'sheds': counts['rear_sheds']}


def _check_rear_district(manifest, fronts, keep):
    lots = {lot['id']: lot for lot in keep['lots']}
    counts = manifest['counts']
    layout = json.loads((P.ROOT / 'Data/LaFontaine/layout.json').read_text())
    traffic = [(tuple(a[:2]), tuple(b[:2])) for road in layout['roads'] for a, b in zip(road, road[1:])]
    grid = P.Grid(2000)
    for seg in traffic:
        grid.add(seg, [seg[0][0], seg[1][0]], [seg[0][1], seg[1][1]])
    treated = galleries = 0
    stairs = {'straight': 0, 'spiral': 0}
    for record in fronts['fronts']:
        lot, rear = lots[record['id']], record['rear']
        # every back wall (rear, lane, street, side) is skinned, so no old glass card floats on it
        assert [w['kind'] for w in rear['walls']] == [w['kind'] for w in lot['backs']], record['id']
        if any(w['kind'] == 'rear' for w in lot['backs']):
            treated += 1
        if rear['galleries']:
            # every upper floor under the wall top has a gallery, and every gallery a stair from the yard
            zt = rear['wall_top_cm']
            floors = P._floor_levels(lot)
            want = [round(floors[k], 1) for k in range(1, lot['storeys']) if floors[k] + P.REAR_HEAD <= zt - 10 + .06]
            modules = [w for w in rear['walls'] if w['galleries']][0]['modules']
            assert sorted({d['z'] for d in rear['decks']}) == want and len(rear['decks']) == len(want) * modules, record['id']
            _check_reachable(rear)
            galleries += rear['galleries']
            stairs[rear['stair']] += modules
            for footprint in rear['footprints']:
                poly = [tuple(p) for p in footprint]
                cx, cy = sum(p[0] for p in poly) / 4, sum(p[1] for p in poly) / 4
                worst = min([_poly_seg(poly, a, b) for a, b in grid.near(cx, cy, 1500)] or [1e9])
                assert worst >= P.TRAFFIC_CLEAR - .01, ('rear collision near a traffic lane', record['id'], worst)
        elif any(w['kind'] == 'rear' and w['width'] >= 300 for w in lot['backs']):
            assert rear['reason'], record['id']
        fence = rear['fence']
        if fence and fence['lane']:
            assert fence['gate'] or fence['covered_cm'] > 0, record['id']
        # fences stand in yards, never on a traffic lane (they have no collision, but cars would drive through)
        segments = [tuple(map(tuple, s)) for s in rear.get('side_fences', [])]
        if fence:
            (x0, y0), (x1, y1) = fence['line']
            for r0, r1 in fence['runs']:
                f0, f1 = r0 / fence['lot_width_cm'], r1 / fence['lot_width_cm']
                segments.append(((x0 + (x1 - x0) * f0, y0 + (y1 - y0) * f0), (x0 + (x1 - x0) * f1, y0 + (y1 - y0) * f1)))
        for a, b in segments:
            near = grid.near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, math.dist(a, b) / 2 + 400)
            assert all(_poly_seg([a, b], c, d) >= 240 for c, d in near), ('fence on a traffic lane', record['id'], a, b)
    # rear decks and treads stay inside their recorded footprints
    footprints = P.Grid(1000)
    for record in fronts['fronts']:
        for footprint in record['rear'].get('footprints', []):
            poly = [tuple(p) for p in footprint]
            footprints.add(poly, [p[0] for p in poly], [p[1] for p in poly])
    for face in _rear_faces(keep['mesh']).get('Wood_Deck', []):
        cx, cy = sum(p[0] for p in face) / len(face), sum(p[1] for p in face) / len(face)
        assert any(_poly_dist((cx, cy), poly) < 30 for poly in footprints.near(cx, cy, 50)), ('stray rear deck', cx, cy)
    assert treated == counts['rear_lots_with_rear_walls'] and galleries == counts['rear_galleries']
    assert stairs['straight'] == counts.get('rear_stairs_straight', 0) and stairs['spiral'] == counts.get('rear_stairs_spiral', 0)
    assert counts['rear_lots_with_galleries'] >= 700 and counts['rear_galleries'] >= 1400, counts
    assert counts['rear_fence_runs'] >= 1000 and counts['rear_gates'] >= 500 and counts.get('rear_sheds', 0) >= 100
    return {'lots_with_rear_walls': treated, 'lots_with_galleries': counts['rear_lots_with_galleries'],
            'galleries': galleries, 'stairs': stairs, 'rear_triangles': counts['rear_triangles']}


def _glass_floating(fronts, buildings):
    """An audit of the old glass cards from the written records alone: every card on a wall must sit behind a
    neighbour that stands within 25 cm and above it, behind a detailed route or perimeter front, or behind a skin
    recorded in fronts.json (plex fronts, back walls, party skins, background walls). Returns the floating cards."""
    vs = []
    for line in (P.ROOT / 'Data/Plateau/BaseGeometry/Glass.obj').read_text().splitlines():
        if line.startswith('v '):
            x, y, z = (float(v) for v in line.split()[1:4])
            vs.append((x, -y, z))
    cards = [vs[i:i + 4] for i in range(0, len(vs), 4)]
    tops = {str(b['id']): b['height'] for b in buildings}
    for record in fronts['fronts']:
        tops[record['id']] = max(tops[record['id']], record['roof']['z_cm'])
    edges, masses = P.Grid(2000), P.Grid(3000)
    for b in buildings:
        pts = b['points']
        masses.add(b, [p[0] for p in pts], [p[1] for p in pts])
        for i in range(len(pts)):
            a, c = pts[i], pts[(i + 1) % len(pts)]
            edges.add((str(b['id']), a, c), [a[0], c[0]], [a[1], c[1]])
    segments = {}
    layout = json.loads((P.ROOT / 'Data/Plateau/layout.json').read_text())
    perimeter = json.loads((P.ROOT / 'Data/Plateau/PerimeterGeometry/perimeter.json').read_text())
    for f in layout['facades']['fronts'] + perimeter['fronts']:
        for g in [f] + f.get('corner_returns', []):
            segments.setdefault(str(g['id']), []).append((g['a'], g['b'], -1e9, 1e9))
    for record in fronts['fronts']:
        own = segments.setdefault(record['id'], [])
        own += [(f['a'], f['b'], -1e9, f['top_cm']) for f in [record['front']] + record['sides']]
        own += [(w['a'], w['b'], -1e9, w['top_cm']) for w in record['rear']['walls']]
        own += [(e['a'], e['b'], e['skin_from_cm'], e['top_cm']) for e in record['roof']['party'] if e['skin_from_cm'] is not None]
    for record in fronts['background']:
        own = segments.setdefault(record['id'], [])
        own += [(w['a'], w['b'], -1e9, w['top_cm']) for w in record['walls']]
        own += [(e['a'], e['b'], e['skin_from_cm'], e['top_cm']) for e in record['party']]
    exempt = {P.plateau_tower.OSM_ID, P.plateau_school.OSM_ID, P.plateau_landmarks.STAGE_ID}
    floating = []
    for q in cards:
        cx, cy = sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4
        z0, z1 = min(p[2] for p in q), max(p[2] for p in q)
        owner = None
        for bid, a, c in edges.near(cx, cy, 50):
            length = math.dist(a, c)
            if length >= 1:
                n = ((c[1] - a[1]) / length, -(c[0] - a[0]) / length)
                if abs((cx - a[0]) * n[0] + (cy - a[1]) * n[1] - 3) < .1 and _seg_dist((cx, cy), a, c) < 3.1:
                    owner = (bid, n)
                    break
        assert owner, ('a card on no mapped wall', cx, cy)
        bid, n = owner
        if bid in exempt:
            continue
        probe = (cx + n[0] * 22, cy + n[1] * 22)
        front = max([tops[str(b['id'])] for b in masses.near(probe[0], probe[1], 1)
                     if str(b['id']) != bid and P._inside(probe, b['points'])] or [-1e9])
        if front >= z1 - 20:
            continue
        low = max(z0, front)
        ok = False
        for a, b, s0, s1 in segments.get(bid, ()):
            length = math.dist(a, b)
            if length < 1 or not (s0 - 1 <= low and z1 <= s1 + 1):
                continue
            u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
            along = (cx - a[0]) * u[0] + (cy - a[1]) * u[1]
            if abs(u[0] * n[0] + u[1] * n[1]) < .3 and -10 <= along <= length + 10 and _seg_dist((cx, cy), tuple(a), tuple(b)) <= 35:
                ok = True
                break
        if not ok:
            floating.append((bid, round(cx), round(cy), z0))
    return floating, len(cards)


def _check_walls_roofs_district(manifest, stats, fronts, keep):
    counts = manifest['counts']
    records = fronts['fronts']
    # Caps raised within the agreed ceilings of 3.5 million triangles and 1,400 batches. Walls-and-roofs pass: roofs,
    # windowed long and street walls and 252 background masses added ~210,000 triangles (cap 2.75 million), and 8 new
    # material keys needed ~1,250 batches at the 142.5 m tile, so the tile widened to 190 m (cap 1,200). Yards pass:
    # guard rails, caps and rim boards, fence posts and cap rails, spiral pans, stringers, rails and balusters, ground
    # cover and creeper cards add ~270,000 triangles (cap 2.95 million); 7 more keys stay under 1,200 batches at 190 m.
    # Walls-and-collision pass (cap 3.15 million): the post-1945 kit on 6 blocks and 8 towers, the denser background
    # window grid and the invisible guard walls add ~160,000 triangles; its 3 keys stay under 1,200 batches at 190 m.
    # Rear-surfaces pass (cap 3.2 million): blinds or curtains behind ~23,000 rear, background and post-1945 windows and
    # patio doors, gallery privacy screens, the background masses' roofs and roof props and the board gates' frames add
    # ~86,000 triangles; no new key, 1,199 batches at 190 m. Fourth pass (batch cap 1,350, triangles unchanged at
    # 3.2 million): Leaf_Cedar, three painted fence-board keys, Chain_Link and the Mentana slab's three keys take 1,341
    # batches at 190 m (a 1,200 cap would widen the tile to 237.5 m); the slab drops half the old balcony bands, so the
    # cedar cards, chain-link cards and lattice tops fit under the old triangle cap.
    assert P.TRIANGLE_BUDGET <= 3200000 and P.MAX_BATCHES <= 1350 and manifest['batching']['tile_cm'] == 19000
    # roofs: every lot has one; mostly white membrane, some white gravel, a few tar (the borough's white-roof rule)
    mix = stats['roofs']['materials']
    share = {key: mix.get(key, 0) / len(records) for key in P.ROOFS}
    assert .55 <= share['Roof_Membrane'] <= .7 and .2 <= share['Roof_Gravel'] <= .35 and .05 <= share['Roof_Tar'] <= .15, share
    assert stats['roofs']['chimneys'] >= .95 * len(records), stats['roofs']
    assert stats['roofs']['hatches'] + stats['roofs']['terraces'] >= .85 * len(records), stats['roofs']
    assert .01 * len(records) <= stats['roofs']['terraces'] <= .08 * len(records), stats['roofs']
    assert stats['roofs']['party_copings'] >= 2000, stats['roofs']
    # no flat roof is slate any more (mansards keep their sloped slate)
    assert not any(max(p[2] for p in f) - min(p[2] for p in f) < .01 for f in keep['mesh'].groups['Slate'])
    for record in records:
        for edge in record['roof']['party']:
            assert edge['top_cm'] <= max([record['front']['top_cm']] + [s['top_cm'] for s in record['sides']]) + 4.01
    # walls: brick on street, lane and long walls; lap siding (never white trim) elsewhere; parged or cast bases
    lots = {lot['id']: lot for lot in keep['lots']}
    long_windows = 0
    for record in records + fronts['background']:
        walls = record['rear']['walls'] if 'rear' in record else record['walls']
        lot = lots.get(record['id'])
        slab = record.get('form') == 'omhm_slab'
        for wall in walls:
            assert wall['material'] in P.BRICKS + P.SIDING + ('Stone_Cast',) + (('Concrete_Exposed',) if slab else ()), \
                (record['id'], wall)
            if wall['kind'] in ('street', 'lane', 'long'):
                assert wall['material'] in P.BRICKS + ('Stone_Cast',) + (('Concrete_Exposed',) if slab else ()), \
                    (record['id'], wall)
            assert wall['base'] in ('Parged', 'Stone_Cast') or (wall['kind'] == 'street' and wall['base'] == 'Stone'), wall
            if lot and not lot.get('modern') and wall['kind'] == 'long' and not wall['galleries']:
                floors = P._floor_levels(lot)
                rows = sum(1 for k in range(lot['storeys']) if floors[k] + P.REAR_HEAD <= wall['top_cm'] - 10)
                assert wall['windows'] == rows * max(1, int(wall['width_cm'] // 450)), (record['id'], wall)
                long_windows += wall['windows']
    assert long_windows >= 2500, long_windows
    # the Mentana block: 9 storeys from the roll, checked against its 32 m LOD2 roof; built 1974 (OMHM), so the
    # post-1945 kit, with its own form (BUILDING_FORMS): on both long faces a balcony stack per 6 m bay between the
    # concrete piers, on every upper floor, over a set-back ground floor; plain concrete end walls and heads
    block = next(r for r in records if r['id'] == '356220851')
    assert block['storeys'] == 9 and block['storeys_source'].startswith('assessment roll, checked'), block['storeys_source']
    assert block['form'] == 'omhm_slab' and block['front']['material'] == 'Concrete_Exposed'
    assert all(side['material'] == 'Concrete_Exposed' for side in block['sides'])
    longs = [w for w in block['rear']['walls'] if w['kind'] == 'long']
    assert len(longs) == 2 and all(w['material'] == 'Brick_Red' for w in longs), longs
    assert all(w['balconies'] == 8 * round(w['width_cm'] / P.SLAB_BAY) for w in longs), longs
    assert all(w['material'] == 'Concrete_Exposed' and not w['balconies'] for w in block['rear']['walls'] if w['kind'] != 'long')
    assert counts['rear_slab_columns'] == sum(round(w['width_cm'] / P.SLAB_BAY) + 1 for w in longs)
    # siding: no wall a named street sees keeps it (the grey siding under a brick storey that faced Rachel, on the
    # park-perimeter mass 358203751, is brick now); the sight test agrees with the written records
    seen = [w for r in records for w in r['rear']['walls'] if w.get('street_seen_cm')] + \
        [w for r in fronts['background'] for w in r['walls'] if w.get('street_seen_cm')]
    assert len(seen) == counts['rear_walls_street_seen'] + counts['background_walls_street_seen'] >= 60, len(seen)
    assert all(w['material'] in P.BRICKS and w['street_seen_cm'] <= P.SIGHT_RANGE for w in seen)
    rachel = next(w for r in fronts['background'] if r['id'] == '358203751' for w in r['walls']
                  if math.dist(w['a'], (-11612.8, 42515.3)) < 1)
    assert rachel['material'] in P.BRICKS and rachel.get('street_seen_cm'), rachel
    masses = {m['id']: m for m in keep['masses']}
    for record in records + fronts['background']:
        lot = lots.get(record['id']) or masses[record['id']]
        walls = record['rear']['walls'] if 'rear' in record else record['walls']
        backs = {(round(w['a'][0], 1), round(w['a'][1], 1)): w for w in lot['backs']}
        streets = [(c, d) for c, d, _, named in lot['roads_near'] if named]
        obstacles = P.Rear(lot, lot['height_cm']).obstacle_bounds
        for w in walls:
            if w['material'] in P.SIDING:
                back = backs[(round(w['a'][0], 1), round(w['a'][1], 1))]
                assert P.street_sight(back, obstacles, streets) is None, (record['id'], w)
    # background masses: the park-perimeter row and the skipped buildings with cards are skinned and windowed
    kinds = stats['background']['kinds']
    assert kinds.get('perimeter') == 154 and stats['background']['windows'] >= 5000, stats['background']
    assert all(r['walls'] or r['party'] for r in fronts['background'])
    # every old glass card: hidden, dropped by a landmark, or behind a front or a skin; none floats
    assert counts.get('glass_cards_floating', 0) == 0 and not fronts['glass_cards']['floating_on']
    from prepare_plateau import geography
    floating, total = _glass_floating(fronts, geography()[0])
    assert not floating, floating[:20]
    assert sum(v for k, v in counts.items() if k.startswith('glass_cards_')) == total, 'every card is accounted for'
    assert counts['porch_steps'] >= 2000, counts['porch_steps']
    return {'roofs': stats['roofs'], 'background': stats['background'], 'glass_cards': total, 'long_wall_windows': long_windows}


def test_district():
    manifest_path = P.OUT / 'manifest.json'
    committed = json.loads(manifest_path.read_text())
    keep = {}
    manifest, stats, fronts, groups = P.prepare(write=False, keep=keep)
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
        visual = batch['file'].startswith('WoodDeck' + P.VISUAL + '_')
        assert batch['collision'] == ('complex' if batch['material'] in P.COLLISION and not visual else 'none'), batch
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
    rear = _check_rear_district(manifest, fronts, keep)
    walls_roofs = _check_walls_roofs_district(manifest, stats, fronts, keep)
    yards = _check_yards_district(manifest, stats, fronts, keep)
    collision = _check_collision_district(manifest, fronts, groups, keep)
    kit = _check_kit_district(manifest, stats, fronts, keep)
    surfaces = _check_rear_surfaces_district(manifest, stats, fronts, keep)
    print('district', json.dumps({'fronts': stats['fronts'], 'triangles': total, 'batches': len(manifest['batches']),
                                  'tile_cm': manifest['batching']['tile_cm'], 'stair_share_1890_1930': round(share, 3),
                                  'rear': rear, 'walls_roofs': walls_roofs, 'yards': yards, 'collision': collision,
                                  'kit': kit, 'rear_surfaces': surfaces}))


if __name__ == '__main__':
    tests = [test_selection_and_party_walls, test_orientation_offsets_and_float32, test_stairs_by_setback,
             test_dimensions, test_storeys_and_mass_cover, test_wide_footprint_gets_lot_modules,
             test_obj_writer_and_batches, test_determinism_fixture, test_rear_fixture_galleries_and_fence,
             test_rear_spiral_in_a_shallow_yard, test_rear_back_to_back_and_duplex, test_rear_leaves_the_front_alone,
             test_rear_determinism, test_roofs_and_party_parapets, test_roof_terrace_and_mix, test_card_uvs,
             test_rear_wall_materials_and_long_walls, test_street_wall_brick_lintels_and_cornice_return,
             test_lod2_storeys_check, test_galleries_on_a_long_wall, test_front_steps_reach_the_ground,
             test_background_mass_skins_its_glass_cards, test_gallery_guards_rails_cards_and_fascia,
             test_guards_cut_where_flights_pass, test_ground_galleries_on_lattice_skirts,
             test_spiral_treads_stringer_rail_balusters, test_fences_posts_cards_gates_and_open_lanes,
             test_lane_fences_vary_lot_by_lot,
             test_yard_ground_cover, test_creepers_are_cutout_cards, test_yard_trees_from_the_canopy,
             test_canopy_raster_and_projection, test_traffic_band_takes_whole_units_out_of_collision,
             test_gallery_guards_collide_and_exits_stay_open, test_build_year_override_and_post1945_kit,
             test_mentana_slab_form, test_walls_a_street_sees_are_brick, test_cedars_are_crossed_cards,
             test_lap_siding_stays_low, test_open_ground_for_yardless_lots, test_towers_buff_or_brown_with_three_metre_bays,
             test_rear_surfaces_siding_gates_and_windows, test_gallery_partitions_and_props_floor,
             test_background_roofs_and_roof_colours, test_spec_budget_covers_the_code_caps]
    if '--quick' not in sys.argv:
        tests.append(test_district)
    for test in tests:
        test()
        print('ok', test.__name__)
    print('Plateau plex checks passed')
