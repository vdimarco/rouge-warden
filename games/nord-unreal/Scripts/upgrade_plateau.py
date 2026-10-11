"""Refresh generated Plateau layers in the already merged LaFontaine level.

The original Warden map is not a supported input: its park-instance layer would
overlap the baked Plateau environment. Back up the integrated map before use.
"""
import json
import math
from pathlib import Path
import shutil
import sys
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
sys.path.insert(0,str(ROOT/'Scripts'))
from plateau_life import populate
from plateau_rendering import apply as apply_rendering
from plateau_rendering import nanite
from plateau_ground import apply as apply_ground
from plateau_background import apply as apply_background
from plateau_park import apply as apply_park
from plateau_surfaces import apply as apply_surfaces
from plateau_context import apply as apply_context
from plateau_landmarks import apply as apply_landmarks
from plateau_wayfinding import apply as apply_wayfinding
from plateau_edges import apply as apply_edges
from plateau_perimeter import apply as apply_perimeter
from plateau_landmark_visuals import apply as apply_landmark_visuals
from plateau_facade_finish import apply as apply_facade_finish

assets = u.EditorAssetLibrary
tools = u.AssetToolsHelpers.get_asset_tools()
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
assert levels.get_current_level().get_outer().get_name() == 'LaFontaine'
assert not u.EditorLevelLibrary.get_pie_worlds(False), 'Stop PIE before upgrading the map'
world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
assert world.get_path_name() == '/Game/Maps/LaFontaine.LaFontaine', 'Open the integrated persistent LaFontaine map'
assert u.GameplayStatics.get_streaming_level(world, '/Game/UnifiedWarden/LaFontaine') is None, 'Remove the Warden staging sublevel before upgrading'
instances_class = u.load_class(None, '/Script/Quebec.QuebecParkInstances')
resident_class = u.load_class(None, '/Script/Quebec.QuebecParkResident')
car_class = u.load_class(None, '/Script/Quebec.QuebecCar')
assert instances_class and resident_class and car_class, 'Build the Warden editor module first'


def gameplay_snapshot():
    """The Plateau pass must not replace Warden's saved park or mission actors."""
    result = {}
    counts = {'instances': 0, 'residents': 0, 'cars': 0, 'starts': 0, 'rings': 0, 'beacons': 0}
    for actor in editor.get_all_level_actors():
        label = actor.get_actor_label()
        actor_class = actor.get_class().get_path_name()
        if actor_class == instances_class.get_path_name(): kind = 'instances'
        elif actor_class == resident_class.get_path_name(): kind = 'residents'
        elif actor_class == car_class.get_path_name(): kind = 'cars'
        elif isinstance(actor, u.PlayerStart): kind = 'starts'
        elif label.startswith('Mission ring'): kind = 'rings'
        elif label.startswith('Mission beacon'): kind = 'beacons'
        else: continue
        counts[kind] += 1
        location, rotation, scale = actor.get_actor_location(), actor.get_actor_rotation(), actor.get_actor_scale3d()
        signature = [actor_class, label,
                     (location.x, location.y, location.z),
                     (rotation.pitch, rotation.yaw, rotation.roll),
                     (scale.x, scale.y, scale.z)]
        if kind == 'instances':
            component = actor.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
            assert component, label
            mesh = component.static_mesh
            signature.extend((component.get_instance_count(), mesh.get_path_name() if mesh else None,
                              str(component.get_collision_profile_name()), component.is_visible(),
                              tuple(material.get_path_name() if material else None for material in component.get_materials())))
        elif kind == 'residents':
            signature.extend((actor.get_editor_property('Style'), actor.get_editor_property('Phase'),
                              tuple((point.x, point.y, point.z) for point in actor.get_editor_property('Route'))))
        elif kind == 'cars':
            signature.append(actor.get_editor_property('PaintStyle'))
        result[actor.get_path_name()] = tuple(signature)
    return counts, result


