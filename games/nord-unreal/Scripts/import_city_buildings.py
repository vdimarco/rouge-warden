"""Import the prepared municipal models into the existing map without regenerating gameplay actors."""
import json
from pathlib import Path
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
DATA = ROOT/'Data/CityBuildings'
manifest = json.loads((DATA/'manifest.json').read_text())
layout = json.loads((ROOT/'Data/LaFontaine/layout.json').read_text())
assert layout['surveyed_replacements'] > 20, 'Prepare filtered OSM geometry first'
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
assets = u.EditorAssetLibrary
tools = u.AssetToolsHelpers.get_asset_tools()
M = u.MaterialEditingLibrary
assert '/Maps/LaFontaine.' in u.EditorLevelLibrary.get_editor_world().get_path_name()


def mesh_import(filename, folder, name):
    task = u.AssetImportTask()
    task.filename = str(filename); task.destination_path = folder; task.destination_name = name
    task.automated = True; task.replace_existing = True; task.save = True
    options = u.FbxImportUI()
    options.import_mesh = True; options.import_materials = False; options.import_textures = False
    options.import_as_skeletal = False
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False
    task.options = options
    tools.import_asset_tasks([task])
    assert task.imported_object_paths, str(filename)
    mesh = assets.load_asset(task.imported_object_paths[0])
    assert isinstance(mesh, u.StaticMesh)
    mesh.get_editor_property('body_setup').set_editor_property('collision_trace_flag', u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    # Refresh the cooked collision after changing complexity; imported caches otherwise miss roofs.
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    assert all(subsystem.is_section_collision_enabled(mesh, 0, i) for i in range(mesh.get_num_sections(0)))
    subsystem.enable_section_collision(mesh, True, 0, 0)
    assets.save_loaded_asset(mesh)
    return mesh


# Shared parent keeps municipal roof textures cheap to edit and consistent with lighting.
parent_path = '/Game/CityBuildings/M_CityFacade'
parent = assets.load_asset(parent_path) if assets.does_asset_exist(parent_path) else tools.create_asset('M_CityFacade', '/Game/CityBuildings', u.Material, u.MaterialFactoryNew())
M.delete_all_material_expressions(parent)
tex = M.create_material_expression(parent, u.MaterialExpressionTextureSampleParameter2D)
tex.set_editor_property('parameter_name', 'Facade')
tex.set_editor_property('texture', assets.load_asset('/Engine/EngineResources/DefaultTexture'))
# Lift baked aerial shadows while retaining the roof colours.
power = M.create_material_expression(parent, u.MaterialExpressionPower)
power.set_editor_property('const_exponent', .7)
assert M.connect_material_expressions(tex, 'RGB', power, 'Base')
assert M.connect_material_property(power, '', u.MaterialProperty.MP_BASE_COLOR)
rough = M.create_material_expression(parent, u.MaterialExpressionConstant)
rough.set_editor_property('r', .85)
assert M.connect_material_property(rough, '', u.MaterialProperty.MP_ROUGHNESS)
M.recompile_material(parent)
assets.save_loaded_asset(parent)

# Use the existing CC0 brick texture with an explicitly estimated window rhythm.
estimated_path = '/Game/CityBuildings/M_EstimatedFacade'
estimated_material = assets.load_asset(estimated_path) if assets.does_asset_exist(estimated_path) else tools.create_asset('M_EstimatedFacade','/Game/CityBuildings',u.Material,u.MaterialFactoryNew())
M.delete_all_material_expressions(estimated_material)
brick = M.create_material_expression(estimated_material, u.MaterialExpressionTextureSample)
brick.set_editor_property('texture', assets.load_asset('/Game/Art/Textures/brick_wall_001_diff'))
uv = M.create_material_expression(estimated_material, u.MaterialExpressionTextureCoordinate)
normal = M.create_material_expression(estimated_material, u.MaterialExpressionVertexNormalWS)
facade = M.create_material_expression(estimated_material, u.MaterialExpressionCustom)
facade.set_editor_property('code', (ROOT/'Scripts/city_facade.hlsl').read_text())
facade.set_editor_property('output_type', u.CustomMaterialOutputType.CMOT_FLOAT3)
inputs=[]
for name in ('Brick','UV','Normal'):
    entry=u.CustomInput();entry.set_editor_property('input_name',name);inputs.append(entry)
facade.set_editor_property('inputs',inputs)
for node, output, name in ((brick,'RGB','Brick'),(uv,'','UV'),(normal,'','Normal')):
    assert M.connect_material_expressions(node,output,facade,name)
assert M.connect_material_property(facade,'',u.MaterialProperty.MP_BASE_COLOR)
rough = M.create_material_expression(estimated_material, u.MaterialExpressionConstant)
rough.set_editor_property('r',.75)
assert M.connect_material_property(rough,'',u.MaterialProperty.MP_ROUGHNESS)
M.recompile_material(estimated_material);assets.save_loaded_asset(estimated_material)

# Import first; only replace map actors after every source model has succeeded.
models = []
for b in manifest['buildings']:
    ident = b['id']
    task = u.AssetImportTask(); task.filename = str(DATA/'Textures'/f'{ident}.jpg')
    task.destination_path = '/Game/CityBuildings/Textures'; task.destination_name = 'T_' + ident
    task.automated = True; task.replace_existing = True; task.save = True
    tools.import_asset_tasks([task]); assert task.imported_object_paths, ident
    texture = assets.load_asset(task.imported_object_paths[0])
    path = '/Game/CityBuildings/MI_' + ident
    mat = assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset('MI_' + ident, '/Game/CityBuildings', u.MaterialInstanceConstant, u.MaterialInstanceConstantFactoryNew())
    M.set_material_instance_parent(mat, parent)
    M.set_material_instance_texture_parameter_value(mat, 'Facade', texture)
    assets.save_loaded_asset(mat)
    mesh = mesh_import(DATA/'Geometry'/f'{ident}.obj', '/Game/CityBuildings', 'SM_' + ident)
    assert mesh.get_num_sections(0) <= 2, ident+' material batching'
    slots = mesh.get_editor_property('static_materials')
    assert slots and all(str(s.material_slot_name) in ('Facade','EstimatedWall') for s in slots), str(slots)
    for index, slot in enumerate(slots):
        mesh.set_material(index, estimated_material if str(slot.material_slot_name)=='EstimatedWall' else mat)
        assert mesh.get_material(index), str(slot.material_slot_name)
    assets.save_loaded_asset(mesh)
    models.append((ident, mesh))

# Reimport only the generic building batches; their existing materials and profiles survive.
by_name = {a.get_actor_label(): a for a in editor.get_all_level_actors()}
for name in ('Brick', 'Cream', 'Sage', 'Roof', 'Glass'):
    actor = by_name['OSM ' + name]
    mesh = mesh_import(ROOT/'Data/LaFontaine/Geometry'/f'{name}.obj', '/Game/LaFontaine', 'SM_' + name)
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.static_mesh_component.set_collision_profile_name('NoCollision' if name == 'Glass' else 'BlockAll')
for actor in editor.get_all_level_actors():
    if actor.get_actor_label().startswith('Municipal building '): editor.destroy_actor(actor)
for ident, mesh in models:
    actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
    actor.set_actor_label('Municipal building ' + ident)
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.static_mesh_component.set_collision_profile_name('BlockAll')
assert levels.save_current_level()
assert sum(a.get_actor_label().startswith('Municipal building ') for a in editor.get_all_level_actors()) == len(models)
u.log('NORD_CITY_IMPORTED ' + str(len(models)))
