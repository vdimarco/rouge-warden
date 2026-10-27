"""Continuous native-input M2 route QA in standalone PIE.

Run with LaFontaine loaded and -NordCampaignQA. This seeds a real isolated
completed-M1 save, enters the authored loan car through native E, then drives
with MoveForward/MoveRight. It does not teleport the car, skip gates, disable
traffic/collision, or claim subjective handling enjoyment.
Add -NordResidentFeedbackQA to retain this run under a fresh UTC report directory.
"""
import configparser
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import time
import traceback

import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
COMMAND = u.SystemLibrary.get_command_line()
assert '-NordCampaignQA' in COMMAND, 'Use the isolated QA save slot'
assert '-NordNoCampaign' not in COMMAND and '-NordNoCampaignSave' not in COMMAND
SLOT = 'NordCampaign_StorySliceQA_v1'
SAVE_DIR = Path(u.Paths.project_saved_dir()) / 'SaveGames'
SAVE_PATH = SAVE_DIR / (SLOT + '.sav')
OLD_QA = SAVE_PATH.read_bytes() if SAVE_PATH.exists() else None
PRODUCTION = {str(p.relative_to(SAVE_DIR)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in SAVE_DIR.rglob('*.sav') if p != SAVE_PATH} if SAVE_DIR.exists() else {}
OUT = ROOT / 'Verification/RaceDrive.json'
if '-NordResidentFeedbackQA' in COMMAND:
    OUT = ROOT / 'Saved/Tests/ResidentFeedback' / ('ContinuousRace-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')) / 'RaceDrive.json'
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
SYSTEM = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
GAMEPLAY = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
SCRIPTING = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
ORIGINAL = {key: SETTINGS.get_editor_property(key) for key in ('PlayNumberOfClients', 'RunUnderOneProcess')}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(Path(u.Paths.project_saved_dir()) / 'Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    CONFIG.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
CLASSES = {name: u.load_class(None, '/Script/Quebec.Quebec' + name)
           for name in ('Campaign', 'CampaignSaveGame', 'Controller', 'Character', 'Car')}
assert all(CLASSES.values()), 'Build the current native campaign module first'
REPORT = {'passed': False, 'mode': 'standalone authority PIE; continuous native vehicle input callbacks',
          'save_slot': SLOT, 'initial_fixture_relocations': [], 'gate_crossings': [],
          'blocking_hit_callbacks': [], 'blocking_hit_callback_count': None, 'ground_contact_callback_count': None,
          'collision_observer_available': False,
          'samples': [], 'retries': 0,
          'not_checked': ['physical keyboard/mouse delivery', 'subjective handling enjoyment',
                          'audio quality', 'multiplayer', 'external internet', 'performance acceptance'],
          'collision_observation': 'Optional native OnActorHit observer not yet bound; contact counts are unavailable until binding succeeds.'}
REPORT['source_sha256'] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in (ROOT/'Scripts/test_race_drive.py', ROOT/'Source/Quebec/QuebecCampaign.h',
                 ROOT/'Source/Quebec/QuebecCampaign.cpp', ROOT/'Source/Quebec/QuebecGameplay.h',
                 ROOT/'Source/Quebec/QuebecGameplay.cpp', ROOT/'Source/Quebec/LaFontaineMap.h')}
STATE = {'stage': 'begin', 'started': time.monotonic(), 'finished': False}


def xy(v):
    return (v.x, v.y)


def vec(v):
    return [round(v.x, 4), round(v.y, 4), round(v.z, 4)]


def distance(a, b):
    return math.hypot(a[0]-b[0], a[1]-b[1])


def actors(world, kind):
    return u.GameplayStatics.get_all_actors_of_class(world, CLASSES[kind])


def property_int(obj, name, value):
    SYSTEM.call_method('SetIntPropertyByName', (obj, name, value))


