"""CPU survey/geometry/header guards and pre-mutation rejection checks; no UE."""
import ast
import copy
import json
import math
import re
from pathlib import Path
import shutil
import struct
import tempfile
from types import SimpleNamespace as NS
from unittest.mock import patch

import montreal_east_extension as plan
import apply_montreal_east_extension as author


def check_geometry(mesh, report):
    count = 0
    for name, faces in mesh.groups.items():
        assert not report['materials'][name]['collision']
        for face in faces:
            assert all(plan.inside(p, report['extension_bounds_xy']) for p in face)
            for i in range(1, len(face)-1):
                a, b, c = [[struct.unpack('f', struct.pack('f', round(v, 3)))[0] for v in p] for p in (face[0], face[i], face[i+1])]
                x, y = [b[j]-a[j] for j in range(3)], [c[j]-a[j] for j in range(3)]
                cross = [x[1]*y[2]-x[2]*y[1], x[2]*y[0]-x[0]*y[2], x[0]*y[1]-x[1]*y[0]]
                assert sum(v*v for v in cross) > 1e-10, 'OBJ/float32 closure triangle collapses'
                count += 1
    assert count == report['triangles'] == 14160 and len(mesh.groups) == 40


def continuity(report):
    key = lambda p: tuple(round(v, 3) for v in p)
    graph = {}
    for r in report['roads']:
        a, b = map(key, r['centerline_xy']); graph.setdefault(a, set()).add(b); graph.setdefault(b, set()).add(a)
    old = json.loads((plan.ROOT/'Data/Plateau/EdgesGeometry/edges.json').read_text())
    for exit in old['closures']:
        start = key(exit['mapped_exit_xy']); assert start in graph, 'Former decorated road exit has no extension join'
        seen, todo = set(), [start]
        while todo:
            a = todo.pop()
            if a in seen: continue
            seen.add(a); todo.extend(graph[a]-seen)
        assert max(p[0] for p in seen) > start[0]+10000, 'Former road exit does not reach the outer surveyed network'
    assert len([p for p in graph if abs(p[0]-report['extension_bounds_xy'][0])<.001]) == 21


def preservation_test():
    component = {'relative_location': [55373.3, 100., 100.], 'visible': False, 'mesh': 'Cube', 'profile': 'BlockAll'}
    before = {'east': {'location': [55373.3, 100., 100.], 'label': 'District edge', 'hidden': True, 'root_component': 'east.root', 'components': {'east.root': component}},
              'old': {'location': [55000., 0., 0.], 'hidden': False, 'root_component': 'old.root', 'components': {'old.root': {'visible': True, 'profile': 'NoCollision'}}},
              'mission': {'location': [10., 20., 30.], 'hidden': False, 'components': {}}}
    after = copy.deepcopy(before); after['east']['location'][0] += 20000; after['east']['components']['east.root']['relative_location'][0] += 20000
    after['old']['hidden'] = True; after['old']['components']['old.root']['visible'] = False
    assert author.assert_originals(before, after, 'east', {'old': 'old.root'})
    for defect in ('remove', 'mission', 'east_scale', 'old_collision', 'west'):
        changed = copy.deepcopy(after)
        if defect == 'remove': del changed['mission']
        elif defect == 'mission': changed['mission']['location'][0] += 1
        elif defect == 'east_scale': changed['east']['components']['east.root']['scale'] = [1, 1, 2]
        elif defect == 'old_collision': changed['old']['components']['old.root']['profile'] = 'BlockAll'
        else: changed['old']['location'][0] += 1
        try: author.assert_originals(before, changed, 'east', {'old': 'old.root'})
        except AssertionError: pass
        else: raise AssertionError('Undeclared old-actor change accepted: '+defect)


class Vector:
    def __init__(self, x=0, y=0, z=0): self.x, self.y, self.z = x, y, z
class Mesh:
    def __init__(self, path='/Engine/BasicShapes/Cube.Cube'): self.path = path
    def get_path_name(self): return self.path
class Material: pass
class Component:
    def __init__(self, path, mesh=None, profile='BlockAll', visible=True):
        self.path, self.static_mesh, self.profile, self.visible = path, mesh or Mesh(), profile, visible
    def get_path_name(self): return self.path
    def get_collision_profile_name(self): return self.profile
    def get_collision_enabled(self): return 2 if self.profile=='BlockAll' else 0
    def is_visible(self): return self.visible
    def get_attach_parent(self): return None
    def get_editor_property(self, name): assert name == 'cast_hidden_shadow'; return False
