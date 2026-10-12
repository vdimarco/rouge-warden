"""North-up French park orientation artwork from the checked-in OSM snapshot."""
import hashlib
import html
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

from plateau_park import park_survey
from plateau_streets import _distance, _inside
from prepare_lafontaine import ROOT, tags, xy
from prepare_plateau import geography

TITLE = 'PARC LA FONTAINE'
ATTRIBUTION = '© OpenStreetMap contributors · ODbL 1.0'
WIDTH, HEIGHT = 1536, 2048
PLOT = (80, 245, 1376, 1450)
LANDMARKS = [('7363083869', 'Théâtre de Verdure'),
             ('5676717522', 'Centre culturel Calixa-Lavallée')]
# Positions are approved by the scene owner before prepare() is invoked.
BOARDS = [('EntreeCalixa', 'Entrée Calixa-Lavallée', (36115, -609)),
          ('PromenadeEtangs', 'Promenade des étangs', (13500, -8000))]
PALETTE = {'paper': '#f6f2e5', 'ink': '#283c35', 'quiet': '#627266',
           'park': '#d6dfc7', 'park_edge': '#849477', 'water': '#9bb2b5',
           'road': '#ded9ca', 'path': '#fcf8ea', 'building': '#a9aa99', 'here': '#963f35'}


def projection(boundary):
    """Uniform source-centimetre to SVG projection; larger northing goes upward."""
    margin = 3500
    bounds = (min(p[0] for p in boundary) - margin, min(p[1] for p in boundary) - margin,
              max(p[0] for p in boundary) + margin, max(p[1] for p in boundary) + margin)
    left, top, width, height = PLOT
    scale = min(width / (bounds[2] - bounds[0]), height / (bounds[3] - bounds[1]))
    offset_x = left + (width - (bounds[2] - bounds[0]) * scale) / 2
    offset_y = top + (height - (bounds[3] - bounds[1]) * scale) / 2

    def project(point):
        return (offset_x + (point[0] - bounds[0]) * scale,
                offset_y + (bounds[3] - point[1]) * scale)
    return project, {'source_bounds_cm': list(bounds), 'pixels_per_cm': scale,
                     'offset_pixels': [offset_x, offset_y], 'north': [0, -1], 'rotation_degrees': 0}


