"""CPU geometry/provenance/OBJ guards; no Unreal, GPU or native asset writes."""
import json
import math
from pathlib import Path
import shutil
import struct
import tempfile
import xml.etree.ElementTree as ET
from unittest.mock import patch

from plateau_background import read_obj
import prepare_montreal_east_details as plan


def reject(call):
    try: call()
    except AssertionError: return
    raise AssertionError('Unsafe source/candidate was accepted')


def cross(a, b, c):
    u, v = [[point[i]-a[i] for i in range(3)] for point in (b, c)]
    return [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]


def files(root): return {str(path.relative_to(root)): plan.sha(path) for path in sorted(root.rglob('*')) if path.is_file()}


before_content = files(plan.ROOT/'Content'); before_source = plan.sources()
mesh, report, subset = plan.build(); repeated = plan.build()
assert mesh.groups == repeated[0].groups and report == repeated[1] and subset == repeated[2]
assert report['source_emitted_window_cards'] == 50 and report['culled_fully_occluded_cards'] == 8 and report['candidate_window_cards'] == 42
assert report['candidate_cards_per_source'] == {'way/345567245':14, 'way/345578954':12, 'way/345578982':16}
assert report['source_glass_sha256'] == '1e0894b50ed03a724fb853f07f7ffbaa6f89264804bb9e097d960f5655439c11'
assert report['retained_glass_sha256'] == 'afbd3df4158c79b07d2f8e13c1e8bd5bcd41a5d98922da652da6504310156d61'
assert report['triangles'] == 2604 and set(mesh.groups) == {'Glass','Iron','Trim'}
assert not report['native_imported'] and not report['visual_accepted']
assert all(not row['collision'] and not row['cast_shadow'] for row in report['materials'].values())
assert {tuple(window['fully_contained_by_shells']) for window in report['culled_windows']} == {('way/345567218',),('way/345579124',)}

original = ET.parse(plan.ROOT/'Data/LaFontaine/osm.xml').getroot(); selected = ET.fromstring(subset)
assert len(selected.findall('way')) == 3 and {way.get('id') for way in selected.findall('way')} == set(plan.TARGETS)
for kind in ('way','node'):
    raw = {element.get('id'): element for element in original.findall(kind)}
    for element in selected.findall(kind): assert ET.tostring(element) == ET.tostring(raw[element.get('id')])
assert {node.get('id') for node in selected.findall('node')} == {node.get('ref') for way in selected.findall('way') for node in way.findall('nd')}

# Existing source-window placement stays exact; every new frame stays local.
for index, window in enumerate(report['windows']):
    face = window['glass_vertices_cm']; a = face[0]; u, n = window['tangent_xy'], window['outward_xy']
    normal = cross(*face[:3]); assert sum(normal[i]*n[i] for i in (0,1)) > 14999
    assert face == mesh.groups['Glass'][index]
    for material, span in (('Iron',24),('Trim',6)):
        for polygon in mesh.groups[material][index*span:(index+1)*span]:
            for point in polygon:
                along = sum((point[i]-a[i])*u[i] for i in (0,1))
                projection = 3+sum((point[i]-a[i])*n[i] for i in (0,1))
                assert -8.000001 <= along <= 108.000001 and -.000001 <= projection <= 10.000001
                assert a[2]-6.500001 <= point[2] <= a[2]+153.000001
for metadata in report['materials'].values():
    assert max(metadata['bounds_cm'][1][i]-metadata['bounds_cm'][0][i] for i in (0,1)) < 10000
    assert metadata['bounds_cm'][0][2] >= 163.5 and metadata['bounds_cm'][1][2] <= 643

