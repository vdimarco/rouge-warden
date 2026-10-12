"""Two surveyed park orientation boards, in original world centimetres.

Artwork comes exclusively from the approved cartography manifest.  The steelwork
uses the shared mesh/batching helpers; the artwork needs explicit full-image UVs
instead of Mesh.write's world-space tiling.  Unreal is imported only by the caller.
"""
import hashlib
import json
import math
from pathlib import Path
import struct

from plateau_batches import spatial_batches
from plateau_mesh import Mesh

ROOT = Path(__file__).resolve().parents[1]
CARTOGRAPHY = ROOT / 'Data/Plateau/Cartography/cartography.json'
GEOMETRY = ROOT / 'Data/Plateau/Wayfinding/Geometry'
DESTINATION = '/Game/Plateau/Wayfinding'
LABEL_PREFIX = 'Plateau wayfinding '
IMAGE_WIDTH, IMAGE_HEIGHT = 105., 140.
IMAGE_BOTTOM, IMAGE_TOP = 75., 215.
FRAME_WIDTH, FRAME_HEIGHT = 112., 148.
PANEL_OFFSET = 1.15


def _sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _bounds(faces):
    points = [p for face in faces for p in face]
    return {'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)]}


def _triangle_count(faces):
    return sum(len(face) - 2 for face in faces)


def load_cartography(path=CARTOGRAPHY):
    """Reject stale/mismatched artwork before any Unreal assets are touched."""
    path = Path(path)
    source = json.loads(path.read_text())
    assert len(source['boards']) == 2, 'Expected the two approved orientation boards'
    identifiers = set()
    for board in source['boards']:
        identifier = board['id']
        assert identifier.isalnum() and identifier not in identifiers
        identifiers.add(identifier)
        normal = board['facing_normal_xy']
        assert len(normal) == 2 and abs(math.hypot(*normal) - 1) < 1e-9
        assert len(board['position_cm']) == 2
        assert all(math.isfinite(v) for v in board['position_cm'] + normal)
        assert abs(math.remainder(math.degrees(math.atan2(normal[1], normal[0])) -
                                  board['facing_yaw_degrees'], 360)) < 1e-8
        # Even the farthest point of the complete steel footprint leaves room
        # for a 42 cm walking capsule and another 10 cm of tolerance.
        assert board['path_edge_clearance_cm'] - math.hypot(FRAME_WIDTH / 2, 7) > 52
        image = path.parent / board['png']
        assert image.parent == path.parent and image.suffix.lower() == '.png'
        assert _sha256(image) == board['png_sha256'], identifier + ' artwork hash mismatch'
        header = image.read_bytes()[:24]
        assert header[:8] == b'\x89PNG\r\n\x1a\n' and header[12:16] == b'IHDR'
        dimensions = list(struct.unpack('>II', header[16:24]))
        assert dimensions == board['image_size_pixels']
        assert dimensions[0] * IMAGE_HEIGHT == dimensions[1] * IMAGE_WIDTH
    return source


def build_geometry(source):
    """Return shared steel geometry and serializable board dimensions/corners."""
    mesh, boards = Mesh(), []
    for board in source['boards']:
        x, y = board['position_cm']
        nx, ny = board['facing_normal_xy']
        # A viewer standing along +normal sees +right on their own right.
        rx, ry = ny, -nx
        yaw = board['facing_yaw_degrees']

        def point(right, depth, z):
            return (x + right * rx + depth * nx, y + right * ry + depth * ny, z)

        def steel(right, depth, z, width, thickness, height):
            # Mesh.box's local X follows normal; its local Y follows -right.
            mesh.box('Iron_Collision', point(right, depth, z),
                     (thickness, width, height), yaw)

        # Narrow posts overlap the plate at the rear, with modest ground shoes.
        for right in (-45., 45.):
            steel(right, -2.5, 110.5, 4.5, 4.5, 217.)  # z2..219
            steel(right, -2.5, 2.6, 8., 9., 1.2)
        steel(0, 0, 145, FRAME_WIDTH, 1.8, FRAME_HEIGHT)
        for right in (-54.25, 54.25):
            steel(right, 1, 145, 3.5, 4, FRAME_HEIGHT)
        for z in (73., 217.):
            steel(0, 1, z, FRAME_WIDTH, 4, 4.)
        # Small flush fasteners sit on the surround, outside the printed image.
        for right in (-54.25, 54.25):
            for z in (73., 217.):
                mesh.rod('Iron_Collision', point(right, 2.98, z),
                         point(right, 3.3, z), .45, sides=12)

        # BL, TL, TR, BR winds towards +normal in original world coordinates.
        corners = [point(-IMAGE_WIDTH / 2, PANEL_OFFSET, IMAGE_BOTTOM),
                   point(-IMAGE_WIDTH / 2, PANEL_OFFSET, IMAGE_TOP),
                   point(IMAGE_WIDTH / 2, PANEL_OFFSET, IMAGE_TOP),
                   point(IMAGE_WIDTH / 2, PANEL_OFFSET, IMAGE_BOTTOM)]
        identifier = board['id']
        pixels = board['image_size_pixels']
        padded = [1 << (size - 1).bit_length() for size in pixels]
        u_max, v_min = pixels[0] / padded[0], 1. - pixels[1] / padded[1]
        boards.append({
            'id': identifier, 'location': board['location'],
            'position_cm': [x, y, 0.], 'facing_normal_xy': [nx, ny],
            'facing_yaw_degrees': yaw, 'viewer_right_xy': [rx, ry],
            'image_size_cm': [IMAGE_WIDTH, IMAGE_HEIGHT],
            'image_bottom_cm': IMAGE_BOTTOM, 'image_top_cm': IMAGE_TOP,
            'frame_size_cm': [FRAME_WIDTH, FRAME_HEIGHT],
            'panel_offset_cm': PANEL_OFFSET, 'panel_corners_cm': [list(p) for p in corners],
            # PadToPowerOfTwo copies at the top-left and pads right/bottom.
            # OBJ V is bottom-origin; the padded Texture2D V is top-origin.
            'obj_uvs': [[0., v_min], [0., 1.], [u_max, 1.], [u_max, v_min]],
            'panel_mesh_name': 'Wayfinding_' + identifier,
            'texture_source': board['png'], 'texture_sha256': board['png_sha256'],
            'image_size_pixels': board['image_size_pixels'],
            'texture_built_size_pixels': padded,
            'texture_uv_bounds': [0., 0., u_max, pixels[1] / padded[1]],
            'texture_padding': 'PadToPowerOfTwo, right/bottom, repeated border pixels',
            'texture_asset': DESTINATION + '/T_Wayfinding_' + identifier,
            'material_asset': DESTINATION + '/M_Wayfinding_' + identifier,
            'path_edge_clearance_cm': board['path_edge_clearance_cm'],
            'nearest_path': board['nearest_path'],
            'nearest_path_point_cm': board['nearest_path_point_cm'],
            'steel_footprint_cm': [list(point(r, d, 0)[:2]) for r, d in
                                   [(-56, -7), (56, -7), (56, 3.3), (-56, 3.3)]],
            'minimum_capsule_edge_clearance_cm': board['path_edge_clearance_cm'] - math.hypot(56, 7),
            'frame_collision': True, 'panel_collision': False,
        })
    return mesh, boards


def _write_panel(path, board):
    """Use Mesh.write's Y reflection/winding with standard bottom-origin OBJ UVs.

    UE's FBX/OBJ importer inverts V for its top-origin texture coordinates
    (FbxStaticMeshImport.cpp).  Thus the image's upper-left pixel lands at TL.
    """
    lines = ['o ' + board['panel_mesh_name']]
    lines += [f'v {x:.3f} {-y:.3f} {z:.3f}' for x, y, z in board['panel_corners_cm']]
    lines += [f'vt {u:.5f} {v:.5f}' for u, v in board['obj_uvs']]
    lines += ['f 3/3 2/2 1/1', 'f 4/4 3/3 1/1']
    Path(path).write_text('\n'.join(lines) + '\n')


def prepare(directory=None, cartography_path=CARTOGRAPHY):
    """Pure generation; a directory override keeps source tests out of Data."""
    directory, cartography_path = Path(directory or GEOMETRY), Path(cartography_path)
    source = load_cartography(cartography_path)
    steel, boards = build_geometry(source)
    mesh, batches, tile_size = spatial_batches(steel)
    mesh.write(directory)
    for name, metadata in batches.items():
        metadata.update(bounds_cm=_bounds(mesh.groups[name]),
                        mesh_asset=DESTINATION + '/SM_' + name,
                        actor_label=LABEL_PREFIX + 'frame ' + name)
        metadata['board_ids'] = [b['id'] for b in boards if any(
            math.dist(b['position_cm'][:2], [sum(p[i] for p in face) / len(face) for i in (0, 1)]) < 200
            for face in mesh.groups[name])]
        metadata['sha256'] = _sha256(directory / (name + '.obj'))
    for board in boards:
        name = board['panel_mesh_name']
        _write_panel(directory / (name + '.obj'), board)
        batches[name] = {'material': 'Wayfinding_' + board['id'], 'collision': False,
                         'faces': 1, 'triangles': 2,
                         'bounds_cm': _bounds([board['panel_corners_cm']]),
                         'sha256': _sha256(directory / (name + '.obj')),
                         'mesh_asset': DESTINATION + '/SM_' + name,
                         'actor_label': LABEL_PREFIX + board['id'], 'board_ids': [board['id']]}
        board['frame_batches'] = [n for n, b in batches.items() if b['collision'] and board['id'] in b['board_ids']]
    report = {'version': 1, 'cartography_manifest_sha256': _sha256(cartography_path),
              'cartography_directory': str(cartography_path.parent.relative_to(ROOT))
                  if cartography_path.is_relative_to(ROOT) else str(cartography_path.parent),
              'source': source['source'], 'attribution': source['attribution'],
              'licence_url': source['licence_url'], 'boards': boards, 'batches': batches,
              'tile_size_cm': tile_size,
              'triangles': sum(b['triangles'] for b in batches.values()),
              'collision': 'Complex BlockAll steel frame/backplate/posts; NoCollision printed faces',
              'destination': DESTINATION, 'label_prefix': LABEL_PREFIX}
    (directory / 'wayfinding.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def apply(u, materials, expression, import_mesh, nanite):
    """Import the generated boards; caller owns the final level/assets save."""
    report = prepare()
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    tools = u.AssetToolsHelpers.get_asset_tools()
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    board_materials = {}
    for board in report['boards']:
        task = u.AssetImportTask()
        task.filename = str(CARTOGRAPHY.parent / board['texture_source'])
        task.destination_path = DESTINATION
        task.destination_name = 'T_Wayfinding_' + board['id']
        task.automated = True
        task.replace_existing = True
        task.save = True
        tools.import_asset_tasks([task])
        assert task.imported_object_paths, task.filename
        texture = assets.load_asset(board['texture_asset'])
        assert isinstance(texture, u.Texture2D), board['texture_asset']
        texture.set_editor_property('srgb', True)
        texture.set_editor_property('address_x', u.TextureAddress.TA_CLAMP)
        texture.set_editor_property('address_y', u.TextureAddress.TA_CLAMP)
        texture.set_editor_property('power_of_two_mode', u.TexturePowerOfTwoSetting.PAD_TO_POWER_OF_TWO)
        texture.set_editor_property('pad_with_border_color', True)
        texture.set_editor_property('mip_gen_settings', u.TextureMipGenSettings.TMGS_SHARPEN2)
        texture.set_editor_property('never_stream', False)
        texture.set_editor_property('compression_settings', u.TextureCompressionSettings.TC_BC7)
        assets.save_loaded_asset(texture)

        path = board['material_asset']
        material = assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset(
            'M_Wayfinding_' + board['id'], DESTINATION, u.Material, u.MaterialFactoryNew())
        assert isinstance(material, u.Material)
        library.delete_all_material_expressions(material)
        material.set_editor_property('two_sided', False)
        material.set_editor_property('blend_mode', u.BlendMode.BLEND_OPAQUE)
        sample = expression(material, u.MaterialExpressionTextureSample, texture=texture)
        library.connect_material_property(sample, 'RGB', u.MaterialProperty.MP_BASE_COLOR)
        for property_name, value in (('MP_ROUGHNESS', .9), ('MP_METALLIC', 0.), ('MP_SPECULAR', .2)):
            node = expression(material, u.MaterialExpressionConstant, r=value)
            library.connect_material_property(node, '', getattr(u.MaterialProperty, property_name))
        library.recompile_material(material)
        board_materials['Wayfinding_' + board['id']] = material

    # Refresh only this feature's actors; source geography and other details stay intact.
    for actor in editor.get_all_level_actors():
        if actor.get_actor_label().startswith(LABEL_PREFIX):
            editor.destroy_actor(actor)
    for name, metadata in sorted(report['batches'].items()):
        material = materials['Iron'] if metadata['material'] == 'Iron' else board_materials[metadata['material']]
        mesh = import_mesh(GEOMETRY / (name + '.obj'), DESTINATION, 'SM_' + name,
                           collision=metadata['collision'])
        nanite(u, mesh, [material])
        actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector())
        actor.set_actor_label(metadata['actor_label'])
        actor.set_folder_path('Plateau/Wayfinding')
        component = actor.static_mesh_component
        component.set_static_mesh(mesh)
        component.set_material(0, material)
        component.set_collision_profile_name('BlockAll' if metadata['collision'] else 'NoCollision')
        component.set_cast_shadow(metadata['collision'])
    return report


if __name__ == '__main__':
    print(json.dumps(prepare(), ensure_ascii=False, indent=2))
