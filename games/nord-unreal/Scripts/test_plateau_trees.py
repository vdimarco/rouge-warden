"""CPU guards for retained tree source pairing and appearance-only scene snapshots."""
import ast
import copy
import json
import math
from pathlib import Path
import re
import tempfile
from types import SimpleNamespace as NS
import unittest

from refine_plateau_trees import ROOT, source_inventory, tree_state, geometry_state, verified_source_bounds


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def shader_light(luminance, *, sky=False, roughness=.95, normal_z=1., shading_model=1., foliage=0., crew=0., novel_crew=0.):
    """Evaluate the actual scalar HLSL banding block, so a removed exemption fails continuity checks."""
    def smoothstep(a, b, value):
        t = max(0., min(1., (value - a) / (b - a)))
        return t * t * (3. - 2. * t)

    values = {'Lum': luminance, 'Sky': sky, 'Roughness': roughness, 'NormalZ': normal_z,
              'ShadingModel': shading_model, 'Foliage': foliage, 'Crew': crew, 'NovelCrew': novel_crew, 'Bands': 5.,
              'abs': abs, 'pow': pow, 'floor': math.floor, 'smoothstep': smoothstep,
              'step': lambda edge, value: float(value >= edge), 'lerp': lambda a, b, t: a + (b - a) * t}
    hlsl = comic_hlsl()
    for name in ('SmoothReflection', 'GradientMask', 'Banded', 'BandMix', 'Light'):
        for expression in re.findall(r'(?:float )?' + name + r' = ([^;]+);', hlsl):
            expression = expression.replace('NormalC.z', 'NormalZ')
            if '?' in expression:
                condition, choices = expression.split('?', 1)
                yes, no = choices.split(':', 1)
                expression = f'({yes} if {condition} else {no})'
            values[name] = eval(expression, {'__builtins__': {}}, values)
    return values['Light'], values['BandMix']


