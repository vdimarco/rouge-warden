"""Source alignment, north, island exclusion and metric scale of the park maps."""
import json
import math
import re
import struct
import xml.etree.ElementTree as ET

from plateau_cartography import ATTRIBUTION, BOARDS, HEIGHT, ROOT, TITLE, WIDTH, artwork, projection, source
from plateau_streets import _inside


def points(path):
    return [(float(a), float(b)) for a, b in re.findall(r'(-?[\d.]+),(-?[\d.]+)', path)]


def check():
    data = source()
    project, transform = projection(data['boundary'])
    origin, east, north = project((0, 0)), project((10000, 0)), project((0, 10000))
    assert east[0] > origin[0] and abs(east[1] - origin[1]) < 1e-9
    assert north[1] < origin[1] and abs(north[0] - origin[0]) < 1e-9
    assert abs(math.dist(origin, east) - math.dist(origin, north)) < 1e-9
    assert sum(len(pond['inner']) for pond in data['ponds']) == 1
    theatre = next(p for p in data['landmarks'] if p['source'] == 'node/7363083869')
    assert any(_inside(theatre['position_cm'], ring) for pond in data['ponds'] for ring in pond['inner'])
    ns = {'s': 'http://www.w3.org/2000/svg'}
    directory = ROOT / 'Data/Plateau/Cartography'
    report = json.loads((directory / 'cartography.json').read_text())
    for board in BOARDS:
        svg, record = artwork(data, board)
        assert svg == artwork(data, board)[0], 'SVG output must be deterministic'
        assert TITLE in svg and ATTRIBUTION in svg and 'openstreetmap.org/copyright' in svg
        assert 'VOUS ÊTES ICI' in svg and 'Centre culturel Calixa-Lavallée' in svg
        assert record['position_cm'] == list(board[2])
        assert record['path_edge_clearance_cm'] > 220
        facing = record['facing_normal_xy']
        assert abs(math.hypot(*facing) - 1) < 1e-9
        assert sum((record['nearest_path_point_cm'][i] - board[2][i]) * facing[i] for i in range(2)) > 0
        assert math.dist(project(board[2]), record['position_pixels']) < 1e-9
        document = ET.fromstring(svg)
        marker = next(c for c in document.findall('.//s:circle', ns) if c.get('r') == '15')
        assert math.dist((float(marker.get('cx')), float(marker.get('cy'))), project(board[2])) < .001
        for landmark, source_landmark in zip(record['landmarks'], data['landmarks']):
            assert landmark['source'] == source_landmark['source']
            assert math.dist(project(source_landmark['position_cm']), landmark['position_pixels']) < 1e-9
        boundary = document.find('.//s:path[@id="park-boundary"]', ns)
        assert all(math.dist(actual, project(expected)) < .001
                   for actual, expected in zip(points(boundary.get('d')), data['boundary']))
        for pond, source_pond in zip(record['ponds'], data['ponds']):
            path = document.find(f'.//s:path[@data-source="{pond["source"]}"]', ns)
            assert path.get('fill-rule') == 'evenodd'
            assert path.get('d').count('M') == len(source_pond['outer']) + len(source_pond['inner'])
            for ring, source_ring in zip(pond['inner_pixels'], source_pond['inner']):
                assert all(math.dist(actual, project(expected)) < 1e-9 for actual, expected in zip(ring, source_ring))
        buildings = {building['id']: building for building in data['buildings']}
        for path in document.findall('.//s:path[@class="source-building"]', ns)[::137]:
            building = buildings[path.get('data-source').split('/')[1]]
            assert all(math.dist(actual, project(expected)) < .001
                       for actual, expected in zip(points(path.get('d')), building['points']))
        scale_bar = document.find('.//s:g[@id="scale-bar"]', ns)
        widths = [float(rect.get('width')) for rect in scale_bar.findall('s:rect', ns)]
        assert len(widths) == 4 and abs(sum(widths) - math.dist(project((0, 0)), project((20000, 0)))) < .003
        assert record['scale_bar']['metres'] == 200
        assert abs(record['scale_bar']['length_pixels'] - 20000 * transform['pixels_per_cm']) < 1e-9
        arrow = points(document.find('.//s:path[@id="north-arrow"]', ns).get('d').replace(' ', ','))
        # SVG arrow's tip is at the smallest screen y, consistent with the projected northing.
        assert arrow and arrow[0][1] == min(point[1] for point in arrow)
        assert {label['text'] for label in record['street_labels']} == {
            'Rue Sherbrooke Est', 'Rue Rachel Est', 'Avenue du Parc-La Fontaine', 'Avenue Calixa-Lavallée'}
        assert (directory / record['svg']).read_text() == svg, 'Generated SVG must match current source'
        png = (directory / record['png']).read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n' and png[12:16] == b'IHDR'
        assert struct.unpack('>II', png[16:24]) == (WIDTH, HEIGHT)
        saved = next(b for b in report['boards'] if b['id'] == record['id'])
        assert saved['projection'] == record['projection'] and saved['position_pixels'] == record['position_pixels']
    return {'boards': len(BOARDS), 'ponds': len(data['ponds']), 'island_holes': 1, 'image_size': [WIDTH, HEIGHT]}


if __name__ == '__main__':
    print(json.dumps(check()))
