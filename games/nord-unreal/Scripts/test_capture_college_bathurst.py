"""CPU checks for survey fixtures, strict two-resize/native-pixel calibration and ownership."""
import ast
import copy
import json
from pathlib import Path
from types import SimpleNamespace as NS

from shapely.geometry import Point,Polygon,LineString
from shapely.ops import unary_union

SOURCE=Path(__file__).with_name('capture_college_bathurst.py')
TREE=ast.parse(SOURCE.read_text())
nodes=[node for node in TREE.body if isinstance(node,ast.FunctionDef) or
       isinstance(node,(ast.Import,ast.ImportFrom)) and not (isinstance(node,ast.Import) and any(alias.name=='unreal' for alias in node.names))]
scope={}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(SOURCE),'exec'),scope)
root=SOURCE.parents[1]
layout=json.loads((root/'Data/CollegeBathurst/layout.json').read_text())
facade=json.loads((root/'Data/CollegeBathurst/SneakyDees/facade.json').read_text())
original=copy.deepcopy(layout)
fixtures=scope['fixture_points'](layout,facade)
assert layout==original
assert [fixture['name'] for fixture in fixtures]==['Corner','College','Euclid','Grace','Northwest','Bathurst']
buildings=unary_union([Polygon(building['footprint']) for building in layout['buildings']])
for fixture in fixtures:
    assert Point(fixture['point_cm']).distance(LineString(layout['paths'][fixture['sidewalk_path']]))<.01
    assert Point(fixture['point_cm']).distance(buildings)>42,'Source fixture overlaps a building: '+fixture['name']
    assert -25<=fixture['pitch']<=-5
assert fixtures[0]['point_cm']==layout['spawn'][:2]
assert fixtures[4]['point_cm']==layout['paths'][31][1]
assert abs(fixtures[4]['yaw']+40.2683390189)<1e-6 and abs(fixtures[5]['yaw']-16.3108358409)<1e-6
assert fixtures[1]['point_cm'][0]>fixtures[2]['point_cm'][0]>fixtures[3]['point_cm'][0]
bad=copy.deepcopy(layout);bad['path_kinds'][31]='crossing'
try: scope['fixture_points'](bad,facade)
except AssertionError: pass
else: raise AssertionError('Changed reviewed sidewalk anchor accepted')


