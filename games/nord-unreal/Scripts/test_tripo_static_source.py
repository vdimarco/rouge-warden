"""Actual unrigged Tripo BlackCap source contract; Blender -b -t4 --python this_file -- --output NEW_DIR.

No target rig is supplied, imported or accepted. A tiny FBX-shaped parser fixture
exercises only manifest path/SHA guards, never model or skin validation.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import struct
import sys

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
import prepare_tripo_cast_surface as surface

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
output = args.output.resolve(); assert not output.exists() and bpy.app.background and bpy.context.scene.render.threads == 4
source = ROOT/'Data/GraphicNovel/Crew/BlackCap/tripo-h31-body-20261017/body.glb'
expected = 'ff4d393b98d5fba212295305b714ab7fce04229e34b14196c7e2f4c210467d70'
assert surface.digest(source) == expected
output.mkdir(parents=True); copied = output/'body.glb'; shutil.copyfile(source, copied)
rig, mesh = surface.load_mesh(copied, allow_static=True)
snapshot = surface.snapshot_mesh(rig, mesh)
assert rig is None and snapshot['bones'] == [] and snapshot['weights'] is None
assert snapshot['bind'] == snapshot['parents'] == {} and snapshot['rig_matrix'] is None
assert len(mesh.data.vertices) == 53249 and len(snapshot['keys']) == 96140
assert len(np.unique(snapshot['keys'])) == 96140 and len(mesh.data.uv_layers) == 1
assert abs(snapshot['height']-.9794251918792725) < 1e-7
raw = copied.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]; gltf = json.loads(raw[20:20+size])
assert not gltf.get('skins') and not gltf.get('animations') and len(gltf['materials']) == 1
material = gltf['materials'][0]; normal_index = material['normalTexture']['index']; assert normal_index == 2
normal_image = gltf['images'][gltf['textures'][normal_index]['source']]
view = gltf['bufferViews'][normal_image['bufferView']]; start = 20+size+8+view.get('byteOffset', 0)
payload = raw[start:start+view['byteLength']]
from hashlib import sha256
normal_sha = sha256(payload).hexdigest()
assert normal_image['mimeType'] == 'image/png' and normal_sha == '193be451678e0f69245b33436d692377ad680c9a51601d4d7ad5c746e7292609'
shader = next(n for n in mesh.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
normal_map = shader.inputs['Normal'].links[0].from_node; assert normal_map.type == 'NORMAL_MAP'
normal = normal_map.inputs['Color'].links[0].from_node
base = shader.inputs['Base Color'].links[0].from_node
assert normal.image != base.image and bytes(normal.image.packed_file.data) == payload
assert normal.image.colorspace_settings.name == 'Non-Color' and base.image.colorspace_settings.name == 'sRGB'
assert list(normal.image.size) == [4096, 4096]
matrix_world = [list(row) for row in mesh.matrix_world]
unexpected = mesh.vertex_groups.new(name='UnexplainedStaticSkin')
try:
    surface.snapshot_mesh(None, mesh)
except AssertionError:
    pass
else:
    raise AssertionError('Static source accepted unexplained skin groups')
mesh.vertex_groups.remove(unexpected)
mesh.animation_data_create()
try:
    surface.snapshot_mesh(None, mesh)
except AssertionError:
    pass
else:
    raise AssertionError('Static source accepted animation data')
try:
    surface.load_mesh(copied)  # Strict target mode must reject the actual zero-bone source.
except AssertionError:
    pass
else:
    raise AssertionError('Unrigged source was accepted as a target rig')

# Parser fixtures have no model contract; only actual source geometry above is accepted.
fixture = output/'parser-only'; (fixture/'Data').mkdir(parents=True)
shutil.copyfile(copied, fixture/'Data/source.glb')
fake = fixture/'Data/parser-fixture.fbx'; fake.write_bytes(b'Parser fixture only; no model or rig contract')
manifest = fixture/'manifest.json'
document = {'source_glb': {'path': 'Data/source.glb', 'sha256': expected},
            'provider_fbx': {'path': 'Data/parser-fixture.fbx', 'sha256': surface.digest(fake)}}
manifest.write_text(json.dumps(document)+'\n')
old_root = surface.ROOT; surface.ROOT = fixture
try:
    paths, _ = surface.source_plan(manifest, fixture/'new-output', fixture/'new-report')
    assert set(paths) == {'source_glb', 'provider_fbx'} and not (fixture/'new-output').exists()
    document['provider_fbx']['sha256'] = '0'*64; manifest.write_text(json.dumps(document)+'\n')
    try:
        surface.source_plan(manifest, fixture/'new-output', fixture/'new-report')
    except AssertionError:
        pass
    else:
        raise AssertionError('Tampered parser SHA accepted')
    assert not (fixture/'new-output').exists() and not (fixture/'new-report').exists()
finally:
    surface.ROOT = old_root
assert surface.digest(source) == expected == surface.digest(copied)
result = {'passed': True, 'finished_utc': datetime.now(timezone.utc).isoformat(), 'source': {'path': str(source.relative_to(ROOT)), 'sha256': expected},
          'recipe_sha256': surface.digest(Path(__file__)), 'surface_recipe_sha256': surface.digest(ROOT/'Scripts/prepare_tripo_cast_surface.py'),
          'static_source_contract': {'bones': 0, 'skins': 0, 'animations': 0, 'mesh_count': 1, 'material_count': 1,
              'vertices': 53249, 'triangles': 96140, 'uv_layers': 1, 'unique_uv_triangle_keys': 96140,
              'height_m': snapshot['height'], 'mesh_matrix_world': matrix_world, 'normal_sha256': normal_sha,
              'normal_texture_index': 2, 'normal_colorspace': 'Non-Color', 'normal_size': [4096, 4096], 'external_normal_receipt_available': False},
          'negative_controls': ['Unexpected skin groups on static source rejected', 'Animation data on static source rejected',
                                'Zero-bone source rejected in strict target mode', 'Tampered SHA rejected before outputs'],
          'optional_external_normal_manifest_parser_only': True, 'target_rig_supplied_or_accepted': False,
          'source_hash_unchanged': True, 'rendered': False, 'no_api_native_gpu_service_operations': True}
(output/'Test.json').write_text(json.dumps(result, indent=2)+'\n')
print('TRIPO_STATIC_SOURCE_CONTRACT_PASS', output)
