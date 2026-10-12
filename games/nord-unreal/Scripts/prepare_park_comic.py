"""Prepare attributed park references and original comic meshes; run in the geo venv."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
from prepare_city_buildings import triangles
from prepare_lafontaine import xy, inside, tags

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'Data/ParkComic'

class Mesh:
    def __init__(self): self.faces = {}; self.uvs = {}
    def face(self, points, mat='Paint', normal=None, uv=None):
        if normal is not None and np.dot(np.cross(np.subtract(points[1],points[0]),np.subtract(points[2],points[0])),normal)<0: points=list(reversed(points)); uv=list(reversed(uv)) if uv else None
        self.faces.setdefault(mat, []).append(points)
        if uv is not None:self.uvs[id(points)]=uv
    def box(self, c, s, mat='Paint'):
        x,y,z=c; a,b,d=[v/2 for v in s]
        p=[(x+i*a,y+j*b,z+k*d) for i,j,k in ((-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1))]
        for ids in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)):self.face([p[i] for i in ids],mat)
    def ellipsoid(self,c,s,mat='Paint',segments=12,rings=6):
        def p(i,j):
            a=-math.pi/2+math.pi*i/rings;b=math.tau*j/segments
            return (c[0]+s[0]/2*math.cos(a)*math.cos(b),c[1]+s[1]/2*math.cos(a)*math.sin(b),c[2]+s[2]/2*math.sin(a))
        for i in range(rings):
            for j in range(segments):
                q=[p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j)]
                if i==0:q=q[1:]
                elif i==rings-1:q=q[:3]
                self.face(q,mat,np.subtract(np.mean(q,axis=0),c))
    def rod(self,a,b,r,mat='Ink',segments=8):
        axis=np.subtract(b,a);axis=axis/np.linalg.norm(axis)
        u=np.cross(axis,(0,0,1) if abs(axis[2])<.9 else (0,1,0));u=u/np.linalg.norm(u);v=np.cross(axis,u)
        ring=lambda c:[tuple(np.array(c)+r*(u*math.cos(i*math.tau/segments)+v*math.sin(i*math.tau/segments))) for i in range(segments)]
        lo,hi=ring(a),ring(b)
        self.face(lo,mat,-axis);self.face(hi,mat,axis)
        for i in range(segments):self.face([lo[i],lo[(i+1)%segments],hi[(i+1)%segments],hi[i]],mat,np.subtract(lo[i],a))
    def torus(self,c,major,minor,mat='Paint',segments=24,sides=8):
        def p(i,j):
            a=i*math.tau/segments;b=j*math.tau/sides
            return (c[0]+minor*math.sin(b),c[1]+(major+minor*math.cos(b))*math.cos(a),c[2]+(major+minor*math.cos(b))*math.sin(a))
        for i in range(segments):
            for j in range(sides):self.face([p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)],mat)
    def save(self,name,directory=None,smooth=False):
        path=(directory or OUT/'Geometry')/f'{name}.obj';index=1;count=0
        normals={}
        if smooth:
            # Export explicit shared-vertex normals; OBJ smoothing groups alone are
            # discarded by some FBX import defaults and leave faceted foliage.
            for faces in self.faces.values():
                for face in faces:
                    normal=np.cross(np.subtract(face[1],face[0]),np.subtract(face[2],face[0]))
                    for point in face:
                        key=tuple(round(v,4) for v in point)
                        normals[key]=normals.get(key,np.zeros(3))+normal
        with path.open('w') as f:
            f.write('mtllib comic.mtl\ns '+('1' if smooth else 'off')+'\no '+name+'\n')
            for mat,faces in self.faces.items():
                f.write('usemtl '+mat+'\n')
                for face in faces:
                    for x,y,z in face:f.write(f'v {x:.4f} {-y:.4f} {z:.4f}\n')
                    normal=np.cross(np.subtract(face[1],face[0]),np.subtract(face[2],face[0]))
                    uvs=self.uvs.get(id(face))
                    if uvs is None:uvs=np.delete(np.asarray(face),np.argmax(np.abs(normal)),axis=1)/100
                    for uv in uvs:f.write(f'vt {uv[0]:.5f} {uv[1]:.5f}\n')
                    if smooth:
                        for point in face:
                            n=normals[tuple(round(v,4) for v in point)];n=n/max(np.linalg.norm(n),1.e-12)
                            f.write(f'vn {n[0]:.6f} {-n[1]:.6f} {n[2]:.6f}\n')
                    for tri in triangles([face]):
                        f.write('f '+' '.join(f'{index+i}/{index+i}'+(f'/{index+i}' if smooth else '') for i in reversed(tri))+'\n');count+=1
                    index+=len(face)
        assert count>0,name
        return {'file':path.name,'triangles':count,'materials':list(self.faces)}

PALETTE={'Paint':(.035,.26,.24),'Ink':(.018,.012,.028),'Cream':(.72,.65,.43),'Glass':(.045,.16,.25),'Gold':(.55,.3,.05),
         'Fur':(.21,.24,.28),'White':(.78,.75,.61),'Berry':(.36,.045,.075),'Orange':(.52,.18,.035),'Wood':(.16,.075,.032),
         'Grass':(.075,.18,.055),'Stone':(.35,.32,.26),'Roof':(.045,.11,.10),'Bronze':(.13,.20,.14),'Whale':(.035,.23,.40),
         'Skin':(.55,.29,.15),'Lime':(.40,.63,.035),'Navy':(.025,.055,.12),'Red':(.44,.025,.045),'Hair':(.06,.027,.012),
         'CrewFace':(1,1,1),'BrawlFace':(1,1,1),'Leaf0':(.06,.18,.07),'Leaf1':(.10,.25,.09),'Leaf2':(.16,.29,.10)}

def models():
    results=[]
    # A shaped body with wheel-arch notches; collision stays on the existing vehicle box.
    m=Mesh();poly=[(-218,-55),(-218,-9),(-185,7),(90,7),(215,-10),(222,-32),(218,-55)]
    theta=math.asin(9/45)
    for center in (155,-155):
        poly += [(center+math.cos(theta+i*(math.pi-2*theta)/12)*45,-64+math.sin(theta+i*(math.pi-2*theta)/12)*45) for i in range(13)]
    for sign in (-1,1):m.face([(x,sign*92,z) for x,z in poly],'Paint',(0,sign,0))
    for a,b in zip(poly,poly[1:]+poly[:1]):m.face([(a[0],-92,a[1]),(a[0],92,a[1]),(b[0],92,b[1]),(b[0],-92,b[1])],'Paint',(-(b[1]-a[1]),0,b[0]-a[0]))
    for y in (-93,93):
        m.rod((-212,y,-43),(212,y,-43),2.0,'Ink')
        m.rod((-100,y,4),(-100,y,-48),1.4,'Ink')
        m.rod((65,y,4),(65,y,-45),1.4,'Ink')
        m.box((-35,y*1.012,-6),(25,4,4),'Cream')
        for cx in (-155,155):
            pts=[(cx+math.cos(theta+i*(math.pi-2*theta)/16)*47,y*1.015,-64+math.sin(theta+i*(math.pi-2*theta)/16)*47) for i in range(17)]
            for a,b in zip(pts,pts[1:]):m.rod(a,b,3.2,'Ink',6)
    m.box((150,0,4),(108,18,1.5),'Cream')
    m.box((-218,0,-25),(5,45,22),'Cream')
    for y in (-13,0,13):m.box((223,y,-22),(3,7,22),'Ink')
    results.append(m.save('CarShell'))
    m=Mesh();cross=[(-159,9),(-91,76),(23,76),(86,9)]
    for sign in (-1,1):
        m.face([(x,sign*(74 if z>70 else 81),z) for x,z in cross],'Glass',(0,sign,0))
        q=[(x,sign*(74 if z>70 else 81),z) for x,z in cross]
        for a,b in zip(q,q[1:]+q[:1]):m.rod(a,b,3,'Ink')
        m.rod((-39,sign*81,10),(-39,sign*74,75),4,'Ink')
        m.rod((-132,sign*82,18),(-95,sign*76,57),2,'Cream')
    for a,b in ((cross[0],cross[1]),(cross[2],cross[3])):
        q=[(a[0],-81,a[1]),(a[0],81,a[1]),(b[0],74,b[1]),(b[0],-74,b[1])]
        m.face(q,'Glass',(-1,0,1) if a[0]<0 else (1,0,1))
        for y in (-48,48):m.rod((a[0]+2,y,a[1]+2),(b[0]-2,y,b[1]-2),1.8,'Cream')
    results.append(m.save('CarCabin'))
    m=Mesh();m.box((-34,0,79),(128,158,8),'Cream');m.rod((-34,-52,84),(-34,52,84),2,'Ink')
    results.append(m.save('CarRoof'))
    # Broad maple, umbrella elm/locust, and narrow conifer silhouettes. All artwork is original.
    for style in range(3):
        m=Mesh()
        if style<2:
            m.rod((0,0,280),(0,0,720),18,'Wood')
            for i in range(7):
                a=i*math.tau/7+.3*style;r=180 if style==0 else 240;z=650+(i%3)*100
                end=(r*math.cos(a),r*math.sin(a),z)
                m.rod((0,0,400+(i%2)*80),end,10,'Wood')
                m.ellipsoid(end,(360,330,380 if style==0 else 240),'Leaf'+str(i%3),10,5)
            m.ellipsoid((0,0,820),(390,380,360 if style==0 else 230),'Leaf1',10,5)
        else:
            m.rod((0,0,280),(0,0,1000),12,'Wood')
            for i in range(5):
                z=420+i*115;r=220-i*35
                ring=[(math.cos(j*math.tau/10)*r,math.sin(j*math.tau/10)*r,z) for j in range(10)]
                for a,b in zip(ring,ring[1:]+ring[:1]):m.face([a,b,(0,0,z+220)],'Leaf'+str(i%3))
        results.append(m.save('TreeCrown'+str(style)))
    for style in range(3):
        # Body, head and limbs have separate pivots for held-pose animation.
        m=Mesh();m.ellipsoid((0,0,108),(66,76,92),'Paint' if style==0 else ('Fur' if style==1 else 'Berry'))
        if style==1:
            m.ellipsoid((-24,0,88),(55,72,58),'White')
            m.rod((-20,0,85),(-70,0,45),15,'Fur')
            for i in range(4):m.ellipsoid((-34-i*9,0,72-i*7),(17,32,18),'Ink')
        if style==2:
            m.box((0,0,118),(59,67,60),'Berry')
            for i in range(9):
                y=(i%3-1)*18;x=(i//3-1)*17
                m.box((x,y,163+i%3*5),(11,12,62),'Gold')
            m.box((32,0,117),(2,42,24),'Cream')
        results.append(m.save(f'Resident{style}Body'))
        m=Mesh()
        if style==0:
            m.torus((0,0,20),37,16,'Gold')
            for i in range(20):
                a=i*math.tau/20;m.ellipsoid((15,math.cos(a)*40,20+math.sin(a)*40),(4,3,7),'Cream',6,3)
        elif style==1:
            m.ellipsoid((0,0,18),(75,85,75),'Fur')
            for y in (-29,29):
                m.ellipsoid((0,y,52),(22,25,35),'Fur',8,4);m.ellipsoid((10,y,55),(10,12,18),'Berry',8,4)
            m.ellipsoid((31,0,10),(28,48,30),'White')
            m.ellipsoid((47,0,14),(18,20,15),'Ink')
        else:
            m.ellipsoid((0,0,25),(67,76,62),'Gold')
            m.ellipsoid((25,0,4),(27,47,26),'Cream')
        for y in (-20,20):
            if style==1:m.ellipsoid((29,y,30),(21,32,26),'Ink')
            m.rod((12,y,29),(45,y,29),6,'Gold' if style==0 else 'Fur')
            for x,ry,rz,mat in ((58,12,15,'White'),(59,5,8,'Ink')):
                m.face([(x,y+math.cos(j*math.tau/24)*ry,29+math.sin(j*math.tau/24)*rz) for j in range(24)],mat,(1,0,0))
            m.rod((37,y-11,46),(37,y+9,49 if y<0 else 42),3,'Ink')
        m.rod((40,-10,0),(43,0,-4),2,'Ink');m.rod((43,0,-4),(40,10,0),2,'Ink')
        if style==0:
            m.box((-4,0,63),(28,68,8),'Paint');m.box((-9,0,72),(35,48,17),'Paint')
        results.append(m.save(f'Resident{style}Head'))
        for side in ('Left','Right'):
            sign=-1 if side=='Left' else 1
            m=Mesh();m.rod((0,0,0),(6,sign*10,-47),10,'Paint' if style==0 else ('Fur' if style==1 else 'Berry'))
            m.ellipsoid((7,sign*10,-50),(23,24,28),'Cream' if style!=1 else 'White',10,4)
            results.append(m.save(f'Resident{style}{side}Arm'))
            m=Mesh();m.rod((0,0,0),(0,0,-44),11,'Ink');m.ellipsoid((12,0,-53),(48,30,24),'Cream' if style!=2 else 'Paint',10,4)
            m.box((14,0,-63),(44,30,6),'Ink');results.append(m.save(f'Resident{style}{side}Leg'))
    # shortcut: faces use illustrated atlas patches; sculpt heads when adding facial animation.
    crew=[('Navy','Navy','Paint',(20,475,110,579),'CrewFace'),('Red','Navy','Navy',(137,486,224,585),'CrewFace'),
          ('Ink','Ink','Ink',(246,487,331,586),'CrewFace'),('Ink','Ink','White',(353,499,441,590),'CrewFace'),
          ('Red','Ink','Navy',(464,475,549,585),'CrewFace'),('Lime','Ink','Ink',(250,102,365,248),'BrawlFace'),
          ('Ink','Paint','Hair',(720,100,858,260),'BrawlFace'),('White','Navy','Hair',(1285,115,1410,266),'BrawlFace')]
    for style,(shirt,pants,cap,crop,atlas) in enumerate(crew,3):
        m=Mesh();m.ellipsoid((0,0,111),(56,72,80),shirt)
        m.ellipsoid((0,0,70),(49,64,24),pants)
        if style in (3,4,7):
            for y in (-34,34):m.rod((25,y,90),(25,y,139),2,'White')
            m.box((30,0,113),(2,28,22),'White')
            number='51' if style==3 else '33'
            # Jersey numerals are formed from original block strokes.
            for k,digit in enumerate(number):
                segs={'5':(0,1,3,5,6),'1':(2,5),'3':(0,2,3,5,6)}[digit]
                for seg in segs:
                    y=(k-.5)*15;z=115
                    horizontal=seg in (0,3,6)
                    yy=y if horizontal else y+(-5 if seg in (1,4) else 5)
                    zz=z+({0:10,3:0,6:-10}.get(seg,5 if seg in (1,2) else -5))
                    m.box((32,yy,zz),(2,10 if horizontal else 2,2 if horizontal else 9),'Red' if style==3 else 'Ink')
        if style==8:
            m.rod((31,0,77),(31,0,149),2,'Ink');m.rod((30,-27,142),(30,27,142),2,'Cream')
        if style==9:
            m.ellipsoid((31,0,115),(3,25,32),'Cream');m.ellipsoid((34,0,120),(3,18,13),'Ink')
            for y in range(-25,26,10):m.rod((30,y,96),(31,y+8,131),1.5,'Red')
        if style==10:
            m.rod((32,-28,147),(35,28,85),4,'Ink');m.box((30,32,83),(20,34,42),'Ink')
            for z in (95,110,125):m.ellipsoid((30,0,z),(3,4,4),'Ink',6,3)
        results.append(m.save(f'Resident{style}Body'))
        m=Mesh();m.ellipsoid((0,0,22),(49,57,68),'Skin')
        m.ellipsoid((-12,0,27),(34,60,70),'Hair' if style>=8 else 'Ink')
        if style<=8:
            m.ellipsoid((-1,0,52),(53,63,25),cap)
            m.box((-23 if style in (3,6,7) else 27,0,48),(35,57,6),cap)
        elif style==9:
            for j in range(12):
                a=j*math.tau/12;m.ellipsoid((-15,math.cos(a)*30,24+math.sin(a)*36),(35,22,35),'Hair',8,4)
        else:m.ellipsoid((-12,0,70),(27,30,26),'Hair')
        width,height=(576,1024) if atlas=='CrewFace' else (1536,1024)
        x0,y0,x1,y1=crop;pts=[];uv=[]
        for j in range(32):
            a=j*math.tau/32;yy=math.cos(a);zz=math.sin(a)
            pts.append((27,yy*25,22+zz*34))
            uv.append(((x0+(1-yy)/2*(x1-x0))/width,1-(y0+(1-zz)/2*(y1-y0))/height))
        m.face(pts,atlas,(1,0,0),uv)
        results.append(m.save(f'Resident{style}Head'))
        for side in ('Left','Right'):
            sign=-1 if side=='Left' else 1
            m=Mesh();m.rod((0,0,0),(3,sign*5,-20),12,shirt)
            m.rod((3,sign*5,-20),(11,sign*8,-46),9,'Skin');m.ellipsoid((11,sign*8,-49),(21,22,23),'Skin')
            if side=='Right':
                a=(15,sign*8,-63);b=(22,sign*8,58)
                m.rod(a,b,3,'Cream')
                if style==8:m.rod(a,b,7,'White')
                else:
                    m.ellipsoid((22,sign*8,60),(36,36,20),'Red');m.torus((22,sign*8,65),17,3,'Red',16,6)
            results.append(m.save(f'Resident{style}{side}Arm'))
            m=Mesh();m.rod((0,0,0),(0,0,-25),13,pants)
            m.rod((0,0,-25),(0,0,-50),9,pants if style<=8 else 'Skin')
            m.ellipsoid((10,0,-55),(43,27,21),'Skin' if style==9 else 'White')
            if style!=9:
                m.box((10,0,-64),(42,28,5),'Ink');m.rod((10,-14,-56),(23,-14,-52),2,'Ink')
            results.append(m.save(f'Resident{style}{side}Leg'))
    return results


def park_details(root,nodes,ways,park_poly,paths):
    from shapely.geometry import Polygon,Point,LineString
    details=[];signs=[];residents=[];shore=[]
    def part(mesh,mat,p,size,yaw=0): details.append({'mesh':mesh,'material':mat,'position':list(p),'size':list(size),'yaw':yaw})
    def beam(a,b,width,height,mat='Cream',z=8):
        length=math.dist(a,b)
        if length<1:return
        part('Cube',mat,((a[0]+b[0])/2,(a[1]+b[1])/2,z),(length,width,height),math.degrees(math.atan2(b[1]-a[1],b[0]-a[0])))
    # Mapped pond rings provide stone coping without changing the original pond outlines.
    for rel in root.findall('relation'):
        if tags(rel).get('natural')!='water':continue
        for ref in rel.findall('member'):
            if ref.get('role') not in ('outer','inner') or ref.get('ref') not in ways:continue
            pts=[xy(*nodes[n.get('ref')]) for n in ways[ref.get('ref')].findall('nd')]
            shore.append(pts)
            for a,b in zip(pts,pts[1:]):beam(a,b,45,12,'Stone',9)
    for e in ways.values():
        t=tags(e);pts=[xy(*nodes[n.get('ref')]) for n in e.findall('nd') if n.get('ref') in nodes]
        if not pts or not park_poly.buffer(800).covers(Point(pts[0])):continue
        if t.get('amenity')=='bench':
            for a,b in zip(pts,pts[1:]):
                beam(a,b,38,8,'Wood',47)
                length=math.dist(a,b)
                for k in range(max(1,int(length/250))):
                    f=(k+.5)/max(1,int(length/250));part('Cube','Ink',(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,25),(8,32,45))
        if t.get('historic')=='memorial' and t.get('name'):
            c=np.mean(pts[:-1] if pts[0]==pts[-1] else pts,axis=0)
            part('Cube','Stone',(*c,90),(210,210,180));part('Cube','Cream',(*c,190),(240,240,25))
            part('Sphere','Bronze',(*c,310),(95,85,225));part('Sphere','Bronze',(c[0],c[1],450),(70,70,80))
            signs.append({'text':t['name'],'position':[c[0],c[1],225],'yaw':-25,'size':25})
        if t.get('leisure')=='pitch' and t.get('sport') in ('tennis','soccer','beachvolleyball','boules','cycling','baseball'):
            if len(pts)<4:continue
            sport=t['sport'];poly=Polygon(pts).buffer(0);rect=list(poly.minimum_rotated_rectangle.exterior.coords)[:-1]
            edges=[(math.dist(a,b),a,b) for a,b in zip(rect,rect[1:]+rect[:1])];length,a,b=max(edges)
            u=np.subtract(b,a)/length;v=np.array((-u[1],u[0]));c=np.array(poly.centroid.coords[0]);width=min(e[0] for e in edges)
            pos=lambda x,y:tuple(c+u*x+v*y)
            if sport in ('tennis','soccer','beachvolleyball','boules'):
                for a,b in zip(pts,pts[1:]):beam(a,b,7,1,'White',10)
            if sport=='tennis':
                # Match each mapped court's orientation and dimensions.
                beam(pos(0,-width/2),pos(0,width/2),3,100,'Ink',60)
                for side in (-1,1):
                    beam(pos(-length/2,side*width*.375),pos(length/2,side*width*.375),6,1,'White',11)
                    beam(pos(side*length*.265,-width*.375),pos(side*length*.265,width*.375),6,1,'White',11)
                beam(pos(-length*.265,0),pos(length*.265,0),6,1,'White',11)
                for offset in range(-int(width/2),int(width/2),25):
                    x,y=pos(0,offset);part('Cube','Cream',(x,y,58),(2,2,95))
                for z in range(15,111,20):beam(pos(0,-width/2),pos(0,width/2),2,2,'Cream',z)
                for y in (-width/2-25,width/2+25):
                    x,y=pos(0,y);part('Cylinder','Ink',(x,y,60),(12,12,120))
            if sport=='soccer':
                beam(pos(0,-width/2),pos(0,width/2),7,1,'White',11)
                for k in range(40):
                    a=k*math.tau/40;b=(k+1)*math.tau/40;beam(pos(math.cos(a)*915,math.sin(a)*915),pos(math.cos(b)*915,math.sin(b)*915),7,1,'White',11)
                for side in (-1,1):
                    for y in (-366,366):
                        x,y=pos(side*length/2,y);part('Cylinder','White',(x,y,125),(12,12,250))
                    beam(pos(side*length/2,-366),pos(side*length/2,366),14,14,'White',250)
                    for y in (-width*.3,width*.3):beam(pos(side*length/2,y),pos(side*(length/2-1650),y),7,1,'White',11)
                    beam(pos(side*(length/2-1650),-width*.3),pos(side*(length/2-1650),width*.3),7,1,'White',11)
            if sport=='baseball':
                # The mapped infield has a pointed home end; base geometry follows that footprint.
                home=min(pts[:-1],key=lambda p:sum(math.dist(p,q) for q in pts[:-1]))
                for p in rect:part('Cube','White',(*p,12),(38,38,3),45)
                for p in rect[:2]:beam(home,p,8,1,'White',11)
            if sport=='beachvolleyball':
                beam(pos(0,-width/2),pos(0,width/2),3,80,'Ink',210)
                for y in (-width/2-40,width/2+40):
                    x,y=pos(0,y);part('Cylinder','Paint',(x,y,125),(15,15,250))
            if sport=='cycling':
                for a,b in zip(pts,pts[1:]):beam(a,b,12,1,'Gold',11)
            if sport in ('tennis','soccer','baseball'):
                for a,b in zip(pts,pts[1:]):
                    length2=math.dist(a,b)
                    for k in range(max(1,int(length2/400))):
                        f=k/max(1,int(length2/400));x=a[0]+(b[0]-a[0])*f;y=a[1]+(b[1]-a[1])*f
                        part('Cylinder','Ink',(x,y,150 if sport=='tennis' else 70),(8,8,300 if sport=='tennis' else 140))
                    beam(a,b,4,4,'Ink',300 if sport=='tennis' else 140)
    # Three mapped landmark footprints replace generic extrusions.
    m=Mesh();overrides=['27395538','27394465','433686251'];landmark_info=[]
    for ident,height in (('27395538',480),('27394465',700)):
        pts=[xy(*nodes[n.get('ref')]) for n in ways[ident].findall('nd')][:-1]
        poly=Polygon(pts).buffer(0);c=poly.centroid
        m.face([(x,y,height) for x,y in pts],'Roof',(0,0,1))
        for a,b in zip(pts,pts[1:]+pts[:1]):
            dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);normal=(dy/length,-dx/length,0)
            # Determine the exterior even if the OSM ring uses clockwise winding.
            if poly.covers(Point((a[0]+b[0])/2+normal[0]*10,(a[1]+b[1])/2+normal[1]*10)):normal=tuple(-v for v in normal)
            m.face([(*a,0),(*b,0),(*b,height),(*a,height)],'Stone',normal)
            m.rod((*a,height),(*b,height),14,'Cream')
            for d in range(140,int(length)-120,280):
                center=np.array((a[0]+dx*d/length,a[1]+dy*d/length));along=np.array((dx,dy))/length
                for z in ([180] if height<500 else [180,470]):
                    def window(w,h,offset,mat):
                        l=center-along*w/2+np.array(normal[:2])*offset;r=center+along*w/2+np.array(normal[:2])*offset
                        m.face([(l[0],l[1],z-h/2),(r[0],r[1],z-h/2),(r[0],r[1],z+h/2),(l[0],l[1],z+h/2)],mat,normal)
                    window(172,235,2,'Ink');window(156,220,3,'Cream');window(133,200,4,'Glass')
                    m.rod((center[0]+normal[0]*6,center[1]+normal[1]*6,z-100),(center[0]+normal[0]*6,center[1]+normal[1]*6,z+100),3,'Cream')
        name='ESPACE LA FONTAINE' if ident=='27395538' else 'CENTRE CALIXA-LAVALLÉE'
        signs.append({'text':name,'position':[c.x,c.y,height+80],'yaw':-28,'size':50})
        landmark_info.append({'name':name,'osm':ident,'xy':[c.x,c.y],'height_cm':height,'roof_probe':[poly.representative_point().x,poly.representative_point().y,height],'height_is_estimated':True})
    # Contemporary theatre: mapped stage footprint plus an illustrated timber canopy.
    pts=[xy(*nodes[n.get('ref')]) for n in ways['433686251'].findall('nd')][:-1];stage=Polygon(pts).buffer(0);c=np.array(stage.centroid.coords[0])
    rect=list(stage.minimum_rotated_rectangle.exterior.coords)[:-1];length,a,b=max((math.dist(a,b),a,b) for a,b in zip(rect,rect[1:]+rect[:1]));u=np.subtract(b,a)/length;v=np.array((-u[1],u[0]));width=min(math.dist(a,b) for a,b in zip(rect,rect[1:]+rect[:1]))
    point=lambda x,y,z:tuple(c+u*x+v*y)+(z,)
    for a,b in zip(pts,pts[1:]+pts[:1]):m.face([(*a,0),(*b,0),(*b,55),(*a,55)],'Ink')
    m.face([(x,y,55) for x,y in pts],'Wood',(0,0,1))
    roof=[point(-length/2-80,-width/2-80,600),point(length/2+80,-width/2-80,600),point(length/2+80,width/2+80,675),point(-length/2-80,width/2+80,675)]
    m.face(roof,'Cream',(0,0,1));m.face([(x,y,z-20) for x,y,z in roof],'Wood',(0,0,-1))
    for x in (-length/2,length/2):
        for y in (-width/2,width/2):m.rod(point(x,y,55),point(x,y,600 if y<0 else 675),13,'Ink')
    for x in range(-int(length/2),int(length/2),120):
        m.rod(point(x,-width/2,585),point(x,width/2,660),8,'Wood')
    bleachers=ways['433686250'];seat_poly=Polygon([xy(*nodes[n.get('ref')]) for n in bleachers.findall('nd')]).buffer(0)
    row=0
    for radius in range(900,6500,135):
        line=Point(c).buffer(radius,resolution=100).boundary.intersection(seat_poly)
        segments=list(line.geoms) if hasattr(line,'geoms') else [line]
        if line.is_empty:continue
        row+=1;z=row*17
        for line in segments:
            if line.geom_type!='LineString':continue
            p=list(line.coords)
            for a,b in zip(p,p[1:]):
                beam(a,b,95,18,'Stone',z);beam(a,b,37,9,'Wood',z+45)
                # A solid terraced base supports each walkable row.
                beam(a,b,95,z,'Stone',z/2)
    landmark_info.append({'name':'THÉÂTRE DE VERDURE','osm':'433686251','xy':list(c),'height_cm':675,'roof_probe':[float(c[0]),float(c[1]),637.5],'height_is_estimated':True,'design_reference':'https://lemay.com/projects/theatre-de-verdure/'})
    signs.append({'text':'THÉÂTRE DE VERDURE','position':[c[0],c[1],730],'yaw':-25,'size':65})
    # Original blue-whale interpretation at the mapped artwork position.
    c=xy(45.5253008,-73.5697487);m.ellipsoid((*c,110),(600,230,200),'Whale',16,8)
    m.ellipsoid((c[0]+220,c[1],115),(250,255,215),'Whale',12,6)
    m.ellipsoid((c[0]-300,c[1]-100,140),(150,240,45),'Whale');m.ellipsoid((c[0]-300,c[1]+100,140),(150,240,45),'Whale')
    for side in (-1,1):
        m.ellipsoid((c[0]+250,c[1]+side*120,150),(30,18,35),'White');m.ellipsoid((c[0]+255,c[1]+side*130,150),(16,9,21),'Ink')
    signs.append({'text':'LA BALEINE BLEUE','position':[c[0],c[1],270],'yaw':-25,'size':35})
    # Residents follow short, genuine path segments; routes never cut across the ponds.
    eligible=[p for p in paths if sum(math.dist(a,b) for a,b in zip(p,p[1:]))>2200 and all(park_poly.covers(Point(q)) for q in p)]
    targets=[xy(45.5244,-73.5663),xy(45.5247,-73.5683),xy(45.5257,-73.5704),xy(45.5271,-73.568),xy(45.5284,-73.5685),xy(45.5269,-73.5663)]
    for i,target in enumerate(targets+targets+targets[:2]):
        path=min(eligible,key=lambda p:LineString(p).distance(Point(target)))
        eligible.remove(path)
        # Keep a single short route along one mapped segment.
        a,b=max(zip(path,path[1:]),key=lambda ab:math.dist(*ab));mid=np.mean([a,b],axis=0);direction=np.subtract(b,a);half=min(math.dist(a,b)/2-50,900);direction=direction/np.linalg.norm(direction)
        route=[list(mid-direction*half)+[7],list(mid+direction*half)+[7]]
        residents.append({'style':i%3 if i<6 else i-3,'route':route,'phase':i*3.1})
    return {'details':details,'signs':signs,'residents':residents,'shorelines':shore,'landmark_overrides':overrides,'landmark_models':landmark_info,'landmark_mesh':m.save('ParkLandmarks')}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('tree_csv',type=Path);args=parser.parse_args()
    (OUT/'Geometry').mkdir(parents=True,exist_ok=True)
    (OUT/'Geometry/comic.mtl').write_text(''.join(f'newmtl {k}\nKd {v[0]} {v[1]} {v[2]}\n' for k,v in PALETTE.items()))
    trees=[]
    with args.tree_csv.open(newline='',encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            try:lat,lon=float(r['Latitude']),float(r['Longitude'])
            except ValueError:continue
            if not inside((lat,lon)):continue
            try:dhp=float(r['DHP'])
            except ValueError:dhp=25
            assert math.isfinite(dhp)
            dhp=max(5,min(dhp,150));species=r['Essence_latin'];ident=f"{r['ARROND']}:{r['INV_TYPE']}:{r['EMP_NO']}";seed=int(hashlib.sha256(ident.encode()).hexdigest()[:8],16)
            conifer=any(v in species for v in ('Picea','Pinus','Abies','Thuja','Larix'))
            style=2 if conifer else (0 if 'Acer' in species or 'Quercus' in species else 1)
            color=0 if conifer else (2 if 'rubrum' in species else seed%4)
            height=min(2400,500+math.sqrt(dhp)*155);radius=min(850,150+dhp*5.5)
            trees.append({'id':ident,'seed':seed,'xy':xy(lat,lon),'species':species,'diameter_cm':dhp,'height_cm':height,'crown_radius_cm':radius,'style':style,'color':color,'park':r['NOM_PARC'],'survey_date':r['Date_Releve']})
    root=ET.parse(ROOT/'Data/LaFontaine/osm.xml').getroot();nodes={e.get('id'):(float(e.get('lat')),float(e.get('lon'))) for e in root.findall('node')}
    ways={e.get('id'):e for e in root.findall('way')};park=ways['4767368'];park_points=[xy(*nodes[n.get('ref')]) for n in park.findall('nd')]
    from shapely.geometry import Polygon,Point
    park_poly=Polygon(park_points).buffer(0)
    furniture=[];pitches=[];paths=[];landmarks=[]
    for e in root.findall('node'):
        p=xy(*nodes[e.get('id')]);t=tags(e)
        if not park_poly.buffer(1500).covers(Point(p)):continue
        if t.get('amenity') in ('bench','drinking_water','waste_basket') or t.get('highway')=='street_lamp':furniture.append({'id':e.get('id'),'xy':p,'kind':t.get('amenity',t.get('highway')),'direction':t.get('direction')})
        if t.get('name') and (t.get('tourism') in ('artwork','viewpoint') or t.get('amenity') in ('theatre','cafe')):landmarks.append({'name':t['name'],'xy':p,'osm':e.get('id')})
    for e in ways.values():
        pts=[xy(*nodes[n.get('ref')]) for n in e.findall('nd') if n.get('ref') in nodes];t=tags(e)
        if not pts or not park_poly.buffer(300).covers(Point(pts[0])):continue
        if t.get('leisure')=='pitch' and t.get('sport'):pitches.append({'osm':e.get('id'),'sport':t['sport'],'points':pts})
        if t.get('highway') in ('footway','path','cycleway','pedestrian') and len(pts)>1:paths.append(pts)
    result={'tree_source':{'title':'Ville de Montréal — Arbres publics','url':'https://www.donneesquebec.ca/recherche/dataset/vmtl-arbres','license':'CC BY 4.0','download_sha256':hashlib.sha256(args.tree_csv.read_bytes()).hexdigest()},'reference_images':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT/'References').glob('*.png')},'osm_source':'Data/LaFontaine/osm.xml — OpenStreetMap contributors / ODbL 1.0','limits':'Tree positions, species and trunk diameters come from the inventory; height/crown dimensions are estimates. Landmark sculpture and furniture forms are original illustrations, not measured reproductions.','trees':trees,'park_outline':park_points,'furniture':furniture,'pitches':pitches,'paths':paths,'landmarks':landmarks,'palette':PALETTE,'models':models()}
    result.update(park_details(root,nodes,ways,park_poly,paths))
    result['models'].append(result.pop('landmark_mesh'))
    assert len(trees)>4000 and sum(t['park']=='LA FONTAINE' for t in trees)>2000
    assert len(pitches)>15 and len(paths)>100
    (OUT/'layout.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print('PARK_COMIC_PREPARED',len(trees),'trees',len(furniture),'furniture',len(pitches),'pitches',len(result['models']),'original meshes')

if __name__=='__main__':main()
