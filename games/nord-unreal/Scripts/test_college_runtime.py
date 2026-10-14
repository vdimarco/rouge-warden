"""Fresh CollegeBathurst two-peer native PIE checks; no assets or save slots are authored.

Load /Game/Maps/CollegeBathurst and use -NullRHI for this headless behavior suite.
Authority relocations arrange explicitly recorded fixtures. Native client input callbacks,
movement, RPCs and readbacks provide behavioral checks; physical controls and visual/FPS
acceptance remain separate. Each run writes fresh timestamped evidence, never old QA.
"""
import configparser
from datetime import datetime, timezone
import hashlib
import heapq
import json
import math
from pathlib import Path
import re
import shlex
import time
import traceback

import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
ARGS = shlex.split(u.SystemLibrary.get_command_line())
FLAGS = {arg.lower() for arg in ARGS}
assert '-nullrhi' in FLAGS, 'This two-peer behavior suite requires -NullRHI'
assert '-norddistrictrenderchecks' not in FLAGS, 'Rendered inspection uses the separate owned single-player capture fixture'
assert not {arg.split('=', 1)[0] for arg in FLAGS}.intersection({'-nordnocampaign', '-nordnocampaignsave'}), 'Do not mask district campaign/save isolation with suppression flags'
assert '-immersive' not in FLAGS, 'Start fresh without -immersive auto-PIE; this suite owns its two-peer session'
RUN = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
REPORT_PATH = ROOT / 'Saved/Tests/DistrictRuntime' / f'RuntimeHeadless-{RUN}.json'
LAYOUT_PATH = ROOT / 'Data/CollegeBathurst/layout.json'
LAYOUT = json.loads(LAYOUT_PATH.read_text())
MONTREAL = json.loads((ROOT / 'Data/LaFontaine/layout.json').read_text())
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
EDITOR = u.get_editor_subsystem(u.UnrealEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
SYSTEM = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
GAMEPLAY = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
SCRIPTING = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
CLASSES = {kind: u.load_class(None, '/Script/Quebec.Quebec' + kind)
           for kind in ('Controller', 'Character', 'Car', 'ParkResident', 'Campaign')}
assert all(CLASSES.values()), 'Build the current QuebecEditor module first'
assert not u.EditorLevelLibrary.get_pie_worlds(True), 'Start a fresh owned editor without another PIE session'
assert EDITOR.get_editor_world().get_path_name().startswith('/Game/Maps/CollegeBathurst.'), 'Load the saved CollegeBathurst map explicitly'
assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Preserve unsaved editor maps; run in a fresh editor'
ORIGINAL = {key: SETTINGS.get_editor_property(key) for key in
            ('PlayNumberOfClients', 'RunUnderOneProcess', 'NewWindowWidth', 'NewWindowHeight', 'ClientWindowWidth', 'ClientWindowHeight')}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(ROOT / 'Saved/Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    CONFIG.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
SAVE_DIR = ROOT / 'Saved/SaveGames'


def save_inventory():
    return {str(path.relative_to(SAVE_DIR)): {'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in sorted(SAVE_DIR.rglob('*.sav'))} if SAVE_DIR.exists() else {}


SAVES_BEFORE = save_inventory()
REPORT = {'passed': False, 'run': RUN, 'mode': 'two-player in-process listen-server PIE',
          'map': '/Game/Maps/CollegeBathurst', 'rendered': False, 'checks': [], 'trace': [],
          'save_inventory_before': SAVES_BEFORE,
          'fixture_scope': 'Authority relocations arrange named surveyed locations; client callbacks drive actual native movement/RPCs. No mission, speed, occupancy, collision or appearance state writes.',
          'limits': ['rendered/HUD/likeness acceptance', 'physical keyboard/mouse/touch delivery', 'packaged build and external internet',
                     'handling enjoyment and audio', 'naturally navigated end-to-end College Street route',
                     'frame-rate acceptance', 'file-read interception (save isolation uses absent campaign actors, guarded source and unchanged files)',
                     'outer running jump checks one source-derived boundary with the authority host; no remote jump replication or all-edge jump acceptance']}
REPORT['source_sha256'] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in (Path(__file__).resolve(), LAYOUT_PATH, ROOT/'Source/Quebec/CollegeBathurstMap.h',
                 ROOT/'Source/Quebec/QuebecGameplay.cpp', ROOT/'Source/Quebec/QuebecCampaign.cpp',
                 ROOT/'Source/Quebec/QuebecSwimming.cpp', ROOT/'Content/Maps/CollegeBathurst.umap')}
STATE = {'started': time.monotonic(), 'step': -1, 'finished': False, 'session': 1}
STEPS = []


def vec(point):
    return [round(point.x, 4), round(point.y, 4), round(point.z, 4)]


def distance(a, b):
    return math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2)


def actors(world, kind):
    return u.GameplayStatics.get_all_actors_of_class(world, CLASSES[kind])


def trace(kind, **values):
    REPORT['trace'].append({'kind': kind, 'step': STEPS[STATE['step']][0] if STATE['step'] >= 0 else 'setup',
                            'wall_seconds': round(time.monotonic()-STATE['started'], 4), **values})


def native(target, method):
    trace('native_input_callback', actor=target.get_name(), method=method)
    u.SystemLibrary.set_timer_for_next_tick(target, method)


def relocate(actor, target, yaw=None):
    assert u.GameplayStatics.get_game_mode(actor), 'Only authority actors may arrange fixtures'
    trace('fixture_relocation', actor=actor.get_name(), before_cm=vec(actor.get_actor_location()), target_cm=vec(target), yaw=yaw)
    if yaw is None:
        actor.set_actor_location(target, False, True)
    else:
        actor.set_actor_location_and_rotation(target, u.Rotator(yaw=yaw), False, True)


def elapsed():
    world = STATE.get('step_world')
    if world and any(world is live for live in u.EditorLevelLibrary.get_pie_worlds(True)):
        return u.GameplayStatics.get_time_seconds(world)-STATE['step_world_started']
    return time.monotonic()-STATE['step_started']


def step(name, action, ready, timeout=20, delay=.35):
    STEPS.append((name, action, ready, timeout, delay))


def start_step():
    STATE['step_started'] = time.monotonic()
    STATE['step_world'] = STATE.get('client')
    if STATE['step_world']:
        STATE['step_world_started'] = u.GameplayStatics.get_time_seconds(STATE['step_world'])
    STEPS[STATE['step']][1]()


def survey_route():
    """Only broad College Street edges; shared OSM nodes define Euclid/Grace junctions."""
    graph = {}
    for road, name, width in zip(LAYOUT['roads'], LAYOUT['road_names'], LAYOUT['road_widths']):
        if name != 'College Street' or width < 900:
            continue
        for a, b in zip(road, road[1:]):
            a, b = tuple(a), tuple(b)
            length = math.dist(a, b)
            graph.setdefault(a, []).append((b, length, width))
            graph.setdefault(b, []).append((a, length, width))
    junctions = {}
    for street in ('Euclid Avenue', 'Grace Street'):
        shared = {tuple(point) for road, name in zip(LAYOUT['roads'], LAYOUT['road_names'])
                  if name == street for point in road}.intersection(graph)
        assert len(shared) == 1, (street, 'requires one surveyed College junction', shared)
        junctions[street] = next(iter(shared))
    corner = tuple(LAYOUT['landmarks']['intersection']['position'])
    assert corner in graph, 'Bathurst/College source node missing'
    target = junctions['Grace Street']
    queue, cost, previous = [(0., corner)], {corner: 0.}, {}
    while queue:
        total, node = heapq.heappop(queue)
        if total != cost[node]:
            continue
        if node == target:
            break
        for following, length, width in graph[node]:
            if total+length < cost.get(following, math.inf):
                cost[following] = total+length
                previous[following] = (node, width)
                heapq.heappush(queue, (total+length, following))
    assert target in previous, 'No surveyed College Street chain reaches Grace'
    points, widths = [target], []
    while points[-1] != corner:
        prior, width = previous[points[-1]]
        points.append(prior)
        widths.append(width)
    points.reverse(); widths.reverse()
    assert junctions['Euclid Avenue'] in points, 'College chain must pass Euclid'
    euclid_index = points.index(junctions['Euclid Avenue'])
    halfway = sum(math.dist(a, b) for a, b in zip(points[:euclid_index], points[1:euclid_index+1]))/2
    remaining = halfway
    for index, (a, b) in enumerate(zip(points, points[1:])):
        length = math.dist(a, b)
        if remaining <= length:
            college = tuple(a[axis]+(b[axis]-a[axis])*remaining/length for axis in (0, 1))
            college_index = index
            break
        remaining -= length
    return points, widths, {'Corner': (corner, 0), 'College': (college, college_index),
                            'Euclid': (junctions['Euclid Avenue'], euclid_index), 'Grace': (target, len(points)-2)}


ROUTE, ROAD_WIDTHS, ANCHORS = survey_route()
REPORT['mapped_corridor'] = {'road': 'College Street', 'source_points_cm': [list(p) for p in ROUTE],
                            'length_cm': round(sum(math.dist(a, b) for a, b in zip(ROUTE, ROUTE[1:])), 2),
                            'scope': 'Static ground and vehicle/capsule clearance probes; not an observed end-to-end drive'}


def direction(index):
    a, b = ROUTE[index], ROUTE[index+1]
    length = math.dist(a, b)
    forward = u.Vector((b[0]-a[0])/length, (b[1]-a[1])/length, 0.)
    return forward, u.Vector(-forward.y, forward.x, 0.), math.degrees(math.atan2(forward.y, forward.x))


def ground(point, height, ignore):
    hit = u.SystemLibrary.line_trace_single(STATE['server'], u.Vector(point.x, point.y, 10000),
        u.Vector(point.x, point.y, -500), u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, ignore, u.DrawDebugTrace.NONE, True)
    if not hit:
        return None
    result = GAMEPLAY.call_method('BreakHitResult', (hit,))
    if not result[0] or result[7].z < .7 or not -200 < result[5].z < 50:
        return None
    return result[5]+u.Vector(0., 0., height)


def clear_walker(base, forward, offsets, character, sweep=900):
    for offset in offsets:
        point = ground(base+offset, 100, [character, STATE['server_car']])
        if point and not u.SystemLibrary.capsule_trace_single_by_profile(STATE['server'], point, point+forward*sweep,
                42, 96, 'Pawn', False, [character], u.DrawDebugTrace.NONE, True):
            return point
    raise AssertionError('No clear grounded walking fixture at surveyed anchor '+str(vec(base)))


def begin():
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', 1))
    SETTINGS.set_editor_property('PlayNumberOfClients', 2)
    SETTINGS.set_editor_property('RunUnderOneProcess', True)
    LEVELS.editor_request_begin_play()


def isolation():
    inventory = {}
    for side in ('server', 'client'):
        world = STATE[side]
        campaign, residents, cars = actors(world, 'Campaign'), actors(world, 'ParkResident'), actors(world, 'Car')
        assert not campaign and not residents, (side, 'Toronto borrowed a Montréal campaign/crowd')
        assert len(cars) == 1 and not cars[0].get_editor_property('bTraffic'), (side, 'Toronto must contain only the manual starter car')
        state = u.GameplayStatics.get_game_state(world)
        assert state and state.get_editor_property('MissionIndex') == 0, (side, 'Montréal legacy progress changed')
        inventory[side] = {'world': world.get_path_name(), 'campaigns': len(campaign), 'residents': len(residents),
                           'cars': len(cars), 'traffic': 0, 'mission_index': 0,
                           'players': len(state.get_editor_property('PlayerArray'))}
        assert inventory[side]['players'] == 2, (side, 'Expected exactly two connected players')
    REPORT['latest_runtime_inventory'] = inventory
    return True


def discover():
    worlds = list(u.EditorLevelLibrary.get_pie_worlds(True))
    if len(worlds) != 2:
        return False
    server = next((world for world in worlds if u.GameplayStatics.get_game_mode(world)), None)
    client = next((world for world in worlds if not u.GameplayStatics.get_game_mode(world)), None)
    if not server or not client:
        return False
    host = next((pc for pc in actors(server, 'Controller') if pc.is_local_controller()), None)
    remote = next((pc for pc in actors(server, 'Controller') if not pc.is_local_controller()), None)
    local = next((pc for pc in actors(client, 'Controller') if pc.is_local_controller()), None)
    if not all(pc and pc.get_controlled_pawn() for pc in (host, remote, local)):
        return False
    states = [u.GameplayStatics.get_game_state(world) for world in worlds]
    if any(not state or len(state.get_editor_property('PlayerArray')) != 2 for state in states):
        return False
    # A joining client can expose its transient Entry world before native player readiness.
    # Require connected controllers/pawns and both game states before final map identity.
    assert all(re.search(r'(?:^|/)UEDPIE_\d+_CollegeBathurst[.]', world.get_path_name()) for world in worlds), 'Unexpected connected PIE map'
    server_cars, client_cars = actors(server, 'Car'), actors(client, 'Car')
    if not server_cars or not client_cars:
        return False
    assert len(server_cars) == len(client_cars) == 1, 'One authored starter must replicate'
    STATE.update(server=server, client=client, host_pc=host, server_pc=remote, client_pc=local,
                 host_char=host.get_controlled_pawn(), server_char=remote.get_controlled_pawn(),
                 client_char=local.get_controlled_pawn(), server_car=server_cars[0], client_car=client_cars[0])
    assert all(isinstance(pc.get_controlled_pawn(), u.QuebecCharacter) for pc in (host, remote, local)), 'Peers must spawn walking'
    assert all(distance(character.get_actor_location(), u.Vector(*LAYOUT['spawn'])) < 500
               for character in (STATE['host_char'], STATE['server_char'], STATE['client_char'])), 'A player spawned outside Toronto authored starts'
    assert distance(STATE['server_car'].get_actor_location(), u.Vector(*LAYOUT['car'])) < 150, 'Starter moved away from its authored Toronto spawn'
    assert not STATE['server_car'].get_controller() and not STATE['server_car'].get_editor_property('Occupant'), 'Starter must begin unoccupied'
    REPORT['initial_spawns'] = {key: vec(STATE[key].get_actor_location()) for key in ('host_char', 'server_char', 'client_char', 'server_car', 'client_car')}
    REPORT.setdefault('spawns_by_session', {})[str(STATE['session'])] = REPORT['initial_spawns']
    STATE['host_style'] = STATE['host_char'].get_editor_property('CrewStyle')
    STATE['original_style'] = STATE['server_char'].get_editor_property('CrewStyle')
    return isolation()


def park_host():
    angle = math.radians(LAYOUT['car_yaw'])
    forward = u.Vector(math.cos(angle), math.sin(angle), 0.)
    point = clear_walker(u.Vector(*LAYOUT['spawn']), forward, [forward*offset for offset in (1600, -1600, 2400, -2400)], STATE['host_char'], .1)
    STATE['host_fixture'] = point
    relocate(STATE['host_char'], point)


def comic_weights(client_weight, host_weight=0):
    for pc, expected in ((STATE['client_pc'], client_weight), (STATE['host_pc'], host_weight)):
        camera = pc.get_controlled_pawn().get_component_by_class(u.CameraComponent)
        entries = camera.get_editor_property('post_process_settings').get_editor_property('weighted_blendables').get_editor_property('array')
        comic = [entry for entry in entries if entry.get_editor_property('object') and
                 entry.get_editor_property('object').get_path_name() == '/Game/Art/Comic/M_ComicInk.M_ComicInk']
        if len(comic) != 1 or abs(comic[0].get_editor_property('weight')-expected) > .01:
            return False
    assert all(STATE[side+'_char'].get_component_by_class(u.SkeletalMeshComponent).get_component_tick_interval() == 0 for side in ('server', 'client'))
    return True


def crew_selected():
    original, host = STATE['original_style'], STATE['host_style']
    expected = next(3+(original-3+offset)%8 for offset in range(1, 8) if 3+(original-3+offset)%8 != host)
    if any(STATE[side+'_char'].get_editor_property('CrewStyle') != expected for side in ('server', 'client')):
        return False
    assert STATE['host_char'].get_editor_property('CrewStyle') == host, 'Client C changed the host crew'
    for side in ('server', 'client'):
        mesh = STATE[side+'_char'].get_component_by_class(u.SkeletalMeshComponent).get_editor_property('skinned_asset')
        assert mesh and f'/Crew/Resident{expected}/SK_Body' in mesh.get_path_name(), 'Selected own body not applied'
    REPORT['selection'] = {'before': original, 'after': expected, 'host_unchanged': host}
    return isolation()


def place_walker(label):
    anchor, index = ANCHORS[label]
    forward, right, yaw = direction(index)
    base = u.Vector(*LAYOUT['spawn']) if label == 'Corner' else u.Vector(*anchor, 0.)
    width = ROAD_WIDTHS[index]
    offsets = [u.Vector()] if label == 'Corner' else [right*(width/2+110), right*(-width/2-110), right*(width/2-110), right*(-width/2+110)]
    point = clear_walker(base, forward, offsets, STATE['server_char'])
    STATE.update(walk_fixture=point, walk_yaw=yaw, walk_label=label)
    relocate(STATE['server_char'], point, yaw)
    STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-12, yaw=yaw))
    trace('mapped_walk_fixture', location=label, source_anchor_cm=list(anchor), standing_cm=vec(point), capsule_sweep_clear_cm=900)


