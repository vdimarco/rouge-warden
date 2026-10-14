"""CPU geometry, exported precision, provenance and fake-native preservation checks."""
import copy
import json
import shutil
import tempfile
from pathlib import Path
from types import SimpleNamespace as NS

from shapely.geometry import Point, Polygon

import apply_sneaky_dees as native
import prepare_sneaky_dees as art


mesh,built=art.build()
again,rebuilt=art.build()
assert mesh.groups==again.groups and built==rebuilt,'Non-deterministic facade'
manifest=art.verified()
assert {key:value for key,value in manifest.items() if key not in ('source_sha256','geometry_sha256')}==json.loads(json.dumps(built))
assert built['triangles']<10000 and set(mesh.groups)==set(art.MATERIALS)
assert [edge['name'] for edge in built['edges']]==['College','Corner','Bathurst']
assert built['edges'][0]['normal'][1]>.9 and built['edges'][2]['normal'][0]<-.9
assert all(sign['text']=="SNEAKY DEE'S" and sign['original_vector_lettering'] for sign in built['signs'])
assert len(built['signs'])==3 and built['counts']['upper_windows']==9
footprint=Polygon(built['footprint_cm'])
for faces in mesh.groups.values():
    for face in faces:
        assert all(footprint.buffer(25.01).covers(Point(point[:2])) and 0<=point[2]<=built['height_cm']+.01 for point in face)
for name,metadata in manifest['materials'].items():
    assert (art.ROOT/'Content/Plateau/Materials'/('M_'+metadata['material']+'.uasset')).is_file()
    summary=art.obj_summary(art.ROOT/art.RELATIVE/'Geometry'/(name+'.obj'))
    assert summary['triangles']==metadata['triangles'] and summary['minimum_triangle_area_cm2']>.1
assert built['clearances_cm']['spawn']>90 and built['clearances_cm']['sidewalk_centerline']>90
assert built['clearances_cm']['starter_car_body']>100 and built['clearances_cm']['tram_centerline']>127
layout=json.loads((art.ROOT/'Data/CollegeBathurst/layout.json').read_text())
for change in ('spawn','car','track','sidewalk'):
    bad=copy.deepcopy(layout)
    edge=built['edges'][0]
    a,b=edge['a'],edge['b']
    middle=[(a[index]+b[index])/2+edge['normal'][index]*15 for index in (0,1)]
    if change in ('spawn','car'):
        bad[change]=middle+[120]
    elif change=='track':
        bad['tram_lines']=[{'points':[a,b]}]
    else:
        bad['paths']=[[a,b]]
        bad['path_kinds']=['sidewalk']
    try:
        art.build(bad)
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe facade clearance accepted: '+change)


with tempfile.TemporaryDirectory() as directory:
    root=Path(directory)
    for name in manifest['source_sha256']:
        (root/name).parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(art.ROOT/name,root/name)
    art.prepare(root)
    first={path.name:path.read_bytes() for path in (root/art.RELATIVE/'Geometry').glob('*.obj')}
    saved=(root/art.RELATIVE/'facade.json').read_bytes()
    art.prepare(root)
    assert saved==(root/art.RELATIVE/'facade.json').read_bytes()
    assert first=={path.name:path.read_bytes() for path in (root/art.RELATIVE/'Geometry').glob('*.obj')}
    art.verified(root)
    path=root/'Data/CollegeBathurst/osm.xml'
    path.write_bytes(path.read_bytes()+b'\n')
    try:
        art.verified(root)
    except AssertionError:
        pass
    else:
        raise AssertionError('Changed geographic source accepted')
    shutil.copy2(art.ROOT/'Data/CollegeBathurst/osm.xml',path)
    path=root/art.RELATIVE/'Geometry/Gold.obj'
    path.write_text('v 0 0 0\nv 0.0001 0 0\nv 0 0 0\nf 1 2 3\n')
    current=json.loads((root/art.RELATIVE/'facade.json').read_text())
    current['geometry_sha256']['Gold']=art.digest(path)
    (root/art.RELATIVE/'facade.json').write_text(json.dumps(current))
    try:
        art.verified(root)
    except AssertionError:
        pass
    else:
        raise AssertionError('Rounded degenerate export accepted')


class Vector:
    def __init__(self,x=0,y=0,z=0): self.x,self.y,self.z=x,y,z


class Material:
    def __init__(self,path): self.path=path
    def get_path_name(self): return self.path+'.'+self.path.rsplit('/',1)[-1]


class StaticMesh:
    def __init__(self,path,triangles=100): self.path,self.triangles=path,triangles
    def get_path_name(self): return self.path+'.'+self.path.rsplit('/',1)[-1]
    def get_num_triangles(self,lod): return self.triangles
    def get_editor_property(self,name): return NS(get_editor_property=lambda key:1)
    def get_bounds(self):
        bounds=manifest['materials'][self.path.rsplit('SM_',1)[-1]]['bounds_cm']
        return NS(origin=Vector(*[(bounds[0][index]+bounds[1][index])/2 for index in range(3)]),
                  box_extent=Vector(*[(bounds[1][index]-bounds[0][index])/2 for index in range(3)]))
    def get_static_mesh_description(self,lod):
        return Description(art.ROOT/art.RELATIVE/'Geometry'/(self.path.rsplit('SM_',1)[-1]+'.obj'),
                           getattr(self,'reverse_normals',False))


