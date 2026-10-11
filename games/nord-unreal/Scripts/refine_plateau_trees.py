"""Refine the retained mapped trees' foliage without moving or replacing any tree.

Run apply(unreal) outside PIE, then apply_comic_style.py and capture actual renders.
Saved/Recovery retains every affected asset before writes; no map save or import occurs.
"""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
MESH = '/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02'
LEAF = '/Game/Art/M_DetailedAutumnLeaves'
ALPHA = '/Game/Art/Tree/tree_small_02_leaves_alpha_1k'
DIFFUSE = '/Game/Art/Tree/tree_small_02/Textures/tree_small_02_leaves_diff-tree_small_02_leaves_alpha'
GREEN_TINT = (.85, 1.35, .75)
GOLD_TINT = (1.8, 1.2, .5)
MASK_CLIP = 1. / 3.


def source_inventory(root=ROOT):
    """Reject an unrelated source/alpha pairing before changing the saved material."""
    folder = root / 'Data/Art/tree_small_02'
    data = json.loads((folder / 'tree_small_02.gltf').read_text())
    leaf = next(m for m in data['materials'] if m['name'] == 'tree_small_02_leaves')
    assert leaf['doubleSided'] and leaf['alphaMode'] == 'BLEND'
    primitive = next(p for p in data['meshes'][0]['primitives']
                     if data['materials'][p['material']]['name'] == leaf['name'])
    assert data['accessors'][primitive['indices']]['count'] % 3 == 0
    color = leaf['pbrMetallicRoughness']['baseColorTexture']['index']
    image = data['images'][data['textures'][color]['source']]['uri']
    assert image == 'textures/tree_small_02_leaves_diff_1k.jpg'
    files = ['tree_small_02.gltf', 'tree_small_02.bin', image,
             'textures/tree_small_02_leaves_alpha_1k.jpg']
    assert (folder / files[1]).stat().st_size == data['buffers'][0]['byteLength']
    return {'leaf_triangles': data['accessors'][primitive['indices']]['count'] // 3,
            'sha256': {name: hashlib.sha256((folder / name).read_bytes()).hexdigest()
                       for name in files}}


def tree_state(u, mesh):
    """Numeric transforms avoid Unreal repr strings' transient allocation addresses."""
    def transform(t):
        p, r, s = t.translation, t.rotation, t.scale3d
        return [p.x, p.y, p.z, r.x, r.y, r.z, r.w, s.x, s.y, s.z]
    result = {}
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    for actor in editor.get_all_level_actors():
        for comp in actor.get_components_by_class(u.StaticMeshComponent):
            if comp.static_mesh != mesh:
                continue
            state = {'collision': str(comp.get_collision_enabled()),
                     'profile': str(comp.get_collision_profile_name()),
                     'world': transform(comp.get_world_transform())}
            if isinstance(comp, u.InstancedStaticMeshComponent):
                state['instances'] = [transform(comp.get_instance_transform(i, True))
                                      for i in range(comp.get_instance_count())]
            result[comp.get_path_name()] = state
    assert result, 'No live mapped tree components use the expected tree mesh'
    return result


def geometry_state(u, mesh):
    """Hash the retained raw positions, rather than treating rounded render bounds as geometry."""
    description = mesh.get_static_mesh_description(0)
    assert description
    count = description.get_vertex_count()
    assert count > 0
    digest = hashlib.sha256()
    pack = struct.Struct('<3f').pack
    minimum, maximum = [float('inf')] * 3, [float('-inf')] * 3
    for index in range(count):
        vertex = u.VertexID(index)
        assert description.is_vertex_valid(vertex), 'Expected dense retained vertex IDs'
        p = description.get_vertex_position(vertex)
        values = (p.x, p.y, p.z)
        assert all(math.isfinite(value) for value in values), 'Non-finite raw tree position'
        digest.update(pack(*values))
        for axis, value in enumerate(values):
            minimum[axis] = min(minimum[axis], value)
            maximum[axis] = max(maximum[axis], value)
    return {'vertices': count, 'vertex_instances': description.get_vertex_instance_count(),
            'triangles': description.get_triangle_count(), 'polygons': description.get_polygon_count(),
            'position_sha256': digest.hexdigest(), 'minimum': minimum, 'maximum': maximum}


def verified_source_bounds(before, after, bounds):
    assert after == before, 'Retained raw tree geometry changed; see TreeGraphicsGeometry.json'
    minimum, maximum = after['minimum'], after['maximum']
    expected = [(a + b) / 2 for a, b in zip(minimum, maximum)] + [(b - a) / 2 for a, b in zip(minimum, maximum)]
    assert bounds == expected, 'Rebuilt bounds must exactly match raw source positions; see TreeGraphicsGeometry.json'
    return expected


