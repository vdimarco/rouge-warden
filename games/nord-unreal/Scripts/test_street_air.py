"""Near street dust, between the camera and the far aerial window."""
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


def street_air(depth, elevation, night=0.0, sky=False):
    """Mix toward warm dust. Elevation is |ray.z| of a unit view ray."""
    horizon = max(0.0, min(1.0, 1.0 - elevation)) ** 3
    near = smoothstep(500.0, 1800.0, depth)
    far = 1.0 - smoothstep(2200.0, 7000.0, depth)
    share = near * far * horizon * (0.0 if sky else 1.0) * (1.0 - max(0.0, min(1.0, night)))
    return share * 0.62


class StreetAirTests(unittest.TestCase):
    def test_shader_keeps_the_far_window_and_adds_a_near_band(self):
        hlsl = comic_hlsl()
        haze = hlsl.index('Haze * 0.85 * (Sky ? 0.0 : 1.0)')
        air = hlsl.index('float StreetAir = StreetNear * StreetFar * Horizon')
        clouds = hlsl.index('float2 CloudUv = Ray.xy / max(Ray.z, 0.07);')
        self.assertLess(haze, air)
        self.assertLess(air, clouds)
        self.assertIn('float StreetNear = smoothstep(500.0, 1800.0, DepthC);', hlsl)
        self.assertIn('float StreetFar = 1.0 - smoothstep(2200.0, 7000.0, DepthC);', hlsl)
        self.assertIn('lerp(Color, float3(0.74, 0.71, 0.64), StreetAir * 0.62)', hlsl)
        self.assertIn('float Aerial = smoothstep(2500.0, 14000.0, DepthC)', hlsl)
        self.assertIn('pow(saturate(1.0 - Elevation), 3.0)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)
        self.assertNotIn('CloudCover', hlsl)

    def test_the_walking_street_hazes_and_the_foreground_and_the_far_window_do_not(self):
        self.assertEqual(street_air(200.0, 0.0), 0.0)
        self.assertEqual(street_air(400.0, 0.0), 0.0)
        self.assertAlmostEqual(street_air(1800.0, 0.0), 0.62)
        self.assertEqual(street_air(12000.0, 0.0), 0.0)
        self.assertEqual(street_air(1800.0, 1.0), 0.0)
        self.assertEqual(street_air(1800.0, 0.0, night=1.0), 0.0)
        self.assertEqual(street_air(1800.0, 0.0, sky=True), 0.0)
        # Centre of the walking frame is inside the band. The bottom of the frame is not.
        self.assertGreater(street_air(1410.0, 0.208), 0.12)
        self.assertEqual(street_air(440.0, 0.66), 0.0)
        self.assertGreater(street_air(1800.0, 0.1), street_air(1800.0, 0.6))


if __name__ == '__main__':
    unittest.main()
