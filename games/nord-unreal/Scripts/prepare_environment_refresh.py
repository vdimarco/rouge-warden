"""Prepare only environment artwork from the checked-in survey and park inventory."""
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/EnvironmentRefresh'
LEAF_COLORS = ((.075, .17, .055), (.24, .22, .07), (.27, .115, .055), (.10, .21, .095))
PALETTE = {'Stone': (.36, .35, .31), 'Cream': (.58, .55, .45), 'Wood': (.17, .105, .055),
           'Glass': (.065, .12, .135), 'Ink': (.025, .035, .032), 'Roof': (.095, .12, .105),
           'CourtCarpet': (.065, .19, .13), 'CourtAcrylic': (.095, .22, .30),
           'CourtRunoff': (.15, .21, .14), 'CourtSand': (.47, .40, .25),
           'CourtLine': (.73, .70, .58), 'CourtNet': (.055, .065, .055),
           'CourtPost': (.10, .18, .18)}
STREETS = ('Rue Sherbrooke Est', 'Rue Rachel Est', 'Avenue du Parc-La Fontaine', 'Avenue Papineau')


def tree_profile(tree):
    """Inventory diameter and species are evidence; crown dimensions/season remain estimates."""
    seed = tree['seed']
    diameter = tree['diameter_cm']
    conifer = tree['style'] == 2
    color = 0 if conifer else (2 if 'rubrum' in tree['species'] or 'rubra' in tree['species'] else
                              (1 if seed % 10 < 3 else (3 if seed % 10 < 6 else 0)))
    height=min(2600., max(820., (650. + math.sqrt(diameter) * 175.) * (.91+(seed%29)/140.)))
    radius=min(1000., (180. + diameter * (4. if conifer else 7.)) * (.88+((seed//19)%23)/100.))
    if not conifer:radius=max(radius,height*.34)
    return {'height':height,'radius':radius,'variant':0 if conifer else (seed//11)%4,
            'color':color,'yaw':seed%360,'width_ratio':.78+(seed%31)/100.}


def tapered_branch(mesh,a,b,base,tip,segments=7):
    import numpy as np
    axis=np.subtract(b,a);axis/=np.linalg.norm(axis)
    u=np.cross(axis,(0,0,1) if abs(axis[2])<.9 else (0,1,0));u/=np.linalg.norm(u)
    v=np.cross(axis,u)
    rings=[[tuple(np.array(c)+r*(u*math.cos(i*math.tau/segments)+v*math.sin(i*math.tau/segments)))
            for i in range(segments)] for c,r in ((a,base),(b,tip))]
    mesh.face(rings[0],'Wood',-axis);mesh.face(rings[1],'Wood',axis)
    for i in range(segments):
        mesh.face([rings[0][i],rings[0][(i+1)%segments],rings[1][(i+1)%segments],rings[1][i]],'Wood',np.subtract(rings[0][i],a))


def crown_mesh(style, Mesh, variant=0):
    if style<2:return broadleaf_mesh(style,variant,Mesh)
    mesh = Mesh()
    # Conifers retain their species-appropriate narrow, tiered silhouette.
    segments, rings = 28, 12
    def point(i, j):
        lat = -math.pi / 2 + math.pi * i / rings
        angle = math.tau * j / segments
        lobe = 1. + .085 * math.sin(5 * angle + lat * 3 + style) + .055 * math.cos(9 * angle - lat * 4)
        if style == 2:
            z = 300. + 700. * i / rings
            radius = 270. * (1. - i / rings) ** .8 * (1. + .10 * math.cos(i * 2.7))
        else:
            z = (650. if style == 0 else 700.) + (350. if style == 0 else 290.) * math.sin(lat)
            radius = (390. if style == 0 else 460.) * math.cos(lat) * lobe
        return (math.cos(angle) * radius, math.sin(angle) * radius * .93,
                z + (0 if i in (0, rings) else 17 * math.sin(angle * 7 + i)))
    for i in range(rings):
        for j in range(segments):
            face = [point(i, j), point(i, j + 1), point(i + 1, j + 1), point(i + 1, j)]
            if i == 0 and style != 2: face = face[1:]
            if i == rings - 1: face = face[:3]
            # Small local colour changes describe foliage without outlining individual spheres.
            shade = 0 if i < 3 else (2 if i > 8 else 1)
            mesh.face(face, 'Leaf' + str(shade), (math.cos(j * math.tau / segments), math.sin(j * math.tau / segments), 0))
    mesh.rod((0, 0, 240), (0, 0, 660), 15, 'Wood')
    if style != 2:
        for i in range(6):
            a = i * math.tau / 6 + .2 * style
            mesh.rod((0, 0, 350 + i % 2 * 60), (math.cos(a) * 240, math.sin(a) * 220, 620 + i % 3 * 45), 9, 'Wood')
    return mesh


def broadleaf_mesh(style,variant,Mesh):
    """Eight uneven, open bough structures; elongated leaf masses follow their limbs."""
    import numpy as np
    mesh=Mesh();clusters=[];branches=[]
    count=5+(variant+style*2)%4
    phase=.73*variant+.41*style
    # Spreading, open-vase, leaning and tiered silhouettes have different fork
    # heights/directions. None uses equally spaced balls on an identical Y trunk.
    spread=(1.12,.88,1.02,.82)[variant]
    lift=(-65,75,0,105)[variant]+style*25
    lean=(0,40,120,-70)[variant]
    for i in range(count):
        angle=math.tau*i/count+phase+.29*math.sin(i*2.7+variant)
        radius=(350+style*45)*spread*(1+.24*math.sin(i*1.9+variant))
        z=670+lift+100*math.sin(i*2.3+variant)
        root=(lean*.12,12*math.cos(i),280+45*((i+variant)%4))
        bend=(math.cos(angle)*radius*.46+lean*.5,math.sin(angle)*radius*.46,z-155)
        tip=(math.cos(angle)*radius+lean,math.sin(angle)*radius,z)
        branches.extend(((root,bend,21,13),(bend,tip,13,5)))
        for j,fraction in enumerate((.72,1.05)):
            center=(math.cos(angle)*radius*fraction+lean,math.sin(angle)*radius*fraction,z+25*j)
            size=(175+35*math.sin(i+variant),100+20*math.cos(i*1.4),100+20*style)
            clusters.append((center,size,angle+.2*math.sin(i)))
        # Unequal side twigs, not detached spherical tips, interrupt the outline.
        side_angle=angle+(.55 if i%2 else -.65)
        side=(tip[0]+math.cos(side_angle)*100,tip[1]+math.sin(side_angle)*100,z+55+40*math.cos(i))
        branches.append((bend,side,10,3))
        clusters.append((side,(120,85,80),side_angle))
    for i in range(2 if variant==1 else 3):
        angle=phase+i*2.3
        top=(math.cos(angle)*120+lean,math.sin(angle)*150,850+lift*.4+55*math.sin(i+variant))
        branches.append(((lean*.25,0,430),top,16,5))
        clusters.append((top,(155,120,120),angle))
    def field(points):
        values=np.zeros(len(points))
        for center,size,angle in clusters:
            q=points-center
            q=np.column_stack((q[:,0]*math.cos(angle)+q[:,1]*math.sin(angle),
                               -q[:,0]*math.sin(angle)+q[:,1]*math.cos(angle),q[:,2]))/size
            values+=np.exp(-1.7*np.sum(q*q,axis=1))
        values*=1+.24*np.sin(points[:,0]*.041+variant)*np.cos(points[:,1]*.037)*np.sin(points[:,2]*.043)
        return values-.43
    step=42.
    xs=np.arange(-900,949,step);ys=np.arange(-900,949,step);zs=np.arange(300,1177,step)
    grid=np.stack(np.meshgrid(xs,ys,zs,indexing='ij'),axis=-1)
    values=field(grid.reshape(-1,3)).reshape(grid.shape[:-1])
    # Marching tetrahedra is dependency-free beyond the project's existing NumPy.
    corners=((0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1))
    tetrahedra=((0,5,1,6),(0,1,2,6),(0,2,3,6),(0,3,7,6),(0,7,4,6),(0,4,5,6))
    edges=((0,1),(0,2),(0,3),(1,2),(1,3),(2,3))
    shape=tuple(n-1 for n in values.shape)
    cube_values=np.stack([values[x:x+shape[0],y:y+shape[1],z:z+shape[2]] for x,y,z in corners],axis=-1)
    active=np.argwhere((cube_values.min(axis=-1)<0)&(cube_values.max(axis=-1)>0))
    for x,y,z in active:
        points=np.array([grid[x+dx,y+dy,z+dz] for dx,dy,dz in corners]);v=cube_values[x,y,z]
        for ids in tetrahedra:
            p=points[list(ids)];f=v[list(ids)];hits=[]
            for a,b in edges:
                if (f[a]>0)==(f[b]>0):continue
                hits.append(p[a]+(p[b]-p[a])*(-f[a])/(f[b]-f[a]))
            if len(hits)<3:continue
            center=np.mean(hits,axis=0)
            outward=np.mean(p[f<=0],axis=0)-np.mean(p[f>0],axis=0)
            outward/=max(np.linalg.norm(outward),1.e-9)
            axis=np.cross(outward,(0,0,1) if abs(outward[2])<.9 else (0,1,0));axis/=np.linalg.norm(axis)
            side=np.cross(outward,axis)
            hits.sort(key=lambda p:math.atan2(np.dot(p-center,side),np.dot(p-center,axis)))
            for i in range(1,len(hits)-1):
                if np.linalg.norm(np.cross(hits[i]-hits[0],hits[i+1]-hits[0]))>1.e-7:
                    mesh.face([tuple(hits[0]),tuple(hits[i]),tuple(hits[i+1])],'Leaf1',outward)
    tapered_branch(mesh,(0,0,220),(lean*.25,0,460),23,17)
    for a,b,base,tip in branches:tapered_branch(mesh,a,b,base,tip)
    return mesh


def municipal_wall_triangles(path):
    """Read the retained survey walls; OBJ export reverses the map's Y axis."""
    vertices=[];walls=[]
    for line in path.read_text().splitlines():
        if line.startswith('v '):
            x,y,z=map(float,line.split()[1:]);vertices.append((x,-y,z))
        elif line.startswith('f '):
            triangle=[vertices[int(index.split('/')[0])-1] for index in line.split()[1:]]
            a,b,c=triangle;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
            normal=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
            if abs(normal[2])<.1*math.sqrt(sum(n*n for n in normal)):walls.append(triangle)
    return walls


def supported_wall_height(walls,a,b):
    """Conservative wall top across a whole footprint edge, including low wings/gaps."""
    length=math.dist(a,b);along=((b[0]-a[0])/length,(b[1]-a[1])/length)
    projected=[]
    for triangle in walls:
        if max(abs((v[0]-a[0])*along[1]-(v[1]-a[1])*along[0]) for v in triangle)>25:continue
        points=[((v[0]-a[0])*along[0]+(v[1]-a[1])*along[1],v[2]) for v in triangle]
        if max(p[0] for p in points)<0 or min(p[0] for p in points)>length:continue
        projected.append(points)
    samples={1.,length-1.}
    samples.update(length*i/max(1,math.ceil(length/100)) for i in range(1,math.ceil(length/100)))
    samples.update(t+d for triangle in projected for t,z in triangle for d in (-1.,1.) if 1<t+d<length-1)
    heights=[]
    for x in sorted(samples):
        hits=[]
        for triangle in projected:
            for (u,z),(v,w) in zip(triangle,triangle[1:]+triangle[:1]):
                if abs(v-u)>1.e-6 and min(u,v)-.001<=x<=max(u,v)+.001:hits.append(z+(w-z)*(x-u)/(v-u))
        heights.append(max(hits,default=0.))
    return (min(heights),max(heights)-min(heights))


def municipal_window_data(path):
    """Keep the imported wall UVs and float32 object-bounds window phase."""
    import numpy as np
    vertices=[];uvs=[];walls=[];material=None
    for line in path.read_text().splitlines():
        if line.startswith('v '):
            x,y,z=map(float,line.split()[1:]);vertices.append((x,-y,z))
        elif line.startswith('vt '):uvs.append(float(line.split()[1]))
        elif line.startswith('usemtl '):material=line.split()[1]
        elif line.startswith('f ') and material=='EstimatedWall':
            indices=[index.split('/') for index in line.split()[1:]]
            triangle=[(vertices[int(i[0])-1],uvs[int(i[1])-1]) for i in indices]
            a,b,c=[v for v,u in triangle];normal=np.cross(np.subtract(b,a),np.subtract(c,a))
            if abs(normal[2])<.1*np.linalg.norm(normal):walls.append(triangle)
    v=np.asarray(vertices,dtype=np.float32)
    center=np.float32(np.float32(v.min(axis=0)+v.max(axis=0))*np.float32(.5))
    argument=np.float32(center[0]*np.float32(.00113)+center[1]*np.float32(.00197))
    value=np.float32(np.sin(argument)*np.float32(43758.5453))
    return float(value-np.floor(value)),walls


def aligned_window_bay(walls,a,b,seed,x):
    length=math.dist(a,b);along=((b[0]-a[0])/length,(b[1]-a[1])/length);candidates=[]
    for triangle in walls:
        if max(abs((v[0]-a[0])*along[1]-(v[1]-a[1])*along[0]) for v,u in triangle)>25:continue
        points=[((v[0]-a[0])*along[0]+(v[1]-a[1])*along[1],u) for v,u in triangle]
        low,high=min(points),max(points)
        if high[0]-low[0]<1:continue
        slope=(high[1]-low[1])/(high[0]-low[0]);offset=low[1]-slope*low[0]
        if abs(slope)<.001 or any(abs(slope*t+offset-u)>.00001 for t,u in points):continue
        nearest=round(slope*x+offset+seed*.3-.5)
        for k in (nearest-1,nearest,nearest+1):
            uv=k+.5-seed*.3;center=(uv-offset)/slope
            if max(99,low[0])<=center<=min(length-99,high[0]):candidates.append((center,uv))
    return min(candidates,key=lambda value:abs(value[0]-x)) if candidates else None


def street_architecture(mesh,city,ways,points,park_outline):
    from shapely.geometry import Polygon,Point,LineString,MultiPoint
    from shapely.ops import unary_union,nearest_points
    occupied=unary_union([Polygon(r).buffer(0) for b in city['buildings'] for r in b['footprints']])
    interior=occupied.buffer(-5)
    mapped=json.loads((ROOT/'Data/LaFontaine/layout.json').read_text())
    asphalt=unary_union([LineString([a,b]).buffer(width/2,cap_style=2)
                        for road,width in zip(mapped['roads'],mapped['road_widths']) for a,b in zip(road,road[1:])])
    trees=json.loads((ROOT/'Data/ParkComic/layout.json').read_text())['trees']
    trunks=unary_union([Point(t['xy']).buffer(t['diameter_cm']/2+20) for t in trees])
    roads=[(tags.get('name'),LineString(points(w))) for w in ways.values()
           if (tags:={t.get('k'):t.get('v') for t in w.findall('tag')}).get('name') in STREETS
           and tags.get('highway') in ('primary','secondary','tertiary','residential','living_street')]
    assert set(name for name,road in roads)==set(STREETS)
    source_buildings=[];institutions=[]
    for w in ways.values():
        t={tag.get('k'):tag.get('v') for tag in w.findall('tag')}
        if not t.get('building') and t.get('amenity')!='hospital':continue
        poly=Polygon(points(w)).buffer(0)
        if poly.is_empty:continue
        if t.get('amenity') in ('hospital','school','college','place_of_worship') or t.get('building')=='hospital' or t.get('name')=='Édifice Gaston-Miron':
            institutions.append(poly.buffer(150))
        source_buildings.append((w.get('id'),t,poly))
    rod=lambda a,b,r,mat,segments=6:mesh.rod(a,b,r,mat,segments)
    facades=[]
    for building in city['buildings']:
        height=building['height_cm'];center=Point(building['center'])
        if not 600<height<1800 or park_outline.covers(center) or park_outline.distance(center)>6500:continue
        if min(road.distance(center) for name,road in roads)>4200:continue
        matches=[(ident,t,p) for ident,t,p in source_buildings if p.covers(center)]
        matched=min(matches,key=lambda row:row[2].area) if matches else None
        t=matched[1] if matched else {}
        civic=any(p.covers(center) for p in institutions) or t.get('amenity') in ('school','college','place_of_worship')
        residential=not civic and t.get('building','yes') in ('yes','residential','apartments','house','terrace','detached','semidetached_house')
        walls=municipal_wall_triangles(ROOT/'Data/CityBuildings/Geometry'/f"{building['id']}.obj")
        for ring in building['footprints']:
            poly=Polygon(ring).buffer(0).simplify(18.,preserve_topology=True)
            if poly.geom_type!='Polygon':continue
            coords=list(poly.exterior.coords)
            for a,b in zip(coords,coords[1:]):
                length=math.dist(a,b)
                if length<450:continue
                middle=Point((a[0]+b[0])/2,(a[1]+b[1])/2)
                street,road=min(roads,key=lambda row:row[1].distance(middle))
                distance=road.distance(middle)
                if not 300<distance<2800:continue
                along=((b[0]-a[0])/length,(b[1]-a[1])/length);normal=(along[1],-along[0])
                if occupied.covers(Point(middle.x+normal[0]*15,middle.y+normal[1]*15)):normal=(-normal[0],-normal[1])
                if occupied.covers(Point(middle.x+normal[0]*15,middle.y+normal[1]*15)):continue
                if road.distance(Point(middle.x+normal[0]*100,middle.y+normal[1]*100))>=distance:continue
                def outside(x,y):return(a[0]+along[0]*x+normal[0]*y,a[1]+along[1]*x+normal[1]*y)
                strip=Polygon([outside(4,20),outside(length-4,20),outside(length-4,160),outside(4,160)])
                if occupied.intersection(strip).area>1 or asphalt.intersection(strip).area>1:continue
                start=Point(outside(length/2,160));destination=nearest_points(start,road)[1]
                if LineString([start,destination]).intersects(interior):continue
                wall_height,variation=supported_wall_height(walls,a,b)
                top_trim=wall_height>300 and variation<10
                def p(d,z,out=9):return(a[0]+along[0]*d+normal[0]*out,a[1]+along[1]*d+normal[1]*out,z)
                trim=([(95,9,'Stone')] if wall_height>150 else [])+([(wall_height-48,12,'Cream'),(wall_height-14,10,'Stone')] if top_trim else [])
                for z,radius,mat in trim:
                    rod(p(0,z),p(length,z),radius,mat)
                facades.append({'building':building['id'],'edge':[list(a),list(b)],'height_cm':wall_height,'shell_height_cm':height,
                                'wall_top_variation_cm':variation,'top_trim':top_trim,'normal':list(normal),
                                'outward_clearance_cm':160,'road_sightline':[list(start.coords[0]),list(destination.coords[0])],
                                'street':street,'road_distance_cm':distance,'residential':residential,
                                'source_osm':matched[0] if matched else None,'classification_estimated':matched is None})
    fronts={}
    for f in facades:
        if f['height_cm']<400:continue
        old=fronts.get(f['building'])
        if old is None or math.dist(*f['edge'])>math.dist(*old['edge']):fronts[f['building']]=f

    def door(p,x,base,normal):
        top=max(base+306,366) if base==0 else base+306
        mesh.face([p(x-95,20,base),p(x+95,20,base),p(x+95,20,top),p(x-95,20,top)],'Stone',(*normal,0))
        mesh.face([p(x-49,21,base),p(x+49,21,base),p(x+49,21,base+232),p(x-49,21,base+232)],'Ink',(*normal,0))
        mesh.face([p(x-37,23,base+90),p(x+37,23,base+90),p(x+37,23,base+213),p(x-37,23,base+213)],'Glass',(*normal,0))
        mesh.face([p(x-49,21,base+239),p(x+49,21,base+239),p(x+49,21,base+271),p(x-49,21,base+271)],'Glass',(*normal,0))
        for xx in (x-54,x+54):rod(p(xx,26,base),p(xx,26,base+276),4,'Cream')
        for z in (base+235,base+276):rod(p(x-56,26,z),p(x+56,26,z),5,'Cream')
        rod(p(x+28,30,base+95),p(x+28,30,base+111),2,'Cream')

    def balcony(p,x,z):
        mesh.face([p(x-135,25,z),p(x+135,25,z),p(x+135,145,z),p(x-135,145,z)],'Stone',(0,0,1))
        for xx in (x-135,x+135):
            rod(p(xx,28,z-8),p(xx,145,z-8),5,'Ink')
            rod(p(xx,28,z+100),p(xx,145,z+100),3,'Ink')
            rod(p(xx,145,z),p(xx,145,z+100),3,'Ink')
        for zz in (z+18,z+100):rod(p(x-135,145,zz),p(x+135,145,zz),3,'Ink')
        for xx in range(-120,121,40):rod(p(x+xx,145,z+18),p(x+xx,145,z+100),1.8,'Ink',4)

    entries=0
    for f in fronts.values():
        before={mat:len(faces) for mat,faces in mesh.faces.items()}
        a,b=f['edge'];length=math.dist(a,b);normal=f['normal'];along=((b[0]-a[0])/length,(b[1]-a[1])/length)
        def p(x,y,z):return(a[0]+along[0]*x+normal[0]*y,a[1]+along[1]*x+normal[1]*y,z)
        residential=f['residential'];base=72 if residential and f['road_distance_cm']>1000 else 0
        units=min(3,max(1,int(length/900))) if residential else 1
        shader_seed,uv_walls=municipal_window_data(ROOT/'Data/CityBuildings/Geometry'/f"{f['building']}.obj")
        centers=[bay for unit in range(units) if (bay:=aligned_window_bay(uv_walls,a,b,shader_seed,(unit+.5)*length/units)) is not None]
        if not centers:
            f['artwork_omitted_no_window_bay']=True
            continue
        units=len(centers)
        f['entry']={'estimated':True,'raised_cm':base,'width_cm':108,'stoop_depth_cm':150 if base else 0,'count':units,
                    'shader_seed':shader_seed,'bay_centers':[[x,uv] for x,uv in centers],'surround_width_cm':190}
        f['balconies']=0;f['exterior_stairs']=0
        for unit,(x,uv) in enumerate(centers):
            door(p,x,base,normal);entries+=1
            if base:
                for step in range(4):
                    front=150-step*28;z=(step+1)*18
                    mesh.face([p(x-74,front,z),p(x+74,front,z),p(x+74,25,z),p(x-74,25,z)],'Stone',(0,0,1))
                    mesh.face([p(x-74,front,z-18),p(x+74,front,z-18),p(x+74,front,z),p(x-74,front,z)],'Stone',(*normal,0))
                for xx in (x-70,x+70):
                    rod(p(xx,148,92),p(xx,42,164),3,'Ink',6)
                    for y,z in ((148,0),(42,72)):rod(p(xx,y,z),p(xx,y,z+92),2.5,'Ink',6)
            if not residential or f['road_distance_cm']<1050 or length/units<650 or not 140<=x<=length-140:continue
            floors=[z for z in (392,712,1032) if z+285<f['height_cm']-90]
            for z in floors:door(p,x,z,normal);balcony(p,x,z);f['balconies']+=1
            seed=int(hashlib.sha256(f['building'].encode()).hexdigest()[:8],16)
            stair_allowed=f['street']!='Rue Sherbrooke Est' and (seed+unit)%3!=0
            if not floors or not stair_allowed or x<510 or f['road_distance_cm']<1250:continue
            # A shallow iron flight runs along the facade, outside its shell and
            # inside the existing setback. It changes no walk/drive collision.
            z=floors[0];top=x-110;run=390;steps=22
            for step in range(steps):
                xa=top-run+run*step/steps;xb=top-run+run*(step+1)/steps;zz=z*(step+1)/steps
                mesh.face([p(xa,60,zz),p(xb,60,zz),p(xb,150,zz),p(xa,150,zz)],'Ink',(0,0,1))
                if step%3==0:
                    for y in (60,150):rod(p(xb,y,zz),p(xb,y,zz+95),1.8,'Ink',6)
            for y in (60,150):
                rod(p(top-run,y,0),p(top,y,z-5),4,'Ink',6)
                rod(p(top-run,y,95),p(top,y,z+95),3,'Ink',6)
            f['exterior_stairs']+=1
        added=[point for mat,faces in mesh.faces.items() for face in faces[before.get(mat,0):] for point in face]
        footprint=MultiPoint([point[:2] for point in added]).convex_hull
        if trunks.intersects(footprint):
            for mat,faces in mesh.faces.items():del faces[before.get(mat,0):]
            entries-=units
            for key in ('entry','balconies','exterior_stairs'):f.pop(key)
            f['artwork_omitted_tree_clearance']=True
            continue
        f['artwork_footprint']=[list(point) for point in list(footprint.exterior.coords)[:-1]]
        outward=[(v[0]-a[0])*normal[0]+(v[1]-a[1])*normal[1] for v in added]
        f['outward_extent_cm']=[min(outward),max(outward)]
        assert min(outward)>=20-1.e-6 and max(outward)<=160+1.e-6
        assert occupied.intersection(footprint).area<=1 and asphalt.intersection(footprint).area<=1, 'Facade artwork intrudes into a retained shell or mapped asphalt'
    return facades,entries


def retired_tennis_parts(park,courts):
    """Identify only the original court-center net pieces, retaining court fences/lines."""
    result=[]
    for row in park['details']:
        z=row['position'][2];size=row['size']
        backing=row['mesh']=='Cube' and row['material']=='Ink' and z==60 and size[2]==100
        vertical=row['mesh']=='Cube' and row['material']=='Cream' and z==58 and size==[2,2,95]
        horizontal=row['mesh']=='Cube' and row['material']=='Cream' and z in range(15,111,20) and size[1]==2 and size[2]==2
        post=row['mesh']=='Cylinder' and row['material']=='Ink' and z==60 and size==[12,12,120]
        if not (backing or vertical or horizontal or post):continue
        for court in courts:
            if court['sport']!='tennis':continue
            delta=[row['position'][i]-court['center'][i] for i in (0,1)]
            if backing or horizontal:
                match=math.hypot(*delta)<.1
            else:
                match=abs(sum(delta[i]*court['net_axis'][i] for i in (0,1)))<.1 and math.hypot(*delta)<=court['net_width_cm']/2+26
            if match:result.append(row);break
    return result


def court_artwork(park,ways,points,Mesh):
    from shapely.geometry import Polygon
    surfaces=Mesh();details=Mesh();courts=[]
    tennis=sorted((p for p in park['pitches'] if p['sport']=='tennis'),key=lambda p:int(p['osm']))
    assert len(tennis)==14
    for i,pitch in enumerate(tennis):
        poly=Polygon(pitch['points']).buffer(0);inner=poly.buffer(-25)
        surface='CourtCarpet' if i<7 else 'CourtAcrylic'
        surfaces.face([(x,y,8.5) for x,y in list(poly.exterior.coords)[:-1]],'CourtRunoff',(0,0,1))
        surfaces.face([(x,y,8.7) for x,y in list(inner.exterior.coords)[:-1]],surface,(0,0,1))
        rect=list(poly.minimum_rotated_rectangle.exterior.coords)[:-1]
        length,a,b=max((math.dist(a,b),a,b) for a,b in zip(rect,rect[1:]+rect[:1]))
        axis=((b[0]-a[0])/length,(b[1]-a[1])/length);normal=(-axis[1],axis[0])
        width=min(math.dist(a,b) for a,b in zip(rect,rect[1:]+rect[:1]));center=poly.centroid
        def p(y,z):return(center.x+normal[0]*y,center.y+normal[1]*y,z)
        def top(y):return 91.4+15.3*(2*y/width)**2
        for j in range(math.ceil(width/8)+1):
            y=-width/2+width*j/math.ceil(width/8)
            details.rod(p(y,12),p(y,top(y)),.25,'CourtNet',4)
        for z in range(12,90,8):details.rod(p(-width/2,z),p(width/2,z),.25,'CourtNet',4)
        for j in range(24):
            a=-width/2+width*j/24;b=-width/2+width*(j+1)/24
            details.rod(p(a,top(a)),p(b,top(b)),1.5,'CourtLine',4)
        for y in (-width/2-25,width/2+25):details.rod(p(y,8),p(y,110),3,'CourtPost',8)
        courts.append({'osm':pitch['osm'],'sport':'tennis','surface':surface,'points':pitch['points'],
                       'center':list(poly.centroid.coords[0]),'surface_assignment_estimated':True,
                       'net_axis':list(axis),'net_width_cm':width,'net_cell_cm':8,'net_cord_diameter_cm':.5})
    pitch=next(p for p in park['pitches'] if p['osm']=='311018514')
    poly=Polygon(pitch['points']).buffer(0);rect=list(poly.minimum_rotated_rectangle.exterior.coords)[:-1]
    length,a,b=max((math.dist(a,b),a,b) for a,b in zip(rect,rect[1:]+rect[:1]))
    along=((b[0]-a[0])/length,(b[1]-a[1])/length);normal=(-along[1],along[0])
    width=min(math.dist(a,b) for a,b in zip(rect,rect[1:]+rect[:1]));center=poly.centroid
    surfaces.face([(x,y,8.5) for x,y in list(poly.exterior.coords)[:-1]],'CourtSand',(0,0,1))
    venue={'osm':pitch['osm'],'sport':'beachvolleyball','surface':'CourtSand','points':pitch['points'],
           'center':list(center.coords[0]),'subcourts':[]}
    for index,offset in enumerate((-width/4,width/4)):
        def p(x,y,z):return(center.x+along[0]*x+normal[0]*(y+offset),center.y+along[1]*x+normal[1]*(y+offset),z)
        footprint=[list(p(x,y,0)[:2]) for x,y in ((-800,-400),(800,-400),(800,400),(-800,400))]
        assert poly.covers(Polygon(footprint).buffer(200,join_style=2)), 'Volleyball free zone outside mapped sand'
        for a,b in zip(footprint,footprint[1:]+footprint[:1]):details.rod((*a,11),(*b,11),2.5,'CourtLine',6)
        # Open net cells preserve the view through the court, unlike an opaque bar.
        for y in range(-400,401,40):details.rod(p(0,y,155),p(0,y,243),.8,'CourtNet',4)
        for z in range(155,244,22):details.rod(p(0,-400,z),p(0,400,z),.8,'CourtNet',4)
        details.rod(p(0,-410,243),p(0,410,243),2,'CourtLine',6)
        for y in (-455,455):
            details.rod(p(0,y,8),p(0,y,260),6,'CourtPost',8)
            details.rod(p(0,y,244),p(0,y*.88,243),1.2,'CourtLine',6)
        venue['subcourts'].append({'id':f'311018514-{index+1}','center':list(p(0,0,0)[:2]),'axis':list(along),
                                  'dimensions_cm':[1600,800],'footprint':footprint,'clearance_cm':200,'placement_estimated':True})
    assert not Polygon(venue['subcourts'][0]['footprint']).buffer(200).intersects(Polygon(venue['subcourts'][1]['footprint']).buffer(200))
    courts.append(venue)
    return surfaces,details,courts


def main():
    from prepare_park_comic import Mesh
    from prepare_lafontaine import xy, tags
    from shapely.geometry import Polygon, Point, LineString

    geometry = OUT / 'Geometry'
    geometry.mkdir(parents=True, exist_ok=True)
    park_file = ROOT / 'Data/ParkComic/layout.json'
    city_file = ROOT / 'Data/CityBuildings/manifest.json'
    park = json.loads(park_file.read_text())
    city = json.loads(city_file.read_text())
    source = ET.parse(ROOT / 'Data/LaFontaine/osm.xml').getroot()
    nodes = {e.get('id'): xy(float(e.get('lat')), float(e.get('lon'))) for e in source.findall('node')}
    ways = {e.get('id'): e for e in source.findall('way')}
    points = lambda way: [nodes[e.get('ref')] for e in way.findall('nd')]
    records = [crown_mesh(style,Mesh,variant).save(f'Canopy{style}_{variant}',geometry,smooth=True)
               for style in range(3) for variant in range(1 if style==2 else 4)]
    accents = Mesh()

    # Only added artwork follows the mapped road-facing surveyed shell edges.
    facades,entries=street_architecture(accents,city,ways,points,Polygon(park['park_outline']).buffer(0))
    surfaces,details,courts=court_artwork(park,ways,points,Mesh)
    records.extend((surfaces.save('CourtSurfaces',geometry),details.save('CourtDetails',geometry)))

    # The chalet is a low masonry pavilion with a continuous glazed terrace frontage, not a row house.
    chalet = Polygon(points(ways['27395538'])).buffer(0)
    pond_rings = [points(ways[m.get('ref')]) for relation in source.findall('relation')
                  if tags(relation).get('natural') == 'water' for m in relation.findall('member')
                  if m.get('role') == 'outer' and m.get('ref') in ways]
    shore = [LineString(ring) for ring in pond_rings]
    edges = list(zip(list(chalet.exterior.coords), list(chalet.exterior.coords)[1:]))
    for a, b in edges:
        length = math.dist(a, b)
        if length < 650: continue
        along = ((b[0]-a[0])/length, (b[1]-a[1])/length)
        normal = (along[1], -along[0]);mid = ((a[0]+b[0])/2,(a[1]+b[1])/2)
        if chalet.covers(Point(mid[0]+normal[0]*10,mid[1]+normal[1]*10)): normal=(-normal[0],-normal[1])
        # Keep the terrace-side treatment on the pond-facing edges.
        if min(s.distance(Point(mid[0]+normal[0]*100,mid[1]+normal[1]*100)) for s in shore) >= min(s.distance(Point(mid)) for s in shore): continue
        def p(d,z,out=12):return (a[0]+along[0]*d+normal[0]*out,a[1]+along[1]*d+normal[1]*out,z)
        accents.face([p(25,90),p(length-25,90),p(length-25,380),p(25,380)],'Glass',(*normal,0))
        for d in range(40,int(length),155): accents.rod(p(d,90,18),p(d,385,18),5,'Cream')
        for z in (90,260,385): accents.rod(p(15,z,18),p(length-15,z,18),6,'Cream')
        accents.rod(p(0,450,45),p(length,450,45),22,'Roof')
    # Thin dark fascia and paired slender perimeter posts better describe the modern theatre frame.
    stage = Polygon(points(ways['433686251'])).buffer(0)
    rect = list(stage.minimum_rotated_rectangle.exterior.coords)[:-1]
    length,a,b = max((math.dist(a,b),a,b) for a,b in zip(rect,rect[1:]+rect[:1]))
    along=((b[0]-a[0])/length,(b[1]-a[1])/length);normal=(-along[1],along[0])
    width=min(math.dist(a,b) for a,b in zip(rect,rect[1:]+rect[:1]));c=stage.centroid
    def stage_point(x,y,z):return (c.x+along[0]*x+normal[0]*y,c.y+along[1]*x+normal[1]*y,z)
    roof=[stage_point(-length/2-80,-width/2-80,600),stage_point(length/2+80,-width/2-80,600),
          stage_point(length/2+80,width/2+80,675),stage_point(-length/2-80,width/2+80,675)]
    for a,b in zip(roof,roof[1:]+roof[:1]): accents.rod(a,b,12,'Roof')
    for x in (-length/2,length/2):
        for y in (-width/2,width/2):
            for offset in (-35,35): accents.rod(stage_point(x+offset,y,55),stage_point(x+offset,y,600 if y<0 else 675),5,'Roof')
    records.append(accents.save('ArchitectureAccents', geometry))
    result={'models':records,'palette':PALETTE,'leaf_colors':LEAF_COLORS,'sherbrooke_facades':[f for f in facades if f['street']=='Rue Sherbrooke Est'],
            'street_facades':facades,'entries':entries,'courts':courts,
            'source_wall_sha256':{ident:hashlib.sha256((ROOT/'Data/CityBuildings/Geometry'/f'{ident}.obj').read_bytes()).hexdigest()
                                  for ident in sorted({f['building'] for f in facades})},
            'source_sha256':{'park':hashlib.sha256(park_file.read_bytes()).hexdigest(),
                             'city':hashlib.sha256(city_file.read_bytes()).hexdigest(),
                             'district':hashlib.sha256((ROOT/'Data/LaFontaine/layout.json').read_bytes()).hexdigest(),
                             'osm':hashlib.sha256((ROOT/'Data/LaFontaine/osm.xml').read_bytes()).hexdigest()},
            'references':[
                {'url':'https://montreal.ca/en/places/parc-la-fontaine-tennis-and-pickleball-courts','use':'14 courts, seven synthetic carpet/seven acrylic; row material assignment is estimated'},
                {'url':'https://montreal.ca/en/places/beach-volleyball-courts-parc-la-fontaine','use':'two sand courts at one3500Emile-Duploye venue; individual layout within mapped sand is estimated'},
                {'url':'https://montreal.ca/en/places/parc-la-fontaine','use':'park amenities and current fountain limitation'},
                {'url':'https://ville.montreal.qc.ca/pls/portal/docs/PAGE/CONS_PAT_MTL_FR/MEDIA/DOCUMENTS/GUIDE%20PARC%20LA%20FONTAINE_DEPT_CPM_15JUIN2012.PDF','use':'two ponds, mature canopy and chalet context'},
                {'url':'https://ocpm.qc.ca/sites/default/files/pdf/P37/6.10_25_EVALUATION_PATRIMOINE_VILLE-MARIE.pdf','use':'Sherbrooke three-storey house alignment and institutional landmarks'},
                {'url':'https://lemay.com/projects/theatre-de-verdure/','use':'2022 lightweight open theatre frame'},
                {'url':'https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng','use':'chalet cultural cafe and terrace'}],
            'limits':'Crown height/width, early-autumn colours, masonry styles, residential classifications without OSM tags and facade/balcony/stair accents are authored estimates. Tennis material row assignment and two volleyball subcourt placements within the retained sand envelope are estimated, not individually surveyed. Surveyed shells/roof photos, inventory XY, ponds, paths and gameplay placement are unchanged. No reference photographs are copied into game assets.'}
    assert all(any(f['street']==street and f.get('entry') for f in facades) for street in STREETS), 'Missing valid park-perimeter frontage'
    (OUT/'layout.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('NORD_ENVIRONMENT_PREPARED',len(facades),'survey-aligned facade edges',len(park['trees']),'inventory trees')


if __name__ == '__main__': main()