def apply(u):
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'Stop PIE before refining tree assets'
    assert u.EditorLevelLibrary.get_editor_world().get_path_name() == '/Game/Maps/LaFontaine.LaFontaine'
    source = source_inventory()
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    mesh, mat = assets.load_asset(MESH), assets.load_asset(LEAF)
    alpha, diffuse = assets.load_asset(ALPHA), assets.load_asset(DIFFUSE)
    assert isinstance(mesh, u.StaticMesh) and isinstance(mat, u.Material)
    assert isinstance(alpha, u.Texture2D) and isinstance(diffuse, u.Texture2D)
    assert mat.get_editor_property('shading_model') == u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE
    before = tree_state(u, mesh)
    map_path = ROOT / 'Content/Maps/LaFontaine.umap'
    map_hash = hashlib.sha256(map_path.read_bytes()).hexdigest()
    body = mesh.get_editor_property('body_setup')
    collision = body.get_editor_property('collision_trace_flag')
    bounds = mesh.get_bounds()
    bounds_before = [bounds.origin.x, bounds.origin.y, bounds.origin.z,
                     bounds.box_extent.x, bounds.box_extent.y, bounds.box_extent.z]
    geometry_before = geometry_state(u, mesh)
    slots = list(mesh.get_editor_property('static_materials'))
    leaf_slots = [i for i, slot in enumerate(slots) if slot.material_interface == mat]
    assert len(leaf_slots) == 1, 'Expected the existing cutout foliage material in one slot'
    backup = ROOT / 'Saved/Recovery' / ('tree-graphics-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backups = {}
    for asset in (MESH, LEAF, ALPHA, '/Game/Art/Comic/M_ComicInk'):
        path = ROOT / 'Content' / (asset.removeprefix('/Game/') + '.uasset')
        assert path.exists(), path
        for suffix in ('.uasset', '.uexp', '.ubulk'):
            file = path.with_suffix(suffix)
            if not file.exists():
                continue
            relative = file.relative_to(ROOT)
            target = backup / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, target)
            digest = hashlib.sha256(file.read_bytes()).hexdigest()
            assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
            backups[str(relative)] = digest
    (backup / 'manifest.json').write_text(json.dumps(backups, indent=2) + '\n')

    alpha.set_editor_property('srgb', False)
    alpha.set_editor_property('compression_settings', u.TextureCompressionSettings.TC_MASKS)
    alpha.set_editor_property('do_scale_mips_for_alpha_coverage', True)
    alpha.set_editor_property('alpha_coverage_thresholds', u.Vector4(MASK_CLIP, 0, 0, 0))
    assert assets.save_loaded_asset(alpha)
    library.delete_all_material_expressions(mat)
    mat.set_editor_property('blend_mode', u.BlendMode.BLEND_MASKED)
    mat.set_editor_property('two_sided', True)
    mat.set_editor_property('opacity_mask_clip_value', MASK_CLIP)

    def node(cls, **properties):
        n = library.create_material_expression(mat, cls)
        for name, value in properties.items():
            n.set_editor_property(name, value)
        return n

    def link(a, output, b, name):
        assert library.connect_material_expressions(a, output, b, name), name

    def property(n, output, prop):
        assert library.connect_material_property(n, output, prop), prop

    texture = node(u.MaterialExpressionTextureSample, texture=diffuse,
                   sampler_type=u.MaterialSamplerType.SAMPLERTYPE_COLOR)
    desat = node(u.MaterialExpressionDesaturation)
    link(texture, 'RGB', desat, '')
    link(node(u.MaterialExpressionConstant, r=.35), '', desat, 'Fraction')
    random = node(u.MaterialExpressionPerInstanceRandom)
    tint = node(u.MaterialExpressionLinearInterpolate)
    link(node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(*GREEN_TINT, 1)), '', tint, 'A')
    link(node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(*GOLD_TINT, 1)), '', tint, 'B')
    link(random, '', tint, 'Alpha')
    color = node(u.MaterialExpressionMultiply)
    link(desat, '', color, 'A'); link(tint, '', color, 'B')
    lift = node(u.MaterialExpressionAdd)
    link(color, '', lift, 'A')
    link(node(u.MaterialExpressionConstant3Vector, constant=u.LinearColor(.025, .035, .008, 1)), '', lift, 'B')
    property(lift, '', u.MaterialProperty.MP_BASE_COLOR)
    transmission = node(u.MaterialExpressionMultiply, const_b=.65)
    link(lift, '', transmission, 'A')
    property(transmission, '', u.MaterialProperty.MP_SUBSURFACE_COLOR)
    mask = node(u.MaterialExpressionTextureSample, texture=alpha,
                sampler_type=u.MaterialSamplerType.SAMPLERTYPE_MASKS)
    assert mask.get_editor_property('sampler_type') == u.MaterialSamplerType.SAMPLERTYPE_MASKS
    property(mask, 'R', u.MaterialProperty.MP_OPACITY_MASK)
    for value, prop in ((.7, u.MaterialProperty.MP_ROUGHNESS),
                        (.18, u.MaterialProperty.MP_SPECULAR),
                        (.45, u.MaterialProperty.MP_OPACITY)):
        property(node(u.MaterialExpressionConstant, r=value), '', prop)
    for usage in (u.MaterialUsage.MATUSAGE_NANITE, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES):
        library.set_base_material_usage(mat, usage, True)
        assert library.has_material_usage(mat, usage)
    library.recompile_material(mat)
    assert assets.save_loaded_asset(mat)
    settings = mesh.get_editor_property('nanite_settings')
    settings.set_editor_property('enabled', True)
    settings.set_editor_property('shape_preservation', u.NaniteShapePreservation.PRESERVE_AREA)
    u.get_editor_subsystem(u.StaticMeshEditorSubsystem).set_nanite_settings(mesh, settings, True)
    assert assets.save_loaded_asset(mesh)

    assert mesh.get_editor_property('nanite_settings').get_editor_property('shape_preservation') == u.NaniteShapePreservation.PRESERVE_AREA
    assert mat.get_editor_property('blend_mode') == u.BlendMode.BLEND_MASKED
    assert mat.get_editor_property('two_sided')
    assert abs(mat.get_editor_property('opacity_mask_clip_value') - MASK_CLIP) < 1.e-6
    assert library.get_material_property_input_node(mat, u.MaterialProperty.MP_OPACITY_MASK) == mask
    assert mesh.get_editor_property('body_setup') == body and body.get_editor_property('collision_trace_flag') == collision
    bounds = mesh.get_bounds()
    bounds_after = [bounds.origin.x, bounds.origin.y, bounds.origin.z, bounds.box_extent.x,
                    bounds.box_extent.y, bounds.box_extent.z]
    geometry_after = geometry_state(u, mesh)
    diagnostic = {'geometry_before': geometry_before, 'geometry_after': geometry_after,
                  'bounds_before': bounds_before, 'bounds_after': bounds_after,
                  'bounds_delta': [b - a for a, b in zip(bounds_before, bounds_after)],
                  'bounds_representation': 'Nanite rebuild replaces quantized render bounds with cached raw mesh-description bounds (StaticMesh.cpp CalculateExtendedBounds).'}
    diagnostic_path = ROOT / 'Saved/Tests/TreeGraphicsGeometry.json'
    diagnostic_path.parent.mkdir(parents=True, exist_ok=True)
    diagnostic_path.write_text(json.dumps(diagnostic, indent=2) + '\n')
    # A rebuild refreshes rounded render bounds; validate the full raw geometry and its exact bounds.
    verified_source_bounds(geometry_before, geometry_after, bounds_after)
    assert [s.material_interface for s in mesh.get_editor_property('static_materials')] == [s.material_interface for s in slots]
    assert tree_state(u, mesh) == before, 'Tree transforms, component collision or inventory changed'
    assert source_inventory() == source, 'Licensed source tree geometry or cutout artwork changed'
    assert hashlib.sha256(map_path.read_bytes()).hexdigest() == map_hash, 'Tree appearance pass wrote the map'
    report = {'passed': True, 'rendered_acceptance_pending': True,
              'backup': str(backup.relative_to(ROOT)), 'source': source,
              'tree_components': len(before), 'mapped_instances': sum(len(row.get('instances', [])) for row in before.values()),
              'scene_tree_state_sha256': hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest(),
              'saved_map_sha256': map_hash,
              'source_geometry_transforms_collision_unchanged': True,
              'runtime_bounds_exactly_match_raw_source': True,
              'geometry_diagnostic': str(diagnostic_path.relative_to(ROOT)),
              'green_tint': GREEN_TINT, 'gold_tint': GOLD_TINT,
              'mask_clip': MASK_CLIP, 'nanite_shape_preservation': 'PreserveArea'}
    out = ROOT / 'Saved/Tests/TreeGraphicsApplied.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + '\n')
    u.log('NORD_TREE_GRAPHICS_APPLIED ' + json.dumps(report))
    return report


if __name__ == '__main__':
    import unreal
    apply(unreal)
