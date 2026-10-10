"""Check source geometry and geographic invariants without loading Unreal."""
import hashlib
import json
import math
from pathlib import Path
from prepare_environment_refresh import tree_profile

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'Data/EnvironmentRefresh/layout.json').read_text())
park=json.loads((root/'Data/ParkComic/layout.json').read_text())
for name,path in (('park','Data/ParkComic/layout.json'),('city','Data/CityBuildings/manifest.json')):
    assert hashlib.sha256((root/path).read_bytes()).hexdigest()==data['source_sha256'][name]
assert len(data['models'])==8 and len(data['sherbrooke_facades'])>20 and data['entries']>20
assert len({tree['id'] for tree in park['trees']})==4586
for tree in park['trees']:
    result=tree_profile(tree)
    assert result==tree_profile(tree), 'Tree estimates must be deterministic'
    assert 800<result['height']<=2600 and 0<result['radius']<=1000
    assert result['color'] in range(4) and .86<=result['width_ratio']<=1.02
    assert result['variant'] in range(1 if tree['style']==2 else 3)
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
shader=(root/'Scripts/city_facade.hlsl').read_text()
for input_name in ('Center','Bounds','Position'):
    assert input_name in shader
    assert input_name in (root/'Scripts/apply_city_comic_style.py').read_text()
    assert input_name in (root/'Scripts/import_city_buildings.py').read_text()
print('NORD_ENVIRONMENT_SOURCE_TEST_OK 4586 preserved inventory trees, eight finite meshes, six broadleaf variants with smooth normals and bounded crown spread, estimated entries')
