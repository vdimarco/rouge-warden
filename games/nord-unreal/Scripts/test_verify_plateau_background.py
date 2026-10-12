"""Exercise saved background verification against the production partition."""
import ast
import json
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace

from plateau_background import SOURCES, partition
from test_verify_plateau_ground import Actor, Component, Object, StaticMesh, Vector


class BackgroundMesh(StaticMesh, Object):
    def __init__(self, name, triangles, bounds):
        super().__init__(name, triangles, bounds)
        self.nanite_settings = Object(enabled=True)
        self.body_setup = Object(collision_trace_flag=3)
        self.build_settings = Object(max_lumen_mesh_cards=64)
    def get_path_name(self): return '/Game/Plateau/Background/SM_'+self.name+'.SM_'+self.name


class BackgroundComponent(Component):
    def is_visible(self): return self.visible


class BackgroundActor(Actor, Object):
    def __init__(self, mesh, material, original=False):
        self.hidden = original
        self.static_mesh_component = BackgroundComponent(static_mesh=mesh, material=material,
            profile='BlockAll' if original else 'NoCollision', collision=2 if original else 0,
            cast_shadow=not original, affect_distance_field_lighting=not original,
            affect_dynamic_indirect_lighting=not original, visible=not original)


def main():
    source = Path(__file__).resolve().parents[1] / 'Data/Plateau/BaseGeometry'
    _, manifest, _ = partition(source)
    labels = {}
    for name in SOURCES:
        mesh = BackgroundMesh(name, manifest['sources'][name]['triangles'], [-50000,-50000,60000,70000,0,6000])
        labels['OSM '+name] = BackgroundActor(mesh, 'material '+name, original=True)
    for name, record in manifest['batches'].items():
        low, high = record['bounds_cm']
        mesh = BackgroundMesh(name, record['triangles'], [low[0],low[1],high[0],high[1],low[2],high[2]])
        labels['Plateau background '+name] = BackgroundActor(mesh, 'material '+record['material'])
    subsystem = Object(get_lod_build_settings=lambda mesh, lod: mesh.build_settings)
    fake = SimpleNamespace(StaticMeshActor=BackgroundActor, StaticMeshEditorSubsystem=object,
        get_editor_subsystem=lambda cls: subsystem, CollisionEnabled=Object(NO_COLLISION=0,QUERY_AND_PHYSICS=2),
        CollisionTraceFlag=Object(CTF_USE_COMPLEX_AS_SIMPLE=3))
    syntax = ast.parse(Path(__file__).with_name('verify_plateau.py').read_text())
    branch = ast.Module(body=[next(n for n in syntax.body if isinstance(n,ast.FunctionDef)and n.name=='verify_background')], type_ignores=[])
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        directory = root/'Data/Plateau/BackgroundGeometry'
        directory.mkdir(parents=True)
        (directory/'layout.json').write_text(json.dumps(manifest))
        visual_directory = root/'Data/Plateau/LandmarkVisualGeometry'
        visual_directory.mkdir(parents=True)
        visual_path = visual_directory/'visuals.json'
        visual_path.write_text(json.dumps({'replacements': []}))
        state = {'checks': []}
        namespace = {'ROOT':root,'u':fake,'REPORT':state,'json':json,'math':math}
        exec(compile(branch,'verify_plateau.py','exec'),namespace)
        verify = namespace['verify_background']
        verify(labels)
        assert state['background']['batches'] == len(manifest['batches'])
        assert state['background']['triangles'] == manifest['triangles']
        first = labels['Plateau background '+next(iter(manifest['batches']))].static_mesh_component
        original = labels['OSM Brick'].static_mesh_component
        mutations = [(first,'material','wrong material'),(first,'profile','BlockAll'),
                     (first.static_mesh.nanite_settings,'enabled',False),
                     (first.static_mesh.build_settings,'max_lumen_mesh_cards',12),
                     (first.static_mesh.bounds.origin,'x',first.static_mesh.bounds.origin.x+1),
                     (original,'visible',True),(original,'affect_distance_field_lighting',True),
                     (original,'profile','NoCollision'),(labels['OSM Brick'],'hidden',False),
                     (original.static_mesh,'triangles',original.static_mesh.triangles-1)]
        for obj,key,bad in mutations:
            saved = getattr(obj,key)
            setattr(obj,key,bad)
            try: verify(labels)
            except AssertionError: pass
            else: raise AssertionError('Background verifier accepted corrupt '+key)
            finally: setattr(obj,key,saved)
        first_label = 'Plateau background ' + next(iter(manifest['batches']))
        first_actor = labels[first_label]
        visual_path.write_text(json.dumps({'replacements': [{'source_actor_label': first_label}]}))
        first.visible = False
        first_actor.hidden = True
        verify(labels)
        first.visible = True
        try: verify(labels)
        except AssertionError: pass
        else: raise AssertionError('Background verifier accepted a visible replaced source')
        first.visible = False
        assert any(isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
                   and isinstance(n.func.value, ast.Name) and n.func.value.id == 'plateau_landmark_visuals'
                   and n.func.attr == 'verify' for n in ast.walk(syntax)), 'Native entrypoint must verify filtered copies separately'
    print('Saved-background verifier checks passed: '+str(len(manifest['batches']))+' production batches; corrupt bounds/material/collision/Nanite/cards/visibility/lighting/triangles rejected')


if __name__ == '__main__':
    main()