def walker_arrived():
    return all(distance(STATE[side+'_char'].get_actor_location(), STATE['walk_fixture']) < 120 for side in ('server', 'client'))


def walk():
    STATE['foot_axis'] = 1.
    STATE['foot_start'] = STATE['server_char'].get_actor_location()
    STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-12, yaw=STATE['walk_yaw']))
    STATE['client_char'].disable_input(STATE['client_pc'])


def walked():
    if elapsed() < 1.1:
        return False
    release_controls()
    displacements = [distance(STATE[side+'_char'].get_actor_location(), STATE['foot_start']) for side in ('server', 'client')]
    assert min(displacements) > 200, ('Native forward walking failed', STATE['walk_label'], displacements)
    assert distance(STATE['server_char'].get_actor_location(), STATE['client_char'].get_actor_location()) < 150, 'Walking did not replicate'
    assert all(not STATE[side+'_char'].get_component_by_class(u.CharacterMovementComponent).is_swimming() for side in ('server', 'client')), 'Toronto street became a Montréal pond'
    REPORT.setdefault('native_walks', {})[STATE['walk_label']] = {'start_cm': vec(STATE['foot_start']), 'displacements_cm': displacements,
        'scope': '1.1-second native client walking window after the recorded authority relocation'}
    return isolation()


