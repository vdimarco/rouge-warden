"""Run with Blender --background --python this_file to prepare the CC0 residents."""
import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'Prepared'
OUTPUT.mkdir(exist_ok=True)
manifest = []
for source in sorted((ROOT / 'Source').glob('*.glb')):
    name = source.stem
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    parts = [o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == rig]
    assert len(parts) == 4, 'Expected the original four clothed body parts'
    actions = {a.name.rsplit('|', 1)[-1]: a for a in bpy.data.actions}
    assert {'Idle_Neutral', 'Walk'} <= actions.keys()
    rig.animation_data_clear()
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = 'SK_' + name
    points = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
    height = max(p.z for p in points) - min(p.z for p in points)
    assert 1.5 < height < 2.1, (source.name, height)
    materials = []
    for slot in mesh.material_slots:
        mat = slot.material
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        materials.append({'slot': mat.name, 'color': list(bsdf.inputs['Base Color'].default_value[:3])})
    rig.name = 'ResidentRig'
    rig.select_set(True)
    export = dict(use_selection=True, axis_forward='-Y', axis_up='Z',
                  apply_unit_scale=True, add_leaf_bones=False,
                  use_armature_deform_only=False, use_mesh_modifiers=True,
                  bake_anim_use_nla_strips=False, bake_anim_use_all_actions=False,
                  bake_anim_simplify_factor=0.0)
    mesh_path = OUTPUT / ('SK_' + name + '.fbx')
    bpy.ops.export_scene.fbx(filepath=str(mesh_path), object_types={'MESH', 'ARMATURE'}, bake_anim=False, **export)
    animations = {}
    rig.data.pose_position = 'POSE'
    mesh.select_set(False)
    for label, original in [('Idle', 'Idle_Neutral'), ('Walk', 'Walk')]:
        action = actions[original]
        rig.animation_data_create()
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        bpy.context.scene.frame_start = int(action.frame_range[0])
        bpy.context.scene.frame_end = int(action.frame_range[1])
        bpy.context.scene.frame_set(bpy.context.scene.frame_start)
        path = OUTPUT / ('A_' + name + '_' + label + '.fbx')
        bpy.ops.export_scene.fbx(filepath=str(path), object_types={'ARMATURE'}, bake_anim=True, **export)
        animations[label] = {'file': path.name, 'duration': (action.frame_range[1] - action.frame_range[0]) / bpy.context.scene.render.fps}
    manifest.append({'name': name, 'mesh': mesh_path.name, 'height_metres': height,
                     'bones': len(rig.data.bones), 'triangles': sum(len(p.vertices) - 2 for p in mesh.data.polygons),
                     'materials': materials, 'animations': animations})
    assert all((OUTPUT / v['file']).stat().st_size > 10000 for v in animations.values())
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('PLATEAU_CIVILIANS_PREPARED', len(manifest), 'clothed residents with original neutral idle and walk animations')
