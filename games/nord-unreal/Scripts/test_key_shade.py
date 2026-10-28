"""Clear-day shade goes darker. Sunlit matte, night, gloss, sky and crew stay."""
import ast
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUN = (-0.62, -0.48, 0.62)


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _unit(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _smooth(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def half_lambert(normal):
    sun, normal = _unit(SUN), _unit(normal)
    half = max(0.0, min(1.0, sum(n * s for n, s in zip(normal, sun)) * 0.5 + 0.5))
    return half * half


def key_shade(color, normal, roughness, *, night=0.0, sky=False, crew=0.0):
    """Scalar applied after the hue grade. 1 leaves the colour."""
    share = (_smooth(0.28, 0.62, roughness)
             * (1.0 - max(0.0, min(1.0, night))) * (0.0 if sky else 1.0) * (1.0 - crew))
    shade = 0.58 + (1.0 - 0.58) * _smooth(0.12, 0.48, half_lambert(normal))
    return tuple(c * (1.0 + (shade - 1.0) * share) for c in color)


class KeyShadeTests(unittest.TestCase):
    def test_shader_keeps_the_shade_between_the_hue_and_the_night(self):
        hlsl = comic_hlsl()
        self.assertIn('float KeyOpen = smoothstep(0.12, 0.48, Half);', hlsl)
        self.assertIn('float KeyShade = lerp(0.58, 1.0, KeyOpen);', hlsl)
        self.assertIn(
            'float KeyShare = DayMatte * (1.0 - saturate(NightFactor)) * (Sky ? 0.0 : 1.0) * (1.0 - PrintedCrew);',
            hlsl)
        self.assertIn('Color *= lerp(1.0, KeyShade, KeyShare);', hlsl)
        self.assertLess(hlsl.index('saturate(DayGraded)'), hlsl.index('float KeyOpen'))
        self.assertLess(hlsl.index('float KeyShade'), hlsl.index('float3 MoonDir'))
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_only_the_shade_side_gets_darker(self):
        brick = (0.46, 0.22, 0.10)
        road = (0.45, 0.44, 0.42)
        shade = key_shade(brick, (0.0, 1.0, 0.0), 0.90)
        sun = key_shade(brick, (0.0, -1.0, 0.0), 0.90)
        ground = key_shade(road, (0.0, 0.0, 1.0), 0.90)
        self.assertLess(_lum(shade), _lum(brick) * 0.70)
        self.assertEqual(sun, brick)
        self.assertEqual(ground, road)
        self.assertEqual(key_shade(brick, (0.0, 1.0, 0.0), 0.90, night=1.0), brick)
        self.assertEqual(key_shade(brick, (0.0, 1.0, 0.0), 0.90, sky=True), brick)
        self.assertEqual(key_shade(brick, (0.0, 1.0, 0.0), 0.90, crew=1.0), brick)
        self.assertEqual(key_shade(brick, (0.0, 1.0, 0.0), 0.12), brick)


if __name__ == '__main__':
    unittest.main()