def corridor_clearance():
    ignored = [STATE['server_car'], STATE['server_char'], STATE['host_char']]
    checks = []
    for index, (a, b) in enumerate(zip(ROUTE, ROUTE[1:])):
        forward, right, yaw = direction(index)
        first = ground(u.Vector(*a, 0.)+right*145, 102, ignored)
        last = ground(u.Vector(*b, 0.)+right*145, 102, ignored)
        middle = ground(u.Vector((a[0]+b[0])/2, (a[1]+b[1])/2, 0.)+right*145, 102, ignored)
        assert all(point is not None for point in (first, middle, last)), ('Mapped College lane lacks ground', index)
        hit = u.SystemLibrary.box_trace_single_by_profile(STATE['server'], first, last, u.Vector(235, 110, 80),
            u.Rotator(yaw=yaw), 'Pawn', False, ignored, u.DrawDebugTrace.NONE, True)
        if hit:
            result = GAMEPLAY.call_method('BreakHitResult', (hit,))
            trace('blocked_corridor_probe', segment=index, actor=result[9].get_path_name() if result[9] else None,
                  impact_cm=vec(result[5]), distance_cm=result[3])
        assert not hit, ('Mapped College vehicle corridor blocked', index, a, b, str(hit))
        checks.append({'from_cm': vec(first), 'to_cm': vec(last), 'ground_midpoint_cm': vec(middle), 'box_sweep_clear': True})
    REPORT['mapped_corridor'].update(probes=checks, hull_half_extent_cm=[235, 110, 80], lane_offset_cm=145)
    return True


