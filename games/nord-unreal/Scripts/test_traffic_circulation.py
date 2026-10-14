"""Ten-minute fixed-step city circulation check; no traffic or route relocations.

Run with -NordCampaignQA -UseFixedTimeStep -FPS=30 and a fresh -saveddirsuffix.
Output: the isolated Saved directory's Tests/TrafficCirculation.json.
"""
import json,time,traceback,configparser
from pathlib import Path
import unreal as u
assert '-NordCampaignQA' in u.SystemLibrary.get_command_line(), 'Use an isolated campaign QA slot'
ROOT=Path(u.Paths.project_dir()).resolve(); OUT=Path(u.Paths.project_saved_dir())/'Tests/TrafficCirculation.json'; OUT.parent.mkdir(parents=True,exist_ok=True)
levels=u.get_editor_subsystem(u.LevelEditorSubsystem); settings=u.get_default_object(u.load_class(None,'/Script/UnrealEd.LevelEditorPlaySettings'))
system=u.get_default_object(u.load_class(None,'/Script/Engine.KismetSystemLibrary')); scripting=u.get_default_object(u.load_class(None,'/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
game=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics')); carclass=u.load_class(None,'/Script/Quebec.QuebecCar')
original={k:settings.get_editor_property(k) for k in ['PlayNumberOfClients','RunUnderOneProcess']}
config=configparser.ConfigParser(strict=False);config.read(Path(u.Paths.project_saved_dir())/'Config/LinuxEditor/EditorPerProjectUserSettings.ini');originalmode={'PIE_Standalone':0,'PIE_ListenServer':1,'PIE_Client':2}[config.get('/Script/UnrealEd.LevelEditorPlaySettings','PlayNetMode',fallback='PIE_Standalone')]
report={'passed':False,'mode':'standalone NullRHI PIE, fixed 1/30 simulation step, no traffic relocation','samples':[]}
state={'stage':0,'started':time.monotonic(),'last':0,'previous':{}}
def finish(error=None):
    if state['stage']==3:return
    if error:report['error']=error
    report['passed']=not error;levels.editor_request_end_play();state['stage']=3
def tick(dt):
    try:
        assert time.monotonic()-state['started']<600,'Probe watchdog'
        if state['stage']==0:
            system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',0));settings.set_editor_property('PlayNumberOfClients',1);settings.set_editor_property('RunUnderOneProcess',True)
            levels.editor_request_begin_play();state['stage']=1
        elif state['stage']==1:
            worlds=u.EditorLevelLibrary.get_pie_worlds(True)
            if not worlds:return
            world=worlds[0];pawn=u.GameplayStatics.get_player_pawn(world,0)
            if not pawn:return
            cars=[c for c in u.GameplayStatics.get_all_actors_of_class(world,carclass) if c.get_editor_property('bTraffic')]
            assert len(cars)==16,len(cars)
            state.update(stage=2,world=world,cars=cars,spawn=pawn.get_actor_location(),start_world=u.GameplayStatics.get_time_seconds(world))
        elif state['stage']==2:
            now=u.GameplayStatics.get_time_seconds(state['world'])-state['start_world']
            if now-state['last']<10:return
            rows=[]
            for car in state['cars']:
                pos=car.get_actor_location(); key=car.get_name(); previous=state['previous'].get(key,pos)
                row={'actor':key,'position':[pos.x,pos.y,pos.z],'speed':car.get_editor_property('Speed'),'handbrake':car.get_editor_property('bHandbrake'),'travel_10s':(pos-previous).length(),'distance_spawn':(pos-state['spawn']).length(),'local':car.actor_has_tag('CityLocalTraffic')}
                if row['travel_10s']<100 and now>30:
                    hit=u.SystemLibrary.box_trace_single_by_profile(state['world'],pos,pos+car.get_actor_forward_vector()*650,u.Vector(235,110,80),car.get_actor_rotation(),'Pawn',False,[car],u.DrawDebugTrace.NONE,True)
                    if hit:
                        data=game.call_method('BreakHitResult',(hit,));row['blocker']=data[9].get_name() if data[9] else None;row['blocker_label']=data[9].get_actor_label() if data[9] else None
                rows.append(row);state['previous'][key]=pos
            report['samples'].append({'seconds':now,'moving':sum(r['travel_10s']>500 for r in rows),'near_spawn_150m':sum(r['distance_spawn']<15000 for r in rows),'local_count':sum(r['local'] for r in rows),'local_moving':sum(r['local'] and r['travel_10s']>500 for r in rows),'cars':rows});state['last']=now
            if int(now)%60<10:u.log('NORD_TRAFFIC_PROBE '+str(round(now))+' moving='+str(report['samples'][-1]['moving']))
            if now>=600:
                assert report['samples'][-1]['local_count']==8, 'Eight local cars expected'
                assert all(r['distance_spawn']<25500 for row in report['samples'] for r in row['cars'] if r['local']), 'Local traffic left its neighbourhood'
                assert all(sum(row['cars'][i]['travel_10s'] for row in report['samples'][-12:])>1000 for i,c in enumerate(state['cars']) if c.actor_has_tag('CityLocalTraffic')), 'Local traffic stopped circulating'
                finish()
        elif state['stage']==3:
            if u.EditorLevelLibrary.get_pie_worlds(True):return
            for k,v in original.items():settings.set_editor_property(k,v)
            system.call_method('SetBytePropertyByName',(settings,'PlayNetMode',originalmode))
            report['wall_seconds']=time.monotonic()-state['started'];OUT.write_text(json.dumps(report,indent=2)+'\n')
            u.unregister_slate_post_tick_callback(state['callback']);scripting.call_method('SetKeepPythonScriptAlive',(False,))
    except Exception:finish(traceback.format_exc())
scripting.call_method('SetKeepPythonScriptAlive',(True,));state['callback']=u.register_slate_post_tick_callback(tick)
