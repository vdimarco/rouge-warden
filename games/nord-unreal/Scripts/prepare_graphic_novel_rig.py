"""Prepare the isolated local hero rig; run Blender --background --factory-startup --python this_file.

Use -- --inspect to render the source before authoring. No generation or Unreal calls.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Data/CharactersNeutral/CurlyMetalhead'
OUT = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/rigged'
OUT.mkdir(parents=True, exist_ok=True)
source_hashes = {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest()
                 for path in SOURCE.rglob('*') if path.is_file()}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE / 'body.fbx'), use_anim=False,
                         automatic_bone_orientation=False, use_image_search=False)
rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
mesh = max((obj for obj in bpy.context.scene.objects if obj.type == 'MESH'), key=lambda obj: len(obj.data.vertices))
original_bones = {bone.name: {'parent': bone.parent.name if bone.parent else None,
                             'matrix': [list(row) for row in bone.matrix_local]}
                  for bone in rig.data.bones}
assert len(original_bones) == 24, len(original_bones)
rest_vertices = [vertex.co.copy() for vertex in mesh.data.vertices]
world_vertices = [mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices]
print('NORD_RIG_SOURCE', len(rest_vertices), 'vertices;', len(original_bones), 'body bones')


def render(name, target, position, size, clay=False):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.render.resolution_x = scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.world = scene.world or bpy.data.worlds.new('RigInspectionWorld')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.12, .12, .12, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    camera = bpy.data.objects.new('RigInspectionCamera', bpy.data.cameras.new('RigInspectionCamera'))
    scene.collection.objects.link(camera)
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = size
    scene.camera = camera
    lights = []
    for location, power, width in (((-1, -2, 3), 150, 2), ((1, -.5, 1.5), 50, 1)):
        light = bpy.data.objects.new('RigInspectionLight', bpy.data.lights.new('RigInspectionLight', 'AREA'))
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (Vector(target) - light.location).to_track_quat('-Z', 'Y').to_euler()
        light.data.energy, light.data.shape, light.data.size = power, 'DISK', width
        lights.append(light)
    old_materials = list(mesh.data.materials)
    if clay:
        material = bpy.data.materials.new('InspectionClay')
        material.diffuse_color = (.42, .42, .42, 1)
        mesh.data.materials.clear()
        mesh.data.materials.append(material)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(OUT / (name + '.png'))
    bpy.ops.render.render(write_still=True)
    if clay:
        mesh.data.materials.clear()
        for material in old_materials:
            mesh.data.materials.append(material)
    for obj in [camera, *lights]:
        bpy.data.objects.remove(obj, do_unlink=True)


def protect_sources():
    after = {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest()
             for path in SOURCE.rglob('*') if path.is_file()}
    assert after == source_hashes, 'Original source folder changed'


if '--inspect' in sys.argv:
    for name, target, position, size in (
        ('source-face', (0, -.04, 1.66), (0, -1, 1.66), .36),
        ('source-face-clay', (0, -.04, 1.66), (0, -1, 1.66), .36),
        ('source-left-hand', (.475, .04, .92), (.475, -.6, .92), .25),
        ('source-left-hand-side', (.475, .04, .92), (.8, -.3, .92), .25),
        ('source-right-hand', (-.475, .04, .92), (-.475, -.6, .92), .25),
    ):
        render(name, target, position, size, clay='clay' in name or 'hand' in name)
    protect_sources()
    (OUT / 'source-audit.json').write_text(json.dumps({'source_hashes': source_hashes,
        'body_bones': original_bones, 'vertices': len(rest_vertices),
        'faces': len(mesh.data.polygons), 'source_unchanged': True}, indent=2) + '\n')
    print('NORD_RIG_INSPECTION_OK')
    sys.exit(0)

# These knuckles/tips were fitted to the retained front/side hand inspection images, in world metres.
# shortcut: coarse finger lobes support two segments each; rebuild topology before detailed hand acting.
landmarks = {
    'Pinky': ((.456, .908), (.474, .871), (.489, .838)),
    'Ring': ((.480, .912), (.500, .867), (.516, .828)),
    'Middle': ((.502, .922), (.527, .874), (.540, .831)),
    'Index': ((.523, .934), (.539, .889), (.550, .855)),
    'Thumb': ((.475, .980), (.515, .965), (.540, .960)),
}
hand_weights = {side: {vertex.index: next((group.weight for group in vertex.groups
                  if group.group == mesh.vertex_groups[side + 'Hand'].index), 0.)
                  for vertex in mesh.data.vertices} for side in ('Left', 'Right')}
paths = {}
for side, sign in (('Left', 1), ('Right', -1)):
    candidates = [world_vertices[index] for index, weight in hand_weights[side].items() if weight > .5]
    for finger, points in landmarks.items():
        path = []
        for x, z in points:
            nearby = sorted(candidates, key=lambda point: (point.x - sign * x) ** 2 + (point.z - z) ** 2)[:16]
            path.append(Vector((sign * x, sum(point.y for point in nearby) / len(nearby), z)))
        paths[side + '_' + finger] = path

bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
inverse_rig = rig.matrix_world.inverted()
for key, points in paths.items():
    parent = rig.data.edit_bones[key.split('_')[0] + 'Hand']
    for segment in range(2):
        bone = rig.data.edit_bones.new('GN_' + key + str(segment + 1))
        bone.head, bone.tail = inverse_rig @ points[segment], inverse_rig @ points[segment + 1]
        bone.parent = parent
        bone.use_connect = segment > 0
        parent = bone
bpy.ops.object.mode_set(mode='OBJECT')
for name, original in original_bones.items():
    bone = rig.data.bones[name]
    assert (bone.parent.name if bone.parent else None) == original['parent'], name
    assert max(abs(value) for row in bone.matrix_local - Matrix(original['matrix']) for value in row) < .0001, name

added_bones = [name for name in rig.data.bones.keys() if name not in original_bones]
assert len(added_bones) == 20
for name in added_bones:
    mesh.vertex_groups.new(name=name)


def closest_segment(point, start, end):
    direction = end - start
    position = max(0., min(1., (point - start).dot(direction) / direction.length_squared))
    return (point - (start + direction * position)).length, position


weighted_counts = {name: 0 for name in added_bones}
for side in ('Left', 'Right'):
    hand = mesh.vertex_groups[side + 'Hand']
    for index, weight in hand_weights[side].items():
        if weight < .4:
            continue
        point = world_vertices[index]
        options = []
        for key, path in paths.items():
            if not key.startswith(side + '_'):
                continue
            for segment in range(2):
                distance, fraction = closest_segment(point, path[segment], path[segment + 1])
                options.append((distance, (segment + fraction) / 2, key))
        distance, position, key = min(options)
        if distance > .024:
            continue
        influence = min(1., position * 5) * min(1., max(0., (.024 - distance) / .008))
        transferred = weight * influence
        if transferred < .001:
            continue
        hand.add([index], weight - transferred, 'REPLACE')
        distal = max(0., min(1., (position - .25) * 2))
        for segment, fraction in ((1, 1 - distal), (2, distal)):
            if fraction > 0:
                name = 'GN_' + key + str(segment)
                mesh.vertex_groups[name].add([index], transferred * fraction, 'REPLACE')
                weighted_counts[name] += 1
assert min(weighted_counts.values()) > 10, weighted_counts
for vertex in mesh.data.vertices:
    weights = [group.weight for group in vertex.groups if mesh.vertex_groups[group.group].name in rig.data.bones]
    assert all(math.isfinite(weight) and weight >= 0 for weight in weights)
    assert abs(sum(weights) - 1) < .002, (vertex.index, sum(weights))

mesh.shape_key_add(name='Basis')
inverse_mesh = mesh.matrix_world.inverted()
morph_vertices = {}
for side, x in (('L', .034), ('R', -.031)):
    # shortcut: painted eyes lack separate lids; narrow only, until the face is locally retopologized.
    key = mesh.shape_key_add(name='GN_EyeNarrow_' + side)
    changed = 0
    for index, point in enumerate(world_vertices):
        dx, dz = abs(point.x - x), point.z - 1.684
        if point.y > -.067 or dx > .023 or abs(dz) > .009:
            continue
        width = min(1., max(0., (.023 - dx) / .010))
        height = min(1., max(0., (.009 - abs(dz)) / .005))
        influence = width * height
        if influence > .01:
            moved = point.copy()
            moved.z -= dz * .35 * influence
            key.data[index].co = inverse_mesh @ moved
            changed += 1
    assert changed > 10, (key.name, changed)
    morph_vertices[key.name] = changed

assert all((vertex.co - original).length < .00001 for vertex, original in zip(mesh.data.vertices, rest_vertices))
assert all((vertex.co - original).length < .00001 for vertex, original in zip(mesh.data.shape_keys.key_blocks['Basis'].data, rest_vertices))
for key in mesh.data.shape_keys.key_blocks:
    assert all(math.isfinite(value) for vertex in key.data for value in vertex.co), key.name

render('pilot-face-open', (0, -.04, 1.66), (0, -1, 1.66), .36)
for name in morph_vertices:
    mesh.data.shape_keys.key_blocks[name].value = 1.
render('pilot-face-narrow', (0, -.04, 1.66), (0, -1, 1.66), .36)
for name in morph_vertices:
    mesh.data.shape_keys.key_blocks[name].value = 0.
render('pilot-hand-rest', (.475, .04, .92), (.475, -.6, .92), .25, clay=True)
rest_evaluated = [mesh.matrix_world @ vertex.co for vertex in mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices]
for key, points in paths.items():
    for segment in range(2):
        bone = rig.pose.bones['GN_' + key + str(segment + 1)]
        direction = (points[segment + 1] - points[segment]).normalized()
        axis = direction.cross(Vector((0, -1, 0))).normalized()
        local_axis = (rig.matrix_world @ bone.bone.matrix_local).to_3x3().inverted() @ axis
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Quaternion(local_axis.normalized(), math.radians(18))
bpy.context.view_layer.update()
flex_evaluated = [mesh.matrix_world @ vertex.co for vertex in mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices]
finger_displacements = [(after - before).length for before, after in zip(rest_evaluated, flex_evaluated)]
assert sum(distance > .001 for distance in finger_displacements) > 100
assert .01 < max(finger_displacements) < .10, max(finger_displacements)
render('pilot-hand-flex', (.475, .04, .92), (.475, -.6, .92), .25, clay=True)
render('pilot-hand-flex-side', (.475, .04, .92), (.8, -.3, .92), .25, clay=True)
for name in added_bones:
    rig.pose.bones[name].matrix_basis.identity()
bpy.context.view_layer.update()

bpy.ops.object.select_all(action='DESELECT')
for obj in (rig, mesh):
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'pilot.blend'))
bpy.ops.export_scene.fbx(filepath=str(OUT / 'body.fbx'), use_selection=True, object_types={'ARMATURE', 'MESH'},
    add_leaf_bones=False, bake_anim=False, use_mesh_modifiers=False, axis_forward='-Z', axis_up='Y')
bpy.ops.export_scene.gltf(filepath=str(OUT / 'body.glb'), export_format='GLB', use_selection=True,
    export_animations=False, export_skins=True, export_morph=True)
existing = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(OUT / 'body.fbx'), use_anim=False, automatic_bone_orientation=False,
    use_image_search=False)
restored = next(obj for obj in bpy.data.objects if obj not in existing and obj.type == 'ARMATURE')
restored_mesh = next(obj for obj in bpy.data.objects if obj not in existing and obj.type == 'MESH')
assert set(restored.data.bones.keys()) == set(rig.data.bones.keys())
for name, original in original_bones.items():
    bone = restored.data.bones[name]
    assert (bone.parent.name if bone.parent else None) == original['parent'], name
    assert max(abs(value) for row in bone.matrix_local - Matrix(original['matrix']) for value in row) < .0002, name
assert set(morph_vertices) <= set(restored_mesh.data.shape_keys.key_blocks.keys())
assert len(restored_mesh.data.vertices) == len(rest_vertices)
round_trip_error = max((restored_mesh.matrix_world @ vertex.co - original).length
                       for vertex, original in zip(restored_mesh.data.vertices, world_vertices))
assert round_trip_error < .00001, round_trip_error
for vertex in restored_mesh.data.vertices:
    weights = [group.weight for group in vertex.groups if restored_mesh.vertex_groups[group.group].name in restored.data.bones]
    assert all(math.isfinite(weight) and weight >= 0 for weight in weights)
    assert abs(sum(weights) - 1) < .002, (vertex.index, sum(weights))
protect_sources()
report = {'passed': True, 'authoring': 'local derived finger weights/bones and eyelid morphs; no paid generation',
    'source_hashes': source_hashes, 'original_body_bones': original_bones, 'body_binds_unchanged': True,
    'rest_geometry_unchanged': True, 'added_bones': added_bones, 'weighted_vertices': weighted_counts,
    'morph_vertices': morph_vertices, 'fbx_round_trip_passed': True,
    'fbx_rest_geometry_max_error_m': round_trip_error,
    'finger_flex_displacement_m': {'maximum': max(finger_displacements), 'vertices_over_1mm': sum(distance > .001 for distance in finger_displacements)},
    'limits': 'coarse two-segment fingers; restrained eye narrowing only; rejected full blink retained; no jaw, eyeballs or speech; new bones/morphs need runtime driving',
    'outputs': {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in ('body.fbx', 'body.glb', 'pilot.blend')}}
(OUT / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n')
print('NORD_GRAPHIC_NOVEL_RIG_OK', json.dumps({'added_bones': len(added_bones), 'morphs': morph_vertices}))