class TreeAppearanceTests(unittest.TestCase):
    def test_pilot_uses_restrained_bands_and_protected_print_mask(self):
        self.assertAlmostEqual(shader_light(.4, novel_crew=1.)[1], .22)
        self.assertEqual(shader_light(.4, crew=1.)[1], 0.)
        hlsl = comic_hlsl()
        self.assertIn('Stencil > 253.0 && Stencil <= 254.0 && abs(CrewDepth - DepthC)', hlsl)
        self.assertIn('float PrintedCrew = max(Crew, NovelCrew)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_original_cutout_source(self):
        data = source_inventory()
        self.assertEqual(data['leaf_triangles'], 1939380)
        self.assertEqual(len(data['sha256']), 4)
        self.assertTrue(all(len(value) == 64 for value in data['sha256'].values()))

    def test_wrong_image_pairing_rejected(self):
        self.rejected_source(lambda data: data['images'][4].update(uri='textures/wrong.jpg'))

    def test_incomplete_buffer_rejected(self):
        self.rejected_source(lambda data: data['buffers'][0].update(byteLength=1))

    def test_unexpected_opaque_leaf_source_rejected(self):
        self.rejected_source(lambda data: data['materials'][1].update(alphaMode='OPAQUE'))

    def rejected_source(self, mutate):
        source = ROOT / 'Data/Art/tree_small_02'
        data = json.loads((source / 'tree_small_02.gltf').read_text())
        mutate(data)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / 'Data/Art/tree_small_02'
            folder.mkdir(parents=True)
            (folder / 'tree_small_02.gltf').write_text(json.dumps(data))
            (folder / 'tree_small_02.bin').symlink_to(source / 'tree_small_02.bin')
            with self.assertRaises(AssertionError):
                source_inventory(root)

    def test_snapshot_detects_placement_and_collision_changes(self):
        class StaticMeshComponent:
            pass

        class Instances(StaticMeshComponent):
            pass

        comp = Instances()
        mesh = object()
        t = NS(translation=NS(x=1., y=2., z=3.), rotation=NS(x=0., y=0., z=0., w=1.),
               scale3d=NS(x=2., y=2., z=2.))
        comp.static_mesh = mesh
        comp.get_collision_enabled = lambda: 'NoCollision'
        comp.get_collision_profile_name = lambda: 'NoCollision'
        comp.get_world_transform = lambda: t
        comp.get_instance_transform = lambda i, world: t
        comp.get_instance_count = lambda: 1
        comp.get_path_name = lambda: '/World.Trees'
        actor = NS(get_components_by_class=lambda cls: [comp])
        u = NS(StaticMeshComponent=StaticMeshComponent, InstancedStaticMeshComponent=Instances,
               EditorActorSubsystem=object(), get_editor_subsystem=lambda cls:
               NS(get_all_level_actors=lambda: [actor]))
        initial = copy.deepcopy(tree_state(u, mesh))
        self.assertEqual(initial['/World.Trees']['instances'][0][:3], [1., 2., 3.])
        self.assertEqual(tree_state(u, mesh), initial)
        t.translation.x += 1
        self.assertNotEqual(tree_state(u, mesh), initial)
        t.translation.x -= 1
        comp.get_collision_enabled = lambda: 'QueryAndPhysics'
        self.assertNotEqual(tree_state(u, mesh), initial)

    def test_no_expected_tree_component_rejected(self):
        u = NS(EditorActorSubsystem=object(), get_editor_subsystem=lambda cls:
               NS(get_all_level_actors=lambda: []))
        with self.assertRaises(AssertionError):
            tree_state(u, object())

    def test_raw_geometry_fingerprint_detects_vertex_change(self):
        positions = [NS(x=-1., y=2., z=3.), NS(x=4., y=5., z=6.)]
        description = NS(get_vertex_count=lambda: 2, is_vertex_valid=lambda i: i in range(2),
                         get_vertex_position=lambda i: positions[i], get_vertex_instance_count=lambda: 3,
                         get_triangle_count=lambda: 1, get_polygon_count=lambda: 1)
        mesh = NS(get_static_mesh_description=lambda lod: description)
        u = NS(VertexID=int)
        before = geometry_state(u, mesh)
        self.assertEqual(before['minimum'], [-1., 2., 3.])
        self.assertEqual(before['maximum'], [4., 5., 6.])
        positions[0].x += .01
        self.assertNotEqual(geometry_state(u, mesh)['position_sha256'], before['position_sha256'])
        positions[0].x = float('nan')
        with self.assertRaises(AssertionError):
            geometry_state(u, mesh)

    def test_comic_shader_classifies_visible_foliage_and_keeps_crew_occlusion(self):
        source = (ROOT / 'Scripts/apply_comic_style.py').read_text()
        hlsl = comic_hlsl()
        self.assertIn('GetDefaultSceneTextureUV(Parameters, 23)', hlsl)
        self.assertIn('float LeafBoundary = max(Foliage, max(FoliageA, FoliageB))', hlsl)
        self.assertIn('(1.0 - LeafBoundary)', hlsl)
        self.assertIn('abs(CrewDepth - DepthC) < max(2.0, DepthC * 0.002)', hlsl)
        self.assertIn('Stencil > 254.0', hlsl)
        self.assertIn("link(scene(u.SceneTextureId.PPI_SHADING_MODEL_ID), 'Color', custom, 'FoliageInput')", source)

    def test_sky_and_surveyed_water_gradients_do_not_jump_at_light_band_boundaries(self):
        source = (ROOT / 'Scripts/apply_comic_style.py').read_text()
        self.assertIn("link(scene(u.SceneTextureId.PPI_ROUGHNESS), 'Color', custom, 'RoughnessInput')", source)
        self.assertIn('GetDefaultSceneTextureUV(Parameters, 11)', comic_hlsl())
        for surface in ({'sky': True}, {'roughness': .17, 'normal_z': .999}):
            for boundary in (.2, .4, .6, .8):
                below, blend = shader_light(boundary - 1e-8, **surface)
                above, _ = shader_light(boundary + 1e-8, **surface)
                self.assertEqual(blend, 0.)
                self.assertGreater(above, below)
                self.assertLess(above - below, 1e-6)

    def test_gradient_exception_retains_comic_style_on_other_surfaces(self):
        for surface, expected in (({}, .35), ({'roughness': .17, 'normal_z': 0.}, .35),
                                  ({'foliage': 1., 'shading_model': 6.}, .12),
                                  ({'crew': 1.}, 0.)):
            self.assertAlmostEqual(shader_light(.4, **surface)[1], expected)
        below, _ = shader_light(.4 - 1e-8)
        above, _ = shader_light(.4 + 1e-8)
        self.assertGreater(above - below, .04)
        # A smooth upward-facing non-Default-Lit material must not be misidentified as this pond.
        self.assertAlmostEqual(shader_light(.4, roughness=.17, normal_z=1., shading_model=6.)[1], .35)

    def test_rebuilt_bounds_match_exact_raw_geometry_and_reject_corruption(self):
        geometry = {'minimum': [-1., 2., 3.], 'maximum': [4., 5., 6.], 'position_sha256': 'unchanged'}
        bounds = [1.5, 3.5, 4.5, 2.5, 1.5, 1.5]
        self.assertEqual(verified_source_bounds(geometry, geometry, bounds), bounds)
        damaged = bounds.copy(); damaged[0] += .0000001
        with self.assertRaises(AssertionError):
            verified_source_bounds(geometry, geometry, damaged)
        damaged_geometry = dict(geometry, position_sha256='changed')
        with self.assertRaises(AssertionError):
            verified_source_bounds(geometry, damaged_geometry, bounds)


if __name__ == '__main__':
    unittest.main()
