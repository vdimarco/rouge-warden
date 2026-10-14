import json,struct,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
root=Path('/home/von/Work/rouge-warden-nord-graphic-novel/games/nord-unreal');s=root/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail';out=root/'Data/GraphicNovel/Pilot/CurlyMetalhead/refined-v2-high-detail';b=(s/'body.glb').read_bytes();n,t=struct.unpack_from('<II',b,12);g=json.loads(b[20:20+n]);o=20+n;n2,t2=struct.unpack_from('<II',b,o);data=memoryview(b)[o+8:o+8+n2]
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5121:np.uint8,5125:np.uint32,5126:np.float32}[a['componentType']];dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];return np.frombuffer(data,dtype=dt,count=a['count']*dim,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],dim)
p=acc(0).astype(float);p=p[:,[0,2,1]];p[:,1]*=-1;t=acc(6).reshape(-1,3);q=p[t];c=q.mean(axis=1);norm=np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-15);uv=acc(2);im=np.asarray(Image.open(s/'base_color.png').convert('RGB'));u=uv[t].mean(axis=1);rgb=im[np.clip((u[:,1]*2048).astype(int),0,2047),np.clip((u[:,0]*2048).astype(int),0,2047)]
font=ImageFont.load_default(size=15);canvas=Image.new('RGB',(1800,960),'#f5f5f5');draw=ImageDraw.Draw(canvas);details=[]
for k,x in enumerate([-.09,-.06,-.03,0,.03,.06,.09,.12]):
 col,row=k%4,k//4;ox,oy=col*450,row*480;draw.text((ox+12,oy+10),f'Raw high-detail section X={x:.3f} m',fill='black',font=font)
 def pt(y,z):return (ox+35+(y+.17)/.20*380,oy+440-(z-1.40)/.19*390)
 for z in [1.42,1.45,1.47,1.49,1.52,1.55,1.58]:
  draw.line([pt(-.17,z),pt(.03,z)],fill='#dddddd');draw.text((ox+1,pt(-.17,z)[1]-8),f'{z:.2f}',font=font,fill='#666666')
 sel=np.flatnonzero((q[:,:,0].min(axis=1)<=x)&(q[:,:,0].max(axis=1)>=x)&(c[:,2]>1.39)&(c[:,2]<1.61)&(c[:,1]<.04))
 for i in sel:
  hits=[]
  for a,b in zip(q[i],[q[i,1],q[i,2],q[i,0]]):
   if (a[0]-x)*(b[0]-x)<0:
    f=(x-a[0])/(b[0]-a[0]);hits.append(a+f*(b-a))
  if len(hits)==2:
   color=tuple(int(v) for v in rgb[i]);draw.line([pt(a[1],a[2]) for a in hits],fill=color,width=3)
   if hits[0][1]<0 and hits[1][1]<0 and norm[i,2]>.6:details.append({'x':x,'face':int(i),'normal':norm[i].tolist(),'centroid':c[i].tolist(),'rgb':rgb[i].tolist()})
 for y in [-.15,-.10,-.05,0]:draw.text((pt(y,1.4)[0]-15,oy+450),f'{y:.2f}',font=font,fill='#555555')
canvas.save(out/'collar-sections.png');(out/'collar-sections.json').write_text(json.dumps(details,indent=2)+'\n');print('SECTIONS',len(details));print('SOURCE_SHA',hashlib.sha256((s/'body.glb').read_bytes()).hexdigest())
