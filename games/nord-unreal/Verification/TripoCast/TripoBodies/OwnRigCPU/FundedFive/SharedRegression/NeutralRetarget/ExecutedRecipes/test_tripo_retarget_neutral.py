"""CPU exact-neutral and nonzero mapped/unmapped own-rig controls; no exports.

Blender -b -t 4 --python-exit-code 1 --python this_file -- --rigs PINNED_JSON --report NEW_DIR
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_tripo_cast_motion as motion
import prepare_tripo_cast_surface as surface


def angle(a, b):
    q = a.normalized().rotation_difference(b.normalized())
    return 2*math.atan2(Vector((q.x, q.y, q.z)).length, abs(q.w))


def skin(ob):
    evaluated = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    result = np.array([tuple(evaluated.matrix_world @ v.co) for v in mesh.vertices], np.float64)
    evaluated.to_mesh_clear()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rigs', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report = args.report.resolve()
    assert not report.exists() and bpy.app.background and bpy.context.scene.render.threads == 4
    report.mkdir(parents=True)
    for name in ('prepare_tripo_cast_motion.py', Path(__file__).name):
        shutil.copyfile(motion.ROOT/'Scripts'/name, report/name)
    results = []
    for row in json.loads(args.rigs.read_text()):
        path = Path(row['path']).resolve()
        assert motion.digest(path) == row['sha256']
        rig, ob = surface.load_mesh(path)
        rig.data.pose_position = 'POSE'
        bpy.context.view_layer.update()
        bind = {b.name: b.matrix_local.copy() for b in rig.data.bones}
        parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
        assert len(bind) == 61 and set(motion.MAPPING.values()) <= set(bind)
        local = motion.component_local_rest_rotations(bind, parents)
        rest = {name: matrix.to_quaternion().normalized() for name, matrix in bind.items()}
        neutral_skin = skin(ob)
        cases = {}
        expected_positive = None
        for label, degrees in (('exact_neutral', 0), ('nonzero_component_delta', 10), ('opposite_delta_negative', -10)):
            delta = Quaternion((0, 0, 1), math.radians(degrees))
            wanted = {}
            for b in rig.data.bones:
                parent = parents[b.name]
                wanted[b.name] = (delta @ rest[b.name]).normalized() if b.name in motion.MAPPING.values() else (
                    wanted[parent] @ local[b.name]).normalized() if parent else local[b.name].copy()
            for b in rig.pose.bones:
                q = wanted[b.parent.name].inverted() @ wanted[b.name] if b.parent else wanted[b.name]
                b.rotation_mode = 'QUATERNION'
                b.rotation_quaternion = (local[b.name].inverted() @ q).normalized()
                b.location, b.scale = (0, 0, 0), (1, 1, 1)
            bpy.context.view_layer.update()
            mapped = max(angle(b.matrix.to_quaternion(), wanted[b.name]) for b in rig.pose.bones if b.name in motion.MAPPING.values())
            unmapped = max(angle(b.matrix.to_quaternion(), wanted[b.name]) for b in rig.pose.bones if b.name not in motion.MAPPING.values())
            root = float(np.abs(np.array(rig.pose.bones['root'].matrix)-np.array(bind['root'])).max())
            displacement = float(np.linalg.norm(skin(ob)-neutral_skin, axis=1).max())
            assert mapped < 1e-4 and unmapped < 1e-4 and root < 1e-5
            case = {'mapped_component_rotation_error_rad': mapped, 'unmapped_parent_follow_rotation_error_rad': unmapped,
                'root_matrix_error': root, 'evaluated_skin_max_displacement_source_units': displacement}
            if degrees == 0:
                case['maximum_basis_identity_error'] = max(float(np.abs(np.array(b.matrix_basis)-np.eye(4)).max()) for b in rig.pose.bones)
                assert case['maximum_basis_identity_error'] < 1e-6 and displacement < 1e-6
            elif degrees == 10:
                assert displacement > 1e-3
                expected_positive = {n: q.copy() for n, q in wanted.items()}
            else:
                error = max(angle(b.matrix.to_quaternion(), expected_positive[b.name]) for b in rig.pose.bones)
                assert error > .3
                case['wrong_direction_error_rad'] = error
                case['rejected_by_unchanged_component_gate'] = True
            cases[label] = case
        assert motion.digest(path) == row['sha256']
        results.append({'input': row, 'cases': cases, 'mapped_bones': len(motion.MAPPING), 'unmapped_bones': 61-len(motion.MAPPING)})
    result = {'passed': True, 'threads': 4, 'rendered': False, 'recipe_sha256': motion.digest(Path(__file__)),
        'motion_recipe_sha256': motion.digest(motion.ROOT/'Scripts/prepare_tripo_cast_motion.py'), 'rigs': results,
        'provider_bytes_geometry_weights_binds_unchanged': True, 'art_native_acceptance': False}
    (report/'NeutralRetarget.json').write_text(json.dumps(result, indent=2)+'\n')
    print('TRIPO_NEUTRAL_RETARGET_PASS', len(results), 'own rigs, exactneutral/nonzero/mapped/unmapped/opposite controls')


if __name__ == '__main__':
    main()