def approach_car():
    car, character = STATE['server_car'], STATE['server_char']
    point = clear_walker(car.get_actor_location(), car.get_actor_forward_vector(),
        [car.get_actor_right_vector()*210, car.get_actor_right_vector()*-210,
         car.get_actor_forward_vector()*-350], character, .1)
    assert distance(point, car.get_actor_location()) < 450, 'Approach fixture must be inside the native entry radius'
    STATE['walk_fixture'] = point
    relocate(character, point)


def arrange_legacy_probe():
    # An actual Toronto road near the old objective makes E rejection observable without state writes.
    target = u.Vector(*MONTREAL['missions'][0])
    candidates = []
    for road in LAYOUT['roads']:
        for a, b in zip(road, road[1:]):
            dx, dy = b[0]-a[0], b[1]-a[1]
            length_sq = dx*dx+dy*dy
            if not length_sq:
                continue
            along = max(0., min(1., ((target.x-a[0])*dx+(target.y-a[1])*dy)/length_sq))
            point = u.Vector(a[0]+along*dx, a[1]+along*dy, 0.)
            candidates.append((distance(point, u.Vector(target.x, target.y, 0.)), vec(point)))
    for _, values in sorted(candidates)[:12]:
        point = ground(u.Vector(*values), 100, [STATE['server_char'], STATE['server_car']])
        if not point or distance(point, target) >= 450:
            continue
        if u.SystemLibrary.capsule_trace_single_by_profile(STATE['server'], point, point+u.Vector(0., 0., .1),
                42, 96, 'Pawn', False, [STATE['server_char']], u.DrawDebugTrace.NONE, True):
            continue
        STATE.update(walk_fixture=point, legacy_target=target)
        relocate(STATE['server_char'], point)
        trace('legacy_negative_fixture', toronto_road_point_cm=vec(point), montreal_objective_cm=vec(target),
              distance_cm=distance(point, target), scope='Native E must not advance a Montréal objective even inside its radius')
        return
    raise AssertionError('No clear Toronto survey road falls inside the old objective radius for the negative probe')


