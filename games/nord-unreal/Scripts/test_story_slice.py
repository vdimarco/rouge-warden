"""Native two-player PIE QA for the first two One More Tomorrow missions.

Run serially with LaFontaine loaded, -NordCampaignQA and this ExecutePythonScript.
Add -NordStoryRenderChecks -NordCaptureWidth=1280|1920 for native HUD captures;
omit -NullRHI for those runs. Fixture relocation is explicitly traced separately
from native inputs. This is not physical-control/handling-fun acceptance.
"""
import configparser
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import time
import traceback

import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
COMMAND = u.SystemLibrary.get_command_line()
assert '-NordCampaignQA' in COMMAND, 'Use -NordCampaignQA; production saves must not be used by this suite'
assert '-NordNoCampaign' not in COMMAND and '-NordNoCampaignSave' not in COMMAND, 'Campaign and isolated persistence are required'
RENDER = '-NordStoryRenderChecks' in COMMAND
FEEDBACK_QA = '-NordResidentFeedbackQA' in COMMAND
LAG = '-NordLag' in COMMAND
LIGHT_DIAGNOSTICS = RENDER or '-NordStoryDiagnostics' in COMMAND
WIDTH_FLAG = re.search(r'(?:^|\s)-NordCaptureWidth=(\d+)(?:\s|$)', COMMAND)
WIDTH = int(WIDTH_FLAG[1]) if WIDTH_FLAG else 1280
assert WIDTH in (1280, 1920), 'Supported capture widths are 1280 and 1920'
HEIGHT = WIDTH * 9 // 16
SLOT = 'NordCampaign_StorySliceQA_v1'
SAVE_DIR = Path(u.Paths.project_saved_dir()) / 'SaveGames'
SAVE_PATH = SAVE_DIR / (SLOT + '.sav')
QA_OLD_BYTES = SAVE_PATH.read_bytes() if SAVE_PATH.exists() else None
PRODUCTION_SAVES = {str(p.relative_to(SAVE_DIR)): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in SAVE_DIR.rglob('*.sav') if p != SAVE_PATH} if SAVE_DIR.exists() else {}
TEST_OUT = Path(u.Paths.project_saved_dir()).resolve() / 'Tests'
if FEEDBACK_QA:
    TEST_OUT /= 'ResidentFeedback'
OUT = TEST_OUT / f'StorySlice{WIDTH}' if FEEDBACK_QA else ROOT / 'Preview' / f'StorySlice{WIDTH}'
if RENDER:
    OUT.mkdir(parents=True, exist_ok=True)
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
SCRIPTING = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
SYSTEM = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
ORIGINAL = {key: SETTINGS.get_editor_property(key) for key in ('PlayNumberOfClients', 'RunUnderOneProcess')}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(Path(u.Paths.project_saved_dir()) / 'Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    CONFIG.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
CLASSES = {kind: u.load_class(None, '/Script/Quebec.Quebec' + kind)
           for kind in ('Campaign', 'Controller', 'Character', 'Car')}
assert all(CLASSES.values()), 'Build the current campaign editor module first'
PHASES = ('AIM_WORKLIGHT', 'CROSS_CABLE', 'PULL_CLAMP', 'PARK_CAR_LIGHT', 'RELEASE_TABLE',
          'RACE_READY', 'RACE_RUNNING', 'COMPLETE')
LAYOUT = json.loads((ROOT / 'Data/LaFontaine/layout.json').read_text())
REPORT = {'passed': False, 'mode': 'two-player listen-server PIE; native input callbacks',
          'checks': [], 'trace': [], 'captures': [], 'save_slot': SLOT,
          'setup': 'Authority-only actor relocation arranges fixtures; actions and observed driven crossings advance gameplay. No phase/index writes.',
          'not_checked': ['physical keyboard/mouse delivery', 'handling enjoyment', 'complete naturally driven race',
                          'audio presentation', 'external internet', 'remaining six campaign missions', 'performance acceptance']}
if RENDER:
    REPORT['resolution'] = [WIDTH, HEIGHT]
    REPORT['visual_review_pending'] = True
REPORT['source_sha256'] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in (ROOT/'Source/Quebec/QuebecCampaign.h', ROOT/'Source/Quebec/QuebecCampaign.cpp',
              ROOT/'Source/Quebec/QuebecGameplay.cpp') if p.exists()}
STATE = {'started': time.monotonic(), 'step': -1, 'finished': False, 'session': 0}
STEPS = []


def vec(v):
    return [round(v.x, 4), round(v.y, 4), round(v.z, 4)]


def distance(a, b):
    return math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2)


def actors(world, kind):
    return u.GameplayStatics.get_all_actors_of_class(world, CLASSES[kind])


def phase(actor):
    value = actor.get_editor_property('Phase')
    return next(i for i, name in enumerate(PHASES) if value == getattr(u.QuebecCampaignPhase, name))


def snapshot(actor):
    operator = actor.get_editor_property('LightOperator')
    return {'phase': phase(actor), 'completed_missions': actor.get_editor_property('CompletedMissions'),
            'race_gate': actor.get_editor_property('RaceGateIndex'),
            'race_elapsed': round(actor.get_editor_property('RaceElapsed'), 4),
            'race_retried': actor.get_editor_property('bRaceRetried'),
            'last_race_time': actor.get_editor_property('LastRaceTime'),
            'best_clean_race_time': actor.get_editor_property('BestCleanRaceTime'),
            'last_race_retried': actor.get_editor_property('bLastRaceRetried'),
            'light_operator': operator.get_name() if operator else None,
            'light_yaw': round(actor.get_editor_property('LightYaw'), 4),
            'light_pitch': round(actor.get_editor_property('LightPitch'), 4),
            'light_alignment': round(actor.get_editor_property('LightAlignment'), 4),
            'light_hold_progress': round(actor.get_editor_property('LightHoldProgress'), 4)}


def player_probe(side):
    """Read-only failure/ownership evidence; actor names are diagnostic only."""
    pc = STATE[side+'_pc']
    pawn = pc.get_controlled_pawn()
    player_state = pc.get_editor_property('PlayerState')
    probe = {'controller': pc.get_name(), 'player_state': player_state.get_name() if player_state else None,
             'pawn': pawn.get_name() if pawn else None,
             'control_rotation': {'yaw': round(pc.get_control_rotation().yaw, 4),
                                  'pitch': round(pc.get_control_rotation().pitch, 4)},
             'world_seconds': round(u.GameplayStatics.get_time_seconds(STATE[side]), 4)}
    if pawn:
        point = pawn.get_actor_location()
        probe['pawn_position_cm'] = vec(point)
        probe['distance_to_worklight_cm'] = round(distance(point, STATE[side+'_campaign'].get_editor_property('WorklightLocation')), 4)
        cars = actors(STATE[side], 'Car')
        if cars:
            car = min(cars, key=lambda a: distance(a.get_actor_location(), point))
            occupant = car.get_editor_property('Occupant')
            probe['nearest_car'] = {'actor': car.get_name(), 'position_cm': vec(car.get_actor_location()),
                                    'distance_cm': round(distance(car.get_actor_location(), point), 4),
                                    'occupant': occupant.get_name() if occupant else None}
    return probe


def observe_light_operator():
    if not LIGHT_DIAGNOSTICS:
        return
    worlds = list(u.EditorLevelLibrary.get_pie_worlds(True))
    for side in ('server', 'client'):
        world = STATE.get(side)
        if not world or not any(world is live for live in worlds):
            continue
        try:
            current = snapshot(STATE[side+'_campaign'])
            marker = (STATE['session'], world.get_path_name(), current['light_operator'], current['phase'])
            now = time.monotonic()
            previous = STATE.get('light_observation_'+side)
            gap = round(now-previous['wall'], 4) if previous and previous['marker'][:2] == marker[:2] else None
            if gap is not None:
                REPORT['light_observation_max_gap_seconds'] = max(REPORT.get('light_observation_max_gap_seconds', 0), gap)
            if not previous or previous['marker'] != marker:
                trace('observed_light_operator_change', peer=side, state=current,
                      since_previous_probe_seconds=gap, player=player_probe(side))
            STATE['light_observation_'+side] = {'marker': marker, 'wall': now}
        except Exception as error:
            # World teardown/reconnect can invalidate wrappers between read calls.
            trace('light_observation_unavailable', peer=side, reason=str(error))


