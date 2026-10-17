"""Prepare only: root supplies a freshly frozen SingleRender window. Never launches jobs."""
import argparse, ast, datetime, hashlib, importlib.util, json, shutil
from pathlib import Path

ROOT=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
PLAN=ROOT/'Saved/Tests/GraphicNovel/PrivateJumpArmPlan-20261017'
OLD=Path('/home/von/Work/rouge-warden-nord-graphic-novel/games/nord-unreal/Saved/Tests/GraphicNovel/HighDetailMotion-20261014T084528Z')
PROFILE=OLD.parent/'Refinement-20261014T070254Z/make_motion_performance_wrapper_v2.py'
SOURCE=ROOT/'Scripts/capture_player_quality.py'
IMPORT=ROOT/'Verification/GraphicNovelHighDetailPilot/NativeImport.json'
HELPER=PLAN/'native_trial.py'
TARGET='Content/ParkComic/CrewGraphicNovelHighDetail/Resident9/A_Jump.uasset'
PINS={SOURCE:'e6ad0ca59dab8919d374520ffb3579a60f3bb587fbf5b0e80d5a5c872cc1ac98',IMPORT:'90374db5083e6115513032f74c6f8c7b31a45c5226bf1800bf91fae6ab3c88ca',HELPER:'53357cb83b891afc9624af4b391f49d1e0fccd2d899a869dad10afa70960a798',PROFILE:'c1df2faec9c789123bc3f8aaba67b73530ec74c3ee911844b513baa7d9d79590',OLD/'run_window.py':'8c4712fc8415ec4a5cd15abf4509a243a47084abe0c8b19bdfa1ed38a34bac5b'}
SG=('ViewDistance','AntiAliasing','Shadow','GlobalIllumination','Reflection','PostProcess','Texture','Effects','Foliage','Shading','Landscape')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def load(path,name):
 spec=importlib.util.spec_from_file_location(name,path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
def replace(text,old,new):
 assert text.count(old)==1,('Template drift',old);return text.replace(old,new)
def fixture_source(source,capture):
 edits={ 'HighDetailCapture':str(capture),'Saved/Tests/GraphicNovel/HighDetailImport.json':'Verification/GraphicNovelHighDetailPilot/NativeImport.json' }
 result=source
 for old,new in edits.items():result=replace(result,repr(old),repr(new))
 tree=ast.parse(source);changed=0
 for n in ast.walk(tree):
  if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value in edits:n.value=edits[n.value];changed+=1
 assert changed==2 and ast.dump(tree)==ast.dump(ast.parse(result)), 'Only two evidence/receipt literals may change'
 return result

def wrapper(fixture,receipt,motion_root,label):
 return f'''# Isolated evidence wrapper: original guards/cameras/pose assertions retained.
import hashlib, importlib.util, json, traceback
from pathlib import Path
_fixture=Path({str(fixture)!r})
assert hashlib.sha256(_fixture.read_bytes()).hexdigest()=={sha(fixture)!r}
_receipt_path=Path({str(receipt)!r})
assert hashlib.sha256(_receipt_path.read_bytes()).hexdigest()=={sha(receipt)!r}
_private=json.loads(_receipt_path.read_text())
for _path,_hash in _private['pins'].items():
    assert hashlib.sha256(Path(_path).read_bytes()).hexdigest()==_hash, ('Private capture pin changed',_path)
assert hashlib.sha256(Path(_private['native_clip_file']).read_bytes()).hexdigest()==_private['native_clip_sha256']
_spec=importlib.util.spec_from_file_location('nord_private_jump_guard',Path({str(HELPER)!r}))
_guard=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_guard)
_guard.cpu_gate(Path({str(ROOT)!r}))
_profile_path=Path({str(PROFILE)!r})
_spec=importlib.util.spec_from_file_location('nord_motion_profile',_profile_path)
_profile=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_profile)
try:
    exec(compile(_fixture.read_bytes(),str(_fixture),'exec'),globals())
    assert ROOT==Path({str(ROOT)!r}) and GRAPHIC_NOVEL_HIGH_DETAIL and GRAPHIC_NOVEL_GENERATED and GRAPHIC_NOVEL_CANDIDATE and not HEADLESS
    if _private['phase']=='trial':
        _private['fresh_render_readback']=_guard.readback(u,ROOT,Path(_private['backup']))
    REPORT['private_jump_comparison']=_private
    REPORT['candidate_asset_status']['native_jump_matches_retained_raw_source_claimed']=False
    _original_finish=finish
    def finish(error=None):
        if not error and 'world' in STATE:
            try:
                _settings={{'sg.'+name+'Quality':u.SystemLibrary.get_console_variable_int_value('sg.'+name+'Quality') for name in {SG!r}}}
                _settings['r.ScreenPercentage']=u.SystemLibrary.get_console_variable_float_value('r.ScreenPercentage')
                assert len(_settings)==12 and _settings['r.ScreenPercentage']==100 and all(v==3 for k,v in _settings.items() if k.startswith('sg.')), _settings
                REPORT['private_jump_full_quality']=_settings
            except Exception:error=traceback.format_exc()
        return _original_finish(error)
    if MOTION:
        _profile.install(globals(),{{'fixture_source':str(_fixture),'fixture_sha256':{sha(fixture)!r},'wrapper_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'capture_root':{str(motion_root)!r},'label':{label!r},'flush_timeout_seconds':30}})
except Exception:
    _profile.abort_setup(globals(),{str(fixture.parent)!r})
    raise
'''

def manager_source():
 s=(OLD/'run_window.py').read_text()
 s=replace(s,"['-immersive', '-NordGraphicNovelMotion', '-ExecCmds=t.MaxFPS 60'] if job['motion'] else ['-RenderOffscreen']","['-immersive', '-NordGraphicNovelMotion', '-ExecCmds=Scalability 3,r.ScreenPercentage 100,t.MaxFPS 60'] if job['motion'] else ['-RenderOffscreen', '-ExecCmds=Scalability 3,r.ScreenPercentage 100,t.MaxFPS 60']")
 pre="""    assert time.time()<BASE['private_jump_prepared_until'], 'Owned20minute render preparation expired'
    assert sha(ROOT/'Binaries/Linux/libUnrealEditor-Quebec.so')==BASE['source_binary_sha256'], 'Native module changed'
    assert {str(p.relative_to(ROOT)):sha(p) for p in (ROOT/'Content').rglob('*') if p.is_file()}==BASE['all_content_sha256'], 'Current Content baseline changed'
    assert all(sha(Path(p))==h for p,h in BASE['private_jump_files_sha256'].items()), 'Private capture pins changed'
"""
 s=replace(s,"try:\n    assert sha(ROOT/","try:\n"+pre+"    assert sha(ROOT/")
 s=replace(s,"        text = Path(job['log']).read_text(errors='replace')","        quality=report['private_jump_full_quality']\n        assert len(quality)==12 and quality['r.ScreenPercentage']==100 and all(v==3 for k,v in quality.items() if k.startswith('sg.')), quality\n        text = Path(job['log']).read_text(errors='replace')")
 s=replace(s,"        STATE['stream_helper_unchanged'] =","        STATE['private_jump_content_unchanged'] = {str(p.relative_to(ROOT)):sha(p) for p in (ROOT/'Content').rglob('*') if p.is_file()}==BASE['all_content_sha256']\n        STATE['private_jump_pins_unchanged'] = all(sha(Path(p))==h for p,h in BASE['private_jump_files_sha256'].items())\n        STATE['stream_helper_unchanged'] =")
 s=replace(s,"assert not STATE['all_content_changed'] and","assert STATE['private_jump_content_unchanged'] and STATE['private_jump_pins_unchanged'] and not STATE['all_content_changed'] and")
 compile(s,'private-run-window','exec');return s

def prepare(window,phase,backup=None,before=None):
 window=window.resolve();assert window.parent==ROOT/'Saved/Tests/DistrictRuntime' and window.name.startswith('SingleRenderWindow-')
 assert window.is_dir() and not (window/'window-status.json').exists() and not (window/'private-capture-provenance.json').exists()
 assert all(sha(p)==h for p,h in PINS.items()),'Capture/native/helper/source pin drift'
 base=json.loads((window/'baseline.json').read_text())
 actual={str(p.relative_to(ROOT)):sha(p) for p in (ROOT/'Content').rglob('*') if p.is_file()}
 assert actual==base['all_content_sha256'] and len(actual)==6850,'Fresh current 6850-Content snapshot required'
 assert all(sha(ROOT/p)==h for p,h in base['frozen_graphic_novel_source_sha256'].items())
 native=load(HELPER,'private_native_factory');native.cpu_gate(ROOT)
 if phase=='baseline':assert backup is None and before is None and actual[TARGET]==native.ORIGINAL_SHA
 else:
  assert backup and before
  receipt=json.loads((backup/'trial-receipt.json').read_text());fresh=json.loads((backup/'fresh-verify.json').read_text())
  assert receipt['passed'] and fresh['passed'] and receipt['changed_content_sha256'].get(TARGET)==actual[TARGET]
  prior=json.loads((before/'baseline.json').read_text());status=json.loads((before/'window-status.json').read_text())
  assert status['passed'] and status['restored']
  delta=sorted(p for p in set(actual)|set(prior['all_content_sha256']) if actual.get(p)!=prior['all_content_sha256'].get(p))
  assert delta==[TARGET],('Only private jump may differ',delta)
  for key in ['frozen_graphic_novel_source_sha256','source_binary_sha256','stream_helper_sha256','live_package_sha256','editor_settings_sha256']:
   assert base[key]==prior[key],('A/B baseline drift',key)
  assert [(r['path'],r['sha256']) for r in base['global_ini_backup']]==[(r['path'],r['sha256']) for r in prior['global_ini_backup']]
 keep=window/'ParentPrepared';keep.mkdir();shutil.copy2(window/'run_window.py',keep/'run_window.py');shutil.copy2(window/'jobs.json',keep/'jobs.json');shutil.copy2(window/'baseline.json',keep/'baseline.json')
 capture=window/'PrivateCapture';capture.mkdir();fixture=capture/'fixture.py';fixture.write_text(fixture_source(SOURCE.read_text(),capture/'Capture'))
 pins={str(p):h for p,h in PINS.items()};pins.update({str(native.CPU/'results.json'):native.CPU_SHA,str(native.CPU/'semantic-comparison.json'):native.SEMANTIC_SHA,str(native.TRIAL):native.TRIAL_SHA})
 if backup:pins.update({str(backup/name):sha(backup/name) for name in ['trial-receipt.json','fresh-verify.json','backup-manifest.json']})
 rec={'phase':phase,'native_clip_file':str(ROOT/TARGET),'native_clip_sha256':actual[TARGET],'backup':str(backup) if backup else None,'retained_raw_source_guard':'Original fixture high_detail_body_status() remains unchanged; these pins are provenance, not trial/native-to-raw equality.','trial_matches_raw_jump_claimed':False,'pins':pins,'before_window':str(before) if before else None}
 receipt=capture/'private-clip-receipt.json';receipt.write_text(json.dumps(rec,indent=2)+'\n')
 script=capture/'capture.py';script.write_text(wrapper(fixture,receipt,capture/'Capture',window.name+'-'+phase));compile(script.read_text(),str(script),'exec')
 jobs=[]
 for mode in ['Standard','Comic']:
  for width,height in [(1280,720),(1920,1080)]:
   folder=window/(mode+str(width));folder.mkdir();report=capture/'Capture'/('Standard' if mode=='Standard' else '')/f'PlayerQuality{width}.json'
   jobs.append(dict(name=folder.name,width=width,height=height,standard=mode=='Standard',motion=False,script=str(script),report=str(report),log=str(folder/'native.log'),stdout=str(folder/'stdout.log')))
  folder=window/('Motion1920'+mode);folder.mkdir();jobs.append(dict(name=folder.name,width=1920,height=1080,standard=mode=='Standard',motion=True,script=str(script),report=str(capture/'Capture/Motion'/mode/'PlayerMotion1920.json'),log=str(folder/'native.log'),stdout=str(folder/'stdout.log')))
 (window/'jobs.json').write_text(json.dumps(jobs,indent=2)+'\n');(window/'run_window.py').write_text(manager_source())
 base.update(private_jump_phase=phase,private_jump_prepared_until=datetime.datetime.now(datetime.timezone.utc).timestamp()+1200,scope='Private native jump A/B: unchanged seven-state fixture Std/Comic720/1080 plus two1080 native1x motion videos; no art/FPS promotion')
 base['private_jump_files_sha256']={**pins,**{str(p):sha(p) for p in [fixture,receipt,script,window/'jobs.json',window/'run_window.py',Path(__file__).resolve()]}}
 base['capture_scripts_sha256'].update({str(SOURCE.relative_to(ROOT)):sha(SOURCE)})
 (window/'baseline.json').write_text(json.dumps(base,indent=2)+'\n')
 provenance={'passed':True,'phase':phase,'window':str(window),'factory':str(Path(__file__).resolve()),'factory_sha256':sha(__file__),'fixture_source_sha256':sha(SOURCE),'fixture_sha256':sha(fixture),'only_fixture_changes':['high-detail output root','curated historical NativeImport receipt path'],'jobs':len(jobs),'stills':28,'review_states':['Airborne','Landing'],'motion_videos':2,'native_clip_sha256':actual[TARGET],'engine_jobs_launched':False,'service_actions':False,'manager_template_sha256':PINS[OLD/'run_window.py']}
 (window/'private-capture-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n');return provenance

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('window',type=Path);p.add_argument('phase',choices=['baseline','trial']);p.add_argument('--backup',type=Path);p.add_argument('--before-window',type=Path);a=p.parse_args()
 print(json.dumps(prepare(a.window,a.phase,a.backup.resolve() if a.backup else None,a.before_window.resolve() if a.before_window else None),indent=2))
