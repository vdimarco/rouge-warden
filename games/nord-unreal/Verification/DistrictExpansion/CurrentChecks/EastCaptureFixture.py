"""Single-player immersive X11 stills; separate from two-peer behavioral verification.

Fresh editor: /Game/Maps/LaFontaine -vulkan -immersive -NordEastRenderChecks -NordNoCampaignSave
-NordCaptureWidth=1920 -NordCaptureDisplayWidth=2048 -NordCaptureDisplayHeight=1280.
Use one standalone startup player and -NordNoCampaignSave; no save loading/writing or persistence claim. No asset authoring.
"""
import configparser
from datetime import datetime, timezone
import hashlib
import heapq
import json
import math
import os
from pathlib import Path
import re
import shlex
import struct
import subprocess
import time
import traceback
import unreal as u


def closest(point,line):
    options=[]
    for a,b in zip(line,line[1:]):
        delta=[b[index]-a[index] for index in (0,1)]
        length2=sum(value*value for value in delta)
        fraction=max(0,min(1,sum((point[index]-a[index])*delta[index] for index in (0,1))/length2)) if length2 else 0
        q=[a[index]+fraction*delta[index] for index in (0,1)]
        options.append((math.dist(point,q),q))
    return min(options,key=lambda option:option[0])[1]


def fixture_points(layout,facade):
    graph={}
    for road,name,width in zip(layout['roads'],layout['road_names'],layout['road_widths']):
        if name=='College Street' and width>=900:
            for a,b in zip(road,road[1:]):
                a,b=tuple(a),tuple(b)
                graph.setdefault(a,[]).append((b,math.dist(a,b)))
                graph.setdefault(b,[]).append((a,math.dist(a,b)))
    junctions={}
    for name in ('Euclid Avenue','Grace Street'):
        shared={tuple(p) for road,street in zip(layout['roads'],layout['road_names']) if street==name for p in road}.intersection(graph)
        assert len(shared)==1,'Expected one surveyed College junction for '+name
        junctions[name]=next(iter(shared))
    start=tuple(layout['landmarks']['intersection']['position']);end=junctions['Grace Street']
    queue,cost,previous=[(0,start)],{start:0},{}
    while queue:
        distance,node=heapq.heappop(queue)
        if distance!=cost[node]: continue
        for following,length in graph[node]:
            if distance+length<cost.get(following,math.inf):
                cost[following]=distance+length;previous[following]=node;heapq.heappush(queue,(distance+length,following))
    route=[end]
    while route[-1]!=start: route.append(previous[route[-1]])
    route.reverse();euclid=route.index(junctions['Euclid Avenue'])
    remaining=sum(math.dist(a,b) for a,b in zip(route[:euclid],route[1:euclid+1]))/2
    for index,(a,b) in enumerate(zip(route,route[1:])):
        length=math.dist(a,b)
        if remaining<=length:
            middle=[a[axis]+(b[axis]-a[axis])*remaining/length for axis in (0,1)];middle_index=index;break
        remaining-=length
    anchors=[('Corner',list(layout['spawn'][:2]),0),('College',middle,middle_index),
             ('Euclid',list(route[euclid]),euclid),('Grace',list(end),len(route)-2)]
    sidewalks=[(index,line) for index,(line,kind) in enumerate(zip(layout['paths'],layout['path_kinds'])) if kind=='sidewalk']
    fixtures=[]
    for name,anchor,index in anchors:
        path,point=min(((path,closest(anchor,line)) for path,line in sidewalks),key=lambda value:math.dist(anchor,value[1]))
        if name=='Corner': point=anchor;target=layout['landmarks']['sneaky_dees']['entrance']
        else: target=[point[axis]+route[index+1][axis]-route[index][axis] for axis in (0,1)]
        fixtures.append({'name':name,'point_cm':point,'target_cm':target,'sidewalk_path':path,'pitch':-12})
    corner,bathurst=facade['edges'][1:3]
    assert [corner['name'],bathurst['name']]==['Corner','Bathurst']
    assert layout['path_kinds'][31]==layout['path_kinds'][45]=='sidewalk'
    assert layout['paths'][31][1]==[-1213.724,1104.294],'Reviewed northwest sidewalk anchor changed'
    target=[(bathurst['a'][axis]+bathurst['b'][axis])/2 for axis in (0,1)]
    fixtures.extend([{'name':'Northwest','point_cm':layout['paths'][31][1],
                      'target_cm':[(corner['a'][axis]+corner['b'][axis])/2 for axis in (0,1)],'sidewalk_path':31,'pitch':-5},
                     {'name':'Bathurst','point_cm':closest(target,layout['paths'][45]),'target_cm':target,'sidewalk_path':45,'pitch':-5}])
    for fixture in fixtures:
        fixture['yaw']=math.degrees(math.atan2(fixture['target_cm'][1]-fixture['point_cm'][1],fixture['target_cm'][0]-fixture['point_cm'][0]))
        assert all(math.isfinite(value) for key in ('point_cm','target_cm') for value in fixture[key])
    return fixtures