def require_integrated_inventory(counts, actors):
    """Reject the old Warden scene before any map or asset write occurs."""
    assert counts['instances'] == 0, 'Legacy Comic park instances would overlap Plateau park geometry'
    assert counts['residents'] == 14 and counts['cars'] == 9 and counts['starts'] == 4, counts
    assert counts['rings'] == counts['beacons'], 'Mission marker pairs changed'
    inventory = [(actor.get_actor_label(), actor.get_class().get_name()) for actor in actors]
    labels = [label for label, _ in inventory]
    assert not any(label.startswith('Municipal building ') or label == 'Environment architecture accents'
                   for label in labels), 'Legacy Warden building geometry would overlap Plateau architecture'
    assert not any(label == 'Comic park inventory trunks' or label.startswith('Comic park inventory crowns')
                   for label in labels), 'Legacy Warden mapped trees would overlap Plateau vegetation'
    assert not any(name == 'QuebecParkInstances' for _, name in inventory), 'Legacy Comic park actors would overlap Plateau park geometry'
    assert inventory.count(('Plateau mapped vegetation', 'QuebecVegetation')) == 1, 'Integrated surveyed tree layer is missing'
    assert sum(name == 'QuebecVegetation' for _, name in inventory) == 1, 'Duplicate surveyed tree layer'
    assert {label for label, name in inventory if name == 'QuebecParkResident'} == {
        'Comic resident ' + str(i) for i in range(14)}, 'Warden resident route labels changed'
    assert {label for label, name in inventory if name == 'QuebecCar'} == {
        'Your first car', *('Comic parked car ' + str(i) for i in range(8))}, 'Warden saved car layer changed'


warden_counts, warden_actors = gameplay_snapshot()
require_integrated_inventory(warden_counts, editor.get_all_level_actors())
assert levels.save_current_level()
backup = ROOT/'Saved/Recovery/pre-plateau/Content/Maps/LaFontaine.umap'
backup.parent.mkdir(parents=True,exist_ok=True)
if not backup.exists(): shutil.copy2(ROOT/'Content/Maps/LaFontaine.umap',backup)
data = json.loads((ROOT/'Data/Plateau/layout.json').read_text())
layout = json.loads((ROOT/'Data/LaFontaine/layout.json').read_text())
M = u.MaterialEditingLibrary


def expression(mat, cls, **values):
    node = M.create_material_expression(mat,cls)
    for key,value in values.items(): node.set_editor_property(key,value)
    return node


