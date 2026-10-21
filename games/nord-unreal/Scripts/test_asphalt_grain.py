"""The asphalt colour breaks its 2 m repeat. Normals stay on that grid."""
import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SURFACES = (ROOT / "Scripts/plateau_surfaces.py").read_text()


def asphalt_block():
    start = SURFACES.index("asphalt = material('Asphalt'")
    end = SURFACES.index("water = material(", start)
    return SURFACES[start:end]


class AsphaltGrainTests(unittest.TestCase):
    def test_the_colour_uses_two_scales_of_the_same_photo(self):
        block = asphalt_block()
        self.assertIn("const_b=.005", block)
        self.assertIn("const_b=.013", block)
        self.assertIn("const_b=.37", block)
        self.assertIn("wave(axis_x, .0011)", block)
        self.assertIn("wave(axis_y, .0009)", block)
        self.assertIn("wave(axis_x, .0023)", block)
        self.assertIn("wave(axis_y, .0017)", block)
        self.assertIn("const_a=.78", block)
        self.assertIn("const_b=1.", block)
        self.assertIn("SAMPLERTYPE_COLOR", block)
        self.assertLess(block.index("const_b=.005"), block.index("const_b=.013"))
        self.assertIn("link(scaled, '', base, 'A')", block)

    def test_apply_keeps_normals_on_the_fine_grid(self):
        import tempfile
        from test_plateau_water import FakeUnreal, regenerated
        syntax = ast.parse((ROOT / "Scripts/upgrade_plateau.py").read_text())
        helpers = [n for n in syntax.body if isinstance(n, ast.FunctionDef) and n.name in ("expression", "material")]
        with tempfile.TemporaryDirectory() as temporary:
            u = FakeUnreal(temporary)
            scope = {"M": u.MaterialEditingLibrary, "assets": u.EditorAssetLibrary, "tools": u.tools, "u": u}
            exec(compile(ast.Module(body=helpers, type_ignores=[]), "upgrade_plateau.py", "exec"), scope)
            import plateau_surfaces
            materials = {"Leaf": scope["material"]("Leaf", (.12, .24, .075))}
            for name, (color, texture) in regenerated(syntax).items():
                materials[name] = scope["material"](name, color, texture)
            u.VolumetricCloud = type("VolumetricCloud", (), {})
            u.VolumetricCloudComponent = u.ExponentialHeightFog = u.SkyLight = type("Other", (), {})
            cloud = type("Cloud", (), {})()
            cloud.set_material = lambda mat: None
            cloud.set_editor_property = lambda name, value: None

            def spawn(cls, location):
                actor = cls()
                actor.set_actor_label = actor.set_folder_path = lambda value: None
                actor.get_component_by_class = lambda component_class: cloud
                return actor

            u.get_editor_subsystem = lambda cls: type("Editor", (), {
                "get_all_level_actors": lambda self: [],
                "spawn_actor_from_class": lambda self, cls, location: spawn(cls, location),
            })()
            plateau_surfaces.apply(u, materials, scope["expression"], scope["material"])
            asphalt = materials["Asphalt"]
            color = [n for n in asphalt.expressions if type(n).KIND == "TextureSample"
                     and n.get_editor_property("sampler_type") == "SAMPLERTYPE_COLOR"]
            self.assertEqual(len(color), 2)
            self.assertIs(color[0].get_editor_property("texture"), color[1].get_editor_property("texture"))
            fine = next(n for n in asphalt.expressions if type(n).KIND == "Multiply" and n.get_editor_property("const_b") == .005)
            coarse = next(n for n in asphalt.expressions if type(n).KIND == "Multiply" and n.get_editor_property("const_b") == .013)
            self.assertIs(color[0].links["UVs"][0], fine)
            self.assertIs(color[1].links["UVs"][0].links["A"][0], coarse)
            normal = next(n for n in asphalt.expressions if type(n).KIND == "TextureSample"
                          and n.get_editor_property("sampler_type") == "SAMPLERTYPE_NORMAL")
            self.assertIs(normal.links["UVs"][0], fine)


if __name__ == "__main__":
    unittest.main()
