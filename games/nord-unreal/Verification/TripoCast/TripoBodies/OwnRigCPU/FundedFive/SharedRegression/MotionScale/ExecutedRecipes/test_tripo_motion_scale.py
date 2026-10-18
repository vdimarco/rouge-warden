"""CPU local-scale semantics and optional pinned actual clips; no exports or edits.

Blender -b -t 4 --python-exit-code 1 --python this_file -- --report NEW_DIR
  [--clips JSON array of {path,sha256}]
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_tripo_cast_motion as motion


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--clips', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report = args.report.resolve()
    assert not report.exists() and bpy.app.background and bpy.context.scene.render.threads == 4
    report.mkdir(parents=True)
    for name in ('prepare_tripo_cast_motion.py', Path(__file__).name):
        shutil.copyfile(motion.ROOT/'Scripts'/name, report/name)
    bind = Matrix.Diagonal((1.00003, 1., 1.000001, 1.))
    rotation = Matrix.Rotation(.8, 4, 'Y')
    rigid = bind @ rotation
    raw_column_error = max(abs(a-b) for a, b in zip(rigid.to_scale(), bind.to_scale()))
    assert raw_column_error > 1e-5 and motion.dynamic_local_scale_error(rigid, bind) < 1e-6
    controls = []
    for delta, accepted in ((9e-6, True), (11e-6, False), (20e-6, False), (-20e-6, False)):
        measured = motion.dynamic_local_scale_error(rigid @ Matrix.Diagonal((1+delta, 1., 1., 1.)), bind)
        assert (measured < 1e-5) == accepted
        controls.append({'scale_delta': delta, 'measured': measured, 'accepted': accepted})
    actual = []
    for row in json.loads(args.clips.read_text()) if args.clips else []:
        path = Path(row['path']).resolve()
        assert motion.digest(path) == row['sha256']
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.threads_mode, bpy.context.scene.render.threads = 'FIXED', 4
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True, automatic_bone_orientation=False, use_image_search=False)
        bpy.context.scene.render.fps, bpy.context.scene.render.fps_base = 30, 1.
        rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
        assert len(rig.data.bones) == 61
        local_bind = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy() for b in rig.data.bones}
        first, last = rig.animation_data.action.frame_range
        maximum = column_max = channels_max = 0.
        worst = None
        for index in range(round((last-first)*2)+1):
            value = first+index/2
            bpy.context.scene.frame_set(math.floor(value), subframe=value-math.floor(value))
            bpy.context.view_layer.update()
            for b in rig.pose.bones:
                local = b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix.copy()
                measured = motion.dynamic_local_scale_error(local, local_bind[b.name])
                if measured > maximum:
                    maximum, worst = measured, (b.name, value)
                channels_max = max(channels_max, max(abs(v-1) for v in b.scale))
                column_max = max(column_max, max(abs(a-c) for a, c in zip(local.to_scale(), local_bind[b.name].to_scale())))
        assert maximum < 1e-5 and channels_max < 1e-5
        name, value = worst
        bpy.context.scene.frame_set(math.floor(value), subframe=value-math.floor(value))
        bpy.context.view_layer.update()
        b = rig.pose.bones[name]
        original = b.scale.copy()
        b.scale.x += 20e-6
        bpy.context.view_layer.update()
        local = b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix.copy()
        negative = motion.dynamic_local_scale_error(local, local_bind[name])
        assert negative > 1e-5
        b.scale = original
        bpy.context.view_layer.update()
        assert motion.digest(path) == row['sha256']
        actual.append({'input': row, 'samples': round((last-first)*2)+1,
            'maximum_animation_basis_scale_error': maximum, 'maximum_direct_channel_scale_error': channels_max,
            'raw_column_scale_error_vs_fresh_bind': column_max, 'worst_sample': {'bone': name, 'frame': value},
            'actual20ppm_scale_insertion_error': negative, 'actual20ppm_insertion_rejected': True})
    result = {'passed': True, 'threads': 4, 'rendered': False, 'scale_limit_unchanged': 1e-5,
        'recipe_sha256': motion.digest(Path(__file__)), 'motion_recipe_sha256': motion.digest(motion.ROOT/'Scripts/prepare_tripo_cast_motion.py'),
        'synthetic_rigid_raw_column_scale_error': raw_column_error, 'synthetic_controls': controls,
        'actual_clips': actual, 'inputs_unchanged': True, 'art_native_acceptance': False}
    (report/'MotionScale.json').write_text(json.dumps(result, indent=2)+'\n')
    print('TRIPO_MOTION_SCALE_PASS', len(actual), 'actual clips, unchanged1e-5 gate, actual/synthetic20ppm negatives')


if __name__ == '__main__':
    main()