def trace(kind, **data):
    REPORT['trace'].append({'step': STEPS[STATE['step']][0] if STATE['step'] >= 0 else 'setup',
                            'session': STATE['session'], 'kind': kind,
                            'wall_seconds': round(time.monotonic()-STATE['started'], 4), **data})


def native(target, method):
    trace('native_input_callback', actor=target.get_name(), method=method)
    if LIGHT_DIAGNOSTICS and method == 'Interact':
        for side in ('server', 'client'):
            try:
                trace('before_interact_probe', peer=side, state=snapshot(STATE[side+'_campaign']), player=player_probe(side))
            except Exception as error:
                trace('before_interact_probe_unavailable', peer=side, reason=str(error))
    u.SystemLibrary.set_timer_for_next_tick(target, method)


def relocate(actor, target, yaw=None):
    assert u.GameplayStatics.get_game_mode(actor), 'Fixture relocation must be authority-only'
    before = actor.get_actor_location()
    trace('fixture_relocation', actor=actor.get_name(), before_cm=vec(before), target_cm=vec(target), yaw=yaw)
    if yaw is None:
        actor.set_actor_location(target, False, True)
    else:
        actor.set_actor_location_and_rotation(target, u.Rotator(yaw=yaw), False, True)


def elapsed():
    world = STATE.get('step_world')
    # unreal.Array.__contains__ nativizes its argument; destroyed PIE worlds
    # cannot be converted. Compare the Python wrappers by identity instead.
    if world and any(world is live for live in u.EditorLevelLibrary.get_pie_worlds(True)):
        return u.GameplayStatics.get_time_seconds(world) - STATE['step_world_started']
    return time.monotonic() - STATE['step_started']


def step(name, action, ready, capture=None, timeout=20, delay=.35):
    STEPS.append((name, action, ready, capture, timeout, delay))


def start_step():
    STATE['step_started'] = time.monotonic()
    world = STATE.get('client')
    STATE['step_world'] = world if world and any(world is live for live in u.EditorLevelLibrary.get_pie_worlds(True)) else None
    if STATE['step_world']:
        STATE['step_world_started'] = u.GameplayStatics.get_time_seconds(world)
    STEPS[STATE['step']][1]()


def begin():
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'End any existing PIE session before testing'
    world = u.EditorLevelLibrary.get_editor_world()
    assert world.get_path_name().startswith('/Game/Maps/LaFontaine.'), 'Load LaFontaine before testing'
    if RENDER:
        LEVELS.editor_set_viewport_realtime(False)
        STATE['viewport_realtime_override'] = True
        REPORT['editor_viewport_realtime_disabled_for_inspection'] = True
    SAVE_PATH.unlink(missing_ok=True)
    STATE['qa_slot_initialized'] = True
    SCRIPTING.call_method('SetKeepPythonScriptAlive', (True,))
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', 1))
    SETTINGS.set_editor_property('PlayNumberOfClients', 2)
    SETTINGS.set_editor_property('RunUnderOneProcess', True)
    start_session()


def start_session():
    STATE['session'] += 1
    STATE.pop('client', None)
    STATE.pop('server', None)
    STATE.pop('fixture_car_property', None)
    LEVELS.editor_request_begin_play()


def discover():
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    server = next((w for w in worlds if u.GameplayStatics.get_game_mode(w)), None)
    client = next((w for w in worlds if not u.GameplayStatics.get_game_mode(w)), None)
    if RENDER:
        # Disable the duplicate listen-host buffers as soon as its world exists,
        # before waiting for controller/pawn replication. Both peers still tick.
        if server:
            u.GameplayStatics.set_enable_world_rendering(server, False)
        if client:
            u.GameplayStatics.set_enable_world_rendering(client, True)
    if not server or not client:
        return False
    if RENDER:
        if not u.GameplayStatics.get_enable_world_rendering(client):
            return False  # Its viewport may still be initializing.
        assert not u.GameplayStatics.get_enable_world_rendering(server), 'Inspection host rendering must be disabled'
        marker = (STATE['session'], server.get_path_name(), client.get_path_name())
        if STATE.get('render_world_marker') != marker:
            STATE['render_world_marker'] = marker
            probe = {'session': STATE['session'], 'host_world_rendering': False, 'client_world_rendering': True,
                     'host_world': marker[1], 'client_world': marker[2]}
            REPORT.setdefault('inspection_world_rendering', []).append(probe)
            trace('inspection_world_rendering', **probe)
    host = next((p for p in actors(server, 'Controller') if p.is_local_controller()), None)
    remote = next((p for p in actors(server, 'Controller') if not p.is_local_controller()), None)
    local = next((p for p in actors(client, 'Controller') if p.is_local_controller()), None)
    if not all(p and p.get_controlled_pawn() for p in (host, remote, local)):
        return False
    campaign = actors(server, 'Campaign')
    replicas = actors(client, 'Campaign')
    if len(campaign) != 1 or len(replicas) != 1:
        return False
    property_name = STATE.get('fixture_car_property')
    if property_name:
        # Runtime actor suffixes differ between peers. Replicated object references
        # identify the loaner; names are only diagnostic within their own world.
        car = campaign[0].get_editor_property(property_name)
        client_car = replicas[0].get_editor_property(property_name)
    else:
        car = min(actors(server, 'Car'), key=lambda a: distance(a.get_actor_location(), u.Vector(*LAYOUT['car'])))
        client_car = next((a for a in actors(client, 'Car') if a.get_name() == car.get_name()), None)
    if not car or not client_car:
        return False
    def walking_pawn(pc):
        pawn = pc.get_controlled_pawn()
        return pawn.get_editor_property('Occupant') if isinstance(pawn, u.QuebecCar) else pawn
    STATE.update(server=server, client=client, host_pc=host, server_pc=remote, client_pc=local,
                 host_char=walking_pawn(host), server_char=walking_pawn(remote),
                 client_char=walking_pawn(local), server_campaign=campaign[0], client_campaign=replicas[0],
                 server_car=car, client_car=client_car)
    if LAG:
        for world, pc, side in ((server, host, 'host'), (client, local, 'client')):
            marker = (STATE['session'], world)
            if STATE.get('lag_' + side) != marker:
                u.SystemLibrary.execute_console_command(world, 'NetEmulation.PktLag 100', pc)
                u.SystemLibrary.execute_console_command(world, 'NetEmulation.PktLoss 2', pc)
                STATE['lag_' + side] = marker
                trace('network_emulation', side=side, outgoing_lag_ms=100, packet_loss_percent=2)
        REPORT['network_emulation'] = {'outgoing_lag_ms': 100, 'packet_loss_percent': 2, 'both_peers': True}
    # RaceElapsed is continuously replicated and need not match on the same tick.
    return all(campaign[0].get_editor_property(key) == replicas[0].get_editor_property(key)
               for key in ('Phase', 'CompletedMissions', 'RaceGateIndex', 'bRaceRetried'))


def state_equal(expected_phase, completed=None, gate=None):
    for side in ('server', 'client'):
        a = STATE[side + '_campaign']
        if phase(a) != expected_phase:
            return False
        if completed is not None and a.get_editor_property('CompletedMissions') != completed:
            return False
        if gate is not None and a.get_editor_property('RaceGateIndex') != gate:
            return False
    return True


def save_boundary(expected):
    if not u.GameplayStatics.does_save_game_exist(SLOT, 0):
        return False
    saved = u.GameplayStatics.load_game_from_slot(SLOT, 0)
    assert saved and saved.get_editor_property('Version') == 10, 'Invalid actual campaign save'
    assert saved.get_editor_property('CompletedMissions') == expected, 'Save does not match completed mission boundary'
    for name in ('PondStep', 'CourtStep', 'ShowStep', 'RescueMask', 'ConvoyStep', 'BlankStep', 'TourStep', 'HomeStep', 'EscortStep', 'ShadeStep', 'GrabStep', 'CutStep', 'ChaseStep', 'FinaleStep', 'FollowStep'):
        assert saved.get_editor_property(name) == 0, 'Race boundary wrote a story step'
    digest = hashlib.sha256(SAVE_PATH.read_bytes()).hexdigest()
    STATE['saved_boundary_hash'] = digest
    REPORT.setdefault('saved_boundaries', []).append({'completed_missions': expected, 'session': STATE['session'],
                                                     'sha256': digest})
    return True


