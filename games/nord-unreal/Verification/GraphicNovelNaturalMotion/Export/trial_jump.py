"""Author original jump clips on the retained rigs; run Blender --background --python this_file.

CPU asset processing only. No rendering, service calls, or modification of source bodies/textures.
Neutral pilot: blender --background --factory-startup --python this_file --
              --source-root Data/CharactersNeutral --names CurlyMetalhead
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root', type=Path, default=Path('Data/CharactersMeshy'))
parser.add_argument('--names', nargs='+', help='Author only these character folders on their own retained body rigs.')
parser.add_argument('--report', type=Path, help='Optional isolated verification JSON path.')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
SOURCE = (ROOT / args.source_root).resolve()
assert SOURCE.is_dir(), SOURCE
if args.names:
    assert len(set(args.names)) == len(args.names) and all(Path(n).name == n and n not in ('.', '..') for n in args.names)
folders = [SOURCE / name for name in args.names] if args.names else sorted(SOURCE.iterdir())
# Seconds, hip drop in cm, thigh/knee/ankle/arm/elbow/spine pitch in degrees.
POSES = (
    (0.00, 0, 0, 0, 0, 0, 0, 0),
    (0.10, -10, -25, 55, -25, 30, 35, 12),
    (0.23, 0, -8, 16, -8, -95, 35, -5),
    (0.47, 0, -58, 100, -30, -110, 65, 10),
    (0.73, 0, -15, 25, -10, -55, 35, 4),
    (0.93, -11, -28, 60, -28, -25, 30, 15),
    (1.20, 0, 0, 0, 0, 0, 0, 0),
)


def interpolate(seconds):
    before, after = next((a, b) for a, b in zip(POSES, POSES[1:]) if a[0] <= seconds <= b[0])
    fraction = (seconds - before[0]) / (after[0] - before[0])
    smooth = fraction * fraction * (3 - 2 * fraction)
    return [a + (b - a) * smooth for a, b in zip(before[1:], after[1:])]


REVIEWED_NATURAL_KEYS = {'LeftArm': [(0, 0), (0.1, 15), (0.23, -15), (0.47, -20), (0.73, -10), (0.93, -15), (1.2, 0)], 'RightArm': [(0, 0), (0.1, 10), (0.23, 5), (0.47, -5), (0.73, 0), (0.93, -5), (1.2, 0)], 'LeftForeArm': [(0, 0), (0.1, -30), (0.23, -35), (0.47, -50), (0.73, -40), (0.93, -45), (1.2, 0)], 'RightForeArm': [(0, 0), (0.1, -25), (0.23, -25), (0.47, -35), (0.73, -25), (0.93, -30), (1.2, 0)], 'LeftUpLeg': [(0, 0), (0.1, -25), (0.23, -5), (0.47, -25), (0.73, -12), (0.93, -28), (1.2, 0)], 'RightUpLeg': [(0, 0), (0.1, -25), (0.23, -3), (0.47, -12), (0.73, -8), (0.93, -26), (1.2, 0)], 'LeftLeg': [(0, 0), (0.1, 55), (0.23, 12), (0.47, 55), (0.73, 28), (0.93, 60), (1.2, 0)], 'RightLeg': [(0, 0), (0.1, 55), (0.23, 8), (0.47, 35), (0.73, 23), (0.93, 56), (1.2, 0)], 'LeftFoot': [(0, 0), (0.1, -25), (0.23, -7), (0.47, -15), (0.73, -14), (0.93, -28), (1.2, 0)], 'RightFoot': [(0, 0), (0.1, -25), (0.23, -5), (0.47, -10), (0.73, -10), (0.93, -28), (1.2, 0)], 'Spine01': [(0, 0), (0.1, 12), (0.23, 4), (0.47, 6), (0.73, 8), (0.93, 12), (1.2, 0)], 'neck': [(0, 0), (0.1, -8), (0.23, -2.8), (0.47, -4.2), (0.73, -5.6), (0.93, -8.4), (1.2, 0)]}

def reviewed_natural_value(rows,t):
    a,b=next((a,b) for a,b in zip(rows,rows[1:]) if a[0]<=t<=b[0])
    f=(t-a[0])/(b[0]-a[0]); f=f*f*(3-2*f)
    return a[1]+(b[1]-a[1])*f

reports = []
for folder in folders:
    body = folder / "body.fbx"
    if not body.is_file():
        assert not args.names, body
        continue
    assert folder.resolve().parent == SOURCE and not body.is_symlink(), body
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(body), use_anim=False, automatic_bone_orientation=False)
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    bones = armature.pose.bones
    required = ("Hips", "Head", "neck", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg",
                "LeftFoot", "RightFoot", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "Spine01")
    assert all(name in bones for name in required), folder.name
    rest = {bone.name: bone.matrix_basis.copy() for bone in bones}
    reference = {bone.name: bone.bone.matrix_local.copy() for bone in bones}
    side = (bones["LeftUpLeg"].head - bones["RightUpLeg"].head).normalized()
    up = (bones["Head"].head - bones["Hips"].head).normalized()
    local_axes = {bone.name: (bone.bone.matrix_local.to_3x3().inverted() @ side).normalized() for bone in bones}
    hip_up = (bones["Hips"].bone.matrix_local.to_3x3().inverted() @ up).normalized()
    unit_scale = armature.matrix_world.to_scale().z
    assert 0.001 < unit_scale < 2, unit_scale
    armature.animation_data_clear()
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 37
    samples = []
    for frame in range(1, 38):
        seconds = (frame - 1) / 30
        drop_cm, thigh, knee, ankle, arm, elbow, spine = interpolate(seconds)
        angles = {"Spine01": spine}
        for prefix in ("Left", "Right"):
            angles.update({prefix + "UpLeg": thigh, prefix + "Leg": knee, prefix + "Foot": ankle,
                           prefix + "Arm": arm, prefix + "ForeArm": elbow})
        angles.update({name: reviewed_natural_value(rows, seconds) for name, rows in REVIEWED_NATURAL_KEYS.items()})
        bpy.context.scene.frame_set(frame)
        for bone in bones:
            bone.matrix_basis = rest[bone.name]
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = rest[bone.name].to_quaternion() @ Quaternion(local_axes[bone.name], math.radians(angles.get(bone.name, 0)))
            if bone.name == "Hips":
                bone.location += hip_up * (drop_cm / (100 * unit_scale))
            bone.keyframe_insert("rotation_quaternion", frame=frame)
            bone.keyframe_insert("location", frame=frame)
            bone.keyframe_insert("scale", frame=frame)
        bpy.context.view_layer.update()
        samples.append({"time": round(seconds, 6), "hip_drop_cm": round(drop_cm, 4),
                        "reviewed_local_degrees": {name: round(angles[name], 4) for name in REVIEWED_NATURAL_KEYS}, "thigh_degrees": round(angles["LeftUpLeg"], 4), "knee_degrees": round(angles["LeftLeg"], 4)})
        assert all(math.isfinite(value) for bone in bones for row in bone.matrix for value in row)
        assert all(abs(value) < 0.0001 for bone in bones for row in bone.bone.matrix_local - reference[bone.name] for value in row)
    assert samples[0]["hip_drop_cm"] == samples[-1]["hip_drop_cm"] == 0
    assert -30 < min(sample["thigh_degrees"] for sample in samples) < -20
    assert 55 < max(sample["knee_degrees"] for sample in samples) <= 61
    assert all(abs(value) < 0.0001 for name in ("Head",) for row in bones[name].matrix_basis - rest[name] for value in row)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.context.scene.frame_set(1)
    output = folder / "jump.fbx"
    # Explicit pre-export action audit: reviewed rotation authoring must leave authored scale curves fixed.
    scale_curves = []
    action = armature.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(armature.animation_data.action_slot, ensure=False)
            if bag:
                for curve in bag.fcurves:
                    if curve.data_path.endswith('.scale'):
                        points = [[float(key.co.x), float(key.co.y)] for key in curve.keyframe_points]
                        assert len(points) == 37 and all(value == points[0][1] for frame, value in points), 'Authored scale animation appeared'
                        scale_curves.append({'path': curve.data_path, 'axis': curve.array_index, 'points': points})
    scale_curves.sort(key=lambda row: (row['path'], row['axis']))
    assert len(scale_curves) == 24*3
    (folder / 'authored-scales.json').write_text(json.dumps(scale_curves, separators=(',', ':'))+'\n')
    bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True, object_types={"ARMATURE"},
                             add_leaf_bones=False, bake_anim=True, bake_anim_use_all_bones=True,
                             bake_anim_use_nla_strips=False, bake_anim_use_all_actions=False,
                             bake_anim_simplify_factor=0, axis_forward="-Z", axis_up="Y")
    assert output.stat().st_size > 10000, output
    # Round-trip the actual exported clip: unchanged hierarchy/rest pose, moving legs, neutral endpoints.
    rest_heads = {bone.name: armature.matrix_world @ bone.head_local for bone in armature.data.bones}
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(output), use_anim=True, automatic_bone_orientation=False)
    restored = next(obj for obj in bpy.data.objects if obj not in existing and obj.type == "ARMATURE")
    assert set(rest_heads) == set(restored.data.bones.keys())
    assert all((restored.matrix_world @ restored.data.bones[name].head_local - position).length < 0.0001
               for name, position in rest_heads.items())
    first_frame, last_frame = restored.animation_data.action.frame_range
    assert abs(last_frame - first_frame - 36) < 0.001
    bpy.context.scene.frame_set(int(first_frame))
    neutral_knee = restored.pose.bones["LeftLeg"].rotation_quaternion.copy()
    bpy.context.scene.frame_set(int(first_frame + 14))
    assert math.radians(50) < neutral_knee.rotation_difference(restored.pose.bones["LeftLeg"].rotation_quaternion).angle < math.radians(60)
    bpy.context.scene.frame_set(int(last_frame))
    assert neutral_knee.rotation_difference(restored.pose.bones["LeftLeg"].rotation_quaternion).angle < 0.001
    report = {"name": folder.name, "authoring": "original local skeletal keyframes; no paid generation",
              "body_sha256": hashlib.sha256(body.read_bytes()).hexdigest(),
              "jump_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
              "seconds": 1.2, "fps": 30, "bones": len(bones), "head_and_neck_unchanged": False, "head_unchanged": True, "neck_rotation_explicitly_changed": True,
              "actor_root_motion": False, "fbx_round_trip_passed": True, "samples": samples}
    (folder / "jump.json").write_text(json.dumps(report, indent=2) + "\n")
    reports.append({key: value for key, value in report.items() if key != "samples"})
assert len(reports) == (len(args.names) if args.names else 8), len(reports)
original = SOURCE == (ROOT / 'Data/CharactersMeshy').resolve()
report_path = ROOT / args.report if args.report else ROOT / 'Verification' / ('MeshyJumpSources.json' if original else SOURCE.name + 'JumpSources.json')
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps({"passed": True, "source_root": str(SOURCE.relative_to(ROOT)) if SOURCE.is_relative_to(ROOT) else str(SOURCE),
                                   "characters": reports}, indent=2) + "\n")
print("NORD_MESHY_JUMP_SOURCES_OK", len(reports))