class Actor:
    def __init__(self, name, label, location=(0,0,0), scale=(1,1,1), hidden=False, profile='BlockAll', visible=True, mesh=None):
        self.name, self.label, self.location, self.scale, self.hidden = name, label, Vector(*location), Vector(*scale), hidden
        self.static_mesh_component = Component(name+'.root', mesh, profile, visible)
    def get_path_name(self): return self.name
    def get_actor_label(self): return self.label
    def get_actor_enable_collision(self): return True
    def get_actor_location(self): return self.location
    def get_actor_scale3d(self): return self.scale
    def get_actor_rotation(self): return NS(pitch=0., yaw=0., roll=0.)
    def get_editor_property(self, name): return self.static_mesh_component if name=='root_component' else self.hidden
    def get_component_by_class(self, cls): return self.static_mesh_component


def fake_u(report):
    b = report['original_bounds_xy']; cy, cx = (b[1]+b[3])/2, (b[0]+b[2])/2
    actors = [Actor('wall'+str(i), 'District edge', p, s, True, visible=False) for i, (p, s) in enumerate([
        ((b[0],cy,100),(.7,(b[3]-b[1])/100,2)), ((b[2],cy,100),(.7,(b[3]-b[1])/100,2)),
        ((cx,b[1],100),((b[2]-b[0])/100,.7,2)), ((cx,b[3],100),((b[2]-b[0])/100,.7,2))])]
    actors.append(Actor('ground','District ground',(cx,cy,-100),((b[2]-b[0])/100,(b[3]-b[1])/100,2)))
    actors += [Actor('old'+str(i), label, profile='NoCollision') for i,label in enumerate(report['old_closure_labels_to_hide'])]
    context = json.loads((plan.ROOT/'Data/Plateau/ContextGeometry/context.json').read_text())
    actors += [Actor('context'+str(i), 'Plateau context '+name, profile='BlockAll' if m['collision'] else 'NoCollision',
                     mesh=Mesh('/Game/Plateau/Context/SM_'+name+'.SM_'+name)) for i,(name,m) in enumerate(context['materials'].items())]
    events = []; editor = NS(get_all_level_actors=lambda: actors)
    classes = {name:type(name,(),{}) for name in ['EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem','StaticMeshEditorSubsystem','ActorComponent','SceneComponent','PrimitiveComponent','StaticMeshComponent','InstancedStaticMeshComponent','AssetImportTask','FbxImportUI','MaterialUsage','NaniteFallbackTarget','HorizTextAligment','VerticalTextAligment']}
    assets = NS(does_directory_exist=lambda p:False, load_asset=lambda p:Mesh() if p.startswith('/Engine') else Material())
    u = NS(**classes, EditorAssetLibrary=assets, SystemLibrary=NS(get_command_line=lambda:'-NullRHI'),
           EditorLevelLibrary=NS(get_pie_worlds=lambda _:[]), EditorLoadingAndSavingUtils=NS(get_dirty_map_packages=lambda:[],get_dirty_content_packages=lambda:[]),
           StaticMeshActor=Actor,TextRenderActor=Actor,TextRenderComponent=Component,StaticMesh=Mesh,MaterialInterface=Material,Vector=Vector,Rotator=object,Color=object,
           CollisionEnabled=NS(QUERY_AND_PHYSICS=2,NO_COLLISION=0), MaterialEditingLibrary=NS(has_material_usage=lambda *a:True),
           AssetToolsHelpers=NS(get_asset_tools=lambda:NS()))
    u.NaniteFallbackTarget.PERCENT_TRIANGLES=1;u.HorizTextAligment.EHTA_CENTER=1;u.VerticalTextAligment.EVRTA_TEXT_CENTER=1;u.MaterialUsage.MATUSAGE_NANITE=1
    def subsystem(cls):
        if cls is u.EditorActorSubsystem:return editor
        if cls is u.UnrealEditorSubsystem:return NS(get_editor_world=lambda:NS(get_path_name=lambda:author.MAP))
        return NS()
    u.get_editor_subsystem=subsystem
    return u, actors, events


def preflight_tests(root, report):
    (root/author.MAP_FILE).parent.mkdir(parents=True,exist_ok=True);(root/author.MAP_FILE).write_bytes(b'original-map-test')
    u, actors, events = fake_u(report)
    snapshot = lambda u, actors:{a.get_path_name():{'root_component':a.static_mesh_component.get_path_name()} for a in actors}
    backup = root/'Saved/Recovery/east-test'
    with patch.object(author,'snapshot',snapshot):
        author.preflight(u,root,backup)
        for defect in ('rendered','dirty','existing_assets','missing_old','moved_boundary','missing_material','backup_exists','outside_backup','stale_geometry'):
            uu, aa, _ = fake_u(report); dest = backup
            if defect=='rendered':uu.SystemLibrary.get_command_line=lambda:'-vulkan'
            elif defect=='dirty':uu.EditorLoadingAndSavingUtils.get_dirty_map_packages=lambda:[1]
            elif defect=='existing_assets':uu.EditorAssetLibrary.does_directory_exist=lambda p:True
            elif defect=='missing_old':aa.pop(5)
            elif defect=='moved_boundary':aa[1].location.x+=10
            elif defect=='missing_material':uu.EditorAssetLibrary.load_asset=lambda p:None
            elif defect=='backup_exists':dest.mkdir(parents=True)
            elif defect=='outside_backup':dest=root/'Content/unsafe'
            elif defect=='stale_geometry':
                target=root/plan.DATA/'Geometry'/next(iter(report['geometry_files']));original=target.read_bytes();target.write_bytes(b'bad')
            try:author.preflight(uu,root,dest)
            except AssertionError:pass
            else:raise AssertionError('Unsafe native preflight accepted '+defect)
            if defect=='backup_exists':dest.rmdir()
            if defect=='stale_geometry':target.write_bytes(original)
            assert not backup.exists(), 'Preflight wrote a backup or mutated before validation'



