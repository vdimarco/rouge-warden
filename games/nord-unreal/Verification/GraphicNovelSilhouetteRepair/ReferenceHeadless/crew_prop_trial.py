"""PIE-only reference-derived prop prototype. Import never imports Unreal.

Only root may install this after native start_style in a fresh guarded capture.
No saved body/clip/material is replaced here. This is wrist support, not accepted grasp.
"""
import math
import shlex

SCALE = .6
RAW_GRIP_Z_CM = -20.
MESH = '/Game/ParkComic/Crew/SM_Plunger.SM_Plunger'
FLAGS = ('absolute_location', 'absolute_rotation', 'absolute_scale')
SKELETON = '/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9/SK_Body_Skeleton.SK_Body_Skeleton'


def xyz(v):
    result = [float(v.x), float(v.y), float(v.z)]
    assert all(math.isfinite(x) for x in result), 'Nonfinite prop/vector value'
    return result


def xyzw(q):
    result = [float(q.x), float(q.y), float(q.z), float(q.w)]
    assert all(math.isfinite(x) for x in result), 'Nonfinite prop quaternion'
    assert abs(sum(x*x for x in result)-1.) < .0001, 'Nonunit prop quaternion'
    return result


def transform(t):
    return {'translation_cm': xyz(t.translation), 'rotation_xyzw': xyzw(t.rotation),
            'scale': xyz(t.scale3d)}


def untouched(prop):
    return (prop.get_attach_parent(), str(prop.get_attach_socket_name()),
            prop.get_editor_property('static_mesh'), str(prop.get_collision_profile_name()),
            prop.get_collision_enabled(), tuple(prop.get_editor_property('override_materials')))


def native_selection(mesh):
    instance = mesh.get_anim_instance()
    assert instance.get_class().get_path_name() == '/Script/Quebec.QuebecCrewAnimInstance'
    return (mesh.get_skeletal_mesh_asset(), instance.get_editor_property('jump_asset'),
            instance.get_editor_property('locomotion_asset'))


def relative_grip(u, hand_q, world_q):
    """Raw grip (0,0,-20cm) lands exactly at RightHand origin at .6 scale."""
    xyzw(hand_q); xyzw(world_q)
    relative_q = hand_q.inversed() * world_q
    xyzw(relative_q)
    offset = relative_q.rotate_vector(u.Vector(0., 0., RAW_GRIP_Z_CM*SCALE)) * -1.
    xyz(offset)
    return relative_q, offset


def reference_hand(u, mesh):
    """AnimPose WORLD means component space; explicitly compose mesh to world."""
    api = getattr(u, 'AnimPoseExtensions', None)
    assert all(callable(getattr(api, key, None)) for key in ('get_reference_pose', 'is_valid', 'get_bone_names', 'get_bone_pose')), 'Missing native reference-pose API'
    skeleton = mesh.get_skeletal_mesh_asset().get_editor_property('skeleton')
    assert skeleton and skeleton.get_path_name() == SKELETON, 'Wrong own-body skeleton'
    pose = api.get_reference_pose(skeleton)
    assert api.is_valid(pose), 'Invalid native reference pose'
    names = list(map(str, api.get_bone_names(pose)))
    folded = [name.casefold() for name in names]
    assert len(names) == len(set(folded)) and names.count('RightHand') == 1, 'Reference RightHand missing or colliding'
    hand_component = api.get_bone_pose(pose, 'RightHand', u.AnimPoseSpaces.WORLD)
    mesh_world = mesh.get_world_transform()
    transform(hand_component); transform(mesh_world)
    for label, value in (('reference hand', hand_component), ('mesh world', mesh_world)):
        scale = xyz(value.scale3d)
        assert min(scale) > 0. and max(scale)-min(scale) < .00001, ('Uniform positive reference scale required', label)
    hand_world_q = mesh_world.rotation * hand_component.rotation
    xyzw(hand_world_q)
    return hand_component, mesh_world, hand_world_q, names


def readback(u, snapshot):
    prop, mesh = snapshot['prop'], snapshot['mesh']
    assert untouched(prop) == snapshot['untouched'], 'Attachment/asset/collision/material changed'
    assert native_selection(mesh) == snapshot['native_selection'], 'Native body/jump/locomotion selection changed'
    assert not any(prop.get_editor_property(key) for key in FLAGS), 'Prop lost hand-relative transform'
    hand = mesh.get_socket_transform('RightHand', u.RelativeTransformSpace.RTS_WORLD)
    local, world = prop.get_relative_transform(), prop.get_world_transform()
    local_values, world_values = transform(local), transform(world)
    assert math.dist(xyz(local.translation), xyz(snapshot['offset'])) < .001, 'Grip offset drift'
    assert math.dist(xyz(local.scale3d), [SCALE]*3) < .00001, 'Prop scale drift'
    assert abs(sum(a*b for a,b in zip(xyzw(local.rotation), xyzw(snapshot['relative_q'])))) > .99999, 'Grip rotation drift'
    expected_q = hand.rotation * snapshot['relative_q']
    assert abs(sum(a*b for a,b in zip(xyzw(world.rotation), xyzw(expected_q)))) > .99999, 'World grip rotation drift'
    grip = u.MathLibrary.transform_location(world, u.Vector(0., 0., RAW_GRIP_Z_CM))
    error = math.dist(xyz(grip), xyz(hand.translation))
    assert error < .01, ('Raw shaft grip no longer maps to RightHand', error)
    return {'hand_world': transform(hand), 'prop_relative': local_values, 'prop_world': world_values,
            'raw_grip_world_cm': xyz(grip), 'wrist_error_cm': error,
            'absolute_flags': [bool(prop.get_editor_property(key)) for key in FLAGS]}


