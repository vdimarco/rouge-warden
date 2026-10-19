"""Write the traffic approaches that face a mapped ARRÊT sign, from the checked-in OSM snapshot (ODbL).

Traffic drives only on LaFontaine::RoadSegments (the 663 original segments). Each highway=stop node is matched to the
graph junction it guards: the stop applies in the travel direction given by its `direction` tag (forward by default),
and the junction is the nearest graph junction ahead of the node within 20 m along that direction whose approach
segment runs along the same street. `stop=all` marks an all-way stop, so every graph approach into that junction
stops. The header stores one row per approach: the junction centre and the unit direction of travel into it.
"""
from pathlib import Path
import math
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
from prepare_lafontaine import DATA, ROAD_HIGHWAYS, tags, xy

MAP_HEADER = ROOT/'Source/Quebec/LaFontaineMap.h'
HEADER = ROOT/'Source/Quebec/LaFontaineStops.h'
LINK_CM = 40.            # TrafficRoadLinks joins segment ends within 40 cm
AHEAD_CM = (-100., 2000.)  # a stop node sits a few metres before the junction it guards
SIDE_CM = 600.           # and on the same street
ALIGNED = .9             # the approach segment runs along the stop's travel direction
BEND_DOT = -.94          # two-segment nodes that turn more than about 20 degrees are junctions too


def road_segments():
    """The exact LaFontaine::RoadSegments rows the game reads, as ((x, y), (x, y)) in centimetres."""
    text = MAP_HEADER.read_text()
    body = re.search(r'const FVector RoadSegments\[\]\[2\] = \{\n(.*?)\n\};', text, re.S).group(1)
    rows = []
    for line in body.split('\n'):
        v = [float(x) for x in re.findall(r'-?\d+\.\d+', line)]
        rows.append(((v[0], v[1]), (v[3], v[4])))
    return rows


def junctions(segments):
    """Graph nodes where traffic chooses or turns: clusters of segment ends with three or more ends, or a bend."""
    clusters = []
    for index, segment in enumerate(segments):
        for side in (0, 1):
            point = segment[side]
            for cluster in clusters:
                if math.dist(cluster['point'], point) <= LINK_CM:
                    cluster['ends'].append((index, side))
                    break
            else:
                clusters.append({'point': point, 'ends': [(index, side)]})
    found = []
    for cluster in clusters:
        ends = cluster['ends']
        if len(ends) >= 3 or (len(ends) == 2 and dot(outward(segments, *ends[0]), outward(segments, *ends[1])) > BEND_DOT):
            found.append(cluster)
    return found


def unit(v):
    length = math.hypot(*v)
    return (v[0]/length, v[1]/length)


def dot(a, b):
    return a[0]*b[0] + a[1]*b[1]


def outward(segments, index, side):
    """Unit direction leaving the junction along segment `index`, whose end `side` touches it."""
    end, other = segments[index][side], segments[index][1-side]
    return unit((other[0]-end[0], other[1]-end[1]))


def stop_nodes():
    """(node id, position, travel directions, all-way) for every highway=stop node on a mapped road way."""
    root = ET.parse(DATA/'osm.xml').getroot()
    nodes = {e.get('id'): (float(e.get('lat')), float(e.get('lon'))) for e in root.findall('node')}
    node_tags = {e.get('id'): tags(e) for e in root.findall('node') if e.find('tag') is not None}
    ways = {}
    for way in root.findall('way'):
        if tags(way).get('highway') not in ROAD_HIGHWAYS: continue
        refs = [n.get('ref') for n in way.findall('nd') if n.get('ref') in nodes]
        for index, ref in enumerate(refs): ways.setdefault(ref, []).append((refs, index))
    found = []
    for node, node_tag in sorted(node_tags.items(), key=lambda item: int(item[0])):
        if node_tag.get('highway') != 'stop' or node not in ways: continue
        point = xy(*nodes[node])
        direction = node_tag.get('direction', 'forward')
        travels = []
        for refs, index in ways[node]:
            # The way's own direction at the node; forward stops face traffic moving with the way.
            after = refs[index+1] if index+1 < len(refs) else None
            before = refs[index-1] if index > 0 else None
            if after is not None: way_dir = unit(tuple(b-a for a, b in zip(point, xy(*nodes[after]))))
            else: way_dir = unit(tuple(a-b for a, b in zip(point, xy(*nodes[before]))))
            if direction in ('forward', 'both'): travels.append(way_dir)
            if direction in ('backward', 'both'): travels.append((-way_dir[0], -way_dir[1]))
        found.append((int(node), point, travels, node_tag.get('stop') == 'all'))
    return found


def approaches():
    """Sorted, unique (segment, end side, junction point, travel direction, node id) stop approaches."""
    segments = road_segments()
    nodes = junctions(segments)
    rows = {}
    for node, point, travels, all_way in stop_nodes():
        for travel in travels:
            best = None
            for junction in nodes:
                offset = (junction['point'][0]-point[0], junction['point'][1]-point[1])
                along, side = dot(offset, travel), abs(offset[0]*travel[1]-offset[1]*travel[0])
                if not AHEAD_CM[0] <= along <= AHEAD_CM[1] or side > SIDE_CM: continue
                end = next(((i, s) for i, s in junction['ends'] if -dot(outward(segments, i, s), travel) >= ALIGNED), None)
                if end is not None and (best is None or along < best[0]): best = (along, junction, end)
            if best is None: continue
            _, junction, end = best
            for index, side in (junction['ends'] if all_way else [end]):
                if (index, side) in rows: continue
                into = outward(segments, index, side)
                rows[(index, side)] = (index, side, junction['point'], (-into[0], -into[1]), node)
    return [rows[key] for key in sorted(rows)]


def header_text(rows):
    vec = lambda p: 'FVector(' + ','.join(f'{v:.3f}' for v in p) + ')'
    body = ',\n'.join('{' + vec([*point, 0.]) + ',' + vec([*travel, 0.]) + '}' for _, _, point, travel, _ in rows)
    segments = ','.join(str(index) for index, *_ in rows)
    nodes = ','.join(str(node) for *_, node in rows)
    return ('// Generated by Scripts/prepare_lafontaine_stops.py. OSM contributors, ODbL 1.0.\n#pragma once\nnamespace LaFontaine {\n'
            '// Traffic approaches that face a mapped ARRET sign (highway=stop): the junction centre on RoadSegments,\n'
            '// then the unit direction of travel into it. StopSegments holds the RoadSegments index of each approach.\n'
            f'// Source stop nodes: {nodes}\n'
            'const FVector StopApproaches[][2] = {\n' + body + '\n};\n'
            'const int32 StopSegments[] = {' + segments + '};\n'
            f'constexpr int32 StopApproachCount = {len(rows)};\n'
            'static_assert(sizeof(StopApproaches) / sizeof(StopApproaches[0]) == StopApproachCount, "stop approach rows");\n'
            'static_assert(sizeof(StopSegments) / sizeof(StopSegments[0]) == StopApproachCount, "stop approach segments");\n'
            '}\n')


def main():
    rows = approaches()
    HEADER.write_text(header_text(rows))
    print('NORD_LAFONTAINE_STOPS', len(rows), 'approaches at', len({(round(p[0]), round(p[1])) for _, _, p, _, _ in rows}), 'junctions')


if __name__ == '__main__':
    main()
