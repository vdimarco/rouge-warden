"""Native two-player resident QA; run serially with LaFontaine loaded.

Require -NordResidentFeedbackQA -NordCampaignQA -NordNoCampaignSave. NullRHI
checks reactions and private E dialogue; add -NordResidentRenderChecks without
NullRHI to check ambient captions and capture the owning native viewport.
Use -NordCaptureWidth=1280|1920 and a matching 16:9 native client viewport.
Only authority player/car transforms arrange fixtures. Reaction fields, routes,
cooldowns and drive speed are never written by this suite.
A resident in a fast player car's body path freezes facing it (the replicated
acknowledgement hold); one just beside the path dives away (Stride 2) and is not
held still. The warning drive brakes at the first reaction, so nobody is struck;
add -NordNoPolice if a stray strike must not raise stars.
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
assert all(flag in COMMAND for flag in ('-NordResidentFeedbackQA', '-NordCampaignQA', '-NordNoCampaignSave')), 'Use isolated resident QA flags'
RENDER = '-NordResidentRenderChecks' in COMMAND
assert not RENDER or '-NullRHI' not in COMMAND, 'Caption presentation needs native rendering'
WIDTH_FLAG = re.search(r'(?:^|\s)-NordCaptureWidth=(\d+)(?:\s|$)', COMMAND)
WIDTH = int(WIDTH_FLAG[1]) if WIDTH_FLAG else 1280
assert WIDTH in (1280, 1920)
HEIGHT = WIDTH * 9 // 16
OUT = Path(u.Paths.project_saved_dir()).resolve() / 'Tests/ResidentFeedback'
if RENDER:
    OUT /= f'ResidentsRender{WIDTH}-'+time.strftime('%Y%m%d-%H%M%S')
SAVE_DIR = Path(u.Paths.project_saved_dir()) / 'SaveGames'


def save_hashes():
    return {str(p.relative_to(SAVE_DIR)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in SAVE_DIR.rglob('*.sav')} if SAVE_DIR.exists() else {}


SAVES = save_hashes()
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
SCRIPTING = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
SYSTEM = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
ORIGINAL = {key: SETTINGS.get_editor_property(key) for key in ('PlayNumberOfClients', 'RunUnderOneProcess', 'NewWindowWidth', 'NewWindowHeight')}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(Path(u.Paths.project_saved_dir()) / 'Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    CONFIG.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
CLASSES = {kind: u.load_class(None, '/Script/Quebec.Quebec'+kind) for kind in ('Controller', 'Character', 'Car', 'ParkResident', 'Campaign')}
assert all(CLASSES.values()), 'Build the current editor module first'
FIELDS = ('ReactionStartedAt', 'ReactionUntil', 'RouteDelay', 'ReactionYaw')
GREETINGS = ('Salut!', 'Allô!', 'Ça va bien?')
WARNINGS = ('Doucement', 'Attention!', 'Lève le pied')
REPORT = {'passed': False, 'checks': [], 'trace': [], 'captures': [],
          'mode': 'two-player listen-server PIE; native callbacks and authority relocation fixtures',
          'audio_scope': 'Native accepted greeting, E dialogue and warning exercise the Dialogue cue; audio output and invocation counts require separate observation. Checkpoint/Complete events require the story suite.',
          'not_checked': ['physical keyboard/mouse delivery', 'subjective handling and audio', 'external networking', 'performance acceptance']}
if RENDER:
    REPORT.update(resolution=[WIDTH, HEIGHT], visual_review_pending=True)
if not RENDER:
    REPORT['not_checked'].append('ambient caption/HUD priority presentation (NullRHI has no DrawHUD)')
REPORT['source_sha256'] = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in (
    'Source/Quebec/QuebecGameplay.h', 'Source/Quebec/QuebecGameplay.cpp', 'Source/Quebec/QuebecResidentReactions.cpp')}
STATE = {'started': time.monotonic(), 'step': -1, 'finished': False}
STEPS = []


def actors(world, kind):
    return u.GameplayStatics.get_all_actors_of_class(world, CLASSES[kind])


def now():
    return u.GameplayStatics.get_time_seconds(STATE['server'])


def vec(point):
    return [round(point.x, 3), round(point.y, 3), round(point.z, 3)]


def distance(a, b):
    return (a-b).length()


def trace(kind, **data):
    REPORT['trace'].append({'kind': kind, 'step': STEPS[STATE['step']][0],
                            'wall_seconds': round(time.monotonic()-STATE['started'], 3), **data})


def native(target, method):
    trace('native_input_callback', actor=target.get_name(), method=method)
    u.SystemLibrary.set_timer_for_next_tick(target, method)


def relocate(actor, point, yaw=0.):
    assert u.GameplayStatics.get_game_mode(actor), 'Fixture placement must remain authority-only'
    trace('fixture_relocation', actor=actor.get_name(), before_cm=vec(actor.get_actor_location()), target_cm=vec(point), yaw=yaw)
    actor.set_actor_location_and_rotation(point, u.Rotator(yaw=yaw), False, True)


def begin():
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'End existing PIE first'
    assert u.EditorLevelLibrary.get_editor_world().get_path_name().startswith('/Game/Maps/LaFontaine.')
    if RENDER:
        LEVELS.editor_set_viewport_realtime(False)
        STATE['viewport_realtime_override'] = True
        SETTINGS.set_editor_property('NewWindowWidth', WIDTH)
        SETTINGS.set_editor_property('NewWindowHeight', HEIGHT)
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', 1))
    SETTINGS.set_editor_property('PlayNumberOfClients', 2)
    SETTINGS.set_editor_property('RunUnderOneProcess', True)
    LEVELS.editor_request_begin_play()


def discover():
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    server = next((w for w in worlds if u.GameplayStatics.get_game_mode(w)), None)
    client = next((w for w in worlds if not u.GameplayStatics.get_game_mode(w)), None)
    if RENDER:
        if server:
            u.GameplayStatics.set_enable_world_rendering(server, False)
        if client:
            u.GameplayStatics.set_enable_world_rendering(client, True)
    if not server or not client:
        return False
    host = next((a for a in actors(server, 'Controller') if a.is_local_controller()), None)
    remote = next((a for a in actors(server, 'Controller') if not a.is_local_controller()), None)
    local = next((a for a in actors(client, 'Controller') if a.is_local_controller()), None)
    if not all(pc and isinstance(pc.get_controlled_pawn(), u.QuebecCharacter) for pc in (host, remote, local)):
        return False
    if len(actors(server, 'ParkResident')) < 10:
        return False
    if 'server' not in STATE:
        STATE.update(server=server, client=client, host_pc=host, server_pc=remote, client_pc=local,
                     server_char=remote.get_controlled_pawn(), client_char=local.get_controlled_pawn())
        # Waiting beside the enterable starter car suppresses ambient approaches
        # on surveyed ground, including while the initial briefing is visible.
        starter = next(a for a in actors(server, 'Car') if a.actor_has_tag('StarterCar'))
        for pc in (host, remote):
            pawn = pc.get_controlled_pawn()
            waiting_car = starter if pc == remote else next(a for a in actors(server, 'Car')
                if a != starter and not a.get_editor_property('bTraffic') and not a.get_editor_property('Occupant'))
            for offset in (waiting_car.get_actor_right_vector()*300, waiting_car.get_actor_right_vector()*-300,
                           waiting_car.get_actor_forward_vector()*380, waiting_car.get_actor_forward_vector()*-380):
                point = waiting_car.get_actor_location()+offset
                if not u.SystemLibrary.capsule_trace_single_by_profile(server, point, point+u.Vector(0,0,.1),
                        42, 88, 'Pawn', False, [pawn], u.DrawDebugTrace.NONE, True):
                    relocate(pawn, point)
                    if pc == remote:
                        STATE['away'] = point
                    break
            else:
                raise AssertionError('No collision-clear waiting fixture beside starter car')
        STATE['discovered_at'] = now()
    # A native scan can precede Python discovery; let its player cooldown expire.
    return now()-STATE['discovered_at'] >= 31


def replica(resident):
    route = resident.get_editor_property('Route')
    return next((a for a in actors(STATE['client'], 'ParkResident')
                 if a.get_editor_property('Style') == resident.get_editor_property('Style') and
                 abs(a.get_editor_property('Phase')-resident.get_editor_property('Phase')) < .001 and
                 len(a.get_editor_property('Route')) == len(route) and
                 all(distance(p,q) < .1 for p,q in zip(route, a.get_editor_property('Route')))), None)


def walk_fixture(excluded=()):
    cars = actors(STATE['server'], 'Car')
    campaign = actors(STATE['server'], 'Campaign')
    for resident in actors(STATE['server'], 'ParkResident'):
        point = resident.get_actor_location()
        if resident in excluded or resident.get_editor_property('bHidden') or resident.get_editor_property('Activity') == 2:
            continue
        if resident.get_editor_property('ReactionUntil') > now() or not replica(resident):
            continue
        if any(distance(point, car.get_actor_location()) < 900 for car in cars):
            continue
        if campaign and distance(point, campaign[0].get_editor_property('WorklightLocation')) < 2500:
            continue
        for offset in (u.Vector(300,0,100), u.Vector(-300,0,100), u.Vector(0,300,100), u.Vector(0,-300,100)):
            target = point+offset
            if u.SystemLibrary.capsule_trace_single_by_profile(STATE['server'], target, target+u.Vector(0,0,.1),
                    42, 88, 'Pawn', False, [STATE['server_char']], u.DrawDebugTrace.NONE, True):
                continue
            if u.SystemLibrary.line_trace_single(STATE['server'], target, point+u.Vector(0,0,130),
                    u.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [resident, STATE['server_char']], u.DrawDebugTrace.NONE, True):
                continue
            STATE.update(target=resident, reaction_before=resident.get_editor_property('ReactionStartedAt'))
            STATE['walk_reactions_before'] = {a.get_name(): a.get_editor_property('ReactionStartedAt')
                                              for a in actors(STATE['server'], 'ParkResident')}
            STATE.pop('motion_sample', None)
            STATE.pop('hold_position', None)
            relocate(STATE['server_char'], target, math.degrees(math.atan2(-offset.y, -offset.x)))
            STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-8, yaw=math.degrees(math.atan2(-offset.y, -offset.x))))
            trace('selected_authored_resident', actor=resident.get_name(), style=resident.get_editor_property('Style'),
                  phase=resident.get_editor_property('Phase'), route_cm=[vec(p) for p in resident.get_editor_property('Route')])
            return
    raise AssertionError('No visible authored mobile resident with a clear native approach')


def observe_motion():
    resident = STATE.get('target')
    if not resident:
        return
    point, stamp = resident.get_actor_location(), now()
    previous = STATE.get('motion_sample')
    # Knocked down, diving aside or walking back (Stride != 0) leaves the route pace by design.
    away = resident.get_editor_property('Stride') != 0
    if previous and not away:
        delta, travel = stamp-previous[0], distance(point, previous[1])
        assert travel <= resident.get_editor_property('Pace')*delta+8, 'Resident jumped along the route at a reaction boundary'
        REPORT['maximum_route_step_cm'] = max(REPORT.get('maximum_route_step_cm', 0), round(travel, 3))
    start, end = (resident.get_editor_property(key) for key in FIELDS[:2])
    if not away and start > STATE['reaction_before'] and start+.15 < stamp < end:
        if 'hold_position' not in STATE:
            STATE['hold_position'] = point
        assert distance(STATE['hold_position'], point) < 3, 'Resident moved during the replicated acknowledgement hold'
    STATE['motion_sample'] = (stamp, point)


def held_reaction():
    adopt_walk_reaction()
    resident = STATE['target']
    start, end = (resident.get_editor_property(key) for key in FIELDS[:2])
    if start <= STATE['reaction_before']:
        STATE['hold_wait_reason'] = 'selected resident has no new authority reaction'
        return False
    peer = replica(resident)
    if not peer or any(peer.get_editor_property(key) != resident.get_editor_property(key) for key in FIELDS):
        STATE['hold_wait_reason'] = 'reaction fields have not replicated'
        return False
    assert abs(end-start-2.4) < .001, 'Unexpected native hold duration'
    if now()-start < .7:
        STATE['hold_wait_reason'] = 'waiting for facing interpolation'
        return False
    assert now() < end, 'Replication did not arrive within the native hold'
    if 'hold_position' not in STATE:
        STATE['hold_position'] = resident.get_actor_location()
    assert distance(STATE['hold_position'], resident.get_actor_location()) < 3, 'Resident moved while acknowledging a player'
    if distance(peer.get_actor_location(), resident.get_actor_location()) > 20:
        STATE['hold_wait_reason'] = 'held actor movement has not replicated'
        return False
    for actor in (resident, peer):
        yaw_error = abs((actor.get_actor_rotation().yaw-resident.get_editor_property('ReactionYaw')+180)%360-180)
        if yaw_error > 8:
            STATE['hold_wait_reason'] = 'facing yaw has not settled on both peers'
            return False
    STATE['reaction_start'] = start
    trace('replicated_held_facing', fields={key: resident.get_editor_property(key) for key in FIELDS},
          authority_cm=vec(resident.get_actor_location()), client_cm=vec(peer.get_actor_location()))
    return True


def adopt_walk_reaction():
    before = STATE.get('walk_reactions_before')
    if not before or STATE.get('car'):
        return
    # The native nearest-resident query owns selection when authored routes cross.
    changed = [a for a in actors(STATE['server'], 'ParkResident')
               if a.get_editor_property('ReactionStartedAt') > before.get(a.get_name(), 0) and
               distance(STATE['server_char'].get_actor_location(), a.get_actor_location()+u.Vector(0,0,100)) <= 450]
    if not changed:
        return
    actual = min(changed, key=lambda a: distance(a.get_actor_location(), STATE['server_char'].get_actor_location()))
    if actual != STATE['target']:
        trace('native_nearest_resident_selected', fixture_actor=STATE['target'].get_name(), actual_actor=actual.get_name())
        STATE.update(target=actual, reaction_before=before[actual.get_name()])
        STATE.pop('motion_sample', None)
        STATE.pop('hold_position', None)


def greeted():
    if not held_reaction():
        return False
    caption = STATE['client_pc'].get_editor_property('ResidentCaption')
    if RENDER and not any(text in caption for text in GREETINGS):
        return False
    if RENDER:
        assert STATE['client_pc'].get_editor_property('ResidentCaptionUntil') > u.GameplayStatics.get_time_seconds(STATE['client']), 'Greeting expired before rendered acceptance'
    assert STATE['host_pc'].get_editor_property('ResidentCaption') == STATE['host_caption'], 'Greeting changed the other player caption'
    STATE.update(first_resident=STATE['target'], first_greeting_at=STATE['reaction_start'])
    REPORT['greeting'] = {'caption': caption, 'caption_presentation_checked': RENDER, 'private_to_owner': True}
    return True


def resumed():
    resident = STATE['target']
    if now() < resident.get_editor_property('ReactionUntil')+.2:
        return False
    return distance(resident.get_actor_location(), STATE['hold_position']) > 10


def manual_fixture():
    walk_fixture()
    native(STATE['client_pc'], 'Interact')


def manual_received():
    caption = STATE['client_pc'].get_editor_property('ResidentCaption')
    if not caption or any(text in caption for text in GREETINGS):
        return False
    adopt_walk_reaction()
    STATE.update(manual_caption=caption, manual_until=STATE['client_pc'].get_editor_property('ResidentCaptionUntil'),
                 manual_resident=STATE['target'])
    trace('native_private_dialogue', caption=caption, until=STATE['manual_until'])
    return True


def priority_preserved():
    if not held_reaction():
        return False
    assert u.GameplayStatics.get_time_seconds(STATE['client']) < STATE['manual_until'], 'Manual dialogue expired before the ambient priority check'
    assert STATE['client_pc'].get_editor_property('ResidentCaption') == STATE['manual_caption'], 'Ambient greeting clobbered native E dialogue'
    assert STATE['client_pc'].get_editor_property('ResidentCaptionUntil') == STATE['manual_until'], 'Ambient greeting changed manual reading time'
    assert STATE['host_pc'].get_editor_property('ResidentCaption') == STATE['host_caption'], 'Private E dialogue leaked to the host'
    STATE['priority_at'] = STATE['reaction_start']
    REPORT['native_dialogue_priority'] = {'caption': STATE['manual_caption'], 'ambient_reaction_observed': True,
                                          'reading_deadline_unchanged': True}
    return True


def warning_fixture():
    car = next(a for a in actors(STATE['server'], 'Car') if a.actor_has_tag('StarterCar'))
    for resident in actors(STATE['server'], 'ParkResident'):
        if resident.get_editor_property('bHidden') or resident.get_editor_property('Activity') == 1 or not replica(resident):
            continue
        point = resident.get_actor_location()
        for yaw in (resident.get_actor_rotation().yaw, resident.get_actor_rotation().yaw+180, *range(0, 360, 45)):
            direction = u.Vector(math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0)
            start, end = point-direction*1600, point+direction*300
            start.z = end.z = point.z+102
            if u.SystemLibrary.box_trace_single_by_profile(STATE['server'], start, end, u.Vector(220,108,70),
                    u.Rotator(yaw=yaw), 'Pawn', False, [car, STATE['server_char']], u.DrawDebugTrace.NONE, True):
                continue
            STATE.update(car=car, target=resident, reaction_before=resident.get_editor_property('ReactionStartedAt'))
            STATE['warning_reactions_before'] = {a.get_name(): a.get_editor_property('ReactionStartedAt')
                                                 for a in actors(STATE['server'], 'ParkResident')}
            STATE.pop('motion_sample', None)
            STATE.pop('hold_position', None)
            relocate(car, start, yaw)
            relocate(STATE['server_char'], start+u.Vector(-direction.y, direction.x, 0)*300)
            native(STATE['client_pc'], 'Interact')
            return
    raise AssertionError('No clear native car approach to an authored visible resident')


def car_entered():
    pawn = STATE['client_pc'].get_controlled_pawn()
    return (STATE['server_pc'].get_controlled_pawn() == STATE['car'] and isinstance(pawn, u.QuebecCar)
            and STATE['car'].get_editor_property('Occupant') == STATE['server_char'])


def drive():
    car = STATE['client_pc'].get_controlled_pawn()
    car.disable_input(STATE['client_pc'])
    STATE['drive_input_disabled'] = car
    car.call_method('MoveRight', (0.,))
    STATE['drive'] = True
    STATE['drive_start'] = STATE['car'].get_actor_location()
    native(car, 'ReleaseHandbrake')
    trace('native_drive_window', method='MoveForward', axis=1., start_cm=vec(STATE['drive_start']))


def warned():
    car = STATE['car']
    REPORT['maximum_native_speed_cm_s'] = max(REPORT.get('maximum_native_speed_cm_s', 0), abs(car.get_editor_property('Speed')))
    if STATE.get('drive'):
        changed = [a for a in actors(STATE['server'], 'ParkResident')
                   if a.get_editor_property('ReactionStartedAt') > STATE['warning_reactions_before'].get(a.get_name(), 0)]
        if changed:
            actual = min(changed, key=lambda a: distance(a.get_actor_location(), car.get_actor_location()))
            if actual != STATE['target']:
                STATE.pop('motion_sample', None)
                STATE.pop('hold_position', None)
            STATE.update(target=actual, reaction_before=STATE['warning_reactions_before'][actual.get_name()])
    if STATE['target'].get_editor_property('ReactionStartedAt') <= STATE['reaction_before']:
        return False
    if STATE.pop('drive', False):
        STATE['warning_speed'] = car.get_editor_property('Speed')
        assert abs(STATE['warning_speed']) >= 900, 'Warning occurred without native fast driving'
        assert distance(car.get_actor_location(), STATE['drive_start']) > 200, 'Warning needs actual swept drive displacement'
        STATE['client_pc'].get_controlled_pawn().call_method('MoveForward', (0.,))
        native(STATE['client_pc'].get_controlled_pawn(), 'ApplyHandbrake')
    assert STATE['target'].get_editor_property('Stride') != 1, 'The warning drive knocked the resident down'
    # In the car's path the resident freezes facing it; just beside the path it dives away instead of holding still.
    dived = STATE['target'].get_editor_property('Stride') == 2
    if dived:
        STATE['reaction_start'] = STATE['target'].get_editor_property('ReactionStartedAt')
    elif not held_reaction():
        return False
    caption = STATE['client_pc'].get_editor_property('ResidentCaption')
    if RENDER and not any(text in caption for text in WARNINGS):
        return False
    if RENDER:
        assert STATE['client_pc'].get_editor_property('ResidentCaptionUntil') > u.GameplayStatics.get_time_seconds(STATE['client']), 'Warning expired before rendered acceptance'
    assert STATE['host_pc'].get_editor_property('ResidentCaption') == STATE['host_caption'], 'Warning changed the other player caption'
    REPORT['warning'] = {'native_speed_cm_s': STATE['warning_speed'], 'caption': caption, 'dived_aside': dived,
                         'caption_presentation_checked': RENDER, 'private_to_driver': True}
    STATE.pop('drive_input_disabled').enable_input(STATE['client_pc'])
    return True


def step(name, action, ready, capture=None, timeout=25):
    STEPS.append((name, action, ready, capture, timeout))


step('two native peers finish opening briefing away from residents', begin, discover, timeout=45)
step('native proximity greeting holds and faces on both peers',
     lambda: (STATE.update(host_caption=STATE['host_pc'].get_editor_property('ResidentCaption')), walk_fixture()), greeted, 'Greeting')
step('authored mobile route resumes continuously after greeting', lambda: None, resumed)
step('wait for native player cooldown while away from residents',
     lambda: relocate(STATE['server_char'], STATE['away']),
     lambda: now() >= STATE['first_greeting_at']+28, timeout=40)
step('native remote E shows existing private dialogue', manual_fixture, manual_received)
step('fresh resident reacts while native E caption keeps its reading time',
     lambda: walk_fixture((STATE['manual_resident'],)), priority_preserved, 'ManualPriority')
step('wait for next native driver opportunity away from residents',
     lambda: relocate(STATE['server_char'], STATE['away']),
     lambda: now() >= STATE['priority_at']+30, timeout=40)
step('native remote E enters an occupied car before warning drive', warning_fixture, car_entered)
step('native swept throttle approach warns only the owning driver', drive, warned, 'ApproachingCar', timeout=10)
step('warning cooldown holds without repeated reaction', lambda: None,
     lambda: now() >= STATE['reaction_start']+5 and STATE['target'].get_editor_property('ReactionStartedAt') == STATE['reaction_start']
     and STATE['target'].get_editor_property('Stride') != 1)


def queue_capture(label):
    assert u.GameplayStatics.get_enable_world_rendering(STATE['client']), 'The owning client viewport must render'
    assert not u.GameplayStatics.get_enable_world_rendering(STATE['server']), 'Duplicate host rendering must remain disabled'
    caption = STATE['client_pc'].get_editor_property('ResidentCaption')
    deadline = STATE['client_pc'].get_editor_property('ResidentCaptionUntil')
    stamp = u.GameplayStatics.get_time_seconds(STATE['client'])
    assert caption and deadline > stamp, 'Capture needs an active private caption'
    path = OUT / f'Residents{WIDTH}' / (label+'.png')
    path.parent.mkdir(parents=True, exist_ok=True)
    assert not path.exists(), 'Rendered evidence must not replace an earlier capture'
    trace('native_screenshot_request', label=label, caption=caption, caption_remaining_seconds=deadline-stamp,
          client_world_seconds=stamp, native_client_viewport_dimensions=list(STATE['client_pc'].get_viewport_size()),
          host_world_rendering=False, client_world_rendering=True)
    u.SystemLibrary.execute_console_command(STATE['client'], f'HighResShot {WIDTH}x{HEIGHT} filename="{path}"', STATE['client_pc'])
    STATE['capture'] = (path, time.monotonic())


def capture_done():
    path, started = STATE['capture']
    assert time.monotonic()-started < 25, 'Native screenshot timeout'
    if not path.exists():
        return False
    data = path.read_bytes()
    if len(data) < 10000 or not data.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'):
        return False
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (WIDTH, HEIGHT)
    REPORT['captures'].append({'path': str(path.relative_to(ROOT)), 'dimensions': [WIDTH, HEIGHT], 'bytes': len(data)})
    STATE.pop('capture')
    return True


def finish(error=None):
    STATE.update(finishing=True, cleanup_started=time.monotonic())
    STATE.pop('drive', None)
    car = STATE.pop('drive_input_disabled', None)
    if car:
        car.call_method('MoveForward', (0.,))
        car.enable_input(STATE['client_pc'])
    if error:
        REPORT.update(error=error, failed_step=STEPS[max(0, STATE['step'])][0])
        try:
            failure_probe()
        except Exception:
            REPORT['failure_probe_error'] = traceback.format_exc()
        u.log_error('NORD_RESIDENT_FEEDBACK_FAILED '+error)
    LEVELS.editor_request_end_play()


def failure_probe():
    def resident_probe(actor):
        return {'actor': actor.get_name(), 'position_cm': vec(actor.get_actor_location()),
                'yaw': actor.get_actor_rotation().yaw, 'hidden': actor.get_editor_property('bHidden'),
                **{key: actor.get_editor_property(key) for key in ('Style', 'Phase', 'Activity', 'Pace', *FIELDS)}}
    probe = {'world_seconds': now(), 'hold_wait_reason': STATE.get('hold_wait_reason'),
             'reaction_before': STATE.get('reaction_before'), 'players': {}}
    baseline = STATE.get('warning_reactions_before', STATE.get('walk_reactions_before', {}))
    probe['new_authority_reactions'] = [resident_probe(a) for a in actors(STATE['server'], 'ParkResident')
        if a.get_editor_property('ReactionStartedAt') > baseline.get(a.get_name(), 0)]
    target = STATE.get('target')
    if target:
        peer = replica(target)
        probe['target_authority'] = resident_probe(target)
        probe['target_client'] = resident_probe(peer) if peer else None
    for side in ('server', 'client'):
        pc, world = STATE[side+'_pc'], STATE[side]
        pawn = pc.get_controlled_pawn()
        point = pawn.get_actor_location()
        item = {'controller': pc.get_name(), 'local_controller': pc.is_local_controller(),
                'pawn': pawn.get_name(), 'position_cm': vec(point), 'velocity_cm_s': vec(pawn.get_velocity()),
                'caption': pc.get_editor_property('ResidentCaption'),
                'caption_until': pc.get_editor_property('ResidentCaptionUntil')}
        if isinstance(pawn, u.QuebecCharacter):
            item['movement_mode'] = str(pawn.get_component_by_class(u.CharacterMovementComponent).get_editor_property('MovementMode'))
        nearby = sorted(actors(world, 'ParkResident'), key=lambda a: distance(point, a.get_actor_location()))[:5]
        item['nearest_residents'] = [{**resident_probe(a), 'distance_to_talk_anchor_cm': distance(point, a.get_actor_location()+u.Vector(0,0,100)),
            'visibility_blocked': bool(u.SystemLibrary.line_trace_single(world, point, a.get_actor_location()+u.Vector(0,0,130),
                u.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [pawn,a], u.DrawDebugTrace.NONE, True))} for a in nearby]
        cars = sorted(actors(world, 'Car'), key=lambda a: distance(point, a.get_actor_location()))[:3]
        item['nearest_cars'] = [{'actor': a.get_name(), 'distance_cm': distance(point, a.get_actor_location()),
                                'speed_cm_s': a.get_editor_property('Speed'), 'traffic': a.get_editor_property('bTraffic'),
                                'occupied': bool(a.get_editor_property('Occupant'))} for a in cars]
        probe['players'][side] = item
    REPORT['failure_probe'] = probe


def cleanup():
    if u.EditorLevelLibrary.get_pie_worlds(True):
        assert time.monotonic()-STATE['cleanup_started'] < 15, 'PIE did not stop'
        return
    assert save_hashes() == SAVES, 'Resident QA changed a campaign save'
    REPORT['all_campaign_save_hashes_unchanged'] = True
    write_report()


def write_report():
    if STATE.pop('viewport_realtime_override', False):
        LEVELS.editor_set_viewport_realtime(True)
        REPORT['editor_viewport_realtime_override_released'] = True
    for key, value in ORIGINAL.items():
        SETTINGS.set_editor_property(key, value)
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
    REPORT.update(passed='error' not in REPORT, elapsed_seconds=round(time.monotonic()-STATE['started'], 3),
                  editor_play_settings_restored=all(SETTINGS.get_editor_property(k) == v for k,v in ORIGINAL.items()))
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / ('Residents'+(f'Render{WIDTH}' if RENDER else '')+'.json')
    path.write_text(json.dumps(REPORT, indent=2)+'\n')
    u.log('NORD_RESIDENT_FEEDBACK_'+('OK' if REPORT['passed'] else 'FAILED')+' '+str(path))
    STATE['finished'] = True
    u.unregister_slate_post_tick_callback(STATE['callback'])
    SCRIPTING.call_method('SetKeepPythonScriptAlive', (False,))


def tick(delta):
    if STATE['finished'] or STATE.get('ticking'):
        return
    STATE['ticking'] = True
    try:
        if STATE.get('finishing'):
            cleanup()
            return
        assert time.monotonic()-STATE['started'] < 180, 'Resident QA watchdog'
        if STATE['step'] < 0:
            STATE['step'] = 0
        if 'step_started' not in STATE:
            STATE['step_started'] = time.monotonic()
            STEPS[STATE['step']][1]()
        name, action, ready, capture, timeout = STEPS[STATE['step']]
        assert time.monotonic()-STATE['step_started'] < timeout, 'Step timeout: '+name
        if STATE.get('capture'):
            if not capture_done():
                return
        else:
            if 'server' in STATE:
                observe_motion()
                if STATE.get('target') and now()-STATE.get('last_probe', 0) >= 5:
                    STATE['last_probe'] = now()
                    try:
                        failure_probe()
                    except Exception:
                        trace('periodic_probe_unavailable', error=traceback.format_exc())
                    else:
                        trace('periodic_actual_state', state=REPORT.pop('failure_probe'))
            if STATE.get('drive'):
                STATE['client_pc'].get_controlled_pawn().call_method('MoveForward', (1.,))
            if not ready():
                return
            if RENDER and capture:
                queue_capture(capture)
                return
        REPORT['checks'].append(name)
        u.log('NORD_RESIDENT_FEEDBACK_CHECK '+name)
        STATE['step'] += 1
        STATE.pop('step_started')
        if STATE['step'] == len(STEPS):
            finish()
    except Exception:
        error = traceback.format_exc()
        if STATE.get('finishing'):
            REPORT['error'] = REPORT.get('error', '')+'\nCleanup failure:\n'+error
            write_report()
        else:
            finish(error)
    finally:
        STATE['ticking'] = False


SCRIPTING.call_method('SetKeepPythonScriptAlive', (True,))
STATE['callback'] = u.register_slate_post_tick_callback(tick)
u.log('NORD_RESIDENT_FEEDBACK_START awaiting native two-player PIE')
