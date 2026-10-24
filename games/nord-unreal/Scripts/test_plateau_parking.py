"""Checks the curb parking slots (Scripts/plateau_parking.py) and the game code that fills them.

Run from games/nord-unreal after plateau_replica.py:  python3 Scripts/test_plateau_parking.py

- Output: two builds are byte-identical, and the committed parked_cars.json and LaFontaineParking.h are that build.
- Clearances, measured here on the raw data: 300 cm from every C++ traffic centre line, 200 cm from every other
  street's (150 cm from its own off the traffic graph: a 3 m lane), 3 m from a hydrant, 5 m past a painted crosswalk, 7 m from a junction node, a lane mouth or a driveway
  left open, out of the bus and taxi zones, clear of curb extensions, road props, bollards and the chantier fence.
- Curb: a 17 to 25 cm SM_Concrete_Collision top runs 2 to 60 cm off every car's curb side at both ends and the middle,
  no raised top lies under a car, the replica asphalt does, and no two cars touch.
- Counts per street on the plex streets, and every body and paint in use.
- The rules as fixtures: parking sides, the curb under a car and the bus zone's direction.
- The city's parking signs (Data/Plateau/Inventory/park_signs.json): every side that two or more poles sign for
  parking holds cars or a listed reason, Rue Rachel's park side among them; no ban's arrow covers a car within
  4 m; every permit or street-cleaning pole has a car within 15 m or a listed reason; the readings of the sign
  texts at the moment, the arrows, the bus lanes' hours and the drawn cycle tracks (prepare_car_parking.py).
- The C++ rules (QuebecParkedRules.h) and the generated header, built and run with the system compilers.
- The game wiring: the fill spawns after the street props and in look runs, E, impacts and shots promote a space,
  and the instanced parts copy AQuebecCar's.
- The frame budget: components, cars within each cull distance and their triangles.
"""
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plateau_parking as P  # noqa: E402
import plateau_park_signs as S  # noqa: E402
import prepare_car_parking as C  # noqa: E402

ROOT = P.ROOT
SOURCE = ROOT / 'Source/Quebec'
CHECKS = []


def check(name):
    def wrap(fn):
        CHECKS.append((name, fn))
        return fn
    return wrap


# ---------------------------------------------------------------------------------------------------------------
# Output

STATE = {}


def build_twice():
    with tempfile.TemporaryDirectory() as tmp:
        outs = []
        for k in range(2):
            j, h = Path(tmp) / f'{k}.json', Path(tmp) / f'{k}.h'
            P.build(j, h)
            outs.append((j.read_bytes(), h.read_bytes()))
    return outs


@check('two builds are byte-identical and match the committed outputs')
def check_output():
    (j0, h0), (j1, h1) = build_twice()
    assert j0 == j1 and h0 == h1, 'two builds differ'
    assert P.OUT_JSON.read_bytes() == j0, 'parked_cars.json is stale: run python3 Scripts/plateau_parking.py'
    assert P.OUT_HEADER.read_bytes() == h0, 'LaFontaineParking.h is stale: run python3 Scripts/plateau_parking.py'


def load():
    if 'doc' not in STATE:
        doc = json.loads(P.OUT_JSON.read_text())
        STATE['doc'], STATE['slots'] = doc, doc['slots']
        curbs, asphalt, bollards = P.load_surfaces()
        city = P.City()
        STATE.update(curbs=curbs, asphalt=asphalt, bollards=bollards, city=city, features=P.Features(city, curbs))
    return STATE


@check('schema, sources and the header agree with the rows')
def check_schema():
    s = load()
    doc, slots = s['doc'], s['slots']
    assert doc['generator'] == P.GENERATOR and doc['frame'] == P.FRAME
    for path, digest in doc['source_sha256'].items():
        assert P.sha_file(ROOT / path) == digest, f'{path} changed since the build: rerun plateau_parking.py'
    keys = {'id', 'x', 'y', 'z', 'yaw', 'length', 'paint', 'body', 'street', 'way', 'side', 'traffic_segment', 'curb_cm'}
    for i, row in enumerate(slots):
        assert set(row) == keys and row['id'] == i, row
        assert 0 <= row['paint'] < 4 and 0 <= row['body'] < 3 and row['length'] == row['body'], row
        assert 0. <= row['yaw'] < 360. and row['z'] == P.ROAD_Z and row['side'] in ('L', 'R'), row
        assert P.CURB_GAP_MIN <= row['curb_cm'] <= P.CURB_GAP[1] + 4., row
    text = P.OUT_HEADER.read_text()
    rows = [line.strip().strip('{},').replace('f', '').split(',') for line in text.splitlines()
            if line.startswith('{') and ',' in line]
    assert f'constexpr int SlotCount = {len(slots)};' in text and len(rows) == len(slots)
    for row, slot in zip(rows, slots):
        x, y, z, yaw, length, paint, body = row
        assert abs(float(x) - slot['x']) < .06 and abs(float(y) - slot['y']) < .06 and abs(float(z) - slot['z']) < .06
        assert abs(float(yaw) - slot['yaw']) < .006 and (int(length), int(paint), int(body)) == \
            (slot['length'], slot['paint'], slot['body'])


# ---------------------------------------------------------------------------------------------------------------
# Clearances on the raw data

def near(grid, poly, pad):
    return grid.query(P.bbox(poly, pad))


