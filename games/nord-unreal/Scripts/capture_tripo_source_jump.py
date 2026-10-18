"""Run the unchanged corrected-Jump author on a fresh copy, then capture its scene.

The original author FBX/report remain retained. This adds a lossless CPU motion
transport when that intermediate FBX cannot preserve its source reference.
No geometry/bind/channel normalization, API, rendering or native operations.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

import bpy

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--body-sha256', required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--samples', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    folder = args.source_root.resolve()/args.name
    assert Path(args.name).name == args.name and args.name not in ('.', '..')
    assert folder.is_relative_to(ROOT/'Saved/Tests'), 'Author only a fresh ignored source copy'
    body, output = folder/'body.fbx', folder/'jump.fbx'
    assert digest(body) == args.body_sha256, 'Pinned original source body mismatch'
    assert not any(p.exists() for p in (output, folder/'jump.json', args.report, args.samples)), 'Never overwrite an authored result'
    author = ROOT/'Scripts/prepare_meshy_jump.py'
    author_sha = digest(author)
    original_argv = sys.argv
    try:
        sys.argv = [str(author), '--', '--source-root', str(args.source_root.resolve()),
            '--names', args.name, '--report', str(args.report.resolve())]
        namespace = runpy.run_path(str(author), run_name='__main__')
    finally:
        sys.argv = original_argv
    rig = namespace['armature']  # Original author rig, never the reimported FBX.
    assert rig != namespace['restored'] and len(rig.data.bones) == 24
    assert all(b.matrix_local == namespace['reference'][b.name] for b in rig.data.bones)
    assert rig.animation_data.action.frame_range[:] == (1., 37.)
    reference = {b.name: [list(row) for row in b.matrix_local] for b in rig.data.bones}
    parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
    object_matrix = rig.matrix_world.copy()
    bpy.context.scene.render.fps, bpy.context.scene.render.fps_base = 30, 1.
    samples = []
    max_scale = max_quaternion = raw_half_quaternion = 0.
    for index in range(73):
        value = 1+index/2
        bpy.context.scene.frame_set(math.floor(value), subframe=value-math.floor(value))
        bpy.context.view_layer.update()
        assert rig.matrix_world == object_matrix
        assert all(b.matrix_local == namespace['reference'][b.name] for b in rig.data.bones)
        pose, basis = {}, {}
        for b in rig.pose.bones:
            assert all(math.isfinite(v) for row in b.matrix for v in row)
            max_scale = max(max_scale, max(abs(v-1) for v in b.scale))
            max_quaternion = max(max_quaternion, abs(b.matrix.to_quaternion().magnitude-1))
            if index % 2 == 0:
                max_quaternion = max(max_quaternion, abs(b.rotation_quaternion.magnitude-1))
            else:
                raw_half_quaternion = max(raw_half_quaternion, abs(b.rotation_quaternion.magnitude-1))
            pose[b.name] = [list(row) for row in b.matrix]
            basis[b.name] = [list(row) for row in b.matrix_basis]
        samples.append({'frame': value, 'seconds': index/60, 'pose': pose, 'basis': basis})
    assert max_scale < 1e-5 and max_quaternion < 1e-4
    assert digest(body) == args.body_sha256 and digest(author) == author_sha
    result = {'passed': True, 'transport': 'Unchanged original author in-memory scene; intermediate FBX is not motion authority',
        'recipe_sha256': digest(Path(__file__)), 'author_recipe_sha256': author_sha,
        'body_sha256': args.body_sha256, 'original_author_report': {'path': str(args.report.resolve()), 'sha256': digest(args.report)},
        'retained_intermediate_fbx': {'path': str(output), 'sha256': digest(output),
            'strict_reference_acceptance': 'Not claimed here; caller independently gates and retains any failure'},
        'reference': reference, 'parents': parents, 'object_matrix': [list(row) for row in object_matrix],
        'range': [1, 37], 'fps': 30, 'seconds': 1.2, 'half_frame_samples': 73,
        'maximum_authored_scale_channel_error': max_scale, 'maximum_authored_quaternion_norm_error': max_quaternion,
        'raw_interpolated_half_channel_quaternion_norm_error_diagnostic': raw_half_quaternion,
        'samples': samples, 'source_bytes_bind_and_object_unchanged': True, 'normalization_applied': False}
    args.samples.parent.mkdir(parents=True, exist_ok=True)
    args.samples.write_text(json.dumps(result, indent=2)+'\n')
    print('TRIPO_ORIGINAL_SOURCE_JUMP_CAPTURE_PASS', args.samples, flush=True)


if __name__ == '__main__':
    main()