# Endpoints alone are insufficient on concave adjacent footprints.
square = [[0,0],[3,0],[3,3],[0,3]]
concave = [[0,0],[3,0],[3,3],[2,3],[2,1],[1,1],[1,3],[0,3]]
assert plan.contained_segment([0,0],[3,0],square)
assert plan.contained_segment([.5,.5],[.5,.5],square)
assert not plan.contained_segment([-.001,0],[1,0],square)
assert not plan.contained_segment([.5,2],[2.5,2],concave)
pane = [[.5,.5,170],[2.5,.5,170],[2.5,.5,320],[.5,.5,320]]
assert plan.occluding_shells(pane,'own',[{'source':'neighbor','footprint_xy':square,'height_cm':960}]) == ['neighbor']
assert not plan.occluding_shells(pane,'own',[{'source':'neighbor','footprint_xy':square,'height_cm':200}])
assert not plan.occluding_shells(pane,'own',[{'source':'own','footprint_xy':square,'height_cm':960}])
assert plan.context.WINDOW_DISTANCE_CM == 5000
with patch.object(plan.context,'build_context',side_effect=RuntimeError('injected producer failure')):
    try: plan.context_glass()
    except RuntimeError: pass
    else: raise AssertionError('Injected producer failure disappeared')
assert plan.context.WINDOW_DISTANCE_CM == 5000, 'Temporary source-only gate override leaked'
with patch.object(plan,'SOURCE_HASHES',{**plan.SOURCE_HASHES,'Scripts/plateau_context.py':'changed'}): reject(plan.build)

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    for path in plan.SOURCE_HASHES:
        target = root/path; target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(plan.ROOT/path,target)
    output = root/plan.DATA; generated = plan.prepare(output,root); loaded = plan.load(root)
    assert loaded[0].groups == mesh.groups and loaded[1] == json.loads(json.dumps(generated))
    reject(lambda:plan.prepare(output,root))
    reject(lambda:plan.prepare(root/'Content/unsafe',root)); assert not (root/'Content').exists()
    for name, faces in mesh.groups.items():
        path = output/'Geometry'/(name+'.obj'); records = read_obj(path)
        assert len(records) == report['materials'][name]['triangles']
        expected = {(float(f'{p[0]:.3f}'),float(f'{-p[1]:.3f}'),float(f'{p[2]:.3f}')) for face in faces for p in face}
        observed = {tuple(map(float,vertex)) for record in records for vertex,uv in record}
        assert observed == expected and all(math.isfinite(float(v)) for record in records for vertex,uv in record for v in (*vertex,*uv))
        for record in records:
            points = [[struct.unpack('f',struct.pack('f',float(v)))[0] for v in vertex] for vertex,uv in record]
            assert len(points) == 3 and sum(v*v for v in cross(*points)) > 1e-10, 'OBJ/native float32 degenerate triangle'
        if name == 'Glass':
            for index, record in enumerate(records):
                points = [list(map(float,vertex)) for vertex,uv in record]; normal = cross(*points); n = report['windows'][index//2]['outward_xy']
                assert normal[0]*n[0]-normal[1]*n[1] > 14990, 'Existing OBJ coordinate/winding convention changed'
    manifest = output/'details.json'; baseline = manifest.read_bytes(); geometry = output/'Geometry/Glass.obj'; original_obj = geometry.read_bytes()
    geometry.write_bytes(original_obj+b'#changed\n'); reject(lambda:plan.load(root))
    tampered = json.loads(baseline);tampered['geometry_files']['Geometry/Glass.obj'] = plan.sha(geometry);manifest.write_text(json.dumps(tampered));reject(lambda:plan.load(root))
    geometry.write_bytes(original_obj);manifest.write_bytes(baseline)
    source_file = output/'source-subset.osm.xml';source_file.write_bytes(subset+b' ');reject(lambda:plan.load(root))
    source_file.write_bytes(subset)
    (output/'Geometry/Unexpected.obj').write_text('unowned geometry\n');reject(lambda:plan.load(root))

contract = report['native_contract']
assert contract['actor_labels'] == ['Plateau east details '+name for name in plan.MATERIALS]
assert contract['new_packages'] == ['Content/Plateau/EastDetails/SM_'+name+'.uasset' for name in plan.MATERIALS]
assert all(contract['materials'][name] == '/Game/Plateau/Materials/M_'+name+'.M_'+name for name in plan.MATERIALS)
assert plan.sources() == before_source and files(plan.ROOT/'Content') == before_content, 'CPU authoring touched existing source/Content'
print('NORD_EAST_DETAILS_CPU_OK:50source/8fully-occluded/42candidate panes,3groups/2604triangles, exact producer/source reuse, bounded frames, concave/height culling, restored gate, OBJ/float32 and immutable Content guards')
