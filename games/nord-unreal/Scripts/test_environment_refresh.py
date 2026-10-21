"""Check source geometry and geographic invariants without loading Unreal."""
import hashlib
import json
import math
from pathlib import Path
from prepare_environment_refresh import STREETS, tree_profile, municipal_wall_triangles, supported_wall_height, retired_tennis_parts, municipal_window_data, aligned_window_bay
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'Data/EnvironmentRefresh/layout.json').read_text())
park=json.loads((root/'Data/ParkComic/layout.json').read_text())
for name,path in (('park','Data/ParkComic/layout.json'),('city','Data/CityBuildings/manifest.json'),('osm','Data/LaFontaine/osm.xml'),('district','Data/LaFontaine/layout.json')):
    assert hashlib.sha256((root/path).read_bytes()).hexdigest()==data['source_sha256'][name]
expected={f'Canopy{style}_{variant}.obj' for style in range(3) for variant in range(1 if style==2 else 4)}
expected|={'ArchitectureAccents.obj','CourtSurfaces.obj','CourtDetails.obj'}
assert {m['file'] for m in data['models']}==expected and len(data['models'])==len(expected)
assert len(data['sherbrooke_facades'])>0 and data['entries']>20
assert all(f['street']=='Rue Sherbrooke Est' for f in data['sherbrooke_facades'])
assert all(any(f['street']==street and f.get('entry') for f in data['street_facades']) for street in STREETS)
assert any(f.get('exterior_stairs') for f in data['street_facades']), 'Missing residential iron stair cues'
assert sum(f.get('balconies',0) for f in data['street_facades'])>20
def wall(x0,x1,height):
    return [[(x0,0,0),(x1,0,0),(x1,0,height)],[(x0,0,0),(x1,0,height),(x0,0,height)]]
assert supported_wall_height(wall(0,1000,1400),(0,0),(1000,0))==(1400,0)
assert supported_wall_height(wall(0,400,1400)+wall(400,1000,800),(0,0),(1000,0))==(800,600), 'Low survey wings must constrain upper details'
assert supported_wall_height(wall(0,400,1400)+wall(600,1000,1400),(0,0),(1000,0))[0]==0, 'Never bridge a gap with floating trim'
wall_cache={}
city=json.loads((root/'Data/CityBuildings/manifest.json').read_text())
occupied=unary_union([Polygon(r).buffer(0) for b in city['buildings'] for r in b['footprints']])
district=json.loads((root/'Data/LaFontaine/layout.json').read_text())
asphalt=unary_union([LineString([a,b]).buffer(width/2,cap_style=2)
                    for road,width in zip(district['roads'],district['road_widths']) for a,b in zip(road,road[1:])])