def begin():
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'End existing PIE first'
    assert u.EditorLevelLibrary.get_editor_world().get_path_name().startswith('/Game/Maps/LaFontaine.')
    saved = u.GameplayStatics.create_save_game_object(CLASSES['CampaignSaveGame'])
    property_int(saved, 'Version', 1)
    property_int(saved, 'CompletedMissions', 1)
    assert u.GameplayStatics.save_game_to_slot(saved, SLOT, 0), 'Cannot seed isolated completed-M1 save'
    loaded = u.GameplayStatics.load_game_from_slot(SLOT, 0)
    assert loaded and loaded.get_editor_property('Version') == 1 and loaded.get_editor_property('CompletedMissions') == 1
    REPORT['seeded_save_sha256'] = hashlib.sha256(SAVE_PATH.read_bytes()).hexdigest()
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', 0))
    SETTINGS.set_editor_property('PlayNumberOfClients', 1)
    SETTINGS.set_editor_property('RunUnderOneProcess', True)
    LEVELS.editor_request_begin_play()
    STATE['stage'] = 'discover'


def authored_route(campaign):
    gates = [xy(v) for v in campaign.get_editor_property('RaceGates')]
    directions = [xy(v) for v in campaign.get_editor_property('RaceDirections')]
    assert len(gates) >= 4 and len(gates) == len(directions)
    source = [xy(v) for v in campaign.get_editor_property('RaceRoute')]
    assert len(source) >= 4 and distance(source[0], source[-1]) < 1, 'Expected the actual closed native street route'
    segments = []
    for a, b in zip(source, source[1:]):
        length = distance(a, b)
        assert length > 10
        direction = ((b[0]-a[0])/length, (b[1]-a[1])/length)
        right = (-direction[1], direction[0])
        segments.append((direction, (a[0]+right[0]*145, a[1]+right[1]*145)))
    # Follow the same forward traffic lane as the production loaner. Offset-line
    # intersections retain every native corner, including the two tight tips.
    vertices = []
    for i in range(len(segments)):
        da, a = segments[(i-1) % len(segments)]
        db, b = segments[i]
        cross = da[0]*db[1]-da[1]*db[0]
        if da[0]*db[0]+da[1]*db[1] < 0:
            # Keep most of the open junction space, but start the hairpin
            # slightly inside its tip to avoid the retained roadside trunks.
            # This is driver guidance; every native gate remains unchanged.
            offset = (b[0]-a[0], b[1]-a[1])
            along = (offset[0]*db[1]-offset[1]*db[0])/cross
            miter = (a[0]+da[0]*along, a[1]+da[1]*along)
            q = (source[i][0]+(miter[0]-source[i][0])*0.3, source[i][1]+(miter[1]-source[i][1])*0.3)
        elif abs(cross) < .01:
            q = b
        else:
            offset = (b[0]-a[0], b[1]-a[1])
            along = (offset[0]*db[1]-offset[1]*db[0])/cross
            q = (a[0]+da[0]*along, a[1]+da[1]*along)
        assert distance(q, source[i]) < 1000, 'Unsupported lane miter at native street corner'
        vertices.append(q)
    inserts = [[] for _ in segments]
    for index, gate in enumerate(gates[:-1]):
        choices = []
        for i, (a, b) in enumerate(zip(source, source[1:])):
            dx, dy = b[0]-a[0], b[1]-a[1]
            t = max(0., min(1., ((gate[0]-a[0])*dx+(gate[1]-a[1])*dy)/(dx*dx+dy*dy)))
            q = (a[0]+dx*t, a[1]+dy*t)
            choices.append((distance(q, gate), i, t))
        gap, segment, t = min(choices)
        assert gap <= 310, 'Gate must remain on its actual authored street segment'
        right = (-directions[index][1], directions[index][0])
        offset = 0 if index == 5 else 145
        target = (gate[0]+right[0]*offset, gate[1]+right[1]*offset)
        inserts[segment].append((t, target))
    route = [vertices[0]]
    for i in range(len(segments)):
        for _, target in sorted(inserts[i]):
            route.append(target)
        if i == len(segments)-1:
            incoming = segments[-1][0]
            # Swing wide within the open start junction for the final hairpin;
            # the minimum turning circle cannot follow an inside-lane cusp.
            route.append((source[0][0]+incoming[1]*650, source[0][1]-incoming[0]*650))
        else:
            route.append(vertices[i+1])
    # Finish is the first arch reached again after the complete closed loop.
    right = (-directions[-1][1], directions[-1][0])
    route.append((gates[-1][0]+right[0]*145, gates[-1][1]+right[1]*145))
    route.append((route[-1][0]+directions[-1][0]*900, route[-1][1]+directions[-1][1]*900))
    lengths = [0.]
    for a, b in zip(route, route[1:]):
        lengths.append(lengths[-1]+distance(a, b))
    assert lengths[-1] > 10000, 'Expected an actual street race route'
    return gates, directions, route, lengths