def calibration_fixture(width=1280):
    sample={'now':0,'frame':1,'viewport':[width-68,width*9//16-120],'mouse':[40,50],
            'origin':[34,86],'scale':1,'requests':[]}
    pc=NS(get_viewport_size=lambda:sample['viewport'],get_mouse_position=lambda:sample['mouse'],
          set_mouse_location=lambda x,y:sample.update(mouse=[x,y]))
    fake=NS(SystemLibrary=NS(get_frame_count=lambda:sample['frame'],
                            execute_console_command=lambda world,command,controller:sample['requests'].append(command)),
            WidgetLayoutLibrary=NS(get_mouse_position_on_platform=lambda:NS(
                x=sample['origin'][0]+sample['mouse'][0]*sample['scale'],
                y=sample['origin'][1]+sample['mouse'][1]*sample['scale'])))
    scope.update(WIDTH=width,HEIGHT=width*9//16,DISPLAY=[2048,1280],REPORT={},STATE={'pc':pc,'world':object()},
                 u=fake,time=NS(monotonic=lambda:sample['now']))
    return sample


def advance(sample): sample.update(now=sample['now']+1.1,frame=sample['frame']+2)


for width in (1280,1920):
    sample=calibration_fixture(width)
    assert not scope['calibrate_viewport']();assert len(sample['requests'])==1
    advance(sample);assert not scope['calibrate_viewport']();assert len(sample['requests'])==2
    assert sample['requests'][-1]==f'Editor.ResizeMainFrame {width+68} {width*9//16+120}'
    sample['viewport']=[width,width*9//16];advance(sample)
    assert scope['calibrate_viewport']() and scope['REPORT']['viewport_calibration']['passed']
    assert scope['REPORT']['viewport_calibration']['desktop_rectangle']==[34,86,width,width*9//16]
    assert sample['mouse']==[40,50] and len(sample['requests'])==2
sample=calibration_fixture();sample['viewport']=[1280,720]
scope['calibrate_viewport']();advance(sample)
assert scope['calibrate_viewport']() and len(sample['requests'])==1

rejections=0
for defect in ('zero_viewport','oversized_viewport','wrong_after_second','display_too_small','scaled_geometry','fractional_origin','outside_display','timeout'):
    sample=calibration_fixture();scope['calibrate_viewport']();advance(sample)
    if defect=='zero_viewport': sample['viewport']=[0,0]
    elif defect=='oversized_viewport': sample['viewport']=[1300,720]
    elif defect=='display_too_small': scope['DISPLAY']=[1280,720]
    elif defect=='timeout': sample['now']=11
    try:
        result=scope['calibrate_viewport']()
        if defect not in ('zero_viewport','oversized_viewport','display_too_small','timeout'):
            if defect!='wrong_after_second': sample['viewport']=[1280,720]
            if defect=='scaled_geometry': sample['scale']=2
            elif defect=='fractional_origin': sample['origin']=[34.5,86]
            elif defect=='outside_display': sample['origin']=[900,900]
            advance(sample);scope['calibrate_viewport']()
    except AssertionError:
        rejections+=1
    else: raise AssertionError('Unsafe viewport calibration accepted: '+defect)
    assert len(sample['requests'])<=2
    assert sample['mouse']==[40,50],'Cursor was not restored after failed probes'


world=NS(get_path_name=lambda:'/Game/Maps/UEDPIE_0_CollegeBathurst.CollegeBathurst')
for defect in ('valid','multiple','networked','wrong_map','remote_player','not_pie'):
    sample={'standalone':True,'map':'CollegeBathurst','players':1,'local':1}
    worlds=[world]
    world.get_path_name=lambda:'/Game/Maps/UEDPIE_0_CollegeBathurst.CollegeBathurst'
    if defect=='multiple': worlds*=2
    elif defect=='networked': sample['standalone']=False
    elif defect=='wrong_map': sample['map']='LaFontaine'
    elif defect=='remote_player': sample['players']=2
    elif defect=='not_pie': world.get_path_name=lambda:'/Game/Maps/CollegeBathurst.CollegeBathurst'
    scope['u']=NS(SystemLibrary=NS(is_standalone=lambda world:sample['standalone']),GameplayStatics=NS(
        get_current_level_name=lambda world,remove_prefix:sample['map'],get_num_player_controllers=lambda world:sample['players'],
        get_num_local_player_controllers=lambda world:sample['local']))
    try: accepted=scope['owned_world'](worlds)
    except AssertionError:
        assert defect!='valid';rejections+=1
    else: assert defect=='valid' and accepted is world

# Immersive startup has no editor world; exact PIE map identity must still be proven.
world.get_path_name=lambda:'/Game/Maps/UEDPIE_0_CollegeBathurst.CollegeBathurst'
sample={'map':'CollegeBathurst','players':0,'local':0,'dirty':[]}
scope['u']=NS(SystemLibrary=NS(is_standalone=lambda world:True),GameplayStatics=NS(
    get_current_level_name=lambda world,remove_prefix:sample['map'],get_num_player_controllers=lambda world:sample['players'],
    get_num_local_player_controllers=lambda world:sample['local']),
    EditorLoadingAndSavingUtils=NS(get_dirty_map_packages=lambda:sample['dirty']))
assert scope['startup_map_guard'](None,[world]) and scope['owned_world']([world],require_player=False) is world
assert not scope['startup_map_guard'](None,[]),'Unidentified map must wait, not proceed'
for defect in ('wrong_pie_name','wrong_level','wrong_editor','dirty_map','remote_startup'):
    sample.update(map='CollegeBathurst',players=0,local=0,dirty=[])
    world.get_path_name=lambda:'/Game/Maps/UEDPIE_0_CollegeBathurst.CollegeBathurst'
    editor=None
    if defect=='wrong_pie_name': world.get_path_name=lambda:'/Game/Maps/UEDPIE_0_LaFontaine.LaFontaine'
    elif defect=='wrong_level': sample['map']='LaFontaine'
    elif defect=='wrong_editor': editor=NS(get_path_name=lambda:'/Game/Maps/LaFontaine.LaFontaine')
    elif defect=='dirty_map': sample['dirty']=['/Game/Maps/CollegeBathurst']
    elif defect=='remote_startup': sample.update(players=1,local=0)
    try: scope['startup_map_guard'](editor,[world])
    except AssertionError: rejections+=1
    else: raise AssertionError('Unsafe immersive startup accepted: '+defect)

for defect in ('valid','wrong_width','truncated','wrong_signature'):
    width=1920 if defect=='wrong_width' else 1280
    data=b'\x89PNG\r\n\x1a\n'+b'\0'*8+scope['struct'].pack('>II',width,720)+b'\0'*10000+b'\x00\x00\x00\x00IEND\xaeB\x60\x82'
    if defect=='truncated': data=data[:-12]
    elif defect=='wrong_signature': data=b'badbytes'+data[8:]
    try: result=scope['png_info'](data,1280,720)
    except AssertionError: assert defect in ('wrong_width','wrong_signature');rejections+=1
    else: assert (result is None)==(defect=='truncated')

called=[]
scope.update(STATE={'owns_pie':True,'world':world},u=NS(EditorLevelLibrary=NS(get_pie_worlds=lambda include:[world,object()])),
             LEVELS=NS(editor_request_end_play=lambda:called.append(True)),time=NS(monotonic=lambda:0))
try: scope['finish']('test')
except AssertionError: pass
else: raise AssertionError('Attempted teardown with an unrelated PIE world')
assert called==[]
forbidden={'save_current_level','save_loaded_asset','import_asset_tasks','save_game_to_slot','load_game_from_slot','set_global_time_dilation','set_game_paused'}
assert not {node.func.attr for node in ast.walk(TREE) if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute)}.intersection(forbidden)
print(f'College capture CPU checks passed: six surveyed fixtures, 720/1080 measured calibration, {rejections} viewport/ownership/PNG rejections; '
      'no third resize or unrelated PIE teardown. Native GPU/HUD/pixels remain unverified.')
