"""Original thin architectural dressing on the retained Toronto landmark footprint."""
import hashlib
import json
import math
from pathlib import Path

from plateau_mesh import Mesh

ROOT=Path(__file__).resolve().parents[1]
RELATIVE=Path('Data/CollegeBathurst/SneakyDees')
MATERIALS={'Stone':'Limestone','Cladding':'White','Brick':'BrickRed','Ink':'InteriorDark',
           'Blue':'SignBlue','Red':'SignRed','Gold':'Yellow','Glazing':'CarGlass'}
MAX_PROJECTION_CM=25
SOURCES=[
    {'url':'https://www.sneakydees.com/','use':'431 College; exterior finish reference only, photograph not copied'},
    {'url':'https://www.toronto.ca/legdocs/mmis/2026/te/bgrd/backgroundfile-286881.pdf',
     'use':'pages 2–3: existing two-storey venue block and public laneway; proposed tower excluded'},
    {'url':'https://www.toronto.ca/services-payments/streets-parking-transportation/cycling-in-toronto/cycling-infrastructure-definitions/college-street-upgrades/',
     'use':'completed cycle tracks and retained Bathurst islands; street geometry is a later layer'},
]
# Original single-line display lettering, not a traced venue logo or borrowed font.
GLYPHS={
    'S':[[(.9,1),(.2,1),(0,.8),(.1,.6),(.8,.4),(1,.2),(.8,0),(0,0)]],
    'N':[[(0,0),(0,1),(1,0),(1,1)]],
    'E':[[(1,1),(0,1),(0,0),(1,0)],[(0,.5),(.8,.5)]],
    'A':[[(0,0),(.5,1),(1,0)],[(.2,.4),(.8,.4)]],
    'K':[[(0,0),(0,1)],[(1,1),(0,.48),(1,0)]],
    'Y':[[(0,1),(.5,.5),(1,1)],[(.5,.5),(.5,0)]],
    'D':[[(0,0),(0,1),(.55,1),(1,.78),(1,.22),(.55,0),(0,0)]],
    "'": [[(.4,1),(.2,.75)]],
}
TEXT="SNEAKY DEE'S"


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def edges(layout):
    from shapely.geometry import LineString, Point, Polygon
    landmark=layout['landmarks']['sneaky_dees']
    points=landmark['footprint']
    assert landmark['osm']=='way/678313322' and 650<landmark['height']<900
    assert Polygon(points).is_valid and Polygon(points).exterior.is_ccw
    fronts=[]
    for index,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
        width=math.dist(a,b)
        tangent=[(b[i]-a[i])/width for i in (0,1)]
        fronts.append({'index':index,'a':a,'b':b,'width_cm':width,'tangent':tangent,
                       'normal':[tangent[1],-tangent[0]]})
    college=next(front for front in fronts if front['a']==landmark['college_face'][0]
                 and front['b']==landmark['college_face'][1])
    bathurst_lines=[LineString(line) for line,name in zip(layout['roads'],layout['road_names']) if name=='Bathurst Street']
    candidates=[]
    for front in fronts:
        mid=Point([(front['a'][i]+front['b'][i])/2 for i in (0,1)])
        street=min(bathurst_lines,key=mid.distance)
        q=street.interpolate(street.project(mid))
        toward=[q.x-mid.x,q.y-mid.y]
        facing=sum(toward[i]*front['normal'][i] for i in (0,1))
        if facing>mid.distance(street)*.9 and front['width_cm']>1000:
            candidates.append(front)
    bathurst=max(candidates,key=lambda front:front['width_cm'])
    corner=next(front for front in fronts if front['a']==college['b'] and front['b']==bathurst['a'])
    assert 500<college['width_cm']<1000 and 2500<bathurst['width_cm']<4000 and corner['width_cm']<400
    return [dict(college,name='College'),dict(corner,name='Corner'),dict(bathurst,name='Bathurst')]


