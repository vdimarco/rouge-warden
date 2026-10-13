"""Shared surface and atmosphere polish for the saved Plateau environment."""
import plateau_atmosphere
import plateau_water


def rewrap(u):
    """Put the NordSky wet-ground and night-window wrappers back on the Plateau materials.

    upgrade_plateau.py rebuilds M_Asphalt, M_Concrete, M_ConcreteDark, M_Gravel, M_ParkEarth, M_Glow,
    M_InteriorWarm and M_Tail from scratch, which removes the wrappers that plateau_atmosphere.py added.
    Once that pass has made MPC_NordAtmosphere, a regeneration must keep wet streets and lit windows,
    so the same idempotent builders run again here. The unlit materials it wraps are not rebuilt here.
    """
    assets = u.EditorAssetLibrary
    if not assets.does_asset_exist(plateau_atmosphere.COLLECTION):
        return None
    mpc = assets.load_asset(plateau_atmosphere.COLLECTION)
    wrapped = {}
    for build, paths in ((plateau_atmosphere.wet_ground, plateau_atmosphere.WET),
                         (plateau_atmosphere.night_window, plateau_atmosphere.WINDOWS)):
        for path in paths:
            mat = assets.load_asset(path)
            assert isinstance(mat, u.Material), ('Missing Plateau material for the NordSky wrappers', path)
            wrapped[path] = build(u, mat, mpc)
            if wrapped[path]:
                u.MaterialEditingLibrary.recompile_material(mat)
                assert assets.save_loaded_asset(mat), path
    return wrapped


def apply(u, materials, expression, material):
    library = u.MaterialEditingLibrary

    def link(source, output, target, name):
        assert library.connect_material_expressions(source, output, target, name)

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
    # plateau_water owns the pond graph, so a full regeneration keeps the nord-sky-water pond; it uses
    # the shore texture and MPC_NordAtmosphere once plateau_atmosphere.py has made them.
    pond = plateau_water.author(u, water, *plateau_water.existing(u))
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
    # Every wrapped material is rebuilt by now (the palette and textured ones before this pass, ParkEarth
    # and Asphalt above), and no later Plateau pass rebuilds them.
    rewrapped = rewrap(u)
    return {'pond_normal_waves': pond['wave_normals'], 'pond_shore_texture': pond['shore_texture'],
            'pond_collection': pond['collection'], 'nord_sky_rewrapped': rewrapped, 'lawn_macro_variation': True,
            'continuous_world_asphalt_uv': True, 'cloud_material': cloud_material.get_path_name(), 'skylight_intensity': 1.9}
