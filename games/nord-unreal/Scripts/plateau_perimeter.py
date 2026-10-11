"""Nonblocking Plateau street fronts around the retained Parc La Fontaine survey."""
import copy
import hashlib
import json
from pathlib import Path

from plateau_batches import spatial_batches
from plateau_facades import _author_facades, _candidates, _inside, _nearest, _route_distance
from plateau_ground import survey
from plateau_mesh import Mesh
from prepare_plateau import geography
import plateau_tower
import plateau_school


ROOT = Path(__file__).resolve().parents[1]
STREETS = ('Rue Rachel Est', 'Avenue Papineau', 'Avenue du Parc-La Fontaine', 'Rue Sherbrooke Est')
DIRECTORY = ROOT / 'Data/Plateau/PerimeterGeometry'


def select_fronts(buildings, roads, boundary, existing_ids):
    """Only outward street edges looking toward the park, beyond the existing route."""
    focus = list(boundary) + [boundary[0]]
    local = [building for building in buildings
             if min(_route_distance(p, focus) for p in building['points']) < 7500]
    selected = []
    for candidate in _candidates(local, roads, focus):
        if candidate['id'] in existing_ids or candidate['id'] == plateau_tower.OSM_ID:
            continue
        options = [candidate] + candidate.pop('alternates')
        eligible = []
        for front in options:
            if front['kind'] != 'front' or front['street'] not in STREETS or not 460 <= front['width'] <= 2400:
                continue
            midpoint = tuple((a + b) / 2 for a, b in zip(front['a'], front['b']))
            distance, nearest = min((_nearest(midpoint, a, b)
                                     for a, b in zip(focus, focus[1:])), key=lambda item: item[0])
            facing = sum((nearest[i] - midpoint[i]) * front['normal'][i] for i in (0, 1))
            if _inside(midpoint, boundary) or distance > 6500 or facing < distance * .7:
                continue
            front = copy.deepcopy(front)
            front.update(alternates=[], perimeter=True, park_distance_cm=round(distance, 3))
            tags = front['tags']
            specified = tags.get('building:material', tags.get('building:facade:material', '')).lower()
            seed = sum((i + 1) * ord(c) for i, c in enumerate(front['id']))
            # shortcut: untagged facade finishes are street-coherent estimates; replace with measured frontage surveys when available.
            if 'stone' in specified or 'limestone' in specified:
                front['masonry'], front['masonry_source'] = 'Limestone', 'OSM material tag'
            elif 'brick' in specified:
                front['masonry'], front['masonry_source'] = 'BrickRed', 'OSM material tag'
            else:
                choices = (('Limestone', 'Limestone', 'BrickRed', 'BrickBrown')
                           if front['street'] == 'Avenue du Parc-La Fontaine'
                           else ('BrickRed', 'BrickBrown', 'Limestone', 'BrickRed', 'BrickOchre'))
                front['masonry'], front['masonry_source'] = choices[seed % len(choices)], 'authored estimate'
            front['height_source'] = ('OSM height tag' if 'height' in tags else
                                      'OSM levels × 3.2 m' if 'building:levels' in tags else '3-storey estimate')
            eligible.append(front)
        if eligible:
            selected.append(min(eligible, key=lambda front: (front['park_distance_cm'], -front['width'])))
    return sorted(selected, key=lambda front: (front['street'], front['id']))