def legacy_rejected():
    assert all(distance(STATE[side+'_char'].get_actor_location(), STATE['legacy_target']) < 500 for side in ('server', 'client')), 'Legacy negative fixture left the objective radius'
    assert all(STATE[side+'_pc'].get_controlled_pawn() == STATE[side+'_char'] for side in ('server', 'client')), 'Legacy E unexpectedly entered a car'
    return isolation()


def entered():
    for side in ('server', 'client'):
        car, character = STATE[side+'_car'], STATE[side+'_char']
        if STATE[side+'_pc'].get_controlled_pawn() != car or car.get_editor_property('Occupant') != character or not character.get_editor_property('bInVehicle'):
            return False
        assert character.get_editor_property('bHidden') and not character.get_actor_enable_collision(), 'Occupied walker visibility/collision wrong'
    return isolation()


def brake_stopped():
    return all(STATE[side+'_car'].get_editor_property('bHandbrake') and abs(STATE[side+'_car'].get_editor_property('Speed')) < 1 for side in ('server', 'client'))


def driving_fixture():
    forward, right, yaw = direction(0)
    base = u.Vector(*ROUTE[0], 0.)+forward*600+right*145
    ignored = [STATE['server_car'], STATE['server_char'], STATE['host_char']]
    point = ground(base, 102, ignored)
    assert point, 'Mapped driving fixture needs ground'
    assert not u.SystemLibrary.box_trace_single_by_profile(STATE['server'], point, point+forward*6000,
        u.Vector(235, 110, 80), u.Rotator(yaw=yaw), 'Pawn', False, ignored, u.DrawDebugTrace.NONE, True), 'Driving fixture is obstructed'
    STATE['drive_fixture'] = point
    relocate(STATE['server_car'], point, yaw)
    STATE['client_pc'].set_control_rotation(u.Rotator(pitch=-12, yaw=yaw))
    trace('mapped_drive_setup', source='First westbound College Street survey edge', ground_cm=vec(point), forward_sweep_clear_cm=6000,
          scope='Occupied, natively stopped car relocated/oriented; subsequent motion uses owning-client callbacks, not a naturally driven approach')


def drive():
    STATE['drive_start'] = STATE['server_car'].get_actor_location()
    STATE['drive_axis'] = 1.
    STATE['client_car'].disable_input(STATE['client_pc'])
    native(STATE['client_car'], 'ReleaseHandbrake')


def driven():
    if elapsed() < 2:
        return False
    travelled = distance(STATE['server_car'].get_actor_location(), STATE['drive_start'])
    assert travelled > 500 and STATE['server_car'].get_editor_property('Speed') > 300, 'Native client throttle did not move authority car'
    error = distance(STATE['server_car'].get_actor_location(), STATE['client_car'].get_actor_location())
    assert error < 150, ('Car movement replication error', error)
    REPORT['native_drive'] = {'start_cm': vec(STATE['drive_start']), 'end_cm': vec(STATE['server_car'].get_actor_location()),
                              'distance_cm': travelled, 'replication_error_cm': error, 'window_game_seconds': elapsed()}
    STATE['drive_axis'] = -1.
    STATE['brake_speed_before'] = STATE['server_car'].get_editor_property('Speed')
    return True


def foot_braked():
    speed = STATE['server_car'].get_editor_property('Speed')
    if speed > 100:
        return False
    assert speed > -250, ('Foot brake overshot into reverse before observation', speed)
    release_controls()
    REPORT['foot_brake'] = {'before_cm_per_s': STATE['brake_speed_before'], 'after_cm_per_s': speed}
    return True


def hold_throttle():
    STATE['hold_position'] = STATE['server_car'].get_actor_location()
    STATE['drive_axis'] = 1.
    STATE['client_car'].disable_input(STATE['client_pc'])


def held():
    if elapsed() < .8:
        return False
    assert brake_stopped(), 'Handbrake did not hold both peers stationary'
    drift = distance(STATE['server_car'].get_actor_location(), STATE['hold_position'])
    assert drift < 5, ('Handbrake drifted against throttle', drift)
    REPORT['handbrake_hold_drift_cm'] = drift
    return True


def released():
    if any(STATE[side+'_car'].get_editor_property('bHandbrake') for side in ('server', 'client')):
        return False
    if distance(STATE['server_car'].get_actor_location(), STATE['hold_position']) < 50:
        return False
    release_controls()
    return True


def fall_car():
    car = STATE['server_car']
    location = car.get_actor_location()
    relocate(car, u.Vector(location.x, location.y, -1700))


