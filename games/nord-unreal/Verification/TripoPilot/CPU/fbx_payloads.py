import json,struct,zlib,hashlib
from pathlib import Path
O=Path(__file__).parent;raw=(O/'input/returned.fbx').read_bytes();H=struct.Struct('<IIIB');null=13
assert struct.unpack_from('<I',raw,23)[0]==7400

def prop(p):
 k=chr(raw[p]);p+=1
 if k in 'YCFDIL':
  s=struct.Struct('<'+dict(Y='h',C='?',F='f',D='d',I='i',L='q')[k]);return s.unpack_from(raw,p)[0],p+s.size
 if k in 'SR':
  n=struct.unpack_from('<I',raw,p)[0];p+=4;v=raw[p:p+n]
  return (v.decode(errors='replace') if k=='S' else {'bytes':n,'sha256':hashlib.sha256(v).hexdigest(),'head':v[:16].hex()}),p+n
 assert k in 'fdlibc',k
 n,e,s=struct.unpack_from('<III',raw,p);return {'array_kind':k,'count':n},p+12+s

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
objects=next(r for r in roots if r['name']=='Objects')['children'];connections=next(r for r in roots if r['name']=='Connections')['children']
selected=[n for n in objects if n['name'] in ('Video','Texture','Material')]
R={'scope':'binary FBX embedded payload names/hashes, no extraction or mutation','objects':selected,'connections':connections,'geometry_objects':sum(n['name']=='Geometry' for n in objects),'animation_curves':sum(n['name']=='AnimationCurve' for n in objects),'animation_stacks':[n['props'] for n in objects if n['name']=='AnimationStack']}
(O/'FBX-payloads.json').write_text(json.dumps(R,indent=2)+'\n')
for n in selected:
 print(n['name'],n['props'])
 for c in n['children']:
  if c['name'] in ('Content','FileName','Filename','RelativeFilename','RelativeFileName','Type'):print(' ',c['name'],c['props'])