def material(name, color, texture=None, rough=.8, metal=0, emissive=False, uv_scale=1):
    path = '/Game/Plateau/Materials/M_'+name
    mat = assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset('M_'+name,'/Game/Plateau/Materials',u.Material,u.MaterialFactoryNew())
    M.delete_all_material_expressions(mat)
    tint = expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(*color,1))
    output = tint
    rough_output = None
    if texture:
        coordinates = expression(mat,u.MaterialExpressionTextureCoordinate,u_tiling=uv_scale,v_tiling=uv_scale)
        sample = expression(mat,u.MaterialExpressionTextureSample,texture=assets.load_asset('/Game/Art/Textures/'+texture+'_diff'))
        assert M.connect_material_expressions(coordinates,'',sample,'')
        output = expression(mat,u.MaterialExpressionMultiply)
        assert M.connect_material_expressions(sample,'RGB',output,'A')
        assert M.connect_material_expressions(tint,'',output,'B')
        normal = assets.load_asset('/Game/Art/Textures/'+texture+'_nor_dx')
        if normal:
            normal_node = expression(mat,u.MaterialExpressionTextureSample,texture=normal,sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
            assert M.connect_material_expressions(coordinates,'',normal_node,'')
            assert M.connect_material_property(normal_node,'RGB',u.MaterialProperty.MP_NORMAL)
        rough_texture = assets.load_asset('/Game/Art/Textures/'+texture+'_rough')
        if rough_texture:
            rough_output = expression(mat,u.MaterialExpressionTextureSample,texture=rough_texture,sampler_type=u.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
            assert M.connect_material_expressions(coordinates,'',rough_output,'')
    assert M.connect_material_property(output,'',u.MaterialProperty.MP_BASE_COLOR)
    if emissive: assert M.connect_material_property(output,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
    for value,prop in [(rough,u.MaterialProperty.MP_ROUGHNESS),(metal,u.MaterialProperty.MP_METALLIC)]:
        if prop == u.MaterialProperty.MP_ROUGHNESS and rough_output:
            assert M.connect_material_property(rough_output,'R',prop)
        else: assert M.connect_material_property(expression(mat,u.MaterialExpressionConstant,r=value),'',prop)
    M.recompile_material(mat)
    return mat


palette = {
    'Trim':(.66,.67,.61),'Iron':(.025,.035,.033),'Glass':(.035,.075,.10),
    'Wood':(.22,.12,.065),'DoorTeal':(.035,.15,.15),'DoorBurgundy':(.22,.045,.035),
    'Roof':(.065,.075,.075),'Zinc':(.36,.39,.38),'ConcreteDark':(.19,.21,.20),
    'Glow':(.72,.57,.31),'Leaf':(.12,.24,.075),'Soil':(.075,.055,.035),
    'White':(.82,.82,.72),'Yellow':(.75,.56,.12),'Rubber':(.018,.021,.020),
    'Chrome':(.42,.45,.46),'CarBlue':(.035,.12,.20),'CarRed':(.31,.055,.045),
    'CarSilver':(.43,.46,.45),'CarOlive':(.16,.20,.12),'Tail':(.55,.015,.008),
    'SignGreen':(.035,.16,.12),'SignBlue':(.025,.10,.22),'SignRed':(.48,.025,.018),
    'CarGlass':(.025,.05,.065),
    'InteriorDark':(.012,.018,.022),'InteriorWarm':(.16,.105,.055),
    'CurtainIvory':(.48,.43,.33),'CurtainSage':(.18,.24,.19),
    'ConstructionOrange':(.75,.20,.015),
}
materials = {name:material(name,color,rough=.12 if name in ('Glass','CarGlass') else .92 if name.startswith('Curtain') else .3 if name.startswith('Car') else .8,
                           metal=.15 if name=='CarGlass' else .55 if name in ('Chrome','Zinc') or name.startswith('Car') else 0,
                           emissive=name in ('Glow','Tail','InteriorWarm')) for name,color in palette.items()}
for name,color,texture in [('BrickRed',(1.05,.80,.66),'brick_wall_001'),
                           ('BrickBrown',(.68,.63,.53),'brick_wall_001'),
                           ('BrickOchre',(1.25,1.13,.83),'brick_wall_001'),
                           ('Limestone',(1.04,1.02,.94),'concrete_pavement'),
                           ('Concrete',(.90,.94,.91),'concrete_pavement'),
                           ('Asphalt',(.82,.87,.89),'asphalt_02'),
                           ('Gravel',(.58,.55,.47),'concrete_pavement'),
                           ('ParkGrass',(.42,.65,.29),'grass_ground')]:
    materials[name] = material(name,color,texture,uv_scale=1.5 if texture=='brick_wall_001' else 1)


def import_mesh(source, destination, name, collision=False):
    task = u.AssetImportTask(); task.filename = str(source); task.destination_path = destination
    task.destination_name = name; task.automated = True; task.save = True; task.replace_existing = True
    options = u.FbxImportUI(); options.import_mesh = True; options.import_materials = False; options.import_textures = False
    options.import_as_skeletal = False; options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False; task.options = options
    tools.import_asset_tasks([task]); assert task.imported_object_paths, str(source)
    mesh = assets.load_asset(task.imported_object_paths[0]); assert isinstance(mesh,u.StaticMesh)
    if destination in ('/Game/Plateau/Meshes','/Game/Plateau/Background','/Game/Plateau/Park','/Game/Plateau/Context','/Game/Plateau/Wayfinding','/Game/Plateau/Landmarks','/Game/Plateau/Edges'):
        subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
        settings = subsystem.get_lod_build_settings(mesh,0)
        settings.set_editor_property('max_lumen_mesh_cards',64)
        settings.set_editor_property('generate_distance_field_as_if_two_sided',True)
        subsystem.set_lod_build_settings(mesh,0,settings)
    if collision:
        mesh.get_editor_property('body_setup').set_editor_property('collision_trace_flag',u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    assets.save_loaded_asset(mesh)
    return mesh


for old in editor.get_all_level_actors():
    if old.get_actor_label().startswith('Plateau detail '): editor.destroy_actor(old)

# Refresh crossing streets and the minimap from the same clipped OSM geometry.
by_label = {a.get_actor_label():a for a in editor.get_all_level_actors()}
for name in ('Road','Marking','Path'):
    mesh = import_mesh(ROOT/'Data/Plateau/BaseGeometry'/ (name+'.obj'),'/Game/LaFontaine','SM_'+name)
    by_label['OSM '+name].static_mesh_component.set_static_mesh(mesh)
by_label['OSM Grass'].static_mesh_component.set_material(0,materials['ParkGrass'])
for label,color in [('Brick',(1.,.9,.8)),('Cream',(1.5,1.45,1.2)),('Sage',(.65,.9,.75))]:
    by_label['OSM '+label].static_mesh_component.set_material(0,material(label+'Background',color,'brick_wall_001',uv_scale=2.25))

for name in sorted(data['materials']):
    source = ROOT/'Data/Plateau/Geometry'/(name+'.obj')
    metadata = data['materials'][name]
    base = metadata.get('material',name.removesuffix('_Collision'))
    collides = metadata.get('collision',name.endswith('_Collision'))
    assert base in materials, 'Unmapped Plateau material '+base
    mesh = import_mesh(source,'/Game/Plateau/Meshes','SM_'+name,collides)
    actor = editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector())
    actor.set_actor_label('Plateau detail '+name); actor.set_folder_path('Plateau/Architecture and streets')
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.static_mesh_component.set_material(0,materials[base])
    actor.static_mesh_component.set_collision_profile_name('BlockAll' if collides else 'NoCollision')

tree = assets.load_asset('/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02')
assert tree
usage = u.MaterialUsage.MATUSAGE_NANITE
for slot in tree.get_editor_property('static_materials'):
    mat = slot.material_interface
    if isinstance(mat,u.MaterialInstanceConstant): M.set_material_usage_override(mat,usage,True,True)
    else: M.set_base_material_usage(mat,usage,True)
    assert M.has_material_usage(mat,usage)
    assets.save_loaded_asset(mat)
tree_height = tree.get_bounds().box_extent.z*2
assert 300 < tree_height < 600
for i,point in enumerate(data['streets']['detailed_trees']):
    actor = editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector(*point,18),u.Rotator(yaw=i*137.5))
    actor.set_actor_label('Plateau detail street tree '+str(i)); actor.set_folder_path('Plateau/Trees')
    actor.static_mesh_component.set_static_mesh(tree)
    actor.static_mesh_component.set_collision_profile_name('NoCollision')
    scale = (360+i%3*35)/tree_height
    actor.set_actor_scale3d(u.Vector(scale,scale,scale))

signs = data['facades'].get('signs',[]) + data['streets'].get('signs',[])
for i,sign in enumerate(signs):
    normal = sign.get('normal')
    yaw = math.degrees(math.atan2(normal[1],normal[0])) if normal else sign['yaw']
    actor = editor.spawn_actor_from_class(u.TextRenderActor,u.Vector(*sign['position']),u.Rotator(yaw=yaw))
    actor.set_actor_label('Plateau detail sign '+str(i)+' '+sign['text']); actor.set_folder_path('Plateau/Signs')
    component = actor.get_component_by_class(u.TextRenderComponent)
    component.set_text(sign['text']); component.set_world_size(sign['size'])
    component.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER)
    component.set_vertical_alignment(u.VerticalTextAligment.EVRTA_TEXT_CENTER)
    component.set_text_render_color(u.Color(230,229,211,255))
    component.set_collision_profile_name('NoCollision')

ground = apply_ground(u,materials,import_mesh)
background = apply_background(u,import_mesh,nanite)
life = populate(u,editor,assets,layout,data['route'])
rendering = apply_rendering(u)
for actor in editor.get_all_level_actors():
    if isinstance(actor,u.DirectionalLight):
        actor.set_actor_rotation(u.Rotator(pitch=-44,yaw=-35),False)
        actor.light_component.set_editor_property('temperature',6200.)
        actor.light_component.set_editor_property('intensity',26000.)
    elif isinstance(actor,u.SkyLight): actor.light_component.set_editor_property('intensity',1.6)
    elif isinstance(actor,u.PostProcessVolume):
        settings = actor.get_editor_property('settings')
        for key,value in {'override_auto_exposure_min_brightness':True,'override_auto_exposure_max_brightness':True,
                          'auto_exposure_min_brightness':12.5,'auto_exposure_max_brightness':12.5}.items():
            settings.set_editor_property(key,value)
        actor.set_editor_property('settings',settings)

report = {'passed':True,'facades':data['facades']['counts'],'streets':data['streets']['counts'],
          'life':life,'rendering':rendering,'ground':ground,'background':background,'signs':len(signs),'meshes':len(data['materials']),'route':data['route']}
report['surfaces'] = apply_surfaces(u,materials,expression,material)
report['park'] = apply_park(u,materials,import_mesh,nanite)
report['context'] = apply_context(u,materials,import_mesh,nanite)
assert report['context']['building_count'] >= len(json.loads((ROOT/'Data/CityBuildings/manifest.json').read_text())['buildings'])
report['landmarks'] = apply_landmarks(u,materials,import_mesh,nanite)
report['wayfinding'] = apply_wayfinding(u,materials,expression,import_mesh,nanite)
report['edges'] = apply_edges(u,materials,import_mesh,nanite)
report['perimeter'] = apply_perimeter(u,import_mesh,nanite)
report['landmark_visuals'] = apply_landmark_visuals(u,import_mesh,nanite,regenerate_bindings=True)
report['facade_finish'] = apply_facade_finish(u,import_mesh,nanite)
assert gameplay_snapshot() == (warden_counts, warden_actors), 'Plateau upgrade changed Warden gameplay actors'
report['warden_preserved'] = warden_counts
assets.save_directory('/Game/Plateau'); assets.save_directory('/Game/LaFontaine')
assert levels.save_current_level()
output = ROOT/'Saved/Tests/PlateauBuild.json'; output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,ensure_ascii=False,indent=2))
u.log('PLATEAU_UPGRADE_OK '+json.dumps(report,ensure_ascii=False))
