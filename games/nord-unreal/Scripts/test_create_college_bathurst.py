"""CPU regression: every missing creator prerequisite rejects before any authoring call."""
import ast
import json
import runpy
import sys
import tempfile
from pathlib import Path
from types import ModuleType, SimpleNamespace

SOURCE=Path(__file__).with_name('create_college_bathurst.py')
TREE=ast.parse(SOURCE.read_text())
MATERIALS=ast.literal_eval(next(node.value for node in TREE.body if isinstance(node,ast.Assign)
                              and any(isinstance(target,ast.Name) and target.id=='MATERIALS'
                                      for target in node.targets)))
MAP='/Game/Maps/CollegeBathurst'
CUBE='/Engine/BasicShapes/Cube'
CLOUD='/Engine/EngineSky/VolumetricClouds/m_SimpleVolumetricCloud_Inst'
CAR='/Script/Quebec.QuebecCar'
CLASSES=('StaticMesh','MaterialInterface','StaticMeshActor','PlayerStart','DirectionalLight',
         'SkyAtmosphere','SkyLight','ExponentialHeightFog','ExponentialHeightFogComponent',
         'VolumetricCloud','VolumetricCloudComponent','PostProcessVolume','AssetImportTask',
         'FbxImportUI','EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem',
         'Vector','Rotator')


class ReachedMapCreation(Exception):
    """The valid fixture stops at the first actual mutation; it does not simulate native import."""


class Fixture:
    def __init__(self,root):
        self.root=root
        self.command='Quebec.uproject /Engine/Maps/Entry -NullRHI -unattended'
        self.mutations=[]
        self.loaded=[]
        self.class_loads=[]
        self.existing=set()
        self.dirty=[]
        self.unreal=ModuleType('unreal')
        for name in CLASSES:
            setattr(self.unreal,name,type(name,(),{}))
        self.assets={CUBE:self.unreal.StaticMesh(),CLOUD:self.unreal.MaterialInterface()}
        self.assets.update({'/Game/Plateau/Materials/M_'+name:self.unreal.MaterialInterface()
                            for name in set(MATERIALS.values())})
        self.car=type('QuebecCar',(),{})
        self.subsystems={
            self.unreal.EditorActorSubsystem:SimpleNamespace(spawn_actor_from_class=self.mutation),
            self.unreal.LevelEditorSubsystem:SimpleNamespace(new_level=self.new_level,save_current_level=self.mutation),
            self.unreal.UnrealEditorSubsystem:SimpleNamespace(set_level_viewport_camera_info=self.mutation),
        }
        self.tools=SimpleNamespace(import_asset_tasks=self.mutation)
        self.unreal.Paths=SimpleNamespace(project_dir=lambda:str(root))
        self.unreal.SystemLibrary=SimpleNamespace(get_command_line=lambda:self.command)
        self.unreal.EditorAssetLibrary=SimpleNamespace(
            does_asset_exist=lambda path:path in self.existing,load_asset=self.load_asset,
            save_loaded_asset=self.mutation,save_directory=self.mutation)
        self.unreal.EditorLoadingAndSavingUtils=SimpleNamespace(get_dirty_map_packages=lambda:self.dirty)
        self.unreal.AssetToolsHelpers=SimpleNamespace(get_asset_tools=lambda:self.tools)
        self.unreal.get_editor_subsystem=lambda cls:self.subsystems.get(cls)
        self.unreal.load_class=self.load_class
        self.unreal.CollisionTraceFlag=SimpleNamespace(CTF_USE_COMPLEX_AS_SIMPLE=1)
        self.unreal.ComponentMobility=SimpleNamespace(MOVABLE=1)
        data=root/'Data/CollegeBathurst'
        (data/'Geometry').mkdir(parents=True)
        self.layout={'bounds_cm':[-1000,-1000,1000,1000],'spawn':[0,0,120],
                     'car':[500,0,115],'car_yaw':15,'counts':{}}
        self.save_layout()
        for name in MATERIALS:
            (data/'Geometry'/f'{name}.obj').write_text('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')

    def load_asset(self,path):
        self.loaded.append(path)
        return self.assets.get(path)

    def save_layout(self):
        (self.root/'Data/CollegeBathurst/layout.json').write_text(json.dumps(self.layout))

    def load_class(self,outer,path):
        self.class_loads.append(path)
        return self.car if path==CAR else None

    def mutation(self,*args,**kwargs):
        self.mutations.append(('unexpected authoring',args))
        raise ReachedMapCreation('Authoring occurred before preflight completed')

    def new_level(self,path):
        self.mutations.append(('new_level',path))
        assert CLOUD in self.loaded and CUBE in self.loaded and CAR in self.class_loads, \
            'Late engine/car prerequisite was not checked before map creation'
        raise ReachedMapCreation()

    def files(self):
        return {str(path.relative_to(self.root)):path.read_bytes() for path in self.root.rglob('*') if path.is_file()}

    def run(self):
        previous=sys.modules.get('unreal')
        sys.modules['unreal']=self.unreal
        try:
            runpy.run_path(str(SOURCE))
        finally:
            if previous is None:
                del sys.modules['unreal']
            else:
                sys.modules['unreal']=previous


