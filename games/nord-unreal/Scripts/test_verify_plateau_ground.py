"""Exercise the saved-ground verification branch with a small Unreal facade."""
import ast
import json
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace

from plateau_ground import prepare


class Vector:
    def __init__(self, x=0, y=0, z=0): self.x, self.y, self.z = x, y, z
    def __sub__(self, other): return Vector(self.x-other.x, self.y-other.y, self.z-other.z)
    def length(self): return math.sqrt(self.x*self.x+self.y*self.y+self.z*self.z)


class Object:
    def __init__(self, **properties): self.__dict__.update(properties)
    def get_editor_property(self, name): return getattr(self, name)


class Texture:
    def __init__(self, name): self.name = name
    def get_name(self): return self.name


class Coordinate(Object):
    pass


class TextureSample(Object):
    pass


class Material:
    def __init__(self, name, diffuse):
        self.name, self.textures = name, []  # NullRHI has no compiled texture resources.
        self.coordinates = [Coordinate(u_tiling=1, v_tiling=1, inputs=[])]
        self.diffuse_sample = TextureSample(texture=Texture(diffuse), inputs=self.coordinates)
        self.roughness_sample = TextureSample(texture=Texture(diffuse.replace('_diff', '_rough')), inputs=self.coordinates)
        self.base_color = Object(inputs=[Object(inputs=[self.diffuse_sample, None])])
        self.expressions = self.coordinates + [self.diffuse_sample, self.roughness_sample, self.base_color]
    def get_path_name(self): return '/Game/Plateau/Materials/M_'+self.name+'.M_'+self.name


class StaticMesh:
    def __init__(self, name, triangles, limits):
        self.name, self.triangles = name, triangles
        xmin, ymin, xmax, ymax, zmin, zmax = limits
        self.bounds = Object(origin=Vector((xmin+xmax)/2, (ymin+ymax)/2, (zmin+zmax)/2),
                             box_extent=Vector((xmax-xmin)/2, (ymax-ymin)/2, (zmax-zmin)/2))
    def get_path_name(self): return '/Game/Plateau/Ground/SM_'+self.name+'.SM_'+self.name
    def get_num_triangles(self, lod): return self.triangles
    def get_bounds(self): return self.bounds


class Component(Object):
    def get_collision_profile_name(self): return self.profile
    def get_collision_enabled(self): return self.collision
    def get_material(self, index): return self.material


class Actor:
    def __init__(self, mesh, material):
        self.static_mesh_component = Component(static_mesh=mesh, material=material, profile='NoCollision',
                                               collision=0, cast_shadow=False)
    def get_actor_location(self): return Vector()
    def get_actor_scale3d(self): return Vector(1, 1, 1)
    def get_actor_rotation(self): return Object(roll=0, pitch=0, yaw=0)


def main():
    syntax = ast.parse(Path(__file__).with_name('verify_plateau.py').read_text())
    branch = ast.Module(body=[next(n for n in syntax.body if isinstance(n, ast.FunctionDef) and n.name=='verify_ground')], type_ignores=[])
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        directory = root/'Data/Plateau/GroundGeometry'
        report = prepare(directory)
        surfaces = report['surfaces']
        bounds = [min(s['bounds_xy'][i] for s in surfaces) for i in (0, 1)] + [
                  max(s['bounds_xy'][i] for s in surfaces) for i in (2, 3)] + [2, 9]
        grass = Material('ParkGrass', 'grass_ground_diff')
        gravel = Material('Gravel', 'concrete_pavement_diff')
        xmin,ymin,xmax,ymax = report['bounds_xy']
        labels = {'OSM Grass': Actor(StaticMesh('ParkGrass', sum(s['triangles'] for s in surfaces), bounds), grass),
                  'Plateau ground textured yards': Actor(StaticMesh('YardGround', 2, [xmin,ymin,xmax,ymax,.5,.5]), gravel),
                  'District ground': Actor(None, gravel)}
        fake = SimpleNamespace(StaticMeshActor=Actor, Vector=Vector, CollisionEnabled=Object(NO_COLLISION=0),
                               MaterialExpressionTextureCoordinate=Coordinate, MaterialExpressionTextureSample=TextureSample,
                               MaterialProperty=Object(MP_BASE_COLOR=0),
                               MaterialEditingLibrary=Object(get_material_used_textures=lambda m: m.textures,
                                   get_material_expressions=lambda m: m.expressions,
                                   get_material_property_input_node=lambda m, prop: m.base_color,
                                   get_inputs_for_material_expression=lambda m, expression: expression.inputs))
        state = {'checks': []}
        namespace = {'ROOT': root, 'u': fake, 'REPORT': state, 'json': json, 'math': math}
        exec(compile(branch, 'verify_plateau.py', 'exec'), namespace)
        verify = namespace['verify_ground']
        verify(labels)
        assert state['ground']['park_source'] == 'way/4767368'
        assert state['ground']['meshes']['YardGround']['triangles'] == 2
        assert not grass.textures and not gravel.textures, 'NullRHI regression requires uncompiled resources'
        assert state['ground']['meshes']['ParkGrass']['base_color_textures'] == ['grass_ground_diff']
        component = labels['OSM Grass'].static_mesh_component
        mutations = [(component.static_mesh, 'triangles', 1), (component, 'cast_shadow', True),
                     (component, 'profile', 'BlockAll'), (gravel.diffuse_sample, 'texture', None),
                     (gravel.base_color, 'inputs', []),  # Correct saved sample still exists, but is disconnected.
                     (gravel.coordinates[0], 'u_tiling', .001)]
        for obj, key, bad in mutations:
            original = getattr(obj, key)
            setattr(obj, key, bad)
            try:
                verify(labels)
            except AssertionError:
                pass
            else:
                raise AssertionError('Ground verifier accepted corrupt '+key)
            finally:
                setattr(obj, key, original)
    print('Saved-ground verifier checks passed: uncompiled NullRHI snapshot accepted; corrupt triangles/shadows/collision, missing or disconnected diffuse and bad UV tiling rejected')


if __name__ == '__main__':
    main()