def backup_test(root):
    backup = root/'Saved/Recovery/snapshot-test'; target = backup/author.MAP_FILE
    target.parent.mkdir(parents=True); target.write_bytes(b'original-map')
    (backup/'original-actors.json').write_text('{}\n'); (backup/'original-content.json').write_text('{}\n')
    names = ['original-actors.json', 'original-content.json', str(author.MAP_FILE)]
    manifest = {p: plan.sha(backup/p) for p in names}
    path = backup/'backup-manifest.json'; path.write_text(json.dumps(manifest))
    receipt = {'backup_manifest_sha256':plan.sha(path)};author.verify_backup(backup,receipt)
    for name in ['original-actors.json', str(author.MAP_FILE), 'backup-manifest.json']:
        p = backup/name; before = p.read_bytes();p.write_bytes(before+b' ')
        try:author.verify_backup(backup,receipt)
        except AssertionError:pass
        else:raise AssertionError('Changed immutable backup accepted '+name)
        p.write_bytes(before)


def native_stack_guard_test(report):
    # Exercise the real fixture guard without importing Unreal or starting PIE.
    tree=ast.parse((plan.ROOT/'Scripts/test_montreal_east_runtime.py').read_text())
    function=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='assert_east_wall_stack')
    scope={'EAST_CAP':report['hidden_collision']['bounds'][2]}
    exec(compile(ast.Module(body=[function],type_ignores=[]),'native-stack-guard','exec'),scope)
    check=scope['assert_east_wall_stack'];b=report['expanded_bounds_xy']
    origin=Vector(b[2],(b[1]+b[3])/2,100);extent=Vector(35,(b[3]-b[1])/2,100)
    cap_origin=Vector(origin.x,origin.y,300);cap_extent=Vector(extent.x,extent.y,100)
    check(origin,extent,cap_origin,cap_extent)
    for defect in ('gap','short_cap','partial_footprint','rescaled_original'):
        o,e,co,ce=copy.deepcopy((origin,extent,cap_origin,cap_extent))
        if defect=='gap':co.z+=.2
        elif defect=='short_cap':ce.z-=1
        elif defect=='partial_footprint':ce.y-=1
        else:e.z=200
        try:check(o,e,co,ce)
        except AssertionError:pass
        else:raise AssertionError('Unsafe actual native wall stack accepted '+defect)


def map_scope_test(root):
    """Only the two road arrays of LaFontaineMap.h are pinned. New parking sides (prepare_car_parking.py rewrites
    RoadParkingSides) keep the extension valid; an edited road or width does not."""
    header = root/'Source/Quebec/LaFontaineMap.h'; original = header.read_bytes(); text = original.decode('ascii')
    def edit(marker, change):
        head, rest = text.split(marker, 1); body, tail = rest.split('};', 1)
        assert text.count(marker) == 1 and change(body) != body
        header.write_bytes((head+marker+change(body)+'};'+tail).encode('ascii'))
    edit('const int8 RoadParkingSides[] = {\n', lambda body: ','.join('0' if v.strip() != '0' else '3' for v in body.split(','))+'\n')
    assert plan.sources(root) and plan.load(root)['source_hashes'] == plan.sources(root), 'New parking sides rejected'
    for marker, change in (('const float RoadSegmentWidths[] = {\n', lambda body: body.replace('620.000f', '621.000f', 1)),
                           ('const FVector RoadSegments[][2] = {\n', lambda body: body.replace('.', '.1', 1))):
        edit(marker, change)
        try: plan.sources(root)
        except AssertionError: pass
        else: raise AssertionError('Edited retained road array accepted: '+marker.split('[')[0])
    header.write_bytes(original); assert plan.sources(root)


