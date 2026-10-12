"""Production geometry with a saved-editor facade; no compiled/GPU resources."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace

from plateau_wayfinding import CARTOGRAPHY, prepare
from test_verify_plateau_ground import Component, Object, StaticMesh, Vector
import verify_plateau_wayfinding as verifier


def _path(path):
    return path + '.' + path.rsplit('/', 1)[1]


class Texture(Object):
    def get_path_name(self): return self.path


class Sample(Object):
    pass


class Constant(Object):
    pass


class Material(Object):
    def get_path_name(self): return self.path


class Description:
    def __init__(self, board):
        self.points = [Vector(*p) for p in board['panel_corners_cm']]
        self.uvs = [Object(x=u, y=1-v) for u, v in board['obj_uvs']]
    def get_triangle_count(self): return 2
    def get_triangle_vertex_instances(self, triangle): return [(2, 1, 0), (3, 2, 0)][triangle.id_value]
    def get_vertex_instance_vertex(self, instance): return instance
    def get_vertex_position(self, vertex): return self.points[vertex]
    def get_vertex_instance_uv(self, instance, index): return self.uvs[instance]


class Mesh(StaticMesh, Object):
    def __init__(self, name, metadata, board=None):
        low, high = metadata['bounds_cm']['min'], metadata['bounds_cm']['max']
        super().__init__(name, metadata['triangles'], [low[0], low[1], high[0], high[1], low[2], high[2]])
        self.path = _path(metadata['mesh_asset'])
        self.nanite_settings = Object(enabled=True, fallback_target=1, fallback_percent_triangles=1., fallback_relative_error=0.)
        self.build_settings = Object(max_lumen_mesh_cards=64, generate_distance_field_as_if_two_sided=True)
        self.body_setup = Object(collision_trace_flag=3)
        self.description = Description(board) if board else None
    def get_path_name(self): return self.path
    def get_static_mesh_description(self, index): return self.description


class BoardComponent(Component):
    def is_visible(self): return self.visible


class Actor(Object):
    def __init__(self, name, metadata, material, board=None):
        self.hidden, self.hidden_ed = False, False
        self.position, self.scale = Vector(), Vector(1, 1, 1)
        self.rotation = Object(roll=0, pitch=0, yaw=0)
        collides = metadata['collision']
        self.static_mesh_component = BoardComponent(static_mesh=Mesh(name, metadata, board), material=material,
            profile='BlockAll' if collides else 'NoCollision', collision=2 if collides else 0,
            cast_shadow=collides, visible=True, hidden_in_game=False)
    def is_hidden_ed(self): return self.hidden_ed
    def get_actor_location(self): return self.position
    def get_actor_scale3d(self): return self.scale
    def get_actor_rotation(self): return self.rotation


def _expect_rejected(action, message):
    try:
        action()
    except AssertionError:
        return
    raise AssertionError('Wayfinding verifier accepted ' + message)


def main():
    source = json.loads(CARTOGRAPHY.read_text())
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        cartography = root / 'Data/Plateau/Cartography'
        cartography.mkdir(parents=True)
        (cartography / 'cartography.json').write_bytes(CARTOGRAPHY.read_bytes())
        for board in source['boards']:
            (cartography / board['png']).write_bytes((CARTOGRAPHY.parent / board['png']).read_bytes())
        directory = root / 'Data/Plateau/Wayfinding/Geometry'
        manifest = prepare(directory, cartography / 'cartography.json')
        files_before = {p: p.read_bytes() for p in root.rglob('*') if p.is_file()}
        assets, labels = {}, {'Unrelated actor': Object()}
        iron = Material(path='/Game/Plateau/Materials/M_Iron.M_Iron', nanite_usage=True)
        for board in manifest['boards']:
            texture = Texture(path=_path(board['texture_asset']), srgb=True, power_of_two_mode=1,
                pad_with_border_color=True, compression_settings=7, address_x=1, address_y=1,
                mip_gen_settings=2, never_stream=False)
            sample = Sample(texture=texture, inputs=[], const_coordinate=0)
            material = Material(path=_path(board['material_asset']), nanite_usage=True, two_sided=False,
                blend_mode=0, used_textures=[], expressions=[sample],
                connections={'base': sample, 'rough': Constant(r=.9), 'metal': Constant(r=0),
                             'spec': Constant(r=.2), 'emissive': None})
            assets[board['texture_asset']], assets[board['material_asset']] = texture, material
        for name, metadata in manifest['batches'].items():
            board = next((b for b in manifest['boards'] if b['panel_mesh_name'] == name), None)
            material = assets[board['material_asset']] if board else iron
            labels[metadata['actor_label']] = Actor(name, metadata, material, board)
        subsystem = Object(get_lod_build_settings=lambda mesh, lod: mesh.build_settings)
        fake = SimpleNamespace(StaticMeshActor=Actor, StaticMesh=Mesh, Material=Material, Texture2D=Texture,
            StaticMeshEditorSubsystem=object, get_editor_subsystem=lambda cls: subsystem,
            CollisionEnabled=Object(NO_COLLISION=0, QUERY_AND_PHYSICS=2),
            CollisionTraceFlag=Object(CTF_USE_COMPLEX_AS_SIMPLE=3), NaniteFallbackTarget=Object(PERCENT_TRIANGLES=1),
            MaterialUsage=Object(MATUSAGE_NANITE=8), TexturePowerOfTwoSetting=Object(PAD_TO_POWER_OF_TWO=1),
            TextureCompressionSettings=Object(TC_BC7=7), TextureAddress=Object(TA_CLAMP=1),
            TextureMipGenSettings=Object(TMGS_SHARPEN2=2), BlendMode=Object(BLEND_OPAQUE=0),
            MaterialExpressionTextureSample=Sample, MaterialExpressionConstant=Constant,
            TriangleID=lambda id_value: Object(id_value=id_value),
            MaterialProperty=Object(MP_BASE_COLOR='base', MP_ROUGHNESS='rough', MP_METALLIC='metal', MP_SPECULAR='spec', MP_EMISSIVE_COLOR='emissive'),
            EditorAssetLibrary=Object(load_asset=lambda path: assets.get(path)),
            MaterialEditingLibrary=Object(has_material_usage=lambda mat, usage: mat.nanite_usage,
                get_material_used_textures=lambda mat: mat.used_textures,
                get_material_property_input_node=lambda mat, prop: mat.connections[prop],
                get_inputs_for_material_expression=lambda mat, node: node.inputs))
        check = lambda: verifier.verify(fake, labels, root)
        result = check()
        assert result['boards'] == 2 and result['batches'] == 4 and result['triangles'] == 572
        assert result['saved_uv_corners'] == 8
        assert {p: p.read_bytes() for p in root.rglob('*') if p.is_file()} == files_before, 'Verifier changed source files'
        board = manifest['boards'][0]
        image = labels['Plateau wayfinding ' + board['id']]
        frame = labels[manifest['batches'][board['frame_batches'][0]]['actor_label']]
        c, mesh = frame.static_mesh_component, frame.static_mesh_component.static_mesh
        panel = image.static_mesh_component.static_mesh
        material, texture = assets[board['material_asset']], assets[board['texture_asset']]
        sample = material.connections['base']
        assert material.used_textures == [], 'Fixture must represent uncompiled NullRHI shaders'
        mutations = [(c, 'profile', 'NoCollision'), (c, 'collision', 0),
            (image.static_mesh_component, 'profile', 'BlockAll'), (image.static_mesh_component, 'collision', 2),
            (mesh.body_setup, 'collision_trace_flag', 0), (c, 'visible', False), (c, 'hidden_in_game', True),
            (frame, 'hidden', True), (frame, 'hidden_ed', True), (c, 'cast_shadow', False),
            (image.static_mesh_component, 'cast_shadow', True), (c, 'material', None),
            (iron, 'path', '/Game/Wrong.Wrong'), (iron, 'nanite_usage', False),
            (mesh, 'path', '/Game/Wrong.Wrong'), (mesh.nanite_settings, 'enabled', False),
            (mesh.nanite_settings, 'fallback_target', 0), (mesh.nanite_settings, 'fallback_percent_triangles', .5),
            (mesh.nanite_settings, 'fallback_relative_error', .1), (mesh.build_settings, 'max_lumen_mesh_cards', 12),
            (mesh.build_settings, 'generate_distance_field_as_if_two_sided', False),
            (mesh.bounds.origin, 'x', mesh.bounds.origin.x + 1), (mesh.bounds.box_extent, 'z', 0),
            (frame.position, 'x', 1), (frame.scale, 'z', 2), (frame.rotation, 'yaw', 1),
            (frame.rotation, 'pitch', float('nan')), (mesh, 'triangles', 280), (c, 'static_mesh', None),
            (texture, 'path', '/Game/Wrong.Wrong'), (texture, 'srgb', False),
            (texture, 'power_of_two_mode', 0), (texture, 'pad_with_border_color', False),
            (texture, 'compression_settings', 0), (texture, 'address_x', 0), (texture, 'address_y', 0),
            (texture, 'mip_gen_settings', 0), (texture, 'never_stream', True),
            (material, 'two_sided', True), (material, 'blend_mode', 1),
            (material, 'path', '/Game/Wrong.Wrong'), (material, 'nanite_usage', False),
            (material.connections['rough'], 'r', .1), (sample, 'texture', None),
            (sample, 'const_coordinate', 1), (sample, 'inputs', [Object(inputs=[])]),
            (panel.description.uvs[0], 'x', .75), (panel.description.uvs[0], 'y', 0),
            (panel.description.points[0], 'x', panel.description.points[0].x + 1)]
        for obj, key, bad in mutations:
            original = getattr(obj, key)
            setattr(obj, key, bad)
            try: _expect_rejected(check, key)
            finally: setattr(obj, key, original)
        original = material.connections['base']
        material.connections['base'] = Object(inputs=[])  # Correct texture still exists, disconnected.
        try: _expect_rejected(check, 'a disconnected BaseColor sample')
        finally: material.connections['base'] = original
        original = material.connections['emissive']
        material.connections['emissive'] = Constant(r=.1)
        try: _expect_rejected(check, 'emissive cartography')
        finally: material.connections['emissive'] = original
        label = manifest['batches'][board['frame_batches'][0]]['actor_label']
        removed = labels.pop(label)
        try: _expect_rejected(check, 'a missing board frame')
        finally: labels[label] = removed
        labels['Plateau wayfinding stale'] = removed
        try: _expect_rejected(check, 'an extra stale actor')
        finally: labels.pop('Plateau wayfinding stale')
        metadata_path = directory / 'wayfinding.json'
        changed = json.loads(json.dumps(manifest))
        changed['boards'][0]['position_cm'][0] += 1
        metadata_path.write_text(json.dumps(changed))
        try: _expect_rejected(check, 'changed placement metadata')
        finally: metadata_path.write_bytes(files_before[metadata_path])
        obj = directory / (board['panel_mesh_name'] + '.obj')
        obj.write_text(obj.read_text().replace('vt 0.75000', 'vt 1.00000'))
        try: _expect_rejected(check, 'changed OBJ UVs')
        finally: obj.write_bytes(files_before[obj])
        png = cartography / board['texture_source']
        png.write_bytes(png.read_bytes() + b'corrupted')
        try: _expect_rejected(check, 'a changed source artwork hash')
        finally: png.write_bytes(files_before[png])
        assert check() == result
        print('PLATEAU_WAYFINDING_SAVED_CHECKS_OK', len(mutations) + 8, 'corruption cases rejected; 4 batches / 572 triangles')


if __name__ == '__main__':
    main()
