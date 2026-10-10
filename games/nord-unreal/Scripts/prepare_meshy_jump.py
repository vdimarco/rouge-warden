"""Author original jump clips on the retained rigs; run Blender --background --python this_file.

CPU asset processing only. No rendering, service calls, or modification of source bodies/textures.
"""
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Data/CharactersMeshy"
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


reports = []
for folder in sorted(SOURCE.iterdir()):
    body = folder / "body.fbx"
    if not body.is_file():
        continue
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
                        "thigh_degrees": round(thigh, 4), "knee_degrees": round(knee, 4)})
        assert all(math.isfinite(value) for bone in bones for row in bone.matrix for value in row)
        assert all(abs(value) < 0.0001 for bone in bones for row in bone.bone.matrix_local - reference[bone.name] for value in row)
    assert samples[0]["hip_drop_cm"] == samples[-1]["hip_drop_cm"] == 0
    assert min(sample["thigh_degrees"] for sample in samples) < -55
    assert max(sample["knee_degrees"] for sample in samples) > 95
    assert all(abs(value) < 0.0001 for name in ("Head", "neck") for row in bones[name].matrix_basis - rest[name] for value in row)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.context.scene.frame_set(1)
    output = folder / "jump.fbx"
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
    assert neutral_knee.rotation_difference(restored.pose.bones["LeftLeg"].rotation_quaternion).angle > math.radians(70)
    bpy.context.scene.frame_set(int(last_frame))
    assert neutral_knee.rotation_difference(restored.pose.bones["LeftLeg"].rotation_quaternion).angle < 0.001
    report = {"name": folder.name, "authoring": "original local skeletal keyframes; no paid generation",
              "body_sha256": hashlib.sha256(body.read_bytes()).hexdigest(),
              "jump_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
              "seconds": 1.2, "fps": 30, "bones": len(bones), "head_and_neck_unchanged": True,
              "actor_root_motion": False, "fbx_round_trip_passed": True, "samples": samples}
    (folder / "jump.json").write_text(json.dumps(report, indent=2) + "\n")
    reports.append({key: value for key, value in report.items() if key != "samples"})
assert len(reports) == 8, len(reports)
(ROOT / "Verification/MeshyJumpSources.json").write_text(json.dumps({"passed": True, "characters": reports}, indent=2) + "\n")
print("NORD_MESHY_JUMP_SOURCES_OK", len(reports))