trunks=unary_union([Point(t['xy']).buffer(t['diameter_cm']/2+20) for t in park['trees']])
for f in data['street_facades']:
    assert f['street'] in STREETS and math.isclose(sum(v*v for v in f['normal']),1,abs_tol=1.e-8)
    ident=f['building'];path=root/'Data/CityBuildings/Geometry'/f'{ident}.obj'
    if ident not in wall_cache:wall_cache[ident]=municipal_wall_triangles(path)
    assert hashlib.sha256(path.read_bytes()).hexdigest()==data['source_wall_sha256'][ident]
    height,variation=supported_wall_height(wall_cache[ident],*f['edge'])
    assert math.isclose(f['height_cm'],height,abs_tol=.001) and math.isclose(f['wall_top_variation_cm'],variation,abs_tol=.001)
    assert 0<=height<=f['shell_height_cm']+1
    if f['top_trim']:assert height>300 and variation<10, 'Cornices need a continuous flat survey wall top'
    if f.get('entry'):assert height>=400 and f['entry']['raised_cm']+276<height
    a,b=f['edge'];normal=f['normal'];length=math.dist(a,b);along=[(b[i]-a[i])/length for i in (0,1)]
    def outward(x,y):return[a[i]+along[i]*x+normal[i]*y for i in (0,1)]
    assert all(not occupied.covers(Point(outward(length/2,d))) for d in (50,150)), 'Outward normals must clear all retained shells, including overlapping building records'
    strip=Polygon([outward(4,20),outward(length-4,20),outward(length-4,160),outward(4,160)])
    assert occupied.intersection(strip).area<=1 and asphalt.intersection(strip).area<=1
    assert not LineString(f['road_sightline']).intersects(occupied.buffer(-5)), 'Street frontage cannot face through another shell'
    if f.get('entry'):
        entry=f['entry'];seed,uv_walls=municipal_window_data(path)
        assert seed==entry['shader_seed'] and entry['surround_width_cm']==190
        assert entry['count']==len(entry['bay_centers'])
        for x,uv in entry['bay_centers']:
            assert math.isclose((uv+seed*.3)%1,.5,abs_tol=1.e-8), 'Door center must share the retained procedural window bay'
            assert aligned_window_bay(uv_walls,a,b,seed,x) is not None and 99<=x<=length-99
        footprint=Polygon(f['artwork_footprint'])
        assert strip.buffer(.001).covers(footprint), 'Actual generated door/stoop/balcony/stair footprint must fit its clear region'
        assert occupied.intersection(footprint).area<=1 and asphalt.intersection(footprint).area<=1
        assert not trunks.intersects(footprint), 'Entrances/balconies/stairs must clear retained trunks by20cm beyond DBH/2'
        assert 20-1.e-6<=f['outward_extent_cm'][0]<=f['outward_extent_cm'][1]<=160+1.e-6
    if not f['residential']:
        assert not f.get('balconies') and not f.get('exterior_stairs')
        if f.get('entry'):assert f['entry']['raised_cm']==0
    if f.get('entry'):assert f['entry']['estimated'] is True
assert len({tree['id'] for tree in park['trees']})==4586
for tree in park['trees']:
    result=tree_profile(tree)
    assert result==tree_profile(tree), 'Tree estimates must be deterministic'
    assert 800<result['height']<=2600 and 0<result['radius']<=1000
    assert result['color'] in range(4) and .78<=result['width_ratio']<=1.08
    assert result['variant'] in range(1 if tree['style']==2 else 4)
    if tree['style']==2:assert result['color']==0
for model in data['models']:
    vertices=[];uvs=[];normals=[];triangles=[];leaf_vertices=[];mat=None
    source=(root/'Data/EnvironmentRefresh/Geometry'/model['file']).read_text()
    for line in source.splitlines():
        if line.startswith('usemtl '):mat=line.split()[1]
        elif line.startswith('v '):
            point=tuple(map(float,line.split()[1:]));vertices.append(point)
            if mat.startswith('Leaf'):leaf_vertices.append(point)
        elif line.startswith('vt '):uvs.append(tuple(map(float,line.split()[1:])))
        elif line.startswith('vn '):normals.append(tuple(map(float,line.split()[1:])))
        elif line.startswith('f '):triangles.append([int(index.split('/')[0])-1 for index in line.split()[1:]])
    assert len(vertices)==len(uvs)>0 and len(triangles)==model['triangles']
    assert all(math.isfinite(value) for point in vertices+uvs for value in point)
    for triangle in triangles:
        assert len(triangle)==3 and all(0<=index<len(vertices) for index in triangle)
        a,b,c=[vertices[index] for index in triangle]
        u=tuple(b[i]-a[i] for i in range(3));v=tuple(c[i]-a[i] for i in range(3))
        cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        assert sum(value*value for value in cross)>1.e-7, model['file']+' degenerate triangle'
    if model['file'].startswith('Canopy'):
        assert 's 1\n' in source
        if not model['file'].startswith('Canopy2'):
            assert {'Leaf0','Leaf1','Leaf2'} <= {line.split()[1] for line in source.splitlines() if line.startswith('usemtl ')}, 'Broadleaf crowns keep a shaded underside and a sunlit cap'
        assert len(normals)==len(vertices)
        assert all(abs(sum(v*v for v in normal)-1)<1.e-4 for normal in normals)
        assert 600<len(triangles)<12000, 'Bound tree rendering cost'
        height=max(point[2] for point in vertices)
        radius=max(abs(value) for point in vertices for value in point[:2])
        assert height/radius<5., 'Avoid tall narrow balloon crowns'
        if not model['file'].startswith('Canopy2'):
            leaf_bottom=min(p[2] for p in leaf_vertices);leaf_top=max(p[2] for p in leaf_vertices)
            crown_fraction=(leaf_top-leaf_bottom)/height
            for tree in park['trees']:
                if not model['file'].startswith(f"Canopy{tree['style']}_"):continue
                profile=tree_profile(tree)
                assert profile['radius']*2>=profile['height']*crown_fraction, 'Broadleaf crown must spread wider than foliage height'
    else:
        assert set(model['materials'])<=set(data['palette'])
        assert len(triangles)<({'ArchitectureAccents.obj':250000,'CourtDetails.obj':30000}.get(model['file'],5000)), 'Bound added artwork cost'
