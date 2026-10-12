"""Build metre-accurate local geometry from the checked-in OSM snapshot (ODbL)."""
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'Data/LaFontaine'
ORIGIN = (45.525, -73.5699)
BOUNDS = (45.5208, -73.5755, 45.5312, -73.5628)
ROAD_HIGHWAYS = ('residential','tertiary','secondary','primary','service','unclassified','living_street')


def xy(lat, lon):
    return ((lon - ORIGIN[1]) * 111320 * math.cos(math.radians(ORIGIN[0])) * 100,
            (lat - ORIGIN[0]) * 111320 * 100)


def tags(e):
    return {t.get('k'): t.get('v') for t in e.findall('tag')}


def inside(p):
    return BOUNDS[0] <= p[0] <= BOUNDS[2] and BOUNDS[1] <= p[1] <= BOUNDS[3]


def road_width_cm(road_tags):
    """The illustrated road strip width, matching the existing geometry formula."""
    width=max(400,min(float(road_tags.get('lanes','2').split(';')[0])*310,1400))
    return 380 if road_tags.get('highway')=='service' else width


def road_width(road_tags):
    """Width for Plateau context streets; leave the Warden traffic graph unchanged."""
    highway = road_tags.get('highway')
    fallback = 380 if highway == 'service' else 230 if highway in (
        'footway', 'path', 'cycleway', 'pedestrian', 'steps') else 680
    try:
        if 'width' in road_tags:
            return max(100, min(2400, float(road_tags['width'].split()[0]) * 100))
        lanes = float(road_tags.get('lanes', '2').split(';')[0])
        return max(680, min(1400, lanes * 310)) if fallback == 680 else fallback
    except ValueError:
        return fallback


def clip_segment(a, b, bounds=None):
    """Clip a crossing Plateau street to the district rectangle in centimetres."""
    if bounds is None:
        lo, hi = xy(BOUNDS[0], BOUNDS[1]), xy(BOUNDS[2], BOUNDS[3])
        bounds = (*lo, *hi)
    low, high = 0., 1.
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in [(-dx, a[0] - bounds[0]), (dx, bounds[2] - a[0]),
                 (-dy, a[1] - bounds[1]), (dy, bounds[3] - a[1])]:
        if abs(p) < 1e-9:
            if q < 0:
                return None
        elif p < 0:
            low = max(low, q / p)
        else:
            high = min(high, q / p)
        if low > high:
            return None
    if math.hypot(dx, dy) * (high - low) < 1:
        return None
    return [(a[0] + dx * low, a[1] + dy * low),
            (a[0] + dx * high, a[1] + dy * high)]


def source_road_metadata():
    """Return road polylines and widths in the original OSM way/segment order."""
    root=ET.parse(DATA/'osm.xml').getroot()
    nodes={e.get('id'):(float(e.get('lat')),float(e.get('lon'))) for e in root.findall('node')}
    roads=[];widths=[]
    for way in root.findall('way'):
        refs=[nodes[n.get('ref')] for n in way.findall('nd') if n.get('ref') in nodes]
        if len(refs)<2 or not all(inside(p) for p in refs):continue
        road_tags=tags(way)
        if road_tags.get('highway') not in ROAD_HIGHWAYS:continue
        roads.append([list(xy(*point)) for point in refs]);widths.append(road_width_cm(road_tags))
    return roads,widths


def road_segments_text(roads):
    vec=lambda p:'FVector('+','.join(f'{v:.3f}' for v in p)+')'
    return 'const FVector RoadSegments[][2] = {\n'+',\n'.join('{'+vec([*a,0])+','+vec([*b,0])+'}' for road in roads for a,b in zip(road,road[1:]))+'\n};\n'


def road_widths_text(roads,widths):
    assert len(roads)==len(widths)
    values=[width for road,width in zip(roads,widths) for a,b in zip(road,road[1:])]
    return 'const float RoadSegmentWidths[] = {\n'+','.join(f'{width:.3f}f' for width in values)+'\n};\n'


