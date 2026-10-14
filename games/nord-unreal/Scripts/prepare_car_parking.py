"""Update parking direction metadata only; never regenerate roads or the map."""
import json
import re
import xml.etree.ElementTree as ET
from prepare_lafontaine import DATA, ROOT, ROAD_HIGHWAYS, inside, tags, xy, road_segments_text


def main():
    osm = ET.parse(DATA/'osm.xml').getroot()
    nodes = {e.get('id'): (float(e.get('lat')), float(e.get('lon'))) for e in osm.findall('node')}
    roads, directions, sides = [], [], []
    for way in osm.findall('way'):
        points = [nodes[n.get('ref')] for n in way.findall('nd') if n.get('ref') in nodes]
        spec = tags(way)
        if len(points)<2 or not all(inside(p) for p in points) or spec.get('highway') not in ROAD_HIGHWAYS:
            continue
        roads.append([list(xy(*p)) for p in points])
        direction = -1 if spec.get('oneway') == '-1' else 1 if spec.get('oneway') in ('yes', '1', 'true') else 0
        directions.extend([direction]*(len(points)-1))
        mask = 3
        # Source XY: +cross(up, road) is the OSM left side.
        for side, bit in [('right',1),('left',2)]:
            cycle = spec.get('cycleway:'+side, spec.get('cycleway:both', spec.get('cycleway','no')))
            parking = spec.get('parking:'+side, spec.get('parking:both', spec.get('parking:lane:'+side,spec.get('parking:lane:both','yes'))))
            if cycle in ('lane','track','separate','opposite_lane','opposite_track') or parking in ('no','no_parking','no_stopping'):
                mask &= ~bit
        sides.extend([mask]*(len(points)-1))
    assert roads == json.loads((DATA/'layout.json').read_text())['roads'], 'Road order changed'
    path = ROOT/'Source/Quebec/LaFontaineMap.h'
    header = path.read_text()
    assert road_segments_text(roads) in header, 'Road coordinates changed'
    assert set(directions) <= {-1,0,1} and len(directions) == sum(len(r)-1 for r in roads)
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
    print('Parking direction metadata:',len(directions),'segments;',sum(bool(x) for x in directions),'one-way')


if __name__ == '__main__':
    main()