def partial_boundary_unchanged(expected):
    if not u.GameplayStatics.does_save_game_exist(SLOT, 0):
        assert expected == 0, 'Completed mission save vanished'
        return True
    saved = u.GameplayStatics.load_game_from_slot(SLOT, 0)
    assert saved.get_editor_property('CompletedMissions') == expected, 'Unfinished encounter changed mission-boundary save'
    if STATE.get('saved_boundary_hash'):
        assert hashlib.sha256(SAVE_PATH.read_bytes()).hexdigest() == STATE['saved_boundary_hash'], 'Unfinished encounter rewrote saved boundary'
    return True


def race_result_preserved(record=False):
    keys = ('LastRaceTime', 'BestCleanRaceTime', 'bLastRaceRetried')
    result, replica = (tuple(STATE[side+'_campaign'].get_editor_property(key) for key in keys)
                       for side in ('server', 'client'))
    if result != replica:
        return False
    if record:
        assert result[0] > 0 and result[0] == result[1] and not result[2], 'Native clean finish did not record a clean session best'
        assert not STATE['server_campaign'].get_editor_property('bRaceRetried'), 'Expected the clean attempt after actual reload'
        STATE['finished_race_result'] = result
    else:
        assert result == STATE['finished_race_result'], 'Late join or T replay erased the session lap result'
    REPORT.setdefault('session_race_results', []).append({'step': STEPS[STATE['step']][0],
                                                         **dict(zip(keys, result)), 'replicated': True})
    return True


def end_session():
    STATE.pop('foot_axis', None)
    STATE.pop('drive_axis', None)
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    if RENDER and worlds:
        # UE 5.8 Vulkan can delete pending viewport queries during PIE teardown.
        for world in worlds:
            u.GameplayStatics.set_enable_world_rendering(world, False)
        target = u.RenderingLibrary.create_render_target2d(worlds[0], 1, 1,
            u.TextureRenderTargetFormat.RTF_RGBA8, u.LinearColor(0, 0, 0, 1))
        assert target, 'GPU teardown fence target was not created'
        STATE['teardown_render_target'] = target
        u.RenderingLibrary.clear_render_target2d(worlds[0], target, u.LinearColor(0, 0, 0, 1))
        pixel = u.RenderingLibrary.read_render_target_pixel(worlds[0], target, 0, 0)
        assert pixel.r == pixel.g == pixel.b == 0 and pixel.a == 255, 'GPU teardown readback did not complete'
        REPORT['completed_gpu_teardown_drains'] = REPORT.get('completed_gpu_teardown_drains', 0) + 1
    LEVELS.editor_request_end_play()


def no_worlds():
    return not u.EditorLevelLibrary.get_pie_worlds(True)


def queue_capture(label):
    assert u.GameplayStatics.get_enable_world_rendering(STATE['client']), 'Native client viewport must render the capture'
    assert not u.GameplayStatics.get_enable_world_rendering(STATE['server']), 'Duplicate host viewport must stay disabled for inspection'
    path = OUT / (label + '.png')
    path.unlink(missing_ok=True)
    trace('native_screenshot_request', label=label, state=snapshot(STATE['server_campaign']))
    u.SystemLibrary.execute_console_command(STATE['client'],
        f'HighResShot {WIDTH}x{HEIGHT} filename="{path}"', STATE['client_pc'])
    STATE['capture'] = {'path': path, 'label': label, 'requested': time.monotonic()}


def capture_done():
    capture = STATE['capture']
    assert time.monotonic()-capture['requested'] < 25, 'Screenshot completion timeout'
    path = capture['path']
    if not path.exists():
        return False
    data = path.read_bytes()
    if len(data) < 10000 or not data.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'):
        return False
    assert len(data) < 100*1024*1024, 'Unexpected screenshot size'
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (WIDTH, HEIGHT), str(path)
    REPORT['captures'].append({'label': capture['label'], 'path': str(path.relative_to(ROOT)),
                               'dimensions': [WIDTH, HEIGHT], 'bytes': len(data),
                               'png_signature_ihdr_iend_complete': True})
    STATE.pop('capture')
    return True


def foot_position(anchor, offset=None, player='client'):
    """Place the authority character, leaving capsule height above the ground anchor."""
    point = STATE['server_campaign'].get_editor_property(anchor)
    offset = offset or u.Vector(0, -150, 0)
    point = u.Vector(point.x+offset.x, point.y+offset.y, max(110., point.z+offset.z))
    key = 'server_char' if player == 'client' else 'host_char'
    char = STATE[key]
    char.get_component_by_class(u.CharacterMovementComponent).stop_movement_immediately()
    relocate(char, point)
    STATE['foot_target'] = point


def foot_arrived():
    return distance(STATE['client_pc'].get_controlled_pawn().get_actor_location(), STATE['foot_target']) < 120


def interact(player='client'):
    native(STATE['client_pc' if player == 'client' else 'host_pc'], 'Interact')


def require_phase(expected, completed=None, gate=None):
    assert state_equal(expected, completed, gate), {
        side: snapshot(STATE[side+'_campaign']) for side in ('server', 'client')}
    return True


def unchanged_phase(expected, completed=0):
    assert require_phase(expected, completed)
    return partial_boundary_unchanged(completed)


def out_of_range_e_unchanged():
    assert isinstance(STATE['client_pc'].get_controlled_pawn(), u.QuebecCharacter), 'Out-of-range E unexpectedly entered a nearby car'
    return unchanged_phase(0)


def comic_weights(client_weight, host_weight=1):
    for pc, expected in ((STATE['client_pc'], client_weight), (STATE['host_pc'], host_weight)):
        camera = pc.get_controlled_pawn().get_component_by_class(u.CameraComponent)
        entries = camera.get_editor_property('post_process_settings').get_editor_property(
            'weighted_blendables').get_editor_property('array')
        comic = [e for e in entries if e.get_editor_property('object') and e.get_editor_property(
            'object').get_path_name() == '/Game/Art/Comic/M_ComicInk.M_ComicInk']
        if len(comic) != 1 or abs(comic[0].get_editor_property('weight')-expected) > .01:
            return False
    return True


def remember_appearance():
    STATE['before_style'] = STATE['server_char'].get_editor_property('CrewStyle')
    STATE['host_style'] = STATE['host_char'].get_editor_property('CrewStyle')
    STATE['before_appearance_phase'] = phase(STATE['server_campaign'])
    native(STATE['client_pc'], 'NextCharacter')


def appearance_preserved():
    expected = 3 if STATE['before_style'] >= 10 else STATE['before_style']+1
    if any(STATE[side+'_char'].get_editor_property('CrewStyle') != expected for side in ('server', 'client')):
        return False
    assert STATE['host_char'].get_editor_property('CrewStyle') == STATE['host_style']
    assert require_phase(STATE['before_appearance_phase'])
    return True


def car_entered():
    if not refresh_selected_car():
        return False
    for side in ('server', 'client'):
        car, char, pc = (STATE[side+suffix] for suffix in ('_car', '_char', '_pc'))
        if pc.get_controlled_pawn() != car or car.get_editor_property('Occupant') != char:
            if elapsed() > 1 and STATE.get('entry_diagnostic_step') != STATE['step']:
                STATE['entry_diagnostic_step'] = STATE['step']
                trace('entry_wait_diagnostic', side=side, pawn=pc.get_controlled_pawn().get_name(),
                      car=car.get_name(), car_position_cm=vec(car.get_actor_location()),
                      character_position_cm=vec(char.get_actor_location()),
                      character_to_car_cm=round(distance(char.get_actor_location(), car.get_actor_location()), 3),
                      occupant=car.get_editor_property('Occupant').get_name() if car.get_editor_property('Occupant') else None,
                      feedback=pc.get_editor_property('ResidentCaption'))
            return False
        if not char.get_editor_property('bInVehicle'):
            return False
        assert char.get_editor_property('bHidden') and not char.get_actor_enable_collision()
        assert car.get_actor_enable_collision(), 'Fixture must preserve car collision'
    return True


def car_exited():
    for side in ('server', 'client'):
        car, char, pc = (STATE[side+suffix] for suffix in ('_car', '_char', '_pc'))
        if pc.get_controlled_pawn() != char or car.get_editor_property('Occupant') or char.get_editor_property('bInVehicle'):
            return False
        assert not char.get_editor_property('bHidden') and char.get_actor_enable_collision()
    return True


