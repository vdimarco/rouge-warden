"""Two-peer native swimming regression. Use -NordCampaignQA and a fresh -saveddirsuffix.

Shore setup positions are fixtures; native client movement/stroke callbacks drive the route.
No map assets are edited. Output: the isolated Saved directory's Tests/swimming-probe.json.
"""
import json,time,math,traceback,configparser
from pathlib import Path
import unreal as u
assert '-NordCampaignQA' in u.SystemLibrary.get_command_line(), 'Use an isolated campaign QA slot'
ROOT=Path(u.Paths.project_dir()).resolve(); RUN=Path(u.Paths.project_saved_dir())/'Tests'; RUN.mkdir(parents=True,exist_ok=True); cases=json.loads((ROOT/'Data/LaFontaine/swimming-test-cases.json').read_text())
levels=u.get_editor_subsystem(u.LevelEditorSubsystem); settings=u.get_default_object(u.load_class(None,'/Script/UnrealEd.LevelEditorPlaySettings'))
system=u.get_default_object(u.load_class(None,'/Script/Engine.KismetSystemLibrary')); scripting=u.get_default_object(u.load_class(None,'/Script/PythonScriptPlugin.EditorPythonScriptingLibrary')); game=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics'))
pcclass=u.load_class(None,'/Script/Quebec.QuebecController'); original={k:settings.get_editor_property(k) for k in ['PlayNumberOfClients','RunUnderOneProcess']}
config=configparser.ConfigParser(strict=False);config.read(Path(u.Paths.project_saved_dir())/'Config/LinuxEditor/EditorPerProjectUserSettings.ini');originalmode={'PIE_Standalone':0,'PIE_ListenServer':1,'PIE_Client':2}[config.get('/Script/UnrealEd.LevelEditorPlaySettings','PlayNetMode',fallback='PIE_Standalone')]
report={'passed':False,'checks':[],'samples':[],'mode':'two-player PIE; authority-only setup relocations and native remote movement/stroke callbacks'};state={'stage':'begin','started':time.monotonic()}
def mode(p):return str(p.get_component_by_class(u.CharacterMovementComponent).get_editor_property('movement_mode'))
def swimming(p):return 'SWIMMING' in mode(p).upper()
def xy(p):q=p.get_actor_location();return [q.x,q.y,q.z]
def floor(world,point):
    x,y=point; hit=u.SystemLibrary.line_trace_single(world,u.Vector(x,y,400),u.Vector(x,y,-400),u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[],u.DrawDebugTrace.NONE,True)
    return game.call_method('BreakHitResult',(hit,))[5].z if hit else 0.
def ready(stage):state.update(stage=stage,stage_started=time.monotonic());u.log('NORD_SWIM_STAGE '+stage)
def teleport(point,z=None):
    world=state['server'];pos=u.Vector(point[0],point[1],floor(world,point)+98 if z is None else z)
    state['avatar'].set_actor_location(pos,False,True);state['avatar'].force_net_update();state['teleport']=pos
    state['client_avatar'].consume_movement_input_vector();state['client_avatar'].get_component_by_class(u.CharacterMovementComponent).stop_movement_immediately()
def finish(error=None):
    if state['stage']=='cleanup':return
    if error:report['error']=error
    report['passed']=not error;levels.editor_request_end_play();ready('cleanup')
