"""Visual-only Le Neuville correction from the retained 2016 municipal survey."""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OSM_ID, CITY_ID = '355385456', '2317003'
SOURCE = 'Data/CityBuildings/Geometry/2317003.obj'
PALETTE = {'LeNeuvilleConcrete': ((.53, .51, .47), .87, 0),
           'LeNeuvilleMetal': ((.47, .50, .51), .34, .7),
           'LeNeuvilleGlass': ((.035, .073, .095), .17, .12),
           'LeNeuvilleRail': ((.035, .043, .047), .55, .45)}


def survey_edges(path=ROOT / SOURCE, minimum_height=5000, expected_edges=30):
    vertices, edges, group = [], {}, ''
    for line in Path(path).read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == 'v':
            x, y, z = map(float, fields[1:4])
            vertices.append((x, -y, z))
        elif fields[0] == 'usemtl':
            group = fields[1]
        elif fields[0] == 'f' and group == 'EstimatedWall':
            points = [vertices[int(field.split('/')[0]) - 1] for field in fields[1:]]
            ground = [point[:2] for point in points if abs(point[2]) < .01]
            if len(ground) == 2 and max(point[2] for point in points) > minimum_height:
                edges[tuple(sorted(ground))] = min(point[2] for point in points if point[2] > minimum_height)
    assert vertices and len(edges) == expected_edges, 'Unexpected retained landmark survey'
    return vertices, edges


def build(mesh):
    vertices, edges = survey_edges()
    center = tuple(sum(point[i] for point in vertices) / len(vertices) for i in (0, 1))
    windows = balconies = 0
    for (a, b), height in sorted(edges.items()):
        width = math.dist(a, b)
        if width < 240:
            continue
        tangent = tuple((b[i] - a[i]) / width for i in (0, 1))
        normal = (-tangent[1], tangent[0])
        midpoint = tuple((a[i] + b[i]) / 2 for i in (0, 1))
        if sum((midpoint[i] - center[i]) * normal[i] for i in (0, 1)) < 0:
            normal = tuple(-value for value in normal)
        yaw = math.degrees(math.atan2(tangent[1], tangent[0]))

        def box(material, along, out, z, length, depth, tall):
            mesh.box(material, (a[0] + tangent[0] * along + normal[0] * out,
                                a[1] + tangent[1] * along + normal[1] * out, z),
                     (length, depth, tall), yaw)

        bays = max(1, round(width / 310))
        pitch = width / bays
        floor = 5121 / 17
        for storey in range(17):
            z = storey * floor
            for bay in range(bays):
                x = (bay + .5) * pitch
                pane = min(240, pitch - 32)
                box('LeNeuvilleMetal', x, 3, z + 174, pane + 12, 9, 230)
                box('LeNeuvilleGlass', x, 9, z + 174, pane, 5, 216)
                box('LeNeuvilleMetal', x, 14, z + 174, 5, 5, 216)
                box('LeNeuvilleMetal', x, 14, z + 220, pane, 5, 5)
                windows += 1
            # Balcony dimensions/rhythm are authored, not a measured elevation.
            parkward = sum(-midpoint[i] * normal[i] for i in (0, 1)) > 0
            if storey and width > 450 and parkward:
                balcony_width = width - 24
                box('LeNeuvilleConcrete', width / 2, 49, z + 4, balcony_width, 98, 15)
                box('LeNeuvilleRail', width / 2, 97, z + 106, balcony_width, 5, 5)
                box('LeNeuvilleRail', width / 2, 97, z + 31, balcony_width, 4, 4)
                posts = max(2, round(balcony_width / 105))
                for post in range(posts + 1):
                    box('LeNeuvilleRail', 12 + post * balcony_width / posts, 97, z + 68, 4, 4, 76)
                balconies += 1
    return {'osm_id': OSM_ID, 'city_id': CITY_ID, 'address': '1101 Rue Rachel Est',
            'name': 'Le Neuville', 'source': SOURCE, 'survey_triangles': 256,
            'bounds_cm': [[operation(point[i] for point in vertices) for i in range(3)]
                          for operation in (min, max)],
            'height_cm': 5744.392, 'storeys': 17, 'windows': windows, 'balconies': balconies,
            'pose': {'location': [0, 0, 0], 'rotation': [0, 0, 0], 'scale': [1, 1, 1]},
            'footprint_join': {'iou': .8854, 'osm_coverage': .9492, 'city_coverage': .9295},
            'collision': False, 'retained_osm_collider_height_cm': 960,
            'limits': '2016 municipal exterior mass and roof profile; window/balcony rhythm and finishes are authored estimates. Ground flattened as in existing survey. Original OSM 9.6 m collider retained; no upper-floor access.'}


def materials(u, palette=PALETTE):
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    result = {}
    tools = u.AssetToolsHelpers.get_asset_tools()
    for name, (color, rough, metal) in palette.items():
        path = '/Game/Plateau/Materials/M_' + name
        mat = (assets.load_asset(path) if assets.does_asset_exist(path) else
               tools.create_asset('M_' + name, '/Game/Plateau/Materials', u.Material, u.MaterialFactoryNew()))
        assert mat
        library.delete_all_material_expressions(mat)
        tint = library.create_material_expression(mat, u.MaterialExpressionConstant3Vector)
        tint.set_editor_property('constant', u.LinearColor(*color, 1))
        assert library.connect_material_property(tint, '', u.MaterialProperty.MP_BASE_COLOR)
        for value, prop in ((rough, u.MaterialProperty.MP_ROUGHNESS), (metal, u.MaterialProperty.MP_METALLIC)):
            node = library.create_material_expression(mat, u.MaterialExpressionConstant)
            node.set_editor_property('r', value)
            assert library.connect_material_property(node, '', prop)
        library.recompile_material(mat)
        assets.save_loaded_asset(mat)
        result[name] = mat
    return result