def stop_drive():
    STATE.pop('drive_axis', None)
    car = STATE.get('client_car')
    if car and car.get_controller():
        car.call_method('MoveForward', (0.,))
        car.call_method('MoveRight', (0.,))
        native(car, 'ApplyHandbrake')


def approach_car():
    car = STATE['server_car']
    for offset in (car.get_actor_right_vector()*185, car.get_actor_right_vector()*-185,
                   car.get_actor_forward_vector()*300, car.get_actor_forward_vector()*-300):
        point = car.get_actor_location()+offset
        if any(other != car and distance(other.get_actor_location(), point) <= distance(car.get_actor_location(), point)+10
               for other in actors(STATE['server'], 'Car')):
            continue
        if u.SystemLibrary.capsule_trace_single_by_profile(STATE['server'], point, point+u.Vector(0, 0, .1),
                42, 88, 'Pawn', False, [STATE['server_char']], u.DrawDebugTrace.NONE, True):
            continue
        relocate(STATE['server_char'], point)
        STATE['foot_target'] = point
        return
    raise AssertionError('No clear capsule standing position selects the fixture car')


def disconnect():
    STATE.pop('foot_axis', None)
    stop_drive()
    STATE['departing_character'] = STATE['server_char']
    STATE['departing_light_operator'] = (STATE['server_campaign'].get_editor_property('LightOperator') ==
                                         STATE['server_pc'].get_editor_property('PlayerState'))
    trace('network_disconnect')
    u.SystemLibrary.execute_console_command(STATE['client'], 'disconnect', STATE['client_pc'])


def disconnected():
    if len(actors(STATE['server'], 'Controller')) != 1:
        return False
    assert not STATE['server_car'].get_editor_property('Occupant'), 'Disconnect stranded a car occupant'
    assert not any(a is STATE['departing_character'] for a in actors(STATE['server'], 'Character'))
    if STATE.get('departing_light_operator'):
        if STATE['server_campaign'].get_editor_property('LightOperator'):
            return False
        REPORT['active_light_operator_disconnect_released'] = True
    return True


def reconnect():
    clients = [w for w in u.EditorLevelLibrary.get_pie_worlds(True) if w != STATE['server']]
    assert len(clients) == 1, 'Disconnected client world is unavailable'
    local = u.GameplayStatics.get_player_controller(clients[0], 0)
    assert local, 'Disconnected client has no local controller'
    trace('network_reconnect', endpoint='127.0.0.1:17777')
    u.SystemLibrary.execute_console_command(clients[0], 'open 127.0.0.1:17777', local)


def select_car(property_name):
    car = STATE['server_campaign'].get_editor_property(property_name)
    assert car, property_name + ' did not spawn on clear ground'
    replica = STATE['client_campaign'].get_editor_property(property_name)
    STATE.update(server_car=car, client_car=replica, fixture_car_property=property_name)
    trace('select_campaign_car', property=property_name, server_actor=car.get_name(), client_actor=replica.get_name() if replica else None,
          identity='replicated campaign object reference')


def refresh_selected_car():
    """Resolve a loaner's current replica after crossing its relevancy boundary."""
    property_name = STATE.get('fixture_car_property')
    if not property_name:
        return True
    car = STATE['server_campaign'].get_editor_property(property_name)
    assert car == STATE['server_car'], 'Authority loan-car identity changed during fixture'
    replica = STATE['client_campaign'].get_editor_property(property_name)
    live = replica and any(replica is actor for actor in actors(STATE['client'], 'Car'))
    if not live:
        if elapsed() > 2 and STATE.get('replica_diagnostic_step') != STATE['step']:
            STATE['replica_diagnostic_step'] = STATE['step']
            trace('waiting_for_campaign_car_replica', property=property_name,
                  authority_position_cm=vec(car.get_actor_location()), current_reference_is_live=False)
        return False
    if replica is not STATE.get('client_car'):
        trace('refresh_campaign_car_replica', property=property_name, client_actor=replica.get_name(),
              identity='current replicated campaign object reference')
        STATE['client_car'] = replica
    return distance(car.get_actor_location(), replica.get_actor_location()) < 80


def car_approach_arrived():
    return foot_arrived() and refresh_selected_car()


def view_toward(point):
    origin = STATE['client_char'].get_actor_location()+u.Vector(0, 0, 35)
    delta = point-origin
    yaw = math.degrees(math.atan2(delta.y, delta.x))
    pitch = math.degrees(math.atan2(delta.z, math.hypot(delta.x, delta.y)))
    STATE['client_pc'].set_control_rotation(u.Rotator(pitch=pitch, yaw=yaw))


def worklight_fixture():
    foot_position('WorklightLocation', u.Vector(160, -70, 20))
    # Deliberately misaligned until the explicit aim step.
    STATE['client_pc'].set_control_rotation(u.Rotator(yaw=65))


def aiming():
    for side in ('server', 'client'):
        if STATE[side+'_campaign'].get_editor_property('LightOperator') != STATE[side+'_pc'].get_editor_property('PlayerState'):
            return False
    return require_phase(0, 0)


def recover_distant_host():
    point = STATE['server_campaign'].get_editor_property('WorklightLocation')
    assert distance(STATE['host_char'].get_actor_location(), point) > 1000, 'Host must be distant from the active tool'
    assert aiming(), 'Client must own the deliberately misaligned worklight before host recovery'
    native(STATE['host_pc'], 'RetryCampaign')


def friend_recovery_preserved_aim():
    assert require_phase(0, 0), 'Friend recovery changed the opening phase'
    for side in ('server', 'client'):
        assert STATE[side+'_campaign'].get_editor_property('LightOperator') == STATE[side+'_pc'].get_editor_property('PlayerState'), 'Friend recovery cancelled the active light operator'
    REPORT['friend_recovery_preserved_light_operator'] = True
    return partial_boundary_unchanged(0)


def release_with_authority_delay():
    assert aiming(), 'Client must own the misaligned light before delayed-replication regression'
    u.SystemLibrary.execute_console_command(STATE['server'], 'NetEmulation.PktLag 900', STATE['host_pc'])
    STATE['authority_lag_override'] = True
    trace('network_emulation_override', peer='host', outgoing_lag_ms=900,
          purpose='delayed ownership replication; client outgoing lag stays at baseline')
    native(STATE['client_pc'], 'Interact')


def worklight_released():
    assert require_phase(0, 0)
    return all(not STATE[side+'_campaign'].get_editor_property('LightOperator') for side in ('server', 'client'))


def acquire_before_ownership_replication():
    STATE.pop('delayed_light_acquired_at', None)
    native(STATE['client_pc'], 'Interact')


def authority_aim_survives_delayed_ownership():
    assert require_phase(0, 0)
    campaign = STATE['server_campaign']
    operator = campaign.get_editor_property('LightOperator')
    expected = STATE['server_pc'].get_editor_property('PlayerState')
    if operator != expected:
        assert 'delayed_light_acquired_at' not in STATE, 'Authority lost the operator before delayed client ownership arrived'
        return False
    now = u.GameplayStatics.get_time_seconds(STATE['server'])
    if 'delayed_light_acquired_at' not in STATE:
        STATE['delayed_light_acquired_at'] = now
        trace('delayed_ownership_authority_acquired', state=snapshot(campaign))
    held = now-STATE['delayed_light_acquired_at']
    assert not STATE['client_campaign'].get_editor_property('LightOperator'), 'Fixture did not retain the intended 900 ms ownership delay'
    if held < .65:
        return False
    REPORT['delayed_ownership_bootstrap'] = {
        'authority_outgoing_lag_ms': 900, 'client_outgoing_lag_ms': 100 if LAG else 0,
        'observed_authority_hold_before_client_ownership_seconds': round(held, 4),
        'client_ownership_still_absent': True, 'native_client_E': True,
        'server': snapshot(campaign), 'client': snapshot(STATE['client_campaign'])}
    return True


def restore_authority_lag():
    if STATE.pop('authority_lag_override', False):
        baseline = 100 if LAG else 0
        u.SystemLibrary.execute_console_command(STATE['server'], 'NetEmulation.PktLag '+str(baseline), STATE['host_pc'])
        trace('network_emulation_override_restored', peer='host', outgoing_lag_ms=baseline)
        if 'delayed_ownership_bootstrap' in REPORT:
            REPORT['delayed_ownership_bootstrap']['authority_lag_restored_ms'] = baseline