def restore(snapshot):
    prop = snapshot['prop']
    assert untouched(prop) == snapshot['untouched'], 'Unexpected prop change before restore'
    prop.set_absolute(*snapshot['original_flags'])
    prop.set_relative_transform(snapshot['original_relative'], False, True)
    assert tuple(bool(prop.get_editor_property(key)) for key in FLAGS) == snapshot['original_flags']
    now = transform(prop.get_relative_transform())
    old = snapshot['original_relative_values']
    assert math.dist(now['translation_cm'], old['translation_cm']) < .001
    assert math.dist(now['scale'], old['scale']) < .00001
    assert abs(sum(a*b for a,b in zip(now['rotation_xyzw'], old['rotation_xyzw']))) > .99999
    assert untouched(prop) == snapshot['untouched']
    snapshot['restored'] = True


def apply(u, world, pawn, mesh):
    args = set(shlex.split(u.SystemLibrary.get_command_line()))
    assert {'-NordGraphicNovelCandidate', '-NordGraphicNovelGenerated', '-NordGraphicNovelHighDetail'} <= args
    assert world in u.EditorLevelLibrary.get_pie_worlds(True), 'Only an owned PIE world is allowed'
    assert str(mesh.get_skeletal_mesh_asset().get_path_name()) == '/Game/ParkComic/CrewGraphicNovelHighDetail/Resident9/SK_Body.SK_Body'
    matches = [p for p in pawn.get_components_by_class(u.StaticMeshComponent) if p.get_name() == 'CrewProp']
    assert len(matches) == 1, 'Missing or duplicate player CrewProp'
    prop = matches[0]
    assert prop.get_attach_parent() == mesh and str(prop.get_attach_socket_name()) == 'RightHand'
    assert str(prop.get_editor_property('static_mesh').get_path_name()) == MESH
    assert str(prop.get_collision_profile_name()) == 'NoCollision'
    assert prop.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    hand = mesh.get_socket_transform('RightHand', u.RelativeTransformSpace.RTS_WORLD)
    hand_scale = xyz(hand.scale3d)
    assert min(hand_scale) > 0. and max(hand_scale)-min(hand_scale) < .00001, 'This measured grip requires uniform positive hand scale'
    axis = pawn.get_actor_forward_vector()*-.2 + pawn.get_actor_right_vector()*.55 - u.Vector(0., 0., .8)
    assert math.dist(xyz(axis), [0.,0.,0.]) > .01
    world_q = u.MathLibrary.make_rot_from_z(axis).quaternion()
    ref_hand, mesh_world, ref_world_q, ref_names = reference_hand(u, mesh)
    relative_q, offset = relative_grip(u, ref_world_q, world_q)
    original = prop.get_relative_transform()
    snapshot = {'prop': prop, 'mesh': mesh, 'untouched': untouched(prop),
                'native_selection': native_selection(mesh),
                'original_flags': tuple(bool(prop.get_editor_property(key)) for key in FLAGS),
                'original_relative': original, 'original_relative_values': transform(original),
                'original_world_values': transform(prop.get_world_transform()),
                'initial_hand_world': transform(hand), 'relative_q': relative_q, 'offset': offset,
                'initial_axis_world': xyz(axis), 'initial_target_world_quat': xyzw(world_q),
                'calibration_method': 'own USkeleton reference RightHand; AnimPose WORLD is component space; referenceWorldQ=meshWorldQ*referenceHandComponentQ; live hand only anchors current pose',
                'reference_skeleton': SKELETON, 'reference_pose_bone_names': ref_names,
                'reference_hand_component': transform(ref_hand),
                'reference_mesh_world': transform(mesh_world),
                'reference_hand_world_quaternion_xyzw': xyzw(ref_world_q),
                'scale': SCALE, 'raw_grip_z_cm': RAW_GRIP_Z_CM,
                'raw_obj_bounds_cm': [[-14.3933, -14.3933, -35.], [14.3933, 14.3933, 58.5]],
                'scope': 'PIE-only supported tool at wrist; static open fingers, no accepted closed grasp'}
    try:
        local = u.Transform()
        local.translation, local.rotation, local.scale3d = offset, relative_q, u.Vector(SCALE,SCALE,SCALE)
        prop.set_absolute(False, False, False)
        prop.set_relative_transform(local, False, True)
        snapshot['initial_readback'] = readback(u, snapshot)
    except BaseException:
        restore(snapshot)
        raise
    return snapshot
