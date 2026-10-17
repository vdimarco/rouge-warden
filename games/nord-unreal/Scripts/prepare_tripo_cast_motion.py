"""Prepare own-rig cast clips; Blender -b -t 4 --python-exit-code 1 --python this_file --
--manifest JSON --output NEW_DIR --report NEW_DIR.

Manifest roles provider_fbx/source_body_fbx/walk_fbx/run_fbx each pin path+sha256.
surface_receipt pins a passed own static Tripo-body/provider surface JSON. The
unrelated24-bone body supplies motion references only, never surface correspondence.
Relative inputs resolve against the game root. The unchanged Meshy jump author runs
only on a copied body. Adapts the frozen component-delta, NaturalPose/v4 and timing
recipes; no provider, rendering, Unreal or service operations.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import traceback

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_SCALE_LIMIT = 2e-5
MAX_RESIDUAL_WRIST_ROLL_DEG = 10.
MAPPING = {'Hips': 'pelvis', 'Spine02': 'spine_01', 'Spine01': 'spine_02', 'Spine': 'spine_03', 'neck': 'neck_01', 'Head': 'head'}
for prefix, side in (('Left', 'l'), ('Right', 'r')):
    for source, target in (('Shoulder', 'clavicle'), ('Arm', 'upperarm'), ('ForeArm', 'lowerarm'), ('Hand', 'hand'),
                           ('UpLeg', 'thigh'), ('Leg', 'calf'), ('Foot', 'foot'), ('ToeBase', 'ball')):
        MAPPING[prefix + source] = target + '_' + side
FINGERS = {f'{d}_{j:02}_{s}' for d in ('thumb', 'index', 'middle', 'ring', 'pinky') for j in (1, 2, 3) for s in ('l', 'r')}
ARMS = {f'{b}_{s}' for b in ('clavicle', 'upperarm', 'lowerarm', 'hand') for s in ('l', 'r')}
TIMES = (0, .10, .23, .47, .73, .93, 1.20)
KEYS = {'swing_l': (0, -6, 8, 12, 4, -4, 0), 'swing_r': (0, -3, 0, -12, -8, -2, 0),
        'elbow_l': (14, 22, 34, 50, 36, 23, 14), 'elbow_r': (18, 22, 30, 35, 30, 24, 18),
        'out_l': (8, 10, 12, 10, 8, 9, 8), 'out_r': (6, 8, 10, 8, 7, 8, 6)}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_plan(manifest, output, report):
    manifest, output, report = Path(manifest).resolve(), Path(output).resolve(), Path(report).resolve()
    assert manifest.is_file() and not output.exists() and not report.exists(), 'Use fresh output/report directories'
    assert not output.is_relative_to(report) and not report.is_relative_to(output)
    document = json.loads(manifest.read_text())
    assert set(document) == {'provider_fbx', 'source_body_fbx', 'walk_fbx', 'run_fbx', 'surface_receipt'}
    paths, hashes = {}, {}
    for role, row in document.items():
        assert set(row) == {'path', 'sha256'} and isinstance(row['path'], str)
        path = Path(row['path']); path = path if path.is_absolute() else ROOT / path
        assert path.is_file() and not path.is_symlink() and path.suffix.lower() == ('.json' if role == 'surface_receipt' else '.fbx'), role
        path = path.resolve()
        assert path.is_relative_to(ROOT / 'Data') or role == 'surface_receipt' and any(path.is_relative_to(ROOT/p) for p in ('Saved/Tests', 'Verification')), 'Retained project inputs required'
        expected = row['sha256']
        assert isinstance(expected, str) and len(expected) == 64 and all(c in '0123456789abcdef' for c in expected)
        assert digest(path) == expected, ('Pinned input mismatch', role)
        paths[role], hashes[role] = path, expected
    source = paths['source_body_fbx'].parent
    assert paths['walk_fbx'].parent == paths['run_fbx'].parent == source, 'Own source body and gaits required'
    assert not output.is_relative_to(source) and not report.is_relative_to(source), 'Protect source model directory'
    checked_surface(paths, hashes)
    return paths, hashes


def checked_surface(paths, hashes):
    receipt = json.loads(paths['surface_receipt'].read_text())
    assert receipt['passed'] is True and receipt['retained_inputs_unchanged'] is True
    assert receipt['inputs']['provider_fbx']['sha256'] == hashes['provider_fbx'], 'Surface proof must match own raw rig'
    assert receipt['source_geometry']['static_unrigged'] is True and receipt['source_geometry']['bones'] == 0
    assert receipt['rig']['bones'] == 61 and receipt['rig']['hierarchy_preserved'] is True
    assert receipt['geometry']['provider_size_preserved'] is True and receipt['native_import_scale_required'] is None
    proof = receipt['correspondence']
    assert proof['geometry_mapping_unique'] is True and proof['rotation_fit'] is False
    assert proof['geometry_bind_or_object_transform_correction_applied'] is False
    assert 0 < proof['provider_to_source_uniform_scale'] and proof['source_residual_max_m'] < proof['residual_limit_m'] <= 1e-5
    pinned = {}
    for row in (receipt['inputs']['source_glb'], receipt['output']):
        path = Path(row['path']); path = path if path.is_absolute() else ROOT/path
        assert path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(ROOT)
        assert digest(path) == row['sha256'], 'Own surface proof dependency changed'
        pinned[str(path.resolve())] = row['sha256']
    return receipt, pinned


def gravity_frame(bind, object_matrix, left_name, right_name, head_name, pelvis_name, forward_hint):
    """Proper semantic frame: preserve world gravity, resolve heading from anatomy."""
    from mathutils import Matrix, Vector
    up = (object_matrix.to_3x3().inverted() @ Vector((0, 0, 1))).normalized()
    anatomical_up = (bind[head_name].translation-bind[pelvis_name].translation).normalized()
    assert up.dot(anatomical_up) > .9, 'Reference must be upright'
    left = bind[left_name].translation-bind[right_name].translation
    left -= up*left.dot(up); assert left.length > 1e-6; left.normalize()
    forward = left.cross(up).normalized()
    hint = forward_hint-up*forward_hint.dot(up)
    assert hint.length > 1e-6 and forward.dot(hint.normalized()) > .5, 'Anatomical labels and facing hint disagree'
    basis = Matrix((-left, forward, up)).transposed()
    assert abs(basis.determinant()-1) < 1e-5, 'Reflection forbidden'
    return basis, {'up_gravity': list(up), 'left': list(left), 'forward': list(forward),
        'forward_hint_dot': forward.dot(hint.normalized()), 'determinant': basis.determinant(),
        'anatomical_lean_from_gravity_deg': math.degrees(up.angle(anatomical_up))}


def poses_in_fresh_reference(expected, original_bind, fresh_bind, parents):
    """Preserve evaluated LOCAL animation on the independently imported bind.

    FBX stores local channels. Rebuild their hierarchy rather than fitting each
    component independently. No actual animated sample enters this prediction.
    """
    assert set(expected) == set(original_bind) == set(fresh_bind) == set(parents)
    result = {}
    def visit(name):
        if name in result: return result[name]
        parent = parents[name]
        old_local = original_bind[parent].inverted() @ original_bind[name] if parent else original_bind[name]
        old_pose = expected[parent].inverted() @ expected[name] if parent else expected[name]
        basis = old_local.inverted() @ old_pose
        new_local = fresh_bind[parent].inverted() @ fresh_bind[name] if parent else fresh_bind[name]
        result[name] = visit(parent) @ new_local @ basis if parent else new_local @ basis
        return result[name]
    for name in expected: visit(name)
    return result


def prepare(manifest, output, report):
    paths, hashes = source_plan(manifest, output, report)
    own_surface, surface_protected = checked_surface(paths, hashes)
    import bpy
    import numpy as np
    from io_scene_fbx.parse_fbx import parse
    from mathutils import Matrix, Quaternion, Vector
    assert bpy.app.background and bpy.context.scene.render.threads == 4, 'Run background Blender with -t 4'
    output.mkdir(parents=True); report.mkdir(parents=True)
    work_parent = ROOT / 'Saved/Tests'; work_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix='TripoCastMotion-', dir=work_parent))
    working = {}
    for role, path in paths.items():
        if role == 'surface_receipt': continue
        working[role] = work / (role + '.fbx')
        shutil.copyfile(path, working[role])
        assert digest(working[role]) == hashes[role]
    jump_author = ROOT / 'Scripts/prepare_meshy_jump.py'
    surface_recipe = ROOT/'Scripts/prepare_tripo_cast_surface.py'
    protected = {str(p): digest(p) for p in [manifest, jump_author, surface_recipe, *paths.values()]}
    protected.update(surface_protected)
    result = {'passed': False, 'started_utc': datetime.now(timezone.utc).isoformat(), 'recipe_sha256': digest(Path(__file__)),
              'inputs': {k: {'path': str(p.relative_to(ROOT)), 'sha256': hashes[k]} for k, p in paths.items()},
              'manifest_sha256': digest(manifest), 'surface_correspondence_recipe_sha256': own_surface['recipe_sha256'],
              'current_surface_helper_protected_sha256': digest(surface_recipe),
              'blender': bpy.app.version_string, 'threads': 4,
              'source_to_target': MAPPING, 'joint_key_seconds': TIMES, 'joint_key_degrees': KEYS,
              'own_static_body_surface': {'path': str(paths['surface_receipt']), 'sha256': hashes['surface_receipt'],
                  'source_glb': own_surface['inputs']['source_glb'], 'correspondence': own_surface['correspondence']},
              'scope': 'Own61 animation-only CPU derivatives; no model/native/provider/render/service writes',
              'policy': 'Static actor/root; own component deltas and measured hip XYZ scale; relaxed v4 upper-body acting for Idle/Jump, source gait acting retained.',
              'fixed_limits': {'reference_matrix': 2e-5, 'reference_head': 1e-5, 'reference_scale': REFERENCE_SCALE_LIMIT, 'rotation_rad': 1e-4,
                               'source_regular_clip_reference_scale': 1e-5,
                               'source_reference_head_world_m': 1e-5,
                               'local_translation_scale': 1e-5, 'object_matrix': 1e-7,
                               'authored_idle_step_deg_per_30Hz_frame': 3, 'authored_jump_step_deg_per_30Hz_frame': 20,
                               'authored_elbow_forward_delta_min_deg': 14, 'residual_wrist_roll_abs_max_deg': MAX_RESIDUAL_WRIST_ROLL_DEG,
                               'curve_grid_error_ktime_ticks': 1},
              'clips': {}, 'errors': []}

    def qerror(a, b):
        q = a.normalized().rotation_difference(b.normalized())
        return 2 * math.atan2(Vector((q.x, q.y, q.z)).length, abs(q.w))

    def merror(a, b):
        return max(abs(v) for row in a - b for v in row)

    def reset():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.render.threads_mode, scene.render.threads = 'FIXED', 4
        return scene

    def imported(path, animated):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=animated, automatic_bone_orientation=False, use_image_search=False)
        rigs = [o for o in bpy.data.objects if o not in before and o.type == 'ARMATURE']
        assert len(rigs) == 1
        # Every FBX import may reset scene fps; set both values afterwards.
        bpy.context.scene.render.fps, bpy.context.scene.render.fps_base = 30, 1.0
        return rigs[0]

    def frame(value):
        bpy.context.scene.frame_set(math.floor(value), subframe=value - math.floor(value))
        bpy.context.view_layer.update()

    def rest(rig):
        rig.animation_data_clear()
        for b in rig.pose.bones:
            b.matrix_basis.identity(); b.rotation_mode = 'QUATERNION'
        bpy.context.view_layer.update()

    def bind_snapshot(rig):
        return {b.name: b.matrix_local.copy() for b in rig.data.bones}

    def hierarchy(rig):
        return {b.name: b.parent.name if b.parent else None for b in rig.data.bones}

    def reference_error(rig, bind):
        return {'matrix': max(merror(b.matrix_local, bind[b.name]) for b in rig.data.bones),
                'angle_rad': max(qerror(b.matrix_local.to_quaternion(), bind[b.name].to_quaternion()) for b in rig.data.bones),
                'head': max((b.matrix_local.translation - bind[b.name].translation).length for b in rig.data.bones),
                'scale': max(max(abs(a-c) for a, c in zip(b.matrix_local.to_scale(), bind[b.name].to_scale())) for b in rig.data.bones)}

    def check_reference(errors):
        assert errors['matrix'] < 2e-5 and errors['angle_rad'] < 1e-4 and errors['head'] < 1e-5 and errors['scale'] < REFERENCE_SCALE_LIMIT, errors

    def body_geometry(rig):
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature() == rig]
        assert len(meshes) == 1
        ob = meshes[0]
        points = np.array([tuple(ob.matrix_world @ v.co) for v in ob.data.vertices], np.float64)
        assert np.isfinite(points).all()
        return float(np.ptp(points[:, 2])), ob

    def clock(path, intervals, canonical=False):
        tree, version = parse(str(path))
        def properties(parent):
            return {e.props[0].decode(): e.props[4] for p in parent.elems if p.id == b'Properties70' for e in p.elems if e.id == b'P'}
        settings = properties(next(e for e in tree.elems if e.id == b'GlobalSettings'))
        assert settings['TimeMode'] == 6 and settings['CustomFrameRate'] == 30.0, settings
        objects = next(e for e in tree.elems if e.id == b'Objects')
        stacks = [e for e in objects.elems if e.id == b'AnimationStack']; assert len(stacks) == 1
        stack = properties(stacks[0]); tick = 1539538600
        seconds = (stack['LocalStop'] - stack['LocalStart']) / 46186158000
        arrays = [next(k for k in e.elems if k.id == b'KeyTime').props[0] for e in objects.elems if e.id == b'AnimationCurve']
        error = max(abs(int(t) - round(int(t) / tick) * tick) for a in arrays for t in a)
        assert arrays
        # Meshy source times may use float32 seconds; all new exports require exact30Hz KTime.
        all_times = [int(t) for a in arrays for t in a]+[stack['LocalStart'], stack['LocalStop']]
        float32_error = max(min(abs(t-round(t/tick)*tick), abs(t-int(float(np.float32(round(t/tick)/30))*46186158000))) for t in all_times)
        if canonical:
            assert stack['LocalStart'] % tick == 0 and stack['LocalStop'] % tick == 0
            assert abs(seconds-intervals/30) < 1e-12 and error <= 1
        else:
            assert round(stack['LocalStop']/tick)-round(stack['LocalStart']/tick) == intervals and float32_error <= 1
        nulls = [e.props[1].decode() for e in objects.elems if e.id == b'Model' and e.props[2] == b'Null']
        if canonical:
            assert nulls == ['Armature\x00\x01Model'], nulls
        return {'version': version, 'time_mode': settings['TimeMode'], 'custom_frame_rate': settings['CustomFrameRate'],
                'stack_time_ticks': stack, 'declared_seconds': seconds, 'curve_max_grid_error_ktime_ticks': error,
                'source_exact_or_float32_30Hz_max_tick_error': float32_error, 'strict_export_clock': canonical, 'null_models': nulls}

    def elbow(rig, suffix, direction):
        u, l, h = (rig.pose.bones[n + '_' + suffix] for n in ('upperarm', 'lowerarm', 'hand'))
        upper, lower = (l.head-u.head).normalized(), (h.head-l.head).normalized()
        hinge = (tb[h.name].translation-tb[l.name].translation).normalized().cross(direction).normalized()
        # Upper-arm swing transports the flexion plane; forearm pronation must
        # not rotate that plane and falsely report a backwards elbow.
        transported = (u.matrix.to_quaternion() @ tb[u.name].to_quaternion().inverted()) @ hinge
        return math.degrees(math.atan2(transported.dot(upper.cross(lower)), upper.dot(lower)))

    def about(name, axis, degrees):
        local = (tb[name].to_3x3().inverted() @ axis).normalized()
        return Quaternion(local, math.radians(degrees))

    def add(rig, name, axis, degrees):
        rig.pose.bones[name].rotation_quaternion = rig.pose.bones[name].rotation_quaternion @ about(name, axis, degrees)

    def rotate_component(rig, name, axis, radians):
        bone = rig.pose.bones[name]
        desired = Quaternion(axis.normalized(), radians) @ bone.matrix.to_quaternion()
        parent = bone.parent.matrix.to_quaternion() if bone.parent else Quaternion()
        bone.rotation_quaternion = (tl[name].to_quaternion().inverted() @ parent.inverted() @ desired).normalized()
        bpy.context.view_layer.update()

    def pronate(rig, suffix, sign, acting_pose=True):
        lower, hand = 'lowerarm_'+suffix, 'hand_'+suffix
        inward = -sign*side
        def posed_palm():
            delta = rig.pose.bones[hand].matrix.to_quaternion() @ tb[hand].to_quaternion().inverted()
            return (delta @ palms[suffix]).normalized()
        def angle_to_inward(palm, axis):
            a, b = palm-axis*palm.dot(axis), inward-axis*inward.dot(axis)
            assert a.length > .1 and b.length > .1
            a.normalize(); b.normalize()
            return math.atan2(axis.dot(a.cross(b)), a.dot(b))
        bpy.context.view_layer.update()
        before = elbow(rig, suffix, forward)
        heads = {n: rig.pose.bones[n].head.copy() for n in ('upperarm_'+suffix, lower, hand)}
        axis = (rig.pose.bones[hand].head-rig.pose.bones[lower].head).normalized()
        palm = posed_palm(); roll = angle_to_inward(palm, axis)
        positive_dot = (Quaternion(axis, roll) @ palm).dot(inward)
        opposite_dot = (Quaternion(axis, -roll) @ palm).dot(inward)
        if abs(roll) > math.radians(10): assert positive_dot > opposite_dot+.05
        twist = 'lowerarm_twist_01_'+suffix
        # Twist and hand are siblings. Match their distal residual so the hand
        # keeps its orientation relative to the weighted distal forearm.
        distal = max(-math.pi/3, min(math.pi/3, .5*roll)) if arm_weights.get(twist, 0) > 1e-8 and parents.get(twist) == lower else 0.
        proximal = roll-distal
        rotate_component(rig, lower, axis, proximal)
        if distal:
            rotate_component(rig, twist, axis, distal)
            rotate_component(rig, hand, axis, distal)
        hand_axis = (rig.pose.bones['middle_01_'+suffix].head-rig.pose.bones[hand].head).normalized()
        wrist = angle_to_inward(posed_palm(), hand_axis)
        assert abs(math.degrees(wrist)) <= MAX_RESIDUAL_WRIST_ROLL_DEG, 'Excessive residual wrist torsion; review own forearm anatomy'
        rotate_component(rig, hand, hand_axis, wrist)
        final_dot = posed_palm().dot(inward)
        p = posed_palm()-hand_axis*posed_palm().dot(hand_axis)
        d = inward-hand_axis*inward.dot(hand_axis)
        projected_dot = p.normalized().dot(d.normalized())
        head_error = max((rig.pose.bones[n].head-value).length for n, value in heads.items())
        elbow_error = abs(elbow(rig, suffix, forward)-before)
        proof = {'forearm_roll_deg': math.degrees(proximal), 'distal_twist_and_hand_roll_deg': math.degrees(distal),
            'residual_wrist_roll_deg': math.degrees(wrist), 'inward_dot': final_dot,
            'projected_inward_dot': projected_dot, 'acting_inward_dot_gate_applies': acting_pose,
            'predicted_signed_roll_dot': positive_dot, 'opposite_signed_roll_dot': opposite_dot,
            'physical_elbow_delta_deg': elbow_error, 'elbow_segment_head_change': head_error}
        assert projected_dot > .999 and (not acting_pose or final_dot >= .85) and head_error < 1e-5 and elbow_error < 1e-3, proof
        return proof

    def at(values, t):
        i = next(i for i in range(len(TIMES)-1) if TIMES[i] <= t <= TIMES[i+1])
        f = (t-TIMES[i]) / (TIMES[i+1]-TIMES[i]); f = f*f*(3-2*f)
        return values[i]*(1-f)+values[i+1]*f

    def acting(rig, kind, t):
        pronation = {}
        breath = (1-math.cos(2*math.pi*t/4))/2 if kind == 'idle' else 0
        sway = math.sin(2*math.pi*t/4) if kind == 'idle' else 0
        add(rig, 'spine_01', side, 1+.4*breath); add(rig, 'spine_02', forward, -1.2+.3*sway)
        add(rig, 'spine_03', up, 2+.3*sway); add(rig, 'neck_01', up, -1.5-.2*sway); add(rig, 'neck_01', forward, .7)
        for suffix, sign in (('l', 1), ('r', -1)):
            upper, lower, hand, clavicle = (n+'_'+suffix for n in ('upperarm', 'lowerarm', 'hand', 'clavicle'))
            for name in (clavicle, upper, lower, hand):
                rig.pose.bones[name].rotation_quaternion = Quaternion()
            clavicle_dir = tb[upper].translation-tb[clavicle].translation
            add(rig, clavicle, clavicle_dir.cross(-up).normalized(), 1.5+(.4*breath if sign == 1 else -.2*breath))
            bpy.context.view_layer.update()
            swing = at(KEYS['swing_'+suffix], t) if kind == 'jump' else sign*.4*sway
            spread = at(KEYS['out_'+suffix], t) if kind == 'jump' else (8 if sign == 1 else 6)+.25*breath
            a, f = math.radians(spread), math.radians(swing)
            desired = -up*(math.cos(a)*math.cos(f))+sign*side*math.sin(a)+forward*(math.cos(a)*math.sin(f))
            swing_q = (tb[lower].translation-tb[upper].translation).normalized().rotation_difference(desired.normalized())
            b = rig.pose.bones[upper]
            parent_delta = b.parent.matrix.to_quaternion() @ tb[b.parent.name].to_quaternion().inverted()
            component = parent_delta @ swing_q @ tb[upper].to_quaternion()
            b.rotation_quaternion = tl[upper].to_quaternion().inverted() @ b.parent.matrix.to_quaternion().inverted() @ component
            flex = at(KEYS['elbow_'+suffix], t) if kind == 'jump' else (14 if sign == 1 else 18)+1.2*breath
            add(rig, lower, hinges[suffix], flex)
            hand_along = (tb['middle_01_'+suffix].translation-tb[hand].translation).normalized()
            add(rig, hand, hand_along.cross(palms[suffix]).normalized(), 3+.4*breath)
            pronation[suffix] = pronate(rig, suffix, sign)
            for d, digit in enumerate(('index', 'middle', 'ring', 'pinky', 'thumb')):
                values = (12+4*d, 18+5*d, 4+d) if digit != 'thumb' else (8, 10, 3)
                for j, angle in enumerate(values, 1):
                    name = f'{digit}_{j:02}_{suffix}'
                    rig.pose.bones[name].rotation_quaternion = about(name, finger_axes[name], angle+(.8 if sign == -1 else 0)+breath*.8)
            name = 'thumb_01_'+suffix
            rig.pose.bones[name].rotation_quaternion = about(name, thumb_adduction[suffix], 14) @ rig.pose.bones[name].rotation_quaternion
        return pronation

    def retarget(rig, row, relaxed_fingers):
        desired = {}
        for b in rig.data.bones:
            parent = parents[b.name]
            local = tl[b.name].to_quaternion()
            if b.name in FINGERS:
                local = local @ relaxed_fingers[b.name]
            desired[b.name] = ((row['delta'][b.name] @ virtual[b.name]).normalized() if b.name in MAPPING.values()
                              else (desired[parent] @ local).normalized() if parent else local.normalized())
        for b in rig.pose.bones:
            local = desired[b.parent.name].inverted() @ desired[b.name] if b.parent else desired[b.name]
            b.rotation_mode, b.rotation_quaternion = 'QUATERNION', (tl[b.name].to_quaternion().inverted() @ local).normalized()
            b.location, b.scale = (0, 0, 0), (1, 1, 1)
            if b.name == 'pelvis':
                b.location = tb['pelvis'].to_3x3().inverted() @ row['hip']
        bpy.context.view_layer.update()
        assert max(qerror(b.matrix.to_quaternion(), desired[b.name]) for b in rig.pose.bones) < 1e-4

    def key_pose(rig, index):
        for b in rig.pose.bones:
            b.rotation_quaternion.normalize()
            if b.name in previous and b.rotation_quaternion.dot(previous[b.name]) < 0: b.rotation_quaternion.negate()
            previous[b.name] = b.rotation_quaternion.copy()
            for channel in ('rotation_quaternion', 'location', 'scale'): b.keyframe_insert(channel, frame=index)

    def export_clip(rig, path, count):
        scene = bpy.context.scene
        scene.frame_start, scene.frame_end = 1, count
        for b in rig.pose.bones:
            b.matrix_basis.identity()
            for channel in ('rotation_quaternion', 'location', 'scale'): b.keyframe_insert(channel, frame=0)
        for layer in rig.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points: key.interpolation = 'LINEAR'
        expected = []
        for i in range((count-1)*2+1):
            frame(1+i/2); expected.append({b.name: b.matrix.copy() for b in rig.pose.bones})
        frame(0); assert max(merror(b.matrix, tb[b.name]) for b in rig.pose.bones) < 1e-5
        bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
        assert scene.render.fps == 30 and scene.render.fps_base == 1.0
        bpy.ops.export_scene.fbx(filepath=str(path), use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                                 bake_anim=True, bake_anim_use_all_bones=True, bake_anim_use_nla_strips=False,
                                 bake_anim_use_all_actions=False, bake_anim_simplify_factor=0, axis_forward='-Z', axis_up='Y')
        return expected

    try:
        # This historical author writes only into the fresh copied character folder.
        copied = work/'corrected-source'/'Character'; copied.mkdir(parents=True)
        shutil.copyfile(working['source_body_fbx'], copied/'body.fbx')
        command = [bpy.app.binary_path, '-b', '-t', '4', '--python-exit-code', '1', '--python', str(jump_author), '--',
                   '--source-root', str(copied.parent), '--names', copied.name, '--report', str(work/'SourceJump.json')]
        with (report/'source-jump.log').open('w') as log:
            process = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=120)
        result['corrected_source_jump'] = {'command': command, 'process_exit_code': process.returncode,
            'author_recipe_sha256': digest(jump_author), 'body_copy_sha256': digest(copied/'body.fbx'),
            'path': str(copied/'jump.fbx'), 'receipt_path': str(work/'SourceJump.json')}
        assert process.returncode == 0 and digest(copied/'body.fbx') == hashes['source_body_fbx']
        assert json.loads((work/'SourceJump.json').read_text())['passed']
        result['corrected_source_jump']['sha256'] = digest(copied/'jump.fbx')
        reset(); body = imported(working['source_body_fbx'], False); rest(body)
        assert len(body.data.bones) == 24 and set(MAPPING) <= set(body.data.bones.keys())
        sb, source_hierarchy, source_object = bind_snapshot(body), hierarchy(body), body.matrix_world.copy()
        source_height, _ = body_geometry(body)
        body.name = 'SourceBody'; target = imported(working['provider_fbx'], False); rest(target)
        target.name = 'Armature'; assert target.name == 'Armature' and len(target.data.bones) == 61
        tb, parents, target_object = bind_snapshot(target), hierarchy(target), target.matrix_world.copy()
        tl = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy() for b in target.data.bones}
        assert set(MAPPING.values()) | FINGERS | {'root'} <= set(tb)
        provider_height, target_mesh = body_geometry(target)
        correspondence = own_surface['correspondence']
        restoration_scale = correspondence['provider_to_source_uniform_scale']
        own_height = own_surface['source_geometry']['height_m']
        expected_provider_height = correspondence['provider_bounds_m']['max'][2]-correspondence['provider_bounds_m']['min'][2]
        assert abs(provider_height-expected_provider_height) < 2e-6 and abs(provider_height*restoration_scale-own_height) < 2e-6
        ss, ts = source_object.to_scale(), target_object.to_scale()
        assert min(ss) > 0 and min(ts) > 0 and max(ss)-min(ss) < 1e-6 and max(ts)-min(ts) < 1e-6
        factor = ss.z*(own_height/source_height)/(restoration_scale*ts.z)
        source_hint = sb['headfront'].translation-sb['Head'].translation
        target_hint = sum((tb['ball_'+s].translation-tb['foot_'+s].translation for s in ('l', 'r')), Vector())
        source_frame, source_frame_proof = gravity_frame(sb, source_object, 'LeftUpLeg', 'RightUpLeg', 'Head', 'Hips', source_hint)
        target_frame, target_frame_proof = gravity_frame(tb, target_object, 'thigh_l', 'thigh_r', 'head', 'pelvis', target_hint)
        transport = (target_frame @ source_frame.transposed()).to_quaternion().normalized()
        virtual = {n: m.to_quaternion().normalized() for n, m in tb.items()}
        reference_arms = {}
        for prefix, suffix in (('Left', 'l'), ('Right', 'r')):
            reference_arms[suffix] = {}
            for source_name, source_tip, target_name, target_tip in (('Arm', 'ForeArm', 'upperarm', 'lowerarm'), ('ForeArm', 'Hand', 'lowerarm', 'hand')):
                name = target_name+'_'+suffix
                a = (sb[prefix+source_tip].translation-sb[prefix+source_name].translation).normalized()
                b = (tb[target_tip+'_'+suffix].translation-tb[name].translation).normalized()
                transported = transport @ a
                correction = b.rotation_difference(transported)
                virtual[name] = (correction @ tb[name].to_quaternion()).normalized()
                reference_arms[suffix][target_name] = {'source_angle_from_gravity_down_deg': math.degrees(a.angle(-Vector(source_frame_proof['up_gravity']))),
                    'provider_angle_from_gravity_down_deg': math.degrees(b.angle(-Vector(target_frame_proof['up_gravity']))),
                    'virtual_reference_correction_deg': math.degrees(b.angle(transported))}
            hand, lower = 'hand_'+suffix, 'lowerarm_'+suffix
            assert parents[hand] == lower
            virtual[hand] = (virtual[lower] @ (tb[lower].to_quaternion().inverted() @ tb[hand].to_quaternion())).normalized()
        result['motion_reference_frames'] = {'source': source_frame_proof, 'provider': target_frame_proof,
            'source_to_provider_quaternion_wxyz': list(transport), 'world_gravity_preserved': True,
            'reference_arm_measurements': reference_arms, 'virtual_reference_policy': 'Only upper/lower arms align segment directions; hands follow own lower-arm local bind. Torso/legs and all provider data binds remain unchanged.',
            'source_and_provider_A_pose': all(reference_arms[s]['upperarm'][k] < 65 for s in ('l', 'r') for k in ('source_angle_from_gravity_down_deg', 'provider_angle_from_gravity_down_deg'))}
        groups = {g.index: g.name for g in target_mesh.vertex_groups}
        weighted = {n: 0. for n in FINGERS}
        arm_weights = {f'{name}_{s}': 0. for name in ('lowerarm', 'lowerarm_twist_01', 'hand') for s in ('l', 'r')}
        for v in target_mesh.data.vertices:
            assert all(math.isfinite(g.weight) and g.weight >= 0 for g in v.groups)
            weights = [g.weight for g in v.groups if g.weight > 1e-8]
            assert len(weights) <= 4 and all(math.isfinite(w) and w >= 0 for w in weights) and abs(sum(weights)-1) < 1e-4
            for g in v.groups:
                assert groups[g.group] in tb or g.weight == 0
                if groups[g.group] in weighted:
                    weighted[groups[g.group]] += g.weight
                if groups[g.group] in arm_weights:
                    arm_weights[groups[g.group]] += g.weight
        assert all(w > 1e-8 for w in weighted.values())
        up = (tb['head'].translation-tb['pelvis'].translation).normalized()
        side = (tb['thigh_l'].translation-tb['thigh_r'].translation).normalized()
        forward = sum((tb['ball_'+s].translation-tb['foot_'+s].translation for s in ('l', 'r')), Vector())
        forward -= up*forward.dot(up)+side*forward.dot(side); assert forward.length > 1e-6; forward.normalize()
        finger_axes, thumb_adduction, hinges, palms = {}, {}, {}, {}
        neutral = {s: elbow(target, s, forward) for s in ('l', 'r')}
        sign_controls = {}
        for suffix, sign in (('l', 1), ('r', -1)):
            along = tb['middle_01_'+suffix].translation-tb['hand_'+suffix].translation
            across = tb['pinky_01_'+suffix].translation-tb['index_01_'+suffix].translation
            palm = across.cross(along).normalized()
            if palm.dot(-sign*side) < 0: palm.negate()
            palms[suffix] = palm
            direction = tb['thumb_02_'+suffix].translation-tb['thumb_01_'+suffix].translation
            thumb_adduction[suffix] = direction.normalized().cross(along.normalized()).normalized()
            lower = tb['hand_'+suffix].translation-tb['lowerarm_'+suffix].translation
            hinges[suffix] = lower.normalized().cross(forward).normalized()
            for d in ('thumb', 'index', 'middle', 'ring', 'pinky'):
                for j in (1, 2, 3):
                    name = f'{d}_{j:02}_{suffix}'; bone = target.data.bones[name]
                    assert parents[name] == ('hand_'+suffix if j == 1 else f'{d}_{j-1:02}_{suffix}')
                    axis = (bone.tail_local-bone.head_local).normalized().cross(palm)
                    assert axis.length > .01; finger_axes[name] = axis.normalized()
            control, pronated_controls = [], []
            for angle in (20, -20):
                rest(target); add(target, 'lowerarm_'+suffix, hinges[suffix], angle); bpy.context.view_layer.update()
                control.append(elbow(target, suffix, forward)-neutral[suffix])
                proof = pronate(target, suffix, sign, acting_pose=False)
                after_pronation = elbow(target, suffix, forward)-neutral[suffix]
                assert abs(after_pronation-control[-1]) < 1e-3
                pronated_controls.append({'flex_deg': angle, 'signed_elbow_delta_after_pronation_deg': after_pronation, **proof})
            assert control[0] > 19.5 and control[1] < -19.5, control
            sign_controls[suffix] = {'forward20_delta_deg': control[0], 'backward_negative20_delta_deg': control[1],
                                    'same_geometry_with_anatomical_pronation': pronated_controls}
        rest(target)
        result['rig'] = {'bones': 61, 'hierarchy': parents, 'weighted_finger_sums': weighted,
                         'forearm_pronation_weight_sums': arm_weights,
                         'bind_elbow_signed_deg': neutral,
                         'anatomical_axes': {'up': list(up), 'side': list(side), 'forward': list(forward)},
                         'actual_rig_backward_axis_negative_control': sign_controls}
        result['scaling'] = {'provider_to_own_original_uniform_scale': restoration_scale,
                             'motion_reference_height_m': source_height, 'own_original_height_m': own_height, 'provider_height_m': provider_height,
                             'formula': 'source_object_scale * (own_original_height/motion_reference_height) / (provider_to_own_original_scale * target_object_scale)',
                             'source_xyz_to_target_factor': factor, 'source_object_scale': list(ss), 'target_object_scale': list(ts),
                             'geometry_bind_or_object_transform_correction_applied': False, 'surface_translation_applied_to_motion_deltas': False,
                             'native_gameplay_import_scale_required': None}
        source_samples = {}
        for kind, path, count in (('walk', working['walk_fbx'], 32), ('run', working['run_fbx'], 20), ('jump', copied/'jump.fbx', 37)):
            reset(); source = imported(path, True)
            assert hierarchy(source) == source_hierarchy
            source_reference = reference_error(source, sb)
            source_reference['world_head_m'] = max((source.matrix_world @ b.head_local-source_object @ sb[b.name].translation).length for b in source.data.bones)
            source_reference['basis_matrix'] = max(abs(v) for b in source.data.bones for row in b.matrix_local.to_3x3()-sb[b.name].to_3x3() for v in row)
            # Source24 armatures use centimetre-sized local units; compare heads in world metres.
            source_scale_limit = REFERENCE_SCALE_LIMIT if kind == 'jump' else 1e-5
            assert source_reference['basis_matrix'] < 2e-5 and source_reference['angle_rad'] < 1e-4 and source_reference['scale'] < source_scale_limit and source_reference['world_head_m'] < 1e-5, source_reference
            clip_bind = bind_snapshot(source)
            assert merror(source.matrix_world, source_object) < 1e-5
            first, last = source.animation_data.action.frame_range; assert abs(last-first-count+1) < 1e-5
            binary = clock(path, count-1)
            rows = []
            for i in range(count):
                frame(first+i)
                assert merror(source.matrix_world, source_object) < 1e-7
                rows.append({'delta': {t: (transport @ (source.pose.bones[s].matrix.to_quaternion().normalized() @ clip_bind[s].to_quaternion().normalized().inverted()) @ transport.inverted()).normalized() for s, t in MAPPING.items()},
                             'hip': (transport @ (source.pose.bones['Hips'].matrix.translation-clip_bind['Hips'].translation))*factor})
            source_samples[kind] = rows
            result.setdefault('source_clips', {})[kind] = {'path': str(path), 'source_range': [first, last], 'binary_fbx': binary,
                                                         'own_body_reference_error': source_reference}
        idle_entry, endpoint_poses = None, {}
        lower_body = {'pelvis'} | {n for n in tb if n.startswith(('thigh_', 'calf_', 'foot_', 'ball_'))}
        authored_upper = set(tb)-lower_body-{'root'}-{n for n in tb if '_twist_' in n}
        # Compare inherited legs between two actual fresh exports, as in the frozen v4 verifier.
        reset(); baseline = imported(working['provider_fbx'], False); rest(baseline); baseline.name = 'Armature'
        previous = {}
        for i, row in enumerate(source_samples['jump']):
            frame(i+1); retarget(baseline, row, {n: Quaternion() for n in FINGERS}); key_pose(baseline, i+1)
        baseline_path = work/'retargeted-jump.fbx'
        baseline_expected = export_clip(baseline, baseline_path, 37)
        baseline_clock = clock(baseline_path, 36, canonical=True)
        reset(); baseline = imported(baseline_path, True)
        assert hierarchy(baseline) == parents; check_reference(reference_error(baseline, tb))
        baseline_first = baseline.animation_data.action.frame_range[0]
        fresh_lower = []; baseline_error = baseline_raw_error = 0.
        baseline_bind = bind_snapshot(baseline)
        for i, wanted in enumerate(baseline_expected):
            frame(baseline_first+i/2)
            fresh_lower.append({n: baseline.pose.bones[n].matrix.copy() for n in lower_body})
            adjusted = poses_in_fresh_reference(wanted, tb, baseline_bind, parents)
            baseline_raw_error = max(baseline_raw_error, max(merror(b.matrix, wanted[b.name]) for b in baseline.pose.bones))
            baseline_error = max(baseline_error, max(merror(b.matrix, adjusted[b.name]) for b in baseline.pose.bones))
        result['fresh_jump_retarget_baseline'] = {'path': str(baseline_path), 'sha256': digest(baseline_path),
            'binary_fbx': baseline_clock, 'half_frame_samples': len(fresh_lower), 'raw_roundtrip_matrix_error': baseline_raw_error,
            'reference_aware_pose_matrix_error': baseline_error}
        assert baseline_error < 2e-5
        for kind, count in (('idle', 121), ('jump', 37), ('walk', 32), ('run', 20)):
            scene = reset(); target = imported(working['provider_fbx'], False); rest(target); target.name = 'Armature'
            assert target.name == 'Armature' and hierarchy(target) == parents
            scene.frame_start, scene.frame_end = 1, count
            previous, in_memory_leg_error = {}, 0.
            pronation_samples = []
            for i in range(count):
                frame(i+1)
                if kind == 'idle':
                    for b in target.pose.bones: b.matrix_basis.identity()
                else:
                    retarget(target, source_samples[kind][i], idle_entry)
                if kind == 'jump': retarget_lower = {n: target.pose.bones[n].matrix.copy() for n in lower_body}
                if kind in ('idle', 'jump'): pronation_samples.append(acting(target, kind, i/30))
                bpy.context.view_layer.update()
                if kind == 'jump': in_memory_leg_error = max(in_memory_leg_error, max(merror(target.pose.bones[n].matrix, retarget_lower[n]) for n in lower_body))
                key_pose(target, i+1)
                if kind == 'idle' and i == 0:
                    idle_entry = {n: target.pose.bones[n].rotation_quaternion.copy() for n in FINGERS}
            action = target.animation_data.action; action.name = 'tripo-cast-'+kind
            pronation_step = pronation_loop = 0.
            if pronation_samples:
                def angular_difference(a, b): return abs((a-b+180)%360-180)
                fields = ('forearm_roll_deg', 'distal_twist_and_hand_roll_deg', 'residual_wrist_roll_deg')
                pronation_step = max(angular_difference(a[s][key], b[s][key]) for a, b in zip(pronation_samples, pronation_samples[1:]) for s in ('l', 'r') for key in fields)
                pronation_loop = max(angular_difference(pronation_samples[0][s][key], pronation_samples[-1][s][key]) for s in ('l', 'r') for key in fields)
                assert pronation_step < (3 if kind == 'idle' else 20) and pronation_loop < 1e-3
            path = output/(kind+'.fbx')
            expected = export_clip(target, path, count)
            binary = clock(path, count-1, canonical=True)
            reset(); rig = imported(path, True)
            assert rig.name == 'Armature' and not any(o.type == 'MESH' for o in bpy.context.scene.objects) and hierarchy(rig) == parents
            reference = reference_error(rig, tb); check_reference(reference)
            fresh_bind = bind_snapshot(rig)
            fresh_local_bind = {b.name: b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local.copy() for b in rig.data.bones}
            first, last = rig.animation_data.action.frame_range; assert abs(last-first-count+1) < 1e-5
            matrix_err = rotation_err = hip_err = scale_err = translation_err = root_err = object_err = norm_err = finger_err = leg_err = mapped_err = 0.
            raw_matrix_err = raw_rotation_err = raw_local_scale_err = raw_local_translation_err = 0.
            maximum_step = max_authored_step = 0.; min_elbow = min_elbow_signed = float('inf'); prev = None
            temporal = {n: 0. for n in ARMS | FINGERS}; finger_relax = {}; elbow_samples = []; palm_entry = {}
            minimum_palm_inward = float('inf')
            for i, wanted in enumerate(expected):
                frame(first+i/2)
                adjusted_poses = poses_in_fresh_reference(wanted, tb, fresh_bind, parents)
                poses = {b.name: b.matrix.copy() for b in rig.pose.bones}
                locals_now = {b.name: b.parent.matrix.inverted() @ b.matrix if b.parent else b.matrix.copy() for b in rig.pose.bones}
                if kind in ('idle', 'jump'):
                    for suffix, sign in (('l', 1), ('r', -1)):
                        delta = poses['hand_'+suffix].to_quaternion() @ tb['hand_'+suffix].to_quaternion().inverted()
                        minimum_palm_inward = min(minimum_palm_inward, (delta @ palms[suffix]).dot(-sign*side))
                if i == 0:
                    start, first_local, object0 = poses, locals_now, rig.matrix_world.copy()
                    finger_relax = {n: math.degrees(qerror(locals_now[n].to_quaternion(), tl[n].to_quaternion())) for n in FINGERS}
                    for suffix, sign in (('l', 1), ('r', -1)):
                        hand_delta = poses['hand_'+suffix].to_quaternion() @ tb['hand_'+suffix].to_quaternion().inverted()
                        palm_entry[suffix] = (hand_delta @ palms[suffix]).dot(-sign*side)
                for b in rig.pose.bones:
                    assert all(math.isfinite(v) for row in b.matrix for v in row) and all(math.isfinite(v) for v in b.rotation_quaternion)
                    assert b.rotation_quaternion.magnitude > 1e-8
                    adjusted = adjusted_poses[b.name]
                    raw_matrix_err = max(raw_matrix_err, merror(b.matrix, wanted[b.name])); raw_rotation_err = max(raw_rotation_err, qerror(b.matrix.to_quaternion(), wanted[b.name].to_quaternion()))
                    matrix_err = max(matrix_err, merror(b.matrix, adjusted)); rotation_err = max(rotation_err, qerror(b.matrix.to_quaternion(), adjusted.to_quaternion()))
                    loc, rot, scale = locals_now[b.name].decompose(); rloc, rrot, rscale = fresh_local_bind[b.name].decompose()
                    if b.name != 'pelvis':
                        translation_err = max(translation_err, (loc-rloc).length)
                        raw_local_translation_err = max(raw_local_translation_err, (loc-tl[b.name].translation).length)
                    scale_err = max(scale_err, max(abs(a-c) for a, c in zip(scale, rscale)))
                    raw_local_scale_err = max(raw_local_scale_err, max(abs(a-c) for a, c in zip(scale, tl[b.name].to_scale())))
                    norm_err = max(norm_err, abs(b.matrix.to_quaternion().magnitude-1))
                    if i % 2 == 0: norm_err = max(norm_err, abs(b.rotation_quaternion.magnitude-1))
                    if b.name in temporal: temporal[b.name] = max(temporal[b.name], math.degrees(qerror(rot, first_local[b.name].to_quaternion())))
                    if kind in ('walk', 'run') and b.name in FINGERS: finger_err = max(finger_err, qerror(rot, rrot @ idle_entry[b.name]))
                    if prev:
                        for q, oldq in ((rot, prev[b.name][0]), (b.matrix.to_quaternion(), prev[b.name][1])):
                            step = math.degrees(qerror(q, oldq))*2
                            maximum_step = max(maximum_step, step)
                            if b.name in authored_upper: max_authored_step = max(max_authored_step, step)
                if kind != 'idle' and i % 2 == 0:
                    hip_err = max(hip_err, (poses['pelvis'].translation-tb['pelvis'].translation-source_samples[kind][i//2]['hip']).length)
                    if kind != 'jump':
                        mapped_err = max(mapped_err, max(qerror(poses[n].to_quaternion(), source_samples[kind][i//2]['delta'][n] @ virtual[n]) for n in MAPPING.values()))
                        assert mapped_err < 1e-4
                if kind == 'jump': leg_err = max(leg_err, max(merror(poses[n], fresh_lower[i][n]) for n in lower_body))
                signed = {s: elbow(rig, s, forward) for s in ('l', 'r')}
                min_elbow_signed = min(min_elbow_signed, *signed.values())
                elbows = {s: signed[s]-neutral[s] for s in ('l', 'r')}
                elbow_samples.append(elbows); min_elbow = min(min_elbow, *elbows.values())
                root_err = max(root_err, merror(poses['root'], tb['root'])); object_err = max(object_err, merror(rig.matrix_world, object0))
                prev = {n: (m.to_quaternion(), poses[n].to_quaternion()) for n, m in locals_now.items()}
            seam_matrix = max(merror(poses[n], start[n]) for n in tb)
            seam_angle = max(qerror(poses[n].to_quaternion(), start[n].to_quaternion()) for n in tb)
            endpoint_poses[kind] = start
            metrics = {'reference': reference, 'half_frame_pose_matrix_error': matrix_err, 'half_frame_pose_rotation_error_rad': rotation_err,
                       'pose_comparison': 'Expected evaluated local animation basis rebuilt through the fresh imported bind hierarchy; provider data unchanged',
                       'half_frame_raw_pose_matrix_error': raw_matrix_err, 'half_frame_raw_pose_rotation_error_rad': raw_rotation_err,
                       'local_scale_error_vs_provider_bind': raw_local_scale_err, 'local_translation_error_vs_provider_bind': raw_local_translation_err,
                       'dynamic_local_baseline': 'Fresh imported bind; immutable provider/reference error is separately gated and reported',
                       'hip_xyz_error_target_units': hip_err, 'local_translation_error': translation_err, 'local_scale_error': scale_err,
                       'root_matrix_error': root_err, 'object_matrix_error': object_err, 'key_and_evaluated_quaternion_norm_error': norm_err,
                       'loop_matrix_error': seam_matrix, 'loop_angle_error_rad': seam_angle, 'minimum_elbow_forward_delta_deg': min_elbow,
                       'minimum_elbow_signed_deg': min_elbow_signed,
                       'minimum_palm_inward_dot': minimum_palm_inward if kind in ('idle', 'jump') else None,
                       'maximum_anatomical_pronation_step_deg_per_30Hz_frame': pronation_step,
                       'anatomical_pronation_loop_error_deg': pronation_loop,
                       'maximum_rotation_step_deg_per_30Hz_frame': maximum_step, 'maximum_upper_body_step_deg_per_30Hz_frame': max_authored_step,
                       'jump_inherited_lower_body_matrix_error_half_frames': leg_err, 'jump_acting_in_memory_lower_body_matrix_change': in_memory_leg_error,
                       'gait_mapped_component_delta_error_rad': mapped_err,
                       'gait_finger_baseline_rotation_error_rad': finger_err}
            result['clips'][kind] = {'output': {'path': str(path), 'sha256': digest(path), 'bytes': path.stat().st_size},
                'bones': 61, 'half_frame_samples': len(expected), 'fresh_frame_range': [first, last], 'binary_fbx': binary, 'fps': 30,
                'seconds': (count-1)/30, 'metrics': metrics, 'elbow_forward_delta_samples_half_frames': elbow_samples,
                'finger_entry_local_deviation_deg': finger_relax, 'local_motion_from_entry_deg': temporal, 'entry_palm_inward_dot': palm_entry,
                'forearm_pronation_samples': pronation_samples,
                'neutral_reference_frame_outside_exported_range': 0}
            assert matrix_err < 2e-5 and rotation_err < 1e-4 and hip_err < 1e-5, metrics
            assert translation_err < 1e-5 and scale_err < 1e-5 and root_err < 1e-5 and object_err < 1e-7 and norm_err < 1e-4, metrics
            assert seam_matrix < 1e-5 and seam_angle < 1e-4 and finger_err < 1e-4 and leg_err < 1e-5 and in_memory_leg_error < 1e-5, metrics
            assert (min_elbow >= 14-1e-4 if kind in ('idle', 'jump') else min_elbow_signed >= -.5), metrics
            assert all(v > 1 for v in finger_relax.values()), finger_relax
            if kind in ('idle', 'jump'):
                assert max_authored_step < (3 if kind == 'idle' else 20), metrics
                assert min(palm_entry.values()) >= .85, palm_entry
                assert minimum_palm_inward >= .85, metrics
            if kind == 'idle':
                assert all(temporal['upperarm_'+s] > .25 for s in ('l', 'r')) and sum(v > .1 for n, v in temporal.items() if n in FINGERS) >= 10
        endpoint_error = max(merror(endpoint_poses['idle'][n], endpoint_poses['jump'][n]) for n in tb)
        result['idle_jump_endpoint_matrix_error'] = endpoint_error; assert endpoint_error < 1e-5
        result['passed'] = True
    except Exception as error:
        if hasattr(error, 'correspondence'): result['rejected_source_body_provider_correspondence'] = error.correspondence
        result['errors'].append(traceback.format_exc()); raise
    finally:
        result['retained_inputs_unchanged'] = all(digest(Path(p)) == h for p, h in protected.items())
        result['finished_utc'] = datetime.now(timezone.utc).isoformat()
        (report/'Motion.json').write_text(json.dumps(result, indent=2)+'\n')
        assert result['retained_inputs_unchanged'], 'Pinned source/helper changed'
    print('TRIPO_CAST_MOTION_PASS', str(report/'Motion.json'), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manifest', 'output', 'report'): parser.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    prepare(args.manifest.resolve(), args.output.resolve(), args.report.resolve())


if __name__ == '__main__':
    main()