def min_dist(poly, segments):
    return min((P.poly_seg_dist(poly, a, b) for a, b in segments), default=1e9)


def own_street(street, other):
    """The street's own centre line, or a collinear way of the same name: a street off the traffic graph keeps a 3 m
    lane between its parked cars there, and 200 cm from every other street."""
    if other is street:
        return True
    if not street['name'] or other['name'] != street['name']:
        return False
    u = P.unit(street['segs'][0]['a'], street['segs'][-1]['b'])[0]
    v = P.unit(other['segs'][0]['a'], other['segs'][-1]['b'])[0]
    return abs(P.dot(u, v)) > .9


@check('300 cm from traffic centre lines, 200 cm from other streets, a 3 m lane, no two cars touch')
def check_centre_lines():
    s = load()
    city = s['city']
    by_id = {st['id']: st for st in city.streets}
    streets = [(st, g['a'], g['b']) for st in city.streets for g in st['segs']]
    grid = P.Grid(2000.)
    for k, (_, a, b) in enumerate(streets):
        grid.add(k, P.bbox([a, b], 400))
    placed = P.Grid(1000.)
    worst = {'traffic': 1e9, 'street': 1e9, 'own lane': 1e9, 'car': 1e9}
    for slot in s['slots']:
        poly = P.footprint(slot)
        mine = by_id[slot['way']]
        worst['traffic'] = min(worst['traffic'], min_dist(poly, [city.traffic[i] for i in near(city.traffic_grid, poly, 400)]))
        for i in near(grid, poly, 400):
            st, a, b = streets[i]
            key = 'own lane' if own_street(mine, st) and not mine['traffic'] else 'street'
            worst[key] = min(worst[key], P.poly_seg_dist(poly, a, b))
        for other in placed.query(P.bbox(poly, 100)):
            worst['car'] = min(worst['car'], P.poly_poly_dist(poly, other))
        placed.add(tuple(poly), P.bbox(poly))
    print('   nearest traffic centre line %.1f cm, street %.1f cm, own centre line off the traffic graph %.1f cm, '
          'car to car %.1f cm' % (worst['traffic'], worst['street'], worst['own lane'], worst['car']))
    assert worst['traffic'] >= 300. - 1e-6 and worst['street'] >= 200. - 1e-6 and worst['own lane'] >= 150. - 1e-6 \
        and worst['car'] >= 40. - 1e-6, worst


@check('3 m from hydrants, 7 m from junctions, lane mouths and driveways open')
def check_points():
    s = load()
    city, f = s['city'], s['features']
    # Nodes where a street crosses or meets another at 25 degrees or more; a fork of one avenue's carriageways is not one.
    junctions = [j['p'] for j in city.junctions if len(j['arms']) >= 3 and
                 any(abs(P.cross(a['u'], b['u'])) > math.sin(math.radians(P.ARM_ANGLE)) for a in j['arms'] for b in j['arms'])]
    worst = {'hydrant': 1e9, 'junction': 1e9, 'alley': 1e9, 'driveway': 1e9}
    for slot in s['slots']:
        poly = P.footprint(slot)
        c = (slot['x'], slot['y'])
        worst['hydrant'] = min([worst['hydrant']] + [P.poly_point_dist(poly, h) for h in f.hydrants if math.dist(h, c) < 1500])
        worst['junction'] = min([worst['junction']] + [P.poly_point_dist(poly, j) for j in junctions if math.dist(j, c) < 3000])
        for k in near(city.service_grid, poly, 400):
            item = city.service[k]
            kind = 'alley' if item['tags'].get('service') == 'alley' else 'driveway'
            worst[kind] = min(worst[kind], min_dist(poly, list(zip(item['points'], item['points'][1:]))))
    print('   nearest hydrant %.0f, junction node %.0f, lane %.0f, driveway %.0f cm' % tuple(worst.values()))
    assert worst['hydrant'] >= 300. and worst['junction'] >= 700. and worst['alley'] >= 315. and worst['driveway'] >= 250., worst


def painted_crossings(city):
    """Crossing ways across a street that the replica paints: signalled, marked, uncontrolled or zebra, or within
    25 m of a stop sign or traffic lights (plateau_replica.crossing_records)."""
    marks = [city.nodes[n] for n, t in city.node_tags.items() if t.get('highway') in ('stop', 'traffic_signals')]
    out = []
    for w in city.ways:
        t = w['tags']
        if t.get('footway') != 'crossing' and t.get('highway') != 'crossing':
            continue
        pts = [city.nodes[r] for r in w['refs']]
        for a, b in zip(pts, pts[1:]):
            if not any(P.crosses(a, b, g['a'], g['b']) for st in city.streets for g in st['segs']):
                continue
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if t.get('crossing') in ('traffic_signals', 'uncontrolled', 'marked', 'zebra') or \
                    t.get('crossing:markings') in ('yes', 'zebra', 'lines') or any(math.dist(mid, q) < 2500 for q in marks):
                out.append((a, b))
    return out


@check('5 m past every painted crosswalk')
def check_crossings():
    s = load()
    lines = painted_crossings(s['city'])
    assert len(lines) > 20, len(lines)
    worst = min(min_dist(P.footprint(slot), [ln for ln in lines if min(math.dist(ln[0], (slot['x'], slot['y'])),
                                                                         math.dist(ln[1], (slot['x'], slot['y']))) < 4000])
                for slot in s['slots'])
    print('   %d painted crosswalks; nearest car %.0f cm from a centre line' % (len(lines), worst))
    assert worst >= P.CROSSING_CLEAR, worst


