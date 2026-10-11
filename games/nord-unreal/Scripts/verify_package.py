"""Validate the actual Linux package using separate rendered host and headless client processes."""
import subprocess,time,os,signal,json,re,struct
from pathlib import Path
from package_inventory import verify_plateau_inventory
root=Path(__file__).resolve().parents[1];runner=root/'Builds/Linux/Quebec.sh'
assert runner.is_file(), 'Build the Linux Development package first'
output=root/'Saved/Tests';output.mkdir(parents=True,exist_ok=True)
host_log=output/'PackageHost.log';client_log=output/'PackageClient.log'
for p in (host_log,client_log):p.unlink(missing_ok=True)
host_out=(output/'PackageHost.stdout.log').open('w');client_out=(output/'PackageClient.stdout.log').open('w')
shots=('NordComic_East','NordComic_North','NordComic_West','NordRealistic_East','NordRealistic_North','NordComic_Jump','NordComic_Car')
screenshots=root/'Builds/Linux/Quebec/Saved/Screenshots/Linux'
for name in shots:(screenshots/(name+'.png')).unlink(missing_ok=True)
# ExecCmds run after the first world tick. Cycle the authoritative local player
# through all eight styles before dumping loaded clips; the eighth restores style 9.
commands=['ke QuebecController NextCharacter']*8+[
 'getall QuebecParkResident Style','getall StaticMeshComponent StaticMesh',
 'getall SkeletalMeshComponent SkinnedAsset','getall AnimSequence Skeleton',
 'getall QuebecPedestrian WalkSpeed','getall QuebecVegetation Trees',
 'getall QuebecCharacter CrewStyle','getall QuebecCampaign CompletedMissions']
bad_command=r'Bad or missing property|Failed to find function|Failed to find an object named|Unrecognized command'
cycle_pattern=r"Called 'NextCharacter' on (\d+) instance\(s\) of class '/Script/Quebec.QuebecController' \((\d+) succeeded\)"
host=client=None
try:
 host=subprocess.Popen(['bash',str(runner),'/Game/Maps/LaFontaine?listen','-port=7791','-RenderOffscreen','-ForceRes','-windowed','-ResX=1600','-ResY=900','-NordCapture','-NordNoCampaignSave','-unattended','-nosound','-ExecCmds='+','.join(commands),'-abslog='+str(host_log)],stdout=host_out,stderr=subprocess.STDOUT,start_new_session=True)
 start=time.monotonic()
 while time.monotonic()-start<50:
  text=host_log.read_text(errors='replace') if host_log.exists() else ''
  assert not re.search(bad_command,text,re.I),'Packaged startup console command failed'
  if 'listening on port 7791' in text and re.search(r'\.CrewStyle = 9\b',text):
   assert re.findall(cycle_pattern,text)==[('1','1')]*8,'Native crew cycling did not visit all eight styles'
   assert re.search(r'\.QuebecCampaign_\d+\.CompletedMissions = 0\b',text),'Fresh packaged campaign did not start'
   break
  assert host.poll() is None,'Packaged host exited before listening'
  time.sleep(.5)
 else:raise AssertionError('Packaged host never listened and completed the crew dependency cycle')
 client=subprocess.Popen(['bash',str(runner),'127.0.0.1:7791','-nullrhi','-NordNoCampaignSave','-unattended','-nosound',
  '-ExecCmds=t.MaxFPS 60','-csvCaptureFrames=6000','-csvExecCmds=r120:getall QuebecCampaign CompletedMissions',
  '-abslog='+str(client_log)],stdout=client_out,stderr=subprocess.STDOUT,start_new_session=True)
 while time.monotonic()-start<80:
  ct=client_log.read_text(errors='replace') if client_log.exists() else ''
  ht=host_log.read_text(errors='replace')
  if 'Welcomed by server' in ct and 'Join succeeded' in ht and re.search(r'\.QuebecCampaign_\d+\.CompletedMissions = 0\b',ct):break
  assert host.poll() is None and client.poll() is None,'A packaged peer exited before connecting'
  time.sleep(.5)
 else:raise AssertionError('Packaged client did not join')
 os.killpg(client.pid,signal.SIGTERM);client.wait(timeout=10);client=None
 host.wait(timeout=70);assert host.returncode==0,host.returncode
 text=host_log.read_text(errors='replace');assert text.count('NORD_CAPTURE ')==7, 'Seven packaged captures did not complete'
 for name in shots:
  data=(screenshots/(name+'.png')).read_bytes()
  assert data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(1600,900),name
 models=set(re.findall(r'SM_Resident(\d+)(Body|Head|LeftArm|RightArm|LeftLeg|RightLeg)',text))
 assert len(models)==66,('Cooked resident parts',len(models))
 crew=set(re.findall(r'/Game/ParkComic/Crew/Resident(\d+)/SK_Body\.SK_Body',text))
 assert crew==set(map(str,range(3,11))),('Cooked skeletal crew',crew)
 animations=set(re.findall(r'/Game/ParkComic/Crew/Resident(\d+)/(A_Walk|A_Idle|A_Run|A_Jump)',text))
 assert len(animations)==32,('Cooked clips',len(animations))
 plateau=verify_plateau_inventory(text,root)
 assert not re.search(r'Failed to find object.*ParkComic|Failed to load.*ParkComic|Missing cached shader map|'+bad_command,text,re.I)
 report={'passed':True,'package':'Linux Development','separate_process_loopback':True,'port':7791,'fresh_campaign_on_both_peers':True,'campaign_save_disabled_for_package_startup':True,'native_crew_cycle_calls':8,'restored_capture_crew_style':9,'loaded_resident_parts':len(models),'loaded_skeletal_crew':len(crew),'loaded_animation_clips':len(animations),'plateau':plateau,'rendered_capture':True,'rendered_capture_count':len(shots),'viewport':[1600,900],'elapsed_seconds':round(time.monotonic()-start,2),'skipped':['external internet','non-Linux platforms','latency and reconnect','full packaged campaign/save flow (covered in native PIE)']}
 (root/'Verification/Package.json').write_text(json.dumps(report,indent=2));print('NORD_PACKAGE_PLAY_OK',json.dumps(report))
finally:
 for process in (client,host):
  if process and process.poll() is None:
   os.killpg(process.pid,signal.SIGTERM)
   try:process.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL)
 host_out.close();client_out.close()
