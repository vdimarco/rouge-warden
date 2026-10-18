"""Blender -b -t 4 --python-exit-code 1 --python this_file -- --report NEW_DIR.

Actual static Green/Red import defects plus unchanged clean Black control.
Only snapshot arrays are recovered; no source or Blender normal store is edited.
"""
import argparse
import copy
import json
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_tripo_cast_surface as s


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report = args.report.resolve()
    assert not report.exists() and bpy.app.background and bpy.context.scene.render.threads == 4
    report.mkdir(parents=True)
    for name in ('prepare_tripo_cast_surface.py', Path(__file__).name):
        shutil.copyfile(s.ROOT/'Scripts'/name, report/name)
    cases = {
        'GreenCap51': ('43c538c2880b933fd2f2fc78c67e7ca08e913d05552f53f0dc96794e01ce51f6', 6),
        'RedJersey': ('13bf9c9dc76a7a925ba31ad5fadf6ef5e3a7436ee0450e6579a221f1fabd96c8', 2),
        'BlackCap': ('ff4d393b98d5fba212295305b714ab7fce04229e34b14196c7e2f4c210467d70', 0)}
    results = {}
    for character, (expected, count) in cases.items():
        source = s.ROOT/'Data/GraphicNovel/Crew'/character/'tripo-h31-body-20261017/body.glb'
        assert s.digest(source) == expected
        rig, ob = s.load_mesh(source, allow_static=True)
        assert rig is None
        mesh = ob.data
        mesh.calc_loop_triangles()
        points = np.array([tuple(v.co) for v in mesh.vertices], np.float64)
        uv = np.array([tuple(v.uv) for v in mesh.uv_layers.active.data], np.float64)
        loops = np.array([t.loops[:] for t in mesh.loop_triangles], np.int32)
        vertices = np.array([t.vertices[:] for t in mesh.loop_triangles], np.int32)
        normals = np.array([tuple(v.vector) for v in mesh.corner_normals], np.float64)
        before = (points.copy(), uv.copy(), loops.copy(), vertices.copy(), normals.copy(), np.array(ob.matrix_world))
        assert int(np.all(normals == 0, axis=1).sum()) == count
        negatives = []
        if count:
            # No original-source context means the old/provider finite gate stays strict.
            try:
                s.snapshot_mesh(rig, ob)
            except AssertionError as error:
                assert 'Finite nonzero corner normals' in str(error)
                negatives.append('Zero imported normals rejected without original-source context')
            else:
                raise AssertionError('Unrecovered zero source/provider snapshot accepted')
            raw = s.static_glb_normal_arrays(source)
            recovered, proof = s.recover_static_source_normals(raw, points, uv, loops, vertices, normals)
            assert proof['recovered_corner_count'] == count and proof['position_residual_max_m'] == 0
            healthy = ~np.all(normals == 0, axis=1)
            assert np.array_equal(recovered[healthy], normals[healthy])
            bad_raw_vertex = proof['corners'][0]['raw_vertex']
            for label in ('zero raw normal', 'nonfinite raw normal', '20micron POSITION deformation',
                          'changed UV', 'ambiguous UV triangles', 'reversed triangle winding'):
                changed = copy.deepcopy(raw)
                if label == 'zero raw normal':
                    changed['normal'][bad_raw_vertex] = 0
                elif label == 'nonfinite raw normal':
                    changed['normal'][bad_raw_vertex, 0] = np.nan
                elif label == '20micron POSITION deformation':
                    changed['position'][bad_raw_vertex, 0] += 20e-6
                elif label == 'changed UV':
                    changed['uv'][bad_raw_vertex, 0] += .01
                elif label == 'ambiguous UV triangles':
                    changed['indices'][1] = changed['indices'][0]
                else:
                    changed['indices'][0] = changed['indices'][0, [1, 0, 2]]
                try:
                    s.recover_static_source_normals(changed, points, uv, loops, vertices, normals)
                except AssertionError:
                    negatives.append(label)
                else:
                    raise AssertionError('Invalid original correspondence accepted: '+label)
        snapshot = s.snapshot_mesh(rig, ob, source)
        proof = snapshot['source_normal_recovery']
        assert proof['recovered_corner_count'] == count and bool(proof['applied']) == bool(count)
        assert np.isfinite(snapshot['normals']).all()
        assert np.max(np.abs(np.linalg.norm(snapshot['normals'], axis=2)-1)) < 1e-12
        after = (np.array([tuple(v.co) for v in mesh.vertices], np.float64),
            np.array([tuple(v.uv) for v in mesh.uv_layers.active.data], np.float64),
            np.array([t.loops[:] for t in mesh.loop_triangles], np.int32),
            np.array([t.vertices[:] for t in mesh.loop_triangles], np.int32),
            np.array([tuple(v.vector) for v in mesh.corner_normals], np.float64), np.array(ob.matrix_world))
        assert all(np.array_equal(a, b) for a, b in zip(before, after)) and s.digest(source) == expected
        results[character] = {'source_sha256': expected, 'proof': proof,
            'source_bytes_mesh_geometry_uv_topology_normals_and_transform_unchanged': True,
            'negative_controls_rejected': negatives}
    result = {'passed': True, 'threads': 4, 'rendered': False,
        'recipe_sha256': s.digest(Path(__file__)), 'surface_recipe_sha256': s.digest(s.ROOT/'Scripts/prepare_tripo_cast_surface.py'),
        'cases': results, 'art_native_or_provider_surface_acceptance': False}
    (report/'SourceNormals.json').write_text(json.dumps(result, indent=2)+'\n')
    print('TRIPO_AUTHORITATIVE_SOURCE_NORMALS_PASS', {key: row['proof']['recovered_corner_count'] for key, row in results.items()})


if __name__ == '__main__':
    main()