def curb_side(s, slot):
    """+1 when the curb is on the car's left (its yaw rotated +90 degrees), -1 on its right, by the nearer raised top."""
    yaw = math.radians(slot['yaw'])
    left = (-math.sin(yaw), math.cos(yaw))
    c = (slot['x'], slot['y'])
    hits = []
    for sign in (1, -1):
        d = (left[0] * sign, left[1] * sign)
        t = s['curbs'].ray(c, d, 300.)
        hits.append((1e9 if t is None else t, sign))
    return min(hits)[1]


@check('a 17-25 cm curb beside every car, nothing raised under it, replica asphalt under it')
def check_curbs():
    s = load()
    gaps, bad = [], []
    for slot in s['slots']:
        yaw = math.radians(slot['yaw'])
        u, left = (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw))
        side = curb_side(s, slot)
        d = (left[0] * side, left[1] * side)
        row = []
        for along in (-200., 0., 200.):
            o = (slot['x'] + u[0] * along, slot['y'] + u[1] * along)
            t = s['curbs'].ray(o, d, 300.)
            row.append(None if t is None else t - P.CAR_HALF_W)
        if any(g is None for g in row) or min(row) < 2. or max(row) > 60. or max(row) - min(row) > 40.:
            bad.append((slot['id'], row))
            continue
        gaps += row
        poly = P.footprint(slot)
        c = (slot['x'], slot['y'])
        for fx in (-.9, -.45, 0., .45, .9):
            for fy in (-.9, 0., .9):
                p = (c[0] + u[0] * fx * P.CAR_LENGTH / 2 + left[0] * fy * P.CAR_HALF_W,
                     c[1] + u[1] * fx * P.CAR_LENGTH / 2 + left[1] * fy * P.CAR_HALF_W)
                if s['curbs'].contains(p):
                    bad.append((slot['id'], 'raised under the car'))
        for p in [c] + [(q[0] * .9 + c[0] * .1, q[1] * .9 + c[1] * .1) for q in poly]:
            if not s['asphalt'].contains(p):
                bad.append((slot['id'], 'no replica asphalt'))
    gaps.sort()
    print('   mirror to curb: median %.1f cm, 5th to 95th percentile %.1f to %.1f cm' %
          (gaps[len(gaps) // 2], gaps[len(gaps) // 20], gaps[-len(gaps) // 20]))
    assert not bad, bad[:10]


@check('clear of extensions, road props, bollards and the chantier, and out of bus and taxi zones')
def check_features():
    s = load()
    f, city = s['features'], s['city']
    bad = []
    for slot in s['slots']:
        poly = P.footprint(slot)
        c = (slot['x'], slot['y'])
        if any(P.poly_poly_dist(poly, e) < P.EXTENSION_CLEAR for e in f.extensions if math.dist(e[0], c) < 3000):
            bad.append((slot['id'], 'extension'))
        if any(P.poly_poly_dist(poly, f.props[k]['poly']) < max(f.props[k]['clear'], .01) for k in near(f.prop_grid, poly, 100)):
            bad.append((slot['id'], 'prop'))
        if any(P.poly_point_dist(poly, b) < P.BOLLARD_CLEAR for b in s['bollards'] if math.dist(b, c) < 600):
            bad.append((slot['id'], 'bollard'))
        if any(len(z) >= 3 and P.poly_poly_dist(poly, z) < P.ZONE_CLEAR for z in f.zones):
            bad.append((slot['id'], 'chantier'))
        # A stop on this car's curb side closes 15 m before it and 5 m after it in the car's direction of travel.
        yaw = math.radians(slot['yaw'])
        u, left = (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw))
        side = curb_side(s, slot)
        for stops, before, after in ((f.bus_stops, P.BUS_ZONE[0], P.BUS_ZONE[1]), (f.taxis, P.TAXI_ZONE, P.TAXI_ZONE)):
            for p in stops:
                rel = P.sub(p, c)
                lateral = P.dot(rel, left) * side
                ahead = P.dot(rel, u)
                # 5 cm of slack for the car's own yaw jitter.
                if 0. < lateral < P.BUS_REACH + P.CAR_HALF_W and -after - P.CAR_LENGTH / 2 + 5. < ahead < before + P.CAR_LENGTH / 2 - 5.:
                    bad.append((slot['id'], 'stop zone', round(ahead), round(lateral)))
    assert not bad, bad[:10]
    assert len(f.bus_stops) >= 40 and len(f.extensions) >= 50 and len(s['bollards']) > 100


# ---------------------------------------------------------------------------------------------------------------
# Counts

# Saint-Christophe is signed for parking on one face of each block (the city's SD-TT and AD-TT signs ban the other).
PLEX_STREETS = {'Rue de Mentana': 70, 'Rue Fabre': 35, 'Rue Garnier': 35, 'Rue Saint-André': 55,
                'Rue De Lanaudière': 25, 'Rue Chambord': 20, 'Rue Marquette': 25, 'Rue Saint-Christophe': 12,
                'Rue Dorion': 30, 'Rue Saint-Hubert': 35, 'Rue Cartier': 40, 'Rue Rivard': 8}


@check('counts per street side, bodies and paints')
def check_counts():
    s = load()
    slots, doc = s['slots'], s['doc']
    by = doc['counts']['by_street']
    assert len(slots) >= 1700, len(slots)
    for street, least in PLEX_STREETS.items():
        assert by[street]['L'] >= least and by[street]['R'] >= least, (street, by[street], least)
    # A one-way street's cars face its traffic; both sides of Mentana face the same way.
    yaws = {round(r['yaw'] / 10) for r in slots if r['street'] == 'Rue de Mentana' and r['way'] == '132182118'}
    assert len(yaws) <= 3, yaws
    for key, count in (('by_body', 3), ('by_paint', 4)):
        values = doc['counts'][key]
        assert len(values) == count and min(values) > len(slots) / count / 2, (key, values)
    print('   %d slots, %d free spaces; Mentana %s, Fabre %s' % (len(slots), doc['counts']['vacant'],
                                                              by['Rue de Mentana'], by['Rue Fabre']))


# ---------------------------------------------------------------------------------------------------------------
# Rules as fixtures

@check('parking sides: bus lanes, explicit tags, one-sided tags, the C++ bit and bike lanes')
def check_sides():
    sp = P.side_parking
    assert sp({'cycleway:right': 'share_busway', 'parking:both': 'lane'}, 'right', 2) == (False, 'bus lane')
    assert sp({'cycleway:right': 'share_busway', 'parking:both': 'lane'}, 'left', 2) == (True, 'tag')
    # Fabre's contraflow lane runs outside the parked cars (bike_band in plateau_replica.py): the tag wins.
    assert sp({'cycleway:left': 'lane', 'parking:both': 'lane'}, 'left', 0) == (True, 'tag')
    assert sp({'parking:right': 'lane'}, 'left', 2) == (False, 'other side only')
    assert sp({}, 'left', 0) == (False, 'traffic') and sp({}, 'left', 2) == (True, 'traffic')
    # A separate track closes only the side it runs along; a painted lane or track at the curb closes its own.
    assert sp({'cycleway:both': 'separate'}, 'right', None) == (True, 'default')
    assert sp({'cycleway:both': 'separate'}, 'right', None, None, True) == (False, 'bike track')
    assert sp({'cycleway:both': 'separate', 'parking:both': 'lane'}, 'left', None, None, True) == (False, 'bike track')
    assert sp({'cycleway:right': 'track'}, 'right', None) == (False, 'bike lane')
    assert sp({}, 'right', None) == (True, 'default')
    # The city's signs open a side the tags or the C++ bit leave bare, never a bike lane at the curb.
    assert sp({'parking:right': 'lane'}, 'left', 2, None, False, True) == (True, 'city signs')
    assert sp({}, 'left', 0, None, False, True) == (True, 'city signs')
    assert sp({'cycleway:left': 'lane'}, 'left', 2, 'curb', False, True) == (False, 'bike lane')
    # A bus lane in its hours closes the curb; Papineau's peak-hour lane is a parking lane at midday.
    papineau = {'busway:right': 'lane', 'cycleway:right': 'share_busway', 'oneway': 'yes', 'parking:both': 'lane',
                'lanes:psv:conditional': '1 @ (Mo-Fr 06:30-09:30)'}
    assert sp(papineau, 'right', 1) == (True, 'tag')
    assert sp(dict(papineau, **{'lanes:psv:conditional': '1 @ (Mo-Fr 11:00-14:00)'}), 'right', 1) == (False, 'bus lane')
    assert sp({k: v for k, v in papineau.items() if k != 'lanes:psv:conditional'}, 'right', 1) == (False, 'bus lane')
    assert sp({'parking:right': 'street_side', 'parking:right:orientation': 'diagonal'}, 'right', 1) == (False, 'not parallel')
    assert sp({'parking:both': 'no'}, 'left', 2) == (False, 'tag no')
    # The replica's paint: a bike lane outside a parking band has cars inside it, one along the curb has none.
    assert sp({'cycleway:left': 'lane'}, 'left', 0, 'band') == (True, 'beside a bike lane')
    assert sp({'cycleway:left': 'lane'}, 'left', 2, 'curb') == (False, 'bike lane')
    assert sp({'cycleway:left': 'lane', 'parking:both': 'no'}, 'left', 2, 'band') == (False, 'tag no')


@check('the curb under a car: missing, bending or straight')
def check_curb_under():
    straight = [550.] * 40
    assert P.curb_under(straight, 1000.) == 550.
    bent = straight[:]
    bent[20] = 570.
    assert P.curb_under(bent, 1000.) is None and P.curb_under(bent, 1600.) == 550.
    gap = straight[:]
    gap[18] = None
    assert P.curb_under(gap, 1000.) is None
    assert P.curb_under(straight, 100.) is None, 'a car needs curb past both bumpers'


@check('a bus zone lies before the stop in the game traffic direction')
def check_bus_zone():
    street = {'id': 'test', 'name': 'test', 'width': 620., 'traffic': True}
    checker = P.Checker.__new__(P.Checker)
    for side in (1, -1):
        run = P.Run(street, (0., 0.), (10000., 0.), side, 0, [])
        checker.run_curb = {id(run): 550.}
        stop = [run.point(5000., 550.)]
        ahead = 1 if side > 0 else -1
        # A car just before the stop in the direction of travel is in the zone; one 6 m past it is not.
        assert checker.in_stop_zone(run, run.point(5000. - ahead * 1000., 420.), stop, P.BUS_ZONE)
        assert not checker.in_stop_zone(run, run.point(5000. + ahead * 800., 420.), stop, P.BUS_ZONE)
        # A stop across the street does not close this curb.
        far = [run.point(5000., -550.)]
        assert not checker.in_stop_zone(run, run.point(5000., 420.), far, P.BUS_ZONE)


# ---------------------------------------------------------------------------------------------------------------
# The city's parking signs

ALLOW_REASONS = ('side: bike track', 'side: bike lane', 'side: bus lane', 'side: not parallel', 'side: tag no',
                 'side: other side only', 'side: traffic', 'short run', 'run end', 'curb', 'asphalt', 'traffic',
                 'street', 'hydrant', 'crossing', 'lane mouth', 'driveway', 'junction', 'extension', 'prop', 'bollard',
                 'chantier', 'bus stop', 'taxi stand', 'sign', 'car')


@check('the sign texts at the moment, the arrows and the OSM bus lanes\' hours')
def check_sign_rules():
    rule = S.regulation
    assert rule('R-PF', '\\P 9h-23h EXCEPTE S3R') == 'allow'            # residents' permits
    assert rule('AD-TT', '\\A EN TOUT TEMPS') == 'ban' and rule('SD-TT', '\\P EN TOUT TEMPS') == 'ban'
    assert rule('SV-AD-A', '\\P 7h-8h LUN A VEN 1 AVRIL AU 1 DEC') == 'allow'   # Rachel's park side, cleaning at 7
    assert rule('SU-MJ-A', '\\P 12h-13h MARDI 1 AVRIL AU 1 DEC') == 'allow'     # a Tuesday; the moment is a Wednesday
    assert rule('SU-NC-A', '\\P 12h-13h MERCREDI 1 AVRIL AU 1 DEC') == 'ban'
    assert rule('AV-DB', '\\A 06h30-09h30  15h30-18h30 LUN. AU VEN.') == 'allow'
    assert rule('AV-JL', '\\A 6h-20h LUN À VEN') == 'ban'
    assert rule('SE-JC', '\\P 08h-17h LUN A VEN SEPT A JUIN') == 'ban'            # a school zone in October
    assert rule('SE-JC', '\\P 08h-17h LUN A VEN SEPT A JUIN', {'weekday': 2, 'hour': 12.5, 'month': 7}) == 'allow'
    assert rule('SL-AN', '\\P 8h-12h LUN A VEN EXCEPTE LIVRAISON') == 'allow'
    assert rule('SL-JZ', '\\P 8h-15h LUN A VEN EXCEPTE LIVRAISON') == 'ban'
    assert rule('SD-VR', '\\P CARAVANE  HABITATION MOTORISEE  VEHICULE RECREATIF') == 'allow'
    assert rule('RD-TT', '\\P EXCEPTE HANDICAPES DEBARCADERE SEULEMENT') == 'ban'
    assert rule('R-TA', '\\P EXCEPTE TAXIS') == 'ban' and rule('LAC-8', "\\ARRÊT INTERDIT ZONE D'AUTOBUS") == 'ban'
    assert rule('PV-JE', 'P 60 min 08h-19h LUN. AU VEN.') == 'allow'
    # Left and right are the reader's, facing the sign from the carriageway.
    assert S.arrow_directions('2', -1) == (1,) and S.arrow_directions('2', 1) == (-1,)
    assert S.arrow_directions('3', -1) == (-1,) and S.arrow_directions('8', 1) == (1, -1)
    assert S.arrow_directions('0', 1) is None
    assert not S.condition_active('1 @ (Mo-Fr 06:30-09:30)') and S.condition_active('1 @ (We 12:00-13:00)')
    assert S.condition_active('no condition')


@check('a separate cycle track closes only the side it runs along (prepare_car_parking.py, RoadParkingSides)')
def check_track_sides():
    tracks = [((0., 600.), (10000., 600.))]                        # 6 m left of a road along +x
    assert C.track_sides((0., 0.), (10000., 0.), tracks) == {'left'}
    assert C.track_sides((10000., 0.), (0., 0.), tracks) == {'right'}
    assert C.track_sides((0., 0.), (10000., 0.), [((5000., -3000.), (5000., 3000.))]) == set(), 'a crossing track'
    assert C.side_mask({'cycleway:both': 'separate'}, {'right'}) == 2
    assert C.side_mask({'cycleway:both': 'separate'}, set()) == 3
    assert C.side_mask({'cycleway:right': 'lane'}, set()) == 2 and C.side_mask({'parking:both': 'no'}, set()) == 0
    # The committed metadata: Rachel's park side (OSM left of its ways) takes cars, its north side with the track not.
    s = load()
    city = s['city']
    rachel = [g['traffic'] for st in city.streets if st['name'] == 'Rue Rachel Est' for g in st['segs'] if g['traffic'] is not None]
    assert len(rachel) >= 20, rachel
    bits = [city.sides[k] for k in rachel]
    assert all(b == 2 for b in bits), bits
    header = (ROOT / 'Source/Quebec/LaFontaineMap.h').read_text()
    values = header.split('const int8 RoadParkingSides[] = {\n', 1)[1].split('\n};', 1)[0].split(',')
    assert [int(v) for v in values] == city.sides, 'LaFontaineMap.h and parking.json disagree: run Scripts/prepare_car_parking.py'


def sign_poles():
    """The parking-sign poles by the streets, matched as the generator matches them."""
    return load()['city'].signs.poles


@check('every side two or more poles sign for parking holds cars or a listed reason; Rachel\'s park side holds cars')
def check_signed_sides():
    s = load()
    slots, doc = s['slots'], s['doc']
    signs = doc['counts'].get('signs')
    assert signs, 'parked_cars.json has no sign report: run Scripts/plateau_parking.py'
    have = {}
    for slot in slots:
        have[(slot['way'], slot['side'])] = have.get((slot['way'], slot['side']), 0) + 1
    explained = {(r['pole'], r['way'], r['side']): r['reason'] for r in signs['without_car']}
    allow = {}
    for pole in sign_poles():
        if any(g['rule'] == 'allow' for g in pole['signs']):
            allow.setdefault((pole['way'], 'L' if pole['side'] > 0 else 'R'), []).append(pole['id'])
    bare = []
    for (way, side), poles in sorted(allow.items()):
        if len(poles) < P.SIGNED_POLES or have.get((way, side)):
            continue
        for pole in poles:
            reason = explained.get((pole, way, side))
            if reason not in ALLOW_REASONS:
                bare.append((way, side, pole, reason))
    assert not bare, bare[:10]
    park_side = sum(1 for slot in slots if slot['street'] == 'Rue Rachel Est' and slot['side'] == 'L')
    north = sum(1 for slot in slots if slot['street'] == 'Rue Rachel Est' and slot['side'] == 'R')
    papineau = sum(1 for slot in slots if slot['way'] in ('25876960', '465376930') and slot['side'] == 'R')
    print('   %d signed sides; Rachel park side %d cars, north side %d; Papineau park side %d' %
          (signs['signed_sides'], park_side, north, papineau))
    assert park_side >= 25 and north == 0 and papineau >= 20, (park_side, north, papineau)


@check('no ban (AD-TT, SD-TT) covers a car within 4 m of its pole, the way its arrow points')
def check_sign_bans():
    s = load()
    grid = P.Grid(2000.)
    for k, slot in enumerate(s['slots']):
        grid.add(k, P.bbox([(slot['x'], slot['y'])]))
    bad, checked = [], 0
    for pole in sign_poles():
        for g in pole['signs']:
            if g['code'] not in ('AD-TT', 'SD-TT') or g['rule'] != 'ban':
                continue
            checked += 1
            dirs = S.arrow_directions(g['arrow'], pole['side'])
            for k in grid.query(P.bbox([pole['p']], 1500.)):
                slot = s['slots'][k]
                if (slot['street'] or slot['way']) != pole['name']:
                    continue
                rel = P.sub((slot['x'], slot['y']), pole['foot'])
                if not 0. < P.dot(rel, pole['n']) < P.SIGN_REACH:
                    continue                            # the other side, or the far carriageway of a divided avenue
                along = P.dot(rel, pole['u'])
                lo, hi = along - P.CAR_LENGTH / 2, along + P.CAR_LENGTH / 2
                for d in dirs or (1, -1):
                    span = (0., 400.) if d > 0 else (-400., 0.)
                    if hi > span[0] and lo < span[1]:
                        bad.append((pole['id'], g['code'], g['arrow'], slot['id']))
    print('   %d AD-TT and SD-TT signs; %d cover a car' % (checked, len(bad)))
    assert checked > 150 and not bad, bad[:10]


@check('every permit or street-cleaning pole has a car within 15 m on its curb, or a listed reason')
def check_allow_poles():
    s = load()
    explained = {r['pole']: r['reason'] for r in s['doc']['counts']['signs']['without_car']}
    grid = P.Grid(2000.)
    for k, slot in enumerate(s['slots']):
        grid.add(k, P.bbox([(slot['x'], slot['y'])]))
    total, without, bad = 0, 0, []
    for pole in sign_poles():
        if not any(g['rule'] == 'allow' and (g['code'].startswith('R-') or g['code'].startswith('SU-')) for g in pole['signs']):
            continue
        total += 1
        near = [k for k in grid.query(P.bbox([pole['p']], 1500.))
                if (s['slots'][k]['street'] or s['slots'][k]['way']) == pole['name'] and
                math.dist((s['slots'][k]['x'], s['slots'][k]['y']), pole['p']) <= 1500. and
                P.dot(P.sub((s['slots'][k]['x'], s['slots'][k]['y']), pole['foot']), pole['n']) > 0.]
        if near:
            continue
        without += 1
        if explained.get(pole['id']) not in ALLOW_REASONS:
            bad.append((pole['id'], explained.get(pole['id'])))
    print('   %d R and SU poles, %d without a car within 15 m (%d without a listed reason)' % (total, without, len(bad)))
    # A quarter at most: the poles by Rachel's and Brébeuf's cycle tracks, at a corner or on a curb the replica does
    # not draw straight are listed, the rest have cars.
    assert total > 300 and not bad and without <= total * .25, (total, without, bad[:10])


# ---------------------------------------------------------------------------------------------------------------
# C++

@check('C++ rules and the generated header, with every compiler')
def check_cpp():
    source = ROOT / 'Scripts/parked_rules_test.cpp'
    flags = ['-std=c++20', '-Wall', '-Wextra', '-Wshadow', '-Wconversion', '-Wdouble-promotion', '-Werror', '-O1']
    compilers = [c for c in ('c++', 'g++', 'clang++') if shutil.which(c)]
    assert compilers, 'no C++ compiler found'
    outs = set()
    with tempfile.TemporaryDirectory() as tmp:
        for c in compilers:
            strict = subprocess.run([c, *flags, '-fsyntax-only', '-DQUEBEC_PARKED_STRICT', str(source)], capture_output=True, text=True)
            assert strict.returncode == 0, strict.stderr
            binary = Path(tmp) / ('rules_' + c.replace('+', 'p'))
            build = subprocess.run([c, *flags, str(source), '-o', str(binary)], capture_output=True, text=True)
            assert build.returncode == 0, build.stderr
            run = subprocess.run([str(binary)], capture_output=True, text=True)
            assert run.returncode == 0, run.stdout + run.stderr
            outs.add(run.stdout.strip())
    assert len(outs) == 1, outs
    print('   ' + outs.pop())


def wiring_problems(gameplay, combat, actor, actor_header, rules, police=''):
    """What the game wiring lacks, from the source texts (empty when it is complete)."""
    out = []
    spawn = 'AQuebecParkedCars::SpawnFill(GetWorld());'
    props = gameplay.find('AQuebecStreetProp::SpawnStreetProps(GetWorld());')
    ambient = gameplay.find('TEXT("NordNoAmbient")')
    if gameplay.count(spawn) != 2 or props < 0 or gameplay.find(spawn, props) < 0:
        out.append('the fill does not spawn after the street props')
    if ambient < 0 or not (ambient < gameplay.find(spawn, ambient) < gameplay.find('return;', ambient)):
        out.append('look runs (-NordNoAmbient) do not get the fill')
    hook = gameplay.find('AQuebecParkedCars::PromoteOnImpact(Hit,Velocity)')
    if hook < 0 or hook > gameplay.find('if (Other && Other != this)', hook):
        out.append('a car hitting a parked car does not promote it')
    bay, enter, talk = (gameplay.find(k) for k in ('Bay->HandleInteract(this)) return;', 'FindEnterableParkedSlot(Resident)',
                                                   'Resident->Acknowledge(Character, true)'))
    if not (0 <= bay < enter < talk):
        out.append('E does not take a parked car after the jobs and before the residents')
    if 'FindEnterableParkedSlot(Resident) != INDEX_NONE) Prompt = TEXT("[ E ]  ENTER CAR")' not in gameplay:
        out.append('the HUD does not offer E at a parked car')
    if 'ParkedGoal = 32' not in gameplay:
        out.append('the 32 runtime parked cars changed')
    if 'AQuebecParkedCars::PromoteOnLine(World, Muzzle, bHit ? TargetPoint : Impact, ParkedImpact)' not in combat:
        out.append('a shot does not find a parked car on its own line')
    # The tech review: the boxes were floor for every Visibility ground trace (ExitCar put a player on a roof), and a
    # thrown person's hit event came after the movement had turned its velocity into a slide.
    if 'Boxes->SetCollisionResponseToChannel(ECC_Visibility, ECR_Ignore);' not in actor:
        out.append('the parked boxes block the Visibility channel, so floor probes land on their roofs')
    if 'NotifyHit' in actor or 'GetVelocity()' in actor:
        out.append('the thrown-person path reads the velocity after the move (NotifyHit)')
    for text, owner in ((gameplay, 'AQuebecCharacter'), (police, 'AQuebecOfficer')):
        body = text.split(f'void {owner}::MoveBlockedBy(const FHitResult& Impact)', 1)
        if len(body) < 2 or 'AQuebecParkedCars::PromoteOnBody(Impact, GetCharacterMovement()->Velocity, this)' not in body[1][:400]:
            out.append(f'{owner} does not promote a parked car it is thrown into (MoveBlockedBy)')
    if 'TActorIterator<AQuebecStreetProp>' not in actor or 'PropTakes(Pivot, Props)' not in actor:
        out.append('the fill does not see the street props (cones, barricades) it must leave room for')
    if 'TileKey(Row.X, Row.Y)' not in actor or 'GroupOf(Where.Tile, Where.BodyGroup)' not in actor:
        out.append('the instanced components are not cut into tiles, so a promotion rebuilds the whole district')
    for needle in ('#include "LaFontaineParking.h"', 'M_Car70_Paint%d', 'Car70Body%d', 'Car70Cabin%d', 'Car70Roof%d',
                   'TEXT("Car70Tire")', 'TEXT("Car70Rim")', 'SetCullDistances(CullStart(Index), CullEnd(Index))',
                   'SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore)', 'DOREPLIFETIME(AQuebecParkedCars, PromotedSlots)',
                   'DOREPLIFETIME(AQuebecParkedCars, VacantSlots)', 'MaterialSlotName == TEXT("Paint")'):
        if needle not in actor:
            out.append('QuebecParkedCars.cpp lacks ' + needle)
    if 'ReplicatedUsing=OnRep_Hidden) TArray<int32> PromotedSlots' not in actor_header:
        out.append('promoted spaces do not replicate to clients')
    # The instanced parts sit where AQuebecCar's do (QuebecGameplay.cpp constructor and ApplyPaint).
    for car, rule in (('FVector(155., -95., -64.), FVector(.72, .72, .26), FRotator(0., 0., 90.)', 'WheelX = 155.f'),
                      ('Location.Y = Location.Y < 0. ? -106.5 : 106.5;', 'RimY = 106.5f'),
                      ('FVector(155., -95., -64.)', 'TireY = 95.f'), ('FVector(155., -95., -64.)', 'WheelZ = -64.f'),
                      ('FRotator(0.,0.,90.).Quaternion()', 'WheelRoll = 90.f'),
                      ('Supported.Z = SupportZ+.5', 'PivotHeight = 100.5f')):
        if car not in gameplay or rule not in rules:
            out.append(f'AQuebecCar and the instances disagree: {car} / {rule}')
    return out


@check('the game wiring')
def check_wiring():
    texts = [(SOURCE / n).read_text() for n in ('QuebecGameplay.cpp', 'QuebecCombat.cpp', 'QuebecParkedCars.cpp',
                                                'QuebecParkedCars.h', 'QuebecParkedRules.h', 'QuebecPolice.cpp')]
    problems = wiring_problems(*texts)
    assert not problems, problems


# ---------------------------------------------------------------------------------------------------------------
# Budget

SECTION_BUDGET = 500            # mesh sections the fill may draw in one view (main pass); the shadow pass draws fewer


@check('frame budget: tiles, components, sections, cars and triangles within the cull distances')
def check_budget():
    """The fill draws one instanced component per 190 m tile, part mesh and paint (QuebecParkedRules::TileKey), so a
    promotion rebuilds only its tile's components. Each component draws a section per material of its mesh. Counted
    for the worst view: the cars within each cull distance of a space, their triangles, and the sections of every
    component with an instance within its cull distance."""
    s = load()
    manifest = json.loads((ROOT / 'Data/SeventiesCars/manifest.json').read_text())
    tris = {Path(m['file']).stem: m['triangles'] for m in manifest['models']}
    sections = {Path(m['file']).stem: len(m['materials']) for m in manifest['models']}
    shell = max(tris[f'Car70Body{b}'] + tris[f'Car70Cabin{b}'] + tris[f'Car70Roof{b}'] for b in range(3))
    points = [(r['x'], r['y']) for r in s['slots']]
    grid = P.Grid(3000.)
    for k, p in enumerate(points):
        grid.add(k, P.bbox([p]))

    def tile(x, y):
        return (math.floor(x / 19000.), math.floor(y / 19000.))
    # The components: (tile, part mesh, paint) with the slots in them, and their cull distance.
    parts = {}
    for k, r in enumerate(s['slots']):
        t = tile(r['x'], r['y'])
        for mesh, paint, cull in ((f'Car70Body{r["body"]}', r['paint'], 9000.), (f'Car70Roof{r["body"]}', r['paint'], 9000.),
                                  (f'Car70Cabin{r["body"]}', None, 9000.), ('Car70Tire', None, 6000.), ('Car70Rim', None, 3500.)):
            parts.setdefault((t, mesh, paint, cull), []).append(k)
    tiles = {key[0] for key in parts}
    spans = []
    for t in tiles:
        xs = [points[k][0] for key, ks in parts.items() if key[0] == t for k in ks]
        ys = [points[k][1] for key, ks in parts.items() if key[0] == t for k in ks]
        spans.append(max(max(xs) - min(xs), max(ys) - min(ys)) + 500.)

    def most(reach):
        best = 0
        for p in points[::2]:
            best = max(best, sum(1 for k in grid.query(P.bbox([p], reach)) if math.dist(points[k], p) <= reach))
        return best
    bodies, tyres, rims = most(9000.), most(6000.), most(3500.)
    total = bodies * shell + tyres * 4 * tris['Car70Tire'] + rims * 4 * tris['Car70Rim']
    worst, worst_shadow = 0, 0
    for p in points[::4]:
        drawn = [key for key, ks in parts.items() if any(math.dist(points[k], p) <= key[3] for k in ks)]
        worst = max(worst, sum(sections[key[1]] for key in drawn))
        worst_shadow = max(worst_shadow, sum(sections[key[1]] for key in drawn if 'Tire' not in key[1] and 'Rim' not in key[1]))
    print('   %d tiles, %d components (and %d box components), the widest %.0f m; at most %d cars within 90 m, %d within 60 m, '
          '%d within 35 m: %.2f M triangles all round, before frustum culling; at most %d sections in a view, %d in its shadow pass'
          % (len(tiles), len(parts), len(tiles), max(spans) / 100, bodies, tyres, rims, total / 1e6, worst, worst_shadow))
    assert max(spans) <= 20000., ('an instanced component spans more than 200 m', max(spans))
    assert bodies <= 160 and total <= 2.2e6, (bodies, total)
    assert worst <= SECTION_BUDGET, ('the fill draws too many sections in one view', worst)


def main():
    if not (P.STREETS / 'manifest.json').is_file() or not list(P.STREETS.glob('Concrete_Collision_Replica_*.obj')):
        raise SystemExit('Run Scripts/plateau_replica.py first: the Streets OBJs are git-ignored.')
    failed = 0
    for name, fn in CHECKS:
        try:
            fn()
            print('ok  ', name)
        except AssertionError as error:
            failed += 1
            print('FAIL', name, '\n    ', str(error)[:2000])
    print('NORD_PARKING_OK' if not failed else f'NORD_PARKING_FAILED {failed}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
