"""Update parking direction metadata only; never regenerate roads or the map.

A side of a road takes parked cars unless OSM tags no parking there, or a bike lane or track at its curb. A way
tagged cycleway=separate has its cycle track drawn as its own way, which says nothing about which side it is on.
So 'separate' closes only the side along which a drawn track (highway=cycleway) runs, within TRACK_REACH of the
segment and within TRACK_ANGLE of its direction. Rue Rachel's track runs on its north side, so its park side
keeps its parking.
"""
import json
import math
import re
import xml.etree.ElementTree as ET
from prepare_lafontaine import DATA, ROOT, ROAD_HIGHWAYS, inside, tags, xy, road_segments_text

BIKE_AT_CURB = ('lane', 'track', 'opposite_lane', 'opposite_track')
PARK_NO = ('no', 'no_parking', 'no_stopping')
TRACK_REACH = 1500.     # cm from the road's centre line
TRACK_ANGLE = 20.       # degrees
TRACK_SAMPLES = (.25, .5, .75)


def cycle_tracks(ways):
    """The drawn cycle tracks, as segments in the map frame: ways is a list of (tags, points)."""
    return [(a, b) for t, pts in ways if t.get('highway') == 'cycleway'
            for a, b in zip(pts, pts[1:]) if math.dist(a, b) > 1.]


def track_sides(a, b, tracks):
    """The sides ('left', 'right', OSM sense) of the road segment a-b along which a drawn track runs."""
    length = math.dist(a, b)
    out = set()
    if length < 1.:
        return out
    u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    limit = math.sin(math.radians(TRACK_ANGLE))
    for f in TRACK_SAMPLES:
        m = (a[0] + u[0] * length * f, a[1] + u[1] * length * f)
        best = None
        for c, d in tracks:
            if min(c[0], d[0]) - TRACK_REACH > m[0] or max(c[0], d[0]) + TRACK_REACH < m[0] or \
                    min(c[1], d[1]) - TRACK_REACH > m[1] or max(c[1], d[1]) + TRACK_REACH < m[1]:
                continue
            v = (d[0] - c[0], d[1] - c[1])
            vl = math.hypot(*v)
            if abs(u[0] * v[1] - u[1] * v[0]) / vl > limit:
                continue
            t = max(0., min(1., ((m[0] - c[0]) * v[0] + (m[1] - c[1]) * v[1]) / vl ** 2))
            q = (c[0] + v[0] * t, c[1] + v[1] * t)
            dist = math.dist(m, q)
            if dist < TRACK_REACH and (best is None or dist < best[0]):
                best = (dist, 'left' if u[0] * (q[1] - m[1]) - u[1] * (q[0] - m[0]) > 0 else 'right')
        if best:
            out.add(best[1])
    return out


def side_mask(spec, tracked):
    """RoadParkingSides for one segment: bit 1 the right side, bit 2 the left (OSM sense). tracked: the sides along
    which a drawn track runs."""
    mask = 3
    for side, bit in (('right', 1), ('left', 2)):
        cycle = spec.get('cycleway:' + side, spec.get('cycleway:both', spec.get('cycleway', 'no')))
        parking = spec.get('parking:' + side, spec.get('parking:both', spec.get('parking:lane:' + side, spec.get('parking:lane:both', 'yes'))))
        if cycle in BIKE_AT_CURB or (cycle == 'separate' and side in tracked) or parking in PARK_NO:
            mask &= ~bit
    return mask


def main():
    osm = ET.parse(DATA/'osm.xml').getroot()
    nodes = {e.get('id'): (float(e.get('lat')), float(e.get('lon'))) for e in osm.findall('node')}
    ways = [(tags(way), [nodes[n.get('ref')] for n in way.findall('nd') if n.get('ref') in nodes]) for way in osm.findall('way')]
    tracks = cycle_tracks([(t, [xy(*p) for p in points]) for t, points in ways if t.get('highway') == 'cycleway'])
    roads, directions, sides = [], [], []
    for spec, points in ways:
        if len(points)<2 or not all(inside(p) for p in points) or spec.get('highway') not in ROAD_HIGHWAYS:
            continue
        road = [list(xy(*p)) for p in points]
        roads.append(road)
        direction = -1 if spec.get('oneway') == '-1' else 1 if spec.get('oneway') in ('yes', '1', 'true') else 0
        directions.extend([direction]*(len(points)-1))
        # Source XY: +cross(up, road) is the OSM left side.
        separate = 'separate' in {spec.get('cycleway:right'), spec.get('cycleway:left'), spec.get('cycleway:both'), spec.get('cycleway')}
        for a, b in zip(road, road[1:]):
            sides.append(side_mask(spec, track_sides(a, b, tracks) if separate else set()))
    assert roads == json.loads((DATA/'layout.json').read_text())['roads'], 'Road order changed'
    path = ROOT/'Source/Quebec/LaFontaineMap.h'
    header = path.read_text()
    assert road_segments_text(roads) in header, 'Road coordinates changed'
    assert set(directions) <= {-1,0,1} and len(directions) == sum(len(r)-1 for r in roads) == len(sides)
    for name, values in [('RoadParkingDirections',directions),('RoadParkingSides',sides)]:
        array = 'const int8 '+name+'[] = {\n'+','.join(map(str,values))+'\n};\n'
        if 'const int8 '+name+'[]' in header:
            header, count = re.subn(r'const int8 '+name+r'\[\] = \{\n[^}]*\};\n',lambda _: array,header)
            assert count == 1
        else:
            assert header.endswith('}\n')
            header = header[:-2]+array+'}\n'
    path.write_text(header)
    (DATA/'parking.json').write_text(json.dumps({'directions': directions, 'sides': sides},separators=(',',':'))+'\n')
    print('Parking direction metadata:',len(directions),'segments;',sum(bool(x) for x in directions),'one-way;',
          sum(1 for x in sides if x != 3),'segments with a side closed')


if __name__ == '__main__':
    main()