def roof_material(u, name='LeNeuville', city_id=CITY_ID):
    """Persist both owned material dependencies before a mesh can reference them."""
    assets = u.EditorAssetLibrary
    parent_path = '/Game/Plateau/Materials/M_' + name + 'RoofParent'
    parent = (assets.load_asset(parent_path) if assets.does_asset_exist(parent_path) else
              assets.duplicate_asset('/Game/CityBuildings/M_CityFacade', parent_path))
    assert parent
    assert assets.save_loaded_asset(parent), 'Owned roof parent must be saved'
    roof_path = '/Game/Plateau/Materials/MI_' + name + 'Roof'
    roof = (assets.load_asset(roof_path) if assets.does_asset_exist(roof_path) else
            assets.duplicate_asset('/Game/CityBuildings/MI_' + city_id, roof_path))
    assert roof, 'Retained municipal roof material required'
    u.MaterialEditingLibrary.set_material_instance_parent(roof, parent)
    assert assets.save_loaded_asset(roof), 'Owned roof instance must be saved'
    assert roof.get_editor_property('parent') == parent
    for asset in (parent, roof):
        relative = 'Content/' + asset.get_path_name().split('.')[0].removeprefix('/Game/') + '.uasset'
        assert (ROOT / relative).is_file(), relative
    return roof


def apply(u, import_mesh, nanite, info, palette, source=SOURCE, city_id=CITY_ID,
          name='LeNeuville', wall='LeNeuvilleConcrete', label='Le Neuville'):
    """Copy survey geometry into this owned layer; never mutate municipal assets."""
    mesh = import_mesh(ROOT / source, '/Game/Plateau/Perimeter', 'SM_' + name + 'Survey', False)
    slots = mesh.get_editor_property('static_materials')
    assert {str(slot.material_slot_name) for slot in slots} == {'Facade', 'EstimatedWall'}
    roof = roof_material(u, name, city_id)
    assigned = [palette[wall] if str(slot.material_slot_name) == 'EstimatedWall' else roof
                for slot in slots]
    for index, material in enumerate(assigned):
        mesh.set_material(index, material)
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    settings = subsystem.get_lod_build_settings(mesh, 0)
    settings.set_editor_property('max_lumen_mesh_cards', 64)
    settings.set_editor_property('generate_distance_field_as_if_two_sided', True)
    subsystem.set_lod_build_settings(mesh, 0, settings)
    nanite(u, mesh, assigned)
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    old = [actor for actor in editor.get_all_level_actors()
           if actor.get_actor_label() == 'Plateau survey landmark ' + label]
    actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
    actor.set_actor_label('Plateau survey landmark ' + label)
    actor.set_folder_path('Plateau/Park perimeter architecture')
    component = actor.static_mesh_component
    component.set_static_mesh(mesh)
    for index, material in enumerate(assigned):
        component.set_material(index, material)
    component.set_collision_profile_name('NoCollision')
    assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    assert mesh.get_num_triangles(0) == info['survey_triangles']
    for previous in old:
        editor.destroy_actor(previous)
    return {'survey_asset': mesh.get_path_name(), **info}


def verify(u, info, name='LeNeuville', wall='LeNeuvilleConcrete', label='Le Neuville'):
    actors = [actor for actor in u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
              if actor.get_actor_label() == 'Plateau survey landmark ' + label]
    assert len(actors) == 1
    actor = actors[0]
    component, mesh = actor.static_mesh_component, actor.static_mesh_component.static_mesh
    assert mesh.get_path_name() == '/Game/Plateau/Perimeter/SM_' + name + 'Survey.SM_' + name + 'Survey'
    assert mesh.get_num_triangles(0) == info['survey_triangles'] and mesh.get_editor_property('nanite_settings').enabled
    assert actor.get_actor_location().length() < .1
    rotation, scale = actor.get_actor_rotation(), actor.get_actor_scale3d()
    assert max(abs(value) for value in (rotation.roll, rotation.pitch, rotation.yaw)) < .001
    assert max(abs(value - 1) for value in (scale.x, scale.y, scale.z)) < .001
    assert component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    for index, slot in enumerate(mesh.get_editor_property('static_materials')):
        expected = ('/Game/Plateau/Materials/M_' + wall + '.M_' + wall
                    if str(slot.material_slot_name) == 'EstimatedWall' else
                    '/Game/Plateau/Materials/MI_' + name + 'Roof.MI_' + name + 'Roof')
        assert component.get_material(index).get_path_name() == expected
        if str(slot.material_slot_name) == 'Facade':
            roof = component.get_material(index)
            parent = roof.get_editor_property('parent')
            assert parent and parent.get_path_name() == '/Game/Plateau/Materials/M_' + name + 'RoofParent.M_' + name + 'RoofParent'
            for asset in (parent, roof):
                relative = 'Content/' + asset.get_path_name().split('.')[0].removeprefix('/Game/') + '.uasset'
                assert (ROOT / relative).is_file(), relative
    bounds = mesh.get_bounds()
    observed = [[bounds.origin.x + side * bounds.box_extent.x,
                 bounds.origin.y + side * bounds.box_extent.y,
                 bounds.origin.z + side * bounds.box_extent.z] for side in (-1, 1)]
    assert all(abs(observed[end][axis] - info['bounds_cm'][end][axis]) < .2
               for end in (0, 1) for axis in range(3))
    return {'passed': True, 'height_cm': info['height_cm'], 'collision': False}