def car_recovered():
    target = u.Vector(*LAYOUT['car'])
    if any(distance(STATE[side+'_car'].get_actor_location(), target) > 120 for side in ('server', 'client')):
        return False
    assert all(abs(STATE[side+'_car'].get_editor_property('Speed')) < 1 for side in ('server', 'client'))
    assert distance(STATE['server_car'].get_actor_location(), u.Vector(*MONTREAL['car'])) > 1000, 'Car recovered to Montréal'
    REPORT['car_recovery'] = {side: vec(STATE[side+'_car'].get_actor_location()) for side in ('server', 'client')}
    return entered()


def exited():
    for side in ('server', 'client'):
        character = STATE[side+'_char']
        if STATE[side+'_pc'].get_controlled_pawn() != character or STATE[side+'_car'].get_editor_property('Occupant') or character.get_editor_property('bInVehicle'):
            return False
        assert not character.get_editor_property('bHidden') and character.get_actor_enable_collision(), 'Exit did not restore walking visibility/collision'
    return isolation()


def fall_walker():
    spawn = LAYOUT['spawn']
    relocate(STATE['server_char'], u.Vector(spawn[0], spawn[1], -1700))


def walker_recovered():
    target = u.Vector(*LAYOUT['spawn'])
    if any(distance(STATE[side+'_char'].get_actor_location(), target) > 150 for side in ('server', 'client')):
        return False
    assert distance(STATE['server_char'].get_actor_location(), u.Vector(*MONTREAL['spawn'])) > 1000, 'Walker recovered to Montréal'
    assert all(not STATE[side+'_char'].get_component_by_class(u.CharacterMovementComponent).is_swimming() for side in ('server', 'client'))
    REPORT['walker_recovery'] = {side: vec(STATE[side+'_char'].get_actor_location()) for side in ('server', 'client')}
    return exited()


def boundary_candidates(layout):
    bounds=layout['bounds_cm'];candidates=[]
    for index,(road,name,width) in enumerate(zip(layout['roads'],layout['road_names'],layout['road_widths'])):
        if width<900: continue
        for point in (road[0],road[-1]):
            for side,axis,limit,normal in [('west',0,bounds[0],[-1.,0.,0.]),('east',0,bounds[2],[1.,0.,0.]),
                                           ('south',1,bounds[1],[0.,-1.,0.]),('north',1,bounds[3],[0.,1.,0.])]:
                if abs(point[axis]-limit)<.01:
                    candidates.append({'side':side,'point':point,'normal':normal,'road_index':index,'street':name})
    assert candidates, 'No broad surveyed road endpoint reaches a Toronto boundary'
    return sorted(candidates,key=lambda row:math.dist(row['point'],layout['spawn'][:2]))


def boundary_fixture():
    release_controls()
    world=STATE['server'];character=STATE['host_char']
    walls=[actor for actor in u.GameplayStatics.get_all_actors_of_class(world,u.StaticMeshActor) if actor.get_actor_label()=='District edge']
    assert len(walls)==4
    for source in boundary_candidates(LAYOUT):
        normal=u.Vector(*source['normal']);right=u.Vector(-normal.y,normal.x,0.)
        axis='x' if normal.x else 'y';outer=source['point'][0 if normal.x else 1]
        wall=[actor for actor in walls if abs(getattr(actor.get_actor_location(),axis)-outer)<.1]
        assert len(wall)==1
        origin,extent=wall[0].get_actor_bounds(False,False)
        assert abs(origin.z-extent.z)<.1 and abs(origin.z+extent.z-300.)<.1, 'Test the actual authored 300cm Toronto wall'
        assert abs(getattr(extent,axis)-35.)<.1 and wall[0].get_actor_enable_collision()
        for offset in (0.,145.,-145.):
            point=ground(u.Vector(*source['point'],0.)-normal*650+right*offset,100,[character,STATE['server_car']])
            if not point: continue
            if u.SystemLibrary.capsule_trace_single_by_profile(world,point,point+normal*500,42,96,'Pawn',False,[character],u.DrawDebugTrace.NONE,True): continue
            yaw=math.degrees(math.atan2(normal.y,normal.x))
            relocate(character,point,yaw);STATE['host_pc'].set_control_rotation(u.Rotator(pitch=-12,yaw=yaw))
            STATE.update(boundary_wall=wall[0],boundary_normal=normal,boundary_inner=origin-normal*35,boundary_fixture=point)
            REPORT['boundary_fixture']={'street':source['street'],'source_road_index':source['road_index'],'source_endpoint_cm':source['point'],
                'side':source['side'],'normal':vec(normal),'wall':wall[0].get_path_name(),'wall_height_cm':2*extent.z,'start_cm':vec(point),
                'lateral_offset_cm':offset,'clear_native_runup_cm':500,
                'scope':'Authority host relocated to a grounded surveyed boundary approach. Native run/jump follow with real collision; remote player stays at the original district spawn.'}
            return
    raise AssertionError('No clear source-derived Toronto boundary approach')


def boundary_arrived():
    character=STATE['host_char']
    return distance(character.get_actor_location(),STATE['boundary_fixture'])<40 and not character.get_component_by_class(u.CharacterMovementComponent).is_falling()


def boundary_run():
    STATE['host_char'].disable_input(STATE['host_pc']);STATE['boundary_axis']=1.


def boundary_run_ready():
    character=STATE['host_char'];point=character.get_actor_location();normal=STATE['boundary_normal']
    remaining=(STATE['boundary_inner']-point).dot(normal)+35
    if remaining>350: return False
    velocity=character.get_velocity();speed=math.hypot(velocity.x,velocity.y)
    assert 300<=remaining<=350 and speed>=400, ('Native running-jump launch window missed',remaining,speed)
    return True


