"""Blender CPU regression for gravity-preserving component-delta transport."""
import math
from pathlib import Path
import sys

from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_tripo_cast_motion import gravity_frame, poses_in_fresh_reference


def point(x, y, z):
    return Matrix.Translation((x, y, z))


source = {'left': point(1, 0, 1), 'right': point(-1, 0, 1), 'head': point(0, .01, 2), 'pelvis': point(0, 0, 1)}
target = {'left': point(0, 1, 1), 'right': point(0, -1, 1), 'head': point(.05, 0, 2), 'pelvis': point(0, 0, 1)}
identity = Matrix.Identity(4)
a, ap = gravity_frame(source, identity, 'left', 'right', 'head', 'pelvis', Vector((0, -1, 0)))
b, bp = gravity_frame(target, identity, 'left', 'right', 'head', 'pelvis', Vector((1, 0, 0)))
q = (b @ a.transposed()).to_quaternion()
assert (q @ Vector((0, -1, 0))-Vector((1, 0, 0))).length < 1e-6
assert (q @ Vector((0, 0, 1))-Vector((0, 0, 1))).length < 1e-6
assert ap['anatomical_lean_from_gravity_deg'] != bp['anatomical_lean_from_gravity_deg']
delta = Quaternion(Vector((1, .2, .3)).normalized(), .37)
v = Vector((.3, .8, -.4))
transported = q @ delta @ q.inverted()
assert (transported @ (q @ v)-q @ (delta @ v)).length < 1e-6
# This catches the otherwise plausible but wrong untransported component delta.
assert (delta @ (q @ v)-q @ (delta @ v)).length > .05


def reject(bind, left, right, hint, world=identity):
    try:
        gravity_frame(bind, world, left, right, 'head', 'pelvis', hint)
    except AssertionError:
        return
    raise AssertionError('Incompatible reference frame accepted')


reject(source, 'right', 'left', Vector((0, -1, 0)))  # Mirrored labels oppose independent facing hint.
reject(source, 'left', 'right', Vector((0, 1, 0)))
reject(source, 'left', 'right', Vector((0, -1, 0)), Matrix.Rotation(math.pi, 4, 'X'))

# Static reference decomposition is gated separately. It must not masquerade
# as motion; an added actual rotation/translation/scale must still fail2e-5.
parents = {'root': None, 'joint': 'root'}
old_root = Matrix.Translation((.1, -.2, .8)) @ Matrix.Rotation(.3, 4, 'X')
old_local = Matrix.Translation((0, .2, .1))
new_root = old_root @ Matrix.Diagonal((1.000012, .999995, 1., 1.))
new_local = old_local @ Matrix.Rotation(.000007, 4, 'Z')
original_bind = {'root': old_root, 'joint': old_root @ old_local}
fresh_bind = {'root': new_root, 'joint': new_root @ new_local}
root_motion = Matrix.Translation((.01, 0, .04)) @ Matrix.Rotation(.47, 4, 'Y')
joint_motion = Matrix.Rotation(.62, 4, 'X')
expected = {'root': old_root @ root_motion, 'joint': old_root @ root_motion @ old_local @ joint_motion}
accepted = {'root': new_root @ root_motion, 'joint': new_root @ root_motion @ new_local @ joint_motion}
adjusted = poses_in_fresh_reference(expected, original_bind, fresh_bind, parents)
error = lambda a, b: max(abs(v) for row in a-b for v in row)
assert max(error(accepted[n], adjusted[n]) for n in parents) < 1e-6
same_bind = poses_in_fresh_reference(expected, original_bind, original_bind, parents)
neutral = poses_in_fresh_reference(original_bind, original_bind, fresh_bind, parents)
assert max(error(same_bind[n], expected[n]) for n in parents) < 1e-6
assert max(error(neutral[n], fresh_bind[n]) for n in parents) < 1e-6
for deformation in (Matrix.Rotation(.001, 4, 'X'), Matrix.Translation((.0002, 0, 0)), Matrix.Diagonal((1.001, 1., 1., 1.))):
    assert error(deformation @ accepted['joint'], adjusted['joint']) > 2e-5
assert original_bind != fresh_bind  # The fixture's reference difference was retained.
print('TRIPO_MOTION_FRAMES_PASS gravity_conjugation_mirror_facing_upside_down_hierarchy_reference_neutral_identity_inserted_deformation_negatives')
