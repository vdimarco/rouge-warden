"""Blender CPU check: UV ties require a unique geometry bijection; differing normals follow corners."""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_tripo_cast_surface import align_surface

uv = np.array([[[0, 0]]*3, [[0, 0]]*3, [[0, 0], [0, 1], [1, 0]]], np.int64)
keys = np.ascontiguousarray(uv.reshape(-1, 6)).view(np.dtype((np.void, 48))).ravel()
points = np.array([[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
                   [[0, 0, 2], [1, 0, 2], [0, 1, 2]],
                   [[0, 0, 4], [1, 0, 4], [0, 1, 4]]], np.float64)
normals = np.array([[[1, 0, 0]]*3, [[0, 1, 0]]*3, [[0, 0, 1]]*3], np.float64)
source = {'keys': keys, 'uv_key_corners': uv, 'points': points, 'normals': normals}
target_points = points.copy()
target_points[:2] = points[[1, 0]][:, [2, 0, 1]]
target = {'keys': keys, 'uv_key_corners': uv, 'points': target_points/2}
aligned, proof = align_surface(source, target)
assert proof['provider_to_source_uniform_scale'] == 2
assert proof['uv_duplicate_triangle_groups'] == 1 and proof['uv_corner_tie_triangles'] == 2
assert proof['geometry_mapping_unique'] and np.array_equal(aligned['points'], target_points)
assert np.array_equal(aligned['normals'][:2], normals[[1, 0]])


def rejects(a, b, **options):
    try:
        align_surface(a, b, **options)
    except AssertionError:
        return
    raise AssertionError('Invalid correspondence accepted')


ambiguous_source, ambiguous_target = source.copy(), target.copy()
ambiguous_source['points'] = points.copy(); ambiguous_source['points'][1] = points[0]
ambiguous_target['points'] = target['points'].copy()
ambiguous_target['points'][:2] = points[0, [2, 0, 1]]/2
rejects(ambiguous_source, ambiguous_target)  # Coincident faces have incompatible normal classes.
bad = target.copy(); bad['points'] = target['points'].copy(); bad['points'][0, 0, 0] += .01
rejects(source, bad)
for offset, accepted in ((9.999e-6, True), (10.001e-6, False), (20e-6, False)):
    changed = source.copy(); changed['points'] = points.copy(); changed['points'][0, 0, 0] += offset
    if accepted:
        _, near = align_surface(changed, target, scale=2.)
        assert abs(near['source_residual_max_m']-offset) < 1e-12
    else:
        rejects(changed, target)

# Static originals may be centered while their own rig places its feet at zero.
# Fit only positive uniform scale plus translation; never repair either mesh.
offset = np.array([.00066, -.00089, .48969])
shifted = target.copy(); shifted['points'] = target['points']+offset
unaltered = shifted['points'].copy()
restored, static_proof = align_surface(source, shifted, allow_translation=True)
assert abs(static_proof['provider_to_source_uniform_scale']-2) < 1e-12
assert np.max(np.abs(np.array(static_proof['provider_to_source_translation_m'])+2*offset)) < 1e-12
assert static_proof['source_residual_max_m'] < 1e-12
assert static_proof['translation_fit'] and not static_proof['rotation_fit']
assert not static_proof['geometry_bind_or_object_transform_correction_applied']
assert np.array_equal(shifted['points'], unaltered) and np.array_equal(restored['normals'], aligned['normals'])
rejects(source, shifted)  # Legacy origin-only policy remains strict.
nonuniform = shifted.copy(); nonuniform['points'] = shifted['points']*np.array([1.01, 1., 1.])
rejects(source, nonuniform, allow_translation=True)
angle = .03
rotation = np.array([[np.cos(angle), -np.sin(angle), 0], [np.sin(angle), np.cos(angle), 0], [0, 0, 1]])
rotated = shifted.copy(); rotated['points'] = shifted['points']@rotation.T
rejects(source, rotated, allow_translation=True)
deformed = shifted.copy(); deformed['points'] = shifted['points'].copy(); deformed['points'][0, 0, 0] += 20e-6
rejects(source, deformed, allow_translation=True)
print('TRIPO_SURFACE_CORRESPONDENCE_PASS unique_bijection_near10micron_bounds_static_translation_positive_nonuniform_rotation_deformation_negative')