def update_road_width_metadata():
    """Add width metadata without regenerating any geometry or gameplay placement."""
    layout_path=DATA/'layout.json';layout_text=layout_path.read_text();data=json.loads(layout_text)
    roads,widths=source_road_metadata()
    assert roads==data['roads'], 'OSM road ordering/coordinates changed; metadata-only update refused'
    header_path=ROOT/'Source/Quebec/LaFontaineMap.h';header=header_path.read_text()
    assert road_segments_text(roads) in header, 'Header road rows do not match the current source'
    array=road_widths_text(roads,widths)
    if 'const float RoadSegmentWidths[]' in header:
        header,count=re.subn(r'const float RoadSegmentWidths\[\] = \{\n[^}]*\};\n',lambda _:array,header)
        assert count==1
    else:
        assert header.endswith('}\n')
        header=header[:-2]+array+'}\n'
    if 'road_widths' in data:
        assert data['road_widths']==widths
    else:
        end=layout_text.rfind('}')
        layout_path.write_text(layout_text[:end]+', "road_widths": '+json.dumps(widths)+layout_text[end:])
    header_path.write_text(header)
    print('NORD_ROAD_WIDTHS_READY',len(roads),'roads',sum(len(r)-1 for r in roads),'segment widths')


def nearest(point, lines):
    best = None
    for line in lines:
        for a, b in zip(line, line[1:]):
            dx, dy = b[0]-a[0], b[1]-a[1]
            if dx*dx+dy*dy < 1: continue
            t = max(0, min(1, ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)))
            p = (a[0]+t*dx,a[1]+t*dy)
            item = (math.dist(point,p), p, math.degrees(math.atan2(dy,dx)))
            if best is None or item[0] < best[0]: best = item
    assert best is not None
    return best[1:]