def tick(dt):
    try:
        assert time.monotonic()-state['started']<150,'Swimming watchdog '+state['stage']
        stage=state['stage'];elapsed=time.monotonic()-state.get('stage_started',time.monotonic())
        if stage=='begin':
            system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',1));settings.set_editor_property('PlayNumberOfClients',2);settings.set_editor_property('RunUnderOneProcess',True);levels.editor_request_begin_play();ready('discover')
        elif stage=='discover':
            worlds=u.EditorLevelLibrary.get_pie_worlds(True);server=next((w for w in worlds if u.GameplayStatics.get_game_mode(w)),None);client=next((w for w in worlds if not u.GameplayStatics.get_game_mode(w)),None)
            if not server or not client:return
            remote=next((pc for pc in u.GameplayStatics.get_all_actors_of_class(server,pcclass) if not pc.is_local_controller()),None);local=next((pc for pc in u.GameplayStatics.get_all_actors_of_class(client,pcclass) if pc.is_local_controller()),None)
            if not remote or not local or not remote.get_controlled_pawn() or not local.get_controlled_pawn():return
            state.update(server=server,client=client,remote=remote,local=local,avatar=remote.get_controlled_pawn(),client_avatar=local.get_controlled_pawn())
            for case in cases['entries']:
                z=floor(server,case['bank'])+98
                hit=u.SystemLibrary.capsule_trace_single_by_profile(server,u.Vector(*case['bank'],z),u.Vector(*case['water'],z),42,88,'Pawn',True,[state['avatar']],u.DrawDebugTrace.NONE,True)
                if hit:
                    row=game.call_method('BreakHitResult',(hit,)); actor=row[9]
                    if actor and 'Concrete' not in actor.get_actor_label():continue
                state['case']=case;break
            assert 'case' in state,'No safe shore fixture'
            report['shore_fixture']=state['case'];teleport(state['case']['bank']);ready('bank')
        elif stage=='bank':
            if (state['client_avatar'].get_actor_location()-state['teleport']).length()>150:return
            assert not swimming(state['avatar']) and not swimming(state['client_avatar'])
            state['local'].set_control_rotation(u.Rotator(yaw=state['case']['yaw']));report['checks'].append('dry bank walking');ready('enter')
        elif stage in ('enter','travel','leave'):
            pawn=state['client_avatar'];pawn.call_method('MoveForward',(1.,));a=state['avatar'];target=state['case'][{'enter':'water','travel':'target','leave':'bank'}[stage]]
            pos=a.get_actor_location();gap=math.hypot(pos.x-target[0],pos.y-target[1]);report['samples'].append({'stage':stage,'server':xy(a),'client':xy(pawn),'server_mode':mode(a),'client_mode':mode(pawn)})
            if elapsed>20:raise AssertionError('No swim-route progress '+stage+' '+str(report['samples'][-1]))
            if stage=='enter' and gap<100 and swimming(a) and swimming(pawn):
                report['checks'].append('remote native movement enters swimming on both peers');ready('settle')
            elif stage=='travel' and gap<100:
                assert swimming(a) and 20<a.get_actor_location().z<90
                assert abs(a.get_component_by_class(u.SkeletalMeshComponent).get_editor_property('relative_rotation').roll)>60
                report['checks'].append('remote swimming travels ten metres at the waterline');state['stroke_z']=a.get_actor_location().z;u.SystemLibrary.set_timer_for_next_tick(pawn,'Jump');ready('stroke')
            elif stage=='leave' and gap<100:
                assert not swimming(a) and not swimming(pawn) and pos.z>90
                assert abs(a.get_component_by_class(u.SkeletalMeshComponent).get_editor_property('relative_rotation').roll)<1
                report['checks'].append('native swimming exits to walking and restores pose/collision');teleport(cases['island']);ready('island')
        elif stage=='settle' and elapsed>.8:
            assert swimming(state['avatar']) and 20<state['avatar'].get_actor_location().z<90
            assert state['avatar'].get_component_by_class(u.SkeletalMeshComponent).get_editor_property('relative_location').z < -130
            report['checks'].append('buoyancy and idle treading pose');ready('travel')
        elif stage=='stroke':
            report.setdefault('stroke_samples',[]).append({'server':xy(state['avatar']),'client':xy(state['client_avatar'])})
            if state['avatar'].get_actor_location().z>state['stroke_z']+5:state['stroke_advanced']=True
            if elapsed>.6:
                assert state.get('stroke_advanced'),'Remote stroke did not reach authority'
                report['checks'].append('remote native stroke rises on authority');state['local'].set_control_rotation(u.Rotator(yaw=state['case']['yaw']+180));ready('leave')
        elif stage=='island' and elapsed>1:
            assert not swimming(state['avatar']) and not swimming(state['client_avatar']);report['checks'].append('mapped island stays dry');state['bridge']=0;teleport(cases['bridges'][0]);ready('bridge')
        elif stage=='bridge' and elapsed>1:
            assert not swimming(state['avatar']) and not swimming(state['client_avatar']);report['checks'].append('mapped bridge '+str(state['bridge'])+' stays dry');state['bridge']+=1
            if state['bridge']<len(cases['bridges']):teleport(cases['bridges'][state['bridge']]);ready('bridge')
            else:teleport(cases['deep'],500);ready('air')
        elif stage=='air':
            if .1<elapsed<.25:assert not swimming(state['avatar']),'Air above water became swimming'
            if elapsed>2:
                assert swimming(state['avatar']) and swimming(state['client_avatar']);report['checks'].append('air stays falling until water entry');finish()
        elif stage=='cleanup':
            if u.EditorLevelLibrary.get_pie_worlds(True):return
            for k,v in original.items():settings.set_editor_property(k,v)
            system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',originalmode));report['wall_seconds']=time.monotonic()-state['started'];(RUN/'swimming-probe.json').write_text(json.dumps(report,indent=2)+'\n')
            u.unregister_slate_post_tick_callback(state['callback']);scripting.call_method('SetKeepPythonScriptAlive',(False,))
    except Exception:finish(traceback.format_exc())
scripting.call_method('SetKeepPythonScriptAlive',(True,));state['callback']=u.register_slate_post_tick_callback(tick)
