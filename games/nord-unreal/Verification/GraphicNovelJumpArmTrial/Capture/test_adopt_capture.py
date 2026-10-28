"""Execute only the generated adoption function against CPU fake native world APIs."""
import ast,copy,json
from pathlib import Path
from types import SimpleNamespace
w=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal/Saved/Tests/DistrictRuntime/SingleRenderWindow-20261017T144012Z')
tree=ast.parse((w/'PrivateCapture/capture.py').read_text())
fn=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='restart_immersive_startup')
assert 'editor_request_end_play' not in ast.unparse(fn) and 'editor_request_begin_play' not in ast.unparse(fn)
code=compile(ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[])),'adopt-only','exec')
receipt=json.loads((w/'PrivateCapture/private-clip-receipt.json').read_text());proof=receipt['saved_body_flags_proof']
world=SimpleNamespace(get_path_name=lambda:'owned-exact-startup')
def run(change=None):
 config={'standalone':True,'map':'LaFontaine','controllers':1,'locals':1}
 state={};r={};private=copy.deepcopy(receipt)
 namespace={'MOTION':True,'HEADLESS':False,'COMMAND_LINE':'-immersive','STATE':state,'REPORT':r,'_private':private,'BUILD_EXPECTED':proof['flags'],'STYLES':(9,),'CREW_PATH':'/Game/ParkComic/CrewGraphicNovelHighDetail','Path':Path,'hashlib':__import__('hashlib'),'json':json}
 if change:change(config,state,private,namespace)
 u=SimpleNamespace(SystemLibrary=SimpleNamespace(is_standalone=lambda x:config['standalone']),GameplayStatics=SimpleNamespace(get_current_level_name=lambda x,b:config['map'],get_num_player_controllers=lambda x:config['controllers'],get_num_local_player_controllers=lambda x:config['locals']),log=lambda text:None)
 namespace['u']=u;exec(code,namespace)
 namespace['restart_immersive_startup']([world]);return state,r
state,report=run();assert state['phase']=='discover' and state['owns_pie'] and state['mesh_build_flags']=={9:proof['flags']}
assert 'reused earlier passed pre-PIE' in report['viewport_bootstrap']['saved_build_flags']
negative=[lambda c,s,p,n:c.update(standalone=False),lambda c,s,p,n:c.update(map='Wrong'),lambda c,s,p,n:c.update(controllers=2),lambda c,s,p,n:c.update(locals=2),lambda c,s,p,n:s.update(immersive_restart_requested=True),lambda c,s,p,n:n.update(HEADLESS=True),lambda c,s,p,n:n.update(STYLES=(10,)),lambda c,s,p,n:n.update(CREW_PATH='/Game/ParkComic/Crew'),lambda c,s,p,n:p['saved_body_flags_proof']['files'].update({proof['report']:'0'*64})]
for change in negative:
 try:run(change)
 except AssertionError:pass
 else:raise AssertionError('Unsafe adoption unexpectedly accepted')
print('NORD_PRIVATE_ADOPT_CPU_OK one_success nine_rejections no_begin_or_end_play')