def build_perimeter(buildings, roads, boundary, existing_ids, include_tower=False):
    fronts = select_fronts(buildings, roads, boundary, set(existing_ids))
    visual = Mesh()
    details = _author_facades(visual, fronts, storefronts=False)
    tower = plateau_tower.build(visual) if include_tower else None
    school = plateau_school.build(visual) if include_tower else None
    mesh = Mesh()
    for name, faces in visual.groups.items():
        mesh.groups.setdefault(name.removesuffix('_Collision'), []).extend(faces)
    mesh, materials, tile_size = spatial_batches(mesh, tile_size_cm=10000, max_batches=320)
    for name, metadata in materials.items():
        metadata['bounds_cm'] = [[round(operation(p[i] for face in mesh.groups[name] for p in face), 3)
                                  for i in range(3)] for operation in (min, max)]
        assert not metadata['collision']
    return mesh, {'source': 'Data/LaFontaine/osm.xml', 'park_source': 'way/4767368',
                  'attribution': '© OpenStreetMap contributors, ODbL 1.0',
                  'fronts': details['fronts'], 'counts': details['counts'], 'materials': materials,
                  'survey_landmark': tower,
                  'survey_school': school,
                  'tile_size_cm': tile_size, 'new_collision': False,
                  'excluded_existing_ids': sorted(set(existing_ids)),
                  'triangles': sum(material['triangles'] for material in materials.values()),
                  'limits': 'Mapped footprint edges and tagged heights are retained. Untagged heights, facade finishes, door/window rhythms, cornices and decorative balconies/stairs are estimates, not exact individual buildings. No new interiors or collision.'}