def owned_world(worlds,require_player=True):
    assert len(worlds)==1,'Single-player capture may own exactly one PIE world'
    world=worlds[0]
    assert re.search(r'(?:^|/)UEDPIE_\d+_LaFontaine[.]',world.get_path_name()),'Only the owned Montréal PIE clone is allowed'
    assert u.SystemLibrary.is_standalone(world) and u.GameplayStatics.get_current_level_name(world,True)=='LaFontaine'
    players=u.GameplayStatics.get_num_player_controllers(world);local=u.GameplayStatics.get_num_local_player_controllers(world)
    assert 0<=players==local<=1,'Unexpected or remote startup player'
    if require_player: assert players==local==1,'Owned player is not ready'
    return world


def startup_map_guard(editor_world,worlds):
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(),'Dirty editor maps are not allowed'
    if editor_world is not None:
        assert editor_world.get_path_name().startswith('/Game/Maps/LaFontaine.'),'Wrong editor map'
    if worlds: owned_world(worlds,require_player=False)
    # Immersive startup can expose only its PIE clone; defer until a map is identifiable.
    return editor_world is not None or bool(worlds)


def vec(value): return [value.x,value.y,value.z]


def png_info(data,width,height):
    if len(data)<10000 or not data.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'): return None
    assert data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(width,height),'Wrong native PNG dimensions'
    return {'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'png_dimensions':[width,height]}


def save_inventory():
    return {str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted((ROOT/'Saved/SaveGames').rglob('*.sav'))}


def viewport_rectangle(calibration):
    # Same native cached-geometry probes as capture_player_quality.py; no guessed chrome origin.
    previous=STATE['pc'].get_mouse_position();probes=[]
    try:
        for point in ([0,0],[WIDTH-1,0],[0,HEIGHT-1]):
            STATE['pc'].set_mouse_location(*point);desktop=u.WidgetLayoutLibrary.get_mouse_position_on_platform()
            probes.append({'viewport_pixels':point,'desktop_pixels':[desktop.x,desktop.y]})
        origin,horizontal,vertical=[probe['desktop_pixels'] for probe in probes]
        assert all(math.isfinite(v) and abs(v-round(v))<.01 for probe in probes for v in probe['desktop_pixels'])
        assert horizontal==[origin[0]+WIDTH-1,origin[1]] and vertical==[origin[0],origin[1]+HEIGHT-1]
        assert 0<=origin[0] and 0<=origin[1] and origin[0]+WIDTH<=DISPLAY[0] and origin[1]+HEIGHT<=DISPLAY[1]
        calibration['native_viewport_cursor_probes']=probes
        return [*origin,WIDTH,HEIGHT]
    finally:
        restore=[round(value) for value in previous] if previous is not None else [WIDTH//2,HEIGHT//2]
        STATE['pc'].set_mouse_location(*restore);calibration['cursor_restored_viewport_pixels']=restore


def calibrate_viewport():
    now,frame=time.monotonic(),u.SystemLibrary.get_frame_count();calibration=REPORT.get('viewport_calibration')
    if calibration is None:
        calibration=REPORT['viewport_calibration']={'passed':False,'display_pixels':DISPLAY,'target_viewport_pixels':[WIDTH,HEIGHT],
                                                   'method':'Editor.ResizeMainFrame then one measured chrome compensation','attempts':[]}
        requested=[WIDTH,HEIGHT]
    else:
        assert now-STATE['resize_started']<10,'Viewport calibration timed out'
        if now-STATE['resize_started']<1 or frame-STATE['resize_frame']<2: return False
        observed=list(STATE['pc'].get_viewport_size());calibration['attempts'][-1]['observed_viewport_pixels']=observed
        if observed!=[WIDTH,HEIGHT] and len(calibration['attempts'])==1:
            assert all(0<observed[axis]<=calibration['attempts'][0]['requested_root_pixels'][axis] for axis in (0,1))
            requested=[2*WIDTH-observed[0],2*HEIGHT-observed[1]]
        else:
            assert observed==[WIDTH,HEIGHT],'Wrong viewport after at most two root resizes'
            calibration.update(passed=True,desktop_rectangle=viewport_rectangle(calibration));REPORT['actual_viewport_pixels']=observed;return True
    assert WIDTH<=requested[0]<=DISPLAY[0] and HEIGHT<=requested[1]<=DISPLAY[1]
    calibration['attempts'].append({'requested_root_pixels':requested});STATE.update(resize_started=now,resize_frame=frame)
    u.SystemLibrary.execute_console_command(STATE['world'],f'Editor.ResizeMainFrame {requested[0]} {requested[1]}',STATE['pc'])
    return False


def isolation():
    assert owned_world(list(u.EditorLevelLibrary.get_pie_worlds(True))) is STATE['world']
    actors=lambda kind:list(u.GameplayStatics.get_all_actors_of_class(STATE['world'],CLASSES[kind]))
    campaigns,residents,cars=actors('Campaign'),actors('ParkResident'),actors('Car')
    assert len(campaigns)==1 and len(residents)==110 and sum(car.get_editor_property('bTraffic') for car in cars)==16,'Full Montréal campaign/population is required'
    campaign=campaigns[0]
    current={'campaign':campaign.get_path_name(),'phase':str(campaign.get_editor_property('Phase')),'completed':campaign.get_editor_property('CompletedMissions'),
             'mission_index':u.GameplayStatics.get_game_state(STATE['world']).get_editor_property('MissionIndex'),
             'residents':sorted(actor.get_path_name() for actor in residents),'cars':sorted(actor.get_path_name() for actor in cars)}
    assert all(car.get_actor_enable_collision() and car.is_actor_tick_enabled() for car in cars if car.get_editor_property('bTraffic')),'Ambient traffic was disabled'
    if 'population_before' not in STATE: STATE['population_before']=current;REPORT['population_before']=current
    assert current==STATE['population_before'],'Montréal progression or actor inventory changed'
    REPORT['population_last_checked']=current


def render_guard():
    assert list(STATE['pc'].get_viewport_size())==[WIDTH,HEIGHT]
    names=('ViewDistance','AntiAliasing','Shadow','GlobalIllumination','Reflection','PostProcess','Texture','Effects','Foliage','Shading','Landscape')
    values={'sg.'+name+'Quality':u.SystemLibrary.get_console_variable_int_value('sg.'+name+'Quality') for name in names}
    values['r.ScreenPercentage']=u.SystemLibrary.get_console_variable_float_value('r.ScreenPercentage')
    assert all(value==3 for key,value in values.items() if key.startswith('sg.')) and abs(values['r.ScreenPercentage']-100)<.01
    REPORT['renderer_settings']=values


def comic_weight():
    entries=STATE['pawn'].get_component_by_class(u.CameraComponent).get_editor_property('post_process_settings').get_editor_property('weighted_blendables').get_editor_property('array')
    weights=[entry.get_editor_property('weight') for entry in entries if entry.get_editor_property('object') and
             entry.get_editor_property('object').get_path_name()=='/Game/Art/Comic/M_ComicInk.M_ComicInk']
    assert len(weights)==1,'Native camera comic blendable missing'
    return weights[0]


def arrange():
    fixture=FIXTURES[STATE['shot']//2];x,y=fixture['point_cm']
    hit=u.SystemLibrary.line_trace_single(STATE['world'],u.Vector(x,y,10000),u.Vector(x,y,-500),
        u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[STATE['pawn']],u.DrawDebugTrace.NONE,True)
    assert hit,'No fixture ground'
    result=GAMEPLAY.call_method('BreakHitResult',(hit,));point=result[5]+u.Vector(0,0,100)
    assert result[0] and result[7].z>.7 and -200<result[5].z<50
    assert not u.SystemLibrary.capsule_trace_single_by_profile(STATE['world'],point,point,42,96,'Pawn',False,[STATE['pawn']],u.DrawDebugTrace.NONE,True)
    STATE['pawn'].set_actor_location_and_rotation(point,u.Rotator(yaw=fixture['yaw']),False,True)
    STATE['pc'].set_control_rotation(u.Rotator(pitch=fixture['pitch'],yaw=fixture['yaw']))
    STATE.update(phase='settle',phase_started=time.monotonic(),toggle_pending=False,mode_ready_time=None)


def finish(error=None):
    if STATE.get('finishing'): return
    STATE.update(finishing=True,error=error,cleanup_started=time.monotonic())
    worlds=list(u.EditorLevelLibrary.get_pie_worlds(True))
    if STATE.get('owns_pie'):
        assert not worlds or (len(worlds)==1 and worlds[0] is STATE['world']),'Refuse to end an unrelated PIE world'
        if worlds: LEVELS.editor_request_end_play()


def cleanup():
    if STATE.get('owns_pie') and u.EditorLevelLibrary.get_pie_worlds(True):
        assert time.monotonic()-STATE['cleanup_started']<15,'Owned PIE teardown timed out';return
    after=save_inventory();REPORT.update(save_inventory_after=after,all_save_hashes_unchanged=after==SAVES,owned_pie_stopped=True)
    assert after==SAVES,'Save files changed during Montréal capture'
    for key,value in ORIGINAL.items(): SETTINGS.set_editor_property(key,value)
    SYSTEM.call_method('SetBytePropertyByName',(SETTINGS,'PlayNetMode',ORIGINAL_MODE))
    REPORT.update(passed=not STATE.get('error') and len(REPORT['captures'])==6,error=STATE.get('error'),
                  play_settings_restored=all(SETTINGS.get_editor_property(key)==value for key,value in ORIGINAL.items()))
    assert REPORT['play_settings_restored']
    REPORT_PATH.write_text(json.dumps(REPORT,indent=2)+'\n');STATE['finished']=True
    u.unregister_slate_post_tick_callback(STATE['callback']);SCRIPT.call_method('SetKeepPythonScriptAlive',(False,))
    u.log(('NORD_EAST_CAPTURE_OK ' if REPORT['passed'] else 'NORD_EAST_CAPTURE_FAILED ')+str(REPORT_PATH))


def tick(_):
    if STATE.get('finished'): return
    try:
        assert time.monotonic()-STATE['started']<240,'Capture watchdog expired'
        if STATE.get('finishing'): cleanup();return
        current=STATE['phase'];worlds=list(u.EditorLevelLibrary.get_pie_worlds(True))
        if current=='boot':
            if not startup_map_guard(EDITOR.get_editor_world(),worlds): return
            if time.monotonic()-STATE['started']<2: return
            if not worlds:
                if not STATE.get('requested_pie'):
                    SETTINGS.set_editor_property('PlayNumberOfClients',1);SETTINGS.set_editor_property('RunUnderOneProcess',True)
                    SYSTEM.call_method('SetBytePropertyByName',(SETTINGS,'PlayNetMode',0));STATE['requested_pie']=True;LEVELS.editor_request_begin_play()
                return
            world=owned_world(worlds,require_player=False);pc=u.GameplayStatics.get_player_controller(world,0)
            if not pc or not pc.get_controlled_pawn(): return
            owned_world(worlds)
            pawn=pc.get_controlled_pawn();assert pawn.get_class()==CLASSES['Character']
            STATE.update(world=world,pc=pc,pawn=pawn,owns_pie=True,phase='calibrate');pawn.disable_input(pc);isolation();return
        isolation()
        if current=='calibrate':
            if calibrate_viewport(): STATE['shot']=0;arrange()
            return
        render_guard()
        if current=='settle':
            assert time.monotonic()-STATE['phase_started']<20,'Camera/F2 settle timed out'
            wanted=STATE['shot']%2;weight=comic_weight()
            if abs(weight-wanted)>.001:
                if not STATE['toggle_pending']:
                    u.SystemLibrary.set_timer_for_next_tick(STATE['pc'],'ToggleComicStyle');STATE['toggle_pending']=True
                return
            if STATE['mode_ready_time'] is None:
                STATE.update(mode_ready_time=time.monotonic(),mode_ready_frame=u.SystemLibrary.get_frame_count());return
            if time.monotonic()-STATE['mode_ready_time']<1.5 or u.SystemLibrary.get_frame_count()-STATE['mode_ready_frame']<2: return
            hud=STATE['pc'].get_hud();assert hud and hud.get_class().get_name()=='QuebecHUD'
            manager=u.GameplayStatics.get_player_camera_manager(STATE['world'],0);fixture=FIXTURES[STATE['shot']//2]
            assert math.dist(vec(STATE['pawn'].get_actor_location())[:2],fixture['point_cm'])<1,'Pawn left surveyed fixture'
            assert abs(manager.get_camera_rotation().pitch-fixture['pitch'])<.1
            assert abs((manager.get_camera_rotation().yaw-fixture['yaw']+180)%360-180)<.1
            label=fixture['name']+('Comic' if wanted else 'Standard');path=OUT/(label+'.png');assert not path.exists()
            STATE['capture']={'label':label,'path':str(path.relative_to(ROOT)),'fixture':fixture,'actual_viewport':[WIDTH,HEIGHT],
                'hud_class':hud.get_class().get_name(),'comic_weight':weight,'player_cm':vec(STATE['pawn'].get_actor_location()),
                'camera_cm':vec(manager.get_camera_location()),'camera_pitch':manager.get_camera_rotation().pitch,
                'camera_yaw':manager.get_camera_rotation().yaw,'horizontal_fov':manager.get_fov_angle(),
                'native_canvas_capture_requested':True,'hud_pixel_review_pending':True,'visual_review_pending':True}
            u.SystemLibrary.execute_console_command(STATE['world'],f'shot -nosuffix filename="{path}"',STATE['pc'])
            STATE.update(phase='shot',phase_started=time.monotonic());return
        assert current=='shot'
        assert time.monotonic()-STATE['phase_started']<25,'PNG timeout'
        path=ROOT/STATE['capture']['path']
        if not path.exists(): return
        data=path.read_bytes()
        image=png_info(data,WIDTH,HEIGHT)
        if image is None: return
        assert abs(comic_weight()-STATE['capture']['comic_weight'])<.001,'F2 changed during PNG capture'
        STATE['capture'].update(image)
        REPORT['captures'].append(STATE.pop('capture'));STATE['shot']+=1
        if STATE['shot']==6: finish()
        else: arrange()
    except Exception:
        if STATE.get('finishing'):
            STATE['error']=(STATE.get('error') or '')+'\n'+traceback.format_exc()
            for key,value in ORIGINAL.items(): SETTINGS.set_editor_property(key,value)
            SYSTEM.call_method('SetBytePropertyByName',(SETTINGS,'PlayNetMode',ORIGINAL_MODE))
            REPORT.update(passed=False,error=STATE['error'],owned_pie_stopped=not u.EditorLevelLibrary.get_pie_worlds(True),
                          play_settings_restored=all(SETTINGS.get_editor_property(key)==value for key,value in ORIGINAL.items()))
            REPORT_PATH.write_text(json.dumps(REPORT,indent=2)+'\n')
            STATE['finished']=True;u.unregister_slate_post_tick_callback(STATE['callback']);SCRIPT.call_method('SetKeepPythonScriptAlive',(False,))
        else: finish(traceback.format_exc())


ROOT=Path(u.Paths.project_dir()).resolve();
assert {'Data/LaFontaine/osm.xml': 'fe4410d45007a627bf6d9b9ddeeae329fa9cdd7492dfb5fa6beff851e7cf8f86', 'Data/LaFontaine/layout.json': '4238d6ed45d5fb890e0f8dbcb672de0803c6dc7079b0b6a86b386d82ebbb4250', 'Data/Plateau/ContextGeometry/context.json': '74764fd01528c320439692fdc6eefd3394770e547f425b886ceabbd73fc9392a', 'Data/Plateau/EdgesGeometry/edges.json': '9b2adcc383903d64014e5a09851cea786aea5af4307242f5a37dc83362323a35', 'Source/Quebec/LaFontaineMap.h': '80a96e858c315584598acd8d87dfb758ba45f64a58ccd4b6f5222ddb56ff1700', 'Data/Plateau/EastExtension/extension.json': 'c19300127f80c9ebd4483610544acab9162a05280ab5a2717376c88c6770dcbf', 'Scripts/capture_college_bathurst.py': '285bc8d2f9fa7af4eb97de325759ef43c9e2327b392d3cf859fa47d3f5db6fa8', 'Scripts/plateau_streets.py': '9e246e7c2d66e370be709117912df167be7edae5e6857adacc9d0641829c1179', 'Scripts/plateau_ground.py': '9ba1e57a062d94c6eb2c3ecef2ea191d63d5cf97ada05cccf9e9441a1ce7c445', 'Source/Quebec/QuebecCampaign.cpp': '920249a296d281dbf50b73e0a187449de6b72dc29822228ccff12df1cf327b38', 'Source/Quebec/QuebecGameplay.cpp': 'eb48922e852eb14e6992770ad50826de59389c6324dbe7693c2e7ea7f3bb4b87', 'Content/Maps/LaFontaine.umap': '1d10804760ffdef9c620bc2840014ec2e5dbc204931d9b9854699f511e5d0c40'}=={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['Data/LaFontaine/osm.xml', 'Data/LaFontaine/layout.json', 'Data/Plateau/ContextGeometry/context.json', 'Data/Plateau/EdgesGeometry/edges.json', 'Source/Quebec/LaFontaineMap.h', 'Data/Plateau/EastExtension/extension.json', 'Scripts/capture_college_bathurst.py', 'Scripts/plateau_streets.py', 'Scripts/plateau_ground.py', 'Source/Quebec/QuebecCampaign.cpp', 'Source/Quebec/QuebecGameplay.cpp', 'Content/Maps/LaFontaine.umap']}, 'Frozen east capture source/map drift'
ARGS=shlex.split(u.SystemLibrary.get_command_line());FLAGS={arg.lower() for arg in ARGS}
assert {'-immersive','-vulkan','-nordeastrenderchecks'}<=FLAGS and '-nullrhi' not in FLAGS
assert '-nordnocampaignsave' in FLAGS and not {'-nordnocampaign','-nordnoambient'}.intersection({arg.split('=',1)[0] for arg in FLAGS}), 'Require active Montréal with disk save loading/writing suppressed'
values=lambda name:[arg.split('=',1)[1] for arg in ARGS if arg.lower().startswith(name+'=')]
assert len(values('-nordcapturewidth'))==1
WIDTH=int(values('-nordcapturewidth')[0]);assert WIDTH==1920;HEIGHT=WIDTH*9//16
DISPLAY=[]
for key in ('-nordcapturedisplaywidth','-nordcapturedisplayheight'):
    assert len(values(key))==1;DISPLAY.append(int(values(key)[0]))
assert os.environ.get('DISPLAY','').startswith(':') and os.environ.get('SDL_VIDEODRIVER')=='x11' and 'WAYLAND_DISPLAY' not in os.environ
assert DISPLAY[0]>=WIDTH and DISPLAY[1]>=HEIGHT
observed=re.findall(r'^\s*dimensions:\s+(\d+)x(\d+)\s+pixels',subprocess.run(['xdpyinfo','-display',os.environ['DISPLAY']],capture_output=True,text=True,check=True,timeout=5).stdout,re.M)
assert len(observed)==1 and list(map(int,observed[0]))==DISPLAY,'Actual X11 display differs from harness'
FIXTURES=[{'name': 'Panet', 'point_cm': [71674.55083309732, -26098.562974604924], 'target_cm': [75373.30293126713, -28558.323949252477], 'source': 'way/490998043', 'node_ids': ['1497705451', '10815396967'], 'derivation': 'longest retained street segment midpoint', 'road_width_cm': 680, 'pitch': -12, 'yaw': -33.62488171113105, 'context_footprint_sample_clearance_cm': 8146.085232153709}, {'name': 'Visitation', 'point_cm': [60420.852460401, -29134.670399994902], 'target_cm': [63072.53175570845, -30900.20560002219], 'source': 'way/19938440', 'node_ids': ['11547437024', '2075285157'], 'derivation': 'longest retained street segment midpoint', 'road_width_cm': 680, 'pitch': -12, 'yaw': -33.65638180733419, 'context_footprint_sample_clearance_cm': 620.8597428037924}, {'name': 'FormerEdge', 'point_cm': [54888.20160134625, -14873.465199956201], 'target_cm': [58710.539102254894, -17399.19993901318], 'source': 'way/490998043', 'former_exit_cm': [55373.30293126712, -15194.011797595113], 'derivation': 'original Panet source node looking through former boundary', 'pitch': -12, 'yaw': -33.45604059137042, 'context_footprint_sample_clearance_cm': 882.9774136286053}];RUN=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
OUT=ROOT/'Saved/Tests/DistrictRuntime'/('MontrealEastRender'+str(WIDTH)+'-'+RUN);OUT.mkdir(parents=True,exist_ok=False);REPORT_PATH=OUT/'capture.json'
LEVELS=u.get_editor_subsystem(u.LevelEditorSubsystem);EDITOR=u.get_editor_subsystem(u.UnrealEditorSubsystem)
startup_map_guard(EDITOR.get_editor_world(),list(u.EditorLevelLibrary.get_pie_worlds(True)))
SETTINGS=u.get_default_object(u.load_class(None,'/Script/UnrealEd.LevelEditorPlaySettings'));SYSTEM=u.get_default_object(u.load_class(None,'/Script/Engine.KismetSystemLibrary'))
GAMEPLAY=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics'));SCRIPT=u.get_default_object(u.load_class(None,'/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
CLASSES={name:u.load_class(None,'/Script/Quebec.Quebec'+name) for name in ('Character','Campaign','Car','ParkResident')};assert all(CLASSES.values())
ORIGINAL={key:SETTINGS.get_editor_property(key) for key in ('PlayNumberOfClients','RunUnderOneProcess')}
config=configparser.ConfigParser(strict=False);config.read(ROOT/'Saved/Config/LinuxEditor/EditorPerProjectUserSettings.ini')
ORIGINAL_MODE={'PIE_Standalone':0,'PIE_ListenServer':1,'PIE_Client':2}[config.get('/Script/UnrealEd.LevelEditorPlaySettings','PlayNetMode',fallback='PIE_Standalone')]
SAVES=save_inventory();REPORT={'passed':False,'rendered':True,'run':RUN,'resolution':[WIDTH,HEIGHT],'display_pixels':DISPLAY,'fixtures':FIXTURES,'captures':[],
    'save_inventory_before':SAVES,'mode':'one standalone immersive PIE player; native HUD/F2, source-derived authority camera fixtures',
    'limits':['visual review pending','no multiplayer rendering acceptance','no naturally navigated corridor or physical input test','no motion/FPS/audio/package acceptance','NoCampaignSave suppresses disk loading and writing; no persistence acceptance','source road-center fixtures, not a naturally navigated sidewalk trip','CPU footprint samples do not prove native camera clearance'],
    'source_sha256':{str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest() for path in
        (Path(__file__).resolve(),ROOT/'Data/LaFontaine/osm.xml',ROOT/'Data/LaFontaine/layout.json',ROOT/'Data/Plateau/ContextGeometry/context.json',ROOT/'Data/Plateau/EdgesGeometry/edges.json',ROOT/'Source/Quebec/LaFontaineMap.h',ROOT/'Data/Plateau/EastExtension/extension.json',ROOT/'Scripts/capture_college_bathurst.py',ROOT/'Scripts/plateau_streets.py',ROOT/'Scripts/plateau_ground.py',ROOT/'Source/Quebec/QuebecCampaign.cpp',ROOT/'Source/Quebec/QuebecGameplay.cpp',ROOT/'Content/Maps/LaFontaine.umap')}}
STATE={'phase':'boot','started':time.monotonic(),'finished':False}
SCRIPT.call_method('SetKeepPythonScriptAlive',(True,));STATE['callback']=u.register_slate_post_tick_callback(tick)
u.log('NORD_EAST_CAPTURE_START '+str(REPORT_PATH))