def discover():
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    if len(worlds) != 1:
        return
    world = worlds[0]
    controllers = actors(world, 'Controller')
    campaigns = actors(world, 'Campaign')
    if len(controllers) != 1 or len(campaigns) != 1:
        return
    pc, campaign = controllers[0], campaigns[0]
    pawn = pc.get_controlled_pawn()
    car = campaign.get_editor_property('LoanCar')
    if not pawn or not car:
        return
    assert campaign.get_editor_property('CompletedMissions') == 1
    assert campaign.get_editor_property('Phase') == u.QuebecCampaignPhase.RACE_READY
    gates, directions, route, lengths = authored_route(campaign)
    assert car.get_actor_enable_collision(), 'Keep actual vehicle collision enabled'
    fleet = [a for a in actors(world, 'Car') if a.get_editor_property('bTraffic')]
    assert len(fleet) >= 1, 'Traffic must remain active'
    REPORT.update(route_cm=route, guidance='actual native RaceRoute; +145 cm forward lane, modest inside-tip guidance, exposed side-gate center, wide finish approach with 950 cm final-gate lookahead',
                  native_route_cm=[vec(v) for v in campaign.get_editor_property('RaceRoute')],
                  route_length_cm=lengths[-1], gate_count=len(gates), ambient_traffic_count=len(fleet),
                  car=car.get_name(), car_initial_position_cm=vec(car.get_actor_location()))
    STATE.update(world=world, pc=pc, campaign=campaign, car=car, avatar=pawn,
                 gates=gates, directions=directions, route=route, lengths=lengths,
                 last_gate=0, progress=0., speed=0., travel=0.)
    # Only the standing avatar is relocated to a clear side of the authored car.
    # The loan car starts at its production transform and never gets teleported.
    position, right, forward = car.get_actor_location(), car.get_actor_right_vector(), car.get_actor_forward_vector()
    for offset in (right*185, right*-185, forward*300, forward*-300):
        target = position+offset
        if any(other != car and (other.get_actor_location()-target).length() <= (position-target).length()+10
               for other in actors(world, 'Car')):
            continue
        if u.SystemLibrary.capsule_trace_single_by_profile(world, target, target+u.Vector(0, 0, .1),
                42, 88, 'Pawn', False, [pawn], u.DrawDebugTrace.NONE, True):
            continue
        REPORT['initial_fixture_relocations'].append({'actor': pawn.get_name(), 'from_cm': vec(pawn.get_actor_location()), 'to_cm': vec(target)})
        pawn.set_actor_location(target, False, True)
        u.SystemLibrary.set_timer_for_next_tick(pc, 'Interact')
        STATE['stage'] = 'enter'
        return
    raise AssertionError('No collision-clear native E approach to the authored loan car')


def on_hit(self_actor, other_actor, normal_impulse, hit):
    if hit.normal.z >= .7:
        REPORT['ground_contact_callback_count'] += 1
        return
    REPORT['blocking_hit_callback_count'] += 1
    if len(REPORT['blocking_hit_callbacks']) < 100:
        REPORT['blocking_hit_callbacks'].append({'world_seconds': round(u.GameplayStatics.get_time_seconds(STATE['world']), 4),
                                                'other': other_actor.get_name() if other_actor else None,
                                                'normal': vec(hit.normal)})


