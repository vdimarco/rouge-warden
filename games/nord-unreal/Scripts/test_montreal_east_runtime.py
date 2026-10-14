"""Headless native LaFontaine east-extension behavior, with real population/collision.

Load /Game/Maps/LaFontaine, use -NullRHI -NordNoCampaignSave and ExecutePythonScript.
The active campaign's initial phase/completed count and all save files must remain
unchanged. The existing NoCampaignSave flag also suppresses disk loading; this is
an active-encounter preservation check, not a production save/reload test.
Root captures rendered views separately: standalone editor viewport calibration
differs from the separate client window used by test_college_runtime.py.
"""
import configparser
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shlex
import time
import traceback

import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
FLAGS = {arg.lower().split('=', 1)[0] for arg in shlex.split(u.SystemLibrary.get_command_line())}
assert '-nullrhi' in FLAGS, 'This behavior suite is headless; root owns the separate rendered inspection'
assert '-nordeastrenderchecks' not in FLAGS, 'Standalone rendered capture is separate; no rendered acceptance is claimed by this suite'
assert '-nordnocampaignsave' in FLAGS and '-nordnocampaign' not in FLAGS, 'Keep the campaign active and require -NordNoCampaignSave'
assert '-immersive' not in FLAGS, 'Start a fresh owned editor without auto-PIE'
LAYOUT = json.loads((ROOT/'Data/LaFontaine/layout.json').read_text())
EDGES = json.loads((ROOT/'Data/Plateau/EdgesGeometry/edges.json').read_text())
EXTENSION = json.loads((ROOT/'Data/Plateau/EastExtension/extension.json').read_text())
CONTEXT = json.loads((ROOT/'Data/Plateau/ContextGeometry/context.json').read_text())
OLD = {row['street']: row for row in EDGES['closures']}
PANET = OLD['Rue Panet']
OUTER = next(row for row in EXTENSION['closures'] if row['street'] == 'Rue Panet' and row['edge'] == 'east')
EAST_CAP = next(row for row in EXTENSION['hidden_collision']['bounds'] if row['label'].endswith('east boundary cap'))
assert EAST_CAP['bottom_z_cm'] == 200. and EAST_CAP['top_z_cm'] == 400. and EAST_CAP['outward_normal'] == [1., 0., 0.]
OLD_X, OUTER_X = EXTENSION['original_bounds_xy'][2], EXTENSION['expanded_bounds_xy'][2]
assert abs(OUTER_X-OLD_X-20000) < .01 and all(abs(row['mapped_exit_xy'][0]-OLD_X) < .01 for row in OLD.values())
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
EDITOR = u.get_editor_subsystem(u.UnrealEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
SYSTEM = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
GAMEPLAY = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
SCRIPTING = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
CLASSES = {kind: u.load_class(None, '/Script/Quebec.Quebec'+kind) for kind in ('Controller', 'Character', 'Car', 'Campaign', 'ParkResident')}
assert all(CLASSES.values()), 'Build the current QuebecEditor module first'
assert not u.EditorLevelLibrary.get_pie_worlds(True), 'Do not attach to another PIE session'
assert EDITOR.get_editor_world().get_path_name().startswith('/Game/Maps/LaFontaine.'), 'Load the saved expanded LaFontaine explicitly'
assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Preserve unsaved maps; use a fresh editor'
ORIGINAL = {key: SETTINGS.get_editor_property(key) for key in ('PlayNumberOfClients', 'RunUnderOneProcess')}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(ROOT/'Saved/Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    CONFIG.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
SAVE_DIR = ROOT/'Saved/SaveGames'


def save_inventory():
    return {str(path.relative_to(SAVE_DIR)): {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in sorted(SAVE_DIR.rglob('*.sav'))} if SAVE_DIR.exists() else {}


RUN = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
REPORT_PATH = ROOT/'Saved/Tests/DistrictRuntime'/('MontrealEastRuntime-'+RUN+'.json')
SAVES_BEFORE = save_inventory()
REPORT = {'passed': False, 'run': RUN, 'mode': 'owned standalone authority PIE; headless native callbacks',
          'checks': [], 'trace': [], 'crossings': {}, 'save_inventory_before': SAVES_BEFORE,
          'fixture_scope': 'Only the player and existing unoccupied starter car are relocated. Real ambient traffic, residents and every world collision remain active. Native callbacks cause observed crossings; no mission, velocity, occupancy or collision-state writes.',
          'limits': ['rendered/HUD/likeness acceptance', 'physical keyboard/mouse/touch delivery', 'packaged and multiplayer expansion behavior',
                     'performance and audio acceptance', 'naturally navigated trip from the original spawn to the extension',
                     'production save/reload (NoCampaignSave suppresses both disk loading and writing)',
                     'native jump containment is checked at the east Panet wall only; other new boundary strips receive static collision probes']}
REPORT['source_sha256'] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in (Path(__file__).resolve(), ROOT/'Data/Plateau/EdgesGeometry/edges.json', ROOT/'Data/Plateau/EastExtension/extension.json',
                 ROOT/'Data/Plateau/ContextGeometry/context.json', ROOT/'Scripts/plateau_context.py',
                 ROOT/'Source/Quebec/QuebecGameplay.cpp', ROOT/'Source/Quebec/QuebecCampaign.cpp', ROOT/'Content/Maps/LaFontaine.umap')}
STATE = {'started': time.monotonic(), 'step': -1, 'finished': False}
STEPS = []


def vec(point):
    return [round(point.x, 4), round(point.y, 4), round(point.z, 4)]


def distance(a, b):
    return math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2)


def actors(kind):
    return u.GameplayStatics.get_all_actors_of_class(STATE['world'], CLASSES[kind])


def basis(row):
    x, y = row['outward_direction']
    assert abs(math.hypot(x, y)-1) < .001
    return u.Vector(x, y, 0.), u.Vector(-y, x, 0.), math.degrees(math.atan2(y, x))


def trace(kind, **values):
    REPORT['trace'].append({'kind': kind, 'step': STEPS[STATE['step']][0] if STATE['step'] >= 0 else 'setup',
                            'wall_seconds': round(time.monotonic()-STATE['started'], 4), **values})


def native(actor, method):
    trace('native_input_callback', actor=actor.get_name(), method=method)
    u.SystemLibrary.set_timer_for_next_tick(actor, method)


def relocate(actor, target, yaw=None):
    assert u.GameplayStatics.get_game_mode(actor), 'Fixture relocation requires authority'
    trace('fixture_relocation', actor=actor.get_name(), before_cm=vec(actor.get_actor_location()), target_cm=vec(target), yaw=yaw)
    if yaw is None:
        actor.set_actor_location(target, False, True)
    else:
        actor.set_actor_location_and_rotation(target, u.Rotator(yaw=yaw), False, True)


def elapsed():
    world = STATE.get('world')
    if world and 'step_world_start' in STATE and any(world is live for live in u.EditorLevelLibrary.get_pie_worlds(True)):
        return u.GameplayStatics.get_time_seconds(world)-STATE['step_world_start']
    return time.monotonic()-STATE['step_started']


def step(name, action, ready, timeout=20, delay=.35):
    STEPS.append((name, action, ready, timeout, delay))


def start_step():
    STATE['step_started'] = time.monotonic()
    if STATE.get('world'):
        STATE['step_world_start'] = u.GameplayStatics.get_time_seconds(STATE['world'])
    STEPS[STATE['step']][1]()


def campaign_snapshot():
    campaign = STATE['campaign']
    return {'phase': str(campaign.get_editor_property('Phase')), 'completed': campaign.get_editor_property('CompletedMissions'),
            'legacy_mission_index': u.GameplayStatics.get_game_state(STATE['world']).get_editor_property('MissionIndex')}


def preserved():
    assert len(actors('Campaign')) == 1 and campaign_snapshot() == STATE['campaign_before'], 'Expansion fixture changed Montréal campaign/progression'
    assert {actor.get_path_name() for actor in actors('ParkResident')} == STATE['residents_before'], 'Ambient resident inventory changed'
    assert {actor.get_path_name() for actor in actors('Car')} == STATE['cars_before'], 'Ambient car inventory changed'
    assert all(car.get_actor_enable_collision() and car.is_actor_tick_enabled() for car in actors('Car') if car.get_editor_property('bTraffic')), 'Ambient traffic was disabled'
    REPORT['campaign_after'] = campaign_snapshot()
    return True


def begin():
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', 0))
    SETTINGS.set_editor_property('PlayNumberOfClients', 1)
    SETTINGS.set_editor_property('RunUnderOneProcess', True)
    LEVELS.editor_request_begin_play()


def discover():
    worlds = list(u.EditorLevelLibrary.get_pie_worlds(True))
    if len(worlds) != 1:
        return False
    world = worlds[0]
    if not u.GameplayStatics.get_game_mode(world):
        return False
    STATE['world'] = world
    pcs = actors('Controller')
    pc = next((pc for pc in pcs if pc.is_local_controller() and pc.get_controlled_pawn()), None)
    campaigns = actors('Campaign')
    if not pc or len(campaigns) != 1 or not u.GameplayStatics.get_game_state(world):
        return False
    assert world.get_path_name().split('.')[-1] == 'LaFontaine', 'Unexpected connected map'
    character = pc.get_controlled_pawn()
    assert isinstance(character, u.QuebecCharacter) and distance(character.get_actor_location(), u.Vector(*LAYOUT['spawn'])) < 600, 'Original Montréal spawn changed'
    starters = [car for car in actors('Car') if car.actor_has_tag('StarterCar')]
    assert len(starters) == 1 and not starters[0].get_controller() and not starters[0].get_editor_property('Occupant'), 'Need the real unoccupied starter'
    residents, traffic = actors('ParkResident'), [car for car in actors('Car') if car.get_editor_property('bTraffic')]
    assert len(residents) >= 64 and len(traffic) > 0 and len(actors('Car')) > 2, 'Full Montréal ambient population must remain active'
    STATE.update(pc=pc, character=character, car=starters[0], campaign=campaigns[0],
                 residents_before={actor.get_path_name() for actor in residents}, cars_before={actor.get_path_name() for actor in actors('Car')})
    STATE['campaign_before'] = campaign_snapshot()
    REPORT.update(campaign_before=STATE['campaign_before'], campaign_disk_loading_and_writing_suppressed=True,
                  population={'residents': len(residents), 'cars': len(actors('Car')), 'traffic': len(traffic)},
                  initial_player_cm=vec(character.get_actor_location()), initial_starter_cm=vec(starters[0].get_actor_location()))
    return preserved()


def hit_row(hit):
    row = GAMEPLAY.call_method('BreakHitResult', (hit,))
    component = row[10]
    mesh = component.get_editor_property('static_mesh') if isinstance(component, u.StaticMeshComponent) else None
    return {'actor': row[9].get_actor_label() if row[9] else None, 'distance_cm': row[3], 'point_cm': vec(row[5]),
            'mesh': mesh.get_path_name() if mesh else None}


def ground(point, height=100):
    ignored = [STATE['character'], *actors('Car')]
    hit = u.SystemLibrary.line_trace_single(STATE['world'], u.Vector(point.x, point.y, 10000), u.Vector(point.x, point.y, -500),
        u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, ignored, u.DrawDebugTrace.NONE, True)
    if not hit:
        return None
    row = GAMEPLAY.call_method('BreakHitResult', (hit,))
    if not row[0] or row[7].z < .7 or not -20 <= row[5].z <= 50:
        return None
    STATE['last_ground_hit'] = hit_row(hit)
    return row[5]+u.Vector(0., 0., height)


def assert_east_wall_stack(origin, extent, cap_origin, cap_extent):
    assert abs(origin.z+extent.z-200.) < .1 and abs(origin.z-extent.z) < .1, 'Native outer east wall must retain its actual 200cm height'
    assert abs(cap_origin.z-cap_extent.z-(origin.z+extent.z)) < .1 and abs(cap_origin.z+cap_extent.z-EAST_CAP['top_z_cm']) < .1, 'Actual original wall and cap must cover continuous Z0–400'
    assert abs(cap_origin.x-origin.x) < .1 and abs(cap_extent.x-extent.x) < .1 and abs(cap_origin.y-origin.y) < .1 and abs(cap_extent.y-extent.y) < .1, 'Upper cap must share the full original east wall footprint'


def collision_probes():
    world = STATE['world']
    all_actors = u.GameplayStatics.get_all_actors_of_class(world, u.Actor)
    labels = {}
    for actor in all_actors:
        labels.setdefault(actor.get_actor_label(), []).append(actor)
    floor = labels.get(EXTENSION['hidden_collision']['floor']['label'], [])
    assert len(floor) == 1, 'Load the freshly applied east extension'
    for label in EXTENSION['old_closure_labels_to_hide']:
        assert len(labels.get(label, [])) == 1 and labels[label][0].get_editor_property('bHidden'), ('Former decoration remains visible', label)
    east = [actor for actor in labels.get('District edge', []) if abs(actor.get_actor_location().x-OUTER_X) < .1]
    assert len(east) == 1, 'The old east wall must have moved exactly to the new outer edge'
    origin, extent = east[0].get_actor_bounds(False, False)
    cap = labels.get(EAST_CAP['label'], [])
    assert len(cap) == 1, 'Need the new upper east cap over the preserved original wall'
    cap_origin, cap_extent = cap[0].get_actor_bounds(False, False)
    assert_east_wall_stack(origin, extent, cap_origin, cap_extent)
    STATE['wall_inner_x'] = origin.x-extent.x
    STATE['east_walls'] = [east[0], cap[0]]
    REPORT['outer_wall'] = {'actor': east[0].get_path_name(), 'bounds_origin_cm': vec(origin), 'bounds_extent_cm': vec(extent), 'height_cm': 2*extent.z,
        'cap_actor': cap[0].get_path_name(), 'cap_bounds_origin_cm': vec(cap_origin), 'cap_bounds_extent_cm': vec(cap_extent), 'continuous_top_z_cm': cap_origin.z+cap_extent.z}
    ignored = [STATE['character'], *actors('Car')]
    probes = REPORT['native_collision_probes'] = []
    for name, source in OLD.items():
        forward, _, _ = basis(source)
        exit = u.Vector(*source['mapped_exit_xy'], 0.)
        for along in (-100, 100, 1200):
            point = ground(exit+forward*along)
            assert point is not None, ('Former exit ground missing', name, along)
            surface = STATE['last_ground_hit']
            probe = {'street': name, 'along_from_old_edge_cm': along, 'surface': surface}
            probes.append(probe)
            if along > 0:
                # Context roads are authored at Z=6 (plateau_context.py); their visibility hit is not the slab.
                if surface['actor'] == EXTENSION['hidden_collision']['floor']['label']:
                    expected_z = EXTENSION['hidden_collision']['floor']['top_z_cm']
                else:
                    prefix = '/Game/Plateau/Context/SM_'
                    assert surface['mesh'] and surface['mesh'].startswith(prefix), ('Unexpected extension walking surface', surface)
                    batch = surface['mesh'][len(prefix):].split('.')[0]
                    metadata = CONTEXT['materials'][batch]
                    assert metadata['material'] == 'Asphalt' and metadata['bounds_cm'][0][2] == metadata['bounds_cm'][1][2] == 6., ('Source road must have its authored flat height', batch)
                    expected_z = metadata['bounds_cm'][0][2]
                assert abs(point.z-100.-expected_z) < .1, ('Native surface differs from its actual source', name, surface, expected_z)
                # Trace below the retained 6cm road overlay to prove the new Z=0 collision slab independently.
                floor_z = EXTENSION['hidden_collision']['floor']['top_z_cm']
                floor_hit = u.SystemLibrary.line_trace_single(world, u.Vector(point.x, point.y, floor_z+.1),
                    u.Vector(point.x, point.y, floor_z-25), u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, ignored, u.DrawDebugTrace.NONE, True)
                assert floor_hit, ('New collision slab missing below retained road', name, along)
                floor_row = hit_row(floor_hit)
                assert floor_row['actor'] == EXTENSION['hidden_collision']['floor']['label'] and abs(floor_row['point_cm'][2]-floor_z) < .1, ('Wrong supporting slab', floor_row)
                probe.update(expected_surface_z_cm=expected_z, supporting_floor=floor_row)
        hit = u.SystemLibrary.line_trace_single(world, exit-forward*500+u.Vector(0., 0., 100.), exit+forward*500+u.Vector(0., 0., 100.),
            u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, ignored, u.DrawDebugTrace.NONE, True)
        assert not hit, ('Former edge still blocks a native collision ray', name, hit_row(hit) if hit else None)
    volumes = [{'label': east[0].get_actor_label(), 'point': u.Vector(*OUTER['mapped_exit_xy'], 100.), 'normal': u.Vector(1., 0., 0.)}]
    for volume in EXTENSION['hidden_collision']['bounds']:
        actual = labels.get(volume['label'], [])
        assert len(actual) == 1, ('Missing/duplicate outer collision actor', volume['label'])
        actual_origin, actual_extent = actual[0].get_actor_bounds(False, False)
        assert distance(actual_origin, u.Vector(*volume['location_cm'])) < .1 and distance(actual_extent, u.Vector(*(v/2 for v in volume['size_cm']))) < .1, ('Outer collision bounds differ from source', volume['label'])
        assert abs(actual_origin.z-actual_extent.z-volume['bottom_z_cm']) < .1 and abs(actual_origin.z+actual_extent.z-volume['top_z_cm']) < .1
        point = u.Vector(*volume['location_cm'])
        normal = u.Vector(*volume['outward_normal'])
        volumes.append({'label': volume['label'], 'point': point, 'normal': normal})
    for volume in volumes:
        hit = u.SystemLibrary.line_trace_single(world, volume['point']-volume['normal']*500, volume['point']+volume['normal']*500,
            u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, ignored, u.DrawDebugTrace.NONE, True)
        assert hit and hit_row(hit)['actor'] == volume['label'], ('Actual outer boundary collision missing', volume['label'])
        probes.append({'outer_boundary': volume['label'], **hit_row(hit)})
    REPORT['native_collision_probes'] = probes
    return preserved()


def walking_fixture(source, containment=False):
    release_controls()
    forward, right, yaw = basis(source)
    exit = u.Vector(*source['mapped_exit_xy'], 0.)
    before, after = (650, 150) if containment else (650, 1000)
    for offset in (0, 145, -145, 220, -220):
        first = ground(exit-forward*before+right*offset)
        last = ground(exit+forward*after+right*offset)
        if not first:
            continue
        if containment:
            # Only the starting capsule must fit: the real outer wall must block the subsequent native attempt.
            last = first+u.Vector(0., 0., .1)
        if last and not u.SystemLibrary.capsule_trace_single_by_profile(STATE['world'], first, last, 42, 96,
                'Pawn', False, [STATE['character']], u.DrawDebugTrace.NONE, True):
            STATE.update(foot_fixture=first, forward=forward, source_exit=exit, fixture_street=source['street'])
            relocate(STATE['character'], first, yaw)
            STATE['pc'].set_control_rotation(u.Rotator(pitch=-12, yaw=yaw))
            trace('mapped_walking_setup', street=source['street'], source_way=source['source'], outward=vec(forward),
                  lateral_offset_cm=offset, start_cm=vec(first), collision_active=True, containment=containment)
            return
    raise AssertionError('No grounded capsule-clear fixture with real traffic/collision at '+source['street'])


def foot_arrived():
    movement = STATE['character'].get_component_by_class(u.CharacterMovementComponent)
    return distance(STATE['character'].get_actor_location(), STATE['foot_fixture']) < 40 and not movement.is_falling()


def foot_input():
    STATE['foot_axis'] = 1.
    STATE['character'].disable_input(STATE['pc'])
    STATE['foot_start'] = STATE['character'].get_actor_location()
    STATE['samples'] = {'max_x_cm': STATE['foot_start'].x, 'max_z_cm': STATE['foot_start'].z, 'airborne_observed': False}


def run_up_ready():
    point = STATE['character'].get_actor_location()
    delta = STATE['source_exit']-point
    remaining = delta.x*STATE['forward'].x+delta.y*STATE['forward'].y
    if remaining > 350:
        return False
    velocity = STATE['character'].get_velocity()
    speed = math.hypot(velocity.x, velocity.y)
    assert 300 <= remaining <= 350 and speed >= 400, ('Running-jump launch window missed', remaining, speed)
    return True


def running_jump():
    character = STATE['character']
    movement = character.get_component_by_class(u.CharacterMovementComponent)
    assert abs(movement.get_editor_property('jump_z_velocity')-600.) < .01, 'Test the production JumpZVelocity600'
    velocity = character.get_velocity()
    speed = math.hypot(velocity.x, velocity.y)
    assert speed >= 400 and STATE.get('foot_axis') == 1., 'Jump must preserve an actual native run-up'
    STATE['foot_start'] = character.get_actor_location()
    STATE['samples'] = {'max_x_cm': STATE['foot_start'].x, 'max_z_cm': STATE['foot_start'].z,
                        'airborne_observed': False, 'airborne_wall_contact_observed': False}
    STATE['jump_active'] = True
    REPORT['jump_input'] = {'jump_z_velocity': 600, 'jump_max_hold_time': character.get_editor_property('JumpMaxHoldTime'),
                            'launch_cm': vec(STATE['foot_start']), 'native_launch_speed_cm_per_s': speed,
                            'scope': 'Native running Jump press once; StopJumping deferred to window end while forward stays held. Native zero max-hold time remains unchanged; not physical keyboard delivery.'}
    native(character, 'Jump')


def crossed():
    point = STATE['character'].get_actor_location()
    delta = point-STATE['source_exit']
    along = delta.x*STATE['forward'].x+delta.y*STATE['forward'].y
    if along < 700 or point.x < OLD_X+300:
        return False
    release_controls()
    REPORT['crossings'][STATE['fixture_street']] = {'start_cm': vec(STATE['foot_start']), 'end_cm': vec(point),
        'native_distance_cm': distance(point, STATE['foot_start']), 'outward_progress_from_former_edge_cm': along,
        'scope': 'Observed native walking after the logged fixture placement, not a naturally navigated approach'}
    return preserved()


def driving_fixture():
    car = STATE['car']
    assert not car.get_controller() and not car.get_editor_property('Occupant') and abs(car.get_editor_property('Speed')) < 1
    forward, right, yaw = basis(PANET)
    exit = u.Vector(*PANET['mapped_exit_xy'], 0.)
    for offset in (145, -145, 0):
        point = ground(exit-forward*1400+right*offset, 102)
        last = ground(exit+forward*5000+right*offset, 102)
        if not point or not last:
            continue
        hit = u.SystemLibrary.box_trace_single_by_profile(STATE['world'], point, last, u.Vector(235, 110, 80),
            u.Rotator(yaw=yaw), 'Pawn', False, [car, STATE['character']], u.DrawDebugTrace.NONE, True)
        if hit:
            trace('driving_candidate_blocked', offset_cm=offset, **hit_row(hit))
            continue
        relocate(car, point, yaw)
        STATE.update(drive_fixture=point, drive_forward=forward, drive_exit=exit)
        trace('mapped_drive_setup', street=PANET['street'], source_way=PANET['source'], native_box_sweep_clear_cm=distance(point, last),
              lateral_offset_cm=offset, scope='Existing starter relocated empty from its original curb; native entry/drive/brake/exit follow. Other cars/residents/collision unchanged.')
        return
    raise AssertionError('No real-population clear Panet driving lane across the former edge')


def approach():
    car = STATE['car']
    for offset in (car.get_actor_right_vector()*185, car.get_actor_right_vector()*-185, car.get_actor_forward_vector()*-350):
        point = ground(car.get_actor_location()+offset)
        if not point or distance(point, car.get_actor_location()) >= 450:
            continue
        if any(other != car and not other.get_controller() and not other.get_editor_property('Occupant') and distance(other.get_actor_location(), point) <= 450 for other in actors('Car')):
            continue
        if u.SystemLibrary.capsule_trace_single_by_profile(STATE['world'], point, point+u.Vector(0., 0., .1), 42, 96,
                'Pawn', False, [STATE['character']], u.DrawDebugTrace.NONE, True):
            continue
        STATE['foot_fixture'] = point
        relocate(STATE['character'], point)
        return
    raise AssertionError('No clear approach isolates the starter from other available parked cars')


def entered():
    character, car = STATE['character'], STATE['car']
    if STATE['pc'].get_controlled_pawn() != car or car.get_editor_property('Occupant') != character:
        return False
    assert character.get_editor_property('bInVehicle') and character.get_editor_property('bHidden') and not character.get_actor_enable_collision()
    return preserved()


def drive():
    STATE['drive_start'] = STATE['car'].get_actor_location()
    STATE['drive_axis'] = 1.
    STATE['car'].disable_input(STATE['pc'])


def driven():
    car = STATE['car']; point = car.get_actor_location(); delta = point-STATE['drive_exit']
    along = delta.x*STATE['drive_forward'].x+delta.y*STATE['drive_forward'].y
    if point.x < OLD_X+600 or along < 900:
        return False
    assert distance(point, STATE['drive_start']) > 1500 and car.get_editor_property('Speed') > 300, 'Native throttle must drive the crossing'
    REPORT['native_car_crossing'] = {'start_cm': vec(STATE['drive_start']), 'end_cm': vec(point), 'distance_cm': distance(point, STATE['drive_start']),
                                     'outward_progress_from_old_edge_cm': along, 'speed_cm_per_s': car.get_editor_property('Speed')}
    STATE['drive_axis'] = -1.
    return preserved()


def foot_braked():
    speed = STATE['car'].get_editor_property('Speed')
    if speed > 100:
        return False
    assert speed > -250, 'Native foot brake overshot into reverse before observation'
    REPORT['foot_brake_speed_cm_per_s'] = speed
    release_controls()
    return True


def stopped():
    return STATE['car'].get_editor_property('bHandbrake') and abs(STATE['car'].get_editor_property('Speed')) < 1


def exited():
    if STATE['pc'].get_controlled_pawn() != STATE['character'] or STATE['car'].get_editor_property('Occupant'):
        return False
    assert not STATE['character'].get_editor_property('bInVehicle') and not STATE['character'].get_editor_property('bHidden')
    assert STATE['character'].get_actor_enable_collision(), 'Native exit must restore walking collision'
    point = STATE['character'].get_actor_location()
    assert point.x > OLD_X+300 and point.z < 200, 'Exit must return to supported walking ground inside the new extension'
    REPORT['native_exit_cm'] = vec(point)
    return preserved()


def contained(jump):
    if elapsed() < 2.5:
        return False
    release_controls()
    sample = STATE['samples']
    assert sample['max_x_cm'] <= STATE['wall_inner_x']-42+5, ('Player crossed/climbed the actual outer wall', jump, sample, STATE['wall_inner_x'])
    if jump:
        assert sample['airborne_observed'] and sample['max_z_cm'] > STATE['foot_start'].z+50, 'Containment must include a delivered native jump'
        assert sample['airborne_wall_contact_observed'], 'Running jump must reach the actual wall while airborne'
    else:
        assert sample['max_x_cm'] > STATE['foot_start'].x+100, 'Walking pressure must reach the actual boundary'
    REPORT.setdefault('native_containment', {})['forward_and_jump' if jump else 'walking'] = {
        'start_cm': vec(STATE['foot_start']), 'end_cm': vec(STATE['character'].get_actor_location()), **sample,
        'wall_inner_x_cm': STATE['wall_inner_x'], 'capsule_radius_cm': 42, 'window_game_seconds': elapsed()}
    return preserved()


def release_controls():
    STATE.pop('foot_axis', None); STATE.pop('drive_axis', None)
    STATE.pop('jump_active', None)
    errors = []
    for key in ('character', 'car'):
        actor, pc = STATE.get(key), STATE.get('pc')
        if not actor or not pc:
            continue
        try:
            actor.call_method('MoveForward', (0.,)); actor.call_method('MoveRight', (0.,))
            if key == 'character': actor.stop_jumping()
            else: actor.call_method('ReleaseHandbrake')
            if actor.get_controller() == pc: actor.enable_input(pc)
        except Exception as error:
            errors.append(key+': '+str(error))
    assert not errors, 'Control release failures after attempting both actors: '+str(errors)


step('fresh original Montréal spawn/campaign and real ambient population', begin, discover, timeout=30)
step('native new floor/outer collision and open former-edge probes', lambda: None, collision_probes)
for street in ('Rue Panet', 'Rue de la Visitation'):
    step('arrange clear native walking at former '+street+' edge', lambda street=street: walking_fixture(OLD[street]), foot_arrived)
    step('walk through former '+street+' wall and closures', foot_input, crossed)
step('arrange the existing starter in a clear Panet lane with real traffic active', driving_fixture, lambda: abs(STATE['car'].get_editor_property('Speed')) < 1)
step('arrange a clear starter approach isolated from other parked cars', approach, foot_arrived)
step('native interaction enters the original starter', lambda: native(STATE['pc'], 'Interact'), entered)
step('native throttle drives through the former Panet boundary', drive, driven)
step('native foot brake slows the car in the extension', lambda: None, foot_braked, delay=.1)
step('native handbrake stops before exit', lambda: native(STATE['car'], 'ApplyHandbrake'), stopped)
step('native exit restores the walker on new extension ground', lambda: native(STATE['pc'], 'Interact'), exited)
step('arrange a grounded approach to the real outer east wall', lambda: walking_fixture(OUTER, True), foot_arrived)
step('actual outer wall contains sustained native walking pressure', foot_input, lambda: contained(False))
step('reset the source-derived outer approach for the production jump', lambda: walking_fixture(OUTER, True), foot_arrived)
step('native run-up reaches the running-jump launch window', foot_input, run_up_ready)
step('actual continuous 400cm outer boundary contains running forward pressure and native JumpZ600', running_jump, lambda: contained(True))
step('campaign/progression and ambient inventories remain intact', release_controls, preserved)


def finish(error=None):
    if STATE.get('finishing'): return
    STATE.update(finishing=True, finish_error=error, cleanup_started=time.monotonic())
    if error:
        REPORT.update(error=error, failed_step=STEPS[max(0, STATE['step'])][0])
        u.log_error('NORD_MONTREAL_EAST_RUNTIME_FAILED '+error)
    try:
        release_controls()
        REPORT['controls_released_before_endplay'] = True
    except Exception:
        STATE['finish_error'] = (STATE.get('finish_error') or '')+'\nControl cleanup failure:\n'+traceback.format_exc()
    finally:
        LEVELS.editor_request_end_play()


def restore_settings():
    for key, value in ORIGINAL.items(): SETTINGS.set_editor_property(key, value)
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
    REPORT['play_settings_restored'] = all(SETTINGS.get_editor_property(key) == value for key, value in ORIGINAL.items())
    REPORT['restored_play_net_mode'] = ORIGINAL_MODE
    assert REPORT['play_settings_restored'], 'PIE settings did not restore'


def write_report():
    try:
        STATE['finished'] = True
        REPORT.update(passed=not STATE.get('finish_error'), elapsed_seconds=round(time.monotonic()-STATE['started'], 2))
        if STATE.get('finish_error'): REPORT['error'] = STATE['finish_error']
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        assert not REPORT_PATH.exists(), 'Never overwrite earlier QA'
        REPORT_PATH.write_text(json.dumps(REPORT, indent=2)+'\n')
        u.log(('NORD_MONTREAL_EAST_RUNTIME_OK ' if REPORT['passed'] else 'NORD_MONTREAL_EAST_RUNTIME_FAILED ')+str(REPORT_PATH))
    finally:
        u.unregister_slate_post_tick_callback(STATE['callback'])
        SCRIPTING.call_method('SetKeepPythonScriptAlive', (False,))


def tick(delta_seconds):
    if STATE['finished'] or STATE.get('ticking'): return
    STATE['ticking'] = True
    try:
        if STATE.get('finishing'):
            if u.EditorLevelLibrary.get_pie_worlds(True):
                assert time.monotonic()-STATE['cleanup_started'] < 15, 'PIE teardown timed out'
                return
            REPORT['pie_worlds_stopped'] = True
            current = save_inventory()
            REPORT.update(save_inventory_after=current, all_save_hashes_unchanged=current == SAVES_BEFORE)
            assert current == SAVES_BEFORE, 'A save file changed; preserve failure evidence'
            restore_settings(); write_report(); return
        assert time.monotonic()-STATE['started'] < 240, 'East expansion suite total timeout'
        if STATE['step'] < 0:
            if time.monotonic()-STATE['started'] < 1: return
            STATE['step'] = 0; start_step()
        name, action, ready, timeout, delay = STEPS[STATE['step']]
        assert time.monotonic()-STATE['step_started'] < timeout, 'Step timeout: '+name
        if STATE.get('foot_axis') is not None:
            STATE['character'].call_method('MoveForward', (STATE['foot_axis'],))
            point = STATE['character'].get_actor_location(); sample = STATE['samples']
            sample['max_x_cm'] = max(sample['max_x_cm'], point.x); sample['max_z_cm'] = max(sample['max_z_cm'], point.z)
            airborne = STATE['character'].get_component_by_class(u.CharacterMovementComponent).is_falling()
            sample['airborne_observed'] |= airborne
            if STATE.get('jump_active') and airborne and point.x >= STATE['wall_inner_x']-42-20 and point.z > STATE['foot_start'].z+50:
                hit = u.SystemLibrary.capsule_trace_single_by_profile(STATE['world'], point, point+STATE['forward']*40, 42, 96,
                    'Pawn', False, [STATE['character']], u.DrawDebugTrace.NONE, True)
                if hit and GAMEPLAY.call_method('BreakHitResult', (hit,))[9] in STATE['east_walls']:
                    sample['airborne_wall_contact_observed'] = True
                    sample.setdefault('first_airborne_wall_contact_cm', vec(point))
                    sample.setdefault('first_airborne_wall_contact_actor', GAMEPLAY.call_method('BreakHitResult', (hit,))[9].get_path_name())
        if STATE.get('drive_axis') is not None: STATE['car'].call_method('MoveForward', (STATE['drive_axis'],))
        if elapsed() < delay or not ready(): return
        REPORT['checks'].append(name); u.log('NORD_MONTREAL_EAST_RUNTIME_CHECK '+name)
        STATE['step'] += 1
        if STATE['step'] == len(STEPS): finish()
        else: start_step()
    except Exception:
        error = traceback.format_exc()
        if STATE.get('finishing'):
            STATE['finish_error'] = (STATE.get('finish_error') or '')+'\nCleanup failure:\n'+error
            try: restore_settings()
            finally: write_report()
        else: finish(error)
    finally:
        STATE['ticking'] = False


SCRIPTING.call_method('SetKeepPythonScriptAlive', (True,))
STATE['callback'] = u.register_slate_post_tick_callback(tick)
u.log('NORD_MONTREAL_EAST_RUNTIME_START '+str(REPORT_PATH))