def build(layout=None):
    from shapely.geometry import LineString, MultiPoint, Point, Polygon
    from shapely.ops import unary_union
    layout=layout or json.loads((ROOT/'Data/CollegeBathurst/layout.json').read_text())
    landmark=layout['landmarks']['sneaky_dees']
    height=landmark['height']
    fronts=edges(layout)
    mesh=Mesh()
    signs=[]
    counts={'upper_windows':0,'ground_windows':0,'estimated_doors':0,'letter_strokes':0}
    for front in fronts:
        width=front['width_cm']
        a,tangent,normal=front['a'],front['tangent'],front['normal']
        yaw=math.degrees(math.atan2(tangent[1],tangent[0]))

        def point(x,out,z):
            return tuple(a[i]+tangent[i]*x+normal[i]*out for i in (0,1))+(z,)

        def box(material,x,out,z,length,depth,tall):
            mesh.box(material,point(x,out,z),(length,depth,tall),yaw)

        # These continuous opaque skins sit beyond the old 3 cm glass cards. No source glass is hidden.
        box('Stone',width/2,6,165,width,8,330)
        box('Cladding',width/2,6,(height+330)/2,width,8,height-330)
        for z in range(460,int(height)-10,28):
            box('Stone',width/2,10.8,z,width,1.2,1.8)
        box('Ink',width/2,15,390,width,10,116)
        box('Gold',width/2,21,443,width,2,6)
        box('Ink',width/2,12,height-7,width,8,14)
        for index in range(max(1,int(width/200))):
            left=index*200
            length=min(180,width-left)
            box(('Blue','Red','Gold')[index%3],left+length/2,21,341,length,2,12)
        if front['name']=='Corner':
            # A continuous coloured return follows the surveyed chamfer; nothing projects into the walking lane.
            for x in (width*.25,width*.5,width*.75):
                box('Gold',x,21,390,8,2,65)
            continue
        bays=max(2,round(width/450))
        pitch=width/bays
        for index in range(bays+1):
            x=min(width-9,max(9,index*pitch))
            box('Brick',x,12,(height+451)/2,18,8,height-451)
        for index in range(bays):
            x=(index+.5)*pitch
            pane=pitch-52
            box('Ink',x,14,616,pane+12,8,190)
            box(('Gold','Red','Blue')[index%3],x,19,593,pane,2,132)
            box('Blue',x,19,683,pane,2,42)
            box('Ink',x,21,660,pane,2,7)
            box('Ink',x,21,616,7,2,178)
            counts['upper_windows']+=1
            door=(front['name']=='College' and index==0) or (front['name']=='Bathurst' and index==1)
            if door:
                door_width=min(112,pane)
                box('Ink',x,13,145,door_width+14,8,286)
                box('Glazing',x,18,152,door_width,2,260)
                box('Gold',x+door_width*.32,21,133,5,3,32)
                counts['estimated_doors']+=1
            else:
                box('Ink',x,13,184,pane+12,8,218)
                box('Glazing',x,18,184,pane,2,204)
                box('Ink',x,21,184,6,2,206)
                box('Stone',x,17,71,pane+24,8,12)
                counts['ground_windows']+=1
        # Small variations in the geometry create an original punk display face, without copied artwork.
        for position in ([width/2] if front['name']=='College' else [width*.26,width*.74]):
            letter_height=62 if front['name']=='College' else 77
            unit=letter_height*.62
            advance=unit*1.3
            total=sum(advance*(.62 if character==' ' else .45 if character=="'" else 1) for character in TEXT)-advance*.3
            assert total<width-40
            cursor=position-total/2
            for character in TEXT:
                if character==' ':
                    cursor+=advance*.62
                    continue
                for stroke in GLYPHS[character]:
                    for p,q in zip(stroke,stroke[1:]):
                        # A street-facing observer's screen-right is opposite the CCW footprint tangent.
                        # Rebuild each stroke in that reading basis; its outward quad winding stays unchanged.
                        start=(2*position-cursor-p[0]*unit,390+(p[1]-.5)*letter_height)
                        end=(2*position-cursor-q[0]*unit,390+(q[1]-.5)*letter_height)
                        dx,dz=end[0]-start[0],end[1]-start[1]
                        length=math.hypot(dx,dz)
                        half=letter_height*.042
                        offset=(-dz/length*half,dx/length*half)
                        points=[(start[0]-offset[0],start[1]-offset[1]),(end[0]-offset[0],end[1]-offset[1]),
                                (end[0]+offset[0],end[1]+offset[1]),(start[0]+offset[0],start[1]+offset[1])]
                        mesh.face('Cladding',[point(x,24,z) for x,z in points])
                        counts['letter_strokes']+=1
                cursor+=advance*(.45 if character=="'" else 1)
            signs.append({'street':front['name'],'text':TEXT,'position_cm':point(position,24,390),
                          'width_cm':total,'height_cm':letter_height,'original_vector_lettering':True})

    all_points=[point for faces in mesh.groups.values() for face in faces for point in face]
    footprint=Polygon(landmark['footprint'])
    assert all(footprint.buffer(MAX_PROJECTION_CM+.01).covers(Point(point[:2])) for point in all_points)
    projected=unary_union([MultiPoint([point[:2] for point in face]).convex_hull
                           for faces in mesh.groups.values() for face in faces])
    spawn_clearance=projected.distance(Point(layout['spawn'][:2]))
    sideways=[LineString(line) for line,kind in zip(layout['paths'],layout['path_kinds']) if kind=='sidewalk']
    sidewalk_clearance=min(projected.distance(line) for line in sideways)
    car_center=layout['car']
    yaw=math.radians(layout['car_yaw'])
    car=Polygon([(car_center[0]+x*math.cos(yaw)-y*math.sin(yaw),car_center[1]+x*math.sin(yaw)+y*math.cos(yaw))
                 for x,y in ((-220,-108),(220,-108),(220,108),(-220,108))])
    car_clearance=projected.distance(car)
    track_clearance=min(projected.distance(LineString(track['points'])) for track in layout['tram_lines'])
    assert spawn_clearance>90 and sidewalk_clearance>90 and car_clearance>100 and track_clearance>127
    assert min(point[2] for point in all_points)>=0 and max(point[2] for point in all_points)<=height+.01
    materials={name:{'material':MATERIALS[name],'triangles':sum(len(face)-2 for face in faces),
                     'bounds_cm':[[round(operation(point[axis] for face in faces for point in face),3) for axis in range(3)]
                                  for operation in (min,max)]} for name,faces in sorted(mesh.groups.items())}
    report={'version':1,'name':"Sneaky Dee's original corner facade",'osm':'way/678313322',
            'height_cm':height,'footprint_cm':landmark['footprint'],'edges':fronts,'materials':materials,
            'triangles':sum(value['triangles'] for value in materials.values()),'counts':counts,'signs':signs,
            'new_collision':False,'generic_glass_action':'Unchanged; opaque thin skin covers only the three authored landmark faces',
            'clearances_cm':{'maximum_footprint_projection':MAX_PROJECTION_CM,'spawn':spawn_clearance,
                             'sidewalk_centerline':sidewalk_clearance,'starter_car_body':car_clearance,
                             'tram_centerline':track_clearance},'sources':SOURCES,'attribution':layout['attribution'],
            'estimates':'Two storeys are sourced. Bay rhythm, doors, cladding courses, floor/parapet/sign dimensions, colours and original lettering are authored estimates. Shared-block lidar height is retained. No interior access or street changes.'}
    assert report['triangles']<10000 and len(signs)==3
    return mesh,report