def enter():
    car, pc = STATE['car'], STATE['pc']
    if pc.get_controlled_pawn() != car:
        return
    assert car.get_editor_property('Occupant') == STATE['avatar']
    car.disable_input(pc)
    # UE5.8 Python cannot wrap some sparse delegates (including OnActorHit
    # in this installed build). Contact observation is optional; the actual
    # swept movement/collision and route assertions remain active either way.
    try:
        car.get_editor_property('on_actor_hit').add_callable(on_hit)
    except Exception as error:
        REPORT['collision_observer_error'] = type(error).__name__+': '+str(error)
        REPORT['collision_observation'] = ('Native OnActorHit binding unavailable; contact counts were not measured. '
                                           'Actor collision stays enabled and actual continuous swept driving is required.')
        REPORT['not_checked'].append('collision contact counts (Python sparse-delegate binding unavailable)')
    else:
        REPORT.update(collision_observer_available=True, blocking_hit_callback_count=0, ground_contact_callback_count=0,
                      collision_observation='Native OnActorHit callbacks; ground normals counted separately. Absence of callbacks does not establish zero contacts.')
    now = u.GameplayStatics.get_time_seconds(STATE['world'])
    STATE.update(stage='drive', drive_started=now, last_time=now, last_position=xy(car.get_actor_location()),
                 last_sample=now, last_gate_time=now, last_motion=now)
    car.call_method('MoveForward', (1.,))


def project_path(point):
    route, lengths = STATE['route'], STATE['lengths']
    best = None
    for i, (a, b) in enumerate(zip(route, route[1:])):
        if lengths[i+1] < STATE['progress']-300 or lengths[i] > STATE['progress']+6000:
            continue
        dx, dy = b[0]-a[0], b[1]-a[1]
        t = max(0., min(1., ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)))
        q = (a[0]+dx*t, a[1]+dy*t)
        candidate = (distance(point, q), lengths[i]+t*(lengths[i+1]-lengths[i]))
        if best is None or candidate[0] < best[0]:
            best = candidate
    assert best and best[0] < 2000, 'Vehicle left the authored street route by more than 20 m'
    STATE['progress'] = max(STATE['progress'], best[1])
    return best[0]


def point_along(along):
    route, lengths = STATE['route'], STATE['lengths']
    for i, (a, b) in enumerate(zip(route, route[1:])):
        if along <= lengths[i+1]:
            t = max(0., (along-lengths[i])/(lengths[i+1]-lengths[i]))
            return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
    return route[-1]


