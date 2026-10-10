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
           'Glass': (.065, .12, .135), 'Ink': (.025, .035, .032), 'Roof': (.095, .12, .105)}


def tree_profile(tree):
    """Inventory diameter and species are evidence; crown dimensions/season remain estimates."""
    seed = tree['seed']
    diameter = tree['diameter_cm']
    conifer = tree['style'] == 2
    color = 0 if conifer else (2 if 'rubrum' in tree['species'] or 'rubra' in tree['species'] else
                              (1 if seed % 10 < 3 else (3 if seed % 10 < 6 else 0)))
    height=min(2600., 650. + math.sqrt(diameter) * 175.)
    radius=min(1000., 180. + diameter * (4. if conifer else 7.))
    if not conifer:radius=max(radius,height*.34)
    return {'height':height,'radius':radius,'variant':0 if conifer else (seed//11)%3,
            'color':color,'yaw':seed%360,'width_ratio':.86+(seed%17)/100.}


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
    """Blend asymmetric bough clusters into irregular, branching crowns with open gaps."""
    import numpy as np
    mesh=Mesh();clusters=[];branches=[]
    count=6 if style==0 else 7
    phase=.39*variant+.22*style
    for i in range(count):
        angle=math.tau*i/count+phase+.16*math.sin(i*2.7+variant)
        radius=(330 if style==0 else 410)*(1+.18*math.sin(i*1.9+variant))
        z=(690 if style==0 else 735)+75*math.sin(i*2.3+variant)
        center=(math.cos(angle)*radius,math.sin(angle)*radius,z)
        size=(235+30*math.sin(i+variant),210+35*math.cos(i*1.4),170 if style==0 else 125)
        clusters.append((center,size))
        branches.append(((15*math.sin(i),12*math.cos(i),355+30*(i%3)),center))
        # Unequal leaf-bearing tips break the perimeter instead of repeating one balloon.
        tip=(center[0]+math.cos(angle+.4)*130,center[1]+math.sin(angle+.4)*130,z+35*math.cos(i))
        clusters.append((tip,(135,115,105)))
        branches.append(((center[0]*.65,center[1]*.65,z-110),tip))
    for i in range(3):
        angle=phase+i*2.2
        clusters.append(((math.cos(angle)*130+35*variant,math.sin(angle)*160,835+45*math.sin(i+variant)),(190,175,145)))
    centers=np.array([p for p,s in clusters]);sizes=np.array([s for p,s in clusters])
    # Soft volumetric union removes the hard internal sphere seams. Low boughs and
    # asymmetric tips leave sky gaps around the supporting forks and between limbs.
    def field(points):
        values=np.zeros(len(points))
        for center,size in zip(centers,sizes):
            q=(points-center)/size
            values+=np.exp(-1.7*np.sum(q*q,axis=1))
        values*=1+.12*np.sin(points[:,0]*.027+variant)*np.cos(points[:,1]*.023)*np.sin(points[:,2]*.031)
        return values-.46
    step=48.
    xs=np.arange(-800,849,step);ys=np.arange(-800,849,step);zs=np.arange(390,1063,step)
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
    # Forks reach into each actual cluster; no floating foliage balls.
    mesh.rod((0,0,240),(15,-8,460),19,'Wood')
    for i,(a,b) in enumerate(branches):
        middle=tuple(np.array(a)*.48+np.array(b)*.52-np.array((0,0,45)))
        mesh.rod(a,middle,11 if i%2==0 else 6,'Wood',6)
        mesh.rod(middle,b,7 if i%2==0 else 4,'Wood',6)
    return mesh


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
               for style in range(3) for variant in range(1 if style==2 else 3)]
    accents = Mesh()

    # Reuse the actual Sherbrooke alignment and surveyed exterior edges; no footprint or roof edits.
    roads = [LineString(points(w)) for w in ways.values() if tags(w).get('name') == 'Rue Sherbrooke Est']
    assert roads, 'Mapped Sherbrooke alignment is required'
    facades = []
    for building in city['buildings']:
        height = building['height_cm']
        if not 600 < height < 1800: continue
        center = Point(building['center'])
        if min(road.distance(center) for road in roads) > 4200: continue
        for ring in building['footprints']:
            poly = Polygon(ring).buffer(0).simplify(18., preserve_topology=True)
            if poly.geom_type != 'Polygon': continue
            coords = list(poly.exterior.coords)
            for a, b in zip(coords, coords[1:]):
                length = math.dist(a, b)
                if length < 350: continue
                middle = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                road = min(roads, key=lambda r: r.distance(middle))
                if not 250 < road.distance(middle) < 2400: continue
                along = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
                normal = (along[1], -along[0])
                if poly.covers(Point(middle.x + normal[0] * 15, middle.y + normal[1] * 15)):
                    normal = (-normal[0], -normal[1])
                if road.distance(Point(middle.x + normal[0] * 100, middle.y + normal[1] * 100)) >= road.distance(middle): continue
                def p(distance, z, outward=9):
                    return (a[0] + along[0] * distance + normal[0] * outward,
                            a[1] + along[1] * distance + normal[1] * outward, z)
                for z, radius, mat in ((95, 10, 'Stone'), (height - 38, 16, 'Cream'), (height - 12, 11, 'Stone')):
                    accents.rod(p(0, z), p(length, z), radius, mat)
                facades.append({'building':building['id'],'edge':[list(a),list(b)],'height_cm':height,
                                'normal':list(normal),'road_distance_cm':road.distance(middle)})

    # One plausible entry per selected house/apartment shell gives the raised
    # Montreal basement a doorway, transom and short stoop without inventing a
    # full surveyed facade. Wide institutional frontages receive ground entries.
    entries={}
    for facade in facades:
        old=entries.get(facade['building'])
        if old is None or math.dist(*facade['edge'])>math.dist(*old['edge']):entries[facade['building']]=facade
    for facade in entries.values():
        a,b=facade['edge'];length=math.dist(a,b);normal=facade['normal']
        along=((b[0]-a[0])/length,(b[1]-a[1])/length)
        center=((a[0]+b[0])/2,(a[1]+b[1])/2)
        def door_point(x,y,z):return (center[0]+along[0]*x+normal[0]*y,center[1]+along[1]*x+normal[1]*y,z)
        raised=length<2600 and facade['road_distance_cm']>550
        base=72 if raised else 0
        accents.face([door_point(-49,21,base),door_point(49,21,base),door_point(49,21,base+232),door_point(-49,21,base+232)],'Ink',(*normal,0))
        accents.face([door_point(-37,23,base+90),door_point(37,23,base+90),door_point(37,23,base+213),door_point(-37,23,base+213)],'Glass',(*normal,0))
        accents.face([door_point(-49,21,base+239),door_point(49,21,base+239),door_point(49,21,base+271),door_point(-49,21,base+271)],'Glass',(*normal,0))
        for x in (-54,54):accents.rod(door_point(x,26,base),door_point(x,26,base+276),4,'Cream')
        for z in (base+235,base+276):accents.rod(door_point(-56,26,z),door_point(56,26,z),5,'Cream')
        accents.rod(door_point(28,30,base+95),door_point(28,30,base+111),2,'Cream')
        if raised:
            # Four 18 cm risers, with shallow solid treads kept clear of the road.
            for step in range(4):
                front=150-step*28;height=(step+1)*18
                left=door_point(-74,front,height);right=door_point(74,front,height)
                back_left=door_point(-74,25,height);back_right=door_point(74,25,height)
                accents.face([left,right,back_right,back_left],'Stone',(0,0,1))
                accents.face([door_point(-74,front,height-18),door_point(74,front,height-18),right,left],'Stone',(*normal,0))
                for side in (-1,1):
                    x=side*74
                    accents.face([door_point(x,front,0),door_point(x,front,height),door_point(x,25,height),door_point(x,25,0)],'Stone',(along[0]*side,along[1]*side,0))
            for x in (-70,70):
                for y,z in ((148,0),(42,72)):accents.rod(door_point(x,y,z),door_point(x,y,z+92),2.5,'Ink',6)
                accents.rod(door_point(x,148,92),door_point(x,42,164),3,'Ink',6)
                accents.rod(door_point(x,148,55),door_point(x,42,127),2,'Ink',6)
        facade['entry']={'estimated':True,'raised_cm':base,'width_cm':108,'stoop_depth_cm':150 if raised else 0}

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
    result={'models':records,'palette':PALETTE,'leaf_colors':LEAF_COLORS,'sherbrooke_facades':facades,'entries':len(entries),
            'source_sha256':{'park':hashlib.sha256(park_file.read_bytes()).hexdigest(),
                             'city':hashlib.sha256(city_file.read_bytes()).hexdigest()},
            'references':[
                {'url':'https://montreal.ca/en/places/parc-la-fontaine','use':'park amenities and current fountain limitation'},
                {'url':'https://ville.montreal.qc.ca/pls/portal/docs/PAGE/CONS_PAT_MTL_FR/MEDIA/DOCUMENTS/GUIDE%20PARC%20LA%20FONTAINE_DEPT_CPM_15JUIN2012.PDF','use':'two ponds, mature canopy and chalet context'},
                {'url':'https://ocpm.qc.ca/sites/default/files/pdf/P37/6.10_25_EVALUATION_PATRIMOINE_VILLE-MARIE.pdf','use':'Sherbrooke three-storey house alignment and institutional landmarks'},
                {'url':'https://lemay.com/projects/theatre-de-verdure/','use':'2022 lightweight open theatre frame'},
                {'url':'https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng','use':'chalet cultural cafe and terrace'}],
            'limits':'Crown height/width, early-autumn colours, masonry styles and facade accents are authored estimates. Surveyed shells/roof photos, inventory XY, ponds, paths and gameplay placement are unchanged. No reference photographs are copied into game assets.'}
    assert len(facades)>20, 'Missing Sherbrooke fronts'
    (OUT/'layout.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('NORD_ENVIRONMENT_PREPARED',len(facades),'survey-aligned facade edges',len(park['trees']),'inventory trees')


if __name__ == '__main__': main()