def align_worklight(player='client'):
    a = STATE['server_campaign']
    delta = a.get_editor_property('FirstClampLocation')-a.get_editor_property('WorklightLocation')
    yaw = math.degrees(math.atan2(delta.y, delta.x))
    pitch = math.degrees(math.atan2(delta.z, math.hypot(delta.x, delta.y)))
    trace('native_aim_control_rotation', yaw=yaw, pitch=pitch)
    STATE['client_pc' if player == 'client' else 'host_pc'].set_control_rotation(u.Rotator(yaw=yaw, pitch=pitch))


def priority_fixture():
    select_car('LightCar')
    STATE['priority_position'] = STATE['server_car'].get_actor_location()
    STATE['priority_yaw'] = STATE['server_car'].get_actor_rotation().yaw
    point = STATE['server_campaign'].get_editor_property('WorklightLocation')+u.Vector(0, -100, 12)
    relocate(STATE['server_car'], point, 90)
    # Use the passing smoke fixture's clear side approach, never a point inside
    # the car's 220x108 cm half-extents. Both car and tool must be in reach.
    approach_car()
    tool = STATE['server_campaign'].get_editor_property('WorklightLocation')
    assert distance(STATE['foot_target'], tool) < 220, 'Priority fixture must make both interactions eligible'
    trace('priority_fixture_clearance', character_to_car_cm=round(distance(STATE['foot_target'], point), 3),
          character_to_worklight_cm=round(distance(STATE['foot_target'], tool), 3),
          capsule_clear=True)


def restore_priority_car():
    relocate(STATE['server_car'], STATE.pop('priority_position'), STATE.pop('priority_yaw'))


def jump_fixture():
    foot_position('JumpGateLocation', u.Vector(0, -400, 103))
    STATE['client_pc'].set_control_rotation(u.Rotator(yaw=90))


def start_sprint():
    STATE['foot_start'] = STATE['server_char'].get_actor_location()
    STATE['foot_axis'] = 'MoveForward'
    native(STATE['client_char'], 'StartSprint')
    trace('native_foot_movement_window', method='MoveForward', axis=1., start_cm=vec(STATE['foot_start']))


def sprint_ready():
    v = STATE['server_char'].get_velocity()
    return math.hypot(v.x, v.y) > 580


def jump_crossed():
    if not state_equal(2, 0):
        return False
    a = STATE['server_campaign']
    assert a.get_editor_property('bSprintSeen') and a.get_editor_property('bJumpSeen')
    travel = distance(STATE['server_char'].get_actor_location(), STATE['foot_start'])
    assert travel > 300, 'Cable step did not contain actual native movement'
    REPORT['cable_crossing'] = {'native_displacement_cm': round(travel, 2), 'sprint_and_airborne_observed_by_authority': True,
        'authority_position_cm': vec(STATE['server_char'].get_actor_location()),
        'still_airborne_when_replicated_phase_observed': STATE['server_char'].get_component_by_class(u.CharacterMovementComponent).is_falling()}
    if STATE.pop('foot_axis', None):
        native(STATE['client_char'], 'StopSprint')
        native(STATE['client_char'], 'StopJumping')
    captions = {side: STATE[side+'_pc'].get_editor_property('ResidentCaption') for side in ('client', 'host')}
    if any(captions.values()):
        return False  # Wait for the ordinary reliable phase-change feedback clear.
    REPORT.setdefault('phase_feedback_cleared', []).append({'step': STEPS[STATE['step']][0],
                                                          'phase': 2, 'captions': captions})
    return True


def landed():
    return all(not STATE[side+'_char'].get_component_by_class(u.CharacterMovementComponent).is_falling()
               for side in ('server', 'client'))


def clamp_fixture(anchor):
    foot_position(anchor, u.Vector(-155, 0, 0))
    view_toward(STATE['server_campaign'].get_editor_property(anchor))


def beat(open_beat):
    # Choose the interior of an observed release/closed beat, allowing RPC latency.
    clock = u.GameplayStatics.get_time_seconds(STATE['server']) % 6
    safe = .2 < clock < 1.0 if open_beat else 3.1 < clock < 4.3
    return safe and STATE['server_campaign'].get_editor_property('bClampOpen') == open_beat


def bay_direction():
    a = STATE['server_campaign']
    delta = a.get_editor_property('FinalClampLocation')-a.get_editor_property('CarLightLocation')
    length = math.hypot(delta.x, delta.y)
    return u.Vector(delta.x/length, delta.y/length, 0)


def bay_fixture(wrong_angle=False):
    a = STATE['server_campaign']
    point = a.get_editor_property('CarLightLocation')
    direction = bay_direction()
    yaw = math.degrees(math.atan2(direction.y, direction.x))
    relocate(STATE['server_car'], point if wrong_angle else point-direction*650, yaw+(180 if wrong_angle else 0))
    STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-8, yaw=yaw))
    STATE['bay_target'] = point


def start_drive(player='client'):
    pc = STATE['client_pc' if player == 'client' else 'host_pc']
    car = STATE['client_car' if player == 'client' else 'server_car']
    car.disable_input(pc)
    car.call_method('MoveRight', (0.,))
    STATE['drive_actor'] = car
    STATE['drive_player'] = player
    STATE['drive_axis'] = 1.
    STATE['drive_start'] = STATE['server_car'].get_actor_location()
    native(car, 'ReleaseHandbrake')
    trace('native_drive_window', player=player, method='MoveForward', axis=1., start_cm=vec(STATE['drive_start']))


def brake():
    STATE.pop('drive_axis', None)
    car = STATE.get('drive_actor', STATE['client_car'])
    car.call_method('MoveForward', (0.,))
    car.call_method('MoveRight', (0.,))
    native(car, 'ApplyHandbrake')


def bay_brake_point():
    car = STATE['server_car']
    delta = STATE['bay_target']-car.get_actor_location()
    remaining = delta.x*bay_direction().x+delta.y*bay_direction().y
    speed = abs(car.get_editor_property('Speed'))
    if remaining > speed*speed/(2*2300)+speed*.12+25:
        return False
    travel = distance(car.get_actor_location(), STATE['drive_start'])
    assert travel > 150, 'Bay was not approached by actual native drive input'
    REPORT['car_light_drive_cm'] = round(travel, 2)
    brake()
    return True


def car_stopped():
    return abs(STATE['server_car'].get_editor_property('Speed')) < 1 and abs(STATE['server_car'].get_editor_property('LateralSpeed')) < 1


def bay_complete():
    if not state_equal(4, 0):
        return False
    car = STATE['server_car']
    assert distance(car.get_actor_location(), STATE['bay_target']) < 235
    assert car.get_actor_enable_collision()
    return car_entered()


def rotate_parked_beam(wrong):
    car = STATE['server_car']
    direction = bay_direction()
    yaw = math.degrees(math.atan2(direction.y, direction.x))+(180 if wrong else 0)
    relocate(car, car.get_actor_location(), yaw)


def gate_fixture(index):
    a = STATE['server_campaign']
    point = a.get_editor_property('RaceGates')[index]
    direction = a.get_editor_property('RaceDirections')[index]
    yaw = math.degrees(math.atan2(direction.y, direction.x))
    right = u.Vector(-direction.y, direction.x, 0)
    before = point-direction*650+right*(0 if index == 5 else 145)
    before.z = 102
    relocate(STATE['server_car'], before, yaw)
    STATE['gate_fixture'] = index
    STATE['gate_before'] = before
    STATE['gate_direction'] = direction
    STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-8, yaw=yaw))
    trace('race_gate_fixture', gate=index, point_cm=vec(point), direction=vec(direction))


def gate_fixture_arrived():
    return distance(STATE['client_car'].get_actor_location(), STATE['gate_before']) < 80 and car_stopped()


def gate_crossed(expected_index, expected_phase=6):
    if not state_equal(expected_phase, 2 if expected_phase == 7 else 1, expected_index):
        return False
    travel = distance(STATE['server_car'].get_actor_location(), STATE['drive_start'])
    assert travel > 450, 'Race gate advanced without a genuine drive window'
    REPORT.setdefault('driven_gates', []).append({'gate_fixture': STATE['gate_fixture'], 'next_gate': expected_index,
        'native_displacement_cm': round(travel, 2), 'authority_position_cm': vec(STATE['server_car'].get_actor_location())})
    brake()
    return True


