"""Check geographic routes and source mesh validity independently of Unreal."""
import json,math,hashlib
from pathlib import Path
from shapely.geometry import Point,LineString,Polygon
root=Path(__file__).resolve().parents[1];data=json.loads((root/'Data/ParkComic/layout.json').read_text())
assert len(data['reference_images'])==3
for name,digest in data['reference_images'].items():assert hashlib.sha256((root/'Data/ParkComic/References'/name).read_bytes()).hexdigest()==digest
assert len({t['id'] for t in data['trees']})==len(data['trees'])==4586
assert sum(t['park']=='LA FONTAINE' for t in data['trees'])==2409
assert {r['style'] for r in data['residents']}==set(range(11))
assert len(data['models'])==73
assert len({tuple(tuple(p) for p in r['route']) for r in data['residents']})==14
park=Polygon(data['park_outline']).buffer(0)
paths=[LineString(p) for p in data['paths']]
for resident in data['residents']:
    assert resident['style'] in range(11)
    route=LineString(resident['route'])
    assert park.covers(route)
    assert any(p.buffer(.1).covers(route) for p in paths),'Resident cuts across the park instead of following a mapped path'
for model in data['models']:
    lines=(root/'Data/ParkComic/Geometry'/model['file']).read_text().splitlines();vertices=[];uvs=[];faces=[]
    for line in lines:
        if line.startswith('v '):vertices.append(list(map(float,line.split()[1:])))
        elif line.startswith('vt '):uvs.append(list(map(float,line.split()[1:])))
        elif line.startswith('f '):faces.append(line.split()[1:])
    assert len(vertices)==len(uvs)>0,model['file']
    assert all(math.isfinite(v) for p in vertices+uvs for v in p)
    assert len(faces)==model['triangles']
    for face in faces:
        assert len(face)==3
        assert all(1<=int(i.split('/')[0])<=len(vertices) and 1<=int(i.split('/')[1])<=len(uvs) for i in face)
print('NORD_PARK_SOURCE_TEST_OK inventory IDs, mapped routes, finite triangles and valid UV references')
