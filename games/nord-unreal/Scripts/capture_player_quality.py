"""Capture all eight actual player styles in PIE; no saved-world or asset edits.

Run with -ExecutePythonScript=ABS_PATH [-NordQuality1920]. Default is 1280x720;
1920 mode is 1920x1080. Native movement/sprint/jump functions drive the possessed
pawn. Pausing preserves its observed apex/landing pose only while taking a shot.
Seven views include frontal and 35-degree three-quarter face close-ups.
Steady locomotion checks consecutive observed frames, not a fixed animation FPS.
This checks native gameplay callbacks, not physical keyboard delivery or networking.
ImageMagick verifies the imported atlas source pixels against the retained PNG.
-NordNeutralCandidate tests only style 9 from CrewNeutral/CharactersNeutral by
swapping the live pawn's mesh and clips in PIE, with separate output and reports.
-NordGraphicNovelCandidate selects only the isolated style 9 body/clips/blended graph.
Add -NordGraphicNovelGenerated to inspect the separately imported new body and its own clips.
Add -NordGraphicNovelStandard to review the standard view in a separate output folder.
Add -NordGraphicNovelHeadless for native state/bone checks without rendered evidence.
Add -NordGraphicNovelMotion for separate unpaused 1x native transitions without stills.
Rendered motion with -immersive restarts its single standalone startup PIE once,
calibrates the viewport to the requested pixels, and logs its desktop recording rectangle.
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
GRAPHIC_NOVEL_CANDIDATE = '-NordGraphicNovelCandidate' in COMMAND_LINE
GRAPHIC_NOVEL_GENERATED = '-NordGraphicNovelGenerated' in COMMAND_LINE
HEADLESS = '-NordGraphicNovelHeadless' in COMMAND_LINE
STANDARD = '-NordGraphicNovelStandard' in COMMAND_LINE
MOTION = '-NordGraphicNovelMotion' in COMMAND_LINE
assert not (NEUTRAL_CANDIDATE and GRAPHIC_NOVEL_CANDIDATE), 'Choose one candidate fixture'
assert not GRAPHIC_NOVEL_GENERATED or GRAPHIC_NOVEL_CANDIDATE, 'Generated review requires the graphic-novel candidate'
assert not HEADLESS or GRAPHIC_NOVEL_CANDIDATE, 'Headless mode requires the graphic-novel candidate'
assert not STANDARD or GRAPHIC_NOVEL_CANDIDATE, 'Standard review requires the graphic-novel candidate'
assert not MOTION or GRAPHIC_NOVEL_CANDIDATE, 'Motion review requires the graphic-novel candidate'
WIDTH, HEIGHT = (1920, 1080) if '-NordQuality1920' in COMMAND_LINE else (1280, 720)
OUT = ROOT / 'Preview' / f'{"NeutralCandidate" if NEUTRAL_CANDIDATE else "PlayerQuality"}{WIDTH}'
if GRAPHIC_NOVEL_CANDIDATE:
    capture_root = ROOT / 'Saved/Tests/GraphicNovel' / ('GeneratedCapture' if GRAPHIC_NOVEL_GENERATED else 'PilotCapture')
    OUT = capture_root / str(WIDTH)
    if STANDARD:
        OUT = OUT.parent / 'Standard' / str(WIDTH)
    if MOTION:
        OUT = capture_root / 'Motion' / ('Standard' if STANDARD else 'Comic') / str(WIDTH)
OUT.mkdir(parents=True, exist_ok=True)
VERIFY = ROOT / 'Verification' / ('NeutralCandidate' if NEUTRAL_CANDIDATE else 'PlayerQuality')
if GRAPHIC_NOVEL_CANDIDATE:
    VERIFY = OUT.parent
VERIFY.mkdir(parents=True, exist_ok=True)
ATLASES = ROOT / 'Saved' / 'Tests' / ('ImportedAtlasesNeutral' if NEUTRAL_CANDIDATE else 'ImportedAtlases')
if GRAPHIC_NOVEL_CANDIDATE:
    ATLASES = VERIFY / 'ImportedAtlases'
ATLASES.mkdir(parents=True, exist_ok=True)
NAMES = {3: 'GreenCap51', 4: 'Memphis33', 5: 'BlackCap', 6: 'WhiteCap',
         7: 'RedJersey', 8: 'LimeJacket', 9: 'CurlyMetalhead', 10: 'Topknot'}
STYLES = (9,) if NEUTRAL_CANDIDATE or GRAPHIC_NOVEL_CANDIDATE else tuple(NAMES)
SOURCE = ROOT / 'Data' / 'CharactersNeutral'
CREW_PATH = '/Game/ParkComic/' + ('CrewNeutral' if NEUTRAL_CANDIDATE else 'Crew')
if GRAPHIC_NOVEL_CANDIDATE:
    CREW_PATH = '/Game/ParkComic/CrewGraphicNovel'
if GRAPHIC_NOVEL_GENERATED:
    NAMES[9] = 'generated-v1'
    SOURCE = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
    CREW_PATH = '/Game/ParkComic/CrewGraphicNovelGenerated'
COMIC_PATH = '/Game/ParkComic/CrewGraphicNovel/Resident9/M_ComicInk.M_ComicInk' if GRAPHIC_NOVEL_CANDIDATE else '/Game/Art/Comic/M_ComicInk.M_ComicInk'
BONES = ('Hips', 'Head', 'headfront', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot')
if GRAPHIC_NOVEL_CANDIDATE and not GRAPHIC_NOVEL_GENERATED:
    BONES += tuple(f'GN_{side}_{finger}{segment}' for side in ('Left', 'Right')
                   for finger in ('Pinky', 'Ring', 'Middle', 'Index', 'Thumb') for segment in (1, 2))
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
          'setup': 'PIE-only clear soccer pitch; cars/residents hidden with collision disabled; input disabled to prevent zero-axis overrides; Walk/Run and descent observation use 0.25 global time dilation; native jump liftoff/apex use original timing; landing camera prepared during descent and frozen on first observed recoil pose',
          'captures': 'actual gameplay poses; world paused only for screenshot completion',
          'cadence_sampling': 'Walk/Run use 0.25 world-time dilation to resolve the former 12-Hz holds; clip phase must advance on every observed engine frame, with at least 24 observations per world second. These sample rates are not native render or browser decoded FPS.',
          'not_checked': ['physical keyboard delivery', 'native C-key crew selection (covered separately by smoke_test)', 'external networking', 'exact likeness to the supplied photographs',
                          'pixel identity after BC7 GPU compression, lighting and postprocessing'],
          'characters': [], 'screenshots': []}
REPORT['asset_selection'] = {'candidate': NEUTRAL_CANDIDATE or GRAPHIC_NOVEL_CANDIDATE, 'styles': list(STYLES),
                            'graphic_novel': GRAPHIC_NOVEL_CANDIDATE,
                            'generated_body': GRAPHIC_NOVEL_GENERATED,
                            'source': str(SOURCE.relative_to(ROOT)), 'asset_folder': CREW_PATH,
                            'pie_mesh_and_clip_overrides': NEUTRAL_CANDIDATE or GRAPHIC_NOVEL_CANDIDATE}
REPORT['headless'] = HEADLESS
REPORT['render_mode'] = 'standard' if STANDARD else 'comic'
REPORT['motion_only'] = MOTION
if MOTION:
    REPORT.update(setup='PIE-only clear pitch; cars/residents hidden with collision disabled; physical input disabled; native directional turn uses MoveRight; actual controller camera and HUD retained',
        captures='no stills; unpaused 1x native actions with selected timestamped graph/bone/camera observations',
        cadence_sampling='Selected observations at most 30 per world second; not a render FPS or fluidity measurement',
        transitions={'passed': False, 'samples': [], 'events': []})
    REPORT['not_checked'] += ['rendered fluidity and real-time video acceptance', 'native or stream frame-rate performance', 'live city collision, crowds and co-op']
    REPORT['asset_selection']['pie_mesh_and_clip_overrides'] = False
if GRAPHIC_NOVEL_GENERATED:
    imported = json.loads((ROOT / 'Saved/Tests/GraphicNovel/GeneratedImport.json').read_text())
    native_body = (ROOT / imported['body_source']).resolve()
    assert imported['passed'] and native_body == SOURCE / 'generated-v1/body.fbx' and native_body.is_file(), native_body
    REPORT['candidate_asset_status'] = {'body_source': str(native_body.relative_to(ROOT)),
        'body_sha256': hashlib.sha256(native_body.read_bytes()).hexdigest(),
        'graphics_accepted': False, 'scope': 'generated body-only rig and own clips; no finger, facial or visual acceptance'}
elif GRAPHIC_NOVEL_CANDIDATE:
    pilot = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe'
    topology = json.loads((pilot / 'roundtrip.json').read_text())
    imported = json.loads((ROOT / 'Saved/Tests/GraphicNovel/PilotImport.json').read_text())
    assert imported['passed'], 'Candidate native import report is not passing'
    native_body = (ROOT / imported['body_source']).resolve()
    assert native_body.is_relative_to(pilot) and native_body.is_file(), native_body
    REPORT['candidate_asset_status'] = {'body_source': str(native_body.relative_to(ROOT)),
        'body_sha256': hashlib.sha256(native_body.read_bytes()).hexdigest(),
        'wardrobe_body_source': str((pilot / 'body.fbx').relative_to(ROOT)),
        'wardrobe_body_sha256': hashlib.sha256((pilot / 'body.fbx').read_bytes()).hexdigest(),
        'round_trip_passed': topology['passed'],
        'unintended_trouser_boundary_edges': topology['unintended_trouser_boundary_edges'],
        'graphics_accepted': False, 'scope': 'functional pilot checks only; cloth topology does not establish visual acceptance'}
if HEADLESS:
    REPORT['skipped_screenshots'] = []
    REPORT['captures'] = 'headless native state/bone observations only; no images or visual acceptance'
    REPORT['not_checked'] += ['rendered graphics and screenshot dimensions', 'visual motion quality', 'render or stream performance']
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
        # Slow world time to distinguish continuous poses from the former 12-Hz
        # holds even when the editor renders fewer frames per wall-clock second.
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


def animation_state(mesh):
    instance = mesh.get_anim_instance()
    if instance.get_class().get_path_name() == '/Script/Quebec.QuebecCrewAnimInstance':
        weights = {kind: float(instance.get_editor_property('observed_' + kind.lower() + '_weight'))
                   for kind in ('Idle', 'Walk', 'Run', 'Jump')}
        return instance.get_editor_property('observed_clip'), float(instance.get_editor_property('observed_clip_time')), weights
    return instance.get_animation_asset(), mesh.get_position(), None


def sample():
    pawn, mesh = STATE['pawn'], STATE['mesh']
    asset, clip_time, weights = animation_state(mesh)
    bones = {}
    for name in BONES:
        transform = mesh.get_socket_transform(name, u.RelativeTransformSpace.RTS_COMPONENT)
        bones[name] = {'translation_cm': vec(transform.translation), 'rotation_xyzw': quat(transform.rotation)}
    result = {'world_time': round(clock(), 5), 'clip': asset.get_name() if asset else None,
            'clip_path': asset.get_path_name() if asset else None,
            'clip_time': round(clip_time, 5), 'clip_weights': weights, 'location_cm': vec(pawn.get_actor_location()),
            'velocity_cm_s': vec(pawn.get_velocity()), 'falling': STATE['movement'].is_falling(),
            'mesh_relative_cm': vec(mesh.get_editor_property('relative_location')), 'bones': bones}
    if GRAPHIC_NOVEL_CANDIDATE:
        instance = mesh.get_anim_instance()
        result['pilot_controls'] = {key: instance.get_editor_property('observed_' + key)
                                    for key in ('finger_control_count', 'finger_flex_degrees', 'eye_narrow_weight')}
    return result


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
    if record['clip_weights']:
        assert record['clip_weights'][expected[2:]] > .99, (label, 'pose is still crossfading', record['clip_weights'])
        if label in ('Airborne', 'Landing'):
            idle = STATE['character']['states']['Idle']['bones']['LeftLeg']['rotation_xyzw']
            observed = record['bones']['LeftLeg']['rotation_xyzw']
            angle = 2 * math.acos(min(1., abs(sum(a * b for a, b in zip(idle, observed)))))
            assert angle > (.6 if label == 'Airborne' else .1), (label, 'actual jump/recoil bone pose missing', angle)
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
    if HEADLESS:
        REPORT['skipped_screenshots'].append({'style': STATE['style'], 'state': label, 'reason': 'NullRHI native-only fixture'})
        phase(STATE['next_phase'])
        if STATE['phase'] == 'settle':
            stop_fixture_motion()
            native('StopSprint')
        return
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
    slots = mesh.get_editor_property('materials')
    if GRAPHIC_NOVEL_CANDIDATE:
        assert all(slot.material_interface for slot in slots), 'Pilot has an unassigned material slot'
        material = next(slot.material_interface for slot in slots if slot.material_interface.get_name() == 'M_Crew')
        pose = u.AnimPoseExtensions.get_anim_pose_at_time(clips['Idle'], 0., u.AnimPoseEvaluationOptions())
        bones = set(map(str, u.AnimPoseExtensions.get_bone_names(pose)))
        expected = {f'GN_{side}_{finger}{segment}' for side in ('Left', 'Right')
                    for finger in ('Pinky', 'Ring', 'Middle', 'Index', 'Thumb') for segment in (1, 2)}
        morphs = {morph.get_name() for morph in mesh.get_editor_property('morph_targets')}
        if GRAPHIC_NOVEL_GENERATED:
            assert expected.isdisjoint(bones) and not morphs, ('Unexpected generated rig controls', bones, morphs)
            result['pilot_rig'] = {'finger_bones': [], 'morphs': [], 'material_slots': len(slots),
                                   'scope': 'generated body-only rig; static face and fingers'}
        else:
            assert expected <= bones, ('Missing pilot finger bones', sorted(expected - bones))
            assert {'GN_EyeNarrow_L', 'GN_EyeNarrow_R'} <= morphs, ('Missing pilot squint targets', morphs)
            result['pilot_rig'] = {'finger_bones': sorted(expected), 'morphs': sorted(morphs), 'material_slots': len(slots),
                                   'scope': 'partial fingers and restrained squint controls; no full blink or jaw'}
    else:
        material = slots[0].material_interface
    base = u.MaterialEditingLibrary.get_material_property_input_node(material, u.MaterialProperty.MP_BASE_COLOR)
    if GRAPHIC_NOVEL_CANDIDATE:
        normal = u.MaterialEditingLibrary.get_material_property_input_node(material, u.MaterialProperty.MP_NORMAL)
        assert isinstance(normal, u.MaterialExpressionLinearInterpolate)
        result['mapped_normal_strength'] = 1. - normal.get_editor_property('const_alpha')
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


def headless_pose_fixture():
    if not HEADLESS:
        return
    mesh = STATE['mesh']
    option = u.VisibilityBasedAnimTickOption.ALWAYS_TICK_POSE_AND_REFRESH_BONES
    mesh.set_editor_property('visibility_based_anim_tick_option', option)
    mesh.set_editor_property('enable_update_rate_optimizations', False)
    assert mesh.get_editor_property('visibility_based_anim_tick_option') == option
    assert not mesh.get_editor_property('enable_update_rate_optimizations')
    REPORT['headless_animation_fixture'] = {'visibility_based_anim_tick_option': 'AlwaysTickPoseAndRefreshBones',
        'enable_update_rate_optimizations': False,
        'scope': 'PIE component only; forces actual bone evaluation without RHI visibility; all pose assertions retained'}


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
    if NEUTRAL_CANDIDATE or GRAPHIC_NOVEL_CANDIDATE:
        # Preserve the native pawn and Tick/callback behavior; override assets only
        # in this standalone PIE fixture until the pilot is accepted for promotion.
        folder = f'{CREW_PATH}/Resident{style}'
        body = u.load_asset(folder + '/SK_Body')
        if GRAPHIC_NOVEL_CANDIDATE:
            assert STATE['mesh'].get_skeletal_mesh_asset() == body, 'Native candidate flag did not select the pilot body before fixture overrides'
            instance = STATE['mesh'].get_anim_instance()
            assert instance.get_class().get_path_name() == '/Script/Quebec.QuebecCrewAnimInstance', 'Native pilot blended graph is absent'
            assert instance.get_editor_property('locomotion_asset') == u.load_asset(folder + '/BS_Locomotion')
            assert instance.get_editor_property('jump_asset') == u.load_asset(folder + '/A_Jump')
            STATE['character']['pilot_rig']['native_flag_route'] = {'verified_before_fixture_overrides': True,
                'body': body.get_path_name(), 'animation_class': instance.get_class().get_path_name()}
            if MOTION:
                slots = body.get_editor_property('materials')
                live_slots = []
                for index, slot in enumerate(slots):
                    live = STATE['mesh'].get_material(index)
                    live_slots.append({'index': index, 'imported': slot.material_interface.get_path_name(),
                        'live': live.get_path_name() if live else None, 'matches': live == slot.material_interface})
                overrides = STATE['mesh'].get_editor_property('override_materials')
                STATE['character']['pilot_rig']['native_material_readback'] = {'slots': live_slots,
                    'override_count': len(overrides), 'assigned_override_count': sum(material is not None for material in overrides),
                    'scope': 'read only; native component materials were not repaired by this motion fixture'}
                assert all(slot['matches'] for slot in live_slots), ('Native pilot material mismatch', live_slots)
                headless_pose_fixture()
                assert STATE['mesh'].get_editor_property('custom_depth_stencil_value') == 254
                assert abs(STATE['original_time_dilation'] - 1.) < .001, 'Motion requires normal 1x world time'
                native('StopSprint')
                motion_phase('idle')
                return
        STATE['mesh'].set_skinned_asset_and_update(body, True)
        for kind in ('Idle', 'Walk', 'Run', 'Jump'):
            SYSTEM.call_method('SetObjectPropertyByName', (pawn, 'Crew' + kind, u.load_asset(folder + '/A_' + kind)))
        SYSTEM.call_method('SetObjectPropertyByName', (pawn, 'CrewAnimation', None))
        if GRAPHIC_NOVEL_CANDIDATE:
            slots = body.get_editor_property('materials')
            for index, slot in enumerate(slots):
                STATE['mesh'].set_material(index, slot.material_interface)
            assert all(STATE['mesh'].get_material(index) == slot.material_interface for index, slot in enumerate(slots)), 'Stale component material overrides'
            STATE['character']['pilot_rig']['live_materials'] = [STATE['mesh'].get_material(index).get_path_name() for index in range(len(slots))]
            SYSTEM.call_method('SetObjectPropertyByName', (pawn, 'CrewLocomotion', u.load_asset(folder + '/BS_Locomotion')))
            assert pawn.call_method('ConfigureCrewAnimation'), 'Pilot blended graph rejected its body/clips'
            STATE['mesh'].set_custom_depth_stencil_value(254)
            headless_pose_fixture()
        assert STATE['mesh'].get_skeletal_mesh_asset() == body
    assert STATE['mesh'].get_editor_property('custom_depth_stencil_value') == (254 if GRAPHIC_NOVEL_CANDIDATE else 255)
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
    asset, clip_time, weights = animation_state(mesh)
    if not asset or asset.get_name() != 'A_' + kind or abs(speed - (450 if kind == 'Walk' else 800)) > 5 or (weights and weights[kind] <= .99):
        return
    samples = STATE['character']['locomotion_samples'][kind]
    now = clock()
    if samples and now - samples[-1]['world_time'] < .0001:
        return
    samples.append({'world_time': now, 'engine_frame': u.SystemLibrary.get_frame_count(),
                    'clip_time': clip_time, 'speed_cm_s': speed,
                    'actor_cm': vec(pawn.get_actor_location()),
                    'left_foot_component_cm': vec(mesh.get_socket_transform('LeftFoot', u.RelativeTransformSpace.RTS_COMPONENT).translation)})


def locomotion_cadence(kind, samples, length):
    assert len(samples) > 5, (kind, 'insufficient steady movement samples', len(samples))
    duration = samples[-1]['world_time'] - samples[0]['world_time']
    assert duration >= .5, (kind, 'steady movement observation too short', duration)
    pairs = len(samples) - 1
    sample_hz = pairs / duration
    assert sample_hz >= 24, (kind, 'sampling too sparse to resolve 12-Hz holds', sample_hz)
    assert math.isfinite(length) and length > 0, (kind, 'invalid clip length', length)
    foot_changes = wraps = 0
    largest_advance = largest_error = 0.
    max_frame_gap = 0
    for item in samples:
        assert abs(item['speed_cm_s'] - (450 if kind == 'Walk' else 800)) <= 5, (kind, 'not steady movement', item)
    for previous, item in zip(samples, samples[1:]):
        elapsed = item['world_time'] - previous['world_time']
        frame_gap = item['engine_frame'] - previous['engine_frame']
        assert 0 < elapsed < 1 / 12 and frame_gap > 0, (kind, 'invalid or sparse frame observations', elapsed, frame_gap)
        max_frame_gap = max(max_frame_gap, frame_gap)
        advance = (item['clip_time'] - previous['clip_time']) % length
        assert advance > .00001, (kind, 'held pose during steady movement', previous, item)
        rate = min(2., max(.8, item['speed_cm_s'] / (600 if kind == 'Run' else 180)))
        expected = elapsed * rate
        error = abs(advance - expected)
        # Both clocks are read after the same simulation frame; allow float and
        # observation error, rather than excusing an animation-frame-sized jump.
        assert error <= .003 + expected * .1, (kind, 'phase jumped forward/backward', advance, expected)
        largest_advance, largest_error = max(largest_advance, advance), max(largest_error, error)
        wraps += item['clip_time'] < previous['clip_time']
        assert math.dist(item['actor_cm'], previous['actor_cm']) > .01, (kind, 'actor stopped during steady movement')
        foot_changes += math.dist(item['left_foot_component_cm'], previous['left_foot_component_cm']) >= .002
    assert foot_changes / pairs >= .95, (kind, 'bones held while animation phase advanced', foot_changes, pairs)
    return {'observed_world_seconds': round(duration, 4), 'samples': len(samples),
            'observed_sample_pairs_per_world_second': round(sample_hz, 3),
            'observation_global_time_dilation': .25, 'largest_observed_engine_frame_gap': max_frame_gap,
            'phase_advance_pairs': pairs, 'foot_pose_change_pairs': foot_changes, 'clip_wraps': wraps,
            'largest_forward_phase_advance_seconds': round(largest_advance, 5),
            'largest_phase_rate_error_seconds': round(largest_error, 5)}


def validate_locomotion():
    STATE['character']['observed_locomotion_cadence'] = {
        kind: locomotion_cadence(kind, samples, STATE['character']['clips'][kind]['seconds'])
        for kind, samples in STATE['character']['locomotion_samples'].items()}


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
    if GRAPHIC_NOVEL_CANDIDATE:
        controls = [item['pilot_controls'] for item in states.values()]
        assert all(item['finger_control_count'] == (0 if GRAPHIC_NOVEL_GENERATED else 20) for item in controls), ('Unexpected pilot finger controls', controls)
        assert all(math.isfinite(item['finger_flex_degrees']) and 0 <= item['finger_flex_degrees'] <= 18 for item in controls)
        assert all(math.isfinite(item['eye_narrow_weight']) and 0 <= item['eye_narrow_weight'] <= 1 for item in controls)
        if GRAPHIC_NOVEL_GENERATED:
            assert all(item['finger_flex_degrees'] == item['eye_narrow_weight'] == 0 for item in controls), 'Body-only rig reported nonexistent controls'
        else:
            assert states['Run']['pilot_controls']['finger_flex_degrees'] > states['Idle']['pilot_controls']['finger_flex_degrees'] + 1
            assert states['Run']['pilot_controls']['eye_narrow_weight'] > .1, 'Pilot squint morph was not driven during sprint'
        row['pilot_rig']['runtime_controls_observed'] = True
    REPORT['characters'].append(row)
    REPORT.pop('active_character', None)
    u.log(f'NORD_PLAYER_QUALITY_STYLE_OK {STATE["style"]} {WIDTH}')


def motion_phase(name):
    phase('motion_' + name)
    REPORT['transitions']['events'].append({'phase': name, 'world_time': round(clock(), 5),
        'wall_seconds': round(time.monotonic() - STATE['started'], 5)})
    u.log('NORD_PLAYER_MOTION_PHASE ' + name)


def transition_checks(samples, lengths):
    names = ('idle', 'walk', 'sprint', 'turn', 'stop', 'jump', 'landing', 'recover')
    groups = {name: [row for row in samples if row['phase'] == name] for name in names}
    assert all(groups.values()), ('Missing native transition observations', {k: len(v) for k, v in groups.items()})
    for row in samples:
        assert not row['paused'] and abs(row['global_time_dilation'] - 1.) < .001, 'Motion was paused or slowed'
        assert row['clip_path'].startswith(CREW_PATH + '/Resident9/'), ('Wrong native motion clip', row['clip_path'])
        assert row['clip_weights'] and all(math.isfinite(w) and 0 <= w <= 1.001 for w in row['clip_weights'].values())
        controls = row['pilot_controls']
        assert controls['finger_control_count'] == (0 if GRAPHIC_NOVEL_GENERATED else 20)
        assert math.isfinite(controls['finger_flex_degrees']) and 0 <= controls['finger_flex_degrees'] <= 18
        assert math.isfinite(controls['eye_narrow_weight']) and 0 <= controls['eye_narrow_weight'] <= 1
        if GRAPHIC_NOVEL_GENERATED:
            assert controls['finger_flex_degrees'] == controls['eye_narrow_weight'] == 0, 'Body-only rig reported nonexistent controls'
    for a, b in zip(samples, samples[1:]):
        assert b['world_time'] > a['world_time'] and b['engine_frame'] > a['engine_frame'], 'Motion observations did not advance'
        assert b['wall_seconds'] > a['wall_seconds'], 'Motion wall timestamps did not advance'
    checks = {}
    for phase_name, kind, speed in (('walk', 'Walk', 450), ('sprint', 'Run', 800)):
        steady = [row for row in groups[phase_name] if row['clip_weights'][kind] > .99 and
                  abs(math.hypot(*row['velocity_cm_s'][:2]) - speed) <= 5]
        assert len(steady) >= 2, (phase_name, 'Native steady motion was not reached')
        changes = 0
        for a, b in zip(steady, steady[1:]):
            elapsed = b['world_time'] - a['world_time']
            advance = (b['clip_time'] - a['clip_time']) % lengths[kind]
            expected = elapsed * min(2., max(.8, speed / (600 if kind == 'Run' else 180)))
            assert advance > .00001 and abs(advance - expected) <= .003 + expected * .1, (kind, 'Native phase hold/jump', advance, expected)
            changes += math.dist(a['bones']['LeftFoot']['translation_cm'], b['bones']['LeftFoot']['translation_cm']) > .002
        assert changes >= .9 * (len(steady) - 1), (kind, 'Actual native foot pose did not advance')
        checks[phase_name] = {'steady_samples': len(steady), 'foot_pose_change_pairs': changes}
    run, turn = groups['sprint'][-1], groups['turn'][-1]
    yaw = abs((turn['actor_yaw_degrees'] - run['actor_yaw_degrees'] + 180) % 360 - 180)
    assert yaw > 45 and turn['velocity_cm_s'][1] > 400, ('Native directional turn missing', yaw)
    assert math.hypot(*groups['stop'][-1]['velocity_cm_s'][:2]) < 1, 'Native braking did not stop the pawn'
    origin = groups['stop'][-1]['location_cm']
    airborne = [row for row in groups['jump'] if row['falling']]
    assert airborne and any(row['clip_weights']['Jump'] > .99 for row in airborne), 'Actual jump graph never dominated'
    peak = max(row['location_cm'][2] for row in airborne) - origin[2]
    assert peak > 120, ('Native jump too short', peak)
    drift = max(math.dist(origin[:2], row['location_cm'][:2]) for row in groups['jump'] + groups['landing'])
    assert drift < .5, ('Vertical jump actor drift', drift)
    idle = groups['idle'][-1]['bones']['LeftLeg']['rotation_xyzw']
    knee = max(2 * math.acos(min(1., abs(sum(a * b for a, b in zip(idle, row['bones']['LeftLeg']['rotation_xyzw']))))) for row in airborne)
    assert knee > .6, ('Actual jump knee pose missing', knee)
    assert all(not row['falling'] for row in groups['landing']), 'Landing observations are airborne'
    recovered = groups['recover'][-1]
    assert recovered['clip'] == 'A_Idle' and recovered['clip_weights']['Idle'] > .99 and not recovered['falling'], 'Native idle did not recover'
    if not GRAPHIC_NOVEL_GENERATED:
        assert run['pilot_controls']['finger_flex_degrees'] > groups['idle'][-1]['pilot_controls']['finger_flex_degrees'] + 1
        assert run['pilot_controls']['eye_narrow_weight'] > .1
    return {'phase_counts': {key: len(value) for key, value in groups.items()}, 'steady_motion': checks,
            'directional_turn_degrees': round(yaw, 3), 'jump_peak_cm': round(peak, 3),
            'jump_horizontal_drift_cm': round(drift, 5), 'airborne_knee_degrees': round(math.degrees(knee), 3),
            'scope': 'selected native state and pose observations at 1x; no rendered fluidity or FPS acceptance'}


def motion_tick():
    name = STATE['phase'][7:]
    age = clock() - STATE['phase_started']
    assert age < 5, (name, 'Native transition timed out')
    assert not u.GameplayStatics.is_game_paused(STATE['world']), 'Motion must remain unpaused'
    assert abs(u.GameplayStatics.get_global_time_dilation(STATE['world']) - 1.) < .001
    assert STATE['pc'].get_view_target() == STATE['pawn'], 'Motion must retain the actual controller camera'
    if name in ('walk', 'sprint', 'turn'):
        STATE['pawn'].call_method('MoveRight' if name == 'turn' else 'MoveForward', (1.,))
    rows = REPORT['transitions']['samples']
    if not rows or rows[-1]['phase'] != name or clock() - rows[-1]['world_time'] >= 1 / 30:
        row = sample()
        manager = u.GameplayStatics.get_player_camera_manager(STATE['world'], 0)
        row.update(phase=name, wall_seconds=round(time.monotonic() - STATE['started'], 5),
            engine_frame=u.SystemLibrary.get_frame_count(), paused=False,
            global_time_dilation=u.GameplayStatics.get_global_time_dilation(STATE['world']),
            actor_yaw_degrees=STATE['pawn'].get_actor_rotation().yaw,
            cached_camera={'position_cm': vec(manager.get_camera_location()),
                           'horizontal_fov_degrees': manager.get_fov_angle()})
        rows.append(row)
        assert inside_pitch(STATE['pawn'].get_actor_location(), STATE['pitch_points']), 'Motion left the capture pitch'
    if name == 'idle' and age > .7 and not STATE['movement'].is_falling():
        motion_phase('walk')
    elif name == 'walk' and age > 1.4:
        native('StartSprint')
        motion_phase('sprint')
    elif name == 'sprint' and age > 1.4:
        motion_phase('turn')
    elif name == 'turn' and age > .8:
        native('StopSprint')
        motion_phase('stop')
    elif name == 'stop' and age > .7 and math.dist(vec(STATE['pawn'].get_velocity()), [0, 0, 0]) < 1:
        STATE.update(motion_seen_falling=False, jump_released=False)
        native('Jump')
        motion_phase('jump')
    elif name == 'jump':
        falling = STATE['movement'].is_falling()
        STATE['motion_seen_falling'] |= falling
        if age > .15 and not STATE['jump_released']:
            native('StopJumping')
            STATE['jump_released'] = True
        if STATE['motion_seen_falling'] and not falling:
            motion_phase('landing')
    elif name == 'landing' and age > .22:
        motion_phase('recover')
    elif name == 'recover' and age > .6:
        result = transition_checks(rows, {kind: value['seconds'] for kind, value in STATE['character']['clips'].items()})
        REPORT['transitions'].update(passed=True, checks=result)
        STATE['character']['unpaused_transitions'] = result
        REPORT['characters'].append(STATE['character'])
        REPORT.pop('active_character', None)
        finish()


def finish(error=None):
    if STATE['finished']:
        return
    STATE['finished'] = True
    if error:
        REPORT['error'] = error
    observations = len(REPORT['skipped_screenshots']) if HEADLESS else len(REPORT['screenshots'])
    REPORT['passed'] = not error and len(REPORT['characters']) == len(STYLES) and (
        REPORT['transitions']['passed'] if MOTION else observations == 7 * len(STYLES))
    REPORT['wall_seconds'] = round(time.monotonic() - STATE['started'], 2)
    (VERIFY / f'Player{"Motion" if MOTION else "Quality"}{WIDTH}{"Headless" if HEADLESS else ""}.json').write_text(json.dumps(REPORT, indent=2) + '\n')
    try:
        if STATE.get('world'):
            u.GameplayStatics.set_game_paused(STATE['world'], False)
            u.GameplayStatics.set_global_time_dilation(STATE['world'], STATE['original_time_dilation'])
        if STATE.get('owns_pie'):
            LEVELS.editor_request_end_play()
    finally:
        for key, value in ORIGINAL.items():
            SETTINGS.set_editor_property(key, value)
        SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
        u.unregister_slate_post_tick_callback(STATE['callback'])
        SCRIPT.call_method('SetKeepPythonScriptAlive', (False,))
    if REPORT['passed']:
        if MOTION:
            u.log(f'NORD_PLAYER_MOTION_OK 1 character 8 phases {len(REPORT["transitions"]["samples"])} observations {WIDTH}x{HEIGHT}; headless={HEADLESS}')
        else:
            u.log(f'NORD_PLAYER_QUALITY_OK {len(STYLES)} characters {len(REPORT["screenshots"])} screenshots {WIDTH}x{HEIGHT}; headless={HEADLESS}')
    else:
        u.log_error('NORD_PLAYER_QUALITY_FAILED ' + str(error))


def restart_immersive_startup(worlds):
    assert MOTION and not HEADLESS and '-immersive' in COMMAND_LINE.lower().split(), 'Begin this capture outside PIE'
    assert len(worlds) == 1, 'Immersive bootstrap requires exactly one startup PIE world'
    world = worlds[0]
    assert u.SystemLibrary.is_standalone(world), 'Immersive bootstrap requires standalone PIE'
    assert u.GameplayStatics.get_current_level_name(world, True) == 'LaFontaine', 'Unexpected immersive startup map'
    assert u.GameplayStatics.get_num_player_controllers(world) == u.GameplayStatics.get_num_local_player_controllers(world) == 1, 'Immersive startup must have one local player'
    assert not STATE.get('immersive_restart_requested'), 'Immersive startup may only restart once'
    STATE.update(immersive_restart_requested=True, owns_pie=True)
    REPORT['viewport_bootstrap'] = {'method': 'restart owned immersive startup PIE once before saved-build checks',
        'startup_world': world.get_path_name(), 'standalone_local_players': 1,
        'scope': 'rendered motion only; the existing immersive viewport is retained, assets are not changed'}
    LEVELS.editor_request_end_play()
    u.log('NORD_PLAYER_MOTION_IMMERSIVE_RESTART')


def native_viewport_rectangle(calibration):
    # SetMouseLocation reaches FSceneViewport::SetMouse, which maps native pixels
    # through its CachedGeometry; the platform cursor readback is desktop space.
    # UMG widget-host geometry can be empty for this native AHUD-only PIE viewport.
    pc = STATE['pc']
    previous = pc.get_mouse_position()
    probes = calibration['native_viewport_cursor_probes'] = []
    try:
        for point in ([0, 0], [WIDTH - 1, 0], [0, HEIGHT - 1]):
            pc.set_mouse_location(*point)
            desktop = u.WidgetLayoutLibrary.get_mouse_position_on_platform()
            probes.append({'viewport_pixels': point, 'desktop_pixels': [desktop.x, desktop.y]})
        origin, horizontal, vertical = (probe['desktop_pixels'] for probe in probes)
        assert all(math.isfinite(value) and abs(value - round(value)) < .01 for probe in probes for value in probe['desktop_pixels']), ('Native viewport probes are not finite integral screen pixels', probes)
        assert horizontal == [origin[0] + WIDTH - 1, origin[1]] and vertical == [origin[0], origin[1] + HEIGHT - 1], ('Native viewport does not map one-to-one to desktop pixels', probes)
        calibration['geometry_source'] = 'FSceneViewport cached geometry via three native-pixel cursor probes; platform desktop readback'
        return [origin[0], origin[1], WIDTH, HEIGHT]
    finally:
        restore = [round(value) for value in previous] if previous is not None else [WIDTH // 2, HEIGHT // 2]
        pc.set_mouse_location(*restore)
        calibration['cursor_restored_viewport_pixels'] = restore


def calibrate_motion_viewport():
    assert MOTION and not HEADLESS and '-immersive' in COMMAND_LINE.lower().split() and STATE.get('owns_pie'), 'Viewport calibration requires owned rendered immersive PIE'
    now, frame = time.monotonic(), u.SystemLibrary.get_frame_count()
    calibration = REPORT.get('viewport_calibration')
    if calibration is None:
        desktop = u.GameUserSettings.get_game_user_settings().get_desktop_resolution()
        display = [desktop.x, desktop.y]
        assert display[0] >= WIDTH and display[1] >= HEIGHT, ('Capture display is too small', display)
        calibration = REPORT['viewport_calibration'] = {
            'passed': False, 'method': 'resize owned editor root, then compensate measured chrome at most once',
            'display_pixels': display, 'target_viewport_pixels': [WIDTH, HEIGHT], 'attempts': []}
        requested = [WIDTH, HEIGHT]
    else:
        assert now - STATE['viewport_resize_started'] < 10, 'Viewport calibration timed out'
        # X11 size events and Slate layout require subsequent engine frames.
        if now - STATE['viewport_resize_started'] < 1 or frame - STATE['viewport_resize_frame'] < 2:
            return False
        observed = list(STATE['pc'].get_viewport_size())
        calibration['attempts'][-1]['observed_viewport_pixels'] = observed
        if observed != [WIDTH, HEIGHT] and len(calibration['attempts']) == 1:
            assert all(value > 0 for value in observed), ('Empty game viewport', observed)
            requested = [2 * WIDTH - observed[0], 2 * HEIGHT - observed[1]]
        else:
            assert observed == [WIDTH, HEIGHT], ('Game viewport remains the wrong size after bounded calibration', observed)
            values = native_viewport_rectangle(calibration)
            assert all(math.isfinite(value) and abs(value - round(value)) < .01 for value in values), ('Viewport rectangle is not finite integral screen pixels', values)
            x, y, width, height = map(round, values)
            assert [width, height] == observed, ('Measured game rectangle does not match native viewport', values, observed)
            display = calibration['display_pixels']
            assert x >= 0 and y >= 0 and x + width <= display[0] and y + height <= display[1], ('Game recording rectangle extends outside the display', values, display)
            rectangle = {'x': x, 'y': y, 'width': width, 'height': height, 'display_pixels': display}
            calibration.update(passed=True, desktop_recording_rectangle=rectangle)
            REPORT['viewport_pixels_observed'] = observed
            u.log('NORD_PLAYER_MOTION_VIEWPORT ' + json.dumps(rectangle, separators=(',', ':')))
            return True
    display = calibration['display_pixels']
    assert WIDTH <= requested[0] <= display[0] and HEIGHT <= requested[1] <= display[1], ('Measured chrome cannot fit capture display', requested, display)
    calibration['attempts'].append({'requested_root_pixels': requested})
    STATE.update(viewport_resize_started=now, viewport_resize_frame=frame)
    u.SystemLibrary.execute_console_command(STATE['world'], f'Editor.ResizeMainFrame {requested[0]} {requested[1]}', STATE['pc'])
    return False


def tick(dt):
    try:
        assert time.monotonic() - STATE['started'] < 300, 'Capture watchdog expired'
        current = STATE['phase']
        if current == 'boot':
            if time.monotonic() - STATE['started'] < 2:
                return
            assert shutil.which('magick'), 'ImageMagick is required to compare imported texture source pixels'
            worlds = u.EditorLevelLibrary.get_pie_worlds(True)
            if worlds:
                if not STATE.get('immersive_restart_requested'):
                    restart_immersive_startup(worlds)
                return
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
            STATE['owns_pie'] = True
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
            camera = pawn
            if not MOTION:
                transform = u.Transform(u.Vector(0, 0, 1000))
                camera = GAMEPLAY.call_method('BeginDeferredActorSpawnFromClass', (world, u.CameraActor.static_class(), transform,
                    u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN, None, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
                GAMEPLAY.call_method('FinishSpawningActor', (camera, transform, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
                camera.get_component_by_class(u.CameraComponent).set_editor_property('post_process_blend_weight', 1.)
                pc.set_view_target_with_blend(camera, 0)
            if GRAPHIC_NOVEL_CANDIDATE and not MOTION:
                material = u.load_asset(COMIC_PATH)
                assert material, 'Missing isolated graphic-novel filter'
                SYSTEM.call_method('SetObjectPropertyByName', (pc, 'ComicMaterial', material))
                camera_component = camera.get_component_by_class(u.CameraComponent)
                settings = camera_component.get_editor_property('post_process_settings')
                blendables = settings.get_editor_property('weighted_blendables')
                entries = blendables.get_editor_property('array')
                for entry in entries:
                    obj = entry.get_editor_property('object')
                    if obj and obj.get_path_name() == '/Game/Art/Comic/M_ComicInk.M_ComicInk':
                        entry.set_editor_property('object', material)
                        entry.set_editor_property('weight', 1.)
                blendables.set_editor_property('array', entries)
                settings.set_editor_property('weighted_blendables', blendables)
                camera_component.set_editor_property('post_process_settings', settings)
            # Exercise the private native toggle; standard review switches back before checking the mode.
            pc.call_method('ToggleComicStyle')
            if STANDARD:
                pc.call_method('ToggleComicStyle')
            if not MOTION:
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
                                       'clearance_rule': 'motion pawn must remain inside the largest soccer polygon; native camera is recorded' if MOTION else 'captured pawn and camera must remain inside the largest soccer polygon'}
            for kind in ('ParkResident', 'Car'):
                for actor in u.GameplayStatics.get_all_actors_of_class(world, u.load_class(None, '/Script/Quebec.Quebec' + kind)):
                    actor.set_actor_hidden_in_game(True)
                    actor.set_actor_enable_collision(False)
            STATE.update(world=world, pc=pc, pawn=pawn, movement=pawn.get_component_by_class(u.CharacterMovementComponent), camera=camera, origin=origin, pitch_points=points,
                         original_time_dilation=u.GameplayStatics.get_global_time_dilation(world))
            if not HEADLESS:
                REPORT['renderer_settings'] = {
                    **{key: u.SystemLibrary.get_console_variable_int_value(key) for key in (
                        'sg.ViewDistanceQuality', 'sg.AntiAliasingQuality', 'sg.ShadowQuality',
                        'sg.GlobalIlluminationQuality', 'sg.ReflectionQuality', 'sg.PostProcessQuality',
                        'sg.TextureQuality', 'sg.EffectsQuality', 'sg.FoliageQuality',
                        'r.Streaming.PoolSize', 'r.Shadow.Virtual.MaxPhysicalPages')},
                    **{key: u.SystemLibrary.get_console_variable_float_value(key) for key in ('r.ScreenPercentage', 't.MaxFPS')}}
            pawn.set_actor_location(origin, False, True)
            phase('viewport_calibrate' if MOTION and not HEADLESS and '-immersive' in COMMAND_LINE.lower().split() else 'warm')
            return
        if current == 'viewport_calibrate':
            if calibrate_motion_viewport():
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
        if current.startswith('motion_'):
            motion_tick()
            return
        age = clock() - STATE['phase_started']
        if current == 'warm':
            if age > 12:
                interval = STATE['pawn'].get_component_by_class(u.SkeletalMeshComponent).get_component_tick_interval()
                assert abs(interval) < .001, ('Look switching must retain full-rate player poses', interval)
                camera = STATE['camera'].get_component_by_class(u.CameraComponent)
                entries = camera.get_editor_property('post_process_settings').get_editor_property('weighted_blendables').get_editor_property('array')
                comic = [entry for entry in entries if entry.get_editor_property('object') and
                         entry.get_editor_property('object').get_path_name() == COMIC_PATH]
                assert len(comic) == 1 and abs(comic[0].get_editor_property('weight') - (0. if STANDARD else 1.)) < .001, 'Requested render mode is not active'
                REPORT['comic_view'] = not STANDARD
                REPORT['player_pose_tick_interval_seconds'] = interval
                if MOTION and not HEADLESS:
                    REPORT['viewport_pixels_observed'] = list(STATE['pc'].get_viewport_size())
                    if '-immersive' in COMMAND_LINE.lower().split():
                        assert REPORT['viewport_calibration']['passed'] and REPORT['viewport_pixels_observed'] == [WIDTH, HEIGHT], 'Calibrated viewport changed before motion'
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
            elif current == 'descend' and STATE['seen_falling'] and not item['falling'] and item['clip_time'] >= .9 and item['clip'] == 'A_Jump' and (not item['clip_weights'] or item['clip_weights']['Jump'] > .99):
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