def skipped_gate_rejected():
    a = STATE['server_campaign']
    point = a.get_editor_property('RaceGates')[STATE['gate_fixture']]
    direction = STATE['gate_direction']
    after = STATE['server_car'].get_actor_location()-point
    if after.x*direction.x+after.y*direction.y < 100:
        return False
    assert require_phase(6, 1, 1), 'Out-of-order gate advanced the race'
    brake()
    REPORT['skipped_future_gate_rejected'] = STATE['gate_fixture']
    return True


def retry_preserved():
    if not state_equal(6, 1, 1):
        return False
    if not all(STATE[side+'_campaign'].get_editor_property('bRaceRetried') for side in ('server', 'client')):
        return False
    assert car_entered(), 'Retry lost car possession/collision'
    assert partial_boundary_unchanged(1)
    expected = STATE['server_campaign'].get_editor_property('RaceGates')[0]-STATE['server_campaign'].get_editor_property('RaceDirections')[0]*650
    assert distance(STATE['server_car'].get_actor_location(), expected) < 550, 'Retry did not restore last banked checkpoint vicinity'
    if distance(STATE['server_car'].get_actor_location(), STATE['client_car'].get_actor_location()) > 10:
        return False
    REPORT['native_retry'] = {'banked_next_gate': 1, 'completed_missions': 1, 'position_cm': vec(STATE['server_car'].get_actor_location()),
        'peer_position_error_cm': round(distance(STATE['server_car'].get_actor_location(), STATE['client_car'].get_actor_location()), 4)}
    if not car_stopped():
        return False
    probe = retry_camera_probe()
    if 'retry_camera_first' not in STATE:
        STATE['retry_camera_first'] = probe
        STATE['retry_camera_settle_started'] = time.monotonic()
    REPORT['native_retry']['camera_first'] = STATE['retry_camera_first']
    if RENDER and time.monotonic()-STATE['retry_camera_settle_started'] < .5:
        return False
    REPORT['native_retry']['camera_after_settle'] = probe
    return True


def retry_camera_probe():
    car = STATE['client_car']
    camera = car.get_component_by_class(u.CameraComponent)
    boom = car.get_component_by_class(u.SpringArmComponent)
    control = STATE['client_pc'].get_control_rotation()
    return {'camera_position_cm': vec(camera.get_world_location()),
            'car_position_cm': vec(car.get_actor_location()),
            'camera_distance_from_car_cm': round(distance(camera.get_world_location(), car.get_actor_location()), 4),
            'control_rotation': {'yaw': round(control.yaw, 4), 'pitch': round(control.pitch, 4)},
            'target_arm_length_cm': boom.get_editor_property('TargetArmLength'),
            'collision_test_enabled': boom.get_editor_property('bDoCollisionTest'),
            'collision_fix_applied': boom.is_collision_fix_applied(),
            'unfixed_camera_position_cm': vec(boom.get_unfixed_camera_position())}


def restored_terrace_view(ready):
    if not ready():
        return False
    if not RENDER:
        return True
    if STATE.get('terrace_view_step') != STATE['step']:
        # Presentation-only turn toward the actual PressTable/PaperGuest group.
        point = STATE['server_campaign'].get_editor_property('FinalClampLocation')+u.Vector(320, -80, -20)
        view_toward(point)
        yaw = STATE['client_pc'].get_control_rotation().yaw
        STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-20, yaw=yaw))
        trace('presentation_camera_fixture', target='restored table and paper guests', target_cm=vec(point),
              yaw=yaw, pitch=-20, actor_progress_writes=False)
        STATE['terrace_view_step'] = STATE['step']
        STATE['terrace_view_started'] = time.monotonic()
        return False
    return time.monotonic()-STATE['terrace_view_started'] >= .8


def loaded(expected_phase, completed):
    if not discover() or not state_equal(expected_phase, completed, 0):
        return False
    if expected_phase == 5 and not race_ready_projection():
        return False
    if completed:
        return save_boundary(completed)
    return partial_boundary_unchanged(0)


def race_ready_projection():
    """The visible guide must be near the actual start and face its route."""
    probes = []
    for side in ('server', 'client'):
        actor = STATE[side+'_campaign']
        point = actor.get_editor_property('RivalLocation')
        start = actor.get_editor_property('RaceGates')[0]
        direction = actor.get_editor_property('RaceDirections')[0]
        yaw = math.radians(actor.get_editor_property('RivalYaw'))
        facing_dot = math.cos(yaw)*direction.x+math.sin(yaw)*direction.y
        if distance(point, start) > 220 or facing_dot < .9:
            return False
        probes.append({'peer': side, 'position_cm': vec(point),
                       'distance_to_start_cm': round(distance(point, start), 4), 'facing_dot': round(facing_dot, 6)})
    REPORT.setdefault('race_ready_projection', []).append({'step': STEPS[STATE['step']][0], 'peers': probes})
    return True


def host_advance_while_away():
    # Remote player is absent. The remaining host performs a native worklight action.
    foot_position('WorklightLocation', u.Vector(160, -70, 20), player='host')
    STATE['host_pc'].set_control_rotation(u.Rotator(yaw=25))
    interact('host')


def host_aiming():
    return STATE['server_campaign'].get_editor_property('LightOperator') == STATE['host_pc'].get_editor_property('PlayerState')


def seed_unsupported_save():
    assert no_worlds(), 'Seed the isolated future-version save only after PIE ends'
    save_class = u.load_class(None, '/Script/Quebec.QuebecCampaignSaveGame')
    saved = u.GameplayStatics.create_save_game_object(save_class)
    # These writes construct a disk fixture, never live gameplay progression.
    # VisibleAnywhere is EditConst to Python. The native reflection setter
    # constructs only this transient QA save object, never a campaign actor.
    SYSTEM.call_method('SetIntPropertyByName', (saved, 'Version', 2))
    SYSTEM.call_method('SetIntPropertyByName', (saved, 'CompletedMissions', 1))
    assert u.GameplayStatics.save_game_to_slot(saved, SLOT, 0), 'Future-version QA fixture write failed'
    STATE['unsupported_save_hash'] = hashlib.sha256(SAVE_PATH.read_bytes()).hexdigest()
    trace('isolated_save_fixture', slot=SLOT, version=2, completed_missions=1,
          sha256=STATE['unsupported_save_hash'], format='native SaveGameToSlot')
    return unsupported_save_unchanged()


def unsupported_save_unchanged():
    assert hashlib.sha256(SAVE_PATH.read_bytes()).hexdigest() == STATE['unsupported_save_hash'], 'Unsupported save bytes were overwritten'
    saved = u.GameplayStatics.load_game_from_slot(SLOT, 0)
    assert saved and saved.get_editor_property('Version') == 2 and saved.get_editor_property('CompletedMissions') == 1
    return True


def unsupported_save_warning():
    return all(STATE[side+'_campaign'].get_editor_property('SaveStatus') ==
               'Save unreadable; session progress only' for side in ('server', 'client'))


def unsupported_loaded():
    return discover() and state_equal(0, 0, 0) and unsupported_save_warning() and unsupported_save_unchanged()


def unsupported_completion_preserved():
    if not state_equal(5, 1) or not unsupported_save_warning():
        return False
    assert unsupported_save_unchanged()
    REPORT['unsupported_save_preservation'] = {
        'slot': SLOT, 'fixture_version': 2, 'fixture_completed_missions': 1,
        'native_m1_completion_attempted': True, 'live_completed_missions': 1,
        'original_sha256': STATE['unsupported_save_hash'], 'unchanged_after_completion': True,
        'warning_on_both_peers': True}
    return True


# First session tests invalid actions and tools, then deliberately reloads unfinished M1.
step('fresh two-player campaign in isolated save slot', begin, lambda: discover() and state_equal(0, 0, 0))
step('both players start in standard view', lambda: None, lambda: comic_weights(0, 0))
# Establish the comic baseline used by the existing tool and capture checks.
step('both players enable comic view independently',
     lambda: [native(STATE[side+'_pc'], 'ToggleComicStyle') for side in ('host', 'client')],
     lambda: comic_weights(1, 1))
step('fixture keeps opening E outside car and worklight range',
     lambda: foot_position('WorklightLocation', u.Vector(-800, 0, -20)), foot_arrived)
