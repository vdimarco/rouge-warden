"""Shared surface and atmosphere polish for the saved Plateau environment."""


def apply(u, materials, expression, material):
    library = u.MaterialEditingLibrary

    def link(source, output, target, name):
        assert library.connect_material_expressions(source, output, target, name)

    def color(mat, value):
        return expression(mat, u.MaterialExpressionConstant3Vector, constant=u.LinearColor(*value, 1))

    materials['ParkWood'] = material('ParkWood', (.25, .16, .085), rough=.78)
    materials['AutumnGold'] = material('AutumnGold', (.36, .17, .028), rough=.94)
    materials['AutumnRust'] = material('AutumnRust', (.22, .065, .022), rough=.94)
    materials['ParkEarth'] = material('ParkEarth', (1.25, .94, .62), 'asphalt_02', rough=.95, uv_scale=.7)
    for key in ('AutumnGold', 'AutumnRust', 'Leaf'):
        materials[key].set_editor_property('two_sided', True)

    grass = material('ParkGrass', (.42, .65, .29), 'grass_ground')
    materials['ParkGrass'] = grass
    original = library.get_material_property_input_node(grass, u.MaterialProperty.MP_BASE_COLOR)
    assert original
    world = expression(grass, u.MaterialExpressionWorldPosition)
    x = expression(grass, u.MaterialExpressionComponentMask, r=True, g=False, b=False, a=False)
    y = expression(grass, u.MaterialExpressionComponentMask, r=False, g=True, b=False, a=False)
    link(world, '', x, ''); link(world, '', y, '')
    slow = expression(grass, u.MaterialExpressionMultiply, const_b=.00019)
    fast = expression(grass, u.MaterialExpressionMultiply, const_b=.00047)
    link(x, '', slow, 'A'); link(y, '', fast, 'A')
    first = expression(grass, u.MaterialExpressionSine)
    second = expression(grass, u.MaterialExpressionSine)
    link(slow, '', first, ''); link(fast, '', second, '')
    combined = expression(grass, u.MaterialExpressionMultiply)
    link(first, '', combined, 'A'); link(second, '', combined, 'B')
    strength = expression(grass, u.MaterialExpressionMultiply, const_b=.12)
    link(combined, '', strength, 'A')
    offset = expression(grass, u.MaterialExpressionAdd, const_b=.92)
    link(strength, '', offset, 'A')
    finish = expression(grass, u.MaterialExpressionMultiply)
    link(original, '', finish, 'A'); link(offset, '', finish, 'B')
    assert library.connect_material_property(finish, '', u.MaterialProperty.MP_BASE_COLOR)
    library.recompile_material(grass)

    asphalt = material('Asphalt', (.82, .87, .89), 'asphalt_02')
    materials['Asphalt'] = asphalt
    world = expression(asphalt, u.MaterialExpressionWorldPosition)
    mask = expression(asphalt, u.MaterialExpressionComponentMask, r=True, g=True, b=False, a=False)
    link(world, '', mask, '')
    coordinates = expression(asphalt, u.MaterialExpressionMultiply, const_b=.005)
    link(mask, '', coordinates, 'A')
    for node in library.get_material_expressions(asphalt):
        if isinstance(node, u.MaterialExpressionTextureSample):
            link(coordinates, '', node, '')
    library.recompile_material(asphalt)

    water = material('PondWater', (.012, .035, .028), rough=.17, metal=.08)
    world = expression(water, u.MaterialExpressionWorldPosition)
    time = expression(water, u.MaterialExpressionTime)
    normals = []
    for direction, speed, strength in (((.004, .0015, 0), .055, .012), ((-.0017, .006, 0), -.037, .008)):
        spatial = expression(water, u.MaterialExpressionDotProduct)
        link(world, '', spatial, 'A'); link(color(water, direction), '', spatial, 'B')
        motion = expression(water, u.MaterialExpressionMultiply, const_b=speed)
        link(time, '', motion, 'A')
        phase = expression(water, u.MaterialExpressionAdd)
        link(spatial, '', phase, 'A'); link(motion, '', phase, 'B')
        wave = expression(water, u.MaterialExpressionSine)
        link(phase, '', wave, '')
        amplitude = expression(water, u.MaterialExpressionMultiply, const_b=strength)
        link(wave, '', amplitude, 'A'); normals.append(amplitude)
    combined = expression(water, u.MaterialExpressionAppendVector)
    link(normals[0], '', combined, 'A'); link(normals[1], '', combined, 'B')
    normal = expression(water, u.MaterialExpressionAppendVector)
    link(combined, '', normal, 'A')
    link(expression(water, u.MaterialExpressionConstant, r=1.), '', normal, 'B')
    assert library.connect_material_property(normal, '', u.MaterialProperty.MP_NORMAL)
    fresnel = expression(water, u.MaterialExpressionFresnel, exponent=4., base_reflect_fraction=.04)
    reflected_color = expression(water, u.MaterialExpressionLinearInterpolate)
    link(color(water, (.012, .035, .028)), '', reflected_color, 'A')
    link(color(water, (.055, .095, .085)), '', reflected_color, 'B')
    link(fresnel, '', reflected_color, 'Alpha')
    assert library.connect_material_property(reflected_color, '', u.MaterialProperty.MP_BASE_COLOR)
    library.recompile_material(water)
    materials['PondWater'] = water

    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    actors = editor.get_all_level_actors()
    for actor in actors:
        if actor.get_actor_label() == 'OSM Road':
            actor.static_mesh_component.set_material(0, asphalt)
    cloud = next((a for a in actors if isinstance(a, u.VolumetricCloud)), None)
    if cloud is None:
        cloud = editor.spawn_actor_from_class(u.VolumetricCloud, u.Vector())
        cloud.set_actor_label('Plateau autumn clouds')
    component = cloud.get_component_by_class(u.VolumetricCloudComponent)
    cloud_material = u.EditorAssetLibrary.load_asset('/Engine/EngineSky/VolumetricClouds/m_SimpleVolumetricCloud_Inst')
    assert cloud_material
    component.set_material(cloud_material)
    component.set_editor_property('layer_bottom_altitude', 1.8)
    component.set_editor_property('layer_height', 1.4)
    cloud.set_folder_path('Plateau/Atmosphere')
    for actor in actors:
        if isinstance(actor, u.ExponentialHeightFog):
            fog = actor.get_component_by_class(u.ExponentialHeightFogComponent)
            fog.set_fog_density(.003)
            fog.set_start_distance(8000.)
        elif isinstance(actor, u.SkyLight):
            actor.light_component.set_editor_property('intensity', 1.9)
    for mat in (grass, asphalt, water, materials['ParkWood'], materials['AutumnGold'], materials['AutumnRust'], materials['Leaf']):
        u.EditorAssetLibrary.save_loaded_asset(mat)
    return {'pond_normal_waves': 2, 'lawn_macro_variation': True,
            'continuous_world_asphalt_uv': True, 'cloud_material': cloud_material.get_path_name(), 'skylight_intensity': 1.9}
