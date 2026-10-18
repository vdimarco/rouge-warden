"""Replay a pinned original-author Jump capture on its freshly imported source.

Blender -b -t 4 --python-exit-code 1 --python this_file -- --motion-report JSON --report NEW_DIR
Checks all73 half poses and actual SHA/overwrite rejection before authoring.
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_tripo_cast_surface as surface


def qerror(a, b):
    q = a.normalized().rotation_difference(b.normalized())
    return 2*math.atan2(Vector((q.x, q.y, q.z)).length, abs(q.w))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--motion-report', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report = args.report.resolve()
    assert not report.exists() and bpy.app.background and bpy.context.scene.render.threads == 4
    report.mkdir(parents=True)
    shutil.copyfile(Path(__file__), report/Path(__file__).name)
    motion = json.loads(args.motion_report.read_text())
    assert motion['passed']
    captured_pin = motion['corrected_source_jump']['original_scene_samples']
    captured_path = Path(captured_pin['path'])
    assert surface.digest(captured_path) == captured_pin['sha256']
    captured = json.loads(captured_path.read_text())
    source_pin = motion['inputs']['source_body_fbx']
    source = surface.ROOT/source_pin['path']
    assert surface.digest(source) == source_pin['sha256'] == captured['body_sha256']
    rig, _ = surface.load_mesh(source)
    rig.data.pose_position = 'POSE'
    assert captured['half_frame_samples'] == len(captured['samples']) == 73
    assert {b.name: b.parent.name if b.parent else None for b in rig.data.bones} == captured['parents']
    assert all(float(v) == w for row, saved in zip(rig.matrix_world, captured['object_matrix']) for v, w in zip(row, saved))
    assert all(float(v) == w for b in rig.data.bones for row, saved in zip(b.matrix_local, captured['reference'][b.name]) for v, w in zip(row, saved))
    maximum_head = maximum_angle = maximum_scale = 0.
    for index, sample in enumerate(captured['samples']):
        assert sample['frame'] == 1+index/2 and abs(sample['seconds']-index/60) < 1e-12
        for b in rig.pose.bones:
            b.rotation_mode = 'QUATERNION'
            b.matrix_basis = Matrix(sample['basis'][b.name])
        bpy.context.view_layer.update()
        for b in rig.pose.bones:
            wanted = Matrix(sample['pose'][b.name])
            maximum_head = max(maximum_head, (rig.matrix_world @ b.matrix.translation-rig.matrix_world @ wanted.translation).length)
            maximum_angle = max(maximum_angle, qerror(b.matrix.to_quaternion(), wanted.to_quaternion()))
            maximum_scale = max(maximum_scale, max(abs(v-1) for v in b.scale))
    assert maximum_head < 1e-5 and maximum_angle < 1e-4 and maximum_scale < 1e-5
    # A real authored scale deformation is still rejected by the source scale gate.
    rig.pose.bones['LeftLeg'].scale.x += 20e-6
    bpy.context.view_layer.update()
    inserted = max(abs(v-1) for v in rig.pose.bones['LeftLeg'].scale)
    assert inserted > 1e-5
    commands = []
    original_command = motion['corrected_source_jump']['command']
    for label in ('wrong source SHA', 'overwrite existing capture'):
        command = original_command.copy()
        if label.startswith('wrong'):
            command[command.index('--body-sha256')+1] = '0'*64
        with (report/(label.replace(' ', '-')+'.log')).open('w') as log:
            process = subprocess.run(command, cwd=surface.ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=20)
        assert process.returncode != 0
        commands.append({'negative': label, 'exit_code': process.returncode})
    assert surface.digest(source) == source_pin['sha256'] and surface.digest(captured_path) == captured_pin['sha256']
    result = {'passed': True, 'threads': 4, 'rendered': False,
        'recipe_sha256': surface.digest(Path(__file__)), 'motion_report_sha256': surface.digest(args.motion_report),
        'source_capture': captured_pin, 'fresh_source_half_pose_samples': 73,
        'exact_source_bind_object_hierarchy': True, 'maximum_replayed_head_error_world_m': maximum_head,
        'maximum_replayed_rotation_error_rad': maximum_angle, 'maximum_source_local_scale_error': maximum_scale,
        'actual20ppm_scale_insertion_rejected': inserted, 'negative_controls': commands,
        'inputs_unchanged': True, 'art_native_acceptance': False}
    (report/'JumpCapture.json').write_text(json.dumps(result, indent=2)+'\n')
    print('TRIPO_JUMP_CAPTURE_REPLAY_PASS73 exactsource_reference wrongSHA_overwrite_real20ppm_negatives')


if __name__ == '__main__':
    main()
