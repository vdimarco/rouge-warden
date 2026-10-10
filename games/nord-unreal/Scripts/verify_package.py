"""Validate the actual Linux package using separate rendered host and headless client processes."""
import subprocess,time,os,signal,json,re,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1];runner=root/'Builds/Linux/Quebec.sh'
assert runner.is_file(), 'Build the Linux Development package first'
output=root/'Saved/Tests';output.mkdir(parents=True,exist_ok=True)
host_log=output/'PackageHost.log';client_log=output/'PackageClient.log'
for p in (host_log,client_log):p.unlink(missing_ok=True)
host_out=(output/'PackageHost.stdout.log').open('w');client_out=(output/'PackageClient.stdout.log').open('w')
shots=('NordComic_East','NordComic_North','NordComic_West','NordRealistic_East','NordRealistic_North','NordComic_Jump','NordComic_Car')
screenshots=root/'Builds/Linux/Quebec/Saved/Screenshots/Linux'
for name in shots:(screenshots/(name+'.png')).unlink(missing_ok=True)
host=client=None
try:
 host=subprocess.Popen(['bash',str(runner),'/Game/Maps/LaFontaine?listen','-port=7791','-RenderOffscreen','-ForceRes','-windowed','-ResX=1600','-ResY=900','-NordCapture','-unattended','-nosound','-ExecCmds=getall QuebecParkResident Style,getall StaticMeshComponent StaticMesh,getall SkeletalMeshComponent SkinnedAsset,getall AnimSequence Skeleton','-abslog='+str(host_log)],stdout=host_out,stderr=subprocess.STDOUT,start_new_session=True)
 start=time.monotonic()
 while time.monotonic()-start<50:
  text=host_log.read_text(errors='replace') if host_log.exists() else ''
  if 'listening on port 7791' in text:break
  assert host.poll() is None,'Packaged host exited before listening'
  time.sleep(.5)
 else:raise AssertionError('Packaged host never listened')
 client=subprocess.Popen(['bash',str(runner),'127.0.0.1:7791','-nullrhi','-unattended','-nosound','-abslog='+str(client_log)],stdout=client_out,stderr=subprocess.STDOUT,start_new_session=True)
 while time.monotonic()-start<80:
  ct=client_log.read_text(errors='replace') if client_log.exists() else ''
  ht=host_log.read_text(errors='replace')
  if 'Welcomed by server' in ct and 'Join succeeded' in ht:break
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
 animations=set(re.findall(r'/Game/ParkComic/Crew/Resident(\d+)/(A_Walk|A_Idle)',text))
 assert len(animations)==16,('Cooked clips',len(animations))
 city=set(re.findall(r'/Game/CityBuildings/SM_([^.]*)\.',text))
 expected={b['id'] for b in json.loads((root/'Data/CityBuildings/manifest.json').read_text())['buildings']}
 assert city==expected and '2316936' not in city, ('Cooked surveyed buildings',len(city),len(expected))
 assert not re.search(r'Failed to find object.*ParkComic|Failed to load.*ParkComic|Missing cached shader map',text)
 report={'passed':True,'package':'Linux Development','separate_process_loopback':True,'port':7791,'loaded_resident_parts':len(models),'loaded_skeletal_crew':len(crew),'loaded_animation_clips':len(animations),'surveyed_buildings':len(city),'rendered_capture':True,'rendered_capture_count':len(shots),'viewport':[1600,900],'elapsed_seconds':round(time.monotonic()-start,2),'skipped':['external internet','non-Linux platforms','latency and reconnect']}
 (root/'Verification/Package.json').write_text(json.dumps(report,indent=2));print('NORD_PACKAGE_PLAY_OK',json.dumps(report))
finally:
 for process in (client,host):
  if process and process.poll() is None:
   os.killpg(process.pid,signal.SIGTERM)
   try:process.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL)
 host_out.close();client_out.close()