checks=0


def reject(change):
    global checks
    with tempfile.TemporaryDirectory() as directory:
        fixture=Fixture(Path(directory))
        change(fixture)
        before=fixture.files()
        try:
            fixture.run()
        except AssertionError:
            pass
        else:
            raise AssertionError('Unsafe input reached authoring or did not reject')
        assert fixture.mutations==[],fixture.mutations
        assert fixture.files()==before,'Preflight changed source files'
        checks+=1


for command in ('', '-RenderOffscreen', '-NullRHIOther', '-NullRHI=false',
                '-ExecCmds="echo -NullRHI now"', '-ExecutePythonScript="/tmp/-NullRHI extra.py"'):
    reject(lambda fixture,command=command:setattr(fixture,'command',command))
reject(lambda fixture:fixture.existing.add(MAP))
reject(lambda fixture:fixture.existing.add('/Game/CollegeBathurst/SM_Road'))
reject(lambda fixture:fixture.dirty.append(SimpleNamespace(get_path_name=lambda:'/Game/Maps/LaFontaine.LaFontaine')))
reject(lambda fixture:fixture.dirty.append(SimpleNamespace(get_path_name=lambda:'/Game/Maps/Other.Other')))
for key in ('bounds_cm','spawn','car','car_yaw','counts'):
    reject(lambda fixture,key=key:(fixture.layout.pop(key),fixture.save_layout()))
for key,value in (('bounds_cm',[0,0,0,1000]),('spawn',[0,0]),('car_yaw',float('inf')),('counts',None)):
    reject(lambda fixture,key=key,value=value:(fixture.layout.update({key:value}),fixture.save_layout()))
for name in MATERIALS:
    reject(lambda fixture,name=name:(fixture.root/'Data/CollegeBathurst/Geometry'/f'{name}.obj').unlink())
reject(lambda fixture:(fixture.root/'Data/CollegeBathurst/Geometry/Grass.obj').write_text(''))
reject(lambda fixture:(fixture.root/'Data/CollegeBathurst/Geometry/Unknown.obj').write_text('v 0 0 0'))
for path in (CUBE,CLOUD,*('/Game/Plateau/Materials/M_'+name for name in set(MATERIALS.values()))):
    reject(lambda fixture,path=path:fixture.assets.pop(path))
reject(lambda fixture:fixture.assets.update({CUBE:fixture.unreal.MaterialInterface()}))
reject(lambda fixture:fixture.assets.update({CLOUD:fixture.unreal.StaticMesh()}))
reject(lambda fixture:setattr(fixture,'car',None))
for name in CLASSES:
    reject(lambda fixture,name=name:delattr(fixture.unreal,name))
for name in ('EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem'):
    reject(lambda fixture,name=name:fixture.subsystems.pop(getattr(fixture.unreal,name)))
reject(lambda fixture:setattr(fixture,'tools',None))

for flag in ('-NullRHI','-NuLlRhI'):
    with tempfile.TemporaryDirectory() as directory:
        fixture=Fixture(Path(directory))
        fixture.command='Quebec.uproject /Engine/Maps/Entry '+flag
        before=fixture.files()
        try:
            fixture.run()
        except ReachedMapCreation:
            pass
        else:
            raise AssertionError('Complete prerequisites did not reach map creation')
        assert fixture.mutations==[('new_level',MAP)]
        assert fixture.files()==before

print(f'College/Bathurst creator preflight passed: {checks} unsafe fixtures rejected without mutation; '
      'two valid offline fixtures reached map creation. Native import remains a separate check.')
