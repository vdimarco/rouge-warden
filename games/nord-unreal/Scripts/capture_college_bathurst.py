"""Single-player immersive X11 stills; separate from two-peer behavioral verification.

Fresh editor: /Game/Maps/CollegeBathurst -vulkan -immersive -NordDistrictRenderChecks
-NordCaptureWidth=1280|1920 -NordCaptureDisplayWidth=2048 -NordCaptureDisplayHeight=1280.
Use one standalone startup player. No campaign/save suppression flags or asset authoring.
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
    assert re.search(r'(?:^|/)UEDPIE_\d+_CollegeBathurst[.]',world.get_path_name()),'Only the owned Toronto PIE clone is allowed'
    assert u.SystemLibrary.is_standalone(world) and u.GameplayStatics.get_current_level_name(world,True)=='CollegeBathurst'
    players=u.GameplayStatics.get_num_player_controllers(world);local=u.GameplayStatics.get_num_local_player_controllers(world)
    assert 0<=players==local<=1,'Unexpected or remote startup player'
    if require_player: assert players==local==1,'Owned player is not ready'
    return world


def startup_map_guard(editor_world,worlds):
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(),'Dirty editor maps are not allowed'
    if editor_world is not None:
        assert editor_world.get_path_name().startswith('/Game/Maps/CollegeBathurst.'),'Wrong editor map'
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
    assert not u.GameplayStatics.get_all_actors_of_class(STATE['world'],CLASSES['Campaign']),'Toronto started a campaign'
    assert not u.GameplayStatics.get_all_actors_of_class(STATE['world'],CLASSES['ParkResident'])
    cars=u.GameplayStatics.get_all_actors_of_class(STATE['world'],CLASSES['Car'])
    assert len(cars)==1 and not cars[0].get_editor_property('bTraffic')
    assert u.GameplayStatics.get_game_state(STATE['world']).get_editor_property('MissionIndex')==0


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
    assert after==SAVES,'Save files changed during Toronto capture'
    for key,value in ORIGINAL.items(): SETTINGS.set_editor_property(key,value)
    SYSTEM.call_method('SetBytePropertyByName',(SETTINGS,'PlayNetMode',ORIGINAL_MODE))
    REPORT.update(passed=not STATE.get('error') and len(REPORT['captures'])==12,error=STATE.get('error'),
                  play_settings_restored=all(SETTINGS.get_editor_property(key)==value for key,value in ORIGINAL.items()))
    assert REPORT['play_settings_restored']
    REPORT_PATH.write_text(json.dumps(REPORT,indent=2)+'\n');STATE['finished']=True
    u.unregister_slate_post_tick_callback(STATE['callback']);SCRIPT.call_method('SetKeepPythonScriptAlive',(False,))
    u.log(('NORD_COLLEGE_CAPTURE_OK ' if REPORT['passed'] else 'NORD_COLLEGE_CAPTURE_FAILED ')+str(REPORT_PATH))


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
        if STATE['shot']==12: finish()
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


ROOT=Path(u.Paths.project_dir()).resolve();ARGS=shlex.split(u.SystemLibrary.get_command_line());FLAGS={arg.lower() for arg in ARGS}
assert {'-immersive','-vulkan','-norddistrictrenderchecks'}<=FLAGS and '-nullrhi' not in FLAGS
assert not {'-nordnocampaign','-nordnocampaignsave'}.intersection({arg.split('=',1)[0] for arg in FLAGS})
values=lambda name:[arg.split('=',1)[1] for arg in ARGS if arg.lower().startswith(name+'=')]
assert len(values('-nordcapturewidth'))==1
WIDTH=int(values('-nordcapturewidth')[0]);assert WIDTH in (1280,1920);HEIGHT=WIDTH*9//16
DISPLAY=[]
for key in ('-nordcapturedisplaywidth','-nordcapturedisplayheight'):
    assert len(values(key))==1;DISPLAY.append(int(values(key)[0]))
assert os.environ.get('DISPLAY','').startswith(':') and os.environ.get('SDL_VIDEODRIVER')=='x11' and 'WAYLAND_DISPLAY' not in os.environ
assert DISPLAY[0]>=WIDTH and DISPLAY[1]>=HEIGHT
observed=re.findall(r'^\s*dimensions:\s+(\d+)x(\d+)\s+pixels',subprocess.run(['xdpyinfo','-display',os.environ['DISPLAY']],capture_output=True,text=True,check=True,timeout=5).stdout,re.M)
assert len(observed)==1 and list(map(int,observed[0]))==DISPLAY,'Actual X11 display differs from harness'
LAYOUT=json.loads((ROOT/'Data/CollegeBathurst/layout.json').read_text());FACADE=json.loads((ROOT/'Data/CollegeBathurst/SneakyDees/facade.json').read_text())
FIXTURES=fixture_points(LAYOUT,FACADE);RUN=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
OUT=ROOT/'Saved/Tests/DistrictRuntime'/('SingleRender'+str(WIDTH)+'-'+RUN);OUT.mkdir(parents=True,exist_ok=False);REPORT_PATH=OUT/'capture.json'
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
    'limits':['visual review pending','no multiplayer rendering acceptance','no naturally navigated corridor or physical input test','no motion/FPS/audio/package acceptance'],
    'source_sha256':{str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest() for path in
        (Path(__file__).resolve(),ROOT/'Data/CollegeBathurst/layout.json',ROOT/'Data/CollegeBathurst/SneakyDees/facade.json',ROOT/'Content/Maps/CollegeBathurst.umap')}}
STATE={'phase':'boot','started':time.monotonic(),'finished':False}
SCRIPT.call_method('SetKeepPythonScriptAlive',(True,));STATE['callback']=u.register_slate_post_tick_callback(tick)
u.log('NORD_COLLEGE_CAPTURE_START '+str(REPORT_PATH))