step('out-of-range E cannot advance opening', lambda: interact(), out_of_range_e_unchanged)
step('fixture approaches future table clamp', lambda: clamp_fixture('FinalClampLocation'), foot_arrived)
step('future clamp E cannot skip worklight', interact, lambda: unchanged_phase(0))
step('fixture places loan car beside worklight', priority_fixture, foot_arrived)
step('E enters nearby car before tool action', interact, lambda: car_entered() and unchanged_phase(0))
step('vehicle E exits without operating worklight', interact, lambda: car_exited() and unchanged_phase(0))
step('restore loan car after interaction priority fixture', restore_priority_car, lambda: car_stopped())
step('approach worklight with deliberately wrong aim', worklight_fixture, foot_arrived)
step('native E acquires worklight without completing aim', interact, aiming, 'WorklightAim')
step('C changes only owning appearance while tool remains usable', remember_appearance, lambda: appearance_preserved() and aiming())
step('F2 standard view is private and preserves worklight', lambda: native(STATE['client_pc'], 'ToggleComicStyle'), lambda: comic_weights(0) and aiming())
step('F2 restores comic view with tool preserved', lambda: native(STATE['client_pc'], 'ToggleComicStyle'), lambda: comic_weights(1) and aiming())
step('distant host R preserves client worklight ownership and opening phase', recover_distant_host, friend_recovery_preserved_aim)
step('delay host ownership replication and release worklight on both peers', release_with_authority_delay, worklight_released)
step('authority keeps native aim alive before delayed ownership reaches client', acquire_before_ownership_replication,
     authority_aim_survives_delayed_ownership, delay=0)
step('restore host packet lag and observe replicated light ownership', restore_authority_lag, aiming)
step('native control rotation holds aligned worklight on authority', align_worklight, lambda: state_equal(1, 0), 'AlignedWorklight')
step('unfinished M1 does not write completed mission', lambda: None, lambda: partial_boundary_unchanged(0))
step('stop unfinished M1 session', end_session, no_worlds)
step('actual reload discards unfinished M1 phase', start_session, lambda: loaded(0, 0))

# Missing player returns to an encounter that the host has actually advanced.
step('client approaches worklight before active-owner departure', worklight_fixture, foot_arrived)
step('client acquires worklight before disconnect', interact, aiming)
step('active light owner departure releases shared tool', disconnect,
     lambda: disconnected() and phase(STATE['server_campaign']) == 0 and partial_boundary_unchanged(0))
step('remaining host acquires shared worklight', host_advance_while_away, host_aiming)
step('remaining host actually advances opening while peer is absent', lambda: align_worklight('host'), lambda: phase(STATE['server_campaign']) == 1)
step('client late-joins new shared opening phase', reconnect, lambda: discover() and state_equal(1, 0))
step('return host helper to surveyed spawn clear of later car approach',
     lambda: relocate(STATE['host_char'], u.Vector(*LAYOUT['spawn'])),
     lambda: distance(STATE['host_char'].get_actor_location(), u.Vector(*LAYOUT['spawn'])) < 120)
step('approach clamp before doing sprint and jump', lambda: clamp_fixture('FirstClampLocation'), foot_arrived)
step('E cannot replace required sprint and airborne cable crossing', interact, lambda: unchanged_phase(1))
step('fixture starts before blocking cable', jump_fixture, foot_arrived)
step('native sprint builds actual authority velocity', start_sprint, sprint_ready, timeout=5, delay=0)
step('native jump crosses blocking cable while airborne', lambda: native(STATE['client_char'], 'Jump'), jump_crossed, timeout=5, delay=0)
step('native jumper lands safely', lambda: None, landed)
step('approach exposed first clamp', lambda: clamp_fixture('FirstClampLocation'), foot_arrived, 'FirstClamp')
step('observe safe interior of closed clamp beat', lambda: None, lambda: beat(False), timeout=8)
step('closed-beat E cannot pull clamp', interact, lambda: unchanged_phase(2))
step('observe safe interior of green clamp beat', lambda: None, lambda: beat(True), timeout=8)
step('green-beat native plunger action advances first latch', interact, lambda: state_equal(3, 0), 'FirstClampPull', delay=.15)
step('select and approach car-light loaner', lambda: (select_car('LightCar'), approach_car()), car_approach_arrived)
step('inspect light-car prompt beside active briefing before E',
     lambda: view_toward(STATE['server_car'].get_actor_location()+u.Vector(0, 0, 70)),
     lambda: car_approach_arrived() and state_equal(3, 0), 'CarEntryPrompt')
step('client enters car for second beam', interact, car_entered)
step('fixture parks car backwards in light bay', lambda: bay_fixture(True), lambda: car_stopped() and unchanged_phase(3), delay=1.3)
step('arrange clear bay approach without advancing mission', lambda: bay_fixture(False), lambda: car_stopped() and unchanged_phase(3))
step('native throttle physically approaches light bay', start_drive, bay_brake_point, timeout=8, delay=0)
step('native brake and stable aligned car unlock table release', lambda: None, bay_complete, 'CarLightBay', timeout=8)
step('vehicle E exits without pulling distant table clamp', interact, lambda: car_exited() and unchanged_phase(4))
step('approach table clamp after car exit', lambda: clamp_fixture('FinalClampLocation'), foot_arrived)
step('fixture turns parked car away from table', lambda: rotate_parked_beam(True), lambda: True)
step('table E rejects invalid parked beam', interact, lambda: unchanged_phase(4))
step('restore physical parked beam direction', lambda: rotate_parked_beam(False), lambda: True)
step('wait for green table release beat', lambda: None, lambda: beat(True), timeout=8)
step('native final clamp rescues guests and writes actual save1', interact,
     lambda: restored_terrace_view(lambda: state_equal(5, 1) and race_ready_projection() and save_boundary(1)), 'TerraceRestored')
step('select and approach race loaner', lambda: (select_car('LoanCar'), approach_car()), car_approach_arrived)
step('native E enters race loaner', interact, car_entered)
step('place race car before actual start plane', lambda: gate_fixture(0), gate_fixture_arrived)
step('native driving crosses start and begins timed race', start_drive, lambda: gate_crossed(1), 'RaceStarted', timeout=8, delay=0)
step('stop race car before retry check', lambda: None, car_stopped)
step('native R restores banked start without erasing M1', lambda: native(STATE['client_pc'], 'RetryCampaign'), retry_preserved, 'RaceRetry')
step('unfinished race retains actual save1', lambda: None, lambda: partial_boundary_unchanged(1))
step('stop unfinished race session', end_session, no_worlds)
step('actual reload returns unfinished race to ready boundary1', start_session, lambda: loaded(5, 1))
step('select and approach fresh race loaner', lambda: (select_car('LoanCar'), approach_car()), car_approach_arrived)
step('client enters race after boundary reload', interact, car_entered)
step('restore actual start approach after reload', lambda: gate_fixture(0), gate_fixture_arrived)
step('drive through start after boundary reload', start_drive, lambda: gate_crossed(1), timeout=8, delay=0)
step('brake before future-gate rejection fixture', lambda: None, car_stopped)
step('arrange future gate3 while gate1 is required', lambda: gate_fixture(3), gate_fixture_arrived)
step('driving through a future gate cannot skip ordered gate1', start_drive, skipped_gate_rejected, timeout=8, delay=0)
step('brake after rejected future gate', lambda: None, car_stopped)
for index in range(1, 7):
    step(f'arrange native approach to ordered gate{index}', lambda index=index: gate_fixture(index), gate_fixture_arrived)
    step(f'native drive crosses required gate{index}', start_drive,
         lambda index=index: gate_crossed(index+1, 7 if index == 6 else 6),
         'SliceComplete' if index == 6 else 'BlueAlternativeGate' if index == 5 else None, timeout=8, delay=0)
    step(f'brake after ordered gate{index}', lambda: None, car_stopped)
step('second mission writes actual completed save2', lambda: None, lambda: save_boundary(2))
step('native ordered clean finish records the replicated session best', lambda: None, lambda: race_result_preserved(True))
step('client departs completed shared slice', disconnect, disconnected)
step('late join receives both banked missions and final gate', reconnect, lambda: discover() and state_equal(7, 2, 7) and race_result_preserved())
step('native T preserves replicated lap result and saved missions', lambda: native(STATE['client_pc'], 'ReplayCampaign'),
     lambda: state_equal(5, 2, 0) and race_result_preserved() and save_boundary(2))