def drive():
    car, campaign = STATE['car'], STATE['campaign']
    assert STATE['pc'].get_controlled_pawn() == car and car.get_editor_property('Occupant') == STATE['avatar']
    assert car.get_actor_enable_collision(), 'Vehicle collision must remain enabled for the continuous drive'
    now = u.GameplayStatics.get_time_seconds(STATE['world'])
    dt = now-STATE['last_time']
    if dt <= 0:
        return
    position = xy(car.get_actor_location())
    traveled = distance(position, STATE['last_position'])
    assert traveled < max(200., dt*3500), 'Discontinuous car relocation during the driven route'
    STATE['travel'] += traveled
    speed = traveled/dt
    STATE['speed'] += (speed-STATE['speed'])*min(1., dt*6)
    STATE.update(last_position=position, last_time=now)
    if speed > 20:
        STATE['last_motion'] = now
    if now-STATE['last_motion'] > 3:
        REPORT['stall'] = {'position_cm': vec(car.get_actor_location()), 'yaw': car.get_actor_rotation().yaw,
                           'speed': car.get_editor_property('Speed'), 'handbrake': car.get_editor_property('bHandbrake')}
        hit = u.SystemLibrary.box_trace_single_by_profile(STATE['world'], car.get_actor_location(),
            car.get_actor_location()+car.get_actor_forward_vector()*300, u.Vector(220,108,70),
            car.get_actor_rotation(), 'Pawn', False, [car,STATE['avatar']], u.DrawDebugTrace.NONE, True)
        if hit:
            broken = GAMEPLAY.call_method('BreakHitResult', (hit,))
            other, component = broken[9], broken[10]
            REPORT['stall']['blocker'] = {'actor': other.get_name() if other else None,
                'label': other.get_actor_label() if other else None,
                'component': component.get_name() if component else None,
                'mesh': component.get_editor_property('static_mesh').get_path_name() if isinstance(component,u.StaticMeshComponent) and component.get_editor_property('static_mesh') else None}
        REPORT['stall']['nearby_cars'] = [{'actor': a.get_name(), 'position_cm': vec(a.get_actor_location()),
            'yaw': a.get_actor_rotation().yaw, 'speed': a.get_editor_property('Speed'), 'traffic': a.get_editor_property('bTraffic')}
            for a in actors(STATE['world'],'Car') if a != car and distance(xy(a.get_actor_location()),position)<1500]
        raise AssertionError('Continuous driver stalled; see native blocking sweep')
    error = project_path(position)
    gate = campaign.get_editor_property('RaceGateIndex')
    if gate != STATE['last_gate']:
        assert gate == STATE['last_gate']+1, 'Race gate index skipped or reset'
        REPORT['gate_crossings'].append({'gate': gate, 'world_seconds': round(now, 4), 'position_cm': vec(car.get_actor_location()),
                                         'travel_cm': round(STATE['travel'], 2)})
        STATE.update(last_gate=gate, last_gate_time=now)
        u.log('NORD_RACE_DRIVE_GATE '+str(gate))
    assert not campaign.get_editor_property('bRaceRetried'), 'Continuous attempt cannot use checkpoint recovery'
    assert not campaign.get_editor_property('bRaceTimedOut'), 'Authored race timed out'
    phase = campaign.get_editor_property('Phase')
    if phase == u.QuebecCampaignPhase.COMPLETE:
        saved = u.GameplayStatics.load_game_from_slot(SLOT, 0)
        assert saved and saved.get_editor_property('CompletedMissions') == 2
        assert saved.get_editor_property('Version') == 11, 'A finished race did not write the story tail'
        for name in ('PondStep', 'CourtStep', 'ShowStep', 'RescueMask', 'ConvoyStep', 'BlankStep', 'TourStep', 'HomeStep', 'EscortStep', 'ShadeStep', 'GrabStep', 'CutStep', 'ChaseStep', 'FinaleStep', 'FollowStep', 'RollStep'):
            assert saved.get_editor_property(name) == 0, 'A finished race wrote a story step'
        assert len(REPORT['gate_crossings']) == len(STATE['gates']), 'Every authored directional gate must be crossed'
        assert STATE['travel'] > STATE['lengths'][-1]*.8, 'Route completion needs continuous physical travel'
        result = {key: campaign.get_editor_property(key)
                  for key in ('LastRaceTime', 'RaceElapsed', 'BestCleanRaceTime', 'bLastRaceRetried')}
        REPORT['clean_race_result'] = result
        assert result['LastRaceTime'] > 0, 'Continuous native finish did not record an elapsed result'
        assert result['LastRaceTime'] == result['RaceElapsed'] == result['BestCleanRaceTime'], 'Fresh continuous clean lap must establish the actual session best'
        assert not result['bLastRaceRetried'], 'Continuous native finish was labelled as recovered'
        REPORT.update(world_seconds=round(now-STATE['drive_started'], 3), actual_travel_cm=round(STATE['travel'], 2),
                      completed_missions=2, saved_completed_missions=2, all_gates_crossed_in_order=True,
                      actor_collision_enabled_throughout=True)
        finish(True)
        return
    assert phase in (u.QuebecCampaignPhase.RACE_READY, u.QuebecCampaignPhase.RACE_RUNNING)
    assert now-STATE['last_gate_time'] < 45, 'No directional checkpoint progress for 45 seconds'
    lookahead = max(450., min(950., 400.+STATE['speed']*.25))
    if STATE['last_gate'] == 3:
        lookahead = 450.
    elif STATE['last_gate'] == 4:
        lookahead = 1100.
    elif STATE['last_gate'] == len(STATE['gates']) - 1:
        # Earlier aim along the return leg avoids the old outside hairpin arc
        # where stationary traffic now blocks the otherwise unchanged route.
        lookahead = 950.
    target = point_along(STATE['progress']+lookahead)
    heading = math.radians(car.get_actor_rotation().yaw)
    angle = math.atan2(target[1]-position[1], target[0]-position[0])-heading
    angle = (angle+math.pi)%(2*math.pi)-math.pi
    ratio = min(1., STATE['speed']/2400.)
    lock = 30.-25.8*(ratio*ratio*(3.-2.*ratio))
    wheel = math.degrees(math.atan2(620.*math.sin(angle), max(150., distance(position, target))))
    steer = max(-1., min(1., wheel/lock))
    desired = 1600.
    for i in range(1, len(STATE['route'])-1):
        ahead = STATE['lengths'][i]-STATE['progress']
        if ahead < -900:
            continue
        a, b, c = STATE['route'][i-1:i+2]
        turn = abs(math.atan2(c[1]-b[1], c[0]-b[0])-math.atan2(b[1]-a[1], b[0]-a[0]))
        turn = min(turn%(2*math.pi), 2*math.pi-turn%(2*math.pi))
        if turn > .3 and ahead < max(900., (STATE['speed']**2-450.**2)/5000.+600.):
            desired = 450.
            break
    # Settle heading and lane after corners before accelerating past parked cars.
    if error > 50. or abs(angle) > .12:
        desired = min(desired, 450.)
    if abs(angle) > .3:
        desired = min(desired, 350.)
    throttle = -1. if STATE['speed'] > desired+90. else (1. if STATE['speed'] < desired-80. else 0.)
    car.call_method('MoveForward', (throttle,))
    car.call_method('MoveRight', (steer,))
    if now-STATE['last_sample'] >= 1.:
        REPORT['samples'].append({'world_seconds': round(now, 3), 'position_cm': vec(car.get_actor_location()),
                                  'speed_cm_s': round(STATE['speed'], 2), 'throttle': throttle, 'steer': round(steer, 3),
                                  'path_error_cm': round(error, 2), 'gate': gate})
        STATE['last_sample'] = now


