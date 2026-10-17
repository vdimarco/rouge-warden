import json,struct,hashlib
from pathlib import Path
G=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal');D=G/'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/derived';report={}
for label,path in {'walk':D/'native-ready/walk.fbx','run':D/'native-ready/run.fbx','idle':D/'natural-pose-20261017/relaxed-idle.fbx','jump':D/'natural-pose-20261017/natural-jump.fbx','source_walk':G/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/walk.fbx','source_run':G/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/run.fbx'}.items():
 raw=path.read_bytes();version=struct.unpack_from('<I',raw,23)[0];H=struct.Struct('<QQQB' if version>=7500 else '<IIIB');null=H.size
 def prop(p):
  k=chr(raw[p]);p+=1
  if k in 'YCFDIL':
   s=struct.Struct('<'+dict(Y='h',C='?',F='f',D='d',I='i',L='q')[k]);return s.unpack_from(raw,p)[0],p+s.size
  if k in 'SR':
   n=struct.unpack_from('<I',raw,p)[0];p+=4;v=raw[p:p+n];return v.decode(errors='replace')if k=='S'else{'bytes':n},p+n
  assert k in 'fdlibc',k
  n,e,s=struct.unpack_from('<III',raw,p);return {'array':k,'count':n},p+12+s
 def node(p):
  end,count,size,n=H.unpack_from(raw,p)
  if not end:return None,p+H.size
  p+=H.size;name=raw[p:p+n].decode();p+=n;props=[]
  for _ in range(count):v,p=prop(p);props.append(v)
  children=[]
  while p<end-null:
   v,p=node(p)
   if v:children.append(v)
  return {'name':name,'props':props,'children':children},end
 p=27;roots=[]
 while p<len(raw)-null:
  v,p=node(p)
  if not v:break
  roots.append(v)
 globals=next(n for n in roots if n['name']=='GlobalSettings');settings=next(n for n in globals['children']if n['name']=='Properties70')['children'];settings={n['props'][0]:n['props'][4:]for n in settings if n['name']=='P'}
 objs=next(n for n in roots if n['name']=='Objects')['children'];stacks=[]
 for n in objs:
  if n['name']=='AnimationStack':
   x={c['props'][0]:c['props'][4:]for c in next(c for c in n['children']if c['name']=='Properties70')['children']if c['name']=='P'}
   stacks.append({'name':n['props'][1],'properties':x,'seconds':(x['LocalStop'][0]-x['LocalStart'][0])/46186158000})
 report[label]={'path':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'version':version,'time_global':{k:v for k,v in settings.items()if 'Time'in k or 'FrameRate'in k},'stacks':stacks}
Path('/tmp/nord-fbx-time-inventory.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