def boundary_jump():
    character=STATE['host_char'];movement=character.get_component_by_class(u.CharacterMovementComponent)
    assert abs(movement.get_editor_property('jump_z_velocity')-600.)<.01 and character.get_editor_property('JumpMaxHoldTime')==0.
    assert STATE.get('boundary_axis')==1. and math.hypot(character.get_velocity().x,character.get_velocity().y)>=400
    STATE['boundary_launch']=character.get_actor_location()
    STATE['boundary_sample']={'max_outward_from_inner_cm':-1e9,'max_z_cm':STATE['boundary_launch'].z,'airborne':False,'airborne_wall_contact':False}
    native(character,'Jump')


def boundary_contained():
    if elapsed()<2.5: return False
    release_controls();sample=STATE['boundary_sample']
    REPORT['native_boundary_jump']={'launch_cm':vec(STATE['boundary_launch']),'end_cm':vec(STATE['host_char'].get_actor_location()),
        **sample,'capsule_radius_cm':42,'window_game_seconds':elapsed(),'jump_z_velocity':600,'jump_max_hold_time':0.}
    assert sample['max_outward_from_inner_cm']<=-42+5, ('Native running jump crossed/climbed the Toronto boundary',sample)
    assert sample['airborne'] and sample['max_z_cm']>STATE['boundary_launch'].z+50 and sample['airborne_wall_contact'], 'Jump must reach the actual Toronto wall while airborne'
    return isolation()


def release_controls():
    STATE.pop('foot_axis', None)
    STATE.pop('drive_axis', None)
    STATE.pop('boundary_axis', None)
    errors = []
    for actor_key, pc_key in (('client_char', 'client_pc'), ('client_car', 'client_pc'),
                              ('server_char', 'server_pc'), ('server_car', 'server_pc'), ('host_char', 'host_pc')):
        actor, pc = STATE.get(actor_key), STATE.get(pc_key)
        if not actor or not pc:
            continue
        try:
            for method in ('MoveForward', 'MoveRight'):
                actor.call_method(method, (0.,))
            if isinstance(actor, u.QuebecCharacter):
                actor.stop_jumping()
            else:
                actor.call_method('ReleaseHandbrake')
            if actor.get_controller() == pc:
                actor.enable_input(pc)
        except Exception as error:
            errors.append(actor_key+': '+str(error))
    assert not errors, 'Control release failures after attempting every retained actor: '+str(errors)


step('two Toronto peers spawn at authored sidewalk starts with only the manual starter', begin, discover, timeout=30)
step('both peers start in standard view with full-rate animation', lambda: None, lambda: comic_weights(0))
step('move host to a surveyed clear fixture before recovery tests', park_host, lambda: distance(STATE['host_char'].get_actor_location(), STATE['host_fixture']) < 30)
step('client C selection replicates while retaining host appearance', lambda: native(STATE['client_pc'], 'NextCharacter'), crew_selected)
step('client F2 is private from the host', lambda: native(STATE['client_pc'], 'ToggleComicStyle'), lambda: comic_weights(1))
step('client returns to standard independently', lambda: native(STATE['client_pc'], 'ToggleComicStyle'), lambda: comic_weights(0))
step('College to Euclid to Grace has measured ground and vehicle corridor clearance', lambda: None, corridor_clearance)
for label in ANCHORS:
    step('arrange clear mapped walking fixture at '+label, lambda label=label: place_walker(label), walker_arrived)
    step('native client walking replicates at '+label, walk, walked)
step('arrange a Toronto survey road inside the old Montréal objective radius', arrange_legacy_probe, walker_arrived)
step('native E rejects Montréal progression inside its exact radius', lambda: native(STATE['client_pc'], 'Interact'), legacy_rejected)
step('arrange starter-car approach in native entry radius', approach_car, walker_arrived)
step('client enters actual Toronto starter with replicated occupancy', lambda: native(STATE['client_pc'], 'Interact'), entered)
step('car camera retains private standard view', lambda: None, lambda: comic_weights(0))
step('native client handbrake stops before mapped lane setup', lambda: native(STATE['client_car'], 'ApplyHandbrake'), brake_stopped)
step('explicitly arrange a grounded westbound College driving fixture', driving_fixture,
     lambda: all(distance(STATE[side+'_car'].get_actor_location(), STATE['drive_fixture']) < 120 for side in ('server', 'client')))
step('native client throttle drives and replicates the authority car', drive, driven)
step('native foot brake slows the authority car', lambda: None, foot_braked, delay=.1)
step('native handbrake stops both peers', lambda: native(STATE['client_car'], 'ApplyHandbrake'), brake_stopped)
step('handbrake holds against native throttle', hold_throttle, held)
step('native handbrake release restores acceleration', lambda: native(STATE['client_car'], 'ReleaseHandbrake'), released)
step('release throttle and natively stop before fall fixture', lambda: native(STATE['client_car'], 'ApplyHandbrake'), brake_stopped)
step('occupied car falls and recovers to Toronto on both peers', fall_car, car_recovered)
step('native exit restores walking on both peers', lambda: native(STATE['client_pc'], 'Interact'), exited)
step('fallen walker recovers to Toronto on both peers', fall_walker, walker_recovered)
step('arrange a clear surveyed Toronto boundary approach for the authority host', boundary_fixture, boundary_arrived)
step('native host run-up reaches the strict running-jump launch window', boundary_run, boundary_run_ready)
step('actual 300cm Toronto wall contains native running JumpZ600 with airborne contact', boundary_jump, boundary_contained)
step('final Toronto population and Montréal progression isolation', release_controls, isolation)


