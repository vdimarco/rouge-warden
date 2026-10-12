"""Capture all eight actual player styles in PIE; no saved-world or asset edits.

Run with -ExecutePythonScript=ABS_PATH [-NordQuality1920]. Default is 1280x720;
1920 mode is 1920x1080. Native movement/sprint/jump functions drive the possessed
pawn. Pausing preserves its observed apex/landing pose only while taking a shot.
Seven views include frontal and 35-degree three-quarter face close-ups.
This checks native gameplay callbacks, not physical keyboard delivery or networking.
ImageMagick verifies the imported atlas source pixels against the retained PNG.
-NordNeutralCandidate tests only style 9 from CrewNeutral/CharactersNeutral by
swapping the live pawn's mesh and clips in PIE, with separate output and reports.
"""
import configparser
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import time
import traceback

import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
COMMAND_LINE = u.SystemLibrary.get_command_line()
NEUTRAL_CANDIDATE = '-NordNeutralCandidate' in COMMAND_LINE
WIDTH, HEIGHT = (1920, 1080) if '-NordQuality1920' in COMMAND_LINE else (1280, 720)
OUT = ROOT / 'Preview' / f'{"NeutralCandidate" if NEUTRAL_CANDIDATE else "PlayerQuality"}{WIDTH}'
OUT.mkdir(parents=True, exist_ok=True)
VERIFY = ROOT / 'Verification' / ('NeutralCandidate' if NEUTRAL_CANDIDATE else 'PlayerQuality')
VERIFY.mkdir(parents=True, exist_ok=True)
ATLASES = ROOT / 'Saved' / 'Tests' / ('ImportedAtlasesNeutral' if NEUTRAL_CANDIDATE else 'ImportedAtlases')
ATLASES.mkdir(parents=True, exist_ok=True)
NAMES = {3: 'GreenCap51', 4: 'Memphis33', 5: 'BlackCap', 6: 'WhiteCap',
         7: 'RedJersey', 8: 'LimeJacket', 9: 'CurlyMetalhead', 10: 'Topknot'}