def main():
    root = ET.parse(DATA / 'osm.xml').getroot()
    nodes = {e.get('id'): (float(e.get('lat')),float(e.get('lon'))) for e in root.findall('node')}
    ways = {e.get('id'): e for e in root.findall('way')}
    groups = {}
    city_path = ROOT/'Data/CityBuildings/manifest.json'
    surveyed = None
    replaced = 0
    if city_path.exists():
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
        surveyed = unary_union([Polygon(p).buffer(0) for b in json.loads(city_path.read_text())['buildings'] for p in b['footprints']])
    park_shape=None
    park_path=ROOT/'Data/ParkComic/layout.json'
    if park_path.exists():
        from shapely.geometry import Polygon
        park_shape=Polygon(json.loads(park_path.read_text())['park_outline']).buffer(0)
    def face(mat, points):
        if len(points)>=3: groups.setdefault(mat,[]).append(points)
    def polygon(mat, points, z):
        p=list(points)
        if len(p)>1 and p[0]==p[-1]: p.pop()
        area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1]))
        if area<0: p.reverse()
        face(mat, [(x,y,z) for x,y in p])
    def strip(mat, a,b,width,z):
        dx,dy=b[0]-a[0],b[1]-a[1]; length=math.hypot(dx,dy)
        if length<1:return
        nx,ny=-dy/length*width/2,dx/length*width/2
        polygon(mat,[(a[0]+nx,a[1]+ny),(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny)],z)
    def points(e): return [xy(*nodes[n.get('ref')]) for n in e.findall('nd') if n.get('ref') in nodes]
    roads=[];road_widths=[]; paths=[]; road_names=set(); counts={'buildings':0,'roads':0,'paths':0,'trees':0,'ponds':0}
    for ident,e in ways.items():
        refs=[nodes[n.get('ref')] for n in e.findall('nd') if n.get('ref') in nodes]
        if not refs or not all(inside(p) for p in refs): continue
        t=tags(e); p=points(e)
        if t.get('leisure')=='park': polygon('Grass',p,2)
        if t.get('leisure') in ('pitch','playground','dog_park'):
            polygon('Court' if t.get('leisure')=='pitch' else 'Path',p,4)
        h=t.get('highway')
        if h and len(p)>1:
            isroad=h in ROAD_HIGHWAYS
            if not isroad and h not in ('footway','path','cycleway','pedestrian','steps'):continue
            width=road_width_cm(t) if isroad else 230
            for a,b in zip(p,p[1:]):
                strip('Road' if isroad else 'Path',a,b,width,6 if isroad else 5)
                if isroad and h!='service':
                    length=math.dist(a,b)
                    for d in range(0,int(length)-180,650):
                        q=lambda v:(a[0]+(b[0]-a[0])*v/length,a[1]+(b[1]-a[1])*v/length)
                        strip('Marking',q(d),q(d+180),10,8)
            (roads if isroad else paths).append(p)
            if isroad:road_widths.append(width)
            counts['roads' if isroad else 'paths']+=1
            if isroad and t.get('name'):road_names.add(t['name'])
        if 'building' in t and len(p)>3 and p[0]==p[-1]:
            if ident in ('27395538','27394465','433686251') and (ROOT/'Data/ParkComic/layout.json').exists():
                counts['buildings'] += 1
                continue  # Mapped landmark models replace these generic extrusions.
            if surveyed is not None:
                footprint = Polygon(p).buffer(0)
                if footprint.area and footprint.intersection(surveyed).area / footprint.area > .5:
                    counts['buildings'] += 1
                    replaced += 1
                    continue
            # shortcut: unmeasured small park/service buildings use one storey; other buildings use three.
            small_park=park_shape is not None and Polygon(p).area<1000000 and park_shape.covers(Polygon(p))
            levels=1 if small_park or t.get('building') in ('shed','roof','service','garage') else 3
            try: height=float(t.get('height',str(float(t.get('building:levels',levels))*3.2)).split()[0])*100
            except ValueError: height=levels*320
            height=max(250,min(height,6000)); p=p[:-1]
            area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1]))
            if area<0:p.reverse()
            wall=('Brick','Cream','Sage')[int(ident)%3]
            polygon('Roof',p,height)
            for a,b in zip(p,p[1:]+p[:1]):
                face(wall,[(a[0],a[1],0),(b[0],b[1],0),(b[0],b[1],height),(a[0],a[1],height)])
                dx,dy=b[0]-a[0],b[1]-a[1]; length=math.hypot(dx,dy)
                if length<250:continue
                nx,ny=dy/length*3,-dx/length*3
                for z in range(180,int(height)-140,310):
                    for d in range(100,int(length)-180,300):
                        q=lambda v:(a[0]+dx*v/length+nx,a[1]+dy*v/length+ny)
                        l,r=q(d),q(d+130)
                        face('Glass',[(l[0],l[1],z),(r[0],r[1],z),(r[0],r[1],z+160),(l[0],l[1],z+160)])
            counts['buildings']+=1
    # Assemble relation outer rings; islands remain visible as a raised grass cap.
    for e in root.findall('relation'):
        if tags(e).get('natural')!='water':continue
        remaining=[points(ways[m.get('ref')]) for m in e.findall('member') if m.get('role')=='outer' and m.get('ref') in ways]
        while remaining:
            ring=remaining.pop(0)
            while ring[-1]!=ring[0]:
                match=next(((i,p if p[0]==ring[-1] else p[::-1]) for i,p in enumerate(remaining) if p[0]==ring[-1] or p[-1]==ring[-1]),None)
                assert match,'Incomplete pond ring'
                i,p=match;remaining.pop(i);ring+=p[1:]
            polygon('Water',ring,7);counts['ponds']+=1
        for m in e.findall('member'):
            if m.get('role')=='inner':polygon('Grass',points(ways[m.get('ref')]),9)
    for e in root.findall('node'):
        if tags(e).get('natural')!='tree' or not inside(nodes[e.get('id')]):continue
        x,y=xy(*nodes[e.get('id')]); seed=int(e.get('id'));height=650+seed%500;radius=220+seed%170
        # Low-poly trees retain surveyed positions; species/crown shapes are illustrative.
        for mat,z,r in [('Wood',0,22),('Canopy',height*.38,radius)]:
            if mat=='Canopy' and math.dist((x,y),xy(45.5242984,-73.5647429))<14000:continue
            top=height*.7 if mat=='Wood' else height
            ring=[(x+math.cos(i*math.tau/6)*r,y+math.sin(i*math.tau/6)*r) for i in range(6)]
            for a,b in zip(ring,ring[1:]+ring[:1]):
                if mat=='Wood':face('HiddenTrunks' if math.dist((x,y),xy(45.5242984,-73.5647429))<14000 else mat,[(a[0],a[1],z),(b[0],b[1],z),(b[0],b[1],top),(a[0],a[1],top)])
                else:
                    # Broadleaf crowns: a low-poly ellipsoid, not conifer cones.
                    upper_a=(x+(a[0]-x)*.65,y+(a[1]-y)*.65,top-100)
                    upper_b=(x+(b[0]-x)*.65,y+(b[1]-y)*.65,top-100)
                    lower_a=(a[0],a[1],z+160);lower_b=(b[0],b[1],z+160)
                    crown=('Canopy','CanopyGold','CanopyRust')[seed%3]
                    face(crown,[lower_a,lower_b,upper_b,upper_a])
                    face(crown,[upper_a,upper_b,(x,y,top)])
                    face(crown,[(x,y,z),lower_b,lower_a])
        counts['trees']+=1
    address=xy(*nodes['11972684994'])
    spawn,_=nearest(address,paths)
    car,yaw=nearest(spawn,roads)
    landmarks=[xy(45.5247,-73.5683),xy(45.5254601,-73.5711498),xy(45.5288,-73.569)]
    missions=[[*nearest(p,paths)[0],110] for p in landmarks]
    data={'origin':ORIGIN,'bounds':BOUNDS,'address':'1334 Rue Sherbrooke Est','address_xy':address,
          'spawn':[*spawn,120],'car':[*car,115],'car_yaw':yaw,'missions':missions,'roads':roads,'road_widths':road_widths,'counts':counts,'surveyed_replacements':replaced,'street_names':sorted(road_names),'detailed_trees':[[*xy(*nodes[e.get('id')]),int(e.get('id'))] for e in root.findall('node') if tags(e).get('natural')=='tree' and inside(nodes[e.get('id')]) and math.dist(xy(*nodes[e.get('id')]),address)<14000]}
    assert counts['ponds']==2 and counts['buildings']>100 and counts['roads']>50 and counts['trees']>100
    assert math.dist(address,spawn)<3000,'Spawn too far from address'
    (DATA/'layout.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    out=DATA/'Geometry';out.mkdir(exist_ok=True)
    for mat,faces in groups.items():
        with (out/(mat+'.obj')).open('w') as f:
            f.write('o '+mat+'\n');index=1
            for poly in faces:
                for x,y,z in poly:f.write(f'v {x:.3f} {-y:.3f} {z:.3f}\n')
                horizontal=max(p[2] for p in poly)-min(p[2] for p in poly)<1
                edge=(poly[1][0]-poly[0][0],poly[1][1]-poly[0][1]);length=math.hypot(*edge) or 1
                for x,y,z in poly:
                    uv=(x/300,y/300) if horizontal else ((x*edge[0]+y*edge[1])/length/300,z/300)
                    f.write(f'vt {uv[0]:.5f} {uv[1]:.5f}\n')
                f.write('f '+' '.join(f'{index+i}/{index+i}' for i in reversed(range(len(poly))))+'\n');index+=len(poly)
    def vec(p):return 'FVector('+','.join(f'{v:.3f}' for v in p)+')'
    header='// Generated by Scripts/prepare_lafontaine.py. OSM contributors, ODbL 1.0.\n#pragma once\nnamespace LaFontaine {\n'
    header+='const FVector Spawn='+vec(data['spawn'])+';\nconst FVector CarSpawn='+vec(data['car'])+';\n'
    header+='const FVector Missions[] = {'+','.join(vec(p) for p in missions)+'};\n'
    header+=road_segments_text(roads)+road_widths_text(roads,road_widths)+'}\n'
    (ROOT/'Source/Quebec/LaFontaineMap.h').write_text(header)
    print(json.dumps({**counts,'spawn':data['spawn'],'car':data['car'],'yaw':yaw},indent=2))

if __name__=='__main__':
    if '--road-widths-only' in sys.argv:update_road_width_metadata()
    else:main()