def finish(error=None):
    if STATE.get('finishing'):
        return
    STATE['finishing'] = True
    STATE['finish_error'] = error
    STATE['cleanup_started'] = time.monotonic()
    if error:
        REPORT.update(error=error, failed_step=STEPS[max(0, STATE['step'])][0])
        u.log_error('NORD_DISTRICT_RUNTIME_FAILED '+error)
    try:
        release_controls()
        REPORT['native_controls_released_before_endplay'] = True
    except Exception:
        STATE['finish_error'] = (STATE.get('finish_error') or '')+'\nInput cleanup failure:\n'+traceback.format_exc()
    finally:
        LEVELS.editor_request_end_play()


def cleanup():
    if u.EditorLevelLibrary.get_pie_worlds(True):
        assert time.monotonic()-STATE['cleanup_started'] < 15, 'PIE teardown timed out'
        return
    REPORT['pie_worlds_stopped'] = True
    current = save_inventory()
    REPORT.update(save_inventory_after=current, all_save_hashes_unchanged=current == SAVES_BEFORE)
    assert current == SAVES_BEFORE, 'A save file changed during Toronto free roam; preserve evidence and investigate'
    restore_play_settings()
    write_report()


def restore_play_settings():
    for key, value in ORIGINAL.items():
        SETTINGS.set_editor_property(key, value)
    SYSTEM.call_method('SetBytePropertyByName', (SETTINGS, 'PlayNetMode', ORIGINAL_MODE))
    REPORT['play_settings_restored'] = all(SETTINGS.get_editor_property(key) == value for key, value in ORIGINAL.items())
    REPORT['restored_play_net_mode'] = ORIGINAL_MODE
    assert REPORT['play_settings_restored'], 'PIE settings did not restore'


def write_report():
    try:
        STATE['finished'] = True
        REPORT.update(passed=not STATE.get('finish_error'), elapsed_seconds=round(time.monotonic()-STATE['started'], 2))
        if STATE.get('finish_error'):
            REPORT['error'] = STATE['finish_error']
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        assert not REPORT_PATH.exists(), 'Never overwrite an earlier report'
        REPORT_PATH.write_text(json.dumps(REPORT, indent=2)+'\n')
        u.log(('NORD_DISTRICT_RUNTIME_OK ' if REPORT['passed'] else 'NORD_DISTRICT_RUNTIME_FAILED ')+str(REPORT_PATH))
    finally:
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
        assert time.monotonic()-STATE['started'] < 240, 'District suite total timeout'
        if STATE['step'] < 0:
            if time.monotonic()-STATE['started'] < 1:
                return
            STATE['step'] = 0
            start_step()
        name, action, ready, timeout, delay = STEPS[STATE['step']]
        assert time.monotonic()-STATE['step_started'] < timeout, 'Step timeout: '+name
        if STATE.get('foot_axis') is not None:
            STATE['client_char'].call_method('MoveForward', (STATE['foot_axis'],))
        if STATE.get('drive_axis') is not None:
            STATE['client_car'].call_method('MoveForward', (STATE['drive_axis'],))
        if STATE.get('boundary_axis') is not None:
            character=STATE['host_char'];character.call_method('MoveForward',(STATE['boundary_axis'],))
            if STATE.get('boundary_sample'):
                point=character.get_actor_location();sample=STATE['boundary_sample'];normal=STATE['boundary_normal']
                sample['max_outward_from_inner_cm']=max(sample['max_outward_from_inner_cm'],(point-STATE['boundary_inner']).dot(normal))
                sample['max_z_cm']=max(sample['max_z_cm'],point.z)
                airborne=character.get_component_by_class(u.CharacterMovementComponent).is_falling();sample['airborne']|=airborne
                if airborne and (point-STATE['boundary_inner']).dot(normal)>=-42-20 and point.z>STATE['boundary_launch'].z+50:
                    hit=u.SystemLibrary.capsule_trace_single_by_profile(STATE['server'],point,point+normal*40,42,96,'Pawn',False,[character],u.DrawDebugTrace.NONE,True)
                    if hit and GAMEPLAY.call_method('BreakHitResult',(hit,))[9]==STATE['boundary_wall']:
                        sample['airborne_wall_contact']=True;sample.setdefault('first_airborne_wall_contact_cm',vec(point))
        if elapsed() < delay or not ready():
            return
        REPORT['checks'].append(name)
        u.log('NORD_DISTRICT_RUNTIME_CHECK '+name)
        STATE['step'] += 1
        if STATE['step'] == len(STEPS):
            finish()
        else:
            start_step()
    except Exception:
        error = traceback.format_exc()
        if STATE.get('finishing'):
            STATE['finish_error'] = (STATE.get('finish_error') or '')+'\nCleanup failure:\n'+error
            try:
                restore_play_settings()
            finally:
                write_report()
        else:
            finish(error)
    finally:
        STATE['ticking'] = False


SCRIPTING.call_method('SetKeepPythonScriptAlive', (True,))
STATE['callback'] = u.register_slate_post_tick_callback(tick)
u.log('NORD_DISTRICT_RUNTIME_START '+str(REPORT_PATH))
