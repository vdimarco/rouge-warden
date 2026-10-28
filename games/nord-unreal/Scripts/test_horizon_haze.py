"""The comic aerial fade is stronger on the horizon than on a steep ray at the same depth."""
import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def haze_mix(depth, elevation, sky=False):
    """Mix toward the afternoon sky. Elevation is |ray.z| of a unit view ray."""
    horizon = max(0.0, min(1.0, 1.0 - elevation)) ** 3
    aerial = smoothstep(2500.0, 14000.0, depth)
    return aerial * (0.25 + 0.75 * horizon) * 0.85 * (0.0 if sky else 1.0)


class HorizonHazeTests(unittest.TestCase):
    def test_shader_uses_the_view_ray_and_keeps_the_depth_window(self):
        hlsl = comic_hlsl()
        self.assertIn('View.TanAndInvTanHalfFOV', hlsl)
        self.assertIn('View.ViewRight', hlsl)
        self.assertIn('View.ViewUp', hlsl)
        self.assertIn('pow(saturate(1.0 - Elevation), 3.0)', hlsl)
        self.assertIn('float Aerial = smoothstep(2500.0, 14000.0, DepthC)', hlsl)
        self.assertIn('Haze * 0.85 * (Sky ? 0.0 : 1.0)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_horizon_is_hazier_than_a_steep_view_and_the_near_street_stays(self):
        far = 20000.0
        self.assertEqual(haze_mix(1000.0, 0.0), 0.0)
        self.assertEqual(haze_mix(2000.0, 0.0), 0.0)
        self.assertAlmostEqual(haze_mix(far, 0.0), 0.85)
        # Walking pitch -12 leaves the centre ray near elevation 0.21, close to the old flat 0.5 mix.
        self.assertAlmostEqual(haze_mix(far, 0.208), 0.529, places=2)
        self.assertLess(haze_mix(far, 0.75), 0.25)
        self.assertGreater(haze_mix(far, 0.0), haze_mix(far, 0.75))
        self.assertEqual(haze_mix(far, 0.0, sky=True), 0.0)


if __name__ == '__main__':
    unittest.main()