def prepare(directory=DIRECTORY):
    buildings, roads = geography()
    boundary = next(record for record in survey() if record['source'] == 'way/4767368')['rings'][0]
    existing = json.loads((ROOT / 'Data/Plateau/layout.json').read_text())
    existing_ids = [front['id'] for front in existing['facades']['fronts']]
    mesh, result = build_perimeter(buildings, roads, boundary, existing_ids, include_tower=True)
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    mesh.write(directory)
    result['source_sha256'] = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                               for name in ('Data/LaFontaine/osm.xml', 'Data/Plateau/layout.json',
                                            plateau_tower.SOURCE, 'Data/CityBuildings/manifest.json',
                                            'Content/CityBuildings/SM_2317003.uasset',
                                            'Content/CityBuildings/MI_2317003.uasset',
                                            'Content/CityBuildings/M_CityFacade.uasset',
                                            plateau_school.SOURCE,
                                            'Content/CityBuildings/SM_2316935.uasset',
                                            'Content/CityBuildings/MI_2316935.uasset')}
    result['geometry_sha256'] = {name: hashlib.sha256((directory / (name + '.obj')).read_bytes()).hexdigest()
                                 for name in result['materials']}
    assert set(front['street'] for front in result['fronts']) == set(STREETS), 'Every park edge needs frontage'
    assert result['counts']['fronts'] >= 80
    assert result['triangles'] < 750000
    (directory / 'perimeter.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


def apply(u, import_mesh, nanite):
    """Import only the additional visual layer; the caller owns recovery/map saving."""
    result = json.loads((DIRECTORY / 'perimeter.json').read_text())
    for path, digest in result['source_sha256'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, path
    for name, digest in result['geometry_sha256'].items():
        assert hashlib.sha256((DIRECTORY / (name + '.obj')).read_bytes()).hexdigest() == digest, name
    assert result['new_collision'] is False
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    materials = {name: assets.load_asset('/Game/Plateau/Materials/M_' + name)
                 for name in {record['material'] for record in result['materials'].values()}
                 if name not in plateau_tower.PALETTE and name not in plateau_school.PALETTE}
    assert all(materials.values()), 'The integrated Plateau material palette is required'
    # A separate grey finish keeps existing verified route materials unchanged.
    stone_path = '/Game/Plateau/Materials/M_PerimeterStone'
    stone = (assets.load_asset(stone_path) if assets.does_asset_exist(stone_path)
             else assets.duplicate_asset('/Game/Plateau/Materials/M_Limestone', stone_path))
    assert stone
    tints = [node for node in library.get_material_expressions(stone)
             if isinstance(node, u.MaterialExpressionConstant3Vector)]
    assert len(tints) == 1, 'Expected the existing single masonry tint graph'
    tints[0].set_editor_property('constant', u.LinearColor(.80, .86, .88, 1))
    library.recompile_material(stone)
    assets.save_loaded_asset(stone)
    materials['Limestone'] = stone
    materials.update(plateau_tower.materials(u))
    materials.update(plateau_school.materials(u))
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    old = [actor for actor in editor.get_all_level_actors()
           if actor.get_actor_label().startswith('Plateau perimeter ')]
    imported = []
    for name, metadata in result['materials'].items():
        assert metadata['collision'] is False
        mesh = import_mesh(DIRECTORY / (name + '.obj'), '/Game/Plateau/Perimeter', 'SM_' + name, False)
        subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
        settings = subsystem.get_lod_build_settings(mesh, 0)
        settings.set_editor_property('max_lumen_mesh_cards', 64)
        settings.set_editor_property('generate_distance_field_as_if_two_sided', True)
        subsystem.set_lod_build_settings(mesh, 0, settings)
        material = materials[metadata['material']]
        nanite(u, mesh, [material])
        actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label('Plateau perimeter ' + name)
        actor.set_folder_path('Plateau/Park perimeter architecture')
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_collision_profile_name('NoCollision')
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        assert mesh.get_num_triangles(0) == metadata['triangles'], name
        imported.append(actor)
    landmark = plateau_tower.apply(u, import_mesh, nanite, result['survey_landmark'], materials)
    school = plateau_school.apply(u, import_mesh, nanite, result['survey_school'], materials)
    for actor in old:
        editor.destroy_actor(actor)
    assert len(imported) == len(result['materials'])
    return {'batches': len(imported), 'counts': result['counts'], 'triangles': result['triangles'],
            'tile_size_cm': result['tile_size_cm'], 'new_collision': False,
            'stone_material': stone.get_path_name(), 'stone_tint': [.80, .86, .88],
            'survey_landmark': landmark,
            'survey_school': school,
            'source_sha256': result['source_sha256']}


def verify(u):
    """Fresh-load identity, material, transform and collision checks for this layer."""
    result = json.loads((DIRECTORY / 'perimeter.json').read_text())
    for path, digest in result['source_sha256'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, path
    actors = [actor for actor in u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
              if actor.get_actor_label().startswith('Plateau perimeter ')]
    labels = {actor.get_actor_label(): actor for actor in actors}
    assert len(labels) == len(actors) == len(result['materials'])
    for name, metadata in result['materials'].items():
        actor = labels['Plateau perimeter ' + name]
        component = actor.static_mesh_component
        mesh = component.static_mesh
        assert mesh.get_path_name() == '/Game/Plateau/Perimeter/SM_' + name + '.SM_' + name
        assert mesh.get_num_triangles(0) == metadata['triangles']
        assert mesh.get_editor_property('nanite_settings').enabled
        assert str(component.get_collision_profile_name()) == 'NoCollision'
        assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
        expected = 'PerimeterStone' if metadata['material'] == 'Limestone' else metadata['material']
        assert component.get_material(0).get_path_name() == '/Game/Plateau/Materials/M_' + expected + '.M_' + expected
        assert actor.get_actor_location().length() < .1
        scale, rotation = actor.get_actor_scale3d(), actor.get_actor_rotation()
        assert max(abs(value - 1) for value in (scale.x, scale.y, scale.z)) < .001
        assert max(abs(rotation.roll), abs(rotation.pitch), abs(rotation.yaw)) < .001
        bounds = mesh.get_bounds()
        observed = [[bounds.origin.x + side * bounds.box_extent.x,
                     bounds.origin.y + side * bounds.box_extent.y,
                     bounds.origin.z + side * bounds.box_extent.z] for side in (-1, 1)]
        assert all(abs(observed[end][axis] - metadata['bounds_cm'][end][axis]) < .2
                   for end in (0, 1) for axis in range(3)), name
    landmark = plateau_tower.verify(u, result['survey_landmark'])
    school = plateau_school.verify(u, result['survey_school'])
    return {'passed': True, 'batches': len(actors), 'fronts': result['counts']['fronts'],
            'survey_landmark': landmark,
            'survey_school': school,
            'triangles': result['triangles'], 'new_collision': False}


if __name__ == '__main__':
    result = prepare()
    print(json.dumps({key: result[key] for key in ('counts', 'tile_size_cm', 'triangles', 'new_collision')}, indent=2))