STYLES = (9,) if NEUTRAL_CANDIDATE else tuple(NAMES)
SOURCE = ROOT / 'Data' / 'CharactersNeutral'
CREW_PATH = '/Game/ParkComic/' + ('CrewNeutral' if NEUTRAL_CANDIDATE else 'Crew')
BONES = ('Hips', 'Head', 'headfront', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot')
BUILD_EXPECTED={'recompute_normals':False,'recompute_tangents':True,'use_mikk_t_space':True,
                'compute_weighted_normals':False,'use_full_precision_u_vs':True,'use_high_precision_tangent_basis':True}
MANIFEST = {row['file']: row['sha256'] for row in json.loads((SOURCE / 'files.json').read_text())}
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
SCRIPT = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
SYSTEM = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
GAMEPLAY = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
ORIGINAL = {key: SETTINGS.get_editor_property(key) for key in ('PlayNumberOfClients', 'RunUnderOneProcess')}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(Path(u.Paths.project_saved_dir()) / 'Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    CONFIG.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
REPORT = {'passed': False, 'resolution': [WIDTH, HEIGHT],
          'mode': 'actual possessed pawn; native MoveForward, StartSprint/StopSprint and Jump/StopJumping callbacks',
          'setup': 'PIE-only relocation to a clear soccer pitch; input disabled to prevent zero-axis overrides; Walk/Run and descent observation use 0.25 global time dilation; native jump liftoff/apex use original timing; landing camera prepared during descent and frozen on first observed recoil pose',
          'captures': 'actual gameplay poses; world paused only for screenshot completion',
          'not_checked': ['physical keyboard delivery', 'native C-key crew selection (covered separately by smoke_test)', 'external networking', 'exact likeness to the supplied photographs',
                          'pixel identity after BC7 GPU compression, lighting and postprocessing'],
          'characters': [], 'screenshots': []}
REPORT['asset_selection'] = {'candidate': NEUTRAL_CANDIDATE, 'styles': list(STYLES),
                            'source': str(SOURCE.relative_to(ROOT)), 'asset_folder': CREW_PATH,
                            'pie_mesh_and_clip_overrides': NEUTRAL_CANDIDATE}
STATE = {'phase': 'boot', 'started': time.monotonic(), 'finished': False}


def vec(value):
    return [round(value.x, 5), round(value.y, 5), round(value.z, 5)]


def quat(value):
    return [round(value.x, 6), round(value.y, 6), round(value.z, 6), round(value.w, 6)]


def inside_pitch(position, points):
    inside = False
    for a, b in zip(points, points[1:] + points[:1]):
        if (a[1] > position.y) != (b[1] > position.y):
            crossing_x = a[0] + (position.y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if position.x < crossing_x:
                inside = not inside
    return inside


def clock():
    return u.GameplayStatics.get_time_seconds(STATE['world'])


def phase(name):
    if name in ('walk', 'descend'):
        # A ~12 FPS editor cannot resolve 12 Hz holds. Slow world time while
        # preserving native movement and animation rates per observed world second.
        u.GameplayStatics.set_global_time_dilation(STATE['world'], .25)
    elif name in ('settle', 'recover'):
        u.GameplayStatics.set_global_time_dilation(STATE['world'], STATE['original_time_dilation'])
    if name == 'descend':
        STATE['descent_camera_frames'] = 0
    STATE.update(phase=name, phase_started=clock())


def native(name):
    # Invoke after Python's execution guard exits, matching the native input callback.
    u.SystemLibrary.set_timer_for_next_tick(STATE['pawn'], name)


def aim(face=False, grounded=False, three_quarter=False):
    pawn = STATE['pawn']
    p = pawn.get_actor_location() - u.Vector(0, 0, 96)
    front, right = pawn.get_actor_forward_vector(), pawn.get_actor_right_vector()
    if grounded:
        p = STATE['jump_origin'] - u.Vector(0, 0, 96)
        front, right = STATE['jump_front'], STATE['jump_right']
    if face:
        # The idle clip turns the head. Follow its retained forward marker instead
        # of photographing a profile from the actor's movement direction.
        head = STATE['mesh'].get_socket_location('Head')
        face_center = STATE['mesh'].get_socket_location('headfront')
        crown = STATE['mesh'].get_socket_location('head_end')
        target = (face_center + crown) * .5
        direction = face_center - head
        width = math.hypot(direction.x, direction.y)
        assert width > .1, 'Missing headfront marker for face camera'
        front = u.Vector(direction.x / width, direction.y / width, 0)
        if three_quarter:
            angle = math.radians(35.)
            front = u.Vector(front.x * math.cos(angle) - front.y * math.sin(angle),
                             front.x * math.sin(angle) + front.y * math.cos(angle), 0)
        position = target + front * 125 + u.Vector(0, 0, 3)
    else:
        target = p + u.Vector(0, 0, 100)
        position = p + front * 500 + right * 65 + u.Vector(0, 0, 130)
    delta = target - position
    rotation = u.Rotator(pitch=math.degrees(math.atan2(delta.z, math.hypot(delta.x, delta.y))),
                         yaw=math.degrees(math.atan2(delta.y, delta.x)))
    STATE['camera'].set_actor_location_and_rotation(position, rotation, False, True)
    STATE['camera'].get_component_by_class(u.CameraComponent).set_editor_property('field_of_view', 38. if face else 60.)


def sample():
    pawn, mesh = STATE['pawn'], STATE['mesh']
    asset = mesh.get_anim_instance().get_animation_asset()
    bones = {}
    for name in BONES:
        transform = mesh.get_socket_transform(name, u.RelativeTransformSpace.RTS_COMPONENT)
        bones[name] = {'translation_cm': vec(transform.translation), 'rotation_xyzw': quat(transform.rotation)}
    return {'world_time': round(clock(), 5), 'clip': asset.get_name() if asset else None,
            'clip_path': asset.get_path_name() if asset else None,
            'clip_time': round(mesh.get_position(), 5), 'location_cm': vec(pawn.get_actor_location()),
            'velocity_cm_s': vec(pawn.get_velocity()), 'falling': STATE['movement'].is_falling(),
            'mesh_relative_cm': vec(mesh.get_editor_property('relative_location')), 'bones': bones}


def capture(label, next_phase):
    if label == 'Landing':
        # Ground-level framing has already rendered during descent. Preserve the
        # first native recoil pose immediately; two more frames can outlast it.
        assert STATE['descent_camera_frames'] >= 2, 'Landing camera was not prepared during descent'
        STATE.update(capture_label=label, next_phase=next_phase, prepare_frames=STATE['descent_camera_frames'])
        freeze_and_capture()
        return
    # PlayerCameraManager caches the view before this Slate callback. Allow two
    # unpaused frames to consume the new camera/FOV before preserving its pose.
    aim(label in ('Face', 'FaceThreeQuarter'), three_quarter=label == 'FaceThreeQuarter')
    STATE.update(capture_label=label, next_phase=next_phase, prepare_frames=0)
    phase('prepare_shot')


def freeze_and_capture():
    label = STATE['capture_label']
    record = sample()
    expected = {'Idle': 'A_Idle', 'Face': 'A_Idle', 'FaceThreeQuarter': 'A_Idle', 'Walk': 'A_Walk', 'Run': 'A_Run',
                'Airborne': 'A_Jump', 'Landing': 'A_Jump'}[label]
    assert record['clip'] == expected, (STATE['style'], label, record['clip'])
    assert record['clip_path'].startswith(f'{CREW_PATH}/Resident{STATE["style"]}/'), (label, 'wrong source clip', record['clip_path'])
    manager = u.GameplayStatics.get_player_camera_manager(STATE['world'], 0)
    assert inside_pitch(STATE['pawn'].get_actor_location(), STATE['pitch_points']), (label, 'pawn left capture pitch')
    assert inside_pitch(manager.get_camera_location(), STATE['pitch_points']), (label, 'camera crossed capture pitch fence')
    expected_fov = 38. if label in ('Face', 'FaceThreeQuarter') else 60.
    assert abs(manager.get_fov_angle() - expected_fov) < .1, (label, 'cached camera FOV did not refresh', manager.get_fov_angle())
    if label == 'Landing':
        cached, intended = vec(manager.get_camera_location()), vec(STATE['camera'].get_actor_location())
        assert math.dist(cached, intended) < .1, ('Landing camera view did not refresh', cached, intended)
    camera_rotation = manager.get_camera_rotation()
    record['cached_camera'] = {'position_cm': vec(manager.get_camera_location()),
                                'rotation_degrees': [camera_rotation.pitch, camera_rotation.yaw, camera_rotation.roll],
                                'horizontal_fov_degrees': manager.get_fov_angle(), 'unpaused_prepare_frames': STATE['prepare_frames']}
    if label in ('Face', 'FaceThreeQuarter'):
        record['cached_camera'].update(face_orbit_degrees=35. if label == 'FaceThreeQuarter' else 0.,
                                       face_horizontal_distance_cm=125.)
    STATE['character']['states'][label] = record
    assert u.GameplayStatics.set_game_paused(STATE['world'], True), 'Cannot preserve observed pose for screenshot'
    path = OUT / f"Resident{STATE['style']}_{label}.png"
    path.unlink(missing_ok=True)
    u.SystemLibrary.execute_console_command(STATE['world'], f'HighResShot {WIDTH}x{HEIGHT} filename="{path}"', STATE['pc'])
    STATE.update(phase='shot', shot_path=path, shot_started=time.monotonic())


def rgb_hash(path):
    # TextureExporterPNG exports the saved TextureSource, before BC7 GPU compression.
    result = subprocess.run([shutil.which('magick'), str(path), '-alpha', 'off', '-depth', '8', 'rgb:-'],
                            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25)
    assert len(result.stdout) == 2048 * 2048 * 3, (path, len(result.stdout))
    return hashlib.sha256(result.stdout).hexdigest()


def validate_assets(style):
    folder = f'{CREW_PATH}/Resident{style}'
    mesh = u.load_asset(folder + '/SK_Body')
    clips = {kind: u.load_asset(folder + '/A_' + kind) for kind in ('Idle', 'Walk', 'Run', 'Jump')}
    result = {'style': style, 'name': NAMES[style], 'states': {}, 'jump_samples': [], 'locomotion_samples': {'Walk': [], 'Run': []}, 'clips': {}}
    REPORT['active_character'] = result
    # Editor subsystem getters reject PIE. These flags were checked on the saved
    # assets before beginning play; assets are not edited during this capture.
    result['mesh_build_flags']=STATE['mesh_build_flags'][style]
    for kind, clip in clips.items():
        assert isinstance(clip, u.AnimSequence), (style, kind)
        assert clip.get_editor_property('skeleton') == mesh.get_editor_property('skeleton'), (style, kind, 'wrong skeleton')
        assert not clip.get_editor_property('enable_root_motion'), (style, kind, 'root motion enabled')
        if kind in ('Walk', 'Run'):
            assert clip.get_editor_property('force_root_lock'), (style, kind, 'unlocked locomotion root')
        length = clip.get_play_length()
        # Hips is a child of an FBX armature whose local axes may differ from UE's
        # Z-up component axes. Measure component-space XY and Z separately. Imported
        # loops can omit the duplicated endpoint, leaving one sample of ordinary bob.
        frame_period = length / max(1, u.AnimationLibrary.get_num_frames(clip))
        def pelvis_at(seconds):
            pose = u.AnimPoseExtensions.get_anim_pose_at_time(clip, seconds, u.AnimPoseEvaluationOptions())
            return u.AnimPoseExtensions.get_bone_pose(pose, 'Hips', u.AnimPoseSpaces.WORLD).translation
        first, second = pelvis_at(0.), pelvis_at(frame_period)
        last, previous = pelvis_at(max(0., length - .00001)), pelvis_at(max(0., length - frame_period))
        delta, first_step, last_step = last - first, second - first, last - previous
        horizontal = math.hypot(delta.x, delta.y)
        vertical = abs(delta.z)
        horizontal_tolerance = max(.5, min(2., 1.5 * max(math.hypot(first_step.x, first_step.y), math.hypot(last_step.x, last_step.y)) + .05))
        vertical_tolerance = max(.5, min(5., 1.5 * max(abs(first_step.z), abs(last_step.z)) + .05))
        result['clips'][kind] = {'seconds': round(length, 6), 'sample_period_seconds': round(frame_period, 6),
                                 'net_pelvis_horizontal_cm': round(horizontal, 6), 'vertical_loop_closure_cm': round(vertical, 6),
                                 'horizontal_closure_tolerance_cm': round(horizontal_tolerance, 6),
                                 'vertical_closure_tolerance_cm': round(vertical_tolerance, 6),
                                 'closure_rule': 'one boundary sample of cyclic bob, capped at 2cm XY and 5cm Z; live actor drift checked independently',
                                 'root_motion': False, 'force_root_lock': bool(clip.get_editor_property('force_root_lock'))}
        assert horizontal < horizontal_tolerance, (style, kind, 'horizontal clip pelvis closure cm', horizontal, horizontal_tolerance)
        assert vertical < vertical_tolerance, (style, kind, 'vertical bob loop closure cm', vertical, vertical_tolerance)
    differences = []
    for fraction in (.1, .25, .4, .6, .75, .9):
        walk = u.AnimationLibrary.get_bone_pose_for_time(clips['Walk'], 'LeftLeg', clips['Walk'].get_play_length() * fraction, False)
        run = u.AnimationLibrary.get_bone_pose_for_time(clips['Run'], 'LeftLeg', clips['Run'].get_play_length() * fraction, False)
        differences.append(walk.rotation.angular_distance(run.rotation))
    assert max(differences) > .2, (style, 'run and walk knee tracks do not differ')
    result['walk_run_knee_difference_degrees'] = round(math.degrees(max(differences)), 3)
    material = mesh.get_editor_property('materials')[0].material_interface
    base = u.MaterialEditingLibrary.get_material_property_input_node(material, u.MaterialProperty.MP_BASE_COLOR)
    texture = base.get_editor_property('texture')
    assert texture.get_path_name().startswith(folder + '/T_base_color'), (style, 'wrong atlas')
    assert texture.get_editor_property('compression_settings') == u.TextureCompressionSettings.TC_BC7
    source = SOURCE / NAMES[style] / 'base_color.png'
    original_hash = MANIFEST[NAMES[style] + '/base_color.png']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == original_hash, (style, 'retained texture changed')
    exported = ATLASES / f'Resident{style}_ImportedAtlas.png'
    task = u.AssetExportTask()
    task.object = texture
    task.filename = str(exported)
    task.automated = True
    task.prompt = False
    task.replace_identical = True
    task.exporter = u.TextureExporterPNG()
    assert u.Exporter.run_asset_export_task(task), (style, 'atlas export failed')
    source_pixels, imported_pixels = rgb_hash(source), rgb_hash(exported)
    assert source_pixels == imported_pixels, (style, 'imported atlas pixels changed')
    result['face_texture'] = {'source_sha256': original_hash, 'source_rgb_sha256': source_pixels,
                              'imported_rgb_sha256': imported_pixels, 'identical_source_pixels': True,
                              'texture': texture.get_path_name(), 'compression': 'BC7',
                              'source_dimensions': [2048, 2048], 'prior_render': 'Preview/SkullShirtFace.png' if style == 9 else None}
    return result


def stop_fixture_motion():
    # StopMovementImmediately zeroes velocity, but does not clear input queued by
    # the final unpaused locomotion frame before its screenshot paused the world.
    STATE['pawn'].consume_movement_input_vector()
    STATE['movement'].stop_movement_immediately()


def start_style(style):
    STATE['style'] = style
    STATE['character'] = validate_assets(style)
    pawn = STATE['pawn']
    stop_fixture_motion()
    pawn.set_actor_location_and_rotation(STATE['origin'], u.Rotator(), False, True)
    STATE['pc'].set_control_rotation(u.Rotator())
    # CrewStyle is intentionally VisibleAnywhere/read-only to normal Python setters.
    # This fixture selects a model through reflection; smoke_test covers native C-key cycling.
    SYSTEM.call_method('SetIntPropertyByName', (pawn, 'CrewStyle', style))
    pawn.call_method('ApplyCrewAppearance')
    STATE['mesh'] = pawn.get_component_by_class(u.SkeletalMeshComponent)
    if NEUTRAL_CANDIDATE:
        # Preserve the native pawn and Tick/callback behavior; override assets only
        # in this standalone PIE fixture until the pilot is accepted for promotion.
        folder = f'{CREW_PATH}/Resident{style}'
        body = u.load_asset(folder + '/SK_Body')
        STATE['mesh'].set_skinned_asset_and_update(body, True)
        for kind in ('Idle', 'Walk', 'Run', 'Jump'):
            SYSTEM.call_method('SetObjectPropertyByName', (pawn, 'Crew' + kind, u.load_asset(folder + '/A_' + kind)))
        SYSTEM.call_method('SetObjectPropertyByName', (pawn, 'CrewAnimation', None))
        assert STATE['mesh'].get_skeletal_mesh_asset() == body
    assert STATE['mesh'].get_editor_property('custom_depth_stencil_value') == 255
    native('StopSprint')
    phase('idle')


def record_jump():
    item = sample()
    samples = STATE['character']['jump_samples']
    if not samples or item['world_time'] - samples[-1]['world_time'] >= .025:
        samples.append(item)
    STATE['seen_falling'] |= item['falling']
    return item


def record_locomotion(kind):
    # Observe real steady movement rather than inspecting the implementation's clock.
    pawn, mesh = STATE['pawn'], STATE['mesh']
    speed = math.hypot(pawn.get_velocity().x, pawn.get_velocity().y)
    asset = mesh.get_anim_instance().get_animation_asset()
    if not asset or asset.get_name() != 'A_' + kind or abs(speed - (450 if kind == 'Walk' else 800)) > 5:
        return
    samples = STATE['character']['locomotion_samples'][kind]
    now = clock()
    if samples and now - samples[-1]['world_time'] < .0001:
        return
    samples.append({'world_time': now, 'clip_time': mesh.get_position(), 'speed_cm_s': speed,
                    'actor_cm': vec(pawn.get_actor_location()),
                    'left_foot_component_cm': vec(mesh.get_socket_transform('LeftFoot', u.RelativeTransformSpace.RTS_COMPONENT).translation)})


def validate_locomotion():
    result = {}
    for kind, samples in STATE['character']['locomotion_samples'].items():
        assert len(samples) > 5, (kind, 'insufficient steady movement samples', len(samples))
        duration = samples[-1]['world_time'] - samples[0]['world_time']
        assert duration >= .5, (kind, 'steady movement observation too short', duration)
        length = STATE['character']['clips'][kind]['seconds']
        held = changes = moving_holds = 0
        last_change = None
        largest_advance = 0.
        for previous, item in zip(samples, samples[1:]):
            if abs(item['clip_time'] - previous['clip_time']) < .00001:
                held += 1
                foot_change = math.dist(item['left_foot_component_cm'], previous['left_foot_component_cm'])
                assert foot_change < .002, (kind, 'bone moved during a held pose', foot_change)
                if math.dist(item['actor_cm'], previous['actor_cm']) > .1:
                    moving_holds += 1
            else:
                changes += 1
                if last_change:
                    advance = (item['clip_time'] - last_change['clip_time']) % length
                    elapsed = item['world_time'] - last_change['world_time']
                    # No wrap or acceleration can legitimately skip more than twice
                    # elapsed world time; allow 30 ms for sampling/compression error.
                    assert 0 < advance <= 2 * elapsed + .03, (kind, 'phase jumped forward/backward', advance, elapsed)
                    largest_advance = max(largest_advance, advance)
                last_change = item
        update_hz = changes / duration
        result[kind] = {'observed_world_seconds': round(duration, 4), 'samples': len(samples),
                        'render_samples_per_world_second': round((len(samples) - 1) / duration, 3),
                        'observation_global_time_dilation': .25,
                        'held_pose_pairs': held, 'held_pairs_with_continuous_actor_motion': moving_holds,
                        'pose_changes': changes, 'pose_changes_per_world_second': round(update_hz, 3),
                        'largest_forward_phase_advance_seconds': round(largest_advance, 5)}
        assert held > 0 and moving_holds > 0, (kind, 'no visible pose holds while the actor moves', result[kind])
        assert 8.5 <= update_hz <= 15.5, (kind, 'pose cadence differs from approximately 12 Hz', result[kind])
    STATE['character']['observed_locomotion_cadence'] = result


def validate_motion():
    row = STATE['character']
    validate_locomotion()
    states, samples = row['states'], row['jump_samples']
    assert set(states) == {'Idle', 'Face', 'FaceThreeQuarter', 'Walk', 'Run', 'Airborne', 'Landing'}
    assert states['Walk']['velocity_cm_s'][0] > 400 and states['Run']['velocity_cm_s'][0] > 700
    assert states['Airborne']['falling'] and not states['Landing']['falling']
    assert states['Airborne']['clip_time'] > .3 and states['Landing']['clip_time'] >= .9
    peak = max(item['location_cm'][2] for item in samples) - STATE['jump_origin'].z
    horizontal = max(math.hypot(item['location_cm'][0] - STATE['jump_origin'].x,
                                item['location_cm'][1] - STATE['jump_origin'].y) for item in samples)
    assert peak > 120, (STATE['style'], 'native jump too short', peak)
    assert horizontal < .5, (STATE['style'], 'actor horizontal root drift during vertical jump', horizontal)
    hip = [item['bones']['Hips']['translation_cm'] for item in samples]
    hip_range = math.hypot(max(p[0] for p in hip) - min(p[0] for p in hip),
                           max(p[1] for p in hip) - min(p[1] for p in hip))
    # The original pose lowers the pelvis along the rig's Hips-to-Head axis;
    # a leaning rest pose can include a few cm of fore/aft balance. This is
    # skeletal pose motion, distinct from the strictly stationary actor root.
    assert hip_range < 5., (STATE['style'], 'horizontal pelvis balance range cm', hip_range)
    assert all(item['mesh_relative_cm'] == states['Idle']['mesh_relative_cm'] for item in samples)
    a, b = (states[key]['bones']['LeftLeg']['rotation_xyzw'] for key in ('Idle', 'Airborne'))
    knee = 2 * math.acos(min(1., abs(sum(x * y for x, y in zip(a, b)))))
    assert knee > .6, (STATE['style'], 'airborne knee pose is not distinct', knee)
    row['observed_motion'] = {'jump_peak_cm': round(peak, 3), 'actor_horizontal_drift_cm': round(horizontal, 5),
                               'pelvis_horizontal_range_cm': round(hip_range, 5),
                               'pelvis_balance_tolerance_cm': 5., 'actor_drift_tolerance_cm': .5,
                               'airborne_vs_idle_knee_degrees': round(math.degrees(knee), 3),
                               'mesh_relative_transform_stable': True, 'recovered_clip': sample()['clip']}
    assert row['observed_motion']['recovered_clip'] == 'A_Idle'
    REPORT['characters'].append(row)
    REPORT.pop('active_character', None)
    u.log(f'NORD_PLAYER_QUALITY_STYLE_OK {STATE["style"]} {WIDTH}')


def finish(error=None):
    if STATE['finished']:
        return
    STATE['finished'] = True
    if error:
        REPORT['error'] = error
    REPORT['passed'] = not error and len(REPORT['characters']) == len(STYLES) and len(REPORT['screenshots']) == 7 * len(STYLES)
    REPORT['wall_seconds'] = round(time.monotonic() - STATE['started'], 2)
    (VERIFY / f'PlayerQuality{WIDTH}.json').write_text(json.dumps(REPORT, indent=2) + '\n')
    try:
        if STATE.get('world'):
            u.GameplayStatics.set_game_paused(STATE['world'], False)
            u.GameplayStatics.set_global_time_dilation(STATE['world'], STATE['original_time_dilation'])
        LEVELS.editor_request_end_play()
    finally:
        for key, value in ORIGINAL.items():
            SETTINGS.set_editor_property(key, value)
        SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
        u.unregister_slate_post_tick_callback(STATE['callback'])
        SCRIPT.call_method('SetKeepPythonScriptAlive', (False,))
    if REPORT['passed']:
        u.log(f'NORD_PLAYER_QUALITY_OK {len(STYLES)} characters {7 * len(STYLES)} screenshots {WIDTH}x{HEIGHT}')
    else:
        u.log_error('NORD_PLAYER_QUALITY_FAILED ' + str(error))


def tick(dt):
    try:
        assert time.monotonic() - STATE['started'] < 300, 'Capture watchdog expired'
        current = STATE['phase']
        if current == 'boot':
            if time.monotonic() - STATE['started'] < 2:
                return
            assert shutil.which('magick'), 'ImageMagick is required to compare imported texture source pixels'
            assert not u.EditorLevelLibrary.get_pie_worlds(True), 'Begin this capture outside PIE'
            STATE['mesh_build_flags']={}
            REPORT['pre_pie_mesh_build_flags']=STATE['mesh_build_flags']
            for style in STYLES:
                mesh=u.load_asset(f'{CREW_PATH}/Resident{style}/SK_Body')
                assert isinstance(mesh,u.SkeletalMesh),style
                build=u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh,0)
                flags={key:bool(build.get_editor_property(key)) for key in BUILD_EXPECTED}
                STATE['mesh_build_flags'][style]=flags
                assert flags==BUILD_EXPECTED,(style,'saved crew normals/UV build settings',flags)
            u.log(f'NORD_PLAYER_QUALITY_BUILD_FLAGS_OK {len(STYLES)} before PIE')
            SETTINGS.set_editor_property('PlayNumberOfClients', 1)
            SETTINGS.set_editor_property('RunUnderOneProcess', True)
            SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', 0))
            LEVELS.editor_request_begin_play()
            STATE['phase'] = 'discover'
            return
        if current == 'discover':
            worlds = u.EditorLevelLibrary.get_pie_worlds(True)
            if not worlds:
                return
            world = worlds[0]
            pc = u.GameplayStatics.get_player_controller(world, 0)
            if not pc or not pc.get_controlled_pawn():
                return
            pawn = pc.get_controlled_pawn()
            assert pawn.get_class() == u.load_class(None, '/Script/Quebec.QuebecCharacter')
            pawn.disable_input(pc)
            transform = u.Transform(u.Vector(0, 0, 1000))
            camera = GAMEPLAY.call_method('BeginDeferredActorSpawnFromClass', (world, u.CameraActor.static_class(), transform,
                u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN, None, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
            GAMEPLAY.call_method('FinishSpawningActor', (camera, transform, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
            camera.get_component_by_class(u.CameraComponent).set_editor_property('post_process_blend_weight', 1.)
            pc.set_view_target_with_blend(camera, 0)
            u.SystemLibrary.execute_console_command(world, 'showhud', pc)
            layout = json.loads((ROOT / 'Data/ParkComic/layout.json').read_text())
            pitch = max((p for p in layout['pitches'] if p['sport'] == 'soccer'),
                        key=lambda p: abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(p['points'], p['points'][1:]))))
            points = pitch['points'][:-1]
            # Leave room for native Walk + Run travel and the camera 500cm ahead.
            origin = u.Vector(sum(p[0] for p in points) / len(points) - 1000,
                              sum(p[1] for p in points) / len(points), 110)
            assert inside_pitch(origin, points), 'Capture start is outside the selected soccer pitch'
            REPORT['pitch_fixture'] = {'osm': pitch['osm'], 'start_cm': vec(origin),
                                       'offset_from_vertex_average_cm': [-1000, 0, 0],
                                       'clearance_rule': 'captured pawn and camera must remain inside the largest soccer polygon'}
            for kind in ('ParkResident', 'Car'):
                for actor in u.GameplayStatics.get_all_actors_of_class(world, u.load_class(None, '/Script/Quebec.Quebec' + kind)):
                    actor.set_actor_hidden_in_game(True)
                    actor.set_actor_enable_collision(False)
            STATE.update(world=world, pc=pc, pawn=pawn, movement=pawn.get_component_by_class(u.CharacterMovementComponent), camera=camera, origin=origin, pitch_points=points,
                         original_time_dilation=u.GameplayStatics.get_global_time_dilation(world))
            pawn.set_actor_location(origin, False, True)
            phase('warm')
            return
        if current == 'shot':
            path = STATE['shot_path']
            waited = time.monotonic() - STATE['shot_started']
            assert waited < 20, ('Screenshot timed out', str(path))
            if waited < .3 or not path.exists():
                return
            image = path.read_bytes()
            if len(image) < 10000 or not image.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'):
                return
            assert image[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', image[16:24]) == (WIDTH, HEIGHT), str(path)
            REPORT['screenshots'].append(str(path.relative_to(ROOT)))
            u.GameplayStatics.set_game_paused(STATE['world'], False)
            phase(STATE['next_phase'])
            if STATE['phase'] == 'settle':
                stop_fixture_motion()
                native('StopSprint')
            return
        if current == 'prepare_shot':
            label = STATE['capture_label']
            if label in ('Walk', 'Run'):
                STATE['pawn'].call_method('MoveForward', (1.,))
                record_locomotion(label)
            if label in ('Airborne', 'Landing'):
                record_jump()
            aim(label in ('Face', 'FaceThreeQuarter'), three_quarter=label == 'FaceThreeQuarter')
            STATE['prepare_frames'] += 1
            if STATE['prepare_frames'] >= 2:
                freeze_and_capture()
            return
        age = clock() - STATE['phase_started']
        if current == 'warm':
            if age > 12:
                start_style(STYLES[0])
            return
        aim(current in ('face', 'face_three_quarter'), grounded=current == 'descend',
            three_quarter=current == 'face_three_quarter')
        if current == 'descend':
            STATE['descent_camera_frames'] += 1
        assert age < 15, (STATE['style'], current, 'state timed out')
        if current == 'idle' and age > .7 and not STATE['movement'].is_falling():
            capture('Idle', 'face')
        elif current == 'face' and age > .2:
            capture('Face', 'face_three_quarter')
        elif current == 'face_three_quarter' and age > .2:
            capture('FaceThreeQuarter', 'walk')
        elif current in ('walk', 'run'):
            if current == 'run' and not STATE.get('sprint_pending'):
                native('StartSprint')
                STATE['sprint_pending'] = True
            STATE['pawn'].call_method('MoveForward', (1.,))
            record_locomotion('Walk' if current == 'walk' else 'Run')
            speed = STATE['pawn'].get_velocity().x
            if age > 1.15 and speed > (400 if current == 'walk' else 700):
                capture('Walk' if current == 'walk' else 'Run', 'run' if current == 'walk' else 'settle')
        elif current == 'settle' and age > .4 and not STATE['movement'].is_falling():
            stop_fixture_motion()
            STATE.update(jump_origin=STATE['pawn'].get_actor_location(),
                         jump_front=STATE['pawn'].get_actor_forward_vector(), jump_right=STATE['pawn'].get_actor_right_vector(),
                         seen_falling=False, jump_released=False)
            STATE['character']['vertical_jump_fixture'] = {'location_cm': vec(STATE['jump_origin']),
                'velocity_cm_s': vec(STATE['pawn'].get_velocity()), 'pending_input_cleared': True,
                'landing_camera_anchor': 'fixed jump origin and orientation; actor drift asserted independently'}
            native('Jump')
            phase('jump')
        elif current in ('jump', 'descend'):
            item = record_jump()
            if not STATE['jump_released'] and current == 'jump' and age > .15:
                native('StopJumping')
                STATE['jump_released'] = True
            if current == 'jump' and item['falling'] and abs(item['velocity_cm_s'][2]) < 140 and item['location_cm'][2] > STATE['jump_origin'].z + 120:
                capture('Airborne', 'descend')
            elif current == 'descend' and STATE['seen_falling'] and not item['falling'] and item['clip_time'] >= .9 and item['clip'] == 'A_Jump':
                # A held airborne pose can survive the first grounded frame. Wait
                # for an observed landing-recoil pose; its camera is already prepared.
                capture('Landing', 'recover')
        elif current == 'recover' and age > .4:
            validate_motion()
            if STATE['style'] == STYLES[-1]:
                finish()
            else:
                STATE['sprint_pending'] = False
                start_style(STYLES[STYLES.index(STATE['style']) + 1])
    except Exception:
        finish(traceback.format_exc())


SCRIPT.call_method('SetKeepPythonScriptAlive', (True,))
STATE['callback'] = u.register_slate_post_tick_callback(tick)