class Description:
    def __init__(self,path,reverse):
        vertices=[]
        self.triangles=[]
        for line in path.read_text().splitlines():
            fields=line.split()
            if fields and fields[0]=='v':
                x,y,z=map(float,fields[1:])
                vertices.append((x,-y,z))
            elif fields and fields[0]=='f':
                triangle=[vertices[int(field.split('/')[0])-1] for field in fields[1:]]
                self.triangles.append(triangle[::-1] if reverse else triangle)
    def get_triangle_count(self): return len(self.triangles)
    def get_triangle_vertex_instances(self,index): return [index*3+i for i in range(3)]
    def get_vertex_instance_vertex(self,instance): return instance
    def get_vertex_position(self,vertex): return Vector(*self.triangles[vertex//3][vertex%3])


class Component:
    def __init__(self,mesh): self.static_mesh,self.material,self.profile,self.shadow=mesh,None,'BlockAll',True
    def get_collision_profile_name(self): return self.profile
    def get_collision_enabled(self): return 0 if self.profile=='NoCollision' else 1
    def is_visible(self): return True
    def get_editor_property(self,name): return self.shadow
    def get_num_materials(self): return 1
    def get_material(self,index): return self.material
    def set_static_mesh(self,mesh): self.static_mesh=mesh
    def set_material(self,index,material): self.material=material
    def set_collision_profile_name(self,profile): self.profile=profile
    def set_cast_shadow(self,value): self.shadow=value


class Actor:
    def __init__(self,label,mesh): self.label=label; self.static_mesh_component=Component(mesh)
    def get_actor_label(self): return self.label
    def get_path_name(self): return native.MAP+'.'+self.label
    def get_actor_location(self): return Vector()
    def get_actor_rotation(self): return NS(pitch=0,yaw=0,roll=0)
    def get_actor_scale3d(self): return Vector(1,1,1)
    def get_editor_property(self,name): return False
    def set_actor_label(self,label): self.label=label
    def set_folder_path(self,path): self.folder=path


class Fixture:
    def __init__(self,root):
        self.root=root
        self.mutations=[]
        self.command='Quebec.uproject /Game/Maps/CollegeBathurst -NullRHI'
        self.world=native.MAP+'.CollegeBathurst'
        self.dirty=[]
        self.existing=set()
        self.actors=[Actor('Toronto Landmark',StaticMesh('/Game/CollegeBathurst/SM_Landmark')),
                     Actor('Toronto Glass',StaticMesh('/Game/CollegeBathurst/SM_Glass'))]
        self.assets={'/Game/Plateau/Materials/M_'+name:Material('/Game/Plateau/Materials/M_'+name) for name in art.MATERIALS.values()}
        for name in ('Landmark','Glass'):
            path=root/'Content/CollegeBathurst'/('SM_'+name+'.uasset')
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes(b'protected native package')
        path=root/art.RELATIVE/'facade.json'
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(manifest))
        self.u=NS(StaticMeshActor=Actor,StaticMesh=StaticMesh,MaterialInterface=Material,Vector=Vector,
                  AssetImportTask=NS,FbxImportUI=lambda:NS(static_mesh_import_data=NS()),
                  CollisionEnabled=NS(NO_COLLISION=0),CollisionTraceFlag=NS(CTF_USE_COMPLEX_AS_SIMPLE=1),
                  TriangleID=lambda id_value:id_value)
        self.u.SystemLibrary=NS(get_command_line=lambda:self.command)
        self.u.Paths=NS(project_dir=lambda:str(root))
        self.u.EditorLoadingAndSavingUtils=NS(get_dirty_map_packages=lambda:self.dirty)
        self.u.EditorAssetLibrary=NS(does_asset_exist=lambda path:path in self.existing,
                                    load_asset=lambda path:self.assets.get(path),save_loaded_asset=self.save_asset)
        self.u.EditorActorSubsystem=type('EditorActorSubsystem',(),{})
        self.u.LevelEditorSubsystem=type('LevelEditorSubsystem',(),{})
        self.u.UnrealEditorSubsystem=type('UnrealEditorSubsystem',(),{})
        self.subsystems={self.u.EditorActorSubsystem:NS(get_all_level_actors=lambda:self.actors,spawn_actor_from_class=self.spawn),
                         self.u.LevelEditorSubsystem:NS(save_current_level=self.save_level),
                         self.u.UnrealEditorSubsystem:NS(get_editor_world=lambda:NS(get_path_name=lambda:self.world))}
        self.u.get_editor_subsystem=lambda cls:self.subsystems.get(cls)
        self.tools=NS(import_asset_tasks=self.import_meshes)
        self.u.AssetToolsHelpers=NS(get_asset_tools=lambda:self.tools)

    def import_meshes(self,tasks):
        for task in tasks:
            self.mutations.append('import '+task.destination_name)
            name=task.destination_name.removeprefix('SM_')
            path=task.destination_path+'/'+task.destination_name
            self.assets[path+'.'+task.destination_name]=StaticMesh(path,manifest['materials'][name]['triangles'])
            task.imported_object_paths=[path+'.'+task.destination_name]

    def spawn(self,cls,position):
        self.mutations.append('spawn')
        actor=Actor('new',None)
        self.actors.append(actor)
        return actor

    def save_asset(self,mesh): self.mutations.append('save asset'); return True
    def save_level(self): self.mutations.append('save map'); return True


original_verified=art.verified
art.verified=lambda root:copy.deepcopy(manifest)
rejections=0


def reject(change):
    global rejections
    with tempfile.TemporaryDirectory() as directory:
        fixture=Fixture(Path(directory))
        change(fixture)
        try:
            native.preflight(fixture.u,fixture.root)
        except (AssertionError,FileNotFoundError):
            pass
        else:
            raise AssertionError('Unsafe native fixture accepted')
        assert fixture.mutations==[],fixture.mutations
        rejections+=1


try:
    for command in ('','-RenderOffscreen','-NullRHIOther','-NullRHI=false','-ExecCmds="echo -NullRHI now"'):
        reject(lambda fixture,command=command:setattr(fixture,'command',command))
    reject(lambda fixture:setattr(fixture,'world','/Game/Maps/LaFontaine.LaFontaine'))
    reject(lambda fixture:fixture.dirty.append('dirty'))
    reject(lambda fixture:fixture.existing.add(native.DESTINATION+'/SM_Stone'))
    reject(lambda fixture:fixture.actors.append(Actor(native.PREFIX+'Stone',None)))
    reject(lambda fixture:fixture.actors.pop(0))
    reject(lambda fixture:setattr(fixture.actors[0].static_mesh_component,'profile','NoCollision'))
    reject(lambda fixture:setattr(fixture.actors[0].static_mesh_component,'static_mesh',StaticMesh('/Game/Other')))
    for path in ('Content/CollegeBathurst/SM_Landmark.uasset','Content/CollegeBathurst/SM_Glass.uasset'):
        reject(lambda fixture,path=path:(fixture.root/path).unlink())
    for name in set(art.MATERIALS.values()):
        reject(lambda fixture,name=name:fixture.assets.pop('/Game/Plateau/Materials/M_'+name))
    for name in ('StaticMeshActor','StaticMesh','MaterialInterface','AssetImportTask','FbxImportUI',
                 'EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem','Vector'):
        reject(lambda fixture,name=name:delattr(fixture.u,name))
    for name in ('EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem'):
        reject(lambda fixture,name=name:fixture.subsystems.pop(getattr(fixture.u,name)))
    reject(lambda fixture:setattr(fixture,'tools',None))
    with tempfile.TemporaryDirectory() as directory:
        fixture=Fixture(Path(directory))
        result=native.apply(fixture.u,fixture.root)
        assert result['passed'] and result['generic_glass_unchanged'] and result['landmark_collision_unchanged']
        assert result['protected_package_sha256_before']==result['protected_package_sha256_after']
        assert result['unowned_static_meshes_before']==result['unowned_static_meshes_after']
        assert len(result['created'])==8 and result['triangles']==2190
        assert all(actor.static_mesh_component.profile=='NoCollision' and not actor.static_mesh_component.shadow
                   for actor in fixture.actors if actor.label.startswith(native.PREFIX))
        assert len(list((fixture.root/'Saved/Tests').rglob('apply.json')))==1
        applied=next((fixture.root/'Saved/Tests').rglob('apply.json'))
        result=native.verify(fixture.u,applied,fixture.root)
        assert result['passed'] and result['triangles']==2190
        assert [check['outward_sign_triangles'] for check in result['front_normals']]==[90,180]
        cladding=next(actor for actor in fixture.actors if actor.label==native.PREFIX+'Cladding')
        cladding.static_mesh_component.static_mesh.reverse_normals=True
        try:
            native.verify(fixture.u,applied,fixture.root)
        except AssertionError:
            pass
        else:
            raise AssertionError('Inward native sign normals accepted')
        cladding.static_mesh_component.static_mesh.reverse_normals=False
        cladding.static_mesh_component.shadow=True
        try:
            native.verify(fixture.u,applied,fixture.root)
        except AssertionError:
            pass
        else:
            raise AssertionError('Changed saved facade shadow state accepted')
finally:
    art.verified=original_verified

print(f'Sneaky Dees CPU checks passed: deterministic {built["triangles"]} triangles, provenance/export/clearance guards, '
      f'{rejections} native preflight rejections without mutation, additive fake apply preserved original actors/packages. '
      'Native rendering remains separate.')
