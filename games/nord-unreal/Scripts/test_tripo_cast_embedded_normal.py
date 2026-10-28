"""Actual Memphis JPEG normal fixture: preserve GLB-selected bytes and retain distinct external PNG."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess

import prepare_tripo_cast_surface as surface

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(); output = args.output.resolve()
assert not output.exists(); output.mkdir(parents=True)
base = ROOT/'Data/GraphicNovel/Crew/Memphis33'
paths = {'source_glb': base/'generated-v1-high-detail/body.glb', 'provider_fbx': base/'tripo-v3-rig-20261017/rig.fbx',
         'normal_png': base/'generated-v1-high-detail/normal.png'}
pins = {'source_glb': 'e3bb935c87891489a9c967eeb8e46d3af3156dd8469bcbb17fa0c78715fbf1a8',
        'provider_fbx': '0b6815c73efcf00f654330c905ecc8a49eafa5743825fe56e027d84db55186f4',
        'normal_png': 'c3d1f0b177853c995af9406e2d7da6c5f98264c9a07653dd5637f4dfa94742f0'}
assert {k: surface.digest(p) for k, p in paths.items()} == pins
protected = [p for p in paths['source_glb'].parent.rglob('*') if p.is_file() and '.fbm' not in str(p)]+[paths['provider_fbx']]
before = {str(p): surface.digest(p) for p in protected}
raw = paths['source_glb'].read_bytes(); json_size = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20+json_size]); binary_offset = 20+json_size+8
index = gltf['materials'][0]['normalTexture']['index']
image = gltf['images'][gltf['textures'][index]['source']]; view = gltf['bufferViews'][image['bufferView']]
payload = raw[binary_offset+view.get('byteOffset', 0):binary_offset+view.get('byteOffset', 0)+view['byteLength']]
embedded_sha = hashlib.sha256(payload).hexdigest()
assert image['mimeType'] == 'image/jpeg' and payload.startswith(b'\xff\xd8\xff') and len(payload) == 2782130
assert embedded_sha == '331cde6e456ae94b9ab4f3de6f4891d2ae627657c9ffc2162074a52d81573799' != pins['normal_png']
manifest = output/'manifest.json'
manifest.write_text(json.dumps({k: {'path': str(p.relative_to(ROOT)), 'sha256': pins[k]} for k, p in paths.items()}, indent=2)+'\n')
command = [shutil.which('blender') or 'blender', '-b', '-t', '4', '--python-exit-code', '1', '--python',
           str(ROOT/'Scripts/prepare_tripo_cast_surface.py'), '--', '--manifest', str(manifest),
           '--output', str(output/'body'), '--report', str(output/'report')]
with (output/'blender.log').open('w') as log:
    process = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=120)
assert process.returncode == 0, output/'blender.log'
result = json.loads((output/'report/Surface.json').read_text()); selected = result['normal_payload_selection']
assert result['passed'] and result['retained_inputs_unchanged'] and selected['texture_index'] == index
assert selected['mime_type'] == 'image/jpeg' and selected['sha256'] == embedded_sha
assert not selected['external_png_bytes_equal_embedded_payload'] and not selected['conversion_or_rebake_applied']
assert selected['external_provider_normal_png']['sha256'] == pins['normal_png']
assert Path(result['textures']['normal']['path']).suffix == '.jpg'
assert Path(result['textures']['normal']['path']).read_bytes() == payload
assert result['fresh_import_images']['normal']['sha256'] == embedded_sha != result['fresh_import_images']['base_color']['sha256']
assert result['textures']['normal']['colorspace'] == 'Non-Color' and result['material']['base_color_and_normal_distinct']
assert before == {p: surface.digest(Path(p)) for p in before}
receipt = {'passed': True, 'finished_utc': datetime.now(timezone.utc).isoformat(), 'command': command, 'process_exit_code': process.returncode,
           'recipe_sha256': surface.digest(Path(__file__)), 'surface_recipe_sha256': surface.digest(ROOT/'Scripts/prepare_tripo_cast_surface.py'),
           'surface_receipt': {'path': str(output/'report/Surface.json'), 'sha256': surface.digest(output/'report/Surface.json')},
           'normal_selection': selected, 'original_input_hashes_unchanged': before, 'no_conversion_rebake_api_gpu_native_service_operations': True}
(output/'Test.json').write_text(json.dumps(receipt, indent=2)+'\n')
print('TRIPO_CAST_EMBEDDED_NORMAL_PASS', output)
