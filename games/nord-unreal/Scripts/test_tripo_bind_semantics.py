"""Blender CPU boundary checks for static bind semantics and legacy matrix policy."""
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_tripo_cast_surface import STATIC_BIND_LIMITS, bind_gate, bind_round_trip

zero = {key: 0. for key in STATIC_BIND_LIMITS}
assert bind_gate(zero, True) and bind_gate(zero, False)
# Exercise each semantic policy independently, including the angle guard whose
# bound is wider than the matrix gate for well-formed orthogonal test matrices.
for key, limit in STATIC_BIND_LIMITS.items():
    near, outside = zero.copy(), zero.copy()
    near[key], outside[key] = limit*.9999, limit*1.0001
    assert bind_gate(near, True), key
    assert not bind_gate(outside, True), key
    exact = zero.copy(); exact[key] = limit
    assert not bind_gate(exact, True), key

identity = np.eye(4)
for perturbation, accepted in ((1.999e-5, True), (2.001e-5, False)):
    changed = identity.copy(); changed[0, 1] = perturbation
    proof = bind_round_trip({'joint': identity}, {'joint': changed}, True)
    assert proof['passed'] == accepted, proof
    assert proof['max_errors']['head'] == 0 and proof['max_errors']['angle_rad'] < 1e-4 and proof['max_errors']['scale'] < 1e-5
    assert not bind_round_trip({'joint': identity}, {'joint': changed}, False)['passed']
for delta, accepted in ((.999e-5, True), (1.001e-5, False)):
    translated = identity.copy(); translated[2, 3] = delta
    proof = bind_round_trip({'joint': identity}, {'joint': translated}, True)
    assert proof['max_errors']['matrix'] < 2e-5 and proof['passed'] == accepted, proof
# Blender matrices are float32: use adjacent representable values around1+2e-5.
outside_scale = np.float32(1+2e-5)
inside_scale = np.nextafter(outside_scale, np.float32(1))
for value, accepted in ((inside_scale, True), (outside_scale, False)):
    scaled = identity.copy(); scaled[0, 0] = value
    proof = bind_round_trip({'joint': identity}, {'joint': scaled}, True)
    assert proof['passed'] == accepted, proof
for delta, accepted in ((.9999e-5, True), (1.0001e-5, False)):
    metrics = zero.copy(); metrics['matrix'] = delta
    assert bind_gate(metrics, False) == accepted
assert np.array_equal(identity, np.eye(4))
print('TRIPO_BIND_SEMANTICS_PASS static_matrix_angle_head_scale_boundaries_legacy_unchanged_no_bind_mutation')