step('stop completed slice session', end_session, no_worlds)
step('actual reload restores both completed missions', start_session, lambda: loaded(7, 2))
step('ordinary E cannot increment completed campaign', interact, lambda: require_phase(7, 2) and partial_boundary_unchanged(2))
step('native T offers race replay while preserving saved2', lambda: native(STATE['client_pc'], 'ReplayCampaign'), lambda: state_equal(5, 2, 0) and race_ready_projection() and save_boundary(2))


# An unsupported on-disk save must survive an actual later boundary-write attempt.
# Reuse the accepted native rescue actions; only their persistence expectation
# differs. This never writes Phase, CompletedMissions or race state on an actor.
RESCUE_STEPS = {entry[0]: entry for entry in STEPS}
step('stop replay session before unsupported-save fixture', end_session, no_worlds)
step('seed native-format future Version2 isolated save', seed_unsupported_save, unsupported_save_unchanged)
step('future save reload opens fresh session with replicated warning', start_session, unsupported_loaded, 'FutureSaveWarning')
FUTURE_RESCUE = (
    'approach worklight with deliberately wrong aim',
    'native E acquires worklight without completing aim',
    'native control rotation holds aligned worklight on authority',
    'fixture starts before blocking cable',
    'native sprint builds actual authority velocity',
    'native jump crosses blocking cable while airborne',
    'native jumper lands safely',
    'approach exposed first clamp',
    'observe safe interior of green clamp beat',
    'green-beat native plunger action advances first latch',
    'select and approach car-light loaner',
    'client enters car for second beam',
    'arrange clear bay approach without advancing mission',
    'native throttle physically approaches light bay',
    'native brake and stable aligned car unlock table release',
    'vehicle E exits without pulling distant table clamp',
    'approach table clamp after car exit',
    'wait for green table release beat',
    'native final clamp rescues guests and writes actual save1',
)
FUTURE_READY = {
    'arrange clear bay approach without advancing mission': lambda: car_stopped() and state_equal(3, 0) and unsupported_save_unchanged(),
    'vehicle E exits without pulling distant table clamp': lambda: car_exited() and state_equal(4, 0) and unsupported_save_unchanged(),
    'native final clamp rescues guests and writes actual save1': lambda: restored_terrace_view(unsupported_completion_preserved),
}
for name in FUTURE_RESCUE:
    _, action, ready, capture, timeout, delay = RESCUE_STEPS[name]
    label = 'native final clamp completes M1 but preserves future save' if name in FUTURE_READY and name.startswith('native final') else name
    step('future-save / '+label, action, FUTURE_READY.get(name, ready),
         'FutureSave'+capture if capture else None, timeout, delay)
step('future save remains byte-identical after attempted M1 boundary write', lambda: None, unsupported_completion_preserved)


def finish(error=None):
    if STATE.get('finishing'):
        return
    STATE['finishing'] = True
    STATE['finish_error'] = error
    STATE['cleanup_started'] = time.monotonic()
    STATE.pop('foot_axis', None)
    STATE.pop('drive_axis', None)
    if error:
        REPORT['failed_step'] = STEPS[max(0, STATE['step'])][0]
        REPORT['error'] = error
        for side in ('server', 'client'):
            try:
                REPORT.setdefault('failure_states', {})[side] = snapshot(STATE[side+'_campaign'])
                REPORT.setdefault('failure_players', {})[side] = player_probe(side)
            except Exception:
                pass
        u.log_error('NORD_STORY_SLICE_FAILED ' + error)
    try:
        restore_authority_lag()
    except Exception as restore_error:
        # EndPlay below destroys the per-world emulation even after teardown.
        REPORT['authority_lag_restore_before_endplay_error'] = str(restore_error)
    end_session()


def cleanup():
    # EndPlay may save a boundary. Never restore/delete the QA slot while PIE is alive.
    if not no_worlds():
        assert time.monotonic()-STATE['cleanup_started'] < 15, 'PIE did not stop; QA slot not restored'
        return
    if STATE.get('qa_slot_initialized'):
        if QA_OLD_BYTES is None:
            SAVE_PATH.unlink(missing_ok=True)
        else:
            SAVE_DIR.mkdir(parents=True, exist_ok=True)
            SAVE_PATH.write_bytes(QA_OLD_BYTES)
        REPORT['qa_slot_restored'] = ((SAVE_PATH.read_bytes() == QA_OLD_BYTES) if QA_OLD_BYTES is not None else not SAVE_PATH.exists())
        assert REPORT['qa_slot_restored'], 'Isolated QA slot restore failed'
    current = {str(p.relative_to(SAVE_DIR)): hashlib.sha256(p.read_bytes()).hexdigest()
               for p in SAVE_DIR.rglob('*.sav') if p != SAVE_PATH} if SAVE_DIR.exists() else {}
    REPORT['production_save_hashes_unchanged'] = current == PRODUCTION_SAVES
    assert REPORT['production_save_hashes_unchanged'], 'A production/non-QA save changed'
    for key, value in ORIGINAL.items():
        SETTINGS.set_editor_property(key, value)
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
    REPORT['editor_play_settings_restored'] = all(SETTINGS.get_editor_property(k) == v for k, v in ORIGINAL.items())
    REPORT['restored_play_net_mode'] = ORIGINAL_MODE
    write_report()


def write_report():
    if STATE.pop('viewport_realtime_override', False):
        # UE5.8 removes the subsystem override here; it does not force the
        # underlying user realtime setting on (LevelEditorSubsystem.cpp223).
        LEVELS.editor_set_viewport_realtime(True)
        REPORT['editor_viewport_realtime_override_released'] = True
    STATE['finished'] = True
    REPORT['passed'] = not STATE.get('finish_error')
    REPORT['elapsed_seconds'] = round(time.monotonic()-STATE['started'], 2)
    name = ('StorySliceLag' if LAG else 'StorySlice') + (f'Render{WIDTH}' if RENDER else '')
    path = TEST_OUT / (name + '.json')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(REPORT, indent=2), encoding='utf-8')
    if REPORT['passed']:
        u.log('NORD_STORY_SLICE_OK ' + str(len(REPORT['checks'])) + ' checks passed; report ' + str(path))
    u.unregister_slate_post_tick_callback(STATE['callback'])
    SCRIPTING.call_method('SetKeepPythonScriptAlive', (False,))


def tick(delta_seconds):
    if STATE['finished'] or STATE.get('ticking'):
        return
    STATE['ticking'] = True
    try:
        if STATE.get('finishing'):
            cleanup()
            return
        observe_light_operator()
        assert time.monotonic()-STATE['started'] < 480, 'Story suite total timeout'
        if STATE['step'] < 0:
            if time.monotonic()-STATE['started'] < 1:
                return
            STATE['step'] = 0
            start_step()
        name, action, ready, capture, timeout, delay = STEPS[STATE['step']]
        assert time.monotonic()-STATE['step_started'] < timeout, 'Step timeout: ' + name
        if STATE.get('capture'):
            if not capture_done():
                return
        else:
            if STATE.get('foot_axis'):
                STATE['client_char'].call_method(STATE['foot_axis'], (1.,))
            if STATE.get('drive_axis'):
                STATE['drive_actor'].call_method('MoveForward', (STATE['drive_axis'],))
            if elapsed() < delay or not ready():
                return
            if RENDER and capture:
                queue_capture(capture)
                return
        REPORT['checks'].append(name)
        trace('check_passed')
        u.log('NORD_STORY_SLICE_CHECK ' + name)
        STATE['step'] += 1
        if STATE['step'] == len(STEPS):
            finish()
        else:
            start_step()
    except Exception:
        error = traceback.format_exc()
        if STATE.get('finishing'):
            STATE['finish_error'] = (STATE.get('finish_error') or '') + '\nCleanup failure:\n' + error
            REPORT['error'] = STATE['finish_error']
            # Retain a failure report and unlock scripting even if cleanup could not finish.
            for key, value in ORIGINAL.items():
                SETTINGS.set_editor_property(key, value)
            SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
            write_report()
        else:
            finish(error)
    finally:
        STATE['ticking'] = False


SCRIPTING.call_method('SetKeepPythonScriptAlive', (True,))
STATE['callback'] = u.register_slate_post_tick_callback(tick)
u.log('NORD_STORY_SLICE_START awaiting isolated two-player PIE')