def finish(passed, error=None):
    if STATE['stage'] == 'cleanup':
        return
    REPORT['passed'] = passed
    if error:
        REPORT['error'] = error
    car = STATE.get('car')
    if car:
        car.call_method('MoveForward', (0.,))
        car.call_method('MoveRight', (0.,))
        car.call_method('ApplyHandbrake')
    LEVELS.editor_request_end_play()
    STATE['stage'] = 'cleanup'


def cleanup():
    if u.EditorLevelLibrary.get_pie_worlds(True):
        return
    try:
        if OLD_QA is None:
            SAVE_PATH.unlink(missing_ok=True)
        else:
            SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)
            SAVE_PATH.write_bytes(OLD_QA)
        after = {str(p.relative_to(SAVE_DIR)): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in SAVE_DIR.rglob('*.sav') if p != SAVE_PATH} if SAVE_DIR.exists() else {}
        assert after == PRODUCTION, 'Production saves changed'
        REPORT['production_saves_unchanged'] = True
        REPORT['qa_save_restored'] = (SAVE_PATH.read_bytes() == OLD_QA) if OLD_QA is not None else not SAVE_PATH.exists()
    except Exception:
        REPORT.update(passed=False, cleanup_error=traceback.format_exc())
    finally:
        for key, value in ORIGINAL.items():
            SETTINGS.set_editor_property(key, value)
        SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
        REPORT['wall_seconds'] = round(time.monotonic()-STATE['started'], 3)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(REPORT, indent=2)+'\n')
        u.log('NORD_RACE_DRIVE '+('PASS' if REPORT['passed'] else 'FAIL')+' '+str(OUT))
        STATE['finished'] = True
        u.unregister_slate_post_tick_callback(STATE['callback'])
        SCRIPTING.call_method('SetKeepPythonScriptAlive', (False,))


def tick(delta):
    if STATE['finished']:
        return
    try:
        if STATE['stage'] != 'cleanup':
            assert time.monotonic()-STATE['started'] < 420, 'Continuous driving watchdog'
        {'begin': begin, 'discover': discover, 'enter': enter, 'drive': drive, 'cleanup': cleanup}[STATE['stage']]()
    except Exception:
        finish(False, traceback.format_exc())


SCRIPTING.call_method('SetKeepPythonScriptAlive', (True,))
STATE['callback'] = u.register_slate_post_tick_callback(tick)
