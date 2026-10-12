"""Surveyed La Fontaine ponds and furniture with solid, path-clear benches."""
import json
import math
from pathlib import Path
import random
import xml.etree.ElementTree as ET

from plateau_batches import spatial_batches
from plateau_ground import _rings, district_bounds, signed_area, survey, triangulate
from plateau_mesh import Mesh
from plateau_streets import _distance, _inside, _local, _slab
from prepare_lafontaine import ROOT, tags, xy
from prepare_plateau import geography


def park_survey():
    root = ET.parse(ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {n.get('id'): n for n in root.findall('node')}
    ways = {w.get('id'): [n.get('ref') for n in w.findall('nd')] for w in root.findall('way')}
    position = lambda ident: xy(float(nodes[ident].get('lat')), float(nodes[ident].get('lon')))
    ponds = []
    for relation in root.findall('relation'):
        if tags(relation).get('natural') != 'water':
            continue
        members = [m for m in relation.findall('member') if m.get('type') == 'way']
        outer = _rings([ways[m.get('ref')] for m in members if m.get('role') == 'outer'])
        inner = _rings([ways[m.get('ref')] for m in members if m.get('role') == 'inner'])
        ponds.append({'source': 'relation/' + relation.get('id'),
                      'outer': [[position(n) for n in ring] for ring in outer],
                      'inner': [[position(n) for n in ring] for ring in inner]})
    boundary = next(r for r in survey() if r['source'] == 'way/4767368')['rings'][0]
    benches = [{'source': 'node/' + ident, 'position': position(ident)}
               for ident, node in nodes.items() if tags(node).get('amenity') == 'bench'
               and _inside(position(ident), boundary)]
    return ponds, boundary, benches


def _bench(mesh, position, yaw):
    q = _local(position, yaw)
    for x in (-65, 65):
        mesh.rod('Iron', q(x, -21, 4), q(x, -14, 46), 3.2)
        mesh.rod('Iron', q(x, 23, 4), q(x, 16, 46), 3.2)
        mesh.rod('Iron', q(x, -15, 42), q(x, -30, 94), 3.)
        mesh.rod('Iron', q(x, 20, 44), q(x, 20, 67), 2.7)
        mesh.rod('Iron', q(x, 20, 67), q(x, -23, 67), 2.7)
        mesh.box('Iron', q(x, 0, 40), (7, 52, 5), yaw)
    for y in (-20, -10, 0, 10, 20):
        mesh.box('ParkWood', q(0, y, 47), (178, 8, 4), yaw)
    for z in (63, 73, 83, 93):
        mesh.box('ParkWood', q(0, -22 - (z - 63) * .15, z), (178, 4, 8), yaw)
    for x in (-65, 65):
        for y in (-20, 20):
            mesh.cylinder('Iron', q(x, y, 49.15), 1.1, .3, 6)


def _leaf(mesh, center, size, yaw, material):
    q = _local(center, yaw)
    # A lobed maple outline with a raised central rib, rather than a square card.
    outline = [(0, 1), (.18, .57), (.7, .68), (.46, .24), (.9, .08),
               (.34, -.23), (.29, -.58), (0, -.38), (-.29, -.58),
               (-.34, -.23), (-.9, .08), (-.46, .24), (-.7, .68), (-.18, .57)]
    points = [q(x * size, y * size, center[2]) for x, y in outline]
    rib = (*center[:2], center[2] + .35)
    for a, b in zip(points, points[1:] + points[:1]):
        mesh.face(material, [rib, b, a])


def build_park():
    ponds, boundary, mapped_benches = park_survey()
    mesh, records = Mesh(), []
    for pond in ponds:
        triangles = triangulate(pond['outer'] + pond['inner'], district_bounds())
        for triangle in triangles:
            mesh.face('PondWater', [(x, y, 7.15) for x, y in triangle])
        records.append({'source': pond['source'], 'triangles': len(triangles),
                        'area_square_metres': sum(signed_area(t) for t in triangles) / 10000,
                        'island_holes': len(pond['inner'])})
        for ring in pond['outer'] + pond['inner']:
            for a, b in zip(ring, ring[1:] + ring[:1]):
                distance = math.dist(a, b)
                if distance < 1:
                    continue
                # The source defines the shoreline; the shallow stone edge is illustrative.
                pieces = max(1, math.ceil(distance / 140))
                yaw = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
                for i in range(pieces):
                    f = (i + .5) / pieces
                    center = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 8.)
                    mesh.box('ConcreteDark', center, (distance / pieces - .4, 36, 8), yaw)

    _, roads = geography()
    paths = [(a, b, road['width']) for road in roads
             if road['tags'].get('highway') in ('path', 'footway', 'pedestrian')
             for a, b in zip(road['points'], road['points'][1:]) if math.dist(a, b) > 1]
    path_surfaces = []
    for road in roads:
        if road['tags'].get('highway') not in ('path', 'footway', 'pedestrian'):
            continue
        surface = road['tags'].get('surface')
        if surface not in ('dirt', 'earth', 'ground', 'compacted', 'fine_gravel', 'gravel', 'asphalt'):
            continue
        material = 'Asphalt' if surface == 'asphalt' else 'ParkEarth'
        segments = 0
        for a, b in zip(road['points'], road['points'][1:]):
            if not _inside(a, boundary) or not _inside(b, boundary) or math.dist(a, b) < 1:
                continue
            _slab(mesh, material, a, b, road['width'], za=5.08)
            segments += 1
        if segments:
            path_surfaces.append({'source': 'way/' + road['id'], 'surface': surface,
                                  'material': material, 'segments': segments})
    benches, skipped = [], []
    for bench in mapped_benches:
        point = bench['position']
        a, b, width = min(paths, key=lambda edge: _distance(point, *edge[:2]))
        distance = _distance(point, a, b)
        if distance < width / 2 + 36:
            skipped.append(bench['source'])
            continue
        yaw = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        normal = (-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)))
        if sum((a[i] - point[i]) * normal[i] for i in (0, 1)) < 0:
            yaw += 180
        _bench(mesh, point, yaw)
        benches.append(bench | {'yaw': yaw, 'path_clearance_cm': distance - width / 2 - 36})

    from plateau_rendering import tree_positions
    trees = [p for p in tree_positions() if _inside(p, boundary)
             and (math.dist(p[:2], (35880, 850)) < 7500 or math.dist(p[:2], (12500, -8000)) < 11000)]
    leaves, tree_count = 0, 0
    for x, y, seed in trees[::max(1, len(trees) // 90)][:90]:
        rng = random.Random(seed)
        accepted = 0
        for _ in range(32):
            angle, radius = rng.uniform(0, math.tau), rng.uniform(70, 380)
            p = (x + math.cos(angle) * radius, y + math.sin(angle) * radius)
            if not _inside(p, boundary) or any(_inside(p, r) for pond in ponds for r in pond['outer']):
                continue
            if any(_distance(p, a, b) < width / 2 + 12 for a, b, width in paths):
                continue
            _leaf(mesh, (*p, 2.3 + rng.random() * .08), rng.uniform(4, 9), rng.uniform(0, 360),
                  'AutumnGold' if rng.random() < .6 else 'AutumnRust')
            accepted += 1
        leaves += accepted
        tree_count += accepted > 0
    mesh, batches, size = spatial_batches(mesh, tile_size_cm=7500, max_batches=350)
    for metadata in batches.values():
        metadata['collision'] = metadata['material'] in ('Iron', 'ParkWood')
    report = {'source': 'Data/LaFontaine/osm.xml', 'attribution': '© OpenStreetMap contributors, ODbL 1.0',
              'ponds': records, 'mapped_benches': len(mapped_benches), 'benches': benches,
              'benches_omitted_for_path_clearance': skipped, 'fallen_leaves': leaves,
              'leaf_cluster_trees': tree_count, 'new_collision': 'mapped benches only', 'materials': batches,
              'path_surfaces': path_surfaces,
              'tile_size_cm': size}
    return mesh, report


def prepare():
    mesh, report = build_park()
    directory = ROOT / 'Data/Plateau/ParkGeometry'
    mesh.write(directory)
    (directory / 'park.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def apply(u, materials, import_mesh, nanite):
    report = prepare()
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    all_actors = editor.get_all_level_actors()
    actors = {a.get_actor_label(): a for a in all_actors}
    wanted = {'Plateau park ' + name for name in report['materials']}
    for label, actor in actors.items():
        if label.startswith('Plateau park ') and label not in wanted:
            editor.destroy_actor(actor)
    for name, metadata in report['materials'].items():
        label = 'Plateau park ' + name
        mesh = import_mesh(ROOT / 'Data/Plateau/ParkGeometry' / (name + '.obj'),
                           '/Game/Plateau/Park', 'SM_' + name, metadata['collision'])
        material = materials[metadata['material']]
        if metadata['material'] != 'PondWater':
            nanite(u, mesh, [material])
        actor = actors.get(label) or editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label(label)
        actor.set_folder_path('Plateau/Park')
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_collision_profile_name('BlockAll' if metadata['collision'] else 'NoCollision')
        component.set_cast_shadow(metadata['material'] not in ('PondWater', 'AutumnGold', 'AutumnRust'))
    water = actors['OSM Water'].static_mesh_component
    water.set_visibility(False)
    water.set_cast_shadow(False)
    actors['OSM Water'].set_actor_hidden_in_game(True)
    _, boundary, _ = park_survey()
    for actor in all_actors:
        label = actor.get_actor_label()
        p = actor.get_actor_location()
        if label.startswith('Street detail bench ') and _inside((p.x, p.y), boundary):
            actor.static_mesh_component.set_visibility(False)
            actor.set_actor_hidden_in_game(True)
    return report


if __name__ == '__main__':
    report = prepare()
    print(json.dumps({k: v for k, v in report.items() if k not in ('materials', 'benches')}, ensure_ascii=False, indent=2))
