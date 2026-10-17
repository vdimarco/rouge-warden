"""Independent fresh-FBX material boundary check; no export/render or source writes."""
from pathlib import Path
import hashlib
import json
from datetime import datetime, timezone
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
report = json.loads((HERE / 'Surface.json').read_text())
fbx = ROOT / report['output']['path']
assert hashlib.sha256(fbx.read_bytes()).hexdigest() == report['output']['sha256']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(fbx), use_anim=False,
                           automatic_bone_orientation=False, use_image_search=False)
rigs = [ob for ob in bpy.data.objects if ob.type == 'ARMATURE']
assert len(rigs) == 1 and len(rigs[0].data.bones) == 61
mesh = next(ob for ob in bpy.data.objects if ob.type == 'MESH' and ob.find_armature() == rigs[0])
material = mesh.data.materials[0]
shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
base = shader.inputs['Base Color'].links[0].from_node
normal_map = shader.inputs['Normal'].links[0].from_node
assert base.type == 'TEX_IMAGE' and normal_map.type == 'NORMAL_MAP'
normal = normal_map.inputs['Color'].links[0].from_node
assert normal.type == 'TEX_IMAGE' and base.image != normal.image
images = {}
for role, node in [('base_color', base), ('normal', normal)]:
    path = Path(bpy.path.abspath(node.image.filepath)).resolve()
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    assert sha == report['textures'][role]['sha256']
    images[role] = {'sha256': sha, 'path': str(path.relative_to(ROOT)),
                    'colorspace': node.image.colorspace_settings.name}
assert images['base_color']['colorspace'] == 'sRGB'
assert images['normal']['colorspace'] == 'Non-Color'
packed = ROOT / report['textures']['metallic_roughness']['path']
assert hashlib.sha256(packed.read_bytes()).hexdigest() == report['textures']['metallic_roughness']['sha256']
inputs_unchanged = all(hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha
                       for path, sha in report['inputs'].items())
assert inputs_unchanged
receipt = {'passed': True, 'created_utc': datetime.now(timezone.utc).isoformat(),
    'scope': 'Independent fresh FBX material wiring/image bytes and 61-bone boundary; CPU only',
    'images': images, 'base_color_normal_images_distinct': True,
    'original_tangent_normal_payload_unchanged': True, 'pinned_inputs_unchanged': inputs_unchanged,
    'packed_MR_sha256': report['textures']['metallic_roughness']['sha256'],
    'packed_MR_requires_explicit_native_G_roughness_B_metallic': True,
    'recipe_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(HERE / 'MaterialVerification.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('TRIPO_SURFACE_MATERIAL_PASS')
