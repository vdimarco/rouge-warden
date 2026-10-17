from pathlib import Path
import datetime,hashlib,json,os,shutil,signal,subprocess,sys,traceback
plan=Path(__file__).resolve().parent;root=plan.parents[3];assert (root/'Quebec.uproject').is_file()
mode=sys.argv[1];assert mode in ('author','verify','restore','inspect')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def content():return {str(p.relative_to(root)):sha(p) for p in (root/'Content').rglob('*') if p.is_file()}
def saves():
 return {str(p):sha(p) for base in (root/'Saved/SaveGames',root/'Builds/Linux',root/'Builds/Browser/Linux') for p in base.rglob('*.sav') if p.is_file()}
def sources():
 paths=[p for base in (root/'Source',root/'Data/GraphicNovel') for p in base.rglob('*') if p.is_file()]
 paths+=list((root/'Scripts').glob('*.py'))+[root/'Binaries/Linux/libUnrealEditor-Quebec.so']
 return {str(p.relative_to(root)):sha(p) for p in paths}
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');out=plan/(mode.title()+'-'+stamp);out.mkdir()
before=content();save_before=saves();source_before=sources();settings=[]
rows=json.loads((root/'Saved/Tests/DistrictRuntime/Baseline/baseline.json').read_text())['ini']
for i,row in enumerate(rows):
 p=Path(row['path']);target=out/(str(i)+'-'+p.name);shutil.copy2(p,target);settings.append((p,target))
backup=root/'Saved/Recovery'/('private-jump-arm-'+stamp) if mode in ('author','inspect') else Path((plan/'current-native-backup.txt').read_text().strip())
report={'passed':False,'mode':mode,'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'backup':str(backup)}
try:
 if mode=='restore':
  manifest=json.loads((backup/'backup-manifest.json').read_text());assert all(sha(backup/p)==h for p,h in manifest.items())
  original=json.loads((backup/'original-content.json').read_text());actual=content();assert set(actual)==set(original)
  changed=[p for p,h in original.items() if actual[p]!=h]
  allowed={str(Path('Content/ParkComic/CrewGraphicNovelHighDetail/Resident9/A_Jump').with_suffix(s)) for s in ('.uasset','.uexp','.ubulk')}
  assert set(changed)<=allowed,'Unexpected other Content changes; coordinate before restoration'
  for p in changed:shutil.copy2(backup/p,root/p)
  assert content()==original
  report.update(native_passed=True,restored_files=changed,complete_original_content_restored=True)
 else:
  assert not any(name.startswith('UnrealEditor') for name in subprocess.check_output(['ps','-eo','comm='],text=True).splitlines()),'Another editor process owns the engine'
  assert datetime.datetime.now(datetime.timezone.utc) < datetime.datetime(2026,10,17,15,3,tzinfo=datetime.timezone.utc),'Insufficient remaining owned window'
  if mode=='author': assert shutil.disk_usage(root).free > sum((root/p).stat().st_size for p in before)+1073741824,'Insufficient backup space'
  command=['/home/von/.local/share/Epic/UE_5.8.3/Engine/Binaries/Linux/UnrealEditor-Cmd',str(root/'Quebec.uproject'),'/Engine/Maps/Entry','-NullRHI','-unattended','-nop4','-nosound','-UDPMESSAGING_TRANSPORT_ENABLE=0','-NordGraphicNovelCandidate','-NordGraphicNovelGenerated','-NordGraphicNovelHighDetail','-ExecutePythonScript='+str(plan/('inspect_native_tracks.py' if mode=='inspect' else 'native_trial.py')),'-NordPrivateJumpTrialBackup='+str(backup),'-abslog='+str(out/'native.log')]
  if mode=='verify':command.append('-NordPrivateJumpTrialVerify')
  report['command']=command
  with (out/'stdout.log').open('w') as stream:
   p=subprocess.Popen(command,cwd=root,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
   report['owned_process_group']=p.pid
   try:p.wait(timeout=300)
   except BaseException:
    try:os.killpg(p.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    try:p.wait(timeout=15)
    except subprocess.TimeoutExpired:
     try:os.killpg(p.pid,signal.SIGKILL)
     except ProcessLookupError:pass
     p.wait(timeout=15)
    raise
   finally:
    try:os.killpg(p.pid,signal.SIGTERM)
    except ProcessLookupError:pass
  report['exit_code']=p.returncode;text=(out/'native.log').read_text(errors='replace')
  assert p.returncode==0 and 'NORD_PRIVATE_JUMP_NATIVE_OK' in text and 'LogPython: Error:' not in text
  report['native_passed']=True
  if mode=='author':(plan/'current-native-backup.txt').write_text(str(backup)+'\n')
except BaseException:
 report['error']=traceback.format_exc();raise
finally:
 for p,copy in settings:shutil.copy2(copy,p)
 after=content();changed=sorted(p for p in set(before)|set(after) if before.get(p)!=after.get(p));allowed={str(Path('Content/ParkComic/CrewGraphicNovelHighDetail/Resident9/A_Jump').with_suffix(s)) for s in ('.uasset','.uexp','.ubulk')} if mode in ('author','restore') else set()
 report.update(changed_content=changed,only_declared_content_changes=set(before)==set(after) and set(changed)<=allowed,settings_restored=all(sha(p)==sha(copy) for p,copy in settings),saves_unchanged=saves()==save_before,sources_binary_unchanged=sources()==source_before,finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
 report['passed']=all(report.get(k,False) for k in ('native_passed','only_declared_content_changes','settings_restored','saves_unchanged','sources_binary_unchanged'))
 (out/'result.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
assert report['passed']