def main():
    before=plan.sources();mesh,report=plan.build();other,again=plan.build();assert report==again and mesh.groups==other.groups
    assert len(report['roads'])==143 and len({r['source'] for r in report['roads']})==37
    b=report['original_bounds_xy'];e=report['extension_bounds_xy'];assert math.isclose(e[2]-e[0],20000.,abs_tol=1e-7)
    assert report['expanded_bounds_xy']==[b[0],b[1],b[2]+20000,b[3]]
    floor=report['hidden_collision']['floor'];left=floor['location_cm'][0]-floor['size_cm'][0]/2
    assert math.isclose(left,b[2]-50,abs_tol=1e-7) and floor['location_cm'][2]+floor['size_cm'][2]/2==0
    assert floor['size_cm'][1]==b[3]-b[1]
    walls=report['hidden_collision']['bounds'];assert len(walls)==3
    for wall, normal in zip(walls[:2], ([0.,-1.,0.],[0.,1.,0.])):
        assert wall['location_cm'][2]==200 and wall['size_cm'][2]==400 and wall['join_overlap_cm']==35
        assert wall['bottom_z_cm']==0 and wall['top_z_cm']==400 and wall['outward_normal']==normal
    cap=walls[2]
    assert cap['label']==plan.PREFIX+'east boundary cap' and cap['outward_normal']==[1.,0.,0.]
    assert cap['location_cm']==[e[2],(b[1]+b[3])/2,300.]
    assert cap['size_cm']==[70.,b[3]-b[1],200.] and cap['bottom_z_cm']==200 and cap['top_z_cm']==400
    assert cap['location_cm'][2]-cap['size_cm'][2]/2==plan.ORIGINAL_WALL_HEIGHT_CM
    assert cap['location_cm'][2]+cap['size_cm'][2]/2==plan.BOUNDARY_HEIGHT_CM
    assert len(report['materials'])+len(report['closures'])+1+len(walls)==54
    native_stack_guard_test(report)
    assert report['source_road_exit_count']==12 and len(report['closures'])==10
    assert sorted(len(c['source_exits']) for c in report['closures'])==[1]*9+[3]
    for c in report['closures']:
        assert c['route_clearance_cm']>32000 and c['inset_cm']>=350 and c['illustrative']
        assert plan.inside(c['sign']['position'],e) and c['sign']['text']=='RUE BARRÉE'
    check_geometry(mesh,report);continuity(report);preservation_test()
    text=plan.header(report);assert text.isascii()
    def array_body(text, name):
        return text.split('const FVector '+name+'[][2] = {\n',1)[1].split('};',1)[0]
    extension = array_body(text,'RoadSegments')
    original = array_body((plan.ROOT/'Source/Quebec/LaFontaineMap.h').read_bytes().decode('ascii'),'RoadSegments')
    combined = array_body(text,'RadarRoadSegments')
    assert original and extension and combined.startswith(original), 'Complete original prefix bytes changed'
    assert combined[len(original):] == ',\n'+extension, 'Extension suffix differs from its own array'
    def coords(body):
        values = [[float(v) for v in group.split(',')] for group in re.findall(r'FVector\(([^)]+)\)',body)]
        assert values and len(values)%2==0
        return [values[i:i+2] for i in range(0,len(values),2)]
    old_points, new_points, radar_points = coords(original), coords(extension), coords(combined)
    assert len(new_points)==143 and radar_points[:len(old_points)]==old_points and radar_points[len(old_points):]==new_points
    assert report['radar_original_segments']==len(old_points) and report['radar_total_segments']==len(old_points)+143
    assert len(radar_points)==report['radar_total_segments'] and report['radar_total_segments']>143
    assert report['generator_sha256']==plan.sha(Path(plan.__file__))
    assert (plan.ROOT/plan.HEADER).read_text()==text
    saved=json.loads((plan.ROOT/plan.DATA/'extension.json').read_text());saved_without=copy.deepcopy(saved);saved_without.pop('geometry_files')
    assert saved_without==json.loads(json.dumps(report))
    with tempfile.TemporaryDirectory(prefix='nord-east-extension-') as temporary:
        root=Path(temporary)
        for name in plan.SOURCE_HASHES:
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(plan.ROOT/name,path)
        generated=plan.prepare(root);assert plan.load(root)==generated
        assert (root/plan.HEADER).read_text()==text
        preflight_tests(root,generated);backup_test(root);map_scope_test(root)
        source=root/'Data/LaFontaine/osm.xml';source.write_bytes(source.read_bytes()+b' ')
        try:plan.build(root)
        except AssertionError:pass
        else:raise AssertionError('Edited immutable source accepted')
    assert plan.sources()==before
    print('MONTREAL_EAST_CPU_OK '+str(report['radar_original_segments'])+' original + 143 = '+str(report['radar_total_segments'])+' exact combined radar segments; 143 surveyed segments, 10 contained closures/40 batches/14160 triangles, floor joins, deterministic header, source and original-actor guards; native execution remains untested')


if __name__=='__main__':main()
