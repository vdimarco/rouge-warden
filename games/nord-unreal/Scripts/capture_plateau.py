"""Capture the saved route at walking height with Unreal's actual renderer."""
import json
import math
from pathlib import Path
import struct
import time
import traceback
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
data = json.loads((ROOT/'Data/Plateau/layout.json').read_text())
python_runner = u.get_default_object(u.load_class(None,'/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
python_runner.call_method('SetKeepPythonScriptAlive',(True,))
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
for command in ('Slate.bAllowNotifications 0','t.MaxFPS 20','r.VSync 0'):
    u.SystemLibrary.execute_console_command(world,command)
hero = next(f for f in data['facades']['fronts'] if f['commercial'] and 'Sherbrooke' in f['street'])
mid = [(hero['a'][i]+hero['b'][i])/2 for i in range(2)]
n = hero['normal']; tangent = [-n[1],n[0]]
shots = [{'name':'PlateauCorner','position':[mid[i]+n[i]*1700-tangent[i]*950 for i in range(2)]+[180],
          'target':mid+[370]}]
shots += data['streets']['cameras']
shots.append({'name':'PlateauParkEntrance','position':[37000,-3000,180],'target':[38600,-4500,350]})
shots.append({'name':'PlateauResidents','position':[35720,1490,165],'target':[35880,850,100]})
shots.append({'name':'LaFontaineSouthPond','position':[16924,-13124,165],'target':[12000,-15000,70]})
shots.append({'name':'LaFontaineNorthPond','position':[-20159,10671,165],'target':[-12000,9000,70]})
boards = json.loads((ROOT/'Data/Plateau/Cartography/cartography.json').read_text())['boards']
board = boards[0]
shots.append({'name':'LaFontaineOrientation','position':[board['position_cm'][i]+board['facing_normal_xy'][i]*250 for i in range(2)]+[160],
              'target':board['position_cm']+[145]})
landmark = json.loads((ROOT/'Data/Plateau/LandmarkGeometry/landmarks.json').read_text())['signs'][0]
shots.append({'name':'TheatreVerdure','position':[landmark['position'][i]+landmark['normal'][i]*2200 for i in range(2)]+[175],
              'target':landmark['position'][:2]+[440]})
shots.append({'name':'TheatreVerdureTimber','position':[-13285.693,6297.372,175],
              'target':[-9756,5098,440]})
shots.append({'name':'PlateauExteriorStairs','position':[38799.35,-7369.40,175],
              'target':[39628.93,-7781.96,390]})
for closure in json.loads((ROOT/'Data/Plateau/EdgesGeometry/edges.json').read_text())['closures']:
    center, outward = closure['closure_center_xy'], closure['outward_direction']
    shots.append({'name':'PlateauClosurePanet' if 'Panet' in closure['street'] else 'PlateauClosureVisitation',
                  'position':[center[i]-outward[i]*1000 for i in range(2)]+[170], 'target':center+[100]})
camera = editor.spawn_actor_from_class(u.CameraActor,u.Vector())
camera.get_component_by_class(u.CameraComponent).set_editor_property('field_of_view',76.)
state = {'index':0,'started':time.monotonic(),'moved':0.,'task':None,'files':[],'capturing':False,'finished':False}


def validate_screenshot(path, previous_mtime):
    assert path.stat().st_mtime_ns > previous_mtime, 'Screenshot was not updated: '+str(path)
    with path.open('rb') as stream:
        header = stream.read(24)
    assert header[:8] == b'\x89PNG\r\n\x1a\n' and header[12:16] == b'IHDR', 'Invalid screenshot PNG'
    assert struct.unpack('>II',header[16:24]) == (1280,720), 'Unexpected screenshot dimensions'


def finish(error=None):
    if state['finished']: return
    state['finished'] = True
    if error: u.log_error('PLATEAU_CAPTURE_FAILED '+error)
    else: u.log('PLATEAU_CAPTURE_OK '+json.dumps(state['files']))
    u.unregister_slate_post_tick_callback(state.pop('callback'))
    state['task'] = None
    editor.destroy_actor(camera)
    # The command-line runner releases its async notification before deferring editor shutdown.
    python_runner.call_method('SetKeepPythonScriptAlive',(False,))


def tick(delta):
    # Screenshot loading pumps Slate; prevent this callback from entering itself.
    if state['capturing'] or state['finished']: return
    try:
        now = time.monotonic()
        assert now-state['started'] < 150, 'Screenshot timeout'
        if state['task']:
            if not state['task'].is_task_done(): return
            validate_screenshot(state['path'],state['previous_mtime'])
            state['files'].append(str(state['path']))
            state['task'] = None; state['index'] += 1; state['moved'] = 0
        if state['index'] == len(shots): finish(); return
        shot = shots[state['index']]
        if not state['moved']:
            position = u.Vector(*shot['position']); target = u.Vector(*shot['target'])
            camera.set_actor_location(position,False,False)
            camera.set_actor_rotation(u.MathLibrary.find_look_at_rotation(position,target),False)
            u.get_editor_subsystem(u.UnrealEditorSubsystem).set_level_viewport_camera_info(position,camera.get_actor_rotation())
            state['moved'] = now
            return
        if now-state['moved'] < 7: return
        state['path'] = ROOT/'Preview'/(shot['name']+'.png')
        state['previous_mtime'] = state['path'].stat().st_mtime_ns if state['path'].exists() else 0
        u.log('PLATEAU_CAPTURE_SHOT '+shot['name'])
        state['capturing'] = True
        state['task'] = u.AutomationLibrary.take_high_res_screenshot(1280,720,str(state['path']),camera=camera,delay=.5)
        state['capturing'] = False
        assert state['task'].is_valid_task()
    except Exception: finish(traceback.format_exc())


state['callback'] = u.register_slate_post_tick_callback(tick)