def prepare(root=ROOT):
    mesh,report=build(json.loads((root/'Data/CollegeBathurst/layout.json').read_text()))
    directory=root/RELATIVE
    geometry=directory/'Geometry'
    geometry.mkdir(parents=True,exist_ok=True)
    for path in geometry.glob('*.obj'):
        if path.stem not in mesh.groups:
            path.unlink()
    mesh.write(geometry)
    report['source_sha256']={name:digest(root/name) for name in
                              ('Data/CollegeBathurst/layout.json','Data/CollegeBathurst/osm.xml',
                               'Data/CollegeBathurst/massing.geojson','Scripts/plateau_mesh.py','Scripts/prepare_sneaky_dees.py')}
    report['geometry_sha256']={name:digest(geometry/(name+'.obj')) for name in report['materials']}
    (directory/'facade.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report


def verified(root=ROOT):
    directory=root/RELATIVE
    report=json.loads((directory/'facade.json').read_text())
    assert report['version']==1 and report['new_collision'] is False and report['osm']=='way/678313322'
    assert set(report['source_sha256'])=={'Data/CollegeBathurst/layout.json','Data/CollegeBathurst/osm.xml',
                                        'Data/CollegeBathurst/massing.geojson','Scripts/plateau_mesh.py',
                                        'Scripts/prepare_sneaky_dees.py'}
    for name,expected in report['source_sha256'].items():
        assert digest(root/name)==expected,name
    assert set(report['materials'])==set(report['geometry_sha256'])==set(MATERIALS)
    assert {path.stem for path in (directory/'Geometry').glob('*.obj')}==set(MATERIALS)
    for name,expected in report['geometry_sha256'].items():
        path=directory/'Geometry'/(name+'.obj')
        assert report['materials'][name]['material']==MATERIALS[name] and digest(path)==expected,name
        summary=obj_summary(path)
        assert summary['triangles']==report['materials'][name]['triangles'] and summary['bounds_cm']==report['materials'][name]['bounds_cm'],name
    assert sum(value['triangles'] for value in report['materials'].values())==report['triangles']
    return report


def obj_summary(path):
    """Check the actual rounded export, which the importer can otherwise silently simplify."""
    vertices=[]
    triangles=0
    minimum_area=math.inf
    for line in Path(path).read_text().splitlines():
        fields=line.split()
        if not fields:
            continue
        if fields[0]=='v':
            x,y,z=map(float,fields[1:])
            assert all(math.isfinite(value) for value in (x,y,z))
            vertices.append((x,-y,z))
        elif fields[0]=='f':
            assert len(fields)==4,'Expected exported triangles'
            points=[vertices[int(field.split('/')[0])-1] for field in fields[1:]]
            a,b=[tuple(points[index][axis]-points[0][axis] for axis in range(3)) for index in (1,2)]
            cross=(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
            area=math.sqrt(sum(value*value for value in cross))/2
            assert area>1e-6,'Degenerate triangle at exported precision'
            minimum_area=min(minimum_area,area)
            triangles+=1
    assert vertices and triangles
    return {'triangles':triangles,'minimum_triangle_area_cm2':minimum_area,
            'bounds_cm':[[round(operation(point[axis] for point in vertices),3) for axis in range(3)] for operation in (min,max)]}


if __name__=='__main__':
    report=prepare()
    print(json.dumps({key:report[key] for key in ('triangles','counts','clearances_cm')},indent=2))