def source():
    ponds, boundary, benches = park_survey()
    buildings, roads = geography()
    root = ET.parse(ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {node.get('id'): node for node in root.findall('node')}
    landmarks = []
    for ident, label in LANDMARKS:
        node = nodes[ident]
        landmarks.append({'source': 'node/' + ident, 'name': label,
                          'source_name': tags(node)['name'],
                          'position_cm': list(xy(float(node.get('lat')), float(node.get('lon'))))})
    return {'ponds': ponds, 'boundary': boundary, 'benches': benches,
            'buildings': buildings, 'roads': roads, 'landmarks': landmarks}


def board_clearance(data, position):
    paths = [(a, b, road['width'], road['id']) for road in data['roads']
             if road['tags'].get('highway') in ('path', 'footway', 'pedestrian')
             for a, b in zip(road['points'], road['points'][1:])]
    assert _inside(position, data['boundary']), 'Board must be on park land'
    assert not any(_inside(position, ring) for pond in data['ponds'] for ring in pond['outer'])
    assert not any(_inside(position, building['points']) for building in data['buildings'])
    margin, a, b, ident = min((_distance(position, a, b) - width / 2, a, b, ident)
                               for a, b, width, ident in paths)
    assert margin >= 220, 'A board must leave the walking path clear'
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((position[0] - a[0]) * dx + (position[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    nearest = (a[0] + t * dx, a[1] + t * dy)
    distance = math.dist(nearest, position)
    facing = [(nearest[i] - position[i]) / distance for i in range(2)]
    return {'path_edge_clearance_cm': round(margin, 2), 'nearest_path': 'way/' + ident,
            'nearest_path_point_cm': list(nearest), 'facing_normal_xy': facing,
            'facing_yaw_degrees': math.degrees(math.atan2(facing[1], facing[0]))}


def artwork(data, board):
    project, transform = projection(data['boundary'])
    ident, location, position = board
    esc = html.escape
    colors = PALETTE

    def line(points):
        return ' '.join(f'{x:.3f},{y:.3f}' for x, y in map(project, points))

    def ring(points):
        return 'M' + ' L'.join(f'{x:.3f},{y:.3f}' for x, y in map(project, points)) + ' Z'

    def text(x, y, value, size=24, **attrs):
        attributes = ' '.join(f'{key.replace("_", "-")}="{esc(str(value), quote=True)}"' for key, value in attrs.items())
        return f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" {attributes}>{esc(value)}</text>'

    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
             f'<title>{TITLE} — {esc(location)}</title>',
             '<desc>Plan du parc établi à partir des données OpenStreetMap. Nord en haut; distances à l’échelle.</desc>',
             f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{colors["paper"]}"/>',
             f'<g font-family="Liberation Sans, DejaVu Sans, sans-serif" fill="{colors["ink"]}">',
             text(84, 77, 'MONTRÉAL  /  LE PLATEAU-MONT-ROYAL', 22, letter_spacing=3),
             text(80, 150, TITLE, 62, font_weight=700, letter_spacing=1),
             text(84, 194, 'Plan d’orientation', 28, fill=colors['quiet']),
             '<path d="M80 216 H1456" stroke="#9aa38d" stroke-width="2"/>',
             '<defs>',
             f'<clipPath id="map-clip"><rect x="{PLOT[0]}" y="{PLOT[1]}" width="{PLOT[2]}" height="{PLOT[3]}" rx="10"/></clipPath>',
             f'<clipPath id="park-clip"><path d="{ring(data["boundary"])}"/></clipPath>',
             '</defs>', '<g clip-path="url(#map-clip)">']
    for road in data['roads']:
        if road['tags'].get('highway') not in ('path', 'footway', 'pedestrian', 'cycleway', 'steps'):
            stroke = max(5, road['width'] * transform['pixels_per_cm'])
            parts.append(f'<polyline points="{line(road["points"])}" fill="none" stroke="{colors["road"]}" stroke-width="{stroke:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    parts.append(f'<path id="park-boundary" d="{ring(data["boundary"])}" fill="{colors["park"]}" stroke="{colors["park_edge"]}" stroke-width="2"/>')
    pond_records = []
    for pond in data['ponds']:
        path = ' '.join(ring(points) for points in pond['outer'] + pond['inner'])
        parts.append(f'<path class="pond" data-source="{pond["source"]}" d="{path}" fill="{colors["water"]}" fill-rule="evenodd" stroke="#7f999c" stroke-width="1.5"/>')
        pond_records.append({'source': pond['source'], 'outer_rings': len(pond['outer']),
                             'island_holes': len(pond['inner']),
                             'outer_pixels': [[list(project(p)) for p in r] for r in pond['outer']],
                             'inner_pixels': [[list(project(p)) for p in r] for r in pond['inner']]})
    parts.append('<g clip-path="url(#park-clip)">')
    for road in data['roads']:
        if road['tags'].get('highway') in ('path', 'footway', 'pedestrian', 'steps'):
            stroke = max(2.8, road['width'] * transform['pixels_per_cm'])
            parts.append(f'<polyline class="footpath" data-source="way/{road["id"]}" points="{line(road["points"])}" fill="none" stroke="{colors["path"]}" stroke-width="{stroke:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    parts.append('</g>')
    for building in data['buildings']:
        parts.append(f'<path class="source-building" data-source="way/{building["id"]}" d="{ring(building["points"])}" fill="{colors["building"]}" stroke="{colors["paper"]}" stroke-width="1.1"/>')
    street_labels = []
    for fragment, target in [('Sherbrooke', (41900, 15000)), ('Rachel', (-27000, 20000)),
                             ('Parc-La', (3000, -23000)), ('Calixa', (23500, 5800))]:
        choices = [(math.dist(target, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)), road, a, b)
                   for road in data['roads'] if fragment in road['name']
                   for a, b in zip(road['points'], road['points'][1:]) if math.dist(a, b) > 1500]
        _, road, a, b = min(choices, key=lambda row: row[0])
        midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        x, y = project(midpoint)
        angle = -math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        if angle > 90:
            angle -= 180
        if angle < -90:
            angle += 180
        parts.append(text(x, y - 8, road['name'], 23, text_anchor='middle',
                          transform=f'rotate({angle:.3f} {x:.3f} {y:.3f})',
                          paint_order='stroke', stroke=colors['paper'], stroke_width=7, stroke_linejoin='round'))
        street_labels.append({'source': 'way/' + road['id'], 'text': road['name'],
                              'position_cm': list(midpoint), 'position_pixels': [x, y], 'angle_degrees': angle})
    landmark_records = []
    for number, landmark in enumerate(data['landmarks'], 1):
        x, y = project(landmark['position_cm'])
        parts += [f'<circle cx="{x:.3f}" cy="{y:.3f}" r="18" fill="{colors["ink"]}" stroke="{colors["paper"]}" stroke-width="4"/>',
                  text(x, y + 8, str(number), 23, text_anchor='middle', fill=colors['paper'], font_weight=700)]
        landmark_records.append(landmark | {'number': number, 'position_pixels': [x, y]})
    x, y = project(position)
    label_x = x - 292 if x > WIDTH / 2 else x + 30
    below = ident == 'EntreeCalixa'
    label_y = y + 65 if below else y - 54
    connector_start, connector_end = (y + 17, label_y - 20) if below else (y - 17, label_y + 14)
    parts += [f'<circle cx="{x:.3f}" cy="{y:.3f}" r="15" fill="{colors["here"]}" stroke="{colors["paper"]}" stroke-width="6"/>',
              f'<path d="M{x:.3f},{connector_start:.3f} V{connector_end:.3f} H{label_x + 130:.3f}" fill="none" stroke="{colors["here"]}" stroke-width="2.5"/>',
              f'<rect x="{label_x:.3f}" y="{label_y - 24:.3f}" width="262" height="43" rx="7" fill="{colors["paper"]}" stroke="{colors["here"]}" stroke-width="1.5"/>',
              text(label_x + 131, label_y + 5, 'VOUS ÊTES ICI', 25, text_anchor='middle', fill=colors['here'], font_weight=700), '</g>']
    # A true north arrow and an actual 200 m scale, rather than decorative cartographic icons.
    parts += [text(1370, 300, 'N', 27, text_anchor='middle', font_weight=700),
              f'<path id="north-arrow" d="M1370 316 L1358 361 L1370 348 L1382 361 Z" fill="{colors["ink"]}"/>',
              '<path d="M80 1735 H1456" stroke="#9aa38d" stroke-width="2"/>',
              text(84, 1790, '1   Théâtre de Verdure', 25, font_weight=700),
              text(690, 1790, '2   Centre culturel Calixa-Lavallée', 25, font_weight=700),
              text(84, 1840, location, 24, fill=colors['here']),
              text(84, 1880, 'Sentiers • Étangs • Lieux culturels', 22, fill=colors['quiet'])]
    scale_length = 20000 * transform['pixels_per_cm']
    scale_x, scale_y = WIDTH - 88 - scale_length, 1858
    parts.append('<g id="scale-bar">')
    for i in range(4):
        parts.append(f'<rect x="{scale_x + i * scale_length / 4:.3f}" y="{scale_y}" width="{scale_length / 4:.3f}" height="9" fill="{colors["ink"] if i % 2 == 0 else colors["paper"]}" stroke="{colors["ink"]}" stroke-width="1"/>')
    for fraction, label in [(0, '0'), (.5, '100'), (1, '200 m')]:
        parts.append(text(scale_x + fraction * scale_length, scale_y - 12, label, 20, text_anchor='middle'))
    parts += ['</g>', text(84, 1970, ATTRIBUTION, 18, fill=colors['quiet']),
              text(84, 2000, 'openstreetmap.org/copyright  •  Carte d’orientation illustrative', 17, fill=colors['quiet']), '</g></svg>']
    record = {'id': ident, 'location': location, 'position_cm': list(position),
              'position_pixels': [x, y], **board_clearance(data, position),
              'image_size_pixels': [WIDTH, HEIGHT], 'projection': transform,
              'landmarks': landmark_records, 'street_labels': street_labels, 'ponds': pond_records,
              'scale_bar': {'metres': 200, 'length_pixels': scale_length, 'position_pixels': [scale_x, scale_y]},
              'svg': ident + '.svg', 'png': ident + '.png'}
    return '\n'.join(parts) + '\n', record


def prepare():
    data = source()
    directory = ROOT / 'Data/Plateau/Cartography'
    directory.mkdir(parents=True, exist_ok=True)
    records = []
    for board in BOARDS:
        svg, record = artwork(data, board)
        svg_path, png_path = directory / record['svg'], directory / record['png']
        svg_path.write_text(svg)
        subprocess.run(['rsvg-convert', '--output', str(png_path), str(svg_path)], check=True)
        record['svg_sha256'] = hashlib.sha256(svg.encode()).hexdigest()
        record['png_sha256'] = hashlib.sha256(png_path.read_bytes()).hexdigest()
        records.append(record)
    report = {'title': TITLE, 'source': 'Data/LaFontaine/osm.xml', 'attribution': ATTRIBUTION,
              'licence_url': 'https://www.openstreetmap.org/copyright', 'boards': records}
    (directory / 'cartography.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


if __name__ == '__main__':
    report = prepare()
    print(json.dumps({'title': report['title'], 'boards': [b['id'] for b in report['boards']]}, ensure_ascii=False))