assert len({hashlib.sha256((root/'Data/EnvironmentRefresh/Geometry'/name).read_bytes()).hexdigest()
            for name in expected if name.startswith(('Canopy0','Canopy1'))})==8, 'Distinct broadleaf silhouettes'
tennis=[c for c in data['courts'] if c['sport']=='tennis']
assert len(tennis)==14 and len({c['osm'] for c in tennis})==14
assert sum(c['surface']=='CourtCarpet' for c in tennis)==sum(c['surface']=='CourtAcrylic' for c in tennis)==7
original={p['osm']:p for p in park['pitches']}
for court in tennis:
    assert court['points']==original[court['osm']]['points'] and court['surface_assignment_estimated']
    assert 1000<court['net_width_cm']<1200 and court['net_cell_cm']==8 and court['net_cord_diameter_cm']==.5
retired=retired_tennis_parts(park,data['courts'])
assert sum(r['material']=='Ink' and r['mesh']=='Cube' for r in retired)==14
assert sum(r['mesh']=='Cylinder' for r in retired)==28
assert sum(r['material']=='Cream' and r['position'][2] in range(15,111,20) for r in retired)==70
assert sum(r['material']=='Cream' and r['position'][2]==58 for r in retired)>500
volley,=[c for c in data['courts'] if c['sport']=='beachvolleyball']
assert volley['osm']=='311018514' and volley['points']==original[volley['osm']]['points']
assert len(volley['subcourts'])==2 and len({c['id'] for c in volley['subcourts']})==2
sand=Polygon(volley['points']);zones=[]
assert sand.centroid.distance(Point(volley['center']))<.001
for court in volley['subcourts']:
    footprint=Polygon(court['footprint']);zone=footprint.buffer(court['clearance_cm'],join_style=2)
    assert court['dimensions_cm']==[1600,800] and math.isclose(footprint.area,1280000,abs_tol=.01)
    assert court['clearance_cm']==200 and court['placement_estimated']
    assert sand.covers(zone), 'Volleyball free zone must stay inside the retained mapped sand'
    assert math.isclose(sum(v*v for v in court['axis']),1,abs_tol=1.e-8)
    assert footprint.centroid.distance(Point(court['center']))<.001
    zones.append(zone)
assert not zones[0].intersects(zones[1]), 'Two independent playable volleyball court envelopes'
shader=(root/'Scripts/city_facade.hlsl').read_text()
for input_name in ('Center','Bounds','Position'):
    assert input_name in shader
    assert input_name in (root/'Scripts/apply_city_comic_style.py').read_text()
    assert input_name in (root/'Scripts/import_city_buildings.py').read_text()
print('NORD_ENVIRONMENT_SOURCE_TEST_OK 4586 preserved inventory trees;12 finite meshes/eight distinct smooth broadleaf variants;four perimeter streets;estimated residential entries/balconies/stairs;14 tennis surfaces/two volleyball nets within mapped sand')
